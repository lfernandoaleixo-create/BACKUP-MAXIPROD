import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { stockInsufficientAlerts, stockItems, salesOrders } from "../drizzle/schema";
import { eq, and, sql, desc, inArray, gte } from "drizzle-orm";
import { detectStockInsufficientAlerts } from "./stockAlertDetector";

/**
 * Router para Alertas de Estoque Insuficiente
 * 
 * FLUXO:
 * 1. Sistema detecta itens insuficientes em pedidos "A aprovar"
 * 2. Alerta aparece na aba Faturamento para Maria, Erica, Vitória, Bruno, Guilherme e Fernando
 * 3. Produção (Maria/Erica) aceita ou recusa a conversão/transformação
 * 4. Resultado volta para todos verem
 */
export const stockAlertRouter = router({
  /**
   * Listar todos os alertas (pendentes primeiro, depois resolvidos recentes)
   */
  getAlerts: publicProcedure
    .input(z.object({
      status: z.enum(["pendente", "aceito", "recusado", "expirado", "todos", "historico"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const statusFilter = input?.status || "todos";
      
      let conditions: any[] = [];
      if (statusFilter === "historico") {
        // Histórico: mostrar tudo (aceito, recusado, expirado) - para a seção de histórico completo
        conditions.push(inArray(stockInsufficientAlerts.status, ["aceito", "recusado", "expirado"]));
      } else if (statusFilter !== "todos") {
        conditions.push(eq(stockInsufficientAlerts.status, statusFilter));
      } else {
        // Por padrão, não mostrar expirados (card principal)
        conditions.push(sql`${stockInsufficientAlerts.status} != 'expirado'`);
      }
      
      const alerts = await db.select()
        .from(stockInsufficientAlerts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(
          sql`FIELD(${stockInsufficientAlerts.status}, 'pendente', 'aceito', 'recusado', 'expirado')`,
          desc(stockInsufficientAlerts.createdAt)
        )
        .limit(200);
      
      return alerts;
    }),

  /**
   * Contar alertas pendentes (para badge)
   */
  countPending: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return 0;
    
    const [result] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(stockInsufficientAlerts)
      .where(eq(stockInsufficientAlerts.status, "pendente"));
    
    return result?.count || 0;
  }),

  /**
   * Responder a um alerta (aceitar ou recusar)
   * Apenas produção (Maria/Erica) ou gestão pode responder
   */
  respondAlert: publicProcedure
    .input(z.object({
      alertId: z.number(),
      status: z.enum(["aceito", "recusado"]),
      respondidoPor: z.string(),
      observacao: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.update(stockInsufficientAlerts)
        .set({
          status: input.status,
          respondidoPor: input.respondidoPor,
          respostaObservacao: input.observacao || null,
          respondidoEm: new Date(),
        })
        .where(eq(stockInsufficientAlerts.id, input.alertId));
      
      return { success: true };
    }),

  /**
   * Detectar itens insuficientes nos pedidos "A aprovar"
   * Compara quantidade pedida com estoque disponível na stock_items
   * Cria alertas para itens novos que ainda não têm alerta pendente
   */
  detectInsufficient: publicProcedure.mutation(async () => {
    // Usa o detector centralizado que filtra apenas pedidos recentes (últimos 3 dias)
    return await detectStockInsufficientAlerts();
  }),

  /**
   * Criar alerta manualmente (caso alguém identifique insuficiência)
   */
  createAlert: publicProcedure
    .input(z.object({
      pedidoNumero: z.string(),
      cliente: z.string().optional(),
      codigoItem: z.string(),
      descricaoItem: z.string().optional(),
      quantidadePedida: z.number(),
      unidadeMedida: z.string().optional(),
      estoqueDisponivel: z.number().optional(),
      criadoPor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(stockInsufficientAlerts).values({
        pedidoNumero: input.pedidoNumero,
        cliente: input.cliente || null,
        codigoItem: input.codigoItem,
        descricaoItem: input.descricaoItem || null,
        quantidadePedida: String(input.quantidadePedida),
        unidadeMedida: input.unidadeMedida || "CX",
        estoqueDisponivel: input.estoqueDisponivel != null ? String(input.estoqueDisponivel) : null,
        status: "pendente",
        criadoPor: input.criadoPor || "manual",
      });
      
      return { success: true };
    }),
});
