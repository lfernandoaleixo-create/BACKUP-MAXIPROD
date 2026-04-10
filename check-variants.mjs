import { getDb } from "./server/db.ts";
import { productVariants } from "./drizzle/schema.ts";

const db = await getDb();
if (!db) { console.log("No DB"); process.exit(1); }
const variants = await db.select().from(productVariants);
console.log("=== VARIANTES CADASTRADAS ===");
for (const v of variants) {
  console.log(`Pai: ${v.parentCode} → Filho: ${v.childCode} (fator: ${v.conversionFactor})`);
}
console.log(`\nTotal: ${variants.length} variantes`);
process.exit(0);
