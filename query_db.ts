import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  
  console.log("=== accounts_receivable for FOGOS OURO (NF 394) ===");
  const result = await db.execute(sql`
    SELECT id, maxiprodId, estado, cliente, referenteA, valorOriginal, vencimentoData, formaCobranca, documentoVinculadoNumero, empresaNome, parcela, parcelasQuantidadeTotal, dadosCheque, situacaoTitulo
    FROM accounts_receivable 
    WHERE cliente LIKE '%FOGOS OURO%' AND documentoVinculadoNumero LIKE '%394%'
    ORDER BY id
  `);
  // drizzle execute returns [rows, fields]
  const rows = (result as any)[0] || result;
  console.log(JSON.stringify(rows, null, 2));
  
  console.log("\n=== ALL FOGOS OURO vencidos ===");
  const result2 = await db.execute(sql`
    SELECT id, maxiprodId, estado, referenteA, valorOriginal, vencimentoData, documentoVinculadoNumero, parcela, parcelasQuantidadeTotal, dadosCheque
    FROM accounts_receivable 
    WHERE cliente LIKE '%FOGOS OURO%' AND estado = 'EMITIDO'
    ORDER BY vencimentoData
  `);
  const rows2 = (result2 as any)[0] || result2;
  console.log(JSON.stringify(rows2, null, 2));
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
