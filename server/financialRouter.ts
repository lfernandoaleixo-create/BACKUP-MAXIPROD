/**
 * Financial Router - Contas a Pagar e Receber
 * SOMENTE LEITURA - dados do Maxiprod
 */
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { accountsPayable, accountsReceivable, bankAccounts, bankTransactions, salesOrders, dailyReconciliation, paymentAuthorizations } from "../drizzle/schema";
import { eq, and, gte, lte, sql, desc, asc, ne, inArray } from "drizzle-orm";
import { ENV } from "./_core/env";
import { fetchPaidAccountsTotal, fetchPaidAccountsDetails, fetchReceivedAccountsTotal, fetchReceivedAccountsDetails, fetchOtherInflowsTotal, fetchOtherInflowsDetails, fetchMonthlyOFXInflows, fetchInvoicesTotal, fetchBankBalancesWithInitial } from "./maxiprodGraphQL";

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
 * Retorna o dia útil anterior a hoje (Brasília).
 * Ex: se hoje é segunda (16/03), retorna sexta (13/03).
 * Se hoje é terça, retorna segunda.
 * Sábado/Domingo nunca são retornados.
 */
function getPreviousBusinessDay(): string {
  const todayStr = getTodayBR();
  const dow = getDayOfWeekStr(todayStr);
  // dow: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
  let daysBack = 1;
  if (dow === 1) daysBack = 3; // Segunda -> Sexta (-3)
  else if (dow === 0) daysBack = 2; // Domingo -> Sexta (-2)
  // Sab (dow===6) -> Sexta (-1), default
  return addDaysStr(todayStr, -daysBack);
}

