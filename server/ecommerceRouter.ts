/**
 * E-commerce Router - Despesas e Estornos da operação e-commerce (contas a pagar filial)
 * Acesso restrito: Pedro, Flavio, Guilherme
 */
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { ecommerceExpenses, ecommerceRefunds, depotInventory, ecommerceDailySales, ecommerceCreditCards, expenseAttachments } from "../drizzle/schema";
import { storagePut } from "./storage";
import { eq, desc, sql, and, asc } from "drizzle-orm";

const ECOMMERCE_ALLOWED_OPERATORS = ["Pedro", "Flavio", "Guilherme"];
const SALES_REPORT_ALLOWED = ["Pedro", "Fernando", "Bruno", "Guilherme"];

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
      recorrente: z.boolean().default(false),
      cartaoId: z.number().int().nullable().optional(),
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
        recorrente: input.recorrente ? 1 : 0,
        cartaoId: input.cartaoId || null,
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
   * Update an existing e-commerce expense
   */
  updateExpense: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      id: z.number(),
      descricao: z.string().min(1).max(500),
      dataCompra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      formaPagamento: z.enum(["pix", "boleto", "cartao_credito"]),
      parcelas: z.number().int().min(1).max(48).default(1),
      valorTotal: z.number().min(0.01),
      observacao: z.string().max(1000).optional(),
      recorrente: z.boolean().default(false),
      cartaoId: z.number().int().nullable().optional(),
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
        return { success: false, error: "Apenas quem registrou ou o admin pode editar" };
      }
      await db.update(ecommerceExpenses)
        .set({
          descricao: input.descricao.trim(),
          dataCompra: input.dataCompra,
          formaPagamento: input.formaPagamento,
          parcelas: input.parcelas,
          valorTotal: String(input.valorTotal),
          observacao: input.observacao?.trim() || null,
          recorrente: input.recorrente ? 1 : 0,
          cartaoId: input.formaPagamento === "cartao_credito" ? (input.cartaoId || null) : null,
        })
        .where(eq(ecommerceExpenses.id, input.id));
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

  // ============================================================
  // ESTORNOS
  // ============================================================

  /**
   * List all refunds (sorted by date desc)
   */
  listRefunds: publicProcedure
    .input(z.object({
      operatorName: z.string(),
    }))
    .query(async ({ input }) => {
      if (!ECOMMERCE_ALLOWED_OPERATORS.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado", refunds: [] };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível", refunds: [] };
      const rows = await db.select().from(ecommerceRefunds).orderBy(desc(ecommerceRefunds.dataEstorno));
      return { success: true, refunds: rows };
    }),

  /**
   * Add a new refund
   */
  addRefund: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      descricao: z.string().min(1).max(500),
      fornecedor: z.string().max(300).optional(),
      dataCompraOriginal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dataEstorno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      valorEstorno: z.number().min(0.01),
      motivo: z.enum(["produto_defeituoso", "produto_errado", "cancelamento", "duplicidade", "acordo_comercial", "outro"]),
      motivoDetalhe: z.string().max(1000).optional(),
      status: z.enum(["pendente", "creditado"]).default("pendente"),
      dataCreditado: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      observacao: z.string().max(1000).optional(),
    }))
    .mutation(async ({ input }) => {
      if (!ECOMMERCE_ALLOWED_OPERATORS.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível" };
      await db.insert(ecommerceRefunds).values({
        descricao: input.descricao.trim(),
        fornecedor: input.fornecedor?.trim() || null,
        dataCompraOriginal: input.dataCompraOriginal,
        dataEstorno: input.dataEstorno,
        valorEstorno: String(input.valorEstorno),
        motivo: input.motivo,
        motivoDetalhe: input.motivoDetalhe?.trim() || null,
        status: input.status,
        dataCreditado: input.dataCreditado || null,
        observacao: input.observacao?.trim() || null,
        registradoPor: input.operatorName,
      });
      return { success: true };
    }),

  /**
   * Update refund status (mark as credited) or edit details
   */
  updateRefund: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      id: z.number(),
      descricao: z.string().min(1).max(500).optional(),
      fornecedor: z.string().max(300).optional(),
      dataCompraOriginal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dataEstorno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      valorEstorno: z.number().min(0.01).optional(),
      motivo: z.enum(["produto_defeituoso", "produto_errado", "cancelamento", "duplicidade", "acordo_comercial", "outro"]).optional(),
      motivoDetalhe: z.string().max(1000).optional(),
      status: z.enum(["pendente", "creditado"]).optional(),
      dataCreditado: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      observacao: z.string().max(1000).optional(),
    }))
    .mutation(async ({ input }) => {
      if (!ECOMMERCE_ALLOWED_OPERATORS.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível" };
      const [existing] = await db.select().from(ecommerceRefunds).where(eq(ecommerceRefunds.id, input.id));
      if (!existing) return { success: false, error: "Estorno não encontrado" };

      const updates: Record<string, any> = {};
      if (input.descricao !== undefined) updates.descricao = input.descricao.trim();
      if (input.fornecedor !== undefined) updates.fornecedor = input.fornecedor.trim() || null;
      if (input.dataCompraOriginal !== undefined) updates.dataCompraOriginal = input.dataCompraOriginal;
      if (input.dataEstorno !== undefined) updates.dataEstorno = input.dataEstorno;
      if (input.valorEstorno !== undefined) updates.valorEstorno = String(input.valorEstorno);
      if (input.motivo !== undefined) updates.motivo = input.motivo;
      if (input.motivoDetalhe !== undefined) updates.motivoDetalhe = input.motivoDetalhe.trim() || null;
      if (input.status !== undefined) updates.status = input.status;
      if (input.dataCreditado !== undefined) updates.dataCreditado = input.dataCreditado;
      if (input.observacao !== undefined) updates.observacao = input.observacao.trim() || null;

      if (Object.keys(updates).length === 0) {
        return { success: false, error: "Nenhum campo para atualizar" };
      }

      await db.update(ecommerceRefunds).set(updates).where(eq(ecommerceRefunds.id, input.id));
      return { success: true };
    }),

  /**
   * Delete a refund (only the person who registered or Guilherme)
   */
  deleteRefund: publicProcedure
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
      const [refund] = await db.select().from(ecommerceRefunds).where(eq(ecommerceRefunds.id, input.id));
      if (!refund) return { success: false, error: "Estorno não encontrado" };
      if (refund.registradoPor !== input.operatorName && input.operatorName !== "Guilherme") {
        return { success: false, error: "Apenas quem registrou ou o admin pode excluir" };
      }
      await db.delete(ecommerceRefunds).where(eq(ecommerceRefunds.id, input.id));
      return { success: true };
    }),

  /**
   * Get refund summary totals
   */
  getRefundSummary: publicProcedure
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
        total: sql<string>`COALESCE(SUM(valor_estorno), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(ecommerceRefunds);

      // Por status
      const byStatus = await db.select({
        status: ecommerceRefunds.status,
        total: sql<string>`COALESCE(SUM(valor_estorno), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(ecommerceRefunds).groupBy(ecommerceRefunds.status);

      // Total do mês atual
      const now = new Date();
      const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [mesRow] = await db.select({
        total: sql<string>`COALESCE(SUM(valor_estorno), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(ecommerceRefunds).where(sql`data_estorno LIKE ${mesAtual + '%'}`);

      const pendente = byStatus.find(s => s.status === "pendente");
      const creditado = byStatus.find(s => s.status === "creditado");

      return {
        success: true,
        summary: {
          totalGeral: Number(totalRow?.total || 0),
          totalCount: Number(totalRow?.count || 0),
          mesAtual: { total: Number(mesRow?.total || 0), count: Number(mesRow?.count || 0) },
          pendente: { total: Number(pendente?.total || 0), count: Number(pendente?.count || 0) },
          creditado: { total: Number(creditado?.total || 0), count: Number(creditado?.count || 0) },
        },
      };
    }),

  /**
   * Get depot inventory - restricted to Guilherme only
   */
  getDepotInventory: publicProcedure
    .input(z.object({ operatorName: z.string() }))
    .query(async ({ input }) => {
      if (input.operatorName !== "Guilherme") {
        return { success: false, error: "Acesso restrito", items: [], total: 0 };
      }
      const db = await getDb();
      const items = await db!.select().from(depotInventory).orderBy(asc(depotInventory.sortOrder));
      const total = items.reduce((sum, i) => sum + i.quantityCx, 0);
      return { success: true, items, total };
    }),

  /**
   * Update depot inventory item quantity - restricted to Guilherme only
   */
  updateDepotItem: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      id: z.number(),
      quantityCx: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      if (input.operatorName !== "Guilherme") {
        return { success: false, error: "Acesso restrito" };
      }
      const db = await getDb();
      await db!.update(depotInventory)
        .set({ quantityCx: input.quantityCx })
        .where(eq(depotInventory.id, input.id));
      return { success: true };
    }),

  // ==================== Relatório de Vendas E-commerce ====================

  /**
   * List daily sales entries (sorted by date desc)
   */
  listDailySales: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      month: z.number().int().min(1).max(12).optional(),
      year: z.number().int().min(2020).max(2030).optional(),
    }))
    .query(async ({ input }) => {
      if (!SALES_REPORT_ALLOWED.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado", entries: [], summary: null };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível", entries: [], summary: null };

      let rows;
      if (input.month && input.year) {
        const startDate = new Date(Date.UTC(input.year, input.month - 1, 1));
        const endDate = new Date(Date.UTC(input.year, input.month, 0, 23, 59, 59));
        rows = await db.select().from(ecommerceDailySales)
          .where(and(
            sql`${ecommerceDailySales.saleDate} >= ${startDate}`,
            sql`${ecommerceDailySales.saleDate} <= ${endDate}`
          ))
          .orderBy(desc(ecommerceDailySales.saleDate));
      } else {
        rows = await db.select().from(ecommerceDailySales)
          .orderBy(desc(ecommerceDailySales.saleDate));
      }

      const totalSales = rows.reduce((s, r) => s + r.numberOfSales, 0);
      const totalValue = rows.reduce((s, r) => s + Number(r.totalValue), 0);
      const avgDaily = rows.length > 0 ? totalValue / rows.length : 0;
      const avgSalesPerDay = rows.length > 0 ? totalSales / rows.length : 0;

      return {
        success: true,
        entries: rows,
        summary: {
          totalEntries: rows.length,
          totalSales,
          totalValue,
          avgDailyValue: avgDaily,
          avgSalesPerDay,
        },
      };
    }),

  /**
   * Add a daily sales entry
   */
  addDailySale: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      numberOfSales: z.number().int().min(0),
      totalValue: z.number().min(0),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ input }) => {
      if (!SALES_REPORT_ALLOWED.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível" };

      const dateObj = new Date(input.saleDate + "T12:00:00Z");
      await db.insert(ecommerceDailySales).values({
        saleDate: dateObj,
        numberOfSales: input.numberOfSales,
        totalValue: input.totalValue.toFixed(2),
        notes: input.notes || null,
        createdBy: input.operatorName,
      });
      return { success: true };
    }),

  /**
   * Update a daily sales entry
   */
  updateDailySale: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      id: z.number(),
      numberOfSales: z.number().int().min(0),
      totalValue: z.number().min(0),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ input }) => {
      if (!SALES_REPORT_ALLOWED.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível" };
      await db.update(ecommerceDailySales)
        .set({
          numberOfSales: input.numberOfSales,
          totalValue: input.totalValue.toFixed(2),
          notes: input.notes || null,
        })
        .where(eq(ecommerceDailySales.id, input.id));
      return { success: true };
    }),

  /**
   * Delete a daily sales entry
   */
  deleteDailySale: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      if (!SALES_REPORT_ALLOWED.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível" };
      await db.delete(ecommerceDailySales).where(eq(ecommerceDailySales.id, input.id));
      return { success: true };
    }),

  // ─── Cartões de Crédito ───

  /**
   * List all credit cards
   */
  listCreditCards: publicProcedure
    .input(z.object({ operatorName: z.string() }))
    .query(async ({ input }) => {
      if (!ECOMMERCE_ALLOWED_OPERATORS.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado", cards: [] };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível", cards: [] };
      const rows = await db.select().from(ecommerceCreditCards).orderBy(asc(ecommerceCreditCards.nome));
      return { success: true, cards: rows };
    }),

  /**
   * Add a new credit card
   */
  addCreditCard: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      nome: z.string().min(1).max(200),
      bandeira: z.string().min(1).max(50),
      ultimos4: z.string().regex(/^\d{4}$/),
      titular: z.string().min(1).max(200),
    }))
    .mutation(async ({ input }) => {
      if (!ECOMMERCE_ALLOWED_OPERATORS.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível" };
      await db.insert(ecommerceCreditCards).values({
        nome: input.nome.trim(),
        bandeira: input.bandeira.trim(),
        ultimos4: input.ultimos4,
        titular: input.titular.trim(),
        registradoPor: input.operatorName,
      });
      return { success: true };
    }),

  /**
   * Update a credit card
   */
  updateCreditCard: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      id: z.number(),
      nome: z.string().min(1).max(200),
      bandeira: z.string().min(1).max(50),
      ultimos4: z.string().regex(/^\d{4}$/),
      titular: z.string().min(1).max(200),
      ativo: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      if (!ECOMMERCE_ALLOWED_OPERATORS.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível" };
      await db.update(ecommerceCreditCards)
        .set({
          nome: input.nome.trim(),
          bandeira: input.bandeira.trim(),
          ultimos4: input.ultimos4,
          titular: input.titular.trim(),
          ativo: input.ativo ? 1 : 0,
        })
        .where(eq(ecommerceCreditCards.id, input.id));
      return { success: true };
    }),

  /**
   * Delete a credit card (only if no expenses reference it)
   */
  deleteCreditCard: publicProcedure
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
      // Check if any expense references this card
      const [usage] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(ecommerceExpenses)
        .where(eq(ecommerceExpenses.cartaoId, input.id));
      if (usage && usage.count > 0) {
        return { success: false, error: `Cartão em uso por ${usage.count} despesa(s). Desative-o em vez de excluir.` };
      }
      await db.delete(ecommerceCreditCards).where(eq(ecommerceCreditCards.id, input.id));
      return { success: true };
    }),

  // ==================== ANEXOS (CLIPS) ====================

  /**
   * Upload an attachment to an expense
   * Receives base64-encoded file data, uploads to S3, saves metadata
   */
  uploadAttachment: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      expenseId: z.number(),
      fileName: z.string().min(1).max(500),
      fileData: z.string(), // base64-encoded file content
      mimeType: z.string(),
      fileSize: z.number(),
    }))
    .mutation(async ({ input }) => {
      if (!ECOMMERCE_ALLOWED_OPERATORS.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível" };

      // Validate expense exists
      const [expense] = await db.select().from(ecommerceExpenses).where(eq(ecommerceExpenses.id, input.expenseId));
      if (!expense) return { success: false, error: "Despesa não encontrada" };

      // Validate file size (max 10MB)
      if (input.fileSize > 10 * 1024 * 1024) {
        return { success: false, error: "Arquivo muito grande (máx. 10MB)" };
      }

      // Validate mime type
      const allowedTypes = [
        "application/pdf",
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
        "application/vnd.ms-excel", // xls
        "text/csv",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
      ];
      if (!allowedTypes.includes(input.mimeType)) {
        return { success: false, error: "Tipo de arquivo não permitido. Use PDF, imagem, Excel ou CSV." };
      }

      try {
        // Upload to S3
        const buffer = Buffer.from(input.fileData, "base64");
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const sanitizedName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileKey = `expense-attachments/${input.expenseId}/${randomSuffix}-${sanitizedName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // Save metadata to DB
        await db.insert(expenseAttachments).values({
          expenseId: input.expenseId,
          fileName: input.fileName,
          fileUrl: url,
          fileKey: fileKey,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          uploadedBy: input.operatorName,
        });

        return { success: true, url };
      } catch (err: any) {
        return { success: false, error: `Erro ao fazer upload: ${err.message}` };
      }
    }),

  /**
   * List attachments for a specific expense
   */
  listAttachments: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      expenseId: z.number(),
    }))
    .query(async ({ input }) => {
      if (!ECOMMERCE_ALLOWED_OPERATORS.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado", attachments: [] };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível", attachments: [] };
      const rows = await db.select().from(expenseAttachments)
        .where(eq(expenseAttachments.expenseId, input.expenseId))
        .orderBy(desc(expenseAttachments.createdAt));
      return { success: true, attachments: rows };
    }),

  /**
   * Get attachment counts for all expenses (for showing badge)
   */
  getAttachmentCounts: publicProcedure
    .input(z.object({
      operatorName: z.string(),
    }))
    .query(async ({ input }) => {
      if (!ECOMMERCE_ALLOWED_OPERATORS.includes(input.operatorName)) {
        return { success: false, error: "Acesso negado", counts: {} };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB indisponível", counts: {} };
      const rows = await db.select({
        expenseId: expenseAttachments.expenseId,
        count: sql<number>`COUNT(*)`,
      }).from(expenseAttachments).groupBy(expenseAttachments.expenseId);
      const counts: Record<number, number> = {};
      for (const row of rows) {
        counts[row.expenseId] = row.count;
      }
      return { success: true, counts };
    }),

  /**
   * Delete an attachment (only the uploader or Guilherme can delete)
   */
  deleteAttachment: publicProcedure
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
      const [attachment] = await db.select().from(expenseAttachments).where(eq(expenseAttachments.id, input.id));
      if (!attachment) return { success: false, error: "Anexo não encontrado" };
      if (attachment.uploadedBy !== input.operatorName && input.operatorName !== "Guilherme") {
        return { success: false, error: "Apenas quem enviou ou o admin pode excluir" };
      }
      await db.delete(expenseAttachments).where(eq(expenseAttachments.id, input.id));
      return { success: true };
    }),
});
