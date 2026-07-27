import { getDb } from "./server/db";
import { importPayments } from "./drizzle/schema";
import { like, or, sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  // Search for HANK in import_payments
  const rows = await db.select({
    id: importPayments.id,
    blNumber: importPayments.blNumber,
    rastreio: importPayments.rastreio,
    armador: importPayments.armador,
    trackingUuid: importPayments.trackingUuid,
    status: importPayments.status,
    navio: importPayments.navio,
    containerName: importPayments.containerName,
  }).from(importPayments)
    .where(or(
      like(importPayments.containerName, '%HANK%'),
      like(importPayments.navio, '%HANK%'),
      like(importPayments.blNumber, '%HANK%'),
      like(importPayments.rastreio, '%HANK%'),
    ));
  
  console.log("=== HANK containers found ===");
  for (const r of rows) {
    console.log(JSON.stringify(r));
  }
  
  // Also show all active containers with rastreio
  console.log("\n=== All containers with rastreio field ===");
  const allWithRastreio = await db.select({
    id: importPayments.id,
    blNumber: importPayments.blNumber,
    rastreio: importPayments.rastreio,
    armador: importPayments.armador,
    status: importPayments.status,
    navio: importPayments.navio,
    containerName: importPayments.containerName,
  }).from(importPayments)
    .where(sql`rastreio IS NOT NULL AND rastreio != ''`);
  
  for (const r of allWithRastreio) {
    console.log(JSON.stringify(r));
  }
  
  process.exit(0);
}
main();
