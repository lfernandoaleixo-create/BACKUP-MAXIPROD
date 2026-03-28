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
import { getDb } from "./db";
import { stockItems, orderItems, dashboardData, purchaseOrderItems } from "../drizzle/schema";

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
}

interface ProcessedItem {
  // Dados direto do Maxiprod (espelho fiel)
  codigoItem: string;
  descricaoItem: string; // descrição EXATA do Maxiprod
  unidadeMedida: string;
  grupoCodigo: string;
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
  // Flag for kg-based products (displayed in kg, not cx)
  isKgProduct: boolean;
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
  
  const qtyUnEstoque = po.quantidadeUnEstoque ? parseFloat(po.quantidadeUnEstoque) : 0;
  let qtyUn = 0;
  if (qtyUnEstoque > 0) {
    qtyUn = qtyUnEstoque;
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
  const orderByCode = new Map<string, { totalUn: number; items: typeof reservingOrders }>();
  for (const order of reservingOrders) {
    const code = order.codigoItem;
    if (!code) continue;
    const existing = orderByCode.get(code) || { totalUn: 0, items: [] };
    existing.items.push(order);
    
    const qtyUnEstoque = order.quantidadeUnEstoque ? parseFloat(order.quantidadeUnEstoque) : 0;
    if (qtyUnEstoque > 0) {
      existing.totalUn += qtyUnEstoque;
    } else {
      const qty = parseFloat(order.quantidade);
      const fator = order.fatorConversao ? parseFloat(order.fatorConversao) : 0;
      const unitsPerBox = fator > 0 ? fator : extractUnitsPerBox(order.descricao);
      existing.totalUn += unitsPerBox ? qty * unitsPerBox : qty;
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
  
  // ─── Build processed items ───
  const processed: ProcessedItem[] = [];
  const processedCodes = new Set<string>();
  
  // 1. Process stock items (espelho fiel)
  for (const item of Array.from(stockByCode.values())) {
    const itemUn = parseFloat(item.quantidade);
    const unitsPerBox = extractUnitsPerBox(item.descricaoItem);
    
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
    
    processed.push({
      codigoItem: item.codigoItem,
      descricaoItem: item.descricaoItem,
      unidadeMedida: item.unidadeMedida || "",
      grupoCodigo: item.grupoCodigo || "",
      descricaoGrupo: item.descricaoGrupo || "",
      empresaDona: item.empresaDona || "",
      estoqueUn: itemUn,
      estoqueCx: unitsPerBox ? Math.floor(itemUn / unitsPerBox) : null,
      unidadesPorCaixa: unitsPerBox,
      pedidosUn,
      pedidosCx: unitsPerBox ? Math.ceil(pedidosUn / unitsPerBox) : null,
      pedidosPorCliente,
      disponivelUn,
      disponivelCx: unitsPerBox ? Math.floor(disponivelUn / unitsPerBox) : null,
      poCx: poCx || null,
      poUn,
      poEntregas: poData ? Array.from(poData.entregas) : [],
      poFornecedores: poData ? Array.from(poData.fornecedores) : [],
      poLotes: poData ? aggregateLotes(poData.lotes) : [],
      projetadoUn,
      projetadoCx: unitsPerBox ? Math.floor(projetadoUn / unitsPerBox) : null,
      segmento: classifySegment(item.descricaoItem),
      isKgProduct: (item.unidadeMedida || "").toLowerCase() === "kg",
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
    
    processed.push({
      codigoItem: code,
      descricaoItem: descricaoItem,
      unidadeMedida: poItem.unidadeMedidaEstoque || poItem.unidadeMedida || "",
      grupoCodigo: "",
      descricaoGrupo: poItem.codigoGrupo || "",
      empresaDona: poItem.empresaDona || "",
      estoqueUn: 0,
      estoqueCx: unitsPerBox ? 0 : null,
      unidadesPorCaixa: unitsPerBox,
      pedidosUn: 0,
      pedidosCx: unitsPerBox ? 0 : null,
      pedidosPorCliente: [],
      disponivelUn: 0,
      disponivelCx: unitsPerBox ? 0 : null,
      poCx: poCx || null,
      poUn,
      poEntregas: Array.from(poData.entregas),
      poFornecedores: Array.from(poData.fornecedores),
      poLotes: aggregateLotes(poData.lotes),
      projetadoUn: poUn,
      projetadoCx: unitsPerBox ? Math.floor(poUn / unitsPerBox) : null,
      segmento: classifySegment(descricaoItem),
      isKgProduct: (poItem.unidadeMedidaEstoque || poItem.unidadeMedida || "").toLowerCase() === "kg",
    });
    processedCodes.add(code);
  }
  
  // Save processed data to dashboard_data table
  await db.delete(dashboardData);
  await db.insert(dashboardData).values({
    empresa: "TODAS",
    dataJson: JSON.stringify(processed),
  });
  
  const bambuCount = processed.filter(p => p.segmento === "bambu").length;
  const industCount = processed.filter(p => p.segmento === "industrializado").length;
  const poOnlyCount = processed.filter(p => p.estoqueUn === 0 && p.poUn > 0).length;
  const poTotal = processed.reduce((sum, p) => sum + (p.poCx || 0), 0);
  console.log(`[Processor] Espelho fiel: ${processed.length} itens (${bambuCount} bambu, ${industCount} industrializado, ${poOnlyCount} PO-only, PO total: ${poTotal} cx)`);
}
