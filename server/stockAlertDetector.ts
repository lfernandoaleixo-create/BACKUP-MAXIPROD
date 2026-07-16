/**
 * Detector automático de alertas de estoque insuficiente.
 * Chamado pelo scheduler após cada sincronização com o Maxiprod.
 * 
 * Lógica:
 * 1. Busca pedidos em estado "Digitação" no sales_orders
 * 2. Para cada item, verifica se o estoque (stock_items) é 0 ou insuficiente
 * 3. Se insuficiente e não há alerta pendente duplicado, cria um novo alerta
 */
import { getDb } from "./db";
import { stockInsufficientAlerts, stockItems, salesOrders } from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function detectStockInsufficientAlerts(): Promise<{ created: number; message: string }> {
  const db = await getDb();
  if (!db) return { created: 0, message: "Database not available" };

  // 1. Buscar todos os itens de pedidos em "Digitação"
  const pedidosDigitacao = await db.select({
    pedido: salesOrders.pedido,
    cliente: salesOrders.cliente,
    codigoItem: salesOrders.codigoItem,
    descricaoItem: salesOrders.descricaoItem,
    quantidade: salesOrders.quantidade,
    unidadeMedida: salesOrders.unidadeMedidaCodigo,
  })
    .from(salesOrders)
    .where(eq(salesOrders.estadoNota, "Digitação"));

  if (pedidosDigitacao.length === 0) return { created: 0, message: "Nenhum pedido em digitação" };

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

  // 4. Detectar insuficientes e criar alertas
  let created = 0;
  for (const pedido of pedidosDigitacao) {
    if (!pedido.codigoItem || !pedido.pedido) continue;

    const estoqueDisponivel = estoqueMap.get(pedido.codigoItem) ?? 0;
    const quantidadePedida = Number(pedido.quantidade || 0);

    // Se estoque é 0, definitivamente insuficiente
    if (estoqueDisponivel <= 0) {
      const key = `${pedido.pedido}-${pedido.codigoItem}`;
      if (!alertaSet.has(key)) {
        await db.insert(stockInsufficientAlerts).values({
          pedidoNumero: pedido.pedido,
          cliente: pedido.cliente || "N/A",
          codigoItem: pedido.codigoItem,
          descricaoItem: pedido.descricaoItem || pedido.codigoItem,
          quantidadePedida: String(quantidadePedida),
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

  return { created, message: `${created} novo(s) alerta(s) criado(s)` };
}
