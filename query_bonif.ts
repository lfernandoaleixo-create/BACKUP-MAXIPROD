import { getDb } from "./server/db";
import { orderItems } from "./drizzle/schema";
import { eq, like, and } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  // Look for order #1217 or code 00547 orders
  const rows = await db.select().from(orderItems)
    .where(eq(orderItems.codigoItem, '00547'));
  
  console.log(`=== Orders for code 00547 (ESPETO PREMIUM P/ QUEIJO COALHO 4,0 X 200 MM 5.000) ===`);
  console.log(`Total rows: ${rows.length}`);
  for (const r of rows) {
    console.log(`  Pedido=${r.numeroPedido} | Cliente=${r.cliente} | Qty=${r.quantidade} | QtyFaturada=${r.quantidadeFaturada} | Estado=${r.estadoNota} | EstadoItem=${r.estadoItem} | EstConf=${r.estadoConfiguravel}`);
  }
  
  // Also check for pedido 1217
  const rows1217 = await db.select().from(orderItems)
    .where(eq(orderItems.numeroPedido, '1217'));
  
  console.log(`\n=== All items in pedido #1217 ===`);
  for (const r of rows1217) {
    console.log(`  Code=${r.codigoItem} | Desc=${r.descricao} | Qty=${r.quantidade} | QtyFaturada=${r.quantidadeFaturada} | Estado=${r.estadoNota} | EstadoItem=${r.estadoItem} | EstConf=${r.estadoConfiguravel}`);
  }
  
  process.exit(0);
}
main();
