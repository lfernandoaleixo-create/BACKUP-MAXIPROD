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

// Helper: format CEP
const formatCep = (cep: string): string => {
  if (!cep) return "—";
  const clean = cep.replace(/\D/g, "");
  if (clean.length === 8) return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  return cep;
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

interface ItemBreakdown {
  codigo: string;
  descricao: string;
  qtd: number;
  unidade: string;
  pesoBrutoUn: number;
  fatorConv: number;
  pesoCx: number;
  pesoTotal: number;
  dimensoes: string;
  comprimento: number;
  largura: number;
  altura: number;
  volCxM3: number;
  cubagem: number;
}

interface SimulationResults {
  carriers?: FreightQuote[];
  pedido?: string;
  cliente?: string;
  itemsBreakdown?: ItemBreakdown[];
  endereco?: {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  dimensoes?: {
    altura: number;
    largura: number;
    comprimento: number;
  };
}

// Section header helper
function sectionHeader(doc: PDFKit.PDFDocument, num: number, title: string) {
  if (doc.y > 700) doc.addPage();
  doc.save();
  const y = doc.y;
  doc.rect(40, y, 515, 18).fill("#1a6b8a");
  doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
    .text(`${num}. ${title}`, 48, y + 4, { width: 500 });
  doc.restore();
  doc.fillColor("#000000");
  doc.y = y + 22;
}

// Table helper
function drawTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], colWidths: number[]) {
  const startX = 45;
  const fontSize = 7.5;
  const rowHeight = 14;
  
  // Header
  doc.fontSize(fontSize).font("Helvetica-Bold");
  let x = startX;
  const headerY = doc.y;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x, headerY, { width: colWidths[i], align: "center" });
    x += colWidths[i];
  }
  doc.y = headerY + rowHeight;
  
  // Separator
  doc.moveTo(startX, doc.y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), doc.y).lineWidth(0.5).stroke("#333333");
  doc.y += 3;
  
  // Rows
  doc.font("Helvetica").fontSize(fontSize);
  for (const row of rows) {
    if (doc.y > 740) doc.addPage();
    x = startX;
    const rowY = doc.y;
    for (let i = 0; i < row.length; i++) {
      doc.text(row[i], x, rowY, { width: colWidths[i], align: "center" });
      x += colWidths[i];
    }
    doc.y = rowY + rowHeight;
  }
}

