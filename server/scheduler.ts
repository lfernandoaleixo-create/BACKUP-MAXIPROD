/**
 * Scheduler Service - Agendamento de sincronização automática
 * 
 * Executa a sincronização com o Maxiprod:
 * - A cada 5 minutos durante horário comercial (seg-sex, 7h-18h, Brasília)
 * SOMENTE LEITURA - jamais altera dados no Maxiprod.
 * 
 * Usa node-cron para agendamento. O timezone é America/Sao_Paulo (UTC-3).
 */
import { schedule, type ScheduledTask } from "node-cron";
import { runGraphQLSync, syncBankBalances, syncPaidAccountsSnapshots } from "./maxiprodGraphQL";
import { saveFinancialSnapshot, detectFinancialChanges, getSnapshotDates } from "./financialHistory";
import { resetDailyPaymentAuthorizations, checkAndResetOnStartup } from "./paymentAuthReset";
import { syncCobrancaPlanilhaAuto } from "./cobrancaPlanilhaSync";
import { syncPriceTables } from "./priceTableSync";
import { syncPrevisaoEntregaFromMaxiprod } from "./previsaoEntregaSync";
import { syncClientsFromMaxiprod } from "./clientSyncMaxiprod";
import { detectStockInsufficientAlerts } from "./stockAlertDetector";

let scheduledTask: ScheduledTask | null = null;
let dailyResetTask: ScheduledTask | null = null;
let dailyCollectionTask: ScheduledTask | null = null;
let checklistGenerateTask: ScheduledTask | null = null;
let checklistLockTask: ScheduledTask | null = null;

