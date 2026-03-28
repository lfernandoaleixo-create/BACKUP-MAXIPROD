import { describe, expect, it, beforeAll, afterAll } from "vitest";
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

/**
 * Test data with different estadoConfiguravel and crmSegmento values
 * to validate hierarchical filtering (grupo → subgrupo → crmSegmento)
 */
const testItems = [
  {
    dataEmissao: "2026-02-10T12:00:00.000Z",
    dataEntrega: "2026-02-15T12:00:00.000Z",
    dataAprovacao: "2026-02-10T14:00:00.000Z",
    pedido: "200",
    cliente: "CLIENTE BAMBU",
    clienteApelido: "CLI BAMBU",
    uf: "SP",
    descricao: "ESPETO DE BAMBU 4,0 X 250 MM",
    estadoItem: "Faturado",
    quantidade: 10,
    valorTotal: 1000,
    valorContabil: 1000,
    valorFaturar: 0,
    fatorConversao: 5000,
    codigoGrupo: "20",
    idGrupoItem: 2001,
    empresa: "PALITOS INDUSTRIA",
    representante: null,
    segmento: "DISTRIBUIDORA",
    regiao: null,
    estadoConfiguravel: "BAMBU",
    crmSegmento: "DISTRIBUIDORA",
  },
  {
    dataEmissao: "2026-02-12T12:00:00.000Z",
    dataEntrega: "2026-02-17T12:00:00.000Z",
    dataAprovacao: "2026-02-12T14:00:00.000Z",
    pedido: "201",
    cliente: "CLIENTE FIBRA",
    clienteApelido: "CLI FIBRA",
    uf: "MG",
    descricao: "VARETA FIBRA 3,0 X 250 MM",
    estadoItem: "A faturar",
    quantidade: 20,
    valorTotal: 2000,
    valorContabil: 2000,
    valorFaturar: 2000,
    fatorConversao: 10000,
    codigoGrupo: "21",
    idGrupoItem: 2002,
    empresa: "PALITOS INDUSTRIA",
    representante: null,
    segmento: "LOJA",
    regiao: null,
    estadoConfiguravel: "FIBRA",
    crmSegmento: "LOJA",
  },
  {
    dataEmissao: "2026-02-15T12:00:00.000Z",
    dataEntrega: "2026-02-20T12:00:00.000Z",
    dataAprovacao: "2026-02-15T14:00:00.000Z",
    pedido: "202",
    cliente: "CLIENTE MADEIRA",
    clienteApelido: "CLI MADEIRA",
    uf: "PR",
    descricao: "VARETA MADEIRA 3,5 X 250 MM",
    estadoItem: "Faturado",
    quantidade: 15,
    valorTotal: 3000,
    valorContabil: 3000,
    valorFaturar: 0,
    fatorConversao: 7500,
    codigoGrupo: "06",
    idGrupoItem: 2003,
    empresa: "PALITOS INDUSTRIA",
    representante: null,
    segmento: "INDUSTRIA",
    regiao: null,
    estadoConfiguravel: "MADEIRA",
    crmSegmento: "INDÚSTRIA",
  },
  {
    dataEmissao: "2026-02-18T12:00:00.000Z",
    dataEntrega: "2026-02-23T12:00:00.000Z",
    dataAprovacao: "2026-02-18T14:00:00.000Z",
    pedido: "203",
    cliente: "CLIENTE MP",
    clienteApelido: "CLI MP",
    uf: "SC",
    descricao: "MADEIRA IMPORTADA SERRADA",
    estadoItem: "A faturar",
    quantidade: 5,
    valorTotal: 5000,
    valorContabil: 5000,
    valorFaturar: 5000,
    fatorConversao: 1000,
    codigoGrupo: "18",
    idGrupoItem: 2004,
    empresa: "PALITOS INDUSTRIA",
    representante: null,
    segmento: "INDUSTRIA",
    regiao: null,
    estadoConfiguravel: "MADEIRA IMPORTADA",
    crmSegmento: "INDÚSTRIA",
  },
  {
    dataEmissao: "2026-03-05T12:00:00.000Z",
    dataEntrega: "2026-03-10T12:00:00.000Z",
    dataAprovacao: "2026-03-05T14:00:00.000Z",
    pedido: "204",
    cliente: "CLIENTE BAMBU",
    clienteApelido: "CLI BAMBU",
    uf: "SP",
    descricao: "ESPETO DE BAMBU 4,0 X 250 MM",
    estadoItem: "A faturar",
    quantidade: 8,
    valorTotal: 800,
    valorContabil: 800,
    valorFaturar: 800,
    fatorConversao: 5000,
    codigoGrupo: "20",
    idGrupoItem: 2005,
    empresa: "PALITOS INDUSTRIA",
    representante: null,
    segmento: "DISTRIBUIDORA",
    regiao: null,
    estadoConfiguravel: "BAMBU",
    crmSegmento: "DISTRIBUIDORA",
  },
];

