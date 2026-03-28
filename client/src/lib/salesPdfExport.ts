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

/**
 * Convert an SVG element to a PNG data URL using a canvas.
 */
async function svgToImage(svgElement: SVGSVGElement): Promise<string | null> {
  try {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    const viewBox = svgElement.getAttribute("viewBox");
    const width = viewBox ? parseInt(viewBox.split(" ")[2]) : svgElement.clientWidth || 900;
    const height = viewBox ? parseInt(viewBox.split(" ")[3]) : svgElement.clientHeight || 320;
    
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    
    const allElements = clone.querySelectorAll("*");
    const originalElements = svgElement.querySelectorAll("*");
    allElements.forEach((el, i) => {
      if (originalElements[i]) {
        const computed = window.getComputedStyle(originalElements[i]);
        const important = ["fill", "stroke", "stroke-width", "font-size", "font-family", "font-weight", "text-anchor", "opacity", "stroke-dasharray", "stroke-linecap", "stroke-linejoin"];
        important.forEach(prop => {
          const val = computed.getPropertyValue(prop);
          if (val) {
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
        } else {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

/**
 * Draw the chart legend in the PDF (matching the on-screen legend).
 */
function drawChartLegend(
  doc: jsPDF,
  comparison: ComparisonData | null | undefined,
  x: number,
  y: number,
): number {
  if (!comparison) return y;

  const teal: [number, number, number] = [13, 148, 136];
  const blue: [number, number, number] = [37, 99, 235];
  const amber: [number, number, number] = [217, 119, 6];
  const slate700: [number, number, number] = [51, 65, 85];

  let curX = x;
  const lineY = y + 2;
  const textY = y + 3;
  const lineLen = 10;
  const gap = 8;

  // Acumulado Atual
  if (comparison.currentMonth && comparison.currentMonth.length > 0) {
    doc.setDrawColor(...teal);
    doc.setLineWidth(0.8);
    doc.line(curX, lineY, curX + lineLen, lineY);
    curX += lineLen + 2;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...teal);
    const currentLabel = `Acum. Atual (${comparison.currentMonthLabel || ""})`;
    doc.text(currentLabel, curX, textY);
    curX += doc.getTextWidth(currentLabel) + 2;
    // Show cumulative value
    const currentLast = comparison.currentMonth[comparison.currentMonth.length - 1];
    if (currentLast) {
      doc.setFont("helvetica", "bold");
      doc.text(fmtCurrency(currentLast.cumulative), curX, textY);
      curX += doc.getTextWidth(fmtCurrency(currentLast.cumulative));
    }
    curX += gap;
  }

  // Mês Anterior
  if (comparison.lastMonth && comparison.lastMonth.length > 0) {
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.8);
    doc.line(curX, lineY, curX + lineLen, lineY);
    curX += lineLen + 2;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...blue);
    const lastLabel = `Anterior (${comparison.lastMonthLabel || ""})`;
    doc.text(lastLabel, curX, textY);
    curX += doc.getTextWidth(lastLabel) + 2;
    const lastLast = comparison.lastMonth[comparison.lastMonth.length - 1];
    if (lastLast) {
      doc.setFont("helvetica", "bold");
      doc.text(fmtCurrency(lastLast.cumulative), curX, textY);
      curX += doc.getTextWidth(fmtCurrency(lastLast.cumulative));
    }
    curX += gap;
  }

  // Melhor Mês
  if (comparison.bestMonth && comparison.bestMonth.length > 0) {
    doc.setDrawColor(...amber);
    doc.setLineWidth(0.8);
    // Dashed line
    const dashLen = 1.5;
    const dashGap = 1;
    let dx = curX;
    while (dx < curX + lineLen) {
      const end = Math.min(dx + dashLen, curX + lineLen);
      doc.line(dx, lineY, end, lineY);
      dx = end + dashGap;
    }
    curX += lineLen + 2;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...amber);
    const bestLabel = `Melhor (${comparison.bestMonthLabel || ""})`;
    doc.text(bestLabel, curX, textY);
    curX += doc.getTextWidth(bestLabel) + 2;
    const bestLast = comparison.bestMonth[comparison.bestMonth.length - 1];
    if (bestLast) {
      doc.setFont("helvetica", "bold");
      doc.text(fmtCurrency(bestLast.cumulative), curX, textY);
    }
  }

  return y + 7;
}

/**
 * Draw a bar+line chart directly in the PDF using jsPDF drawing primitives.
 * Fills all available remaining space on the page.
 */
function drawChartInPdf(
  doc: jsPDF,
  data: Array<{ day: string; value: number }>,
  comparison: ComparisonData | null | undefined,
  startX: number,
  startY: number,
  chartW: number,
  chartH: number,
): number {
  if (data.length === 0) return startY;

  const teal: [number, number, number] = [13, 148, 136];
  const tealLight: [number, number, number] = [20, 184, 166];
  const blue: [number, number, number] = [37, 99, 235];
  const amber: [number, number, number] = [217, 119, 6];
  const slate400: [number, number, number] = [148, 163, 184];
  const slate200: [number, number, number] = [226, 232, 240];
  const slate500: [number, number, number] = [100, 116, 139];
  const slate700: [number, number, number] = [51, 65, 85];

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barCount = data.length;
  
  // Layout
  const leftAxisW = 22;
  const rightAxisW = comparison ? 22 : 5;
  const bottomAxisH = 14;
  const topPad = 10; // space for bar value labels above bars
  
  const plotX = startX + leftAxisW;
  const plotY = startY + topPad;
  const plotW = chartW - leftAxisW - rightAxisW;
  const plotH = chartH - bottomAxisH - topPad;

  const barWidth = Math.min(8, plotW / barCount * 0.65);
  const barGap = (plotW - barWidth * barCount) / Math.max(barCount - 1, 1);

  // Y axis grid lines (left axis - bars)
  for (let i = 0; i <= 4; i++) {
    const pct = i / 4;
    const y = plotY + plotH - pct * plotH;
    doc.setDrawColor(...slate200);
    doc.setLineWidth(0.15);
    doc.line(plotX, y, plotX + plotW, y);

    // Left axis labels
    const val = maxVal * pct;
    doc.setFontSize(6);
    doc.setTextColor(...slate400);
    doc.setFont("helvetica", "normal");
    doc.text(fmtCompact(val), plotX - 3, y + 1.5, { align: "right" });
  }

  // Right axis labels (cumulative) if comparison exists
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
      const y = plotY + plotH - pct * plotH;
      const val = maxCumulative * pct;
      doc.setFontSize(6);
      doc.setTextColor(...slate400);
      doc.setFont("helvetica", "normal");
      doc.text(fmtCompact(val), plotX + plotW + 3, y + 1.5);
    }
  }

  // Weekend detection
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
    const x = plotX + i * (barWidth + barGap);
    const barH = d.value > 0 ? Math.max((d.value / maxVal) * plotH, 1) : 0.5;
    const y = plotY + plotH - barH;
    const weekend = isWeekend(d.day);

    doc.setFillColor(...(weekend ? [203, 213, 225] as [number, number, number] : tealLight));
    doc.rect(x, y, barWidth, barH, "F");

    // Value label on top of bar
    if (d.value > 0) {
      doc.setFontSize(5);
      doc.setTextColor(...slate700);
      doc.setFont("helvetica", "bold");
      doc.text(fmtCompact(d.value), x + barWidth / 2, y - 1.5, { align: "center" });
    }

    // X axis labels
    const dayNum = d.day.split("-")[2];
    doc.setFontSize(6);
    doc.setTextColor(...(weekend ? [248, 113, 113] as [number, number, number] : slate500));
    doc.setFont("helvetica", "bold");
    doc.text(dayNum, x + barWidth / 2, plotY + plotH + 5, { align: "center" });
    
    doc.setFontSize(5);
    doc.setTextColor(...(weekend ? [252, 165, 165] as [number, number, number] : slate400));
    doc.setFont("helvetica", "normal");
    doc.text(formatWeekday(d.day), x + barWidth / 2, plotY + plotH + 10, { align: "center" });
  });

  // Bottom axis line
  doc.setDrawColor(...slate400);
  doc.setLineWidth(0.2);
  doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);

  // Cumulative lines
  if (showLines) {
    const buildLinePoints = (lineData: Array<{ day: number; cumulative: number }>) => {
      return lineData.map(d => ({
        x: plotX + ((d.day - 1) / Math.max(barCount - 1, 1)) * plotW,
        y: plotY + plotH - (d.cumulative / maxCumulative) * plotH,
      }));
    };

    const drawLine = (points: Array<{ x: number; y: number }>, color: [number, number, number], width: number, dashed: boolean) => {
      if (points.length < 2) return;
      doc.setDrawColor(...color);
      doc.setLineWidth(width);
      for (let i = 1; i < points.length; i++) {
        if (dashed) {
          // Draw dashed manually
          const dx = points[i].x - points[i - 1].x;
          const dy = points[i].y - points[i - 1].y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const dashLen = 2;
          const gapLen = 1.5;
          let drawn = 0;
          while (drawn < len) {
            const startPct = drawn / len;
            const endPct = Math.min((drawn + dashLen) / len, 1);
            doc.line(
              points[i - 1].x + dx * startPct,
              points[i - 1].y + dy * startPct,
              points[i - 1].x + dx * endPct,
              points[i - 1].y + dy * endPct,
            );
            drawn += dashLen + gapLen;
          }
        } else {
          doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
        }
      }
    };

    // Best month (dashed amber)
    if (comparison!.bestMonth && comparison!.bestMonth.length > 0) {
      const pts = buildLinePoints(comparison!.bestMonth);
      drawLine(pts, amber, 0.5, true);
    }

    // Last month (solid blue)
    if (comparison!.lastMonth && comparison!.lastMonth.length > 0) {
      const pts = buildLinePoints(comparison!.lastMonth);
      drawLine(pts, blue, 0.6, false);
    }

    // Current month (solid teal, thicker)
    if (comparison!.currentMonth && comparison!.currentMonth.length > 0) {
      const pts = buildLinePoints(comparison!.currentMonth);
      drawLine(pts, teal, 0.8, false);

      // End dot
      const lastPt = pts[pts.length - 1];
      doc.setFillColor(...teal);
      doc.circle(lastPt.x, lastPt.y, 1.2, "F");
      doc.setFillColor(255, 255, 255);
      doc.circle(lastPt.x, lastPt.y, 0.5, "F");
    }

    // Today marker (dashed vertical line)
    const todayDay = new Date().getDate();
    if (todayDay <= barCount) {
      const todayX = plotX + (todayDay - 1) * (barWidth + barGap) + barWidth / 2;
      doc.setDrawColor(...teal);
      doc.setLineWidth(0.3);
      let dashY = plotY;
      while (dashY < plotY + plotH) {
        const end = Math.min(dashY + 2, plotY + plotH);
        doc.line(todayX, dashY, todayX, end);
        dashY = end + 1.5;
      }
    }
  }

  return startY + chartH;
}

