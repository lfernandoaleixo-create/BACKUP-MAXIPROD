import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { accountsReceivable } from "../drizzle/schema";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

/**
 * Test data with partial payments to validate the "Valor a Receber" formula:
 * valorAReceber = valorLiquido - valorRecebidoLiquido
 *
 * This ensures the system correctly discounts partial payments from displayed totals.
 */
const testReceivables = [
  {
    maxiprodId: 99001,
    estado: "EMITIDO",
    tipo: "TITULO",
    valorOriginal: "10000.00",
    valorLiquido: "10000.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorRecebidoLiquido: "3000.00", // Partial payment of R$ 3.000
    emissaoData: "2026-02-01T00:00:00",
    vencimentoData: "2026-04-15T00:00:00", // a vencer
    vencimentoOriginalData: "2026-04-15T00:00:00",
    referenteA: "CLIENTE PARCIAL A ref. NF 001",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    cliente: "CLIENTE PARCIAL A",
    empresaNome: "PALITOS INDUSTRIA",
  },
  {
    maxiprodId: 99002,
    estado: "EMITIDO",
    tipo: "RECEITA",
    valorOriginal: "5000.00",
    valorLiquido: "5000.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorRecebidoLiquido: "2000.00", // Partial payment of R$ 2.000
    emissaoData: "2026-01-15T00:00:00",
    vencimentoData: "2026-02-10T00:00:00", // vencida (inadimplente)
    vencimentoOriginalData: "2026-02-10T00:00:00",
    referenteA: "CLIENTE PARCIAL B ref. NF 002",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    cliente: "CLIENTE PARCIAL B",
    empresaNome: "PALITOS INDUSTRIA",
  },
  {
    maxiprodId: 99003,
    estado: "EMITIDO",
    tipo: "ADIANTAMENTO",
    valorOriginal: "8000.00",
    valorLiquido: "8000.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorRecebidoLiquido: "0.00", // No partial payment
    emissaoData: "2026-03-01T00:00:00",
    vencimentoData: "2026-03-20T00:00:00", // a vencer (this week)
    vencimentoOriginalData: "2026-03-20T00:00:00",
    referenteA: "CLIENTE SEM PARCIAL ref. NF 003",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    cliente: "CLIENTE SEM PARCIAL",
    empresaNome: "PALITOS INDUSTRIA",
  },
  {
    maxiprodId: 99004,
    estado: "EMITIDO",
    tipo: "TITULO_PEDIDO_DE_VENDA", // Should be EXCLUDED from totals
    valorOriginal: "50000.00",
    valorLiquido: "50000.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorRecebidoLiquido: "0.00",
    emissaoData: "2026-03-01T00:00:00",
    vencimentoData: "2026-04-01T00:00:00",
    vencimentoOriginalData: "2026-04-01T00:00:00",
    referenteA: "PEDIDO DE VENDA - EXCLUIR",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    cliente: "CLIENTE PEDIDO VENDA",
    empresaNome: "PALITOS INDUSTRIA",
  },
  {
    maxiprodId: 99005,
    estado: "RECEBIDO",
    tipo: "TITULO",
    valorOriginal: "1500.00",
    valorLiquido: "1500.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorRecebidoLiquido: "1500.00", // Fully received
    emissaoData: "2026-01-01T00:00:00",
    vencimentoData: "2026-01-30T00:00:00",
    vencimentoOriginalData: "2026-01-30T00:00:00",
    liquidacaoData: "2026-01-28T00:00:00",
    referenteA: "CLIENTE RECEBIDO ref. NF 004",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    cliente: "CLIENTE PARCIAL A",
    empresaNome: "PALITOS INDUSTRIA",
  },
];

