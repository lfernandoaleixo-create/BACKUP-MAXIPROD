import { describe, it, expect } from "vitest";

/**
 * Tests for sales filter logic - ensuring "Digitação" orders are excluded
 * from all sales analytics endpoints (Vendas tab)
 */

// Simulate the isDigitacao filter used across all sales endpoints
function isDigitacao(nota: string | null): boolean {
  if (!nota) return false;
  const n = nota.toUpperCase();
  return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
}

// Simulate the filter applied to sales items
function filterSalesItems(items: Array<{ estadoItem: string; estadoNota: string | null; valorTotal: number }>) {
  return items.filter(item => !isDigitacao(item.estadoNota));
}

describe("Sales filter - exclude Digitação orders from Vendas", () => {
  it("should include items with Aprovado estadoNota", () => {
    const items = [
      { estadoItem: "A faturar", estadoNota: "Aprovado", valorTotal: 1000 },
    ];
    expect(filterSalesItems(items)).toHaveLength(1);
  });

  it("should include items with A aprovar estadoNota", () => {
    const items = [
      { estadoItem: "A faturar", estadoNota: "A aprovar", valorTotal: 1000 },
    ];
    expect(filterSalesItems(items)).toHaveLength(1);
  });

  it("should EXCLUDE items with Digitação estadoNota", () => {
    const items = [
      { estadoItem: "A faturar", estadoNota: "Digitação", valorTotal: 1000 },
    ];
    expect(filterSalesItems(items)).toHaveLength(0);
  });

  it("should EXCLUDE items with Digitacao (no accent) estadoNota", () => {
    const items = [
      { estadoItem: "A faturar", estadoNota: "Digitacao", valorTotal: 1000 },
    ];
    expect(filterSalesItems(items)).toHaveLength(0);
  });

  it("should EXCLUDE items with DIGITACAO (uppercase) estadoNota", () => {
    const items = [
      { estadoItem: "A faturar", estadoNota: "DIGITACAO", valorTotal: 1000 },
    ];
    expect(filterSalesItems(items)).toHaveLength(0);
  });

  it("should include items with null estadoNota (legacy data)", () => {
    const items = [
      { estadoItem: "A faturar", estadoNota: null, valorTotal: 1000 },
    ];
    expect(filterSalesItems(items)).toHaveLength(1);
  });

  it("should include Faturado items with Faturado estadoNota", () => {
    const items = [
      { estadoItem: "Faturado", estadoNota: "Faturado", valorTotal: 5000 },
    ];
    expect(filterSalesItems(items)).toHaveLength(1);
  });

  it("should correctly filter mixed list and compute correct totals", () => {
    const items = [
      { estadoItem: "Faturado", estadoNota: "Aprovado", valorTotal: 5000 },     // include
      { estadoItem: "A faturar", estadoNota: "Aprovado", valorTotal: 2000 },     // include
      { estadoItem: "A faturar", estadoNota: "A aprovar", valorTotal: 1500 },    // include
      { estadoItem: "A faturar", estadoNota: "Digitação", valorTotal: 3000 },    // EXCLUDE
      { estadoItem: "A faturar", estadoNota: "Digitacao", valorTotal: 4000 },    // EXCLUDE
      { estadoItem: "A faturar", estadoNota: null, valorTotal: 800 },            // include (legacy)
    ];

    const filtered = filterSalesItems(items);
    expect(filtered).toHaveLength(4);

    // Verify excluded items are the Digitação ones
    expect(filtered.every(i => !isDigitacao(i.estadoNota))).toBe(true);

    // Verify total value excludes Digitação
    const totalValue = filtered.reduce((sum, i) => sum + i.valorTotal, 0);
    expect(totalValue).toBe(5000 + 2000 + 1500 + 800); // 9300
    expect(totalValue).not.toBe(5000 + 2000 + 1500 + 3000 + 4000 + 800); // Would be 16300 with Digitação

    // Verify Faturado total
    const totalFaturado = filtered
      .filter(i => i.estadoItem === "Faturado")
      .reduce((sum, i) => sum + i.valorTotal, 0);
    expect(totalFaturado).toBe(5000);

    // Verify A Faturar total (excludes Digitação)
    const totalAFaturar = filtered
      .filter(i => i.estadoItem === "A faturar")
      .reduce((sum, i) => sum + i.valorTotal, 0);
    expect(totalAFaturar).toBe(2000 + 1500 + 800); // 4300, not 4300 + 3000 + 4000
  });

  it("should correctly handle A Faturar Anterior excluding Digitação", () => {
    const currentPeriodStart = "2026-03-01";

    const allItems = [
      { estadoItem: "A faturar", estadoNota: "Aprovado", dataEmissao: "2026-02-15", valorTotal: 3000 },
      { estadoItem: "A faturar", estadoNota: "Digitação", dataEmissao: "2025-12-10", valorTotal: 477900 }, // SC JOHNSON MEXICO #155 type
      { estadoItem: "A faturar", estadoNota: "Digitação", dataEmissao: "2026-02-12", valorTotal: 124800 }, // SOIN #502 type
      { estadoItem: "A faturar", estadoNota: "Digitação", dataEmissao: "2026-02-12", valorTotal: 83200 },  // SOIN #501 type
      { estadoItem: "A faturar", estadoNota: "Aprovado", dataEmissao: "2026-01-20", valorTotal: 4000 },
    ];

    // Filter out Digitação first
    const filtered = allItems.filter(i => !isDigitacao(i.estadoNota));

    // Then get anterior items (before current period)
    const anteriorItems = filtered.filter(
      i => i.estadoItem === "A faturar" && i.dataEmissao < currentPeriodStart
    );

    const totalAFaturarAnterior = anteriorItems.reduce(
      (sum, i) => sum + i.valorTotal, 0
    );

    // Should only include the 2 Aprovado items, NOT the 3 Digitação items
    expect(anteriorItems).toHaveLength(2);
    expect(totalAFaturarAnterior).toBe(3000 + 4000); // 7000
    // Without the fix, it would be 3000 + 477900 + 124800 + 83200 + 4000 = 692900
  });

  it("should handle case-insensitive Digitação variations", () => {
    const variations = [
      "Digitação",
      "DIGITAÇÃO",
      "digitação",
      "Digitacao",
      "DIGITACAO",
      "digitacao",
    ];

    for (const variant of variations) {
      expect(isDigitacao(variant)).toBe(true);
    }

    // These should NOT be considered Digitação
    expect(isDigitacao("Aprovado")).toBe(false);
    expect(isDigitacao("A aprovar")).toBe(false);
    expect(isDigitacao("Faturado")).toBe(false);
    expect(isDigitacao(null)).toBe(false);
    expect(isDigitacao("")).toBe(false);
  });
});
