/**
 * Histórico de Descontos — Geração de PDF sob demanda
 * Formato: mesmo layout do PDF "Selecionados para Desconto" do Sicoob
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

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR");
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatMonthLabel(mesKey: string): string {
  const [y, m] = mesKey.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

export interface DiscountTitle {
  cliente: string;
  documento: string;
  valor: number;
  vencimento: string;
  forma: string;
}

export interface DiscountHistoryRecord {
  id: number;
  operatorName: string;
  empresa: string;
  contaLabel: string;
  mesKey: string;
  totalTitulos: number;
  valorTotal: string | number;
  titulosJson: string;
  createdAt: Date | string;
}

export async function generateDiscountPdf(record: DiscountHistoryRecord): Promise<void> {
  const titulos: DiscountTitle[] = JSON.parse(record.titulosJson);
  const valorTotal = typeof record.valorTotal === "string" ? parseFloat(record.valorTotal) : record.valorTotal;
  const createdAt = typeof record.createdAt === "string" ? new Date(record.createdAt) : record.createdAt;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 12;

  // ── Logo ──
  const logo = await getLogoBase64();
  if (logo) {
    const logoH = 14;
    const logoW = logoH * LOGO_RATIO;
    doc.addImage(logo, "PNG", margin, y, logoW, logoH);
  }

  // ── Title ──
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 118, 110); // teal-700
  doc.text("Selecionados para Desconto", pageW / 2, y, { align: "center" });

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`${record.empresa} - ${record.contaLabel} - ${formatMonthLabel(record.mesKey)}`, pageW / 2, y, { align: "center" });

  y += 5;
  doc.setFontSize(9);
  doc.text(`Gerado em ${formatDateTime(createdAt)}`, pageW / 2, y, { align: "center" });

  // ── Authorization Banner ──
  y += 8;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.8);
  doc.roundedRect(margin + 15, y, contentW - 30, 30, 3, 3, "FD");

  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(16, 185, 129);
  doc.text("\u2713", pageW / 2, y, { align: "center" });

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`AUTORIZADO POR ${record.operatorName.toUpperCase()}`, pageW / 2, y, { align: "center" });

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text("Desconto aprovado e autorizado antes da exportação", pageW / 2, y, { align: "center" });

  y += 4;
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128); // gray-500
  doc.text(`Data da autorização: ${formatDateTime(createdAt)}`, pageW / 2, y, { align: "center" });

  // ── Total Box ──
  y += 10;
  doc.setFillColor(240, 253, 250); // teal-50
  doc.setDrawColor(20, 184, 166); // teal-500
  doc.setLineWidth(0.6);
  doc.roundedRect(margin + 25, y, contentW - 50, 22, 2, 2, "FD");

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 118, 110); // teal-700
  doc.text("VALOR TOTAL SELECIONADO", pageW / 2, y, { align: "center" });

  y += 8;
  doc.setFontSize(18);
  doc.text(formatCurrency(valorTotal), pageW / 2, y, { align: "center" });

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`${record.totalTitulos} título(s)`, pageW / 2, y, { align: "center" });

  // ── Table ──
  y += 8;

  const tableData = titulos.map(t => {
    const isOverdue = new Date(t.vencimento + "T12:00:00") < new Date();
    return [
      t.cliente,
      t.documento || "—",
      t.forma || "—",
      formatCurrency(t.valor),
      formatDate(t.vencimento),
      isOverdue ? "Vencido" : "A Vencer",
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["CLIENTE", "DOCUMENTO", "FORMA", "VALOR", "VENCIMENTO", "STATUS"]],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [241, 245, 249], // slate-100
      textColor: [71, 85, 105], // slate-600
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 40 },
      3: { cellWidth: 25, halign: "right", fontStyle: "bold" },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 18, halign: "center" },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    didParseCell: (data) => {
      // Color "Vencido" in red, "A Vencer" in green
      if (data.section === "body" && data.column.index === 5) {
        if (data.cell.raw === "Vencido") {
          data.cell.styles.textColor = [220, 38, 38]; // red-600
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = [5, 150, 105]; // emerald-600
        }
      }
    },
  });

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Grupo Fox - Histórico de Descontos | Página ${i}/${pageCount}`,
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );
  }

  // ── Save ──
  const fileName = `Desconto_${record.empresa}_${record.mesKey}_${record.id}.pdf`;
  doc.save(fileName);
}