// Start the business-hours sync scheduler
// Runs every 5 minutes, Monday-Friday, 7:00-17:55 (Brasilia time)
// Cron: every 5 min, hours 7-17, Mon-Fri
export function startScheduler(): void {
  if (scheduledTask) {
    console.log("[Scheduler] Scheduler already running, skipping start");
    return;
  }

  // Cron: every 5 min, hours 7-17, Mon-Fri
  scheduledTask = schedule("*/5 7-17 * * 1-5", async () => {
    console.log(`[Scheduler] Starting scheduled sync at ${new Date().toISOString()}`);
    try {
      const result = await runGraphQLSync();
      if (result.success) {
        console.log(`[Scheduler] Sync completed successfully: ${result.counts?.stock} estoque, ${result.counts?.openOrders} pedidos, ${result.counts?.purchaseOrders} POs, ${result.counts?.salesOrders} vendas`);
        // Sync saldos bancários do balancete contábil (SOMENTE LEITURA)
        try {
          const bankResult = await syncBankBalances();
          console.log(`[Scheduler] Bank balances synced: ${bankResult.accounts} contas, total R$ ${bankResult.totalSaldo.toFixed(2)}`);
        } catch (bankErr: any) {
          console.error(`[Scheduler] Bank balance sync failed: ${bankErr.message}`);
        }
        // Sync paid accounts snapshots (once per hour, at the top of the hour)
        const now = new Date();
        if (now.getMinutes() < 5) {
          try {
            await syncPaidAccountsSnapshots();
            console.log(`[Scheduler] Paid accounts snapshots synced`);
          } catch (paidErr: any) {
            console.error(`[Scheduler] Paid accounts sync failed: ${paidErr.message}`);
          }
        }

        // Financial history snapshot + change detection (once per hour)
        if (now.getMinutes() < 5) {
          try {
            const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
            const snap = await saveFinancialSnapshot(todayStr);
            console.log(`[Scheduler] Financial snapshot saved: ${snap.payableCount} pagar, ${snap.receivableCount} receber`);

            // Detectar mudanças comparando com o último snapshot disponível (não necessariamente ontem)
            const snapshotDates = await getSnapshotDates();
            // snapshotDates vem em ordem DESC, o primeiro é o de hoje que acabamos de salvar
            // O segundo é o snapshot anterior mais recente
            const previousSnapshotDate = snapshotDates.find(d => d < todayStr);
            if (previousSnapshotDate) {
              const changes = await detectFinancialChanges(previousSnapshotDate, todayStr);
              console.log(`[Scheduler] Financial changes detected (${previousSnapshotDate} -> ${todayStr}): ${changes.pagarChanges} pagar, ${changes.receberChanges} receber`);
            } else {
              console.log(`[Scheduler] No previous snapshot found, skipping change detection`);
            }
          } catch (histErr: any) {
            console.error(`[Scheduler] Financial history sync failed: ${histErr.message}`);
          }
        }
        // Auto-sync Planilha de Cobrança (deactivate paid titles, add new overdue ones)
        try {
          const cobrancaResult = await syncCobrancaPlanilhaAuto();
          console.log(`[Scheduler] Cobrança planilha synced: ${cobrancaResult.added} novos, ${cobrancaResult.deactivated} desativados, ${cobrancaResult.total} ativos`);
        } catch (cobErr: any) {
          console.error(`[Scheduler] Cobrança planilha sync failed: ${cobErr.message}`);
        }
        // Detectar alertas de estoque insuficiente em pedidos "A aprovar"
        try {
          const alertResult = await detectStockInsufficientAlerts();
          if (alertResult.created > 0) {
            console.log(`[Scheduler] Stock alerts: ${alertResult.created} novo(s) alerta(s) de estoque insuficiente`);
          }
        } catch (alertErr: any) {
          console.error(`[Scheduler] Stock alert detection failed: ${alertErr.message}`);
        }
        // Sync price tables (tabelas de preço por vendedor) + auto-update product visibility
        try {
          const priceResult = await syncPriceTables();
          console.log(`[Scheduler] Price tables synced: ${priceResult.tables} tabelas, ${priceResult.items} itens`);
        } catch (priceErr: any) {
          console.error(`[Scheduler] Price table sync failed: ${priceErr.message}`);
        }
        // Sync previsão de entrega from Maxiprod (once per hour)
        if (now.getMinutes() < 5) {
          try {
            const previsaoResult = await syncPrevisaoEntregaFromMaxiprod();
            console.log(`[Scheduler] Previsão de entrega synced: ${previsaoResult.updated} POs atualizadas`);
          } catch (prevErr: any) {
            console.error(`[Scheduler] Previsão de entrega sync failed: ${prevErr.message}`);
          }
          // Sync clients from Maxiprod (once per hour)
          try {
            const clientResult = await syncClientsFromMaxiprod();
            console.log(`[Scheduler] Client sync: ${clientResult.synced} synced, ${clientResult.errors} errors, ${clientResult.total} total`);
          } catch (clientErr: any) {
            console.error(`[Scheduler] Client sync failed: ${clientErr.message}`);
          }
        }
      } else {
        console.error(`[Scheduler] Sync failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error(`[Scheduler] Unexpected error during scheduled sync: ${error.message}`);
    }
  }, {
    timezone: "America/Sao_Paulo",
  });

  console.log("[Scheduler] Auto-sync: a cada 5 min, seg-sex 7h-18h (America/Sao_Paulo)");

  // Startup check: reset stale authorizations from previous days
  // This handles the case where sandbox hibernates overnight and midnight cron never fires
  checkAndResetOnStartup().catch(err => {
    console.error(`[Scheduler] Startup auth reset check failed: ${err.message}`);
  });

  // DESABILITADO: Cobrança agora é 100% manual — sem automação de sem_contato, protesto ou documentos
  // Daily collection job removido conforme solicitação do Fernando (28/04/2026)
  console.log("[Scheduler] Daily collection job: DESABILITADO (cobrança 100% manual)");

  // ─── Checklist de Desperdício: Gerar ronda Seg/Qua/Sex às 07:00 ───
  if (!checklistGenerateTask) {
    checklistGenerateTask = schedule("0 7 * * 1,3,5", async () => {
      console.log(`[Scheduler] Checklist: Gerando ronda do dia...`);
      try {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return;
        const { checklistRounds } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        const existing = await db.select().from(checklistRounds).where(eq(checklistRounds.date, today)).limit(1);
        if (existing.length === 0) {
          await db.insert(checklistRounds).values({ date: today, status: "open" });
          console.log(`[Scheduler] Checklist: Ronda criada para ${today}`);
        } else {
          console.log(`[Scheduler] Checklist: Ronda já existe para ${today}`);
        }
      } catch (error: any) {
        console.error(`[Scheduler] Checklist generate failed: ${error.message}`);
      }
    }, { timezone: "America/Sao_Paulo" });
    console.log("[Scheduler] Checklist generate: Seg/Qua/Sex às 07:00 (America/Sao_Paulo)");
  }

  // ─── Checklist de Desperdício: Travar rondas abertas às 17:00 ───
  if (!checklistLockTask) {
    checklistLockTask = schedule("0 17 * * 1,3,5", async () => {
      console.log(`[Scheduler] Checklist: Travando rondas abertas...`);
      try {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return;
        const { checklistRounds } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        await db.update(checklistRounds)
          .set({ status: "not_done", lockedAt: new Date() })
          .where(and(eq(checklistRounds.date, today), eq(checklistRounds.status, "open")));
        console.log(`[Scheduler] Checklist: Rondas abertas de ${today} travadas como 'não realizado'`);
      } catch (error: any) {
        console.error(`[Scheduler] Checklist lock failed: ${error.message}`);
      }
    }, { timezone: "America/Sao_Paulo" });
    console.log("[Scheduler] Checklist lock: Seg/Qua/Sex às 17:00 (America/Sao_Paulo)");
  }

  // Daily reset of payment authorizations at midnight (00:00) Brasilia time, every day
  if (!dailyResetTask) {
    dailyResetTask = schedule("0 0 * * *", async () => {
      console.log(`[Scheduler] Starting daily payment authorization reset at ${new Date().toISOString()}`);
      try {
        const result = await resetDailyPaymentAuthorizations();
        console.log(`[Scheduler] Payment auth reset: ${result.deleted} autorizações removidas`);
      } catch (error: any) {
        console.error(`[Scheduler] Payment auth reset failed: ${error.message}`);
      }
    }, {
      timezone: "America/Sao_Paulo",
    });
    console.log("[Scheduler] Daily payment auth reset: meia-noite (America/Sao_Paulo)");
  }
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[Scheduler] Scheduler stopped");
  }
  if (dailyResetTask) {
    dailyResetTask.stop();
    dailyResetTask = null;
    console.log("[Scheduler] Daily reset task stopped");
  }
  if (dailyCollectionTask) {
    dailyCollectionTask.stop();
    dailyCollectionTask = null;
    console.log("[Scheduler] Daily collection task stopped");
  }
  if (checklistGenerateTask) {
    checklistGenerateTask.stop();
    checklistGenerateTask = null;
    console.log("[Scheduler] Checklist generate task stopped");
  }
  if (checklistLockTask) {
    checklistLockTask.stop();
    checklistLockTask = null;
    console.log("[Scheduler] Checklist lock task stopped");
  }
}

/**
 * Check if the scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return scheduledTask !== null;
}
