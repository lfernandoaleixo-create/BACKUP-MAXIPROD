/**
 * E-commerce Transfer History - Snapshot & Change Detection + Faturados
 * 
 * Salva snapshots dos itens E-commerce (variações PC) a cada sync.
 * Compara snapshots para detectar quando o estoque baixou (transferência efetivada).
 * Também inclui pedidos E-commerce faturados da tabela sales_orders.
 * 
 * CONVERSÃO PC→CX: Itens vendidos em PC (pacotes) são convertidos para CX (caixas)
 * usando a lógica do produto mãe:
 *   caixas = (qtd_PC × unidades_por_pacote) / unidades_por_caixa_do_mãe
 */

import { getDb } from "./db";
import { ecommerceStockSnapshots, ecommerceTransferHistory, stockItems, orderItems, salesOrders, productVariants } from "../drizzle/schema";
import { eq, and, desc, sql, like, or } from "drizzle-orm";

/** Retorna a data de hoje em Brasília como string YYYY-MM-DD */
function getTodayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Identifica itens que são variações E-commerce (pacotes PC)
 * baseado na lógica do stockProcessor: itens com unidadeMedida = "PC"
 * que pertencem a um produto mãe (CX)
 */
function isEcommerceVariant(item: { unidadeMedida: string | null; descricaoItem: string }): boolean {
  return (item.unidadeMedida || '').toUpperCase() === 'PC';
}

/**
 * Extrai unidades por pacote da descrição (ex: "C/ 100 UNID." → 100)
 */
function extractUnitsFromDesc(desc: string): number {
  const match = desc.match(/(\d+)\s*(?:un|UN|Un)/);
  if (match) return parseInt(match[1]);
  return 0;
}

/**
 * Extrai unidades por caixa da descrição do produto (replicado de stockProcessor)
 * Ex: "PALITO DE MANICURE DUAS PONTAS BAMBU 4,0 X 125MM C/ 10.000 UNID." → 10000
 * Ex: "VARETA AROMATIZADOR 4,0 X 125 MM 10.000" → 10000
 */
