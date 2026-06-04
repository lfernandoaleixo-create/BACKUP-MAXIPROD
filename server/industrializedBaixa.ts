/**
 * Baixa Automática de Estoque de Madeira — Industrializados Faturados
 * 
 * REGRA DE NEGÓCIO (definida em 22/04/2026):
 * - Quando um item com estadoConfiguravel = "MADEIRA" ou "MADEIRA CONTABILIZADO"
 *   (grupo "industrializacao") cair como "Faturado" na aba Faturamento,
 *   abater automaticamente do estoque de madeira (madeira_stock).
 * - Fator 1:1 por unidade: faturou 10 CX → abate 10 CX; faturou em dúzias → abate dúzias; kg → kg.
 * - A partir de 22/04/2026 — NÃO retroativo. O estoque atual já está correto.
 * - NÃO mexer na aba Faturamento — apenas leitura dos dados de lá.
 * 
 * PROTEÇÃO CONTRA DUPLICATAS (fix 28/04/2026):
 * - Usa DUAS fontes para detectar duplicatas: snapshot E billing_history
 * - Mesmo que o snapshot seja limpo (deploy/restart), o billing_history impede reprocessamento
 * - Chave única: "pedido|codigoItem|quantidade"
 */

import { getDb } from "./db";
import {
  salesOrders,
  madeiraStock,
  billedIndustrializedSnapshot,
  industrializedBillingHistory,
  stockEditHistory,
  productVariants,
} from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

/** Retorna a data de hoje em Brasília como string YYYY-MM-DD */
function getTodayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Gera chave única para um faturamento: "pedido|codigoItem|quantidade"
 */
function makeKey(pedido: string, codigoItem: string, quantidade: string): string {
  return `${pedido}|${codigoItem}|${parseFloat(quantidade).toFixed(5)}`;
}

/**
 * Detecta novos faturamentos de industrializados e dá baixa no estoque de madeira.
 * Chamado após cada sync do Maxiprod (após salvar salesOrders no banco).
 * 
 * PROTEÇÃO DUPLA contra reprocessamento:
 * 1. Snapshot (billed_industrialized_snapshot) — comparação rápida
 * 2. Billing history (industrialized_billing_history) — backup permanente
 * Um item só é processado se NÃO existir em NENHUMA das duas fontes.
 */
