import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png";
const LOGO_RATIO = 2.11; // 1529x725

// Cache the logo as base64
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

interface SegmentData {
  name: string;
  value: number;
  faturado: number;
  aFaturar: number;
  aFaturarAnterior?: number;
}

interface ComparisonData {
  currentMonth: Array<{ day: number; value: number; cumulative: number }>;
  currentMonthLabel?: string;
  lastMonth: Array<{ day: number; value: number; cumulative: number }>;
  lastMonthLabel?: string;
  bestMonth: Array<{ day: number; value: number; cumulative: number }>;
  bestMonthLabel?: string;
}

interface AnalyticsData {
  totalValue: number;
  totalFaturado: number;
  totalAFaturar: number;
  totalAFaturarAnterior?: number;
  totalOrders: number;
  totalClients: number;
  totalItems: number;
  ticketMedio: number;
  bySegmentKPI: SegmentData[];
  byCrmSegmentKPI?: SegmentData[];
  byDay: Array<{ day: string; value: number; orders: number }>;
}

// ─── Weekly Summary Types ────────────────────────────────────────
interface WeekSummary {
  weekNum: number;
  startDay: number;
  endDay: number;
  total: number;
  businessDays: number;
  avg: number;
  weekendSales: number;
  weekendDaysWithSales: number;
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
  rose:     [244, 63, 94] as [number, number, number],
  roseDark: [225, 29, 72] as [number, number, number],
  roseLight:[255, 228, 230] as [number, number, number],
  slate900: [15, 23, 42] as [number, number, number],
  slate700: [51, 65, 85] as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  slate400: [148, 163, 184] as [number, number, number],
  slate200: [226, 232, 240] as [number, number, number],
  slate100: [241, 245, 249] as [number, number, number],
  slate50:  [248, 250, 252] as [number, number, number],
  white:    [255, 255, 255] as [number, number, number],
  weekendBar: [203, 213, 225] as [number, number, number],
  weekendText: [248, 113, 113] as [number, number, number],
  weekendTextLight: [252, 165, 165] as [number, number, number],
};

// Week card color sets (matching the UI)
const WEEK_COLORS: Array<{
  main: [number, number, number];
  dark: [number, number, number];
  light: [number, number, number];
  bg: [number, number, number];
}> = [
  { main: C.teal, dark: C.tealDark, light: C.tealLight, bg: [240, 253, 250] },
  { main: C.blue, dark: C.blueDark, light: C.blueLight, bg: [239, 246, 255] },
  { main: C.violet, dark: C.violetDark, light: C.violetLight, bg: [245, 243, 255] },
  { main: C.amber, dark: C.amberDark, light: C.amberLight, bg: [255, 251, 235] },
  { main: C.rose, dark: C.roseDark, light: C.roseLight, bg: [255, 241, 242] },
];

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
function fmtCompactCurrency(val: number): string {
  if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `R$ ${(val / 1000).toFixed(0)}K`;
  return `R$ ${val.toFixed(0)}`;
}

