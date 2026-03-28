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

describe("Transport Selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTransportSelections", () => {
    it("should return empty object when pedidos array is empty", async () => {
      const caller = createCaller();
      const result = await caller.getTransportSelections({ pedidos: [] });
      expect(result).toEqual({});
    });

    it("should return empty for pedidos without transport selection", async () => {
      const caller = createCaller();
      const result = await caller.getTransportSelections({ pedidos: ["NONEXISTENT-001"] });
      expect(result).toBeDefined();
      expect(result["NONEXISTENT-001"]).toBeUndefined();
    });

    it("should return transport selection for saved pedidos", async () => {
      const caller = createCaller();
      // Save a transport selection first
      await caller.setTransportSelection({
        password: "240288",
        pedido: "TEST-TR-001",
        transportadora: "braspress",
      });

      // Fetch it
      const result = await caller.getTransportSelections({ pedidos: ["TEST-TR-001"] });
      expect(result["TEST-TR-001"]).toBe("braspress");

      // Cleanup
      await caller.setTransportSelection({
        password: "240288",
        pedido: "TEST-TR-001",
        transportadora: "cliente_retira",
      });
    });
  });

  describe("setTransportSelection", () => {
    it("should reject incorrect password", async () => {
      const caller = createCaller();
      await expect(
        caller.setTransportSelection({
          password: "wrong-password",
          pedido: "TEST-TR-002",
          transportadora: "braspress",
        })
      ).rejects.toThrow("Senha incorreta");
    });

    it("should save a transport selection with correct password", async () => {
      const caller = createCaller();
      const result = await caller.setTransportSelection({
        password: "240288",
        pedido: "TEST-TR-003",
        transportadora: "flor_de_minas",
      });
      expect(result.success).toBe(true);

      // Verify it was saved
      const selections = await caller.getTransportSelections({ pedidos: ["TEST-TR-003"] });
      expect(selections["TEST-TR-003"]).toBe("flor_de_minas");
    });

    it("should update an existing transport selection", async () => {
      const caller = createCaller();
      // Save initial selection
      await caller.setTransportSelection({
        password: "240288",
        pedido: "TEST-TR-004",
        transportadora: "braspress",
      });

      // Update it
      const result = await caller.setTransportSelection({
        password: "240288",
        pedido: "TEST-TR-004",
        transportadora: "rodo_naves",
      });
      expect(result.success).toBe(true);

      // Verify update
      const selections = await caller.getTransportSelections({ pedidos: ["TEST-TR-004"] });
      expect(selections["TEST-TR-004"]).toBe("rodo_naves");
    });

    it("should handle all valid transport options", async () => {
      const caller = createCaller();
      const validOptions = [
        "cliente_retira",
        "braspress",
        "flor_de_minas",
        "rodo_naves",
        "delcio",
      ];

      for (let i = 0; i < validOptions.length; i++) {
        const transportadora = validOptions[i];
        const pedido = `TEST-TR-OPT-${i}`;
        const result = await caller.setTransportSelection({
          password: "240288",
          pedido,
          transportadora,
        });
        expect(result.success).toBe(true);

        // Verify
        const selections = await caller.getTransportSelections({ pedidos: [pedido] });
        expect(selections[pedido]).toBe(transportadora);
      }
    });

    it("should handle multiple pedidos in getTransportSelections", async () => {
      const caller = createCaller();
      // Save two selections
      await caller.setTransportSelection({
        password: "240288",
        pedido: "TEST-TR-MULTI-1",
        transportadora: "braspress",
      });
      await caller.setTransportSelection({
        password: "240288",
        pedido: "TEST-TR-MULTI-2",
        transportadora: "delcio",
      });

      // Fetch both
      const result = await caller.getTransportSelections({
        pedidos: ["TEST-TR-MULTI-1", "TEST-TR-MULTI-2", "TEST-TR-MULTI-NONE"],
      });
      expect(result["TEST-TR-MULTI-1"]).toBe("braspress");
      expect(result["TEST-TR-MULTI-2"]).toBe("delcio");
      expect(result["TEST-TR-MULTI-NONE"]).toBeUndefined();
    });
  });
});
