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
  paidAccountsMonthly,
} from "../drizzle/schema";
import { eq, sql, inArray, and, ne } from "drizzle-orm";
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
 * Fetch stock data from Maxiprod ESTOQUE section
 * Uses query 'estoques' with tipo=NORMAL filter to match exactly
 * what the Maxiprod Estoque screen shows (Dentro do grupo 12).
 * 
 * IMPORTANT: estoquesAgrupados was inflating quantities by summing
 * across multiple stock types (NORMAL + EM_PRODUCAO). Using 'estoques'
 * with tipo=NORMAL gives exact match with Maxiprod UI.
 * 
 * Only fetches items from groups 20 and 21 within group 12
 * (Produtos Importados Prontos para Revenda).
 */
async function fetchStock(): Promise<any[]> {
  updateProgress({ step: "Coletando estoque...", percent: 10, details: "Consultando seção ESTOQUE do Maxiprod" });

  const items = await fetchAllPages("estoques", (skip, take) => `{
    estoques(skip: ${skip}, take: ${take}, where: {
      tipo: { eq: NORMAL },
      item: {
        grupo: {
          dentroDoGrupo: { codigo: { eq: "12" } }
        }
      }
    }) {
      totalCount
      items {
        itemId
        quantidade
        valorTotal
        minhaEmpresaId
        item {
          codigo
          descricao
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

  updateProgress({ percent: 25, details: `${items.length} registros de estoque coletados (tipo NORMAL, grupo 12)` });
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
        entregaFuturaQuantidadeEntregue
        entregaData
        estado
        unidade { codigo descricao }
        item { codigo descricao grupoId grupoDescricao ncm { codigo } }
        pedidoDeVenda {
          numero
          estado
          estadoConfiguravel { id descricao }
          emissaoData
          valorTotal
          condicaoDePagamento
          minhaEmpresaId
          transportadora { nomeFantasia razaoSocial }
          cliente {
            nomeFantasia
            razaoSocial
            inscricaoEstadual
            crmSegmento { id descricao }
            endereco {
              logradouro
              numero
              complemento
              bairro
              cep
              telefone1
              email
              municipio {
                descricao
                uf { sigla }
              }
            }
          }
          observacoes
          observacoesInternas
          ultimaAlteracaoData
          ultimaAlteracaoUsuario { nome }
          representanteOuVendedor1 { nomeFantasia razaoSocial }
          responsavelUsuario { nome }
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
        entregaFuturaQuantidadeEntregue
        entregaData
        estado
        unidade { codigo descricao }
        item { codigo descricao grupoId grupoDescricao ncm { codigo } }
        pedidoDeVenda {
          numero
          estado
          estadoConfiguravel { id descricao }
          emissaoData
          valorTotal
          condicaoDePagamento
          minhaEmpresaId
          transportadora { nomeFantasia razaoSocial }
          cliente {
            nomeFantasia
            razaoSocial
            inscricaoEstadual
            crmSegmento { id descricao }
            endereco {
              logradouro
              numero
              complemento
              bairro
              cep
              telefone1
              email
              municipio {
                descricao
                uf { sigla }
              }
            }
          }
          observacoes
          observacoesInternas
          ultimaAlteracaoData
          ultimaAlteracaoUsuario { nome }
          representanteOuVendedor1 { nomeFantasia razaoSocial }
          responsavelUsuario { nome }
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
 * Transform GraphQL stock data to the format expected by the database.
 * 
 * Now uses 'estoques' query (non-grouped) with tipo=NORMAL filter.
 * The 'estoques' query returns 'quantidade' (not 'quantidadeTotal').
 * Multiple entries per item (different lotes/ordens) are aggregated
 * here by codigoItem before inserting into the database.
 */
function transformStockData(graphqlItems: any[]): any[] {
  // First, aggregate by codigoItem since 'estoques' can return
  // multiple rows per item (different lotes, even if tipo=NORMAL)
  const aggregated = new Map<string, any>();
  
  for (const item of graphqlItems) {
    const i = item.item || {};
    const code = i.codigo || "";
    if (!code) continue;
    
    const qty = item.quantidade || 0;
    const val = item.valorTotal || 0;
    
    if (aggregated.has(code)) {
      const existing = aggregated.get(code);
      existing.quantidade += qty;
      existing.valorTotal += val;
    } else {
      aggregated.set(code, {
        quantidade: qty,
        valorTotal: val,
        item: i,
        minhaEmpresaId: item.minhaEmpresaId,
        itemId: item.itemId,
      });
    }
  }
  
  return Array.from(aggregated.values()).map((agg) => {
    const i = agg.item;
    const grupo = i.grupo || {};
    
    const grupoId = i.grupoId ? String(i.grupoId) : "";
    const superGrupoId = grupo.dentroDoGrupoId ? String(grupo.dentroDoGrupoId) : "";
    const grupoCodigo = grupo.codigo || "";
    const superGrupoCodigo = grupo.dentroDoGrupo?.codigo || "";
    
    return {
      codigoItem: i.codigo || "",
      descricaoItem: i.descricao || "",
      quantidade: String(agg.quantidade),
      unidadeMedida: i.unidade?.codigo || "",
      custoUnitario: agg.quantidade > 0 
        ? String(agg.valorTotal / agg.quantidade) 
        : "0",
      custoTotal: String(agg.valorTotal),
      codigoGrupo: grupoId,
      descricaoGrupo: i.grupoDescricao || "",
      codigoSuperGrupo: superGrupoId,
      descricaoSuperGrupo: "",
      grupoCodigo: grupoCodigo,
      superGrupoCodigo: superGrupoCodigo,
      empresaDona: getCompanyName(agg.minhaEmpresaId),
      estoqueLocal: "Estoque",
      tipoDecodificado: "Próprio",
      maxiprodId: safeMaxiprodId(agg.itemId),
      unidadeDeVendaFator: i.unidadeDeVendaFatorDeConversao ? String(i.unidadeDeVendaFatorDeConversao) : null,
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
      cliente: pv.cliente?.razaoSocial || pv.cliente?.nomeFantasia || "",
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
      // Novos campos
      dataEntregaItem: item.entregaData || null,
      ncm: i.ncm?.codigo || null,
      // Estado configurável e segmento CRM
      estadoConfiguravel: pv.estadoConfiguravel?.descricao || null,
      crmSegmento: pv.cliente?.crmSegmento?.descricao || null,
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

// Editoras que NÃO são vendedoras (apenas editam pedidos no Maxiprod)
// Regras confirmadas com Fernando 17/03/2026
const EDITORES_NAO_VENDEDORES_SYNC = ["BRENDA", "LARISSA"];

// Clientes com vendedor fixo "Grupo Fox" (definido manualmente por Fernando)
const CLIENTES_GRUPO_FOX_SYNC = ["JOHNSON", "KEURE", "S C JOHNSON", "SC JOHNSON", "S. C. JOHNSON"];

function isClienteGrupoFoxSync(nome: string): boolean {
  const upper = nome.toUpperCase();
  return CLIENTES_GRUPO_FOX_SYNC.some(prefix => upper.includes(prefix));
}

function isEditorNaoVendedorSync(nome: string): boolean {
  return EDITORES_NAO_VENDEDORES_SYNC.includes(nome.toUpperCase().trim());
}

/**
 * Resolve representante/vendedor from GraphQL data using fallback logic:
 * 1. representanteOuVendedor1.nomeFantasia (priority)
 * 2. representanteOuVendedor1.razaoSocial (fallback if nomeFantasia is null)
 * 3. responsavelUsuario.nome (fallback, excluding editors Brenda/Larissa)
 * 4. Override: Johnson/Keure clients → "Grupo Fox"
 */
function resolveRepresentante(pv: any): string {
  const clienteNome = pv.cliente?.nomeFantasia || pv.cliente?.razaoSocial || "";
  
  // Override manual: clientes Johnson e Keure → "Grupo Fox"
  if (clienteNome && isClienteGrupoFoxSync(clienteNome)) {
    return "Grupo Fox";
  }
  
  // 1. Prioridade: representanteOuVendedor1
  let rep = pv.representanteOuVendedor1?.nomeFantasia 
    || pv.representanteOuVendedor1?.razaoSocial 
    || "";
  
  // 2. Fallback: responsavelUsuario (se não for editor)
  if (!rep) {
    const responsavel = pv.responsavelUsuario?.nome || "";
    if (responsavel && !isEditorNaoVendedorSync(responsavel)) {
      rep = responsavel;
    }
  }
  
  return rep;
}

/**
 * Transform GraphQL sales order items to the format expected by sales_orders table
 * Now includes empresa identification from pedidoDeVenda.minhaEmpresaId
 * 
 * Enhanced representante resolution:
 * - Uses representanteOuVendedor1 (nomeFantasia → razaoSocial fallback)
 * - Falls back to responsavelUsuario (excluding editors Brenda/Larissa)
 * - Overrides Johnson/Keure clients to "Grupo Fox"
 * 
 * Enhanced transportadora resolution:
 * - Uses nomeFantasia → razaoSocial fallback
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

    // Resolve representante with fallback logic
    const representante = resolveRepresentante(pv);
    
    // Resolve transportadora with razaoSocial fallback
    const transportadoraNome = pv.transportadora?.nomeFantasia 
      || pv.transportadora?.razaoSocial 
      || null;

    return {
      dataEmissao: pv.emissaoData || null,
      dataEntrega: item.entregaData || null,
      dataAprovacao: null,
      pedido: pv.numero || "",
      cliente: cliente.razaoSocial || cliente.nomeFantasia || "",
      clienteApelido: cliente.nomeFantasia || cliente.razaoSocial || "",
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
      representante: representante,
      segmento: cliente.crmSegmento?.descricao || "",
      regiao: uf || "",
      // Novos campos
      condicaoPagamento: pv.condicaoDePagamento || null,
      transportadora: transportadoraNome,
      razaoSocial: cliente.razaoSocial || null,
      inscricaoEstadual: cliente.inscricaoEstadual || null,
      enderecoLogradouro: cliente.endereco?.logradouro || null,
      enderecoNumero: cliente.endereco?.numero || null,
      enderecoComplemento: cliente.endereco?.complemento || null,
      enderecoBairro: cliente.endereco?.bairro || null,
      enderecoCep: cliente.endereco?.cep || null,
      enderecoCidade: cliente.endereco?.municipio?.descricao || null,
      valorTotalPedido: pv.valorTotal ? String(pv.valorTotal) : null,
      estadoNota: ({DIGITACAO:"Digitação",AAPROVAR:"A aprovar",APROVADO:"Aprovado",FATURADO:"Faturado",FATURADO_ENTREGA_FUTURA:"Faturado c/ entrega futura",CANCELADO:"Cancelado"} as Record<string,string>)[pv.estado] || pv.estado || null,
      estadoConfiguravel: pv.estadoConfiguravel?.descricao || null,
      crmSegmento: cliente.crmSegmento?.descricao || null,
      codigoItem: i.codigo || null,
      descricaoItem: i.descricao || null,
      // Campos adicionais para detalhes completos (produção)
      unidadeMedidaCodigo: item.unidade?.codigo || null,
      unidadeMedidaDescricao: item.unidade?.descricao || null,
      quantidadeUnidadeItem: item.quantidadeNaUnidadeDoItem ? String(item.quantidadeNaUnidadeDoItem) : null,
      ncm: i.ncm?.codigo || null,
      clienteTelefone: cliente.endereco?.telefone1 || null,
      clienteEmail: cliente.endereco?.email || null,
      transportadoraRazaoSocial: pv.transportadora?.razaoSocial || null,
      grupoDescricao: i.grupoDescricao || null,
      observacoes: pv.observacoes || null,
      quantidadeFaturada: item.entregaFuturaQuantidadeEntregue != null ? String(item.entregaFuturaQuantidadeEntregue) : null,
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

  // Usar transação atômica para evitar dados inconsistentes durante a sincronização
  await db.transaction(async (tx) => {
    // Save stock items
    await tx.delete(stockItems);
    if (stockData.length > 0) {
      for (let i = 0; i < stockData.length; i += 200) {
        await tx.insert(stockItems).values(stockData.slice(i, i + 200));
      }
    }

    updateProgress({ percent: 88, details: "Atualizando pedidos de venda" });

    // Save order items (open orders for stock calculation)
    await tx.delete(orderItems);
    if (orderData.length > 0) {
      for (let i = 0; i < orderData.length; i += 200) {
        await tx.insert(orderItems).values(orderData.slice(i, i + 200));
      }
    }

    updateProgress({ percent: 90, details: "Atualizando pedidos de compra" });

    // Save purchase order items
    await tx.delete(purchaseOrderItems);
    if (poData.length > 0) {
      for (let i = 0; i < poData.length; i += 200) {
        await tx.insert(purchaseOrderItems).values(poData.slice(i, i + 200));
      }
    }

    updateProgress({ percent: 92, details: "Atualizando vendas" });

    // Save sales orders (all statuses for analytics)
    await tx.delete(salesOrders);
    if (salesData.length > 0) {
      for (let i = 0; i < salesData.length; i += 200) {
        await tx.insert(salesOrders).values(salesData.slice(i, i + 200));
      }
    }
  });

  console.log(`[GraphQL Sync] Dados de estoque/pedidos salvos atomicamente: ${stockData.length} est, ${orderData.length} ped, ${poData.length} po, ${salesData.length} vnd`);

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
    contaAPagar(skip: ${skip}, take: ${take}, where: { estado: { eq: EMITIDO } }) {
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
    contaAReceber(skip: ${skip}, take: ${take}, where: { estado: { eq: EMITIDO } }) {
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
    cliente: item.cliente?.razaoSocial || item.cliente?.nomeFantasia || "",
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

  // Validação: não salvar se os dados parecem incompletos (proteção contra falha parcial da API)
  // Se já temos dados no banco, exigir pelo menos 50% do volume anterior
  const [existingPayableCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(accountsPayable);
  const [existingReceivableCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(accountsReceivable);
  const prevPayable = Number(existingPayableCount?.count || 0);
  const prevReceivable = Number(existingReceivableCount?.count || 0);

  if (prevPayable > 10 && uniquePayable.length < prevPayable * 0.5) {
    console.warn(`[GraphQL Sync] ALERTA: Contas a pagar retornou ${uniquePayable.length} registros vs ${prevPayable} anteriores. Possível falha parcial da API. Abortando save de contas a pagar.`);
  }
  if (prevReceivable > 10 && uniqueReceivable.length < prevReceivable * 0.5) {
    console.warn(`[GraphQL Sync] ALERTA: Contas a receber retornou ${uniqueReceivable.length} registros vs ${prevReceivable} anteriores. Possível falha parcial da API. Abortando save de contas a receber.`);
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  await db.transaction(async (tx) => {
    // === ACCOUNTS PAYABLE: preservar histórico de contas pagas ===
    if (!(prevPayable > 10 && uniquePayable.length < prevPayable * 0.5)) {
      const newPayableIds = new Set(uniquePayable.map(p => p.maxiprodId));
      
      // Buscar IDs das contas EMITIDO existentes no banco
      const existingEmitido = await tx.select({ maxiprodId: accountsPayable.maxiprodId })
        .from(accountsPayable)
        .where(eq(accountsPayable.estado, 'EMITIDO'));
      
      // Contas que desapareceram da API = foram pagas
      const disappearedIds = existingEmitido
        .map(e => e.maxiprodId)
        .filter(id => !newPayableIds.has(id));
      
      if (disappearedIds.length > 0) {
        // Marcar como PAGO com liquidacaoData = hoje
        for (let i = 0; i < disappearedIds.length; i += 200) {
          const batch = disappearedIds.slice(i, i + 200);
          await tx.update(accountsPayable)
            .set({ estado: 'PAGO', liquidacaoData: today })
            .where(inArray(accountsPayable.maxiprodId, batch));
        }
        console.log(`[GraphQL Sync] ${disappearedIds.length} contas a pagar marcadas como PAGO (desapareceram da API)`);
      }
      
      // Deletar contas EMITIDO existentes (serão substituídas pelos dados frescos)
      await tx.delete(accountsPayable).where(eq(accountsPayable.estado, 'EMITIDO'));
      
      // Inserir dados frescos da API (todas EMITIDO)
      if (uniquePayable.length > 0) {
        for (let i = 0; i < uniquePayable.length; i += 200) {
          await tx.insert(accountsPayable).values(uniquePayable.slice(i, i + 200));
        }
      }
    }

    // === ACCOUNTS RECEIVABLE: mesma lógica de preservação ===
    if (!(prevReceivable > 10 && uniqueReceivable.length < prevReceivable * 0.5)) {
      const newReceivableIds = new Set(uniqueReceivable.map(r => r.maxiprodId));
      
      const existingEmitidoRec = await tx.select({ maxiprodId: accountsReceivable.maxiprodId })
        .from(accountsReceivable)
        .where(eq(accountsReceivable.estado, 'EMITIDO'));
      
      const disappearedRecIds = existingEmitidoRec
        .map(e => e.maxiprodId)
        .filter(id => !newReceivableIds.has(id));
      
      if (disappearedRecIds.length > 0) {
        for (let i = 0; i < disappearedRecIds.length; i += 200) {
          const batch = disappearedRecIds.slice(i, i + 200);
          await tx.update(accountsReceivable)
            .set({ estado: 'RECEBIDO', liquidacaoData: today })
            .where(inArray(accountsReceivable.maxiprodId, batch));
        }
        console.log(`[GraphQL Sync] ${disappearedRecIds.length} contas a receber marcadas como RECEBIDO (desapareceram da API)`);
      }
      
      // Deletar contas EMITIDO existentes (serão substituídas)
      await tx.delete(accountsReceivable).where(eq(accountsReceivable.estado, 'EMITIDO'));
      
      if (uniqueReceivable.length > 0) {
        for (let i = 0; i < uniqueReceivable.length; i += 200) {
          await tx.insert(accountsReceivable).values(uniqueReceivable.slice(i, i + 200));
        }
      }
    }
  });

  console.log(`[GraphQL Sync] Dados financeiros salvos: ${uniquePayable.length} pagar (EMITIDO), ${uniqueReceivable.length} receber (EMITIDO). Histórico de PAGO/RECEBIDO preservado.`);
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

  // Usar transação atômica para evitar dados bancários inconsistentes
  await db.transaction(async (tx) => {
    // Save bank accounts (delete + re-insert preserving saldos)
    await tx.delete(bankAccounts);
    if (accountData.length > 0) {
      for (let i = 0; i < accountData.length; i += 50) {
        await tx.insert(bankAccounts).values(accountData.slice(i, i + 50));
      }
    }

    // Save transactions (delete + re-insert)
    await tx.delete(bankTransactions);
    if (txnData.length > 0) {
      for (let i = 0; i < txnData.length; i += 50) {
        await tx.insert(bankTransactions).values(txnData.slice(i, i + 50));
      }
    }
  });

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

    // Save data sequentially to avoid database deadlocks
    // Retry up to 2 times on transient DB errors
    const saveWithRetry = async (fn: () => Promise<void>, label: string, retries = 2) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          await fn();
          return;
        } catch (e: any) {
          if (attempt < retries && e.message?.includes('Failed query')) {
            console.warn(`[GraphQL Sync] ${label} attempt ${attempt + 1} failed, retrying in 3s...`);
            await new Promise(r => setTimeout(r, 3000));
          } else {
            throw e;
          }
        }
      }
    };
    await saveWithRetry(() => saveAllData(stockData, orderData, poData, salesData), 'saveAllData');
    await saveWithRetry(() => saveFinancialData(payableData, receivableData), 'saveFinancialData').catch(e => console.error("[GraphQL Sync] Financial save error:", e.message));

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
 * Fetch bank account balances from the accounting ledger (balancete contábil)
 * Reads contasContabeis (1.01.01.02.*) and sums lancamentosContabeis
 * SOMENTE LEITURA - no mutations
 */
export async function syncBankBalances(): Promise<{ accounts: number; totalSaldo: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Step 1: Fetch all bank accounts from contasContabeis (1.01.01.02.*)
  const contasData = await gql(`{
    contasContabeis(skip: 0, take: 50, where: { codigoEstruturado: { startsWith: "1.01.01.02." } }) {
      totalCount
      items {
        id
        codigo
        codigoEstruturado
        descricao
        ativo
        analiticaOuSintetica
      }
    }
  }`);

  if (!contasData?.contasContabeis?.items) {
    throw new Error("Não foi possível buscar contas contábeis");
  }

  const contasAnaliticas = contasData.contasContabeis.items.filter(
    (c: any) => c.analiticaOuSintetica === 'ANALITICA'
  );

  console.log(`[Bank Balances] Found ${contasAnaliticas.length} analytic bank accounts`);

  // Step 2: For each account, fetch ALL lancamentos and calculate balance
  let totalSaldo = 0;
  const results: Array<{
    contaContabilId: number;
    codigoEstruturado: string;
    descricao: string;
    debitos: number;
    creditos: number;
    saldo: number;
  }> = [];

  for (const conta of contasAnaliticas) {
    // Fetch all lancamentos for this account
    const lancamentos = await fetchAllPages('lancamentosContabeis', (skip, take) => `{
      lancamentosContabeis(
        skip: ${skip}, take: ${take},
        where: { contaContabilId: { eq: ${conta.id} } }
      ) {
        totalCount
        items { valor debitoOuCredito }
      }
    }`);

    let debitos = 0;
    let creditos = 0;
    for (const l of lancamentos as any[]) {
      const val = parseFloat(l.valor) || 0;
      if (l.debitoOuCredito === 'DEBITO') debitos += val;
      else creditos += val;
    }

    // For Ativo accounts: saldo = debitos - creditos
    const saldo = debitos - creditos;
    totalSaldo += saldo;

    results.push({
      contaContabilId: conta.id,
      codigoEstruturado: conta.codigoEstruturado,
      descricao: conta.descricao,
      debitos,
      creditos,
      saldo,
    });

    console.log(`[Bank Balances] ${conta.codigoEstruturado} ${conta.descricao}: D=${debitos.toFixed(2)} C=${creditos.toFixed(2)} Saldo=${saldo.toFixed(2)}`);
  }

  // Step 3: Update bank_accounts with saldo contábil
  // Match by bank name (descricao from contasContabeis vs bancoNome+empresaNome in bank_accounts)
  const existingAccounts = await db.select().from(bankAccounts);

  for (const result of results) {
    // Try to find matching bank account by contaContabilId first, then by name
    let matchingAccount = existingAccounts.find(a => a.contaContabilId === result.contaContabilId);

    if (!matchingAccount) {
      // Try matching by name (e.g., "BB Mesa" matches "BB" bank + "MESA INDUSTRIA" company)
      const descLower = result.descricao.toLowerCase();
      matchingAccount = existingAccounts.find(a => {
        const bankLower = (a.bancoNome || '').toLowerCase();
        const empresaLower = (a.empresaNome || '').toLowerCase();
        const combined = `${bankLower} ${empresaLower}`.toLowerCase();
        // Match patterns like "BB Mesa" -> banco "BANCO DO BRASIL" + empresa "MESA INDUSTRIA"
        // or "Sicoob Palitos" -> banco "SICOOB" + empresa "PALITOS INDUSTRIA"
        const descParts = descLower.split(' ');
        if (descParts.length >= 2) {
          const bankPart = descParts[0];
          const companyPart = descParts.slice(1).join(' ');
          return (
            (bankLower.includes(bankPart) || bankPart.includes(bankLower.substring(0, 3))) &&
            empresaLower.includes(companyPart)
          );
        }
        return combined.includes(descLower) || descLower.includes(combined);
      });
    }

    if (matchingAccount) {
      await db.update(bankAccounts)
        .set({
          contaContabilId: result.contaContabilId,
          codigoEstruturado: result.codigoEstruturado,
          saldoContabil: String(result.saldo.toFixed(2)),
          totalDebitos: String(result.debitos.toFixed(2)),
          totalCreditos: String(result.creditos.toFixed(2)),
          saldoContabilAtualizadoEm: new Date(),
        })
        .where(eq(bankAccounts.id, matchingAccount.id));
    } else {
      // Create a new bank account entry for unmatched accounting accounts
      await db.insert(bankAccounts).values({
        maxiprodId: result.contaContabilId, // Use contaContabilId as maxiprodId
        bancoNome: result.descricao,
        contaContabilId: result.contaContabilId,
        codigoEstruturado: result.codigoEstruturado,
        saldoContabil: String(result.saldo.toFixed(2)),
        totalDebitos: String(result.debitos.toFixed(2)),
        totalCreditos: String(result.creditos.toFixed(2)),
        saldoContabilAtualizadoEm: new Date(),
        ativo: true,
      }).onDuplicateKeyUpdate({
        set: {
          bancoNome: result.descricao,
          contaContabilId: result.contaContabilId,
          codigoEstruturado: result.codigoEstruturado,
          saldoContabil: String(result.saldo.toFixed(2)),
          totalDebitos: String(result.debitos.toFixed(2)),
          totalCreditos: String(result.creditos.toFixed(2)),
          saldoContabilAtualizadoEm: new Date(),
        },
      });
    }
  }

  console.log(`[Bank Balances] Updated ${results.length} accounts, total saldo: R$ ${totalSaldo.toFixed(2)}`);
  return { accounts: results.length, totalSaldo };
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

/**
 * Filter out previsões from paid accounts.
 * A previsão is identified as: tipo=DESPESA, no fornecedor, no document.
 * These are forecasts/provisions that will be replaced by real payments.
 */
function filterOutPrevisoes<T extends { tipo?: string; fornecedor?: { apelido?: string | null; razaoSocial?: string | null } | null; documentoVinculadoNumero?: string | null; notaFiscalId?: number | null; valorPagoLiquido?: number }>(items: T[]): { realItems: T[]; excludedCount: number; excludedTotal: number } {
  const realItems: T[] = [];
  let excludedCount = 0;
  let excludedTotal = 0;

  for (const item of items) {
    const forn = (item.fornecedor?.apelido || item.fornecedor?.razaoSocial || '').trim();
    const hasDoc = !!item.documentoVinculadoNumero || !!item.notaFiscalId;
    const isPrevisao = item.tipo === 'DESPESA' && forn === '' && !hasDoc;

    if (isPrevisao) {
      excludedCount++;
      excludedTotal += item.valorPagoLiquido || 0;
    } else {
      realItems.push(item);
    }
  }

  return { realItems, excludedCount, excludedTotal };
}

/**
 * Fetch total of paid accounts (contas a pagar PAGO) from Maxiprod GraphQL API
 * for a given period using liquidacaoData.
 * 
 * Strategy:
 * 1. First tries to fetch from Maxiprod API (real-time data)
 * 2. If API returns data, saves/updates local snapshot for the month
 * 3. If API returns 0 for a full month, checks local snapshot (Maxiprod purges data after ~2 months)
 * 4. Returns isFromCache flag to indicate data source
 * 
 * SOMENTE LEITURA
 */
export async function fetchPaidAccountsTotal(startDate: string, endDate: string): Promise<{
  total: number;
  count: number;
  isFromCache: boolean;
  isComplete: boolean;
  excludedCount?: number;
  excludedTotal?: number;
}> {
  try {
    // Format dates for GraphQL (ISO with timezone)
    const startISO = `${startDate}T00:00:00.000-03:00`;
    const endISO = `${endDate}T23:59:59.999-03:00`;

    let allItems: { valorPagoLiquido: number; tipo: string; fornecedor: { apelido: string | null; razaoSocial: string | null } | null; documentoVinculadoNumero: string | null; notaFiscalId: number | null }[] = [];
    let skip = 0;
    const take = 200;
    let totalCount = 0;

    while (true) {
      const data = await gql<any>(`{
        contaAPagar(
          skip: ${skip}, take: ${take},
          where: {
            estado: { eq: PAGO },
            liquidacaoData: {
              gte: "${startISO}",
              lte: "${endISO}"
            }
          }
        ) {
          totalCount
          items {
            valorPagoLiquido
            tipo
            fornecedor { apelido razaoSocial }
            documentoVinculadoNumero
            notaFiscalId
          }
        }
      }`);

      if (!data?.contaAPagar) break;
      totalCount = data.contaAPagar.totalCount;
      allItems.push(...data.contaAPagar.items);
      skip += take;
      if (skip >= totalCount) break;
    }

    // Filter out previsões: DESPESA without fornecedor AND without document
    const { realItems, excludedCount, excludedTotal } = filterOutPrevisoes(allItems);

    const total = realItems.reduce((sum, item) => sum + (item.valorPagoLiquido || 0), 0);
    const apiResult = {
      total: Math.round(total * 100) / 100,
      count: realItems.length,
      excludedCount,
      excludedTotal: Math.round(excludedTotal * 100) / 100,
    };
    if (excludedCount > 0) {
      console.log(`[PaidAccounts] Excluídas ${excludedCount} previsões (R$ ${excludedTotal.toFixed(2)}) de ${totalCount} contas`);
    }

    // Determine the year-month for caching
    const startParts = startDate.split('-').map(Number);
    const endParts = endDate.split('-').map(Number);
    const isFullMonth = startParts[2] === 1 && (
      endParts[2] >= 28 || // last day of month
      (endParts[1] === startParts[1] && endParts[0] === startParts[0])
    );
    const yearMonth = `${startParts[0]}-${String(startParts[1]).padStart(2, '0')}`;

    // Check if this is a "current" period (has substantial data from API)
    const today = new Date();
    const todayYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentOrRecent = yearMonth >= todayYM || 
      (startParts[0] === today.getFullYear() && startParts[1] >= today.getMonth()); // current or previous month

    const db = await getDb();
    if (!db) {
      return { ...apiResult, isFromCache: false, isComplete: true, excludedCount: apiResult.excludedCount, excludedTotal: apiResult.excludedTotal };
    }

    // If API returned good data (count > 0), save to local cache
    if (apiResult.count > 0 && isFullMonth && startParts[1] === endParts[1]) {
      try {
        // Determine if data seems complete (heuristic: >100 accounts for a full month is likely complete)
        const isComplete = apiResult.count > 100 || isCurrentOrRecent;
        
        await db.insert(paidAccountsMonthly).values({
          yearMonth,
          totalPago: String(apiResult.total),
          count: apiResult.count,
          source: 'liquidacaoData',
          isComplete,
        }).onDuplicateKeyUpdate({
          set: {
            totalPago: sql`VALUES(totalPago)`,
            count: sql`VALUES(count)`,
            isComplete: sql`VALUES(isComplete)`,
          },
        });
        console.log(`[PaidAccounts] Cached ${yearMonth}: R$ ${apiResult.total} (${apiResult.count} contas, complete=${isComplete})`);
      } catch (cacheErr: any) {
        console.error(`[PaidAccounts] Cache save error:`, cacheErr.message);
      }
    }

    // If API returned 0 for a full past month, check local cache
    if (apiResult.count === 0 && isFullMonth && !isCurrentOrRecent) {
      try {
        const cached = await db.select().from(paidAccountsMonthly)
          .where(eq(paidAccountsMonthly.yearMonth, yearMonth))
          .limit(1);
        
        if (cached.length > 0) {
          console.log(`[PaidAccounts] Using cached data for ${yearMonth}: R$ ${cached[0].totalPago} (${cached[0].count} contas)`);
          return {
            total: Number(cached[0].totalPago),
            count: cached[0].count,
            isFromCache: true,
            isComplete: cached[0].isComplete,
            excludedCount: 0,
            excludedTotal: 0,
          };
        }
      } catch (cacheErr: any) {
        console.error(`[PaidAccounts] Cache read error:`, cacheErr.message);
      }
    }

    // For partial months with low data, also check cache
    if (apiResult.count > 0 && apiResult.count < 100 && isFullMonth && !isCurrentOrRecent) {
      try {
        const cached = await db.select().from(paidAccountsMonthly)
          .where(eq(paidAccountsMonthly.yearMonth, yearMonth))
          .limit(1);
        
        if (cached.length > 0 && Number(cached[0].totalPago) > apiResult.total) {
          console.log(`[PaidAccounts] Using cached data for ${yearMonth} (API partial): R$ ${cached[0].totalPago} vs API R$ ${apiResult.total}`);
          return {
            total: Number(cached[0].totalPago),
            count: cached[0].count,
            isFromCache: true,
            isComplete: cached[0].isComplete,
            excludedCount: 0,
            excludedTotal: 0,
          };
        }
      } catch (cacheErr: any) {
        console.error(`[PaidAccounts] Cache read error:`, cacheErr.message);
      }
    }

    return {
      ...apiResult,
      isFromCache: false,
      isComplete: apiResult.count > 100 || isCurrentOrRecent,
      excludedCount: apiResult.excludedCount ?? 0,
      excludedTotal: apiResult.excludedTotal ?? 0,
    };
  } catch (error: any) {
    console.error("[fetchPaidAccountsTotal] Error:", error.message);
    return { total: 0, count: 0, isFromCache: false, isComplete: false, excludedCount: 0, excludedTotal: 0 };
  }
}

/**
 * Sync paid accounts snapshots for current and previous months.
 * Called during periodic sync to ensure we capture data before Maxiprod purges it.
 * SOMENTE LEITURA
 */
export async function syncPaidAccountsSnapshots(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // Sync current month and previous 2 months
  const monthsToSync = [];
  for (let i = 0; i < 3; i++) {
    let y = currentYear;
    let m = currentMonth - i;
    if (m <= 0) { m += 12; y -= 1; }
    monthsToSync.push({ year: y, month: m });
  }

  for (const { year, month } of monthsToSync) {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${ym}-01`;
    const endDate = `${ym}-${String(lastDay).padStart(2, '0')}`;

    try {
      const startISO = `${startDate}T00:00:00.000-03:00`;
      const endISO = `${endDate}T23:59:59.999-03:00`;

      let allItems: { valorPagoLiquido: number }[] = [];
      let skip = 0;
      const take = 200;
      let totalCount = 0;

      while (true) {
        const data = await gql<any>(`{
          contaAPagar(
            skip: ${skip}, take: ${take},
            where: {
              estado: { eq: PAGO },
              liquidacaoData: {
                gte: "${startISO}",
                lte: "${endISO}"
              }
            }
          ) {
            totalCount
            items { valorPagoLiquido }
          }
        }`);

        if (!data?.contaAPagar) break;
        totalCount = data.contaAPagar.totalCount;
        allItems.push(...data.contaAPagar.items);
        skip += take;
        if (skip >= totalCount) break;
      }

      if (totalCount === 0) {
        console.log(`[PaidAccounts Sync] ${ym}: No data from API (possibly purged)`);
        continue;
      }

      const total = allItems.reduce((sum, item) => sum + (item.valorPagoLiquido || 0), 0);
      const roundedTotal = Math.round(total * 100) / 100;
      const isComplete = totalCount > 100;

      await db.insert(paidAccountsMonthly).values({
        yearMonth: ym,
        totalPago: String(roundedTotal),
        count: totalCount,
        source: 'liquidacaoData',
        isComplete,
      }).onDuplicateKeyUpdate({
        set: {
          totalPago: sql`VALUES(totalPago)`,
          count: sql`VALUES(count)`,
          isComplete: sql`VALUES(isComplete)`,
        },
      });

      console.log(`[PaidAccounts Sync] ${ym}: R$ ${roundedTotal} (${totalCount} contas, complete=${isComplete})`);
    } catch (err: any) {
      console.error(`[PaidAccounts Sync] Error for ${ym}:`, err.message);
    }
  }
}

