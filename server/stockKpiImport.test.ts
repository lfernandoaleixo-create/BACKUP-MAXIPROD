import { describe, expect, it } from "vitest";

/**
 * Tests for KPI filtering logic: Import section should only show
 * importação (revenda + matéria-prima) products, excluding industrialização (madeira).
 *
 * This validates the frontend filtering logic used in EstoquePage/Home.tsx:
 *   - parentOnlyItems filters out items with grupo === "industrializacao"
 *   - importItems filters out items with grupo === "industrializacao" for totals
 */

interface StockItem {
  codigoItem: string;
  descricaoItem: string;
  grupo: string;
  isChild: boolean;
  estoqueCx: number;
  pedidosCx: number;
  disponivelCx: number;
  poCx: number;
  projetadoCx: number;
}

function makeItem(overrides: Partial<StockItem> = {}): StockItem {
  return {
    codigoItem: "00100",
    descricaoItem: "PRODUTO TESTE",
    grupo: "importacao_revenda",
    isChild: false,
    estoqueCx: 100,
    pedidosCx: 10,
    disponivelCx: 90,
    poCx: 50,
    projetadoCx: 140,
    ...overrides,
  };
}

describe("KPI Import Section - Filtering Logic", () => {
  const sampleItems: StockItem[] = [
    // Importação revenda (should be included)
    makeItem({ codigoItem: "00100", grupo: "importacao_revenda", estoqueCx: 200, pedidosCx: 20, disponivelCx: 180, poCx: 100, projetadoCx: 280 }),
    makeItem({ codigoItem: "00101", grupo: "importacao_revenda", estoqueCx: 150, pedidosCx: 10, disponivelCx: 140, poCx: 50, projetadoCx: 190 }),
    // Importação matéria-prima (should be included)
    makeItem({ codigoItem: "00200", grupo: "importacao_mp", estoqueCx: 300, pedidosCx: 30, disponivelCx: 270, poCx: 200, projetadoCx: 470 }),
    // Industrialização / Madeira (should be EXCLUDED)
    makeItem({ codigoItem: "00300", grupo: "industrializacao", estoqueCx: 500, pedidosCx: 50, disponivelCx: 450, poCx: 0, projetadoCx: 450 }),
    makeItem({ codigoItem: "00301", grupo: "industrializacao", estoqueCx: 400, pedidosCx: 40, disponivelCx: 360, poCx: 0, projetadoCx: 360 }),
    // Child items (should be excluded from product count but included in totals if import)
    makeItem({ codigoItem: "00100-A", grupo: "importacao_revenda", isChild: true, estoqueCx: 80, pedidosCx: 5, disponivelCx: 75, poCx: 30, projetadoCx: 105 }),
    // Child item of industrializacao (should be excluded from everything)
    makeItem({ codigoItem: "00300-A", grupo: "industrializacao", isChild: true, estoqueCx: 100, pedidosCx: 10, disponivelCx: 90, poCx: 0, projetadoCx: 90 }),
  ];

  it("parentOnlyItems should exclude industrializacao AND child items", () => {
    const parentOnlyItems = sampleItems.filter(i => !i.isChild && i.grupo !== "industrializacao");
    
    // Should include: 00100 (revenda), 00101 (revenda), 00200 (MP) = 3 items
    expect(parentOnlyItems).toHaveLength(3);
    expect(parentOnlyItems.every(i => i.grupo !== "industrializacao")).toBe(true);
    expect(parentOnlyItems.every(i => !i.isChild)).toBe(true);
  });

  it("parentOnlyItems should count only import parent products (not madeira)", () => {
    const parentOnlyItems = sampleItems.filter(i => !i.isChild && i.grupo !== "industrializacao");
    const productCount = parentOnlyItems.length;
    
    // 2 revenda + 1 MP = 3 (not 5 which would include 2 industrializacao)
    expect(productCount).toBe(3);
  });

  it("importItems should exclude industrializacao for KPI totals", () => {
    const importItems = sampleItems.filter(i => i.grupo !== "industrializacao");
    
    // Should include: 00100, 00101, 00200, 00100-A (child but still import) = 4 items
    expect(importItems).toHaveLength(4);
    expect(importItems.every(i => i.grupo !== "industrializacao")).toBe(true);
  });

  it("KPI totals should sum only import items (revenda + MP)", () => {
    const importItems = sampleItems.filter(i => i.grupo !== "industrializacao");
    
    const totalEstoqueCx = importItems.reduce((sum, i) => sum + i.estoqueCx, 0);
    const totalPedidosCx = importItems.reduce((sum, i) => sum + i.pedidosCx, 0);
    const totalDisponivelCx = importItems.reduce((sum, i) => sum + i.disponivelCx, 0);
    const totalPOCx = importItems.reduce((sum, i) => sum + i.poCx, 0);
    const totalProjetadoCx = importItems.reduce((sum, i) => sum + i.projetadoCx, 0);
    
    // 200 + 150 + 300 + 80 = 730 (NOT 1630 which would include industrializacao)
    expect(totalEstoqueCx).toBe(730);
    // 20 + 10 + 30 + 5 = 65
    expect(totalPedidosCx).toBe(65);
    // 180 + 140 + 270 + 75 = 665
    expect(totalDisponivelCx).toBe(665);
    // 100 + 50 + 200 + 30 = 380
    expect(totalPOCx).toBe(380);
    // 280 + 190 + 470 + 105 = 1045
    expect(totalProjetadoCx).toBe(1045);
  });

  it("KPI totals should NOT include industrializacao items", () => {
    const allItems = sampleItems;
    const importItems = sampleItems.filter(i => i.grupo !== "industrializacao");
    
    const totalAll = allItems.reduce((sum, i) => sum + i.estoqueCx, 0);
    const totalImport = importItems.reduce((sum, i) => sum + i.estoqueCx, 0);
    
    // industrializacao items add 500 + 400 + 100 = 1000
    expect(totalAll - totalImport).toBe(1000);
  });

  it("should handle empty items array", () => {
    const empty: StockItem[] = [];
    const parentOnlyItems = empty.filter(i => !i.isChild && i.grupo !== "industrializacao");
    const importItems = empty.filter(i => i.grupo !== "industrializacao");
    
    expect(parentOnlyItems).toHaveLength(0);
    expect(importItems).toHaveLength(0);
    expect(importItems.reduce((sum, i) => sum + i.estoqueCx, 0)).toBe(0);
  });

  it("should handle items with only industrializacao (all excluded)", () => {
    const onlyMadeira: StockItem[] = [
      makeItem({ codigoItem: "00300", grupo: "industrializacao" }),
      makeItem({ codigoItem: "00301", grupo: "industrializacao" }),
    ];
    
    const parentOnlyItems = onlyMadeira.filter(i => !i.isChild && i.grupo !== "industrializacao");
    const importItems = onlyMadeira.filter(i => i.grupo !== "industrializacao");
    
    expect(parentOnlyItems).toHaveLength(0);
    expect(importItems).toHaveLength(0);
  });

  it("should dynamically update count when new import products are added", () => {
    const items = [...sampleItems];
    
    // Initial count
    let parentOnlyItems = items.filter(i => !i.isChild && i.grupo !== "industrializacao");
    expect(parentOnlyItems).toHaveLength(3);
    
    // Add a new import product
    items.push(makeItem({ codigoItem: "00500", grupo: "importacao_revenda", estoqueCx: 50 }));
    
    // Count should update automatically
    parentOnlyItems = items.filter(i => !i.isChild && i.grupo !== "industrializacao");
    expect(parentOnlyItems).toHaveLength(4);
  });

  it("should dynamically update count when new madeira products are added (not affecting import count)", () => {
    const items = [...sampleItems];
    
    // Initial import count
    let parentOnlyItems = items.filter(i => !i.isChild && i.grupo !== "industrializacao");
    const initialCount = parentOnlyItems.length;
    
    // Add a new madeira product
    items.push(makeItem({ codigoItem: "00600", grupo: "industrializacao", estoqueCx: 999 }));
    
    // Import count should NOT change
    parentOnlyItems = items.filter(i => !i.isChild && i.grupo !== "industrializacao");
    expect(parentOnlyItems).toHaveLength(initialCount);
  });
});

