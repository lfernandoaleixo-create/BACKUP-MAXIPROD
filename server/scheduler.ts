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

let scheduledTask: ScheduledTask | null = null;
let dailyResetTask: ScheduledTask | null = null;
let dailyCollectionTask: ScheduledTask | null = null;

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

  // Daily collection job: alertas de cobrança às 7h (Brasília), seg-sex
  if (!dailyCollectionTask) {
    dailyCollectionTask = schedule("0 7 * * 1-5", async () => {
      console.log(`[Scheduler] Starting daily collection job at ${new Date().toISOString()}`);
      try {
        // Import dynamically to avoid circular dependencies
        const { appRouter } = await import("./routers");
        const caller = appRouter.createCaller({ user: null, req: { protocol: "https", headers: {} } as any, res: { clearCookie: () => {} } as any });
        const result = await caller.financial.runDailyCollectionJob();
        console.log(`[Scheduler] Collection job completed: ${result.semContatoCount} sem_contato, ${result.protestadoCount} protestado, ${result.documentoCount} documentos, ${result.alertCount} alertas`);
      } catch (error: any) {
        console.error(`[Scheduler] Collection job failed: ${error.message}`);
      }
    }, {
      timezone: "America/Sao_Paulo",
    });
    console.log("[Scheduler] Daily collection job: 7h seg-sex (America/Sao_Paulo)");
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
}

/**
 * Check if the scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return scheduledTask !== null;
}
