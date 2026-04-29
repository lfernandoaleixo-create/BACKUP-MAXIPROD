import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Search for MD da Silva
const [rows] = await conn.execute(
  "SELECT pedido, cliente, clienteApelido, estadoConfiguravel, estadoItem, estadoNotaPedido, valorTotal, valorTotalPedido, dataEmissao FROM sales_orders WHERE cliente LIKE '%MD%SILVA%' OR clienteApelido LIKE '%MD%SILVA%' OR cliente LIKE '%MD DA SILVA%' OR clienteApelido LIKE '%MD DA SILVA%' ORDER BY dataEmissao DESC LIMIT 20"
);

console.log(`Found ${rows.length} rows for MD da Silva:`);
for (const r of rows) {
  console.log(`Pedido: ${r.pedido} | Cliente: ${r.clienteApelido || r.cliente} | EstadoConfig: "${r.estadoConfiguravel}" | EstadoItem: "${r.estadoItem}" | EstadoNota: "${r.estadoNotaPedido}" | Valor: ${r.valorTotal} | ValorPedido: ${r.valorTotalPedido} | Data: ${r.dataEmissao}`);
}

// Also check all distinct estadoConfiguravel values
const [estados] = await conn.execute(
  "SELECT DISTINCT estadoConfiguravel, COUNT(*) as cnt FROM sales_orders GROUP BY estadoConfiguravel ORDER BY cnt DESC"
);
console.log('\nAll distinct estadoConfiguravel values:');
for (const e of estados) {
  console.log(`  - "${e.estadoConfiguravel}" (${e.cnt} rows)`);
}

await conn.end();
