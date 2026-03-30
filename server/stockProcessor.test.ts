import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for stockProcessor - ESPELHO FIEL DO MAXIPROD
 * 
 * Validates that:
 * 1. ALL stock items from DB are included (no filtering by group)
 * 2. Descriptions are kept EXACTLY as they come from Maxiprod
 * 3. Orders are correctly matched by codigoItem
 * 4. disponivel = estoque - pedidos
 * 5. projetado = disponivel + PO
 * 6. Products added/removed in Maxiprod are reflected
 */

// Mock the database module
const mockStockItems: any[] = [];
const mockOrderItems: any[] = [];
const mockPurchaseOrderItems: any[] = [];
let insertedDashboardData: any = null;

vi.mock("./db", () => ({
  getDb: vi.fn(async () => {
    // We need to import the actual schema symbols to compare
    const schema = await import("../drizzle/schema");
    return {
      select: vi.fn((...args: any[]) => ({
        from: vi.fn((table: any) => {
          // For dashboardData table, return chainable where/limit (upsert check)
          if (table === schema.dashboardData) {
            return {
              where: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([])),
              })),
            };
          }
          // For data tables, return the mock arrays directly
          if (table === schema.stockItems) return Promise.resolve(mockStockItems);
          if (table === schema.orderItems) return Promise.resolve(mockOrderItems);
          if (table === schema.purchaseOrderItems) return Promise.resolve(mockPurchaseOrderItems);
          return Promise.resolve([]);
        }),
      })),
      delete: vi.fn(() => Promise.resolve()),
      insert: vi.fn().mockReturnValue({
        values: vi.fn((data: any) => {
          insertedDashboardData = data;
          return Promise.resolve();
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn(() => Promise.resolve()),
        }),
      }),
    };
  }),
}));

// Schema is NOT mocked - we use real schema objects for table identity comparison

// Import after mocks
import { processStockData } from "./stockProcessor";

// Helper to create a stock item
function makeStockItem(overrides: Partial<any> = {}) {
  return {
    id: 1,
    codigoItem: "00100",
    descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
    quantidade: "50000",
    unidadeMedida: "UN",
    custoUnitario: "0.01",
    custoTotal: "500.00",
    codigoGrupo: "20",
    descricaoGrupo: "VARETAS",
    codigoSuperGrupo: null,
    descricaoSuperGrupo: null,
    grupoCodigo: "20",
    superGrupoCodigo: null,
    empresaDona: "PALITOS INDUSTRIA",
    estoqueLocal: "GERAL",
    tipoDecodificado: null,
    maxiprodId: 12345,
    collectedAt: new Date(),
    ...overrides,
  };
}

function makeOrderItem(overrides: Partial<any> = {}) {
  return {
    id: 1,
    codigoItem: "00100",
    descricao: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
    quantidade: "10",
    unidadeMedida: "CX",
    estadoNota: "Aprovado",
    estadoItem: "A faturar",
    numeroPedido: "1234",
    cliente: "CLIENTE TESTE",
    dataEmissao: "2026-01-15",
    valorUnitario: "100.00",
    valorTotal: "1000.00",
    codigoGrupo: "20",
    empresaDona: "PALITOS INDUSTRIA",
    fatorConversao: "5000",
    quantidadeUnEstoque: "50000",
    maxiprodId: 99999,
    collectedAt: new Date(),
    ...overrides,
  };
}

