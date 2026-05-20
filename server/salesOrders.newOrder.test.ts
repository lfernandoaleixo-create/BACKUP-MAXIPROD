import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Test for:
 * - salesMetrics.getPedidosByVendedor (with date filtering)
 * - salesOrders.getProductsForSeller (with visibility + specs)
 * - salesOrders.searchClients (autocomplete)
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

describe("salesMetrics.getPedidosByVendedor", () => {
  const TIMEOUT = 30000;

  it("procedure exists and is callable", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.salesMetrics.getPedidosByVendedor).toBeDefined();
  });

  it("returns an array for a non-existent vendor", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.salesMetrics.getPedidosByVendedor({
      vendedor: "VENDEDOR_INEXISTENTE_XYZ_999",
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  }, TIMEOUT);

  it("returns correctly shaped order objects for known vendor", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.salesMetrics.getPedidosByVendedor({
      vendedor: "CLARINDO GONCALVES",
    });

    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const firstOrder = result[0];
      expect(firstOrder).toHaveProperty("pedido");
      expect(firstOrder).toHaveProperty("cliente");
      expect(firstOrder).toHaveProperty("dataEmissao");
      expect(firstOrder).toHaveProperty("valorTotal");
      expect(firstOrder).toHaveProperty("estadoNota");
      expect(firstOrder).toHaveProperty("itens");
      expect(Array.isArray(firstOrder.itens)).toBe(true);

      expect(typeof firstOrder.pedido).toBe("string");
      expect(typeof firstOrder.valorTotal).toBe("number");

      if (firstOrder.itens.length > 0) {
        const item = firstOrder.itens[0];
        expect(item).toHaveProperty("descricao");
        expect(item).toHaveProperty("quantidade");
        expect(item).toHaveProperty("valorUnitario");
        expect(item).toHaveProperty("valorTotal");
      }
    }
  }, TIMEOUT);
});

describe("salesOrders.getProductsForSeller", () => {
  const TIMEOUT = 30000;

  it("procedure exists and is callable", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.salesOrders.getProductsForSeller).toBeDefined();
  });

  it("returns products with expected fields including grupo", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Use sellerId 1 (or any existing seller)
    const result = await caller.salesOrders.getProductsForSeller({
      sellerId: 1,
    });

    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const product = result[0];
      expect(product).toHaveProperty("codigoItem");
      expect(product).toHaveProperty("descricaoItem");
      expect(product).toHaveProperty("disponivel");
      expect(product).toHaveProperty("unidadeMedida");
      expect(product).toHaveProperty("precoMinimo");
      expect(product).toHaveProperty("grupo");

      expect(typeof product.codigoItem).toBe("string");
      expect(typeof product.descricaoItem).toBe("string");
    }
  }, TIMEOUT);
});

describe("salesOrders.searchClients", () => {
  const TIMEOUT = 15000;

  it("procedure exists and is callable", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.salesOrders.searchClients).toBeDefined();
  });

  it("returns empty array for non-matching query", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.salesOrders.searchClients({
      query: "XYZNONEXISTENT999",
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  }, TIMEOUT);
});
