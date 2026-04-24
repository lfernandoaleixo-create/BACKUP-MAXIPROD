import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { dashboardData, scraperStatus, salesOrders, semiProntoStock, aguardandoEscolhaStock, madeiraStock, stockEditHistory } from "../drizzle/schema";
import { sql, desc, eq, and, gte } from "drizzle-orm";
import { runGraphQLSync, testGraphQLConnection, getSyncProgress, syncBankBalances } from "./maxiprodGraphQL";
import { isSchedulerRunning } from "./scheduler";
import { processStockData } from "./stockProcessor";
import { getEcommerceTransferHistoryData, getPendingEcommerceTransfers } from "./ecommerceHistory";
import { getEcommerceMadeiraHistoryData } from "./ecommerceMadeiraHistory";
import { getIndustrializedBaixaHistory } from "./industrializedBaixa";
import { salesRouter } from "./salesRouter";
import { settingsRouter } from "./settingsRouter";
import { financialRouter } from "./financialRouter";
import { billingRouter } from "./billingRouter";
import { notificationRouter } from "./notificationRouter";
import { productionRouter } from "./productionRouter";

export const appRouter = router({
  system: systemRouter,
  sales: salesRouter,
  settings: settingsRouter,
  financial: financialRouter,
  billing: billingRouter,
  notifications: notificationRouter,
  production: productionRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Dashboard data endpoints (public - accessible by all sales team)
  dashboard: router({
    /**
     * Get processed dashboard data for all companies
     */
    getData: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { items: [], lastSync: null };
      
      const data = await db.select().from(dashboardData);
      const status = await db.select().from(scraperStatus).limit(1);
      
      let items: any[] = [];
      if (data.length > 0) {
        try {
          items = JSON.parse(data[0].dataJson as string);
        } catch {
          items = [];
        }
      }
      
      return {
        items,
        lastSync: status[0]?.lastSyncAt || null,
        empresa: data[0]?.empresa || "PALITOS INDUSTRIA",
      };
    }),

    /**
     * Get connection status and last sync info
     */
    getStatus: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) {
        return {
          isConnected: false,
          lastSyncAt: null,
          lastSyncStatus: "not_initialized",
          lastError: null,
          needsMfa: false,
        };
      }
      
      const status = await db.select().from(scraperStatus).limit(1);
      if (status.length === 0) {
        return {
          isConnected: false,
          lastSyncAt: null,
          lastSyncStatus: "not_initialized",
          lastError: null,
          needsMfa: false,
        };
      }
      
      return {
        isConnected: status[0].isConnected,
        lastSyncAt: status[0].lastSyncAt,
        lastSyncStatus: status[0].lastSyncStatus,
        lastError: status[0].lastError,
        needsMfa: false, // GraphQL doesn't need MFA
      };
    }),

    /**
     * Force full sync via GraphQL API
     * SOMENTE LEITURA - only fetches data, never modifies Maxiprod
     */
    forceSync: publicProcedure.mutation(async () => {
      const result = await runGraphQLSync();
      return {
        success: result.success,
        message: result.success
          ? `Sincronizado: ${result.counts?.stock} estoque, ${result.counts?.openOrders} pedidos, ${result.counts?.purchaseOrders} POs, ${result.counts?.salesOrders} vendas`
          : result.error || "Erro na sincronização",
        counts: result.counts,
      };
    }),

    /**
     * Get real-time sync progress
     */
    getSyncProgress: publicProcedure.query(() => {
      return getSyncProgress();
    }),

    /**
     * Test GraphQL API connection
     */
    testConnection: publicProcedure.query(async () => {
      return await testGraphQLConnection();
    }),

    /**
     * Sync bank balances from accounting ledger (balancete contábil)
     * SOMENTE LEITURA - fetches contasContabeis + lancamentosContabeis
     */
    syncBankBalances: publicProcedure.mutation(async () => {
      try {
        const result = await syncBankBalances();
        return {
          success: true,
          message: `Saldos atualizados: ${result.accounts} contas`,
          accounts: result.accounts,
          totalSaldo: result.totalSaldo,
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || 'Erro ao sincronizar saldos bancários',
          accounts: 0,
          totalSaldo: 0,
        };
      }
    }),

    /**
     * Get scheduler status (every 5 min, business hours)
     */
    getSchedulerStatus: publicProcedure.query(() => {
      return {
        isRunning: isSchedulerRunning(),
        schedule: "A cada 5 min, seg-sex 7h-18h (Brasília)",
        timezone: "America/Sao_Paulo",
      };
    }),


    /**
     * Reprocess dashboard data from existing raw data in DB
     * (does not fetch new data from Maxiprod)
     */
    reprocess: publicProcedure.mutation(async () => {
      await processStockData();
      return { success: true };
    }),

    /**
     * Get average sales price (últimas 5 vendas) per product description
     * Used for stock valuation: preço médio x estoque
     */
    getAvgSalesPrices: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { prices: {} };

      // --- Helper: extract product type from description ---
      function extractTipo(d: string): string {
        const u = d.toUpperCase();
        if (u.includes('VARETA') && u.includes('FIBRA')) return 'VARETA_FIBRA';
        if (u.includes('VARETA') && u.includes('AROMATIZADOR')) return 'VARETA_AROMA';
        if (u.includes('VARETA') && (u.includes('ALGODAO') || u.includes('ALGODÃO'))) return 'VARETA_ALGODAO';
        if (u.includes('VARETA') && (u.includes('MULTIUSO') || u.includes('MULTI-USO'))) return 'VARETA_MULTI';
        if (u.includes('ESPETO') && u.includes('TEPPO')) return 'TEPPO';
        if (u.includes('ESPETO') && u.includes('QUEIJO')) return 'ESPETO_QUEIJO';
        if (u.includes('ESPETO') && u.includes('KAFTA')) return 'KAFTA';
        if (u.includes('ESPETO')) return 'ESPETO';
        if (u.includes('PALITO') && u.includes('UNHA')) return 'PALITO_UNHA';
        if (u.includes('PALITO') && u.includes('MANICURE')) return 'MANICURE';
        if (u.includes('PALITO') && u.includes('DENTE')) return 'PALITO_DENTE';
        if (u.includes('PALITO') && u.includes('HASHI')) return 'HASHI';
        if (u.includes('MADEIRA')) return 'MADEIRA';
        if (u.includes('VARETA')) return 'VARETA';
        return 'OUTRO';
      }

      // --- Helper: extract medida pattern ---
      function extractMedida(d: string): string | null {
        const u = d.toUpperCase();
        const m = u.match(/(\d+[,.]\d+)\s*[*xX]\s*(\d+)\s*MM/);
        if (m) return m[1].replace('.', ',') + 'x' + m[2];
        const m2 = u.match(/(\d+)\s*[xX]\s*(\d+)\s*[xX]\s*(\d+)/);
        if (m2) return m2[1] + 'x' + m2[2] + 'x' + m2[3];
        return null;
      }

      // Mapping: stock types that sell under different names
      const TYPE_ALIASES: Record<string, string[]> = {
        'PALITO_UNHA': ['PALITO_UNHA', 'MANICURE'],
        'MANICURE': ['MANICURE', 'PALITO_UNHA'],
        'VARETA': ['VARETA', 'VARETA_AROMA', 'VARETA_ALGODAO'],
        'VARETA_ALGODAO': ['VARETA_ALGODAO', 'VARETA'],
      };

      // Get all sales ordered by date desc
      // REGRA DE NEGÓCIO: Excluir pedidos em "Digitação" - não são confirmados
      const allSales = await db
        .select({
          descricao: salesOrders.descricao,
          valorUnitario: salesOrders.valorUnitario,
          dataEmissao: salesOrders.dataEmissao,
        })
        .from(salesOrders)
        .where(and(
          sql`${salesOrders.valorUnitario} > 0`,
          sql`(${salesOrders.estadoNota} IS NULL OR UPPER(${salesOrders.estadoNota}) NOT IN ('DIGITAÇÃO', 'DIGITACAO'))`
        ))
        .orderBy(desc(salesOrders.dataEmissao));

      // Build sales index by tipo+medida
      const salesByKey = new Map<string, number[]>();
      for (const row of allSales) {
        if (!row.descricao || !row.valorUnitario) continue;
        const tipo = extractTipo(row.descricao);
        const med = extractMedida(row.descricao);
        if (!med) continue;
        const key = tipo + '|' + med;
        const existing = salesByKey.get(key);
        if (existing) {
          if (existing.length < 5) existing.push(parseFloat(String(row.valorUnitario)));
        } else {
          salesByKey.set(key, [parseFloat(String(row.valorUnitario))]);
        }
      }

      // Also build exact-match index by description
      const salesByDesc = new Map<string, number[]>();
      for (const row of allSales) {
        if (!row.descricao || !row.valorUnitario) continue;
        const existing = salesByDesc.get(row.descricao);
        if (existing) {
          if (existing.length < 5) existing.push(parseFloat(String(row.valorUnitario)));
        } else {
          salesByDesc.set(row.descricao, [parseFloat(String(row.valorUnitario))]);
        }
      }

      // Get all stock items
      const { stockItems } = await import('../drizzle/schema');
      const allStock = await db
        .select({ descricaoItem: stockItems.descricaoItem })
        .from(stockItems);
      const stockDescs = Array.from(new Set(allStock.map(s => s.descricaoItem).filter(Boolean))) as string[];

      // Match each stock item to sales prices
      const prices: Record<string, { avgPrice: number; salesCount: number }> = {};

      for (const stockDesc of stockDescs) {
        // 1. Try exact description match first
        if (salesByDesc.has(stockDesc)) {
          const vals = salesByDesc.get(stockDesc)!;
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          prices[stockDesc] = { avgPrice: Math.round(avg * 100) / 100, salesCount: vals.length };
          continue;
        }

        // 2. Try tipo+medida match with aliases
        const tipo = extractTipo(stockDesc);
        const med = extractMedida(stockDesc);
        if (!med) continue;

        const typesToTry = TYPE_ALIASES[tipo] || [tipo];
        let bestVals: number[] | null = null;

        for (const t of typesToTry) {
          const key = t + '|' + med;
          if (salesByKey.has(key)) {
            const vals = salesByKey.get(key)!;
            if (!bestVals || vals.length > bestVals.length) {
              bestVals = vals;
            }
          }
        }

        if (bestVals) {
          const avg = bestVals.reduce((a, b) => a + b, 0) / bestVals.length;
          prices[stockDesc] = { avgPrice: Math.round(avg * 100) / 100, salesCount: bestVals.length };
        }
      }

      return { prices };
    }),

    /**
     * Get semi pronto stock (manual, informational only)
     */
    getSemiProntoStock: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { items: [] };
      const rows = await db.select().from(semiProntoStock);
      return { items: rows };
    }),

    /**
     * Update semi pronto stock quantity for a single item (with history)
     */
    updateSemiProntoStock: publicProcedure
      .input(z.object({
        codigoItem: z.string(),
        quantidade: z.number().min(0),
        operatorName: z.string(),
        descricaoItem: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        
        // Get current value
        const existing = await db.select().from(semiProntoStock).where(eq(semiProntoStock.codigoItem, input.codigoItem));
        const valorAnterior = existing.length > 0 ? parseFloat(String(existing[0].quantidade)) : 0;
        
        // Record history
        await db.insert(stockEditHistory).values({
          card: "semiPronto",
          codigoItem: input.codigoItem,
          descricaoItem: input.descricaoItem || null,
          valorAnterior: String(valorAnterior),
          valorNovo: String(input.quantidade),
          operador: input.operatorName,
          tipo: "alteracao",
        });
        
        // Upsert: insert or update
        await db.insert(semiProntoStock)
          .values({
            codigoItem: input.codigoItem,
            quantidade: String(input.quantidade),
            updatedBy: input.operatorName,
          })
          .onDuplicateKeyUpdate({
            set: {
              quantidade: sql`${String(input.quantidade)}`,
              updatedBy: input.operatorName,
            },
          });
        
        return { success: true };
      }),
    /**
     * Get aguardando escolha stock (manual, informational only)
     */
    getAguardandoEscolhaStock: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { items: [] };
      const rows = await db.select().from(aguardandoEscolhaStock);
      return { items: rows };
    }),

    /**
     * Update aguardando escolha stock quantity for a single item (with history)
     */
    updateAguardandoEscolhaStock: publicProcedure
      .input(z.object({
        codigoItem: z.string(),
        quantidade: z.number().min(0),
        operatorName: z.string(),
        descricaoItem: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        
        // Get current value
        const existing = await db.select().from(aguardandoEscolhaStock).where(eq(aguardandoEscolhaStock.codigoItem, input.codigoItem));
        const valorAnterior = existing.length > 0 ? parseFloat(String(existing[0].quantidade)) : 0;
        
        // Record history
        await db.insert(stockEditHistory).values({
          card: "aguardandoEscolha",
          codigoItem: input.codigoItem,
          descricaoItem: input.descricaoItem || null,
          valorAnterior: String(valorAnterior),
          valorNovo: String(input.quantidade),
          operador: input.operatorName,
          tipo: "alteracao",
        });
        
        await db.insert(aguardandoEscolhaStock)
          .values({
            codigoItem: input.codigoItem,
            quantidade: String(input.quantidade),
            updatedBy: input.operatorName,
          })
          .onDuplicateKeyUpdate({
            set: {
              quantidade: sql`${String(input.quantidade)}`,
              updatedBy: input.operatorName,
            },
          });
        
        return { success: true };
      }),

    /**
     * Get madeira (produto acabado) stock
     */
    getMadeiraStock: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { items: [] };
      const rows = await db.select().from(madeiraStock);
      return { items: rows };
    }),

    /**
     * Update madeira stock.
     * Maria tem permissão para aumentar E reduzir manualmente.
     * Outros operadores só podem aumentar (redução bloqueada).
     */
    updateMadeiraStock: publicProcedure
      .input(z.object({
        codigoItem: z.string(),
        quantidade: z.number().min(0),
        operatorName: z.string(),
        descricaoItem: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        
        // Get current value
        const existing = await db.select().from(madeiraStock).where(eq(madeiraStock.codigoItem, input.codigoItem));
        const valorAnterior = existing.length > 0 ? parseFloat(String(existing[0].quantidade)) : 0;
        
        // Operadores autorizados a reduzir estoque de Madeira PA
        const REDUCTION_ALLOWED_OPERATORS = ["Maria", "Guilherme", "Fernando"];
        const canReduce = REDUCTION_ALLOWED_OPERATORS.some(
          op => input.operatorName.toLowerCase() === op.toLowerCase()
        );
        
        // RULE: Redução só permitida para operadores autorizados
        if (input.quantidade < valorAnterior && !canReduce) {
          // Record attempted reduction
          await db.insert(stockEditHistory).values({
            card: "madeira",
            codigoItem: input.codigoItem,
            descricaoItem: input.descricaoItem || null,
            valorAnterior: String(valorAnterior),
            valorNovo: String(input.quantidade),
            operador: input.operatorName,
            tipo: "tentativa_reducao",
          });
          return { success: false, error: "reduction_blocked", operador: input.operatorName };
        }
        
        // Record history
        await db.insert(stockEditHistory).values({
          card: "madeira",
          codigoItem: input.codigoItem,
          descricaoItem: input.descricaoItem || null,
          valorAnterior: String(valorAnterior),
          valorNovo: String(input.quantidade),
          operador: input.operatorName,
          tipo: "alteracao",
        });
        
        await db.insert(madeiraStock)
          .values({
            codigoItem: input.codigoItem,
            quantidade: String(input.quantidade),
            updatedBy: input.operatorName,
          })
          .onDuplicateKeyUpdate({
            set: {
              quantidade: sql`${String(input.quantidade)}`,
              updatedBy: input.operatorName,
            },
          });
        
        return { success: true };
      }),

    /**
     * Get stock edit history for a specific card.
     * REGRA: NUNCA apagar histórico. Retorna todo o histórico disponível (sem filtro de data).
     */
    getStockEditHistory: publicProcedure
      .input(z.object({
        card: z.enum(["madeira", "semiPronto", "aguardandoEscolha"]),
        codigoItem: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { history: [] };
        
        const conditions = [eq(stockEditHistory.card, input.card)];
        if (input.codigoItem) {
          conditions.push(eq(stockEditHistory.codigoItem, input.codigoItem));
        }
        
        const rows = await db.select().from(stockEditHistory)
          .where(and(...conditions))
          .orderBy(desc(stockEditHistory.createdAt))
          .limit(500);
        
        return { history: rows };
      }),

    /**
     * Histórico de transferências E-commerce
     * Retorna todas as movimentações de saída para filial E-commerce
     */
    getEcommerceHistory: publicProcedure
      .input(z.object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        codigoItem: z.string().optional(),
        pedido: z.string().optional(),
        searchText: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const results = await getEcommerceTransferHistoryData(input || undefined);
        return { history: results };
      }),

    /**
     * Histórico de transferências E-commerce (Industrialização/Madeira)
     * Retorna todas as movimentações de saída para filial E-commerce de produtos de madeira
     */
    getEcommerceHistoryMadeira: publicProcedure
      .input(z.object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        codigoItem: z.string().optional(),
        pedido: z.string().optional(),
        searchText: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const results = await getEcommerceMadeiraHistoryData(input || undefined);
        return { history: results };
      }),

    /**
     * Pedidos E-commerce pendentes (não faturados)
     * Mostra card de alerta no estoque de importação
     */
    getPendingEcommerceTransfers: publicProcedure
      .query(async () => {
        return await getPendingEcommerceTransfers();
      }),

    /**
     * Histórico de baixas automáticas de industrializados faturados
     * Retorna todas as baixas aplicadas ao estoque de madeira
     */
    getIndustrializedBaixaHistory: publicProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        codigoItem: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await getIndustrializedBaixaHistory(input || undefined);
      }),
  }),
});

export type AppRouter = typeof appRouter;