// ─── Compute Weekly Summaries ────────────────────────────────────
function computeWeeklySummaries(byDay: Array<{ day: string; value: number }>): WeekSummary[] {
  if (byDay.length === 0) return [];

  // Build a map of day -> value for quick lookup
  const dayValueMap = new Map<string, number>();
  for (const d of byDay) {
    dayValueMap.set(d.day, d.value);
  }

  // Determine the month from the first day in byDay
  const firstDay = byDay[0].day;
  const [year, month] = firstDay.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = new Date().toISOString().substring(0, 10);

  // Generate all days of the month
  const allDays: Array<{ day: string; value: number }> = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    allDays.push({ day: dayStr, value: dayValueMap.get(dayStr) || 0 });
  }

  // Group into calendar weeks (Mon-Sun) like the UI does
  const weeks: WeekSummary[] = [];
  let currentWeekAll: typeof allDays = [];

  for (let i = 0; i < allDays.length; i++) {
    const d = new Date(allDays[i].day + "T12:00:00");
    const dow = d.getDay(); // 0=Sun, 1=Mon...6=Sat

    currentWeekAll.push(allDays[i]);

    // End of week = Sunday (dow===0) or last day of month
    const isLastDay = i === allDays.length - 1;
    const isEndOfWeek = dow === 0 || isLastDay;

    if (isEndOfWeek) {
      const businessDays = currentWeekAll.filter(day => {
        const dd = new Date(day.day + "T12:00:00").getDay();
        return dd >= 1 && dd <= 5;
      });
      const weekendDays = currentWeekAll.filter(day => {
        const dd = new Date(day.day + "T12:00:00").getDay();
        return dd === 0 || dd === 6;
      });
      // Total includes ALL days (business + weekend), matching the UI
      const total = currentWeekAll.reduce((s, d) => s + (d.day > todayStr ? 0 : d.value), 0);
      const weekendSales = weekendDays.reduce((s, d) => s + (d.day > todayStr ? 0 : d.value), 0);
      const weekendDaysWithSales = weekendDays.filter(d => d.day <= todayStr && d.value > 0).length;
      const activeDays = businessDays.filter(d => d.day <= todayStr && d.value > 0).length;
      const startDayNum = parseInt(currentWeekAll[0].day.split("-")[2]);
      const endDayNum = parseInt(currentWeekAll[currentWeekAll.length - 1].day.split("-")[2]);
      weeks.push({
        weekNum: weeks.length + 1,
        startDay: startDayNum,
        endDay: endDayNum,
        total,
        businessDays: businessDays.length,
        avg: activeDays > 0 ? total / activeDays : 0,
        weekendSales,
        weekendDaysWithSales,
      });
      currentWeekAll = [];
    }
  }

  return weeks;
}

// ─── SVG to Image ────────────────────────────────────────────────
async function svgToImage(svgElement: SVGSVGElement, isDark?: boolean): Promise<string | null> {
  try {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    const viewBox = svgElement.getAttribute("viewBox");
    const width = viewBox ? parseInt(viewBox.split(" ")[2]) : svgElement.clientWidth || 900;
    const height = viewBox ? parseInt(viewBox.split(" ")[3]) : svgElement.clientHeight || 320;
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // ─── Fix: Neutralize CSS animations so bars/labels render at final state ───
    // Remove @keyframes style blocks from the clone (they cause bars to start at scaleY(0))
    const styleEls = clone.querySelectorAll("style");
    styleEls.forEach(styleEl => {
      // Remove animation keyframes and classes from embedded <style>
      styleEl.textContent = (styleEl.textContent || "")
        .replace(/@keyframes\s+barGrow\s*\{[^}]*\{[^}]*\}[^}]*\{[^}]*\}\s*\}/g, "")
        .replace(/@keyframes\s+fadeInUp\s*\{[^}]*\{[^}]*\}[^}]*\{[^}]*\}\s*\}/g, "")
        .replace(/\.bar-animated\s*\{[^}]*\}/g, "")
        .replace(/\.label-animated\s*\{[^}]*\}/g, "");
    });
    // Force bar elements to their final visible state (scaleY(1), full opacity)
    clone.querySelectorAll(".bar-animated").forEach(el => {
      (el as SVGElement).classList.remove("bar-animated");
      (el as SVGElement).style.animation = "none";
      (el as SVGElement).style.transform = "scaleY(1)";
      (el as SVGElement).style.transformOrigin = "bottom";
    });
    // Force label elements to their final visible state (opacity 1, no translate)
    clone.querySelectorAll(".label-animated").forEach(el => {
      (el as SVGElement).classList.remove("label-animated");
      (el as SVGElement).style.animation = "none";
      (el as SVGElement).style.opacity = "1";
      (el as SVGElement).style.transform = "none";
    });

    // Dark-to-light color mapping for PDF export (white background)
    // Dark mode: keep gold bars as gold, but gold TEXT becomes black for readability on white PDF
    const darkBarKeep: string[] = ["#d4a017"]; // gold bars stay gold
    const darkToLight: Record<string, string> = {
      "#a08520": "#cbd5e1",    // dark weekend bars -> light gray
      "#1e293b": "#f8fafc",    // dark future bars -> light
      "#334155": "#f1f5f9",    // dark zero bars -> light
      "#475569": "#e2e8f0",    // dark stroke -> light
    };
    // Gold/amber text colors that should become BLACK for white PDF background
    const darkTextToBlack: string[] = ["#d4a017", "#fbbf24", "#f59e0b", "#d97706", "#fde68a", "#fcd34d"];

    const allElements = clone.querySelectorAll("*");
    const originalElements = svgElement.querySelectorAll("*");
    allElements.forEach((el, i) => {
      if (originalElements[i]) {
        const computed = window.getComputedStyle(originalElements[i]);
        const important = ["fill", "stroke", "stroke-width", "font-size", "font-family", "font-weight", "text-anchor", "opacity", "stroke-dasharray", "stroke-linecap", "stroke-linejoin"];
        important.forEach(prop => {
          let val = computed.getPropertyValue(prop);
          if (val) {
            // If in dark mode, remap colors for white-background PDF
            if (isDark && (prop === "fill" || prop === "stroke")) {
              const hex = rgbToHex(val);
              const isTextEl = el.tagName === "text" || el.tagName === "tspan";
              if (isTextEl && prop === "fill") {
                // ALL text in dark mode PDF becomes pure black for maximum readability
                val = "#000000";
              } else if (hex && !isTextEl && darkBarKeep.includes(hex)) {
                // Gold BARS stay gold (no change)
              } else if (hex && darkToLight[hex]) {
                val = darkToLight[hex];
              } else if (hex && isVeryDark(hex)) {
                // Very dark backgrounds (slate-700, slate-800, slate-900, slate-950) -> transparent/white
                val = prop === "fill" ? "#ffffff" : "#e2e8f0";
              } else if (hex && isVeryLight(hex) && !isTextEl) {
                // Light non-text elements -> keep as is or lighten
                val = prop === "stroke" ? "#e2e8f0" : val;
              }
            }
            (el as HTMLElement).style.setProperty(prop, val);
          }
        });
      }
    });
    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = 2;
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

