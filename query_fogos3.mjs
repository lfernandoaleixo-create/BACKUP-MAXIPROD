import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [cols] = await conn.query(`SHOW COLUMNS FROM collection_actions`);
console.log("collection_actions columns:", cols.map(c => c.Field).join(", "));

const [actions] = await conn.query(`SELECT * FROM collection_actions WHERE receivableId = 54847993`);
console.log("\nActions for FOGOS OURO (ID 54847993):", JSON.stringify(actions, null, 2));

await conn.end();
