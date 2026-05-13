import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("cobrancaPlanilha router", () => {
  const caller = appRouter.createCaller(createTestContext());

  it("getAll returns array of items", async () => {
    const result = await caller.cobrancaPlanilha.getAll();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("getSummary returns correct structure", async () => {
    const result = await caller.cobrancaPlanilha.getSummary();
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("byStatus");
    expect(result).toHaveProperty("byCenter");
    expect(result).toHaveProperty("totalValor");
    expect(result.total).toBeGreaterThan(0);
    expect(typeof result.totalValor).toBe("number");
  });

  it("getSummary has correct status distribution", async () => {
    const result = await caller.cobrancaPlanilha.getSummary();
    const statuses = Object.keys(result.byStatus);
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses).toContain("Pendente");
  });

  it("getSummary has correct center distribution", async () => {
    const result = await caller.cobrancaPlanilha.getSummary();
    const centers = Object.keys(result.byCenter);
    expect(centers.length).toBeGreaterThan(0);
    expect(centers).toContain("BAMBU");
  });

  it("getAll items have required fields", async () => {
    const result = await caller.cobrancaPlanilha.getAll();
    const first = result[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("empresa");
    expect(first).toHaveProperty("status");
    expect(first).toHaveProperty("valor");
    expect(first.empresa.length).toBeGreaterThan(0);
  });

  it("updateField rejects non-editable fields", async () => {
    await expect(
      caller.cobrancaPlanilha.updateField({
        id: 1,
        field: "empresa",
        value: "Hack",
        updatedBy: "test",
      })
    ).rejects.toThrow("não é editável");
  });

  it("updateField accepts valid editable field", async () => {
    const items = await caller.cobrancaPlanilha.getAll();
    if (items.length === 0) return;
    const item = items[0];
    const originalStatus = item.status;
    
    const result = await caller.cobrancaPlanilha.updateField({
      id: item.id,
      field: "status",
      value: "Contatado",
      updatedBy: "test",
    });
    expect(result.success).toBe(true);
    
    // Verify update
    const updated = await caller.cobrancaPlanilha.getAll();
    const updatedItem = updated.find(i => i.id === item.id);
    expect(updatedItem?.status).toBe("Contatado");
    
    // Restore original
    await caller.cobrancaPlanilha.updateField({
      id: item.id,
      field: "status",
      value: originalStatus,
      updatedBy: "test",
    });
  });

  it("updateObservacao works correctly", async () => {
    const items = await caller.cobrancaPlanilha.getAll();
    if (items.length === 0) return;
    const item = items[items.length - 1];
    const originalObs = item.observacoes;
    
    const result = await caller.cobrancaPlanilha.updateObservacao({
      id: item.id,
      observacoes: "Teste de observação vitest",
      updatedBy: "test",
    });
    expect(result.success).toBe(true);
    
    // Verify
    const updated = await caller.cobrancaPlanilha.getAll();
    const updatedItem = updated.find(i => i.id === item.id);
    expect(updatedItem?.observacoes).toBe("Teste de observação vitest");
    
    // Restore
    await caller.cobrancaPlanilha.updateObservacao({
      id: item.id,
      observacoes: originalObs || "",
      updatedBy: "test",
    });
  });
});
