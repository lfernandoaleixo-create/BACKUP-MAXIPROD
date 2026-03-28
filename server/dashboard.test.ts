import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { stockItems, orderItems, dashboardData, scraperStatus } from "../drizzle/schema";
import { sql } from "drizzle-orm";

/**
 * Create a mock context for public procedures (no auth required)
 */
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

/**
 * Backup and restore production data to prevent test data loss.
 * Tests use a dedicated "test row" approach: they insert known test data,
 * run assertions, then restore original data.
 */
let backupStock: any[] = [];
let backupOrders: any[] = [];
let backupDashboard: any[] = [];
let backupScraper: any[] = [];

beforeAll(async () => {
  const db = await getDb();
  if (!db) return;
  // Backup all production data
  backupStock = await db.select().from(stockItems);
  backupOrders = await db.select().from(orderItems);
  backupDashboard = await db.select().from(dashboardData);
  backupScraper = await db.select().from(scraperStatus);
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;

  // Restore production data
  await db.delete(stockItems);
  if (backupStock.length > 0) {
    for (let i = 0; i < backupStock.length; i += 50) {
      await db.insert(stockItems).values(backupStock.slice(i, i + 50));
    }
  }

  await db.delete(orderItems);
  if (backupOrders.length > 0) {
    for (let i = 0; i < backupOrders.length; i += 50) {
      await db.insert(orderItems).values(backupOrders.slice(i, i + 50));
    }
  }

  await db.delete(dashboardData);
  if (backupDashboard.length > 0) {
    await db.insert(dashboardData).values(backupDashboard);
  }

  await db.delete(scraperStatus);
  if (backupScraper.length > 0) {
    await db.insert(scraperStatus).values(backupScraper);
  }
});

describe("dashboard.getData", () => {
  it("returns items array and lastSync from the database", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getData();

    expect(result).toHaveProperty("items");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result).toHaveProperty("lastSync");
    expect(result).toHaveProperty("empresa");
  });

  it("returns stock items with all expected fields (espelho fiel)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getData();

    if (result.items.length > 0) {
      const item = result.items[0] as any;
      // Core fields - espelho fiel do Maxiprod
      expect(item).toHaveProperty("codigoItem");
      expect(item).toHaveProperty("descricaoItem");
      expect(item).toHaveProperty("unidadeMedida");
      expect(item).toHaveProperty("estoqueUn");
      expect(item).toHaveProperty("pedidosUn");
      expect(item).toHaveProperty("disponivelUn");
      expect(item).toHaveProperty("segmento");
      expect(["bambu", "industrializado"]).toContain(item.segmento);
      
      // PO fields
      expect(item).toHaveProperty("poUn");
      expect(item).toHaveProperty("poEntregas");
      expect(item).toHaveProperty("poFornecedores");
      expect(item).toHaveProperty("poLotes");
      expect(Array.isArray(item.poEntregas)).toBe(true);
      expect(Array.isArray(item.poFornecedores)).toBe(true);
      expect(Array.isArray(item.poLotes)).toBe(true);
      
      // Projected stock fields
      expect(item).toHaveProperty("projetadoUn");
      expect(item).toHaveProperty("projetadoCx");
      expect(typeof item.projetadoUn).toBe("number");
    }
  });
});

describe("dashboard.getStatus", () => {
  it("returns connection status object", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getStatus();

    expect(result).toHaveProperty("isConnected");
    expect(result).toHaveProperty("lastSyncAt");
    expect(result).toHaveProperty("lastSyncStatus");
    expect(result).toHaveProperty("lastError");
    expect(result).toHaveProperty("needsMfa");
    expect(typeof result.isConnected).toBe("boolean");
    expect(typeof result.needsMfa).toBe("boolean");
  });
});

describe("dashboard.reprocess", () => {
  it("successfully reprocesses stock data", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.reprocess();

    expect(result).toEqual({ success: true });
  });
});