export async function processIndustrializedBaixa(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error('[Baixa Industrializado] Database not available');
    return;
  }

  const today = getTodayBR();

  try {
    // 1. Buscar todos os itens faturados industrializados atuais
    const allSales = await db.select().from(salesOrders);
    const billedIndustrialized = allSales.filter(item => {
      const ec = (item.estadoConfiguravel || '').toUpperCase();
      const isIndustrialized = ec === 'MADEIRA' || ec === 'MADEIRA CONTABILIZADO';
      const isBilled = (item.estadoItem || '').toLowerCase() === 'faturado';
      return isIndustrialized && isBilled;
    });

    if (billedIndustrialized.length === 0) {
      console.log(`[Baixa Industrializado] Nenhum item industrializado faturado encontrado`);
      return;
    }

    // 2. PROTEÇÃO DUPLA: buscar chaves do snapshot E do billing history
    const previousSnapshot = await db.select().from(billedIndustrializedSnapshot);
    const previousHistory = await db.select({
      pedido: industrializedBillingHistory.pedido,
      codigoItem: industrializedBillingHistory.codigoItem,
      quantidade: industrializedBillingHistory.quantidade,
    }).from(industrializedBillingHistory);
    
    // Criar set combinado de chaves já processadas
    const alreadyProcessedKeys = new Set<string>();
    
    // Chaves do snapshot
    for (const snap of previousSnapshot) {
      alreadyProcessedKeys.add(makeKey(snap.pedido, snap.codigoItem, snap.quantidade));
    }
    
    // Chaves do billing history (backup permanente — nunca perde)
    for (const hist of previousHistory) {
      alreadyProcessedKeys.add(makeKey(hist.pedido, hist.codigoItem, hist.quantidade));
    }

    console.log(`[Baixa Industrializado] ${alreadyProcessedKeys.size} chaves já processadas (snapshot: ${previousSnapshot.length}, history: ${previousHistory.length})`);

    // 3. Detectar NOVOS faturamentos (não estavam em NENHUMA das duas fontes)
    const newBilled: typeof billedIndustrialized = [];
    for (const item of billedIndustrialized) {
      const key = makeKey(item.pedido || '', item.codigoItem || '', item.quantidade || '0');
      if (!alreadyProcessedKeys.has(key)) {
        newBilled.push(item);
      }
    }

    if (newBilled.length === 0) {
      console.log(`[Baixa Industrializado] Nenhum novo faturamento detectado (${billedIndustrialized.length} itens já processados)`);
    } else if (newBilled.length > 10) {
      // PROTEÇÃO: Se detectar mais de 10 novos faturamentos de uma vez,
      // provavelmente é um reprocessamento indevido (snapshot perdido).
      // Não processar e apenas logar o alerta.
      console.error(`[Baixa Industrializado] ⚠️ ALERTA: ${newBilled.length} novos faturamentos detectados de uma vez! Possível reprocessamento indevido. ABORTANDO baixas automáticas. Verifique manualmente.`);
      
      // Mesmo assim, inserir no snapshot para não alertar novamente
      await db.delete(billedIndustrializedSnapshot);
      for (let i = 0; i < billedIndustrialized.length; i += 200) {
        const batch = billedIndustrialized.slice(i, i + 200).filter(item => item.codigoItem).map(item => ({
          pedido: item.pedido || '',
          codigoItem: item.codigoItem as string,
          quantidade: parseFloat(item.quantidade || '0').toFixed(5),
          unidadeMedida: item.unidadeMedidaCodigo || null,
          snapshotDate: today,
        }));
        await db.insert(billedIndustrializedSnapshot).values(batch);
      }
      console.log(`[Baixa Industrializado] Snapshot atualizado (sem baixas). Próxima sync não repetirá o alerta.`);
    } else {
      console.log(`[Baixa Industrializado] ${newBilled.length} novo(s) faturamento(s) detectado(s)!`);

      // 4. Buscar estoque de madeira atual
      const currentMadeiraStock = await db.select().from(madeiraStock);
      const madeiraMap = new Map<string, { id: number; quantidade: string }>();
      for (const ms of currentMadeiraStock) {
        madeiraMap.set(ms.codigoItem, { id: ms.id, quantidade: ms.quantidade });
      }

      // 4.1 Buscar tabela de variações (child → parent) para resolver baixa no produto mãe
      const allVariants = await db.select().from(productVariants);
      const childToParentMap = new Map<string, { parentCode: string; conversionFactor: number }>();
      for (const v of allVariants) {
        childToParentMap.set(v.childCode, { parentCode: v.parentCode, conversionFactor: parseFloat(v.conversionFactor) });
      }

      // 5. Processar cada novo faturamento
      for (const item of newBilled) {
        if (!item.codigoItem) continue;
        const codigoItem: string = item.codigoItem;
        const quantidadeFaturada = parseFloat(item.quantidade || '0');
        const unidade = item.unidadeMedidaCodigo || 'un';

        // Verificar se o produto existe no estoque de madeira
        let madeiraItem = madeiraMap.get(codigoItem);
        let targetCode = codigoItem;
        let quantidadeAbater = quantidadeFaturada;

        // Se não encontrou no estoque, verificar se é uma VARIAÇÃO → baixar do produto MÃE
        if (!madeiraItem && childToParentMap.has(codigoItem)) {
          const variant = childToParentMap.get(codigoItem)!;
          targetCode = variant.parentCode;
          quantidadeAbater = quantidadeFaturada * variant.conversionFactor;
          madeiraItem = madeiraMap.get(targetCode);
          if (madeiraItem) {
            console.log(`  → Variação detectada: ${codigoItem} → pai ${targetCode} (fator: ${variant.conversionFactor})`);
          }
        }
        
        if (madeiraItem) {
          const estoqueAnterior = parseFloat(madeiraItem.quantidade);
          const estoqueNovo = Math.max(0, estoqueAnterior - quantidadeAbater);

          // Dar baixa no estoque de madeira (no produto alvo — pode ser o mãe)
          await db.update(madeiraStock)
            .set({
              quantidade: estoqueNovo.toFixed(5),
              updatedBy: "Sistema (Baixa Faturamento)",
              updatedAt: new Date(),
            })
            .where(eq(madeiraStock.codigoItem, targetCode));

          // Atualizar o mapa local para baixas subsequentes no mesmo sync
          madeiraMap.set(targetCode, { id: madeiraItem.id, quantidade: estoqueNovo.toFixed(5) });

          // Registrar no histórico de baixas (PERMANENTE — nunca é deletado)
          await db.insert(industrializedBillingHistory).values({
            pedido: item.pedido || '',
            codigoItem: codigoItem,
            descricaoItem: item.descricaoItem || item.descricao || '',
            cliente: item.cliente || '',
            quantidade: quantidadeAbater.toFixed(5),
            unidadeMedida: unidade,
            estoqueAnterior: estoqueAnterior.toFixed(5),
            estoqueNovo: estoqueNovo.toFixed(5),
            dataFaturamento: item.dataEmissao || '',
            dataBaixa: today,
          });

          // Registrar no histórico de edições de estoque (para auditoria)
          const descBaixa = targetCode !== codigoItem
            ? `${codigoItem} (variação → pai ${targetCode})`
            : codigoItem;
          await db.insert(stockEditHistory).values({
            card: "madeira",
            codigoItem: targetCode,
            descricaoItem: item.descricaoItem || item.descricao || '',
            valorAnterior: estoqueAnterior.toFixed(5),
            valorNovo: estoqueNovo.toFixed(5),
            operador: "Sistema (Baixa Faturamento)",
            tipo: "baixa_faturamento",
          });

          console.log(`  → Baixa: ${descBaixa} (${(item.descricaoItem || '').substring(0, 40)}) | Pedido #${item.pedido} | -${quantidadeAbater} ${unidade} | ${estoqueAnterior} → ${estoqueNovo}`);
        } else {
          console.log(`  → Sem estoque madeira: ${codigoItem} (${(item.descricaoItem || '').substring(0, 40)}) | Pedido #${item.pedido} | ${quantidadeFaturada} ${unidade} — produto não existe no madeira_stock, ignorando`);
        }
      }
    }

    // 6. Atualizar snapshot: deletar o antigo e inserir o estado atual completo
    await db.delete(billedIndustrializedSnapshot);
    
    // Inserir snapshot atual em lotes de 200
    for (let i = 0; i < billedIndustrialized.length; i += 200) {
      const batch = billedIndustrialized.slice(i, i + 200).filter(item => item.codigoItem).map(item => ({
        pedido: item.pedido || '',
        codigoItem: item.codigoItem as string,
        quantidade: parseFloat(item.quantidade || '0').toFixed(5),
        unidadeMedida: item.unidadeMedidaCodigo || null,
        snapshotDate: today,
      }));
      await db.insert(billedIndustrializedSnapshot).values(batch);
    }

    console.log(`[Baixa Industrializado] Snapshot atualizado com ${billedIndustrialized.length} itens`);

  } catch (error) {
    console.error('[Baixa Industrializado] Erro:', error);
  }
}

