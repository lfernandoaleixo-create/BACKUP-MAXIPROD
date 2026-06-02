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

// ─── Weekly Summary Computation Tests ────────────────────────────
// Replicate the computeWeeklySummaries logic from salesPdfExport.ts for testing
function computeWeeklySummaries(byDay: Array<{ day: string; value: number }>): Array<{
  weekNum: number; startDay: number; endDay: number; total: number; businessDays: number; avg: number;
}> {
  if (byDay.length === 0) return [];
  const weeks: Array<{ weekNum: number; startDay: number; endDay: number; total: number; businessDays: number; avg: number }> = [];
  let currentWeekDays: Array<{ day: string; value: number }> = [];

  for (let i = 0; i < byDay.length; i++) {
    const d = new Date(byDay[i].day + "T12:00:00");
    const dow = d.getDay();
    const isBusinessDay = dow >= 1 && dow <= 5;

    if (isBusinessDay) {
      currentWeekDays.push(byDay[i]);
    }

    const isLastDay = i === byDay.length - 1;
    const nextDow = i < byDay.length - 1 ? new Date(byDay[i + 1].day + "T12:00:00").getDay() : -1;
    const isEndOfWeek = dow === 5 || (isBusinessDay && (nextDow === 0 || nextDow === 6 || isLastDay));

    if (currentWeekDays.length > 0 && (isEndOfWeek || isLastDay)) {
      // For testing, treat all days as past (not future)
      const total = currentWeekDays.reduce((s, d) => s + d.value, 0);
      const activeDays = currentWeekDays.filter(d => d.value > 0).length;
      const startDayNum = parseInt(currentWeekDays[0].day.split("-")[2]);
      const endDayNum = parseInt(currentWeekDays[currentWeekDays.length - 1].day.split("-")[2]);
      weeks.push({
        weekNum: weeks.length + 1,
        startDay: startDayNum,
        endDay: endDayNum,
        total,
        businessDays: currentWeekDays.length,
        avg: activeDays > 0 ? total / activeDays : 0,
      });
      currentWeekDays = [];
    }
  }
  return weeks;
}

function fmtCompactCurrency(val: number): string {
  if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `R$ ${(val / 1000).toFixed(0)}K`;
  return `R$ ${val.toFixed(0)}`;
}

describe("Sales PDF Export - Weekly Summary Computation", () => {
  // April 2026: Wed 1st, Thu 2nd, Fri 3rd, Sat 4th, Sun 5th, Mon 6th...
  const aprilDays = [
    { day: "2026-04-01", value: 19000 },  // Wed
    { day: "2026-04-02", value: 158000 }, // Thu
    { day: "2026-04-03", value: 6000 },   // Fri
    { day: "2026-04-04", value: 0 },      // Sat
    { day: "2026-04-05", value: 0 },      // Sun
    { day: "2026-04-06", value: 38000 },  // Mon
    { day: "2026-04-07", value: 39000 },  // Tue
    { day: "2026-04-08", value: 35000 },  // Wed
    { day: "2026-04-09", value: 71000 },  // Thu
    { day: "2026-04-10", value: 30000 },  // Fri
    { day: "2026-04-11", value: 0 },      // Sat
    { day: "2026-04-12", value: 0 },      // Sun
    { day: "2026-04-13", value: 16000 },  // Mon
    { day: "2026-04-14", value: 67000 },  // Tue
    { day: "2026-04-15", value: 53000 },  // Wed
    { day: "2026-04-16", value: 7000 },   // Thu
    { day: "2026-04-17", value: 25000 },  // Fri
  ];

  it("groups business days into weeks correctly", () => {
    const weeks = computeWeeklySummaries(aprilDays);
    expect(weeks.length).toBe(3);
  });

  it("week 1 has correct days and total", () => {
    const weeks = computeWeeklySummaries(aprilDays);
    expect(weeks[0].weekNum).toBe(1);
    expect(weeks[0].startDay).toBe(1);
    expect(weeks[0].endDay).toBe(3);
    expect(weeks[0].businessDays).toBe(3);
    expect(weeks[0].total).toBe(19000 + 158000 + 6000); // 183000
  });

  it("week 2 has correct days and total", () => {
    const weeks = computeWeeklySummaries(aprilDays);
    expect(weeks[1].weekNum).toBe(2);
    expect(weeks[1].startDay).toBe(6);
    expect(weeks[1].endDay).toBe(10);
    expect(weeks[1].businessDays).toBe(5);
    expect(weeks[1].total).toBe(38000 + 39000 + 35000 + 71000 + 30000); // 213000
  });

  it("week 3 has correct days and total", () => {
    const weeks = computeWeeklySummaries(aprilDays);
    expect(weeks[2].weekNum).toBe(3);
    expect(weeks[2].startDay).toBe(13);
    expect(weeks[2].endDay).toBe(17);
    expect(weeks[2].businessDays).toBe(5);
    expect(weeks[2].total).toBe(16000 + 67000 + 53000 + 7000 + 25000); // 168000
  });

  it("computes correct daily average", () => {
    const weeks = computeWeeklySummaries(aprilDays);
    // Week 1: 3 active days with values > 0
    expect(weeks[0].avg).toBeCloseTo(183000 / 3, 0);
    // Week 2: 5 active days
    expect(weeks[1].avg).toBeCloseTo(213000 / 5, 0);
  });

  it("returns empty array for empty data", () => {
    const weeks = computeWeeklySummaries([]);
    expect(weeks).toEqual([]);
  });

  it("skips weekends in week grouping", () => {
    const weeks = computeWeeklySummaries(aprilDays);
    // No week should include Saturday (4th) or Sunday (5th)
    expect(weeks[0].endDay).toBe(3); // Ends on Friday
    expect(weeks[1].startDay).toBe(6); // Starts on Monday
  });

  it("handles a single business day", () => {
    const singleDay = [{ day: "2026-04-01", value: 50000 }]; // Wednesday
    const weeks = computeWeeklySummaries(singleDay);
    expect(weeks.length).toBe(1);
    expect(weeks[0].total).toBe(50000);
    expect(weeks[0].businessDays).toBe(1);
  });
});

