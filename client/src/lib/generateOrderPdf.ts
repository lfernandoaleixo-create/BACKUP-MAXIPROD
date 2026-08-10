import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png";
const LOGO_RATIO = 2.11;

let logoBase64Cache: string | null = null;

async function getLogoBase64(): Promise<string | null> {
  if (logoBase64Cache) return logoBase64Cache;
  try {
    const response = await fetch(LOGO_URL);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        logoBase64Cache = reader.result as string;
        resolve(logoBase64Cache);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export type OrderForPdf = {
  pedido: string;
  cliente: string;
  clienteApelido?: string;
  cnpjCpf?: string;
  inscricaoEstadual?: string;
  uf: string;
  dataEmissao: string;
  dataEntrega: string;
  empresa: string;
  representante: string;
  representanteCpfCnpj?: string;
  segmento: string;
  condicaoPagamento?: string;
  formaPagamento?: string;
  meioPagamento?: string;
  transportadora?: string;
  tipoFrete?: string | null;
  valorFrete?: number | null;
  operacaoFiscal?: string;
  naturezaOperacao?: string;
  estadoConfiguravel?: string;
  observacoes?: string;
  grupo?: string;
  valorTotal: number;
  totalProdutos?: number;
  protocoloCotacao?: string | null;
  endereco?: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cep: string;
    cidade: string;
    uf: string;
  } | null;
  telefone?: string;
  emailContato?: string;
  itens: Array<{
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
    codigoItem?: string | null;
    unidadeMedida?: string;
  }>;
  nfs?: Array<{
    numero: string;
    serie: string;
    emissaoData: string;
    valorTotal: number;
    chaveDeAcesso: string | null;
  }>;
  etapa?: string;
};

function formatDateBR(d: string): string {
  if (!d) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  const isoMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function formatCurrency(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

// Colors
const BLACK = [0, 0, 0] as const;
const DARK_GRAY = [40, 40, 40] as const;
const MED_GRAY = [100, 100, 100] as const;
const LIGHT_GRAY = [180, 180, 180] as const;
const VERY_LIGHT_GRAY = [230, 230, 230] as const;
const WHITE = [255, 255, 255] as const;
const HEADER_BG = [245, 245, 245] as const;

export async function generateOrderPdf(order: OrderForPdf, showValues: boolean = false): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ===== HEADER BOX =====
  const headerH = 22;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentWidth, headerH);

  // Logo in header
  const logoData = await getLogoBase64();
  if (logoData) {
    try {
      const logoH = 16;
      const logoW = logoH * LOGO_RATIO;
      doc.addImage(logoData, "PNG", margin + 3, y + 3, logoW, logoH);
    } catch {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLACK);
      doc.text("GRUPO FOX", margin + 5, y + 13);
    }
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);
    doc.text("GRUPO FOX", margin + 5, y + 13);
  }

  // Title centered
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLACK);
  doc.text(`Pedido de venda ${order.pedido}`, pageWidth / 2, y + 10, { align: "center" });

  // Page info top-right
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MED_GRAY);
  doc.text("Página 1 de 1", pageWidth - margin - 2, y + 5, { align: "right" });

  // Date top-right
  const emissaoStr = formatDateBR(order.dataEmissao);
  doc.text(new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }), pageWidth - margin - 2, y + 9, { align: "right" });
  doc.setFontSize(7);
  doc.text(`Emissão ${emissaoStr}`, pageWidth - margin - 2, y + 13, { align: "right" });

  y += headerH + 2;

  // ===== CLIENT SECTION =====
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.2);

  // Client info block
  const clienteNome = order.cliente || order.clienteApelido || "";
  const cnpjDisplay = order.cnpjCpf || "";
  const ieDisplay = order.inscricaoEstadual || "";
  const enderecoFull = order.endereco
    ? `${order.endereco.logradouro}, ${order.endereco.numero}${order.endereco.complemento ? ` - ${order.endereco.complemento}` : ""}, bairro ${order.endereco.bairro} - ${order.endereco.cidade}/${order.endereco.uf} CEP ${order.endereco.cep}`
    : "";
  const telefoneDisplay = order.telefone || "";

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLACK);
  doc.text(`Cliente: ${cnpjDisplay}${cnpjDisplay && clienteNome ? " - " : ""}${clienteNome}`, margin + 2, y + 1);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...DARK_GRAY);
  if (ieDisplay) {
    doc.text(`IE: ${ieDisplay === "ISENTO" ? "NÃO-CONTRIBUINTE" : ieDisplay}`, margin + 4, y);
    y += 3.5;
  }
  if (enderecoFull) {
    doc.text(enderecoFull, margin + 4, y);
    y += 3.5;
  }
  if (telefoneDisplay) {
    doc.text(telefoneDisplay, margin + 4, y);
    y += 3.5;
  }

  // Natureza da operação
  if (order.operacaoFiscal || order.naturezaOperacao) {
    const natOp = order.operacaoFiscal
      ? `${order.operacaoFiscal}${order.estadoConfiguravel ? ` - ${order.estadoConfiguravel}` : ""}`
      : (order.naturezaOperacao || "");
    doc.setFont("helvetica", "normal");
    doc.text(`Natureza da operação: ${natOp}`, margin + 4, y);
    y += 3.5;
  }

  // Moeda
  doc.text("Moeda: R$", margin + 4, y);
  y += 3.5;

  // Representante
  const repDisplay = order.representanteCpfCnpj
    ? `${order.representanteCpfCnpj} - ${order.representante}`
    : order.representante;
  if (repDisplay) {
    doc.setFont("helvetica", "bold");
    doc.text(`Representante/vendedor: ${repDisplay}`, margin + 4, y);
    y += 4;
  }

  // Separator line
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 2;

  // ===== PRODUTOS/SERVIÇOS =====
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLACK);
  doc.text("Produtos/Serviços", margin + 2, y + 1);
  y += 4;

  // Table
  const tableHead = showValues
    ? [["#", "Item", "Descrição", "Quantidade", "Vl un", "Vl tot"]]
    : [["#", "Item", "Descrição", "Quantidade"]];

  const tableBody = order.itens.map((item, idx) => {
    const row: string[] = [
      String(idx + 1),
      item.codigoItem || "—",
      item.descricao,
      `${(Number(item.quantidade) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 4 })} ${item.unidadeMedida || "CX"}`,
    ];
    if (showValues) {
      row.push(formatCurrency(item.valorUnitario));
      row.push(formatCurrency(item.valorTotal));
    }
    return row;
  });

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      textColor: [...DARK_GRAY],
      lineColor: [...LIGHT_GRAY],
      lineWidth: 0.2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [...HEADER_BG],
      textColor: [...BLACK],
      fontStyle: "bold",
      fontSize: 7,
      lineColor: [...BLACK],
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [...WHITE] },
    columnStyles: showValues
      ? {
          0: { cellWidth: 8, halign: "center" as const },
          1: { cellWidth: 16 },
          2: { cellWidth: "auto" as const },
          3: { cellWidth: 24, halign: "center" as const },
          4: { cellWidth: 22, halign: "right" as const },
          5: { cellWidth: 22, halign: "right" as const },
        }
      : {
          0: { cellWidth: 8, halign: "center" as const },
          1: { cellWidth: 20 },
          2: { cellWidth: "auto" as const },
          3: { cellWidth: 30, halign: "center" as const },
        },
  });

  let finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  finalY += 3;

  // ===== TOTALS SECTION =====
  if (showValues) {
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.3);
    doc.line(margin, finalY, pageWidth - margin, finalY);
    finalY += 3;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);
    doc.text("Totais", margin + 2, finalY);
    finalY += 4;

    const totalProd = order.totalProdutos ?? order.itens.reduce((s, i) => s + i.valorTotal, 0);
    const frete = order.valorFrete || 0;
    const valorTotal = order.valorTotal || totalProd + frete;

    const totalsData = [
      ["Valor total dos produtos", formatCurrency(totalProd)],
      ["Frete", formatCurrency(frete)],
      ["Seguro", formatCurrency(0)],
      ["Outras despesas", formatCurrency(0)],
      ["Desconto", formatCurrency(0)],
      ["Valor total", formatCurrency(valorTotal)],
    ];

    doc.setFontSize(7.5);
    totalsData.forEach(([label, value], idx) => {
      const isBold = idx === totalsData.length - 1;
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setTextColor(...(isBold ? BLACK : DARK_GRAY) as [number, number, number]);
      doc.text(label, margin + 6, finalY);
      doc.text(value, margin + 70, finalY, { align: "right" });
      finalY += 3.5;
    });

    finalY += 2;
  }

  // ===== COBRANÇA SECTION =====
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(margin, finalY, pageWidth - margin, finalY);
  finalY += 3;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLACK);
  doc.text("Cobrança", margin + 2, finalY);
  finalY += 4;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK_GRAY);
  const formaPgto = order.formaPagamento || "—";
  const meioPgto = order.meioPagamento ? ` (${order.meioPagamento})` : "";
  const condPgto = order.condicaoPagamento ? ` - ${order.condicaoPagamento}` : "";
  doc.text(`Forma de pagamento: ${formaPgto}${meioPgto}${condPgto}`, margin + 4, finalY);
  finalY += 5;

  // ===== TRANSPORTE SECTION =====
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(margin, finalY, pageWidth - margin, finalY);
  finalY += 3;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLACK);
  doc.text("Transporte", margin + 2, finalY);
  finalY += 4;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK_GRAY);

  // Transport info
  const transportName = order.transportadora || "—";
  const tipoFreteStr = order.tipoFrete || "";
  doc.text(`Transportadora: ${transportName}${tipoFreteStr ? ` (${tipoFreteStr})` : ""}`, margin + 4, finalY);
  finalY += 3.5;

  if (order.protocoloCotacao) {
    doc.text(`Protocolo: ${order.protocoloCotacao}`, margin + 4, finalY);
    finalY += 3.5;
  }

  // Volumes and weight
  const totalVolumes = order.itens.reduce((s, i) => s + i.quantidade, 0);
  doc.text(`Quantidade de volumes: ${totalVolumes.toLocaleString("pt-BR")}`, margin + 4, finalY);

  // Peso bruto (estimate from items if available)
  const pesoTotal = order.itens.reduce((s, i) => s + ((i as any).pesoBruto || 0) * (Number(i.quantidade) || 0), 0);
  const pesoText = `Peso bruto (kg): ${pesoTotal > 0 ? pesoTotal.toFixed(2) : "—"}`;
  doc.text(pesoText, pageWidth / 2, finalY);
  finalY += 5;

  // ===== OBSERVAÇÕES =====
  if (order.observacoes && order.observacoes.trim()) {
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.3);
    doc.line(margin, finalY, pageWidth - margin, finalY);
    finalY += 3;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);
    doc.text("Observações", margin + 2, finalY);
    finalY += 4;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK_GRAY);
    const obsLines = doc.splitTextToSize(order.observacoes, contentWidth - 8);
    doc.text(obsLines, margin + 4, finalY);
    finalY += obsLines.length * 3 + 3;
  }

  // ===== SELLER FOOTER =====
  finalY += 5;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK_GRAY);
  doc.text("Atenciosamente,", margin + 4, finalY);
  finalY += 3.5;
  doc.setFont("helvetica", "bold");
  doc.text(order.representante || "", margin + 4, finalY);
  finalY += 3.5;
  doc.setFont("helvetica", "normal");
  if (order.emailContato) {
    doc.text(order.emailContato, margin + 4, finalY);
  }

  // ===== BOTTOM FOOTER (Company data) =====
  const footerY = pageHeight - 12;
  doc.setDrawColor(...LIGHT_GRAY);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_GRAY);
  doc.text("PALITOS INDUSTRIA E COMERCIO LTDA (35.562.762/0001-29)", pageWidth / 2, footerY, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("RODOVIA RODOVIA AMG 1650, 1070, bairro ZONA RURAL - Ribeirão Vermelho/MG CEP 37.264-000", pageWidth / 2, footerY + 3, { align: "center" });
  doc.text("3536647008  administrativo@grupo-fox.com", pageWidth / 2, footerY + 6, { align: "center" });

  // ===== DOWNLOAD =====
  doc.save(`Pedido_${order.pedido}_GrupoFox.pdf`);
}
