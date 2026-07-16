import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not found"); process.exit(1); }

const url = new URL(DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname, port: parseInt(url.port || '3306'),
  user: url.username, password: url.password,
  database: url.pathname.slice(1), ssl: { rejectUnauthorized: false }
});

// 1. Get all Contatado entries and check which are missing data
console.log("=== Contatados sem dados de cobrança ===");
const [contatados] = await conn.query(
  `SELECT id, empresa, documento, primeira_cobranca, segunda_cobranca, terceira_cobranca, dias_vencidos, centro_custos, observacoes
   FROM cobranca_planilha 
   WHERE status = 'Contatado' 
   AND (primeira_cobranca IS NULL OR primeira_cobranca = '')
   ORDER BY dias_vencidos DESC`
);
console.log(`Contatados SEM 1ª cobrança: ${contatados.length}`);
for (const item of contatados) {
  console.log(`  ID:${item.id} | ${item.empresa?.substring(0, 40)} | Doc:${item.documento} | Dias:${item.dias_vencidos} | CC:${item.centro_custos}`);
}

// 2. Get all Contatado entries WITH data (for reference)
console.log("\n=== Contatados COM dados de cobrança ===");
const [contatadosComDados] = await conn.query(
  `SELECT id, empresa, documento, primeira_cobranca, segunda_cobranca, terceira_cobranca, dias_vencidos
   FROM cobranca_planilha 
   WHERE status = 'Contatado' 
   AND primeira_cobranca IS NOT NULL AND primeira_cobranca != ''
   ORDER BY dias_vencidos DESC`
);
console.log(`Contatados COM 1ª cobrança: ${contatadosComDados.length}`);
for (const item of contatadosComDados) {
  console.log(`  ID:${item.id} | ${item.empresa?.substring(0, 40)} | Doc:${item.documento} | 1ª:${item.primeira_cobranca} | 2ª:${item.segunda_cobranca || '-'}`);
}

// 3. Check cobranca_etapa_obs for the missing ones
console.log("\n=== Buscando observações registradas para os contatados sem dados ===");
const missingIds = contatados.map(c => c.id);
if (missingIds.length > 0) {
  const [obsForMissing] = await conn.query(
    `SELECT * FROM cobranca_etapa_obs WHERE planilha_id IN (${missingIds.join(',')}) ORDER BY created_at DESC`
  );
  console.log(`Observações encontradas: ${obsForMissing.length}`);
  for (const obs of obsForMissing) {
    console.log(`  Planilha:${obs.planilha_id} | Etapa:${obs.etapa} | Obs:${obs.observacao?.substring(0, 80)} | Por:${obs.registrado_por} | Em:${obs.created_at}`);
  }
}

// 4. Check the backup JSON for these specific IDs
console.log("\n=== Buscando nos backups ===");
const [latestBackup] = await conn.query(
  "SELECT id, snapshotDate, dataJson FROM cobranca_planilha_backup ORDER BY snapshotDate DESC LIMIT 1"
);
if (latestBackup.length > 0) {
  const backupData = typeof latestBackup[0].dataJson === 'string' ? JSON.parse(latestBackup[0].dataJson) : latestBackup[0].dataJson;
  console.log(`Backup de ${latestBackup[0].snapshotDate} - ${backupData.length} itens`);
  
  // Check if backup items have the same IDs
  for (const missingId of missingIds) {
    const found = backupData.find(b => b.id === missingId);
    if (found) {
      console.log(`\n  ID:${missingId} encontrado no backup:`);
      console.log(`    Empresa: ${found.empresa}`);
      console.log(`    Status: ${found.status}`);
      console.log(`    1ª Cobrança: ${found.primeiraCobranca || found.primeira_cobranca || 'N/A'}`);
      console.log(`    2ª Cobrança: ${found.segundaCobranca || found.segunda_cobranca || 'N/A'}`);
      console.log(`    Observações: ${found.observacoes?.substring(0, 100) || 'N/A'}`);
    }
  }
}

// 5. Also check collection_actions table
console.log("\n=== Verificando collection_actions ===");
const [collActions] = await conn.query("SHOW TABLES LIKE 'collection%'");
console.log("Tabelas collection:", collActions.map(t => Object.values(t)[0]));

const [actions] = await conn.query(
  `SELECT * FROM collection_actions ORDER BY created_at DESC LIMIT 20`
);
console.log(`\nÚltimas 20 collection_actions:`);
for (const a of actions) {
  console.log(`  ID:${a.id} | Titulo:${a.titulo_id || a.tituloId} | Tipo:${a.tipo || a.type} | Nota:${a.nota?.substring(0, 60) || '-'} | Por:${a.registrado_por || a.operador} | Em:${a.created_at}`);
}

await conn.end();
console.log("\nDone!");
