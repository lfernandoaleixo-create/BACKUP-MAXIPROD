import { getDb } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();
  const [rows] = await db.execute(sql`
    SELECT ticked_by, COUNT(*) as cnt 
    FROM collection_manual_ticks 
    WHERE step_index = 2 AND color = 'red'
    GROUP BY ticked_by
  `);
  console.log('Red ticks in step index 2 (Ação 2):', rows);
  
  const [rows2] = await db.execute(sql`
    SELECT ticked_by, step_index, color, COUNT(*) as cnt 
    FROM collection_manual_ticks 
    WHERE color = 'red'
    GROUP BY ticked_by, step_index, color
  `);
  console.log('All red ticks by ticked_by and step:', rows2);
  process.exit(0);
}
main();
