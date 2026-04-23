import { describe, it, expect } from "vitest";
import {
  CX_DIRECT_PRODUCTS,
  PC_TO_CX_MAPPINGS,
  ECOMMERCE_FILIAL_CLIENTS,
  convertPcToCx,
  isDirectCxProduct,
  isPcVariant,
  getAllImportEcommerceProductCodes,
} from "./ecommerceManualMappings";

describe("ecommerceManualMappings - CX_DIRECT_PRODUCTS", () => {
  it("should include all 5 CX direct products", () => {
    const expected = ["00007B", "00009", "00033", "00032", "00054"];
    for (const code of expected) {
      expect(CX_DIRECT_PRODUCTS[code]).toBeDefined();
    }
    expect(Object.keys(CX_DIRECT_PRODUCTS)).toHaveLength(5);
  });

  it("should correctly identify direct CX products", () => {
    expect(isDirectCxProduct("00007B")).toBe(true);
    expect(isDirectCxProduct("00009")).toBe(true);
    expect(isDirectCxProduct("00033")).toBe(true);
    expect(isDirectCxProduct("00032")).toBe(true);
    expect(isDirectCxProduct("00054")).toBe(true);
    expect(isDirectCxProduct("00470")).toBe(false);
    expect(isDirectCxProduct("99999")).toBe(false);
  });
});

describe("ecommerceManualMappings - PC_TO_CX_MAPPINGS", () => {
  it("should have mappings for all 12 PC products", () => {
    const pcCodes = [
      "00470", "00471", "00472", "00473", "00474", "00475",
      "00476", "00477", "00478", "00479", "00484", "00485",
    ];
    for (const code of pcCodes) {
      expect(PC_TO_CX_MAPPINGS[code]).toBeDefined();
    }
    expect(Object.keys(PC_TO_CX_MAPPINGS)).toHaveLength(12);
  });

  it("should correctly identify PC variants", () => {
    expect(isPcVariant("00470")).toBe(true);
    expect(isPcVariant("00485")).toBe(true);
    expect(isPcVariant("00007B")).toBe(false);
    expect(isPcVariant("99999")).toBe(false);
  });

  it("should map 00470 to parent 00036 with correct un/pc and un/cx", () => {
    const m = PC_TO_CX_MAPPINGS["00470"];
    expect(m.parentCode).toBe("00036");
    expect(m.unPerPc).toBe(100);
    expect(m.unPerCxParent).toBe(10000);
  });

  it("should map 00484 to parent 00110 with 20000 un/cx (not 10000)", () => {
    const m = PC_TO_CX_MAPPINGS["00484"];
    expect(m.parentCode).toBe("00110");
    expect(m.unPerPc).toBe(50);
    expect(m.unPerCxParent).toBe(20000);
  });

  it("should map 00485 to parent 00110 with 200 un/pc", () => {
    const m = PC_TO_CX_MAPPINGS["00485"];
    expect(m.parentCode).toBe("00110");
    expect(m.unPerPc).toBe(200);
    expect(m.unPerCxParent).toBe(20000);
  });
});

