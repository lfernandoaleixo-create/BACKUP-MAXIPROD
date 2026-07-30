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
 * Estratégias de reset:
 * 1. Cron à meia-noite (00:00 BRT) — se o servidor estiver rodando
 * 2. Startup check — ao iniciar o servidor, verifica se o último reset foi
 *    feito hoje (BRT). Se não, limpa tudo. Resolve o caso de sandbox hibernar.
 * 3. Request-time check — a cada request de getWeekReconciliation, verifica
 *    se o último reset foi hoje. Se não, limpa antes de retornar dados.
 * 
 * Usa app_settings com chave "payment_auth_last_reset_date" para rastrear
 * a data do último reset de forma confiável (sem depender de timestamps UTC).
 */
import { getDb } from "./db";
import { paymentAuthorizations, authCompletion, appSettings } from "../drizzle/schema";
import { sql, eq } from "drizzle-orm";

/**
 * Get today's date in Brasilia timezone (YYYY-MM-DD)
 */
function getTodayBRT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Get the date of the last reset from app_settings
 */
async function getLastResetDate(db: any): Promise<string | null> {
  try {
    const rows = await db.select()
      .from(appSettings)
      .where(eq(appSettings.settingKey, "payment_auth_last_reset_date"))
      .limit(1);
    if (rows.length > 0 && rows[0].settingValue) {
      // settingValue is a JSON column - Drizzle auto-parses it.
      // Handle both old double-encoded strings and plain strings.
      let val = rows[0].settingValue;
      // Unwrap if it's a string that looks like a JSON-encoded string
      while (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
        try { val = JSON.parse(val); } catch { break; }
      }
      // Final cleanup: remove any remaining quotes
      const cleaned = String(val).replace(/"/g, '').trim();
      // Validate it looks like a date YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
        return cleaned;
      }
      console.log(`[PaymentAuthReset] Invalid last reset date value: ${JSON.stringify(rows[0].settingValue)} -> cleaned: ${cleaned}`);
      return null;
    }
  } catch (e: any) {
    console.log(`[PaymentAuthReset] Could not read last reset date: ${e.message}`);
  }
  return null;
}

/**
 * Save the date of the last reset to app_settings
 */
async function setLastResetDate(db: any, date: string): Promise<void> {
  try {
    const existing = await db.select()
      .from(appSettings)
      .where(eq(appSettings.settingKey, "payment_auth_last_reset_date"))
      .limit(1);
    
    // settingValue is a JSON column - store the date string directly.
    // Drizzle will handle JSON serialization automatically.
    // Do NOT use JSON.stringify here as it causes double-encoding.
    if (existing.length > 0) {
      await db.update(appSettings)
        .set({ settingValue: date })
        .where(eq(appSettings.settingKey, "payment_auth_last_reset_date"));
    } else {
      await db.insert(appSettings).values({
        settingKey: "payment_auth_last_reset_date",
        settingValue: date,
      });
    }
  } catch (e: any) {
    console.log(`[PaymentAuthReset] Could not save last reset date: ${e.message}`);
  }
}

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

  // Save the reset date
  const todayBRT = getTodayBRT();
  await setLastResetDate(db, todayBRT);

  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (count > 0) {
    console.log(`[PaymentAuthReset] Reset completed at ${now}: ${count} autorizações removidas (todos os status). Last reset date set to ${todayBRT}`);
  } else {
    console.log(`[PaymentAuthReset] No authorizations to reset at ${now}. Last reset date set to ${todayBRT}`);
  }

  return { deleted: count, date: new Date().toISOString() };
}

/**
 * Check if a reset is needed for today.
 * Uses app_settings to track the last reset date reliably.
 * Returns true if reset was performed, false if not needed.
 */
export async function checkAndResetIfNeeded(): Promise<{ reset: boolean; deleted: number }> {
  const db = await getDb();
  if (!db) {
    console.log("[PaymentAuthReset] Database not available, skipping check");
    return { reset: false, deleted: 0 };
  }

  const todayBRT = getTodayBRT();
  const lastResetDate = await getLastResetDate(db);

  if (lastResetDate === todayBRT) {
    // Already reset today, nothing to do
    return { reset: false, deleted: 0 };
  }

  // Log the mismatch for debugging
  console.log(`[PaymentAuthReset] Date comparison: lastResetDate=${JSON.stringify(lastResetDate)} (type=${typeof lastResetDate}), todayBRT=${JSON.stringify(todayBRT)}`);

  // Last reset was on a different day (or never) — reset now
  console.log(`[PaymentAuthReset] Reset needed: last reset was ${lastResetDate || 'never'}, today is ${todayBRT}`);
  const result = await resetDailyPaymentAuthorizations();
  return { reset: true, deleted: result.deleted };
}

/**
 * Check on server startup if authorizations need to be reset.
 * Uses the reliable app_settings-based check.
 */
export async function checkAndResetOnStartup(): Promise<{ reset: boolean; deleted: number }> {
  console.log(`[PaymentAuthReset] Running startup check...`);
  return checkAndResetIfNeeded();
}
