/**
 * Generates an Excel file in Maxiprod "Pedidos de Venda" import format.
 * Based on the official "Planilha_Modelo_Pedidos_De_Venda_MAXIPROD.xls" template.
 * 
 * REGRAS CRÍTICAS (extraídas dos comentários do template oficial):
 * 
 * 1. ABA DEVE SE CHAMAR "Dados" (NÃO "Pedidos de Venda")
 * 2. Coluna A (Novo pedido): "S" = primeiro item do pedido, "N" = itens subsequentes
 * 3. Coluna B (Identificador): MESMO valor para todos os itens do mesmo pedido
 * 4. Coluna D (Cliente): CNPJ/CPF APENAS NÚMEROS (zeros à esquerda relevantes!)
 *    Exemplo: 05.282.757/0001-39 → informar "05282757000139"
 * 5. Coluna E (Operação fiscal): APENAS o código numérico (ex: 6102, 5101)
 *    NÃO usar texto descritivo como "6101 - Fora do Estado - Madeira"
 * 6. Coluna G (Representante): CNPJ/CPF apenas números OU nome
 * 7. Coluna I (Forma de pagamento): APENAS "À vista", "A Prazo" ou "Outros"
 *    NÃO usar "Boleto", "PIX", etc.
 * 8. Colunas R, S, Y: Deixar VAZIO quando zero (NÃO colocar 0)
 * 9. Headers devem ser EXATAMENTE como no template (incluindo espaços extras)
 * 
 * 29 columns total. Each row = 1 item of the order.
 */
import ExcelJS from "exceljs";
import { normalizeVendedorName } from "./maxiprodGraphQL";
import { getDb } from "./db";
import { salesOrderRequests, salesOrderRequestItems, stockItems, sellerPermissions } from "../drizzle/schema";
import { eq, inArray, sql } from "drizzle-orm";

// EXACT column headers from Maxiprod official template (MAXIPROD.xls)
// ATENÇÃO: Espaços extras em " Representante/ vendedor " são INTENCIONAIS
const PEDIDO_HEADERS = [
  "Novo pedido *",                                              // A
  "Identificador *",                                            // B
  "Referência",                                                 // C
  "Cliente *",                                                  // D
  "Operação fiscal *",                                          // E
  "Tabela de preços",                                           // F
  " Representante/ vendedor ",                                  // G (espaços antes e depois!)
  "Moeda*",                                                     // H
  "Forma de pagamento (À vista, A prazo ou Outros)",            // I (descrição completa!)
  "Condição de pagamento",                                      // J
  "Código",                                                     // K
  "Descrição",                                                  // L
  "Quantidade*",                                                // M
  "Unidade de venda*",                                          // N
  "Valor unitário",                                             // O
  "Valor de desconto",                                          // P
  "Valor de frete",                                             // Q
  "Valor de seguro",                                            // R
  "Valor de outras despesas",                                   // S
  "Entrega",                                                    // T
  "Previsão entrega",                                           // U
  "Informações adicionais do produto",                          // V
  "Observações técnicas",                                       // W
  "Tipo de comissão (percentual, valor unitário ou valor total)", // X (descrição completa!)
  "Valor da comissão",                                          // Y
  "Pedido do cliente",                                          // Z
  "Pedido do cliente (Item)",                                   // AA
  "Item (nº) do pedido do cliente",                             // AB
  "Resultado da importação",                                    // AC
  "Peso Líquido Total (kg)",                                    // AD (extra - peso por item)
  "Peso Bruto Total (kg)",                                      // AE (extra - peso por item)
];

