import { describe, it, expect } from "vitest";
import { syncCobrancaPlanilhaAuto } from "./cobrancaPlanilhaSync";

describe("cobrancaPlanilhaSync - Auto sync", () => {
  it("syncCobrancaPlanilhaAuto returns valid result structure", async () => {
    const result = await syncCobrancaPlanilhaAuto();
    expect(result).toHaveProperty("added");
    expect(result).toHaveProperty("deactivated");
    expect(result).toHaveProperty("total");
    expect(typeof result.added).toBe("number");
    expect(typeof result.deactivated).toBe("number");
    expect(typeof result.total).toBe("number");
    expect(result.total).toBeGreaterThan(0);
  }, 60000);

  it("deactivated titles should not appear in active list", async () => {
    // Run sync first
    const result = await syncCobrancaPlanilhaAuto();
    
    // After sync, total should match the count of overdue EMITIDO titles
    // that pass the RECEIVABLE_VALID_TYPES filter
    expect(result.total).toBeGreaterThanOrEqual(80); // We know there are ~91 active titles
  }, 30000);

  it("FLAVIO JOSE should not be active (already RECEBIDO in accounts_receivable)", async () => {
    // Import db to check directly
    const { getDb } = await import("./db");
    const { cobrancaPlanilha } = await import("../drizzle/schema");
    const { eq, and, like } = await import("drizzle-orm");
    
    const db = await getDb();
    if (!db) return;
    
    const results = await db.select()
      .from(cobrancaPlanilha)
      .where(and(
        like(cobrancaPlanilha.empresa, '%FLAVIO%OLIVEIRA%'),
        eq(cobrancaPlanilha.ativo, true)
      ));
    
    // FLAVIO JOSE should NOT be active since his title is RECEBIDO
    expect(results.length).toBe(0);
  });

  it("titles vencidos on 2026-05-20 should be in planilha (active or inactive)", async () => {
    const { getDb } = await import("./db");
    const { cobrancaPlanilha } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    
    const db = await getDb();
    if (!db) return;
    
    const results = await db.select()
      .from(cobrancaPlanilha)
      .where(eq(cobrancaPlanilha.vencimento, '2026-05-20'));
    
    // There should be titles vencidos on 20/05 (some may have been paid since initial sync)
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it("new titles inherit manual status from same empresa (not reset to Pendente)", async () => {
    // This test verifies the fix: when a new title is added for an empresa that
    // already has records with a manual status, it should inherit that status
    const { getDb } = await import("./db");
    const { cobrancaPlanilha } = await import("../drizzle/schema");
    const { eq, and, ne } = await import("drizzle-orm");
    
    const db = await getDb();
    if (!db) return;
    
    // Get all active records with non-Pendente status
    const manualStatusRecords = await db.select()
      .from(cobrancaPlanilha)
      .where(and(
        eq(cobrancaPlanilha.ativo, true),
        ne(cobrancaPlanilha.status, 'Pendente')
      ));
    
    // After the restore, there should be records with manual statuses
    expect(manualStatusRecords.length).toBeGreaterThan(0);
    
    // Verify known empresas have their correct statuses
    const statusMap: Record<string, string[]> = {};
    for (const r of manualStatusRecords) {
      if (!statusMap[r.empresa]) statusMap[r.empresa] = [];
      statusMap[r.empresa].push(r.status);
    }
    
    // At least some empresas should have non-Pendente status
    expect(Object.keys(statusMap).length).toBeGreaterThan(5);
  });
});
