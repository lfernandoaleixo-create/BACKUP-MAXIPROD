import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { importSuppliers, importPos, importPoProducts, importConfig } from "../drizzle/schema";
import { asc, eq, or } from "drizzle-orm";

// Helper: format monetary value
const formatMoney = (val: string | number | null | undefined, symbol: string, rate: number): string => {
  if (!val || val === "0" || val === "0.00") return "-";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num) || num === 0) return "-";
  const converted = num * rate;
  return `${symbol} ${converted.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatMoneyAlways = (val: number, symbol: string): string => {
  return `${symbol} ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Generates a PDF report of Custo da Mercadoria (all suppliers, POs, and products).
 * Complete backup: includes product table + PO summary (remessas, custos adicionais, custos totais).
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

    // Get vilela percent config
    const vilelaRows = await db.select().from(importConfig).where(eq(importConfig.configKey, 'vilela_percent'));
    const vilelaPercent = Number(vilelaRows[0]?.configValue || '37');

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
      doc.save();
      doc.rect(tableLeft, y, tableWidth, HEADER_HEIGHT).fill("#334155");
      doc.restore();

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
      if (options?.bg) {
        doc.save();
        doc.rect(tableLeft, y, tableWidth, ROW_HEIGHT).fill(options.bg);
        doc.restore();
      }

      doc.fontSize(5.5).font(options?.bold ? "Helvetica-Bold" : "Helvetica").fillColor("#334155");
      let x = tableLeft;
      for (let i = 0; i < values.length; i++) {
        const text = values[i] || "";
        const align = i === 1 ? "left" : (i === 0 ? "left" : "center");
        if (i === 14 && text !== "-" && text !== "—") {
          doc.fillColor("#065f46");
        } else if (i === 15 && text !== "-" && text !== "—") {
          doc.fillColor("#0f766e");
        } else if (i === 13 && text !== "-" && text !== "—") {
          doc.fillColor("#3730a3");
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

      doc.save();
      doc.strokeColor("#e2e8f0").lineWidth(0.3);
      doc.moveTo(tableLeft, y + ROW_HEIGHT).lineTo(tableLeft + tableWidth, y + ROW_HEIGHT).stroke();
      doc.restore();

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

    // Helper: draw PO summary section (remessas + custos adicionais + custos totais)
    const drawPoSummary = (y: number, po: any, products: any[], totalValorReferencia: number, totalFreteCalculado: number): number => {
      const isLegacyPo = po.totalCustosImportacao && Number(po.totalCustosImportacao) > 0;
      const poExchangeRate = Number(po.valorDolar1 || po.valorDolar1Remessa || exchangeRate);
      const rate = isLegacyPo ? (poExchangeRate + 0.20) : conversionRate;
      const sym = currencySymbol;

      // Calculate values
      const valorCi = Number(po.totalCiRemessa || po.totalCiUsd || 0);
      const vilelaReal = Number(po.vilelaValorReal || 0);
      const despLib = isLegacyPo
        ? Number(po.despesasLiberacaoRemessa || 0)
        : (vilelaReal > 0 ? vilelaReal : valorCi * (vilelaPercent / 100));
      const freteSP = Number(po.freteSpMg || po.freteTermestreRemessa || 0);
      const difal = Number(po.difalValor || 0);
      const comSilverio = Number(po.comissaoSilverio || 0);

      const custosTotais = isLegacyPo
        ? Number(po.totalCustosImportacao || 0)
        : totalValorReferencia + totalFreteCalculado + despLib + freteSP + difal + comSilverio;

      // Remessas
      const pag2 = Number(po.pagamento2Remessa || 0);
      const pag3 = Number(po.pagamento3Remessa || 0);
      const totalGeral = totalValorReferencia + totalFreteCalculado;
      const pag1 = totalGeral - pag2 - pag3;

      const summaryStartY = y;
      const lineHeight = 11;
      const colLeft = tableLeft;
      const col2 = tableLeft + 270;
      const col3 = tableLeft + 540;

      // === ROW 1: Totals (green boxes) ===
      doc.save();
      doc.rect(colLeft, y, 250, 22).fill("#f0fdf4").stroke("#bbf7d0");
      doc.restore();
      doc.fontSize(6).font("Helvetica-Bold").fillColor("#15803d")
        .text("VALOR TOTAL DA ORDEM DE PAGAMENTO", colLeft + 5, y + 3);
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#166534")
        .text(formatMoneyAlways(totalValorReferencia * (currency === "BRL" ? rate : 1), sym), colLeft + 5, y + 12);

      doc.save();
      doc.rect(col2, y, 250, 22).fill("#fef9c3").stroke("#fde047");
      doc.restore();
      doc.fontSize(6).font("Helvetica-Bold").fillColor("#a16207")
        .text("VALOR TOTAL DO FRETE", col2 + 5, y + 3);
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#92400e")
        .text(formatMoneyAlways(totalFreteCalculado * (currency === "BRL" ? rate : 1), sym), col2 + 5, y + 12);

      doc.save();
      doc.rect(col3, y, 250, 22).fill("#fef2f2").stroke("#fecaca");
      doc.restore();
      doc.fontSize(6).font("Helvetica-Bold").fillColor("#dc2626")
        .text("TOTAL GERAL (ORDEM + FRETE)", col3 + 5, y + 3);
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#991b1b")
        .text(formatMoneyAlways(totalGeral * (currency === "BRL" ? rate : 1), sym), col3 + 5, y + 12);

      y += 28;

      // === ROW 2: Remessas de Pagamento ===
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#334155")
        .text("REMESSAS DE PAGAMENTO", colLeft, y);
      y += 10;

      doc.fontSize(6).font("Helvetica").fillColor("#64748b")
        .text("1ª Remessa (valor total menos 2ª e 3ª)", colLeft, y);
      doc.text("2ª Remessa", col2, y);
      doc.text("3ª Remessa", col3, y);
      y += 9;

      doc.fontSize(7).font("Helvetica-Bold").fillColor("#1e293b")
        .text(formatMoneyAlways(pag1 * (currency === "BRL" ? rate : 1), sym), colLeft, y);
      doc.text(formatMoneyAlways(pag2 * (currency === "BRL" ? rate : 1), sym), col2, y);
      doc.text(formatMoneyAlways(pag3 * (currency === "BRL" ? rate : 1), sym), col3, y);
      y += 14;

      // === ROW 3: Custos Adicionais da Importação ===
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#334155")
        .text("CUSTOS ADICIONAIS DA IMPORTAÇÃO", colLeft, y);
      y += 10;

      // Line 1: Valor da CI + Despesas de Liberação
      doc.fontSize(6).font("Helvetica").fillColor("#64748b")
        .text("Valor da CI (Commercial Invoice)", colLeft, y);
      doc.text("Despesas de Liberação", col2, y);
      y += 9;

      doc.fontSize(7).font("Helvetica-Bold").fillColor("#1e293b")
        .text(formatMoneyAlways(valorCi * (currency === "BRL" ? rate : 1), sym), colLeft, y);
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#b45309")
        .text(formatMoneyAlways(despLib * (currency === "BRL" ? rate : 1), sym), col2, y);
      y += 12;

      // Line 2: Frete SP/MG + DIFAL + Comissão Silvério
      doc.fontSize(6).font("Helvetica").fillColor("#64748b")
        .text("Frete Terrestre SP/MG", colLeft, y);
      doc.text("DIFAL", col2, y);
      doc.text("Comissão Silvério", col3, y);
      y += 9;

      doc.fontSize(7).font("Helvetica-Bold").fillColor("#1e293b")
        .text(formatMoneyAlways(freteSP * (currency === "BRL" ? rate : 1), sym), colLeft, y);
      doc.text(formatMoneyAlways(difal * (currency === "BRL" ? rate : 1), sym), col2, y);
      doc.text(formatMoneyAlways(comSilverio * (currency === "BRL" ? rate : 1), sym), col3, y);
      y += 14;

      // === ROW 4: Custos Totais da Importação (purple banner) ===
      doc.save();
      doc.rect(colLeft, y, tableWidth, 20).fill("#7c3aed");
      doc.restore();
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#ffffff")
        .text("CUSTOS TOTAIS DA IMPORTAÇÃO", colLeft + 5, y + 3);
      doc.fontSize(5.5).font("Helvetica").fillColor("#e9d5ff")
        .text("Ordem de Pagamento (CI) + Despesas Liberação + Frete Terrestre + DIFAL + Comissão Silvério", colLeft + 5, y + 12);
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#ffffff")
        .text(formatMoneyAlways(custosTotais * (currency === "BRL" ? rate : 1), sym), colLeft + tableWidth - 150, y + 4, { width: 145, align: "right" });
      y += 24;

      return y - summaryStartY;
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

      const totalProducts = supplierPos.reduce((sum, po) => {
        return sum + allProducts.filter(p => p.poId === po.id).length;
      }, 0);
      if (totalProducts === 0) continue;

      currentY = checkPageBreak(currentY, HEADER_HEIGHT + ROW_HEIGHT * 3 + 30);

      // Supplier header
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#1e40af")
        .text(supplier.displayName || supplier.name, tableLeft, currentY);
      currentY += 13;
      doc.fontSize(7).font("Helvetica").fillColor("#64748b")
        .text(`${supplier.category || 'Fornecedor'} • ${supplierPos.length} POs`, tableLeft, currentY);
      currentY += 12;

      // Draw products for each PO (sorted by PO number descending)
      const sortedPos = [...supplierPos].sort((a, b) => {
        const numA = parseInt((a.poNumber || "0").replace(/\D/g, "")) || 0;
        const numB = parseInt((b.poNumber || "0").replace(/\D/g, "")) || 0;
        return numB - numA;
      });

      for (const po of sortedPos) {
        const products = allProducts.filter(p => p.poId === po.id);
        if (products.length === 0) continue;

        const isLegacyPo = po.totalCustosImportacao && Number(po.totalCustosImportacao) > 0;
        const poExchangeRate = Number(po.valorDolar1 || po.valorDolar1Remessa || exchangeRate);

        // Calculate totals for this PO
        const totalFreteAutoCalc = products.reduce((sum, prod) => {
          const valorForn = Number(String(prod.valorUsd || 0).replace(',', '.'));
          const valorOrdem = Number(String(prod.valorPoCheia || 0).replace(',', '.'));
          const qty = Number(prod.quantidade || 0);
          const diff = valorOrdem - valorForn;
          return sum + (diff > 0 ? diff * qty : 0);
        }, 0);
        const freteOverride = po.freteOverrideUsd ? Number(po.freteOverrideUsd) : null;
        const totalFreteCalculado = freteOverride !== null ? freteOverride : totalFreteAutoCalc;

        const totalValorReferencia = products.reduce((sum, prod) => {
          const valorForn = Number(String(prod.valorUsd || 0).replace(',', '.'));
          const qty = Number(prod.quantidade || 0);
          return sum + (valorForn * qty);
        }, 0);

        const valorCi = Number(po.totalCiRemessa || po.totalCiUsd || 0);
        const vilelaReal = Number(po.vilelaValorReal || 0);
        const despLib = isLegacyPo
          ? Number(po.despesasLiberacaoRemessa || 0)
          : (vilelaReal > 0 ? vilelaReal : valorCi * (vilelaPercent / 100));
        const freteSP = Number(po.freteSpMg || po.freteTermestreRemessa || 0);
        const difal = Number(po.difalValor || 0);
        const comSilverio = Number(po.comissaoSilverio || 0);

        const custosTotais = isLegacyPo
          ? Number(po.totalCustosImportacao || 0)
          : totalValorReferencia + totalFreteCalculado + despLib + freteSP + difal + comSilverio;

        // PO sub-header
        currentY = checkPageBreak(currentY, HEADER_HEIGHT + ROW_HEIGHT * 3 + 20);
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#475569")
          .text(`${po.poNumber || "PO"}  ${po.containerName ? `• ${po.containerName}` : ""}`, tableLeft, currentY);
        currentY += 11;

        // Draw table header for this PO
        currentY += drawTableHeader(currentY);

        // Draw product rows
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

          // Valor da Caixa
          let valorDaCaixa = 0;
          if (isLegacyPo && product.valorCaixaBrl && Number(product.valorCaixaBrl) > 0) {
            valorDaCaixa = currency === "BRL" ? Number(product.valorCaixaBrl) : Number(product.valorCaixaBrl) / (poExchangeRate + 0.20);
          } else {
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

        // === PO SUMMARY SECTION ===
        currentY += 6;
        currentY = checkPageBreak(currentY, 120);
        currentY += drawPoSummary(currentY, po, products, totalValorReferencia, totalFreteCalculado);
        currentY += 10;

        // Separator line between POs
        doc.save();
        doc.strokeColor("#cbd5e1").lineWidth(0.5);
        doc.moveTo(tableLeft, currentY).lineTo(tableLeft + tableWidth, currentY).stroke();
        doc.restore();
        currentY += 8;
      }

      // Spacing between suppliers
      currentY += 10;
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
