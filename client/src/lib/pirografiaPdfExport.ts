/**
 * Pirografia — Geração de PDFs (Diário, Semanal, Mensal)
 * Relatório de histórico de pirografia com ranking de nomes e produtos
 * Layout em página única A4 portrait (melhor para tabelas de ranking)
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Logo ───
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
      reader.onloadend = () => { logoBase64Cache = reader.result as string; resolve(logoBase64Cache); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ─── Helpers ───
function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Colors ───
const C = {
  primary:    [0, 105, 62] as [number, number, number],
  primaryLt:  [232, 245, 233] as [number, number, number],
  accent:     [234, 88, 12] as [number, number, number],   // orange for pirografia
  accentLt:   [255, 247, 237] as [number, number, number],
  dark:       [30, 41, 59] as [number, number, number],
  medium:     [100, 116, 139] as [number, number, number],
  light:      [241, 245, 249] as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
  black:      [15, 23, 42] as [number, number, number],
  orange:     [234, 88, 12] as [number, number, number],
  orangeLt:   [255, 237, 213] as [number, number, number],
  amber:      [180, 110, 0] as [number, number, number],
  teal:       [13, 148, 136] as [number, number, number],
  tealLt:     [204, 251, 241] as [number, number, number],
  emerald:    [5, 150, 105] as [number, number, number],
  emeraldLt:  [209, 250, 229] as [number, number, number],
};

// ─── Types ───
export type PirografiaHistoryData = {
  topNomes: { nome: string; quantidade: number; registros: number }[];
  topProdutos: { codigoItem: string; descricaoItem: string; materialOrigem: string; quantidade: number; registros: number; tipoCaixa?: string }[];
  total: number;
};

// ─── Header ───
async function drawHeader(doc: jsPDF, title: string, subtitle: string): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 12;
  let y = 10;

  const logo = await getLogoBase64();
  if (logo) {
    const logoH = 12;
    const logoW = logoH * LOGO_RATIO;
    doc.addImage(logo, "PNG", marginL, y, logoW, logoH);
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.primary);
  doc.text(title, marginL + 30, y + 5);

  // Subtitle (period)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.accent);
  doc.text(subtitle, marginL + 30, y + 11);

  // Generated timestamp
  const now = new Date();
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...C.medium);
  doc.text(
    `Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    pageW - 12,
    y + 5,
    { align: "right" }
  );

  y += 16;

  // Divider line
  doc.setDrawColor(...C.primary);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, pageW - 12, y);
  y += 4;

  return y;
}

// ─── Footer ───
function drawFooter(doc: jsPDF, label: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.line(12, pageH - 10, pageW - 12, pageH - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...C.medium);
    doc.text(label, 12, pageH - 6);
    doc.text(`Página ${i} de ${totalPages}`, pageW - 12, pageH - 6, { align: "right" });
    doc.text("Grupo Fox — Sistema de Gestão", pageW / 2, pageH - 6, { align: "center" });
  }
}

// ─── Summary Box ───
function drawSummaryBox(doc: jsPDF, data: PirografiaHistoryData, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 12;
  const boxW = pageW - 24;
  const boxH = 16;

  // Background
  doc.setFillColor(...C.accentLt);
  doc.roundedRect(marginL, y, boxW, boxH, 3, 3, "F");

  // Border
  doc.setDrawColor(...C.accent);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginL, y, boxW, boxH, 3, 3, "S");

  // 3 columns: Total Caixas | Nomes Diferentes | Produtos Diferentes
  const colW = boxW / 3;

  // Total Caixas
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.orange);
  doc.text(fmtNum(data.total, 1), marginL + colW * 0.5, y + 7, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.amber);
  doc.text("Caixas Pirografadas", marginL + colW * 0.5, y + 12, { align: "center" });

  // Nomes Diferentes
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.amber);
  doc.text(String(data.topNomes.length), marginL + colW * 1.5, y + 7, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.amber);
  doc.text("Nomes Diferentes", marginL + colW * 1.5, y + 12, { align: "center" });

  // Produtos Diferentes
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.teal);
  doc.text(String(data.topProdutos.length), marginL + colW * 2.5, y + 7, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.teal);
  doc.text("Produtos Diferentes", marginL + colW * 2.5, y + 12, { align: "center" });

  return y + boxH + 5;
}

// ─── Ranking Tables ───
function drawNomesTable(doc: jsPDF, data: PirografiaHistoryData, startY: number): number {
  const marginL = 12;
  const pageW = doc.internal.pageSize.getWidth();

  // Section title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.orange);
  doc.text("▪ RANKING DE NOMES PIROGRAFADOS", marginL, startY);
  startY += 3;

  const tableData = data.topNomes.map((item, idx) => [
    String(idx + 1),
    item.nome || "(sem nome)",
    fmtNum(item.quantidade, 1) + " cx",
    String(item.registros),
  ]);

  if (tableData.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...C.medium);
    doc.text("Nenhum registro no período", marginL + 4, startY + 5);
    return startY + 10;
  }

  autoTable(doc, {
    startY,
    margin: { left: marginL, right: 12 },
    head: [["#", "Nome", "Quantidade", "Registros"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: C.orange,
      textColor: C.white,
      fontSize: 7,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: {
      fontSize: 7,
      textColor: C.dark,
      cellPadding: 1.5,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 8, fontStyle: "bold" },
      1: { halign: "left", cellWidth: "auto" },
      2: { halign: "right", cellWidth: 28, fontStyle: "bold" },
      3: { halign: "center", cellWidth: 18 },
    },
    alternateRowStyles: {
      fillColor: [255, 249, 240],
    },
    didParseCell: (data) => {
      // Highlight top 3
      if (data.section === "body" && data.row.index < 3 && data.column.index === 0) {
        data.cell.styles.fillColor = C.orangeLt;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  return (doc as any).lastAutoTable.finalY + 6;
}

function drawProdutosTable(doc: jsPDF, data: PirografiaHistoryData, startY: number): number {
  const marginL = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Check if we need a new page
  if (startY > pageH - 50) {
    doc.addPage();
    startY = 15;
  }

  // Section title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.teal);
  doc.text("▪ RANKING DE PRODUTOS PIROGRAFADOS", marginL, startY);
  startY += 3;

  const tableData = data.topProdutos.map((item, idx) => [
    String(idx + 1),
    item.descricaoItem || item.codigoItem,
    item.codigoItem,
    item.materialOrigem === "bambu" ? "Bambu" : "Madeira",
    fmtNum(item.quantidade, 1) + " cx" + (item.tipoCaixa ? ` (${item.tipoCaixa})` : ""),
    String(item.registros),
  ]);

  if (tableData.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...C.medium);
    doc.text("Nenhum registro no período", marginL + 4, startY + 5);
    return startY + 10;
  }

  autoTable(doc, {
    startY,
    margin: { left: marginL, right: 12 },
    head: [["#", "Produto", "Código", "Material", "Quantidade", "Reg."]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: C.teal,
      textColor: C.white,
      fontSize: 7,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: {
      fontSize: 7,
      textColor: C.dark,
      cellPadding: 1.5,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 8, fontStyle: "bold" },
      1: { halign: "left", cellWidth: "auto" },
      2: { halign: "center", cellWidth: 22 },
      3: { halign: "center", cellWidth: 18 },
      4: { halign: "right", cellWidth: 24, fontStyle: "bold" },
      5: { halign: "center", cellWidth: 12 },
    },
    alternateRowStyles: {
      fillColor: [240, 253, 250],
    },
    didParseCell: (data) => {
      // Color-code material column
      if (data.section === "body" && data.column.index === 3) {
        if (data.cell.raw === "Bambu") {
          data.cell.styles.textColor = C.emerald;
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = C.amber;
          data.cell.styles.fontStyle = "bold";
        }
      }
      // Highlight top 3
      if (data.section === "body" && data.row.index < 3 && data.column.index === 0) {
        data.cell.styles.fillColor = C.tealLt;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  return (doc as any).lastAutoTable.finalY + 6;
}

// ═══════════════════════════════════════════════════════════════
// Core PDF generation function
// ═══════════════════════════════════════════════════════════════
async function generatePirografiaPdf(
  data: PirografiaHistoryData,
  periodLabel: string,
  footerLabel: string,
  filename: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = await drawHeader(doc, "HISTÓRICO DE PIROGRAFIA — GRUPO FOX", periodLabel);

  // Summary box
  y = drawSummaryBox(doc, data, y);

  // Nomes table
  y = drawNomesTable(doc, data, y);

  // Produtos table
  y = drawProdutosTable(doc, data, y);

  drawFooter(doc, footerLabel);
  doc.save(filename);
}

// ═══════════════════════════════════════════════════════════════
// 1. PDF DIÁRIO
// ═══════════════════════════════════════════════════════════════
export async function generateDailyPdf(
  data: PirografiaHistoryData,
  date: string,
): Promise<void> {
  const periodLabel = `Relatório Diário — ${fmtDate(date)}`;
  const footerLabel = "Relatório Diário de Pirografia";
  const filename = `Pirografia_Diario_${date.replace(/-/g, "")}.pdf`;
  await generatePirografiaPdf(data, periodLabel, footerLabel, filename);
}

// ═══════════════════════════════════════════════════════════════
// 2. PDF SEMANAL
// ═══════════════════════════════════════════════════════════════
export async function generateWeeklyPdf(
  data: PirografiaHistoryData,
  startDate: string,
  endDate: string,
): Promise<void> {
  const periodLabel = `Relatório Semanal — ${fmtDate(startDate)} a ${fmtDate(endDate)}`;
  const footerLabel = "Relatório Semanal de Pirografia";
  const filename = `Pirografia_Semanal_${startDate.replace(/-/g, "")}_${endDate.replace(/-/g, "")}.pdf`;
  await generatePirografiaPdf(data, periodLabel, footerLabel, filename);
}

// ═══════════════════════════════════════════════════════════════
// 3. PDF MENSAL
// ═══════════════════════════════════════════════════════════════
export async function generateMonthlyPdf(
  data: PirografiaHistoryData,
  yearMonth: string,
): Promise<void> {
  const [year, mon] = yearMonth.split("-");
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const monthLabel = `${monthNames[parseInt(mon) - 1]} ${year}`;
  const periodLabel = `Relatório Mensal — ${monthLabel}`;
  const footerLabel = `Relatório Mensal de Pirografia — ${monthLabel}`;
  const filename = `Pirografia_Mensal_${yearMonth.replace(/-/g, "")}.pdf`;
  await generatePirografiaPdf(data, periodLabel, footerLabel, filename);
}
