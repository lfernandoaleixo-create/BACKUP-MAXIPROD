import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { stockReservations, sellerPermissions } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Tests for PO Reservation system:
 * - sales.createReservation (with fonte="po")
 * - sales.listReservations (filter by sellerId)
 * - sales.cancelReservation
 * - sales.getReservationSummary
 */

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

// Test seller data
const TEST_SELLER_ID = 99999;
const TEST_SELLER_NAME = "Vendedor Teste PO";

describe("PO Reservations", () => {
  let createdReservationIds: number[] = [];

  beforeAll(async () => {
    // Ensure test seller exists
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const existing = await db.select().from(sellerPermissions).where(eq(sellerPermissions.id, TEST_SELLER_ID)).limit(1);
    if (existing.length === 0) {
      await db.insert(sellerPermissions).values({
        id: TEST_SELLER_ID,
        sellerName: TEST_SELLER_NAME,
        gestorName: "Gestor Teste",
        authorized: true,
        password: "test123",
      });
    }
  });

  afterAll(async () => {
    // Clean up test reservations
    const db = await getDb();
    if (!db) return;
    for (const id of createdReservationIds) {
      await db.delete(stockReservations).where(eq(stockReservations.id, id));
    }
    // Clean up test seller
    await db.delete(sellerPermissions).where(eq(sellerPermissions.id, TEST_SELLER_ID));
  });

  it("creates a PO reservation successfully", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sales.createReservation({
      sellerId: TEST_SELLER_ID,
      sellerName: TEST_SELLER_NAME,
      codigoItem: "TEST001",
      descricaoItem: "Produto Teste PO",
      quantidadeCx: 50,
      clienteNome: "Cliente Teste",
      clienteCnpj: "12.345.678/0001-00",
      fonte: "po",
      poReferencia: "PO99",
      poDataEntrega: "15/06/2026",
      observacao: "Reserva de teste",
    });

    expect(result).toEqual({ success: true });
  });

  it("lists reservations for a seller", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const reservations = await caller.sales.listReservations({ sellerId: TEST_SELLER_ID });

    expect(reservations.length).toBeGreaterThanOrEqual(1);
    const testReservation = reservations.find(r => r.codigoItem === "TEST001" && r.fonte === "po");
    expect(testReservation).toBeDefined();
    expect(testReservation!.sellerName).toBe(TEST_SELLER_NAME);
    expect(testReservation!.quantidadeCx).toBe(50);
    expect(testReservation!.clienteNome).toBe("Cliente Teste");
    expect(testReservation!.poReferencia).toBe("PO99");
    expect(testReservation!.poDataEntrega).toBe("15/06/2026");
    expect(testReservation!.status).toBe("ativa");

    // Save ID for cleanup
    if (testReservation) createdReservationIds.push(testReservation.id);
  });

  it("lists all active reservations (no filter)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const all = await caller.sales.listReservations({});
    expect(Array.isArray(all)).toBe(true);
    // Should include our test reservation
    const found = all.find(r => r.codigoItem === "TEST001" && r.sellerId === TEST_SELLER_ID);
    expect(found).toBeDefined();
  });

  it("returns reservation summary grouped by product", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const summary = await caller.sales.getReservationSummary({ productCodes: ["TEST001"] });
    expect(summary).toBeDefined();
    expect(summary["TEST001"]).toBeGreaterThanOrEqual(50);
  });

  it("cancels a reservation", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Get the reservation ID
    const reservations = await caller.sales.listReservations({ sellerId: TEST_SELLER_ID });
    const testReservation = reservations.find(r => r.codigoItem === "TEST001" && r.fonte === "po");
    expect(testReservation).toBeDefined();

    const result = await caller.sales.cancelReservation({ id: testReservation!.id });
    expect(result).toEqual({ success: true });

    // Verify it's no longer in active list
    const afterCancel = await caller.sales.listReservations({ sellerId: TEST_SELLER_ID });
    const cancelled = afterCancel.find(r => r.id === testReservation!.id);
    expect(cancelled).toBeUndefined(); // Should not appear in active list

    // Track for cleanup (already cancelled but still in DB)
    if (!createdReservationIds.includes(testReservation!.id)) {
      createdReservationIds.push(testReservation!.id);
    }
  });

  it("creates a stock reservation (fonte=estoque)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sales.createReservation({
      sellerId: TEST_SELLER_ID,
      sellerName: TEST_SELLER_NAME,
      codigoItem: "TEST002",
      descricaoItem: "Produto Teste Estoque",
      quantidadeCx: 30,
      clienteNome: "Cliente Estoque",
      fonte: "estoque",
    });

    expect(result).toEqual({ success: true });

    // Get the ID for cleanup
    const reservations = await caller.sales.listReservations({ sellerId: TEST_SELLER_ID });
    const found = reservations.find(r => r.codigoItem === "TEST002");
    if (found) createdReservationIds.push(found.id);
  });
});
