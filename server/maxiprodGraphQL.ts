/**
 * Maxiprod GraphQL Sync Service
 * 
 * Connects to the Maxiprod GraphQL API to fetch stock, sales orders,
 * and purchase orders data. SOMENTE LEITURA - jamais altera dados no Maxiprod.
 * 
 * Uses the GraphQL API token (Basic auth) for authentication.
 * All queries are read-only (no mutations).
 * 
 * Supports multi-company: fetches data from all 4 companies using minhaEmpresaId field.
 */
import { ENV } from "./_core/env";
import { getDb } from "./db";
import {
  stockItems,
  orderItems,
  purchaseOrderItems,
  salesOrders,
  scraperStatus,
  accountsPayable,
  accountsReceivable,
  bankAccounts,
  bankTransactions,
} from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { processStockData } from "./stockProcessor";

const GRAPHQL_URL = "https://api.maxiprod.com.br/graphql/";

// Company ID to name mapping
const COMPANY_MAP: Record<number, string> = {
  409300001619248: "PALITOS INDUSTRIA",
  409300001624530: "VARETAS INDUSTRIA",
  409300001630645: "ESPETOS INDUSTRIA",
  409300001704502: "MESA INDUSTRIA",
};

function getCompanyName(minhaEmpresaId: number | null | undefined): string {
  if (!minhaEmpresaId) return "PALITOS INDUSTRIA";
  return COMPANY_MAP[minhaEmpresaId] || "PALITOS INDUSTRIA";
}

// Sync state
let isSyncing = false;
let syncProgress: SyncProgress = {
  status: "idle",
  step: "",
  percent: 0,
  details: "",
  error: null,
};

export type SyncProgress = {
  status: "idle" | "running" | "success" | "error";
  step: string;
  percent: number;
  details: string;
  error: string | null;
};

function updateProgress(updates: Partial<SyncProgress>) {
  syncProgress = { ...syncProgress, ...updates };
  console.log(`[GraphQL Sync] ${syncProgress.step} (${syncProgress.percent}%) - ${syncProgress.details}`);
}

export function getSyncProgress(): SyncProgress {
  return { ...syncProgress };
}

/**
 * Sleep helper for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a GraphQL query against the Maxiprod API
 * SOMENTE LEITURA - only queries, never mutations
 * Includes retry with exponential backoff for transient network errors
 */
async function gql<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
  const token = ENV.maxiprodGraphqlToken;
  if (!token) {
    throw new Error("MAXIPROD_GRAPHQL_TOKEN não configurado");
  }

  const body: any = { query };
  if (variables) body.variables = variables;

  const MAX_RETRIES = 3;
  const INITIAL_DELAY_MS = 5000; // 5s, 10s, 20s
  const FETCH_TIMEOUT_MS = 30000; // 30s timeout per request

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`GraphQL API error ${resp.status}: ${text}`);
      }

      const result = await resp.json();
      if (result.errors && result.errors.length > 0) {
        throw new Error(`GraphQL error: ${result.errors[0].message}`);
      }

      return result.data as T;
    } catch (err: any) {
      const isNetworkError = err.message === 'fetch failed' || 
        err.message?.includes('timeout') || 
        err.message?.includes('ETIMEDOUT') ||
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('ECONNREFUSED') ||
        err.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';

      if (isNetworkError && attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[GraphQL Sync] Tentativa ${attempt}/${MAX_RETRIES} falhou (${err.message}). Retentando em ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }

      // Not a network error or last attempt - throw
      throw err;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error('Max retries exceeded');
}

/**
 * Fetch all pages of a paginated GraphQL query
 */
async function fetchAllPages<T>(
  queryName: string,
  queryBuilder: (skip: number, take: number) => string,
  pageSize: number = 500
): Promise<T[]> {
  let allItems: T[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const query = queryBuilder(skip, pageSize);
    const data = await gql(query);
    const result = data[queryName];

    if (!result) {
      throw new Error(`Query ${queryName} returned no data`);
    }

    const items = result.items || [];
    allItems = allItems.concat(items);

    if (items.length < pageSize || allItems.length >= result.totalCount) {
      hasMore = false;
    } else {
      skip += pageSize;
    }
  }

  return allItems;
}

// ============================================================
// DATA FETCHING (SOMENTE LEITURA)
// ============================================================

/**
 * Fetch stock data (estoquesAgrupados) - grouped by item
 * Includes minhaEmpresaId to identify which company owns the stock
 */
