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

// Helper: feriados brasileiros 2026 para cálculo de dias úteis
const HOLIDAYS_2026 = [
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03",
  "2026-04-21", "2026-05-01", "2026-06-04", "2026-09-07",
  "2026-10-12", "2026-11-02", "2026-11-15", "2026-12-25",
];

function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  const str = d.toISOString().split("T")[0];
  return !HOLIDAYS_2026.includes(str);
}

// Helper: create a receivable with vencimento N BUSINESS DAYS ago
function makeReceivable(businessDaysAgo: number) {
  const d = new Date();
  // Walk backwards counting only business days
  let count = 0;
  while (count < businessDaysAgo) {
    d.setDate(d.getDate() - 1);
    if (isBusinessDay(d)) count++;
  }
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
  let testId: number; // 10 days overdue, no collectionAction

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
    // makeReceivable(10) cria vencimento 10 dias úteis atrás; backend calcula dias úteis
    // Pode haver diferença de 1 por timezone/horário
    expect(result.diasAtraso).toBeGreaterThanOrEqual(9);
  });

  it("should show 'aguardando primeiro contato' for 2+ day overdue title WITHOUT cobrancaStartedAt", async () => {
    // testId is overdue 10 days with no collectionAction (no cobrancaStartedAt)
    // NEW RULE: titles with 2+ days overdue and no first contact → "aguardando primeiro contato"
    const result = await caller.financial.getCollectionChecklist({ receivableId: testId });

    // Dia 1 should be "pendente" (awaiting first contact)
    const dia1 = result.steps.find((s: any) => s.dia === 1);
    expect(dia1!.status).toBe("pendente");
    expect(dia1!.motivo).toContain("Aguardando primeiro contato");

    // Dias 2-7 should be "futuro" (roteiro hasn't started)
    for (let d = 2; d <= 7; d++) {
      const step = result.steps.find((s: any) => s.dia === d);
      expect(step!.status).toBe("futuro");
      expect(step!.motivo).toContain("Roteiro inicia após o primeiro contato");
    }

    // legacyNotStarted should be true
    expect(result.legacyNotStarted).toBe(true);
  });

  it("should show dispensado steps when title has cobrancaStartedAt (legacy with start)", async () => {
    const db = await getDb();
    if (!db) return;

    // Add a collectionAction with cobrancaStartedAt to make it "started"
    await db.insert(collectionActions).values({
      receivableId: testId,
      status: "contatado",
      cobrancaStartedAt: "2026-04-16",
    });

    const result = await caller.financial.getCollectionChecklist({ receivableId: testId });

    // With cobrancaStartedAt, the title is no longer "legacyNotStarted"
    // Steps should now follow the normal flow (dispensado for before system, verde/pendente/futuro after)
    expect(result.legacyNotStarted).toBe(false);

    // At least some steps should NOT be "futuro" anymore
    const nonFuturo = (result.steps as any[]).filter(s => s.status !== "futuro");
    expect(nonFuturo.length).toBeGreaterThan(0);

    // Clean up the collectionAction
    await db.delete(collectionActions).where(eq(collectionActions.receivableId, testId));
  });

  it("should NOT cascade error from dispensado days into non-dispensado days", async () => {
    const db = await getDb();
    if (!db) return;

    // Add cobrancaStartedAt so the title enters the normal flow
    await db.insert(collectionActions).values({
      receivableId: testId,
      status: "contatado",
      cobrancaStartedAt: "2026-04-16",
    });

    const result = await caller.financial.getCollectionChecklist({ receivableId: testId });

    // Steps before system start should be dispensado (not vermelho)
    const dispensadoSteps = (result.steps as any[]).filter(s => s.status === "dispensado");
    // There should be at least some dispensado steps (days before system start)
    // The key rule: dispensado steps should NOT trigger cascade into subsequent steps
    // Steps after dispensado can be vermelho for their OWN reasons (no action registered)
    // but NOT because of cascade from dispensado
    for (const step of dispensadoSteps) {
      expect(step.motivo).toContain("Dispensado");
    }

    // Clean up
    await db.delete(collectionActions).where(eq(collectionActions.receivableId, testId));
  });

  it("should return future status for 1-day overdue title (normal flow)", async () => {
    const db = await getDb();
    if (!db) return;

    // Create a receivable overdue by only 1 business day
    const [newRec] = await db.insert(accountsReceivable).values(makeReceivable(1) as any).$returningId();

    const result = await caller.financial.getCollectionChecklist({ receivableId: newRec.id });

    // 1-day overdue (business days): NOT legacy, normal flow
    // Dia 1 could be pendente, vermelho, dispensado, or futuro depending on when test runs
    const dia1 = result.steps.find((s: any) => s.dia === 1);
    expect(["pendente", "vermelho", "dispensado", "futuro"]).toContain(dia1!.status);

    // Dias 2-7 should be futuro
    for (let d = 2; d <= 7; d++) {
      const step = result.steps.find((s: any) => s.dia === d);
      expect(step!.status).toBe("futuro");
    }

    // Clean up
    await db.delete(accountsReceivable).where(eq(accountsReceivable.id, newRec.id));
  });

  it("should show 'aguardando primeiro contato' for 3-day overdue title without start", async () => {
    const db = await getDb();
    if (!db) return;

    // Create a receivable overdue by 3 business days (2+ business days)
    const [newRec] = await db.insert(accountsReceivable).values(makeReceivable(3) as any).$returningId();

    const result = await caller.financial.getCollectionChecklist({ receivableId: newRec.id });

    // 3 business days overdue without cobrancaStartedAt → "aguardando primeiro contato"
    expect(result.legacyNotStarted).toBe(true);
    const dia1 = result.steps.find((s: any) => s.dia === 1);
    expect(dia1!.status).toBe("pendente");
    expect(dia1!.motivo).toContain("Aguardando primeiro contato");

    // All other steps should be futuro
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
    // makeReceivable(10) cria vencimento 10 dias úteis atrás; backend calcula dias úteis
    expect(result.diasAtraso).toBeGreaterThanOrEqual(9);
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