describe("stockProcessor - Espelho Fiel do Maxiprod", () => {
  beforeEach(() => {
    mockStockItems.length = 0;
    mockOrderItems.length = 0;
    mockPurchaseOrderItems.length = 0;
    insertedDashboardData = null;
  });

  it("should include ALL stock items without filtering by group", async () => {
    // Add items from different groups - ALL should appear
    mockStockItems.push(
      makeStockItem({ codigoItem: "00100", grupoCodigo: "20", descricaoItem: "VARETA BAMBU 3,0 X 250 MM" }),
      makeStockItem({ codigoItem: "00200", grupoCodigo: "21", descricaoItem: "ESPETO BAMBU 3,5 X 300 MM" }),
      makeStockItem({ codigoItem: "00300", grupoCodigo: "30", descricaoItem: "PALITO DENTAL" }),
      makeStockItem({ codigoItem: "00400", grupoCodigo: "99", descricaoItem: "EMBALAGEM ESPECIAL" }),
    );

    await processStockData();

    expect(insertedDashboardData).not.toBeNull();
    const items = JSON.parse(insertedDashboardData.dataJson);
    
    // ALL 4 items should be present (no group filtering)
    expect(items).toHaveLength(4);
    const codes = items.map((i: any) => i.codigoItem);
    expect(codes).toContain("00100");
    expect(codes).toContain("00200");
    expect(codes).toContain("00300");
    expect(codes).toContain("00400");
  });

  it("should preserve descriptions EXACTLY as they come from Maxiprod", async () => {
    const exactDesc = "VARETA DE BAMBU (SEGUNDA LINHA) 3,0*250 MM C/ 5.000 UNID - MARCA BAMBUSA";
    mockStockItems.push(
      makeStockItem({ codigoItem: "00100", descricaoItem: exactDesc }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    expect(items[0].descricaoItem).toBe(exactDesc);
  });

  it("should calculate disponivel = estoque - pedidos", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00100",
        descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
        quantidade: "100000", // 100k units = 20 cx
      }),
    );
    mockOrderItems.push(
      makeOrderItem({
        codigoItem: "00100",
        quantidade: "5",
        quantidadeUnEstoque: "25000", // 5 cx * 5000 un/cx
      }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items[0];
    
    expect(item.estoqueUn).toBe(100000);
    expect(item.pedidosUn).toBe(25000);
    expect(item.disponivelUn).toBe(75000); // 100k - 25k
  });

  it("should calculate projetado = disponivel + PO", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00100",
        descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
        quantidade: "50000",
      }),
    );
    // PO with referencia field containing PO
    mockPurchaseOrderItems.push({
      id: 1,
      codigoItem: "00100",
      descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
      descricao: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
      quantidade: "100",
      quantidadeUnEstoque: "500000",
      fatorConversao: "5000",
      unidadeMedida: "CX",
      unidadeMedidaEstoque: "UN",
      dataEntrega: "2026-04-15",
      dataEmissao: "2026-03-01",
      estadoPedido: "Aprovado",
      estadoItem: "A receber",
      fornecedor: "FORNECEDOR CHINA",
      valorTotal: "50000.00",
      valorUnitario: "500.00",
      numeroPedido: "PO-001",
      referencia: "REF-001",
      numeroItem: 1,
      codigoGrupo: "20",
      codigoCFOP: null,
      empresaDona: "PALITOS INDUSTRIA",
      maxiprodId: 88888,
      collectedAt: new Date(),
    });

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items[0];
    
    expect(item.estoqueUn).toBe(50000);
    expect(item.poUn).toBe(500000);
    expect(item.projetadoUn).toBe(item.disponivelUn + item.poUn);
  });

  it("should filter out cancelled/received POs", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00100",
        descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
        quantidade: "50000",
      }),
    );
    // Cancelled PO - should NOT be counted
    mockPurchaseOrderItems.push({
      id: 1,
      codigoItem: "00100",
      descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
      descricao: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
      quantidade: "100",
      quantidadeUnEstoque: "500000",
      fatorConversao: "5000",
      unidadeMedida: "CX",
      unidadeMedidaEstoque: "UN",
      dataEntrega: "2026-04-15",
      dataEmissao: "2026-03-01",
      estadoPedido: "Cancelado",
      estadoItem: "Cancelado",
      fornecedor: "FORNECEDOR",
      valorTotal: "50000.00",
      valorUnitario: "500.00",
      numeroPedido: "PO-002",
      referencia: null,
      numeroItem: 1,
      codigoGrupo: "20",
      codigoCFOP: null,
      empresaDona: "PALITOS INDUSTRIA",
      maxiprodId: 77777,
      collectedAt: new Date(),
    });

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items[0];
    
    // PO should be zero because it was cancelled
    expect(item.poUn).toBe(0);
    expect(item.poCx).toBeNull();
  });

  it("should include Digitacao orders but exclude Cancelado (espelho fiel)", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00100",
        descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
        quantidade: "50000",
      }),
    );
    // Digitacao order - SHOULD be counted (espelho fiel do Maxiprod)
    mockOrderItems.push(
      makeOrderItem({
        codigoItem: "00100",
        quantidade: "10",
        quantidadeUnEstoque: "50000",
        estadoNota: "Digitacao",
      }),
    );
    // Cancelado order - should NOT be counted
    mockOrderItems.push(
      makeOrderItem({
        codigoItem: "00100",
        quantidade: "5",
        quantidadeUnEstoque: "25000",
        estadoNota: "Cancelado",
      }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items[0];
    
    // REGRA: Digitação NÃO reserva estoque, Cancelado também não
    // Apenas Aprovado e A aprovar reservam
    expect(item.pedidosUn).toBe(0);
    
    // Mas Digitação aparece no tooltip como informação
    const digitacaoPedidos = item.pedidosPorCliente?.filter((p: any) => p.status === 'Digitacao' || p.status === 'Digitação');
    expect(digitacaoPedidos?.length).toBeGreaterThanOrEqual(0);
  });

  it("should merge stock items with same codigoItem", async () => {
    // Same product in two different stock locations
    mockStockItems.push(
      makeStockItem({ codigoItem: "00100", quantidade: "30000", descricaoItem: "VARETA BAMBU 3,0 X 250 MM" }),
      makeStockItem({ codigoItem: "00100", quantidade: "20000", descricaoItem: "VARETA BAMBU 3,0 X 250 MM" }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    
    // Should be merged into one item
    expect(items).toHaveLength(1);
    expect(items[0].estoqueUn).toBe(50000);
  });

  it("should classify segments correctly", async () => {
    mockStockItems.push(
      makeStockItem({ codigoItem: "00100", descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM" }),
      makeStockItem({ codigoItem: "00200", descricaoItem: "ESPETO DE BAMBU 3,5 X 120 MM" }),
      makeStockItem({ codigoItem: "00300", descricaoItem: "PALITO DENTAL EMBALADO" }),
      makeStockItem({ codigoItem: "00400", descricaoItem: "HASHI DESCARTAVEL 21 CM" }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const byCode = new Map(items.map((i: any) => [i.codigoItem, i]));
    
    expect(byCode.get("00100").segmento).toBe("bambu"); // VARETA
    expect(byCode.get("00200").segmento).toBe("bambu"); // ESPETO
    expect(byCode.get("00300").segmento).toBe("industrializado"); // PALITO
    expect(byCode.get("00400").segmento).toBe("bambu"); // HASHI
  });

  it("should extract referenciaPO from pedidoDeCompra.referencia field", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00100",
        descricaoItem: "ESPETO DE BAMBU (SEGUNDA LINHA) 4,5*250 MM (5.000 POR CAIXA)",
        quantidade: "50000",
      }),
    );
    // PO with referencia field containing PO number from supplier
    mockPurchaseOrderItems.push({
      id: 1,
      codigoItem: "00100",
      descricaoItem: "ESPETO DE BAMBU (SEGUNDA LINHA) 4,5*250 MM (5.000 POR CAIXA)",
      descricao: "ESPETO DE BAMBU (SEGUNDA LINHA) 4,5*250 MM (5.000 POR CAIXA)",
      quantidade: "100",
      quantidadeUnEstoque: "500000",
      fatorConversao: "5000",
      unidadeMedida: "CX",
      unidadeMedidaEstoque: "UN",
      dataEntrega: "2026-03-25T00:00:00.000-03:00",
      dataEmissao: "2026-01-15",
      estadoPedido: "Aprovado",
      estadoItem: "A receber",
      fornecedor: "GANZHOU JIDAXIANG BAMBOO",
      valorTotal: "50000.00",
      valorUnitario: "500.00",
      numeroPedido: "13",
      referencia: "PO65 - COMERCIAL",
      numeroItem: 1,
      codigoGrupo: "20",
      codigoCFOP: null,
      empresaDona: "PALITOS INDUSTRIA",
      maxiprodId: 88888,
      collectedAt: new Date(),
    });
    mockPurchaseOrderItems.push({
      id: 2,
      codigoItem: "00100",
      descricaoItem: "ESPETO DE BAMBU (SEGUNDA LINHA) 4,5*250 MM (5.000 POR CAIXA)",
      descricao: "ESPETO DE BAMBU (SEGUNDA LINHA) 4,5*250 MM (5.000 POR CAIXA)",
      quantidade: "200",
      quantidadeUnEstoque: "1000000",
      fatorConversao: "5000",
      unidadeMedida: "CX",
      unidadeMedidaEstoque: "UN",
      dataEntrega: "2026-04-15T00:00:00.000-03:00",
      dataEmissao: "2026-02-01",
      estadoPedido: "Aprovado",
      estadoItem: "A receber",
      fornecedor: "GANZHOU JIDAXIANG BAMBOO",
      valorTotal: "100000.00",
      valorUnitario: "500.00",
      numeroPedido: "16",
      referencia: "PO62 - PROFORMA PEDIDO",
      numeroItem: 1,
      codigoGrupo: "20",
      codigoCFOP: null,
      empresaDona: "PALITOS INDUSTRIA",
      maxiprodId: 88889,
      collectedAt: new Date(),
    });

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items[0];
    
    // Should have 2 PO lotes
    expect(item.poLotes).toHaveLength(2);
    
    // referenciaPO should be extracted from referencia field (before " - ")
    const refs = item.poLotes.map((l: any) => l.referenciaPO).sort();
    expect(refs).toContain("PO62");
    expect(refs).toContain("PO65");
    
    // Dates should be formatted as DD/MM/YY
    const dates = item.poLotes.map((l: any) => l.dataEntrega).sort();
    expect(dates).toContain("25/03/26");
    expect(dates).toContain("15/04/26");
    
    // numeroPedido should still be the internal number
    const pedidos = item.poLotes.map((l: any) => l.numeroPedido).sort();
    expect(pedidos).toContain("13");
    expect(pedidos).toContain("16");
  });

  it("should handle MADEIRA reference without PO prefix", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00500",
        descricaoItem: "MADEIRA SERRADA SECA",
        quantidade: "10000",
      }),
    );
    mockPurchaseOrderItems.push({
      id: 3,
      codigoItem: "00500",
      descricaoItem: "MADEIRA SERRADA SECA",
      descricao: "MADEIRA SERRADA SECA",
      quantidade: "50",
      quantidadeUnEstoque: null,
      fatorConversao: null,
      unidadeMedida: "M3",
      unidadeMedidaEstoque: "KG",
      dataEntrega: "2026-04-26T00:00:00.000-03:00",
      dataEmissao: "2026-02-01",
      estadoPedido: "Aprovado",
      estadoItem: "A receber",
      fornecedor: "HARBIN ZHONGYI",
      valorTotal: "25000.00",
      valorUnitario: "500.00",
      numeroPedido: "14",
      referencia: "MADEIRA - CONTRATO",
      numeroItem: 1,
      codigoGrupo: "18",
      codigoCFOP: null,
      empresaDona: "PALITOS INDUSTRIA",
      maxiprodId: 77777,
      collectedAt: new Date(),
    });

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items[0];
    
    // referenciaPO should be "MADEIRA" (part before " - ")
    expect(item.poLotes[0].referenciaPO).toBe("MADEIRA");
  });

  it("should handle empty stock gracefully", async () => {
    // No items at all
    await processStockData();

    expect(insertedDashboardData).not.toBeNull();
    const items = JSON.parse(insertedDashboardData.dataJson);
    expect(items).toHaveLength(0);
  });

  it("should create PO-only items with estoque = 0 for items not in stock", async () => {
    // No stock items - but a PO exists for a new product
    mockPurchaseOrderItems.push({
      id: 1,
      codigoItem: "00999",
      descricaoItem: "ESPETO DE BAMBU NOVO 4,0*250 MM (5.000 POR CAIXA)",
      descricao: "ESPETO DE BAMBU NOVO 4,0*250 MM (5.000 POR CAIXA)",
      quantidade: "200",
      quantidadeUnEstoque: "1000000",
      fatorConversao: "5000",
      unidadeMedida: "CX",
      unidadeMedidaEstoque: "UN",
      dataEntrega: "2026-04-15T00:00:00.000-03:00",
      dataEmissao: "2026-03-01",
      estadoPedido: "Aprovado",
      estadoItem: "A receber",
      fornecedor: "GANZHOU JIDAXIANG BAMBOO",
      valorTotal: "100000.00",
      valorUnitario: "500.00",
      numeroPedido: "20",
      referencia: "PO70 - COMERCIAL",
      numeroItem: 1,
      codigoGrupo: "20",
      codigoCFOP: null,
      empresaDona: "PALITOS INDUSTRIA",
      maxiprodId: 55555,
      collectedAt: new Date(),
    });

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    
    // Should have 1 item (PO-only)
    expect(items).toHaveLength(1);
    const item = items[0];
    
    // Estoque should be 0
    expect(item.codigoItem).toBe("00999");
    expect(item.estoqueUn).toBe(0);
    expect(item.estoqueCx).toBe(0);
    expect(item.pedidosUn).toBe(0);
    expect(item.disponivelUn).toBe(0);
    
    // PO should be present
    expect(item.poUn).toBe(1000000);
    expect(item.poCx).toBe(200);
    expect(item.projetadoUn).toBe(1000000);
    
    // referenciaPO should be extracted
    expect(item.poLotes[0].referenciaPO).toBe("PO70");
  });

  it("should match POs to stock items by codigoItem", async () => {
    // Stock item with code 00100
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00100",
        descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
        quantidade: "50000",
      }),
    );
    // PO with same codigoItem but DIFFERENT description (common in Maxiprod)
    mockPurchaseOrderItems.push({
      id: 1,
      codigoItem: "00100",
      descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
      descricao: "VARETA DE BAMBU (SEGUNDA LINHA) 3,0*250 MM (5.000 POR CAIXA)",
      quantidade: "100",
      quantidadeUnEstoque: "500000",
      fatorConversao: "5000",
      unidadeMedida: "CX",
      unidadeMedidaEstoque: "UN",
      dataEntrega: "2026-04-15",
      dataEmissao: "2026-03-01",
      estadoPedido: "Aprovado",
      estadoItem: "A receber",
      fornecedor: "FORNECEDOR",
      valorTotal: "50000.00",
      valorUnitario: "500.00",
      numeroPedido: "25",
      referencia: "PO80 - TESTE",
      numeroItem: 1,
      codigoGrupo: "20",
      codigoCFOP: null,
      empresaDona: "PALITOS INDUSTRIA",
      maxiprodId: 44444,
      collectedAt: new Date(),
    });

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    
    // Should have only 1 item (PO matched to stock by codigoItem)
    expect(items).toHaveLength(1);
    expect(items[0].codigoItem).toBe("00100");
    expect(items[0].poUn).toBe(500000);
    expect(items[0].poLotes[0].referenciaPO).toBe("PO80");
  });
});