/**
 * Expected values:
 * - EMITIDO + valid types (TITULO, RECEITA, ADIANTAMENTO): 99001, 99002, 99003
 * - valorLiquido total: 10000 + 5000 + 8000 = 23000
 * - valorRecebidoLiquido total: 3000 + 2000 + 0 = 5000
 * - valorAReceber total: 23000 - 5000 = 18000
 *
 * - Inadimplentes (vencidas): only 99002 (vencimento 2026-02-10)
 *   - valorAReceber: 5000 - 2000 = 3000
 *
 * - TITULO_PEDIDO_DE_VENDA (99004) should be EXCLUDED from all calculations
 */

let backupReceivables: any[] = [];

describe("valor a receber (partial payments)", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);

  beforeAll(async () => {
    const db = await getDb();
    if (db) {
      backupReceivables = await db.select().from(accountsReceivable);
      await db.delete(accountsReceivable);
      await db.insert(accountsReceivable).values(testReceivables as any);
    }
  });

  afterAll(async () => {
    const db = await getDb();
    if (db) {
      await db.delete(accountsReceivable);
      if (backupReceivables.length > 0) {
        for (let i = 0; i < backupReceivables.length; i += 50) {
          await db.insert(accountsReceivable).values(backupReceivables.slice(i, i + 50));
        }
      }
    }
  });

  describe("getSummary - valor a receber", () => {
    it("calculates emAberto using valorLiquido - valorRecebidoLiquido", async () => {
      const result = await caller.financial.getSummary();
      expect(result).not.toBeNull();

      // Total a receber = (10000-3000) + (5000-2000) + (8000-0) = 7000 + 3000 + 8000 = 18000
      expect(result!.receber.emAberto.total).toBe(18000);
      expect(result!.receber.emAberto.count).toBe(3);
    });

    it("calculates vencidas using valorAReceber (discounting partial payments)", async () => {
      const result = await caller.financial.getSummary();
      expect(result).not.toBeNull();

      // Only 99002 is overdue: valorAReceber = 5000 - 2000 = 3000
      expect(result!.receber.vencidas.total).toBe(3000);
      expect(result!.receber.vencidas.count).toBe(1);
    });

    it("excludes TITULO_PEDIDO_DE_VENDA from totals", async () => {
      const result = await caller.financial.getSummary();
      expect(result).not.toBeNull();

      // If TITULO_PEDIDO_DE_VENDA were included, total would be 68000
      // Correct total should be 18000 (only TITULO + RECEITA + ADIANTAMENTO)
      expect(result!.receber.emAberto.total).toBeLessThan(50000);
    });
  });

  describe("getMonthlyBreakdown - valor a receber", () => {
    it("uses valorAReceber in monthly totals", async () => {
      const result = await caller.financial.getMonthlyBreakdown();
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);

      // getMonthlyBreakdown only shows current month (from today) forward.
      // 99002 (vencimento 2026-02-10) is in the past, so NOT included in monthly breakdown.
      // Only 99001 (7000, vencimento Apr) + 99003 (8000, vencimento Mar 20) = 15000
      const totalReceber = result!.reduce((sum: number, m: any) => sum + m.receber.total, 0);
      expect(totalReceber).toBe(15000);
    });
  });

  describe("getAgingReport - valor a receber", () => {
    it("uses valorAReceber in aging buckets", async () => {
      const result = await caller.financial.getAgingReport();
      expect(result).not.toBeNull();

      // 99002 (vencida ~34 dias): valorAReceber = 5000 - 2000 = 3000 -> bucket de31a60
      expect(result!.aging.de31a60.total).toBe(3000);
      expect(result!.aging.de31a60.count).toBe(1);

      // 99001 (a vencer): valorAReceber = 10000 - 3000 = 7000
      // 99003 (a vencer): valorAReceber = 8000 - 0 = 8000
      expect(result!.aging.aVencer.total).toBe(15000);
      expect(result!.aging.aVencer.count).toBe(2);
    });

    it("uses valorAReceber for top devedores", async () => {
      const result = await caller.financial.getAgingReport();
      expect(result).not.toBeNull();

      // Only CLIENTE PARCIAL B has overdue debt: 3000 (not 5000)
      const devedor = result!.topDevedores.find((d: any) => d.cliente === "CLIENTE PARCIAL B");
      expect(devedor).toBeDefined();
      expect(devedor!.totalVencido).toBe(3000);
    });
  });

  describe("getReceivableCalendar - valor a receber", () => {
    it("uses valorAReceber in calendar items", async () => {
      const result = await caller.financial.getReceivableCalendar();
      expect(result).not.toBeNull();

      // Total across all weeks + vencidas should use valorAReceber
      const totalCalendar =
        result!.vencidas.total +
        result!.weeks.reduce((sum: number, w: any) => sum + w.total, 0);

      // 99002 is overdue > 3 days, so it goes to inadimplência (not in calendar)
      // 99001 (7000) and 99003 (8000) should be in the calendar weeks
      expect(totalCalendar).toBe(15000);
    });
  });

  describe("getTopClientes - valor a receber", () => {
    it("uses valorAReceber for totalEmAberto", async () => {
      const result = await caller.financial.getTopClientes();
      expect(result.length).toBeGreaterThan(0);

      // CLIENTE SEM PARCIAL: 8000 (no partial payment)
      const semParcial = result.find((c: any) => c.cliente === "CLIENTE SEM PARCIAL");
      expect(semParcial).toBeDefined();
      expect(semParcial!.totalEmAberto).toBe(8000);

      // CLIENTE PARCIAL A: 10000 - 3000 = 7000 (with partial payment)
      const parcialA = result.find((c: any) => c.cliente === "CLIENTE PARCIAL A");
      expect(parcialA).toBeDefined();
      expect(parcialA!.totalEmAberto).toBe(7000);

      // CLIENTE PARCIAL B: 5000 - 2000 = 3000 (with partial payment)
      const parcialB = result.find((c: any) => c.cliente === "CLIENTE PARCIAL B");
      expect(parcialB).toBeDefined();
      expect(parcialB!.totalEmAberto).toBe(3000);
    });
  });

  describe("getClientesInadimplentes - valor a receber", () => {
    it("uses valorAReceber for inadimplente totals", async () => {
      const result = await caller.financial.getClientesInadimplentes();
      expect(Array.isArray(result)).toBe(true);

      // Only CLIENTE PARCIAL B should be inadimplente (vencimento 2026-02-10)
      // valorAReceber = 5000 - 2000 = 3000
      const inadimplente = result.find((c: any) => c.cliente === "CLIENTE PARCIAL B");
      expect(inadimplente).toBeDefined();
      expect(inadimplente!.total).toBe(3000);

      // Individual titulo should also show valorAReceber
      expect(inadimplente!.titulos[0].valor).toBe(3000);
    });
  });

  describe("getCashFlowChart - valor a receber", () => {
    it("uses valorAReceber in cash flow receivables", async () => {
      const result = await caller.financial.getCashFlowChart();
      expect(result).not.toBeNull();

      // getCashFlowChart includes both receivables and payables.
      // We only replaced receivable data, payables still have production data.
      // So we verify the structure is correct and recebimentos include our test items.
      expect(result!.weeks).toBeDefined();
      expect(Array.isArray(result!.weeks)).toBe(true);
      expect(result!.weeks.length).toBeGreaterThan(0);

      // Each week should have recebimentos and pagamentos fields
      const week = result!.weeks[0];
      expect(week).toHaveProperty("recebimentos");
      expect(week).toHaveProperty("pagamentos");
      expect(week).toHaveProperty("label");

      // The total recebimentos should include our test items with valorAReceber
      // 99001 (7000) + 99003 (8000) = 15000 in receivables
      // 99002 (3000) is overdue > 3 days, so excluded from cash flow
      const totalRecebimentos = result!.weeks.reduce(
        (sum: number, w: any) => sum + w.recebimentos,
        0
      );
      // Total should include at least our test items (15000)
      expect(totalRecebimentos).toBeGreaterThanOrEqual(15000);
    });
  });
});
