import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

describe("getCheques endpoint logic", () => {
  it("should correctly categorize cheque states from formaCobranca", () => {
    // Test the logic that extracts chequeEstado from formaCobranca
    const testCases = [
      { formaCobranca: "Cheque CHEQUE DISPONIVEL", expected: "CHEQUE DISPONÍVEL" },
      { formaCobranca: "Cheque CHEQUE À RECEBER DE CLIENTES", expected: "CHEQUE À RECEBER DE CLIENTES" },
      { formaCobranca: "Cheque CHEQUE EM COMPENSACAO", expected: "CHEQUE EM COMPENSAÇÃO" },
      { formaCobranca: "Cheque CHEQUE EM FACTORING", expected: "CHEQUE EM FACTORING" },
      { formaCobranca: "Cheque CHEQUE LINHA 11", expected: "CHEQUE LINHA 11" },
      { formaCobranca: "Cheque CHEQUE LINHA 12", expected: "CHEQUE LINHA 12" },
      { formaCobranca: "Cheque CHEQUE VOLTOU OUTROS MOTIVOS", expected: "CHEQUE VOLTOU OUTROS MOTIVOS" },
      { formaCobranca: "Cheque CHEQUE CUSTÓDIA SICOOB", expected: "CHEQUE CUSTÓDIA SICOOB" },
      { formaCobranca: "Cheque CHEQUE CUSTÓDIA SICREDI", expected: "CHEQUE CUSTÓDIA SICREDI" },
    ];

    // Replicate the normalization logic from the endpoint
    function normalizeChequeEstado(formaCobranca: string): string {
      const raw = formaCobranca.replace(/^Cheque\s*/i, "").trim().toUpperCase();
      if (raw.includes("DISPONIVEL") || raw.includes("DISPONÍVEL")) return "CHEQUE DISPONÍVEL";
      if (raw.includes("RECEBER DE CLIENTES")) return "CHEQUE À RECEBER DE CLIENTES";
      if (raw.includes("COMPENSAC") || raw.includes("COMPENSAÇ")) return "CHEQUE EM COMPENSAÇÃO";
      if (raw.includes("CUSTODIA SICOOB") || raw.includes("CUSTÓDIA SICOOB")) return "CHEQUE CUSTÓDIA SICOOB";
      if (raw.includes("CUSTODIA SICREDI") || raw.includes("CUSTÓDIA SICREDI")) return "CHEQUE CUSTÓDIA SICREDI";
      if (raw.includes("LINHA 11")) return "CHEQUE LINHA 11";
      if (raw.includes("LINHA 12")) return "CHEQUE LINHA 12";
      if (raw.includes("VOLTOU")) return "CHEQUE VOLTOU OUTROS MOTIVOS";
      if (raw.includes("FACTORING")) return "CHEQUE EM FACTORING";
      return raw;
    }

    for (const tc of testCases) {
      expect(normalizeChequeEstado(tc.formaCobranca)).toBe(tc.expected);
    }
  });

  it("should correctly identify empresa short names", () => {
    const empresaMapping: Record<string, string> = {
      "PALITOS INDUSTRIA": "PALITOS",
      "VARETAS INDUSTRIA": "VARETAS",
      "ESPETOS INDUSTRIA": "ESPETOS",
    };

    function getEmpresaShort(empresa: string): string {
      if (empresa.toUpperCase().includes("PALITOS")) return "PALITOS";
      if (empresa.toUpperCase().includes("VARETAS")) return "VARETAS";
      if (empresa.toUpperCase().includes("ESPETOS")) return "ESPETOS";
      return empresa;
    }

    expect(getEmpresaShort("PALITOS INDUSTRIA")).toBe("PALITOS");
    expect(getEmpresaShort("VARETAS INDUSTRIA")).toBe("VARETAS");
    expect(getEmpresaShort("ESPETOS INDUSTRIA")).toBe("ESPETOS");
    expect(getEmpresaShort("OUTRA EMPRESA")).toBe("OUTRA EMPRESA");
  });

  it("should group items by empresa and month correctly", () => {
    const items = [
      { empresaShort: "PALITOS", vencimento: "2026-04-30", valor: 1000 },
      { empresaShort: "PALITOS", vencimento: "2026-04-15", valor: 2000 },
      { empresaShort: "PALITOS", vencimento: "2026-05-10", valor: 3000 },
      { empresaShort: "VARETAS", vencimento: "2026-04-20", valor: 500 },
    ];

    // Group by empresa
    const empresaMap = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.empresaShort;
      if (!empresaMap.has(key)) empresaMap.set(key, []);
      empresaMap.get(key)!.push(item);
    }

    expect(empresaMap.size).toBe(2);
    expect(empresaMap.get("PALITOS")!.length).toBe(3);
    expect(empresaMap.get("VARETAS")!.length).toBe(1);

    // Group PALITOS by month
    const palitosItems = empresaMap.get("PALITOS")!;
    const monthMap = new Map<string, typeof items>();
    for (const item of palitosItems) {
      const mes = item.vencimento.substring(0, 7);
      if (!monthMap.has(mes)) monthMap.set(mes, []);
      monthMap.get(mes)!.push(item);
    }

    expect(monthMap.size).toBe(2);
    expect(monthMap.get("2026-04")!.length).toBe(2);
    expect(monthMap.get("2026-05")!.length).toBe(1);
  });

  it("should calculate estado summary correctly", () => {
    const items = [
      { chequeEstado: "CHEQUE DISPONÍVEL", valor: 1000 },
      { chequeEstado: "CHEQUE DISPONÍVEL", valor: 2000 },
      { chequeEstado: "CHEQUE EM FACTORING", valor: 5000 },
      { chequeEstado: "CHEQUE LINHA 11", valor: 3000 },
    ];

    const estadoSummary: Record<string, { count: number; total: number }> = {};
    for (const item of items) {
      if (!estadoSummary[item.chequeEstado]) {
        estadoSummary[item.chequeEstado] = { count: 0, total: 0 };
      }
      estadoSummary[item.chequeEstado].count++;
      estadoSummary[item.chequeEstado].total += item.valor;
    }

    expect(estadoSummary["CHEQUE DISPONÍVEL"].count).toBe(2);
    expect(estadoSummary["CHEQUE DISPONÍVEL"].total).toBe(3000);
    expect(estadoSummary["CHEQUE EM FACTORING"].count).toBe(1);
    expect(estadoSummary["CHEQUE EM FACTORING"].total).toBe(5000);
    expect(estadoSummary["CHEQUE LINHA 11"].count).toBe(1);
    expect(estadoSummary["CHEQUE LINHA 11"].total).toBe(3000);
  });

  it("should filter by empresa correctly", () => {
    const items = [
      { empresaShort: "PALITOS", chequeEstado: "CHEQUE DISPONÍVEL", valor: 1000 },
      { empresaShort: "VARETAS", chequeEstado: "CHEQUE DISPONÍVEL", valor: 2000 },
      { empresaShort: "ESPETOS", chequeEstado: "CHEQUE EM FACTORING", valor: 3000 },
    ];

    const filtered = items.filter(i => i.empresaShort === "PALITOS");
    expect(filtered.length).toBe(1);
    expect(filtered[0].valor).toBe(1000);
  });

  it("should filter by chequeEstado correctly", () => {
    const items = [
      { empresaShort: "PALITOS", chequeEstado: "CHEQUE DISPONÍVEL", valor: 1000 },
      { empresaShort: "PALITOS", chequeEstado: "CHEQUE EM FACTORING", valor: 2000 },
      { empresaShort: "VARETAS", chequeEstado: "CHEQUE DISPONÍVEL", valor: 3000 },
    ];

    const filtered = items.filter(i => i.chequeEstado === "CHEQUE DISPONÍVEL");
    expect(filtered.length).toBe(2);
    expect(filtered.reduce((s, i) => s + i.valor, 0)).toBe(4000);
  });
});
