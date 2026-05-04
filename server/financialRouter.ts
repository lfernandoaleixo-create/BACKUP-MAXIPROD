/**
 * Financial Router - Contas a Pagar e Receber
 * SOMENTE LEITURA - dados do Maxiprod
 */
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { accountsPayable, accountsReceivable, bankAccounts, bankTransactions, salesOrders, dailyReconciliation, paymentAuthorizations, collectionActions, authCompletion, collectionDailyActions, receivableProtestConfig, collectionDocuments, financialChanges, resolvedReceivables, collectionActionEdits, collectionManualTicks, collectionManualTickHistory, collectionStepOverrides, spreadsheetUploads, decisionPdfHistory, paymentPriorityMarks } from "../drizzle/schema";
import { saveFinancialSnapshot, detectFinancialChanges, getFinancialChanges, getSnapshotDates } from "./financialHistory";
import { eq, and, gte, lte, sql, desc, asc, ne, inArray, isNotNull } from "drizzle-orm";
import { storagePut, storageGet } from "./storage";
import { ENV } from "./_core/env";
import { generateCollectionPdf } from "./generateCollectionPdf";
import { fetchPaidAccountsTotal, fetchPaidAccountsDetails, fetchReceivedAccountsTotal, fetchReceivedAccountsDetails, fetchOtherInflowsTotal, fetchOtherInflowsDetails, fetchMonthlyOFXInflows, fetchInvoicesTotal, fetchInvoicesDetails, fetchBankBalancesWithInitial, gql } from "./maxiprodGraphQL";
import { checkAndResetIfNeeded } from "./paymentAuthReset";

// Cache em memória para contraprova Maxiprod (TTL 5 minutos)
const CONTRAPROVA_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const contraprovaCache = new Map<string, { data: any; timestamp: number }>();

/**
 * Tipos válidos de contas a receber (conforme filtro do Maxiprod):
 * TITULO, RECEITA, ADIANTAMENTO — exclui TITULO_PEDIDO_DE_VENDA e TITULO_PROPOSTA_DE_VENDA
 */
const RECEIVABLE_VALID_TYPES = ["TITULO", "RECEITA", "ADIANTAMENTO"];

/**
 * Fórmula "Valor a Receber" (conforme Maxiprod):
 * valorAReceber = valorLiquido - valorRecebidoLiquido
 * Isso desconta pagamentos parciais já realizados.
 * Usamos essa expressão em todas as queries de contas a receber.
 */

/**
 * === VENDEDOR CACHE (from Maxiprod GraphQL) ===
 * Busca pedidosDeVenda direto do Maxiprod para obter representante/vendedor por cliente.
 * Cache de 10 minutos para não sobrecarregar a API.
 *
 * Regras de mapeamento (confirmado com Fernando 17/03/2026):
 * 1. Usar campo representanteOuVendedor1 como vendedor (prioridade)
 * 2. Se não tem representante, usar responsavelUsuario APENAS se for vendedor real
 * 3. BRENDA e LARISSA são editoras, NÃO vendedoras → ignorar como vendedor
 * 4. Clientes Johnson e Keure → vendedor = "Grupo Fox" (manual)
 * 5. Clientes sem vendedor + produto madeira/industrialização → "JORDAO" (fallback)
 * 6. Clientes sem vendedor + produto bambu/revenda → "JUVENAL TEIXEIRA" (fallback)
 * 7. GILSON adicionado como vendedor reconhecido
 */
let vendedorCacheMap: Record<string, string> = {};
let vendedorCacheTimestamp = 0;
const VENDEDOR_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Cache para mapeamento cliente → categoria de produto (madeira vs bambu)
let clienteProductCacheMap: Record<string, 'madeira' | 'bambu' | 'ambos' | 'outro'> = {};
let clienteProductCacheTimestamp = 0;

// Cache para mapeamento cliente → decisão de cobrança (COM PROTESTO / SEM PROTESTO)
let cobrancaDecisionCacheMap: Record<string, string> = {};
let cobrancaDecisionCacheTimestamp = 0;
const COBRANCA_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Editoras que NÃO são vendedoras (apenas editam pedidos no Maxiprod)
const EDITORES_NAO_VENDEDORES = ["BRENDA", "LARISSA"];

// Clientes com vendedor fixo "Grupo Fox" (definido manualmente por Fernando)
const CLIENTES_GRUPO_FOX = ["JOHNSON", "KEURE", "S C JOHNSON", "SC JOHNSON", "S. C. JOHNSON"];

function isClienteGrupoFox(nome: string): boolean {
  const upper = nome.toUpperCase();
  return CLIENTES_GRUPO_FOX.some(prefix => upper.includes(prefix));
}

function isEditorNaoVendedor(nome: string): boolean {
  return EDITORES_NAO_VENDEDORES.includes(nome.toUpperCase().trim());
}

/**
 * Determina a categoria de produto de um item baseado na descrição
 * Madeira: varetas, espetos, palitos industrializados (SG:05), madeira serrada (SG:16 G:18/19), varetas aromatizador (SG:01)
 * Bambu: produtos bambu importados (SG:12 G:20), fibra (SG:12 G:21)
 */
function categorizeProduct(descricao: string, grupoDesc: string): 'madeira' | 'bambu' | null {
  const desc = (descricao || '').toUpperCase();
  const grupo = (grupoDesc || '').toUpperCase();
  
  // Bambu importado para revenda
  if (grupo.includes('BAMBU') || grupo.includes('FIBRA')) return 'bambu';
  
  // Madeira/industrialização
  if (grupo.includes('VARETA') || grupo.includes('ESPETO') || grupo.includes('PALITO') || grupo.includes('MADEIRA')) return 'madeira';
  
  // Fallback por descrição
  if (desc.includes('MADEIRA SERRADA') || desc.includes('MADEIRA DE PINUS')) return 'madeira';
  if (desc.includes('VARETA') && !desc.includes('BAMBU')) return 'madeira';
  if (desc.includes('VARETA AROMATIZADOR')) return 'madeira';
  
  return null;
}

/**
 * Busca a decisão de cobrança (COM PROTESTO / SEM PROTESTO) de cada cliente
 * da aba COBRANÇA do Maxiprod via campo adicional "SITUAÇÃO".
 * Retorna mapa: nome do cliente (razaoSocial/nomeFantasia/apelido) -> decisão
 * Cache de 10 minutos para não sobrecarregar a API.
 */
async function fetchCobrancaDecisionMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now - cobrancaDecisionCacheTimestamp < COBRANCA_CACHE_TTL && Object.keys(cobrancaDecisionCacheMap).length > 0) {
    return cobrancaDecisionCacheMap;
  }

  try {
    const map: Record<string, string> = {};
    const PAGE_SIZE = 200;
    let skip = 0;
    let totalCount = 0;

    do {
      const data = await gql<any>(`{
        empresas(skip: ${skip}, take: ${PAGE_SIZE}, where: { cliente: { eq: true } }) {
          totalCount
          items {
            razaoSocial
            nomeFantasia
            apelido
            campoAdicionalEspecifico {
              descricao
              valor
            }
          }
        }
      }`);

      if (!data?.empresas) break;
      totalCount = data.empresas.totalCount;

      for (const emp of data.empresas.items) {
        const situacao = emp.campoAdicionalEspecifico?.find((c: any) => 
          c.descricao === 'SITUAÇÃO' || c.descricao?.toUpperCase() === 'SITUACAO' || c.descricao?.toUpperCase() === 'SITUAÇÃO'
        );
        if (situacao?.valor) {
          // Map all name variants to the decision (both original and normalized)
          const names = [emp.razaoSocial, emp.nomeFantasia, emp.apelido].filter(Boolean);
          for (const name of names) {
            map[name] = situacao.valor;
            map[name.toUpperCase().trim()] = situacao.valor;
          }
        }
      }

      skip += PAGE_SIZE;
    } while (skip < totalCount);

    cobrancaDecisionCacheMap = map;
    cobrancaDecisionCacheTimestamp = now;
    console.log(`[Cobrança Cache] Refreshed: ${Object.keys(map).length} mappings from ${totalCount} clientes`);
  } catch (err) {
    console.error("[Cobrança Cache] Error fetching from GraphQL:", err);
  }

  return cobrancaDecisionCacheMap;
}

async function fetchVendedorMapFromGraphQL(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now - vendedorCacheTimestamp < VENDEDOR_CACHE_TTL && Object.keys(vendedorCacheMap).length > 0) {
    return vendedorCacheMap;
  }

  const token = ENV.maxiprodGraphqlToken;
  if (!token) return vendedorCacheMap;

  try {
    const map: Record<string, string> = {};
    const productMap: Record<string, { madeira: boolean; bambu: boolean }> = {};
    const PAGE_SIZE = 500;
    let skip = 0;
    let totalCount = 0;

    do {
      const query = `{
        pedidosDeVenda(skip: ${skip}, take: ${PAGE_SIZE}, order: { emissaoData: DESC }) {
          totalCount
          items {
            cliente { nomeFantasia razaoSocial }
            representanteOuVendedor1 { nomeFantasia razaoSocial }
            responsavelUsuario { nome }
            itensDoPedidoDeVenda {
              item { descricao grupoDescricao }
            }
          }
        }
      }`;

      const resp = await fetch("https://api.maxiprod.com.br/graphql/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${token}`,
        },
        body: JSON.stringify({ query }),
      });

      const data = await resp.json();
      if (data.errors) {
        console.error("[Vendedor Cache] GraphQL errors:", data.errors);
        break;
      }

      const result = data.data.pedidosDeVenda;
      totalCount = result.totalCount;

      for (const p of result.items) {
        const nomeFantasia = p.cliente?.nomeFantasia || "";
        const razaoSocial = p.cliente?.razaoSocial || "";
        const clienteKey = nomeFantasia || razaoSocial;
        if (!clienteKey) continue;

        // 1. Prioridade: representanteOuVendedor1 (vendedor real do pedido)
        let vendedor = p.representanteOuVendedor1?.nomeFantasia
          || p.representanteOuVendedor1?.razaoSocial
          || "";

        // 2. Fallback: responsavelUsuario, MAS apenas se for vendedor real (não editor)
        if (!vendedor) {
          const responsavel = p.responsavelUsuario?.nome || "";
          if (responsavel && !isEditorNaoVendedor(responsavel)) {
            vendedor = responsavel;
          }
        }

        if (vendedor) {
          if (nomeFantasia && !map[nomeFantasia]) map[nomeFantasia] = vendedor;
          if (razaoSocial && !map[razaoSocial]) map[razaoSocial] = vendedor;
        }

        // Track product categories for fallback assignment
        if (!productMap[clienteKey]) productMap[clienteKey] = { madeira: false, bambu: false };
        for (const item of (p.itensDoPedidoDeVenda || [])) {
          const cat = categorizeProduct(item?.item?.descricao || '', item?.item?.grupoDescricao || '');
          if (cat === 'madeira') productMap[clienteKey].madeira = true;
          if (cat === 'bambu') productMap[clienteKey].bambu = true;
        }
        // Also track by razaoSocial
        if (razaoSocial && razaoSocial !== clienteKey) {
          if (!productMap[razaoSocial]) productMap[razaoSocial] = { madeira: false, bambu: false };
          productMap[razaoSocial].madeira = productMap[razaoSocial].madeira || productMap[clienteKey].madeira;
          productMap[razaoSocial].bambu = productMap[razaoSocial].bambu || productMap[clienteKey].bambu;
        }
      }

      skip += PAGE_SIZE;
    } while (skip < totalCount);

    // 3. Override manual: clientes Johnson e Keure → "Grupo Fox"
    for (const key of Object.keys(map)) {
      if (isClienteGrupoFox(key)) {
        map[key] = "Grupo Fox";
      }
    }

    // 5. Fallback por produto: clientes SEM vendedor
    // Madeira → JORDAO, Bambu → JUVENAL TEIXEIRA
    for (const [clienteKey, cats] of Object.entries(productMap)) {
      if (!map[clienteKey] && !isClienteGrupoFox(clienteKey)) {
        if (cats.madeira) {
          map[clienteKey] = "JORDAO";
        } else if (cats.bambu) {
          map[clienteKey] = "JUVENAL TEIXEIRA";
        }
      }
    }

    // Update product category cache
    const catMap: Record<string, 'madeira' | 'bambu' | 'ambos' | 'outro'> = {};
    for (const [key, cats] of Object.entries(productMap)) {
      if (cats.madeira && cats.bambu) catMap[key] = 'ambos';
      else if (cats.madeira) catMap[key] = 'madeira';
      else if (cats.bambu) catMap[key] = 'bambu';
      else catMap[key] = 'outro';
    }
    clienteProductCacheMap = catMap;
    clienteProductCacheTimestamp = now;

    vendedorCacheMap = map;
    vendedorCacheTimestamp = now;
    console.log(`[Vendedor Cache] Refreshed: ${Object.keys(map).length} mappings from ${totalCount} pedidos (${Object.keys(productMap).length} product mappings)`);
  } catch (err) {
    console.error("[Vendedor Cache] Error fetching from GraphQL:", err);
  }

  return vendedorCacheMap;
}

/**
 * === TIMEZONE-SAFE DATE HELPERS ===
 * Todas as comparações de data usam strings YYYY-MM-DD para evitar bugs de timezone.
 * O servidor pode rodar em qualquer fuso; sempre usamos Brasília como referência.
 */

/** Retorna a data de hoje em Brasília como string YYYY-MM-DD */
function getTodayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Retorna Date de Brasília (para cálculos de dia da semana, etc) */
function getBrasiliaDate(): Date {
  const s = getTodayBR(); // YYYY-MM-DD
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d); // midnight local, mas só usamos getDay/getDate
}

/** Adiciona N dias a uma string YYYY-MM-DD e retorna YYYY-MM-DD */
function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return dt.toISOString().slice(0, 10);
}

