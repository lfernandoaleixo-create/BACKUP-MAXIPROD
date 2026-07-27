import { getDb } from "./server/db";
import { trackingCache } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  const rows = await db.select().from(trackingCache)
    .where(eq(trackingCache.id, 180002));
  
  if (rows[0]?.rawData) {
    console.log("=== COSCO MANUAL raw data ===");
    console.log(rows[0].rawData);
  }
  
  process.exit(0);
}
main();
