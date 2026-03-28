import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { salesOrders } from "../drizzle/schema";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// Create test items spanning multiple months, some Faturado, some A faturar
const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 10);
const twoMonthsAgoStr = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, "0")}`;

const testItems = [
  {
    dataEmissao: `${currentMonth}-10T12:00:00.000Z`,
    dataEntrega: `${currentMonth}-20T12:00:00.000Z`,
    dataAprovacao: `${currentMonth}-10T14:00:00.000Z`,
    pedido: "900",
    cliente: "EMPRESA ALFA LTDA",
    clienteApelido: "ALFA",
    uf: "SP",
    descricao: "ESPETO DE BAMBU 4,0 X 250 MM",
    estadoItem: "A faturar",
    quantidade: 10,
    valorTotal: 500,
    valorContabil: 500,
    valorFaturar: 500,
    fatorConversao: 5000,
    codigoGrupo: "20",
    idGrupoItem: 9001,
    empresa: "PALITOS INDUSTRIA",
    representante: "JOAO SILVA",
    segmento: "INDUSTRIA",
    regiao: null,
    estadoConfiguravel: "BAMBU",
    razaoSocial: "EMPRESA ALFA COMERCIO LTDA",
    condicaoPagamento: "30 45 60",
    transportadora: "CORREIO",
    clienteTelefone: "(11) 99999-0000",
    clienteEmail: "alfa@email.com",
    crmSegmento: "DISTRIBUIDORA",
  },
  {
    dataEmissao: `${currentMonth}-05T12:00:00.000Z`,
    dataEntrega: `${currentMonth}-15T12:00:00.000Z`,
    dataAprovacao: `${currentMonth}-05T14:00:00.000Z`,
    pedido: "901",
    cliente: "EMPRESA BETA SA",
    clienteApelido: "BETA",
    uf: "MG",
    descricao: "VARETA AROMATIZADOR 4,0 X 250 MM",
    estadoItem: "Faturado",
    quantidade: 20,
    valorTotal: 1200,
    valorContabil: 1200,
    valorFaturar: 0,
    fatorConversao: 10000,
    codigoGrupo: "21",
    idGrupoItem: 9002,
    empresa: "PALITOS INDUSTRIA",
    representante: null,
    segmento: "DISTRIBUIDORA",
    regiao: null,
    estadoConfiguravel: "BAMBU",
    crmSegmento: "DISTRIBUIDORA",
  },
  {
    dataEmissao: `${lastMonthStr}-15T12:00:00.000Z`,
    dataEntrega: `${lastMonthStr}-25T12:00:00.000Z`,
    dataAprovacao: `${lastMonthStr}-15T14:00:00.000Z`,
    pedido: "902",
    cliente: "EMPRESA GAMA LTDA",
    clienteApelido: "GAMA",
    uf: "RJ",
    descricao: "PALITO DE DENTE 50x1.000",
    estadoItem: "A faturar",
    quantidade: 30,
    valorTotal: 2000,
    valorContabil: 2000,
    valorFaturar: 2000,
    fatorConversao: 50000,
    codigoGrupo: "PALITO",
    idGrupoItem: 9003,
    empresa: "PALITOS INDUSTRIA",
    representante: "MARIA SOUZA",
    segmento: "LOJA",
    regiao: null,
    estadoConfiguravel: "MADEIRA",
    razaoSocial: "EMPRESA GAMA COMERCIO LTDA",
    condicaoPagamento: "30",
    crmSegmento: "LOJA",
  },
  {
    dataEmissao: `${twoMonthsAgoStr}-10T12:00:00.000Z`,
    dataEntrega: `${twoMonthsAgoStr}-20T12:00:00.000Z`,
    dataAprovacao: `${twoMonthsAgoStr}-10T14:00:00.000Z`,
    pedido: "903",
    cliente: "EMPRESA DELTA ME",
    clienteApelido: "DELTA",
    uf: "PR",
    descricao: "ESPETO DE BAMBU 3,0 X 200 MM",
    estadoItem: "A faturar",
    quantidade: 15,
    valorTotal: 800,
    valorContabil: 800,
    valorFaturar: 800,
    fatorConversao: 5000,
    codigoGrupo: "20",
    idGrupoItem: 9004,
    empresa: "PALITOS INDUSTRIA",
    representante: null,
    segmento: "INDUSTRIA",
    regiao: null,
    estadoConfiguravel: "BAMBU",
    crmSegmento: "INDÚSTRIA",
  },
];

let backupSalesOrders: any[] = [];

describe("sales getAllUnbilled endpoint", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);

  // Backup production data, then insert test data
  beforeAll(async () => {
    const db = await getDb();
    if (db) {
      backupSalesOrders = await db.select().from(salesOrders);
      await db.delete(salesOrders);
      // Ingest test items
      await caller.sales.ingestSalesOrders({ items: testItems });
    }
  });

  // Restore production data after all tests
  afterAll(async () => {
    const db = await getDb();
    if (db) {
      await db.delete(salesOrders);
      if (backupSalesOrders.length > 0) {
        for (let i = 0; i < backupSalesOrders.length; i += 50) {
          await db.insert(salesOrders).values(backupSalesOrders.slice(i, i + 50));
        }
      }
    }
  });

  it("returns all unbilled orders from last 90 days", async () => {
    const result = await caller.sales.getAllUnbilled({});
    // Should include orders 900, 902, 903 (A faturar) but NOT 901 (Faturado)
    expect(result.orders.length).toBeGreaterThanOrEqual(3);
    const pedidos = result.orders.map(o => o.pedido);
    expect(pedidos).toContain("900");
    expect(pedidos).toContain("902");
    expect(pedidos).toContain("903");
    expect(pedidos).not.toContain("901"); // Faturado should be excluded
  });

  it("returns correct total value", async () => {
    const result = await caller.sales.getAllUnbilled({});
    // 500 + 2000 + 800 = 3300
    expect(result.totalValue).toBe(3300);
  });

  it("returns months sorted in reverse order", async () => {
    const result = await caller.sales.getAllUnbilled({});
    expect(result.months.length).toBeGreaterThanOrEqual(2);
    // Months should be sorted descending
    for (let i = 1; i < result.months.length; i++) {
      expect(result.months[i - 1] >= result.months[i]).toBe(true);
    }
  });

  it("includes customer details in orders", async () => {
    const result = await caller.sales.getAllUnbilled({});
    const order900 = result.orders.find(o => o.pedido === "900");
    expect(order900).toBeDefined();
    expect(order900!.cliente).toBe("EMPRESA ALFA LTDA");
    // Note: razaoSocial, transportadora, condicaoPagamento, etc. are populated
    // by the GraphQL ingestion path, not the basic ingestSalesOrders endpoint.
    // The ingestSalesOrders endpoint only stores the basic fields.
    // Here we just verify the fields exist in the response (may be null from basic ingest)
    expect(order900!).toHaveProperty("razaoSocial");
    expect(order900!).toHaveProperty("condicaoPagamento");
    expect(order900!).toHaveProperty("transportadora");
    expect(order900!).toHaveProperty("representante");
    expect(order900!.representante).toBe("JOAO SILVA"); // representante IS in basic ingest
    expect(order900!).toHaveProperty("clienteTelefone");
    expect(order900!).toHaveProperty("clienteEmail");
  });

  it("includes month field in each order", async () => {
    const result = await caller.sales.getAllUnbilled({});
    for (const order of result.orders) {
      expect(order.month).toBeDefined();
      expect(order.month).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("filters by grupo correctly", async () => {
    // Only BAMBU orders (900, 903)
    const result = await caller.sales.getAllUnbilled({ grupo: "importacao_revenda" });
    const pedidos = result.orders.map(o => o.pedido);
    expect(pedidos).toContain("900");
    expect(pedidos).toContain("903");
    expect(pedidos).not.toContain("902"); // MADEIRA = industrializacao
  });

  it("filters by grupo industrializacao correctly", async () => {
    // Only MADEIRA orders (902)
    const result = await caller.sales.getAllUnbilled({ grupo: "industrializacao" });
    const pedidos = result.orders.map(o => o.pedido);
    expect(pedidos).toContain("902");
    expect(pedidos).not.toContain("900");
    expect(pedidos).not.toContain("903");
  });

  it("filters by crmSegmento correctly", async () => {
    const result = await caller.sales.getAllUnbilled({ crmSegmento: "DISTRIBUIDORA" });
    const pedidos = result.orders.map(o => o.pedido);
    expect(pedidos).toContain("900");
    // 902 is LOJA, 903 is INDÚSTRIA
    expect(pedidos).not.toContain("902");
    expect(pedidos).not.toContain("903");
  });

  it("returns empty result when no matching orders", async () => {
    const result = await caller.sales.getAllUnbilled({ grupo: "importacao_mp" });
    expect(result.orders.length).toBe(0);
    expect(result.totalValue).toBe(0);
    expect(result.months.length).toBe(0);
  });

  it("includes items in each order", async () => {
    const result = await caller.sales.getAllUnbilled({});
    for (const order of result.orders) {
      expect(order.itens.length).toBeGreaterThan(0);
      for (const item of order.itens) {
        expect(item.descricao).toBeDefined();
        expect(typeof item.quantidade).toBe("number");
        expect(typeof item.valorTotal).toBe("number");
      }
    }
  });
});
