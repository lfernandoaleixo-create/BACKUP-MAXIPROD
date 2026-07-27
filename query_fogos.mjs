import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);

// First check column names
const [cols] = await conn.query(`SHOW COLUMNS FROM accounts_receivable`);
console.log("Columns:", cols.map(c => c.Field).join(", "));

await conn.end();
