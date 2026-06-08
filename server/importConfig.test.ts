import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("import.getIcmsConfig", () => {
  it("returns states list and selected UF", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.import.getIcmsConfig();

    expect(result).toHaveProperty("states");
    expect(result).toHaveProperty("selectedUf");
    expect(Array.isArray(result.states)).toBe(true);
    // Should have 27 Brazilian states
    expect(result.states.length).toBe(27);
    // Default selected UF should be SP
    expect(result.selectedUf).toBe("SP");
    // Each state should have uf, stateName, icmsRate
    const sp = result.states.find(s => s.uf === "SP");
    expect(sp).toBeDefined();
    expect(sp?.stateName).toBe("São Paulo");
    expect(Number(sp?.icmsRate)).toBe(18);
  });
});

describe("import.getNcmTaxes", () => {
  it("returns an array (initially empty or with data)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.import.getNcmTaxes();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("import.searchStockProducts", () => {
  it("returns array of products matching query", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.import.searchStockProducts({ query: "bambu" });

    expect(Array.isArray(result)).toBe(true);
    // Each result should have codigoItem and descricaoItem
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("codigoItem");
      expect(result[0]).toHaveProperty("descricaoItem");
    }
  });
});

describe("import.calculateTaxes", () => {
  it("returns null when NCM is not registered", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.import.calculateTaxes({
      ncm: "9999.99.99",
      valorMenorUsd: 1000,
    });

    expect(result).toBeNull();
  });
});
