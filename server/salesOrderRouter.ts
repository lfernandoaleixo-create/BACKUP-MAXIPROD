import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { salesOrderRequests, salesOrderRequestItems, productMinPrices, sellerPermissions, stockItems, sellerProductVisibility, purchaseOrderItems, salesOrders, cobrancaPlanilha, vendorClients, accountsReceivable, priceTables, priceTableItems, appSettings, systemNotifications, notificationReads, importPos, importPoProducts, commissionMatrix, operators, orderApprovalHistory, productVariants, orderTimelineRules, freightSimulations } from "../drizzle/schema";
import { parseDimensions } from "../shared/parseDimensions";
import { sql, and, eq, desc, like, or, inArray, isNull, gte } from "drizzle-orm";
import { calcularImpostos, calcularMargem, type TipoProduto, type TipoContribuinte } from "./taxCalculation";
import { cotarBraspress, cotarTodosCnpjs, BRASPRESS_CNPJS } from "./braspressApi";
import { quoteAlfaFreight, quoteAllAlfaCnpjs } from "./alfaApi";
import { quoteAllSswCnpjsWithProtocol } from "./sswApi";
import { quoteAllRodonavesCnpjs, RODONAVES_CNPJS } from "./rodonavesApi";
import { quoteFlordeMinas } from "./florDeminasApi";
import { consultaCnpjCompleta } from "./sintegraApi";

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
/**
 * Normalizes tipoContribuinte from any format (Maxiprod: CONTRIBUINTE, NAO_CONTRIBUINTE)
 * to the format expected by taxCalculation: "Contribuinte" | "Não contribuinte" | "Isento" | null
 */
function normalizeTipoContribuinte(value: string | null | undefined): TipoContribuinte {
  if (!value) return "Contribuinte";
  const upper = value.toUpperCase().trim();
  if (upper === "ISENTO" || upper === "ISENTA") return "Isento";
  if (upper.includes("NAO") || upper.includes("NÃO") || upper === "NAO_CONTRIBUINTE" || upper === "N\u00C3O CONTRIBUINTE") return "Não contribuinte";
  // Default: any variant of "contribuinte" or unknown → Contribuinte
  return "Contribuinte";
}

