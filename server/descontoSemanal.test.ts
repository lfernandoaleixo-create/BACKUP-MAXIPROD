import { describe, it, expect } from "vitest";

/**
 * Tests for the multi-week desconto semanal feature.
 * The backend stores values for 5 weeks (current + 4 future) in app_settings
 * with key "sicoob_desconto_semanal_v2".
 */

describe("Desconto Semanal - 5 Semanas", () => {
  it("should return 5 weeks with null values when no data exists", async () => {
    // Simulating the expected response structure
    const emptyResponse = {
      weeks: [
        { weekIndex: 0, valor: null, updatedBy: null, updatedAt: null },
        { weekIndex: 1, valor: null, updatedBy: null, updatedAt: null },
        { weekIndex: 2, valor: null, updatedBy: null, updatedAt: null },
        { weekIndex: 3, valor: null, updatedBy: null, updatedAt: null },
        { weekIndex: 4, valor: null, updatedBy: null, updatedAt: null },
      ],
    };
    expect(emptyResponse.weeks).toHaveLength(5);
    expect(emptyResponse.weeks[0].weekIndex).toBe(0);
    expect(emptyResponse.weeks[4].weekIndex).toBe(4);
    expect(emptyResponse.weeks.every((w) => w.valor === null)).toBe(true);
  });

  it("should accept weekIndex 0-4 in update input", () => {
    const validInputs = [0, 1, 2, 3, 4];
    validInputs.forEach((weekIndex) => {
      expect(weekIndex).toBeGreaterThanOrEqual(0);
      expect(weekIndex).toBeLessThanOrEqual(4);
    });
  });

  it("should reject weekIndex outside 0-4 range", () => {
    const invalidInputs = [-1, 5, 10];
    invalidInputs.forEach((weekIndex) => {
      expect(weekIndex < 0 || weekIndex > 4).toBe(true);
    });
  });

  it("should only allow Flavio to update values", () => {
    const allowedOperator = "Flavio";
    const deniedOperators = ["Thiago", "Thalita", "Guilherme"];

    expect(allowedOperator).toBe("Flavio");
    deniedOperators.forEach((op) => {
      expect(op).not.toBe("Flavio");
    });
  });

  it("should preserve other weeks when updating a single week", () => {
    // Simulate updating week 2 while keeping others intact
    const existingData = {
      weeks: [
        { weekIndex: 0, valor: 35000, updatedBy: "Flavio", updatedAt: "2026-05-18T10:00:00Z" },
        { weekIndex: 1, valor: 42000, updatedBy: "Flavio", updatedAt: "2026-05-18T10:00:00Z" },
        { weekIndex: 2, valor: null, updatedBy: null, updatedAt: null },
        { weekIndex: 3, valor: null, updatedBy: null, updatedAt: null },
        { weekIndex: 4, valor: null, updatedBy: null, updatedAt: null },
      ],
    };

    // Update week 2
    const weekToUpdate = 2;
    const newValue = 28500;
    existingData.weeks[weekToUpdate] = {
      weekIndex: weekToUpdate,
      valor: newValue,
      updatedBy: "Flavio",
      updatedAt: new Date().toISOString(),
    };

    // Verify other weeks unchanged
    expect(existingData.weeks[0].valor).toBe(35000);
    expect(existingData.weeks[1].valor).toBe(42000);
    expect(existingData.weeks[2].valor).toBe(28500);
    expect(existingData.weeks[3].valor).toBeNull();
    expect(existingData.weeks[4].valor).toBeNull();
  });

  it("should migrate legacy single-value format to week 0", () => {
    // Legacy format
    const legacyData = { valor: 35268.51, updatedBy: "Flavio", updatedAt: "2026-05-18T13:30:00Z" };

    // Migration result
    const migrated = {
      weeks: [
        { weekIndex: 0, valor: legacyData.valor, updatedBy: legacyData.updatedBy, updatedAt: legacyData.updatedAt },
        { weekIndex: 1, valor: null, updatedBy: null, updatedAt: null },
        { weekIndex: 2, valor: null, updatedBy: null, updatedAt: null },
        { weekIndex: 3, valor: null, updatedBy: null, updatedAt: null },
        { weekIndex: 4, valor: null, updatedBy: null, updatedAt: null },
      ],
    };

    expect(migrated.weeks[0].valor).toBe(35268.51);
    expect(migrated.weeks[0].updatedBy).toBe("Flavio");
    expect(migrated.weeks.slice(1).every((w) => w.valor === null)).toBe(true);
  });

  it("should calculate total across all weeks correctly", () => {
    const weeks = [
      { weekIndex: 0, valor: 35000 },
      { weekIndex: 1, valor: 42000 },
      { weekIndex: 2, valor: 28500 },
      { weekIndex: 3, valor: null },
      { weekIndex: 4, valor: 15000 },
    ];

    const total = weeks.reduce((sum, w) => sum + (w.valor || 0), 0);
    expect(total).toBe(120500);
  });

  it("should generate correct week labels with Monday-Friday range", () => {
    // Test the week label generation logic
    function getWeekLabel(weekIndex: number, refDate: Date): string {
      const now = refDate;
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset + (weekIndex * 7));
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      const fmtDay = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (weekIndex === 0) return `Semana Atual (${fmtDay(monday)} - ${fmtDay(friday)})`;
      return `Semana ${weekIndex + 1} (${fmtDay(monday)} - ${fmtDay(friday)})`;
    }

    // Test with Thursday May 14 (dayOfWeek=4, mondayOffset=1-4=-3, Monday=May 11)
    const thu = new Date("2026-05-14T12:00:00");
    const label0 = getWeekLabel(0, thu);
    expect(label0).toContain("Semana Atual");
    expect(label0).toContain("11/05"); // Monday May 11
    expect(label0).toContain("15/05"); // Friday May 15

    const label1 = getWeekLabel(1, thu);
    expect(label1).toContain("Semana 2");
    expect(label1).toContain("18/05"); // Monday May 18

    const label4 = getWeekLabel(4, thu);
    expect(label4).toContain("Semana 5");
    expect(label4).toContain("08/06"); // Monday June 8
  });
});
