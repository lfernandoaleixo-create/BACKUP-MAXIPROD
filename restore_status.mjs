import mysql from 'mysql2/promise';

/**
 * Restaura status, observações, etapas de cobrança e promessas de pagamento
 * a partir do backup mais recente (ID 360015).
 * 
 * Cruza por arId (mais confiável) e por empresa+vencimento+valor (fallback).
 * Apenas restaura campos que foram perdidos (status = "Pendente" agora mas era diferente no backup).
 */
async function main() {
  const url = process.env.DATABASE_URL;
  const conn = await mysql.createConnection(url);
  
  // 1. Buscar o backup mais recente
  const [backupRows] = await conn.execute(
    'SELECT id, dataJson FROM cobranca_planilha_backup WHERE id = 360015'
  );
  
  if (backupRows.length === 0) {
    console.error('Backup 360015 não encontrado!');
    process.exit(1);
  }
  
  const backupItems = typeof backupRows[0].dataJson === 'string' 
    ? JSON.parse(backupRows[0].dataJson) 
    : backupRows[0].dataJson;
  
  console.log(`Backup carregado: ${backupItems.length} itens`);
  
  // 2. Buscar todos os registros ATIVOS atuais
  const [currentRows] = await conn.execute(
    'SELECT id, ar_id as arId, empresa, vencimento, valor, status, observacoes, promessa_pgto, primeira_cobranca, sem_acao_1, segunda_cobranca, sem_acao_2, terceira_cobranca, sem_acao_3, acao_final, etapas_pausadas FROM cobranca_planilha WHERE ativo = 1'
  );
  
  console.log(`Registros ativos atuais: ${currentRows.length}`);
  
  // 3. Criar índice do backup por arId
  const backupByArId = new Map();
  const backupByKey = new Map();
  
  for (const item of backupItems) {
    if (item.arId) {
      backupByArId.set(item.arId, item);
    }
    // Fallback: empresa + vencimento + valor
    const key = `${(item.empresa || '').toUpperCase().trim()}|${item.vencimento || ''}|${parseFloat(item.valor || 0).toFixed(2)}`;
    backupByKey.set(key, item);
  }
  
  // 4. Para cada registro ativo atual, tentar encontrar no backup e restaurar campos
  let restored = 0;
  let notFound = 0;
  let alreadyOk = 0;
  
  for (const current of currentRows) {
    // Tentar match por arId
    let backupItem = current.arId ? backupByArId.get(current.arId) : null;
    
    // Fallback: match por empresa+vencimento+valor
    if (!backupItem) {
      const key = `${(current.empresa || '').toUpperCase().trim()}|${current.vencimento || ''}|${parseFloat(current.valor || 0).toFixed(2)}`;
      backupItem = backupByKey.get(key);
    }
    
    if (!backupItem) {
      notFound++;
      continue;
    }
    
    // Verificar se precisa restaurar (status foi resetado para Pendente)
    const needsRestore = (
      (current.status === 'Pendente' && backupItem.status && backupItem.status !== 'Pendente') ||
      (!current.observacoes && backupItem.observacoes) ||
      (!current.promessa_pgto && backupItem.promessaPgto) ||
      (!current.primeira_cobranca && backupItem.primeiraCobranca) ||
      (!current.segunda_cobranca && backupItem.segundaCobranca) ||
      (!current.terceira_cobranca && backupItem.terceiraCobranca) ||
      (!current.acao_final && backupItem.acaoFinal)
    );
    
    if (!needsRestore) {
      alreadyOk++;
      continue;
    }
    
    // Restaurar campos
    const updates = [];
    const params = [];
    
    if (current.status === 'Pendente' && backupItem.status && backupItem.status !== 'Pendente') {
      updates.push('status = ?');
      params.push(backupItem.status);
    }
    if (!current.observacoes && backupItem.observacoes) {
      updates.push('observacoes = ?');
      params.push(backupItem.observacoes);
    }
    if (!current.promessa_pgto && backupItem.promessaPgto) {
      updates.push('promessa_pgto = ?');
      params.push(backupItem.promessaPgto);
    }
    if (!current.primeira_cobranca && backupItem.primeiraCobranca) {
      updates.push('primeira_cobranca = ?');
      params.push(backupItem.primeiraCobranca);
    }
    if (!current.sem_acao_1 && backupItem.semAcao1) {
      updates.push('sem_acao_1 = ?');
      params.push(backupItem.semAcao1);
    }
    if (!current.segunda_cobranca && backupItem.segundaCobranca) {
      updates.push('segunda_cobranca = ?');
      params.push(backupItem.segundaCobranca);
    }
    if (!current.sem_acao_2 && backupItem.semAcao2) {
      updates.push('sem_acao_2 = ?');
      params.push(backupItem.semAcao2);
    }
    if (!current.terceira_cobranca && backupItem.terceiraCobranca) {
      updates.push('terceira_cobranca = ?');
      params.push(backupItem.terceiraCobranca);
    }
    if (!current.sem_acao_3 && backupItem.semAcao3) {
      updates.push('sem_acao_3 = ?');
      params.push(backupItem.semAcao3);
    }
    if (!current.acao_final && backupItem.acaoFinal) {
      updates.push('acao_final = ?');
      params.push(backupItem.acaoFinal);
    }
    // Restaurar etapas pausadas
    if (backupItem.etapasPausadas && Object.keys(backupItem.etapasPausadas).length > 0) {
      const currentEtapas = current.etapas_pausadas ? 
        (typeof current.etapas_pausadas === 'string' ? JSON.parse(current.etapas_pausadas) : current.etapas_pausadas) : {};
      if (Object.keys(currentEtapas).length === 0) {
        updates.push('etapas_pausadas = ?');
        params.push(JSON.stringify(backupItem.etapasPausadas));
      }
    }
    
    if (updates.length > 0) {
      updates.push("updated_by = ?");
      params.push("Restauração de backup (status perdidos)");
      params.push(current.id);
      
      await conn.execute(
        `UPDATE cobranca_planilha SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      restored++;
      console.log(`  Restaurado: ${current.empresa} (arId=${current.arId}) → status: ${backupItem.status}`);
    }
  }
  
  console.log(`\n=== RESULTADO ===`);
  console.log(`Restaurados: ${restored}`);
  console.log(`Já corretos: ${alreadyOk}`);
  console.log(`Não encontrados no backup: ${notFound}`);
  
  // 5. Verificar resultado final
  const [finalCheck] = await conn.execute(
    'SELECT status, COUNT(*) as total FROM cobranca_planilha WHERE ativo = 1 GROUP BY status ORDER BY total DESC'
  );
  console.log('\n=== STATUS APÓS RESTAURAÇÃO ===');
  console.log(JSON.stringify(finalCheck, null, 2));
  
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
