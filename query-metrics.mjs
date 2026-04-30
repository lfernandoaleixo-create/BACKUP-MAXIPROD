import { getDb } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) { console.error('No DB'); process.exit(1); }

  // Result format is [rows, fields] where rows is array of objects
  const exec = async (q) => {
    const [rows] = await db.execute(sql.raw(q));
    return rows;
  };

  const tables = [
    'collection_actions',
    'collection_daily_actions',
    'collection_manual_ticks',
    'collection_manual_tick_history',
    'collection_step_overrides',
    'collection_documents',
    'resolved_receivables',
    'decision_pdf_history',
    'receivable_protest_config',
    'collection_action_edits'
  ];

  console.log('=== TABLE COUNTS ===');
  for (const t of tables) {
    const rows = await exec('SELECT COUNT(*) as cnt FROM ' + t);
    console.log(t + ':', rows[0].cnt);
  }

  const arRows = await exec("SELECT COUNT(*) as cnt FROM accounts_receivable WHERE estado = 'A RECEBER'");
  console.log('accounts_receivable (A RECEBER):', arRows[0].cnt);

  console.log('\n=== COLLECTION ACTION STATUSES ===');
  const statuses = await exec('SELECT status, COUNT(*) as cnt FROM collection_actions GROUP BY status ORDER BY cnt DESC');
  for (const s of statuses) console.log('  ' + s.status + ': ' + s.cnt);

  console.log('\n=== DAILY ACTION TYPES ===');
  const actionTypes = await exec('SELECT actionType, COUNT(*) as cnt FROM collection_daily_actions GROUP BY actionType ORDER BY cnt DESC');
  for (const a of actionTypes) console.log('  ' + a.actionType + ': ' + a.cnt);

  console.log('\n=== MANUAL TICKS (ticked=true) ===');
  const tickStatuses = await exec('SELECT step, tick_status, COUNT(*) as cnt FROM collection_manual_ticks WHERE ticked = 1 GROUP BY step, tick_status ORDER BY step');
  for (const t of tickStatuses) console.log('  Step ' + t.step + ' (' + t.tick_status + '): ' + t.cnt);

  console.log('\n=== RESOLVED RECEIVABLES ===');
  const resRows = await exec('SELECT COUNT(*) as cnt, SUM(valorAReceber) as total FROM resolved_receivables');
  console.log('Resolved: ' + resRows[0].cnt + ' titles, total R$ ' + Number(resRows[0].total || 0).toFixed(2));

  console.log('\n=== CONTATO HISTORICO ===');
  const totalContacts = await exec("SELECT SUM(JSON_LENGTH(contatoHistorico)) as total FROM collection_actions WHERE contatoHistorico IS NOT NULL AND contatoHistorico != '[]'");
  console.log('Total contacts in contatoHistorico:', totalContacts[0].total);

  // Contact types breakdown
  const contactTypes = await exec("SELECT jt.tipo, COUNT(*) as cnt FROM collection_actions ca, JSON_TABLE(ca.contatoHistorico, '$[*]' COLUMNS(tipo VARCHAR(30) PATH '$.tipo')) jt GROUP BY jt.tipo ORDER BY cnt DESC");
  console.log('\nContact types in contatoHistorico:');
  for (const c of contactTypes) console.log('  ' + c.tipo + ': ' + c.cnt);

  console.log('\n=== DECISION PDF TYPES ===');
  const decisions = await exec('SELECT decisao, COUNT(*) as cnt FROM decision_pdf_history GROUP BY decisao ORDER BY cnt DESC');
  for (const d of decisions) console.log('  ' + d.decisao + ': ' + d.cnt);

  console.log('\n=== RESOLVED BY DATE ===');
  const resolvedByDate = await exec("SELECT DATE(resolvedAt) as dt, COUNT(*) as cnt, SUM(valorAReceber) as total FROM resolved_receivables GROUP BY DATE(resolvedAt) ORDER BY dt");
  for (const r of resolvedByDate) console.log('  ' + r.dt + ': ' + r.cnt + ' titles, R$ ' + Number(r.total).toFixed(2));

  console.log('\n=== DAILY ACTIONS BY DATE ===');
  const dailyByDate = await exec("SELECT actionDate, COUNT(*) as cnt FROM collection_daily_actions GROUP BY actionDate ORDER BY actionDate");
  for (const d of dailyByDate) console.log('  ' + d.actionDate + ': ' + d.cnt + ' actions');

  console.log('\n=== TICK HISTORY ACTIONS ===');
  const tickHistory = await exec("SELECT action, COUNT(*) as cnt FROM collection_manual_tick_history GROUP BY action ORDER BY cnt DESC");
  for (const t of tickHistory) console.log('  ' + t.action + ': ' + t.cnt);

  console.log('\n=== PROTEST CONFIG ===');
  const protestTypes = await exec("SELECT protestType, COUNT(*) as cnt FROM receivable_protest_config GROUP BY protestType ORDER BY cnt DESC");
  for (const p of protestTypes) console.log('  ' + p.protestType + ': ' + p.cnt);

  // Resolved by statusCobranca
  console.log('\n=== RESOLVED BY STATUS COBRANCA ===');
  const resolvedByStatus = await exec("SELECT statusCobranca, COUNT(*) as cnt, SUM(valorAReceber) as total FROM resolved_receivables GROUP BY statusCobranca ORDER BY cnt DESC");
  for (const r of resolvedByStatus) console.log('  ' + r.statusCobranca + ': ' + r.cnt + ' titles, R$ ' + Number(r.total).toFixed(2));

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