let backupSalesOrders: any[] = [];

describe("sales hierarchical filters", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);

  beforeAll(async () => {
    const db = await getDb();
    if (db) {
      backupSalesOrders = await db.select().from(salesOrders);
      await db.delete(salesOrders);
      await caller.sales.ingestSalesOrders({ items: testItems });
    }
  });

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

  describe("getAvailableFilters", () => {
    it("returns all grupos from the data", async () => {
      const filters = await caller.sales.getAvailableFilters();
      const grupoValues = filters.grupos.map((g) => g.value).sort();
      expect(grupoValues).toContain("importacao_revenda");
      expect(grupoValues).toContain("industrializacao");
      expect(grupoValues).toContain("importacao_mp");
    });

    it("returns subgrupos for importacao_revenda", async () => {
      const filters = await caller.sales.getAvailableFilters();
      const subs = filters.subgrupos["importacao_revenda"];
      expect(subs).toBeDefined();
      const subValues = subs.map((s) => s.value).sort();
      expect(subValues).toContain("bambu");
      expect(subValues).toContain("fibra");
    });

    it("returns crmSegmentos from the data", async () => {
      const filters = await caller.sales.getAvailableFilters();
      const segValues = filters.crmSegmentos.map((s) => s.value);
      expect(segValues).toContain("DISTRIBUIDORA");
      expect(segValues).toContain("LOJA");
      expect(segValues).toContain("INDÚSTRIA");
    });
  });

  describe("getAnalytics with grupo filter", () => {
    it("returns all items when grupo=all", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        grupo: "all",
      });
      expect(analytics!.totalItems).toBe(5);
      expect(analytics!.totalValue).toBe(11800); // 1000+2000+3000+5000+800
    });

    it("filters by grupo importacao_revenda (BAMBU + FIBRA)", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        grupo: "importacao_revenda",
      });
      expect(analytics!.totalItems).toBe(3); // 2 BAMBU + 1 FIBRA
      expect(analytics!.totalValue).toBe(3800); // 1000+2000+800
    });

    it("filters by grupo industrializacao (MADEIRA)", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        grupo: "industrializacao",
      });
      expect(analytics!.totalItems).toBe(1);
      expect(analytics!.totalValue).toBe(3000);
    });

    it("filters by grupo importacao_mp (MADEIRA IMPORTADA)", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        grupo: "importacao_mp",
      });
      expect(analytics!.totalItems).toBe(1);
      expect(analytics!.totalValue).toBe(5000);
    });
  });

  describe("getAnalytics with subgrupo filter", () => {
    it("filters by subgrupo bambu within importacao_revenda", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        grupo: "importacao_revenda",
        subgrupo: "bambu",
      });
      expect(analytics!.totalItems).toBe(2); // 2 BAMBU items
      expect(analytics!.totalValue).toBe(1800); // 1000+800
    });

    it("filters by subgrupo fibra within importacao_revenda", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        grupo: "importacao_revenda",
        subgrupo: "fibra",
      });
      expect(analytics!.totalItems).toBe(1);
      expect(analytics!.totalValue).toBe(2000);
    });
  });

  describe("getAnalytics with crmSegmento filter", () => {
    it("filters by crmSegmento DISTRIBUIDORA", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        crmSegmento: "DISTRIBUIDORA",
      });
      expect(analytics!.totalItems).toBe(2); // 2 BAMBU items from DISTRIBUIDORA
      expect(analytics!.totalValue).toBe(1800);
    });

    it("filters by crmSegmento LOJA", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        crmSegmento: "LOJA",
      });
      expect(analytics!.totalItems).toBe(1);
      expect(analytics!.totalValue).toBe(2000);
    });
  });

  describe("getAnalytics with combined filters", () => {
    it("filters by grupo + crmSegmento together", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        grupo: "importacao_revenda",
        crmSegmento: "DISTRIBUIDORA",
      });
      expect(analytics!.totalItems).toBe(2); // Only BAMBU items with DISTRIBUIDORA
      expect(analytics!.totalValue).toBe(1800);
    });

    it("returns empty when no items match combined filters", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        grupo: "industrializacao",
        crmSegmento: "DISTRIBUIDORA",
      });
      expect(analytics!.totalItems).toBe(0);
      expect(analytics!.totalValue).toBe(0);
    });
  });

  describe("getAnalytics bySegmentKPI reflects filters", () => {
    it("shows only relevant segments when grupo filter is applied", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        grupo: "importacao_revenda",
      });
      // When filtered to importacao_revenda, bySegmentKPI should only have Revenda
      expect(analytics!.bySegmentKPI.length).toBe(1);
      expect(analytics!.bySegmentKPI[0].name).toBe("Revenda (Bambu/Fibra)");
      expect(analytics!.bySegmentKPI[0].value).toBe(3800);
    });
  });

  describe("getOrders with hierarchical filters", () => {
    it("filters orders by grupo", async () => {
      const orders = await caller.sales.getOrders({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        grupo: "importacao_revenda",
      });
      // Should only include orders with BAMBU/FIBRA items
      const pedidos = orders.map((o) => o.pedido);
      expect(pedidos).toContain("200");
      expect(pedidos).toContain("201");
      expect(pedidos).toContain("204");
      expect(pedidos).not.toContain("202"); // MADEIRA
      expect(pedidos).not.toContain("203"); // MADEIRA IMPORTADA
    });

    it("filters orders by crmSegmento", async () => {
      const orders = await caller.sales.getOrders({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        crmSegmento: "LOJA",
      });
      expect(orders.length).toBe(1);
      expect(orders[0].pedido).toBe("201");
    });
  });

  describe("getPreviousUnbilled with hierarchical filters", () => {
    it("filters previous unbilled by grupo", async () => {
      // Items before March that are "A faturar"
      const unbilled = await caller.sales.getPreviousUnbilled({
        currentPeriodStart: "2026-03-01",
        grupo: "importacao_revenda",
      });
      // Only FIBRA item (201) is "A faturar" in Feb within importacao_revenda
      expect(unbilled.orders.length).toBe(1);
      expect(unbilled.orders[0].pedido).toBe("201");
    });

    it("filters previous unbilled by crmSegmento", async () => {
      const unbilled = await caller.sales.getPreviousUnbilled({
        currentPeriodStart: "2026-03-01",
        crmSegmento: "INDÚSTRIA",
      });
      // Only MADEIRA IMPORTADA (203) is "A faturar" and has crmSegmento INDÚSTRIA
      expect(unbilled.orders.length).toBe(1);
      expect(unbilled.orders[0].pedido).toBe("203");
    });
  });

  describe("getCumulativeComparison with filters", () => {
    it("returns data when grupo filter is applied", async () => {
      const comparison = await caller.sales.getCumulativeComparison({
        grupo: "importacao_revenda",
      });
      expect(comparison).not.toBeNull();
      // Should have data for the current month filtered by importacao_revenda
    });

    it("returns data when crmSegmento filter is applied", async () => {
      const comparison = await caller.sales.getCumulativeComparison({
        crmSegmento: "DISTRIBUIDORA",
      });
      expect(comparison).not.toBeNull();
    });
  });
});
