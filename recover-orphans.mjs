import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Strategy: The orphaned collection_actions have receivableIds that no longer exist.
// We need to find which CURRENT receivables they should be linked to.
// 
// The only way to match is through the collection_daily_actions table
// which might have client info, or by looking at the contatoHistorico JSON
// which might contain notes about the client.

const orphanedIds = [3768574, 3768657, 3768568, 3768760, 3768693, 3768585, 3768735, 3768694, 3768565, 3768566, 3768573, 3768682, 3768653, 3768650, 3893390, 3893393, 3768615, 4156550, 3768674];

// Get full details of orphaned collection_actions
const [orphanedActions] = await conn.execute(
  'SELECT id, receivableId, status, promessaData, promessaValor, observacoes, contatoHistorico, cobrancaStartedAt, phoneMutedBy, phoneMutedAt, createdAt FROM collection_actions WHERE receivableId IN (' + orphanedIds.join(',') + ')'
);

console.log('=== ORPHANED COLLECTION_ACTIONS ===');
console.log('Total:', orphanedActions.length);

// Check collection_daily_actions for these IDs - it might have client info
const [dailyActions] = await conn.execute(
  'SELECT receivableId, actionDate, actionType, operatorName, notes FROM collection_daily_actions WHERE receivableId IN (' + orphanedIds.join(',') + ') ORDER BY receivableId, actionDate'
);
console.log('\n=== DAILY ACTIONS for orphaned IDs ===');
console.log('Total:', dailyActions.length);
const grouped = {};
dailyActions.forEach(d => {
  if (!grouped[d.receivableId]) grouped[d.receivableId] = [];
  grouped[d.receivableId].push(d);
});
Object.entries(grouped).forEach(([id, actions]) => {
  console.log(`  recId ${id}: ${actions.length} daily actions`);
  actions.forEach(a => console.log(`    ${a.actionDate} | ${a.actionType} | ${a.operatorName} | ${a.notes || ''}`));
});

// The contatoHistorico might have useful info
console.log('\n=== CONTATO HISTORICO for orphaned ===');
for (const action of orphanedActions) {
  let hist = [];
  try {
    hist = typeof action.contatoHistorico === 'string' ? JSON.parse(action.contatoHistorico) : (action.contatoHistorico || []);
  } catch(e) {
    hist = action.contatoHistorico || [];
  }
  console.log(`  caId ${action.id} | recId ${action.receivableId} | status: ${action.status} | obs: ${(action.observacoes || '').substring(0, 50)} | hist entries: ${Array.isArray(hist) ? hist.length : 'not array'}`);
  if (Array.isArray(hist) && hist.length > 0) {
    hist.slice(0, 2).forEach(h => console.log(`    -> ${JSON.stringify(h).substring(0, 100)}`));
  }
}

// Now let's try to find matching current receivables
// The orphaned IDs are in the 3768xxx range which is PALITOS INDUSTRIA
// Let me check current EMITIDO overdue PALITOS without collection_actions
const [unmatched] = await conn.execute(`
  SELECT ar.id, ar.cliente, ar.documentoVinculadoNumero, ar.vencimentoData, ar.valorOriginal
  FROM accounts_receivable ar 
  LEFT JOIN collection_actions ca ON ar.id = ca.receivableId 
  WHERE ar.estado = 'EMITIDO' 
  AND ar.vencimentoData < CURDATE()
  AND ar.empresaNome = 'PALITOS INDUSTRIA'
  AND ca.id IS NULL
  ORDER BY ar.id
`);
console.log('\n=== CURRENT EMITIDO OVERDUE WITHOUT COLLECTION_ACTION ===');
console.log('Total:', unmatched.length);
unmatched.forEach(r => console.log(`  id: ${r.id} | ${(r.cliente||'').substring(0,30)} | doc: ${r.documentoVinculadoNumero} | venc: ${r.vencimentoData} | R$ ${r.valorOriginal}`));

await conn.end();
