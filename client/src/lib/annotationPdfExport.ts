/**
 * Anotações Avulsas — Geração de PDF (Diário, Semanal, Mensal)
 * Relatório de Queijo Coalho, Alídio e Palitos Premium com totais e resumo
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
const WEEKDAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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

export type PdfPeriod = "diario" | "semanal" | "mensal";

interface GenerateAnnotationPdfParams {
  entries: AnnotationEntry[];
  period: PdfPeriod;
  /** For monthly: 0-indexed month */
  month?: number;
  /** For monthly: year */
  year?: number;
  /** For daily: the specific date string YYYY-MM-DD */
  date?: string;
  /** For weekly: start date YYYY-MM-DD */
  weekStart?: string;
  /** For weekly: end date YYYY-MM-DD */
  weekEnd?: string;
}

/** Backward-compatible overload for existing callers */
export async function generateAnnotationPdf(params: GenerateAnnotationPdfParams | { entries: AnnotationEntry[]; month: number; year: number }) {
  // Normalize old-style params (month/year only) to new format
  if (!("period" in params)) {
    return generateAnnotationPdfInternal({
      entries: params.entries,
      period: "mensal",
      month: params.month,
      year: params.year,
    });
  }
  return generateAnnotationPdfInternal(params);
}

async function generateAnnotationPdfInternal({ entries, period, month, year, date, weekStart, weekEnd }: GenerateAnnotationPdfParams) {
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

  // Subtitle based on period
  let subtitle = "";
  let fileName = "";
  if (period === "diario" && date) {
    const d = new Date(date + "T12:00:00");
    const dayName = WEEKDAY_NAMES[d.getDay()];
    subtitle = `${d.toLocaleDateString("pt-BR")} (${dayName}) — Seleção Automática`;
    fileName = `anotacoes_diario_${date}.pdf`;
  } else if (period === "semanal" && weekStart && weekEnd) {
    const ws = new Date(weekStart + "T12:00:00");
    const we = new Date(weekEnd + "T12:00:00");
    subtitle = `Semana: ${ws.toLocaleDateString("pt-BR")} a ${we.toLocaleDateString("pt-BR")} — Seleção Automática`;
    fileName = `anotacoes_semanal_${weekStart}_a_${weekEnd}.pdf`;
  } else if (period === "mensal" && month !== undefined && year !== undefined) {
    subtitle = `${MONTH_NAMES[month]} / ${year} — Seleção Automática`;
    fileName = `anotacoes_${MONTH_NAMES[month].toLowerCase()}_${year}.pdf`;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle, pageW / 2, y + 4, { align: "center" });
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
    { tipo: "palitos_premium", label: "Palitos Premium", color: [5, 150, 105] as [number, number, number], bgColor: [236, 253, 245] as [number, number, number] },
  ];

  const cardW = (contentW - 12) / 3;
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
    doc.text(`${daysCount} dia${daysCount !== 1 ? "s" : ""}`, x + cardW - 4, y + 16, { align: "right" });
  });

  y += cardH + 8;

  // ─── Daily Breakdown Table ───
  // Build date range based on period
  let dateList: string[] = [];
  if (period === "diario" && date) {
    dateList = [date];
  } else if (period === "semanal" && weekStart && weekEnd) {
    const start = new Date(weekStart + "T12:00:00");
    const end = new Date(weekEnd + "T12:00:00");
    const current = new Date(start);
    while (current <= end) {
      dateList.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
  } else if (period === "mensal" && month !== undefined && year !== undefined) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      dateList.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  }

  const tableData: any[][] = [];
  let grandTotalQC = 0;
  let grandTotalAL = 0;
  let grandTotalPP = 0;

  for (const dateStr of dateList) {
    const dayEntries = validEntries.filter(e => e.data === dateStr);
    const qcTotal = dayEntries.filter(e => e.tipo === "queijo_coalho").reduce((s, e) => s + parseFloat(String(e.quantidade)), 0);
    const alTotal = dayEntries.filter(e => e.tipo === "alidio").reduce((s, e) => s + parseFloat(String(e.quantidade)), 0);
    const ppTotal = dayEntries.filter(e => e.tipo === "palitos_premium").reduce((s, e) => s + parseFloat(String(e.quantidade)), 0);

    if (qcTotal > 0 || alTotal > 0 || ppTotal > 0) {
      const d = new Date(dateStr + "T12:00:00");
      const dayOfWeek = d.toLocaleDateString("pt-BR", { weekday: "short" });
      const dayLabel = period === "diario"
        ? d.toLocaleDateString("pt-BR", { weekday: "long" })
        : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} (${dayOfWeek})`;
      const obs = dayEntries.map(e => e.observacoes).filter(Boolean).join("; ");
      tableData.push([
        dayLabel,
        qcTotal > 0 ? fmtNum(qcTotal) : "—",
        alTotal > 0 ? fmtNum(alTotal) : "—",
        ppTotal > 0 ? fmtNum(ppTotal) : "—",
        obs || "—",
      ]);
      grandTotalQC += qcTotal;
      grandTotalAL += alTotal;
      grandTotalPP += ppTotal;
    }
  }

  // Add total row
  tableData.push([
    "TOTAL",
    fmtNum(grandTotalQC),
    fmtNum(grandTotalAL),
    fmtNum(grandTotalPP),
    "",
  ]);

  const tableTitle = period === "diario" ? "Registros do Dia" : "Detalhamento Diário";
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(tableTitle, margin, y + 4);
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Data", "Queijo Coalho (cx)", "Alídio (cx)", "Palitos Premium (cx)", "Observações"]],
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
      0: { halign: "left", cellWidth: 32 },
      1: { halign: "center", cellWidth: 26 },
      2: { halign: "center", cellWidth: 22 },
      3: { halign: "center", cellWidth: 28 },
      4: { halign: "left" },
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
  doc.save(fileName);
}
