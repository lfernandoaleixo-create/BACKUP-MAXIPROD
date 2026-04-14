import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getDb
const mockDelete = vi.fn().mockReturnValue({ where: vi.fn() });
const mockSelect = vi.fn();
const mockDb = {
  select: mockSelect,
  delete: vi.fn().mockReturnValue(mockDelete),
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("../drizzle/schema", () => ({
  paymentAuthorizations: { accountPayableId: "accountPayableId" },
}));

import { getDb } from "./db";
import { resetDailyPaymentAuthorizations, checkAndResetOnStartup } from "./paymentAuthReset";

describe("Payment Authorization Daily Reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 0 deleted when database is not available", async () => {
    (getDb as any).mockResolvedValueOnce(null);
    
    const result = await resetDailyPaymentAuthorizations();
    
    expect(result.deleted).toBe(0);
    expect(result.date).toBeDefined();
  });

  it("should return 0 deleted when no authorizations exist", async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockResolvedValueOnce([]),
    });
    (getDb as any).mockResolvedValueOnce(mockDb);
    
    const result = await resetDailyPaymentAuthorizations();
    
    expect(result.deleted).toBe(0);
  });

  it("should delete all authorizations and return count", async () => {
    const mockAuths = [
      { id: 1, accountPayableId: 100, status: "autorizado" },
      { id: 2, accountPayableId: 200, status: "autorizado" },
      { id: 3, accountPayableId: 300, status: "prorrogar" },
    ];
    
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockResolvedValueOnce(mockAuths),
    });
    mockDb.delete.mockReturnValueOnce(Promise.resolve());
    (getDb as any).mockResolvedValueOnce(mockDb);
    
    const result = await resetDailyPaymentAuthorizations();
    
    expect(result.deleted).toBe(3);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("should include ISO date string in result", async () => {
    (getDb as any).mockResolvedValueOnce(null);
    
    const result = await resetDailyPaymentAuthorizations();
    
    // Verify date is a valid ISO string
    expect(new Date(result.date).toISOString()).toBe(result.date);
  });
});

describe("Scheduler Integration - Daily Reset", () => {
  it("should be importable from paymentAuthReset module", async () => {
    const mod = await import("./paymentAuthReset");
    expect(typeof mod.resetDailyPaymentAuthorizations).toBe("function");
  });

  it("resetDailyPaymentAuthorizations should return an object with deleted and date", async () => {
    (getDb as any).mockResolvedValueOnce(null);
    
    const result = await resetDailyPaymentAuthorizations();
    
    expect(result).toHaveProperty("deleted");
    expect(result).toHaveProperty("date");
    expect(typeof result.deleted).toBe("number");
    expect(typeof result.date).toBe("string");
  });

  it("checkAndResetOnStartup should be importable and return reset status", async () => {
    expect(typeof checkAndResetOnStartup).toBe("function");
  });

  it("checkAndResetOnStartup should return reset:false when db is not available", async () => {
    (getDb as any).mockResolvedValueOnce(null);
    
    const result = await checkAndResetOnStartup();
    
    expect(result).toHaveProperty("reset");
    expect(result).toHaveProperty("deleted");
    expect(result.reset).toBe(false);
    expect(result.deleted).toBe(0);
  });

  it("checkAndResetOnStartup should return reset:false when no authorizations exist", async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockResolvedValueOnce([]),
    });
    (getDb as any).mockResolvedValueOnce(mockDb);
    
    const result = await checkAndResetOnStartup();
    
    expect(result.reset).toBe(false);
    expect(result.deleted).toBe(0);
  });
});
