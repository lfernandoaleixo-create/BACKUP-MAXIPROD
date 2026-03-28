import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png";

// Logo aspect ratio: 1529x725 = 2.11:1
const LOGO_RATIO = 2.11;

// Cache the logo as base64 to avoid re-fetching
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

type OrderForPdf = {
  pedido: string;
  cliente: string;
  clienteApelido?: string;
  uf: string;
  dataEmissao: string;
  dataEntrega: string;
  empresa: string;
  representante: string;
  segmento: string;
  condicaoPagamento?: string;
  transportadora?: string;
  observacoes?: string;
  grupo?: string;
  valorTotal: number;
  endereco?: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cep: string;
    cidade: string;
    uf: string;
  } | null;
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
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

// Minimal grayscale palette — ink-efficient
const BLACK = [0, 0, 0] as const;
const DARK_GRAY = [50, 50, 50] as const;
const MED_GRAY = [120, 120, 120] as const;
const LIGHT_GRAY = [180, 180, 180] as const;
const VERY_LIGHT_GRAY = [220, 220, 220] as const;
const WHITE = [255, 255, 255] as const;

// ---- Spacing profiles ----
// Normal: comfortable spacing when content fits easily
// Compact: reduced spacing when content is tight
interface SpacingProfile {
  logoH: number;
  headerAfter: number;       // space after header (logo + pedido)
  sepAfterLine: number;      // space after separator line
  clienteLabelGap: number;   // gap between CLIENTE label and name
  clienteNameAfter: number;  // space after client name
  gridRowH: number;          // height per grid row
  gridAfter: number;         // space after grid
  obsInternalPad: number;    // internal padding in obs box
  obsLineH: number;          // line height for obs text
  obsAfter: number;          // space after obs box
  itemsLabelAfter: number;   // space after ITENS label
  tableFontSize: number;     // font size for table
  tableCellPad: number;      // cell padding in table
  totalAfter: number;        // space for total line
}

const NORMAL: SpacingProfile = {
  logoH: 18,
  headerAfter: 22,
  sepAfterLine: 4,
  clienteLabelGap: 4.5,
  clienteNameAfter: 5,
  gridRowH: 10,
  gridAfter: 1,
  obsInternalPad: 7,
  obsLineH: 3.5,
  obsAfter: 2,
  itemsLabelAfter: 2,
  tableFontSize: 7,
  tableCellPad: 1.5,
  totalAfter: 6,
};

const COMPACT: SpacingProfile = {
  logoH: 14,
  headerAfter: 17,
  sepAfterLine: 2.5,
  clienteLabelGap: 4,
  clienteNameAfter: 4.5,
  gridRowH: 7.5,
  gridAfter: 0.5,
  obsInternalPad: 5,
  obsLineH: 2.8,
  obsAfter: 1,
  itemsLabelAfter: 1.5,
  tableFontSize: 6,
  tableCellPad: 1,
  totalAfter: 4,
};

const TIGHT: SpacingProfile = {
  logoH: 11,
  headerAfter: 14,
  sepAfterLine: 2,
  clienteLabelGap: 3.5,
  clienteNameAfter: 4,
  gridRowH: 6.5,
  gridAfter: 0,
  obsInternalPad: 4,
  obsLineH: 2.5,
  obsAfter: 0.5,
  itemsLabelAfter: 1,
  tableFontSize: 5.5,
  tableCellPad: 0.8,
  totalAfter: 3,
};

function estimateContentHeight(order: OrderForPdf, sp: SpacingProfile, showValues: boolean, contentWidth: number): number {
  let h = 0;
  const margin = 12;

  // Header
  h += sp.headerAfter;
  // Separator
  h += sp.sepAfterLine;
  // Cliente label + name
  h += sp.clienteLabelGap + sp.clienteNameAfter;
  // Extra line if apelido differs
  if (order.clienteApelido && order.cliente !== order.clienteApelido) {
    h += 3;
  }
  // Grid
  h += 2; // gap before grid
  const gridRows = Math.ceil(8 / 4); // always 8 items, 4 cols = 2 rows
  h += gridRows * sp.gridRowH + sp.gridAfter;
  // Obs
  if (order.observacoes && order.observacoes.trim()) {
    // Estimate obs lines (rough: ~45 chars per line at font 8, contentWidth ~186mm)
    const charsPerLine = Math.floor((contentWidth - 8) / 1.8);
    const obsLineCount = Math.max(1, Math.ceil(order.observacoes.length / charsPerLine));
    h += obsLineCount * sp.obsLineH + sp.obsInternalPad + sp.obsAfter;
  }
  // Items label
  h += sp.itemsLabelAfter + 3;
  // Table: header row + data rows
  const rowH = sp.tableFontSize * 0.35 + sp.tableCellPad * 2 + 0.5;
  h += rowH; // header
  h += order.itens.length * rowH;
  // Total volumes (always present)
  h += 8; // volumes row
  // Total value
  if (showValues) {
    h += sp.totalAfter;
  }
  // Safety margin (don't touch the line)
  h += 3;

  return h + margin;
}

