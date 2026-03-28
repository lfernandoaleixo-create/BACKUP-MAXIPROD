/**
 * Financial Router - Contas a Pagar e Receber
 * SOMENTE LEITURA - dados do Maxiprod
 */
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { accountsPayable, accountsReceivable, bankAccounts, bankTransactions } from "../drizzle/schema";
import { eq, and, gte, lte, sql, desc, asc, ne } from "drizzle-orm";

/**
 * === TIMEZONE-SAFE DATE HELPERS ===
 * Todas as comparações de data usam strings YYYY-MM-DD para evitar bugs de timezone.
 * O servidor pode rodar em qualquer fuso; sempre usamos Brasília como referência.
 */

/** Retorna a data de hoje em Brasília como string YYYY-MM-DD */
function getTodayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Retorna Date de Brasília (para cálculos de dia da semana, etc) */
function getBrasiliaDate(): Date {
  const s = getTodayBR(); // YYYY-MM-DD
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d); // midnight local, mas só usamos getDay/getDate
}

/** Adiciona N dias a uma string YYYY-MM-DD e retorna YYYY-MM-DD */
function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return dt.toISOString().slice(0, 10);
}

/** Retorna o dia da semana (0=Dom, 6=Sab) para uma string YYYY-MM-DD */
function getDayOfWeekStr(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Ajusta sábado/domingo para segunda-feira seguinte (string-based) */
function adjustWeekendStr(dateStr: string): string {
  const dow = getDayOfWeekStr(dateStr);
  if (dow === 6) return addDaysStr(dateStr, 2); // sábado -> segunda
  if (dow === 0) return addDaysStr(dateStr, 1); // domingo -> segunda
  return dateStr;
}

export const financialRouter = router({
  /**
   * Get financial summary - KPIs for the dashboard
   */
  getSummary: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const today = getTodayBR();

    // Contas a Pagar - em aberto (EMITIDO)
    const payableOpen = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsPayable)
      .where(eq(accountsPayable.estado, "EMITIDO"));

    // Contas a Pagar - vencidas
    const payableOverdue = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsPayable)
      .where(
        and(
          eq(accountsPayable.estado, "EMITIDO"),
          lte(accountsPayable.vencimentoData, today + "T23:59:59")
        )
      );

    // Contas a Pagar - a vencer (próximos 30 dias)
    const next30Str = addDaysStr(today, 30);

    const payableNext30 = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsPayable)
      .where(
        and(
          eq(accountsPayable.estado, "EMITIDO"),
          gte(accountsPayable.vencimentoData, today + "T00:00:00"),
          lte(accountsPayable.vencimentoData, next30Str + "T23:59:59")
        )
      );

    // Contas a Pagar - próximos 60 dias
    const next60Str = addDaysStr(today, 60);

    const payableNext60 = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsPayable)
      .where(
        and(
          eq(accountsPayable.estado, "EMITIDO"),
          lte(accountsPayable.vencimentoData, next60Str + "T23:59:59")
        )
      );

    // Contas a Receber - em aberto (EMITIDO)
    const receivableOpen = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(eq(accountsReceivable.estado, "EMITIDO"));

    // Contas a Receber - vencidas (inadimplência)
    const receivableOverdue = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          lte(accountsReceivable.vencimentoData, today + "T23:59:59")
        )
      );

    // Contas a Receber - a receber (próximos 30 dias)
    const receivableNext30 = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          gte(accountsReceivable.vencimentoData, today + "T00:00:00"),
          lte(accountsReceivable.vencimentoData, next30Str + "T23:59:59")
        )
      );

    // Contas a Receber - próximos 60 dias
    const receivableNext60 = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          gte(accountsReceivable.vencimentoData, today + "T00:00:00"),
          lte(accountsReceivable.vencimentoData, next60Str + "T23:59:59")
        )
      );

    // Contas a Receber - 61 a 120 dias
    const next61Str = addDaysStr(today, 61);
    const next120Str = addDaysStr(today, 120);

    const receivable61a120 = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          gte(accountsReceivable.vencimentoData, next61Str + "T00:00:00"),
          lte(accountsReceivable.vencimentoData, next120Str + "T23:59:59")
        )
      );

    // Contas a Receber - restante (>120 dias)
    const receivableRestante = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          gte(accountsReceivable.vencimentoData, next120Str + "T00:00:00")
        )
      );

    // Contas a Pagar - total pago (PAGO)
    const payablePaid = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorPagoLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsPayable)
      .where(eq(accountsPayable.estado, "PAGO"));

    // Contas a Receber - total recebido (RECEBIDO)
    const receivableReceived = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorRecebidoLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(eq(accountsReceivable.estado, "RECEBIDO"));

    // Top inadimplentes por cliente (para gráfico do card)
    const topInadimplentes = await db
      .select({
        cliente: accountsReceivable.cliente,
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          lte(accountsReceivable.vencimentoData, today + "T23:59:59")
        )
      )
      .groupBy(accountsReceivable.cliente)
      .orderBy(desc(sql`SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)))`))
      .limit(10);

    return {
      pagar: {
        emAberto: { total: Number(payableOpen[0]?.total || 0), count: payableOpen[0]?.count || 0 },
        vencidas: { total: Number(payableOverdue[0]?.total || 0), count: payableOverdue[0]?.count || 0 },
        proximos30dias: { total: Number(payableNext30[0]?.total || 0), count: payableNext30[0]?.count || 0 },
        proximos60dias: { total: Number(payableNext60[0]?.total || 0), count: payableNext60[0]?.count || 0 },
        pagas: { total: Number(payablePaid[0]?.total || 0), count: payablePaid[0]?.count || 0 },
      },
      receber: {
        emAberto: { total: Number(receivableOpen[0]?.total || 0), count: receivableOpen[0]?.count || 0 },
        vencidas: { total: Number(receivableOverdue[0]?.total || 0), count: receivableOverdue[0]?.count || 0 },
        proximos30dias: { total: Number(receivableNext30[0]?.total || 0), count: receivableNext30[0]?.count || 0 },
        proximos60dias: { total: Number(receivableNext60[0]?.total || 0), count: receivableNext60[0]?.count || 0 },
        de61a120dias: { total: Number(receivable61a120[0]?.total || 0), count: receivable61a120[0]?.count || 0 },
        restante: { total: Number(receivableRestante[0]?.total || 0), count: receivableRestante[0]?.count || 0 },
        recebidas: { total: Number(receivableReceived[0]?.total || 0), count: receivableReceived[0]?.count || 0 },
      },
      topInadimplentes: topInadimplentes.map(i => ({
        cliente: i.cliente || "Sem nome",
        total: Number(i.total || 0),
        count: i.count || 0,
      })),
    };
  }),

  /**
   * Get monthly breakdown - A Receber e A Pagar por mês (10 meses a partir do corrente)
   */
  getMonthlyBreakdown: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const todayBR = getTodayBR();
    const [curY, curM] = todayBR.split('-').map(Number);
    const months: { label: string; from: string; to: string }[] = [];

    for (let i = 0; i < 10; i++) {
      const y = curY;
      const m = curM - 1 + i; // 0-indexed for Date constructor
      const date = new Date(y, m, 1);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const label = date.toLocaleDateString("pt-BR", { month: "long" }).replace(/^./, (c) => c.toUpperCase());
      months.push({
        label,
        from: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`,
        to: `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`,
      });
    }

    const result = await Promise.all(
      months.map(async (month) => {
        const [receber] = await db
          .select({
            total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2))), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(accountsReceivable)
          .where(
            and(
              eq(accountsReceivable.estado, "EMITIDO"),
              gte(accountsReceivable.vencimentoData, month.from + "T00:00:00"),
              lte(accountsReceivable.vencimentoData, month.to + "T23:59:59")
            )
          );

        const [pagar] = await db
          .select({
            total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2))), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(accountsPayable)
          .where(
            and(
              eq(accountsPayable.estado, "EMITIDO"),
              gte(accountsPayable.vencimentoData, month.from + "T00:00:00"),
              lte(accountsPayable.vencimentoData, month.to + "T23:59:59")
            )
          );

        return {
          label: month.label,
          receber: { total: Number(receber?.total || 0), count: receber?.count || 0 },
          pagar: { total: Number(pagar?.total || 0), count: pagar?.count || 0 },
        };
      })
    );

    return result;
  }),

  /**
   * Get contas a pagar list with filters
   */
  getContasAPagar: publicProcedure
    .input(
      z.object({
        estado: z.string().optional(),
        dateFrom: z.string().optional(), // YYYY-MM-DD
        dateTo: z.string().optional(),   // YYYY-MM-DD
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
        sortBy: z.enum(["vencimentoData", "valorLiquido", "fornecedor"]).default("vencimentoData"),
        sortDir: z.enum(["asc", "desc"]).default("asc"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, totalValor: 0 };

      const estado = input?.estado;
      const dateFrom = input?.dateFrom;
      const dateTo = input?.dateTo;
      const limit = input?.limit ?? 100;
      const offset = input?.offset ?? 0;
      const sortBy = input?.sortBy ?? "vencimentoData";
      const sortDir = input?.sortDir ?? "asc";

      const conditions = [];

      if (estado) {
        conditions.push(eq(accountsPayable.estado, estado));
      } else {
        conditions.push(ne(accountsPayable.estado, "CANCELADO"));
      }

      if (dateFrom) {
        conditions.push(gte(accountsPayable.vencimentoData, dateFrom + "T00:00:00"));
      }
      if (dateTo) {
        conditions.push(lte(accountsPayable.vencimentoData, dateTo + "T23:59:59"));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const sortCol =
        sortBy === "valorLiquido"
          ? accountsPayable.valorLiquido
          : sortBy === "fornecedor"
          ? accountsPayable.fornecedor
          : accountsPayable.vencimentoData;

      const sortFn = sortDir === "desc" ? desc : asc;

      const [items, countResult, sumResult] = await Promise.all([
        db
          .select()
          .from(accountsPayable)
          .where(where)
          .orderBy(sortFn(sortCol))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(accountsPayable)
          .where(where),
        db
          .select({ total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2))), 0)` })
          .from(accountsPayable)
          .where(where),
      ]);

      return {
        items,
        total: countResult[0]?.count || 0,
        totalValor: Number(sumResult[0]?.total || 0),
      };
    }),

  /**
   * Get contas a receber list with filters
   */
  getContasAReceber: publicProcedure
    .input(
      z.object({
        estado: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
        sortBy: z.enum(["vencimentoData", "valorLiquido", "cliente"]).default("vencimentoData"),
        sortDir: z.enum(["asc", "desc"]).default("asc"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, totalValor: 0 };

      const estado = input?.estado;
      const dateFrom = input?.dateFrom;
      const dateTo = input?.dateTo;
      const limit = input?.limit ?? 100;
      const offset = input?.offset ?? 0;
      const sortBy = input?.sortBy ?? "vencimentoData";
      const sortDir = input?.sortDir ?? "asc";

      const conditions = [];

      if (estado) {
        conditions.push(eq(accountsReceivable.estado, estado));
      } else {
        conditions.push(ne(accountsReceivable.estado, "CANCELADO"));
      }

      if (dateFrom) {
        conditions.push(gte(accountsReceivable.vencimentoData, dateFrom + "T00:00:00"));
      }
      if (dateTo) {
        conditions.push(lte(accountsReceivable.vencimentoData, dateTo + "T23:59:59"));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const sortCol =
        sortBy === "valorLiquido"
          ? accountsReceivable.valorLiquido
          : sortBy === "cliente"
          ? accountsReceivable.cliente
          : accountsReceivable.vencimentoData;

      const sortFn = sortDir === "desc" ? desc : asc;

      const [items, countResult, sumResult] = await Promise.all([
        db
          .select()
          .from(accountsReceivable)
          .where(where)
          .orderBy(sortFn(sortCol))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(accountsReceivable)
          .where(where),
        db
          .select({ total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2))), 0)` })
          .from(accountsReceivable)
          .where(where),
      ]);

      return {
        items,
        total: countResult[0]?.count || 0,
        totalValor: Number(sumResult[0]?.total || 0),
      };
    }),

  /**
   * Get aging report - contas a receber agrupadas por faixa de atraso
   */
  getAgingReport: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const todayStr = getTodayBR();

    // Get all open receivables
    const openReceivables = await db
      .select({
        cliente: accountsReceivable.cliente,
        valorLiquido: accountsReceivable.valorLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
      })
      .from(accountsReceivable)
      .where(eq(accountsReceivable.estado, "EMITIDO"));

    // Categorize by aging buckets
    const aging = {
      aVencer: { total: 0, count: 0 },
      de1a30: { total: 0, count: 0 },
      de31a60: { total: 0, count: 0 },
      de61a90: { total: 0, count: 0 },
      acima90: { total: 0, count: 0 },
    };

    const clienteAging: Record<string, { total: number; maiorAtraso: number }> = {};

    // Helper: diff in days between two YYYY-MM-DD strings
    function diffDaysStr(a: string, b: string): number {
      const [ay, am, ad] = a.split('-').map(Number);
      const [by, bm, bd] = b.split('-').map(Number);
      const da = new Date(ay, am - 1, ad);
      const db2 = new Date(by, bm - 1, bd);
      return Math.floor((da.getTime() - db2.getTime()) / (1000 * 60 * 60 * 24));
    }

    for (const item of openReceivables) {
      const valor = Number(item.valorLiquido) || 0;
      const vencStr = item.vencimentoData?.split("T")[0];
      if (!vencStr) continue;

      const diffDays = diffDaysStr(todayStr, vencStr);

      if (diffDays < 0) {
        aging.aVencer.total += valor;
        aging.aVencer.count++;
      } else if (diffDays <= 30) {
        aging.de1a30.total += valor;
        aging.de1a30.count++;
      } else if (diffDays <= 60) {
        aging.de31a60.total += valor;
        aging.de31a60.count++;
      } else if (diffDays <= 90) {
        aging.de61a90.total += valor;
        aging.de61a90.count++;
      } else {
        aging.acima90.total += valor;
        aging.acima90.count++;
      }

      // Aggregate by client
      const clienteName = item.cliente || "Sem nome";
      if (!clienteAging[clienteName]) {
        clienteAging[clienteName] = { total: 0, maiorAtraso: 0 };
      }
      if (diffDays > 0) {
        clienteAging[clienteName].total += valor;
        clienteAging[clienteName].maiorAtraso = Math.max(clienteAging[clienteName].maiorAtraso, diffDays);
      }
    }

    // Top devedores
    const topDevedores = Object.entries(clienteAging)
      .filter(([_, v]) => v.total > 0)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .map(([nome, data]) => ({
        cliente: nome,
        totalVencido: data.total,
        maiorAtraso: data.maiorAtraso,
      }));

    return { aging, topDevedores };
  }),

  /**
   * Get payment calendar - contas a pagar: vencidas + 8 semanas
   */
  getPaymentCalendar: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const todayStr = getTodayBR(); // YYYY-MM-DD

    const openPayables = await db
      .select({
        cliente: accountsPayable.fornecedor,
        valorLiquido: accountsPayable.valorLiquido,
        vencimentoData: accountsPayable.vencimentoData,
        referenteA: accountsPayable.referenteA,
      })
      .from(accountsPayable)
      .where(eq(accountsPayable.estado, "EMITIDO"));

    // Build week boundaries using string dates
    const dayOfWeek = getDayOfWeekStr(todayStr);
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayStr = addDaysStr(todayStr, daysToMonday);

    const weeks: { start: string; end: string; label: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const wStart = addDaysStr(mondayStr, i * 7);
      const wEnd = addDaysStr(wStart, 6);
      const dd1 = wStart.slice(8, 10);
      const mm1 = wStart.slice(5, 7);
      const dd2 = wEnd.slice(8, 10);
      const mm2 = wEnd.slice(5, 7);
      weeks.push({ start: wStart, end: wEnd, label: `${dd1}/${mm1} - ${dd2}/${mm2}` });
    }

    type Bucket = { label: string; total: number; count: number; items: any[] };
    const vencidas: Bucket = { label: "Vencidas", total: 0, count: 0, items: [] };
    const weekBuckets: Bucket[] = weeks.map((w) => ({ label: w.label, total: 0, count: 0, items: [] }));

    for (const item of openPayables) {
      const valor = Number(item.valorLiquido) || 0;
      const vencStr = item.vencimentoData?.split("T")[0];
      if (!vencStr) continue;

      const adjVenc = adjustWeekendStr(vencStr);
      const entry = {
        fornecedor: item.cliente || "Sem nome",
        valor,
        vencimento: vencStr,
        referenteA: item.referenteA || "",
      };

      if (adjVenc < todayStr) {
        vencidas.total += valor;
        vencidas.count++;
        vencidas.items.push(entry);
      } else {
        for (let i = 0; i < weeks.length; i++) {
          if (adjVenc >= weeks[i].start && adjVenc <= weeks[i].end) {
            weekBuckets[i].total += valor;
            weekBuckets[i].count++;
            weekBuckets[i].items.push(entry);
            break;
          }
        }
      }
    }

    vencidas.items.sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento));
    for (const b of weekBuckets) {
      b.items.sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento));
    }

    return { vencidas, weeks: weekBuckets };
  }),

  /**
   * Get receivable calendar - contas a receber: vencidas + 8 semanas
   */
  getReceivableCalendar: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const todayStr = getTodayBR(); // YYYY-MM-DD
    const threeDaysAgoStr = addDaysStr(todayStr, -3); // YYYY-MM-DD

    const openReceivables = await db
      .select({
        cliente: accountsReceivable.cliente,
        valorLiquido: accountsReceivable.valorLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
        referenteA: accountsReceivable.referenteA,
      })
      .from(accountsReceivable)
      .where(eq(accountsReceivable.estado, "EMITIDO"));

    // Build week boundaries using string dates
    const dayOfWeek = getDayOfWeekStr(todayStr);
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayStr = addDaysStr(todayStr, daysToMonday);

    const weeks: { start: string; end: string; label: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const wStart = addDaysStr(mondayStr, i * 7);
      const wEnd = addDaysStr(wStart, 6);
      const dd1 = wStart.slice(8, 10);
      const mm1 = wStart.slice(5, 7);
      const dd2 = wEnd.slice(8, 10);
      const mm2 = wEnd.slice(5, 7);
      weeks.push({ start: wStart, end: wEnd, label: `${dd1}/${mm1} - ${dd2}/${mm2}` });
    }

    type Bucket = { label: string; total: number; count: number; items: any[] };
    const vencidas: Bucket = { label: "Vencidas", total: 0, count: 0, items: [] };
    const weekBuckets: Bucket[] = weeks.map((w) => ({ label: w.label, total: 0, count: 0, items: [] }));

    for (const item of openReceivables) {
      const valor = Number(item.valorLiquido) || 0;
      const vencStr = item.vencimentoData?.split("T")[0];
      if (!vencStr) continue;

      const adjVenc = adjustWeekendStr(vencStr);
      const entry = {
        fornecedor: item.cliente || "Sem nome",
        valor,
        vencimento: vencStr,
        referenteA: item.referenteA || "",
      };

      // Regra: SOMENTE contas com no máximo 3 dias de atraso aparecem como vencidas
      // adjVenc < todayStr = vencida; adjVenc >= threeDaysAgoStr = até 3 dias
      if (adjVenc < todayStr && adjVenc >= threeDaysAgoStr) {
        vencidas.total += valor;
        vencidas.count++;
        vencidas.items.push(entry);
      } else if (adjVenc >= todayStr) {
        for (let i = 0; i < weeks.length; i++) {
          if (adjVenc >= weeks[i].start && adjVenc <= weeks[i].end) {
            weekBuckets[i].total += valor;
            weekBuckets[i].count++;
            weekBuckets[i].items.push(entry);
            break;
          }
        }
      }
      // Contas com mais de 3 dias de atraso: não aparecem neste calendário (são inadimplentes)
    }

    vencidas.items.sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento));
    for (const b of weekBuckets) {
      b.items.sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento));
    }

    return { vencidas, weeks: weekBuckets };
  }),

  /**
   * Get inadimplência timeline - valor vencido agrupado por mês de vencimento
   * Para gráfico de linha no card Inadimplência
   */
  getInadimplenciaTimeline: publicProcedure
    .input(z.object({ clienteFilter: z.string().optional() }).optional())
    .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];

    const today = getTodayBR();
    const clienteFilter = input?.clienteFilter?.trim() || "";

    // Buscar todas as contas a receber vencidas (EMITIDO e vencimento <= hoje)
    // Usar raw SQL pois DATE_FORMAT com groupBy/orderBy causa conflito no drizzle
    let query;
    if (clienteFilter) {
      query = sql`SELECT DATE_FORMAT(vencimentoData, '%Y-%m') as mes, COALESCE(SUM(CAST(valorLiquido AS DECIMAL(18,2))), 0) as total, COUNT(*) as count FROM accounts_receivable WHERE estado = 'EMITIDO' AND vencimentoData <= ${today + "T23:59:59"} AND LOWER(cliente) LIKE ${`%${clienteFilter.toLowerCase()}%`} GROUP BY DATE_FORMAT(vencimentoData, '%Y-%m') ORDER BY mes ASC`;
    } else {
      query = sql`SELECT DATE_FORMAT(vencimentoData, '%Y-%m') as mes, COALESCE(SUM(CAST(valorLiquido AS DECIMAL(18,2))), 0) as total, COUNT(*) as count FROM accounts_receivable WHERE estado = 'EMITIDO' AND vencimentoData <= ${today + "T23:59:59"} GROUP BY DATE_FORMAT(vencimentoData, '%Y-%m') ORDER BY mes ASC`;
    }
    const rows: any[] = await db.execute(query);

    // db.execute pode retornar [rows, fields] ou rows diretamente
    const data = Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0]) ? rows[0] : rows;
    return (data as any[]).map((r: any) => ({
      mes: String(r.mes || ""),
      total: Number(r.total || 0),
      count: Number(r.count || 0),
    }));
  }),

  /**
   * Get clientes inadimplentes com detalhes dos títulos
   * Para o card de ranking de clientes inadimplentes
   */
  getClientesInadimplentes: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const today = getTodayBR();

    // Buscar todas as contas a receber vencidas com detalhes
    const rows = await db
      .select({
        cliente: accountsReceivable.cliente,
        valorLiquido: accountsReceivable.valorLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
        referenteA: accountsReceivable.referenteA,
        documentoVinculadoNumero: accountsReceivable.documentoVinculadoNumero,
        parcela: accountsReceivable.parcela,
        parcelasQuantidadeTotal: accountsReceivable.parcelasQuantidadeTotal,
        empresaNome: accountsReceivable.empresaNome,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          lte(accountsReceivable.vencimentoData, today + "T23:59:59")
        )
      )
      .orderBy(asc(accountsReceivable.vencimentoData));

    // Agrupar por cliente
    const clienteMap: Record<string, {
      total: number;
      count: number;
      titulos: { valor: number; vencimento: string; referenteA: string; documento: string; parcela: string; empresa: string }[];
    }> = {};

    for (const row of rows) {
      const nome = row.cliente || "Sem nome";
      if (!clienteMap[nome]) {
        clienteMap[nome] = { total: 0, count: 0, titulos: [] };
      }
      const valor = Number(row.valorLiquido) || 0;
      clienteMap[nome].total += valor;
      clienteMap[nome].count++;
      clienteMap[nome].titulos.push({
        valor,
        vencimento: row.vencimentoData?.split("T")[0] || "",
        referenteA: row.referenteA || "",
        documento: row.documentoVinculadoNumero || "",
        parcela: row.parcela && row.parcelasQuantidadeTotal
          ? `${row.parcela}/${row.parcelasQuantidadeTotal}`
          : "",
        empresa: row.empresaNome || "",
      });
    }

    // Ordenar por valor total decrescente
    return Object.entries(clienteMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([nome, data]) => ({
        cliente: nome,
        total: data.total,
        count: data.count,
        titulos: data.titulos.sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
      }));
  }),

  /**
   * Get detalhes de inadimplência por mês (títulos individuais)
   * Para o painel lateral do card Inadimplência
   */
  getInadimplenciaDetalhesMes: publicProcedure
    .input(z.object({ mes: z.string(), clienteFilter: z.string().optional() }))
    .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { mes: input.mes, total: 0, count: 0, titulos: [] };

    const today = getTodayBR();
    const clienteFilter = input.clienteFilter?.trim() || "";

    // Buscar títulos vencidos do mês específico
    const startDate = `${input.mes}-01`;
    // Calcular último dia do mês
    const [y, m] = input.mes.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${input.mes}-${String(lastDay).padStart(2, "0")}`;

    let conditions = and(
      eq(accountsReceivable.estado, "EMITIDO"),
      lte(accountsReceivable.vencimentoData, today + "T23:59:59"),
      gte(accountsReceivable.vencimentoData, startDate),
      lte(accountsReceivable.vencimentoData, endDate + "T23:59:59")
    );

    if (clienteFilter) {
      conditions = and(
        conditions,
        sql`LOWER(${accountsReceivable.cliente}) LIKE ${`%${clienteFilter.toLowerCase()}%`}`
      );
    }

    const rows = await db
      .select({
        cliente: accountsReceivable.cliente,
        valorLiquido: accountsReceivable.valorLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
        referenteA: accountsReceivable.referenteA,
        documentoVinculadoNumero: accountsReceivable.documentoVinculadoNumero,
      })
      .from(accountsReceivable)
      .where(conditions)
      .orderBy(desc(sql`CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2))`));

    const total = rows.reduce((sum, r) => sum + (Number(r.valorLiquido) || 0), 0);

    return {
      mes: input.mes,
      total,
      count: rows.length,
      titulos: rows.map(r => ({
        cliente: r.cliente || "Sem nome",
        valor: Number(r.valorLiquido) || 0,
        vencimento: r.vencimentoData?.split("T")[0] || "",
        referenteA: r.referenteA || "",
        documento: r.documentoVinculadoNumero || "",
      })),
    };
  }),

  /**
   * Get top fornecedores by value
   */
  getTopFornecedores: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const result = await db
      .select({
        fornecedor: accountsPayable.fornecedor,
        totalEmAberto: sql<string>`COALESCE(SUM(CASE WHEN ${accountsPayable.estado} = 'EMITIDO' THEN CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2)) ELSE 0 END), 0)`,
        totalPago: sql<string>`COALESCE(SUM(CASE WHEN ${accountsPayable.estado} = 'PAGO' THEN CAST(${accountsPayable.valorPagoLiquido} AS DECIMAL(18,2)) ELSE 0 END), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsPayable)
      .where(ne(accountsPayable.estado, "CANCELADO"))
      .groupBy(accountsPayable.fornecedor)
      .orderBy(desc(sql`SUM(CASE WHEN ${accountsPayable.estado} = 'EMITIDO' THEN CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2)) ELSE 0 END)`))
      .limit(15);

    return result.map((r) => ({
      fornecedor: r.fornecedor || "Sem nome",
      totalEmAberto: Number(r.totalEmAberto),
      totalPago: Number(r.totalPago),
      count: r.count,
    }));
  }),

  /**
   * Get top clientes by receivable value
   */
  getTopClientes: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const result = await db
      .select({
        cliente: accountsReceivable.cliente,
        totalEmAberto: sql<string>`COALESCE(SUM(CASE WHEN ${accountsReceivable.estado} = 'EMITIDO' THEN CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) ELSE 0 END), 0)`,
        totalRecebido: sql<string>`COALESCE(SUM(CASE WHEN ${accountsReceivable.estado} = 'RECEBIDO' THEN CAST(${accountsReceivable.valorRecebidoLiquido} AS DECIMAL(18,2)) ELSE 0 END), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(ne(accountsReceivable.estado, "CANCELADO"))
      .groupBy(accountsReceivable.cliente)
      .orderBy(desc(sql`SUM(CASE WHEN ${accountsReceivable.estado} = 'EMITIDO' THEN CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) ELSE 0 END)`))
      .limit(15);

    return result.map((r) => ({
      cliente: r.cliente || "Sem nome",
      totalEmAberto: Number(r.totalEmAberto),
      totalRecebido: Number(r.totalRecebido),
      count: r.count,
    }));
  }),

  /**
   * Get cash flow chart data - recebimentos vs pagamentos por semana
   * Mostra saldo acumulado (positivo/negativo) ao longo das próximas 8 semanas
   */
  getCashFlowChart: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const todayStr = getTodayBR(); // YYYY-MM-DD
    const threeDaysAgoStr = addDaysStr(todayStr, -3);

    // Fetch all open payables and receivables
    const openPayables = await db
      .select({
        valorLiquido: accountsPayable.valorLiquido,
        vencimentoData: accountsPayable.vencimentoData,
      })
      .from(accountsPayable)
      .where(eq(accountsPayable.estado, "EMITIDO"));

    const openReceivables = await db
      .select({
        valorLiquido: accountsReceivable.valorLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
      })
      .from(accountsReceivable)
      .where(eq(accountsReceivable.estado, "EMITIDO"));

    // Build week boundaries using string dates
    const dayOfWeek = getDayOfWeekStr(todayStr);
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayStr = addDaysStr(todayStr, daysToMonday);

    const weeks: { start: string; end: string; label: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const wStart = addDaysStr(mondayStr, i * 7);
      const wEnd = addDaysStr(wStart, 6);
      const dd1 = wStart.slice(8, 10);
      const mm1 = wStart.slice(5, 7);
      const dd2 = wEnd.slice(8, 10);
      const mm2 = wEnd.slice(5, 7);
      weeks.push({ start: wStart, end: wEnd, label: `${dd1}/${mm1} - ${dd2}/${mm2}` });
    }

    // Initialize week data
    const weekData = weeks.map((w) => ({
      label: w.label,
      recebimentos: 0,
      pagamentos: 0,
      saldo: 0,
      saldoAcumulado: 0,
    }));

    // Vencidas: receber só até 3 dias de atraso (sem inadimplentes), pagar todas vencidas
    let vencidasReceber = 0;
    let vencidasPagar = 0;

    // Distribute receivables - somente até 3 dias de atraso
    for (const item of openReceivables) {
      const valor = Number(item.valorLiquido) || 0;
      const vencStr = item.vencimentoData?.split("T")[0];
      if (!vencStr) continue;
      const adjVenc = adjustWeekendStr(vencStr);

      if (adjVenc < todayStr && adjVenc >= threeDaysAgoStr) {
        vencidasReceber += valor;
      } else if (adjVenc >= todayStr) {
        for (let i = 0; i < weeks.length; i++) {
          if (adjVenc >= weeks[i].start && adjVenc <= weeks[i].end) {
            weekData[i].recebimentos += valor;
            break;
          }
        }
      }
      // Contas com mais de 3 dias de atraso: não entram no fluxo de caixa (inadimplentes)
    }

    // Distribute payables - todas vencidas entram
    for (const item of openPayables) {
      const valor = Number(item.valorLiquido) || 0;
      const vencStr = item.vencimentoData?.split("T")[0];
      if (!vencStr) continue;
      const adjVenc = adjustWeekendStr(vencStr);

      if (adjVenc < todayStr) {
        vencidasPagar += valor;
      } else {
        for (let i = 0; i < weeks.length; i++) {
          if (adjVenc >= weeks[i].start && adjVenc <= weeks[i].end) {
            weekData[i].pagamentos += valor;
            break;
          }
        }
      }
    }

    // Calculate saldo per week and accumulated
    let acumulado = vencidasReceber - vencidasPagar;
    for (const w of weekData) {
      w.saldo = w.recebimentos - w.pagamentos;
      acumulado += w.saldo;
      w.saldoAcumulado = acumulado;
    }

    return {
      vencidas: {
        recebimentos: vencidasReceber,
        pagamentos: vencidasPagar,
        saldo: vencidasReceber - vencidasPagar,
      },
      weeks: weekData,
    };
  }),

  /**
   * Get bank accounts with current balances
   * saldoAtual = saldoInicial + sum(OFX transactions after saldoInicialData)
   */
  getBankBalances: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { accounts: [], totalSaldo: 0 };

    const accounts = await db.select().from(bankAccounts).where(eq(bankAccounts.ativo, true));
    const transactions = await db.select().from(bankTransactions);

    // Group transactions by contaBancariaId
    const txnByAccount = new Map<number, Array<{ data: string; valor: number }>>();
    transactions.forEach(t => {
      const list = txnByAccount.get(t.contaBancariaId) || [];
      list.push({ data: t.data, valor: Number(t.valor) });
      txnByAccount.set(t.contaBancariaId, list);
    });

    let totalSaldo = 0;
    const result = accounts.map(acc => {
      const saldoInicial = Number(acc.saldoInicial || 0);
      const dataRef = acc.saldoInicialData || "";
      const txns = txnByAccount.get(acc.maxiprodId) || [];
      
      // Sum only transactions AFTER the reference date
      const movimentacao = txns
        .filter(t => dataRef ? t.data > dataRef : true)
        .reduce((sum, t) => sum + t.valor, 0);
      
      const saldoAtual = saldoInicial + movimentacao;
      totalSaldo += saldoAtual;

      return {
        id: acc.id,
        maxiprodId: acc.maxiprodId,
        bancoNome: acc.bancoNome,
        agencia: acc.agencia,
        contaNumero: acc.contaNumero,
        empresaNome: acc.empresaNome,
        saldoInicial,
        saldoInicialData: dataRef,
        movimentacao: Math.round(movimentacao * 100) / 100,
        saldoAtual: Math.round(saldoAtual * 100) / 100,
        totalTransacoes: txns.length,
      };
    }).sort((a, b) => b.saldoAtual - a.saldoAtual);

    return { accounts: result, totalSaldo: Math.round(totalSaldo * 100) / 100 };
  }),

  /**
   * Update saldo inicial for a bank account
   */
  updateBankBalance: publicProcedure
    .input(z.object({
      maxiprodId: z.number(),
      saldoInicial: z.string(),
      saldoInicialData: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(bankAccounts)
        .set({
          saldoInicial: input.saldoInicial,
          saldoInicialData: input.saldoInicialData,
        })
        .where(eq(bankAccounts.maxiprodId, input.maxiprodId));

      return { success: true };
    }),
});