/**
 * Fetch detailed paid accounts for a period.
 * Returns individual items with fornecedor, descricao, valor, and dates.
 * Uses the gql helper for proper auth and retry.
 * SOMENTE LEITURA
 */
export async function fetchPaidAccountsDetails(startDate: string, endDate: string): Promise<{
  descricao: string;
  fornecedor: string;
  valorPagoLiquido: number;
  liquidacaoData: string;
  vencimentoData: string;
}[]> {
  try {
    const startISO = `${startDate}T00:00:00.000-03:00`;
    const endISO = `${endDate}T23:59:59.999-03:00`;

    let allItems: { descricao: string; fornecedor: string; valorPagoLiquido: number; liquidacaoData: string; vencimentoData: string }[] = [];
    let skip = 0;
    const take = 200;
    let totalCount = 0;

    while (true) {
      const data = await gql<any>(`{
        contaAPagar(
          skip: ${skip}, take: ${take},
          where: {
            estado: { eq: PAGO },
            liquidacaoData: {
              gte: "${startISO}",
              lte: "${endISO}"
            }
          },
          order: { valorPagoLiquido: DESC }
        ) {
          totalCount
          items {
            tipo
            referenteA
            observacoes
            documentoVinculadoNumero
            notaFiscalId
            fornecedor { nomeFantasia razaoSocial apelido }
            valorPagoLiquido
            valorOriginal
            liquidacaoData
            vencimentoData
            parcela
            parcelasQuantidadeTotal
          }
        }
      }`);

      if (!data?.contaAPagar) break;
      totalCount = data.contaAPagar.totalCount;

      for (const item of data.contaAPagar.items) {
        // Filter out previsões: DESPESA without fornecedor AND without document
        const forn = (item.fornecedor?.apelido || item.fornecedor?.razaoSocial || '').trim();
        const hasDoc = !!item.documentoVinculadoNumero || !!item.notaFiscalId;
        const isPrevisao = item.tipo === 'DESPESA' && forn === '' && !hasDoc;
        if (isPrevisao) continue;

        // Build description from available fields
        const parts: string[] = [];
        if (item.referenteA) parts.push(item.referenteA);
        if (item.documentoVinculadoNumero) parts.push(`Doc: ${item.documentoVinculadoNumero}`);
        if (item.parcela && item.parcelasQuantidadeTotal) {
          parts.push(`Parcela ${item.parcela}/${item.parcelasQuantidadeTotal}`);
        }
        if (parts.length === 0 && item.observacoes) parts.push(item.observacoes);
        
        allItems.push({
          descricao: parts.join(' | ') || '-',
          fornecedor: item.fornecedor?.nomeFantasia || item.fornecedor?.razaoSocial || '-',
          valorPagoLiquido: item.valorPagoLiquido || 0,
          liquidacaoData: item.liquidacaoData?.slice(0, 10) || '-',
          vencimentoData: item.vencimentoData?.slice(0, 10) || '-',
        });
      }

      skip += take;
      if (skip >= totalCount) break;
    }

    return allItems
      .sort((a, b) => b.valorPagoLiquido - a.valorPagoLiquido)
      .map(e => ({ ...e, valorPagoLiquido: Math.round(e.valorPagoLiquido * 100) / 100 }));
  } catch (error: any) {
    console.error("[fetchPaidAccountsDetails] Error:", error.message);
    return [];
  }
}

