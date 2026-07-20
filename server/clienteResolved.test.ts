import { describe, it, expect } from "vitest";

/**
 * Test that the getResolvedTitles endpoint returns data that can be filtered by client name.
 * This validates the backend data that ClienteResolvedSection uses.
 */
describe("financial.getResolvedTitles (client filtering)", () => {
  const BASE_URL = "http://localhost:3000";

  it("should return resolved titles with cliente field for client-level filtering", async () => {
    const res = await fetch(
      `${BASE_URL}/api/trpc/financial.getResolvedTitles?input=${encodeURIComponent(
        JSON.stringify({ sortOrder: "newest", sortBy: "resolvedAt", sortDir: "desc" })
      )}`
    );
    expect(res.ok).toBe(true);
    const json = await res.json();
    const data = json.result?.data?.json || json.result?.data;
    expect(data).toBeDefined();
    expect(data.titles).toBeDefined();
    expect(Array.isArray(data.titles)).toBe(true);

    // Each title should have cliente, valorAReceber, resolvedAt, diasAtrasoNaResolucao
    if (data.titles.length > 0) {
      const first = data.titles[0];
      expect(first).toHaveProperty("cliente");
      expect(first).toHaveProperty("valorAReceber");
      expect(first).toHaveProperty("resolvedAt");
      expect(first).toHaveProperty("diasAtrasoNaResolucao");
      expect(first).toHaveProperty("documento");
    }
  });

  it("should be filterable by client name (case-insensitive)", async () => {
    const res = await fetch(
      `${BASE_URL}/api/trpc/financial.getResolvedTitles?input=${encodeURIComponent(
        JSON.stringify({ sortOrder: "newest", sortBy: "resolvedAt", sortDir: "desc" })
      )}`
    );
    const json = await res.json();
    const data = json.result?.data?.json || json.result?.data;

    if (data.titles.length > 0) {
      // Pick the first client name and filter
      const targetCliente = data.titles[0].cliente;
      const filtered = data.titles.filter(
        (t: any) => (t.cliente || "").toUpperCase().trim() === (targetCliente || "").toUpperCase().trim()
      );
      expect(filtered.length).toBeGreaterThan(0);
      // All filtered should have the same client
      for (const t of filtered) {
        expect(t.cliente.toUpperCase().trim()).toBe(targetCliente.toUpperCase().trim());
      }
    }
  });

  it("should not include test clients", async () => {
    const res = await fetch(
      `${BASE_URL}/api/trpc/financial.getResolvedTitles?input=${encodeURIComponent(
        JSON.stringify({ sortOrder: "newest", sortBy: "resolvedAt", sortDir: "desc" })
      )}`
    );
    const json = await res.json();
    const data = json.result?.data?.json || json.result?.data;
    const TEST_NAMES = ["CLIENTE TESTE REGRA", "CLIENTE MANUAL TICK TEST", "CLIENTE LEGACY VIBRATION TEST", "CLIENTE RECENT VIBRATION TEST", "CLIENTE TESTE COBRANCA", "__TEST_PROPOSTA_EXCLUSION__", "__TEST_CLIENT_SUMMARY__", "CLIENTE PEDIDO VENDA"];

    for (const t of data.titles) {
      const name = (t.cliente || "").toUpperCase().trim();
      expect(TEST_NAMES.includes(name)).toBe(false);
      expect(name.startsWith("__TEST")).toBe(false);
    }
  });

  it("should only include titles with 3+ days overdue (recovery threshold)", async () => {
    const res = await fetch(
      `${BASE_URL}/api/trpc/financial.getResolvedTitles?input=${encodeURIComponent(
        JSON.stringify({ sortOrder: "newest", sortBy: "resolvedAt", sortDir: "desc" })
      )}`
    );
    const json = await res.json();
    const data = json.result?.data?.json || json.result?.data;

    for (const t of data.titles) {
      expect(t.diasAtrasoNaResolucao).toBeGreaterThanOrEqual(3);
    }
  });
});