interface OrderExportData {
  orderId: number;
  orderNumber: number;
  cnpjCpf: string;         // CNPJ/CPF do cliente (apenas números!)
  operacaoFiscal: string;  // Código numérico (ex: "6102")
  tabelaPrecos: string;
  representante: string;   // Nome do vendedor (ou CNPJ/CPF)
  formaPagamento: string;  // "À vista", "A Prazo" ou "Outros"
  condicaoPagamento: string;
  dataEntrega: string;
  previsaoEntrega: string;
  valorFrete: number;
  observacoes: string;           // Obs produção (vai para W - Observações técnicas)
  observacoesInternas: string;   // Obs internas (vai para V junto com estado configurável)
  estadoConfiguravel: string;
  transportadora: string;        // Transportadora selecionada
  protocoloCotacao: string;      // Protocolo da cotação de frete
  tipoFrete: string;             // CIF/FOB/RETIRA
  items: Array<{
    codigoItem: string;
    descricaoItem: string;
    quantidade: number;
    unidadeMedida: string;
    precoUnitario: number;
    valorDesconto: number;
    pesoLiquidoKg?: number;
    pesoBrutoKg?: number;
  }>;
}

/**
 * Format date to DD/MM/YYYY
 */
function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  // If already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  // If in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.split(/[-T]/);
    return `${d}/${m}/${y}`;
  }
  // Try parsing as Date
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const d = String(date.getDate()).padStart(2, "0");
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    }
  } catch {}
  return dateStr;
}

/**
 * Limpa CNPJ/CPF removendo tudo que não é dígito.
 * Mantém zeros à esquerda (relevantes para o Maxiprod).
 */
function cleanCnpjCpf(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[^\d]/g, "");
}

/**
 * Normaliza a forma de pagamento para os valores aceitos pelo Maxiprod.
 * Aceitos: "À vista", "A Prazo", "Outros"
 * 
 * Mapeamentos:
 * - "Boleto", "A prazo", "a prazo", "Faturado" → "A Prazo"
 * - "À vista", "Avista", "PIX", "Dinheiro", "Cartão" → "À vista"
 * - Qualquer outro → "Outros"
 */
function normalizeFormaPagamento(raw: string | null | undefined): string {
  if (!raw) return "A Prazo"; // Default: A Prazo (mais comum para Grupo Fox)
  
  const normalized = raw.trim().toLowerCase();
  
  // A Prazo
  if (
    normalized === "a prazo" ||
    normalized === "boleto" ||
    normalized === "faturado" ||
    normalized === "faturamento" ||
    normalized.includes("prazo") ||
    normalized.includes("boleto") ||
    normalized.includes("faturad")
  ) {
    return "A Prazo";
  }
  
  // À vista
  if (
    normalized === "à vista" ||
    normalized === "a vista" ||
    normalized === "avista" ||
    normalized === "pix" ||
    normalized === "dinheiro" ||
    normalized === "cartão" ||
    normalized === "cartao" ||
    normalized.includes("vista") ||
    normalized.includes("pix") ||
    normalized.includes("dinheiro")
  ) {
    return "À vista";
  }
  
  return "Outros";
}

/**
 * Determine the correct "Operação fiscal" code based on UF.
 * Grupo Fox está no PR.
 * - Mesmo estado (PR): 5101 (venda de produção) ou 5102 (revenda)
 * - Outro estado: 6101 (venda de produção) ou 6102 (revenda)
 * 
 * Default: 6101 (venda interestadual de produção própria) - mais comum para Grupo Fox
 */
function deriveOperacaoFiscal(operacaoFiscal: string | null | undefined, uf: string | null | undefined): string {
  // Se já tem um código numérico válido, usar ele
  if (operacaoFiscal && operacaoFiscal.trim() !== "") {
    // Extrair apenas o código numérico (remover texto descritivo)
    const match = operacaoFiscal.match(/(\d{4}(?:-\d+)?)/);
    if (match) {
      const code = match[1];
      // CORREÇÃO: Se o código extraído é 6xxx (fora do estado) mas o destino é MG (mesmo estado),
      // converter para 5xxx (dentro do estado). E vice-versa.
      const isSameState = uf && uf.toUpperCase() === "MG";
      if (isSameState && code.startsWith("6")) {
        return "5" + code.slice(1); // 6101 → 5101, 6102-1 → 5102-1, etc.
      }
      if (!isSameState && code.startsWith("5")) {
        return "6" + code.slice(1); // 5101 → 6101, 5102-1 → 6102-1, etc.
      }
      return code;
    }
    // Se é só número, retornar direto
    if (/^\d+$/.test(operacaoFiscal.trim())) return operacaoFiscal.trim();
  }
  
  // Default baseado na UF (empresa é de MG)
  // Mesmo estado (MG) = 5101, fora do estado = 6101
  if (uf && uf.toUpperCase() === "MG") return "5101";
  return "6101";
}