/**
 * Retorna o histórico de baixas automáticas para exibição no dashboard.
 */
export async function getIndustrializedBaixaHistory(filters?: {
  startDate?: string;
  endDate?: string;
  codigoItem?: string;
}): Promise<{
  items: Array<{
    id: number;
    pedido: string;
    codigoItem: string;
    descricaoItem: string | null;
    cliente: string | null;
    quantidade: string;
    unidadeMedida: string | null;
    estoqueAnterior: string;
    estoqueNovo: string;
    dataFaturamento: string | null;
    dataBaixa: string;
    createdAt: Date;
  }>;
  totalBaixas: number;
  totalQuantidade: number;
}> {
  const db = await getDb();
  if (!db) return { items: [], totalBaixas: 0, totalQuantidade: 0 };

  let query = db.select().from(industrializedBillingHistory);
  
  // Apply filters via raw SQL conditions
  const conditions: any[] = [];
  if (filters?.startDate) {
    conditions.push(sql`${industrializedBillingHistory.dataBaixa} >= ${filters.startDate}`);
  }
  if (filters?.endDate) {
    conditions.push(sql`${industrializedBillingHistory.dataBaixa} <= ${filters.endDate}`);
  }
  if (filters?.codigoItem) {
    conditions.push(eq(industrializedBillingHistory.codigoItem, filters.codigoItem!));
  }

  const items = conditions.length > 0
    ? await db.select().from(industrializedBillingHistory).where(and(...conditions)).orderBy(sql`${industrializedBillingHistory.createdAt} DESC`)
    : await db.select().from(industrializedBillingHistory).orderBy(sql`${industrializedBillingHistory.createdAt} DESC`);

  const totalBaixas = items.length;
  const totalQuantidade = items.reduce((sum, item) => sum + parseFloat(item.quantidade), 0);

  return { items, totalBaixas, totalQuantidade };
}
