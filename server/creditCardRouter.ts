/**
 * Router para Planilha de Cartões de Crédito
 * Acesso restrito: Guilherme e Flavio
 */
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { creditCards, creditCardEntries } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

const CREDIT_CARD_ALLOWED = ["Guilherme", "Flavio"];

export const creditCardRouter = router({
  /**
   * List all credit cards
   */
  listCards: publicProcedure
    .input(z.object({ operatorName: z.string() }))
    .query(async ({ input }) => {
      if (!CREDIT_CARD_ALLOWED.includes(input.operatorName)) {
        return { success: false, error: "Acesso restrito a Guilherme e Flávio", cards: [] };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB unavailable", cards: [] };
      const cards = await db.select().from(creditCards).orderBy(desc(creditCards.createdAt));
      return { success: true, cards };
    }),

  /**
   * Create a new credit card
   */
  createCard: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      titularCartao: z.string().min(1).max(200),
      vencimentoFatura: z.number().int().min(1).max(31).optional(),
      fechamentoFatura: z.number().int().min(1).max(31).optional(),
      previsaoPagamento: z.string().max(100).optional(),
      limiteTotal: z.number().min(0).optional(),
      limiteUtilizado: z.number().min(0).optional(),
      limiteDisponivel: z.number().min(0).optional(),
      automatizar: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      if (!CREDIT_CARD_ALLOWED.includes(input.operatorName)) {
        return { success: false, error: "Acesso restrito" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB unavailable" };
      const result = await db.insert(creditCards).values({
        titularCartao: input.titularCartao.trim(),
        vencimentoFatura: input.vencimentoFatura ?? null,
        fechamentoFatura: input.fechamentoFatura ?? null,
        previsaoPagamento: input.previsaoPagamento?.trim() || null,
        limiteTotal: input.limiteTotal?.toString() || null,
        limiteUtilizado: input.limiteUtilizado?.toString() || null,
        limiteDisponivel: input.limiteDisponivel?.toString() || null,
        automatizar: input.automatizar ?? false,
      });
      return { success: true, id: Number(result[0].insertId) };
    }),

  /**
   * Update a credit card header
   */
  updateCard: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      id: z.number(),
      titularCartao: z.string().min(1).max(200).optional(),
      vencimentoFatura: z.number().int().min(1).max(31).nullable().optional(),
      fechamentoFatura: z.number().int().min(1).max(31).nullable().optional(),
      previsaoPagamento: z.string().max(100).nullable().optional(),
      limiteTotal: z.number().min(0).nullable().optional(),
      limiteUtilizado: z.number().min(0).nullable().optional(),
      limiteDisponivel: z.number().min(0).nullable().optional(),
      automatizar: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      if (!CREDIT_CARD_ALLOWED.includes(input.operatorName)) {
        return { success: false, error: "Acesso restrito" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB unavailable" };
      const updates: Record<string, any> = {};
      if (input.titularCartao !== undefined) updates.titularCartao = input.titularCartao.trim();
      if (input.vencimentoFatura !== undefined) updates.vencimentoFatura = input.vencimentoFatura;
      if (input.fechamentoFatura !== undefined) updates.fechamentoFatura = input.fechamentoFatura;
      if (input.previsaoPagamento !== undefined) updates.previsaoPagamento = input.previsaoPagamento?.trim() || null;
      if (input.limiteTotal !== undefined) updates.limiteTotal = input.limiteTotal?.toString() || null;
      if (input.limiteUtilizado !== undefined) updates.limiteUtilizado = input.limiteUtilizado?.toString() || null;
      if (input.limiteDisponivel !== undefined) updates.limiteDisponivel = input.limiteDisponivel?.toString() || null;
      if (input.automatizar !== undefined) updates.automatizar = input.automatizar;
      await db.update(creditCards).set(updates).where(eq(creditCards.id, input.id));
      return { success: true };
    }),

  /**
   * Delete a credit card (and all its entries)
   */
  deleteCard: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      if (!CREDIT_CARD_ALLOWED.includes(input.operatorName)) {
        return { success: false, error: "Acesso restrito" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB unavailable" };
      // Delete entries first
      await db.delete(creditCardEntries).where(eq(creditCardEntries.cardId, input.id));
      await db.delete(creditCards).where(eq(creditCards.id, input.id));
      return { success: true };
    }),

  /**
   * List entries for a specific card
   */
  listEntries: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      cardId: z.number(),
    }))
    .query(async ({ input }) => {
      if (!CREDIT_CARD_ALLOWED.includes(input.operatorName)) {
        return { success: false, error: "Acesso restrito", entries: [] };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB unavailable", entries: [] };
      const entries = await db.select().from(creditCardEntries)
        .where(eq(creditCardEntries.cardId, input.cardId))
        .orderBy(desc(creditCardEntries.createdAt));
      return { success: true, entries };
    }),

  /**
   * Create a new entry (despesa parcelada)
   * mesInicio é calculado automaticamente:
   * - Se dataCompra <= dia de fechamento do cartão → parcela começa no mês da compra
   * - Se dataCompra > dia de fechamento → parcela começa no mês seguinte
   */
  createEntry: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      cardId: z.number(),
      dataCompra: z.string().min(1), // YYYY-MM-DD obrigatório para calcular mesInicio
      estabelecimento: z.string().max(200).optional(),
      descricaoDespesa: z.string().max(500).optional(),
      centroDeCusto: z.string().max(200).optional(),
      valorTotal: z.number().min(0),
      quantParcelas: z.number().int().min(1).default(1),
      valorParcela: z.number().min(0).optional(),
    }))
    .mutation(async ({ input }) => {
      if (!CREDIT_CARD_ALLOWED.includes(input.operatorName)) {
        return { success: false, error: "Acesso restrito" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB unavailable" };
      
      // Buscar dados do cartão para pegar fechamentoFatura
      const [card] = await db.select().from(creditCards).where(eq(creditCards.id, input.cardId));
      if (!card) return { success: false, error: "Cartão não encontrado" };
      
      // Calcular mesInicio automaticamente
      const fechamento = card.fechamentoFatura || 1; // dia de fechamento (default: dia 1)
      const [year, month, day] = input.dataCompra.split("-").map(Number);
      let mesInicio: string;
      if (day <= fechamento) {
        // Compra antes ou no dia do fechamento → entra na fatura desse mês
        mesInicio = `${year}-${String(month).padStart(2, "0")}`;
      } else {
        // Compra depois do fechamento → entra na fatura do mês seguinte
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        mesInicio = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
      }
      
      const valorParcela = input.valorParcela ?? (input.valorTotal / input.quantParcelas);
      const result = await db.insert(creditCardEntries).values({
        cardId: input.cardId,
        dataCompra: input.dataCompra,
        estabelecimento: input.estabelecimento?.trim() || null,
        descricaoDespesa: input.descricaoDespesa?.trim() || null,
        centroDeCusto: input.centroDeCusto?.trim() || null,
        valorTotal: input.valorTotal.toString(),
        quantParcelas: input.quantParcelas,
        valorParcela: valorParcela.toString(),
        mesInicio,
      });
      return { success: true, id: Number(result[0].insertId) };
    }),

  /**
   * Update an entry
   * mesInicio é recalculado automaticamente quando dataCompra muda
   */
  updateEntry: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      id: z.number(),
      dataCompra: z.string().nullable().optional(),
      estabelecimento: z.string().max(200).nullable().optional(),
      descricaoDespesa: z.string().max(500).nullable().optional(),
      centroDeCusto: z.string().max(200).nullable().optional(),
      valorTotal: z.number().min(0).optional(),
      quantParcelas: z.number().int().min(1).optional(),
      valorParcela: z.number().min(0).optional(),
    }))
    .mutation(async ({ input }) => {
      if (!CREDIT_CARD_ALLOWED.includes(input.operatorName)) {
        return { success: false, error: "Acesso restrito" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB unavailable" };
      
      // Buscar o entry atual para pegar o cardId
      const [currentEntry] = await db.select().from(creditCardEntries).where(eq(creditCardEntries.id, input.id));
      if (!currentEntry) return { success: false, error: "Lançamento não encontrado" };
      
      const updates: Record<string, any> = {};
      if (input.dataCompra !== undefined) updates.dataCompra = input.dataCompra;
      if (input.estabelecimento !== undefined) updates.estabelecimento = input.estabelecimento?.trim() || null;
      if (input.descricaoDespesa !== undefined) updates.descricaoDespesa = input.descricaoDespesa?.trim() || null;
      if (input.centroDeCusto !== undefined) updates.centroDeCusto = input.centroDeCusto?.trim() || null;
      if (input.valorTotal !== undefined) updates.valorTotal = input.valorTotal.toString();
      if (input.quantParcelas !== undefined) updates.quantParcelas = input.quantParcelas;
      if (input.valorParcela !== undefined) updates.valorParcela = input.valorParcela.toString();
      
      // Recalcular mesInicio se dataCompra mudou
      const finalDataCompra = input.dataCompra !== undefined ? input.dataCompra : currentEntry.dataCompra;
      if (finalDataCompra) {
        const [card] = await db.select().from(creditCards).where(eq(creditCards.id, currentEntry.cardId));
        if (card) {
          const fechamento = card.fechamentoFatura || 1;
          const [year, month, day] = finalDataCompra.split("-").map(Number);
          if (day <= fechamento) {
            updates.mesInicio = `${year}-${String(month).padStart(2, "0")}`;
          } else {
            const nextMonth = month === 12 ? 1 : month + 1;
            const nextYear = month === 12 ? year + 1 : year;
            updates.mesInicio = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
          }
        }
      }
      
      await db.update(creditCardEntries).set(updates).where(eq(creditCardEntries.id, input.id));
      return { success: true };
    }),

  /**
   * Delete an entry
   */
  deleteEntry: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      if (!CREDIT_CARD_ALLOWED.includes(input.operatorName)) {
        return { success: false, error: "Acesso restrito" };
      }
      const db = await getDb();
      if (!db) return { success: false, error: "DB unavailable" };
      await db.delete(creditCardEntries).where(eq(creditCardEntries.id, input.id));
      return { success: true };
    }),
});
