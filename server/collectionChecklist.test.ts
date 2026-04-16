import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { accountsReceivable, collectionActions, collectionDailyActions } from "../drizzle/schema";
import { eq } from "drizzle-orm";

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

// Helper: create a receivable with vencimento N days ago
function makeReceivable(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const vencStr = d.toISOString().split("T")[0] + "T00:00:00";
  return {
    maxiprodId: 88800 + Math.floor(Math.random() * 10000),
    estado: "EMITIDO",
    tipo: "TITULO",
    valorOriginal: "1000.00",
    valorLiquido: "1000.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorRecebidoLiquido: "0.00",
    emissaoData: "2026-01-01T00:00:00",
    vencimentoData: vencStr,
    vencimentoOriginalData: vencStr,
    referenteA: "CHECKLIST TEST ref. NF 999",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    cliente: "CLIENTE CHECKLIST TEST",
    empresaNome: "PALITOS INDUSTRIA",
  };
}

let backupReceivables: any[] = [];
let backupCollectionActions: any[] = [];
let backupDailyActions: any[] = [];

describe("getCollectionChecklist", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);
  let testId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) return;
    // Backup
    backupReceivables = await db.select().from(accountsReceivable);
    backupCollectionActions = await db.select().from(collectionActions);
    backupDailyActions = await db.select().from(collectionDailyActions);
    // Clear
    await db.delete(collectionDailyActions);
    await db.delete(collectionActions);
    await db.delete(accountsReceivable);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    // Clean up
    await db.delete(collectionDailyActions);
    await db.delete(collectionActions);
    await db.delete(accountsReceivable);
    // Restore
    if (backupReceivables.length > 0) {
      for (let i = 0; i < backupReceivables.length; i += 200) {
        await db.insert(accountsReceivable).values(backupReceivables.slice(i, i + 200));
      }
    }
    if (backupCollectionActions.length > 0) {
      await db.insert(collectionActions).values(backupCollectionActions);
    }
    if (backupDailyActions.length > 0) {
      for (let i = 0; i < backupDailyActions.length; i += 200) {
        await db.insert(collectionDailyActions).values(backupDailyActions.slice(i, i + 200));
      }
    }
  });

  it("should return 7 steps for a title overdue by 10 days", async () => {
    const db = await getDb();
    if (!db) return;
    const [inserted] = await db.insert(accountsReceivable).values(makeReceivable(10) as any).$returningId();
    testId = inserted.id;

    const result = await caller.financial.getCollectionChecklist({ receivableId: testId });
    expect(result.steps).toBeDefined();
    expect(result.steps.length).toBe(7);
    expect(result.cliente).toBe("CLIENTE CHECKLIST TEST");
    expect(result.diasAtraso).toBeGreaterThanOrEqual(10);
  });

  it("should mark all action days as dispensado when no actions registered and all days before system start", async () => {
    // testId is overdue 10 days with no actions registered
    // All 7 days of the roteiro fall before 2026-04-16 (system start)
    // so they should all be 'dispensado' instead of 'vermelho'
    const result = await caller.financial.getCollectionChecklist({ receivableId: testId });

    // All days should be dispensado (vencimento ~10 days ago, all roteiro days before system start)
    for (const step of result.steps as any[]) {
      expect(step.status).toBe("dispensado");
      expect(step.motivo).toContain("Dispensado");
    }
  });

  it("should mark dia 1 as dispensado with retroactive action note when action registered before system start", async () => {
    const db = await getDb();
    if (!db) return;

    // Get the vencimento date to calculate dia 1 date
    const [rec] = await db.select().from(accountsReceivable).where(eq(accountsReceivable.id, testId));
    const vencDate = (rec.vencimentoData || "").split("T")[0];
    const dia1Date = new Date(new Date(vencDate).getTime() + 1 * 86400000).toISOString().split("T")[0];

    // Insert a manual action on dia 1 (before system start)
    await db.insert(collectionDailyActions).values({
      receivableId: testId,
      actionDate: dia1Date,
      actionType: "whatsapp",
      isAutomatic: false,
      operatorName: "Thiago",
      notes: "Enviou WhatsApp",
    });

    const result = await caller.financial.getCollectionChecklist({ receivableId: testId });
    const dia1 = result.steps.find((s: any) => s.dia === 1);
    // Before system start, so dispensado (even with action)
    expect(dia1!.status).toBe("dispensado");
    expect(dia1!.motivo).toContain("retroativamente");
    expect(dia1!.acoes.length).toBeGreaterThanOrEqual(1);
    expect(dia1!.acoes[0].tipo).toBe("whatsapp");

    // Dia 2 (espera, also before system start) should be dispensado
    const dia2 = result.steps.find((s: any) => s.dia === 2);
    expect(dia2!.status).toBe("dispensado");
  });

  it("should NOT cascade error from dispensado days", async () => {
    // All days are before system start, so all should be dispensado
    // No cascade of vermelho from dispensado days
    const result = await caller.financial.getCollectionChecklist({ receivableId: testId });

    // No step should be vermelho (all are dispensado because before system start)
    for (const step of result.steps as any[]) {
      expect(step.status).not.toBe("vermelho");
    }
  });

  it("should show acoes details in step when actions exist", async () => {
    const result = await caller.financial.getCollectionChecklist({ receivableId: testId });
    const dia1 = result.steps.find((s: any) => s.dia === 1);
    expect(dia1!.acoes).toBeDefined();
    expect(dia1!.acoes.length).toBeGreaterThanOrEqual(1);
    expect(dia1!.acoes[0].operador).toBe("Thiago");
    expect(dia1!.acoes[0].notas).toBe("Enviou WhatsApp");
  });

  it("should return future status for days not yet reached", async () => {
    const db = await getDb();
    if (!db) return;

    // Create a receivable overdue by only 1 day
    const [newRec] = await db.insert(accountsReceivable).values(makeReceivable(1) as any).$returningId();

    const result = await caller.financial.getCollectionChecklist({ receivableId: newRec.id });

    // Dia 1 should be pendente, vermelho, or dispensado (today, past, or before system start)
    const dia1 = result.steps.find((s: any) => s.dia === 1);
    expect(["pendente", "vermelho", "dispensado"]).toContain(dia1!.status);

    // Dias 2-7 should be futuro
    for (let d = 2; d <= 7; d++) {
      const step = result.steps.find((s: any) => s.dia === d);
      expect(step!.status).toBe("futuro");
    }

    // Clean up
    await db.delete(accountsReceivable).where(eq(accountsReceivable.id, newRec.id));
  });

  it("should mark days before system start (16/04/2026) as dispensado, not vermelho", async () => {
    const db = await getDb();
    if (!db) return;

    // Create a receivable with vencimento on 2026-04-14 (2 days before system start)
    // So dia 1 = 2026-04-15 (before system start), dia 2 = 2026-04-16 (system start day)
    const vencStr = "2026-04-14T00:00:00";
    const [newRec] = await db.insert(accountsReceivable).values({
      maxiprodId: 88800 + Math.floor(Math.random() * 10000),
      estado: "EMITIDO",
      tipo: "TITULO",
      valorOriginal: "500.00",
      valorLiquido: "500.00",
      valorRetido: "0.00",
      valorDeDesconto: "0.00",
      valorDeAcrescimo: "0.00",
      valorRecebidoLiquido: "0.00",
      emissaoData: "2026-01-01T00:00:00",
      vencimentoData: vencStr,
      vencimentoOriginalData: vencStr,
      referenteA: "DISPENSADO TEST ref. NF 888",
      parcela: 1,
      parcelasQuantidadeTotal: 1,
      cliente: "CLIENTE DISPENSADO TEST",
      empresaNome: "PALITOS INDUSTRIA",
    } as any).$returningId();

    const result = await caller.financial.getCollectionChecklist({ receivableId: newRec.id });

    // Dia 1 = 2026-04-15 (before system start) should be dispensado
    const dia1 = result.steps.find((s: any) => s.dia === 1);
    expect(dia1!.status).toBe("dispensado");
    expect(dia1!.motivo).toContain("Dispensado");
    expect(dia1!.motivo).toContain("16/04");

    // Dia 2 = 2026-04-16 (system start day) should NOT be dispensado
    // It should be verde (espera day, no cascade from dispensado)
    const dia2 = result.steps.find((s: any) => s.dia === 2);
    expect(dia2!.status).not.toBe("dispensado");
    expect(dia2!.status).not.toBe("vermelho"); // No cascade from dispensado

    // Clean up
    await db.delete(accountsReceivable).where(eq(accountsReceivable.id, newRec.id));
  });

  it("should return empty steps for non-existent receivable", async () => {
    const result = await caller.financial.getCollectionChecklist({ receivableId: 999999 });
    expect(result.steps).toEqual([]);
    expect(result.startDate).toBeNull();
  });

  it("should include correct data fields (vencimento, diasAtraso, valorAReceber)", async () => {
    const result = await caller.financial.getCollectionChecklist({ receivableId: testId });
    expect(result.vencimento).toBeDefined();
    expect(typeof result.vencimento).toBe("string");
    expect(result.vencimento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof result.diasAtraso).toBe("number");
    expect(result.diasAtraso).toBeGreaterThanOrEqual(10);
    expect(typeof result.valorAReceber).toBe("number");
    expect(result.valorAReceber).toBe(1000);
  });

  it("each step should have required fields", async () => {
    const result = await caller.financial.getCollectionChecklist({ receivableId: testId });
    for (const step of result.steps as any[]) {
      expect(step).toHaveProperty("dia");
      expect(step).toHaveProperty("label");
      expect(step).toHaveProperty("tipo");
      expect(step).toHaveProperty("descricao");
      expect(step).toHaveProperty("data");
      expect(step).toHaveProperty("status");
      expect(step).toHaveProperty("motivo");
      expect(step).toHaveProperty("acoes");
      expect(step).toHaveProperty("isToday");
      expect(step).toHaveProperty("isFuture");
      expect(["verde", "vermelho", "pendente", "futuro", "dispensado"]).toContain(step.status);
      expect(["acao", "espera", "decisao"]).toContain(step.tipo);
    }
  });
});
