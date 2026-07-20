import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection(url);

// Total rows and unique
const [rows1] = await conn.execute('SELECT COUNT(*) as total_rows, COUNT(DISTINCT receivableId) as unique_ids FROM resolved_receivables');
console.log('Total rows:', rows1[0].total_rows, '| Unique receivableIds:', rows1[0].unique_ids);

// Total value with 3-day rule
const [rows2] = await conn.execute('SELECT ROUND(SUM(CAST(valorAReceber AS DECIMAL(18,2))), 2) as total_valor, COUNT(*) as cnt FROM resolved_receivables WHERE diasAtrasoNaResolucao >= 3');
console.log('Total valor (3+ dias):', rows2[0].total_valor, '| Count:', rows2[0].cnt);

// Top 10 clients by value
const [rows3] = await conn.execute(`SELECT cliente, ROUND(SUM(CAST(valorAReceber AS DECIMAL(18,2))), 2) as total, COUNT(*) as titulos FROM resolved_receivables WHERE diasAtrasoNaResolucao >= 3 GROUP BY cliente ORDER BY SUM(CAST(valorAReceber AS DECIMAL(18,2))) DESC LIMIT 10`);
console.log('\nTop 10 clientes por valor recuperado:');
for (const r of rows3) {
  console.log(`  ${r.cliente}: R$ ${r.total} (${r.titulos} titulos)`);
}

// Check CLIENTE PEDIDO VENDA
const [rows4] = await conn.execute(`SELECT id, cliente, valorAReceber, resolvedAt, diasAtrasoNaResolucao FROM resolved_receivables WHERE cliente = 'CLIENTE PEDIDO VENDA'`);
if (rows4.length > 0) {
  console.log('\nCLIENTE PEDIDO VENDA encontrado:', rows4.length, 'registros');
  for (const r of rows4) {
    console.log(`  id=${r.id} valor=${r.valorAReceber} resolved=${r.resolvedAt} dias=${r.diasAtrasoNaResolucao}`);
  }
}

await conn.end();
