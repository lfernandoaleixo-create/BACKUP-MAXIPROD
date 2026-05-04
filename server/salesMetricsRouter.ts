/**
 * Sales Metrics Router - Métrica de Vendas
 * Ranking de vendedores, vendas por vendedor, inadimplência por vendedor
 */
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { salesOrders, accountsReceivable } from "../drizzle/schema";
import { sql, and, gte, lte, ne, eq, desc, asc } from "drizzle-orm";

// Reuse the same vendedor mapping logic from financialRouter
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

// Fetch vendedor map from GraphQL (same logic as financialRouter)
let vendedorCacheMap: Record<string, string> = {};
let vendedorCacheTimestamp = 0;
const VENDEDOR_CACHE_TTL = 10 * 60 * 1000;

async function fetchVendedorMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now - vendedorCacheTimestamp < VENDEDOR_CACHE_TTL && Object.keys(vendedorCacheMap).length > 0) {
    return vendedorCacheMap;
  }

  const ENV = (await import("./_core/env")).ENV;
  const token = ENV.maxiprodGraphqlToken;
  if (!token) return vendedorCacheMap;

  try {
    const url = "https://api.maxiprod.com.br/graphql";
    const query = `{
      pedidosDeVenda(
        filtro: { }
        paginacao: { pagina: 1, itensPorPagina: 5000 }
      ) {
        itens {
          cliente { nomeFantasia razaoSocial }
          representanteOuVendedor1 { nomeFantasia razaoSocial }
          responsavelUsuario { nome }
          item { descricao grupoItem { descricao } }
        }
      }
    }`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query }),
    });

    if (!resp.ok) return vendedorCacheMap;
    const json = await resp.json();
    const pedidos = json?.data?.pedidosDeVenda?.itens || [];

    const map: Record<string, string> = {};
    const productMap: Record<string, Set<string>> = {};

    for (const p of pedidos) {
      const nomeFantasia = p.cliente?.nomeFantasia?.trim() || "";
      const razaoSocial = p.cliente?.razaoSocial?.trim() || "";
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
      const grupoItem = p.item?.grupoItem?.descricao?.toUpperCase() || "";
      const itemDesc = p.item?.descricao?.toUpperCase() || "";
      if (!productMap[clienteKey]) productMap[clienteKey] = new Set();
      if (grupoItem) productMap[clienteKey].add(grupoItem);
      if (itemDesc) productMap[clienteKey].add(itemDesc);
    }

    // Override manual: Johnson/Keure → "Grupo Fox"
    for (const key of Object.keys(map)) {
      if (isClienteGrupoFox(key)) {
        map[key] = "Grupo Fox";
      }
    }

    // Fallback by product
    for (const [clienteKey, cats] of Object.entries(productMap)) {
      if (map[clienteKey]) continue;
      const catStr = Array.from(cats).join(" ");
      if (catStr.includes("MADEIRA") || catStr.includes("INDUSTRIAL")) {
        map[clienteKey] = "JORDAO";
      } else if (catStr.includes("BAMBU") || catStr.includes("REVENDA")) {
        map[clienteKey] = "JUVENAL TEIXEIRA";
      }
    }

    vendedorCacheMap = map;
    vendedorCacheTimestamp = now;
  } catch (err) {
    console.error("[SalesMetrics] Error fetching vendedor map:", err);
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

      // Also build local vendedor map from representante field
      // Group by pedido to avoid double-counting items from same order
      const pedidoMap = new Map<string, { cliente: string; vendedor: string; valor: number }>();
      for (const o of filtered) {
        const pedido = o.pedido || `item-${Math.random()}`;
        if (pedidoMap.has(pedido)) continue; // Already counted this order

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
   * Returns: vendedor name, number of inadimplent clients, total overdue value
   */
  getInadimplenciaPorVendedor: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];

      // Get all overdue receivables (vencimentoData < today and not fully paid)
      const today = new Date().toISOString().split("T")[0];
      const overdue = await db.select({
        cliente: accountsReceivable.cliente,
        valorLiquido: accountsReceivable.valorLiquido,
        valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
      }).from(accountsReceivable)
        .where(and(
          lte(accountsReceivable.vencimentoData, today),
          sql`(${accountsReceivable.valorLiquido} - ${accountsReceivable.valorRecebidoLiquido}) > 0.01`
        ));

      // Get vendedor map
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

      // Merge: GraphQL priority
      const mergedMap: Record<string, string> = { ...localMap, ...vendedorMap };
      for (const key of Object.keys(mergedMap)) {
        if (isClienteGrupoFox(key)) mergedMap[key] = "Grupo Fox";
      }

      // Group overdue by vendedor
      const vendedorInadimplencia: Record<string, { clientes: Set<string>; totalDevido: number }> = {};
      for (const rec of overdue) {
        const clienteName = rec.cliente || "";
        const vendedor = mergedMap[clienteName] || "Não identificado";
        const valorAberto = (Number(rec.valorLiquido) || 0) - (Number(rec.valorRecebidoLiquido) || 0);

        if (!vendedorInadimplencia[vendedor]) {
          vendedorInadimplencia[vendedor] = { clientes: new Set(), totalDevido: 0 };
        }
        vendedorInadimplencia[vendedor].clientes.add(clienteName);
        vendedorInadimplencia[vendedor].totalDevido += valorAberto;
      }

      return Object.entries(vendedorInadimplencia)
        .map(([vendedor, stats]) => ({
          vendedor,
          qtdClientesInadimplentes: stats.clientes.size,
          totalDevido: Math.round(stats.totalDevido * 100) / 100,
          clientes: Array.from(stats.clientes),
        }))
        .sort((a, b) => b.totalDevido - a.totalDevido);
    }),
});
