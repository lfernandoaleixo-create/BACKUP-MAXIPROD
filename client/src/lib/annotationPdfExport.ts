/**
 * Anotações Avulsas — Geração de PDF Mensal
 * Relatório de Queijo Coalho e Alídio com totais diários e resumo mensal
 */
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
      reader.onloadend = () => { logoBase64Cache = reader.result as string; resolve(logoBase64Cache); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface AnnotationEntry {
  id: number;
  tipo: string;
  data: string;
  sectorId: number | null;
  quantidade: string;
  observacoes: string | null;
  lancadoPor: string | null;
  createdAt: Date | string;
}

interface GenerateAnnotationPdfParams {
  entries: AnnotationEntry[];
  month: number; // 0-indexed
  year: number;
}

export async function generateAnnotationPdf({ entries, month, year }: GenerateAnnotationPdfParams) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ─── Logo + Header ───
  const logo = await getLogoBase64();
  if (logo) {
    const logoH = 14;
    const logoW = logoH * LOGO_RATIO;
    doc.addImage(logo, "PNG", margin, y, logoW, logoH);
    y += logoH + 2;
  }

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Relatório de Anotações Avulsas", pageW / 2, y + 6, { align: "center" });
  y += 12;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`${MONTH_NAMES[month]} / ${year} — Seleção Automática`, pageW / 2, y + 4, { align: "center" });
  y += 10;

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Registros de acompanhamento — NÃO contabilizam no total do setor", pageW / 2, y + 3, { align: "center" });
  y += 8;

  // Filter valid entries
  const validEntries = entries.filter(e => parseFloat(String(e.quantidade)) > 0);

  // ─── Summary Cards ───
  const types = [
    { tipo: "queijo_coalho", label: "Queijo Coalho", color: [245, 158, 11] as [number, number, number], bgColor: [255, 251, 235] as [number, number, number] },
    { tipo: "alidio", label: "Alídio", color: [139, 92, 246] as [number, number, number], bgColor: [245, 243, 255] as [number, number, number] },
  ];

  const cardW = (contentW - 6) / 2;
  const cardH = 22;

  types.forEach((t, i) => {
    const x = margin + i * (cardW + 6);
    const typeEntries = validEntries.filter(e => e.tipo === t.tipo);
    const total = typeEntries.reduce((sum, e) => sum + parseFloat(String(e.quantidade)), 0);
    const daysCount = new Set(typeEntries.map(e => e.data)).size;

    // Card background
    doc.setFillColor(...t.bgColor);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, "F");

    // Card border
    doc.setDrawColor(...t.color);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, "S");

    // Label
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...t.color);
    doc.text(t.label, x + 4, y + 7);

    // Total
    doc.setFontSize(16);
    doc.text(`${fmtNum(total)} cx`, x + 4, y + 16);

    // Days count
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`${daysCount} dias`, x + cardW - 4, y + 16, { align: "right" });
  });

  y += cardH + 8;

  // ─── Daily Breakdown Table ───
  // Build daily data: each row = one day, columns = queijo_coalho total, alidio total
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const tableData: any[][] = [];
  let grandTotalQC = 0;
  let grandTotalAL = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayEntries = validEntries.filter(e => e.data === dateStr);
    const qcTotal = dayEntries.filter(e => e.tipo === "queijo_coalho").reduce((s, e) => s + parseFloat(String(e.quantidade)), 0);
    const alTotal = dayEntries.filter(e => e.tipo === "alidio").reduce((s, e) => s + parseFloat(String(e.quantidade)), 0);

    if (qcTotal > 0 || alTotal > 0) {
      const dayOfWeek = new Date(year, month, d).toLocaleDateString("pt-BR", { weekday: "short" });
      const obs = dayEntries.map(e => e.observacoes).filter(Boolean).join("; ");
      tableData.push([
        `${String(d).padStart(2, "0")}/${String(month + 1).padStart(2, "0")} (${dayOfWeek})`,
        qcTotal > 0 ? fmtNum(qcTotal) : "—",
        alTotal > 0 ? fmtNum(alTotal) : "—",
        obs || "—",
      ]);
      grandTotalQC += qcTotal;
      grandTotalAL += alTotal;
    }
  }

  // Add total row
  tableData.push([
    "TOTAL",
    fmtNum(grandTotalQC),
    fmtNum(grandTotalAL),
    "",
  ]);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Detalhamento Diário", margin, y + 4);
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Data", "Queijo Coalho (cx)", "Alídio (cx)", "Observações"]],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 35 },
      1: { halign: "center", cellWidth: 30 },
      2: { halign: "center", cellWidth: 30 },
      3: { halign: "left" },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data: any) => {
      // Bold the TOTAL row
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [30, 41, 59];
      }
    },
  });

  // ─── Footer ───
  const finalY = (doc as any).lastAutoTable?.finalY || y + 50;
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} — Grupo Fox Dashboard`,
    pageW / 2,
    finalY + 8,
    { align: "center" }
  );

  // Save
  const fileName = `anotacoes_${MONTH_NAMES[month].toLowerCase()}_${year}.pdf`;
  doc.save(fileName);
}