/** Retorna o dia da semana (0=Dom, 6=Sab) para uma string YYYY-MM-DD */
function getDayOfWeekStr(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * Feriados bancários nacionais (Anbima) — 2025, 2026, 2027.
 * Fonte: https://www.anbima.com.br/feriados/fer_nacionais/
 * Atualizar anualmente conforme publicação oficial.
 */
const BANK_HOLIDAYS: Set<string> = new Set([
  // 2025
  "2025-01-01", "2025-03-03", "2025-03-04", "2025-04-18",
  "2025-04-21", "2025-05-01", "2025-06-19", "2025-09-07",
  "2025-10-12", "2025-11-02", "2025-11-15", "2025-11-20", "2025-12-25",
  // 2026
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03",
  "2026-04-21", "2026-05-01", "2026-06-04", "2026-09-07",
  "2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25",
  // 2027
  "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-26",
  "2027-04-21", "2027-05-01", "2027-05-27", "2027-09-07",
  "2027-10-12", "2027-11-02", "2027-11-15", "2027-11-20", "2027-12-25",
]);

/** Verifica se uma data YYYY-MM-DD é dia útil (não é fim de semana nem feriado bancário) */
function isBusinessDay(dateStr: string): boolean {
  const dow = getDayOfWeekStr(dateStr);
  if (dow === 0 || dow === 6) return false; // Domingo ou Sábado
  return !BANK_HOLIDAYS.has(dateStr);
}

/**
 * Retorna o dia útil anterior a hoje (Brasília).
 * REGRA DE CONCILIAÇÃO BANCÁRIA:
 * A conciliação bancária é realizada até o último dia útil antes de hoje.
 * Considera fins de semana E feriados bancários nacionais (Anbima).
 * Ex: hoje é segunda 13/04 → última conciliação foi sexta 10/04 → retorna 10/04.
 * Ex: se sexta 10/04 fosse feriado → última conciliação seria quinta 09/04 → retorna 09/04.
 */
function getPreviousBusinessDay(): string {
  const todayStr = getTodayBR();
  let candidate = addDaysStr(todayStr, -1);
  // Recua até encontrar um dia útil (máx 10 iterações para segurança)
  for (let i = 0; i < 10; i++) {
    if (isBusinessDay(candidate)) return candidate;
    candidate = addDaysStr(candidate, -1);
  }
  return candidate; // fallback
}

/** Ajusta sábado/domingo para segunda-feira seguinte (string-based) */
function adjustWeekendStr(dateStr: string): string {
  const dow = getDayOfWeekStr(dateStr);
  if (dow === 6) return addDaysStr(dateStr, 2); // sábado -> segunda
  if (dow === 0) return addDaysStr(dateStr, 1); // domingo -> segunda
  return dateStr;
}

/** Avança N dias úteis a partir de uma data YYYY-MM-DD (pula sábado, domingo e feriados) */
function addBusinessDaysStr(dateStr: string, businessDays: number): string {
  let current = dateStr;
  let remaining = businessDays;
  while (remaining > 0) {
    current = addDaysStr(current, 1);
    if (isBusinessDay(current)) remaining--;
  }
  return current;
}

/** Retorna o próximo dia útil (se já for útil, retorna ele mesmo) */
function nextBusinessDay(dateStr: string): string {
  let current = dateStr;
  while (!isBusinessDay(current)) {
    current = addDaysStr(current, 1);
  }
  return current;
}

/** Conta quantos dias úteis passaram entre fromDate (exclusivo) e toDate (inclusivo) */
function countBusinessDays(fromDateStr: string, toDateStr: string): number {
  let count = 0;
  let current = addDaysStr(fromDateStr, 1);
  while (current <= toDateStr) {
    if (isBusinessDay(current)) count++;
    current = addDaysStr(current, 1);
  }
  return count;
}

/**
 * Mapeamento estadoConfiguravel -> grupo (mesma lógica do salesRouter)
 * Usado para filtrar inadimplência por grupo de produto
 */
function estadoToGrupoFinancial(estado: string | null): string {
  if (!estado) return "outros";
  const e = estado.toUpperCase();
  if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
  if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
  if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
  return "outros";
}

/**
 * Busca nomes de clientes distintos da tabela sales_orders que correspondem
 * aos filtros de grupo e/ou CRM. Retorna null se nenhum filtro está ativo.
 * Usado para cross-filtering de inadimplência com filtros da aba Vendas.
 */
async function getClientesByGrupoAndCrm(
  db: any,
  grupo?: string,
  crmSegmento?: string
): Promise<Set<string> | null> {
  const hasGrupo = grupo && grupo !== "all";
  const hasCrm = crmSegmento && crmSegmento !== "all";
  if (!hasGrupo && !hasCrm) return null; // sem filtro ativo

  // Buscar clientes distintos que têm pedidos no grupo/CRM selecionado
  // Excluir pedidos em Digitação e pedidos "outros" (CANCELADO, AMOSTRA, GILSON, NULL)
  const rows = await db
    .select({
      cliente: salesOrders.cliente,
      clienteApelido: salesOrders.clienteApelido,
      razaoSocial: salesOrders.razaoSocial,
      estadoConfiguravel: salesOrders.estadoConfiguravel,
      crmSegmento: salesOrders.crmSegmento,
    })
    .from(salesOrders)
    .where(
      sql`(${salesOrders.estadoNota} IS NULL OR UPPER(${salesOrders.estadoNota}) NOT IN ('DIGITAÇÃO', 'DIGITACAO'))`
    );

  const clienteSet = new Set<string>();
  for (const row of rows) {
    const grupoRow = estadoToGrupoFinancial(row.estadoConfiguravel);
    if (grupoRow === "outros") continue;
    if (hasGrupo && grupoRow !== grupo) continue;
    if (hasCrm && (row.crmSegmento || "").toUpperCase() !== crmSegmento!.toUpperCase()) continue;
    // Adicionar todas as variações de nome do cliente
    if (row.cliente) clienteSet.add(row.cliente);
    if (row.clienteApelido) clienteSet.add(row.clienteApelido);
    if (row.razaoSocial) clienteSet.add(row.razaoSocial);
  }
  return clienteSet;
}

export const financialRouter = router({
  /**
   * Get financial summary - KPIs for the dashboard
   */
  getSummary: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const today = getTodayBR();

    // Contas a Pagar - em aberto (EMITIDO)
    // Usa valorLiquido - valorPagoLiquido para descontar pagamentos parciais
    const payableOpen = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsPayable.valorPagoLiquido}, 0) AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsPayable)
      .where(eq(accountsPayable.estado, "EMITIDO"));

    // Corte de vencidos: até o dia útil anterior a hoje
    const cutoffDate = getPreviousBusinessDay();

    // Contas a Pagar - vencidas (até dia útil anterior)
    const payableOverdue = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsPayable.valorPagoLiquido}, 0) AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsPayable)
      .where(
        and(
          eq(accountsPayable.estado, "EMITIDO"),
          lte(accountsPayable.vencimentoData, cutoffDate + "T23:59:59")
        )
      );

    // Contas a Pagar - a vencer (próximos 30 dias)
    const next30Str = addDaysStr(today, 30);

    const payableNext30 = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsPayable.valorPagoLiquido}, 0) AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsPayable)
      .where(
        and(
          eq(accountsPayable.estado, "EMITIDO"),
          gte(accountsPayable.vencimentoData, today + "T00:00:00"),
          lte(accountsPayable.vencimentoData, next30Str + "T23:59:59")
        )
      );

    // Contas a Pagar - próximos 60 dias
    const next60Str = addDaysStr(today, 60);

    const payableNext60 = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsPayable.valorPagoLiquido}, 0) AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsPayable)
      .where(
        and(
          eq(accountsPayable.estado, "EMITIDO"),
          lte(accountsPayable.vencimentoData, next60Str + "T23:59:59")
        )
      );

    // Contas a Receber - em aberto (EMITIDO) - apenas TITULO, RECEITA, ADIANTAMENTO
    // Usa valorLiquido - valorRecebidoLiquido para descontar pagamentos parciais
    const receivableOpen = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(and(eq(accountsReceivable.estado, "EMITIDO"), inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES)));

    // Contas a Receber - vencidas (inadimplência) - até dia útil anterior
    const receivableOverdue = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
          lte(accountsReceivable.vencimentoData, cutoffDate + "T23:59:59")
        )
      );

    // Contas a Receber - a receber (próximos 30 dias)
    const receivableNext30 = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
          gte(accountsReceivable.vencimentoData, today + "T00:00:00"),
          lte(accountsReceivable.vencimentoData, next30Str + "T23:59:59")
        )
      );

    // Contas a Receber - próximos 60 dias
    const receivableNext60 = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
          gte(accountsReceivable.vencimentoData, today + "T00:00:00"),
          lte(accountsReceivable.vencimentoData, next60Str + "T23:59:59")
        )
      );

    // Contas a Receber - 61 a 120 dias
    const next61Str = addDaysStr(today, 61);
    const next120Str = addDaysStr(today, 120);

    const receivable61a120 = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
          gte(accountsReceivable.vencimentoData, next61Str + "T00:00:00"),
          lte(accountsReceivable.vencimentoData, next120Str + "T23:59:59")
        )
      );

    // Contas a Receber - restante (>120 dias)
    const receivableRestante = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
          gte(accountsReceivable.vencimentoData, next120Str + "T00:00:00")
        )
      );

    // Contas a Pagar - total pago (PAGO)
    const payablePaid = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorPagoLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsPayable)
      .where(eq(accountsPayable.estado, "PAGO"));

    // Contas a Receber - total recebido (RECEBIDO)
    const receivableReceived = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorRecebidoLiquido} AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(eq(accountsReceivable.estado, "RECEBIDO"));

    // Top inadimplentes por cliente (para gráfico do card)
    const topInadimplentes = await db
      .select({
        cliente: accountsReceivable.cliente,
        total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2))), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
          lte(accountsReceivable.vencimentoData, cutoffDate + "T23:59:59")
        )
      )
      .groupBy(accountsReceivable.cliente)
      .orderBy(desc(sql`SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2)))`)
      )
      .limit(10);

    return {
      pagar: {
        emAberto: { total: Number(payableOpen[0]?.total || 0), count: payableOpen[0]?.count || 0 },
        vencidas: { total: Number(payableOverdue[0]?.total || 0), count: payableOverdue[0]?.count || 0 },
        proximos30dias: { total: Number(payableNext30[0]?.total || 0), count: payableNext30[0]?.count || 0 },
        proximos60dias: { total: Number(payableNext60[0]?.total || 0), count: payableNext60[0]?.count || 0 },
        pagas: { total: Number(payablePaid[0]?.total || 0), count: payablePaid[0]?.count || 0 },
      },
      receber: {
        emAberto: { total: Number(receivableOpen[0]?.total || 0), count: receivableOpen[0]?.count || 0 },
        vencidas: { total: Number(receivableOverdue[0]?.total || 0), count: receivableOverdue[0]?.count || 0 },
        proximos30dias: { total: Number(receivableNext30[0]?.total || 0), count: receivableNext30[0]?.count || 0 },
        proximos60dias: { total: Number(receivableNext60[0]?.total || 0), count: receivableNext60[0]?.count || 0 },
        de61a120dias: { total: Number(receivable61a120[0]?.total || 0), count: receivable61a120[0]?.count || 0 },
        restante: { total: Number(receivableRestante[0]?.total || 0), count: receivableRestante[0]?.count || 0 },
        recebidas: { total: Number(receivableReceived[0]?.total || 0), count: receivableReceived[0]?.count || 0 },
      },
      topInadimplentes: topInadimplentes.map(i => ({
        cliente: i.cliente || "Sem nome",
        total: Number(i.total || 0),
        count: i.count || 0,
      })),
    };
  }),

  /**
   * Get monthly breakdown - A Receber e A Pagar por mês (10 meses a partir do corrente)
   */
  getMonthlyBreakdown: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const todayBR = getTodayBR();
    const [curY, curM] = todayBR.split('-').map(Number);
    const months: { label: string; from: string; to: string }[] = [];

    for (let i = 0; i < 10; i++) {
      const y = curY;
      const m = curM - 1 + i; // 0-indexed for Date constructor
      const date = new Date(y, m, 1);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const label = date.toLocaleDateString("pt-BR", { month: "long" }).replace(/^./, (c) => c.toUpperCase());

      // REGRA DE CONCILIAÇÃO BANCÁRIA:
      // Para o mês corrente, usar o dia seguinte à última conciliação bancária
      // (= dia seguinte ao último dia útil antes de hoje).
      // Para meses futuros, usar o 1º dia do mês.
      const isCurrentMonth = date.getFullYear() === curY && date.getMonth() + 1 === curM;
      const fromDate = isCurrentMonth
        ? addDaysStr(getPreviousBusinessDay(), 1) // dia seguinte à última conciliação
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

      months.push({
        label,
        from: fromDate,
        to: `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`,
      });
    }

    const result = await Promise.all(
      months.map(async (month) => {
        const [receber] = await db
          .select({
            total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2))), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(accountsReceivable)
          .where(
            and(
              eq(accountsReceivable.estado, "EMITIDO"),
              inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
              gte(accountsReceivable.vencimentoData, month.from + "T00:00:00"),
              lte(accountsReceivable.vencimentoData, month.to + "T23:59:59")
            )
          );

        const [pagar] = await db
          .select({
            total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsPayable.valorPagoLiquido}, 0) AS DECIMAL(18,2))), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(accountsPayable)
          .where(
            and(
              eq(accountsPayable.estado, "EMITIDO"),
              gte(accountsPayable.vencimentoData, month.from + "T00:00:00"),
              lte(accountsPayable.vencimentoData, month.to + "T23:59:59")
            )
          );

        return {
          label: month.label,
          from: month.from,
          to: month.to,
          receber: { total: Number(receber?.total || 0), count: receber?.count || 0 },
          pagar: { total: Number(pagar?.total || 0), count: pagar?.count || 0 },
        };
      })
    );

    return result;
  }),

  /**
   * Get contas a pagar list with filters
   */
  getContasAPagar: publicProcedure
    .input(
      z.object({
        estado: z.string().optional(),
        dateFrom: z.string().optional(), // YYYY-MM-DD
        dateTo: z.string().optional(),   // YYYY-MM-DD
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
        sortBy: z.enum(["vencimentoData", "valorLiquido", "fornecedor"]).default("vencimentoData"),
        sortDir: z.enum(["asc", "desc"]).default("asc"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, totalValor: 0 };

      const estado = input?.estado;
      const dateFrom = input?.dateFrom;
      const dateTo = input?.dateTo;
      const limit = input?.limit ?? 100;
      const offset = input?.offset ?? 0;
      const sortBy = input?.sortBy ?? "vencimentoData";
      const sortDir = input?.sortDir ?? "asc";

      const conditions = [];

      if (estado) {
        conditions.push(eq(accountsPayable.estado, estado));
      } else {
        conditions.push(ne(accountsPayable.estado, "CANCELADO"));
      }

      if (dateFrom) {
        conditions.push(gte(accountsPayable.vencimentoData, dateFrom + "T00:00:00"));
      }
      if (dateTo) {
        conditions.push(lte(accountsPayable.vencimentoData, dateTo + "T23:59:59"));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const sortCol =
        sortBy === "valorLiquido"
          ? accountsPayable.valorLiquido
          : sortBy === "fornecedor"
          ? accountsPayable.fornecedor
          : accountsPayable.vencimentoData;

      const sortFn = sortDir === "desc" ? desc : asc;

      const [items, countResult, sumResult] = await Promise.all([
        db
          .select()
          .from(accountsPayable)
          .where(where)
          .orderBy(sortFn(sortCol))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(accountsPayable)
          .where(where),
        db
          .select({ total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsPayable.valorPagoLiquido}, 0) AS DECIMAL(18,2))), 0)` })
          .from(accountsPayable)
          .where(where),
      ]);

      return {
        items,
        total: countResult[0]?.count || 0,
        totalValor: Number(sumResult[0]?.total || 0),
      };
    }),

  /**
   * Get contas a receber list with filters
   */
  getContasAReceber: publicProcedure
    .input(
      z.object({
        estado: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
        sortBy: z.enum(["vencimentoData", "valorLiquido", "cliente"]).default("vencimentoData"),
        sortDir: z.enum(["asc", "desc"]).default("asc"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, totalValor: 0 };

      const estado = input?.estado;
      const dateFrom = input?.dateFrom;
      const dateTo = input?.dateTo;
      const limit = input?.limit ?? 100;
      const offset = input?.offset ?? 0;
      const sortBy = input?.sortBy ?? "vencimentoData";
      const sortDir = input?.sortDir ?? "asc";

      const conditions = [];

      // Filtrar apenas TITULO, RECEITA, ADIANTAMENTO
      conditions.push(inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES));

      if (estado) {
        conditions.push(eq(accountsReceivable.estado, estado));
      } else {
        conditions.push(ne(accountsReceivable.estado, "CANCELADO"));
      }

      if (dateFrom) {
        conditions.push(gte(accountsReceivable.vencimentoData, dateFrom + "T00:00:00"));
      }
      if (dateTo) {
        conditions.push(lte(accountsReceivable.vencimentoData, dateTo + "T23:59:59"));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const sortCol =
        sortBy === "valorLiquido"
          ? accountsReceivable.valorLiquido
          : sortBy === "cliente"
          ? accountsReceivable.cliente
          : accountsReceivable.vencimentoData;

      const sortFn = sortDir === "desc" ? desc : asc;

      const [items, countResult, sumResult] = await Promise.all([
        db
          .select()
          .from(accountsReceivable)
          .where(where)
          .orderBy(sortFn(sortCol))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(accountsReceivable)
          .where(where),
        db
          .select({ total: sql<string>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2))), 0)` })
          .from(accountsReceivable)
          .where(where),
      ]);

      return {
        items,
        total: countResult[0]?.count || 0,
        totalValor: Number(sumResult[0]?.total || 0),
      };
    }),

  /**
   * Get aging report - contas a receber agrupadas por faixa de atraso
   */
  getAgingReport: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const todayStr = getPreviousBusinessDay();

    // Get all open receivables (apenas TITULO, RECEITA, ADIANTAMENTO)
    const openReceivables = await db
      .select({
        cliente: accountsReceivable.cliente,
        valorLiquido: accountsReceivable.valorLiquido,
        valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
      })
      .from(accountsReceivable)
      .where(and(eq(accountsReceivable.estado, "EMITIDO"), inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES)));

    // Categorize by aging buckets
    const aging = {
      aVencer: { total: 0, count: 0 },
      de1a30: { total: 0, count: 0 },
      de31a60: { total: 0, count: 0 },
      de61a90: { total: 0, count: 0 },
      acima90: { total: 0, count: 0 },
    };

    const clienteAging: Record<string, { total: number; maiorAtraso: number }> = {};

    // Helper: diff in days between two YYYY-MM-DD strings
    function diffDaysStr(a: string, b: string): number {
      const [ay, am, ad] = a.split('-').map(Number);
      const [by, bm, bd] = b.split('-').map(Number);
      const da = new Date(ay, am - 1, ad);
      const db2 = new Date(by, bm - 1, bd);
      return Math.floor((da.getTime() - db2.getTime()) / (1000 * 60 * 60 * 24));
    }

    for (const item of openReceivables) {
      // Valor a receber = valorLiquido - valorRecebidoLiquido (desconta pagamentos parciais)
      const valor = (Number(item.valorLiquido) || 0) - (Number(item.valorRecebidoLiquido) || 0);
      const vencStr = item.vencimentoData?.split("T")[0];
      if (!vencStr) continue;

      const diffDays = diffDaysStr(todayStr, vencStr);

      if (diffDays < 0) {
        aging.aVencer.total += valor;
        aging.aVencer.count++;
      } else if (diffDays <= 30) {
        aging.de1a30.total += valor;
        aging.de1a30.count++;
      } else if (diffDays <= 60) {
        aging.de31a60.total += valor;
        aging.de31a60.count++;
      } else if (diffDays <= 90) {
        aging.de61a90.total += valor;
        aging.de61a90.count++;
      } else {
        aging.acima90.total += valor;
        aging.acima90.count++;
      }

      // Aggregate by client
      const clienteName = item.cliente || "Sem nome";
      if (!clienteAging[clienteName]) {
        clienteAging[clienteName] = { total: 0, maiorAtraso: 0 };
      }
      if (diffDays > 0) {
        clienteAging[clienteName].total += valor;
        clienteAging[clienteName].maiorAtraso = Math.max(clienteAging[clienteName].maiorAtraso, diffDays);
      }
    }

    // Top devedores
    const topDevedores = Object.entries(clienteAging)
      .filter(([_, v]) => v.total > 0)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .map(([nome, data]) => ({
        cliente: nome,
        totalVencido: data.total,
        maiorAtraso: data.maiorAtraso,
      }));

    return { aging, topDevedores };
  }),

  /**
   * Get payment calendar - contas a pagar: vencidas + 8 semanas
   */
  getPaymentCalendar: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const todayStr = getTodayBR(); // YYYY-MM-DD

    const openPayables = await db
      .select({
        maxiprodId: accountsPayable.maxiprodId,
        cliente: accountsPayable.fornecedor,
        valorLiquido: accountsPayable.valorLiquido,
        valorPagoLiquido: accountsPayable.valorPagoLiquido,
        vencimentoData: accountsPayable.vencimentoData,
        referenteA: accountsPayable.referenteA,
        observacoes: accountsPayable.observacoes,
        parcela: accountsPayable.parcela,
        parcelasQuantidadeTotal: accountsPayable.parcelasQuantidadeTotal,
        empresaNome: accountsPayable.empresaNome,
        anotacoes: accountsPayable.anotacoes,
      })
      .from(accountsPayable)
      .where(eq(accountsPayable.estado, "EMITIDO"));

    // Fetch existing authorization statuses
    const existingAuths = await db.select().from(paymentAuthorizations);
    const calAuthMap = new Map(existingAuths.map(a => [a.accountPayableId, { status: a.status, notes: a.notes }]));

    // Build week boundaries using string dates
    const dayOfWeek = getDayOfWeekStr(todayStr);
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayStr = addDaysStr(todayStr, daysToMonday);

    const weeks: { start: string; end: string; label: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const wStart = addDaysStr(mondayStr, i * 7);
      const wEnd = addDaysStr(wStart, 6);
      const dd1 = wStart.slice(8, 10);
      const mm1 = wStart.slice(5, 7);
      const dd2 = wEnd.slice(8, 10);
      const mm2 = wEnd.slice(5, 7);
      weeks.push({ start: wStart, end: wEnd, label: `${dd1}/${mm1} - ${dd2}/${mm2}` });
    }

    type Bucket = { label: string; total: number; count: number; items: any[] };
    const vencidas: Bucket = { label: "Vencidas", total: 0, count: 0, items: [] };
    const weekBuckets: Bucket[] = weeks.map((w) => ({ label: w.label, total: 0, count: 0, items: [] }));

    for (const item of openPayables) {
      // Valor a pagar = valorLiquido - valorPagoLiquido
      const valor = (Number(item.valorLiquido) || 0) - (Number(item.valorPagoLiquido) || 0);
      const vencStr = item.vencimentoData?.split("T")[0];
      if (!vencStr) continue;

      const adjVenc = adjustWeekendStr(vencStr);
      const calAuth = calAuthMap.get(item.maxiprodId);
      const entry = {
        maxiprodId: item.maxiprodId,
        fornecedor: item.cliente || item.referenteA || item.observacoes || "Sem nome",
        valor,
        vencimento: vencStr,
        referenteA: item.referenteA || "",
        parcela: item.parcela && item.parcelasQuantidadeTotal
          ? `${item.parcela}/${item.parcelasQuantidadeTotal}` : "",
        empresaNome: item.empresaNome || "",
        authStatus: calAuth?.status || null,
        authNotes: calAuth?.notes || null,
        anotacoes: item.anotacoes || "",
      };

      if (adjVenc < todayStr) {
        vencidas.total += valor;
        vencidas.count++;
        vencidas.items.push(entry);
      } else {
        for (let i = 0; i < weeks.length; i++) {
          if (adjVenc >= weeks[i].start && adjVenc <= weeks[i].end) {
            weekBuckets[i].total += valor;
            weekBuckets[i].count++;
            weekBuckets[i].items.push(entry);
            break;
          }
        }
      }
    }

    vencidas.items.sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento));
    for (const b of weekBuckets) {
      b.items.sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento));
    }

    return { vencidas, weeks: weekBuckets };
  }),

  /**
   * Get receivable calendar - contas a receber: vencidas + 8 semanas
   */
  getReceivableCalendar: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const todayStr = getTodayBR(); // YYYY-MM-DD
    const cutoffStr = getPreviousBusinessDay(); // dia útil anterior

    const openReceivables = await db
      .select({
        cliente: accountsReceivable.cliente,
        valorLiquido: accountsReceivable.valorLiquido,
        valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
        referenteA: accountsReceivable.referenteA,
      })
      .from(accountsReceivable)
      .where(and(eq(accountsReceivable.estado, "EMITIDO"), inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES)));

    // Build week boundaries using string dates
    const dayOfWeek = getDayOfWeekStr(todayStr);
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayStr = addDaysStr(todayStr, daysToMonday);

    const weeks: { start: string; end: string; label: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const wStart = addDaysStr(mondayStr, i * 7);
      const wEnd = addDaysStr(wStart, 6);
      const dd1 = wStart.slice(8, 10);
      const mm1 = wStart.slice(5, 7);
      const dd2 = wEnd.slice(8, 10);
      const mm2 = wEnd.slice(5, 7);
      weeks.push({ start: wStart, end: wEnd, label: `${dd1}/${mm1} - ${dd2}/${mm2}` });
    }

    type Bucket = { label: string; total: number; count: number; items: any[] };
    const vencidas: Bucket = { label: "Vencidas", total: 0, count: 0, items: [] };
    const weekBuckets: Bucket[] = weeks.map((w) => ({ label: w.label, total: 0, count: 0, items: [] }));

    for (const item of openReceivables) {
      // Valor a receber = valorLiquido - valorRecebidoLiquido (desconta pagamentos parciais)
      const valor = (Number(item.valorLiquido) || 0) - (Number(item.valorRecebidoLiquido) || 0);
      const vencStr = item.vencimentoData?.split("T")[0];
      if (!vencStr) continue;

      const adjVenc = adjustWeekendStr(vencStr);
      const entry = {
        fornecedor: item.cliente || "Sem nome",
        valor,
        vencimento: vencStr,
        referenteA: item.referenteA || "",
      };

      // Regra: contas vencidas entre o dia útil anterior e ontem aparecem como "vencidas" no calendário
      // Contas com vencimento anterior ao dia útil anterior são inadimplentes
      if (adjVenc < todayStr && adjVenc >= cutoffStr) {
        vencidas.total += valor;
        vencidas.count++;
        vencidas.items.push(entry);
      } else if (adjVenc >= todayStr) {
        for (let i = 0; i < weeks.length; i++) {
          if (adjVenc >= weeks[i].start && adjVenc <= weeks[i].end) {
            weekBuckets[i].total += valor;
            weekBuckets[i].count++;
            weekBuckets[i].items.push(entry);
            break;
          }
        }
      }
      // Contas com mais de 3 dias de atraso: não aparecem neste calendário (são inadimplentes)
    }

    vencidas.items.sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento));
    for (const b of weekBuckets) {
      b.items.sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento));
    }

    return { vencidas, weeks: weekBuckets };
  }),

  /**
   * Get inadimplência timeline - valor vencido agrupado por mês de vencimento
   * Para gráfico de linha no card Inadimplência
   */
  getInadimplenciaTimeline: publicProcedure
    .input(z.object({ clienteFilter: z.string().optional(), grupo: z.string().optional(), crmSegmento: z.string().optional() }).optional())
    .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];

    const cutoff = getPreviousBusinessDay();
    const clienteFilter = input?.clienteFilter?.trim() || "";
    const grupoFilter = input?.grupo || "";
    const crmFilter = input?.crmSegmento || "";

    // Cross-filter: buscar clientes que pertencem ao grupo/CRM selecionado
    const allowedClientes = await getClientesByGrupoAndCrm(db, grupoFilter, crmFilter);

    // Buscar todas as contas a receber vencidas (EMITIDO e vencimento <= dia útil anterior)
    const allRows = await db
      .select({
        cliente: accountsReceivable.cliente,
        valorLiquido: accountsReceivable.valorLiquido,
        valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
          lte(accountsReceivable.vencimentoData, cutoff + "T23:59:59")
        )
      );

    // Aplicar filtros
    let filtered = allRows;
    if (clienteFilter) {
      const term = clienteFilter.toLowerCase();
      filtered = filtered.filter((r: any) => (r.cliente || "").toLowerCase().includes(term));
    }
    if (allowedClientes) {
      filtered = filtered.filter((r: any) => allowedClientes.has(r.cliente || ""));
    }

    // Agrupar por mês
    const monthMap: Record<string, { total: number; count: number }> = {};
    for (const r of filtered) {
      const venc = r.vencimentoData?.split("T")[0] || "";
      if (!venc) continue;
      const mes = venc.slice(0, 7); // YYYY-MM
      const valor = (Number(r.valorLiquido) || 0) - (Number(r.valorRecebidoLiquido) || 0);
      if (!monthMap[mes]) monthMap[mes] = { total: 0, count: 0 };
      monthMap[mes].total += valor;
      monthMap[mes].count++;
    }

    return Object.entries(monthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, d]) => ({
        mes,
        total: d.total,
        count: d.count,
      }));
  }),

  /**
   * Get clientes inadimplentes com detalhes dos títulos
   * Para o card de ranking de clientes inadimplentes
   */
  getClientesInadimplentes: publicProcedure
    .input(z.object({ grupo: z.string().optional(), crmSegmento: z.string().optional() }).optional())
    .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];

    const cutoff = getPreviousBusinessDay();

    // Buscar todas as contas a receber vencidas com detalhes (apenas TITULO, RECEITA, ADIANTAMENTO)
    const rows = await db
      .select({
        cliente: accountsReceivable.cliente,
        valorLiquido: accountsReceivable.valorLiquido,
        valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
        referenteA: accountsReceivable.referenteA,
        documentoVinculadoNumero: accountsReceivable.documentoVinculadoNumero,
        parcela: accountsReceivable.parcela,
        parcelasQuantidadeTotal: accountsReceivable.parcelasQuantidadeTotal,
        empresaNome: accountsReceivable.empresaNome,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
          lte(accountsReceivable.vencimentoData, cutoff + "T23:59:59")
        )
      )
      .orderBy(asc(accountsReceivable.vencimentoData));

    // Buscar mapeamento cliente -> vendedor de duas fontes:
    // 1. GraphQL do Maxiprod (pedidosDeVenda - mais completo, inclui todos os pedidos)
    // 2. Tabela sales_orders local (fallback)
    const graphqlMap = await fetchVendedorMapFromGraphQL();

    // Fallback: buscar da tabela sales_orders local
    // REGRA DE NEGÓCIO: Excluir pedidos em "Digitação" - não são confirmados
    const vendedorRows = await db
      .select({
        cliente: salesOrders.cliente,
        clienteApelido: salesOrders.clienteApelido,
        razaoSocial: salesOrders.razaoSocial,
        representante: salesOrders.representante,
      })
      .from(salesOrders)
      .where(
        and(
          sql`${salesOrders.representante} IS NOT NULL`,
          sql`${salesOrders.representante} != ''`,
          sql`(${salesOrders.estadoNota} IS NULL OR UPPER(${salesOrders.estadoNota}) NOT IN ('DIGITAÇÃO', 'DIGITACAO'))`
        )
      );

    // Merge: GraphQL map has priority, local DB as fallback
    // Mesmas regras: excluir editores (Brenda/Larissa), override Johnson/Keure
    const vendedorMap: Record<string, string> = { ...graphqlMap };
    for (const vr of vendedorRows) {
      const rep = vr.representante || "";
      if (!rep || isEditorNaoVendedor(rep)) continue;
      const names = [vr.cliente, vr.clienteApelido, vr.razaoSocial].filter(Boolean) as string[];
      for (const nome of names) {
        if (nome && !vendedorMap[nome]) {
          vendedorMap[nome] = rep;
        }
      }
    }

    // Override manual: clientes Johnson e Keure → "Grupo Fox"
    for (const key of Object.keys(vendedorMap)) {
      if (isClienteGrupoFox(key)) {
        vendedorMap[key] = "Grupo Fox";
      }
    }

    // Cross-filter: buscar clientes que pertencem ao grupo/CRM selecionado
    const allowedClientes = await getClientesByGrupoAndCrm(db, input?.grupo, input?.crmSegmento);

    // Agrupar por cliente
    const clienteMap: Record<string, {
      total: number;
      totalOriginal: number;
      totalPago: number;
      count: number;
      vendedor: string;
      titulos: { valor: number; vencimento: string; referenteA: string; documento: string; parcela: string; empresa: string }[];
    }> = {};

    for (const row of rows) {
      // Se filtro de grupo/CRM está ativo, só incluir clientes que têm pedidos no grupo/CRM
      if (allowedClientes && !allowedClientes.has(row.cliente || "")) continue;
      const nome = row.cliente || "Sem nome";
      if (!clienteMap[nome]) {
        // Override manual: clientes Johnson/Keure que não estão no vendedorMap
        const vendedor = vendedorMap[nome] || (isClienteGrupoFox(nome) ? "Grupo Fox" : "");
        clienteMap[nome] = { total: 0, totalOriginal: 0, totalPago: 0, count: 0, vendedor, titulos: [] };
      }
      // Valor a receber = valorLiquido - valorRecebidoLiquido (desconta pagamentos parciais)
      const valorOriginal = Number(row.valorLiquido) || 0;
      const valorPago = Number(row.valorRecebidoLiquido) || 0;
      const valor = valorOriginal - valorPago;
      clienteMap[nome].total += valor;
      clienteMap[nome].totalOriginal += valorOriginal;
      clienteMap[nome].totalPago += valorPago;
      clienteMap[nome].count++;
      clienteMap[nome].titulos.push({
        valor,
        vencimento: row.vencimentoData?.split("T")[0] || "",
        referenteA: row.referenteA || "",
        documento: row.documentoVinculadoNumero || "",
        parcela: row.parcela && row.parcelasQuantidadeTotal
          ? `${row.parcela}/${row.parcelasQuantidadeTotal}`
          : "",
        empresa: row.empresaNome || "",
      });
    }

    // Ordenar por valor total decrescente
    return Object.entries(clienteMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([nome, data]) => ({
        cliente: nome,
        total: data.total,
        totalOriginal: data.totalOriginal,
        totalPago: data.totalPago,
        count: data.count,
        vendedor: data.vendedor,
        titulos: data.titulos.sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
      }));
  }),

  /**
   * Get detalhes de inadimplência por mês (títulos individuais)
   * Para o painel lateral do card Inadimplência
   */
  getInadimplenciaDetalhesMes: publicProcedure
    .input(z.object({ mes: z.string(), clienteFilter: z.string().optional(), grupo: z.string().optional(), crmSegmento: z.string().optional() }))
    .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { mes: input.mes, total: 0, count: 0, titulos: [] };

    const cutoff = getPreviousBusinessDay();
    const clienteFilter = input.clienteFilter?.trim() || "";

    // Buscar títulos vencidos do mês específico
    const startDate = `${input.mes}-01`;
    // Calcular último dia do mês
    const [y, m] = input.mes.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${input.mes}-${String(lastDay).padStart(2, "0")}`;

    let conditions = and(
      eq(accountsReceivable.estado, "EMITIDO"),
      inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
      lte(accountsReceivable.vencimentoData, cutoff + "T23:59:59"),
      gte(accountsReceivable.vencimentoData, startDate),
      lte(accountsReceivable.vencimentoData, endDate + "T23:59:59")
    );

    if (clienteFilter) {
      conditions = and(
        conditions,
        sql`LOWER(${accountsReceivable.cliente}) LIKE ${`%${clienteFilter.toLowerCase()}%`}`
      );
    }

    const rows = await db
      .select({
        cliente: accountsReceivable.cliente,
        valorLiquido: accountsReceivable.valorLiquido,
        valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
        referenteA: accountsReceivable.referenteA,
        documentoVinculadoNumero: accountsReceivable.documentoVinculadoNumero,
      })
      .from(accountsReceivable)
      .where(conditions)
      .orderBy(desc(sql`CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2))`));

    // Cross-filter: buscar clientes que pertencem ao grupo/CRM selecionado
    const allowedClientes = await getClientesByGrupoAndCrm(db, input.grupo, input.crmSegmento);
    const filteredRows = allowedClientes
      ? rows.filter(r => allowedClientes.has(r.cliente || ""))
      : rows;

    const total = filteredRows.reduce((sum, r) => sum + ((Number(r.valorLiquido) || 0) - (Number(r.valorRecebidoLiquido) || 0)), 0);

    return {
      mes: input.mes,
      total,
      count: filteredRows.length,
      titulos: filteredRows.map(r => ({
        cliente: r.cliente || "Sem nome",
        valor: (Number(r.valorLiquido) || 0) - (Number(r.valorRecebidoLiquido) || 0),
        vencimento: r.vencimentoData?.split("T")[0] || "",
        referenteA: r.referenteA || "",
        documento: r.documentoVinculadoNumero || "",
      })),
    };
  }),

  /**
   * Get top fornecedores by value
   */
  getTopFornecedores: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const result = await db
      .select({
        fornecedor: accountsPayable.fornecedor,
        totalEmAberto: sql<string>`COALESCE(SUM(CASE WHEN ${accountsPayable.estado} = 'EMITIDO' THEN CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsPayable.valorPagoLiquido}, 0) AS DECIMAL(18,2)) ELSE 0 END), 0)`,
        totalPago: sql<string>`COALESCE(SUM(CASE WHEN ${accountsPayable.estado} = 'PAGO' THEN CAST(${accountsPayable.valorPagoLiquido} AS DECIMAL(18,2)) ELSE 0 END), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsPayable)
      .where(ne(accountsPayable.estado, "CANCELADO"))
      .groupBy(accountsPayable.fornecedor)
      .orderBy(desc(sql`SUM(CASE WHEN ${accountsPayable.estado} = 'EMITIDO' THEN CAST(${accountsPayable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsPayable.valorPagoLiquido}, 0) AS DECIMAL(18,2)) ELSE 0 END)`))
      .limit(15);

    return result.map((r) => ({
      fornecedor: r.fornecedor || "Sem nome",
      totalEmAberto: Number(r.totalEmAberto),
      totalPago: Number(r.totalPago),
      count: r.count,
    }));
  }),

  /**
   * Get top clientes by receivable value
   */
  getTopClientes: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const result = await db
      .select({
        cliente: accountsReceivable.cliente,
        totalEmAberto: sql<string>`COALESCE(SUM(CASE WHEN ${accountsReceivable.estado} = 'EMITIDO' THEN CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2)) ELSE 0 END), 0)`,
        totalRecebido: sql<string>`COALESCE(SUM(CASE WHEN ${accountsReceivable.estado} = 'RECEBIDO' THEN CAST(${accountsReceivable.valorRecebidoLiquido} AS DECIMAL(18,2)) ELSE 0 END), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(accountsReceivable)
      .where(and(ne(accountsReceivable.estado, "CANCELADO"), inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES)))
      .groupBy(accountsReceivable.cliente)
      .orderBy(desc(sql`SUM(CASE WHEN ${accountsReceivable.estado} = 'EMITIDO' THEN CAST(${accountsReceivable.valorLiquido} AS DECIMAL(18,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, 0) AS DECIMAL(18,2)) ELSE 0 END)`))

      .limit(15);

    return result.map((r) => ({
      cliente: r.cliente || "Sem nome",
      totalEmAberto: Number(r.totalEmAberto),
      totalRecebido: Number(r.totalRecebido),
      count: r.count,
    }));
  }),

  /**
   * Get cash flow chart data - recebimentos vs pagamentos por semana
   * Mostra saldo acumulado (positivo/negativo) ao longo das próximas 8 semanas
   */
  getCashFlowChart: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const todayStr = getTodayBR(); // YYYY-MM-DD
    const cutoffStr = getPreviousBusinessDay(); // dia útil anterior

    // Fetch all open payables and receivables
    const openPayables = await db
      .select({
        valorLiquido: accountsPayable.valorLiquido,
        valorPagoLiquido: accountsPayable.valorPagoLiquido,
        vencimentoData: accountsPayable.vencimentoData,
      })
      .from(accountsPayable)
      .where(eq(accountsPayable.estado, "EMITIDO"));

    const openReceivables = await db
      .select({
        valorLiquido: accountsReceivable.valorLiquido,
        valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
      })
      .from(accountsReceivable)
      .where(and(eq(accountsReceivable.estado, "EMITIDO"), inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES)));

    // Build week boundaries using string dates
    const dayOfWeek = getDayOfWeekStr(todayStr);
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayStr = addDaysStr(todayStr, daysToMonday);

    const weeks: { start: string; end: string; label: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const wStart = addDaysStr(mondayStr, i * 7);
      const wEnd = addDaysStr(wStart, 6);
      const dd1 = wStart.slice(8, 10);
      const mm1 = wStart.slice(5, 7);
      const dd2 = wEnd.slice(8, 10);
      const mm2 = wEnd.slice(5, 7);
      weeks.push({ start: wStart, end: wEnd, label: `${dd1}/${mm1} - ${dd2}/${mm2}` });
    }

    // Initialize week data
    const weekData = weeks.map((w) => ({
      label: w.label,
      recebimentos: 0,
      pagamentos: 0,
      saldo: 0,
      saldoAcumulado: 0,
    }));

    // Vencidas: receber só até 3 dias de atraso (sem inadimplentes), pagar todas vencidas
    let vencidasReceber = 0;
    let vencidasPagar = 0;

    // Distribute receivables - somente até 3 dias de atraso
    for (const item of openReceivables) {
      // Valor a receber = valorLiquido - valorRecebidoLiquido (desconta pagamentos parciais)
      const valor = (Number(item.valorLiquido) || 0) - (Number(item.valorRecebidoLiquido) || 0);
      const vencStr = item.vencimentoData?.split("T")[0];
      if (!vencStr) continue;
      const adjVenc = adjustWeekendStr(vencStr);

      if (adjVenc < todayStr && adjVenc >= cutoffStr) {
        vencidasReceber += valor;
      } else if (adjVenc >= todayStr) {
        for (let i = 0; i < weeks.length; i++) {
          if (adjVenc >= weeks[i].start && adjVenc <= weeks[i].end) {
            weekData[i].recebimentos += valor;
            break;
          }
        }
      }
      // Contas com vencimento anterior ao dia útil anterior: não entram no fluxo de caixa (inadimplentes)
    }

    // Distribute payables - todas vencidas entram
    // Valor a pagar = valorLiquido - valorPagoLiquido
    for (const item of openPayables) {
      const valor = (Number(item.valorLiquido) || 0) - (Number(item.valorPagoLiquido) || 0);
      const vencStr = item.vencimentoData?.split("T")[0];
      if (!vencStr) continue;
      const adjVenc = adjustWeekendStr(vencStr);

      if (adjVenc < todayStr) {
        vencidasPagar += valor;
      } else {
        for (let i = 0; i < weeks.length; i++) {
          if (adjVenc >= weeks[i].start && adjVenc <= weeks[i].end) {
            weekData[i].pagamentos += valor;
            break;
          }
        }
      }
    }

    // Calculate saldo per week and accumulated
    let acumulado = vencidasReceber - vencidasPagar;
    for (const w of weekData) {
      w.saldo = w.recebimentos - w.pagamentos;
      acumulado += w.saldo;
      w.saldoAcumulado = acumulado;
    }

    return {
      vencidas: {
        recebimentos: vencidasReceber,
        pagamentos: vencidasPagar,
        saldo: vencidasReceber - vencidasPagar,
      },
      weeks: weekData,
    };
  }),

  /**
   * Get bank accounts with current balances
   * saldoAtual = saldoInicial + sum(OFX transactions after saldoInicialData)
   */
  getBankBalances: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { accounts: [], totalSaldo: 0 };

    const accounts = await db.select().from(bankAccounts).where(eq(bankAccounts.ativo, true));
    const transactions = await db.select().from(bankTransactions);

    // Group transactions by contaBancariaId
    const txnByAccount = new Map<number, Array<{ data: string; valor: number }>>();
    transactions.forEach(t => {
      const list = txnByAccount.get(t.contaBancariaId) || [];
      list.push({ data: t.data, valor: Number(t.valor) });
      txnByAccount.set(t.contaBancariaId, list);
    });

    // Filtrar apenas contas contábeis (1.01.01.02.*)
    const contasContabeis = accounts.filter(a => a.codigoEstruturado?.startsWith('1.01.01.02.'));

    // Helper: gerar nome no formato "Banco + Empresa" a partir dos dados do Maxiprod
    function gerarNomeConta(acc: typeof contasContabeis[0]): string {
      const bancoNome = acc.bancoNome || '';
      const empresaNome = acc.empresaNome || '';
      
      // Para contas que já têm nome composto (ex: "BB Mesa", "CEF Palitos", "Sicoob Espetos")
      // o bancoNome já contém banco + empresa
      if (!empresaNome) return bancoNome;
      
      // Para contas com banco e empresa separados, combinar
      // Simplificar nome do banco (ex: "Banco Bradesco S.A." -> "Bradesco")
      let bancoSimples = bancoNome
        .replace(/^Banco\s+/i, '')
        .replace(/\s+S\.?A\.?$/i, '')
        .replace(/Cooperativo\s+/i, '')
        .trim();
      
      // Simplificar empresa (ex: "PALITOS INDUSTRIA" -> "Palitos")
      let empresaSimples = empresaNome
        .replace(/\s+INDUSTRIA$/i, '')
        .replace(/\s+IND$/i, '')
        .trim();
      // Title case
      empresaSimples = empresaSimples.charAt(0).toUpperCase() + empresaSimples.slice(1).toLowerCase();
      
      return `${bancoSimples} ${empresaSimples}`;
    }

    let totalSaldo = 0;
    let totalSaldoContabil = 0;
    const result = contasContabeis.map(acc => {
      const saldoInicial = Number(acc.saldoInicial || 0);
      const dataRef = acc.saldoInicialData || "";
      const txns = txnByAccount.get(acc.maxiprodId) || [];
      
      // Sum only transactions AFTER the reference date
      const movimentacao = txns
        .filter(t => dataRef ? t.data > dataRef : true)
        .reduce((sum, t) => sum + t.valor, 0);
      
      // Saldo contábil do balancete (preenchido automaticamente via syncBankBalances)
      const saldoContabil = Number(acc.saldoContabil || 0);
      const totalDebitos = Number(acc.totalDebitos || 0);
      const totalCreditos = Number(acc.totalCreditos || 0);
      
      // Usar saldo contábil como saldo principal quando sincronizado (mais preciso que OFX)
      // IMPORTANTE: verificar por data de atualização, NÃO por valor !== 0 (saldo zero é válido!)
      const temSaldoContabil = !!acc.saldoContabilAtualizadoEm;
      const saldoAtual = temSaldoContabil ? saldoContabil : (saldoInicial + movimentacao);
      totalSaldo += saldoAtual;
      totalSaldoContabil += saldoContabil;

      return {
        id: acc.id,
        maxiprodId: acc.maxiprodId,
        nomeConta: gerarNomeConta(acc),
        bancoNome: acc.bancoNome,
        agencia: acc.agencia,
        contaNumero: acc.contaNumero,
        empresaNome: acc.empresaNome,
        codigoEstruturado: acc.codigoEstruturado,
        saldoInicial,
        saldoInicialData: dataRef,
        movimentacao: Math.round(movimentacao * 100) / 100,
        saldoContabil: Math.round(saldoContabil * 100) / 100,
        totalDebitos: Math.round(totalDebitos * 100) / 100,
        totalCreditos: Math.round(totalCreditos * 100) / 100,
        saldoContabilAtualizadoEm: acc.saldoContabilAtualizadoEm,
        saldoAtual: Math.round(saldoAtual * 100) / 100,
        totalTransacoes: txns.length,
      };
    }).sort((a, b) => (a.codigoEstruturado || '').localeCompare(b.codigoEstruturado || ''));

    return {
      accounts: result,
      totalSaldo: Math.round(totalSaldo * 100) / 100,
      totalSaldoContabil: Math.round(totalSaldoContabil * 100) / 100,
    };
  }),

  /**
   * Get bank balances with saldo inicial, saldo atual, and variação.
   * Uses lancamentosContabeis from Maxiprod balancete.
   * Period: 1st of current month to today (or custom dates).
   */
  getBankBalancesDetailed: publicProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const todayBR = getTodayBR();
      let periodStart: string;
      let periodEnd: string;

      if (input?.startDate && input?.endDate) {
        periodStart = input.startDate;
        periodEnd = input.endDate;
      } else {
        const [curY, curM] = todayBR.split('-').map(Number);
        periodStart = `${curY}-${String(curM).padStart(2, '0')}-01`;
        periodEnd = todayBR;
      }

      const data = await fetchBankBalancesWithInitial(periodStart, periodEnd);

      // Generate period label
      const startParts = periodStart.split('-').map(Number);
      const endParts = periodEnd.split('-').map(Number);
      const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);
      const periodLabel = `${startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} até ${endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

      return {
        periodLabel,
        periodStart,
        periodEnd,
        ...data,
      };
    }),

  /**
   * Update saldo inicial for a bank account
   */
  updateBankBalance: publicProcedure
    .input(z.object({
      maxiprodId: z.number(),
      saldoInicial: z.string(),
      saldoInicialData: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(bankAccounts)
        .set({
          saldoInicial: input.saldoInicial,
          saldoInicialData: input.saldoInicialData,
        })
        .where(eq(bankAccounts.maxiprodId, input.maxiprodId));

      return { success: true };
    }),

  /**
   * Get payment authorization data for the current week (Mon-Fri)
   * Returns 5 day cards with contas a pagar listed and authorization status
   */
  getWeekReconciliation: publicProcedure.query(async () => {
    // Garantir que autorizações de dias anteriores foram limpas
    // Isso cobre o caso de sandbox hibernar e o cron de meia-noite não rodar
    await checkAndResetIfNeeded();

    const db = await getDb();
    if (!db) return { days: [], weekLabel: "", vencidas: { items: [], total: 0, count: 0 } };

    // Calcular segunda-feira da semana corrente (Brasília)
    const todayStr = getTodayBR();
    const dow = getDayOfWeekStr(todayStr); // 0=Dom, 1=Seg...
    const daysToMonday = dow === 0 ? 6 : dow - 1;
    const mondayStr = addDaysStr(todayStr, -daysToMonday);
    const fridayStr = addDaysStr(mondayStr, 4);

    // Gerar 5 dias (seg-sex)
    const weekDays: string[] = [];
    for (let i = 0; i < 5; i++) {
      weekDays.push(addDaysStr(mondayStr, i));
    }

    // Buscar TODAS as contas a pagar em aberto (EMITIDO)
    const openPayables = await db
      .select({
        maxiprodId: accountsPayable.maxiprodId,
        fornecedor: accountsPayable.fornecedor,
        fornecedorApelido: accountsPayable.fornecedorApelido,
        valorLiquido: accountsPayable.valorLiquido,
        valorPagoLiquido: accountsPayable.valorPagoLiquido,
        vencimentoData: accountsPayable.vencimentoData,
        referenteA: accountsPayable.referenteA,
        observacoes: accountsPayable.observacoes,
        parcela: accountsPayable.parcela,
        parcelasQuantidadeTotal: accountsPayable.parcelasQuantidadeTotal,
        empresaNome: accountsPayable.empresaNome,
        emissaoData: accountsPayable.emissaoData,
        documentoVinculadoNumero: accountsPayable.documentoVinculadoNumero,
        vencimentoOriginalData: accountsPayable.vencimentoOriginalData,
        anotacoes: accountsPayable.anotacoes,
      })
      .from(accountsPayable)
      .where(eq(accountsPayable.estado, "EMITIDO"));

    // Buscar autorizações existentes (com status e notas)
    const existingAuths = await db
      .select()
      .from(paymentAuthorizations);
    const authMap = new Map(existingAuths.map(a => [a.accountPayableId, { status: a.status, notes: a.notes }]));

    // Classificar contas por dia da semana
    type PayableItem = {
      maxiprodId: number;
      fornecedor: string;
      valor: number;
      vencimento: string;
      vencimentoOriginal: string;
      emissaoData: string;
      referenteA: string;
      observacoes: string;
      documentoVinculadoNumero: string;
      parcela: string;
      empresaNome: string;
      authorized: boolean;
      authStatus: string | null;
      authNotes: string | null;
      anotacoes: string;
    };

    // Buckets: vencidas (antes da semana) + 5 dias
    const vencidasItems: PayableItem[] = [];
    const dayBuckets: PayableItem[][] = [[], [], [], [], []];

    for (const item of openPayables) {
      const valor = (Number(item.valorLiquido) || 0) - (Number(item.valorPagoLiquido) || 0);
      if (valor <= 0) continue; // Já pago

      const vencStr = item.vencimentoData?.split("T")[0];
      if (!vencStr) continue;

      const adjVenc = adjustWeekendStr(vencStr);
      const authData = authMap.get(item.maxiprodId);
      const entry: PayableItem = {
        maxiprodId: item.maxiprodId,
        fornecedor: item.fornecedorApelido || item.fornecedor || item.referenteA || item.observacoes || "Sem nome",
        valor,
        vencimento: vencStr,
        vencimentoOriginal: item.vencimentoOriginalData?.split("T")[0] || vencStr,
        emissaoData: item.emissaoData?.split("T")[0] || "",
        referenteA: item.referenteA || "",
        observacoes: item.observacoes || "",
        documentoVinculadoNumero: item.documentoVinculadoNumero || "",
        parcela: item.parcela && item.parcelasQuantidadeTotal
          ? `${item.parcela}/${item.parcelasQuantidadeTotal}`
          : "",
        empresaNome: item.empresaNome || "",
        authorized: authData?.status === "autorizado" || false,
        authStatus: authData?.status || null,
        authNotes: authData?.notes || null,
        anotacoes: item.anotacoes || "",
      };

      // Vencidas: antes da segunda-feira da semana
      if (adjVenc < mondayStr) {
        vencidasItems.push(entry);
      } else if (adjVenc >= mondayStr && adjVenc <= fridayStr) {
        // Dentro da semana: classificar por dia
        for (let i = 0; i < 5; i++) {
          if (adjVenc === weekDays[i]) {
            dayBuckets[i].push(entry);
            break;
          }
        }
      }
      // Contas após sexta-feira são ignoradas (aparecem na semana seguinte)
    }

    // Ordenar por fornecedor (A-Z), depois por data de emissão crescente (padrão Maxiprod)
    const sortByFornecedorThenEmissao = (a: PayableItem, b: PayableItem) => {
      const cmpForn = a.fornecedor.localeCompare(b.fornecedor, 'pt-BR');
      if (cmpForn !== 0) return cmpForn;
      // Dentro do mesmo fornecedor: ordenar por data de emissão (mais antiga primeiro)
      return (a.emissaoData || '').localeCompare(b.emissaoData || '');
    };
    vencidasItems.sort(sortByFornecedorThenEmissao);
    for (const bucket of dayBuckets) {
      bucket.sort(sortByFornecedorThenEmissao);
    }

    // Montar resposta por dia
    const days = weekDays.map((dateStr, i) => {
      const dayName = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"][getDayOfWeekStr(dateStr)];
      const [, m, d] = dateStr.split("-");
      const items = dayBuckets[i];
      const total = items.reduce((s, it) => s + it.valor, 0);
      const authorizedTotal = items.filter(it => it.authStatus === "autorizado").reduce((s, it) => s + it.valor, 0);
      const isPast = dateStr < todayStr;
      const isToday = dateStr === todayStr;

      return {
        date: dateStr,
        dayLabel: `${dayName} ${d}/${m}`,
        items,
        total: Math.round(total * 100) / 100,
        authorizedTotal: Math.round(authorizedTotal * 100) / 100,
        authorizedCount: items.filter(it => it.authStatus === "autorizado").length,
        count: items.length,
        isPast,
        isToday,
        isFuture: !isPast && !isToday,
      };
    });

    // Label da semana
    const [, m1, d1] = weekDays[0].split("-");
    const [, m2, d2] = weekDays[4].split("-");
    const weekLabel = `${d1}/${m1} - ${d2}/${m2}`;

    // Vencidas
    const vencidasTotal = vencidasItems.reduce((s, it) => s + it.valor, 0);

    return {
      days,
      weekLabel,
      mondayStr,
      fridayStr,
      vencidas: {
        items: vencidasItems,
        total: Math.round(vencidasTotal * 100) / 100,
        count: vencidasItems.length,
        authorizedCount: vencidasItems.filter(it => it.authStatus === "autorizado").length,
        authorizedTotal: Math.round(vencidasItems.filter(it => it.authStatus === "autorizado").reduce((s, it) => s + it.valor, 0) * 100) / 100,
      },
    };
  }),

  /**
   * Set payment authorization status for a specific account payable
   */
  setPaymentAuthStatus: publicProcedure
    .input(z.object({
      accountPayableId: z.number(), // maxiprodId
      status: z.enum(["autorizado", "nao_autorizado", "autorizado_ressalva", "prorrogar", "outros"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(paymentAuthorizations)
        .where(eq(paymentAuthorizations.accountPayableId, input.accountPayableId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(paymentAuthorizations)
          .set({ status: input.status, notes: input.notes !== undefined ? input.notes : existing[0].notes })
          .where(eq(paymentAuthorizations.accountPayableId, input.accountPayableId));
      } else {
        await db.insert(paymentAuthorizations).values({
          accountPayableId: input.accountPayableId,
          status: input.status,
          notes: input.notes || null,
        });
      }

      return { success: true };
    }),

  /**
   * Update notes/comment for a specific payment authorization
   */
  updatePaymentAuthNotes: publicProcedure
    .input(z.object({
      accountPayableId: z.number(),
      notes: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(paymentAuthorizations)
        .where(eq(paymentAuthorizations.accountPayableId, input.accountPayableId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(paymentAuthorizations)
          .set({ notes: input.notes })
          .where(eq(paymentAuthorizations.accountPayableId, input.accountPayableId));
      } else {
        await db.insert(paymentAuthorizations).values({
          accountPayableId: input.accountPayableId,
          status: "outros",
          notes: input.notes,
        });
      }

      return { success: true };
    }),

  /**
   * Clear payment authorization status (remove record)
   */
  clearPaymentAuthStatus: publicProcedure
    .input(z.object({
      accountPayableId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(paymentAuthorizations)
        .where(eq(paymentAuthorizations.accountPayableId, input.accountPayableId));

      return { success: true };
    }),

  /**
   * Legacy toggle - keep backward compatibility
   */
  togglePaymentAuth: publicProcedure
    .input(z.object({
      accountPayableId: z.number(),
      authorized: z.boolean(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (input.authorized) {
        const existing = await db
          .select()
          .from(paymentAuthorizations)
          .where(eq(paymentAuthorizations.accountPayableId, input.accountPayableId))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(paymentAuthorizations)
            .set({ status: "autorizado", notes: input.notes || null })
            .where(eq(paymentAuthorizations.accountPayableId, input.accountPayableId));
        } else {
          await db.insert(paymentAuthorizations).values({
            accountPayableId: input.accountPayableId,
            status: "autorizado",
            notes: input.notes || null,
          });
        }
      } else {
        await db
          .delete(paymentAuthorizations)
          .where(eq(paymentAuthorizations.accountPayableId, input.accountPayableId));
      }

      return { success: true };
    }),

  /**
   * Batch toggle payment authorization for multiple accounts
   */
  batchTogglePaymentAuth: publicProcedure
    .input(z.object({
      accountPayableIds: z.array(z.number()),
      authorized: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (input.authorized) {
        // Batch authorize
        for (const id of input.accountPayableIds) {
          const existing = await db
            .select()
            .from(paymentAuthorizations)
            .where(eq(paymentAuthorizations.accountPayableId, id))
            .limit(1);

          if (existing.length > 0) {
            await db
              .update(paymentAuthorizations)
              .set({ status: "autorizado" })
              .where(eq(paymentAuthorizations.accountPayableId, id));
          } else {
            await db.insert(paymentAuthorizations).values({
              accountPayableId: id,
              status: "autorizado",
            });
          }
        }
      } else {
        // Batch remove
        if (input.accountPayableIds.length > 0) {
          await db
            .delete(paymentAuthorizations)
            .where(inArray(paymentAuthorizations.accountPayableId, input.accountPayableIds));
        }
      }

      return { success: true };
    }),

  /**
   * Keep legacy toggleReconciliation for backward compatibility
   */
  toggleReconciliation: publicProcedure
    .input(z.object({
      date: z.string(),
      reconciled: z.boolean(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(dailyReconciliation)
        .where(eq(dailyReconciliation.date, input.date))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(dailyReconciliation)
          .set({
            reconciled: input.reconciled,
            notes: input.notes || null,
            reconciledAt: input.reconciled ? new Date() : null,
          })
          .where(eq(dailyReconciliation.date, input.date));
      } else {
        await db.insert(dailyReconciliation).values({
          date: input.date,
          reconciled: input.reconciled,
          notes: input.notes || null,
          reconciledAt: input.reconciled ? new Date() : null,
        });
      }

      return { success: true };
    }),

  /**
   * Update notes for a specific reconciliation day
   */
  updateReconciliationNotes: publicProcedure
    .input(z.object({
      date: z.string(),
      notes: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(dailyReconciliation)
        .where(eq(dailyReconciliation.date, input.date))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(dailyReconciliation)
          .set({ notes: input.notes })
          .where(eq(dailyReconciliation.date, input.date));
      } else {
        await db.insert(dailyReconciliation).values({
          date: input.date,
          notes: input.notes,
          reconciled: false,
        });
      }

      return { success: true };
    }),

  /**
   * Get billing (faturamento) vs paid/due expenses for a given period
   * Faturamento = sum of sales_orders with estadoItem='Faturado' in the period
   * Contas Pagas:
   *   - Março/2026 e anteriores: contas a pagar com vencimento no período (proxy)
   *   - Abril/2026 em diante: contas efetivamente pagas (estado='PAGO', liquidacaoData no período)
   * Cutoff date: 2026-04-01 (a partir desta data usa dados reais de pagamento)
   */
  getMonthlyBillingVsPaid: publicProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;

    const todayBR = getTodayBR();
    let periodStart: string;
    let periodEnd: string;

    if (input?.startDate && input?.endDate) {
      periodStart = input.startDate;
      periodEnd = input.endDate;
    } else {
      // Default: mês atual do dia 1 até hoje
      const [curY, curM] = todayBR.split('-').map(Number);
      periodStart = `${curY}-${String(curM).padStart(2, '0')}-01`;
      periodEnd = todayBR;
    }

    // Faturamento: Notas Fiscais do Maxiprod (Vendas > Notas Fiscais)
    // Filtros: emissão no período, estado EMITIDA, estadoConfiguravel em FIBRA/BAMBU/MADEIRA/ROJÃO/SERRAGEM
    const faturamento = await fetchInvoicesTotal(periodStart, periodEnd);

    // Contas Pagas: busca diretamente da API GraphQL do Maxiprod (estado PAGO + liquidacaoData)
    const paidData = await fetchPaidAccountsTotal(periodStart, periodEnd);

    // Gerar label do período
    const startParts = periodStart.split('-').map(Number);
    const endParts = periodEnd.split('-').map(Number);
    const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);
    const periodLabel = `${startDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} a ${endDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    const faturamentoTotal = faturamento.total;

    return {
      periodLabel,
      periodStart,
      periodEnd,
      contasLabel: 'Contas Pagas',
      faturamento: {
        total: faturamentoTotal,
        count: faturamento?.count || 0,
      },
      contasPagar: {
        total: paidData.total,
        count: paidData.count,
        isFromCache: paidData.isFromCache,
        isComplete: paidData.isComplete,
        excludedCount: paidData.excludedCount ?? 0,
        excludedTotal: paidData.excludedTotal ?? 0,
      },
      saldo: Math.round((faturamentoTotal - paidData.total) * 100) / 100,
    };
  }),

  /**
   * Vendas vs Contas Pagas
   * Compara o total de pedidos de venda no período com as contas efetivamente pagas.
   * USA A MESMA LÓGICA DA ABA VENDAS (getAnalytics):
   *   - Exclui Digitação (estadoNota)
   *   - Exclui "outros" (estadoConfiguravel: CANCELADO, AMOSTRA/BONIFICAÇÃO, GILSON, NULL)
   *   - Soma valorTotal de todos os itens válidos
   */
  getSalesVsPaid: publicProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;

    const todayBR = getTodayBR();
    let periodStart: string;
    let periodEnd: string;

    if (input?.startDate && input?.endDate) {
      periodStart = input.startDate;
      periodEnd = input.endDate;
    } else {
      // Default: mês atual do dia 1 até hoje
      const [curY, curM] = todayBR.split('-').map(Number);
      periodStart = `${curY}-${String(curM).padStart(2, '0')}-01`;
      periodEnd = todayBR;
    }

    // === VENDAS: mesma lógica do getAnalytics da aba Vendas ===
    // Usar SUBSTRING para comparação segura de datas (evita bug de timezone)
    const startDay = periodStart.substring(0, 10);
    const endDay = periodEnd.substring(0, 10);

    const allItems = await db
      .select()
      .from(salesOrders)
      .where(
        and(
          sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) >= ${startDay}`,
          sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) <= ${endDay}`
        )
      );

    // Mesmas funções de filtro do getAnalytics
    const estadoToGrupo = (estado: string | null): string => {
      if (!estado) return "outros";
      const e = estado.toUpperCase();
      if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
      if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
      if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
      return "outros";
    };

    const isDigitacao = (nota: string | null) => {
      if (!nota) return false;
      const n = nota.toUpperCase();
      return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
    };

    const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";

    // Filtrar: exclui Digitação e "outros" (CANCELADO, AMOSTRA, GILSON, NULL)
    const items = allItems.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));

    // Calcular totais usando valorTotalPedido (inclui descontos e frete)
    // Agrupa por pedido único e usa valorTotalPedido quando disponível
    const uniqueOrders = new Set(items.map((i) => i.pedido).filter(Boolean));
    const pedidoValueMap = new Map<string, number>();
    for (const item of items) {
      const pedido = item.pedido || 'sem-pedido';
      if (!pedidoValueMap.has(pedido)) {
        // Primeiro item deste pedido: usar valorTotalPedido se disponível
        if (item.valorTotalPedido) {
          pedidoValueMap.set(pedido, Number(item.valorTotalPedido));
        } else {
          pedidoValueMap.set(pedido, Number(item.valorTotal || 0));
        }
      } else {
        // Itens adicionais do mesmo pedido: só somar se NÃO temos valorTotalPedido
        // (se temos valorTotalPedido, ele já inclui todos os itens + desconto/frete)
        const firstItemHasVTP = items.find(i => i.pedido === pedido && i.valorTotalPedido);
        if (!firstItemHasVTP) {
          pedidoValueMap.set(pedido, (pedidoValueMap.get(pedido) || 0) + Number(item.valorTotal || 0));
        }
        // Se já tem valorTotalPedido, não soma (já está o total correto)
      }
    }
    const totalValue = Array.from(pedidoValueMap.values()).reduce((sum, v) => sum + v, 0);
    const vendasTotal = Math.round(totalValue * 100) / 100;

    // Contas Pagas: busca diretamente da API GraphQL do Maxiprod
    const paidData = await fetchPaidAccountsTotal(periodStart, periodEnd);

    // Gerar label do período
    const startParts = periodStart.split('-').map(Number);
    const endParts = periodEnd.split('-').map(Number);
    const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);
    const periodLabel = `${startDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} a ${endDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    return {
      periodLabel,
      periodStart,
      periodEnd,
      vendas: {
        total: vendasTotal,
        pedidos: uniqueOrders.size,
        itens: items.length,
      },
      contasPagas: {
        total: paidData.total,
        count: paidData.count,
        isFromCache: paidData.isFromCache,
        isComplete: paidData.isComplete,
      },
      saldo: Math.round((vendasTotal - paidData.total) * 100) / 100,
    };
  }),

  /**
   * Detalhe de NFs Faturadas no período
   * Lista individual de cada NF com cliente, número, valor e data
   */
  getBillingDetails: publicProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
    // Buscar NFs diretamente da API Maxiprod (mesma fonte do total)
    const nfs = await fetchInvoicesDetails(input.startDate, input.endDate);
    
    // Buscar nomes dos clientes do banco local usando os pedidos das NFs
    const db = await getDb();
    const pedidoToCliente = new Map<string, string>();
    if (db) {
      const pedidoNums = Array.from(new Set(nfs.map(n => n.nomeDestinatario).filter(p => p !== '-')));
      if (pedidoNums.length > 0) {
        // Buscar em batches
        for (let i = 0; i < pedidoNums.length; i += 100) {
          const batch = pedidoNums.slice(i, i + 100);
          const rows = await db
            .select({ pedido: salesOrders.pedido, cliente: salesOrders.cliente })
            .from(salesOrders)
            .where(inArray(salesOrders.pedido, batch));
          for (const row of rows) {
            if (row.pedido && row.cliente && !pedidoToCliente.has(row.pedido)) {
              pedidoToCliente.set(row.pedido, row.cliente);
            }
          }
        }
      }
    }
    
    return nfs.map(nf => {
      const pedido = nf.nomeDestinatario; // número do pedido ou '-'
      // Para o nome do cliente: prioridade 1 = banco local (via pedido), prioridade 2 = destinatário da NF no Maxiprod
      const cliente = pedidoToCliente.get(pedido) || nf.clienteNome || `NF ${nf.numero}`;
      const emDate = nf.emissaoData ? nf.emissaoData.slice(0, 10) : '-';
      return {
        pedido,
        cliente,
        total: nf.valorTotal,
        data: emDate,
        itens: 1,
      };
    }).sort((a, b) => a.data.localeCompare(b.data)); // Ordenar por data
  }),

  /**
   * Detalhe de Pedidos de Venda no período
   * Mesma lógica de filtro do getSalesVsPaid (exclui Digitação e "outros")
   */
  getSalesDetails: publicProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];

    const startISO = input.startDate.includes('T') ? input.startDate : input.startDate + 'T00:00:00.000Z';
    const endISO = input.endDate.includes('T') ? input.endDate : input.endDate + 'T23:59:59.999Z';

    const allItems = await db
      .select()
      .from(salesOrders)
      .where(
        and(
          gte(salesOrders.dataEmissao, startISO),
          lte(salesOrders.dataEmissao, endISO)
        )
      );

    const estadoToGrupo = (estado: string | null): string => {
      if (!estado) return "outros";
      const e = estado.toUpperCase();
      if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
      if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
      if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
      return "outros";
    };

    const isDigitacao = (nota: string | null) => {
      if (!nota) return false;
      const n = nota.toUpperCase();
      return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
    };

    const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";

    const items = allItems.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));

    // Agrupar por pedido - usar valorTotalPedido (com desconto/frete) quando disponível
    const pedidoMap = new Map<string, { pedido: string; cliente: string; total: number; data: string; itens: number; estado: string; grupo: string; observacoes: string; descricoes: string[]; hasVTP: boolean }>();
    for (const item of items) {
      const key = item.pedido || 'sem-pedido';
      if (!pedidoMap.has(key)) {
        const hasVTP = !!item.valorTotalPedido;
        pedidoMap.set(key, {
          pedido: item.pedido || '-',
          cliente: item.cliente || '-',
          total: hasVTP ? Number(item.valorTotalPedido) : Number(item.valorTotal || 0),
          data: item.dataEmissao?.slice(0, 10) || '-',
          itens: 0,
          estado: item.estadoNota || '-',
          grupo: estadoToGrupo(item.estadoConfiguravel),
          observacoes: item.observacoes || '',
          descricoes: [],
          hasVTP,
        });
      } else {
        const entry = pedidoMap.get(key)!;
        // Só somar item.valorTotal se não temos valorTotalPedido
        if (!entry.hasVTP) {
          entry.total += Number(item.valorTotal || 0);
        }
      }
      const entry = pedidoMap.get(key)!;
      entry.itens += 1;
      // Coletar descrições únicas dos itens
      if (item.descricao && !entry.descricoes.includes(item.descricao)) {
        entry.descricoes.push(item.descricao);
      }
    }

    return Array.from(pedidoMap.values())
      .sort((a, b) => b.total - a.total)
      .map(e => ({ ...e, total: Math.round(e.total * 100) / 100, descricoes: e.descricoes.slice(0, 5) }));
  }),

  /**
   * Detalhe de Contas Pagas no período
   * Busca da API GraphQL do Maxiprod com detalhes de cada conta
   */
  getPaidDetails: publicProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
    return await fetchPaidAccountsDetails(input.startDate, input.endDate);
  }),

  /**
   * Total de Entradas no período (Vendas/Revenda + Demais Receitas)
   * Busca contaAReceber com estado RECEBIDO e tipo TITULO ou RECEITA.
   * Classifica por plano de contas contábil.
   * Campo 'recebimentos' = Vendas/Revenda (para compatibilidade com frontend)
   */
  getReceivedTotal: publicProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
    const todayBR = getTodayBR();
    let periodStart: string;
    let periodEnd: string;

    if (input?.startDate && input?.endDate) {
      periodStart = input.startDate;
      periodEnd = input.endDate;
    } else {
      const [curY, curM] = todayBR.split('-').map(Number);
      periodStart = `${curY}-${String(curM).padStart(2, '0')}-01`;
      periodEnd = todayBR;
    }

    const receivedData = await fetchReceivedAccountsTotal(periodStart, periodEnd);

    return {
      periodStart,
      periodEnd,
      recebimentos: {
        total: receivedData.vendasRevenda,
        count: receivedData.vendasRevendaCount,
      },
    };
  }),

  /**
   * Detalhe de Recebimentos no período
   * Lista individual de cada conta recebida com cliente, valor e data
   */
  getReceivedDetails: publicProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
    return await fetchReceivedAccountsDetails(input.startDate, input.endDate);
  }),

  /**
   * Total de Outras Entradas no período
   * Entradas bancárias que NÃO são recebimentos de clientes
   * (transferências internas, empréstimos, liberações, rendimentos, etc.)
   */
  getOtherInflowsTotal: publicProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
    const todayBR = getTodayBR();
    let periodStart: string;
    let periodEnd: string;

    if (input?.startDate && input?.endDate) {
      periodStart = input.startDate;
      periodEnd = input.endDate;
    } else {
      const [curY, curM] = todayBR.split('-').map(Number);
      periodStart = `${curY}-${String(curM).padStart(2, '0')}-01`;
      periodEnd = todayBR;
    }

    const data = await fetchOtherInflowsTotal(periodStart, periodEnd);

    return {
      periodStart,
      periodEnd,
      outrasEntradas: {
        total: data.total,
        count: data.count,
      },
    };
  }),

  /**
   * Detalhe de Outras Entradas no período
   * Lista individual de cada entrada não-cliente com descrição, valor, data e categoria
   */
  getOtherInflowsDetails: publicProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
    return await fetchOtherInflowsDetails(input.startDate, input.endDate);
  }),

  /**
   * Entradas OFX mensais (Recebimentos vs Outras Entradas) para gráfico de barras empilhadas.
   * Retorna breakdown por mês para visualização comparativa.
   */
    getMonthlyOFXInflows: publicProcedure
    .input(z.object({
      months: z.array(z.object({
        startDate: z.string(),
        endDate: z.string(),
        label: z.string(),
      })),
    }))
    .query(async ({ input }) => {
      return await fetchMonthlyOFXInflows(input.months);
    }),

  /**
   * Get bank reconciliation status for today.
   * Returns whether the reconciliation checkbox was checked today.
   */
  getBankReconciliationStatus: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { reconciled: false, reconciledBy: null };

      const todayBR = getTodayBR();
      const rows = await db
        .select()
        .from(dailyReconciliation)
        .where(eq(dailyReconciliation.date, todayBR))
        .limit(1);

      if (rows.length > 0 && rows[0].reconciled) {
        return { reconciled: true, reconciledBy: rows[0].reconciledBy || null };
      }
      return { reconciled: false, reconciledBy: null };
    }),

  /**
   * Set bank reconciliation for today.
   * Requires password "Thiago" to mark as reconciled.
   */
  setBankReconciliation: publicProcedure
    .input(z.object({
      password: z.string(),
      reconciled: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      // Validate password
      if (input.password !== "Thiago") {
        return { success: false, error: "Senha incorreta" };
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const todayBR = getTodayBR();

      const existing = await db
        .select()
        .from(dailyReconciliation)
        .where(eq(dailyReconciliation.date, todayBR))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(dailyReconciliation)
          .set({
            reconciled: input.reconciled,
            reconciledBy: input.reconciled ? "Thiago" : null,
            reconciledAt: input.reconciled ? new Date() : null,
          })
          .where(eq(dailyReconciliation.date, todayBR));
      } else {
        await db.insert(dailyReconciliation).values({
          date: todayBR,
          reconciled: input.reconciled,
          reconciledBy: input.reconciled ? "Thiago" : null,
          reconciledAt: input.reconciled ? new Date() : null,
        });
      }

      return { success: true };
    }),

  /**
   * Get receivables grouped hierarchically: Empresa → Conta Bancária → Tipo → Mês
   * Para a sub-aba Recebíveis do Financeiro (redesign)
   */
  getReceivablesByBank: publicProcedure
    .input(z.object({
      estado: z.enum(["EMITIDO", "RECEBIDO", "ALL"]).default("EMITIDO"),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { empresas: [], totals: { total: 0, count: 0, vencido: 0, aVencer: 0 } };

      const estado = input?.estado || "EMITIDO";
      // REGRA DE CONCILIAÇÃO BANCÁRIA (mesma lógica do getMonthlyBreakdown e getSummary):
      // Vencido = vencimento até o último dia útil (cutoffDate)
      // A Vencer = vencimento a partir do dia seguinte à conciliação
      const cutoffDate = getPreviousBusinessDay();
      const conditions = [
        inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
      ];
      if (estado !== "ALL") {
        conditions.push(eq(accountsReceivable.estado, estado));
      }
      if (input?.dateFrom) {
        conditions.push(gte(accountsReceivable.vencimentoData, input.dateFrom));
      }
      if (input?.dateTo) {
        conditions.push(lte(accountsReceivable.vencimentoData, input.dateTo + "T23:59:59"));
      }

      // Buscar mapa de conta bancária → empresa dona (da tabela bank_accounts)
      const bankAccountRows = await db
        .select({
          bancoNome: bankAccounts.bancoNome,
          contaNumero: bankAccounts.contaNumero,
          agencia: bankAccounts.agencia,
          empresaNome: bankAccounts.empresaNome,
        })
        .from(bankAccounts)
        .where(sql`${bankAccounts.contaNumero} IS NOT NULL AND ${bankAccounts.contaNumero} != ''`);

      // Mapa contaNumero → empresaNome (empresa dona da conta bancária)
      // Usa a tabela fornecida pelo usuário como referência definitiva
      const CONTA_EMPRESA_MAP: Record<string, string> = {
        '50051': 'PALITOS',
        '50306': 'VARETAS',
        '50365': 'ESPETOS',
        '52061': 'MESA',
        '80242': 'ESPETOS',
        '80246': 'VARETAS',
        '80247': 'PALITOS',
        '90244': 'MESA',
        '579071919': 'PALITOS',
        '579072029': 'ESPETOS',
        '578245135': 'VARETAS',
        '19342': 'PALITOS',
        '19344': 'VARETAS',
        '19287': 'ESPETOS',
        '18899': 'MESA',
      };

      // Também construir mapa dinâmico a partir dos dados do banco
      const dynamicContaMap: Record<string, string> = {};
      for (const ba of bankAccountRows) {
        if (ba.contaNumero && ba.empresaNome) {
          // Simplificar nome da empresa: "PALITOS INDUSTRIA" → "PALITOS"
          const shortName = ba.empresaNome.split(' ')[0];
          dynamicContaMap[ba.contaNumero] = shortName;
        }
      }

      // Função para obter empresa dona da conta
      function getContaEmpresa(contaNumero: string | null): string | null {
        if (!contaNumero) return null;
        // Prioridade: mapa estático (confirmado pelo usuário) > mapa dinâmico (do banco)
        return CONTA_EMPRESA_MAP[contaNumero] || dynamicContaMap[contaNumero] || null;
      }

      // Buscar todos os recebíveis com dados bancários diretos da tabela
      const rows = await db
        .select({
          id: accountsReceivable.id,
          cliente: accountsReceivable.cliente,
          valorLiquido: accountsReceivable.valorLiquido,
          valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
          vencimentoData: accountsReceivable.vencimentoData,
          emissaoData: accountsReceivable.emissaoData,
          liquidacaoData: accountsReceivable.liquidacaoData,
          referenteA: accountsReceivable.referenteA,
          tipo: accountsReceivable.tipo,
          estado: accountsReceivable.estado,
          parcela: accountsReceivable.parcela,
          parcelasQuantidadeTotal: accountsReceivable.parcelasQuantidadeTotal,
          documentoVinculadoNumero: accountsReceivable.documentoVinculadoNumero,
          empresaNome: accountsReceivable.empresaNome,
          bancoNome: accountsReceivable.bancoNome,
          contaNumero: accountsReceivable.contaNumero,
          agencia: accountsReceivable.agencia,
          formaCobranca: accountsReceivable.formaCobranca,
          formaCobrancaId: accountsReceivable.formaCobrancaId,
          anotacoes: accountsReceivable.anotacoes,
        })
        .from(accountsReceivable)
        .where(and(...conditions))
        .orderBy(asc(accountsReceivable.vencimentoData));

      let grandTotal = 0;
      let grandCount = 0;
      let grandVencido = 0;
      let grandAVencer = 0;

      // Hierarquia: empresa → mês → banco/conta → forma de recebimento (tipo)
      type ItemData = {
        id: number; cliente: string; valorAReceber: number; valorOriginal: number;
        valorPago: number; vencimento: string; emissao: string;
        liquidacao: string | null; referenteA: string; tipo: string;
        estado: string | null; parcela: string; documento: string;
        empresa: string; bancoNome: string; contaNumero: string;
        agencia: string; isOverdue: boolean; formaCobranca: string;
        anotacoes: string;
      };

      // Build hierarchy maps: empresa → mês → conta → tipo → items
      const empresaMap: Record<string, {
        meses: Record<string, {
          contas: Record<string, {
            tipos: Record<string, { items: ItemData[]; total: number; count: number }>;
            bancoNome: string; contaNumero: string; agencia: string; contaEmpresa: string | null;
            total: number; count: number;
          }>;
          total: number; count: number; vencido: number; aVencer: number;
        }>;
        total: number; count: number; vencido: number; aVencer: number;
      }> = {};

      for (const row of rows) {
        const valorOriginal = Number(row.valorLiquido) || 0;
        const valorPago = Number(row.valorRecebidoLiquido) || 0;
        const valorAReceber = valorOriginal - valorPago;
        if (valorAReceber <= 0 && estado === "EMITIDO") continue;

        const vencDate = (row.vencimentoData || "").split("T")[0];
        // REGRA DE CONCILIAÇÃO BANCÁRIA:
        // Vencido = vencimento até cutoffDate (último dia útil antes de hoje)
        // A Vencer = vencimento a partir do dia seguinte à conciliação
        // Alinhado com getMonthlyBreakdown e getSummary da Visão Geral
        const isOverdue = vencDate <= cutoffDate;
        const mesKey = vencDate.substring(0, 7); // YYYY-MM
        const empresa = row.empresaNome || "Sem Empresa";
        const bancoNome = row.bancoNome || "Sem Banco";
        const contaNumero = row.contaNumero || "";
        const agencia = row.agencia || "";
        const contaKey = `${bancoNome}|${contaNumero}|${agencia}`;
        const tipoKey = row.tipo || "OUTROS";

        const item: ItemData = {
          id: row.id,
          cliente: row.cliente || "Sem nome",
          valorAReceber,
          valorOriginal,
          valorPago,
          vencimento: vencDate,
          emissao: (row.emissaoData || "").split("T")[0],
          liquidacao: row.liquidacaoData ? row.liquidacaoData.split("T")[0] : null,
          referenteA: row.referenteA || "",
          tipo: row.tipo || "",
          estado: row.estado,
          parcela: row.parcela && row.parcelasQuantidadeTotal
            ? `${row.parcela}/${row.parcelasQuantidadeTotal}` : "",
          documento: row.documentoVinculadoNumero || "",
          empresa,
          bancoNome,
          contaNumero,
          agencia,
          isOverdue,
          formaCobranca: row.formaCobranca || "",
          anotacoes: row.anotacoes || "",
        };

        // Empresa level
        if (!empresaMap[empresa]) {
          empresaMap[empresa] = { meses: {}, total: 0, count: 0, vencido: 0, aVencer: 0 };
        }
        empresaMap[empresa].total += valorAReceber;
        empresaMap[empresa].count++;
        if (isOverdue) empresaMap[empresa].vencido += valorAReceber;
        else empresaMap[empresa].aVencer += valorAReceber;

        // Mês level
        if (!empresaMap[empresa].meses[mesKey]) {
          empresaMap[empresa].meses[mesKey] = { contas: {}, total: 0, count: 0, vencido: 0, aVencer: 0 };
        }
        const mes = empresaMap[empresa].meses[mesKey];
        mes.total += valorAReceber;
        mes.count++;
        if (isOverdue) mes.vencido += valorAReceber;
        else mes.aVencer += valorAReceber;

        // Conta level (dentro do mês)
        if (!mes.contas[contaKey]) {
          mes.contas[contaKey] = {
            bancoNome, contaNumero, agencia,
            contaEmpresa: getContaEmpresa(contaNumero),
            tipos: {}, total: 0, count: 0,
          };
        }
        const conta = mes.contas[contaKey];
        conta.total += valorAReceber;
        conta.count++;

        // Tipo level (forma de recebimento, dentro da conta)
        if (!conta.tipos[tipoKey]) {
          conta.tipos[tipoKey] = { items: [], total: 0, count: 0 };
        }
        conta.tipos[tipoKey].items.push(item);
        conta.tipos[tipoKey].total += valorAReceber;
        conta.tipos[tipoKey].count++;

        grandTotal += valorAReceber;
        grandCount++;
        if (isOverdue) grandVencido += valorAReceber;
        else grandAVencer += valorAReceber;
      }

      // Garantir que as 3 empresas principais sempre apareçam (mesmo com 0 títulos)
      const EMPRESAS_OBRIGATORIAS = ["PALITOS INDUSTRIA", "VARETAS INDUSTRIA", "ESPETOS INDUSTRIA"];
      for (const empName of EMPRESAS_OBRIGATORIAS) {
        if (!empresaMap[empName]) {
          empresaMap[empName] = { meses: {}, total: 0, count: 0, vencido: 0, aVencer: 0 };
        }
      }

      // Convert to sorted arrays: empresa → mês → conta → tipo
      // Ordenar: empresas obrigatórias primeiro (na ordem definida), depois as demais por total
      const empresaEntries = Object.entries(empresaMap);
      const obrigatorias = EMPRESAS_OBRIGATORIAS
        .map(name => empresaEntries.find(([n]) => n === name))
        .filter(Boolean) as [string, typeof empresaMap[string]][];
      const outras = empresaEntries
        .filter(([n]) => !EMPRESAS_OBRIGATORIAS.includes(n))
        .sort(([, a], [, b]) => b.total - a.total);
      const sortedEntries = [...obrigatorias, ...outras];

      const empresas = sortedEntries
        .map(([nome, emp]) => ({
          nome,
          total: emp.total,
          count: emp.count,
          vencido: emp.vencido,
          aVencer: emp.aVencer,
          meses: Object.entries(emp.meses)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mes, m]) => ({
              mes,
              total: m.total,
              count: m.count,
              vencido: m.vencido,
              aVencer: m.aVencer,
              contas: Object.values(m.contas)
                .sort((a, b) => {
                  // Ordem fixa por nome do banco (alfabética) — não muda entre meses
                  const nameA = (a.bancoNome || '').toUpperCase();
                  const nameB = (b.bancoNome || '').toUpperCase();
                  if (nameA < nameB) return -1;
                  if (nameA > nameB) return 1;
                  // Desempate por número da conta
                  return (a.contaNumero || '').localeCompare(b.contaNumero || '');
                })
                .map(conta => ({
                  bancoNome: conta.bancoNome,
                  contaNumero: conta.contaNumero,
                  agencia: conta.agencia,
                  contaEmpresa: conta.contaEmpresa,
                  total: conta.total,
                  count: conta.count,
                  tipos: Object.entries(conta.tipos)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([tipo, t]) => ({
                      tipo,
                      total: t.total,
                      count: t.count,
                      items: t.items,
                    })),
                })),
            })),
        }));

      return {
        empresas,
        totals: { total: grandTotal, count: grandCount, vencido: grandVencido, aVencer: grandAVencer },
      };
    }),

  /**
   * Listar todos os títulos vencidos individualmente com dados de cobrança
   */
  getOverdueTitles: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      sortBy: z.enum(["valor", "dias", "cliente", "vencimento"]).default("dias"),
      sortDir: z.enum(["asc", "desc"]).default("desc"),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { titles: [], stats: { total: 0, count: 0, byStatus: {} } };

      // Para a aba de cobrança: buscar títulos vencidos até o dia útil anterior
      // Títulos que vencem hoje ainda não são inadimplentes (pode ser conciliação pendente)
      const cutoffCobranca = getPreviousBusinessDay();

      // Buscar títulos vencidos com JOIN no banco
      const rows = await db
        .select({
          id: accountsReceivable.id,
          maxiprodId: accountsReceivable.maxiprodId,
          cliente: accountsReceivable.cliente,
          valorLiquido: accountsReceivable.valorLiquido,
          valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
          vencimentoData: accountsReceivable.vencimentoData,
          vencimentoOriginalData: accountsReceivable.vencimentoOriginalData,
          emissaoData: accountsReceivable.emissaoData,
          referenteA: accountsReceivable.referenteA,
          tipo: accountsReceivable.tipo,
          parcela: accountsReceivable.parcela,
          parcelasQuantidadeTotal: accountsReceivable.parcelasQuantidadeTotal,
          documentoVinculadoNumero: accountsReceivable.documentoVinculadoNumero,
          empresaNome: accountsReceivable.empresaNome,
          observacoes: accountsReceivable.observacoes,
          anotacoes: accountsReceivable.anotacoes,
          contaId: accountsReceivable.contaId,
          bancoNome: bankAccounts.bancoNome,
          formaCobranca: accountsReceivable.formaCobranca,
        })
        .from(accountsReceivable)
        .leftJoin(bankAccounts, eq(accountsReceivable.contaId, bankAccounts.maxiprodId))
        .where(
          and(
            eq(accountsReceivable.estado, "EMITIDO"),
            inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
            lte(accountsReceivable.vencimentoData, cutoffCobranca + "T23:59:59")
          )
        )
        .orderBy(asc(accountsReceivable.vencimentoData));

      // Buscar todas as ações de cobrança existentes
      const allActions = await db.select().from(collectionActions);
      const actionsMap: Record<number, typeof allActions[0]> = {};
      for (const a of allActions) {
        actionsMap[a.receivableId] = a;
      }

      // Buscar vendedor map e decisão de cobrança (protesto)
      const [graphqlMap, cobrancaMap] = await Promise.all([
        fetchVendedorMapFromGraphQL(),
        fetchCobrancaDecisionMap(),
      ]);

      // Filtrar e mapear
      let titles = rows.map(row => {
        const valorOriginal = Number(row.valorLiquido) || 0;
        const valorPago = Number(row.valorRecebidoLiquido) || 0;
        const valorAReceber = valorOriginal - valorPago;
        const vencDate = (row.vencimentoData || "").split("T")[0];
        const todayForDisplay = getTodayBR();
        const diasAtrasoRaw = Math.floor((new Date(todayForDisplay).getTime() - new Date(vencDate).getTime()) / 86400000);
        // Dias ÚTEIS de atraso (pula sábados, domingos e feriados) — usa HOJE para exibição
        // Cutoff serve apenas para filtrar quem aparece, dias de atraso é sempre baseado em hoje
        const businessDaysOverdue = diasAtrasoRaw > 0 ? countBusinessDays(vencDate, todayForDisplay) : 0;
        // diasAtraso agora é sempre em dias ÚTEIS para exibição
        const diasAtraso = businessDaysOverdue;
        const action = actionsMap[row.id];
        const vendedor = graphqlMap[row.cliente || ""] || "";
        const clienteName = (row.cliente || "").trim();
        // Prioridade: campo direto do DB (sincronizado do Maxiprod via camposAdicionais do cliente)
        // Fallback: mapa de decisão por nome (fetchCobrancaDecisionMap)
        const decisaoCobranca = (row as any).decisaoCobranca || cobrancaMap[clienteName] || cobrancaMap[clienteName.toUpperCase()] || "";

        return {
          id: row.id,
          cliente: row.cliente || "Sem nome",
          valorAReceber,
          valorOriginal,
          valorPago,
          vencimento: vencDate,
          vencimentoOriginal: (row.vencimentoOriginalData || "").split("T")[0],
          emissao: (row.emissaoData || "").split("T")[0],
          referenteA: row.referenteA || "",
          tipo: row.tipo || "",
          parcela: row.parcela && row.parcelasQuantidadeTotal
            ? `${row.parcela}/${row.parcelasQuantidadeTotal}` : "",
          documento: row.documentoVinculadoNumero || "",
          empresa: row.empresaNome || "",
          banco: row.bancoNome || "",
          diasAtraso,
          businessDaysOverdue,
          vendedor,
          decisaoCobranca,
          formaCobranca: row.formaCobranca || "",
          observacoesMaxiprod: row.observacoes || "",
          anotacoes: row.anotacoes || "",
          // Dados de cobrança
          cobranca: action ? {
            status: action.status,
            promessaData: action.promessaData,
            promessaValor: action.promessaValor ? Number(action.promessaValor) : null,
            lembreteData: action.lembreteData,
            observacoes: action.observacoes,
            contatoHistorico: (action.contatoHistorico || []) as Array<{data: string; tipo: string; resumo: string; usuario?: string}>,
            updatedAt: action.updatedAt?.toISOString() || "",
            cobrancaStartedAt: action.cobrancaStartedAt || null,
          } : null,
        };
      }).filter(t => t.valorAReceber > 0);

      // NOTA: Mostrar TODOS os títulos vencidos na lista de cobrança (sem threshold)
      // O threshold de 3 dias úteis aplica-se apenas ao quadro "Pagos/Resolvidos" (recuperação)

      // Filtrar clientes de teste
      const TEST_CLIENTS = ['CLIENTE TESTE REGRA', 'CLIENTE MANUAL TICK TEST', 'CLIENTE LEGACY VIBRATION TEST', 'CLIENTE RECENT VIBRATION TEST', 'CLIENTE TESTE COBRANCA'];
      titles = titles.filter(t => !TEST_CLIENTS.includes(t.cliente.toUpperCase().trim()));

      // Filtro de busca
      if (input?.search) {
        const s = input.search.toUpperCase();
        titles = titles.filter(t =>
          t.cliente.toUpperCase().includes(s) ||
          t.referenteA.toUpperCase().includes(s) ||
          t.documento.toUpperCase().includes(s) ||
          t.vendedor.toUpperCase().includes(s) ||
          t.decisaoCobranca.toUpperCase().includes(s)
        );
      }

      // Filtro de status de cobrança
      if (input?.status && input.status !== "todos") {
        if (input.status === "pendente") {
          titles = titles.filter(t => !t.cobranca || t.cobranca.status === "pendente");
        } else {
          titles = titles.filter(t => t.cobranca?.status === input.status);
        }
      }

      // Ordenação
      const dir = input?.sortDir === "asc" ? 1 : -1;
      switch (input?.sortBy) {
        case "valor":
          titles.sort((a, b) => (a.valorAReceber - b.valorAReceber) * dir);
          break;
        case "dias":
          titles.sort((a, b) => (a.businessDaysOverdue - b.businessDaysOverdue) * dir);
          break;
        case "cliente":
          titles.sort((a, b) => a.cliente.localeCompare(b.cliente) * dir);
          break;
        case "vencimento":
          titles.sort((a, b) => a.vencimento.localeCompare(b.vencimento) * dir);
          break;
        default:
          titles.sort((a, b) => (b.businessDaysOverdue - a.businessDaysOverdue));
      }

      // Estatísticas
      const byStatus: Record<string, number> = {};
      let totalValue = 0;
      for (const t of titles) {
        const st = t.cobranca?.status || "pendente";
        byStatus[st] = (byStatus[st] || 0) + 1;
        totalValue += t.valorAReceber;
      }

      return {
        titles,
        stats: { total: totalValue, count: titles.length, byStatus },
      };
    }),

  /**
   * Atualizar/criar ação de cobrança para um título
   */
  upsertCollectionAction: publicProcedure
    .input(z.object({
      receivableId: z.number(),
      status: z.string().optional(),
      promessaData: z.string().nullable().optional(),
      promessaValor: z.number().nullable().optional(),
      lembreteData: z.string().nullable().optional(),
      observacoes: z.string().nullable().optional(),
      novoContato: z.object({
        tipo: z.string(),
        resumo: z.string(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      // Verificar se já existe ação para este título
      const existing = await db
        .select()
        .from(collectionActions)
        .where(eq(collectionActions.receivableId, input.receivableId))
        .limit(1);

      if (existing.length > 0) {
        // Update
        const updates: any = {};
        if (input.status !== undefined) updates.status = input.status;
        if (input.promessaData !== undefined) updates.promessaData = input.promessaData;
        if (input.promessaValor !== undefined) updates.promessaValor = input.promessaValor !== null ? String(input.promessaValor) : null;
        if (input.lembreteData !== undefined) updates.lembreteData = input.lembreteData;
        if (input.observacoes !== undefined) updates.observacoes = input.observacoes;

        // Adicionar novo contato ao histórico
        if (input.novoContato) {
          const hist = (existing[0].contatoHistorico || []) as Array<any>;
          hist.unshift({
            data: new Date().toISOString(),
            tipo: input.novoContato.tipo,
            resumo: input.novoContato.resumo,
          });
          updates.contatoHistorico = hist;
        }

        await db.update(collectionActions)
          .set(updates)
          .where(eq(collectionActions.receivableId, input.receivableId));
      } else {
        // Insert
        const hist = input.novoContato ? [{
          data: new Date().toISOString(),
          tipo: input.novoContato.tipo,
          resumo: input.novoContato.resumo,
        }] : [];

        // Salvar data de início da cobrança (YYYY-MM-DD) para rastrear quando a cobrança foi startada
        const today = new Date().toISOString().split('T')[0];
        await db.insert(collectionActions).values({
          receivableId: input.receivableId,
          status: input.status || "pendente",
          promessaData: input.promessaData || null,
          promessaValor: input.promessaValor !== null && input.promessaValor !== undefined ? String(input.promessaValor) : null,
          lembreteData: input.lembreteData || null,
          observacoes: input.observacoes || null,
          contatoHistorico: hist,
          cobrancaStartedAt: today,
        });
      }

      return { success: true };
    }),

  /**
   * Deletar ação de cobrança (resetar título)
   * PROTEÇÃO ABSOLUTA: Não permite deletar se já houver ações diárias registradas
   * ou bolinhas manuais ticadas. Cobranças realizadas NUNCA podem ser desmarcadas.
   */
  deleteCollectionAction: publicProcedure
    .input(z.object({ receivableId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      // Verificar se há ações diárias registradas
      const dailyActions = await db.select({ id: collectionDailyActions.id })
        .from(collectionDailyActions)
        .where(eq(collectionDailyActions.receivableId, input.receivableId))
        .limit(1);
      if (dailyActions.length > 0) {
        throw new Error('Não é possível resetar: já existem ações de cobrança registradas para este título.');
      }

      // Verificar se há bolinhas manuais ticadas
      const ticks = await db.select({ id: collectionManualTicks.id })
        .from(collectionManualTicks)
        .where(and(
          eq(collectionManualTicks.receivableId, input.receivableId),
          eq(collectionManualTicks.ticked, true)
        ))
        .limit(1);
      if (ticks.length > 0) {
        throw new Error('Não é possível resetar: já existem bolinhas de roteiro marcadas para este título.');
      }

      await db.delete(collectionActions).where(eq(collectionActions.receivableId, input.receivableId));
      return { success: true };
    }),

  /**
   * Get auth completion status for today.
   * Returns whether the "Autorização Concluída" checkbox was checked today.
   */
  getAuthCompletionStatus: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { completed: false, completedBy: null };

      const todayBR = getTodayBR();
      const rows = await db
        .select()
        .from(authCompletion)
        .where(eq(authCompletion.date, todayBR))
        .limit(1);

      if (rows.length > 0 && rows[0].completed) {
        return { completed: true, completedBy: rows[0].completedBy || null };
      }
      return { completed: false, completedBy: null };
    }),

  /**
   * Set auth completion for today.
   * Requires password "Fernando" or "Bruno" to mark as completed.
   */
  setAuthCompletion: publicProcedure
    .input(z.object({
      password: z.string(),
      completed: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      // Validate password
      const AUTH_PASSWORDS = ["Fernando", "Bruno"];
      if (!AUTH_PASSWORDS.includes(input.password)) {
        return { success: false, error: "Senha incorreta" };
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const todayBR = getTodayBR();

      const existing = await db
        .select()
        .from(authCompletion)
        .where(eq(authCompletion.date, todayBR))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(authCompletion)
          .set({
            completed: input.completed,
            completedBy: input.completed ? input.password : null,
            completedAt: input.completed ? new Date() : null,
          })
          .where(eq(authCompletion.date, todayBR));
      } else {
        await db.insert(authCompletion).values({
          date: todayBR,
          completed: input.completed,
          completedBy: input.completed ? input.password : null,
          completedAt: input.completed ? new Date() : null,
        });
      }

      return { success: true };
    }),

  // ========== COBRANÇA PREVENTIVA ==========
  // REGRAS:
  // - Cobrança nos dias 1, 3 e 5 após vencimento (NÃO todos os dias)
  // - Responsável pela cobrança: pessoa designada (não o vendedor)
  // - Telefone vibra nos dias 1/3/5 e NÃO PARA até que ação seja registrada
  // - Histórico registra tudo: ações feitas E não feitas
  // - Dia 7: protesto automático → cartório | não protestar → documento profissional para vendedor
  // - Documento fica visível no card de inadimplência para todos

  /**
   * Dias de cobrança obrigatória após vencimento
   */
  // COLLECTION_DAYS = [1, 3, 5]

  /**
   * Buscar ações diárias de cobrança para um título
   */
  getCollectionHistory: publicProcedure
    .input(z.object({ receivableId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const actions = await db
        .select()
        .from(collectionDailyActions)
        .where(eq(collectionDailyActions.receivableId, input.receivableId))
        .orderBy(desc(collectionDailyActions.createdAt));
      return actions;
    }),

  /**
   * Checklist do roteiro de cobrança (7 dias)
   * Calcula o progresso de cada dia baseado nas ações registradas.
   * Dias de ação: 1, 3, 5 (devem ter registro manual).
   * Dias de espera: 2, 4 (verdes se dia anterior foi cumprido).
   * Dia 6: preparação. Dia 7+: decisão de protesto.
   * Se um dia de ação não foi cumprido, ele e todos os dias seguintes ficam vermelhos (cascata).
   */
  getCollectionChecklist: publicProcedure
    .input(z.object({ receivableId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { steps: [], startDate: null };

      // Buscar o título
      const [rec] = await db.select().from(accountsReceivable).where(eq(accountsReceivable.id, input.receivableId)).limit(1);
      if (!rec) return { steps: [], startDate: null };

      // Buscar ação de cobrança (para cobrancaStartedAt)
      const [action] = await db.select().from(collectionActions).where(eq(collectionActions.receivableId, input.receivableId)).limit(1);
      const startDate = action?.cobrancaStartedAt || null;

      // Buscar todas as ações diárias
      const dailyActions = await db
        .select()
        .from(collectionDailyActions)
        .where(eq(collectionDailyActions.receivableId, input.receivableId))
        .orderBy(collectionDailyActions.actionDate);

      // Buscar ticks manuais para sobrescrever status
      const manualTicks = await db
        .select()
        .from(collectionManualTicks)
        .where(eq(collectionManualTicks.receivableId, input.receivableId));
      const tickMap: Record<number, { ticked: boolean; tickStatus: string | null }> = {};
      for (const t of manualTicks) {
        tickMap[t.step] = { ticked: !!t.ticked, tickStatus: t.tickStatus };
      }

      // Calcular data de vencimento e hoje
      const vencDate = (rec.vencimentoData || "").split("T")[0];
      const now = new Date();
      const brNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const todayStr = brNow.toISOString().split("T")[0];
      const diasAtrasoRaw = Math.floor((new Date(todayStr).getTime() - new Date(vencDate).getTime()) / 86400000);
      // Dias úteis de atraso (exclui fds e feriados)
      const businessDaysOverdueLocal = diasAtrasoRaw > 0 ? countBusinessDays(vencDate, todayStr) : 0;
      const diasAtraso = businessDaysOverdueLocal; // usar dias úteis para exibição

      // Data de início do sistema de cobrança
      const SISTEMA_COBRANCA_INICIO = "2026-04-16";

      // Verificar se é um título "legado":
      // 1) Já estava vencido há 2+ dias quando o sistema começou (dia1 original < início do sistema)
      // 2) OU tem 2+ dias úteis de atraso e ainda NÃO teve primeiro contato registrado
      //    → Esses entram como "aguardando primeiro contato" com bolinhas zeradas e sem telefone
      const dia1Original = new Date(new Date(vencDate).getTime() + 1 * 86400000).toISOString().split("T")[0];
      const isOriginalLegacy = dia1Original < SISTEMA_COBRANCA_INICIO;
      const is2PlusDaysNoStart = businessDaysOverdueLocal >= 2 && !startDate;
      const isLegacyTitle = isOriginalLegacy || is2PlusDaysNoStart;

      // Para títulos legados: roteiro deslocado a partir da data de início do sistema
      // Em vez de contar a partir do vencimento, conta a partir de 16/04/2026
      const roteiroNormal = [
        { dia: 1, label: "Dia 1 — WhatsApp + E-mail", tipo: "acao", descricao: "Enviar WhatsApp e e-mail formal de cobrança" },
        { dia: 2, label: "Dia 2 — Intervalo", tipo: "espera", descricao: "Dia de espera. Verificar se cliente respondeu" },
        { dia: 3, label: "Dia 3 — Ligação + E-mail", tipo: "acao", descricao: "Fazer ligação telefônica e enviar e-mail" },
        { dia: 4, label: "Dia 4 — Intervalo", tipo: "espera", descricao: "Dia de espera. Verificar promessas de pagamento" },
        { dia: 5, label: "Dia 5 — Ligação + E-mail (Último)", tipo: "acao", descricao: "Ligação e e-mail FINAL com aviso de protesto" },
        { dia: 6, label: "Dia 6 — Preparação", tipo: "espera", descricao: "Revisar histórico e preparar documentação" },
        { dia: 7, label: "Dia 7+ — Decisão de Protesto", tipo: "decisao", descricao: "Decisão: Com Protesto (Cartório) ou Não Protestar" },
      ];

      const roteiroDeslocado = [
        { dia: 1, label: "1º Dia de Cobrança — WhatsApp + E-mail", tipo: "acao", descricao: "Enviar WhatsApp e e-mail formal de cobrança" },
        { dia: 2, label: "Intervalo", tipo: "espera", descricao: "Dia de espera. Verificar se cliente respondeu" },
        { dia: 3, label: "2º Dia de Cobrança — Ligação + E-mail", tipo: "acao", descricao: "Fazer ligação telefônica e enviar e-mail" },
        { dia: 4, label: "Intervalo", tipo: "espera", descricao: "Dia de espera. Verificar promessas de pagamento" },
        { dia: 5, label: "3º Dia de Cobrança — Ligação + E-mail (Último)", tipo: "acao", descricao: "Ligação e e-mail FINAL com aviso de protesto" },
        { dia: 6, label: "Intervalo", tipo: "espera", descricao: "Revisar histórico e preparar documentação" },
        { dia: 7, label: "Decisão de Protesto", tipo: "decisao", descricao: "Protesto ou carta de aviso para o vendedor" },
      ];

      const roteiro = isLegacyTitle ? roteiroDeslocado : roteiroNormal;

      // Para títulos legados: base de cálculo é a data do PRIMEIRO CONTATO (cobrancaStartedAt)
      // Se ainda não houve contato, não há roteiro ativo (todos os steps ficam como 'futuro')
      // Para títulos normais: base de cálculo é a data de vencimento
      const legacyStartDate = startDate || null; // cobrancaStartedAt = data do primeiro contato
      const legacyHasStarted = isLegacyTitle && !!legacyStartDate;
      const legacyNotStarted = isLegacyTitle && !legacyHasStarted;

      // Base para cálculo de dias úteis:
      // Para títulos legados com start: base = dia anterior ao primeiro contato (para que dia 1 = primeiro contato)
      // Para títulos legados sem start (original): base = dia anterior ao início do sistema
      // Para títulos 2+ dias sem start: base = dia anterior a hoje (roteiro começará quando fizer 1º contato)
      // Para títulos normais: base = data de vencimento (dia 1 = 1 dia útil após vencimento)
      // Regra de base para cálculo do roteiro:
      // 1. Título com 2+ dias úteis de atraso E com startDate: base = dia anterior ao primeiro contato
      // 2. Título legado original com start: base = dia anterior ao primeiro contato
      // 3. Título legado original sem start: base = dia anterior ao início do sistema
      // 4. Título 2+ dias sem start: base = dia anterior a hoje (roteiro começará quando fizer 1º contato)
      // 5. Título normal (1 dia): base = data de vencimento
      const baseDateStr = (businessDaysOverdueLocal >= 2 && startDate)
        ? addDaysStr(startDate, -1)
        : isLegacyTitle
          ? (legacyHasStarted
              ? addDaysStr(legacyStartDate!, -1)
              : (isOriginalLegacy
                  ? addDaysStr(SISTEMA_COBRANCA_INICIO, -1)
                  : addDaysStr(todayStr, -1)))
          : vencDate;

      // Pré-calcular as datas de cada step usando DIAS ÚTEIS
      // step.dia indica quantos dias úteis após a base
      const stepDates: Record<number, string> = {};
      for (const step of roteiro) {
        stepDates[step.dia] = addBusinessDaysStr(baseDateStr, step.dia);
      }

      // Mapear ações por data
      const actionsByDate: Record<string, typeof dailyActions> = {};
      for (const a of dailyActions) {
        if (!actionsByDate[a.actionDate]) actionsByDate[a.actionDate] = [];
        actionsByDate[a.actionDate].push(a);
      }

      let hasCascadeError = false;

      const steps = roteiro.map(step => {
        // Data do step calculada com DIAS ÚTEIS (pula sábado, domingo e feriados)
        const stepDate = stepDates[step.dia];
        const isFuture = stepDate > todayStr;
        const isToday = stepDate === todayStr;
        const isBeforeSystemStart = stepDate < SISTEMA_COBRANCA_INICIO;
        const actionsOnDay = actionsByDate[stepDate] || [];
        const manualActions = actionsOnDay.filter(a => !a.isAutomatic && a.actionType !== "sem_contato");
        const autoSemContato = actionsOnDay.filter(a => a.actionType === "sem_contato");

        let status: "verde" | "vermelho" | "pendente" | "futuro" | "dispensado" | "neutro" = "futuro";
        let motivo = "";
        let acoes: Array<{ tipo: string; notas: string; operador: string; hora: string }> = [];

        // Títulos legados sem primeiro contato: todos os steps ficam como 'futuro'
        // Isso se aplica tanto a títulos originalmente legados (dia1 < sistema) quanto
        // a títulos com 2+ dias de atraso sem cobrancaStartedAt
        if (legacyNotStarted) {
          status = step.dia === 1 ? "pendente" : "futuro";
          motivo = step.dia === 1
            ? "Aguardando primeiro contato para iniciar o roteiro de cobrança"
            : "Roteiro inicia após o primeiro contato";
          return {
            dia: step.dia,
            label: step.label,
            tipo: step.tipo,
            descricao: step.descricao,
            data: stepDate,
            status,
            motivo,
            acoes,
            isToday: false,
            isFuture: true,
          };
        }

        // Mapear ações realizadas
        for (const a of actionsOnDay) {
          acoes.push({
            tipo: a.actionType,
            notas: a.notes || "",
            operador: a.operatorName,
            hora: a.createdAt ? new Date(a.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "",
          });
        }

        // Dias anteriores ao início do sistema: dispensados (sem falha, sem cascata)
        if (isBeforeSystemStart && !isFuture) {
          status = "dispensado";
          if (manualActions.length > 0) {
            motivo = `Dispensado (sistema iniciou em 16/04) — ação registrada retroativamente`;
          } else {
            motivo = `Dispensado — sistema de cobrança iniciou em 16/04/2026`;
          }
          // NÃO ativa cascata de erro para dias dispensados
        } else if (isFuture) {
          status = "futuro";
          motivo = "Dia ainda não chegou";
        } else if (hasCascadeError) {
          // Cascata: se um dia anterior falhou, este também é vermelho
          status = "vermelho";
          if (step.tipo === "acao" && manualActions.length > 0) {
            // Ação foi feita mas está em cascata de erro
            motivo = "Ação realizada, mas roteiro comprometido por falha anterior";
          } else if (step.tipo === "espera") {
            motivo = "Roteiro comprometido por falha em dia anterior";
          } else {
            motivo = step.tipo === "acao" ? "Nenhuma ação registrada (roteiro já comprometido)" : "Roteiro comprometido por falha anterior";
          }
        } else if (step.tipo === "acao") {
          // Dia de ação: precisa ter pelo menos 1 ação manual
          if (manualActions.length > 0) {
            status = "verde";
            motivo = `Ação realizada: ${manualActions.map(a => {
              const labels: Record<string, string> = { ligacao: "Ligação", whatsapp: "WhatsApp", email: "E-mail", visita: "Visita" };
              return labels[a.actionType] || a.actionType;
            }).join(", ")}`;
          } else if (isToday) {
            status = "pendente";
            motivo = "Ação pendente para hoje";
          } else {
            // Dia passou sem ação → vermelho + cascata
            status = "vermelho";
            hasCascadeError = true;
            if (autoSemContato.length > 0) {
              motivo = "NENHUMA AÇÃO registrada (marcado automaticamente como sem contato)";
            } else {
              motivo = "NENHUMA AÇÃO registrada neste dia";
            }
          }
        } else if (step.tipo === "espera") {
          // Dia de espera: só fica verde quando o dia já PASSOU
          if (isToday) {
            status = "pendente";
            motivo = "Dia de espera (aguardando próximo dia de ação)";
          } else {
            status = "verde";
            motivo = "Dia de espera cumprido";
          }
        } else if (step.tipo === "decisao") {
          // Dia 7+: verificar se há decisão
          if (isToday || isFuture) {
            status = diasAtraso >= 7 ? "pendente" : "futuro";
            motivo = diasAtraso >= 7 ? "Decisão de protesto pendente" : "Dia ainda não chegou";
          } else {
            // Verificar se há documento/decisão
            status = "verde";
            motivo = "Dia de decisão alcançado";
          }
        }

        // Sobrescrever status com tick manual se existir (admin override)
        const tick = tickMap[step.dia];
        if (tick && tick.ticked) {
          if (tick.tickStatus === 'green' && status !== 'verde' && status !== 'dispensado') {
            status = 'verde';
            motivo = manualActions.length > 0
              ? `Ação registrada corretamente`
              : `Marcado como concluído manualmente`;
          } else if (tick.tickStatus === 'red' && status !== 'vermelho') {
            status = 'vermelho';
            motivo = 'NENHUMA AÇÃO registrada neste dia';
          } else if (tick.tickStatus === 'blue') {
            status = 'neutro';
            motivo = 'Marcado como neutro (limpo) manualmente';
          }
        } else if (tick && !tick.ticked && (status === 'verde' || status === 'vermelho')) {
          // Admin limpou o tick — reverter para cálculo automático (já está correto)
        }

        return {
          dia: step.dia,
          label: step.label,
          tipo: step.tipo,
          descricao: step.descricao,
          data: stepDate,
          status,
          motivo,
          acoes,
          isToday,
          isFuture,
        };
      });

      return {
        steps,
        startDate,
        vencimento: vencDate,
        diasAtraso,
        cliente: rec.cliente || "",
        valorAReceber: Number(rec.valorLiquido) - Number(rec.valorRecebidoLiquido),
        isLegacyTitle,
        legacyNotStarted,
        sistemaCobrancaInicio: SISTEMA_COBRANCA_INICIO,
      };
    }),

  /**
   * Buscar ações de hoje para múltiplos títulos (batch)
   * Usado para determinar quais telefones devem piscar
   * REGRA: telefone vibra APENAS nos dias 1, 3 e 5 após vencimento
   * e NÃO PARA até que ação seja registrada
   */
  getTodayActions: publicProcedure
    .input(z.object({ receivableIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db || input.receivableIds.length === 0) return {};
      const now = new Date();
      const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const todayStr = brDate.toISOString().split('T')[0];
      const actions = await db
        .select()
        .from(collectionDailyActions)
        .where(
          and(
            inArray(collectionDailyActions.receivableId, input.receivableIds),
            eq(collectionDailyActions.actionDate, todayStr),
            eq(collectionDailyActions.isAutomatic, false)
          )
        );
      // Retorna os tipos de ação registrados hoje para cada título
      const map: Record<number, string[]> = {};
      for (const a of actions) {
        if (!map[a.receivableId]) map[a.receivableId] = [];
        if (!map[a.receivableId].includes(a.actionType)) {
          map[a.receivableId].push(a.actionType);
        }
      }
      return map;
    }),

  /**
   * Buscar ações pendentes de dias anteriores (1, 3, 5) que não foram realizadas
   * O telefone continua vibrando até que TODAS as ações pendentes sejam resolvidas
   */
  getPendingCollectionActions: publicProcedure
    .input(z.object({ receivableIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db || input.receivableIds.length === 0) return {};
      const now = new Date();
      const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const todayStr = brDate.toISOString().split('T')[0];

      // Para cada receivableId, verificar se há dias de cobrança (1,3,5) pendentes
      const COLLECTION_DAYS = [1, 3, 5];
      const result: Record<number, { pendingDays: number[]; hasPendingAction: boolean }> = {};

      // Buscar todos os receivables para calcular dias de atraso
      const receivables = await db
        .select({ id: accountsReceivable.id, vencimentoData: accountsReceivable.vencimentoData })
        .from(accountsReceivable)
        .where(inArray(accountsReceivable.id, input.receivableIds));

      // Buscar todas as ações manuais desses receivables
      const allActions = await db
        .select()
        .from(collectionDailyActions)
        .where(
          and(
            inArray(collectionDailyActions.receivableId, input.receivableIds),
            eq(collectionDailyActions.isAutomatic, false)
          )
        );

      // Ações obrigatórias por dia de cobrança (conforme guia)
      const REQUIRED_ACTIONS_BY_DAY: Record<number, string[]> = {
        1: ["whatsapp", "email"],
        3: ["ligacao", "email"],
        5: ["ligacao", "email"],
      };

      // Agrupar ações por receivableId e data, com tipos de ação
      const actionsByRecId: Record<number, Set<string>> = {};
      const actionTypesByRecIdDate: Record<string, Set<string>> = {};
      for (const a of allActions) {
        if (!actionsByRecId[a.receivableId]) actionsByRecId[a.receivableId] = new Set();
        actionsByRecId[a.receivableId].add(a.actionDate);
        const key = `${a.receivableId}_${a.actionDate}`;
        if (!actionTypesByRecIdDate[key]) actionTypesByRecIdDate[key] = new Set();
        actionTypesByRecIdDate[key].add(a.actionType);
      }

      const SISTEMA_COBRANCA_INICIO_PENDING = '2026-04-16';

      for (const rec of receivables) {
        if (!rec.vencimentoData) continue;
        const vencStr = (rec.vencimentoData as string).split('T')[0];
        const diasAtrasoRaw = Math.floor((brDate.getTime() - new Date(vencStr + 'T12:00:00').getTime()) / 86400000);
        if (diasAtrasoRaw < 1) continue;

        // Dias úteis de atraso
        const businessDaysOverdue = countBusinessDays(vencStr, todayStr);

        // Título legado: dia1 útil original < início do sistema → NÃO vibra
        const dia1Str = addBusinessDaysStr(vencStr, 1);
        if (dia1Str < SISTEMA_COBRANCA_INICIO_PENDING) continue;

        // Títulos com 0 dias úteis de atraso (vencimento em fds/feriado): não vibra
        if (businessDaysOverdue < 1) continue;

        // Títulos com 2+ dias úteis de atraso: NUNCA vibra o telefone
        // Regra absoluta: independente de já terem sido contatados ou não
        if (businessDaysOverdue >= 2) continue;

        const pendingDays: number[] = [];
        const actionDates = actionsByRecId[rec.id] || new Set();

        for (const day of COLLECTION_DAYS) {
          // Usar dias úteis para verificar se o dia de cobrança já chegou
          if (businessDaysOverdue >= day) {
            // Calcular a data exata do dia de cobrança usando DIAS ÚTEIS
            const collDateStr = addBusinessDaysStr(vencStr, day);
            // Verificar se TODAS as ações obrigatórias do dia foram registradas
            const requiredActions = REQUIRED_ACTIONS_BY_DAY[day] || [];
            if (requiredActions.length > 0) {
              // Verificar se todas as ações obrigatórias foram feitas nesse dia ou posterior
              let allRequiredDone = true;
              for (const reqAction of requiredActions) {
                let found = false;
                // Verificar nesse dia e em dias posteriores até hoje
                const actionDatesArr = Array.from(actionDates);
                for (const aDate of actionDatesArr) {
                  if (aDate >= collDateStr) {
                    const key = `${rec.id}_${aDate}`;
                    const typesOnDate = actionTypesByRecIdDate[key];
                    if (typesOnDate && typesOnDate.has(reqAction)) {
                      found = true;
                      break;
                    }
                  }
                }
                if (!found) {
                  allRequiredDone = false;
                  break;
                }
              }
              if (!allRequiredDone) {
                pendingDays.push(day);
              }
            } else {
              // Dia sem regra específica: qualquer ação basta
              let hasAction = false;
              const actionDatesArr = Array.from(actionDates);
              for (let ai = 0; ai < actionDatesArr.length; ai++) {
                if (actionDatesArr[ai] >= collDateStr) {
                  hasAction = true;
                  break;
                }
              }
              if (!hasAction) {
                pendingDays.push(day);
              }
            }
          }
        }

        if (pendingDays.length > 0) {
          result[rec.id] = { pendingDays, hasPendingAction: true };
        }
      }

      return result;
    }),

  /**
   * Registrar ação de cobrança (pela pessoa responsável pela cobrança)
   */
  registerCollectionAction: publicProcedure
    .input(z.object({
      receivableId: z.number(),
      actionTypes: z.array(z.enum(["ligacao", "whatsapp", "email", "visita", "outro"])).min(1),
      operatorName: z.string(),
      notes: z.string().optional(),
      actionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD - permite registro retroativo (Guilherme/Thiago)
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const now = new Date();
      const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const todayStr = brDate.toISOString().split('T')[0];
      const dateToUse = input.actionDate || todayStr;
      // Registrar cada tipo de ação separadamente
      for (const actionType of input.actionTypes) {
        await db.insert(collectionDailyActions).values({
          receivableId: input.receivableId,
          actionDate: dateToUse,
          actionType,
          operatorName: input.operatorName,
          notes: input.notes || null,
          isAutomatic: false,
        });
      }
      // Atualizar ou criar collectionAction
      const existing = await db
        .select()
        .from(collectionActions)
        .where(eq(collectionActions.receivableId, input.receivableId));
      if (existing.length > 0) {
        // Atualizar status para "contatado" e definir cobrancaStartedAt se ainda não tinha
        const updates: Record<string, any> = { status: "contatado", updatedBy: input.operatorName };
        if (!existing[0].cobrancaStartedAt) {
          updates.cobrancaStartedAt = dateToUse;
        }
        await db
          .update(collectionActions)
          .set(updates)
          .where(eq(collectionActions.receivableId, input.receivableId));
      } else {
        // Primeiro contato: criar collectionAction com cobrancaStartedAt = data da ação
        await db.insert(collectionActions).values({
          receivableId: input.receivableId,
          status: "contatado",
          cobrancaStartedAt: dateToUse,
          updatedBy: input.operatorName,
        });
      }
      return { success: true };
    }),

  /**
   * Buscar configuração de protesto para múltiplos títulos (batch)
   */
  getProtestConfigs: publicProcedure
    .input(z.object({ receivableIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db || input.receivableIds.length === 0) return {};
      const configs = await db
        .select()
        .from(receivableProtestConfig)
        .where(inArray(receivableProtestConfig.receivableId, input.receivableIds));
      const map: Record<number, typeof configs[0]> = {};
      for (const c of configs) {
        map[c.receivableId] = c;
      }
      return map;
    }),

  /**
   * Salvar configuração de protesto para um título
   */
  setProtestConfig: publicProcedure
    .input(z.object({
      receivableId: z.number(),
      protestType: z.enum(["automatico", "nao_protestar"]),
      operatorName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const existing = await db
        .select()
        .from(receivableProtestConfig)
        .where(eq(receivableProtestConfig.receivableId, input.receivableId));
      if (existing.length > 0) {
        await db
          .update(receivableProtestConfig)
          .set({ protestType: input.protestType, updatedBy: input.operatorName })
          .where(eq(receivableProtestConfig.receivableId, input.receivableId));
      } else {
        await db.insert(receivableProtestConfig).values({
          receivableId: input.receivableId,
          protestType: input.protestType,
          updatedBy: input.operatorName,
        });
      }
      return { success: true };
    }),

  /**
   * Salvar plano de ação obrigatório (dia 7+ para clientes "não protestar")
   */
  saveActionPlan: publicProcedure
    .input(z.object({
      receivableId: z.number(),
      actionPlan: z.string().min(1),
      deadlineDate: z.string(),
      operatorName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const existing = await db
        .select()
        .from(receivableProtestConfig)
        .where(eq(receivableProtestConfig.receivableId, input.receivableId));
      if (existing.length > 0) {
        await db
          .update(receivableProtestConfig)
          .set({
            actionPlan: input.actionPlan,
            deadlineDate: input.deadlineDate,
            actionPlanBy: input.operatorName,
            actionPlanAt: new Date(),
            updatedBy: input.operatorName,
          })
          .where(eq(receivableProtestConfig.receivableId, input.receivableId));
      } else {
        await db.insert(receivableProtestConfig).values({
          receivableId: input.receivableId,
          protestType: "nao_protestar",
          actionPlan: input.actionPlan,
          deadlineDate: input.deadlineDate,
          actionPlanBy: input.operatorName,
          actionPlanAt: new Date(),
          updatedBy: input.operatorName,
        });
      }
      const now = new Date();
      const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const todayStr = brDate.toISOString().split('T')[0];
      await db.insert(collectionDailyActions).values({
        receivableId: input.receivableId,
        actionDate: todayStr,
        actionType: "outro",
        operatorName: input.operatorName,
        notes: `Plano de ação: ${input.actionPlan} | Prazo: ${input.deadlineDate}`,
        isAutomatic: false,
      });
      return { success: true };
    }),

  /**
   * Buscar documentos de cobrança gerados (para exibir no card de inadimplência)
   */
  getCollectionDocuments: publicProcedure
    .input(z.object({ receivableIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db || input.receivableIds.length === 0) return {};
      const docs = await db
        .select()
        .from(collectionDocuments)
        .where(inArray(collectionDocuments.receivableId, input.receivableIds))
        .orderBy(desc(collectionDocuments.createdAt));
      const map: Record<number, typeof docs[0]> = {};
      for (const d of docs) {
        if (!map[d.receivableId]) map[d.receivableId] = d;
      }
      return map;
    }),

  /**
   * Buscar documento de cobrança individual (para visualização detalhada)
   */
  getCollectionDocument: publicProcedure
    .input(z.object({ receivableId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const docs = await db
        .select()
        .from(collectionDocuments)
        .where(eq(collectionDocuments.receivableId, input.receivableId))
        .orderBy(desc(collectionDocuments.createdAt))
        .limit(1);
      return docs[0] || null;
    }),

  /**
   * Marcar documento como visualizado pelo vendedor
   */
  markDocumentViewed: publicProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(collectionDocuments)
        .set({ visualizadoPorVendedor: true, visualizadoEm: new Date() })
        .where(eq(collectionDocuments.id, input.documentId));
      return { success: true };
    }),

  /**
   * Gerar documento profissional de cobrança para vendedor
   * Chamado automaticamente no dia 7 para títulos "não protestar"
   * Também pode ser chamado manualmente
   */
  generateCollectionDocument: publicProcedure
    .input(z.object({ receivableId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar dados do título
      const recRows = await db
        .select()
        .from(accountsReceivable)
        .where(eq(accountsReceivable.id, input.receivableId))
        .limit(1);
      if (recRows.length === 0) throw new Error("Título não encontrado");
      const rec = recRows[0];

      // Buscar vendedor
      const vendedorMap = await fetchVendedorMapFromGraphQL();
      const vendedor = vendedorMap[rec.cliente || ""] || "Não identificado";

      // Calcular dias de atraso (dias úteis)
      const now = new Date();
      const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const vencStr = (rec.vencimentoData || "").split('T')[0];
      const todayStrDoc = brDate.toISOString().split('T')[0];
      const diasAtrasoRawDoc = Math.floor((brDate.getTime() - new Date(vencStr + 'T12:00:00').getTime()) / 86400000);
      const diasAtraso = diasAtrasoRawDoc > 0 ? countBusinessDays(vencStr, todayStrDoc) : 0;

      // Buscar histórico de ações de cobrança
      const history = await db
        .select()
        .from(collectionDailyActions)
        .where(eq(collectionDailyActions.receivableId, input.receivableId))
        .orderBy(asc(collectionDailyActions.actionDate));

      // Montar resumo das ações realizadas nos dias 1, 3, 5
      const COLLECTION_DAYS = [1, 3, 5];
      const acoesSumario: Array<{ dia: number; data: string; tipo: string; realizada: boolean; notas?: string }> = [];

      for (const day of COLLECTION_DAYS) {
        // Usar dias úteis para calcular data do step
        const collDateStr = addBusinessDaysStr(vencStr, day);

        // Buscar ação manual nesse dia
        const action = history.find(h => h.actionDate === collDateStr && !h.isAutomatic);
        if (action) {
          acoesSumario.push({
            dia: day,
            data: collDateStr,
            tipo: action.actionType,
            realizada: true,
            notas: action.notes || undefined,
          });
        } else {
          acoesSumario.push({
            dia: day,
            data: collDateStr,
            tipo: "sem_contato",
            realizada: false,
          });
        }
      }

      const valorAReceber = (Number(rec.valorLiquido) || 0) - (Number(rec.valorRecebidoLiquido) || 0);
      const todayFormatted = brDate.toLocaleDateString('pt-BR');
      const vencFormatted = new Date(vencStr + 'T12:00:00').toLocaleDateString('pt-BR');
      const valorFormatted = valorAReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      // Gerar texto do documento profissional
      const tipoAcaoMap: Record<string, string> = {
        ligacao: "Ligação telefônica",
        whatsapp: "Mensagem via WhatsApp",
        email: "E-mail de cobrança",
        visita: "Visita presencial",
        outro: "Outra forma de contato",
        sem_contato: "NENHUMA AÇÃO REALIZADA",
      };

      let acoesTexto = "";
      for (const acao of acoesSumario) {
        const dataFormatted = new Date(acao.data + 'T12:00:00').toLocaleDateString('pt-BR');
        const statusIcon = acao.realizada ? "✅" : "❌";
        acoesTexto += `   ${statusIcon} Dia ${acao.dia} (${dataFormatted}): ${tipoAcaoMap[acao.tipo] || acao.tipo}`;
        if (acao.notas) acoesTexto += ` — ${acao.notas}`;
        acoesTexto += "\n";
      }

      const documentoTexto = `
══════════════════════════════════════════════════════════
              DOCUMENTO PARA TOMADA DE DECISÃO
     Acompanhamento de Inadimplência e Próximos Passos
══════════════════════════════════════════════════════════

Data de emissão: ${todayFormatted}
Documento gerado automaticamente pelo Sistema Grupo Fox

──────────────────────────────────────────────────────────
                      DADOS DO TÍTULO
──────────────────────────────────────────────────────────

  Cliente:           ${rec.cliente || "Não identificado"}
  Referência:        ${rec.referenteA || "—"}
  Documento:         ${rec.documentoVinculadoNumero || "—"}
  Valor em aberto:   ${valorFormatted}
  Data de vencimento: ${vencFormatted}
  Dias em atraso:    ${diasAtraso} dias

──────────────────────────────────────────────────────────
               VENDEDOR(A) RESPONSÁVEL
──────────────────────────────────────────────────────────

  Sr(a). ${vendedor}

──────────────────────────────────────────────────────────
            RESPONSÁVEL PELA COBRANÇA: Thiago
──────────────────────────────────────────────────────────
  Responsável pelas ações de cobrança nos dias 1, 3 e 5

  RÉGUA DE COBRANÇA (canais formais por dia):
  • Dia 1: WhatsApp + E-mail (registro formal da cobrança)
  • Dia 3: Ligação telefônica + E-mail (2º contato)
  • Dia 5: Ligação telefônica + E-mail (último contato, aviso de protesto)

──────────────────────────────────────────────────────────
          HISTÓRICO DE AÇÕES DE COBRANÇA REALIZADAS
──────────────────────────────────────────────────────────

${acoesTexto}
──────────────────────────────────────────────────────────
    COMUNICADO AO VENDEDOR — DEFINIÇÃO DE PRÓXIMOS PASSOS
──────────────────────────────────────────────────────────

  Prezado(a) Sr(a). ${vendedor},

  Por meio deste documento, informamos que o cliente acima
  mencionado, que está sob sua responsabilidade comercial,
  encontra-se INADIMPLENTE há ${diasAtraso} dias.

  Conforme o protocolo interno de cobrança da empresa, a
  opção selecionada para este cliente foi "NÃO PROTESTAR
  AUTOMATICAMENTE", o que significa que o título NÃO será
  encaminhado a cartório para protesto.

  Informamos que todas as ações de cobrança previstas no
  protocolo foram executadas conforme a régua de cobrança:
  • Dia 1: WhatsApp + E-mail (registro formal da cobrança)
  • Dia 3: Ligação telefônica + E-mail (2º contato)
  • Dia 5: Ligação telefônica + E-mail (último contato)
  Todas as ações foram registradas formalmente no sistema.

  Apesar dos esforços realizados, o cliente não efetuou o
  pagamento do valor em aberto de ${valorFormatted}.

  SOLICITAMOS QUE DEFINA O PRÓXIMO PASSO PARA ESTE CLIENTE:
  • Manter a cobrança ativa (o responsável continuará as tentativas)
  • Negociar diretamente com o cliente
  • Encaminhar para protesto manual
  • Outra ação que julgar necessária

  Este documento ficará registrado no sistema e visível
  para toda a equipe como comprovante de que o processo
  de cobrança foi conduzido corretamente e que a definição
  dos próximos passos cabe ao vendedor responsável.

──────────────────────────────────────────────────────────
              ASSINATURA DIGITAL DO SISTEMA
──────────────────────────────────────────────────────────

  Gerado automaticamente em: ${todayFormatted}
  Sistema: Grupo Fox - Dashboard de Gestão
  Protocolo: DOC-COB-${input.receivableId}-${brDate.toISOString().split('T')[0].replace(/-/g, '')}

══════════════════════════════════════════════════════════
`.trim();

      // Gerar PDF profissional
      const protocolo = `DOC-COB-${input.receivableId}-${brDate.toISOString().split('T')[0].replace(/-/g, '')}`;
      let pdfUrl: string | null = null;
      try {
        const pdfBuffer = await generateCollectionPdf({
          cliente: rec.cliente || "Não identificado",
          vendedor,
          responsavelCobranca: "Thiago",
          valorTitulo: valorAReceber,
          vencimentoData: vencStr,
          diasAtraso,
          documento: rec.documentoVinculadoNumero || null,
          referenteA: rec.referenteA || null,
          acoesCobanca: acoesSumario,
          protocolo,
          dataEmissao: todayFormatted,
        });
        const fileKey = `collection-docs/${protocolo}-${Date.now()}.pdf`;
        const uploaded = await storagePut(fileKey, pdfBuffer, "application/pdf");
        pdfUrl = uploaded.url;
        console.log(`[Collection] PDF generated and uploaded: ${pdfUrl}`);
      } catch (pdfErr) {
        console.error("[Collection] Failed to generate PDF:", pdfErr);
      }

      // Verificar se já existe documento para este título
      const existingDoc = await db
        .select()
        .from(collectionDocuments)
        .where(eq(collectionDocuments.receivableId, input.receivableId))
        .limit(1);

      if (existingDoc.length > 0) {
        // Atualizar documento existente (sem criar nova notificação)
        await db
          .update(collectionDocuments)
          .set({
            documentoTexto,
            diasAtraso,
            acoesCobanca: acoesSumario,
            pdfUrl: pdfUrl || existingDoc[0].pdfUrl,
            visualizadoPorVendedor: false,
            visualizadoEm: null,
          })
          .where(eq(collectionDocuments.id, existingDoc[0].id));
      } else {
        // Criar novo documento
        await db.insert(collectionDocuments).values({
          receivableId: input.receivableId,
          cliente: rec.cliente || "Não identificado",
          vendedor,
          valorTitulo: String(valorAReceber),
          vencimentoData: vencStr,
          diasAtraso,
          documento: rec.documentoVinculadoNumero || null,
          acoesCobanca: acoesSumario,
          documentoTexto,
          pdfUrl,
          geradoPor: "Sistema",
        });

        // Criar notificação APENAS para documentos novos (não quando atualiza)
        try {
          const { createNotification } = await import("./notificationRouter");
          await createNotification({
            type: "cobranca_documento",
            title: `⚠️ Documento de Cobrança - ${rec.cliente}`,
            message: `Sr(a). ${vendedor}, um documento para tomada de decisão foi gerado para o cliente ${rec.cliente}. Valor: ${valorFormatted}, ${diasAtraso} dias em atraso. Todas as ações de cobrança foram realizadas por Thiago. Solicitamos que defina o próximo passo.`,
            severity: "warning",
            metadata: {
              receivableId: input.receivableId,
              cliente: rec.cliente,
              vendedor,
              valor: valorAReceber,
              diasAtraso,
              documentoProtocolo: `DOC-COB-${input.receivableId}-${brDate.toISOString().split('T')[0].replace(/-/g, '')}`,
            },
          });
        } catch (err) {
          console.error("[Collection] Failed to create notification:", err);
        }
      }

      // Registrar no histórico
      const todayStr = brDate.toISOString().split('T')[0];
      await db.insert(collectionDailyActions).values({
        receivableId: input.receivableId,
        actionDate: todayStr,
        actionType: "outro",
        operatorName: "Sistema",
        notes: `Documento para tomada de decisão gerado para vendedor ${vendedor} - cobranças realizadas por Thiago`,
        isAutomatic: true,
      });

      return { success: true, vendedor, documentoTexto, pdfUrl };
    }),

  /**
   * Job diário de cobrança:
   * 1. Registrar "sem_contato" para dias de cobrança (1, 3, 5) sem ação
   * 2. Dia 7+: protesto automático → status "protestado" | não protestar → gerar documento
   * Chamado via cron ou manualmente.
   */
  runDailyCollectionJob: publicProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const now = new Date();
      const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const todayStr = brDate.toISOString().split('T')[0];
      const COLLECTION_DAYS = [1, 3, 5];

      // Buscar todos os títulos vencidos (EMITIDO)
      const overdueReceivables = await db
        .select()
        .from(accountsReceivable)
        .where(
          and(
            eq(accountsReceivable.estado, "EMITIDO"),
            inArray(accountsReceivable.tipo as any, RECEIVABLE_VALID_TYPES)
          )
        );

      let semContatoCount = 0;
      let protestadoCount = 0;
      let documentoCount = 0;

      // Buscar vendedor map uma vez
      const vendedorMap = await fetchVendedorMapFromGraphQL();

      for (const rec of overdueReceivables) {
        if (!rec.vencimentoData) continue;
        const vencStr = (rec.vencimentoData as string).split('T')[0];
        const diasAtrasoCalendar = Math.floor((brDate.getTime() - new Date(vencStr + 'T12:00:00').getTime()) / 86400000);
        if (diasAtrasoCalendar < 1) continue;

        // Dias úteis de atraso (com feriados)
        const businessDaysOverdue = countBusinessDays(vencStr, todayStr);
        const diasAtrasoRaw = businessDaysOverdue; // usar dias úteis para exibição

        // Verificar dias de cobrança que já passaram e registrar sem_contato se necessário
        for (const day of COLLECTION_DAYS) {
          if (businessDaysOverdue >= day) {
            // Calcular data do dia de cobrança usando DIAS ÚTEIS
            const collDateStr = addBusinessDaysStr(vencStr, day);

            // Verificar se teve ação manual nesse dia
            const manualActions = await db
              .select()
              .from(collectionDailyActions)
              .where(
                and(
                  eq(collectionDailyActions.receivableId, rec.id),
                  eq(collectionDailyActions.actionDate, collDateStr),
                  eq(collectionDailyActions.isAutomatic, false)
                )
              );

            // Verificar se já tem registro automático
            const autoActions = await db
              .select()
              .from(collectionDailyActions)
              .where(
                and(
                  eq(collectionDailyActions.receivableId, rec.id),
                  eq(collectionDailyActions.actionDate, collDateStr),
                  eq(collectionDailyActions.isAutomatic, true)
                )
              );

            // Se não teve ação manual E não tem registro automático, registrar sem_contato
            if (manualActions.length === 0 && autoActions.length === 0 && collDateStr < todayStr) {
              await db.insert(collectionDailyActions).values({
                receivableId: rec.id,
                actionDate: collDateStr,
                actionType: "sem_contato",
                operatorName: "Sistema",
                notes: `Dia ${day} de cobrança: nenhuma ação registrada`,
                isAutomatic: true,
              });
              semContatoCount++;
            }
          }
        }

        // Dia 7+: verificar protesto (7 dias úteis)
        if (businessDaysOverdue >= 7) {
          const config = await db
            .select()
            .from(receivableProtestConfig)
            .where(eq(receivableProtestConfig.receivableId, rec.id));

          const isAutoProtest = config.length === 0 || config[0].protestType === "automatico";

          if (isAutoProtest) {
            // PROTESTO AUTOMÁTICO → cartório
            const existingAction = await db
              .select()
              .from(collectionActions)
              .where(eq(collectionActions.receivableId, rec.id));
            if (existingAction.length > 0 && existingAction[0].status !== "protestado") {
              await db
                .update(collectionActions)
                .set({ status: "protestado", updatedBy: "Sistema" })
                .where(eq(collectionActions.receivableId, rec.id));
              protestadoCount++;
            } else if (existingAction.length === 0) {
              await db.insert(collectionActions).values({
                receivableId: rec.id,
                status: "protestado",
                updatedBy: "Sistema",
              });
              protestadoCount++;
            }
          } else {
            // NÃO PROTESTAR → verificar se já tem documento gerado
            const existingDoc = await db
              .select()
              .from(collectionDocuments)
              .where(eq(collectionDocuments.receivableId, rec.id))
              .limit(1);

            if (existingDoc.length === 0) {
              // Gerar documento profissional
              const vendedor = vendedorMap[rec.cliente || ""] || "Não identificado";
              const valorAReceber = (Number(rec.valorLiquido) || 0) - (Number(rec.valorRecebidoLiquido) || 0);

              // Buscar histórico
              const history = await db
                .select()
                .from(collectionDailyActions)
                .where(eq(collectionDailyActions.receivableId, rec.id))
                .orderBy(asc(collectionDailyActions.actionDate));

              const acoesSumario: Array<{ dia: number; data: string; tipo: string; realizada: boolean; notas?: string }> = [];
              for (const day of COLLECTION_DAYS) {
                // Usar dias úteis para calcular data do step
                const collDateStr = addBusinessDaysStr(vencStr, day);
                const action = history.find(h => h.actionDate === collDateStr && !h.isAutomatic);
                acoesSumario.push({
                  dia: day,
                  data: collDateStr,
                  tipo: action ? action.actionType : "sem_contato",
                  realizada: !!action,
                  notas: action?.notes || undefined,
                });
              }

              const todayFormatted = brDate.toLocaleDateString('pt-BR');
              const vencFormatted = new Date(vencStr + 'T12:00:00').toLocaleDateString('pt-BR');
              const valorFormatted = valorAReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

              const tipoAcaoMap: Record<string, string> = {
                ligacao: "Ligação telefônica",
                whatsapp: "Mensagem via WhatsApp",
                email: "E-mail de cobrança",
                visita: "Visita presencial",
                outro: "Outra forma de contato",
                sem_contato: "NENHUMA AÇÃO REALIZADA",
              };

              let acoesTexto = "";
              for (const acao of acoesSumario) {
                const dataFormatted = new Date(acao.data + 'T12:00:00').toLocaleDateString('pt-BR');
                const statusIcon = acao.realizada ? "✅" : "❌";
                acoesTexto += `   ${statusIcon} Dia ${acao.dia} (${dataFormatted}): ${tipoAcaoMap[acao.tipo] || acao.tipo}`;
                if (acao.notas) acoesTexto += ` — ${acao.notas}`;
                acoesTexto += "\n";
              }

              const documentoTexto = `
══════════════════════════════════════════════════════════
              DOCUMENTO PARA TOMADA DE DECISÃO
     Acompanhamento de Inadimplência e Próximos Passos
══════════════════════════════════════════════════════════

Data de emissão: ${todayFormatted}
Documento gerado automaticamente pelo Sistema Grupo Fox

──────────────────────────────────────────────────────────
                      DADOS DO TÍTULO
──────────────────────────────────────────────────────────

  Cliente:           ${rec.cliente || "Não identificado"}
  Referência:        ${rec.referenteA || "—"}
  Documento:         ${rec.documentoVinculadoNumero || "—"}
  Valor em aberto:   ${valorFormatted}
  Data de vencimento: ${vencFormatted}
  Dias em atraso:    ${diasAtrasoRaw} dias

──────────────────────────────────────────────────────────
               VENDEDOR(A) RESPONSÁVEL
──────────────────────────────────────────────────────────

  Sr(a). ${vendedor}

──────────────────────────────────────────────────────────
            RESPONSÁVEL PELA COBRANÇA: Thiago
──────────────────────────────────────────────────────────
  Responsável pelas ações de cobrança nos dias 1, 3 e 5

  RÉGUA DE COBRANÇA (canais formais por dia):
  • Dia 1: WhatsApp + E-mail (registro formal da cobrança)
  • Dia 3: Ligação telefônica + E-mail (2º contato)
  • Dia 5: Ligação telefônica + E-mail (último contato, aviso de protesto)

──────────────────────────────────────────────────────────
          HISTÓRICO DE AÇÕES DE COBRANÇA REALIZADAS
──────────────────────────────────────────────────────────

${acoesTexto}
──────────────────────────────────────────────────────────
    COMUNICADO AO VENDEDOR — DEFINIÇÃO DE PRÓXIMOS PASSOS
──────────────────────────────────────────────────────────

  Prezado(a) Sr(a). ${vendedor},

  Por meio deste documento, informamos que o cliente acima
  mencionado, que está sob sua responsabilidade comercial,
  encontra-se INADIMPLENTE há ${diasAtrasoRaw} dias.

  Conforme o protocolo interno de cobrança da empresa, a
  opção selecionada para este cliente foi "NÃO PROTESTAR
  AUTOMATICAMENTE", o que significa que o título NÃO será
  encaminhado a cartório para protesto.

  Informamos que todas as ações de cobrança previstas no
  protocolo foram executadas conforme a régua de cobrança:
  • Dia 1: WhatsApp + E-mail (registro formal da cobrança)
  • Dia 3: Ligação telefônica + E-mail (2º contato)
  • Dia 5: Ligação telefônica + E-mail (último contato)
  Todas as ações foram registradas formalmente no sistema.

  Apesar dos esforços realizados, o cliente não efetuou o
  pagamento do valor em aberto de ${valorFormatted}.

  SOLICITAMOS QUE DEFINA O PRÓXIMO PASSO PARA ESTE CLIENTE:
  • Manter a cobrança ativa (o responsável continuará as tentativas)
  • Negociar diretamente com o cliente
  • Encaminhar para protesto manual
  • Outra ação que julgar necessária

  Este documento ficará registrado no sistema e visível
  para toda a equipe como comprovante de que o processo
  de cobrança foi conduzido corretamente e que a definição
  dos próximos passos cabe ao vendedor responsável.

──────────────────────────────────────────────────────────
              ASSINATURA DIGITAL DO SISTEMA
──────────────────────────────────────────────────────────

  Gerado automaticamente em: ${todayFormatted}
  Sistema: Grupo Fox - Dashboard de Gestão
  Protocolo: DOC-COB-${rec.id}-${brDate.toISOString().split('T')[0].replace(/-/g, '')}

══════════════════════════════════════════════════════════
`.trim();

              // Gerar PDF profissional
              const protocolo = `DOC-COB-${rec.id}-${brDate.toISOString().split('T')[0].replace(/-/g, '')}`;
              let pdfUrl: string | null = null;
              try {
                const pdfBuffer = await generateCollectionPdf({
                  cliente: rec.cliente || "Não identificado",
                  vendedor,
                  responsavelCobranca: "Thiago",
                  valorTitulo: valorAReceber,
                  vencimentoData: vencStr,
                  diasAtraso: diasAtrasoRaw,
                  documento: rec.documentoVinculadoNumero || null,
                  referenteA: rec.referenteA || null,
                  acoesCobanca: acoesSumario,
                  protocolo,
                  dataEmissao: todayFormatted,
                });
                const fileKey = `collection-docs/${protocolo}-${Date.now()}.pdf`;
                const uploaded = await storagePut(fileKey, pdfBuffer, "application/pdf");
                pdfUrl = uploaded.url;
                console.log(`[DailyJob] PDF generated: ${pdfUrl}`);
              } catch (pdfErr) {
                console.error("[DailyJob] Failed to generate PDF:", pdfErr);
              }

              await db.insert(collectionDocuments).values({
                receivableId: rec.id,
                cliente: rec.cliente || "Não identificado",
                vendedor,
                valorTitulo: String(valorAReceber),
                vencimentoData: vencStr,
                diasAtraso: diasAtrasoRaw,
                documento: rec.documentoVinculadoNumero || null,
                acoesCobanca: acoesSumario,
                documentoTexto,
                pdfUrl,
                geradoPor: "Sistema",
              });

              // Criar notificação para o vendedor
              try {
                const { createNotification } = await import("./notificationRouter");
                await createNotification({
                  type: "cobranca_documento",
                  title: `⚠️ Documento de Cobrança - ${rec.cliente}`,
                  message: `Sr(a). ${vendedor}, um documento para tomada de decisão foi gerado para o cliente ${rec.cliente}. Valor: ${valorFormatted}, ${diasAtrasoRaw} dias em atraso. Cobranças realizadas por Thiago. Solicitamos que defina o próximo passo.`,
                  severity: "warning",
                  metadata: {
                    receivableId: rec.id,
                    cliente: rec.cliente,
                    vendedor,
                    valor: valorAReceber,
                    diasAtraso: diasAtrasoRaw,
                  },
                });
              } catch (err) {
                console.error("[Collection Job] Failed to create notification:", err);
              }

              documentoCount++;
            }
          }
        }
      }

      // === NOTIFICAÇÕES DE COBRANÇA para Thiago, Flavio, Guilherme e Thalita ===
      // Alertar sobre títulos que precisam de cobrança hoje (regra 1,3,5 dias)
      const COBRANCA_RULE_START = "2026-04-16";
      const alertTitles: Array<{ cliente: string; diasAtraso: number; valor: number; receivableId: number }> = [];

      for (const rec of overdueReceivables) {
        if (!rec.vencimentoData) continue;
        const vencStr = (rec.vencimentoData as string).split('T')[0];
        const diasAtrasoCalendar2 = Math.floor((brDate.getTime() - new Date(vencStr + 'T12:00:00').getTime()) / 86400000);
        if (diasAtrasoCalendar2 < 1) continue;

        // Dias úteis de atraso (com feriados)
        const businessDaysOverdue2 = countBusinessDays(vencStr, todayStr);
        const diasAtrasoRaw2 = businessDaysOverdue2; // usar dias úteis

        // Verificar se segue a régua de vibração
        const existingAction = await db
          .select()
          .from(collectionActions)
          .where(eq(collectionActions.receivableId, rec.id))
          .limit(1);
        const startedAt = existingAction.length > 0 ? existingAction[0].cobrancaStartedAt : null;

        // Só alerta se: (1) tem cobrancaStartedAt >= data de corte, OU (2) 1 dia útil de atraso sem cobrança
        const followsRule = (startedAt && startedAt >= COBRANCA_RULE_START) || (!existingAction.length && businessDaysOverdue2 === 1);
        if (!followsRule) continue;

        // Verificar se hoje é dia de cobrança (1, 3 ou 5 dias úteis)
        const isCollDay = COLLECTION_DAYS.includes(businessDaysOverdue2);
        if (!isCollDay) continue;

        // Verificar se já teve ação hoje
        const todayActions = await db
          .select()
          .from(collectionDailyActions)
          .where(
            and(
              eq(collectionDailyActions.receivableId, rec.id),
              eq(collectionDailyActions.actionDate, todayStr),
              eq(collectionDailyActions.isAutomatic, false)
            )
          );
        if (todayActions.length > 0) continue;

        const valorAReceber2 = (Number(rec.valorLiquido) || 0) - (Number(rec.valorRecebidoLiquido) || 0);
        if (valorAReceber2 > 0) {
          alertTitles.push({
            cliente: rec.cliente || "Sem nome",
            diasAtraso: diasAtrasoRaw2,
            valor: valorAReceber2,
            receivableId: rec.id,
          });
        }
      }

      // Criar notificação consolidada se houver títulos pendentes
      if (alertTitles.length > 0) {
        const totalValor = alertTitles.reduce((sum, t) => sum + t.valor, 0);
        const valorFormatted2 = totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const clientesList = alertTitles.slice(0, 10).map(t => 
          `\u2022 ${t.cliente} (Dia ${t.diasAtraso}, ${t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`
        ).join('\n');
        const moreText = alertTitles.length > 10 ? `\n... e mais ${alertTitles.length - 10} títulos` : '';

        try {
          const { createNotification } = await import("./notificationRouter");
          await createNotification({
            type: "cobranca_alerta",
            title: `\ud83d\udea8 COBRAN\u00c7A: ${alertTitles.length} título(s) precisam de a\u00e7\u00e3o hoje!`,
            message: `Thiago, Flavio, Guilherme e Thalita: ${alertTitles.length} título(s) estão no dia de cobrança hoje (total: ${valorFormatted2}).\n\n${clientesList}${moreText}\n\nAcesse a aba Inadimplência para registrar as ações de cobrança.`,
            severity: "warning",
            metadata: {
              alertDate: todayStr,
              totalTitles: alertTitles.length,
              totalValor,
              titles: alertTitles.slice(0, 20),
              destinatarios: ["Thiago", "Flavio", "Guilherme", "Thalita"],
            },
          });
          console.log(`[DailyJob] Cobranca alert created for ${alertTitles.length} titles`);
        } catch (err) {
          console.error("[DailyJob] Failed to create cobranca alert:", err);
        }
      }

      return { success: true, semContatoCount, protestadoCount, documentoCount, alertCount: alertTitles.length };
    }),

  /**
   * Salvar snapshot financeiro do dia atual
   */
  saveSnapshot: publicProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      const result = await saveFinancialSnapshot(input?.date);
      return result;
    }),

  /**
   * Detectar mudanças entre dois snapshots
   */
  detectChanges: publicProcedure
    .input(z.object({
      previousDate: z.string(),
      currentDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await detectFinancialChanges(input.previousDate, input.currentDate);
      return result;
    }),

  /**
   * Buscar histórico de mudanças financeiras
   */
  getChanges: publicProcedure
    .input(z.object({
      tipo: z.enum(["pagar", "receber"]),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      semanaLabel: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return getFinancialChanges(input.tipo, input.fromDate, input.toDate, input.semanaLabel);
    }),

  /**
   * Listar datas de snapshots disponíveis
   */
  getSnapshotDates: publicProcedure.query(async () => {
    return getSnapshotDates();
  }),

  /**
   * Listar títulos resolvidos (pagos) que tinham cobrança registrada.
   * Para o card "Pagos/Resolvidos" na aba Inadimplência.
   */
  getResolvedTitles: publicProcedure
    .input(z.object({
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { titles: [], stats: { total: 0, count: 0, valorTotal: 0 } };

      const rows = await db.select()
        .from(resolvedReceivables)
        .orderBy(desc(resolvedReceivables.resolvedAt))
        .limit(input?.limit || 50);

      // Filtrar clientes de teste
      const TEST_CLIENT_NAMES = ['CLIENTE TESTE REGRA', 'CLIENTE MANUAL TICK TEST', 'CLIENTE LEGACY VIBRATION TEST', 'CLIENTE RECENT VIBRATION TEST', 'CLIENTE TESTE COBRANCA'];
      const filteredRows = rows.filter(row => !TEST_CLIENT_NAMES.includes((row.cliente || '').toUpperCase().trim()));

      // REGRA: Só considerar como "recuperado da inadimplência" se o título tinha 3+ dias úteis de atraso.
      // Antes de 3 dias úteis, pode ser apenas falta de conciliação bancária (não era inadimplência real).
      // Threshold configurável: Fernando pode pedir para mudar.
      const RECUPERACAO_THRESHOLD_DAYS = 3;
      const qualifiedRows = filteredRows.filter(row => (row.diasAtrasoNaResolucao || 0) >= RECUPERACAO_THRESHOLD_DAYS);

      let valorTotal = 0;
      const titles = qualifiedRows.map(row => {
        const valor = Number(row.valorAReceber) || 0;
        valorTotal += valor;
        return {
          id: row.id,
          cliente: row.cliente,
          valorAReceber: valor,
          valorOriginal: Number(row.valorOriginal) || 0,
          vencimento: (row.vencimentoData || "").split("T")[0],
          documento: row.documento || "",
          empresa: row.empresa || "",
          vendedor: row.vendedor || "",
          diasAtrasoNaResolucao: row.diasAtrasoNaResolucao,
          statusCobranca: row.statusCobranca || "pendente",
          totalContatos: row.totalContatos,
          resolvedAt: row.resolvedAt?.toISOString() || "",
        };
      });

      return {
        titles,
        stats: { total: titles.length, count: titles.length, valorTotal },
      };
    }),

  /**
   * Contraprova Maxiprod - Consulta valores em tempo real da API GraphQL
   * SOMENTE LEITURA - jamais altera dados no Maxiprod
   * Retorna o valor do Maxiprod para comparação com o valor da Manus
   * Cache em memória com TTL de 5 minutos para evitar re-consultas repetidas
   */
  getMaxiprodContraprova: publicProcedure
    .input(z.object({
      section: z.enum(["faturamento", "vendas", "entradas", "contas_pagas", "recebiveis", "inadimplencia", "contas_receber_mes", "contas_pagar_mes", "a_faturar", "amostra_bonif", "vendas_faturado"]),
      startDate: z.string(),
      endDate: z.string(),
      // Filtros opcionais para seção "recebiveis" (filtra por empresa + conta bancária)
      empresaNome: z.string().optional(),
      bancoNome: z.string().optional(),
      contaNumero: z.string().optional(),
      // Filtros de status e forma de cobrança (usados na seção "recebiveis")
      statusFilter: z.enum(["TODOS", "VENCIDO", "A_VENCER"]).optional(),
      formaFilter: z.enum(["TODOS", "PIX", "Boleto", "Cheque", "Depósito", "Dinheiro"]).optional(),
    }))
    .query(async ({ input }) => {
      try {
        const { section, startDate, endDate, empresaNome, bancoNome, contaNumero, statusFilter, formaFilter } = input;

        // Cache em memória com TTL de 5 minutos (inclui filtros de empresa/conta/status/forma)
        const cacheKey = `${section}:${startDate}:${endDate}:${empresaNome || ''}:${bancoNome || ''}:${contaNumero || ''}:${statusFilter || ''}:${formaFilter || ''}`;
        const cached = contraprovaCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CONTRAPROVA_CACHE_TTL) {
          console.log(`[getMaxiprodContraprova] Cache hit: ${cacheKey}`);
          return cached.data;
        }

        // Helper para salvar no cache e retornar
        const cacheAndReturn = (data: { valorMaxiprod: number; count: number; label: string }) => {
          contraprovaCache.set(cacheKey, { data, timestamp: Date.now() });
          return data;
        };

        if (section === "faturamento") {
          const result = await fetchInvoicesTotal(startDate, endDate);
          return cacheAndReturn({
            valorMaxiprod: result.total,
            count: result.count,
            label: `${result.count} NFs de Saída (Emitidas, excluindo Amostra/Bonificação/Devolução/etc)`,
          });
        }

        if (section === "entradas") {
          const result = await fetchReceivedAccountsTotal(startDate, endDate);
          return cacheAndReturn({
            valorMaxiprod: result.total,
            count: result.count,
            label: `${result.count} lançamentos (Vendas/Revenda: ${result.vendasRevenda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, Demais: ${result.demaisReceitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`,
          });
        }

        if (section === "contas_pagas") {
          const result = await fetchPaidAccountsTotal(startDate, endDate);
          return cacheAndReturn({
            valorMaxiprod: result.total,
            count: result.count,
            label: `${result.count} contas pagas (liquidação no período)`,
          });
        }

        if (section === "vendas") {
          // Vendas: usa MESMA lógica do getSalesVsPaid (agrupamento por pedido + valorTotalPedido)
          const db = await getDb();
          if (!db) return { valorMaxiprod: 0, count: 0, label: "Banco indisponível" };

          const startDay = startDate.substring(0, 10);
          const endDay = endDate.substring(0, 10);
          const allItems = await db.select().from(salesOrders)
            .where(and(
              sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) >= ${startDay}`,
              sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) <= ${endDay}`
            ));

          const estadoToGrupo = (estado: string | null): string => {
            if (!estado) return "outros";
            const e = estado.toUpperCase();
            if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
            if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
            if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
            return "outros";
          };

          const isDigitacao = (nota: string | null) => {
            if (!nota) return false;
            const n = nota.toUpperCase();
            return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
          };

          const filtered = allItems.filter(item => !isDigitacao(item.estadoNota) && estadoToGrupo(item.estadoConfiguravel) !== "outros");

          // Mesma lógica de agrupamento por pedido do getSalesVsPaid
          const uniqueOrders = new Set(filtered.map(i => i.pedido).filter(Boolean));
          const pedidoValueMap = new Map<string, number>();
          for (const item of filtered) {
            const pedido = item.pedido || 'sem-pedido';
            if (!pedidoValueMap.has(pedido)) {
              if (item.valorTotalPedido) {
                pedidoValueMap.set(pedido, Number(item.valorTotalPedido));
              } else {
                pedidoValueMap.set(pedido, Number(item.valorTotal || 0));
              }
            } else {
              const firstItemHasVTP = filtered.find(i => i.pedido === pedido && i.valorTotalPedido);
              if (!firstItemHasVTP) {
                pedidoValueMap.set(pedido, (pedidoValueMap.get(pedido) || 0) + Number(item.valorTotal || 0));
              }
            }
          }
          const totalValue = Array.from(pedidoValueMap.values()).reduce((sum, v) => sum + v, 0);
          const total = Math.round(totalValue * 100) / 100;

          return cacheAndReturn({
            valorMaxiprod: total,
            count: uniqueOrders.size,
            label: `${uniqueOrders.size} pedidos de venda (excluindo Digitação e outros)`,
          });
        }

        // inadimplencia - títulos vencidos a receber (usa cutoffDate = último dia útil antes de hoje)
        if (section === "inadimplencia") {
          const db = await getDb();
          if (!db) return { valorMaxiprod: 0, count: 0, label: "Banco indisponível" };

          const cutoff = getPreviousBusinessDay();
          const result = await db.select({
            total: sql<number>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(15,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, '0') AS DECIMAL(15,2))), 0)`,
            count: sql<number>`COUNT(*)`,
          }).from(accountsReceivable)
            .where(and(
              eq(accountsReceivable.estado, 'EMITIDO'),
              inArray(accountsReceivable.tipo, ['TITULO', 'RECEITA', 'ADIANTAMENTO']),
              lte(accountsReceivable.vencimentoData, cutoff + "T23:59:59"),
            ));

          return cacheAndReturn({
            valorMaxiprod: Number(result[0]?.total || 0),
            count: Number(result[0]?.count || 0),
            label: `${result[0]?.count || 0} títulos vencidos (estado EMITIDO, vencimento até ${cutoff})`,
          });
        }

        // contas_receber_mes - total de contas a receber em um mês específico (estado EMITIDO)
        // REGRA 1: Excluir inadimplentes (vencidos antes do cutoff de conciliação bancária)
        // REGRA 2: Limitar endDate ao mesmo range do getMonthlyBreakdown (10 meses)
        // para alinhar com o dashboard que só mostra 10 meses a partir do corrente
        if (section === "contas_receber_mes") {
          const db = await getDb();
          if (!db) return { valorMaxiprod: 0, count: 0, label: "Banco indisponível" };

          // Mesma lógica do getMonthlyBreakdown: o mês corrente começa no dia seguinte à conciliação
          const cutoff = getPreviousBusinessDay();
          const effectiveStartDate = addDaysStr(cutoff, 1); // dia seguinte à última conciliação

          // Se o startDate solicitado é anterior ao effectiveStartDate (ex: 2020-01-01 para total geral),
          // usar o effectiveStartDate para excluir inadimplentes (vencidos antes da conciliação)
          const adjustedStartDate = startDate < effectiveStartDate ? effectiveStartDate : startDate;

          // REGRA 2: Se endDate é muito distante (ex: 2099-12-31 para "total geral"),
          // limitar ao último dia do 10º mês do getMonthlyBreakdown.
          // O dashboard soma apenas 10 meses (mês corrente + 9 futuros).
          const todayBR = getTodayBR();
          const [curY, curM] = todayBR.split('-').map(Number);
          const lastMonthOfBreakdown = new Date(curY, curM - 1 + 10, 0); // último dia do 10º mês
          const maxEndDate = `${lastMonthOfBreakdown.getFullYear()}-${String(lastMonthOfBreakdown.getMonth() + 1).padStart(2, '0')}-${String(lastMonthOfBreakdown.getDate()).padStart(2, '0')}`;
          const adjustedEndDate = endDate > maxEndDate ? maxEndDate : endDate;

          const result = await db.select({
            total: sql<number>`COALESCE(SUM(CAST(${accountsReceivable.valorLiquido} AS DECIMAL(15,2)) - CAST(COALESCE(${accountsReceivable.valorRecebidoLiquido}, '0') AS DECIMAL(15,2))), 0)`,
            count: sql<number>`COUNT(*)`,
          }).from(accountsReceivable)
            .where(and(
              eq(accountsReceivable.estado, 'EMITIDO'),
              inArray(accountsReceivable.tipo, ['TITULO', 'RECEITA', 'ADIANTAMENTO']),
              gte(accountsReceivable.vencimentoData, adjustedStartDate),
              lte(accountsReceivable.vencimentoData, adjustedEndDate + "T23:59:59"),
            ));

          const inadLabel = startDate < effectiveStartDate ? ` (excl. inadimplentes até ${cutoff})` : '';
          const rangeLabel = endDate > maxEndDate ? ` até ${maxEndDate}` : '';

          return cacheAndReturn({
            valorMaxiprod: Number(result[0]?.total || 0),
            count: Number(result[0]?.count || 0),
            label: `${result[0]?.count || 0} títulos a receber no período${inadLabel}${rangeLabel}`,
          });
        }

        // contas_pagar_mes - total de contas a pagar em um mês específico (estado EMITIDO)
        // REGRA 1: Excluir vencidos antes do cutoff de conciliação bancária
        // REGRA 2: Limitar endDate ao mesmo range do getMonthlyBreakdown (10 meses)
        // para alinhar com o dashboard que só mostra 10 meses a partir do corrente
        if (section === "contas_pagar_mes") {
          const db = await getDb();
          if (!db) return { valorMaxiprod: 0, count: 0, label: "Banco indisponível" };

          // Mesma lógica do getMonthlyBreakdown: o mês corrente começa no dia seguinte à conciliação
          const cutoff = getPreviousBusinessDay();
          const effectiveStartDate = addDaysStr(cutoff, 1); // dia seguinte à última conciliação

          // Se o startDate solicitado é anterior ao effectiveStartDate (ex: 2020-01-01 para total geral),
          // usar o effectiveStartDate para excluir vencidos (contas vencidas antes da conciliação)
          const adjustedStartDate = startDate < effectiveStartDate ? effectiveStartDate : startDate;

          // REGRA 2: Se endDate é muito distante (ex: 2099-12-31 para "total geral"),
          // limitar ao último dia do 10º mês do getMonthlyBreakdown.
          // O dashboard soma apenas 10 meses (mês corrente + 9 futuros).
          const todayBR = getTodayBR();
          const [curY, curM] = todayBR.split('-').map(Number);
          const lastMonthOfBreakdown = new Date(curY, curM - 1 + 10, 0); // último dia do 10º mês
          const maxEndDate = `${lastMonthOfBreakdown.getFullYear()}-${String(lastMonthOfBreakdown.getMonth() + 1).padStart(2, '0')}-${String(lastMonthOfBreakdown.getDate()).padStart(2, '0')}`;
          const adjustedEndDate = endDate > maxEndDate ? maxEndDate : endDate;

          const result = await db.select({
            total: sql<number>`COALESCE(SUM(CAST(${accountsPayable.valorLiquido} AS DECIMAL(15,2)) - CAST(COALESCE(${accountsPayable.valorPagoLiquido}, '0') AS DECIMAL(15,2))), 0)`,
            count: sql<number>`COUNT(*)`,
          }).from(accountsPayable)
            .where(and(
              eq(accountsPayable.estado, 'EMITIDO'),
              gte(accountsPayable.vencimentoData, adjustedStartDate),
              lte(accountsPayable.vencimentoData, adjustedEndDate + "T23:59:59"),
            ));

          const vencLabel = startDate < effectiveStartDate ? ` (excl. vencidos até ${cutoff})` : '';
          const rangeLabel = endDate > maxEndDate ? ` até ${maxEndDate}` : '';

          return cacheAndReturn({
            valorMaxiprod: Number(result[0]?.total || 0),
            count: Number(result[0]?.count || 0),
            label: `${result[0]?.count || 0} contas a pagar no período${vencLabel}${rangeLabel}`,
          });
        }

        // recebiveis - busca do banco local, filtrado por empresa + conta bancária
        if (section === "recebiveis") {
          const db = await getDb();
          if (!db) return { valorMaxiprod: 0, count: 0, label: "Banco indisponível" };

          const conditions = [
            eq(accountsReceivable.estado, 'EMITIDO'),
            inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
            gte(accountsReceivable.vencimentoData, startDate),
            lte(accountsReceivable.vencimentoData, endDate + "T23:59:59"),
          ];

          // Filtrar por empresa (se fornecido)
          if (empresaNome) {
            conditions.push(eq(accountsReceivable.empresaNome, empresaNome));
          }
          // Filtrar por banco (se fornecido)
          if (bancoNome) {
            conditions.push(eq(accountsReceivable.bancoNome, bancoNome));
          }
          // Filtrar por conta bancária (se fornecido)
          if (contaNumero) {
            conditions.push(eq(accountsReceivable.contaNumero, contaNumero));
          }

          // Filtrar por forma de cobrança (se fornecido e não "TODOS")
          if (formaFilter && formaFilter !== "TODOS") {
            // Mapear categoria para prefixo LIKE no banco
            const formaPrefix = formaFilter === "Depósito" ? "DEP" : formaFilter.toUpperCase();
            conditions.push(sql`UPPER(${accountsReceivable.formaCobranca}) LIKE ${formaPrefix + '%'}`);
          }

          // Usar mesma lógica do getReceivablesByBank: valorAReceber = valorLiquido - valorRecebidoLiquido, excluir <= 0
          const rows = await db.select({
            valorLiquido: accountsReceivable.valorLiquido,
            valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
            vencimentoData: accountsReceivable.vencimentoData,
          }).from(accountsReceivable)
            .where(and(...conditions));

          const today = new Date().toISOString().substring(0, 10);
          let total = 0;
          let count = 0;
          for (const row of rows) {
            const valorOriginal = Number(row.valorLiquido) || 0;
            const valorPago = Number(row.valorRecebidoLiquido) || 0;
            const valorAReceber = valorOriginal - valorPago;
            if (valorAReceber > 0) {
              // Aplicar filtro de status (vencido/a_vencer)
              if (statusFilter && statusFilter !== "TODOS") {
                const vencDate = (row.vencimentoData || "").substring(0, 10);
                const isOverdue = vencDate < today;
                if (statusFilter === "VENCIDO" && !isOverdue) continue;
                if (statusFilter === "A_VENCER" && isOverdue) continue;
              }
              total += valorAReceber;
              count++;
            }
          }
          total = Math.round(total * 100) / 100;

          const filterParts: string[] = [];
          if (empresaNome) filterParts.push(empresaNome);
          if (bancoNome) filterParts.push(bancoNome);
          if (contaNumero) filterParts.push(`Cc ${contaNumero}`);
          if (statusFilter && statusFilter !== "TODOS") filterParts.push(statusFilter === "VENCIDO" ? "Vencidos" : "A Vencer");
          if (formaFilter && formaFilter !== "TODOS") filterParts.push(formaFilter);
          const filterLabel = filterParts.length > 0 ? ` (${filterParts.join(' · ')})` : '';

          return cacheAndReturn({
            valorMaxiprod: total,
            count,
            label: `${count} títulos a receber no período${filterLabel}`,
          });
        }

        // a_faturar - pedidos de venda com estado do item "A Faturar"
        if (section === "a_faturar") {
          const db = await getDb();
          if (!db) return { valorMaxiprod: 0, count: 0, label: "Banco indisponível" };

          const startDay = startDate.substring(0, 10);
          const endDay = endDate.substring(0, 10);
          const allItems = await db.select().from(salesOrders)
            .where(and(
              sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) >= ${startDay}`,
              sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) <= ${endDay}`,
              sql`UPPER(${salesOrders.estadoItem}) = 'A FATURAR'`
            ));

          const estadoToGrupo = (estado: string | null): string => {
            if (!estado) return "outros";
            const e = estado.toUpperCase();
            if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
            if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
            if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
            return "outros";
          };

          const isDigitacao = (nota: string | null) => {
            if (!nota) return false;
            const n = nota.toUpperCase();
            return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
          };

          const filtered = allItems.filter(item => !isDigitacao(item.estadoNota) && estadoToGrupo(item.estadoConfiguravel) !== "outros");
          const total = filtered.reduce((sum, item) => sum + Number(item.valorTotal || 0), 0);
          const rounded = Math.round(total * 100) / 100;

          return cacheAndReturn({
            valorMaxiprod: rounded,
            count: filtered.length,
            label: `${filtered.length} itens a faturar no período`,
          });
        }

        // amostra_bonif - pedidos de venda com estado configurável Amostra ou Bonificação
        if (section === "amostra_bonif") {
          const db = await getDb();
          if (!db) return { valorMaxiprod: 0, count: 0, label: "Banco indisponível" };

          const startDay = startDate.substring(0, 10);
          const endDay = endDate.substring(0, 10);
          const allItems = await db.select().from(salesOrders)
            .where(and(
              sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) >= ${startDay}`,
              sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) <= ${endDay}`,
              sql`UPPER(${salesOrders.estadoConfiguravel}) IN ('AMOSTRA', 'BONIFICAÇÃO', 'BONIFICACAO')`
            ));

          const isDigitacao = (nota: string | null) => {
            if (!nota) return false;
            const n = nota.toUpperCase();
            return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
          };

          const filtered = allItems.filter(item => !isDigitacao(item.estadoNota));
          const uniqueOrders = new Set(filtered.map(i => i.pedido).filter(Boolean));
          const total = filtered.reduce((sum, item) => sum + Number(item.valorTotal || 0), 0);
          const rounded = Math.round(total * 100) / 100;

          return cacheAndReturn({
            valorMaxiprod: rounded,
            count: uniqueOrders.size,
            label: `${uniqueOrders.size} pedidos de amostra/bonificação no período`,
          });
        }

        // vendas_faturado - pedidos de venda com estado do item "Faturado" (conceito diferente de NFs de saída)
        if (section === "vendas_faturado") {
          const db = await getDb();
          if (!db) return { valorMaxiprod: 0, count: 0, label: "Banco indisponível" };

          const startDay = startDate.substring(0, 10);
          const endDay = endDate.substring(0, 10);
          const allItems = await db.select().from(salesOrders)
            .where(and(
              sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) >= ${startDay}`,
              sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) <= ${endDay}`,
              sql`UPPER(${salesOrders.estadoItem}) = 'FATURADO'`
            ));

          const estadoToGrupo = (estado: string | null): string => {
            if (!estado) return "outros";
            const e = estado.toUpperCase();
            if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
            if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
            if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
            return "outros";
          };

          const isDigitacao = (nota: string | null) => {
            if (!nota) return false;
            const n = nota.toUpperCase();
            return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
          };

          const filtered = allItems.filter(item => !isDigitacao(item.estadoNota) && estadoToGrupo(item.estadoConfiguravel) !== "outros");
          
          // Agrupamento por pedido (mesma lógica de vendas)
          const uniqueOrders = new Set(filtered.map(i => i.pedido).filter(Boolean));
          const pedidoValueMap = new Map<string, number>();
          for (const item of filtered) {
            const pedido = item.pedido || 'sem-pedido';
            if (!pedidoValueMap.has(pedido)) {
              if (item.valorTotalPedido) {
                pedidoValueMap.set(pedido, Number(item.valorTotalPedido));
              } else {
                pedidoValueMap.set(pedido, Number(item.valorTotal || 0));
              }
            } else {
              const firstItemHasVTP = filtered.find(i => i.pedido === pedido && i.valorTotalPedido);
              if (!firstItemHasVTP) {
                pedidoValueMap.set(pedido, (pedidoValueMap.get(pedido) || 0) + Number(item.valorTotal || 0));
              }
            }
          }
          const totalValue = Array.from(pedidoValueMap.values()).reduce((sum, v) => sum + v, 0);
          const total = Math.round(totalValue * 100) / 100;

          return cacheAndReturn({
            valorMaxiprod: total,
            count: uniqueOrders.size,
            label: `${uniqueOrders.size} pedidos faturados no período (estado do item: Faturado)`,
          });
        }

        return { valorMaxiprod: 0, count: 0, label: "Seção não reconhecida" };
      } catch (error: any) {
        console.error("[getMaxiprodContraprova] Error:", error.message);
        return { valorMaxiprod: 0, count: 0, label: `Erro: ${error.message}` };
      }
    }),

  /**
   * Detalhamento de divergência - Mostra a origem da diferença entre Manus e Maxiprod
   * SOMENTE LEITURA
   */
  getDivergenceDetails: publicProcedure
    .input(z.object({
      section: z.enum(["faturamento", "vendas", "entradas", "contas_pagas"]),
      startDate: z.string(),
      endDate: z.string(),
      valorManus: z.number(),
      valorMaxiprod: z.number(),
    }))
    .query(async ({ input }) => {
      try {
        const { section, startDate, endDate, valorManus, valorMaxiprod } = input;
        const diff = Math.abs(valorManus - valorMaxiprod);
        const diffPercent = valorManus > 0 ? ((diff / valorManus) * 100).toFixed(2) : "0";

        const possibleCauses: string[] = [];
        const details: { item: string; valor: number; motivo: string }[] = [];

        if (section === "vendas") {
          const db = await getDb();
          if (!db) return { diff, diffPercent, possibleCauses: ["Banco indisponível"], details: [] };

          const startDay = startDate.substring(0, 10);
          const endDay = endDate.substring(0, 10);
          const allItems = await db.select().from(salesOrders)
            .where(and(
              sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) >= ${startDay}`,
              sql`SUBSTRING(${salesOrders.dataEmissao}, 1, 10) <= ${endDay}`
            ));

          // Itens excluídos por Digitação
          const digitacaoItems = allItems.filter(i => {
            const n = (i.estadoNota || "").toUpperCase();
            return n === 'DIGITAÇÃO' || n === 'DIGITACAO';
          });
          if (digitacaoItems.length > 0) {
            const totalDig = digitacaoItems.reduce((s, i) => s + Number(i.valorTotal || 0), 0);
            possibleCauses.push(`${digitacaoItems.length} pedidos em Digitação excluídos (R$ ${totalDig.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
            digitacaoItems.slice(0, 10).forEach(i => details.push({
              item: `Pedido ${i.pedido || '?'} - ${(i.cliente || '').substring(0, 40)}`,
              valor: Number(i.valorTotal || 0),
              motivo: `Estado NF: ${i.estadoNota}`,
            }));
          }

          // Itens excluídos por estado "outros"
          const estadoToGrupo = (estado: string | null): string => {
            if (!estado) return "outros";
            const e = estado.toUpperCase();
            if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
            if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
            if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
            return "outros";
          };
          const outrosItems = allItems.filter(i => {
            const n = (i.estadoNota || "").toUpperCase();
            if (n === 'DIGITAÇÃO' || n === 'DIGITACAO') return false;
            return estadoToGrupo(i.estadoConfiguravel) === "outros";
          });
          if (outrosItems.length > 0) {
            const totalOutros = outrosItems.reduce((s, i) => s + Number(i.valorTotal || 0), 0);
            possibleCauses.push(`${outrosItems.length} pedidos com estado "outros" excluídos (R$ ${totalOutros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
            outrosItems.slice(0, 10).forEach(i => details.push({
              item: `Pedido ${i.pedido || '?'} - ${(i.cliente || '').substring(0, 40)}`,
              valor: Number(i.valorTotal || 0),
              motivo: `Estado: ${i.estadoConfiguravel || 'NULL'}`,
            }));
          }

          // Diferença por valorTotalPedido vs valorTotal
          const validItems = allItems.filter(i => {
            const n = (i.estadoNota || "").toUpperCase();
            if (n === 'DIGITAÇÃO' || n === 'DIGITACAO') return false;
            return estadoToGrupo(i.estadoConfiguravel) !== "outros";
          });
          const pedidosComVTP = validItems.filter(i => i.valorTotalPedido);
          if (pedidosComVTP.length > 0) {
            let diffVTP = 0;
            const pedidosSeen = new Set<string>();
            for (const item of pedidosComVTP) {
              const ped = item.pedido || '';
              if (pedidosSeen.has(ped)) continue;
              pedidosSeen.add(ped);
              const vtp = Number(item.valorTotalPedido);
              const itemsOfPedido = validItems.filter(i => i.pedido === ped);
              const sumVT = itemsOfPedido.reduce((s, i) => s + Number(i.valorTotal || 0), 0);
              const pedDiff = Math.abs(vtp - sumVT);
              if (pedDiff > 0.01) {
                diffVTP += pedDiff;
                details.push({
                  item: `Pedido ${ped} - ${(item.cliente || '').substring(0, 40)}`,
                  valor: pedDiff,
                  motivo: `Desconto/frete: Total pedido R$ ${vtp.toFixed(2)} vs soma itens R$ ${sumVT.toFixed(2)}`,
                });
              }
            }
            if (diffVTP > 0.01) {
              possibleCauses.push(`Descontos/fretes em ${pedidosSeen.size} pedidos causam diferença de R$ ${diffVTP.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            }
          }

          if (possibleCauses.length === 0) {
            possibleCauses.push("Diferença pode ser causada por arredondamento ou dados em sincronização");
          }
        } else if (section === "faturamento") {
          possibleCauses.push("Faturamento consulta diretamente a API Maxiprod - diferença pode indicar NFs recém-emitidas ou canceladas");
          possibleCauses.push("Verifique se há NFs com estado Amostra, Bonificação, Devolução, Remessa, Recusa, Transferência ou Cancelado");
        } else if (section === "entradas") {
          possibleCauses.push("Entradas excluem transferências entre empresas do grupo (Palitos Fox, Mesa Indust, Bambusa, Espetos Ind, Varetas)");
          possibleCauses.push("Diferença pode ser causada por recebimentos recém-liquidados ou estornados");
        } else if (section === "contas_pagas") {
          possibleCauses.push("Contas Pagas consulta diretamente a API Maxiprod");
          possibleCauses.push("Diferença pode ser causada por pagamentos recém-liquidados ou cancelados");
        }

        return {
          diff: Math.round(diff * 100) / 100,
          diffPercent,
          possibleCauses,
          details: details.sort((a, b) => b.valor - a.valor).slice(0, 20),
        };
      } catch (error: any) {
        console.error("[getDivergenceDetails] Error:", error.message);
        return { diff: 0, diffPercent: "0", possibleCauses: [`Erro: ${error.message}`], details: [] };
      }
    }),

  /* ============================================================
     Discount Selection History - Histórico de ticagens
     ============================================================ */
  saveDiscountSelection: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      empresa: z.string(),
      contaLabel: z.string(),
      mesKey: z.string(),
      totalTitulos: z.number(),
      valorTotal: z.number(),
      titulosJson: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { discountSelectionHistory, discountAlerts } = await import("../drizzle/schema");
      await db!.insert(discountSelectionHistory).values({
        operatorName: input.operatorName,
        empresa: input.empresa,
        contaLabel: input.contaLabel,
        mesKey: input.mesKey,
        totalTitulos: input.totalTitulos,
        valorTotal: String(input.valorTotal),
        titulosJson: input.titulosJson,
      });
      // Criar alerta para Guilherme/Flávio/Thiago/Thalita
      await db!.insert(discountAlerts).values({
        createdBy: input.operatorName,
        empresa: input.empresa,
        contaLabel: input.contaLabel,
        mesKey: input.mesKey,
        totalTitulos: input.totalTitulos,
        valorTotal: String(input.valorTotal),
      });
      return { success: true };
    }),

  /** Buscar alertas de desconto pendentes para o operador atual */
  getDiscountAlerts: publicProcedure
    .input(z.object({ operatorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { discountAlerts, discountAlertReads } = await import("../drizzle/schema");
      // Buscar todos os alertas
      const alerts = await db.select().from(discountAlerts)
        .orderBy(desc(discountAlerts.createdAt))
        .limit(50);
      // Buscar quais este operador já leu
      const reads = await db.select().from(discountAlertReads)
        .where(eq(discountAlertReads.readBy, input.operatorName));
      const readAlertIds = new Set(reads.map(r => r.alertId));
      return alerts.map(a => ({
        ...a,
        isRead: readAlertIds.has(a.id),
      }));
    }),

  /** Marcar um alerta de desconto como lido pelo operador */
  markDiscountAlertRead: publicProcedure
    .input(z.object({ alertId: z.number(), operatorName: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const { discountAlertReads } = await import("../drizzle/schema");
      // Verificar se já existe
      const [existing] = await db.select().from(discountAlertReads)
        .where(and(
          eq(discountAlertReads.alertId, input.alertId),
          eq(discountAlertReads.readBy, input.operatorName)
        ))
        .limit(1);
      if (!existing) {
        await db.insert(discountAlertReads).values({
          alertId: input.alertId,
          readBy: input.operatorName,
        });
      }
      return { success: true };
    }),

  getDiscountHistory: publicProcedure
    .input(z.object({
      empresa: z.string().optional(),
      contaLabel: z.string().optional(),
      mesKey: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const { discountSelectionHistory } = await import("../drizzle/schema");
      const conditions: any[] = [];
      if (input.empresa) conditions.push(eq(discountSelectionHistory.empresa, input.empresa));
      if (input.contaLabel) conditions.push(eq(discountSelectionHistory.contaLabel, input.contaLabel));
      if (input.mesKey) conditions.push(eq(discountSelectionHistory.mesKey, input.mesKey));

      const rows = await db!.select()
        .from(discountSelectionHistory)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(discountSelectionHistory.createdAt))
        .limit(input.limit);
      return rows;
    }),

  /** Buscar histórico completo de descontos (todos, sem filtro por conta/mês) */
  getDiscountHistoryAll: publicProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      const { discountSelectionHistory } = await import("../drizzle/schema");
      const rows = await db!.select()
        .from(discountSelectionHistory)
        .orderBy(desc(discountSelectionHistory.createdAt))
        .limit(input.limit);
      return rows;
    }),

  /** Buscar um desconto específico por ID */
  getDiscountHistoryById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const { discountSelectionHistory } = await import("../drizzle/schema");
      const [row] = await db!.select()
        .from(discountSelectionHistory)
        .where(eq(discountSelectionHistory.id, input.id))
        .limit(1);
      return row || null;
    }),

  /**
   * Editar uma ação de cobrança diária (tipo de ação e/ou notas).
   * Registra todas as alterações na tabela de auditoria (collection_action_edits).
   */
  editDailyAction: publicProcedure
    .input(z.object({
      dailyActionId: z.number(),
      actionType: z.string().optional(),
      actionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD - permite editar a data da ação
      notes: z.string().optional(),
      operatorName: z.string().optional(), // permite editar o operador
      editedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      // Buscar a ação atual
      const [current] = await db.select().from(collectionDailyActions)
        .where(eq(collectionDailyActions.id, input.dailyActionId))
        .limit(1);

      if (!current) return { success: false, error: "Ação não encontrada" };

      const edits: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

      // Verificar mudanças no tipo de ação
      if (input.actionType !== undefined && input.actionType !== current.actionType) {
        edits.push({
          field: "actionType",
          oldValue: current.actionType,
          newValue: input.actionType,
        });
      }

      // Verificar mudanças na data
      if (input.actionDate !== undefined && input.actionDate !== current.actionDate) {
        edits.push({
          field: "actionDate",
          oldValue: current.actionDate,
          newValue: input.actionDate,
        });
      }

      // Verificar mudanças no operador
      if (input.operatorName !== undefined && input.operatorName !== current.operatorName) {
        edits.push({
          field: "operatorName",
          oldValue: current.operatorName || null,
          newValue: input.operatorName,
        });
      }

      // Verificar mudanças nas notas
      if (input.notes !== undefined && input.notes !== current.notes) {
        edits.push({
          field: "notes",
          oldValue: current.notes || null,
          newValue: input.notes || null,
        });
      }

      if (edits.length === 0) return { success: true, message: "Nenhuma alteração detectada" };

      // Registrar cada alteração na tabela de auditoria
      for (const edit of edits) {
        await db.insert(collectionActionEdits).values({
          dailyActionId: input.dailyActionId,
          receivableId: current.receivableId,
          fieldChanged: edit.field,
          oldValue: edit.oldValue,
          newValue: edit.newValue,
          editedBy: input.editedBy,
        });
      }

      // Aplicar as alterações na ação
      const updates: Record<string, any> = {};
      if (input.actionType !== undefined) updates.actionType = input.actionType;
      if (input.actionDate !== undefined) updates.actionDate = input.actionDate;
      if (input.operatorName !== undefined) updates.operatorName = input.operatorName;
      if (input.notes !== undefined) updates.notes = input.notes;

      await db.update(collectionDailyActions)
        .set(updates)
        .where(eq(collectionDailyActions.id, input.dailyActionId));

      return { success: true, editsCount: edits.length };
    }),

  /**
   * Obter histórico de edições de ações de cobrança para um título.
   */
  getActionEditHistory: publicProcedure
    .input(z.object({
      receivableId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { edits: [] };

      const rows = await db.select().from(collectionActionEdits)
        .where(eq(collectionActionEdits.receivableId, input.receivableId))
        .orderBy(desc(collectionActionEdits.editedAt));

      return { edits: rows };
    }),

  /**
   * Obter ticagens manuais de um título (7 bolinhas)
   */
  getManualTicks: publicProcedure
    .input(z.object({ receivableId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { ticks: [] };
      const rows = await db.select().from(collectionManualTicks)
        .where(eq(collectionManualTicks.receivableId, input.receivableId))
        .orderBy(asc(collectionManualTicks.step));
      return { ticks: rows };
    }),

  /**
   * Obter ticagens manuais em batch (para múltiplos títulos)
   */
  getManualTicksBatch: publicProcedure
    .input(z.object({ receivableIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db || input.receivableIds.length === 0) return {};
      const rows = await db.select().from(collectionManualTicks)
        .where(inArray(collectionManualTicks.receivableId, input.receivableIds))
        .orderBy(asc(collectionManualTicks.step));
      const map: Record<number, typeof rows> = {};
      for (const r of rows) {
        if (!map[r.receivableId]) map[r.receivableId] = [];
        map[r.receivableId].push(r);
      }
      return map;
    }),

  /**
   * Toggle ticagem manual (tick/untick) — 100% MANUAL.
   * Qualquer operador (Thiago, Guilherme, Flavio, Thalita) pode:
   * - Ticar/desticar qualquer step, em qualquer ordem
   * - Escolher qualquer cor (green, red, blue)
   * - Ticar múltiplos steps no mesmo dia
   * Sem restrições de sequência, dia ou cor.
   * Histórico é sempre registrado.
   */
  toggleManualTick: publicProcedure
    .input(z.object({
      receivableId: z.number(),
      step: z.number().min(1).max(7),
      ticked: z.boolean(),
      operatorName: z.string(),
      tickStatus: z.enum(['green', 'red', 'blue']).optional().default('green'),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar tick atual deste step
      const [existing] = await db.select().from(collectionManualTicks)
        .where(and(
          eq(collectionManualTicks.receivableId, input.receivableId),
          eq(collectionManualTicks.step, input.step)
        ))
        .limit(1);

      if (input.ticked) {
        // Upsert: criar ou atualizar
        const now = Date.now();
        if (existing) {
          await db.update(collectionManualTicks)
            .set({ ticked: true, tickedBy: input.operatorName, tickedAt: now, tickStatus: input.tickStatus })
            .where(eq(collectionManualTicks.id, existing.id));
        } else {
          await db.insert(collectionManualTicks).values({
            receivableId: input.receivableId,
            step: input.step,
            ticked: true,
            tickedBy: input.operatorName,
            tickedAt: now,
            tickStatus: input.tickStatus,
          });
        }

        // Registrar no histórico
        await db.insert(collectionManualTickHistory).values({
          receivableId: input.receivableId,
          step: input.step,
          action: input.tickStatus === 'red' ? 'manual_red' : input.tickStatus === 'blue' ? 'manual_blue' : 'tick',
          operatorName: input.operatorName,
          reason: input.tickStatus === 'red' ? 'Marcado como falha manualmente' : input.tickStatus === 'blue' ? 'Marcado como neutro (azul) manualmente' : undefined,
        });
      } else {
        // Untick
        if (existing) {
          await db.update(collectionManualTicks)
            .set({ ticked: false, tickedBy: null, tickedAt: null, tickStatus: 'green' })
            .where(eq(collectionManualTicks.id, existing.id));
        }

        // Registrar no histórico
        await db.insert(collectionManualTickHistory).values({
          receivableId: input.receivableId,
          step: input.step,
          action: "untick",
          operatorName: input.operatorName,
        });
      }

      return { success: true };
    }),

  /**
   * DESABILITADO: Cobrança agora é 100% manual.
   * Não marca mais vermelho automaticamente.
   * Mantido como no-op para não quebrar chamadas do frontend.
   */
  checkOverdueTicks: publicProcedure
    .input(z.object({ receivableIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      // DESABILITADO: cobrança 100% manual (28/04/2026)
      return { updated: 0 };
    }),

  /**
   * DESABILITADO: Cobrança agora é 100% manual.
   * Não sincroniza mais automaticamente bolinhas com checklist.
   * Mantido como no-op para não quebrar chamadas do frontend.
   */
  syncTicksFromChecklist: publicProcedure
    .input(z.object({ receivableIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      // DESABILITADO: cobrança 100% manual (28/04/2026)
      return { synced: 0 };
    }),

  /**
   * Histórico de ticagem manual de um título
   */
  getManualTickHistory: publicProcedure
    .input(z.object({ receivableId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { history: [] };
      const rows = await db.select().from(collectionManualTickHistory)
        .where(eq(collectionManualTickHistory.receivableId, input.receivableId))
        .orderBy(desc(collectionManualTickHistory.createdAt));
      return { history: rows };
    }),

  /**
   * Silenciar/ativar vibração do telefone para um título específico.
   * Qualquer operador pode usar (100% manual).
   */
  togglePhoneMute: publicProcedure
    .input(z.object({
      receivableId: z.number(),
      muted: z.boolean(),
      operatorName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Qualquer operador pode silenciar/ativar vibração (100% manual)

      // Verificar se já existe registro em collection_actions
      const existing = await db.select().from(collectionActions)
        .where(eq(collectionActions.receivableId, input.receivableId))
        .limit(1);

      if (existing.length > 0) {
        await db.update(collectionActions)
          .set({
            phoneMutedBy: input.muted ? input.operatorName : null,
            phoneMutedAt: input.muted ? Date.now() : null,
          })
          .where(eq(collectionActions.receivableId, input.receivableId));
      } else {
        // Criar registro se não existe
        await db.insert(collectionActions).values({
          receivableId: input.receivableId,
          status: 'pendente',
          phoneMutedBy: input.muted ? input.operatorName : null,
          phoneMutedAt: input.muted ? Date.now() : null,
          updatedBy: input.operatorName,
        });
      }

      // Registrar no histórico de ticks
      await db.insert(collectionManualTickHistory).values({
        receivableId: input.receivableId,
        step: 0, // step 0 = ação de mute
        action: input.muted ? 'phone_mute' : 'phone_unmute',
        operatorName: input.operatorName,
        reason: input.muted ? `Vibração silenciada manualmente por ${input.operatorName}` : `Vibração reativada por ${input.operatorName}`,
      });

      return { success: true, muted: input.muted };
    }),

  /**
   * Buscar estado de mute de vibração para múltiplos títulos
   */
  getPhoneMuteStatus: publicProcedure
    .input(z.object({ receivableIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db || input.receivableIds.length === 0) return {};

      const rows = await db.select({
        receivableId: collectionActions.receivableId,
        phoneMutedBy: collectionActions.phoneMutedBy,
        phoneMutedAt: collectionActions.phoneMutedAt,
      })
        .from(collectionActions)
        .where(
          and(
            inArray(collectionActions.receivableId, input.receivableIds),
            isNotNull(collectionActions.phoneMutedBy)
          )
        );

      const result: Record<number, { mutedBy: string; mutedAt: number }> = {};
      for (const row of rows) {
        if (row.phoneMutedBy) {
          result[row.receivableId] = {
            mutedBy: row.phoneMutedBy,
            mutedAt: row.phoneMutedAt || 0,
          };
        }
      }
      return result;
    }),

  /**
   * Importar dados de cobrança de uma planilha XLSX.
   * Recebe os dados parseados no frontend (array de registros).
   * Vincula ao receivable por nome do cliente + vencimento + valor.
   * Só Thiago/Guilherme/Thalita podem usar.
   */
  importCobrancaSpreadsheet: publicProcedure
    .input(z.object({
      operatorName: z.string(),
      records: z.array(z.object({
        dataContato: z.string(), // YYYY-MM-DD
        cliente: z.string(),
        valor: z.number(),
        vencimento: z.string(), // YYYY-MM-DD
        mensagem: z.string(),
        actionTypes: z.array(z.string()),
      })),
    }))
    .mutation(async ({ input }) => {
      const opLower = input.operatorName.toLowerCase().trim();
      if (opLower !== 'thiago' && opLower !== 'guilherme' && opLower !== 'fernando' && opLower !== 'thalita') {
        throw new Error('Apenas Thiago, Guilherme, Fernando ou Thalita podem importar planilhas.');
      }

      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Get all EMITIDO receivables
      const receivables = await db.select({
        id: accountsReceivable.id,
        cliente: accountsReceivable.cliente,
        valorLiquido: accountsReceivable.valorLiquido,
        valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
      }).from(accountsReceivable)
        .where(eq(accountsReceivable.estado, 'EMITIDO'));

      // Get existing collection_actions
      const existingActions = await db.select({
        id: collectionActions.id,
        receivableId: collectionActions.receivableId,
        status: collectionActions.status,
        contatoHistorico: collectionActions.contatoHistorico,
      }).from(collectionActions);
      const existingActionMap = new Map<number, typeof existingActions[0]>();
      for (const a of existingActions) existingActionMap.set(a.receivableId, a);

      // Get existing daily actions
      const existingDaily = await db.select({
        receivableId: collectionDailyActions.receivableId,
        actionDate: collectionDailyActions.actionDate,
        actionType: collectionDailyActions.actionType,
      }).from(collectionDailyActions);
      const existingDailySet = new Set<string>();
      for (const d of existingDaily) existingDailySet.add(`${d.receivableId}_${d.actionDate}_${d.actionType}`);

      // Build lookup by client name
      function normalize(s: string) {
        return (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
      }
      const recByClient: Record<string, typeof receivables> = {};
      for (const r of receivables) {
        const key = normalize(r.cliente || '');
        if (!recByClient[key]) recByClient[key] = [];
        recByClient[key].push(r);
      }

      let matchedCount = 0;
      let insertedActions = 0;
      let insertedDaily = 0;
      let skipped = 0;
      const notFound: string[] = [];

      for (const record of input.records) {
        const clienteNorm = normalize(record.cliente);
        let candidates = recByClient[clienteNorm] || [];

        // Partial match if not found
        if (candidates.length === 0) {
          for (const [key, recs] of Object.entries(recByClient)) {
            if (key.includes(clienteNorm) || clienteNorm.includes(key)) {
              candidates = recs;
              break;
            }
          }
        }

        if (candidates.length === 0) {
          if (!notFound.includes(record.cliente)) notFound.push(record.cliente);
          continue;
        }

        // Match by vencimento + valor
        let matched: typeof receivables[0] | null = null;
        for (const c of candidates) {
          const cVenc = (c.vencimentoData || '').split('T')[0];
          const cValor = parseFloat(String(c.valorLiquido)) || 0;
          const cValorAReceber = cValor - (parseFloat(String(c.valorRecebidoLiquido)) || 0);
          if (cVenc === record.vencimento) {
            if (Math.abs(cValorAReceber - record.valor) < 1 || Math.abs(cValor - record.valor) < 1) {
              matched = c;
              break;
            }
          }
        }
        if (!matched) {
          for (const c of candidates) {
            const cVenc = (c.vencimentoData || '').split('T')[0];
            if (cVenc === record.vencimento) { matched = c; break; }
          }
        }
        if (!matched) {
          for (const c of candidates) {
            const cValor = parseFloat(String(c.valorLiquido)) || 0;
            const cValorAReceber = cValor - (parseFloat(String(c.valorRecebidoLiquido)) || 0);
            if (Math.abs(cValorAReceber - record.valor) < 1 || Math.abs(cValor - record.valor) < 1) {
              matched = c; break;
            }
          }
        }
        if (!matched) matched = candidates[0];

        matchedCount++;
        const receivableId = matched.id;

        // Ensure collection_actions exists
        if (!existingActionMap.has(receivableId)) {
          let status = 'contatado';
          const msgUpper = record.mensagem.toUpperCase();
          if (msgUpper.includes('PROMESSA') || msgUpper.includes('PROMETEU')) status = 'promessa';
          else if (msgUpper.includes('NÃO ATEND') || msgUpper.includes('SEM RETORNO')) status = 'nao_atendeu';

          const contatoHistorico = [{
            data: record.dataContato,
            tipo: record.actionTypes[0] || 'outro',
            resumo: record.mensagem,
            usuario: input.operatorName,
          }];

          await db.insert(collectionActions).values({
            receivableId,
            status,
            observacoes: record.mensagem,
            contatoHistorico,
            cobrancaStartedAt: record.dataContato,
            updatedBy: input.operatorName,
          });
          existingActionMap.set(receivableId, { id: 0, receivableId, status, contatoHistorico });
          insertedActions++;
        } else {
          // Update existing - add to historico
          const existing = existingActionMap.get(receivableId)!;
          const historico = Array.isArray(existing.contatoHistorico) ? [...existing.contatoHistorico] : [];
          const alreadyRecorded = historico.some((h: any) => h.data === record.dataContato && h.resumo === record.mensagem);
          if (!alreadyRecorded) {
            historico.push({
              data: record.dataContato,
              tipo: record.actionTypes[0] || 'outro',
              resumo: record.mensagem,
              usuario: input.operatorName,
            });
            let status = existing.status || 'contatado';
            const msgUpper = record.mensagem.toUpperCase();
            if (msgUpper.includes('PROMESSA') || msgUpper.includes('PROMETEU')) status = 'promessa';

            await db.update(collectionActions)
              .set({ contatoHistorico: historico, status, updatedBy: input.operatorName })
              .where(eq(collectionActions.receivableId, receivableId));
            insertedActions++;
          } else {
            skipped++;
          }
        }

        // Insert daily actions
        for (const actionType of record.actionTypes) {
          const dailyKey = `${receivableId}_${record.dataContato}_${actionType}`;
          if (!existingDailySet.has(dailyKey)) {
            await db.insert(collectionDailyActions).values({
              receivableId,
              actionDate: record.dataContato,
              actionType,
              operatorName: input.operatorName,
              notes: record.mensagem,
              isAutomatic: false,
            });
            existingDailySet.add(dailyKey);
            insertedDaily++;
          } else {
            skipped++;
          }
        }
      }

      return {
        success: true,
        totalRecords: input.records.length,
        matched: matchedCount,
        actionsInserted: insertedActions,
        dailyInserted: insertedDaily,
        skipped,
        notFound,
      };
    }),

  /**
   * Salvar override de texto de um step do roteiro para um título específico.
   * Permite editar descricao e/ou motivo individualmente por título.
   * Sem registro de auditoria — salva direto.
   */
  upsertStepOverride: publicProcedure
    .input(z.object({
      receivableId: z.number(),
      step: z.number().min(1).max(7),
      descricao: z.string().optional(),
      motivo: z.string().optional(),
      dataOverride: z.string().optional(),
      operatorName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      // Buscar override existente
      const [existing] = await db.select().from(collectionStepOverrides)
        .where(and(
          eq(collectionStepOverrides.receivableId, input.receivableId),
          eq(collectionStepOverrides.step, input.step)
        ))
        .limit(1);

      if (existing) {
        const updates: Record<string, any> = { updatedBy: input.operatorName, updatedAt: Date.now() };
        if (input.descricao !== undefined) updates.descricao = input.descricao;
        if (input.motivo !== undefined) updates.motivo = input.motivo;
        if (input.dataOverride !== undefined) updates.dataOverride = input.dataOverride || null;
        await db.update(collectionStepOverrides)
          .set(updates)
          .where(eq(collectionStepOverrides.id, existing.id));
      } else {
        await db.insert(collectionStepOverrides).values({
          receivableId: input.receivableId,
          step: input.step,
          descricao: input.descricao || null,
          motivo: input.motivo || null,
          dataOverride: input.dataOverride || null,
          updatedBy: input.operatorName,
        });
      }

      return { success: true };
    }),

  /**
   * Obter overrides de texto dos steps do roteiro para um título.
   */
  getStepOverrides: publicProcedure
    .input(z.object({ receivableId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { overrides: {} as Record<number, { descricao?: string | null; motivo?: string | null; dataOverride?: string | null }> };

      const rows = await db.select().from(collectionStepOverrides)
        .where(eq(collectionStepOverrides.receivableId, input.receivableId));

      const map: Record<number, { descricao?: string | null; motivo?: string | null; dataOverride?: string | null }> = {};
      for (const r of rows) {
        map[r.step] = { descricao: r.descricao, motivo: r.motivo, dataOverride: r.dataOverride };
      }
      return { overrides: map };
    }),

  // ─── Planilhas (upload/armazenamento sem alterar dados) ───

  /**
   * Upload de planilha — salva no S3 e registra no histórico.
   * NÃO altera nenhum dado de inadimplência.
   */
  uploadSpreadsheet: publicProcedure
    .input(z.object({
      fileName: z.string(),
      fileBase64: z.string(), // base64 encoded file content
      mimeType: z.string().optional(),
      fileSize: z.number().optional(),
      uploadedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      // Decode base64 to buffer
      const buffer = Buffer.from(input.fileBase64, "base64");

      // Generate unique S3 key
      const timestamp = Date.now();
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `spreadsheet-uploads/${timestamp}-${safeName}`;
      const contentType = input.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      // Upload to S3
      const { url } = await storagePut(fileKey, buffer, contentType);

      // Save metadata to DB
      const [result] = await db.insert(spreadsheetUploads).values({
        fileName: input.fileName,
        fileKey,
        fileUrl: url,
        fileSize: input.fileSize || buffer.length,
        mimeType: contentType,
        uploadedBy: input.uploadedBy,
        uploadedAt: timestamp,
      });

      return {
        id: result.insertId,
        fileName: input.fileName,
        fileUrl: url,
        uploadedAt: timestamp,
      };
    }),

  /**
   * Listar planilhas enviadas — histórico completo.
   */
  listSpreadsheetUploads: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { uploads: [] };

      const rows = await db.select().from(spreadsheetUploads)
        .orderBy(desc(spreadsheetUploads.uploadedAt));

      return { uploads: rows };
    }),

  /**
   * Deletar planilha do histórico.
   */
  deleteSpreadsheetUpload: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      await db.delete(spreadsheetUploads).where(eq(spreadsheetUploads.id, input.id));
      return { success: true };
    }),

  /**
   * Obter URL de download de uma planilha.
   */
  getSpreadsheetDownloadUrl: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const [row] = await db.select().from(spreadsheetUploads)
        .where(eq(spreadsheetUploads.id, input.id));

      if (!row) throw new Error("Planilha não encontrada");

      // Try to get a fresh download URL
      try {
        const { url } = await storageGet(row.fileKey);
        return { url, fileName: row.fileName };
      } catch {
        // Fallback to stored URL
        return { url: row.fileUrl, fileName: row.fileName };
      }
    }),

  // ─── PDFs de Decisão de Cobrança ───

  /**
   * Salvar registro de PDF de decisão gerado.
   */
  saveDecisionPdf: publicProcedure
    .input(z.object({
      receivableId: z.number(),
      cliente: z.string(),
      vendedor: z.string().optional(),
      valorAberto: z.string().optional(),
      diasAtraso: z.number().optional(),
      decisao: z.string().optional(),
      protocolo: z.string(),
      fileBase64: z.string(),
      generatedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const buffer = Buffer.from(input.fileBase64, "base64");
      const timestamp = Date.now();
      const safeName = input.cliente.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
      const fileKey = `decision-pdfs/${timestamp}-${safeName}.pdf`;

      const { url } = await storagePut(fileKey, buffer, "application/pdf");

      const [result] = await db.insert(decisionPdfHistory).values({
        receivableId: input.receivableId,
        cliente: input.cliente,
        vendedor: input.vendedor || null,
        valorAberto: input.valorAberto || null,
        diasAtraso: input.diasAtraso || null,
        decisao: input.decisao || null,
        protocolo: input.protocolo,
        fileKey,
        fileUrl: url,
        generatedBy: input.generatedBy,
        generatedAt: timestamp,
      });

      return {
        id: result.insertId,
        fileUrl: url,
        protocolo: input.protocolo,
        generatedAt: timestamp,
      };
    }),

  /**
   * Listar PDFs de decisão gerados para um título.
   */
  listDecisionPdfs: publicProcedure
    .input(z.object({ receivableId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { pdfs: [] };

      const rows = await db.select().from(decisionPdfHistory)
        .where(eq(decisionPdfHistory.receivableId, input.receivableId))
        .orderBy(desc(decisionPdfHistory.generatedAt));

      return { pdfs: rows };
    }),

  /**
   * Listar TODOS os PDFs de decisão gerados (para o histórico geral).
   */
  listAllDecisionPdfs: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { pdfs: [] };

      const rows = await db.select().from(decisionPdfHistory)
        .orderBy(desc(decisionPdfHistory.generatedAt));

      return { pdfs: rows };
    }),

  /**
   * Deletar PDF de decisão do histórico.
   */
  deleteDecisionPdf: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.delete(decisionPdfHistory).where(eq(decisionPdfHistory.id, input.id));
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════
  // Prioridade de Pagamento — Bolinhas vermelhas (Flávio)
  // ═══════════════════════════════════════════════════════

  /**
   * Obter todas as marcações de prioridade da semana corrente.
   * Retorna marcações por maxiprodId (conta individual).
   */
  getPaymentPriorities: publicProcedure
    .input(z.object({ weekStart: z.string(), weekEnd: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { marks: [] };
      const rows = await db.select().from(paymentPriorityMarks)
        .where(and(
          gte(paymentPriorityMarks.date, input.weekStart),
          lte(paymentPriorityMarks.date, input.weekEnd)
        ));
      return { marks: rows };
    }),

  /**
   * Toggle marcação de prioridade para uma conta individual (por maxiprodId).
   * Se já existe, remove. Se não existe, cria.
   */
  togglePaymentPriority: publicProcedure
    .input(z.object({
      fornecedor: z.string(),
      date: z.string(), // YYYY-MM-DD
      maxiprodId: z.number(),
      operatorName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      // Verificar se já existe marcação para esta conta (maxiprodId) nesta data
      const [existing] = await db.select().from(paymentPriorityMarks)
        .where(and(
          eq(paymentPriorityMarks.maxiprodId, input.maxiprodId),
          eq(paymentPriorityMarks.date, input.date)
        ))
        .limit(1);

      if (existing) {
        // Remover marcação
        await db.delete(paymentPriorityMarks).where(eq(paymentPriorityMarks.id, existing.id));
        return { marked: false };
      } else {
        // Criar marcação
        await db.insert(paymentPriorityMarks).values({
          fornecedor: input.fornecedor,
          date: input.date,
          maxiprodId: input.maxiprodId,
          markedBy: input.operatorName,
        });
        return { marked: true };
      }
    }),

  /**
   * Limpar todas as marcações de prioridade de uma data específica.
   */
  clearPaymentPriorities: publicProcedure
    .input(z.object({ date: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.delete(paymentPriorityMarks).where(eq(paymentPriorityMarks.date, input.date));
      return { success: true };
    }),

  /**
   * getCheques - Retorna todos os cheques do Contas a Receber
   * Filtra accounts_receivable onde formaCobranca começa com 'Cheque'
   * Parseia o estado do cheque a partir do campo formaCobranca
   */
  getCheques: publicProcedure
    .input(z.object({
      empresaNome: z.string().optional(),
      estadoCheque: z.string().optional(), // DISPONIVEL, A_RECEBER, COMPENSACAO, etc.
      mesKey: z.string().optional(), // YYYY-MM to filter by month
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      // Fetch all cheques (formaCobranca starts with 'Cheque')
      const conditions = [
        sql`${accountsReceivable.formaCobranca} LIKE 'Cheque%'`,
        eq(accountsReceivable.estado, "EMITIDO"),
        inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
      ];

      if (input?.empresaNome) {
        conditions.push(eq(accountsReceivable.empresaNome, input.empresaNome));
      }

      // Filter by month (vencimentoData) if specified
      // Dates are stored as ISO strings like '2026-05-07T12:00:00.000-03:00'
      // Use LIKE to match YYYY-MM prefix
      if (input?.mesKey) {
        conditions.push(sql`${accountsReceivable.vencimentoData} LIKE ${input.mesKey + '%'}`);
      }

      const rows = await db.select({
        id: accountsReceivable.id,
        maxiprodId: accountsReceivable.maxiprodId,
        vencimentoData: accountsReceivable.vencimentoData,
        emissaoData: accountsReceivable.emissaoData,
        referenteA: accountsReceivable.referenteA,
        cliente: accountsReceivable.cliente,
        valorOriginal: accountsReceivable.valorOriginal,
        valorLiquido: accountsReceivable.valorLiquido,
        formaCobranca: accountsReceivable.formaCobranca,
        empresaNome: accountsReceivable.empresaNome,
        parcela: accountsReceivable.parcela,
        parcelasQuantidadeTotal: accountsReceivable.parcelasQuantidadeTotal,
        documentoVinculadoNumero: accountsReceivable.documentoVinculadoNumero,
      })
        .from(accountsReceivable)
        .where(and(...conditions))
        .orderBy(asc(accountsReceivable.vencimentoData));

      // Parse cheque state from formaCobranca
      const stateMap: Record<string, string> = {
        "CHEQUE DISPONIVEL": "DISPONIVEL",
        "CHEQUE DISPONIVEL ": "DISPONIVEL",
        "CHEQUE À RECEBER DE CLIENTES": "A_RECEBER",
        "CHEQUE A RECEBER DE CLIENTES": "A_RECEBER",
        "CHEQUE EM COMPENSACAO": "COMPENSACAO",
        "CHEQUE EM COMPENSAÇÃO": "COMPENSACAO",
        "CHEQUE CUSTODIA SICOOB": "CUSTODIA_SICOOB",
        "CHEQUE CUSTÓDIA SICOOB": "CUSTODIA_SICOOB",
        "CHEQUE CUSTODIA SICREDI": "CUSTODIA_SICREDI",
        "CHEQUE CUSTÓDIA SICREDI": "CUSTODIA_SICREDI",
        "CHEQUE LINHA 11": "LINHA_11",
        "CHEQUE LINHA 12": "LINHA_12",
        "CHEQUE VOLTOU OUTROS MOTIVOS": "VOLTOU_OUTROS",
        "CHEQUE EM FACTORING": "FACTORING",
      };

      function parseChequeState(formaCobranca: string | null): string {
        if (!formaCobranca) return "OUTROS";
        // Remove "Cheque " prefix and try to match
        const afterCheque = formaCobranca.replace(/^Cheque\s*/i, "").trim().toUpperCase();
        for (const [key, value] of Object.entries(stateMap)) {
          if (afterCheque.startsWith(key)) return value;
        }
        // Try partial matches
        if (afterCheque.includes("DISPONIVEL") || afterCheque.includes("DISPONÍVEL")) return "DISPONIVEL";
        if (afterCheque.includes("RECEBER")) return "A_RECEBER";
        if (afterCheque.includes("COMPENSAC")) return "COMPENSACAO";
        if (afterCheque.includes("SICOOB")) return "CUSTODIA_SICOOB";
        if (afterCheque.includes("SICREDI")) return "CUSTODIA_SICREDI";
        if (afterCheque.includes("LINHA 11")) return "LINHA_11";
        if (afterCheque.includes("LINHA 12")) return "LINHA_12";
        if (afterCheque.includes("VOLTOU")) return "VOLTOU_OUTROS";
        if (afterCheque.includes("FACTORING")) return "FACTORING";
        return "OUTROS";
      }

      const cheques = rows.map(row => {
        const estadoCheque = parseChequeState(row.formaCobranca);
        const valor = parseFloat(row.valorLiquido || row.valorOriginal || "0");
        return {
          id: row.id,
          maxiprodId: row.maxiprodId,
          vencimentoData: row.vencimentoData,
          emissaoData: row.emissaoData,
          descricao: row.referenteA || row.documentoVinculadoNumero || "",
          cliente: row.cliente || "",
          valor,
          formaPagamento: row.formaCobranca || "",
          estadoCheque,
          empresaNome: row.empresaNome || "",
          parcela: row.parcela,
          parcelasTotal: row.parcelasQuantidadeTotal,
        };
      });

      // Filter by cheque state if specified
      const filtered = input?.estadoCheque
        ? cheques.filter(c => c.estadoCheque === input.estadoCheque)
        : cheques;

      // Calculate totals per state
      const totaisPorEstado: Record<string, { count: number; valor: number }> = {};
      for (const c of cheques) {
        if (!totaisPorEstado[c.estadoCheque]) {
          totaisPorEstado[c.estadoCheque] = { count: 0, valor: 0 };
        }
        totaisPorEstado[c.estadoCheque].count++;
        totaisPorEstado[c.estadoCheque].valor += c.valor;
      }

      const totalGeral = cheques.reduce((sum, c) => sum + c.valor, 0);
      const totalFiltrado = filtered.reduce((sum, c) => sum + c.valor, 0);

      return {
        cheques: filtered,
        totalGeral,
        totalGeralCount: cheques.length,
        totalFiltrado,
        totalFiltradoCount: filtered.length,
        totaisPorEstado,
      };
    }),
});