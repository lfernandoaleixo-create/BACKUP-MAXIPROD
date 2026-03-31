/**
 * Tests for Amostra/Bonificação card data in getAnalytics
 */
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

let backupSalesOrders: any[] = [];

describe("sales amostra/bonificação card", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);

  beforeAll(async () => {
    const db = await getDb();
    if (db) {
      backupSalesOrders = await db.select().from(salesOrders);
      await db.delete(salesOrders);
    }

    // Ingest test data with mix of regular and amostra/bonificação items
    await caller.sales.ingestSalesOrders({
      items: [
        // Regular items (should be in totalValue, NOT in amostraBonif)
        {
          pedido: "P001",
          item: "1",
          dataEmissao: "2026-03-15T12:00:00.000-03:00",
          cliente: "Cliente A",
          produto: "Produto 1",
          valorTotal: 10000,
          estadoItem: "Faturado",
          estadoNota: "Aprovado",
          estadoConfiguravel: "BAMBU",
          uf: "SP",
          crmSegmento: "DISTRIBUIDORA",
        },
        {
          pedido: "P002",
          item: "1",
          dataEmissao: "2026-03-20T12:00:00.000-03:00",
          cliente: "Cliente B",
          produto: "Produto 2",
          valorTotal: 5000,
          estadoItem: "A faturar",
          estadoNota: "Aprovado",
          estadoConfiguravel: "FIBRA",
          uf: "RJ",
          crmSegmento: "LOJA",
        },
        // AMOSTRA item (should be in amostraBonif, NOT in totalValue)
        {
          pedido: "P003",
          item: "1",
          dataEmissao: "2026-03-10T12:00:00.000-03:00",
          cliente: "Cliente C",
          produto: "Produto 3",
          valorTotal: 200,
          estadoItem: "Faturado",
          estadoNota: "Aprovado",
          estadoConfiguravel: "AMOSTRA",
          uf: "MG",
          crmSegmento: "DISTRIBUIDORA",
        },
        // BONIFICAÇÃO items (should be in amostraBonif, NOT in totalValue)
        {
          pedido: "P004",
          item: "1",
          dataEmissao: "2026-03-12T12:00:00.000-03:00",
          cliente: "Cliente D",
          produto: "Produto 4",
          valorTotal: 800,
          estadoItem: "Faturado",
          estadoNota: "Aprovado",
          estadoConfiguravel: "BONIFICAÇÃO",
          uf: "SP",
          crmSegmento: "LOJA",
        },
        {
          pedido: "P005",
          item: "1",
          dataEmissao: "2026-03-18T12:00:00.000-03:00",
          cliente: "Cliente E",
          produto: "Produto 5",
          valorTotal: 500,
          estadoItem: "Faturado",
          estadoNota: "Aprovado",
          estadoConfiguravel: "BONIFICAÇÃO",
          uf: "PR",
          crmSegmento: "DISTRIBUIDORA",
        },
      ],
    });
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

  it("returns totalAmostraBonif separate from totalValue", async () => {
    const result = await caller.sales.getAnalytics({
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      team: "all",
      grupo: "all",
      subgrupo: "all",
      crmSegmento: "all",
    });

    // totalValue should only include regular items (BAMBU + FIBRA = 10000 + 5000)
    expect(result.totalValue).toBe(15000);

    // totalAmostraBonif should include AMOSTRA + BONIFICAÇÃO = 200 + 800 + 500
    expect(result.totalAmostraBonif).toBe(1500);

    // Breakdown
    expect(result.totalAmostra).toBe(200);
    expect(result.totalBonificacao).toBe(1300); // 800 + 500

    // Pedidos count
    expect(result.pedidosAmostraBonif).toBe(3); // P003, P004, P005
  });

  it("returns zero amostraBonif when no such items exist in range", async () => {
    const result = await caller.sales.getAnalytics({
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      team: "all",
      grupo: "all",
      subgrupo: "all",
      crmSegmento: "all",
    });

    expect(result.totalAmostraBonif).toBe(0);
    expect(result.totalAmostra).toBe(0);
    expect(result.totalBonificacao).toBe(0);
    expect(result.pedidosAmostraBonif).toBe(0);
  });

  it("amostraBonif percentage is correct relative to totalValue", async () => {
    const result = await caller.sales.getAnalytics({
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      team: "all",
      grupo: "all",
      subgrupo: "all",
      crmSegmento: "all",
    });

    // Percentage = amostraBonif / totalValue * 100 = 1500 / 15000 * 100 = 10%
    const pct = (result.totalAmostraBonif / (result.totalValue || 1)) * 100;
    expect(pct).toBeCloseTo(10, 1);
  });
});
