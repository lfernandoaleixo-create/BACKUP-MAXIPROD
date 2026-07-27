import { getDb } from "./server/db";
import { trackingCache } from "./drizzle/schema";
import { desc } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  const rows = await db.select().from(trackingCache).orderBy(desc(trackingCache.lastUpdated));
  for (const r of rows) {
    console.log(`ID=${r.id} | BL=${r.blNumber} | Source=${r.trackingSource} | Status=${r.status} | Vessel=${r.vesselName} | Progress=${r.progress}% | ETA=${r.eta} | ETD=${r.etd} | Origin=${r.origin} | Dest=${r.destination} | Lat=${r.vesselLat} Lng=${r.vesselLng} | Updated=${r.lastUpdated}`);
  }
  process.exit(0);
}
main();
