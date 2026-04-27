/**
 * E-commerce Router - Despesas da operação e-commerce (contas a pagar filial)
 * Acesso restrito: Pedro, Flavio, Guilherme
 */
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { ecommerceExpenses } from "../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

const ECOMMERCE_ALLOWED_OPERATORS = ["Pedro", "Flavio", "Guilherme"];

export const ecommerceRouter = router({
  /**
   * List all e-commerce expenses (sorted by date desc)
   */
  listExpenses: publicProcedure
    .input(z.object({
      operatorName: z.string(),
    }))
    .query(async ({ input }) => {
      if (!ECOMMERCE_ALLOWED_OPERATORS.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado", expenses: [] };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível", expenses: [] };
      const rows = await db.select().from(ecommerceExpenses).orderBy(desc(ecommerceExpenses.dataCompra));
      return { success: true, expenses: rows };
    }),

  /**
   * Add a new e-commerce expense
   */
  addExpense: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      descricao: z.string().min(1).max(500),
      dataCompra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      formaPagamento: z.enum(["pix", "boleto", "cartao_credito"]),
      parcelas: z.number().int().min(1).max(48).default(1),
      valorTotal: z.number().min(0.01),
      observacao: z.string().max(1000).optional(),
    }))
    .mutation(async ({ input }) => {
      if (!ECOMMERCE_ALLOWED_OPERATORS.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível" };
      await db.insert(ecommerceExpenses).values({
        descricao: input.descricao.trim(),
        dataCompra: input.dataCompra,
        formaPagamento: input.formaPagamento,
        parcelas: input.parcelas,
        valorTotal: String(input.valorTotal),
        observacao: input.observacao?.trim() || null,
        registradoPor: input.operatorName,
      });
      return { success: true };
    }),

  /**
   * Delete an e-commerce expense (only the person who registered or Guilherme)
   */
  deleteExpense: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      if (!ECOMMERCE_ALLOWED_OPERATORS.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível" };
      const [expense] = await db.select().from(ecommerceExpenses).where(eq(ecommerceExpenses.id, input.id));
      if (!expense) return { success: false, error: "Despesa não encontrada" };
      if (expense.registradoPor !== input.operatorName && input.operatorName !== "Guilherme") {
        return { success: false, error: "Apenas quem registrou ou o admin pode excluir" };
      }
      await db.delete(ecommerceExpenses).where(eq(ecommerceExpenses.id, input.id));
      return { success: true };
    }),

  /**
   * Get summary totals for e-commerce expenses
   */
  getSummary: publicProcedure
    .input(z.object({
      operatorName: z.string(),
    }))
    .query(async ({ input }) => {
      if (!ECOMMERCE_ALLOWED_OPERATORS.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado", summary: null };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível", summary: null };
      
      // Total geral
      const [totalRow] = await db.select({
        total: sql<string>`COALESCE(SUM(valorTotal), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(ecommerceExpenses);

      // Total por forma de pagamento
      const byPayment = await db.select({
        formaPagamento: ecommerceExpenses.formaPagamento,
        total: sql<string>`COALESCE(SUM(valorTotal), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(ecommerceExpenses).groupBy(ecommerceExpenses.formaPagamento);

      // Total do mês atual
      const now = new Date();
      const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [mesRow] = await db.select({
        total: sql<string>`COALESCE(SUM(valorTotal), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(ecommerceExpenses).where(sql`dataCompra LIKE ${mesAtual + '%'}`);

      return {
        success: true,
        summary: {
          totalGeral: Number(totalRow?.total || 0),
          totalCount: Number(totalRow?.count || 0),
          mesAtual: { total: Number(mesRow?.total || 0), count: Number(mesRow?.count || 0) },
          porFormaPagamento: byPayment.map(r => ({
            forma: r.formaPagamento,
            total: Number(r.total),
            count: Number(r.count),
          })),
        },
      };
    }),
});
