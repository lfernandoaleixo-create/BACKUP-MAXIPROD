import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Test for salesMetrics.getClientesByVendedor procedure
 * Verifies the procedure exists, accepts correct input, and returns expected shape
 */

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("salesMetrics.getClientesByVendedor", () => {
  // These tests query real DB + GraphQL, need longer timeout
  const TIMEOUT = 30000;

  it("procedure exists and is callable", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // The procedure should exist and be callable
    expect(caller.salesMetrics.getClientesByVendedor).toBeDefined();
  });

  it("returns an array (possibly empty) for a non-existent vendor", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Call with a test vendor name that doesn't exist
    const result = await caller.salesMetrics.getClientesByVendedor({
      vendedor: "VENDEDOR_TESTE_INEXISTENTE_XYZ",
    });

    expect(Array.isArray(result)).toBe(true);
    // For a non-existent vendor, should return empty array
    expect(result).toHaveLength(0);
  }, TIMEOUT);

  it("returns correctly shaped objects when data exists", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Call with a known vendor that likely has data (from production data)
    const result = await caller.salesMetrics.getClientesByVendedor({
      vendedor: "JORDAO LAINE",
    });

    expect(Array.isArray(result)).toBe(true);

    // If there are results, verify the shape
    if (result.length > 0) {
      const firstClient = result[0];
      expect(firstClient).toHaveProperty("cliente");
      expect(firstClient).toHaveProperty("razaoSocial");
      expect(firstClient).toHaveProperty("uf");
      expect(firstClient).toHaveProperty("segmento");
      expect(firstClient).toHaveProperty("totalVendas");
      expect(firstClient).toHaveProperty("qtdPedidos");
      expect(firstClient).toHaveProperty("primeiroPedido");
      expect(firstClient).toHaveProperty("ultimoPedido");
      expect(firstClient).toHaveProperty("telefone");
      expect(firstClient).toHaveProperty("email");
      expect(firstClient).toHaveProperty("cidade");
      expect(firstClient).toHaveProperty("endereco");

      // Verify types
      expect(typeof firstClient.cliente).toBe("string");
      expect(typeof firstClient.totalVendas).toBe("number");
      expect(typeof firstClient.qtdPedidos).toBe("number");
      expect(firstClient.totalVendas).toBeGreaterThanOrEqual(0);
      expect(firstClient.qtdPedidos).toBeGreaterThanOrEqual(1);

      // Results should be sorted by totalVendas desc
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].totalVendas).toBeGreaterThanOrEqual(result[i].totalVendas);
      }
    }
  }, TIMEOUT);
});
