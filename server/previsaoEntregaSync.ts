/**
 * Sync Previsão de Entrega from Maxiprod GraphQL API
 * 
 * Fetches all pedidosDeCompra from Maxiprod and matches them to import_pos
 * by comparing the referencia field with the po_number.
 */
import { gql } from "./maxiprodGraphQL";
import { getDb } from "./db";
import { importPos } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export async function syncPrevisaoEntregaFromMaxiprod(): Promise<{ updated: number; totalMaxiprod: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Fetch ALL purchase orders from Maxiprod (all states, up to 200)
  const data = await gql<{ pedidosDeCompra: { totalCount: number; items: any[] } }>(`{
    pedidosDeCompra(take: 200) {
      totalCount
      items {
        numero
        referencia
        entregaPrevistaData
        estado
      }
    }
  }`);

  const maxiprodPOs = data.pedidosDeCompra?.items || [];
  if (maxiprodPOs.length === 0) return { updated: 0, totalMaxiprod: 0 };

  // Get all import_pos from DB
  const allPos = await db.select().from(importPos);

  let updated = 0;
  for (const mpo of maxiprodPOs) {
    const ref = (mpo.referencia || '').toUpperCase();
    const previsao = mpo.entregaPrevistaData || null;
    if (!previsao) continue;

    // Extract the code part before " - " (e.g., "PO55 - COMERCIAL" -> "PO55")
    const refParts = ref.split(' - ');
    const refCode = refParts[0].trim();

    for (const po of allPos) {
      const poNum = (po.poNumber || '').toUpperCase();
      if (!poNum) continue;

      // Direct match: referencia code matches po_number
      // Handle cases like PO55 vs PO55, or PO5 vs PO05 (with leading zero)
      const normalizedRef = refCode.replace(/^PO0*/, 'PO');
      const normalizedPo = poNum.replace(/^PO0*/, 'PO');
      
      if (normalizedRef === normalizedPo) {
        if (po.previsaoEntrega !== previsao) {
          await db.update(importPos)
            .set({ previsaoEntrega: previsao })
            .where(eq(importPos.id, po.id));
          updated++;
        }
        break;
      }
    }
  }

  return { updated, totalMaxiprod: maxiprodPOs.length };
}
