/**
 * Produção — Geração de PDFs (Diário, Semanal, Mensal)
 * Design profissional com CARDS POR SETOR em grid
 * Cada setor = 1 retângulo com tabela interna + total
 * Layout em página única A4 landscape
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
  primary:    [0, 105, 62] as [number, number, number],
  primaryDk:  [0, 77, 45] as [number, number, number],
  primaryLt:  [232, 245, 233] as [number, number, number],
  accent:     [245, 158, 11] as [number, number, number],
  accentDk:   [180, 110, 0] as [number, number, number],
  dark:       [30, 41, 59] as [number, number, number],
  medium:     [100, 116, 139] as [number, number, number],
  light:      [241, 245, 249] as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
  black:      [15, 23, 42] as [number, number, number],
  rowEven:    [255, 255, 255] as [number, number, number],
  rowOdd:     [245, 250, 248] as [number, number, number],
  red:        [220, 38, 38] as [number, number, number],
  orange:     [234, 88, 12] as [number, number, number],
  indigo:     [79, 70, 229] as [number, number, number],
  teal:       [13, 148, 136] as [number, number, number],
  caixa:      [37, 99, 235] as [number, number, number],
  caixaLt:    [219, 234, 254] as [number, number, number],
  saco:       [168, 85, 247] as [number, number, number],
  sacoLt:     [243, 232, 255] as [number, number, number],
  m3:         [14, 165, 233] as [number, number, number],
  m3Lt:       [224, 242, 254] as [number, number, number],
  forma:      [236, 72, 153] as [number, number, number],
  formaLt:    [252, 231, 243] as [number, number, number],
  outro:      [107, 114, 128] as [number, number, number],
  outroLt:    [243, 244, 246] as [number, number, number],
};

// Sector-specific accent colors for card headers
const SECTOR_COLORS: [number, number, number][] = [
  [0, 105, 62],     // Multilâmina - green
  [37, 99, 235],    // Vareteira - blue
  [168, 85, 247],   // Seletora de Toco - purple
  [14, 165, 233],   // Seleção Automática - sky
  [236, 72, 153],   // Seleção Visual - pink
  [234, 88, 12],    // Flow Pack - orange
  [13, 148, 136],   // Embalagem - teal
  [79, 70, 229],    // Pirografar - indigo
  [107, 114, 128],  // Extra - gray
];

function getSectorColor(index: number): [number, number, number] {
  return SECTOR_COLORS[index % SECTOR_COLORS.length];
}

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
  producao_normal: "Normal",
  falta_madeira: "Falta Madeira",
  producao_nao_necessaria: "Não Necessária",
  manutencao: "Manutenção",
  manutencao_pontual: "Manut. Pontual",
};

function statusLabel(status: string): string {
  if (!status) return "—";
  return status.split(",").map(s => STATUS_LABELS[s.trim()] || s.trim()).join(", ");
}

// ─── Tipo madeira labels ───
const TIPO_LABELS: Record<string, string> = {
  benazzi: "Benazzi",
  madeira_dura: "Mad. Dura",
  bambu: "Bambu",
  madeira: "Madeira",
};

function tipoLabel(tipo: string | null): string {
  if (!tipo) return "—";
  const base = tipo.replace(/_saco$/, "").replace(/_cxp$/, "").replace(/_cxg$/, "");
  if (TIPO_LABELS[base]) {
    const suffix = tipo.endsWith("_saco") ? " (Sc)" : tipo.endsWith("_cxp") ? " (CxP)" : tipo.endsWith("_cxg") ? " (CxG)" : "";
    return TIPO_LABELS[base] + suffix;
  }
  const suffix = tipo.endsWith("_saco") ? " (Sc)" : tipo.endsWith("_cxp") ? " (CxP)" : tipo.endsWith("_cxg") ? " (CxG)" : "";
  return base.replace(".", ",") + suffix;
}

// ─── Fatores de conversão caixa → saco ───
const CONVERSION_FACTORS: Record<string, { cxp: number; cxg: number }> = {
  "3.8x150mm": { cxp: 0, cxg: 0 },
  "3.8x180mm": { cxp: 0.5, cxg: 0 },
  "3.8x200mm": { cxp: 0.6, cxg: 0.8 },
  "3.8x218mm": { cxp: 0.6, cxg: 0.8 },
  "3.8x220mm": { cxp: 0.5, cxg: 0.7 },
  "3.8x250mm": { cxp: 0, cxg: 0.8 },
  "3.8x300mm": { cxp: 0, cxg: 0 },
  "3.8x350mm": { cxp: 0.4, cxg: 0.6 },
  "3.5x200mm": { cxp: 0.6, cxg: 0.8 },
  "3.5x250mm": { cxp: 0, cxg: 0 },
  "3.5x350mm": { cxp: 0, cxg: 0 },
};

function isDualUnitSector(ordem: number) { return ordem === 2 || ordem === 3 || ordem === 4; }

function convertCxpToSaco(medida: string, caixas: number): number {
  const fator = CONVERSION_FACTORS[medida]?.cxp || 1;
  return caixas * fator;
}
function convertCxgToSaco(medida: string, caixas: number): number {
  const fator = CONVERSION_FACTORS[medida]?.cxg || 1;
  return caixas * fator;
}

function convertedQty(entry: EntryData, sector: SectorData): number {
  const qty = Number(entry.quantidade);
  if (qty <= 0) return 0;
  if (!isDualUnitSector(sector.ordem)) return qty;
  const tipo = entry.tipoMadeira;
  if (!tipo) return qty;
  const parts = tipo.split("_");
  const suffix = parts[parts.length - 1];
  const medida = parts.slice(0, -1).join("_");
  if (suffix === "cxp") return convertCxpToSaco(medida, qty);
  if (suffix === "cxg") return convertCxgToSaco(medida, qty);
  return qty;
}

function displayUnit(sector: SectorData): string {
  if (isDualUnitSector(sector.ordem)) return "sacos";
  return pluralizeUnit(sector.unidadeMedida);
}

function pluralizeUnit(unit: string): string {
  const plurals: Record<string, string> = {
    "saco": "sacos",
    "caixa": "caixas",
    "cx": "caixas",
    "forma": "formas",
    "pç": "peças",
    "un": "unidades",
    "m³": "m³",
  };
  return plurals[unit.toLowerCase()] || unit;
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
  const result: UnitGroup[] = [];
  const nonSacoMap = new Map<string, { total: number; decimals: number }>();
  const unitLabels: Record<string, string> = {
    "caixa": "Caixas", "cx": "Caixas", "saco": "Sacos", "m³": "Metro Cúbico (m³)",
    "forma": "Formas", "pç": "Peças", "un": "Unidades",
  };

  for (const sector of sectors) {
    const sectorEntries = entries.filter(e => e.sectorId === sector.id && Number(e.quantidade) > 0);
    const total = sectorEntries.reduce((sum, e) => sum + convertedQty(e, sector), 0);
    const u = displayUnit(sector);
    const decimals = u === "m³" ? 3 : (u === "forma" ? 0 : 1);

    if (u === "saco") {
      result.push({ unit: "saco", label: `Sacos (${sector.nome})`, total, decimals });
    } else {
      if (!nonSacoMap.has(u)) nonSacoMap.set(u, { total: 0, decimals });
      nonSacoMap.get(u)!.total += total;
    }
  }

  for (const [unit, data] of Array.from(nonSacoMap.entries())) {
    result.push({ unit, label: unitLabels[unit.toLowerCase()] || unit, total: data.total, decimals: data.decimals });
  }
  return result;
}

// ─── Common header (compact) ───
async function drawHeader(doc: jsPDF, title: string, subtitle: string): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 10;
  let y = 7;

  const logo = await getLogoBase64();
  if (logo) {
    const logoH = 10;
    const logoW = logoH * LOGO_RATIO;
    doc.addImage(logo, "PNG", marginL, y, logoW, logoH);
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.primary);
  doc.text(title, marginL + 28, y + 4);

  // Subtitle badge
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.accent);
  doc.text(subtitle, marginL + 28, y + 9);

  // Generated timestamp
  const now = new Date();
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6);
  doc.setTextColor(...C.medium);
  doc.text(`Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, pageW - 10, y + 4, { align: "right" });

  y += 13;

  // Divider line
  doc.setDrawColor(...C.primary);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, pageW - 10, y);
  y += 3;

  return y;
}

// ─── Common footer ───
function drawFooter(doc: jsPDF, label: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.2);
    doc.line(10, pageH - 8, pageW - 10, pageH - 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...C.medium);
    doc.text(`Grupo Fox — ${label}`, 10, pageH - 4);
    doc.text(`Página ${i}/${totalPages}`, pageW - 10, pageH - 4, { align: "right" });
  }
}

// ═══════════════════════════════════════════════════════════════
// CARD-BASED SECTOR GRID RENDERER
// ═══════════════════════════════════════════════════════════════

interface SectorCardData {
  nome: string;
  ordem: number;
  unit: string;
  total: number;
  decimals: number;
  rows: { maquina: string; tipo: string; qtd: string; unidade: string; status: string; obs: string }[];
  weeklyAvg?: number;
  monthlyAvg?: number;
}

function prepareSectorCards(sectors: SectorData[], entries: EntryData[]): SectorCardData[] {
  const cards: SectorCardData[] = [];

  for (const sector of sectors) {
    const sectorEntries = entries.filter(e => e.sectorId === sector.id && Number(e.quantidade) > 0);
    const unit = displayUnit(sector);
    const decimals = unit === "m³" ? 3 : 1;
    const total = sectorEntries.reduce((sum, e) => sum + convertedQty(e, sector), 0);

    const rows: SectorCardData["rows"] = [];
    if (sectorEntries.length === 0) {
      rows.push({ maquina: "—", tipo: "—", qtd: "0", unidade: unit, status: "Sem lançamento", obs: "" });
    } else {
      // Sort entries by machine order (numeric)
      const sortedEntries = [...sectorEntries].sort((a, b) => {
        const machA = sector.machines.find(m => m.id === a.machineId);
        const machB = sector.machines.find(m => m.id === b.machineId);
        return (machA?.ordem ?? 999) - (machB?.ordem ?? 999);
      });
      for (const entry of sortedEntries) {
        const machine = sector.machines.find(m => m.id === entry.machineId);
        const machineName = machine ? machine.nome : (entry.machineId ? `#${entry.machineId}` : "—");
        const obs = entry.observacoes && entry.observacoes !== "[REMOVIDO]" ? entry.observacoes : "";
        const qty = convertedQty(entry, sector);
        rows.push({
          maquina: machineName,
          tipo: tipoLabel(entry.tipoMadeira),
          qtd: fmtNum(qty, decimals),
          unidade: unit,
          status: statusLabel(entry.status || ""),
          obs: obs.length > 20 ? obs.substring(0, 18) + "…" : obs,
        });
      }
    }

    cards.push({ nome: sector.nome, ordem: sector.ordem, unit, total, decimals, rows });
  }

  return cards;
}

function prepareSectorCardsWeekly(sectors: SectorData[], entries: EntryData[], numDays: number): SectorCardData[] {
  const cards: SectorCardData[] = [];

  for (const sector of sectors) {
    const sectorEntries = entries.filter(e => e.sectorId === sector.id && Number(e.quantidade) > 0);
    const unit = displayUnit(sector);
    const decimals = unit === "m³" ? 3 : 1;
    const total = sectorEntries.reduce((sum, e) => sum + convertedQty(e, sector), 0);
    const daysWithEntries = new Set(sectorEntries.map(e => e.data)).size;
    const avg = daysWithEntries > 0 ? total / daysWithEntries : 0;

    // Group by machine for weekly/monthly
    const machineMap = new Map<number | null, { nome: string; total: number; days: Set<string> }>();
    for (const entry of sectorEntries) {
      const key = entry.machineId;
      const machine = sector.machines.find(m => m.id === entry.machineId);
      const name = machine ? machine.nome : (entry.machineId ? `#${entry.machineId}` : "Geral");
      if (!machineMap.has(key)) machineMap.set(key, { nome: name, total: 0, days: new Set() });
      const m = machineMap.get(key)!;
      m.total += convertedQty(entry, sector);
      m.days.add(entry.data);
    }

    const rows: SectorCardData["rows"] = [];
    if (machineMap.size === 0) {
      rows.push({ maquina: "—", tipo: "—", qtd: "0", unidade: unit, status: `0/${numDays} dias`, obs: "" });
    } else {
      // Sort machines by ordem (numeric order)
      const sortedMachines = Array.from(machineMap.entries()).sort((a, b) => {
        const machA = sector.machines.find(m => m.id === a[0]);
        const machB = sector.machines.find(m => m.id === b[0]);
        return (machA?.ordem ?? 999) - (machB?.ordem ?? 999);
      });
      for (const [, m] of sortedMachines) {
        const mAvg = m.days.size > 0 ? m.total / m.days.size : 0;
        rows.push({
          maquina: m.nome,
          tipo: fmtNum(mAvg, decimals) + "/dia",
          qtd: fmtNum(m.total, decimals),
          unidade: unit,
          status: `${m.days.size}/${numDays} dias`,
          obs: "",
        });
      }
    }

    cards.push({ nome: sector.nome, ordem: sector.ordem, unit, total, decimals, rows });
  }

  return cards;
}

/**
 * Draw sector cards in a grid layout fitting one page
 * Each card: rounded rect with colored header, mini table, and total footer
 */