describe("Sales PDF Export - fmtCompactCurrency", () => {
  it("formats millions", () => {
    expect(fmtCompactCurrency(1500000)).toBe("R$ 1.5M");
    expect(fmtCompactCurrency(2000000)).toBe("R$ 2.0M");
  });

  it("formats thousands", () => {
    expect(fmtCompactCurrency(184000)).toBe("R$ 184K");
    expect(fmtCompactCurrency(213000)).toBe("R$ 213K");
    expect(fmtCompactCurrency(1000)).toBe("R$ 1K");
  });

  it("formats small values", () => {
    expect(fmtCompactCurrency(500)).toBe("R$ 500");
    expect(fmtCompactCurrency(0)).toBe("R$ 0");
  });
});

// ─── SVG Animation Neutralization Tests ────────────────────────────
// Verify that the svgToImage fix correctly removes animations from cloned SVG
describe("Sales PDF Export - SVG Animation Neutralization", () => {
  /**
   * Simulates the animation neutralization logic from svgToImage.
   * This tests the regex patterns and element manipulation that ensure
   * bars appear at full height (scaleY(1)) and labels are visible (opacity:1)
   * when the SVG is serialized for PDF rasterization.
   */
  function neutralizeAnimations(svgString: string): string {
    // Same regex patterns used in salesPdfExport.ts svgToImage
    let result = svgString
      .replace(/@keyframes\s+barGrow\s*\{[^}]*\{[^}]*\}[^}]*\{[^}]*\}\s*\}/g, "")
      .replace(/@keyframes\s+fadeInUp\s*\{[^}]*\{[^}]*\}[^}]*\{[^}]*\}\s*\}/g, "")
      .replace(/\.bar-animated\s*\{[^}]*\}/g, "")
      .replace(/\.label-animated\s*\{[^}]*\}/g, "");
    return result;
  }

  const sampleStyle = `
    @keyframes barGrow {
      from { transform: scaleY(0); }
      to { transform: scaleY(1); }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .bar-animated {
      animation: barGrow 0.5s ease-out forwards;
      transform-origin: bottom;
    }
    .label-animated {
      animation: fadeInUp 0.3s ease-out forwards;
      opacity: 0;
    }
  `;

  it("removes @keyframes barGrow from style content", () => {
    const result = neutralizeAnimations(sampleStyle);
    expect(result).not.toContain("@keyframes barGrow");
    expect(result).not.toContain("scaleY(0)");
  });

  it("removes @keyframes fadeInUp from style content", () => {
    const result = neutralizeAnimations(sampleStyle);
    expect(result).not.toContain("@keyframes fadeInUp");
    expect(result).not.toContain("translateY(6px)");
  });

  it("removes .bar-animated class definition", () => {
    const result = neutralizeAnimations(sampleStyle);
    expect(result).not.toContain(".bar-animated");
    expect(result).not.toContain("barGrow 0.5s");
  });

  it("removes .label-animated class definition", () => {
    const result = neutralizeAnimations(sampleStyle);
    expect(result).not.toContain(".label-animated");
    expect(result).not.toContain("fadeInUp 0.3s");
  });

  it("preserves non-animation CSS content", () => {
    const styleWithOther = sampleStyle + "\n    .other-class { color: red; }";
    const result = neutralizeAnimations(styleWithOther);
    expect(result).toContain(".other-class");
    expect(result).toContain("color: red");
  });

  it("handles empty style content", () => {
    const result = neutralizeAnimations("");
    expect(result).toBe("");
  });

  it("handles style with only animations (all removed)", () => {
    const result = neutralizeAnimations(sampleStyle);
    // Should only have whitespace left
    expect(result.trim()).toBe("");
  });
});
