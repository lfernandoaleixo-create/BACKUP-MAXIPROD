/**
 * Generates an Excel file in Maxiprod "Pedidos de Venda" import format.
 * Based on the official "Planilha_Modelo_Pedidos_De_Venda_MAXIPROD.xls" template.
 * 
 * 29 columns total. Each row = 1 item of the order.
 * First item has "Novo pedido" = "S", subsequent items = "N".
 * 
 * IMPORTANT: Maxiprod rejects imports when required fields (*) are empty.
 * All required fields MUST have a valid value.
 */
import ExcelJS from "exceljs";
import { getDb } from "./db";
import { salesOrderRequests, salesOrderRequestItems } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Exact column headers from Maxiprod import template
const PEDIDO_HEADERS = [
  "Novo pedido *",
  "Identificador *",
  "Referência",
  "Cliente *",
  "Operação fiscal *",
  "Tabela de preços",
  "Representante/ vendedor",
  "Moeda*",
  "Forma de pagamento",
  "Condição de pagamento",
  "Código",
  "Descrição",
  "Quantidade*",
  "Unidade de venda*",
  "Valor unitário",
  "Valor de desconto",
  "Valor de frete",
  "Valor de seguro",
  "Valor de outras despesas",
  "Entrega",
  "Previsão entrega",
  "Informações adicionais do produto",
  "Observações técnicas",
  "Tipo de comissão",
  "Valor da comissão",
  "Pedido do cliente",
  "Pedido do cliente (Item)",
  "Item (nº) do pedido do cliente",
  "Resultado da importação",
];

interface OrderExportData {
  orderId: number;
  orderNumber: number;
  razaoSocial: string;
  operacaoFiscal: string;
  tabelaPrecos: string;
  representante: string;
  moeda: string;
  formaPagamento: string;
  condicaoPagamento: string;
  dataEntrega: string;
  previsaoEntrega: string;
  valorFrete: number;
  observacoes: string;
  estadoConfiguravel: string;
  items: Array<{
    codigoItem: string;
    descricaoItem: string;
    quantidade: number;
    unidadeMedida: string;
    precoUnitario: number;
    valorDesconto: number;
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
 * Determine the correct "Operação fiscal" based on UF
 * - Same state (PR): 5101 (venda de produção) or 5102 (revenda)
 * - Different state: 6101 (venda de produção) or 6102 (revenda)
 * Default to 6101 (venda interestadual de produção própria) which is most common for Grupo Fox
 */
function deriveOperacaoFiscal(operacaoFiscal: string | null | undefined, uf: string | null | undefined): string {
  if (operacaoFiscal && operacaoFiscal.trim() !== "") return operacaoFiscal;
  // Default: 6101 for interstate sales (Grupo Fox is in PR, most clients are out of state)
  if (uf && uf.toUpperCase() === "PR") return "5101";
  return "6101";
}

/**
 * Generate Excel buffer for a single order in Maxiprod Pedidos de Venda format
 * GUARANTEE: No required field will be empty.
 */
export async function generateMaxiprodOrderExcel(orderData: OrderExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Pedidos de Venda");

  // Add header row
  worksheet.addRow(PEDIDO_HEADERS);

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFCC" }, // Light yellow like Maxiprod
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
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    })();

    const row: (string | number)[] = [
      isFirst ? "S" : "N",                           // 1. Novo pedido * (REQUIRED: "S" or "N")
      String(orderData.orderNumber || orderData.orderId), // 2. Identificador * (REQUIRED: unique ID)
      String(orderData.orderNumber || orderData.orderId), // 3. Referência (same as identifier)
      orderData.razaoSocial || "CLIENTE",             // 4. Cliente * (REQUIRED: must match Maxiprod cadastro)
      orderData.operacaoFiscal || "6101",             // 5. Operação fiscal * (REQUIRED: CFOP code)
      orderData.tabelaPrecos || "001",                // 6. Tabela de preços (default: 001)
      orderData.representante || "",                    // 7. Representante/vendedor
      orderData.moeda || "R$",                        // 8. Moeda* (REQUIRED: "R$")
      orderData.formaPagamento || "A prazo",          // 9. Forma de pagamento
      orderData.condicaoPagamento || "",              // 10. Condição de pagamento
      item.codigoItem || "00000",                     // 11. Código (product code)
      item.descricaoItem || "PRODUTO",                // 12. Descrição (product description)
      item.quantidade || 1,                           // 13. Quantidade* (REQUIRED: must be > 0)
      item.unidadeMedida || "CX",                    // 14. Unidade de venda* (REQUIRED: "CX", "UN", "KG", etc.)
      item.precoUnitario || 0,                        // 15. Valor unitário (price per unit)
      item.valorDesconto || 0,                        // 16. Valor de desconto
      isFirst ? (orderData.valorFrete || 0) : 0,     // 17. Valor de frete (only on first item)
      0,                                              // 18. Valor de seguro
      0,                                              // 19. Valor de outras despesas
      formatDateBR(orderData.dataEntrega) || todayBR, // 20. Entrega (delivery date)
      formatDateBR(orderData.previsaoEntrega) || todayBR, // 21. Previsão entrega
      orderData.estadoConfiguravel || "",              // 22. Informações adicionais do produto
      isFirst ? (orderData.observacoes || "") : "",     // 23. Observações técnicas
      "",                                             // 24. Tipo de comissão
      "0",                                            // 25. Valor da comissão
      "",                                             // 26. Pedido do cliente
      "",                                             // 27. Pedido do cliente (Item)
      "0",                                            // 28. Item (nº) do pedido do cliente
      "",                                             // 29. Resultado da importação (filled by Maxiprod)
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
 * Generate Maxiprod Order Excel from a saved order in the database
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

  // Determine operação fiscal based on UF
  const uf = order.uf || "";
  const operacaoFiscal = deriveOperacaoFiscal(order.operacaoFiscal || null, uf);

  const orderData: OrderExportData = {
    orderId: order.id,
    orderNumber: order.orderNumber || order.id,
    razaoSocial: order.razaoSocial || order.nomeFantasia || "CLIENTE",
    operacaoFiscal,
    tabelaPrecos: order.tabelaPrecos || "",
    representante: order.sellerName || "",
    moeda: "R$",
    formaPagamento: order.formaPagamento || "A prazo",
    condicaoPagamento: order.condicaoPagamento || "",
    dataEntrega: order.dataEntrega || "",
    previsaoEntrega: order.previsaoEntrega || order.dataEntrega || "",
    valorFrete: Number(order.valorFrete) || 0,
    observacoes: order.observacoes || "",
    estadoConfiguravel: order.estadoConfiguravel || "",
    items: items.map(item => ({
      codigoItem: item.codigoItem || "",
      descricaoItem: item.descricaoItem || "PRODUTO",
      quantidade: Number(item.quantidade) || 1,
      unidadeMedida: item.unidadeMedida || "CX",
      precoUnitario: Number(item.precoUnitario) || 0,
      valorDesconto: 0,
    })),
  };

  const buffer = await generateMaxiprodOrderExcel(orderData);
  const clientName = (order.razaoSocial || order.nomeFantasia || "Pedido")
    .replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);
  const filename = `Pedido_${order.orderNumber || order.id}_${clientName}_Maxiprod.xlsx`;

  return { buffer, filename };
}
