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
import { saveFinancialSnapshot, detectFinancialChanges } from "./financialHistory";

let scheduledTask: ScheduledTask | null = null;

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

            // Detectar mudanças comparando com o dia anterior
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
            const changes = await detectFinancialChanges(yesterdayStr, todayStr);
            console.log(`[Scheduler] Financial changes detected: ${changes.pagarChanges} pagar, ${changes.receberChanges} receber`);
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
}

/**
 * Check if the scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return scheduledTask !== null;
}