function extractUnitsPerBox(desc: string): number | null {
  const d = desc.toUpperCase();
  if (d.includes("KG") && !d.includes("UNID")) return null;

  // Pattern: C/ 10.000 UNID or C/ 5.000 UNID
  const cPattern = /C\/\s*([\d.]+)\s*(?:UNID|UN)/i;
  const cMatch = desc.match(cPattern);
  if (cMatch) return parseFloat(cMatch[1].replace(/\./g, ""));

  // Pattern: N X M POR CAIXA
  const nxmPorCaixaPattern = /(\d+)\s*[xX]\s*(\d+)\s*POR\s*CAIXA/i;
  const nxmPorCaixaMatch = desc.match(nxmPorCaixaPattern);
  if (nxmPorCaixaMatch) return parseInt(nxmPorCaixaMatch[1]) * parseInt(nxmPorCaixaMatch[2]);

  // Pattern: (10.000 POR CAIXA)
  const porCaixaPattern = /([\d.]+)\s*POR\s*CAIXA/i;
  const porCaixaMatch = desc.match(porCaixaPattern);
  if (porCaixaMatch) return parseFloat(porCaixaMatch[1].replace(/\./g, ""));

  // Pattern: N POR PACOTE
  const porPacotePattern = /([\d.]+)\s*POR\s*PACOTE/i;
  const porPacoteMatch = desc.match(porPacotePattern);
  if (porPacoteMatch) return parseFloat(porPacoteMatch[1].replace(/\./g, ""));

  // Pattern: 3-number multiplication like 20*25*100
  const threeNumPattern = /(\d+)\s*[xX*]\s*(\d+)\s*[xX*]\s*(\d+)(?!\s*MM)/;
  const threeMatch = desc.match(threeNumPattern);
  if (threeMatch) return parseInt(threeMatch[1]) * parseInt(threeMatch[2]) * parseInt(threeMatch[3]);

  // Pattern: C/ NxM UNID
  const cNxMUnidPattern = /C\/\s*([\d.]+)\s*[xX]\s*([\d.]+)\s*(?:UNID|UN)/i;
  const cNxMUnidMatch = desc.match(cNxMUnidPattern);
  if (cNxMUnidMatch) return parseFloat(cNxMUnidMatch[1].replace(/\./g, "")) * parseFloat(cNxMUnidMatch[2].replace(/\./g, ""));

  // Pattern: C/ NxM (without UNID)
  const cNxMPattern = /C\/\s*([\d.]+)\s*[xX]\s*([\d.]+)/i;
  const cNxMMatch = desc.match(cNxMPattern);
  if (cNxMMatch) return parseFloat(cNxMMatch[1].replace(/\./g, "")) * parseFloat(cNxMMatch[2].replace(/\./g, ""));

  // Pattern: NxM UNID after removing measurement
  const afterMM = desc.replace(/\d+[,.]?\d*\s*[xX*]\s*\d+\s*(?:MM|CM)/gi, "");
  const nxmPattern = /([\d.]+)\s*[xX]\s*([\d.]+)\s*(?:UNID|UN)/i;
  const nxmMatch = afterMM.match(nxmPattern);
  if (nxmMatch) return parseFloat(nxmMatch[1].replace(/\./g, "")) * parseFloat(nxmMatch[2].replace(/\./g, ""));

  // Pattern: CM NxM (hashi)
  const hashiPattern = /CM\s+(\d+)\s*[xX*]\s*(\d+)/i;
  const hashiMatch = desc.match(hashiPattern);
  if (hashiMatch) return parseInt(hashiMatch[1]) * parseInt(hashiMatch[2]);

  // Pattern for VARETA AROMATIZADOR: "MM 10.000" (number at end after MM, no UNID)
  const varetaPattern = /MM\s+([\d.]+)$/i;
  const varetaMatch = desc.trim().match(varetaPattern);
  if (varetaMatch) return parseFloat(varetaMatch[1].replace(/\./g, ""));

  // Pattern for "NxM" after MM without UNID (e.g. "MM 100 x 100")
  const afterMM2 = desc.replace(/\d+[,.]?\d*\s*[xX*]\s*\d+\s*(?:MM|CM)/gi, "");
  const nxmNoUnidPattern = /(\d+)\s*[xX]\s*(\d+)\s*$/;
  const nxmNoUnidMatch = afterMM2.trim().match(nxmNoUnidPattern);
  if (nxmNoUnidMatch) return parseInt(nxmNoUnidMatch[1]) * parseInt(nxmNoUnidMatch[2]);

  return null;
}

/**
 * Extrai as medidas de um produto da descrição.
 * Ex: "PALITO DE MANICURE DUAS PONTAS BAMBU 4,0 X 125 MM" → "4,0 X 125"
 * Ex: "VARETA AROMATIZADOR 4,0 X 250 MM" → "4,0 X 250"
 * Ex: "VARETA DE FIBRA PARA AROMATIZADOR DE 3,0 X 200 MM" → "3,0 X 200"
 */
function extractDimensions(desc: string): string | null {
  const match = desc.match(/(\d+[,.]?\d*)\s*[xX]\s*(\d+)\s*MM/i);
  if (match) return `${match[1]} X ${match[2]}`;
  return null;
}

/**
 * Extrai o tipo base do produto da descrição para matching.
 * Normaliza para comparação: remove medidas, quantidades, sufixos.
 * Retorna uma chave de tipo como "PALITO MANICURE DUAS PONTAS", "VARETA AROMATIZADOR", etc.
 */