/**
 * Fetch total received accounts (Recebimentos) for a period.
 * Queries contaAReceber with estado=RECEBIDO and liquidacaoData in the period.
 * Uses valorRecebidoLiquido as the received amount (valor líquido conforme Maxiprod).
 * SOMENTE LEITURA
 */
// Keywords to identify real client payments in OFX data
const OFX_INFLOW_KEYWORDS = [
  'COBRAN', 'BOLETO',                                      // Cobrança/Boleto
  'PIX RECEBIDO', 'RECEBIMENTO PIX', 'PIX - RECEBIDO', 'PIX_CRED', // PIX received
  'RECEBIMENTO TED', 'TED-STR',                            // TED received
  'DEP DISPONIVEL',                                        // Depósito em agência
];

// Keywords to EXCLUDE (inter-company transfers, loans, etc.)
const OFX_EXCLUDE_KEYWORDS = [
  'PALITOS FOX', 'PALITOS IND', 'MESA INDUST', 'BAMBUSA', 'ESPETOS IND', 'VARETAS',
  'MESMA TIT',                                              // Same-owner transfers
];

function isRealClientInflow(descricao: string, valor: number): boolean {
  if (valor <= 0) return false;
  const desc = (descricao || '').toUpperCase();
  // Exclude inter-company transfers
  if (OFX_EXCLUDE_KEYWORDS.some(kw => desc.includes(kw))) return false;
  // Include if matches inflow keywords
  return OFX_INFLOW_KEYWORDS.some(kw => desc.includes(kw));
}

