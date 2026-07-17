import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { importSuppliers, importPos, importPoProducts } from "../drizzle/schema";
import { asc, eq, or } from "drizzle-orm";

// Helper: format monetary value
const formatMoney = (val: string | number | null | undefined, symbol: string, rate: number): string => {
  if (!val || val === "0" || val === "0.00") return "-";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num) || num === 0) return "-";
  const converted = num * rate;
  return `${symbol} ${converted.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Generates a PDF report of Custo da Mercadoria (all suppliers, POs, and products).
 * Spreadsheet-style layout with proper grid lines, full product descriptions,
 * and correct freight calculations.
 * 
 * Columns: PO | Produto | Qtd | NCM | Vlr USD | PO Cheia | PO Menor | Frete/Cx | Frete Tot | Impostos | Total BRL
 * 
 * GET /api/import/export-custo-pdf
 */
export async function custoPdfExportHandler(req: Request, res: Response) {
  try {
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const suppliers = await db.select().from(importSuppliers)
      .where(or(eq(importSuppliers.context, 'custo'), eq(importSuppliers.context, 'both')))
      .orderBy(asc(importSuppliers.displayOrder));
    const allPos = await db.select().from(importPos).orderBy(asc(importPos.id));
    const allProducts = await db.select().from(importPoProducts).orderBy(asc(importPoProducts.id));

    // Currency configuration from query params
    const currency = (req.query.currency as string || "USD").toUpperCase() as "USD" | "BRL";
    const exchangeRate = parseFloat(req.query.rate as string) || 5.50;
    const conversionRate = currency === "BRL" ? exchangeRate : 1;
    const currencySymbol = currency === "USD" ? "$" : "R$";
    const currencyLabel = currency === "USD" ? "Dólar (USD)" : "Real (BRL)";

    // Create PDF document - landscape for wide tables
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 35, bottom: 35, left: 20, right: 20 },
    });

    // Set response headers
    const dateStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    const filename = `Custo_Mercadoria_${dateStr}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Page dimensions
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tableLeft = doc.page.margins.left;

    // Column definitions - optimized widths for landscape A4
    // Total available: ~802px (A4 landscape minus margins)
    const colWidths = [42, 195, 35, 62, 58, 58, 58, 62, 62, 58, 62];
    const headers = ["PO", "Produto", "Qtd", "NCM", "Vlr USD", "PO Cheia", "PO Menor", "Frete/Cx", "Frete Tot", "Impostos", "Total BRL"];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const ROW_HEIGHT = 14;
    const HEADER_HEIGHT = 18;

    // ===== TITLE HEADER =====
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1e293b")
      .text("GRUPO FOX - Custo da Mercadoria", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(8).font("Helvetica").fillColor("#64748b")
      .text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} | Moeda: ${currencyLabel} | Cotação: 1 USD = R$ ${exchangeRate.toFixed(2)}`, { align: "center" });
    doc.moveDown(0.8);

    // Helper: draw table header row with background
    const drawTableHeader = (y: number): number => {
      // Dark header background
      doc.save();
      doc.rect(tableLeft, y, tableWidth, HEADER_HEIGHT).fill("#334155");
      doc.restore();

      // Header text
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#ffffff");
      let x = tableLeft;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x + 2, y + 5, {
          width: colWidths[i] - 4,
          height: HEADER_HEIGHT - 4,
          align: i === 1 ? "left" : "center",
          lineBreak: false,
        });
        x += colWidths[i];
      }
      doc.fillColor("#1a1a1a");
      return HEADER_HEIGHT;
    };

    // Helper: draw a data row with grid lines
    const drawDataRow = (y: number, values: string[], options?: { bg?: string; bold?: boolean }): number => {
      // Row background
      if (options?.bg) {
        doc.save();
        doc.rect(tableLeft, y, tableWidth, ROW_HEIGHT).fill(options.bg);
        doc.restore();
      }

      // Cell text
      doc.fontSize(6.5).font(options?.bold ? "Helvetica-Bold" : "Helvetica").fillColor("#334155");
      let x = tableLeft;
      for (let i = 0; i < values.length; i++) {
        const text = values[i] || "";
        const align = i === 1 ? "left" : (i === 0 ? "left" : "center");
        // Special color for Total BRL column
        if (i === 10 && text !== "-") {
          doc.fillColor("#1e40af");
        } else {
          doc.fillColor("#334155");
        }
        doc.text(text, x + 2, y + 3.5, {
          width: colWidths[i] - 4,
          height: ROW_HEIGHT - 3,
          align,
          lineBreak: false,
          ellipsis: true,
        });
        x += colWidths[i];
      }

      // Horizontal grid line at bottom of row
      doc.save();
      doc.strokeColor("#e2e8f0").lineWidth(0.3);
      doc.moveTo(tableLeft, y + ROW_HEIGHT).lineTo(tableLeft + tableWidth, y + ROW_HEIGHT).stroke();
      doc.restore();

      // Vertical grid lines
      doc.save();
      doc.strokeColor("#e2e8f0").lineWidth(0.2);
      x = tableLeft;
      for (let i = 0; i <= colWidths.length; i++) {
        doc.moveTo(x, y).lineTo(x, y + ROW_HEIGHT).stroke();
        x += colWidths[i] || 0;
      }
      doc.restore();

      return ROW_HEIGHT;
    };

    // Helper: check page break and re-draw header if needed
    const checkPageBreak = (currentY: number, neededHeight: number): number => {
      const maxY = doc.page.height - doc.page.margins.bottom;
      if (currentY + neededHeight > maxY) {
        doc.addPage();
        let newY = doc.page.margins.top;
        newY += drawTableHeader(newY);
        return newY;
      }
      return currentY;
    };

    // ===== ITERATE SUPPLIERS =====
    let currentY = doc.y;

    for (const supplier of suppliers) {
      const supplierPos = allPos.filter(p => p.supplierId === supplier.id);
      if (supplierPos.length === 0) continue;

      // Count total products for this supplier
      const totalProducts = supplierPos.reduce((sum, po) => {
        return sum + allProducts.filter(p => p.poId === po.id).length;
      }, 0);
      if (totalProducts === 0) continue;

      // Check if we need a new page for supplier header + at least a few rows
      currentY = checkPageBreak(currentY, HEADER_HEIGHT + ROW_HEIGHT * 3 + 30);

      // Supplier header
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1e40af")
        .text(supplier.displayName || supplier.name, tableLeft, currentY);
      currentY += 14;
      doc.fontSize(7.5).font("Helvetica").fillColor("#64748b")
        .text(`${supplier.category || 'Fornecedor'} • ${supplierPos.length} POs`, tableLeft, currentY);
      currentY += 14;

      // Draw table header
      currentY += drawTableHeader(currentY);

      // Draw products for each PO (sorted by PO number descending - newest first)
      const sortedPos = [...supplierPos].sort((a, b) => {
        const numA = parseInt((a.poNumber || "0").replace(/\D/g, "")) || 0;
        const numB = parseInt((b.poNumber || "0").replace(/\D/g, "")) || 0;
        return numB - numA;
      });

      for (const po of sortedPos) {
        const products = allProducts.filter(p => p.poId === po.id);
        if (products.length === 0) continue;

        for (let idx = 0; idx < products.length; idx++) {
          const product = products[idx];
          currentY = checkPageBreak(currentY, ROW_HEIGHT + 2);

          // Calculate Frete/Cx = (PO Cheia - Vlr USD) per box
          const valorUsd = parseFloat(product.valorUsd || "0");
          const valorPoCheia = parseFloat(product.valorPoCheia || "0");
          const valorPoMenor = parseFloat(product.valorPoMenor || "0");
          const quantidade = product.quantidade || 0;
          const fretePorCaixa = valorPoCheia > 0 && valorUsd > 0 ? (valorPoCheia - valorUsd) : 0;
          // Frete Tot = Frete/Cx * Quantidade
          const freteTotal = fretePorCaixa > 0 && quantidade > 0 ? fretePorCaixa * quantidade : 0;

          const values = [
            po.poNumber || "",
            product.description || "",
            quantidade ? String(quantidade) : "-",
            product.ncm || "-",
            formatMoney(product.valorUsd, currencySymbol, conversionRate),
            formatMoney(product.valorPoCheia, currencySymbol, conversionRate),
            formatMoney(product.valorPoMenor, currencySymbol, conversionRate),
            fretePorCaixa > 0 ? formatMoney(fretePorCaixa, currencySymbol, conversionRate) : "-",
            freteTotal > 0 ? formatMoney(freteTotal, currencySymbol, conversionRate) : "-",
            formatMoney(product.totalImpostos, "R$", 1),
            formatMoney(product.valorCaixaBrl, "R$", 1),
          ];

          const bg = idx % 2 === 0 ? undefined : "#f8fafc";
          currentY += drawDataRow(currentY, values, { bg });
        }
      }

      // Spacing between suppliers
      currentY += 16;
    }

    // ===== FOOTER on last page =====
    doc.fontSize(7).font("Helvetica").fillColor("#94a3b8")
      .text("Grupo Fox - Dashboard de Estoque | Relatório gerado automaticamente", tableLeft, doc.page.height - 28, { align: "center", width: pageWidth });

    doc.end();
  } catch (error) {
    console.error("Error generating Custo PDF:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao gerar PDF" });
    }
  }
}
