import { describe, it, expect } from "vitest";
import {
  estadoToGrupo,
  isOutros,
  GRUPO_LABELS,
  GRUPO_LABELS_SHORT,
} from "../shared/grupoClassification";

/**
 * Testes para a lógica de baixa automática de industrializados.
 * 
 * A baixa automática depende de:
 * 1. Classificação correta de estadoConfiguravel como "industrializacao"
 * 2. Detecção de novos faturamentos (comparação de snapshots)
 * 3. Abatimento do estoque de madeira (fator 1:1)
 * 
 * Estes testes validam a classificação e as regras de negócio.
 */

describe("Industrialized Baixa - Classification Rules", () => {
  describe("estadoToGrupo identifies industrialized items", () => {
    it("MADEIRA → industrializacao", () => {
      expect(estadoToGrupo("MADEIRA")).toBe("industrializacao");
    });

    it("MADEIRA CONTABILIZADO → industrializacao", () => {
      expect(estadoToGrupo("MADEIRA CONTABILIZADO")).toBe("industrializacao");
    });

    it("case insensitive: madeira → industrializacao", () => {
      expect(estadoToGrupo("madeira")).toBe("industrializacao");
    });

    it("E-COMMERCE → ecommerce (NOT industrializacao)", () => {
      expect(estadoToGrupo("E-COMMERCE")).toBe("ecommerce");
      expect(estadoToGrupo("E-COMMERCE")).not.toBe("industrializacao");
    });

    it("BAMBU → importacao_revenda (NOT industrializacao)", () => {
      expect(estadoToGrupo("BAMBU")).not.toBe("industrializacao");
    });

    it("FIBRA → importacao_revenda (NOT industrializacao)", () => {
      expect(estadoToGrupo("FIBRA")).not.toBe("industrializacao");
    });
  });

  describe("isOutros excludes industrialized and ecommerce", () => {
    it("MADEIRA is not outros", () => {
      expect(isOutros("MADEIRA")).toBe(false);
    });

    it("MADEIRA CONTABILIZADO is not outros", () => {
      expect(isOutros("MADEIRA CONTABILIZADO")).toBe(false);
    });

    it("E-COMMERCE is not outros", () => {
      expect(isOutros("E-COMMERCE")).toBe(false);
    });

    it("CANCELADO is outros", () => {
      expect(isOutros("CANCELADO")).toBe(true);
    });
  });

  describe("GRUPO_LABELS includes ecommerce", () => {
    it("has ecommerce label", () => {
      expect(GRUPO_LABELS.ecommerce).toBe("E-commerce");
    });

    it("has industrializacao label", () => {
      expect(GRUPO_LABELS.industrializacao).toBe("Industrializados");
    });
  });

  describe("GRUPO_LABELS_SHORT includes ecommerce", () => {
    it("has ecommerce short label", () => {
      expect(GRUPO_LABELS_SHORT.ecommerce).toBe("E-commerce");
    });

    it("has industrializacao short label", () => {
      expect(GRUPO_LABELS_SHORT.industrializacao).toBe("Industr.");
    });
  });
});

describe("Industrialized Baixa - Business Rules", () => {
  it("deduction factor is 1:1 (quantity faturada = quantity deducted)", () => {
    // Simulating the deduction logic
    const estoqueAnterior = 100;
    const quantidadeFaturada = 10;
    const estoqueNovo = Math.max(0, estoqueAnterior - quantidadeFaturada);
    expect(estoqueNovo).toBe(90);
  });

  it("deduction never goes below zero", () => {
    const estoqueAnterior = 5;
    const quantidadeFaturada = 10;
    const estoqueNovo = Math.max(0, estoqueAnterior - quantidadeFaturada);
    expect(estoqueNovo).toBe(0);
  });

  it("zero quantity faturada does not change stock", () => {
    const estoqueAnterior = 100;
    const quantidadeFaturada = 0;
    const estoqueNovo = Math.max(0, estoqueAnterior - quantidadeFaturada);
    expect(estoqueNovo).toBe(100);
  });

  it("snapshot key uniquely identifies a billed item", () => {
    const item1 = { pedido: "921", codigoItem: "00156", quantidade: "4.00000" };
    const item2 = { pedido: "921", codigoItem: "00155", quantidade: "3.00000" };
    const item3 = { pedido: "921", codigoItem: "00156", quantidade: "4.00000" }; // duplicate of item1

    const key1 = `${item1.pedido}|${item1.codigoItem}|${parseFloat(item1.quantidade).toFixed(5)}`;
    const key2 = `${item2.pedido}|${item2.codigoItem}|${parseFloat(item2.quantidade).toFixed(5)}`;
    const key3 = `${item3.pedido}|${item3.codigoItem}|${parseFloat(item3.quantidade).toFixed(5)}`;

    expect(key1).not.toBe(key2); // Different items
    expect(key1).toBe(key3); // Same item = same key
  });

  it("only MADEIRA and MADEIRA CONTABILIZADO trigger deduction", () => {
    const triggerStates = ["MADEIRA", "MADEIRA CONTABILIZADO"];
    const nonTriggerStates = ["BAMBU", "FIBRA", "E-COMMERCE", "AMOSTRA", "BONIFICAÇÃO", "CANCELADO", null];

    for (const state of triggerStates) {
      expect(estadoToGrupo(state)).toBe("industrializacao");
    }

    for (const state of nonTriggerStates) {
      expect(estadoToGrupo(state)).not.toBe("industrializacao");
    }
  });
});

