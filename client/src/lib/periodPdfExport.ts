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

// ─── Color Palette ───────────────────────────────────────────────
const C = {
  teal:     [13, 148, 136] as [number, number, number],
  tealDark: [15, 118, 110] as [number, number, number],
  tealLight:[204, 251, 241] as [number, number, number],
  tealBar:  [20, 184, 166] as [number, number, number],
  emerald:  [5, 150, 105] as [number, number, number],
  blue:     [37, 99, 235] as [number, number, number],
  blueDark: [29, 78, 216] as [number, number, number],
  blueLight:[219, 234, 254] as [number, number, number],
  amber:    [217, 119, 6] as [number, number, number],
  amberDark:[180, 83, 9] as [number, number, number],
  amberLight:[254, 243, 199] as [number, number, number],
  orange:   [234, 88, 12] as [number, number, number],
  violet:   [139, 92, 246] as [number, number, number],
  violetDark: [109, 40, 217] as [number, number, number],
  violetLight: [237, 233, 254] as [number, number, number],
  slate900: [15, 23, 42] as [number, number, number],
  slate700: [51, 65, 85] as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  slate400: [148, 163, 184] as [number, number, number],
  slate200: [226, 232, 240] as [number, number, number],
  slate100: [241, 245, 249] as [number, number, number],
  slate50:  [248, 250, 252] as [number, number, number],
  white:    [255, 255, 255] as [number, number, number],
};

// ─── Formatters ──────────────────────────────────────────────────
function fmtCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}
function fmtNumber(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
function fmtPct(part: number, total: number): string {
  if (total === 0) return "0%";
  return ((part / total) * 100).toFixed(1) + "%";
}
function fmtCompact(val: number): string {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
  return val.toFixed(0);
}

// ─── Rounded Rect Helper ─────────────────────────────────────────
function drawCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  opts?: { fill?: [number, number, number]; borderColor?: [number, number, number]; topBar?: [number, number, number]; radius?: number },
) {
  const r = opts?.radius ?? 1.5;
  const fill = opts?.fill ?? C.white;
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, r, r, "F");
  doc.setDrawColor(...(opts?.borderColor ?? C.slate200));
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, r, r, "S");
  if (opts?.topBar) {
    doc.setFillColor(...opts.topBar);
    doc.rect(x + 0.3, y, w - 0.6, 0.8, "F");
  }
}

// ─── Draw compact KPI card ──────────────────────────────────────
function drawMiniCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  title: string, badgeText: string, bigValue: string, acumLabel: string, acumValue: string,
  color: [number, number, number], colorDark: [number, number, number], colorLight: [number, number, number],
) {
  drawCard(doc, x, y, w, h, { topBar: color });

  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...color);
  doc.text(title, x + 3, y + 4.5);

  // Badge
  const bw = doc.getTextWidth(badgeText) + 3;
  doc.setFillColor(...colorLight);
  doc.roundedRect(x + w - bw - 3, y + 2, bw, 4, 1, 1, "F");
  doc.setFontSize(4.5);
  doc.setTextColor(...colorDark);
  doc.text(badgeText, x + w - bw / 2 - 3, y + 4.5, { align: "center" });

  // Big number
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.slate900);
  doc.text(bigValue, x + 3, y + 11);

  // Separator
  doc.setDrawColor(...colorLight);
  doc.setLineWidth(0.2);
  doc.line(x + 3, y + 13, x + w - 3, y + 13);

  // Acumulado
  doc.setFillColor(...color);
  doc.rect(x + 3, y + 15.5, 4, 0.8, "F");
  doc.setFontSize(5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...color);
  doc.text(acumLabel, x + 9, y + 16.2);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colorDark);
  doc.text(acumValue, x + w - 3, y + 16.2, { align: "right" });
}

