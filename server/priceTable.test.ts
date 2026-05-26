import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Tests for the price table feature:
 * - listPriceTables: returns all synced price tables
 * - getPriceTableItems: returns items with calculated precoMinimo
 */

function createContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("sales.listPriceTables", () => {
  it("returns an array of price tables from the database", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sales.listPriceTables();

    expect(Array.isArray(result)).toBe(true);
    // We know there are 2 tables synced (Daniel and Romera)
    expect(result.length).toBeGreaterThanOrEqual(2);
    
    // Check structure
    const first = result[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("maxiprodId");
    expect(first).toHaveProperty("codigo");
    expect(first).toHaveProperty("descricao");
  });
});

describe("sales.getPriceTableItems", () => {
  it("returns items with precoMinimo when given a valid priceTableId", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    // First get the tables to find a valid ID
    const tables = await caller.sales.listPriceTables();
    expect(tables.length).toBeGreaterThan(0);

    const result = await caller.sales.getPriceTableItems({
      priceTableId: tables[0].id,
    });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("priceTable");
    expect(result.priceTable).not.toBeNull();
    expect(result.items.length).toBeGreaterThan(0);

    // Check each item has the calculated precoMinimo
    const item = result.items[0];
    expect(item).toHaveProperty("itemCodigo");
    expect(item).toHaveProperty("itemDescricao");
    expect(item).toHaveProperty("preco");
    expect(item).toHaveProperty("descontoMaximoEmPercentual");
    expect(item).toHaveProperty("precoMinimo");

    // Verify precoMinimo calculation: preco * (1 - desconto/100)
    const preco = parseFloat(item.preco);
    const desconto = item.descontoMaximoEmPercentual
      ? parseFloat(item.descontoMaximoEmPercentual)
      : 0;
    const expectedMin = preco * (1 - desconto / 100);
    expect(parseFloat(item.precoMinimo)).toBeCloseTo(expectedMin, 1);
  });

  it("returns items when given a valid sellerId (Daniel = seller 1)", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sales.getPriceTableItems({
      sellerId: 1,
    });

    expect(result.priceTable).not.toBeNull();
    expect(result.items.length).toBe(42); // Daniel has 42 products
    expect(result.priceTable!.descricao).toContain("DANIEL");
  });

  it("returns empty result for a seller without a price table", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    // Clarindo (seller 2) doesn't have a price table yet
    const result = await caller.sales.getPriceTableItems({
      sellerId: 2,
    });

    expect(result.items).toHaveLength(0);
    expect(result.priceTable).toBeNull();
  });

  it("returns empty result when no input is provided", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sales.getPriceTableItems({});

    expect(result.items).toHaveLength(0);
    expect(result.priceTable).toBeNull();
  });
});
