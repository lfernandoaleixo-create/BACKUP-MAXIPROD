import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { stockInsufficientAlerts } from "./drizzle/schema.ts";
import { eq, desc } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

const alerts = await db.select().from(stockInsufficientAlerts).where(eq(stockInsufficientAlerts.codigoItem, '00047')).orderBy(desc(stockInsufficientAlerts.id));
for (const a of alerts) {
  console.log(`ID:${a.id} | Pedido:${a.pedidoNumero} | Status:${a.status} | Resp:${a.respondidoPor || 'null'} | RespEm:${a.respondidoEm || 'null'} | Criado:${a.criadoPor} | CriadoEm:${a.createdAt}`);
}
console.log(`\nTotal: ${alerts.length} alerts`);
await connection.end();
