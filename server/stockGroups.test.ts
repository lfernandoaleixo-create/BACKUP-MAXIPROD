/**
 * Tests for stock group/subgroup mapping logic
 * Validates the hierarchical classification: Industrialização, Importação MP, Importação Revenda
 */
import { describe, it, expect } from "vitest";

// Replicate the group matching logic from Home.tsx (frontend-only logic)
// This tests the mapping rules that classify items into groups

interface MockStockItem {
  codigoItem: string;
  descricaoItem: string;
  superGrupoCodigo: string;
  grupoCodigo: string;
  isKgProduct: boolean;
  unidadeMedida: string;
  estoqueCx: number | null;
  estoqueUn: number;
  unidadesPorCaixa: number | null;
}

// Group matching functions (mirroring Home.tsx GRUPOS config)
const isIndustrializacao = (item: MockStockItem) => item.superGrupoCodigo === "05";
const isImportacaoMP = (item: MockStockItem) => item.superGrupoCodigo === "16" && ["18", "19"].includes(item.grupoCodigo);
const isImportacaoRevenda = (item: MockStockItem) => item.superGrupoCodigo === "12";
const isEmbalagem = (item: MockStockItem) => item.superGrupoCodigo === "16" && item.grupoCodigo === "24";

// Subgroup matching
const isMadeira = (item: MockStockItem) => item.superGrupoCodigo === "05" && ["06", "07", "08"].includes(item.grupoCodigo);
const isBambu = (item: MockStockItem) => item.superGrupoCodigo === "12" && item.grupoCodigo === "20";
const isFibra = (item: MockStockItem) => item.superGrupoCodigo === "12" && item.grupoCodigo === "21";
const isMadeiraImportada = (item: MockStockItem) => item.superGrupoCodigo === "16" && ["18", "19"].includes(item.grupoCodigo);

// Variação matching (within Madeira subgroup)
const isVaretas = (item: MockStockItem) => item.grupoCodigo === "06";
const isEspetos = (item: MockStockItem) => item.grupoCodigo === "07";
const isPalitos = (item: MockStockItem) => item.grupoCodigo === "08";

// Unit product detection (mirroring Home.tsx isUnitProduct)
const isUnitProduct = (item: MockStockItem) => {
  if (item.isKgProduct) return true;
  if ((item.estoqueCx === 0 || item.estoqueCx === null) && item.estoqueUn > 0 && (!item.unidadesPorCaixa || item.unidadesPorCaixa > 100000)) return true;
  return false;
};

