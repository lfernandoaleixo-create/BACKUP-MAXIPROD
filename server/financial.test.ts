import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { accountsPayable, accountsReceivable } from "../drizzle/schema";

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

// Sample test data - Contas a Pagar
const samplePayables = [
  {
    maxiprodId: 90001,
    estado: "EMITIDO",
    tipo: "TITULO",
    valorOriginal: "1500.00",
    valorLiquido: "1500.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorPagoLiquido: "0.00",
    emissaoData: "2026-02-01T00:00:00",
    vencimentoData: "2026-03-10T00:00:00", // vencida (antes de hoje 14/03)
    vencimentoOriginalData: "2026-03-10T00:00:00",
    referenteA: "FORNECEDOR A ref. NF 123",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    fornecedor: "FORNECEDOR TESTE A",
    empresaNome: "PALITOS INDUSTRIA",
  },
  {
    maxiprodId: 90002,
    estado: "EMITIDO",
    tipo: "TITULO",
    valorOriginal: "3000.00",
    valorLiquido: "3000.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorPagoLiquido: "0.00",
    emissaoData: "2026-02-15T00:00:00",
    vencimentoData: "2026-03-20T00:00:00", // a vencer (esta semana ou próxima)
    vencimentoOriginalData: "2026-03-20T00:00:00",
    referenteA: "FORNECEDOR B ref. NF 456",
    parcela: 1,
    parcelasQuantidadeTotal: 2,
    fornecedor: "FORNECEDOR TESTE B",
    empresaNome: "PALITOS INDUSTRIA",
  },
  {
    maxiprodId: 90003,
    estado: "PAGO",
    tipo: "TITULO",
    valorOriginal: "500.00",
    valorLiquido: "500.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorPagoLiquido: "500.00",
    emissaoData: "2026-01-10T00:00:00",
    vencimentoData: "2026-02-10T00:00:00",
    vencimentoOriginalData: "2026-02-10T00:00:00",
    liquidacaoData: "2026-02-10T00:00:00",
    referenteA: "FORNECEDOR A ref. NF 100",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    fornecedor: "FORNECEDOR TESTE A",
    empresaNome: "PALITOS INDUSTRIA",
  },
  {
    maxiprodId: 90004,
    estado: "CANCELADO",
    tipo: "TITULO",
    valorOriginal: "999.00",
    valorLiquido: "999.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorPagoLiquido: "0.00",
    emissaoData: "2026-01-01T00:00:00",
    vencimentoData: "2026-01-15T00:00:00",
    referenteA: "CANCELADA",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    fornecedor: "FORNECEDOR CANCELADO",
    empresaNome: "PALITOS INDUSTRIA",
  },
];

// Sample test data - Contas a Receber
const sampleReceivables = [
  {
    maxiprodId: 80001,
    estado: "EMITIDO",
    tipo: "TITULO",
    valorOriginal: "5000.00",
    valorLiquido: "5000.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorRecebidoLiquido: "0.00",
    emissaoData: "2026-01-15T00:00:00",
    vencimentoData: "2026-02-15T00:00:00", // vencida (inadimplência ~27 dias)
    vencimentoOriginalData: "2026-02-15T00:00:00",
    referenteA: "CLIENTE A ref. NF 789",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    cliente: "CLIENTE TESTE A",
    empresaNome: "PALITOS INDUSTRIA",
  },
  {
    maxiprodId: 80002,
    estado: "EMITIDO",
    tipo: "TITULO",
    valorOriginal: "2000.00",
    valorLiquido: "2000.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorRecebidoLiquido: "0.00",
    emissaoData: "2026-03-01T00:00:00",
    vencimentoData: "2026-04-01T00:00:00", // a vencer
    vencimentoOriginalData: "2026-04-01T00:00:00",
    referenteA: "CLIENTE B ref. NF 101",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    cliente: "CLIENTE TESTE B",
    empresaNome: "PALITOS INDUSTRIA",
  },
  {
    maxiprodId: 80003,
    estado: "RECEBIDO",
    tipo: "TITULO",
    valorOriginal: "800.00",
    valorLiquido: "800.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorRecebidoLiquido: "800.00",
    emissaoData: "2026-01-01T00:00:00",
    vencimentoData: "2026-01-30T00:00:00",
    vencimentoOriginalData: "2026-01-30T00:00:00",
    liquidacaoData: "2026-01-28T00:00:00",
    referenteA: "CLIENTE A ref. NF 700",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    cliente: "CLIENTE TESTE A",
    empresaNome: "PALITOS INDUSTRIA",
  },
  {
    maxiprodId: 80004,
    estado: "EMITIDO",
    tipo: "TITULO",
    valorOriginal: "10000.00",
    valorLiquido: "10000.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorRecebidoLiquido: "0.00",
    emissaoData: "2025-06-01T00:00:00",
    vencimentoData: "2025-09-01T00:00:00", // vencida há >90 dias
    vencimentoOriginalData: "2025-09-01T00:00:00",
    referenteA: "CLIENTE C ref. NF 500",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    cliente: "CLIENTE TESTE C",
    empresaNome: "PALITOS INDUSTRIA",
  },
];

