import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { importSuppliers, importPayments } from "../drizzle/schema";
import { asc } from "drizzle-orm";

// Helper: format monetary value
const formatMoney = (val: string | null | undefined): string => {
  if (!val || val === "0" || val === "0.00") return "-";
  const num = parseFloat(val);
  if (isNaN(num) || num === 0) return "-";
  return `$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Generates a PDF report of all import suppliers and payments.
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
      margins: { top: 40, bottom: 40, left: 30, right: 30 },
    });

    // Set response headers for PDF download
    const dateStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    const filename = `Importacao_Grupo_Fox_${dateStr}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // ===== HEADER =====
    doc.fontSize(16).font("Helvetica-Bold").text("GRUPO FOX - Relação de Pagamentos com Fornecedores", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").text(`Exportado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, { align: "center" });
    doc.moveDown(1);

    // ===== TABLE COLUMNS =====
    const columns = [
      { key: "status", label: "Status", width: 95 },
      { key: "pedido", label: "Pedido", width: 60 },
      { key: "doc", label: "Doc", width: 28 },
      { key: "totalUsd", label: "Total USD", width: 62 },
      { key: "halfValue", label: "50%", width: 55 },
      { key: "brasilUsd", label: "Brasil", width: 55 },
      { key: "paraguaiUsd", label: "Paraguai", width: 55 },
      { key: "totalPago", label: "Total Pago", width: 62 },
      { key: "saldoDevedorBrasil", label: "Saldo BR", width: 55 },
      { key: "saldoDevedorParaguai", label: "Saldo PY", width: 55 },
      { key: "saldoDevedorTotal", label: "Saldo Total", width: 62 },
      { key: "rastreio", label: "Rastreio", width: 78 },
    ];

    const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tableStartX = doc.page.margins.left + (pageWidth - tableWidth) / 2;

    // Helper: draw a row
    const drawRow = (y: number, values: string[], options?: { bold?: boolean; bg?: string; fontSize?: number }): number => {
      const fontSize = options?.fontSize || 7;
      const rowHeight = 16;

      if (options?.bg) {
        doc.save();
        doc.rect(tableStartX, y, tableWidth, rowHeight).fill(options.bg);
        doc.restore();
      }

      doc.fontSize(fontSize).font(options?.bold ? "Helvetica-Bold" : "Helvetica");

      let x = tableStartX;
      columns.forEach((col, i) => {
        const text = values[i] || "";
        doc.fillColor("#1a1a1a").text(text, x + 3, y + 4, {
          width: col.width - 6,
          height: rowHeight - 4,
          ellipsis: true,
          lineBreak: false,
        });
        x += col.width;
      });

      return rowHeight;
    };

    // Helper: draw table header
    const drawTableHeader = (y: number): number => {
      const headerHeight = 14;

      // Group headers row
      doc.save();
      let x = tableStartX;
      // Skip first 5 columns (Status, Pedido, Doc, Total USD, 50%)
      const skipWidth = columns.slice(0, 5).reduce((s, c) => s + c.width, 0);
      x += skipWidth;

      // "O que pagou" group (Brasil, Paraguai, Total Pago)
      const paidWidth = columns[5].width + columns[6].width + columns[7].width;
      doc.rect(x, y, paidWidth, headerHeight).fill("#dcfce7");
      doc.fillColor("#166534").fontSize(6.5).font("Helvetica-Bold")
        .text("O que pagou", x, y + 4, { width: paidWidth, align: "center" });
      x += paidWidth;

      // "O que falta pagar" group (Saldo BR, Saldo PY, Saldo Total)
      const oweWidth = columns[8].width + columns[9].width + columns[10].width;
      doc.rect(x, y, oweWidth, headerHeight).fill("#fecaca");
      doc.fillColor("#991b1b").fontSize(6.5).font("Helvetica-Bold")
        .text("O que falta pagar", x, y + 4, { width: oweWidth, align: "center" });

      doc.restore();
      y += headerHeight;

      // Column headers
      doc.save();
      doc.rect(tableStartX, y, tableWidth, headerHeight).fill("#374151");
      doc.fillColor("#ffffff").fontSize(6.5).font("Helvetica-Bold");
      x = tableStartX;
      columns.forEach((col) => {
        doc.text(col.label, x + 3, y + 4, { width: col.width - 6, lineBreak: false });
        x += col.width;
      });
      doc.restore();

      return headerHeight * 2;
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

        // Section header
        doc.save();
        doc.rect(tableStartX, currentY, tableWidth, 18).fill("#1e40af");
        doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");

        let headerText = supplier.name;
        if (sectionEntries.length > 1 && sectionTitle !== supplier.name) {
          // Show the section subtitle
          const parts = sectionTitle.split(" - ");
          if (parts.length > 1) {
            headerText = `${parts[0]} — ${parts.slice(1).join(" - ")}`;
          } else {
            headerText = sectionTitle;
          }
        } else if (supplier.category) {
          headerText = `${supplier.name} — ${supplier.category}`;
        }

        doc.text(headerText, tableStartX + 8, currentY + 5, { width: tableWidth - 16 });
        doc.restore();
        currentY += 20;

        // Table header
        const headerH = drawTableHeader(currentY);
        currentY += headerH;

        // Payment rows
        let totalTotalUsd = 0;
        let totalBrasil = 0;
        let totalParaguai = 0;
        let totalPago = 0;
        let totalSaldoBR = 0;
        let totalSaldoPY = 0;
        let totalSaldoTotal = 0;

        for (let i = 0; i < sectionPayments.length; i++) {
          currentY = checkPageBreak(currentY, 20);
          const p = sectionPayments[i];
          const bg = i % 2 === 0 ? "#f9fafb" : "#ffffff";

          const values = [
            p.status,
            p.pedido,
            p.doc,
            formatMoney(p.totalUsd),
            formatMoney(p.halfValue),
            formatMoney(p.brasilUsd),
            formatMoney(p.paraguaiUsd),
            formatMoney(p.totalPago),
            formatMoney(p.saldoDevedorBrasil),
            formatMoney(p.saldoDevedorParaguai),
            formatMoney(p.saldoDevedorTotal),
            p.rastreio || "-",
          ];

          const rowH = drawRow(currentY, values, { bg });
          currentY += rowH;

          // Accumulate totals
          totalTotalUsd += parseFloat(p.totalUsd || "0");
          totalBrasil += parseFloat(p.brasilUsd || "0");
          totalParaguai += parseFloat(p.paraguaiUsd || "0");
          totalPago += parseFloat(p.totalPago || "0");
          totalSaldoBR += parseFloat(p.saldoDevedorBrasil || "0");
          totalSaldoPY += parseFloat(p.saldoDevedorParaguai || "0");
          totalSaldoTotal += parseFloat(p.saldoDevedorTotal || "0");
        }

        // Totals row
        currentY = checkPageBreak(currentY, 20);
        const totalsValues = [
          "TOTAL",
          "",
          "",
          formatMoney(totalTotalUsd.toFixed(2)),
          "",
          formatMoney(totalBrasil.toFixed(2)),
          formatMoney(totalParaguai.toFixed(2)),
          formatMoney(totalPago.toFixed(2)),
          formatMoney(totalSaldoBR.toFixed(2)),
          formatMoney(totalSaldoPY.toFixed(2)),
          formatMoney(totalSaldoTotal.toFixed(2)),
          "",
        ];
        drawRow(currentY, totalsValues, { bold: true, bg: "#e5e7eb", fontSize: 7 });
        currentY += 20;

        // Spacing between sections
        currentY += 10;
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