// Test data
const mockItems: MockStockItem[] = [
  // Industrialização - Varetas (SG:05 G:06)
  { codigoItem: "00062", descricaoItem: "VARETA MULTI-USO BAMBU 3,8 X 200 MM", superGrupoCodigo: "05", grupoCodigo: "06", isKgProduct: false, unidadeMedida: "cx", estoqueCx: 1, estoqueUn: 5000, unidadesPorCaixa: 5000 },
  // Industrialização - Espetos (SG:05 G:07)
  { codigoItem: "00012", descricaoItem: "ESPETO DE BAMBU 4,0 X 280 MM", superGrupoCodigo: "05", grupoCodigo: "07", isKgProduct: false, unidadeMedida: "cx", estoqueCx: 6, estoqueUn: 30000, unidadesPorCaixa: 5000 },
  // Industrialização - Palitos (SG:05 G:08)
  { codigoItem: "00017", descricaoItem: "PALITO MANICURE DUAS PONTAS BAMBU", superGrupoCodigo: "05", grupoCodigo: "08", isKgProduct: false, unidadeMedida: "cx", estoqueCx: 40, estoqueUn: 200000, unidadesPorCaixa: 5000 },
  // Importação MP - Madeira Serrada (SG:16 G:18)
  { codigoItem: "00180", descricaoItem: "MADEIRA SERRADA SECA 22X50X1900", superGrupoCodigo: "16", grupoCodigo: "18", isKgProduct: false, unidadeMedida: "m3", estoqueCx: 0, estoqueUn: 6.759, unidadesPorCaixa: 2090000 },
  // Importação MP - Madeira Pinus (SG:16 G:19)
  { codigoItem: "00340", descricaoItem: "MADEIRA DE PINUS SERRADA", superGrupoCodigo: "16", grupoCodigo: "19", isKgProduct: false, unidadeMedida: "m3", estoqueCx: 0, estoqueUn: 10.5, unidadesPorCaixa: 3000000 },
  // Importação Revenda - Bambu (SG:12 G:20)
  { codigoItem: "00100", descricaoItem: "ESPETO DE BAMBU 3,0 X 250 MM", superGrupoCodigo: "12", grupoCodigo: "20", isKgProduct: false, unidadeMedida: "cx", estoqueCx: 500, estoqueUn: 2500000, unidadesPorCaixa: 5000 },
  // Importação Revenda - Fibra (SG:12 G:21)
  { codigoItem: "00350", descricaoItem: "VARETA DE FIBRA AROMATIZADOR", superGrupoCodigo: "12", grupoCodigo: "21", isKgProduct: false, unidadeMedida: "cx", estoqueCx: 10, estoqueUn: 50000, unidadesPorCaixa: 5000 },
  // Embalagem (SG:16 G:24) - should be excluded
  { codigoItem: "00250", descricaoItem: "CAIXA DE PAPELÃO", superGrupoCodigo: "16", grupoCodigo: "24", isKgProduct: false, unidadeMedida: "un", estoqueCx: 0, estoqueUn: 100, unidadesPorCaixa: null },
];