async function fetchStock(): Promise<any[]> {
  updateProgress({ step: "Coletando estoque...", percent: 10, details: "Consultando API GraphQL" });

  const items = await fetchAllPages("estoquesAgrupados", (skip, take) => `{
    estoquesAgrupados(skip: ${skip}, take: ${take}) {
      totalCount
      items {
        itemId
        quantidadeTotal
        quantidadeReservada
        valorTotal
        minhaEmpresaId
        item {
          codigo
          descricao
          quantidadeTotalEstoque
          unidadeDeVendaPossui
          unidadeDeVendaFatorDeConversao
          grupoId
          grupoDescricao
          unidade { codigo descricao }
          unidadeDeVenda { codigo descricao }
          grupo { codigo dentroDoGrupoId dentroDoGrupo { codigo } }
        }
      }
    }
  }`);

  updateProgress({ percent: 25, details: `${items.length} itens de estoque coletados` });
  return items;
}

/**
 * Fetch open sales order items (A_FATURAR + FATURADO_COM_ENTREGA_FUTURA)
 * These are the orders that affect stock availability
 * Includes pedidoDeVenda.minhaEmpresaId for multi-company support
 */
async function fetchOpenSalesOrderItems(): Promise<any[]> {
  updateProgress({ step: "Coletando pedidos de venda em aberto...", percent: 30, details: "Consultando API GraphQL" });

  const items = await fetchAllPages("itensDosPedidosDeVendas", (skip, take) => `{
    itensDosPedidosDeVendas(
      skip: ${skip}, take: ${take},
      where: { estado: { in: [A_FATURAR, FATURADO_COM_ENTREGA_FUTURA] } }
    ) {
      totalCount
      items {
        itemId
        descricao
        quantidade
        valorUnitario
        valorTotal
        fatorDeConversao
        quantidadeNaUnidadeDoItem
        entregaData
        estado
        unidade { codigo descricao }
        item { codigo descricao grupoId grupoDescricao }
        pedidoDeVenda {
          numero
          estado
          emissaoData
          minhaEmpresaId
          cliente {
            nomeFantasia
            endereco {
              municipio {
                uf { sigla }
              }
            }
          }
          representanteOuVendedor1 { nomeFantasia }
        }
      }
    }
  }`);

  updateProgress({ percent: 45, details: `${items.length} pedidos de venda em aberto` });
  return items;
}

/**
 * Fetch ALL sales order items (all statuses) for sales analytics
 * Includes pedidoDeVenda.minhaEmpresaId for multi-company support
 */
async function fetchAllSalesOrderItems(): Promise<any[]> {
  updateProgress({ step: "Coletando todos os pedidos de venda...", percent: 50, details: "Consultando API GraphQL" });

  const items = await fetchAllPages("itensDosPedidosDeVendas", (skip, take) => `{
    itensDosPedidosDeVendas(
      skip: ${skip}, take: ${take},
      where: { estado: { in: [A_FATURAR, FATURADO_COM_ENTREGA_FUTURA, FATURADO, FATURADO_PARCIAL, PARCIALMENTE_FATURADO_COM_ENTREGA_FUTURA] } }
    ) {
      totalCount
      items {
        itemId
        descricao
        quantidade
        valorUnitario
        valorTotal
        fatorDeConversao
        quantidadeNaUnidadeDoItem
        entregaData
        estado
        unidade { codigo descricao }
        item { codigo descricao grupoId grupoDescricao }
        pedidoDeVenda {
          numero
          estado
          emissaoData
          minhaEmpresaId
          cliente {
            nomeFantasia
            endereco {
              municipio {
                uf { sigla }
              }
            }
          }
          representanteOuVendedor1 { nomeFantasia }
        }
      }
    }
  }`);

  updateProgress({ percent: 65, details: `${items.length} pedidos de venda total` });
  return items;
}

/**
 * Fetch open purchase order items (A_RECEBER + ENTREGUE_PARCIAL + RECEBIDO_PARCIAL)
 * Includes pedidoDeCompra.minhaEmpresaId for multi-company support
 */
