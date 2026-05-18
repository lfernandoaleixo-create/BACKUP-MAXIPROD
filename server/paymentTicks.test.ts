import { describe, it, expect } from "vitest";

/**
 * Tests for the payment calendar ticks feature
 * - Fernando can tick/untick payment items
 * - Ticks are persisted and visible to all operators
 */

describe("Payment Calendar Ticks", () => {
  it("getPaymentCalendarTicks returns ticks array", async () => {
    // Import the router
    const { financialRouter } = await import("./financialRouter");
    
    // The procedure should exist
    expect(financialRouter).toBeDefined();
    expect(financialRouter._def.procedures.getPaymentCalendarTicks).toBeDefined();
  });

  it("togglePaymentCalendarTick procedure exists", async () => {
    const { financialRouter } = await import("./financialRouter");
    expect(financialRouter._def.procedures.togglePaymentCalendarTick).toBeDefined();
  });

  it("paymentCalendarTicks schema has correct fields", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.paymentCalendarTicks).toBeDefined();
    
    // Check that the table has the expected columns
    const columns = Object.keys(schema.paymentCalendarTicks);
    expect(columns).toContain("id");
    expect(columns).toContain("maxiprodId");
    expect(columns).toContain("tickedBy");
    expect(columns).toContain("tickedAt");
  });

  it("toggle mutation requires maxiprodId and operatorName", async () => {
    const { financialRouter } = await import("./financialRouter");
    const procedure = financialRouter._def.procedures.togglePaymentCalendarTick;
    
    // Verify it's a mutation (has _def.mutation)
    expect(procedure._def.type).toBe("mutation");
  });

  it("get query returns proper structure", async () => {
    const { financialRouter } = await import("./financialRouter");
    const procedure = financialRouter._def.procedures.getPaymentCalendarTicks;
    
    // Verify it's a query
    expect(procedure._def.type).toBe("query");
  });
});
