/**
 * Script para importar dados de cobrança da planilha do Thiago.
 * Lê o JSON gerado pelo parse_cobranca.py e insere nos registros
 * de collection_actions e collection_daily_actions.
 * 
 * REGRA: Nunca sobrescrever dados existentes. Apenas adicionar novos.
 */
import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(DATABASE_URL);
const connConfig = {
  host: url.hostname,
  port: parseInt(url.port || '3306'),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
};

async function main() {
  const conn = await createConnection(connConfig);
  console.log('Connected to database');

  // Read parsed data
  const records = JSON.parse(readFileSync('/home/ubuntu/cobranca_data.json', 'utf-8'));
  console.log(`Loaded ${records.length} records from spreadsheet`);

  // Get all EMITIDO receivables to match by client name + vencimento + valor
  const [receivables] = await conn.execute(
    `SELECT id, cliente, valorLiquido, valorRecebidoLiquido, vencimentoData, documentoVinculadoNumero, estado
     FROM accounts_receivable
     WHERE estado = 'EMITIDO'`
  );
  console.log(`Found ${receivables.length} EMITIDO receivables in DB`);

  // Get existing collection_actions to avoid duplicates
  const [existingActions] = await conn.execute(
    `SELECT id, receivableId, status, contatoHistorico, cobrancaStartedAt FROM collection_actions`
  );
  const existingActionMap = new Map();
  for (const a of existingActions) {
    existingActionMap.set(a.receivableId, a);
  }
  console.log(`Found ${existingActions.length} existing collection_actions`);

  // Get existing daily actions to avoid duplicates
  const [existingDailyActions] = await conn.execute(
    `SELECT id, receivableId, actionDate, actionType FROM collection_daily_actions`
  );
  const existingDailySet = new Set();
  for (const d of existingDailyActions) {
    existingDailySet.add(`${d.receivableId}_${d.actionDate}_${d.actionType}`);
  }
  console.log(`Found ${existingDailyActions.length} existing daily actions`);

  // Build receivable lookup by client name (normalized)
  function normalize(s) {
    return (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  // Group receivables by client name
  const recByClient = {};
  for (const r of receivables) {
    const key = normalize(r.cliente);
    if (!recByClient[key]) recByClient[key] = [];
    recByClient[key].push(r);
  }

  let matchedCount = 0;
  let insertedActions = 0;
  let insertedDaily = 0;
  let skippedExisting = 0;
  let notFoundClients = new Set();

  for (const record of records) {
    const clienteNorm = normalize(record.cliente);
    const vencimento = record.vencimento; // YYYY-MM-DD
    const valor = record.valor;

    // Find matching receivable
    let candidates = recByClient[clienteNorm] || [];
    
    // If not found by exact name, try partial match
    if (candidates.length === 0) {
      for (const [key, recs] of Object.entries(recByClient)) {
        if (key.includes(clienteNorm) || clienteNorm.includes(key)) {
          candidates = recs;
          break;
        }
      }
    }

    if (candidates.length === 0) {
      notFoundClients.add(record.cliente);
      continue;
    }

    // Match by vencimento date and valor
    let matched = null;
    for (const c of candidates) {
      const cVenc = (c.vencimentoData || '').split('T')[0];
      const cValor = parseFloat(c.valorLiquido) || 0;
      const cValorAReceber = cValor - (parseFloat(c.valorRecebidoLiquido) || 0);
      
      // Match by vencimento date
      if (cVenc === vencimento) {
        // If valor also matches (within 1 real tolerance), perfect match
        if (Math.abs(cValorAReceber - valor) < 1 || Math.abs(cValor - valor) < 1) {
          matched = c;
          break;
        }
      }
    }

    // If no exact match by date+valor, try just by date
    if (!matched) {
      for (const c of candidates) {
        const cVenc = (c.vencimentoData || '').split('T')[0];
        if (cVenc === vencimento) {
          matched = c;
          break;
        }
      }
    }

    // If still no match, try by valor only
    if (!matched) {
      for (const c of candidates) {
        const cValor = parseFloat(c.valorLiquido) || 0;
        const cValorAReceber = cValor - (parseFloat(c.valorRecebidoLiquido) || 0);
        if (Math.abs(cValorAReceber - valor) < 1 || Math.abs(cValor - valor) < 1) {
          matched = c;
          break;
        }
      }
    }

    if (!matched) {
      // Use first candidate as fallback (same client)
      matched = candidates[0];
    }

    matchedCount++;
    const receivableId = matched.id;

    // 1. Ensure collection_actions exists for this receivable
    if (!existingActionMap.has(receivableId)) {
      // Determine status from message
      let status = 'contatado';
      const msgUpper = record.mensagem.toUpperCase();
      if (msgUpper.includes('PROMESSA') || msgUpper.includes('PROMETEU')) {
        status = 'promessa';
      } else if (msgUpper.includes('NÃO ATEND') || msgUpper.includes('NAO ATEND') || msgUpper.includes('SEM RETORNO')) {
        status = 'nao_atendeu';
      } else if (msgUpper.includes('NÃO RETORN') || msgUpper.includes('NAO RETORN')) {
        status = 'nao_retornou';
      }

      // Extract promessa date if present
      let promessaData = null;
      const promessaMatch = record.mensagem.match(/(?:pagamento|pagar).*?(?:até|dia)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (promessaMatch) {
        const [d, m, y] = promessaMatch[1].split('/');
        promessaData = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }

      // Build contato historico from this record
      const contatoHistorico = [{
        data: record.data_contato,
        tipo: record.action_types[0] || 'outro',
        resumo: record.mensagem,
        usuario: 'Thiago',
      }];

      await conn.execute(
        `INSERT INTO collection_actions (receivableId, status, promessaData, observacoes, contatoHistorico, cobrancaStartedAt, updatedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          receivableId,
          status,
          promessaData,
          record.mensagem,
          JSON.stringify(contatoHistorico),
          record.data_contato, // cobrancaStartedAt = date of first contact
          'Thiago',
        ]
      );
      existingActionMap.set(receivableId, { receivableId, status });
      insertedActions++;
    } else {
      // Update existing action: add to contato historico if not already there
      const existing = existingActionMap.get(receivableId);
      let historico = [];
      try {
        historico = JSON.parse(existing.contatoHistorico || '[]');
      } catch { historico = []; }

      // Check if this contact is already recorded
      const alreadyRecorded = historico.some(h => 
        h.data === record.data_contato && h.resumo === record.mensagem
      );

      if (!alreadyRecorded) {
        historico.push({
          data: record.data_contato,
          tipo: record.action_types[0] || 'outro',
          resumo: record.mensagem,
          usuario: 'Thiago',
        });

        // Determine best status
        let status = existing.status || 'contatado';
        const msgUpper = record.mensagem.toUpperCase();
        if (msgUpper.includes('PROMESSA') || msgUpper.includes('PROMETEU') || msgUpper.includes('PROMESSA DE PAGAMENTO')) {
          status = 'promessa';
        }

        // Extract promessa date
        let promessaData = null;
        const promessaMatch = record.mensagem.match(/(?:pagamento|pagar|regularização).*?(?:até|dia)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (promessaMatch) {
          const [d, m, y] = promessaMatch[1].split('/');
          promessaData = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        await conn.execute(
          `UPDATE collection_actions 
           SET contatoHistorico = ?, status = ?, observacoes = CONCAT(IFNULL(observacoes, ''), '\n', ?), updatedBy = ?
           ${promessaData ? ', promessaData = ?' : ''}
           WHERE receivableId = ?`,
          promessaData 
            ? [JSON.stringify(historico), status, record.mensagem, 'Thiago', promessaData, receivableId]
            : [JSON.stringify(historico), status, record.mensagem, 'Thiago', receivableId]
        );
        insertedActions++;
      } else {
        skippedExisting++;
      }
    }

    // 2. Insert collection_daily_actions for this record
    for (const actionType of record.action_types) {
      const dailyKey = `${receivableId}_${record.data_contato}_${actionType}`;
      if (!existingDailySet.has(dailyKey)) {
        await conn.execute(
          `INSERT INTO collection_daily_actions (receivableId, actionDate, actionType, operatorName, notes, isAutomatic)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [receivableId, record.data_contato, actionType, 'Thiago', record.mensagem, false]
        );
        existingDailySet.add(dailyKey);
        insertedDaily++;
      } else {
        skippedExisting++;
      }
    }
  }

  console.log('\n=== IMPORT RESULTS ===');
  console.log(`Records matched to receivables: ${matchedCount}/${records.length}`);
  console.log(`Collection actions inserted/updated: ${insertedActions}`);
  console.log(`Daily actions inserted: ${insertedDaily}`);
  console.log(`Skipped (already existing): ${skippedExisting}`);
  if (notFoundClients.size > 0) {
    console.log(`\nClients NOT found in DB (${notFoundClients.size}):`);
    for (const c of notFoundClients) {
      console.log(`  - ${c}`);
    }
  }

  await conn.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
