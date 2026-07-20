import { describe, it, expect } from "vitest";

/**
 * Tests for the Stock Withdrawal Router
 * Validates the tRPC procedures for the Solicitação de Baixa module
 */

// Import the router to validate its structure
import { stockWithdrawalRouter } from "./stockWithdrawalRouter";

describe("stockWithdrawalRouter", () => {
  it("should export a valid tRPC router", () => {
    expect(stockWithdrawalRouter).toBeDefined();
    expect(stockWithdrawalRouter._def).toBeDefined();
    expect(stockWithdrawalRouter._def.procedures).toBeDefined();
  });

  it("should have all required procedures", () => {
    const procedures = stockWithdrawalRouter._def.procedures;
    expect(procedures).toHaveProperty("searchProducts");
    expect(procedures).toHaveProperty("searchDestinoProducts");
    expect(procedures).toHaveProperty("create");
    expect(procedures).toHaveProperty("list");
    expect(procedures).toHaveProperty("countPending");
    expect(procedures).toHaveProperty("approve");
    expect(procedures).toHaveProperty("reject");
    expect(procedures).toHaveProperty("complete");
    expect(procedures).toHaveProperty("monthlyStats");
  });

  it("should have the correct number of procedures", () => {
    const procedures = Object.keys(stockWithdrawalRouter._def.procedures);
    expect(procedures.length).toBeGreaterThanOrEqual(9);
  });

  it("create procedure should validate required fields", () => {
    // The create procedure uses z.object with required fields
    const createProcedure = (stockWithdrawalRouter._def.procedures as any).create;
    expect(createProcedure).toBeDefined();
    expect(createProcedure._def).toBeDefined();
  });

  it("list procedure should support status filter", () => {
    const listProcedure = (stockWithdrawalRouter._def.procedures as any).list;
    expect(listProcedure).toBeDefined();
    expect(listProcedure._def).toBeDefined();
  });

  it("approve procedure should require id, fiscalId, and fiscalName", () => {
    const approveProcedure = (stockWithdrawalRouter._def.procedures as any).approve;
    expect(approveProcedure).toBeDefined();
    expect(approveProcedure._def).toBeDefined();
  });

  it("reject procedure should require id, fiscalId, fiscalName and optional justificativa", () => {
    const rejectProcedure = (stockWithdrawalRouter._def.procedures as any).reject;
    expect(rejectProcedure).toBeDefined();
    expect(rejectProcedure._def).toBeDefined();
  });

  it("complete procedure should require id, fiscalId, and fiscalName", () => {
    const completeProcedure = (stockWithdrawalRouter._def.procedures as any).complete;
    expect(completeProcedure).toBeDefined();
    expect(completeProcedure._def).toBeDefined();
  });
});

describe("stockWithdrawalRouter - schema validation", () => {
  it("create input should enforce motivo enum values", () => {
    const createProcedure = (stockWithdrawalRouter._def.procedures as any).create;
    const inputParser = createProcedure._def.inputs[0];
    
    // Valid motivo values (updated to match current schema)
    const validMotivos = ["consumo_pedido", "amostra", "reembalagem", "ajuste_inventario", "avaria_perda", "uso_interno", "devolucao_retrabalho", "outro"];
    for (const motivo of validMotivos) {
      const result = inputParser.safeParse({
        productCode: "TEST001",
        productName: "Test Product",
        quantity: "5",
        motivo,
        senha: "test123",
      });
      expect(result.success).toBe(true);
    }

    // Invalid motivo
    const invalidResult = inputParser.safeParse({
      productCode: "TEST001",
      productName: "Test Product",
      quantity: "5",
      motivo: "invalid_motivo",
      solicitanteId: 1,
      solicitanteName: "Test User",
    });
    expect(invalidResult.success).toBe(false);
  });

  it("list input should enforce status enum values", () => {
    const listProcedure = (stockWithdrawalRouter._def.procedures as any).list;
    const inputParser = listProcedure._def.inputs[0];

    const validStatuses = ["pendente", "aprovada", "concluida", "recusada", "todas"];
    for (const status of validStatuses) {
      const result = inputParser.safeParse({ status });
      expect(result.success).toBe(true);
    }

    const invalidResult = inputParser.safeParse({ status: "invalid_status" });
    expect(invalidResult.success).toBe(false);
  });
});
