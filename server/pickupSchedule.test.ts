import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the GraphQL fetch to avoid real API calls during tests
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { billingRouter } from "./billingRouter";

function createCaller() {
  return billingRouter.createCaller({
    user: null,
    req: {} as any,
    res: {} as any,
  });
}

describe("Pickup Schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPickupSchedules", () => {
    it("should return empty object when pedidos array is empty", async () => {
      const caller = createCaller();
      const result = await caller.getPickupSchedules({ pedidos: [] });
      expect(result).toEqual({});
    });

    it("should return empty for pedidos without pickup schedule", async () => {
      const caller = createCaller();
      const result = await caller.getPickupSchedules({ pedidos: ["NONEXISTENT-PS-001"] });
      expect(result).toBeDefined();
      expect(result["NONEXISTENT-PS-001"]).toBeUndefined();
    });

    it("should return pickup schedule for saved pedidos", async () => {
      const caller = createCaller();
      // Save a pickup schedule first
      await caller.setPickupSchedule({
        password: "240288",
        pedido: "TEST-PS-001",
        pickupDate: "25/03/2026",
        pickupHour: 14,
      });

      // Fetch it
      const result = await caller.getPickupSchedules({ pedidos: ["TEST-PS-001"] });
      expect(result["TEST-PS-001"]).toEqual({
        pickupDate: "25/03/2026",
        pickupHour: 14,
      });
    });
  });

  describe("setPickupSchedule", () => {
    it("should reject incorrect password", async () => {
      const caller = createCaller();
      await expect(
        caller.setPickupSchedule({
          password: "wrong-password",
          pedido: "TEST-PS-002",
          pickupDate: "25/03/2026",
          pickupHour: 10,
        })
      ).rejects.toThrow("Senha incorreta");
    });

    it("should save a pickup schedule with correct password", async () => {
      const caller = createCaller();
      const result = await caller.setPickupSchedule({
        password: "240288",
        pedido: "TEST-PS-003",
        pickupDate: "26/03/2026",
        pickupHour: 8,
      });
      expect(result.success).toBe(true);

      // Verify it was saved
      const schedules = await caller.getPickupSchedules({ pedidos: ["TEST-PS-003"] });
      expect(schedules["TEST-PS-003"]).toEqual({
        pickupDate: "26/03/2026",
        pickupHour: 8,
      });
    });

    it("should update an existing pickup schedule", async () => {
      const caller = createCaller();
      // Save initial schedule
      await caller.setPickupSchedule({
        password: "240288",
        pedido: "TEST-PS-004",
        pickupDate: "25/03/2026",
        pickupHour: 9,
      });

      // Update it
      const result = await caller.setPickupSchedule({
        password: "240288",
        pedido: "TEST-PS-004",
        pickupDate: "27/03/2026",
        pickupHour: 15,
      });
      expect(result.success).toBe(true);

      // Verify update
      const schedules = await caller.getPickupSchedules({ pedidos: ["TEST-PS-004"] });
      expect(schedules["TEST-PS-004"]).toEqual({
        pickupDate: "27/03/2026",
        pickupHour: 15,
      });
    });

    it("should handle multiple pedidos in getPickupSchedules", async () => {
      const caller = createCaller();
      // Save two schedules
      await caller.setPickupSchedule({
        password: "240288",
        pedido: "TEST-PS-MULTI-1",
        pickupDate: "25/03/2026",
        pickupHour: 10,
      });
      await caller.setPickupSchedule({
        password: "240288",
        pedido: "TEST-PS-MULTI-2",
        pickupDate: "26/03/2026",
        pickupHour: 16,
      });

      // Fetch both
      const result = await caller.getPickupSchedules({
        pedidos: ["TEST-PS-MULTI-1", "TEST-PS-MULTI-2", "TEST-PS-MULTI-NONE"],
      });
      expect(result["TEST-PS-MULTI-1"]).toEqual({ pickupDate: "25/03/2026", pickupHour: 10 });
      expect(result["TEST-PS-MULTI-2"]).toEqual({ pickupDate: "26/03/2026", pickupHour: 16 });
      expect(result["TEST-PS-MULTI-NONE"]).toBeUndefined();
    });

    it("should reject hour values outside 0-23 range", async () => {
      const caller = createCaller();
      await expect(
        caller.setPickupSchedule({
          password: "240288",
          pedido: "TEST-PS-INVALID",
          pickupDate: "25/03/2026",
          pickupHour: 25,
        })
      ).rejects.toThrow();
    });
  });
});
