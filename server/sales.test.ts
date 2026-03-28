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

const sampleItems = [
  {
    dataEmissao: "2026-02-15T12:00:00.000Z",
    dataEntrega: "2026-02-20T12:00:00.000Z",
    dataAprovacao: "2026-02-15T14:00:00.000Z",
    pedido: "100",
    cliente: "CLIENTE A",
    clienteApelido: "CLI A",
    uf: "SP",
    descricao: "ESPETO DE BAMBU 4,0 X 250 MM",
    estadoItem: "Faturado",
    quantidade: 10,
    valorTotal: 500,
    valorContabil: 500,
    valorFaturar: 0,
    fatorConversao: 5000,
    codigoGrupo: "20",
    idGrupoItem: 1001,
    empresa: "PALITOS INDUSTRIA",
    representante: null,
    segmento: "INDUSTRIA",
    regiao: null,
  },
  {
    dataEmissao: "2026-02-20T12:00:00.000Z",
    dataEntrega: "2026-02-25T12:00:00.000Z",
    dataAprovacao: "2026-02-20T14:00:00.000Z",
    pedido: "101",
    cliente: "CLIENTE B",
    clienteApelido: "CLI B",
    uf: "MG",
    descricao: "VARETA AROMATIZADOR 4,0 X 250 MM",
    estadoItem: "A faturar",
    quantidade: 20,
    valorTotal: 1200,
    valorContabil: 1200,
    valorFaturar: 1200,
    fatorConversao: 10000,
    codigoGrupo: "21",
    idGrupoItem: 1002,
    empresa: "PALITOS INDUSTRIA",
    representante: null,
    segmento: "DISTRIBUIDORA",
    regiao: null,
  },
  {
    dataEmissao: "2026-03-05T12:00:00.000Z",
    dataEntrega: "2026-03-10T12:00:00.000Z",
    dataAprovacao: "2026-03-05T14:00:00.000Z",
    pedido: "102",
    cliente: "CLIENTE A",
    clienteApelido: "CLI A",
    uf: "SP",
    descricao: "ESPETO DE BAMBU 4,0 X 250 MM",
    estadoItem: "Faturado",
    quantidade: 5,
    valorTotal: 250,
    valorContabil: 250,
    valorFaturar: 0,
    fatorConversao: 5000,
    codigoGrupo: "20",
    idGrupoItem: 1003,
    empresa: "PALITOS INDUSTRIA",
    representante: null,
    segmento: "INDUSTRIA",
    regiao: null,
  },
];

/**
 * Backup and restore production sales data to prevent data loss during tests.
 */
let backupSalesOrders: any[] = [];

