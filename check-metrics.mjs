import { getDb } from './server/db.ts';
import { sql } from 'drizzle-orm';

const db = await getDb();

// Check falhas - red ticks NOT by SISTEMA
const [falhas] = await db.execute(sql.raw("SELECT COUNT(*) as cnt FROM collection_manual_ticks WHERE ticked = 1 AND tick_status = 'red' AND ticked_by != 'SISTEMA'"));
console.log('Falhas (excl SISTEMA):', falhas[0]);

// Check ALL red ticks
const [allRed] = await db.execute(sql.raw("SELECT ticked_by, COUNT(*) as cnt FROM collection_manual_ticks WHERE ticked = 1 AND tick_status = 'red' GROUP BY ticked_by"));
console.log('Red ticks by who:', allRed);

// Check resolved values
const [resolved] = await db.execute(sql.raw("SELECT COUNT(*) as cnt, SUM(valorAReceber) as total FROM resolved_receivables WHERE diasAtrasoNaResolucao >= 3 AND cliente NOT IN ('CLIENTE TESTE REGRA','CLIENTE MANUAL TICK TEST','CLIENTE LEGACY VIBRATION TEST','CLIENTE RECENT VIBRATION TEST','CLIENTE TESTE COBRANCA')"));
console.log('Resolved (filtered):', resolved[0]);

// Check blue ticks
const [blueTicks] = await db.execute(sql.raw("SELECT step, ticked_by, COUNT(*) as cnt FROM collection_manual_ticks WHERE ticked = 1 AND tick_status = 'blue' GROUP BY step, ticked_by"));
console.log('Blue ticks:', blueTicks);

// Check tick history actions
const [tickHistory] = await db.execute(sql.raw("SELECT action, COUNT(*) as cnt FROM collection_manual_tick_history GROUP BY action ORDER BY cnt DESC"));
console.log('Tick history actions:', tickHistory);

process.exit(0);