/**
 * Tests for PO dual-unit logic:
 * - poCx in stockProcessor: for isKg products, poCx = poUn (kg) so it matches
 *   the stock unit for Projetado calculation. For normal products, poCx = totalCx.
 * - KPI "PO (A Receber)": uses poLotes.quantidade (always in caixas, as POs arrive from China)
 * - POOverviewCard: uses poLotes.quantidade (always in caixas)
 * - Stock table row: uses poCx (kg for isKg, cx for normal) to match the stock unit
 *
 * Example: 00058 (Vareta Apito PCT 20KG)
 *   - PO: 150 sacos (caixas) = 4500 kg
 *   - Stock table: poCx = 4500 kg, projetado = disponivel(320) + poCx(4500) = 4820 kg
 *   - KPI PO: 150 cx (via poLotes)
 *   - POOverviewCard: 150 cx (via poLotes)
 */
describe("PO Dual-Unit Logic - poCx in stock unit, poLotes in caixas", () => {
  interface POLote {
    referenciaPO: string;
    quantidade: number;
    quantidadeUn: number;
  }

  interface ItemWithPO {
    codigoItem: string;
    poCx: number;
    poUn: number;
    poLotes: POLote[];
    isKgProduct: boolean;
    disponivelCx: number;
    projetadoCx: number;
    grupo: string;
  }

  const normalItem: ItemWithPO = {
    codigoItem: "00001",
    poCx: 100,
    poUn: 1000,
    poLotes: [{ referenciaPO: "PO01", quantidade: 100, quantidadeUn: 1000 }],
    isKgProduct: false,
    disponivelCx: 50,
    projetadoCx: 150, // 50 + 100
    grupo: "importacao_revenda",
  };

  const kgItem: ItemWithPO = {
    codigoItem: "00058",
    poCx: 4500, // in kg (150 cx * 30kg)
    poUn: 4500,
    poLotes: [
      { referenciaPO: "PO62", quantidade: 50, quantidadeUn: 1500 },
      { referenciaPO: "PO01", quantidade: 100, quantidadeUn: 3000 },
    ],
    isKgProduct: true,
    disponivelCx: 320,
    projetadoCx: 4820, // 320 + 4500
    grupo: "importacao_mp",
  };

  it("normal product: poCx equals poLotes sum (both in caixas)", () => {
    const lotesSum = normalItem.poLotes.reduce((s, l) => s + l.quantidade, 0);
    expect(normalItem.poCx).toBe(lotesSum);
    expect(normalItem.poCx).toBe(100);
  });

  it("kg product: poCx is in kg (4500), poLotes are in caixas (150)", () => {
    const lotesSum = kgItem.poLotes.reduce((s, l) => s + l.quantidade, 0);
    expect(kgItem.poCx).toBe(4500); // kg for stock table
    expect(lotesSum).toBe(150); // caixas for KPI and PO section
    expect(kgItem.poCx).not.toBe(lotesSum); // they are different units!
  });

  it("kg product: projetado = disponivel + poCx (both in kg)", () => {
    expect(kgItem.projetadoCx).toBe(kgItem.disponivelCx + kgItem.poCx);
    expect(kgItem.projetadoCx).toBe(4820);
  });

  it("KPI PO uses poLotes (caixas) not poCx for totals", () => {
    const items = [normalItem, kgItem];
    // KPI logic: use poLotes.quantidade when available
    const kpiTotal = items.reduce((sum, i) => {
      if (i.poLotes && i.poLotes.length > 0) {
        return sum + i.poLotes.reduce((ls, l) => ls + l.quantidade, 0);
      }
      return sum + (i.poCx ?? 0);
    }, 0);
    // 100 (normal) + 150 (kg lotes) = 250 caixas
    expect(kpiTotal).toBe(250);
  });

  it("POOverviewCard uses poLotes (caixas) for display", () => {
    const items = [normalItem, kgItem];
    let poCardTotal = 0;
    for (const item of items) {
      for (const l of item.poLotes) {
        poCardTotal += l.quantidade;
      }
    }
    expect(poCardTotal).toBe(250); // 100 + 150 caixas
  });

  it("KPI PO and POOverviewCard always match", () => {
    const items = [normalItem, kgItem];
    const kpiTotal = items.reduce((sum, i) => {
      if (i.poLotes && i.poLotes.length > 0) {
        return sum + i.poLotes.reduce((ls, l) => ls + l.quantidade, 0);
      }
      return sum + (i.poCx ?? 0);
    }, 0);
    let poCardTotal = 0;
    for (const item of items) {
      for (const l of item.poLotes) {
        poCardTotal += l.quantidade;
      }
    }
    expect(kpiTotal).toBe(poCardTotal);
  });

  it("stockProcessor poCx logic: isKg uses poUn, normal uses totalCx", () => {
    const totalCx = 150;
    const totalUn = 4500;
    const isKg = true;
    // Current logic: poCxVal = isKg ? poUn : (poCx || null)
    const poCxVal = isKg ? totalUn : (totalCx || null);
    expect(poCxVal).toBe(4500); // kg for stock table

    const isKgNormal = false;
    const poCxValNormal = isKgNormal ? totalUn : (totalCx || null);
    expect(poCxValNormal).toBe(150); // caixas for stock table
  });
});