/**
 * Backup and restore production financial data to prevent data loss during tests.
 */
let backupPayables: any[] = [];
let backupReceivables: any[] = [];

describe("financial router", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);

  // Backup production data, then insert test data
  beforeAll(async () => {
    const db = await getDb();
    if (db) {
      // Backup
      backupPayables = await db.select().from(accountsPayable);
      backupReceivables = await db.select().from(accountsReceivable);

      // Clear and insert test data
      await db.delete(accountsPayable);
      await db.delete(accountsReceivable);

      await db.insert(accountsPayable).values(samplePayables as any);
      await db.insert(accountsReceivable).values(sampleReceivables as any);
    }
  });

  // Restore production data after all tests
  afterAll(async () => {
    const db = await getDb();
    if (db) {
      await db.delete(accountsPayable);
      await db.delete(accountsReceivable);

      if (backupPayables.length > 0) {
        for (let i = 0; i < backupPayables.length; i += 50) {
          await db.insert(accountsPayable).values(backupPayables.slice(i, i + 50));
        }
      }
      if (backupReceivables.length > 0) {
        for (let i = 0; i < backupReceivables.length; i += 50) {
          await db.insert(accountsReceivable).values(backupReceivables.slice(i, i + 50));
        }
      }
    }
  });

  describe("getSummary", () => {
    it("returns financial summary with correct totals", async () => {
      const result = await caller.financial.getSummary();
      expect(result).not.toBeNull();

      // Pagar em aberto: 1500 + 3000 = 4500 (only EMITIDO)
      expect(result!.pagar.emAberto.total).toBe(4500);
      expect(result!.pagar.emAberto.count).toBe(2);

      // Pagar pagas: 500
      expect(result!.pagar.pagas.total).toBe(500);
      expect(result!.pagar.pagas.count).toBe(1);

      // Receber em aberto: 5000 + 2000 + 10000 = 17000 (only EMITIDO)
      expect(result!.receber.emAberto.total).toBe(17000);
      expect(result!.receber.emAberto.count).toBe(3);

      // Receber recebidas: 800
      expect(result!.receber.recebidas.total).toBe(800);
      expect(result!.receber.recebidas.count).toBe(1);
    });

    it("calculates overdue payables correctly", async () => {
      const result = await caller.financial.getSummary();
      expect(result).not.toBeNull();

      // Vencidas a pagar: only maxiprodId 90001 (vencimento 2026-03-10 < today 2026-03-14)
      expect(result!.pagar.vencidas.total).toBe(1500);
      expect(result!.pagar.vencidas.count).toBe(1);
    });

    it("calculates overdue receivables (inadimplência) correctly", async () => {
      const result = await caller.financial.getSummary();
      expect(result).not.toBeNull();

      // Vencidas a receber: 80001 (vencimento 2026-02-15) + 80004 (vencimento 2025-09-01)
      expect(result!.receber.vencidas.total).toBe(15000);
      expect(result!.receber.vencidas.count).toBe(2);
    });
  });

  describe("getContasAPagar", () => {
    it("returns payables list excluding cancelled", async () => {
      const result = await caller.financial.getContasAPagar();
      expect(result.items.length).toBe(3); // 4 total - 1 cancelled
      expect(result.total).toBe(3);
    });

    it("filters by estado EMITIDO", async () => {
      const result = await caller.financial.getContasAPagar({ estado: "EMITIDO" });
      expect(result.items.length).toBe(2);
      expect(result.items.every((i: any) => i.estado === "EMITIDO")).toBe(true);
    });

    it("filters by estado PAGO", async () => {
      const result = await caller.financial.getContasAPagar({ estado: "PAGO" });
      expect(result.items.length).toBe(1);
      expect(result.items[0].fornecedor).toBe("FORNECEDOR TESTE A");
    });

    it("supports pagination", async () => {
      const page1 = await caller.financial.getContasAPagar({ limit: 2, offset: 0 });
      const page2 = await caller.financial.getContasAPagar({ limit: 2, offset: 2 });
      expect(page1.items.length).toBe(2);
      expect(page2.items.length).toBe(1);
      expect(page1.total).toBe(3);
    });

    it("supports sorting by valor", async () => {
      const result = await caller.financial.getContasAPagar({
        sortBy: "valorLiquido",
        sortDir: "desc",
      });
      const values = result.items.map((i: any) => Number(i.valorLiquido));
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
      }
    });
  });

  describe("getContasAReceber", () => {
    it("returns receivables list (all non-cancelled)", async () => {
      const result = await caller.financial.getContasAReceber();
      expect(result.items.length).toBe(4); // no cancelled in test data
      expect(result.total).toBe(4);
    });

    it("filters by estado EMITIDO", async () => {
      const result = await caller.financial.getContasAReceber({ estado: "EMITIDO" });
      expect(result.items.length).toBe(3);
      expect(result.items.every((i: any) => i.estado === "EMITIDO")).toBe(true);
    });

    it("filters by estado RECEBIDO", async () => {
      const result = await caller.financial.getContasAReceber({ estado: "RECEBIDO" });
      expect(result.items.length).toBe(1);
      expect(result.items[0].cliente).toBe("CLIENTE TESTE A");
    });

    it("supports pagination", async () => {
      const page1 = await caller.financial.getContasAReceber({ limit: 2, offset: 0 });
      expect(page1.items.length).toBe(2);
      expect(page1.total).toBe(4);
    });
  });

  describe("getAgingReport", () => {
    it("returns aging buckets with correct categorization", async () => {
      const result = await caller.financial.getAgingReport();
      expect(result).not.toBeNull();

      // 80002 (vencimento 2026-04-01) -> a vencer
      expect(result!.aging.aVencer.count).toBe(1);
      expect(result!.aging.aVencer.total).toBe(2000);

      // 80001 (vencimento 2026-02-15, ~27 dias atrás) -> 1-30 dias
      expect(result!.aging.de1a30.count).toBe(1);
      expect(result!.aging.de1a30.total).toBe(5000);

      // 80004 (vencimento 2025-09-01, >90 dias) -> acima de 90
      expect(result!.aging.acima90.count).toBe(1);
      expect(result!.aging.acima90.total).toBe(10000);
    });

    it("returns top devedores sorted by value", async () => {
      const result = await caller.financial.getAgingReport();
      expect(result).not.toBeNull();
      expect(result!.topDevedores.length).toBeGreaterThan(0);

      // CLIENTE TESTE C should be top (R$ 10.000)
      expect(result!.topDevedores[0].cliente).toBe("CLIENTE TESTE C");
      expect(result!.topDevedores[0].totalVencido).toBe(10000);
    });
  });

  describe("getPaymentCalendar", () => {
    it("returns payment calendar with categorized items", async () => {
      const result = await caller.financial.getPaymentCalendar();
      expect(result).not.toBeNull();

      // Structure: { vencidas: Bucket, weeks: Bucket[] }
      expect(result!.vencidas).toBeDefined();
      expect(result!.weeks).toBeDefined();
      expect(Array.isArray(result!.weeks)).toBe(true);
      expect(result!.weeks.length).toBe(8);

      // 90001 (vencimento 2026-03-10 < today) -> vencidas
      expect(result!.vencidas.count).toBeGreaterThanOrEqual(1);
      expect(result!.vencidas.total).toBeGreaterThanOrEqual(1500);

      // Total items across all periods should include at least 2 (only EMITIDO)
      const totalCount =
        result!.vencidas.count +
        result!.weeks.reduce((sum: number, w: any) => sum + w.count, 0);
      expect(totalCount).toBeGreaterThanOrEqual(2);
    });

    it("includes item details in calendar entries", async () => {
      const result = await caller.financial.getPaymentCalendar();
      expect(result).not.toBeNull();

      if (result!.vencidas.items.length > 0) {
        const item = result!.vencidas.items[0];
        expect(item).toHaveProperty("fornecedor");
        expect(item).toHaveProperty("valor");
        expect(item).toHaveProperty("vencimento");
      }
    });
  });

  describe("getTopFornecedores", () => {
    it("returns top fornecedores by open value", async () => {
      const result = await caller.financial.getTopFornecedores();
      expect(result.length).toBeGreaterThan(0);

      // FORNECEDOR TESTE B should be top (R$ 3.000 em aberto)
      expect(result[0].fornecedor).toBe("FORNECEDOR TESTE B");
      expect(result[0].totalEmAberto).toBe(3000);
    });

    it("excludes cancelled accounts from fornecedores", async () => {
      const result = await caller.financial.getTopFornecedores();
      const cancelled = result.find((r: any) => r.fornecedor === "FORNECEDOR CANCELADO");
      expect(cancelled).toBeUndefined();
    });
  });

  describe("getTopClientes", () => {
    it("returns top clientes by open receivable value", async () => {
      const result = await caller.financial.getTopClientes();
      expect(result.length).toBeGreaterThan(0);

      // CLIENTE TESTE C should be top (R$ 10.000 em aberto)
      expect(result[0].cliente).toBe("CLIENTE TESTE C");
      expect(result[0].totalEmAberto).toBe(10000);
    });

    it("includes received totals for clientes", async () => {
      const result = await caller.financial.getTopClientes();
      // CLIENTE TESTE A has both open (5000) and received (800)
      const clienteA = result.find((r: any) => r.cliente === "CLIENTE TESTE A");
      expect(clienteA).toBeDefined();
      expect(clienteA!.totalEmAberto).toBe(5000);
      expect(clienteA!.totalRecebido).toBe(800);
    });
  });

  describe("getInadimplenciaTimeline", () => {
    it("returns timeline data grouped by month", async () => {
      const result = await caller.financial.getInadimplenciaTimeline();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Each point should have mes, total, count
      const point = result[0];
      expect(point).toHaveProperty("mes");
      expect(point).toHaveProperty("total");
      expect(point).toHaveProperty("count");
      expect(typeof point.mes).toBe("string");
      expect(typeof point.total).toBe("number");
      expect(typeof point.count).toBe("number");
    });

    it("includes only overdue EMITIDO receivables", async () => {
      const result = await caller.financial.getInadimplenciaTimeline();
      // Test data has 2 overdue EMITIDO receivables:
      // 80001: vencimento 2026-02-15, valor 5000
      // 80004: vencimento 2025-09-01, valor 10000
      const totalValue = result.reduce((sum: number, p: any) => sum + p.total, 0);
      expect(totalValue).toBe(15000);

      const totalCount = result.reduce((sum: number, p: any) => sum + p.count, 0);
      expect(totalCount).toBe(2);
    });

    it("returns months in ascending order", async () => {
      const result = await caller.financial.getInadimplenciaTimeline();
      for (let i = 1; i < result.length; i++) {
        expect(result[i].mes >= result[i - 1].mes).toBe(true);
      }
    });

    it("does not include future or non-overdue receivables", async () => {
      const result = await caller.financial.getInadimplenciaTimeline();
      // 80002 (vencimento 2026-04-01) should NOT be included (not overdue)
      const aprilEntry = result.find((p: any) => p.mes === "2026-04");
      expect(aprilEntry).toBeUndefined();
    });
  });
});