// Helper: convert rgb(r,g,b) or hex string to lowercase hex
function rgbToHex(color: string): string | null {
  if (color.startsWith("#")) return color.toLowerCase();
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return null;
  const r = parseInt(match[1]), g = parseInt(match[2]), b = parseInt(match[3]);
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

// Helper: check if a hex color is very dark (for backgrounds that should become white)
function isVeryDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r + g + b) / 3 < 60; // average brightness < 60 = very dark
}

// Helper: check if a hex color is very light (text that needs to become dark for PDF)
function isVeryLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r + g + b) / 3 > 180; // average brightness > 180 = very light
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

// ─── Draw compact KPI card (for daily averages) ──────────────────
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

// ─── Draw Weekly Summary Card ────────────────────────────────────
function drawWeekCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  week: WeekSummary,
  colors: { main: [number, number, number]; dark: [number, number, number]; light: [number, number, number]; bg: [number, number, number] },
) {
  // Card background
  doc.setFillColor(...colors.bg);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "F");
  doc.setDrawColor(...colors.light);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "S");

  // Top accent bar (thicker like UI)
  doc.setFillColor(...colors.main);
  doc.rect(x + 0.3, y, w - 0.6, 1.2, "F");

  // Row 1: SEMANA N + Dias X-Y (y + 4.5)
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.main);
  doc.text(`SEMANA ${week.weekNum}`, x + 2, y + 4.5);

  doc.setFontSize(4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate400);
  doc.text(`Dias ${week.startDay}–${week.endDay}`, x + w - 2, y + 4.5, { align: "right" });

  // Row 2: Big value (y + 10.5)
  if (week.total > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.dark);
    doc.text(fmtCompactCurrency(week.total), x + 2, y + 10.5);
  } else {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.slate400);
    doc.text("—", x + 2, y + 10.5);
  }

  // Row 3: média/dia (y + 14.5)
  if (week.total > 0 && week.avg > 0) {
    doc.setFontSize(4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.main);
    doc.text(`media ${fmtCurrency(week.avg)}/dia`, x + 2, y + 14.5);
  }

  // Row 3b: weekend sales (y + 16) - gold color
  if (week.weekendSales > 0 && week.weekendDaysWithSales > 0) {
    doc.setFontSize(3.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 130, 0); // gold/amber color
    const plural = week.weekendDaysWithSales > 1 ? "dias nao uteis" : "dia nao util";
    doc.text(`+${fmtCompactCurrency(week.weekendSales)} em ${week.weekendDaysWithSales} ${plural}`, x + 2, y + 16.5);
  }

  // Row 4: dias úteis (bottom - well separated)
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.1);
  doc.line(x + 2, y + h - 4.5, x + w - 2, y + h - 4.5);
  doc.setFontSize(3.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate400);
  doc.text(`${week.businessDays} dias uteis`, x + 2, y + h - 1.5);
}

