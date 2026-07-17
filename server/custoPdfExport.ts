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
 * and all columns matching the screen display.
 * 
 * Columns: PO | Produto | Código | NCM | Tipo Frete | Unid.Cx | Vlr Fornecedor | Vlr Ordem Pgto | Diferença | Qtd Cx | Frete Calc. Forn. | Frete Rateio | Vlr Referência | % | Vlr Caixa | Preço Mil/U
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
      margins: { top: 30, bottom: 30, left: 15, right: 15 },
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

    // Column definitions - all columns matching the screen
    // PO | Produto | Código | NCM | Tipo Frete | Unid.Cx | Vlr Forn | Vlr Ordem | Diferença | Qtd Cx | Frete Calc | Frete Rateio | Vlr Ref | % | Vlr Caixa | Preço Mil/U
    const colWidths = [32, 145, 35, 52, 28, 28, 50, 50, 42, 30, 50, 50, 55, 35, 50, 45];
    const headers = ["PO", "Produto", "Código", "NCM", "Frete", "Un.Cx", "Vlr Forn.", "Vlr Ordem", "Diferença", "Qtd", "Frete Calc.", "Frete Rateio", "Vlr Referência", "%", "Vlr Caixa", "Preço Mil/U"];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const ROW_HEIGHT = 13;
    const HEADER_HEIGHT = 20;

    // ===== TITLE HEADER =====
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#1e293b")
      .text("GRUPO FOX - Custo da Mercadoria", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(7.5).font("Helvetica").fillColor("#64748b")
      .text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} | Moeda: ${currencyLabel} | Cotação: 1 USD = R$ ${exchangeRate.toFixed(2)} | Relatório: Manos e Fernando`, { align: "center" });
    doc.moveDown(0.7);

    // Helper: draw table header row with background
    const drawTableHeader = (y: number): number => {
      // Dark header background
      doc.save();
      doc.rect(tableLeft, y, tableWidth, HEADER_HEIGHT).fill("#334155");
      doc.restore();

      // Header text
      doc.fontSize(5.8).font("Helvetica-Bold").fillColor("#ffffff");
      let x = tableLeft;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x + 1.5, y + 4, {
          width: colWidths[i] - 3,
          height: HEADER_HEIGHT - 4,
          align: i === 1 ? "left" : "center",
          lineBreak: i === 1 ? false : true,
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
      doc.fontSize(5.5).font(options?.bold ? "Helvetica-Bold" : "Helvetica").fillColor("#334155");
      let x = tableLeft;
      for (let i = 0; i < values.length; i++) {
        const text = values[i] || "";
        const align = i === 1 ? "left" : (i === 0 ? "left" : "center");
        // Special colors for certain columns
        if (i === 14 && text !== "-" && text !== "—") {
          doc.fillColor("#065f46"); // Valor da Caixa - green
        } else if (i === 15 && text !== "-" && text !== "—") {
          doc.fillColor("#0f766e"); // Preço Mil/U - teal
        } else if (i === 13 && text !== "-" && text !== "—") {
          doc.fillColor("#3730a3"); // % - indigo
        } else {
          doc.fillColor("#334155");
        }
        doc.text(text, x + 1.5, y + 3, {
          width: colWidths[i] - 3,
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
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#1e40af")
        .text(supplier.displayName || supplier.name, tableLeft, currentY);
      currentY += 13;
      doc.fontSize(7).font("Helvetica").fillColor("#64748b")
        .text(`${supplier.category || 'Fornecedor'} • ${supplierPos.length} POs`, tableLeft, currentY);
      currentY += 12;

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

        // Determine if this is a legacy PO (has totalCustosImportacao saved)
        const isLegacyPo = po.totalCustosImportacao && Number(po.totalCustosImportacao) > 0;
        const poExchangeRate = Number(po.valorDolar1 || po.valorDolar1Remessa || exchangeRate);

        // Calculate totals for this PO (needed for % and Valor da Caixa)
        const totalFreteAutoCalc = products.reduce((sum, prod) => {
          const valorForn = Number(String(prod.valorUsd || 0).replace(',', '.'));
          const valorOrdem = Number(String(prod.valorPoCheia || 0).replace(',', '.'));
          const qty = Number(prod.quantidade || 0);
          const diff = valorOrdem - valorForn;
          return sum + (diff > 0 ? diff * qty : 0);
        }, 0);
        const totalFreteCalculado = totalFreteAutoCalc;

        const totalValorReferencia = products.reduce((sum, prod) => {
          const valorForn = Number(String(prod.valorUsd || 0).replace(',', '.'));
          const qty = Number(prod.quantidade || 0);
          return sum + (valorForn * qty);
        }, 0);

        // Custos Totais for new POs (simplified - without vilela/frete terrestre which need extra queries)
        const custosTotais = isLegacyPo
          ? Number(po.totalCustosImportacao || 0)
          : totalValorReferencia + totalFreteCalculado + Number(po.despesasLiberacaoRemessa || 0) + Number(po.freteSpMg || 0) + Number(po.difalValor || 0) + Number(po.comissaoSilverio || 0);

        for (let idx = 0; idx < products.length; idx++) {
          const product = products[idx];
          currentY = checkPageBreak(currentY, ROW_HEIGHT + 2);

          const valorForn = Number(String(product.valorUsd || 0).replace(',', '.'));
          const valorOrdem = Number(String(product.valorPoCheia || 0).replace(',', '.'));
          const qty = Number(product.quantidade || 0);
          const diferenca = valorOrdem - valorForn;
          const freteCalcFornecedor = diferenca > 0 && qty > 0 ? diferenca * qty : 0;
          const valorRef = valorForn * qty;
          const percProdutoNoTotal = totalValorReferencia > 0 ? (valorRef / totalValorReferencia) * 100 : 0;
          const percProdutoNaOrdem = totalValorReferencia > 0 ? valorRef / totalValorReferencia : 0;
          const freteRateioCorreto = percProdutoNaOrdem * totalFreteCalculado;

          // Valor da Caixa calculation
          let valorDaCaixa = 0;
          if (isLegacyPo && product.valorCaixaBrl && Number(product.valorCaixaBrl) > 0) {
            // Legacy: use saved value (already in BRL)
            valorDaCaixa = currency === "BRL" ? Number(product.valorCaixaBrl) : Number(product.valorCaixaBrl) / (poExchangeRate + 0.20);
          } else {
            // New PO: calculate
            const valorDaCaixaUsd = qty > 0 ? (custosTotais * (percProdutoNoTotal / 100)) / qty : 0;
            valorDaCaixa = currency === "BRL" ? valorDaCaixaUsd * conversionRate : valorDaCaixaUsd;
          }

          // Preço Mil/Unid
          let precoMilUnid = 0;
          if (isLegacyPo && product.precoMilUnid && Number(product.precoMilUnid) > 0) {
            precoMilUnid = currency === "BRL" ? Number(product.precoMilUnid) : Number(product.precoMilUnid) / (poExchangeRate + 0.20);
          } else {
            const unid = Number(product.unidCaixa || 0);
            precoMilUnid = unid > 0 ? valorDaCaixa / unid : 0;
          }

          const values = [
            po.poNumber || "",
            product.description || "",
            product.productCode || "-",
            product.ncm || "-",
            product.incoterm || "-",
            product.unidCaixa ? String(Number(product.unidCaixa).toFixed(0)) : "-",
            valorForn > 0 ? formatMoney(valorForn, currencySymbol, conversionRate) : "-",
            valorOrdem > 0 ? formatMoney(valorOrdem, currencySymbol, conversionRate) : "-",
            diferenca !== 0 ? formatMoney(diferenca, currencySymbol, conversionRate) : "-",
            qty > 0 ? String(qty) : "-",
            freteCalcFornecedor > 0 ? formatMoney(freteCalcFornecedor, currencySymbol, conversionRate) : "-",
            freteRateioCorreto > 0 ? formatMoney(freteRateioCorreto, currencySymbol, conversionRate) : "-",
            valorRef > 0 ? formatMoney(valorRef, currencySymbol, conversionRate) : "-",
            percProdutoNoTotal > 0 ? `${percProdutoNoTotal.toFixed(2)}%` : "-",
            valorDaCaixa > 0 ? `${currencySymbol} ${valorDaCaixa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-",
            precoMilUnid > 0 ? `${currencySymbol} ${precoMilUnid.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-",
          ];

          const bg = idx % 2 === 0 ? undefined : "#f8fafc";
          currentY += drawDataRow(currentY, values, { bg });
        }
      }

      // Spacing between suppliers
      currentY += 14;
    }

    // ===== FOOTER on last page =====
    doc.fontSize(6.5).font("Helvetica").fillColor("#94a3b8")
      .text("Grupo Fox - Dashboard de Estoque | Relatório gerado automaticamente por Manos e Fernando", tableLeft, doc.page.height - 25, { align: "center", width: pageWidth });

    doc.end();
  } catch (error) {
    console.error("Error generating Custo PDF:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao gerar PDF" });
    }
  }
}
