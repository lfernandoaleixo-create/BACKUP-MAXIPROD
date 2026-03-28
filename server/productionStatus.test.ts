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

describe("Production Status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProductionStatuses", () => {
    it("should return empty statuses when pedidos array is empty", async () => {
      const caller = createCaller();
      const result = await caller.getProductionStatuses({ pedidos: [] });
      expect(result).toEqual({ statuses: {} });
    });

    it("should accept up to 200 pedidos", async () => {
      const caller = createCaller();
      const pedidos = Array.from({ length: 200 }, (_, i) => String(i + 1));
      const result = await caller.getProductionStatuses({ pedidos });
      expect(result).toBeDefined();
      expect(result.statuses).toBeDefined();
    });

    it("should reject more than 200 pedidos", async () => {
      const caller = createCaller();
      const pedidos = Array.from({ length: 201 }, (_, i) => String(i + 1));
      await expect(caller.getProductionStatuses({ pedidos })).rejects.toThrow();
    });

    it("should return statuses for pedidos that have them", async () => {
      const caller = createCaller();
      // First save a status
      await caller.saveProductionStatus({
        password: "240288",
        pedido: "TEST-PS-001",
        status: "em_producao",
      });

      // Then fetch it
      const result = await caller.getProductionStatuses({ pedidos: ["TEST-PS-001"] });
      expect(result.statuses["TEST-PS-001"]).toBeDefined();
      expect(result.statuses["TEST-PS-001"].status).toBe("em_producao");

      // Cleanup
      await caller.saveProductionStatus({
        password: "240288",
        pedido: "TEST-PS-001",
        status: "",
      });
    });
  });

  describe("saveProductionStatus", () => {
    it("should reject incorrect password", async () => {
      const caller = createCaller();
      const result = await caller.saveProductionStatus({
        password: "wrong-password",
        pedido: "TEST-PS-002",
        status: "em_producao",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Senha incorreta");
    });

    it("should save a status with correct password", async () => {
      const caller = createCaller();
      const result = await caller.saveProductionStatus({
        password: "240288",
        pedido: "TEST-PS-003",
        status: "falta_mercadoria",
      });
      expect(result.success).toBe(true);

      // Verify it was saved
      const statuses = await caller.getProductionStatuses({ pedidos: ["TEST-PS-003"] });
      expect(statuses.statuses["TEST-PS-003"].status).toBe("falta_mercadoria");

      // Cleanup
      await caller.saveProductionStatus({
        password: "240288",
        pedido: "TEST-PS-003",
        status: "",
      });
    });

    it("should update an existing status", async () => {
      const caller = createCaller();
      // Save initial status
      await caller.saveProductionStatus({
        password: "240288",
        pedido: "TEST-PS-004",
        status: "em_producao",
      });

      // Update it
      const result = await caller.saveProductionStatus({
        password: "240288",
        pedido: "TEST-PS-004",
        status: "75_pronto",
      });
      expect(result.success).toBe(true);

      // Verify update
      const statuses = await caller.getProductionStatuses({ pedidos: ["TEST-PS-004"] });
      expect(statuses.statuses["TEST-PS-004"].status).toBe("75_pronto");

      // Cleanup
      await caller.saveProductionStatus({
        password: "240288",
        pedido: "TEST-PS-004",
        status: "",
      });
    });

    it("should delete a status when saving empty string", async () => {
      const caller = createCaller();
      // Save a status first
      await caller.saveProductionStatus({
        password: "240288",
        pedido: "TEST-PS-005",
        status: "em_separacao",
      });

      // Delete it by saving empty
      const result = await caller.saveProductionStatus({
        password: "240288",
        pedido: "TEST-PS-005",
        status: "",
      });
      expect(result.success).toBe(true);

      // Verify deletion
      const statuses = await caller.getProductionStatuses({ pedidos: ["TEST-PS-005"] });
      expect(statuses.statuses["TEST-PS-005"]).toBeUndefined();
    });

    it("should reject status longer than 50 characters", async () => {
      const caller = createCaller();
      const longStatus = "a".repeat(51);
      await expect(
        caller.saveProductionStatus({
          password: "240288",
          pedido: "TEST-PS-006",
          status: longStatus,
        })
      ).rejects.toThrow();
    });

    it("should trim whitespace from status", async () => {
      const caller = createCaller();
      const result = await caller.saveProductionStatus({
        password: "240288",
        pedido: "TEST-PS-007",
        status: "  em_producao  ",
      });
      expect(result.success).toBe(true);

      const statuses = await caller.getProductionStatuses({ pedidos: ["TEST-PS-007"] });
      expect(statuses.statuses["TEST-PS-007"].status).toBe("em_producao");

      // Cleanup
      await caller.saveProductionStatus({
        password: "240288",
        pedido: "TEST-PS-007",
        status: "",
      });
    });

    it("should handle all valid status options", async () => {
      const caller = createCaller();
      const validStatuses = [
        "em_producao",
        "falta_mercadoria",
        "falta_materia_prima",
        "pronto_aguardando_data",
        "25_pronto",
        "50_pronto",
        "75_pronto",
        "em_separacao",
      ];

      for (let i = 0; i < validStatuses.length; i++) {
        const status = validStatuses[i];
        const pedido = `TS-A${i}`;
        const result = await caller.saveProductionStatus({
          password: "240288",
          pedido,
          status,
        });
        expect(result.success).toBe(true);

        // Cleanup
        await caller.saveProductionStatus({
          password: "240288",
          pedido,
          status: "",
        });
      }
    });
  });
});
