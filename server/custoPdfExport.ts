import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { importSuppliers, importPos, importPoProducts } from "../drizzle/schema";
import { asc, eq } from "drizzle-orm";

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
 * GET /api/import/export-custo-pdf
 */
export async function custoPdfExportHandler(req: Request, res: Response) {
  try {
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const suppliers = await db.select().from(importSuppliers).orderBy(asc(importSuppliers.displayOrder));
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
      margins: { top: 40, bottom: 40, left: 25, right: 25 },
    });

    // Set response headers
    const dateStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    const filename = `Custo_Mercadoria_${dateStr}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    // ===== HEADER =====
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#1e293b")
      .text("GRUPO FOX - Custo da Mercadoria", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").fillColor("#64748b")
      .text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} | Moeda: ${currencyLabel} | Cotação: 1 USD = R$ ${exchangeRate.toFixed(2)}`, { align: "center" });
    doc.moveDown(1);

    // ===== ITERATE SUPPLIERS =====
    for (const supplier of suppliers) {
      const supplierPos = allPos.filter(p => p.supplierId === supplier.id);
      if (supplierPos.length === 0) continue;

      // Supplier header
      if (doc.y > 480) doc.addPage();
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#1e40af")
        .text(`${supplier.name}`, 25);
      doc.fontSize(8).font("Helvetica").fillColor("#64748b")
        .text(`${supplier.category || 'Fornecedor'} • ${supplierPos.length} POs`);
      doc.moveDown(0.5);

      // Table header
      const tableLeft = 25;
      const colWidths = [50, 130, 55, 55, 60, 60, 55, 55, 55, 55, 55];
      // Columns: PO | Produto | Qtd | NCM | Vlr USD | PO Cheia | PO Menor | Frete/Cx | Frete Total | Impostos | Total BRL
      const headers = ["PO", "Produto", "Qtd", "NCM", "Vlr USD", "PO Cheia", "PO Menor", "Frete/Cx", "Frete Tot", "Impostos", "Total BRL"];

      let x = tableLeft;
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#334155");
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x, doc.y, { width: colWidths[i], align: "center", continued: false });
        x += colWidths[i];
      }
      doc.moveDown(0.3);

      // Draw header line
      doc.moveTo(tableLeft, doc.y).lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), doc.y).stroke("#cbd5e1");
      doc.moveDown(0.2);

      // Products per PO
      for (const po of supplierPos) {
        const products = allProducts.filter(p => p.poId === po.id);
        if (products.length === 0) continue;

        for (const product of products) {
          if (doc.y > 520) {
            doc.addPage();
            // Re-draw header on new page
            x = tableLeft;
            doc.fontSize(7).font("Helvetica-Bold").fillColor("#334155");
            for (let i = 0; i < headers.length; i++) {
              doc.text(headers[i], x, doc.y, { width: colWidths[i], align: "center", continued: false });
              x += colWidths[i];
            }
            doc.moveDown(0.3);
            doc.moveTo(tableLeft, doc.y).lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), doc.y).stroke("#cbd5e1");
            doc.moveDown(0.2);
          }

          const rowY = doc.y;
          x = tableLeft;
          doc.fontSize(6.5).font("Helvetica").fillColor("#475569");

          const vals = [
            po.poNumber || "",
            (product.description || "").substring(0, 25),
            product.quantidade ? String(product.quantidade) : "-",
            product.ncm || "-",
            formatMoney(product.valorUsd, currencySymbol, conversionRate),
            formatMoney(product.valorPoCheia, currencySymbol, conversionRate),
            formatMoney(product.valorPoMenor, currencySymbol, conversionRate),
            formatMoney(product.totalFreightUsd, currencySymbol, conversionRate),
            formatMoney(product.totalFreightUsd, currencySymbol, conversionRate),
            formatMoney(product.totalImpostos, "R$", 1),
            formatMoney(product.valorCaixaBrl, "R$", 1),
          ];

          for (let i = 0; i < vals.length; i++) {
            doc.text(vals[i], x, rowY, { width: colWidths[i], align: "center" });
            x += colWidths[i];
          }
          doc.moveDown(0.1);
        }
      }

      // Separator between suppliers
      doc.moveDown(0.5);
      doc.moveTo(tableLeft, doc.y).lineTo(780, doc.y).stroke("#e2e8f0");
      doc.moveDown(0.5);
    }

    // ===== FOOTER =====
    doc.fontSize(7).font("Helvetica").fillColor("#94a3b8")
      .text("Grupo Fox - Dashboard de Estoque | Relatório gerado automaticamente", 25, doc.page.height - 30, { align: "center" });

    doc.end();
  } catch (error) {
    console.error("Error generating Custo PDF:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao gerar PDF" });
    }
  }
}
