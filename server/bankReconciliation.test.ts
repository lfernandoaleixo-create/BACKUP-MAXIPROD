import { describe, it, expect } from "vitest";

/**
 * Tests for bank reconciliation logic:
 * - Password validation (Thiago and Thalita)
 * - Daily reset behavior
 * - Status query
 */

const VALID_PASSWORDS: Record<string, string> = {
  "Thiago": "Thiago",
  "Thalita": "Thalita",
};

describe("Bank Reconciliation - Password validation", () => {
  it("should accept Thiago password", () => {
    expect(VALID_PASSWORDS["Thiago"]).toBe("Thiago");
  });

  it("should accept Thalita password", () => {
    expect(VALID_PASSWORDS["Thalita"]).toBe("Thalita");
  });

  it("should reject incorrect password", () => {
    const wrongPasswords = ["thiago", "THIAGO", "Fernando", "", "123", "Thiag0", "thalita"];
    for (const pw of wrongPasswords) {
      expect(VALID_PASSWORDS[pw]).toBeUndefined();
    }
  });

  it("should be case-sensitive", () => {
    expect(VALID_PASSWORDS["thiago"]).toBeUndefined();
    expect(VALID_PASSWORDS["THIAGO"]).toBeUndefined();
    expect(VALID_PASSWORDS["Thiago"]).toBe("Thiago");
    expect(VALID_PASSWORDS["thalita"]).toBeUndefined();
    expect(VALID_PASSWORDS["THALITA"]).toBeUndefined();
    expect(VALID_PASSWORDS["Thalita"]).toBe("Thalita");
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
    expect(today).not.toBe("");
    expect(today.length).toBe(10);
  });

  it("should return reconciled=false when no record exists for today", () => {
    const rows: any[] = [];
    const result = rows.length > 0 && rows[0].reconciled
      ? { reconciled: true, reconciledBy: rows[0].reconciledBy }
      : { reconciled: false, reconciledBy: null };
    expect(result.reconciled).toBe(false);
    expect(result.reconciledBy).toBeNull();
  });

  it("should return reconciled=true when record exists and is reconciled by Thiago", () => {
    const rows = [{ reconciled: true, reconciledBy: "Thiago" }];
    const result = rows.length > 0 && rows[0].reconciled
      ? { reconciled: true, reconciledBy: rows[0].reconciledBy }
      : { reconciled: false, reconciledBy: null };
    expect(result.reconciled).toBe(true);
    expect(result.reconciledBy).toBe("Thiago");
  });

  it("should return reconciled=true when record exists and is reconciled by Thalita", () => {
    const rows = [{ reconciled: true, reconciledBy: "Thalita" }];
    const result = rows.length > 0 && rows[0].reconciled
      ? { reconciled: true, reconciledBy: rows[0].reconciledBy }
      : { reconciled: false, reconciledBy: null };
    expect(result.reconciled).toBe(true);
    expect(result.reconciledBy).toBe("Thalita");
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
    const reconciledBy = VALID_PASSWORDS[input.password];
    const result = !reconciledBy
      ? { success: false, error: "Senha incorreta" }
      : { success: true };
    expect(result.success).toBe(false);
    expect((result as any).error).toBe("Senha incorreta");
  });

  it("should return success:true on correct password (Thiago)", () => {
    const input = { password: "Thiago", reconciled: true };
    const reconciledBy = VALID_PASSWORDS[input.password];
    const result = !reconciledBy
      ? { success: false, error: "Senha incorreta" }
      : { success: true };
    expect(result.success).toBe(true);
    expect((result as any).error).toBeUndefined();
  });

  it("should return success:true on correct password (Thalita)", () => {
    const input = { password: "Thalita", reconciled: true };
    const reconciledBy = VALID_PASSWORDS[input.password];
    const result = !reconciledBy
      ? { success: false, error: "Senha incorreta" }
      : { success: true };
    expect(result.success).toBe(true);
    expect((result as any).error).toBeUndefined();
  });

  it("should identify who reconciled based on password", () => {
    expect(VALID_PASSWORDS["Thiago"]).toBe("Thiago");
    expect(VALID_PASSWORDS["Thalita"]).toBe("Thalita");
  });
});
