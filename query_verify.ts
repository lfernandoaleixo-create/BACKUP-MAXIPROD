import { getDb } from "./server/db";
import { salesOrders } from "./drizzle/schema";
import { eq, and, isNotNull } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  // Verify what faturados completos will return for 00547
  const faturados547 = await db.select().from(salesOrders)
    .where(
      and(
        eq(salesOrders.estadoItem, 'Faturado'),
        eq(salesOrders.codigoItem, '00547')
      )
    );
  console.log(`Faturados completos for 00547: ${faturados547.length}`);
  for (const r of faturados547) {
    console.log(`  Pedido=${r.pedido} | Cliente=${r.cliente} | Qty=${r.quantidade} | QtyFat=${r.quantidadeFaturada} | EstConf=${r.estadoConfiguravel}`);
  }
  
  // Also check how many total faturados exist
  const allFaturados = await db.select().from(salesOrders)
    .where(
      and(
        eq(salesOrders.estadoItem, 'Faturado'),
        isNotNull(salesOrders.codigoItem),
        isNotNull(salesOrders.quantidadeFaturada)
      )
    );
  console.log(`\nTotal faturados completos in sales_orders: ${allFaturados.length}`);
  
  // Group by codigoItem to see totals
  const byCode = new Map<string, number>();
  for (const r of allFaturados) {
    const code = r.codigoItem!;
    const qty = parseFloat(r.quantidadeFaturada || '0');
    byCode.set(code, (byCode.get(code) || 0) + qty);
  }
  console.log(`\nFaturados por código (top 10):`);
  const sorted = Array.from(byCode.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [code, qty] of sorted) {
    console.log(`  ${code}: ${qty} cx`);
  }
  
  process.exit(0);
}
main();
