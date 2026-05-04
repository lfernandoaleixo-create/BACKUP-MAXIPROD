/**
 * Seed script: Create suppliers table and insert all 3439 suppliers from PDF extraction
 */
import mysql from "mysql2/promise";
import fs from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL + "&multipleStatements=true");
  
  console.log("Connected to database");
  
  // Create tables
  console.log("Creating tables...");
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id int AUTO_INCREMENT NOT NULL,
      nome text NOT NULL,
      segmento varchar(100) NOT NULL,
      estado varchar(50) NOT NULL,
      cidade varchar(100),
      endereco text,
      telefone text,
      email varchar(320),
      website text,
      cnpj varchar(20),
      notas text,
      confianca varchar(10),
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(id)
    )
  `);
  
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS supplier_contacts (
      id int AUTO_INCREMENT NOT NULL,
      supplierId int NOT NULL,
      vendedor varchar(50) NOT NULL,
      formaContato enum('ligacao','email','whatsapp','outra') NOT NULL,
      formaContatoOutra text,
      observacao text,
      status enum('ja_cliente','possivel_cliente','novo_cliente','sem_interesse') NOT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(id)
    )
  `);
  
  console.log("Tables created");
  
  // Check if data already exists
  const [rows] = await connection.execute("SELECT COUNT(*) as cnt FROM suppliers");
  if (rows[0].cnt > 0) {
    console.log(`Suppliers table already has ${rows[0].cnt} rows. Skipping seed.`);
    await connection.end();
    return;
  }
  
  // Read supplier data
  const data = JSON.parse(fs.readFileSync("/home/ubuntu/suppliers_data.json", "utf-8"));
  console.log(`Inserting ${data.length} suppliers...`);
  
  // Insert in batches of 100
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const values = batch.flatMap(s => [
      s.nome,
      s.segmento,
      s.estado,
      s.cidade || null,
      s.endereco || null,
      s.telefone || null,
      s.email || null,
      s.website || null,
      s.cnpj || null,
      s.notas || null,
      s.confianca || null,
    ]);
    
    await connection.execute(
      `INSERT INTO suppliers (nome, segmento, estado, cidade, endereco, telefone, email, website, cnpj, notas, confianca) VALUES ${placeholders}`,
      values
    );
    
    inserted += batch.length;
    if (inserted % 500 === 0) {
      console.log(`  Inserted ${inserted}/${data.length}...`);
    }
  }
  
  console.log(`Done! Inserted ${inserted} suppliers.`);
  
  // Verify
  const [verify] = await connection.execute("SELECT COUNT(*) as cnt FROM suppliers");
  console.log(`Verification: ${verify[0].cnt} suppliers in database`);
  
  await connection.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
