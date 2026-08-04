import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { productionSectors, productionMachines, productionEntries, dashboardData, stockItems, madeiraStock, stockEditHistory, pirografiaEntries, productionLots, lotMovements, productCatalog, retroactiveLotRequests, queijoCoalhoStock, queijoCoalhoStockHistory } from "../drizzle/schema";
import { count } from "drizzle-orm";
import { eq, and, or, sql, desc, gte, lte, inArray, ne } from "drizzle-orm";

/** Status válidos para máquinas de produção */
export const MACHINE_STATUS_OPTIONS = [
  { value: "producao_normal", label: "Produção Normal", color: "#10b981" },
  { value: "falta_madeira", label: "Falta de Madeira", color: "#ef4444" },
  { value: "producao_nao_necessaria", label: "Produção Não Necessária", color: "#f59e0b" },
  { value: "manutencao", label: "Manutenção", color: "#6366f1" },
  { value: "manutencao_pontual", label: "Manutenção Pontual", color: "#8b5cf6" },
  { value: "producao_encerrada", label: "Produção Encerrada", color: "#64748b" },
] as const;

/** Tipos de madeira para Multilamina (setor 1) */
export const WOOD_TYPE_OPTIONS = [
  { value: "benazzi", label: "Benazzi", color: "#d97706" },
  { value: "madeira_dura", label: "Madeira Dura", color: "#059669" },
] as const;

/** Medidas de madeira para Vareteira (setor 2) */
export const WOOD_MEASURE_OPTIONS = [
  { value: "150mm", label: "150mm", color: "#0ea5e9" },
  { value: "180mm", label: "180mm", color: "#06b6d4" },
  { value: "200mm", label: "200mm", color: "#14b8a6" },
  { value: "218mm", label: "218mm", color: "#10b981" },
  { value: "250mm", label: "250mm", color: "#22c55e" },
  { value: "300mm", label: "300mm", color: "#84cc16" },
  { value: "350mm", label: "350mm", color: "#eab308" },
] as const;

/** Round to 5 decimal places to avoid floating-point drift in stock arithmetic */
function roundDec(n: number): number {
  return Math.round(n * 100000) / 100000;
}