/**
 * Convert tipoFrete (CIF/FOB/RETIRA) to Maxiprod code.
 * 0 = CIF (frete por conta do remetente)
 * 1 = FOB (frete por conta do destinatário)
 * 2 = Terceiros
 * 9 = Sem frete / Retira
 */
function tipoFreteToCode(tipoFrete: string | null | undefined): string {
  if (!tipoFrete) return "0"; // Default CIF
  const normalized = tipoFrete.trim().toUpperCase();
  if (normalized === "FOB") return "1";
  if (normalized === "SEM_FRETE") return "";
  if (normalized === "RETIRA" || normalized === "SEM FRETE") return "9";
  return "0"; // CIF
}

/**
 * Build the "Informações adicionais do produto" (col V) content.
 * Concatena: estado configurável + condição frete + transportadora + protocolo
 * Separados por " | "
 * 
 * IMPORTANTE: Observações internas NÃO são incluídas aqui.
 * Column V = "Informações adicionais do produto" aparece na NF/invoice.
 * As observações ficam apenas no Manus (visíveis para subgestor/gestor/Vitória)
 * e a Vitória preenche manualmente no Maxiprod quando necessário.
 */
function buildInfoAdicionais(orderData: OrderExportData): string {
  // IMPORTANTE: Coluna V ("Informações adicionais do produto") aparece na NOTA FISCAL
  // junto com a descrição do item. NÃO colocar informações internas aqui!
  // Estado, Frete, Transportadora, Protocolo etc. são informações internas
  // e NÃO devem aparecer na NF.
  // Retorna vazio para não poluir a nota fiscal.
  return "";
}

/**
 * Generate Excel buffer for a single order in Maxiprod Pedidos de Venda format.
 * 
 * REGRAS IMPLEMENTADAS:
 * - Aba chamada "Dados" (não "Pedidos de Venda")
 * - Cliente = CNPJ apenas números
 * - Operação fiscal = apenas código numérico
 * - Forma de pagamento = "À vista", "A Prazo" ou "Outros"
 * - Campos zero (seguro, outras despesas, comissão) = VAZIO (não 0)
 * - Primeiro item: A = "S", demais: A = "N"
 * - Identificador igual para todos os itens
 * - Headers exatamente como no template oficial
 */
