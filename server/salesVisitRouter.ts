/**
 * Sales Visit Report Router
 * CRUD for visit reports + metrics/analytics endpoints
 */
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { salesVisitReports, type SalesVisitReport } from "../drizzle/schema";
import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";

// ─── Constants ────────────────────────────────────────────────────────────────

export const VISIT_OUTCOMES = [
  { value: "PEDIDO_REALIZADO", label: "Pedido Realizado", color: "emerald" },
  { value: "PEDIDO_PARCIAL", label: "Pedido Parcial", color: "amber" },
  { value: "SEM_PEDIDO", label: "Sem Pedido", color: "red" },
  { value: "AGENDOU_RETORNO", label: "Agendou Retorno", color: "blue" },
  { value: "CLIENTE_AUSENTE", label: "Cliente Ausente", color: "slate" },
] as const;

export const VISIT_TYPES = [
  { value: "PRIMEIRA_VISITA", label: "Primeira Visita" },
  { value: "ROTINA", label: "Visita de Rotina" },
  { value: "NEGOCIACAO", label: "Negociação" },
  { value: "APRESENTACAO", label: "Apresentação de Produto" },
  { value: "POS_VENDA", label: "Pós-Venda" },
  { value: "COBRANCA", label: "Cobrança" },
] as const;

export const NO_SALE_REASONS = [
  { value: "ESTOQUE_ALTO", label: "Estoque Alto", description: "Cliente alega estar com estoque suficiente" },
  { value: "PRECO_ALTO", label: "Preço Alto", description: "Cliente considera o preço acima do mercado" },
  { value: "SEM_VERBA", label: "Sem Verba/Orçamento", description: "Cliente sem recursos financeiros no momento" },
  { value: "PREFERENCIA_CONCORRENTE", label: "Preferência por Concorrente", description: "Cliente prefere produto/fornecedor concorrente" },
  { value: "PRAZO_ENTREGA", label: "Prazo de Entrega", description: "Prazo de entrega não atende a necessidade" },
  { value: "JA_COMPROU", label: "Já Comprou Recentemente", description: "Cliente fez compra recente e não precisa repor" },
  { value: "SAZONALIDADE", label: "Sazonalidade/Baixa Temporada", description: "Período de baixa demanda para o produto" },
  { value: "DECISOR_AUSENTE", label: "Decisor Ausente", description: "Pessoa que decide a compra não estava disponível" },
  { value: "QUALIDADE", label: "Problemas com Qualidade", description: "Reclamação sobre qualidade de compras anteriores" },
  { value: "CONDICOES_PAGAMENTO", label: "Condições de Pagamento", description: "Condições de pagamento não são adequadas" },
  { value: "INADIMPLENTE", label: "Inadimplente", description: "Cliente com pendências financeiras, não pode comprar" },
  { value: "SEM_ESPACO", label: "Sem Espaço/Depósito Cheio", description: "Cliente sem espaço físico para armazenar" },
  { value: "OUTRO", label: "Outro", description: "Motivo não listado (descrever nas observações)" },
] as const;

// ─── Router ───────────────────────────────────────────────────────────────────