function extractProductType(desc: string): string {
  const d = desc.toUpperCase();
  
  // Specific product type patterns
  if (d.includes('MANICURE') && d.includes('DUAS PONTAS')) return 'MANICURE_DUAS_PONTAS';
  if (d.includes('MANICURE') && d.includes('PONTA/CHANFRO')) return 'MANICURE_PONTA_CHANFRO';
  if (d.includes('MANICURE') && d.includes('CHANFRO')) return 'MANICURE_PONTA_CHANFRO';
  if (d.includes('FIBRA') && d.includes('AROMATIZADOR')) return 'VARETA_FIBRA_AROMATIZADOR';
  if (d.includes('ALGOD') && d.includes('DOCE') && d.includes('MADEIRA')) return 'VARETA_ALGODAO_DOCE_MADEIRA';
  if (d.includes('ALGOD') && d.includes('DOCE')) return 'VARETA_ALGODAO_DOCE';
  if (d.includes('AROMATIZADOR') && d.includes('FLOW')) return 'VARETA_AROMATIZADOR';
  if (d.includes('AROMATIZADOR')) return 'VARETA_AROMATIZADOR';
  if (d.includes('ESPETO') && d.includes('BAMBU')) return 'ESPETO_BAMBU';
  if (d.includes('PALITO') && d.includes('DENTE')) return 'PALITO_DENTE';
  if (d.includes('HASHI')) return 'PALITO_HASHI';
  if (d.includes('PETISCO')) return 'PALITO_PETISCO';
  
  return 'OUTRO';
}

/** Normalized history item shape expected by the frontend */
export interface EcommerceHistoryItem {
  detectedAt: Date | string;
  codigoItem: string;
  descricaoItem: string;
  quantidadeCx: number;
  quantidadeUn: number;
  tipoMovimento: string; // 'saida_total' | 'saida_parcial' | 'faturado' | 'faturado_parcial'
  pedidoRelacionado: string | null;
  cliente: string | null;
}

/**
 * Monta o mapa de conversão PC→CX.
 * Para cada item PC, encontra o produto mãe (CX) e calcula quantas unidades por caixa do mãe.
 * 
 * Fontes de mapeamento (em ordem de prioridade):
 * 1. Tabela product_variants (mapeamento explícito pai→filho)
 * 2. Matching por tipo de produto + medidas (mesmo tipo + mesmas medidas → maior un/cx)
 */
interface ParentInfo {
  parentCode: string;
  parentDesc: string;
  parentUnitsPerBox: number; // unidades por caixa do produto mãe
}