export const productionRouter = router({
  getSectors: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const sectors = await db.select().from(productionSectors).orderBy(productionSectors.ordem);
    const machines = await db.select().from(productionMachines).orderBy(productionMachines.ordem);
    return sectors.map(s => ({
      ...s,
      machines: machines.filter(m => m.sectorId === s.id),
    }));
  }),

  getEntries: publicProcedure
    .input(z.object({
      data: z.string().optional(),
      sectorId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const targetDate = input.data || new Date().toISOString().slice(0, 10);
      const conditions = [eq(productionEntries.data, targetDate)];
      if (input.sectorId) {
        conditions.push(eq(productionEntries.sectorId, input.sectorId));
      }
      return db
        .select()
        .from(productionEntries)
        .where(and(...conditions))
        .orderBy(productionEntries.sectorId, productionEntries.machineId);
    }),

  /**
   * Lançar ou atualizar produção.
   * A chave de upsert agora é: sectorId + machineId + data + tipoMadeira
   * Isso permite múltiplos registros por máquina/dia quando há diferentes tipos/medidas.
   */
  upsertEntry: publicProcedure
    .input(z.object({
      sectorId: z.number(),
      machineId: z.number().nullable(),
      data: z.string(),
      quantidade: z.number().min(0),
      status: z.string().optional().default(""),
      tipoMadeira: z.string().optional(), // valor único: "benazzi", "madeira_dura", "150mm", etc.
      observacoes: z.string().optional(),
      lancadoPor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [
        eq(productionEntries.sectorId, input.sectorId),
        eq(productionEntries.data, input.data),
      ];
      if (input.machineId) {
        conditions.push(eq(productionEntries.machineId, input.machineId));
      } else {
        conditions.push(sql`${productionEntries.machineId} IS NULL`);
      }
      // tipoMadeira is part of the upsert key
      if (input.tipoMadeira) {
        conditions.push(eq(productionEntries.tipoMadeira, input.tipoMadeira));
      } else {
        conditions.push(sql`${productionEntries.tipoMadeira} IS NULL`);
      }

      const existing = await db
        .select()
        .from(productionEntries)
        .where(and(...conditions))
        .limit(1);

      let entryId: number;
      let entryAction: string;
      let previousQty = 0;

      if (existing.length > 0) {
        previousQty = roundDec(parseFloat(String(existing[0].quantidade)) || 0);
        await db
          .update(productionEntries)
          .set({
            quantidade: String(input.quantidade),
            status: input.status || "",
            observacoes: input.observacoes || null,
            lancadoPor: input.lancadoPor || null,
          })
          .where(eq(productionEntries.id, existing[0].id));
        entryId = existing[0].id;
        entryAction = "updated";
      } else {
        const result = await db.insert(productionEntries).values({
          sectorId: input.sectorId,
          machineId: input.machineId,
          data: input.data,
          quantidade: String(input.quantidade),
          status: input.status || "",
          tipoMadeira: input.tipoMadeira || null,
          observacoes: input.observacoes || null,
          lancadoPor: input.lancadoPor || null,
        });
        entryId = result[0].insertId;
        entryAction = "created";
      }

      // ─── Embalagem (setor sem máquina) com data >= 15/04/2026 alimenta estoque Madeira PA ───
      // AUTO-FEED REATIVADO em 16/04/2026: lançamentos de produção da Maria alimentam estoque Madeira PA automaticamente.
      const MADEIRA_STOCK_AUTO_FEED_DISABLED = false; // Reativado por solicitação do Guilherme
      const STOCK_CUTOFF_DATE = "2026-04-15";
      if (
        input.machineId === null &&
        input.tipoMadeira &&
        input.data >= STOCK_CUTOFF_DATE
      ) {
        // Verificar se este setor é realmente Embalagem (tipoEquipamento = "nenhum")
        const sectorRows = await db.select().from(productionSectors).where(eq(productionSectors.id, input.sectorId)).limit(1);
        const isEmbalagem = sectorRows.length > 0 && sectorRows[0].tipoEquipamento === "nenhum";

        if (isEmbalagem) {
          const codigoItem = input.tipoMadeira; // Na embalagem, tipoMadeira armazena o codigoItem
          const diff = roundDec(input.quantidade - previousQty);

          if (diff !== 0) {
            // ─── Check if this is a Queijo Coalho product (Palitos Premium) ───
            const QUEIJO_COALHO_CODES = ["00648", "00546", "00547", "00577", "00645", "00646", "00647"];
            const isQueijCoalho = QUEIJO_COALHO_CODES.includes(codigoItem);

            if (isQueijCoalho) {
              // Auto-feed Queijo Coalho: atualiza estoque_processado E abate do estoque_maxiprod
              const qcRows = await db.select().from(queijoCoalhoStock).where(eq(queijoCoalhoStock.codigoItem, codigoItem));
              const currentProcessado = roundDec(qcRows.length > 0 ? parseFloat(String(qcRows[0].estoqueProcessado)) : 0);
              const currentMaxiprod = roundDec(qcRows.length > 0 ? parseFloat(String(qcRows[0].estoqueMaxiprod)) : 0);
              const newProcessado = roundDec(Math.max(0, currentProcessado + diff));
              // Abater do estoque Maxiprod: quando processa, sai da matéria-prima
              const newMaxiprod = roundDec(Math.max(0, currentMaxiprod - diff));

              // Record history - processado
              await db.insert(queijoCoalhoStockHistory).values({
                codigoItem,
                campo: "estoque_processado",
                valorAnterior: String(currentProcessado),
                valorNovo: String(newProcessado),
                operador: `Produção (${input.lancadoPor || "Sistema"})`,
                observacao: `Embalagem Palitos Premium: ${diff > 0 ? "+" : ""}${diff} cx`,
              });

              // Record history - maxiprod deduction
              if (diff > 0) {
                await db.insert(queijoCoalhoStockHistory).values({
                  codigoItem,
                  campo: "estoque_maxiprod",
                  valorAnterior: String(currentMaxiprod),
                  valorNovo: String(newMaxiprod),
                  operador: `Produção (${input.lancadoPor || "Sistema"})`,
                  observacao: `Abatido do Maxiprod (embalagem): -${diff} cx`,
                });
              }

              // Upsert queijo coalho stock (processado + maxiprod)
              await db.insert(queijoCoalhoStock)
                .values({
                  codigoItem,
                  estoqueProcessado: String(newProcessado),
                  estoqueMaxiprod: String(newMaxiprod),
                  updatedBy: `Produção (${input.lancadoPor || "Sistema"})`,
                })
                .onDuplicateKeyUpdate({
                  set: {
                    estoqueProcessado: sql`${String(newProcessado)}`,
                    estoqueMaxiprod: sql`${String(newMaxiprod)}`,
                    updatedBy: `Produção (${input.lancadoPor || "Sistema"})`,
                  },
                });
            } else {
              // Madeira PA auto-feed (existing logic)
              // Get current stock value (para registro no histórico)
              const stockRows = await db.select().from(madeiraStock).where(eq(madeiraStock.codigoItem, codigoItem));
              const currentStock = roundDec(stockRows.length > 0 ? parseFloat(String(stockRows[0].quantidade)) : 0);
              const newStock = roundDec(Math.max(0, currentStock + diff));

              // Record history (SEMPRE registra, mesmo com auto-feed desabilitado)
              await db.insert(stockEditHistory).values({
                card: "madeira",
                codigoItem,
                descricaoItem: null,
                valorAnterior: String(currentStock),
                valorNovo: String(newStock),
                operador: `Produção (${input.lancadoPor || "Sistema"})`,
                tipo: "alteracao",
              });

              // Upsert stock
              if (!MADEIRA_STOCK_AUTO_FEED_DISABLED) {
                await db.insert(madeiraStock)
                  .values({
                    codigoItem,
                    quantidade: String(newStock),
                    updatedBy: `Produção (${input.lancadoPor || "Sistema"})`,
                  })
                  .onDuplicateKeyUpdate({
                    set: {
                      quantidade: sql`${String(newStock)}`,
                      updatedBy: `Produção (${input.lancadoPor || "Sistema"})`,
                    },
                  });
              }
            }
          }
        }
      }

      return { id: entryId, action: entryAction };
    }),

  /**
   * Batch upsert: salvar múltiplos registros de uma vez (para quando há vários tipos/medidas selecionados).
   * Also cleans up old variant entries that are no longer selected.
   */
  batchUpsertEntries: publicProcedure
    .input(z.object({
      sectorId: z.number(),
      machineId: z.number().nullable(),
      data: z.string(),
      entries: z.array(z.object({
        sectorId: z.number(),
        machineId: z.number().nullable(),
        data: z.string(),
        quantidade: z.number().min(0),
        status: z.string().optional().default(""),
        tipoMadeira: z.string().optional(),
        observacoes: z.string().optional(),
        lancadoPor: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const results: { tipoMadeira: string | null; action: string }[] = [];

      // 1. Find all existing entries for this machine/day
      const existingConditions = [
        eq(productionEntries.sectorId, input.sectorId),
        eq(productionEntries.data, input.data),
      ];
      if (input.machineId) {
        existingConditions.push(eq(productionEntries.machineId, input.machineId));
      } else {
        existingConditions.push(sql`${productionEntries.machineId} IS NULL`);
      }
      const allExisting = await db
        .select()
        .from(productionEntries)
        .where(and(...existingConditions));

      // 2. Determine which tipoMadeira values are being saved now
      const newVariants = new Set(input.entries.map(e => e.tipoMadeira || null));

      // ─── Embalagem auto-feed: verificar se é setor Embalagem para atualizar estoque ───
      // AUTO-FEED REATIVADO em 16/04/2026: lançamentos de produção da Maria alimentam estoque Madeira PA automaticamente.
      const BATCH_MADEIRA_STOCK_AUTO_FEED_DISABLED = false; // Reativado por solicitação do Guilherme
      const STOCK_CUTOFF_DATE = "2026-04-15";
      let isEmbalagemSector = false;
      if (input.machineId === null && input.data >= STOCK_CUTOFF_DATE) {
        const sectorRows = await db.select().from(productionSectors).where(eq(productionSectors.id, input.sectorId)).limit(1);
        isEmbalagemSector = sectorRows.length > 0 && sectorRows[0].tipoEquipamento === "nenhum";
      }

      // Build map of old quantities by tipoMadeira (codigoItem) for stock diff calculation
      const oldQtyMap = new Map<string, number>();
      for (const old of allExisting) {
        if (old.tipoMadeira) {
          oldQtyMap.set(old.tipoMadeira, roundDec((oldQtyMap.get(old.tipoMadeira) || 0) + parseFloat(String(old.quantidade))));
        }
      }

      // 3. Soft-delete old entries whose tipoMadeira is NOT in the new set
      // REGRA: NUNCA apagar histórico de produção. Setar quantidade para 0 em vez de deletar.
      for (const old of allExisting) {
        const oldVariant = old.tipoMadeira || null;
        if (!newVariants.has(oldVariant)) {
          await db.update(productionEntries)
            .set({ quantidade: "0", observacoes: "[REMOVIDO]" })
            .where(eq(productionEntries.id, old.id));
          results.push({ tipoMadeira: oldVariant, action: "soft-deleted" });
        }
      }

      // 4. Upsert the new entries
      for (const entry of input.entries) {
        const conditions = [
          eq(productionEntries.sectorId, entry.sectorId),
          eq(productionEntries.data, entry.data),
        ];
        if (entry.machineId) {
          conditions.push(eq(productionEntries.machineId, entry.machineId));
        } else {
          conditions.push(sql`${productionEntries.machineId} IS NULL`);
        }
        if (entry.tipoMadeira) {
          conditions.push(eq(productionEntries.tipoMadeira, entry.tipoMadeira));
        } else {
          conditions.push(sql`${productionEntries.tipoMadeira} IS NULL`);
        }

        const existing = await db
          .select()
          .from(productionEntries)
          .where(and(...conditions))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(productionEntries)
            .set({
              quantidade: String(entry.quantidade),
            status: entry.status || "",
            observacoes: entry.observacoes || null,
            lancadoPor: entry.lancadoPor || null,
          })
          .where(eq(productionEntries.id, existing[0].id));
          results.push({ tipoMadeira: entry.tipoMadeira || null, action: "updated" });
        } else {
          await db.insert(productionEntries).values({
            sectorId: entry.sectorId,
            machineId: entry.machineId,
            data: entry.data,
            quantidade: String(entry.quantidade),
            status: entry.status || "",
            tipoMadeira: entry.tipoMadeira || null,
            observacoes: entry.observacoes || null,
            lancadoPor: entry.lancadoPor || null,
          });
          results.push({ tipoMadeira: entry.tipoMadeira || null, action: "created" });
        }
      }

      // ─── Embalagem auto-feed: calcular diff e atualizar estoque Madeira PA ───
      if (isEmbalagemSector) {
        // Build map of new quantities by tipoMadeira (codigoItem)
        const newQtyMap = new Map<string, number>();
        for (const entry of input.entries) {
          if (entry.tipoMadeira) {
            newQtyMap.set(entry.tipoMadeira, roundDec((newQtyMap.get(entry.tipoMadeira) || 0) + entry.quantidade));
          }
        }

        // Combine all codigoItems from old and new
        const allCodigos = Array.from(new Set([...Array.from(oldQtyMap.keys()), ...Array.from(newQtyMap.keys())]));
        const lancadoPor = input.entries[0]?.lancadoPor || "Sistema";

        const QUEIJO_COALHO_CODES_BATCH = ["00648", "00546", "00547", "00577", "00645", "00646", "00647"];

        for (const codigoItem of allCodigos) {
          const oldQty = oldQtyMap.get(codigoItem) || 0;
          const newQty = newQtyMap.get(codigoItem) || 0;
          const diff = roundDec(newQty - oldQty);

          if (diff !== 0) {
            const isQueijCoalho = QUEIJO_COALHO_CODES_BATCH.includes(codigoItem);

            if (isQueijCoalho) {
              // Auto-feed Queijo Coalho: atualiza estoque_processado E abate do estoque_maxiprod
              const qcRows = await db.select().from(queijoCoalhoStock).where(eq(queijoCoalhoStock.codigoItem, codigoItem));
              const currentProcessado = roundDec(qcRows.length > 0 ? parseFloat(String(qcRows[0].estoqueProcessado)) : 0);
              const currentMaxiprod = roundDec(qcRows.length > 0 ? parseFloat(String(qcRows[0].estoqueMaxiprod)) : 0);
              const newProcessado = roundDec(Math.max(0, currentProcessado + diff));
              // Abater do estoque Maxiprod: quando processa, sai da matéria-prima
              const newMaxiprod = roundDec(Math.max(0, currentMaxiprod - diff));

              // Record history - processado
              await db.insert(queijoCoalhoStockHistory).values({
                codigoItem,
                campo: "estoque_processado",
                valorAnterior: String(currentProcessado),
                valorNovo: String(newProcessado),
                operador: `Produção (${lancadoPor})`,
                observacao: `Embalagem Palitos Premium (batch): ${diff > 0 ? "+" : ""}${diff} cx`,
              });

              // Record history - maxiprod deduction
              if (diff > 0) {
                await db.insert(queijoCoalhoStockHistory).values({
                  codigoItem,
                  campo: "estoque_maxiprod",
                  valorAnterior: String(currentMaxiprod),
                  valorNovo: String(newMaxiprod),
                  operador: `Produção (${lancadoPor})`,
                  observacao: `Abatido do Maxiprod (embalagem batch): -${diff} cx`,
                });
              }

              // Upsert queijo coalho stock (processado + maxiprod)
              await db.insert(queijoCoalhoStock)
                .values({
                  codigoItem,
                  estoqueProcessado: String(newProcessado),
                  estoqueMaxiprod: String(newMaxiprod),
                  updatedBy: `Produção (${lancadoPor})`,
                })
                .onDuplicateKeyUpdate({
                  set: {
                    estoqueProcessado: sql`${String(newProcessado)}`,
                    estoqueMaxiprod: sql`${String(newMaxiprod)}`,
                    updatedBy: `Produção (${lancadoPor})`,
                  },
                });
            } else {
              // Madeira PA auto-feed (existing logic)
              const stockRows = await db.select().from(madeiraStock).where(eq(madeiraStock.codigoItem, codigoItem));
              const currentStock = roundDec(stockRows.length > 0 ? parseFloat(String(stockRows[0].quantidade)) : 0);
              const newStock = roundDec(Math.max(0, currentStock + diff));

              await db.insert(stockEditHistory).values({
                card: "madeira",
                codigoItem,
                descricaoItem: null,
                valorAnterior: String(currentStock),
                valorNovo: String(newStock),
                operador: `Produção (${lancadoPor})`,
                tipo: "alteracao",
              });

              if (!BATCH_MADEIRA_STOCK_AUTO_FEED_DISABLED) {
                await db.insert(madeiraStock)
                  .values({
                    codigoItem,
                    quantidade: String(newStock),
                    updatedBy: `Produção (${lancadoPor})`,
                  })
                  .onDuplicateKeyUpdate({
                    set: {
                      quantidade: sql`${String(newStock)}`,
                      updatedBy: `Produção (${lancadoPor})`,
                    },
                  });
              }
            }
          }
        }
      }

      return { count: results.length, results };
    }),

  deleteEntry: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // REGRA: NUNCA apagar histórico de produção. Soft-delete: setar quantidade para 0.
      await db.update(productionEntries)
        .set({ quantidade: "0", observacoes: "[REMOVIDO]" })
        .where(eq(productionEntries.id, input.id));
      return { success: true };
    }),

  getHistory: publicProcedure
    .input(z.object({
      dataInicio: z.string(),
      dataFim: z.string(),
      sectorId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [
        gte(productionEntries.data, input.dataInicio),
        lte(productionEntries.data, input.dataFim),
      ];
      if (input.sectorId) {
        conditions.push(eq(productionEntries.sectorId, input.sectorId));
      }
      return db
        .select()
        .from(productionEntries)
        .where(and(...conditions))
        .orderBy(desc(productionEntries.data), productionEntries.sectorId);
    }),

  getDailySummary: publicProcedure
    .input(z.object({ data: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const targetDate = input.data || new Date().toISOString().slice(0, 10);
      return db
        .select({
          sectorId: productionEntries.sectorId,
          total: sql<string>`SUM(${productionEntries.quantidade})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(productionEntries)
        .where(eq(productionEntries.data, targetDate))
        .groupBy(productionEntries.sectorId);
    }),

  getWeeklySummary: publicProcedure
    .input(z.object({
      dataInicio: z.string(),
      dataFim: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      // Return per-variant rows so the frontend can apply cxp/cxg→saco conversion
      // for dual-unit sectors (Vareteira, Seletoras Toco, Seleção Automática)
      return db
        .select({
          sectorId: productionEntries.sectorId,
          data: productionEntries.data,
          tipoMadeira: productionEntries.tipoMadeira,
          total: sql<string>`SUM(${productionEntries.quantidade})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(productionEntries)
        .where(and(
          gte(productionEntries.data, input.dataInicio),
          lte(productionEntries.data, input.dataFim),
        ))
        .groupBy(productionEntries.sectorId, productionEntries.data, productionEntries.tipoMadeira)
        .orderBy(productionEntries.data, productionEntries.sectorId);
    }),

  /**
   * Get monthly average per sector.
   * Returns total produced in the month and the daily average (total / distinct working days with entries).
   */
  getMonthlyAverage: publicProcedure
    .input(z.object({ data: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      // Determine month range from the given date (or today)
      const refDate = input.data || new Date().toISOString().slice(0, 10);
      const [y, m] = refDate.split("-").map(Number);
      const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      
      // Get total per sector and count of distinct days with production
      const rows = await db
        .select({
          sectorId: productionEntries.sectorId,
          total: sql<string>`SUM(${productionEntries.quantidade})`,
          diasTrabalhados: sql<number>`COUNT(DISTINCT ${productionEntries.data})`,
        })
        .from(productionEntries)
        .where(and(
          gte(productionEntries.data, startDate),
          lte(productionEntries.data, endDate),
          sql`${productionEntries.quantidade} > 0`,
        ))
        .groupBy(productionEntries.sectorId);
      
      return rows.map(r => ({
        sectorId: r.sectorId,
        totalMes: parseFloat(String(r.total)) || 0,
        diasTrabalhados: r.diasTrabalhados || 0,
        mediaDiaria: r.diasTrabalhados > 0 ? (parseFloat(String(r.total)) || 0) / r.diasTrabalhados : 0,
      }));
    }),

  getStatusOptions: publicProcedure.query(() => {
    return {
      statusOptions: MACHINE_STATUS_OPTIONS,
      woodTypeOptions: WOOD_TYPE_OPTIONS,
      woodMeasureOptions: WOOD_MEASURE_OPTIONS,
    };
  }),

  /**
   * Get finished products for Embalagem sector.
   * Used by Embalagem (setor 8) to list products for packaging registration.
   * Supports two categories: "madeira" (Madeira PA) and "bambu" (Importação/Bambu).
   */
  getFinishedProducts: publicProcedure
    .input(z.object({ categoria: z.enum(["madeira", "bambu", "palitos_premium"]).optional() }).optional())
    .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const categoria = input?.categoria || "madeira";
    
    // ─── Palitos Premium (Queijo Coalho): códigos fixos ───
    const QUEIJO_COALHO_CODES = ["00648", "00546", "00547", "00577", "00645", "00646", "00647"];
    
    if (categoria === "palitos_premium") {
      const rows = await db
        .select({
          codigoItem: stockItems.codigoItem,
          descricaoItem: stockItems.descricaoItem,
          unidadeMedida: stockItems.unidadeMedida,
        })
        .from(stockItems)
        .where(inArray(stockItems.codigoItem, QUEIJO_COALHO_CODES))
        .orderBy(stockItems.descricaoItem);
      
      const seen = new Set<string>();
      const products: Array<{ codigoItem: string; descricaoItem: string; unidadeMedida: string }> = [];
      for (const row of rows) {
        if (!seen.has(row.codigoItem)) {
          seen.add(row.codigoItem);
          products.push({
            codigoItem: row.codigoItem,
            descricaoItem: row.descricaoItem || row.codigoItem,
            unidadeMedida: row.unidadeMedida || "cx",
          });
        }
      }
      return products;
    }
    
    // Itens que devem ser FORÇADOS em Bambu (mesmo que o grupo diga outra coisa)
    const forceBambu = ["00141A"]; // AMOSTRA ESPETO DE BAMBU - superGrupo 16/grupo 18 mas é bambu
    // Itens que devem ser EXCLUÍDOS de Bambu (são máquinas/importação, não produto bambu)
    const excludeFromBambu = ["00526", "00523", "00522"]; // INCUBADORA, LÂMINAS DE SERRA
    
    let whereClause;
    if (categoria === "bambu") {
      // Bambu/Importação: superGrupoCodigo = "12" (Importação revenda: bambu, fibra)
      // + itens forçados em bambu
      // - itens excluídos (máquinas/importação)
      whereClause = and(
        or(
          eq(stockItems.superGrupoCodigo, "12"),
          inArray(stockItems.codigoItem, forceBambu)
        ),
        sql`${stockItems.codigoItem} NOT IN (${sql.raw(excludeFromBambu.map(c => `'${c}'`).join(","))})`
      );
    } else {
      // Madeira PA: superGrupoCodigo = "05" OR ("16" AND grupoCodigo IN ("18","19"))
      // - itens forçados em bambu (excluir da madeira)
      whereClause = and(
        or(
          eq(stockItems.superGrupoCodigo, "05"),
          and(
            eq(stockItems.superGrupoCodigo, "16"),
            inArray(stockItems.grupoCodigo, ["18", "19"])
          )
        ),
        sql`${stockItems.codigoItem} NOT IN (${sql.raw(forceBambu.map(c => `'${c}'`).join(","))})`
      );
    }
    
    const rows = await db
      .select({
        codigoItem: stockItems.codigoItem,
        descricaoItem: stockItems.descricaoItem,
        unidadeMedida: stockItems.unidadeMedida,
      })
      .from(stockItems)
      .where(whereClause)
      .orderBy(stockItems.descricaoItem);
    
    // Deduplicate by codigoItem (same product may appear in multiple stock locations)
    const seen = new Set<string>();
    const products: Array<{ codigoItem: string; descricaoItem: string; unidadeMedida: string }> = [];
    for (const row of rows) {
      if (!seen.has(row.codigoItem)) {
        seen.add(row.codigoItem);
        products.push({
          codigoItem: row.codigoItem,
          descricaoItem: row.descricaoItem || row.codigoItem,
          unidadeMedida: row.unidadeMedida || "cx",
        });
      }
    }
    return products;
  }),

  /**
   * Relatório de conferência do auto-feed Embalagem → Estoque Madeira PA.
   * Para cada produto de madeira, mostra:
   * - Estoque de ontem (valor anterior no histórico)
   * - Quantidade embalada hoje (soma dos lançamentos de Embalagem)
   * - Estoque atual
   * - Se bate (estoque_ontem + embalado_hoje == estoque_atual)
   */
  getStockAutoFeedReport: publicProcedure
    .input(z.object({
      data: z.string().optional(), // YYYY-MM-DD, default = hoje
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { report: [], data: "" };

      // Data alvo (default = hoje)
      const hoje = input?.data || new Date().toISOString().slice(0, 10);
      
      // 1. Buscar todos os produtos de Madeira PA (mesma lógica do getFinishedProducts)
      const prodRows = await db
        .select({
          codigoItem: stockItems.codigoItem,
          descricaoItem: stockItems.descricaoItem,
          unidadeMedida: stockItems.unidadeMedida,
        })
        .from(stockItems)
        .where(
          or(
            eq(stockItems.superGrupoCodigo, "05"),
            and(
              eq(stockItems.superGrupoCodigo, "16"),
              inArray(stockItems.grupoCodigo, ["18", "19"])
            )
          )
        )
        .orderBy(stockItems.descricaoItem);

      // Deduplicate
      const seen = new Set<string>();
      const products: Array<{ codigoItem: string; descricaoItem: string; unidadeMedida: string }> = [];
      for (const row of prodRows) {
        if (!seen.has(row.codigoItem)) {
          seen.add(row.codigoItem);
          products.push({
            codigoItem: row.codigoItem,
            descricaoItem: row.descricaoItem || row.codigoItem,
            unidadeMedida: row.unidadeMedida || "cx",
          });
        }
      }

      // 2. Buscar estoque atual de Madeira PA
      const stockRows = await db.select().from(madeiraStock);
      const stockMap = new Map<string, number>();
      for (const s of stockRows) {
        stockMap.set(s.codigoItem, parseFloat(String(s.quantidade)) || 0);
      }

      // 3. Buscar histórico de edições de hoje (para calcular estoque de ontem)
      // Pegar todas as alterações de hoje feitas pela Produção
      const startOfDay = new Date(hoje + "T00:00:00.000Z");
      const endOfDay = new Date(hoje + "T23:59:59.999Z");
      const historyRows = await db.select()
        .from(stockEditHistory)
        .where(and(
          eq(stockEditHistory.card, "madeira"),
          gte(stockEditHistory.createdAt, startOfDay),
          lte(stockEditHistory.createdAt, endOfDay),
        ))
        .orderBy(stockEditHistory.createdAt);

      // Para cada produto, pegar o valorAnterior da PRIMEIRA alteração do dia = estoque de ontem
      const estoqueOntemMap = new Map<string, number>();
      const alteracoesHojeMap = new Map<string, Array<{ de: number; para: number; operador: string; hora: string }>>(); 
      for (const h of historyRows) {
        if (!estoqueOntemMap.has(h.codigoItem)) {
          estoqueOntemMap.set(h.codigoItem, parseFloat(String(h.valorAnterior)) || 0);
        }
        const arr = alteracoesHojeMap.get(h.codigoItem) || [];
        arr.push({
          de: parseFloat(String(h.valorAnterior)) || 0,
          para: parseFloat(String(h.valorNovo)) || 0,
          operador: h.operador,
          hora: h.createdAt ? new Date(h.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
        });
        alteracoesHojeMap.set(h.codigoItem, arr);
      }

      // 4. Buscar lançamentos de Embalagem de hoje
      // Embalagem = setor com tipoEquipamento = "nenhum"
      const embalagemSectors = await db.select().from(productionSectors).where(eq(productionSectors.tipoEquipamento, "nenhum"));
      const embalagemSectorIds = embalagemSectors.map(s => s.id);

      let embalagemEntries: Array<{ tipoMadeira: string | null; quantidade: string }> = [];
      if (embalagemSectorIds.length > 0) {
        embalagemEntries = await db.select({
          tipoMadeira: productionEntries.tipoMadeira,
          quantidade: productionEntries.quantidade,
        })
        .from(productionEntries)
        .where(and(
          inArray(productionEntries.sectorId, embalagemSectorIds),
          eq(productionEntries.data, hoje),
        ));
      }

      // Somar embalagem por codigoItem (tipoMadeira = codigoItem na embalagem)
      const embalagemMap = new Map<string, number>();
      for (const e of embalagemEntries) {
        if (e.tipoMadeira) {
          embalagemMap.set(e.tipoMadeira, roundDec((embalagemMap.get(e.tipoMadeira) || 0) + (parseFloat(String(e.quantidade)) || 0)));
        }
      }

      // 5. Montar relatório
      const report = products.map(p => {
        const estoqueAtual = stockMap.get(p.codigoItem) || 0;
        const estoqueOntem = estoqueOntemMap.has(p.codigoItem) ? estoqueOntemMap.get(p.codigoItem)! : estoqueAtual;
        const embaladoHoje = embalagemMap.get(p.codigoItem) || 0;
        const alteracoes = alteracoesHojeMap.get(p.codigoItem) || [];
        const esperado = estoqueOntem + embaladoHoje;
        const bateu = Math.abs(estoqueAtual - esperado) < 0.01;

        return {
          codigoItem: p.codigoItem,
          descricaoItem: p.descricaoItem,
          unidadeMedida: p.unidadeMedida,
          estoqueOntem,
          embaladoHoje,
          estoqueAtual,
          esperado,
          bateu,
          alteracoes,
        };
      });

      return { report, data: hoje };
    }),

  // ═══════════════════════════════════════════════════════════
  // PIROGRAFIA (Setor 9 - Máquina Pirografar)
  // ═══════════════════════════════════════════════════════════

  /**
   * Listar produtos disponíveis para pirografia (Bambu + Madeira).
   * Puxa do estoque real (stock_items) ambas as categorias.
   */
  getPirografiaProducts: publicProcedure
    .input(z.object({ categoria: z.enum(["bambu", "madeira", "todos"]).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const categoria = input?.categoria || "todos";

      // Itens forçados em Bambu (mesmo que o grupo diga outra coisa)
      const forceBambu = ["00141A"]; // AMOSTRA ESPETO DE BAMBU
      // Itens excluídos de Bambu (máquinas/importação)
      const excludeFromBambu = ["00526", "00523", "00522"]; // INCUBADORA, LÂMINAS DE SERRA

      let whereClause;
      if (categoria === "bambu") {
        whereClause = and(
          or(
            eq(stockItems.superGrupoCodigo, "12"),
            inArray(stockItems.codigoItem, forceBambu)
          ),
          sql`${stockItems.codigoItem} NOT IN (${sql.raw(excludeFromBambu.map(c => `'${c}'`).join(","))})`
        );
      } else if (categoria === "madeira") {
        whereClause = and(
          or(
            eq(stockItems.superGrupoCodigo, "05"),
            and(
              eq(stockItems.superGrupoCodigo, "16"),
              inArray(stockItems.grupoCodigo, ["18", "19"])
            )
          ),
          sql`${stockItems.codigoItem} NOT IN (${sql.raw(forceBambu.map(c => `'${c}'`).join(","))})`
        );
      } else {
        // todos: Bambu + Madeira (excluindo máquinas)
        whereClause = and(
          or(
            eq(stockItems.superGrupoCodigo, "12"),
            eq(stockItems.superGrupoCodigo, "05"),
            and(
              eq(stockItems.superGrupoCodigo, "16"),
              inArray(stockItems.grupoCodigo, ["18", "19"])
            )
          ),
          sql`${stockItems.codigoItem} NOT IN (${sql.raw(excludeFromBambu.map(c => `'${c}'`).join(","))})`
        );
      }

      const rows = await db
        .select({
          codigoItem: stockItems.codigoItem,
          descricaoItem: stockItems.descricaoItem,
          unidadeMedida: stockItems.unidadeMedida,
          superGrupoCodigo: stockItems.superGrupoCodigo,
        })
        .from(stockItems)
        .where(whereClause)
        .orderBy(stockItems.descricaoItem);

      // Deduplicate and classify
      const seen = new Set<string>();
      const products: Array<{ codigoItem: string; descricaoItem: string; unidadeMedida: string; materialOrigem: string }> = [];
      for (const row of rows) {
        if (!seen.has(row.codigoItem)) {
          seen.add(row.codigoItem);
          const isBambu = row.superGrupoCodigo === "12" || forceBambu.includes(row.codigoItem);
          products.push({
            codigoItem: row.codigoItem,
            descricaoItem: row.descricaoItem || row.codigoItem,
            unidadeMedida: row.unidadeMedida || "cx",
            materialOrigem: isBambu ? "bambu" : "madeira",
          });
        }
      }
      return products;
    }),

  /**
   * Salvar um registro de pirografia.
   * Cada registro = 1 produto + 1 nome pirografado + quantidade em 1 máquina em 1 dia.
   */
  savePirografiaEntry: publicProcedure
    .input(z.object({
      sectorId: z.number(),
      machineId: z.number(),
      data: z.string(),
      codigoItem: z.string(),
      descricaoItem: z.string().optional(),
      materialOrigem: z.enum(["bambu", "madeira"]),
      nomePirografado: z.string().min(1),
      quantidade: z.number().min(0),
      observacoes: z.string().optional(),
      lancadoPor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(pirografiaEntries).values({
        sectorId: input.sectorId,
        machineId: input.machineId,
        data: input.data,
        codigoItem: input.codigoItem,
        descricaoItem: input.descricaoItem || null,
        materialOrigem: input.materialOrigem,
        nomePirografado: input.nomePirografado,
        quantidade: String(input.quantidade),
        observacoes: input.observacoes || null,
        lancadoPor: input.lancadoPor || null,
      });

      // Também registrar na production_entries para manter o total do setor consistente
      // Usa tipoMadeira = materialOrigem para compatibilidade com o sistema existente
      const entryKey = `piro_${input.machineId}_${input.codigoItem}_${input.nomePirografado}`;
      // Somar ao total existente da máquina/dia para o mesmo material
      const existingPE = await db.select().from(productionEntries)
        .where(and(
          eq(productionEntries.sectorId, input.sectorId),
          eq(productionEntries.machineId, input.machineId),
          eq(productionEntries.data, input.data),
          eq(productionEntries.tipoMadeira, input.materialOrigem),
        ))
        .limit(1);

      if (existingPE.length > 0) {
        const oldQty = roundDec(parseFloat(String(existingPE[0].quantidade)) || 0);
        await db.update(productionEntries)
          .set({
            quantidade: String(roundDec(oldQty + input.quantidade)),
            lancadoPor: input.lancadoPor || null,
          })
          .where(eq(productionEntries.id, existingPE[0].id));
      } else {
        await db.insert(productionEntries).values({
          sectorId: input.sectorId,
          machineId: input.machineId,
          data: input.data,
          quantidade: String(input.quantidade),
          status: "producao_normal",
          tipoMadeira: input.materialOrigem,
          lancadoPor: input.lancadoPor || null,
        });
      }

      return { id: result[0].insertId, action: "created" };
    }),

  /**
   * Atualizar um registro de pirografia existente.
   */
  updatePirografiaEntry: publicProcedure
    .input(z.object({
      id: z.number(),
      nomePirografado: z.string().min(1).optional(),
      quantidade: z.number().min(0).optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db.select().from(pirografiaEntries).where(eq(pirografiaEntries.id, input.id)).limit(1);
      if (existing.length === 0) throw new Error("Entry not found");

      const oldQty = roundDec(parseFloat(String(existing[0].quantidade)) || 0);
      const newQty = input.quantidade !== undefined ? input.quantidade : oldQty;
      const qtyDiff = roundDec(newQty - oldQty);

      const updates: Record<string, any> = {};
      if (input.nomePirografado !== undefined) updates.nomePirografado = input.nomePirografado;
      if (input.quantidade !== undefined) updates.quantidade = String(input.quantidade);
      if (input.observacoes !== undefined) updates.observacoes = input.observacoes;

      await db.update(pirografiaEntries).set(updates).where(eq(pirografiaEntries.id, input.id));

      // Atualizar production_entries se a quantidade mudou
      if (qtyDiff !== 0) {
        const entry = existing[0];
        const pe = await db.select().from(productionEntries)
          .where(and(
            eq(productionEntries.sectorId, entry.sectorId),
            eq(productionEntries.machineId, entry.machineId),
            eq(productionEntries.data, entry.data),
            eq(productionEntries.tipoMadeira, entry.materialOrigem),
          ))
          .limit(1);
        if (pe.length > 0) {
          const peQty = roundDec(parseFloat(String(pe[0].quantidade)) || 0);
          await db.update(productionEntries)
            .set({ quantidade: String(roundDec(Math.max(0, peQty + qtyDiff))) })
            .where(eq(productionEntries.id, pe[0].id));
        }
      }

      return { success: true };
    }),

  /**
   * Deletar um registro de pirografia.
   */
  deletePirografiaEntry: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db.select().from(pirografiaEntries).where(eq(pirografiaEntries.id, input.id)).limit(1);
      if (existing.length === 0) throw new Error("Entry not found");

      const entry = existing[0];
      const qty = roundDec(parseFloat(String(entry.quantidade)) || 0);

      // Subtrair do production_entries (NUNCA deletar, apenas reduzir quantidade)
      if (qty > 0) {
        const pe = await db.select().from(productionEntries)
          .where(and(
            eq(productionEntries.sectorId, entry.sectorId),
            eq(productionEntries.machineId, entry.machineId),
            eq(productionEntries.data, entry.data),
            eq(productionEntries.tipoMadeira, entry.materialOrigem),
          ))
          .limit(1);
        if (pe.length > 0) {
          const peQty = roundDec(parseFloat(String(pe[0].quantidade)) || 0);
          const newPeQty = roundDec(Math.max(0, peQty - qty));
          // REGRA: NUNCA apagar histórico de produção. Setar quantidade para 0 em vez de deletar.
          await db.update(productionEntries)
            .set({ quantidade: String(newPeQty) })
            .where(eq(productionEntries.id, pe[0].id));
        }
      }

      // REGRA: NUNCA apagar histórico de pirografia. Soft-delete: setar quantidade para 0.
      await db.update(pirografiaEntries)
        .set({ quantidade: "0", observacoes: "[REMOVIDO]" })
        .where(eq(pirografiaEntries.id, input.id));
      return { success: true };
    }),

  /**
   * Buscar registros de pirografia por dia e/ou máquina.
   * Retorna todos os registros detalhados (produto, nome, quantidade).
   */
  getPirografiaEntries: publicProcedure
    .input(z.object({
      data: z.string(),
      machineId: z.number().optional(),
      sectorId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(pirografiaEntries.data, input.data)];
      if (input.machineId) conditions.push(eq(pirografiaEntries.machineId, input.machineId));
      if (input.sectorId) conditions.push(eq(pirografiaEntries.sectorId, input.sectorId));

      return db.select().from(pirografiaEntries)
        .where(and(...conditions))
        .orderBy(pirografiaEntries.machineId, desc(pirografiaEntries.createdAt));
    }),

  /**
   * Histórico de pirografia: nomes mais pirografados e produtos mais pirografados.
   * Para analytics futuras.
   */
  getPirografiaHistory: publicProcedure
    .input(z.object({
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { topNomes: [], topProdutos: [], total: 0 };

      const conditions: any[] = [];
      if (input?.dataInicio) conditions.push(gte(pirografiaEntries.data, input.dataInicio));
      if (input?.dataFim) conditions.push(lte(pirografiaEntries.data, input.dataFim));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Top nomes pirografados
      const topNomes = await db.select({
        nomePirografado: pirografiaEntries.nomePirografado,
        totalQuantidade: sql<string>`SUM(${pirografiaEntries.quantidade})`,
        totalRegistros: sql<number>`COUNT(*)`,
      })
        .from(pirografiaEntries)
        .where(whereClause)
        .groupBy(pirografiaEntries.nomePirografado)
        .orderBy(sql`SUM(${pirografiaEntries.quantidade}) DESC`)
        .limit(50);

      // Top produtos pirografados
      const topProdutos = await db.select({
        codigoItem: pirografiaEntries.codigoItem,
        descricaoItem: sql<string>`MAX(${pirografiaEntries.descricaoItem})`,
        materialOrigem: pirografiaEntries.materialOrigem,
        totalQuantidade: sql<string>`SUM(${pirografiaEntries.quantidade})`,
        totalRegistros: sql<number>`COUNT(*)`,
      })
        .from(pirografiaEntries)
        .where(whereClause)
        .groupBy(pirografiaEntries.codigoItem, pirografiaEntries.materialOrigem)
        .orderBy(sql`SUM(${pirografiaEntries.quantidade}) DESC`)
        .limit(50);

      // Buscar unidadeDeVendaFator (5000 ou 10000) para cada produto pirografado
      const prodCodes = topProdutos.map(p => p.codigoItem);
      const stockInfoMap = new Map<string, number>();
      if (prodCodes.length > 0) {
        const stockRows = await db.select({
          codigoItem: stockItems.codigoItem,
          unidadeDeVendaFator: stockItems.unidadeDeVendaFator,
        }).from(stockItems).where(inArray(stockItems.codigoItem, prodCodes));
        for (const row of stockRows) {
          const fator = parseFloat(String(row.unidadeDeVendaFator || "0"));
          if (fator > 0) stockInfoMap.set(row.codigoItem, fator);
        }
      }

      // Total geral
      const totalRows = await db.select({
        total: sql<string>`COALESCE(SUM(${pirografiaEntries.quantidade}), 0)`,
      })
        .from(pirografiaEntries)
        .where(whereClause);

      return {
        topNomes: topNomes.map(n => ({
          nome: n.nomePirografado,
          quantidade: parseFloat(String(n.totalQuantidade)) || 0,
          registros: n.totalRegistros,
        })),
        topProdutos: topProdutos.map(p => {
          const unPerCx = stockInfoMap.get(p.codigoItem) || 0;
          const tipoCaixa = unPerCx >= 10000 ? "10k" : unPerCx >= 5000 ? "5k" : "";
          return {
            codigoItem: p.codigoItem,
            descricaoItem: String(p.descricaoItem || p.codigoItem),
            materialOrigem: p.materialOrigem,
            quantidade: parseFloat(String(p.totalQuantidade)) || 0,
            registros: p.totalRegistros,
            tipoCaixa,
          };
        }),
        total: parseFloat(String(totalRows[0]?.total)) || 0,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // CONTROLE DE LOTES
  // ═══════════════════════════════════════════════════════════

  /** Listar produtos do catálogo para dropdown de SKU (com classificação bambu/madeira) */
  getLotProducts: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const products = await db.select({
      codigoItem: productCatalog.codigoItem,
      descricaoItem: productCatalog.descricaoItem,
    }).from(productCatalog).orderBy(productCatalog.descricaoItem);

    // Get material classification from stock_items (superGrupoCodigo + grupoCodigo)
    const stockClassification = await db.selectDistinct({
      codigoItem: stockItems.codigoItem,
      superGrupoCodigo: stockItems.superGrupoCodigo,
      grupoCodigo: stockItems.grupoCodigo,
    }).from(stockItems);
    const classMap = new Map<string, { superGrupoCodigo: string | null; grupoCodigo: string | null }>();
    for (const s of stockClassification) {
      classMap.set(s.codigoItem, { superGrupoCodigo: s.superGrupoCodigo, grupoCodigo: s.grupoCodigo });
    }

    // Itens que devem ser FORÇADOS em Bambu (mesmo que o grupo diga outra coisa)
    const forceBambu = ["00141A"]; // AMOSTRA ESPETO DE BAMBU - superGrupo 16/grupo 18 mas é bambu
    // Itens que devem ser EXCLUÍDOS de Bambu (são máquinas/importação, não produto bambu)
    const excludeFromBambu = ["00522", "00523", "00524", "00525", "00526", "00527"];
    // INCUBADORA, LÂMINAS DE SERRA, PRATELEIRA, CARRINHO, CHOCADEIRA

    return products
      .filter(p => !excludeFromBambu.includes(p.codigoItem)) // Remove itens que não são produção
      .map(p => {
        // Forçar bambu para itens específicos
        if (forceBambu.includes(p.codigoItem)) {
          return { ...p, material: "bambu" as const };
        }
        const cls = classMap.get(p.codigoItem);
        let material: "bambu" | "madeira" | "outro" = "bambu"; // default
        if (cls) {
          // Madeira: superGrupoCodigo "05" (Industrialização) ou "16" com grupoCodigo "18"/"19"
          if (cls.superGrupoCodigo === "05" || (cls.superGrupoCodigo === "16" && (cls.grupoCodigo === "18" || cls.grupoCodigo === "19"))) {
            material = "madeira";
          } else if (cls.superGrupoCodigo === "12") {
            material = "bambu";
          }
        } else {
          // Fallback: classify by description
          const d = p.descricaoItem.toUpperCase();
          if ((d.includes("MADEIRA") || d.includes("PINUS")) && !d.includes("BAMBU")) {
            material = "madeira";
          }
        }
        return { ...p, material };
      });
  }),

  /** Criar um novo lote ou acumular no existente (mesmo codigoItem + notaCarga) */
  createLot: publicProcedure
    .input(z.object({
      codigoItem: z.string(),
      descricaoItem: z.string(),
      notaCarga: z.string(),
      qtdProduzida: z.number().positive(),
      lancadoPor: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, "0");
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const aa = String(today.getFullYear()).slice(-2);
      const dataProducao = today.toISOString().slice(0, 10);
      const codigo = `${input.codigoItem}-${dd}${mm}${aa}-${input.notaCarga}`;

      // Check if a lot with same codigoItem + notaCarga already exists (any date)
      const existing = await db.select().from(productionLots)
        .where(and(
          eq(productionLots.codigoItem, input.codigoItem),
          eq(productionLots.notaCarga, input.notaCarga)
        ))
        .orderBy(desc(productionLots.createdAt))
        .limit(1);

      if (existing.length > 0) {
        // Acumular no lote existente
        const lot = existing[0];
        const oldQtd = parseFloat(String(lot.qtdProduzida)) || 0;
        const oldSaldo = parseFloat(String(lot.saldoAtual)) || 0;
        const newQtd = oldQtd + input.qtdProduzida;
        const newSaldo = oldSaldo + input.qtdProduzida;

        await db.update(productionLots)
          .set({
            qtdProduzida: String(newQtd),
            saldoAtual: String(newSaldo),
          })
          .where(eq(productionLots.id, lot.id));

        // Registrar no histórico de movimentações
        await db.insert(lotMovements).values({
          lotId: lot.id,
          codigoLote: lot.codigo,
          cliente: "Produção (acumulado)",
          qtdEnviada: String(input.qtdProduzida),
          dataEnvio: dataProducao,
          lancadoPor: input.lancadoPor,
          observacoes: `Lançamento acumulado em ${dataProducao}: +${input.qtdProduzida} cx (saldo anterior: ${oldSaldo}, novo: ${newSaldo})`,
        });

        return { codigo: lot.codigo, acumulado: true, qtdAdicionada: input.qtdProduzida, novoTotal: newQtd };
      }

      // Criar novo lote
      await db.insert(productionLots).values({
        codigo,
        codigoItem: input.codigoItem,
        descricaoItem: input.descricaoItem,
        notaCarga: input.notaCarga,
        dataProducao,
        qtdProduzida: String(input.qtdProduzida),
        saldoAtual: String(input.qtdProduzida),
        lancadoPor: input.lancadoPor,
      });
      return { codigo, acumulado: false };
    }),

  /** Listar lotes com saldo > 0 (para seleção em pedidos) */
  getLotsWithBalance: publicProcedure
    .input(z.object({
      codigoItem: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [sql`CAST(${productionLots.saldoAtual} AS DECIMAL(18,2)) > 0`];
      if (input?.codigoItem) {
        conditions.push(eq(productionLots.codigoItem, input.codigoItem));
      }
      return db.select().from(productionLots)
        .where(and(...conditions))
        .orderBy(desc(productionLots.createdAt));
    }),

  /** Listar todos os lotes (para consulta geral) */
  getAllLots: publicProcedure
    .input(z.object({
      codigoItem: z.string().optional(),
      search: z.string().optional(),
      onlyWithBalance: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: any[] = [];
      if (input?.codigoItem) {
        conditions.push(eq(productionLots.codigoItem, input.codigoItem));
      }
      if (input?.onlyWithBalance) {
        conditions.push(sql`CAST(${productionLots.saldoAtual} AS DECIMAL(18,2)) > 0`);
      }
      if (input?.search) {
        conditions.push(sql`${productionLots.codigo} LIKE ${`%${input.search}%`}`);
      }
      return db.select().from(productionLots)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(productionLots.createdAt));
    }),

  /** Registrar movimentação de lote (saída) */
  createLotMovement: publicProcedure
    .input(z.object({
      lotId: z.number(),
      codigoLote: z.string(),
      pedido: z.string().optional(),
      cliente: z.string(),
      qtdEnviada: z.number().positive(),
      observacoes: z.string().optional(),
      lancadoPor: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check balance
      const lot = await db.select().from(productionLots).where(eq(productionLots.id, input.lotId)).limit(1);
      if (lot.length === 0) throw new Error("Lote não encontrado");
      const saldo = roundDec(parseFloat(String(lot[0].saldoAtual)));
      if (input.qtdEnviada > saldo) {
        throw new Error(`Quantidade (${input.qtdEnviada}) excede saldo disponível (${saldo})`);
      }

      const today = new Date().toISOString().slice(0, 10);
      await db.insert(lotMovements).values({
        lotId: input.lotId,
        codigoLote: input.codigoLote,
        pedido: input.pedido || null,
        cliente: input.cliente,
        qtdEnviada: String(input.qtdEnviada),
        dataEnvio: today,
        observacoes: input.observacoes || null,
        lancadoPor: input.lancadoPor,
      });

      // Update balance
      const newBalance = roundDec(saldo - input.qtdEnviada);
      await db.update(productionLots)
        .set({ saldoAtual: String(newBalance) })
        .where(eq(productionLots.id, input.lotId));

      return { newBalance };
    }),

  /** Histórico de movimentações de um lote */
  getLotMovements: publicProcedure
    .input(z.object({
      lotId: z.number().optional(),
      codigoLote: z.string().optional(),
      cliente: z.string().optional(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: any[] = [];
      if (input.lotId) conditions.push(eq(lotMovements.lotId, input.lotId));
      if (input.codigoLote) conditions.push(sql`${lotMovements.codigoLote} LIKE ${`%${input.codigoLote}%`}`);
      if (input.cliente) conditions.push(sql`${lotMovements.cliente} LIKE ${`%${input.cliente}%`}`);
      if (input.dataInicio) conditions.push(gte(lotMovements.dataEnvio, input.dataInicio));
      if (input.dataFim) conditions.push(lte(lotMovements.dataEnvio, input.dataFim));
      return db.select().from(lotMovements)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(lotMovements.createdAt));
    }),

  /** Listar todas as baixas (atribuições de lotes a pedidos) para o Histórico */
  getAllLotAssignments: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const { orderLotAssignments } = await import("../drizzle/schema");
      return db.select().from(orderLotAssignments)
        .orderBy(desc(orderLotAssignments.createdAt));
    }),

  /** Apagar um lote (remove lote + movimentações + atribuições vinculadas) */
  deleteLot: publicProcedure
    .input(z.object({
      lotId: z.number(),
      operador: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const { orderLotAssignments } = await import("../drizzle/schema");

      // Check if lot exists
      const lot = await db.select().from(productionLots).where(eq(productionLots.id, input.lotId)).limit(1);
      if (lot.length === 0) throw new Error("Lote não encontrado");

      // Delete any order lot assignments referencing this lot
      await db.delete(orderLotAssignments).where(eq(orderLotAssignments.lotId, input.lotId));

      // Delete movements
      await db.delete(lotMovements).where(eq(lotMovements.lotId, input.lotId));

      // Delete the lot itself
      await db.delete(productionLots).where(eq(productionLots.id, input.lotId));

      return { success: true, deletedLot: lot[0].codigo };
    }),

  // ═══════════════════════════════════════════════════════════
  // AUTORIZAÇÃO DE LOTES RETROATIVOS
  // ═══════════════════════════════════════════════════════════

  /** Criar solicitação de lote retroativo */
  requestRetroactiveLot: publicProcedure
    .input(z.object({
      solicitanteNome: z.string(),
      codigoItem: z.string(),
      descricaoItem: z.string(),
      notaCarga: z.string(),
      qtdProduzida: z.number().positive(),
      dataProducao: z.string(), // YYYY-MM-DD
      motivo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Gerar preview do código do lote com a data retroativa
      const [year, month, day] = input.dataProducao.split("-");
      const dd = day;
      const mm = month;
      const aa = year.slice(-2);
      const codigoLotePreview = `${input.codigoItem}-${dd}${mm}${aa}-${input.notaCarga}`;

      // Verificar se já existe solicitação pendente para o mesmo lote
      const existing = await db.select().from(retroactiveLotRequests)
        .where(and(
          eq(retroactiveLotRequests.codigoLotePreview, codigoLotePreview),
          eq(retroactiveLotRequests.status, "pendente")
        ))
        .limit(1);
      if (existing.length > 0) {
        throw new Error(`Já existe uma solicitação pendente para o lote ${codigoLotePreview}`);
      }

      const [inserted] = await db.insert(retroactiveLotRequests).values({
        solicitanteNome: input.solicitanteNome,
        codigoItem: input.codigoItem,
        descricaoItem: input.descricaoItem,
        notaCarga: input.notaCarga,
        qtdProduzida: String(input.qtdProduzida),
        dataProducao: input.dataProducao,
        codigoLotePreview,
        motivo: input.motivo || null,
      });

      return { success: true, id: inserted.insertId, codigoLotePreview };
    }),

  /** Listar solicitações pendentes (para Bruno/Guilherme) */
  listPendingRetroactive: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(retroactiveLotRequests)
      .where(eq(retroactiveLotRequests.status, "pendente"))
      .orderBy(desc(retroactiveLotRequests.createdAt));
  }),

  /** Contar solicitações pendentes (para alerta piscando) */
  countPendingRetroactive: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { pending: 0 };
    const [result] = await db.select({ count: count() })
      .from(retroactiveLotRequests)
      .where(eq(retroactiveLotRequests.status, "pendente"));
    return { pending: result?.count || 0 };
  }),

  /** Aprovar solicitação retroativa e criar o lote */
  approveRetroactiveLot: publicProcedure
    .input(z.object({
      requestId: z.number(),
      aprovadorNome: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar a solicitação
      const [request] = await db.select().from(retroactiveLotRequests)
        .where(eq(retroactiveLotRequests.id, input.requestId));
      if (!request) throw new Error("Solicitação não encontrada");
      if (request.status !== "pendente") throw new Error("Solicitação já foi processada");

      // Verificar se o lote já existe
      const existing = await db.select().from(productionLots)
        .where(eq(productionLots.codigo, request.codigoLotePreview)).limit(1);
      
      let newLot;
      if (existing.length > 0) {
        // Lote já existe - apenas vincular ao existente
        newLot = existing[0];
      } else {
        // Criar o lote com a data retroativa
        await db.insert(productionLots).values({
          codigo: request.codigoLotePreview,
          codigoItem: request.codigoItem,
          descricaoItem: request.descricaoItem,
          notaCarga: request.notaCarga,
          dataProducao: request.dataProducao,
          qtdProduzida: String(request.qtdProduzida),
          saldoAtual: String(request.qtdProduzida),
          lancadoPor: request.solicitanteNome,
        });

        // Buscar o ID do lote criado
        [newLot] = await db.select().from(productionLots)
          .where(eq(productionLots.codigo, request.codigoLotePreview)).limit(1);
      }

      // Atualizar a solicitação como aprovada
      await db.update(retroactiveLotRequests)
        .set({
          status: "aprovado",
          aprovadorNome: input.aprovadorNome,
          dataDecisao: new Date(),
          loteCriadoId: newLot?.id || null,
          loteCriadoCodigo: request.codigoLotePreview,
        })
        .where(eq(retroactiveLotRequests.id, input.requestId));

      return { success: true, codigoLote: request.codigoLotePreview };
    }),

  /** Recusar solicitação retroativa */
  rejectRetroactiveLot: publicProcedure
    .input(z.object({
      requestId: z.number(),
      aprovadorNome: z.string(),
      motivoRecusa: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [request] = await db.select().from(retroactiveLotRequests)
        .where(eq(retroactiveLotRequests.id, input.requestId));
      if (!request) throw new Error("Solicitação não encontrada");
      if (request.status !== "pendente") throw new Error("Solicitação já foi processada");

      await db.update(retroactiveLotRequests)
        .set({
          status: "recusado",
          aprovadorNome: input.aprovadorNome,
          motivoRecusa: input.motivoRecusa || null,
          dataDecisao: new Date(),
        })
        .where(eq(retroactiveLotRequests.id, input.requestId));

      return { success: true };
    }),

  /** Histórico de todas as solicitações retroativas (aprovadas + recusadas) */
  retroactiveHistory: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(retroactiveLotRequests)
        .where(ne(retroactiveLotRequests.status, "pendente"))
        .orderBy(desc(retroactiveLotRequests.dataDecisao))
        .limit(input?.limit || 50);
    }),

  /** Listar solicitações do solicitante (para Maria/Erica verem o status) */
  myRetroactiveRequests: publicProcedure
    .input(z.object({
      solicitanteNome: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(retroactiveLotRequests)
        .where(eq(retroactiveLotRequests.solicitanteNome, input.solicitanteNome))
        .orderBy(desc(retroactiveLotRequests.createdAt))
        .limit(20);
    }),
});