export async function generateSalesPDF(
  analytics: AnalyticsData,
  periodLabel: string,
  grupo: string,
  crmSegmento: string,
  chartElementId: string,
  comparison?: ComparisonData | null,
): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // Colors
  const teal = [13, 148, 136] as [number, number, number];
  const emerald = [5, 150, 105] as [number, number, number];
  const orange = [234, 88, 12] as [number, number, number];
  const slate700 = [51, 65, 85] as [number, number, number];
  const slate400 = [148, 163, 184] as [number, number, number];
  const slate100 = [241, 245, 249] as [number, number, number];

  // === HEADER ===
  const logoData = await getLogoBase64();
  if (logoData) {
    try {
      const logoH = 12;
      const logoW = logoH * LOGO_RATIO;
      doc.addImage(logoData, "PNG", margin, y, logoW, logoH);
    } catch {
      // Skip logo
    }
  }

  // Title
  doc.setFontSize(18);
  doc.setTextColor(...slate700);
  doc.setFont("helvetica", "bold");
  const titleText = "Relatorio de Vendas";
  doc.text(titleText, margin + 30, y + 6);
  const titleWidth = doc.getTextWidth(titleText);
  doc.setFontSize(14);
  doc.setTextColor(...teal);
  doc.text("Grupo Fox", margin + 30 + titleWidth + 3, y + 6);

  // Period and filters
  doc.setFontSize(14);
  doc.setTextColor(...slate700);
  doc.setFont("helvetica", "bold");
  const filterParts: string[] = [`Periodo: ${periodLabel}`];
  if (grupo && grupo !== "all") filterParts.push(`Grupo: ${grupo}`);
  if (crmSegmento && crmSegmento !== "all") filterParts.push(`CRM: ${crmSegmento}`);
  doc.text(filterParts.join("  |  "), margin + 30, y + 12);

  // Date
  const now = new Date();
  const dateStr = `Gerado em ${now.toLocaleDateString("pt-BR")} as ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...slate700);
  doc.text(dateStr, pageW - margin, y + 7, { align: "right" });

  y += 20;

  // === KPI PRINCIPAL ===
  doc.setFillColor(...slate100);
  doc.roundedRect(margin, y, pageW - margin * 2, 28, 3, 3, "F");

  // Teal top bar
  doc.setFillColor(...teal);
  doc.rect(margin, y, pageW - margin * 2, 1.5, "F");

  const kpiW = (pageW - margin * 2) / 3;

  // Valor Total
  doc.setFontSize(8);
  doc.setTextColor(...slate400);
  doc.setFont("helvetica", "bold");
  doc.text("VALOR TOTAL DO PERIODO", margin + 8, y + 8);
  doc.setFontSize(16);
  doc.setTextColor(...slate700);
  doc.text(fmtCurrency(analytics.totalValue), margin + 8, y + 16);
  doc.setFontSize(7);
  doc.setTextColor(...slate400);
  doc.setFont("helvetica", "normal");
  doc.text(`${fmtNumber(analytics.totalOrders)} pedidos  •  ${fmtNumber(analytics.totalClients)} clientes  •  Ticket: ${fmtCurrency(analytics.ticketMedio)}`, margin + 8, y + 22);

  // Faturado
  const fX = margin + kpiW;
  doc.setFontSize(8);
  doc.setTextColor(...slate400);
  doc.setFont("helvetica", "bold");
  doc.text("FATURADO", fX + 8, y + 8);
  doc.setFontSize(16);
  doc.setTextColor(...emerald);
  doc.text(fmtCurrency(analytics.totalFaturado), fX + 8, y + 16);
  doc.setFontSize(8);
  doc.text(fmtPct(analytics.totalFaturado, analytics.totalValue), fX + 8, y + 22);

  // Progress bar faturado - constrained within column
  const barStartOffset = 22;
  const barMaxW = kpiW - barStartOffset - 6;
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(fX + barStartOffset, y + 20, barMaxW, 3, 1, 1, "F");
  const fPct = Math.min(analytics.totalFaturado / (analytics.totalValue || 1), 1);
  doc.setFillColor(...emerald);
  if (barMaxW * fPct > 0.5) {
    doc.roundedRect(fX + barStartOffset, y + 20, barMaxW * fPct, 3, 1, 1, "F");
  }

  // A Faturar
  const aX = margin + kpiW * 2;
  doc.setFontSize(8);
  doc.setTextColor(...slate400);
  doc.setFont("helvetica", "bold");
  doc.text("A FATURAR", aX + 8, y + 8);
  doc.setFontSize(16);
  doc.setTextColor(...orange);
  doc.text(fmtCurrency(analytics.totalAFaturar), aX + 8, y + 16);
  doc.setFontSize(8);
  doc.text(fmtPct(analytics.totalAFaturar, analytics.totalValue), aX + 8, y + 22);

  // Progress bar a faturar - constrained within column
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(aX + barStartOffset, y + 20, barMaxW, 3, 1, 1, "F");
  const aPct = Math.min(analytics.totalAFaturar / (analytics.totalValue || 1), 1);
  doc.setFillColor(...orange);
  if (barMaxW * aPct > 0.5) {
    doc.roundedRect(aX + barStartOffset, y + 20, barMaxW * aPct, 3, 1, 1, "F");
  }

  y += 34;

  // === DETALHAMENTO POR SEGMENTO / CRM ===
  const showCrm = grupo !== "all" && (analytics.byCrmSegmentKPI || []).length > 0;
  const segments = showCrm ? (analytics.byCrmSegmentKPI || []) : (analytics.bySegmentKPI || []);
  const tableTitle = showCrm ? "Detalhamento por CRM" : "Detalhamento por Segmento";
  const colLabel = showCrm ? "Segmento CRM" : "Segmento";

  if (segments.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(...slate700);
    doc.setFont("helvetica", "bold");
    doc.text(tableTitle, margin, y + 4);
    y += 7;

    const tableData = segments
      .sort((a, b) => b.value - a.value)
      .map((s) => [
        s.name || "Sem segmento",
        fmtCurrency(s.value),
        fmtCurrency(s.faturado),
        fmtCurrency(s.aFaturar),
        fmtPct(s.value, analytics.totalValue),
      ]);

    // Add total row
    tableData.push([
      "TOTAL",
      fmtCurrency(analytics.totalValue),
      fmtCurrency(analytics.totalFaturado),
      fmtCurrency(analytics.totalAFaturar),
      "100%",
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[colLabel, "Valor Total", "Faturado", "A Faturar", "% Total"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: "bold",
        fontSize: 8,
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { halign: "right" as const },
        2: { halign: "right" as const, textColor: emerald },
        3: { halign: "right" as const, textColor: orange },
        4: { halign: "right" as const, cellWidth: 25 },
      },
      didParseCell: (data: any) => {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [241, 245, 249];
        }
      },
    });

    y = (doc as any).lastAutoTable?.finalY + 6;
  }

  // === GRAFICO DE EVOLUCAO DIARIA ===
  // Check if we need a new page
  if (y > pageH - 50) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(10);
  doc.setTextColor(...slate700);
  doc.setFont("helvetica", "bold");
  doc.text("Evolucao Diaria de Vendas", margin, y + 4);
  y += 7;

  // Draw legend for the comparison lines
  if (comparison && comparison.currentMonth && comparison.currentMonth.length > 0) {
    y = drawChartLegend(doc, comparison, margin, y);
  }

  // Try to capture the chart SVG from the DOM
  let chartCaptured = false;
  const chartContainer = document.getElementById(chartElementId);
  if (chartContainer) {
    const svgEl = chartContainer.querySelector("svg");
    if (svgEl) {
      const imgData = await svgToImage(svgEl);
      if (imgData) {
        const imgW = pageW - margin * 2;
        // Use ALL remaining space on the page for the chart
        const availableH = pageH - y - margin - 8; // 8mm for footer
        const viewBox = svgEl.getAttribute("viewBox");
        let aspectRatio = 320 / 900;
        if (viewBox) {
          const parts = viewBox.split(" ").map(Number);
          if (parts[2] && parts[3]) {
            aspectRatio = parts[3] / parts[2];
          }
        }
        const imgH = Math.min(imgW * aspectRatio, availableH);
        doc.addImage(imgData, "PNG", margin, y, imgW, imgH);
        y += imgH + 3;
        chartCaptured = true;
      }
    }
  }

  // Fallback: draw chart directly in PDF with lines
  if (!chartCaptured && analytics.byDay.length > 0) {
    // Use ALL remaining space on the page
    const availableH = pageH - y - margin - 8; // 8mm for footer
    const chartH = Math.max(availableH, 50);
    y = drawChartInPdf(doc, analytics.byDay, comparison, margin, y, pageW - margin * 2, chartH);
    y += 3;
  }

  // === FOOTER ===
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...slate400);
    doc.setFont("helvetica", "normal");
    doc.text(`Grupo Fox - Relatorio de Vendas | ${dateStr}`, margin, pageH - 5);
    doc.text(`Pagina ${i} de ${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
  }

  // Save
  const fileName = `vendas_grupo_fox_${now.toISOString().substring(0, 10).replace(/-/g, "")}.pdf`;
  doc.save(fileName);
}