// Keywords to identify internal transfers and inter-account movements (not real new money)
const OFX_INTERNAL_KEYWORDS = [
  // Group companies
  'PALITOS FOX', 'PALITOS IND', 'PALITOS INDUSTRIA',
  'MESA INDUST', 'MESA INDUSTRIA',
  'ESPETOS IND', 'ESPETOS INDUSTRIA',
  'VARETAS', 'BAMBUSA',
  // Same-owner transfers
  'MESMA TIT', 'OUTRA IF - MESMA',
  // Inter-account transfers (same company, different accounts)
  'INTERCREDIS', 'TRANSF.CONTAS',
  // PIX between group companies (identified by CNPJ)
  '36562762000129', // Palitos CNPJ
  '45558059000138', // Varetas CNPJ
  '50128808000127', // Espetos CNPJ
  '52888511000195', // Mesa CNPJ
];

/** Check if an OFX entry is an internal transfer (between group companies or own accounts) */
function isInternalTransfer(descricao: string): boolean {
  const desc = (descricao || '').toUpperCase();
  return OFX_INTERNAL_KEYWORDS.some(kw => desc.includes(kw));
}

/**
 * Contas do plano de contas que representam receita de vendas/revenda.
 * Usadas para classificar entradas como "Vendas/Revenda" vs "Demais Receitas".
 * 
 * Para adicionar novas contas de venda, basta incluir o codigoEstruturado aqui.
 */
