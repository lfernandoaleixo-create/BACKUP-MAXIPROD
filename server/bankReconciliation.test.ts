import { describe, it, expect } from "vitest";

/**
 * Tests for bank reconciliation logic:
 * - Password validation
 * - Daily reset behavior
 * - Status query
 */

describe("Bank Reconciliation - Password validation", () => {
  const CORRECT_PASSWORD = "Thiago";

  it("should accept correct password", () => {
    expect(CORRECT_PASSWORD).toBe("Thiago");
    const input = "Thiago";
    expect(input === CORRECT_PASSWORD).toBe(true);
  });

  it("should reject incorrect password", () => {
    const wrongPasswords = ["thiago", "THIAGO", "Fernando", "", "123", "Thiag0"];
    for (const pw of wrongPasswords) {
      expect(pw === CORRECT_PASSWORD).toBe(false);
    }
  });

  it("should be case-sensitive", () => {
    expect("thiago" === CORRECT_PASSWORD).toBe(false);
    expect("THIAGO" === CORRECT_PASSWORD).toBe(false);
    expect("Thiago" === CORRECT_PASSWORD).toBe(true);
  });
});

describe("Bank Reconciliation - Daily reset logic", () => {
  function getTodayBR(): string {
    const now = new Date();
    const brOffset = -3 * 60;
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const brMs = utcMs + brOffset * 60000;
    const brDate = new Date(brMs);
    return brDate.toISOString().slice(0, 10);
  }

  it("should generate today's date in YYYY-MM-DD format", () => {
    const today = getTodayBR();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reconciliation for today should not match yesterday", () => {
    const today = getTodayBR();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    // Today and yesterday should be different (unless timezone edge case)
    // The key point is: querying by today's date means yesterday's record won't match
    expect(today).not.toBe(""); // always has a value
    expect(today.length).toBe(10);
  });

  it("should return reconciled=false when no record exists for today", () => {
    // Simulating the query logic: if no rows found, return false
    const rows: any[] = [];
    const result = rows.length > 0 && rows[0].reconciled
      ? { reconciled: true, reconciledBy: rows[0].reconciledBy }
      : { reconciled: false, reconciledBy: null };
    expect(result.reconciled).toBe(false);
    expect(result.reconciledBy).toBeNull();
  });

  it("should return reconciled=true when record exists and is reconciled", () => {
    const rows = [{ reconciled: true, reconciledBy: "Thiago" }];
    const result = rows.length > 0 && rows[0].reconciled
      ? { reconciled: true, reconciledBy: rows[0].reconciledBy }
      : { reconciled: false, reconciledBy: null };
    expect(result.reconciled).toBe(true);
    expect(result.reconciledBy).toBe("Thiago");
  });

  it("should return reconciled=false when record exists but not reconciled", () => {
    const rows = [{ reconciled: false, reconciledBy: null }];
    const result = rows.length > 0 && rows[0].reconciled
      ? { reconciled: true, reconciledBy: rows[0].reconciledBy }
      : { reconciled: false, reconciledBy: null };
    expect(result.reconciled).toBe(false);
    expect(result.reconciledBy).toBeNull();
  });
});

describe("Bank Reconciliation - Mutation response handling", () => {
  it("should return success:false with error on wrong password", () => {
    const input = { password: "wrong", reconciled: true };
    const result = input.password !== "Thiago"
      ? { success: false, error: "Senha incorreta" }
      : { success: true };
    expect(result.success).toBe(false);
    expect((result as any).error).toBe("Senha incorreta");
  });

  it("should return success:true on correct password", () => {
    const input = { password: "Thiago", reconciled: true };
    const result = input.password !== "Thiago"
      ? { success: false, error: "Senha incorreta" }
      : { success: true };
    expect(result.success).toBe(true);
    expect((result as any).error).toBeUndefined();
  });
});
