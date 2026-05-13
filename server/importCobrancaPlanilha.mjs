/**
 * Script de importação dos dados da planilha Excel INADIMPLÊNCIA.xlsx
 * para a tabela cobranca_planilha no banco de dados.
 * 
 * Execução: node server/importCobrancaPlanilha.mjs
 * 
 * ATENÇÃO: Este script deve ser executado apenas UMA VEZ para a importação inicial.
 * Ele limpa a tabela antes de inserir (para evitar duplicatas em re-execuções).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the extracted data
const dataPath = path.join(__dirname, '..', '..', 'cobranca_planilha_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

console.log(`📊 Dados carregados: ${data.length} títulos`);

// Connect to database
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL não definida');
  process.exit(1);
}

const connection = await mysql.createConnection(dbUrl);

try {
  // Clear existing data (for idempotent re-runs)
  const [existing] = await connection.execute('SELECT COUNT(*) as cnt FROM cobranca_planilha');
  console.log(`📋 Registros existentes: ${existing[0].cnt}`);
  
  if (existing[0].cnt > 0) {
    console.log('🗑️  Limpando tabela para reimportação...');
    await connection.execute('DELETE FROM cobranca_planilha');
  }

  // Insert data in batches
  let inserted = 0;
  const batchSize = 10;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    const placeholders = batch.map(() => 
      '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).join(', ');
    
    const values = [];
    for (const item of batch) {
      values.push(
        item.empresa || '',
        item.descricao || null,
        item.cnpjCpf || null,
        item.municipio || null,
        item.uf || null,
        item.pais || null,
        item.centroCustos || null,
        item.valor != null ? item.valor : null,
        item.vencimento || null,
        item.diasVencidos != null ? Math.round(item.diasVencidos) : null,
        item.tipo || null,
        item.status || 'Pendente',
        item.promessaPgto || null,
        item.primeiraCobranca || null,
        item.semAcao1 || null,
        item.segundaCobranca || null,
        item.semAcao2 || null,
        item.terceiraCobranca || null,
        item.semAcao3 || null,
        item.acaoFinal || null,
      );
    }
    
    const sql = `INSERT INTO cobranca_planilha 
      (empresa, descricao, cnpj_cpf, municipio, uf, pais, centro_custos, valor, vencimento, dias_vencidos, tipo, status, promessa_pgto, primeira_cobranca, sem_acao_1, segunda_cobranca, sem_acao_2, terceira_cobranca, sem_acao_3, acao_final) 
      VALUES ${placeholders}`;
    
    await connection.execute(sql, values);
    inserted += batch.length;
    process.stdout.write(`\r✅ Inseridos: ${inserted}/${data.length}`);
  }
  
  console.log(`\n\n📊 Importação concluída: ${inserted} títulos inseridos`);
  
  // Now update observations from comments
  console.log('\n📝 Atualizando observações dos comentários...');
  
  let obsUpdated = 0;
  for (const item of data) {
    if (item.observacoes) {
      // Match by empresa + valor + vencimento
      const [rows] = await connection.execute(
        'SELECT id FROM cobranca_planilha WHERE empresa = ? AND valor = ? AND vencimento = ? LIMIT 1',
        [item.empresa, item.valor, item.vencimento || null]
      );
      
      if (rows.length > 0) {
        await connection.execute(
          'UPDATE cobranca_planilha SET observacoes = ?, updated_by = ? WHERE id = ?',
          [item.observacoes, 'Importação Excel', rows[0].id]
        );
        obsUpdated++;
      }
    }
  }
  
  console.log(`✅ Observações atualizadas: ${obsUpdated}`);
  
  // Verify
  const [final] = await connection.execute('SELECT COUNT(*) as cnt FROM cobranca_planilha');
  const [withObs] = await connection.execute('SELECT COUNT(*) as cnt FROM cobranca_planilha WHERE observacoes IS NOT NULL');
  console.log(`\n📊 Verificação final:`);
  console.log(`   Total de títulos: ${final[0].cnt}`);
  console.log(`   Com observações: ${withObs[0].cnt}`);
  
  // Show status distribution
  const [statusDist] = await connection.execute(
    'SELECT status, COUNT(*) as cnt, SUM(valor) as total FROM cobranca_planilha GROUP BY status ORDER BY cnt DESC'
  );
  console.log(`\n📊 Distribuição por status:`);
  for (const row of statusDist) {
    console.log(`   ${row.status}: ${row.cnt} títulos (R$ ${Number(row.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
  }
  
} catch (error) {
  console.error('❌ Erro:', error);
  process.exit(1);
} finally {
  await connection.end();
}
