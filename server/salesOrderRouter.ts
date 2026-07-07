import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { salesOrderRequests, salesOrderRequestItems, productMinPrices, sellerPermissions, stockItems, sellerProductVisibility, purchaseOrderItems, salesOrders, cobrancaPlanilha, vendorClients, accountsReceivable, priceTables, priceTableItems, appSettings, systemNotifications, notificationReads, importPos, importPoProducts } from "../drizzle/schema";
import { sql, and, eq, desc, like, or, inArray } from "drizzle-orm";
import { calcularImpostos, calcularMargem, type TipoProduto, type TipoContribuinte } from "./taxCalculation";
import { cotarBraspress, cotarTodosCnpjs, BRASPRESS_CNPJS } from "./braspressApi";
import { quoteAlfaFreight, quoteAllAlfaCnpjs } from "./alfaApi";
import { quoteAllSswCnpjs } from "./sswApi";
import { quoteAllRodonavesCnpjs, RODONAVES_CNPJS } from "./rodonavesApi";

/**
 * Sales Order Requests Router
 * Handles the full lifecycle of sales orders created by field sellers:
 * - Create order (seller)
 * - Search existing clients (autocomplete)
 * - List orders by status
 * - Approve/reject (gestor)
 * - Mark as processed (Vitória)
 * - Manage minimum prices
 */
