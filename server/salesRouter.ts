import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { salesOrders, productSegmentOverrides } from "../drizzle/schema";
import { sql, and, gte, lte, desc, asc, inArray } from "drizzle-orm";

/**
 * Sales analytics router
 * Provides endpoints for ingesting sales order data and querying analytics
 */
export const salesRouter = router({
  /**
   * Ingest sales order items from browser collection
   */
  ingestSalesOrders: publicProcedure
    .input(z.object({
      items: z.array(z.object({
        dataEmissao: z.string().nullable().optional(),
        dataEntrega: z.string().nullable().optional(),
        dataAprovacao: z.string().nullable().optional(),
        pedido: z.string().nullable().optional(),
        cliente: z.string().nullable().optional(),
        clienteApelido: z.string().nullable().optional(),
        uf: z.string().nullable().optional(),
        descricao: z.string().nullable().optional(),
        estadoItem: z.string().nullable().optional(),
        quantidade: z.number().nullable().optional(),
        valorUnitario: z.number().nullable().optional(),
        valorTotal: z.number().nullable().optional(),
        valorContabil: z.number().nullable().optional(),
        valorFaturar: z.number().nullable().optional(),
        fatorConversao: z.number().nullable().optional(),
        codigoGrupo: z.string().nullable().optional(),
        idGrupoItem: z.number().nullable().optional(),
        empresa: z.string().nullable().optional(),
        representante: z.string().nullable().optional(),
        segmento: z.string().nullable().optional(),
        regiao: z.string().nullable().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Clear existing sales orders and insert new ones
      await db.delete(salesOrders);

      const rows = input.items.map((item) => ({
        dataEmissao: item.dataEmissao || null,
        dataEntrega: item.dataEntrega || null,
        dataAprovacao: item.dataAprovacao || null,
        pedido: item.pedido || null,
        cliente: item.cliente || null,
        clienteApelido: item.clienteApelido || null,
        uf: item.uf || null,
        descricao: item.descricao || null,
        estadoItem: item.estadoItem || null,
        quantidade: item.quantidade != null ? String(item.quantidade) : null,
        valorUnitario: item.valorUnitario != null ? String(item.valorUnitario) : null,
        valorTotal: item.valorTotal != null ? String(item.valorTotal) : null,
        valorContabil: item.valorContabil != null ? String(item.valorContabil) : null,
        valorFaturar: item.valorFaturar != null ? String(item.valorFaturar) : null,
        fatorConversao: item.fatorConversao != null ? String(item.fatorConversao) : null,
        codigoGrupo: item.codigoGrupo || null,
        idGrupoItem: item.idGrupoItem || null,
        empresa: item.empresa || null,
        representante: item.representante || null,
        segmento: item.segmento || null,
        regiao: item.regiao || null,
      }));

      // Insert in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        await db.insert(salesOrders).values(rows.slice(i, i + 50));
      }

      return { success: true, count: rows.length };
    }),

  /**
   * Get sales analytics for a given period
   */
  getAnalytics: publicProcedure
    .input(z.object({
      startDate: z.string(), // ISO date string
      endDate: z.string(),   // ISO date string
      team: z.enum(["all", "industrializacao", "importacao"]).optional().default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Default segment classification by codigoGrupo
      const importacaoGroups = ["07", "08", "20", "VARETA", "ESPETO"];
      const industrializacaoGroups = ["02", "03", "04", "06", "09", "11", "13", "14", "15", "PALITO"];

      // Load product segment overrides
      const overrides = await db.select().from(productSegmentOverrides);
      const overrideMap = new Map(overrides.map(o => [o.descricao, o.segment]));

      const conditions = [
        gte(salesOrders.dataEmissao, input.startDate),
        lte(salesOrders.dataEmissao, input.endDate + "T23:59:59.999Z"),
      ];

      // Query all items in the date range (filter by team in-memory to respect overrides)
      const allItems = await db
        .select()
        .from(salesOrders)
        .where(
          and(...conditions)
        );

      // Apply team filter using overrides
      const getItemSegment = (item: typeof allItems[0]) => {
        const override = overrideMap.get(item.descricao || "");
        if (override) return override;
        const grupo = (item.codigoGrupo || "").toUpperCase();
        if (importacaoGroups.includes(grupo)) return "importacao";
        if (industrializacaoGroups.includes(grupo)) return "industrializacao";
        return "outros";
      };

      let items = allItems;
      if (input.team !== "all") {
        items = allItems.filter(item => getItemSegment(item) === input.team);
      }

      if (items.length === 0) {
        return {
          totalItems: 0,
          totalOrders: 0,
          totalClients: 0,
          totalValue: 0,
          totalFaturado: 0,
          totalAFaturar: 0,
          totalAFaturarAnterior: 0,
          ticketMedio: 0,
          bySegmentKPI: [],
          byMonth: [],
          byDay: [],
          byClient: [],
          byProduct: [],
          byUF: [],
          bySegmento: [],
          byWeek: [],
        };
      }

      // Compute analytics
      const uniqueOrders = new Set(items.map((i) => i.pedido).filter(Boolean));
      const uniqueClients = new Set(items.map((i) => i.cliente).filter(Boolean));
      const totalValue = items.reduce((sum, i) => sum + Number(i.valorTotal || 0), 0);
      const totalFaturado = items
        .filter((i) => i.estadoItem === "Faturado")
        .reduce((sum, i) => sum + Number(i.valorTotal || 0), 0);
      // A Faturar within the selected period
      const totalAFaturar = items
        .filter((i) => i.estadoItem === "A faturar")
        .reduce((sum, i) => sum + Number(i.valorTotal || 0), 0);

      // A Faturar Anterior: query ALL "A faturar" items from BEFORE the selected period
      // This is independent of the date filter - shows accumulated backlog
      const allAFaturarAnterior = await db
        .select()
        .from(salesOrders)
        .where(
          and(
            sql`${salesOrders.estadoItem} = 'A faturar'`,
            sql`${salesOrders.dataEmissao} < ${input.startDate}`
          )
        );
      let anteriorItems = allAFaturarAnterior;
      if (input.team !== "all") {
        anteriorItems = allAFaturarAnterior.filter(item => getItemSegment(item) === input.team);
      }
      const totalAFaturarAnterior = anteriorItems
        .reduce((sum, i) => sum + Number(i.valorTotal || 0), 0);

      // By month
      const monthMap = new Map<string, { value: number; orders: Set<string>; items: number }>();
      for (const item of items) {
        if (!item.dataEmissao) continue;
        const month = item.dataEmissao.substring(0, 7);
        if (!monthMap.has(month)) monthMap.set(month, { value: 0, orders: new Set(), items: 0 });
        const m = monthMap.get(month)!;
        m.value += Number(item.valorTotal || 0);
        if (item.pedido) m.orders.add(item.pedido);
        m.items++;
      }
      const byMonth = Array.from(monthMap.entries())
        .map(([month, data]) => ({
          month,
          value: Math.round(data.value * 100) / 100,
          orders: data.orders.size,
          items: data.items,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // By day
      const dayMap = new Map<string, { value: number; orders: Set<string>; items: number }>();
      for (const item of items) {
        if (!item.dataEmissao) continue;
        const dayKey = item.dataEmissao.substring(0, 10); // YYYY-MM-DD
        if (!dayMap.has(dayKey)) dayMap.set(dayKey, { value: 0, orders: new Set(), items: 0 });
        const d = dayMap.get(dayKey)!;
        d.value += Number(item.valorTotal || 0);
        if (item.pedido) d.orders.add(item.pedido);
        d.items++;
      }
      const byDay = Array.from(dayMap.entries())
        .map(([day, data]) => ({
          day,
          value: Math.round(data.value * 100) / 100,
          orders: data.orders.size,
          items: data.items,
        }))
        .sort((a, b) => a.day.localeCompare(b.day));

      // By week (kept for compatibility)
      const weekMap = new Map<string, { value: number; orders: Set<string>; items: number }>();
      for (const item of items) {
        if (!item.dataEmissao) continue;
        const d = new Date(item.dataEmissao);
        // Get ISO week start (Monday)
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(d.setDate(diff));
        const weekKey = weekStart.toISOString().substring(0, 10);
        if (!weekMap.has(weekKey)) weekMap.set(weekKey, { value: 0, orders: new Set(), items: 0 });
        const w = weekMap.get(weekKey)!;
        w.value += Number(item.valorTotal || 0);
        if (item.pedido) w.orders.add(item.pedido);
        w.items++;
      }
      const byWeek = Array.from(weekMap.entries())
        .map(([week, data]) => ({
          week,
          value: Math.round(data.value * 100) / 100,
          orders: data.orders.size,
          items: data.items,
        }))
        .sort((a, b) => a.week.localeCompare(b.week));

      // By client (top 20)
      const clientMap = new Map<string, { value: number; orders: Set<string>; items: number; uf: string; segmento: string }>();
      for (const item of items) {
        if (!item.cliente) continue;
        if (!clientMap.has(item.cliente)) {
          clientMap.set(item.cliente, { value: 0, orders: new Set(), items: 0, uf: item.uf || "", segmento: item.segmento || "" });
        }
        const c = clientMap.get(item.cliente)!;
        c.value += Number(item.valorTotal || 0);
        if (item.pedido) c.orders.add(item.pedido);
        c.items++;
      }
      const byClient = Array.from(clientMap.entries())
        .map(([name, data]) => ({
          name,
          value: Math.round(data.value * 100) / 100,
          orders: data.orders.size,
          items: data.items,
          uf: data.uf,
          segmento: data.segmento,
        }))
        .sort((a, b) => b.value - a.value);

      // By product (all, sorted by value)
      const productMap = new Map<string, { value: number; qty: number; orders: Set<string> }>();
      for (const item of items) {
        if (!item.descricao) continue;
        if (!productMap.has(item.descricao)) {
          productMap.set(item.descricao, { value: 0, qty: 0, orders: new Set() });
        }
        const p = productMap.get(item.descricao)!;
        p.value += Number(item.valorTotal || 0);
        p.qty += Number(item.quantidade || 0);
        if (item.pedido) p.orders.add(item.pedido);
      }
      const byProduct = Array.from(productMap.entries())
        .map(([name, data]) => ({
          name,
          value: Math.round(data.value * 100) / 100,
          qty: data.qty,
          orders: data.orders.size,
        }))
        .sort((a, b) => b.value - a.value);

      // By UF
      const ufMap = new Map<string, number>();
      for (const item of items) {
        const uf = item.uf || "N/A";
        ufMap.set(uf, (ufMap.get(uf) || 0) + Number(item.valorTotal || 0));
      }
      const byUF = Array.from(ufMap.entries())
        .map(([uf, value]) => ({ uf, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value);

      // By segmento
      const segMap = new Map<string, number>();
      for (const item of items) {
        const seg = item.segmento || "N/A";
        segMap.set(seg, (segMap.get(seg) || 0) + Number(item.valorTotal || 0));
      }
      const bySegmento = Array.from(segMap.entries())
        .map(([segmento, value]) => ({ segmento, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value);

      // Segment breakdown for KPI cards
      const segmentLabels: Record<string, string> = {
        importacao: "Bambu",
        industrializacao: "Industrializado",
        outros: "Outros",
      };
      const segBreakdown: Record<string, { value: number; faturado: number; aFaturar: number }> = {};
      for (const item of allItems) {
        const seg = getItemSegment(item);
        const label = segmentLabels[seg] || seg;
        if (!segBreakdown[label]) segBreakdown[label] = { value: 0, faturado: 0, aFaturar: 0 };
        segBreakdown[label].value += Number(item.valorTotal || 0);
        if (item.estadoItem === "Faturado") segBreakdown[label].faturado += Number(item.valorTotal || 0);
        if (item.estadoItem === "A faturar") segBreakdown[label].aFaturar += Number(item.valorTotal || 0);
      }
      // Segment breakdown for A Faturar Anterior
      const segBreakdownAnterior: Record<string, number> = {};
      for (const item of allAFaturarAnterior) {
        const seg = getItemSegment(item);
        const label = segmentLabels[seg] || seg;
        segBreakdownAnterior[label] = (segBreakdownAnterior[label] || 0) + Number(item.valorTotal || 0);
      }
      // Build final breakdown arrays
      const bySegmentKPI = Object.entries(segBreakdown).map(([name, d]) => ({
        name,
        value: Math.round(d.value * 100) / 100,
        faturado: Math.round(d.faturado * 100) / 100,
        aFaturar: Math.round(d.aFaturar * 100) / 100,
        aFaturarAnterior: Math.round((segBreakdownAnterior[name] || 0) * 100) / 100,
      })).sort((a, b) => b.value - a.value);

      return {
        totalItems: items.length,
        totalOrders: uniqueOrders.size,
        totalClients: uniqueClients.size,
        totalValue: Math.round(totalValue * 100) / 100,
        totalFaturado: Math.round(totalFaturado * 100) / 100,
        totalAFaturar: Math.round(totalAFaturar * 100) / 100,
        totalAFaturarAnterior: Math.round(totalAFaturarAnterior * 100) / 100,
        ticketMedio: uniqueOrders.size > 0 ? Math.round((totalValue / uniqueOrders.size) * 100) / 100 : 0,
        bySegmentKPI,
        byMonth,
        byDay,
        byWeek,
        byClient,
        byProduct,
        byUF,
        bySegmento,
      };
    }),

  /**
   * Get cumulative daily data for current month, last month, and best month
   * Used for the comparison line chart
   */
  getCumulativeComparison: publicProcedure
    .input(z.object({
      team: z.enum(["all", "industrializacao", "importacao"]).optional().default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Default segment classification by codigoGrupo
      const importacaoGroups = ["07", "08", "20", "VARETA", "ESPETO"];
      const industrializacaoGroups = ["02", "03", "04", "06", "09", "11", "13", "14", "15", "PALITO"];

      // Load product segment overrides
      const overrides = await db.select().from(productSegmentOverrides);
      const overrideMap = new Map(overrides.map(o => [o.descricao, o.segment]));

      const getItemSegment = (item: any) => {
        const override = overrideMap.get(item.descricao || "");
        if (override) return override;
        const grupo = (item.codigoGrupo || "").toUpperCase();
        if (importacaoGroups.includes(grupo)) return "importacao";
        if (industrializacaoGroups.includes(grupo)) return "industrializacao";
        return "outros";
      };

      // Get ALL sales orders then filter by team in-memory (respecting overrides)
      const rawItems = await db
        .select()
        .from(salesOrders);

      const allItems = input.team !== "all"
        ? rawItems.filter(item => getItemSegment(item) === input.team)
        : rawItems;

      if (allItems.length === 0) return { currentMonth: [], lastMonth: [], bestMonth: [], bestMonthLabel: "" };

      // Group by month -> day-of-month -> value
      const monthDayMap: Map<string, Map<number, number>> = new Map();
      for (const item of allItems) {
        if (!item.dataEmissao) continue;
        const monthKey = item.dataEmissao.substring(0, 7); // YYYY-MM
        const dayOfMonth = parseInt(item.dataEmissao.substring(8, 10));
        const val = Number(item.valorTotal || 0);

        if (!monthDayMap.has(monthKey)) monthDayMap.set(monthKey, new Map());
        const dayMap = monthDayMap.get(monthKey)!;
        dayMap.set(dayOfMonth, (dayMap.get(dayOfMonth) || 0) + val);
      }

      // Current month and last month
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

      // Find best month (highest total, excluding current month)
      let bestMonthKey = "";
      let bestMonthTotal = 0;
      const monthEntries = Array.from(monthDayMap.entries());
      for (const [monthKey, dayMap] of monthEntries) {
        if (monthKey === currentMonthKey) continue;
        let total = 0;
        const vals = Array.from(dayMap.values());
        for (const v of vals) total += v;
        if (total > bestMonthTotal) {
          bestMonthTotal = total;
          bestMonthKey = monthKey;
        }
      }

      // Build cumulative arrays (day 1 to 31)
      const buildCumulative = (monthKey: string): Array<{ day: number; value: number; cumulative: number }> => {
        const dayMap = monthDayMap.get(monthKey);
        if (!dayMap) return [];

        // Determine how many days in this month
        const [y, m] = monthKey.split("-").map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();

        const result: Array<{ day: number; value: number; cumulative: number }> = [];
        let cumulative = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const dayVal = dayMap.get(d) || 0;
          cumulative += dayVal;
          result.push({
            day: d,
            value: Math.round(dayVal * 100) / 100,
            cumulative: Math.round(cumulative * 100) / 100,
          });
        }
        return result;
      };

      // Format month label
      const formatMonthLabel = (key: string) => {
        if (!key) return "";
        const [y, m] = key.split("-");
        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
      };

      return {
        currentMonth: buildCumulative(currentMonthKey),
        currentMonthLabel: formatMonthLabel(currentMonthKey),
        lastMonth: buildCumulative(lastMonthKey),
        lastMonthLabel: formatMonthLabel(lastMonthKey),
        bestMonth: buildCumulative(bestMonthKey),
        bestMonthLabel: formatMonthLabel(bestMonthKey),
        bestMonthKey,
        lastMonthKey,
      };
    }),

  /**
   * Get available date range for sales data
   */
  getDateRange: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const result = await db
      .select({
        minDate: sql<string>`MIN(dataEmissao)`,
        maxDate: sql<string>`MAX(dataEmissao)`,
        totalCount: sql<number>`COUNT(*)`,
      })
      .from(salesOrders);

    if (!result[0] || result[0].totalCount === 0) {
      return { minDate: null, maxDate: null, totalCount: 0 };
    }

    return {
      minDate: result[0].minDate,
      maxDate: result[0].maxDate,
      totalCount: result[0].totalCount,
    };
  }),
});
