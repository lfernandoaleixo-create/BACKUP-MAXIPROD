import { describe, it, expect } from "vitest";
import {
  MADEIRA_PC_TO_CX_MAPPINGS,
  MADEIRA_CX_DIRECT_PRODUCTS,
  convertMadeiraPcToCx,
  isMadeiraDirectCxProduct,
  isMadeiraPcVariant,
  isMadeiraEcommerceProduct,
  getAllMadeiraEcommerceProductCodes,
} from "./ecommerceMadeiraMappings";

describe("ecommerceMadeiraMappings", () => {
  describe("MADEIRA_PC_TO_CX_MAPPINGS", () => {
    it("should have 12 products configured", () => {
      expect(Object.keys(MADEIRA_PC_TO_CX_MAPPINGS)).toHaveLength(12);
    });

    it("should contain all expected product codes", () => {
      const expectedCodes = [
        "00487", "00488", "00489", "00490", "00491", "00492",
        "00493", "00494", "00495", "00482", "00483", "00501",
      ];
      for (const code of expectedCodes) {
        expect(MADEIRA_PC_TO_CX_MAPPINGS).toHaveProperty(code);
      }
    });

    it("all products should have unPerCxParent = 10000", () => {
      for (const [code, mapping] of Object.entries(MADEIRA_PC_TO_CX_MAPPINGS)) {
        expect(mapping.unPerCxParent, `Product ${code}`).toBe(10000);
      }
    });
  });

  describe("convertMadeiraPcToCx", () => {
    // Regular product (sem flow pack): 00487
    // 1000 PC × 100 un/PC = 100.000 / 10.000 = 10 cx
    it("should convert 00487 (regular, 100 un/pc): 1000 PC → 10 cx", () => {
      const result = convertMadeiraPcToCx("00487", 1000);
      expect(result).not.toBeNull();
      expect(result!.caixas).toBe(10);
    });

    // Flow Pack product: 00488
    // 1000 PC × (6 × 50 = 300) = 300.000 / 10.000 = 30 cx
    it("should convert 00488 (flow pack 6×50): 1000 PC → 30 cx", () => {
      const result = convertMadeiraPcToCx("00488", 1000);
      expect(result).not.toBeNull();
      expect(result!.caixas).toBe(30);
    });

    // Flow Pack product: 00489
    // 1000 PC × (6 × 200 = 1200) = 1.200.000 / 10.000 = 120 cx
    it("should convert 00489 (flow pack 6×200): 1000 PC → 120 cx", () => {
      const result = convertMadeiraPcToCx("00489", 1000);
      expect(result).not.toBeNull();
      expect(result!.caixas).toBe(120);
    });

    // Flow Pack product: 00490
    // 1000 PC × (6 × 50 = 300) = 300.000 / 10.000 = 30 cx
    it("should convert 00490 (flow pack 6×50): 1000 PC → 30 cx", () => {
      const result = convertMadeiraPcToCx("00490", 1000);
      expect(result).not.toBeNull();
      expect(result!.caixas).toBe(30);
    });

    // Flow Pack product: 00491
    // 1000 PC × (6 × 200 = 1200) = 1.200.000 / 10.000 = 120 cx
    it("should convert 00491 (flow pack 6×200): 1000 PC → 120 cx", () => {
      const result = convertMadeiraPcToCx("00491", 1000);
      expect(result).not.toBeNull();
      expect(result!.caixas).toBe(120);
    });

    // Flow Pack product: 00492
    it("should convert 00492 (flow pack 6×50): 1000 PC → 30 cx", () => {
      const result = convertMadeiraPcToCx("00492", 1000);
      expect(result).not.toBeNull();
      expect(result!.caixas).toBe(30);
    });

    // Flow Pack product: 00493
    it("should convert 00493 (flow pack 6×200): 1000 PC → 120 cx", () => {
      const result = convertMadeiraPcToCx("00493", 1000);
      expect(result).not.toBeNull();
      expect(result!.caixas).toBe(120);
    });

    // Flow Pack product: 00494
    it("should convert 00494 (flow pack 6×50): 1000 PC → 30 cx", () => {
      const result = convertMadeiraPcToCx("00494", 1000);
      expect(result).not.toBeNull();
      expect(result!.caixas).toBe(30);
    });

    // Flow Pack product: 00495
    it("should convert 00495 (flow pack 6×200): 1000 PC → 120 cx", () => {
      const result = convertMadeiraPcToCx("00495", 1000);
      expect(result).not.toBeNull();
      expect(result!.caixas).toBe(120);
    });

    // Regular product: 00482 (Algodão Doce 300 un)
    // 500 PC × 300 un/PC = 150.000 / 10.000 = 15 cx
    it("should convert 00482 (regular, 300 un/pc): 500 PC → 15 cx", () => {
      const result = convertMadeiraPcToCx("00482", 500);
      expect(result).not.toBeNull();
      expect(result!.caixas).toBe(15);
    });

    // Regular product: 00483 (Algodão Doce 100 un)
    // 500 PC × 100 un/PC = 50.000 / 10.000 = 5 cx
    it("should convert 00483 (regular, 100 un/pc): 500 PC → 5 cx", () => {
      const result = convertMadeiraPcToCx("00483", 500);
      expect(result).not.toBeNull();
      expect(result!.caixas).toBe(5);
    });

    // Regular product: 00501 (50 un)
    // 1000 PC × 50 un/PC = 50.000 / 10.000 = 5 cx
    it("should convert 00501 (regular, 50 un/pc): 1000 PC → 5 cx", () => {
      const result = convertMadeiraPcToCx("00501", 1000);
      expect(result).not.toBeNull();
      expect(result!.caixas).toBe(5);
    });

    it("should return null for unknown product code", () => {
      const result = convertMadeiraPcToCx("99999", 1000);
      expect(result).toBeNull();
    });
  });

  describe("helper functions", () => {
    it("isMadeiraPcVariant should return true for all 12 products", () => {
      const codes = ["00487", "00488", "00489", "00490", "00491", "00492",
        "00493", "00494", "00495", "00482", "00483", "00501"];
      for (const code of codes) {
        expect(isMadeiraPcVariant(code), `${code} should be PC variant`).toBe(true);
      }
    });

    it("isMadeiraEcommerceProduct should return true for all 12 products", () => {
      const codes = ["00487", "00488", "00489", "00490", "00491", "00492",
        "00493", "00494", "00495", "00482", "00483", "00501"];
      for (const code of codes) {
        expect(isMadeiraEcommerceProduct(code), `${code} should be e-commerce product`).toBe(true);
      }
    });

    it("isMadeiraEcommerceProduct should return false for importação products", () => {
      expect(isMadeiraEcommerceProduct("00036")).toBe(false);
      expect(isMadeiraEcommerceProduct("00470")).toBe(false);
    });

    it("getAllMadeiraEcommerceProductCodes should return 12 codes", () => {
      const codes = getAllMadeiraEcommerceProductCodes();
      expect(codes).toHaveLength(12);
    });

    it("isMadeiraDirectCxProduct should return false for all PC products", () => {
      expect(isMadeiraDirectCxProduct("00487")).toBe(false);
    });
  });
});
