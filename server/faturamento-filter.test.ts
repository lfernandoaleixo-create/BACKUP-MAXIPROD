import { describe, it, expect } from "vitest";

/**
 * Tests for the faturamento filter logic and Rojão unit display.
 * These test the business rules without hitting the real Maxiprod API.
 */

// Replicate the FATURAMENTO_ESTADOS_EXCLUIDOS set from maxiprodGraphQL.ts
const FATURAMENTO_ESTADOS_EXCLUIDOS = new Set([
  'CANCELADO',
  'AMOSTRA',
  'BONIFICAÇÃO',
  'BONIFICACAO',
  'DEVOLUÇÃO',
  'DEVOLUCAO',
  'REMESSA',
  'RECUSA',
]);

// Replicate the filter logic from fetchInvoicesTotal
function shouldIncludeNF(item: { entradaOuSaida: string; estadoConfiguravel?: { descricao?: string } }) {
  if (item.entradaOuSaida !== 'SAIDA') return false;
  const ec = (item.estadoConfiguravel?.descricao || '').toUpperCase();
  if (!ec || FATURAMENTO_ESTADOS_EXCLUIDOS.has(ec)) return false;
  return true;
}

// Replicate the getUnit logic from Home.tsx
function getUnit(codigoItem: string, isKgProduct: boolean, hasCx: boolean): string {
  if (isKgProduct) return "kg";
  if (codigoItem === "00129") return "dz";
  return hasCx ? "cx" : "un";
}

describe("Faturamento filter", () => {
  it("should include regular SAIDA NFs (BAMBU, MADEIRA, FIBRA)", () => {
    expect(shouldIncludeNF({ entradaOuSaida: "SAIDA", estadoConfiguravel: { descricao: "BAMBU" } })).toBe(true);
    expect(shouldIncludeNF({ entradaOuSaida: "SAIDA", estadoConfiguravel: { descricao: "MADEIRA" } })).toBe(true);
    expect(shouldIncludeNF({ entradaOuSaida: "SAIDA", estadoConfiguravel: { descricao: "FIBRA" } })).toBe(true);
  });

  it("should exclude CANCELADO", () => {
    expect(shouldIncludeNF({ entradaOuSaida: "SAIDA", estadoConfiguravel: { descricao: "CANCELADO" } })).toBe(false);
  });

  it("should exclude AMOSTRA", () => {
    expect(shouldIncludeNF({ entradaOuSaida: "SAIDA", estadoConfiguravel: { descricao: "AMOSTRA" } })).toBe(false);
  });

  it("should exclude BONIFICAÇÃO (with and without accent)", () => {
    expect(shouldIncludeNF({ entradaOuSaida: "SAIDA", estadoConfiguravel: { descricao: "BONIFICAÇÃO" } })).toBe(false);
    expect(shouldIncludeNF({ entradaOuSaida: "SAIDA", estadoConfiguravel: { descricao: "BONIFICACAO" } })).toBe(false);
  });

  it("should exclude DEVOLUÇÃO (with and without accent)", () => {
    expect(shouldIncludeNF({ entradaOuSaida: "SAIDA", estadoConfiguravel: { descricao: "DEVOLUÇÃO" } })).toBe(false);
    expect(shouldIncludeNF({ entradaOuSaida: "SAIDA", estadoConfiguravel: { descricao: "DEVOLUCAO" } })).toBe(false);
  });

  it("should exclude REMESSA", () => {
    expect(shouldIncludeNF({ entradaOuSaida: "SAIDA", estadoConfiguravel: { descricao: "REMESSA" } })).toBe(false);
  });

  it("should exclude RECUSA", () => {
    expect(shouldIncludeNF({ entradaOuSaida: "SAIDA", estadoConfiguravel: { descricao: "RECUSA" } })).toBe(false);
  });

  it("should exclude ENTRADA NFs", () => {
    expect(shouldIncludeNF({ entradaOuSaida: "ENTRADA", estadoConfiguravel: { descricao: "BAMBU" } })).toBe(false);
  });

  it("should exclude NFs without estadoConfiguravel", () => {
    expect(shouldIncludeNF({ entradaOuSaida: "SAIDA", estadoConfiguravel: undefined })).toBe(false);
    expect(shouldIncludeNF({ entradaOuSaida: "SAIDA", estadoConfiguravel: { descricao: "" } })).toBe(false);
  });
});

describe("Rojão unit display", () => {
  it("should return 'dz' for Rojão (00129)", () => {
    expect(getUnit("00129", false, true)).toBe("dz");
    expect(getUnit("00129", false, false)).toBe("dz");
  });

  it("should return 'cx' for regular products with box conversion", () => {
    expect(getUnit("00107", false, true)).toBe("cx");
  });

  it("should return 'un' for regular products without box conversion", () => {
    expect(getUnit("00107", false, false)).toBe("un");
  });

  it("should return 'kg' for kg products regardless of code", () => {
    expect(getUnit("00129", true, true)).toBe("kg");
    expect(getUnit("00107", true, false)).toBe("kg");
  });
});
