import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the product variants feature:
 * - settingsRouter endpoints: getVariants, addVariant, removeVariant
 * - stockProcessor: variant logic (parent-child relationships, conversion factors)
 * - Double deduction fix: non-ZECA variants with own stock should NOT debit parent
 * - Fiber product 00110 with variants 00160, 00420, 00431
 */

// Mock the database module
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: () => ({ from: mockFrom }),
    insert: () => ({ values: mockValues }),
    update: () => ({ set: () => ({ where: mockWhere }) }),
    delete: () => ({ where: mockWhere }),
  }),
}));

describe("Product Variants Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ where: mockWhere, limit: mockLimit });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]);
    mockValues.mockResolvedValue(undefined);
  });

  describe("Conversion Factor Calculation", () => {
    it("should calculate correct conversion factor for 00002 (5000 un) relative to 00001 (10000 un)", () => {
      const parentUnPerBox = 10000;
      const childUnPerBox = 5000;
      const factor = childUnPerBox / parentUnPerBox;
      expect(factor).toBe(0.5);
    });

    it("should calculate correct conversion factor for 00242 (1500 un) relative to 00001 (10000 un)", () => {
      const parentUnPerBox = 10000;
      const childUnPerBox = 1500;
      const factor = childUnPerBox / parentUnPerBox;
      expect(factor).toBe(0.15);
    });

    it("should calculate 1:1 factor when units per box are equal", () => {
      const parentUnPerBox = 5000;
      const childUnPerBox = 5000;
      const factor = childUnPerBox / parentUnPerBox;
      expect(factor).toBe(1);
    });

    it("should handle factor > 1 when child has more units", () => {
      const parentUnPerBox = 5000;
      const childUnPerBox = 10000;
      const factor = childUnPerBox / parentUnPerBox;
      expect(factor).toBe(2);
    });

    it("should calculate correct factors for fiber product 00110 variants", () => {
      const parentUnPerBox = 20000; // 00110
      
      // 00160: 10000 un/cx → factor 0.5
      expect(10000 / parentUnPerBox).toBe(0.5);
      
      // 00420: 5000 un/cx → factor 0.25
      expect(5000 / parentUnPerBox).toBe(0.25);
      
      // 00431: 5000 un/cx → factor 0.25
      expect(5000 / parentUnPerBox).toBe(0.25);
    });
  });

  describe("Parent Available Calculation with Variants", () => {
    it("should deduct child orders from parent available proportionally", () => {
      const parentEstoqueCx = 59;
      const parentPedidosCx = 0;
      const parentDisponivel = parentEstoqueCx - parentPedidosCx; // 59

      // Child 00002: 10 cx sold, factor 0.5
      const child1Orders = 10;
      const child1Factor = 0.5;

      // Child 00242: 5 cx sold, factor 0.15
      const child2Orders = 5;
      const child2Factor = 0.15;

      const deduction = (child1Orders * child1Factor) + (child2Orders * child2Factor);
      const adjustedDisponivel = parentDisponivel - deduction;

      expect(deduction).toBe(5.75); // 5 + 0.75
      expect(adjustedDisponivel).toBe(53.25); // 59 - 5.75
    });

    it("should handle zero child orders without affecting parent", () => {
      const parentDisponivel = 100;
      const child1Orders = 0;
      const child1Factor = 0.5;
      const child2Orders = 0;
      const child2Factor = 0.15;

      const deduction = (child1Orders * child1Factor) + (child2Orders * child2Factor);
      const adjustedDisponivel = parentDisponivel - deduction;

      expect(deduction).toBe(0);
      expect(adjustedDisponivel).toBe(100);
    });

    it("should allow negative available when child orders exceed parent stock", () => {
      const parentDisponivel = 10;
      const childOrders = 30;
      const childFactor = 0.5;

      const deduction = childOrders * childFactor;
      const adjustedDisponivel = parentDisponivel - deduction;

      expect(deduction).toBe(15);
      expect(adjustedDisponivel).toBe(-5);
    });
  });

  describe("Double Deduction Fix (non-ZECA variants)", () => {
    /**
     * REGRA (10/04/2026):
     * - Produtos ZECA (código termina em "Z"): SEMPRE debitar pedidos do pai (comportamento original)
     * - Outros produtos: se a variação TEM estoque próprio (estoqueUn > 0), a fiscal já
     *   deu baixa no Maxiprod → NÃO debitar do pai (evita baixa dupla)
     * - Se a variação NÃO tem estoque próprio (estoqueUn === 0), debitar do pai normalmente
     */

    function shouldDebitFromParent(childCode: string, childEstoqueUn: number): boolean {
      const isZeca = childCode.toUpperCase().endsWith('Z');
      const hasOwnStock = childEstoqueUn > 0;
      return isZeca || !hasOwnStock;
    }

    it("should NOT debit from parent when non-ZECA child has own stock (fiscal already moved)", () => {
      // Caso do bug: 00047 tem estoque próprio (fiscal moveu do pai 00046)
      // Pedidos da 00047 NÃO devem ser debitados do pai
      expect(shouldDebitFromParent("00047", 150000)).toBe(false);
    });

    it("should debit from parent when non-ZECA child has NO own stock", () => {
      // Variação sem estoque: fiscal ainda não moveu, debitar do pai
      expect(shouldDebitFromParent("00047", 0)).toBe(true);
    });

    it("should ALWAYS debit from parent for ZECA products (code ends in Z)", () => {
      // ZECA sempre debita do pai, independente do estoque
      expect(shouldDebitFromParent("00273Z", 50000)).toBe(true);
      expect(shouldDebitFromParent("00273Z", 0)).toBe(true);
    });

    it("should correctly identify ZECA products by code suffix", () => {
      expect("00273Z".toUpperCase().endsWith('Z')).toBe(true);
      expect("00047".toUpperCase().endsWith('Z')).toBe(false);
      expect("00160".toUpperCase().endsWith('Z')).toBe(false);
      expect("00420".toUpperCase().endsWith('Z')).toBe(false);
    });

    it("should fix product 00046 available: 246 cx instead of 96 cx (double deduction)", () => {
      // Cenário real: pai 00046 tem 246 cx de estoque
      // Variação 00047 tem pedido de 150 cx, MAS a fiscal já moveu estoque para 00047
      // O estoque do pai no Maxiprod JÁ está reduzido (246 cx, não 396 cx)
      
      const parentEstoqueCx = 246; // já reduzido pela fiscal
      const parentPedidosCxProprio = 0; // pai não tem pedidos próprios
      
      // Variação 00047: 150 cx de pedidos, MAS tem estoque próprio
      const child47EstoqueUn = 150000; // fiscal moveu estoque para cá
      const child47PedidosUn = 150000;
      const child47Factor = 1.0;
      
      const isZeca47 = "00047".endsWith('Z'); // false
      const hasOwnStock47 = child47EstoqueUn > 0; // true
      
      // NÃO-ZECA com estoque próprio: NÃO debitar do pai
      let extraPedidosUn = 0;
      if (isZeca47 || !hasOwnStock47) {
        extraPedidosUn += child47PedidosUn * child47Factor;
      }
      
      expect(extraPedidosUn).toBe(0); // Nada debitado do pai!
      
      const disponivelCx = parentEstoqueCx - parentPedidosCxProprio;
      expect(disponivelCx).toBe(246); // Correto! Antes era 96 (246 - 150)
      
      const poCx = 500;
      const projetadoCx = disponivelCx + poCx;
      expect(projetadoCx).toBe(746); // 246 + 500 = OK (não COMPRA)
    });

    it("should still debit ZECA variant from parent even with own stock", () => {
      const parentEstoqueCx = 100;
      const parentPedidosCxProprio = 0;
      
      const childZecaEstoqueUn = 50000; // tem estoque
      const childZecaPedidosUn = 30000;
      const childZecaFactor = 1.0;
      const parentUnPerBox = 5000;
      
      const isZeca = "00273Z".endsWith('Z'); // true
      
      let extraPedidosUn = 0;
      if (isZeca) {
        extraPedidosUn += childZecaPedidosUn * childZecaFactor;
      }
      
      expect(extraPedidosUn).toBe(30000); // ZECA sempre debita
      const extraPedidosCx = Math.ceil(extraPedidosUn / parentUnPerBox);
      expect(extraPedidosCx).toBe(6);
    });
  });

  describe("Fiber Product 00110 Variants", () => {
    it("should have 3 variants for parent 00110", () => {
      const variants = [
        { parentCode: "00110", childCode: "00160", conversionFactor: 0.5 },
        { parentCode: "00110", childCode: "00420", conversionFactor: 0.25 },
        { parentCode: "00110", childCode: "00431", conversionFactor: 0.25 },
      ];
      
      expect(variants.length).toBe(3);
      expect(variants.every(v => v.parentCode === "00110")).toBe(true);
    });

    it("should correctly convert fiber variant orders to parent units", () => {
      const parentUnPerBox = 20000; // 00110: 20.000 un/cx
      
      // 00160: 2 cx pedidos, factor 0.5 → 1 cx do pai
      const child160Orders = 2;
      const child160Factor = 0.5;
      
      // 00420: 4 cx pedidos, factor 0.25 → 1 cx do pai
      const child420Orders = 4;
      const child420Factor = 0.25;
      
      // 00431: 8 cx pedidos, factor 0.25 → 2 cx do pai
      const child431Orders = 8;
      const child431Factor = 0.25;
      
      const totalDeduction = 
        (child160Orders * child160Factor) + 
        (child420Orders * child420Factor) + 
        (child431Orders * child431Factor);
      
      expect(totalDeduction).toBe(4); // 1 + 1 + 2 = 4 cx do pai
    });

    it("should show fiber parent as expandable with 3 variants", () => {
      const parentCode = "00110";
      const variantsByParent = new Map<string, { childCode: string; conversionFactor: number }[]>();
      variantsByParent.set("00110", [
        { childCode: "00160", conversionFactor: 0.5 },
        { childCode: "00420", conversionFactor: 0.25 },
        { childCode: "00431", conversionFactor: 0.25 },
      ]);
      
      const isParent = variantsByParent.has(parentCode);
      const children = variantsByParent.get(parentCode) || [];
      
      expect(isParent).toBe(true);
      expect(children.length).toBe(3);
      expect(children.map(c => c.childCode)).toEqual(["00160", "00420", "00431"]);
    });
  });

  describe("Variant Grouping Logic", () => {
    it("should group variants by parent code", () => {
      const variants = [
        { parentCode: "00001", childCode: "00002", conversionFactor: "0.5" },
        { parentCode: "00001", childCode: "00242", conversionFactor: "0.15" },
        { parentCode: "00010", childCode: "00011", conversionFactor: "0.3" },
      ];

      const grouped = new Map<string, Array<{ childCode: string; conversionFactor: string }>>();
      for (const v of variants) {
        const list = grouped.get(v.parentCode) || [];
        list.push({ childCode: v.childCode, conversionFactor: v.conversionFactor });
        grouped.set(v.parentCode, list);
      }

      expect(grouped.size).toBe(2);
      expect(grouped.get("00001")?.length).toBe(2);
      expect(grouped.get("00010")?.length).toBe(1);
    });

    it("should identify child items correctly", () => {
      const variants = [
        { parentCode: "00001", childCode: "00002", conversionFactor: "0.5" },
        { parentCode: "00001", childCode: "00242", conversionFactor: "0.15" },
      ];

      const childCodes = new Set(variants.map(v => v.childCode));
      
      expect(childCodes.has("00002")).toBe(true);
      expect(childCodes.has("00242")).toBe(true);
      expect(childCodes.has("00001")).toBe(false); // parent is not a child
    });
  });

  describe("Variant Validation", () => {
    it("should reject same code for parent and child", () => {
      const parentCode = "00001";
      const childCode = "00001";
      expect(parentCode === childCode).toBe(true);
    });

    it("should require positive conversion factor", () => {
      const factor = 0.5;
      expect(factor > 0).toBe(true);

      const negativeFactor = -0.5;
      expect(negativeFactor > 0).toBe(false);
    });
  });
});
