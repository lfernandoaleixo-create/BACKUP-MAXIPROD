/**
 * Stock Processor - ESPELHO FIEL DO MAXIPROD
 * 
 * REGRA FUNDAMENTAL (13/03/2026):
 * O estoque do dashboard DEVE ser sempre uma cópia fiel do Maxiprod.
 * Mesmos produtos, mesmas descrições, mesmas quantidades.
 * SEM processamento próprio de nomes, SEM filtros manuais de grupo,
 * SEM renomear descrições, SEM extrair palavras-chave.
 * 
 * O que a API GraphQL retorna é o que aparece no dashboard.
 * Produtos adicionados no Maxiprod aparecem automaticamente.
 * Produtos removidos no Maxiprod desaparecem automaticamente.
 * 
 * REGRA DE POs (13/03/2026):
 * O número da PO vem do campo "referencia" do pedido de compra no Maxiprod
 * (ex: "PO62 - PROFORMA PEDIDO" → "PO62").
 * POs são matched com itens de estoque por codigoItem.
 * Itens de PO que não existem no estoque aparecem com estoque = 0.
 * 
 * Regras mantidas:
 * 1. Cruzar estoque com pedidos de venda por codigoItem
 * 2. Cruzar estoque com POs (pedidos de compra) por codigoItem
 * 3. Filtrar pedidos: apenas "A faturar" e "Faturado c/ entrega futura"
 * 4. Filtrar POs: apenas pendentes (não recebidos/cancelados)
 * 5. Calcular disponível = estoque - pedidos
 * 6. Calcular projetado = disponível + PO
 */
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { stockItems, orderItems, dashboardData, purchaseOrderItems, productVariants } from "../drizzle/schema";

interface POLote {
  numeroPedido: string;
  referenciaPO: string; // Número da PO do fornecedor (ex: PO62, PO65)
  tipoPO: "COMERCIAL" | "PROFORMA" | ""; // COMERCIAL = confirmado, PROFORMA = sujeito a alterações
  quantidade: number;
  quantidadeUn: number;
  dataEntrega: string;
  fornecedor: string;
}

interface PedidoCliente {
  cliente: string;
  quantidadeCx: number;
  quantidadeUn: number;
  quantidadeOriginalCx: number; // Pedido original total em caixas
  quantidadeFaturadaCx: number; // Quantidade já faturada em caixas
  status: string; // Aprovado, A aprovar, Digitação, etc.
  estadoConfiguravel?: string; // Estado configurável do pedido (BAMBU, FIBRA, MADEIRA, etc.)
  crmSegmento?: string; // Segmento CRM do cliente (DISTRIBUIDORA, INDÚSTRIA, LOJA, etc.)
}

interface VariantChild {
  codigoItem: string;
  descricaoItem: string;
  conversionFactor: number; // un_child / un_parent
  pedidosCx: number | null;
  pedidosUn: number;
  pedidosPorCliente: PedidoCliente[];
  unidadesPorCaixa: number | null;
  estoqueUn: number; // estoque real da variação (ou virtual para Madeira Acabado)
  estoqueCx: number | null; // estoque em caixas
}

interface EcommerceVariant {
  codigoItem: string;
  descricaoItem: string;
  unidadesPorPacote: number; // un por pacote (ex: 100, 500)
  quantidadePC: number; // quantidade de pacotes no Maxiprod
  caixasEquivalentes: number; // pacotes convertidos em caixas do mãe
}

interface EcommerceBreakdown {
  totalCaixasOriginal: number; // total real em caixas (mãe + variações convertidas)
  estoqueFisicoCx: number; // caixas do produto mãe (CX)
  variacoes: EcommerceVariant[]; // variações PC convertidas
  pedidosEcommerceCx: number; // pedidos E-COMMERCE (transferências, não vendas)
  pedidosEcommerceUn: number;
}

interface ProcessedItem {
  // Dados direto do Maxiprod (espelho fiel)
  codigoItem: string;
  descricaoItem: string; // descrição EXATA do Maxiprod
  unidadeMedida: string;
  grupoCodigo: string;
  superGrupoCodigo: string;
  descricaoGrupo: string;
  empresaDona: string;
  // Quantidades calculadas
  estoqueUn: number;
  estoqueCx: number | null;
  unidadesPorCaixa: number | null;
  pedidosUn: number;
  pedidosCx: number | null;
  pedidosPorCliente: PedidoCliente[]; // Detalhamento por cliente para tooltip
  disponivelUn: number;
  disponivelCx: number | null;
  // PO fields
  poCx: number | null;
  poUn: number;
  poEntregas: string[];
  poFornecedores: string[];
  poLotes: POLote[];
  // Projected stock
  projetadoUn: number;
  projetadoCx: number | null;
  // Segment classification (for sales analytics)
  segmento: "bambu" | "industrializado";
  // Grupo de negócio
  grupo: "industrializacao" | "importacao_revenda" | "importacao_mp" | "outros";
  // Subgrupo de negócio
  subgrupo: "bambu" | "fibra" | "madeira" | "madeira_importada" | "varetas" | "espetos" | "palitos" | "maquina_espetinho" | "outros";
  // Flag for kg-based products (displayed in kg, not cx)
  isKgProduct: boolean;
  // Estado configurável predominante dos pedidos (para filtro hierárquico)
  estadoConfiguravel: string | null;
  // Segmentos CRM dos clientes dos pedidos (para filtro hierárquico)
  segmentosCRM: string[];
  // Variações (produto pai com filhos)
  isParent: boolean;
  isChild: boolean;
  parentCode: string | null; // código do pai (se for filho)
  variants: VariantChild[]; // filhos (se for pai)
  variantConversionFactor: number | null; // fator de conversão (se for filho)
  // Pedidos próprios do pai (antes de somar variações)
  pedidosCxProprio: number | null;
  pedidosUnProprio: number;
  pedidosPorClienteProprio: PedidoCliente[];
  // E-commerce breakdown (para produtos de importação com variações PC)
  ecommerceBreakdown: EcommerceBreakdown | null;
  // Unidade de venda predominante dos pedidos (CX, PC, kg, DZ, un)
  unidadeVenda: string;
}

/**
 * Determine if a product is kg-based.
 * Checks unidadeMedida field AND description for KG pattern.
 * Products like "PCT 20KG" are sold in kg even if unidadeMedida is "un".
 */
function isKgBasedProduct(unidadeMedida: string, descricao: string, codigoItem?: string): boolean {
  // Produtos forçados como KG por código (Vareta para Velas de Madeira)
  if (codigoItem === "00193" || codigoItem === "00142") return true;
  if (unidadeMedida.toLowerCase() === "kg") return true;
  const d = descricao.toUpperCase();
  // Match descriptions containing KG but not UNID (e.g., "PCT 20KG")
  if (d.includes("KG") && !d.includes("UNID")) return true;
  return false;
}

/**
 * Extract units per box from the fatorDeConversao field or description
 * Uses fatorConversao from orders/POs when available
 */
