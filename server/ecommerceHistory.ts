/**
 * E-commerce Transfer History - Snapshot & Change Detection + Faturados
 * 
 * Salva snapshots dos itens E-commerce (variações PC) a cada sync.
 * Compara snapshots para detectar quando o estoque baixou (transferência efetivada).
 * Também inclui pedidos E-commerce faturados da tabela sales_orders.
 * Registra cada movimentação no histórico para relatórios.
 */

import { getDb } from "./db";
import { ecommerceStockSnapshots, ecommerceTransferHistory, stockItems, orderItems, salesOrders } from "../drizzle/schema";
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
 * Extrai unidades por pacote da descrição (ex: "1.000 PC × 500 un" → 500)
 */
function extractUnitsFromDesc(desc: string): number {
  // Padrão: "PRODUTO 1.000 PC X 500 UN" ou similar
  const match = desc.match(/(\d+)\s*(?:un|UN|Un)/);
  if (match) return parseInt(match[1]);
  return 0;
}

/** Normalized history item shape expected by the frontend */
export interface EcommerceHistoryItem {
  detectedAt: Date | string;
  codigoItem: string;
  descricaoItem: string;
  quantidadeCx: number;
  quantidadeUn: number;
  tipoMovimento: string; // 'saida_total' | 'saida_parcial' | 'faturado'
  pedidoRelacionado: string | null;
  cliente: string | null;
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
 * Retorna no formato normalizado esperado pelo frontend.
 */
export async function getEcommerceTransferHistoryData(filters?: {
  fromDate?: string;
  toDate?: string;
  codigoItem?: string;
}): Promise<EcommerceHistoryItem[]> {
  const db = await getDb();
  if (!db) return [];
  
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
      
      results.push({
        detectedAt: row.createdAt,
        codigoItem: row.codigoItem,
        descricaoItem: row.descricaoItem,
        quantidadeCx: parseFloat(row.quantidadeTransferidaCx),
        quantidadeUn: parseFloat(row.quantidadeTransferidaUn),
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
      
      // Calcular caixas e unidades
      // Se fatorConversao > 1, a quantidade está em unidades menores e precisa converter
      // Se fatorConversao = 1 ou 0, a quantidade já está na unidade de venda
      let quantidadeCx = qtd;
      let quantidadeUn = qtd;
      
      if (fatorConversao > 1) {
        // quantidade está na unidade de venda, converter para unidades
        quantidadeUn = qtd * fatorConversao;
        quantidadeCx = qtd;
      } else if (row.quantidadeUnidadeItem) {
        quantidadeUn = parseFloat(row.quantidadeUnidadeItem);
        quantidadeCx = qtd;
      }
      
      // Determinar tipo de movimento baseado no estadoItem
      let tipoMovimento = 'faturado';
      const estadoItem = (row.estadoItem || '').toLowerCase();
      if (estadoItem.includes('parcial') || estadoItem.includes('parc.')) {
        tipoMovimento = 'faturado_parcial';
      }
      
      results.push({
        detectedAt: row.collectedAt,
        codigoItem: row.codigoItem || '',
        descricaoItem: row.descricaoItem || row.descricao || '',
        quantidadeCx: quantidadeCx,
        quantidadeUn: quantidadeUn,
        tipoMovimento: tipoMovimento,
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
