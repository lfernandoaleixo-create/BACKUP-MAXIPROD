import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { madeiraStock, semiProntoStock, aguardandoEscolhaStock, stockEditHistory } from "../drizzle/schema";
import { sql, eq } from "drizzle-orm";

/**
 * Tests for manual stock editing endpoints:
 * - getMadeiraStock / updateMadeiraStock (increase-only)
 * - getSemiProntoStock / updateSemiProntoStock (increase + decrease)
 * - getAguardandoEscolhaStock / updateAguardandoEscolhaStock (increase + decrease)
 * - getStockEditHistory (last 15 days)
 */

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// Backup/restore to avoid data loss
let backupMadeira: any[] = [];
let backupSemiPronto: any[] = [];
let backupAguardando: any[] = [];
let backupHistory: any[] = [];

const TEST_CODE = "TSTEDIT99";

beforeAll(async () => {
  const db = await getDb();
  if (!db) return;
  backupMadeira = await db.select().from(madeiraStock);
  backupSemiPronto = await db.select().from(semiProntoStock);
  backupAguardando = await db.select().from(aguardandoEscolhaStock);
  backupHistory = await db.select().from(stockEditHistory);
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;

  // Clean up test data
  await db.delete(madeiraStock).where(eq(madeiraStock.codigoItem, TEST_CODE));
  await db.delete(semiProntoStock).where(eq(semiProntoStock.codigoItem, TEST_CODE));
  await db.delete(aguardandoEscolhaStock).where(eq(aguardandoEscolhaStock.codigoItem, TEST_CODE));
  await db.delete(stockEditHistory).where(eq(stockEditHistory.codigoItem, TEST_CODE));
});

describe("getMadeiraStock", () => {
  it("returns items array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.getMadeiraStock();
    expect(result).toHaveProperty("items");
    expect(Array.isArray(result.items)).toBe(true);
  });
});

describe("updateMadeiraStock - permissões de redução", () => {
  it("allows increasing stock from 0 to 10 (any operator)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.updateMadeiraStock({
      codigoItem: TEST_CODE,
      quantidade: 10,
      operatorName: "Erica",
      descricaoItem: "Test Product",
    });

    expect(result.success).toBe(true);
  });

  it("allows increasing stock from 10 to 20 (any operator)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.updateMadeiraStock({
      codigoItem: TEST_CODE,
      quantidade: 20,
      operatorName: "Erica",
      descricaoItem: "Test Product",
    });

    expect(result.success).toBe(true);
  });

  it("blocks decreasing stock for unauthorized operators (Marcos)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.updateMadeiraStock({
      codigoItem: TEST_CODE,
      quantidade: 5,
      operatorName: "Marcos",
      descricaoItem: "Test Product",
    });

    expect(result.success).toBe(false);
    expect((result as any).error).toBe("reduction_blocked");
    expect((result as any).operador).toBe("Marcos");
  });

  it("allows Maria to DECREASE stock (authorized operator)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Stock is at 20, Maria should be able to reduce to 8
    const result = await caller.dashboard.updateMadeiraStock({
      codigoItem: TEST_CODE,
      quantidade: 8,
      operatorName: "Maria",
      descricaoItem: "Test Product",
    });

    expect(result.success).toBe(true);
  });

  it("allows Guilherme to DECREASE stock (authorized operator)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Stock is at 8, Guilherme should be able to reduce to 3
    const result = await caller.dashboard.updateMadeiraStock({
      codigoItem: TEST_CODE,
      quantidade: 3,
      operatorName: "Guilherme",
      descricaoItem: "Test Product",
    });

    expect(result.success).toBe(true);
  });

  it("allows Fernando to DECREASE stock (authorized operator)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Stock is at 3, Fernando should be able to reduce to 1
    const result = await caller.dashboard.updateMadeiraStock({
      codigoItem: TEST_CODE,
      quantidade: 1,
      operatorName: "Fernando",
      descricaoItem: "Test Product",
    });

    expect(result.success).toBe(true);
  });

  it("allows keeping the same value (no change)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Reset to 20 first
    await caller.dashboard.updateMadeiraStock({
      codigoItem: TEST_CODE,
      quantidade: 20,
      operatorName: "Maria",
      descricaoItem: "Test Product",
    });

    const result = await caller.dashboard.updateMadeiraStock({
      codigoItem: TEST_CODE,
      quantidade: 20,
      operatorName: "Maria",
      descricaoItem: "Test Product",
    });

    expect(result.success).toBe(true);
  });

  it("stock value is persisted correctly after Maria's reduction", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const data = await caller.dashboard.getMadeiraStock();
    const testItem = data.items.find((i: any) => i.codigoItem === TEST_CODE);
    expect(testItem).toBeDefined();
    expect(parseFloat(String(testItem!.quantidade))).toBe(20);
  });
});