function extractUnitsPerBox(desc: string): number | null {
  const d = desc.toUpperCase();
  
  // Skip KG-based products
  if (d.includes("KG") && !d.includes("UNID")) return null;
  
  // Pattern: C/ 10.000 UNID or C/ 5.000 UNID
  const cPattern = /C\/\s*([\d.]+)\s*(?:UNID|UN)/i;
  const cMatch = desc.match(cPattern);
  if (cMatch) return parseFloat(cMatch[1].replace(/\./g, ""));
  
  // Pattern: N X M POR CAIXA
  const nxmPorCaixaPattern = /(\d+)\s*[xX]\s*(\d+)\s*POR\s*CAIXA/i;
  const nxmPorCaixaMatch = desc.match(nxmPorCaixaPattern);
  if (nxmPorCaixaMatch) return parseInt(nxmPorCaixaMatch[1]) * parseInt(nxmPorCaixaMatch[2]);
  
  // Pattern: (10.000 POR CAIXA)
  const porCaixaPattern = /([\d.]+)\s*POR\s*CAIXA/i;
  const porCaixaMatch = desc.match(porCaixaPattern);
  if (porCaixaMatch) return parseFloat(porCaixaMatch[1].replace(/\./g, ""));
  
  // Pattern: N POR PACOTE
  const porPacotePattern = /([\d.]+)\s*POR\s*PACOTE/i;
  const porPacoteMatch = desc.match(porPacotePattern);
  if (porPacoteMatch) return parseFloat(porPacoteMatch[1].replace(/\./g, ""));
  
  // Pattern: 3-number multiplication like 20*25*100
  const threeNumPattern = /(\d+)\s*[xX*]\s*(\d+)\s*[xX*]\s*(\d+)(?!\s*MM)/;
  const threeMatch = desc.match(threeNumPattern);
  if (threeMatch) return parseInt(threeMatch[1]) * parseInt(threeMatch[2]) * parseInt(threeMatch[3]);
  
  // Pattern: C/ NxM UNID
  const cNxMUnidPattern = /C\/\s*([\d.]+)\s*[xX]\s*([\d.]+)\s*(?:UNID|UN)/i;
  const cNxMUnidMatch = desc.match(cNxMUnidPattern);
  if (cNxMUnidMatch) return parseFloat(cNxMUnidMatch[1].replace(/\./g, "")) * parseFloat(cNxMUnidMatch[2].replace(/\./g, ""));
  
  // Pattern: C/ NxM (without UNID)
  const cNxMPattern = /C\/\s*([\d.]+)\s*[xX]\s*([\d.]+)/i;
  const cNxMMatch = desc.match(cNxMPattern);
  if (cNxMMatch) return parseFloat(cNxMMatch[1].replace(/\./g, "")) * parseFloat(cNxMMatch[2].replace(/\./g, ""));
  
  // Pattern: NxM UNID after removing measurement
  const afterMM = desc.replace(/\d+[,.]?\d*\s*[xX*]\s*\d+\s*(?:MM|CM)/gi, "");
  const nxmPattern = /([\d.]+)\s*[xX]\s*([\d.]+)\s*(?:UNID|UN)/i;
  const nxmMatch = afterMM.match(nxmPattern);
  if (nxmMatch) return parseFloat(nxmMatch[1].replace(/\./g, "")) * parseFloat(nxmMatch[2].replace(/\./g, ""));
  
  // Pattern: CM NxM (hashi)
  const hashiPattern = /CM\s+(\d+)\s*[xX*]\s*(\d+)/i;
  const hashiMatch = desc.match(hashiPattern);
  if (hashiMatch) return parseInt(hashiMatch[1]) * parseInt(hashiMatch[2]);
  
  return null;
}

/**
 * Classify segment based on description (for sales analytics)
 * VARETA/ESPETO = bambu (importação), PALITO = industrializado
 */
function classifySegment(desc: string): "bambu" | "industrializado" {
  const d = desc.toUpperCase();
  if (d.includes("VARETA") || d.includes("ESPETO") || d.includes("HASHI") || d.includes("TEPPO")) return "bambu";
  return "industrializado";
}

/**
 * Classify business group based on Maxiprod superGrupoCodigo and grupoCodigo
 * SG:12 → Importação Revenda (G:20=Bambu, G:21=Fibra)
 * SG:05 → Industrialização (G:06=Varetas, G:07=Espetos, G:08=Palitos)
 * SG:16 G:18/19 → Industrialização (subgrupo definido pelo estadoConfiguravel)
 * SG:16 G:24 → Outros (embalagem)
 * 
 * NOTA: Para itens de Industrialização, o subgrupo final é definido pelo
 * estadoConfiguravel do pedido de venda (MADEIRA, MADEIRA CONTABILIZADO),
 * não pelo grupo do Maxiprod. O subgrupo retornado aqui é provisório.
 */
function classifyGrupo(superGrupoCodigo: string, grupoCodigo: string): { grupo: ProcessedItem["grupo"]; subgrupo: ProcessedItem["subgrupo"] } {
  if (superGrupoCodigo === "12") {
    const subgrupo = grupoCodigo === "21" ? "fibra" as const : "bambu" as const;
    return { grupo: "importacao_revenda", subgrupo };
  }
  if (superGrupoCodigo === "05") {
    const subMap: Record<string, ProcessedItem["subgrupo"]> = {
      "06": "varetas", "07": "espetos", "08": "palitos",
    };
    return { grupo: "industrializacao", subgrupo: subMap[grupoCodigo] || "outros" };
  }
  if (superGrupoCodigo === "16") {
    if (grupoCodigo === "18" || grupoCodigo === "19") {
      // Subgrupo provisório; será sobrescrito pelo estadoConfiguravel
      return { grupo: "industrializacao", subgrupo: "madeira" };
    }
    if (grupoCodigo === "24") return { grupo: "outros", subgrupo: "outros" }; // Embalagem
    return { grupo: "outros", subgrupo: "outros" };
  }
  return { grupo: "outros", subgrupo: "outros" };
}

/**
 * Classify subgrupo from description when superGrupoCodigo is not available
 * Used for PO-only items that don't have stock data
 */
function classifyGrupoFromDesc(desc: string, referenciaPO?: string): { grupo: ProcessedItem["grupo"]; subgrupo: ProcessedItem["subgrupo"] } {
  const d = desc.toUpperCase();
  const ref = (referenciaPO || "").toUpperCase();
  
  // Se a referência da PO indica MADEIRA, é matéria-prima importada
  if (ref.startsWith("MADEIRA")) return { grupo: "importacao_mp", subgrupo: "madeira_importada" };
  
  // MADEIRA/PINUS na descrição → matéria-prima importada (ex: "ESPETO DE MADEIRA")
  // Priorizar MADEIRA sobre ESPETO/PALITO, pois espetos de madeira são matéria-prima
  if ((d.includes("MADEIRA") || d.includes("PINUS")) && !d.includes("BAMBU")) {
    return { grupo: "importacao_mp", subgrupo: "madeira_importada" };
  }
  
  // MÁQUINA DE ESPETINHO → importação revenda, subgrupo próprio
  if (d.includes("MAQUINA") || d.includes("MÁQUINA")) {
    return { grupo: "importacao_revenda", subgrupo: "maquina_espetinho" };
  }
  if (d.includes("FIBRA")) return { grupo: "importacao_revenda", subgrupo: "fibra" };
  if (d.includes("BAMBU") || d.includes("ESPETO") || d.includes("PALITO") || d.includes("VARETA") || d.includes("HASHI")) {
    return { grupo: "importacao_revenda", subgrupo: "bambu" };
  }
  return { grupo: "outros", subgrupo: "outros" };
}

/**
 * Format date from YYYY-MM-DD to DD/MM/YY
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    // Handle ISO format: 2026-03-18T00:00:00.000-03:00
    const isoStr = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
    const parts = isoStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
    return dateStr;
  } catch {
    return dateStr || "";
  }
}

/**
 * Aggregate PO lotes by referenciaPO (número da PO do fornecedor)
 */
function aggregateLotes(lotes: POLote[]): POLote[] {
  const byPO = new Map<string, POLote>();
  for (const lote of lotes) {
    const poKey = lote.referenciaPO || lote.numeroPedido || "Sem PO";
    const existing = byPO.get(poKey);
    if (existing) {
      existing.quantidade += lote.quantidade;
      existing.quantidadeUn += lote.quantidadeUn;
      // Keep earliest delivery date
      if (lote.dataEntrega && (!existing.dataEntrega || lote.dataEntrega < existing.dataEntrega)) {
        existing.dataEntrega = lote.dataEntrega;
      }
    } else {
      byPO.set(poKey, { ...lote });
    }
  }
  return Array.from(byPO.values()).sort((a, b) => {
    if (!a.dataEntrega) return 1;
    if (!b.dataEntrega) return -1;
    const parseDate = (s: string) => {
      const [d, m, y] = s.split("/");
      return new Date(2000 + parseInt(y), parseInt(m) - 1, parseInt(d)).getTime();
    };
    return parseDate(a.dataEntrega) - parseDate(b.dataEntrega);
  });
}

interface POData {
  totalUn: number;
  totalCx: number;
  entregas: Set<string>;
  fornecedores: Set<string>;
  lotes: POLote[];
}

/**
 * REGRA DE EXCEÇÃO: Produtos de importação com fator de embalagem diferente
 * Varetas de apito: chegam da China em sacos de 30kg, mas são revendidas em sacos de 20kg.
 * O Maxiprod registra fatorConversao=20 (embalagem de venda), mas para POs de importação
 * o fator correto é 30kg por saco.
 */
const PO_IMPORT_FACTOR_OVERRIDES: { pattern: RegExp; importFactor: number }[] = [
  { pattern: /VARETA\s+DE\s+APITO/i, importFactor: 30 },
];

function getImportFactorOverride(descricao: string): number | null {
  for (const override of PO_IMPORT_FACTOR_OVERRIDES) {
    if (override.pattern.test(descricao)) return override.importFactor;
  }
  return null;
}

