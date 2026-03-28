import { describe, it, expect } from "vitest";

/**
 * Tests for timezone-safe date helper functions.
 * These functions are defined in financialRouter.ts and use string-based YYYY-MM-DD
 * comparisons to avoid timezone bugs.
 */

// Replicate the helper functions for testing
function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return dt.toISOString().slice(0, 10);
}

function getDayOfWeekStr(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function adjustWeekendStr(dateStr: string): string {
  const dow = getDayOfWeekStr(dateStr);
  if (dow === 6) return addDaysStr(dateStr, 2); // Saturday -> Monday
  if (dow === 0) return addDaysStr(dateStr, 1); // Sunday -> Monday
  return dateStr;
}

describe("addDaysStr", () => {
  it("should add positive days correctly", () => {
    expect(addDaysStr("2026-03-14", 1)).toBe("2026-03-15");
    expect(addDaysStr("2026-03-14", 7)).toBe("2026-03-21");
    expect(addDaysStr("2026-03-14", 30)).toBe("2026-04-13");
  });

  it("should subtract days correctly", () => {
    expect(addDaysStr("2026-03-14", -1)).toBe("2026-03-13");
    expect(addDaysStr("2026-03-14", -3)).toBe("2026-03-11");
    expect(addDaysStr("2026-03-14", -14)).toBe("2026-02-28");
  });

  it("should handle month boundaries", () => {
    expect(addDaysStr("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDaysStr("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysStr("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("should handle leap year", () => {
    // 2028 is a leap year
    expect(addDaysStr("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysStr("2028-02-29", 1)).toBe("2028-03-01");
  });
});

describe("getDayOfWeekStr", () => {
  it("should return correct day of week", () => {
    // 2026-03-14 is Saturday
    expect(getDayOfWeekStr("2026-03-14")).toBe(6);
    // 2026-03-15 is Sunday
    expect(getDayOfWeekStr("2026-03-15")).toBe(0);
    // 2026-03-16 is Monday
    expect(getDayOfWeekStr("2026-03-16")).toBe(1);
    // 2026-03-13 is Friday
    expect(getDayOfWeekStr("2026-03-13")).toBe(5);
  });
});

describe("adjustWeekendStr", () => {
  it("should move Saturday to Monday", () => {
    expect(adjustWeekendStr("2026-03-14")).toBe("2026-03-16");
  });

  it("should move Sunday to Monday", () => {
    expect(adjustWeekendStr("2026-03-15")).toBe("2026-03-16");
  });

  it("should not change weekdays", () => {
    expect(adjustWeekendStr("2026-03-09")).toBe("2026-03-09"); // Monday
    expect(adjustWeekendStr("2026-03-11")).toBe("2026-03-11"); // Wednesday
    expect(adjustWeekendStr("2026-03-13")).toBe("2026-03-13"); // Friday
  });
});

describe("Vencidas até 3 dias logic (string-based)", () => {
  const todayStr = "2026-03-14"; // Saturday
  const threeDaysAgoStr = addDaysStr(todayStr, -3); // 2026-03-11

  function isVencidaAte3Dias(vencStr: string): boolean {
    const adjVenc = adjustWeekendStr(vencStr);
    return adjVenc < todayStr && adjVenc >= threeDaysAgoStr;
  }

  it("should include dates 11, 12, 13 March (within 3 days)", () => {
    expect(isVencidaAte3Dias("2026-03-11")).toBe(true);
    expect(isVencidaAte3Dias("2026-03-12")).toBe(true);
    expect(isVencidaAte3Dias("2026-03-13")).toBe(true);
  });

  it("should NOT include 14/03 (Saturday -> adjusted to 16/03 Monday, which is >= today)", () => {
    expect(isVencidaAte3Dias("2026-03-14")).toBe(false);
  });

  it("should NOT include 10/03 (more than 3 days ago)", () => {
    expect(isVencidaAte3Dias("2026-03-10")).toBe(false);
  });

  it("should NOT include 15/03 (Sunday -> adjusted to 16/03 Monday, which is >= today)", () => {
    expect(isVencidaAte3Dias("2026-03-15")).toBe(false);
  });

  it("should NOT include future dates", () => {
    expect(isVencidaAte3Dias("2026-03-16")).toBe(false);
    expect(isVencidaAte3Dias("2026-03-20")).toBe(false);
  });

  it("should NOT include very old dates (inadimplentes)", () => {
    expect(isVencidaAte3Dias("2026-02-15")).toBe(false);
    expect(isVencidaAte3Dias("2026-01-01")).toBe(false);
  });
});

describe("Week boundary calculation (string-based)", () => {
  it("should correctly calculate Monday of the week for Saturday 2026-03-14", () => {
    const todayStr = "2026-03-14";
    const dayOfWeek = getDayOfWeekStr(todayStr); // 6 (Saturday)
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 1 - 6 = -5
    const mondayStr = addDaysStr(todayStr, daysToMonday);
    expect(mondayStr).toBe("2026-03-09");
  });

  it("should correctly calculate Monday of the week for Sunday", () => {
    const todayStr = "2026-03-15";
    const dayOfWeek = getDayOfWeekStr(todayStr); // 0 (Sunday)
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayStr = addDaysStr(todayStr, daysToMonday);
    expect(mondayStr).toBe("2026-03-09");
  });

  it("should correctly calculate Monday of the week for Wednesday", () => {
    const todayStr = "2026-03-11";
    const dayOfWeek = getDayOfWeekStr(todayStr); // 3 (Wednesday)
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 1 - 3 = -2
    const mondayStr = addDaysStr(todayStr, daysToMonday);
    expect(mondayStr).toBe("2026-03-09");
  });

  it("should generate 8 consecutive weeks", () => {
    const mondayStr = "2026-03-09";
    const weeks: { start: string; end: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const wStart = addDaysStr(mondayStr, i * 7);
      const wEnd = addDaysStr(wStart, 6);
      weeks.push({ start: wStart, end: wEnd });
    }
    expect(weeks[0].start).toBe("2026-03-09");
    expect(weeks[0].end).toBe("2026-03-15");
    expect(weeks[1].start).toBe("2026-03-16");
    expect(weeks[1].end).toBe("2026-03-22");
    expect(weeks[7].start).toBe("2026-04-27");
    expect(weeks[7].end).toBe("2026-05-03");
  });
});

describe("String comparison for date ranges", () => {
  it("should correctly compare YYYY-MM-DD strings", () => {
    expect("2026-03-11" < "2026-03-14").toBe(true);
    expect("2026-03-14" < "2026-03-14").toBe(false);
    expect("2026-03-14" >= "2026-03-14").toBe(true);
    expect("2026-03-16" >= "2026-03-16").toBe(true);
    expect("2026-03-16" <= "2026-03-22").toBe(true);
  });

  it("should correctly handle month/year boundaries", () => {
    expect("2026-02-28" < "2026-03-01").toBe(true);
    expect("2025-12-31" < "2026-01-01").toBe(true);
  });
});
