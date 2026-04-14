/**
 * Payment Authorization Daily Reset
 * 
 * Remove todas as autorizações de pagamento na virada do dia.
 * Isso garante que cada dia começa com todas as contas desmarcadas,
 * incluindo as transferidas para pagamento posterior (prorrogar, outros, etc.).
 * Cada operador precisa marcar manualmente as que deseja pagar.
 * 
 * Também reseta o status de "conclusão de autorização" (auth_completion)
 * para que o botão de concluir fique disponível novamente no novo dia.
 * 
 * Duas estratégias de reset:
 * 1. Cron à meia-noite (00:00 BRT) — se o servidor estiver rodando
 * 2. Startup check — ao iniciar o servidor, verifica se há autorizações
 *    de um dia anterior e limpa tudo. Resolve o caso de sandbox hibernar à noite.
 * 
 * Executado automaticamente à meia-noite (00:00) horário de Brasília
 * E também na inicialização do servidor.
 */
import { getDb } from "./db";
import { paymentAuthorizations, authCompletion } from "../drizzle/schema";
import { sql } from "drizzle-orm";

/**
 * Reset all payment authorizations by deleting all records.
 * This makes every payable start the new day as "unchecked".
 * Also resets auth_completion so the day starts fresh.
 * Returns the count of deleted records.
 */
export async function resetDailyPaymentAuthorizations(): Promise<{ deleted: number; date: string }> {
  const db = await getDb();
  if (!db) {
    console.log("[PaymentAuthReset] Database not available, skipping reset");
    return { deleted: 0, date: new Date().toISOString() };
  }

  // Count existing authorizations before deletion
  const existing = await db.select().from(paymentAuthorizations);
  const count = existing.length;

  // Delete ALL payment authorizations — no exceptions
  // This includes: autorizado, prorrogar, autorizado_ressalva, nao_autorizado, outros
  if (count > 0) {
    await db.delete(paymentAuthorizations);
  }

  // Also reset auth_completion so the "concluir" button is available for the new day
  try {
    await db.delete(authCompletion);
  } catch (e: any) {
    console.log(`[PaymentAuthReset] auth_completion reset skipped: ${e.message}`);
  }

  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (count > 0) {
    console.log(`[PaymentAuthReset] Reset completed at ${now}: ${count} autorizações removidas (todos os status)`);
  } else {
    console.log(`[PaymentAuthReset] No authorizations to reset at ${now}`);
  }

  return { deleted: count, date: new Date().toISOString() };
}

/**
 * Check on server startup if authorizations are from a previous day.
 * If any authorization was created before today (Brasilia time), reset all.
 * This handles the case where the sandbox hibernates overnight and the
 * midnight cron never fires.
 */
export async function checkAndResetOnStartup(): Promise<{ reset: boolean; deleted: number }> {
  const db = await getDb();
  if (!db) {
    console.log("[PaymentAuthReset] Database not available on startup, skipping check");
    return { reset: false, deleted: 0 };
  }

  // Get today's date in Brasilia timezone (YYYY-MM-DD)
  const todayBRT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  // Check if there are any authorizations from before today
  const existing = await db.select().from(paymentAuthorizations);
  
  if (existing.length === 0) {
    console.log(`[PaymentAuthReset] Startup check: no authorizations found, nothing to reset`);
    return { reset: false, deleted: 0 };
  }

  // Check if any authorization was created before today
  const hasStaleAuths = existing.some(auth => {
    const authDate = new Date(auth.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    return authDate < todayBRT;
  });

  // Also check auth_completion for stale entries
  let hasStaleCompletion = false;
  try {
    const completions = await db.select().from(authCompletion);
    hasStaleCompletion = completions.some(c => c.date < todayBRT);
  } catch (e) {
    // Table might not exist yet
  }

  if (hasStaleAuths || hasStaleCompletion) {
    console.log(`[PaymentAuthReset] Startup check: found stale authorizations from before ${todayBRT}, resetting...`);
    const result = await resetDailyPaymentAuthorizations();
    console.log(`[PaymentAuthReset] Startup reset completed: ${result.deleted} autorizações removidas`);
    return { reset: true, deleted: result.deleted };
  }

  console.log(`[PaymentAuthReset] Startup check: all ${existing.length} authorizations are from today (${todayBRT}), keeping them`);
  return { reset: false, deleted: 0 };
}
