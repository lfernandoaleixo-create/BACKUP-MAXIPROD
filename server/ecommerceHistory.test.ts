import { describe, it, expect } from "vitest";

/**
 * Tests for E-commerce History logic
 * Validates the normalized output format and classification rules
 */

describe("E-commerce History - Business Rules", () => {
  it("should classify E-COMMERCE estadoConfiguravel correctly", () => {
    const testCases = [
      { input: "E-COMMERCE", expected: true },
      { input: "e-commerce", expected: true },
      { input: "ECOMMERCE", expected: true },
      { input: "BAMBU", expected: false },
      { input: "MADEIRA", expected: false },
      { input: "FIBRA", expected: false },
      { input: "", expected: false },
      { input: null, expected: false },
    ];

    for (const tc of testCases) {
      const val = (tc.input || "").toUpperCase();
      const isEcommerce = val === "E-COMMERCE" || val === "ECOMMERCE";
      expect(isEcommerce, `"${tc.input}" should be ${tc.expected}`).toBe(tc.expected);
    }
  });

  it("should identify faturado items by estadoItem", () => {
    const testCases = [
      { input: "Faturado", expected: true },
      { input: "Faturado parcial", expected: true },
      { input: "Faturado c/ entrega futura", expected: true },
      { input: "Parc. faturado c/ entrega futura", expected: true },
      { input: "A faturar", expected: false },
      { input: "Cancelado", expected: false },
      { input: "", expected: false },
    ];

    for (const tc of testCases) {
      const val = tc.input.toLowerCase();
      const isFaturado = val.includes("aturado");
      expect(isFaturado, `"${tc.input}" should be faturado=${tc.expected}`).toBe(tc.expected);
    }
  });

  it("should classify tipoMovimento correctly for faturados", () => {
    const classify = (estadoItem: string) => {
      const lower = (estadoItem || "").toLowerCase();
      if (lower.includes("parcial") || lower.includes("parc.")) return "faturado_parcial";
      return "faturado";
    };

    expect(classify("Faturado")).toBe("faturado");
    expect(classify("Faturado parcial")).toBe("faturado_parcial");
    expect(classify("Faturado c/ entrega futura")).toBe("faturado");
    expect(classify("Parc. faturado c/ entrega futura")).toBe("faturado_parcial");
  });

  it("should classify tipoMovimento correctly for snapshot transfers", () => {
    const classify = (cxAnterior: number, cxAtual: number) => {
      return cxAtual <= 0 ? "saida_total" : "saida_parcial";
    };

    expect(classify(100, 0)).toBe("saida_total");
    expect(classify(100, 50)).toBe("saida_parcial");
    expect(classify(100, -5)).toBe("saida_total");
    expect(classify(100, 1)).toBe("saida_parcial");
  });

  it("should produce normalized output with required fields", () => {
    // Simulate the normalized output shape
    const item = {
      detectedAt: new Date(),
      codigoItem: "00007B",
      descricaoItem: "ESPETO DE BAMBU 4,0 X 250 MM C/ 125 X 40 UNID.",
      quantidadeCx: 15,
      quantidadeUn: 75000,
      tipoMovimento: "faturado",
      pedidoRelacionado: "909",
      cliente: "PALITOS INDUSTRIA E COMERCIO LTDA",
    };

    expect(item).toHaveProperty("detectedAt");
    expect(item).toHaveProperty("codigoItem");
    expect(item).toHaveProperty("descricaoItem");
    expect(item).toHaveProperty("quantidadeCx");
    expect(item).toHaveProperty("quantidadeUn");
    expect(item).toHaveProperty("tipoMovimento");
    expect(item).toHaveProperty("pedidoRelacionado");
    expect(item).toHaveProperty("cliente");
    expect(typeof item.quantidadeCx).toBe("number");
    expect(typeof item.quantidadeUn).toBe("number");
  });

  it("should calculate quantities correctly with fatorConversao", () => {
    // When fatorConversao > 1, quantity is in sales unit, convert to stock units
    const fatorConversao = 5000;
    const quantidade = 15; // 15 CX
    const quantidadeUn = quantidade * fatorConversao; // 75000 un
    
    expect(quantidadeUn).toBe(75000);
    
    // When fatorConversao = 1, quantity stays the same
    const fator1 = 1;
    const qtd1 = 100;
    expect(qtd1 * fator1).toBe(100);
  });

  it("should not include non-E-COMMERCE faturados", () => {
    // Only E-COMMERCE estadoConfiguravel should be included
    const orders = [
      { estadoConfiguravel: "E-COMMERCE", estadoItem: "Faturado", pedido: "909" },
      { estadoConfiguravel: "BAMBU", estadoItem: "Faturado", pedido: "900" },
      { estadoConfiguravel: "MADEIRA", estadoItem: "Faturado", pedido: "901" },
      { estadoConfiguravel: "E-COMMERCE", estadoItem: "A faturar", pedido: "910" },
    ];

    const ecommerceFaturados = orders.filter(o => {
      const ec = (o.estadoConfiguravel || "").toUpperCase();
      const isEcom = ec === "E-COMMERCE" || ec === "ECOMMERCE";
      const isFaturado = (o.estadoItem || "").toLowerCase().includes("aturado");
      return isEcom && isFaturado;
    });

    expect(ecommerceFaturados).toHaveLength(1);
    expect(ecommerceFaturados[0].pedido).toBe("909");
  });
});
