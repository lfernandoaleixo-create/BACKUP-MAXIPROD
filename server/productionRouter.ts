import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { productionSectors, productionMachines, productionEntries } from "../drizzle/schema";
import { eq, and, sql, desc, gte, lte, between } from "drizzle-orm";

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
      data: z.string().optional(), // YYYY-MM-DD, default = hoje
      sectorId: z.number().optional(), // filtrar por setor
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
   */
  upsertEntry: publicProcedure
    .input(z.object({
      sectorId: z.number(),
      machineId: z.number().nullable(),
      data: z.string(), // YYYY-MM-DD
      quantidade: z.number(),
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
        // Update
        await db
          .update(productionEntries)
          .set({
            quantidade: String(input.quantidade),
            observacoes: input.observacoes || null,
            lancadoPor: input.lancadoPor || null,
          })
          .where(eq(productionEntries.id, existing[0].id));
        return { id: existing[0].id, action: "updated" };
      } else {
        // Insert
        const result = await db.insert(productionEntries).values({
          sectorId: input.sectorId,
          machineId: input.machineId,
          data: input.data,
          quantidade: String(input.quantidade),
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
   * Histórico de produção por período (para relatórios/gráficos)
   */
  getHistory: publicProcedure
    .input(z.object({
      dataInicio: z.string(), // YYYY-MM-DD
      dataFim: z.string(), // YYYY-MM-DD
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
      data: z.string().optional(), // YYYY-MM-DD, default = hoje
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
      dataInicio: z.string(), // YYYY-MM-DD (segunda)
      dataFim: z.string(), // YYYY-MM-DD (domingo)
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
});
