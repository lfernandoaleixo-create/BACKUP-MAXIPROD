/**
 * Tests for paymentTickedPdfExport logic
 * Since the PDF generation runs client-side with jsPDF, we test the data flow
 * and the server-side getPaymentCalendarTicks procedure
 */
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { paymentCalendarTicks, accountsPayable } from "../drizzle/schema";
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

describe("financial.getPaymentCalendarTicks", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);

  it("returns ticks array", async () => {
    const result = await caller.financial.getPaymentCalendarTicks();
    expect(result).toHaveProperty("ticks");
    expect(Array.isArray(result.ticks)).toBe(true);
  }, 10000);

  it("each tick has required fields", async () => {
    const result = await caller.financial.getPaymentCalendarTicks();
    if (result.ticks.length > 0) {
      const tick = result.ticks[0];
      expect(tick).toHaveProperty("maxiprodId");
      expect(tick).toHaveProperty("tickedBy");
      expect(tick).toHaveProperty("tickedAt");
    }
  }, 10000);

  it("togglePaymentCalendarTick creates and removes ticks", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const testMaxiprodId = 999999999999;

    // Clean up any previous test data
    await db.delete(paymentCalendarTicks).where(eq(paymentCalendarTicks.maxiprodId, testMaxiprodId));

    try {
      // Toggle ON
      const result1 = await caller.financial.togglePaymentCalendarTick({
        maxiprodId: testMaxiprodId,
        operatorName: "TestOperator",
      });
      expect(result1.ticked).toBe(true);

      // Verify it exists
      const ticks = await caller.financial.getPaymentCalendarTicks();
      const found = ticks.ticks.find(t => t.maxiprodId === testMaxiprodId);
      expect(found).toBeDefined();
      expect(found?.tickedBy).toBe("TestOperator");

      // Toggle OFF
      const result2 = await caller.financial.togglePaymentCalendarTick({
        maxiprodId: testMaxiprodId,
        operatorName: "TestOperator",
      });
      expect(result2.ticked).toBe(false);

      // Verify it's gone
      const ticks2 = await caller.financial.getPaymentCalendarTicks();
      const found2 = ticks2.ticks.find(t => t.maxiprodId === testMaxiprodId);
      expect(found2).toBeUndefined();
    } finally {
      // Cleanup
      await db.delete(paymentCalendarTicks).where(eq(paymentCalendarTicks.maxiprodId, testMaxiprodId));
    }
  }, 15000);

  it("existing Fernando ticks are linked to valid accounts_payable records", async () => {
    const result = await caller.financial.getPaymentCalendarTicks();
    const db = await getDb();
    if (!db || result.ticks.length === 0) return;

    // Check that at least some ticks reference existing accounts_payable
    const tickIds = result.ticks.map(t => t.maxiprodId);
    const accounts = await db.select({ maxiprodId: accountsPayable.maxiprodId })
      .from(accountsPayable)
      .limit(5000);
    
    const accountIds = new Set(accounts.map(a => a.maxiprodId));
    const validTicks = tickIds.filter(id => accountIds.has(id));
    
    // At least some ticks should reference valid accounts
    expect(validTicks.length).toBeGreaterThan(0);
  }, 15000);
});
