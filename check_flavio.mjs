import mysql from "mysql2/promise";
const pool = mysql.createPool(process.env.DATABASE_URL);

async function main() {
  const [rows] = await pool.query('SELECT * FROM operator_granular_access WHERE operator_name LIKE "%Flavio%" OR operator_name LIKE "%flavio%"');
  console.log("Flavio access:", JSON.stringify(rows, null, 2));
  const [rows2] = await pool.query('SELECT * FROM operator_granular_access WHERE access_key = "fin.cobranca"');
  console.log("\nfin.cobranca access:", JSON.stringify(rows2, null, 2));
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
