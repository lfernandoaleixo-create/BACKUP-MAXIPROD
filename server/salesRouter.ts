import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "./db";
import { storagePut } from "./storage";
import { salesOrders, orderItems, accountsReceivable, orderCancellations, sellerAdmissions, productVariants, salesManagers, fieldSellers, sellerPermissions, sellerProductVisibility, catalogs, sellerCatalogVisibility, stockReservations, vendorClients, cobrancaPlanilha, priceTables, priceTableItems, dashboardData, productClassification, appSettings, sellerMonthlyTargets, commissionMatrix } from "../drizzle/schema";
import { sql, and, gte, lte, like, or, eq, desc, inArray } from "drizzle-orm";
import { gql } from "./maxiprodGraphQL";

// REGRA JOHNSON: Para clientes Johnson (exportação + Brasil), excluir frete do valor total do pedido
// O frete não conta como venda nem para comissão de vendedores
const isJohnsonClient = (cliente: string | null): boolean => {
  if (!cliente) return false;
  const c = cliente.toUpperCase();
  return c.includes('JOHNSON') || c.includes('S C JOHNSON') || c.includes('SC JOHNSON') || c.includes('S. C. JOHNSON') || c.includes('CERAS JOHNSON');
};

// Cache para representantes do Maxiprod (5 minutos)
const REPRESENTANTES_CACHE_TTL = 5 * 60 * 1000;
let representantesCache: any = null;
let representantesCacheTimestamp = 0;

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
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
        return "outros";
      };

      // Map estadoConfiguravel to subgrupo
      const estadoToSubgrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU") return "bambu";
        if (e === "FIBRA") return "fibra";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
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

      // REGRA DE NEGÓCIO: Excluir itens "outros" (AMOSTRA, BONIFICAÇÃO, GILSON, NULL)
      const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";
      // CANCELADO detectado pelo estadoNota (estado do pedido no Maxiprod), NÃO pelo estadoConfiguravel
      // REGRA DE NEGÓCIO (Fernando): Cancelados ENTRAM no valor total de vendas (para valorizar o vendedor)
      // O botão vermelho mostra os cancelados do PERÍODO DE CANCELAMENTO (não emissão) para cálculo de comissão
      const isCancelado = (nota: string | null) => {
        if (!nota) return false;
        return nota.toUpperCase() === "CANCELADO";
      };

      // NOVA REGRA: Cancelados INCLUÍDOS no total de vendas (não são mais excluídos)
      // Apenas Digitação e Outros são excluídos
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
          totalCancelado: 0,
          canceledOrders: [],
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

      // Compute analytics usando valorTotalPedido (inclui descontos e frete)
      // REGRA: Cancelados INCLUÍDOS no total de vendas (valorizar vendedor)
      const uniqueOrders = new Set(items.map((i) => i.pedido).filter(Boolean));
      const uniqueClients = new Set(items.map((i) => i.cliente).filter(Boolean));
      // Total por pedido único usando valorTotalPedido quando disponível
      // REGRA JOHNSON aplicada: subtrair frete do valorTotalPedido para clientes Johnson
      const pedidoMap = new Map<string, { valorTotalPedido: number; somaItensBruto: number; somaFaturadoBruto: number; somaAFaturarBruto: number }>();
      for (const item of items) {
        const pedido = item.pedido || 'sem-pedido';
        const itemVal = Number(item.valorTotal || 0);
        if (!pedidoMap.has(pedido)) {
          let vtp = item.valorTotalPedido ? Number(item.valorTotalPedido) : 0;
          // REGRA JOHNSON: subtrair frete do valorTotalPedido
          if (isJohnsonClient(item.cliente) && item.freteValor && Number(item.freteValor) > 0) {
            vtp = vtp - Number(item.freteValor);
          }
          pedidoMap.set(pedido, {
            valorTotalPedido: vtp,
            somaItensBruto: itemVal,
            somaFaturadoBruto: (item.estadoItem === "Faturado") ? itemVal : 0,
            somaAFaturarBruto: (item.estadoItem === "A faturar") ? itemVal : 0,
          });
        } else {
          const p = pedidoMap.get(pedido)!;
          if (!p.valorTotalPedido && item.valorTotalPedido) {
            let vtp = Number(item.valorTotalPedido);
            // REGRA JOHNSON: subtrair frete do valorTotalPedido
            if (isJohnsonClient(item.cliente) && item.freteValor && Number(item.freteValor) > 0) {
              vtp = vtp - Number(item.freteValor);
            }
            p.valorTotalPedido = vtp;
          }
          p.somaItensBruto += itemVal;
          if (item.estadoItem === "Faturado") p.somaFaturadoBruto += itemVal;
          if (item.estadoItem === "A faturar") p.somaAFaturarBruto += itemVal;
        }
      }

      // NOVA REGRA: Buscar cancelados da tabela order_cancellations filtrando por dataCancelamento no período
      // O cancelado aparece no MÊS EM QUE FOI CANCELADO (não no mês de emissão)
      // Isso permite calcular comissão correta: Total Vendas - Cancelados do Período = Base Comissão
      let canceledOrders: { pedido: string; cliente: string; valor: number; dataEmissao: string; dataCancelamento: string; representante: string }[] = [];
      let totalCancelado = 0;
      try {
        const cancelRows = await db.select()
          .from(orderCancellations)
          .where(
            and(
              sql`SUBSTRING(${orderCancellations.dataCancelamento}, 1, 10) >= ${startDay}`,
              sql`SUBSTRING(${orderCancellations.dataCancelamento}, 1, 10) <= ${endDay}`,
            )
          );
        canceledOrders = cancelRows.map(r => ({
          pedido: r.pedido,
          cliente: r.clienteApelido || r.cliente || "—",
          valor: Math.round(Number(r.valorTotalPedido || 0) * 100) / 100,
          dataEmissao: r.dataEmissao || "",
          dataCancelamento: r.dataCancelamento || "",
          representante: r.representante || "",
        })).sort((a, b) => b.valor - a.valor);
        totalCancelado = canceledOrders.reduce((sum, o) => sum + o.valor, 0);
      } catch (e) {
        // Table might not exist yet in some environments
        console.error('[Sales] Error fetching order_cancellations:', e);
      }

      let totalValue = 0;
      let totalFaturado = 0;
      let totalAFaturar = 0;
      Array.from(pedidoMap.values()).forEach(p => {
        // Usar valorTotalPedido se disponível, senão soma bruta dos itens
        const pedidoTotal = p.valorTotalPedido || p.somaItensBruto;
        totalValue += pedidoTotal;

        if (p.somaItensBruto > 0 && p.valorTotalPedido) {
          // Distribuir proporcionalmente o valor do pedido entre faturado e a faturar
          const faturadoProporcional = (p.somaFaturadoBruto / p.somaItensBruto) * pedidoTotal;
          const aFaturarProporcional = (p.somaAFaturarBruto / p.somaItensBruto) * pedidoTotal;
          totalFaturado += faturadoProporcional;
          totalAFaturar += aFaturarProporcional;
        } else {
          // Sem valorTotalPedido, usar valores brutos
          totalFaturado += p.somaFaturadoBruto;
          totalAFaturar += p.somaAFaturarBruto;
        }
      });
      // Arredondar para evitar imprecisão de ponto flutuante
      totalValue = Math.round(totalValue * 100) / 100;
      totalFaturado = Math.round(totalFaturado * 100) / 100;
      // Garantir que A Faturar = Total - Faturado (cancelados já excluídos)
      totalAFaturar = Math.round((totalValue - totalFaturado) * 100) / 100;

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

      // By day - usar valorTotalPedido (distribuído proporcionalmente) para bater com o card totalValue
      // Primeiro, agrupar itens por pedido+dia para calcular proporção
      const pedidoDayMap = new Map<string, { day: string; pedido: string; cliente: string; somaItens: number; valorTotalPedido: number }>();
      for (const item of items) {
        if (!item.dataEmissao) continue;
        const dayKey = item.dataEmissao.substring(0, 10);
        const pedido = item.pedido || 'sem-pedido';
        const key = `${pedido}__${dayKey}`;
        const itemVal = Number(item.valorTotal || 0);
        if (!pedidoDayMap.has(key)) {
          pedidoDayMap.set(key, {
            day: dayKey,
            pedido,
            cliente: item.clienteApelido || item.cliente || "—",
            somaItens: itemVal,
            valorTotalPedido: item.valorTotalPedido ? Number(item.valorTotalPedido) : 0,
          });
        } else {
          const p = pedidoDayMap.get(key)!;
          p.somaItens += itemVal;
          if (!p.valorTotalPedido && item.valorTotalPedido) {
            p.valorTotalPedido = Number(item.valorTotalPedido);
          }
        }
      }

      // Para cada pedido, calcular o valor real (valorTotalPedido ou soma bruta)
      // e distribuir proporcionalmente entre os dias onde esse pedido aparece
      const pedidoTotalReal = new Map<string, { valorReal: number; somaTotal: number }>();
      for (const entry of Array.from(pedidoDayMap.values())) {
        if (!pedidoTotalReal.has(entry.pedido)) {
          const pm = pedidoMap.get(entry.pedido);
          const valorReal = pm ? (pm.valorTotalPedido || pm.somaItensBruto) : entry.somaItens;
          pedidoTotalReal.set(entry.pedido, { valorReal, somaTotal: pm ? pm.somaItensBruto : entry.somaItens });
        }
      }

      const dayMap = new Map<string, { value: number; orders: Set<string>; items: number; orderDetails: Map<string, { cliente: string; valor: number }> }>();
      for (const item of items) {
        if (!item.dataEmissao) continue;
        const dayKey = item.dataEmissao.substring(0, 10);
        if (!dayMap.has(dayKey)) dayMap.set(dayKey, { value: 0, orders: new Set(), items: 0, orderDetails: new Map() });
        const d = dayMap.get(dayKey)!;
        const pedido = item.pedido || 'sem-pedido';
        const itemVal = Number(item.valorTotal || 0);
        const ptr = pedidoTotalReal.get(pedido);
        // Calcular valor proporcional do item usando valorTotalPedido
        const valorProporcional = (ptr && ptr.somaTotal > 0) ? (itemVal / ptr.somaTotal) * ptr.valorReal : itemVal;
        d.value += valorProporcional;
        if (item.pedido) {
          d.orders.add(item.pedido);
          const existing = d.orderDetails.get(item.pedido);
          if (existing) {
            existing.valor += valorProporcional;
          } else {
            d.orderDetails.set(item.pedido, { cliente: item.clienteApelido || item.cliente || "—", valor: valorProporcional });
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
        importacao_mp: "Import. Matéria-Prima",
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
        totalCancelado: Math.round(totalCancelado * 100) / 100,
        canceledOrders,
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
      if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
      return "outros";
    };

    const estadoToSubgrupo = (estado: string | null): string => {
      if (!estado) return "outros";
      const e = estado.toUpperCase();
      if (e === "BAMBU") return "bambu";
      if (e === "FIBRA") return "fibra";
      if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
      if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
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
      importacao_mp: "Import. Matéria-Prima",
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
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
        return "outros";
      };

      const estadoToSubgrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU") return "bambu";
        if (e === "FIBRA") return "fibra";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
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

      // REGRA DE NEGÓCIO: Excluir itens "outros" (AMOSTRA, BONIFICAÇÃO, GILSON, NULL)
      const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";
      // Cancelados excluídos de todos os cálculos (apenas informativos)
      const isCancelado = (nota: string | null) => {
        if (!nota) return false;
        return nota.toUpperCase() === "CANCELADO";
      };

      // REGRA: Cancelados INCLUÍDOS no total (valorizar vendedor). Apenas Digitação e Outros excluídos.
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
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
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
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
        return "outros";
      };

      const estadoToSubgrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU") return "bambu";
        if (e === "FIBRA") return "fibra";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
        return "outros";
      };

      const teamToGrupo = (team: string): string => {
        if (team === "importacao") return "importacao_revenda";
        if (team === "industrializacao") return "industrializacao";
        return "all";
      };

      // Comparar apenas a parte YYYY-MM-DD da dataEmissao (evita bugs de timezone)
      // REGRA: Usar apenas dataEmissao para filtrar pedidos no período (consistente com card KPI)
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

       // REGRA DE NEGÓCIO: Excluir itens "outros" (AMOSTRA, BONIFICAÇÃO, GILSON, NULL)
      const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";
      const isCancelado = (nota: string | null) => {
        if (!nota) return false;
        return nota.toUpperCase() === "CANCELADO";
      };
      let items = allItems.filter(item => !isDigitacao(item.estadoNota) && !isCancelado(item.estadoNota) && !isOutros(item.estadoConfiguravel));
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
            valorTotalPedido: (() => {
              if (!item.valorTotalPedido) return null;
              let vtp = Number(item.valorTotalPedido);
              // REGRA JOHNSON: subtrair frete do valorTotalPedido
              if (isJohnsonClient(item.cliente) && item.freteValor && Number(item.freteValor) > 0) {
                vtp = vtp - Number(item.freteValor);
              }
              return vtp;
            })(),
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

      // Use valorTotalPedido when available (includes discounts/freight adjustments)
      // This matches the analytics card calculation (proportional distribution)
      const orders = Array.from(orderMap.values()).map(o => {
        // If valorTotalPedido exists and is different from sum of items, use it
        const adjustedTotal = o.valorTotalPedido && o.valorTotalPedido > 0 ? o.valorTotalPedido : o.valorTotal;
        return {
          ...o,
          valorTotal: Math.round(adjustedTotal * 100) / 100,
          itens: o.itens.map(i => ({
            ...i,
            valorTotal: Math.round(i.valorTotal * 100) / 100,
            valorUnitario: Math.round(i.valorUnitario * 100) / 100,
          })),
        };
      });

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
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
        return "outros";
      };

      const estadoToSubgrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU") return "bambu";
        if (e === "FIBRA") return "fibra";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
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

      // REGRA DE NEGÓCIO: Excluir itens "outros" (AMOSTRA, BONIFICAÇÃO, GILSON, NULL)
      const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";
      const isCancelado = (nota: string | null) => {
        if (!nota) return false;
        return nota.toUpperCase() === "CANCELADO";
      };
      let items = allItems.filter(item => !isDigitacao(item.estadoNota) && !isCancelado(item.estadoNota) && !isOutros(item.estadoConfiguravel));
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
            cliente: item.cliente || "—",
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
          descricao: item.descricao || "—",
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
            cliente: item.cliente || "—",
            dataEmissao: item.dataEmissao || "",
            valorTotal: 0,
            itens: [],
          });
        }
        const order = orderMap.get(pedido)!;
        const val = Number(item.valorTotal || 0);
        order.valorTotal += val;
        order.itens.push({
          descricao: item.descricao || "—",
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
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
        return "outros";
      };

      const estadoToSubgrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU") return "bambu";
        if (e === "FIBRA") return "fibra";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
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

       // REGRA DE NEGÓCIO: Excluir itens "outros" (AMOSTRA, BONIFICAÇÃO, GILSON, NULL)
      const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";
      const isCancelado = (nota: string | null) => {
        if (!nota) return false;
        return nota.toUpperCase() === "CANCELADO";
      };
      let items = allItems.filter(item => !isDigitacao(item.estadoNota) && !isCancelado(item.estadoNota) && !isOutros(item.estadoConfiguravel));
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
            cliente: item.cliente || "—",
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
    .input(z.object({
      clienteName: z.string(),
      tiposFilter: z.array(z.string()).optional(), // kept for backward compat, filtering done on frontend
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const cn = input.clienteName;
      // Filtragem de tipos é feita no frontend para ser instantânea
      // Backend retorna TODOS os tipos do banco local

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

      // Agrupar itens por número de pedido para contagem correta
      const pedidoGroupMap = new Map<string, { pedido: string; itens: typeof allOrders; valorTotal: number; estadoNotaPedido: string; dataEmissao: string; condicaoPagamento: string }>();
      for (const o of allOrders) {
        if (!o.pedido) continue;
        const existing = pedidoGroupMap.get(o.pedido);
        if (existing) {
          existing.itens.push(o);
          // NÃO somar valorTotal dos itens - usar valorTotalPedido que é o valor real do pedido
        } else {
          pedidoGroupMap.set(o.pedido, {
            pedido: o.pedido,
            itens: [o],
            valorTotal: parseFloat(o.valorTotalPedido || o.valorTotal || "0"),
            estadoNotaPedido: o.estadoNota || o.estadoItem || "",
            dataEmissao: o.dataEmissao || "",
            condicaoPagamento: o.condicaoPagamento || "",
          });
        }
      }
      const pedidoGroups = Array.from(pedidoGroupMap.values());
      const totalPedidos = pedidoGroups.length;
      const valorTotalPedidos = pedidoGroups.reduce((s, p) => s + p.valorTotal, 0);

      // Contar pedidos ÚNICOS por status (usando estadoNotaPedido do pedido)
      const pedidosFaturadosArr = pedidoGroups.filter(p => p.estadoNotaPedido === "Faturado");
      const valorFaturado = pedidosFaturadosArr.reduce((s, p) => s + p.valorTotal, 0);
      const pedidosAFaturarArr = pedidoGroups.filter(p => p.estadoNotaPedido === "A faturar" || p.estadoNotaPedido === "Aprovado");
      const valorAFaturar = pedidosAFaturarArr.reduce((s, p) => s + p.valorTotal, 0);
      const pedidosAprovarArr = pedidoGroups.filter(p => p.estadoNotaPedido === "A aprovar");
      const valorAprovar = pedidosAprovarArr.reduce((s, p) => s + p.valorTotal, 0);
      const pedidosEmDigitacaoArr = pedidoGroups.filter(p => p.estadoNotaPedido === "Digitação" || p.estadoNotaPedido === "Em digitação");
      const valorEmDigitacao = pedidosEmDigitacaoArr.reduce((s, p) => s + p.valorTotal, 0);

      // Deduplicar títulos: o Maxiprod cria múltiplos registros para o mesmo título
      // (mesmo doc + parcela + valor + vencimento) com maxiprodIds diferentes.
      // Manter apenas o registro com MAIOR maxiprodId (mais recente = estado atual).
      const dedupCountMap = new Map<string, typeof allReceivables[number]>();
      for (const r of allReceivables) {
        const key = `${r.documentoVinculadoNumero || ''}|${r.parcela || 'null'}|${r.valorOriginal || ''}|${r.vencimentoData || ''}`;
        const existing = dedupCountMap.get(key);
        if (!existing || r.maxiprodId > existing.maxiprodId) {
          dedupCountMap.set(key, r);
        }
      }
      let dedupForCountsRaw = Array.from(dedupCountMap.values());
      // KPIs de títulos serão calculados após buscar NFs (para excluir títulos duplicados)
      // Placeholder - serão preenchidos abaixo
      let titulosEmitidos: typeof allReceivables = [];
      let titulosRecebidos: typeof allReceivables = [];
      let valorEmAberto = 0;
      let valorRecebido = 0;
      let docsEmitidos = new Set<string>();
      let docsRecebidos = new Set<string>();
      let docsTotal = new Set<string>();
      let titulosVencidos: typeof allReceivables = [];
      let valorVencido = 0;
      let diasAtrasoMedio = 0;
      let diasAtrasoMax = 0;

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

      // Deduplicar títulos por (doc + parcela + valor + vencimento), mantendo maior maxiprodId
      const dedupMap = new Map<string, typeof allReceivables[number]>();
      for (const r of allReceivables) {
        const key = `${r.documentoVinculadoNumero || ''}|${r.parcela || 'null'}|${r.valorOriginal || ''}|${r.vencimentoData || ''}`;
        const existing = dedupMap.get(key);
        if (!existing || r.maxiprodId > existing.maxiprodId) {
          dedupMap.set(key, r);
        }
      }
      let deduplicatedReceivables = Array.from(dedupMap.values())
        .filter(r => r.tipo !== "TITULO_PROPOSTA_DE_VENDA"); // Propostas NUNCA são dívida real

      // ===== VINCULAR NF AO PEDIDO VIA GRAPHQL DO MAXIPROD =====
      // Buscar TODAS as NFs de saída e mapear NF→Pedido via itensDasNotasFiscais
      const allPedidoNumbers = new Set(pedidoGroups.map(p => p.pedido));
      // nfNumToPedidoNum: mapa de número da NF → número do pedido de origem
      const nfNumToPedidoNum = new Map<string, string>();
      // pedidoToNfNums: mapa de número do pedido → números das NFs vinculadas
      const pedidoToNf = new Map<string, string[]>();
      // Títulos buscados ao vivo do Maxiprod (para pedidos faturados sem títulos locais)
      const liveTitulos: Array<typeof allReceivables[number]> = [];
      
      try {
        // ===== BUSCA AO VIVO: Para pedidos faturados sem títulos locais =====
        // Identificar pedidos faturados
        const pedidosFaturados = pedidoGroups.filter(p => p.estadoNotaPedido === "Faturado");
        // Verificar quais pedidos faturados NÃO têm títulos locais
        const localDocNums = new Set(deduplicatedReceivables.map(r => r.documentoVinculadoNumero).filter(Boolean));
        const pedidosSemTitulos = pedidosFaturados.filter(p => !localDocNums.has(p.pedido));
        
        if (pedidosSemTitulos.length > 0) {
          // Para cada pedido faturado sem títulos, buscar via Maxiprod GraphQL:
          // 1. Buscar itens do pedido de venda pelo número
          // 2. Encontrar NFs vinculadas
          // 3. Buscar títulos (contaAReceber) vinculados à NF
          for (const pedido of pedidosSemTitulos) {
            try {
              // Buscar o pedido de venda pelo número para pegar o ID
              const pedidoData = await gql<any>(`{
                pedidosDeVenda(skip: 0, take: 5, where: { numero: { eq: "${pedido.pedido}" } }) {
                  items { id numero }
                }
              }`);
              if (!pedidoData?.pedidosDeVenda?.items?.length) continue;
              const pedidoId = pedidoData.pedidosDeVenda.items[0].id;
              
              // Buscar itens do pedido
              const pedidoItemsData = await gql<any>(`{
                itensDosPedidosDeVendas(skip: 0, take: 100, where: { pedidoDeVendaId: { eq: ${pedidoId} } }) {
                  items { id }
                }
              }`);
              if (!pedidoItemsData?.itensDosPedidosDeVendas?.items?.length) continue;
              const itemIds = pedidoItemsData.itensDosPedidosDeVendas.items.map((i: any) => i.id);
              
              // Buscar itens de NF vinculados a esses itens do pedido
              const nfItemsData = await gql<any>(`{
                itensDasNotasFiscais(skip: 0, take: 200, where: { itemDoPedidoDeVendaId: { in: [${itemIds.join(',')}] } }) {
                  items { notaFiscalId itemDoPedidoDeVendaId }
                }
              }`);
              if (!nfItemsData?.itensDasNotasFiscais?.items?.length) continue;
              const nfIds = Array.from(new Set(nfItemsData.itensDasNotasFiscais.items.map((i: any) => i.notaFiscalId)));
              
              // Buscar detalhes das NFs
              for (const nfId of nfIds) {
                const nfDetail = await gql<any>(`{
                  notasFiscais(skip: 0, take: 1, where: { id: { eq: ${nfId} } }) {
                    items { id numero estado entradaOuSaida }
                  }
                }`);
                if (!nfDetail?.notasFiscais?.items?.length) continue;
                const nf = nfDetail.notasFiscais.items[0];
                if (nf.entradaOuSaida !== "SAIDA" || nf.estado !== "EMITIDA") continue;
                
                const nfNumStr = String(nf.numero);
                nfNumToPedidoNum.set(nfNumStr, pedido.pedido);
                const existing = pedidoToNf.get(pedido.pedido) || [];
                if (!existing.includes(nfNumStr)) existing.push(nfNumStr);
                pedidoToNf.set(pedido.pedido, existing);
                
                // Buscar títulos (contaAReceber) vinculados a esta NF
                // Buscar TODOS os estados (EMITIDO e RECEBIDO)
                const titulosData = await gql<any>(`{
                  contaAReceber(skip: 0, take: 100, where: { documentoVinculadoNumero: { eq: "${nfNumStr}" } }) {
                    totalCount
                    items {
                      id estado tipo valorOriginal valorLiquido valorRetido
                      valorDeDesconto valorDeAcrescimo valorRecebidoLiquido
                      emissaoData vencimentoData vencimentoOriginalData liquidacaoData
                      referenteA parcela parcelasQuantidadeTotal observacoes
                      documentoVinculadoNumero bloqueado
                      cliente { nomeFantasia razaoSocial }
                      formaDeCobranca { banco { descricao } }
                    }
                  }
                }`);
                if (titulosData?.contaAReceber?.items?.length) {
                  for (const t of titulosData.contaAReceber.items) {
                    liveTitulos.push({
                      id: 0, // placeholder
                      maxiprodId: t.id,
                      estado: t.estado || "",
                      tipo: t.tipo || null,
                      valorOriginal: t.valorOriginal != null ? String(t.valorOriginal) : null,
                      valorLiquido: t.valorLiquido != null ? String(t.valorLiquido) : null,
                      valorRetido: t.valorRetido != null ? String(t.valorRetido) : null,
                      valorDeDesconto: t.valorDeDesconto != null ? String(t.valorDeDesconto) : null,
                      valorDeAcrescimo: t.valorDeAcrescimo != null ? String(t.valorDeAcrescimo) : null,
                      valorRecebidoLiquido: t.valorRecebidoLiquido != null ? String(t.valorRecebidoLiquido) : null,
                      emissaoData: t.emissaoData || null,
                      vencimentoData: t.vencimentoData || null,
                      vencimentoOriginalData: t.vencimentoOriginalData || null,
                      liquidacaoData: t.liquidacaoData || null,
                      referenteA: t.referenteA || null,
                      parcela: t.parcela || null,
                      parcelasQuantidadeTotal: t.parcelasQuantidadeTotal || null,
                      observacoes: t.observacoes || null,
                      documentoVinculadoNumero: t.documentoVinculadoNumero || null,
                      bloqueado: t.bloqueado || false,
                      cliente: t.cliente?.razaoSocial || t.cliente?.nomeFantasia || cn,
                      centroDeCustosId: null,
                      contaId: null,
                      empresaId: null,
                      empresaNome: null,
                      collectedAt: new Date(),
                      bancoNome: t.formaDeCobranca?.banco?.descricao || null,
                      contaNumero: null,
                      agencia: null,
                      formaCobranca: null,
                      formaCobrancaId: null,
                      anotacoes: null,
                    } as any);
                  }
                }
              }
            } catch (pedErr: any) {
              console.error(`[getClientSummary] Error fetching live titles for pedido ${pedido.pedido}:`, pedErr.message);
            }
          }
          
          // Adicionar títulos ao vivo aos deduplicatedReceivables
          if (liveTitulos.length > 0) {
            // Deduplicar títulos ao vivo
            for (const lt of liveTitulos) {
              const key = `${lt.documentoVinculadoNumero || ''}|${lt.parcela || 'null'}|${lt.valorOriginal || ''}|${lt.vencimentoData || ''}`;
              const existing = dedupMap.get(key);
              if (!existing || lt.maxiprodId > existing.maxiprodId) {
                dedupMap.set(key, lt);
              }
            }
            // Rebuild deduplicatedReceivables with live data included
            deduplicatedReceivables.length = 0;
            deduplicatedReceivables.push(...Array.from(dedupMap.values()));
            // Also update dedupForCountsRaw
            dedupCountMap.clear();
            for (const r of deduplicatedReceivables) {
              const key = `${r.documentoVinculadoNumero || ''}|${r.parcela || 'null'}|${r.valorOriginal || ''}|${r.vencimentoData || ''}`;
              const existing = dedupCountMap.get(key);
              if (!existing || r.maxiprodId > existing.maxiprodId) {
                dedupCountMap.set(key, r);
              }
            }
            dedupForCountsRaw.length = 0;
            dedupForCountsRaw.push(...Array.from(dedupCountMap.values()));
          }
        }
        
        // Coletar todos os documentoVinculadoNumero dos títulos deste cliente (agora inclui live)
        const allDocNums = Array.from(new Set(deduplicatedReceivables.map(r => r.documentoVinculadoNumero).filter(Boolean))) as string[];
        
        // Buscar NFs de saída do Maxiprod (paginado) - apenas se ainda não temos mapeamento completo
        // Pular se já temos todos os pedidos faturados mapeados via busca ao vivo
        const pedidosFaturadosAll = pedidoGroups.filter(p => p.estadoNotaPedido === "Faturado");
        const pedidosJaMapeados = new Set(Array.from(pedidoToNf.keys()));
        const pedidosFaltando = pedidosFaturadosAll.filter(p => !pedidosJaMapeados.has(p.pedido));
        
        let allNfs: any[] = [];
        if (allDocNums.length > 0 && pedidosFaltando.length > 0) {
          let nfSkip = 0;
          while (true) {
            const nfData = await gql<any>(`{
              notasFiscais(skip: ${nfSkip}, take: 200, where: { entradaOuSaida: { eq: SAIDA }, estado: { eq: EMITIDA } }) {
                totalCount
                items { id numero }
              }
            }`);
            if (!nfData?.notasFiscais?.items?.length) break;
            allNfs.push(...nfData.notasFiscais.items);
            nfSkip += 200;
            if (nfSkip >= nfData.notasFiscais.totalCount) break;
          }
        }
        
        // Filtrar NFs cujo número bate com algum documentoVinculadoNumero dos títulos do cliente
        const relevantNfs = allNfs.filter(nf => allDocNums.includes(String(nf.numero)));
        
        if (relevantNfs.length > 0) {
          // Buscar itens de cada NF para encontrar o pedido vinculado
          const nfIds = relevantNfs.map(nf => nf.id);
          for (let i = 0; i < nfIds.length; i += 100) {
            const batch = nfIds.slice(i, i + 100);
            const idsStr = batch.join(',');
            const nfItemsData = await gql<any>(`{
              itensDasNotasFiscais(skip: 0, take: 500, where: { notaFiscalId: { in: [${idsStr}] } }) {
                totalCount
                items { notaFiscalId itemDoPedidoDeVendaId }
              }
            }`);
            
            if (nfItemsData?.itensDasNotasFiscais?.items) {
              const nfToItemIds = new Map<number, number[]>();
              for (const nfItem of nfItemsData.itensDasNotasFiscais.items) {
                if (nfItem.itemDoPedidoDeVendaId) {
                  if (!nfToItemIds.has(nfItem.notaFiscalId)) nfToItemIds.set(nfItem.notaFiscalId, []);
                  nfToItemIds.get(nfItem.notaFiscalId)!.push(nfItem.itemDoPedidoDeVendaId);
                }
              }
              
              const allItemIds = Array.from(new Set(Array.from(nfToItemIds.values()).flat()));
              if (allItemIds.length > 0) {
                const itemIdsStr = allItemIds.join(',');
                const pedidoItemsData = await gql<any>(`{
                  itensDosPedidosDeVendas(skip: 0, take: 500, where: { id: { in: [${itemIdsStr}] } }) {
                    items { id pedidoDeVenda { numero } }
                  }
                }`);
                
                if (pedidoItemsData?.itensDosPedidosDeVendas?.items) {
                  const itemToPedido = new Map<number, string>();
                  for (const pi of pedidoItemsData.itensDosPedidosDeVendas.items) {
                    if (pi.pedidoDeVenda?.numero) itemToPedido.set(pi.id, String(pi.pedidoDeVenda.numero));
                  }
                  
                  // Mapear NF ID → pedido número
                  for (const [nfId, itemIds] of Array.from(nfToItemIds.entries())) {
                    for (const itemId of itemIds) {
                      const pedNum = itemToPedido.get(itemId);
                      if (pedNum) {
                        const nfObj = relevantNfs.find(nf => nf.id === nfId);
                        if (nfObj) {
                          nfNumToPedidoNum.set(String(nfObj.numero), pedNum);
                          const existing = pedidoToNf.get(pedNum) || [];
                          if (!existing.includes(String(nfObj.numero))) existing.push(String(nfObj.numero));
                          pedidoToNf.set(pedNum, existing);
                        }
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.error('[getClientSummary] Error fetching NF-Pedido links:', err.message);
        // Fallback: sem vincular NF ao pedido, continua normalmente
      }

      // Usar pedidoGroups já agrupados para recentOrders
      const recentOrders = pedidoGroups
        .sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao))
        .slice(0, 20)
        .map(p => ({
          pedido: p.pedido,
          data: p.dataEmissao,
          valor: Math.round(p.valorTotal * 100) / 100,
          status: p.estadoNotaPedido,
          itens: p.itens.length,
          condicaoPagamento: p.condicaoPagamento,
          notasFiscais: pedidoToNf.get(p.pedido) || [],
        }));

      // Agrupar títulos por PEDIDO (não por NF)
      // Se o documentoVinculadoNumero é uma NF que pertence a um pedido, agrupar sob o pedido
      // REGRA: quando um pedido tem NF vinculada, os títulos do pedido (doc=numero_pedido)
      // são substituídos pelos títulos da NF (doc=numero_nf). Excluir títulos antigos do pedido.
      
      // Primeiro, identificar quais números de pedido têm NF vinculada
      const pedidosComNf = new Set<string>();
      for (const [nfNum, pedNum] of Array.from(nfNumToPedidoNum.entries())) {
        pedidosComNf.add(pedNum);
      }
      
      const tituloGroupMap = new Map<string, Array<typeof allReceivables[number]>>();
      for (const r of deduplicatedReceivables) {
        const doc = r.documentoVinculadoNumero || `solo_${r.id}`;
        
        // Se este doc é um número de pedido que já tem NF vinculada,
        // PULAR estes títulos (serão substituídos pelos da NF)
        if (pedidosComNf.has(doc)) {
          continue; // Ignorar títulos antigos do pedido, usar apenas os da NF
        }
        
        // Verificar se este doc é uma NF vinculada a um pedido
        const pedidoOrigem = nfNumToPedidoNum.get(doc);
        // Se tem pedido de origem, agrupar sob o pedido; senão, agrupar pelo próprio doc
        const key = pedidoOrigem || doc;
        const existing = tituloGroupMap.get(key) || [];
        existing.push(r);
        tituloGroupMap.set(key, existing);
      }
      // Criar mapa de número do pedido → estado do pedido para lookup rápido
      const pedidoEstadoMap = new Map<string, string>();
      for (const p of pedidoGroups) {
        pedidoEstadoMap.set(p.pedido, p.estadoNotaPedido);
      }

      const groupedReceivablesRaw = Array.from(tituloGroupMap.entries()).map(([groupKey, titulos]) => {
        // Filtrar apenas títulos EMITIDO com saldo > 0 para a seção "Em Aberto"
        // Títulos RECEBIDO são mantidos para a aba "Pagos"
        const titulosComSaldo = titulos.filter(r => {
          const orig = parseFloat(r.valorOriginal || "0");
          const receb = parseFloat(r.valorRecebidoLiquido || "0");
          // Manter RECEBIDO (para aba Pagos) e EMITIDO com saldo > 0
          return r.estado === "RECEBIDO" || (orig - receb) > 0.01;
        });
        const valorTotalGrupo = titulosComSaldo.reduce((s, r) => {
          const orig = parseFloat(r.valorOriginal || "0");
          const receb = parseFloat(r.valorRecebidoLiquido || "0");
          // Para RECEBIDO, valor a receber é 0 (já pago)
          if (r.estado === "RECEBIDO") return s;
          return s + (orig - receb);
        }, 0);
        const valorRecebidoGrupo = titulosComSaldo.reduce((s, r) => s + parseFloat(r.valorRecebidoLiquido || "0"), 0);
        const docNumClean = groupKey.startsWith("solo_") ? "" : groupKey;
        // Verificar se o groupKey é um número de pedido
        const isPedido = allPedidoNumbers.has(docNumClean);
        // Coletar todas as NFs vinculadas a este pedido
        const nfVinculada = isPedido ? (pedidoToNf.get(docNumClean) || []) : [];
        // Se não é pedido mas é uma NF que tem pedido de origem, marcar como pedido
        const pedidoOrigem = nfNumToPedidoNum.get(docNumClean);
        // Determinar o número do pedido real
        const pedidoNum = isPedido ? docNumClean : (pedidoOrigem || "");
        // Buscar o estado real do pedido de venda
        const estadoPedido = pedidoNum ? (pedidoEstadoMap.get(pedidoNum) || "") : "";
        // O pedido só é considerado faturado se o estado do pedido de venda é "Faturado"
        const isFaturado = estadoPedido === "Faturado";
        return {
          documento: docNumClean,
          isPedido: isPedido || !!pedidoOrigem,
          pedidoNumero: pedidoNum,
          estadoPedido,
          isFaturado,
          nfVinculada,
          valorTotalGrupo: Math.round(valorTotalGrupo * 100) / 100,
          valorRecebidoGrupo: Math.round(valorRecebidoGrupo * 100) / 100,
          parcelas: titulosComSaldo.length,
          titulos: titulosComSaldo.map(r => ({
            id: r.id,
            documento: r.documentoVinculadoNumero || "",
            nfNumero: r.documentoVinculadoNumero || "",
            emissao: r.emissaoData || "",
            vencimento: r.vencimentoData || "",
            liquidacao: r.liquidacaoData || "",
            valorOriginal: Math.round((parseFloat(r.valorOriginal || "0") - parseFloat(r.valorRecebidoLiquido || "0")) * 100) / 100,
            valorRecebido: Math.round(parseFloat(r.valorRecebidoLiquido || "0") * 100) / 100,
            estado: r.estado,
            parcela: r.parcela,
            totalParcelas: r.parcelasQuantidadeTotal,
            referente: r.referenteA || "",
            bancoNome: r.bancoNome || "",
          })),
        };
      });
      // Filtrar grupos com valor a receber <= 0 (já totalmente pagos)
      const groupedReceivables = groupedReceivablesRaw.filter(g => g.valorTotalGrupo > 0.01);
      // Calcular KPIs de títulos APÓS filtrar títulos antigos de pedidos com NF
      // Usar dedupForCountsRaw filtrado (excluir títulos de pedidos que já têm NF)
      // REGRA: TITULO_PROPOSTA_DE_VENDA NUNCA conta como dívida real
      const dedupForCounts = dedupForCountsRaw.filter(r => {
        if (r.tipo === "TITULO_PROPOSTA_DE_VENDA") return false; // Propostas não são dívida
        const doc = r.documentoVinculadoNumero || '';
        // Excluir títulos cujo doc é um número de pedido que já tem NF vinculada
        return !pedidosComNf.has(doc);
      });
      titulosEmitidos = dedupForCounts.filter(r => r.estado === "EMITIDO");
      titulosRecebidos = dedupForCounts.filter(r => r.estado === "RECEBIDO");
      valorEmAberto = titulosEmitidos.reduce((s, r) => {
        const original = parseFloat(r.valorOriginal || "0");
        const recebido = parseFloat(r.valorRecebidoLiquido || "0");
        return s + (original - recebido);
      }, 0);
      valorRecebido = titulosRecebidos.reduce((s, r) => s + parseFloat(r.valorRecebidoLiquido || "0"), 0);
      docsEmitidos = new Set(titulosEmitidos.map(r => r.documentoVinculadoNumero || `solo_${r.id}`));
      docsRecebidos = new Set(titulosRecebidos.map(r => r.documentoVinculadoNumero || `solo_${r.id}`));
      docsTotal = new Set(dedupForCounts.map(r => r.documentoVinculadoNumero || `solo_${r.id}`));
      titulosVencidos = titulosEmitidos.filter(r => {
        if (!r.vencimentoData) return false;
        return r.vencimentoData < nowStr;
      });
      valorVencido = titulosVencidos.reduce((s, r) => {
        const original = parseFloat(r.valorOriginal || "0");
        const recebido = parseFloat(r.valorRecebidoLiquido || "0");
        return s + (original - recebido);
      }, 0);
      const diasAtrasoList = titulosVencidos.map(r => {
        const venc = new Date(r.vencimentoData!);
        return Math.floor((now.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
      });
      diasAtrasoMedio = diasAtrasoList.length > 0 ? Math.round(diasAtrasoList.reduce((a, b) => a + b, 0) / diasAtrasoList.length) : 0;
      diasAtrasoMax = diasAtrasoList.length > 0 ? Math.max(...diasAtrasoList) : 0;

      // Also keep flat list for backward compat (deduplicado)
      const recentReceivables = deduplicatedReceivables.slice(0, 30).map((r: typeof allReceivables[number]) => ({
        id: r.id,
        documento: r.documentoVinculadoNumero || "",
        emissao: r.emissaoData || "",
        vencimento: r.vencimentoData || "",
        liquidacao: r.liquidacaoData || "",
        valorOriginal: Math.round((parseFloat(r.valorOriginal || "0") - parseFloat(r.valorRecebidoLiquido || "0")) * 100) / 100,
        valorRecebido: Math.round(parseFloat(r.valorRecebidoLiquido || "0") * 100) / 100,
        estado: r.estado,
        parcela: r.parcela,
        totalParcelas: r.parcelasQuantidadeTotal,
        referente: r.referenteA || "",
        bancoNome: r.bancoNome || "",
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

      // ===== VALOR A RECEBER: usar dados do banco local (sincronizado do Maxiprod) =====
      // Fonte: tabela accounts_receivable, campo 'cliente' = razaoSocial (exato)
      // Isso funciona para TODOS os clientes, sem depender de busca por nomeFantasia no GraphQL
      // LÓGICA VALOR A RECEBER (CORRETA - CONFIRMADA COM MAXIPROD):
      //   - Títulos em aberto: estado EMITIDO (= "A Receber" no Maxiprod)
      //     No Maxiprod, títulos EMITIDO NUNCA têm campo Situação preenchido
      //   - Títulos descontados: estado RECEBIDO com situacaoTitulo PREENCHIDO
      //     (BOLETO DESCONTADO SICOOB, BRADESCO, FACTORING, SICREDI, CHEQUE DESCONTADO FACTORING)
      //     O banco nos pagou (por isso está RECEBIDO), mas o cliente ainda deve ao banco
      //   - Títulos RECEBIDO com situacaoTitulo VAZIO = cliente realmente pagou → IGNORAR
      //   - Valor a Receber = em aberto (EMITIDO) + descontados (RECEBIDO com situação)
      let valorEmAbertoLive = 0;
      let valorDescontados = 0;
      let titulosEmAbertoLive: Array<{ valorOriginal: number; vencimento: string; documento: string; parcela: string; tipo: string; situacao: string }> = [];
      let titulosDescontados: Array<{ valorOriginal: number; situacao: string; formaCobranca: string; vencimento: string; documento: string; parcela: string; liquidacao: string; tipo: string }> = [];
      try {
        // REGRA: TITULO_PROPOSTA_DE_VENDA NUNCA conta como dívida real (são apenas projeções/orçamentos)
        const receivablesExcluindoPropostas = allReceivables.filter(r => r.tipo !== "TITULO_PROPOSTA_DE_VENDA");

        // 1. Títulos em aberto: estado EMITIDO (= "A Receber" no Maxiprod)
        const emitidosLocal = receivablesExcluindoPropostas.filter(r => r.estado === "EMITIDO");
        for (const r of emitidosLocal) {
          const valorLiq = parseFloat(r.valorLiquido || r.valorOriginal || "0");
          const valorRecebido = parseFloat(r.valorRecebidoLiquido || "0");
          const saldo = valorLiq - valorRecebido;
          if (saldo <= 0) continue;
          
          valorEmAbertoLive += saldo;
          titulosEmAbertoLive.push({
            valorOriginal: Math.round(saldo * 100) / 100,
            vencimento: r.vencimentoData || "",
            documento: r.documentoVinculadoNumero || "",
            parcela: r.parcela ? String(r.parcela) : "",
            tipo: r.tipo || "",
            situacao: (r.situacaoTitulo || "").trim(),
          });
        }

        // 2. Títulos descontados: estado RECEBIDO com situacaoTitulo PREENCHIDO
        //    Se situacaoTitulo está vazio, o cliente realmente pagou → ignorar
        const recebidosLocal = receivablesExcluindoPropostas.filter(r => r.estado === "RECEBIDO");
        for (const r of recebidosLocal) {
          const situacao = (r.situacaoTitulo || "").trim();
          if (!situacao) continue; // Vazio = cliente pagou de verdade, ignorar
          
          const valorLiq = parseFloat(r.valorLiquido || r.valorOriginal || "0");
          const valorRecebido = parseFloat(r.valorRecebidoLiquido || "0");
          // Para descontados, usar valorLiquido como valor do título
          // (valorRecebidoLiquido geralmente = valorLiquido pois o banco nos pagou)
          const saldo = valorLiq;
          if (saldo <= 0) continue;
          
          valorDescontados += saldo;
          titulosDescontados.push({
            valorOriginal: Math.round(saldo * 100) / 100,
            situacao: situacao,
            formaCobranca: r.formaCobranca || "",
            vencimento: r.vencimentoData || "",
            documento: r.documentoVinculadoNumero || "",
            parcela: r.parcela ? String(r.parcela) : "",
            liquidacao: r.liquidacaoData || "",
            tipo: r.tipo || "",
          });
        }
      } catch (err: any) {
        console.error('[getClientSummary] Error computing valor a receber from local DB:', err.message);
      }

      // Valor a Receber total = em aberto (EMITIDO) + descontados (RECEBIDO com situação)
      // Descontados: o banco nos pagou, mas o cliente deve ao banco. Para fins de crédito,
      // o cliente ainda tem dívida pendente (com o banco, não conosco diretamente)
      const valorAReceber = valorEmAbertoLive + valorDescontados;

      // ===== RECONSTRUIR groupedReceivables a partir dos dados LIVE =====
      // O groupedReceivables antigo (baseado em NFs de pedidos) pode ter dados inconsistentes.
      // Usar os dados live (EMITIDO direto por cliente) para garantir que "Títulos em aberto" = "Valor a Receber"
      if (titulosEmAbertoLive.length > 0 || titulosDescontados.length > 0) {
        // Reconstruir groupedReceivables a partir dos títulos live
        const liveGroupMap = new Map<string, Array<{ documento: string; parcela: string; valorOriginal: number; vencimento: string; estado: string; liquidacao?: string; situacao?: string; formaCobranca?: string }>>(); 
        
        // Adicionar títulos EMITIDO (em aberto)
        for (const t of titulosEmAbertoLive) {
          const key = t.documento || `solo_${Math.random().toString(36).slice(2)}`;
          const existing = liveGroupMap.get(key) || [];
          existing.push({
            documento: t.documento,
            parcela: t.parcela,
            valorOriginal: t.valorOriginal,
            vencimento: t.vencimento,
            estado: "EMITIDO",
          });
          liveGroupMap.set(key, existing);
        }
        
        // Adicionar títulos descontados (RECEBIDO com situação)
        for (const t of titulosDescontados) {
          const key = t.documento || `solo_desc_${Math.random().toString(36).slice(2)}`;
          const existing = liveGroupMap.get(key) || [];
          existing.push({
            documento: t.documento,
            parcela: t.parcela,
            valorOriginal: t.valorOriginal,
            vencimento: t.vencimento,
            estado: "DESCONTADO",
            liquidacao: t.liquidacao,
            situacao: t.situacao,
            formaCobranca: t.formaCobranca,
          });
          liveGroupMap.set(key, existing);
        }
        
        // Reconstruir groupedReceivables com os dados live
        const liveGroupedReceivables = Array.from(liveGroupMap.entries()).map(([groupKey, titulos]) => {
          const valorTotalGrupo = titulos.reduce((s, t) => s + t.valorOriginal, 0);
          const docNumClean = groupKey.startsWith("solo_") ? "" : groupKey;
          // Verificar se é um pedido
          const isPedido = allPedidoNumbers.has(docNumClean);
          const pedidoOrigem = nfNumToPedidoNum.get(docNumClean);
          const pedidoNum = isPedido ? docNumClean : (pedidoOrigem || "");
          const estadoPedido = pedidoNum ? (pedidoEstadoMap.get(pedidoNum) || "") : "";
          const isFaturado = estadoPedido === "Faturado";
          const nfVinculada = isPedido ? (pedidoToNf.get(docNumClean) || []) : [];
          return {
            documento: docNumClean,
            isPedido: isPedido || !!pedidoOrigem,
            pedidoNumero: pedidoNum,
            estadoPedido,
            isFaturado,
            nfVinculada,
            valorTotalGrupo: Math.round(valorTotalGrupo * 100) / 100,
            valorRecebidoGrupo: 0,
            parcelas: titulos.length,
            titulos: titulos.map((t, idx) => ({
              id: idx,
              documento: t.documento,
              nfNumero: t.documento,
              emissao: "",
              vencimento: t.vencimento,
              liquidacao: t.liquidacao || "",
              valorOriginal: t.valorOriginal,
              valorRecebido: 0,
              estado: t.estado,
              parcela: t.parcela ? parseInt(t.parcela) || null : null,
              totalParcelas: null as number | null,
              referente: "",
              bancoNome: t.formaCobranca || "",
            })),
          };
        }).filter(g => g.valorTotalGrupo > 0.01);
        
        // Substituir groupedReceivables pelos dados live
        groupedReceivables.length = 0;
        groupedReceivables.push(...liveGroupedReceivables);
        
        // Atualizar valorEmAberto para bater com valorEmAbertoLive
        valorEmAberto = valorEmAbertoLive;
      }

      // ===== INADIMPLÊNCIA: buscar status da Planilha de Cobrança =====
      let inadimplencia: { isInadimplente: boolean; titulos: Array<{ documento: string; valor: number; vencimento: string; diasVencidos: number; status: string; tipo: string | null }>; totalValor: number; totalTitulos: number } = {
        isInadimplente: false,
        titulos: [],
        totalValor: 0,
        totalTitulos: 0,
      };
      try {
        // Buscar na cobranca_planilha por nome da empresa (case-insensitive via LIKE)
        const cobrancaRows = await db.select().from(cobrancaPlanilha)
          .where(and(
            eq(cobrancaPlanilha.ativo, true),
            like(cobrancaPlanilha.empresa, `%${cn}%`)
          ));
        if (cobrancaRows.length > 0) {
          inadimplencia.isInadimplente = true;
          inadimplencia.totalTitulos = cobrancaRows.length;
          inadimplencia.totalValor = cobrancaRows.reduce((s, r) => s + parseFloat(String(r.valor || "0")), 0);
          inadimplencia.titulos = cobrancaRows.map(r => ({
            documento: r.documento || "",
            valor: parseFloat(String(r.valor || "0")),
            vencimento: r.vencimento || "",
            diasVencidos: r.diasVencidos || 0,
            status: r.status || "Pendente",
            tipo: r.tipo || null,
          }));
        }
      } catch (err: any) {
        console.error('[getClientSummary] Error fetching inadimplência:', err.message);
      }

      return {
        clientInfo,
        inadimplencia,
        orders: {
          totalPedidos,
          valorTotalPedidos: Math.round(valorTotalPedidos * 100) / 100,
          valorFaturado: Math.round(valorFaturado * 100) / 100,
          valorAFaturar: Math.round(valorAFaturar * 100) / 100,
          valorEmDigitacao: Math.round(valorEmDigitacao * 100) / 100,
          valorAprovar: Math.round(valorAprovar * 100) / 100,
          pedidosFaturados: pedidosFaturadosArr.length,
          pedidosAFaturar: pedidosAFaturarArr.length,
          pedidosEmDigitacao: pedidosEmDigitacaoArr.length,
          pedidosAprovar: pedidosAprovarArr.length,
        },
        receivables: {
          // Parcelas (individuais)
          totalParcelas: dedupForCounts.length,
          parcelasEmAberto: titulosEmitidos.length,
          parcelasRecebidas: titulosRecebidos.length,
          // Documentos (agrupados)
          totalDocumentos: docsTotal.size,
          documentosEmAberto: docsEmitidos.size,
          documentosRecebidos: docsRecebidos.size,
          // Valores
          valorEmAberto: Math.round(valorEmAberto * 100) / 100,
          valorRecebido: Math.round(valorRecebido * 100) / 100,
          // Valor a Receber ao vivo do Maxiprod
          valorEmAbertoLive: Math.round(valorEmAbertoLive * 100) / 100,
          valorAReceber: Math.round(valorAReceber * 100) / 100,
          valorDescontados: Math.round(valorDescontados * 100) / 100,
          titulosDescontados,
          titulosEmAbertoLive,
          // Compat
          totalTitulos: dedupForCounts.length,
          titulosEmAberto: titulosEmitidos.length,
          titulosRecebidos: titulosRecebidos.length,
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
        groupedReceivables,
        pendingItems,
      };
    }),

  /**
   * Get monthly sales quantity by product (codigoItem) for the last 3 months + current month.
   * Used for the hidden informational columns in the Estoque and Sob Encomenda cards.
   * Only counts items with estadoItem in ('Faturado', 'Faturado parcial', 'Faturado c/ entrega futura').
   */
  getMonthlySalesByProduct: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { months: [], data: {} };

    // Calculate month boundaries in BR timezone
    const now = new Date();
    // Use Intl to get BR date parts
    const brFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
    const brParts = brFormatter.formatToParts(now);
    const curYear = parseInt(brParts.find(p => p.type === 'year')!.value);
    const curMonth = parseInt(brParts.find(p => p.type === 'month')!.value);

    // Build 4 month keys: -3, -2, -1, current
    const monthKeys: string[] = [];
    const monthLabels: string[] = [];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let offset = -3; offset <= 0; offset++) {
      let m = curMonth + offset;
      let y = curYear;
      if (m <= 0) { m += 12; y -= 1; }
      const key = `${y}-${String(m).padStart(2, '0')}`;
      monthKeys.push(key);
      monthLabels.push(`${monthNames[m - 1]}/${String(y).slice(2)}`);
    }

    // Query: sum quantity by codigoItem and month for faturado items
    const startDate = `${monthKeys[0]}-01`;
    const endMonth = monthKeys[3];
    // End of current month
    let endM = parseInt(endMonth.split('-')[1]);
    let endY = parseInt(endMonth.split('-')[0]);
    if (endM === 12) { endM = 1; endY += 1; } else { endM += 1; }
    const endDate = `${endY}-${String(endM).padStart(2, '0')}-01`;

    // Use raw SQL to avoid Drizzle ORM issues with DATE_FORMAT and SUBSTRING
    const rawRows = await db.execute(
      sql`SELECT codigoItem, DATE_FORMAT(SUBSTRING(dataEmissao, 1, 10), '%Y-%m') as yearMonth, COALESCE(SUM(quantidade), 0) as totalQty FROM sales_orders WHERE codigoItem IS NOT NULL AND codigoItem != '' AND estadoItem IN ('Faturado', 'Faturado parcial', 'Faturado c/ entrega futura') AND SUBSTRING(dataEmissao, 1, 10) >= ${startDate} AND SUBSTRING(dataEmissao, 1, 10) < ${endDate} GROUP BY codigoItem, DATE_FORMAT(SUBSTRING(dataEmissao, 1, 10), '%Y-%m')`
    );

    // Fetch variant mappings (child -> parent with conversion factor)
    const variantRows = await db.select({
      parentCode: productVariants.parentCode,
      childCode: productVariants.childCode,
      conversionFactor: productVariants.conversionFactor,
    }).from(productVariants);

    // Build child->parent map: { childCode: { parentCode, factor } }
    const childToParent: Record<string, { parentCode: string; factor: number }> = {};
    for (const v of variantRows) {
      childToParent[v.childCode] = {
        parentCode: v.parentCode,
        factor: parseFloat(String(v.conversionFactor)) || 1,
      };
    }

    // Build result map: { codigoItem: { 'YYYY-MM': qty, ... } }
    const data: Record<string, Record<string, number>> = {};
    const rows = (rawRows as any)[0] || rawRows;
    for (const row of (Array.isArray(rows) ? rows : [])) {
      const code = (row as any).codigoItem;
      const ym = (row as any).yearMonth;
      const qty = parseFloat(String((row as any).totalQty)) || 0;
      if (!code || !ym) continue;

      // If this is a child variant, convert and aggregate to parent
      const mapping = childToParent[code];
      if (mapping) {
        const parentCode = mapping.parentCode;
        const convertedQty = qty * mapping.factor;
        if (!data[parentCode]) data[parentCode] = {};
        data[parentCode][ym] = (data[parentCode][ym] || 0) + convertedQty;
      } else {
        // Regular product (not a child variant)
        if (!data[code]) data[code] = {};
        data[code][ym] = (data[code][ym] || 0) + qty;
      }
    }

    return {
      months: monthKeys.map((key, i) => ({ key, label: monthLabels[i] })),
      data,
    };
  }),

  /**
   * Get best sellers (top vendedores) for a given period
   * Returns ranking of sellers with their total value, orders, clients, and segment breakdown
   */
  getBestSellers: publicProcedure
    .input(z.object({
      period: z.enum(["day", "week", "month", "year"]),
      offset: z.number().optional().default(0),
      customDate: z.string().optional(),
      grupo: z.enum(["all", "importacao_revenda", "industrializacao", "importacao_mp"]).optional().default("all"),
      subgrupo: z.string().optional().default("all"),
      crmSegmento: z.string().optional().default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { sellers: [], period: input.period, startDate: "", endDate: "" };

      // Calculate date range based on period + offset
      const now = new Date();
      const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const offset = input.offset || 0;

      let startDate: string;
      let endDate: string;

      if (input.customDate) {
        // Custom date mode: show a single specific day
        startDate = input.customDate;
        endDate = input.customDate;
      } else {
        const refDate = new Date(spNow);
        switch (input.period) {
          case "day":
            refDate.setDate(refDate.getDate() + offset);
            startDate = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-${String(refDate.getDate()).padStart(2, "0")}`;
            endDate = startDate;
            break;
          case "week": {
            refDate.setDate(refDate.getDate() + (offset * 7));
            const dow = refDate.getDay();
            const mondayOff = dow === 0 ? -6 : 1 - dow;
            const monday = new Date(refDate);
            monday.setDate(refDate.getDate() + mondayOff);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            startDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
            if (offset === 0) {
              endDate = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, "0")}-${String(spNow.getDate()).padStart(2, "0")}`;
            } else {
              endDate = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
            }
            break;
          }
          case "month": {
            refDate.setMonth(refDate.getMonth() + offset);
            const y = refDate.getFullYear();
            const m = refDate.getMonth();
            startDate = `${y}-${String(m + 1).padStart(2, "0")}-01`;
            if (offset === 0) {
              endDate = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, "0")}-${String(spNow.getDate()).padStart(2, "0")}`;
            } else {
              const lastDay = new Date(y, m + 1, 0).getDate();
              endDate = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
            }
            break;
          }
          case "year": {
            const targetYear = spNow.getFullYear() + offset;
            startDate = `${targetYear}-01-01`;
            if (offset === 0) {
              endDate = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, "0")}-${String(spNow.getDate()).padStart(2, "0")}`;
            } else {
              endDate = `${targetYear}-12-31`;
            }
            break;
          }
        }
      }

      // Fetch all items in the date range
      const allItems = await db
        .select()
        .from(salesOrders)
        .where(
          and(
            sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) >= ${startDate}`,
            sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) <= ${endDate}`,
          )
        );

      // Apply same filters as getAnalytics
      const estadoToGrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
        return "outros";
      };
      const estadoToSubgrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU") return "bambu";
        if (e === "FIBRA") return "fibra";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
        return "outros";
      };
      const isDigitacao = (nota: string | null) => {
        if (!nota) return false;
        const n = nota.toUpperCase();
        return n === "DIGITAÇÃO" || n === "DIGITACAO";
      };
      const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";

      let items = allItems.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));
      if (input.grupo !== "all") {
        items = items.filter(item => estadoToGrupo(item.estadoConfiguravel) === input.grupo);
      }
      if (input.subgrupo !== "all") {
        items = items.filter(item => estadoToSubgrupo(item.estadoConfiguravel) === input.subgrupo);
      }
      if (input.crmSegmento !== "all") {
        items = items.filter(item => (item.crmSegmento || "").toUpperCase() === input.crmSegmento.toUpperCase());
      }

      // Group by representante (vendedor)
      const sellerMap = new Map<string, {
        name: string;
        totalValue: number;
        orders: Set<string>;
        clients: Set<string>;
        items: number;
        faturado: number;
        aFaturar: number;
        bySegmento: Record<string, number>;
        byCrmSegmento: Record<string, number>;
        byUF: Record<string, number>;
        topClients: Map<string, number>;
        topProducts: Map<string, number>;
      }>();

      for (const item of items) {
        const seller = item.representante || "Sem vendedor";
        if (!sellerMap.has(seller)) {
          sellerMap.set(seller, {
            name: seller,
            totalValue: 0,
            orders: new Set(),
            clients: new Set(),
            items: 0,
            faturado: 0,
            aFaturar: 0,
            bySegmento: {},
            byCrmSegmento: {},
            byUF: {},
            topClients: new Map(),
            topProducts: new Map(),
          });
        }
        const s = sellerMap.get(seller)!;
        const val = Number(item.valorTotal || 0);
        s.totalValue += val;
        s.items++;
        if (item.pedido) s.orders.add(item.pedido);
        if (item.cliente) s.clients.add(item.cliente);
        if (item.estadoItem === "Faturado") s.faturado += val;
        if (item.estadoItem === "A faturar") s.aFaturar += val;

        // By segment (estadoConfiguravel)
        const seg = item.estadoConfiguravel || "Outros";
        s.bySegmento[seg] = (s.bySegmento[seg] || 0) + val;

        // By CRM segment
        const crm = item.crmSegmento || "Sem segmento";
        s.byCrmSegmento[crm] = (s.byCrmSegmento[crm] || 0) + val;

        // By UF
        const uf = item.uf || "N/A";
        s.byUF[uf] = (s.byUF[uf] || 0) + val;

        // Top clients
        const clientName = item.clienteApelido || item.cliente || "—";
        s.topClients.set(clientName, (s.topClients.get(clientName) || 0) + val);

        // Top products
        const prodName = item.descricao || item.descricaoItem || "—";
        s.topProducts.set(prodName, (s.topProducts.get(prodName) || 0) + val);
      }

      // Convert to sorted array
      const sellers = Array.from(sellerMap.values())
        .map(s => ({
          name: s.name,
          totalValue: Math.round(s.totalValue * 100) / 100,
          orders: s.orders.size,
          clients: s.clients.size,
          items: s.items,
          faturado: Math.round(s.faturado * 100) / 100,
          aFaturar: Math.round(s.aFaturar * 100) / 100,
          bySegmento: Object.entries(s.bySegmento)
            .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
            .sort((a, b) => b.value - a.value),
          byCrmSegmento: Object.entries(s.byCrmSegmento)
            .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
            .sort((a, b) => b.value - a.value),
          byUF: Object.entries(s.byUF)
            .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
            .sort((a, b) => b.value - a.value),
          topClients: Array.from(s.topClients.entries())
            .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10),
          topProducts: Array.from(s.topProducts.entries())
            .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10),
        }))
        .filter(s => s.name !== "Sem vendedor")
        .sort((a, b) => b.totalValue - a.totalValue);

      return { sellers, period: input.period, startDate, endDate };
    }),

  /**
   * Get individual orders/items for a specific seller in a given period
   * Returns all sales with client, value, estado configuravel, segmento CRM, UF, etc.
   */
  getBestSellerOrders: publicProcedure
    .input(z.object({
      sellerName: z.string(),
      period: z.enum(["day", "week", "month", "year"]),
      offset: z.number().optional().default(0),
      customDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { orders: [], startDate: "", endDate: "" };

      // Calculate date range (same logic as getBestSellers)
      const now = new Date();
      const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const offset = input.offset || 0;
      let startDate: string;
      let endDate: string;

      if (input.customDate) {
        startDate = input.customDate;
        endDate = input.customDate;
      } else {
        const refDate = new Date(spNow);
        switch (input.period) {
          case "day":
            refDate.setDate(refDate.getDate() + offset);
            startDate = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-${String(refDate.getDate()).padStart(2, "0")}`;
            endDate = startDate;
            break;
          case "week": {
            refDate.setDate(refDate.getDate() + (offset * 7));
            const dow = refDate.getDay();
            const mondayOff = dow === 0 ? -6 : 1 - dow;
            const monday = new Date(refDate);
            monday.setDate(refDate.getDate() + mondayOff);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            startDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
            if (offset === 0) {
              endDate = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, "0")}-${String(spNow.getDate()).padStart(2, "0")}`;
            } else {
              endDate = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
            }
            break;
          }
          case "month": {
            refDate.setMonth(refDate.getMonth() + offset);
            const y = refDate.getFullYear();
            const m = refDate.getMonth();
            startDate = `${y}-${String(m + 1).padStart(2, "0")}-01`;
            if (offset === 0) {
              endDate = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, "0")}-${String(spNow.getDate()).padStart(2, "0")}`;
            } else {
              const lastDay = new Date(y, m + 1, 0).getDate();
              endDate = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
            }
            break;
          }
          case "year": {
            const targetYear = spNow.getFullYear() + offset;
            startDate = `${targetYear}-01-01`;
            if (offset === 0) {
              endDate = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, "0")}-${String(spNow.getDate()).padStart(2, "0")}`;
            } else {
              endDate = `${targetYear}-12-31`;
            }
            break;
          }
        }
      }

      // Fetch items for this seller in the date range
      const allItems = await db
        .select()
        .from(salesOrders)
        .where(
          and(
            sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) >= ${startDate}`,
            sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) <= ${endDate}`,
            sql`${salesOrders.representante} = ${input.sellerName}`,
          )
        );

      // Filter out Digitacao and Outros
      const isDigitacao = (nota: string | null) => {
        if (!nota) return false;
        const n = nota.toUpperCase();
        return n === "DIGITA\u00C7\u00C3O" || n === "DIGITACAO";
      };
      const estadoToGrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
        if (e === "MADEIRA IMPORTA\u00C7\u00C3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
        return "outros";
      };
      const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";
      const items = allItems.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));

      // Group by pedido for a cleaner view
      const pedidoMap = new Map<string, {
        pedido: string;
        cliente: string;
        clienteApelido: string;
        dataEmissao: string;
        uf: string;
        estadoConfiguravel: string;
        crmSegmento: string;
        estadoItem: string;
        valorTotal: number;
        itens: number;
        produtos: string[];
      }>();

      for (const item of items) {
        const key = item.pedido || `item-${item.id}`;
        if (!pedidoMap.has(key)) {
          pedidoMap.set(key, {
            pedido: item.pedido || "-",
            cliente: item.cliente || "-",
            clienteApelido: item.clienteApelido || item.cliente || "-",
            dataEmissao: item.dataEmissao ? item.dataEmissao.substring(0, 10) : "-",
            uf: item.uf || "-",
            estadoConfiguravel: item.estadoConfiguravel || "-",
            crmSegmento: item.crmSegmento || "-",
            estadoItem: item.estadoItem || "-",
            valorTotal: 0,
            itens: 0,
            produtos: [],
          });
        }
        const p = pedidoMap.get(key)!;
        p.valorTotal += Number(item.valorTotal || 0);
        p.itens++;
        const prod = item.descricao || item.descricaoItem || "";
        if (prod && !p.produtos.includes(prod)) p.produtos.push(prod);
        // Merge estadoConfiguravel if different items have different ones
        if (item.estadoConfiguravel && p.estadoConfiguravel === "-") {
          p.estadoConfiguravel = item.estadoConfiguravel;
        }
        if (item.crmSegmento && p.crmSegmento === "-") {
          p.crmSegmento = item.crmSegmento;
        }
      }

      const orders = Array.from(pedidoMap.values())
        .map(o => ({ ...o, valorTotal: Math.round(o.valorTotal * 100) / 100 }))
        .sort((a, b) => b.valorTotal - a.valorTotal);

      return { orders, startDate, endDate };
    }),

  // ===== SELLER ADMISSIONS (Métrica de Clientes) =====

  /** List all seller admissions */
  listSellerAdmissions: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const rows = await db.select().from(sellerAdmissions).orderBy(sellerAdmissions.sellerName);
    return rows;
  }),

  /** Upsert seller admission date */
  upsertSellerAdmission: publicProcedure
    .input(z.object({
      sellerName: z.string().min(1),
      admissionDate: z.string(), // ISO date string
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const dateVal = new Date(input.admissionDate);
      // Try update first
      const existing = await db.select().from(sellerAdmissions).where(eq(sellerAdmissions.sellerName, input.sellerName));
      if (existing.length > 0) {
        await db.update(sellerAdmissions)
          .set({ admissionDate: dateVal })
          .where(eq(sellerAdmissions.sellerName, input.sellerName));
      } else {
        await db.insert(sellerAdmissions).values({
          sellerName: input.sellerName,
          admissionDate: dateVal,
        });
      }
      return { success: true };
    }),

  /** Get client metrics for a seller based on admission date */
  getClientMetrics: publicProcedure
    .input(z.object({
      sellerName: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      // Get seller admission date
      const [admission] = await db.select().from(sellerAdmissions)
        .where(eq(sellerAdmissions.sellerName, input.sellerName));
      if (!admission) return null;

      const admDate = admission.admissionDate;
      // 6 months before admission = threshold for "new client"
      const sixMonthsBefore = new Date(admDate);
      sixMonthsBefore.setMonth(sixMonthsBefore.getMonth() - 6);

      // Get all orders for this seller since admission
      const sellerOrders = await db.select({
        cliente: salesOrders.cliente,
        dataEmissao: salesOrders.dataEmissao,
        valorTotal: salesOrders.valorTotal,
      }).from(salesOrders)
        .where(and(
          sql`${salesOrders.representante} = ${input.sellerName}`,
          gte(salesOrders.dataEmissao, admDate.toISOString().slice(0, 10)),
        ));

      // Get all orders BEFORE admission to identify inherited clients
      const priorOrders = await db.select({
        cliente: salesOrders.cliente,
        dataEmissao: salesOrders.dataEmissao,
      }).from(salesOrders)
        .where(and(
          lte(salesOrders.dataEmissao, admDate.toISOString().slice(0, 10)),
        ));

      // Build map of last purchase date per client before admission
      const lastPurchaseBefore = new Map<string, Date>();
      for (const o of priorOrders) {
        if (!o.cliente || !o.dataEmissao) continue;
        const d = new Date(o.dataEmissao);
        const prev = lastPurchaseBefore.get(o.cliente);
        if (!prev || d > prev) lastPurchaseBefore.set(o.cliente, d);
      }

      // Classify clients
      const clientesNovos: string[] = [];
      const clientesReativados: string[] = [];
      const clientesHerdados: string[] = [];
      const clientesSeen = new Set<string>();

      for (const o of sellerOrders) {
        if (!o.cliente || clientesSeen.has(o.cliente)) continue;
        clientesSeen.add(o.cliente);

        const lastBefore = lastPurchaseBefore.get(o.cliente);
        if (!lastBefore) {
          // Never bought before = truly new
          clientesNovos.push(o.cliente);
        } else if (lastBefore < sixMonthsBefore) {
          // Last purchase was 6+ months before admission = reactivated
          clientesReativados.push(o.cliente);
        } else {
          // Bought within 6 months before admission = inherited
          clientesHerdados.push(o.cliente);
        }
      }

      return {
        admissionDate: admDate.toISOString(),
        totalClientes: clientesSeen.size,
        clientesNovos: clientesNovos.length,
        clientesReativados: clientesReativados.length,
        clientesHerdados: clientesHerdados.length,
        listaClientesNovos: clientesNovos.slice(0, 50),
        listaClientesReativados: clientesReativados.slice(0, 50),
        listaClientesHerdados: clientesHerdados.slice(0, 50),
      };
    }),

  // ==================== Métricas de Clientes do Grupo ====================

  /**
   * Get group-level client metrics: new clients per month, frequency ranking, overdue alerts
   * No individual seller focus - analyzes the entire client portfolio
   */
  getGroupClientMetrics: publicProcedure
    .input(z.object({
      segmentoProduto: z.string().optional(), // BAMBU, MADEIRA, etc.
      segmentoCliente: z.string().optional(), // DISTRIBUIDORA, LOJA, etc.
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Fetch all orders
      const allOrders = await db.select({
        pedido: salesOrders.pedido,
        cliente: salesOrders.cliente,
        dataEmissao: salesOrders.dataEmissao,
        valorTotal: salesOrders.valorTotal,
        estadoConfiguravel: salesOrders.estadoConfiguravel,
        segmento: salesOrders.segmento,
        crmSegmento: salesOrders.crmSegmento,
        uf: salesOrders.uf,
      }).from(salesOrders)
        .where(sql`${salesOrders.cliente} IS NOT NULL AND ${salesOrders.cliente} != ''`);

      // Apply segment filters
      let filtered = allOrders;
      if (input.segmentoProduto && input.segmentoProduto !== "all") {
        filtered = filtered.filter(o => o.estadoConfiguravel === input.segmentoProduto);
      }
      if (input.segmentoCliente && input.segmentoCliente !== "all") {
        const seg = input.segmentoCliente;
        filtered = filtered.filter(o => (o.segmento === seg || o.crmSegmento === seg));
      }

      // Build per-client order history (using distinct pedido dates)
      const clientOrders = new Map<string, { dates: Date[]; totalValue: number; uf: string; segmento: string; crmSegmento: string }>();
      const pedidoSeen = new Map<string, Set<string>>(); // client -> set of pedido numbers

      for (const o of filtered) {
        if (!o.cliente || !o.dataEmissao) continue;
        const key = o.cliente;
        if (!clientOrders.has(key)) {
          clientOrders.set(key, { dates: [], totalValue: 0, uf: o.uf || "", segmento: o.segmento || "", crmSegmento: o.crmSegmento || "" });
          pedidoSeen.set(key, new Set());
        }
        const entry = clientOrders.get(key)!;
        const pedidoSet = pedidoSeen.get(key)!;
        const pedidoKey = o.pedido || o.dataEmissao;
        if (!pedidoSet.has(pedidoKey)) {
          pedidoSet.add(pedidoKey);
          entry.dates.push(new Date(o.dataEmissao));
        }
        entry.totalValue += Number(o.valorTotal || 0);
      }

      // Sort each client's dates
      Array.from(clientOrders.entries()).forEach(([, v]) => {
        v.dates.sort((a: Date, b: Date) => a.getTime() - b.getTime());
      });

      // === 1. Clientes Novos por Mês ===
      // A client is "new" in the month of their first-ever order
      // A client is "reactivated" if their previous order was 6+ months before
      const monthlyNew: Record<string, { novos: string[]; reativados: string[] }> = {};

      // Build global first-purchase map (across ALL orders, not just filtered)
      const globalFirstPurchase = new Map<string, Date>();
      for (const o of allOrders) {
        if (!o.cliente || !o.dataEmissao) continue;
        const d = new Date(o.dataEmissao);
        const prev = globalFirstPurchase.get(o.cliente);
        if (!prev || d < prev) globalFirstPurchase.set(o.cliente, d);
      }

      Array.from(clientOrders.entries()).forEach(([cliente, data]) => {
        if (data.dates.length === 0) return;
        const firstDate = data.dates[0];
        const monthKey = `${firstDate.getFullYear()}-${String(firstDate.getMonth() + 1).padStart(2, "0")}`;

        if (!monthlyNew[monthKey]) monthlyNew[monthKey] = { novos: [], reativados: [] };

        const globalFirst = globalFirstPurchase.get(cliente);
        if (globalFirst && globalFirst.getTime() === firstDate.getTime()) {
          // Truly new client (first purchase ever)
          monthlyNew[monthKey].novos.push(cliente);
        } else {
          // Check if previous purchase was 6+ months before
          const allClientOrderDates = allOrders
            .filter(o => o.cliente === cliente && o.dataEmissao)
            .map(o => new Date(o.dataEmissao!))
            .sort((a: Date, b: Date) => a.getTime() - b.getTime());
          
          const prevOrders = allClientOrderDates.filter((d: Date) => d < firstDate);
          if (prevOrders.length > 0) {
            const lastPrev = prevOrders[prevOrders.length - 1];
            const diffMs = firstDate.getTime() - lastPrev.getTime();
            const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30);
            if (diffMonths >= 6) {
              monthlyNew[monthKey].reativados.push(cliente);
            }
          }
        }
      });

      // Sort months
      const sortedMonths = Object.keys(monthlyNew).sort();
      const clientesNovosPorMes = sortedMonths.map(m => ({
        month: m,
        novos: monthlyNew[m].novos.length,
        reativados: monthlyNew[m].reativados.length,
        total: monthlyNew[m].novos.length + monthlyNew[m].reativados.length,
        listaNovos: monthlyNew[m].novos.slice(0, 30),
        listaReativados: monthlyNew[m].reativados.slice(0, 30),
      }));

      // === 2. Ranking de Frequência (últimos 12 meses) ===
      const now = new Date();
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const frequencyRanking: Array<{
        cliente: string;
        numPedidos: number;
        primeiraCompra: string;
        ultimaCompra: string;
        intervaloMedioDias: number;
        valorTotal: number;
        uf: string;
        segmento: string;
      }> = [];

      Array.from(clientOrders.entries()).forEach(([cliente, data]) => {
        const recentDates = data.dates.filter((d: Date) => d >= twelveMonthsAgo);
        if (recentDates.length === 0) return;

        // Calculate average interval
        let avgInterval = 0;
        if (recentDates.length > 1) {
          let totalInterval = 0;
          for (let i = 1; i < recentDates.length; i++) {
            totalInterval += (recentDates[i].getTime() - recentDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
          }
          avgInterval = Math.round(totalInterval / (recentDates.length - 1));
        }

        frequencyRanking.push({
          cliente,
          numPedidos: recentDates.length,
          primeiraCompra: data.dates[0].toISOString().slice(0, 10),
          ultimaCompra: data.dates[data.dates.length - 1].toISOString().slice(0, 10),
          intervaloMedioDias: avgInterval,
          valorTotal: Math.round(data.totalValue * 100) / 100,
          uf: data.uf,
          segmento: data.segmento || data.crmSegmento || "",
        });
      });

      // Sort by number of orders descending
      frequencyRanking.sort((a, b) => b.numPedidos - a.numPedidos || b.valorTotal - a.valorTotal);

      // === 3. Alerta de Intervalo Vencido ===
      // Clients with 2+ orders whose expected reorder date has passed
      const overdueClients: Array<{
        cliente: string;
        numPedidos: number;
        intervaloMedioDias: number;
        ultimaCompra: string;
        diasDesdeUltimaCompra: number;
        diasAtrasado: number;
        valorTotal: number;
        uf: string;
      }> = [];

      Array.from(clientOrders.entries()).forEach(([cliente, data]) => {
        if (data.dates.length < 2) return;

        // Calculate average interval between orders
        let totalInterval = 0;
        for (let i = 1; i < data.dates.length; i++) {
          totalInterval += (data.dates[i].getTime() - data.dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        }
        const avgInterval = totalInterval / (data.dates.length - 1);

        const lastOrder = data.dates[data.dates.length - 1];
        const daysSinceLast = Math.round((now.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24));

        // If days since last order > avg interval * 1.3, consider overdue
        if (daysSinceLast > avgInterval * 1.3 && daysSinceLast > 14) {
          overdueClients.push({
            cliente,
            numPedidos: data.dates.length,
            intervaloMedioDias: Math.round(avgInterval),
            ultimaCompra: lastOrder.toISOString().slice(0, 10),
            diasDesdeUltimaCompra: daysSinceLast,
            diasAtrasado: Math.round(daysSinceLast - avgInterval),
            valorTotal: Math.round(data.totalValue * 100) / 100,
            uf: data.uf,
          });
        }
      });

      // Sort by days overdue descending
      overdueClients.sort((a, b) => b.diasAtrasado - a.diasAtrasado);

      // === 4. Summary KPIs ===
      const totalClientes = clientOrders.size;
      const clientesCom1Pedido = Array.from(clientOrders.values()).filter(v => v.dates.length === 1).length;
      const clientesRecorrentes = totalClientes - clientesCom1Pedido;
      const totalNovosUltimos3Meses = sortedMonths.slice(-3).reduce((sum, m) => sum + (monthlyNew[m]?.novos.length || 0), 0);
      const totalReativadosUltimos3Meses = sortedMonths.slice(-3).reduce((sum, m) => sum + (monthlyNew[m]?.reativados.length || 0), 0);

      return {
        summary: {
          totalClientes,
          clientesCom1Pedido,
          clientesRecorrentes,
          clientesInadimplentes: overdueClients.length,
          totalNovosUltimos3Meses,
          totalReativadosUltimos3Meses,
        },
        clientesNovosPorMes,
        frequencyRanking: frequencyRanking.slice(0, 200),
        overdueClients: overdueClients.slice(0, 200),
      };
    }),

  /**
   * Get available segments for filters
   */
  getClientSegmentOptions: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const prodSegments = await db.select({
      seg: salesOrders.estadoConfiguravel,
    }).from(salesOrders)
      .where(sql`${salesOrders.estadoConfiguravel} IS NOT NULL AND ${salesOrders.estadoConfiguravel} != '' AND ${salesOrders.estadoConfiguravel} != 'NULL'`)
      .groupBy(salesOrders.estadoConfiguravel);
    const clientSegments = await db.select({
      seg: salesOrders.segmento,
    }).from(salesOrders)
      .where(sql`${salesOrders.segmento} IS NOT NULL AND ${salesOrders.segmento} != ''`)
      .groupBy(salesOrders.segmento);
    const allowedProdutoSegmentos = ["MADEIRA", "BAMBU", "FIBRA", "MADEIRA IMPORTADA"];
    return {
      produtoSegmentos: prodSegments.map((s: any) => s.seg).filter((s: any): s is string => typeof s === "string" && allowedProdutoSegmentos.includes(s)),
      clienteSegmentos: clientSegments.map((s: any) => s.seg).filter(Boolean) as string[],
    };
  }),

  // ===== Gestores e Vendedores (direto do Maxiprod) =====
  /**
   * Puxa representantes/vendedores do Maxiprod via GraphQL.
   * Apelido = nome do vendedor de rua
   * representanteOuVendedor1Preferencial = gestor do vendedor
   * Retorna agrupado por gestor, com vendedores que têm gestor vinculado.
   * Cache de 5 minutos para não sobrecarregar a API.
   */
  listRepresentantesMaxiprod: publicProcedure.query(async () => {
    const now = Date.now();
    if (now - representantesCacheTimestamp < REPRESENTANTES_CACHE_TTL && representantesCache) {
      return representantesCache;
    }

    const data = await gql<any>(`{
      empresas(skip: 0, take: 200, where: { representanteOuVendedor: { eq: true } }) {
        totalCount
        items {
          apelido
          nomeFantasia
          razaoSocial
          representanteOuVendedor1Preferencial { nomeFantasia razaoSocial apelido }
        }
      }
    }`);

    if (!data?.empresas) {
      throw new Error("Falha ao buscar representantes do Maxiprod");
    }

    // Processar: agrupar vendedores por gestor
    // Regra:
    // - Apelido == Representante/vendedor → é um GESTOR (registrar como gestor)
    // - Apelido != Representante/vendedor → é SUBORDINADO daquele gestor
    // - Sem Representante/vendedor → ignorar
    const gestoresMap = new Map<string, string[]>();

    for (const emp of data.empresas.items) {
      const apelido = (emp.apelido || emp.nomeFantasia || emp.razaoSocial || "").trim();
      if (!apelido) continue;

      const gestor = emp.representanteOuVendedor1Preferencial;
      const gestorName = (gestor?.apelido || gestor?.nomeFantasia || gestor?.razaoSocial || "").trim();

      // Sem representante/vendedor preenchido → ignorar
      if (!gestorName) continue;

      // Normalizar para comparação (case insensitive)
      const apelidoNorm = apelido.toUpperCase();
      const gestorNorm = gestorName.toUpperCase();

      if (apelidoNorm === gestorNorm) {
        // Apelido == Representante/vendedor → é um GESTOR
        // Garantir que o gestor existe no mapa (mesmo sem subordinados)
        if (!gestoresMap.has(gestorName)) {
          gestoresMap.set(gestorName, []);
        }
      } else {
        // Apelido != Representante/vendedor → é subordinado daquele gestor
        if (!gestoresMap.has(gestorName)) {
          gestoresMap.set(gestorName, []);
        }
        gestoresMap.get(gestorName)!.push(apelido);
      }
    }

    // Montar resultado
    const result = {
      gestores: Array.from(gestoresMap.entries()).map(([gestor, vendedores]) => ({
        gestor,
        vendedores: vendedores.sort((a: string, b: string) => a.localeCompare(b, 'pt-BR')),
      })).sort((a, b) => a.gestor.localeCompare(b.gestor, 'pt-BR')),
      total: data.empresas.totalCount,
    };

    representantesCache = result;
    representantesCacheTimestamp = now;
    return result;
  }),

  // Manter endpoints antigos para compatibilidade (podem ser removidos depois)
  listSalesManagers: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const managers = await db.select().from(salesManagers).orderBy(salesManagers.name);
    return managers;
  }),

  createSalesManager: publicProcedure
    .input(z.object({ name: z.string().min(2) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.insert(salesManagers).values({ name: input.name });
      return { success: true };
    }),

  updateSalesManager: publicProcedure
    .input(z.object({ id: z.number(), name: z.string().min(2).optional(), active: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.active !== undefined) updates.active = input.active;
      if (Object.keys(updates).length > 0) {
        await db.update(salesManagers).set(updates).where(eq(salesManagers.id, input.id));
      }
      return { success: true };
    }),

  deleteSalesManager: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.delete(salesManagers).where(eq(salesManagers.id, input.id));
      return { success: true };
    }),

  // ==========================================
  // PERMISSÕES DE VENDEDORES
  // ==========================================

  /**
   * Listar permissões de todos os vendedores (para o gestor configurar)
   */
  listSellerPermissions: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const perms = await db.select().from(sellerPermissions).orderBy(sellerPermissions.gestorName, sellerPermissions.sellerName);
    return perms;
  }),

  /**
   * Sincronizar vendedores do Maxiprod com a tabela de permissões.
   * Cria registros novos para vendedores que ainda não existem.
   * Senha = primeiro nome com primeira letra maiúscula.
   */
  syncSellerPermissions: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Buscar representantes do Maxiprod
    const data = await gql<any>(`{
      empresas(skip: 0, take: 200, where: { representanteOuVendedor: { eq: true } }) {
        items {
          apelido
          nomeFantasia
          razaoSocial
          representanteOuVendedor1Preferencial { nomeFantasia razaoSocial apelido }
        }
      }
    }`);

    if (!data?.empresas) throw new Error("Falha ao buscar representantes");

    // Identificar vendedores (apelido != gestor)
    const vendedores: { sellerName: string; gestorName: string }[] = [];
    for (const emp of data.empresas.items) {
      const apelido = (emp.apelido || emp.nomeFantasia || emp.razaoSocial || "").trim();
      if (!apelido) continue;
      const gestor = emp.representanteOuVendedor1Preferencial;
      const gestorName = (gestor?.apelido || gestor?.nomeFantasia || gestor?.razaoSocial || "").trim();
      if (!gestorName) continue;
      if (apelido.toUpperCase() === gestorName.toUpperCase()) continue; // é gestor, não vendedor
      vendedores.push({ sellerName: apelido, gestorName });
    }

    // Buscar permissões existentes
    const existing = await db.select().from(sellerPermissions);
    const existingSet = new Set(existing.map(e => `${e.sellerName.toUpperCase()}|${e.gestorName.toUpperCase()}`));

    // Inserir novos vendedores
    let inserted = 0;
    for (const v of vendedores) {
      const key = `${v.sellerName.toUpperCase()}|${v.gestorName.toUpperCase()}`;
      if (existingSet.has(key)) continue;

      // Senha = primeiro nome com primeira letra maiúscula
      const firstName = v.sellerName.split(/\s+/)[0];
      const password = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

      await db.insert(sellerPermissions).values({
        sellerName: v.sellerName,
        gestorName: v.gestorName,
        password,
        authorized: false,
      });
      inserted++;
    }

    return { total: vendedores.length, inserted, existing: existing.length };
  }),

  /**
   * Autorizar/desautorizar vendedor (checkbox do gestor)
   */
  toggleSellerAuthorization: publicProcedure
    .input(z.object({ sellerId: z.number(), authorized: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(sellerPermissions)
        .set({ authorized: input.authorized })
        .where(eq(sellerPermissions.id, input.sellerId));
      return { success: true };
    }),

  /**
   * Listar produtos visíveis de um vendedor
   */
  getSellerProducts: publicProcedure
    .input(z.object({ sellerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const products = await db.select().from(sellerProductVisibility)
        .where(eq(sellerProductVisibility.sellerId, input.sellerId));
      return products;
    }),

  /**
   * Toggle individual product visibility for a seller (used by matrix view)
   */
  toggleSellerProduct: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      productCode: z.string(),
      visible: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      if (input.visible) {
        // Add product visibility
        const existing = await db.select().from(sellerProductVisibility)
          .where(and(
            eq(sellerProductVisibility.sellerId, input.sellerId),
            eq(sellerProductVisibility.productCode, input.productCode)
          ));
        if (existing.length === 0) {
          await db.insert(sellerProductVisibility).values({
            sellerId: input.sellerId,
            productCode: input.productCode,
            visible: true,
          });
        }
      } else {
        // Remove product visibility
        await db.delete(sellerProductVisibility)
          .where(and(
            eq(sellerProductVisibility.sellerId, input.sellerId),
            eq(sellerProductVisibility.productCode, input.productCode)
          ));
      }
      return { success: true };
    }),
  /**
   * Configurar produtos visíveis para um vendedor (bulk update)
   * Recebe lista de productCodes que o vendedor pode ver.
   */
  setSellerProducts: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      productCodes: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Remover permissões antigas
      await db.delete(sellerProductVisibility)
        .where(eq(sellerProductVisibility.sellerId, input.sellerId));

      // Inserir novas
      if (input.productCodes.length > 0) {
        await db.insert(sellerProductVisibility).values(
          input.productCodes.map(code => ({
            sellerId: input.sellerId,
            productCode: code,
            visible: true,
          }))
        );
      }

      return { success: true, count: input.productCodes.length };
    }),

  /**
   * Login do vendedor (app mobile)
   * Verifica senha e se está autorizado pelo gestor.
   */
  sellerLogin: publicProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Buscar vendedor pela senha
      const sellers = await db.select().from(sellerPermissions)
        .where(eq(sellerPermissions.password, input.password));

      if (sellers.length === 0) {
        return { success: false, error: "Senha inválida" };
      }

      const seller = sellers[0];
      if (!seller.authorized) {
        return { success: false, error: "Acesso não autorizado. Aguarde liberação do gestor." };
      }

      // Buscar produtos visíveis
      const products = await db.select().from(sellerProductVisibility)
        .where(eq(sellerProductVisibility.sellerId, seller.id));

      // Buscar catálogos visíveis
      const visibleCatalogs = await db.select().from(sellerCatalogVisibility)
        .where(eq(sellerCatalogVisibility.sellerId, seller.id));
      const catalogIds = visibleCatalogs.map(c => c.catalogId);
      let sellerCatalogs: any[] = [];
      if (catalogIds.length > 0) {
        sellerCatalogs = await db.select().from(catalogs)
          .where(and(eq(catalogs.active, true), inArray(catalogs.id, catalogIds)));
      }

      return {
        success: true,
        seller: {
          id: seller.id,
          name: seller.sellerName,
          gestor: seller.gestorName,
        },
        visibleProducts: products.map(p => p.productCode),
        catalogs: sellerCatalogs.map(c => ({ id: c.id, name: c.name, folder: c.folder, url: c.url })),
      };
    }),

  // ===== CATALOG / PDF MANAGEMENT =====

  /** List all catalogs (for gestor) */
  listCatalogs: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    return db.select().from(catalogs).where(eq(catalogs.active, true));
  }),

  /** List distinct folders */
  listCatalogFolders: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const rows = await db.selectDistinct({ folder: catalogs.folder }).from(catalogs).where(eq(catalogs.active, true));
    return rows.map(r => r.folder);
  }),

  /** Upload a new PDF catalog */
  uploadCatalog: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      folder: z.string().default("Catálogos"),
      fileBase64: z.string(), // base64-encoded PDF
      fileName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const { storagePut } = await import("./storage");
      const buffer = Buffer.from(input.fileBase64, "base64");
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const fileKey = `catalogs/${input.folder}/${input.fileName.replace(/\.pdf$/i, '')}-${randomSuffix}.pdf`;
      const { url } = await storagePut(fileKey, buffer, "application/pdf");
      const result = await db.insert(catalogs).values({
        name: input.name,
        folder: input.folder,
        url,
        active: true,
      });
      return { success: true, id: Number(result[0].insertId), url };
    }),

  /** Delete (deactivate) a catalog */
  deleteCatalog: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(catalogs).set({ active: false }).where(eq(catalogs.id, input.id));
      return { success: true };
    }),

  /** Get catalog visibility for a specific seller */
  getSellerCatalogs: publicProcedure
    .input(z.object({ sellerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const rows = await db.select().from(sellerCatalogVisibility)
        .where(eq(sellerCatalogVisibility.sellerId, input.sellerId));
      return rows.map(r => r.catalogId);
    }),

  /** Set catalog visibility for a seller (replace all) */
  setSellerCatalogs: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      catalogIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      // Remove old
      await db.delete(sellerCatalogVisibility)
        .where(eq(sellerCatalogVisibility.sellerId, input.sellerId));
      // Insert new
      if (input.catalogIds.length > 0) {
        await db.insert(sellerCatalogVisibility).values(
          input.catalogIds.map(catalogId => ({
            sellerId: input.sellerId,
            catalogId,
          }))
        );
      }
      return { success: true };
    }),

  // ============================================================
  // RESERVAS DE ESTOQUE
  // ============================================================

  /**
   * Listar reservas ativas de um vendedor
   */
  listReservations: publicProcedure
    .input(z.object({ sellerId: z.number().optional(), codigoItem: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      let conditions: any[] = [eq(stockReservations.status, "ativa")];
      if (input.sellerId) {
        conditions.push(eq(stockReservations.sellerId, input.sellerId));
      }
      if (input.codigoItem) {
        conditions.push(eq(stockReservations.codigoItem, input.codigoItem));
      }
      
      const rows = await db.select().from(stockReservations)
        .where(and(...conditions))
        .orderBy(desc(stockReservations.createdAt));
      return rows;
    }),

  /**
   * Criar uma reserva de estoque
   */
  createReservation: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      sellerName: z.string(),
      codigoItem: z.string(),
      descricaoItem: z.string(),
      quantidadeCx: z.number().min(1),
      clienteNome: z.string().min(1),
      clienteCnpj: z.string().optional(),
      fonte: z.enum(["estoque", "po"]),
      poReferencia: z.string().optional(),
      poDataEntrega: z.string().optional(),
      observacao: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      
      await db.insert(stockReservations).values({
        sellerId: input.sellerId,
        sellerName: input.sellerName,
        codigoItem: input.codigoItem,
        descricaoItem: input.descricaoItem,
        quantidadeCx: input.quantidadeCx,
        clienteNome: input.clienteNome,
        clienteCnpj: input.clienteCnpj || null,
        fonte: input.fonte,
        poReferencia: input.poReferencia || null,
        poDataEntrega: input.poDataEntrega || null,
        observacao: input.observacao || null,
      });
      return { success: true };
    }),

  /**
   * Cancelar uma reserva
   */
  cancelReservation: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      
      await db.update(stockReservations)
        .set({ status: "cancelada" })
        .where(eq(stockReservations.id, input.id));
      return { success: true };
    }),

  /**
   * Obter total de reservas ativas por produto (para mostrar no estoque)
   */
  getReservationSummary: publicProcedure
    .input(z.object({ productCodes: z.array(z.string()) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return {};
      if (input.productCodes.length === 0) return {};
      
      const rows = await db.select({
        codigoItem: stockReservations.codigoItem,
        totalCx: sql<number>`SUM(${stockReservations.quantidadeCx})`,
      })
        .from(stockReservations)
        .where(and(
          eq(stockReservations.status, "ativa"),
          inArray(stockReservations.codigoItem, input.productCodes)
        ))
        .groupBy(stockReservations.codigoItem);
      
      const summary: Record<string, number> = {};
      for (const row of rows) {
        if (row.codigoItem) summary[row.codigoItem] = Number(row.totalCx) || 0;
      }
      return summary;
    }),

  // ============================================================
  // VENDOR CLIENTS - Cadastro manual de clientes pelo vendedor/gestor
  // ============================================================

  /**
   * Create a new client for a vendor
   */
  createVendorClient: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      sellerName: z.string(),
      cnpjCpf: z.string().min(11).max(18),
      razaoSocial: z.string().max(300),
      nomeFantasia: z.string().max(300).optional(),
      inscricaoEstadual: z.string().max(30).optional(),
      cep: z.string().max(10).optional(),
      logradouro: z.string().max(300).optional(),
      numero: z.string().max(20).optional(),
      complemento: z.string().max(200).optional(),
      bairro: z.string().max(200).optional(),
      cidade: z.string().max(200).optional(),
      uf: z.string().max(2).optional(),
      telefone1: z.string().max(30).optional(),
      telefone2: z.string().max(30).optional(),
      email: z.string().max(300).optional(),
      nomeContato: z.string().max(200).optional(),
      segmento: z.string().max(100).optional(),
      observacoes: z.string().optional(),
      tipoContribuinte: z.string().max(30).optional(),
      // Dados fiscais
      regimeTributario: z.string().max(50).optional(),
      inscricaoMunicipal: z.string().max(30).optional(),
      inscricaoSuframa: z.string().max(30).optional(),
      situacaoFiscalEspecial: z.string().max(100).optional(),
      cnaeFiscal: z.string().max(20).optional(),
      emailNfe: z.string().max(300).optional(),
      website: z.string().max(300).optional(),
      // Dados de venda
      limiteCredito: z.string().max(30).optional(),
      formaCobranca: z.string().max(200).optional(),
      tabelaPrecos: z.string().max(200).optional(),
      condicaoPagamento: z.string().max(200).optional(),
      // CRM
      regiao: z.string().max(100).optional(),
      perfil: z.string().max(100).optional(),
      formaPedido: z.string().max(100).optional(),
      produtos: z.string().optional(),
      probabilidadeNegocio: z.string().max(50).optional(),
      tamanho: z.string().max(50).optional(),
      atencao: z.string().max(50).optional(),
      fornecedorAtual: z.string().max(200).optional(),
      // Cobrança
      situacaoCobranca: z.string().max(30).optional(),
      // Redespacho
      possuiRedespacho: z.boolean().optional(),
      redespachoCep: z.string().max(10).optional(),
      redespachoLogradouro: z.string().max(300).optional(),
      redespachoNumero: z.string().max(20).optional(),
      redespachoComplemento: z.string().max(200).optional(),
      redespachoBairro: z.string().max(200).optional(),
      redespachoCidade: z.string().max(200).optional(),
      redespachoUf: z.string().max(2).optional(),
      redespachoTelefone: z.string().max(30).optional(),
      redespachoCnpj: z.string().max(20).optional(),
      redespachoRazaoSocial: z.string().max(200).optional(),
      enderecoEntregaMesmo: z.boolean().optional(),
      entregaCep: z.string().max(10).optional(),
      entregaLogradouro: z.string().max(300).optional(),
      entregaNumero: z.string().max(20).optional(),
      entregaComplemento: z.string().max(200).optional(),
      entregaBairro: z.string().max(200).optional(),
      entregaCidade: z.string().max(200).optional(),
      entregaUf: z.string().max(2).optional(),
      entregaTelefone: z.string().max(30).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Validação: CNPJ/CPF não pode ser duplicado
      const cnpjLimpo = input.cnpjCpf.replace(/[^\d]/g, "");
      const [existing] = await db.select({
        id: vendorClients.id,
        razaoSocial: vendorClients.razaoSocial,
        cnpjCpf: vendorClients.cnpjCpf,
        sellerName: vendorClients.sellerName,
      }).from(vendorClients)
        .where(sql`REPLACE(REPLACE(REPLACE(${vendorClients.cnpjCpf}, '.', ''), '-', ''), '/', '') = ${cnpjLimpo}`)
        .limit(1);

      if (existing) {
        // Buscar dados completos do cliente existente para pré-preencher o formulário de edição
        const [fullExisting] = await db.select().from(vendorClients)
          .where(eq(vendorClients.id, existing.id))
          .limit(1);
        
        throw new TRPCError({
          code: "CONFLICT",
          message: JSON.stringify({
            type: "CNPJ_DUPLICATE",
            clientId: existing.id,
            razaoSocial: existing.razaoSocial,
            sellerName: existing.sellerName,
            existingClient: fullExisting || null,
          }),
        });
      }

      const result = await db.insert(vendorClients).values({
        sellerId: input.sellerId,
        sellerName: input.sellerName,
        cnpjCpf: input.cnpjCpf,
        razaoSocial: input.razaoSocial,
        nomeFantasia: input.nomeFantasia || null,
        inscricaoEstadual: input.inscricaoEstadual || null,
        tipoContribuinte: input.tipoContribuinte || null,
        regimeTributario: input.regimeTributario || null,
        inscricaoMunicipal: input.inscricaoMunicipal || null,
        inscricaoSuframa: input.inscricaoSuframa || null,
        situacaoFiscalEspecial: input.situacaoFiscalEspecial || null,
        cnaeFiscal: input.cnaeFiscal || null,
        emailNfe: input.emailNfe || null,
        website: input.website || null,
        limiteCredito: (() => {
          if (!input.limiteCredito) return null;
          const raw = input.limiteCredito.replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').trim();
          const parsed = parseFloat(raw);
          return isNaN(parsed) ? null : parsed.toFixed(2);
        })(),
        formaCobranca: input.formaCobranca || null,
        tabelaPrecos: input.tabelaPrecos || null,
        condicaoPagamento: input.condicaoPagamento || null,
        regiao: input.regiao || null,
        perfil: input.perfil || null,
        formaPedido: input.formaPedido || null,
        produtos: input.produtos || null,
        probabilidadeNegocio: input.probabilidadeNegocio || null,
        tamanho: input.tamanho || null,
        atencao: input.atencao || null,
        fornecedorAtual: input.fornecedorAtual || null,
        situacaoCobranca: input.situacaoCobranca || null,
        cep: input.cep || null,
        logradouro: input.logradouro || null,
        numero: input.numero || null,
        complemento: input.complemento || null,
        bairro: input.bairro || null,
        cidade: input.cidade || null,
        uf: input.uf || null,
        telefone1: input.telefone1 || null,
        telefone2: input.telefone2 || null,
        email: input.email || null,
        nomeContato: input.nomeContato || null,
        segmento: input.segmento || null,
        observacoes: input.observacoes || null,
        possuiRedespacho: input.possuiRedespacho ? 1 : 0,
        redespachoCep: input.redespachoCep || null,
        redespachoLogradouro: input.redespachoLogradouro || null,
        redespachoNumero: input.redespachoNumero || null,
        redespachoComplemento: input.redespachoComplemento || null,
        redespachoBairro: input.redespachoBairro || null,
        redespachoCidade: input.redespachoCidade || null,
        redespachoUf: input.redespachoUf || null,
        redespachoTelefone: input.redespachoTelefone || null,
        redespachoCnpj: input.redespachoCnpj || null,
        redespachoRazaoSocial: input.redespachoRazaoSocial || null,
        enderecoEntregaMesmo: input.enderecoEntregaMesmo === false ? 0 : 1,
        entregaCep: input.entregaCep || null,
        entregaLogradouro: input.entregaLogradouro || null,
        entregaNumero: input.entregaNumero || null,
        entregaComplemento: input.entregaComplemento || null,
        entregaBairro: input.entregaBairro || null,
        entregaCidade: input.entregaCidade || null,
        entregaUf: input.entregaUf || null,
        entregaTelefone: input.entregaTelefone || null,
      });

      return { success: true, id: result[0].insertId };
    }),

  /**
   * List all manually registered clients for a vendor
   */
  listVendorClients: publicProcedure
    .input(z.object({
      sellerId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const clients = await db.select().from(vendorClients)
        .where(eq(vendorClients.sellerId, input.sellerId))
        .orderBy(desc(vendorClients.createdAt));

      return clients;
    }),

  /**
   * Update an existing vendor client
   */
  updateVendorClient: publicProcedure
    .input(z.object({
      id: z.number(),
      sellerName: z.string().optional(), // Quem está fazendo a alteração
      cnpjCpf: z.string().min(11).max(18).optional(),
      razaoSocial: z.string().max(300).optional(),
      nomeFantasia: z.string().max(300).optional(),
      inscricaoEstadual: z.string().max(30).optional(),
      tipoContribuinte: z.string().max(30).optional(),
      // Dados fiscais
      regimeTributario: z.string().max(50).optional(),
      inscricaoMunicipal: z.string().max(30).optional(),
      inscricaoSuframa: z.string().max(30).optional(),
      situacaoFiscalEspecial: z.string().max(100).optional(),
      cnaeFiscal: z.string().max(20).optional(),
      emailNfe: z.string().max(300).optional(),
      website: z.string().max(300).optional(),
      // Dados de venda
      limiteCredito: z.string().max(30).optional(),
      formaCobranca: z.string().max(200).optional(),
      tabelaPrecos: z.string().max(200).optional(),
      condicaoPagamento: z.string().max(200).optional(),
      // CRM
      regiao: z.string().max(100).optional(),
      perfil: z.string().max(100).optional(),
      formaPedido: z.string().max(100).optional(),
      produtos: z.string().optional(),
      probabilidadeNegocio: z.string().max(50).optional(),
      tamanho: z.string().max(50).optional(),
      atencao: z.string().max(50).optional(),
      fornecedorAtual: z.string().max(200).optional(),
      // Cobrança
      situacaoCobranca: z.string().max(30).optional(),
      // Endereço
      cep: z.string().max(10).optional(),
      logradouro: z.string().max(300).optional(),
      numero: z.string().max(20).optional(),
      complemento: z.string().max(200).optional(),
      bairro: z.string().max(200).optional(),
      cidade: z.string().max(200).optional(),
      uf: z.string().max(2).optional(),
      // Contato
      telefone1: z.string().max(30).optional(),
      telefone2: z.string().max(30).optional(),
      email: z.string().max(300).optional(),
      nomeContato: z.string().max(200).optional(),
      segmento: z.string().max(100).optional(),
      observacoes: z.string().optional(),
      // Redespacho
      possuiRedespacho: z.boolean().optional(),
      redespachoCep: z.string().max(10).optional(),
      redespachoLogradouro: z.string().max(300).optional(),
      redespachoNumero: z.string().max(20).optional(),
      redespachoComplemento: z.string().max(200).optional(),
      redespachoBairro: z.string().max(200).optional(),
      redespachoCidade: z.string().max(200).optional(),
      redespachoUf: z.string().max(2).optional(),
      redespachoTelefone: z.string().max(30).optional(),
      redespachoCnpj: z.string().max(20).optional(),
      redespachoRazaoSocial: z.string().max(200).optional(),
      enderecoEntregaMesmo: z.boolean().optional(),
      entregaCep: z.string().max(10).optional(),
      entregaLogradouro: z.string().max(300).optional(),
      entregaNumero: z.string().max(20).optional(),
      entregaComplemento: z.string().max(200).optional(),
      entregaBairro: z.string().max(200).optional(),
      entregaCidade: z.string().max(200).optional(),
      entregaUf: z.string().max(2).optional(),
      entregaTelefone: z.string().max(30).optional(),
    }))
        .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, sellerName, possuiRedespacho, enderecoEntregaMesmo, ...updateData } = input;
      // Remove undefined fields - keep empty strings as empty strings (don't convert to null)
      // This prevents wiping existing data when a field is intentionally left empty vs not sent
      const cleanData: Record<string, any> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          // Keep empty strings as empty strings, only convert null/undefined to null
          cleanData[key] = value === '' ? '' : (value ?? null);
        }
      }
      
      // Sanitize limiteCredito: convert formatted Brazilian currency to decimal
      // e.g. "R$ 20.000,00" -> "20000.00", "20.000,00" -> "20000.00"
      if (cleanData.limiteCredito && typeof cleanData.limiteCredito === 'string') {
        const raw = cleanData.limiteCredito
          .replace(/R\$\s*/gi, '') // Remove R$ prefix
          .replace(/\./g, '')       // Remove thousand separators (dots)
          .replace(',', '.')         // Convert decimal comma to dot
          .trim();
        // If it's a valid number, store it; otherwise store null
        const parsed = parseFloat(raw);
        cleanData.limiteCredito = isNaN(parsed) ? null : parsed.toFixed(2);
      }
      
      // Handle possuiRedespacho boolean -> tinyint
      if (possuiRedespacho !== undefined) {
        cleanData.possuiRedespacho = possuiRedespacho ? 1 : 0;
      }
      // Handle enderecoEntregaMesmo boolean -> tinyint
      if (enderecoEntregaMesmo !== undefined) {
        cleanData.enderecoEntregaMesmo = enderecoEntregaMesmo ? 1 : 0;
      }
      // Track who modified
      if (sellerName) {
        cleanData.lastModifiedBy = sellerName;
      }
      if (Object.keys(cleanData).length > 0) {
        await db.update(vendorClients).set(cleanData).where(eq(vendorClients.id, id));
      }
      return { success: true };
    }),

  /**
   * Delete a vendor client
   */
  deleteVendorClient: publicProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(vendorClients).where(eq(vendorClients.id, input.id));
      return { success: true };
    }),

  // ============================================================
  // TABELA DE PREÇOS - Dados sincronizados do Maxiprod
  // ============================================================

  /**
   * Listar todas as tabelas de preço disponíveis
   */
  listPriceTables: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    return await db.select().from(priceTables);
  }),

  /**
   * Obter itens de uma tabela de preço específica (por vendedor)
   * Retorna produtos com preço, desconto máximo e preço mínimo calculado
   */
  getPriceTableItems: publicProcedure
    .input(z.object({
      sellerId: z.number().optional(),
      priceTableId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // If sellerId is provided, find the matching price table
      let tableId = input.priceTableId;
      
      if (input.sellerId && !tableId) {
        // Get seller info
        const sellers = await db.select().from(sellerPermissions)
          .where(eq(sellerPermissions.id, input.sellerId));
        if (sellers.length === 0) return { items: [], priceTable: null };
        
        const seller = sellers[0];
        const allTables = await db.select().from(priceTables);
        
        // 1. Try direct mapping via priceTableCode field
        let matchedTable = seller.priceTableCode
          ? allTables.find(t => t.codigo === seller.priceTableCode)
          : null;
        
        // 2. Fallback: match by seller name in table description
        if (!matchedTable) {
          const nameParts = seller.sellerName.toUpperCase().split(' ');
          matchedTable = allTables.find(t => {
            const desc = t.descricao.toUpperCase();
            return nameParts.some(part => part.length > 3 && desc.includes(part));
          });
        }
        
        if (!matchedTable) return { items: [], priceTable: null };
        tableId = matchedTable.id;
      }

      if (!tableId) return { items: [], priceTable: null };

      const table = await db.select().from(priceTables)
        .where(eq(priceTables.id, tableId));
      
      const items = await db.select().from(priceTableItems)
        .where(eq(priceTableItems.priceTableId, tableId));

      // Calculate preço mínimo for each item
      const itemsWithMinPrice = items.map(item => {
        const preco = parseFloat(item.preco);
        const descontoMax = item.descontoMaximoEmPercentual ? parseFloat(item.descontoMaximoEmPercentual) : 0;
        const precoMinimo = preco * (1 - descontoMax / 100);
        return {
          ...item,
          precoMinimo: precoMinimo.toFixed(2),
        };
      });

      return {
        items: itemsWithMinPrice,
        priceTable: table[0] || null,
      };
    }),

  /**
   * Trigger manual sync of price tables from Maxiprod
   */
  syncPriceTables: publicProcedure.mutation(async () => {
    const { syncPriceTables } = await import("./priceTableSync");
    const result = await syncPriceTables();
    return { success: true, ...result };
  }),

  /**
   * Matriz de estoque: produtos (linhas) x vendedores (colunas)
   * Retorna ✓ se o produto está na tabela de preços do vendedor
   * Usado no painel do gestor para visão ampla de quais produtos cada vendedor pode vender
   */
  getEstoqueMatrix: publicProcedure
    .input(z.object({ gestorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      // 1. Get all sellers for this gestor (including sub-gestor's sellers)
      const directSellers = await db.select().from(sellerPermissions)
        .where(eq(sellerPermissions.gestorName, input.gestorName));
      const subGestorNames = directSellers.map(s => s.sellerName);
      const subGestorSellers = subGestorNames.length > 0
        ? await db.select().from(sellerPermissions)
            .where(inArray(sellerPermissions.gestorName, subGestorNames))
        : [];
      const seenIds = new Set(directSellers.map(s => s.id));
      const sellers = [...directSellers];
      for (const sub of subGestorSellers) {
        if (!seenIds.has(sub.id)) {
          seenIds.add(sub.id);
          sellers.push(sub);
        }
      }
      // 2. Get all price tables
      const allTables = await db.select().from(priceTables);
      // 3. Get all price table items
      const allItems = await db.select({
        itemCodigo: priceTableItems.itemCodigo,
        itemDescricao: priceTableItems.itemDescricao,
        priceTableId: priceTableItems.priceTableId,
      }).from(priceTableItems);
      // 4. Match each seller to their price table
      const sellerTableMap: { sellerId: number; sellerName: string; priceTableId: number | null }[] = sellers.map(seller => {
        // Try direct mapping via priceTableCode
        let matchedTable = seller.priceTableCode
          ? allTables.find(t => t.codigo === seller.priceTableCode)
          : null;
        // Fallback: match by seller name in table description
        if (!matchedTable) {
          const nameParts = seller.sellerName.toUpperCase().split(' ');
          matchedTable = allTables.find(t => {
            const desc = t.descricao.toUpperCase();
            return nameParts.some(part => part.length > 3 && desc.includes(part));
          });
        }
        return {
          sellerId: seller.id,
          sellerName: seller.sellerName,
          priceTableId: matchedTable?.id || null,
        };
      });
      // 5. Get all stock products from dashboard_data (only madeira and bambu, parent only)
      const dashData = await db.select().from(dashboardData).limit(1);
      // Also get product classifications to separate bambu estoque vs encomenda
      const classifications = await db.select().from(productClassification);
      const classMap = new Map(classifications.map(c => [c.codigoItem, c.classification]));
      let stockProducts: { codigoItem: string; descricaoItem: string; segmento: string; classification: string }[] = [];
      if (dashData.length > 0) {
        try {
          const items = JSON.parse(dashData[0].dataJson as string);
          // Filter: only madeira (industrializacao + subgrupo=madeira) and bambu (importacao_revenda + subgrupo=bambu)
          // Only parent products (not children/variants)
          const filtered = items.filter((item: any) => {
            if (item.isChild === true) return false; // exclude variants
            if (item.grupo === "industrializacao" && item.subgrupo === "madeira") return true;
            if (item.grupo === "importacao_revenda" && item.subgrupo === "bambu") return true;
            return false;
          });
          stockProducts = filtered.map((item: any) => {
            const isBambu = item.grupo === "importacao_revenda" && item.subgrupo === "bambu";
            const cls = classMap.get(item.codigoItem) || "estoque";
            return {
              codigoItem: item.codigoItem,
              descricaoItem: item.descricaoItem,
              segmento: isBambu ? "bambu" : "madeira",
              classification: isBambu ? cls : "madeira", // madeira doesn't use classification
            };
          });
        } catch { stockProducts = []; }
      }
      // 6. Get manual overrides from seller_product_visibility
      const manualOverrides = await db.select().from(sellerProductVisibility);
      const overrideMap = new Map<string, Set<string>>(); // sellerId -> Set<productCode>
      for (const ov of manualOverrides) {
        const key = String(ov.sellerId);
        if (!overrideMap.has(key)) overrideMap.set(key, new Set());
        overrideMap.get(key)!.add(ov.productCode);
      }
      // 7. Build the matrix: for each product, check which sellers have it in their price table
      const itemsByTable = new Map<number, Set<string>>();
      for (const item of allItems) {
        if (!itemsByTable.has(item.priceTableId)) {
          itemsByTable.set(item.priceTableId, new Set());
        }
        itemsByTable.get(item.priceTableId)!.add(item.itemCodigo);
      }
      // Note: we only show products that are in the stock (madeira + bambu)
      // Price table items not in stock are not shown in this matrix
      // Build matrix rows
      const matrix = stockProducts.map(product => {
        const row: Record<string, boolean> = {};
        for (const st of sellerTableMap) {
          // Check price table first
          let fromPriceTable = false;
          if (st.priceTableId) {
            const tableItems = itemsByTable.get(st.priceTableId);
            fromPriceTable = tableItems?.has(product.codigoItem) || false;
          }
          // Check manual override
          const manualSet = overrideMap.get(String(st.sellerId));
          const hasManualOverride = manualSet?.has(product.codigoItem) || false;
          // Product is visible if either in price table OR manually added
          row[st.sellerName] = fromPriceTable || hasManualOverride;
        }
        return {
          codigoItem: product.codigoItem,
          descricaoItem: product.descricaoItem,
          segmento: product.segmento,
          classification: product.classification,
          sellers: row,
        };
      });
      return {
        sellers: sellerTableMap.map(s => ({ id: s.sellerId, name: s.sellerName, hasTable: !!s.priceTableId })),
        products: matrix,
      };
    }),

  /**
   * Matriz de tabela de preços: produtos (linhas) x vendedores (colunas)
   * Retorna o preço de cada produto para cada vendedor
   * Usado no painel do gestor para visão ampla dos preços
   */
  getPriceMatrix: publicProcedure
    .input(z.object({ gestorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      // 1. Get all sellers for this gestor (including sub-gestor's sellers)
      const directSellers = await db.select().from(sellerPermissions)
        .where(eq(sellerPermissions.gestorName, input.gestorName));
      // Also get sellers managed by sub-gestors (e.g., Rafael under Renato, visible to Juvenal)
      const subGestorNames = directSellers.map(s => s.sellerName);
      const subGestorSellers = subGestorNames.length > 0
        ? await db.select().from(sellerPermissions)
            .where(inArray(sellerPermissions.gestorName, subGestorNames))
        : [];
      // Merge: direct sellers + sub-gestor's sellers (avoid duplicates)
      const seenIds = new Set(directSellers.map(s => s.id));
      const sellers = [...directSellers];
      for (const sub of subGestorSellers) {
        if (!seenIds.has(sub.id)) {
          seenIds.add(sub.id);
          sellers.push(sub);
        }
      }
      // 2. Get all price tables
      const allTables = await db.select().from(priceTables);
      // 3. Get all price table items with prices
      const allItems = await db.select({
        itemCodigo: priceTableItems.itemCodigo,
        itemDescricao: priceTableItems.itemDescricao,
        priceTableId: priceTableItems.priceTableId,
        preco: priceTableItems.preco,
        descontoMaximoEmPercentual: priceTableItems.descontoMaximoEmPercentual,
      }).from(priceTableItems);
      // 4. Match each seller to their price table
      const sellerTableMap = sellers.map(seller => {
        let matchedTable = seller.priceTableCode
          ? allTables.find(t => t.codigo === seller.priceTableCode)
          : null;
        if (!matchedTable) {
          const nameParts = seller.sellerName.toUpperCase().split(' ');
          matchedTable = allTables.find(t => {
            const desc = t.descricao.toUpperCase();
            return nameParts.some(part => part.length > 3 && desc.includes(part));
          });
        }
        return {
          sellerId: seller.id,
          sellerName: seller.sellerName,
          priceTableId: matchedTable?.id || null,
        };
      });
      // 5. Get stock products (same as estoque matrix)
      const dashData = await db.select().from(dashboardData).limit(1);
      const classifications = await db.select().from(productClassification);
      const classMap = new Map(classifications.map(c => [c.codigoItem, c.classification]));
      let stockProducts: { codigoItem: string; descricaoItem: string; segmento: string }[] = [];
      if (dashData.length > 0) {
        try {
          const items = JSON.parse(dashData[0].dataJson as string);
          const filtered = items.filter((item: any) => {
            if (item.isChild === true) return false;
            if (item.grupo === "industrializacao" && item.subgrupo === "madeira") return true;
            if (item.grupo === "importacao_revenda" && item.subgrupo === "bambu") return true;
            return false;
          });
          stockProducts = filtered.map((item: any) => {
            const isBambu = item.grupo === "importacao_revenda" && item.subgrupo === "bambu";
            return {
              codigoItem: item.codigoItem,
              descricaoItem: item.descricaoItem,
              segmento: isBambu ? "bambu" : "madeira",
            };
          });
        } catch { stockProducts = []; }
      }
      // 6. Build price lookup: priceTableId -> itemCodigo -> { preco, descontoMax }
      const priceByTable = new Map<number, Map<string, { preco: string; descontoMax: string | null }>>();
      for (const item of allItems) {
        if (!priceByTable.has(item.priceTableId)) {
          priceByTable.set(item.priceTableId, new Map());
        }
        priceByTable.get(item.priceTableId)!.set(item.itemCodigo, {
          preco: item.preco,
          descontoMax: item.descontoMaximoEmPercentual,
        });
      }
      // 7. Build matrix rows with prices
      const matrix = stockProducts.map(product => {
        const row: Record<string, { preco: string | null; descontoMax: string | null }> = {};
        for (const st of sellerTableMap) {
          if (st.priceTableId) {
            const tableItems = priceByTable.get(st.priceTableId);
            const item = tableItems?.get(product.codigoItem);
            row[st.sellerName] = item ? { preco: item.preco, descontoMax: item.descontoMax } : { preco: null, descontoMax: null };
          } else {
            row[st.sellerName] = { preco: null, descontoMax: null };
          }
        }
        return {
          codigoItem: product.codigoItem,
          descricaoItem: product.descricaoItem,
          segmento: product.segmento,
          sellers: row,
        };
      });
      return {
        sellers: sellerTableMap.map(s => ({ id: s.sellerId, name: s.sellerName, hasTable: !!s.priceTableId })),
        products: matrix,
      };
    }),
  /**
   * Salvar porcentagens dos níveis de preço (5 abas editáveis)
   * Preço Mostrado (0%), Preço Alto (20%), Preço Médio-Alto (23%), Preço Médio (27%), Preço Baixo (32%)
   */
  savePriceTierDiscounts: publicProcedure
    .input(z.object({
      gestorName: z.string(),
      tiers: z.object({
        alto: z.number().min(0).max(100),
        medioAlto: z.number().min(0).max(100),
        medio: z.number().min(0).max(100),
        baixo: z.number().min(0).max(100),
      }),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const key = `price_tier_discounts_${input.gestorName}`;
      const value = JSON.stringify(input.tiers);
      const existing = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
      if (existing.length > 0) {
        await db.update(appSettings).set({ settingValue: value }).where(eq(appSettings.settingKey, key));
      } else {
        await db.insert(appSettings).values({ settingKey: key, settingValue: value });
      }
      return { success: true };
    }),
  /**
   * Carregar porcentagens dos níveis de preço
   */
  getPriceTierDiscounts: publicProcedure
    .input(z.object({ gestorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const key = `price_tier_discounts_${input.gestorName}`;
      const row = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
      if (row.length > 0 && row[0].settingValue) {
        return { tiers: JSON.parse(row[0].settingValue as string) as { alto: number; medioAlto: number; medio: number; baixo: number } };
      }
      // Defaults
      return { tiers: { alto: 20, medioAlto: 23, medio: 27, baixo: 32 } };
    }),
  /**
   * Salvar desconto máximo configurado pelo gestor (persiste no banco)
   */
  saveMaxDiscount: publicProcedure
    .input(z.object({ gestorName: z.string(), discount: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const key = `max_discount_${input.gestorName}`;
      const existing = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
      if (existing.length > 0) {
        await db.update(appSettings).set({ settingValue: JSON.stringify(input.discount) }).where(eq(appSettings.settingKey, key));
      } else {
        await db.insert(appSettings).values({ settingKey: key, settingValue: JSON.stringify(input.discount) });
      }
      return { success: true };
    }),
  /**
   * Carregar desconto máximo configurado pelo gestor
   */
  getMaxDiscount: publicProcedure
    .input(z.object({ gestorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const key = `max_discount_${input.gestorName}`;
      const row = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
      if (row.length > 0 && row[0].settingValue) {
        return { discount: JSON.parse(row[0].settingValue as string) as string };
      }
      return { discount: null };
    }),
  /**
   * Salvar margem de negociação configurada pelo gestor
   */
  saveMargemNegociacao: publicProcedure
    .input(z.object({ gestorName: z.string(), margem: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const key = `margem_negociacao_${input.gestorName}`;
      const existing = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
      if (existing.length > 0) {
        await db.update(appSettings).set({ settingValue: JSON.stringify(input.margem) }).where(eq(appSettings.settingKey, key));
      } else {
        await db.insert(appSettings).values({ settingKey: key, settingValue: JSON.stringify(input.margem) });
      }
      return { success: true };
    }),
  /**
   * Carregar margem de negociação configurada pelo gestor
   */
  getMargemNegociacao: publicProcedure
    .input(z.object({ gestorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const key = `margem_negociacao_${input.gestorName}`;
      const row = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
      if (row.length > 0 && row[0].settingValue) {
        return { margem: JSON.parse(row[0].settingValue as string) as string };
      }
      return { margem: null };
    }),
  /**
   * Matriz de catálogos por vendedor (gestor)
   */
  getCatalogMatrix: publicProcedure
    .input(z.object({ gestorName: z.string(), parentId: z.number().nullable().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      // Get sellers for this gestor
      const allPerms = await db.select().from(sellerPermissions);
      const sellersList = allPerms.filter(p => p.gestorName === input.gestorName);
      // Get active items at this level (parentId)
      const parentId = input.parentId ?? null;
      const allCatalogs = await db.select().from(catalogs).where(eq(catalogs.active, true));
      const levelItems = allCatalogs.filter(c => {
        if (parentId === null) return c.parentId === null || c.parentId === undefined;
        return c.parentId === parentId;
      });
      // Separate folders and files
      const folders = levelItems.filter(c => c.isFolder);
      const files = levelItems.filter(c => !c.isFolder);
      // Get all visibility records for these sellers
      const sellerIds = sellersList.map(s => s.id);
      let visibilityRows: any[] = [];
      if (sellerIds.length > 0) {
        visibilityRows = await db.select().from(sellerCatalogVisibility)
          .where(inArray(sellerCatalogVisibility.sellerId, sellerIds));
      }
      // Build visibility map: sellerId -> Set of catalogIds
      const visMap = new Map<number, Set<number>>();
      for (const row of visibilityRows) {
        if (!visMap.has(row.sellerId)) visMap.set(row.sellerId, new Set());
        visMap.get(row.sellerId)!.add(row.catalogId);
      }
      // Get current folder info if navigating inside a folder
      let currentFolder: { id: number; name: string } | null = null;
      if (parentId !== null) {
        const folder = allCatalogs.find(c => c.id === parentId);
        if (folder) currentFolder = { id: folder.id, name: folder.name };
      }
      return {
        currentFolder,
        sellers: sellersList.map(s => ({ id: s.id, name: s.sellerName })),
        folders: folders.map(f => ({
          id: f.id,
          name: f.name,
          itemCount: allCatalogs.filter(c => c.parentId === f.id && c.active).length,
        })),
        files: files.map(c => ({
          id: c.id,
          name: c.name,
          url: c.url,
          mimeType: c.mimeType,
          fileSize: c.fileSize,
          visibility: sellersList.map(s => ({
            sellerId: s.id,
            visible: visMap.get(s.id)?.has(c.id) || false,
          })),
        })),
      };
    }),
  /**
   * Create a folder in the catalog system
   */
  createCatalogFolder: publicProcedure
    .input(z.object({ name: z.string().min(1), parentId: z.number().nullable().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const result = await db.insert(catalogs).values({
        name: input.name,
        parentId: input.parentId ?? null,
        isFolder: true,
        url: "",
        active: true,
      });
      return { success: true, id: Number(result[0].insertId) };
    }),
  /**
   * Upload a file to the catalog system
   */
  uploadCatalogFile: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      parentId: z.number().nullable().optional(),
      fileData: z.string(), // base64 encoded file data
      mimeType: z.string(),
      fileSize: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      // Upload to S3
      const buffer = Buffer.from(input.fileData, "base64");
      const ext = input.name.split(".").pop() || "bin";
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const fileKey = `catalogs/${Date.now()}-${randomSuffix}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      // Save to DB
      const result = await db.insert(catalogs).values({
        name: input.name,
        parentId: input.parentId ?? null,
        isFolder: false,
        url,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        active: true,
      });
      return { success: true, id: Number(result[0].insertId), url };
    }),
  /**
   * Delete a catalog item (file or folder)
   */
  deleteCatalogItem: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      // Soft delete (set active = false)
      await db.update(catalogs)
        .set({ active: false })
        .where(eq(catalogs.id, input.id));
      // Also deactivate children if it's a folder
      await db.update(catalogs)
        .set({ active: false })
        .where(eq(catalogs.parentId, input.id));
      return { success: true };
    }),
  /**
   * Rename a catalog item (file or folder)
   */
  renameCatalogItem: publicProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(catalogs)
        .set({ name: input.name })
        .where(eq(catalogs.id, input.id));
      return { success: true };
    }),
  /**
   * Move a catalog item to a different folder (or to root)
   */
  moveCatalogItem: publicProcedure
    .input(z.object({ id: z.number(), targetFolderId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(catalogs)
        .set({ parentId: input.targetFolderId })
        .where(eq(catalogs.id, input.id));
      return { success: true };
    }),
  /**
   * Get all folders (for move dialog)
   */
  getCatalogFolders: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const allFolders = await db.select().from(catalogs)
        .where(and(eq(catalogs.isFolder, true), eq(catalogs.active, true)));
      return allFolders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId }));
    }),
  /**
   * Toggle catalog visibility for a seller
   */
  toggleCatalogVisibility: publicProcedure
    .input(z.object({ sellerId: z.number(), catalogId: z.number(), visible: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      if (input.visible) {
        // Add visibility
        const existing = await db.select().from(sellerCatalogVisibility)
          .where(and(
            eq(sellerCatalogVisibility.sellerId, input.sellerId),
            eq(sellerCatalogVisibility.catalogId, input.catalogId)
          )).limit(1);
        if (existing.length === 0) {
          await db.insert(sellerCatalogVisibility).values({
            sellerId: input.sellerId,
            catalogId: input.catalogId,
          });
        }
      } else {
        // Remove visibility
        await db.delete(sellerCatalogVisibility)
          .where(and(
            eq(sellerCatalogVisibility.sellerId, input.sellerId),
            eq(sellerCatalogVisibility.catalogId, input.catalogId)
          ));
      }
      return { success: true };
    }),
  /**
   * Get all seller passwords for a gestor
   */
  getSellerPasswords: publicProcedure
    .input(z.object({ gestorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const allPerms = await db.select().from(sellerPermissions);
      const sellers = allPerms.filter(p => p.gestorName === input.gestorName);
      return sellers.map(s => ({
        id: s.id,
        name: s.sellerName,
        password: s.password,
      }));
    }),
  /**
   * Update seller password
   */
  updateSellerPassword: publicProcedure
    .input(z.object({ sellerId: z.number(), password: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(sellerPermissions)
        .set({ password: input.password })
        .where(eq(sellerPermissions.id, input.sellerId));
      return { success: true };
    }),
  /**
   * Add a new seller with password (manual registration by gestor)
   */
  addSellerWithPassword: publicProcedure
    .input(z.object({
      gestorName: z.string(),
      sellerName: z.string().min(2),
      password: z.string().min(1),
      authorized: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Check if seller already exists for this gestor
      const [existing] = await db.select().from(sellerPermissions)
        .where(and(
          eq(sellerPermissions.sellerName, input.sellerName.trim().toUpperCase()),
          eq(sellerPermissions.gestorName, input.gestorName)
        ))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Vendedor "${input.sellerName.trim().toUpperCase()}" já existe neste gestor.`,
        });
      }

      const result = await db.insert(sellerPermissions).values({
        sellerName: input.sellerName.trim().toUpperCase(),
        gestorName: input.gestorName,
        password: input.password.trim(),
        authorized: input.authorized,
      });

      return { success: true, id: result[0].insertId };
    }),

  deleteSellerPermission: publicProcedure
    .input(z.object({ sellerId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.delete(sellerPermissions).where(eq(sellerPermissions.id, input.sellerId));
      return { success: true };
    }),

  /**
   * Get period evolution data (annual, semester, quarter)
   * Returns monthly totals for all time, grouped by fixed periods
   */
  getPeriodEvolution: publicProcedure
    .input(z.object({
      grupo: z.enum(["all", "importacao_revenda", "industrializacao", "importacao_mp"]).optional().default("all"),
      subgrupo: z.string().optional().default("all"),
      crmSegmento: z.string().optional().default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const estadoToGrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
        return "outros";
      };
      const estadoToSubgrupo = (estado: string | null): string => {
        if (!estado) return "outros";
        const e = estado.toUpperCase();
        if (e === "BAMBU") return "bambu";
        if (e === "FIBRA") return "fibra";
        if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
        if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
        return "outros";
      };
      const isDigitacao = (nota: string | null) => {
        if (!nota) return false;
        const n = nota.toUpperCase();
        return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
      };
      const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";

      const rawItems = await db.select().from(salesOrders);
      let items = rawItems.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));
      if (input.grupo !== "all") {
        items = items.filter(item => estadoToGrupo(item.estadoConfiguravel) === input.grupo);
      }
      if (input.subgrupo !== "all") {
        items = items.filter(item => estadoToSubgrupo(item.estadoConfiguravel) === input.subgrupo);
      }
      if (input.crmSegmento !== "all") {
        items = items.filter(item => (item.crmSegmento || "").toUpperCase() === input.crmSegmento.toUpperCase());
      }

      // Keep ALL items (not just current year) for comparison purposes
      // Use Brazil timezone to determine current period (server may be in UTC)
      const brNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const currentYear = brNow.getFullYear();
      const currentMonth = brNow.getMonth() + 1; // 1-12
      const currentQuarter = Math.ceil(currentMonth / 3);
      const currentSemester = currentMonth <= 6 ? 1 : 2;

      // Group by month with faturado/a_faturar breakdown (ALL years)
      const monthMap = new Map<string, { value: number; faturado: number; aFaturar: number; orders: Set<string> }>();
      for (const item of items) {
        if (!item.dataEmissao) continue;
        const month = item.dataEmissao.substring(0, 7); // YYYY-MM
        if (!monthMap.has(month)) monthMap.set(month, { value: 0, faturado: 0, aFaturar: 0, orders: new Set() });
        const m = monthMap.get(month)!;
        const val = Number(item.valorTotal || 0);
        m.value += val;
        const estado = (item.estadoItem || "").toLowerCase();
        if (estado === "faturado") {
          m.faturado += val;
        } else {
          m.aFaturar += val;
        }
        if (item.pedido) m.orders.add(item.pedido);
      }

      // Build annual data: { year, value, faturado, aFaturar, orders }
      const yearMap = new Map<number, { value: number; faturado: number; aFaturar: number; orders: number }>();
      for (const [month, data] of Array.from(monthMap)) {
        const year = parseInt(month.substring(0, 4));
        if (!yearMap.has(year)) yearMap.set(year, { value: 0, faturado: 0, aFaturar: 0, orders: 0 });
        const y = yearMap.get(year)!;
        y.value += data.value;
        y.faturado += data.faturado;
        y.aFaturar += data.aFaturar;
        y.orders += data.orders.size;
      }
      const byYear = Array.from(yearMap.entries())
        .map(([year, data]) => ({ year, value: Math.round(data.value * 100) / 100, faturado: Math.round(data.faturado * 100) / 100, aFaturar: Math.round(data.aFaturar * 100) / 100, orders: data.orders }))
        .sort((a, b) => a.year - b.year);

      // Build semester data: { label, year, semester, value, faturado, aFaturar, orders }
      // 1st semester = Jan-Jun, 2nd semester = Jul-Dec
      const semMap = new Map<string, { year: number; semester: number; value: number; faturado: number; aFaturar: number; orders: number }>();
      for (const [month, data] of Array.from(monthMap)) {
        const year = parseInt(month.substring(0, 4));
        const m = parseInt(month.substring(5, 7));
        const semester = m <= 6 ? 1 : 2;
        const key = `${year}-S${semester}`;
        if (!semMap.has(key)) semMap.set(key, { year, semester, value: 0, faturado: 0, aFaturar: 0, orders: 0 });
        const s = semMap.get(key)!;
        s.value += data.value;
        s.faturado += data.faturado;
        s.aFaturar += data.aFaturar;
        s.orders += data.orders.size;
      }
      const bySemester = Array.from(semMap.entries())
        .map(([key, data]) => ({ label: key, ...data, value: Math.round(data.value * 100) / 100, faturado: Math.round(data.faturado * 100) / 100, aFaturar: Math.round(data.aFaturar * 100) / 100 }))
        .sort((a, b) => a.label.localeCompare(b.label));

      // Build quarter data: { label, year, quarter, value, faturado, aFaturar, orders }
      // Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
      const qtrMap = new Map<string, { year: number; quarter: number; value: number; faturado: number; aFaturar: number; orders: number }>();
      for (const [month, data] of Array.from(monthMap)) {
        const year = parseInt(month.substring(0, 4));
        const m = parseInt(month.substring(5, 7));
        const quarter = Math.ceil(m / 3);
        const key = `${year}-Q${quarter}`;
        if (!qtrMap.has(key)) qtrMap.set(key, { year, quarter, value: 0, faturado: 0, aFaturar: 0, orders: 0 });
        const q = qtrMap.get(key)!;
        q.value += data.value;
        q.faturado += data.faturado;
        q.aFaturar += data.aFaturar;
        q.orders += data.orders.size;
      }
      const byQuarter = Array.from(qtrMap.entries())
        .map(([key, data]) => ({ label: key, ...data, value: Math.round(data.value * 100) / 100, faturado: Math.round(data.faturado * 100) / 100, aFaturar: Math.round(data.aFaturar * 100) / 100 }))
        .sort((a, b) => a.label.localeCompare(b.label));

      // Monthly breakdown for each period (for detail expansion)
      const monthlyData = Array.from(monthMap.entries())
        .map(([month, data]) => ({ month, value: Math.round(data.value * 100) / 100, faturado: Math.round(data.faturado * 100) / 100, aFaturar: Math.round(data.aFaturar * 100) / 100, orders: data.orders.size }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // --- Comparison data for averages and lines ---
      // Quarter comparison: current quarter, previous quarter, best quarter
      const allQuarters = Array.from(qtrMap.entries())
        .map(([key, data]) => ({ label: key, ...data, value: Math.round(data.value * 100) / 100, faturado: Math.round(data.faturado * 100) / 100, aFaturar: Math.round(data.aFaturar * 100) / 100 }))
        .sort((a, b) => a.label.localeCompare(b.label));

      const currentQtrKey = `${currentYear}-Q${currentQuarter}`;
      const prevQuarter = currentQuarter > 1 ? currentQuarter - 1 : 4;
      const prevQtrYear = currentQuarter > 1 ? currentYear : currentYear - 1;
      const prevQtrKey = `${prevQtrYear}-Q${prevQuarter}`;
      const currentQtrData = allQuarters.find(q => q.label === currentQtrKey);
      const prevQtrData = allQuarters.find(q => q.label === prevQtrKey);
      const bestQtrData = allQuarters.length > 0 ? allQuarters.reduce((best, q) => q.value > best.value ? q : best, allQuarters[0]) : null;

      // Get months count for each quarter (for average calculation)
      const getMonthsInQuarter = (qtrLabel: string) => {
        const y = parseInt(qtrLabel.substring(0, 4));
        const q = parseInt(qtrLabel.substring(6, 7));
        const qStart = (q - 1) * 3 + 1;
        const qEnd = q * 3;
        let count = 0;
        for (const [month] of Array.from(monthMap)) {
          const my = parseInt(month.substring(0, 4));
          const mm = parseInt(month.substring(5, 7));
          if (my === y && mm >= qStart && mm <= qEnd) count++;
        }
        return count || 1;
      };

      const quarterComparison = {
        current: currentQtrData ? { ...currentQtrData, months: getMonthsInQuarter(currentQtrKey), avg: currentQtrData.value / getMonthsInQuarter(currentQtrKey) } : null,
        previous: prevQtrData ? { ...prevQtrData, months: getMonthsInQuarter(prevQtrKey), avg: prevQtrData.value / getMonthsInQuarter(prevQtrKey) } : null,
        best: bestQtrData ? { ...bestQtrData, months: getMonthsInQuarter(bestQtrData.label), avg: bestQtrData.value / getMonthsInQuarter(bestQtrData.label) } : null,
      };

      // Semester comparison: current semester, previous semester, best semester
      const allSemesters = Array.from(semMap.entries())
        .map(([key, data]) => ({ label: key, ...data, value: Math.round(data.value * 100) / 100, faturado: Math.round(data.faturado * 100) / 100, aFaturar: Math.round(data.aFaturar * 100) / 100 }))
        .sort((a, b) => a.label.localeCompare(b.label));

      const currentSemKey = `${currentYear}-S${currentSemester}`;
      const prevSemester = currentSemester > 1 ? currentSemester - 1 : 2;
      const prevSemYear = currentSemester > 1 ? currentYear : currentYear - 1;
      const prevSemKey = `${prevSemYear}-S${prevSemester}`;
      const currentSemData = allSemesters.find(s => s.label === currentSemKey);
      const prevSemData = allSemesters.find(s => s.label === prevSemKey);
      const bestSemData = allSemesters.length > 0 ? allSemesters.reduce((best, s) => s.value > best.value ? s : best, allSemesters[0]) : null;

      const getMonthsInSemester = (semLabel: string) => {
        const y = parseInt(semLabel.substring(0, 4));
        const s = parseInt(semLabel.substring(6, 7));
        const sStart = s === 1 ? 1 : 7;
        const sEnd = s === 1 ? 6 : 12;
        let count = 0;
        for (const [month] of Array.from(monthMap)) {
          const my = parseInt(month.substring(0, 4));
          const mm = parseInt(month.substring(5, 7));
          if (my === y && mm >= sStart && mm <= sEnd) count++;
        }
        return count || 1;
      };

      const semesterComparison = {
        current: currentSemData ? { ...currentSemData, months: getMonthsInSemester(currentSemKey), avg: currentSemData.value / getMonthsInSemester(currentSemKey) } : null,
        previous: prevSemData ? { ...prevSemData, months: getMonthsInSemester(prevSemKey), avg: prevSemData.value / getMonthsInSemester(prevSemKey) } : null,
        best: bestSemData ? { ...bestSemData, months: getMonthsInSemester(bestSemData.label), avg: bestSemData.value / getMonthsInSemester(bestSemData.label) } : null,
      };

      // Annual comparison: current year, previous year, best year
      const currentYearData = byYear.find(y => y.year === currentYear);
      const prevYearData = byYear.find(y => y.year === currentYear - 1);
      const bestYearData = byYear.length > 0 ? byYear.reduce((best, y) => y.value > best.value ? y : best, byYear[0]) : null;

      const getMonthsInYear = (year: number) => {
        let count = 0;
        for (const [month] of Array.from(monthMap)) {
          const my = parseInt(month.substring(0, 4));
          if (my === year) count++;
        }
        return count || 1;
      };

      const annualComparison = {
        current: currentYearData ? { ...currentYearData, months: getMonthsInYear(currentYear), avg: currentYearData.value / getMonthsInYear(currentYear) } : null,
        previous: prevYearData ? { ...prevYearData, months: getMonthsInYear(currentYear - 1), avg: prevYearData.value / getMonthsInYear(currentYear - 1) } : null,
        best: bestYearData ? { ...bestYearData, months: getMonthsInYear(bestYearData.year), avg: bestYearData.value / getMonthsInYear(bestYearData.year) } : null,
      };

      // Monthly cumulative lines for comparison (for the chart)
      // For quarter: cumulative by month within the quarter
      const buildCumulativeForQuarter = (qtrLabel: string | undefined) => {
        if (!qtrLabel) return [];
        const y = parseInt(qtrLabel.substring(0, 4));
        const q = parseInt(qtrLabel.substring(6, 7));
        const qStart = (q - 1) * 3 + 1;
        const qEnd = q * 3;
        const result: Array<{ month: number; cumulative: number }> = [];
        let cum = 0;
        for (let m = qStart; m <= qEnd; m++) {
          const key = `${y}-${String(m).padStart(2, '0')}`;
          const md = monthMap.get(key);
          cum += md ? md.value : 0;
          result.push({ month: m - qStart + 1, cumulative: Math.round(cum * 100) / 100 });
        }
        return result;
      };

      const buildCumulativeForSemester = (semLabel: string | undefined) => {
        if (!semLabel) return [];
        const y = parseInt(semLabel.substring(0, 4));
        const s = parseInt(semLabel.substring(6, 7));
        const sStart = s === 1 ? 1 : 7;
        const sEnd = s === 1 ? 6 : 12;
        const result: Array<{ month: number; cumulative: number }> = [];
        let cum = 0;
        for (let m = sStart; m <= sEnd; m++) {
          const key = `${y}-${String(m).padStart(2, '0')}`;
          const md = monthMap.get(key);
          cum += md ? md.value : 0;
          result.push({ month: m - sStart + 1, cumulative: Math.round(cum * 100) / 100 });
        }
        return result;
      };

      const buildCumulativeForYear = (year: number | undefined) => {
        if (!year) return [];
        const result: Array<{ month: number; cumulative: number }> = [];
        let cum = 0;
        for (let m = 1; m <= 12; m++) {
          const key = `${year}-${String(m).padStart(2, '0')}`;
          const md = monthMap.get(key);
          cum += md ? md.value : 0;
          result.push({ month: m, cumulative: Math.round(cum * 100) / 100 });
        }
        return result;
      };

      const quarterLines = {
        current: buildCumulativeForQuarter(currentQtrKey),
        previous: buildCumulativeForQuarter(prevQtrKey),
        best: bestQtrData ? buildCumulativeForQuarter(bestQtrData.label) : [],
      };

      const semesterLines = {
        current: buildCumulativeForSemester(currentSemKey),
        previous: buildCumulativeForSemester(prevSemKey),
        best: bestSemData ? buildCumulativeForSemester(bestSemData.label) : [],
      };

      const annualLines = {
        current: buildCumulativeForYear(currentYear),
        previous: buildCumulativeForYear(currentYear - 1),
        best: bestYearData ? buildCumulativeForYear(bestYearData.year) : [],
      };

      // Filter byYear/monthlyData to current year only for the chart display
      const byYearCurrent = byYear.filter(y => y.year === currentYear);
      const monthlyDataCurrent = monthlyData.filter(m => parseInt(m.month.substring(0, 4)) === currentYear);

      return {
        byYear: byYearCurrent,
        bySemester: bySemester.filter(s => s.year === currentYear),
        byQuarter: byQuarter.filter(q => q.year === currentYear),
        monthlyData: monthlyDataCurrent,
        quarterComparison,
        semesterComparison,
        annualComparison,
        quarterLines,
        semesterLines,
        annualLines,
      };
    }),

  // ===== COMISSÃO =====

  /** Get commission for all sellers of a gestor (with monthly goals) */
  getCommissions: publicProcedure
    .input(z.object({ gestorName: z.string(), year: z.number().optional(), month: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { sellers: [], matrix: [] };
      // Get all sellers for this gestor (including sub-gestor sellers)
      const directSellers = await db.select({
        id: sellerPermissions.id,
        sellerName: sellerPermissions.sellerName,
      }).from(sellerPermissions)
        .where(eq(sellerPermissions.gestorName, input.gestorName));
      // Sub-gestor sellers
      const subGestorNames = directSellers.map(s => s.sellerName);
      const subGestorSellers = subGestorNames.length > 0
        ? await db.select({ id: sellerPermissions.id, sellerName: sellerPermissions.sellerName })
            .from(sellerPermissions).where(inArray(sellerPermissions.gestorName, subGestorNames))
        : [];
      const seenIds = new Set(directSellers.map(s => s.id));
      const allSellers = [...directSellers];
      for (const sub of subGestorSellers) {
        if (!seenIds.has(sub.id)) { seenIds.add(sub.id); allSellers.push(sub); }
      }
      // Get monthly goals for current period
      const now = new Date();
      const year = input.year || now.getFullYear();
      const month = input.month || (now.getMonth() + 1);
      const goals = await db.select().from(sellerMonthlyTargets)
        .where(and(
          eq(sellerMonthlyTargets.gestorName, input.gestorName),
          eq(sellerMonthlyTargets.year, year),
          eq(sellerMonthlyTargets.month, month),
        ));
      const goalMap = new Map(goals.map(g => [g.sellerId, g]));
      // Get commission matrix (all sellers for this gestor)
      const matrix = await db.select().from(commissionMatrix)
        .where(eq(commissionMatrix.gestorName, input.gestorName));
      // Build response
      const sellers = allSellers.map(s => {
        const goal = goalMap.get(s.id);
        return {
          id: s.id,
          sellerName: s.sellerName,
          goalAmount: goal ? Number(goal.targetValue) : null,
          goalId: goal?.id || null,
        };
      });
      return {
        sellers,
        matrix: matrix.map(m => ({
          id: m.id,
          sellerId: m.sellerId,
          metaPercent: m.metaPercent,
          priceTier: m.priceTier,
          commissionPercent: Number(m.commissionPercent),
        })),
        year,
        month,
      };
    }),

  /** Save/update monthly goal for a seller */
  saveSellerGoal: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      sellerName: z.string(),
      gestorName: z.string(),
      year: z.number(),
      month: z.number(),
      goalAmount: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      // Check if goal exists for this seller/period
      const existing = await db.select().from(sellerMonthlyTargets)
        .where(and(
          eq(sellerMonthlyTargets.sellerId, input.sellerId),
          eq(sellerMonthlyTargets.year, input.year),
          eq(sellerMonthlyTargets.month, input.month),
        )).limit(1);
      if (existing.length > 0) {
        await db.update(sellerMonthlyTargets)
          .set({ targetValue: String(input.goalAmount) })
          .where(eq(sellerMonthlyTargets.id, existing[0].id));
      } else {
        await db.insert(sellerMonthlyTargets).values({
          sellerId: input.sellerId,
          sellerName: input.sellerName,
          gestorName: input.gestorName,
          year: input.year,
          month: input.month,
          targetType: "valor",
          targetValue: String(input.goalAmount),
          commissionPercent: "0",
        });
      }
      return { success: true };
    }),

  /** Save/update the commission matrix for a specific seller */
  saveCommissionMatrix: publicProcedure
    .input(z.object({
      gestorName: z.string(),
      sellerId: z.number(),
      matrix: z.array(z.object({
        metaPercent: z.number(),
        priceTier: z.enum(["mostrado_alto", "medio_alto", "medio", "baixo"]),
        commissionPercent: z.number().min(0).max(100),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      // Delete existing matrix for this seller
      await db.delete(commissionMatrix).where(
        and(
          eq(commissionMatrix.gestorName, input.gestorName),
          eq(commissionMatrix.sellerId, input.sellerId),
        )
      );
      // Insert new matrix
      if (input.matrix.length > 0) {
        await db.insert(commissionMatrix).values(
          input.matrix.map(m => ({
            gestorName: input.gestorName,
            sellerId: input.sellerId,
            metaPercent: m.metaPercent,
            priceTier: m.priceTier,
            commissionPercent: String(m.commissionPercent),
          }))
        );
      }
      return { success: true };
    }),

  /** Legacy: Update commission for a seller (kept for backward compat) */
  updateCommission: publicProcedure
    .input(z.object({ sellerId: z.number(), commissionPercent: z.number().min(0).max(100) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(sellerPermissions)
        .set({ commissionPercent: String(input.commissionPercent) })
        .where(eq(sellerPermissions.id, input.sellerId));
      return { success: true };
    }),

  /**
   * Export vendor clients as Maxiprod-format Excel (.xlsx)
   * Returns base64-encoded Excel file
   */
  exportMaxiprodExcel: publicProcedure
    .input(z.object({
      clientIds: z.array(z.number()).optional(),
      sinceDays: z.number().optional(), // export clients created in the last N days
    }))
    .mutation(async ({ input }) => {
      const { generateMaxiprodExcel, generateMaxiprodExcelByDate } = await import("./maxiprodExcelExport");

      let buffer: Buffer;
      let count: number;

      if (input.sinceDays) {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - input.sinceDays);
        const result = await generateMaxiprodExcelByDate(sinceDate);
        buffer = result.buffer;
        count = result.count;
      } else {
        buffer = await generateMaxiprodExcel(input.clientIds);
        count = input.clientIds?.length || -1; // -1 means all
      }

      return {
        base64: buffer.toString("base64"),
        filename: `Maxiprod_Empresas_${new Date().toISOString().slice(0, 10)}.xlsx`,
        count,
      };
    }),
});