/**
 * Process a single PO item and add to the PO map
 */
function processPOItem(
  po: any,
  poByCode: Map<string, POData>
): void {
  // Use codigoItem for matching (mais confiável que descrição)
  const code = po.codigoItem || "";
  if (!code) return;
  
  const existing = poByCode.get(code) || {
    totalUn: 0, totalCx: 0,
    entregas: new Set<string>(), fornecedores: new Set<string>(),
    lotes: [],
  };
  
  const qtyCx = parseFloat(po.quantidade);
  existing.totalCx += qtyCx;
  
  // Verificar se há override de fator para importação (ex: varetas de apito = 30kg/saco)
  const descricao = po.descricaoItem || po.descricao || "";
  const importFactorOverride = getImportFactorOverride(descricao);
  
  let qtyUn = 0;
  if (importFactorOverride !== null) {
    // Usar fator de importação (30kg/saco) em vez do fator de venda (20kg/saco)
    qtyUn = qtyCx * importFactorOverride;
  } else if (po.quantidadeUnEstoque && parseFloat(po.quantidadeUnEstoque) > 0) {
    qtyUn = parseFloat(po.quantidadeUnEstoque);
  } else {
    const fator = po.fatorConversao ? parseFloat(po.fatorConversao) : 0;
    const unitsPerBox = fator > 0 ? fator : extractUnitsPerBox(po.descricao);
    qtyUn = unitsPerBox ? qtyCx * unitsPerBox : qtyCx;
  }
  existing.totalUn += qtyUn;
  
  const dataEntrega = formatDate(po.dataEntrega);
  if (po.dataEntrega) existing.entregas.add(dataEntrega);
  if (po.fornecedor) existing.fornecedores.add(po.fornecedor);
  
  // Extrair número da PO do campo referencia (ex: "PO62 - PROFORMA PEDIDO" -> "PO62")
  const refRaw = po.referencia || "";
  const referenciaPO = refRaw.split(" - ")[0].trim() || po.numeroPedido || "";
  // Extrair tipo: COMERCIAL (confirmado) ou PROFORMA (sujeito a alterações)
  const tipoPO: POLote["tipoPO"] = refRaw.toUpperCase().includes("COMERCIAL") ? "COMERCIAL" 
    : refRaw.toUpperCase().includes("PROFORMA") ? "PROFORMA" : "";
  
  existing.lotes.push({
    numeroPedido: po.numeroPedido || "",
    referenciaPO,
    tipoPO,
    quantidade: qtyCx,
    quantidadeUn: qtyUn,
    dataEntrega,
    fornecedor: po.fornecedor || "",
  });
  
  poByCode.set(code, existing);
}

/**
 * Main processing function - ESPELHO FIEL DO MAXIPROD
 * 
 * Pega TODOS os itens de estoque da API (sem filtro de grupo),
 * cruza com pedidos e POs por codigoItem, e salva no dashboard.
 * Itens de PO que não existem no estoque aparecem com estoque = 0.
 */
