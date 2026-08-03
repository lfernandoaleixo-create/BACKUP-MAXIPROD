import { getDb } from './server/db.ts';
import { importPos, importPoProducts, stockItems } from './drizzle/schema.ts';
import { eq, and, inArray } from 'drizzle-orm';
import fs from 'fs';

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); return; }

  // Get all POs with their products
  const allPos = await db.select().from(importPos);
  const allPoProducts = await db.select().from(importPoProducts);
  const allStockItems = await db.select().from(stockItems);

  // Build stock map (codigoItem -> { estoque in CX, fator })
  const stockMap = new Map();
  for (const item of allStockItems) {
    const fator = item.unidadeDeVendaFator || 1;
    const estoqueUnidades = item.estoqueTotal || 0;
    const estoqueCX = estoqueUnidades / fator;
    stockMap.set(item.codigoItem, { estoqueCX, fator, descricao: item.descricaoItem });
  }

  // Build PO map (poId -> PO data)
  const poMap = new Map();
  for (const po of allPos) {
    poMap.set(po.id, po);
  }

  // Group PO products by product code, with PO status and date
  const productHistory = new Map(); // code -> Array<{ poNumber, status, previsaoEntrega, quantidade, valorCaixaBrl }>
  for (const pp of allPoProducts) {
    const po = poMap.get(pp.poId);
    if (!po) continue;
    const code = pp.codigoItem;
    if (!code) continue;
    
    if (!productHistory.has(code)) productHistory.set(code, []);
    
    // quantidade is in CX (already converted when saved)
    const qtdCX = pp.quantidadeCaixas || 0;
    const valorCaixaBrl = pp.valorCaixaBrl || 0;
    
    productHistory.get(code).push({
      poNumber: po.poNumber || `PO${po.id}`,
      poId: po.id,
      status: po.status, // '100_concluido', 'chegou_patio', 'navegando'
      previsaoEntrega: po.previsaoEntrega || po.createdAt,
      quantidade: qtdCX,
      valorCaixaBrl: valorCaixaBrl,
    });
  }

  let report = '=== RELATÓRIO CUSTO DA MERCADORIA (LIFO UNIFICADO v2) ===\n';
  report += `Data: ${new Date().toISOString()}\n`;
  report += `Regra: Estoque atribuído à PO mais recente (por data). Vendas abatidas das mais antigas.\n`;
  report += `Se estoque < última PO → 100% veio dela. Se estoque > última PO → média ponderada.\n\n`;
  report += '='.repeat(100) + '\n\n';

  // Process each product
  const codes = [...productHistory.keys()].sort();
  
  for (const code of codes) {
    const history = productHistory.get(code);
    const stockInfo = stockMap.get(code);
    const boxesInStock = stockInfo ? stockInfo.estoqueCX : 0;
    const descricao = stockInfo?.descricao || history[0]?.descricao || 'N/A';

    // Separate by status
    const concluidas = history.filter(h => h.status === '100_concluido');
    const patio = history.filter(h => h.status === 'chegou_patio');
    const navegando = history.filter(h => h.status === 'navegando');

    // Sort each by date (oldest first)
    const sortByDate = (a, b) => {
      const da = a.previsaoEntrega ? new Date(a.previsaoEntrega).getTime() : 0;
      const db2 = b.previsaoEntrega ? new Date(b.previsaoEntrega).getTime() : 0;
      return da - db2;
    };
    concluidas.sort(sortByDate);
    patio.sort(sortByDate);
    navegando.sort(sortByDate);

    // === LIFO UNIFICADO: Juntar concluídas + pátio, ordenar por data ===
    const allPosForAttribution = [
      ...concluidas.map(po => ({ ...po, source: 'concluida' })),
      ...patio.map(po => ({ ...po, source: 'patio' })),
    ];
    allPosForAttribution.sort(sortByDate);

    // LIFO: atribuir estoque à PO mais recente primeiro
    let remaining = boxesInStock;
    let boxesFromConcluidas = 0;
    let weightedCostConcluidas = 0;
    let boxesFromPatio = 0;
    let weightedCostPatio = 0;
    const attribution = [];

    for (let i = allPosForAttribution.length - 1; i >= 0 && remaining > 0; i--) {
      const po = allPosForAttribution[i];
      const boxesFromThisPo = Math.min(remaining, po.quantidade);
      remaining -= boxesFromThisPo;
      attribution.push({
        poNumber: po.poNumber,
        source: po.source,
        caixasUsadas: boxesFromThisPo,
        valorCaixa: po.valorCaixaBrl,
        previsaoEntrega: po.previsaoEntrega,
      });
      if (po.source === 'concluida') {
        boxesFromConcluidas += boxesFromThisPo;
        weightedCostConcluidas += boxesFromThisPo * po.valorCaixaBrl;
      } else {
        boxesFromPatio += boxesFromThisPo;
        weightedCostPatio += boxesFromThisPo * po.valorCaixaBrl;
      }
    }

    // Custo Real (verde): apenas caixas de concluídas
    let custoReal = 0;
    let realInfo = '';
    if (concluidas.length === 0) {
      custoReal = 0;
      realInfo = 'Sem POs concluídas';
    } else if (boxesFromConcluidas <= 0) {
      const lastConcluida = concluidas[concluidas.length - 1];
      custoReal = lastConcluida.valorCaixaBrl;
      realInfo = `Referência (sem caixas de concluídas no estoque): ${lastConcluida.poNumber} @ R$${custoReal.toFixed(2)}`;
    } else {
      custoReal = weightedCostConcluidas / boxesFromConcluidas;
      realInfo = attribution.filter(a => a.source === 'concluida').map(a => 
        `${a.poNumber}: ${a.caixasUsadas.toFixed(1)} cx @ R$${a.valorCaixa.toFixed(2)}`
      ).join(' + ');
    }

    // Custo Projetado (laranja): todas as caixas (concluídas + pátio)
    let custoProjetado = custoReal;
    let projInfo = '';
    if (boxesInStock > 0 && allPosForAttribution.length > 0) {
      const totalBoxes = boxesFromConcluidas + boxesFromPatio;
      const totalCost = weightedCostConcluidas + weightedCostPatio;
      custoProjetado = totalBoxes > 0 ? totalCost / totalBoxes : custoReal;
      projInfo = attribution.map(a => 
        `${a.poNumber}(${a.source}): ${a.caixasUsadas.toFixed(1)} cx @ R$${a.valorCaixa.toFixed(2)}`
      ).join(' + ');
    } else if (patio.length > 0) {
      const lastPatio = patio[patio.length - 1];
      custoProjetado = lastPatio.valorCaixaBrl;
      projInfo = `Referência pátio: ${lastPatio.poNumber} @ R$${custoProjetado.toFixed(2)}`;
    } else {
      projInfo = 'Sem POs no pátio, = custo real';
    }

    // Custo Estimativa (azul): navegando
    let custoEstimativa = 0;
    let estInfo = '';
    if (navegando.length > 0) {
      let totalNavQty = 0;
      let totalNavCost = 0;
      for (const po of navegando) {
        totalNavQty += po.quantidade;
        totalNavCost += po.quantidade * po.valorCaixaBrl;
      }
      custoEstimativa = totalNavQty > 0 ? totalNavCost / totalNavQty : 0;
      estInfo = navegando.map(n => `${n.poNumber}: ${n.quantidade.toFixed(1)} cx @ R$${n.valorCaixaBrl.toFixed(2)}`).join(' + ');
    }

    report += `${code} | ${descricao}\n`;
    report += `  Estoque: ${boxesInStock.toFixed(1)} CX\n`;
    report += `  POs Concluídas: ${concluidas.map(c => `${c.poNumber}(${c.quantidade.toFixed(0)}cx, R$${c.valorCaixaBrl.toFixed(2)}, ${c.previsaoEntrega || '?'})`).join(', ') || 'nenhuma'}\n`;
    report += `  POs Pátio: ${patio.map(p => `${p.poNumber}(${p.quantidade.toFixed(0)}cx, R$${p.valorCaixaBrl.toFixed(2)}, ${p.previsaoEntrega || '?'})`).join(', ') || 'nenhuma'}\n`;
    report += `  POs Navegando: ${navegando.map(n => `${n.poNumber}(${n.quantidade.toFixed(0)}cx, R$${n.valorCaixaBrl.toFixed(2)}, ${n.previsaoEntrega || '?'})`).join(', ') || 'nenhuma'}\n`;
    report += `  --- Atribuição LIFO (estoque → PO mais recente primeiro) ---\n`;
    for (const a of attribution) {
      report += `    ${a.poNumber} (${a.source}, chegou ${a.previsaoEntrega || '?'}): ${a.caixasUsadas.toFixed(1)} cx @ R$${a.valorCaixa.toFixed(2)}\n`;
    }
    if (remaining > 0) {
      report += `    ⚠️ ${remaining.toFixed(1)} cx sem PO atribuída (estoque > total de POs)\n`;
    }
    report += `  CUSTO REAL (verde):     R$ ${custoReal.toFixed(2)} | ${realInfo}\n`;
    report += `  CUSTO PROJETADO (lar.): R$ ${custoProjetado.toFixed(2)} | ${projInfo}\n`;
    report += `  CUSTO ESTIMATIVA (azul):R$ ${custoEstimativa > 0 ? custoEstimativa.toFixed(2) : '—'} | ${estInfo || '—'}\n`;
    report += '\n';
  }

  fs.writeFileSync('/tmp/custo-report-v2.txt', report);
  console.log('Report saved to /tmp/custo-report-v2.txt');
  console.log('\n=== PRODUTO 00009 (Espeto 4,0 x 250mm) ===');
  const lines = report.split('\n');
  let inProduct = false;
  for (const line of lines) {
    if (line.startsWith('00009 ')) inProduct = true;
    else if (inProduct && line.match(/^\d{5}/)) inProduct = false;
    if (inProduct) console.log(line);
  }
}

main().catch(console.error);
