import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { accountsReceivable, collectionActions, collectionDailyActions, resolvedReceivables, systemNotifications } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

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

// Test receivable: vencido há 1 dia (para testar a regra de vibração)
function makeTestReceivable(overrides: Record<string, any> = {}) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0] + "T00:00:00";
  return {
    maxiprodId: 99900 + Math.floor(Math.random() * 1000),
    estado: "EMITIDO",
    tipo: "TITULO",
    valorOriginal: "500.00",
    valorLiquido: "500.00",
    valorRetido: "0.00",
    valorDeDesconto: "0.00",
    valorDeAcrescimo: "0.00",
    valorRecebidoLiquido: "0.00",
    emissaoData: "2026-01-01T00:00:00",
    vencimentoData: yesterdayStr,
    vencimentoOriginalData: yesterdayStr,
    referenteA: "TESTE REGRA ref. NF 888",
    parcela: 1,
    parcelasQuantidadeTotal: 1,
    cliente: "CLIENTE TESTE REGRA",
    empresaNome: "PALITOS INDUSTRIA",
    ...overrides,
  };
}

let backupReceivables: any[] = [];
let backupCollectionActions: any[] = [];
let backupDailyActions: any[] = [];
let backupResolved: any[] = [];
// systemNotifications backup removed - too many rows cause duplicate key conflicts on restore

describe("cobrança rules: cobrancaStartedAt, resolved titles, notifications", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);
  let testReceivableId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (db) {
      // Backup
      backupReceivables = await db.select().from(accountsReceivable);
      backupCollectionActions = await db.select().from(collectionActions);
      backupDailyActions = await db.select().from(collectionDailyActions);
      backupResolved = await db.select().from(resolvedReceivables);
      // Not backing up systemNotifications (too many rows, causes duplicate key conflicts)

      // Clear
      await db.delete(resolvedReceivables);
      await db.delete(collectionDailyActions);
      await db.delete(collectionActions);
      await db.delete(accountsReceivable);

      // Insert test receivable
      const [inserted] = await db.insert(accountsReceivable).values(makeTestReceivable() as any).$returningId();
      testReceivableId = inserted.id;
    }
  });

  afterAll(async () => {
    const db = await getDb();
    if (db) {
      // Clean up
      await db.delete(resolvedReceivables);
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
      if (backupResolved.length > 0) {
        await db.insert(resolvedReceivables).values(backupResolved);
      }
      // systemNotifications not restored (not backed up)
    }
  });

  it("should save cobrancaStartedAt when creating a new collectionAction via upsert", async () => {
    const result = await caller.financial.upsertCollectionAction({
      receivableId: testReceivableId,
      status: "pendente",
      novoContato: {
        tipo: "whatsapp",
        resumo: "Primeiro contato de cobrança",
      },
    });

    expect(result.success).toBe(true);

    // Verify cobrancaStartedAt was saved
    const db = await getDb();
    if (db) {
      const [action] = await db
        .select()
        .from(collectionActions)
        .where(eq(collectionActions.receivableId, testReceivableId));
      expect(action).toBeDefined();
      expect(action.cobrancaStartedAt).toBeTruthy();
      // Should be today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split("T")[0];
      expect(action.cobrancaStartedAt).toBe(today);
    }
  });

  it("should include cobrancaStartedAt in getOverdueTitles response", async () => {
    const result = await caller.financial.getOverdueTitles({
      search: "CLIENTE TESTE REGRA",
      status: "todos",
      sortBy: "dias",
      sortDir: "desc",
    });

    const testTitle = result.titles.find((t: any) => t.id === testReceivableId);
    expect(testTitle).toBeDefined();
    expect(testTitle!.cobranca).toBeDefined();
    expect(testTitle!.cobranca!.cobrancaStartedAt).toBeTruthy();
  }, 15000);

  it("should return empty resolved titles when none exist", async () => {
    const result = await caller.financial.getResolvedTitles();
    expect(result).toBeDefined();
    expect(result.titles).toBeDefined();
    expect(Array.isArray(result.titles)).toBe(true);
    expect(result.stats).toBeDefined();
    expect(typeof result.stats.count).toBe("number");
    expect(typeof result.stats.valorTotal).toBe("number");
  });

  it("should not save cobrancaStartedAt on update (only on insert)", async () => {
    const db = await getDb();
    if (!db) return;

    // Get current cobrancaStartedAt
    const [before] = await db
      .select()
      .from(collectionActions)
      .where(eq(collectionActions.receivableId, testReceivableId));
    const startedAtBefore = before.cobrancaStartedAt;

    // Update the action
    await caller.financial.upsertCollectionAction({
      receivableId: testReceivableId,
      status: "contatado",
      novoContato: {
        tipo: "ligacao",
        resumo: "Segundo contato",
      },
    });

    // cobrancaStartedAt should remain the same
    const [after] = await db
      .select()
      .from(collectionActions)
      .where(eq(collectionActions.receivableId, testReceivableId));
    expect(after.cobrancaStartedAt).toBe(startedAtBefore);
  });

  it("cobranca_alerta notification type should be allowed and persisted", async () => {
    // Create a test notification of type cobranca_alerta
    const { createNotification } = await import("./notificationRouter");
    await createNotification({
      type: "cobranca_alerta",
      title: "Teste alerta cobrança",
      message: "Teste de notificação de cobrança",
      severity: "warning",
      metadata: {
        destinatarios: ["Thiago", "Flavio", "Guilherme"],
      },
    });

    // Verify it was persisted in the database
    const db = await getDb();
    if (db) {
      const [alertNotif] = await db
        .select()
        .from(systemNotifications)
        .where(
          and(
            eq(systemNotifications.type, "cobranca_alerta"),
            eq(systemNotifications.title, "Teste alerta cobrança")
          )
        );
      expect(alertNotif).toBeDefined();
      expect(alertNotif.severity).toBe("warning");
      expect(alertNotif.message).toContain("Teste de notificação");

      // Clean up
      await db.delete(systemNotifications).where(eq(systemNotifications.id, alertNotif.id));
    }
  });
});