// ─── Draw Bar+Line Chart (compact) ──────────────────────────────
function drawChartInPdf(
  doc: jsPDF,
  data: Array<{ day: string; value: number }>,
  comparison: ComparisonData | null | undefined,
  startX: number, startY: number,
  chartW: number, chartH: number,
  isDark?: boolean,
): number {
  if (data.length === 0) return startY;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barCount = data.length;

  const leftAxisW = 18;
  const rightAxisW = comparison ? 18 : 4;
  const bottomAxisH = 10;
  const topPad = 4;

  const plotX = startX + leftAxisW;
  const plotY = startY + topPad;
  const plotW = chartW - leftAxisW - rightAxisW;
  const plotH = chartH - bottomAxisH - topPad;

  const barWidth = Math.min(6, plotW / barCount * 0.6);
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

  // Right axis labels (cumulative)
  const showLines = !!comparison && comparison.currentMonth && comparison.currentMonth.length > 0;
  let maxCumulative = 1;
  if (showLines) {
    const allCum = [
      ...(comparison!.currentMonth?.map(d => d.cumulative) || []),
      ...(comparison!.lastMonth?.map(d => d.cumulative) || []),
      ...(comparison!.bestMonth?.map(d => d.cumulative) || []),
    ];
    const realMax = Math.max(...allCum, 1);
    maxCumulative = Math.ceil(realMax / 500000) * 500000 || 500000;
    for (let i = 0; i <= 4; i++) {
      const pct = i / 4;
      const gy = plotY + plotH - pct * plotH;
      const val = maxCumulative * pct;
      doc.setFontSize(5);
      doc.setTextColor(...C.slate400);
      doc.setFont("helvetica", "normal");
      doc.text(fmtCompact(val), plotX + plotW + 2, gy + 1);
    }
  }

  const isWeekend = (dayStr: string) => {
    const d = new Date(dayStr + "T12:00:00");
    return d.getDay() === 0 || d.getDay() === 6;
  };
  const formatWeekday = (dayStr: string) => {
    const d = new Date(dayStr + "T12:00:00");
    return ["D", "S", "T", "Q", "Q", "S", "S"][d.getDay()];
  };

  // Bars
  data.forEach((d, i) => {
    const bx = plotX + i * (barWidth + barGap);
    const barH = d.value > 0 ? Math.max((d.value / maxVal) * plotH, 0.5) : 0.3;
    const by = plotY + plotH - barH;
    const weekend = isWeekend(d.day);

    doc.setFillColor(...(weekend ? C.weekendBar : isDark ? [212, 160, 23] as [number, number, number] : C.tealBar));
    doc.rect(bx, by, barWidth, barH, "F");

    // Only show value labels if there's enough space (skip if too many bars)
    if (d.value > 0 && barCount <= 20) {
      doc.setFontSize(4.5);
      doc.setTextColor(...C.slate900);
      doc.setFont("helvetica", "bold");
      doc.text(fmtCompact(d.value), bx + barWidth / 2, by - 1.5, { align: "center" });
    }

    const dayNum = d.day.split("-")[2];
    doc.setFontSize(4.5);
    doc.setTextColor(...(weekend ? C.weekendText : C.slate500));
    doc.setFont("helvetica", "bold");
    doc.text(dayNum, bx + barWidth / 2, plotY + plotH + 4, { align: "center" });
    if (barCount <= 20) {
      doc.setFontSize(4);
      doc.setTextColor(...(weekend ? C.weekendTextLight : C.slate400));
      doc.setFont("helvetica", "normal");
      doc.text(formatWeekday(d.day), bx + barWidth / 2, plotY + plotH + 7.5, { align: "center" });
    }
  });

  // Bottom axis line
  doc.setDrawColor(...C.slate400);
  doc.setLineWidth(0.15);
  doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);

  // Cumulative lines
  if (showLines) {
    const buildLinePoints = (lineData: Array<{ day: number; cumulative: number }>) =>
      lineData.map(d => ({
        x: plotX + ((d.day - 1) / Math.max(barCount - 1, 1)) * plotW,
        y: plotY + plotH - (d.cumulative / maxCumulative) * plotH,
      }));

    const drawLine = (points: Array<{ x: number; y: number }>, color: [number, number, number], width: number, dashed: boolean) => {
      if (points.length < 2) return;
      doc.setDrawColor(...color);
      doc.setLineWidth(width);
      for (let i = 1; i < points.length; i++) {
        if (dashed) {
          const dx = points[i].x - points[i - 1].x;
          const dy = points[i].y - points[i - 1].y;
          const len = Math.sqrt(dx * dx + dy * dy);
          let drawn = 0;
          while (drawn < len) {
            const startPct = drawn / len;
            const endPct = Math.min((drawn + 1.5) / len, 1);
            doc.line(
              points[i - 1].x + dx * startPct, points[i - 1].y + dy * startPct,
              points[i - 1].x + dx * endPct, points[i - 1].y + dy * endPct,
            );
            drawn += 3;
          }
        } else {
          doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
        }
      }
    };

    if (comparison!.bestMonth && comparison!.bestMonth.length > 0) {
      drawLine(buildLinePoints(comparison!.bestMonth), C.amber, 0.4, true);
    }
    if (comparison!.lastMonth && comparison!.lastMonth.length > 0) {
      drawLine(buildLinePoints(comparison!.lastMonth), C.blue, 0.5, false);
    }
    if (comparison!.currentMonth && comparison!.currentMonth.length > 0) {
      const pts = buildLinePoints(comparison!.currentMonth);
      drawLine(pts, C.teal, 0.7, false);
      const lastPt = pts[pts.length - 1];
      doc.setFillColor(...C.teal);
      doc.circle(lastPt.x, lastPt.y, 1, "F");
      doc.setFillColor(...C.white);
      doc.circle(lastPt.x, lastPt.y, 0.4, "F");
    }

    // Today marker
    const todayDay = new Date().getDate();
    if (todayDay <= barCount) {
      const todayX = plotX + (todayDay - 1) * (barWidth + barGap) + barWidth / 2;
      doc.setDrawColor(...C.teal);
      doc.setLineWidth(0.2);
      let dashY = plotY;
      while (dashY < plotY + plotH) {
        const end = Math.min(dashY + 1.5, plotY + plotH);
        doc.line(todayX, dashY, todayX, end);
        dashY = end + 1;
      }
    }
  }

  return startY + chartH;
}

