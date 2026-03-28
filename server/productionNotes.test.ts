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

describe("Production Notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProductionNotes", () => {
    it("should return empty notes when pedidos array is empty", async () => {
      const caller = createCaller();
      const result = await caller.getProductionNotes({ pedidos: [] });
      expect(result).toEqual({ notes: {} });
    });

    it("should accept up to 200 pedidos", async () => {
      const caller = createCaller();
      const pedidos = Array.from({ length: 200 }, (_, i) => String(i + 1));
      const result = await caller.getProductionNotes({ pedidos });
      expect(result).toBeDefined();
      expect(result.notes).toBeDefined();
    });

    it("should reject more than 200 pedidos", async () => {
      const caller = createCaller();
      const pedidos = Array.from({ length: 201 }, (_, i) => String(i + 1));
      await expect(caller.getProductionNotes({ pedidos })).rejects.toThrow();
    });

    it("should return notes for pedidos that have them", async () => {
      const caller = createCaller();
      // First save a note
      await caller.saveProductionNote({
        password: "240288",
        pedido: "TEST-PN-001",
        note: "Produção em andamento",
      });

      // Then fetch it
      const result = await caller.getProductionNotes({ pedidos: ["TEST-PN-001"] });
      expect(result.notes["TEST-PN-001"]).toBeDefined();
      expect(result.notes["TEST-PN-001"].note).toBe("Produção em andamento");

      // Cleanup
      await caller.saveProductionNote({
        password: "240288",
        pedido: "TEST-PN-001",
        note: "",
      });
    });
  });

  describe("saveProductionNote", () => {
    it("should reject incorrect password", async () => {
      const caller = createCaller();
      const result = await caller.saveProductionNote({
        password: "wrong-password",
        pedido: "TEST-PN-002",
        note: "Test note",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Senha incorreta");
    });

    it("should save a note with correct password", async () => {
      const caller = createCaller();
      const result = await caller.saveProductionNote({
        password: "240288",
        pedido: "TEST-PN-003",
        note: "Previsão de conclusão sexta-feira",
      });
      expect(result.success).toBe(true);

      // Verify it was saved
      const notes = await caller.getProductionNotes({ pedidos: ["TEST-PN-003"] });
      expect(notes.notes["TEST-PN-003"].note).toBe("Previsão de conclusão sexta-feira");

      // Cleanup
      await caller.saveProductionNote({
        password: "240288",
        pedido: "TEST-PN-003",
        note: "",
      });
    });

    it("should update an existing note", async () => {
      const caller = createCaller();
      // Save initial note
      await caller.saveProductionNote({
        password: "240288",
        pedido: "TEST-PN-004",
        note: "Nota original",
      });

      // Update it
      const result = await caller.saveProductionNote({
        password: "240288",
        pedido: "TEST-PN-004",
        note: "Nota atualizada",
      });
      expect(result.success).toBe(true);

      // Verify update
      const notes = await caller.getProductionNotes({ pedidos: ["TEST-PN-004"] });
      expect(notes.notes["TEST-PN-004"].note).toBe("Nota atualizada");

      // Cleanup
      await caller.saveProductionNote({
        password: "240288",
        pedido: "TEST-PN-004",
        note: "",
      });
    });

    it("should delete a note when saving empty string", async () => {
      const caller = createCaller();
      // Save a note first
      await caller.saveProductionNote({
        password: "240288",
        pedido: "TEST-PN-005",
        note: "Nota para deletar",
      });

      // Delete it by saving empty
      const result = await caller.saveProductionNote({
        password: "240288",
        pedido: "TEST-PN-005",
        note: "",
      });
      expect(result.success).toBe(true);

      // Verify deletion
      const notes = await caller.getProductionNotes({ pedidos: ["TEST-PN-005"] });
      expect(notes.notes["TEST-PN-005"]).toBeUndefined();
    });

    it("should reject notes longer than 1000 characters", async () => {
      const caller = createCaller();
      const longNote = "a".repeat(1001);
      await expect(
        caller.saveProductionNote({
          password: "240288",
          pedido: "TEST-PN-006",
          note: longNote,
        })
      ).rejects.toThrow();
    });

    it("should trim whitespace from notes", async () => {
      const caller = createCaller();
      const result = await caller.saveProductionNote({
        password: "240288",
        pedido: "TEST-PN-007",
        note: "  Nota com espaços  ",
      });
      expect(result.success).toBe(true);

      const notes = await caller.getProductionNotes({ pedidos: ["TEST-PN-007"] });
      expect(notes.notes["TEST-PN-007"].note).toBe("Nota com espaços");

      // Cleanup
      await caller.saveProductionNote({
        password: "240288",
        pedido: "TEST-PN-007",
        note: "",
      });
    });
  });
});
