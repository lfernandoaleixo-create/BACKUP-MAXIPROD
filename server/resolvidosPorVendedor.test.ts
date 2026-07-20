import { describe, it, expect } from "vitest";

/**
 * Test: getResolvidosPorVendedor endpoint
 * Validates the endpoint returns the expected structure with proper filtering
 */
describe("salesMetrics.getResolvidosPorVendedor", () => {
  it("should return an array of vendedor objects with resolved clients", async () => {
    const response = await fetch("http://localhost:3000/api/trpc/salesMetrics.getResolvidosPorVendedor");
    expect(response.ok).toBe(true);

    const json = await response.json();
    expect(json.result).toBeDefined();
    expect(json.result.data).toBeDefined();
    expect(json.result.data.json).toBeDefined();

    const data = json.result.data.json;
    expect(Array.isArray(data)).toBe(true);

    // Should have at least one vendedor with resolved titles
    if (data.length > 0) {
      const first = data[0];
      expect(first).toHaveProperty("vendedor");
      expect(first).toHaveProperty("qtdClientes");
      expect(first).toHaveProperty("totalValorResolved");
      expect(first).toHaveProperty("clientes");
      expect(typeof first.vendedor).toBe("string");
      expect(typeof first.qtdClientes).toBe("number");
      expect(typeof first.totalValorResolved).toBe("number");
      expect(Array.isArray(first.clientes)).toBe(true);

      // Check client structure
      if (first.clientes.length > 0) {
        const cliente = first.clientes[0];
        expect(cliente).toHaveProperty("nome");
        expect(cliente).toHaveProperty("titulos");
        expect(cliente).toHaveProperty("totalResolved");
        expect(cliente).toHaveProperty("valorResolved");
        expect(cliente).toHaveProperty("titlesStillOverdue");
        expect(cliente).toHaveProperty("valorStillOverdue");
        expect(typeof cliente.nome).toBe("string");
        expect(typeof cliente.totalResolved).toBe("number");
        expect(typeof cliente.valorResolved).toBe("number");
        expect(typeof cliente.titlesStillOverdue).toBe("number");
        expect(typeof cliente.valorStillOverdue).toBe("number");
        expect(Array.isArray(cliente.titulos)).toBe(true);

        // Check titulo structure
        if (cliente.titulos.length > 0) {
          const titulo = cliente.titulos[0];
          expect(titulo).toHaveProperty("resolvedAt");
          expect(titulo).toHaveProperty("valor");
          expect(titulo).toHaveProperty("diasAtraso");
          expect(typeof titulo.resolvedAt).toBe("string");
          expect(typeof titulo.valor).toBe("number");
          expect(typeof titulo.diasAtraso).toBe("number");
          // 3-day rule: all titulos should have diasAtraso >= 3
          expect(titulo.diasAtraso).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it("should not include test clients in results", async () => {
    const response = await fetch("http://localhost:3000/api/trpc/salesMetrics.getResolvidosPorVendedor");
    const json = await response.json();
    const data = json.result.data.json;

    const TEST_CLIENTS = [
      "CLIENTE TESTE REGRA",
      "CLIENTE MANUAL TICK TEST",
      "CLIENTE LEGACY VIBRATION TEST",
      "CLIENTE RECENT VIBRATION TEST",
      "CLIENTE TESTE COBRANCA",
      "__TEST_PROPOSTA_EXCLUSION__",
      "__TEST_CLIENT_SUMMARY__",
      "CLIENTE PEDIDO VENDA",
    ];

    for (const vendedor of data) {
      for (const cliente of vendedor.clientes) {
        const upper = cliente.nome.toUpperCase().trim();
        expect(TEST_CLIENTS.includes(upper)).toBe(false);
        expect(upper.startsWith("__TEST")).toBe(false);
        expect(upper.includes("_TEST_")).toBe(false);
      }
    }
  });

  it("should sort vendedores by totalValorResolved descending", async () => {
    const response = await fetch("http://localhost:3000/api/trpc/salesMetrics.getResolvidosPorVendedor");
    const json = await response.json();
    const data = json.result.data.json;

    for (let i = 1; i < data.length; i++) {
      expect(data[i - 1].totalValorResolved).toBeGreaterThanOrEqual(data[i].totalValorResolved);
    }
  });

  it("should enforce 3-day rule for all resolved titles", async () => {
    const response = await fetch("http://localhost:3000/api/trpc/salesMetrics.getResolvidosPorVendedor");
    const json = await response.json();
    const data = json.result.data.json;

    for (const vendedor of data) {
      for (const cliente of vendedor.clientes) {
        for (const titulo of cliente.titulos) {
          expect(titulo.diasAtraso).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});