// ─── Chart Legend (inline, compact) ──────────────────────────────
function drawChartLegend(
  doc: jsPDF,
  comparison: ComparisonData | null | undefined,
  x: number, y: number,
): number {
  if (!comparison) return y;

  let curX = x;
  const lineY = y + 1.5;
  const textY = y + 2.5;
  const lineLen = 6;
  const gap = 4;

  if (comparison.currentMonth && comparison.currentMonth.length > 0) {
    doc.setDrawColor(...C.teal);
    doc.setLineWidth(0.7);
    doc.line(curX, lineY, curX + lineLen, lineY);
    curX += lineLen + 1.5;
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.teal);
    const lbl = `Atual (${comparison.currentMonthLabel || ""})`;
    doc.text(lbl, curX, textY);
    curX += doc.getTextWidth(lbl) + 1.5;
    const last = comparison.currentMonth[comparison.currentMonth.length - 1];
    if (last) {
      doc.text(fmtCurrency(last.cumulative), curX, textY);
      curX += doc.getTextWidth(fmtCurrency(last.cumulative));
    }
    curX += gap;
  }

  if (comparison.lastMonth && comparison.lastMonth.length > 0) {
    doc.setDrawColor(...C.blue);
    doc.setLineWidth(0.7);
    doc.line(curX, lineY, curX + lineLen, lineY);
    curX += lineLen + 1.5;
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.blue);
    const lbl = `Anterior (${comparison.lastMonthLabel || ""})`;
    doc.text(lbl, curX, textY);
    curX += doc.getTextWidth(lbl) + 1.5;
    const last = comparison.lastMonth[comparison.lastMonth.length - 1];
    if (last) {
      doc.text(fmtCurrency(last.cumulative), curX, textY);
      curX += doc.getTextWidth(fmtCurrency(last.cumulative));
    }
    curX += gap;
  }

  if (comparison.bestMonth && comparison.bestMonth.length > 0) {
    doc.setDrawColor(...C.amber);
    doc.setLineWidth(0.7);
    let dx = curX;
    while (dx < curX + lineLen) {
      const end = Math.min(dx + 1.2, curX + lineLen);
      doc.line(dx, lineY, end, lineY);
      dx = end + 0.8;
    }
    curX += lineLen + 1.5;
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.amber);
    const lbl = `Melhor (${comparison.bestMonthLabel || ""})`;
    doc.text(lbl, curX, textY);
    curX += doc.getTextWidth(lbl) + 1.5;
    const last = comparison.bestMonth[comparison.bestMonth.length - 1];
    if (last) {
      doc.text(fmtCurrency(last.cumulative), curX, textY);
    }
  }

  return y + 5;
}

