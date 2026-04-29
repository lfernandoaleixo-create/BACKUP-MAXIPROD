/**
 * Produção — Geração de PDFs (Diário, Semanal, Mensal)
 * Design profissional com cores vivas, zebra stripes e totais separados por unidade
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

function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Colors ───
const C = {
  // Primary palette — deep emerald green (Grupo Fox brand)
  primary:    [0, 105, 62] as [number, number, number],     // #00693E
  primaryDk:  [0, 77, 45] as [number, number, number],      // #004D2D
  primaryLt:  [232, 245, 233] as [number, number, number],   // #E8F5E9

  // Accent — warm amber/gold
  accent:     [245, 158, 11] as [number, number, number],    // #F59E0B
  accentDk:   [180, 110, 0] as [number, number, number],     // #B46E00

  // Neutrals
  dark:       [30, 41, 59] as [number, number, number],      // #1E293B
  medium:     [100, 116, 139] as [number, number, number],   // #64748B
  light:      [241, 245, 249] as [number, number, number],   // #F1F5F9
  white:      [255, 255, 255] as [number, number, number],
  black:      [15, 23, 42] as [number, number, number],

  // Zebra rows
  rowEven:    [255, 255, 255] as [number, number, number],
  rowOdd:     [232, 245, 239] as [number, number, number],   // soft green tint

  // Status colors
  red:        [220, 38, 38] as [number, number, number],
  orange:     [234, 88, 12] as [number, number, number],
  indigo:     [79, 70, 229] as [number, number, number],
  teal:       [13, 148, 136] as [number, number, number],

  // Unit group colors (for summary cards)
  caixa:      [37, 99, 235] as [number, number, number],     // blue-600
  caixaLt:    [219, 234, 254] as [number, number, number],   // blue-100
  saco:       [168, 85, 247] as [number, number, number],    // purple-500
  sacoLt:     [243, 232, 255] as [number, number, number],   // purple-100
  m3:         [14, 165, 233] as [number, number, number],    // sky-500
  m3Lt:       [224, 242, 254] as [number, number, number],   // sky-100
  forma:      [236, 72, 153] as [number, number, number],    // pink-500
  formaLt:    [252, 231, 243] as [number, number, number],   // pink-100
  outro:      [107, 114, 128] as [number, number, number],   // gray-500
  outroLt:    [243, 244, 246] as [number, number, number],   // gray-100
};

function getUnitColor(unit: string): { bg: [number, number, number]; fg: [number, number, number] } {
  const u = unit.toLowerCase();
  if (u === "caixa" || u === "cx") return { bg: C.caixaLt, fg: C.caixa };
  if (u === "saco") return { bg: C.sacoLt, fg: C.saco };
  if (u === "m³") return { bg: C.m3Lt, fg: C.m3 };
  if (u === "forma") return { bg: C.formaLt, fg: C.forma };
  return { bg: C.outroLt, fg: C.outro };
}

// ─── Status labels ───
const STATUS_LABELS: Record<string, string> = {
  producao_normal: "Produção Normal",
  falta_madeira: "Falta de Madeira",
  producao_nao_necessaria: "Produção Não Necessária",
  manutencao: "Manutenção",
  manutencao_pontual: "Manutenção Pontual",
};

function statusLabel(status: string): string {
  if (!status) return "—";
  return status.split(",").map(s => STATUS_LABELS[s.trim()] || s.trim()).join(", ");
}

// ─── Tipo madeira labels ───
const TIPO_LABELS: Record<string, string> = {
  benazzi: "Benazzi",
  madeira_dura: "Madeira Dura",
  bambu: "Bambu",
  madeira: "Madeira",
};

function tipoLabel(tipo: string | null): string {
  if (!tipo) return "—";
  const base = tipo.replace(/_saco$/, "").replace(/_cxp$/, "").replace(/_cxg$/, "");
  if (TIPO_LABELS[base]) {
    const suffix = tipo.endsWith("_saco") ? " (Saco)" : tipo.endsWith("_cxp") ? " (Cx Peq)" : tipo.endsWith("_cxg") ? " (Cx Gr)" : "";
    return TIPO_LABELS[base] + suffix;
  }
  const suffix = tipo.endsWith("_saco") ? " (Saco)" : tipo.endsWith("_cxp") ? " (Cx Peq)" : tipo.endsWith("_cxg") ? " (Cx Gr)" : "";
  return base.replace(".", ",") + suffix;
}

// ─── Types ───
export type SectorData = {
  id: number;
  nome: string;
  ordem: number;
  unidadeMedida: string;
  unidadeLabel: string;
  machines: { id: number; nome: string; ordem: number }[];
};

export type EntryData = {
  id: number;
  sectorId: number;
  machineId: number | null;
  data: string;
  quantidade: string;
  status: string | null;
  tipoMadeira: string | null;
  observacoes: string | null;
  lancadoPor: string | null;
};

// ─── Unit grouping helper ───
type UnitGroup = { unit: string; label: string; total: number; decimals: number };

function groupByUnit(sectors: SectorData[], entries: EntryData[]): UnitGroup[] {
  const map = new Map<string, { total: number; decimals: number }>();
  for (const sector of sectors) {
    const sectorEntries = entries.filter(e => e.sectorId === sector.id && Number(e.quantidade) > 0);
    const total = sectorEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
    const u = sector.unidadeMedida;
    const decimals = u === "m³" ? 3 : (u === "forma" ? 0 : 1);
    if (!map.has(u)) map.set(u, { total: 0, decimals });
    map.get(u)!.total += total;
  }
  const unitLabels: Record<string, string> = {
    "caixa": "Caixas", "cx": "Caixas", "saco": "Sacos", "m³": "Metro Cúbico (m³)",
    "forma": "Formas", "pç": "Peças", "un": "Unidades",
  };
  return Array.from(map.entries()).map(([unit, data]) => ({
    unit,
    label: unitLabels[unit.toLowerCase()] || unit,
    total: data.total,
    decimals: data.decimals,
  }));
}

// ─── Common header ───
async function drawHeader(doc: jsPDF, title: string, subtitle: string): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 14;
  let y = 10;

  const logo = await getLogoBase64();
  if (logo) {
    const logoH = 14;
    const logoW = logoH * LOGO_RATIO;
    doc.addImage(logo, "PNG", marginL, y, logoW, logoH);
  }

  // Company name next to logo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.medium);
  doc.text("GRUPO FOX", marginL + 35, y + 9);

  y += 18;

  // Title bar with gradient effect (two rects)
  doc.setFillColor(...C.primary);
  doc.roundedRect(marginL, y, pageW - 2 * marginL, 12, 2, 2, "F");
  // Darker accent strip on left
  doc.setFillColor(...C.primaryDk);
  doc.rect(marginL, y, 4, 12, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.white);
  doc.text(title, marginL + 8, y + 8);

  // Subtitle badge on right
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const subW = doc.getTextWidth(subtitle) + 10;
  doc.setFillColor(...C.accent);
  doc.roundedRect(pageW - marginL - subW - 3, y + 2, subW, 8, 1.5, 1.5, "F");
  doc.setTextColor(...C.white);
  doc.text(subtitle, pageW - marginL - subW / 2 - 3, y + 7, { align: "center" });

  y += 15;

  // Generated date
  const now = new Date();
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...C.medium);
  doc.text(`Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, marginL, y);
  y += 5;

  return y;
}

// ─── Draw unit summary cards ───
function drawUnitSummaryCards(doc: jsPDF, unitGroups: UnitGroup[], y: number, marginL: number, marginR: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const cardGap = 3;
  const numCards = unitGroups.length;
  if (numCards === 0) return y;

  const cardW = Math.min(55, (pageW - marginL - marginR - cardGap * (numCards - 1)) / numCards);
  const cardH = 16;
  const totalWidth = numCards * cardW + (numCards - 1) * cardGap;
  const startX = marginL + (pageW - marginL - marginR - totalWidth) / 2; // center

  for (let i = 0; i < numCards; i++) {
    const ug = unitGroups[i];
    const cx = startX + i * (cardW + cardGap);
    const colors = getUnitColor(ug.unit);

    // Card background
    doc.setFillColor(...colors.bg);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");

    // Left color accent bar
    doc.setFillColor(...colors.fg);
    doc.rect(cx, y + 2, 2.5, cardH - 4, "F");

    // Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...colors.fg);
    doc.text(ug.label.toUpperCase(), cx + 6, y + 5.5);

    // Value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...C.dark);
    doc.text(fmtNum(ug.total, ug.decimals), cx + 6, y + 13);

    // Unit badge
    doc.setFontSize(6);
    doc.setTextColor(...colors.fg);
    doc.text(ug.unit, cx + cardW - 4, y + 13, { align: "right" });
  }

  return y + cardH + 4;
}

// ─── Draw total bars by unit ───
function drawUnitTotalBars(doc: jsPDF, unitGroups: UnitGroup[], y: number, marginL: number, marginR: number, periodLabel: string): number {
  const pageW = doc.internal.pageSize.getWidth();
  const barH = 8;
  const barGap = 2;

  for (const ug of unitGroups) {
    if (y + barH + barGap > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 20;
    }
    const colors = getUnitColor(ug.unit);
    doc.setFillColor(...colors.fg);
    doc.roundedRect(marginL, y, pageW - marginL - marginR, barH, 1.5, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.white);
    doc.text(`TOTAL ${ug.label.toUpperCase()} ${periodLabel}`, marginL + 4, y + 5.5);
    doc.text(`${fmtNum(ug.total, ug.decimals)} ${ug.unit}`, pageW - marginR - 4, y + 5.5, { align: "right" });

    y += barH + barGap;
  }
  return y;
}

// ─── Common footer ───
function drawFooter(doc: jsPDF, label: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Thin line
    doc.setDrawColor(...C.light);
    doc.setLineWidth(0.3);
    doc.line(14, pageH - 12, pageW - 14, pageH - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.medium);
    doc.text(`Grupo Fox — ${label}`, 14, pageH - 7);
    doc.text(`Página ${i}/${totalPages}`, pageW - 14, pageH - 7, { align: "right" });
  }
}

// ─── Section title ───
function drawSectionTitle(doc: jsPDF, text: string, y: number, marginL: number): number {
  doc.setFillColor(...C.primaryLt);
  doc.roundedRect(marginL, y, doc.internal.pageSize.getWidth() - 2 * marginL, 8, 1.5, 1.5, "F");
  doc.setFillColor(...C.primary);
  doc.rect(marginL, y, 3, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.primary);
  doc.text(text, marginL + 6, y + 5.5);
  return y + 10;
}

// ═══════════════════════════════════════════════════════════════
// 1. PDF DIÁRIO
// ═══════════════════════════════════════════════════════════════
export async function generateDailyPdf(
  sectors: SectorData[],
  entries: EntryData[],
  selectedDate: string,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 14;
  const marginR = 14;

  let y = await drawHeader(doc, "RELATÓRIO DE PRODUÇÃO — LANÇAMENTO DIÁRIO", fmtDate(selectedDate));

  // Unit summary cards
  const unitGroups = groupByUnit(sectors, entries);
  y = drawUnitSummaryCards(doc, unitGroups, y, marginL, marginR);

  // Table — one row per entry, grouped by sector
  const tableHead = [["Setor", "Máquina", "Tipo/Medida", "Quantidade", "Unidade", "Status", "Observações"]];
  const tableBody: (string | { content: string; styles?: any })[][] = [];

  for (const sector of sectors) {
    const sectorEntries = entries.filter(e => e.sectorId === sector.id && Number(e.quantidade) > 0);
    if (sectorEntries.length === 0) {
      tableBody.push([sector.nome, "—", "—", "0", sector.unidadeMedida, "—", "Sem lançamento"]);
      continue;
    }

    for (const entry of sectorEntries) {
      const machine = sector.machines.find(m => m.id === entry.machineId);
      const machineName = machine ? machine.nome : (entry.machineId ? `#${entry.machineId}` : "—");
      const obs = entry.observacoes && entry.observacoes !== "[REMOVIDO]" ? entry.observacoes : "";
      const decimals = sector.unidadeMedida === "m³" ? 3 : 1;
      tableBody.push([
        sector.nome,
        machineName,
        tipoLabel(entry.tipoMadeira),
        fmtNum(Number(entry.quantidade), decimals),
        sector.unidadeMedida,
        statusLabel(entry.status || ""),
        obs,
      ]);
    }
  }

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: marginL, right: marginR },
    theme: "grid",
    headStyles: {
      fillColor: C.primary,
      textColor: C.white,
      fontSize: 7,
      fontStyle: "bold",
      cellPadding: 2.5,
      lineColor: C.primaryDk,
      lineWidth: 0.2,
    },
    bodyStyles: { fontSize: 6.5, cellPadding: 2, textColor: C.dark, lineColor: [200, 215, 210], lineWidth: 0.15 },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold" },
      1: { cellWidth: 28 },
      2: { cellWidth: 32 },
      3: { cellWidth: 22, halign: "right", fontStyle: "bold" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 38 },
      6: { }, // auto-width for observations
    },
    alternateRowStyles: { fillColor: C.rowOdd },
    didParseCell: (data: any) => {
      // Zebra stripe with green tint
      if (data.section === "body" && data.row.index % 2 === 0) {
        data.cell.styles.fillColor = C.rowEven;
      }
      // Status coloring
      if (data.section === "body" && data.column.index === 5) {
        const val = String(data.cell.raw);
        if (val.includes("Manutenção")) {
          data.cell.styles.textColor = C.indigo;
          data.cell.styles.fontStyle = "bold";
        } else if (val.includes("Falta")) {
          data.cell.styles.textColor = C.red;
          data.cell.styles.fontStyle = "bold";
        }
      }
      // Unit column colored
      if (data.section === "body" && data.column.index === 4) {
        const colors = getUnitColor(String(data.cell.raw));
        data.cell.styles.textColor = colors.fg;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Total bars by unit
  let finalY = ((doc as any).lastAutoTable?.finalY || y + 20) + 4;
  finalY = drawUnitTotalBars(doc, unitGroups, finalY, marginL, marginR, "DO DIA");

  drawFooter(doc, "Relatório Diário de Produção");
  doc.save(`Producao_Diario_${selectedDate.replace(/-/g, "")}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// 2. PDF SEMANAL
// ═══════════════════════════════════════════════════════════════
export async function generateWeeklyPdf(
  sectors: SectorData[],
  entries: EntryData[],
  weekStart: string,
  weekEnd: string,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 14;
  const marginR = 14;

  let y = await drawHeader(doc, "RELATÓRIO DE PRODUÇÃO — FECHAMENTO SEMANAL", `${fmtDate(weekStart)} a ${fmtDate(weekEnd)}`);

  // Calculate working days
  const workingDays = new Set<string>();
  const d = new Date(weekStart + "T12:00:00");
  const end = new Date(weekEnd + "T12:00:00");
  while (d <= end) {
    if (d.getDay() !== 0) workingDays.add(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  const numDays = workingDays.size || 1;

  // Unit summary cards
  const unitGroups = groupByUnit(sectors, entries);
  y = drawUnitSummaryCards(doc, unitGroups, y, marginL, marginR);

  // KPI mini-cards row
  const kpiH = 10;
  const kpiGap = 3;
  const kpis = [
    { label: "SETORES ATIVOS", value: String(sectors.length), color: C.primary },
    { label: "DIAS ÚTEIS", value: String(numDays), color: C.teal },
  ];
  // Add average per unit
  for (const ug of unitGroups) {
    kpis.push({
      label: `MÉDIA DIÁRIA (${ug.unit.toUpperCase()})`,
      value: fmtNum(ug.total / numDays, ug.decimals),
      color: getUnitColor(ug.unit).fg,
    });
  }
  const kpiW = (pageW - marginL - marginR - kpiGap * (kpis.length - 1)) / kpis.length;

  for (let i = 0; i < kpis.length; i++) {
    const cx = marginL + i * (kpiW + kpiGap);
    doc.setFillColor(...C.light);
    doc.roundedRect(cx, y, kpiW, kpiH, 1.5, 1.5, "F");
    doc.setDrawColor(210, 220, 230);
    doc.roundedRect(cx, y, kpiW, kpiH, 1.5, 1.5, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...C.medium);
    doc.text(kpis[i].label, cx + kpiW / 2, y + 3.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...(kpis[i].color as [number, number, number]));
    doc.text(kpis[i].value, cx + kpiW / 2, y + 8.5, { align: "center" });
  }
  y += kpiH + 4;

  // Table: Setor | Total Semana | Média Diária | Unidade | Dias com Lançamento
  const tableHead = [["Setor", "Total da Semana", "Média Diária", "Unidade", "Dias c/ Lançamento"]];
  const tableBody: string[][] = [];

  for (const sector of sectors) {
    const sectorEntries = entries.filter(e => e.sectorId === sector.id && Number(e.quantidade) > 0);
    const total = sectorEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
    const daysWithEntries = new Set(sectorEntries.map(e => e.data)).size;
    const avg = daysWithEntries > 0 ? total / daysWithEntries : 0;
    const decimals = sector.unidadeMedida === "m³" ? 3 : 1;

    tableBody.push([
      sector.nome,
      fmtNum(total, decimals),
      fmtNum(avg, decimals),
      sector.unidadeMedida,
      `${daysWithEntries} / ${numDays}`,
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: marginL, right: marginR },
    theme: "grid",
    headStyles: {
      fillColor: C.primary,
      textColor: C.white,
      fontSize: 8,
      fontStyle: "bold",
      cellPadding: 3,
      lineColor: C.primaryDk,
      lineWidth: 0.2,
    },
    bodyStyles: { fontSize: 8, cellPadding: 2.5, textColor: C.dark, lineColor: [200, 215, 210], lineWidth: 0.15 },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: "bold" },
      1: { cellWidth: 40, halign: "right", fontStyle: "bold" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 40, halign: "center" },
    },
    alternateRowStyles: { fillColor: C.rowOdd },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.index % 2 === 0) {
        data.cell.styles.fillColor = C.rowEven;
      }
      // Unit column colored
      if (data.section === "body" && data.column.index === 3) {
        const colors = getUnitColor(String(data.cell.raw));
        data.cell.styles.textColor = colors.fg;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Total bars by unit
  let finalY = ((doc as any).lastAutoTable?.finalY || y + 20) + 4;
  finalY = drawUnitTotalBars(doc, unitGroups, finalY, marginL, marginR, "DA SEMANA");

  drawFooter(doc, "Relatório Semanal de Produção");
  doc.save(`Producao_Semanal_${weekStart.replace(/-/g, "")}_${weekEnd.replace(/-/g, "")}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// 3. PDF MENSAL
// ═══════════════════════════════════════════════════════════════
export async function generateMonthlyPdf(
  sectors: SectorData[],
  entries: EntryData[],
  month: string, // YYYY-MM
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 14;
  const marginR = 14;

  const [year, mon] = month.split("-");
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const monthLabel = `${monthNames[parseInt(mon) - 1]} ${year}`;

  let y = await drawHeader(doc, "RELATÓRIO DE PRODUÇÃO — FECHAMENTO MENSAL", monthLabel);

  // Calculate working days
  const workingDays = new Set<string>();
  const firstDay = new Date(`${month}-01T12:00:00`);
  const lastDay = new Date(parseInt(year), parseInt(mon), 0);
  const dd = new Date(firstDay);
  while (dd <= lastDay) {
    if (dd.getDay() !== 0) workingDays.add(dd.toISOString().slice(0, 10));
    dd.setDate(dd.getDate() + 1);
  }
  const numDays = workingDays.size || 1;

  // Unit summary cards
  const unitGroups = groupByUnit(sectors, entries);
  y = drawUnitSummaryCards(doc, unitGroups, y, marginL, marginR);

  // KPI mini-cards
  const kpiH = 10;
  const kpiGap = 3;
  const kpis = [
    { label: "SETORES ATIVOS", value: String(sectors.length), color: C.primary },
    { label: "DIAS ÚTEIS", value: String(numDays), color: C.teal },
  ];
  for (const ug of unitGroups) {
    kpis.push({
      label: `MÉDIA DIÁRIA (${ug.unit.toUpperCase()})`,
      value: fmtNum(ug.total / numDays, ug.decimals),
      color: getUnitColor(ug.unit).fg,
    });
  }
  const kpiW = (pageW - marginL - marginR - kpiGap * (kpis.length - 1)) / kpis.length;

  for (let i = 0; i < kpis.length; i++) {
    const cx = marginL + i * (kpiW + kpiGap);
    doc.setFillColor(...C.light);
    doc.roundedRect(cx, y, kpiW, kpiH, 1.5, 1.5, "F");
    doc.setDrawColor(210, 220, 230);
    doc.roundedRect(cx, y, kpiW, kpiH, 1.5, 1.5, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...C.medium);
    doc.text(kpis[i].label, cx + kpiW / 2, y + 3.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...(kpis[i].color as [number, number, number]));
    doc.text(kpis[i].value, cx + kpiW / 2, y + 8.5, { align: "center" });
  }
  y += kpiH + 4;

  // Sector summaries
  const sectorSummaries: { nome: string; total: number; avg: number; unidade: string; machines: { nome: string; total: number; avg: number }[] }[] = [];
  for (const sector of sectors) {
    const sectorEntries = entries.filter(e => e.sectorId === sector.id && Number(e.quantidade) > 0);
    const total = sectorEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
    const daysWithEntries = new Set(sectorEntries.map(e => e.data)).size;
    const avg = daysWithEntries > 0 ? total / daysWithEntries : 0;

    const machineMap = new Map<number, { nome: string; total: number; days: Set<string> }>();
    for (const entry of sectorEntries) {
      if (entry.machineId === null) continue;
      const machine = sector.machines.find(m => m.id === entry.machineId);
      const name = machine ? machine.nome : `#${entry.machineId}`;
      if (!machineMap.has(entry.machineId)) {
        machineMap.set(entry.machineId, { nome: name, total: 0, days: new Set() });
      }
      const m = machineMap.get(entry.machineId)!;
      m.total += Number(entry.quantidade);
      m.days.add(entry.data);
    }

    const machines = Array.from(machineMap.values()).map(m => ({
      nome: m.nome,
      total: m.total,
      avg: m.days.size > 0 ? m.total / m.days.size : 0,
    })).sort((a, b) => a.nome.localeCompare(b.nome));

    sectorSummaries.push({ nome: sector.nome, total, avg, unidade: sector.unidadeMedida, machines });
  }

  // Section: Summary by sector
  y = drawSectionTitle(doc, "RESUMO POR SETOR", y, marginL);

  const sectorTableHead = [["Setor", "Total do Mês", "Média Diária", "Unidade", "Máquinas"]];
  const sectorTableBody: string[][] = [];
  for (const s of sectorSummaries) {
    const decimals = s.unidade === "m³" ? 3 : 1;
    sectorTableBody.push([
      s.nome,
      fmtNum(s.total, decimals),
      fmtNum(s.avg, decimals),
      s.unidade,
      String(s.machines.length),
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: sectorTableHead,
    body: sectorTableBody,
    margin: { left: marginL, right: marginR },
    theme: "grid",
    headStyles: {
      fillColor: C.primary,
      textColor: C.white,
      fontSize: 8,
      fontStyle: "bold",
      cellPadding: 3,
      lineColor: C.primaryDk,
      lineWidth: 0.2,
    },
    bodyStyles: { fontSize: 8, cellPadding: 2.5, textColor: C.dark, lineColor: [200, 215, 210], lineWidth: 0.15 },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: "bold" },
      1: { cellWidth: 40, halign: "right", fontStyle: "bold" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 25, halign: "center" },
    },
    alternateRowStyles: { fillColor: C.rowOdd },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.index % 2 === 0) {
        data.cell.styles.fillColor = C.rowEven;
      }
      if (data.section === "body" && data.column.index === 3) {
        const colors = getUnitColor(String(data.cell.raw));
        data.cell.styles.textColor = colors.fg;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Section: Detail by machine
  let machineY = ((doc as any).lastAutoTable?.finalY || y + 20) + 5;
  if (machineY + 30 > doc.internal.pageSize.getHeight() - 15) {
    doc.addPage();
    machineY = 20;
  }

  machineY = drawSectionTitle(doc, "DETALHAMENTO POR MÁQUINA", machineY, marginL);

  const machineTableHead = [["Setor", "Máquina", "Total do Mês", "Média Diária", "Unidade"]];
  const machineTableBody: string[][] = [];

  for (const s of sectorSummaries) {
    const decimals = s.unidade === "m³" ? 3 : 1;
    if (s.machines.length === 0) {
      machineTableBody.push([s.nome, "—", fmtNum(s.total, decimals), fmtNum(s.avg, decimals), s.unidade]);
    } else {
      for (const m of s.machines) {
        machineTableBody.push([s.nome, m.nome, fmtNum(m.total, decimals), fmtNum(m.avg, decimals), s.unidade]);
      }
    }
  }

  autoTable(doc, {
    startY: machineY,
    head: machineTableHead,
    body: machineTableBody,
    margin: { left: marginL, right: marginR },
    theme: "grid",
    headStyles: {
      fillColor: C.teal,
      textColor: C.white,
      fontSize: 7.5,
      fontStyle: "bold",
      cellPadding: 2.5,
      lineColor: [10, 120, 110],
      lineWidth: 0.2,
    },
    bodyStyles: { fontSize: 7, cellPadding: 2, textColor: C.dark, lineColor: [200, 215, 210], lineWidth: 0.15 },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold" },
      1: { cellWidth: 45 },
      2: { cellWidth: 35, halign: "right", fontStyle: "bold" },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 20, halign: "center" },
    },
    alternateRowStyles: { fillColor: C.rowOdd },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.index % 2 === 0) {
        data.cell.styles.fillColor = C.rowEven;
      }
      if (data.section === "body" && data.column.index === 4) {
        const colors = getUnitColor(String(data.cell.raw));
        data.cell.styles.textColor = colors.fg;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Total bars by unit
  let finalY = ((doc as any).lastAutoTable?.finalY || machineY + 20) + 4;
  finalY = drawUnitTotalBars(doc, unitGroups, finalY, marginL, marginR, "DO MÊS");

  drawFooter(doc, `Relatório Mensal de Produção — ${monthLabel}`);
  doc.save(`Producao_Mensal_${month.replace(/-/g, "")}.pdf`);
}
