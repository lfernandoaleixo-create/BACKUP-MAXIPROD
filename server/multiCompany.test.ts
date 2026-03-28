import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { stockItems, orderItems, purchaseOrderItems, salesOrders, scraperStatus, dashboardData } from "../drizzle/schema";

/**
 * Tests for multi-company data support
 * Verifies that the empresaDona/empresa fields are correctly populated
 * and that data from different companies is properly stored
 */

describe("Multi-Company Data Support", () => {
  let db: any;
  let backupStock: any[] = [];
  let backupOrders: any[] = [];
  let backupPOs: any[] = [];
  let backupSales: any[] = [];
  let backupDashboard: any[] = [];
  let backupStatus: any[] = [];

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Backup existing data
    backupStock = await db.select().from(stockItems);
    backupOrders = await db.select().from(orderItems);
    backupPOs = await db.select().from(purchaseOrderItems);
    backupSales = await db.select().from(salesOrders);
    backupDashboard = await db.select().from(dashboardData);
    backupStatus = await db.select().from(scraperStatus);
  });

  afterAll(async () => {
    if (!db) return;
    
    // Restore backup data
    await db.delete(stockItems);
    if (backupStock.length > 0) {
      for (let i = 0; i < backupStock.length; i += 50) {
        await db.insert(stockItems).values(backupStock.slice(i, i + 50));
      }
    }
    
    await db.delete(orderItems);
    if (backupOrders.length > 0) {
      for (let i = 0; i < backupOrders.length; i += 50) {
        await db.insert(orderItems).values(backupOrders.slice(i, i + 50));
      }
    }
    
    await db.delete(purchaseOrderItems);
    if (backupPOs.length > 0) {
      for (let i = 0; i < backupPOs.length; i += 50) {
        await db.insert(purchaseOrderItems).values(backupPOs.slice(i, i + 50));
      }
    }
    
    await db.delete(salesOrders);
    if (backupSales.length > 0) {
      for (let i = 0; i < backupSales.length; i += 50) {
        await db.insert(salesOrders).values(backupSales.slice(i, i + 50));
      }
    }
    
    await db.delete(dashboardData);
    if (backupDashboard.length > 0) {
      for (let i = 0; i < backupDashboard.length; i += 50) {
        await db.insert(dashboardData).values(backupDashboard.slice(i, i + 50));
      }
    }
  });

  it("should have empresaDona field in stock_items table", async () => {
    const items = await db.select().from(stockItems).limit(5);
    if (items.length > 0) {
      expect(items[0]).toHaveProperty("empresaDona");
    }
  });

  it("should have empresaDona field in order_items table", async () => {
    const items = await db.select().from(orderItems).limit(5);
    if (items.length > 0) {
      expect(items[0]).toHaveProperty("empresaDona");
    }
  });

  it("should have empresaDona field in purchase_order_items table", async () => {
    const items = await db.select().from(purchaseOrderItems).limit(5);
    if (items.length > 0) {
      expect(items[0]).toHaveProperty("empresaDona");
    }
  });

  it("should have empresa field in sales_orders table", async () => {
    const items = await db.select().from(salesOrders).limit(5);
    if (items.length > 0) {
      expect(items[0]).toHaveProperty("empresa");
    }
  });

  it("should store stock items with company name", async () => {
    // Insert a test stock item with company name
    await db.delete(stockItems);
    await db.insert(stockItems).values({
      codigoItem: "TEST001",
      descricaoItem: "VARETAS BAMBU 3.0 x 250 mm 10x5.000 UNID",
      quantidade: "5000",
      unidadeMedida: "UN",
      custoUnitario: "0.01",
      custoTotal: "50",
      codigoGrupo: "20",
      descricaoGrupo: "BAMBU IMPORTADO",
      codigoSuperGrupo: "12",
      descricaoSuperGrupo: "",
      empresaDona: "VARETAS INDUSTRIA",
      estoqueLocal: "Estoque",
      tipoDecodificado: "Próprio",
    });

    const items = await db.select().from(stockItems);
    expect(items.length).toBe(1);
    expect(items[0].empresaDona).toBe("VARETAS INDUSTRIA");
  });

  it("should store sales orders with company name", async () => {
    await db.delete(salesOrders);
    await db.insert(salesOrders).values({
      pedido: "TEST-PV-001",
      cliente: "Cliente Teste",
      descricao: "VARETAS BAMBU 3.0 x 250 mm",
      estadoItem: "A faturar",
      quantidade: "100",
      valorUnitario: "10",
      valorTotal: "1000",
      empresa: "ESPETOS INDUSTRIA",
    });

    const items = await db.select().from(salesOrders);
    expect(items.length).toBe(1);
    expect(items[0].empresa).toBe("ESPETOS INDUSTRIA");
  });

  it("should store purchase orders with company name", async () => {
    await db.delete(purchaseOrderItems);
    await db.insert(purchaseOrderItems).values({
      descricao: "ESPETO BAMBU 3.5 x 180 mm",
      quantidade: "500",
      unidadeMedida: "CX",
      dataEntrega: "2026-04-15",
      dataEmissao: "2026-03-01",
      estadoPedido: "A_RECEBER",
      estadoItem: "A_RECEBER",
      fornecedor: "Fornecedor China",
      valorTotal: "5000",
      valorUnitario: "10",
      numeroPedido: "PO-001",
      empresaDona: "MESA INDUSTRIA",
    });

    const items = await db.select().from(purchaseOrderItems);
    expect(items.length).toBe(1);
    expect(items[0].empresaDona).toBe("MESA INDUSTRIA");
  });

  it("should support all 4 company names", async () => {
    const validCompanies = [
      "PALITOS INDUSTRIA",
      "VARETAS INDUSTRIA",
      "ESPETOS INDUSTRIA",
      "MESA INDUSTRIA",
    ];

    await db.delete(stockItems);
    
    for (const company of validCompanies) {
      await db.insert(stockItems).values({
        codigoItem: `TEST-${company.substring(0, 3)}`,
        descricaoItem: `Produto teste ${company}`,
        quantidade: "100",
        unidadeMedida: "UN",
        custoUnitario: "1",
        custoTotal: "100",
        codigoGrupo: "20",
        descricaoGrupo: "BAMBU IMPORTADO",
        codigoSuperGrupo: "12",
        descricaoSuperGrupo: "",
        empresaDona: company,
        estoqueLocal: "Estoque",
        tipoDecodificado: "Próprio",
      });
    }

    const items = await db.select().from(stockItems);
    expect(items.length).toBe(4);
    
    const companies = items.map((i: any) => i.empresaDona);
    for (const company of validCompanies) {
      expect(companies).toContain(company);
    }
  });
});
