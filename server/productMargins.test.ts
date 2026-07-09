import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";

const createCaller = createCallerFactory(appRouter);
const caller = createCaller({ user: null, req: {} as any, res: {} as any });

describe("salesOrders.getProductMargins", () => {
  it("should be defined", () => {
    expect(caller.salesOrders.getProductMargins).toBeDefined();
  });

  it("should return costMap and taxPercent", async () => {
    const result = await caller.salesOrders.getProductMargins({
      ufDestino: "MG",
      tipoContribuinte: "Contribuinte",
    });
    expect(result).toHaveProperty("costMap");
    expect(result).toHaveProperty("taxPercent");
    expect(typeof result.taxPercent).toBe("number");
    expect(result.taxPercent).toBeGreaterThan(0);
  });

  it("should calculate correct tax percentage for MG Contribuinte importado", async () => {
    const result = await caller.salesOrders.getProductMargins({
      ufDestino: "MG",
      tipoContribuinte: "Contribuinte",
    });
    // MG internal importado: ICMS 14% + PIS 0.533% + COFINS 2.46% + IRPJ 1.32% + CSLL 1.19% = ~19.503%
    expect(result.taxPercent).toBeCloseTo(19.503, 1);
  });

  it("should return costMap as an object with product codes as keys", async () => {
    const result = await caller.salesOrders.getProductMargins({
      ufDestino: "SP",
      tipoContribuinte: "Não contribuinte",
    });
    expect(typeof result.costMap).toBe("object");
    // Each entry should have cost and fonte
    for (const [key, value] of Object.entries(result.costMap)) {
      expect(typeof key).toBe("string");
      expect(value).toHaveProperty("cost");
      expect(value).toHaveProperty("fonte");
      expect(typeof (value as any).cost).toBe("number");
      expect((value as any).cost).toBeGreaterThan(0);
    }
  });
});
