// Quick check using raw mysql2 connection
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await mysql.createConnection(url);

const [salesClients] = await conn.query('SELECT COUNT(DISTINCT cliente) as cnt FROM sales_orders');
console.log('Clientes em sales_orders:', salesClients[0].cnt);

const [arClients] = await conn.query('SELECT COUNT(DISTINCT cliente) as cnt FROM accounts_receivable');
console.log('Clientes em accounts_receivable:', arClients[0].cnt);

const [onlyAR] = await conn.query(`
  SELECT COUNT(DISTINCT ar.cliente) as cnt 
  FROM accounts_receivable ar 
  LEFT JOIN sales_orders so ON ar.cliente = so.cliente 
  WHERE so.cliente IS NULL
`);
console.log('Clientes APENAS em accounts_receivable (não em sales_orders):', onlyAR[0].cnt);

const [sampleAR] = await conn.query(`
  SELECT DISTINCT ar.cliente 
  FROM accounts_receivable ar 
  LEFT JOIN sales_orders so ON ar.cliente = so.cliente 
  WHERE so.cliente IS NULL 
  LIMIT 15
`);
console.log('Exemplos de clientes apenas em AR:', sampleAR.map(r => r.cliente));

// Total unique clients across all sources
const [totalUnion] = await conn.query(`
  SELECT COUNT(*) as cnt FROM (
    SELECT DISTINCT cliente FROM sales_orders WHERE cliente IS NOT NULL AND cliente != ''
    UNION
    SELECT DISTINCT cliente FROM accounts_receivable WHERE cliente IS NOT NULL AND cliente != ''
  ) t
`);
console.log('\nTotal clientes ÚNICOS (sales_orders + accounts_receivable):', totalUnion[0].cnt);

// Check order_items
try {
  const [oiClients] = await conn.query('SELECT COUNT(DISTINCT cliente) as cnt FROM order_items');
  console.log('Clientes em order_items:', oiClients[0].cnt);
} catch(e) {
  console.log('order_items não tem coluna cliente ou tabela não existe');
}

await conn.end();
