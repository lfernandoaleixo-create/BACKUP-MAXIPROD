import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { salesOrderRequests, salesOrderRequestItems, productMinPrices, sellerPermissions, stockItems, sellerProductVisibility, purchaseOrderItems, salesOrders, cobrancaPlanilha, vendorClients, accountsReceivable } from "../drizzle/schema";
import { sql, and, eq, desc, like, or, inArray } from "drizzle-orm";

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
        cnpjCpf: string; razaoSocial: string; nomeFantasia: string;
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
          cnpjCpf: vc.cnpjCpf || "",
          razaoSocial: vc.razaoSocial || "",
          nomeFantasia: vc.nomeFantasia || "",
          inscricaoEstadual: vc.inscricaoEstadual || "",
          tipoContribuinte: "Contribuinte",
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
      const results: typeof fromManualOrders = [];

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

      return filteredItems.map(item => ({
        codigoItem: item.codigoItem,
        descricaoItem: item.descricaoItem,
        disponivel: item.quantidade,
        unidadeMedida: item.unidadeMedida,
        unidadeDeVendaFator: item.unidadeDeVendaFator,
        precoMinimo: priceMap.get(item.codigoItem) || null,
        grupo: item.descricaoGrupo || item.codigoGrupo || "",
        pesoLiquido: item.pesoLiquido,
        pesoBruto: item.pesoBruto,
        codigoBarras: item.codigoBarras,
        descricaoComplementar: item.descricaoComplementar,
        procedencia: item.procedencia,
        estado: item.estado,
        unidadeDeVendaCodigo: item.unidadeDeVendaCodigo,
        pendingPOs: poMap.get(item.codigoItem) || [],
      }));
    }),

  // ===== CREATE ORDER =====

  /** Create a new sales order request */
  createOrder: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      // Client data
      cnpjCpf: z.string().min(11),
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

      // Insert order
      const [result] = await db.insert(salesOrderRequests).values({
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

      return {
        success: true,
        orderId: Number(orderId),
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
});