export async function processStockData(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Get raw data from DB (exatamente como veio da API)
  const rawStock = await db.select().from(stockItems);
  const rawOrders = await db.select().from(orderItems);
  const rawPOs = await db.select().from(purchaseOrderItems);
  
  // NO FILTERING of stock items - espelho fiel!
  
  // Filter orders: exclude Cancelado
  // REGRA DE NEGÓCIO (13/03/2026):
  // Pedidos em "Digitação" NÃO reservam estoque.
  // Apenas pedidos "Aprovados" e "A aprovar" reservam estoque.
  // Digitação aparece no tooltip como informação, mas não conta na reserva.
  const allValidOrders = rawOrders.filter(
    (o) => o.estadoNota !== "Cancelado"
  );
  
  // ─── Separar pedidos E-COMMERCE (transferências internas, não são vendas) ───
  // Pedidos com estadoConfiguravel = "E-COMMERCE" e cliente = filial
  // Não reservam estoque e não contam como demanda de venda.
  const isEcommerceTransfer = (o: typeof rawOrders[0]) => {
    const ec = (o.estadoConfiguravel || '').toUpperCase();
    return ec === 'E-COMMERCE' || ec === 'ECOMMERCE';
  };
  
  const ecommerceOrders = allValidOrders.filter(isEcommerceTransfer);
  const nonEcommerceOrders = allValidOrders.filter(o => !isEcommerceTransfer(o));
  
  // Pedidos que RESERVAM estoque (exclui Digitação E exclui E-COMMERCE)
  const reservingOrders = nonEcommerceOrders.filter(
    (o) => o.estadoNota !== "Digitação" && o.estadoNota !== "Digitacao"
  );
  
  // Pedidos em Digitação (apenas para exibição no tooltip, exclui E-COMMERCE)
  const digitacaoOrders = nonEcommerceOrders.filter(
    (o) => o.estadoNota === "Digitação" || o.estadoNota === "Digitacao"
  );
  
  // ─── Build E-COMMERCE order map by codigoItem (para breakdown) ───
  const ecommerceByCode = new Map<string, { totalUn: number; totalCx: number; items: typeof ecommerceOrders }>();
  for (const order of ecommerceOrders) {
    const code = order.codigoItem;
    if (!code) continue;
    const existing = ecommerceByCode.get(code) || { totalUn: 0, totalCx: 0, items: [] };
    existing.items.push(order);
    // Para faturamento parcial: reservar apenas a parte NÃO faturada
    const qtyTotal = parseFloat(order.quantidade);
    const qtyFaturada = order.quantidadeFaturada ? parseFloat(order.quantidadeFaturada) : 0;
    const qtyCx = Math.max(0, qtyTotal - qtyFaturada);
    existing.totalCx += qtyCx;
    const qtyUnEstoque = order.quantidadeUnEstoque ? parseFloat(order.quantidadeUnEstoque) : 0;
    if (qtyUnEstoque > 0) {
      const ratio = qtyTotal > 0 ? qtyCx / qtyTotal : 1;
      existing.totalUn += qtyUnEstoque * ratio;
    } else {
      const fator = order.fatorConversao ? parseFloat(order.fatorConversao) : 0;
      const unitsPerBox = fator > 0 ? fator : extractUnitsPerBox(order.descricao);
      existing.totalUn += unitsPerBox ? qtyCx * unitsPerBox : qtyCx;
    }
    ecommerceByCode.set(code, existing);
  }
  
  // Filter POs: only pending (not Recebido/Cancelado)
  const validPOs = rawPOs.filter(
    (po) => po.estadoItem !== "Recebido" && po.estadoItem !== "Cancelado" &&
            po.estadoItem !== "RECEBIDO" && po.estadoItem !== "CANCELADO"
  );
  
  // Mapeamento de substituição de código de produto (caso isolado)
  // 00020S deve usar o estoque do 00020
  const STOCK_CODE_REPLACEMENTS: Record<string, string> = {
    "00020S": "00020",
  };
  
  // ─── Merge stock items by codigoItem (same code from different lotes) ───
  const stockByCode = new Map<string, typeof rawStock[0]>();
  for (const item of rawStock) {
    // Aplicar substituição de código se existir mapeamento
    const code = STOCK_CODE_REPLACEMENTS[item.codigoItem] || item.codigoItem;
    const existing = stockByCode.get(code);
    if (existing) {
      (existing as any).quantidade = String(parseFloat(existing.quantidade) + parseFloat(item.quantidade));
    } else {
      stockByCode.set(code, { ...item, codigoItem: code });
    }
  }
  
  // ─── Build unidade de venda predominante por codigoItem (de TODOS os pedidos válidos) ───
  const unidadeVendaByCode = new Map<string, string>();
  {
    const unitCounts = new Map<string, Map<string, number>>();
    for (const order of allValidOrders) {
      const code = order.codigoItem;
      const unit = order.unidadeMedida;
      if (!code || !unit) continue;
      if (!unitCounts.has(code)) unitCounts.set(code, new Map());
      const counts = unitCounts.get(code)!;
      counts.set(unit, (counts.get(unit) || 0) + 1);
    }
    unitCounts.forEach((counts, code) => {
      let maxUnit = '';
      let maxCount = 0;
      counts.forEach((count, unit) => {
        if (count > maxCount) { maxUnit = unit; maxCount = count; }
      });
      if (maxUnit) unidadeVendaByCode.set(code, maxUnit);
    });
  }

  // ─── Build order map by codigoItem (apenas pedidos que RESERVAM estoque) ───
  const orderByCode = new Map<string, { totalUn: number; totalCx: number; items: typeof reservingOrders }>();
  for (const order of reservingOrders) {
    const code = order.codigoItem;
    if (!code) continue;
    const existing = orderByCode.get(code) || { totalUn: 0, totalCx: 0, items: [] };
    existing.items.push(order);
    
    // Acumular quantidade direta (caixas/unidade de venda) para pedidosCx
    // Para faturamento parcial: reservar apenas a parte NÃO faturada (quantidade - quantidadeFaturada)
    const qtyTotal = parseFloat(order.quantidade);
    const qtyFaturada = order.quantidadeFaturada ? parseFloat(order.quantidadeFaturada) : 0;
    const qtyCx = Math.max(0, qtyTotal - qtyFaturada);
    existing.totalCx += qtyCx;
    
    const qtyUnEstoque = order.quantidadeUnEstoque ? parseFloat(order.quantidadeUnEstoque) : 0;
    if (qtyUnEstoque > 0) {
      // Também descontar proporcional da unidade de estoque
      const fator = order.fatorConversao ? parseFloat(order.fatorConversao) : 0;
      const unitsPerBox = fator > 0 ? fator : extractUnitsPerBox(order.descricao);
      const ratio = qtyTotal > 0 ? qtyCx / qtyTotal : 1;
      existing.totalUn += qtyUnEstoque * ratio;
    } else {
      const fator = order.fatorConversao ? parseFloat(order.fatorConversao) : 0;
      const unitsPerBox = fator > 0 ? fator : extractUnitsPerBox(order.descricao);
      existing.totalUn += unitsPerBox ? qtyCx * unitsPerBox : qtyCx;
    }
    orderByCode.set(code, existing);
  }
  
  /**
   * Aggregate orders by client+status for a given codigoItem
   * Returns array of { cliente, quantidadeCx, quantidadeUn, status }
   * sorted by quantity descending
   */
  // ─── Build digitacao map by codigoItem (apenas para tooltip) ───
  const digitacaoByCode = new Map<string, typeof digitacaoOrders>();
  for (const order of digitacaoOrders) {
    const code = order.codigoItem;
    if (!code) continue;
    const existing = digitacaoByCode.get(code) || [];
    existing.push(order);
    digitacaoByCode.set(code, existing);
  }
  
  function aggregateOrdersByClient(
    orders: typeof reservingOrders,
    unitsPerBox: number | null
  ): PedidoCliente[] {
    const byClientStatus = new Map<string, PedidoCliente>();
    for (const order of orders) {
      const cliente = order.cliente || "(sem cliente)";
      const status = order.estadoNota || "";
      const key = `${cliente}|||${status}`;
      
      // Para faturamento parcial: usar apenas a parte NÃO faturada
      const qtyTotalCx = parseFloat(order.quantidade);
      const qtyFaturada = order.quantidadeFaturada ? parseFloat(order.quantidadeFaturada) : 0;
      const qtyCx = Math.max(0, qtyTotalCx - qtyFaturada);
      const qtyUnEstoque = order.quantidadeUnEstoque ? parseFloat(order.quantidadeUnEstoque) : 0;
      let qtyUn = 0;
      if (qtyUnEstoque > 0) {
        // Proporcional ao faturamento parcial
        const ratio = qtyTotalCx > 0 ? qtyCx / qtyTotalCx : 1;
        qtyUn = qtyUnEstoque * ratio;
      } else {
        const fator = order.fatorConversao ? parseFloat(order.fatorConversao) : 0;
        const upb = fator > 0 ? fator : (unitsPerBox || 0);
        qtyUn = upb ? qtyCx * upb : qtyCx;
      }
      
      const estadoConf = order.estadoConfiguravel || undefined;
      const segCRM = order.crmSegmento || undefined;
      
      const existing = byClientStatus.get(key);
      if (existing) {
        existing.quantidadeCx += qtyCx;
        existing.quantidadeUn += qtyUn;
        existing.quantidadeOriginalCx += qtyTotalCx;
        existing.quantidadeFaturadaCx += qtyFaturada;
      } else {
        byClientStatus.set(key, {
          cliente,
          quantidadeCx: qtyCx,
          quantidadeUn: qtyUn,
          quantidadeOriginalCx: qtyTotalCx,
          quantidadeFaturadaCx: qtyFaturada,
          status,
          estadoConfiguravel: estadoConf,
          crmSegmento: segCRM,
        });
      }
    }
    return Array.from(byClientStatus.values()).sort(
      (a, b) => b.quantidadeCx - a.quantidadeCx
    );
  }
  
  // ─── Build PO map by codigoItem ───
  const poByCode = new Map<string, POData>();
  for (const po of validPOs) {
    processPOItem(po, poByCode);
  }
  
  // ─── Load product variants (pai/variação) ───
  const rawVariants = await db.select().from(productVariants);
  // Map: parentCode -> [{ childCode, conversionFactor }]
  const variantsByParent = new Map<string, { childCode: string; conversionFactor: number }[]>();
  // Map: childCode -> { parentCode, conversionFactor }
  const childToParent = new Map<string, { parentCode: string; conversionFactor: number }>();
  for (const v of rawVariants) {
    const factor = parseFloat(v.conversionFactor);
    const children = variantsByParent.get(v.parentCode) || [];
    children.push({ childCode: v.childCode, conversionFactor: factor });
    variantsByParent.set(v.parentCode, children);
    childToParent.set(v.childCode, { parentCode: v.parentCode, conversionFactor: factor });
  }
  
  // ─── Exclusões manuais (produtos que não devem aparecer no dashboard) ───
  const EXCLUDED_CODES = new Set(["00335"]); // 00335: ESPETO DE MADEIRA 3,8*200MM 10.000 - excluído a pedido
  // ─── Produtos prioritários (aparecem primeiro na lista da sua aba) ───
  const PINNED_FIRST_CODES = ["00648"]; // 00648: ESPETO PREMIUM P/ QUEIJO COALHO - primeiro na Importação

  // ─── Build processed items ───
  const processed: ProcessedItem[] = [];
  const processedCodes = new Set<string>();
  
  // 1. Process stock items (espelho fiel)
  for (const item of Array.from(stockByCode.values())) {
    // Skip excluded items
    if (EXCLUDED_CODES.has(item.codigoItem)) continue;
    const itemUn = parseFloat(item.quantidade);
    // PRIORIDADE: usar unidadeDeVendaFator do Maxiprod (fonte oficial)
    // Fallback: extrair da descrição do produto
    const maxiprodFator = item.unidadeDeVendaFator ? parseFloat(item.unidadeDeVendaFator) : null;
    const descFator = extractUnitsPerBox(item.descricaoItem);
    // Produto 00808 (VARETA GLADE REEDS): estoque vem em kg, cada caixa = 11.6 kg
    // Produto 00556 (VARETA GLADE REEDS 100 ML): vendido em MIL, 1 caixa = 10.002 milheiros
    const unitsPerBox = item.codigoItem === '00808' ? 11.6 
      : item.codigoItem === '00556' ? 10.002 
      : (maxiprodFator || descFator);
    
    const orderData = orderByCode.get(item.codigoItem);
    
    const poData = poByCode.get(item.codigoItem);
    const poUn = poData?.totalUn || 0;
    const poCx = poData?.totalCx || 0;
    
    // Agregar pedidos por cliente + status para tooltip
    // Inclui pedidos que reservam (Aprovado/A aprovar) E pedidos em Digitação (só informação)
    const reservaPorCliente = orderData
      ? aggregateOrdersByClient(orderData.items, unitsPerBox)
      : [];
    const digitacaoItems = digitacaoByCode.get(item.codigoItem);
    const digitacaoPorCliente = digitacaoItems
      ? aggregateOrdersByClient(digitacaoItems, unitsPerBox)
      : [];
    const pedidosPorCliente = [...reservaPorCliente, ...digitacaoPorCliente];
    
    // Extrair estadoConfiguravel predominante e segmentos CRM dos pedidos
    const allOrdersForItem = [...(orderData?.items || []), ...(digitacaoItems || [])];
    const estadoConfCounts = new Map<string, number>();
    const segCRMSet = new Set<string>();
    for (const ord of allOrdersForItem) {
      if (ord.estadoConfiguravel) {
        estadoConfCounts.set(ord.estadoConfiguravel, (estadoConfCounts.get(ord.estadoConfiguravel) || 0) + 1);
      }
      if (ord.crmSegmento) {
        segCRMSet.add(ord.crmSegmento);
      }
    }
    // Estado configurável mais frequente
    let estadoConfPredominante: string | null = null;
    let maxCount = 0;
    for (const [ec, count] of Array.from(estadoConfCounts.entries())) {
      if (count > maxCount) { maxCount = count; estadoConfPredominante = ec; }
    }
    
    // Classificar grupo/subgrupo base
    const baseClassification = classifyGrupo(item.superGrupoCodigo || "", item.grupoCodigo || "");
    
    // Para itens de Industrialização, subgrupo é sempre "madeira"
    // (Madeira Contabilizado foi removido - tudo fica como Madeira)
    let finalSubgrupo = baseClassification.subgrupo;
    if (baseClassification.grupo === "industrializacao" && estadoConfPredominante) {
      const ec = estadoConfPredominante.toUpperCase();
      if (ec === "MADEIRA" || ec === "MADEIRA CONTABILIZADO") {
        finalSubgrupo = "madeira";
      }
    }
    
    // ─── CORREÇÃO DUPLICIDADE DE BAIXA (19/05/2026 - atualizada 27/05/2026) ───
    // Para itens MADEIRA/MADEIRA CONTABILIZADO:
    // - Pedidos de venda DEVEM aparecer (informativo para o vendedor/gestor)
    // - Mas NÃO devem subtrair do disponível/projetado (baixa só no faturamento)
    // IMPORTANTE: Isso NÃO afeta importação (BAMBU, FIBRA, MADEIRA IMPORTADA) — apenas industrializados.
    const isMadeiraIndustrializado = estadoConfPredominante && 
      (estadoConfPredominante.toUpperCase() === 'MADEIRA' || estadoConfPredominante.toUpperCase() === 'MADEIRA CONTABILIZADO');
    const pedidosUn = orderData?.totalUn || 0;
    
    // Para MADEIRA industrializado: disponível = estoque (não desconta pedidos)
    // Para outros: disponível = estoque - pedidos
    const disponivelUn = isMadeiraIndustrializado ? itemUn : (itemUn - pedidosUn);
    const projetadoUn = disponivelUn + poUn;
    
    // isKg: produtos vendidos em kg (ex: PCT 20KG)
    const isKg = item.codigoItem === '00808' ? false : isKgBasedProduct(item.unidadeMedida || "", item.descricaoItem, item.codigoItem);
    const estoqueCxVal = unitsPerBox ? Math.floor(itemUn / unitsPerBox) : null;
    // Produto 00556: pedido vem em MIL, dividir totalCx por 10.002 para obter caixas
    const pedidosCxVal = orderData
      ? (item.codigoItem === '00556'
          ? Math.round(orderData.totalCx / 10.002)
          : (unitsPerBox && unitsPerBox !== 1
              ? Math.ceil(pedidosUn / unitsPerBox)
              : Math.ceil(orderData.totalCx)))
      : null;
    // Disponível em caixas: para MADEIRA industrializado, não desconta pedidos
    const disponivelCxVal = estoqueCxVal !== null 
      ? (isMadeiraIndustrializado ? estoqueCxVal : estoqueCxVal - (pedidosCxVal ?? 0)) 
      : null;
    // Para produtos kg (ex: Vareta Apito PCT 20KG): PO na tabela de estoque deve ser em kg
    // (150 cx × 30kg = 4500 kg) para somar com estoque/disponível que já está em kg.
    // Os poLotes mantêm quantidade em caixas (como chega da China) para a seção POs.
    const poCxVal = isKg ? poUn : (poCx || null);
    // Projetado = Disponível + PO (ambos na mesma unidade: kg para isKg, cx para outros)
    const projetadoCxVal = disponivelCxVal !== null ? disponivelCxVal + (poCxVal ?? 0) : null;
    
    processed.push({
      codigoItem: item.codigoItem,
      descricaoItem: item.descricaoItem,
      unidadeMedida: item.unidadeMedida || "",
      grupoCodigo: item.grupoCodigo || "",
      superGrupoCodigo: item.superGrupoCodigo || "",
      descricaoGrupo: item.descricaoGrupo || "",
      empresaDona: item.empresaDona || "",
      estoqueUn: itemUn,
      estoqueCx: estoqueCxVal,
      unidadesPorCaixa: unitsPerBox,
      pedidosUn,
      pedidosCx: pedidosCxVal,
      pedidosPorCliente,
      disponivelUn,
      disponivelCx: disponivelCxVal,
      poCx: poCxVal,
      poUn,
      poEntregas: poData ? Array.from(poData.entregas) : [],
      poFornecedores: poData ? Array.from(poData.fornecedores) : [],
      poLotes: poData ? aggregateLotes(poData.lotes) : [],
      projetadoUn,
      projetadoCx: projetadoCxVal,
      segmento: classifySegment(item.descricaoItem),
      grupo: baseClassification.grupo,
      subgrupo: finalSubgrupo,
      // Produto 00808: NÃO é kg product, é convertido para caixas (peso / 11.6)
      isKgProduct: item.codigoItem === '00808' ? false : isKgBasedProduct(item.unidadeMedida || "", item.descricaoItem, item.codigoItem),
      estadoConfiguravel: estadoConfPredominante,
      segmentosCRM: Array.from(segCRMSet),
      // Variações
      isParent: variantsByParent.has(item.codigoItem),
      isChild: childToParent.has(item.codigoItem),
      parentCode: childToParent.get(item.codigoItem)?.parentCode || null,
      variants: [], // preenchido no pós-processamento
      variantConversionFactor: childToParent.get(item.codigoItem)?.conversionFactor || null,
      pedidosCxProprio: item.codigoItem === '00556' ? (orderData ? Math.round(orderData.totalCx / 10.002) : null) : (unitsPerBox ? Math.ceil(pedidosUn / unitsPerBox) : null),
      pedidosUnProprio: pedidosUn,
      pedidosPorClienteProprio: [...pedidosPorCliente],
      ecommerceBreakdown: null, // preenchido no pós-processamento
      // Produto 00808: forçar unidade de venda como CX (comercial lança em caixas, não kg)
      // Produto 00556: forçar unidade de venda como CX (comercial lança em MIL, converter para caixas)
      unidadeVenda: (item.codigoItem === '00808' || item.codigoItem === '00556') ? 'CX' : (unidadeVendaByCode.get(item.codigoItem) || item.unidadeMedida || ""),
    });
    processedCodes.add(item.codigoItem);
  }
  
  // 2. Add PO-only items (itens que existem em POs mas NÃO no estoque)
  // Esses itens aparecem com estoque = 0 para que as POs sejam visíveis
  for (const [code, poData] of Array.from(poByCode.entries())) {
    if (processedCodes.has(code)) continue; // Já processado via estoque
    if (EXCLUDED_CODES.has(code)) continue; // Excluído manualmente
    
    // Buscar informações do item a partir da PO
    const poItem = validPOs.find(p => (p.codigoItem || "") === code);
    if (!poItem) continue;
    
    const descricaoItem = poItem.descricaoItem || poItem.descricao || "";
    const unitsPerBox = extractUnitsPerBox(descricaoItem);
    
    const poUn = poData.totalUn;
    const poCx = poData.totalCx;
    
    // ─── Cruzar com pedidos de venda para itens PO-only ───
    const orderData = orderByCode.get(code);
    const reservaPorCliente = orderData
      ? aggregateOrdersByClient(orderData.items, unitsPerBox)
      : [];
    const digitacaoItems = digitacaoByCode.get(code);
    const digitacaoPorCliente = digitacaoItems
      ? aggregateOrdersByClient(digitacaoItems, unitsPerBox)
      : [];
    const pedidosPorCliente = [...reservaPorCliente, ...digitacaoPorCliente];
    
    // Extrair estadoConfiguravel e segmentos CRM dos pedidos
    const allOrdersForPOItem = [...(orderData?.items || []), ...(digitacaoItems || [])];
    const estadoConfCountsPO = new Map<string, number>();
    const segCRMSetPO = new Set<string>();
    for (const ord of allOrdersForPOItem) {
      if (ord.estadoConfiguravel) {
        estadoConfCountsPO.set(ord.estadoConfiguravel, (estadoConfCountsPO.get(ord.estadoConfiguravel) || 0) + 1);
      }
      if (ord.crmSegmento) {
        segCRMSetPO.add(ord.crmSegmento);
      }
    }
    let estadoConfPredominantePO: string | null = null;
    let maxCountPO = 0;
    for (const [ec, count] of Array.from(estadoConfCountsPO.entries())) {
      if (count > maxCountPO) { maxCountPO = count; estadoConfPredominantePO = ec; }
    }
    
    // CORREÇÃO DUPLICIDADE DE BAIXA (19/05/2026 - atualizada 27/05/2026): mesma regra da seção principal
    // Pedidos APARECEM mas não subtraem do disponível para MADEIRA industrializado
    const isMadeiraIndustrializadoPO = estadoConfPredominantePO && 
      (estadoConfPredominantePO.toUpperCase() === 'MADEIRA' || estadoConfPredominantePO.toUpperCase() === 'MADEIRA CONTABILIZADO');
    const pedidosUn = orderData?.totalUn || 0;
    
    // Para MADEIRA: disponível = 0 (sem estoque, sem desconto de pedidos)
    // Para outros: disponível = 0 - pedidos (negativo = comprometido sem estoque)
    const disponivelUn = isMadeiraIndustrializadoPO ? 0 : (0 - pedidosUn);
    const projetadoUn = disponivelUn + poUn;
    
    processed.push({
      codigoItem: code,
      descricaoItem: descricaoItem,
      unidadeMedida: poItem.unidadeMedidaEstoque || poItem.unidadeMedida || "",
      grupoCodigo: "",
      superGrupoCodigo: "",
      descricaoGrupo: poItem.codigoGrupo || "",
      empresaDona: poItem.empresaDona || "",
      estoqueUn: 0,
      estoqueCx: unitsPerBox ? 0 : null,
      unidadesPorCaixa: unitsPerBox,
      pedidosUn,
      pedidosCx: orderData
        ? (unitsPerBox && unitsPerBox !== 1
            ? Math.ceil(pedidosUn / unitsPerBox)
            : Math.ceil(orderData.totalCx))
        : null,
      pedidosPorCliente,
      disponivelUn,
      disponivelCx: (() => {
        if (isMadeiraIndustrializadoPO) return unitsPerBox ? 0 : null;
        if (!orderData) return unitsPerBox ? Math.floor(disponivelUn / unitsPerBox) : null;
        const pedCx = unitsPerBox && unitsPerBox !== 1 ? Math.ceil(pedidosUn / unitsPerBox) : Math.ceil(orderData.totalCx);
        return Math.floor(0 - pedCx);
      })(),
      poCx: poCx || null,
      poUn,
      poEntregas: Array.from(poData.entregas),
      poFornecedores: Array.from(poData.fornecedores),
      poLotes: aggregateLotes(poData.lotes),
      projetadoUn,
      projetadoCx: (() => {
        if (isMadeiraIndustrializadoPO) return unitsPerBox ? (0 + (poCx || 0)) : null;
        if (!orderData) return unitsPerBox ? (Math.floor(disponivelUn / unitsPerBox) + (poCx || 0)) : null;
        const pedCx = unitsPerBox && unitsPerBox !== 1 ? Math.ceil(pedidosUn / unitsPerBox) : Math.ceil(orderData.totalCx);
        return Math.floor(0 - pedCx) + (poCx || 0);
      })(),
      segmento: classifySegment(descricaoItem),
      ...classifyGrupoFromDesc(descricaoItem, poData.lotes[0]?.referenciaPO),
      isKgProduct: isKgBasedProduct(poItem.unidadeMedidaEstoque || poItem.unidadeMedida || "", poItem.descricaoItem || poItem.descricao || "", code),
      estadoConfiguravel: estadoConfPredominantePO,
      segmentosCRM: Array.from(segCRMSetPO),
      // Variações
      isParent: variantsByParent.has(code),
      isChild: childToParent.has(code),
      parentCode: childToParent.get(code)?.parentCode || null,
      variants: [],
      variantConversionFactor: childToParent.get(code)?.conversionFactor || null,
      pedidosCxProprio: unitsPerBox ? Math.ceil(pedidosUn / unitsPerBox) : null,
      pedidosUnProprio: pedidosUn,
      pedidosPorClienteProprio: [...pedidosPorCliente],
      ecommerceBreakdown: null,
      unidadeVenda: unidadeVendaByCode.get(code) || poItem.unidadeMedida || "",
    });
    processedCodes.add(code);
  }
  
  // ─── Pós-processamento de variações ───
  // Para cada produto pai, preencher variants[] com dados dos filhos
  // e ajustar o disponível do pai descontando pedidos das variações
  const processedByCode = new Map<string, ProcessedItem>();
  for (const p of processed) {
    processedByCode.set(p.codigoItem, p);
  }
  
  for (const [parentCode, children] of Array.from(variantsByParent.entries())) {
    let parent = processedByCode.get(parentCode);
    
    // ─── Virtual Parent Support ───
    // If parentCode doesn't exist in stock (e.g., 'ECOM'), create a synthetic parent
    // that aggregates all its children. Used for grouping products like "Estoque E-commerce".
    if (!parent && children.length > 0) {
      // Get first child to inherit grupo/subgrupo
      const firstChild = processedByCode.get(children[0].childCode);
      if (!firstChild) continue;
      
      // Virtual parent names
      const VIRTUAL_PARENT_NAMES: Record<string, string> = {
        'ECOM': 'Estoque "E-commerce"',
      };
      const virtualName = VIRTUAL_PARENT_NAMES[parentCode] || `Agrupador ${parentCode}`;
      
      // Create synthetic parent with aggregated stock from children
      let totalEstoqueUn = 0;
      let totalPedidosUn = 0;
      let maxUpb = 0;
      for (const child of children) {
        const childItem = processedByCode.get(child.childCode);
        if (childItem) {
          totalEstoqueUn += childItem.estoqueUn;
          totalPedidosUn += childItem.pedidosUn;
          if (childItem.unidadesPorCaixa && childItem.unidadesPorCaixa > maxUpb) {
            maxUpb = childItem.unidadesPorCaixa;
          }
        }
      }
      const upb = maxUpb || 1;
      const totalEstoqueCx = Math.floor(totalEstoqueUn / upb);
      const totalPedidosCx = Math.ceil(totalPedidosUn / upb);
      const disponivelUn = totalEstoqueUn - totalPedidosUn;
      const disponivelCx = Math.floor(disponivelUn / upb);
      
      parent = {
        codigoItem: parentCode,
        descricaoItem: virtualName,
        unidadeMedida: firstChild.unidadeMedida,
        grupoCodigo: firstChild.grupoCodigo,
        superGrupoCodigo: firstChild.superGrupoCodigo,
        descricaoGrupo: firstChild.descricaoGrupo,
        empresaDona: firstChild.empresaDona,
        estoqueUn: totalEstoqueUn,
        estoqueCx: totalEstoqueCx,
        unidadesPorCaixa: upb,
        pedidosUn: totalPedidosUn,
        pedidosCx: totalPedidosCx,
        pedidosPorCliente: [],
        disponivelUn,
        disponivelCx,
        poCx: null,
        poUn: 0,
        poEntregas: [],
        poFornecedores: [],
        poLotes: [],
        projetadoUn: disponivelUn,
        projetadoCx: disponivelCx,
        segmento: firstChild.segmento,
        grupo: firstChild.grupo,
        subgrupo: firstChild.subgrupo,
        isKgProduct: false,
        estadoConfiguravel: firstChild.estadoConfiguravel,
        segmentosCRM: [],
        isParent: true,
        isChild: false,
        parentCode: null,
        variants: [],
        variantConversionFactor: null,
        pedidosCxProprio: 0,
        pedidosUnProprio: 0,
        pedidosPorClienteProprio: [],
        ecommerceBreakdown: null,
        unidadeVenda: firstChild.unidadeVenda,
      };
      processed.push(parent);
      processedByCode.set(parentCode, parent);
      console.log(`[Virtual Parent] Created '${virtualName}' (${parentCode}) with ${children.length} children, estoque=${totalEstoqueUn}un/${totalEstoqueCx}cx`);
    }
    if (!parent) continue;
    
    let extraPedidosUn = 0; // pedidos das variações convertidos em unidades do pai
    
    for (const child of children) {
      const childItem = processedByCode.get(child.childCode);
      if (!childItem) continue;
      
      const childPedidosCx = childItem.pedidosCx || 0;
      const childPedidosUn = childItem.pedidosUn;
      const parentUnitsPerBox = parent.unidadesPorCaixa || 1;
      
      // REGRA DE BAIXA DUPLA (17/04/2026 - atualizada):
      // 1. Produtos ZECA (código termina em "Z"): sempre debitar do pai
      // 2. Madeira Produto Acabado (grupo=industrializacao, subgrupo=madeira):
      //    SEMPRE debitar pedidos da variação do estoque mãe.
      //    Criar "estoque virtual" na variação = quantidade dos pedidos.
      //    Quando o pedido sair (faturar), desconta da variação (evita baixa dupla).
      // 3. Outros produtos: se a variação TEM estoque próprio (estoqueUn > 0), a fiscal já
      //    deu baixa no Maxiprod, então NÃO debitar do pai (evita baixa dupla).
      //    Se a variação NÃO tem estoque próprio (estoqueUn === 0), debitar do pai normalmente.
      const isZecaChild = child.childCode.toUpperCase().endsWith('Z');
      const childHasOwnStock = childItem.estoqueUn > 0;
      const isMadeiraAcabado = parent.grupo === "industrializacao" && parent.subgrupo === "madeira";
      
      // Estoque da variação: real do Maxiprod ou virtual (pedidos) para Madeira Acabado
      let variantEstoqueUn = childItem.estoqueUn;
      let variantEstoqueCx = childItem.estoqueCx;
      
      if (isMadeiraAcabado) {
        // MADEIRA PRODUTO ACABADO: sempre abater do mãe
        // Produto 00556: converter MIL para caixas antes de multiplicar pelo fator
        const effectiveChildPedidosForParent = child.childCode === '00556'
          ? (childPedidosCx || 0) * (parentUnitsPerBox) // converter caixas da variação para unidades do pai
          : childPedidosUn * child.conversionFactor;
        extraPedidosUn += effectiveChildPedidosForParent;
        // Criar estoque virtual na variação = quantidade dos pedidos
        // (o Maxiprod já criou a variação com as configurações, mas o estoque
        // ainda está no mãe até o faturamento)
        if (childItem.estoqueUn === 0 && childPedidosUn > 0) {
          // Produto 00556: estoque virtual = pedidosCx (já convertido para caixas)
          if (child.childCode === '00556') {
            variantEstoqueCx = childPedidosCx;
            variantEstoqueUn = childPedidosCx * (childItem.unidadesPorCaixa || 1);
          } else {
            variantEstoqueUn = childPedidosUn;
            variantEstoqueCx = childItem.unidadesPorCaixa
              ? Math.floor(childPedidosUn / childItem.unidadesPorCaixa)
              : null;
          }
        }
      } else if (isZecaChild || !childHasOwnStock) {
        // ZECA ou variação sem estoque próprio: debitar pedidos do pai (comportamento original)
        extraPedidosUn += childPedidosUn * child.conversionFactor;
      }
      // Se variação NÃO-ZECA/NÃO-Madeira tem estoque próprio: NÃO somar ao pai
      // Os pedidos já foram debitados do estoque da variação pela fiscal
      
      // Agregar pedidos por cliente do filho
      const childPedidosPorCliente = childItem.pedidosPorCliente || [];
      
      parent.variants.push({
        codigoItem: child.childCode,
        descricaoItem: childItem.descricaoItem,
        conversionFactor: child.conversionFactor,
        pedidosCx: childItem.pedidosCx,
        pedidosUn: childItem.pedidosUn,
        pedidosPorCliente: childPedidosPorCliente,
        unidadesPorCaixa: childItem.unidadesPorCaixa,
        estoqueUn: variantEstoqueUn,
        estoqueCx: variantEstoqueCx,
      });
    }
    
    // Ajustar disponível do pai: descontar apenas pedidos de variações que devem ser debitadas
    // EXCEÇÃO: para MADEIRA industrializado, pedidos são informativos — NÃO subtraem do disponível
    const parentIsMadeira = parent.estadoConfiguravel && 
      (parent.estadoConfiguravel.toUpperCase() === 'MADEIRA' || parent.estadoConfiguravel.toUpperCase() === 'MADEIRA CONTABILIZADO');
    if (extraPedidosUn > 0) {
      parent.pedidosUn += extraPedidosUn;
      if (parentIsMadeira) {
        // MADEIRA: disponível = estoque (não desconta pedidos)
        parent.disponivelUn = parent.estoqueUn;
        if (parent.unidadesPorCaixa) {
          parent.pedidosCx = Math.ceil(parent.pedidosUn / parent.unidadesPorCaixa);
          parent.disponivelCx = Math.floor(parent.estoqueUn / parent.unidadesPorCaixa);
          parent.projetadoUn = parent.disponivelUn + parent.poUn;
          if (parent.isKgProduct) {
            parent.projetadoCx = parent.disponivelCx !== null ? parent.disponivelCx + parent.poUn : null;
          } else {
            parent.projetadoCx = (parent.disponivelCx ?? 0) + (parent.poCx ?? 0);
          }
        }
      } else {
        // Outros: disponível = estoque - pedidos
        parent.disponivelUn = parent.estoqueUn - parent.pedidosUn;
        if (parent.unidadesPorCaixa) {
          parent.pedidosCx = Math.ceil(parent.pedidosUn / parent.unidadesPorCaixa);
          parent.disponivelCx = Math.floor(parent.disponivelUn / parent.unidadesPorCaixa);
          parent.projetadoUn = parent.disponivelUn + parent.poUn;
          if (parent.isKgProduct) {
            parent.projetadoCx = parent.disponivelCx !== null ? parent.disponivelCx + parent.poUn : null;
          } else {
            parent.projetadoCx = (parent.disponivelCx ?? 0) + (parent.poCx ?? 0);
          }
        }
      }
    }
    
    // Agregar pedidos das variações no pedidosPorCliente do pai
    // para que o tooltip mostre todos os pedidos (próprios + variações)
    for (const variant of parent.variants) {
      for (const vpc of variant.pedidosPorCliente) {
        // Converter quantidade para unidades do pai
        const convertedQtdCx = vpc.quantidadeCx * variant.conversionFactor;
        parent.pedidosPorCliente.push({
          ...vpc,
          quantidadeCx: convertedQtdCx,
          cliente: `[${variant.codigoItem}] ${vpc.cliente}`,
        });
      }
    }
  }
  
  // ─── Pós-processamento E-COMMERCE: Conversão PC→CX automática ───
  // Para produtos de importação (grupo 12), detectar automaticamente variações PC
  // que são pacotes desmembrados de um produto mãe CX.
  // Converter o estoque dos PCs para caixas equivalentes do mãe.
  // Também computar pedidos E-COMMERCE como transferências (não vendas).
  
  // Extrair nome base do produto (sem o "C/ XXXX UNID." ou "FLOW-PACK XXXX UNID.")
  // Precisa lidar com vários formatos:
  // - "C/ 10.000 UNID." (simples)
  // - "C/ 100 X 100 UNID." (embalagem transparente)
  // - "C/ 200 X100 UNID." (sem espaço)
  // - "C/ 400 x 50 UNID." (minúsculo)
  // - "FLOW-PACK 50 UNID." / "FLOW-PACK 200 UNID."
  // - "FLOW-PACK 500 x 10 UNID." (com multiplicador)
  function extractBaseName(desc: string): string {
    let result = desc;
    // Remove "C/ NNN [x NNN] UNID." patterns (with optional multiplier)
    result = result.replace(/\s*C\/\s*[\d.]+\s*([xX]\s*[\d.]+)?\s*(UNID\.?|UN\.?)/gi, '');
    // Remove "FLOW-PACK NNN [x NNN] UNID." patterns
    result = result.replace(/\s*-?\s*FLOW-?PACK\s*[\d.]+\s*([xX]\s*[\d.]+)?\s*(UNID\.?|UN\.?)/gi, '');
    // Remove "EMBALADO INDIVIDUALMENTE C/ NNN x NNN UNID."
    result = result.replace(/\s*EMBALADO\s+INDIVIDUALMENTE/gi, '');
    // Remove "(EMB. TRANSPARENTE)" and similar parenthetical notes
    result = result.replace(/\s*\(EMB\.?\s*TRANSPARENTE\)/gi, '');
    // Normalize spaces around "MM" ("125MM" → "125 MM")
    result = result.replace(/(\d)MM/gi, '$1 MM');
    // Collapse whitespace
    result = result.replace(/\s+/g, ' ').trim().toUpperCase();
    return result;
  }
  
  // Manual mapping for products with very different naming between parent and variants
  // Key: normalized variant base name → normalized parent base name
  const ECOMMERCE_NAME_ALIASES: Record<string, string> = {
    'VARETA AROMATIZADOR FIBRA 3,0 X 200': 'VARETA DE FIBRA PARA AROMATIZADOR DE 3,0 X 200 MM PRETA',
  };
  
  // Agrupar produtos de importação por nome base
  const importItems = processed.filter(p => p.grupo === 'importacao_revenda');
  const byBaseName = new Map<string, ProcessedItem[]>();
  for (const item of importItems) {
    let baseName = extractBaseName(item.descricaoItem);
    // Check aliases: if this base name maps to a parent name, use the parent name
    for (const [aliasKey, aliasTarget] of Object.entries(ECOMMERCE_NAME_ALIASES)) {
      if (baseName.startsWith(aliasKey)) {
        baseName = aliasTarget;
        break;
      }
    }
    const group = byBaseName.get(baseName) || [];
    group.push(item);
    byBaseName.set(baseName, group);
  }
  
  // Para cada grupo com múltiplos itens, identificar mãe (maior unitsPerBox) e variações
  for (const [baseName, groupItems] of Array.from(byBaseName.entries())) {
    if (groupItems.length < 2) continue; // Sem variações
    
    // Filtrar itens que não devem participar do agrupamento e-commerce:
    // - Embalagens transparentes ("EMB. TRANSPARENTE") são embalagens especiais, não mãe nem variação
    // - Itens que já são filhos de outra relação pai/filho existente
    const eligibleItems = groupItems.filter(item => {
      const desc = item.descricaoItem.toUpperCase();
      if (desc.includes('EMB.') && desc.includes('TRANSPARENTE')) return false;
      if (desc.includes('EMBALAGEM') && desc.includes('TRANSPARENTE')) return false;
      return true;
    });
    if (eligibleItems.length < 2) continue;
    
    // Encontrar o produto mãe:
    // PRIORIDADE 1: Se há um item que é pai reconhecido no product_variants E tem estoque, ele é a mãe
    // PRIORIDADE 2: Maior unidadesPorCaixa. Em caso de empate, preferir com estoque > 0.
    let mother: ProcessedItem | null = null;
    
    // Primeiro: procurar pai reconhecido no product_variants com estoque
    const recognizedParent = eligibleItems.find(i => i.isParent && !i.isChild && i.estoqueUn > 0);
    if (recognizedParent && recognizedParent.unidadesPorCaixa) {
      mother = recognizedParent;
    } else {
      // Fallback: maior upb
      let maxUpb = 0;
      for (const item of eligibleItems) {
        const upb = item.unidadesPorCaixa || 0;
        if (upb > maxUpb || (upb === maxUpb && item.estoqueUn > (mother?.estoqueUn || 0))) {
          maxUpb = upb;
          mother = item;
        }
      }
    }
    if (!mother || !mother.unidadesPorCaixa) continue;
    // Se a mãe selecionada tem 0 estoque mas há outro item com mesmo upb e estoque, trocar
    if (mother.estoqueUn === 0) {
      const maxUpb = mother.unidadesPorCaixa;
      const altMother = eligibleItems.find(i => i !== mother && (i.unidadesPorCaixa || 0) === maxUpb && i.estoqueUn > 0);
      if (altMother) mother = altMother;
    }
    
    const motherUpb = mother.unidadesPorCaixa!; // Already checked above: if (!mother.unidadesPorCaixa) continue;
    const variacoes: EcommerceVariant[] = [];
    let totalVariacoesCx = 0;
    
    // Processar cada variação (PC)
    for (const child of eligibleItems) {
      if (child === mother) continue; // Pular o próprio mãe
      if (!child.unidadesPorCaixa) continue;
      // PROTEÇÃO: Se o item é pai reconhecido no Sistema 1 (product_variants) e tem estoque,
      // NÃO deve ser engolido como variação e-commerce (ex: 00046 é pai de 00047/00050)
      if (child.isParent && !child.isChild && child.estoqueUn > 0) continue;
      // Variação = upb menor que mãe OU upb igual mas é filho reconhecido pelo Sistema 1 (isChild)
      const isVariantByUpb = child.unidadesPorCaixa < motherUpb;
      const isVariantByRelation = child.isChild && child.parentCode === mother.codigoItem;
      const isVariantBySameUpb = child.unidadesPorCaixa === motherUpb && child.codigoItem !== mother.codigoItem;
      if (!isVariantByUpb && !isVariantByRelation && !isVariantBySameUpb) continue;
      // Incluir variações mesmo com estoque 0 (importante para mostrar composição e-commerce)
      
      const childUpb = child.unidadesPorCaixa;
      // Converter estoque do PC para caixas equivalentes do mãe
      // Fórmula: (estoquePCs × un_por_pacote) ÷ un_por_caixa_mãe
      const caixasEquivalentes = Math.floor((child.estoqueUn) / motherUpb);
      
      variacoes.push({
        codigoItem: child.codigoItem,
        descricaoItem: child.descricaoItem,
        unidadesPorPacote: childUpb,
        quantidadePC: child.estoqueCx || 0, // quantidade de pacotes
        caixasEquivalentes,
      });
      totalVariacoesCx += caixasEquivalentes;
      
      // Marcar a variação como filho do mãe (se não já está marcado)
      if (!child.isChild) {
        child.isChild = true;
        child.parentCode = mother.codigoItem;
      }
    }
    
    if (variacoes.length === 0) continue;
    
    // Computar pedidos E-COMMERCE para o mãe e variações
    let ecommerceTotalUn = 0;
    let ecommerceTotalCx = 0;
    
    // Pedidos E-COMMERCE do mãe
    const motherEcom = ecommerceByCode.get(mother.codigoItem);
    if (motherEcom) {
      ecommerceTotalUn += motherEcom.totalUn;
      ecommerceTotalCx += motherUpb ? Math.floor(motherEcom.totalUn / motherUpb) : 0;
    }
    
    // Pedidos E-COMMERCE das variações (converter para caixas do mãe)
    for (const v of variacoes) {
      const childEcom = ecommerceByCode.get(v.codigoItem);
      if (childEcom) {
        ecommerceTotalUn += childEcom.totalUn;
        ecommerceTotalCx += Math.floor(childEcom.totalUn / motherUpb);
      }
    }
    
    const estoqueFisicoCx = mother.estoqueCx || 0;
    
    // Preencher breakdown no produto mãe
    mother.ecommerceBreakdown = {
      totalCaixasOriginal: estoqueFisicoCx + totalVariacoesCx,
      estoqueFisicoCx,
      variacoes,
      pedidosEcommerceCx: ecommerceTotalCx,
      pedidosEcommerceUn: ecommerceTotalUn,
    };
    
    // Marcar mãe como parent (se não já está)
    if (!mother.isParent) {
      mother.isParent = true;
    }
    
    console.log(`[E-Commerce] ${baseName}: mãe=${mother.codigoItem} (${estoqueFisicoCx} cx) + ${variacoes.length} variações (${totalVariacoesCx} cx equiv) = ${estoqueFisicoCx + totalVariacoesCx} cx total | Pedidos E-COM: ${ecommerceTotalCx} cx`);
  }
  
  // ─── Reordenar: produtos pinados primeiro (dentro de cada grupo) ───
  const pinnedSet = new Set(PINNED_FIRST_CODES);
  const pinnedItems = processed.filter(p => pinnedSet.has(p.codigoItem));
  const unpinnedItems = processed.filter(p => !pinnedSet.has(p.codigoItem));
  processed.length = 0;
  processed.push(...pinnedItems, ...unpinnedItems);

  // Save processed data to dashboard_data table
  // Usar upsert para evitar tela branca durante sincronização
  const existing = await db.select({ id: dashboardData.id }).from(dashboardData).where(eq(dashboardData.empresa, "TODAS")).limit(1);
  if (existing.length > 0) {
    await db.update(dashboardData)
      .set({ dataJson: JSON.stringify(processed), computedAt: new Date() })
      .where(eq(dashboardData.empresa, "TODAS"));
  } else {
    await db.insert(dashboardData).values({
      empresa: "TODAS",
      dataJson: JSON.stringify(processed),
    });
  }
  
  const bambuCount = processed.filter(p => p.segmento === "bambu").length;
  const industCount = processed.filter(p => p.segmento === "industrializado").length;
  const poOnlyCount = processed.filter(p => p.estoqueUn === 0 && p.poUn > 0).length;
  const poTotal = processed.reduce((sum, p) => sum + (p.poCx || 0), 0);
  console.log(`[Processor] Espelho fiel: ${processed.length} itens (${bambuCount} bambu, ${industCount} industrializado, ${poOnlyCount} PO-only, PO total: ${poTotal} cx)`);
}
