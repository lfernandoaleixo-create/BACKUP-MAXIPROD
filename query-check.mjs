import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

// Check the inactive records to see if they had a different status before being deactivated
const inactive = await db.execute(sql`
  SELECT id, empresa, documento, CAST(valor AS CHAR) as valor, vencimento, dias_vencidos, tipo, status, ativo, 
    primeira_cobranca, promessa_pgto, sem_acao_1, segunda_cobranca,
    DATE_FORMAT(updatedAt, '%Y-%m-%d %H:%i') as updated
  FROM cobranca_planilha
  WHERE (empresa LIKE '%RAIANE%' OR empresa LIKE '%BRASILIENSE%')
  ORDER BY ativo DESC, id DESC
`);

console.log("=== ALL RECORDS ===");
for (const row of inactive[0]) {
  console.log(`ID: ${row.id} | Ativo: ${row.ativo} | ${row.empresa?.substring(0, 35)} | Doc: ${row.documento} | R$ ${row.valor} | Venc: ${row.vencimento} | Dias: ${row.dias_vencidos} | Tipo: ${row.tipo} | Status: ${row.status} | 1aCob: ${row.primeira_cobranca || '-'} | Promessa: ${row.promessa_pgto || '-'} | Updated: ${row.updated}`);
}

await connection.end();