/**
 * Generates a professional PDF report of a freight simulation.
 * Matches the reference format with 9 sections.
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

    // Parse results - new format has nested structure
    const rawResults = simulation.results as any;
    let carriers: FreightQuote[] = [];
    let pedido = "";
    let cliente = "";
    let itemsBreakdown: ItemBreakdown[] = [];
    let endereco: SimulationResults["endereco"] | undefined;
    let dimensoes: SimulationResults["dimensoes"] | undefined;

    if (rawResults && rawResults.carriers) {
      // New format: { carriers, pedido, cliente, itemsBreakdown, endereco, dimensoes }
      carriers = rawResults.carriers || [];
      pedido = rawResults.pedido || "";
      cliente = rawResults.cliente || "";
      itemsBreakdown = rawResults.itemsBreakdown || [];
      endereco = rawResults.endereco;
      dimensoes = rawResults.dimensoes;
    } else if (Array.isArray(rawResults)) {
      // Legacy format: direct array of carriers
      carriers = rawResults;
    }

    const validQuotes = carriers.filter(q => !q.error && q.totalFrete > 0);
    const errorQuotes = carriers.filter(q => q.error || q.totalFrete === 0);
    validQuotes.sort((a, b) => a.totalFrete - b.totalFrete);

    // Create PDF
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    const pesoTotal = Number(simulation.pesoTotal) || 0;
    const volumes = simulation.volumes || 0;
    const cubagemTotal = Number(simulation.cubagemTotal) || 0;
    const valorMercadoria = Number(simulation.valorMercadoria) || 0;

    // ========== PAGE 1 HEADER ==========
    doc.fontSize(14).font("Helvetica-Bold")
      .text("GRUPO FOX", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(9).font("Helvetica")
      .text("Relatório de Cotação de Frete", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(11).font("Helvetica-Bold")
      .text(`PEDIDO Nº ${pedido || "—"}`, { align: "center" });
    doc.moveDown(0.8);

    // ========== SECTION 1: DADOS DO PEDIDO ==========
    sectionHeader(doc, 1, "DADOS DO PEDIDO");
    doc.moveDown(0.3);
    doc.fontSize(8.5).font("Helvetica");

    const enderecoStr = endereco
      ? `${endereco.logradouro}, ${endereco.numero} - ${endereco.bairro}, ${endereco.cidade}/${endereco.uf}`
      : "—";

    const dadosPedido = [
      ["Cliente:", cliente || "—"],
      ["CNPJ Destinatário:", simulation.cnpjDestinatario ? formatCnpj(simulation.cnpjDestinatario) : "—"],
      ["Endereço:", enderecoStr],
      ["CEP Destino:", formatCep(simulation.cepDestino)],
      ["Valor Total NF:", formatCurrency(valorMercadoria)],
      ["Fonte dos Dados:", "Maxiprod GraphQL API + Banco de Dados"],
    ];

    for (const [label, value] of dadosPedido) {
      const y = doc.y;
      doc.font("Helvetica-Bold").text(label, 45, y, { width: 130 });
      doc.font("Helvetica").text(value, 175, y, { width: 370 });
      doc.y = y + 13;
    }
    doc.moveDown(0.8);

    // ========== SECTION 2: ITENS DO PEDIDO ==========
    sectionHeader(doc, 2, "ITENS DO PEDIDO");
    doc.moveDown(0.3);

    if (itemsBreakdown.length > 0) {
      const itemHeaders = ["Código", "Produto", "Qtd", "Unidade"];
      const itemColWidths = [60, 300, 50, 50];
      const itemRows = itemsBreakdown.map(item => [
        item.codigo,
        item.descricao.length > 55 ? item.descricao.substring(0, 55) + "..." : item.descricao,
        String(item.qtd),
        item.unidade,
      ]);
      // Add total row
      const totalQtd = itemsBreakdown.reduce((s, i) => s + i.qtd, 0);
      itemRows.push(["TOTAL", "", String(totalQtd), "CX"]);
      drawTable(doc, itemHeaders, itemRows, itemColWidths);
    } else {
      doc.fontSize(8).text("Dados de itens não disponíveis para esta simulação.", 45);
    }
    doc.moveDown(0.8);

    // ========== SECTION 3: CÁLCULO DE PESO ==========
    sectionHeader(doc, 3, "CÁLCULO DE PESO");
    doc.moveDown(0.3);

    if (itemsBreakdown.length > 0) {
      const pesoHeaders = ["Código", "Peso Bruto/Un (kg)", "Fator Conv.", "Peso/CX (kg)", "Qtd CX", "Peso Total (kg)"];
      const pesoColWidths = [60, 90, 80, 80, 60, 90];
      const pesoRows = itemsBreakdown.map(item => [
        item.codigo,
        item.pesoBrutoUn > 0 ? item.pesoBrutoUn.toFixed(6) : "-",
        item.fatorConv > 1 ? `${item.fatorConv.toLocaleString("pt-BR")} un/CX` : "-",
        item.pesoCx > 0 ? item.pesoCx.toFixed(2) : "-",
        String(item.qtd),
        item.pesoTotal > 0 ? item.pesoTotal.toFixed(2) : "-",
      ]);
      pesoRows.push(["TOTAL", "-", "-", "-", String(volumes), pesoTotal.toFixed(2)]);
      drawTable(doc, pesoHeaders, pesoRows, pesoColWidths);
      doc.moveDown(0.3);
      doc.fontSize(7).fillColor("#666666").font("Helvetica-Oblique")
        .text("Fórmula: pesoBruto/unidade × fator conversão = peso/CX → peso/CX × qtd = peso total", 45);
      doc.fillColor("#000000");
    } else {
      doc.fontSize(8).text(`Peso total calculado: ${pesoTotal.toFixed(2)} kg`, 45);
    }
    doc.moveDown(0.8);

    // ========== SECTION 4: DIMENSÕES REAIS ==========
    sectionHeader(doc, 4, "DIMENSÕES REAIS (descricaoComplementar Maxiprod)");
    doc.moveDown(0.3);

    if (itemsBreakdown.length > 0 && itemsBreakdown.some(i => i.dimensoes)) {
      const dimHeaders = ["Código", "Dimensões (cm)", "C (cm)", "L (cm)", "A (cm)", "Vol/CX (m3)", "Qtd", "Cubagem (m3)"];
      const dimColWidths = [55, 75, 45, 45, 45, 65, 40, 70];
      const dimRows = itemsBreakdown.map(item => [
        item.codigo,
        item.dimensoes || "-",
        item.comprimento > 0 ? String(item.comprimento) : "-",
        item.largura > 0 ? String(item.largura) : "-",
        item.altura > 0 ? String(item.altura) : "-",
        item.volCxM3 > 0 ? item.volCxM3.toFixed(6) : "-",
        String(item.qtd),
        item.cubagem > 0 ? item.cubagem.toFixed(6) : "-",
      ]);
      dimRows.push(["TOTAL", "-", "-", "-", "-", "-", String(volumes), cubagemTotal.toFixed(6)]);
      drawTable(doc, dimHeaders, dimRows, dimColWidths);
      doc.moveDown(0.3);
      doc.fontSize(7).fillColor("#666666").font("Helvetica-Oblique")
        .text("Fórmula: (C × L × A) / 1.000.000 = m3/CX → m3/CX × qtd = cubagem total", 45);
      doc.fillColor("#000000");
    } else {
      doc.fontSize(8).text("Dimensões não disponíveis para os itens deste pedido.", 45);
    }
    doc.moveDown(0.8);

    // ========== SECTION 5: MEDIDAS ENVIADAS ÀS APIs ==========
    sectionHeader(doc, 5, "MEDIDAS ENVIADAS ÀS APIs");
    doc.moveDown(0.3);

    const alturaEnviada = dimensoes?.altura || 0.5;
    const larguraEnviada = dimensoes?.largura || 0.5;
    const comprimentoEnviado = dimensoes?.comprimento || 0.5;

    // Calculate average width for display
    const totalQtyItems = itemsBreakdown.reduce((s, i) => s + i.qtd, 0) || 1;
    const avgLarguraCalc = itemsBreakdown.length > 0
      ? itemsBreakdown.reduce((s, i) => s + i.largura * i.qtd, 0) / totalQtyItems
      : 0;

    const medidasHeaders = ["Parâmetro", "Valor", "Unidade", "Observação"];
    const medidasColWidths = [100, 80, 80, 200];
    const medidasRows = [
      ["peso", pesoTotal.toFixed(2), "kg", "Peso bruto real total"],
      ["volumes", String(volumes), "unidades", "Total de caixas"],
      ["metroCubico", cubagemTotal.toFixed(3), "m3", "Cubagem real total"],
      ["altura", alturaEnviada.toFixed(2), "metros", itemsBreakdown.length > 0 ? `Maior CX (${itemsBreakdown.reduce((m, i) => Math.max(m, i.altura), 0)}cm)` : "Padrão 0.5m"],
      ["largura", larguraEnviada.toFixed(2), "metros", avgLarguraCalc > 0 ? `Média: ${avgLarguraCalc.toFixed(1)}cm` : "Padrão 0.5m"],
      ["comprimento", comprimentoEnviado.toFixed(2), "metros", itemsBreakdown.length > 0 ? `Maior CX (${itemsBreakdown.reduce((m, i) => Math.max(m, i.comprimento), 0)}cm)` : "Padrão 0.5m"],
    ];
    drawTable(doc, medidasHeaders, medidasRows, medidasColWidths);
    doc.moveDown(0.8);

    // ========== SECTION 6: CEPs DE ORIGEM POR TRANSPORTADORA ==========
    sectionHeader(doc, 6, "CEPs DE ORIGEM POR TRANSPORTADORA");
    doc.moveDown(0.3);

    const cepHeaders = ["Transportadora", "CEP Origem", "Cidade"];
    const cepColWidths = [180, 120, 200];
    const cepRows = [
      ["Camilo dos Santos (SSW)", "37260-000", "Perdões/MG"],
      ["Braspress", "37264-000", "Ribeirão Vermelho/MG"],
      ["Alfa Transportes", "37264-000", "Ribeirão Vermelho/MG"],
      ["Rodonaves", "37264-000", "Ribeirão Vermelho/MG"],
      ["Flor de Minas", "37264-000", "Ribeirão Vermelho/MG"],
    ];
    drawTable(doc, cepHeaders, cepRows, cepColWidths);
    doc.moveDown(0.8);

    // ========== SECTION 7: COMO CADA API UTILIZA ==========
    if (doc.y > 600) doc.addPage();
    sectionHeader(doc, 7, "COMO CADA API UTILIZA OS PARÂMETROS");
    doc.moveDown(0.3);

    const apiHeaders = ["Transportadora", "Peso", "Cubagem", "Dimensões", "Protocolo"];
    const apiColWidths = [100, 90, 90, 120, 100];
    const apiRows = [
      ["Braspress", "peso bruto", "Calcula interno", "C×L×A por vol", "ID cotação"],
      ["Alfa Transportes", "peso bruto", "metroCubico", "Não usa", "Protocolo API"],
      ["Camilo (SSW/SOAP)", "peso bruto", "cubagem m3", "Não usa", "Protocolo SSW"],
      ["Rodonaves (RTE)", "peso bruto", "Calcula interno", "Não usa", "Protocolo RTE"],
      ["Flor de Minas", "peso bruto", "Não usa", "Não usa", "Tabela interna"],
    ];
    drawTable(doc, apiHeaders, apiRows, apiColWidths);
    doc.moveDown(0.8);

    // ========== SECTION 8: PESO CUBADO vs PESO REAL ==========
    sectionHeader(doc, 8, "PESO CUBADO vs PESO REAL");
    doc.moveDown(0.3);

    const pesoCubado = cubagemTotal * 300; // Fator 300 padrão rodoviário
    const pesoTaxado = Math.max(pesoTotal, pesoCubado);
    doc.fontSize(8.5).font("Helvetica");
    doc.text(`Peso Real: ${pesoTotal.toFixed(2)} kg`, 45);
    doc.text(`Cubagem Total: ${cubagemTotal.toFixed(4)} m³`, 45);
    doc.text(`Peso Cubado (fator 300): ${pesoCubado.toFixed(2)} kg`, 45);
    doc.font("Helvetica-Bold");
    doc.text(`Peso Taxado (maior entre real e cubado): ${pesoTaxado.toFixed(2)} kg`, 45);
    doc.font("Helvetica");
    if (pesoCubado > pesoTotal) {
      doc.fillColor("#cc0000").text("⚠ Peso cubado é MAIOR que o peso real. Transportadoras cobrarão pelo peso cubado.", 45);
      doc.fillColor("#000000");
    } else {
      doc.fillColor("#006600").text("✓ Peso real é maior ou igual ao cubado. Cobrança pelo peso real.", 45);
      doc.fillColor("#000000");
    }
    doc.moveDown(0.3);
    doc.fontSize(7).fillColor("#666666").font("Helvetica-Oblique")
      .text("Fator cubagem rodoviário padrão: 300 kg/m³ (cubagem × 300 = peso cubado)", 45);
    doc.fillColor("#000000");
    doc.moveDown(0.8);

    // ========== SECTION 9: RANKING FINAL ==========
    doc.addPage();
    // Repeat header on page 2
    doc.fontSize(14).font("Helvetica-Bold")
      .text("GRUPO FOX", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(9).font("Helvetica")
      .text("Relatório de Cotação de Frete", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(11).font("Helvetica-Bold")
      .text(`PEDIDO Nº ${pedido || "—"}`, { align: "center" });
    doc.moveDown(0.8);

    sectionHeader(doc, 9, "RANKING FINAL - COTAÇÃO DE FRETE");
    doc.moveDown(0.3);

    if (validQuotes.length > 0) {
      const rankHeaders = ["#", "Transportadora", "CNPJ Remetente", "Valor Frete", "Prazo", "Protocolo"];
      const rankColWidths = [25, 110, 115, 80, 80, 90];
      const rankRows = validQuotes.map((q, i) => [
        String(i + 1),
        q.transportadora,
        q.cnpj ? formatCnpj(q.cnpj) : "—",
        formatCurrency(q.totalFrete),
        q.prazo || "—",
        q.protocolo || "—",
      ]);
      drawTable(doc, rankHeaders, rankRows, rankColWidths);

      // Highlight best option
      doc.moveDown(0.5);
      const best = validQuotes[0];
      doc.fontSize(9).font("Helvetica-Bold")
        .text(`★ MELHOR OPÇÃO: ${best.transportadora} — ${formatCurrency(best.totalFrete)} (${best.prazo})`, 45);
      if (best.protocolo) {
        doc.fontSize(8).font("Helvetica")
          .text(`   Protocolo: ${best.protocolo}`, 45);
      }
    } else {
      doc.fontSize(9).text("Nenhuma cotação válida obtida.", 45);
    }
    doc.moveDown(0.8);

    // Errors section
    if (errorQuotes.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(9).font("Helvetica-Bold").text("Transportadoras com Erro:", 45);
      doc.moveDown(0.3);
      doc.fontSize(8).font("Helvetica").fillColor("#cc0000");
      for (const q of errorQuotes) {
        doc.text(`✗ ${q.transportadora}${q.cnpj ? ` (${formatCnpj(q.cnpj)})` : ""}: ${q.error || "Sem resposta"}`, 55);
      }
      doc.fillColor("#000000");
    }
    doc.moveDown(1);

    // ========== SECTION: INFORMAÇÕES DAS TRANSPORTADORAS ==========
    if (doc.y > 550) doc.addPage();
    sectionHeader(doc, 10, "COMO FUNCIONA CADA TRANSPORTADORA");
    doc.moveDown(0.3);

    const carrierInfo = [
      {
        nome: "Braspress",
        tipo: "REST/JSON",
        desc: "Cotação via API REST. Retorna valor total, prazo em dias úteis, e ID da cotação como protocolo. Usa dimensões C×L×A por volume para calcular peso cubado internamente. Rastreio disponível em braspress.com.",
      },
      {
        nome: "Alfa Transportes",
        tipo: "REST/JSON",
        desc: "Cotação via API REST com chave por CNPJ. Retorna valor total, prazo, e protocolo. Usa metroCubico para cálculo de peso cubado. Dois CNPJs ativos (36.562.762 e 50.128.808).",
      },
      {
        nome: "Camilo dos Santos (SSW)",
        tipo: "SOAP/XML",
        desc: "Cotação via protocolo SOAP (SSW). Tabela negociada a partir de Perdões/MG (CEP 37260-000). Usa cubagem em m³. Retorna valor, prazo e protocolo SSW. Rastreio em ssw.inf.br.",
      },
      {
        nome: "Rodonaves (RTE)",
        tipo: "REST/JSON",
        desc: "Cotação via API REST RTE. Auto-cadastro de destinatário quando necessário. Calcula peso cubado internamente. Retorna valor, prazo e protocolo numérico. Rastreio em rodonaves.com.br.",
      },
      {
        nome: "Flor de Minas",
        tipo: "Planilha/Tabela",
        desc: "Cotação baseada em tabela interna (faixas de peso × região). Não possui API externa. Valor calculado localmente. Prazo fixo de 48h para regiões atendidas.",
      },
    ];

    doc.fontSize(8);
    for (const c of carrierInfo) {
      if (doc.y > 720) doc.addPage();
      doc.font("Helvetica-Bold").text(`${c.nome} (${c.tipo})`, 45);
      doc.font("Helvetica").text(c.desc, 55, doc.y, { width: 480 });
      doc.moveDown(0.5);
    }

    // ========== FOOTER ==========
    const createdAt = simulation.createdAt ? new Date(simulation.createdAt) : new Date();
    
    // Add footer to each page using buffered pages
    const pdfRange = doc.bufferedPageRange();
    const totalPages = pdfRange.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor("#999999").font("Helvetica")
        .text(
          `Manos e Fernando | Gerado em ${createdAt.toLocaleDateString("pt-BR")} ${createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} | Página ${i + 1}/${totalPages}`,
          40, 790, { align: "center", width: 515 }
        );
    }

    doc.end();

    const pdfBuffer = await pdfPromise;

    // Upload to S3
    const timestamp = Date.now().toString(36);
    const fileKey = `freight-reports/Relatorio_Frete_Pedido_${pedido || simulationId}-${timestamp}.pdf`;
    const { url: pdfUrl } = await storagePut(fileKey, pdfBuffer, "application/pdf");

    // Update simulation with PDF URL
    await db.update(freightSimulations)
      .set({ pdfUrl, updatedAt: new Date() })
      .where(sql`${freightSimulations.id} = ${simulationId}`);

    // Return PDF for download or the URL
    if (req.query.download === "true") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Relatorio_Frete_Pedido_${pedido || simulationId}.pdf"`);
      res.send(pdfBuffer);
    } else {
      res.json({ pdfUrl, simulationId });
    }
  } catch (error: any) {
    console.error("[FreightPDF] Error:", error);
    res.status(500).json({ error: error.message || "Erro ao gerar PDF" });
  }
}