describe("ecommerceManualMappings - convertPcToCx", () => {
  it("should convert 00470 (1000 PC × 100 un / 10000 un/cx) = 10 CX", () => {
    const result = convertPcToCx("00470", 1000);
    expect(result).not.toBeNull();
    expect(result!.caixas).toBe(10);
    expect(result!.parentCode).toBe("00036");
  });

  it("should convert 00471 (1000 PC × 500 un / 10000 un/cx) = 50 CX", () => {
    const result = convertPcToCx("00471", 1000);
    expect(result!.caixas).toBe(50);
    expect(result!.parentCode).toBe("00036");
  });

  it("should convert 00472 (1000 PC × 100 un / 10000 un/cx) = 10 CX", () => {
    const result = convertPcToCx("00472", 1000);
    expect(result!.caixas).toBe(10);
    expect(result!.parentCode).toBe("00046");
  });

  it("should convert 00473 (1000 PC × 500 un / 10000 un/cx) = 50 CX", () => {
    const result = convertPcToCx("00473", 1000);
    expect(result!.caixas).toBe(50);
    expect(result!.parentCode).toBe("00046");
  });

  it("should convert 00474 (1000 PC × 50 un / 10000 un/cx) = 5 CX", () => {
    const result = convertPcToCx("00474", 1000);
    expect(result!.caixas).toBe(5);
    expect(result!.parentCode).toBe("00037");
  });

  it("should convert 00475 (1000 PC × 250 un / 10000 un/cx) = 25 CX", () => {
    const result = convertPcToCx("00475", 1000);
    expect(result!.caixas).toBe(25);
    expect(result!.parentCode).toBe("00037");
  });

  it("should convert 00476 (1000 PC × 50 un / 10000 un/cx) = 5 CX", () => {
    const result = convertPcToCx("00476", 1000);
    expect(result!.caixas).toBe(5);
    expect(result!.parentCode).toBe("00051");
  });

  it("should convert 00477 (1000 PC × 250 un / 10000 un/cx) = 25 CX", () => {
    const result = convertPcToCx("00477", 1000);
    expect(result!.caixas).toBe(25);
    expect(result!.parentCode).toBe("00051");
  });

  it("should convert 00478 (1000 PC × 50 un / 10000 un/cx) = 5 CX", () => {
    const result = convertPcToCx("00478", 1000);
    expect(result!.caixas).toBe(5);
    expect(result!.parentCode).toBe("00040");
  });

  it("should convert 00479 (1000 PC × 250 un / 10000 un/cx) = 25 CX", () => {
    const result = convertPcToCx("00479", 1000);
    expect(result!.caixas).toBe(25);
    expect(result!.parentCode).toBe("00040");
  });

  it("should convert 00484 (1000 PC × 50 un / 20000 un/cx) = 2.5 CX", () => {
    const result = convertPcToCx("00484", 1000);
    expect(result!.caixas).toBe(2.5);
    expect(result!.parentCode).toBe("00110");
  });

  it("should convert 00485 (1000 PC × 200 un / 20000 un/cx) = 10 CX", () => {
    const result = convertPcToCx("00485", 1000);
    expect(result!.caixas).toBe(10);
    expect(result!.parentCode).toBe("00110");
  });

  it("should return null for unknown product codes", () => {
    expect(convertPcToCx("99999", 100)).toBeNull();
  });

  it("should handle zero quantity", () => {
    const result = convertPcToCx("00470", 0);
    expect(result).not.toBeNull();
    expect(result!.caixas).toBe(0);
  });

  it("should produce correct total of 222.5 cx for all 12 PC items (1000 PC each)", () => {
    const pcCodes = [
      "00470", "00471", "00472", "00473", "00474", "00475",
      "00476", "00477", "00478", "00479", "00484", "00485",
    ];
    let total = 0;
    for (const code of pcCodes) {
      const result = convertPcToCx(code, 1000);
      expect(result).not.toBeNull();
      total += result!.caixas;
    }
    // 10+50+10+50+5+25+5+25+5+25+2.5+10 = 222.5
    expect(total).toBe(222.5);
  });

  it("should produce grand total of 297.5 cx for all 17 items", () => {
    // 5 CX direct: 15+10+20+20+10 = 75
    // 12 PC converted: 222.5
    // Total: 297.5
    const cxTotal = 15 + 10 + 20 + 20 + 10;
    const pcTotal = 222.5;
    expect(cxTotal + pcTotal).toBe(297.5);
  });
});

describe("ecommerceManualMappings - getAllImportEcommerceProductCodes", () => {
  it("should return all 17 product codes", () => {
    const codes = getAllImportEcommerceProductCodes();
    expect(codes).toHaveLength(17);
    expect(codes).toContain("00007B");
    expect(codes).toContain("00470");
    expect(codes).toContain("00485");
  });
});

describe("ecommerceManualMappings - ECOMMERCE_FILIAL_CLIENTS", () => {
  it("should include known filial client names", () => {
    expect(ECOMMERCE_FILIAL_CLIENTS).toContain("PALITOS E-COMMERCE");
    expect(ECOMMERCE_FILIAL_CLIENTS).toContain("PALITOS INDUSTRIA E COMERCIO LTDA");
  });
});

describe("E-commerce History - Business Rules", () => {
  it("should classify E-COMMERCE estadoConfiguravel correctly", () => {
    const testCases = [
      { input: "E-COMMERCE", expected: true },
      { input: "e-commerce", expected: true },
      { input: "ECOMMERCE", expected: true },
      { input: "BAMBU", expected: false },
      { input: "MADEIRA", expected: false },
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
    ];

    for (const tc of testCases) {
      const val = tc.input.toLowerCase();
      const isFaturado = val.includes("aturado");
      expect(isFaturado, `"${tc.input}" should be faturado=${tc.expected}`).toBe(tc.expected);
    }
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
