import { getDb } from "./server/db";
import { importPayments } from "./drizzle/schema";
import { like, or, sql, ne, and, isNotNull } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  // Show all containers with rastreio field
  console.log("=== All containers with rastreio field ===");
  const allWithRastreio = await db.select({
    id: importPayments.id,
    blNumber: importPayments.blNumber,
    rastreio: importPayments.rastreio,
    armador: importPayments.armador,
    status: importPayments.status,
    sectionTitle: importPayments.sectionTitle,
    pedido: importPayments.pedido,
  }).from(importPayments)
    .where(and(isNotNull(importPayments.rastreio), ne(importPayments.rastreio, '')));
  
  for (const r of allWithRastreio) {
    console.log(JSON.stringify(r));
  }
  
  // Search for HANK in section_title
  console.log("\n=== HANK in sectionTitle ===");
  const hankRows = await db.select({
    id: importPayments.id,
    blNumber: importPayments.blNumber,
    rastreio: importPayments.rastreio,
    armador: importPayments.armador,
    status: importPayments.status,
    sectionTitle: importPayments.sectionTitle,
    pedido: importPayments.pedido,
    trackingUuid: importPayments.trackingUuid,
  }).from(importPayments)
    .where(like(importPayments.sectionTitle, '%HANK%'));
  
  for (const r of hankRows) {
    console.log(JSON.stringify(r));
  }
  
  process.exit(0);
}
main();
