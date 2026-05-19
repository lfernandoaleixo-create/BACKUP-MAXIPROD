import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { salesOrderRequests, salesOrderRequestItems, productMinPrices, sellerPermissions, stockItems } from "../drizzle/schema";
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

  /** Search clients from existing sales_orders for autocomplete */
  searchClients: publicProcedure
    .input(z.object({ query: z.string().min(2) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      // Search in previous sales_order_requests for client data
      const fromOrders = await db.select({
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
          like(salesOrderRequests.razaoSocial, `%${input.query}%`),
          like(salesOrderRequests.nomeFantasia, `%${input.query}%`),
          like(salesOrderRequests.cnpjCpf, `%${input.query}%`)
        )
      )
      .orderBy(desc(salesOrderRequests.createdAt))
      .limit(20);

      // Deduplicate by CNPJ (keep most recent)
      const seen = new Set<string>();
      const unique: typeof fromOrders = [];
      for (const row of fromOrders) {
        if (!seen.has(row.cnpjCpf)) {
          seen.add(row.cnpjCpf);
          unique.push(row);
        }
      }
      return unique.slice(0, 10);
    }),

  // ===== PRODUCT LIST WITH MIN PRICES =====

  /** Get available products with min prices for the seller */
  getProductsForSeller: publicProcedure
    .input(z.object({ sellerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Get stock items with available quantity
      const items = await db.select({
        codigoItem: stockItems.codigoItem,
        descricaoItem: stockItems.descricaoItem,
        quantidade: stockItems.quantidade,
        unidadeMedida: stockItems.unidadeMedida,
        unidadeDeVendaFator: stockItems.unidadeDeVendaFator,
      })
      .from(stockItems)
      .where(sql`CAST(${stockItems.quantidade} AS DECIMAL) > 0`);

      // Get min prices
      const prices = await db.select().from(productMinPrices);
      const priceMap = new Map(prices.map(p => [p.codigoItem, p.precoMinimo]));

      return items.map(item => ({
        codigoItem: item.codigoItem,
        descricaoItem: item.descricaoItem,
        disponivel: item.quantidade,
        unidadeMedida: item.unidadeMedida,
        unidadeDeVendaFator: item.unidadeDeVendaFator,
        precoMinimo: priceMap.get(item.codigoItem) || null,
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
