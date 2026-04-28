import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { accountsReceivable, collectionStepOverrides } from "../drizzle/schema";
import { eq } from "drizzle-orm";

function createPublicContext() {
  return { user: null } as any;
}

const caller = appRouter.createCaller(createPublicContext());

describe("Step Overrides (upsertStepOverride / getStepOverrides)", () => {
  let testReceivableId: number;
  let backedUpReceivables: any[] = [];
  let backedUpOverrides: any[] = [];

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Backup
    backedUpReceivables = await db.select().from(accountsReceivable);
    backedUpOverrides = await db.select().from(collectionStepOverrides);

    // Insert test receivable
    const [inserted] = await db.insert(accountsReceivable).values({
      maxiprodId: 999999,
      titulo: "TEST-STEP-OVERRIDE-001",
      cliente: "Cliente Teste Override",
      valorLiquido: "1000.00",
      valorRecebidoLiquido: "0.00",
      estado: "EMITIDO",
      vencimentoData: "2026-04-20",
      emissaoData: "2026-04-10",
      vendedor: "Teste",
    } as any);
    testReceivableId = inserted.insertId;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Cleanup test data
    await db.delete(collectionStepOverrides).where(eq(collectionStepOverrides.receivableId, testReceivableId));
    await db.delete(accountsReceivable).where(eq(accountsReceivable.id, testReceivableId));
  }, 30000);

  it("should return empty overrides for a title with no overrides", async () => {
    const result = await caller.financial.getStepOverrides({ receivableId: testReceivableId });
    expect(result.overrides).toBeDefined();
    expect(Object.keys(result.overrides)).toHaveLength(0);
  });

  it("should create a new step override", async () => {
    const result = await caller.financial.upsertStepOverride({
      receivableId: testReceivableId,
      step: 1,
      descricao: "Texto customizado para dia 1",
      motivo: "Motivo customizado",
      operatorName: "Thiago",
    });
    expect(result.success).toBe(true);
  });

  it("should retrieve the created override", async () => {
    const result = await caller.financial.getStepOverrides({ receivableId: testReceivableId });
    expect(result.overrides[1]).toBeDefined();
    expect(result.overrides[1].descricao).toBe("Texto customizado para dia 1");
    expect(result.overrides[1].motivo).toBe("Motivo customizado");
  });

  it("should update an existing override", async () => {
    const result = await caller.financial.upsertStepOverride({
      receivableId: testReceivableId,
      step: 1,
      descricao: "Texto atualizado",
      operatorName: "Guilherme",
    });
    expect(result.success).toBe(true);

    const overrides = await caller.financial.getStepOverrides({ receivableId: testReceivableId });
    expect(overrides.overrides[1].descricao).toBe("Texto atualizado");
    // motivo should remain from previous save
    expect(overrides.overrides[1].motivo).toBe("Motivo customizado");
  });

  it("should handle multiple steps independently", async () => {
    await caller.financial.upsertStepOverride({
      receivableId: testReceivableId,
      step: 3,
      descricao: "Dia 3 customizado",
      motivo: "Motivo dia 3",
      operatorName: "Flavio",
    });

    const overrides = await caller.financial.getStepOverrides({ receivableId: testReceivableId });
    expect(overrides.overrides[1]).toBeDefined();
    expect(overrides.overrides[3]).toBeDefined();
    expect(overrides.overrides[1].descricao).toBe("Texto atualizado");
    expect(overrides.overrides[3].descricao).toBe("Dia 3 customizado");
    // Step 2 should not exist
    expect(overrides.overrides[2]).toBeUndefined();
  });
});
