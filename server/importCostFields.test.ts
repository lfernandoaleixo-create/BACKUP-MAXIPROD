import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { importPos, importPoProducts } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

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

describe("importCostFields - valorCaixaBrl, precoMilUnid, unidCaixa", () => {
  const ctx = createContext();
  const caller = appRouter.createCaller(ctx);

  it("getPoProducts returns valorCaixaBrl, precoMilUnid, and unidCaixa fields", async () => {
    // Get PO65 which we know has data from the Excel import
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const po65 = await db.select().from(importPos).where(eq(importPos.poNumber, "PO65"));
    if (po65.length === 0) {
      // Skip if PO65 doesn't exist in this test env
      console.log("PO65 not found, skipping...");
      return;
    }

    const products = await caller.import.getPoProducts({ poId: po65[0].id });
    expect(products.length).toBeGreaterThan(0);

    // Check that the fields exist in the response
    const firstProduct = products[0];
    expect(firstProduct).toHaveProperty("valorCaixaBrl");
    expect(firstProduct).toHaveProperty("precoMilUnid");
    expect(firstProduct).toHaveProperty("unidCaixa");
  });

  it("PO65 products have non-null valorCaixaBrl values from Excel import", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const po65 = await db.select().from(importPos).where(eq(importPos.poNumber, "PO65"));
    if (po65.length === 0) {
      console.log("PO65 not found, skipping...");
      return;
    }

    const products = await caller.import.getPoProducts({ poId: po65[0].id });
    
    // All PO65 products should have valorCaixaBrl set from the Excel import
    const withValorCaixa = products.filter((p: any) => p.valorCaixaBrl && Number(p.valorCaixaBrl) > 0);
    expect(withValorCaixa.length).toBeGreaterThan(0);

    // Check that unidCaixa is set
    const withUnidCaixa = products.filter((p: any) => p.unidCaixa && Number(p.unidCaixa) > 0);
    expect(withUnidCaixa.length).toBeGreaterThan(0);

    // Check that precoMilUnid is set
    const withPrecoMil = products.filter((p: any) => p.precoMilUnid && Number(p.precoMilUnid) > 0);
    expect(withPrecoMil.length).toBeGreaterThan(0);
  });

  it("valorCaixaBrl values have correct precision (up to 6 decimal places)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const po65 = await db.select().from(importPos).where(eq(importPos.poNumber, "PO65"));
    if (po65.length === 0) {
      console.log("PO65 not found, skipping...");
      return;
    }

    const products = await caller.import.getPoProducts({ poId: po65[0].id });
    const withValorCaixa = products.filter((p: any) => p.valorCaixaBrl && Number(p.valorCaixaBrl) > 0);
    
    // Check that at least one product has more than 2 decimal places (proving 6dp precision)
    const hasHighPrecision = withValorCaixa.some((p: any) => {
      const val = String(p.valorCaixaBrl);
      const decimalPart = val.split('.')[1] || '';
      return decimalPart.length > 2;
    });
    expect(hasHighPrecision).toBe(true);
  });
});