const SALES_REVENUE_ACCOUNTS = new Set([
  '3.01.01.01', // Receita da venda de produtos de fabricação própria MADEIRA
  '3.01.01.02', // Receita da revenda de mercadorias BAMBU
  '3.01.01.03', // Receita de revenda mercadoria FIBRA
  '3.01.01.04', // Receita da venda de produtos de fabricação propria SERRAGEM
  '3.01.01.05', // Receita da venda de produtos de fabricação propria ROJÃO
]);

/**
 * Contas bancárias do Ativo que representam transferências entre contas.
 * Entradas classificadas com essas contas devem ser EXCLUÍDAS do total de entradas.
 * 
 * Para adicionar novas contas bancárias (ex: novo banco), basta incluir o codigoEstruturado aqui.
 */
const BANK_TRANSFER_ACCOUNTS = new Set([
  '1.01.01.02.01', // BB Mesa
  '1.01.01.02.02', // CEF Palitos
  '1.01.01.02.03', // CEF Varetas
  '1.01.01.02.04', // CEF Espetos
  '1.01.01.02.05', // Bradesco Espetos
  '1.01.01.02.06', // Bradesco Palitos
  '1.01.01.02.07', // Bradesco Varetas
  '1.01.01.02.08', // Sicoob Espetos
  '1.01.01.02.09', // Sicoob Varetas
  '1.01.01.02.10', // Sicoob Palitos
  '1.01.01.02.11', // Sicoob Mesa
  '1.01.01.02.13', // Sicredi Palitos
  '1.01.01.02.14', // Sicredi Espetos
  '1.01.01.02.15', // Sicredi Varetas
  '1.01.01.02.16', // Sicredi Mesa
]);

