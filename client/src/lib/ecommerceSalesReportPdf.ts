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

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

export type SalesEntry = {
  id: number;
  saleDate: string | Date;
  numberOfSales: number;
  totalValue: string | number;
  notes?: string | null;
  createdBy: string;
};

export type SalesSummary = {
  totalEntries: number;
  totalSales: number;
  totalValue: number;
  avgDailyValue: number;
  avgSalesPerDay: number;
};

export async function generateSalesReportPdf(
  entries: SalesEntry[],
  summary: SalesSummary,
  periodLabel: string
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;
  let y = 15;

  const headerBg: [number, number, number] = [30, 64, 175]; // blue-700
  const headerBgLight: [number, number, number] = [59, 130, 246]; // blue-500

  // --- Logo ---
  const logo = await getLogoBase64();
  if (logo) {
    const logoH = 14;
    const logoW = logoH * LOGO_RATIO;
    doc.addImage(logo, "PNG", marginL, y, logoW, logoH);
    y += logoH + 3;
  }

  // --- Title bar ---
  const titleH = 12;
  doc.setFillColor(...headerBg);
  doc.roundedRect(marginL, y, contentW, titleH, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("RELATÓRIO DE VENDAS DO E-COMMERCE", marginL + 5, y + titleH / 2 + 1, { baseline: "middle" });

  // Period badge
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const monthText = `Período: ${periodLabel}`;
  const monthW = doc.getTextWidth(monthText) + 8;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(marginL + contentW - monthW - 4, y + 2, monthW, titleH - 4, 1.5, 1.5, "F");
  doc.setTextColor(...headerBg);
  doc.text(monthText, marginL + contentW - monthW / 2 - 4, y + titleH / 2 + 0.5, { align: "center", baseline: "middle" });

  y += titleH + 6;

  // --- Summary cards ---
  const cardH = 14;
  const cardGap = 3;
  const cards = [
    { label: "Dias Registrados", value: summary.totalEntries.toString() },
    { label: "Total Vendas", value: summary.totalSales.toLocaleString("pt-BR") },
    { label: "Faturamento Total", value: formatCurrency(summary.totalValue) },
    { label: "Média Diária (R$)", value: formatCurrency(summary.avgDailyValue) },
    { label: "Média Vendas/Dia", value: summary.avgSalesPerDay.toFixed(1) },
  ];

  const cardW = (contentW - cardGap * (cards.length - 1)) / cards.length;
  for (let i = 0; i < cards.length; i++) {
    const cx = marginL + i * (cardW + cardGap);
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, "F");
    doc.setDrawColor(220, 220, 230);
    doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 140);
    doc.text(cards[i].label.toUpperCase(), cx + cardW / 2, y + 4.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 50);
    doc.text(cards[i].value, cx + cardW / 2, y + 10.5, { align: "center" });
  }

  y += cardH + 6;

  // --- Date line ---
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 150);
  doc.text(`Gerado em ${dateStr} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, marginL, y);
  y += 5;

  // --- Table ---
  // Sort entries by date ascending for the PDF
  const sorted = [...entries].sort((a, b) => {
    const da = new Date(a.saleDate).getTime();
    const db = new Date(b.saleDate).getTime();
    return da - db;
  });

  const tableHead = [["#", "Data", "Nº Vendas", "Valor Total (R$)", "Observações", "Registrado por"]];
  const tableBody: (string | number)[][] = [];

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    tableBody.push([
      (i + 1).toString(),
      formatDateBR(e.saleDate),
      e.numberOfSales.toLocaleString("pt-BR"),
      formatCurrency(Number(e.totalValue)),
      e.notes || "—",
      e.createdBy,
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: marginL, right: marginR },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [220, 220, 230],
      lineWidth: 0.2,
      textColor: [40, 40, 50],
      font: "helvetica",
    },
    headStyles: {
      fillColor: headerBg,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10, textColor: [140, 140, 150] },
      1: { halign: "center", cellWidth: 24 },
      2: { halign: "center", cellWidth: 20, fontStyle: "bold" },
      3: { halign: "right", cellWidth: 32, fontStyle: "bold" },
      4: { halign: "left" },
      5: { halign: "center", cellWidth: 28 },
    },
    alternateRowStyles: {
      fillColor: [248, 248, 252],
    },
    didDrawPage: () => {
      const pageNum = doc.getCurrentPageInfo().pageNumber;
      const totalPages = (doc as any).internal.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(160, 160, 170);
      doc.text(
        `Grupo Fox — Relatório de Vendas E-commerce — Página ${pageNum}/${totalPages}`,
        pageW / 2,
        pageH - 8,
        { align: "center" }
      );
    },
  });

  // --- Total row after table ---
  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  let ty = finalY + 2;

  if (ty + 14 > pageH - 15) {
    doc.addPage();
    ty = 20;
  }

  const totalBarH = 10;
  doc.setFillColor(...headerBg);
  doc.roundedRect(marginL, ty, contentW, totalBarH, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL GERAL", marginL + 5, ty + totalBarH / 2 + 0.5, { baseline: "middle" });

  const totalStr = `${summary.totalSales.toLocaleString("pt-BR")} vendas   |   ${formatCurrency(summary.totalValue)}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(totalStr, marginL + contentW - 5, ty + totalBarH / 2 + 0.5, { align: "right", baseline: "middle" });

  // --- Save ---
  const slug = periodLabel.replace(/\//g, "-").replace(/\s+/g, "_").toLowerCase();
  const filename = `relatorio-vendas-ecommerce-${slug}.pdf`;
  doc.save(filename);
}
