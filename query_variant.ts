import { getDb } from "./server/db";
import { productVariants } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  // Find parent of 00547
  const variants = await db.select().from(productVariants)
    .where(eq(productVariants.childCode, '00547'));
  console.log(`Parent of 00547:`, variants);
  
  // Find all children of 00648 (the parent)
  const children = await db.select().from(productVariants)
    .where(eq(productVariants.parentCode, '00648'));
  console.log(`\nChildren of 00648:`, children.map(c => `${c.childCode} (factor=${c.conversionFactor})`));
  
  process.exit(0);
}
main();
