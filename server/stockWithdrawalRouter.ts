import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { stockWithdrawalRequests, productCatalog, operators, withdrawalDeletionHistory, stockItems, stockInsufficientAlerts } from "../drizzle/schema";
import { eq, and, sql, desc, gte, lte, count, inArray } from "drizzle-orm";

/**
 * Router para Solicitações de Baixa Manual no Estoque
 * 
 * REGRAS:
 * 1. Apenas LARISSA pode aprovar/recusar (validação por senha)
 * 2. A Manus NÃO faz baixa automática no estoque - é só controle visual
 * 3. A baixa real é feita manualmente no Maxiprod pela Larissa
 * 4. Fluxo: Líder solicita → Larissa aprova/recusa → Larissa faz baixa no Maxiprod → Larissa confirma conclusão
 * 5. Status: Pendente → Aprovada → Concluída (ou Pendente → Recusada)
 */
export const stockWithdrawalRouter = router({
  /**
   * Buscar produtos do catálogo para o dropdown de seleção
   */
  searchProducts: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const q = input.query.toUpperCase();
      // Apenas produtos de BAMBU (superGrupoCodigo = "12" na stock_items)
      const bambuCodes = await db.selectDistinct({ codigoItem: stockItems.codigoItem })
        .from(stockItems)
        .where(eq(stockItems.superGrupoCodigo, "12"));
      const bambuCodeSet = bambuCodes.map(r => r.codigoItem);
      if (bambuCodeSet.length === 0) return [];
      const results = await db.select({
        codigoItem: productCatalog.codigoItem,
        descricaoItem: productCatalog.descricaoItem,
      })
        .from(productCatalog)
        .where(
          and(
            sql`(${productCatalog.codigoItem} LIKE ${`%${q}%`} OR UPPER(${productCatalog.descricaoItem}) LIKE ${`%${q}%`})`,
            inArray(productCatalog.codigoItem, bambuCodeSet)
          )
        )
        .limit(30);
      return results;
    }),

  /**
   * Buscar produtos para o campo "Produto de Destino" (reembalagem)
   * Busca em TODOS os produtos do catálogo + sales_orders, sem filtro de superGrupo
   */
  searchDestinoProducts: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const q = input.query.toUpperCase();
      // Buscar no catálogo de produtos (sem filtro de superGrupo)
      const catalogResults = await db.select({
        codigoItem: productCatalog.codigoItem,
        descricaoItem: productCatalog.descricaoItem,
      })
        .from(productCatalog)
        .where(
          sql`(${productCatalog.codigoItem} LIKE ${`%${q}%`} OR UPPER(${productCatalog.descricaoItem}) LIKE ${`%${q}%`})`
        )
        .limit(20);
      
      // Se não encontrou no catálogo, buscar também em sales_orders (produtos que existem no Maxiprod mas não estão no catálogo local)
      if (catalogResults.length === 0) {
        const { salesOrders } = await import("../drizzle/schema");
        const salesResults = await db.selectDistinct({
          codigoItem: salesOrders.codigoItem,
          descricaoItem: salesOrders.descricaoItem,
        })
          .from(salesOrders)
          .where(
            sql`(${salesOrders.codigoItem} LIKE ${`%${q}%`} OR UPPER(${salesOrders.descricaoItem}) LIKE ${`%${q}%`})`
          )
          .limit(20);
        // Filter out nulls
        return salesResults.filter(r => r.codigoItem && r.descricaoItem).map(r => ({
          codigoItem: r.codigoItem!,
          descricaoItem: r.descricaoItem!,
        }));
      }
      
      return catalogResults;
    }),

  /**
   * Criar nova solicitação de baixa (Líder) - exige senha do operador
   */
  create: publicProcedure
    .input(z.object({
      productCode: z.string().min(1),
      productName: z.string().min(1),
      quantity: z.string().min(1),
      motivo: z.enum(["consumo_pedido", "amostra", "reembalagem", "ajuste_inventario", "avaria_perda", "uso_interno", "devolucao_retrabalho", "outro"]),
      motivoDescricao: z.string().optional(),
      produtoDestinoCode: z.string().optional(),
      produtoDestinoName: z.string().optional(),
      quantidadeDestino: z.string().optional(),
      senha: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Validar senha e identificar operador
      const [op] = await db.select().from(operators)
        .where(and(eq(operators.password, input.senha), eq(operators.active, true)));
      if (!op) throw new Error("Senha inválida. Verifique e tente novamente.");

      // Validações de negócio
      if (input.motivo === "outro" && (!input.motivoDescricao || input.motivoDescricao.trim() === "")) {
        throw new Error("Descri\u00e7\u00e3o do motivo \u00e9 obrigat\u00f3ria quando o motivo \u00e9 'Outro'");
      }
      if (input.motivo === "avaria_perda" && (!input.motivoDescricao || input.motivoDescricao.trim() === "")) {
        throw new Error("Descri\u00e7\u00e3o do motivo \u00e9 obrigat\u00f3ria para Avaria/Perda");
      }
      if (input.motivo === "reembalagem") {
        if (!input.produtoDestinoCode || !input.produtoDestinoName || !input.quantidadeDestino) {
          throw new Error("Produto de destino e quantidade são obrigatórios para Reembalagem");
        }
      }

      await db.insert(stockWithdrawalRequests).values({
        productCode: input.productCode,
        productName: input.productName,
        quantity: input.quantity,
        motivo: input.motivo,
        motivoDescricao: input.motivoDescricao || null,
        produtoDestinoCode: input.produtoDestinoCode || null,
        produtoDestinoName: input.produtoDestinoName || null,
        quantidadeDestino: input.quantidadeDestino || null,
        solicitanteId: op.id,
        solicitanteName: op.name,
        status: "pendente",
      });

      return { success: true, solicitanteName: op.name };
    }),

  /**
   * Listar solicitações com filtros
   */
  list: publicProcedure
    .input(z.object({
      status: z.enum(["pendente", "aprovada", "concluida", "recusada", "todas"]).optional().default("todas"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().optional().default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions: any[] = [];
      if (input.status && input.status !== "todas") {
        conditions.push(eq(stockWithdrawalRequests.status, input.status));
      }
      if (input.startDate) {
        conditions.push(gte(stockWithdrawalRequests.dataSolicitacao, new Date(input.startDate)));
      }
      if (input.endDate) {
        const endDate = new Date(input.endDate);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(lte(stockWithdrawalRequests.dataSolicitacao, endDate));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db.select()
        .from(stockWithdrawalRequests)
        .where(where)
        .orderBy(desc(stockWithdrawalRequests.dataSolicitacao))
        .limit(input.limit);

      return results;
    }),

  /**
   * Contar pendências (para badge/notificação)
   * Também retorna recentlyActioned: itens aprovados/recusados nas últimas 2h (para Maria/Erica)
   */
  countPending: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { pending: 0, approvedOver24h: 0, recentlyActioned: 0 };

    const [pendingResult] = await db.select({ count: count() })
      .from(stockWithdrawalRequests)
      .where(eq(stockWithdrawalRequests.status, "pendente"));

    // Aprovadas há mais de 24h sem conclusão
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [over24hResult] = await db.select({ count: count() })
      .from(stockWithdrawalRequests)
      .where(and(
        eq(stockWithdrawalRequests.status, "aprovada"),
        lte(stockWithdrawalRequests.dataAprovacao, twentyFourHoursAgo)
      ));

    // Itens aprovados (aguardando baixa/acréscimo no Maxiprod) - para de piscar quando Larissa conclui
    const [recentlyActionedResult] = await db.select({ count: count() })
      .from(stockWithdrawalRequests)
      .where(eq(stockWithdrawalRequests.status, "aprovada"));

    return {
      pending: pendingResult?.count || 0,
      approvedOver24h: over24hResult?.count || 0,
      recentlyActioned: recentlyActionedResult?.count || 0,
    };
  }),

  /**
   * Aprovar solicitação — APENAS LARISSA pode aprovar (validação por senha)
   * NÃO faz nenhuma baixa automática no estoque.
   * A baixa real é feita manualmente no Maxiprod pela Larissa.
   */
  approve: publicProcedure
    .input(z.object({
      id: z.number(),
      senha: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Validar senha e verificar que é a Larissa
      const [op] = await db.select().from(operators)
        .where(and(eq(operators.password, input.senha), eq(operators.active, true)));
      if (!op) throw new Error("Senha inválida.");
      if (op.name !== "Larissa") throw new Error("Apenas a Larissa pode aprovar/recusar solicitações de movimentação.");

      await db.update(stockWithdrawalRequests)
        .set({
          status: "aprovada",
          fiscalId: op.id,
          fiscalName: op.name,
          dataAprovacao: new Date(),
        })
        .where(and(
          eq(stockWithdrawalRequests.id, input.id),
          eq(stockWithdrawalRequests.status, "pendente")
        ));

      return { success: true };
    }),

  /**
   * Recusar solicitação — APENAS LARISSA pode recusar (validação por senha)
   */
  reject: publicProcedure
    .input(z.object({
      id: z.number(),
      senha: z.string().min(1),
      justificativa: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Validar senha e verificar que é a Larissa
      const [op] = await db.select().from(operators)
        .where(and(eq(operators.password, input.senha), eq(operators.active, true)));
      if (!op) throw new Error("Senha inválida.");
      if (op.name !== "Larissa") throw new Error("Apenas a Larissa pode aprovar/recusar solicitações de movimentação.");

      await db.update(stockWithdrawalRequests)
        .set({
          status: "recusada",
          fiscalId: op.id,
          fiscalName: op.name,
          justificativaRecusa: input.justificativa || null,
          dataAprovacao: new Date(),
        })
        .where(and(
          eq(stockWithdrawalRequests.id, input.id),
          eq(stockWithdrawalRequests.status, "pendente")
        ));

      return { success: true };
    }),

  /**
   * Confirmar baixa realizada no Maxiprod — APENAS LARISSA
   * Isso marca que ela já fez a baixa manual no Maxiprod e o sync da Manus já vai ler atualizado.
   */
  complete: publicProcedure
    .input(z.object({
      id: z.number(),
      senha: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Validar senha e verificar que é a Larissa
      const [op] = await db.select().from(operators)
        .where(and(eq(operators.password, input.senha), eq(operators.active, true)));
      if (!op) throw new Error("Senha inválida.");
      if (op.name !== "Larissa") throw new Error("Apenas a Larissa pode confirmar a conclusão.");

      // Get the request details before completing
      const [request] = await db.select().from(stockWithdrawalRequests)
        .where(and(
          eq(stockWithdrawalRequests.id, input.id),
          eq(stockWithdrawalRequests.status, "aprovada")
        ));
      if (!request) throw new Error("Solicitação não encontrada ou já concluída.");

      await db.update(stockWithdrawalRequests)
        .set({
          status: "concluida",
          dataConclusao: new Date(),
          fiscalId: op.id,
          fiscalName: op.name,
        })
        .where(eq(stockWithdrawalRequests.id, input.id));

      // Expirar alertas de estoque insuficiente vinculados ao produto de ORIGEM ou DESTINO
      // O alerta de insuficiência é criado para o produto de DESTINO (ex: 00047)
      // A baixa é feita no produto de ORIGEM (ex: 00046) com destino para 00047
      // Então precisamos verificar AMBOS os códigos
      const codesToExpire = [request.productCode];
      if (request.produtoDestinoCode) {
        codesToExpire.push(request.produtoDestinoCode);
      }
      await db.update(stockInsufficientAlerts)
        .set({ status: "expirado" })
        .where(and(
          inArray(stockInsufficientAlerts.codigoItem, codesToExpire),
          inArray(stockInsufficientAlerts.status, ["aceito", "pendente"])
        ));

      return { success: true };
    }),

  /**
   * Apagar solicitação (apenas Bruno, Guilherme e Fernando - com senha)
   */
  delete: publicProcedure
    .input(z.object({
      id: z.number(),
      operatorName: z.string(),
      senha: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verificar se o operador tem permissão para apagar
      const allowedNames = ["Bruno", "Guilherme", "Fernando"];
      if (!allowedNames.some(n => input.operatorName.toLowerCase().includes(n.toLowerCase()))) {
        throw new Error("Você não tem permissão para apagar solicitações");
      }

      // Validar senha do operador
      const [op] = await db.select().from(operators).where(eq(operators.name, input.operatorName));
      if (!op || op.password !== input.senha) {
        throw new Error("Senha incorreta");
      }

      // Buscar solicitação
      const [existing] = await db.select().from(stockWithdrawalRequests).where(eq(stockWithdrawalRequests.id, input.id));
      if (!existing) throw new Error("Solicitação não encontrada");

      // Registrar no histórico de exclusões
      await db.insert(withdrawalDeletionHistory).values({
        requestId: existing.id,
        productCode: existing.productCode,
        productName: existing.productName,
        quantity: String(existing.quantity),
        motivo: existing.motivo,
        solicitanteName: existing.solicitanteName,
        status: existing.status,
        dataSolicitacao: existing.dataSolicitacao,
        deletedByName: input.operatorName,
      });

      // Apagar a solicitação
      await db.delete(stockWithdrawalRequests).where(eq(stockWithdrawalRequests.id, input.id));
      return { success: true };
    }),

  /**
   * Atualizar observação de uma solicitação existente (retroativo para avaria/perda)
   * Qualquer operador pode adicionar observação (Maria, Erica, etc.)
   */
  updateObservacao: publicProcedure
    .input(z.object({
      id: z.number(),
      motivoDescricao: z.string().min(1),
      senha: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Validar senha e identificar operador
      const [op] = await db.select().from(operators)
        .where(and(eq(operators.password, input.senha), eq(operators.active, true)));
      if (!op) throw new Error("Senha inv\u00e1lida.");

      // Verificar que a solicita\u00e7\u00e3o existe e \u00e9 avaria_perda
      const [existing] = await db.select().from(stockWithdrawalRequests)
        .where(eq(stockWithdrawalRequests.id, input.id));
      if (!existing) throw new Error("Solicita\u00e7\u00e3o n\u00e3o encontrada");
      if (existing.motivo !== "avaria_perda") throw new Error("Observa\u00e7\u00e3o retroativa s\u00f3 permitida para Avaria/Perda");

      await db.update(stockWithdrawalRequests)
        .set({ motivoDescricao: input.motivoDescricao.trim() })
        .where(eq(stockWithdrawalRequests.id, input.id));

      return { success: true, operatorName: op.name };
    }),

  /**
   * Indicadores do mês para o gestor
   */
  monthlyStats: publicProcedure
    .input(z.object({
      year: z.number().optional(),
      month: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { total: 0, byMotivo: [], byStatus: [] };

      const now = new Date();
      const year = input.year || now.getFullYear();
      const month = input.month || (now.getMonth() + 1);

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const results = await db.select()
        .from(stockWithdrawalRequests)
        .where(and(
          gte(stockWithdrawalRequests.dataSolicitacao, startDate),
          lte(stockWithdrawalRequests.dataSolicitacao, endDate)
        ));

      // Agrupar por motivo
      const byMotivo: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      for (const r of results) {
        byMotivo[r.motivo] = (byMotivo[r.motivo] || 0) + 1;
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      }

      return {
        total: results.length,
        byMotivo: Object.entries(byMotivo).map(([motivo, count]) => ({ motivo, count })),
        byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      };
    }),
});
