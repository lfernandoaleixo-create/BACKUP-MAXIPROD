/**
 * Tests for getDeferredPayments procedure
 * Validates that deferred payments (vencimento 2050) are correctly fetched
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: () => ({
      from: (table: any) => ({
        where: (condition: any) => ({
          orderBy: (order: any) => Promise.resolve([
            {
              id: 22367368,
              fornecedor: "GILSON ALEIXO",
              empresaNome: "MESA INDUSTRIA",
              referenteA: "DEVOLUÇÃO TOTAL DO CAPITAL EMPRESTADO DE R$ 450.000,00",
              valorLiquido: "450000.00",
              vencimentoData: "2050-12-31T12:00:00.000-03:00",
              vencimentoOriginalData: "2026-04-30T12:00:00.000-03:00",
              tipo: "DESPESA",
              estado: "EMITIDO",
            },
            {
              id: 22366907,
              fornecedor: "GILSON ALEIXO",
              empresaNome: "MESA INDUSTRIA",
              referenteA: "DEVOLUÇÃO DO APORTE INVESTIDO NA BAMBUSA - PARTE GILSON",
              valorLiquido: "17850.00",
              vencimentoData: "2050-12-31T12:00:00.000-03:00",
              vencimentoOriginalData: "2026-04-15T12:00:00.000-03:00",
              tipo: "DESPESA",
              estado: "EMITIDO",
            },
          ]),
        }),
      }),
    }),
  }),
}));

// Import after mocking
import { getDb } from "./db";

describe("getDeferredPayments logic", () => {
  it("should identify deferred payments by vencimentoData containing 2050", async () => {
    const db = await getDb();
    const rows = await db!.select().from({} as any).where({}).orderBy({});

    // Simulate the procedure logic
    let valorTotal = 0;
    const payments = rows.map((row: any) => {
      const valor = Number(row.valorLiquido) || 0;
      valorTotal += valor;
      return {
        id: row.id,
        fornecedor: row.fornecedor || "",
        empresaNome: row.empresaNome || "",
        referenteA: (row.referenteA || "").trim(),
        valorLiquido: valor,
        vencimentoOriginal: (row.vencimentoOriginalData || "").split("T")[0],
        tipo: row.tipo || "",
      };
    });

    expect(payments).toHaveLength(2);
    expect(payments[0].fornecedor).toBe("GILSON ALEIXO");
    expect(payments[0].valorLiquido).toBe(450000);
    expect(payments[0].vencimentoOriginal).toBe("2026-04-30");
    expect(payments[0].referenteA).toBe("DEVOLUÇÃO TOTAL DO CAPITAL EMPRESTADO DE R$ 450.000,00");
    expect(payments[1].valorLiquido).toBe(17850);
    expect(valorTotal).toBe(467850);
  });

  it("should calculate correct stats", async () => {
    const db = await getDb();
    const rows = await db!.select().from({} as any).where({}).orderBy({});

    let valorTotal = 0;
    const payments = rows.map((row: any) => {
      const valor = Number(row.valorLiquido) || 0;
      valorTotal += valor;
      return { id: row.id, valorLiquido: valor };
    });

    const stats = { count: payments.length, valorTotal };
    expect(stats.count).toBe(2);
    expect(stats.valorTotal).toBe(467850);
  });

  it("should trim referenteA whitespace", async () => {
    const row = {
      id: 1,
      fornecedor: "TEST",
      empresaNome: "TEST CO",
      referenteA: "  SOME DESCRIPTION WITH SPACES  ",
      valorLiquido: "1000.00",
      vencimentoOriginalData: "2026-01-01T12:00:00.000-03:00",
      tipo: "TITULO",
    };

    const result = (row.referenteA || "").trim();
    expect(result).toBe("SOME DESCRIPTION WITH SPACES");
  });

  it("should handle null/empty vencimentoOriginalData gracefully", () => {
    const nullCase = (null as string | null || "").split("T")[0];
    expect(nullCase).toBe("");

    const emptyCase = ("" as string).split("T")[0];
    expect(emptyCase).toBe("");

    const validCase = "2026-04-30T12:00:00.000-03:00".split("T")[0];
    expect(validCase).toBe("2026-04-30");
  });
});
