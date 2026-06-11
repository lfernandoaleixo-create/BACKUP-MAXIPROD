import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { accountsReceivable, collectionDailyActions, collectionActionEdits } from "../drizzle/schema";
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

const testReceivable = {
  maxiprodId: 99501,
  estado: "EMITIDO",
  tipo: "TITULO",
  valorOriginal: "500.00",
  valorLiquido: "500.00",
  valorRetido: "0.00",
  valorDeDesconto: "0.00",
  valorDeAcrescimo: "0.00",
  valorRecebidoLiquido: "0.00",
  emissaoData: "2026-01-01T00:00:00",
  vencimentoData: "2026-03-01T00:00:00",
  vencimentoOriginalData: "2026-03-01T00:00:00",
  referenteA: "TESTE EDICAO ref. NF 501",
  parcela: 1,
  parcelasQuantidadeTotal: 1,
  cliente: "CLIENTE TESTE EDICAO",
  empresaNome: "PALITOS INDUSTRIA",
};

let backupReceivables: any[] = [];
let backupDailyActions: any[] = [];
let backupEdits: any[] = [];
let testReceivableId: number;
let testActionId: number;

describe("editDailyAction + getActionEditHistory", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);

  beforeAll(async () => {
    const db = await getDb();
    if (db) {
      backupReceivables = await db.select().from(accountsReceivable);
      backupDailyActions = await db.select().from(collectionDailyActions);
      backupEdits = await db.select().from(collectionActionEdits);

      // Clear test data
      await db.delete(collectionActionEdits);
      await db.delete(collectionDailyActions);
      await db.delete(accountsReceivable);

      // Insert test receivable
      const [inserted] = await db.insert(accountsReceivable).values(testReceivable as any).$returningId();
      testReceivableId = inserted.id;

      // Insert a test daily action
      const [action] = await db.insert(collectionDailyActions).values({
        receivableId: testReceivableId,
        dayNumber: 1,
        actionDate: "2026-03-02",
        actionType: "ligacao",
        notes: "Ligou para o cliente, sem atender",
        operatorName: "Thalita",
        isAutomatic: false,
      } as any).$returningId();
      testActionId = action.id;
    }
  });

  afterAll(async () => {
    const db = await getDb();
    if (db) {
      await db.delete(collectionActionEdits);
      await db.delete(collectionDailyActions);
      await db.delete(accountsReceivable);

      // Restore
      if (backupReceivables.length > 0) {
        for (const row of backupReceivables) {
          await db.insert(accountsReceivable).values(row).onDuplicateKeyUpdate({ set: row });
        }
      }
      if (backupDailyActions.length > 0) {
        for (const row of backupDailyActions) {
          await db.insert(collectionDailyActions).values(row).onDuplicateKeyUpdate({ set: row });
        }
      }
      if (backupEdits.length > 0) {
        for (const row of backupEdits) {
          await db.insert(collectionActionEdits).values(row).onDuplicateKeyUpdate({ set: row });
        }
      }
    }
  }, 30000);

  it("should edit action type and register audit trail", async () => {
    const result = await caller.financial.editDailyAction({
      dailyActionId: testActionId,
      actionType: "whatsapp",
      editedBy: "Thalita",
    });

    expect(result.success).toBe(true);
    expect(result.editsCount).toBe(1);

    // Verify the action was updated
    const db = await getDb();
    const [updated] = await db!.select().from(collectionDailyActions)
      .where(eq(collectionDailyActions.id, testActionId));
    expect(updated.actionType).toBe("whatsapp");
  });

  it("should edit notes and register audit trail", async () => {
    const result = await caller.financial.editDailyAction({
      dailyActionId: testActionId,
      notes: "Na verdade mandou WhatsApp, cliente respondeu",
      editedBy: "Thalita",
    });

    expect(result.success).toBe(true);
    expect(result.editsCount).toBe(1);

    const db = await getDb();
    const [updated] = await db!.select().from(collectionDailyActions)
      .where(eq(collectionDailyActions.id, testActionId));
    expect(updated.notes).toBe("Na verdade mandou WhatsApp, cliente respondeu");
  });

  it("should edit both type and notes in one call", async () => {
    const result = await caller.financial.editDailyAction({
      dailyActionId: testActionId,
      actionType: "email",
      notes: "Enviou email formal de cobrança",
      editedBy: "Admin",
    });

    expect(result.success).toBe(true);
    expect(result.editsCount).toBe(2);
  });

  it("should return no changes when nothing is different", async () => {
    const result = await caller.financial.editDailyAction({
      dailyActionId: testActionId,
      actionType: "email", // same as current
      notes: "Enviou email formal de cobrança", // same as current
      editedBy: "Thalita",
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe("Nenhuma alteração detectada");
  });

  it("should return error for non-existent action", async () => {
    const result = await caller.financial.editDailyAction({
      dailyActionId: 999999,
      actionType: "whatsapp",
      editedBy: "Thalita",
    });

    expect(result.success).toBe(false);
  });

  it("should retrieve full edit history for the receivable", async () => {
    const result = await caller.financial.getActionEditHistory({
      receivableId: testReceivableId,
    });

    expect(result.edits).toBeDefined();
    expect(result.edits.length).toBeGreaterThanOrEqual(4); // 1 + 1 + 2 from previous tests

    // Check structure
    const edit = result.edits[0];
    expect(edit).toHaveProperty("dailyActionId");
    expect(edit).toHaveProperty("receivableId");
    expect(edit).toHaveProperty("fieldChanged");
    expect(edit).toHaveProperty("oldValue");
    expect(edit).toHaveProperty("newValue");
    expect(edit).toHaveProperty("editedBy");
    expect(edit).toHaveProperty("editedAt");
  });

  it("should edit operatorName and register audit trail", async () => {
    const result = await caller.financial.editDailyAction({
      dailyActionId: testActionId,
      operatorName: "Guilherme",
      editedBy: "Thalita",
    });

    expect(result.success).toBe(true);
    expect(result.editsCount).toBe(1);

    const db = await getDb();
    const [updated] = await db!.select().from(collectionDailyActions)
      .where(eq(collectionDailyActions.id, testActionId));
    expect(updated.operatorName).toBe("Guilherme");
  });

  it("should have correct old/new values in audit trail", async () => {
    const result = await caller.financial.getActionEditHistory({
      receivableId: testReceivableId,
    });

    // Find all actionType edits
    const typeEdits = result.edits.filter((e: any) => e.fieldChanged === "actionType");
    expect(typeEdits.length).toBeGreaterThanOrEqual(2); // ligacao->whatsapp, whatsapp->email

    // All edits should have required fields
    for (const edit of typeEdits) {
      expect(edit.oldValue).toBeTruthy();
      expect(edit.newValue).toBeTruthy();
      expect(edit.editedBy).toBeTruthy();
    }

    // Verify the ligacao -> whatsapp edit exists
    const firstEdit = typeEdits.find((e: any) => e.oldValue === "ligacao" && e.newValue === "whatsapp");
    expect(firstEdit).toBeDefined();
    expect(firstEdit!.editedBy).toBe("Thalita");

    // Verify the whatsapp -> email edit exists
    const secondEdit = typeEdits.find((e: any) => e.oldValue === "whatsapp" && e.newValue === "email");
    expect(secondEdit).toBeDefined();
    expect(secondEdit!.editedBy).toBe("Admin");
  });
});