async function buildPcToCxMap(): Promise<Map<string, ParentInfo>> {
  const db = await getDb();
  if (!db) return new Map();
  
  // 1. Buscar product_variants
  const variants = await db.select().from(productVariants);
  const childToParentCode = new Map<string, string>();
  for (const v of variants) {
    childToParentCode.set(v.childCode, v.parentCode);
  }
  
  // 2. Buscar todos os itens de estoque para obter descrições e un/cx
  const allStock = await db.select().from(stockItems);
  const stockByCode = new Map<string, { descricaoItem: string; unidadeMedida: string | null; unidadeDeVendaFator: string | null }>();
  for (const item of allStock) {
    stockByCode.set(item.codigoItem, {
      descricaoItem: item.descricaoItem,
      unidadeMedida: item.unidadeMedida,
      unidadeDeVendaFator: item.unidadeDeVendaFator,
    });
  }
  
  // 3. Construir set de códigos que são filhos (para excluí-los como candidatos a pai)
  const childCodes = new Set<string>();
  for (const v of variants) {
    childCodes.add(v.childCode);
  }
  
  // 4. Construir índice de produtos CX (não-PC, não-filho) por tipo+medida para matching
  // Chave: "TIPO|DIMENSAO" → { code, desc, unitsPerBox }[]
  const cxProductsByTypeAndDim = new Map<string, { code: string; desc: string; unitsPerBox: number }[]>();
  // Fallback: inclui TODOS os não-PC (mesmo filhos) para casos onde não existe pai puro
  const allNonPcByTypeAndDim = new Map<string, { code: string; desc: string; unitsPerBox: number }[]>();
  
  for (const item of allStock) {
    const um = (item.unidadeMedida || '').toUpperCase();
    // Pular itens PC - queremos apenas os pais (CX, UN, etc.)
    if (um === 'PC') continue;
    
    const desc = item.descricaoItem;
    const dims = extractDimensions(desc);
    if (!dims) continue;
    
    const tipo = extractProductType(desc);
    const key = `${tipo}|${dims}`;
    
    // Calcular un/cx: usar unidadeDeVendaFator do Maxiprod ou extrair da descrição
    // IMPORTANTE: maxiprodFator=1 significa "sem conversão" (CX=1 unidade), não é útil
    // Nesses casos, preferir o descFator que extrai da descrição (ex: "10.000" = 10000)
    const maxiprodFator = item.unidadeDeVendaFator ? parseFloat(item.unidadeDeVendaFator) : null;
    const descFator = extractUnitsPerBox(desc);
    const unitsPerBox = (maxiprodFator && maxiprodFator > 1) ? maxiprodFator : descFator;
    
    if (unitsPerBox && unitsPerBox > 1) {
      // Adicionar ao fallback (todos os não-PC)
      const existingAll = allNonPcByTypeAndDim.get(key) || [];
      existingAll.push({ code: item.codigoItem, desc, unitsPerBox });
      allNonPcByTypeAndDim.set(key, existingAll);
      
      // Adicionar ao principal apenas se NÃO é filho
      if (!childCodes.has(item.codigoItem)) {
        const existing = cxProductsByTypeAndDim.get(key) || [];
        existing.push({ code: item.codigoItem, desc, unitsPerBox });
        cxProductsByTypeAndDim.set(key, existing);
      }
    }
  }
  
  // 4. Para cada item PC, encontrar o produto mãe
  const pcToCxMap = new Map<string, ParentInfo>();
  
  for (const item of allStock) {
    const um = (item.unidadeMedida || '').toUpperCase();
    if (um !== 'PC') continue;
    
    const code = item.codigoItem;
    const desc = item.descricaoItem;
    
    // Tentativa 1: product_variants (mapeamento explícito)
    const parentCode = childToParentCode.get(code);
    if (parentCode) {
      const parentStock = stockByCode.get(parentCode);
      if (parentStock) {
        const parentMaxiprodFator = parentStock.unidadeDeVendaFator ? parseFloat(parentStock.unidadeDeVendaFator) : null;
        const parentDescFator = extractUnitsPerBox(parentStock.descricaoItem);
        const parentUpb = (parentMaxiprodFator && parentMaxiprodFator > 1) ? parentMaxiprodFator : parentDescFator;
        if (parentUpb && parentUpb > 1) {
          pcToCxMap.set(code, {
            parentCode,
            parentDesc: parentStock.descricaoItem,
            parentUnitsPerBox: parentUpb,
          });
          continue;
        }
      }
    }
    
    // Tentativa 2: matching por tipo + medidas
    const dims = extractDimensions(desc);
    const tipo = extractProductType(desc);
    
    if (dims) {
      const key = `${tipo}|${dims}`;
      const candidates = cxProductsByTypeAndDim.get(key) || [];
      
      // Se não encontrou pelo tipo exato, tentar variações
      // Ex: VARETA_ALGODAO_DOCE_MADEIRA pode ter pai VARETA_ALGODAO_DOCE
      let allCandidates = [...candidates];
      if (tipo === 'VARETA_ALGODAO_DOCE_MADEIRA') {
        const fallback = cxProductsByTypeAndDim.get(`VARETA_ALGODAO_DOCE|${dims}`) || [];
        allCandidates = [...allCandidates, ...fallback];
      }
      
      // Se não encontrou candidatos não-filhos, usar fallback que inclui filhos
      if (allCandidates.length === 0) {
        const fallbackCandidates = allNonPcByTypeAndDim.get(key) || [];
        allCandidates = [...fallbackCandidates];
        if (tipo === 'VARETA_ALGODAO_DOCE_MADEIRA' && allCandidates.length === 0) {
          const fallback2 = allNonPcByTypeAndDim.get(`VARETA_ALGODAO_DOCE|${dims}`) || [];
          allCandidates = [...fallback2];
        }
      }
      
      if (allCandidates.length > 0) {
        // Pegar o produto com MAIOR un/cx (é o produto mãe principal)
        allCandidates.sort((a, b) => b.unitsPerBox - a.unitsPerBox);
        const best = allCandidates[0];
        pcToCxMap.set(code, {
          parentCode: best.code,
          parentDesc: best.desc,
          parentUnitsPerBox: best.unitsPerBox,
        });
        continue;
      }
    }
    
    // Não encontrou mãe - manter como está
  }
  
  // 5. Também mapear itens que não estão no estoque mas aparecem nos pedidos faturados
  // Buscar pedidos E-commerce faturados para pegar códigos que podem não estar no estoque
  const faturadoRows = await db
    .select()
    .from(salesOrders)
    .where(
      and(
        sql`UPPER(${salesOrders.estadoConfiguravel}) IN ('E-COMMERCE', 'ECOMMERCE')`,
        sql`(${salesOrders.estadoItem} LIKE '%aturado%' OR ${salesOrders.estadoItem} LIKE '%ATURADO%')`,
      )
    );
  
  for (const row of faturadoRows) {
    const code = row.codigoItem || '';
    if (pcToCxMap.has(code)) continue; // Já mapeado
    
    const umCodigo = (row.unidadeMedidaCodigo || '').toUpperCase();
    if (umCodigo !== 'PC') continue; // Só converter PC
    
    const desc = row.descricaoItem || row.descricao || '';
    
    // Tentativa 1: product_variants
    const parentCode = childToParentCode.get(code);
    if (parentCode) {
      const parentStock = stockByCode.get(parentCode);
      if (parentStock) {
        const parentMaxiprodFator = parentStock.unidadeDeVendaFator ? parseFloat(parentStock.unidadeDeVendaFator) : null;
        const parentDescFator = extractUnitsPerBox(parentStock.descricaoItem);
        const parentUpb = (parentMaxiprodFator && parentMaxiprodFator > 1) ? parentMaxiprodFator : parentDescFator;
        if (parentUpb && parentUpb > 1) {
          pcToCxMap.set(code, {
            parentCode,
            parentDesc: parentStock.descricaoItem,
            parentUnitsPerBox: parentUpb,
          });
          continue;
        }
      }
    }
    
    // Tentativa 2: matching por tipo + medidas
    const dims = extractDimensions(desc);
    const tipo = extractProductType(desc);
    
    if (dims) {
      const key = `${tipo}|${dims}`;
      const candidates = cxProductsByTypeAndDim.get(key) || [];
      
      let allCandidates = [...candidates];
      if (tipo === 'VARETA_ALGODAO_DOCE_MADEIRA') {
        const fallback = cxProductsByTypeAndDim.get(`VARETA_ALGODAO_DOCE|${dims}`) || [];
        allCandidates = [...allCandidates, ...fallback];
      }
      
      // Se não encontrou candidatos não-filhos, usar fallback que inclui filhos
      if (allCandidates.length === 0) {
        const fallbackCandidates = allNonPcByTypeAndDim.get(key) || [];
        allCandidates = [...fallbackCandidates];
        if (tipo === 'VARETA_ALGODAO_DOCE_MADEIRA' && allCandidates.length === 0) {
          const fallback2 = allNonPcByTypeAndDim.get(`VARETA_ALGODAO_DOCE|${dims}`) || [];
          allCandidates = [...fallback2];
        }
      }
      
      if (allCandidates.length > 0) {
        allCandidates.sort((a, b) => b.unitsPerBox - a.unitsPerBox);
        const best = allCandidates[0];
        pcToCxMap.set(code, {
          parentCode: best.code,
          parentDesc: best.desc,
          parentUnitsPerBox: best.unitsPerBox,
        });
      }
    }
  }
  
  return pcToCxMap;
}