describe("sales router", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);

  // Backup production data, then insert test data
  beforeAll(async () => {
    const db = await getDb();
    if (db) {
      backupSalesOrders = await db.select().from(salesOrders);
      await db.delete(salesOrders);
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

  describe("ingestSalesOrders", () => {
    it("ingests sales order items successfully", async () => {
      const result = await caller.sales.ingestSalesOrders({ items: sampleItems });
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
    });

    it("replaces existing data on re-ingest", async () => {
      // Ingest again with fewer items
      const result = await caller.sales.ingestSalesOrders({
        items: sampleItems.slice(0, 2),
      });
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);

      // Verify only 2 items exist
      const dateRange = await caller.sales.getDateRange();
      expect(dateRange?.totalCount).toBe(2);
    });
  });

  describe("getDateRange", () => {
    beforeAll(async () => {
      // Re-ingest all 3 items for analytics tests
      await caller.sales.ingestSalesOrders({ items: sampleItems });
    });

    it("returns correct date range", async () => {
      const dateRange = await caller.sales.getDateRange();
      expect(dateRange).not.toBeNull();
      expect(dateRange!.totalCount).toBe(3);
      expect(dateRange!.minDate).toContain("2026-02");
      expect(dateRange!.maxDate).toContain("2026-03");
    });
  });

  describe("getAnalytics", () => {
    it("returns analytics for the full date range", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-12-31T23:59:59.999Z",
      });

      expect(analytics).not.toBeNull();
      expect(analytics!.totalItems).toBe(3);
      expect(analytics!.totalOrders).toBe(3); // pedidos 100, 101, 102
      expect(analytics!.totalClients).toBe(2); // CLIENTE A, CLIENTE B
      expect(analytics!.totalValue).toBe(1950); // 500 + 1200 + 250
      expect(analytics!.totalFaturado).toBe(750); // 500 + 250
      expect(analytics!.totalAFaturar).toBe(1200);
    });

    it("returns correct ticket medio", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-12-31T23:59:59.999Z",
      });

      expect(analytics!.ticketMedio).toBe(650); // 1950 / 3 orders
    });

    it("returns monthly breakdown", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-12-31T23:59:59.999Z",
      });

      expect(analytics!.byMonth.length).toBe(2); // Feb and Mar
      const feb = analytics!.byMonth.find((m) => m.month === "2026-02");
      const mar = analytics!.byMonth.find((m) => m.month === "2026-03");
      expect(feb).toBeDefined();
      expect(feb!.value).toBe(1700); // 500 + 1200
      expect(feb!.orders).toBe(2);
      expect(mar).toBeDefined();
      expect(mar!.value).toBe(250);
      expect(mar!.orders).toBe(1);
    });

    it("returns client ranking", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-12-31T23:59:59.999Z",
      });

      expect(analytics!.byClient.length).toBe(2);
      // CLIENTE B has highest value (1200)
      expect(analytics!.byClient[0].name).toBe("CLIENTE B");
      expect(analytics!.byClient[0].value).toBe(1200);
      // CLIENTE A has 750 (500 + 250)
      expect(analytics!.byClient[1].name).toBe("CLIENTE A");
      expect(analytics!.byClient[1].value).toBe(750);
    });

    it("returns product ranking", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-12-31T23:59:59.999Z",
      });

      expect(analytics!.byProduct.length).toBe(2);
      // VARETA has highest value (1200)
      expect(analytics!.byProduct[0].name).toContain("VARETA");
      expect(analytics!.byProduct[0].value).toBe(1200);
    });

    it("returns UF breakdown", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-12-31T23:59:59.999Z",
      });

      expect(analytics!.byUF.length).toBe(2);
      const mg = analytics!.byUF.find((u) => u.uf === "MG");
      const sp = analytics!.byUF.find((u) => u.uf === "SP");
      expect(mg).toBeDefined();
      expect(mg!.value).toBe(1200);
      expect(sp).toBeDefined();
      expect(sp!.value).toBe(750);
    });

    it("returns segmento breakdown", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-12-31T23:59:59.999Z",
      });

      expect(analytics!.bySegmento.length).toBe(2);
      const industria = analytics!.bySegmento.find((s) => s.segmento === "INDUSTRIA");
      const distribuidora = analytics!.bySegmento.find((s) => s.segmento === "DISTRIBUIDORA");
      expect(distribuidora!.value).toBe(1200);
      expect(industria!.value).toBe(750);
    });

    it("returns empty analytics for date range with no data", async () => {
      const analytics = await caller.sales.getAnalytics({
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-12-31T23:59:59.999Z",
      });

      expect(analytics!.totalItems).toBe(0);
      expect(analytics!.totalOrders).toBe(0);
      expect(analytics!.totalValue).toBe(0);
    });

    it("filters by date range correctly", async () => {
      // Only February
      const analytics = await caller.sales.getAnalytics({
        startDate: "2026-02-01T00:00:00.000Z",
        endDate: "2026-02-28T23:59:59.999Z",
      });

      expect(analytics!.totalItems).toBe(2);
      expect(analytics!.totalValue).toBe(1700);
    });
  });
});
