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

/** Tipos de madeira disponíveis */
export const WOOD_TYPE_OPTIONS = [
  { value: "benazzi", label: "Benazzi", color: "#d97706" },
  { value: "madeira_dura", label: "Madeira Dura", color: "#059669" },
] as const;

export const productionRouter = router({
  /**
   * Listar todos os setores com suas máquinas
   */
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

  /**
   * Buscar lançamentos de produção de um dia específico (ou hoje)
   */
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

      const entries = await db
        .select()
        .from(productionEntries)
        .where(and(...conditions))
        .orderBy(productionEntries.sectorId, productionEntries.machineId);

      return entries;
    }),

  /**
   * Lançar ou atualizar produção de uma máquina/setor em um dia
   * Aceita quantidade zero, campo status, tipoMadeira e observações
   */
  upsertEntry: publicProcedure
    .input(z.object({
      sectorId: z.number(),
      machineId: z.number().nullable(),
      data: z.string(),
      quantidade: z.number().min(0),
      status: z.string().optional().default("producao_normal"),
      tipoMadeira: z.string().optional(), // "benazzi", "madeira_dura", "benazzi,madeira_dura"
      observacoes: z.string().optional(),
      lancadoPor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if entry already exists for this sector/machine/date
      const conditions = [
        eq(productionEntries.sectorId, input.sectorId),
        eq(productionEntries.data, input.data),
      ];
      if (input.machineId) {
        conditions.push(eq(productionEntries.machineId, input.machineId));
      } else {
        conditions.push(sql`${productionEntries.machineId} IS NULL`);
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
            tipoMadeira: input.tipoMadeira || null,
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
   * Deletar um lançamento de produção
   */
  deleteEntry: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(productionEntries).where(eq(productionEntries.id, input.id));
      return { success: true };
    }),

  /**
   * Histórico de produção por período
   */
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

      const entries = await db
        .select()
        .from(productionEntries)
        .where(and(...conditions))
        .orderBy(desc(productionEntries.data), productionEntries.sectorId);

      return entries;
    }),

  /**
   * Resumo diário: total produzido por setor em um dia
   */
  getDailySummary: publicProcedure
    .input(z.object({
      data: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const targetDate = input.data || new Date().toISOString().slice(0, 10);

      const result = await db
        .select({
          sectorId: productionEntries.sectorId,
          total: sql<string>`SUM(${productionEntries.quantidade})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(productionEntries)
        .where(eq(productionEntries.data, targetDate))
        .groupBy(productionEntries.sectorId);

      return result;
    }),

  /**
   * Resumo semanal: total por setor por dia da semana
   */
  getWeeklySummary: publicProcedure
    .input(z.object({
      dataInicio: z.string(),
      dataFim: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const result = await db
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

      return result;
    }),

  /**
   * Retornar opções de status e tipo de madeira
   */
  getStatusOptions: publicProcedure.query(() => {
    return { statusOptions: MACHINE_STATUS_OPTIONS, woodTypeOptions: WOOD_TYPE_OPTIONS };
  }),
});