function chooseProfile(order: OrderForPdf, showValues: boolean, contentWidth: number, halfPage: number): SpacingProfile {
  const normalH = estimateContentHeight(order, NORMAL, showValues, contentWidth);
  if (normalH <= halfPage) return NORMAL;

  const compactH = estimateContentHeight(order, COMPACT, showValues, contentWidth);
  if (compactH <= halfPage) return COMPACT;

  return TIGHT;
}

export async function generateOrderPdf(order: OrderForPdf, showValues: boolean = false): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const halfPage = pageHeight / 2; // 148.5mm — hard limit
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  // Choose spacing profile based on content size
  const sp = chooseProfile(order, showValues, contentWidth, halfPage);

  let y = margin;

  // ---- HEADER: Logo + Pedido number (no background fill) ----
  const logoData = await getLogoBase64();
  if (logoData) {
    try {
      const logoW = sp.logoH * LOGO_RATIO;
      doc.addImage(logoData, "PNG", margin, y, logoW, sp.logoH);
    } catch {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLACK);
      doc.text("GRUPO FOX", margin, y + 8);
    }
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);
    doc.text("GRUPO FOX", margin, y + 8);
  }

  // Pedido number on the right — vertically centered with logo
  const pedidoFontSize = sp === TIGHT ? 14 : sp === COMPACT ? 16 : 18;
  doc.setFontSize(pedidoFontSize);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLACK);
  doc.text(`Pedido #${order.pedido}`, pageWidth - margin, y + sp.logoH * 0.45, { align: "right" });

  // Date generated
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MED_GRAY);
  doc.text(new Date().toLocaleString("pt-BR"), pageWidth - margin, y + sp.logoH * 0.45 + 5, { align: "right" });

  y += sp.headerAfter;

  // Thin separator line
  doc.setDrawColor(...LIGHT_GRAY);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += sp.sepAfterLine;

  // ---- CLIENTE ----
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...MED_GRAY);
  doc.text("CLIENTE", margin, y);
  y += sp.clienteLabelGap;

  const clienteFontSize = sp === TIGHT ? 9 : 11;
  doc.setFontSize(clienteFontSize);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLACK);
  const clienteName = order.clienteApelido || order.cliente;
  // Truncate long names to fit page width
  const maxClienteWidth = contentWidth;
  let displayClienteName = clienteName;
  while (doc.getTextWidth(displayClienteName) > maxClienteWidth && displayClienteName.length > 10) {
    displayClienteName = displayClienteName.slice(0, -1);
  }
  if (displayClienteName !== clienteName) displayClienteName += "...";
  doc.text(displayClienteName, margin, y);
  y += sp.clienteNameAfter;

  // Razão social (if different from apelido)
  if (order.clienteApelido && order.cliente !== order.clienteApelido) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MED_GRAY);
    doc.text(order.cliente, margin, y);
    y += 4;
  }

  // ---- INFO GRID (compact) ----
  y += 2;
  const gridData = [
    ["Emissão", formatDateBR(order.dataEmissao)],
    ["Entrega", formatDateBR(order.dataEntrega)],
    ["UF", order.uf || "—"],
    ["Grupo", order.grupo || "—"],
    ["Representante", order.representante || "—"],
    ["Segmento", order.segmento || "—"],
    ["Cond. Pgto", order.condicaoPagamento ? `${order.condicaoPagamento} dias` : "—"],
    ["Transportadora", order.transportadora || "—"],
  ];

  const colWidth = contentWidth / 4;
  const labelFontSize = sp === TIGHT ? 5 : 6;
  const valueFontSize = sp === TIGHT ? 7 : 8;

  gridData.forEach((item, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const x = margin + col * colWidth;
    const cellY = y + row * sp.gridRowH;

    doc.setFontSize(labelFontSize);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...LIGHT_GRAY);
    doc.text(item[0].toUpperCase(), x, cellY);

    doc.setFontSize(valueFontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK_GRAY);
    doc.text(item[1], x, cellY + 3.5);
  });

  y += Math.ceil(gridData.length / 4) * sp.gridRowH + sp.gridAfter;

  // ---- OBSERVAÇÕES (compact, no background fill — just border) ----
  if (order.observacoes && order.observacoes.trim()) {
    doc.setDrawColor(...MED_GRAY);
    doc.setLineWidth(0.3);
    const obsFontSize = sp === TIGHT ? 7 : 8;
    doc.setFontSize(obsFontSize);
    const obsLines = doc.splitTextToSize(order.observacoes, contentWidth - 14);
    const obsHeight = obsLines.length * sp.obsLineH + sp.obsInternalPad;
    doc.rect(margin, y, contentWidth, obsHeight);

    doc.setFontSize(labelFontSize);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK_GRAY);
    doc.text("OBS:", margin + 3, y + 3.5);

    doc.setFontSize(obsFontSize);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);
    doc.text(obsLines, margin + 12, y + 3.5);

    y += obsHeight + sp.obsAfter;
  }

  // ---- ITENS TABLE ----
  y += 1;
  doc.setFontSize(sp.tableFontSize);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLACK);
  doc.text(`ITENS (${order.itens.length})`, margin, y);
  y += sp.itemsLabelAfter;

  const tableHead = showValues
    ? [["#", "Cód", "Descrição", "Qtd", "Unit.", "Total"]]
    : [["#", "Cód", "Descrição", "Qtd"]];

  const tableBody = order.itens.map((item, idx) => {
    const row: string[] = [
      String(idx + 1),
      item.codigoItem || "—",
      item.descricao,
      `${item.quantidade.toLocaleString("pt-BR")} ${item.unidadeMedida || "un"}`,
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
      fontSize: sp.tableFontSize,
      cellPadding: sp.tableCellPad,
      textColor: [...DARK_GRAY],
      lineColor: [...VERY_LIGHT_GRAY],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [...WHITE],
      textColor: [...BLACK],
      fontStyle: "bold",
      fontSize: sp.tableFontSize - 0.5,
      lineColor: [...LIGHT_GRAY],
      lineWidth: 0.3,
    },
    alternateRowStyles: {
      fillColor: [...WHITE],
    },
    columnStyles: showValues
      ? {
          0: { cellWidth: 7, halign: "center" as const },
          1: { cellWidth: 18 },
          2: { cellWidth: "auto" as const },
          3: { cellWidth: 20, halign: "right" as const },
          4: { cellWidth: 22, halign: "right" as const },
          5: { cellWidth: 22, halign: "right" as const },
        }
      : {
          0: { cellWidth: 7, halign: "center" as const },
          1: { cellWidth: 22 },
          2: { cellWidth: "auto" as const },
          3: { cellWidth: 28, halign: "right" as const },
        },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 15;

  // ---- TOTAL DE VOLUMES (sempre visível — regra: PDFs de pedidos sempre com total de volumes) ----
  let totalLineY = finalY + 2;

  // Calcular soma total de caixas/unidades
  const volumesByUnit: Record<string, number> = {};
  order.itens.forEach((item) => {
    const unit = (item.unidadeMedida || "un").toLowerCase();
    volumesByUnit[unit] = (volumesByUnit[unit] || 0) + item.quantidade;
  });

  // Formatar total de volumes
  const volumeParts = Object.entries(volumesByUnit)
    .sort((a, b) => b[1] - a[1]) // maiores primeiro
    .map(([unit, qty]) => `${qty.toLocaleString("pt-BR")} ${unit}`);
  const totalVolumesStr = volumeParts.join(" + ");

  // Desenhar linha de total de volumes (alinhado à direita na coluna Qtd)
  const tableRight = pageWidth - margin;
  doc.setDrawColor(...LIGHT_GRAY);
  doc.setLineWidth(0.3);
  doc.line(margin, totalLineY - 0.5, tableRight, totalLineY - 0.5);

  // Label "TOTAL:" + valor alinhado à direita na coluna Qtd
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLACK);
  const totalLabel = `TOTAL:  ${totalVolumesStr}`;
  doc.text(totalLabel, tableRight - 2, totalLineY + 3.5, { align: "right" });

  totalLineY += 6;

  // ---- TOTAL VALOR (if showValues) ----
  if (showValues) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MED_GRAY);
    doc.text("TOTAL:", pageWidth - margin - 50, totalLineY);
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    doc.text(formatCurrency(order.valorTotal), pageWidth - margin, totalLineY, { align: "right" });
  }

  // ---- HALF-PAGE LINE (exactly at 148.5mm) ----
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([3, 2], 0);
  doc.line(margin, halfPage, pageWidth - margin, halfPage);
  doc.setLineDashPattern([], 0); // reset

  // Small scissors indicator
  doc.setFontSize(6);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text("✂", margin - 3, halfPage + 1);

  // ---- DOWNLOAD ----
  doc.save(`Pedido_${order.pedido}_GrupoFox.pdf`);
}
