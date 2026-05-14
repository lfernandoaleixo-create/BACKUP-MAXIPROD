import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("cobrancaPlanilha router", () => {
  const caller = appRouter.createCaller(createTestContext());

  it("getAll returns array of items", async () => {
    const result = await caller.cobrancaPlanilha.getAll();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("getSummary returns correct structure", async () => {
    const result = await caller.cobrancaPlanilha.getSummary();
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("byStatus");
    expect(result).toHaveProperty("byCenter");
    expect(result).toHaveProperty("totalValor");
    expect(result.total).toBeGreaterThan(0);
    expect(typeof result.totalValor).toBe("number");
  });

  it("getSummary has correct status distribution", async () => {
    const result = await caller.cobrancaPlanilha.getSummary();
    const statuses = Object.keys(result.byStatus);
    expect(statuses.length).toBeGreaterThan(0);
    // At least one known status should exist
    const knownStatuses = ["Pendente", "Contatado", "Em Negociação", "Promessa de Pgto", "Especial s/ Cobrança", "Protestado"];
    const hasKnown = statuses.some(s => knownStatuses.includes(s));
    expect(hasKnown).toBe(true);
  });

  it("getSummary has correct center distribution", async () => {
    const result = await caller.cobrancaPlanilha.getSummary();
    const centers = Object.keys(result.byCenter);
    expect(centers.length).toBeGreaterThan(0);
    expect(centers).toContain("BAMBU");
  });

  it("getAll items have required fields", async () => {
    const result = await caller.cobrancaPlanilha.getAll();
    const first = result[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("empresa");
    expect(first).toHaveProperty("status");
    expect(first).toHaveProperty("valor");
    expect(first.empresa.length).toBeGreaterThan(0);
  });

  it("updateField rejects non-editable fields", async () => {
    await expect(
      caller.cobrancaPlanilha.updateField({
        id: 1,
        field: "empresa",
        value: "Hack",
        updatedBy: "test",
      })
    ).rejects.toThrow("não é editável");
  });

  it("updateField accepts valid editable field", async () => {
    const items = await caller.cobrancaPlanilha.getAll();
    if (items.length === 0) return;
    const item = items[0];
    const originalStatus = item.status;
    
    const result = await caller.cobrancaPlanilha.updateField({
      id: item.id,
      field: "status",
      value: "Contatado",
      updatedBy: "test",
    });
    expect(result.success).toBe(true);
    
    // Verify update
    const updated = await caller.cobrancaPlanilha.getAll();
    const updatedItem = updated.find(i => i.id === item.id);
    expect(updatedItem?.status).toBe("Contatado");
    
    // Restore original
    await caller.cobrancaPlanilha.updateField({
      id: item.id,
      field: "status",
      value: originalStatus,
      updatedBy: "test",
    });
  });

  it("updateObservacao works correctly", async () => {
    const items = await caller.cobrancaPlanilha.getAll();
    if (items.length === 0) return;
    const item = items[items.length - 1];
    const originalObs = item.observacoes;
    
    const result = await caller.cobrancaPlanilha.updateObservacao({
      id: item.id,
      observacoes: "Teste de observação vitest",
      updatedBy: "test",
    });
    expect(result.success).toBe(true);
    
    // Verify
    const updated = await caller.cobrancaPlanilha.getAll();
    const updatedItem = updated.find(i => i.id === item.id);
    expect(updatedItem?.observacoes).toBe("Teste de observação vitest");
    
    // Restore
    await caller.cobrancaPlanilha.updateObservacao({
      id: item.id,
      observacoes: originalObs || "",
      updatedBy: "test",
    });
  });

  it("syncFromInadimplencia returns correct summary structure", async () => {
    const result = await caller.cobrancaPlanilha.syncFromInadimplencia({
      updatedBy: "test-vitest",
    });
    expect(result.success).toBe(true);
    expect(result.summary).toHaveProperty("totalBefore");
    expect(result.summary).toHaveProperty("totalAfter");
    expect(result.summary).toHaveProperty("updated");
    expect(result.summary).toHaveProperty("added");
    expect(result.summary).toHaveProperty("notInInadimplencia");
    expect(result.summary).toHaveProperty("backupCreated");
    expect(result.summary.backupCreated).toBe(true);
    expect(typeof result.summary.updated).toBe("number");
    expect(typeof result.summary.added).toBe("number");
    // totalAfter pode ser menor que totalBefore se títulos foram pagos/desativados
    expect(typeof result.summary.totalAfter).toBe("number");
    expect(result.summary).toHaveProperty("deactivated");
  }, 30000);

  it("syncFromInadimplencia preserves manual annotations", async () => {
    // Set a custom observation on a title
    const itemsBefore = await caller.cobrancaPlanilha.getAll();
    if (itemsBefore.length === 0) return;
    const testItem = itemsBefore[0];
    const originalObs = testItem.observacoes;
    
    await caller.cobrancaPlanilha.updateObservacao({
      id: testItem.id,
      observacoes: "TESTE_SYNC_PRESERVA_OBS",
      updatedBy: "test",
    });
    
    // Run sync
    await caller.cobrancaPlanilha.syncFromInadimplencia({
      updatedBy: "test-vitest",
    });
    
    // Verify observation was preserved
    const itemsAfter = await caller.cobrancaPlanilha.getAll();
    const afterItem = itemsAfter.find(i => i.id === testItem.id);
    expect(afterItem?.observacoes).toBe("TESTE_SYNC_PRESERVA_OBS");
    
    // Restore
    await caller.cobrancaPlanilha.updateObservacao({
      id: testItem.id,
      observacoes: originalObs || "",
      updatedBy: "test",
    });
  }, 30000);

  it("listBackups returns backups including auto-backup from sync", async () => {
    const backups = await caller.cobrancaPlanilha.listBackups();
    expect(Array.isArray(backups)).toBe(true);
    expect(backups.length).toBeGreaterThan(0);
    // Should have auto-backup from sync
    const autoBackup = backups.find(b => (b.createdBy || "").includes("Auto-backup"));
    expect(autoBackup).toBeDefined();
  });

  it("getLiveInadimplenciaStats returns real-time totals", async () => {
    const stats = await caller.cobrancaPlanilha.getLiveInadimplenciaStats();
    expect(stats).toHaveProperty("totalTitulos");
    expect(stats).toHaveProperty("totalValor");
    expect(typeof stats.totalTitulos).toBe("number");
    expect(typeof stats.totalValor).toBe("number");
    expect(stats.totalTitulos).toBeGreaterThan(0);
    expect(stats.totalValor).toBeGreaterThan(0);
  });

  it("getLiveInadimplenciaStats matches sync inadimplenciaTotal", async () => {
    const stats = await caller.cobrancaPlanilha.getLiveInadimplenciaStats();
    // The live stats should be consistent with what sync would report
    const syncResult = await caller.cobrancaPlanilha.syncFromInadimplencia({ updatedBy: "test-live-match" });
    expect(stats.totalTitulos).toBe(syncResult.summary.inadimplenciaTotal);
  });

  it("addEtapaObs adds observation to a specific step", async () => {
    const callerAuth = appRouter.createCaller({
      user: { id: 1, openId: "test", name: "Test", role: "admin" },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    });
    const items = await callerAuth.cobrancaPlanilha.getAll();
    if (items.length === 0) return;
    const testItem = items[0];
    const result = await callerAuth.cobrancaPlanilha.addEtapaObs({
      planilhaId: testItem.id,
      etapa: "primeiraCobranca",
      observacao: "Teste vitest obs etapa",
      registradoPor: "Test",
    });
    expect(result.success).toBe(true);
  });

  it("getEtapaObs returns observations for a step", async () => {
    const callerAuth = appRouter.createCaller({
      user: { id: 1, openId: "test", name: "Test", role: "admin" },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    });
    const items = await callerAuth.cobrancaPlanilha.getAll();
    if (items.length === 0) return;
    const testItem = items[0];
    const obs = await callerAuth.cobrancaPlanilha.getEtapaObs({
      planilhaId: testItem.id,
      etapa: "primeiraCobranca",
    });
    expect(Array.isArray(obs)).toBe(true);
    expect(obs.length).toBeGreaterThan(0);
    expect(obs[0]).toHaveProperty("observacao");
    expect(obs[0]).toHaveProperty("registradoPor");
    expect(obs[0]).toHaveProperty("etapa");
  });

  it("getAllEtapaObs returns all observations for a title", async () => {
    const callerAuth = appRouter.createCaller({
      user: { id: 1, openId: "test", name: "Test", role: "admin" },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    });
    const items = await callerAuth.cobrancaPlanilha.getAll();
    if (items.length === 0) return;
    const testItem = items[0];
    const allObs = await callerAuth.cobrancaPlanilha.getAllEtapaObs({
      planilhaId: testItem.id,
    });
    expect(Array.isArray(allObs)).toBe(true);
    expect(allObs.length).toBeGreaterThan(0);
  });

  it("countEtapaObs returns count map", async () => {
    const callerAuth = appRouter.createCaller({
      user: { id: 1, openId: "test", name: "Test", role: "admin" },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    });
    const items = await callerAuth.cobrancaPlanilha.getAll();
    if (items.length === 0) return;
    const ids = items.slice(0, 5).map(i => i.id);
    const counts = await callerAuth.cobrancaPlanilha.countEtapaObs({ planilhaIds: ids });
    expect(typeof counts).toBe("object");
    // The item we added obs to should have count > 0
    expect(counts[items[0].id]).toBeGreaterThan(0);
  });
});