/**
 * Classifica uma entrada pelo codigoEstruturado da conta contábil.
 * - Contas 3.01.01.01 a 3.01.01.05 = vendas/revenda
 * - Contas 1.01.01.02.* = transferências bancárias (excluir)
 * - Demais = outras receitas
 */
function classifyByAccountCode(contaCodigo?: string): 'vendas' | 'outras' | 'transferencia' {
  if (!contaCodigo) return 'outras';
  if (SALES_REVENUE_ACCOUNTS.has(contaCodigo)) return 'vendas';
  if (BANK_TRANSFER_ACCOUNTS.has(contaCodigo) || contaCodigo.startsWith('1.01.01.02')) return 'transferencia';
  return 'outras';
}

/** Conta "Clientes" — contrapartida de recebimentos de NFs de venda */
const CLIENTS_ACCOUNT = '1.01.02.01.01';

/**
 * Classifica uma entrada pelo codigoEstruturado da conta CREDITO (contrapartida).
 * - Clientes (1.01.02.01.01) ou contas 3.01.01.01-05 = vendas/revenda
 * - Contas 1.01.01.02.* = transferências bancárias (excluir)
 * - Demais = outras receitas
 */
function classifyCounterpart(contaCodigo?: string): 'vendas' | 'outras' | 'transferencia' {
  if (!contaCodigo) return 'outras';
  if (contaCodigo === CLIENTS_ACCOUNT) return 'vendas';
  if (SALES_REVENUE_ACCOUNTS.has(contaCodigo)) return 'vendas';
  if (BANK_TRANSFER_ACCOUNTS.has(contaCodigo) || contaCodigo.startsWith('1.01.01.02')) return 'transferencia';
  return 'outras';
}

