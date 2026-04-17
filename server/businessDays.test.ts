import { describe, it, expect } from "vitest";

// Test the countBusinessDays and addBusinessDaysStr logic
// These functions are in financialRouter.ts but we test the logic inline

const BANKING_HOLIDAYS = [
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03",
  "2026-04-21", "2026-05-01", "2026-06-04", "2026-09-07",
  "2026-10-12", "2026-11-02", "2026-11-15", "2026-12-25",
];

function isBusinessDay(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (BANKING_HOLIDAYS.includes(dateStr)) return false;
  return true;
}

function countBusinessDays(fromDateStr: string, toDateStr: string): number {
  const from = new Date(fromDateStr + "T12:00:00");
  const to = new Date(toDateStr + "T12:00:00");
  if (to <= from) return 0;
  let count = 0;
  const current = new Date(from);
  current.setDate(current.getDate() + 1);
  while (current <= to) {
    const dateStr = current.toISOString().split("T")[0];
    if (isBusinessDay(dateStr)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function addBusinessDaysStr(baseDateStr: string, businessDays: number): string {
  const d = new Date(baseDateStr + "T12:00:00");
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    const ds = d.toISOString().split("T")[0];
    if (isBusinessDay(ds)) added++;
  }
  return d.toISOString().split("T")[0];
}

describe("countBusinessDays", () => {
  it("should count 0 business days for same date", () => {
    expect(countBusinessDays("2026-04-17", "2026-04-17")).toBe(0);
  });

  it("should count 1 business day for consecutive weekdays", () => {
    // Thursday to Friday
    expect(countBusinessDays("2026-04-16", "2026-04-17")).toBe(1);
  });

  it("should skip weekends", () => {
    // Friday 17/04 to Monday 20/04 = 1 business day (Monday)
    expect(countBusinessDays("2026-04-17", "2026-04-20")).toBe(1);
  });

  it("should skip holidays (21/04 Tiradentes)", () => {
    // Monday 20/04 to Wednesday 22/04 = 1 business day (22/04, skipping 21/04 holiday)
    expect(countBusinessDays("2026-04-20", "2026-04-22")).toBe(1);
  });

  it("should handle weekend + holiday combo", () => {
    // Friday 17/04 to Wednesday 22/04 = 2 business days (Mon 20 + Wed 22, skip Sat/Sun + Tue 21 holiday)
    expect(countBusinessDays("2026-04-17", "2026-04-22")).toBe(2);
  });

  it("should count a full week correctly", () => {
    // Monday 13/04 to Friday 17/04 = 4 business days (Tue, Wed, Thu, Fri)
    expect(countBusinessDays("2026-04-13", "2026-04-17")).toBe(4);
  });
});

describe("addBusinessDaysStr", () => {
  it("should add 1 business day on a weekday", () => {
    // Thursday 16/04 + 1 = Friday 17/04
    expect(addBusinessDaysStr("2026-04-16", 1)).toBe("2026-04-17");
  });

  it("should skip weekends when adding days", () => {
    // Friday 17/04 + 1 = Monday 20/04
    expect(addBusinessDaysStr("2026-04-17", 1)).toBe("2026-04-20");
  });

  it("should skip holidays when adding days", () => {
    // Monday 20/04 + 1 = Wednesday 22/04 (skip Tue 21/04 Tiradentes)
    expect(addBusinessDaysStr("2026-04-20", 1)).toBe("2026-04-22");
  });

  it("should handle multiple business days with weekend+holiday", () => {
    // Friday 17/04 + 3 = Thursday 23/04 (Mon 20, Wed 22 skip Tue 21 holiday, Thu 23)
    expect(addBusinessDaysStr("2026-04-17", 3)).toBe("2026-04-23");
  });

  it("should add 5 business days correctly", () => {
    // Wednesday 15/04 + 5 = Thursday 23/04
    // Thu 16, Fri 17, Mon 20, Wed 22 (skip Tue 21 holiday), Thu 23
    expect(addBusinessDaysStr("2026-04-15", 5)).toBe("2026-04-23");
  });
});

describe("Collection days use business days", () => {
  const COLLECTION_DAYS = [1, 3, 5];

  it("should identify collection day 1 as first business day after vencimento", () => {
    // Vencimento: 16/04 (Thu). Day 1 = 17/04 (Fri) = 1 business day
    const vencStr = "2026-04-16";
    const todayStr = "2026-04-17";
    const bd = countBusinessDays(vencStr, todayStr);
    expect(bd).toBe(1);
    expect(COLLECTION_DAYS.includes(bd)).toBe(true);
  });

  it("should NOT identify weekend as collection day", () => {
    // Vencimento: 16/04 (Thu). Saturday 18/04 = still 1 business day (only Fri counted)
    const vencStr = "2026-04-16";
    const saturdayStr = "2026-04-18";
    const bd = countBusinessDays(vencStr, saturdayStr);
    expect(bd).toBe(1); // Still day 1 (no new business day on Saturday)
    // But Saturday is not a business day itself, so no action should be taken
    expect(isBusinessDay(saturdayStr)).toBe(false);
  });

  it("should NOT identify holiday as collection day", () => {
    // 21/04 (Tiradentes) is not a business day
    expect(isBusinessDay("2026-04-21")).toBe(false);
  });

  it("should correctly calculate day 3 with weekend+holiday", () => {
    // Vencimento: 15/04 (Wed). 
    // Day 1 = Thu 16, Day 2 = Fri 17, Day 3 = Mon 20 (skip Sat/Sun)
    const vencStr = "2026-04-15";
    const day3Date = addBusinessDaysStr(vencStr, 3);
    expect(day3Date).toBe("2026-04-20");
    
    const bd = countBusinessDays(vencStr, "2026-04-20");
    expect(bd).toBe(3);
    expect(COLLECTION_DAYS.includes(bd)).toBe(true);
  });
});
