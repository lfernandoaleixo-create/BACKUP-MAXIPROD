import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { importSuppliers, importPayments } from "../drizzle/schema";
import { asc } from "drizzle-orm";

// Helper: format monetary value with currency symbol
const formatMoney = (val: string | null | undefined, symbol: string, rate: number): string => {
  if (!val || val === "0" || val === "0.00") return "-";
  const num = parseFloat(val);
  if (isNaN(num) || num === 0) return "-";
  const converted = num * rate;
  return `${symbol} ${converted.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Generates a PDF report of all import suppliers and payments.
 * Layout matches the frontend table EXACTLY:
 * 
 * Columns:
 * Status | Pedido | Doc | [Total a pagar: Total | Brasil | Paraguai] | [O que pagou: Brasil | Paraguai | Total] | [O que falta pagar: Brasil | Paraguai | Total] | Rastreio
 * 
 * GET /api/import/export-pdf
 */
export async function importPdfExportHandler(req: Request, res: Response) {
  try {
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const suppliers = await db.select().from(importSuppliers).orderBy(asc(importSuppliers.displayOrder));
    const payments = await db.select().from(importPayments).orderBy(asc(importPayments.id));

    // Group payments by supplier
    const suppliersWithPayments = suppliers.map((supplier) => ({
      ...supplier,
      payments: payments.filter((p) => p.supplierId === supplier.id),
    }));

    // Create PDF document - landscape for wide tables
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 40, bottom: 40, left: 25, right: 25 },
    });

    // Currency configuration from query params
    const currency = (req.query.currency as string || "USD").toUpperCase() as "USD" | "BRL";
    const exchangeRate = parseFloat(req.query.rate as string) || 5.50;
    const conversionRate = currency === "BRL" ? exchangeRate : 1;
    const currencySymbol = currency === "USD" ? "$" : "R$";
    const currencyLabel = currency === "USD" ? "D\u00F3lar (USD)" : "Real (BRL)";

    // Set response headers for PDF download
    const dateStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    const filename = `Importacao_Grupo_Fox_${dateStr}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // ===== COLUMN DEFINITIONS (matching frontend exactly) =====
    // Frontend columns: Status | Pedido | Doc | [Total a pagar: Total | Brasil | Paraguai] | [O que pagou: Brasil | Paraguai | Total] | [O que falta pagar: Brasil | Paraguai | Total] | Rastreio
    const columns = [
      { key: "status", label: "Status", width: 88, group: "info" },
      { key: "pedido", label: "Pedido", width: 62, group: "info" },
      { key: "doc", label: "Doc", width: 26, group: "info" },
      // Blue section: Total a pagar
      { key: "totalUsd", label: "Total", width: 58, group: "blue" },
      { key: "totalBrasilUsd", label: "Brasil", width: 55, group: "blue" },
      { key: "totalParaguaiUsd", label: "Paraguai", width: 55, group: "blue" },
      // Green section: O que pagou
      { key: "brasilUsd", label: "Brasil", width: 55, group: "green" },
      { key: "paraguaiUsd", label: "Paraguai", width: 55, group: "green" },
      { key: "totalPago", label: "Total", width: 55, group: "green" },
      // Red section: O que falta pagar
      { key: "saldoDevedorBrasil", label: "Brasil", width: 55, group: "red" },
      { key: "saldoDevedorParaguai", label: "Paraguai", width: 55, group: "red" },
      { key: "saldoDevedorTotal", label: "Total", width: 55, group: "red" },
      // Rastreio
      { key: "rastreio", label: "Rastreio", width: 78, group: "info" },
    ];

    const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tableStartX = doc.page.margins.left + (pageWidth - tableWidth) / 2;

    // ===== HEADER =====
    doc.fontSize(14).font("Helvetica-Bold").text("GRUPO FOX - Rela\u00E7\u00E3o de Pagamentos com Fornecedores", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(8).font("Helvetica").text(`Exportado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, { align: "center" });
    doc.moveDown(0.2);
    // Currency indicator
    doc.fontSize(9).font("Helvetica-Bold");
    const currencyColor = currency === "USD" ? "#1e40af" : "#166534";
    doc.fillColor(currencyColor).text(`Valores em: ${currencyLabel}${currency === "BRL" ? ` (cota\u00E7\u00E3o: 1 USD = R$ ${exchangeRate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})` : ""}`, { align: "center" });
    doc.fillColor("#1a1a1a");
    doc.moveDown(0.8);

    // Helper: draw a data row with column-specific background colors
    const drawRow = (y: number, values: string[], options?: { bold?: boolean; bg?: string; fontSize?: number; isTotal?: boolean }): number => {
      const fontSize = options?.fontSize || 6.5;
      const rowHeight = 15;

      // Draw full row background if specified
      if (options?.bg) {
        doc.save();
        doc.rect(tableStartX, y, tableWidth, rowHeight).fill(options.bg);
        doc.restore();
      }

      // Draw column-group backgrounds for data rows (subtle tint)
      if (!options?.isTotal && !options?.bg) {
        doc.save();
        let x = tableStartX;
        columns.forEach((col) => {
          if (col.group === "blue") {
            doc.rect(x, y, col.width, rowHeight).fill("#eff6ff"); // very light blue
          } else if (col.group === "green") {
            doc.rect(x, y, col.width, rowHeight).fill("#f0fdf4"); // very light green
          } else if (col.group === "red") {
            doc.rect(x, y, col.width, rowHeight).fill("#fef2f2"); // very light red
          }
          x += col.width;
        });
        doc.restore();
      }

      doc.fontSize(fontSize).font(options?.bold ? "Helvetica-Bold" : "Helvetica");

      let x = tableStartX;
      columns.forEach((col, i) => {
        const text = values[i] || "";
        // Determine text color based on group for totals row
        let textColor = "#1a1a1a";
        if (options?.isTotal) {
          if (col.group === "blue") textColor = "#1e40af";
          else if (col.group === "green") textColor = "#166534";
          else if (col.group === "red") textColor = "#991b1b";
        }
        doc.fillColor(textColor).text(text, x + 2, y + 4, {
          width: col.width - 4,
          height: rowHeight - 4,
          ellipsis: true,
          lineBreak: false,
        });
        x += col.width;
      });

      // Draw subtle grid lines
      doc.save();
      doc.strokeColor("#e5e7eb").lineWidth(0.3);
      doc.moveTo(tableStartX, y + rowHeight).lineTo(tableStartX + tableWidth, y + rowHeight).stroke();
      doc.restore();

      return rowHeight;
    };

    // Helper: draw table header (2 rows: group headers + column headers)
    const drawTableHeader = (y: number): number => {
      const groupHeaderHeight = 13;
      const colHeaderHeight = 13;

      // ===== ROW 1: Group headers (colored bands) =====
      doc.save();
      let x = tableStartX;

      // Info columns (Status, Pedido, Doc) - no group header, just blank
      const infoWidth = columns.filter(c => c.group === "info" && columns.indexOf(c) < 3).reduce((s, c) => s + c.width, 0);
      x += infoWidth;

      // BLUE: "Total a pagar"
      const blueWidth = columns.filter(c => c.group === "blue").reduce((s, c) => s + c.width, 0);
      doc.rect(x, y, blueWidth, groupHeaderHeight).fill("#dbeafe");
      doc.fillColor("#1e40af").fontSize(6.5).font("Helvetica-Bold")
        .text("Total a pagar", x, y + 3.5, { width: blueWidth, align: "center" });
      x += blueWidth;

      // GREEN: "O que pagou"
      const greenWidth = columns.filter(c => c.group === "green").reduce((s, c) => s + c.width, 0);
      doc.rect(x, y, greenWidth, groupHeaderHeight).fill("#dcfce7");
      doc.fillColor("#166534").fontSize(6.5).font("Helvetica-Bold")
        .text("O que pagou", x, y + 3.5, { width: greenWidth, align: "center" });
      x += greenWidth;

      // RED: "O que falta pagar"
      const redWidth = columns.filter(c => c.group === "red").reduce((s, c) => s + c.width, 0);
      doc.rect(x, y, redWidth, groupHeaderHeight).fill("#fecaca");
      doc.fillColor("#991b1b").fontSize(6.5).font("Helvetica-Bold")
        .text("O que falta pagar", x, y + 3.5, { width: redWidth, align: "center" });

      doc.restore();
      y += groupHeaderHeight;

      // ===== ROW 2: Column headers (dark background) =====
      doc.save();
      doc.rect(tableStartX, y, tableWidth, colHeaderHeight).fill("#374151");
      doc.fillColor("#ffffff").fontSize(6).font("Helvetica-Bold");
      x = tableStartX;
      columns.forEach((col) => {
        doc.text(col.label, x + 2, y + 4, { width: col.width - 4, lineBreak: false });
        x += col.width;
      });
      doc.restore();

      return groupHeaderHeight + colHeaderHeight;
    };

    // Helper: check if we need a new page
    const checkPageBreak = (currentY: number, neededHeight: number): number => {
      const maxY = doc.page.height - doc.page.margins.bottom;
      if (currentY + neededHeight > maxY) {
        doc.addPage();
        return doc.page.margins.top;
      }
      return currentY;
    };

    // ===== RENDER EACH SUPPLIER =====
    let currentY = doc.y;

    for (const supplier of suppliersWithPayments) {
      if (supplier.payments.length === 0) continue;

      // Group payments by sectionTitle
      const sectionsMap: Record<string, typeof supplier.payments> = {};
      for (const payment of supplier.payments) {
        const key = payment.sectionTitle || supplier.name;
        if (!sectionsMap[key]) sectionsMap[key] = [];
        sectionsMap[key].push(payment);
      }

      const sectionEntries = Object.entries(sectionsMap);

      for (const [sectionTitle, sectionPayments] of sectionEntries) {
        // Check if we have enough space for header + at least 2 rows
        currentY = checkPageBreak(currentY, 70);

        // Section header (dark blue bar with white text - matches frontend supplier card)
        doc.save();
        doc.rect(tableStartX, currentY, tableWidth, 18).fill("#1e40af");
        doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");

        let headerText = supplier.name;
        if (sectionEntries.length > 1 && sectionTitle !== supplier.name) {
          // Show the section subtitle with em-dash separator (matching frontend)
          const parts = sectionTitle.split(/ [\u2013\u002D] /);
          if (parts.length > 1) {
            headerText = `${parts[0]} \u2014 ${parts.slice(1).join(" - ")}`;
          } else {
            headerText = sectionTitle;
          }
        } else if (supplier.category) {
          headerText = `${supplier.name} \u2014 ${supplier.category}`;
        }

        doc.text(headerText, tableStartX + 8, currentY + 5, { width: tableWidth - 16 });
        doc.restore();
        currentY += 20;

        // Table header (group headers + column headers)
        const headerH = drawTableHeader(currentY);
        currentY += headerH;

        // Payment rows
        let totalTotalUsd = 0;
        let totalBlueBrasil = 0;
        let totalBlueParaguai = 0;
        let totalGreenBrasil = 0;
        let totalGreenParaguai = 0;
        let totalPago = 0;
        let totalSaldoBR = 0;
        let totalSaldoPY = 0;
        let totalSaldoTotal = 0;

        for (let i = 0; i < sectionPayments.length; i++) {
          currentY = checkPageBreak(currentY, 18);
          const p = sectionPayments[i];

          const values = [
            p.status,
            p.pedido,
            p.doc,
            // Blue: Total a pagar
            formatMoney(p.totalUsd, currencySymbol, conversionRate),
            formatMoney((p as any).totalBrasilUsd, currencySymbol, conversionRate),
            formatMoney((p as any).totalParaguaiUsd, currencySymbol, conversionRate),
            // Green: O que pagou
            formatMoney(p.brasilUsd, currencySymbol, conversionRate),
            formatMoney(p.paraguaiUsd, currencySymbol, conversionRate),
            formatMoney(p.totalPago, currencySymbol, conversionRate),
            // Red: O que falta pagar
            formatMoney(p.saldoDevedorBrasil, currencySymbol, conversionRate),
            formatMoney(p.saldoDevedorParaguai, currencySymbol, conversionRate),
            formatMoney(p.saldoDevedorTotal, currencySymbol, conversionRate),
            // Rastreio
            p.rastreio || "-",
          ];

          const rowH = drawRow(currentY, values, { bg: i % 2 === 0 ? undefined : "#f9fafb" });
          currentY += rowH;

          // Accumulate totals
          totalTotalUsd += parseFloat(p.totalUsd || "0");
          totalBlueBrasil += parseFloat((p as any).totalBrasilUsd || "0");
          totalBlueParaguai += parseFloat((p as any).totalParaguaiUsd || "0");
          totalGreenBrasil += parseFloat(p.brasilUsd || "0");
          totalGreenParaguai += parseFloat(p.paraguaiUsd || "0");
          totalPago += parseFloat(p.totalPago || "0");
          totalSaldoBR += parseFloat(p.saldoDevedorBrasil || "0");
          totalSaldoPY += parseFloat(p.saldoDevedorParaguai || "0");
          totalSaldoTotal += parseFloat(p.saldoDevedorTotal || "0");
        }

        // Totals row (bold, gray background, colored text per section)
        currentY = checkPageBreak(currentY, 18);
        const totalsValues = [
          "TOTAL",
          "",
          "",
          formatMoney(totalTotalUsd.toFixed(2), currencySymbol, conversionRate),
          formatMoney(totalBlueBrasil.toFixed(2), currencySymbol, conversionRate),
          formatMoney(totalBlueParaguai.toFixed(2), currencySymbol, conversionRate),
          formatMoney(totalGreenBrasil.toFixed(2), currencySymbol, conversionRate),
          formatMoney(totalGreenParaguai.toFixed(2), currencySymbol, conversionRate),
          formatMoney(totalPago.toFixed(2), currencySymbol, conversionRate),
          formatMoney(totalSaldoBR.toFixed(2), currencySymbol, conversionRate),
          formatMoney(totalSaldoPY.toFixed(2), currencySymbol, conversionRate),
          formatMoney(totalSaldoTotal.toFixed(2), currencySymbol, conversionRate),
          "",
        ];
        drawRow(currentY, totalsValues, { bold: true, bg: "#e5e7eb", fontSize: 6.5, isTotal: true });
        currentY += 18;

        // Spacing between sections
        currentY += 12;
      }
    }

    doc.end();
  } catch (error: any) {
    console.error("PDF export error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate PDF", details: error.message });
    }
  }
}
