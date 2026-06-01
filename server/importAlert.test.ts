import { describe, it, expect } from "vitest";

// Test the alert trigger logic inline (mirrors importRouter.getActiveAlerts logic)

function parseArrivalDate(dateStr: string): Date | null {
  let arrivalDateObj: Date;
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    arrivalDateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } else {
    arrivalDateObj = new Date(dateStr);
  }
  if (isNaN(arrivalDateObj.getTime())) return null;
  return arrivalDateObj;
}

function shouldTriggerAlert(
  arrivalDateStr: string,
  alertDaysBefore: number,
  alertDismissed: boolean,
  today: Date
): { triggered: boolean; daysRemaining: number } {
  if (!arrivalDateStr || !alertDaysBefore || alertDismissed) {
    return { triggered: false, daysRemaining: 0 };
  }

  const arrivalDateObj = parseArrivalDate(arrivalDateStr);
  if (!arrivalDateObj) return { triggered: false, daysRemaining: 0 };

  // Calculate alert trigger date (arrival - days_before)
  const alertTriggerDate = new Date(arrivalDateObj);
  alertTriggerDate.setDate(alertTriggerDate.getDate() - alertDaysBefore);

  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);

  // If today >= alert trigger date, show the alert
  if (todayMidnight >= alertTriggerDate) {
    const diffTime = arrivalDateObj.getTime() - todayMidnight.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { triggered: true, daysRemaining };
  }

  return { triggered: false, daysRemaining: 0 };
}

describe("Payment Alert Logic", () => {
  it("should not trigger if alertDismissed is true", () => {
    const today = new Date("2026-06-01");
    const result = shouldTriggerAlert("15/06/2026", 15, true, today);
    expect(result.triggered).toBe(false);
  });

  it("should not trigger if alertDaysBefore is 0", () => {
    const today = new Date("2026-06-01");
    const result = shouldTriggerAlert("15/06/2026", 0, false, today);
    expect(result.triggered).toBe(false);
  });

  it("should not trigger if arrivalDate is empty", () => {
    const today = new Date("2026-06-01");
    const result = shouldTriggerAlert("", 15, false, today);
    expect(result.triggered).toBe(false);
  });

  it("should trigger when today is within alert window (DD/MM/YYYY format)", () => {
    // Arrival: 15/06/2026, alert 15 days before → triggers from 31/05/2026
    const today = new Date("2026-06-01");
    const result = shouldTriggerAlert("15/06/2026", 15, false, today);
    expect(result.triggered).toBe(true);
    expect(result.daysRemaining).toBe(14); // 14 days remaining
  });

  it("should trigger when today equals arrival date (0 days remaining)", () => {
    const today = new Date("2026-06-15");
    const result = shouldTriggerAlert("15/06/2026", 15, false, today);
    expect(result.triggered).toBe(true);
    expect(result.daysRemaining).toBe(0);
  });

  it("should trigger when arrival date has passed (negative days remaining)", () => {
    const today = new Date("2026-06-20");
    const result = shouldTriggerAlert("15/06/2026", 15, false, today);
    expect(result.triggered).toBe(true);
    expect(result.daysRemaining).toBe(-5);
  });

  it("should NOT trigger when today is before the alert window", () => {
    // Arrival: 30/06/2026, alert 10 days before → triggers from 20/06/2026
    const today = new Date("2026-06-15");
    const result = shouldTriggerAlert("30/06/2026", 10, false, today);
    expect(result.triggered).toBe(false);
  });

  it("should trigger exactly on the alert trigger date", () => {
    // Arrival: 30/06/2026, alert 10 days before → triggers on 20/06/2026
    const today = new Date("2026-06-20");
    const result = shouldTriggerAlert("30/06/2026", 10, false, today);
    expect(result.triggered).toBe(true);
    expect(result.daysRemaining).toBe(10);
  });

  it("should handle YYYY-MM-DD format", () => {
    const today = new Date("2026-06-01");
    const result = shouldTriggerAlert("2026-06-15", 15, false, today);
    expect(result.triggered).toBe(true);
    expect(result.daysRemaining).toBe(14);
  });

  it("should return invalid for malformed dates", () => {
    const today = new Date("2026-06-01");
    const result = shouldTriggerAlert("invalid-date", 15, false, today);
    expect(result.triggered).toBe(false);
  });

  it("should handle 1 day before alert", () => {
    // Arrival: 02/06/2026, alert 1 day before → triggers on 01/06/2026
    const today = new Date("2026-06-01");
    const result = shouldTriggerAlert("02/06/2026", 1, false, today);
    expect(result.triggered).toBe(true);
    expect(result.daysRemaining).toBe(1);
  });
});

describe("parseArrivalDate", () => {
  it("should parse DD/MM/YYYY format correctly", () => {
    const date = parseArrivalDate("15/06/2026");
    expect(date).not.toBeNull();
    expect(date!.getDate()).toBe(15);
    expect(date!.getMonth()).toBe(5); // June = 5 (0-indexed)
    expect(date!.getFullYear()).toBe(2026);
  });

  it("should parse YYYY-MM-DD format correctly", () => {
    const date = parseArrivalDate("2026-06-15");
    expect(date).not.toBeNull();
    expect(date!.getDate()).toBe(15);
    expect(date!.getMonth()).toBe(5);
    expect(date!.getFullYear()).toBe(2026);
  });

  it("should return null for invalid date", () => {
    const date = parseArrivalDate("not-a-date");
    expect(date).toBeNull();
  });
});
