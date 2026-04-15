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
  quantidade: number;
  quantidadeUn: number;
  dataEntrega: string;
  fornecedor: string;
}

interface PedidoCliente {
  cliente: string;
  quantidadeCx: number;
  quantidadeUn: number;
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
}

/**
 * Determine if a product is kg-based.
 * Checks unidadeMedida field AND description for KG pattern.
 * Products like "PCT 20KG" are sold in kg even if unidadeMedida is "un".
 */
function isKgBasedProduct(unidadeMedida: string, descricao: string): boolean {
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
  
  existing.lotes.push({
    numeroPedido: po.numeroPedido || "",
    referenciaPO,
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
  
  // Pedidos que RESERVAM estoque (exclui Digitação)
  const reservingOrders = allValidOrders.filter(
    (o) => o.estadoNota !== "Digitação" && o.estadoNota !== "Digitacao"
  );
  
  // Pedidos em Digitação (apenas para exibição no tooltip)
  const digitacaoOrders = allValidOrders.filter(
    (o) => o.estadoNota === "Digitação" || o.estadoNota === "Digitacao"
  );
  
  // Filter POs: only pending (not Recebido/Cancelado)
  const validPOs = rawPOs.filter(
    (po) => po.estadoItem !== "Recebido" && po.estadoItem !== "Cancelado" &&
            po.estadoItem !== "RECEBIDO" && po.estadoItem !== "CANCELADO"
  );
  
  // ─── Merge stock items by codigoItem (same code from different lotes) ───
  const stockByCode = new Map<string, typeof rawStock[0]>();
  for (const item of rawStock) {
    const code = item.codigoItem;
    const existing = stockByCode.get(code);
    if (existing) {
      (existing as any).quantidade = String(parseFloat(existing.quantidade) + parseFloat(item.quantidade));
    } else {
      stockByCode.set(code, { ...item });
    }
  }
  
  // ─── Build order map by codigoItem (apenas pedidos que RESERVAM estoque) ───
  const orderByCode = new Map<string, { totalUn: number; totalCx: number; items: typeof reservingOrders }>();
  for (const order of reservingOrders) {
    const code = order.codigoItem;
    if (!code) continue;
    const existing = orderByCode.get(code) || { totalUn: 0, totalCx: 0, items: [] };
    existing.items.push(order);
    
    // Acumular quantidade direta (caixas/unidade de venda) para pedidosCx
    const qtyCx = parseFloat(order.quantidade);
    existing.totalCx += qtyCx;
    
    const qtyUnEstoque = order.quantidadeUnEstoque ? parseFloat(order.quantidadeUnEstoque) : 0;
    if (qtyUnEstoque > 0) {
      existing.totalUn += qtyUnEstoque;
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
      
      const qtyCx = parseFloat(order.quantidade);
      const qtyUnEstoque = order.quantidadeUnEstoque ? parseFloat(order.quantidadeUnEstoque) : 0;
      let qtyUn = 0;
      if (qtyUnEstoque > 0) {
        qtyUn = qtyUnEstoque;
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
      } else {
        byClientStatus.set(key, {
          cliente,
          quantidadeCx: qtyCx,
          quantidadeUn: qtyUn,
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
  
  // ─── Build processed items ───
  const processed: ProcessedItem[] = [];
  const processedCodes = new Set<string>();
  
  // 1. Process stock items (espelho fiel)
  for (const item of Array.from(stockByCode.values())) {
    const itemUn = parseFloat(item.quantidade);
    // PRIORIDADE: usar unidadeDeVendaFator do Maxiprod (fonte oficial)
    // Fallback: extrair da descrição do produto
    const maxiprodFator = item.unidadeDeVendaFator ? parseFloat(item.unidadeDeVendaFator) : null;
    const descFator = extractUnitsPerBox(item.descricaoItem);
    // Produto 00808 (VARETA GLADE REEDS): estoque vem em kg, cada caixa = 11.6 kg
    const unitsPerBox = item.codigoItem === '00808' ? 11.6 : (maxiprodFator || descFator);
    
    const orderData = orderByCode.get(item.codigoItem);
    const pedidosUn = orderData?.totalUn || 0;
    
    const poData = poByCode.get(item.codigoItem);
    const poUn = poData?.totalUn || 0;
    const poCx = poData?.totalCx || 0;
    
    const disponivelUn = itemUn - pedidosUn;
    const projetadoUn = disponivelUn + poUn;
    
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
    
    // Para isKgProduct: estoqueCx/pedidosCx/disponivelCx já estão em kg (dividido por fator).
    // PO já vem em kg via fator de importação (poUn). Então poCx = poUn e projetadoCx = disponivelCx + poUn.
    const isKg = item.codigoItem === '00808' ? false : isKgBasedProduct(item.unidadeMedida || "", item.descricaoItem);
    const disponivelCxVal = unitsPerBox ? Math.floor(disponivelUn / unitsPerBox) : null;
    
    processed.push({
      codigoItem: item.codigoItem,
      descricaoItem: item.descricaoItem,
      unidadeMedida: item.unidadeMedida || "",
      grupoCodigo: item.grupoCodigo || "",
      superGrupoCodigo: item.superGrupoCodigo || "",
      descricaoGrupo: item.descricaoGrupo || "",
      empresaDona: item.empresaDona || "",
      estoqueUn: itemUn,
      estoqueCx: unitsPerBox ? Math.floor(itemUn / unitsPerBox) : null,
      unidadesPorCaixa: unitsPerBox,
      pedidosUn,
      pedidosCx: orderData
        ? (unitsPerBox && unitsPerBox !== 1
            ? Math.ceil(pedidosUn / unitsPerBox)   // produto com fator real: converter de un para cx
            : Math.ceil(orderData.totalCx))          // fator=1: quantidade direta já é em caixas
        : null,
      pedidosPorCliente,
      disponivelUn,
      disponivelCx: disponivelCxVal,
      poCx: isKg ? poUn : (poCx || null),
      poUn,
      poEntregas: poData ? Array.from(poData.entregas) : [],
      poFornecedores: poData ? Array.from(poData.fornecedores) : [],
      poLotes: poData ? aggregateLotes(poData.lotes) : [],
      projetadoUn,
      projetadoCx: isKg ? (disponivelCxVal !== null ? disponivelCxVal + poUn : null) : (disponivelCxVal !== null ? disponivelCxVal + (poCx || 0) : null),
      segmento: classifySegment(item.descricaoItem),
      grupo: baseClassification.grupo,
      subgrupo: finalSubgrupo,
      // Produto 00808: NÃO é kg product, é convertido para caixas (peso / 11.6)
      isKgProduct: item.codigoItem === '00808' ? false : isKgBasedProduct(item.unidadeMedida || "", item.descricaoItem),
      estadoConfiguravel: estadoConfPredominante,
      segmentosCRM: Array.from(segCRMSet),
      // Variações
      isParent: variantsByParent.has(item.codigoItem),
      isChild: childToParent.has(item.codigoItem),
      parentCode: childToParent.get(item.codigoItem)?.parentCode || null,
      variants: [], // preenchido no pós-processamento
      variantConversionFactor: childToParent.get(item.codigoItem)?.conversionFactor || null,
      pedidosCxProprio: unitsPerBox ? Math.ceil(pedidosUn / unitsPerBox) : null,
      pedidosUnProprio: pedidosUn,
      pedidosPorClienteProprio: [...pedidosPorCliente],
    });
    processedCodes.add(item.codigoItem);
  }
  
  // 2. Add PO-only items (itens que existem em POs mas NÃO no estoque)
  // Esses itens aparecem com estoque = 0 para que as POs sejam visíveis
  for (const [code, poData] of Array.from(poByCode.entries())) {
    if (processedCodes.has(code)) continue; // Já processado via estoque
    
    // Buscar informações do item a partir da PO
    const poItem = validPOs.find(p => (p.codigoItem || "") === code);
    if (!poItem) continue;
    
    const descricaoItem = poItem.descricaoItem || poItem.descricao || "";
    const unitsPerBox = extractUnitsPerBox(descricaoItem);
    
    const poUn = poData.totalUn;
    const poCx = poData.totalCx;
    
    // ─── Cruzar com pedidos de venda para itens PO-only ───
    const orderData = orderByCode.get(code);
    const pedidosUn = orderData?.totalUn || 0;
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
    
    const disponivelUn = 0 - pedidosUn; // estoque 0 - pedidos
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
        if (!orderData) return unitsPerBox ? (Math.floor(disponivelUn / unitsPerBox) + (poCx || 0)) : null;
        const pedCx = unitsPerBox && unitsPerBox !== 1 ? Math.ceil(pedidosUn / unitsPerBox) : Math.ceil(orderData.totalCx);
        return Math.floor(0 - pedCx) + (poCx || 0);
      })(),
      segmento: classifySegment(descricaoItem),
      ...classifyGrupoFromDesc(descricaoItem, poData.lotes[0]?.referenciaPO),
      isKgProduct: isKgBasedProduct(poItem.unidadeMedidaEstoque || poItem.unidadeMedida || "", poItem.descricaoItem || poItem.descricao || ""),
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
    const parent = processedByCode.get(parentCode);
    if (!parent) continue;
    
    let extraPedidosUn = 0; // pedidos das variações convertidos em unidades do pai
    
    for (const child of children) {
      const childItem = processedByCode.get(child.childCode);
      if (!childItem) continue;
      
      const childPedidosCx = childItem.pedidosCx || 0;
      const childPedidosUn = childItem.pedidosUn;
      const parentUnitsPerBox = parent.unidadesPorCaixa || 1;
      
      // REGRA DE BAIXA DUPLA (10/04/2026):
      // Produtos ZECA (código termina em "Z"): comportamento original - sempre debitar do pai
      // Outros produtos: se a variação TEM estoque próprio (estoqueUn > 0), a fiscal já
      // deu baixa no Maxiprod, então NÃO debitar do pai (evita baixa dupla).
      // Se a variação NÃO tem estoque próprio (estoqueUn === 0), debitar do pai normalmente.
      const isZecaChild = child.childCode.toUpperCase().endsWith('Z');
      const childHasOwnStock = childItem.estoqueUn > 0;
      
      if (isZecaChild || !childHasOwnStock) {
        // ZECA ou variação sem estoque próprio: debitar pedidos do pai (comportamento original)
        extraPedidosUn += childPedidosUn * child.conversionFactor;
      }
      // Se variação NÃO-ZECA tem estoque próprio: NÃO somar ao pai
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
      });
    }
    
    // Ajustar disponível do pai: descontar apenas pedidos de variações que devem ser debitadas
    if (extraPedidosUn > 0) {
      parent.pedidosUn += extraPedidosUn;
      parent.disponivelUn = parent.estoqueUn - parent.pedidosUn;
      if (parent.unidadesPorCaixa) {
        parent.pedidosCx = Math.ceil(parent.pedidosUn / parent.unidadesPorCaixa);
        parent.disponivelCx = Math.floor(parent.disponivelUn / parent.unidadesPorCaixa);
        parent.projetadoUn = parent.disponivelUn + parent.poUn;
        // Para isKgProduct, projetadoCx = disponivelCx + poUn (tudo em kg)
        if (parent.isKgProduct) {
          parent.projetadoCx = parent.disponivelCx !== null ? parent.disponivelCx + parent.poUn : null;
        } else {
          parent.projetadoCx = (parent.disponivelCx ?? 0) + (parent.poCx ?? 0);
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