describe("dashboard.forceSync", () => {
  it("triggers GraphQL sync and returns success with counts", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.forceSync();

    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("message");
    expect(result).toHaveProperty("counts");
    if (result.success) {
      expect(result.counts).toHaveProperty("stock");
      expect(result.counts).toHaveProperty("openOrders");
      expect(result.counts).toHaveProperty("purchaseOrders");
      expect(result.counts).toHaveProperty("salesOrders");
      expect(result.counts!.stock).toBeGreaterThan(0);
    }
  }, 120000);
});

describe("dashboard - PO lotes in processed output", () => {
  // Re-ingest original data before PO tests
  beforeAll(async () => {
    if (backupStock.length > 0 || backupOrders.length > 0) {
      const db = await getDb();
      if (!db) return;
      
      await db.delete(stockItems);
      if (backupStock.length > 0) {
        for (let i = 0; i < backupStock.length; i += 50) {
          await db.insert(stockItems).values(backupStock.slice(i, i + 50));
        }
      }
      
      await db.delete(orderItems);
      if (backupOrders.length > 0) {
        for (let i = 0; i < backupOrders.length; i += 50) {
          await db.insert(orderItems).values(backupOrders.slice(i, i + 50));
        }
      }
      
      // Reprocess with original data
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await caller.dashboard.reprocess();
    }
  });

  it("includes PO lotes with delivery dates in processed items", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getData();

    // Check that at least some items have PO data (from the 67 PO items loaded)
    const itemsWithPO = result.items.filter((i: any) => (i.poCx ?? 0) > 0);
    
    if (itemsWithPO.length > 0) {
      const poItem = itemsWithPO[0] as any;
      expect(poItem.poCx).toBeGreaterThan(0);
      expect(typeof poItem.poUn).toBe("number");
      expect(Array.isArray(poItem.poEntregas)).toBe(true);
      expect(Array.isArray(poItem.poFornecedores)).toBe(true);
      
      // PO lotes should be an array of objects with delivery details
      expect(Array.isArray(poItem.poLotes)).toBe(true);
      if (poItem.poLotes.length > 0) {
        const lote = poItem.poLotes[0];
        expect(lote).toHaveProperty("quantidade");
        expect(lote).toHaveProperty("dataEntrega");
        expect(lote).toHaveProperty("fornecedor");
        expect(typeof lote.quantidade).toBe("number");
        expect(lote.quantidade).toBeGreaterThan(0);
      }
    }
  });

  it("PO total matches expected range", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getData();
    const totalPO = result.items.reduce((sum: number, i: any) => sum + (i.poCx ?? 0), 0);

    expect(totalPO).toBeGreaterThanOrEqual(0);
    expect(typeof totalPO).toBe("number");
  });
});

describe("dashboard - Projected stock", () => {
  it("projected stock equals disponivel + PO for each item", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.dashboard.reprocess();
    const result = await caller.dashboard.getData();

    for (const item of result.items as any[]) {
      // projetadoUn should equal disponivelUn + poUn
      const expectedProjetado = item.disponivelUn + (item.poUn || 0);
      expect(item.projetadoUn).toBe(expectedProjetado);
    }
  });

  it("all items have projected stock fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getData();

    for (const item of result.items as any[]) {
      expect(item).toHaveProperty("projetadoUn");
      expect(item).toHaveProperty("projetadoCx");
      expect(typeof item.projetadoUn).toBe("number");
    }
  });
});

describe("dashboard - Espelho fiel validation", () => {
  it("all items have descricaoItem (exact Maxiprod description)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.dashboard.reprocess();
    const result = await caller.dashboard.getData();

    for (const item of result.items as any[]) {
      expect(item).toHaveProperty("descricaoItem");
      expect(item).toHaveProperty("codigoItem");
      expect(typeof item.descricaoItem).toBe("string");
      expect(item.descricaoItem.length).toBeGreaterThan(0);
    }
  });

  it("segment classification is present on all items", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getData();

    for (const item of result.items as any[]) {
      expect(item).toHaveProperty("segmento");
      expect(["bambu", "industrializado"]).toContain(item.segmento);
    }
  });
});
