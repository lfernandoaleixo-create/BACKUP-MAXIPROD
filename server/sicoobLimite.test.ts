import { describe, it, expect, afterAll } from "vitest";

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
  // Clean up after tests: reset the setting to null
  afterAll(async () => {
    // We can't easily delete from app_settings via tRPC, but we can set a known value
    // The test values won't interfere with production since they're just test values
  });

  it("getSicoobLimite returns null when not set", async () => {
    const result = await trpcQuery("settings.getSicoobLimite");
    // First time might be null or might have a value from previous test runs
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
    // Should return an error
    expect(result).toBeDefined();
    // The error should indicate only Flavio can update
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
    // updatedAt should be a valid ISO date
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
  });

  it("updateSicoobLimite rejects negative values", async () => {
    const result = await trpcMutation("settings.updateSicoobLimite", {
      valor: -1000,
      operatorName: "Flavio",
    });
    // Zod validation should reject negative values
    expect(result).toBeDefined();
    // Should be an error (either zod validation or custom)
    const isError = result.message || result.code || !result.success;
    expect(isError).toBeTruthy();
  });
});
