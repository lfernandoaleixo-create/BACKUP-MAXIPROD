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

  it("should mark all action days as vermelho when no actions registered (cascade)", async () => {
    // testId is overdue 10 days with no actions registered
    const result = await caller.financial.getCollectionChecklist({ receivableId: testId });

    // Dia 1 (acao) should be vermelho (no action registered, day passed)
    const dia1 = result.steps.find((s: any) => s.dia === 1);
    expect(dia1).toBeDefined();
    expect(dia1!.status).toBe("vermelho");

    // Dia 3 (acao) should also be vermelho (cascade from dia 1)
    const dia3 = result.steps.find((s: any) => s.dia === 3);
    expect(dia3).toBeDefined();
    expect(dia3!.status).toBe("vermelho");

    // Dia 5 (acao) should also be vermelho (cascade)
    const dia5 = result.steps.find((s: any) => s.dia === 5);
    expect(dia5).toBeDefined();
    expect(dia5!.status).toBe("vermelho");

    // Wait days (2, 4, 6) should also be vermelho (cascade)
    const dia2 = result.steps.find((s: any) => s.dia === 2);
    expect(dia2!.status).toBe("vermelho");
    const dia4 = result.steps.find((s: any) => s.dia === 4);
    expect(dia4!.status).toBe("vermelho");
    const dia6 = result.steps.find((s: any) => s.dia === 6);
    expect(dia6!.status).toBe("vermelho");
  });

  it("should mark dia 1 as verde when manual action is registered on that date", async () => {
    const db = await getDb();
    if (!db) return;

    // Get the vencimento date to calculate dia 1 date
    const [rec] = await db.select().from(accountsReceivable).where(eq(accountsReceivable.id, testId));
    const vencDate = (rec.vencimentoData || "").split("T")[0];
    const dia1Date = new Date(new Date(vencDate).getTime() + 1 * 86400000).toISOString().split("T")[0];

    // Insert a manual action on dia 1
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
    expect(dia1!.status).toBe("verde");
    expect(dia1!.acoes.length).toBeGreaterThanOrEqual(1);
    expect(dia1!.acoes[0].tipo).toBe("whatsapp");

    // Dia 2 (espera) should be verde (no cascade error yet)
    const dia2 = result.steps.find((s: any) => s.dia === 2);
    expect(dia2!.status).toBe("verde");
  });

  it("should cascade error from dia 3 when no action on dia 3", async () => {
    // Dia 1 has action (from previous test), dia 3 has no action
    const result = await caller.financial.getCollectionChecklist({ receivableId: testId });

    // Dia 3 should be vermelho (no action)
    const dia3 = result.steps.find((s: any) => s.dia === 3);
    expect(dia3!.status).toBe("vermelho");

    // Dia 4 should be vermelho (cascade from dia 3)
    const dia4 = result.steps.find((s: any) => s.dia === 4);
    expect(dia4!.status).toBe("vermelho");

    // Dia 5 should be vermelho (cascade)
    const dia5 = result.steps.find((s: any) => s.dia === 5);
    expect(dia5!.status).toBe("vermelho");
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

    // Dia 1 should be pendente or vermelho (today or past)
    const dia1 = result.steps.find((s: any) => s.dia === 1);
    expect(["pendente", "vermelho"]).toContain(dia1!.status);

    // Dias 2-7 should be futuro
    for (let d = 2; d <= 7; d++) {
      const step = result.steps.find((s: any) => s.dia === d);
      expect(step!.status).toBe("futuro");
    }

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
      expect(["verde", "vermelho", "pendente", "futuro"]).toContain(step.status);
      expect(["acao", "espera", "decisao"]).toContain(step.tipo);
    }
  });
});