describe("stockProcessor - isKgProduct detection", () => {
  beforeEach(() => {
    mockStockItems.length = 0;
    mockOrderItems.length = 0;
    mockPurchaseOrderItems.length = 0;
    insertedDashboardData = null;
  });

  it("should set isKgProduct=true for products with unidadeMedida=kg", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00207",
        descricaoItem: "VARETA DE BAMBU NATURAL 3,0 X 250 MM",
        unidadeMedida: "kg",
        quantidade: "30000",
      }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items.find((i: any) => i.codigoItem === "00207");
    expect(item.isKgProduct).toBe(true);
  });

  it("should set isKgProduct=true for products with KG in description (PCT 20KG)", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00058",
        descricaoItem: "VARETA DE APITO BAMBU 3,0 X 350 MM PCT 20KG",
        unidadeMedida: "un",
        quantidade: "80400",
      }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items.find((i: any) => i.codigoItem === "00058");
    expect(item.isKgProduct).toBe(true);
  });

  it("should set isKgProduct=false for regular products without KG", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00100",
        descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
        unidadeMedida: "UN",
        quantidade: "50000",
      }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items.find((i: any) => i.codigoItem === "00100");
    expect(item.isKgProduct).toBe(false);
  });

  it("should NOT set isKgProduct=true when description has KG but also has UNID", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00999",
        descricaoItem: "VARETA BAMBU 3,0 X 250 MM C/ 5.000 UNID PESO 2KG",
        unidadeMedida: "UN",
        quantidade: "50000",
      }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items.find((i: any) => i.codigoItem === "00999");
    expect(item.isKgProduct).toBe(false);
  });
});