async function fetchPurchaseOrderItems(): Promise<any[]> {
  updateProgress({ step: "Coletando pedidos de compra...", percent: 70, details: "Consultando API GraphQL" });

  const items = await fetchAllPages("itensDosPedidosDeCompra", (skip, take) => `{
    itensDosPedidosDeCompra(
      skip: ${skip}, take: ${take},
      where: { estado: { in: [A_RECEBER, ENTREGUE_PARCIAL, RECEBIDO_PARCIAL] } }
    ) {
      totalCount
      items {
        itemId
        descricao
        quantidade
        valorUnitario
        valorTotal
        fatorDeConversao
        quantidadeNaUnidadeDoItem
        entregaData
        estado
        unidade { codigo descricao }
        item { codigo descricao grupoId grupoDescricao }
        pedidoDeCompra {
          numero
          referencia
          estado
          emissaoData
          minhaEmpresaId
          fornecedor { nomeFantasia }
        }
      }
    }
  }`);

  updateProgress({ percent: 80, details: `${items.length} pedidos de compra` });
  return items;
}

// ============================================================
// DATA TRANSFORMATION & STORAGE
// ============================================================

/**
 * Transform GraphQL stock data to the format expected by the database
 * Now includes empresa identification from minhaEmpresaId
 */
function transformStockData(graphqlItems: any[]): any[] {
  return graphqlItems.map((item) => {
    const i = item.item || {};
    const grupo = i.grupo || {};
    
    const grupoId = i.grupoId ? String(i.grupoId) : "";
    const superGrupoId = grupo.dentroDoGrupoId ? String(grupo.dentroDoGrupoId) : "";
    const grupoCodigo = grupo.codigo || "";
    const superGrupoCodigo = grupo.dentroDoGrupo?.codigo || "";
    
    return {
      codigoItem: i.codigo || "",
      descricaoItem: i.descricao || "",
      quantidade: String(item.quantidadeTotal || 0),
      unidadeMedida: i.unidade?.codigo || "",
      custoUnitario: item.quantidadeTotal > 0 
        ? String((item.valorTotal || 0) / item.quantidadeTotal) 
        : "0",
      custoTotal: String(item.valorTotal || 0),
      codigoGrupo: grupoId,
      descricaoGrupo: i.grupoDescricao || "",
      codigoSuperGrupo: superGrupoId,
      descricaoSuperGrupo: "",
      grupoCodigo: grupoCodigo,
      superGrupoCodigo: superGrupoCodigo,
      empresaDona: getCompanyName(item.minhaEmpresaId),
      estoqueLocal: "Estoque",
      tipoDecodificado: "Próprio",
      maxiprodId: safeMaxiprodId(item.itemId),
    };
  });
}

/**
 * Safely convert maxiprodId to a number that fits in bigint
 */
function safeMaxiprodId(id: any): number | null {
  if (id === null || id === undefined) return null;
  const num = Number(id);
  if (isNaN(num)) return null;
  return num;
}

/**
 * Transform GraphQL open sales order items to the format expected by order_items table
 * Now includes empresa identification from pedidoDeVenda.minhaEmpresaId
 */
function transformOrderItems(graphqlItems: any[]): any[] {
  return graphqlItems.map((item) => {
    const pv = item.pedidoDeVenda || {};
    const i = item.item || {};
    
    const estadoMap: Record<string, string> = {
      A_FATURAR: "A faturar",
      FATURADO_COM_ENTREGA_FUTURA: "Faturado c/ entrega futura",
      FATURADO: "Faturado",
      FATURADO_PARCIAL: "Faturado parcial",
      PARCIALMENTE_FATURADO_COM_ENTREGA_FUTURA: "Parc. faturado c/ entrega futura",
      CANCELADO: "Cancelado",
    };
    
    const pedidoEstadoMap: Record<string, string> = {
      DIGITACAO: "Digitação",
      AAPROVAR: "A aprovar",
      APROVADO: "Aprovado",
      FATURADO: "Faturado",
      FATURADO_ENTREGA_FUTURA: "Faturado c/ entrega futura",
      CANCELADO: "Cancelado",
    };

    return {
      codigoItem: i.codigo || "",
      descricao: item.descricao || "",
      quantidade: String(item.quantidade || 0),
      unidadeMedida: item.unidade?.codigo || "",
      estadoNota: pedidoEstadoMap[pv.estado] || pv.estado || "",
      estadoItem: estadoMap[item.estado] || item.estado || "",
      numeroPedido: pv.numero || "",
      cliente: pv.cliente?.nomeFantasia || "",
      dataEmissao: pv.emissaoData || "",
      valorUnitario: String(item.valorUnitario || 0),
      valorTotal: String(item.valorTotal || 0),
      codigoGrupo: i.grupoDescricao || "",
      empresaDona: getCompanyName(pv.minhaEmpresaId),
      fatorConversao: item.fatorDeConversao ? String(item.fatorDeConversao) : null,
      quantidadeUnEstoque: item.quantidadeNaUnidadeDoItem 
        ? String(item.quantidadeNaUnidadeDoItem) 
        : null,
      maxiprodId: safeMaxiprodId(item.itemId),
    };
  });
}