/**
 * Converte quantidade de PC para CX usando o mapa de conversão.
 * Fórmula: caixas = totalUnidades / unidadesPorCaixa_do_mãe
 * Onde totalUnidades = qtd_pacotes × unidades_por_pacote
 */
function convertPcToCx(
  quantidadeOriginal: number,
  unidadesOriginais: number,
  parentInfo: ParentInfo | undefined,
): { quantidadeCx: number; quantidadeUn: number } {
  if (!parentInfo) {
    // Sem mapeamento - retornar como está
    return { quantidadeCx: quantidadeOriginal, quantidadeUn: unidadesOriginais };
  }
  
  // totalUnidades já está calculado (quantidadeOriginal × un_por_pacote)
  const totalUnidades = unidadesOriginais;
  const caixas = totalUnidades / parentInfo.parentUnitsPerBox;
  
  return {
    quantidadeCx: Math.round(caixas * 100) / 100, // arredondar para 2 casas
    quantidadeUn: totalUnidades,
  };
}

/**
 * Salva snapshot do estoque E-commerce atual e detecta transferências.
 * Chamado após cada sync do Maxiprod.
 */
export async function detectEcommerceTransfers(): Promise<void> {
  const db = await getDb();
  if (!db) { console.error('[E-Commerce History] Database not available'); return; }
  const today = getTodayBR();
  
  try {
    // 1. Buscar todos os itens de estoque que são variações PC (E-commerce)
    const allStock = await db.select().from(stockItems);
    const pcItems = allStock.filter(item => isEcommerceVariant(item));
    
    if (pcItems.length === 0) {
      console.log(`[E-Commerce History] Nenhum item PC encontrado no estoque`);
      return;
    }
    
    // 2. Buscar pedidos E-commerce para associar cliente/pedido
    const allOrders = await db.select().from(orderItems);
    const ecommerceOrders = allOrders.filter(o => {
      const ec = (o.estadoConfiguravel || '').toUpperCase();
      return ec === 'E-COMMERCE' || ec === 'ECOMMERCE';
    });
    
    // Map de codigoItem → pedidos E-commerce
    const ecomOrdersByCode = new Map<string, { numeroPedido: string | null; cliente: string | null }[]>();
    for (const o of ecommerceOrders) {
      if (!o.codigoItem) continue;
      const existing = ecomOrdersByCode.get(o.codigoItem) || [];
      existing.push({ numeroPedido: o.numeroPedido, cliente: o.cliente });
      ecomOrdersByCode.set(o.codigoItem, existing);
    }
    
    // 3. Buscar snapshot anterior (último snapshot para cada codigoItem)
    const previousSnapshots = await db
      .select()
      .from(ecommerceStockSnapshots)
      .where(
        sql`(${ecommerceStockSnapshots.codigoItem}, ${ecommerceStockSnapshots.createdAt}) IN (
          SELECT codigoItem, MAX(createdAt) FROM ecommerce_stock_snapshots GROUP BY codigoItem
        )`
      );
    
    const prevByCode = new Map<string, { quantidadeCx: string; quantidadeUn: string }>();
    for (const snap of previousSnapshots) {
      prevByCode.set(snap.codigoItem, { quantidadeCx: snap.quantidadeCx, quantidadeUn: snap.quantidadeUn });
    }
    
    // 4. Comparar e detectar transferências (estoque diminuiu)
    const transfers: {
      codigoItem: string;
      descricaoItem: string;
      quantidadeCxAnterior: number;
      quantidadeCxAtual: number;
      quantidadeTransferidaCx: number;
      quantidadeTransferidaUn: number;
      numeroPedido: string | null;
      cliente: string | null;
    }[] = [];
    
    for (const item of pcItems) {
      const currentCx = parseFloat(item.quantidade);
      const prev = prevByCode.get(item.codigoItem);
      
      if (prev) {
        const prevCx = parseFloat(prev.quantidadeCx);
        
        // Estoque diminuiu → transferência efetivada
        if (prevCx > currentCx) {
          const transferredCx = prevCx - currentCx;
          const unitsPerPack = extractUnitsFromDesc(item.descricaoItem);
          const transferredUn = unitsPerPack > 0 ? transferredCx * unitsPerPack : transferredCx;
          
          // Buscar pedido E-commerce relacionado
          const relatedOrders = ecomOrdersByCode.get(item.codigoItem) || [];
          const mainOrder = relatedOrders[0]; // Pegar o primeiro pedido relacionado
          
          transfers.push({
            codigoItem: item.codigoItem,
            descricaoItem: item.descricaoItem,
            quantidadeCxAnterior: prevCx,
            quantidadeCxAtual: currentCx,
            quantidadeTransferidaCx: transferredCx,
            quantidadeTransferidaUn: transferredUn,
            numeroPedido: mainOrder?.numeroPedido || null,
            cliente: mainOrder?.cliente || null,
          });
        }
      }
    }
    
    // 5. Registrar transferências detectadas
    if (transfers.length > 0) {
      for (const t of transfers) {
        await db.insert(ecommerceTransferHistory).values({
          codigoItem: t.codigoItem,
          descricaoItem: t.descricaoItem,
          quantidadeCxAnterior: t.quantidadeCxAnterior.toFixed(5),
          quantidadeCxAtual: t.quantidadeCxAtual.toFixed(5),
          quantidadeTransferidaCx: t.quantidadeTransferidaCx.toFixed(5),
          quantidadeTransferidaUn: t.quantidadeTransferidaUn.toFixed(5),
          numeroPedido: t.numeroPedido,
          cliente: t.cliente,
          dataTransferencia: today,
        });
      }
      console.log(`[E-Commerce History] ${transfers.length} transferência(s) detectada(s) e registrada(s)`);
      for (const t of transfers) {
        console.log(`  → ${t.descricaoItem}: ${t.quantidadeTransferidaCx} cx (${t.quantidadeCxAnterior} → ${t.quantidadeCxAtual})`);
      }
    } else {
      console.log(`[E-Commerce History] Nenhuma transferência detectada`);
    }
    
    // 6. Salvar snapshot atual (substituir snapshots do dia ou criar novos)
    // Deletar snapshots de hoje para evitar duplicatas
    await db.delete(ecommerceStockSnapshots).where(eq(ecommerceStockSnapshots.snapshotDate, today));
    
    // Inserir snapshots atuais
    for (const item of pcItems) {
      const unitsPerPack = extractUnitsFromDesc(item.descricaoItem);
      const qtyCx = parseFloat(item.quantidade);
      const qtyUn = unitsPerPack > 0 ? qtyCx * unitsPerPack : qtyCx;
      
      await db.insert(ecommerceStockSnapshots).values({
        codigoItem: item.codigoItem,
        descricaoItem: item.descricaoItem,
        quantidadeCx: qtyCx.toFixed(5),
        quantidadeUn: qtyUn.toFixed(5),
        snapshotDate: today,
      });
    }
    
    console.log(`[E-Commerce History] Snapshot salvo: ${pcItems.length} itens PC`);
    
  } catch (error) {
    console.error(`[E-Commerce History] Erro:`, error);
  }
}

