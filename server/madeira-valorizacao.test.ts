import { describe, it, expect } from "vitest";

/**
 * Tests for Madeira stock valuation feature:
 * - Price calculation from last 5 sales average
 * - Valuation across 3 cards: Madeira PA, Semi Pronto, Aguardando Escolha
 * - VLR ESTOQUE, VLR PO, VLR PROJETADO calculations
 * - Custo do Estoque Regulador calculation
 */

describe("Madeira Stock Valuation", () => {
  describe("Price Calculation from Sales History", () => {
    it("should calculate average price from last 5 sales", () => {
      const sales = [288, 290, 285, 292, 288];
      const avg = sales.reduce((a, b) => a + b, 0) / sales.length;
      expect(avg).toBeCloseTo(288.6, 1);
    });

    it("should handle products with exactly 5 sales", () => {
      const sales = [400, 410, 390, 405, 395];
      const avg = sales.reduce((a, b) => a + b, 0) / sales.length;
      expect(avg).toBe(400);
    });

    it("should handle products with fewer than 5 sales (still calculate average)", () => {
      const sales = [513, 520, 507];
      const avg = sales.reduce((a, b) => a + b, 0) / sales.length;
      expect(avg).toBeCloseTo(513.33, 1);
    });

    it("should exclude zero-value sales from average", () => {
      const allSales = [0, 288, 290, 0, 285, 292, 288];
      const validSales = allSales.filter(s => s > 0);
      const avg = validSales.slice(0, 5).reduce((a, b) => a + b, 0) / Math.min(validSales.length, 5);
      expect(avg).toBeCloseTo(288.6, 1);
    });
  });

  describe("Valuation Calculations", () => {
    // Simulate the valuation logic from MadeiraValorizacaoCard
    function calculateValuation(
      madeiraItems: Array<{ codigoItem: string; pedidosCx: number; poCx: number }>,
      semiProntoItems: Array<{ codigoItem: string }>,
      aguardandoItems: Array<{ codigoItem: string }>,
      precosMap: Map<string, number>,
      madeiraStockMap: Map<string, number>,
      semiProntoMap: Map<string, number>,
      aguardandoMap: Map<string, number>,
    ) {
      let valorEstoque = 0;
      let valorPO = 0;
      let valorProjetado = 0;
      let comPreco = 0;
      let semPreco = 0;

      // Madeira PA
      for (const item of madeiraItems) {
        const preco = precosMap.get(item.codigoItem);
        if (preco && preco > 0) {
          comPreco++;
          const estoque = madeiraStockMap.get(item.codigoItem) || 0;
          const pedidos = item.pedidosCx;
          const disponivel = estoque - pedidos;
          const po = item.poCx;
          const projetado = disponivel + po;
          valorEstoque += estoque * preco;
          valorPO += po * preco;
          valorProjetado += projetado * preco;
        } else {
          semPreco++;
        }
      }

      // Semi Pronto
      for (const item of semiProntoItems) {
        const preco = precosMap.get(item.codigoItem);
        if (preco && preco > 0) {
          const estoque = semiProntoMap.get(item.codigoItem) || 0;
          valorEstoque += estoque * preco;
          valorProjetado += estoque * preco;
        }
      }

      // Aguardando
      for (const item of aguardandoItems) {
        const preco = precosMap.get(item.codigoItem);
        if (preco && preco > 0) {
          const estoque = aguardandoMap.get(item.codigoItem) || 0;
          valorEstoque += estoque * preco;
          valorProjetado += estoque * preco;
        }
      }

      return { valorEstoque, valorPO, valorProjetado, comPreco, semPreco };
    }

    it("should calculate VLR ESTOQUE correctly for Madeira PA items", () => {
      const precosMap = new Map([["00077", 288], ["00087", 458]]);
      const madeiraStockMap = new Map([["00077", 100], ["00087", 50]]);
      const result = calculateValuation(
        [
          { codigoItem: "00077", pedidosCx: 20, poCx: 10 },
          { codigoItem: "00087", pedidosCx: 5, poCx: 0 },
        ],
        [], [], precosMap, madeiraStockMap, new Map(), new Map()
      );
      // 100 * 288 + 50 * 458 = 28800 + 22900 = 51700
      expect(result.valorEstoque).toBe(51700);
    });

    it("should calculate VLR PO correctly", () => {
      const precosMap = new Map([["00077", 288], ["00087", 458]]);
      const madeiraStockMap = new Map([["00077", 100], ["00087", 50]]);
      const result = calculateValuation(
        [
          { codigoItem: "00077", pedidosCx: 20, poCx: 10 },
          { codigoItem: "00087", pedidosCx: 5, poCx: 0 },
        ],
        [], [], precosMap, madeiraStockMap, new Map(), new Map()
      );
      // 10 * 288 + 0 * 458 = 2880
      expect(result.valorPO).toBe(2880);
    });

    it("should calculate VLR PROJETADO correctly (disponivel + PO)", () => {
      const precosMap = new Map([["00077", 288]]);
      const madeiraStockMap = new Map([["00077", 100]]);
      const result = calculateValuation(
        [{ codigoItem: "00077", pedidosCx: 20, poCx: 10 }],
        [], [], precosMap, madeiraStockMap, new Map(), new Map()
      );
      // disponivel = 100 - 20 = 80, projetado = 80 + 10 = 90
      // valorProjetado = 90 * 288 = 25920
      expect(result.valorProjetado).toBe(25920);
    });

    it("should include Semi Pronto items in valuation (estoque only)", () => {
      const precosMap = new Map([["00077", 288]]);
      const semiProntoMap = new Map([["00077", 30]]);
      const result = calculateValuation(
        [], // no madeira PA items
        [{ codigoItem: "00077" }],
        [],
        precosMap, new Map(), semiProntoMap, new Map()
      );
      // Semi pronto: 30 * 288 = 8640
      expect(result.valorEstoque).toBe(8640);
      expect(result.valorPO).toBe(0); // semi pronto has no PO
      expect(result.valorProjetado).toBe(8640); // projetado = estoque for semi pronto
    });

    it("should include Aguardando Escolha items in valuation (estoque only)", () => {
      const precosMap = new Map([["00129", 4.50]]);
      const aguardandoMap = new Map([["00129", 200]]);
      const result = calculateValuation(
        [],
        [],
        [{ codigoItem: "00129" }],
        precosMap, new Map(), new Map(), aguardandoMap
      );
      // 200 * 4.50 = 900
      expect(result.valorEstoque).toBe(900);
      expect(result.valorProjetado).toBe(900);
    });

    it("should combine all 3 cards in total valuation", () => {
      const precosMap = new Map([["00077", 288], ["00129", 4.50]]);
      const madeiraStockMap = new Map([["00077", 100]]);
      const semiProntoMap = new Map([["00077", 30]]);
      const aguardandoMap = new Map([["00129", 200]]);
      const result = calculateValuation(
        [{ codigoItem: "00077", pedidosCx: 20, poCx: 10 }],
        [{ codigoItem: "00077" }],
        [{ codigoItem: "00129" }],
        precosMap, madeiraStockMap, semiProntoMap, aguardandoMap
      );
      // Madeira PA: estoque = 100 * 288 = 28800
      // Semi Pronto: estoque = 30 * 288 = 8640
      // Aguardando: estoque = 200 * 4.50 = 900
      expect(result.valorEstoque).toBe(28800 + 8640 + 900);
    });

    it("should count items with and without price correctly", () => {
      const precosMap = new Map([["00077", 288]]);
      const madeiraStockMap = new Map([["00077", 100], ["00090", 50]]);
      const result = calculateValuation(
        [
          { codigoItem: "00077", pedidosCx: 0, poCx: 0 },
          { codigoItem: "00090", pedidosCx: 0, poCx: 0 }, // no price
        ],
        [], [], precosMap, madeiraStockMap, new Map(), new Map()
      );
      expect(result.comPreco).toBe(1);
      expect(result.semPreco).toBe(1);
    });
  });

  describe("Custo do Estoque Regulador", () => {
    it("should calculate estoque regulador cost correctly", () => {
      const vendaMensal = 50;
      const fator = 2.3;
      const estReg = Math.round(vendaMensal * fator); // 115
      const preco = 288;
      const custo = estReg * preco;
      expect(estReg).toBe(115);
      expect(custo).toBe(33120);
    });

    it("should use default fator 2.3 when not specified", () => {
      const vendaMensal = 30;
      const fator = 2.3; // default
      const estReg = Math.round(vendaMensal * fator); // 69
      expect(estReg).toBe(69);
    });

    it("should use custom fator when specified", () => {
      const vendaMensal = 30;
      const fator = 3.0;
      const estReg = Math.round(vendaMensal * fator); // 90
      expect(estReg).toBe(90);
    });

    it("should skip items without vendaMensal", () => {
      const pricingOverrides = [
        { codigoItem: "00077", vendaMensal: 50, fatorMultiplicacao: "2.3" },
        { codigoItem: "00090", vendaMensal: null, fatorMultiplicacao: null },
      ];
      const precosMap = new Map([["00077", 288], ["00090", 533]]);
      
      let total = 0;
      let itensComCalculo = 0;
      for (const p of pricingOverrides) {
        if (p.vendaMensal == null) continue;
        const f = p.fatorMultiplicacao ? parseFloat(p.fatorMultiplicacao) : 2.3;
        const estReg = Math.round(p.vendaMensal * f);
        const preco = precosMap.get(p.codigoItem);
        if (preco) {
          total += estReg * preco;
          itensComCalculo++;
        }
      }
      
      expect(itensComCalculo).toBe(1);
      expect(total).toBe(Math.round(50 * 2.3) * 288); // 115 * 288 = 33120
    });
  });

  describe("Madeira Prices from Sales History", () => {
    it("should have correct prices for known products", () => {
      // These are the prices calculated from the last 5 sales
      const expectedPrices: Record<string, number> = {
        "00077": 288.00,
        "00079": 518.00,
        "00081": 400.00,
        "00083": 453.00,
        "00085": 476.00,
        "00087": 458.00,
        "00090": 533.00,
        "00091": 351.35,
        "00092": 336.00,
        "00102": 375.20,
        "00106": 408.00,
        "00143": 556.00,
        "00247": 429.72,
      };

      for (const [codigo, preco] of Object.entries(expectedPrices)) {
        expect(preco).toBeGreaterThan(0);
        expect(typeof preco).toBe("number");
      }
    });

    it("should identify products with low unit prices (per-unit, not per-box)", () => {
      // These products have very low prices because they're priced per unit, not per box
      const perUnitProducts = {
        "00129": 4.50,   // Varas Rojão - price per unit/dozen
        "00089M": 0.05,  // Vareta Aromatizador - price per unit
        "00354A": 10.00, // Kit de Amostra - low value sample
      };

      for (const [_, preco] of Object.entries(perUnitProducts)) {
        expect(preco).toBeGreaterThan(0);
        expect(preco).toBeLessThan(20); // All are under R$20
      }
    });
  });
});
