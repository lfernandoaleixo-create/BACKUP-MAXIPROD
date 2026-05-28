import mysql from 'mysql2/promise';

async function main() {
  const url = process.env.DATABASE_URL;
  const conn = await mysql.createConnection(url);
  
  // Check available backups
  const [backups] = await conn.execute(
    'SELECT id, snapshotDate, totalItems, createdBy FROM cobranca_planilha_backup ORDER BY id DESC LIMIT 10'
  );
  console.log('=== BACKUPS DISPONÍVEIS ===');
  console.log(JSON.stringify(backups, null, 2));
  
  // Check the most recent backup that has status data
  if (backups.length > 0) {
    const latestId = backups[0].id;
    console.log(`\n=== ANALISANDO BACKUP #${latestId} ===`);
    const [data] = await conn.execute(
      `SELECT dataJson FROM cobranca_planilha_backup WHERE id = ?`, [latestId]
    );
    if (data.length > 0) {
      const items = typeof data[0].dataJson === 'string' ? JSON.parse(data[0].dataJson) : data[0].dataJson;
      console.log(`Total items no backup: ${items.length}`);
      
      // Count status distribution in backup
      const statusDist = {};
      let withObs = 0;
      let withPromessa = 0;
      let withCobranca = 0;
      for (const item of items) {
        if (item.ativo) {
          const s = item.status || 'null';
          statusDist[s] = (statusDist[s] || 0) + 1;
          if (item.observacoes) withObs++;
          if (item.promessaPgto) withPromessa++;
          if (item.primeiraCobranca || item.segundaCobranca || item.terceiraCobranca) withCobranca++;
        }
      }
      console.log('\nDistribuição de status (ATIVOS) no backup:');
      console.log(JSON.stringify(statusDist, null, 2));
      console.log(`Com observações: ${withObs}`);
      console.log(`Com promessa de pgto: ${withPromessa}`);
      console.log(`Com etapas de cobrança: ${withCobranca}`);
    }
  }
  
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
