import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { salesOrders, billingAuthorizations, appSettings, productionAcceptance, productionNotes, productionStatus, collectionStatus, transportSelection, transportSelectionHistory, pickupSchedule, operators, billingObservations, trackingLinks, operatorGranularPermissions } from "../drizzle/schema";
import { sql, and, desc, eq, inArray } from "drizzle-orm";
import { ENV } from "./_core/env";
import { estadoToGrupo, GRUPO_LABELS, GRUPO_LABELS_SHORT, isOutros, isDigitacao, isAprovadoOuFaturado, getTipoEspecial, isAmostraBonificacao, inferGrupoFromItems, getAmostraBonificacaoLabel, type GrupoKey, type TipoEspecialPedido } from "../shared/grupoClassification";
import { createHash } from "crypto";

const DEFAULT_ADMIN_PASSWORD = "240288";

/**
 * Mapeamento de conversão kg → caixa para exibição no faturamento.
 * Produtos que são lançados em kg no Maxiprod mas controlados em caixas.
 */
const KG_TO_CAIXA_CONVERSION: Record<string, number> = {
  "00808": 11.6, // VARETA GLADE REEDS 100 ML — 11,6 kg/caixa
};

/**
 * Compute a hash of order-relevant data to detect CRITICAL changes.
 * Only includes fields that materially affect the order:
 *   - pedido (order number)
 *   - valorTotal (order total value)
 *   - itens: descricao, quantidade, valorUnitario, valorTotal (per item)
 *
 * EXCLUDED (minor changes that should NOT trigger auto-revoke):
 *   - observacoes (notes/comments)
 *   - dataEntrega (delivery date)
 *   - cliente (client name - may change due to razaoSocial vs apelido)
 *   - dataEntregaItem (item delivery date)
 *   - codigoItem (item code)
 *
 * This prevents unnecessary revocations when only non-critical fields change in Maxiprod.
 */
export function computeOrderHash(order: {
  pedido: string;
  cliente?: string;
  dataEntrega?: string;
  observacoes?: string;
  valorTotal: number;
  itens: Array<{ descricao: string; quantidade: number; valorUnitario: number; valorTotal: number; dataEntregaItem?: string; codigoItem?: string | null }>;
}): string {
  const data = {
    pedido: order.pedido,
    valorTotal: Math.round(order.valorTotal * 100) / 100,
    itens: order.itens.map(i => ({
      descricao: i.descricao,
      quantidade: i.quantidade,
      valorUnitario: Math.round(i.valorUnitario * 100) / 100,
      valorTotal: Math.round(i.valorTotal * 100) / 100,
    })).sort((a, b) => a.descricao.localeCompare(b.descricao)),
  };
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

/**
 * Verify the billing authorization password
 * Uses a separate setting key so it can have its own password
 */
async function verifyBillingPassword(password: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  // Validate against individual operator password
  const opRows = await db.select().from(operators).where(and(eq(operators.password, password), eq(operators.active, true))).limit(1);
  if (opRows.length > 0) return true;
  // Fallback: check billing-specific or admin password
  const rows = await db.select().from(appSettings).where(eq(appSettings.settingKey, "billing_auth_password")).limit(1);
  const billingPwd = rows.length > 0 ? rows[0].settingValue : null;
  if (billingPwd) return password === billingPwd;
  const adminRows = await db.select().from(appSettings).where(eq(appSettings.settingKey, "admin_password")).limit(1);
  const adminPwd = adminRows.length > 0 ? adminRows[0].settingValue : DEFAULT_ADMIN_PASSWORD;
  return password === adminPwd;
}

const GRAPHQL_URL = "https://api.maxiprod.com.br/graphql/";

/**
 * Execute a GraphQL query against the Maxiprod API (read-only)
 */
async function gqlQuery<T = any>(query: string): Promise<T> {
  const token = ENV.maxiprodGraphqlToken;
  if (!token) throw new Error("MAXIPROD_GRAPHQL_TOKEN não configurado");

  const resp = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${token}`,
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GraphQL API error ${resp.status}: ${text}`);
  }

  const result = await resp.json();
  if (result.errors?.length > 0) {
    throw new Error(`GraphQL error: ${result.errors[0].message}`);
  }

  return result.data as T;
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
    const data = await gqlQuery(query);
    const result = data[queryName];
    if (!result) throw new Error(`Query ${queryName} returned no data`);

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

type NfInfo = {
  numero: string;
  serie: string;
  chaveDeAcesso: string | null;
  emissaoData: string;
  valorTotal: number;
};

/**
 * Billing (Faturamento) router
 * Provides endpoints for billing overview: open orders and recently billed orders
 */