function drawSectorCardsGrid(
  doc: jsPDF,
  cards: SectorCardData[],
  startY: number,
  isWeeklyOrMonthly: boolean,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 10;
  const marginR = 10;
  const usableW = pageW - marginL - marginR;
  const footerSpace = 12;
  const availableH = pageH - startY - footerSpace;

  // Calculate grid layout: try to fit all cards in available space
  const numCards = cards.length;
  // For 8-9 sectors: use 4 columns x 2 rows (or 3x3)
  let cols = numCards <= 4 ? 2 : numCards <= 6 ? 3 : 4;
  let rowCount = Math.ceil(numCards / cols);

  // If too many rows, increase columns
  if (rowCount > 3) { cols = 4; rowCount = Math.ceil(numCards / cols); }

  const cardGap = 4;
  const cardW = (usableW - cardGap * (cols - 1)) / cols;
  const cardH = (availableH - cardGap * (rowCount - 1)) / rowCount;

  // Minimum card height
  const minCardH = 35;
  const effectiveCardH = Math.max(minCardH, Math.min(cardH, 90));

  for (let i = 0; i < numCards; i++) {
    const card = cards[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginL + col * (cardW + cardGap);
    const y = startY + row * (effectiveCardH + cardGap);

    // Check if we need a new page
    if (y + effectiveCardH > pageH - footerSpace) {
      doc.addPage();
      // Recursively draw remaining cards on new page
      const remaining = cards.slice(i);
      drawSectorCardsGrid(doc, remaining, 15, isWeeklyOrMonthly);
      return pageH - footerSpace;
    }

    const sectorColor = getSectorColor(i);
    const headerH = 7;
    const hasAverages = card.weeklyAvg !== undefined || card.monthlyAvg !== undefined;
    const footerH = hasAverages ? 14 : 7;
    const tableAreaH = effectiveCardH - headerH - footerH - 2;

    // Card background
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(210, 220, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, effectiveCardH, 2, 2, "FD");

    // Card header (colored bar)
    doc.setFillColor(...sectorColor);
    doc.roundedRect(x, y, cardW, headerH, 2, 2, "F");
    // Fix bottom corners of header (make them square to blend with card body)
    doc.setFillColor(...sectorColor);
    doc.rect(x, y + headerH - 2, cardW, 2, "F");

    // Sector name in header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    const sectorName = card.nome.length > 18 ? card.nome.substring(0, 16) + "…" : card.nome;
    doc.text(sectorName, x + 3, y + 5.5);

    // Unit badge in header
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(card.unit, x + cardW - 3, y + 5.5, { align: "right" });

    // Table area
    const tableY = y + headerH + 1;
    const maxRows = Math.floor(tableAreaH / 4.5);
    const displayRows = card.rows.slice(0, maxRows);

    // Column headers (mini)
    const colHeaders = isWeeklyOrMonthly
      ? ["Máquina", "Total", "Média", "Dias"]
      : ["Máquina", "Tipo", "Qtd", "Status"];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...C.medium);

    const colWidths = isWeeklyOrMonthly
      ? [cardW * 0.32, cardW * 0.24, cardW * 0.22, cardW * 0.22]
      : [cardW * 0.28, cardW * 0.24, cardW * 0.2, cardW * 0.28];

    let colX = x + 2;
    for (let c = 0; c < colHeaders.length; c++) {
      doc.text(colHeaders[c], colX, tableY + 3);
      colX += colWidths[c];
    }

    // Separator line under headers
    doc.setDrawColor(220, 230, 235);
    doc.setLineWidth(0.15);
    doc.line(x + 2, tableY + 4.5, x + cardW - 2, tableY + 4.5);

    // Data rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(...C.dark);

    for (let r = 0; r < displayRows.length; r++) {
      const rowData = displayRows[r];
      const rowY = tableY + 5 + (r + 1) * 4.2;

      if (rowY > y + effectiveCardH - footerH - 2) break;

      // Alternate row background
      if (r % 2 === 1) {
        doc.setFillColor(245, 248, 250);
        doc.rect(x + 1.5, rowY - 3, cardW - 3, 4, "F");
      }

      colX = x + 2;
      if (isWeeklyOrMonthly) {
        // Máquina
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.dark);
        const mName = rowData.maquina.length > 12 ? rowData.maquina.substring(0, 10) + "…" : rowData.maquina;
        doc.text(mName, colX, rowY);
        colX += colWidths[0];

        // Total (ANTES da Média)
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.dark);
        doc.text(rowData.qtd, colX, rowY);
        colX += colWidths[1];

        // Média
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.medium);
        doc.text(rowData.tipo, colX, rowY);
        colX += colWidths[2];

        // Dias
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.medium);
        doc.text(rowData.status, colX, rowY);
      } else {
        // Máquina
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.dark);
        const mName = rowData.maquina.length > 10 ? rowData.maquina.substring(0, 8) + "…" : rowData.maquina;
        doc.text(mName, colX, rowY);
        colX += colWidths[0];

        // Tipo/Medida
        doc.setTextColor(...C.medium);
        const tName = rowData.tipo.length > 10 ? rowData.tipo.substring(0, 8) + "…" : rowData.tipo;
        doc.text(tName, colX, rowY);
        colX += colWidths[1];

        // Quantidade
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.dark);
        doc.text(rowData.qtd, colX, rowY);
        colX += colWidths[2];

        // Status
        doc.setFont("helvetica", "normal");
        const statusText = rowData.status.length > 12 ? rowData.status.substring(0, 10) + "…" : rowData.status;
        if (rowData.status.includes("Falta") || rowData.status.includes("Sem")) {
          doc.setTextColor(...C.red);
        } else if (rowData.status.includes("Manutenção") || rowData.status.includes("Manut")) {
          doc.setTextColor(...C.indigo);
        } else {
          doc.setTextColor(...C.primary);
        }
        doc.text(statusText, colX, rowY);
      }
    }

    // Show "+" indicator if rows were truncated
    if (card.rows.length > displayRows.length) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(4);
      doc.setTextColor(...C.medium);
      doc.text(`+${card.rows.length - displayRows.length} itens`, x + cardW - 3, y + effectiveCardH - footerH - 1, { align: "right" });
    }

    // Footer: Total bar (light tinted background)
    const footerY = y + effectiveCardH - footerH;
    doc.setFillColor(
      Math.min(255, sectorColor[0] + 210),
      Math.min(255, sectorColor[1] + 210),
      Math.min(255, sectorColor[2] + 210)
    );
    doc.rect(x + 0.5, footerY, cardW - 1, footerH, "F");
    // Bottom rounded corners
    doc.setFillColor(
      Math.min(255, sectorColor[0] + 210),
      Math.min(255, sectorColor[1] + 210),
      Math.min(255, sectorColor[2] + 210)
    );
    doc.roundedRect(x, footerY, cardW, footerH, 2, 2, "F");
    // Re-draw top part of footer rect to make it square on top
    doc.rect(x, footerY, cardW, 2, "F");

    // Total text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...sectorColor);
    doc.text("TOTAL:", x + 3, footerY + 4.5);
    doc.setFontSize(9);
    doc.text(`${fmtNum(card.total, card.decimals)} ${card.unit}`, x + cardW - 3, footerY + 4.5, { align: "right" });

    // Averages line (below total)
    if (hasAverages) {
      // Monthly average - prominent, bold, full label
      if (card.monthlyAvg !== undefined) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.dark);
        doc.text("Média Mês:", x + 3, footerY + 10.5);
        doc.setFontSize(8);
        doc.setTextColor(...sectorColor);
        doc.text(`${fmtNum(card.monthlyAvg, card.decimals)} ${card.unit}/dia`, x + cardW - 3, footerY + 10.5, { align: "right" });
      } else if (card.weeklyAvg !== undefined) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.dark);
        doc.text("Média Semana:", x + 3, footerY + 10.5);
        doc.setFontSize(8);
        doc.setTextColor(...sectorColor);
        doc.text(`${fmtNum(card.weeklyAvg, card.decimals)} ${card.unit}/dia`, x + cardW - 3, footerY + 10.5, { align: "right" });
      }
    }
  }

  return startY + rowCount * (effectiveCardH + cardGap);
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

  let y = await drawHeader(doc, "RELATÓRIO DE PRODUÇÃO — DIÁRIO", fmtDate(selectedDate));

  // Prepare sector cards
  const cards = prepareSectorCards(sectors, entries);

  // Draw cards grid
  drawSectorCardsGrid(doc, cards, y, false);

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
  monthlyAverages?: { sectorId: number; mediaDiaria: number }[],
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  let y = await drawHeader(doc, "RELATÓRIO DE PRODUÇÃO — SEMANAL", `${fmtDate(weekStart)} a ${fmtDate(weekEnd)}`);

  // Calculate working days
  const workingDays = new Set<string>();
  const d = new Date(weekStart + "T12:00:00");
  const end = new Date(weekEnd + "T12:00:00");
  while (d <= end) {
    if (d.getDay() !== 0) workingDays.add(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  const numDays = workingDays.size || 1;

  // Prepare sector cards (weekly mode)
  const cards = prepareSectorCardsWeekly(sectors, entries, numDays);

  // Inject averages into cards
  for (const card of cards) {
    // Weekly average = total / numDays
    card.weeklyAvg = numDays > 0 ? card.total / numDays : 0;
    // Monthly average from backend
    if (monthlyAverages) {
      const sector = sectors.find(s => s.nome === card.nome);
      if (sector) {
        const ma = monthlyAverages.find(m => m.sectorId === sector.id);
        if (ma) card.monthlyAvg = ma.mediaDiaria;
      }
    }
  }

  // Draw cards grid
  drawSectorCardsGrid(doc, cards, y, true);

  drawFooter(doc, "Relatório Semanal de Produção");
  doc.save(`Producao_Semanal_${weekStart.replace(/-/g, "")}_${weekEnd.replace(/-/g, "")}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// 3. PDF MENSAL
// ═══════════════════════════════════════════════════════════════
export async function generateMonthlyPdf(
  sectors: SectorData[],
  entries: EntryData[],
  month: string,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const [year, mon] = month.split("-");
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const monthLabel = `${monthNames[parseInt(mon) - 1]} ${year}`;

  let y = await drawHeader(doc, "RELATÓRIO DE PRODUÇÃO — MENSAL", monthLabel);

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

  // Prepare sector cards (monthly mode = same as weekly)
  const cards = prepareSectorCardsWeekly(sectors, entries, numDays);

  // Inject monthly average into cards (total / numDays)
  for (const card of cards) {
    card.monthlyAvg = numDays > 0 ? card.total / numDays : 0;
  }

  // Draw cards grid
  drawSectorCardsGrid(doc, cards, y, true);

  drawFooter(doc, `Relatório Mensal de Produção — ${monthLabel}`);
  doc.save(`Producao_Mensal_${month.replace(/-/g, "")}.pdf`);
}
