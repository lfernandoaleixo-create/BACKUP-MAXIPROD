import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const resolvedIds = new Set([3768685, 3768686, 3768748, 3768758, 3768759, 3768678, 3768594, 3768704, 3893394, 3893395, 3893396, 3893397, 3893399, 4158596]);
const allOrphaned = [3768594, 3768574, 3768678, 3768657, 3768568, 3768760, 3768693, 3768585, 3768735, 3768758, 3768694, 3768565, 3768566, 3768573, 3768682, 3768704, 3768748, 3768686, 3768685, 3768759, 1, 3768653, 3768650, 3893390, 3893393, 3893394, 3893395, 3893396, 3893397, 3893399, 3768615, 4156550, 4158596, 3768674];

const nonResolved = allOrphaned.filter(id => !resolvedIds.has(id) && id !== 1);
console.log('Non-resolved orphaned IDs:', nonResolved.length);
console.log(nonResolved);

// Check their collection_actions status
const [actions] = await conn.execute('SELECT id, receivableId, status, cobrancaStartedAt FROM collection_actions WHERE receivableId IN (' + nonResolved.join(',') + ')');
console.log('\nTheir collection_actions:');
actions.forEach(a => console.log('  caId:', a.id, '| recId:', a.receivableId, '| status:', a.status, '| started:', a.cobrancaStartedAt));

// Check manual ticks
const [ticksInfo] = await conn.execute('SELECT cmt.receivable_id, cmt.step, cmt.tick_status FROM collection_manual_ticks cmt WHERE cmt.receivable_id IN (' + nonResolved.join(',') + ') ORDER BY cmt.receivable_id, cmt.step');
console.log('\nManual ticks for non-resolved orphaned:');
const grouped = {};
ticksInfo.forEach(t => {
  if (!grouped[t.receivable_id]) grouped[t.receivable_id] = [];
  grouped[t.receivable_id].push(t.step + ':' + t.tick_status);
});
Object.entries(grouped).forEach(([id, steps]) => console.log('  recId:', id, '| steps:', steps.join(', ')));

// Now check: which of these orphaned IDs have a matching receivable by maxiprodId?
// The resolved_receivables table has maxiprodId - let me use that to find matches
const [resolvedWithMaxId] = await conn.execute('SELECT receivableId, maxiprodId, cliente FROM resolved_receivables WHERE receivableId IN (' + nonResolved.join(',') + ')');
console.log('\nResolved with maxiprodId (should be 0 since these are non-resolved):', resolvedWithMaxId.length);

// The key insight: these orphaned actions' receivables were REMOVED from accounts_receivable
// They are NOT in resolved_receivables either
// This means they were either:
// 1. Paid normally (estado changed to RECEBIDO and then removed from sync)
// 2. Their maxiprodId changed in the Maxiprod system

// Let me check: are there any current EMITIDO receivables that DON'T have collection_actions
// but SHOULD (because they match the same client/document as an orphaned action)?
// Without knowing the client name of the orphaned IDs, I can only check by looking at
// what the frontend shows

// Summary: How many are currently showing as Pendente?
const [pendente] = await conn.execute(`
  SELECT COUNT(*) as cnt FROM accounts_receivable ar 
  LEFT JOIN collection_actions ca ON ar.id = ca.receivableId 
  WHERE ar.vencimentoData < CURDATE() 
  AND ar.estado = 'EMITIDO' 
  AND ar.empresaNome = 'PALITOS INDUSTRIA'
  AND (ca.id IS NULL OR ca.status = 'pendente')
`);
console.log('\nTotal showing as Pendente (PALITOS):', pendente[0].cnt);

// How many have NO collection_action at all?
const [noAction] = await conn.execute(`
  SELECT COUNT(*) as cnt FROM accounts_receivable ar 
  LEFT JOIN collection_actions ca ON ar.id = ca.receivableId 
  WHERE ar.vencimentoData < CURDATE() 
  AND ar.estado = 'EMITIDO' 
  AND ar.empresaNome = 'PALITOS INDUSTRIA'
  AND ca.id IS NULL
`);
console.log('No collection_action at all (PALITOS):', noAction[0].cnt);

// How many have status = pendente?
const [statusPendente] = await conn.execute(`
  SELECT COUNT(*) as cnt FROM accounts_receivable ar 
  JOIN collection_actions ca ON ar.id = ca.receivableId 
  WHERE ar.vencimentoData < CURDATE() 
  AND ar.estado = 'EMITIDO' 
  AND ar.empresaNome = 'PALITOS INDUSTRIA'
  AND ca.status = 'pendente'
`);
console.log('Status pendente (PALITOS):', statusPendente[0].cnt);

await conn.end();
