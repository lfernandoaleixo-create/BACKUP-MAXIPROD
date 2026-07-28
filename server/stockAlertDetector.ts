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
import { stockInsufficientAlerts, stockItems } from "../drizzle/schema";
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
  isMadeira: boolean; // true se o item é de madeira (superGrupo 16, grupo 18/19)
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
          item { codigo descricao estoques { quantidade } grupo { codigo dentroDoGrupo { codigo } } }
          pedidoDeVenda {
            numero
            cliente { razaoSocial nomeFantasia }
          }
        }
      }
    }`);

    if (!data?.itensDosPedidosDeVendas?.items) return [];

    // Incluir TODOS os itens de pedidos "A aprovar".
    // Itens com estoques vazio (sem registro de estoque) são tratados como estoque = 0,
    // pois o Maxiprod marca como "Insuficiente (reservar)" mesmo quando não há registro de estoque.
    // Exemplo: código 00649 (ESPETO QUEIJO COALHO) não tem estoque no Maxiprod → insuficiente.
    return data.itensDosPedidosDeVendas.items
      .map((item: any) => {
        // Identificar se é madeira: superGrupo 16 (dentroDoGrupo.codigo) com grupo 18 ou 19
        const grupoCodigo = item.item?.grupo?.codigo || "";
        const superGrupoCodigo = item.item?.grupo?.dentroDoGrupo?.codigo || "";
        const isMadeira = superGrupoCodigo === "16" && (grupoCodigo === "18" || grupoCodigo === "19");
        return {
          itemId: item.itemId,
          codigoItem: item.item?.codigo || "",
          descricao: item.descricao || item.item?.descricao || "",
          quantidade: item.quantidade || 0,
          unidade: item.unidade?.codigo || "CX",
          pedidoNumero: String(item.pedidoDeVenda?.numero || ""),
          cliente: item.pedidoDeVenda?.cliente?.razaoSocial || item.pedidoDeVenda?.cliente?.nomeFantasia || "N/A",
          isMadeira,
        };
      });
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
  // Se estoquesAgrupados NÃO retorna dados para um item, tratamos como estoque = 0.
  // O Maxiprod marca como "Insuficiente (reservar)" mesmo quando não há registro de estoque agrupado.
  const insufficientItems: PedidoItem[] = [];
  for (const item of pedidoItems) {
    const stock = stockMap.get(item.itemId);
    const available = stock ? (stock.total - stock.reserved) : 0;
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
  // Para MADEIRA: verificar estoque local (card estoque) antes de criar alerta
  // Se tiver caixas suficientes no estoque local, não cria alerta
  let created = 0;
  const pedidosAtuais = new Set<string>();

  // Buscar estoque local (stock_items) para produtos de madeira
  const localStockRows = await db.select({
    codigoItem: stockItems.codigoItem,
    quantidade: stockItems.quantidade,
  }).from(stockItems);
  // Agregar por código (pode ter múltiplas linhas por item)
  const localStockMap = new Map<string, number>();
  for (const row of localStockRows) {
    const current = localStockMap.get(row.codigoItem) || 0;
    localStockMap.set(row.codigoItem, current + parseFloat(row.quantidade));
  }

  for (const item of insufficientItems) {
    pedidosAtuais.add(item.pedidoNumero);
    const key = `${item.pedidoNumero}-${item.codigoItem}`;
    
    if (!alertaSet.has(key)) {
      // REGRA MADEIRA (a partir de 22/07/2026): verificar estoque local
      // Se tem caixas suficientes no card de estoque, não cria alerta
      if (item.isMadeira) {
        const localQty = localStockMap.get(item.codigoItem) || 0;
        if (localQty >= item.quantidade) {
          // Estoque local suficiente para madeira → não criar alerta
          console.log(`[StockAlert] MADEIRA ${item.codigoItem} - estoque local suficiente (${localQty} >= ${item.quantidade}). Alerta não criado.`);
          continue;
        }
      }

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
        tipoItem: item.isMadeira ? "madeira" : "bambu",
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
 * - Alertas "pendente": expirar se o item não é mais insuficiente (pedido saiu de A aprovar ou estoque reposto)
 * - Alertas "aceito": expirar SOMENTE se o item não é mais insuficiente (pedido saiu de A aprovar ou estoque reposto)
 *   NÃO expirar baseado em baixas concluídas - uma baixa anterior não resolve necessariamente o pedido atual.
 *   Isso evita o ciclo infinito: aceitar → expirar por baixa → criar novo pendente → aceitar novamente.
 */
async function cleanupOldAlerts(db: any, currentPedidos?: Set<string>, currentInsufficient?: PedidoItem[]) {
  if (!currentPedidos || currentPedidos.size === 0) {
    // Nenhum pedido A aprovar → expirar PENDENTES do sistema
    await db.update(stockInsufficientAlerts)
      .set({ status: "expirado" })
      .where(
        and(
          eq(stockInsufficientAlerts.status, "pendente"),
          eq(stockInsufficientAlerts.criadoPor, "sistema")
        )
      );
    
    // Alertas aceitos NÃO devem ser expirados apenas porque não há pedidos A aprovar.
    // Eles representam uma decisão humana (Maria aceitou a insuficiência) e devem permanecer
    // até que o item seja efetivamente resolvido. Não expirar aceitos neste branch.
    console.log(`[StockAlert] Nenhum pedido A aprovar. Pendentes do sistema expirados. Aceitos mantidos.`);
    return;
  }

  // Buscar alertas pendentes E aceitos (ambos devem ser verificados)
  const alertasAtivos = await db.select({
    id: stockInsufficientAlerts.id,
    pedidoNumero: stockInsufficientAlerts.pedidoNumero,
    codigoItem: stockInsufficientAlerts.codigoItem,
    criadoPor: stockInsufficientAlerts.criadoPor,
    status: stockInsufficientAlerts.status,
    tipoItem: stockInsufficientAlerts.tipoItem,
    quantidadePedida: stockInsufficientAlerts.quantidadePedida,
  })
    .from(stockInsufficientAlerts)
    .where(inArray(stockInsufficientAlerts.status, ["pendente", "aceito"]));

  // Criar set dos itens que REALMENTE são insuficientes agora (segundo Maxiprod)
  const insufficientSet = new Set(
    (currentInsufficient || []).map(i => `${i.pedidoNumero}-${i.codigoItem}`)
  );

  // Para madeira: buscar estoque local para verificar auto-resolução
  const localStockRows = await db.select({
    codigoItem: stockItems.codigoItem,
    quantidade: stockItems.quantidade,
  }).from(stockItems);
  const localStockMap = new Map<string, number>();
  for (const row of localStockRows) {
    const current = localStockMap.get(row.codigoItem) || 0;
    localStockMap.set(row.codigoItem, current + parseFloat(row.quantidade));
  }

  const idsToExpire: number[] = [];
  const idsToAutoResolve: number[] = [];

  for (const alerta of alertasAtivos) {
    // Não expirar alertas criados manualmente - só expirar os do sistema
    if (alerta.criadoPor === 'manual') continue;
    const key = `${alerta.pedidoNumero}-${alerta.codigoItem}`;

    // REGRA MADEIRA: auto-resolver quando estoque local fica suficiente
    if (alerta.tipoItem === "madeira") {
      const localQty = localStockMap.get(alerta.codigoItem) || 0;
      const qtdPedida = parseFloat(alerta.quantidadePedida || "0");
      if (localQty >= qtdPedida) {
        // Estoque local agora é suficiente → auto-resolver
        idsToAutoResolve.push(alerta.id);
        console.log(`[StockAlert] MADEIRA ${alerta.codigoItem} - estoque reposto (${localQty} >= ${qtdPedida}). Auto-resolvido.`);
        continue;
      }
      // Se não está mais no Maxiprod como insuficiente (pedido saiu de A aprovar), expirar
      if (!insufficientSet.has(key)) {
        idsToExpire.push(alerta.id);
      }
      continue;
    }

    // REGRA BAMBU (fluxo original)
    if (alerta.status === "pendente") {
      // Para alertas "pendente": expirar se não é mais insuficiente
      if (!insufficientSet.has(key)) {
        idsToExpire.push(alerta.id);
      }
    } else if (alerta.status === "aceito") {
      // Para alertas "aceito": SÓ expirar se o item NÃO é mais insuficiente
      if (!insufficientSet.has(key)) {
        idsToExpire.push(alerta.id);
      }
    }
  }

  if (idsToExpire.length > 0) {
    await db.update(stockInsufficientAlerts)
      .set({ status: "expirado" })
      .where(inArray(stockInsufficientAlerts.id, idsToExpire));
    console.log(`[StockAlert] ${idsToExpire.length} alerta(s) expirado(s) (item não mais insuficiente)`);
  }

  // Auto-resolver alertas de madeira cujo estoque foi reposto
  if (idsToAutoResolve.length > 0) {
    await db.update(stockInsufficientAlerts)
      .set({ 
        status: "expirado",
        respostaObservacao: "Auto-resolvido: estoque local reposto (suficiente para o pedido)",
        respondidoPor: "sistema",
        respondidoEm: new Date(),
      })
      .where(inArray(stockInsufficientAlerts.id, idsToAutoResolve));
    console.log(`[StockAlert] ${idsToAutoResolve.length} alerta(s) de MADEIRA auto-resolvido(s) (estoque reposto)`);
  }
}
