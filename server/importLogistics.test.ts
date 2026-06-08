import { describe, it, expect, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { importSuppliers, importPos, importPoProducts } from "../drizzle/schema";
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

describe("importRouter - PO Logistics", () => {
  const ctx = createContext();
  const caller = appRouter.createCaller(ctx);
  let testSupplierId: number;
  let testPoId: number;

  afterAll(async () => {
    const db = await getDb();
    if (db && testPoId) {
      await db.delete(importPoProducts).where(eq(importPoProducts.poId, testPoId));
      await db.delete(importPos).where(eq(importPos.id, testPoId));
    }
    if (db && testSupplierId) {
      await db.delete(importSuppliers).where(eq(importSuppliers.id, testSupplierId));
    }
  });

  it("creates a supplier and PO for logistics test", async () => {
    const supplier = await caller.import.createSupplier({
      name: "TEST_LOGISTICS_SUPPLIER",
      category: "TEST",
      displayOrder: 998,
    });
    testSupplierId = supplier.id;
    expect(testSupplierId).toBeGreaterThan(0);

    const po = await caller.import.createPo({
      supplierId: testSupplierId,
      poNumber: "PO-LOGISTICS-TEST",
    });
    testPoId = po.id;
    expect(testPoId).toBeGreaterThan(0);
  });

  it("updatePoLogistics saves route fields", async () => {
    const result = await caller.import.updatePoLogistics({
      id: testPoId,
      portoChegada: "Santos - SP",
      cidadeDesembaraco: "Varginha - MG",
      localFinal: "Ribeirão Vermelho - MG",
    });
    expect(result).toEqual({ success: true });

    // Verify the data was saved
    const pos = await caller.import.getPosBySupplier({ supplierId: testSupplierId });
    const po = pos.find((p: any) => p.id === testPoId);
    expect(po).toBeDefined();
    expect(po!.portoChegada).toBe("Santos - SP");
    expect(po!.cidadeDesembaraco).toBe("Varginha - MG");
    expect(po!.localFinal).toBe("Ribeirão Vermelho - MG");
  });

  it("updatePoLogistics saves payment fields", async () => {
    const result = await caller.import.updatePoLogistics({
      id: testPoId,
      pagamento1Remessa: "15000.50",
      pagamento2Remessa: "12000.00",
      pagamento3Remessa: "8000.75",
      taxasRemessa: "350.00",
      despesasLiberacaoRemessa: "2500.00",
      freteTermestreRemessa: "4500.00",
      difalValor: "1200.00",
      comissaoSilverio: "800.00",
    });
    expect(result).toEqual({ success: true });

    const pos = await caller.import.getPosBySupplier({ supplierId: testSupplierId });
    const po = pos.find((p: any) => p.id === testPoId);
    expect(po!.pagamento1Remessa).toBe("15000.50");
    expect(po!.pagamento2Remessa).toBe("12000.00");
    expect(po!.pagamento3Remessa).toBe("8000.75");
    expect(po!.taxasRemessa).toBe("350.00");
    expect(po!.despesasLiberacaoRemessa).toBe("2500.00");
    expect(po!.freteTermestreRemessa).toBe("4500.00");
    expect(po!.difalValor).toBe("1200.00");
    expect(po!.comissaoSilverio).toBe("800.00");
  });

  it("updatePoLogistics saves exchange rate fields", async () => {
    const result = await caller.import.updatePoLogistics({
      id: testPoId,
      valorDolar1Remessa: "5.1234",
      valorDolar2Remessa: "5.2345",
      valorDolar3Remessa: "5.3456",
    });
    expect(result).toEqual({ success: true });

    const pos = await caller.import.getPosBySupplier({ supplierId: testSupplierId });
    const po = pos.find((p: any) => p.id === testPoId);
    expect(po!.valorDolar1Remessa).toBe("5.1234");
    expect(po!.valorDolar2Remessa).toBe("5.2345");
    expect(po!.valorDolar3Remessa).toBe("5.3456");
  });

  it("updatePoLogistics saves info fields (USD values)", async () => {
    const result = await caller.import.updatePoLogistics({
      id: testPoId,
      valorFreteMaritimoCnBr: "3500.00",
      totalCiRemessa: "45000.00",
      valorTotalProdutosUsdRemessa: "38000.00",
    });
    expect(result).toEqual({ success: true });

    const pos = await caller.import.getPosBySupplier({ supplierId: testSupplierId });
    const po = pos.find((p: any) => p.id === testPoId);
    expect(po!.valorFreteMaritimoCnBr).toBe("3500.00");
    expect(po!.totalCiRemessa).toBe("45000.00");
    expect(po!.valorTotalProdutosUsdRemessa).toBe("38000.00");
  });

  it("updatePoLogistics clears fields when null is passed", async () => {
    const result = await caller.import.updatePoLogistics({
      id: testPoId,
      portoChegada: null,
      pagamento1Remessa: null,
    });
    expect(result).toEqual({ success: true });

    const pos = await caller.import.getPosBySupplier({ supplierId: testSupplierId });
    const po = pos.find((p: any) => p.id === testPoId);
    expect(po!.portoChegada).toBeNull();
    expect(po!.pagamento1Remessa).toBeNull();
    // Other fields should remain unchanged
    expect(po!.cidadeDesembaraco).toBe("Varginha - MG");
    expect(po!.comissaoSilverio).toBe("800.00");
  });

  it("getExchangeRate returns real-time USD/BRL rate", async () => {
    const result = await caller.import.getExchangeRate();
    expect(result).toHaveProperty("rate");
    expect(result).toHaveProperty("source");
    expect(result).toHaveProperty("timestamp");
    expect(typeof result.rate).toBe("number");
    expect(result.rate).toBeGreaterThan(3); // USD/BRL should be > 3
    expect(result.rate).toBeLessThan(10); // and < 10 (sanity check)
    expect(result.source).toMatch(/BCB|AwesomeAPI|fallback/);
  }, 30000);
});
