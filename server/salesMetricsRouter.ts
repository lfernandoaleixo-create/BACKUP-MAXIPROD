/**
 * Sales Metrics Router - Métrica de Vendas
 * Ranking de vendedores, vendas por vendedor, inadimplência por vendedor
 * 
 * INADIMPLÊNCIA: usa a mesma lógica da aba Inadimplência (financialRouter):
 * - Tabela accountsReceivable com estado = "EMITIDO"
 * - Tipos válidos: TITULO, RECEITA, ADIANTAMENTO
 * - Cutoff: dia útil anterior (getPreviousBusinessDay)
 * - Valor a receber: valorLiquido - valorRecebidoLiquido
 * - Vendedor: fetchVendedorMapFromGraphQL (mesma fonte)
 */
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { salesOrders, accountsReceivable } from "../drizzle/schema";
import { sql, and, gte, lte, ne, eq, desc, asc, inArray } from "drizzle-orm";
import { ENV } from "./_core/env";

// === CONSTANTS (same as financialRouter) ===
const RECEIVABLE_VALID_TYPES = ["TITULO", "RECEITA", "ADIANTAMENTO"];

// Editoras que NÃO são vendedoras
const EDITORES_NAO_VENDEDORES = ["BRENDA", "LARISSA"];
const CLIENTES_GRUPO_FOX = ["JOHNSON", "KEURE", "S C JOHNSON", "SC JOHNSON", "S. C. JOHNSON"];

function isEditorNaoVendedor(nome: string): boolean {
  return EDITORES_NAO_VENDEDORES.some(e => nome.toUpperCase().includes(e));
}

function isClienteGrupoFox(nome: string): boolean {
  const upper = nome.toUpperCase();
  return CLIENTES_GRUPO_FOX.some(c => upper.includes(c));
}

// === DATE HELPERS (same as financialRouter) ===
function getTodayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return dt.toISOString().slice(0, 10);
}

function getDayOfWeekStr(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

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

function isBusinessDay(dateStr: string): boolean {
  const dow = getDayOfWeekStr(dateStr);
  if (dow === 0 || dow === 6) return false;
  return !BANK_HOLIDAYS.has(dateStr);
}

function getPreviousBusinessDay(): string {
  const todayStr = getTodayBR();
  let candidate = addDaysStr(todayStr, -1);
  for (let i = 0; i < 10; i++) {
    if (isBusinessDay(candidate)) return candidate;
    candidate = addDaysStr(candidate, -1);
  }
  return candidate;
}

function countBusinessDays(fromDateStr: string, toDateStr: string): number {
  let count = 0;
  let current = addDaysStr(fromDateStr, 1);
  while (current <= toDateStr) {
    if (isBusinessDay(current)) count++;
    current = addDaysStr(current, 1);
  }
  return count;
}

// === VENDEDOR MAP (same logic as financialRouter.fetchVendedorMapFromGraphQL) ===
let vendedorCacheMap: Record<string, string> = {};
let vendedorCacheTimestamp = 0;
const VENDEDOR_CACHE_TTL = 10 * 60 * 1000;

function categorizeProduct(descricao: string, grupoDesc: string): 'madeira' | 'bambu' | null {
  const desc = (descricao || '').toUpperCase();
  const grupo = (grupoDesc || '').toUpperCase();
  if (grupo.includes('BAMBU') || grupo.includes('FIBRA')) return 'bambu';
  if (grupo.includes('VARETA') || grupo.includes('ESPETO') || grupo.includes('PALITO') || grupo.includes('MADEIRA')) return 'madeira';
  if (desc.includes('MADEIRA SERRADA') || desc.includes('MADEIRA DE PINUS')) return 'madeira';
  if (desc.includes('VARETA') && !desc.includes('BAMBU')) return 'madeira';
  if (desc.includes('VARETA AROMATIZADOR')) return 'madeira';
  return null;
}

async function fetchVendedorMap(): Promise<Record<string, string>> {
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
        console.error("[SalesMetrics Vendedor Cache] GraphQL errors:", data.errors);
        break;
      }

      const result = data.data.pedidosDeVenda;
      totalCount = result.totalCount;

      for (const p of result.items) {
        const nomeFantasia = p.cliente?.nomeFantasia || "";
        const razaoSocial = p.cliente?.razaoSocial || "";
        const clienteKey = nomeFantasia || razaoSocial;
        if (!clienteKey) continue;

        let vendedor = p.representanteOuVendedor1?.nomeFantasia
          || p.representanteOuVendedor1?.razaoSocial
          || "";

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

        // Track product categories for fallback
        if (!productMap[clienteKey]) productMap[clienteKey] = { madeira: false, bambu: false };
        for (const item of (p.itensDoPedidoDeVenda || [])) {
          const cat = categorizeProduct(item?.item?.descricao || '', item?.item?.grupoDescricao || '');
          if (cat === 'madeira') productMap[clienteKey].madeira = true;
          if (cat === 'bambu') productMap[clienteKey].bambu = true;
        }
        if (razaoSocial && razaoSocial !== clienteKey) {
          if (!productMap[razaoSocial]) productMap[razaoSocial] = { madeira: false, bambu: false };
          productMap[razaoSocial].madeira = productMap[razaoSocial].madeira || productMap[clienteKey].madeira;
          productMap[razaoSocial].bambu = productMap[razaoSocial].bambu || productMap[clienteKey].bambu;
        }
      }

      skip += PAGE_SIZE;
    } while (skip < totalCount);

    // Override manual: Johnson/Keure → "Grupo Fox"
    for (const key of Object.keys(map)) {
      if (isClienteGrupoFox(key)) {
        map[key] = "Grupo Fox";
      }
    }

    // Fallback by product: madeira → JORDAO, bambu → JUVENAL TEIXEIRA
    for (const [clienteKey, cats] of Object.entries(productMap)) {
      if (!map[clienteKey] && !isClienteGrupoFox(clienteKey)) {
        if (cats.madeira) {
          map[clienteKey] = "JORDAO";
        } else if (cats.bambu) {
          map[clienteKey] = "JUVENAL TEIXEIRA";
        }
      }
    }

    vendedorCacheMap = map;
    vendedorCacheTimestamp = now;
    console.log(`[SalesMetrics Vendedor Cache] Refreshed: ${Object.keys(map).length} mappings from ${totalCount} pedidos`);
  } catch (err) {
    console.error("[SalesMetrics Vendedor Cache] Error fetching from GraphQL:", err);
  }

  return vendedorCacheMap;
}

