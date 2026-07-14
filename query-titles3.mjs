import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

const arIds = [45615327, 38272284, 7988425, 45615328, 38272289, 12129301, 6401364];

// Check collection_actions for these ar_ids
const actions = await db.execute(sql`
  SELECT id, receivableId, status, LEFT(observacoes, 100) as obs, DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i') as created, updatedBy
  FROM collection_actions
  WHERE receivableId IN (45615327, 38272284, 7988425, 45615328, 38272289, 12129301, 6401364)
  ORDER BY createdAt DESC
  LIMIT 20
`);

console.log("=== COLLECTION ACTIONS for RAIANE/BRASILIENSE ar_ids ===");
if (actions[0].length === 0) {
  console.log("(No collection_actions found for these ar_ids)");
} else {
  for (const row of actions[0]) {
    console.log(`${row.created} | arId: ${row.receivableId} | Status: ${row.status} | By: ${row.updatedBy} | Obs: ${row.obs || '-'}`);
  }
}

// Also check the accounts_receivable table for these ar_ids to see the original data
const ar = await db.execute(sql`
  SELECT id, empresa, documento, CAST(valor AS CHAR) as valor, vencimento, situacaoTitulo
  FROM accounts_receivable
  WHERE id IN (45615327, 45615328)
  LIMIT 5
`);

console.log("\n=== ACCOUNTS_RECEIVABLE (current active ar_ids) ===");
for (const row of ar[0]) {
  console.log(`arId: ${row.id} | ${row.empresa} | Doc: ${row.documento} | R$ ${row.valor} | Venc: ${row.vencimento} | Situação: ${row.situacaoTitulo}`);
}

// Check the cobranca_planilha_backup for any snapshot that might have these companies with different status
const backups = await db.execute(sql`
  SELECT id, DATE_FORMAT(snapshotDate, '%Y-%m-%d %H:%i') as snap_date, totalItems
  FROM cobranca_planilha_backup
  ORDER BY snapshotDate DESC
  LIMIT 5
`);

console.log("\n=== COBRANCA_PLANILHA BACKUPS ===");
for (const row of backups[0]) {
  console.log(`${row.snap_date} | Total items: ${row.totalItems} | Backup ID: ${row.id}`);
}

await connection.end();
