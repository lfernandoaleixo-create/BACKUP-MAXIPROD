import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await conn.query(`
  SELECT id, maxiprodId, cliente, estado, valorLiquido, vencimentoData, referenteA, parcela, parcelasQuantidadeTotal, formaCobranca, estadoConfiguravel, situacaoTitulo
  FROM accounts_receivable 
  WHERE cliente LIKE '%FOGOS OURO%' 
  ORDER BY vencimentoData DESC
`);
console.log("FOGOS OURO entries:");
for (const r of rows) {
  console.log(`  ID:${r.id} maxiprodId:${r.maxiprodId} estado:${r.estado} valor:${r.valorLiquido} venc:${r.vencimentoData} ref:${r.referenteA} parc:${r.parcela}/${r.parcelasQuantidadeTotal} forma:${r.formaCobranca} estadoConf:${r.estadoConfiguravel} situacao:${r.situacaoTitulo}`);
}

// Check collection_actions for these IDs
const ids = rows.map(r => r.id);
if (ids.length > 0) {
  const [actions] = await conn.query(`SELECT * FROM collection_actions WHERE receivable_id IN (?)`, [ids]);
  console.log("\nCollection actions:", actions.length);
  for (const a of actions) {
    console.log(`  receivable_id:${a.receivable_id} status:${a.status}`);
  }
}

await conn.end();