export async function generateMaxiprodOrderExcel(orderData: OrderExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  // CRÍTICO: A aba DEVE se chamar "Dados" (não "Pedidos de Venda")
  const worksheet = workbook.addWorksheet("Dados");

  // Add header row with EXACT headers from template
  worksheet.addRow(PEDIDO_HEADERS);

  // Style header row (cyan background like the Maxiprod template)
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00BCD4" }, // Cyan like Maxiprod template
    };
    cell.border = {
      bottom: { style: "thin" },
    };
  });

  // Add item rows
  const items = orderData.items;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isFirst = i === 0;

    // Today's date as fallback for delivery dates
    const todayBR = (() => {
      const d = new Date();
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    })();

    // CNPJ limpo (apenas números, zeros à esquerda preservados)
    const cnpjLimpo = cleanCnpjCpf(orderData.cnpjCpf);

    const row: (string | number | null)[] = [
      isFirst ? "S" : "N",                                    // A: Novo pedido * (S=primeiro, N=demais)
      String(orderData.orderNumber || orderData.orderId),     // B: Identificador * (mesmo para todos itens)
      String(orderData.orderNumber || orderData.orderId),     // C: Referência (= identificador)
      cnpjLimpo,                                              // D: Cliente * (CNPJ APENAS NÚMEROS!)
      orderData.operacaoFiscal,                               // E: Operação fiscal * (APENAS código numérico!)
      orderData.tabelaPrecos || "001",                        // F: Tabela de preços
      orderData.representante || "",                           // G: Representante/vendedor (nome ou CNPJ)
      "R$",                                                   // H: Moeda* (sempre R$)
      orderData.formaPagamento,                               // I: Forma de pagamento (À vista/A Prazo/Outros)
      orderData.condicaoPagamento || "",                      // J: Condição de pagamento
      item.codigoItem || "",                                  // K: Código do produto
      item.descricaoItem || "",                               // L: Descrição (se vazio, Maxiprod usa cadastro)
      item.quantidade || 1,                                   // M: Quantidade*
      item.unidadeMedida || "CX",                             // N: Unidade de venda*
      item.precoUnitario || 0,                                // O: Valor unitário
      item.valorDesconto || 0,                                // P: Valor de desconto
      null,                                                   // Q: Valor de frete (VAZIO conforme solicitado)
      null,                                                   // R: Valor de seguro (VAZIO, não 0!)
      null,                                                   // S: Valor de outras despesas (VAZIO, não 0!)
      formatDateBR(orderData.dataEntrega) || todayBR,         // T: Entrega
      formatDateBR(orderData.previsaoEntrega) || todayBR,     // U: Previsão entrega
      isFirst ? buildInfoAdicionais(orderData) : "",          // V: Informações adicionais do produto
      "",                                                     // W: Observações técnicas (NÃO exportar - aparece na NF)
      "",                                                     // X: Tipo de comissão (vazio)
      null,                                                   // Y: Valor da comissão (VAZIO, não "0"!)
      "",                                                     // Z: Pedido do cliente
      "",                                                     // AA: Pedido do cliente (Item)
      "0",                                                    // AB: Item (nº) do pedido do cliente
      "",                                                     // AC: Resultado da importação (preenchido pelo Maxiprod)
      // Colunas extras (peso em kg)
      item.pesoLiquidoKg ? (item.pesoLiquidoKg * (item.quantidade || 1)).toFixed(3) : "",  // AD: Peso Líquido Total (kg)
      item.pesoBrutoKg ? (item.pesoBrutoKg * (item.quantidade || 1)).toFixed(3) : "",      // AE: Peso Bruto Total (kg)
    ];

    worksheet.addRow(row);
  }

  // Format number columns
  for (let rowIdx = 2; rowIdx <= items.length + 1; rowIdx++) {
    const row = worksheet.getRow(rowIdx);
    // Quantidade (col 13)
    const qtyCell = row.getCell(13);
    if (typeof qtyCell.value === "number") {
      qtyCell.numFmt = "#,##0.0000";
    }
    // Valor unitário (col 15)
    const priceCell = row.getCell(15);
    if (typeof priceCell.value === "number") {
      priceCell.numFmt = "#,##0.00";
    }
    // Valor desconto (col 16)
    const discCell = row.getCell(16);
    if (typeof discCell.value === "number") {
      discCell.numFmt = "#,##0.00";
    }
    // Valor frete (col 17)
    const freteCell = row.getCell(17);
    if (typeof freteCell.value === "number") {
      freteCell.numFmt = "#,##0.00";
    }
  }

  // Auto-fit column widths
  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = cell.value ? cell.value.toString().length : 0;
      if (length > maxLength) maxLength = Math.min(length, 50);
    });
    column.width = maxLength + 2;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate Maxiprod Order Excel from a saved order in the database.
 * Applies ALL format corrections:
 * - CNPJ apenas números
 * - Operação fiscal apenas código
 * - Forma de pagamento normalizada
 * - Aba "Dados"
 * - Campos vazios onde zero não é aceito
 */