describe("updateSemiProntoStock - allows increase and decrease", () => {
  it("allows setting stock to 15", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.updateSemiProntoStock({
      codigoItem: TEST_CODE,
      quantidade: 15,
      operatorName: "Maria",
      descricaoItem: "Test Semi Pronto",
    });

    expect(result.success).toBe(true);
  });

  it("allows decreasing stock from 15 to 5", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.updateSemiProntoStock({
      codigoItem: TEST_CODE,
      quantidade: 5,
      operatorName: "Erica",
      descricaoItem: "Test Semi Pronto",
    });

    expect(result.success).toBe(true);
  });

  it("stock value is persisted correctly", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const data = await caller.dashboard.getSemiProntoStock();
    const testItem = data.items.find((i: any) => i.codigoItem === TEST_CODE);
    expect(testItem).toBeDefined();
    expect(parseFloat(String(testItem!.quantidade))).toBe(5);
  });
});

describe("updateAguardandoEscolhaStock - allows increase and decrease", () => {
  it("allows setting stock to 25", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.updateAguardandoEscolhaStock({
      codigoItem: TEST_CODE,
      quantidade: 25,
      operatorName: "Guilherme",
      descricaoItem: "Test Aguardando",
    });

    expect(result.success).toBe(true);
  });

  it("allows decreasing stock from 25 to 10", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.updateAguardandoEscolhaStock({
      codigoItem: TEST_CODE,
      quantidade: 10,
      operatorName: "Maria",
      descricaoItem: "Test Aguardando",
    });

    expect(result.success).toBe(true);
  });

  it("stock value is persisted correctly", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const data = await caller.dashboard.getAguardandoEscolhaStock();
    const testItem = data.items.find((i: any) => i.codigoItem === TEST_CODE);
    expect(testItem).toBeDefined();
    expect(parseFloat(String(testItem!.quantidade))).toBe(10);
  });
});

describe("getStockEditHistory", () => {
  it("returns history for madeira card", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getStockEditHistory({
      card: "madeira",
      codigoItem: TEST_CODE,
    });

    expect(result).toHaveProperty("history");
    expect(Array.isArray(result.history)).toBe(true);
    // Should have entries from our test mutations (increase 0->10, 10->20, blocked 20->5, same 20->20)
    expect(result.history.length).toBeGreaterThanOrEqual(3);
  });

  it("history includes blocked reduction attempt", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getStockEditHistory({
      card: "madeira",
      codigoItem: TEST_CODE,
    });

    const blocked = result.history.find((h: any) => h.tipo === "tentativa_reducao");
    expect(blocked).toBeDefined();
    expect(blocked!.operador).toBe("Marcos");
  });

  it("returns history for semiPronto card", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getStockEditHistory({
      card: "semiPronto",
      codigoItem: TEST_CODE,
    });

    expect(result.history.length).toBeGreaterThanOrEqual(2);
  });

  it("returns history for aguardandoEscolha card", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getStockEditHistory({
      card: "aguardandoEscolha",
      codigoItem: TEST_CODE,
    });

    expect(result.history.length).toBeGreaterThanOrEqual(2);
  });

  it("returns all history when no codigoItem filter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getStockEditHistory({
      card: "madeira",
    });

    expect(result).toHaveProperty("history");
    expect(Array.isArray(result.history)).toBe(true);
  });
});
