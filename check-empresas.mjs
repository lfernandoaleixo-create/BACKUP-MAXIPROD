import { getDb } from './server/db.ts';
import { accountsReceivable } from './drizzle/schema.ts';
import { sql, eq, inArray } from 'drizzle-orm';

const VALID_TYPES = ["TITULO", "RECEITA", "ADIANTAMENTO"];

const db = await getDb();
const rows = await db.select({
  empresa: accountsReceivable.empresaNome,
  count: sql`COUNT(*)`,
  total: sql`SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2)))`
}).from(accountsReceivable)
  .where(sql`${accountsReceivable.estado} = 'EMITIDO' AND ${accountsReceivable.tipo} IN ('TITULO', 'RECEITA', 'ADIANTAMENTO')`)
  .groupBy(accountsReceivable.empresaNome);

for (const r of rows) {
  console.log(`${r.empresa}: count=${r.count}, total=${r.total}`);
}
process.exit(0);
