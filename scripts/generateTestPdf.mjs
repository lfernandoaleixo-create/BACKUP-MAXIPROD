/**
 * Script to generate a test Decision PDF to verify the new layout.
 * Uses the same data as the example PDF (LATICINIOS SAO VICENTE DE MINAS).
 * Run with: node scripts/generateTestPdf.mjs
 */
import { writeFileSync } from "fs";
import { JSDOM } from "jsdom";

// Setup DOM environment for jsPDF
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.fetch = async (url) => {
  // Mock fetch for logo
  const response = await import("node:https").then(https => {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        const chunks = [];
        res.on("data", chunk => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            blob: () => Promise.resolve(new dom.window.Blob([buffer], { type: "image/png" })),
          });
        });
        res.on("error", reject);
      });
    });
  });
  return response;
};
global.FileReader = dom.window.FileReader;
global.Blob = dom.window.Blob;

// Import after DOM setup
const jspdfModule = await import("jspdf");
const jsPDF = jspdfModule.jsPDF;
const autoTableModule = await import("jspdf-autotable");
const autoTable = autoTableModule.default;

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png";
const LOGO_RATIO = 2.11;

let logoBase64Cache = null;

async function getLogoBase64() {
  if (logoBase64Cache) return logoBase64Cache;
  try {
    const https = await import("node:https");
    return new Promise((resolve) => {
      https.get(LOGO_URL, (res) => {
        const chunks = [];
        res.on("data", chunk => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          logoBase64Cache = `data:image/png;base64,${buffer.toString("base64")}`;
          resolve(logoBase64Cache);
        });
        res.on("error", () => resolve(null));
      });
    });
  } catch {
    return null;
  }
}

const COLORS = {
  darkGreen: [13, 71, 52],
  mediumGreen: [22, 101, 75],
  lightGreen: [232, 245, 233],
  gold: [184, 145, 48],
  goldLight: [255, 248, 225],
  darkSlate: [30, 41, 59],
  mediumSlate: [71, 85, 105],
  lightSlate: [241, 245, 249],
  white: [255, 255, 255],
  red: [185, 28, 28],
  redLight: [254, 242, 242],
  blue: [29, 78, 216],
  blueLight: [239, 246, 255],
  amber: [180, 120, 20],
  amberLight: [255, 251, 235],
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
}

function formatCurrency(val) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Test data matching the original PDF
const testData = {
  comProtesto: {
    title: {
      cliente: "LATICINIOS SAO VICENTE DE MINAS S.A",
      vendedor: "JORDAO",
      valorAReceber: 2500.00,
      vencimento: "2026-04-21",
      diasAtraso: 8,
      referenteA: "NF 99901",
      documento: "2187",
      parcela: "1/2",
      empresa: "PALITOS INDUSTRIA",
      decisaoCobranca: "COM PROTESTO",
      formaCobranca: "Boleto Sicredi ag 0155 conta 50051 carteira 1",
      observacoesMaxiprod: "",
      cobranca: {
        status: "concluido",
        promessaData: null,
        promessaValor: null,
        observacoes: null,
        contatoHistorico: [],
        cobrancaStartedAt: "2026-04-28",
      },
    },
    checklistSteps: [
      { dia: 1, label: "Dia 1 — WhatsApp + E-mail", descricao: "", motivo: "Ação realizada: WhatsApp, Ligação, E-mail", data: "2026-04-30", status: "verde" },
      { dia: 2, label: "Dia 2 — Intervalo", descricao: "", motivo: "Marcado como concluído manualmente", data: "2026-05-04", status: "verde" },
      { dia: 3, label: "Dia 3 — Ligação + E-mail", descricao: "", motivo: "Marcado como concluído manualmente", data: "2026-05-05", status: "verde" },
      { dia: 4, label: "Dia 4 — Intervalo", descricao: "", motivo: "Marcado como concluído manualmente", data: "2026-05-06", status: "verde" },
      { dia: 5, label: "Dia 5 — Ligação + E-mail (Último)", descricao: "", motivo: "Marcado como concluído manualmente", data: "2026-05-07", status: "verde" },
      { dia: 6, label: "Dia 6 — Preparação", descricao: "", motivo: "Marcado como concluído manualmente", data: "2026-05-08", status: "verde" },
      { dia: 7, label: "Dia 7+ — Decisão de Protesto", descricao: "", motivo: "Marcado como concluído manualmente", data: "2026-05-11", status: "verde" },
    ],
    operatorName: "Thiago",
  },
  semProtesto: {
    title: {
      cliente: "DISTRIBUIDORA EXEMPLO LTDA",
      vendedor: "PAULA",
      valorAReceber: 4800.00,
      vencimento: "2026-04-15",
      diasAtraso: 12,
      referenteA: "NF 88801",
      documento: "3421",
      parcela: "2/3",
      empresa: "PALITOS INDUSTRIA",
      decisaoCobranca: "SEM PROTESTO",
      formaCobranca: "Boleto Sicoob ag 0312 conta 12345 carteira 1",
      observacoesMaxiprod: "",
      cobranca: {
        status: "concluido",
        promessaData: null,
        promessaValor: null,
        observacoes: null,
        contatoHistorico: [],
        cobrancaStartedAt: "2026-04-20",
      },
    },
    checklistSteps: [
      { dia: 1, label: "Dia 1 — WhatsApp + E-mail", descricao: "", motivo: "", data: "2026-04-22", status: "verde" },
      { dia: 2, label: "Dia 2 — Intervalo", descricao: "", motivo: "", data: "2026-04-23", status: "verde" },
      { dia: 3, label: "Dia 3 — Ligação + E-mail", descricao: "", motivo: "", data: "2026-04-24", status: "verde" },
      { dia: 4, label: "Dia 4 — Intervalo", descricao: "", motivo: "", data: "2026-04-25", status: "verde" },
      { dia: 5, label: "Dia 5 — Ligação + E-mail (Último)", descricao: "", motivo: "", data: "2026-04-28", status: "verde" },
      { dia: 6, label: "Dia 6 — Preparação", descricao: "", motivo: "", data: "2026-04-29", status: "verde" },
      { dia: 7, label: "Dia 7+ — Decisão de Protesto", descricao: "", motivo: "", data: "2026-04-30", status: "verde" },
    ],
    operatorName: "Thiago",
  },
};