/** Ajusta sábado/domingo para segunda-feira seguinte (string-based) */
function adjustWeekendStr(dateStr: string): string {
  const dow = getDayOfWeekStr(dateStr);
  if (dow === 6) return addDaysStr(dateStr, 2); // sábado -> segunda
  if (dow === 0) return addDaysStr(dateStr, 1); // domingo -> segunda
  return dateStr;
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
  if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
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
      sql`(${salesOrders.estadoNota} IS NULL OR UPPER(${salesOrders.estadoNota}) NOT IN ('DIGITA\u00c7\u00c3O', 'DIGITACAO'))`
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

      // Regra do mês corrente: para o mês atual, usar hoje como data de início
      const isCurrentMonth = date.getFullYear() === curY && date.getMonth() + 1 === curM;
      const fromDate = isCurrentMonth
        ? todayBR
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
        parcela: accountsPayable.parcela,
        parcelasQuantidadeTotal: accountsPayable.parcelasQuantidadeTotal,
        empresaNome: accountsPayable.empresaNome,
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
        fornecedor: item.cliente || "Sem nome",
        valor,
        vencimento: vencStr,
        referenteA: item.referenteA || "",
        parcela: item.parcela && item.parcelasQuantidadeTotal
          ? `${item.parcela}/${item.parcelasQuantidadeTotal}` : "",
        empresaNome: item.empresaNome || "",
        authStatus: calAuth?.status || null,
        authNotes: calAuth?.notes || null,
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
          sql`(${salesOrders.estadoNota} IS NULL OR UPPER(${salesOrders.estadoNota}) NOT IN ('DIGITA\u00c7\u00c3O', 'DIGITACAO'))`
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
        valorLiquido: accountsPayable.valorLiquido,
        valorPagoLiquido: accountsPayable.valorPagoLiquido,
        vencimentoData: accountsPayable.vencimentoData,
        referenteA: accountsPayable.referenteA,
        parcela: accountsPayable.parcela,
        parcelasQuantidadeTotal: accountsPayable.parcelasQuantidadeTotal,
        empresaNome: accountsPayable.empresaNome,
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
      referenteA: string;
      parcela: string;
      empresaNome: string;
      authorized: boolean;
      authStatus: string | null;
      authNotes: string | null;
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
        fornecedor: item.fornecedor || "Sem nome",
        valor,
        vencimento: vencStr,
        referenteA: item.referenteA || "",
        parcela: item.parcela && item.parcelasQuantidadeTotal
          ? `${item.parcela}/${item.parcelasQuantidadeTotal}`
          : "",
        empresaNome: item.empresaNome || "",
        authorized: authData?.status === "autorizado" || false,
        authStatus: authData?.status || null,
        authNotes: authData?.notes || null,
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

    // Ordenar por valor decrescente
    vencidasItems.sort((a, b) => b.valor - a.valor);
    for (const bucket of dayBuckets) {
      bucket.sort((a, b) => b.valor - a.valor);
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
      if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
      return "outros";
    };

    const isDigitacao = (nota: string | null) => {
      if (!nota) return false;
      const n = nota.toUpperCase();
      return n === 'DIGITA\u00c7\u00c3O' || n === 'DIGITACAO';
    };

    const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";

    // Filtrar: exclui Digitação e "outros" (CANCELADO, AMOSTRA, GILSON, NULL)
    const items = allItems.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));

    // Calcular totais (mesma fórmula do getAnalytics)
    const uniqueOrders = new Set(items.map((i) => i.pedido).filter(Boolean));
    const totalValue = items.reduce((sum, i) => sum + Number(i.valorTotal || 0), 0);
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
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select({
        pedido: salesOrders.pedido,
        cliente: salesOrders.cliente,
        valorTotal: salesOrders.valorTotal,
        dataEmissao: salesOrders.dataEmissao,
        descricaoItem: salesOrders.descricaoItem,
      })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.estadoItem, 'Faturado'),
          gte(salesOrders.dataEmissao, input.startDate),
          lte(salesOrders.dataEmissao, input.endDate)
        )
      )
      .orderBy(desc(salesOrders.dataEmissao));

    // Agrupar por pedido para mostrar um resumo por NF
    const pedidoMap = new Map<string, { pedido: string; cliente: string; total: number; data: string; itens: number }>();
    for (const row of rows) {
      const key = row.pedido || 'sem-pedido';
      if (!pedidoMap.has(key)) {
        pedidoMap.set(key, {
          pedido: row.pedido || '-',
          cliente: row.cliente || '-',
          total: 0,
          data: row.dataEmissao?.slice(0, 10) || '-',
          itens: 0,
        });
      }
      const entry = pedidoMap.get(key)!;
      entry.total += Number(row.valorTotal || 0);
      entry.itens += 1;
    }

    return Array.from(pedidoMap.values())
      .sort((a, b) => b.total - a.total)
      .map(e => ({ ...e, total: Math.round(e.total * 100) / 100 }));
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
      if (e === "MADEIRA IMPORTA\u00c7\u00c3O" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
      return "outros";
    };

    const isDigitacao = (nota: string | null) => {
      if (!nota) return false;
      const n = nota.toUpperCase();
      return n === 'DIGITA\u00c7\u00c3O' || n === 'DIGITACAO';
    };

    const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";

    const items = allItems.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));

    // Agrupar por pedido
    const pedidoMap = new Map<string, { pedido: string; cliente: string; total: number; data: string; itens: number; estado: string; grupo: string }>();
    for (const item of items) {
      const key = item.pedido || 'sem-pedido';
      if (!pedidoMap.has(key)) {
        pedidoMap.set(key, {
          pedido: item.pedido || '-',
          cliente: item.cliente || '-',
          total: 0,
          data: item.dataEmissao?.slice(0, 10) || '-',
          itens: 0,
          estado: item.estadoNota || '-',
          grupo: estadoToGrupo(item.estadoConfiguravel),
        });
      }
      const entry = pedidoMap.get(key)!;
      entry.total += Number(item.valorTotal || 0);
      entry.itens += 1;
    }

    return Array.from(pedidoMap.values())
      .sort((a, b) => b.total - a.total)
      .map(e => ({ ...e, total: Math.round(e.total * 100) / 100 }));
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


});