// ─── SVG to Image ────────────────────────────────────────────────
async function svgToImage(svgElement: SVGSVGElement): Promise<string | null> {
  try {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    const viewBox = svgElement.getAttribute("viewBox");
    const width = viewBox ? parseInt(viewBox.split(" ")[2]) : svgElement.clientWidth || 900;
    const height = viewBox ? parseInt(viewBox.split(" ")[3]) : svgElement.clientHeight || 320;
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Fix animations
    const styleEls = clone.querySelectorAll("style");
    styleEls.forEach(styleEl => {
      styleEl.textContent = (styleEl.textContent || "")
        .replace(/@keyframes\s+barGrow\s*\{[^}]*\{[^}]*\}[^}]*\{[^}]*\}\s*\}/g, "")
        .replace(/@keyframes\s+fadeInUp\s*\{[^}]*\{[^}]*\}[^}]*\{[^}]*\}\s*\}/g, "")
        .replace(/\.bar-animated\s*\{[^}]*\}/g, "")
        .replace(/\.label-animated\s*\{[^}]*\}/g, "");
    });
    clone.querySelectorAll(".bar-animated").forEach(el => {
      (el as SVGElement).classList.remove("bar-animated");
      (el as SVGElement).style.animation = "none";
      (el as SVGElement).style.transform = "scaleY(1)";
      (el as SVGElement).style.transformOrigin = "bottom";
    });
    clone.querySelectorAll(".label-animated").forEach(el => {
      (el as SVGElement).classList.remove("label-animated");
      (el as SVGElement).style.animation = "none";
      (el as SVGElement).style.opacity = "1";
      (el as SVGElement).style.transform = "none";
    });

    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const scale = 2;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        } else { URL.revokeObjectURL(url); resolve(null); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  } catch { return null; }
}

// ─── Draw monthly bar chart in PDF ──────────────────────────────
function drawMonthlyChart(
  doc: jsPDF,
  data: Array<{ month: string; value: number; faturado: number; aFaturar: number; orders: number }>,
  startX: number, startY: number,
  chartW: number, chartH: number,
  accentColor: [number, number, number],
): number {
  if (data.length === 0) return startY;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barCount = data.length;

  const leftAxisW = 18;
  const rightAxisW = 4;
  const bottomAxisH = 10;
  const topPad = 4;

  const plotX = startX + leftAxisW;
  const plotY = startY + topPad;
  const plotW = chartW - leftAxisW - rightAxisW;
  const plotH = chartH - bottomAxisH - topPad;

  const barWidth = Math.min(6, plotW / barCount * 0.5);
  const barGap = (plotW - barWidth * barCount) / Math.max(barCount - 1, 1);

  // Y axis grid lines
  for (let i = 0; i <= 4; i++) {
    const pct = i / 4;
    const gy = plotY + plotH - pct * plotH;
    doc.setDrawColor(...C.slate200);
    doc.setLineWidth(0.1);
    doc.line(plotX, gy, plotX + plotW, gy);
    const val = maxVal * pct;
    doc.setFontSize(5);
    doc.setTextColor(...C.slate400);
    doc.setFont("helvetica", "normal");
    doc.text(fmtCompact(val), plotX - 2, gy + 1, { align: "right" });
  }

  // Bars
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  data.forEach((d, i) => {
    const bx = plotX + i * (barWidth + barGap);
    const barH = d.value > 0 ? Math.max((d.value / maxVal) * plotH, 0.5) : 0.3;
    const by = plotY + plotH - barH;

    doc.setFillColor(...accentColor);
    doc.rect(bx, by, barWidth, barH, "F");

    // Value labels (only if enough space)
    if (d.value > 0 && barCount <= 12) {
      doc.setFontSize(4.5);
      doc.setTextColor(...C.slate900);
      doc.setFont("helvetica", "bold");
      doc.text(fmtCompact(d.value), bx + barWidth / 2, by - 1.5, { align: "center" });
    }

    // Month label
    const m = parseInt(d.month.substring(5, 7));
    doc.setFontSize(4.5);
    doc.setTextColor(...C.slate500);
    doc.setFont("helvetica", "bold");
    doc.text(monthNames[m - 1] || d.month, bx + barWidth / 2, plotY + plotH + 4, { align: "center" });
  });

  // Bottom axis line
  doc.setDrawColor(...C.slate400);
  doc.setLineWidth(0.15);
  doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);

  return startY + chartH;
}