export const billingRouter = router({
  /**
   * Get all open orders (A faturar + Faturado parcial) across all periods
   * and billed orders (Faturado) from the current month
   */
  getOverview: publicProcedure
    .input(z.object({
      empresa: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { openOrders: [], billedOrders: [], summary: { openCount: 0, openValue: 0, billedCount: 0, billedValue: 0, partialCount: 0, partialValue: 0 } };

      const empresa = input?.empresa;

      // Build conditions
      const conditions: any[] = [];
      if (empresa) {
        conditions.push(sql`${salesOrders.empresa} = ${empresa}`);
      }

      // Get ALL items
      const allItems = await db
        .select({
          pedido: salesOrders.pedido,
          cliente: salesOrders.cliente,
          clienteApelido: salesOrders.clienteApelido,
          uf: salesOrders.uf,
          descricao: salesOrders.descricao,
          estadoItem: salesOrders.estadoItem,
          quantidade: salesOrders.quantidade,
          valorUnitario: salesOrders.valorUnitario,
          valorTotal: salesOrders.valorTotal,
          valorContabil: salesOrders.valorContabil,
          valorFaturar: salesOrders.valorFaturar,
          dataEmissao: salesOrders.dataEmissao,
          dataEntrega: salesOrders.dataEntrega,
          dataAprovacao: salesOrders.dataAprovacao,
          empresa: salesOrders.empresa,
          representante: salesOrders.representante,
          segmento: salesOrders.segmento,
          codigoGrupo: salesOrders.codigoGrupo,
          // Novos campos
          condicaoPagamento: salesOrders.condicaoPagamento,
          transportadora: salesOrders.transportadora,
          razaoSocial: salesOrders.razaoSocial,
          inscricaoEstadual: salesOrders.inscricaoEstadual,
          enderecoLogradouro: salesOrders.enderecoLogradouro,
          enderecoNumero: salesOrders.enderecoNumero,
          enderecoComplemento: salesOrders.enderecoComplemento,
          enderecoBairro: salesOrders.enderecoBairro,
          enderecoCep: salesOrders.enderecoCep,
          enderecoCidade: salesOrders.enderecoCidade,
          valorTotalPedido: salesOrders.valorTotalPedido,
          estadoNota: salesOrders.estadoNota,
          dataEntregaItem: salesOrders.dataEntrega,
          codigoItem: salesOrders.codigoItem,
          descricaoItem: salesOrders.descricaoItem,
          estadoConfiguravel: salesOrders.estadoConfiguravel,
          // Campos adicionais para detalhes completos (produção)
          unidadeMedidaCodigo: salesOrders.unidadeMedidaCodigo,
          unidadeMedidaDescricao: salesOrders.unidadeMedidaDescricao,
          quantidadeUnidadeItem: salesOrders.quantidadeUnidadeItem,
          ncm: salesOrders.ncm,
          clienteTelefone: salesOrders.clienteTelefone,
          clienteEmail: salesOrders.clienteEmail,
          transportadoraRazaoSocial: salesOrders.transportadoraRazaoSocial,
          grupoDescricao: salesOrders.grupoDescricao,
          observacoes: salesOrders.observacoes,
          regiao: salesOrders.regiao,
          crmSegmento: salesOrders.crmSegmento,
          fatorConversao: salesOrders.fatorConversao,
          quantidadeFaturada: salesOrders.quantidadeFaturada,
        })
        .from(salesOrders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(salesOrders.dataEmissao));

      // Separate open vs billed - EXCLUIR pedidos NÃO aprovados
      // REGRA DE NEGÓCIO: Na aba Faturamento, APENAS pedidos APROVADOS devem aparecer.
      // Pedidos "A aprovar" e "Digitação" NÃO devem aparecer.
      // NOTA: NÃO filtrar isOutros aqui - AMOSTRA e BONIFICAÇÃO devem aparecer para a produção
      // Usa funções compartilhadas de shared/grupoClassification.ts
      // REGRA: "Faturado c/ entrega futura" = faturou financeiro mas mercadoria ainda não entregue
      // Deve aparecer como pedido em aberto (produção precisa entregar)
      //
      // REGRA FATURAMENTO PARCIAL (NOVA LÓGICA):
      // Quando um item tem estado "Faturado parcial":
      //   - A quantidade JÁ FATURADA (quantidadeFaturada) vai para "Faturados (Últ. 30 dias)"
      //   - A quantidade RESTANTE (quantidade - quantidadeFaturada = Qt a faturar) fica em "Pedidos em Aberto"
      // Itens 100% "Faturado" vão normalmente para Faturados.
      // Itens "A faturar" e "Faturado c/ entrega futura" ficam em Aberto.
      
      // Open: itens "A faturar", "Faturado parcial" (só a parte restante), "Faturado c/ entrega futura"
      const openItems = allItems.filter(i => {
        if (!isAprovadoOuFaturado(i.estadoNota)) return false;
        if (i.estadoItem === "A faturar" || i.estadoItem === "Faturado parcial" || i.estadoItem === "Faturado c/ entrega futura") return true;
        return false;
      });
      
      // Helper to format ISO date to DD/MM/YYYY
      const formatDate = (d: string | null): string => {
        if (!d) return "";
        // Extract date directly from ISO string to avoid timezone conversion issues
        // e.g. '2026-05-07T00:00:00.000-03:00' -> '07/05/2026'
        const isoMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
        }
        // Already in dd/mm/yyyy format
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
        try {
          const date = new Date(d);
          if (isNaN(date.getTime())) return d;
          return date.toLocaleDateString("pt-BR");
        } catch { return d; }
      };

      // Billed: janela ampla de 365 dias para capturar pedidos com emissão antiga mas faturamento recente
      // Exemplo: pedido 155 emitido em dez/2025 mas faturado (NF 2253) em abr/2026
      // O filtro final de 30 dias será aplicado usando a data da NF (quando disponível) ou data de emissão (fallback)
      const now = new Date();
      const preFilterDaysAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      preFilterDaysAgo.setHours(0, 0, 0, 0);
      
      // Billed: itens 100% "Faturado" + itens "Faturado parcial" (só a parte já faturada)
      const billedItems = allItems.filter(i => {
        if (i.estadoItem !== "Faturado" && i.estadoItem !== "Faturado parcial") return false;
        if (!i.dataEmissao) return false;
        // REGRA DE NEGÓCIO: Na aba Faturamento, APENAS pedidos APROVADOS/FATURADOS devem aparecer.
        if (!isAprovadoOuFaturado(i.estadoNota)) return false;
        // Para "Faturado parcial", só incluir se tem quantidadeFaturada > 0
        if (i.estadoItem === "Faturado parcial") {
          const qtdFat = i.quantidadeFaturada ? parseFloat(String(i.quantidadeFaturada)) : 0;
          if (qtdFat <= 0) return false;
        }
        try {
          const itemDate = new Date(i.dataEmissao);
          return itemDate >= preFilterDaysAgo;
        } catch { return false; }
      });

      // Group by pedido for open orders
      const openMap = new Map<string, any>();
      for (const item of openItems) {
        const key = item.pedido || "sem-pedido";
        // Classificar grupo usando a função compartilhada
        const grupoKey = estadoToGrupo(item.estadoConfiguravel);
        const grupoLabel = GRUPO_LABELS[grupoKey] || grupoKey;
        if (!openMap.has(key)) {
          openMap.set(key, {
            pedido: item.pedido || "",
            cliente: item.cliente || "",
            clienteApelido: item.clienteApelido || "",
            uf: item.uf || "",
            dataEmissao: formatDate(item.dataEmissao),
            dataEntrega: formatDate(item.dataEntrega),
            dataAprovacao: formatDate(item.dataAprovacao),
            empresa: item.empresa || "",
            representante: item.representante || "",
            segmento: item.segmento || "",
            estadoItem: item.estadoItem || "",
            grupo: grupoLabel,
            grupoKey: grupoKey,
            tipoEspecial: null as TipoEspecialPedido, // Will be set after valorTotal is calculated
            valorTotal: 0,
            // Novos campos
            condicaoPagamento: item.condicaoPagamento || "",
            transportadora: item.transportadora || "",
            razaoSocial: item.razaoSocial || "",
            inscricaoEstadual: item.inscricaoEstadual || "",
            endereco: item.enderecoLogradouro ? {
              logradouro: item.enderecoLogradouro || "",
              numero: item.enderecoNumero || "",
              complemento: item.enderecoComplemento || "",
              bairro: item.enderecoBairro || "",
              cep: item.enderecoCep || "",
              cidade: item.enderecoCidade || "",
              uf: item.uf || "",
            } : null,
            valorTotalPedido: item.valorTotalPedido ? parseFloat(String(item.valorTotalPedido)) : null,
            // Campos adicionais para detalhes completos (produção)
            clienteTelefone: item.clienteTelefone || "",
            clienteEmail: item.clienteEmail || "",
            transportadoraRazaoSocial: item.transportadoraRazaoSocial || "",
            crmSegmento: item.crmSegmento || "",
            regiao: item.regiao || "",
            observacoes: item.observacoes || "",
            _estadoConfiguravel: item.estadoConfiguravel || "",
            itens: [] as any[],
          });
        }
        const order = openMap.get(key)!;
        const vtOriginal = parseFloat(String(item.valorTotal || 0));
        const qtdOriginal = parseFloat(String(item.quantidade || 0));
        const qtdFaturada = item.quantidadeFaturada ? parseFloat(String(item.quantidadeFaturada)) : 0;
        const vuOriginal = parseFloat(String(item.valorUnitario || 0));
        // Para itens com faturamento parcial, calcular saldo restante
        const isParcial = item.estadoItem === "Faturado parcial" && qtdFaturada > 0;
        const qtdEfetiva = isParcial ? Math.max(qtdOriginal - qtdFaturada, 0) : qtdOriginal;
        // Recalcular valor total proporcional ao saldo restante
        const vtEfetivo = isParcial ? (qtdEfetiva * vuOriginal) : vtOriginal;
        order.valorTotal += vtEfetivo;
        // If any item is "Faturado parcial", mark the order as partial
        if (item.estadoItem === "Faturado parcial") {
          order.estadoItem = "Faturado parcial";
        }
        // Conversão para caixas — PRIORIDADE: quantidade lançada no Maxiprod
        // Usa observações quando há conversão de unidades explícita (ex: kg → caixas, MIL → caixas)
        const codigoItemVal = item.codigoItem || "";
        const unidadeVal = (item.unidadeMedidaCodigo || "").toLowerCase();
        let qtdExibicao = qtdEfetiva;
        let qtdOriginalExibicao = qtdOriginal;
        let unidadeExibicao = item.unidadeMedidaCodigo || "";
        const obs = (item.observacoes || "");
        // Usar obs para conversão quando a unidade NÃO é CX/UN (ou seja, KG, MIL, etc.)
        // e a obs menciona caixas — isso indica conversão de unidade explícita
        const isKgUnit = unidadeVal === 'kg';
        const isNonStandardUnit = unidadeVal !== 'cx' && unidadeVal !== 'un' && unidadeVal !== '';
        const caixasConversaoMatch = isNonStandardUnit ? obs.match(/(\d+)\s*caixas?/i) : null;
        if (caixasConversaoMatch) {
          // Conversão de unidade via observação (kg/MIL/etc → caixas)
          qtdExibicao = parseInt(caixasConversaoMatch[1], 10);
          qtdOriginalExibicao = parseInt(caixasConversaoMatch[1], 10);
          unidadeExibicao = "cx";
        } else if (KG_TO_CAIXA_CONVERSION[codigoItemVal] && isKgUnit) {
          // Fallback: conversão matemática kg → caixa para produtos mapeados
          const pesoCx = KG_TO_CAIXA_CONVERSION[codigoItemVal];
          qtdExibicao = Math.round(qtdEfetiva / pesoCx);
          qtdOriginalExibicao = Math.round(qtdOriginal / pesoCx);
          unidadeExibicao = "cx";
        }
        order.itens.push({
          descricao: item.descricao || "",
          quantidade: qtdExibicao,
          quantidadeOriginal: qtdOriginalExibicao,
          quantidadeFaturada: qtdFaturada,
          valorUnitario: vuOriginal,
          valorTotal: Math.round(vtEfetivo * 100) / 100,
          valorFaturar: parseFloat(String(item.valorFaturar || 0)),
          estadoItem: item.estadoItem || "",
          codigoGrupo: item.codigoGrupo || "",
          dataEntregaItem: item.dataEntregaItem || "",
          codigoItem: item.codigoItem || null,
          descricaoItem: item.descricaoItem || null,
          // Campos adicionais para detalhes completos (produção)
          unidadeMedida: unidadeExibicao,
          unidadeMedidaDescricao: item.unidadeMedidaDescricao || "",
          quantidadeUnidadeItem: item.quantidadeUnidadeItem ? parseFloat(String(item.quantidadeUnidadeItem)) : null,
          ncm: item.ncm || "",
          fatorConversao: item.fatorConversao ? parseFloat(String(item.fatorConversao)) : null,
          grupoDescricao: item.grupoDescricao || "",
        });
      }

      // Group by pedido for billed orders
      const billedMap = new Map<string, any>();
      for (const item of billedItems) {
        const key = item.pedido || "sem-pedido";
        // Classificar grupo usando a função compartilhada
        const grupoKeyBilled = estadoToGrupo(item.estadoConfiguravel);
        const grupoLabelBilled = GRUPO_LABELS[grupoKeyBilled] || grupoKeyBilled;
        if (!billedMap.has(key)) {
          billedMap.set(key, {
            pedido: item.pedido || "",
            cliente: item.cliente || "",
            clienteApelido: item.clienteApelido || "",
            uf: item.uf || "",
            dataEmissao: formatDate(item.dataEmissao),
            dataEntrega: formatDate(item.dataEntrega),
            dataAprovacao: formatDate(item.dataAprovacao),
            empresa: item.empresa || "",
            representante: item.representante || "",
            segmento: item.segmento || "",
            estadoItem: "Faturado",
            grupo: grupoLabelBilled,
            grupoKey: grupoKeyBilled,
            tipoEspecial: null as TipoEspecialPedido, // Will be set after valorTotal is calculated
            valorTotal: 0,
            // Novos campos
            condicaoPagamento: item.condicaoPagamento || "",
            transportadora: item.transportadora || "",
            razaoSocial: item.razaoSocial || "",
            inscricaoEstadual: item.inscricaoEstadual || "",
            endereco: item.enderecoLogradouro ? {
              logradouro: item.enderecoLogradouro || "",
              numero: item.enderecoNumero || "",
              complemento: item.enderecoComplemento || "",
              bairro: item.enderecoBairro || "",
              cep: item.enderecoCep || "",
              cidade: item.enderecoCidade || "",
              uf: item.uf || "",
            } : null,
            valorTotalPedido: item.valorTotalPedido ? parseFloat(String(item.valorTotalPedido)) : null,
            // Campos adicionais para detalhes completos (produção)
            clienteTelefone: item.clienteTelefone || "",
            clienteEmail: item.clienteEmail || "",
            transportadoraRazaoSocial: item.transportadoraRazaoSocial || "",
            crmSegmento: item.crmSegmento || "",
            regiao: item.regiao || "",
            observacoes: item.observacoes || "",
            _estadoConfiguravel: item.estadoConfiguravel || "",
            itens: [] as any[],
          });
        }
        const order = billedMap.get(key)!;
        const vtOriginalBilled = parseFloat(String(item.valorTotal || 0));
        const qtdOriginalBilled = parseFloat(String(item.quantidade || 0));
        const qtdFaturadaBilled = item.quantidadeFaturada ? parseFloat(String(item.quantidadeFaturada)) : 0;
        const vuBilled = parseFloat(String(item.valorUnitario || 0));
        // Para "Faturado parcial", usar apenas a quantidade já faturada e recalcular valor proporcional
        const isBilledParcial = item.estadoItem === "Faturado parcial" && qtdFaturadaBilled > 0;
        const qtdEfetivaBilled = isBilledParcial ? qtdFaturadaBilled : qtdOriginalBilled;
        const vtEfetivoBilled = isBilledParcial ? (qtdFaturadaBilled * vuBilled) : vtOriginalBilled;
        order.valorTotal += vtEfetivoBilled;
        // Conversão para caixas (faturados) — PRIORIDADE: quantidade lançada no Maxiprod
        // Usa observações quando há conversão de unidades explícita (ex: kg → caixas, MIL → caixas)
        const billedCodigoItem = item.codigoItem || "";
        const billedUnidade = (item.unidadeMedidaCodigo || "").toLowerCase();
        let billedQtd = qtdEfetivaBilled;
        let billedUnidadeExibicao = item.unidadeMedidaCodigo || "";
        const billedObs = (item.observacoes || "");
        const billedIsKg = billedUnidade === 'kg';
        const billedIsNonStandard = billedUnidade !== 'cx' && billedUnidade !== 'un' && billedUnidade !== '';
        const billedCaixasConversaoMatch = billedIsNonStandard ? billedObs.match(/(\d+)\s*caixas?/i) : null;
        if (billedCaixasConversaoMatch) {
          // Conversão de unidade via observação (kg/MIL/etc → caixas)
          billedQtd = parseInt(billedCaixasConversaoMatch[1], 10);
          billedUnidadeExibicao = "cx";
        } else if (KG_TO_CAIXA_CONVERSION[billedCodigoItem] && billedIsKg) {
          // Fallback: conversão matemática kg → caixa para produtos mapeados
          const pesoCx = KG_TO_CAIXA_CONVERSION[billedCodigoItem];
          billedQtd = Math.round(billedQtd / pesoCx);
          billedUnidadeExibicao = "cx";
        }
        order.itens.push({
          descricao: item.descricao || "",
          quantidade: billedQtd,
          valorUnitario: vuBilled,
          valorTotal: Math.round(vtEfetivoBilled * 100) / 100,
          valorFaturar: parseFloat(String(item.valorFaturar || 0)),
          estadoItem: isBilledParcial ? "Faturado parcial" : (item.estadoItem || ""),
          codigoGrupo: item.codigoGrupo || "",
          dataEntregaItem: item.dataEntregaItem || "",
          codigoItem: item.codigoItem || null,
          descricaoItem: item.descricaoItem || null,
          // Campos adicionais para detalhes completos (produção)
          unidadeMedida: billedUnidadeExibicao,
          unidadeMedidaDescricao: item.unidadeMedidaDescricao || "",
          quantidadeUnidadeItem: item.quantidadeUnidadeItem ? parseFloat(String(item.quantidadeUnidadeItem)) : null,
          ncm: item.ncm || "",
          fatorConversao: item.fatorConversao ? parseFloat(String(item.fatorConversao)) : null,
          grupoDescricao: item.grupoDescricao || "",
          quantidadeFaturada: isBilledParcial ? qtdFaturadaBilled : undefined,
        });
      }

      // Convert maps to arrays, apply heuristic tipoEspecial, compute hash, and round values
      const openOrders = Array.from(openMap.values()).map(o => {
        const valorRounded = Math.round(o.valorTotal * 100) / 100;
        const hash = computeOrderHash({
          pedido: o.pedido,
          cliente: o.cliente,
          dataEntrega: o.dataEntrega || "",
          observacoes: o.observacoes || "",
          valorTotal: valorRounded,
          itens: o.itens,
        });
        // Heurística inteligente: usa observações + valor para classificar AMOSTRA vs BONIFICAÇÃO vs pedido normal
        const tipoEspecial = getTipoEspecial(o._estadoConfiguravel, o.observacoes, valorRounded);
        
        // Para pedidos AMOSTRA/BONIFICAÇÃO: inferir grupo dos itens e gerar label combinado
        let grupo = o.grupo;
        let grupoKey = o.grupoKey;
        if (isAmostraBonificacao(o._estadoConfiguravel)) {
          const itemGrupos = o.itens.map((i: any) => i.grupoDescricao || null);
          grupoKey = inferGrupoFromItems(itemGrupos);
          grupo = getAmostraBonificacaoLabel(tipoEspecial, grupoKey);
        }
        
        return {
          ...o,
          valorTotal: valorRounded,
          orderHash: hash,
          tipoEspecial,
          grupo,
          grupoKey,
        };
      });
      openOrders.sort((a, b) => b.valorTotal - a.valorTotal);

      // AUTO-REVOKE INTELIGENTE: Detecta alterações críticas (valor, quantidade, itens)
      // Em vez de deletar o aceite, marca o pedido com wasModified=true
      // para que volte ao "Aceite da Produção" com sinalização visual vermelha.
      // Só compara campos críticos: valorTotal, quantidade, valorUnitario, descrição dos itens.
      // PROTEÇÃO: Se mais de 5 pedidos mudaram de hash ao mesmo tempo, é provável que seja
      // uma mudança no código (filtro, cálculo) e NÃO uma alteração real no Maxiprod.
      // Nesse caso, atualiza os hashes silenciosamente sem marcar como modificado.
      try {
        const acceptedRows = await db.select({
          pedido: productionAcceptance.pedido,
          orderHash: productionAcceptance.orderHash,
          wasModified: productionAcceptance.wasModified,
        }).from(productionAcceptance);

        // FASE 1: Identificar quais pedidos tiveram hash alterado
        const changedOrders: Array<{ pedido: string; currentHash: string; cliente: string; grupoKey: string }> = [];
        const missingHashOrders: Array<{ pedido: string; currentHash: string }> = [];

        // Buscar pedidos já autorizados para NÃO marcar como modificado
        const authorizedRows = await db.select({ pedido: billingAuthorizations.pedido }).from(billingAuthorizations);
        const authorizedSet = new Set(authorizedRows.map(r => r.pedido));

        for (const row of acceptedRows) {
          if (row.wasModified) continue; // Já marcado como modificado, não reprocessar
          const currentOrder = openOrders.find(o => o.pedido === row.pedido);
          if (!currentOrder) continue; // Pedido já faturado ou não existe mais
          
          const currentHash = currentOrder.orderHash;
          
          // Se não tem hash armazenado (migração), atualizar silenciosamente
          if (!row.orderHash) {
            missingHashOrders.push({ pedido: row.pedido, currentHash });
            continue;
          }
          
          // Se o hash mudou, registrar para análise
          if (row.orderHash !== currentHash) {
            // PROTEÇÃO: Se o pedido já está AUTORIZADO a faturar, apenas atualizar o hash
            // silenciosamente. NÃO marcar como modificado — a autorização é explícita do gestor.
            if (authorizedSet.has(row.pedido)) {
              missingHashOrders.push({ pedido: row.pedido, currentHash });
              continue;
            }
            changedOrders.push({
              pedido: row.pedido,
              currentHash,
              cliente: currentOrder.cliente,
              grupoKey: currentOrder.grupoKey,
            });
          }
        }

        // Atualizar hashes faltantes silenciosamente
        for (const { pedido, currentHash } of missingHashOrders) {
          await db.update(productionAcceptance)
            .set({ orderHash: currentHash })
            .where(eq(productionAcceptance.pedido, pedido));
        }

        // FASE 2: Decidir se é mudança real ou mudança de código
        // REGRA DE PROTEÇÃO: Se mais de 5 pedidos mudaram ao mesmo tempo,
        // é quase certamente uma mudança no código/filtro, NÃO no Maxiprod.
        // Nesse caso, atualiza os hashes silenciosamente sem marcar como modificado.
        const MASS_CHANGE_THRESHOLD = 5;
        
        if (changedOrders.length > MASS_CHANGE_THRESHOLD) {
          // MUDANÇA EM MASSA DETECTADA - provavelmente mudança no código
          console.warn(`[Auto-Revoke] PROTEÇÃO ATIVADA: ${changedOrders.length} pedidos com hash diferente (threshold: ${MASS_CHANGE_THRESHOLD}). Atualizando hashes silenciosamente sem marcar como modificado.`);
          for (const { pedido, currentHash } of changedOrders) {
            await db.update(productionAcceptance)
              .set({ orderHash: currentHash })
              .where(eq(productionAcceptance.pedido, pedido));
          }
          console.log(`[Auto-Revoke] ${changedOrders.length} hashes atualizados silenciosamente. Pedidos: ${changedOrders.map(o => o.pedido).join(', ')}`);
        } else if (changedOrders.length > 0) {
          // Poucos pedidos mudaram - provavelmente mudança real no Maxiprod
          for (const { pedido, currentHash, cliente, grupoKey } of changedOrders) {
            console.log(`[Auto-Revoke] Pedido #${pedido} foi modificado no Maxiprod`);
            await db.update(productionAcceptance)
              .set({ wasModified: true, modifiedAt: new Date(), orderHash: currentHash })
              .where(eq(productionAcceptance.pedido, pedido));
            // Gerar notificação de pedido modificado
            try {
              const { createNotification } = await import("./notificationRouter");
              await createNotification({
                type: "pedido_modificado",
                title: `Pedido #${pedido} Modificado`,
                message: `O pedido #${pedido} (${cliente}) foi alterado no Maxiprod e retornou ao Aceite da Produção.`,
                severity: "warning",
                metadata: { pedido, cliente, grupo: grupoKey },
              });
            } catch (e) { console.error("[Notification] Error:", e); }
          }
        }
      } catch (err) {
        console.error('[Auto-Revoke] Erro ao verificar modificações:', err);
      }

      // ===== BUSCAR DATAS DE NF PARA PEDIDOS FATURADOS =====
      // Busca a data da NF mais recente para cada pedido faturado
      // Usa essa data para o filtro de 30 dias (fallback: data de emissão)
      const billedPedidoNumbers = Array.from(billedMap.keys()).filter(k => k !== "sem-pedido");
      const nfDatesByPedido: Record<string, string> = {}; // pedido -> data NF mais recente (ISO)
      
      if (billedPedidoNumbers.length > 0) {
        try {
          // Step 1: Get item IDs for billed pedidos
          const pedidoNumbersStr = billedPedidoNumbers.map(p => `"${p}"`).join(", ");
          type PedidoItemResult = { id: number; pedidoDeVenda: { numero: string } };
          const pedidoItems = await fetchAllPages<PedidoItemResult>(
            "itensDosPedidosDeVendas",
            (skip, take) => `{
              itensDosPedidosDeVendas(
                skip: ${skip}, take: ${take},
                where: { pedidoDeVenda: { numero: { in: [${pedidoNumbersStr}] } } }
              ) {
                totalCount
                items {
                  id
                  pedidoDeVenda { numero }
                }
              }
            }`
          );
          
          if (pedidoItems.length > 0) {
            const itemToPedido = new Map<number, string>();
            for (const pi of pedidoItems) {
              itemToPedido.set(pi.id, pi.pedidoDeVenda.numero);
            }
            const allItemIds = Array.from(itemToPedido.keys());
            const batches: number[][] = [];
            for (let i = 0; i < allItemIds.length; i += 200) {
              batches.push(allItemIds.slice(i, i + 200));
            }
            
            type NfDateResult = {
              itemDoPedidoDeVendaId: number;
              notaFiscal: { emissaoData: string };
            };
            
            for (const batch of batches) {
              const idsStr = batch.join(",");
              const nfItems = await fetchAllPages<NfDateResult>(
                "itensDasNotasFiscais",
                (skip, take) => `{
                  itensDasNotasFiscais(
                    skip: ${skip}, take: ${take},
                    where: {
                      itemDoPedidoDeVendaId: { in: [${idsStr}] },
                      notaFiscal: { entradaOuSaida: { eq: SAIDA }, estado: { eq: EMITIDA } }
                    }
                  ) {
                    totalCount
                    items {
                      itemDoPedidoDeVendaId
                      notaFiscal { emissaoData }
                    }
                  }
                }`
              );
              
              for (const nfItem of nfItems) {
                const pedidoNum = itemToPedido.get(nfItem.itemDoPedidoDeVendaId);
                if (!pedidoNum) continue;
                const nfDate = nfItem.notaFiscal.emissaoData;
                if (!nfDate) continue;
                // Manter a data mais recente
                if (!nfDatesByPedido[pedidoNum] || nfDate > nfDatesByPedido[pedidoNum]) {
                  nfDatesByPedido[pedidoNum] = nfDate;
                }
              }
            }
          }
        } catch (err: any) {
          console.error("[Billing] Error fetching NF dates for billed orders:", err.message);
          // Continua sem datas de NF - usará fallback (data de emissão)
        }
      }
      
      // Filtro final de 30 dias: usa data da NF (quando disponível) ou data de emissão (fallback)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      
            const allBilledOrders = Array.from(billedMap.values()).map(o => {
        const valorRounded = Math.round(o.valorTotal * 100) / 100;
        const tipoEspecial = getTipoEspecial(o._estadoConfiguravel, o.observacoes, valorRounded);
        // Para pedidos AMOSTRA/BONIFICAÇÃO: inferir grupo dos itens e gerar label combinado
        let grupo = o.grupo;
        let grupoKey = o.grupoKey;
        if (isAmostraBonificacao(o._estadoConfiguravel)) {
          const itemGrupos = o.itens.map((i: any) => i.grupoDescricao || null);
          grupoKey = inferGrupoFromItems(itemGrupos);
          grupo = getAmostraBonificacaoLabel(tipoEspecial, grupoKey);
        }
        
        // Determinar data de faturamento: NF date > emissao date
        const nfDate = nfDatesByPedido[o.pedido] || null;
        const dataFaturamento = nfDate ? formatDate(nfDate) : null;
        
        return {
          ...o,
          valorTotal: valorRounded,
          tipoEspecial,
          grupo,
          grupoKey,
          dataFaturamento, // Data da NF mais recente (null se não houver NF)
        };
      });
      
      // Filtrar: manter pedidos onde a data da NF OU data de entrega OU data de emissão está dentro de 30 dias
      const billedOrders = allBilledOrders.filter(o => {
        // Prioridade 1: usar data da NF
        const nfDateStr = nfDatesByPedido[o.pedido];
        if (nfDateStr) {
          try {
            const nfDateObj = new Date(nfDateStr);
            return nfDateObj >= thirtyDaysAgo;
          } catch { /* fallback */ }
        }
        // Prioridade 2: usar data de entrega do pedido (formato DD/MM/YYYY)
        // Ex: pedido 384 emitido em jan mas entregue em mai deve aparecer nos últimos 30 dias
        if (o.dataEntrega) {
          try {
            const parts = o.dataEntrega.split("/");
            if (parts.length === 3) {
              const entregaDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
              if (entregaDate >= thirtyDaysAgo) return true;
            }
          } catch { /* fallback */ }
        }
        // Prioridade 3: usar data de emissão do pedido (formato DD/MM/YYYY)
        try {
          const parts = o.dataEmissao.split("/");
          if (parts.length === 3) {
            const emissaoDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            return emissaoDate >= thirtyDaysAgo;
          }
        } catch { /* skip */ }
        return false;
      });
      
      billedOrders.sort((a, b) => {
        // Sort by NF date (if available) then emissao date desc
        const nfA = nfDatesByPedido[a.pedido];
        const nfB = nfDatesByPedido[b.pedido];
        const dateA = nfA || a.dataEmissao.split("/").reverse().join("-");
        const dateB = nfB || b.dataEmissao.split("/").reverse().join("-");
        return dateB.localeCompare(dateA);
      });

      // ===== DETECÇÃO DE NOVOS PEDIDOS =====
      // Compara pedidos atuais com os que existiam na última sync
      try {
        const { createNotification } = await import("./notificationRouter");
        
        // Buscar lista de pedidos da última sync
        const lastKnownSetting = await db.select().from(appSettings).where(eq(appSettings.settingKey, "last_known_open_pedidos")).limit(1);
        const lastKnownPedidos: string[] = lastKnownSetting.length > 0 ? (Array.isArray(lastKnownSetting[0].settingValue) ? lastKnownSetting[0].settingValue as string[] : JSON.parse(String(lastKnownSetting[0].settingValue || '[]'))) : [];
        const currentPedidos = openOrders.map(o => o.pedido);
        
        // Detectar novos pedidos (estão no atual mas não no anterior)
        if (lastKnownPedidos.length > 0) {
          const newPedidos = currentPedidos.filter(p => !lastKnownPedidos.includes(p));
          for (const pedido of newPedidos) {
            const order = openOrders.find(o => o.pedido === pedido);
            if (order) {
              await createNotification({
                type: "novo_pedido",
                title: `Novo Pedido #${pedido}`,
                message: `Novo pedido de ${order.cliente} (${order.empresa}) - ${order.grupo}`,
                severity: "success",
                metadata: { pedido, cliente: order.cliente, empresa: order.empresa, grupo: order.grupoKey },
              });
            }
          }
        }
        
        // Salvar lista atual para próxima comparação
        if (lastKnownSetting.length === 0) {
          await db.insert(appSettings).values({ settingKey: "last_known_open_pedidos", settingValue: JSON.stringify(currentPedidos) });
        } else {
          await db.update(appSettings).set({ settingValue: JSON.stringify(currentPedidos) }).where(eq(appSettings.settingKey, "last_known_open_pedidos"));
        }

        // ===== DETECÇÃO DE ALTERAÇÃO DE OBSERVAÇÕES =====
        // Compara observações atuais com as da última sync
        try {
          const obsSettingKey = "last_known_obs_pedidos";
          const obsSetting = await db.select().from(appSettings).where(eq(appSettings.settingKey, obsSettingKey)).limit(1);
          const lastKnownObs: Record<string, string> = obsSetting.length > 0
            ? (typeof obsSetting[0].settingValue === 'string' ? JSON.parse(obsSetting[0].settingValue) : (obsSetting[0].settingValue || {}))
            : {};

          // Construir mapa atual de observações
          const currentObs: Record<string, string> = {};
          for (const order of openOrders) {
            currentObs[order.pedido] = order.observacoes || "";
          }

          // Detectar alterações (só se já temos dados anteriores)
          if (Object.keys(lastKnownObs).length > 0) {
            for (const pedido of Object.keys(currentObs)) {
              const oldObs = lastKnownObs[pedido] ?? "";
              const newObs = currentObs[pedido] ?? "";
              if (oldObs !== newObs && (oldObs !== "" || newObs !== "")) {
                const order = openOrders.find(o => o.pedido === pedido);
                const cliente = order?.cliente || "";
                // Evitar duplicata nas últimas 2h
                const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
                const { systemNotifications: sysNotifTable } = await import("../drizzle/schema");
                const existingObs = await db.select({ id: sysNotifTable.id })
                  .from(sysNotifTable)
                  .where(and(
                    eq(sysNotifTable.type, "observacao_alterada"),
                    sql`JSON_EXTRACT(metadata, '$.pedido') = ${pedido}`,
                    sql`${sysNotifTable.createdAt} > ${twoHoursAgo}`
                  ))
                  .limit(1);

                // Observação COMERCIAL (do Maxiprod) mudou → voltar pedido para Aceite
                // Remover productionAcceptance e billingAuthorizations para forçar re-aceite
                await db.delete(productionAcceptance).where(eq(productionAcceptance.pedido, pedido));
                await db.delete(billingAuthorizations).where(eq(billingAuthorizations.pedido, pedido));
                console.log(`[ObsComercial] Pedido #${pedido} voltou para Aceite - observação comercial alterada no Maxiprod`);

                if (existingObs.length === 0) {
                  const obsPreview = newObs.length > 80 ? newObs.substring(0, 80) + "..." : newObs;
                  await createNotification({
                    type: "observacao_alterada",
                    title: `Pedido #${pedido} voltou para Aceite (Obs. Comercial alterada)`,
                    message: oldObs === "" 
                      ? `Nova observação comercial no pedido #${pedido} (${cliente}): "${obsPreview}". Pedido retornou para Aceite da Produção.`
                      : `Observação comercial do pedido #${pedido} (${cliente}) foi alterada: "${obsPreview}". Pedido retornou para Aceite da Produção.`,
                    severity: "warning",
                    metadata: { pedido, cliente, oldObs: oldObs.substring(0, 200), newObs: newObs.substring(0, 200) },
                  });
                }
              }
            }
          }

          // Salvar observações atuais para próxima comparação
          if (obsSetting.length === 0) {
            await db.insert(appSettings).values({ settingKey: obsSettingKey, settingValue: JSON.stringify(currentObs) });
          } else {
            await db.update(appSettings).set({ settingValue: JSON.stringify(currentObs) }).where(eq(appSettings.settingKey, obsSettingKey));
          }
        } catch (obsErr) {
          console.error('[Notifications] Erro ao detectar alterações de observações:', obsErr);
        }

        // ===== VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS =====
        // Regra de negócio: É proibido passar venda sem Responsável, Segmento, Cond. Pagamento, Transportadora
        for (const order of openOrders) {
          const missingFields: string[] = [];
          if (!order.representante) missingFields.push("Representante");
          if (!order.segmento && !order.crmSegmento) missingFields.push("Segmento");
          if (!order.condicaoPagamento) missingFields.push("Condição de Pagamento");
          if (!order.transportadora) missingFields.push("Transportadora");
          
          if (missingFields.length > 0) {
            // Verificar se já existe notificação recente (últimas 6h) para este pedido
            const { systemNotifications: sysNotifTable } = await import("../drizzle/schema");
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
            const existing = await db.select({ id: sysNotifTable.id })
              .from(sysNotifTable)
              .where(and(
                eq(sysNotifTable.type, "campo_obrigatorio"),
                sql`JSON_EXTRACT(metadata, '$.pedido') = ${order.pedido}`,
                sql`${sysNotifTable.createdAt} > ${sixHoursAgo}`
              ))
              .limit(1);
            
            if (existing.length === 0) {
              const vendedor = order.representante || "Vendedor não identificado";
              await createNotification({
                type: "campo_obrigatorio",
                title: `Pedido #${order.pedido} - Campos Obrigatórios`,
                message: `Pedido de ${order.cliente} está sem: ${missingFields.join(", ")}. Responsável: ${vendedor}`,
                severity: "error",
                metadata: { pedido: order.pedido, cliente: order.cliente, vendedor, missingFields, empresa: order.empresa },
              });
            }
          }
        }
      } catch (err) {
        console.error('[Notifications] Erro ao gerar notificações:', err);
      }

      // Summary
      const openValue = openOrders.reduce((s, o) => s + o.valorTotal, 0);
      const billedValue = billedOrders.reduce((s, o) => s + o.valorTotal, 0);
      const partialOrders = openOrders.filter(o => o.estadoItem === "Faturado parcial");

      return {
        openOrders,
        billedOrders,
        summary: {
          openCount: openOrders.length,
          openValue: Math.round(openValue * 100) / 100,
          billedCount: billedOrders.length,
          billedValue: Math.round(billedValue * 100) / 100,
          partialCount: partialOrders.length,
          partialValue: Math.round(partialOrders.reduce((s, o) => s + o.valorTotal, 0) * 100) / 100,
        },
      };
    }),

  /**
   * Get all authorized pedidos (not yet billed)
   */
  getAuthorizedOrders: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { authorizedPedidos: [] as string[], authorizedTimes: {} as Record<string, string> };
      const rows = await db.select({ pedido: billingAuthorizations.pedido, authorizedAt: billingAuthorizations.authorizedAt }).from(billingAuthorizations);
      const authorizedTimes: Record<string, string> = {};
      for (const r of rows) {
        if (r.authorizedAt) {
          authorizedTimes[r.pedido] = r.authorizedAt.toISOString();
        }
      }
      return { authorizedPedidos: rows.map(r => r.pedido), authorizedTimes };
    }),

  /**
   * Authorize one or more pedidos for billing (requires password)
   */
  authorizeOrders: publicProcedure
    .input(z.object({
      password: z.string(),
      pedidos: z.array(z.string()).min(1).max(50),
    }))
    .mutation(async ({ input }) => {
      const isValid = await verifyBillingPassword(input.password);
      if (!isValid) return { success: false, error: "Senha incorreta" };

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      // Insert each pedido (ignore duplicates)
      for (const pedido of input.pedidos) {
        try {
          await db.insert(billingAuthorizations).values({ pedido });
        } catch (err: any) {
          // Ignore duplicate key errors
          const isDuplicate = err?.code === "ER_DUP_ENTRY" ||
            err?.message?.includes("Duplicate") ||
            err?.cause?.message?.includes("Duplicate") ||
            err?.cause?.code === "ER_DUP_ENTRY";
          if (!isDuplicate) throw err;
        }
      }

      return { success: true, count: input.pedidos.length };
    }),

  /**
   * Remove authorization from one or more pedidos (requires password)
   */
  deauthorizeOrders: publicProcedure
    .input(z.object({
      password: z.string(),
      pedidos: z.array(z.string()).min(1).max(50),
    }))
    .mutation(async ({ input }) => {
      const isValid = await verifyBillingPassword(input.password);
      if (!isValid) return { success: false, error: "Senha incorreta" };

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      await db.delete(billingAuthorizations).where(
        inArray(billingAuthorizations.pedido, input.pedidos)
      );

      return { success: true, count: input.pedidos.length };
    }),

  /**
   * Clean up: remove authorizations for pedidos that are already billed
   * Called automatically when loading the billing page
   */
  cleanupBilledAuthorizations: publicProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) return { removed: 0 };

      // Get all authorized pedidos
      const authorized = await db.select({ pedido: billingAuthorizations.pedido }).from(billingAuthorizations);
      if (authorized.length === 0) return { removed: 0 };

      // Check which ones are already billed (all items are "Faturado")
      const pedidoNums = authorized.map(a => a.pedido);
      const orderItems = await db
        .select({
          pedido: salesOrders.pedido,
          estadoItem: salesOrders.estadoItem,
        })
        .from(salesOrders)
        .where(inArray(salesOrders.pedido, pedidoNums));

      // Group by pedido and check if all items are billed
      const pedidoStates = new Map<string, Set<string>>();
      for (const item of orderItems) {
        if (!item.pedido) continue;
        if (!pedidoStates.has(item.pedido)) pedidoStates.set(item.pedido, new Set());
        pedidoStates.get(item.pedido)!.add(item.estadoItem || "");
      }

      const toRemove: string[] = [];
      for (const pedido of pedidoNums) {
        const states = pedidoStates.get(pedido);
        // PROTEÇÃO: Se o pedido não existe em sales_orders, NÃO remover autorização.
        // Pode ser uma condição temporária durante a sincronização (delete + re-insert atômico).
        if (!states) continue;
        
        // REGRA 1: Remover autorização quando TODOS os itens estão 100% "Faturado".
        // O pedido sai completamente do fluxo de faturamento.
        if (states.size === 1 && states.has("Faturado")) {
          toRemove.push(pedido);
          continue;
        }
        
        // REGRA 2: Faturamento parcial COMPLETO → desautorizar para voltar a "Pedidos em Aberto".
        // Só remove a autorização quando o pedido tem itens "Faturado" (já faturados)
        // E TAMBÉM tem itens restantes ("Faturado parcial" ou "A faturar").
        // Isso significa que uma remessa foi faturada e o restante precisa ser re-autorizado.
        // Se o pedido só tem "Faturado parcial" sem "Faturado", o faturamento ainda está
        // em andamento e o pedido deve PERMANECER autorizado.
        if (states.has("Faturado") && (states.has("Faturado parcial") || states.has("A faturar"))) {
          toRemove.push(pedido);
          continue;
        }
      }

      if (toRemove.length > 0) {
        await db.delete(billingAuthorizations).where(
          inArray(billingAuthorizations.pedido, toRemove)
        );
      }

      return { removed: toRemove.length };
    }),

  /**
   * Get all accepted pedidos (production acceptance)
   */
  getAcceptedOrders: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { acceptedPedidos: [] as string[], acceptedHashes: {} as Record<string, string | null>, modifiedPedidos: [] as string[] };
      const rows = await db.select({
        pedido: productionAcceptance.pedido,
        orderHash: productionAcceptance.orderHash,
        wasModified: productionAcceptance.wasModified,
      }).from(productionAcceptance);
      const hashMap: Record<string, string | null> = {};
      const modifiedPedidos: string[] = [];
      for (const r of rows) {
        hashMap[r.pedido] = r.orderHash;
        if (r.wasModified) modifiedPedidos.push(r.pedido);
      }
      return {
        acceptedPedidos: rows.filter(r => !r.wasModified).map(r => r.pedido),
        acceptedHashes: hashMap,
        modifiedPedidos,
      };
    }),

  /**
   * Accept one or more pedidos (production acceptance - requires password)
   */
  acceptOrders: publicProcedure
    .input(z.object({
      password: z.string(),
      pedidos: z.array(z.string()).min(1).max(50),
      orderHashes: z.record(z.string(), z.string()).optional(), // { pedido: hash } - computed on frontend
    }))
    .mutation(async ({ input }) => {
      const isValid = await verifyBillingPassword(input.password);
      if (!isValid) {
        // Gerar notificação de senha inválida
        try {
          const { createNotification } = await import("./notificationRouter");
          await createNotification({
            type: "senha_invalida",
            title: "Tentativa de Aceite com Senha Inválida",
            message: `Tentativa de aceitar pedidos ${input.pedidos.join(", ")} com senha incorreta.`,
            severity: "error",
            metadata: { pedidos: input.pedidos, action: "acceptOrders" },
          });
        } catch (e) { console.error("[Notification] Error:", e); }
        return { success: false, error: "Senha incorreta" };
      }

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      for (const pedido of input.pedidos) {
        const hash = input.orderHashes?.[pedido] || null;
        try {
          await db.insert(productionAcceptance).values({ pedido, orderHash: hash, wasModified: false });
        } catch (err: any) {
          const isDuplicate = err?.code === "ER_DUP_ENTRY" ||
            err?.message?.includes("Duplicate") ||
            err?.cause?.message?.includes("Duplicate") ||
            err?.cause?.code === "ER_DUP_ENTRY";
          if (isDuplicate) {
            // Se já existe (re-aceite de pedido modificado), resetar wasModified e atualizar hash
            await db.update(productionAcceptance)
              .set({ orderHash: hash, wasModified: false, modifiedAt: null })
              .where(eq(productionAcceptance.pedido, pedido));
          } else {
            throw err;
          }
        }
      }

      return { success: true, count: input.pedidos.length };
    }),

  /**
   * Remove production acceptance from one or more pedidos (requires password)
   */
  rejectAcceptance: publicProcedure
    .input(z.object({
      password: z.string(),
      pedidos: z.array(z.string()).min(1).max(50),
    }))
    .mutation(async ({ input }) => {
      const isValid = await verifyBillingPassword(input.password);
      if (!isValid) return { success: false, error: "Senha incorreta" };

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      await db.delete(productionAcceptance).where(
        inArray(productionAcceptance.pedido, input.pedidos)
      );

      return { success: true, count: input.pedidos.length };
    }),

  /**
   * Clean up: remove acceptance for pedidos that are already billed
   */
  cleanupBilledAcceptance: publicProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) return { removed: 0 };

      const accepted = await db.select({ pedido: productionAcceptance.pedido }).from(productionAcceptance);
      if (accepted.length === 0) return { removed: 0 };

      const pedidoNums = accepted.map(a => a.pedido);
      const orderItems = await db
        .select({
          pedido: salesOrders.pedido,
          estadoItem: salesOrders.estadoItem,
        })
        .from(salesOrders)
        .where(inArray(salesOrders.pedido, pedidoNums));

      const pedidoStates = new Map<string, Set<string>>();
      for (const item of orderItems) {
        if (!item.pedido) continue;
        if (!pedidoStates.has(item.pedido)) pedidoStates.set(item.pedido, new Set());
        pedidoStates.get(item.pedido)!.add(item.estadoItem || "");
      }

      const toRemove: string[] = [];
      for (const pedido of pedidoNums) {
        const states = pedidoStates.get(pedido);
        // PROTEÇÃO: Se o pedido não existe em sales_orders, NÃO remover aceite.
        // Pode ser condição temporária durante sincronização.
        // Só remover se o pedido EXISTE e TODOS os itens estão "Faturado".
        if (states && states.size === 1 && states.has("Faturado")) {
          toRemove.push(pedido);
        }
      }

      if (toRemove.length > 0) {
        await db.delete(productionAcceptance).where(
          inArray(productionAcceptance.pedido, toRemove)
        );
      }

      return { removed: toRemove.length };
    }),

  /**
   * Recalculate order hashes for all accepted orders AND reset wasModified flags.
   * Uses local DB salesOrders data (same source as getOpenOrders) to compute fresh hashes.
   * This fixes false auto-revoke caused by code changes (e.g., filter changes).
   */
  recalcOrderHashes: publicProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) return { success: false, updated: 0, resetModified: 0 };

      // Get all accepted orders
      const acceptedRows = await db.select({
        pedido: productionAcceptance.pedido,
        orderHash: productionAcceptance.orderHash,
        wasModified: productionAcceptance.wasModified,
      }).from(productionAcceptance);

      // Get sales order items from local DB (same source as getOpenOrders)
      const allItems = await db.select().from(salesOrders);
      // REGRA: "Faturado c/ entrega futura" = faturou financeiro mas mercadoria ainda não entregue
      const openItems = allItems.filter(i => 
        (i.estadoItem === "A faturar" || i.estadoItem === "Faturado parcial" || i.estadoItem === "Faturado c/ entrega futura") &&
        isAprovadoOuFaturado(i.estadoNota)
      );

      // Helper to format ISO date to DD/MM/YYYY (same as getOpenOrders)
      const formatDate = (d: string | null): string => {
        if (!d) return "";
        // Extract date directly from ISO string to avoid timezone conversion issues
        // e.g. '2026-05-07T00:00:00.000-03:00' -> '07/05/2026'
        const isoMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
        }
        // Already in dd/mm/yyyy format
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
        try {
          const date = new Date(d);
          if (isNaN(date.getTime())) return d;
          return date.toLocaleDateString("pt-BR");
        } catch { return d; }
      };

      // Build order map with EXACT same logic as getOpenOrders
      const orderMap = new Map<string, any>();
      for (const item of openItems) {
        const key = item.pedido || "";
        if (!key) continue;
        if (!orderMap.has(key)) {
          orderMap.set(key, {
            pedido: item.pedido || "",
            cliente: item.cliente || "",
            dataEntrega: formatDate(item.dataEntrega),
            observacoes: item.observacoes || "",
            valorTotal: 0,
            itens: [] as any[],
          });
        }
        const order = orderMap.get(key)!;
        const vtOriginal = parseFloat(String(item.valorTotal || 0));
        const qtdOriginal = parseFloat(String(item.quantidade || 0));
        const qtdFaturada = item.quantidadeFaturada ? parseFloat(String(item.quantidadeFaturada)) : 0;
        const vuOriginal = parseFloat(String(item.valorUnitario || 0));
        const isParcial = item.estadoItem === "Faturado parcial" && qtdFaturada > 0;
        const qtdEfetiva = isParcial ? Math.max(qtdOriginal - qtdFaturada, 0) : qtdOriginal;
        const vtEfetivo = isParcial ? (qtdEfetiva * vuOriginal) : vtOriginal;
        order.valorTotal += vtEfetivo;
        order.itens.push({
          descricao: item.descricao || "",
          quantidade: qtdEfetiva,
          valorUnitario: vuOriginal,
          valorTotal: Math.round(vtEfetivo * 100) / 100,
        });
      }

      let updated = 0;
      let resetModified = 0;
      for (const row of acceptedRows) {
        const orderData = orderMap.get(row.pedido);
        if (!orderData) continue;
        const valorRounded = Math.round(orderData.valorTotal * 100) / 100;
        const newHash = computeOrderHash({
          pedido: orderData.pedido,
          cliente: orderData.cliente,
          dataEntrega: orderData.dataEntrega,
          observacoes: orderData.observacoes,
          valorTotal: valorRounded,
          itens: orderData.itens,
        });
        const needsHashUpdate = row.orderHash !== newHash;
        const needsModifiedReset = row.wasModified;
        if (needsHashUpdate || needsModifiedReset) {
          await db.update(productionAcceptance)
            .set({ orderHash: newHash, wasModified: false, modifiedAt: null })
            .where(eq(productionAcceptance.pedido, row.pedido));
          if (needsHashUpdate) updated++;
          if (needsModifiedReset) resetModified++;
          console.log(`[RecalcHashes] Pedido #${row.pedido}: hash ${needsHashUpdate ? 'updated' : 'same'}, wasModified ${needsModifiedReset ? 'reset' : 'same'}`);
        }
      }

      console.log(`[RecalcHashes] Updated ${updated} hashes, reset ${resetModified} wasModified flags out of ${acceptedRows.length} total`);
      return { success: true, updated, resetModified, total: acceptedRows.length };
    }),

  /**
   * Get all production notes for given pedidos
   */
  getProductionNotes: publicProcedure
    .input(z.object({
      pedidos: z.array(z.string()).max(2000),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { notes: {} as Record<string, { note: string; updatedAt: Date | null; updatedBy: string | null }> };

      if (input.pedidos.length === 0) return { notes: {} };

      const rows = await db
        .select({
          pedido: productionNotes.pedido,
          note: productionNotes.note,
          updatedAt: productionNotes.updatedAt,
          updatedBy: productionNotes.updatedBy,
        })
        .from(productionNotes)
        .where(inArray(productionNotes.pedido, input.pedidos));

      const notes: Record<string, { note: string; updatedAt: Date | null; updatedBy: string | null }> = {};
      for (const r of rows) {
        notes[r.pedido] = { note: r.note, updatedAt: r.updatedAt, updatedBy: r.updatedBy };
      }

      return { notes };
    }),

  /**
   * Save or update a production note for a pedido (requires password)
   */
  saveProductionNote: publicProcedure
    .input(z.object({
      password: z.string(),
      pedido: z.string(),
      note: z.string().max(1000),
    }))
    .mutation(async ({ input }) => {
      const isValid = await verifyBillingPassword(input.password);
      if (!isValid) return { success: false, error: "Senha incorreta" };

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      if (input.note.trim() === "") {
        // Delete note if empty
        await db.delete(productionNotes).where(eq(productionNotes.pedido, input.pedido));
        return { success: true };
      }

      // Upsert: try insert, on duplicate update
      try {
        await db.insert(productionNotes).values({
          pedido: input.pedido,
          note: input.note.trim(),
        });
      } catch (err: any) {
        const isDuplicate = err.message?.includes("Duplicate") ||
          err.code === "ER_DUP_ENTRY" ||
          err.errno === 1062 ||
          err.cause?.message?.includes("Duplicate") ||
          err.cause?.code === "ER_DUP_ENTRY";
        if (isDuplicate) {
          await db.update(productionNotes)
            .set({ note: input.note.trim() })
            .where(eq(productionNotes.pedido, input.pedido));
        } else {
          throw err;
        }
      }

      return { success: true };
    }),

  getInvoicesForOrders: publicProcedure
    .input(z.object({
      pedidos: z.array(z.string()).max(2000),
    }))
    .query(async ({ input }) => {
      const { pedidos } = input;
      if (pedidos.length === 0) return { invoicesByPedido: {} };

      try {
        // Step 1: Get all pedido item IDs for the given order numbers
        const pedidoNumbers = pedidos.map(p => `"${p}"`).join(", ");
        
        type PedidoItemResult = {
          id: number;
          pedidoDeVenda: { numero: string };
        };

        const pedidoItems = await fetchAllPages<PedidoItemResult>(
          "itensDosPedidosDeVendas",
          (skip, take) => `{
            itensDosPedidosDeVendas(
              skip: ${skip}, take: ${take},
              where: { pedidoDeVenda: { numero: { in: [${pedidoNumbers}] } } }
            ) {
              totalCount
              items {
                id
                pedidoDeVenda { numero }
              }
            }
          }`
        );

        if (pedidoItems.length === 0) return { invoicesByPedido: {} };

        // Build map: itemId -> pedido number
        const itemToPedido = new Map<number, string>();
        for (const pi of pedidoItems) {
          itemToPedido.set(pi.id, pi.pedidoDeVenda.numero);
        }

        // Step 2: Get NF items linked to these pedido item IDs
        const itemIds = pedidoItems.map(pi => pi.id);
        
        // Split into batches of 100 IDs to avoid query too large
        const batchSize = 100;
        const batches: number[][] = [];
        for (let i = 0; i < itemIds.length; i += batchSize) {
          batches.push(itemIds.slice(i, i + batchSize));
        }

        type NfItemResult = {
          itemDoPedidoDeVendaId: number;
          notaFiscal: {
            numero: string;
            serie: string;
            chaveDeAcesso: string | null;
            emissaoData: string;
            valorTotal: number;
          };
        };

        let allNfItems: NfItemResult[] = [];
        
        for (const batch of batches) {
          const idsStr = batch.join(",");
          const nfItems = await fetchAllPages<NfItemResult>(
            "itensDasNotasFiscais",
            (skip, take) => `{
              itensDasNotasFiscais(
                skip: ${skip}, take: ${take},
                where: {
                  itemDoPedidoDeVendaId: { in: [${idsStr}] },
                  notaFiscal: { entradaOuSaida: { eq: SAIDA }, estado: { eq: EMITIDA } }
                }
              ) {
                totalCount
                items {
                  itemDoPedidoDeVendaId
                  notaFiscal {
                    numero
                    serie
                    chaveDeAcesso
                    emissaoData
                    valorTotal
                  }
                }
              }
            }`
          );
          allNfItems = allNfItems.concat(nfItems);
        }

        // Step 3: Group NFs by pedido number (deduplicate by NF number)
        const invoicesByPedido: Record<string, NfInfo[]> = {};

        for (const nfItem of allNfItems) {
          const pedidoNum = itemToPedido.get(nfItem.itemDoPedidoDeVendaId);
          if (!pedidoNum) continue;

          if (!invoicesByPedido[pedidoNum]) {
            invoicesByPedido[pedidoNum] = [];
          }

          // Deduplicate: same NF number should appear only once per pedido
          const nf = nfItem.notaFiscal;
          const existing = invoicesByPedido[pedidoNum].find(
            n => n.numero === nf.numero && n.serie === nf.serie
          );
          if (!existing) {
            invoicesByPedido[pedidoNum].push({
              numero: nf.numero,
              serie: nf.serie,
              chaveDeAcesso: nf.chaveDeAcesso || null,
              emissaoData: nf.emissaoData || "",
              valorTotal: nf.valorTotal || 0,
            });
          }
        }

        return { invoicesByPedido };
      } catch (err: any) {
        console.error("[Billing] Error fetching invoices:", err.message);
        return { invoicesByPedido: {} };
      }
    }),

  /**
   * Get production statuses for a list of pedidos
   */
  getProductionStatuses: publicProcedure
    .input(z.object({
      pedidos: z.array(z.string()).max(2000),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { statuses: {} as Record<string, { status: string; updatedAt: Date | null }> };

      if (input.pedidos.length === 0) return { statuses: {} };

      const rows = await db
        .select({
          pedido: productionStatus.pedido,
          status: productionStatus.status,
          updatedAt: productionStatus.updatedAt,
        })
        .from(productionStatus)
        .where(inArray(productionStatus.pedido, input.pedidos));

      const statuses: Record<string, { status: string; updatedAt: Date | null }> = {};
      for (const r of rows) {
        statuses[r.pedido] = { status: r.status, updatedAt: r.updatedAt };
      }

      return { statuses };
    }),

  /**
   * Save or update a production status for a pedido (requires password)
   */
  saveProductionStatus: publicProcedure
    .input(z.object({
      password: z.string(),
      pedido: z.string(),
      status: z.string().max(50),
    }))
    .mutation(async ({ input }) => {
      const isValid = await verifyBillingPassword(input.password);
      if (!isValid) return { success: false, error: "Senha incorreta" };

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      if (input.status.trim() === "") {
        // Delete status if empty
        await db.delete(productionStatus).where(eq(productionStatus.pedido, input.pedido));
        return { success: true };
      }

      // Upsert: try insert, on duplicate update
      try {
        await db.insert(productionStatus).values({
          pedido: input.pedido,
          status: input.status.trim(),
        });
      } catch (err: any) {
        const isDuplicate = err.message?.includes("Duplicate") ||
          err.code === "ER_DUP_ENTRY" ||
          err.errno === 1062 ||
          err.cause?.message?.includes("Duplicate") ||
          err.cause?.code === "ER_DUP_ENTRY";
        if (isDuplicate) {
          await db.update(productionStatus)
            .set({ status: input.status.trim() })
            .where(eq(productionStatus.pedido, input.pedido));
        } else {
          throw err;
        }
      }

      return { success: true };
    }),

  // ---- Collection Status (Faturados) ----
  getCollectionStatuses: publicProcedure
    .input(z.object({ pedidos: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.pedidos.length === 0) return { statuses: {} };
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const rows = await db.select().from(collectionStatus).where(inArray(collectionStatus.pedido, input.pedidos));
      const statuses: Record<string, { pedidoColeta: boolean; coletado: boolean }> = {};
      for (const row of rows) {
        statuses[row.pedido] = { pedidoColeta: row.pedidoColeta, coletado: row.coletado };
      }
      return { statuses };
    }),

  setCollectionStatus: publicProcedure
    .input(z.object({
      pedido: z.string(),
      field: z.enum(["pedidoColeta", "coletado"]),
      value: z.boolean(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Verify password (accepts operator passwords + admin/billing passwords)
      const isValid = await verifyBillingPassword(input.password);
      if (!isValid) {
        throw new Error("Senha incorreta");
      }

      // Verify operator has the specific granular permission for this action
      const permKey = input.field === "pedidoColeta" ? "fat.pedidoColeta" : "fat.coletado";
      const opRows = await db.select().from(operators).where(and(eq(operators.password, input.password), eq(operators.active, true))).limit(1);
      if (opRows.length > 0) {
        // Check if permission exists and is explicitly disabled
        const permRows = await db.select().from(operatorGranularPermissions)
          .where(and(
            eq(operatorGranularPermissions.operatorId, opRows[0].id),
            eq(operatorGranularPermissions.permissionKey, permKey)
          )).limit(1);
        // If permission exists and is disabled, block
        if (permRows.length > 0 && !permRows[0].enabled) {
          throw new Error(`Operador ${opRows[0].name} não tem permissão para ${input.field === "pedidoColeta" ? "Pedido de Coleta" : "Marcar Coletado"}`);
        }
        // If permission doesn't exist in DB, allow by default (matches frontend hasGranularAccess behavior)
      }

      // Identify who is making the change (operator name from password)
      let operatorName: string | null = null;
      if (opRows.length > 0) {
        operatorName = opRows[0].name;
      } else {
        // Check if it's the admin password
        const adminRow = await db.select().from(appSettings).where(eq(appSettings.settingKey, "admin_password")).limit(1);
        if (adminRow.length > 0 && adminRow[0].settingValue === input.password) {
          operatorName = "Admin";
        }
        // Check billing password
        const billingRow = await db.select().from(appSettings).where(eq(appSettings.settingKey, "billing_password")).limit(1);
        if (!operatorName && billingRow.length > 0 && billingRow[0].settingValue === input.password) {
          operatorName = "Faturamento";
        }
      }

      const updateData = input.field === "pedidoColeta"
        ? { pedidoColeta: input.value }
        : { coletado: input.value };

      try {
        await db.insert(collectionStatus).values({
          pedido: input.pedido,
          pedidoColeta: input.field === "pedidoColeta" ? input.value : false,
          coletado: input.field === "coletado" ? input.value : false,
          updatedBy: operatorName,
        });
      } catch (err: any) {
        const isDuplicate = err?.code === "ER_DUP_ENTRY" || err?.message?.includes("Duplicate") || err?.cause?.message?.includes("Duplicate");
        if (isDuplicate) {
          await db.update(collectionStatus)
            .set({ ...updateData, updatedBy: operatorName, updatedAt: new Date() })
            .where(eq(collectionStatus.pedido, input.pedido));
        } else {
          throw err;
        }
      }

      return { success: true };
    }),

  /**
   * Get transport selections for a list of pedidos
   */
  getTransportSelections: publicProcedure
    .input(z.object({ pedidos: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.pedidos.length === 0) return {};
      const db = await getDb();
      if (!db) return {};
      const rows = await db.select().from(transportSelection)
        .where(inArray(transportSelection.pedido, input.pedidos));
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.pedido] = row.transportadora;
      }
      return map;
    }),

  /**
   * Get transport selection history for a pedido
   */
  getTransportHistory: publicProcedure
    .input(z.object({ pedido: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(transportSelectionHistory)
        .where(eq(transportSelectionHistory.pedido, input.pedido))
        .orderBy(desc(transportSelectionHistory.createdAt));
      return rows;
    }),

  /**
   * Set transport selection for a pedido (password-protected)
   */
  setTransportSelection: publicProcedure
    .input(z.object({
      pedido: z.string(),
      transportadora: z.string(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const isValid = await verifyBillingPassword(input.password);
      if (!isValid) {
        throw new Error("Senha incorreta");
      }

      // Identify who is making the change (operator name from password)
      let operatorName = "Desconhecido";
      const opRows = await db.select().from(operators).where(and(eq(operators.password, input.password), eq(operators.active, true))).limit(1);
      if (opRows.length > 0) {
        operatorName = opRows[0].name;
      } else {
        const adminRow = await db.select().from(appSettings).where(eq(appSettings.settingKey, "admin_password")).limit(1);
        if (adminRow.length > 0 && adminRow[0].settingValue === input.password) {
          operatorName = "Admin";
        } else {
          const billingRow = await db.select().from(appSettings).where(eq(appSettings.settingKey, "billing_auth_password")).limit(1);
          if (billingRow.length > 0 && billingRow[0].settingValue === input.password) {
            operatorName = "Faturamento";
          }
        }
      }

      // Get previous transportadora (if any)
      const existingRows = await db.select().from(transportSelection).where(eq(transportSelection.pedido, input.pedido)).limit(1);
      const transportadoraAnterior = existingRows.length > 0 ? existingRows[0].transportadora : null;

      // Only record history if there's actually a change
      const isChange = transportadoraAnterior !== input.transportadora;

      // Insert or update the transport selection
      try {
        await db.insert(transportSelection).values({
          pedido: input.pedido,
          transportadora: input.transportadora,
          updatedBy: operatorName,
        });
      } catch (err: any) {
        const isDuplicate = err?.code === "ER_DUP_ENTRY" || err?.message?.includes("Duplicate") || err?.cause?.message?.includes("Duplicate");
        if (isDuplicate) {
          await db.update(transportSelection)
            .set({ transportadora: input.transportadora, updatedBy: operatorName, updatedAt: new Date() })
            .where(eq(transportSelection.pedido, input.pedido));
        } else {
          throw err;
        }
      }

      // Record in history (always, even first time)
      if (isChange) {
        await db.insert(transportSelectionHistory).values({
          pedido: input.pedido,
          transportadoraAnterior: transportadoraAnterior,
          transportadoraNova: input.transportadora,
          alteradoPor: operatorName,
        });

        // Criar notificação de troca de transportadora
        try {
          const { createNotification } = await import("./notificationRouter");
          const anterior = transportadoraAnterior || "(nenhuma)";
          await createNotification({
            type: "troca_transportadora",
            title: `Transportadora alterada - Pedido #${input.pedido}`,
            message: `${operatorName} alterou a transportadora do pedido #${input.pedido}: ${anterior} → ${input.transportadora}`,
            severity: "info",
            metadata: { pedido: input.pedido, operador: operatorName, anterior, nova: input.transportadora },
          });
        } catch (e) { console.error("[Notification] Error creating troca_transportadora:", e); }
      }

      return { success: true };
    }),

  /**
   * Get tracking links for a list of pedidos
   */
  getTrackingLinks: publicProcedure
    .input(z.object({ pedidos: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.pedidos.length === 0) return {};
      const db = await getDb();
      if (!db) return {};
      const rows = await db.select().from(trackingLinks)
        .where(inArray(trackingLinks.pedido, input.pedidos));
      const map: Record<string, { trackingUrl: string; updatedBy: string | null }> = {};
      for (const r of rows) {
        map[r.pedido] = { trackingUrl: r.trackingUrl, updatedBy: r.updatedBy };
      }
      return map;
    }),

  /**
   * Set tracking link for a pedido (password-protected, requires fat.rastreio permission)
   */
  setTrackingLink: publicProcedure
    .input(z.object({
      pedido: z.string(),
      trackingUrl: z.string(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const isValid = await verifyBillingPassword(input.password);
      if (!isValid) {
        throw new Error("Senha incorreta");
      }

      // Verify operator has fat.rastreio permission
      const opRows = await db.select().from(operators).where(and(eq(operators.password, input.password), eq(operators.active, true))).limit(1);
      if (opRows.length > 0) {
        const permRows = await db.select().from(operatorGranularPermissions)
          .where(and(
            eq(operatorGranularPermissions.operatorId, opRows[0].id),
            eq(operatorGranularPermissions.permissionKey, "fat.rastreio"),
            eq(operatorGranularPermissions.enabled, true)
          )).limit(1);
        if (permRows.length === 0) {
          throw new Error("Sem permissão para gerenciar links de rastreio");
        }
      }

      if (input.trackingUrl.trim() === "") {
        // Remove tracking link if empty
        await db.delete(trackingLinks)
          .where(eq(trackingLinks.pedido, input.pedido));
        return { success: true };
      }

      try {
        await db.insert(trackingLinks).values({
          pedido: input.pedido,
          trackingUrl: input.trackingUrl.trim(),
          updatedBy: input.password,
        });
      } catch (err: any) {
        const isDuplicate = err?.code === "ER_DUP_ENTRY" || err?.message?.includes("Duplicate") || err?.cause?.message?.includes("Duplicate");
        if (isDuplicate) {
          await db.update(trackingLinks)
            .set({ trackingUrl: input.trackingUrl.trim(), updatedBy: input.password, updatedAt: new Date() })
            .where(eq(trackingLinks.pedido, input.pedido));
        } else {
          throw err;
        }
      }

      return { success: true };
    }),

  /**
   * Get pickup schedules for a list of pedidos
   */
  getPickupSchedules: publicProcedure
    .input(z.object({ pedidos: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.pedidos.length === 0) return {};
      const db = await getDb();
      if (!db) return {};
      const rows = await db.select().from(pickupSchedule)
        .where(inArray(pickupSchedule.pedido, input.pedidos));
      const map: Record<string, { pickupDate: string; pickupHour: number }> = {};
      for (const r of rows) {
        map[r.pedido] = { pickupDate: r.pickupDate, pickupHour: r.pickupHour };
      }
      return map;
    }),

  /**
   * Set pickup schedule for a pedido (password-protected)
   */
  setPickupSchedule: publicProcedure
    .input(z.object({
      pedido: z.string(),
      pickupDate: z.string(),
      pickupHour: z.number().min(0).max(23),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const isValid = await verifyBillingPassword(input.password);
      if (!isValid) {
        throw new Error("Senha incorreta");
      }

      try {
        await db.insert(pickupSchedule).values({
          pedido: input.pedido,
          pickupDate: input.pickupDate,
          pickupHour: input.pickupHour,
        });
      } catch (err: any) {
        const isDuplicate = err?.code === "ER_DUP_ENTRY" || err?.message?.includes("Duplicate") || err?.cause?.message?.includes("Duplicate");
        if (isDuplicate) {
          await db.update(pickupSchedule)
            .set({ pickupDate: input.pickupDate, pickupHour: input.pickupHour, updatedAt: new Date() })
            .where(eq(pickupSchedule.pedido, input.pedido));
        } else {
          throw err;
        }
      }

      return { success: true };
    }),

  clearPickupSchedule: publicProcedure
    .input(z.object({
      pedido: z.string(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const isValid = await verifyBillingPassword(input.password);
      if (!isValid) {
        throw new Error("Senha incorreta");
      }

      await db.delete(pickupSchedule).where(eq(pickupSchedule.pedido, input.pedido));

      return { success: true };
    }),

  /**
   * Get all billing observations for authorized orders
   */
  getBillingObservations: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { observations: {} as Record<string, { observation: string; updatedBy: string | null; updatedAt: Date }> };
      const rows = await db.select().from(billingObservations);
      const map: Record<string, { observation: string; updatedBy: string | null; updatedAt: Date }> = {};
      for (const row of rows) {
        map[row.pedido] = { observation: row.observation, updatedBy: row.updatedBy, updatedAt: row.updatedAt };
      }
      return { observations: map };
    }),

  /**
   * Set or update billing observation for an authorized order
   * Requires password and granular permission fat.observacaoFaturar
   */
  setBillingObservation: publicProcedure
    .input(z.object({
      pedido: z.string(),
      observation: z.string().max(1000),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify password against any operator with fat.observacaoFaturar permission
      const allOperators = await db.select().from(operators).where(eq(operators.active, true));
      let operatorName: string | null = null;
      for (const op of allOperators) {
        if (op.password === input.password) {
          // Check if this operator has the granular permission
          const perms = await db.select().from(operatorGranularPermissions)
            .where(and(
              eq(operatorGranularPermissions.operatorId, op.id),
              eq(operatorGranularPermissions.permissionKey, "fat.observacaoFaturar"),
              eq(operatorGranularPermissions.enabled, true)
            ));
          if (perms.length > 0) {
            operatorName = op.name;
            break;
          }
        }
      }

      // Also check admin password as fallback
      if (!operatorName) {
        const settings = await db.select().from(appSettings)
          .where(eq(appSettings.settingKey, "billing_admin_password"));
        const adminPassword = settings.length > 0 ? settings[0].settingValue : DEFAULT_ADMIN_PASSWORD;
        if (input.password === adminPassword) {
          operatorName = "Admin";
        }
      }

      if (!operatorName) {
        return { success: false, error: "Senha incorreta ou sem permissão" };
      }

      if (input.observation.trim() === "") {
        // Remove observation if empty
        await db.delete(billingObservations).where(eq(billingObservations.pedido, input.pedido));
        return { success: true };
      }

      // Buscar observação anterior para detectar alteração
      const existingObs = await db.select().from(billingObservations).where(eq(billingObservations.pedido, input.pedido)).limit(1);
      const oldObservation = existingObs.length > 0 ? existingObs[0].observation : "";

      try {
        await db.insert(billingObservations).values({
          pedido: input.pedido,
          observation: input.observation.trim(),
          updatedBy: operatorName,
        });
      } catch (err: any) {
        const isDuplicate = err?.code === "ER_DUP_ENTRY" || err?.message?.includes("Duplicate") || err?.cause?.message?.includes("Duplicate");
        if (isDuplicate) {
          await db.update(billingObservations)
            .set({ observation: input.observation.trim(), updatedBy: operatorName, updatedAt: new Date() })
            .where(eq(billingObservations.pedido, input.pedido));
        } else {
          throw err;
        }
      }

      // NOTA: A observação de faturamento (campo laranja) NÃO deve fazer o pedido
      // voltar para o Aceite. Apenas alterações na observação COMERCIAL (do Maxiprod)
      // devem causar essa volta. O campo laranja é apenas informativo para o faturamento.
      if (input.observation.trim() !== oldObservation) {
        console.log(`[ObsChange] Pedido #${input.pedido} teve observação de faturamento alterada por ${operatorName} (NÃO volta para Aceite)`);
      }

      return { success: true };
    }),

  /**
   * Track a shipment via Alfa Transportes API
   * Receives pedido number, resolves NF via Maxiprod, then queries Alfa tracking
   */
  trackAlfaShipment: publicProcedure
    .input(z.object({
      pedido: z.string(),
      nfNumero: z.string().optional(), // If NF is already known, skip lookup
    }))
    .mutation(async ({ input }) => {
      const { trackAllAlfaCnpjs } = await import("./alfaApi");

      let nfNumber = input.nfNumero;

      // If NF not provided, resolve from Maxiprod
      if (!nfNumber) {
        try {
          const pedidoNumbers = [`"${input.pedido}"`].join(", ");

          type PedidoItemResult = {
            id: number;
            pedidoDeVenda: { numero: string };
          };

          const pedidoItems = await fetchAllPages<PedidoItemResult>(
            "itensDosPedidosDeVendas",
            (skip: number, take: number) => `{
              itensDosPedidosDeVendas(
                skip: ${skip}, take: ${take},
                where: { pedidoDeVenda: { numero: { in: [${pedidoNumbers}] } } }
              ) {
                totalCount
                items {
                  id
                  pedidoDeVenda { numero }
                }
              }
            }`
          );

          if (pedidoItems.length === 0) {
            return { success: false, error: "Nenhum item de pedido encontrado no Maxiprod" };
          }

          const itemIds = pedidoItems.map(pi => pi.id);
          const idsStr = itemIds.slice(0, 100).join(",");

          type NfItemResult = {
            itemDoPedidoDeVendaId: number;
            notaFiscal: {
              numero: string;
              serie: string;
              chaveDeAcesso: string | null;
              emissaoData: string;
            };
          };

          const nfItems = await fetchAllPages<NfItemResult>(
            "itensDasNotasFiscais",
            (skip: number, take: number) => `{
              itensDasNotasFiscais(
                skip: ${skip}, take: ${take},
                where: {
                  itemDoPedidoDeVendaId: { in: [${idsStr}] },
                  notaFiscal: { entradaOuSaida: { eq: SAIDA }, estado: { eq: EMITIDA } }
                }
              ) {
                totalCount
                items {
                  itemDoPedidoDeVendaId
                  notaFiscal {
                    numero
                    serie
                    chaveDeAcesso
                    emissaoData
                  }
                }
              }
            }`
          );

          if (nfItems.length === 0) {
            return { success: false, error: "Nenhuma NF emitida encontrada para este pedido" };
          }

          // Use the first NF found
          nfNumber = nfItems[0].notaFiscal.numero;
        } catch (err: any) {
          return { success: false, error: `Erro ao buscar NF: ${err.message}` };
        }
      }

      // Now call Alfa tracking API
      try {
        const result = await trackAllAlfaCnpjs(nfNumber);

        if (result.success && result.data) {
          return {
            success: true,
            tracking: result.data,
            cnpjUsed: result.cnpjUsed,
            nfUsed: nfNumber,
          };
        } else {
          return {
            success: false,
            error: result.errors?.map(e => `${e.cnpj}: ${e.error}`).join(" | ") || "NF não encontrada na Alfa",
            nfUsed: nfNumber,
          };
        }
      } catch (err: any) {
        return { success: false, error: `Erro na API Alfa: ${err.message}` };
      }
    }),
});
