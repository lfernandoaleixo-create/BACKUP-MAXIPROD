import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { productionSectors, productionEntries, madeiraStock, stockEditHistory } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Tests for auto-feed: Produção (Embalagem) → Estoque Madeira PA.
 * Verifica que quando a Maria lança produção na embalagem,
 * o estoque de Madeira PA é atualizado automaticamente.
 */

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

let embalagemSectorId: number | null = null;
let backupStock: any[] = [];
let backupEntries: any[] = [];
const TEST_CODIGO = "99999_TEST_AUTOFEED";
const TEST_DATE = "2026-04-16";

describe("auto-feed: Produção Embalagem → Estoque Madeira PA", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);

  beforeAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Find embalagem sector (tipoEquipamento = "nenhum")
    const sectors = await db.select().from(productionSectors)
      .where(eq(productionSectors.tipoEquipamento, "nenhum"));
    if (sectors.length > 0) {
      embalagemSectorId = sectors[0].id;
    }

    // Backup and clean test data
    backupStock = await db.select().from(madeiraStock).where(eq(madeiraStock.codigoItem, TEST_CODIGO));
    backupEntries = await db.select().from(productionEntries)
      .where(and(
        eq(productionEntries.tipoMadeira, TEST_CODIGO),
        eq(productionEntries.data, TEST_DATE),
      ));

    // Clean up test data
    await db.delete(madeiraStock).where(eq(madeiraStock.codigoItem, TEST_CODIGO));
    await db.delete(productionEntries).where(
      and(
        eq(productionEntries.tipoMadeira, TEST_CODIGO),
        eq(productionEntries.data, TEST_DATE),
      )
    );
    await db.delete(stockEditHistory).where(eq(stockEditHistory.codigoItem, TEST_CODIGO));
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Clean up test data
    await db.delete(madeiraStock).where(eq(madeiraStock.codigoItem, TEST_CODIGO));
    await db.delete(productionEntries).where(
      and(
        eq(productionEntries.tipoMadeira, TEST_CODIGO),
        eq(productionEntries.data, TEST_DATE),
      )
    );
    await db.delete(stockEditHistory).where(eq(stockEditHistory.codigoItem, TEST_CODIGO));

    // Restore backups
    for (const row of backupStock) {
      await db.insert(madeiraStock).values(row).onDuplicateKeyUpdate({ set: row });
    }
    for (const row of backupEntries) {
      await db.insert(productionEntries).values(row).onDuplicateKeyUpdate({ set: row });
    }
  });

  it("should have an embalagem sector available", () => {
    expect(embalagemSectorId).not.toBeNull();
  });

  it("should create stock entry when production is saved for new product", async () => {
    if (!embalagemSectorId) return;

    await caller.production.upsertEntry({
      sectorId: embalagemSectorId,
      machineId: null,
      data: TEST_DATE,
      quantidade: 50,
      tipoMadeira: TEST_CODIGO,
      lancadoPor: "Maria (Teste)",
    });

    // Check stock was created
    const db = await getDb();
    const stock = await db!.select().from(madeiraStock)
      .where(eq(madeiraStock.codigoItem, TEST_CODIGO));

    expect(stock.length).toBe(1);
    expect(parseFloat(String(stock[0].quantidade))).toBe(50);
    expect(stock[0].updatedBy).toContain("Produção");
    expect(stock[0].updatedBy).toContain("Maria (Teste)");
  });

  it("should increment stock when production quantity increases", async () => {
    if (!embalagemSectorId) return;

    // Update from 50 to 80 (diff = +30)
    await caller.production.upsertEntry({
      sectorId: embalagemSectorId,
      machineId: null,
      data: TEST_DATE,
      quantidade: 80,
      tipoMadeira: TEST_CODIGO,
      lancadoPor: "Maria (Teste)",
    });

    const db = await getDb();
    const stock = await db!.select().from(madeiraStock)
      .where(eq(madeiraStock.codigoItem, TEST_CODIGO));

    expect(stock.length).toBe(1);
    expect(parseFloat(String(stock[0].quantidade))).toBe(80); // 50 + 30 = 80
  });

  it("should decrement stock when production quantity decreases", async () => {
    if (!embalagemSectorId) return;

    // Update from 80 to 60 (diff = -20)
    await caller.production.upsertEntry({
      sectorId: embalagemSectorId,
      machineId: null,
      data: TEST_DATE,
      quantidade: 60,
      tipoMadeira: TEST_CODIGO,
      lancadoPor: "Maria (Teste)",
    });

    const db = await getDb();
    const stock = await db!.select().from(madeiraStock)
      .where(eq(madeiraStock.codigoItem, TEST_CODIGO));

    expect(stock.length).toBe(1);
    expect(parseFloat(String(stock[0].quantidade))).toBe(60); // 80 - 20 = 60
  });

  it("should register edit history for each stock change", async () => {
    const db = await getDb();
    const history = await db!.select().from(stockEditHistory)
      .where(eq(stockEditHistory.codigoItem, TEST_CODIGO));

    // Should have 3 entries: create (0→50), update (50→80), update (80→60)
    expect(history.length).toBe(3);

    // All should be from "Produção (Maria (Teste))"
    for (const h of history) {
      expect(h.operador).toContain("Produção");
      expect(h.card).toBe("madeira");
    }
  });

  it("should not go below zero when decreasing stock", async () => {
    if (!embalagemSectorId) return;

    // Set to 0 first, then try to decrease
    await caller.production.upsertEntry({
      sectorId: embalagemSectorId,
      machineId: null,
      data: TEST_DATE,
      quantidade: 0,
      tipoMadeira: TEST_CODIGO,
      lancadoPor: "Maria (Teste)",
    });

    const db = await getDb();
    const stock = await db!.select().from(madeiraStock)
      .where(eq(madeiraStock.codigoItem, TEST_CODIGO));

    expect(parseFloat(String(stock[0].quantidade))).toBeGreaterThanOrEqual(0);
  });
});
