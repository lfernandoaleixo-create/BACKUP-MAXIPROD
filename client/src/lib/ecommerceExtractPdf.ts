import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png";
const LOGO_RATIO = 2.11; // 1529x725

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

function formatNumber(n: number): string {
  // Preserve decimals: 297.5 → "297,5" but 300 → "300"
  if (Number.isInteger(n)) {
    return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

type ConsolidatedProduct = {
  codigo: string;
  descricao: string;
  pc: number;
  cx: number;
};

function consolidateByProduct(data: any[]): ConsolidatedProduct[] {
  const byCode = new Map<string, ConsolidatedProduct>();
  for (const h of data) {
    const existing = byCode.get(h.codigoItem) || { codigo: h.codigoItem, descricao: h.descricaoItem, pc: 0, cx: 0 };
    if (h.unidadeOriginal === "PC") existing.pc += h.quantidadeOriginal || 0;
    existing.cx += h.quantidadeCx || 0;
    byCode.set(h.codigoItem, existing);
  }
  return Array.from(byCode.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export type ExtractType = "importacao" | "industrializacao";

export async function generateEcommerceExtractPdf(
  data: any[],
  type: ExtractType,
  monthLabel: string // e.g. "Abr/2026" or "Todos"
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;
  let y = 15;

  // Colors
  const headerBg: [number, number, number] = type === "importacao" ? [88, 28, 135] : [5, 150, 105]; // purple-800 / emerald-600
  const headerBgLight: [number, number, number] = type === "importacao" ? [139, 92, 246] : [16, 185, 129]; // purple-500 / emerald-500
  const accentColor: [number, number, number] = type === "importacao" ? [109, 40, 217] : [13, 148, 136]; // violet-700 / teal-600

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

  const typeLabel = type === "importacao" ? "IMPORTAÇÃO" : "INDUSTRIALIZAÇÃO";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(`EXTRATO E-COMMERCE — ${typeLabel}`, marginL + 5, y + titleH / 2 + 1, { baseline: "middle" });

  // Month badge on the right
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const monthText = `Período: ${monthLabel}`;
  const monthW = doc.getTextWidth(monthText) + 8;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(marginL + contentW - monthW - 4, y + 2, monthW, titleH - 4, 1.5, 1.5, "F");
  doc.setTextColor(...headerBg);
  doc.text(monthText, marginL + contentW - monthW / 2 - 4, y + titleH / 2 + 0.5, { align: "center", baseline: "middle" });

  y += titleH + 6;

  // --- Summary cards ---
  const products = consolidateByProduct(data);
  const totalCx = products.reduce((s, p) => s + p.cx, 0);
  const totalPc = products.reduce((s, p) => s + p.pc, 0);
  const totalItems = data.length;
  const uniqueProducts = products.length;
  const pedidos = new Set(data.map((h: any) => h.pedidoRelacionado).filter(Boolean)).size;

  const cardH = 14;
  const cardGap = 3;
  const cards = [
    { label: "Produtos", value: uniqueProducts.toString() },
    { label: "Itens Faturados", value: formatNumber(totalItems) },
    { label: "Pedidos", value: formatNumber(pedidos) },
    { label: "Total Caixas", value: `${formatNumber(totalCx)} cx` },
  ];
  if (totalPc > 0) {
    cards.push({ label: "Total Pacotes", value: `${formatNumber(totalPc)} pc` });
  }

  const cardW = (contentW - cardGap * (cards.length - 1)) / cards.length;
  for (let i = 0; i < cards.length; i++) {
    const cx = marginL + i * (cardW + cardGap);
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, "F");
    doc.setDrawColor(220, 220, 230);
    doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 140);
    doc.text(cards[i].label.toUpperCase(), cx + cardW / 2, y + 4.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
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
  const tableHead = [["#", "Código", "Produto", "Pacotes (PC)", "Caixas (CX)"]];
  const tableBody: (string | number)[][] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    tableBody.push([
      (i + 1).toString(),
      p.codigo,
      p.descricao,
      p.pc > 0 ? formatNumber(p.pc) : "—",
      formatNumber(p.cx),
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
      1: { halign: "center", cellWidth: 22, fontStyle: "bold", font: "courier" },
      2: { halign: "left" },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 28, fontStyle: "bold" },
    },
    alternateRowStyles: {
      fillColor: [248, 248, 252],
    },
    didDrawPage: (data) => {
      // Footer on each page
      const pageNum = doc.getCurrentPageInfo().pageNumber;
      const totalPages = (doc as any).internal.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(160, 160, 170);
      doc.text(
        `Grupo Fox — Extrato E-commerce ${typeLabel} — Página ${pageNum}/${totalPages}`,
        pageW / 2,
        pageH - 8,
        { align: "center" }
      );
    },
  });

  // --- Total row after table ---
  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  let ty = finalY + 2;

  // Check if we need a new page for the total
  if (ty + 14 > pageH - 15) {
    doc.addPage();
    ty = 20;
  }

  // Total bar
  const totalBarH = 10;
  doc.setFillColor(...headerBg);
  doc.roundedRect(marginL, ty, contentW, totalBarH, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL GERAL", marginL + 5, ty + totalBarH / 2 + 0.5, { baseline: "middle" });

  // Total values on the right
  const totalTexts: string[] = [];
  if (totalPc > 0) totalTexts.push(`${formatNumber(totalPc)} pacotes`);
  totalTexts.push(`${formatNumber(totalCx)} caixas`);
  const totalStr = totalTexts.join("   |   ");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(totalStr, marginL + contentW - 5, ty + totalBarH / 2 + 0.5, { align: "right", baseline: "middle" });

  // --- Save ---
  const monthSlug = monthLabel.replace("/", "-").toLowerCase();
  const filename = `extrato-ecommerce-${type}-${monthSlug}.pdf`;
  doc.save(filename);
}
