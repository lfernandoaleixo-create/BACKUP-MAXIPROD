import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { salesOrders, orderItems, accountsReceivable } from "../drizzle/schema";
import { sql, and, gte, lte, like, or, eq, desc } from "drizzle-orm";

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
        estadoConfiguravel: z.string().nullable().optional(),
        crmSegmento: z.string().nullable().optional(),
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
        estadoConfiguravel: item.estadoConfiguravel || null,
        crmSegmento: item.crmSegmento || null,
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
      grupo: z.enum(["all", "importacao_revenda", "industrializacao", "importacao_mp"]).optional().default("all"),
      subgrupo: z.string().optional().default("all"),
      crmSegmento: z.string().optional().default("all"),
      // Keep legacy team for backward compat
      team: z.enum(["all", "industrializacao", "importacao"]).optional().default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Map estadoConfiguravel to grupo
      const estadoToGrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
        if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
        return "outros";
      };

      // Map estadoConfiguravel to subgrupo
      const estadoToSubgrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU") return "bambu";
        if (e === "FIBRA") return "fibra";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
        if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
        return "outros";
      };

      // Legacy team mapping
      const teamToGrupo = (team: string): string => {
        if (team === "importacao") return "importacao_revenda";
        if (team === "industrializacao") return "industrializacao";
        return "all";
      };

      // Comparar apenas a parte YYYY-MM-DD da dataEmissao (evita bugs de timezone)
      const startDay = input.startDate.substring(0, 10); // "YYYY-MM-DD"
      const endDay = input.endDate.substring(0, 10);     // "YYYY-MM-DD"
      const conditions = [
        sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) >= ${startDay}`,
        sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) <= ${endDay}`,
      ];

      const allItems = await db
        .select()
        .from(salesOrders)
        .where(
          and(...conditions)
        );

      // Determine effective grupo filter (new filters take priority over legacy team)
      const effectiveGrupo = input.grupo !== "all" ? input.grupo : teamToGrupo(input.team || "all");

      // REGRA DE NEGÓCIO: Excluir pedidos em "Digitação" - não são confirmados
      const isDigitacao = (nota: string | null) => {
        if (!nota) return false;
        const n = nota.toUpperCase();
        return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
      };

      // REGRA DE NEGÓCIO: Excluir itens "outros" (CANCELADO, AMOSTRA, BONIFICAÇÃO, GILSON, NULL)
      // Mesma regra do card Vendas da aba Financeiro
      const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";

      // Apply hierarchical filters
      let items = allItems.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));
      if (effectiveGrupo !== "all") {
        items = items.filter(item => estadoToGrupo(item.estadoConfiguravel) === effectiveGrupo);
      }
      if (input.subgrupo !== "all") {
        items = items.filter(item => estadoToSubgrupo(item.estadoConfiguravel) === input.subgrupo);
      }
      if (input.crmSegmento !== "all") {
        items = items.filter(item => (item.crmSegmento || "").toUpperCase() === input.crmSegmento.toUpperCase());
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
          totalAmostraBonif: 0,
          totalAmostra: 0,
          totalBonificacao: 0,
          pedidosAmostraBonif: 0,
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

      // Amostra/Bonificação: itens excluídos do total mas mostrados em card separado
      const isAmostraBonif = (estado: string | null) => {
        if (!estado) return false;
        const e = estado.toUpperCase();
        return e.includes("AMOSTRA") || e.includes("BONIFICA");
      };
      const amostraBonifItems = allItems.filter(item => 
        !isDigitacao(item.estadoNota) && isAmostraBonif(item.estadoConfiguravel)
      );
      const totalAmostra = amostraBonifItems
        .filter(i => (i.estadoConfiguravel || "").toUpperCase().includes("AMOSTRA"))
        .reduce((sum, i) => sum + Number(i.valorTotal || 0), 0);
      const totalBonificacao = amostraBonifItems
        .filter(i => (i.estadoConfiguravel || "").toUpperCase().includes("BONIFICA"))
        .reduce((sum, i) => sum + Number(i.valorTotal || 0), 0);
      const totalAmostraBonif = totalAmostra + totalBonificacao;
      const pedidosAmostraBonif = new Set(amostraBonifItems.map(i => i.pedido).filter(Boolean)).size;

      // A Faturar Anterior: query ALL "A faturar" items from BEFORE the selected period
      // This is independent of the date filter - shows accumulated backlog
      const allAFaturarAnterior = await db
        .select()
        .from(salesOrders)
        .where(
          and(
            sql`${salesOrders.estadoItem} = 'A faturar'`,
            sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) < ${startDay}`
          )
        );
      let anteriorItems = allAFaturarAnterior.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));
      if (effectiveGrupo !== "all") {
        anteriorItems = anteriorItems.filter(item => estadoToGrupo(item.estadoConfiguravel) === effectiveGrupo);
      }
      if (input.subgrupo !== "all") {
        anteriorItems = anteriorItems.filter(item => estadoToSubgrupo(item.estadoConfiguravel) === input.subgrupo);
      }
      if (input.crmSegmento !== "all") {
        anteriorItems = anteriorItems.filter(item => (item.crmSegmento || "").toUpperCase() === input.crmSegmento.toUpperCase());
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
      const dayMap = new Map<string, { value: number; orders: Set<string>; items: number; orderDetails: Map<string, { cliente: string; valor: number }> }>();
      for (const item of items) {
        if (!item.dataEmissao) continue;
        const dayKey = item.dataEmissao.substring(0, 10); // YYYY-MM-DD
        if (!dayMap.has(dayKey)) dayMap.set(dayKey, { value: 0, orders: new Set(), items: 0, orderDetails: new Map() });
        const d = dayMap.get(dayKey)!;
        d.value += Number(item.valorTotal || 0);
        if (item.pedido) {
          d.orders.add(item.pedido);
          const existing = d.orderDetails.get(item.pedido);
          if (existing) {
            existing.valor += Number(item.valorTotal || 0);
          } else {
            d.orderDetails.set(item.pedido, { cliente: item.clienteApelido || item.cliente || "—", valor: Number(item.valorTotal || 0) });
          }
        }
        d.items++;
      }
      const byDay = Array.from(dayMap.entries())
        .map(([day, data]) => ({
          day,
          value: Math.round(data.value * 100) / 100,
          orders: data.orders.size,
          items: data.items,
          orderList: Array.from(data.orderDetails.entries()).map(([pedido, det]) => ({
            pedido,
            cliente: det.cliente,
            valor: Math.round(det.valor * 100) / 100,
          })).sort((a, b) => b.valor - a.valor),
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

      // Segment breakdown for KPI cards - uses filtered items to reflect active filters
      const grupoLabels: Record<string, string> = {
        importacao_revenda: "Revenda (Bambu/Fibra)",
        industrializacao: "Industrializado",
        importacao_mp: "Import. Mat\u00e9ria-Prima",
      };
      const segBreakdown: Record<string, { value: number; faturado: number; aFaturar: number }> = {};
      for (const item of items) {
        const seg = estadoToGrupo(item.estadoConfiguravel);
        if (seg === "outros") continue; // Excluir itens "outros"
        const label = grupoLabels[seg] || seg;
        if (!segBreakdown[label]) segBreakdown[label] = { value: 0, faturado: 0, aFaturar: 0 };
        segBreakdown[label].value += Number(item.valorTotal || 0);
        if (item.estadoItem === "Faturado") segBreakdown[label].faturado += Number(item.valorTotal || 0);
        if (item.estadoItem === "A faturar") segBreakdown[label].aFaturar += Number(item.valorTotal || 0);
      }
      // Segment breakdown for A Faturar Anterior
      const segBreakdownAnterior: Record<string, number> = {};
      for (const item of anteriorItems) {
        const seg = estadoToGrupo(item.estadoConfiguravel);
        if (seg === "outros") continue; // Excluir itens "outros"
        const label = grupoLabels[seg] || seg;
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

      // CRM Segment breakdown - breakdown by crmSegmento field
      const crmBreakdown: Record<string, { value: number; faturado: number; aFaturar: number }> = {};
      for (const item of items) {
        const crm = item.crmSegmento || "Sem CRM";
        if (!crmBreakdown[crm]) crmBreakdown[crm] = { value: 0, faturado: 0, aFaturar: 0 };
        crmBreakdown[crm].value += Number(item.valorTotal || 0);
        if (item.estadoItem === "Faturado") crmBreakdown[crm].faturado += Number(item.valorTotal || 0);
        if (item.estadoItem === "A faturar") crmBreakdown[crm].aFaturar += Number(item.valorTotal || 0);
      }
      const crmBreakdownAnterior: Record<string, number> = {};
      for (const item of anteriorItems) {
        const crm = item.crmSegmento || "Sem CRM";
        crmBreakdownAnterior[crm] = (crmBreakdownAnterior[crm] || 0) + Number(item.valorTotal || 0);
      }
      const byCrmSegmentKPI = Object.entries(crmBreakdown).map(([name, d]) => ({
        name,
        value: Math.round(d.value * 100) / 100,
        faturado: Math.round(d.faturado * 100) / 100,
        aFaturar: Math.round(d.aFaturar * 100) / 100,
        aFaturarAnterior: Math.round((crmBreakdownAnterior[name] || 0) * 100) / 100,
      })).sort((a, b) => b.value - a.value);

      return {
        totalItems: items.length,
        totalOrders: uniqueOrders.size,
        totalClients: uniqueClients.size,
        totalValue: Math.round(totalValue * 100) / 100,
        totalFaturado: Math.round(totalFaturado * 100) / 100,
        totalAFaturar: Math.round(totalAFaturar * 100) / 100,
        totalAFaturarAnterior: Math.round(totalAFaturarAnterior * 100) / 100,
        totalAmostraBonif: Math.round(totalAmostraBonif * 100) / 100,
        totalAmostra: Math.round(totalAmostra * 100) / 100,
        totalBonificacao: Math.round(totalBonificacao * 100) / 100,
        pedidosAmostraBonif,
        ticketMedio: uniqueOrders.size > 0 ? Math.round((totalValue / uniqueOrders.size) * 100) / 100 : 0,
        bySegmentKPI,
        byCrmSegmentKPI,
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
   * Get available hierarchical filter options from sales_orders data
   */
  getAvailableFilters: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { grupos: [], subgrupos: {}, crmSegmentos: [] };

    const allItems = (await db.select({
      estadoConfiguravel: salesOrders.estadoConfiguravel,
      crmSegmento: salesOrders.crmSegmento,
      estadoNota: salesOrders.estadoNota,
    }).from(salesOrders)).filter(item => {
      // REGRA DE NEGÓCIO: Excluir pedidos em "Digitação"
      if (!item.estadoNota) return true;
      const n = item.estadoNota.toUpperCase();
      return n !== 'DIGITAÇÃO' && n !== 'DIGITACAO';
    });

    // Map estadoConfiguravel to grupo/subgrupo
    const estadoToGrupo = (estado: string | null): string => {
      if (!estado) return "outros";
      const e = estado.toUpperCase();
      if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
      if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
      if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
      return "outros";
    };

    const estadoToSubgrupo = (estado: string | null): string => {
      if (!estado) return "outros";
      const e = estado.toUpperCase();
      if (e === "BAMBU") return "bambu";
      if (e === "FIBRA") return "fibra";
      if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
      if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
      return "outros";
    };

    // Collect unique values
    const grupoSet = new Set<string>();
    const subgrupoMap: Record<string, Set<string>> = {};
    const crmSegmentoSet = new Set<string>();

    for (const item of allItems) {
      const grupo = estadoToGrupo(item.estadoConfiguravel);
      if (grupo === "outros") continue; // Excluir itens "outros"
      const subgrupo = estadoToSubgrupo(item.estadoConfiguravel);
      grupoSet.add(grupo);
      if (!subgrupoMap[grupo]) subgrupoMap[grupo] = new Set();
      subgrupoMap[grupo].add(subgrupo);
      if (item.crmSegmento) crmSegmentoSet.add(item.crmSegmento.toUpperCase());
    }

    const grupoLabels: Record<string, string> = {
      importacao_revenda: "Prod. Importados (Revenda)",
      industrializacao: "Industrializados",
      importacao_mp: "Import. Mat\u00e9ria-Prima",
      outros: "Outros",
    };

    const subgrupoLabels: Record<string, string> = {
      bambu: "Bambu",
      fibra: "Fibra",
      madeira: "Madeira",
      madeira_importada: "Madeira Importada",
      outros: "Outros",
    };

    const grupos = Array.from(grupoSet)
      .filter(g => g !== "outros")
      .map(g => ({
        value: g,
        label: grupoLabels[g] || g,
      }));

    const subgrupos: Record<string, Array<{ value: string; label: string }>> = {};
    for (const [grupo, subs] of Object.entries(subgrupoMap)) {
      subgrupos[grupo] = Array.from(subs).map(s => ({
        value: s,
        label: subgrupoLabels[s] || s,
      }));
    }

    const crmSegmentos = Array.from(crmSegmentoSet).sort().map(s => ({
      value: s,
      label: s,
    }));

    return { grupos, subgrupos, crmSegmentos };
  }),

  /**
   * Get cumulative daily data for current month, last month, and best month
   * Used for the comparison line chart
   */
  getCumulativeComparison: publicProcedure
    .input(z.object({
      grupo: z.enum(["all", "importacao_revenda", "industrializacao", "importacao_mp"]).optional().default("all"),
      subgrupo: z.string().optional().default("all"),
      crmSegmento: z.string().optional().default("all"),
      // Legacy
      team: z.enum(["all", "industrializacao", "importacao"]).optional().default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Map estadoConfiguravel to grupo
      const estadoToGrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
        if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
        return "outros";
      };

      const estadoToSubgrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU") return "bambu";
        if (e === "FIBRA") return "fibra";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
        if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
        return "outros";
      };

      const teamToGrupo = (team: string): string => {
        if (team === "importacao") return "importacao_revenda";
        if (team === "industrializacao") return "industrializacao";
        return "all";
      };

      const rawItems = await db
        .select()
        .from(salesOrders);

      const effectiveGrupo = input.grupo !== "all" ? input.grupo : teamToGrupo(input.team || "all");

      // REGRA DE NEGÓCIO: Excluir pedidos em "Digitação"
      const isDigitacao = (nota: string | null) => {
        if (!nota) return false;
        const n = nota.toUpperCase();
        return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
      };

      // REGRA DE NEGÓCIO: Excluir itens "outros" (CANCELADO, AMOSTRA, BONIFICAÇÃO, GILSON, NULL)
      const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";

      let allItems = rawItems.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));
      if (effectiveGrupo !== "all") {
        allItems = allItems.filter(item => estadoToGrupo(item.estadoConfiguravel) === effectiveGrupo);
      }
      if (input.subgrupo !== "all") {
        allItems = allItems.filter(item => estadoToSubgrupo(item.estadoConfiguravel) === input.subgrupo);
      }
      if (input.crmSegmento !== "all") {
        allItems = allItems.filter(item => (item.crmSegmento || "").toUpperCase() === input.crmSegmento.toUpperCase());
      }

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
      .from(salesOrders)
      .where(
        sql`(${salesOrders.estadoNota} IS NULL OR UPPER(${salesOrders.estadoNota}) NOT IN ('DIGITAÇÃO', 'DIGITACAO'))`
      );

    if (!result[0] || result[0].totalCount === 0) {
      return { minDate: null, maxDate: null, totalCount: 0 };
    }

    return {
      minDate: result[0].minDate,
      maxDate: result[0].maxDate,
      totalCount: result[0].totalCount,
    };
  }),

  /**
   * Get orders list with items for the given date range
   * Groups sales_orders rows by pedido number, returns each order with its items
   */
  getOrders: publicProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      grupo: z.enum(["all", "importacao_revenda", "industrializacao", "importacao_mp"]).optional().default("all"),
      subgrupo: z.string().optional().default("all"),
      crmSegmento: z.string().optional().default("all"),
      // Legacy
      team: z.enum(["all", "industrializacao", "importacao"]).optional().default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Map estadoConfiguravel to grupo
      const estadoToGrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
        if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
        return "outros";
      };

      const estadoToSubgrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU") return "bambu";
        if (e === "FIBRA") return "fibra";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
        if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
        return "outros";
      };

      const teamToGrupo = (team: string): string => {
        if (team === "importacao") return "importacao_revenda";
        if (team === "industrializacao") return "industrializacao";
        return "all";
      };

      // Comparar apenas a parte YYYY-MM-DD da dataEmissao (evita bugs de timezone)
      const startDay = input.startDate.substring(0, 10);
      const endDay = input.endDate.substring(0, 10);
      const conditions = [
        sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) >= ${startDay}`,
        sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) <= ${endDay}`,
      ];

      const allItems = await db
        .select()
        .from(salesOrders)
        .where(and(...conditions));

      const effectiveGrupo = input.grupo !== "all" ? input.grupo : teamToGrupo(input.team || "all");

      // REGRA DE NEGÓCIO: Excluir pedidos em "Digitação"
      const isDigitacao = (nota: string | null) => {
        if (!nota) return false;
        const n = nota.toUpperCase();
        return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
      };

      // REGRA DE NEGÓCIO: Excluir itens "outros" (CANCELADO, AMOSTRA, BONIFICAÇÃO, GILSON, NULL)
      const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";

      let items = allItems.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));
      if (effectiveGrupo !== "all") {
        items = items.filter(item => estadoToGrupo(item.estadoConfiguravel) === effectiveGrupo);
      }
      if (input.subgrupo !== "all") {
        items = items.filter(item => estadoToSubgrupo(item.estadoConfiguravel) === input.subgrupo);
      }
      if (input.crmSegmento !== "all") {
        items = items.filter(item => (item.crmSegmento || "").toUpperCase() === input.crmSegmento.toUpperCase());
      }

      // Group by pedido
      const orderMap = new Map<string, {
        pedido: string;
        cliente: string;
        clienteApelido: string;
        uf: string;
        dataEmissao: string;
        estadoItem: string;
        valorTotal: number;
        condicaoPagamento: string | null;
        transportadora: string | null;
        razaoSocial: string | null;
        inscricaoEstadual: string | null;
        endereco: { logradouro: string; numero: string; complemento: string; bairro: string; cep: string; cidade: string; uf: string } | null;
        valorTotalPedido: number | null;
        representante: string | null;
        empresa: string | null;
        itens: Array<{
          descricao: string;
          quantidade: number;
          valorUnitario: number;
          valorTotal: number;
          estadoItem: string;
          dataEntregaItem: string | null;
          codigoGrupo: string;
          codigoItem: string | null;
          descricaoItem: string | null;
        }>;
      }>();

      for (const item of items) {
        const pedido = item.pedido || "S/N";
        if (!orderMap.has(pedido)) {
          const hasEndereco = item.enderecoLogradouro || item.enderecoCidade;
          orderMap.set(pedido, {
            pedido,
            cliente: item.cliente || "—",
            clienteApelido: item.clienteApelido || "",
            uf: item.uf || "",
            dataEmissao: item.dataEmissao || "",
            estadoItem: item.estadoItem || "",
            valorTotal: 0,
            condicaoPagamento: item.condicaoPagamento || null,
            transportadora: item.transportadora || null,
            razaoSocial: item.razaoSocial || null,
            inscricaoEstadual: item.inscricaoEstadual || null,
            endereco: hasEndereco ? {
              logradouro: item.enderecoLogradouro || "",
              numero: item.enderecoNumero || "",
              complemento: item.enderecoComplemento || "",
              bairro: item.enderecoBairro || "",
              cep: item.enderecoCep || "",
              cidade: item.enderecoCidade || "",
              uf: item.uf || "",
            } : null,
            valorTotalPedido: item.valorTotalPedido ? Number(item.valorTotalPedido) : null,
            representante: item.representante || null,
            empresa: item.empresa || null,
            itens: [],
          });
        }
        const order = orderMap.get(pedido)!;
        const val = Number(item.valorTotal || 0);
        order.valorTotal += val;
        // Track mixed status
        if (order.estadoItem !== item.estadoItem && order.itens.length > 0) {
          order.estadoItem = "Misto";
        }
        order.itens.push({
          descricao: item.descricao || "—",
          quantidade: Number(item.quantidade || 0),
          valorUnitario: Number(item.valorUnitario || 0),
          valorTotal: val,
          estadoItem: item.estadoItem || "",
          dataEntregaItem: item.dataEntrega || null,
          codigoGrupo: item.codigoGrupo || "",
          codigoItem: item.codigoItem || null,
          descricaoItem: item.descricaoItem || null,
        });
      }

      // Convert to array and round values
      const orders = Array.from(orderMap.values()).map(o => ({
        ...o,
        valorTotal: Math.round(o.valorTotal * 100) / 100,
        itens: o.itens.map(i => ({
          ...i,
          valorTotal: Math.round(i.valorTotal * 100) / 100,
          valorUnitario: Math.round(i.valorUnitario * 100) / 100,
        })),
      }));

      // Sort by date descending (most recent first)
      orders.sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao));

      return orders;
    }),

  /**
   * Get orders from previous months that are still not fully billed (A Faturar)
   * Returns orders grouped by month with items
   */
  getPreviousUnbilled: publicProcedure
    .input(z.object({
      currentPeriodStart: z.string(),
      grupo: z.enum(["all", "importacao_revenda", "industrializacao", "importacao_mp"]).optional().default("all"),
      subgrupo: z.string().optional().default("all"),
      crmSegmento: z.string().optional().default("all"),
      // Legacy
      team: z.enum(["all", "industrializacao", "importacao"]).optional().default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { months: [], orders: [] };

      // Map estadoConfiguravel to grupo
      const estadoToGrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
        if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
        return "outros";
      };

      const estadoToSubgrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU") return "bambu";
        if (e === "FIBRA") return "fibra";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
        if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
        return "outros";
      };

      const teamToGrupo = (team: string): string => {
        if (team === "importacao") return "importacao_revenda";
        if (team === "industrializacao") return "industrializacao";
        return "all";
      };

      // Get all items before the current period that are not Faturado
      const allItems = await db
        .select()
        .from(salesOrders)
        .where(and(
          sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) < ${input.currentPeriodStart.substring(0, 10)}`,
          sql`${salesOrders.estadoItem} != 'Faturado'`,
        ));

      const effectiveGrupo = input.grupo !== "all" ? input.grupo : teamToGrupo(input.team || "all");

      // REGRA DE NEGÓCIO: Excluir pedidos em "Digitação"
      const isDigitacao = (nota: string | null) => {
        if (!nota) return false;
        const n = nota.toUpperCase();
        return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
      };

      // REGRA DE NEGÓCIO: Excluir itens "outros" (CANCELADO, AMOSTRA, BONIFICAÇÃO, GILSON, NULL)
      const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";

      let items = allItems.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));
      if (effectiveGrupo !== "all") {
        items = items.filter(item => estadoToGrupo(item.estadoConfiguravel) === effectiveGrupo);
      }
      if (input.subgrupo !== "all") {
        items = items.filter(item => estadoToSubgrupo(item.estadoConfiguravel) === input.subgrupo);
      }
      if (input.crmSegmento !== "all") {
        items = items.filter(item => (item.crmSegmento || "").toUpperCase() === input.crmSegmento.toUpperCase());
      }

      // Extract distinct months
      const monthSet = new Set<string>();
      for (const item of items) {
        if (item.dataEmissao) {
          const month = item.dataEmissao.substring(0, 7); // YYYY-MM
          monthSet.add(month);
        }
      }
      const months = Array.from(monthSet).sort().reverse();

      // Group by pedido
      const orderMap = new Map<string, {
        pedido: string;
        cliente: string;
        clienteApelido: string;
        uf: string;
        dataEmissao: string;
        dataEntrega: string;
        month: string;
        estadoItem: string;
        valorTotal: number;
        itens: Array<{
          descricao: string;
          quantidade: number;
          valorUnitario: number;
          valorTotal: number;
          estadoItem: string;
          codigoItem: string | null;
          descricaoItem: string | null;
          dataEntregaItem: string | null;
        }>;
      }>();

      for (const item of items) {
        const pedido = item.pedido || "S/N";
        const month = (item.dataEmissao || "").substring(0, 7);
        const key = `${pedido}-${month}`;
        if (!orderMap.has(key)) {
          orderMap.set(key, {
            pedido,
            cliente: item.cliente || "\u2014",
            clienteApelido: item.clienteApelido || "",
            uf: item.uf || "",
            dataEmissao: item.dataEmissao || "",
            dataEntrega: item.dataEntrega || "",
            month,
            estadoItem: item.estadoItem || "",
            valorTotal: 0,
            itens: [],
          });
        }
        const order = orderMap.get(key)!;
        const val = Number(item.valorTotal || 0);
        order.valorTotal += val;
        if (order.estadoItem !== item.estadoItem && order.itens.length > 0) {
          order.estadoItem = "Misto";
        }
        order.itens.push({
          descricao: item.descricao || "\u2014",
          quantidade: Number(item.quantidade || 0),
          valorUnitario: Number(item.valorUnitario || 0),
          valorTotal: val,
          estadoItem: item.estadoItem || "",
          codigoItem: item.codigoItem || null,
          descricaoItem: item.descricaoItem || null,
          dataEntregaItem: item.dataEntrega || null,
        });
      }

      const orders = Array.from(orderMap.values()).map(o => ({
        ...o,
        valorTotal: Math.round(o.valorTotal * 100) / 100,
        itens: o.itens.map(i => ({
          ...i,
          valorTotal: Math.round(i.valorTotal * 100) / 100,
          valorUnitario: Math.round(i.valorUnitario * 100) / 100,
        })),
      }));

      orders.sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao));

      return { months, orders };
    }),

  /**
   * Get draft orders (Em Digitação) - informational only, not counted in KPIs
   */
  getDraftOrders: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { orders: [] };

      // Query order_items where estadoNota is "Digitação"
      const items = await db
        .select()
        .from(orderItems)
        .where(
          sql`${orderItems.estadoNota} IN ('Digitação', 'Digitacao')`
        );

      if (items.length === 0) return { orders: [] };

      // Get all pedido numbers from sales_orders to exclude duplicates
      // A pedido that exists in sales_orders (with status A faturar/Faturado) should NOT appear in Digitação
      const salesPedidos = await db
        .select({ pedido: salesOrders.pedido })
        .from(salesOrders);
      const salesPedidoSet = new Set(salesPedidos.map(p => p.pedido).filter(Boolean));

      // Filter out items whose numeroPedido already exists in sales_orders
      const filteredItems = items.filter(item => {
        const pedido = item.numeroPedido || "S/N";
        return !salesPedidoSet.has(pedido);
      });

      if (filteredItems.length === 0) return { orders: [] };

      // Group by numeroPedido
      const orderMap = new Map<string, {
        pedido: string;
        cliente: string;
        dataEmissao: string;
        valorTotal: number;
        itens: Array<{
          descricao: string;
          codigoItem: string;
          quantidade: number;
          valorUnitario: number;
          valorTotal: number;
        }>;
      }>();

      for (const item of filteredItems) {
        const pedido = item.numeroPedido || "S/N";
        if (!orderMap.has(pedido)) {
          orderMap.set(pedido, {
            pedido,
            cliente: item.cliente || "\u2014",
            dataEmissao: item.dataEmissao || "",
            valorTotal: 0,
            itens: [],
          });
        }
        const order = orderMap.get(pedido)!;
        const val = Number(item.valorTotal || 0);
        order.valorTotal += val;
        order.itens.push({
          descricao: item.descricao || "\u2014",
          codigoItem: item.codigoItem || "",
          quantidade: Number(item.quantidade || 0),
          valorUnitario: Number(item.valorUnitario || 0),
          valorTotal: val,
        });
      }

      const orders = Array.from(orderMap.values()).map(o => ({
        ...o,
        valorTotal: Math.round(o.valorTotal * 100) / 100,
        itens: o.itens.map(i => ({
          ...i,
          valorTotal: Math.round(i.valorTotal * 100) / 100,
          valorUnitario: Math.round(i.valorUnitario * 100) / 100,
        })),
      }));

      orders.sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao));

      return { orders };
    }),

  /**
   * Get ALL unbilled orders from last 90 days (combines current month + previous months)
   * Returns unified list with all customer information, grouped by month
   */
  getAllUnbilled: publicProcedure
    .input(z.object({
      grupo: z.enum(["all", "importacao_revenda", "industrializacao", "importacao_mp"]).optional().default("all"),
      subgrupo: z.string().optional().default("all"),
      crmSegmento: z.string().optional().default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { months: [], orders: [], totalValue: 0 };

      // Map estadoConfiguravel to grupo
      const estadoToGrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
        if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
        return "outros";
      };

      const estadoToSubgrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU") return "bambu";
        if (e === "FIBRA") return "fibra";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
        if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
        return "outros";
      };

      // Calculate 90 days ago
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const cutoffDate = ninetyDaysAgo.toISOString().substring(0, 10);

      // Get all non-Faturado items from last 90 days
      const allItems = await db
        .select()
        .from(salesOrders)
        .where(and(
          sql`${salesOrders.estadoItem} != 'Faturado'`,
          sql`${salesOrders.dataEmissao} >= ${cutoffDate}`,
        ));

      // REGRA DE NEGÓCIO: Excluir pedidos em "Digitação" e grupo "outros"
      const isDigitacao = (nota: string | null) => {
        if (!nota) return false;
        const n = nota.toUpperCase();
        return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
      };

      // REGRA DE NEGÓCIO: Excluir itens "outros" (CANCELADO, AMOSTRA, BONIFICAÇÃO, GILSON, NULL)
      const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";

      let items = allItems.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));

      // Apply filters
      if (input.grupo !== "all") {
        items = items.filter(item => estadoToGrupo(item.estadoConfiguravel) === input.grupo);
      }
      if (input.subgrupo !== "all") {
        items = items.filter(item => estadoToSubgrupo(item.estadoConfiguravel) === input.subgrupo);
      }
      if (input.crmSegmento !== "all") {
        items = items.filter(item => (item.crmSegmento || "").toUpperCase() === input.crmSegmento.toUpperCase());
      }

      // Extract distinct months
      const monthSet = new Set<string>();
      for (const item of items) {
        if (item.dataEmissao) {
          const month = item.dataEmissao.substring(0, 7); // YYYY-MM
          monthSet.add(month);
        }
      }
      const months = Array.from(monthSet).sort().reverse();

      // Group by pedido
      const orderMap = new Map<string, {
        pedido: string;
        cliente: string;
        clienteApelido: string;
        uf: string;
        dataEmissao: string;
        dataEntrega: string;
        month: string;
        estadoItem: string;
        valorTotal: number;
        condicaoPagamento: string | null;
        transportadora: string | null;
        razaoSocial: string | null;
        inscricaoEstadual: string | null;
        endereco: { logradouro: string; numero: string; complemento: string; bairro: string; cep: string; cidade: string; uf: string } | null;
        valorTotalPedido: number | null;
        representante: string | null;
        empresa: string | null;
        clienteTelefone: string | null;
        clienteEmail: string | null;
        observacoes: string | null;
        itens: Array<{
          descricao: string;
          quantidade: number;
          valorUnitario: number;
          valorTotal: number;
          estadoItem: string;
          dataEntregaItem: string | null;
          codigoGrupo: string;
          codigoItem: string | null;
          descricaoItem: string | null;
        }>;
      }>();

      for (const item of items) {
        const pedido = item.pedido || "S/N";
        const month = (item.dataEmissao || "").substring(0, 7);
        const key = `${pedido}-${month}`;
        if (!orderMap.has(key)) {
          const hasEndereco = item.enderecoLogradouro || item.enderecoCidade;
          orderMap.set(key, {
            pedido,
            cliente: item.cliente || "\u2014",
            clienteApelido: item.clienteApelido || "",
            uf: item.uf || "",
            dataEmissao: item.dataEmissao || "",
            dataEntrega: item.dataEntrega || "",
            month,
            estadoItem: item.estadoItem || "",
            valorTotal: 0,
            condicaoPagamento: item.condicaoPagamento || null,
            transportadora: item.transportadora || null,
            razaoSocial: item.razaoSocial || null,
            inscricaoEstadual: item.inscricaoEstadual || null,
            endereco: hasEndereco ? {
              logradouro: item.enderecoLogradouro || "",
              numero: item.enderecoNumero || "",
              complemento: item.enderecoComplemento || "",
              bairro: item.enderecoBairro || "",
              cep: item.enderecoCep || "",
              cidade: item.enderecoCidade || "",
              uf: item.uf || "",
            } : null,
            valorTotalPedido: item.valorTotalPedido ? Number(item.valorTotalPedido) : null,
            representante: item.representante || null,
            empresa: item.empresa || null,
            clienteTelefone: item.clienteTelefone || null,
            clienteEmail: item.clienteEmail || null,
            observacoes: item.observacoes || null,
            itens: [],
          });
        }
        const order = orderMap.get(key)!;
        const val = Number(item.valorTotal || 0);
        order.valorTotal += val;
        if (order.estadoItem !== item.estadoItem && order.itens.length > 0) {
          order.estadoItem = "Misto";
        }
        order.itens.push({
          descricao: item.descricao || "\u2014",
          quantidade: Number(item.quantidade || 0),
          valorUnitario: Number(item.valorUnitario || 0),
          valorTotal: val,
          estadoItem: item.estadoItem || "",
          dataEntregaItem: item.dataEntrega || null,
          codigoGrupo: item.codigoGrupo || "",
          codigoItem: item.codigoItem || null,
          descricaoItem: item.descricaoItem || null,
        });
      }

      const orders = Array.from(orderMap.values()).map(o => ({
        ...o,
        valorTotal: Math.round(o.valorTotal * 100) / 100,
        itens: o.itens.map(i => ({
          ...i,
          valorTotal: Math.round(i.valorTotal * 100) / 100,
          valorUnitario: Math.round(i.valorUnitario * 100) / 100,
        })),
      }));

      orders.sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao));

      const totalValue = orders.reduce((sum, o) => sum + o.valorTotal, 0);

      return { months, orders, totalValue: Math.round(totalValue * 100) / 100 };
    }),

  searchClients: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const qPrefix = `${input.query.toUpperCase()}%`;
      // Search ALL clients by PREFIX - typing "B" shows clients starting with "B"
      // No LIMIT - show all matching clients, the frontend handles scroll
      const rows = await db.execute(sql`
        SELECT cliente, clienteApelido, uf, crmSegmento
        FROM (
          SELECT cliente, clienteApelido, uf, crmSegmento
          FROM sales_orders
          WHERE (cliente LIKE ${qPrefix} OR clienteApelido LIKE ${qPrefix})
            AND cliente IS NOT NULL AND cliente != ''
          UNION
          SELECT cliente, NULL as clienteApelido, NULL as uf, NULL as crmSegmento
          FROM accounts_receivable
          WHERE cliente LIKE ${qPrefix}
            AND cliente IS NOT NULL AND cliente != ''
        ) all_clients
        GROUP BY cliente
        ORDER BY cliente
      `);
      // mysql2 returns [rows, fields] - extract rows
      const results = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
      return (results as any[]).map((r: any) => ({
        cliente: r.cliente || null,
        clienteApelido: r.clienteApelido || null,
        uf: r.uf || null,
        crmSegmento: r.crmSegmento || null,
      }));
    }),

  getClientSummary: publicProcedure
    .input(z.object({ clienteName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const cn = input.clienteName;

      const allOrders = await db.select().from(salesOrders)
        .where(eq(salesOrders.cliente, cn))
        .orderBy(desc(salesOrders.dataEmissao));

      const allReceivables = await db.select().from(accountsReceivable)
        .where(eq(accountsReceivable.cliente, cn))
        .orderBy(desc(accountsReceivable.vencimentoData));

      const clientOrderItems = await db.select().from(orderItems)
        .where(eq(orderItems.cliente, cn));

      const now = new Date();
      const nowStr = now.toISOString().slice(0, 10);

      const firstOrder = allOrders.length > 0 ? allOrders[allOrders.length - 1] : null;
      const clientInfo = {
        nome: cn,
        apelido: firstOrder?.clienteApelido || "",
        uf: firstOrder?.uf || "",
        crmSegmento: firstOrder?.crmSegmento || "",
        razaoSocial: firstOrder?.razaoSocial || "",
        telefone: firstOrder?.clienteTelefone || "",
        email: firstOrder?.clienteEmail || "",
        endereco: firstOrder ? [
          firstOrder.enderecoLogradouro,
          firstOrder.enderecoNumero,
          firstOrder.enderecoComplemento,
          firstOrder.enderecoBairro,
          firstOrder.enderecoCidade,
          firstOrder.uf,
          firstOrder.enderecoCep,
        ].filter(Boolean).join(", ") : "",
        clienteDesde: firstOrder?.dataEmissao || "",
      };

      const totalPedidos = new Set(allOrders.map(o => o.pedido)).size;
      const valorTotalPedidos = allOrders.reduce((s, o) => s + parseFloat(o.valorTotal || "0"), 0);
      const pedidosFaturados = allOrders.filter(o => o.estadoItem === "Faturado" || o.estadoItem === "Entrega futura");
      const valorFaturado = pedidosFaturados.reduce((s, o) => s + parseFloat(o.valorTotal || "0"), 0);
      const pedidosAFaturar = allOrders.filter(o => o.estadoItem === "A faturar" || o.estadoItem === "Aprovado");
      const valorAFaturar = pedidosAFaturar.reduce((s, o) => s + parseFloat(o.valorTotal || "0"), 0);
      const pedidosEmDigitacao = allOrders.filter(o => o.estadoNota === "Digita\u00e7\u00e3o" || o.estadoNota === "A aprovar");
      const valorEmDigitacao = pedidosEmDigitacao.reduce((s, o) => s + parseFloat(o.valorTotal || "0"), 0);

      const titulosEmitidos = allReceivables.filter(r => r.estado === "EMITIDO");
      const titulosRecebidos = allReceivables.filter(r => r.estado === "RECEBIDO");
      const valorEmAberto = titulosEmitidos.reduce((s, r) => {
        const original = parseFloat(r.valorOriginal || "0");
        const recebido = parseFloat(r.valorRecebidoLiquido || "0");
        return s + (original - recebido);
      }, 0);
      const valorRecebido = titulosRecebidos.reduce((s, r) => s + parseFloat(r.valorRecebidoLiquido || "0"), 0);

      const titulosVencidos = titulosEmitidos.filter(r => {
        if (!r.vencimentoData) return false;
        return r.vencimentoData < nowStr;
      });
      const valorVencido = titulosVencidos.reduce((s, r) => {
        const original = parseFloat(r.valorOriginal || "0");
        const recebido = parseFloat(r.valorRecebidoLiquido || "0");
        return s + (original - recebido);
      }, 0);
      const diasAtrasoList = titulosVencidos.map(r => {
        const venc = new Date(r.vencimentoData!);
        return Math.floor((now.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
      });
      const diasAtrasoMedio = diasAtrasoList.length > 0 ? Math.round(diasAtrasoList.reduce((a, b) => a + b, 0) / diasAtrasoList.length) : 0;
      const diasAtrasoMax = diasAtrasoList.length > 0 ? Math.max(...diasAtrasoList) : 0;

      const productMap = new Map<string, { descricao: string; codigo: string; qtd: number; valor: number; count: number }>();
      for (const o of allOrders) {
        const key = o.descricaoItem || o.descricao || "";
        const existing = productMap.get(key) || { descricao: key, codigo: o.codigoItem || "", qtd: 0, valor: 0, count: 0 };
        existing.qtd += parseFloat(o.quantidade || "0");
        existing.valor += parseFloat(o.valorTotal || "0");
        existing.count += 1;
        productMap.set(key, existing);
      }
      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 15);

      const monthlyMap = new Map<string, number>();
      for (const o of allOrders) {
        if (!o.dataEmissao) continue;
        const month = o.dataEmissao.slice(0, 7);
        monthlyMap.set(month, (monthlyMap.get(month) || 0) + parseFloat(o.valorTotal || "0"));
      }
      const monthlyEvolution = Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([month, valor]) => ({ month, valor: Math.round(valor * 100) / 100 }));

      const seenPedidos = new Set<string>();
      const recentOrders: Array<{ pedido: string; data: string; valor: number; status: string; itens: number }> = [];
      for (const o of allOrders) {
        if (!o.pedido || seenPedidos.has(o.pedido)) continue;
        seenPedidos.add(o.pedido);
        const ois = allOrders.filter((x: typeof allOrders[number]) => x.pedido === o.pedido);
        const valorPedido = ois.reduce((s, x) => s + parseFloat(x.valorTotal || "0"), 0);
        recentOrders.push({
          pedido: o.pedido,
          data: o.dataEmissao || "",
          valor: Math.round(valorPedido * 100) / 100,
          status: o.estadoNota || o.estadoItem || "",
          itens: ois.length,
        });
        if (recentOrders.length >= 20) break;
      }

      const recentReceivables = allReceivables.slice(0, 20).map((r: typeof allReceivables[number]) => ({
        documento: r.documentoVinculadoNumero || "",
        emissao: r.emissaoData || "",
        vencimento: r.vencimentoData || "",
        liquidacao: r.liquidacaoData || "",
        valorOriginal: Math.round(parseFloat(r.valorOriginal || "0") * 100) / 100,
        valorRecebido: Math.round(parseFloat(r.valorRecebidoLiquido || "0") * 100) / 100,
        estado: r.estado,
        parcela: r.parcela,
        totalParcelas: r.parcelasQuantidadeTotal,
        referente: r.referenteA || "",
      }));

      const pendingItems = clientOrderItems.filter((oi: typeof clientOrderItems[number]) => {
        const st = oi.estadoItem;
        return st === "A faturar" || st === "Entrega futura" || st === "Aprovado";
      }).map((oi: typeof clientOrderItems[number]) => ({
        descricao: oi.descricao || "",
        codigo: oi.codigoItem || "",
        quantidade: parseFloat(oi.quantidade || "0"),
        pedido: oi.numeroPedido || "",
      }));

      return {
        clientInfo,
        orders: {
          totalPedidos,
          valorTotalPedidos: Math.round(valorTotalPedidos * 100) / 100,
          valorFaturado: Math.round(valorFaturado * 100) / 100,
          valorAFaturar: Math.round(valorAFaturar * 100) / 100,
          valorEmDigitacao: Math.round(valorEmDigitacao * 100) / 100,
          pedidosFaturados: pedidosFaturados.length,
          pedidosAFaturar: pedidosAFaturar.length,
          pedidosEmDigitacao: pedidosEmDigitacao.length,
        },
        receivables: {
          totalTitulos: allReceivables.length,
          titulosEmAberto: titulosEmitidos.length,
          titulosRecebidos: titulosRecebidos.length,
          valorEmAberto: Math.round(valorEmAberto * 100) / 100,
          valorRecebido: Math.round(valorRecebido * 100) / 100,
        },
        overdue: {
          titulosVencidos: titulosVencidos.length,
          valorVencido: Math.round(valorVencido * 100) / 100,
          diasAtrasoMedio,
          diasAtrasoMax,
        },
        topProducts,
        monthlyEvolution,
        recentOrders,
        recentReceivables,
        pendingItems,
      };
    }),
});
