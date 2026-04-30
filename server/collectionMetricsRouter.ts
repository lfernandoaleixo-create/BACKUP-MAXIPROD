/**
 * Collection Metrics Router - Analytics de Cobrança
 * SOMENTE LEITURA - não modifica dados existentes
 */
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  collectionActions,
  collectionDailyActions,
  collectionManualTicks,
  collectionManualTickHistory,
  collectionStepOverrides,
  collectionDocuments,
  resolvedReceivables,
  decisionPdfHistory,
  receivableProtestConfig,
  collectionActionEdits,
  accountsReceivable,
} from "../drizzle/schema";
import { eq, and, gte, lte, sql, desc, asc, count, sum, between } from "drizzle-orm";

/**
 * Helper: parse date range filter
 */
function getDateFilter(startDate?: string, endDate?: string) {
  return { startDate: startDate || "2026-01-01", endDate: endDate || "2099-12-31" };
}

const TEST_CLIENTS = "('CLIENTE TESTE REGRA','CLIENTE MANUAL TICK TEST','CLIENTE LEGACY VIBRATION TEST','CLIENTE RECENT VIBRATION TEST','CLIENTE TESTE COBRANCA')";
const THRESHOLD = 3;

export const collectionMetricsRouter = router({
  /**
   * Métricas gerais de cobrança (KPIs)
   * Retorna contadores e totais para o painel de métricas
   */
  getOverviewMetrics: publicProcedure
    .input(z.object({
      startDate: z.string().optional(), // YYYY-MM-DD
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const { startDate, endDate } = getDateFilter(input?.startDate, input?.endDate);

      // 1. Total de títulos com ação de cobrança registrada
      const [totalTitulos] = await db.execute(
        sql`SELECT COUNT(*) as cnt FROM collection_actions`
      );

      // 2. Breakdown por status
      const [statusBreakdown] = await db.execute(
        sql`SELECT status, COUNT(*) as cnt FROM collection_actions GROUP BY status ORDER BY cnt DESC`
      );

      // 3. Total de ações diárias registradas (no período) - apenas operadores de cobrança (excluir Guilherme)
      const [totalDailyActions] = await db.execute(
        sql`SELECT COUNT(*) as cnt FROM collection_daily_actions 
            WHERE actionDate >= ${startDate} AND actionDate <= ${endDate}
            AND operatorName != 'Guilherme'`
      );

      // 4. Ações diárias por tipo (no período) - apenas operadores de cobrança
      const [dailyActionsByType] = await db.execute(
        sql`SELECT actionType, COUNT(*) as cnt FROM collection_daily_actions 
            WHERE actionDate >= ${startDate} AND actionDate <= ${endDate}
            AND operatorName != 'Guilherme'
            GROUP BY actionType ORDER BY cnt DESC`
      );

      // 5. Títulos resolvidos (pagos) no período — DEDUPLICATED por cliente+documento+vencimento
      const [resolvedStats] = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt, COALESCE(SUM(valorAReceber), 0) as totalValor FROM (
            SELECT MIN(id) as id, cliente, documento, vencimentoData, MAX(valorAReceber) as valorAReceber
            FROM resolved_receivables 
            WHERE diasAtrasoNaResolucao >= ${THRESHOLD}
            AND cliente NOT IN ${TEST_CLIENTS}
            AND resolvedAt >= '${startDate}' AND resolvedAt <= '${endDate} 23:59:59'
            GROUP BY cliente, documento, vencimentoData
          ) deduped`)
      );

      // 6. Total resolvidos (all time) — DEDUPLICATED
      const [resolvedAllTime] = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt, COALESCE(SUM(valorAReceber), 0) as totalValor FROM (
            SELECT MIN(id) as id, cliente, documento, vencimentoData, MAX(valorAReceber) as valorAReceber
            FROM resolved_receivables 
            WHERE diasAtrasoNaResolucao >= ${THRESHOLD}
            AND cliente NOT IN ${TEST_CLIENTS}
            GROUP BY cliente, documento, vencimentoData
          ) deduped`)
      );

      // 7. Manual ticks por step (green = sucesso, blue = contato manual)
      // EXCLUI ticks do SISTEMA (auto_red) — falhas do sistema não contam como falha do operador
      const [ticksByStep] = await db.execute(
        sql`SELECT step, tick_status, COUNT(*) as cnt FROM collection_manual_ticks 
            WHERE ticked = 1 AND ticked_by != 'SISTEMA'
            GROUP BY step, tick_status ORDER BY step, tick_status`
      );

      // 8. Total de falhas (red ticks manuais — excluir SISTEMA/auto_red)
      const [totalFalhas] = await db.execute(
        sql`SELECT COUNT(*) as cnt FROM collection_manual_ticks WHERE ticked = 1 AND tick_status = 'red' AND ticked_by != 'SISTEMA'`
      );

      // 9. Decisões tomadas (step 7 ticked)
      const [totalDecisoes] = await db.execute(
        sql`SELECT COUNT(*) as cnt FROM collection_manual_ticks WHERE step = 7 AND ticked = 1`
      );

      // 10. Decision PDFs gerados
      const [totalDecisionPdfs] = await db.execute(
        sql`SELECT COUNT(*) as cnt FROM decision_pdf_history`
      );

      // 11. Contatos registrados em contatoHistorico
      const [totalContatos] = await db.execute(
        sql`SELECT COALESCE(SUM(JSON_LENGTH(contatoHistorico)), 0) as total 
            FROM collection_actions 
            WHERE contatoHistorico IS NOT NULL AND contatoHistorico != '[]'`
      );

      // 12. Protest config
      const [protestConfig] = await db.execute(
        sql`SELECT protestType, COUNT(*) as cnt FROM receivable_protest_config GROUP BY protestType`
      );

      // 13. Resolved excluindo clientes Especial s/ Cobrança (para cálculo de eficiência) — DEDUPLICATED
      const [resolvedExcludingSpecial] = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt, COALESCE(SUM(valorAReceber), 0) as totalValor FROM (
            SELECT MIN(id) as id, cliente, documento, vencimentoData, MAX(valorAReceber) as valorAReceber
            FROM resolved_receivables 
            WHERE diasAtrasoNaResolucao >= ${THRESHOLD}
            AND cliente NOT IN ${TEST_CLIENTS}
            AND (statusCobranca IS NULL OR statusCobranca != 'especial_sem_cobranca')
            GROUP BY cliente, documento, vencimentoData
          ) deduped`)
      );

      return {
        totalTitulosComCobranca: Number((totalTitulos as any)[0]?.cnt || 0),
        statusBreakdown: (statusBreakdown as unknown as any[]).map((s: any) => ({
          status: s.status as string,
          count: Number(s.cnt),
        })),
        totalDailyActions: Number((totalDailyActions as any)[0]?.cnt || 0),
        dailyActionsByType: (dailyActionsByType as unknown as any[]).map((a: any) => ({
          type: a.actionType as string,
          count: Number(a.cnt),
        })),
        resolvedInPeriod: {
          count: Number((resolvedStats as any)[0]?.cnt || 0),
          totalValor: Number((resolvedStats as any)[0]?.totalValor || 0),
        },
        resolvedAllTime: {
          count: Number((resolvedAllTime as any)[0]?.cnt || 0),
          totalValor: Number((resolvedAllTime as any)[0]?.totalValor || 0),
        },
        ticksByStep: (ticksByStep as unknown as any[]).map((t: any) => ({
          step: Number(t.step),
          status: t.tick_status as string,
          count: Number(t.cnt),
        })),
        totalFalhas: Number((totalFalhas as any)[0]?.cnt || 0),
        totalDecisoes: Number((totalDecisoes as any)[0]?.cnt || 0),
        totalDecisionPdfs: Number((totalDecisionPdfs as any)[0]?.cnt || 0),
        totalContatos: Number((totalContatos as any)[0]?.total || 0),
        protestConfig: (protestConfig as unknown as any[]).map((p: any) => ({
          type: p.protestType as string,
          count: Number(p.cnt),
        })),
        resolvedExcludingSpecial: {
          count: Number((resolvedExcludingSpecial as any)[0]?.cnt || 0),
          totalValor: Number((resolvedExcludingSpecial as any)[0]?.totalValor || 0),
        },
      };
    }),

  /**
   * Timeline de recuperações (resolvidos ao longo do tempo)
   * Agrupado por dia, semana ou mês — DEDUPLICATED
   */
  getRecoveryTimeline: publicProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      groupBy: z.enum(["day", "week", "month"]).default("day"),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const { startDate, endDate } = getDateFilter(input?.startDate, input?.endDate);
      const groupBy = input?.groupBy || "day";

      let dateExpr: string;
      if (groupBy === "day") {
        dateExpr = "DATE(resolvedAt)";
      } else if (groupBy === "week") {
        dateExpr = "DATE(DATE_SUB(resolvedAt, INTERVAL WEEKDAY(resolvedAt) DAY))";
      } else {
        dateExpr = "DATE_FORMAT(resolvedAt, '%Y-%m-01')";
      }

      const [timeline] = await db.execute(
        sql.raw(`SELECT period, SUM(cnt) as cnt, SUM(totalValor) as totalValor FROM (
            SELECT ${dateExpr} as period, 1 as cnt, MAX(valorAReceber) as totalValor
            FROM resolved_receivables 
            WHERE diasAtrasoNaResolucao >= 3
            AND cliente NOT IN ${TEST_CLIENTS}
            AND resolvedAt >= '${startDate}' AND resolvedAt <= '${endDate} 23:59:59'
            GROUP BY cliente, documento, vencimentoData, ${dateExpr}
          ) deduped
          GROUP BY period ORDER BY period`)
      );

      return (timeline as unknown as any[]).map((t: any) => ({
        period: String(t.period),
        count: Number(t.cnt),
        totalValor: Number(t.totalValor || 0),
      }));
    }),

  /**
   * Ações diárias ao longo do tempo (timeline de atividade de cobrança)
   */
  getActionTimeline: publicProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const { startDate, endDate } = getDateFilter(input?.startDate, input?.endDate);

      // Actions by date and type - apenas operadores de cobrança (excluir Guilherme)
      const [actionsByDate] = await db.execute(
        sql`SELECT actionDate, actionType, COUNT(*) as cnt 
            FROM collection_daily_actions 
            WHERE actionDate >= ${startDate} AND actionDate <= ${endDate}
            AND operatorName != 'Guilherme'
            GROUP BY actionDate, actionType ORDER BY actionDate`
      );

      // Group by date
      const byDate = new Map<string, { whatsapp: number; email: number; ligacao: number; outro: number; total: number }>();
      for (const row of actionsByDate as unknown as any[]) {
        const date = row.actionDate as string;
        if (!byDate.has(date)) byDate.set(date, { whatsapp: 0, email: 0, ligacao: 0, outro: 0, total: 0 });
        const entry = byDate.get(date)!;
        const type = row.actionType as string;
        const cnt = Number(row.cnt);
        if (type === "whatsapp") entry.whatsapp += cnt;
        else if (type === "email") entry.email += cnt;
        else if (type === "ligacao") entry.ligacao += cnt;
        else entry.outro += cnt;
        entry.total += cnt;
      }

      return Array.from(byDate.entries()).map(([date, data]) => ({
        date,
        ...data,
      }));
    }),

  /**
   * Breakdown detalhado de ticks por step (roteiro de cobrança)
   * Step 1 = Ação 1, Step 2 = Intervalo, Step 3 = Ação 2, Step 4 = Intervalo, Step 5 = Ação 3, Step 6 = Intervalo, Step 7 = Decisão
   * 
   * IMPORTANTE: Falhas (red) do SISTEMA (auto_red) são EXCLUÍDAS.
   * Apenas falhas marcadas manualmente pelo operador contam.
   * Atualmente: 0 falhas manuais (6 auto_red do sistema são ignoradas).
   */
  getStepBreakdown: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const stepLabels = [
        "Ação 1 (Dia 1)",
        "Intervalo (Dia 2)",
        "Ação 2 (Dia 3)",
        "Intervalo (Dia 4)",
        "Ação 3 (Dia 5)",
        "Intervalo (Dia 6)",
        "Decisão (Dia 7)",
      ];

      // All ticks grouped by step and status — EXCLUINDO ticks do SISTEMA
      const [ticks] = await db.execute(
        sql`SELECT step, tick_status, ticked, COUNT(*) as cnt 
            FROM collection_manual_ticks 
            WHERE ticked_by != 'SISTEMA'
            GROUP BY step, tick_status, ticked ORDER BY step`
      );

      // Tick history for timing info
      const [tickHistoryActions] = await db.execute(
        sql`SELECT action, COUNT(*) as cnt FROM collection_manual_tick_history GROUP BY action ORDER BY cnt DESC`
      );

      const steps = stepLabels.map((label, i) => {
        const stepNum = i + 1;
        const stepTicks = (ticks as unknown as any[]).filter((t: any) => Number(t.step) === stepNum);
        const green = stepTicks.filter((t: any) => t.tick_status === "green" && t.ticked).reduce((s: number, t: any) => s + Number(t.cnt), 0);
        const red = stepTicks.filter((t: any) => t.tick_status === "red" && t.ticked).reduce((s: number, t: any) => s + Number(t.cnt), 0);
        const blue = stepTicks.filter((t: any) => t.tick_status === "blue" && t.ticked).reduce((s: number, t: any) => s + Number(t.cnt), 0);
        const notTicked = stepTicks.filter((t: any) => !t.ticked).reduce((s: number, t: any) => s + Number(t.cnt), 0);
        return {
          step: stepNum,
          label,
          green,
          red,
          blue,
          notTicked,
          total: green + red + blue,
        };
      });

      return {
        steps,
        tickHistoryActions: (tickHistoryActions as unknown as any[]).map((t: any) => ({
          action: t.action as string,
          count: Number(t.cnt),
        })),
      };
    }),

  /**
   * Detalhes de recuperações (títulos resolvidos) com filtro de período — DEDUPLICATED
   */
  getRecoveryDetails: publicProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const { startDate, endDate } = getDateFilter(input?.startDate, input?.endDate);
      const page = input?.page || 1;
      const pageSize = input?.pageSize || 50;
      const offset = (page - 1) * pageSize;

      // Count deduplicated
      const [totalRow] = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM (
            SELECT MIN(id) as id
            FROM resolved_receivables 
            WHERE diasAtrasoNaResolucao >= 3
            AND cliente NOT IN ${TEST_CLIENTS}
            AND resolvedAt >= '${startDate}' AND resolvedAt <= '${endDate} 23:59:59'
            GROUP BY cliente, documento, vencimentoData
          ) deduped`)
      );

      // Fetch deduplicated rows
      const [rows] = await db.execute(
        sql.raw(`SELECT r.* FROM resolved_receivables r
                 INNER JOIN (
                   SELECT MIN(id) as id
                   FROM resolved_receivables 
                   WHERE diasAtrasoNaResolucao >= 3
                   AND cliente NOT IN ${TEST_CLIENTS}
                   AND resolvedAt >= '${startDate}' AND resolvedAt <= '${endDate} 23:59:59'
                   GROUP BY cliente, documento, vencimentoData
                 ) deduped ON r.id = deduped.id
                 ORDER BY r.resolvedAt DESC LIMIT ${pageSize} OFFSET ${offset}`)
      );

      return {
        total: Number((totalRow as any)[0]?.cnt || 0),
        page,
        pageSize,
        items: (rows as unknown as any[]).map((r: any) => ({
          id: r.id,
          cliente: r.cliente,
          valorOriginal: Number(r.valorOriginal || 0),
          valorAReceber: Number(r.valorAReceber || 0),
          vencimentoData: r.vencimentoData,
          documento: r.documento,
          empresa: r.empresa,
          vendedor: r.vendedor,
          diasAtrasoNaResolucao: r.diasAtrasoNaResolucao,
          statusCobranca: r.statusCobranca,
          totalContatos: r.totalContatos,
          resolvedAt: r.resolvedAt,
        })),
      };
    }),

  /**
   * Migração de status (quantos títulos migraram de um status para outro)
   * Baseado no histórico de ações de cobrança
   */
  getStatusDistribution: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      // Current status distribution
      const [currentStatus] = await db.execute(
        sql`SELECT status, COUNT(*) as cnt FROM collection_actions GROUP BY status ORDER BY cnt DESC`
      );

      // Resolved status distribution
      const [resolvedStatus] = await db.execute(
        sql`SELECT statusCobranca as status, COUNT(*) as cnt FROM resolved_receivables GROUP BY statusCobranca ORDER BY cnt DESC`
      );

      return {
        active: (currentStatus as unknown as any[]).map((s: any) => ({
          status: s.status as string,
          count: Number(s.cnt),
        })),
        resolved: (resolvedStatus as unknown as any[]).map((s: any) => ({
          status: (s.status || "sem_status") as string,
          count: Number(s.cnt),
        })),
      };
    }),

  /**
   * Resumo de ações diárias por operador
   */
  getOperatorMetrics: publicProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const { startDate, endDate } = getDateFilter(input?.startDate, input?.endDate);

      // Filtrar apenas operadores de cobrança (excluir Guilherme que é gestor, não cobrador)
      const [byOperator] = await db.execute(
        sql`SELECT operatorName, actionType, COUNT(*) as cnt 
            FROM collection_daily_actions 
            WHERE actionDate >= ${startDate} AND actionDate <= ${endDate}
            AND operatorName != 'Guilherme'
            GROUP BY operatorName, actionType ORDER BY operatorName, cnt DESC`
      );

      // Group by operator
      const operators = new Map<string, { whatsapp: number; email: number; ligacao: number; outro: number; total: number }>();
      for (const row of byOperator as unknown as any[]) {
        const name = row.operatorName as string;
        if (!operators.has(name)) operators.set(name, { whatsapp: 0, email: 0, ligacao: 0, outro: 0, total: 0 });
        const entry = operators.get(name)!;
        const type = row.actionType as string;
        const cnt = Number(row.cnt);
        if (type === "whatsapp") entry.whatsapp += cnt;
        else if (type === "email") entry.email += cnt;
        else if (type === "ligacao") entry.ligacao += cnt;
        else entry.outro += cnt;
        entry.total += cnt;
      }

      return Array.from(operators.entries()).map(([name, data]) => ({
        operatorName: name,
        ...data,
      }));
    }),

  /**
   * Resumo de recuperações por período (diário, semanal, mensal, anual)
   * Suporta filtro de período específico (startDate/endDate)
   * DEDUPLICATED por cliente+documento+vencimento
   */
  getRecoverySummaryByPeriod: publicProcedure
    .input(z.object({
      groupBy: z.enum(["day", "week", "month", "year"]).default("month"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const groupBy = input?.groupBy || "month";
      const startDate = input?.startDate;
      const endDate = input?.endDate;

      let dateExpr: string;
      if (groupBy === "day") {
        dateExpr = "DATE(resolvedAt)";
      } else if (groupBy === "week") {
        dateExpr = "DATE(DATE_SUB(resolvedAt, INTERVAL WEEKDAY(resolvedAt) DAY))";
      } else if (groupBy === "month") {
        dateExpr = "DATE_FORMAT(resolvedAt, '%Y-%m')";
      } else {
        dateExpr = "DATE_FORMAT(resolvedAt, '%Y')";
      }

      // Build WHERE clause with optional date filter
      let dateFilter = "";
      if (startDate && endDate) {
        dateFilter = `AND resolvedAt >= '${startDate}' AND resolvedAt <= '${endDate} 23:59:59'`;
      } else if (startDate) {
        dateFilter = `AND resolvedAt >= '${startDate}'`;
      } else if (endDate) {
        dateFilter = `AND resolvedAt <= '${endDate} 23:59:59'`;
      }

      const [summary] = await db.execute(
        sql.raw(`SELECT period, SUM(cnt) as cnt, SUM(totalValor) as totalValor, 
                 AVG(avgDiasAtraso) as avgDiasAtraso, SUM(totalContatos) as totalContatos
                 FROM (
                   SELECT ${dateExpr} as period, 1 as cnt, 
                   MAX(valorAReceber) as totalValor,
                   MAX(diasAtrasoNaResolucao) as avgDiasAtraso,
                   MAX(totalContatos) as totalContatos
                   FROM resolved_receivables 
                   WHERE diasAtrasoNaResolucao >= 3
                   AND cliente NOT IN ${TEST_CLIENTS}
                   ${dateFilter}
                   GROUP BY cliente, documento, vencimentoData, ${dateExpr}
                 ) deduped
                 GROUP BY period ORDER BY period DESC`)
      );

      return (summary as unknown as any[]).map((s: any) => ({
        period: String(s.period),
        count: Number(s.cnt),
        totalValor: Number(s.totalValor || 0),
        avgDiasAtraso: Math.round(Number(s.avgDiasAtraso || 0)),
        totalContatos: Number(s.totalContatos || 0),
      }));
    }),
});
