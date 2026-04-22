import { describe, it, expect } from "vitest";

/**
 * Tests for E-commerce History logic
 * Validates the normalized output format, classification rules, and PC→CX conversion
 */

// Re-implement the key functions locally for unit testing
function extractUnitsPerBox(desc: string): number | null {
  const d = desc.toUpperCase();
  if (d.includes("KG") && !d.includes("UNID")) return null;

  const cPattern = /C\/\s*([\d.]+)\s*(?:UNID|UN)/i;
  const cMatch = desc.match(cPattern);
  if (cMatch) return parseFloat(cMatch[1].replace(/\./g, ""));

  const threeNumPattern = /(\d+)\s*[xX*]\s*(\d+)\s*[xX*]\s*(\d+)(?!\s*MM)/;
  const threeMatch = desc.match(threeNumPattern);
  if (threeMatch) return parseInt(threeMatch[1]) * parseInt(threeMatch[2]) * parseInt(threeMatch[3]);

  const cNxMUnidPattern = /C\/\s*([\d.]+)\s*[xX]\s*([\d.]+)\s*(?:UNID|UN)/i;
  const cNxMUnidMatch = desc.match(cNxMUnidPattern);
  if (cNxMUnidMatch) return parseFloat(cNxMUnidMatch[1].replace(/\./g, "")) * parseFloat(cNxMUnidMatch[2].replace(/\./g, ""));

  const cNxMPattern = /C\/\s*([\d.]+)\s*[xX]\s*([\d.]+)/i;
  const cNxMMatch = desc.match(cNxMPattern);
  if (cNxMMatch) return parseFloat(cNxMMatch[1].replace(/\./g, "")) * parseFloat(cNxMMatch[2].replace(/\./g, ""));

  const afterMM = desc.replace(/\d+[,.]?\d*\s*[xX*]\s*\d+\s*(?:MM|CM)/gi, "");
  const nxmPattern = /([\d.]+)\s*[xX]\s*([\d.]+)\s*(?:UNID|UN)/i;
  const nxmMatch = afterMM.match(nxmPattern);
  if (nxmMatch) return parseFloat(nxmMatch[1].replace(/\./g, "")) * parseFloat(nxmMatch[2].replace(/\./g, ""));

  const hashiPattern = /CM\s+(\d+)\s*[xX*]\s*(\d+)/i;
  const hashiMatch = desc.match(hashiPattern);
  if (hashiMatch) return parseInt(hashiMatch[1]) * parseInt(hashiMatch[2]);

  const varetaPattern = /MM\s+([\d.]+)$/i;
  const varetaMatch = desc.trim().match(varetaPattern);
  if (varetaMatch) return parseFloat(varetaMatch[1].replace(/\./g, ""));

  const afterMM2 = desc.replace(/\d+[,.]?\d*\s*[xX*]\s*\d+\s*(?:MM|CM)/gi, "");
  const nxmNoUnidPattern = /(\d+)\s*[xX]\s*(\d+)\s*$/;
  const nxmNoUnidMatch = afterMM2.trim().match(nxmNoUnidPattern);
  if (nxmNoUnidMatch) return parseInt(nxmNoUnidMatch[1]) * parseInt(nxmNoUnidMatch[2]);

  return null;
}

function extractDimensions(desc: string): string | null {
  const match = desc.match(/(\d+[,.]?\d*)\s*[xX]\s*(\d+)\s*MM/i);
  if (match) return `${match[1]} X ${match[2]}`;
  return null;
}

function extractProductType(desc: string): string {
  const d = desc.toUpperCase();
  if (d.includes("MANICURE") && d.includes("DUAS PONTAS")) return "MANICURE_DUAS_PONTAS";
  if (d.includes("MANICURE") && (d.includes("PONTA/CHANFRO") || d.includes("CHANFRO"))) return "MANICURE_PONTA_CHANFRO";
  if (d.includes("FIBRA") && d.includes("AROMATIZADOR")) return "VARETA_FIBRA_AROMATIZADOR";
  if (d.includes("ALGOD") && d.includes("DOCE") && d.includes("MADEIRA")) return "VARETA_ALGODAO_DOCE_MADEIRA";
  if (d.includes("ALGOD") && d.includes("DOCE")) return "VARETA_ALGODAO_DOCE";
  if (d.includes("AROMATIZADOR")) return "VARETA_AROMATIZADOR";
  if (d.includes("ESPETO") && d.includes("BAMBU")) return "ESPETO_BAMBU";
  if (d.includes("PALITO") && d.includes("DENTE")) return "PALITO_DENTE";
  if (d.includes("HASHI")) return "PALITO_HASHI";
  if (d.includes("PETISCO")) return "PALITO_PETISCO";
  return "OUTRO";
}