/**
 * Busca histórico de transferências E-commerce com filtros opcionais.
 * Combina duas fontes:
 * 1. Transferências detectadas por snapshot (estoque PC diminuiu)
 * 2. Pedidos E-commerce faturados da tabela sales_orders
 * 
 * Todos os itens PC são convertidos para CX usando a lógica do produto mãe.
 * Retorna no formato normalizado esperado pelo frontend.
 */
export async function getEcommerceTransferHistoryData(filters?: {
  fromDate?: string;
  toDate?: string;
  codigoItem?: string;
}): Promise<EcommerceHistoryItem[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Construir mapa de conversão PC→CX
  const pcToCxMap = await buildPcToCxMap();
  
  const results: EcommerceHistoryItem[] = [];
  
  // ===== FONTE 1: Transferências detectadas por snapshot (tabela ecommerce_transfer_history) =====
  {
    const conditions: any[] = [];
    
    if (filters?.fromDate) {
      conditions.push(sql`${ecommerceTransferHistory.dataTransferencia} >= ${filters.fromDate}`);
    }
    if (filters?.toDate) {
      conditions.push(sql`${ecommerceTransferHistory.dataTransferencia} <= ${filters.toDate}`);
    }
    if (filters?.codigoItem) {
      conditions.push(eq(ecommerceTransferHistory.codigoItem, filters.codigoItem));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const transferRows = await db
      .select()
      .from(ecommerceTransferHistory)
      .where(whereClause)
      .orderBy(desc(ecommerceTransferHistory.createdAt));
    
    for (const row of transferRows) {
      const cxAnterior = parseFloat(row.quantidadeCxAnterior);
      const cxAtual = parseFloat(row.quantidadeCxAtual);
      const tipo = cxAtual <= 0 ? 'saida_total' : 'saida_parcial';
      
      const rawCx = parseFloat(row.quantidadeTransferidaCx);
      const rawUn = parseFloat(row.quantidadeTransferidaUn);
      
      // Converter PC→CX se aplicável
      const parentInfo = pcToCxMap.get(row.codigoItem);
      const { quantidadeCx, quantidadeUn } = convertPcToCx(rawCx, rawUn, parentInfo);
      
      results.push({
        detectedAt: row.createdAt,
        codigoItem: row.codigoItem,
        descricaoItem: row.descricaoItem,
        quantidadeCx,
        quantidadeUn,
        tipoMovimento: tipo,
        pedidoRelacionado: row.numeroPedido || null,
        cliente: row.cliente || null,
      });
    }
  }
  
  // ===== FONTE 2: Pedidos E-commerce faturados (tabela sales_orders) =====
  {
    const conditions: any[] = [
      // estadoConfiguravel = "E-COMMERCE" (case insensitive check)
      sql`UPPER(${salesOrders.estadoConfiguravel}) IN ('E-COMMERCE', 'ECOMMERCE')`,
      // estadoItem contém "Faturado" (inclui "Faturado", "Faturado parcial", "Faturado c/ entrega futura", etc.)
      sql`(${salesOrders.estadoItem} LIKE '%aturado%' OR ${salesOrders.estadoItem} LIKE '%ATURADO%')`,
    ];
    
    if (filters?.fromDate) {
      conditions.push(sql`${salesOrders.dataEmissao} >= ${filters.fromDate}`);
    }
    if (filters?.toDate) {
      conditions.push(sql`${salesOrders.dataEmissao} <= ${filters.toDate}`);
    }
    if (filters?.codigoItem) {
      conditions.push(eq(salesOrders.codigoItem, filters.codigoItem));
    }
    
    const faturadoRows = await db
      .select()
      .from(salesOrders)
      .where(and(...conditions))
      .orderBy(desc(salesOrders.collectedAt));
    
    for (const row of faturadoRows) {
      const qtd = parseFloat(row.quantidade || '0');
      const fatorConversao = parseFloat(row.fatorConversao || '1');
      const umCodigo = (row.unidadeMedidaCodigo || '').toUpperCase();
      
      // Calcular unidades totais primeiro
      let quantidadeOriginal = qtd;
      let quantidadeUn = qtd;
      
      if (fatorConversao > 1) {
        quantidadeUn = qtd * fatorConversao;
      } else if (row.quantidadeUnidadeItem) {
        quantidadeUn = parseFloat(row.quantidadeUnidadeItem);
      }
      
      // Se o item é PC, converter para CX usando o produto mãe
      let quantidadeCx = quantidadeOriginal;
      const code = row.codigoItem || '';
      const parentInfo = pcToCxMap.get(code);
      
      if (umCodigo === 'PC' && parentInfo) {
        // Converter: caixas = totalUnidades / unidadesPorCaixa_do_mãe
        const converted = convertPcToCx(quantidadeOriginal, quantidadeUn, parentInfo);
        quantidadeCx = converted.quantidadeCx;
        quantidadeUn = converted.quantidadeUn;
      } else {
        quantidadeCx = quantidadeOriginal;
      }
      
      // Determinar tipo de movimento baseado no estadoItem
      let tipoMovimento = 'faturado';
      const estadoItem = (row.estadoItem || '').toLowerCase();
      if (estadoItem.includes('parcial') || estadoItem.includes('parc.')) {
        tipoMovimento = 'faturado_parcial';
      }
      
      results.push({
        detectedAt: row.collectedAt,
        codigoItem: code,
        descricaoItem: row.descricaoItem || row.descricao || '',
        quantidadeCx,
        quantidadeUn,
        tipoMovimento,
        pedidoRelacionado: row.pedido || null,
        cliente: row.clienteApelido || row.cliente || null,
      });
    }
  }
  
  // Ordenar tudo por data (mais recente primeiro)
  results.sort((a, b) => {
    const dateA = a.detectedAt instanceof Date ? a.detectedAt.getTime() : new Date(a.detectedAt).getTime();
    const dateB = b.detectedAt instanceof Date ? b.detectedAt.getTime() : new Date(b.detectedAt).getTime();
    return dateB - dateA;
  });
  
  return results;
}
