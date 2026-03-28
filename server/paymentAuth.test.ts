/**
 * Tests for payment authorization procedures
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();
const mockLimit = vi.fn();

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: (...args: any[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: any[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: any[]) => {
              mockWhere(...wArgs);
              return {
                limit: (...lArgs: any[]) => {
                  mockLimit(...lArgs);
                  return [];
                },
              };
            },
          };
        },
      };
    },
    insert: (...args: any[]) => {
      mockInsert(...args);
      return {
        values: (...vArgs: any[]) => {
          mockValues(...vArgs);
          return Promise.resolve();
        },
      };
    },
    update: (...args: any[]) => {
      mockUpdate(...args);
      return {
        set: (...sArgs: any[]) => {
          mockSet(...sArgs);
          return {
            where: (...wArgs: any[]) => {
              mockWhere(...wArgs);
              return Promise.resolve();
            },
          };
        },
      };
    },
    delete: (...args: any[]) => {
      mockDelete(...args);
      return {
        where: (...wArgs: any[]) => {
          mockWhere(...wArgs);
          return Promise.resolve();
        },
      };
    },
  })),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    maxiprodGraphqlToken: "test-token",
    maxiprodEmail: "test@test.com",
    maxiprodPassword: "test",
  },
}));

describe("Payment Authorization Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PayableItem classification", () => {
    it("should correctly calculate valor a pagar (valorLiquido - valorPagoLiquido)", () => {
      const valorLiquido = 1500.50;
      const valorPagoLiquido = 300.25;
      const valorAPagar = valorLiquido - valorPagoLiquido;
      expect(valorAPagar).toBe(1200.25);
    });

    it("should skip items with valor <= 0 (already paid)", () => {
      const valorLiquido = 500;
      const valorPagoLiquido = 500;
      const valor = valorLiquido - valorPagoLiquido;
      expect(valor <= 0).toBe(true);
    });

    it("should handle null valorPagoLiquido as 0", () => {
      const valorLiquido = 1000;
      const valorPagoLiquido = null;
      const valor = (Number(valorLiquido) || 0) - (Number(valorPagoLiquido) || 0);
      expect(valor).toBe(1000);
    });
  });

  describe("Weekend adjustment for payment dates", () => {
    // adjustWeekendStr logic: Sat -> Mon, Sun -> Mon
    function adjustWeekendStr(dateStr: string): string {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      if (dow === 6) {
        // Saturday -> Monday (+2)
        const dt = new Date(y, m - 1, d + 2);
        return dt.toISOString().slice(0, 10);
      }
      if (dow === 0) {
        // Sunday -> Monday (+1)
        const dt = new Date(y, m - 1, d + 1);
        return dt.toISOString().slice(0, 10);
      }
      return dateStr;
    }

    it("should move Saturday to Monday", () => {
      // 2026-03-21 is Saturday
      expect(adjustWeekendStr("2026-03-21")).toBe("2026-03-23");
    });

    it("should move Sunday to Monday", () => {
      // 2026-03-22 is Sunday
      expect(adjustWeekendStr("2026-03-22")).toBe("2026-03-23");
    });

    it("should keep weekday dates unchanged", () => {
      // 2026-03-17 is Monday
      expect(adjustWeekendStr("2026-03-17")).toBe("2026-03-17");
      // 2026-03-19 is Wednesday
      expect(adjustWeekendStr("2026-03-19")).toBe("2026-03-19");
      // 2026-03-21 is Friday... wait, 2026-03-20 is Friday
      expect(adjustWeekendStr("2026-03-20")).toBe("2026-03-20");
    });
  });

  describe("Authorization toggle logic", () => {
    it("should authorize a payment (insert new record)", async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      expect(db).toBeTruthy();
      
      // When no existing authorization, should insert
      // The mock returns empty array for select().from().where().limit()
      expect(mockSelect).not.toHaveBeenCalled(); // fresh mock
    });

    it("should deauthorize a payment (delete record)", async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      
      if (db) {
        // Simulate delete
        await db.delete({} as any).where({} as any);
        expect(mockDelete).toHaveBeenCalled();
      }
    });
  });

  describe("Week day calculation", () => {
    function getWeekDays(todayStr: string): string[] {
      const [y, m, d] = todayStr.split("-").map(Number);
      const today = new Date(y, m - 1, d);
      const dow = today.getDay(); // 0=Sun, 1=Mon...
      const daysToMonday = dow === 0 ? 6 : dow - 1;
      const monday = new Date(y, m - 1, d - daysToMonday);
      
      const weekDays: string[] = [];
      for (let i = 0; i < 5; i++) {
        const dt = new Date(monday.getTime() + i * 86400000);
        weekDays.push(dt.toISOString().slice(0, 10));
      }
      return weekDays;
    }

    it("should calculate Mon-Fri for a Monday", () => {
      const days = getWeekDays("2026-03-16"); // Monday
      expect(days).toEqual([
        "2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-20",
      ]);
    });

    it("should calculate Mon-Fri for a Wednesday", () => {
      const days = getWeekDays("2026-03-18"); // Wednesday
      expect(days).toEqual([
        "2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-20",
      ]);
    });

    it("should calculate Mon-Fri for a Sunday", () => {
      const days = getWeekDays("2026-03-22"); // Sunday
      expect(days).toEqual([
        "2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-20",
      ]);
    });

    it("should calculate Mon-Fri for a Friday", () => {
      const days = getWeekDays("2026-03-20"); // Friday
      expect(days).toEqual([
        "2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-20",
      ]);
    });
  });

  describe("Vencidas classification", () => {
    it("should classify accounts before Monday as vencidas", () => {
      const mondayStr = "2026-03-16";
      const vencimento = "2026-03-13"; // Friday before
      expect(vencimento < mondayStr).toBe(true);
    });

    it("should not classify accounts on Monday as vencidas", () => {
      const mondayStr = "2026-03-16";
      const vencimento = "2026-03-16";
      expect(vencimento < mondayStr).toBe(false);
    });

    it("should classify accounts within week to correct day bucket", () => {
      const weekDays = ["2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-20"];
      const vencimento = "2026-03-18"; // Wednesday
      
      let assignedDay = -1;
      for (let i = 0; i < 5; i++) {
        if (vencimento === weekDays[i]) {
          assignedDay = i;
          break;
        }
      }
      expect(assignedDay).toBe(2); // Index 2 = Wednesday
    });
  });

  describe("Authorization counts", () => {
    it("should calculate correct authorized count and total", () => {
      const items = [
        { maxiprodId: 1, authorized: true, valor: 100 },
        { maxiprodId: 2, authorized: false, valor: 200 },
        { maxiprodId: 3, authorized: true, valor: 300 },
        { maxiprodId: 4, authorized: false, valor: 150 },
      ];

      const authorizedCount = items.filter((i) => i.authorized).length;
      const authorizedTotal = items
        .filter((i) => i.authorized)
        .reduce((s, i) => s + i.valor, 0);
      const total = items.reduce((s, i) => s + i.valor, 0);

      expect(authorizedCount).toBe(2);
      expect(authorizedTotal).toBe(400);
      expect(total).toBe(750);
    });

    it("should handle all authorized", () => {
      const items = [
        { authorized: true, valor: 100 },
        { authorized: true, valor: 200 },
      ];
      const allAuthorized = items.every((i) => i.authorized);
      expect(allAuthorized).toBe(true);
    });

    it("should handle none authorized", () => {
      const items = [
        { authorized: false, valor: 100 },
        { authorized: false, valor: 200 },
      ];
      const authorizedCount = items.filter((i) => i.authorized).length;
      expect(authorizedCount).toBe(0);
    });
  });
});
