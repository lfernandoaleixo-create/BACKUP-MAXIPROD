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
 * FLUXO:
 * 1. A cada sync, ler todos os itens faturados industrializados do sales_orders
 * 2. Comparar com o snapshot anterior (billed_industrialized_snapshot)
 * 3. Itens NOVOS (não estavam no snapshot) = acabaram de ser faturados → dar baixa
 * 4. Abater do madeira_stock (se o produto existir lá)
 * 5. Registrar no industrialized_billing_history
 * 6. Atualizar o snapshot para a próxima sync
 */

import { getDb } from "./db";
import {
  salesOrders,
  madeiraStock,
  billedIndustrializedSnapshot,
  industrializedBillingHistory,
  stockEditHistory,
} from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

/** Retorna a data de hoje em Brasília como string YYYY-MM-DD */
function getTodayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Detecta novos faturamentos de industrializados e dá baixa no estoque de madeira.
 * Chamado após cada sync do Maxiprod (após salvar salesOrders no banco).
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

    // 2. Buscar snapshot anterior (todos os itens já conhecidos como faturados)
    const previousSnapshot = await db.select().from(billedIndustrializedSnapshot);
    
    // Criar set de chaves únicas do snapshot anterior: "pedido|codigoItem|quantidade"
    const previousKeys = new Set<string>();
    for (const snap of previousSnapshot) {
      const key = `${snap.pedido}|${snap.codigoItem}|${parseFloat(snap.quantidade).toFixed(5)}`;
      previousKeys.add(key);
    }

    // 3. Detectar NOVOS faturamentos (não estavam no snapshot anterior)
    const newBilled: typeof billedIndustrialized = [];
    for (const item of billedIndustrialized) {
      const key = `${item.pedido || ''}|${item.codigoItem || ''}|${parseFloat(item.quantidade || '0').toFixed(5)}`;
      if (!previousKeys.has(key)) {
        newBilled.push(item);
      }
    }

    if (newBilled.length === 0) {
      console.log(`[Baixa Industrializado] Nenhum novo faturamento detectado (${billedIndustrialized.length} itens já no snapshot)`);
    } else {
      console.log(`[Baixa Industrializado] ${newBilled.length} novo(s) faturamento(s) detectado(s)!`);

      // 4. Buscar estoque de madeira atual
      const currentMadeiraStock = await db.select().from(madeiraStock);
      const madeiraMap = new Map<string, { id: number; quantidade: string }>();
      for (const ms of currentMadeiraStock) {
        madeiraMap.set(ms.codigoItem, { id: ms.id, quantidade: ms.quantidade });
      }

      // 5. Processar cada novo faturamento
      for (const item of newBilled) {
        if (!item.codigoItem) continue;
        const codigoItem: string = item.codigoItem;
        const quantidadeFaturada = parseFloat(item.quantidade || '0');
        const unidade = item.unidadeMedidaCodigo || 'un';

        // Verificar se o produto existe no estoque de madeira
        const madeiraItem = madeiraMap.get(codigoItem);
        
        if (madeiraItem) {
          const estoqueAnterior = parseFloat(madeiraItem.quantidade);
          const estoqueNovo = Math.max(0, estoqueAnterior - quantidadeFaturada);

          // Dar baixa no estoque de madeira
          await db.update(madeiraStock)
            .set({
              quantidade: estoqueNovo.toFixed(5),
              updatedBy: "Sistema (Baixa Faturamento)",
              updatedAt: new Date(),
            })
            .where(eq(madeiraStock.codigoItem, codigoItem));

          // Atualizar o mapa local para baixas subsequentes no mesmo sync
          madeiraMap.set(codigoItem, { id: madeiraItem.id, quantidade: estoqueNovo.toFixed(5) });

          // Registrar no histórico de baixas
          await db.insert(industrializedBillingHistory).values({
            pedido: item.pedido || '',
            codigoItem: codigoItem,
            descricaoItem: item.descricaoItem || item.descricao || '',
            cliente: item.cliente || '',
            quantidade: quantidadeFaturada.toFixed(5),
            unidadeMedida: unidade,
            estoqueAnterior: estoqueAnterior.toFixed(5),
            estoqueNovo: estoqueNovo.toFixed(5),
            dataFaturamento: item.dataEmissao || '',
            dataBaixa: today,
          });

          // Registrar no histórico de edições de estoque (para auditoria)
          await db.insert(stockEditHistory).values({
            card: "madeira",
            codigoItem: codigoItem,
            descricaoItem: item.descricaoItem || item.descricao || '',
            valorAnterior: estoqueAnterior.toFixed(5),
            valorNovo: estoqueNovo.toFixed(5),
            operador: "Sistema (Baixa Faturamento)",
            tipo: "baixa_faturamento",
          });

          console.log(`  → Baixa: ${codigoItem} (${(item.descricaoItem || '').substring(0, 40)}) | Pedido #${item.pedido} | -${quantidadeFaturada} ${unidade} | ${estoqueAnterior} → ${estoqueNovo}`);
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
