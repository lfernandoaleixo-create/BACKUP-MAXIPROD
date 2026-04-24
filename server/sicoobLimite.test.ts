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

describe("Sicoob Limite - Troca de Títulos", () => {
  // Backup original value before tests
  let originalValue: { valor: number; updatedBy: string; updatedAt: string } | null = null;

  beforeAll(async () => {
    const result = await trpcQuery("settings.getSicoobLimite");
    if (result && result.valor !== null && result.valor !== undefined) {
      originalValue = { valor: result.valor, updatedBy: result.updatedBy, updatedAt: result.updatedAt };
    }
  });

  // Restore original value after ALL tests
  afterAll(async () => {
    if (originalValue && originalValue.valor !== null && originalValue.valor !== undefined) {
      await trpcMutation("settings.updateSicoobLimite", {
        valor: originalValue.valor,
        operatorName: "Flavio",
      });
    }
  });

  it("getSicoobLimite returns correct structure", async () => {
    const result = await trpcQuery("settings.getSicoobLimite");
    expect(result).toBeDefined();
    expect(result).toHaveProperty("valor");
    expect(result).toHaveProperty("updatedBy");
    expect(result).toHaveProperty("updatedAt");
  });

  it("updateSicoobLimite rejects non-Flavio operators", async () => {
    const result = await trpcMutation("settings.updateSicoobLimite", {
      valor: 50000,
      operatorName: "Thiago",
    });
    expect(result).toBeDefined();
    expect(result.message || result.data?.message || JSON.stringify(result)).toContain("Flávio");
  });

  it("updateSicoobLimite rejects Guilherme", async () => {
    const result = await trpcMutation("settings.updateSicoobLimite", {
      valor: 100000,
      operatorName: "Guilherme",
    });
    expect(result).toBeDefined();
    expect(result.message || result.data?.message || JSON.stringify(result)).toContain("Flávio");
  });

  it("updateSicoobLimite accepts Flavio and saves correctly", async () => {
    const result = await trpcMutation("settings.updateSicoobLimite", {
      valor: 250000.50,
      operatorName: "Flavio",
    });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("getSicoobLimite returns the value set by Flavio", async () => {
    const result = await trpcQuery("settings.getSicoobLimite");
    expect(result).toBeDefined();
    expect(result.valor).toBe(250000.50);
    expect(result.updatedBy).toBe("Flavio");
    expect(result.updatedAt).toBeTruthy();
    expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(0);
  });

  it("updateSicoobLimite can update to a new value", async () => {
    const result = await trpcMutation("settings.updateSicoobLimite", {
      valor: 500000,
      operatorName: "Flavio",
    });
    expect(result.success).toBe(true);

    const updated = await trpcQuery("settings.getSicoobLimite");
    expect(updated.valor).toBe(500000);
    expect(updated.updatedBy).toBe("Flavio");
    // afterAll will restore the original value
  });

  it("updateSicoobLimite rejects negative values", async () => {
    const result = await trpcMutation("settings.updateSicoobLimite", {
      valor: -1000,
      operatorName: "Flavio",
    });
    expect(result).toBeDefined();
    const isError = result.message || result.code || !result.success;
    expect(isError).toBeTruthy();
  });
});
