/**
 * Produção — Geração de PDFs (Diário, Semanal, Mensal)
 * Módulo isolado para não alterar nada existente na página Production.tsx
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
  // Remove suffixes _saco, _cxp, _cxg for display
  const base = tipo.replace(/_saco$/, "").replace(/_cxp$/, "").replace(/_cxg$/, "");
  // Check if it's a known label
  if (TIPO_LABELS[base]) {
    const suffix = tipo.endsWith("_saco") ? " (Saco)" : tipo.endsWith("_cxp") ? " (Cx Peq)" : tipo.endsWith("_cxg") ? " (Cx Gr)" : "";
    return TIPO_LABELS[base] + suffix;
  }
  // Measurement like 3.8x200mm
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

// ─── Common header ───
async function drawHeader(doc: jsPDF, title: string, subtitle: string): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 12;
  let y = 12;

  const logo = await getLogoBase64();
  if (logo) {
    const logoH = 12;
    const logoW = logoH * LOGO_RATIO;
    doc.addImage(logo, "PNG", marginL, y, logoW, logoH);
    y += logoH + 3;
  }

  // Title bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(marginL, y, pageW - 2 * marginL, 11, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(title, marginL + 5, y + 7);

  // Subtitle badge on right
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const subW = doc.getTextWidth(subtitle) + 8;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageW - marginL - subW - 3, y + 1.5, subW, 8, 1.5, 1.5, "F");
  doc.setTextColor(15, 23, 42);
  doc.text(subtitle, pageW - marginL - subW / 2 - 3, y + 6, { align: "center" });

  y += 14;

  // Generated date
  const now = new Date();
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 150);
  doc.text(`Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, marginL, y);
  y += 5;

  return y;
}

// ─── Common footer ───
function drawFooter(doc: jsPDF, label: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 170);
    doc.text(
      `Grupo Fox — ${label} — Página ${i}/${totalPages}`,
      pageW / 2, pageH - 8, { align: "center" }
    );
  }
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
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 12;
  const marginR = 12;

  let y = await drawHeader(doc, "RELATÓRIO DE PRODUÇÃO — LANÇAMENTO DIÁRIO", fmtDate(selectedDate));

  // Summary cards — total per sector
  const sectorTotals: { nome: string; total: number; unidade: string }[] = [];
  for (const sector of sectors) {
    const sectorEntries = entries.filter(e => e.sectorId === sector.id && Number(e.quantidade) > 0);
    const total = sectorEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
    sectorTotals.push({ nome: sector.nome, total, unidade: sector.unidadeMedida });
  }

  const cardH = 12;
  const cardGap = 2;
  const maxCards = Math.min(sectorTotals.length, 9);
  const cardW = (pageW - marginL - marginR - cardGap * (maxCards - 1)) / maxCards;

  for (let i = 0; i < maxCards; i++) {
    const cx = marginL + i * (cardW + cardGap);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, "F");
    doc.setDrawColor(220, 225, 235);
    doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    const label = sectorTotals[i].nome.length > 14 ? sectorTotals[i].nome.slice(0, 13) + "…" : sectorTotals[i].nome;
    doc.text(label.toUpperCase(), cx + cardW / 2, y + 4, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(fmtNum(sectorTotals[i].total, sectorTotals[i].unidade === "m³" ? 3 : 0), cx + cardW / 2, y + 9.5, { align: "center" });
  }
  y += cardH + 5;

  // Table — one row per entry, grouped by sector
  const tableHead = [["Setor", "Máquina", "Tipo/Medida", "Quantidade", "Unidade", "Status", "Observações"]];
  const tableBody: string[][] = [];

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
      tableBody.push([
        sector.nome,
        machineName,
        tipoLabel(entry.tipoMadeira),
        fmtNum(Number(entry.quantidade), sector.unidadeMedida === "m³" ? 3 : 1),
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
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: "bold",
      cellPadding: 2,
    },
    bodyStyles: { fontSize: 6.5, cellPadding: 1.5, textColor: [30, 30, 50] },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold" },
      1: { cellWidth: 28 },
      2: { cellWidth: 32 },
      3: { cellWidth: 22, halign: "right", fontStyle: "bold" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 38 },
      6: { }, // auto-width for observations
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 5) {
        const val = String(data.cell.raw);
        if (val.includes("Manutenção")) {
          data.cell.styles.textColor = [99, 102, 241]; // indigo
          data.cell.styles.fontStyle = "bold";
        } else if (val.includes("Falta")) {
          data.cell.styles.textColor = [239, 68, 68]; // red
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    didDrawPage: () => {
      // Footer will be drawn at the end
    },
  });

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
  const marginL = 12;
  const marginR = 12;

  let y = await drawHeader(doc, "RELATÓRIO DE PRODUÇÃO — FECHAMENTO SEMANAL", `${fmtDate(weekStart)} a ${fmtDate(weekEnd)}`);

  // Calculate working days in the range
  const workingDays = new Set<string>();
  const d = new Date(weekStart + "T12:00:00");
  const end = new Date(weekEnd + "T12:00:00");
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0) { // Exclude Sundays
      workingDays.add(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() + 1);
  }
  const numDays = workingDays.size || 1;

  // Table: Setor | Total Semana | Média Diária | Unidade | Dias com Lançamento
  const tableHead = [["Setor", "Total da Semana", "Média Diária", "Unidade", "Dias c/ Lançamento"]];
  const tableBody: string[][] = [];
  let grandTotal = 0;

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
    grandTotal += total;
  }

  // Summary cards
  const cardH = 14;
  const cardGap = 4;
  const cards = [
    { label: "TOTAL GERAL", value: fmtNum(grandTotal, 1) },
    { label: "SETORES", value: String(sectors.length) },
    { label: "DIAS ÚTEIS", value: String(numDays) },
    { label: "MÉDIA DIÁRIA GERAL", value: fmtNum(grandTotal / numDays, 1) },
  ];
  const cardW = (pageW - marginL - marginR - cardGap * (cards.length - 1)) / cards.length;

  for (let i = 0; i < cards.length; i++) {
    const cx = marginL + i * (cardW + cardGap);
    const isFirst = i === 0;
    doc.setFillColor(isFirst ? 15 : 245, isFirst ? 23 : 247, isFirst ? 42 : 250);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");
    if (!isFirst) {
      doc.setDrawColor(220, 225, 235);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, "S");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(isFirst ? 200 : 100, isFirst ? 200 : 116, isFirst ? 210 : 139);
    doc.text(cards[i].label, cx + cardW / 2, y + 5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(isFirst ? 255 : 15, isFirst ? 255 : 23, isFirst ? 255 : 42);
    doc.text(cards[i].value, cx + cardW / 2, y + 11, { align: "center" });
  }
  y += cardH + 5;

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: marginL, right: marginR },
    theme: "grid",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 30, 50] },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: "bold" },
      1: { cellWidth: 40, halign: "right", fontStyle: "bold" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 40, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Total bar
  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  let ty = finalY + 3;
  if (ty + 12 > doc.internal.pageSize.getHeight() - 15) {
    doc.addPage();
    ty = 20;
  }
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(marginL, ty, pageW - marginL - marginR, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL GERAL DA SEMANA", marginL + 5, ty + 6.5);
  doc.text(fmtNum(grandTotal, 1), pageW - marginR - 5, ty + 6.5, { align: "right" });

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
  const marginL = 12;
  const marginR = 12;

  const [year, mon] = month.split("-");
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const monthLabel = `${monthNames[parseInt(mon) - 1]} ${year}`;

  let y = await drawHeader(doc, "RELATÓRIO DE PRODUÇÃO — FECHAMENTO MENSAL", monthLabel);

  // Calculate working days
  const workingDays = new Set<string>();
  const firstDay = new Date(`${month}-01T12:00:00`);
  const lastDay = new Date(parseInt(year), parseInt(mon), 0);
  const d = new Date(firstDay);
  while (d <= lastDay) {
    const dow = d.getDay();
    if (dow !== 0) workingDays.add(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  const numDays = workingDays.size || 1;

  // Grand totals
  let grandTotal = 0;
  const sectorSummaries: { nome: string; total: number; avg: number; unidade: string; machines: { nome: string; total: number; avg: number }[] }[] = [];

  for (const sector of sectors) {
    const sectorEntries = entries.filter(e => e.sectorId === sector.id && Number(e.quantidade) > 0);
    const total = sectorEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
    const daysWithEntries = new Set(sectorEntries.map(e => e.data)).size;
    const avg = daysWithEntries > 0 ? total / daysWithEntries : 0;

    // Per machine
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
    grandTotal += total;
  }

  // Summary cards
  const cardH = 14;
  const cardGap = 4;
  const cards = [
    { label: "TOTAL GERAL MÊS", value: fmtNum(grandTotal, 1) },
    { label: "SETORES", value: String(sectors.length) },
    { label: "DIAS ÚTEIS", value: String(numDays) },
    { label: "MÉDIA DIÁRIA GERAL", value: fmtNum(grandTotal / numDays, 1) },
  ];
  const cardW = (pageW - marginL - marginR - cardGap * (cards.length - 1)) / cards.length;

  for (let i = 0; i < cards.length; i++) {
    const cx = marginL + i * (cardW + cardGap);
    const isFirst = i === 0;
    doc.setFillColor(isFirst ? 13 : 245, isFirst ? 148 : 247, isFirst ? 136 : 250); // teal-600 for first
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");
    if (!isFirst) {
      doc.setDrawColor(220, 225, 235);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, "S");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(isFirst ? 220 : 100, isFirst ? 240 : 116, isFirst ? 235 : 139);
    doc.text(cards[i].label, cx + cardW / 2, y + 5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(isFirst ? 255 : 15, isFirst ? 255 : 23, isFirst ? 255 : 42);
    doc.text(cards[i].value, cx + cardW / 2, y + 11, { align: "center" });
  }
  y += cardH + 5;

  // Table 1: Summary by sector
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
      fillColor: [13, 148, 136], // teal-600
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 30, 50] },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: "bold" },
      1: { cellWidth: 40, halign: "right", fontStyle: "bold" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 25, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Table 2: Detail by machine
  let machineY = ((doc as any).lastAutoTable?.finalY || y + 20) + 6;

  // Section title
  if (machineY + 30 > doc.internal.pageSize.getHeight() - 15) {
    doc.addPage();
    machineY = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("DETALHAMENTO POR MÁQUINA", marginL, machineY);
  machineY += 5;

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
      fillColor: [71, 85, 105], // slate-600
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      cellPadding: 2.5,
    },
    bodyStyles: { fontSize: 7, cellPadding: 2, textColor: [30, 30, 50] },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold" },
      1: { cellWidth: 45 },
      2: { cellWidth: 35, halign: "right", fontStyle: "bold" },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 20, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Total bar
  const finalY2 = (doc as any).lastAutoTable?.finalY || machineY + 20;
  let ty = finalY2 + 3;
  if (ty + 12 > doc.internal.pageSize.getHeight() - 15) {
    doc.addPage();
    ty = 20;
  }
  doc.setFillColor(13, 148, 136); // teal-600
  doc.roundedRect(marginL, ty, pageW - marginL - marginR, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL GERAL DO MÊS", marginL + 5, ty + 6.5);
  doc.text(fmtNum(grandTotal, 1), pageW - marginR - 5, ty + 6.5, { align: "right" });

  drawFooter(doc, `Relatório Mensal de Produção — ${monthLabel}`);
  doc.save(`Producao_Mensal_${month.replace(/-/g, "")}.pdf`);
}
