import mysql from 'mysql2/promise';
import 'dotenv/config';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// First check table structure
const [cols] = await conn.execute('SHOW COLUMNS FROM app_settings');
console.log('=== Columns ===');
cols.forEach(c => console.log(c.Field, c.Type));

// Get all rows
const [rows] = await conn.execute('SELECT * FROM app_settings');
console.log('\n=== All settings ===');
rows.forEach(r => console.log(JSON.stringify(r)));

await conn.end();
