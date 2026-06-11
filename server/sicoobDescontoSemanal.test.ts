import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;

async function trpcQuery(path: string, input?: any) {
  const url = input
    ? `${BASE}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : `${BASE}/api/trpc/${path}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.result?.data?.json;
}

async function trpcMutation(path: string, input: any) {
  const res = await fetch(`${BASE}/api/trpc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const json = await res.json();
  if (json.error) return json.error?.json || json.error;
  return json.result?.data?.json;
}

describe("Sicoob Desconto Semanal - Valor previsto de liberação", () => {
  // Backup original value before tests
  let originalValue: { valor: number; updatedBy: string; updatedAt: string } | null = null;

  beforeAll(async () => {
    const result = await trpcQuery("settings.getSicoobDescontoSemanal");
    if (result && result.valor !== null && result.valor !== undefined) {
      originalValue = { valor: result.valor, updatedBy: result.updatedBy, updatedAt: result.updatedAt };
    }
  });

  // Restore original value after ALL tests
  afterAll(async () => {
    if (originalValue && originalValue.valor !== null && originalValue.valor !== undefined) {
      await trpcMutation("settings.updateSicoobDescontoSemanal", {
        valor: originalValue.valor,
        operatorName: "Flavio",
      });
    }
  });

  it("getSicoobDescontoSemanal returns correct structure", async () => {
    const result = await trpcQuery("settings.getSicoobDescontoSemanal");
    expect(result).toBeDefined();
    expect(result).toHaveProperty("valor");
    expect(result).toHaveProperty("updatedBy");
    expect(result).toHaveProperty("updatedAt");
  });

  it("updateSicoobDescontoSemanal rejects non-Flavio operators", async () => {
    const result = await trpcMutation("settings.updateSicoobDescontoSemanal", {
      valor: 100000,
      operatorName: "Thalita",
    });
    expect(result).toBeDefined();
    expect(result.message || result.data?.message || JSON.stringify(result)).toContain("Flávio");
  });

  it("updateSicoobDescontoSemanal rejects Guilherme", async () => {
    const result = await trpcMutation("settings.updateSicoobDescontoSemanal", {
      valor: 200000,
      operatorName: "Guilherme",
    });
    expect(result).toBeDefined();
    expect(result.message || result.data?.message || JSON.stringify(result)).toContain("Flávio");
  });

  it("updateSicoobDescontoSemanal accepts Flavio and saves correctly", async () => {
    const result = await trpcMutation("settings.updateSicoobDescontoSemanal", {
      valor: 350000,
      operatorName: "Flavio",
    });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("getSicoobDescontoSemanal returns the value set by Flavio", async () => {
    const result = await trpcQuery("settings.getSicoobDescontoSemanal");
    expect(result).toBeDefined();
    expect(result.valor).toBe(350000);
    expect(result.updatedBy).toBe("Flavio");
    expect(result.updatedAt).toBeTruthy();
    expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(0);
  });

  it("updateSicoobDescontoSemanal rejects negative values", async () => {
    const result = await trpcMutation("settings.updateSicoobDescontoSemanal", {
      valor: -500,
      operatorName: "Flavio",
    });
    expect(result).toBeDefined();
    const isError = result.message || result.code || !result.success;
    expect(isError).toBeTruthy();
  });

  it("desconto semanal and limite are independent settings", async () => {
    // Save current limite value first
    const limiteBackup = await trpcQuery("settings.getSicoobLimite");

    // Update desconto semanal
    await trpcMutation("settings.updateSicoobDescontoSemanal", {
      valor: 175000,
      operatorName: "Flavio",
    });

    // Check that limite was not affected
    const limite = await trpcQuery("settings.getSicoobLimite");
    expect(limite.valor).toBe(limiteBackup.valor);

    // Check desconto semanal has the new value
    const desconto = await trpcQuery("settings.getSicoobDescontoSemanal");
    expect(desconto.valor).toBe(175000);
    // afterAll will restore the original value
  });
});
