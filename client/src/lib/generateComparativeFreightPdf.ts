import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ComparativeCarrier {
  transportadora: string;
  cnpj: string;
  totalFrete: number;
  prazo: string;
  protocolo?: string;
}

export interface ComparativeReportData {
  // Identificação do pedido
  numeroPedido: string;
  nomeCliente: string;
  // Origem
  cnpjOrigem: string; // CNPJ do Grupo Fox (remetente)
  cepOrigem: string;
  // Destino
  cnpjDestino: string; // CNPJ do destinatário
  cepDestino: string;
  // Dados da carga
  pesoTotal: number; // kg
  cubagem: number; // m³
  volumes: number;
  valorMercadoria: number; // R$
  // Transportadoras selecionadas para comparação
  carriers: ComparativeCarrier[];
}

function formatCnpj(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return cnpj;
}

function formatCep(cep: string): string {
  const clean = cep.replace(/\D/g, "");
  if (clean.length === 8) {
    return clean.replace(/(\d{5})(\d{3})/, "$1-$2");
  }
  return cep;
}

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function generateComparativeFreightPdf(data: ComparativeReportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // ===== HEADER =====
  doc.setFillColor(0, 128, 128); // Teal
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO COMPARATIVO DE FRETE", pageWidth / 2, 12, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Pedido: #${data.numeroPedido} | Cliente: ${data.nomeCliente}`, pageWidth / 2, 20, { align: "center" });
  doc.setFontSize(7);
  const dataEmissao = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  doc.text(`Emitido em: ${dataEmissao}`, pageWidth / 2, 25, { align: "center" });

  y = 36;

  // ===== DADOS DE ORIGEM E DESTINO =====
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO TRANSPORTE", margin, y);
  y += 2;
  doc.setDrawColor(0, 128, 128);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Two-column layout for Origem and Destino
  const colWidth = (pageWidth - margin * 2 - 10) / 2;

  // ORIGEM box
  doc.setFillColor(245, 250, 250);
  doc.roundedRect(margin, y, colWidth, 30, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 100, 100);
  doc.text("REMETENTE (ORIGEM)", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.text(`CNPJ: ${formatCnpj(data.cnpjOrigem)}`, margin + 4, y + 13);
  doc.text(`CEP: ${formatCep(data.cepOrigem)}`, margin + 4, y + 19);
  doc.text("Ribeirão Vermelho - MG", margin + 4, y + 25);

  // DESTINO box
  const col2X = margin + colWidth + 10;
  doc.setFillColor(245, 250, 250);
  doc.roundedRect(col2X, y, colWidth, 30, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 100, 100);
  doc.text("DESTINATÁRIO (DESTINO)", col2X + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.text(`CNPJ: ${formatCnpj(data.cnpjDestino)}`, col2X + 4, y + 13);
  doc.text(`CEP: ${formatCep(data.cepDestino)}`, col2X + 4, y + 19);
  doc.text(`Cliente: ${data.nomeCliente.substring(0, 35)}`, col2X + 4, y + 25);

  y += 38;

  // ===== DADOS DA CARGA =====
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("DADOS DA CARGA", margin, y);
  y += 2;
  doc.setDrawColor(0, 128, 128);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Cargo data in a grid (4 columns)
  const cargoBoxW = (pageWidth - margin * 2 - 15) / 4;
  const cargoData = [
    { label: "PESO TOTAL", value: `${data.pesoTotal.toFixed(2)} kg` },
    { label: "CUBAGEM", value: `${data.cubagem.toFixed(4)} m³` },
    { label: "VOLUMES", value: `${data.volumes} vol` },
    { label: "VALOR MERCADORIA", value: formatCurrency(data.valorMercadoria) },
  ];

  cargoData.forEach((item, idx) => {
    const boxX = margin + idx * (cargoBoxW + 5);
    doc.setFillColor(240, 248, 248);
    doc.roundedRect(boxX, y, cargoBoxW, 18, 2, 2, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text(item.label, boxX + cargoBoxW / 2, y + 6, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 80, 80);
    doc.text(item.value, boxX + cargoBoxW / 2, y + 14, { align: "center" });
  });

  y += 28;

  // ===== COMPARATIVO DE TRANSPORTADORAS =====
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("COMPARATIVO DE TRANSPORTADORAS", margin, y);
  y += 2;
  doc.setDrawColor(0, 128, 128);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Sort carriers by price (cheapest first)
  const sortedCarriers = [...data.carriers].sort((a, b) => a.totalFrete - b.totalFrete);
  const cheapest = sortedCarriers.length > 0 ? sortedCarriers[0].totalFrete : 0;

  // Table with autoTable
  const tableBody = sortedCarriers.map((carrier, idx) => {
    const percentual = data.valorMercadoria > 0 ? ((carrier.totalFrete / data.valorMercadoria) * 100).toFixed(1) : "0.0";
    const diffFromCheapest = idx === 0 ? "MENOR PREÇO" : `+${formatCurrency(carrier.totalFrete - cheapest)}`;
    return [
      carrier.transportadora,
      carrier.cnpj ? formatCnpj(carrier.cnpj) : "-",
      formatCurrency(carrier.totalFrete),
      `${percentual}%`,
      carrier.prazo || "-",
      carrier.protocolo || "-",
      diffFromCheapest,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Transportadora", "CNPJ", "Valor Frete", "% s/ NF", "Prazo", "Protocolo", "Diferença"]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [0, 128, 128],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 30, 30],
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 30 },
      1: { cellWidth: 32 },
      2: { fontStyle: "bold", cellWidth: 24 },
      3: { cellWidth: 16 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { halign: "center", cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (hookData: any) => {
      // Highlight cheapest row
      if (hookData.section === "body" && hookData.row.index === 0) {
        hookData.cell.styles.fillColor = [220, 252, 231]; // green-100
        hookData.cell.styles.fontStyle = "bold";
      }
      // Highlight "MENOR PREÇO" cell
      if (hookData.section === "body" && hookData.column.index === 6 && hookData.row.index === 0) {
        hookData.cell.styles.textColor = [22, 101, 52]; // green-800
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Get final Y after table
  const finalY = (doc as any).lastAutoTable?.finalY || y + 50;

  // ===== FOOTER =====
  const footerY = finalY + 10;
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  doc.text("Este relatório é gerado automaticamente para fins de comparação e negociação de frete.", pageWidth / 2, footerY, { align: "center" });
  doc.text("Os valores podem sofrer alterações conforme tabela vigente de cada transportadora.", pageWidth / 2, footerY + 4, { align: "center" });
  doc.text("GRUPO FOX — Ribeirão Vermelho/MG — CEP 37264-000", pageWidth / 2, footerY + 10, { align: "center" });

  // Save
  const fileName = `Relatorio_Comparativo_Frete_${data.numeroPedido}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
