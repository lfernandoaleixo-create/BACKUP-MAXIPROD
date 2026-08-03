/**
 * Detector automático de alertas de estoque insuficiente.
 * Chamado pelo scheduler após cada sincronização com o Maxiprod.
 * 
 * Lógica (via GraphQL direto no Maxiprod):
 * 1. Busca itens de pedidos com pedidoDeVenda.estado = AAPROVAR via GraphQL
 * 2. Busca estoque agrupado (quantidadeTotal - quantidadeReservada) para cada item
 * 3. Se estoque disponível < quantidade pedida E o item TEM registro em estoquesAgrupados → item é insuficiente
 *    (Itens SEM registro em estoquesAgrupados NÃO são considerados insuficientes — o Maxiprod não os controla via estoque agrupado)
 * 4. Cria alertas para itens insuficientes que não tenham alerta recente (pendente/aceito/recusado)
 * 5. Expira alertas pendentes de pedidos que não estão mais em "A aprovar"
 */
import { getDb } from "./db";
import { stockInsufficientAlerts, stockItems } from "../drizzle/schema";
import { eq, and, inArray, gte, sql } from "drizzle-orm";
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
 * Returns all items from AAPROVAR orders.
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
 * Fetch aggregated stock for given itemIds from Maxiprod GraphQL.
 * Returns a Map where:
 * - Key exists with {total, reserved} → item has stock records in Maxiprod
 * - Key does NOT exist → item has NO stock records (not tracked via estoquesAgrupados)
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

  // 3. Identificar itens insuficientes
  // REGRA ATUALIZADA (31/07/2026): Considerar insuficiente em DUAS situações:
  // A) Item TEM registro em estoquesAgrupados e disponível < pedido
  // B) Item NÃO tem registro em estoquesAgrupados MAS existe no stock_items local com
  //    quantidade insuficiente (em caixas) para atender o pedido.
  //    Isso captura VARETAS e ESPETOS que o Maxiprod não controla via estoquesAgrupados
  //    mas que realmente não têm estoque suficiente.
  
  // Buscar estoque local para fallback
  const localStockRowsForCheck = await db.select({
    codigoItem: stockItems.codigoItem,
    quantidade: stockItems.quantidade,
    fator: stockItems.unidadeDeVendaFator,
  }).from(stockItems);
  const localStockForCheck = new Map<string, { qtyUnidades: number; fator: number }>();
  for (const row of localStockRowsForCheck) {
    const existing = localStockForCheck.get(row.codigoItem) || { qtyUnidades: 0, fator: parseFloat(row.fator || "1") };
    existing.qtyUnidades += parseFloat(row.quantidade);
    if (row.fator) existing.fator = parseFloat(row.fator);
    localStockForCheck.set(row.codigoItem, existing);
  }

  // REGRA (03/08/2026): Excluir ESPETO PREMIUM P/ QUEIJO COALHO (código 00546 e variações)
  // Esses produtos não devem gerar alertas de estoque insuficiente
  const EXCLUDED_QUEIJO_COALHO_CODES = new Set(["00546", "00547", "00548", "00549", "00550"]);
  const isQueijoCoalho = (desc: string, code: string) => {
    if (EXCLUDED_QUEIJO_COALHO_CODES.has(code)) return true;
    const upper = desc.toUpperCase();
    return upper.includes("QUEIJO") && upper.includes("COALHO");
  };

  const insufficientItems: PedidoItem[] = [];
  for (const item of pedidoItems) {
    // Pular itens de Queijo Coalho - não gerar alerta
    if (isQueijoCoalho(item.descricao, item.codigoItem)) {
      continue;
    }

    const stock = stockMap.get(item.itemId);
    
    if (stock) {
      // Caso A: Tem registro em estoquesAgrupados → verificar se disponível < pedido
      // IMPORTANTE: estoquesAgrupados retorna quantidades em UNIDADES (peças individuais),
      // mas o pedido é em CX (caixas). Precisamos converter usando o fator do stock_items.
      // Ex: 00007 tem 25000 unidades, fator=5000, então 25000/5000 = 5 CX disponíveis.
      const availableUnidades = stock.total - stock.reserved;
      const localInfo = localStockForCheck.get(item.codigoItem);
      const fator = localInfo?.fator && localInfo.fator > 1 ? localInfo.fator : 1;
      const availableCaixas = fator > 1 ? availableUnidades / fator : availableUnidades;
      if (availableCaixas < item.quantidade) {
        insufficientItems.push(item);
      }
    } else {
      // Caso B: NÃO tem registro em estoquesAgrupados
      // Verificar estoque local (stock_items) como fallback
      const localInfo = localStockForCheck.get(item.codigoItem);
      if (localInfo) {
        // Item existe no stock_items - converter para caixas e comparar
        const fator = localInfo.fator || 1;
        const localCaixas = fator > 1 ? localInfo.qtyUnidades / fator : localInfo.qtyUnidades;
        if (localCaixas < item.quantidade) {
          // Estoque local insuficiente → gerar alerta
          insufficientItems.push(item);
        }
      } else {
        // Item NÃO existe nem no stock_items → gerar alerta (produto desconhecido sem estoque)
        insufficientItems.push(item);
      }
    }
  }

  // 4. Buscar alertas existentes para evitar duplicatas
  // REGRA (a partir de 28/07/2026): Se um alerta já foi ACEITO (Maria/Eva deram o aceite),
  // NUNCA criar novo alerta para o mesmo pedido+item, mesmo que o pedido volte para A aprovar
  // após modificação. O alerta de insuficiência só dispara UMA VEZ por pedido+item.
  
  // 4a. Alertas ativos (pendente/aceito/recusado) nos últimos 7 dias
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

  // 4b. Alertas que JÁ FORAM ACEITOS em qualquer momento (sem limite de tempo)
  // Isso garante que se Maria/Eva já deram aceite, o alerta NUNCA volta.
  // Busca alertas com status 'aceito' OU 'expirado' que tenham respondidoPor != 'sistema'
  // (ou seja, foram aceitos por uma pessoa real antes de serem expirados)
  const alertasAceitosPrevios = await db.select({
    pedidoNumero: stockInsufficientAlerts.pedidoNumero,
    codigoItem: stockInsufficientAlerts.codigoItem,
  })
    .from(stockInsufficientAlerts)
    .where(
      and(
        inArray(stockInsufficientAlerts.status, ["aceito", "expirado"]),
        sql`${stockInsufficientAlerts.respondidoPor} IS NOT NULL AND ${stockInsufficientAlerts.respondidoPor} != 'sistema'`
      )
    );

  const alertaSet = new Set([
    ...alertasExistentes.map(a => `${a.pedidoNumero}-${a.codigoItem}`),
    ...alertasAceitosPrevios.map(a => `${a.pedidoNumero}-${a.codigoItem}`),
  ]);

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
      const availableUnidades = stock.total - stock.reserved;
      // Convert to CX using fator from stock_items
      const localInfoForAlert = localStockForCheck.get(item.codigoItem);
      const fatorForAlert = localInfoForAlert?.fator && localInfoForAlert.fator > 1 ? localInfoForAlert.fator : 1;
      const availableCaixas = fatorForAlert > 1 ? availableUnidades / fatorForAlert : availableUnidades;

      await db.insert(stockInsufficientAlerts).values({
        pedidoNumero: item.pedidoNumero,
        cliente: item.cliente,
        codigoItem: item.codigoItem,
        descricaoItem: item.descricao,
        quantidadePedida: String(item.quantidade),
        unidadeMedida: item.unidade,
        estoqueDisponivel: String(Math.max(0, availableCaixas).toFixed(2)),
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
      // MAS só se for "pendente". Alertas "aceito" são expirados normalmente
      // (a proteção contra re-criação está no step 4b da detecção)
      if (!insufficientSet.has(key)) {
        idsToExpire.push(alerta.id);
      }
      continue;
    }

    // REGRA GERAL (BAMBU e outros)
    if (alerta.status === "pendente") {
      // Para alertas "pendente": expirar se não é mais insuficiente
      if (!insufficientSet.has(key)) {
        idsToExpire.push(alerta.id);
      }
    } else if (alerta.status === "aceito") {
      // Para alertas "aceito": expirar normalmente quando o pedido sai de A aprovar.
      // A proteção contra re-criação do alerta está no step 4b (alertasAceitosPrevios)
      // que verifica se já houve aceite humano para este pedido+item.
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
