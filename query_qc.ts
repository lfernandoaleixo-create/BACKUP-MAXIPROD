import { getDb } from "./server/db";
import { queijoCoalhoStock } from "./drizzle/schema";
import { eq, or } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  const items = await db.select().from(queijoCoalhoStock)
    .where(or(
      eq(queijoCoalhoStock.codigoItem, '00547'),
      eq(queijoCoalhoStock.codigoItem, '00648'),
      eq(queijoCoalhoStock.codigoItem, '00546'),
      eq(queijoCoalhoStock.codigoItem, '00577')
    ));
  console.log(`queijoCoalhoStock entries:`);
  for (const i of items) {
    console.log(`  Code=${i.codigoItem} | Maxiprod=${i.estoqueMaxiprod} | Processado=${i.estoqueProcessado} | Regulador=${i.estoqueRegulador} | UpdatedBy=${i.updatedBy}`);
  }
  
  process.exit(0);
}
main();