export async function generateMaxiprodOrderExcelFromDb(orderId: number): Promise<{ buffer: Buffer; filename: string }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [order] = await db.select().from(salesOrderRequests)
    .where(eq(salesOrderRequests.id, orderId));
  if (!order) throw new Error("Pedido não encontrado");

  const items = await db.select().from(salesOrderRequestItems)
    .where(eq(salesOrderRequestItems.orderId, orderId));
  if (items.length === 0) throw new Error("Pedido sem itens");

  // Buscar peso dos produtos na tabela stock_items
  const itemCodes = items.map(i => i.codigoItem).filter(Boolean);
  const stockData = itemCodes.length > 0
    ? await db.select({ codigo: stockItems.codigoItem, pesoLiquido: stockItems.pesoLiquido, pesoBruto: stockItems.pesoBruto })
        .from(stockItems)
        .where(inArray(stockItems.codigoItem, itemCodes))
    : [];
  const pesoMap = new Map(stockData.map(s => [s.codigo, { pesoLiquido: Number(s.pesoLiquido) || 0, pesoBruto: Number(s.pesoBruto) || 0 }]));

  // Determine operação fiscal based on UF (apenas código numérico)
  const uf = order.uf || "";
  const operacaoFiscal = deriveOperacaoFiscal(order.operacaoFiscal || null, uf);

  // CNPJ limpo (apenas números)
  const cnpjLimpo = cleanCnpjCpf(order.cnpjCpf);

  // Forma de pagamento normalizada (À vista / A Prazo / Outros)
  const formaPagamento = normalizeFormaPagamento(order.formaPagamento);

  // Buscar CPF/CNPJ do representante na tabela seller_permissions
  let representanteCpfCnpj = "";
  if (order.sellerId) {
    const [seller] = await db.select({ cpfCnpj: sellerPermissions.cpfCnpj })
      .from(sellerPermissions)
      .where(eq(sellerPermissions.id, order.sellerId));
    if (seller?.cpfCnpj) {
      representanteCpfCnpj = seller.cpfCnpj;
    }
  }
  // Fallback: se não tem CPF/CNPJ cadastrado, tenta buscar por nome
  if (!representanteCpfCnpj && order.sellerName) {
    const firstName = order.sellerName.split(' ')[0].toUpperCase();
    const [sellerByName] = await db.select({ cpfCnpj: sellerPermissions.cpfCnpj })
      .from(sellerPermissions)
      .where(sql`UPPER(${sellerPermissions.sellerName}) LIKE ${`%${firstName}%`}`);
    if (sellerByName?.cpfCnpj) {
      representanteCpfCnpj = sellerByName.cpfCnpj;
    }
  }

  const orderData: OrderExportData = {
    orderId: order.id,
    orderNumber: order.orderNumber || order.id,
    cnpjCpf: cnpjLimpo,
    operacaoFiscal,
    tabelaPrecos: order.tabelaPrecos || "",
    representante: representanteCpfCnpj || normalizeVendedorName(order.sellerName || ""),
    formaPagamento,
    condicaoPagamento: order.condicaoPagamento || "",
    dataEntrega: order.dataEntrega || "",
    previsaoEntrega: order.previsaoEntrega || order.dataEntrega || "",
    valorFrete: Number(order.valorFrete) || 0,
    observacoes: order.observacoes || "",
    observacoesInternas: order.observacoesInternas || "",
    estadoConfiguravel: order.estadoConfiguravel || "",
    transportadora: order.transportadora || "",
    protocoloCotacao: order.protocoloCotacao || "",
    tipoFrete: order.tipoFrete || "CIF",
    // REGRA: Todos os produtos do Grupo Fox são vendidos em CAIXA (CX).
    // Independente do que está salvo no item (pode vir 'un' da unidade de estoque),
    // a exportação para Maxiprod SEMPRE deve usar 'CX' como unidade de venda.
    items: items.map(item => {
      const peso = pesoMap.get(item.codigoItem) || { pesoLiquido: 0, pesoBruto: 0 };
      return {
        codigoItem: item.codigoItem || "",
        descricaoItem: item.descricaoItem || "",
        quantidade: Number(item.quantidade) || 1,
        unidadeMedida: "CX",
        precoUnitario: Number(item.precoUnitario) || 0,
        valorDesconto: 0,
        pesoLiquidoKg: peso.pesoLiquido,
        pesoBrutoKg: peso.pesoBruto,
      };
    }),
  };

  const buffer = await generateMaxiprodOrderExcel(orderData);
  const clientName = (order.razaoSocial || order.nomeFantasia || "Pedido")
    .replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);
  const filename = `Pedido_${order.orderNumber || order.id}_${clientName}_Maxiprod.xlsx`;

  return { buffer, filename };
}

