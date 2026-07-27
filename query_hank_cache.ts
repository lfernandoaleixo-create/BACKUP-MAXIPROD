import { getDb } from "./server/db";
import { trackingCache } from "./drizzle/schema";
import { like, or, eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  const rows = await db.select().from(trackingCache)
    .where(or(
      like(trackingCache.blNumber, '%YMLU5427811%'),
      like(trackingCache.blNumber, '%SHYY26074853%'),
    ));
  
  console.log("=== HANK tracking cache entries ===");
  for (const r of rows) {
    console.log(`\nID=${r.id} | BL=${r.blNumber} | Source=${r.trackingSource}`);
    console.log(`  Status=${r.status} | Progress=${r.progress}%`);
    console.log(`  Vessel=${r.vesselName} | ETA=${r.eta} | ETD=${r.etd}`);
    console.log(`  Origin=${r.origin} | Dest=${r.destination}`);
    console.log(`  Lat=${r.vesselLat} Lng=${r.vesselLng}`);
    console.log(`  Updated=${r.lastUpdated}`);
    if (r.rawData) {
      try {
        const raw = JSON.parse(r.rawData);
        console.log(`  RAW KEYS: ${Object.keys(raw).join(', ')}`);
        if (raw.events) console.log(`  EVENTS count: ${raw.events.length}`);
        if (raw.current_status) console.log(`  RAW current_status: ${raw.current_status}`);
        if (raw.executive_summary) console.log(`  RAW summary: ${raw.executive_summary}`);
        if (raw.tracking_found !== undefined) console.log(`  RAW tracking_found: ${raw.tracking_found}`);
      } catch(e) {}
    }
  }
  
  process.exit(0);
}
main();
