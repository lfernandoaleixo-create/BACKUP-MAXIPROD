/**
 * Payment Authorization Daily Reset
 * 
 * Remove todas as autorizações de pagamento na virada do dia.
 * Isso garante que cada dia começa com todas as contas desmarcadas,
 * e o Fernando precisa marcar manualmente as que deseja pagar.
 * 
 * Executado automaticamente à meia-noite (00:00) horário de Brasília.
 */
import { getDb } from "./db";
import { paymentAuthorizations } from "../drizzle/schema";

/**
 * Reset all payment authorizations by deleting all records.
 * This makes every payable start the new day as "unchecked".
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

  if (count === 0) {
    console.log("[PaymentAuthReset] No authorizations to reset");
    return { deleted: 0, date: new Date().toISOString() };
  }

  // Delete ALL payment authorizations
  await db.delete(paymentAuthorizations);

  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  console.log(`[PaymentAuthReset] Reset completed at ${now}: ${count} autorizações removidas`);

  return { deleted: count, date: new Date().toISOString() };
}
