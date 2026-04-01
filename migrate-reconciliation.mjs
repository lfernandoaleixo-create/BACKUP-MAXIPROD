import { createPool } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const pool = createPool(process.env.DATABASE_URL);

async function main() {
  const sql = `CREATE TABLE IF NOT EXISTS bank_reconciliation (
    id int AUTO_INCREMENT NOT NULL,
    date varchar(10) NOT NULL,
    checkedBy varchar(200) NOT NULL,
    checkedAt timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT bank_reconciliation_id PRIMARY KEY(id),
    CONSTRAINT bank_reconciliation_date_unique UNIQUE(date)
  );`;
  
  const [result] = await pool.execute(sql);
  console.log("Migration result:", result);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