/**
 * Transform GraphQL purchase order items to the format expected by purchase_order_items table
 * Now includes empresa identification from pedidoDeCompra.minhaEmpresaId
 */
function transformPurchaseOrderItems(graphqlItems: any[]): any[] {
  return graphqlItems.map((item) => {
    const pc = item.pedidoDeCompra || {};
    const i = item.item || {};

    return {
      codigoItem: i.codigo || "",
      descricaoItem: i.descricao || "",
      descricao: item.descricao || "",
      quantidade: String(item.quantidade || 0),
      quantidadeUnEstoque: item.quantidadeNaUnidadeDoItem 
        ? String(item.quantidadeNaUnidadeDoItem) 
        : null,
      fatorConversao: item.fatorDeConversao ? String(item.fatorDeConversao) : null,
      unidadeMedida: item.unidade?.codigo || "",
      unidadeMedidaEstoque: i.unidade?.codigo || "",
      dataEntrega: item.entregaData || "",
      dataEmissao: pc.emissaoData || "",
      estadoPedido: pc.estado || "",
      estadoItem: item.estado || "",
      fornecedor: pc.fornecedor?.nomeFantasia || "",
      valorTotal: String(item.valorTotal || 0),
      valorUnitario: String(item.valorUnitario || 0),
      numeroPedido: pc.numero || "",
      referencia: pc.referencia || "",
      numeroItem: null,
      codigoGrupo: i.grupoDescricao || "",
      codigoCFOP: "",
      empresaDona: getCompanyName(pc.minhaEmpresaId),
      maxiprodId: safeMaxiprodId(item.itemId),
    };
  });
}

/**
 * Transform GraphQL sales order items to the format expected by sales_orders table
 * Now includes empresa identification from pedidoDeVenda.minhaEmpresaId
 */
function transformSalesOrders(graphqlItems: any[]): any[] {
  return graphqlItems.map((item) => {
    const pv = item.pedidoDeVenda || {};
    const i = item.item || {};
    const cliente = pv.cliente || {};
    const uf = cliente.endereco?.municipio?.uf?.sigla || "";

    const estadoMap: Record<string, string> = {
      A_FATURAR: "A faturar",
      FATURADO_COM_ENTREGA_FUTURA: "Faturado c/ entrega futura",
      FATURADO: "Faturado",
      FATURADO_PARCIAL: "Faturado parcial",
      PARCIALMENTE_FATURADO_COM_ENTREGA_FUTURA: "Parc. faturado c/ entrega futura",
      CANCELADO: "Cancelado",
    };

    return {
      dataEmissao: pv.emissaoData || null,
      dataEntrega: item.entregaData || null,
      dataAprovacao: null,
      pedido: pv.numero || "",
      cliente: cliente.nomeFantasia || "",
      clienteApelido: cliente.nomeFantasia || "",
      uf: uf,
      descricao: item.descricao || "",
      estadoItem: estadoMap[item.estado] || item.estado || "",
      quantidade: String(item.quantidade || 0),
      valorUnitario: String(item.valorUnitario || 0),
      valorTotal: String(item.valorTotal || 0),
      valorContabil: null,
      valorFaturar: null,
      fatorConversao: item.fatorDeConversao ? String(item.fatorDeConversao) : null,
      codigoGrupo: i.grupoDescricao || "",
      idGrupoItem: i.grupoId || null,
      empresa: getCompanyName(pv.minhaEmpresaId),
      representante: pv.representanteOuVendedor1?.nomeFantasia || "",
      segmento: "",
      regiao: uf || "",
    };
  });
}

/**
 * Save all data to the database
 */
