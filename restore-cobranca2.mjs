import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const url = new URL(DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname, port: parseInt(url.port || '3306'),
  user: url.username, password: url.password,
  database: url.pathname.slice(1), ssl: { rejectUnauthorized: false }
});

// Get full diary entries for the target clients
console.log("=== DIÁRIO DE COBRANÇA ===");
const [diaryEntries] = await conn.query(
  `SELECT id, cliente_name, etapa_atual, tipo_contato, resumo, observacoes, operador_name, created_at 
   FROM collection_diary_entries 
   WHERE cliente_name LIKE '%ESPETINHOS COROMANDEL%' 
      OR cliente_name LIKE '%A.J COMERCIAL%' 
      OR cliente_name LIKE '%ACOUGUE L P%' 
      OR cliente_name LIKE '%PAULYNELLE%' 
      OR cliente_name LIKE '%MC COMERCIO%' 
      OR cliente_name LIKE '%VALVES%' 
      OR cliente_name LIKE '%NATALIA RODRIGUES%' 
      OR cliente_name LIKE '%MAISA CRISTINA%' 
      OR cliente_name LIKE '%COOPERATIVA DE CREDITO CREDPLUS%'
   ORDER BY created_at DESC`
);
console.log(`Entradas no diário: ${diaryEntries.length}`);
for (const e of diaryEntries) {
  console.log(`\n  [${e.created_at}] ${e.cliente_name}`);
  console.log(`    Etapa: ${e.etapa_atual} | Tipo: ${e.tipo_contato} | Por: ${e.operador_name}`);
  console.log(`    Resumo: ${e.resumo}`);
  if (e.observacoes) console.log(`    Obs: ${e.observacoes}`);
}

// Check collection_actions - get column names first
console.log("\n\n=== COLLECTION ACTIONS (estrutura) ===");
const [cols] = await conn.query("SHOW COLUMNS FROM collection_actions");
console.log("Colunas:", cols.map(c => c.Field).join(', '));

// Get actions for the target clients
const [actions] = await conn.query(
  `SELECT * FROM collection_actions 
   WHERE id IN (
     SELECT id FROM collection_actions 
     ORDER BY id DESC LIMIT 50
   )
   ORDER BY id DESC`
);
console.log(`\nÚltimas 50 actions:`);
for (const a of actions.slice(0, 30)) {
  const keys = Object.keys(a);
  const tituloKey = keys.find(k => k.includes('titulo') || k.includes('planilha'));
  const notaKey = keys.find(k => k.includes('nota') || k.includes('obs'));
  const tipoKey = keys.find(k => k.includes('tipo') || k.includes('type') || k.includes('action'));
  const operKey = keys.find(k => k.includes('oper') || k.includes('registrado'));
  console.log(`  ID:${a.id} | ${tituloKey}:${a[tituloKey]} | ${tipoKey}:${a[tipoKey]} | ${notaKey}:${a[notaKey]?.substring(0, 60) || '-'} | ${operKey}:${a[operKey]}`);
}

// Check collection_manual_ticks for the target clients
console.log("\n\n=== COLLECTION MANUAL TICKS ===");
const [tickCols] = await conn.query("SHOW COLUMNS FROM collection_manual_ticks");
console.log("Colunas:", tickCols.map(c => c.Field).join(', '));

const [ticks] = await conn.query(
  `SELECT * FROM collection_manual_ticks ORDER BY id DESC LIMIT 30`
);
console.log(`\nÚltimos 30 ticks:`);
for (const t of ticks.slice(0, 20)) {
  console.log(`  ${JSON.stringify(t).substring(0, 200)}`);
}

// Check collection_status for the target clients
console.log("\n\n=== COLLECTION STATUS ===");
const [statusCols] = await conn.query("SHOW COLUMNS FROM collection_status");
console.log("Colunas:", statusCols.map(c => c.Field).join(', '));

const [statuses] = await conn.query(
  `SELECT * FROM collection_status ORDER BY id DESC LIMIT 20`
);
console.log(`\nÚltimos 20 statuses:`);
for (const s of statuses.slice(0, 15)) {
  console.log(`  ${JSON.stringify(s).substring(0, 200)}`);
}

// Check diary snapshots for the most recent one
console.log("\n\n=== DIARY SNAPSHOTS ===");
const [snapshots] = await conn.query(
  `SELECT id, snapshot_date, total_clientes, total_titulos, entries_count FROM collection_diary_snapshots ORDER BY snapshot_date DESC LIMIT 5`
);
console.log("Snapshots recentes:");
for (const s of snapshots) {
  console.log(`  ${s.snapshot_date} | Clientes:${s.total_clientes} | Títulos:${s.total_titulos} | Entries:${s.entries_count}`);
}

// Get the latest snapshot data
if (snapshots.length > 0) {
  const [latestSnap] = await conn.query(
    `SELECT snapshot_data FROM collection_diary_snapshots WHERE id = ?`, [snapshots[0].id]
  );
  if (latestSnap.length > 0) {
    const snapData = typeof latestSnap[0].snapshot_data === 'string' ? JSON.parse(latestSnap[0].snapshot_data) : latestSnap[0].snapshot_data;
    console.log(`\nSnapshot ${snapshots[0].snapshot_date} - ${snapData.length} clientes:`);
    for (const client of snapData) {
      const name = client.clienteName || client.cliente || '';
      if (name.includes('ESPETINHOS COROMANDEL') || name.includes('A.J COMERCIAL') || 
          name.includes('ACOUGUE L P') || name.includes('PAULYNELLE') || 
          name.includes('MC COMERCIO') || name.includes('VALVES') ||
          name.includes('NATALIA RODRIGUES') || name.includes('MAISA CRISTINA') ||
          name.includes('COOPERATIVA DE CREDITO CREDPLUS')) {
        console.log(`\n  ${name}`);
        console.log(`    Etapa: ${client.etapa}`);
        console.log(`    Títulos: ${client.titulosCount}`);
        console.log(`    Valor: ${client.valorDevido}`);
        console.log(`    Última ação: ${client.ultimaAcao || 'N/A'}`);
        if (client.entriesDoDia?.length > 0) {
          for (const entry of client.entriesDoDia) {
            console.log(`    → ${entry.resumo} (${entry.operador})`);
          }
        }
      }
    }
  }
}

await conn.end();
console.log("\n\nDone!");
