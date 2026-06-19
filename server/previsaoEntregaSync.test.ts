import { describe, it, expect } from "vitest";

/**
 * Tests for the previsaoEntrega sync logic
 * Tests the matching algorithm that maps Maxiprod referencia to import_pos po_number
 */

// Simulate the matching logic from previsaoEntregaSync.ts
function matchPoNumber(refCode: string, poNum: string): boolean {
  const normalizedRef = refCode.toUpperCase().replace(/^PO0*/, 'PO');
  const normalizedPo = poNum.toUpperCase().replace(/^PO0*/, 'PO');
  return normalizedRef === normalizedPo;
}

function extractRefCode(referencia: string): string {
  const refParts = referencia.toUpperCase().split(' - ');
  return refParts[0].trim();
}

describe("previsaoEntregaSync - matching logic", () => {
  it("should match PO55 referencia to PO55 po_number", () => {
    const refCode = extractRefCode("PO55 - COMERCIAL");
    expect(matchPoNumber(refCode, "PO55")).toBe(true);
  });

  it("should match PO55 referencia to PO055 po_number (leading zero)", () => {
    const refCode = extractRefCode("PO55 - COMERCIAL");
    expect(matchPoNumber(refCode, "PO055")).toBe(true);
  });

  it("should match 01PH202603 referencia to 01PH202603 po_number", () => {
    const refCode = extractRefCode("01PH202603 - COMERCIAL");
    expect(matchPoNumber(refCode, "01PH202603")).toBe(true);
  });

  it("should NOT match PO55 to PO56", () => {
    const refCode = extractRefCode("PO55 - COMERCIAL");
    expect(matchPoNumber(refCode, "PO56")).toBe(false);
  });

  it("should NOT match ZYZ2026-018 to PO65 (different format)", () => {
    const refCode = extractRefCode("ZYZ2026-018 - COMERCIAL");
    expect(matchPoNumber(refCode, "PO65")).toBe(false);
  });

  it("should match PO5 to PO05 (leading zero normalization)", () => {
    const refCode = extractRefCode("PO5 - COMERCIAL");
    expect(matchPoNumber(refCode, "PO05")).toBe(true);
  });

  it("should match PO65 to PO65 exactly", () => {
    const refCode = extractRefCode("PO65 - COMERCIAL");
    expect(matchPoNumber(refCode, "PO65")).toBe(true);
  });

  it("should handle PROFORMA suffix correctly", () => {
    const refCode = extractRefCode("ZYZ2026-027 - PROFORMA");
    expect(refCode).toBe("ZYZ2026-027");
    expect(matchPoNumber(refCode, "PO27")).toBe(false);
  });
});

describe("previsaoEntregaSync - sort by arrival date", () => {
  it("should sort POs with dates before POs without dates", () => {
    const pos = [
      { id: 1, poNumber: "PO01", previsaoEntrega: null },
      { id: 2, poNumber: "PO55", previsaoEntrega: "2026-02-12T00:00:00.000-03:00" },
      { id: 3, poNumber: "PO63", previsaoEntrega: "2026-04-29T00:00:00.000-03:00" },
    ];

    const sorted = [...pos].sort((a, b) => {
      const dateA = a.previsaoEntrega ? new Date(a.previsaoEntrega).getTime() : 0;
      const dateB = b.previsaoEntrega ? new Date(b.previsaoEntrega).getTime() : 0;
      if (dateA && dateB) return dateA - dateB;
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      return b.id - a.id;
    });

    expect(sorted[0].poNumber).toBe("PO55"); // earliest date
    expect(sorted[1].poNumber).toBe("PO63"); // next date
    expect(sorted[2].poNumber).toBe("PO01"); // no date, goes last
  });

  it("should sort by nearest date first", () => {
    const pos = [
      { id: 1, poNumber: "PO65", previsaoEntrega: "2026-03-30T00:00:00.000-03:00" },
      { id: 2, poNumber: "PO55", previsaoEntrega: "2026-02-12T00:00:00.000-03:00" },
      { id: 3, poNumber: "PO63", previsaoEntrega: "2026-04-29T00:00:00.000-03:00" },
    ];

    const sorted = [...pos].sort((a, b) => {
      const dateA = a.previsaoEntrega ? new Date(a.previsaoEntrega).getTime() : 0;
      const dateB = b.previsaoEntrega ? new Date(b.previsaoEntrega).getTime() : 0;
      if (dateA && dateB) return dateA - dateB;
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      return b.id - a.id;
    });

    expect(sorted[0].poNumber).toBe("PO55"); // Feb 12
    expect(sorted[1].poNumber).toBe("PO65"); // Mar 30
    expect(sorted[2].poNumber).toBe("PO63"); // Apr 29
  });
});