async function saveAllData(
  stockData: any[],
  orderData: any[],
  poData: any[],
  salesData: any[]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  updateProgress({ step: "Salvando dados...", percent: 85, details: "Atualizando estoque" });

  // Save stock items
  await db.delete(stockItems);
  if (stockData.length > 0) {
    for (let i = 0; i < stockData.length; i += 200) {
      await db.insert(stockItems).values(stockData.slice(i, i + 200));
    }
  }

  updateProgress({ percent: 88, details: "Atualizando pedidos de venda" });

  // Save order items (open orders for stock calculation)
  await db.delete(orderItems);
  if (orderData.length > 0) {
    for (let i = 0; i < orderData.length; i += 200) {
      await db.insert(orderItems).values(orderData.slice(i, i + 200));
    }
  }

  updateProgress({ percent: 90, details: "Atualizando pedidos de compra" });

  // Save purchase order items
  await db.delete(purchaseOrderItems);
  if (poData.length > 0) {
    for (let i = 0; i < poData.length; i += 200) {
      await db.insert(purchaseOrderItems).values(poData.slice(i, i + 200));
    }
  }

  updateProgress({ percent: 92, details: "Atualizando vendas" });

  // Save sales orders (all statuses for analytics)
  await db.delete(salesOrders);
  if (salesData.length > 0) {
    for (let i = 0; i < salesData.length; i += 200) {
      await db.insert(salesOrders).values(salesData.slice(i, i + 200));
    }
  }

  updateProgress({ percent: 95, details: "Processando dashboard" });

  // Reprocess stock data for dashboard
  await processStockData();
}

// ============================================================
// FINANCIAL DATA FETCHING (SOMENTE LEITURA)
// ============================================================

/**
 * Fetch all contas a pagar from Maxiprod
 * SOMENTE LEITURA
 */
async function fetchAccountsPayable(): Promise<any[]> {
  updateProgress({ step: "Coletando contas a pagar...", percent: 96, details: "Consultando API GraphQL" });

  const items = await fetchAllPages("contaAPagar", (skip, take) => `{
    contaAPagar(skip: ${skip}, take: ${take}, where: { estado: { eq: EMITIDO } }, order: { vencimentoData: DESC }) {
      totalCount
      items {
        id
        estado
        tipo
        valorOriginal
        valorLiquido
        valorRetido
        valorDeDesconto
        valorDeAcrescimo
        valorPagoLiquido
        emissaoData
        vencimentoData
        vencimentoOriginalData
        liquidacaoData
        referenteA
        parcela
        parcelasQuantidadeTotal
        observacoes
        documentoVinculadoNumero
        bloqueado
        fornecedor { nomeFantasia razaoSocial }
        centroDeCustos { id }
        conta { id }
        minhaEmpresaId
      }
    }
  }`);

  updateProgress({ percent: 97, details: `${items.length} contas a pagar coletadas` });
  return items;
}

/**
 * Fetch all contas a receber from Maxiprod
 * SOMENTE LEITURA
 */
async function fetchAccountsReceivable(): Promise<any[]> {
  updateProgress({ step: "Coletando contas a receber...", percent: 97, details: "Consultando API GraphQL" });

  const items = await fetchAllPages("contaAReceber", (skip, take) => `{
    contaAReceber(skip: ${skip}, take: ${take}, where: { estado: { eq: EMITIDO } }, order: { vencimentoData: DESC }) {
      totalCount
      items {
        id
        estado
        tipo
        valorOriginal
        valorLiquido
        valorRetido
        valorDeDesconto
        valorDeAcrescimo
        valorRecebidoLiquido
        emissaoData
        vencimentoData
        vencimentoOriginalData
        liquidacaoData
        referenteA
        parcela
        parcelasQuantidadeTotal
        observacoes
        documentoVinculadoNumero
        bloqueado
        cliente { nomeFantasia razaoSocial }
        centroDeCustos { id }
        conta { id }
        minhaEmpresaId
      }
    }
  }`);

  updateProgress({ percent: 98, details: `${items.length} contas a receber coletadas` });
  return items;
}

/**
 * Transform contas a pagar data
 */
