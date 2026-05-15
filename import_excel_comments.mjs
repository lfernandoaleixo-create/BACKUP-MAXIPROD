/**
 * Importar comentários da planilha Excel do Thiago para a tabela cobranca_etapa_obs.
 * Mapeia cada comentário para a empresa + etapa correta.
 */
import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

// Column to etapa mapping (from the Excel structure)
// Col 1 = Promessa de pgto
// Col 2 = 1ª Cobrança
// Col 3 = Sem ação 1
// Col 4 = 2ª Cobrança
// Col 5 = Sem ação 2
// Col 6 = 3ª Cobrança
// Col 7 = Sem ação 3
// Col 8 = Ação Final
const COL_TO_ETAPA = {
  1: 'promessaPgto',
  2: 'primeiraCobranca',
  3: 'semAcao1',
  4: 'segundaCobranca',
  5: 'semAcao2',
  6: 'terceiraCobranca',
  7: 'semAcao3',
  8: 'acaoFinal',
};

// Load comments extracted from Excel
const comments = JSON.parse(readFileSync('/home/ubuntu/comments_COBRANÇA.json', 'utf-8'));
console.log(`Loaded ${comments.length} comments from Excel`);

// Connect to DB
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const url = new URL(dbUrl);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

console.log('Connected to database');

// Get all active planilha items
const [planilhaItems] = await conn.execute(
  'SELECT id, empresa FROM cobranca_planilha WHERE ativo = 1'
);
console.log(`Found ${planilhaItems.length} active items in cobranca_planilha`);

// Create empresa lookup (uppercase -> list of ids)
const empresaToIds = {};
for (const item of planilhaItems) {
  const key = (item.empresa || '').toUpperCase().trim();
  if (!empresaToIds[key]) empresaToIds[key] = [];
  empresaToIds[key].push(item.id);
}

let imported = 0;
let skipped = 0;
const notFound = new Set();
const alreadyProcessed = new Set(); // Track empresa+etapa+comment to avoid duplicates

for (const c of comments) {
  const empresa = (c.empresa || '').trim();
  const empresaUpper = empresa.toUpperCase();
  const col = c.col;
  const commentText = c.comment.trim();
  
  // Determine etapa from column
  const etapa = COL_TO_ETAPA[col];
  if (!etapa) {
    console.log(`  SKIP: Unknown column ${col} for ${empresa}`);
    skipped++;
    continue;
  }
  
  // Dedup key
  const dedupKey = `${empresaUpper}|${etapa}|${commentText}`;
  if (alreadyProcessed.has(dedupKey)) {
    console.log(`  DEDUP: ${empresa.slice(0, 40)} | ${etapa}`);
    skipped++;
    continue;
  }
  alreadyProcessed.add(dedupKey);
  
  // Find matching planilha items
  let matchingIds = empresaToIds[empresaUpper] || [];
  if (!matchingIds.length) {
    // Try partial match
    for (const [key, ids] of Object.entries(empresaToIds)) {
      if (empresaUpper.includes(key) || key.includes(empresaUpper)) {
        matchingIds = ids;
        break;
      }
    }
  }
  
  if (!matchingIds.length) {
    console.log(`  NOT FOUND: '${empresa}' (etapa=${etapa})`);
    notFound.add(empresa);
    skipped++;
    continue;
  }
  
  // Use the first matching ID
  const targetId = matchingIds[0];
  
  // Check if this exact observation already exists
  const [existing] = await conn.execute(
    'SELECT id FROM cobranca_etapa_obs WHERE planilha_id = ? AND etapa = ? AND observacao = ?',
    [targetId, etapa, commentText]
  );
  
  if (existing.length > 0) {
    console.log(`  ALREADY EXISTS: ${empresa.slice(0, 40)} | ${etapa}`);
    skipped++;
    continue;
  }
  
  // Insert the observation
  await conn.execute(
    `INSERT INTO cobranca_etapa_obs (planilha_id, etapa, observacao, registrado_por, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [targetId, etapa, commentText, 'Thiago (importado do Excel)']
  );
  imported++;
  console.log(`  IMPORTED: ${empresa.slice(0, 40)} | ${etapa} | ${commentText.slice(0, 60)}...`);
}

await conn.end();

console.log(`\n=== RESULTADO ===`);
console.log(`Importados: ${imported}`);
console.log(`Ignorados (duplicados/já existem/não encontrados): ${skipped}`);
if (notFound.size > 0) {
  console.log(`Empresas não encontradas: ${Array.from(notFound).join(', ')}`);
}
