import { getDb } from "./server/db";
import { orderItems, salesOrders } from "./drizzle/schema";
import { like, sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  // Check total order_items count
  const total = await db.select({ count: sql`COUNT(*)` }).from(orderItems);
  console.log(`Total order_items: ${JSON.stringify(total[0])}`);
  
  // Check if there are any orders with "Bonif" in estadoNota or estadoConfiguravel
  const bonif1 = await db.select().from(orderItems)
    .where(like(orderItems.estadoNota, '%onif%'));
  console.log(`\nOrders with 'onif' in estadoNota: ${bonif1.length}`);
  for (const r of bonif1.slice(0, 5)) {
    console.log(`  Pedido=${r.numeroPedido} | Code=${r.codigoItem} | Estado=${r.estadoNota} | EstItem=${r.estadoItem}`);
  }
  
  const bonif2 = await db.select().from(orderItems)
    .where(like(orderItems.estadoConfiguravel, '%onif%'));
  console.log(`\nOrders with 'onif' in estadoConfiguravel: ${bonif2.length}`);
  for (const r of bonif2.slice(0, 5)) {
    console.log(`  Pedido=${r.numeroPedido} | Code=${r.codigoItem} | EstConf=${r.estadoConfiguravel}`);
  }
  
  // Check salesOrders for #1217
  try {
    const sales1217 = await db.select().from(salesOrders)
      .where(like(salesOrders.numeroPedido, '%1217%'));
    console.log(`\nsalesOrders with #1217: ${sales1217.length}`);
    for (const r of sales1217.slice(0, 3)) {
      console.log(`  Pedido=${r.numeroPedido} | Cliente=${r.cliente} | Status=${r.estadoNota} | NF=${r.notaFiscal}`);
    }
  } catch(e) {
    console.log("salesOrders table error:", (e as any).message);
  }
  
  process.exit(0);
}
main();
