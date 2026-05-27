import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.query("SELECT dataJson FROM dashboard_data WHERE empresa = 'TODAS' LIMIT 1");
const data = JSON.parse(rows[0].dataJson);
const item = data.find(i => i.codigoItem === '00808');
if (item) {
  console.log(JSON.stringify(item, null, 2));
} else {
  console.log('Product 00808 not found in TODAS');
  const similar = data.filter(i => i.descricaoItem && i.descricaoItem.includes('GLADE'));
  console.log('Similar items:', JSON.stringify(similar.map(i => ({ code: i.codigoItem, desc: i.descricaoItem, pedidosCx: i.pedidosCx, pedidosUn: i.pedidosUn })), null, 2));
}
await conn.end();
