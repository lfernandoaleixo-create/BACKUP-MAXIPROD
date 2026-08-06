import { z } from "zod";
import { publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { unidentifiedPayments } from "../drizzle/schema";
import { eq, desc, and, ne } from "drizzle-orm";

export const unidentifiedPaymentsRouter = {
  /** Get all pending/identified payments (not resolved) */
  getActive: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(unidentifiedPayments)
      .where(ne(unidentifiedPayments.status, "resolvido"))
      .orderBy(desc(unidentifiedPayments.createdAt));
  }),

  /** Get resolved payments (history) */
  getHistory: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(unidentifiedPayments)
      .where(eq(unidentifiedPayments.status, "resolvido"))
      .orderBy(desc(unidentifiedPayments.dataResolvido));
  }),

  /** Get count of pending payments (for alert badge) */
  getPendingCount: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return 0;
    const rows = await db.select().from(unidentifiedPayments)
      .where(eq(unidentifiedPayments.status, "pendente"));
    return rows.length;
  }),

  /** Financeiro creates a new unidentified payment */
  create: publicProcedure
    .input(z.object({
      dataPagamento: z.string(),
      formaPagamento: z.string(),
      valorPagamento: z.string(),
      nomePagador: z.string().optional(),
      criadoPor: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.insert(unidentifiedPayments).values({
        dataPagamento: input.dataPagamento,
        formaPagamento: input.formaPagamento,
        valorPagamento: input.valorPagamento,
        nomePagador: input.nomePagador || null,
        criadoPor: input.criadoPor,
        status: "pendente",
      });
      return { success: true };
    }),

  /** Comercial identifies the client (fills nomeCliente, vendedorResponsavel auto-filled) */
  identify: publicProcedure
    .input(z.object({
      id: z.number(),
      nomeCliente: z.string(),
      vendedorResponsavel: z.string(),
      numeroPedido: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(unidentifiedPayments)
        .set({
          nomeCliente: input.nomeCliente,
          vendedorResponsavel: input.vendedorResponsavel,
          identificadoPor: input.vendedorResponsavel,
          numeroPedido: input.numeroPedido || null,
          status: "identificado",
          dataIdentificado: new Date(),
        })
        .where(eq(unidentifiedPayments.id, input.id));
      return { success: true };
    }),

  /** Financeiro marks as resolved */
  resolve: publicProcedure
    .input(z.object({
      id: z.number(),
      resolvidoPor: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(unidentifiedPayments)
        .set({
          status: "resolvido",
          resolvidoPor: input.resolvidoPor,
          dataResolvido: new Date(),
        })
        .where(eq(unidentifiedPayments.id, input.id));
      return { success: true };
    }),

  /** Delete a payment (only if still pending) */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(unidentifiedPayments)
        .where(and(
          eq(unidentifiedPayments.id, input.id),
          eq(unidentifiedPayments.status, "pendente")
        ));
      return { success: true };
    }),

  /** Delete any payment record (admin only - for Guilherme) */
  deleteAny: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(unidentifiedPayments)
        .where(eq(unidentifiedPayments.id, input.id));
      return { success: true };
    }),
};
