import { describe, it, expect } from "vitest";

const CREDIT_CARD_ALLOWED = ["Guilherme", "Flavio"];

describe("Credit Card Planilha - Access Control", () => {
  it("should allow Guilherme access", () => {
    expect(CREDIT_CARD_ALLOWED.includes("Guilherme")).toBe(true);
  });

  it("should allow Flavio access", () => {
    expect(CREDIT_CARD_ALLOWED.includes("Flavio")).toBe(true);
  });

  it("should deny Pedro access", () => {
    expect(CREDIT_CARD_ALLOWED.includes("Pedro")).toBe(false);
  });

  it("should deny Thiago access", () => {
    expect(CREDIT_CARD_ALLOWED.includes("Thiago")).toBe(false);
  });

  it("should deny empty operator", () => {
    expect(CREDIT_CARD_ALLOWED.includes("")).toBe(false);
  });
});

describe("Credit Card Planilha - Auto mesInicio Calculation", () => {
  function calcMesInicio(dataCompra: string, fechamentoFatura: number): string {
    const [year, month, day] = dataCompra.split("-").map(Number);
    if (day <= fechamentoFatura) {
      return `${year}-${String(month).padStart(2, "0")}`;
    } else {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
    }
  }

  it("compra antes do fechamento entra na fatura do mesmo mês", () => {
    // Fechamento dia 2, compra dia 1 de maio → fatura maio
    expect(calcMesInicio("2026-05-01", 2)).toBe("2026-05");
  });

  it("compra no dia do fechamento entra na fatura do mesmo mês", () => {
    // Fechamento dia 2, compra dia 2 de maio → fatura maio
    expect(calcMesInicio("2026-05-02", 2)).toBe("2026-05");
  });

  it("compra depois do fechamento entra na fatura do mês seguinte", () => {
    // Fechamento dia 2, compra dia 3 de maio → fatura junho
    expect(calcMesInicio("2026-05-03", 2)).toBe("2026-06");
  });

  it("compra em dezembro depois do fechamento vai para janeiro do próximo ano", () => {
    expect(calcMesInicio("2026-12-15", 10)).toBe("2027-01");
  });

  it("compra em dezembro antes do fechamento fica em dezembro", () => {
    expect(calcMesInicio("2026-12-05", 10)).toBe("2026-12");
  });

  it("fechamento dia 25, compra dia 20 → mesmo mês", () => {
    expect(calcMesInicio("2026-03-20", 25)).toBe("2026-03");
  });

  it("fechamento dia 25, compra dia 26 → mês seguinte", () => {
    expect(calcMesInicio("2026-03-26", 25)).toBe("2026-04");
  });
});

describe("Credit Card Planilha - Parcel Calculation", () => {
  function getParcelValueForMonth(entry: { mesInicio?: string; quantParcelas?: number; valorParcela?: string }, targetMonth: string): number {
    if (!entry.mesInicio || !entry.quantParcelas) return 0;
    const [startY, startM] = entry.mesInicio.split("-").map(Number);
    const [targetY, targetM] = targetMonth.split("-").map(Number);
    const diff = (targetY - startY) * 12 + (targetM - startM);
    if (diff < 0 || diff >= entry.quantParcelas) return 0;
    return parseFloat(entry.valorParcela || "0");
  }

  it("should return parcela value for valid months within range", () => {
    const entry = { mesInicio: "2026-06", quantParcelas: 6, valorParcela: "833.33" };
    expect(getParcelValueForMonth(entry, "2026-06")).toBeCloseTo(833.33);
    expect(getParcelValueForMonth(entry, "2026-07")).toBeCloseTo(833.33);
    expect(getParcelValueForMonth(entry, "2026-11")).toBeCloseTo(833.33);
  });

  it("should return 0 for months before start", () => {
    const entry = { mesInicio: "2026-06", quantParcelas: 6, valorParcela: "833.33" };
    expect(getParcelValueForMonth(entry, "2026-05")).toBe(0);
    expect(getParcelValueForMonth(entry, "2025-12")).toBe(0);
  });

  it("should return 0 for months after all parcels are paid", () => {
    const entry = { mesInicio: "2026-06", quantParcelas: 6, valorParcela: "833.33" };
    expect(getParcelValueForMonth(entry, "2026-12")).toBe(0);
    expect(getParcelValueForMonth(entry, "2027-01")).toBe(0);
  });

  it("should return 0 if mesInicio is missing", () => {
    const entry = { quantParcelas: 6, valorParcela: "833.33" };
    expect(getParcelValueForMonth(entry, "2026-06")).toBe(0);
  });

  it("should handle single parcel (à vista)", () => {
    const entry = { mesInicio: "2026-06", quantParcelas: 1, valorParcela: "5000.00" };
    expect(getParcelValueForMonth(entry, "2026-06")).toBeCloseTo(5000);
    expect(getParcelValueForMonth(entry, "2026-07")).toBe(0);
  });
});
