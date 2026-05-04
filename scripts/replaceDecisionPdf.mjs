/**
 * Script to replace the existing decision PDF in the database with the new version.
 * Finds the record by protocolo GF-20260504-1459-8390, generates a new PDF,
 * uploads to S3, and updates the fileUrl in the database.
 */
import { writeFileSync, readFileSync } from "fs";
import { JSDOM } from "jsdom";

// Setup DOM environment for jsPDF
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.FileReader = dom.window.FileReader;
global.Blob = dom.window.Blob;

// Import jsPDF
const jspdfModule = await import("jspdf");
const jsPDF = jspdfModule.jsPDF;
const autoTableModule = await import("jspdf-autotable");
const autoTable = autoTableModule.default;

// Import https for logo download
import https from "node:https";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png";
const LOGO_RATIO = 2.11;

async function getLogoBase64() {
  return new Promise((resolve) => {
    https.get(LOGO_URL, (res) => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve(`data:image/png;base64,${buffer.toString("base64")}`);
      });
      res.on("error", () => resolve(null));
    });
  });
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

// Same data as the original PDF
const titleData = {
  cliente: "LATICINIOS SAO VICENTE DE MINAS S.A",
  vendedor: "JORDAO",
  valorAReceber: 2500.00,
  vencimento: "2026-04-21",
  diasAtraso: 8,
  referenteA: "",
  documento: "2187",
  parcela: "1/2",
  empresa: "PALITOS INDUSTRIA",
  decisaoCobranca: "COM PROTESTO",
  formaCobranca: "Boleto Sicredi ag 0155 conta 50051 carteira 1",
};

const checklistSteps = [
  { label: "Dia 1 — WhatsApp + E-mail", data: "2026-04-30", status: "verde", motivo: "Ação realizada: WhatsApp, Ligação, E-mail" },
  { label: "Dia 2 — Intervalo", data: "2026-05-04", status: "verde", motivo: "Marcado como concluído manualmente" },
  { label: "Dia 3 — Ligação + E-mail", data: "2026-05-05", status: "verde", motivo: "Marcado como concluído manualmente" },
  { label: "Dia 4 — Intervalo", data: "2026-05-06", status: "verde", motivo: "Marcado como concluído manualmente" },
  { label: "Dia 5 — Ligação + E-mail (Último)", data: "2026-05-07", status: "verde", motivo: "Marcado como concluído manualmente" },
  { label: "Dia 6 — Preparação", data: "2026-05-08", status: "verde", motivo: "Marcado como concluído manualmente" },
  { label: "Dia 7+ — Decisão de Protesto", data: "2026-05-11", status: "verde", motivo: "Marcado como concluído manualmente" },
];

const protocolo = "GF-20260504-1459-8390";
const operatorName = "Thiago";

