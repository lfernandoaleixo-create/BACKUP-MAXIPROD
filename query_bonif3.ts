import { getDb } from "./server/db";
import { salesOrders } from "./drizzle/schema";
import { eq, like, sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  // Check salesOrders for #1217 using 'pedido' field
  const sales1217 = await db.select().from(salesOrders)
    .where(eq(salesOrders.pedido, '1217'));
  console.log(`salesOrders with pedido=1217: ${sales1217.length}`);
  for (const r of sales1217) {
    console.log(`  Pedido=${r.pedido} | Code=${r.codigoItem} | Desc=${r.descricaoItem} | Cliente=${r.cliente} | Estado=${r.estadoItem} | EstadoNota=${r.estadoNotaPedido} | EstConf=${r.estadoConfiguravel} | Qty=${r.quantidade} | QtyFaturada=${r.quantidadeFaturada}`);
  }
  
  // Also check if there are bonificação orders in salesOrders
  const bonifOrders = await db.select().from(salesOrders)
    .where(like(salesOrders.estadoConfiguravel, '%ONIF%'));
  console.log(`\nsalesOrders with BONIF in estadoConfiguravel: ${bonifOrders.length}`);
  for (const r of bonifOrders.slice(0, 5)) {
    console.log(`  Pedido=${r.pedido} | Code=${r.codigoItem} | EstConf=${r.estadoConfiguravel} | Estado=${r.estadoItem} | Qty=${r.quantidade} | QtyFat=${r.quantidadeFaturada}`);
  }
  
  // Check if code 00547 exists in salesOrders
  const code547 = await db.select().from(salesOrders)
    .where(eq(salesOrders.codigoItem, '00547'));
  console.log(`\nsalesOrders with code 00547: ${code547.length}`);
  for (const r of code547) {
    console.log(`  Pedido=${r.pedido} | Cliente=${r.cliente} | Estado=${r.estadoItem} | EstConf=${r.estadoConfiguravel} | Qty=${r.quantidade} | QtyFat=${r.quantidadeFaturada}`);
  }
  
  process.exit(0);
}
main();
