import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { paymentPriorityMarks } from "../drizzle/schema";

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

let backupMarks: any[] = [];

describe("Payment Priority Marks by maxiprodId (Flávio)", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);
  const testDate = "2026-04-28";
  const testFornecedor = "TEST_FORNECEDOR_PRIORITY";
  const testMaxiprodId = 999001;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) return;
    // Backup existing marks
    backupMarks = await db.select().from(paymentPriorityMarks);
    // Clear for test
    await db.delete(paymentPriorityMarks);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    // Clean up test data
    await db.delete(paymentPriorityMarks);
    // Restore backup
    if (backupMarks.length > 0) {
      for (const m of backupMarks) {
        await db.insert(paymentPriorityMarks).values({
          fornecedor: m.fornecedor,
          date: m.date,
          maxiprodId: m.maxiprodId,
          markedBy: m.markedBy,
        });
      }
    }
  });

  it("should return empty marks initially", async () => {
    const result = await caller.financial.getPaymentPriorities({
      weekStart: "2026-04-27",
      weekEnd: "2026-05-01",
    });
    expect(result.marks).toEqual([]);
  });

  it("should toggle priority ON for a bill (maxiprodId)", async () => {
    const result = await caller.financial.togglePaymentPriority({
      fornecedor: testFornecedor,
      date: testDate,
      maxiprodId: testMaxiprodId,
      operatorName: "Flavio",
    });
    expect(result.marked).toBe(true);
  });

  it("should return the mark with maxiprodId after toggling ON", async () => {
    const result = await caller.financial.getPaymentPriorities({
      weekStart: "2026-04-27",
      weekEnd: "2026-05-01",
    });
    expect(result.marks.length).toBe(1);
    expect(result.marks[0].fornecedor).toBe(testFornecedor);
    expect(result.marks[0].date).toBe(testDate);
    expect(result.marks[0].maxiprodId).toBe(testMaxiprodId);
    expect(result.marks[0].markedBy).toBe("Flavio");
  });

  it("should toggle priority OFF for the same bill (maxiprodId)", async () => {
    const result = await caller.financial.togglePaymentPriority({
      fornecedor: testFornecedor,
      date: testDate,
      maxiprodId: testMaxiprodId,
      operatorName: "Flavio",
    });
    expect(result.marked).toBe(false);
  });

  it("should return empty marks after toggling OFF", async () => {
    const result = await caller.financial.getPaymentPriorities({
      weekStart: "2026-04-27",
      weekEnd: "2026-05-01",
    });
    expect(result.marks).toEqual([]);
  });

  it("should support multiple bills (different maxiprodIds) on different dates", async () => {
    await caller.financial.togglePaymentPriority({
      fornecedor: "FORN_A",
      date: "2026-04-28",
      maxiprodId: 999101,
      operatorName: "Flavio",
    });
    await caller.financial.togglePaymentPriority({
      fornecedor: "FORN_B",
      date: "2026-04-29",
      maxiprodId: 999102,
      operatorName: "Flavio",
    });
    await caller.financial.togglePaymentPriority({
      fornecedor: "FORN_A",
      date: "2026-04-28",
      maxiprodId: 999103,
      operatorName: "Flavio",
    });

    const result = await caller.financial.getPaymentPriorities({
      weekStart: "2026-04-27",
      weekEnd: "2026-05-01",
    });
    expect(result.marks.length).toBe(3);
    const maxiprodIds = result.marks.map((m: any) => m.maxiprodId).sort();
    expect(maxiprodIds).toEqual([999101, 999102, 999103]);
  });

  it("should toggle individual bills independently (same fornecedor, different maxiprodIds)", async () => {
    // Toggle OFF 999101 (FORN_A, 04-28)
    const result = await caller.financial.togglePaymentPriority({
      fornecedor: "FORN_A",
      date: "2026-04-28",
      maxiprodId: 999101,
      operatorName: "Flavio",
    });
    expect(result.marked).toBe(false);

    // 999103 (also FORN_A, 04-28) should still be marked
    const remaining = await caller.financial.getPaymentPriorities({
      weekStart: "2026-04-27",
      weekEnd: "2026-05-01",
    });
    expect(remaining.marks.length).toBe(2);
    const ids = remaining.marks.map((m: any) => m.maxiprodId).sort();
    expect(ids).toEqual([999102, 999103]);
  });

  it("should clear all priorities for a specific date", async () => {
    await caller.financial.clearPaymentPriorities({ date: "2026-04-28" });
    const result = await caller.financial.getPaymentPriorities({
      weekStart: "2026-04-27",
      weekEnd: "2026-05-01",
    });
    // 999103 was on 04-28, should be gone. 999102 (04-29) remains
    expect(result.marks.length).toBe(1);
    expect(result.marks[0].maxiprodId).toBe(999102);
  });

  it("should not return marks outside the date range", async () => {
    const result = await caller.financial.getPaymentPriorities({
      weekStart: "2026-05-04",
      weekEnd: "2026-05-08",
    });
    expect(result.marks).toEqual([]);
  });
});