export const salesOrderRouter = router({

  // ===== CLIENT SEARCH (AUTOCOMPLETE) =====

  /** Search clients from existing sales_orders + sales_order_requests + vendor_clients for autocomplete */
  searchClients: publicProcedure
    .input(z.object({ query: z.string().min(1), sellerId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const q = input.query.trim();

      // 0. Search in vendor_clients (cadastro de clientes do vendedor)
      let fromVendorClients: Array<{
        vendorClientId?: number; cnpjCpf: string; razaoSocial: string; nomeFantasia: string;
        inscricaoEstadual: string; tipoContribuinte: string; regimeTributario: string;
        emailNfe: string; cnaeFiscal: string; cep: string; endereco: string;
        numero: string; complemento: string; bairro: string; municipio: string;
        uf: string; telefone1: string; telefone2: string; emailContato: string; segmento: string;
      }> = [];
      try {
        const qL = q.toLowerCase();
        const vcRows = await db.select()
          .from(vendorClients)
          .where(
            and(
              ...(input.sellerId ? [eq(vendorClients.sellerId, input.sellerId)] : []),
              or(
                sql`LOWER(${vendorClients.razaoSocial}) LIKE ${`%${qL}%`}`,
                sql`LOWER(${vendorClients.nomeFantasia}) LIKE ${`%${qL}%`}`,
                like(vendorClients.cnpjCpf, `%${q}%`)
              )
            )
          )
          .limit(20);
        fromVendorClients = vcRows.map(vc => ({
          vendorClientId: vc.id,
          cnpjCpf: vc.cnpjCpf || "",
          razaoSocial: vc.razaoSocial || "",
          nomeFantasia: vc.nomeFantasia || "",
          inscricaoEstadual: vc.inscricaoEstadual || "",
          tipoContribuinte: vc.tipoContribuinte || "Contribuinte",
          regimeTributario: "Normal",
          emailNfe: "",
          cnaeFiscal: "",
          cep: vc.cep || "",
          endereco: vc.logradouro || "",
          numero: vc.numero || "",
          complemento: vc.complemento || "",
          bairro: vc.bairro || "",
          municipio: vc.cidade || "",
          uf: vc.uf || "",
          telefone1: vc.telefone1 || "",
          telefone2: vc.telefone2 || "",
          emailContato: vc.email || "",
          segmento: vc.segmento || "",
        }));
      } catch (e) {
        // Silently continue if vendor_clients lookup fails
      }

      // 1. Search in previous sales_order_requests (manual orders from app)
      const qUpper = q.toUpperCase();
      const qLower = q.toLowerCase();

      const fromManualOrders = await db.select({
        cnpjCpf: salesOrderRequests.cnpjCpf,
        razaoSocial: salesOrderRequests.razaoSocial,
        nomeFantasia: salesOrderRequests.nomeFantasia,
        inscricaoEstadual: salesOrderRequests.inscricaoEstadual,
        tipoContribuinte: salesOrderRequests.tipoContribuinte,
        regimeTributario: salesOrderRequests.regimeTributario,
        emailNfe: salesOrderRequests.emailNfe,
        cnaeFiscal: salesOrderRequests.cnaeFiscal,
        cep: salesOrderRequests.cep,
        endereco: salesOrderRequests.endereco,
        numero: salesOrderRequests.numero,
        complemento: salesOrderRequests.complemento,
        bairro: salesOrderRequests.bairro,
        municipio: salesOrderRequests.municipio,
        uf: salesOrderRequests.uf,
        telefone1: salesOrderRequests.telefone1,
        telefone2: salesOrderRequests.telefone2,
        emailContato: salesOrderRequests.emailContato,
        segmento: salesOrderRequests.segmento,
      })
      .from(salesOrderRequests)
      .where(
        or(
          sql`LOWER(${salesOrderRequests.razaoSocial}) LIKE ${`%${qLower}%`}`,
          sql`LOWER(${salesOrderRequests.nomeFantasia}) LIKE ${`%${qLower}%`}`,
          like(salesOrderRequests.cnpjCpf, `%${q}%`)
        )
      )
      .orderBy(desc(salesOrderRequests.createdAt))
      .limit(20);

      // 2. Search in Maxiprod sales_orders (historical clients)
      const fromMaxiprod = await db.select({
        cliente: salesOrders.cliente,
        clienteApelido: salesOrders.clienteApelido,
        razaoSocial: salesOrders.razaoSocial,
        inscricaoEstadual: salesOrders.inscricaoEstadual,
        uf: salesOrders.uf,
        enderecoCep: salesOrders.enderecoCep,
        enderecoLogradouro: salesOrders.enderecoLogradouro,
        enderecoNumero: salesOrders.enderecoNumero,
        enderecoComplemento: salesOrders.enderecoComplemento,
        enderecoBairro: salesOrders.enderecoBairro,
        enderecoCidade: salesOrders.enderecoCidade,
        clienteTelefone: salesOrders.clienteTelefone,
        clienteEmail: salesOrders.clienteEmail,
        crmSegmento: salesOrders.crmSegmento,
      })
      .from(salesOrders)
      .where(
        or(
          sql`LOWER(${salesOrders.cliente}) LIKE ${`%${qLower}%`}`,
          sql`LOWER(${salesOrders.clienteApelido}) LIKE ${`%${qLower}%`}`,
          sql`LOWER(${salesOrders.razaoSocial}) LIKE ${`%${qLower}%`}`
        )
      )
      .orderBy(desc(salesOrders.dataEmissao))
      .limit(50);

      // Deduplicate Maxiprod clients by razaoSocial/cliente
      const maxiprodSeen = new Set<string>();
      const maxiprodUnique: Array<{
        cnpjCpf: string;
        razaoSocial: string;
        nomeFantasia: string;
        inscricaoEstadual: string;
        tipoContribuinte: string;
        regimeTributario: string;
        emailNfe: string;
        cnaeFiscal: string;
        cep: string;
        endereco: string;
        numero: string;
        complemento: string;
        bairro: string;
        municipio: string;
        uf: string;
        telefone1: string;
        telefone2: string;
        emailContato: string;
        segmento: string;
      }> = [];

      for (const row of fromMaxiprod) {
        const key = (row.razaoSocial || row.cliente || "").toUpperCase().trim();
        if (!key || maxiprodSeen.has(key)) continue;
        maxiprodSeen.add(key);
        maxiprodUnique.push({
          cnpjCpf: "",
          razaoSocial: row.razaoSocial || row.cliente || "",
          nomeFantasia: row.clienteApelido || row.cliente || "",
          inscricaoEstadual: row.inscricaoEstadual || "",
          tipoContribuinte: "Contribuinte",
          regimeTributario: "Normal",
          emailNfe: "",
          cnaeFiscal: "",
          cep: row.enderecoCep || "",
          endereco: row.enderecoLogradouro || "",
          numero: row.enderecoNumero || "",
          complemento: row.enderecoComplemento || "",
          bairro: row.enderecoBairro || "",
          municipio: row.enderecoCidade || "",
          uf: row.uf || "",
          telefone1: row.clienteTelefone || "",
          telefone2: "",
          emailContato: row.clienteEmail || "",
          segmento: row.crmSegmento || "",
        });
      }

      // 3. Try to find CNPJ from cobranca_planilha for Maxiprod clients
      // The cobranca_planilha table has cnpjCpf linked to empresa (razaoSocial)
      const clientNames = maxiprodUnique.map(c => c.razaoSocial).filter(Boolean);
      let cnpjMap = new Map<string, string>();
      if (clientNames.length > 0) {
        try {
          const cobrancaRows = await db.select({
            empresa: cobrancaPlanilha.empresa,
            cnpjCpf: cobrancaPlanilha.cnpjCpf,
          })
          .from(cobrancaPlanilha)
          .where(
            or(
              ...clientNames.map(name => like(cobrancaPlanilha.empresa, `%${name.substring(0, 20)}%`))
            )
          )
          .limit(50);
          
          for (const row of cobrancaRows) {
            if (row.cnpjCpf && row.empresa) {
              cnpjMap.set(row.empresa.toUpperCase().trim(), row.cnpjCpf);
            }
          }
        } catch (e) {
          // Silently continue if cobranca lookup fails
        }
      }

      // Enrich Maxiprod clients with CNPJ from cobranca_planilha
      for (const row of maxiprodUnique) {
        if (!row.cnpjCpf) {
          const key = row.razaoSocial.toUpperCase().trim();
          // Try exact match first
          if (cnpjMap.has(key)) {
            row.cnpjCpf = cnpjMap.get(key)!;
          } else {
            // Try partial match
            for (const [empresa, cnpj] of Array.from(cnpjMap.entries())) {
              if (empresa.includes(key) || key.includes(empresa)) {
                row.cnpjCpf = cnpj;
                break;
              }
            }
          }
        }
      }

      // 4. Merge: vendor_clients first (most complete local data), then manual orders, then Maxiprod
      const seen = new Set<string>();
      const results: Array<typeof fromManualOrders[number] & { vendorClientId?: number }> = [];

      // Add vendor_clients first (cadastro do vendedor - most complete)
      for (const row of fromVendorClients) {
        const key = row.cnpjCpf ? row.cnpjCpf : (row.razaoSocial || "").toUpperCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        if (row.razaoSocial) seen.add(row.razaoSocial.toUpperCase().trim());
        if (row.nomeFantasia) seen.add(row.nomeFantasia.toUpperCase().trim());
        results.push(row as any);
      }

      // Add manual order clients (they have CNPJ and full data)
      for (const row of fromManualOrders) {
        const key = row.cnpjCpf ? row.cnpjCpf : (row.razaoSocial || "").toUpperCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        // Also mark razaoSocial to avoid duplicates from Maxiprod
        if (row.razaoSocial) seen.add(row.razaoSocial.toUpperCase().trim());
        results.push(row);
      }

      // Add Maxiprod clients that aren't already in the list
      for (const row of maxiprodUnique) {
        const keyRazao = row.razaoSocial.toUpperCase().trim();
        const keyCnpj = row.cnpjCpf;
        if (seen.has(keyRazao) || (keyCnpj && seen.has(keyCnpj))) continue;
        seen.add(keyRazao);
        results.push(row as any);
      }

      return results.slice(0, 15);
    }),

  // ===== PRODUCT LIST WITH MIN PRICES =====

  /** Get available products with min prices for the seller */
  getProductsForSeller: publicProcedure
    .input(z.object({ sellerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Get seller's visible product codes
      const visibleProducts = await db.select()
        .from(sellerProductVisibility)
        .where(eq(sellerProductVisibility.sellerId, input.sellerId));
      const visibleCodes = new Set(visibleProducts.map(p => p.productCode));

      // Get stock items with available quantity
      const items = await db.select({
        codigoItem: stockItems.codigoItem,
        descricaoItem: stockItems.descricaoItem,
        quantidade: stockItems.quantidade,
        unidadeMedida: stockItems.unidadeMedida,
        unidadeDeVendaFator: stockItems.unidadeDeVendaFator,
        codigoGrupo: stockItems.codigoGrupo,
        descricaoGrupo: stockItems.descricaoGrupo,
        custoUnitario: stockItems.custoUnitario,
        pesoLiquido: stockItems.pesoLiquido,
        pesoBruto: stockItems.pesoBruto,
        codigoBarras: stockItems.codigoBarras,
        descricaoComplementar: stockItems.descricaoComplementar,
        procedencia: stockItems.procedencia,
        estado: stockItems.estado,
        unidadeDeVendaCodigo: stockItems.unidadeDeVendaCodigo,
      })
      .from(stockItems)
      .where(sql`CAST(${stockItems.quantidade} AS DECIMAL) > 0`);

      // Filter by visibility if seller has configured products
      const filteredItems = visibleCodes.size > 0
        ? items.filter(item => visibleCodes.has(item.codigoItem))
        : items;

      // Get min prices
      const prices = await db.select().from(productMinPrices);
      const priceMap = new Map(prices.map(p => [p.codigoItem, p.precoMinimo]));

      // Get seller's price table prices
      const seller = await db.select().from(sellerPermissions).where(eq(sellerPermissions.id, input.sellerId)).limit(1);
      let priceTableMap = new Map<string, { preco: string; descontoMaximo: string | null }>();
      let margemNegociacao: number | null = null;
      if (seller.length > 0) {
        const priceTableCode = seller[0].priceTableCode;
        const gestorName = seller[0].gestorName;
        // Get margem de negociação from settings
        if (gestorName) {
          const margemKey = `margem_negociacao_${gestorName}`;
          const margemRow = await db.select().from(appSettings).where(eq(appSettings.settingKey, margemKey)).limit(1);
          if (margemRow.length > 0 && margemRow[0].settingValue) {
            try { margemNegociacao = parseFloat(JSON.parse(margemRow[0].settingValue as string)); } catch {}
          }
        }
        // Get price table items for this seller's table
        const allTables = await db.select().from(priceTables);
        let matchedTable: typeof allTables[0] | undefined;
        
        // 1. Try direct mapping via priceTableCode field
        if (priceTableCode) {
          matchedTable = allTables.find(t => t.codigo === priceTableCode);
        }
        
        // 2. Fallback: match by seller name in table description
        if (!matchedTable) {
          const nameParts = seller[0].sellerName.toUpperCase().split(' ');
          matchedTable = allTables.find(t => {
            const desc = t.descricao.toUpperCase();
            return nameParts.some(part => part.length > 3 && desc.includes(part));
          });
        }
        
        if (matchedTable) {
          const ptItems = await db.select().from(priceTableItems).where(eq(priceTableItems.priceTableId, matchedTable.id));
          for (const pti of ptItems) {
            priceTableMap.set(pti.itemCodigo, { preco: pti.preco, descontoMaximo: pti.descontoMaximoEmPercentual });
          }
        }
      }

      // Get pending POs (purchase orders) for these products
      const pendingPOs = await db.select({
        codigoItem: purchaseOrderItems.codigoItem,
        quantidade: purchaseOrderItems.quantidade,
        quantidadeUnEstoque: purchaseOrderItems.quantidadeUnEstoque,
        fatorConversao: purchaseOrderItems.fatorConversao,
        dataEntrega: purchaseOrderItems.dataEntrega,
        referencia: purchaseOrderItems.referencia,
        estadoItem: purchaseOrderItems.estadoItem,
      })
      .from(purchaseOrderItems)
      .where(
        sql`${purchaseOrderItems.estadoItem} NOT IN ('ATENDIDO','CANCELADO')`
      );

      // Group POs by codigoItem
      const poMap = new Map<string, Array<{ quantidade: string; quantidadeUnEstoque: string | null; fatorConversao: string | null; dataEntrega: string | null; referencia: string | null }>>(); 
      for (const po of pendingPOs) {
        if (!po.codigoItem) continue;
        if (!poMap.has(po.codigoItem)) poMap.set(po.codigoItem, []);
        poMap.get(po.codigoItem)!.push({
          quantidade: po.quantidade,
          quantidadeUnEstoque: po.quantidadeUnEstoque,
          fatorConversao: po.fatorConversao,
          dataEntrega: po.dataEntrega,
          referencia: po.referencia,
        });
      }

      return filteredItems.map(item => {
        const ptData = priceTableMap.get(item.codigoItem);
        const precoTabela = ptData ? parseFloat(ptData.preco) : null;
        // Preço vendedor = Preço tabela ÷ (1 - margem%)
        const precoVendedor = (precoTabela && margemNegociacao) ? precoTabela / (1 - margemNegociacao / 100) : precoTabela;
        const descontoMaxTabela = ptData?.descontoMaximo ? parseFloat(ptData.descontoMaximo) : null;
        return {
          codigoItem: item.codigoItem,
          descricaoItem: item.descricaoItem,
          disponivel: item.quantidade,
          unidadeMedida: item.unidadeMedida,
          unidadeDeVendaFator: item.unidadeDeVendaFator,
          precoMinimo: priceMap.get(item.codigoItem) || null,
          precoTabela: precoTabela ? precoTabela.toFixed(2) : null,
          precoVendedor: precoVendedor ? precoVendedor.toFixed(2) : null,
          descontoMaxTabela: descontoMaxTabela ? descontoMaxTabela.toFixed(2) : null,
          margemNegociacao: margemNegociacao,
          grupo: item.descricaoGrupo || item.codigoGrupo || "",
          pesoLiquido: item.pesoLiquido,
          pesoBruto: item.pesoBruto,
          codigoBarras: item.codigoBarras,
          descricaoComplementar: item.descricaoComplementar,
          procedencia: item.procedencia,
          estado: item.estado,
          unidadeDeVendaCodigo: item.unidadeDeVendaCodigo,
          pendingPOs: poMap.get(item.codigoItem) || [],
        };
      });
    }),

  // ===== CREATE ORDER =====

  /** Create a new sales order request */
  createOrder: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      // Client data
      cnpjCpf: z.string().optional().default(""),
      razaoSocial: z.string().min(2),
      nomeFantasia: z.string().optional(),
      inscricaoEstadual: z.string().optional(),
      tipoContribuinte: z.string().optional(),
      regimeTributario: z.string().optional(),
      emailNfe: z.string().optional(),
      cnaeFiscal: z.string().optional(),
      // Address
      cep: z.string().optional(),
      endereco: z.string().optional(),
      numero: z.string().optional(),
      complemento: z.string().optional(),
      bairro: z.string().optional(),
      municipio: z.string().optional(),
      uf: z.string().optional(),
      telefone1: z.string().optional(),
      telefone2: z.string().optional(),
      emailContato: z.string().optional(),
      // Sale data
      segmento: z.string().optional(),
      condicaoPagamento: z.string().optional(),
      valorFrete: z.number().optional(),
      tipoFrete: z.string().optional(),
      observacoes: z.string().optional(),
      // Items
      items: z.array(z.object({
        codigoItem: z.string(),
        descricaoItem: z.string(),
        quantidade: z.number().positive(),
        unidadeMedida: z.string().optional(),
        precoUnitario: z.number().positive(),
      })).min(1),
      // Flag: vendedor confirmou que quer enviar mesmo com preço abaixo do mínimo
      forceSubmitBelowMin: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Verify seller exists and is authorized
      const [seller] = await db.select().from(sellerPermissions)
        .where(eq(sellerPermissions.id, input.sellerId));
      if (!seller) throw new Error("Vendedor não encontrado");
      if (!seller.authorized) throw new Error("Vendedor não autorizado");

      // Get min prices for validation
      const prices = await db.select().from(productMinPrices);
      const priceMap = new Map(prices.map(p => [p.codigoItem, Number(p.precoMinimo)]));

      // Calculate totals and validate prices
      let totalProdutos = 0;
      let temPrecoAbaixoMinimo = false;
      const alertMotivos: string[] = [];

      const itemsWithValidation = input.items.map(item => {
        const totalItem = item.quantidade * item.precoUnitario;
        totalProdutos += totalItem;
        const minPrice = priceMap.get(item.codigoItem);
        const abaixo = minPrice !== undefined && item.precoUnitario < minPrice;
        if (abaixo) {
          temPrecoAbaixoMinimo = true;
          const diffReais = (minPrice! - item.precoUnitario).toFixed(2);
          const diffPercent = (((minPrice! - item.precoUnitario) / minPrice!) * 100).toFixed(1);
          alertMotivos.push(`${item.descricaoItem} (${item.codigoItem}): vendendo a R$ ${item.precoUnitario.toFixed(2)}, mínimo R$ ${minPrice!.toFixed(2)} — R$ ${diffReais} a menos (${diffPercent}% abaixo)`);
        }
        return {
          ...item,
          totalItem,
          precoMinimo: minPrice ?? null,
          abaixoDoMinimo: abaixo,
        };
      });

      const valorFrete = input.valorFrete || 0;
      const totalPedido = totalProdutos + valorFrete;

      // Determine status
      const status = temPrecoAbaixoMinimo ? "pendente" as const : "aprovado" as const;
      const motivoAlerta = alertMotivos.length > 0 ? alertMotivos.join("; ") : null;

      // Get next sequential order number atomically
      await db.execute(sql`UPDATE order_number_counter SET next_number = next_number + 1 WHERE id = 1`);
      const [counterRow] = await db.execute(sql`SELECT next_number - 1 as current_number FROM order_number_counter WHERE id = 1`);
      const orderNumber = (counterRow as any).current_number;

      // Insert order
      const [result] = await db.insert(salesOrderRequests).values({
        orderNumber,
        sellerId: input.sellerId,
        sellerName: seller.sellerName,
        gestorName: seller.gestorName || null,
        status,
        cnpjCpf: input.cnpjCpf,
        razaoSocial: input.razaoSocial,
        nomeFantasia: input.nomeFantasia || null,
        inscricaoEstadual: input.inscricaoEstadual || null,
        tipoContribuinte: input.tipoContribuinte || null,
        regimeTributario: input.regimeTributario || null,
        emailNfe: input.emailNfe || null,
        cnaeFiscal: input.cnaeFiscal || null,
        cep: input.cep || null,
        endereco: input.endereco || null,
        numero: input.numero || null,
        complemento: input.complemento || null,
        bairro: input.bairro || null,
        municipio: input.municipio || null,
        uf: input.uf || null,
        telefone1: input.telefone1 || null,
        telefone2: input.telefone2 || null,
        emailContato: input.emailContato || null,
        segmento: input.segmento || null,
        condicaoPagamento: input.condicaoPagamento || null,
        valorFrete: valorFrete.toFixed(2),
        tipoFrete: input.tipoFrete || null,
        observacoes: input.observacoes || null,
        totalProdutos: totalProdutos.toFixed(2),
        totalPedido: totalPedido.toFixed(2),
        temPrecoAbaixoMinimo,
        motivoAlerta,
      });

      const orderId = result.insertId;

      // Insert items
      if (itemsWithValidation.length > 0) {
        await db.insert(salesOrderRequestItems).values(
          itemsWithValidation.map(item => ({
            orderId: Number(orderId),
            codigoItem: item.codigoItem,
            descricaoItem: item.descricaoItem,
            quantidade: item.quantidade.toFixed(3),
            unidadeMedida: item.unidadeMedida || null,
            precoUnitario: item.precoUnitario.toFixed(2),
            precoMinimo: item.precoMinimo !== null ? item.precoMinimo.toFixed(2) : null,
            totalItem: item.totalItem.toFixed(2),
            abaixoDoMinimo: item.abaixoDoMinimo,
          }))
        );
      }

      // Send notification to Juvenal and Vitória about new seller order
      try {
        const { createNotification } = await import("./notificationRouter");
        const totalCaixas = itemsWithValidation.reduce((sum, i) => sum + i.quantidade, 0);
        const itemsResume = itemsWithValidation.map(i => `${i.descricaoItem} (${i.quantidade}cx × R$ ${i.precoUnitario.toFixed(2)} = R$ ${i.totalItem.toFixed(2)})`).join(" | ");
        await createNotification({
          type: "pedido_vendedor",
          title: `Novo Pedido - ${seller.sellerName}`,
          message: `Cliente: ${input.razaoSocial} | ${itemsWithValidation.length} ${itemsWithValidation.length === 1 ? 'item' : 'itens'} | ${totalCaixas} caixas | Total: R$ ${totalPedido.toFixed(2)}${temPrecoAbaixoMinimo ? ' ⚠️ PREÇO ABAIXO DO MÍNIMO' : ''} | Itens: ${itemsResume}`,
          severity: temPrecoAbaixoMinimo ? "warning" : "success",
          metadata: { orderId: Number(orderId), sellerName: seller.sellerName, gestorName: seller.gestorName, clientName: input.razaoSocial, totalPedido, totalCaixas, status },
        });
      } catch (err) {
        console.error("[SalesOrder] Failed to create notification:", err);
      }

      return {
        success: true,
        orderId: Number(orderId),
        orderNumber,
        status,
        temPrecoAbaixoMinimo,
        motivoAlerta,
      };
    }),

  // ===== VALIDATE ORDER (pre-check before submit) =====

  /** Pre-validate order items against min prices - returns warnings without creating order */
  validateOrder: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      items: z.array(z.object({
        codigoItem: z.string(),
        descricaoItem: z.string(),
        quantidade: z.number().positive(),
        precoUnitario: z.number().positive(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const prices = await db.select().from(productMinPrices);
      const priceMap = new Map(prices.map(p => [p.codigoItem, Number(p.precoMinimo)]));

      const warnings: Array<{
        codigoItem: string;
        descricaoItem: string;
        precoVendido: number;
        precoMinimo: number;
        diferencaReais: number;
        diferencaPercent: number;
      }> = [];

      for (const item of input.items) {
        const minPrice = priceMap.get(item.codigoItem);
        if (minPrice !== undefined && item.precoUnitario < minPrice) {
          warnings.push({
            codigoItem: item.codigoItem,
            descricaoItem: item.descricaoItem,
            precoVendido: item.precoUnitario,
            precoMinimo: minPrice,
            diferencaReais: Number((minPrice - item.precoUnitario).toFixed(2)),
            diferencaPercent: Number((((minPrice - item.precoUnitario) / minPrice) * 100).toFixed(1)),
          });
        }
      }

      return { hasWarnings: warnings.length > 0, warnings };
    }),

  // ===== LIST ORDERS =====

  /** List orders with filters (for gestor/Vitória) */
  listOrders: publicProcedure
    .input(z.object({
      status: z.enum(["pendente", "aprovado", "rejeitado", "processado", "todos"]).optional(),
      sellerId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions: any[] = [];
      if (input?.status && input.status !== "todos") {
        conditions.push(eq(salesOrderRequests.status, input.status));
      }
      if (input?.sellerId) {
        conditions.push(eq(salesOrderRequests.sellerId, input.sellerId));
      }

      const orders = await db.select().from(salesOrderRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(salesOrderRequests.createdAt))
        .limit(100);

      return orders;
    }),

  /** Get order details with items */
  getOrderDetails: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const [order] = await db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.id, input.orderId));
      if (!order) throw new Error("Pedido não encontrado");

      const items = await db.select().from(salesOrderRequestItems)
        .where(eq(salesOrderRequestItems.orderId, input.orderId));

      return { order, items };
    }),

  /** Get all orders for a specific gestor (approval dashboard) */
  getOrdersForGestor: publicProcedure
    .input(z.object({ gestorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const orders = await db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.gestorName, input.gestorName))
        .orderBy(desc(salesOrderRequests.createdAt))
        .limit(100);

      // Get items for all orders
      const orderIds = orders.map(o => o.id);
      let allItems: any[] = [];
      if (orderIds.length > 0) {
        allItems = await db.select().from(salesOrderRequestItems)
          .where(inArray(salesOrderRequestItems.orderId, orderIds));
      }

      // Group items by orderId
      const itemsByOrder = new Map<number, typeof allItems>();
      for (const item of allItems) {
        if (!itemsByOrder.has(item.orderId)) itemsByOrder.set(item.orderId, []);
        itemsByOrder.get(item.orderId)!.push(item);
      }

      return orders.map(order => ({
        ...order,
        items: itemsByOrder.get(order.id) || [],
      }));
    }),

  /** Get approved orders for Vitória (ready to process in Maxiprod) */
  getOrdersForOperator: publicProcedure
    .input(z.object({ status: z.enum(["aprovado", "processado", "todos"]).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const statusFilter = input?.status || "aprovado";
      const conditions: any[] = [];
      if (statusFilter !== "todos") {
        conditions.push(eq(salesOrderRequests.status, statusFilter));
      } else {
        conditions.push(or(
          eq(salesOrderRequests.status, "aprovado"),
          eq(salesOrderRequests.status, "processado")
        ));
      }

      const orders = await db.select().from(salesOrderRequests)
        .where(and(...conditions))
        .orderBy(desc(salesOrderRequests.createdAt))
        .limit(100);

      // Get items for all orders
      const orderIds = orders.map(o => o.id);
      let allItems: any[] = [];
      if (orderIds.length > 0) {
        allItems = await db.select().from(salesOrderRequestItems)
          .where(inArray(salesOrderRequestItems.orderId, orderIds));
      }

      const itemsByOrder = new Map<number, typeof allItems>();
      for (const item of allItems) {
        if (!itemsByOrder.has(item.orderId)) itemsByOrder.set(item.orderId, []);
        itemsByOrder.get(item.orderId)!.push(item);
      }

      return orders.map(order => ({
        ...order,
        items: itemsByOrder.get(order.id) || [],
      }));
    }),

  /** Get orders for a specific seller (seller app) */
  getSellerOrders: publicProcedure
    .input(z.object({ sellerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const orders = await db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.sellerId, input.sellerId))
        .orderBy(desc(salesOrderRequests.createdAt))
        .limit(50);

      // Get items for all orders
      const orderIds = orders.map(o => o.id);
      let allItems: any[] = [];
      if (orderIds.length > 0) {
        allItems = await db.select().from(salesOrderRequestItems)
          .where(inArray(salesOrderRequestItems.orderId, orderIds));
      }

      const itemsByOrder = new Map<number, typeof allItems>();
      for (const item of allItems) {
        if (!itemsByOrder.has(item.orderId)) itemsByOrder.set(item.orderId, []);
        itemsByOrder.get(item.orderId)!.push(item);
      }

      return orders.map(order => ({
        ...order,
        items: itemsByOrder.get(order.id) || [],
      }));
    }),

  // ===== APPROVAL FLOW =====

  /** Approve an order (gestor) */
  approveOrder: publicProcedure
    .input(z.object({
      orderId: z.number(),
      aprovadoPor: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      await db.update(salesOrderRequests)
        .set({
          status: "aprovado",
          aprovadoPor: input.aprovadoPor,
          dataAprovacao: new Date(),
        })
        .where(eq(salesOrderRequests.id, input.orderId));

      return { success: true };
    }),

  /** Reject an order (gestor) */
  rejectOrder: publicProcedure
    .input(z.object({
      orderId: z.number(),
      aprovadoPor: z.string(),
      motivoRejeicao: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      await db.update(salesOrderRequests)
        .set({
          status: "rejeitado",
          aprovadoPor: input.aprovadoPor,
          dataAprovacao: new Date(),
          motivoRejeicao: input.motivoRejeicao,
        })
        .where(eq(salesOrderRequests.id, input.orderId));

      return { success: true };
    }),

  /** Mark order as processed (Vitória) */
  markAsProcessed: publicProcedure
    .input(z.object({
      orderId: z.number(),
      processadoPor: z.string(),
      numeroPedidoMaxiprod: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      await db.update(salesOrderRequests)
        .set({
          status: "processado",
          processadoPor: input.processadoPor,
          dataProcessamento: new Date(),
          numeroPedidoMaxiprod: input.numeroPedidoMaxiprod || null,
        })
        .where(eq(salesOrderRequests.id, input.orderId));

      return { success: true };
    }),

  // ===== VITÓRIA STATUS FLOW =====

  /** Mark order as received by Vitória */
  markRecebido: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(salesOrderRequests)
        .set({ vitoriaRecebido: true, vitoriaRecebidoAt: new Date() })
        .where(eq(salesOrderRequests.id, input.orderId));
      return { success: true };
    }),

  /** Mark order as entered in Maxiprod by Vitória */
  markLancado: publicProcedure
    .input(z.object({ orderId: z.number(), numeroPedidoMaxiprod: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(salesOrderRequests)
        .set({
          vitoriaLancado: true,
          vitoriaLancadoAt: new Date(),
          status: "processado",
          processadoPor: "Vit\u00f3ria",
          dataProcessamento: new Date(),
          numeroPedidoMaxiprod: input.numeroPedidoMaxiprod || null,
        })
        .where(eq(salesOrderRequests.id, input.orderId));
      return { success: true };
    }),

  /** Count pending orders for Vitória (approved but not yet lançado) */
  countPendingVitoria: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { pending: 0, naoRecebido: 0, recebidoNaoLancado: 0 };
    const approved = await db.select().from(salesOrderRequests)
      .where(eq(salesOrderRequests.status, "aprovado"));
    const naoRecebido = approved.filter(o => !o.vitoriaRecebido).length;
    const recebidoNaoLancado = approved.filter(o => o.vitoriaRecebido && !o.vitoriaLancado).length;
    return { pending: approved.length, naoRecebido, recebidoNaoLancado };
  }),

  /** Export client data in Maxiprod Excel format for a specific order */
  exportClientMaxiprod: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Get the order to find client CNPJ
      const [order] = await db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.id, input.orderId));
      if (!order) throw new Error("Pedido n\u00e3o encontrado");

      const cnpjLimpo = (order.cnpjCpf || "").replace(/[^\d]/g, "");
      if (!cnpjLimpo) throw new Error("Pedido sem CNPJ do cliente");

      // Find matching vendor_client by CNPJ
      const [client] = await db.select().from(vendorClients)
        .where(sql`REPLACE(REPLACE(REPLACE(${vendorClients.cnpjCpf}, '.', ''), '-', ''), '/', '') = ${cnpjLimpo}`)
        .limit(1);

      if (!client) {
        throw new Error("Cliente n\u00e3o encontrado no cadastro de vendedores. Apenas clientes cadastrados manualmente podem ser exportados.");
      }

      // Generate Excel using existing utility
      const { generateMaxiprodExcel } = await import("./maxiprodExcelExport");
      const buffer = await generateMaxiprodExcel([client.id]);

      // Return base64 for frontend download
      const base64 = buffer.toString("base64");
      const filename = `Maxiprod_${client.razaoSocial.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      return { base64, filename, clientName: client.razaoSocial };
    }),

  /** Get modification info for clients in orders (for Vit\u00f3ria's banner) */
  getClientModificationInfo: publicProcedure
    .input(z.object({ orderIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      if (input.orderIds.length === 0) return [];

      // Get orders to extract CNPJs
      const orders = await db.select({
        id: salesOrderRequests.id,
        cnpjCpf: salesOrderRequests.cnpjCpf,
      }).from(salesOrderRequests)
        .where(inArray(salesOrderRequests.id, input.orderIds));

      // For each order, check if the vendor_client has been modified
      const results: Array<{ orderId: number; modified: boolean; modifiedBy: string | null; clientName: string | null; hasVendorClient: boolean }> = [];

      for (const order of orders) {
        const cnpjLimpo = (order.cnpjCpf || "").replace(/[^\d]/g, "");
        if (!cnpjLimpo) {
          results.push({ orderId: order.id, modified: false, modifiedBy: null, clientName: null, hasVendorClient: false });
          continue;
        }

        const [client] = await db.select({
          id: vendorClients.id,
          razaoSocial: vendorClients.razaoSocial,
          lastModifiedBy: vendorClients.lastModifiedBy,
          createdAt: vendorClients.createdAt,
          updatedAt: vendorClients.updatedAt,
        }).from(vendorClients)
          .where(sql`REPLACE(REPLACE(REPLACE(${vendorClients.cnpjCpf}, '.', ''), '-', ''), '/', '') = ${cnpjLimpo}`)
          .limit(1);

        if (!client) {
          results.push({ orderId: order.id, modified: false, modifiedBy: null, clientName: null, hasVendorClient: false });
          continue;
        }

        // Client was modified if lastModifiedBy is set OR updatedAt > createdAt + 1 minute
        const wasModified = !!client.lastModifiedBy || 
          (client.updatedAt && client.createdAt && 
           client.updatedAt.getTime() - client.createdAt.getTime() > 60000);

        results.push({
          orderId: order.id,
          modified: wasModified,
          modifiedBy: client.lastModifiedBy || null,
          clientName: client.razaoSocial,
          hasVendorClient: true,
        });
      }

      return results;
    }),

  /** Count pending orders for gestores (pendente = needs approval) */
  countPendingGestor: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { pending: 0 };
    const pendente = await db.select().from(salesOrderRequests)
      .where(eq(salesOrderRequests.status, "pendente"));
    return { pending: pendente.length };
  }),

  // ===== MIN PRICE MANAGEMENT =====

  /** List all min prices (gestor) */
  listMinPrices: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(productMinPrices);
  }),

  /** Set min price for a product */
  setMinPrice: publicProcedure
    .input(z.object({
      codigoItem: z.string(),
      descricaoItem: z.string(),
      precoMinimo: z.number().positive(),
      unidadeMedida: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Upsert - check if exists
      const [existing] = await db.select().from(productMinPrices)
        .where(eq(productMinPrices.codigoItem, input.codigoItem));

      if (existing) {
        await db.update(productMinPrices)
          .set({
            precoMinimo: input.precoMinimo.toFixed(2),
            descricaoItem: input.descricaoItem,
            unidadeMedida: input.unidadeMedida || null,
          })
          .where(eq(productMinPrices.id, existing.id));
      } else {
        await db.insert(productMinPrices).values({
          codigoItem: input.codigoItem,
          descricaoItem: input.descricaoItem,
          precoMinimo: input.precoMinimo.toFixed(2),
          unidadeMedida: input.unidadeMedida || null,
        });
      }

      return { success: true };
    }),

  /** Delete min price */
  deleteMinPrice: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.delete(productMinPrices).where(eq(productMinPrices.id, input.id));
      return { success: true };
    }),

  /** Bulk set min prices */
  bulkSetMinPrices: publicProcedure
    .input(z.object({
      prices: z.array(z.object({
        codigoItem: z.string(),
        descricaoItem: z.string(),
        precoMinimo: z.number().positive(),
        unidadeMedida: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      for (const price of input.prices) {
        const [existing] = await db.select().from(productMinPrices)
          .where(eq(productMinPrices.codigoItem, price.codigoItem));

        if (existing) {
          await db.update(productMinPrices)
            .set({
              precoMinimo: price.precoMinimo.toFixed(2),
              descricaoItem: price.descricaoItem,
              unidadeMedida: price.unidadeMedida || null,
            })
            .where(eq(productMinPrices.id, existing.id));
        } else {
          await db.insert(productMinPrices).values({
            codigoItem: price.codigoItem,
            descricaoItem: price.descricaoItem,
            precoMinimo: price.precoMinimo.toFixed(2),
            unidadeMedida: price.unidadeMedida || null,
          });
        }
      }

      return { success: true, count: input.prices.length };
    }),

  // ===== STATS =====

  /** Get order stats for dashboard */
  getOrderStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { pendentes: 0, aprovados: 0, rejeitados: 0, processados: 0 };

    const [stats] = await db.select({
      pendentes: sql<number>`SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END)`,
      aprovados: sql<number>`SUM(CASE WHEN status = 'aprovado' THEN 1 ELSE 0 END)`,
      rejeitados: sql<number>`SUM(CASE WHEN status = 'rejeitado' THEN 1 ELSE 0 END)`,
      processados: sql<number>`SUM(CASE WHEN status = 'processado' THEN 1 ELSE 0 END)`,
    }).from(salesOrderRequests);

    return {
      pendentes: Number(stats?.pendentes || 0),
      aprovados: Number(stats?.aprovados || 0),
      rejeitados: Number(stats?.rejeitados || 0),
      processados: Number(stats?.processados || 0),
    };
  }),

  // ===== CLIENT HISTORY (Informações do Cliente) =====

  /** Get full client history: purchases, debts, overdue boletos */
  getClientHistory: publicProcedure
    .input(z.object({ clientName: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { purchases: [], debts: [], summary: { totalCompras: 0, totalPedidos: 0, totalEmAberto: 0, titulosVencidos: 0, diasAtrasoMax: 0, ultimaCompra: null as string | null } };

      const clientNameLower = input.clientName.toLowerCase();

      // 1. Purchase history - get distinct orders for this client
      const purchases = await db.select({
        pedido: salesOrders.pedido,
        dataEmissao: salesOrders.dataEmissao,
        cliente: salesOrders.cliente,
        clienteApelido: salesOrders.clienteApelido,
        valorTotalPedido: salesOrders.valorTotalPedido,
        estadoNota: salesOrders.estadoNota,
        condicaoPagamento: salesOrders.condicaoPagamento,
        representante: salesOrders.representante,
        uf: salesOrders.uf,
      })
      .from(salesOrders)
      .where(
        or(
          sql`LOWER(${salesOrders.cliente}) LIKE ${`%${clientNameLower}%`}`,
          sql`LOWER(${salesOrders.clienteApelido}) LIKE ${`%${clientNameLower}%`}`,
          sql`LOWER(${salesOrders.razaoSocial}) LIKE ${`%${clientNameLower}%`}`
        )
      )
      .orderBy(desc(salesOrders.dataEmissao))
      .limit(200);

      // Deduplicate by pedido number
      const seenPedidos = new Set<string>();
      const uniquePurchases: Array<{
        pedido: string; dataEmissao: string; valor: number;
        estado: string; condicaoPagamento: string; representante: string;
      }> = [];
      for (const p of purchases) {
        const key = p.pedido || `${p.dataEmissao}-${p.valorTotalPedido}`;
        if (seenPedidos.has(key)) continue;
        seenPedidos.add(key);
        uniquePurchases.push({
          pedido: p.pedido || "",
          dataEmissao: p.dataEmissao || "",
          valor: Number(p.valorTotalPedido || 0),
          estado: p.estadoNota || "",
          condicaoPagamento: p.condicaoPagamento || "",
          representante: p.representante || "",
        });
      }

      // 2. Debts - accounts receivable for this client (EMITIDO = pending)
      const debts = await db.select({
        id: accountsReceivable.id,
        estado: accountsReceivable.estado,
        valorOriginal: accountsReceivable.valorOriginal,
        valorLiquido: accountsReceivable.valorLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
        emissaoData: accountsReceivable.emissaoData,
        documentoVinculadoNumero: accountsReceivable.documentoVinculadoNumero,
        formaCobranca: accountsReceivable.formaCobranca,
        cliente: accountsReceivable.cliente,
        parcela: accountsReceivable.parcela,
        parcelasQuantidadeTotal: accountsReceivable.parcelasQuantidadeTotal,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          or(
            sql`LOWER(${accountsReceivable.cliente}) LIKE ${`%${clientNameLower}%`}`,
            sql`LOWER(${accountsReceivable.clienteApelido}) LIKE ${`%${clientNameLower}%`}`
          )
        )
      )
      .orderBy(accountsReceivable.vencimentoData)
      .limit(50);

      // Calculate summary
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      let totalEmAberto = 0;
      let titulosVencidos = 0;
      let diasAtrasoMax = 0;

      const debtItems = debts.map(d => {
        const valor = Number(d.valorLiquido || d.valorOriginal || 0);
        totalEmAberto += valor;
        const venc = d.vencimentoData || "";
        let diasAtraso = 0;
        let vencido = false;
        if (venc && venc <= todayStr) {
          vencido = true;
          titulosVencidos++;
          const vencDate = new Date(venc);
          diasAtraso = Math.floor((today.getTime() - vencDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diasAtraso > diasAtrasoMax) diasAtrasoMax = diasAtraso;
        }
        return {
          id: d.id,
          valor,
          vencimento: venc,
          documento: d.documentoVinculadoNumero || "",
          formaCobranca: (d.formaCobranca || "").substring(0, 30),
          parcela: d.parcela,
          totalParcelas: d.parcelasQuantidadeTotal,
          vencido,
          diasAtraso,
        };
      });

      const totalCompras = uniquePurchases.reduce((sum, p) => sum + p.valor, 0);
      const ultimaCompra = uniquePurchases.length > 0 ? uniquePurchases[0].dataEmissao : null;

      return {
        purchases: uniquePurchases.slice(0, 20),
        debts: debtItems,
        summary: {
          totalCompras,
          totalPedidos: uniquePurchases.length,
          totalEmAberto,
          titulosVencidos,
          diasAtrasoMax,
          ultimaCompra,
        },
      };
    }),

  /** Delete an order (for testing purposes) */
  deleteOrder: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      // Delete related notifications (pedido_vendedor type with this orderId in metadata)
      const notifications = await db.select().from(systemNotifications)
        .where(eq(systemNotifications.type, "pedido_vendedor"));
      const relatedNotifIds = notifications
        .filter(n => {
          try {
            const meta = typeof n.metadata === "string" ? JSON.parse(n.metadata) : n.metadata;
            return meta?.orderId === input.orderId;
          } catch { return false; }
        })
        .map(n => n.id);
      if (relatedNotifIds.length > 0) {
        await db.delete(notificationReads).where(inArray(notificationReads.notificationId, relatedNotifIds));
        await db.delete(systemNotifications).where(inArray(systemNotifications.id, relatedNotifIds));
      }
      // Delete items first (foreign key)
      await db.delete(salesOrderRequestItems).where(eq(salesOrderRequestItems.orderId, input.orderId));
      // Delete the order
      await db.delete(salesOrderRequests).where(eq(salesOrderRequests.id, input.orderId));
      return { success: true };
    }),

  // ===== RESET ORDER NUMBERS (for testing) =====
  resetOrderNumbers: publicProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) return { success: false };
      // Delete all notifications related to orders
      const notifications = await db.select().from(systemNotifications)
        .where(eq(systemNotifications.type, "pedido_vendedor"));
      if (notifications.length > 0) {
        const notifIds = notifications.map(n => n.id);
        await db.delete(notificationReads).where(inArray(notificationReads.notificationId, notifIds));
        await db.delete(systemNotifications).where(inArray(systemNotifications.id, notifIds));
      }
      // Delete all order items and orders
      await db.delete(salesOrderRequestItems);
      await db.delete(salesOrderRequests);
      // Reset counter to 1
      await db.execute(sql`UPDATE order_number_counter SET next_number = 1 WHERE id = 1`);
      return { success: true, message: "Pedidos apagados e contador resetado para #1" };
    }),

  // ===== MARGIN CALCULATION =====

  /** Calculate profit margin for a closed order */
  calculateMargin: publicProcedure
    .input(z.object({
      orderId: z.number(),
      tipoProduto: z.enum(["importado", "industrializado"]).default("importado"),
      comissaoPercentual: z.number().min(0).max(100).default(0),
      freteValor: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // 1. Get order data
      const [order] = await db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.id, input.orderId));
      if (!order) throw new Error("Pedido não encontrado");

      const items = await db.select().from(salesOrderRequestItems)
        .where(eq(salesOrderRequestItems.orderId, input.orderId));

      const valorVenda = Number(order.totalPedido || 0);
      const ufDestino = (order.uf || "MG").toUpperCase();
      const tipoContribuinte = (order.tipoContribuinte || "Contribuinte") as TipoContribuinte;

      // 2. Get quarterly revenue for IRPJ calculation
      const now = new Date();
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const quarterStartStr = quarterStart.toISOString().split("T")[0];
      
      const [revenueRow] = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${salesOrders.valorTotalPedido} AS DECIMAL(15,2))), 0)`,
      }).from(salesOrders)
        .where(sql`${salesOrders.dataEmissao} >= ${quarterStartStr}`);
      
      const faturamentoTrimestral = Number(revenueRow?.total || 0);

      // 3. Get product costs from import PO data (custo projetado - orange column)
      // Use same logic as getRealTimeCosts: get costs by product code
      const productCodes = items.map(i => i.codigoItem).filter(Boolean) as string[];
      
      let custoMercadoriaTotal = 0;
      const itemCosts: Array<{ codigoItem: string; descricao: string; quantidade: number; custoUnitario: number; custoTotal: number; fonte: string }> = [];

      if (productCodes.length > 0) {
        // Get stock items to know fator (unidade de venda)
        const stockRows = await db.select({
          codigoItem: stockItems.codigoItem,
          unidadeDeVendaFator: stockItems.unidadeDeVendaFator,
          grupoCodigo: stockItems.grupoCodigo,
        }).from(stockItems).where(
          sql`${stockItems.codigoItem} IN (${sql.join(productCodes.map(c => sql`${c}`), sql`, `)})`
        );
        const stockMap = new Map(stockRows.map(s => [s.codigoItem, s]));

        // Get PO products with costs (prioritize patio > concluida)
        const poProducts = await db.select({
          productCode: importPoProducts.productCode,
          valorCaixaBrl: importPoProducts.valorCaixaBrl,
          precoMilUnid: importPoProducts.precoMilUnid,
          navigationStatus: importPos.navigationStatus,
        }).from(importPoProducts)
          .innerJoin(importPos, eq(importPoProducts.poId, importPos.id))
          .where(
            and(
              sql`${importPoProducts.productCode} IN (${sql.join(productCodes.map(c => sql`${c}`), sql`, `)})`,
              sql`${importPos.navigationStatus} IN ('concluida', 'recebida', 'chegou_patio')`,
              sql`(${importPoProducts.valorCaixaBrl} IS NOT NULL OR ${importPoProducts.precoMilUnid} IS NOT NULL)`,
            )
          );

        // Group by product code, prioritize patio (projetado) over concluida (real)
        const costByProduct: Record<string, { cost: number; fonte: string }> = {};
        for (const pp of poProducts) {
          const code = pp.productCode!;
          const cost = Number(pp.valorCaixaBrl || pp.precoMilUnid || 0);
          if (cost <= 0) continue;
          const isPatio = pp.navigationStatus === 'chegou_patio';
          // Prefer patio (projetado/orange) over concluida (real/green)
          if (!costByProduct[code] || isPatio) {
            costByProduct[code] = { cost, fonte: isPatio ? "Projetado" : "Real" };
          }
        }

        // Calculate cost for each order item
        for (const item of items) {
          const code = item.codigoItem;
          if (!code) continue;
          const qty = Number(item.quantidade || 0);
          const stockInfo = stockMap.get(code);
          const fator = Number(stockInfo?.unidadeDeVendaFator || 1);
          
          // Cost per unit (valorCaixaBrl is per box, divide by fator to get per unit)
          const costData = costByProduct[code];
          if (costData) {
            const custoUnitario = fator > 0 ? costData.cost / fator : costData.cost;
            const custoTotal = custoUnitario * qty;
            custoMercadoriaTotal += custoTotal;
            itemCosts.push({
              codigoItem: code,
              descricao: item.descricaoItem || code,
              quantidade: qty,
              custoUnitario,
              custoTotal,
              fonte: costData.fonte,
            });
          } else {
            itemCosts.push({
              codigoItem: code,
              descricao: item.descricaoItem || code,
              quantidade: qty,
              custoUnitario: 0,
              custoTotal: 0,
              fonte: "Sem custo",
            });
          }
        }
      }

      // 4. Calculate taxes
      const impostos = calcularImpostos({
        valorVenda: valorVenda,
        ufDestino,
        tipoProduto: input.tipoProduto as TipoProduto,
        tipoContribuinte,
        faturamentoTrimestral,
      });

      // 5. Calculate commission
      const comissaoValor = valorVenda * (input.comissaoPercentual / 100);

      // 6. Calculate margin
      const margem = calcularMargem({
        valorVenda,
        custoMercadoria: custoMercadoriaTotal,
        frete: input.freteValor,
        comissao: comissaoValor,
        impostos,
      });

      return {
        orderId: input.orderId,
        orderNumber: order.orderNumber,
        cliente: order.razaoSocial,
        uf: ufDestino,
        tipoContribuinte,
        tipoProduto: input.tipoProduto,
        valorVenda,
        faturamentoTrimestral,
        impostos,
        custoMercadoria: {
          total: custoMercadoriaTotal,
          items: itemCosts,
        },
        frete: input.freteValor,
        comissao: {
          percentual: input.comissaoPercentual,
          valor: comissaoValor,
        },
        margem,
      };
    }),

  // ===== BRASPRESS FREIGHT QUOTE =====

  /** Get available CNPJs for freight quotation */
  getFreightCnpjs: publicProcedure.query(() => {
    return BRASPRESS_CNPJS.map((c, i) => ({
      index: i,
      cnpj: c.cnpj,
      label: c.label,
    }));
  }),

  /** Quote freight via Braspress API */
  quoteBraspress: publicProcedure
    .input(z.object({
      cnpjIndex: z.number().min(0).max(2),
      cnpjDestinatario: z.string(),
      cepOrigem: z.string().default("32210130"), // CEP padrão Grupo Fox - Contagem/MG
      cepDestino: z.string(),
      valorMercadoria: z.number(),
      peso: z.number(),
      volumes: z.number().default(1),
      altura: z.number().default(0.5),
      largura: z.number().default(0.5),
      comprimento: z.number().default(0.5),
    }))
    .mutation(async ({ input }) => {
      return cotarBraspress(input);
    }),

  /** Quote freight via all 3 Braspress CNPJs simultaneously */
  quoteAllBraspress: publicProcedure
    .input(z.object({
      cnpjDestinatario: z.string(),
      cepOrigem: z.string().default("32210130"),
      cepDestino: z.string(),
      valorMercadoria: z.number(),
      peso: z.number(),
      volumes: z.number().default(1),
      altura: z.number().default(0.5),
      largura: z.number().default(0.5),
      comprimento: z.number().default(0.5),
    }))
    .mutation(async ({ input }) => {
      return cotarTodosCnpjs(input);
    }),

  /** Quote freight via Alfa Transportes (single CNPJ) */
  quoteAlfa: publicProcedure
    .input(z.object({
      cnpjIndex: z.number().min(0).max(1), // 0 = CNPJ 36562762000129, 1 = CNPJ 50128808000127
      cepOrigem: z.string().default("32210130"),
      cepDestino: z.string(),
      valorMercadoria: z.number(),
      peso: z.number(),
      metroCubico: z.number().default(0.05),
      volumes: z.number().default(1),
      cnpjDestinatario: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const keys = [process.env.ALFA_API_KEY_1, process.env.ALFA_API_KEY_2];
      const cnpjs = ["36562762000129", "50128808000127"];
      const apiKey = keys[input.cnpjIndex];
      if (!apiKey) throw new Error("Chave API Alfa não configurada para este CNPJ");

      const result = await quoteAlfaFreight({
        apiKey,
        cepDestino: input.cepDestino,
        cepOrigem: input.cepOrigem,
        valorMercadoria: input.valorMercadoria,
        peso: input.peso,
        metroCubico: input.metroCubico,
        volumes: input.volumes,
        cnpjDestinatario: input.cnpjDestinatario,
        tipoPessoa: 1,
      });

      return {
        cnpj: cnpjs[input.cnpjIndex],
        transportadora: "Alfa Transportes",
        totalFrete: result.cotacao?.emissao.valoresCotacao.valorTotal || 0,
        prazo: result.cotacao?.emissao.diasEntrega || "N/A",
        detalhes: result.cotacao?.emissao.valoresCotacao || null,
      };
    }),

  /** Quote freight via all Alfa Transportes CNPJs simultaneously */
  quoteAllAlfa: publicProcedure
    .input(z.object({
      cepOrigem: z.string().default("32210130"),
      cepDestino: z.string(),
      valorMercadoria: z.number(),
      peso: z.number(),
      metroCubico: z.number().default(0.05),
      volumes: z.number().default(1),
      cnpjDestinatario: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return quoteAllAlfaCnpjs({
        cepDestino: input.cepDestino,
        cepOrigem: input.cepOrigem,
        valorMercadoria: input.valorMercadoria,
        peso: input.peso,
        metroCubico: input.metroCubico,
        volumes: input.volumes,
        cnpjDestinatario: input.cnpjDestinatario,
      });
    }),

  /** Quote freight from ALL carriers (Braspress + Alfa) for comparison */
  quoteAllCarriers: publicProcedure
    .input(z.object({
      cnpjDestinatario: z.string().optional(),
      cepOrigem: z.string().default("32210130"),
      cepDestino: z.string(),
      valorMercadoria: z.number(),
      peso: z.number(),
      volumes: z.number().default(1),
      metroCubico: z.number().default(0.05),
      altura: z.number().default(0.5),
      largura: z.number().default(0.5),
      comprimento: z.number().default(0.5),
      tipoContribuinte: z.enum(["Contribuinte", "Não Contribuinte"]).default("Contribuinte"),
    }))
    .mutation(async ({ input }) => {
      // Quote from all 4 carriers in parallel: Braspress + Alfa + Camilo (SSW) + Rodonaves
      const [braspressResults, alfaResults, sswResults, rodonavesResults] = await Promise.allSettled([
        cotarTodosCnpjs({
          cnpjDestinatario: input.cnpjDestinatario || "00000000000000",
          cepOrigem: input.cepOrigem,
          cepDestino: input.cepDestino,
          valorMercadoria: input.valorMercadoria,
          peso: input.peso,
          volumes: input.volumes,
          altura: input.altura,
          largura: input.largura,
          comprimento: input.comprimento,
        }),
        quoteAllAlfaCnpjs({
          cepDestino: input.cepDestino,
          cepOrigem: input.cepOrigem,
          valorMercadoria: input.valorMercadoria,
          peso: input.peso,
          metroCubico: input.metroCubico,
          volumes: input.volumes,
          cnpjDestinatario: input.cnpjDestinatario,
        }),
        quoteAllSswCnpjs({
          cepOrigem: Number(input.cepOrigem.replace(/\D/g, "")),
          cepDestino: Number(input.cepDestino.replace(/\D/g, "")),
          valorNF: input.valorMercadoria,
          quantidade: input.volumes,
          peso: input.peso,
          volume: input.metroCubico,
          cnpjDestinatario: input.cnpjDestinatario,
          destContribuinte: input.tipoContribuinte === "Contribuinte" ? "S" : "N",
        }),
        quoteAllRodonavesCnpjs({
          cepOrigem: input.cepOrigem,
          cepDestino: input.cepDestino,
          valorMercadoria: input.valorMercadoria,
          peso: input.peso,
          volumes: input.volumes,
          cnpjDestinatario: input.cnpjDestinatario,
        }),
      ]);

      const carriers: Array<{
        transportadora: string;
        cnpj: string;
        totalFrete: number;
        prazo: string;
        error?: string;
      }> = [];

      // Process Braspress results
      if (braspressResults.status === "fulfilled") {
        for (const r of braspressResults.value) {
          carriers.push({
            transportadora: "Braspress",
            cnpj: r.cnpjUsado,
            totalFrete: r.totalFrete || 0,
            prazo: r.prazo ? `${r.prazo} dias úteis` : "N/A",
            error: r.error,
          });
        }
      } else {
        carriers.push({
          transportadora: "Braspress",
          cnpj: "",
          totalFrete: 0,
          prazo: "N/A",
          error: braspressResults.reason?.message || "Erro ao cotar Braspress",
        });
      }

      // Process Alfa results
      if (alfaResults.status === "fulfilled") {
        for (const r of alfaResults.value) {
          carriers.push({
            transportadora: "Alfa Transportes",
            cnpj: r.cnpj,
            totalFrete: r.totalFrete,
            prazo: r.prazo || "N/A",
            error: r.error,
          });
        }
      } else {
        carriers.push({
          transportadora: "Alfa Transportes",
          cnpj: "",
          totalFrete: 0,
          prazo: "N/A",
          error: alfaResults.reason?.message || "Erro ao cotar Alfa",
        });
      }

      // Process Camilo dos Santos (SSW) results
      if (sswResults.status === "fulfilled") {
        for (const r of sswResults.value) {
          carriers.push({
            transportadora: "Camilo dos Santos",
            cnpj: r.cnpj,
            totalFrete: r.totalFrete,
            prazo: r.prazo ? `${r.prazo} dias úteis` : "N/A",
            error: r.error,
          });
        }
      } else {
        carriers.push({
          transportadora: "Camilo dos Santos",
          cnpj: "",
          totalFrete: 0,
          prazo: "N/A",
          error: sswResults.reason?.message || "Erro ao cotar Camilo dos Santos",
        });
      }

      // Process Rodonaves results
      if (rodonavesResults.status === "fulfilled") {
        for (const r of rodonavesResults.value) {
          carriers.push({
            transportadora: "Rodonaves",
            cnpj: r.cnpj,
            totalFrete: r.totalFrete,
            prazo: r.prazo || "N/A",
            error: r.error,
          });
        }
      } else {
        carriers.push({
          transportadora: "Rodonaves",
          cnpj: "",
          totalFrete: 0,
          prazo: "N/A",
          error: rodonavesResults.reason?.message || "Erro ao cotar Rodonaves",
        });
      }

      // Sort by lowest freight (errors at the end)
      carriers.sort((a, b) => {
        if (a.error && !b.error) return 1;
        if (!a.error && b.error) return -1;
        return a.totalFrete - b.totalFrete;
      });

      return carriers;
    }),

  // ===== INLINE SALES COSTS CALCULATION (for order form, before order is saved) =====
  /** Calculate all sales costs inline - custo mercadoria, impostos, comissão, margem */
  calculateSalesCosts: publicProcedure
    .input(z.object({
      items: z.array(z.object({
        codigoItem: z.string(),
        quantidade: z.number(),
        precoUnitario: z.number(),
      })),
      ufDestino: z.string().default("MG"),
      tipoContribuinte: z.enum(["Contribuinte", "Não contribuinte", "Isento"]).default("Contribuinte"),
      tipoProduto: z.enum(["importado", "industrializado"]).default("importado"),
      comissaoPercentual: z.number().min(0).max(100).default(0),
      freteValor: z.number().min(0).default(0),
      gastosAdicionais: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Calculate total sale value
      const valorVenda = input.items.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0);

      // Get quarterly revenue for IRPJ
      const now = new Date();
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const quarterStartStr = quarterStart.toISOString().split("T")[0];
      const [revenueRow] = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${salesOrders.valorTotalPedido} AS DECIMAL(15,2))), 0)`,
      }).from(salesOrders)
        .where(sql`${salesOrders.dataEmissao} >= ${quarterStartStr}`);
      const faturamentoTrimestral = Number(revenueRow?.total || 0);

      // Get product costs from getRealTimeCosts (same logic as Importação tab)
      // This uses the correct weighted average / projected / estimated cost per box in BRL
      const { importRouter } = await import("./importRouter");
      const { createCallerFactory } = await import("./_core/trpc");
      const createCaller = createCallerFactory(importRouter);
      const importCaller = createCaller({ user: null, req: {} as any, res: {} as any });
      const realTimeCosts = await importCaller.getRealTimeCosts();

      // Build a map: codigoItem -> best cost (R$/caixa)
      // Priority: custoProjetado (includes patio) > custoReal > custoEstimativa
      const costMap = new Map<string, { cost: number; fonte: string; descricao: string }>();
      for (const item of realTimeCosts) {
        let cost = 0;
        let fonte = "Sem custo";
        if (item.custoProjetado > 0 && item.temPatio) {
          cost = item.custoProjetado;
          fonte = "Projetado";
        } else if (item.custoReal > 0) {
          cost = item.custoReal;
          fonte = "Real";
        } else if (item.custoEstimativa > 0 && item.temNavegando) {
          cost = item.custoEstimativa;
          fonte = "Estimativa";
        }
        if (cost > 0) {
          costMap.set(item.codigoItem, { cost, fonte, descricao: item.descricao });
        }
      }

      const productCodes = input.items.map(i => i.codigoItem).filter(Boolean);
      let custoMercadoriaTotal = 0;
      const itemCosts: Array<{ codigoItem: string; descricao: string; quantidade: number; custoUnitario: number; custoTotal: number; fonte: string }> = [];

      // Also get stock item descriptions for items not in costMap
      let stockDescMap = new Map<string, string>();
      if (productCodes.length > 0) {
        const stockRows = await db.select({
          codigoItem: stockItems.codigoItem,
          descricaoItem: stockItems.descricaoItem,
        }).from(stockItems).where(
          sql`${stockItems.codigoItem} IN (${sql.join(productCodes.map(c => sql`${c}`), sql`, `)})`
        );
        stockDescMap = new Map(stockRows.map(s => [s.codigoItem, s.descricaoItem]));
      }

      for (const item of input.items) {
        const code = item.codigoItem;
        if (!code) continue;
        const qty = item.quantidade; // quantity is already in BOXES
        const costData = costMap.get(code);
        const descricao = costData?.descricao || stockDescMap.get(code) || code;
        if (costData && costData.cost > 0) {
          // custoUnitario = cost per BOX in BRL (already correct from getRealTimeCosts)
          const custoUnitario = costData.cost;
          const custoTotal = custoUnitario * qty;
          custoMercadoriaTotal += custoTotal;
          itemCosts.push({ codigoItem: code, descricao, quantidade: qty, custoUnitario, custoTotal, fonte: costData.fonte });
        } else {
          itemCosts.push({ codigoItem: code, descricao, quantidade: qty, custoUnitario: 0, custoTotal: 0, fonte: "Sem custo" });
        }
      }

      // Calculate taxes
      const impostos = calcularImpostos({
        valorVenda,
        ufDestino: input.ufDestino,
        tipoProduto: input.tipoProduto as TipoProduto,
        tipoContribuinte: input.tipoContribuinte as TipoContribuinte,
        faturamentoTrimestral,
      });

      // Calculate commission
      const comissaoValor = valorVenda * (input.comissaoPercentual / 100);

      // Calculate margin (including gastos adicionais)
      const totalCustos = custoMercadoriaTotal + input.freteValor + comissaoValor + impostos.totalImpostosValor + input.gastosAdicionais;
      const lucroLiquido = valorVenda - totalCustos;
      const margemPercentual = valorVenda > 0 ? (lucroLiquido / valorVenda) * 100 : 0;

      return {
        valorVenda,
        faturamentoTrimestral,
        impostos,
        custoMercadoria: {
          total: custoMercadoriaTotal,
          items: itemCosts,
        },
        frete: input.freteValor,
        comissao: {
          percentual: input.comissaoPercentual,
          valor: comissaoValor,
        },
        gastosAdicionais: input.gastosAdicionais,
        margem: {
          valorVenda,
          custoMercadoria: custoMercadoriaTotal,
          frete: input.freteValor,
          comissao: comissaoValor,
          totalImpostos: impostos.totalImpostosValor,
          gastosAdicionais: input.gastosAdicionais,
          lucroLiquido,
          margemPercentual,
        },
      };
    }),
});
