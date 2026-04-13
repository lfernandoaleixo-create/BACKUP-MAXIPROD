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
 * Executado automaticamente à meia-noite (00:00) horário de Brasília.
 */
import { getDb } from "./db";
import { paymentAuthorizations, authCompletion } from "../drizzle/schema";

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
