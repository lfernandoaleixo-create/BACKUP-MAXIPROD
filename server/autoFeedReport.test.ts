import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Tests for getStockAutoFeedReport endpoint.
 * This endpoint returns a report comparing:
 * - Yesterday's stock (from edit history)
 * - Today's embalagem entries
 * - Current stock
 * - Whether they match
 */

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("getStockAutoFeedReport", () => {
  it("returns report structure with correct fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.production.getStockAutoFeedReport();

    expect(result).toHaveProperty("report");
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.report)).toBe(true);
    expect(typeof result.data).toBe("string");
    // data should be YYYY-MM-DD format
    expect(result.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("each report item has required fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.production.getStockAutoFeedReport();

    if (result.report.length > 0) {
      const item = result.report[0];
      expect(item).toHaveProperty("codigoItem");
      expect(item).toHaveProperty("descricaoItem");
      expect(item).toHaveProperty("unidadeMedida");
      expect(item).toHaveProperty("estoqueOntem");
      expect(item).toHaveProperty("embaladoHoje");
      expect(item).toHaveProperty("estoqueAtual");
      expect(item).toHaveProperty("esperado");
      expect(item).toHaveProperty("bateu");
      expect(item).toHaveProperty("alteracoes");
      expect(typeof item.estoqueOntem).toBe("number");
      expect(typeof item.embaladoHoje).toBe("number");
      expect(typeof item.estoqueAtual).toBe("number");
      expect(typeof item.esperado).toBe("number");
      expect(typeof item.bateu).toBe("boolean");
      expect(Array.isArray(item.alteracoes)).toBe(true);
    }
  });

  it("accepts optional date parameter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.production.getStockAutoFeedReport({
      data: "2026-04-14",
    });

    expect(result).toHaveProperty("report");
    expect(result.data).toBe("2026-04-14");
  });

  it("esperado = estoqueOntem + embaladoHoje for each item", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.production.getStockAutoFeedReport();

    for (const item of result.report) {
      expect(item.esperado).toBeCloseTo(item.estoqueOntem + item.embaladoHoje, 2);
    }
  });

  it("bateu is true when estoqueAtual matches esperado", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.production.getStockAutoFeedReport();

    for (const item of result.report) {
      if (Math.abs(item.estoqueAtual - item.esperado) < 0.01) {
        expect(item.bateu).toBe(true);
      } else {
        expect(item.bateu).toBe(false);
      }
    }
  });
});