function transformAccountsPayable(items: any[]): any[] {
  return items.map(item => ({
    maxiprodId: item.id,
    estado: item.estado || "",
    tipo: item.tipo || null,
    valorOriginal: item.valorOriginal != null ? String(item.valorOriginal) : null,
    valorLiquido: item.valorLiquido != null ? String(item.valorLiquido) : null,
    valorRetido: item.valorRetido != null ? String(item.valorRetido) : null,
    valorDeDesconto: item.valorDeDesconto != null ? String(item.valorDeDesconto) : null,
    valorDeAcrescimo: item.valorDeAcrescimo != null ? String(item.valorDeAcrescimo) : null,
    valorPagoLiquido: item.valorPagoLiquido != null ? String(item.valorPagoLiquido) : null,
    emissaoData: item.emissaoData || null,
    vencimentoData: item.vencimentoData || null,
    vencimentoOriginalData: item.vencimentoOriginalData || null,
    liquidacaoData: item.liquidacaoData || null,
    referenteA: item.referenteA || null,
    parcela: item.parcela || null,
    parcelasQuantidadeTotal: item.parcelasQuantidadeTotal || null,
    observacoes: item.observacoes || null,
    documentoVinculadoNumero: item.documentoVinculadoNumero || null,
    bloqueado: item.bloqueado || false,
    fornecedor: item.fornecedor?.nomeFantasia || item.fornecedor?.razaoSocial || "",
    centroDeCustosId: item.centroDeCustos?.id || null,
    contaId: item.conta?.id || null,
    empresaId: item.minhaEmpresaId || null,
    empresaNome: getCompanyName(item.minhaEmpresaId),
  }));
}

/**
 * Transform contas a receber data
 */
function transformAccountsReceivable(items: any[]): any[] {
  return items.map(item => ({
    maxiprodId: item.id,
    estado: item.estado || "",
    tipo: item.tipo || null,
    valorOriginal: item.valorOriginal != null ? String(item.valorOriginal) : null,
    valorLiquido: item.valorLiquido != null ? String(item.valorLiquido) : null,
    valorRetido: item.valorRetido != null ? String(item.valorRetido) : null,
    valorDeDesconto: item.valorDeDesconto != null ? String(item.valorDeDesconto) : null,
    valorDeAcrescimo: item.valorDeAcrescimo != null ? String(item.valorDeAcrescimo) : null,
    valorRecebidoLiquido: item.valorRecebidoLiquido != null ? String(item.valorRecebidoLiquido) : null,
    emissaoData: item.emissaoData || null,
    vencimentoData: item.vencimentoData || null,
    vencimentoOriginalData: item.vencimentoOriginalData || null,
    liquidacaoData: item.liquidacaoData || null,
    referenteA: item.referenteA || null,
    parcela: item.parcela || null,
    parcelasQuantidadeTotal: item.parcelasQuantidadeTotal || null,
    observacoes: item.observacoes || null,
    documentoVinculadoNumero: item.documentoVinculadoNumero || null,
    bloqueado: item.bloqueado || false,
    cliente: item.cliente?.nomeFantasia || item.cliente?.razaoSocial || "",
    centroDeCustosId: item.centroDeCustos?.id || null,
    contaId: item.conta?.id || null,
    empresaId: item.minhaEmpresaId || null,
    empresaNome: getCompanyName(item.minhaEmpresaId),
  }));
}

/**
 * Save financial data to the database
 */
async function saveFinancialData(
  payableData: any[],
  receivableData: any[]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  updateProgress({ step: "Salvando dados financeiros...", percent: 98, details: "Atualizando contas" });

  // Deduplicate by maxiprodId (API pagination can return duplicates)
  const deduplicateByMaxiprodId = (items: any[]): any[] => {
    const seen = new Set<number>();
    const unique: any[] = [];
    for (const item of items) {
      if (!seen.has(item.maxiprodId)) {
        seen.add(item.maxiprodId);
        unique.push(item);
      }
    }
    if (unique.length < items.length) {
      console.log(`[GraphQL Sync] Deduplicação: ${items.length} -> ${unique.length} registros (${items.length - unique.length} duplicatas removidas)`);
    }
    return unique;
  };

  const uniquePayable = deduplicateByMaxiprodId(payableData);
  const uniqueReceivable = deduplicateByMaxiprodId(receivableData);

  // Save accounts payable (delete all + re-insert)
  await db.delete(accountsPayable);
  if (uniquePayable.length > 0) {
    for (let i = 0; i < uniquePayable.length; i += 200) {
      await db.insert(accountsPayable).values(uniquePayable.slice(i, i + 200));
    }
  }

  // Save accounts receivable (delete all + re-insert)
  await db.delete(accountsReceivable);
  if (uniqueReceivable.length > 0) {
    for (let i = 0; i < uniqueReceivable.length; i += 200) {
      await db.insert(accountsReceivable).values(uniqueReceivable.slice(i, i + 200));
    }
  }
}

// ============================================================
// BANK ACCOUNTS & OFX TRANSACTIONS (SOMENTE LEITURA)
// ============================================================

/**
 * Fetch bank accounts (FormaDeCobranca) from Maxiprod
 */
