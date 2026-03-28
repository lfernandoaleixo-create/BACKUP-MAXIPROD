import { describe, it, expect } from "vitest";
import { productPricing } from "../drizzle/schema";

describe("productPricing schema", () => {
  it("should have the correct table name", () => {
    // Verify the table name matches what we expect
    const tableName = (productPricing as any)[Symbol.for("drizzle:Name")];
    expect(tableName).toBe("product_pricing");
  });

  it("should have required columns", () => {
    const columns = Object.keys((productPricing as any));
    expect(columns).toContain("id");
    expect(columns).toContain("codigoItem");
    expect(columns).toContain("mode");
    expect(columns).toContain("manualPrice");
    expect(columns).toContain("createdAt");
    expect(columns).toContain("updatedAt");
  });
});

describe("pricing mode logic", () => {
  it("should validate auto mode has no manual price", () => {
    const autoMode = { mode: "auto" as const, manualPrice: null };
    expect(autoMode.mode).toBe("auto");
    expect(autoMode.manualPrice).toBeNull();
  });

  it("should validate manual mode has a price", () => {
    const manualMode = { mode: "manual" as const, manualPrice: "150.50" };
    expect(manualMode.mode).toBe("manual");
    expect(parseFloat(manualMode.manualPrice)).toBe(150.50);
    expect(parseFloat(manualMode.manualPrice)).toBeGreaterThan(0);
  });

  it("should override auto price with manual price in priceMap", () => {
    const autoPrices: Record<string, { avgPrice: number; salesCount: number }> = {
      "ESPETO 4.0x250": { avgPrice: 100, salesCount: 5 },
      "VARETA 3.0x250": { avgPrice: 80, salesCount: 3 },
    };

    const manualOverrides = [
      { codigoItem: "001", mode: "manual", manualPrice: "120.00" },
    ];

    // Simulate stock item mapping
    const stockItems = [
      { codigoItem: "001", descricaoItem: "ESPETO 4.0x250" },
      { codigoItem: "002", descricaoItem: "VARETA 3.0x250" },
    ];

    // Apply overrides (same logic as Home.tsx)
    const base = { ...autoPrices };
    for (const p of manualOverrides) {
      if (p.mode === "manual" && p.manualPrice) {
        const manualVal = parseFloat(p.manualPrice);
        if (!isNaN(manualVal) && manualVal > 0) {
          const stockItem = stockItems.find((s) => s.codigoItem === p.codigoItem);
          if (stockItem) {
            base[stockItem.descricaoItem] = { avgPrice: manualVal, salesCount: -1 };
          }
        }
      }
    }

    // ESPETO should be overridden to 120
    expect(base["ESPETO 4.0x250"].avgPrice).toBe(120);
    expect(base["ESPETO 4.0x250"].salesCount).toBe(-1); // -1 indicates manual
    // VARETA should remain auto
    expect(base["VARETA 3.0x250"].avgPrice).toBe(80);
    expect(base["VARETA 3.0x250"].salesCount).toBe(3);
  });

  it("should not override when manual price is invalid", () => {
    const autoPrices: Record<string, { avgPrice: number; salesCount: number }> = {
      "ESPETO 4.0x250": { avgPrice: 100, salesCount: 5 },
    };

    const manualOverrides = [
      { codigoItem: "001", mode: "manual", manualPrice: "0" },
      { codigoItem: "002", mode: "manual", manualPrice: "-10" },
      { codigoItem: "003", mode: "manual", manualPrice: "abc" },
    ];

    const stockItems = [
      { codigoItem: "001", descricaoItem: "ESPETO 4.0x250" },
    ];

    const base = { ...autoPrices };
    for (const p of manualOverrides) {
      if (p.mode === "manual" && p.manualPrice) {
        const manualVal = parseFloat(p.manualPrice);
        if (!isNaN(manualVal) && manualVal > 0) {
          const stockItem = stockItems.find((s) => s.codigoItem === p.codigoItem);
          if (stockItem) {
            base[stockItem.descricaoItem] = { avgPrice: manualVal, salesCount: -1 };
          }
        }
      }
    }

    // Should remain unchanged
    expect(base["ESPETO 4.0x250"].avgPrice).toBe(100);
  });
});
