import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { freightSimulations } from "../drizzle/schema";
import { sql } from "drizzle-orm";
import { storagePut } from "./storage";

// Helper: format monetary value
const formatCurrency = (val: number): string => {
  return `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper: format CNPJ
const formatCnpj = (cnpj: string): string => {
  if (!cnpj || cnpj.length < 14) return cnpj || "—";
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return cnpj;
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

interface FreightQuote {
  transportadora: string;
  cnpj: string;
  totalFrete: number;
  prazo: string;
  trackingUrl?: string;
  protocolo?: string;
  error?: string;
}

/**
 * Generates a PDF report of a freight simulation.
 * Includes: simulation data, all quotes, selected carrier, protocols.
 * 
 * GET /api/freight/export-pdf/:simulationId
 */
export async function freightPdfExportHandler(req: Request, res: Response) {
  try {
    const simulationId = parseInt(req.params.simulationId);
    if (!simulationId || isNaN(simulationId)) {
      res.status(400).json({ error: "ID da simulação inválido" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const [simulation] = await db.select().from(freightSimulations)
      .where(sql`${freightSimulations.id} = ${simulationId}`)
      .limit(1);

    if (!simulation) {
      res.status(404).json({ error: "Simulação não encontrada" });
      return;
    }

    const results = (simulation.results as FreightQuote[]) || [];
    const validQuotes = results.filter(q => !q.error && q.totalFrete > 0);
    const errorQuotes = results.filter(q => q.error || q.totalFrete === 0);
    validQuotes.sort((a, b) => a.totalFrete - b.totalFrete);

    // Create PDF
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    // === HEADER ===
    doc.fontSize(16).font("Helvetica-Bold")
      .text("RELATÓRIO DE COTAÇÃO DE FRETE", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica")
      .fillColor("#666666")
      .text("Grupo Fox — Manos e Fernando", { align: "center" });
    doc.moveDown(0.3);
    const createdAt = simulation.createdAt ? new Date(simulation.createdAt) : new Date();
    doc.text(`Gerado em: ${createdAt.toLocaleDateString("pt-BR")} às ${createdAt.toLocaleTimeString("pt-BR")}`, { align: "center" });
    doc.moveDown(1);

    // === DADOS DA SIMULAÇÃO ===
    doc.fillColor("#000000");
    doc.fontSize(12).font("Helvetica-Bold").text("Dados da Simulação");
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica");

    const simData = [
      ["CEP Origem:", "32210-130 (Grupo Fox - Contagem/MG)"],
      ["CEP Destino:", simulation.cepDestino || "—"],
      ["CNPJ Destinatário:", simulation.cnpjDestinatario ? formatCnpj(simulation.cnpjDestinatario) : "—"],
      ["Valor da Mercadoria:", formatCurrency(Number(simulation.valorMercadoria))],
      ["Peso Total:", `${Number(simulation.pesoTotal).toFixed(2)} kg`],
      ["Volumes:", String(simulation.volumes)],
      ["Cubagem Total:", `${Number(simulation.cubagemTotal).toFixed(4)} m³`],
      ["Tipo Contribuinte:", simulation.tipoContribuinte || "—"],
    ];

    for (const [label, value] of simData) {
      doc.font("Helvetica-Bold").text(label, { continued: true });
      doc.font("Helvetica").text(` ${value}`);
    }
    doc.moveDown(1);

    // === COTAÇÕES VÁLIDAS ===
    doc.fontSize(12).font("Helvetica-Bold").text("Cotações Obtidas");
    doc.moveDown(0.3);

    if (validQuotes.length === 0) {
      doc.fontSize(9).font("Helvetica").text("Nenhuma cotação válida obtida.");
    } else {
      // Table header
      const tableTop = doc.y;
      const col1 = 40, col2 = 180, col3 = 300, col4 = 380, col5 = 460;
      doc.fontSize(8).font("Helvetica-Bold");
      doc.text("Transportadora", col1, tableTop);
      doc.text("CNPJ Remetente", col2, tableTop);
      doc.text("Valor Frete", col3, tableTop);
      doc.text("Prazo", col4, tableTop);
      doc.text("Protocolo", col5, tableTop);
      doc.moveDown(0.5);

      // Separator line
      doc.moveTo(col1, doc.y).lineTo(555, doc.y).stroke("#cccccc");
      doc.moveDown(0.3);

      doc.fontSize(8).font("Helvetica");
      for (let i = 0; i < validQuotes.length; i++) {
        const q = validQuotes[i];
        const y = doc.y;

        // Check page break
        if (y > 750) {
          doc.addPage();
        }

        const isSelected = simulation.selectedTransportadora === q.transportadora &&
          (!simulation.selectedCnpj || simulation.selectedCnpj === q.cnpj);

        if (isSelected) {
          doc.rect(col1 - 5, doc.y - 2, 525, 14).fill("#e6f7f0").stroke();
          doc.fillColor("#000000");
        }

        const prefix = i === 0 ? "★ " : "   ";
        doc.text(`${prefix}${q.transportadora}`, col1, doc.y);
        doc.text(q.cnpj ? formatCnpj(q.cnpj) : "—", col2, doc.y - 10);
        doc.font("Helvetica-Bold").text(formatCurrency(q.totalFrete), col3, doc.y - 10);
        doc.font("Helvetica").text(q.prazo || "—", col4, doc.y - 10);
        doc.text(q.protocolo || "—", col5, doc.y - 10);
        doc.moveDown(0.5);
      }
    }
    doc.moveDown(1);

    // === TRANSPORTADORAS COM ERRO ===
    if (errorQuotes.length > 0) {
      doc.fontSize(10).font("Helvetica-Bold").text("Transportadoras com Erro");
      doc.moveDown(0.3);
      doc.fontSize(8).font("Helvetica").fillColor("#cc0000");
      for (const q of errorQuotes) {
        doc.text(`✗ ${q.transportadora}${q.cnpj ? ` (${formatCnpj(q.cnpj)})` : ""}: ${q.error || "Sem resposta"}`);
      }
      doc.fillColor("#000000");
      doc.moveDown(1);
    }

    // === TRANSPORTADORA SELECIONADA ===
    if (simulation.selectedTransportadora) {
      doc.fontSize(12).font("Helvetica-Bold").text("Transportadora Selecionada");
      doc.moveDown(0.3);
      doc.fontSize(9).font("Helvetica");
      doc.font("Helvetica-Bold").text("Transportadora:", { continued: true });
      doc.font("Helvetica").text(` ${simulation.selectedTransportadora}`);
      if (simulation.selectedCnpj) {
        doc.font("Helvetica-Bold").text("CNPJ:", { continued: true });
        doc.font("Helvetica").text(` ${formatCnpj(simulation.selectedCnpj)}`);
      }
      doc.font("Helvetica-Bold").text("Valor:", { continued: true });
      doc.font("Helvetica").text(` ${formatCurrency(Number(simulation.selectedValor || 0))}`);
      doc.font("Helvetica-Bold").text("Protocolo de Cotação:", { continued: true });
      doc.font("Helvetica").text(` ${simulation.selectedProtocolo || "—"}`);
      doc.moveDown(1);
    }

    // === INFORMAÇÕES DAS TRANSPORTADORAS ===
    doc.fontSize(10).font("Helvetica-Bold").text("Como Funciona Cada Transportadora");
    doc.moveDown(0.3);
    doc.fontSize(8).font("Helvetica");

    const carrierInfo = [
      {
        nome: "Braspress",
        tipo: "REST/JSON",
        desc: "Cotação via API REST. Retorna valor total do frete, prazo em dias úteis, e ID da cotação como protocolo. Rastreio disponível após emissão da NF pelo site braspress.com.",
      },
      {
        nome: "Alfa Transportes",
        tipo: "REST/JSON",
        desc: "Cotação via API REST com chave por CNPJ. Retorna valor total, prazo, e protocolo de cotação. Rastreio interno via API (sem link público). Dois CNPJs ativos com chaves API.",
      },
      {
        nome: "Camilo dos Santos (SSW)",
        tipo: "SOAP/XML",
        desc: "Cotação via protocolo SOAP (SSW). Tabela negociada a partir de Perdões/MG (CEP 37260-000). Retorna valor total, prazo, e protocolo SSW. Rastreio pelo site ssw.inf.br.",
      },
      {
        nome: "Rodonaves",
        tipo: "REST/JSON (RTE)",
        desc: "Cotação via API REST RTE Rodonaves. Auto-cadastro de destinatário quando necessário. Retorna valor total, prazo, e protocolo numérico. Rastreio pelo site rodonaves.com.br.",
      },
      {
        nome: "Flor de Minas",
        tipo: "Planilha/Tabela",
        desc: "Cotação baseada em tabela interna (faixas de peso × região). Não possui API externa. Valor calculado localmente a partir da tabela cadastrada no sistema.",
      },
    ];

    for (const c of carrierInfo) {
      if (doc.y > 720) doc.addPage();
      doc.font("Helvetica-Bold").text(`${c.nome} (${c.tipo})`);
      doc.font("Helvetica").text(c.desc, { indent: 10 });
      doc.moveDown(0.5);
    }

    // === FOOTER ===
    doc.moveDown(1);
    doc.fontSize(7).fillColor("#999999")
      .text("─".repeat(80));
    doc.text("Este relatório foi gerado automaticamente pelo sistema Grupo Fox Dashboard.");
    doc.text("O protocolo de cotação serve como comprovante do valor consultado junto à transportadora.");
    doc.text(`Operador: ${simulation.operatorName || "Sistema"}`);

    doc.end();

    const pdfBuffer = await pdfPromise;

    // Upload to S3
    const timestamp = Date.now().toString(36);
    const fileKey = `freight-reports/simulacao-${simulationId}-${timestamp}.pdf`;
    const { url: pdfUrl } = await storagePut(fileKey, pdfBuffer, "application/pdf");

    // Update simulation with PDF URL
    await db.update(freightSimulations)
      .set({ pdfUrl, updatedAt: new Date() })
      .where(sql`${freightSimulations.id} = ${simulationId}`);

    // Return PDF for download or the URL
    if (req.query.download === "true") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="relatorio-frete-${simulation.cepDestino}-${simulationId}.pdf"`);
      res.send(pdfBuffer);
    } else {
      res.json({ pdfUrl, simulationId });
    }
  } catch (error: any) {
    console.error("[FreightPDF] Error:", error);
    res.status(500).json({ error: error.message || "Erro ao gerar PDF" });
  }
}
