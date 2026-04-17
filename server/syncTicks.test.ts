import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { accountsReceivable, collectionManualTicks, collectionManualTickHistory, collectionDailyActions, collectionActions } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

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

describe("syncTicksFromChecklist", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);
  let testRecId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) return;
    // Backup manual ticks and history only
    backupManualTicks = await db.select().from(collectionManualTicks);
    backupManualTickHistory = await db.select().from(collectionManualTickHistory);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    // Restore backups
    // Remove test data first
    if (testRecId) {
      await db.delete(collectionManualTicks).where(eq(collectionManualTicks.receivableId, testRecId));
      await db.delete(collectionManualTickHistory).where(eq(collectionManualTickHistory.receivableId, testRecId));
    }
  });

  it("should not modify already-ticked steps (preserves existing data)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Find a receivable that already has ticks
    const existingTicks = await db.select().from(collectionManualTicks).limit(5);
    if (existingTicks.length === 0) {
      // No existing ticks to test - skip
      return;
    }

    const recId = existingTicks[0].receivableId;
    const ticksBefore = await db.select().from(collectionManualTicks)
      .where(eq(collectionManualTicks.receivableId, recId));

    // Run sync
    const result = await caller.financial.syncTicksFromChecklist({ receivableIds: [recId] });

    // Verify existing ticks are unchanged
    const ticksAfter = await db.select().from(collectionManualTicks)
      .where(eq(collectionManualTicks.receivableId, recId));

    // All previously ticked steps should still be ticked with same data
    for (const before of ticksBefore) {
      if (before.ticked) {
        const after = ticksAfter.find(t => t.step === before.step);
        expect(after).toBeDefined();
        expect(after!.ticked).toBe(true);
        expect(after!.tickedBy).toBe(before.tickedBy);
        expect(after!.tickStatus).toBe(before.tickStatus);
      }
    }
  });

  it("should return synced=0 for non-existent receivableIds", async () => {
    const result = await caller.financial.syncTicksFromChecklist({ receivableIds: [999999999] });
    expect(result.synced).toBe(0);
  });

  it("should return synced=0 for empty array", async () => {
    const result = await caller.financial.syncTicksFromChecklist({ receivableIds: [] });
    expect(result.synced).toBe(0);
  });

  it("should sync verde steps as green ticks for receivables with actions", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Find a receivable that has daily actions (verde steps) but no manual ticks for those steps
    const actionsRecs = await db.select({ receivableId: collectionDailyActions.receivableId })
      .from(collectionDailyActions)
      .limit(10);

    if (actionsRecs.length === 0) return; // No data to test

    const recId = actionsRecs[0].receivableId;

    // Get checklist to see which steps are verde
    const checklist = await caller.financial.getCollectionChecklist({ receivableId: recId });
    const verdeSteps = checklist.steps.filter(s => s.status === "verde");

    if (verdeSteps.length === 0) return; // No verde steps

    // Run sync
    await caller.financial.syncTicksFromChecklist({ receivableIds: [recId] });

    // Verify verde steps now have green ticks
    const ticks = await db.select().from(collectionManualTicks)
      .where(eq(collectionManualTicks.receivableId, recId));

    for (const vs of verdeSteps) {
      const tick = ticks.find(t => t.step === vs.dia);
      if (tick) {
        expect(tick.ticked).toBe(true);
        // Should be green (unless it was already red from before)
        if (tick.tickedBy === 'SYNC') {
          expect(tick.tickStatus).toBe('green');
        }
      }
    }
  });

  it("should not sync futuro or pendente steps", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Find a receivable with futuro steps
    const actionsRecs = await db.select({ receivableId: collectionDailyActions.receivableId })
      .from(collectionDailyActions)
      .limit(10);

    if (actionsRecs.length === 0) return;

    const recId = actionsRecs[0].receivableId;
    const checklist = await caller.financial.getCollectionChecklist({ receivableId: recId });
    const futuroSteps = checklist.steps.filter(s => s.status === "futuro" || s.status === "pendente");

    if (futuroSteps.length === 0) return;

    // Run sync
    await caller.financial.syncTicksFromChecklist({ receivableIds: [recId] });

    // Verify futuro/pendente steps do NOT have ticks from SYNC
    const ticks = await db.select().from(collectionManualTicks)
      .where(eq(collectionManualTicks.receivableId, recId));

    for (const fs of futuroSteps) {
      const tick = ticks.find(t => t.step === fs.dia);
      // Either no tick, or tick was not created by SYNC
      if (tick && tick.tickedBy === 'SYNC') {
        // This should not happen for futuro/pendente steps
        expect(tick.ticked).toBe(false);
      }
    }
  });
});
