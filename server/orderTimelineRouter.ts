import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { orderTimelineRules } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Tipos de condição disponíveis para a Linha do Tempo
 */
export const CONDITION_TYPES = [
  { value: "sempre", label: "Sempre (todo pedido)" },
  { value: "apos_aprovacao_gestores", label: "Após aprovação dos gestores" },
  { value: "desconto_produto_acima", label: "Desconto dado no produto acima de" },
  { value: "desconto_produto_abaixo", label: "Desconto dado no produto abaixo de" },
  { value: "margem_pedido_acima", label: "Margem de lucro do pedido acima de" },
  { value: "margem_pedido_abaixo", label: "Margem de lucro do pedido abaixo de" },
  { value: "margem_mensal_acima", label: "Margem de lucro mensal acima de" },
  { value: "margem_mensal_abaixo", label: "Margem de lucro mensal abaixo de" },
  { value: "media_ponderada_descontos_acima", label: "Média ponderada dos descontos do mês acima de" },
  { value: "media_ponderada_descontos_abaixo", label: "Média ponderada dos descontos do mês abaixo de" },
] as const;

export const ACTION_TYPES = [
  { value: "visualizar", label: "Apenas Visualizar" },
  { value: "autorizar", label: "Precisa Autorizar" },
] as const;

export const orderTimelineRouter = router({
  /**
   * Get all rules for a specific seller
   */
  getRulesForSeller: publicProcedure
    .input(z.object({ sellerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rules = await db.select().from(orderTimelineRules)
        .where(eq(orderTimelineRules.sellerId, input.sellerId))
        .orderBy(orderTimelineRules.recipientName);
      return rules;
    }),

  /**
   * Get all rules (for admin overview)
   */
  getAllRules: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rules = await db.select().from(orderTimelineRules)
      .where(eq(orderTimelineRules.active, true))
      .orderBy(orderTimelineRules.sellerName, orderTimelineRules.recipientName);
    return rules;
  }),

  /**
   * Save rules for a seller-recipient pair (upsert: delete old + insert new)
   */
  saveRules: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      sellerName: z.string(),
      recipientId: z.number(),
      recipientName: z.string(),
      recipientType: z.string(),
      approvalPosition: z.number().min(1).default(1),
      rules: z.array(z.object({
        conditionType: z.string(),
        conditionValue: z.number().nullable(),
        actionType: z.string(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      // Delete existing rules for this seller-recipient pair
      await db.delete(orderTimelineRules).where(
        and(
          eq(orderTimelineRules.sellerId, input.sellerId),
          eq(orderTimelineRules.recipientId, input.recipientId)
        )
      );

      // Insert new rules
      if (input.rules.length > 0) {
        const now = new Date();
        await db.insert(orderTimelineRules).values(
          input.rules.map(rule => ({
            sellerId: input.sellerId,
            sellerName: input.sellerName,
            recipientId: input.recipientId,
            recipientName: input.recipientName,
            recipientType: input.recipientType,
            conditionType: rule.conditionType,
            conditionValue: rule.conditionValue !== null ? String(rule.conditionValue) : null,
            actionType: rule.actionType,
            approvalPosition: input.approvalPosition,
            active: true,
            createdAt: now,
            updatedAt: now,
          }))
        );
      }

      return { success: true };
    }),

  /**
   * Delete all rules for a seller-recipient pair (untick the recipient)
   */
  deleteRulesForRecipient: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      recipientId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      await db.delete(orderTimelineRules).where(
        and(
          eq(orderTimelineRules.sellerId, input.sellerId),
          eq(orderTimelineRules.recipientId, input.recipientId)
        )
      );

      return { success: true };
    }),

  /**
   * Get condition types and action types for the UI
   */
  getOptions: publicProcedure.query(() => {
    return {
      conditionTypes: CONDITION_TYPES,
      actionTypes: ACTION_TYPES,
    };
  }),

  /**
   * Check if a specific order should be routed to any recipients based on timeline rules.
   * This is called when a new order is created to determine the routing.
   */
  evaluateOrder: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      descontoProdutoMax: z.number().optional(), // Maior desconto dado em um produto do pedido (%)
      margemPedido: z.number().optional(), // Margem de lucro do pedido (%)
      margemMensal: z.number().optional(), // Margem de lucro mensal do vendedor (%)
      mediaPonderadaDescontos: z.number().optional(), // Média ponderada dos descontos do mês (%)
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const rules = await db.select().from(orderTimelineRules)
        .where(and(
          eq(orderTimelineRules.sellerId, input.sellerId),
          eq(orderTimelineRules.active, true)
        ));

      // Evaluate which recipients should receive this order
      const matchedRecipients: Array<{
        recipientId: number;
        recipientName: string;
        recipientType: string;
        actionType: string;
        approvalPosition: number;
        matchedConditions: string[];
      }> = [];

      // Group rules by recipient
      const byRecipient = new Map<number, typeof rules>();
      for (const rule of rules) {
        const existing = byRecipient.get(rule.recipientId) || [];
        existing.push(rule);
        byRecipient.set(rule.recipientId, existing);
      }

      for (const [recipientId, recipientRules] of Array.from(byRecipient.entries())) {
        const matchedConditions: string[] = [];
        let actionType = "visualizar"; // Default

        for (const rule of recipientRules) {
          const val = rule.conditionValue ? parseFloat(String(rule.conditionValue)) : null;
          let matches = false;

          switch (rule.conditionType) {
            case "sempre":
              matches = true;
              break;
            case "desconto_produto_acima":
              if (input.descontoProdutoMax !== undefined && val !== null) {
                matches = input.descontoProdutoMax > val;
              }
              break;
            case "desconto_produto_abaixo":
              if (input.descontoProdutoMax !== undefined && val !== null) {
                matches = input.descontoProdutoMax < val;
              }
              break;
            case "margem_pedido_acima":
              if (input.margemPedido !== undefined && val !== null) {
                matches = input.margemPedido > val;
              }
              break;
            case "margem_pedido_abaixo":
              if (input.margemPedido !== undefined && val !== null) {
                matches = input.margemPedido < val;
              }
              break;
            case "margem_mensal_acima":
              if (input.margemMensal !== undefined && val !== null) {
                matches = input.margemMensal > val;
              }
              break;
            case "margem_mensal_abaixo":
              if (input.margemMensal !== undefined && val !== null) {
                matches = input.margemMensal < val;
              }
              break;
            case "media_ponderada_descontos_acima":
              if (input.mediaPonderadaDescontos !== undefined && val !== null) {
                matches = input.mediaPonderadaDescontos > val;
              }
              break;
            case "media_ponderada_descontos_abaixo":
              if (input.mediaPonderadaDescontos !== undefined && val !== null) {
                matches = input.mediaPonderadaDescontos < val;
              }
              break;
          }

          if (matches) {
            matchedConditions.push(rule.conditionType);
            // If any matched rule requires authorization, upgrade the action
            if (rule.actionType === "autorizar") {
              actionType = "autorizar";
            }
          }
        }

        if (matchedConditions.length > 0) {
          matchedRecipients.push({
            recipientId,
            recipientName: recipientRules[0].recipientName,
            recipientType: recipientRules[0].recipientType,
            actionType,
            approvalPosition: recipientRules[0].approvalPosition,
            matchedConditions,
          });
        }
      }

      return matchedRecipients;
    }),
});