// ─── Types ───────────────────────────────────────────────────────
interface PeriodItem {
  label: string;
  value: number;
  orders: number;
  faturado?: number;
  aFaturar?: number;
}

interface ComparisonItem {
  label?: string;
  value: number;
  months: number;
  avg: number;
  year?: number;
  quarter?: number;
  semester?: number;
}

interface PeriodComparison {
  current: ComparisonItem | null;
  previous: ComparisonItem | null;
  best: ComparisonItem | null;
}

interface MonthlyItem {
  month: string;
  value: number;
  faturado: number;
  aFaturar: number;
  orders: number;
}

type PeriodType = "quarter" | "semester" | "annual";

// ═══════════════════════════════════════════════════════════════════
// ═══  MAIN EXPORT FUNCTION — SINGLE PAGE  ════════════════════════
// ═══════════════════════════════════════════════════════════════════
export async function generatePeriodPDF(
  type: PeriodType,
  periodData: PeriodItem[],
  monthlyData: MonthlyItem[],
  comparison: PeriodComparison | null | undefined,
  grupo: string,
  chartElementId: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();  // 297mm
  const pageH = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 8;
  let y = 0;

  const now = new Date();
  const dateStr = `Gerado em ${now.toLocaleDateString("pt-BR")} as ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  // Determine accent color and title based on type
  const typeConfig = {
    quarter: { title: "Evolucao Trimestral de Vendas", accent: C.teal, accentDark: C.tealDark, accentLight: C.tealLight, barColor: C.tealBar },
    semester: { title: "Evolucao Semestral de Vendas", accent: C.violet, accentDark: C.violetDark, accentLight: C.violetLight, barColor: C.violet },
    annual: { title: "Evolucao Anual de Vendas", accent: C.emerald, accentDark: [4, 120, 87] as [number, number, number], accentLight: [209, 250, 229] as [number, number, number], barColor: C.emerald },
  };
  const config = typeConfig[type];

  const grupoLabel = grupo === "all" ? "Todos" : grupo === "importacao_revenda" ? "Revenda" : grupo === "industrializacao" ? "Industrializados" : "Materia Prima";

  // ── Top accent line ──
  doc.setFillColor(...config.accent);
  doc.rect(0, 0, pageW, 1.2, "F");
  y = 3;

  // ══════════════════════════════════════════════════════════════
  // HEADER: Logo + Title + Period
  // ══════════════════════════════════════════════════════════════
  const logoData = await getLogoBase64();
  if (logoData) {
    try {
      const logoH = 10;
      const logoW = logoH * LOGO_RATIO;
      doc.addImage(logoData, "PNG", margin, y, logoW, logoH);
    } catch { /* skip */ }
  }

  doc.setFontSize(16);
  doc.setTextColor(...C.slate900);
  doc.setFont("helvetica", "bold");
  doc.text(config.title, margin + 26, y + 5);

  doc.setFontSize(9);
  doc.setTextColor(...config.accent);
  doc.setFont("helvetica", "bold");
  doc.text("Grupo Fox", margin + 26, y + 9.5);

  // Period + Filters (right side)
  const filterParts: string[] = [grupoLabel];
  doc.setFontSize(8);
  doc.setTextColor(...C.slate700);
  doc.setFont("helvetica", "bold");
  doc.text(`Filtro: ${filterParts.join("  |  ")}`, pageW - margin, y + 5, { align: "right" });

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate400);
  doc.text(dateStr, pageW - margin, y + 9, { align: "right" });

  y += 13;

  // Separator
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageW - margin, y);
  y += 2.5;

  // ══════════════════════════════════════════════════════════════
  // KPI PRINCIPAL (compact — single row)
  // ══════════════════════════════════════════════════════════════
  const kpiTotalW = pageW - margin * 2;
  const kpiH = 18;
  const currentPeriod = comparison?.current;
  const totalValue = currentPeriod?.value || periodData.reduce((s, d) => s + d.value, 0);
  const totalFaturado = periodData.reduce((s, d) => s + (d.faturado || 0), 0);
  const totalAFaturar = periodData.reduce((s, d) => s + (d.aFaturar || 0), 0);
  const totalOrders = periodData.reduce((s, d) => s + d.orders, 0);

  drawCard(doc, margin, y, kpiTotalW, kpiH, { fill: C.slate50, topBar: config.accent });

  const kpiColW = kpiTotalW / 3;

  // ── Valor Total ──
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.slate400);
  const periodTitle = type === "quarter" ? "VALOR TOTAL DO TRIMESTRE ATUAL" : type === "semester" ? "VALOR TOTAL DO SEMESTRE ATUAL" : "VALOR TOTAL DO ANO ATUAL";
  doc.text(periodTitle, margin + 4, y + 5);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.slate900);
  doc.text(fmtCurrency(totalValue), margin + 4, y + 12);

  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate500);
  doc.text(
    `${fmtNumber(totalOrders)} pedidos  •  ${currentPeriod?.months || 0} meses`,
    margin + 4, y + 16,
  );

  // ── Faturado ──
  const fX = margin + kpiColW;
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.15);
  doc.line(fX, y + 3, fX, y + kpiH - 3);

  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.slate400);
  doc.text("FATURADO", fX + 4, y + 5);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.emerald);
  doc.text(fmtCurrency(totalFaturado), fX + 4, y + 12);

  // Progress bar
  const barOffX = 4;
  const barMaxW = kpiColW - barOffX - 8;
  doc.setFillColor(...C.slate200);
  doc.roundedRect(fX + barOffX, y + 14, barMaxW, 2, 0.8, 0.8, "F");
  const fPct = Math.min(totalFaturado / (totalValue || 1), 1);
  if (barMaxW * fPct > 0.3) {
    doc.setFillColor(...C.emerald);
    doc.roundedRect(fX + barOffX, y + 14, barMaxW * fPct, 2, 0.8, 0.8, "F");
  }
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.emerald);
  doc.text(fmtPct(totalFaturado, totalValue), fX + barOffX + barMaxW + 1.5, y + 16);

  // ── A Faturar ──
  const aX = margin + kpiColW * 2;
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.15);
  doc.line(aX, y + 3, aX, y + kpiH - 3);

  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.slate400);
  doc.text("A FATURAR", aX + 4, y + 5);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.orange);
  doc.text(fmtCurrency(totalAFaturar), aX + 4, y + 12);

  doc.setFillColor(...C.slate200);
  doc.roundedRect(aX + barOffX, y + 14, barMaxW, 2, 0.8, 0.8, "F");
  const aPct = Math.min(totalAFaturar / (totalValue || 1), 1);
  if (barMaxW * aPct > 0.3) {
    doc.setFillColor(...C.orange);
    doc.roundedRect(aX + barOffX, y + 14, barMaxW * aPct, 2, 0.8, 0.8, "F");
  }
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.orange);
  doc.text(fmtPct(totalAFaturar, totalValue), aX + barOffX + barMaxW + 1.5, y + 16);

  y += kpiH + 2;

  // ══════════════════════════════════════════════════════════════
  // AVERAGE CARDS (horizontal) + PERIOD TABLE side by side
  // ══════════════════════════════════════════════════════════════
  const sectionStartY = y;
  const miniCardH = 19;

  if (comparison) {
    const periodLabel = type === "quarter" ? "TRIMESTRE" : type === "semester" ? "SEMESTRE" : "ANO";
    const hasComparison = comparison.current || comparison.previous || comparison.best;

    if (hasComparison) {
      const hasBest = comparison.best && comparison.best.value > 0;
      const cardCount = hasBest ? 3 : 2;

      // Calculate width: leave space for period table on the right
      const tableW = periodData.length > 0 ? 120 : 0;
      const cardsAreaW = kpiTotalW - tableW - (tableW > 0 ? 4 : 0);
      const miniGap = 2.5;
      const miniCardW = (cardsAreaW - miniGap * (cardCount - 1)) / cardCount;

      // Card 1: Current
      if (comparison.current) {
        const label = type === "quarter" ? (comparison.current.label || "") : type === "semester" ? (comparison.current.label || "") : String(comparison.current.year || "");
        drawMiniCard(doc, margin, y, miniCardW, miniCardH,
          `MEDIA MENSAL - ${periodLabel} ATUAL`, `${comparison.current.months} meses`,
          fmtCurrency(comparison.current.avg),
          `ACUM. ATUAL (${label})`, fmtCurrency(comparison.current.value),
          config.accent, config.accentDark, config.accentLight,
        );
      }

      // Card 2: Previous
      if (comparison.previous) {
        const label = type === "quarter" ? (comparison.previous.label || "") : type === "semester" ? (comparison.previous.label || "") : String(comparison.previous.year || "");
        drawMiniCard(doc, margin + (miniCardH > 0 ? (cardsAreaW - miniGap * (cardCount - 1)) / cardCount + miniGap : 0), y,
          (cardsAreaW - miniGap * (cardCount - 1)) / cardCount, miniCardH,
          `MEDIA MENSAL - ${periodLabel} ANTERIOR`, `${comparison.previous.months} meses`,
          fmtCurrency(comparison.previous.avg),
          `ACUM. ANTERIOR (${label})`, fmtCurrency(comparison.previous.value),
          C.blue, C.blueDark, C.blueLight,
        );
      }

      // Card 3: Best (if exists)
      if (hasBest && comparison.best) {
        const label = type === "quarter" ? (comparison.best.label || "") : type === "semester" ? (comparison.best.label || "") : String(comparison.best.year || "");
        drawMiniCard(doc, margin + ((cardsAreaW - miniGap * (cardCount - 1)) / cardCount + miniGap) * 2, y,
          (cardsAreaW - miniGap * (cardCount - 1)) / cardCount, miniCardH,
          `MEDIA MENSAL - MELHOR ${periodLabel}`, `${comparison.best.months} meses`,
          fmtCurrency(comparison.best.avg),
          `ACUM. MELHOR (${label})`, fmtCurrency(comparison.best.value),
          C.amber, C.amberDark, C.amberLight,
        );
      }
    }
  }

  // ── RIGHT: Period Table ──
  if (periodData.length > 0) {
    const tableW = 120;
    const rightX = margin + kpiTotalW - tableW;
    const tableTitle = type === "quarter" ? "Detalhamento por Trimestre" : type === "semester" ? "Detalhamento por Semestre" : "Detalhamento por Ano";

    doc.setFontSize(7);
    doc.setTextColor(...C.slate900);
    doc.setFont("helvetica", "bold");
    doc.text(tableTitle, rightX, sectionStartY + 3);

    const tableData = periodData.map((p) => {
      let periodName = p.label;
      if (type === "quarter") {
        const parts = p.label.split("-Q");
        periodName = `${parts[1]}° Trimestre ${parts[0]}`;
      } else if (type === "semester") {
        const parts = p.label.split("-S");
        periodName = `${parts[1]}° Semestre ${parts[0]}`;
      }
      return [
        periodName,
        fmtCurrency(p.value),
        fmtCurrency(p.faturado || 0),
        fmtCurrency(p.aFaturar || 0),
        String(p.orders),
      ];
    });

    // Total row
    tableData.push([
      "TOTAL",
      fmtCurrency(periodData.reduce((s, d) => s + d.value, 0)),
      fmtCurrency(periodData.reduce((s, d) => s + (d.faturado || 0), 0)),
      fmtCurrency(periodData.reduce((s, d) => s + (d.aFaturar || 0), 0)),
      String(periodData.reduce((s, d) => s + d.orders, 0)),
    ]);

    autoTable(doc, {
      startY: sectionStartY + 5,
      margin: { left: rightX, right: margin },
      tableWidth: tableW,
      head: [["Periodo", "Valor Total", "Faturado", "A Faturar", "Pedidos"]],
      body: tableData,
      theme: "grid",
      styles: {
        lineColor: C.slate200,
        lineWidth: 0.15,
        cellPadding: 1.5,
        fontSize: 6.5,
      },
      headStyles: {
        fillColor: C.slate100,
        textColor: C.slate700,
        fontStyle: "bold",
        fontSize: 6.5,
        cellPadding: 1.5,
      },
      bodyStyles: {
        fontSize: 6.5,
        cellPadding: 1.5,
        textColor: C.slate700,
      },
      columnStyles: {
        0: { cellWidth: tableW * 0.28, fontStyle: "bold" },
        1: { halign: "right" as const, fontStyle: "bold" },
        2: { halign: "right" as const, textColor: C.emerald },
        3: { halign: "right" as const, textColor: C.orange },
        4: { halign: "right" as const, cellWidth: 14 },
      },
      didParseCell: (data: any) => {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = C.slate100;
          data.cell.styles.textColor = C.slate900;
          data.cell.styles.fontSize = 7;
        }
      },
    });

    const tableEndY = (doc as any).lastAutoTable?.finalY ?? sectionStartY + 30;
    y = Math.max(sectionStartY + miniCardH, tableEndY) + 2;
  } else {
    y = sectionStartY + miniCardH + 2;
  }

  // ══════════════════════════════════════════════════════════════
  // CHART: Monthly Evolution
  // ══════════════════════════════════════════════════════════════
  const chartTitle = type === "quarter" ? "Evolucao Mensal (Trimestres)" : type === "semester" ? "Evolucao Mensal (Semestres)" : "Evolucao Mensal (Anual)";
  doc.setFontSize(8);
  doc.setTextColor(...C.slate900);
  doc.setFont("helvetica", "bold");
  doc.text(chartTitle, margin, y + 3);

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate400);
  doc.text(grupoLabel, margin + doc.getTextWidth(chartTitle + "  ") + 4, y + 3);

  y += 5;

  // Reserve space for footer
  const footerH = 6;
  const availableChartH = pageH - y - footerH - 3;

  // Try SVG capture first
  let chartCaptured = false;
  const chartContainer = document.getElementById(chartElementId);
  if (chartContainer) {
    const svgEl = chartContainer.querySelector("svg");
    if (svgEl) {
      const imgData = await svgToImage(svgEl);
      if (imgData) {
        const imgW = pageW - margin * 2;
        const viewBox = svgEl.getAttribute("viewBox");
        let aspectRatio = 320 / 900;
        if (viewBox) {
          const parts = viewBox.split(" ").map(Number);
          if (parts[2] && parts[3]) aspectRatio = parts[3] / parts[2];
        }
        const imgH = Math.min(imgW * aspectRatio, availableChartH);
        doc.addImage(imgData, "PNG", margin, y, imgW, imgH);
        y += imgH + 1;
        chartCaptured = true;
      }
    }
  }

  // Fallback: draw chart in PDF
  if (!chartCaptured && monthlyData.length > 0) {
    const chartH = Math.max(availableChartH, 40);
    y = drawMonthlyChart(doc, monthlyData, margin, y, pageW - margin * 2, chartH, config.barColor);
    y += 1;
  }

  // ══════════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════════
  doc.setFillColor(...config.accent);
  doc.rect(0, pageH - 1.2, pageW, 1.2, "F");

  doc.setFontSize(5.5);
  doc.setTextColor(...C.slate400);
  doc.setFont("helvetica", "normal");
  doc.text(`Grupo Fox  •  ${config.title}  •  ${dateStr}  •  Manos e Fernando`, margin, pageH - 3);
  doc.text("Pagina 1 de 1", pageW - margin, pageH - 3, { align: "right" });

  // Save
  const dateForFile = now.toLocaleDateString("pt-BR").replace(/\//g, "-");
  const typeLabel = type === "quarter" ? "Trimestral" : type === "semester" ? "Semestral" : "Anual";
  const fileName = `Relatorio_${typeLabel}_Vendas_${grupoLabel}_${dateForFile}.pdf`;
  doc.save(fileName);
}
