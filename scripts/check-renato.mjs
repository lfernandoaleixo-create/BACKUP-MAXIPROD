import 'dotenv/config';
import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check operators table for Renato
const [operators] = await conn.execute(`SELECT id, name, password, active FROM operators WHERE name LIKE '%Renato%' OR password = 'Renato'`);
console.log("=== Operators matching 'Renato' ===");
console.table(operators);

// Also check all operators to see what passwords look like
const [allOps] = await conn.execute(`SELECT id, name, password, active FROM operators ORDER BY name`);
console.log("\n=== All operators ===");
console.table(allOps.map(o => ({ id: o.id, name: o.name, password: o.password, active: o.active })));

// Check seller_permissions for Renato
const [sellers] = await conn.execute(`SELECT id, seller_name, password, authorized FROM seller_permissions WHERE seller_name LIKE '%Renato%' OR password = 'Renato'`);
console.log("\n=== Sellers matching 'Renato' ===");
console.table(sellers);

await conn.end();