type LancEntry = { id: number; valor: number; debitoOuCredito: string; data: string; contaContabil: { codigoEstruturado: string; descricao: string } };

/**
 * Busca TODOS os lancamentosContabeis no período e retorna um Map por ID.
 * Usado internamente para cruzar DEBITO bancário com CREDITO contrapartida.
 */
async function fetchAllLancamentos(startISO: string, endISO: string): Promise<Map<number, LancEntry>> {
  const map = new Map<number, LancEntry>();
  let skip = 0;
  const take = 200;
  while (true) {
    const data = await gql<any>(`{
      lancamentosContabeis(
        skip: ${skip}, take: ${take},
        where: { data: { gte: "${startISO}", lte: "${endISO}" } },
        order: { id: ASC }
      ) { totalCount items { id valor debitoOuCredito data contaContabil { codigoEstruturado descricao } } }
    }`);
    if (!data?.lancamentosContabeis) break;
    for (const item of data.lancamentosContabeis.items) map.set(item.id, item);
    skip += take;
    if (skip >= data.lancamentosContabeis.totalCount) break;
  }
  return map;
}

type ClassifiedEntry = {
  valor: number;
  data: string;
  bankAccount: string;
  counterpartCode: string;
  counterpartDesc: string;
  classificacao: 'vendas' | 'outras';
};

/**
 * Processa lancamentosContabeis para extrair Entradas do caixa/banco.
 * Para cada DEBITO em conta bancária, busca a contrapartida CREDITO (ID+1..ID+20)
 * e classifica pela conta da contrapartida.
 * Exclui transferências entre contas bancárias.
 * Fonte: Financeiro > Extrato detalhado por Receita e Despesa
 * SOMENTE LEITURA
 */