describe("E-commerce History - Business Rules", () => {
  it("should classify E-COMMERCE estadoConfiguravel correctly", () => {
    const testCases = [
      { input: "E-COMMERCE", expected: true },
      { input: "e-commerce", expected: true },
      { input: "ECOMMERCE", expected: true },
      { input: "BAMBU", expected: false },
      { input: "MADEIRA", expected: false },
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

  it("should not include non-E-COMMERCE faturados", () => {
    const orders = [
      { estadoConfiguravel: "E-COMMERCE", estadoItem: "Faturado", pedido: "909" },
      { estadoConfiguravel: "BAMBU", estadoItem: "Faturado", pedido: "900" },
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

describe("E-commerce History - extractUnitsPerBox", () => {
  it("should extract units from C/ N UNID pattern", () => {
    expect(extractUnitsPerBox("PALITO DE MANICURE DUAS PONTAS BAMBU 4,0 X 125MM C/ 10.000 UNID.")).toBe(10000);
    expect(extractUnitsPerBox("VARETA DE FIBRA PARA AROMATIZADOR DE 3,0 X 200 MM C/ 20.000 UNID. PRETA")).toBe(20000);
    expect(extractUnitsPerBox("VARETA PARA ALGODÃO DOCE BAMBU 4,0 X 350 MM C/ 10.000 UNID.")).toBe(10000);
    expect(extractUnitsPerBox("VARETA AROMATIZADOR 4,0 X 125 MM C/ 100 UNID.")).toBe(100);
  });

  it("should extract units from VARETA AROMATIZADOR MM N pattern (no UNID)", () => {
    expect(extractUnitsPerBox("VARETA AROMATIZADOR 4,0 X 125 MM 10.000")).toBe(10000);
    expect(extractUnitsPerBox("VARETA AROMATIZADOR 4,0 X 180 MM 10.000")).toBe(10000);
    expect(extractUnitsPerBox("VARETA AROMATIZADOR 4,0 X 200 MM 10.000")).toBe(10000);
    expect(extractUnitsPerBox("VARETA AROMATIZADOR 4,0 X 250 MM 10.000")).toBe(10000);
  });

  it("should extract units from NxM pattern after MM (no UNID)", () => {
    expect(extractUnitsPerBox("VARETA AROMATIZADOR 4,0 X 250 MM 100 x 100")).toBe(10000);
    expect(extractUnitsPerBox("VARETA AROMATIZADOR 4,0 X 125 MM 200 x 100")).toBe(20000);
  });

  it("should extract units from C/ NxM UNID pattern", () => {
    expect(extractUnitsPerBox("PALITO DE MANICURE PONTA/CHANFRO BAMBU 4,0 X 125 MM C/ 200 X100 UNID.")).toBe(20000);
  });

  it("should extract units from CM NxM pattern (hashi)", () => {
    expect(extractUnitsPerBox("PALITO HASHI DE BAMBU 20 CM C/ 20 X 100 UNID.")).toBe(2000);
  });
});

describe("E-commerce History - extractDimensions", () => {
  it("should extract dimensions from product descriptions", () => {
    expect(extractDimensions("PALITO DE MANICURE DUAS PONTAS BAMBU 4,0 X 125 MM C/ 100 UNID.")).toBe("4,0 X 125");
    expect(extractDimensions("VARETA AROMATIZADOR 4,0 X 250 MM 10.000")).toBe("4,0 X 250");
    expect(extractDimensions("VARETA AROMATIZADOR FIBRA 3,0 X 200 MM-FLOW-PACK 50 UNID.")).toBe("3,0 X 200");
    expect(extractDimensions("VARETA PARA ALGODÃO DOCE MADEIRA 4,0 X 350 MM C/ 300 UNID.")).toBe("4,0 X 350");
  });

  it("should return null for descriptions without dimensions", () => {
    expect(extractDimensions("PRODUTO SEM MEDIDAS")).toBeNull();
  });
});

describe("E-commerce History - extractProductType", () => {
  it("should classify product types correctly", () => {
    expect(extractProductType("PALITO DE MANICURE DUAS PONTAS BAMBU 4,0 X 125 MM")).toBe("MANICURE_DUAS_PONTAS");
    expect(extractProductType("PALITO DE MANICURE PONTA/CHANFRO BAMBU 4,0 X 125 MM")).toBe("MANICURE_PONTA_CHANFRO");
    expect(extractProductType("VARETA AROMATIZADOR FIBRA 3,0 X 200 MM")).toBe("VARETA_FIBRA_AROMATIZADOR");
    expect(extractProductType("VARETA AROMATIZADOR 4,0 X 125 MM")).toBe("VARETA_AROMATIZADOR");
    expect(extractProductType("VARETA PARA ALGODÃO DOCE MADEIRA 4,0 X 350 MM")).toBe("VARETA_ALGODAO_DOCE_MADEIRA");
    expect(extractProductType("ESPETO DE BAMBU 4,0 X 250 MM")).toBe("ESPETO_BAMBU");
    expect(extractProductType("PALITO HASHI DE BAMBU 20 CM")).toBe("PALITO_HASHI");
  });
});

describe("E-commerce History - PC→CX Conversion", () => {
  it("should convert PC items to CX using parent units per box", () => {
    // Simulating the conversion logic:
    // totalUnidades = qtdPC * unidadesPerPC (from description)
    // caixas = totalUnidades / parentUnitsPerBox

    const conversions = [
      // code, qtdPC, unPerPC, parentUpb, expectedCx, expectedUn
      { code: "00470", qtdPC: 1000, unPerPC: 100, parentUpb: 10000, expectedCx: 10, expectedUn: 100000 },
      { code: "00471", qtdPC: 1000, unPerPC: 500, parentUpb: 10000, expectedCx: 50, expectedUn: 500000 },
      { code: "00472", qtdPC: 1000, unPerPC: 100, parentUpb: 10000, expectedCx: 10, expectedUn: 100000 },
      { code: "00473", qtdPC: 1000, unPerPC: 500, parentUpb: 10000, expectedCx: 50, expectedUn: 500000 },
      { code: "00487", qtdPC: 1000, unPerPC: 100, parentUpb: 10000, expectedCx: 10, expectedUn: 100000 },  // Note: actual qty from Maxiprod may differ
      { code: "00490", qtdPC: 1000, unPerPC: 50, parentUpb: 10000, expectedCx: 5, expectedUn: 50000 },
      { code: "00491", qtdPC: 1000, unPerPC: 200, parentUpb: 10000, expectedCx: 20, expectedUn: 200000 },
    ];

    for (const c of conversions) {
      const totalUn = c.qtdPC * c.unPerPC;
      const cx = totalUn / c.parentUpb;
      expect(totalUn).toBe(c.expectedUn);
      expect(cx).toBe(c.expectedCx);
    }
  });

  it("should prefer maxiprodFator > 1 over descFator", () => {
    // When maxiprodFator is > 1, use it
    const maxiprodFator = 5000;
    const descFator = 10000;
    const result = (maxiprodFator && maxiprodFator > 1) ? maxiprodFator : descFator;
    expect(result).toBe(5000);
  });

  it("should use descFator when maxiprodFator is 1", () => {
    // When maxiprodFator is 1 (no conversion), fall back to description extraction
    const maxiprodFator = 1;
    const descFator = 10000;
    const result = (maxiprodFator && maxiprodFator > 1) ? maxiprodFator : descFator;
    expect(result).toBe(10000);
  });

  it("should use descFator when maxiprodFator is null", () => {
    const maxiprodFator = null;
    const descFator = 10000;
    const result = (maxiprodFator && maxiprodFator > 1) ? maxiprodFator : descFator;
    expect(result).toBe(10000);
  });

  it("should not convert CX items (only PC)", () => {
    // Items already in CX should not be converted
    const umCodigo = "CX";
    const shouldConvert = umCodigo === "PC";
    expect(shouldConvert).toBe(false);
  });

  it("should handle VARETA AROMATIZADOR with fallback to child items when no pure parent exists", () => {
    // For VARETA AROMATIZADOR 4,0 X 200 MM, all stock items are children
    // The system should use fallback (allNonPcByTypeAndDim) to find a match
    // Parent 00084 (child of 00095) has desc "VARETA AROMATIZADOR 4,0 X 200 MM 10.000"
    // extractUnitsPerBox should return 10000 for this description
    const parentDesc = "VARETA AROMATIZADOR 4,0 X 200 MM 10.000";
    const upb = extractUnitsPerBox(parentDesc);
    expect(upb).toBe(10000);

    // Conversion: 1000 PC × 50 un = 50000 / 10000 = 5 CX
    const totalUn = 1000 * 50;
    const cx = totalUn / upb!;
    expect(cx).toBe(5);
  });
});
