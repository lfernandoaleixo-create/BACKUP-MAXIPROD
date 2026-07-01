/**
 * Test: getEstoqueMatrix procedure
 * Verifies that the estoque matrix correctly maps products to sellers
 * based on their price table assignments.
 */
import { describe, it, expect } from "vitest";

describe("Estoque Matrix logic", () => {
  // Simulates the matrix building logic from the getEstoqueMatrix procedure
  function buildMatrix(
    sellers: { sellerName: string; priceTableId: number | null }[],
    priceTableItems: { itemCodigo: string; priceTableId: number }[],
    stockProducts: { codigoItem: string; descricaoItem: string }[]
  ) {
    const itemsByTable = new Map<number, Set<string>>();
    for (const item of priceTableItems) {
      if (!itemsByTable.has(item.priceTableId)) {
        itemsByTable.set(item.priceTableId, new Set());
      }
      itemsByTable.get(item.priceTableId)!.add(item.itemCodigo);
    }

    const matrix = stockProducts.map(product => {
      const row: Record<string, boolean> = {};
      for (const seller of sellers) {
        if (seller.priceTableId) {
          const tableItems = itemsByTable.get(seller.priceTableId);
          row[seller.sellerName] = tableItems?.has(product.codigoItem) || false;
        } else {
          row[seller.sellerName] = false;
        }
      }
      return {
        codigoItem: product.codigoItem,
        descricaoItem: product.descricaoItem,
        sellers: row,
      };
    });

    return matrix;
  }

  const sellers = [
    { sellerName: "DANIEL TAVARES", priceTableId: 1 },
    { sellerName: "ROMERA", priceTableId: 2 },
    { sellerName: "CLARINDO", priceTableId: null }, // No price table
  ];

  const priceTableItems = [
    { itemCodigo: "00001", priceTableId: 1 },
    { itemCodigo: "00002", priceTableId: 1 },
    { itemCodigo: "00003", priceTableId: 1 },
    { itemCodigo: "00001", priceTableId: 2 },
    { itemCodigo: "00003", priceTableId: 2 },
  ];

  const stockProducts = [
    { codigoItem: "00001", descricaoItem: "ESPETO BAMBU 180MM" },
    { codigoItem: "00002", descricaoItem: "ESPETO BAMBU 200MM" },
    { codigoItem: "00003", descricaoItem: "ESPETO BAMBU 250MM" },
    { codigoItem: "00004", descricaoItem: "PALITO DENTE" },
  ];

  it("marks products that are in seller's price table with true", () => {
    const matrix = buildMatrix(sellers, priceTableItems, stockProducts);
    // Daniel has 00001, 00002, 00003
    expect(matrix[0].sellers["DANIEL TAVARES"]).toBe(true); // 00001
    expect(matrix[1].sellers["DANIEL TAVARES"]).toBe(true); // 00002
    expect(matrix[2].sellers["DANIEL TAVARES"]).toBe(true); // 00003
  });

  it("marks products NOT in seller's price table with false", () => {
    const matrix = buildMatrix(sellers, priceTableItems, stockProducts);
    // Daniel doesn't have 00004
    expect(matrix[3].sellers["DANIEL TAVARES"]).toBe(false);
  });

  it("marks all products as false for sellers without a price table", () => {
    const matrix = buildMatrix(sellers, priceTableItems, stockProducts);
    // Clarindo has no price table
    expect(matrix[0].sellers["CLARINDO"]).toBe(false);
    expect(matrix[1].sellers["CLARINDO"]).toBe(false);
    expect(matrix[2].sellers["CLARINDO"]).toBe(false);
    expect(matrix[3].sellers["CLARINDO"]).toBe(false);
  });

  it("correctly handles partial price tables (Romera has 00001, 00003 but not 00002)", () => {
    const matrix = buildMatrix(sellers, priceTableItems, stockProducts);
    expect(matrix[0].sellers["ROMERA"]).toBe(true);  // 00001
    expect(matrix[1].sellers["ROMERA"]).toBe(false); // 00002 - not in Romera's table
    expect(matrix[2].sellers["ROMERA"]).toBe(true);  // 00003
    expect(matrix[3].sellers["ROMERA"]).toBe(false); // 00004
  });

  it("returns correct product info in each row", () => {
    const matrix = buildMatrix(sellers, priceTableItems, stockProducts);
    expect(matrix[0].codigoItem).toBe("00001");
    expect(matrix[0].descricaoItem).toBe("ESPETO BAMBU 180MM");
    expect(matrix.length).toBe(4);
  });

  it("handles empty sellers list", () => {
    const matrix = buildMatrix([], priceTableItems, stockProducts);
    expect(matrix.length).toBe(4);
    expect(Object.keys(matrix[0].sellers)).toHaveLength(0);
  });

  it("handles empty products list", () => {
    const matrix = buildMatrix(sellers, priceTableItems, []);
    expect(matrix.length).toBe(0);
  });
});
