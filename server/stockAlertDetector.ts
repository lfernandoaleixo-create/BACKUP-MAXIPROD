/**
 * Detector automático de alertas de estoque insuficiente.
 * Chamado pelo scheduler após cada sincronização com o Maxiprod.
 * 
 * Lógica (via GraphQL direto no Maxiprod):
 * 1. Busca itens de pedidos com pedidoDeVenda.estado = AAPROVAR via GraphQL
 * 2. Busca estoque agrupado (quantidadeTotal - quantidadeReservada) para cada item
 * 3. Se estoque disponível < quantidade pedida → item é insuficiente
 * 4. Cria alertas para itens insuficientes que não tenham alerta recente (pendente/aceito/recusado)
 * 5. Expira alertas pendentes de pedidos que não estão mais em "A aprovar"
 */
import { getDb } from "./db";
import { stockInsufficientAlerts } from "../drizzle/schema";
import { eq, and, inArray, gte } from "drizzle-orm";
import { gql } from "./maxiprodGraphQL";

interface PedidoItem {
  itemId: number;
  codigoItem: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  pedidoNumero: string;
  cliente: string;
}

/**
 * Fetch items from pedidos in "A aprovar" state directly from Maxiprod GraphQL.
 * Also fetches the item's estoques to determine if the item has stock records.
 * Only items WITH stock records can be "Insuficiente (reservar)".
 */
async function fetchAaprovarItems(): Promise<PedidoItem[]> {
  try {
    const data = await gql<any>(`{
      itensDosPedidosDeVendas(
        skip: 0, take: 500,
        where: { pedidoDeVenda: { estado: { eq: AAPROVAR } } }
      ) {
        totalCount
        items {
          itemId
          descricao
          quantidade
          estado
          unidade { codigo }
          item { codigo descricao estoques { quantidade } }
          pedidoDeVenda {
            numero
            cliente { razaoSocial nomeFantasia }
          }
        }
      }
    }`);

    if (!data?.itensDosPedidosDeVendas?.items) return [];

    // CRITICAL: Only include items that HAVE stock records in Maxiprod.
    // If item.estoques is empty (no stock records), Maxiprod does NOT mark as "Insuficiente".
    // The "Insuficiente (reservar)" only appears when the item HAS stock records but qty is insufficient.
    return data.itensDosPedidosDeVendas.items
      .filter((item: any) => {
        const estoques = item.item?.estoques || [];
        // Item must have at least one stock record to be considered for insufficiency
        return estoques.length > 0;
      })
      .map((item: any) => ({
        itemId: item.itemId,
        codigoItem: item.item?.codigo || "",
        descricao: item.descricao || item.item?.descricao || "",
        quantidade: item.quantidade || 0,
        unidade: item.unidade?.codigo || "CX",
        pedidoNumero: String(item.pedidoDeVenda?.numero || ""),
        cliente: item.pedidoDeVenda?.cliente?.razaoSocial || item.pedidoDeVenda?.cliente?.nomeFantasia || "N/A",
      }));
  } catch (error: any) {
    console.error("[StockAlert] Erro ao buscar itens A aprovar via GraphQL:", error.message);
    return [];
  }
}

/**
 * Fetch aggregated stock for given itemIds from Maxiprod GraphQL
 */
async function fetchStockForItems(itemIds: number[]): Promise<Map<number, { total: number; reserved: number }>> {
  const stockMap = new Map<number, { total: number; reserved: number }>();
  if (itemIds.length === 0) return stockMap;

  try {
    const data = await gql<any>(`{
      estoquesAgrupados(
        skip: 0, take: 1000,
        where: { itemId: { in: [${itemIds.join(",")}] } }
      ) {
        totalCount
        items {
          itemId
          quantidadeTotal
          quantidadeReservada
        }
      }
    }`);

    if (!data?.estoquesAgrupados?.items) return stockMap;

    for (const s of data.estoquesAgrupados.items) {
      const existing = stockMap.get(s.itemId) || { total: 0, reserved: 0 };
      existing.total += s.quantidadeTotal || 0;
      existing.reserved += s.quantidadeReservada || 0;
      stockMap.set(s.itemId, existing);
    }
  } catch (error: any) {
    console.error("[StockAlert] Erro ao buscar estoque via GraphQL:", error.message);
  }

  return stockMap;
}