/**
 * Generate a Maxiprod export file specifically for bonificação items.
 * Uses the same format as a regular order but with operação fiscal "BONIFICAÇÃO"
 * and only includes the bonificação items.
 */
export async function generateMaxiprodBonificacaoExcelFromDb(orderId: number): Promise<{ buffer: Buffer; filename: string }> {
  const { getDb } = await import("./db");
  const { salesOrderRequests, salesOrderRequestItems, sellerPermissions } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const ExcelJS = await import("exceljs");

  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [order] = await db.select().from(salesOrderRequests).where(eq(salesOrderRequests.id, orderId));
  if (!order) throw new Error("Pedido não encontrado");

  const bonificacaoItems = order.bonificacaoItems ? (typeof order.bonificacaoItems === "string" ? JSON.parse(order.bonificacaoItems) : order.bonificacaoItems) : [];
  if (!bonificacaoItems || bonificacaoItems.length === 0) {
    throw new Error("Este pedido não possui itens de bonificação");
  }

  // Get seller CPF/CNPJ
  let sellerCpfCnpj = "";
  if (order.sellerId) {
    const [seller] = await db.select({ cpfCnpj: sellerPermissions.cpfCnpj })
      .from(sellerPermissions)
      .where(eq(sellerPermissions.id, order.sellerId));
    if (seller?.cpfCnpj) sellerCpfCnpj = seller.cpfCnpj;
  }

  const uf = order.uf || "";
  // Bonificação uses a specific fiscal operation
  const isSameState = uf.toUpperCase() === "MG";
  const operacaoFiscal = isSameState ? "5910" : "6910"; // 5910/6910 = Remessa em bonificação

  const cnpjLimpo = (order.cnpjCpf || "").replace(/\D/g, "");

  // Build the Excel file
  const workbook = new ExcelJS.default.Workbook();
  const ws = workbook.addWorksheet("Dados");

  // Header row (same as regular order)
  const headers = [
    "Data de emissão *", "Nº do pedido de venda *", "Tipo *", "Cliente *",
    "Operação fiscal *", "Condição de pagamento *", "Representante/ vendedor",
    "Moeda", "Observações", "Código do item *", "Descrição do item *",
    "Quantidade *", "Valor unitário *", "Unidade de medida", "Desconto (%)",
    "Desconto (R$)", "Acréscimo (%)", "Acréscimo (R$)", "Frete (R$)",
    "Seguro (R$)", "Outras despesas (R$)", "Informações adicionais do item",
    "Nº do pedido de compra do cliente", "Item do pedido de compra do cliente",
    "Nº do pedido de venda (item)", "Pedido do cliente",
    "Pedido do cliente (Item)", "Item (nº) do pedido do cliente",
    "Depósito", "Observações do item"
  ];
  ws.addRow(headers);

  // Data rows - one per bonificação item
  const today = new Date();
  const dataEmissao = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
  const numPedido = `${order.id}B`; // "B" suffix for bonificação

  for (const item of bonificacaoItems) {
    const row = new Array(30).fill("");
    row[0] = dataEmissao;
    row[1] = numPedido;
    row[2] = "Normal";
    row[3] = cnpjLimpo;
    row[4] = operacaoFiscal;
    row[5] = order.condicaoPagamento || "A VISTA";
    row[6] = sellerCpfCnpj;
    row[7] = "Real";
    row[8] = order.observacoes || "BONIFICAÇÃO";
    row[9] = item.codigoItem || "";
    row[10] = item.descricaoItem || "";
    row[11] = item.quantidade || 1;
    row[12] = item.valorUnitario || 0;
    row[13] = "CX";
    ws.addRow(row);
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const clientName = (order.razaoSocial || order.cnpjCpf || "")
    .replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);
  const filename = `Bonificacao_${order.id}_${clientName}_Maxiprod.xlsx`;
  return { buffer, filename };
}
