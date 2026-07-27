import { getDb } from "./server/db";
import { stockItems } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  const items = await db.select().from(stockItems)
    .where(eq(stockItems.codigoItem, '00547'));
  console.log(`stock_items for 00547: ${items.length}`);
  for (const i of items) {
    console.log(`  Code=${i.codigoItem} | Desc=${i.descricaoItem} | Qty=${i.quantidade} | Grupo=${i.grupoCodigo} | SuperGrupo=${i.superGrupoCodigo}`);
  }
  
  // Also check 00648
  const items648 = await db.select().from(stockItems)
    .where(eq(stockItems.codigoItem, '00648'));
  console.log(`\nstock_items for 00648: ${items648.length}`);
  for (const i of items648) {
    console.log(`  Code=${i.codigoItem} | Desc=${i.descricaoItem} | Qty=${i.quantidade}`);
  }
  
  process.exit(0);
}
main();