export const salesOrderRouter = router({

  // ===== CONSULTA CNPJ (SintegraWS) =====

  /** Consulta CNPJ na Receita Federal + Sintegra para preencher cadastro de cliente */
  consultaCnpj: publicProcedure
    .input(z.object({ cnpj: z.string().min(11) }))
    .query(async ({ input }) => {
      return consultaCnpjCompleta(input.cnpj);
    }),

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
        nomeContato: string; formaCobranca: string; condicaoPagamento: string;
        fornecedorAtual: string; observacoes: string;
        // Dados Fiscais extras
        inscricaoMunicipal: string; inscricaoSuframa: string; situacaoFiscalEspecial: string;
        website: string;
        // Dados de Venda
        limiteCredito: string; tabelaPrecos: string;
        // CRM
        regiao: string; perfil: string; formaPedido: string; produtos: string;
        probabilidadeNegocio: string; tamanho: string; atencao: string;
        // Cobrança
        situacaoCobranca: string;
        possuiRedespacho: boolean; redespachoCnpj: string; redespachoRazaoSocial: string;
        redespachoCep: string; redespachoLogradouro: string; redespachoNumero: string;
        redespachoComplemento: string; redespachoBairro: string; redespachoCidade: string;
        redespachoUf: string; redespachoTelefone: string;
        enderecoEntregaMesmo: boolean; entregaCep: string; entregaLogradouro: string;
        entregaNumero: string; entregaComplemento: string; entregaBairro: string;
        entregaCidade: string; entregaUf: string; entregaTelefone: string;
      }> = [];
      try {
        const qL = q.toLowerCase();
        // Search ALL vendor_clients (no sellerId filter) so CNPJ/data is found regardless of seller assignment
        const vcRows = await db.select()
          .from(vendorClients)
          .where(
            or(
              sql`LOWER(${vendorClients.razaoSocial}) LIKE ${`%${qL}%`}`,
              sql`LOWER(${vendorClients.nomeFantasia}) LIKE ${`%${qL}%`}`,
              like(vendorClients.cnpjCpf, `%${q}%`)
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
          regimeTributario: vc.regimeTributario || "Normal",
          emailNfe: vc.emailNfe || "",
          cnaeFiscal: vc.cnaeFiscal || "",
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
          nomeContato: vc.nomeContato || "",
          formaCobranca: vc.formaCobranca || "",
          condicaoPagamento: vc.condicaoPagamento || "",
          fornecedorAtual: vc.fornecedorAtual || "",
          observacoes: vc.observacoes || "",
          // Dados Fiscais extras
          inscricaoMunicipal: vc.inscricaoMunicipal || "",
          inscricaoSuframa: vc.inscricaoSuframa || "",
          situacaoFiscalEspecial: vc.situacaoFiscalEspecial || "Nenhuma",
          website: vc.website || "",
          // Dados de Venda
          limiteCredito: vc.limiteCredito || "",
          tabelaPrecos: vc.tabelaPrecos || "",
          // CRM
          regiao: vc.regiao || "",
          perfil: vc.perfil || "",
          formaPedido: vc.formaPedido || "",
          produtos: vc.produtos || "",
          probabilidadeNegocio: vc.probabilidadeNegocio || "",
          tamanho: vc.tamanho || "",
          atencao: vc.atencao || "Normal",
          // Cobrança
          situacaoCobranca: vc.situacaoCobranca || "SEM PROTESTO",
          possuiRedespacho: vc.possuiRedespacho === 1,
          redespachoCnpj: vc.redespachoCnpj || "",
          redespachoRazaoSocial: vc.redespachoRazaoSocial || "",
          redespachoCep: vc.redespachoCep || "",
          redespachoLogradouro: vc.redespachoLogradouro || "",
          redespachoNumero: vc.redespachoNumero || "",
          redespachoComplemento: vc.redespachoComplemento || "",
          redespachoBairro: vc.redespachoBairro || "",
          redespachoCidade: vc.redespachoCidade || "",
          redespachoUf: vc.redespachoUf || "",
          redespachoTelefone: vc.redespachoTelefone || "",
          enderecoEntregaMesmo: vc.enderecoEntregaMesmo === 1,
          entregaCep: vc.entregaCep || "",
          entregaLogradouro: vc.entregaLogradouro || "",
          entregaNumero: vc.entregaNumero || "",
          entregaComplemento: vc.entregaComplemento || "",
          entregaBairro: vc.entregaBairro || "",
          entregaCidade: vc.entregaCidade || "",
          entregaUf: vc.entregaUf || "",
          entregaTelefone: vc.entregaTelefone || "",
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
        nomeContato: salesOrderRequests.nomeContato,
        formaCobranca: salesOrderRequests.formaCobranca,
        condicaoPagamento: salesOrderRequests.condicaoPagamento,
        fornecedorAtual: salesOrderRequests.fornecedorAtual,
        observacoes: salesOrderRequests.observacoes,
        inscricaoMunicipal: salesOrderRequests.inscricaoMunicipal,
        inscricaoSuframa: salesOrderRequests.inscricaoSuframa,
        situacaoFiscalEspecial: salesOrderRequests.situacaoFiscalEspecial,
        website: salesOrderRequests.website,
        limiteCredito: salesOrderRequests.limiteCredito,
        tabelaPrecos: salesOrderRequests.tabelaPrecos,
        regiao: salesOrderRequests.regiao,
        perfil: salesOrderRequests.perfil,
        formaPedido: salesOrderRequests.formaPedido,
        produtos: salesOrderRequests.produtos,
        probabilidadeNegocio: salesOrderRequests.probabilidadeNegocio,
        tamanho: salesOrderRequests.tamanho,
        atencao: salesOrderRequests.atencao,
        situacaoCobranca: salesOrderRequests.situacaoCobranca,
        possuiRedespacho: salesOrderRequests.possuiRedespacho,
        redespachoCnpj: salesOrderRequests.redespachoCnpj,
        redespachoRazaoSocial: salesOrderRequests.redespachoRazaoSocial,
        redespachoCep: salesOrderRequests.redespachoCep,
        redespachoLogradouro: salesOrderRequests.redespachoLogradouro,
        redespachoNumero: salesOrderRequests.redespachoNumero,
        redespachoComplemento: salesOrderRequests.redespachoComplemento,
        redespachoBairro: salesOrderRequests.redespachoBairro,
        redespachoCidade: salesOrderRequests.redespachoCidade,
        redespachoUf: salesOrderRequests.redespachoUf,
        redespachoTelefone: salesOrderRequests.redespachoTelefone,
        enderecoEntregaMesmo: salesOrderRequests.enderecoEntregaMesmo,
        entregaCep: salesOrderRequests.entregaCep,
        entregaLogradouro: salesOrderRequests.entregaLogradouro,
        entregaNumero: salesOrderRequests.entregaNumero,
        entregaComplemento: salesOrderRequests.entregaComplemento,
        entregaBairro: salesOrderRequests.entregaBairro,
        entregaCidade: salesOrderRequests.entregaCidade,
        entregaUf: salesOrderRequests.entregaUf,
        entregaTelefone: salesOrderRequests.entregaTelefone,
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
    .input(z.object({ sellerId: z.number(), gestorMode: z.boolean().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // In gestorMode, skip seller visibility filtering - gestor sees ALL products
      const isGestorMode = input.gestorMode === true;

      // Get seller's visible product codes (manual overrides)
      const visibleProducts = await db.select()
        .from(sellerProductVisibility)
        .where(eq(sellerProductVisibility.sellerId, input.sellerId));
      const manualVisibleCodes = new Set(visibleProducts.map(p => p.productCode));

      // Also get products from seller's price table (same logic as getSellerProducts)
      const sellerRow = await db.select().from(sellerPermissions)
        .where(eq(sellerPermissions.id, input.sellerId)).limit(1);
      const priceTableCodes = new Set<string>();
      if (sellerRow.length > 0) {
        const allTablesForFilter = await db.select().from(priceTables);
        let matchedTableForFilter: typeof allTablesForFilter[0] | undefined;
        if (sellerRow[0].priceTableCode) {
          matchedTableForFilter = allTablesForFilter.find(t => t.codigo === sellerRow[0].priceTableCode);
        }
        if (!matchedTableForFilter) {
          const nameParts = sellerRow[0].sellerName.toUpperCase().split(' ');
          matchedTableForFilter = allTablesForFilter.find(t => {
            const desc = t.descricao.toUpperCase();
            return nameParts.some(part => part.length > 3 && desc.includes(part));
          });
        }
        if (matchedTableForFilter) {
          const ptItemsForFilter = await db.select({ itemCodigo: priceTableItems.itemCodigo })
            .from(priceTableItems)
            .where(eq(priceTableItems.priceTableId, matchedTableForFilter.id));
          for (const pti of ptItemsForFilter) {
            priceTableCodes.add(pti.itemCodigo);
          }
        }
      }

      // Combine manual + price table codes for visibility
      const visibleCodes = new Set([...Array.from(manualVisibleCodes), ...Array.from(priceTableCodes)]);

      // Auto-include child variants of visible parent products
      const allVariants = await db.select({
        parentCode: productVariants.parentCode,
        childCode: productVariants.childCode,
      }).from(productVariants);
      for (const v of allVariants) {
        if (visibleCodes.has(v.parentCode)) {
          visibleCodes.add(v.childCode);
        }
      }

      // Get stock items (include all items from price table, even with 0 stock)
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
      .from(stockItems);

      // All products in stock_items are available to all sellers
      // The price table is used for pricing only, not for restricting visibility
      const filteredItems = items;

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
        // Preço Mostrado = Preço direto da tabela (sem margem)
        const precoVendedor = precoTabela;
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
      razaoSocial: z.string().optional().default(""),
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
      // Redespacho
      possuiRedespacho: z.boolean().optional(),
      redespachoCnpj: z.string().optional(),
      redespachoRazaoSocial: z.string().optional(),
      redespachoCep: z.string().optional(),
      redespachoLogradouro: z.string().optional(),
      redespachoNumero: z.string().optional(),
      redespachoComplemento: z.string().optional(),
      redespachoBairro: z.string().optional(),
      redespachoCidade: z.string().optional(),
      redespachoUf: z.string().optional(),
      redespachoTelefone: z.string().optional(),
      // Endereço de entrega
      enderecoEntregaMesmo: z.boolean().optional(),
      entregaCep: z.string().optional(),
      entregaLogradouro: z.string().optional(),
      entregaNumero: z.string().optional(),
      entregaComplemento: z.string().optional(),
      entregaBairro: z.string().optional(),
      entregaCidade: z.string().optional(),
      entregaUf: z.string().optional(),
      entregaTelefone: z.string().optional(),
      // Sale data
      segmento: z.string().optional(),
      nomeContato: z.string().optional(),
      formaCobranca: z.string().optional(),
      fornecedorAtual: z.string().optional(),
      // Dados Fiscais extras
      inscricaoMunicipal: z.string().optional(),
      inscricaoSuframa: z.string().optional(),
      situacaoFiscalEspecial: z.string().optional(),
      website: z.string().optional(),
      // Dados de Venda
      limiteCredito: z.string().optional(),
      tabelaPrecos: z.string().optional(),
      condicaoPagamento: z.string().optional(),
      // CRM / Relacionamento
      regiao: z.string().optional(),
      perfil: z.string().optional(),
      formaPedido: z.string().optional(),
      produtos: z.string().optional(),
      probabilidadeNegocio: z.string().optional(),
      tamanho: z.string().optional(),
      atencao: z.string().optional(),
      // Cobrança
      situacaoCobranca: z.string().optional(),
      valorFrete: z.number().optional(),
      tipoFrete: z.string().optional(),
      observacoes: z.string().optional(),
      observacoesInternas: z.string().optional(),
      transportadora: z.string().optional(),
      protocoloCotacao: z.string().optional(),
      trackingUrl: z.string().optional(),
      // Campos Maxiprod
      operacaoFiscal: z.string().optional(),
      naturezaOperacao: z.string().optional(),
      estadoConfiguravel: z.string().optional(),
      formaPagamento: z.string().optional(),
      meioPagamento: z.string().optional(), // Boleto, Dinheiro, Cartão, PIX, Cheque, Depósito (obrigatório no frontend, visível no Manus, NÃO exportado para Maxiprod)
      dataEntrega: z.string().optional(),
      previsaoEntrega: z.string().optional(),
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
      // Flag: pedido é simulação (sem dados reais de cliente)
      isSimulation: z.boolean().optional(),
      // Comissão
      comissaoFonte: z.string().optional(),
      comissaoPercentual: z.number().optional(),
      comissaoTier: z.string().optional(),
      margemPercentual: z.number().optional(),
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
      const totalPedido = totalProdutos; // Frete NÃO é somado ao valor do pedido

      // Determine status - ALL real orders start as 'pendente' and require gestor approval
      // Exception: if the seller IS the gestor (e.g. Jordão), auto-approve and go directly to Vitória
      const isSellerGestor = seller.sellerName.toUpperCase().trim() === (seller.gestorName || "").toUpperCase().trim();
      const status = input.isSimulation ? "simulacao" as const : (isSellerGestor ? "aprovado" as const : "pendente" as const);
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
        nomeContato: input.nomeContato || null,
        formaCobranca: input.formaCobranca || null,
        fornecedorAtual: input.fornecedorAtual || null,
        inscricaoMunicipal: input.inscricaoMunicipal || null,
        inscricaoSuframa: input.inscricaoSuframa || null,
        situacaoFiscalEspecial: input.situacaoFiscalEspecial || null,
        website: input.website || null,
        limiteCredito: input.limiteCredito || null,
        tabelaPrecos: input.tabelaPrecos || null,
        condicaoPagamento: input.condicaoPagamento || null,
        regiao: input.regiao || null,
        perfil: input.perfil || null,
        formaPedido: input.formaPedido || null,
        produtos: input.produtos || null,
        probabilidadeNegocio: input.probabilidadeNegocio || null,
        tamanho: input.tamanho || null,
        atencao: input.atencao || null,
        situacaoCobranca: input.situacaoCobranca || null,
        valorFrete: valorFrete.toFixed(2),
        tipoFrete: input.tipoFrete || null,
        observacoes: input.observacoes || null,
        observacoesInternas: input.observacoesInternas || null,
        transportadora: input.transportadora || null,
        protocoloCotacao: input.protocoloCotacao || null,
        trackingUrl: input.trackingUrl || null,
        operacaoFiscal: input.operacaoFiscal || null,
        naturezaOperacao: input.naturezaOperacao || null,
        estadoConfiguravel: input.estadoConfiguravel || null,
        formaPagamento: input.formaPagamento || null,
        meioPagamento: input.meioPagamento || null,
        dataEntrega: input.dataEntrega || null,
        previsaoEntrega: input.previsaoEntrega || null,
        possuiRedespacho: input.possuiRedespacho || false,
        redespachoCnpj: input.redespachoCnpj || null,
        redespachoRazaoSocial: input.redespachoRazaoSocial || null,
        redespachoCep: input.redespachoCep || null,
        redespachoLogradouro: input.redespachoLogradouro || null,
        redespachoNumero: input.redespachoNumero || null,
        redespachoComplemento: input.redespachoComplemento || null,
        redespachoBairro: input.redespachoBairro || null,
        redespachoCidade: input.redespachoCidade || null,
        redespachoUf: input.redespachoUf || null,
        redespachoTelefone: input.redespachoTelefone || null,
        enderecoEntregaMesmo: input.enderecoEntregaMesmo !== false,
        entregaCep: input.entregaCep || null,
        entregaLogradouro: input.entregaLogradouro || null,
        entregaNumero: input.entregaNumero || null,
        entregaComplemento: input.entregaComplemento || null,
        entregaBairro: input.entregaBairro || null,
        entregaCidade: input.entregaCidade || null,
        entregaUf: input.entregaUf || null,
        entregaTelefone: input.entregaTelefone || null,
        totalProdutos: totalProdutos.toFixed(2),
        totalPedido: totalPedido.toFixed(2),
        temPrecoAbaixoMinimo,
        motivoAlerta,
        comissaoFonte: input.comissaoFonte || null,
        comissaoPercentual: input.comissaoPercentual?.toFixed(2) || null,
        comissaoTier: input.comissaoTier || null,
        margemPercentual: input.margemPercentual?.toFixed(2) || null,
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
            unidadeMedida: item.unidadeMedida || "CX", // Grupo Fox: default sempre caixa
            precoUnitario: item.precoUnitario.toFixed(5),
            precoMinimo: item.precoMinimo !== null ? item.precoMinimo.toFixed(2) : null,
            totalItem: item.totalItem.toFixed(2),
            abaixoDoMinimo: item.abaixoDoMinimo,
          }))
        );
      }

      // Upsert client into vendor_clients for Maxiprod export (skip for simulations without client data)
      if (!input.isSimulation && input.cnpjCpf && input.cnpjCpf.trim()) {
        try {
          const cnpjLimpo = input.cnpjCpf.replace(/[^\d]/g, "");
          if (cnpjLimpo.length >= 11) {
            const [existingClient] = await db.select({ id: vendorClients.id }).from(vendorClients)
              .where(sql`REPLACE(REPLACE(REPLACE(${vendorClients.cnpjCpf}, '.', ''), '-', ''), '/', '') = ${cnpjLimpo}`)
              .limit(1);
            if (!existingClient) {
              // Create new vendor_client from order data
              await db.insert(vendorClients).values({
                sellerId: input.sellerId,
                sellerName: seller.sellerName,
                cnpjCpf: input.cnpjCpf,
                razaoSocial: input.razaoSocial || "CLIENTE SEM NOME",
                nomeFantasia: input.nomeFantasia || null,
                inscricaoEstadual: input.inscricaoEstadual || null,
                tipoContribuinte: input.tipoContribuinte || null,
                regimeTributario: input.regimeTributario || null,
                emailNfe: input.emailNfe || null,
                cep: input.cep || null,
                logradouro: input.endereco || null,
                numero: input.numero || null,
                complemento: input.complemento || null,
                bairro: input.bairro || null,
                cidade: input.municipio || null,
                uf: input.uf || null,
                telefone1: input.telefone1 || null,
                telefone2: input.telefone2 || null,
                email: input.emailContato || null,
                segmento: input.segmento || null,
                cnaeFiscal: input.cnaeFiscal || null,
              });
            } else {
              // Update existing vendor_client with latest data from order
              await db.update(vendorClients)
                .set({
                  razaoSocial: input.razaoSocial || undefined,
                  nomeFantasia: input.nomeFantasia || undefined,
                  inscricaoEstadual: input.inscricaoEstadual || undefined,
                  tipoContribuinte: input.tipoContribuinte || undefined,
                  regimeTributario: input.regimeTributario || undefined,
                  emailNfe: input.emailNfe || undefined,
                  cep: input.cep || undefined,
                  logradouro: input.endereco || undefined,
                  numero: input.numero || undefined,
                  complemento: input.complemento || undefined,
                  bairro: input.bairro || undefined,
                  cidade: input.municipio || undefined,
                  uf: input.uf || undefined,
                  telefone1: input.telefone1 || undefined,
                  telefone2: input.telefone2 || undefined,
                  email: input.emailContato || undefined,
                  segmento: input.segmento || undefined,
                  lastModifiedBy: seller.sellerName,
                  updatedAt: new Date(),
                })
                .where(eq(vendorClients.id, existingClient.id));
            }
          }
        } catch (err) {
          console.error("[SalesOrder] Failed to upsert vendor_client:", err);
        }
      }

      // Send notification to Vitória, Juvenal and Guilherme about new seller order (skip for simulations)
      if (!input.isSimulation) {
        try {
          const { createNotification } = await import("./notificationRouter");
          const totalCaixas = itemsWithValidation.reduce((sum, i) => sum + i.quantidade, 0);
          const itemsResume = itemsWithValidation.map(i => `${i.descricaoItem} (${i.quantidade}cx × R$ ${i.precoUnitario.toFixed(2)} = R$ ${i.totalItem.toFixed(2)})`).join(" | ");
          // Build detailed client info
          const clientInfo = [
            `Razão Social: ${input.razaoSocial}`,
            input.nomeFantasia ? `Nome Fantasia: ${input.nomeFantasia}` : null,
            `CNPJ/CPF: ${input.cnpjCpf}`,
            input.inscricaoEstadual ? `IE: ${input.inscricaoEstadual}` : null,
            input.tipoContribuinte ? `Contribuinte: ${input.tipoContribuinte}` : null,
            input.regimeTributario ? `Regime: ${input.regimeTributario}` : null,
            input.telefone1 ? `Tel: ${input.telefone1}${input.telefone2 ? ' / ' + input.telefone2 : ''}` : null,
            input.emailContato ? `Email: ${input.emailContato}` : null,
            input.emailNfe ? `Email NFe: ${input.emailNfe}` : null,
            input.nomeContato ? `Contato: ${input.nomeContato}` : null,
            input.segmento ? `Segmento: ${input.segmento}` : null,
            (input.endereco || input.cep) ? `Endereço: ${input.endereco || ''}${input.numero ? ', ' + input.numero : ''}${input.complemento ? ' - ' + input.complemento : ''} - ${input.bairro || ''} - ${input.municipio || ''}/${input.uf || ''} CEP: ${input.cep || ''}` : null,
            input.formaCobranca ? `Forma Cobrança: ${input.formaCobranca}` : null,
            input.limiteCredito ? `Limite Crédito: R$ ${input.limiteCredito}` : null,
            input.situacaoCobranca ? `Situação: ${input.situacaoCobranca}` : null,
          ].filter(Boolean).join(' \n ');
          // Build detailed order info
          const orderInfo = [
            `Pedido #${orderNumber}`,
            `Vendedor: ${seller.sellerName} (Gestor: ${seller.gestorName})`,
            `Forma Pagamento: ${input.formaPagamento || 'N/A'} | Meio: ${input.meioPagamento || 'N/A'}`,
            input.condicaoPagamento ? `Condição: ${input.condicaoPagamento}` : null,
            input.tipoFrete ? `Frete: ${input.tipoFrete}${valorFrete > 0 ? ' - R$ ' + valorFrete.toFixed(2) : ''}${input.transportadora ? ' (' + input.transportadora + ')' : ''}` : (valorFrete > 0 ? `Frete: R$ ${valorFrete.toFixed(2)}${input.transportadora ? ' (' + input.transportadora + ')' : ''}` : (input.transportadora ? `Transportadora: ${input.transportadora}` : null)),
            input.dataEntrega ? `Data Entrega: ${input.dataEntrega}` : null,
            input.observacoes ? `Obs: ${input.observacoes}` : null,
            `--- ITENS (${itemsWithValidation.length}) ---`,
            ...itemsWithValidation.map((i, idx) => `${idx+1}. ${i.descricaoItem} | ${i.quantidade}cx × R$ ${i.precoUnitario.toFixed(2)} = R$ ${i.totalItem.toFixed(2)}${i.precoMinimo !== null && i.precoUnitario < i.precoMinimo ? ' ⚠️ ABAIXO MÍN' : ''}`),
            `--- TOTAL: R$ ${totalPedido.toFixed(2)} (${totalCaixas} caixas) ---`,
            temPrecoAbaixoMinimo ? '⚠️ ATENÇÃO: PREÇO ABAIXO DO MÍNIMO' : null,
          ].filter(Boolean).join(' \n ');
          const fullMessage = `📌 CADASTRO DO CLIENTE:\n${clientInfo}\n\n📦 PEDIDO:\n${orderInfo}`;
          await createNotification({
            type: "pedido_vendedor",
            title: `Novo Pedido #${orderNumber} - ${seller.sellerName}`,
            message: fullMessage,
            severity: temPrecoAbaixoMinimo ? "warning" : "success",
            metadata: { orderId: Number(orderId), sellerName: seller.sellerName, gestorName: seller.gestorName, clientName: input.razaoSocial, totalPedido, totalCaixas, status, orderNumber },
          });
        } catch (err) {
          console.error("[SalesOrder] Failed to create notification:", err);
        }
      }

      // === LINHA DO TEMPO: Evaluate timeline rules and route order ===
      // Now supports sequential approval positions:
      // - Position 1 recipients receive the order immediately
      // - Position 2+ recipients only receive after ALL position (N-1) recipients with actionType='autorizar' have approved
      // - 'apos_aprovacao_gestores' condition: recipient only receives after ALL gestores (any position) have approved
      let timelineRecipients: Array<{ recipientId: number; recipientName: string; actionType: string; approvalPosition: number }> = [];
      if (!input.isSimulation) {
        try {
          // Match by sellerName using LIKE because timeline rules may store short operator names
          // (e.g. 'Juvenal') while seller_permissions stores full names (e.g. 'JUVENAL TEIXEIRA')
          const sellerFirstName = seller.sellerName.split(' ')[0].toUpperCase();
          const timelineRules = await db.select().from(orderTimelineRules)
            .where(and(
              sql`UPPER(${orderTimelineRules.sellerName}) LIKE ${`%${sellerFirstName}%`}`,
              eq(orderTimelineRules.active, true)
            ));
          if (timelineRules.length > 0) {
            // Calculate order metrics for condition evaluation
            const descontoProdutoMax = itemsWithValidation.reduce((max, item) => {
              if (item.precoMinimo !== null && item.precoMinimo > 0) {
                const desconto = ((item.precoMinimo - item.precoUnitario) / item.precoMinimo) * 100;
                return Math.max(max, desconto);
              }
              return max;
            }, 0);
            // Group rules by recipient
            const byRecipient = new Map<number, typeof timelineRules>();
            for (const rule of timelineRules) {
              const existing = byRecipient.get(rule.recipientId) || [];
              existing.push(rule);
              byRecipient.set(rule.recipientId, existing);
            }
            for (const [recipientId, recipientRules] of Array.from(byRecipient.entries())) {
              let matched = false;
              let actionType = "visualizar";
              const approvalPosition = recipientRules[0].approvalPosition;
              for (const rule of recipientRules) {
                const val = rule.conditionValue ? parseFloat(String(rule.conditionValue)) : null;
                let ruleMatches = false;
                switch (rule.conditionType) {
                  case "sempre": ruleMatches = true; break;
                  case "apos_aprovacao_gestores": ruleMatches = true; break; // Always matches, but position controls when they see it
                  case "desconto_produto_acima": ruleMatches = val !== null && descontoProdutoMax > val; break;
                  case "desconto_produto_abaixo": ruleMatches = val !== null && descontoProdutoMax < val; break;
                  case "margem_pedido_acima": case "margem_pedido_abaixo":
                  case "margem_mensal_acima": case "margem_mensal_abaixo":
                  case "media_ponderada_descontos_acima": case "media_ponderada_descontos_abaixo":
                    ruleMatches = true;
                    break;
                }
                if (ruleMatches) {
                  matched = true;
                  if (rule.actionType === "autorizar") actionType = "autorizar";
                }
              }
              if (matched) {
                timelineRecipients.push({
                  recipientId,
                  recipientName: recipientRules[0].recipientName,
                  actionType,
                  approvalPosition,
                });
              }
            }
            // Sort by position for clarity
            timelineRecipients.sort((a, b) => a.approvalPosition - b.approvalPosition);
          }
        } catch (err) {
          console.error("[SalesOrder] Timeline evaluation failed:", err);
        }
      }

      return {
        success: true,
        orderId: Number(orderId),
        orderNumber,
        status,
        temPrecoAbaixoMinimo,
        motivoAlerta,
        timelineRecipients,
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
      status: z.enum(["pendente", "aprovado", "aprovado_subgestor", "rejeitado", "processado", "todos"]).optional(),
      sellerId: z.number().optional(),
      gestorName: z.string().optional(),
      comissaoTravada: z.boolean().optional(), // Filter for orders with commission locked at 4%
      recipientName: z.string().optional(), // Filter by recipient name for position-based visibility
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
      if (input?.gestorName) {
        conditions.push(eq(salesOrderRequests.gestorName, input.gestorName));
      }
      if (input?.comissaoTravada) {
        conditions.push(eq(salesOrderRequests.comissaoFonte, "critico_liberado"));
      }

      let orders = await db.select().from(salesOrderRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(salesOrderRequests.createdAt))
        .limit(200);

      // === POSITION-BASED FILTERING ===
      // If recipientName is provided, filter orders to only show those where
      // the current approval position matches this recipient's position in the timeline rules
      if (input?.recipientName) {
        const recipientNameUpper = input.recipientName.toUpperCase();
        // Get all timeline rules for this recipient
        const recipientRules = await db.select().from(orderTimelineRules)
          .where(and(
            eq(orderTimelineRules.active, true),
            sql`UPPER(${orderTimelineRules.recipientName}) LIKE ${`%${recipientNameUpper.split(' ')[0]}%`}`
          ));

                if (recipientRules.length > 0) {
          // Build a map of sellerName -> position for this recipient
          // Use first-name LIKE matching because timeline rules may store short names
          // (e.g. 'Juvenal') while orders store full names (e.g. 'JUVENAL TEIXEIRA')
          const sellerPositionMap = new Map<string, number>();
          const sellerConditionMap = new Map<string, string[]>();
          for (const rule of recipientRules) {
            const nameKey = rule.sellerName.toUpperCase().trim();
            sellerPositionMap.set(nameKey, rule.approvalPosition);
            const existing = sellerConditionMap.get(nameKey) || [];
            existing.push(rule.conditionType);
            sellerConditionMap.set(nameKey, existing);
          }
          // Filter orders: only show orders where currentApprovalPosition matches this recipient's position
          orders = orders.filter(order => {
            // Orders with status "aprovado_subgestor" always pass through - they explicitly
            // need the parent gestor's approval regardless of position tracking
            if (order.status === "aprovado_subgestor") return true;
            const orderSellerName = (order.sellerName || '').toUpperCase().trim();
            // Try exact match first, then first-name match for short names like 'Juvenal'
            let matchedKey: string | undefined = sellerPositionMap.has(orderSellerName) ? orderSellerName : undefined;
            if (!matchedKey) {
              // Try matching by first name (timeline rules may store 'Juvenal' while order has 'JUVENAL TEIXEIRA')
              const orderFirstName = orderSellerName.split(' ')[0];
              for (const [ruleKey] of Array.from(sellerPositionMap.entries())) {
                const ruleFirstName = ruleKey.split(' ')[0];
                if (ruleFirstName === orderFirstName || ruleKey.includes(orderFirstName) || orderSellerName.includes(ruleFirstName)) {
                  matchedKey = ruleKey;
                  break;
                }
              }
            }
            if (!matchedKey) return true; // No rule for this seller, show anyway (legacy)
            const myPosition = sellerPositionMap.get(matchedKey)!;
            const conditions = sellerConditionMap.get(matchedKey) || [];
            const isAposAprovacao = conditions.includes("apos_aprovacao_gestores");
            if (isAposAprovacao) {
              // Show if order's current position has reached this recipient's position
              // (meaning all previous gestors have approved)
              // OR if order is already fully approved
              const orderPosition = order.currentApprovalPosition || 1;
              return orderPosition >= myPosition || order.status === "aprovado" || order.status === "processado";
            }
            // For position-based: show if order's current position >= my position
            // (so I can see orders at my position or that have already passed my position)
            // Also always show orders that are already fully approved/processed/rejected
            // (they've completed the pipeline and should be visible for history)
            if (order.status === "aprovado" || order.status === "processado" || order.status === "rejeitado") {
              return true;
            }
            const orderPosition = order.currentApprovalPosition || 1;
            return orderPosition >= myPosition;
          });
        }
      }

      // Attach items to each order for margin calculation
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

      // Get seller's price table to provide precoMostrado for each item
      let priceTableMap: Record<string, number> = {};
      try {
        const [seller] = await db.select().from(sellerPermissions)
          .where(eq(sellerPermissions.id, order.sellerId));
        if (seller) {
          const allTables = await db.select().from(priceTables);
          let matchedTable: typeof allTables[0] | undefined;
          if (seller.priceTableCode) {
            matchedTable = allTables.find(t => t.codigo === seller.priceTableCode);
          }
          if (!matchedTable) {
            const nameParts = seller.sellerName.toUpperCase().split(' ');
            matchedTable = allTables.find(t => {
              const desc = t.descricao.toUpperCase();
              return nameParts.some(part => part.length > 3 && desc.includes(part));
            });
          }
          if (matchedTable) {
            const ptItems = await db.select().from(priceTableItems)
              .where(eq(priceTableItems.priceTableId, matchedTable.id));
            for (const pti of ptItems) {
              priceTableMap[pti.itemCodigo] = parseFloat(pti.preco);
            }
          }
        }
      } catch (e) { /* ignore price table errors */ }

      return { order, items, priceTableMap };
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
    .input(z.object({
      status: z.enum(["aprovado", "processado", "todos"]).optional(),
      viewer: z.string().optional(), // Who is viewing: determines visibility rules
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const viewer = (input?.viewer || "").toLowerCase();
      const isGuilherme = viewer.includes("guilherme");
      const isFernando = viewer.includes("fernando");
      const isBruno = viewer.includes("bruno");
      const isJuvenal = viewer.includes("juvenal");
      const isTopGestor = isGuilherme || isFernando || isBruno;
      // Top gestores (Guilherme, Fernando, Bruno) see ALL orders - full supervision
      // Juvenal sees his sellers' orders (pending for approval + approved)
      // Vitória/others only see approved + processed orders
      
      const conditions: any[] = [];
      if (isTopGestor) {
        // Top gestores see everything except simulations
        conditions.push(sql`${salesOrderRequests.status} != 'simulacao'`);
      } else if (isJuvenal) {
        // Juvenal sees pending (his sellers) + aprovado_subgestor (needs his approval) + approved + processed + rejeitado
        conditions.push(or(
          eq(salesOrderRequests.status, "pendente"),
          eq(salesOrderRequests.status, "aprovado_subgestor"),
          eq(salesOrderRequests.status, "aprovado"),
          eq(salesOrderRequests.status, "processado"),
          eq(salesOrderRequests.status, "rejeitado")
        ));
      } else {
        // Vitória and others: approved + processed + rejeitado + pendente (full visibility)
        conditions.push(or(
          eq(salesOrderRequests.status, "aprovado"),
          eq(salesOrderRequests.status, "processado"),
          eq(salesOrderRequests.status, "rejeitado"),
          eq(salesOrderRequests.status, "pendente")
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

      // Enrich orders with formaCobranca from vendor_clients when order doesn't have it
      const cnpjsToLookup = orders
        .filter(o => !o.formaCobranca && o.cnpjCpf)
        .map(o => (o.cnpjCpf || "").replace(/\D/g, ""));
      
      const clientFormaCobrancaMap = new Map<string, string>();
      if (cnpjsToLookup.length > 0) {
        const clients = await db.select({
          cnpjCpf: vendorClients.cnpjCpf,
          formaCobranca: vendorClients.formaCobranca,
        }).from(vendorClients)
          .where(sql`${vendorClients.formaCobranca} IS NOT NULL AND ${vendorClients.formaCobranca} != ''`);
        
        for (const c of clients) {
          if (c.cnpjCpf && c.formaCobranca) {
            clientFormaCobrancaMap.set((c.cnpjCpf || "").replace(/\D/g, ""), c.formaCobranca);
          }
        }
      }

      return orders.map(order => {
        const cleanCnpj = (order.cnpjCpf || "").replace(/\D/g, "");
        const clientFormaCobranca = clientFormaCobrancaMap.get(cleanCnpj);
        return {
          ...order,
          // If order doesn't have formaCobranca, use client's formaCobranca
          formaCobranca: order.formaCobranca || clientFormaCobranca || null,
          items: itemsByOrder.get(order.id) || [],
        };
      });
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
  /** Approve an order (gestor) - supports sequential approval positions */
  approveOrder: publicProcedure
    .input(z.object({
      orderId: z.number(),
      aprovadoPor: z.string(),
      password: z.string(),
      observacaoAprovacao: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      // Validar senha: primeiro nome com inicial maiúscula
      const primeiroNome = input.aprovadoPor.split(" ")[0];
      const senhaEsperada = primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
      if (input.password !== senhaEsperada) {
        throw new Error("Senha incorreta");
      }
      // Get order details for history
      const [order] = await db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.id, input.orderId));
      if (!order) throw new Error("Pedido não encontrado");
      // Check if the approver is the order's gestor (final authority)
      const approverFirstName = input.aprovadoPor.split(" ")[0].toUpperCase();
      const gestorFirstName = (order.gestorName || "").split(" ")[0].toUpperCase();
      const isGestorApproving = approverFirstName === gestorFirstName && gestorFirstName.length > 0;
      
      // Check if Renato is approving one of his own sellers' orders (subgestor flow)
      const isRenatoApproving = input.aprovadoPor.toUpperCase().includes("RENATO");
      let needsGestorApproval = false;
      if (isRenatoApproving) {
        if (order.gestorName !== "RENATO LEDESMA") {
          // Renato is subgestor, needs parent gestor (Juvenal) approval
          needsGestorApproval = true;
        }
      }

      // Registrar no histórico de aprovações
      await db.insert(orderApprovalHistory).values({
        orderId: input.orderId,
        pedidoNumero: order.orderNumber ? String(order.orderNumber) : null,
        cliente: order.razaoSocial || order.nomeFantasia || null,
        vendedor: order.sellerName || null,
        aprovadoPor: input.aprovadoPor,
        tipoAprovacao: needsGestorApproval ? "subgestor" : "gestor",
        observacao: input.observacaoAprovacao || null,
      });

      // === SEQUENTIAL APPROVAL LOGIC ===
      // Check if there are timeline rules with positions for this seller
      // Match by sellerName using LIKE because timeline rules may store short operator names
      // (e.g. 'Juvenal') while orders store full names (e.g. 'JUVENAL TEIXEIRA')
      const orderSellerFirstName = (order.sellerName || '').split(' ')[0].toUpperCase();
      const timelineRules = await db.select().from(orderTimelineRules)
        .where(and(
          sql`UPPER(${orderTimelineRules.sellerName}) LIKE ${`%${orderSellerFirstName}%`}`,
          eq(orderTimelineRules.active, true)
        ));

      // Get all approval history for this order
      const approvalHistory = await db.select().from(orderApprovalHistory)
        .where(eq(orderApprovalHistory.orderId, input.orderId));

      const currentPosition = order.currentApprovalPosition || 1;
      const maxPosition = timelineRules.length > 0
        ? Math.max(...timelineRules.map(r => r.approvalPosition))
        : 1;

      // Find all recipients at the current position who need to authorize
      const currentPositionAuthRecipients = timelineRules.filter(
        r => r.approvalPosition === currentPosition && r.actionType === "autorizar"
      );
      // Get unique recipient IDs at current position that need to authorize
      const uniqueAuthRecipientIdsSet = new Set(currentPositionAuthRecipients.map(r => r.recipientId));
      const uniqueAuthRecipientIds = Array.from(uniqueAuthRecipientIdsSet);

      // Check who has already approved (including this approval)
      const approvedNamesSet = new Set(approvalHistory.map(h => h.aprovadoPor.toUpperCase()));
      approvedNamesSet.add(input.aprovadoPor.toUpperCase());
      const approvedNamesArr = Array.from(approvedNamesSet);

      // Check if all current position authorizers have approved
      // Match by name (case-insensitive first name match)
      const allCurrentPositionApproved = uniqueAuthRecipientIds.every(recipientId => {
        const recipientRules = timelineRules.filter(r => r.recipientId === recipientId);
        const recipientName = recipientRules[0]?.recipientName || "";
        const firstName = recipientName.split(" ")[0].toUpperCase();
        return approvedNamesArr.some(name => name.includes(firstName));
      });

      let newStatus = needsGestorApproval ? "aprovado_subgestor" : "aprovado";
      let newPosition = currentPosition;

      // When sub-gestor approves and it needs parent gestor approval,
      // advance position to the next level (parent gestor's position)
      if (needsGestorApproval && currentPosition < maxPosition) {
        newPosition = currentPosition + 1;
      }

      if (!needsGestorApproval) {
        // If the GESTOR (final authority) is approving, always fully approve
        if (isGestorApproving) {
          newStatus = "aprovado";
          newPosition = maxPosition;
        } else if (allCurrentPositionApproved && currentPosition < maxPosition) {
          // Advance to next position
          newPosition = currentPosition + 1;
          newStatus = "pendente"; // Still pending for next position
        } else if (allCurrentPositionApproved && currentPosition >= maxPosition) {
          // All positions approved - order is fully approved
          newStatus = "aprovado";
        } else {
          // Not all current position approvers have approved yet - stay pending
          newStatus = "pendente";
        }
      }

      await db.update(salesOrderRequests)
        .set({
          status: newStatus as any,
          aprovadoPor: newStatus === "aprovado" ? input.aprovadoPor : order.aprovadoPor,
          dataAprovacao: newStatus === "aprovado" ? new Date() : order.dataAprovacao,
          observacaoAprovacao: input.observacaoAprovacao
            ? (order.observacaoAprovacao ? order.observacaoAprovacao + "\n" : "") + `[${input.aprovadoPor}]: ${input.observacaoAprovacao}`
            : order.observacaoAprovacao,
          currentApprovalPosition: newPosition,
        })
        .where(eq(salesOrderRequests.id, input.orderId));

      return { success: true, needsGestorApproval, newPosition, newStatus };
    }),

  /** Gestor (Juvenal) approves orders pre-approved by subgestor (Renato) */
  gestorApproveSubgestorOrder: publicProcedure
    .input(z.object({
      orderId: z.number(),
      password: z.string(),
      observacaoGestor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      if (input.password !== "Juvenal") {
        throw new Error("Senha incorreta");
      }
      const [order] = await db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.id, input.orderId));
      if (!order) throw new Error("Pedido não encontrado");
      if (order.status !== "aprovado_subgestor") {
        throw new Error("Este pedido não está aguardando aprovação do gestor");
      }
      const existingObs = order.observacaoAprovacao || "";
      const gestorObs = input.observacaoGestor ? `\n[Juvenal]: ${input.observacaoGestor}` : "";
      await db.update(salesOrderRequests)
        .set({
          status: "aprovado",
          observacaoAprovacao: existingObs + gestorObs || null,
        })
        .where(eq(salesOrderRequests.id, input.orderId));

      // Registrar no histórico de aprovações
      await db.insert(orderApprovalHistory).values({
        orderId: input.orderId,
        pedidoNumero: order.orderNumber ? String(order.orderNumber) : null,
        cliente: order.razaoSocial || order.nomeFantasia || null,
        vendedor: order.sellerName || null,
        aprovadoPor: "Juvenal",
        tipoAprovacao: "gestor_final",
        observacao: input.observacaoGestor || null,
      });

      return { success: true };
    }),

  /** Gestor (Juvenal) rejects orders pre-approved by subgestor (Renato) */
  gestorRejectSubgestorOrder: publicProcedure
    .input(z.object({
      orderId: z.number(),
      password: z.string(),
      motivoRejeicao: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      if (input.password !== "Juvenal") {
        throw new Error("Senha incorreta");
      }
      const [order] = await db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.id, input.orderId));
      if (!order) throw new Error("Pedido n\u00e3o encontrado");
      if (order.status !== "aprovado_subgestor") {
        throw new Error("Este pedido n\u00e3o est\u00e1 aguardando aprova\u00e7\u00e3o do gestor");
      }
      await db.update(salesOrderRequests)
        .set({
          status: "rejeitado",
          motivoRejeicao: `[Juvenal rejeitou]: ${input.motivoRejeicao}`,
        })
        .where(eq(salesOrderRequests.id, input.orderId));
      return { success: true };
    }),

  /** Get orders pending gestor (Juvenal) approval */
  getOrdersPendingGestorApproval: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const orders = await db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.status, "aprovado_subgestor"))
        .orderBy(desc(salesOrderRequests.createdAt));
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

  /** Get approval history - all approvals logged */
  getApprovalHistory: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(100),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const limit = input?.limit || 100;
      const history = await db.select().from(orderApprovalHistory)
        .orderBy(desc(orderApprovalHistory.createdAt))
        .limit(limit);
      return history;
    }),

  /** Update approval observation (gestor can edit after approving) */
  updateObservacaoAprovacao: publicProcedure
    .input(z.object({
      orderId: z.number(),
      observacaoAprovacao: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      await db.update(salesOrderRequests)
        .set({
          observacaoAprovacao: input.observacaoAprovacao || null,
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

  /** Unreject (desrecusar) an order - resets it back to pendente so it can be re-evaluated */
  unrejectOrder: publicProcedure
    .input(z.object({
      orderId: z.number(),
      desrecusadoPor: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const [order] = await db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.id, input.orderId));
      if (!order) throw new Error("Pedido não encontrado");
      if (order.status !== "rejeitado") {
        throw new Error("Apenas pedidos recusados podem ser desrecusados");
      }

      await db.update(salesOrderRequests)
        .set({
          status: "pendente",
          motivoRejeicao: null,
          aprovadoPor: null,
          dataAprovacao: null,
        })
        .where(eq(salesOrderRequests.id, input.orderId));

      // Create notification
      try {
        const { createNotification } = await import("./notificationRouter");
        await createNotification({
          type: "pedido_vendedor",
          title: `Pedido #${order.orderNumber} Desrecusado`,
          message: `Pedido #${order.orderNumber} foi desrecusado por ${input.desrecusadoPor} e voltou para pendente.`,
          severity: "info",
          metadata: { orderId: input.orderId, sellerName: order.sellerName, gestorName: order.gestorName, orderNumber: order.orderNumber },
        });
      } catch (err) {
        console.error("[SalesOrder] Failed to create unreject notification:", err);
      }

      return { success: true };
    }),

  /** Update a single item in an order (swap product when out of stock) */
  updateOrderItem: publicProcedure
    .input(z.object({
      itemId: z.number(),
      orderId: z.number(),
      codigoItem: z.string(),
      descricaoItem: z.string(),
      quantidade: z.number(),
      unidadeMedida: z.string(),
      precoUnitario: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Verify order exists and is editable (pendente, rejeitado, or aprovado_subgestor for gestor review)
      const [order] = await db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.id, input.orderId));
      if (!order) throw new Error("Pedido não encontrado");
      if (order.status !== "pendente" && order.status !== "rejeitado" && order.status !== "aprovado_subgestor") {
        throw new Error("Pedido já foi aprovado e não pode ser editado");
      }

      // Get price minimum for the new product
      const minPriceRows = await db.select().from(productMinPrices)
        .where(eq(productMinPrices.codigoItem, input.codigoItem))
        .limit(1);
      const precoMinimo = minPriceRows.length > 0 ? Number(minPriceRows[0].precoMinimo) : null;
      const totalItem = input.quantidade * input.precoUnitario;
      const abaixoDoMinimo = precoMinimo !== null && input.precoUnitario < precoMinimo;

      // Update the item
      await db.update(salesOrderRequestItems)
        .set({
          codigoItem: input.codigoItem,
          descricaoItem: input.descricaoItem,
          quantidade: String(input.quantidade),
          unidadeMedida: input.unidadeMedida,
          precoUnitario: String(input.precoUnitario),
          precoMinimo: precoMinimo !== null ? String(precoMinimo) : null,
          totalItem: String(totalItem),
          abaixoDoMinimo,
        })
        .where(eq(salesOrderRequestItems.id, input.itemId));

      // Recalculate order totals
      const allItems = await db.select().from(salesOrderRequestItems)
        .where(eq(salesOrderRequestItems.orderId, input.orderId));
      const totalProdutos = allItems.reduce((sum, i) => sum + parseFloat(i.totalItem), 0);
      const temPrecoAbaixoMinimo = allItems.some(i => i.abaixoDoMinimo);

      await db.update(salesOrderRequests)
        .set({
          totalProdutos: String(totalProdutos),
          totalPedido: String(totalProdutos),
          temPrecoAbaixoMinimo,
          motivoAlerta: temPrecoAbaixoMinimo ? allItems.filter(i => i.abaixoDoMinimo).map(i => `${i.descricaoItem}: R$ ${parseFloat(i.precoUnitario).toFixed(2)} (mín: R$ ${i.precoMinimo ? parseFloat(i.precoMinimo).toFixed(2) : 'N/A'})`).join("; ") : null,
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
    .input(z.object({ orderId: z.number(), numeroPedidoMaxiprod: z.string().optional(), operadorNome: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      
      // Get order info for history
      const [order] = await db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.id, input.orderId))
        .limit(1);
      
      await db.update(salesOrderRequests)
        .set({
          vitoriaLancado: true,
          vitoriaLancadoAt: new Date(),
          status: "processado",
          processadoPor: input.operadorNome || "Vitória",
          dataProcessamento: new Date(),
          numeroPedidoMaxiprod: input.numeroPedidoMaxiprod || null,
        })
        .where(eq(salesOrderRequests.id, input.orderId));
      
      // Record history trail
      await db.insert(orderApprovalHistory).values({
        orderId: input.orderId,
        pedidoNumero: order?.numeroPedidoMaxiprod || null,
        cliente: order?.razaoSocial || order?.nomeFantasia || null,
        vendedor: order?.sellerName || null,
        aprovadoPor: input.operadorNome || "Vitória",
        tipoAprovacao: "lancado_maxiprod",
        observacao: `Pedido lançado no Maxiprod por ${input.operadorNome || "Vitória"}`,
      });
      
      return { success: true };
    }),

  /** Get new vendor clients (registered without order) for Vitória to export */
  getNewClientsForOperator: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    // Get vendor_clients that have no maxiprodId (not yet in Maxiprod)
    // and were created manually (source = 'manual') or from a pedido but not yet exported
    const clients = await db.select().from(vendorClients)
      .where(and(
        isNull(vendorClients.maxiprodId),
        eq(vendorClients.source, "manual")
      ))
      .orderBy(desc(vendorClients.createdAt))
      .limit(100);

    return clients;
  }),

  /** Mark a vendor client as exported to Maxiprod (set a placeholder maxiprodId) */
  markClientExported: publicProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      // Set maxiprodId to -1 as a "exported manually" marker
      await db.update(vendorClients)
        .set({ maxiprodId: -1 })
        .where(eq(vendorClients.id, input.clientId));
      return { success: true };
    }),

  /** Count pending orders for Vit\u00f3ria (approved but not yet lan\u00e7ado) */
  countPendingVitoria: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { pending: 0, naoRecebido: 0, recebidoNaoLancado: 0, newClients: 0 };
    const approved = await db.select().from(salesOrderRequests)
      .where(eq(salesOrderRequests.status, "aprovado"));
    const naoRecebido = approved.filter(o => !o.vitoriaRecebido).length;
    const recebidoNaoLancado = approved.filter(o => o.vitoriaRecebido && !o.vitoriaLancado).length;

    // Count new clients not yet exported
    const newClientsResult = await db.select({ count: sql<number>`COUNT(*)` }).from(vendorClients)
      .where(and(
        isNull(vendorClients.maxiprodId),
        eq(vendorClients.source, "manual")
      ));
    const newClients = Number(newClientsResult[0]?.count || 0);

    return { pending: approved.length + newClients, naoRecebido, recebidoNaoLancado, newClients };
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

  /** Export a vendor client directly by clientId (no order needed) */
  exportVendorClientMaxiprod: publicProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const [client] = await db.select().from(vendorClients)
        .where(eq(vendorClients.id, input.clientId));
      if (!client) throw new Error("Cliente não encontrado");

      const { generateMaxiprodExcel } = await import("./maxiprodExcelExport");
      const buffer = await generateMaxiprodExcel([client.id]);
      const base64 = buffer.toString("base64");
      const filename = `Maxiprod_${(client.razaoSocial || "Cliente").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      return { base64, filename, clientName: client.razaoSocial };
    }),

  /** Export order as Maxiprod Pedido de Venda XLS */
  exportOrderMaxiprod: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ input }) => {
      const { generateMaxiprodOrderExcelFromDb } = await import("./maxiprodOrderExport");
      const { buffer, filename } = await generateMaxiprodOrderExcelFromDb(input.orderId);
      const base64 = buffer.toString("base64");
      return { base64, filename };
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
    if (!db) return { pending: 0, pendente: 0, aprovadoSubgestor: 0 };
    const pendente = await db.select().from(salesOrderRequests)
      .where(eq(salesOrderRequests.status, "pendente"));
    const aprovadoSubgestor = await db.select().from(salesOrderRequests)
      .where(eq(salesOrderRequests.status, "aprovado_subgestor"));
    return { pending: pendente.length + aprovadoSubgestor.length, pendente: pendente.length, aprovadoSubgestor: aprovadoSubgestor.length };
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
      const tipoContribuinte = normalizeTipoContribuinte(order.tipoContribuinte);

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
      cepOrigem: z.string().default("37264000"), // CEP padrão Grupo Fox - Ribeirão Vermelho/MG
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
      cepOrigem: z.string().default("37264000"),
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
      cepOrigem: z.string().default("37264000"),
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
      cepOrigem: z.string().default("37264000"),
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
      cepOrigem: z.string().default("37264000"),
      cepDestino: z.string(),
      valorMercadoria: z.number(),
      peso: z.number(),
      volumes: z.number().default(1),
      metroCubico: z.number().default(0.05),
      altura: z.number().default(0.5),
      largura: z.number().default(0.5),
      comprimento: z.number().default(0.5),
      tipoContribuinte: z.string().default("Contribuinte"),
    }))
    .mutation(async ({ input }) => {
      console.log(`[FreightQuote] Starting: CEP ${input.cepOrigem} → ${input.cepDestino}, peso=${input.peso}kg, valor=${input.valorMercadoria}`);
      
      // Lookup customer data from vendor_clients for auto-registration (Rodonaves)
      let customerData: { nome: string; email: string; telefone: string; cep: string; logradouro: string; numero: string; complemento?: string; bairro: string; cidade: string; uf: string; inscricaoEstadual?: string } | undefined;
      if (input.cnpjDestinatario) {
        const db = await getDb();
        const cleanCnpj = input.cnpjDestinatario.replace(/\D/g, "");
        const [client] = await db!.select()
          .from(vendorClients)
          .where(sql`REPLACE(REPLACE(REPLACE(${vendorClients.cnpjCpf}, '.', ''), '/', ''), '-', '') = ${cleanCnpj}`)
          .limit(1);
        if (client) {
          customerData = {
            nome: client.razaoSocial || client.nomeFantasia || "Cliente",
            email: client.emailNfe || client.email || "nfe@grupofox.com.br",
            telefone: client.telefone1 || client.telefone2 || "31999999999",
            cep: client.cep || input.cepDestino,
            logradouro: client.logradouro || "Rua",
            numero: client.numero || "S/N",
            complemento: client.complemento || undefined,
            bairro: client.bairro || "Centro",
            cidade: client.cidade || "",
            uf: client.uf || "",
            inscricaoEstadual: client.inscricaoEstadual || undefined,
          };
          console.log(`[FreightQuote] Customer data found for ${cleanCnpj}: ${customerData.nome}`);
        } else {
          console.log(`[FreightQuote] No customer data found in vendor_clients for CNPJ ${cleanCnpj}`);
        }
      }

      // Quote from all 5 carriers in parallel: Braspress + Alfa + Camilo (SSW) + Rodonaves + Flor de Minas
      const [braspressResults, alfaResults, sswResults, rodonavesResults, florDeMinasResult] = await Promise.allSettled([
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
        quoteAllSswCnpjsWithProtocol({
          // SSW/Camilo has freight table negotiated from Perdões/MG (37260000), not Contagem
          cepOrigem: "37260000",
          cepDestino: input.cepDestino.replace(/\D/g, ""),
          valorNF: input.valorMercadoria,
          quantidade: input.volumes,
          peso: input.peso,
          cubagem: input.metroCubico,
          cnpjDestinatario: input.cnpjDestinatario,
          destContribuinte: normalizeTipoContribuinte(input.tipoContribuinte) === "Contribuinte" ? "S" : "N",
        }),
        quoteAllRodonavesCnpjs({
          cepOrigem: input.cepOrigem,
          cepDestino: input.cepDestino,
          valorMercadoria: input.valorMercadoria,
          peso: input.peso,
          volumes: input.volumes,
          cnpjDestinatario: input.cnpjDestinatario,
          customerData,
        }),
        quoteFlordeMinas({
          cepDestino: input.cepDestino,
          valorMercadoria: input.valorMercadoria,
          pesoKg: input.peso,
        }),
      ]);

      const carriers: Array<{
        transportadora: string;
        cnpj: string;
        totalFrete: number;
        prazo: string;
        trackingUrl?: string;
        protocolo?: string;
        error?: string;
      }> = [];

      // Log carrier results for debugging
      console.log(`[FreightQuote] Results: Braspress=${braspressResults.status}, Alfa=${alfaResults.status}, SSW=${sswResults.status}, Rodonaves=${rodonavesResults.status}, FlorDeMinas=${florDeMinasResult.status}`);
      if (braspressResults.status === "rejected") console.log(`[FreightQuote] Braspress error: ${braspressResults.reason?.message}`);
      if (alfaResults.status === "rejected") console.log(`[FreightQuote] Alfa error: ${alfaResults.reason?.message}`);
      if (sswResults.status === "rejected") console.log(`[FreightQuote] SSW error: ${sswResults.reason?.message}`);
      if (rodonavesResults.status === "rejected") console.log(`[FreightQuote] Rodonaves error: ${rodonavesResults.reason?.message}`);
      if (florDeMinasResult.status === "rejected") console.log(`[FreightQuote] FlorDeMinas error: ${florDeMinasResult.reason?.message}`);

      // Process Braspress results
      if (braspressResults.status === "fulfilled") {
        for (const r of braspressResults.value) {
          carriers.push({
            transportadora: "Braspress",
            cnpj: r.cnpjUsado,
            totalFrete: r.totalFrete || 0,
            prazo: r.prazo ? `${r.prazo} dias úteis` : "N/A",
            // Braspress tracking: by CNPJ + NF (available after NF is emitted)
            trackingUrl: r.cnpjUsado ? `https://www.braspress.com/rastreie-sua-encomenda/` : undefined,
            protocolo: r.id ? String(r.id) : undefined,
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
            protocolo: r.protocolo || undefined,
            // Alfa tracking: via API interna (trackAllAlfaCnpjs) - sem link público
            trackingUrl: "rastreio-interno",
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
            protocolo: r.protocolo || undefined,
            // SSW/Camilo tracking: CNPJ remetente 19451038000109 + NF (available after NF)
            trackingUrl: `https://ssw.inf.br/2/rastreamento`,
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
          const protocolo = r.protocolo ? String(r.protocolo) : undefined;
          carriers.push({
            transportadora: "Rodonaves",
            cnpj: r.cnpj,
            totalFrete: r.totalFrete,
            prazo: r.prazo || "N/A",
            protocolo,
            trackingUrl: protocolo ? `https://www.rodonaves.com.br/rastreio-de-mercadoria?protocolo=${protocolo}&rastreiemercadoria=1` : undefined,
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

      // Process Flor de Minas result
      if (florDeMinasResult.status === "fulfilled") {
        const r = florDeMinasResult.value;
        carriers.push({
          transportadora: r.transportadora,
          cnpj: r.cnpj,
          totalFrete: r.totalFrete,
          prazo: r.prazo,
          error: r.error,
        });
      } else {
        carriers.push({
          transportadora: "Flor de Minas",
          cnpj: "",
          totalFrete: 0,
          prazo: "N/A",
          error: florDeMinasResult.reason?.message || "Erro ao cotar Flor de Minas",
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

  /**
   * Quote freight for an existing order (by pedido number).
   * Automatically fetches CEP, CNPJ, peso, valor from the order/client data.
   */
  quoteByPedido: publicProcedure
    .input(z.object({ pedido: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // 1. Get order items from salesOrders
      const orderItems = await db.select({
        cliente: salesOrders.cliente,
        uf: salesOrders.uf,
        enderecoCep: salesOrders.enderecoCep,
        valorTotalPedido: salesOrders.valorTotalPedido,
        valorTotal: salesOrders.valorTotal,
        quantidade: salesOrders.quantidade,
        quantidadeUnidadeItem: salesOrders.quantidadeUnidadeItem,
        unidadeMedidaCodigo: salesOrders.unidadeMedidaCodigo,
        codigoItem: salesOrders.codigoItem,
        descricaoItem: salesOrders.descricaoItem,
        transportadora: salesOrders.transportadora,
        razaoSocial: salesOrders.razaoSocial,
        inscricaoEstadual: salesOrders.inscricaoEstadual,
        enderecoLogradouro: salesOrders.enderecoLogradouro,
        enderecoNumero: salesOrders.enderecoNumero,
        enderecoBairro: salesOrders.enderecoBairro,
        enderecoCidade: salesOrders.enderecoCidade,
      }).from(salesOrders)
        .where(eq(salesOrders.pedido, input.pedido));

      if (orderItems.length === 0) {
        throw new Error(`Pedido #${input.pedido} não encontrado no Maxiprod`);
      }

      const firstItem = orderItems[0];
      const clienteName = firstItem.cliente || "";
      let cepDestino = (firstItem.enderecoCep || "").replace(/\D/g, "");
      let cnpjDestinatario = "";
      let tipoContribuinte = "Contribuinte";
      let valorMercadoria = parseFloat(String(firstItem.valorTotalPedido || 0));
      if (!valorMercadoria) {
        valorMercadoria = orderItems.reduce((sum, i) => sum + parseFloat(String(i.valorTotal || 0)), 0);
      }

      // 2. Try to find client in vendor_clients for CNPJ and CEP (more reliable)
      // Strategy: exact razaoSocial match → LIKE match → nomeFantasia match
      let foundClient: any = null;
      if (clienteName) {
        // Strategy 1: Exact match on razaoSocial
        const [exactMatch] = await db.select()
          .from(vendorClients)
          .where(sql`UPPER(${vendorClients.razaoSocial}) = ${clienteName.toUpperCase()}`)
          .limit(1);
        foundClient = exactMatch;

        // Strategy 2: LIKE match (partial name)
        if (!foundClient) {
          const searchName = clienteName.toUpperCase().replace(/\s+(LTDA|ME|EPP|EIRELI|S\.?A\.?|LTDA\.?)\s*$/i, '').trim();
          if (searchName.length >= 5) {
            const [likeMatch] = await db.select()
              .from(vendorClients)
              .where(sql`UPPER(${vendorClients.razaoSocial}) LIKE ${`%${searchName}%`}`)
              .limit(1);
            foundClient = likeMatch;
          }
        }

        // Strategy 3: Match on nomeFantasia
        if (!foundClient) {
          const [fantasyMatch] = await db.select()
            .from(vendorClients)
            .where(sql`UPPER(${vendorClients.nomeFantasia}) = ${clienteName.toUpperCase()}`)
            .limit(1);
          foundClient = fantasyMatch;
        }

        // Strategy 4: If clienteName contains a CNPJ/CPF number, extract and search by it
        if (!foundClient) {
          const cnpjMatch = clienteName.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
          if (cnpjMatch) {
            const cleanDoc = cnpjMatch[1].replace(/\D/g, "");
            const [docMatch] = await db.select()
              .from(vendorClients)
              .where(sql`REPLACE(REPLACE(REPLACE(${vendorClients.cnpjCpf}, '.', ''), '/', ''), '-', '') = ${cleanDoc}`)
              .limit(1);
            foundClient = docMatch;
          }
        }

        if (foundClient) {
          cnpjDestinatario = (foundClient.cnpjCpf || "").replace(/\D/g, "");
          if (foundClient.cep) cepDestino = foundClient.cep.replace(/\D/g, "");
          tipoContribuinte = foundClient.tipoContribuinte || "Contribuinte";
          console.log(`[QuoteByPedido] Found client in vendor_clients: ${foundClient.razaoSocial}, CNPJ: ${cnpjDestinatario}`);
        } else {
          console.log(`[QuoteByPedido] Client not in vendor_clients, trying sales_order_requests...`);
          // Strategy 5: Search in sales_order_requests (manual orders) for the CNPJ
          const [orderReqClient] = await db.select({
            cnpjCpf: salesOrderRequests.cnpjCpf,
            cep: salesOrderRequests.cep,
            tipoContribuinte: salesOrderRequests.tipoContribuinte,
          }).from(salesOrderRequests)
            .where(sql`UPPER(${salesOrderRequests.razaoSocial}) LIKE ${`%${clienteName.toUpperCase().substring(0, 20)}%`}`)
            .limit(1);
          if (orderReqClient && orderReqClient.cnpjCpf) {
            cnpjDestinatario = orderReqClient.cnpjCpf.replace(/\D/g, "");
            if (orderReqClient.cep && !cepDestino) cepDestino = orderReqClient.cep.replace(/\D/g, "");
            tipoContribuinte = orderReqClient.tipoContribuinte || "Contribuinte";
            console.log(`[QuoteByPedido] Found client in sales_order_requests: CNPJ: ${cnpjDestinatario}`);
          } else {
            // Strategy 6: Use inscricaoEstadual from sales_orders as a hint (it's not CNPJ but helps identify contribuinte)
            if (firstItem.inscricaoEstadual) {
              tipoContribuinte = "Contribuinte";
            }
            console.log(`[QuoteByPedido] WARNING: Client CNPJ not found anywhere: "${clienteName}". Some carriers may fail.`);
          }
        }
      }

      // 2b. REGRA (03/08/2026): Usar endereço de ENTREGA quando diferente do endereço do cliente.
      // O frete é calculado com base em onde vai ser entregue, não no endereço do cadastro do CNPJ.
      // Verificar se existe um pedido em sales_order_requests com endereço de entrega diferente.
      let enderecoEntregaUsado = false;
      let cepOriginalCliente = cepDestino; // Guardar CEP original para histórico
      const [orderRequest] = await db.select({
        enderecoEntregaMesmo: salesOrderRequests.enderecoEntregaMesmo,
        entregaCep: salesOrderRequests.entregaCep,
        entregaLogradouro: salesOrderRequests.entregaLogradouro,
        entregaNumero: salesOrderRequests.entregaNumero,
        entregaBairro: salesOrderRequests.entregaBairro,
        entregaCidade: salesOrderRequests.entregaCidade,
        entregaUf: salesOrderRequests.entregaUf,
      }).from(salesOrderRequests)
        .where(and(
          sql`${salesOrderRequests.orderNumber} = ${parseInt(input.pedido) || 0}`,
          eq(salesOrderRequests.enderecoEntregaMesmo, false),
        ))
        .limit(1);
      
      if (orderRequest && orderRequest.entregaCep) {
        const entregaCepClean = orderRequest.entregaCep.replace(/\D/g, "");
        if (entregaCepClean.length >= 8 && entregaCepClean !== cepDestino) {
          console.log(`[QuoteByPedido] Pedido #${input.pedido}: Usando endereço de ENTREGA (CEP ${entregaCepClean}) ao invés do endereço do cliente (CEP ${cepDestino})`);
          cepOriginalCliente = cepDestino;
          cepDestino = entregaCepClean;
          enderecoEntregaUsado = true;
        }
      }

      if (!cepDestino || cepDestino.length < 8) {
        throw new Error(`CEP do destinatário não encontrado para o pedido #${input.pedido}. Verifique o cadastro do cliente.`);
      }

      // 3. Calculate weight and volumes from order data
      // Strategy: use pesoBruto (per base unit) * quantidadeUnidadeItem (total base units in order line)
      // This is the most accurate approach because Maxiprod already calculates quantidadeUnidadeItem
      // which accounts for all unit conversions (CX→UN, PC→UN, etc.)
      let pesoTotal = 0;
      let totalVolumes = 0; // = sum of order quantities (each qty = 1 physical box/package)
      const codigosItens = orderItems.map(i => i.codigoItem).filter(Boolean) as string[];
      
      // Detailed item breakdown for PDF report
      const itemsBreakdown: Array<{
        codigo: string;
        descricao: string;
        qtd: number;
        unidade: string;
        pesoBrutoUn: number;
        fatorConv: number;
        pesoCx: number;
        pesoTotal: number;
        dimensoes: string;
        comprimento: number;
        largura: number;
        altura: number;
        volCxM3: number;
        cubagem: number;
      }> = [];

      if (codigosItens.length > 0) {
        const stockData = await db.select({
          codigoItem: stockItems.codigoItem,
          pesoBruto: stockItems.pesoBruto,
          pesoLiquido: stockItems.pesoLiquido,
          unidadeMedida: stockItems.unidadeMedida,
          unidadeDeVendaFator: stockItems.unidadeDeVendaFator,
          unidadeDeVendaCodigo: stockItems.unidadeDeVendaCodigo,
          descricaoComplementar: stockItems.descricaoComplementar,
        }).from(stockItems)
          .where(inArray(stockItems.codigoItem, codigosItens));

        // Build map: codigoItem -> pesoBruto per base unit (UN)
        const pesoBrutoMap = new Map<string, number>();
        for (const s of stockData) {
          // MUST use pesoBruto only (not pesoLiquido) for freight quoting per business rule
          const pesoBase = parseFloat(String(s.pesoBruto || 0));
          if (pesoBase > 0 && s.codigoItem) {
            pesoBrutoMap.set(s.codigoItem, pesoBase);
          }
        }

        for (const item of orderItems) {
          const qty = parseFloat(String(item.quantidade || 1));
          totalVolumes += qty;
          
          const stockItem = stockData.find(s => s.codigoItem === item.codigoItem);
          const pesoBrutoPerUnit = pesoBrutoMap.get(item.codigoItem || "") || 0;
          const fator = parseFloat(String(stockItem?.unidadeDeVendaFator || 1)) || 1;
          let itemPesoTotal = 0;
          
          if (pesoBrutoPerUnit > 0) {
            const qtyUnidadeItem = parseFloat(String(item.quantidadeUnidadeItem || 0));
            const um = (stockItem?.unidadeMedida || '').toUpperCase().trim();
            const uvCodigo = (stockItem?.unidadeDeVendaCodigo || '').toUpperCase().trim();
            
            // The pesoBruto in stock_items is per BASE UNIT (e.g., per single stick/toothpick).
            // The order quantity is in SALES UNITS (boxes/CX).
            // To get box weight: pesoBruto * unidadeDeVendaFator (units per box)
            // To get total weight: boxWeight * qty (number of boxes)
            // 
            // Special case: if quantidadeUnidadeItem is significantly larger than quantidade,
            // it means Maxiprod already converted to base units (e.g., 3 CX * 5000 = 15000 UN)
            // In that case, pesoBruto * quantidadeUnidadeItem gives the correct total weight.
            
            if (qtyUnidadeItem > 0 && qtyUnidadeItem > qty * 10) {
              // quantidadeUnidadeItem is in base units (already converted by Maxiprod)
              itemPesoTotal = pesoBrutoPerUnit * qtyUnidadeItem;
            } else if (um === 'UN' && (uvCodigo === 'CX' || uvCodigo === 'PC') && fator > 1) {
              // pesoBruto is per base unit, need to multiply by fator to get per-box weight
              itemPesoTotal = pesoBrutoPerUnit * fator * qty;
            } else {
              // pesoBruto is already per sales unit or no conversion needed
              itemPesoTotal = pesoBrutoPerUnit * qty;
            }
            pesoTotal += itemPesoTotal;
          }

          // Parse dimensions from descricaoComplementar using shared utility
          const dimStr = stockItem?.descricaoComplementar || "";
          let comprCm = 0, largCm = 0, altCm = 0;
          const parsedDims = parseDimensions(dimStr);
          if (parsedDims) {
            comprCm = parsedDims.comprimento;
            largCm = parsedDims.largura;
            altCm = parsedDims.altura;
          }
          const volCxM3 = comprCm > 0 ? (comprCm * largCm * altCm) / 1_000_000 : 0;
          const cubagem = volCxM3 * qty;

          itemsBreakdown.push({
            codigo: item.codigoItem || "",
            descricao: item.descricaoItem || "",
            qtd: qty,
            unidade: "CX", // Grupo Fox: todos os produtos são vendidos em caixa
            pesoBrutoUn: pesoBrutoPerUnit,
            fatorConv: fator,
            pesoCx: pesoBrutoPerUnit * fator,
            pesoTotal: itemPesoTotal,
            dimensoes: dimStr,
            comprimento: comprCm,
            largura: largCm,
            altura: altCm,
            volCxM3,
            cubagem,
          });
        }
      } else {
        totalVolumes = orderItems.reduce((sum, i) => sum + parseFloat(String(i.quantidade || 1)), 0);
      }

      // Fallback: if no weight found at all, estimate based on average box weight (~10kg)
      if (pesoTotal <= 0) {
        pesoTotal = totalVolumes * 10; // ~10kg per box average for bamboo products
      }

      const volumes = Math.max(1, Math.round(totalVolumes));
      // Calculate real cubagem from item dimensions
      const cubagemReal = itemsBreakdown.reduce((sum, i) => sum + i.cubagem, 0);
      const metroCubico = cubagemReal > 0 ? cubagemReal : volumes * 0.05;
      // Calculate real dimensions for Braspress (uses largest box dimensions)
      const maxAltura = Math.max(...itemsBreakdown.map(i => i.altura), 0) / 100; // cm -> m
      const maxComprimento = Math.max(...itemsBreakdown.map(i => i.comprimento), 0) / 100;
      // Average width weighted by quantity
      const totalQty = itemsBreakdown.reduce((s, i) => s + i.qtd, 0) || 1;
      const avgLargura = itemsBreakdown.reduce((s, i) => s + i.largura * i.qtd, 0) / totalQty / 100;

      console.log(`[QuoteByPedido] Pedido #${input.pedido}: CEP=${cepDestino}, CNPJ=${cnpjDestinatario}, Valor=${valorMercadoria}, Peso=${pesoTotal}kg, Volumes=${volumes}, Cubagem=${metroCubico}m³`);

      // 4. Get customer data for Rodonaves
      let customerData: { nome: string; email: string; telefone: string; cep: string; logradouro: string; numero: string; complemento?: string; bairro: string; cidade: string; uf: string; inscricaoEstadual?: string } | undefined;
      if (cnpjDestinatario) {
        const [client] = await db.select()
          .from(vendorClients)
          .where(sql`REPLACE(REPLACE(REPLACE(${vendorClients.cnpjCpf}, '.', ''), '/', ''), '-', '') = ${cnpjDestinatario}`)
          .limit(1);
        if (client) {
          customerData = {
            nome: client.razaoSocial || client.nomeFantasia || "Cliente",
            email: client.emailNfe || client.email || "nfe@grupofox.com.br",
            telefone: client.telefone1 || client.telefone2 || "31999999999",
            cep: client.cep || cepDestino,
            logradouro: client.logradouro || "Rua",
            numero: client.numero || "S/N",
            complemento: client.complemento || undefined,
            bairro: client.bairro || "Centro",
            cidade: client.cidade || "",
            uf: client.uf || "",
            inscricaoEstadual: client.inscricaoEstadual || undefined,
          };
        }
      }

      // 5. Quote all 5 carriers in parallel
      const normalizeTipoContrib = (t: string) => {
        const upper = t.toUpperCase();
        if (upper.includes("NAO") || upper.includes("NÃO") || upper.includes("N")) return "Não Contribuinte";
        return "Contribuinte";
      };

      const [braspressResults, alfaResults, sswResults, rodonavesResults, florDeMinasResult] = await Promise.allSettled([
        cotarTodosCnpjs({
          cnpjDestinatario: cnpjDestinatario || "00000000000000",
          cepOrigem: "37264000",
          cepDestino,
          valorMercadoria,
          peso: pesoTotal,
          volumes,
          altura: maxAltura > 0 ? maxAltura : 0.5,
          largura: avgLargura > 0 ? avgLargura : 0.5,
          comprimento: maxComprimento > 0 ? maxComprimento : 0.5,
        }),
        quoteAllAlfaCnpjs({
          cepDestino,
          cepOrigem: "37264000",
          valorMercadoria,
          peso: pesoTotal,
          metroCubico,
          volumes,
          cnpjDestinatario,
        }),
        quoteAllSswCnpjsWithProtocol({
          cepOrigem: "37260000",
          cepDestino: cepDestino.replace(/\D/g, ""),
          valorNF: valorMercadoria,
          quantidade: volumes,
          peso: pesoTotal,
          cubagem: metroCubico,
          cnpjDestinatario,
          destContribuinte: normalizeTipoContrib(tipoContribuinte) === "Contribuinte" ? "S" : "N",
        }),
        quoteAllRodonavesCnpjs({
          cepOrigem: "37264000",
          cepDestino,
          valorMercadoria,
          peso: pesoTotal,
          volumes,
          cnpjDestinatario,
          customerData,
        }),
        quoteFlordeMinas({
          cepDestino,
          valorMercadoria,
          pesoKg: pesoTotal,
        }),
      ]);

      const carriers: Array<{
        transportadora: string;
        cnpj: string;
        totalFrete: number;
        prazo: string;
        protocolo?: string;
        error?: string;
      }> = [];

      // Process Braspress
      if (braspressResults.status === "fulfilled") {
        for (const r of braspressResults.value) {
          carriers.push({ transportadora: "Braspress", cnpj: r.cnpjUsado, totalFrete: r.totalFrete || 0, prazo: r.prazo ? `${r.prazo} dias úteis` : "N/A", protocolo: r.id ? String(r.id) : undefined, error: r.error });
        }
      } else {
        carriers.push({ transportadora: "Braspress", cnpj: "", totalFrete: 0, prazo: "N/A", error: braspressResults.reason?.message || "Erro" });
      }

      // Process Alfa
      if (alfaResults.status === "fulfilled") {
        for (const r of alfaResults.value) {
          carriers.push({ transportadora: "Alfa Transportes", cnpj: r.cnpj, totalFrete: r.totalFrete, prazo: r.prazo || "N/A", protocolo: r.protocolo || undefined, error: r.error });
        }
      } else {
        carriers.push({ transportadora: "Alfa Transportes", cnpj: "", totalFrete: 0, prazo: "N/A", error: alfaResults.reason?.message || "Erro" });
      }

      // Process Camilo (SSW)
      if (sswResults.status === "fulfilled") {
        for (const r of sswResults.value) {
          carriers.push({ transportadora: "Camilo dos Santos", cnpj: r.cnpj, totalFrete: r.totalFrete, prazo: r.prazo ? `${r.prazo} dias úteis` : "N/A", protocolo: r.protocolo || undefined, error: r.error });
        }
      } else {
        carriers.push({ transportadora: "Camilo dos Santos", cnpj: "", totalFrete: 0, prazo: "N/A", error: sswResults.reason?.message || "Erro" });
      }

      // Process Rodonaves
      if (rodonavesResults.status === "fulfilled") {
        for (const r of rodonavesResults.value) {
          carriers.push({ transportadora: "Rodonaves", cnpj: r.cnpj, totalFrete: r.totalFrete, prazo: r.prazo || "N/A", protocolo: r.protocolo ? String(r.protocolo) : undefined, error: r.error });
        }
      } else {
        carriers.push({ transportadora: "Rodonaves", cnpj: "", totalFrete: 0, prazo: "N/A", error: rodonavesResults.reason?.message || "Erro" });
      }

      // Process Flor de Minas
      if (florDeMinasResult.status === "fulfilled") {
        const r = florDeMinasResult.value;
        carriers.push({ transportadora: r.transportadora, cnpj: r.cnpj, totalFrete: r.totalFrete, prazo: r.prazo, error: r.error });
      } else {
        carriers.push({ transportadora: "Flor de Minas", cnpj: "", totalFrete: 0, prazo: "N/A", error: florDeMinasResult.reason?.message || "Erro" });
      }

      // Sort by lowest freight (errors at the end)
      carriers.sort((a, b) => {
        if (a.error && !b.error) return 1;
        if (!a.error && b.error) return -1;
        return a.totalFrete - b.totalFrete;
      });

      // Build CEP change history for this order
      let cepChangeHistory: Array<{ de: string; para: string; data: string; motivo: string }> = [];
      // Check if there was a CEP change (delivery address different from client)
      if (enderecoEntregaUsado) {
        cepChangeHistory.push({
          de: cepOriginalCliente,
          para: cepDestino,
          data: new Date().toISOString(),
          motivo: "Endereço de entrega diferente do cadastro do cliente",
        });
      }
      // Also check freight_simulations history for previous CEP changes on this order
      const previousSims = await db.select({
        cepDestino: freightSimulations.cepDestino,
        createdAt: freightSimulations.createdAt,
        results: freightSimulations.results,
      }).from(freightSimulations)
        .where(sql`JSON_EXTRACT(${freightSimulations.results}, '$.pedido') = ${input.pedido}`)
        .orderBy(freightSimulations.createdAt);
      
      if (previousSims.length > 0) {
        // Check if CEP changed between simulations
        for (let i = 1; i < previousSims.length; i++) {
          const prev = previousSims[i - 1];
          const curr = previousSims[i];
          if (prev.cepDestino !== curr.cepDestino) {
            cepChangeHistory.push({
              de: prev.cepDestino,
              para: curr.cepDestino,
              data: curr.createdAt?.toISOString() || "",
              motivo: "CEP alterado entre simulações",
            });
          }
        }
        // Check if current CEP is different from last simulation
        const lastSim = previousSims[previousSims.length - 1];
        if (lastSim.cepDestino !== cepDestino && !enderecoEntregaUsado) {
          cepChangeHistory.push({
            de: lastSim.cepDestino,
            para: cepDestino,
            data: new Date().toISOString(),
            motivo: "CEP atualizado no cadastro do cliente",
          });
        }
      }

      return {
        pedido: input.pedido,
        cliente: clienteName,
        cepDestino,
        cnpjDestinatario,
        valorMercadoria,
        pesoTotal,
        volumes,
        metroCubico,
        tipoContribuinte,
        carriers,
        // Detailed data for PDF report
        itemsBreakdown,
        endereco: enderecoEntregaUsado && orderRequest ? {
          logradouro: orderRequest.entregaLogradouro || firstItem.enderecoLogradouro || "",
          numero: orderRequest.entregaNumero || firstItem.enderecoNumero || "",
          bairro: orderRequest.entregaBairro || firstItem.enderecoBairro || "",
          cidade: orderRequest.entregaCidade || firstItem.enderecoCidade || "",
          uf: orderRequest.entregaUf || firstItem.uf || "",
        } : {
          logradouro: firstItem.enderecoLogradouro || "",
          numero: firstItem.enderecoNumero || "",
          bairro: firstItem.enderecoBairro || "",
          cidade: firstItem.enderecoCidade || "",
          uf: firstItem.uf || "",
        },
        dimensoes: {
          altura: maxAltura > 0 ? maxAltura : 0.5,
          largura: avgLargura > 0 ? avgLargura : 0.5,
          comprimento: maxComprimento > 0 ? maxComprimento : 0.5,
        },
        // Histórico de mudanças de CEP
        enderecoEntregaUsado,
        cepOriginalCliente: enderecoEntregaUsado ? cepOriginalCliente : undefined,
        cepChangeHistory: cepChangeHistory.length > 0 ? cepChangeHistory : undefined,
      };
    }),

  /**
   * Quote freight for MULTIPLE orders combined (by pedido numbers).
   * Merges all items from all pedidos into one combined shipment.
   */
  quoteByMultiplePedidos: publicProcedure
    .input(z.object({ pedidos: z.array(z.string()).min(1).max(10) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // 1. Get order items from ALL pedidos
      const allOrderItems: any[] = [];
      const pedidoLabels: string[] = [];

      for (const pedidoNum of input.pedidos) {
        const orderItems = await db.select({
          cliente: salesOrders.cliente,
          uf: salesOrders.uf,
          enderecoCep: salesOrders.enderecoCep,
          valorTotalPedido: salesOrders.valorTotalPedido,
          valorTotal: salesOrders.valorTotal,
          quantidade: salesOrders.quantidade,
          quantidadeUnidadeItem: salesOrders.quantidadeUnidadeItem,
          unidadeMedidaCodigo: salesOrders.unidadeMedidaCodigo,
          codigoItem: salesOrders.codigoItem,
          descricaoItem: salesOrders.descricaoItem,
          transportadora: salesOrders.transportadora,
          razaoSocial: salesOrders.razaoSocial,
          inscricaoEstadual: salesOrders.inscricaoEstadual,
          enderecoLogradouro: salesOrders.enderecoLogradouro,
          enderecoNumero: salesOrders.enderecoNumero,
          enderecoBairro: salesOrders.enderecoBairro,
          enderecoCidade: salesOrders.enderecoCidade,
          pedido: salesOrders.pedido,
        }).from(salesOrders)
          .where(eq(salesOrders.pedido, pedidoNum));

        if (orderItems.length === 0) {
          throw new Error(`Pedido #${pedidoNum} não encontrado no Maxiprod`);
        }
        allOrderItems.push(...orderItems);
        pedidoLabels.push(pedidoNum);
      }

      const firstItem = allOrderItems[0];
      const clienteName = firstItem.cliente || "";
      let cepDestino = (firstItem.enderecoCep || "").replace(/\D/g, "");
      let cnpjDestinatario = "";
      let tipoContribuinte = "Contribuinte";

      // Sum valorMercadoria from all pedidos (use valorTotalPedido per pedido, avoid double-counting)
      const pedidoValorMap = new Map<string, number>();
      for (const item of allOrderItems) {
        const ped = item.pedido || "";
        if (!pedidoValorMap.has(ped)) {
          const val = parseFloat(String(item.valorTotalPedido || 0));
          pedidoValorMap.set(ped, val);
        }
      }
      let valorMercadoria = 0;
      pedidoValorMap.forEach((val) => {
        valorMercadoria += val;
      });
      // Fallback: sum individual item values if valorTotalPedido is 0
      if (!valorMercadoria) {
        valorMercadoria = allOrderItems.reduce((sum: number, i: any) => sum + parseFloat(String(i.valorTotal || 0)), 0);
      }

      // 2. Try to find client in vendor_clients for CNPJ and CEP
      if (clienteName) {
        const [client] = await db.select()
          .from(vendorClients)
          .where(sql`UPPER(${vendorClients.razaoSocial}) = ${clienteName.toUpperCase()}`)
          .limit(1);
        if (client) {
          cnpjDestinatario = (client.cnpjCpf || "").replace(/\D/g, "");
          if (client.cep) cepDestino = client.cep.replace(/\D/g, "");
          tipoContribuinte = client.tipoContribuinte || "Contribuinte";
        }
      }

      if (!cepDestino || cepDestino.length < 8) {
        throw new Error(`CEP do destinatário não encontrado para os pedidos #${pedidoLabels.join(", #")}. Verifique o cadastro do cliente.`);
      }

      // 3. Calculate weight and volumes from ALL order items combined
      let pesoTotal = 0;
      let totalVolumes = 0;
      const codigosItens = allOrderItems.map((i: any) => i.codigoItem).filter(Boolean) as string[];
      const uniqueCodigos = Array.from(new Set(codigosItens));

      const itemsBreakdown: Array<{
        codigo: string;
        descricao: string;
        qtd: number;
        unidade: string;
        pesoBrutoUn: number;
        fatorConv: number;
        pesoCx: number;
        pesoTotal: number;
        dimensoes: string;
        comprimento: number;
        largura: number;
        altura: number;
        volCxM3: number;
        cubagem: number;
      }> = [];

      if (uniqueCodigos.length > 0) {
        const stockData = await db.select({
          codigoItem: stockItems.codigoItem,
          pesoBruto: stockItems.pesoBruto,
          pesoLiquido: stockItems.pesoLiquido,
          unidadeMedida: stockItems.unidadeMedida,
          unidadeDeVendaFator: stockItems.unidadeDeVendaFator,
          unidadeDeVendaCodigo: stockItems.unidadeDeVendaCodigo,
          descricaoComplementar: stockItems.descricaoComplementar,
        }).from(stockItems)
          .where(inArray(stockItems.codigoItem, uniqueCodigos));

        const pesoBrutoMap = new Map<string, number>();
        for (const s of stockData) {
          // MUST use pesoBruto only (not pesoLiquido) for freight quoting per business rule
          const pesoBase = parseFloat(String(s.pesoBruto || 0));
          if (pesoBase > 0 && s.codigoItem) {
            pesoBrutoMap.set(s.codigoItem, pesoBase);
          }
        }

        for (const item of allOrderItems) {
          const qty = parseFloat(String(item.quantidade || 1));
          totalVolumes += qty;

          const stockItem = stockData.find((s: any) => s.codigoItem === item.codigoItem);
          const pesoBrutoPerUnit = pesoBrutoMap.get(item.codigoItem || "") || 0;
          const fator = parseFloat(String(stockItem?.unidadeDeVendaFator || 1)) || 1;
          let itemPesoTotal = 0;

          if (pesoBrutoPerUnit > 0) {
            const qtyUnidadeItem = parseFloat(String(item.quantidadeUnidadeItem || 0));
            const um = (stockItem?.unidadeMedida || '').toUpperCase().trim();
            const uvCodigo = (stockItem?.unidadeDeVendaCodigo || '').toUpperCase().trim();

            if (qtyUnidadeItem > 0 && qtyUnidadeItem > qty * 10) {
              itemPesoTotal = pesoBrutoPerUnit * qtyUnidadeItem;
            } else if (um === 'UN' && (uvCodigo === 'CX' || uvCodigo === 'PC') && fator > 1) {
              itemPesoTotal = pesoBrutoPerUnit * fator * qty;
            } else {
              itemPesoTotal = pesoBrutoPerUnit * qty;
            }
            pesoTotal += itemPesoTotal;
          }

          // Parse dimensions from descricaoComplementar using shared utility
          const dimStr = stockItem?.descricaoComplementar || "";
          let comprCm = 0, largCm = 0, altCm = 0;
          const parsedDims2 = parseDimensions(dimStr);
          if (parsedDims2) {
            comprCm = parsedDims2.comprimento;
            largCm = parsedDims2.largura;
            altCm = parsedDims2.altura;
          }
          const volCxM3 = comprCm > 0 ? (comprCm * largCm * altCm) / 1_000_000 : 0;
          const cubagem = volCxM3 * qty;

          itemsBreakdown.push({
            codigo: item.codigoItem || "",
            descricao: item.descricaoItem || "",
            qtd: qty,
            unidade: "CX",
            pesoBrutoUn: pesoBrutoPerUnit,
            fatorConv: fator,
            pesoCx: pesoBrutoPerUnit * fator,
            pesoTotal: itemPesoTotal,
            dimensoes: dimStr,
            comprimento: comprCm,
            largura: largCm,
            altura: altCm,
            volCxM3,
            cubagem,
          });
        }
      } else {
        totalVolumes = allOrderItems.reduce((sum: number, i: any) => sum + parseFloat(String(i.quantidade || 1)), 0);
      }

      if (pesoTotal <= 0) {
        pesoTotal = totalVolumes * 10;
      }

      const volumes = Math.max(1, Math.round(totalVolumes));
      const cubagemReal = itemsBreakdown.reduce((sum, i) => sum + i.cubagem, 0);
      const metroCubico = cubagemReal > 0 ? cubagemReal : volumes * 0.05;
      const maxAltura = Math.max(...itemsBreakdown.map(i => i.altura), 0) / 100;
      const maxComprimento = Math.max(...itemsBreakdown.map(i => i.comprimento), 0) / 100;
      const totalQty = itemsBreakdown.reduce((s, i) => s + i.qtd, 0) || 1;
      const avgLargura = itemsBreakdown.reduce((s, i) => s + i.largura * i.qtd, 0) / totalQty / 100;

      console.log(`[QuoteByMultiplePedidos] Pedidos #${pedidoLabels.join(", #")}: CEP=${cepDestino}, CNPJ=${cnpjDestinatario}, Valor=${valorMercadoria}, Peso=${pesoTotal}kg, Volumes=${volumes}, Cubagem=${metroCubico}m³`);

      // 4. Get customer data for Rodonaves
      let customerData: { nome: string; email: string; telefone: string; cep: string; logradouro: string; numero: string; complemento?: string; bairro: string; cidade: string; uf: string; inscricaoEstadual?: string } | undefined;
      if (cnpjDestinatario) {
        const [client] = await db.select()
          .from(vendorClients)
          .where(sql`REPLACE(REPLACE(REPLACE(${vendorClients.cnpjCpf}, '.', ''), '/', ''), '-', '') = ${cnpjDestinatario}`)
          .limit(1);
        if (client) {
          customerData = {
            nome: client.razaoSocial || client.nomeFantasia || "Cliente",
            email: client.emailNfe || client.email || "nfe@grupofox.com.br",
            telefone: client.telefone1 || client.telefone2 || "31999999999",
            cep: client.cep || cepDestino,
            logradouro: client.logradouro || "Rua",
            numero: client.numero || "S/N",
            complemento: client.complemento || undefined,
            bairro: client.bairro || "Centro",
            cidade: client.cidade || "",
            uf: client.uf || "",
            inscricaoEstadual: client.inscricaoEstadual || undefined,
          };
        }
      }

      // 5. Quote all 5 carriers in parallel
      const normalizeTipoContrib = (t: string) => {
        const upper = t.toUpperCase();
        if (upper.includes("NAO") || upper.includes("NÃO") || upper.includes("N")) return "Não Contribuinte";
        return "Contribuinte";
      };

      const [braspressResults, alfaResults, sswResults, rodonavesResults, florDeMinasResult] = await Promise.allSettled([
        cotarTodosCnpjs({
          cnpjDestinatario: cnpjDestinatario || "00000000000000",
          cepOrigem: "37264000",
          cepDestino,
          valorMercadoria,
          peso: pesoTotal,
          volumes,
          altura: maxAltura > 0 ? maxAltura : 0.5,
          largura: avgLargura > 0 ? avgLargura : 0.5,
          comprimento: maxComprimento > 0 ? maxComprimento : 0.5,
        }),
        quoteAllAlfaCnpjs({
          cepDestino,
          cepOrigem: "37264000",
          valorMercadoria,
          peso: pesoTotal,
          metroCubico,
          volumes,
          cnpjDestinatario,
        }),
        quoteAllSswCnpjsWithProtocol({
          cepOrigem: "37260000",
          cepDestino: cepDestino.replace(/\D/g, ""),
          valorNF: valorMercadoria,
          quantidade: volumes,
          peso: pesoTotal,
          cubagem: metroCubico,
          cnpjDestinatario,
          destContribuinte: normalizeTipoContrib(tipoContribuinte) === "Contribuinte" ? "S" : "N",
        }),
        quoteAllRodonavesCnpjs({
          cepOrigem: "37264000",
          cepDestino,
          valorMercadoria,
          peso: pesoTotal,
          volumes,
          cnpjDestinatario,
          customerData,
        }),
        quoteFlordeMinas({
          cepDestino,
          valorMercadoria,
          pesoKg: pesoTotal,
        }),
      ]);

      const carriers: Array<{
        transportadora: string;
        cnpj: string;
        totalFrete: number;
        prazo: string;
        protocolo?: string;
        error?: string;
      }> = [];

      // Process Braspress
      if (braspressResults.status === "fulfilled") {
        for (const r of braspressResults.value) {
          carriers.push({ transportadora: "Braspress", cnpj: r.cnpjUsado, totalFrete: r.totalFrete || 0, prazo: r.prazo ? `${r.prazo} dias úteis` : "N/A", protocolo: r.id ? String(r.id) : undefined, error: r.error });
        }
      } else {
        carriers.push({ transportadora: "Braspress", cnpj: "", totalFrete: 0, prazo: "N/A", error: braspressResults.reason?.message || "Erro" });
      }

      // Process Alfa
      if (alfaResults.status === "fulfilled") {
        for (const r of alfaResults.value) {
          carriers.push({ transportadora: "Alfa Transportes", cnpj: r.cnpj, totalFrete: r.totalFrete, prazo: r.prazo || "N/A", protocolo: r.protocolo || undefined, error: r.error });
        }
      } else {
        carriers.push({ transportadora: "Alfa Transportes", cnpj: "", totalFrete: 0, prazo: "N/A", error: alfaResults.reason?.message || "Erro" });
      }

      // Process Camilo (SSW)
      if (sswResults.status === "fulfilled") {
        for (const r of sswResults.value) {
          carriers.push({ transportadora: "Camilo dos Santos", cnpj: r.cnpj, totalFrete: r.totalFrete, prazo: r.prazo ? `${r.prazo} dias úteis` : "N/A", protocolo: r.protocolo || undefined, error: r.error });
        }
      } else {
        carriers.push({ transportadora: "Camilo dos Santos", cnpj: "", totalFrete: 0, prazo: "N/A", error: sswResults.reason?.message || "Erro" });
      }

      // Process Rodonaves
      if (rodonavesResults.status === "fulfilled") {
        for (const r of rodonavesResults.value) {
          carriers.push({ transportadora: "Rodonaves", cnpj: r.cnpj, totalFrete: r.totalFrete, prazo: r.prazo || "N/A", protocolo: r.protocolo ? String(r.protocolo) : undefined, error: r.error });
        }
      } else {
        carriers.push({ transportadora: "Rodonaves", cnpj: "", totalFrete: 0, prazo: "N/A", error: rodonavesResults.reason?.message || "Erro" });
      }

      // Process Flor de Minas
      if (florDeMinasResult.status === "fulfilled") {
        const r = florDeMinasResult.value;
        carriers.push({ transportadora: r.transportadora, cnpj: r.cnpj, totalFrete: r.totalFrete, prazo: r.prazo, error: r.error });
      } else {
        carriers.push({ transportadora: "Flor de Minas", cnpj: "", totalFrete: 0, prazo: "N/A", error: florDeMinasResult.reason?.message || "Erro" });
      }

      // Sort by lowest freight (errors at the end)
      carriers.sort((a, b) => {
        if (a.error && !b.error) return 1;
        if (!a.error && b.error) return -1;
        return a.totalFrete - b.totalFrete;
      });

      return {
        pedido: pedidoLabels.join(", "),
        pedidos: pedidoLabels,
        cliente: clienteName,
        cepDestino,
        cnpjDestinatario,
        valorMercadoria,
        pesoTotal,
        volumes,
        metroCubico,
        tipoContribuinte,
        carriers,
        itemsBreakdown,
        endereco: {
          logradouro: firstItem.enderecoLogradouro || "",
          numero: firstItem.enderecoNumero || "",
          bairro: firstItem.enderecoBairro || "",
          cidade: firstItem.enderecoCidade || "",
          uf: firstItem.uf || "",
        },
        dimensoes: {
          altura: maxAltura > 0 ? maxAltura : 0.5,
          largura: avgLargura > 0 ? avgLargura : 0.5,
          comprimento: maxComprimento > 0 ? maxComprimento : 0.5,
        },
      };
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
      tipoContribuinte: z.string().default("Contribuinte"),
      tipoProduto: z.enum(["importado", "industrializado"]).default("importado"),
      comissaoPercentual: z.number().min(0).max(100).optional(),
      sellerId: z.number().optional(),
      freteValor: z.number().min(0).default(0),
      gastosAdicionais: z.number().min(0).default(0),
      notaFiscalPercentual: z.number().min(0).max(100).default(100), // % da nota fiscal: 0=sem nota, 50=meia nota, 100=nota cheia
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
      
      // Timeout wrapper: if getRealTimeCosts takes > 15s, return empty array
      let realTimeCosts: any[] = [];
      try {
        realTimeCosts = await Promise.race([
          importCaller.getRealTimeCosts(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('getRealTimeCosts timeout')), 15000))
        ]);
      } catch (e) {
        console.warn('[calculateSalesCosts] getRealTimeCosts timed out or failed, proceeding without costs');
        realTimeCosts = [];
      }

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

      // Calculate taxes (full value first)
      const impostosCheia = calcularImpostos({
        valorVenda,
        ufDestino: input.ufDestino,
        tipoProduto: input.tipoProduto as TipoProduto,
        tipoContribuinte: normalizeTipoContribuinte(input.tipoContribuinte),
        faturamentoTrimestral,
      });

      // Apply nota fiscal percentage: adjusts taxes proportionally
      // 100% = nota cheia (impostos cheios), 50% = meia nota (metade dos impostos), 0% = sem nota (sem impostos)
      const notaFactor = (input.notaFiscalPercentual ?? 100) / 100;
      const impostos = {
        ...impostosCheia,
        icmsValor: impostosCheia.icmsValor * notaFactor,
        pisValor: impostosCheia.pisValor * notaFactor,
        cofinsValor: impostosCheia.cofinsValor * notaFactor,
        irpjValor: impostosCheia.irpjValor * notaFactor,
        csllValor: impostosCheia.csllValor * notaFactor,
        difalValor: impostosCheia.difalValor * notaFactor,
        totalImpostosValor: impostosCheia.totalImpostosValor * notaFactor,
        totalImpostosPerc: impostosCheia.totalImpostosPerc * notaFactor,
        notaFiscalPercentual: input.notaFiscalPercentual ?? 100,
      };

      // === AUTO COMMISSION CALCULATION ===
      // Step 1: Calculate margin WITH FIXED 5.85% commission to determine the price tier
      // Rule: The tier is determined by the margin calculated with the default fixed commission (5.85%)
      // This is the "1ª comissão" used during order assembly
      const comissaoFixaParaTier = valorVenda * 0.0585; // 5.85% fixed commission for tier determination
      const custosComComissaoFixa = custoMercadoriaTotal + input.freteValor + impostos.totalImpostosValor + input.gastosAdicionais + comissaoFixaParaTier;
      const lucroComComissaoFixa = valorVenda - custosComComissaoFixa;
      const margemParaTier = valorVenda > 0 ? (lucroComComissaoFixa / valorVenda) * 100 : 0;
      // Keep margemSemComissao for reference/display
      const custosSemComissao = custoMercadoriaTotal + input.freteValor + impostos.totalImpostosValor + input.gastosAdicionais;
      const lucroSemComissao = valorVenda - custosSemComissao;
      const margemSemComissao = valorVenda > 0 ? (lucroSemComissao / valorVenda) * 100 : 0;

      // Step 2: Determine price tier based on margin thresholds (using margin WITH 5.85% fixed commission)
      // Faixas (PDF RELATÓRIOSEMANAL): <15% = crítico, 15-18% = baixo (4%), 18-25% = médio (5%), 25-29% = médio-alto (6%), >=29% = mostrado_alto (7%)
      let autoTier: "baixo" | "medio" | "medio_alto" | "mostrado_alto" = "baixo";
      let margemCritica = false; // below 15% = commission locked at 4% + 1.85%
      if (margemParaTier >= 29) autoTier = "mostrado_alto";
      else if (margemParaTier >= 25) autoTier = "medio_alto";
      else if (margemParaTier >= 20) autoTier = "medio";
      else if (margemParaTier >= 15) autoTier = "baixo";
      else { autoTier = "baixo"; margemCritica = true; }

      // Step 3: Look up commission % from the matrix (always 120% meta for now)
      let autoComissaoPercentual = 0;
      let comissaoFonte = "manual";
      let mediaMensalVendedor: number | null = null;
      let podeFechar = true; // can the order be closed?
      if (margemCritica) {
        // Below 15% margin - check seller's monthly average
        if (input.sellerId) {
          // Calculate average margin of all approved/processed orders this month for this seller
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthOrders = await db.select({
            totalProdutos: salesOrderRequests.totalProdutos,
            totalPedido: salesOrderRequests.totalPedido,
          }).from(salesOrderRequests)
            .where(and(
              eq(salesOrderRequests.sellerId, input.sellerId),
              inArray(salesOrderRequests.status, ["aprovado", "processado"]),
              gte(salesOrderRequests.createdAt, startOfMonth),
            ));
          
          if (monthOrders.length > 0) {
            // Simple average: sum of (totalPedido - totalProdutos) / totalPedido for each order
            // This is a rough margin proxy (revenue - product cost) / revenue
            let totalMargemSum = 0;
            let validCount = 0;
            for (const o of monthOrders) {
              const tp = Number(o.totalPedido) || 0;
              const tprod = Number(o.totalProdutos) || 0;
              if (tp > 0) {
                // Use a rough margin: (totalPedido has all costs baked in from when order was created)
                // Actually totalPedido = total sale value, totalProdutos = sum of item prices
                // We need actual margin data - for now use the stored values
                totalMargemSum += ((tp - tprod) / tp) * 100;
                validCount++;
              }
            }
            mediaMensalVendedor = validCount > 0 ? totalMargemSum / validCount : 0;
          } else {
            mediaMensalVendedor = 0;
          }
          
          if (mediaMensalVendedor !== null && mediaMensalVendedor > 15) {
            // Monthly avg > 15%: allow order with commission locked at 4%
            autoComissaoPercentual = 4;
            comissaoFonte = "critico_liberado";
            podeFechar = true;
          } else {
            // Monthly avg <= 15%: order cannot be closed
            autoComissaoPercentual = 4;
            comissaoFonte = "critico_bloqueado";
            podeFechar = false;
          }
        } else {
          // No seller - can't check monthly avg, block by default
          autoComissaoPercentual = 0;
          comissaoFonte = "critico";
          podeFechar = false;
        }
      } else if (input.sellerId) {
        const sellerMatrixRow = await db.select().from(commissionMatrix)
          .where(and(
            eq(commissionMatrix.sellerId, input.sellerId),
            eq(commissionMatrix.metaPercent, 120),
            eq(commissionMatrix.priceTier, autoTier),
          )).limit(1);
        if (sellerMatrixRow.length > 0) {
          autoComissaoPercentual = Number(sellerMatrixRow[0].commissionPercent);
          comissaoFonte = "matriz_vendedor";
        } else {
          // Fallback 1: try gestor-specific matrix
          const sellerPerm = await db.select().from(sellerPermissions)
            .where(eq(sellerPermissions.id, input.sellerId)).limit(1);
          if (sellerPerm.length > 0) {
            const gestorMatrix = await db.select().from(commissionMatrix)
              .where(and(
                eq(commissionMatrix.gestorName, sellerPerm[0].gestorName),
                eq(commissionMatrix.metaPercent, 120),
                eq(commissionMatrix.priceTier, autoTier),
              )).limit(1);
            if (gestorMatrix.length > 0) {
              autoComissaoPercentual = Number(gestorMatrix[0].commissionPercent);
              comissaoFonte = "matriz_gestor";
            }
          }
          // Fallback 2: if still no commission found, use the default/first available matrix entry
          // This handles sellers whose gestor doesn't have specific entries in commission_matrix
          if (autoComissaoPercentual === 0) {
            const defaultMatrix = await db.select().from(commissionMatrix)
              .where(and(
                eq(commissionMatrix.metaPercent, 120),
                eq(commissionMatrix.priceTier, autoTier),
              )).limit(1);
            if (defaultMatrix.length > 0) {
              autoComissaoPercentual = Number(defaultMatrix[0].commissionPercent);
              comissaoFonte = "matriz_padrao";
            }
          }
        }
        // Comissão por pedido (2ª comissão): somar +1,85% dos vendedores internos do escritório
        // Esse 1,85% é a comissão dos vendedores internos que ganham sobre todos os pedidos
        if (autoComissaoPercentual > 0) {
          autoComissaoPercentual += 1.85;
        }
      }

      // Step 4: Use auto commission (manual override only if explicitly > 0)
      const comissaoPercentualFinal = (input.comissaoPercentual !== undefined && input.comissaoPercentual !== null && input.comissaoPercentual > 0)
        ? input.comissaoPercentual
        : autoComissaoPercentual;

      const comissaoValor = valorVenda * (comissaoPercentualFinal / 100);

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
          percentual: comissaoPercentualFinal,
          valor: comissaoValor,
          autoPercentual: autoComissaoPercentual,
          tier: autoTier,
          fonte: comissaoFonte,
          margemParaTier, // margem calculada com comissão fixa 5.85% (usada para determinar o tier)
          margemSemComissao, // margem sem nenhuma comissão (referência)
          critico: margemCritica,
          mediaMensalVendedor,
          podeFechar,
        },
        gastosAdicionais: input.gastosAdicionais,
        notaFiscalPercentual: input.notaFiscalPercentual ?? 100,
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

  // Per-product margin calculation for the margin bar indicator
  getProductMargins: publicProcedure
    .input(z.object({
      ufDestino: z.string().default("MG"),
      tipoContribuinte: z.string().default("Contribuinte"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { costMap: {} as Record<string, { cost: number; fonte: string; tipoProduto: string }>, taxBreakdownImportado: null as any, taxBreakdownIndustrializado: null as any };

      // Get real-time costs
      const { importRouter } = await import("./importRouter");
      const { createCallerFactory } = await import("./_core/trpc");
      const createCaller = createCallerFactory(importRouter);
      const importCaller = createCaller({ user: null, req: {} as any, res: {} as any });
      const realTimeCosts = await importCaller.getRealTimeCosts();

      // Get product type info from stock_items
      const stockTypeRows = await db.select({
        codigoItem: stockItems.codigoItem,
        grupoCodigo: stockItems.grupoCodigo,
        superGrupoCodigo: stockItems.superGrupoCodigo,
      }).from(stockItems);
      const productTypeMap: Record<string, string> = {};
      for (const row of stockTypeRows) {
        const sgc = row.superGrupoCodigo || "";
        const gc = row.grupoCodigo || "";
        if (sgc === "12") productTypeMap[row.codigoItem] = "importado";
        else if (sgc === "05") productTypeMap[row.codigoItem] = "industrializado";
        else if (sgc === "16" && (gc === "18" || gc === "19")) productTypeMap[row.codigoItem] = "industrializado";
        else productTypeMap[row.codigoItem] = "importado"; // default
      }

      // Build cost map with tipoProduto
      const costMap: Record<string, { cost: number; fonte: string; tipoProduto: string }> = {};
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
          costMap[item.codigoItem] = { cost, fonte, tipoProduto: productTypeMap[item.codigoItem] || "importado" };
        }
      }

      // Calculate tax breakdowns for BOTH product types at this UF
      const taxBreakdownImportado = calcularImpostos({
        valorVenda: 1000,
        ufDestino: input.ufDestino,
        tipoProduto: "importado",
        tipoContribuinte: normalizeTipoContribuinte(input.tipoContribuinte),
        faturamentoTrimestral: 0,
      });
      const taxBreakdownIndustrializado = calcularImpostos({
        valorVenda: 1000,
        ufDestino: input.ufDestino,
        tipoProduto: "industrializado",
        tipoContribuinte: normalizeTipoContribuinte(input.tipoContribuinte),
        faturamentoTrimestral: 0,
      });

      return {
        costMap,
        taxBreakdownImportado: {
          icms: taxBreakdownImportado.icmsEfetivo,
          pis: taxBreakdownImportado.pisEfetivo,
          cofins: taxBreakdownImportado.cofinsEfetiva,
          irpj: taxBreakdownImportado.irpjEfetivo,
          csll: taxBreakdownImportado.csllEfetiva,
          difal: taxBreakdownImportado.difalEfetivo,
          total: taxBreakdownImportado.totalImpostosPerc,
        },
        taxBreakdownIndustrializado: {
          icms: taxBreakdownIndustrializado.icmsEfetivo,
          pis: taxBreakdownIndustrializado.pisEfetivo,
          cofins: taxBreakdownIndustrializado.cofinsEfetiva,
          irpj: taxBreakdownIndustrializado.irpjEfetivo,
          csll: taxBreakdownIndustrializado.csllEfetiva,
          difal: taxBreakdownIndustrializado.difalEfetivo,
          total: taxBreakdownIndustrializado.totalImpostosPerc,
        },
      };
    }),

  /**
   * Level 3 Commission: Monthly Weighted-Average Margin
   * Calculates the seller's month-to-date weighted average margin across all orders.
   * Used to:
   * 1. Determine if a new order can be closed (monthly avg must stay >= 15%)
   * 2. Determine the definitive monthly commission tier
   * 
   * Logic: For each order in the month, recalculate margin using real-time costs,
   * then compute weighted average = sum(orderValue * orderMargin) / sum(orderValue)
   */
  getSellerMonthlyMargin: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      // Optional: include a "pending" order to simulate what happens if it's added
      pendingOrder: z.object({
        items: z.array(z.object({
          codigoItem: z.string(),
          quantidade: z.number(),
          precoUnitario: z.number(),
        })),
        ufDestino: z.string().default("MG"),
        tipoContribuinte: z.string().default("Contribuinte"),
        freteValor: z.number().default(0),
        gastosAdicionais: z.number().default(0),
      }).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Get seller info
      const [seller] = await db.select().from(sellerPermissions)
        .where(eq(sellerPermissions.id, input.sellerId));
      if (!seller) throw new Error("Vendedor não encontrado");

      // Get current month range (São Paulo timezone)
      const now = new Date();
      const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const monthStart = new Date(spNow.getFullYear(), spNow.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split("T")[0];

      // Get all non-simulation orders for this seller in the current month
      const orders = await db.select({
        id: salesOrderRequests.id,
        totalProdutos: salesOrderRequests.totalProdutos,
        totalPedido: salesOrderRequests.totalPedido,
        valorFrete: salesOrderRequests.valorFrete,
        uf: salesOrderRequests.uf,
        tipoContribuinte: salesOrderRequests.tipoContribuinte,
        status: salesOrderRequests.status,
        createdAt: salesOrderRequests.createdAt,
        clienteNome: salesOrderRequests.razaoSocial,
      }).from(salesOrderRequests)
        .where(and(
          eq(salesOrderRequests.sellerId, input.sellerId),
          sql`${salesOrderRequests.status} != 'simulacao'`,
          sql`${salesOrderRequests.createdAt} >= ${monthStartStr}`,
        ));

      // Get real-time costs (same as calculateSalesCosts)
      const { importRouter } = await import("./importRouter");
      const { createCallerFactory } = await import("./_core/trpc");
      const createCaller = createCallerFactory(importRouter);
      const importCaller = createCaller({ user: null, req: {} as any, res: {} as any });
      
      let realTimeCosts: any[] = [];
      try {
        realTimeCosts = await Promise.race([
          importCaller.getRealTimeCosts(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
        ]);
      } catch (e) {
        console.warn('[getSellerMonthlyMargin] getRealTimeCosts timed out');
      }

      // Build cost map
      const costMap = new Map<string, { cost: number; tipoProduto: string }>();
      // Get product type info
      const stockTypeRows = await db.select({
        codigoItem: stockItems.codigoItem,
        superGrupoCodigo: stockItems.superGrupoCodigo,
        grupoCodigo: stockItems.grupoCodigo,
      }).from(stockItems);
      const productTypeMap: Record<string, string> = {};
      for (const row of stockTypeRows) {
        const sgc = row.superGrupoCodigo || "";
        const gc = row.grupoCodigo || "";
        if (sgc === "12") productTypeMap[row.codigoItem] = "importado";
        else if (sgc === "05") productTypeMap[row.codigoItem] = "industrializado";
        else if (sgc === "16" && (gc === "18" || gc === "19")) productTypeMap[row.codigoItem] = "industrializado";
        else productTypeMap[row.codigoItem] = "importado";
      }
      for (const item of realTimeCosts) {
        let cost = 0;
        if (item.custoProjetado > 0 && item.temPatio) cost = item.custoProjetado;
        else if (item.custoReal > 0) cost = item.custoReal;
        else if (item.custoEstimativa > 0 && item.temNavegando) cost = item.custoEstimativa;
        if (cost > 0) {
          costMap.set(item.codigoItem, { cost, tipoProduto: productTypeMap[item.codigoItem] || "importado" });
        }
      }

      // Get quarterly revenue for IRPJ
      const quarterStart = new Date(spNow.getFullYear(), Math.floor(spNow.getMonth() / 3) * 3, 1);
      const quarterStartStr = quarterStart.toISOString().split("T")[0];
      const [revenueRow] = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${salesOrders.valorTotalPedido} AS DECIMAL(15,2))), 0)`,
      }).from(salesOrders)
        .where(sql`${salesOrders.dataEmissao} >= ${quarterStartStr}`);
      const faturamentoTrimestral = Number(revenueRow?.total || 0);

      // Calculate margin for each order
      const orderMargins: Array<{ orderId: number; valorPedido: number; margemPercentual: number; clienteNome: string; createdAt: string }> = [];

      for (const order of orders) {
        // Get items for this order
        const orderItems = await db.select().from(salesOrderRequestItems)
          .where(eq(salesOrderRequestItems.orderId, order.id));
        
        if (orderItems.length === 0) continue;

        const valorVenda = orderItems.reduce((sum, item) => sum + Number(item.precoUnitario) * Number(item.quantidade), 0);
        if (valorVenda <= 0) continue;

        // Calculate cost of goods
        let custoMercadoria = 0;
        for (const item of orderItems) {
          const costData = costMap.get(item.codigoItem);
          if (costData && costData.cost > 0) {
            custoMercadoria += costData.cost * Number(item.quantidade);
          }
        }

        // Calculate taxes
        const ufDest = order.uf || "MG";
        // Determine predominant product type for this order
        const importCount = orderItems.filter(i => (costMap.get(i.codigoItem)?.tipoProduto || "importado") === "importado").length;
        const tipoProduto = importCount >= orderItems.length / 2 ? "importado" : "industrializado";
        
        const impostos = calcularImpostos({
          valorVenda,
          ufDestino: ufDest,
          tipoProduto: tipoProduto as TipoProduto,
          tipoContribuinte: normalizeTipoContribuinte(order.tipoContribuinte),
          faturamentoTrimestral,
        });

        // Frete fixo de 13% até integração completa com transportadoras
        const fretePerc = 13;
        const freteValor = valorVenda * (fretePerc / 100);
        // Comissão base de 5,85% para cálculo da margem (antes do fechamento)
        const comissaoPerc = 5.85;
        const comissaoValor = valorVenda * (comissaoPerc / 100);
        const totalCustos = custoMercadoria + freteValor + comissaoValor + impostos.totalImpostosValor;
        const lucro = valorVenda - totalCustos;
        const margem = (lucro / valorVenda) * 100;

        orderMargins.push({
          orderId: order.id,
          valorPedido: valorVenda,
          margemPercentual: margem,
          clienteNome: order.clienteNome || 'Cliente',
          createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : '',
        });
      }

      // Calculate weighted average of existing orders
      let sumValueXMargin = orderMargins.reduce((sum, o) => sum + o.valorPedido * o.margemPercentual, 0);
      let sumValue = orderMargins.reduce((sum, o) => sum + o.valorPedido, 0);
      const currentMonthlyMargin = sumValue > 0 ? sumValueXMargin / sumValue : null;

      // If there's a pending order, simulate what happens if we add it
      let projectedMonthlyMargin: number | null = null;
      let pendingOrderMargin: number | null = null;
      let canCloseOrder = true;

      if (input.pendingOrder) {
        const po = input.pendingOrder;
        const valorVendaPending = po.items.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0);
        
        if (valorVendaPending > 0) {
          // Calculate pending order margin
          let custoMercPending = 0;
          for (const item of po.items) {
            const costData = costMap.get(item.codigoItem);
            if (costData && costData.cost > 0) {
              custoMercPending += costData.cost * item.quantidade;
            }
          }

          const importCountPending = po.items.filter(i => (costMap.get(i.codigoItem)?.tipoProduto || "importado") === "importado").length;
          const tipoProdutoPending = importCountPending >= po.items.length / 2 ? "importado" : "industrializado";

          const impostosPending = calcularImpostos({
            valorVenda: valorVendaPending,
            ufDestino: po.ufDestino,
            tipoProduto: tipoProdutoPending as TipoProduto,
            tipoContribuinte: normalizeTipoContribuinte(po.tipoContribuinte),
            faturamentoTrimestral,
          });

          // Frete fixo 13% + comissão 5,85% (consistente com cálculo mensal)
          const freteValorPending = valorVendaPending * (13 / 100);
          const comissaoValorPending = valorVendaPending * (5.85 / 100);
          const totalCustosPending = custoMercPending + freteValorPending + comissaoValorPending + impostosPending.totalImpostosValor + po.gastosAdicionais;
          const lucroPending = valorVendaPending - totalCustosPending;
          pendingOrderMargin = (lucroPending / valorVendaPending) * 100;

          // Project monthly margin including this order
          const newSumValueXMargin = sumValueXMargin + valorVendaPending * pendingOrderMargin;
          const newSumValue = sumValue + valorVendaPending;
          projectedMonthlyMargin = newSumValue > 0 ? newSumValueXMargin / newSumValue : pendingOrderMargin;

          // Block if projected monthly margin < 15%
          canCloseOrder = projectedMonthlyMargin >= 15;
        }
      }

      // Determine monthly commission tier based on current (or projected) margin
      // Faixas (PDF RELATÓRIOSEMANAL): <15% = crítico, 15-18% = baixo (4%), 18-25% = médio (5%), 25-29% = médio-alto (6%), >=29% = mostrado_alto (7%)
      const marginForTier = projectedMonthlyMargin ?? currentMonthlyMargin ?? 0;
      let monthlyTier: "baixo" | "medio" | "medio_alto" | "mostrado_alto" = "baixo";
      let monthlyMargemCritica = false;
      if (marginForTier >= 29) monthlyTier = "mostrado_alto";
      else if (marginForTier >= 25) monthlyTier = "medio_alto";
      else if (marginForTier >= 20) monthlyTier = "medio";
      else if (marginForTier >= 15) monthlyTier = "baixo";
      else { monthlyTier = "baixo"; monthlyMargemCritica = true; }

      // Look up commission from matrix (same logic as calculateSalesCosts)
      // NOTA: Comissão mensal (3ª comissão) NÃO soma +1,85% — é avaliação individual do vendedor de rua
      let monthlyComissaoPercentual = 0;
      if (!monthlyMargemCritica) {
        const sellerMatrixRow = await db.select().from(commissionMatrix)
          .where(and(
            eq(commissionMatrix.sellerId, input.sellerId),
            eq(commissionMatrix.metaPercent, 120),
            eq(commissionMatrix.priceTier, monthlyTier),
          )).limit(1);
        if (sellerMatrixRow.length > 0) {
          monthlyComissaoPercentual = Number(sellerMatrixRow[0].commissionPercent);
        } else {
          const gestorMatrix = await db.select().from(commissionMatrix)
            .where(and(
              eq(commissionMatrix.gestorName, seller.gestorName || ""),
              eq(commissionMatrix.metaPercent, 120),
              eq(commissionMatrix.priceTier, monthlyTier),
            )).limit(1);
          if (gestorMatrix.length > 0) {
            monthlyComissaoPercentual = Number(gestorMatrix[0].commissionPercent);
          } else {
            // Fallback: use default matrix entry when no seller/gestor specific entry exists
            const defaultMatrix = await db.select().from(commissionMatrix)
              .where(and(
                eq(commissionMatrix.metaPercent, 120),
                eq(commissionMatrix.priceTier, monthlyTier),
              )).limit(1);
            if (defaultMatrix.length > 0) {
              monthlyComissaoPercentual = Number(defaultMatrix[0].commissionPercent);
            }
          }
        }
      }

      return {
        sellerId: input.sellerId,
        sellerName: seller.sellerName,
        month: `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, '0')}`,
        totalOrders: orderMargins.length,
        totalValue: sumValue,
        currentMonthlyMargin, // null if no orders yet
        projectedMonthlyMargin, // null if no pending order provided
        pendingOrderMargin, // margin of the pending order alone
        canCloseOrder,
        monthlyTier,
        monthlyComissaoPercentual,
        monthlyMargemCritica,
        orderBreakdown: orderMargins.map(o => ({
          orderId: o.orderId,
          valor: o.valorPedido,
          margem: o.margemPercentual,
          clienteNome: o.clienteNome,
          createdAt: o.createdAt,
        })),
      };
    }),

  /**
   * Get seller monthly weighted average discount (compared to preço mostrado)
   * Used for the second commission bar (discount-based)
   * Rule: <20% = Alta(7%), 20-23% = Média-Alta(6%), 23-27% = Média(5%), 27-32% = Baixa(4%)
   */
  getSellerMonthlyDiscount: publicProcedure
    .input(z.object({ sellerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Get seller info
      const [seller] = await db.select().from(sellerPermissions)
        .where(eq(sellerPermissions.id, input.sellerId));
      if (!seller) throw new Error("Vendedor não encontrado");

      // Get current month range (São Paulo timezone)
      const now = new Date();
      const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const monthStart = new Date(spNow.getFullYear(), spNow.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split("T")[0];

      // Get all non-simulation orders for this seller in the current month
      const orders = await db.select({
        id: salesOrderRequests.id,
        status: salesOrderRequests.status,
      }).from(salesOrderRequests)
        .where(and(
          eq(salesOrderRequests.sellerId, input.sellerId),
          sql`${salesOrderRequests.status} != 'simulacao'`,
          sql`${salesOrderRequests.createdAt} >= ${monthStartStr}`,
        ));

      if (orders.length === 0) {
        return {
          sellerId: input.sellerId,
          sellerName: seller.sellerName,
          totalOrders: 0,
          avgDiscount: null,
          discountTier: null,
          discountComissao: null,
          itemBreakdown: [],
        };
      }

      // Get seller's price table
      let priceMap = new Map<string, number>(); // codigoItem -> precoMostrado
      const allTables = await db.select().from(priceTables);
      let matchedTable: typeof allTables[0] | undefined;
      // 1. Try direct mapping via priceTableCode field
      if (seller.priceTableCode) {
        matchedTable = allTables.find(t => t.codigo === seller.priceTableCode);
      }
      // 2. Fallback: match by seller name in table description
      if (!matchedTable) {
        const nameParts = seller.sellerName.toUpperCase().split(' ');
        matchedTable = allTables.find(t => {
          const desc = t.descricao.toUpperCase();
          return nameParts.some(part => part.length > 3 && desc.includes(part));
        });
      }
      if (matchedTable) {
        const items = await db.select({
          itemCodigo: priceTableItems.itemCodigo,
          preco: priceTableItems.preco,
        }).from(priceTableItems)
          .where(eq(priceTableItems.priceTableId, matchedTable.id));
        for (const item of items) {
          priceMap.set(item.itemCodigo, Number(item.preco));
        }
      }

      // Get all items from these orders
      const orderIds = orders.map(o => o.id);
      const allItems = await db.select({
        orderId: salesOrderRequestItems.orderId,
        codigoItem: salesOrderRequestItems.codigoItem,
        descricaoItem: salesOrderRequestItems.descricaoItem,
        quantidade: salesOrderRequestItems.quantidade,
        precoUnitario: salesOrderRequestItems.precoUnitario,
        totalItem: salesOrderRequestItems.totalItem,
      }).from(salesOrderRequestItems)
        .where(inArray(salesOrderRequestItems.orderId, orderIds));

      // Calculate weighted average discount
      let sumDiscountTimesValue = 0;
      let sumValue = 0;
      const itemBreakdown: Array<{ codigoItem: string; descricao: string; precoVendido: number; precoMostrado: number | null; desconto: number | null; valorTotal: number }> = [];

      for (const item of allItems) {
        const precoVendido = Number(item.precoUnitario);
        const valorTotal = Number(item.totalItem);
        const precoMostrado = priceMap.get(item.codigoItem) || null;

        let desconto: number | null = null;
        if (precoMostrado && precoMostrado > 0) {
          desconto = ((1 - precoVendido / precoMostrado) * 100);
          if (desconto < 0) desconto = 0; // Vendeu acima do mostrado = 0% desconto
          sumDiscountTimesValue += desconto * valorTotal;
          sumValue += valorTotal;
        }

        itemBreakdown.push({
          codigoItem: item.codigoItem,
          descricao: item.descricaoItem?.substring(0, 50) || "",
          precoVendido,
          precoMostrado,
          desconto,
          valorTotal,
        });
      }

      const avgDiscount = sumValue > 0 ? sumDiscountTimesValue / sumValue : null;

      // Determine tier based on average discount
      let discountTier: string | null = null;
      let discountComissao: number | null = null;
      if (avgDiscount !== null) {
        if (avgDiscount < 20) {
          discountTier = "alta";
          discountComissao = 7;
        } else if (avgDiscount <= 23) {
          discountTier = "media_alta";
          discountComissao = 6;
        } else if (avgDiscount <= 27) {
          discountTier = "media";
          discountComissao = 5;
        } else if (avgDiscount <= 32) {
          discountTier = "baixa";
          discountComissao = 4;
        } else {
          discountTier = "critico";
          discountComissao = 4; // cap at 4% even above 32%
        }
      }

      return {
        sellerId: input.sellerId,
        sellerName: seller.sellerName,
        totalOrders: orders.length,
        avgDiscount: avgDiscount !== null ? Math.round(avgDiscount * 100) / 100 : null,
        discountTier,
        discountComissao,
        itemBreakdown: itemBreakdown.slice(0, 50), // limit for performance
      };
    }),

  /**
   * Verify manager password to override monthly margin block
   * Checks against operator passwords (only active managers can override)
   */
  verifyManagerPassword: publicProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, operatorName: null };
      // Check against active operator passwords
      const opRows = await db.select().from(operators)
        .where(and(
          eq(operators.password, input.password),
          eq(operators.active, true)
        )).limit(1);
      if (opRows.length > 0) {
        return { success: true, operatorName: opRows[0].name };
      }
      // Fallback: check admin_password in settings
      const adminRows = await db.select().from(appSettings)
        .where(eq(appSettings.settingKey, "admin_password")).limit(1);
      const adminPwd = adminRows.length > 0 ? adminRows[0].settingValue : null;
      if (adminPwd && input.password === adminPwd) {
        return { success: true, operatorName: "Admin" };
      }
      return { success: false, operatorName: null };
    }),

  /** Update a pending order (seller can edit while awaiting gestor approval) */
  updateOrder: publicProcedure
    .input(z.object({
      orderId: z.number(),
      cnpjCpf: z.string(),
      razaoSocial: z.string(),
      nomeFantasia: z.string().optional(),
      inscricaoEstadual: z.string().optional(),
      tipoContribuinte: z.string().optional(),
      regimeTributario: z.string().optional(),
      emailNfe: z.string().optional(),
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
      segmento: z.string().optional(),
      nomeContato: z.string().optional(),
      formaCobranca: z.string().optional(),
      fornecedorAtual: z.string().optional(),
      inscricaoMunicipal: z.string().optional(),
      inscricaoSuframa: z.string().optional(),
      situacaoFiscalEspecial: z.string().optional(),
      cnaeFiscal: z.string().optional(),
      website: z.string().optional(),
      limiteCredito: z.string().optional(),
      tabelaPrecos: z.string().optional(),
      condicaoPagamento: z.string().optional(),
      valorFrete: z.number().optional(),
      tipoFrete: z.string().optional(),
      observacoes: z.string().optional(),
      operacaoFiscal: z.string().optional(),
      naturezaOperacao: z.string().optional(),
      estadoConfiguravel: z.string().optional(),
      formaPagamento: z.string().optional(),
      meioPagamento: z.string().optional(),
      dataEntrega: z.string().optional(),
      previsaoEntrega: z.string().optional(),
      regiao: z.string().optional(),
      perfil: z.string().optional(),
      formaPedido: z.string().optional(),
      produtos: z.string().optional(),
      probabilidadeNegocio: z.string().optional(),
      tamanho: z.string().optional(),
      atencao: z.string().optional(),
      situacaoCobranca: z.string().optional(),
      possuiRedespacho: z.boolean().optional(),
      redespachoCnpj: z.string().optional(),
      redespachoRazaoSocial: z.string().optional(),
      redespachoCep: z.string().optional(),
      redespachoLogradouro: z.string().optional(),
      redespachoNumero: z.string().optional(),
      redespachoComplemento: z.string().optional(),
      redespachoBairro: z.string().optional(),
      redespachoCidade: z.string().optional(),
      redespachoUf: z.string().optional(),
      redespachoTelefone: z.string().optional(),
      enderecoEntregaMesmo: z.boolean().optional(),
      entregaCep: z.string().optional(),
      entregaLogradouro: z.string().optional(),
      entregaNumero: z.string().optional(),
      entregaComplemento: z.string().optional(),
      entregaBairro: z.string().optional(),
      entregaCidade: z.string().optional(),
      entregaUf: z.string().optional(),
      entregaTelefone: z.string().optional(),
      items: z.array(z.object({
        codigoItem: z.string(),
        descricaoItem: z.string(),
        quantidade: z.number(),
        unidadeMedida: z.string(),
        precoUnitario: z.number(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Verify order exists and is editable (pendente, rejeitado, or aprovado_subgestor for gestor review)
      const [order] = await db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.id, input.orderId));
      if (!order) throw new Error("Pedido não encontrado");
      if (order.status !== "pendente" && order.status !== "rejeitado" && order.status !== "aprovado_subgestor") {
        throw new Error("Pedido já foi aprovado e não pode ser editado");
      }

      // Calculate totals and price validation
      const itemsWithValidation = await Promise.all(input.items.map(async (item) => {
        const totalItem = item.quantidade * item.precoUnitario;
        // Check minimum price
        const minPriceRows = await db.select().from(productMinPrices)
          .where(eq(productMinPrices.codigoItem, item.codigoItem))
          .limit(1);
        const precoMinimo = minPriceRows.length > 0 ? Number(minPriceRows[0].precoMinimo) : null;
        const abaixoDoMinimo = precoMinimo !== null && item.precoUnitario < precoMinimo;
        return { ...item, totalItem, precoMinimo, abaixoDoMinimo };
      }));

      const totalProdutos = itemsWithValidation.reduce((sum, i) => sum + i.totalItem, 0);
      const valorFrete = input.valorFrete || 0;
      const totalPedido = totalProdutos; // Frete NÃO é somado ao valor do pedido
      const temPrecoAbaixoMinimo = itemsWithValidation.some(i => i.abaixoDoMinimo);

      // Update order fields
      await db.update(salesOrderRequests)
        .set({
          cnpjCpf: input.cnpjCpf,
          razaoSocial: input.razaoSocial,
          nomeFantasia: input.nomeFantasia || null,
          inscricaoEstadual: input.inscricaoEstadual || null,
          tipoContribuinte: input.tipoContribuinte || null,
          regimeTributario: input.regimeTributario || null,
          emailNfe: input.emailNfe || null,
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
          nomeContato: input.nomeContato || null,
          formaCobranca: input.formaCobranca || null,
          fornecedorAtual: input.fornecedorAtual || null,
          inscricaoMunicipal: input.inscricaoMunicipal || null,
          inscricaoSuframa: input.inscricaoSuframa || null,
          situacaoFiscalEspecial: input.situacaoFiscalEspecial || null,
          cnaeFiscal: input.cnaeFiscal || null,
          website: input.website || null,
          limiteCredito: input.limiteCredito || null,
          tabelaPrecos: input.tabelaPrecos || null,
          condicaoPagamento: input.condicaoPagamento || null,
          valorFrete: String(valorFrete),
          tipoFrete: input.tipoFrete || null,
          observacoes: input.observacoes || null,
          operacaoFiscal: input.operacaoFiscal || null,
          naturezaOperacao: input.naturezaOperacao || null,
          estadoConfiguravel: input.estadoConfiguravel || null,
          formaPagamento: input.formaPagamento || null,
          meioPagamento: input.meioPagamento || null,
          dataEntrega: input.dataEntrega || null,
          previsaoEntrega: input.previsaoEntrega || null,
          regiao: input.regiao || null,
          perfil: input.perfil || null,
          formaPedido: input.formaPedido || null,
          produtos: input.produtos || null,
          probabilidadeNegocio: input.probabilidadeNegocio || null,
          tamanho: input.tamanho || null,
          atencao: input.atencao || null,
          situacaoCobranca: input.situacaoCobranca || null,
          possuiRedespacho: input.possuiRedespacho || false,
          redespachoCnpj: input.redespachoCnpj || null,
          redespachoRazaoSocial: input.redespachoRazaoSocial || null,
          redespachoCep: input.redespachoCep || null,
          redespachoLogradouro: input.redespachoLogradouro || null,
          redespachoNumero: input.redespachoNumero || null,
          redespachoComplemento: input.redespachoComplemento || null,
          redespachoBairro: input.redespachoBairro || null,
          redespachoCidade: input.redespachoCidade || null,
          redespachoUf: input.redespachoUf || null,
          redespachoTelefone: input.redespachoTelefone || null,
          enderecoEntregaMesmo: input.enderecoEntregaMesmo ?? true,
          entregaCep: input.entregaCep || null,
          entregaLogradouro: input.entregaLogradouro || null,
          entregaNumero: input.entregaNumero || null,
          entregaComplemento: input.entregaComplemento || null,
          entregaBairro: input.entregaBairro || null,
          entregaCidade: input.entregaCidade || null,
          entregaUf: input.entregaUf || null,
          entregaTelefone: input.entregaTelefone || null,
          totalProdutos: String(totalProdutos),
          totalPedido: String(totalPedido),
          temPrecoAbaixoMinimo,
          motivoAlerta: temPrecoAbaixoMinimo ? itemsWithValidation.filter(i => i.abaixoDoMinimo).map(i => `${i.descricaoItem}: R$ ${i.precoUnitario.toFixed(2)} (mín: R$ ${i.precoMinimo?.toFixed(2)})`).join("; ") : null,
          // Reset status to pendente if it was rejected (re-edited)
          status: "pendente",
          motivoRejeicao: null,
        })
        .where(eq(salesOrderRequests.id, input.orderId));

      // Delete old items and insert new ones
      await db.delete(salesOrderRequestItems)
        .where(eq(salesOrderRequestItems.orderId, input.orderId));

      for (const item of itemsWithValidation) {
        await db.insert(salesOrderRequestItems).values({
          orderId: input.orderId,
          codigoItem: item.codigoItem,
          descricaoItem: item.descricaoItem,
          quantidade: String(item.quantidade),
          unidadeMedida: item.unidadeMedida || "CX", // Grupo Fox: default sempre caixa
          precoUnitario: String(item.precoUnitario),
          precoMinimo: item.precoMinimo !== null ? String(item.precoMinimo) : null,
          totalItem: String(item.totalItem),
          abaixoDoMinimo: item.abaixoDoMinimo,
        });
      }

      // Update notification
      try {
        const { createNotification } = await import("./notificationRouter");
        await createNotification({
          type: "pedido_vendedor",
          title: `Pedido #${order.orderNumber} Editado - ${order.sellerName}`,
          message: `Pedido #${order.orderNumber} foi editado pelo vendedor ${order.sellerName}. Total: R$ ${totalPedido.toFixed(2)} (${input.items.length} itens)`,
          severity: temPrecoAbaixoMinimo ? "warning" : "info",
          metadata: { orderId: input.orderId, sellerName: order.sellerName, gestorName: order.gestorName, clientName: input.razaoSocial, totalPedido, status: "pendente", orderNumber: order.orderNumber },
        });
      } catch (err) {
        console.error("[SalesOrder] Failed to create edit notification:", err);
      }

      return { success: true, orderId: input.orderId, orderNumber: order.orderNumber };
    }),

  // ===== LOT ASSIGNMENT (Tela 2 - Seleção de Lote no Pedido) =====

  /** Listar lotes disponíveis para um produto específico (com saldo > 0) */
  getAvailableLotsForItem: publicProcedure
    .input(z.object({
      codigoItem: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { productionLots } = await import("../drizzle/schema");
      // Mostrar todos os lotes com saldo > 0 (sem filtro por SKU - operador escolhe livremente)
      return db.select().from(productionLots)
        .where(sql`CAST(${productionLots.saldoAtual} AS DECIMAL(18,2)) > 0`)
        .orderBy(desc(productionLots.createdAt));
    }),

  /** Atribuir lotes a um pedido (baixa automática do saldo) */
  assignLotsToOrder: publicProcedure
    .input(z.object({
      orderId: z.number().optional(),
      pedidoNumero: z.string().optional(),
      assignments: z.array(z.object({
        lotId: z.number(),
        codigoLote: z.string(),
        codigoItem: z.string(),
        descricaoItem: z.string().optional(),
        qtdCaixas: z.number().positive(),
      })),
      atribuidoPor: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      if (!input.orderId && !input.pedidoNumero) throw new Error("orderId ou pedidoNumero é obrigatório");
      const { orderLotAssignments, productionLots } = await import("../drizzle/schema");

      // Validate all lots have enough balance first
      for (const assignment of input.assignments) {
        const lot = await db.select().from(productionLots)
          .where(eq(productionLots.id, assignment.lotId)).limit(1);
        if (lot.length === 0) throw new Error(`Lote ${assignment.codigoLote} não encontrado`);
        const saldo = parseFloat(String(lot[0].saldoAtual));
        if (assignment.qtdCaixas > saldo) {
          throw new Error(`Lote ${assignment.codigoLote}: quantidade (${assignment.qtdCaixas}) excede saldo disponível (${saldo})`);
        }
      }

      // Insert assignments and deduct balances
      for (const assignment of input.assignments) {
        await db.insert(orderLotAssignments).values({
          orderId: input.orderId || null,
          pedidoNumero: input.pedidoNumero || null,
          lotId: assignment.lotId,
          codigoLote: assignment.codigoLote,
          codigoItem: assignment.codigoItem,
          descricaoItem: assignment.descricaoItem || null,
          qtdCaixas: String(assignment.qtdCaixas),
          atribuidoPor: input.atribuidoPor,
        });

        // Deduct from lot balance
        const lot = await db.select().from(productionLots)
          .where(eq(productionLots.id, assignment.lotId)).limit(1);
        const currentBalance = parseFloat(String(lot[0].saldoAtual));
        const newBalance = currentBalance - assignment.qtdCaixas;
        await db.update(productionLots)
          .set({ saldoAtual: String(newBalance) })
          .where(eq(productionLots.id, assignment.lotId));
      }

      return { success: true };
    }),

  /** Listar lotes atribuídos a um pedido */
  getOrderLotAssignments: publicProcedure
    .input(z.object({
      orderId: z.number().optional(),
      pedidoNumero: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (!input.orderId && !input.pedidoNumero) return [];
      const { orderLotAssignments } = await import("../drizzle/schema");
      const condition = input.pedidoNumero
        ? eq(orderLotAssignments.pedidoNumero, input.pedidoNumero)
        : eq(orderLotAssignments.orderId, input.orderId!);
      return db.select().from(orderLotAssignments)
        .where(condition)
        .orderBy(desc(orderLotAssignments.createdAt));
    }),

  /** Remover atribuição de lote (devolver saldo) */
  removeLotAssignment: publicProcedure
    .input(z.object({
      assignmentId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const { orderLotAssignments, productionLots } = await import("../drizzle/schema");

      // Get the assignment
      const assignment = await db.select().from(orderLotAssignments)
        .where(eq(orderLotAssignments.id, input.assignmentId)).limit(1);
      if (assignment.length === 0) throw new Error("Atribuição não encontrada");

      // Return balance to lot
      const lot = await db.select().from(productionLots)
        .where(eq(productionLots.id, assignment[0].lotId)).limit(1);
      if (lot.length > 0) {
        const currentBalance = parseFloat(String(lot[0].saldoAtual));
        const returnQty = parseFloat(String(assignment[0].qtdCaixas));
        await db.update(productionLots)
          .set({ saldoAtual: String(currentBalance + returnQty) })
          .where(eq(productionLots.id, assignment[0].lotId));
      }

      // Delete assignment
      await db.delete(orderLotAssignments)
        .where(eq(orderLotAssignments.id, input.assignmentId));

      return { success: true };
    }),

  /**
   * Get last order items for a client (for "Repetir Último Pedido" feature)
   * Checks app orders first, then Maxiprod orders
   */
  getLastOrderItems: publicProcedure
    .input(z.object({
      clientName: z.string().min(1),
      cnpjCpf: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], source: null as string | null, orderDate: null as string | null, pedidoNumber: null as string | null };

      const clientNameLower = input.clientName.toLowerCase();

      // 1. Check app orders (sales_order_requests) first
      const appOrderConditions = [];
      if (input.cnpjCpf) {
        appOrderConditions.push(eq(salesOrderRequests.cnpjCpf, input.cnpjCpf));
      } else {
        appOrderConditions.push(
          or(
            sql`LOWER(${salesOrderRequests.razaoSocial}) LIKE ${`%${clientNameLower}%`}`,
            sql`LOWER(${salesOrderRequests.nomeFantasia}) LIKE ${`%${clientNameLower}%`}`
          )!
        );
      }

      const lastAppOrder = await db.select({
        id: salesOrderRequests.id,
        createdAt: salesOrderRequests.createdAt,
        status: salesOrderRequests.status,
      })
      .from(salesOrderRequests)
      .where(and(
        ...appOrderConditions,
        sql`${salesOrderRequests.status} NOT IN ('rejeitado')`
      ))
      .orderBy(desc(salesOrderRequests.createdAt))
      .limit(1);

      if (lastAppOrder.length > 0) {
        const orderId = lastAppOrder[0].id;
        const orderItems = await db.select({
          codigoItem: salesOrderRequestItems.codigoItem,
          descricaoItem: salesOrderRequestItems.descricaoItem,
          quantidade: salesOrderRequestItems.quantidade,
          precoUnitario: salesOrderRequestItems.precoUnitario,
          unidadeMedida: salesOrderRequestItems.unidadeMedida,
        })
        .from(salesOrderRequestItems)
        .where(eq(salesOrderRequestItems.orderId, orderId));

        return {
          items: orderItems.map(i => ({
            codigoItem: i.codigoItem,
            descricaoItem: typeof i.descricaoItem === 'string' ? i.descricaoItem : '',
            quantidade: Number(i.quantidade),
            precoUnitario: Number(i.precoUnitario),
            unidadeMedida: "CX", // Grupo Fox: todos os produtos são vendidos em caixa
          })),
          source: "app",
          orderDate: lastAppOrder[0].createdAt?.toISOString() || null,
          pedidoNumber: null,
        };
      }

      // 2. Check Maxiprod orders (sales_orders)
      const maxiprodOrders = await db.select({
        pedido: salesOrders.pedido,
        dataEmissao: salesOrders.dataEmissao,
        codigoItem: salesOrders.codigoItem,
        descricaoItem: salesOrders.descricaoItem,
        quantidade: salesOrders.quantidade,
        valorUnitario: salesOrders.valorUnitario,
        unidadeMedidaCodigo: salesOrders.unidadeMedidaCodigo,
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
      .limit(100);

      if (maxiprodOrders.length === 0) {
        return { items: [], source: null, orderDate: null, pedidoNumber: null };
      }

      // Get the most recent pedido number and all its items
      const latestPedido = maxiprodOrders[0].pedido;
      const latestDate = maxiprodOrders[0].dataEmissao;
      const latestItems = maxiprodOrders.filter(o => o.pedido === latestPedido && o.codigoItem);

      return {
        items: latestItems.map(i => ({
          codigoItem: i.codigoItem || "",
          descricaoItem: typeof i.descricaoItem === 'string' ? i.descricaoItem : (typeof i.descricaoItem === 'object' ? '' : String(i.descricaoItem || '')),
          quantidade: Number(i.quantidade || 1),
          precoUnitario: Number(i.valorUnitario || 0),
          unidadeMedida: "CX", // Grupo Fox: todos os produtos são vendidos em caixa
        })),
        source: "maxiprod",
        orderDate: latestDate || null,
        pedidoNumber: latestPedido || null,
      };
    }),

  // ===== FREIGHT SIMULATION PERSISTENCE =====
  /** Save freight simulation results to DB */
  saveFreightSimulation: publicProcedure
    .input(z.object({
      orderId: z.number().optional(),
      cepDestino: z.string(),
      cnpjDestinatario: z.string().optional(),
      valorMercadoria: z.number(),
      pesoTotal: z.number(),
      volumes: z.number(),
      cubagemTotal: z.number(),
      tipoContribuinte: z.string().optional(),
      results: z.any(), // JSON array of quotes
      operatorId: z.number().optional(),
      operatorName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [inserted] = await db!.insert(freightSimulations).values({
        orderId: input.orderId || null,
        cepDestino: input.cepDestino,
        cnpjDestinatario: input.cnpjDestinatario || null,
        valorMercadoria: String(input.valorMercadoria),
        pesoTotal: String(input.pesoTotal),
        volumes: input.volumes,
        cubagemTotal: String(input.cubagemTotal),
        tipoContribuinte: input.tipoContribuinte || null,
        results: input.results,
        operatorId: input.operatorId || null,
        operatorName: input.operatorName || null,
      });
      return { id: inserted.insertId };
    }),

  /** Get latest freight simulation for an order (by CEP + CNPJ combo) */
  getFreightSimulation: publicProcedure
    .input(z.object({
      cepDestino: z.string(),
      cnpjDestinatario: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const conditions = [sql`${freightSimulations.cepDestino} = ${input.cepDestino}`];
      if (input.cnpjDestinatario) {
        conditions.push(sql`${freightSimulations.cnpjDestinatario} = ${input.cnpjDestinatario}`);
      }
      const [result] = await db!.select()
        .from(freightSimulations)
        .where(sql`${sql.join(conditions, sql` AND `)}`) 
        .orderBy(sql`${freightSimulations.createdAt} DESC`)
        .limit(1);
      return result || null;
    }),

  /** Mark a freight simulation as selected (when user clicks 'Usar') */
  selectFreightCarrier: publicProcedure
    .input(z.object({
      simulationId: z.number(),
      selectedTransportadora: z.string(),
      selectedCnpj: z.string().optional(),
      selectedValor: z.number(),
      selectedProtocolo: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db!.update(freightSimulations)
        .set({
          selectedTransportadora: input.selectedTransportadora,
          selectedCnpj: input.selectedCnpj || null,
          selectedValor: String(input.selectedValor),
          selectedProtocolo: input.selectedProtocolo,
          updatedAt: new Date(),
        })
        .where(sql`${freightSimulations.id} = ${input.simulationId}`);
      return { success: true };
    }),

  /** Update PDF URL for a freight simulation */
  updateFreightSimulationPdf: publicProcedure
    .input(z.object({
      simulationId: z.number(),
      pdfUrl: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db!.update(freightSimulations)
        .set({ pdfUrl: input.pdfUrl, updatedAt: new Date() })
        .where(sql`${freightSimulations.id} = ${input.simulationId}`);
      return { success: true };
    }),

  /** Get freight simulation history (for a specific CEP or all) */
  getFreightSimulationHistory: publicProcedure
    .input(z.object({
      cepDestino: z.string().optional(),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      let query = db!.select().from(freightSimulations);
      if (input.cepDestino) {
        query = query.where(sql`${freightSimulations.cepDestino} = ${input.cepDestino}`) as any;
      }
      const results = await (query as any)
        .orderBy(sql`${freightSimulations.createdAt} DESC`)
        .limit(input.limit);
      return results;
    }),

  /**
   * checkClientMaxiprodStatus - Verifica se o cliente existe no Maxiprod
   * Retorna: 'novo' | 'cadastrado' | 'alterado' + detalhes das alterações
   */
  checkClientMaxiprodStatus: publicProcedure
    .input(z.object({ cnpjCpf: z.string().optional(), clientId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { status: "desconhecido" as const, changes: [] as string[] };

      let client: any = null;
      if (input.clientId) {
        const [row] = await db.select().from(vendorClients)
          .where(eq(vendorClients.id, input.clientId)).limit(1);
        client = row;
      } else if (input.cnpjCpf) {
        const cnpjLimpo = input.cnpjCpf.replace(/[^\d]/g, "");
        if (cnpjLimpo.length >= 11) {
          const [row] = await db.select().from(vendorClients)
            .where(sql`REPLACE(REPLACE(REPLACE(${vendorClients.cnpjCpf}, '.', ''), '-', ''), '/', '') = ${cnpjLimpo}`)
            .limit(1);
          client = row;
        }
      }

      if (!client) {
        return { status: "novo" as const, changes: [] as string[] };
      }

      if (!client.maxiprodId) {
        return { status: "novo" as const, changes: [] as string[] };
      }

      // Has maxiprodId = exists in Maxiprod
      // Check if it was modified after sync
      if (client.lastModifiedBy && client.lastModifiedBy !== "SYNC_MAXIPROD") {
        // Was modified by someone other than the sync
        // Fetch the original Maxiprod data to compare
        // We'll do a quick comparison by checking updatedAt vs the sync
        const changes: string[] = [];
        if (client.lastModifiedBy) {
          changes.push(`Última alteração por: ${client.lastModifiedBy}`);
        }
        if (client.updatedAt) {
          changes.push(`Modificado em: ${new Date(client.updatedAt).toLocaleDateString("pt-BR")}`);
        }
        return { status: "alterado" as const, changes, modifiedBy: client.lastModifiedBy };
      }

      return { status: "cadastrado" as const, changes: [] as string[] };
    }),

  /**
   * checkBulkClientMaxiprodStatus - Verifica status Maxiprod de múltiplos clientes de uma vez
   */
  checkBulkClientMaxiprodStatus: publicProcedure
    .input(z.object({ cnpjs: z.array(z.string()) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return {} as Record<string, { status: "novo" | "cadastrado" | "alterado"; modifiedBy?: string }>;

      if (input.cnpjs.length === 0) return {};

      // Get all vendor_clients that match these CNPJs
      const allClients = await db.select({
        cnpjCpf: vendorClients.cnpjCpf,
        maxiprodId: vendorClients.maxiprodId,
        lastModifiedBy: vendorClients.lastModifiedBy,
      }).from(vendorClients)
        .where(sql`REPLACE(REPLACE(REPLACE(${vendorClients.cnpjCpf}, '.', ''), '-', ''), '/', '') IN (${sql.join(input.cnpjs.map(c => sql`${c.replace(/[^\d]/g, "")}`), sql`, `)})`);

      const result: Record<string, { status: "novo" | "cadastrado" | "alterado"; modifiedBy?: string }> = {};
      
      // Map by cleaned CNPJ
      const clientMap = new Map<string, typeof allClients[0]>();
      for (const c of allClients) {
        const clean = (c.cnpjCpf || "").replace(/[^\d]/g, "");
        if (clean) clientMap.set(clean, c);
      }

      for (const cnpj of input.cnpjs) {
        const clean = cnpj.replace(/[^\d]/g, "");
        const client = clientMap.get(clean);
        if (!client || !client.maxiprodId) {
          result[clean] = { status: "novo" };
        } else if (client.lastModifiedBy && client.lastModifiedBy !== "SYNC_MAXIPROD") {
          result[clean] = { status: "alterado", modifiedBy: client.lastModifiedBy };
        } else {
          result[clean] = { status: "cadastrado" };
        }
      }

      return result;
    }),
});
