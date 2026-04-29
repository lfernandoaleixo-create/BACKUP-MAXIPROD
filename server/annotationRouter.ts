import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { annotationEntries } from "../drizzle/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";

/**
 * Router para anotações avulsas de produção (Queijo Coalho, Alídio).
 * NÃO contabilizam no total do setor — são apenas registros de acompanhamento.
 */
export const annotationRouter = router({
  /**
   * Buscar anotações por data e tipo
   */
  getEntries: publicProcedure
    .input(z.object({
      data: z.string(),
      tipo: z.string().optional(),
      sectorId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(annotationEntries.data, input.data)];
      if (input.tipo) conditions.push(eq(annotationEntries.tipo, input.tipo));
      if (input.sectorId) conditions.push(eq(annotationEntries.sectorId, input.sectorId));
      return db
        .select()
        .from(annotationEntries)
        .where(and(...conditions))
        .orderBy(desc(annotationEntries.createdAt));
    }),

  /**
   * Buscar histórico de anotações por período
   */
  getHistory: publicProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      tipo: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [
        gte(annotationEntries.data, input.startDate),
        lte(annotationEntries.data, input.endDate),
      ];
      if (input.tipo) conditions.push(eq(annotationEntries.tipo, input.tipo));
      return db
        .select()
        .from(annotationEntries)
        .where(and(...conditions))
        .orderBy(desc(annotationEntries.data), desc(annotationEntries.createdAt));
    }),

  /**
   * Criar nova anotação
   */
  create: publicProcedure
    .input(z.object({
      tipo: z.string(),
      data: z.string(),
      sectorId: z.number().optional(),
      quantidade: z.number().min(0),
      observacoes: z.string().optional(),
      lancadoPor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db.insert(annotationEntries).values({
        tipo: input.tipo,
        data: input.data,
        sectorId: input.sectorId || null,
        quantidade: String(input.quantidade),
        observacoes: input.observacoes || null,
        lancadoPor: input.lancadoPor || null,
      });
      return { id: result[0].insertId, success: true };
    }),

  /**
   * Atualizar anotação existente
   */
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      quantidade: z.number().min(0).optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const updateData: any = {};
      if (input.quantidade !== undefined) updateData.quantidade = String(input.quantidade);
      if (input.observacoes !== undefined) updateData.observacoes = input.observacoes;
      await db.update(annotationEntries).set(updateData).where(eq(annotationEntries.id, input.id));
      return { success: true };
    }),

  /**
   * Remover anotação (soft delete: set quantidade to 0)
   */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(annotationEntries)
        .set({ quantidade: "0", observacoes: "[REMOVIDO]" })
        .where(eq(annotationEntries.id, input.id));
      return { success: true };
    }),
});