async function processEntradas(startDate: string, endDate: string): Promise<{
  entries: ClassifiedEntry[];
  vendasRevenda: number;
  vendasRevendaCount: number;
  demaisReceitas: number;
  demaisReceitasCount: number;
  total: number;
  count: number;
}> {
  const startISO = `${startDate}T00:00:00.000-03:00`;
  const endISO = `${endDate}T23:59:59.999-03:00`;

  const allEntries = await fetchAllLancamentos(startISO, endISO);

  // Identify bank DEBITO entries
  const bankDebits: LancEntry[] = [];
  const bankDebitIds = new Set<number>();
  for (const e of Array.from(allEntries.values())) {
    if (e.debitoOuCredito === 'DEBITO' && e.contaContabil.codigoEstruturado.startsWith('1.01.01.02')) {
      bankDebits.push(e);
      bankDebitIds.add(e.id);
    }
  }

  let vendasRevenda = 0, vendasRevendaCount = 0;
  let demaisReceitas = 0, demaisReceitasCount = 0;
  const entries: ClassifiedEntry[] = [];

  for (const d of bankDebits) {
    // Find the FIRST CREDITO counterpart in sequential IDs to determine classification
    let firstCpCode: string | undefined;
    let firstCpDesc: string | undefined;
    let isTransfer = false;

    for (let offset = 1; offset <= 50; offset++) {
      const cp = allEntries.get(d.id + offset);
      if (!cp) continue;
      if (cp.debitoOuCredito !== 'CREDITO') {
        if (bankDebitIds.has(d.id + offset)) break;
        continue;
      }

      const cls = classifyCounterpart(cp.contaContabil.codigoEstruturado);
      if (cls === 'transferencia') {
        isTransfer = true;
        break; // bank-to-bank transfer, skip entire entry
      }

      // Use first non-transfer CREDITO as the classification
      firstCpCode = cp.contaContabil.codigoEstruturado;
      firstCpDesc = cp.contaContabil.descricao;
      break;
    }

    if (isTransfer) continue;

    // Use the DEBITO value (bank entry amount), classified by the counterpart
    const cls = classifyCounterpart(firstCpCode);
    const entry: ClassifiedEntry = {
      valor: Math.round(d.valor * 100) / 100,
      data: d.data?.slice(0, 10) || '-',
      bankAccount: d.contaContabil.descricao,
      counterpartCode: firstCpCode || '-',
      counterpartDesc: firstCpDesc || '-',
      classificacao: cls === 'vendas' ? 'vendas' : 'outras',
    };
    entries.push(entry);

    if (cls === 'vendas') {
      vendasRevenda += d.valor;
      vendasRevendaCount++;
    } else {
      demaisReceitas += d.valor;
      demaisReceitasCount++;
    }
  }

  const total = vendasRevenda + demaisReceitas;
  console.log(`[Entradas] ${startDate} a ${endDate}: Total R$ ${total.toFixed(2)} (Vendas R$ ${vendasRevenda.toFixed(2)}, Outras R$ ${demaisReceitas.toFixed(2)}) - ${entries.length} de ${bankDebits.length} lançamentos`);

  return {
    entries,
    vendasRevenda: Math.round(vendasRevenda * 100) / 100,
    vendasRevendaCount,
    demaisReceitas: Math.round(demaisReceitas * 100) / 100,
    demaisReceitasCount,
    total: Math.round(total * 100) / 100,
    count: entries.length,
  };
}

/**
 * Fetch total de Entradas via lancamentosContabeis.
 * Fonte: Financeiro > Extrato detalhado por Receita e Despesa
 * SOMENTE LEITURA
 */
export async function fetchReceivedAccountsTotal(startDate: string, endDate: string): Promise<{
  total: number;
  count: number;
  vendasRevenda: number;
  vendasRevendaCount: number;
  demaisReceitas: number;
  demaisReceitasCount: number;
}> {
  try {
    const result = await processEntradas(startDate, endDate);
    return {
      total: result.total,
      count: result.count,
      vendasRevenda: result.vendasRevenda,
      vendasRevendaCount: result.vendasRevendaCount,
      demaisReceitas: result.demaisReceitas,
      demaisReceitasCount: result.demaisReceitasCount,
    };
  } catch (error: any) {
    console.error("[fetchReceivedAccountsTotal] Error:", error.message);
    return { total: 0, count: 0, vendasRevenda: 0, vendasRevendaCount: 0, demaisReceitas: 0, demaisReceitasCount: 0 };
  }
}

/**
 * Fetch detailed Entradas via lancamentosContabeis.
 * SOMENTE LEITURA
 */
export async function fetchReceivedAccountsDetails(startDate: string, endDate: string): Promise<{
  descricao: string;
  valor: number;
  data: string;
  tipo: string;
  classificacao: 'vendas' | 'outras';
  contaCodigo: string;
  contaDescricao: string;
}[]> {
  try {
    const result = await processEntradas(startDate, endDate);
    return result.entries
      .sort((a, b) => b.valor - a.valor)
      .map(e => ({
        descricao: e.counterpartDesc,
        valor: e.valor,
        data: e.data,
        tipo: e.bankAccount,
        classificacao: e.classificacao,
        contaCodigo: e.counterpartCode,
        contaDescricao: e.counterpartDesc,
      }));
  } catch (error: any) {
    console.error("[fetchReceivedAccountsDetails] Error:", error.message);
    return [];
  }
}

/**
 * Fetch "Outras Entradas" — demais receitas (não-vendas).
 * SOMENTE LEITURA
 */
export async function fetchOtherInflowsTotal(startDate: string, endDate: string): Promise<{
  total: number;
  count: number;
}> {
  try {
    const data = await fetchReceivedAccountsTotal(startDate, endDate);
    return { total: data.demaisReceitas, count: data.demaisReceitasCount };
  } catch (error: any) {
    console.error("[fetchOtherInflowsTotal] Error:", error.message);
    return { total: 0, count: 0 };
  }
}

/**
 * Fetch detailed "Outras Entradas".
 * SOMENTE LEITURA
 */
export async function fetchOtherInflowsDetails(startDate: string, endDate: string): Promise<{
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
  contaCodigo: string;
}[]> {
  try {
    const allDetails = await fetchReceivedAccountsDetails(startDate, endDate);
    return allDetails
      .filter(item => item.classificacao === 'outras')
      .map(item => ({
        descricao: item.descricao,
        valor: item.valor,
        data: item.data,
        categoria: item.contaDescricao,
        contaCodigo: item.contaCodigo,
      }));
  } catch (error: any) {
    console.error("[fetchOtherInflowsDetails] Error:", error.message);
    return [];
  }
}

/**
 * Fetch monthly Entradas breakdown for stacked bar chart.
 * SOMENTE LEITURA
 */
export async function fetchMonthlyOFXInflows(months: { startDate: string; endDate: string; label: string }[]): Promise<{
  months: {
    label: string;
    recebimentos: number;
    outrasEntradas: number;
    total: number;
    recebimentosCount: number;
    outrasEntradasCount: number;
  }[];
}> {
  try {
    const results = [];
    for (const month of months) {
      const data = await fetchReceivedAccountsTotal(month.startDate, month.endDate);
      results.push({
        label: month.label,
        recebimentos: data.vendasRevenda,
        outrasEntradas: data.demaisReceitas,
        total: data.total,
        recebimentosCount: data.vendasRevendaCount,
        outrasEntradasCount: data.demaisReceitasCount,
      });
    }
    return { months: results };
  } catch (error: any) {
    console.error("[fetchMonthlyOFXInflows] Error:", error.message);
    return { months: [] };
  }
}

