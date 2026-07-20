import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT id, receivableId, valorAReceber, vencimentoData, documento, resolvedAt FROM resolved_receivables WHERE cliente LIKE '%KEURE%' AND valorAReceber = 8750.00"
);
console.table(rows);
await conn.end();
