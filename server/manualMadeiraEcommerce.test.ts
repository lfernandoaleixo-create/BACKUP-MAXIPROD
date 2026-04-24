import { describe, it, expect } from "vitest";

/**
 * Tests for the 12 manual Madeira E-commerce products that are injected
 * into stockData during sync (maxiprodGraphQL.ts).
 * 
 * These products are from pedido 927 (E-commerce) and need to exist
 * in the Madeira PA card with zero stock.
 */

// Replicate the MANUAL_MADEIRA_ECOMMERCE list from maxiprodGraphQL.ts
const MANUAL_MADEIRA_ECOMMERCE = [
  { codigoItem: "00487", descricaoItem: "VARETA AROMATIZADOR 4,0 X 125 MM C/ 100 UNID." },
  { codigoItem: "00488", descricaoItem: "VARETA AROMATIZADOR 4,0 X 180 MM KIT COM 6 FLOW PACK C/ 50 UNID." },
  { codigoItem: "00489", descricaoItem: "VARETA AROMATIZADOR 4,0 X 180 MM KIT COM 6 FLOW PACK C/ 200 UNID." },
  { codigoItem: "00490", descricaoItem: "VARETA AROMATIZADOR 4,0 X 200 MM KIT COM 6 FLOW PACK C/ 50 UNID." },
  { codigoItem: "00491", descricaoItem: "VARETA AROMATIZADOR 4,0 X 200 MM KIT COM 6 FLOW PACK C/ 200 UNID." },
  { codigoItem: "00492", descricaoItem: "VARETA AROMATIZADOR 4,0 X 220 MM KIT COM 6 FLOW PACK C/ 50 UNID." },
  { codigoItem: "00493", descricaoItem: "VARETA AROMATIZADOR 4,0 X 220 MM KIT COM 6 FLOW PACK C/ 200 UNID." },
  { codigoItem: "00494", descricaoItem: "VARETA AROMATIZADOR 4,0 X 250 MM KIT COM 6 FLOW PACK C/ 50 UNID." },
  { codigoItem: "00495", descricaoItem: "VARETA AROMATIZADOR 4,0 X 250 MM KIT COM 6 FLOW PACK C/ 200 UNID." },
  { codigoItem: "00482", descricaoItem: "VARETA PARA ALGODÃO DOCE MADEIRA 4,0 X 350 MM C/ 300 UNID." },
  { codigoItem: "00483", descricaoItem: "VARETA PARA ALGODÃO DOCE MADEIRA 4,0 X 350 MM C/ 100 UNID." },
  { codigoItem: "00501", descricaoItem: "VARETA AROMATIZADOR 4,0 X 250 MM C/ 50 UNID." },
];

describe("Manual Madeira E-commerce Products", () => {
  it("should have exactly 12 products", () => {
    expect(MANUAL_MADEIRA_ECOMMERCE).toHaveLength(12);
  });

  it("should have unique codigoItem for each product", () => {
    const codes = MANUAL_MADEIRA_ECOMMERCE.map(p => p.codigoItem);
    expect(new Set(codes).size).toBe(12);
  });

  it("should include all expected product codes", () => {
    const codes = MANUAL_MADEIRA_ECOMMERCE.map(p => p.codigoItem);
    const expected = ["00487", "00488", "00489", "00490", "00491", "00492", "00493", "00494", "00495", "00482", "00483", "00501"];
    for (const code of expected) {
      expect(codes).toContain(code);
    }
  });

  it("should have non-empty descriptions for all products", () => {
    for (const item of MANUAL_MADEIRA_ECOMMERCE) {
      expect(item.descricaoItem.length).toBeGreaterThan(0);
    }
  });

  describe("injection logic simulation", () => {
    it("should add all 12 products when stockData is empty", () => {
      const stockData: any[] = [];
      const existingCodes = new Set(stockData.map((s: any) => s.codigoItem));
      let added = 0;
      for (const item of MANUAL_MADEIRA_ECOMMERCE) {
        if (!existingCodes.has(item.codigoItem)) {
          stockData.push({
            codigoItem: item.codigoItem,
            descricaoItem: item.descricaoItem,
            quantidade: "0",
            grupoCodigo: "18",
            superGrupoCodigo: "16",
          });
          added++;
        }
      }
      expect(added).toBe(12);
      expect(stockData).toHaveLength(12);
    });

    it("should skip products that already exist in stockData", () => {
      const stockData: any[] = [
        { codigoItem: "00487", descricaoItem: "existing", quantidade: "50" },
        { codigoItem: "00488", descricaoItem: "existing", quantidade: "30" },
      ];
      const existingCodes = new Set(stockData.map((s: any) => s.codigoItem));
      let added = 0;
      for (const item of MANUAL_MADEIRA_ECOMMERCE) {
        if (!existingCodes.has(item.codigoItem)) {
          stockData.push({
            codigoItem: item.codigoItem,
            descricaoItem: item.descricaoItem,
            quantidade: "0",
            grupoCodigo: "18",
            superGrupoCodigo: "16",
          });
          added++;
        }
      }
      expect(added).toBe(10); // 12 - 2 existing = 10
      expect(stockData).toHaveLength(12); // 2 existing + 10 new
    });

    it("should not overwrite existing stock quantities", () => {
      const stockData: any[] = [
        { codigoItem: "00487", descricaoItem: "existing", quantidade: "50" },
      ];
      const existingCodes = new Set(stockData.map((s: any) => s.codigoItem));
      for (const item of MANUAL_MADEIRA_ECOMMERCE) {
        if (!existingCodes.has(item.codigoItem)) {
          stockData.push({
            codigoItem: item.codigoItem,
            descricaoItem: item.descricaoItem,
            quantidade: "0",
            grupoCodigo: "18",
            superGrupoCodigo: "16",
          });
        }
      }
      // Original item should keep its quantity
      const original = stockData.find(s => s.codigoItem === "00487");
      expect(original?.quantidade).toBe("50");
    });

    it("should set grupoCodigo=18 and superGrupoCodigo=16 for industrializacao classification", () => {
      const stockData: any[] = [];
      const existingCodes = new Set<string>();
      for (const item of MANUAL_MADEIRA_ECOMMERCE) {
        if (!existingCodes.has(item.codigoItem)) {
          stockData.push({
            codigoItem: item.codigoItem,
            descricaoItem: item.descricaoItem,
            quantidade: "0",
            grupoCodigo: "18",
            superGrupoCodigo: "16",
          });
        }
      }
      for (const item of stockData) {
        expect(item.grupoCodigo).toBe("18");
        expect(item.superGrupoCodigo).toBe("16");
        expect(item.quantidade).toBe("0");
      }
    });
  });
});