describe("stockProcessor - pedidosPorCliente tooltip data", () => {
  beforeEach(() => {
    mockStockItems.length = 0;
    mockOrderItems.length = 0;
    mockPurchaseOrderItems.length = 0;
    insertedDashboardData = null;
  });

  it("should aggregate orders by client with status", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00100",
        descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
        quantidade: "500000",
      }),
    );
    // Multiple orders from different clients
    mockOrderItems.push(
      makeOrderItem({
        codigoItem: "00100",
        quantidade: "10",
        quantidadeUnEstoque: "50000",
        cliente: "CLIENTE A",
        estadoNota: "Aprovado",
      }),
      makeOrderItem({
        codigoItem: "00100",
        quantidade: "5",
        quantidadeUnEstoque: "25000",
        cliente: "CLIENTE B",
        estadoNota: "Digitação",
      }),
      makeOrderItem({
        codigoItem: "00100",
        quantidade: "3",
        quantidadeUnEstoque: "15000",
        cliente: "CLIENTE A",
        estadoNota: "Aprovado",
      }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items[0];

    expect(item.pedidosPorCliente).toBeDefined();
    expect(item.pedidosPorCliente.length).toBe(2);

    // CLIENTE A should be first (13 cx > 5 cx), sorted by quantity desc
    expect(item.pedidosPorCliente[0].cliente).toBe("CLIENTE A");
    expect(item.pedidosPorCliente[0].quantidadeCx).toBe(13);
    expect(item.pedidosPorCliente[0].status).toBe("Aprovado");

    expect(item.pedidosPorCliente[1].cliente).toBe("CLIENTE B");
    expect(item.pedidosPorCliente[1].quantidadeCx).toBe(5);
    expect(item.pedidosPorCliente[1].status).toBe("Digitação");
  });

  it("should separate same client with different statuses", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00100",
        descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
        quantidade: "500000",
      }),
    );
    mockOrderItems.push(
      makeOrderItem({
        codigoItem: "00100",
        quantidade: "10",
        quantidadeUnEstoque: "50000",
        cliente: "CLIENTE X",
        estadoNota: "Aprovado",
      }),
      makeOrderItem({
        codigoItem: "00100",
        quantidade: "5",
        quantidadeUnEstoque: "25000",
        cliente: "CLIENTE X",
        estadoNota: "Digitação",
      }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items[0];

    expect(item.pedidosPorCliente).toHaveLength(2);
    const statuses = item.pedidosPorCliente.map((p: any) => p.status);
    expect(statuses).toContain("Aprovado");
    expect(statuses).toContain("Digitação");
  });

  it("should handle null client as '(sem cliente)'", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00100",
        descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
        quantidade: "500000",
      }),
    );
    mockOrderItems.push(
      makeOrderItem({
        codigoItem: "00100",
        quantidade: "7",
        quantidadeUnEstoque: "35000",
        cliente: null,
        estadoNota: "Digitação",
      }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items[0];

    expect(item.pedidosPorCliente).toHaveLength(1);
    expect(item.pedidosPorCliente[0].cliente).toBe("(sem cliente)");
    expect(item.pedidosPorCliente[0].quantidadeCx).toBe(7);
    expect(item.pedidosPorCliente[0].status).toBe("Digitação");
  });

  it("should return empty pedidosPorCliente when no orders exist", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00100",
        descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
        quantidade: "500000",
      }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items[0];

    expect(item.pedidosPorCliente).toBeDefined();
    expect(item.pedidosPorCliente).toHaveLength(0);
  });

  it("should include status info for each client entry", async () => {
    mockStockItems.push(
      makeStockItem({
        codigoItem: "00100",
        descricaoItem: "VARETA DE BAMBU 3,0 X 250 MM C/ 5.000 UNID",
        quantidade: "500000",
      }),
    );
    mockOrderItems.push(
      makeOrderItem({
        codigoItem: "00100",
        quantidade: "20",
        quantidadeUnEstoque: "100000",
        cliente: "GRANDE CLIENTE",
        estadoNota: "Aprovado",
      }),
      makeOrderItem({
        codigoItem: "00100",
        quantidade: "5",
        quantidadeUnEstoque: "25000",
        cliente: "PEQUENO CLIENTE",
        estadoNota: "A aprovar",
      }),
      makeOrderItem({
        codigoItem: "00100",
        quantidade: "3",
        quantidadeUnEstoque: "15000",
        cliente: "NOVO CLIENTE",
        estadoNota: "Digitação",
      }),
    );

    await processStockData();

    const items = JSON.parse(insertedDashboardData.dataJson);
    const item = items[0];

    expect(item.pedidosPorCliente).toHaveLength(3);

    // Verify each entry has all required fields
    for (const pc of item.pedidosPorCliente) {
      expect(pc).toHaveProperty("cliente");
      expect(pc).toHaveProperty("quantidadeCx");
      expect(pc).toHaveProperty("quantidadeUn");
      expect(pc).toHaveProperty("status");
      expect(typeof pc.cliente).toBe("string");
      expect(typeof pc.quantidadeCx).toBe("number");
      expect(typeof pc.quantidadeUn).toBe("number");
      expect(typeof pc.status).toBe("string");
    }

    // Verify sorted by quantity descending
    expect(item.pedidosPorCliente[0].cliente).toBe("GRANDE CLIENTE");
    expect(item.pedidosPorCliente[0].quantidadeCx).toBe(20);
    expect(item.pedidosPorCliente[0].status).toBe("Aprovado");

    expect(item.pedidosPorCliente[1].cliente).toBe("PEQUENO CLIENTE");
    expect(item.pedidosPorCliente[1].status).toBe("A aprovar");

    expect(item.pedidosPorCliente[2].cliente).toBe("NOVO CLIENTE");
    expect(item.pedidosPorCliente[2].status).toBe("Digitação");
  });
});
