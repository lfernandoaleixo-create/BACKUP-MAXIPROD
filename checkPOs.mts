import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { purchaseOrderItems } from './drizzle/schema.ts';
import { sql } from 'drizzle-orm';

const pool = mysql.createPool(process.env.DATABASE_URL!);
const db = drizzle(pool);

const rows = await db.execute(sql`SELECT referencia, codigoItem, descricaoItem, quantidade FROM purchase_order_items ORDER BY referencia, codigoItem`);
console.table(rows[0]);

await pool.end();
process.exit(0);
