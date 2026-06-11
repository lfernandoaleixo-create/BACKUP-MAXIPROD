import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { accountsReceivable, collectionManualTicks, collectionManualTickHistory } from "../drizzle/schema";
import { eq } from "drizzle-orm";

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

let backupManualTicks: any[] = [];
let backupManualTickHistory: any[] = [];

describe("Manual Ticks - 100% Manual (sem restrições)", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);
  let testRecId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) return;
    // Backup
    backupManualTicks = await db.select().from(collectionManualTicks);
    backupManualTickHistory = await db.select().from(collectionManualTickHistory);
    // Clear
    await db.delete(collectionManualTickHistory);
    await db.delete(collectionManualTicks);

    // Create a test receivable overdue by 5 days
    const d = new Date();
    d.setDate(d.getDate() - 5);
    const vencStr = d.toISOString().split("T")[0] + "T00:00:00";
    const [inserted] = await db.insert(accountsReceivable).values({
      maxiprodId: 77700 + Math.floor(Math.random() * 10000),
      estado: "EMITIDO",
      tipo: "TITULO",
      valorOriginal: "500.00",
      valorLiquido: "500.00",
      valorRetido: "0.00",
      valorDeDesconto: "0.00",
      valorDeAcrescimo: "0.00",
      valorRecebidoLiquido: "0.00",
      emissaoData: "2026-01-01T00:00:00",
      vencimentoData: vencStr,
      vencimentoOriginalData: vencStr,
      referenteA: "MANUAL TICK TEST ref. NF 777",
      parcela: 1,
      parcelasQuantidadeTotal: 1,
      cliente: "CLIENTE MANUAL TICK TEST",
      empresaNome: "PALITOS INDUSTRIA",
    } as any).$returningId();
    testRecId = inserted.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    // Clean up test data
    await db.delete(collectionManualTickHistory);
    await db.delete(collectionManualTicks);
    // Remove test receivable
    if (testRecId) {
      await db.delete(accountsReceivable).where(eq(accountsReceivable.id, testRecId));
    }
    // Restore backups
    if (backupManualTicks.length > 0) {
      await db.insert(collectionManualTicks).values(backupManualTicks);
    }
    if (backupManualTickHistory.length > 0) {
      await db.insert(collectionManualTickHistory).values(backupManualTickHistory);
    }
  });

  it("should return empty ticks for a new receivable", async () => {
    const result = await caller.financial.getManualTicks({ receivableId: testRecId });
    expect(result.ticks).toEqual([]);
  });

  it("should toggle tick on step 1 (green)", async () => {
    const result = await caller.financial.toggleManualTick({
      receivableId: testRecId,
      step: 1,
      ticked: true,
      operatorName: "Thalita",
    });
    expect(result.success).toBe(true);

    const ticks = await caller.financial.getManualTicks({ receivableId: testRecId });
    expect(ticks.ticks.length).toBe(1);
    expect(ticks.ticks[0].step).toBe(1);
    expect(ticks.ticks[0].ticked).toBe(true);
    expect(ticks.ticks[0].tickedBy).toBe("Thalita");
    expect(ticks.ticks[0].tickStatus).toBe("green");
  });

  it("should ALLOW any operator to tick step 2 on the same day as step 1 (no restrictions)", async () => {
    const result = await caller.financial.toggleManualTick({
      receivableId: testRecId,
      step: 2,
      ticked: true,
      operatorName: "Maria",
    });
    expect(result.success).toBe(true);
  });

  it("should ALLOW ticking step 5 even when steps 3-4 are not ticked (no sequence restriction)", async () => {
    const result = await caller.financial.toggleManualTick({
      receivableId: testRecId,
      step: 5,
      ticked: true,
      operatorName: "Flavio",
    });
    expect(result.success).toBe(true);
  });

  it("should ALLOW ticking with red color", async () => {
    const result = await caller.financial.toggleManualTick({
      receivableId: testRecId,
      step: 3,
      ticked: true,
      operatorName: "Thalita",
      tickStatus: "red",
    });
    expect(result.success).toBe(true);

    const ticks = await caller.financial.getManualTicks({ receivableId: testRecId });
    const step3 = ticks.ticks.find(t => t.step === 3);
    expect(step3).toBeDefined();
    expect(step3!.tickStatus).toBe("red");
  });

  it("should ALLOW ticking with blue color", async () => {
    const result = await caller.financial.toggleManualTick({
      receivableId: testRecId,
      step: 4,
      ticked: true,
      operatorName: "Guilherme",
      tickStatus: "blue",
    });
    expect(result.success).toBe(true);

    const ticks = await caller.financial.getManualTicks({ receivableId: testRecId });
    const step4 = ticks.ticks.find(t => t.step === 4);
    expect(step4).toBeDefined();
    expect(step4!.tickStatus).toBe("blue");
  });

  it("should ALLOW unticking step 1 even when step 2 is ticked (no order restriction)", async () => {
    const result = await caller.financial.toggleManualTick({
      receivableId: testRecId,
      step: 1,
      ticked: false,
      operatorName: "Flavio",
    });
    expect(result.success).toBe(true);

    const ticks = await caller.financial.getManualTicks({ receivableId: testRecId });
    const step1 = ticks.ticks.find(t => t.step === 1);
    expect(!step1 || !step1.ticked).toBe(true);
  });

  it("should ALLOW any operator to untick red ticks (no color restriction)", async () => {
    const result = await caller.financial.toggleManualTick({
      receivableId: testRecId,
      step: 3,
      ticked: false,
      operatorName: "Maria",
    });
    expect(result.success).toBe(true);
  });

  it("should record tick/untick history for all operations", async () => {
    const history = await caller.financial.getManualTickHistory({ receivableId: testRecId });
    // We did: tick 1, tick 2, tick 5, tick 3 (red), tick 4 (blue), untick 1, untick 3
    expect(history.history.length).toBeGreaterThanOrEqual(7);
  });

  it("getManualTicksBatch should return ticks grouped by receivableId", async () => {
    const result = await caller.financial.getManualTicksBatch({ receivableIds: [testRecId, 999999] });
    expect(result[testRecId]).toBeDefined();
    expect(Array.isArray(result[testRecId])).toBe(true);
    expect(result[999999]).toBeUndefined();
  });

  it("checkOverdueTicks should be a no-op (returns updated: 0 always)", async () => {
    const result = await caller.financial.checkOverdueTicks({ receivableIds: [testRecId] });
    expect(result.updated).toBe(0);
  });

  it("syncTicksFromChecklist should be a no-op (returns synced: 0 always)", async () => {
    const result = await caller.financial.syncTicksFromChecklist({ receivableIds: [testRecId] });
    expect(result.synced).toBe(0);
  });
});
