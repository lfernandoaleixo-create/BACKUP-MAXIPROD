import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getDb
const mockDelete = vi.fn().mockReturnValue({ where: vi.fn() });
const mockSelect = vi.fn();
const mockDb = {
  select: mockSelect,
  delete: vi.fn().mockReturnValue(mockDelete),
  insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("../drizzle/schema", () => ({
  paymentAuthorizations: { accountPayableId: "accountPayableId" },
  authCompletion: { date: "date" },
  appSettings: { settingKey: "settingKey" },
}));

vi.mock("drizzle-orm", () => ({
  sql: vi.fn(),
  eq: vi.fn().mockImplementation((a: any, b: any) => ({ field: a, value: b })),
}));

import { getDb } from "./db";
import { resetDailyPaymentAuthorizations, checkAndResetOnStartup, checkAndResetIfNeeded } from "./paymentAuthReset";

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
    // select().from(paymentAuthorizations) returns []
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockResolvedValueOnce([]),
    });
    // delete(authCompletion) - mock
    mockDb.delete.mockReturnValueOnce(Promise.resolve());
    // select().from(appSettings).where().limit() for getLastResetDate (inside setLastResetDate)
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    (getDb as any).mockResolvedValueOnce(mockDb);
    
    const result = await resetDailyPaymentAuthorizations();
    
    expect(result.deleted).toBe(0);
  });

  it("should include ISO date string in result", async () => {
    (getDb as any).mockResolvedValueOnce(null);
    
    const result = await resetDailyPaymentAuthorizations();
    
    // Verify date is a valid ISO string
    expect(new Date(result.date).toISOString()).toBe(result.date);
  });
});

describe("Scheduler Integration - Daily Reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be importable from paymentAuthReset module", async () => {
    const mod = await import("./paymentAuthReset");
    expect(typeof mod.resetDailyPaymentAuthorizations).toBe("function");
    expect(typeof mod.checkAndResetIfNeeded).toBe("function");
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

  it("checkAndResetIfNeeded should return reset:false when db is not available", async () => {
    (getDb as any).mockResolvedValueOnce(null);
    
    const result = await checkAndResetIfNeeded();
    
    expect(result.reset).toBe(false);
    expect(result.deleted).toBe(0);
  });

  it("checkAndResetIfNeeded should not reset when last reset date is today", async () => {
    const todayBRT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    // select().from(appSettings).where().limit() returns today's date
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ settingKey: "payment_auth_last_reset_date", settingValue: `"${todayBRT}"` }]),
        }),
      }),
    });
    (getDb as any).mockResolvedValueOnce(mockDb);
    
    const result = await checkAndResetIfNeeded();
    
    expect(result.reset).toBe(false);
    expect(result.deleted).toBe(0);
  });

  it("checkAndResetIfNeeded should reset when last reset date is yesterday", async () => {
    // select().from(appSettings).where().limit() returns yesterday's date
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ settingKey: "payment_auth_last_reset_date", settingValue: '"2026-04-16"' }]),
        }),
      }),
    });
    // resetDailyPaymentAuthorizations will call:
    // select().from(paymentAuthorizations) - existing auths
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockResolvedValueOnce([
        { id: 1, accountPayableId: 100, status: "autorizado", createdAt: new Date() },
      ]),
    });
    // delete(paymentAuthorizations)
    mockDb.delete.mockReturnValueOnce(Promise.resolve());
    // delete(authCompletion)
    mockDb.delete.mockReturnValueOnce(Promise.resolve());
    // select().from(appSettings).where().limit() for setLastResetDate
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ settingKey: "payment_auth_last_reset_date", settingValue: '"2026-04-16"' }]),
        }),
      }),
    });
    (getDb as any).mockResolvedValue(mockDb);
    
    const result = await checkAndResetIfNeeded();
    
    expect(result.reset).toBe(true);
    expect(result.deleted).toBe(1);
  });

  it("checkAndResetIfNeeded should reset when no last reset date exists", async () => {
    // select().from(appSettings).where().limit() returns empty (no setting)
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    // resetDailyPaymentAuthorizations:
    // select().from(paymentAuthorizations) - no existing auths
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockResolvedValueOnce([]),
    });
    // delete(authCompletion)
    mockDb.delete.mockReturnValueOnce(Promise.resolve());
    // select().from(appSettings).where().limit() for setLastResetDate
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    (getDb as any).mockResolvedValue(mockDb);
    
    const result = await checkAndResetIfNeeded();
    
    expect(result.reset).toBe(true);
    expect(result.deleted).toBe(0);
  });
});
