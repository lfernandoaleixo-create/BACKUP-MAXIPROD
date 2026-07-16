/**
 * Detector automático de alertas de estoque insuficiente.
 * Chamado pelo scheduler após cada sincronização com o Maxiprod.
 * 
 * Lógica:
 * 1. Busca pedidos RECENTES (últimos 3 dias) em estado "Digitação" no sales_orders
 * 2. Para cada item, verifica se o estoque (stock_items) é 0 ou insuficiente
 * 3. Se insuficiente e não há alerta pendente duplicado, cria um novo alerta
 * 4. Remove alertas antigos de pedidos que não estão mais em "Digitação"
 */
import { getDb } from "./db";
import { stockInsufficientAlerts, stockItems, salesOrders } from "../drizzle/schema";
import { eq, and, inArray, sql, gte, not } from "drizzle-orm";

export async function detectStockInsufficientAlerts(): Promise<{ created: number; message: string }> {
  const db = await getDb();
  if (!db) return { created: 0, message: "Database not available" };

  // Calcular data limite (últimos 3 dias)
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const dateLimit = threeDaysAgo.toISOString().split("T")[0]; // YYYY-MM-DD

  // 1. Buscar itens de pedidos RECENTES em "Digitação" (dataEmissao >= 3 dias atrás)
  const pedidosDigitacao = await db.select({
    pedido: salesOrders.pedido,
    cliente: salesOrders.cliente,
    codigoItem: salesOrders.codigoItem,
    descricaoItem: salesOrders.descricaoItem,
    quantidade: salesOrders.quantidade,
    unidadeMedida: salesOrders.unidadeMedidaCodigo,
    dataEmissao: salesOrders.dataEmissao,
  })
    .from(salesOrders)
    .where(
      and(
        eq(salesOrders.estadoNota, "Digitação"),
        gte(salesOrders.dataEmissao, dateLimit)
      )
    );

  if (pedidosDigitacao.length === 0) {
    // Limpar alertas pendentes de pedidos que não estão mais em Digitação recente
    await cleanupOldAlerts(db);
    return { created: 0, message: "Nenhum pedido recente em digitação" };
  }

  // 2. Buscar estoque disponível para esses itens (apenas bambu - superGrupoCodigo = "12")
  const codigosUnicos = Array.from(new Set(pedidosDigitacao.map(p => p.codigoItem).filter(Boolean)));
  if (codigosUnicos.length === 0) return { created: 0, message: "Nenhum item encontrado" };

  const estoqueItems = await db.select({
    codigoItem: stockItems.codigoItem,
    quantidade: stockItems.quantidade,
  })
    .from(stockItems)
    .where(
      and(
        inArray(stockItems.codigoItem, codigosUnicos as string[]),
        eq(stockItems.superGrupoCodigo, "12")
      )
    );

  // Agregar estoque por código (pode ter múltiplos locais)
  const estoqueMap = new Map<string, number>();
  for (const item of estoqueItems) {
    const current = estoqueMap.get(item.codigoItem) || 0;
    estoqueMap.set(item.codigoItem, current + Number(item.quantidade || 0));
  }

  // 3. Buscar alertas pendentes existentes para não duplicar
  const alertasExistentes = await db.select({
    pedidoNumero: stockInsufficientAlerts.pedidoNumero,
    codigoItem: stockInsufficientAlerts.codigoItem,
  })
    .from(stockInsufficientAlerts)
    .where(eq(stockInsufficientAlerts.status, "pendente"));

  const alertaSet = new Set(alertasExistentes.map(a => `${a.pedidoNumero}-${a.codigoItem}`));

  // 4. Detectar insuficientes e criar alertas (apenas para pedidos recentes)
  let created = 0;
  const pedidosRecentes = new Set<string>();
  
  for (const pedido of pedidosDigitacao) {
    if (!pedido.codigoItem || !pedido.pedido) continue;
    pedidosRecentes.add(pedido.pedido);

    const estoqueDisponivel = estoqueMap.get(pedido.codigoItem) ?? 0;

    // Se estoque é 0, definitivamente insuficiente
    if (estoqueDisponivel <= 0) {
      const key = `${pedido.pedido}-${pedido.codigoItem}`;
      if (!alertaSet.has(key)) {
        await db.insert(stockInsufficientAlerts).values({
          pedidoNumero: pedido.pedido,
          cliente: pedido.cliente || "N/A",
          codigoItem: pedido.codigoItem,
          descricaoItem: pedido.descricaoItem || pedido.codigoItem,
          quantidadePedida: String(Number(pedido.quantidade || 0)),
          unidadeMedida: pedido.unidadeMedida || "CX",
          estoqueDisponivel: "0",
          status: "pendente",
          criadoPor: "sistema",
        });
        alertaSet.add(key);
        created++;
      }
    }
  }

  // 5. Limpar alertas pendentes de pedidos que não estão mais em Digitação recente
  await cleanupOldAlerts(db, pedidosRecentes);

  return { created, message: `${created} novo(s) alerta(s) criado(s)` };
}

/**
 * Remove alertas pendentes de pedidos que não estão mais em "Digitação" recente.
 * Isso evita acumular alertas de pedidos antigos que já foram processados.
 */
async function cleanupOldAlerts(db: any, currentPedidos?: Set<string>) {
  if (!currentPedidos || currentPedidos.size === 0) {
    // Se não há pedidos recentes em digitação, marcar todos os pendentes como expirados
    await db.update(stockInsufficientAlerts)
      .set({ status: "expirado" })
      .where(eq(stockInsufficientAlerts.status, "pendente"));
    return;
  }

  // Buscar alertas pendentes que não pertencem a pedidos recentes
  const pendentes = await db.select({
    id: stockInsufficientAlerts.id,
    pedidoNumero: stockInsufficientAlerts.pedidoNumero,
  })
    .from(stockInsufficientAlerts)
    .where(eq(stockInsufficientAlerts.status, "pendente"));

  const idsToExpire: number[] = [];
  for (const alerta of pendentes) {
    if (!currentPedidos.has(alerta.pedidoNumero)) {
      idsToExpire.push(alerta.id);
    }
  }

  if (idsToExpire.length > 0) {
    await db.update(stockInsufficientAlerts)
      .set({ status: "expirado" })
      .where(inArray(stockInsufficientAlerts.id, idsToExpire));
  }
}
