import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("settings.getBradescoLimiteContaGarantida", () => {
  it("returns default null values when no data is set", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.settings.getBradescoLimiteContaGarantida();
    expect(result).toHaveProperty("palitos");
    expect(result).toHaveProperty("espetos");
    expect(result).toHaveProperty("varetas");
    // Each empresa should have valor, updatedBy, updatedAt
    expect(result.palitos).toHaveProperty("valor");
    expect(result.palitos).toHaveProperty("updatedBy");
    expect(result.palitos).toHaveProperty("updatedAt");
  });
});

describe("settings.updateBradescoLimiteContaGarantida", () => {
  it("rejects non-Flavio operators", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.settings.updateBradescoLimiteContaGarantida({
        empresa: "palitos",
        valor: 50000,
        operatorName: "Guilherme",
      })
    ).rejects.toThrow("Apenas o operador Flávio pode atualizar o limite.");
  });

  it("allows Flavio to update and persists the value", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.settings.updateBradescoLimiteContaGarantida({
      empresa: "espetos",
      valor: 75000.50,
      operatorName: "Flavio",
    });
    expect(result.success).toBe(true);

    // Verify persisted
    const data = await caller.settings.getBradescoLimiteContaGarantida();
    expect(data.espetos.valor).toBe(75000.50);
    expect(data.espetos.updatedBy).toBe("Flavio");
    expect(data.espetos.updatedAt).toBeTruthy();
  });
});
