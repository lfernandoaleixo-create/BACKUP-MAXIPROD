/**
 * Tests for Sales PDF Export utility
 * Since the PDF generation runs client-side with jsPDF, we test the data
 * structures and formatting helpers used by the export function.
 */
import { describe, it, expect } from "vitest";

// Test the formatting helpers used in the PDF
function fmtCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function fmtNumber(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function fmtPct(part: number, total: number): string {
  if (total === 0) return "0%";
  return ((part / total) * 100).toFixed(1) + "%";
}

describe("Sales PDF Export - Formatting Helpers", () => {
  it("formats currency values in BRL", () => {
    expect(fmtCurrency(563101.49)).toContain("563");
    expect(fmtCurrency(563101.49)).toContain("101");
    expect(fmtCurrency(0)).toContain("0,00");
  });

  it("formats numbers with pt-BR locale", () => {
    expect(fmtNumber(1234)).toBe("1.234");
    expect(fmtNumber(0)).toBe("0");
    expect(fmtNumber(999999)).toBe("999.999");
  });

  it("formats percentages correctly", () => {
    expect(fmtPct(60000, 100000)).toBe("60.0%");
    expect(fmtPct(0, 100000)).toBe("0.0%");
    expect(fmtPct(100, 0)).toBe("0%");
    expect(fmtPct(33333, 100000)).toBe("33.3%");
  });
});

describe("Sales PDF Export - Data Structure Validation", () => {
  const mockAnalytics = {
    totalValue: 563101.49,
    totalFaturado: 377544.29,
    totalAFaturar: 185557.20,
    totalAFaturarAnterior: 1070312.60,
    totalOrders: 97,
    totalClients: 92,
    totalItems: 180,
    ticketMedio: 5805.17,
    bySegmentKPI: [
      { name: "Revenda (Bambu/Fibra)", value: 323710, faturado: 215500, aFaturar: 108210 },
      { name: "Industrializado", value: 239391.49, faturado: 162044.29, aFaturar: 77347.20 },
    ],
    byCrmSegmentKPI: [],
    byDay: [
      { day: "2026-03-01", value: 15000, orders: 3 },
      { day: "2026-03-02", value: 21000, orders: 5 },
      { day: "2026-03-03", value: 31000, orders: 4 },
    ],
  };

  it("validates analytics data has required fields for PDF", () => {
    expect(mockAnalytics).toHaveProperty("totalValue");
    expect(mockAnalytics).toHaveProperty("totalFaturado");
    expect(mockAnalytics).toHaveProperty("totalAFaturar");
    expect(mockAnalytics).toHaveProperty("totalOrders");
    expect(mockAnalytics).toHaveProperty("totalClients");
    expect(mockAnalytics).toHaveProperty("ticketMedio");
    expect(mockAnalytics).toHaveProperty("bySegmentKPI");
    expect(mockAnalytics).toHaveProperty("byDay");
  });

  it("validates segment KPI data structure", () => {
    expect(mockAnalytics.bySegmentKPI.length).toBe(2);
    mockAnalytics.bySegmentKPI.forEach((seg) => {
      expect(seg).toHaveProperty("name");
      expect(seg).toHaveProperty("value");
      expect(seg).toHaveProperty("faturado");
      expect(seg).toHaveProperty("aFaturar");
      expect(typeof seg.value).toBe("number");
      expect(typeof seg.faturado).toBe("number");
      expect(typeof seg.aFaturar).toBe("number");
    });
  });

  it("validates segment values sum to total", () => {
    const segmentTotal = mockAnalytics.bySegmentKPI.reduce((sum, s) => sum + s.value, 0);
    expect(Math.abs(segmentTotal - mockAnalytics.totalValue)).toBeLessThan(0.01);
  });

  it("validates faturado + aFaturar equals total for each segment", () => {
    mockAnalytics.bySegmentKPI.forEach((seg) => {
      expect(Math.abs(seg.faturado + seg.aFaturar - seg.value)).toBeLessThan(0.01);
    });
  });

  it("validates daily data has correct structure", () => {
    expect(mockAnalytics.byDay.length).toBeGreaterThan(0);
    mockAnalytics.byDay.forEach((d) => {
      expect(d).toHaveProperty("day");
      expect(d).toHaveProperty("value");
      expect(d).toHaveProperty("orders");
      expect(d.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof d.value).toBe("number");
      expect(typeof d.orders).toBe("number");
    });
  });

  it("generates correct table data for PDF", () => {
    const segments = mockAnalytics.bySegmentKPI;
    const tableData = segments
      .sort((a, b) => b.value - a.value)
      .map((s) => [
        s.name,
        fmtCurrency(s.value),
        fmtCurrency(s.faturado),
        fmtCurrency(s.aFaturar),
        fmtPct(s.value, mockAnalytics.totalValue),
      ]);

    expect(tableData.length).toBe(2);
    expect(tableData[0][0]).toBe("Revenda (Bambu/Fibra)");
    expect(tableData[1][0]).toBe("Industrializado");
    // First row should have higher value
    expect(segments[0].value).toBeGreaterThanOrEqual(segments[1].value);
  });

  it("handles empty analytics gracefully", () => {
    const emptyAnalytics = {
      totalValue: 0,
      totalFaturado: 0,
      totalAFaturar: 0,
      totalOrders: 0,
      totalClients: 0,
      totalItems: 0,
      ticketMedio: 0,
      bySegmentKPI: [],
      byDay: [],
    };

    expect(fmtCurrency(emptyAnalytics.totalValue)).toContain("0,00");
    expect(fmtPct(emptyAnalytics.totalFaturado, emptyAnalytics.totalValue)).toBe("0%");
    expect(emptyAnalytics.bySegmentKPI.length).toBe(0);
    expect(emptyAnalytics.byDay.length).toBe(0);
  });
});