describe("Stock Group Classification", () => {
  describe("Grupo 1 - Industrialização", () => {
    it("should match items with superGrupoCodigo 05", () => {
      const industrializacao = mockItems.filter(isIndustrializacao);
      expect(industrializacao).toHaveLength(3);
      expect(industrializacao.map(i => i.codigoItem)).toEqual(["00062", "00012", "00017"]);
    });

    it("should classify Varetas as grupoCodigo 06", () => {
      const varetas = mockItems.filter(i => isIndustrializacao(i) && isVaretas(i));
      expect(varetas).toHaveLength(1);
      expect(varetas[0].descricaoItem).toContain("VARETA");
    });

    it("should classify Espetos as grupoCodigo 07", () => {
      const espetos = mockItems.filter(i => isIndustrializacao(i) && isEspetos(i));
      expect(espetos).toHaveLength(1);
      expect(espetos[0].descricaoItem).toContain("ESPETO");
    });

    it("should classify Palitos as grupoCodigo 08", () => {
      const palitos = mockItems.filter(i => isIndustrializacao(i) && isPalitos(i));
      expect(palitos).toHaveLength(1);
      expect(palitos[0].descricaoItem).toContain("PALITO");
    });

    it("Madeira subgroup should match all 3 variações", () => {
      const madeira = mockItems.filter(i => isIndustrializacao(i) && isMadeira(i));
      expect(madeira).toHaveLength(3);
    });
  });

  describe("Grupo 2 - Importação de Matéria-Prima", () => {
    it("should match items with SG:16 G:18 or G:19", () => {
      const importacaoMP = mockItems.filter(isImportacaoMP);
      expect(importacaoMP).toHaveLength(2);
      expect(importacaoMP.every(i => i.descricaoItem.includes("MADEIRA"))).toBe(true);
    });

    it("should NOT include embalagem items (SG:16 G:24)", () => {
      const embalagem = mockItems.filter(isEmbalagem);
      expect(embalagem).toHaveLength(1);
      const importacaoMP = mockItems.filter(isImportacaoMP);
      expect(importacaoMP.some(i => i.codigoItem === "00250")).toBe(false);
    });

    it("Madeira Importada subgroup should match all MP items", () => {
      const madeiraImportada = mockItems.filter(isMadeiraImportada);
      expect(madeiraImportada).toHaveLength(2);
    });
  });

  describe("Grupo 3 - Importação de Produtos Prontos (Revenda)", () => {
    it("should match items with superGrupoCodigo 12", () => {
      const revenda = mockItems.filter(isImportacaoRevenda);
      expect(revenda).toHaveLength(2);
    });

    it("should classify Bambu as grupoCodigo 20", () => {
      const bambu = mockItems.filter(i => isImportacaoRevenda(i) && isBambu(i));
      expect(bambu).toHaveLength(1);
      expect(bambu[0].codigoItem).toBe("00100");
    });

    it("should classify Fibra as grupoCodigo 21", () => {
      const fibra = mockItems.filter(i => isImportacaoRevenda(i) && isFibra(i));
      expect(fibra).toHaveLength(1);
      expect(fibra[0].descricaoItem).toContain("FIBRA");
    });
  });

  describe("Exclusion rules", () => {
    it("should exclude embalagem items (SG:16 G:24)", () => {
      const allGroupItems = mockItems.filter(i => 
        isIndustrializacao(i) || isImportacaoMP(i) || isImportacaoRevenda(i)
      );
      expect(allGroupItems.some(i => i.codigoItem === "00250")).toBe(false);
    });

    it("embalagem should not match any of the 3 groups", () => {
      const embalagem = mockItems.find(i => i.codigoItem === "00250")!;
      expect(isIndustrializacao(embalagem)).toBe(false);
      expect(isImportacaoMP(embalagem)).toBe(false);
      expect(isImportacaoRevenda(embalagem)).toBe(false);
    });
  });

  describe("No group overlap", () => {
    it("each item should belong to at most one group", () => {
      for (const item of mockItems) {
        const groups = [
          isIndustrializacao(item),
          isImportacaoMP(item),
          isImportacaoRevenda(item),
        ].filter(Boolean);
        expect(groups.length).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe("Unit Product Detection (m3/kg)", () => {
  it("should detect m3 products as unit products", () => {
    const madeira = mockItems.find(i => i.codigoItem === "00180")!;
    expect(isUnitProduct(madeira)).toBe(true);
  });

  it("should detect kg products as unit products", () => {
    const kgItem: MockStockItem = {
      codigoItem: "99999", descricaoItem: "TEST KG PRODUCT",
      superGrupoCodigo: "05", grupoCodigo: "06",
      isKgProduct: true, unidadeMedida: "kg",
      estoqueCx: null, estoqueUn: 100, unidadesPorCaixa: null,
    };
    expect(isUnitProduct(kgItem)).toBe(true);
  });

  it("should NOT detect box products as unit products", () => {
    const boxItem = mockItems.find(i => i.codigoItem === "00100")!;
    expect(isUnitProduct(boxItem)).toBe(false);
  });

  it("should detect products with unrealistic unidadesPorCaixa as unit products", () => {
    const pinus = mockItems.find(i => i.codigoItem === "00340")!;
    expect(isUnitProduct(pinus)).toBe(true);
  });

  it("should determine correct metric unit for groups", () => {
    // Industrialização has box items -> should use 'cx'
    const indItems = mockItems.filter(isIndustrializacao);
    const indBoxItems = indItems.filter(i => !isUnitProduct(i));
    expect(indBoxItems.length).toBeGreaterThan(0);

    // Importação MP has only unit items -> should use m3
    const mpItems = mockItems.filter(isImportacaoMP);
    const mpBoxItems = mpItems.filter(i => !isUnitProduct(i));
    const mpUnitItems = mpItems.filter(i => isUnitProduct(i));
    expect(mpBoxItems.length).toBe(0);
    expect(mpUnitItems.length).toBeGreaterThan(0);
    expect(mpUnitItems[0].unidadeMedida).toBe("m3");

    // Importação Revenda has box items -> should use 'cx'
    const revItems = mockItems.filter(isImportacaoRevenda);
    const revBoxItems = revItems.filter(i => !isUnitProduct(i));
    expect(revBoxItems.length).toBeGreaterThan(0);
  });
});
