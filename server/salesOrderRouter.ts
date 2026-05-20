import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { salesOrderRequests, salesOrderRequestItems, productMinPrices, sellerPermissions, stockItems, sellerProductVisibility, purchaseOrderItems, salesOrders } from "../drizzle/schema";
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

  /** Search clients from existing sales_orders + sales_order_requests for autocomplete */
  searchClients: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const q = input.query.trim();

      // 1. Search in previous sales_order_requests (manual orders from app)
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
          like(salesOrderRequests.razaoSocial, `%${q}%`),
          like(salesOrderRequests.nomeFantasia, `%${q}%`),
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
          like(salesOrders.cliente, `%${q}%`),
          like(salesOrders.clienteApelido, `%${q}%`),
          like(salesOrders.razaoSocial, `%${q}%`)
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

      // 3. Merge: manual orders first (more complete data), then Maxiprod
      const seen = new Set<string>();
      const results: typeof fromManualOrders = [];

      // Add manual order clients first (they have CNPJ and full data)
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
          alertMotivos.push(`${item.descricaoItem}: R$ ${item.precoUnitario.toFixed(2)} < mín R$ ${minPrice!.toFixed(2)}`);
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

  /** Get orders for a specific seller (seller app) */
  getSellerOrders: publicProcedure
    .input(z.object({ sellerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db.select().from(salesOrderRequests)
        .where(eq(salesOrderRequests.sellerId, input.sellerId))
        .orderBy(desc(salesOrderRequests.createdAt))
        .limit(50);
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
});
