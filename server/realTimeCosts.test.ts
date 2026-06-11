import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("getRealTimeCosts", () => {
  it("should return an array of products with cost data", async () => {
    const caller = appRouter.createCaller({ user: null } as any);
    const results = await caller.import.getRealTimeCosts();

    expect(Array.isArray(results)).toBe(true);
    // We know there are imported products with cost data
    expect(results.length).toBeGreaterThan(0);

    // Check structure of first item
    const first = results[0];
    expect(first).toHaveProperty("codigoItem");
    expect(first).toHaveProperty("descricao");
    expect(first).toHaveProperty("custoMedioPonderado");
    expect(first).toHaveProperty("breakdown");
    expect(first).toHaveProperty("semEstoque");
    expect(typeof first.codigoItem).toBe("string");
    expect(typeof first.descricao).toBe("string");
    expect(typeof first.custoMedioPonderado).toBe("number");
    expect(first.custoMedioPonderado).toBeGreaterThan(0);
    expect(Array.isArray(first.breakdown)).toBe(true);
  });

  it("should have valid breakdown entries with PO numbers and costs", async () => {
    const caller = appRouter.createCaller({ user: null } as any);
    const results = await caller.import.getRealTimeCosts();

    // Find a product with stock (not semEstoque)
    const withStock = results.find(r => !r.semEstoque && r.breakdown.length > 0);
    expect(withStock).toBeDefined();

    if (withStock) {
      expect(withStock.caixasEstoque).toBeGreaterThan(0);
      
      for (const b of withStock.breakdown) {
        expect(b).toHaveProperty("poNumber");
        expect(b).toHaveProperty("caixasUsadas");
        expect(b).toHaveProperty("valorCaixa");
        expect(typeof b.poNumber).toBe("string");
        expect(b.poNumber).toMatch(/^PO/);
        expect(b.caixasUsadas).toBeGreaterThan(0);
        expect(b.valorCaixa).toBeGreaterThan(0);
      }
    }
  });

  it("should be sorted by product code", async () => {
    const caller = appRouter.createCaller({ user: null } as any);
    const results = await caller.import.getRealTimeCosts();

    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1].codigoItem;
      const curr = results[i].codigoItem;
      expect(prev.localeCompare(curr, undefined, { numeric: true })).toBeLessThanOrEqual(0);
    }
  });
});