async function generatePdf(input, outputPath) {
  const { title, checklistSteps, operatorName } = input;
  const protocolo = `GF-20260504-1500-${Math.floor(Math.random() * 9000 + 1000)}`;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 10;

  // Logo
  const logo = await getLogoBase64();
  if (logo) {
    const logoH = 18;
    const logoW = logoH * LOGO_RATIO;
    doc.addImage(logo, "PNG", margin, y, logoW, logoH);
  }

  // Header band
  y += 22;
  doc.setFillColor(...COLORS.darkGreen);
  doc.roundedRect(margin, y, contentW, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.white);
  doc.text("RELATÓRIO DE DECISÃO DE COBRANÇA", margin + 5, y + 9.5);

  // Protocol badge
  doc.setFillColor(...COLORS.gold);
  const protocolText = `Protocolo: ${protocolo}`;
  doc.setFontSize(8);
  const protW = doc.getTextWidth(protocolText) + 8;
  doc.roundedRect(pageW - margin - protW - 2, y + 2, protW + 2, 10, 1.5, 1.5, "F");
  doc.setTextColor(...COLORS.white);
  doc.text(protocolText, pageW - margin - protW + 1, y + 8.5);

  // Date line
  y += 18;
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mediumSlate);
  doc.setFont("helvetica", "normal");
  const now = new Date();
  doc.text(`Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, margin, y);
  doc.text(`Operador: ${operatorName}`, pageW - margin - doc.getTextWidth(`Operador: ${operatorName}`), y);

  // Client Info Cards
  y += 6;
  const cardH = 32;
  
  doc.setFillColor(...COLORS.lightGreen);
  doc.setDrawColor(...COLORS.mediumGreen);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW / 2 - 2, cardH, 2, 2, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.mediumGreen);
  doc.text("CLIENTE", margin + 4, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.darkSlate);
  const maxClientW = contentW / 2 - 10;
  let clientName = title.cliente;
  while (doc.getTextWidth(clientName) > maxClientW && clientName.length > 5) {
    clientName = clientName.substring(0, clientName.length - 1);
  }
  if (clientName !== title.cliente) clientName += "...";
  doc.text(clientName, margin + 4, y + 12);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.mediumSlate);
  if (title.referenteA) doc.text(`Ref: ${title.referenteA}`, margin + 4, y + 18);
  if (title.documento) doc.text(`Doc: ${title.documento}${title.parcela ? ` · ${title.parcela}` : ""}`, margin + 4, y + 23);
  if (title.empresa) doc.text(`Empresa: ${title.empresa}`, margin + 4, y + 28);

  // Card 2: Financial info
  const card2X = margin + contentW / 2 + 2;
  doc.setFillColor(...COLORS.goldLight);
  doc.setDrawColor(...COLORS.gold);
  doc.roundedRect(card2X, y, contentW / 2 - 2, cardH, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gold);
  doc.text("DADOS FINANCEIROS", card2X + 4, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.red);
  doc.text(formatCurrency(title.valorAReceber), card2X + 4, y + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.mediumSlate);
  doc.text(`Vencimento: ${formatDate(title.vencimento)}`, card2X + 4, y + 19);
  doc.text(`Atraso: ${title.diasAtraso} dias úteis`, card2X + 4, y + 24);
  if (title.vendedor) doc.text(`Vendedor: ${title.vendedor}`, card2X + 4, y + 29);

  y += cardH + 4;

  // Decision Badge
  const decisao = title.decisaoCobranca || "SEM PROTESTO";
  const isComProtesto = decisao.toUpperCase().includes("COM PROTESTO");
  
  doc.setFillColor(...(isComProtesto ? COLORS.red : COLORS.blue));
  doc.roundedRect(margin, y, contentW, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.text(`DECISÃO: ${decisao.toUpperCase()}`, margin + 5, y + 7);

  if (title.formaCobranca) {
    doc.setFontSize(8);
    const fcText = `Forma: ${title.formaCobranca}`;
    doc.text(fcText, pageW - margin - doc.getTextWidth(fcText) - 3, y + 7);
  }

  y += 14;

  // Histórico de Ações Realizadas
  doc.setFillColor(...COLORS.darkGreen);
  doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.white);
  doc.text("HISTÓRICO DE AÇÕES REALIZADAS", margin + 4, y + 5.5);
  y += 11;

  const doneSteps = checklistSteps.filter(s => 
    s.status === "verde" || s.status === "vermelho" || s.status === "dispensado" || s.status === "neutro"
  );

  if (doneSteps.length > 0) {
    const tableBody = doneSteps.map((step, idx) => {
      const statusLabel = step.status === "verde" ? "Concluído" :
        step.status === "dispensado" ? "Dispensado" :
        step.status === "vermelho" ? "Falha" :
        step.status === "neutro" ? "Neutro" : step.status;
      return [
        String(idx + 1),
        step.label,
        formatDate(step.data),
        statusLabel,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["#", "Etapa", "Data", "Status"]],
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        textColor: COLORS.darkSlate,
      },
      headStyles: {
        fillColor: COLORS.mediumGreen,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: COLORS.lightGreen,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 28, halign: "center" },
        3: { cellWidth: 28, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const val = data.cell.raw;
          if (val === "Concluído") {
            data.cell.styles.textColor = [22, 101, 75];
            data.cell.styles.fontStyle = "bold";
          } else if (val === "Falha") {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = "bold";
          } else if (val === "Dispensado") {
            data.cell.styles.textColor = [180, 120, 20];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    y = doc.lastAutoTable.finalY + 4;
  }

  // Próximo Passo
  const vendorName = title.vendedor || "Vendedor responsável";
  let respText;
  if (isComProtesto) {
    respText = `Todos os passos de cobrança foram executados corretamente. Como a decisão do vendedor ${vendorName} foi de Protesto, esse cliente será encaminhado para protesto em cartório.`;
  } else {
    respText = `Todos os passos de cobrança foram executados corretamente. Como o vendedor responsável ${vendorName} escolheu não protestar, cabe a ele escolher qual o próximo passo a ser feito, para que a equipe de cobrança dê continuidade no processo.`;
  }
  
  doc.setFontSize(8);
  const respLines = doc.splitTextToSize(respText, contentW - 8);
  const boxH = 10 + respLines.length * 4;
  
  if (y + boxH > 280) { doc.addPage(); y = 15; }
  doc.setFillColor(...COLORS.redLight);
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentW, boxH, 2, 2, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.red);
  doc.text("PRÓXIMO PASSO", margin + 4, y + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.darkSlate);
  doc.text(respLines, margin + 4, y + 12);
  y += boxH + 4;

  // Footer
  const pageH = 297;
  doc.setDrawColor(...COLORS.mediumGreen);
  doc.setLineWidth(0.5);
  doc.line(margin, pageH - 15, pageW - margin, pageH - 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.mediumSlate);
  doc.text("Grupo Fox — Documento de Decisão de Cobrança", margin, pageH - 10);
  doc.text(`Protocolo: ${protocolo}`, margin, pageH - 6);
  doc.text(`Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`, pageW - margin - doc.getTextWidth(`Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`), pageH - 10);
  doc.text("Este documento é de uso interno e confidencial.", pageW - margin - doc.getTextWidth("Este documento é de uso interno e confidencial."), pageH - 6);

  // Save
  const buffer = Buffer.from(doc.output("arraybuffer"));
  writeFileSync(outputPath, buffer);
  console.log(`PDF gerado: ${outputPath}`);
}

// Generate both versions
await generatePdf(testData.comProtesto, "/home/ubuntu/COM_PROTESTO_LATICINIOS_SAO_VICENTE.pdf");
await generatePdf(testData.semProtesto, "/home/ubuntu/SEM_PROTESTO_DISTRIBUIDORA_EXEMPLO.pdf");
console.log("Ambos os PDFs gerados com sucesso!");