export async function detectStockInsufficientAlerts(): Promise<{ created: number; message: string }> {
  const db = await getDb();
  if (!db) return { created: 0, message: "Database not available" };

  // 1. Buscar itens de pedidos "A aprovar" direto do Maxiprod via GraphQL
  const pedidoItems = await fetchAaprovarItems();
  
  if (pedidoItems.length === 0) {
    // Nenhum pedido em A aprovar → expirar todos os alertas pendentes
    await cleanupOldAlerts(db);
    return { created: 0, message: "Nenhum pedido em 'A aprovar' no Maxiprod" };
  }

  // 2. Buscar estoque agrupado para os itens
  const uniqueItemIds = Array.from(new Set(pedidoItems.map(p => p.itemId)));
  const stockMap = await fetchStockForItems(uniqueItemIds);

  // 3. Identificar itens insuficientes (estoque disponível < quantidade pedida)
  const insufficientItems: PedidoItem[] = [];
  for (const item of pedidoItems) {
    const stock = stockMap.get(item.itemId) || { total: 0, reserved: 0 };
    const available = stock.total - stock.reserved;
    if (available < item.quantidade) {
      insufficientItems.push(item);
    }
  }

  // 4. Buscar alertas existentes (pendente, aceito, recusado) dos últimos 7 dias para evitar duplicatas
  const alertasExistentes = await db.select({
    pedidoNumero: stockInsufficientAlerts.pedidoNumero,
    codigoItem: stockInsufficientAlerts.codigoItem,
  })
    .from(stockInsufficientAlerts)
    .where(
      and(
        inArray(stockInsufficientAlerts.status, ["pendente", "aceito", "recusado"]),
        gte(stockInsufficientAlerts.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      )
    );

  const alertaSet = new Set(alertasExistentes.map(a => `${a.pedidoNumero}-${a.codigoItem}`));

  // 5. Criar alertas para itens insuficientes que não têm alerta recente
  let created = 0;
  const pedidosAtuais = new Set<string>();

  for (const item of insufficientItems) {
    pedidosAtuais.add(item.pedidoNumero);
    const key = `${item.pedidoNumero}-${item.codigoItem}`;
    
    if (!alertaSet.has(key)) {
      const stock = stockMap.get(item.itemId) || { total: 0, reserved: 0 };
      const available = stock.total - stock.reserved;

      await db.insert(stockInsufficientAlerts).values({
        pedidoNumero: item.pedidoNumero,
        cliente: item.cliente,
        codigoItem: item.codigoItem,
        descricaoItem: item.descricao,
        quantidadePedida: String(item.quantidade),
        unidadeMedida: item.unidade,
        estoqueDisponivel: String(Math.max(0, available)),
        status: "pendente",
        criadoPor: "sistema",
      });
      alertaSet.add(key);
      created++;
    }
  }

  // 6. Limpar alertas pendentes de pedidos que não estão mais insuficientes
  await cleanupOldAlerts(db, pedidosAtuais, insufficientItems);

  const msg = `${created} novo(s) alerta(s). ${insufficientItems.length} item(ns) insuficiente(s) em ${pedidosAtuais.size} pedido(s) A aprovar.`;
  console.log(`[StockAlert] ${msg}`);
  return { created, message: msg };
}

/**
 * Remove alertas pendentes E aceitos que não correspondem mais a itens insuficientes em pedidos "A aprovar".
 * 
 * Lógica:
 * - Alertas "pendente": expirar se o item não é mais insuficiente ou pedido saiu de A aprovar
 * - Alertas "aceito": expirar se o pedido saiu de A aprovar (baixa já foi dada no Maxiprod)
 *   OU se o item não é mais insuficiente (estoque foi reposto)
 * 
 * Isso garante que quando a Larissa dá a baixa direto no Maxiprod (sem clicar Concluir no dashboard),
 * o alerta sai automaticamente do card de insuficiência na aba Faturamento.
 */
async function cleanupOldAlerts(db: any, currentPedidos?: Set<string>, currentInsufficient?: PedidoItem[]) {
  // Importar tabela de solicitações de baixa para verificar quais destinos já foram concluídos
  const { stockWithdrawalRequests } = await import("../drizzle/schema");
  
  // Buscar todos os produto_destino_code de baixas concluídas
  const concludedWithdrawals = await db.select({
    produtoDestinoCode: stockWithdrawalRequests.produtoDestinoCode,
    productCode: stockWithdrawalRequests.productCode,
  })
    .from(stockWithdrawalRequests)
    .where(eq(stockWithdrawalRequests.status, "concluida"));
  
  const concludedDestinoCodes = new Set(
    concludedWithdrawals
      .filter((w: any) => w.produtoDestinoCode)
      .map((w: any) => w.produtoDestinoCode)
  );
  const concludedSourceCodes = new Set(
    concludedWithdrawals.map((w: any) => w.productCode)
  );

  if (!currentPedidos || currentPedidos.size === 0) {
    // Nenhum pedido A aprovar → expirar PENDENTES do sistema
    // Para ACEITOS: só expirar se houver baixa concluída correspondente
    await db.update(stockInsufficientAlerts)
      .set({ status: "expirado" })
      .where(
        and(
          eq(stockInsufficientAlerts.status, "pendente"),
          eq(stockInsufficientAlerts.criadoPor, "sistema")
        )
      );
    
    // Agora verificar aceitos individualmente
    const alertasAceitos = await db.select({
      id: stockInsufficientAlerts.id,
      codigoItem: stockInsufficientAlerts.codigoItem,
      criadoPor: stockInsufficientAlerts.criadoPor,
    })
      .from(stockInsufficientAlerts)
      .where(eq(stockInsufficientAlerts.status, "aceito"));
    
    const aceitosToExpire: number[] = [];
    for (const alerta of alertasAceitos) {
      if (alerta.criadoPor === 'manual') continue;
      // Só expirar aceito se há baixa concluída com destino = código do alerta
      if (concludedDestinoCodes.has(alerta.codigoItem) || concludedSourceCodes.has(alerta.codigoItem)) {
        aceitosToExpire.push(alerta.id);
      }
    }
    
    if (aceitosToExpire.length > 0) {
      await db.update(stockInsufficientAlerts)
        .set({ status: "expirado" })
        .where(inArray(stockInsufficientAlerts.id, aceitosToExpire));
      console.log(`[StockAlert] ${aceitosToExpire.length} alerta(s) aceito(s) expirado(s) (baixa concluída no Maxiprod)`);
    }
    return;
  }

  // Buscar alertas pendentes E aceitos (ambos devem ser verificados)
  const alertasAtivos = await db.select({
    id: stockInsufficientAlerts.id,
    pedidoNumero: stockInsufficientAlerts.pedidoNumero,
    codigoItem: stockInsufficientAlerts.codigoItem,
    criadoPor: stockInsufficientAlerts.criadoPor,
    status: stockInsufficientAlerts.status,
  })
    .from(stockInsufficientAlerts)
    .where(inArray(stockInsufficientAlerts.status, ["pendente", "aceito"]));

  // Criar set dos itens que REALMENTE são insuficientes agora
  const insufficientSet = new Set(
    (currentInsufficient || []).map(i => `${i.pedidoNumero}-${i.codigoItem}`)
  );

  const idsToExpire: number[] = [];
  for (const alerta of alertasAtivos) {
    // Não expirar alertas criados manualmente - só expirar os do sistema
    if (alerta.criadoPor === 'manual') continue;
    const key = `${alerta.pedidoNumero}-${alerta.codigoItem}`;
    
    if (alerta.status === "pendente") {
      // Para alertas "pendente": expirar se não é mais insuficiente
      if (!insufficientSet.has(key)) {
        idsToExpire.push(alerta.id);
      }
    } else if (alerta.status === "aceito") {
      // Para alertas "aceito": SÓ expirar se houver baixa concluída correspondente
      // (não expirar apenas porque o pedido saiu de A aprovar)
      if (concludedDestinoCodes.has(alerta.codigoItem) || concludedSourceCodes.has(alerta.codigoItem)) {
        idsToExpire.push(alerta.id);
      }
    }
  }

  if (idsToExpire.length > 0) {
    await db.update(stockInsufficientAlerts)
      .set({ status: "expirado" })
      .where(inArray(stockInsufficientAlerts.id, idsToExpire));
    console.log(`[StockAlert] ${idsToExpire.length} alerta(s) expirado(s) (baixa concluída ou item não mais insuficiente)`);
  }
}