describe("Industrialized Baixa - Variação → Produto Mãe", () => {
  it("deve identificar variação e baixar do produto mãe", () => {
    // Given: codigoItem = '00541' (variação), parentCode = '00086', conversionFactor = 1.0
    // When: 100 cx faturadas de 00541
    // Then: deve abater 100 cx do estoque de 00086

    const childToParentMap = new Map<string, { parentCode: string; conversionFactor: number }>();
    childToParentMap.set("00541", { parentCode: "00086", conversionFactor: 1.0 });
    childToParentMap.set("00087", { parentCode: "00086", conversionFactor: 1.0 });

    const madeiraMap = new Map<string, { id: number; quantidade: string }>();
    madeiraMap.set("00086", { id: 1, quantidade: "766.00000" });
    // Note: 00541 does NOT exist in madeiraMap (variação não tem estoque próprio)

    const codigoItem = "00541";
    const quantidadeFaturada = 100;

    let madeiraItem = madeiraMap.get(codigoItem); // undefined
    let targetCode = codigoItem;
    let quantidadeAbater = quantidadeFaturada;

    if (!madeiraItem && childToParentMap.has(codigoItem)) {
      const variant = childToParentMap.get(codigoItem)!;
      targetCode = variant.parentCode;
      quantidadeAbater = quantidadeFaturada * variant.conversionFactor;
      madeiraItem = madeiraMap.get(targetCode);
    }

    expect(madeiraItem).toBeDefined();
    expect(targetCode).toBe("00086");
    expect(quantidadeAbater).toBe(100);

    const estoqueAnterior = parseFloat(madeiraItem!.quantidade);
    const estoqueNovo = Math.max(0, estoqueAnterior - quantidadeAbater);

    expect(estoqueAnterior).toBe(766);
    expect(estoqueNovo).toBe(666);
  });

  it("deve aplicar fator de conversão quando diferente de 1", () => {
    const childToParentMap = new Map<string, { parentCode: string; conversionFactor: number }>();
    childToParentMap.set("00999", { parentCode: "00100", conversionFactor: 0.5 });

    const madeiraMap = new Map<string, { id: number; quantidade: string }>();
    madeiraMap.set("00100", { id: 2, quantidade: "1000.00000" });

    const codigoItem = "00999";
    const quantidadeFaturada = 200;

    let madeiraItem = madeiraMap.get(codigoItem);
    let targetCode = codigoItem;
    let quantidadeAbater = quantidadeFaturada;

    if (!madeiraItem && childToParentMap.has(codigoItem)) {
      const variant = childToParentMap.get(codigoItem)!;
      targetCode = variant.parentCode;
      quantidadeAbater = quantidadeFaturada * variant.conversionFactor;
      madeiraItem = madeiraMap.get(targetCode);
    }

    expect(targetCode).toBe("00100");
    expect(quantidadeAbater).toBe(100); // 200 * 0.5 = 100
    
    const estoqueAnterior = parseFloat(madeiraItem!.quantidade);
    const estoqueNovo = Math.max(0, estoqueAnterior - quantidadeAbater);
    expect(estoqueNovo).toBe(900); // 1000 - 100 = 900
  });

  it("produto direto (não variação) deve baixar normalmente", () => {
    const childToParentMap = new Map<string, { parentCode: string; conversionFactor: number }>();

    const madeiraMap = new Map<string, { id: number; quantidade: string }>();
    madeiraMap.set("00195", { id: 3, quantidade: "28.00000" });

    const codigoItem = "00195";
    const quantidadeFaturada = 10;

    let madeiraItem = madeiraMap.get(codigoItem);
    let targetCode = codigoItem;
    let quantidadeAbater = quantidadeFaturada;

    if (!madeiraItem && childToParentMap.has(codigoItem)) {
      const variant = childToParentMap.get(codigoItem)!;
      targetCode = variant.parentCode;
      quantidadeAbater = quantidadeFaturada * variant.conversionFactor;
      madeiraItem = madeiraMap.get(targetCode);
    }

    expect(targetCode).toBe("00195");
    expect(quantidadeAbater).toBe(10);
    
    const estoqueAnterior = parseFloat(madeiraItem!.quantidade);
    const estoqueNovo = Math.max(0, estoqueAnterior - quantidadeAbater);
    expect(estoqueNovo).toBe(18); // 28 - 10 = 18
  });

  it("variação sem estoque no pai deve ser ignorada (madeiraItem undefined)", () => {
    const childToParentMap = new Map<string, { parentCode: string; conversionFactor: number }>();
    childToParentMap.set("00777", { parentCode: "00888", conversionFactor: 1.0 });

    const madeiraMap = new Map<string, { id: number; quantidade: string }>();

    const codigoItem = "00777";
    const quantidadeFaturada = 50;

    let madeiraItem = madeiraMap.get(codigoItem);
    let targetCode = codigoItem;
    let quantidadeAbater = quantidadeFaturada;

    if (!madeiraItem && childToParentMap.has(codigoItem)) {
      const variant = childToParentMap.get(codigoItem)!;
      targetCode = variant.parentCode;
      quantidadeAbater = quantidadeFaturada * variant.conversionFactor;
      madeiraItem = madeiraMap.get(targetCode);
    }

    expect(madeiraItem).toBeUndefined();
  });
});
