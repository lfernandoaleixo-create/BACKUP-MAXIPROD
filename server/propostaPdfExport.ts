import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { storagePut } from "./storage";
import { calcularImpostos, type TipoProduto, type TipoContribuinte } from "./taxCalculation";

// Helper: format monetary value
const fmtCurrency = (val: number): string =>
  `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtNumber = (val: number, decimals = 2): string =>
  val.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// Helper: format CNPJ
const formatCnpj = (cnpj: string): string => {
  if (!cnpj || cnpj.length < 14) return cnpj || "—";
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return cnpj;
};

const formatCep = (cep: string): string => {
  if (!cep) return "";
  const clean = cep.replace(/\D/g, "");
  if (clean.length === 8) return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  return cep;
};

interface PropostaItem {
  seq: number;
  codigoItem: string;
  descricaoItem: string;
  ncm?: string;
  cfop?: string;
  dataEntrega?: string;
  quantidade: number;
  unidadeMedida: string;
  precoUnitario: number;
  desconto: number;
  valorTotal: number;
}

interface PropostaData {
  // Header
  numeroProposta?: string;
  dataEmissao: string;
  referencia?: string;
  // Client
  cnpjCpf: string;
  razaoSocial: string;
  inscricaoEstadual?: string;
  endereco: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  // Operation
  naturezaOperacao?: string;
  moeda?: string;
  representante?: string;
  // Items
  items: PropostaItem[];
  // Totals
  valorTotalProdutos: number;
  valorFrete: number;
  valorSeguro: number;
  outrasDespesas: number;
  valorDesconto: number;
  valorTotal: number;
  // Delivery address (if different)
  enderecoEntrega?: string;
  // Payment
  formaPagamento: string;
  condicaoPagamento: string;
  // Transport
  condicaoFrete?: string;
  transportadora?: string;
  quantidadeVolumes?: number;
  especieVolumes?: string;
  pesoBruto?: number;
  pesoLiquido?: number;
  // Tax info
  tipoProduto?: TipoProduto;
  tipoContribuinte?: TipoContribuinte;
  // Validade
  validadeDias?: number;
  dataValidade?: string;
  // Signature
  assinatura?: string;
  emailContato?: string;
}

/**
 * POST /api/proposta/export-pdf
 * Generates a PDF for the sales proposal matching the Maxiprod format
 */
export async function propostaPdfExportHandler(req: Request, res: Response) {
  try {
    const data: PropostaData = req.body;
    if (!data || !data.items || data.items.length === 0) {
      return res.status(400).json({ error: "Dados da proposta são obrigatórios" });
    }

    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    const pageWidth = 515; // A4 width - margins
    const leftMargin = 40;

    // ========== HEADER ==========
    // Logo area (text-based since we don't have the image file)
    doc.fontSize(16).font("Helvetica-Bold")
      .text("GRUPO", leftMargin, 40);
    doc.fontSize(16).font("Helvetica-Bold")
      .text("FOX", leftMargin, 56);
    
    // Title
    const numProposta = data.numeroProposta || `P${Date.now().toString(36).toUpperCase()}`;
    doc.fontSize(12).font("Helvetica-Bold")
      .text(`Proposta de Venda ${numProposta}`, leftMargin + 150, 40, { width: 250, align: "center" });

    // Page info (top right)
    doc.fontSize(8).font("Helvetica")
      .text("Página 1 de 1", leftMargin + pageWidth - 80, 40, { width: 80, align: "right" });
    
    // Date (right aligned)
    doc.fontSize(8).font("Helvetica")
      .text(data.dataEmissao || new Date().toLocaleDateString("pt-BR"), leftMargin + pageWidth - 120, 55, { width: 120, align: "right" });

    doc.moveDown(1);
    let y = 80;

    // ========== BORDER BOX ==========
    doc.rect(leftMargin - 5, y - 5, pageWidth + 10, 2).fill("#000");
    y += 5;

    // ========== REFERÊNCIA / EMISSÃO ==========
    if (data.referencia) {
      doc.fontSize(8).font("Helvetica-Bold").text("Referência: ", leftMargin, y, { continued: true });
      doc.font("Helvetica").text(data.referencia);
    }
    doc.fontSize(8).font("Helvetica-Bold")
      .text(`Emissão ${data.dataEmissao || new Date().toLocaleDateString("pt-BR")}`, leftMargin + pageWidth - 150, y, { width: 150, align: "right" });
    y += 12;
    if (data.dataValidade) {
      doc.fontSize(8).font("Helvetica-Bold")
        .text(`Validade: ${data.dataValidade}${data.validadeDias ? ` (${data.validadeDias} dias)` : ""}`, leftMargin + pageWidth - 200, y, { width: 200, align: "right" });
      y += 12;
    }
    y += 3;

    // ========== CLIENT DATA ==========
    doc.fontSize(8).font("Helvetica-Bold").text("Cliente: ", leftMargin, y, { continued: true });
    doc.font("Helvetica").text(`${formatCnpj(data.cnpjCpf)} - ${data.razaoSocial}`);
    y += 12;

    if (data.inscricaoEstadual) {
      doc.fontSize(8).font("Helvetica-Bold").text("IE: ", leftMargin, y, { continued: true });
      doc.font("Helvetica").text(data.inscricaoEstadual);
      y += 12;
    }

    // Address
    const enderecoFull = `${data.endereco}, ${data.numero}, bairro ${data.bairro} - ${data.municipio}/${data.uf} CEP ${formatCep(data.cep)}`;
    doc.fontSize(8).font("Helvetica").text(enderecoFull, leftMargin, y, { width: pageWidth });
    y += 12;

    // ========== NATUREZA OPERAÇÃO ==========
    if (data.naturezaOperacao) {
      y += 5;
      doc.fontSize(8).font("Helvetica-Bold").text("Natureza da operação: ", leftMargin, y, { continued: true });
      doc.font("Helvetica").text(data.naturezaOperacao);
      y += 12;
    }

    doc.fontSize(8).font("Helvetica-Bold").text("Moeda: ", leftMargin, y, { continued: true });
    doc.font("Helvetica").text(data.moeda || "R$");
    y += 12;

    if (data.representante) {
      doc.fontSize(8).font("Helvetica-Bold").text("Representante/vendedor: ", leftMargin, y, { continued: true });
      doc.font("Helvetica").text(data.representante);
      y += 12;
    }

    // ========== PRODUCTS TABLE ==========
    y += 8;
    doc.rect(leftMargin - 5, y - 3, pageWidth + 10, 1).fill("#000");
    y += 5;
    doc.fontSize(9).font("Helvetica-Bold").text("Produtos/Serviços", leftMargin, y);
    y += 14;

    // Table header
    const colWidths = [20, 40, 55, 200, 55, 50, 55, 55];
    const headers = ["#", "Item", "CFOP", "Descrição", "Quantidade", "Vl un", "Vl desconto", "Vl tot"];
    
    doc.fontSize(7).font("Helvetica-Bold");
    let xPos = leftMargin;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], xPos, y, { width: colWidths[i], align: i >= 4 ? "right" : "left" });
      xPos += colWidths[i] + 3;
    }
    y += 12;
    doc.rect(leftMargin - 5, y - 2, pageWidth + 10, 0.5).fill("#ccc");
    y += 3;

    // Table rows
    doc.fontSize(7).font("Helvetica");
    for (const item of data.items) {
      if (y > 700) { doc.addPage(); y = 50; }
      xPos = leftMargin;
      const rowData = [
        String(item.seq),
        item.codigoItem,
        item.cfop || "",
        item.descricaoItem,
        `${fmtNumber(item.quantidade, 4)} ${item.unidadeMedida}`,
        fmtNumber(item.precoUnitario),
        fmtNumber(item.desconto),
        fmtNumber(item.valorTotal),
      ];
      for (let i = 0; i < rowData.length; i++) {
        doc.text(rowData[i], xPos, y, { width: colWidths[i], align: i >= 4 ? "right" : "left" });
        xPos += colWidths[i] + 3;
      }
      y += 11;
    }

    // ========== TAX BREAKDOWN (right side) ==========
    y += 5;
    // Calculate taxes if we have enough info
    let taxBreakdown: { label: string; aliquota: string; valor: string }[] = [];
    if (data.uf && data.tipoProduto) {
      const taxes = calcularImpostos({
        valorVenda: data.valorTotalProdutos,
        ufDestino: data.uf,
        tipoProduto: data.tipoProduto || "industrializado",
        tipoContribuinte: data.tipoContribuinte || "Contribuinte",
        faturamentoTrimestral: 0,
      });
      taxBreakdown = [
        { label: "IPI", aliquota: "0,00%", valor: fmtNumber(0) },
        { label: "PIS", aliquota: `${fmtNumber(taxes.pisEfetivo)}%`, valor: fmtNumber(taxes.pisValor) },
        { label: "COFINS", aliquota: `${fmtNumber(taxes.cofinsEfetiva)}%`, valor: fmtNumber(taxes.cofinsValor) },
        { label: "ICMS", aliquota: `${fmtNumber(taxes.icmsEfetivo)}%`, valor: fmtNumber(taxes.icmsValor) },
        { label: "ICMS ajuste", aliquota: `${fmtNumber(taxes.icmsEfetivo)}%`, valor: fmtNumber(taxes.icmsValor) },
        { label: "TOT TRIB", aliquota: `${fmtNumber(taxes.totalImpostosPerc)}%`, valor: fmtNumber(taxes.totalImpostosValor) },
      ];
      if (taxes.difalValor > 0) {
        taxBreakdown.push({ label: "DIFAL", aliquota: `${fmtNumber(taxes.difalEfetivo)}%`, valor: fmtNumber(taxes.difalValor) });
      }
    }

    // Tax table (right column)
    if (taxBreakdown.length > 0) {
      const taxX = leftMargin + 320;
      const taxStartY = y;
      doc.fontSize(7).font("Helvetica-Bold");
      doc.text("Imposto", taxX, taxStartY, { width: 60 });
      doc.text("Alíquota", taxX + 60, taxStartY, { width: 50, align: "right" });
      doc.text("Valor", taxX + 120, taxStartY, { width: 60, align: "right" });
      let taxY = taxStartY + 11;
      doc.font("Helvetica");
      for (const t of taxBreakdown) {
        doc.text(t.label, taxX, taxY, { width: 60 });
        doc.text(t.aliquota, taxX + 60, taxY, { width: 50, align: "right" });
        doc.text(t.valor, taxX + 120, taxY, { width: 60, align: "right" });
        taxY += 10;
      }
      y = Math.max(y, taxY);
    }

    // ========== TOTALS (left side) ==========
    y += 10;
    doc.rect(leftMargin - 5, y - 3, pageWidth + 10, 1).fill("#000");
    y += 5;
    doc.fontSize(9).font("Helvetica-Bold").text("Totais", leftMargin, y);
    y += 14;

    const totals = [
      ["Valor total dos produtos", fmtCurrency(data.valorTotalProdutos)],
      ["Frete", fmtCurrency(data.valorFrete)],
      ["Seguro", fmtCurrency(data.valorSeguro)],
      ["Outras despesas", fmtCurrency(data.outrasDespesas)],
      ["Desconto", fmtCurrency(data.valorDesconto)],
      ["Valor total", fmtCurrency(data.valorTotal)],
    ];

    doc.fontSize(8).font("Helvetica");
    for (const [label, value] of totals) {
      if (label === "Valor total") doc.font("Helvetica-Bold");
      doc.text(label, leftMargin + 10, y, { width: 180 });
      doc.text(value, leftMargin + 150, y, { width: 100, align: "right" });
      y += 12;
      if (label === "Valor total") doc.font("Helvetica");
    }

    // ========== DELIVERY ADDRESS ==========
    if (data.enderecoEntrega) {
      y += 10;
      doc.rect(leftMargin - 5, y - 3, pageWidth + 10, 0.5).fill("#000");
      y += 5;
      doc.fontSize(9).font("Helvetica-Bold").text("Endereço de entrega", leftMargin, y);
      y += 14;
      doc.fontSize(8).font("Helvetica").text(data.enderecoEntrega, leftMargin + 10, y, { width: pageWidth - 20 });
      y += 14;
    }

    // ========== PAYMENT ==========
    y += 10;
    doc.rect(leftMargin - 5, y - 3, pageWidth + 10, 0.5).fill("#000");
    y += 5;
    doc.fontSize(9).font("Helvetica-Bold").text("Cobrança", leftMargin, y);
    y += 14;
    doc.fontSize(8).font("Helvetica");
    doc.font("Helvetica-Bold").text("Forma de pagamento: ", leftMargin + 10, y, { continued: true });
    doc.font("Helvetica").text(data.formaPagamento || "—");
    y += 12;
    doc.font("Helvetica-Bold").text("Condição de pagamento: ", leftMargin + 10, y, { continued: true });
    doc.font("Helvetica").text(data.condicaoPagamento || "—");
    y += 12;
    if (data.dataValidade) {
      doc.font("Helvetica-Bold").text("Validade da proposta: ", leftMargin + 10, y, { continued: true });
      doc.font("Helvetica").text(`${data.dataValidade}${data.validadeDias ? ` (${data.validadeDias} dias)` : ""}`);
      y += 12;
    }

    // ========== TRANSPORT ==========
    y += 10;
    doc.rect(leftMargin - 5, y - 3, pageWidth + 10, 0.5).fill("#000");
    y += 5;
    doc.fontSize(9).font("Helvetica-Bold").text("Transporte", leftMargin, y);
    y += 14;
    doc.fontSize(8).font("Helvetica");

    // Row 1: Condição de frete + Transportadora
    doc.font("Helvetica-Bold").text("Condição de frete: ", leftMargin + 10, y, { continued: true });
    doc.font("Helvetica").text(data.condicaoFrete || "—");
    if (data.transportadora) {
      doc.font("Helvetica-Bold").text("Transportadora: ", leftMargin + 280, y, { continued: true });
      doc.font("Helvetica").text(data.transportadora);
    }
    y += 12;

    // Row 2: Volumes + Espécie
    if (data.quantidadeVolumes) {
      doc.font("Helvetica-Bold").text("Quantidade de volumes: ", leftMargin + 10, y, { continued: true });
      doc.font("Helvetica").text(String(data.quantidadeVolumes));
      if (data.especieVolumes) {
        doc.font("Helvetica-Bold").text("Espécie: ", leftMargin + 200, y, { continued: true });
        doc.font("Helvetica").text(data.especieVolumes);
      }
      y += 12;
    }

    // Row 3: Peso bruto + Peso líquido
    if (data.pesoBruto) {
      doc.font("Helvetica-Bold").text("Peso bruto (kg): ", leftMargin + 10, y, { continued: true });
      doc.font("Helvetica").text(fmtNumber(data.pesoBruto, 3));
      if (data.pesoLiquido) {
        doc.font("Helvetica-Bold").text("Peso líquido (kg): ", leftMargin + 280, y, { continued: true });
        doc.font("Helvetica").text(fmtNumber(data.pesoLiquido, 3));
      }
      y += 12;
    }

    // ========== SIGNATURE ==========
    y += 30;
    doc.fontSize(8).font("Helvetica")
      .text("Atenciosamente,", leftMargin, y);
    y += 12;
    doc.font("Helvetica-Bold").text(data.assinatura || "VITORIA", leftMargin, y);
    y += 12;
    doc.font("Helvetica").text(data.emailContato || "suporte@grupo-fox.com", leftMargin, y);

    // ========== FOOTER ==========
    const pdfRange = doc.bufferedPageRange();
    const totalPages = pdfRange.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor("#999999").font("Helvetica")
        .text(
          `Sistema de gestão www.maxiprod.com.br`,
          leftMargin, 790, { align: "right", width: pageWidth }
        );
    }

    doc.end();
    const pdfBuffer = await pdfPromise;

    // Upload to S3
    const timestamp = Date.now().toString(36);
    const fileKey = `propostas/Proposta_Venda_${numProposta}-${timestamp}.pdf`;
    const { url: pdfUrl } = await storagePut(fileKey, pdfBuffer, "application/pdf");

    // Return PDF URL or download directly
    if (req.query.download === "true") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Proposta_Venda_${numProposta}.pdf"`);
      res.send(pdfBuffer);
    } else {
      res.json({ url: pdfUrl, numeroProposta: numProposta });
    }
  } catch (err: any) {
    console.error("[PropostaPDF] Error:", err);
    res.status(500).json({ error: err.message || "Erro ao gerar PDF da proposta" });
  }
}
