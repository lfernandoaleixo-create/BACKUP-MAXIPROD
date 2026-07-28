import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { salesOrderRequests } from './drizzle/schema.js';
import { like } from 'drizzle-orm';

const pool = mysql.createPool(process.env.DATABASE_URL!);
const db = drizzle(pool);
const rows = await db.select({
  id: salesOrderRequests.id,
  orderNumber: salesOrderRequests.orderNumber,
  sellerName: salesOrderRequests.sellerName,
  gestorName: salesOrderRequests.gestorName,
  status: salesOrderRequests.status,
  client: salesOrderRequests.razaoSocial
}).from(salesOrderRequests).where(like(salesOrderRequests.razaoSocial, '%Samanta%'));
console.log(JSON.stringify(rows, null, 2));
await pool.end();
