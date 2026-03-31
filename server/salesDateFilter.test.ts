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

/**
 * Test that date filtering uses YYYY-MM-DD substring comparison,
 * ensuring records from the last day of the month are included
 * regardless of timezone offset in the stored dataEmissao.
 */

// Sample items with various timezone formats for the same day (31/03)
const sampleItems = [
  {
    dataEmissao: "2026-03-31T12:00:00.000-03:00", // BRT format (from Maxiprod)
    pedido: "900",
    cliente: "CLIENTE DIA31 BRT",
    clienteApelido: "CLI31 BRT",
    uf: "SP",
    descricao: "ESPETO DE BAMBU 4,0 X 250 MM",
    estadoItem: "A faturar",
    quantidade: 10,
    valorTotal: 500,
    estadoConfiguravel: "BAMBU",
    estadoNota: "Aprovado",
    crmSegmento: "DISTRIBUIDORA",
  },
  {
    dataEmissao: "2026-03-31T15:00:00.000Z", // UTC format
    pedido: "901",
    cliente: "CLIENTE DIA31 UTC",
    clienteApelido: "CLI31 UTC",
    uf: "MG",
    descricao: "VARETA AROMATIZADOR 4,0 X 250 MM",
    estadoItem: "Faturado",
    quantidade: 20,
    valorTotal: 1200,
    estadoConfiguravel: "BAMBU",
    estadoNota: "Aprovado",
    crmSegmento: "DISTRIBUIDORA",
  },
  {
    dataEmissao: "2026-03-01T12:00:00.000-03:00", // First day of month
    pedido: "902",
    cliente: "CLIENTE DIA01",
    clienteApelido: "CLI01",
    uf: "RJ",
    descricao: "ESPETO DE BAMBU 3,0 X 200 MM",
    estadoItem: "A faturar",
    quantidade: 5,
    valorTotal: 250,
    estadoConfiguravel: "BAMBU",
    estadoNota: "Aprovado",
    crmSegmento: "LOJA",
  },
  {
    dataEmissao: "2026-02-28T12:00:00.000-03:00", // Previous month
    pedido: "903",
    cliente: "CLIENTE FEV",
    clienteApelido: "CLI FEV",
    uf: "PR",
    descricao: "ESPETO DE BAMBU 4,0 X 300 MM",
    estadoItem: "Faturado",
    quantidade: 15,
    valorTotal: 800,
    estadoConfiguravel: "BAMBU",
    estadoNota: "Aprovado",
    crmSegmento: "DISTRIBUIDORA",
  },
];

let backupSalesOrders: any[] = [];

describe("sales date filter - end of month inclusion", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);

  beforeAll(async () => {
    const db = await getDb();
    if (db) {
      backupSalesOrders = await db.select().from(salesOrders);
      await db.delete(salesOrders);
      await caller.sales.ingestSalesOrders({ items: sampleItems });
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

  it("includes records from the last day of month (31/03) with YYYY-MM-DD range", async () => {
    const analytics = await caller.sales.getAnalytics({
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    });

    expect(analytics).not.toBeNull();
    // Should include pedidos 900, 901, 902 (all March) but NOT 903 (February)
    expect(analytics!.totalItems).toBe(3);
    expect(analytics!.totalValue).toBe(1950); // 500 + 1200 + 250
  });

  it("includes records from 31/03 even with ISO-style dates", async () => {
    const analytics = await caller.sales.getAnalytics({
      startDate: "2026-03-01T00:00:00.000Z",
      endDate: "2026-03-31T23:59:59.999Z",
    });

    expect(analytics).not.toBeNull();
    // substring(0,10) extracts "2026-03-01" and "2026-03-31" correctly
    expect(analytics!.totalItems).toBe(3);
    expect(analytics!.totalValue).toBe(1950);
  });

  it("excludes records from previous month", async () => {
    const analytics = await caller.sales.getAnalytics({
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    });

    // Pedido 903 (Feb 28) should NOT be included
    const clients = analytics!.byClient.map((c: any) => c.name);
    expect(clients).not.toContain("CLIENTE FEV");
  });

  it("includes only February when filtering for Feb", async () => {
    const analytics = await caller.sales.getAnalytics({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });

    expect(analytics!.totalItems).toBe(1);
    expect(analytics!.totalValue).toBe(800);
  });

  it("getOrders includes last day of month records", async () => {
    const orders = await caller.sales.getOrders({
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    });

    expect(orders).not.toBeNull();
    // Should include 3 orders from March (pedidos 900, 901, 902)
    const pedidos = orders!.map((o: any) => o.pedido);
    expect(pedidos).toContain("900");
    expect(pedidos).toContain("901");
    expect(pedidos).toContain("902");
    expect(pedidos).not.toContain("903");
  });

  it("handles BRT timezone offset in dataEmissao correctly", async () => {
    // The key test: dataEmissao "2026-03-31T12:00:00.000-03:00" 
    // starts with "2026-03-31" so SUBSTRING(1,10) = "2026-03-31" <= "2026-03-31" ✓
    const analytics = await caller.sales.getAnalytics({
      startDate: "2026-03-31",
      endDate: "2026-03-31",
    });

    expect(analytics).not.toBeNull();
    // Should include both pedidos 900 and 901 (both from 31/03)
    expect(analytics!.totalItems).toBe(2);
    expect(analytics!.totalValue).toBe(1700); // 500 + 1200
  });
});