// ═══════════════════════════════════════════════════════════════════
// ═══  MAIN EXPORT FUNCTION — SINGLE PAGE  ════════════════════════
// ═══════════════════════════════════════════════════════════════════
export async function generateSalesPDF(
  analytics: AnalyticsData,
  periodLabel: string,
  grupo: string,
  crmSegmento: string,
  chartElementId: string,
  comparison?: ComparisonData | null,
  period?: string,
  isDark?: boolean,
): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();  // 297mm
  const pageH = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 8;
  let y = 0;

  const now = new Date();
  const dateStr = `Gerado em ${now.toLocaleDateString("pt-BR")} as ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  // Compute weekly summaries if applicable
  const showWeekly = (period === "current_month" || period === "last_month") && analytics.byDay.length > 0;
  const weeks = showWeekly ? computeWeeklySummaries(analytics.byDay) : [];

  // ── Top accent line ──
  doc.setFillColor(...C.teal);
  doc.rect(0, 0, pageW, 1.2, "F");
  y = 3;

  // ══════════════════════════════════════════════════════════════
  // HEADER: Logo + Title + Period (compact)
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
  doc.text("Relatorio de Vendas", margin + 26, y + 5);

  doc.setFontSize(9);
  doc.setTextColor(...C.teal);
  doc.setFont("helvetica", "bold");
  doc.text("Grupo Fox", margin + 26, y + 9.5);

  // Period + Filters (right side)
  const filterParts: string[] = [periodLabel];
  if (grupo && grupo !== "all") filterParts.push(`Grupo: ${grupo}`);
  if (crmSegmento && crmSegmento !== "all") filterParts.push(`CRM: ${crmSegmento}`);

  doc.setFontSize(8);
  doc.setTextColor(...C.slate700);
  doc.setFont("helvetica", "bold");
  doc.text(filterParts.join("  |  "), pageW - margin, y + 5, { align: "right" });

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

  drawCard(doc, margin, y, kpiTotalW, kpiH, { fill: C.slate50, topBar: C.teal });

  const kpiColW = kpiTotalW / 3;

  // ── Valor Total ──
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.slate400);
  doc.text("VALOR TOTAL DO PERIODO", margin + 4, y + 5);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.slate900);
  doc.text(fmtCurrency(analytics.totalValue), margin + 4, y + 12);

  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate500);
  doc.text(
    `${fmtNumber(analytics.totalOrders)} pedidos  •  ${fmtNumber(analytics.totalClients)} clientes  •  Ticket: ${fmtCurrency(analytics.ticketMedio)}`,
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
  doc.text(fmtCurrency(analytics.totalFaturado), fX + 4, y + 12);

  // Progress bar
  const barOffX = 4;
  const barMaxW = kpiColW - barOffX - 8;
  doc.setFillColor(...C.slate200);
  doc.roundedRect(fX + barOffX, y + 14, barMaxW, 2, 0.8, 0.8, "F");
  const fPct = Math.min(analytics.totalFaturado / (analytics.totalValue || 1), 1);
  if (barMaxW * fPct > 0.3) {
    doc.setFillColor(...C.emerald);
    doc.roundedRect(fX + barOffX, y + 14, barMaxW * fPct, 2, 0.8, 0.8, "F");
  }
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.emerald);
  doc.text(fmtPct(analytics.totalFaturado, analytics.totalValue), fX + barOffX + barMaxW + 1.5, y + 16);

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
  doc.text(fmtCurrency(analytics.totalAFaturar), aX + 4, y + 12);

  doc.setFillColor(...C.slate200);
  doc.roundedRect(aX + barOffX, y + 14, barMaxW, 2, 0.8, 0.8, "F");
  const aPct = Math.min(analytics.totalAFaturar / (analytics.totalValue || 1), 1);
  if (barMaxW * aPct > 0.3) {
    doc.setFillColor(...C.orange);
    doc.roundedRect(aX + barOffX, y + 14, barMaxW * aPct, 2, 0.8, 0.8, "F");
  }
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.orange);
  doc.text(fmtPct(analytics.totalAFaturar, analytics.totalValue), aX + barOffX + barMaxW + 1.5, y + 16);

  y += kpiH + 2;

  // ══════════════════════════════════════════════════════════════
  // DAILY AVERAGE CARDS (horizontal) + SEGMENT TABLE side by side
  // ══════════════════════════════════════════════════════════════
  const hasComparison = comparison && comparison.currentMonth && comparison.currentMonth.length > 0;
  const showCrm = grupo !== "all" && (analytics.byCrmSegmentKPI || []).length > 0;
  const segments = showCrm ? (analytics.byCrmSegmentKPI || []) : (analytics.bySegmentKPI || []);

  const sectionStartY = y;
  const miniCardH = 19;

  // ── LEFT: Daily Average Cards SIDE BY SIDE (horizontal row) ──
  if (hasComparison) {
    const todayDay = new Date().getDate();
    const currentTotal = comparison!.currentMonth?.[comparison!.currentMonth.length - 1]?.cumulative ?? 0;
    const currentDays = todayDay;
    const currentAvg = currentDays > 0 ? currentTotal / currentDays : 0;

    const lastTotal = comparison!.lastMonth?.[comparison!.lastMonth.length - 1]?.cumulative ?? 0;
    const lastDays = comparison!.lastMonth?.length ?? 0;
    const lastAvg = lastDays > 0 ? lastTotal / lastDays : 0;

    const bestTotal = comparison!.bestMonth?.[comparison!.bestMonth.length - 1]?.cumulative ?? 0;
    const bestDays = comparison!.bestMonth?.length ?? 0;
    const bestAvg = bestDays > 0 ? bestTotal / bestDays : 0;

    const hasBest = comparison!.bestMonth && comparison!.bestMonth.length > 0;
    const cardCount = hasBest ? 3 : 2;

    // Calculate width: leave space for segment table on the right
    const segTableW = segments.length > 0 ? 120 : 0;
    const cardsAreaW = kpiTotalW - segTableW - (segTableW > 0 ? 4 : 0);
    const miniGap = 2.5;
    const miniCardW = (cardsAreaW - miniGap * (cardCount - 1)) / cardCount;

    // Card 1: Mês Atual
    drawMiniCard(doc, margin, y, miniCardW, miniCardH,
      "MEDIA DIARIA - MES ATUAL", `${currentDays} dias`,
      fmtCurrency(currentAvg),
      `Acum. (${comparison!.currentMonthLabel || ""})`, fmtCurrency(currentTotal),
      C.teal, C.tealDark, C.tealLight,
    );

    // Card 2: Mês Anterior
    drawMiniCard(doc, margin + miniCardW + miniGap, y, miniCardW, miniCardH,
      "MEDIA DIARIA - MES ANTERIOR", `${lastDays} dias`,
      fmtCurrency(lastAvg),
      `Anterior (${comparison!.lastMonthLabel || ""})`, fmtCurrency(lastTotal),
      C.blue, C.blueDark, C.blueLight,
    );

    // Card 3: Melhor Mês (if exists)
    if (hasBest) {
      drawMiniCard(doc, margin + (miniCardW + miniGap) * 2, y, miniCardW, miniCardH,
        "MEDIA DIARIA - MELHOR MES", `${bestDays} dias`,
        fmtCurrency(bestAvg),
        `Melhor (${comparison!.bestMonthLabel || ""})`, fmtCurrency(bestTotal),
        C.amber, C.amberDark, C.amberLight,
      );
    }
  }

  // ── RIGHT: Segment Table (beside the mini cards) ──
  if (segments.length > 0) {
    const segTableW = 120;
    const rightX = margin + kpiTotalW - segTableW;
    const tableTitle = showCrm ? "Detalhamento por CRM" : "Detalhamento por Segmento";
    const colLabel = showCrm ? "Segmento CRM" : "Segmento";

    doc.setFontSize(7);
    doc.setTextColor(...C.slate900);
    doc.setFont("helvetica", "bold");
    doc.text(tableTitle, rightX, sectionStartY + 3);

    const tableData = segments
      .sort((a, b) => b.value - a.value)
      .map((s) => [
        s.name || "Sem segmento",
        fmtCurrency(s.value),
        fmtCurrency(s.faturado),
        fmtCurrency(s.aFaturar),
        fmtPct(s.value, analytics.totalValue),
      ]);

    tableData.push([
      "TOTAL",
      fmtCurrency(analytics.totalValue),
      fmtCurrency(analytics.totalFaturado),
      fmtCurrency(analytics.totalAFaturar),
      "100%",
    ]);

    autoTable(doc, {
      startY: sectionStartY + 5,
      margin: { left: rightX, right: margin },
      tableWidth: segTableW,
      head: [[colLabel, "Valor Total", "Faturado", "A Faturar", "%"]],
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
        0: { cellWidth: segTableW * 0.30, fontStyle: "bold" },
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
  // CHART: Evolução Diária
  // ══════════════════════════════════════════════════════════════
  doc.setFontSize(8);
  doc.setTextColor(...C.slate900);
  doc.setFont("helvetica", "bold");
  doc.text("Evolucao Diaria de Vendas", margin, y + 3);

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate400);
  doc.text(periodLabel, margin + doc.getTextWidth("Evolucao Diaria de Vendas  ") + 4, y + 3);

  y += 5;

  // Legend
  if (hasComparison) {
    y = drawChartLegend(doc, comparison, margin, y);
  }

  // Reserve space for weekly cards below chart
  const footerH = 6;
  const weeklyCardH = weeks.length > 0 ? 20 : 0; // 18 card + 2 gap
  const availableChartH = pageH - y - footerH - weeklyCardH - 3;

  // Try SVG capture first
  let chartCaptured = false;
  const chartContainer = document.getElementById(chartElementId);
  if (chartContainer) {
    const svgEl = chartContainer.querySelector("svg");
    if (svgEl) {
      const imgData = await svgToImage(svgEl, isDark);
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
  if (!chartCaptured && analytics.byDay.length > 0) {
    const chartH = Math.max(availableChartH, 40);
    y = drawChartInPdf(doc, analytics.byDay, comparison, margin, y, pageW - margin * 2, chartH, isDark);
    y += 1;
  }

  // ══════════════════════════════════════════════════════════════
  // WEEKLY SUMMARY CARDS (below chart, aligned with weeks)
  // ══════════════════════════════════════════════════════════════
  if (weeks.length > 0) {
    const weekCardH = 22;
    const weekGap = weeks.length > 4 ? 1.5 : 2.5;
    const weekCardW = (kpiTotalW - weekGap * (weeks.length - 1)) / weeks.length;

    for (let i = 0; i < weeks.length; i++) {
      const wx = margin + i * (weekCardW + weekGap);
      const colors = WEEK_COLORS[i % WEEK_COLORS.length];
      drawWeekCard(doc, wx, y, weekCardW, weekCardH, weeks[i], colors);
    }

    y += weekCardH + 1;
  }

  // ══════════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════════
  // Bottom accent line
  doc.setFillColor(...C.teal);
  doc.rect(0, pageH - 1.2, pageW, 1.2, "F");

  doc.setFontSize(5.5);
  doc.setTextColor(...C.slate400);
  doc.setFont("helvetica", "normal");
  doc.text(`Grupo Fox  •  Relatorio de Vendas  •  ${dateStr}`, margin, pageH - 3);
  doc.text("Pagina 1 de 1", pageW - margin, pageH - 3, { align: "right" });

  // Save
  const dateForFile = now.toLocaleDateString("pt-BR").replace(/\//g, "-");
  const fileName = `Relatorio de Vendas Grupo FOX ${dateForFile}.pdf`;
  doc.save(fileName);
}
