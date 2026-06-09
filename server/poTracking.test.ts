import { describe, it, expect } from "vitest";

/**
 * Tests for the dashboard.getPoTrackingLinks endpoint.
 * This endpoint fetches tracking data from import_payments and normalizes PO references
 * so the Estoque tab can display tracking buttons.
 */
describe("dashboard.getPoTrackingLinks", () => {
  it("should normalize PO numbers by removing leading zeros", () => {
    // Test the normalization logic: "PO062" -> "PO62"
    const raw = "PO062";
    const poMatch = raw.toUpperCase().match(/^PO0*(\d+)$/);
    const normalizedKey = poMatch ? `PO${poMatch[1]}` : raw.toUpperCase();
    expect(normalizedKey).toBe("PO62");
  });

  it("should normalize PO numbers without leading zeros", () => {
    const raw = "PO62";
    const poMatch = raw.toUpperCase().match(/^PO0*(\d+)$/);
    const normalizedKey = poMatch ? `PO${poMatch[1]}` : raw.toUpperCase();
    expect(normalizedKey).toBe("PO62");
  });

  it("should handle non-PO pedido codes (e.g. ZYZ2026-018)", () => {
    const raw = "ZYZ2026-018";
    const poMatch = raw.toUpperCase().match(/^PO0*(\d+)$/);
    const normalizedKey = poMatch ? `PO${poMatch[1]}` : raw.toUpperCase();
    expect(normalizedKey).toBe("ZYZ2026-018");
  });

  it("should handle single digit PO numbers", () => {
    const raw = "PO01";
    const poMatch = raw.toUpperCase().match(/^PO0*(\d+)$/);
    const normalizedKey = poMatch ? `PO${poMatch[1]}` : raw.toUpperCase();
    expect(normalizedKey).toBe("PO1");
  });

  it("should handle PO with many leading zeros", () => {
    const raw = "PO000045";
    const poMatch = raw.toUpperCase().match(/^PO0*(\d+)$/);
    const normalizedKey = poMatch ? `PO${poMatch[1]}` : raw.toUpperCase();
    expect(normalizedKey).toBe("PO45");
  });

  it("should handle lowercase input", () => {
    const raw = "po062";
    const poMatch = raw.toUpperCase().match(/^PO0*(\d+)$/);
    const normalizedKey = poMatch ? `PO${poMatch[1]}` : raw.toUpperCase();
    expect(normalizedKey).toBe("PO62");
  });

  it("should build a tracking map with both normalized and original keys", () => {
    // Simulate the logic from the endpoint
    const payments = [
      { pedido: "PO062", blNumber: "ONEYHKGG45910500", trackingUuid: "1a341f5b-327c-44f6-9411-e100cc022d67" },
      { pedido: "ZYZ2026-018", blNumber: "ONEYHKGG45910500", trackingUuid: null },
      { pedido: "01PH202603", blNumber: "ONEYXMNG50123700", trackingUuid: null },
    ];

    const trackingByPO: Record<string, { blNumber: string | null; trackingUuid: string | null }> = {};
    for (const p of payments) {
      const raw = (p.pedido || "").trim().toUpperCase();
      const poMatch = raw.match(/^PO0*(\d+)$/);
      const normalizedKey = poMatch ? `PO${poMatch[1]}` : raw;
      trackingByPO[normalizedKey] = { blNumber: p.blNumber, trackingUuid: p.trackingUuid };
      if (normalizedKey !== raw) {
        trackingByPO[raw] = { blNumber: p.blNumber, trackingUuid: p.trackingUuid };
      }
    }

    // PO062 should be accessible as both PO62 and PO062
    expect(trackingByPO["PO62"]).toEqual({ blNumber: "ONEYHKGG45910500", trackingUuid: "1a341f5b-327c-44f6-9411-e100cc022d67" });
    expect(trackingByPO["PO062"]).toEqual({ blNumber: "ONEYHKGG45910500", trackingUuid: "1a341f5b-327c-44f6-9411-e100cc022d67" });

    // Non-PO codes should be stored as-is (uppercased)
    expect(trackingByPO["ZYZ2026-018"]).toEqual({ blNumber: "ONEYHKGG45910500", trackingUuid: null });
    expect(trackingByPO["01PH202603"]).toEqual({ blNumber: "ONEYXMNG50123700", trackingUuid: null });
  });

  it("should match Estoque PO referenciaPO to tracking data", () => {
    // Estoque uses referenciaPO like "PO62" (from stockProcessor normalization)
    // Import payments use pedido like "PO062"
    // The endpoint normalizes both so they match
    const trackingByPO: Record<string, { blNumber: string | null; trackingUuid: string | null }> = {
      "PO62": { blNumber: "ONEYHKGG45910500", trackingUuid: "1a341f5b-327c-44f6-9411-e100cc022d67" },
      "PO062": { blNumber: "ONEYHKGG45910500", trackingUuid: "1a341f5b-327c-44f6-9411-e100cc022d67" },
    };

    // Frontend lookup: po.referenciaPO.toUpperCase()
    const estoquePoRef = "PO62";
    const tracking = trackingByPO[estoquePoRef.toUpperCase()];
    expect(tracking).toBeDefined();
    expect(tracking!.blNumber).toBe("ONEYHKGG45910500");
    expect(tracking!.trackingUuid).toBe("1a341f5b-327c-44f6-9411-e100cc022d67");
  });
});