async function fetchBankAccounts(): Promise<any[]> {
  return fetchAllPages<any>(
    "formaDeCobranca",
    (skip, take) => `{ formaDeCobranca(take: ${take}, skip: ${skip}, where: { ativo: { eq: true } }) { items { id contaNumero agenciaCodigo banco { descricao } minhaEmpresaId } totalCount } }`,
    50
  );
}

/**
 * Fetch OFX transactions (itensOfx) from Maxiprod
 */
async function fetchOFXTransactions(): Promise<any[]> {
  return fetchAllPages<any>(
    "itensOfx",
    (skip, take) => `{ itensOfx(take: ${take}, skip: ${skip}, order: [{ data: DESC }]) { items { id data descricao valor contaBancariaId } totalCount } }`,
    200
  );
}

/**
 * Save bank accounts and OFX transactions to the database
 * Preserves saldoInicial and saldoInicialData set by the user
 */
async function saveBankData(rawAccounts: any[], rawTransactions: any[]): Promise<{ accounts: number; transactions: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  updateProgress({ step: "Salvando dados bancários...", percent: 97, details: "Contas e movimentações" });

  // Get existing bank accounts to preserve saldoInicial
  const existingAccounts = await db.select().from(bankAccounts);
  const existingSaldos = new Map<number, { saldoInicial: string; saldoInicialData: string | null }>();
  existingAccounts.forEach(a => {
    existingSaldos.set(a.maxiprodId, {
      saldoInicial: a.saldoInicial || "0",
      saldoInicialData: a.saldoInicialData || null,
    });
  });

  // Transform and deduplicate bank accounts
  const accountMap = new Map<number, any>();
  for (const acc of rawAccounts) {
    if (!acc.contaNumero || accountMap.has(acc.id)) continue;
    const existing = existingSaldos.get(acc.id);
    accountMap.set(acc.id, {
      maxiprodId: acc.id,
      bancoNome: acc.banco?.descricao || "Desconhecido",
      agencia: acc.agenciaCodigo || null,
      contaNumero: acc.contaNumero,
      empresaId: acc.minhaEmpresaId || null,
      empresaNome: getCompanyName(acc.minhaEmpresaId),
      ativo: true,
      saldoInicial: existing?.saldoInicial || "0",
      saldoInicialData: existing?.saldoInicialData || null,
    });
  }
  const accountData = Array.from(accountMap.values());

  // Save bank accounts (delete + re-insert preserving saldos)
  await db.delete(bankAccounts);
  if (accountData.length > 0) {
    for (let i = 0; i < accountData.length; i += 50) {
      await db.insert(bankAccounts).values(accountData.slice(i, i + 50));
    }
  }

  // Transform and deduplicate OFX transactions
  const txnMap = new Map<number, any>();
  for (const txn of rawTransactions) {
    if (txnMap.has(txn.id)) continue;
    txnMap.set(txn.id, {
      maxiprodId: txn.id,
      data: txn.data ? txn.data.split("T")[0] : "",
      descricao: txn.descricao || null,
      valor: String(txn.valor),
      contaBancariaId: txn.contaBancariaId,
    });
  }
  const txnData = Array.from(txnMap.values());

  // Save transactions (delete + re-insert)
  await db.delete(bankTransactions);
  if (txnData.length > 0) {
    for (let i = 0; i < txnData.length; i += 50) {
      await db.insert(bankTransactions).values(txnData.slice(i, i + 50));
    }
  }

  console.log(`[GraphQL Sync] Bank: ${accountData.length} contas, ${txnData.length} movimentações OFX`);
  return { accounts: accountData.length, transactions: txnData.length };
}

// ============================================================
// MAIN SYNC FUNCTION
// ============================================================

/**
 * Run full sync via GraphQL API
 * SOMENTE LEITURA - all operations are GET/query only
 * Fetches data from all companies (multi-CNPJ support via minhaEmpresaId)
 */
