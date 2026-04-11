import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { productionSectors, productionMachines, productionEntries } from "../drizzle/schema";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";

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
      status: z.string().optional().default("producao_normal"),
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

      if (existing.length > 0) {
        await db
          .update(productionEntries)
          .set({
            quantidade: String(input.quantidade),
            status: input.status || "producao_normal",
            observacoes: input.observacoes || null,
            lancadoPor: input.lancadoPor || null,
          })
          .where(eq(productionEntries.id, existing[0].id));
        return { id: existing[0].id, action: "updated" };
      } else {
        const result = await db.insert(productionEntries).values({
          sectorId: input.sectorId,
          machineId: input.machineId,
          data: input.data,
          quantidade: String(input.quantidade),
          status: input.status || "producao_normal",
          tipoMadeira: input.tipoMadeira || null,
          observacoes: input.observacoes || null,
          lancadoPor: input.lancadoPor || null,
        });
        return { id: result[0].insertId, action: "created" };
      }
    }),

  /**
   * Batch upsert: salvar múltiplos registros de uma vez (para quando há vários tipos/medidas selecionados)
   */
  batchUpsertEntries: publicProcedure
    .input(z.object({
      entries: z.array(z.object({
        sectorId: z.number(),
        machineId: z.number().nullable(),
        data: z.string(),
        quantidade: z.number().min(0),
        status: z.string().optional().default("producao_normal"),
        tipoMadeira: z.string().optional(),
        observacoes: z.string().optional(),
        lancadoPor: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const results: { tipoMadeira: string | null; action: string }[] = [];

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
              status: entry.status || "producao_normal",
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
            status: entry.status || "producao_normal",
            tipoMadeira: entry.tipoMadeira || null,
            observacoes: entry.observacoes || null,
            lancadoPor: entry.lancadoPor || null,
          });
          results.push({ tipoMadeira: entry.tipoMadeira || null, action: "created" });
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
});
