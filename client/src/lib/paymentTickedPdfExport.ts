/**
 * PDF Export para Contas a Pagar Ticadas pelo Fernando
 * Gera um PDF limpo com a lista de contas selecionadas para pagamento
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png";

let logoBase64Cache: string | null = null;

async function loadLogo(): Promise<string> {
  if (logoBase64Cache) return logoBase64Cache;
  try {
    const response = await fetch(LOGO_URL);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => { logoBase64Cache = reader.result as string; resolve(logoBase64Cache); };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch { return ""; }
}

export interface TickedPaymentItem {
  fornecedor: string;
  referenteA: string;
  vencimento: string; // "2026-06-01T..." or "01/06/2026"
  valor: number;
  maxiprodId?: number;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  // Handle ISO format
  if (dateStr.includes("T")) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR");
  }
  // Already formatted
  if (dateStr.includes("/")) return dateStr;
  // YYYY-MM-DD
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function generateTickedPaymentsPdf(items: TickedPaymentItem[], tickedBy: string = "Fernando"): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  // Load logo
  const logo = await loadLogo();

  // ===== HEADER =====
  let y = 12;

  // Logo
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, y, 18, 18);
    } catch {}
  }

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("CONTAS SELECIONADAS PARA PAGAMENTO", margin + 22, y + 8);

  // Subtitle with date
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc.text(`Gerado em ${today} | Selecionado por: ${tickedBy}`, margin + 22, y + 14);

  y += 24;

  // Separator line
  doc.setDrawColor(200, 160, 50);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ===== SUMMARY BOX =====
  const totalValor = items.reduce((s, i) => s + i.valor, 0);
  const totalItens = items.length;

  // Summary background
  doc.setFillColor(255, 248, 230);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, "F");

  // Summary content
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(150, 100, 0);
  doc.text("RESUMO", margin + 4, y + 6);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 60, 0);
  doc.text(`Total de contas: ${totalItens}`, margin + 4, y + 12);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 80, 0);
  doc.text(formatCurrency(totalValor), pageWidth - margin - 4, y + 10, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 80, 0);
  doc.text("Valor Total", pageWidth - margin - 4, y + 15, { align: "right" });

  y += 24;

  // ===== TABLE =====
  if (items.length > 0) {
    // Group by vencimento date
    const grouped = new Map<string, TickedPaymentItem[]>();
    for (const item of items) {
      const dateKey = formatDate(item.vencimento);
      const existing = grouped.get(dateKey) || [];
      existing.push(item);
      grouped.set(dateKey, existing);
    }

    // Sort groups by date
    const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
      const dateA = a[1][0]?.vencimento || "";
      const dateB = b[1][0]?.vencimento || "";
      return dateA.localeCompare(dateB);
    });

    // Build table data
    const tableBody: any[][] = [];
    for (const [dateKey, groupItems] of sortedGroups) {
      // Date header row
      const groupTotal = groupItems.reduce((s, i) => s + i.valor, 0);
      tableBody.push([
        { content: `📅 Vencimento: ${dateKey}  —  Subtotal: ${formatCurrency(groupTotal)}`, colSpan: 3, styles: { fillColor: [245, 240, 225], fontStyle: "bold", fontSize: 8.5, textColor: [100, 70, 0] } },
      ]);

      // Item rows
      for (const item of groupItems) {
        tableBody.push([
          item.fornecedor,
          item.referenteA || "—",
          formatCurrency(item.valor),
        ]);
      }
    }

    autoTable(doc, {
      startY: y,
      head: [["Fornecedor", "Referente", "Valor"]],
      body: tableBody,
      theme: "grid",
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        lineColor: [220, 220, 220],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [200, 150, 30],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: "bold" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 35, halign: "right", fontStyle: "bold", textColor: [180, 50, 0] },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        // Style the group header rows
        if (data.row.raw && Array.isArray(data.row.raw) && data.row.raw.length === 1) {
          // This is a group header
        }
      },
    });
  } else {
    doc.setFontSize(11);
    doc.setTextColor(150, 150, 150);
    doc.text("Nenhuma conta selecionada.", pageWidth / 2, y + 10, { align: "center" });
  }

  // ===== FOOTER =====
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Grupo Fox — Contas Selecionadas | Página ${i}/${totalPages}`, pageWidth / 2, pageHeight - 6, { align: "center" });
  }

  // Save
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  doc.save(`Contas_Selecionadas_${dateStr}.pdf`);
}