export const salesVisitRouter = router({
  // Get constants (outcomes, types, reasons) for the frontend
  getConstants: publicProcedure.query(() => {
    return {
      outcomes: VISIT_OUTCOMES,
      visitTypes: VISIT_TYPES,
      noSaleReasons: NO_SALE_REASONS,
    };
  }),

  // Create a new visit report
  create: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      sellerName: z.string(),
      clientId: z.number().nullable().optional(),
      clientName: z.string().min(1),
      clientCity: z.string().nullable().optional(),
      clientUf: z.string().max(2).nullable().optional(),
      visitDate: z.string(), // ISO date string
      visitType: z.string(),
      outcome: z.string(),
      noSaleReasons: z.array(z.string()).nullable().optional(),
      orderValue: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
      nextSteps: z.string().nullable().optional(),
      nextVisitDate: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db.insert(salesVisitReports).values({
        sellerId: input.sellerId,
        sellerName: input.sellerName,
        clientId: input.clientId ?? null,
        clientName: input.clientName,
        clientCity: input.clientCity ?? null,
        clientUf: input.clientUf ?? null,
        visitDate: new Date(input.visitDate),
        visitType: input.visitType,
        outcome: input.outcome,
        noSaleReasons: input.noSaleReasons ?? null,
        orderValue: input.orderValue?.toString() ?? null,
        notes: input.notes ?? null,
        nextSteps: input.nextSteps ?? null,
        nextVisitDate: input.nextVisitDate ? new Date(input.nextVisitDate) : null,
      });
      return { id: result[0].insertId };
    }),

  // Update an existing visit report
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      clientId: z.number().nullable().optional(),
      clientName: z.string().min(1).optional(),
      clientCity: z.string().nullable().optional(),
      clientUf: z.string().max(2).nullable().optional(),
      visitDate: z.string().optional(),
      visitType: z.string().optional(),
      outcome: z.string().optional(),
      noSaleReasons: z.array(z.string()).nullable().optional(),
      orderValue: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
      nextSteps: z.string().nullable().optional(),
      nextVisitDate: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      const updateData: Record<string, any> = {};
      
      if (data.clientName !== undefined) updateData.clientName = data.clientName;
      if (data.clientId !== undefined) updateData.clientId = data.clientId;
      if (data.clientCity !== undefined) updateData.clientCity = data.clientCity;
      if (data.clientUf !== undefined) updateData.clientUf = data.clientUf;
      if (data.visitDate !== undefined) updateData.visitDate = new Date(data.visitDate);
      if (data.visitType !== undefined) updateData.visitType = data.visitType;
      if (data.outcome !== undefined) updateData.outcome = data.outcome;
      if (data.noSaleReasons !== undefined) updateData.noSaleReasons = data.noSaleReasons;
      if (data.orderValue !== undefined) updateData.orderValue = data.orderValue?.toString() ?? null;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.nextSteps !== undefined) updateData.nextSteps = data.nextSteps;
      if (data.nextVisitDate !== undefined) updateData.nextVisitDate = data.nextVisitDate ? new Date(data.nextVisitDate) : null;

      await db.update(salesVisitReports).set(updateData).where(eq(salesVisitReports.id, id));
      return { success: true };
    }),

  // Delete a visit report
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(salesVisitReports).where(eq(salesVisitReports.id, input.id));
      return { success: true };
    }),

  // List visit reports for a seller with optional filters
  list: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      clientId: z.number().nullable().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      outcome: z.string().nullable().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { reports: [], total: 0 };
      const conditions: any[] = [eq(salesVisitReports.sellerId, input.sellerId)];
      
      if (input.clientId) {
        conditions.push(eq(salesVisitReports.clientId, input.clientId));
      }
      if (input.startDate) {
        conditions.push(gte(salesVisitReports.visitDate, new Date(input.startDate)));
      }
      if (input.endDate) {
        conditions.push(lte(salesVisitReports.visitDate, new Date(input.endDate)));
      }
      if (input.outcome) {
        conditions.push(eq(salesVisitReports.outcome, input.outcome));
      }

      const reports = await db
        .select()
        .from(salesVisitReports)
        .where(and(...conditions))
        .orderBy(desc(salesVisitReports.visitDate))
        .limit(input.limit)
        .offset(input.offset);

      const totalResult = await db
        .select({ count: count() })
        .from(salesVisitReports)
        .where(and(...conditions));

      return {
        reports,
        total: totalResult[0]?.count ?? 0,
      };
    }),

  // Get metrics for a specific seller (overall and per-client)
  metrics: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { overall: { totalVisits: 0, pedidoRealizado: 0, pedidoParcial: 0, semPedido: 0, agendouRetorno: 0, clienteAusente: 0, conversionRate: 0, reasonCounts: {}, totalOrderValue: 0 }, clientMetrics: [] };
      const conditions: any[] = [eq(salesVisitReports.sellerId, input.sellerId)];
      
      if (input.startDate) {
        conditions.push(gte(salesVisitReports.visitDate, new Date(input.startDate)));
      }
      if (input.endDate) {
        conditions.push(lte(salesVisitReports.visitDate, new Date(input.endDate)));
      }

      // Get all reports for this seller in the period
      const reports = await db
        .select()
        .from(salesVisitReports)
        .where(and(...conditions))
        .orderBy(desc(salesVisitReports.visitDate));

      // Calculate overall metrics
      const totalVisits = reports.length;
      const pedidoRealizado = reports.filter(r => r.outcome === "PEDIDO_REALIZADO").length;
      const pedidoParcial = reports.filter(r => r.outcome === "PEDIDO_PARCIAL").length;
      const semPedido = reports.filter(r => r.outcome === "SEM_PEDIDO").length;
      const agendouRetorno = reports.filter(r => r.outcome === "AGENDOU_RETORNO").length;
      const clienteAusente = reports.filter(r => r.outcome === "CLIENTE_AUSENTE").length;
      
      const conversionRate = totalVisits > 0 
        ? ((pedidoRealizado + pedidoParcial) / totalVisits) * 100 
        : 0;

      // Count no-sale reasons across all reports
      const reasonCounts: Record<string, number> = {};
      for (const report of reports) {
        if (report.noSaleReasons && Array.isArray(report.noSaleReasons)) {
          for (const reason of report.noSaleReasons) {
            reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
          }
        }
      }

      // Per-client metrics
      const clientMap = new Map<string, {
        clientId: number | null;
        clientName: string;
        clientCity: string | null;
        clientUf: string | null;
        totalVisits: number;
        pedidos: number;
        semPedido: number;
        reasonCounts: Record<string, number>;
        lastVisit: Date;
        totalOrderValue: number;
      }>();

      for (const report of reports) {
        const key = report.clientName;
        if (!clientMap.has(key)) {
          clientMap.set(key, {
            clientId: report.clientId,
            clientName: report.clientName,
            clientCity: report.clientCity,
            clientUf: report.clientUf,
            totalVisits: 0,
            pedidos: 0,
            semPedido: 0,
            reasonCounts: {},
            lastVisit: report.visitDate,
            totalOrderValue: 0,
          });
        }
        const client = clientMap.get(key)!;
        client.totalVisits++;
        if (report.outcome === "PEDIDO_REALIZADO" || report.outcome === "PEDIDO_PARCIAL") {
          client.pedidos++;
          if (report.orderValue) {
            client.totalOrderValue += parseFloat(report.orderValue);
          }
        }
        if (report.outcome === "SEM_PEDIDO") {
          client.semPedido++;
        }
        if (report.noSaleReasons && Array.isArray(report.noSaleReasons)) {
          for (const reason of report.noSaleReasons) {
            client.reasonCounts[reason] = (client.reasonCounts[reason] || 0) + 1;
          }
        }
        if (report.visitDate > client.lastVisit) {
          client.lastVisit = report.visitDate;
        }
      }

      const clientMetrics = Array.from(clientMap.values())
        .map(c => ({
          ...c,
          conversionRate: c.totalVisits > 0 ? ((c.pedidos / c.totalVisits) * 100) : 0,
          reasonPercentages: Object.entries(c.reasonCounts).map(([reason, cnt]) => ({
            reason,
            count: cnt,
            percentage: c.totalVisits > 0 ? ((cnt / c.totalVisits) * 100) : 0,
          })).sort((a, b) => b.count - a.count),
        }))
        .sort((a, b) => b.totalVisits - a.totalVisits);

      return {
        overall: {
          totalVisits,
          pedidoRealizado,
          pedidoParcial,
          semPedido,
          agendouRetorno,
          clienteAusente,
          conversionRate,
          reasonCounts,
          totalOrderValue: reports.reduce((sum: number, r: SalesVisitReport) => sum + (r.orderValue ? parseFloat(r.orderValue) : 0), 0),
        },
        clientMetrics,
      };
    }),

  // Get metrics for a specific client (for the client detail view)
  clientMetrics: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      clientName: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { totalVisits: 0, pedidos: 0, semPedido: 0, conversionRate: 0, reasonPercentages: [], recentVisits: [] };
      const reports = await db
        .select()
        .from(salesVisitReports)
        .where(and(
          eq(salesVisitReports.sellerId, input.sellerId),
          eq(salesVisitReports.clientName, input.clientName),
        ))
        .orderBy(desc(salesVisitReports.visitDate));

      const totalVisits = reports.length;
      const pedidos = reports.filter(r => r.outcome === "PEDIDO_REALIZADO" || r.outcome === "PEDIDO_PARCIAL").length;
      const semPedido = reports.filter(r => r.outcome === "SEM_PEDIDO").length;

      const reasonCounts2: Record<string, number> = {};
      for (const report of reports) {
        if (report.noSaleReasons && Array.isArray(report.noSaleReasons)) {
          for (const reason of report.noSaleReasons as string[]) {
            reasonCounts2[reason] = (reasonCounts2[reason] || 0) + 1;
          }
        }
      }

      return {
        totalVisits,
        pedidos,
        semPedido,
        conversionRate: totalVisits > 0 ? ((pedidos / totalVisits) * 100) : 0,
        reasonPercentages: Object.entries(reasonCounts2).map(([reason, cnt]) => ({
          reason,
          count: cnt,
          percentage: totalVisits > 0 ? ((cnt / totalVisits) * 100) : 0,
        })).sort((a, b) => b.count - a.count),
        recentVisits: reports.slice(0, 10),
      };
    }),
});
