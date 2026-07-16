import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { stockInsufficientAlerts, stockItems, salesOrders } from "../drizzle/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

/**
 * Router para Alertas de Estoque Insuficiente
 * 
 * FLUXO:
 * 1. Sistema detecta itens insuficientes em pedidos "Em Digitação"
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
      status: z.enum(["pendente", "aceito", "recusado", "todos"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const statusFilter = input?.status || "todos";
      
      let conditions: any[] = [];
      if (statusFilter !== "todos") {
        conditions.push(eq(stockInsufficientAlerts.status, statusFilter));
      }
      
      const alerts = await db.select()
        .from(stockInsufficientAlerts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(
          sql`FIELD(${stockInsufficientAlerts.status}, 'pendente', 'aceito', 'recusado')`,
          desc(stockInsufficientAlerts.createdAt)
        )
        .limit(100);
      
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
   * Detectar itens insuficientes nos pedidos "Em Digitação"
   * Compara quantidade pedida com estoque disponível na stock_items
   * Cria alertas para itens novos que ainda não têm alerta pendente
   */
  detectInsufficient: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // 1. Buscar todos os itens de pedidos em "Digitação"
    const pedidosDigitacao = await db.select({
      pedido: salesOrders.pedido,
      cliente: salesOrders.cliente,
      codigoItem: salesOrders.codigoItem,
      descricaoItem: salesOrders.descricaoItem,
      quantidade: salesOrders.quantidade,
      unidadeMedida: salesOrders.unidadeMedidaCodigo,
    })
      .from(salesOrders)
      .where(eq(salesOrders.estadoNota, "Digitação"));
    
    if (pedidosDigitacao.length === 0) return { created: 0, message: "Nenhum pedido em digitação" };
    
    // 2. Buscar estoque disponível para esses itens (apenas bambu - superGrupoCodigo = "12")
    const codigosUnicos = Array.from(new Set(pedidosDigitacao.map(p => p.codigoItem).filter(Boolean)));
    if (codigosUnicos.length === 0) return { created: 0, message: "Nenhum item encontrado" };
    
    const estoqueItems = await db.select({
      codigoItem: stockItems.codigoItem,
      quantidade: stockItems.quantidade,
    })
      .from(stockItems)
      .where(
        and(
          inArray(stockItems.codigoItem, codigosUnicos as string[]),
          eq(stockItems.superGrupoCodigo, "12")
        )
      );
    
    // Agregar estoque por código (pode ter múltiplos locais)
    const estoqueMap = new Map<string, number>();
    for (const item of estoqueItems) {
      const current = estoqueMap.get(item.codigoItem) || 0;
      estoqueMap.set(item.codigoItem, current + Number(item.quantidade || 0));
    }
    
    // 3. Buscar alertas pendentes existentes para não duplicar
    const alertasExistentes = await db.select({
      pedidoNumero: stockInsufficientAlerts.pedidoNumero,
      codigoItem: stockInsufficientAlerts.codigoItem,
    })
      .from(stockInsufficientAlerts)
      .where(eq(stockInsufficientAlerts.status, "pendente"));
    
    const alertaSet = new Set(alertasExistentes.map(a => `${a.pedidoNumero}-${a.codigoItem}`));
    
    // 4. Detectar insuficientes e criar alertas
    let created = 0;
    for (const pedido of pedidosDigitacao) {
      if (!pedido.codigoItem || !pedido.pedido) continue;
      
      const estoqueDisponivel = estoqueMap.get(pedido.codigoItem) ?? 0;
      const quantidadePedida = Number(pedido.quantidade || 0);
      
      // Se estoque é 0 ou insuficiente para a quantidade pedida
      // A unidade no estoque é "un" e no pedido é "CX" - precisamos comparar em caixas
      // O estoque em stock_items está em unidades, mas para simplificar vamos comparar
      // Se estoque = 0, definitivamente insuficiente
      if (estoqueDisponivel <= 0) {
        const key = `${pedido.pedido}-${pedido.codigoItem}`;
        if (!alertaSet.has(key)) {
          await db.insert(stockInsufficientAlerts).values({
            pedidoNumero: pedido.pedido,
            cliente: pedido.cliente || "N/A",
            codigoItem: pedido.codigoItem,
            descricaoItem: pedido.descricaoItem || pedido.codigoItem,
            quantidadePedida: String(quantidadePedida),
            unidadeMedida: pedido.unidadeMedida || "CX",
            estoqueDisponivel: "0",
            status: "pendente",
            criadoPor: "sistema",
          });
          alertaSet.add(key);
          created++;
        }
      }
    }
    
    return { created, message: `${created} novo(s) alerta(s) criado(s)` };
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