export const salesMetricsRouter = router({
  /**
   * Get vendedor sales ranking for a given month
   * Returns: vendedor name, total sales value, number of orders, number of clients
   */
  getVendedorRanking: publicProcedure
    .input(z.object({
      startDate: z.string(), // YYYY-MM-DD
      endDate: z.string(),   // YYYY-MM-DD
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Get all sales orders in the period (exclude Digitação and Outros)
      const orders = await db.select({
        pedido: salesOrders.pedido,
        cliente: salesOrders.cliente,
        clienteApelido: salesOrders.clienteApelido,
        razaoSocial: salesOrders.razaoSocial,
        representante: salesOrders.representante,
        valorTotalPedido: salesOrders.valorTotalPedido,
        valorTotal: salesOrders.valorTotal,
        estadoNota: salesOrders.estadoNota,
        estadoConfiguravel: salesOrders.estadoConfiguravel,
        dataEmissao: salesOrders.dataEmissao,
      }).from(salesOrders)
        .where(and(
          gte(salesOrders.dataEmissao, input.startDate),
          lte(salesOrders.dataEmissao, input.endDate),
        ));

      // Filter: exclude Digitação and Outros (AMOSTRA, BONIFICAÇÃO)
      const filtered = orders.filter(o => {
        const nota = (o.estadoNota || "").toUpperCase();
        if (nota === "DIGITAÇÃO" || nota === "DIGITACAO") return false;
        const estado = (o.estadoConfiguravel || "").toUpperCase();
        if (estado.includes("AMOSTRA") || estado.includes("BONIFICA") || estado === "GILSON") return false;
        return true;
      });

      // Get vendedor map from GraphQL
      const vendedorMap = await fetchVendedorMap();

      // Group by pedido to avoid double-counting items from same order
      const pedidoMap = new Map<string, { cliente: string; vendedor: string; valor: number }>();
      for (const o of filtered) {
        const pedido = o.pedido || `item-${Math.random()}`;
        if (pedidoMap.has(pedido)) continue;

        const clienteName = o.cliente || o.clienteApelido || o.razaoSocial || "";
        
        // Determine vendedor: priority is representante field, then graphQL map
        let vendedor = o.representante || "";
        if (!vendedor || isEditorNaoVendedor(vendedor)) {
          vendedor = vendedorMap[clienteName] || vendedorMap[o.razaoSocial || ""] || vendedorMap[o.clienteApelido || ""] || "";
        }
        if (isClienteGrupoFox(clienteName)) {
          vendedor = "Grupo Fox";
        }
        if (!vendedor) vendedor = "Não identificado";

        const valor = Number(o.valorTotalPedido || o.valorTotal || 0);
        pedidoMap.set(pedido, { cliente: clienteName, vendedor, valor });
      }

      // Aggregate by vendedor
      const vendedorStats: Record<string, { totalVendas: number; pedidos: Set<string>; clientes: Set<string> }> = {};
      for (const [pedido, data] of Array.from(pedidoMap.entries())) {
        if (!vendedorStats[data.vendedor]) {
          vendedorStats[data.vendedor] = { totalVendas: 0, pedidos: new Set(), clientes: new Set() };
        }
        vendedorStats[data.vendedor].totalVendas += data.valor;
        vendedorStats[data.vendedor].pedidos.add(pedido);
        vendedorStats[data.vendedor].clientes.add(data.cliente);
      }

      // Convert to array and sort by totalVendas desc
      const ranking = Object.entries(vendedorStats).map(([vendedor, stats]) => ({
        vendedor,
        totalVendas: Math.round(stats.totalVendas * 100) / 100,
        qtdPedidos: stats.pedidos.size,
        qtdClientes: stats.clientes.size,
      })).sort((a, b) => b.totalVendas - a.totalVendas);

      return ranking;
    }),

  /**
   * Get detailed sales for a specific vendedor in a period
   * Returns: list of clients with order values
   */
  getVendedorDetail: publicProcedure
    .input(z.object({
      vendedor: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const orders = await db.select({
        pedido: salesOrders.pedido,
        cliente: salesOrders.cliente,
        clienteApelido: salesOrders.clienteApelido,
        razaoSocial: salesOrders.razaoSocial,
        representante: salesOrders.representante,
        valorTotalPedido: salesOrders.valorTotalPedido,
        valorTotal: salesOrders.valorTotal,
        estadoNota: salesOrders.estadoNota,
        estadoConfiguravel: salesOrders.estadoConfiguravel,
        dataEmissao: salesOrders.dataEmissao,
      }).from(salesOrders)
        .where(and(
          gte(salesOrders.dataEmissao, input.startDate),
          lte(salesOrders.dataEmissao, input.endDate),
        ));

      // Filter: exclude Digitação and Outros
      const filtered = orders.filter(o => {
        const nota = (o.estadoNota || "").toUpperCase();
        if (nota === "DIGITAÇÃO" || nota === "DIGITACAO") return false;
        const estado = (o.estadoConfiguravel || "").toUpperCase();
        if (estado.includes("AMOSTRA") || estado.includes("BONIFICA") || estado === "GILSON") return false;
        return true;
      });

      const vendedorMap = await fetchVendedorMap();

      // Group by pedido, filter for this vendedor
      const pedidoMap = new Map<string, { cliente: string; vendedor: string; valor: number; data: string }>();
      for (const o of filtered) {
        const pedido = o.pedido || `item-${Math.random()}`;
        if (pedidoMap.has(pedido)) continue;

        const clienteName = o.cliente || o.clienteApelido || o.razaoSocial || "";
        let vendedor = o.representante || "";
        if (!vendedor || isEditorNaoVendedor(vendedor)) {
          vendedor = vendedorMap[clienteName] || vendedorMap[o.razaoSocial || ""] || vendedorMap[o.clienteApelido || ""] || "";
        }
        if (isClienteGrupoFox(clienteName)) vendedor = "Grupo Fox";
        if (!vendedor) vendedor = "Não identificado";

        if (vendedor.toUpperCase() === input.vendedor.toUpperCase()) {
          pedidoMap.set(pedido, {
            cliente: clienteName,
            vendedor,
            valor: Number(o.valorTotalPedido || o.valorTotal || 0),
            data: o.dataEmissao || "",
          });
        }
      }

      // Group by client
      const clienteMap: Record<string, { totalVendas: number; pedidos: number; ultimoPedido: string }> = {};
      for (const [_, data] of Array.from(pedidoMap.entries())) {
        if (!clienteMap[data.cliente]) {
          clienteMap[data.cliente] = { totalVendas: 0, pedidos: 0, ultimoPedido: "" };
        }
        clienteMap[data.cliente].totalVendas += data.valor;
        clienteMap[data.cliente].pedidos += 1;
        if (data.data > clienteMap[data.cliente].ultimoPedido) {
          clienteMap[data.cliente].ultimoPedido = data.data;
        }
      }

      return Object.entries(clienteMap)
        .map(([cliente, stats]) => ({
          cliente,
          totalVendas: Math.round(stats.totalVendas * 100) / 100,
          qtdPedidos: stats.pedidos,
          ultimoPedido: stats.ultimoPedido,
        }))
        .sort((a, b) => b.totalVendas - a.totalVendas);
    }),

  /**
   * Get inadimplência (overdue receivables) grouped by vendedor
   * USES THE SAME LOGIC AS THE INADIMPLÊNCIA TAB (financialRouter):
   * - estado = "EMITIDO"
   * - tipo IN (TITULO, RECEITA, ADIANTAMENTO)
   * - vencimentoData <= dia útil anterior (cutoff)
   * - valorAReceber = valorLiquido - valorRecebidoLiquido > 0
   * - Vendedor mapping from GraphQL + local sales_orders fallback
   */
  getInadimplenciaPorVendedor: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];

      // Same cutoff as Inadimplência tab: dia útil anterior
      const cutoff = getPreviousBusinessDay();

      // Buscar títulos vencidos com os mesmos filtros da aba Inadimplência
      const overdue = await db.select({
        cliente: accountsReceivable.cliente,
        valorLiquido: accountsReceivable.valorLiquido,
        valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
      }).from(accountsReceivable)
        .where(and(
          eq(accountsReceivable.estado, "EMITIDO"),
          inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
          lte(accountsReceivable.vencimentoData, cutoff + "T23:59:59")
        ));

      // Get vendedor map from GraphQL (same source as financialRouter)
      const vendedorMap = await fetchVendedorMap();

      // Also get from local sales_orders as fallback
      const vendedorRows = await db.select({
        cliente: salesOrders.cliente,
        clienteApelido: salesOrders.clienteApelido,
        razaoSocial: salesOrders.razaoSocial,
        representante: salesOrders.representante,
      }).from(salesOrders)
        .where(sql`(${salesOrders.estadoNota} IS NULL OR UPPER(${salesOrders.estadoNota}) NOT IN ('DIGITAÇÃO', 'DIGITACAO'))`);

      // Build local map
      const localMap: Record<string, string> = {};
      for (const vr of vendedorRows) {
        const rep = vr.representante || "";
        if (!rep || isEditorNaoVendedor(rep)) continue;
        const names = [vr.cliente, vr.clienteApelido, vr.razaoSocial].filter(Boolean) as string[];
        for (const nome of names) {
          if (nome && !localMap[nome]) localMap[nome] = rep;
        }
      }

      // Merge: GraphQL priority, local as fallback
      const mergedMap: Record<string, string> = { ...localMap, ...vendedorMap };
      for (const key of Object.keys(mergedMap)) {
        if (isClienteGrupoFox(key)) mergedMap[key] = "Grupo Fox";
      }

      // Filter test clients (same as financialRouter)
      const TEST_CLIENTS = ['CLIENTE TESTE REGRA', 'CLIENTE MANUAL TICK TEST', 'CLIENTE LEGACY VIBRATION TEST', 'CLIENTE RECENT VIBRATION TEST', 'CLIENTE TESTE COBRANCA'];

      // Group overdue by vendedor
      const vendedorInadimplencia: Record<string, { clientes: Map<string, { totalDevido: number; qtdTitulos: number }> }> = {};
      
      for (const rec of overdue) {
        const clienteName = (rec.cliente || "").trim();
        if (!clienteName) continue;
        if (TEST_CLIENTS.includes(clienteName.toUpperCase())) continue;
        
        const valorAberto = (Number(rec.valorLiquido) || 0) - (Number(rec.valorRecebidoLiquido) || 0);
        if (valorAberto <= 0) continue;

        const vendedor = mergedMap[clienteName] || "Não identificado";

        if (!vendedorInadimplencia[vendedor]) {
          vendedorInadimplencia[vendedor] = { clientes: new Map() };
        }
        
        const existing = vendedorInadimplencia[vendedor].clientes.get(clienteName) || { totalDevido: 0, qtdTitulos: 0 };
        existing.totalDevido += valorAberto;
        existing.qtdTitulos += 1;
        vendedorInadimplencia[vendedor].clientes.set(clienteName, existing);
      }

      return Object.entries(vendedorInadimplencia)
        .map(([vendedor, data]) => ({
          vendedor,
          qtdClientesInadimplentes: data.clientes.size,
          totalDevido: Math.round(Array.from(data.clientes.values()).reduce((sum, c) => sum + c.totalDevido, 0) * 100) / 100,
          clientes: Array.from(data.clientes.entries())
            .map(([nome, stats]) => ({
              nome,
              totalDevido: Math.round(stats.totalDevido * 100) / 100,
              qtdTitulos: stats.qtdTitulos,
            }))
            .sort((a, b) => b.totalDevido - a.totalDevido),
        }))
        .sort((a, b) => b.totalDevido - a.totalDevido);
    }),
});