export async function runGraphQLSync(): Promise<{
  success: boolean;
  error?: string;
  counts?: {
    stock: number;
    openOrders: number;
    purchaseOrders: number;
    salesOrders: number;
    accountsPayable: number;
    accountsReceivable: number;
  };
}> {
  if (isSyncing) {
    return { success: false, error: "Sincronização já em andamento" };
  }

  isSyncing = true;
  updateProgress({
    status: "running",
    step: "Iniciando sincronização via GraphQL...",
    percent: 0,
    details: "",
    error: null,
  });

  try {
    // ALL fetches in PARALLEL for maximum speed
    const [rawStock, rawOpenOrders, rawAllSales, rawPOs, rawPayable, rawReceivable] = await Promise.all([
      fetchStock(),
      fetchOpenSalesOrderItems(),
      fetchAllSalesOrderItems(),
      fetchPurchaseOrderItems(),
      fetchAccountsPayable().catch(e => { console.error("[GraphQL Sync] Payable fetch error:", e.message); return []; }),
      fetchAccountsReceivable().catch(e => { console.error("[GraphQL Sync] Receivable fetch error:", e.message); return []; }),
    ]);

    const stockData = transformStockData(rawStock);
    const orderData = transformOrderItems(rawOpenOrders);
    const salesData = transformSalesOrders(rawAllSales);
    const poData = transformPurchaseOrderItems(rawPOs);
    const payableData = transformAccountsPayable(rawPayable);
    const receivableData = transformAccountsReceivable(rawReceivable);

    console.log(`[GraphQL Sync] Fetched: ${stockData.length}est ${orderData.length}ped ${salesData.length}vnd ${poData.length}po ${payableData.length}pg ${receivableData.length}rc`);

    // Save all data in parallel
    await Promise.all([
      saveAllData(stockData, orderData, poData, salesData),
      saveFinancialData(payableData, receivableData).catch(e => console.error("[GraphQL Sync] Financial save error:", e.message)),
    ]);

    const payableCount = payableData.length;
    const receivableCount = receivableData.length;

    // 7. Bank sync removed from auto-sync (too slow). Use syncBankData() manually.

    // 8. Update scraper status
    const db = await getDb();
    if (db) {
      const existing = await db.select().from(scraperStatus).limit(1);
      const statusMsg = `GraphQL OK: ${stockData.length}est ${orderData.length}ped ${poData.length}po ${salesData.length}vnd ${payableCount}pg ${receivableCount}rc`;
      const statusUpdate = {
        isConnected: true,
        lastSyncAt: new Date(),
        lastSyncStatus: statusMsg.substring(0, 50),
        lastError: null,
        needsMfa: false,
      };

      if (existing.length === 0) {
        await db.insert(scraperStatus).values(statusUpdate);
      } else {
        await db
          .update(scraperStatus)
          .set(statusUpdate)
          .where(eq(scraperStatus.id, existing[0].id));
      }
    }

    updateProgress({
      status: "success",
      step: "Sincronização concluída!",
      percent: 100,
      details: `${stockData.length} estoque, ${orderData.length} pedidos, ${poData.length} POs, ${salesData.length} vendas, ${payableCount} a pagar, ${receivableCount} a receber`,
      error: null,
    });

    isSyncing = false;
    return {
      success: true,
      counts: {
        stock: stockData.length,
        openOrders: orderData.length,
        purchaseOrders: poData.length,
        salesOrders: salesData.length,
        accountsPayable: payableCount,
        accountsReceivable: receivableCount,
      },
    };
  } catch (error: any) {
    console.error("[GraphQL Sync] Error:", error.message);
    
    // Provide user-friendly error message for network issues
    const isNetworkError = error.message === 'fetch failed' || 
      error.message?.includes('timeout') || 
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('ECONNRESET') ||
      error.message?.includes('ECONNREFUSED') ||
      error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';
    
    const userMessage = isNetworkError 
      ? 'Servidor do Maxiprod indisponível no momento. Tente novamente em alguns minutos.'
      : error.message;
    
    updateProgress({
      status: "error",
      step: "Erro na sincronização",
      percent: 0,
      details: "",
      error: userMessage,
    });

    // Update scraper status with error
    try {
      const db = await getDb();
      if (db) {
        const existing = await db.select().from(scraperStatus).limit(1);
        const statusUpdate = {
          isConnected: false,
          lastSyncStatus: "error",
          lastError: userMessage,
        };
        if (existing.length > 0) {
          await db
            .update(scraperStatus)
            .set(statusUpdate)
            .where(eq(scraperStatus.id, existing[0].id));
        }
      }
    } catch {}

    isSyncing = false;
    return { success: false, error: error.message };
  }
}

/**
 * Quick test to verify GraphQL API connectivity
 */
export async function testGraphQLConnection(): Promise<{
  connected: boolean;
  error?: string;
  itemCount?: number;
}> {
  try {
    const data = await gql(`{
      itens(take: 1) {
        totalCount
      }
    }`);
    return {
      connected: true,
      itemCount: data.itens.totalCount,
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message,
    };
  }
}
