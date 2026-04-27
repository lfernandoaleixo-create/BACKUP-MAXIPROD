import mysql from 'mysql2/promise';

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const conn = await mysql.createConnection(DATABASE_URL + '&ssl={"rejectUnauthorized":true}');
  
  const [rows] = await conn.execute('SELECT dataJson FROM dashboard_data ORDER BY computedAt DESC LIMIT 1');
  if (rows.length === 0) { console.log('No dashboard data'); await conn.end(); return; }
  
  const items = JSON.parse(rows[0].dataJson);
  
  // Filter import items only (not industrializacao)
  const importItems = items.filter(i => i.grupo !== 'industrializacao');
  
  // Sum pedidosCx for import items (excluding children to avoid double counting)
  const parentImportItems = importItems.filter(i => !i.isChild);
  const totalPedidosCx = parentImportItems.reduce((sum, i) => sum + (i.pedidosCx || 0), 0);
  
  console.log('Import parent items count:', parentImportItems.length);
  console.log('Total pedidosCx (parent import):', totalPedidosCx);
  
  // Also show all items with pedidosCx > 0
  const withPedidos = parentImportItems.filter(i => (i.pedidosCx || 0) > 0);
  console.log('\nImport items with pedidos > 0:');
  for (const item of withPedidos) {
    console.log(`  ${item.codigoItem} - ${item.descricaoItem.substring(0, 50)} - pedidosCx: ${item.pedidosCx}`);
  }
  
  // Also sum ALL items (including children) to see the total
  const allImportPedidos = importItems.reduce((sum, i) => sum + (i.pedidosCx || 0), 0);
  console.log('\nTotal pedidosCx (all import including children):', allImportPedidos);
  
  // Now check the raw order_items to see what estadoNota values are being used
  // and what the sum would be if we only include "Aprovado"
  const [orderRows] = await conn.execute(`
    SELECT estadoNota, 
           SUM(CAST(quantidade AS DECIMAL(18,2))) as totalQtyCx,
           COUNT(*) as cnt
    FROM order_items 
    WHERE UPPER(COALESCE(estadoConfiguravel,'')) NOT IN ('E-COMMERCE', 'ECOMMERCE')
    GROUP BY estadoNota
  `);
  console.log('\nRaw order_items by estadoNota (excluding E-COMMERCE):');
  console.table(orderRows);
  
  // What would the total be if we only include "Aprovado"?
  const [aprovadoRows] = await conn.execute(`
    SELECT SUM(CAST(quantidade AS DECIMAL(18,2))) as totalQtyCx,
           COUNT(*) as cnt
    FROM order_items 
    WHERE estadoNota = 'Aprovado'
      AND UPPER(COALESCE(estadoConfiguravel,'')) NOT IN ('E-COMMERCE', 'ECOMMERCE')
  `);
  console.log('\nOnly Aprovado orders (excluding E-COMMERCE):');
  console.table(aprovadoRows);
  
  await conn.end();
}
main().catch(console.error);
