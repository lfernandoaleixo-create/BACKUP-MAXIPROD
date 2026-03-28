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
import { runGraphQLSync } from "./maxiprodGraphQL";

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
