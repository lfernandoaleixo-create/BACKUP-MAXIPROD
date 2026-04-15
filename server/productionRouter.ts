import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { productionSectors, productionMachines, productionEntries, dashboardData, stockItems, madeiraStock, stockEditHistory } from "../drizzle/schema";
import { eq, and, or, sql, desc, gte, lte, inArray } from "drizzle-orm";

/** Status válidos para máquinas de produção */
export const MACHINE_STATUS_OPTIONS = [
  { value: "producao_normal", label: "Produção Normal", color: "#10b981" },
  { value: "falta_madeira", label: "Falta de Madeira", color: "#ef4444" },
  { value: "producao_nao_necessaria", label: "Produção Não Necessária", color: "#f59e0b" },
  { value: "manutencao", label: "Manutenção", color: "#6366f1" },
  { value: "manutencao_pontual", label: "Manutenção Pontual", color: "#8b5cf6" },
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
        previousQty = parseFloat(String(existing[0].quantidade)) || 0;
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
      // Identifica Embalagem: machineId é null e tipoMadeira contém o codigoItem do produto
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
          const diff = input.quantidade - previousQty;

          if (diff !== 0) {
            // Get current stock value
            const stockRows = await db.select().from(madeiraStock).where(eq(madeiraStock.codigoItem, codigoItem));
            const currentStock = stockRows.length > 0 ? parseFloat(String(stockRows[0].quantidade)) : 0;
            const newStock = Math.max(0, currentStock + diff); // Não deixar ficar negativo

            // Record history
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
          oldQtyMap.set(old.tipoMadeira, (oldQtyMap.get(old.tipoMadeira) || 0) + parseFloat(String(old.quantidade)));
        }
      }

      // 3. Delete old entries whose tipoMadeira is NOT in the new set
      for (const old of allExisting) {
        const oldVariant = old.tipoMadeira || null;
        if (!newVariants.has(oldVariant)) {
          await db.delete(productionEntries).where(eq(productionEntries.id, old.id));
          results.push({ tipoMadeira: oldVariant, action: "deleted" });
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
            newQtyMap.set(entry.tipoMadeira, (newQtyMap.get(entry.tipoMadeira) || 0) + entry.quantidade);
          }
        }

        // Combine all codigoItems from old and new
        const allCodigos = Array.from(new Set([...Array.from(oldQtyMap.keys()), ...Array.from(newQtyMap.keys())]));
        const lancadoPor = input.entries[0]?.lancadoPor || "Sistema";

        for (const codigoItem of allCodigos) {
          const oldQty = oldQtyMap.get(codigoItem) || 0;
          const newQty = newQtyMap.get(codigoItem) || 0;
          const diff = newQty - oldQty;

          if (diff !== 0) {
            const stockRows = await db.select().from(madeiraStock).where(eq(madeiraStock.codigoItem, codigoItem));
            const currentStock = stockRows.length > 0 ? parseFloat(String(stockRows[0].quantidade)) : 0;
            const newStock = Math.max(0, currentStock + diff);

            await db.insert(stockEditHistory).values({
              card: "madeira",
              codigoItem,
              descricaoItem: null,
              valorAnterior: String(currentStock),
              valorNovo: String(newStock),
              operador: `Produção (${lancadoPor})`,
              tipo: "alteracao",
            });

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

      return { count: results.length, results };
    }),

  deleteEntry: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(productionEntries).where(eq(productionEntries.id, input.id));
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
      return db
        .select({
          sectorId: productionEntries.sectorId,
          data: productionEntries.data,
          total: sql<string>`SUM(${productionEntries.quantidade})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(productionEntries)
        .where(and(
          gte(productionEntries.data, input.dataInicio),
          lte(productionEntries.data, input.dataFim),
        ))
        .groupBy(productionEntries.sectorId, productionEntries.data)
        .orderBy(productionEntries.data, productionEntries.sectorId);
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
    .input(z.object({ categoria: z.enum(["madeira", "bambu"]).optional() }).optional())
    .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const categoria = input?.categoria || "madeira";
    
    let whereClause;
    if (categoria === "bambu") {
      // Bambu/Importação: superGrupoCodigo = "12" (Importação revenda: bambu, fibra)
      whereClause = eq(stockItems.superGrupoCodigo, "12");
    } else {
      // Madeira PA: superGrupoCodigo = "05" OR ("16" AND grupoCodigo IN ("18","19"))
      whereClause = or(
        eq(stockItems.superGrupoCodigo, "05"),
        and(
          eq(stockItems.superGrupoCodigo, "16"),
          inArray(stockItems.grupoCodigo, ["18", "19"])
        )
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
          embalagemMap.set(e.tipoMadeira, (embalagemMap.get(e.tipoMadeira) || 0) + (parseFloat(String(e.quantidade)) || 0));
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
});
