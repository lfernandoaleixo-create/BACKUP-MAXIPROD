import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { importSuppliers, importPos } from "../drizzle/schema";
import { eq } from "drizzle-orm";

function createContext(): TrpcContext {
  return { user: { id: "test-user", openId: "test", name: "Test", role: "admin" } } as any;
}

describe("Import PO Document Upload", () => {
  let testSupplierId: number | null = null;
  let testPoId: number | null = null;
  const caller = appRouter.createCaller(createContext());

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    // Create a test supplier
    const [sup] = await db.insert(importSuppliers).values({
      name: "Test Upload Supplier",
      displayOrder: 999,
      context: "custo",
    });
    testSupplierId = sup.insertId;
    // Create a test PO
    const [po] = await db.insert(importPos).values({
      supplierId: testSupplierId,
      poNumber: "PO-TEST-UPLOAD",
    });
    testPoId = po.insertId;
  });

  it("should upload a CI document to a PO", async () => {
    if (!testPoId) throw new Error("No test PO");
    // Create a small test file (fake PDF content as base64)
    const fakeContent = Buffer.from("fake PDF content for CI").toString("base64");
    const result = await caller.import.uploadPoDocument({
      poId: testPoId,
      type: "ci",
      fileBase64: fakeContent,
      fileName: "test-ci.pdf",
      mimeType: "application/pdf",
    });
    expect(result.url).toBeTruthy();
    expect(result.url).toContain("http");
    expect(result.field).toBe("pdfUrl");

    // Verify the PO was updated
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [po] = await db.select().from(importPos).where(eq(importPos.id, testPoId!));
    expect(po.pdfUrl).toBe(result.url);
  });

  it("should upload an Ordem de Pagamento document to a PO", async () => {
    if (!testPoId) throw new Error("No test PO");
    const fakeContent = Buffer.from("fake PDF content for OP").toString("base64");
    const result = await caller.import.uploadPoDocument({
      poId: testPoId,
      type: "ordemPagamento",
      fileBase64: fakeContent,
      fileName: "ordem-pagamento.pdf",
      mimeType: "application/pdf",
    });
    expect(result.url).toBeTruthy();
    expect(result.url).toContain("http");
    expect(result.field).toBe("pdfNotaCheiaUrl");

    // Verify the PO was updated
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [po] = await db.select().from(importPos).where(eq(importPos.id, testPoId!));
    expect(po.pdfNotaCheiaUrl).toBe(result.url);
  });

  it("should remove a CI document from a PO", async () => {
    if (!testPoId) throw new Error("No test PO");
    const result = await caller.import.removePoDocument({
      poId: testPoId,
      type: "ci",
    });
    expect(result.success).toBe(true);

    // Verify the PO was updated
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [po] = await db.select().from(importPos).where(eq(importPos.id, testPoId!));
    expect(po.pdfUrl).toBeNull();
  });

  it("should remove an Ordem de Pagamento document from a PO", async () => {
    if (!testPoId) throw new Error("No test PO");
    const result = await caller.import.removePoDocument({
      poId: testPoId,
      type: "ordemPagamento",
    });
    expect(result.success).toBe(true);

    // Verify the PO was updated
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [po] = await db.select().from(importPos).where(eq(importPos.id, testPoId!));
    expect(po.pdfNotaCheiaUrl).toBeNull();
  });

  // Cleanup
  it("cleanup test data", async () => {
    const db = await getDb();
    if (!db) return;
    if (testPoId) await db.delete(importPos).where(eq(importPos.id, testPoId));
    if (testSupplierId) await db.delete(importSuppliers).where(eq(importSuppliers.id, testSupplierId));
  });
});
