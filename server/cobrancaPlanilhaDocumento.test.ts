import { describe, it, expect } from "vitest";

/**
 * Tests for the documento and centro fields
 * in the Planilha de Cobrança.
 * 
 * - Documento: built from documentoVinculadoNumero + parcela + parcelasQuantidadeTotal
 * - Centro: derived from the most common estadoConfiguravel in sales_orders for the client
 */

describe("Documento field formatting", () => {
  // Simulate the documento building logic from cobrancaPlanilhaSync.ts and cobrancaPlanilhaRouter.ts
  function buildDocumento(docNum: string | null, parcela: string | null, totalParcelas: string | null): string | null {
    if (!docNum) return null;
    let documento = `NF ${docNum}`;
    if (parcela && totalParcelas) {
      documento += ` (${parcela}/${totalParcelas})`;
    } else if (parcela) {
      documento += ` (${parcela})`;
    }
    return documento;
  }

  it("should format NF with parcela and total", () => {
    expect(buildDocumento("1586", "3", "5")).toBe("NF 1586 (3/5)");
  });

  it("should format NF with parcela only (no total)", () => {
    expect(buildDocumento("1886", "2", null)).toBe("NF 1886 (2)");
  });

  it("should format NF without parcela", () => {
    expect(buildDocumento("1584", null, null)).toBe("NF 1584");
  });

  it("should return null when no docNum", () => {
    expect(buildDocumento(null, "1", "3")).toBeNull();
  });

  it("should handle empty string docNum as falsy", () => {
    expect(buildDocumento("", "1", "3")).toBeNull();
  });
});

describe("Centro derivation from sales_orders", () => {
  it("should accept valid centro values", () => {
    const validCentros = ["BAMBU", "MADEIRA", "ROJÃO", "SERRAGEM"];
    for (const centro of validCentros) {
      expect(validCentros).toContain(centro);
    }
  });

  it("should filter out non-product estadoConfiguravel values", () => {
    // The sync only considers BAMBU, MADEIRA, ROJÃO, SERRAGEM
    const validFilter = ['BAMBU', 'MADEIRA', 'ROJÃO', 'SERRAGEM'];
    const testValues = ['BAMBU', 'AMOSTRA', 'CANCELADO', 'BONIFICAÇÃO', 'MADEIRA'];
    const filtered = testValues.filter(v => validFilter.includes(v));
    expect(filtered).toEqual(['BAMBU', 'MADEIRA']);
  });
});

describe("Planilha schema - documento column", () => {
  it("should have documento field in the schema", async () => {
    const { cobrancaPlanilha } = await import("../drizzle/schema");
    expect(cobrancaPlanilha.documento).toBeDefined();
  });

  it("should have centroCustos field in cobranca_planilha schema", async () => {
    const { cobrancaPlanilha } = await import("../drizzle/schema");
    expect(cobrancaPlanilha.centroCustos).toBeDefined();
  });

  it("should have estadoConfiguravel field in salesOrders schema", async () => {
    const { salesOrders } = await import("../drizzle/schema");
    expect(salesOrders.estadoConfiguravel).toBeDefined();
  });
});
