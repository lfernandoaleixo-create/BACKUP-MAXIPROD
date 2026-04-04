import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);

// Total de clientes distintos
const [totalRows] = await conn.execute(`
  SELECT COUNT(*) as total FROM (
    SELECT DISTINCT cliente FROM sales_orders WHERE cliente IS NOT NULL AND cliente != ''
    UNION
    SELECT DISTINCT cliente FROM accounts_receivable WHERE cliente IS NOT NULL AND cliente != ''
  ) all_clients
`);
console.log('Total clientes únicos:', totalRows[0].total);

// Quantos começam com A
const [aRows] = await conn.execute(`
  SELECT COUNT(*) as total FROM (
    SELECT DISTINCT cliente FROM sales_orders WHERE cliente IS NOT NULL AND cliente != '' AND cliente LIKE 'A%'
    UNION
    SELECT DISTINCT cliente FROM accounts_receivable WHERE cliente IS NOT NULL AND cliente != '' AND cliente LIKE 'A%'
  ) a_clients
`);
console.log('Clientes que começam com A:', aRows[0].total);

// Quantos CONTÊM A (LIKE %A%)
const [containsA] = await conn.execute(`
  SELECT COUNT(*) as total FROM (
    SELECT DISTINCT cliente FROM sales_orders WHERE cliente IS NOT NULL AND cliente != '' AND (cliente LIKE '%A%' OR clienteApelido LIKE '%A%')
    UNION
    SELECT DISTINCT cliente FROM accounts_receivable WHERE cliente IS NOT NULL AND cliente != '' AND cliente LIKE '%A%'
  ) contains_a
`);
console.log('Clientes que CONTÊM A:', containsA[0].total);

// Quantos começam com ESP
const [espRows] = await conn.execute(`
  SELECT COUNT(*) as total FROM (
    SELECT DISTINCT cliente FROM sales_orders WHERE cliente IS NOT NULL AND cliente != '' AND (cliente LIKE '%ESP%' OR clienteApelido LIKE '%ESP%')
    UNION
    SELECT DISTINCT cliente FROM accounts_receivable WHERE cliente IS NOT NULL AND cliente != '' AND cliente LIKE '%ESP%'
  ) esp_clients
`);
console.log('Clientes que contêm ESP:', espRows[0].total);

await conn.end();
