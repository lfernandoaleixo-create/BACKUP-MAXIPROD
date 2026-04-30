import { getDb } from './server/db.ts';
import { sql } from 'drizzle-orm';

const db = await getDb();

const TEST_CLIENTS = "('CLIENTE TESTE REGRA','CLIENTE MANUAL TICK TEST','CLIENTE LEGACY VIBRATION TEST','CLIENTE RECENT VIBRATION TEST','CLIENTE TESTE COBRANCA')";

// Metrics query (what we show)
const [metricsQ] = await db.execute(sql.raw(`SELECT COUNT(*) as cnt, SUM(valorAReceber) as total FROM resolved_receivables WHERE diasAtrasoNaResolucao >= 3 AND cliente NOT IN ${TEST_CLIENTS}`));
console.log('Metrics query:', metricsQ[0]);

// Check if getResolvedTitles has additional filters
const [allResolved] = await db.execute(sql.raw(`SELECT id, cliente, documento, valorAReceber, diasAtrasoNaResolucao, resolvedAt FROM resolved_receivables ORDER BY resolvedAt DESC`));
console.log('Total ALL resolved:', allResolved.length);

const [filtered] = await db.execute(sql.raw(`SELECT id, cliente, documento, valorAReceber, diasAtrasoNaResolucao FROM resolved_receivables WHERE diasAtrasoNaResolucao >= 3 AND cliente NOT IN ${TEST_CLIENTS}`));
console.log('Total filtered (3+ days, no test):', filtered.length);

// Check what the UI card shows - maybe it uses a different query
// Let me check the getResolvedTitles endpoint
const [uiCard] = await db.execute(sql.raw(`SELECT COUNT(*) as cnt, COALESCE(SUM(valorAReceber),0) as total FROM resolved_receivables WHERE diasAtrasoNaResolucao >= 3 AND cliente NOT IN ${TEST_CLIENTS}`));
console.log('UI card query:', uiCard[0]);

process.exit(0);