async function generateNewPdf() {
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

  // Date line - use original date
  y += 18;
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mediumSlate);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em 04/05/2026 às 14:59`, margin, y);
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
  let clientName = titleData.cliente;
  while (doc.getTextWidth(clientName) > maxClientW && clientName.length > 5) {
    clientName = clientName.substring(0, clientName.length - 1);
  }
  if (clientName !== titleData.cliente) clientName += "...";
  doc.text(clientName, margin + 4, y + 12);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.mediumSlate);
  if (titleData.documento) doc.text(`Doc: ${titleData.documento}${titleData.parcela ? ` · ${titleData.parcela}` : ""}`, margin + 4, y + 18);
  if (titleData.empresa) doc.text(`Empresa: ${titleData.empresa}`, margin + 4, y + 23);

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
  doc.text(formatCurrency(titleData.valorAReceber), card2X + 4, y + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.mediumSlate);
  doc.text(`Vencimento: ${formatDate(titleData.vencimento)}`, card2X + 4, y + 19);
  doc.text(`Atraso: ${titleData.diasAtraso} dias úteis`, card2X + 4, y + 24);
  doc.text(`Vendedor: ${titleData.vendedor}`, card2X + 4, y + 29);

  y += cardH + 4;

  // Decision Badge
  const isComProtesto = true;
  doc.setFillColor(...COLORS.red);
  doc.roundedRect(margin, y, contentW, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.text(`DECISÃO: COM PROTESTO`, margin + 5, y + 7);

  doc.setFontSize(8);
  const fcText = `Forma: ${titleData.formaCobranca}`;
  doc.text(fcText, pageW - margin - doc.getTextWidth(fcText) - 3, y + 7);

  y += 14;

  // Histórico de Ações Realizadas
  doc.setFillColor(...COLORS.darkGreen);
  doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.white);
  doc.text("HISTÓRICO DE AÇÕES REALIZADAS", margin + 4, y + 5.5);
  y += 11;

  // Table WITHOUT Observação column
  const tableBody = checklistSteps.map((step, idx) => {
    return [
      String(idx + 1),
      step.label,
      formatDate(step.data),
      "Concluído",
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
        }
      }
    },
  });

  y = doc.lastAutoTable.finalY + 4;

  // Próximo Passo - NEW MESSAGE
  const respText = `Todos os passos de cobrança foram executados corretamente. Como a decisão do vendedor JORDAO foi de Protesto, esse cliente será encaminhado para protesto em cartório.`;
  
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
  doc.text(`Gerado em 04/05/2026 às 14:59:01`, pageW - margin - doc.getTextWidth(`Gerado em 04/05/2026 às 14:59:01`), pageH - 10);
  doc.text("Este documento é de uso interno e confidencial.", pageW - margin - doc.getTextWidth("Este documento é de uso interno e confidencial."), pageH - 6);

  return Buffer.from(doc.output("arraybuffer"));
}

// Generate the PDF
const pdfBuffer = await generateNewPdf();
const outputPath = "/home/ubuntu/NOVO_LATICINIOS_SAO_VICENTE.pdf";
writeFileSync(outputPath, pdfBuffer);
console.log(`PDF gerado localmente: ${outputPath}`);

// Now upload to S3 via the storage API and update the database
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!FORGE_API_URL || !FORGE_API_KEY) {
  console.error("Missing BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY");
  process.exit(1);
}

// Upload to S3
const baseUrl = FORGE_API_URL.replace(/\/+$/, "");
const fileKey = `decision-pdfs/${Date.now()}-LATICINIOS_SAO_VICENTE_DE_MINA.pdf`;
const uploadUrl = new URL("v1/storage/upload", baseUrl + "/");
uploadUrl.searchParams.set("path", fileKey);

const formData = new FormData();
const blob = new Blob([pdfBuffer], { type: "application/pdf" });
formData.append("file", blob, fileKey.split("/").pop());

const uploadResponse = await fetch(uploadUrl, {
  method: "POST",
  headers: { Authorization: `Bearer ${FORGE_API_KEY}` },
  body: formData,
});

if (!uploadResponse.ok) {
  const errText = await uploadResponse.text();
  console.error(`Upload failed: ${uploadResponse.status} ${errText}`);
  process.exit(1);
}

const { url: newFileUrl } = await uploadResponse.json();
console.log(`Uploaded to S3: ${newFileUrl}`);

// Update database record
import mysql from "mysql2/promise";

const connection = await mysql.createConnection(DATABASE_URL);

// Find the record
const [rows] = await connection.execute(
  "SELECT id, file_key, file_url FROM decision_pdf_history WHERE protocolo = ?",
  [protocolo]
);

if (rows.length === 0) {
  console.error(`No record found with protocolo ${protocolo}`);
  await connection.end();
  process.exit(1);
}

const record = rows[0];
console.log(`Found record id=${record.id}, old fileUrl=${record.file_url}`);

// Update the record with new file
await connection.execute(
  "UPDATE decision_pdf_history SET file_key = ?, file_url = ? WHERE id = ?",
  [fileKey, newFileUrl, record.id]
);

console.log(`Updated record id=${record.id} with new fileUrl=${newFileUrl}`);
await connection.end();
console.log("Done! PDF replaced successfully.");
