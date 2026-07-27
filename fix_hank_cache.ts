import { getDb } from "./server/db";
import { trackingCache } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  // Delete the empty logcomex_ai entries for HANK (IDs 150001 and 210001)
  // These have no useful data and were overriding the good cosco_manual entry
  await db.delete(trackingCache).where(eq(trackingCache.id, 150001));
  console.log("Deleted empty logcomex_ai entry ID 150001 (YMLU5427811)");
  
  await db.delete(trackingCache).where(eq(trackingCache.id, 210001));
  console.log("Deleted empty logcomex_ai entry ID 210001 (SHYY26074853)");
  
  // Verify the remaining entry
  const remaining = await db.select().from(trackingCache)
    .where(eq(trackingCache.blNumber, 'YMLU5427811'));
  
  console.log(`\nRemaining entries for YMLU5427811: ${remaining.length}`);
  for (const r of remaining) {
    console.log(`  ID=${r.id} | Source=${r.trackingSource} | Progress=${r.progress}% | ETA=${r.eta} | Vessel=${r.vesselName}`);
  }
  
  process.exit(0);
}
main();
