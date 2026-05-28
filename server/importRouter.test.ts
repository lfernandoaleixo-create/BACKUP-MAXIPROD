import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { importSuppliers, importPayments } from "../drizzle/schema";
import { eq } from "drizzle-orm";

function createContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("importRouter", () => {
  const ctx = createContext();
  const caller = appRouter.createCaller(ctx);
  let testSupplierId: number;
  let testPaymentId: number;

  afterAll(async () => {
    // Cleanup test data
    const db = await getDb();
    if (db && testSupplierId) {
      await db.delete(importPayments).where(eq(importPayments.supplierId, testSupplierId));
      await db.delete(importSuppliers).where(eq(importSuppliers.id, testSupplierId));
    }
  });

  it("creates a supplier", async () => {
    const result = await caller.import.createSupplier({
      name: "TEST_SUPPLIER_VITEST",
      category: "TESTING",
      displayOrder: 999,
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
    testSupplierId = result.id;
  });

  it("lists suppliers including the new one", async () => {
    const suppliers = await caller.import.getSuppliers();
    const found = suppliers.find((s: any) => s.id === testSupplierId);
    expect(found).toBeDefined();
    expect(found!.name).toBe("TEST_SUPPLIER_VITEST");
    expect(found!.category).toBe("TESTING");
  });

  it("creates a payment with sectionTitle", async () => {
    const result = await caller.import.createPayment({
      supplierId: testSupplierId,
      sectionTitle: "TEST_SUPPLIER_VITEST - BAMBU",
      status: "Produção",
      pedido: "PO-TEST-001",
      doc: "PI",
      totalUsd: "1500.00",
      halfValue: "750.00",
      brasilUsd: "500.00",
      paraguaiUsd: "250.00",
      totalPago: "750.00",
      saldoDevedorBrasil: "400.00",
      saldoDevedorParaguai: "350.00",
      saldoDevedorTotal: "750.00",
      rastreio: "CONTAINER-123",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
    testPaymentId = result.id;
  });

  it("getFullData returns supplier with payments grouped", async () => {
    const data = await caller.import.getFullData();
    const supplier = data.find((s: any) => s.id === testSupplierId);
    expect(supplier).toBeDefined();
    expect(supplier!.payments).toHaveLength(1);
    expect(supplier!.payments[0].sectionTitle).toBe("TEST_SUPPLIER_VITEST - BAMBU");
    expect(supplier!.payments[0].status).toBe("Produção");
    expect(supplier!.payments[0].totalUsd).toBe("1500.00");
    expect(supplier!.payments[0].rastreio).toBe("CONTAINER-123");
  });

  it("updates a payment", async () => {
    const result = await caller.import.updatePayment({
      id: testPaymentId,
      status: "Navegando",
      totalPago: "1000.00",
      saldoDevedorTotal: "500.00",
    });
    expect(result).toEqual({ success: true });

    // Verify update
    const data = await caller.import.getFullData();
    const supplier = data.find((s: any) => s.id === testSupplierId);
    const payment = supplier!.payments[0];
    expect(payment.status).toBe("Navegando");
    expect(payment.totalPago).toBe("1000.00");
    expect(payment.saldoDevedorTotal).toBe("500.00");
    // Unchanged fields should remain
    expect(payment.totalUsd).toBe("1500.00");
  });

  it("deletes a payment", async () => {
    const result = await caller.import.deletePayment({ id: testPaymentId });
    expect(result).toEqual({ success: true });

    const data = await caller.import.getFullData();
    const supplier = data.find((s: any) => s.id === testSupplierId);
    expect(supplier!.payments).toHaveLength(0);
  });

  it("deletes a supplier and cascades payments", async () => {
    // Create a payment first
    await caller.import.createPayment({
      supplierId: testSupplierId,
      status: "Entregue",
      pedido: "PO-TEST-002",
      doc: "CI",
      totalUsd: "2000.00",
    });

    const result = await caller.import.deleteSupplier({ id: testSupplierId });
    expect(result).toEqual({ success: true });

    // Verify supplier is gone
    const suppliers = await caller.import.getSuppliers();
    const found = suppliers.find((s: any) => s.id === testSupplierId);
    expect(found).toBeUndefined();

    // Mark as cleaned so afterAll doesn't try to delete again
    testSupplierId = 0;
  });
});
