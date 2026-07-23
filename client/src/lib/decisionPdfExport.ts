import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png";
const LOGO_RATIO = 2.11;

let logoBase64Cache: string | null = null;

async function getLogoBase64(): Promise<string | null> {
  if (logoBase64Cache) return logoBase64Cache;
  try {
    const response = await fetch(LOGO_URL);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        logoBase64Cache = reader.result as string;
        resolve(logoBase64Cache);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Colors ──
const COLORS = {
  darkGreen: [13, 71, 52] as [number, number, number],
  mediumGreen: [22, 101, 75] as [number, number, number],
  lightGreen: [232, 245, 233] as [number, number, number],
  gold: [184, 145, 48] as [number, number, number],
  goldLight: [255, 248, 225] as [number, number, number],
  darkSlate: [30, 41, 59] as [number, number, number],
  mediumSlate: [71, 85, 105] as [number, number, number],
  lightSlate: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  red: [185, 28, 28] as [number, number, number],
  redLight: [254, 242, 242] as [number, number, number],
  blue: [29, 78, 216] as [number, number, number],
  blueLight: [239, 246, 255] as [number, number, number],
  amber: [180, 120, 20] as [number, number, number],
  amberLight: [255, 251, 235] as [number, number, number],
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
}

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function generateProtocolo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `GF-${y}${m}${d}-${h}${min}-${rand}`;
}

export type DecisionPdfInput = {
  title: {
    id: number;
    cliente: string;
    vendedor: string;
    valorAReceber: number;
    vencimento: string;
    diasAtraso: number;
    referenteA: string;
    documento: string;
    parcela: string;
    empresa: string;
    decisaoCobranca: string;
    formaCobranca: string;
    observacoesMaxiprod: string;
    cobranca: {
      status: string;
      promessaData: string | null;
      promessaValor: number | null;
      observacoes: string | null;
      contatoHistorico: Array<{ data: string; tipo: string; resumo: string; usuario?: string }>;
      cobrancaStartedAt: string | null;
    } | null;
  };
  checklistSteps: Array<{
    dia: number;
    label: string;
    descricao: string;
    motivo: string;
    data: string;
    status: string;
  }>;
  operatorName: string;
  planilhaCobranca?: {
    etapas: Array<{ etapa: string; data: string | null }>;
    observacoes: Array<{ etapa: string; observacao: string; registradoPor: string; createdAt: string }>;
    contato?: string | null;
    email?: string | null;
  } | null;
};

export async function generateDecisionPdf(input: DecisionPdfInput): Promise<{ blob: Blob; protocolo: string; base64: string }> {
  const { title, checklistSteps, operatorName } = input;
  const protocolo = generateProtocolo();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 10;

  // ── Logo ──
  const logo = await getLogoBase64();
  if (logo) {
    const logoH = 18;
    const logoW = logoH * LOGO_RATIO;
    doc.addImage(logo, "PNG", margin, y, logoW, logoH);
  }

  // ── Header band ──
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

  // ── Date line ──
  y += 18;
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mediumSlate);
  doc.setFont("helvetica", "normal");
  const now = new Date();
  doc.text(`Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, margin, y);
  doc.text(`Operador: ${operatorName}`, pageW - margin - doc.getTextWidth(`Operador: ${operatorName}`), y);

  // ── Client Info Cards ──
  y += 6;
  const cardH = 32;
  
  // Card 1: Client info
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
  // Truncate long client names
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

  // ── Decision Badge ──
  const decisao = title.decisaoCobranca || "SEM PROTESTO";
  const isComProtesto = decisao.toUpperCase().includes("COM PROTESTO");
  
  doc.setFillColor(...(isComProtesto ? COLORS.red : COLORS.blue));
  doc.roundedRect(margin, y, contentW, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.text(`DECISÃO: ${decisao.toUpperCase()}`, margin + 5, y + 7);

  // Forma de cobrança on the right
  if (title.formaCobranca) {
    doc.setFontSize(8);
    const fcText = `Forma: ${title.formaCobranca}`;
    doc.text(fcText, pageW - margin - doc.getTextWidth(fcText) - 3, y + 7);
  }

  y += 14;

  // ── Etapas de Cobrança (resumo) ──
  doc.setFillColor(...COLORS.darkGreen);
  doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.white);
  doc.text("ETAPAS DE COBRANÇA", margin + 4, y + 5.5);
  y += 11;

  // Filter only steps that were actually done
  const doneSteps = checklistSteps.filter(s => 
    s.status === "verde" || s.status === "vermelho" || s.status === "dispensado" || s.status === "neutro"
  );

  const HIST_ETAPA_LABELS: Record<string, string> = {
    primeiraCobranca: "1ª Cobrança",
    semAcao1: "Intervalo 1",
    segundaCobranca: "2ª Cobrança",
    semAcao2: "Intervalo 2",
    terceiraCobranca: "3ª Cobrança",
    semAcao3: "Intervalo 3",
    acaoFinal: "Ação Final",
  };
  const labelToKey: Record<string, string> = {};
  Object.entries(HIST_ETAPA_LABELS).forEach(([key, label]) => { labelToKey[label] = key; });
  labelToKey["Sem Ação 1"] = "semAcao1";
  labelToKey["Sem Ação 2"] = "semAcao2";
  labelToKey["Sem Ação 3"] = "semAcao3";

  if (doneSteps.length > 0) {
    // Table 1: Summary of steps with dates
    const stepsTableBody = doneSteps.map((step, idx) => [
      String(idx + 1),
      step.label,
      formatDate(step.data),
      step.status === "verde" ? "Realizada" : step.status === "vermelho" ? "Não realizada" : step.status === "dispensado" ? "Dispensada" : "Registrada",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["#", "Etapa", "Data", "Status"]],
      body: stepsTableBody,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7.5,
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
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 30, fontStyle: "bold" },
        2: { cellWidth: 25, halign: "center" },
        3: { cellWidth: 25, halign: "center" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.mediumSlate);
    doc.text("Nenhuma ação de cobrança registrada até o momento.", margin + 4, y + 4);
    y += 10;
  }

  // ── Histórico Completo de Observações por Etapa ──
  const allObservacoes = input.planilhaCobranca?.observacoes || [];
  if (allObservacoes.length > 0) {
    if (y + 20 > 275) { doc.addPage(); y = 15; }
    doc.setFillColor(...COLORS.darkGreen);
    doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.white);
    doc.text("HISTÓRICO COMPLETO DE OBSERVAÇÕES", margin + 4, y + 5.5);
    y += 11;

    // Group observations by etapa in order
    const etapaOrder = ["primeiraCobranca", "semAcao1", "segundaCobranca", "semAcao2", "terceiraCobranca", "semAcao3", "acaoFinal", "intervencaoVendedor"];
    const ETAPA_DISPLAY: Record<string, string> = {
      primeiraCobranca: "1ª Cobrança",
      semAcao1: "Intervalo 1",
      segundaCobranca: "2ª Cobrança",
      semAcao2: "Intervalo 2",
      terceiraCobranca: "3ª Cobrança",
      semAcao3: "Intervalo 3",
      acaoFinal: "Ação Final",
      intervencaoVendedor: "Intervenção Vendedor",
    };

    // Build full table with all observations showing etapa, text, who, when
    const obsTableBody: string[][] = [];
    for (const etapaKey of etapaOrder) {
      const obsForEtapa = allObservacoes.filter(o => o.etapa === etapaKey);
      if (obsForEtapa.length === 0) continue;
      for (const obs of obsForEtapa) {
        const dataHora = obs.createdAt ? new Date(obs.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
        obsTableBody.push([
          ETAPA_DISPLAY[etapaKey] || etapaKey,
          obs.observacao || "—",
          obs.registradoPor || "—",
          dataHora,
        ]);
      }
    }
    // Also include observations from etapas not in the standard order
    const coveredEtapas = new Set(etapaOrder);
    const extraObs = allObservacoes.filter(o => !coveredEtapas.has(o.etapa));
    for (const obs of extraObs) {
      const dataHora = obs.createdAt ? new Date(obs.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
      obsTableBody.push([
        ETAPA_DISPLAY[obs.etapa] || obs.etapa,
        obs.observacao || "—",
        obs.registradoPor || "—",
        dataHora,
      ]);
    }

    if (obsTableBody.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Etapa", "Observação", "Registrado por", "Data/Hora"]],
        body: obsTableBody,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 7,
          cellPadding: 2.5,
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
          textColor: COLORS.darkSlate,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: COLORS.mediumGreen,
          textColor: COLORS.white,
          fontStyle: "bold",
          fontSize: 7.5,
        },
        alternateRowStyles: {
          fillColor: COLORS.lightGreen,
        },
        columnStyles: {
          0: { cellWidth: 25, fontStyle: "bold" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 22 },
          3: { cellWidth: 30, halign: "center" },
        },
      });

      y = (doc as any).lastAutoTable.finalY + 4;
    }
  }

  // ── Contato Histórico (from contatoHistorico) ──
  const contatos = title.cobranca?.contatoHistorico?.filter(c => c.resumo && c.resumo.trim() !== "") || [];
  if (contatos.length > 0) {
    if (y + 20 > 275) { doc.addPage(); y = 15; }
    doc.setFillColor(...COLORS.darkGreen);
    doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.white);
    doc.text("REGISTRO DE CONTATOS", margin + 4, y + 5.5);
    y += 11;

    const contatoBody = contatos.map((c, idx) => [
      String(idx + 1),
      c.data ? formatDate(c.data) : "—",
      c.tipo || "—",
      c.usuario || "—",
      c.resumo,
    ]);

    autoTable(doc, {
      startY: y,
      head: [["#", "Data", "Tipo", "Operador", "Resumo"]],
      body: contatoBody,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        textColor: COLORS.darkSlate,
      },
      headStyles: {
        fillColor: COLORS.mediumGreen,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: COLORS.lightSlate,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 22 },
        4: { cellWidth: "auto" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // ── Observações Gerais (Maxiprod) ──
  const obsMaxiprod = title.observacoesMaxiprod || "";
  if (obsMaxiprod) {
    if (y + 20 > 275) { doc.addPage(); y = 15; }
    doc.setFillColor(...COLORS.amberLight);
    doc.setDrawColor(...COLORS.amber);
    doc.setLineWidth(0.3);
    doc.setFontSize(8);
    const obsLines = doc.splitTextToSize(obsMaxiprod, contentW - 8);
    const obsBoxH = Math.max(16, 8 + obsLines.length * 3.5);
    if (y + obsBoxH > 275) { doc.addPage(); y = 15; }
    doc.roundedRect(margin, y, contentW, obsBoxH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.amber);
    doc.text("OBSERVAÇÕES GERAIS", margin + 4, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.darkSlate);
    doc.text(obsLines, margin + 4, y + 11);
    y += obsBoxH + 4;
  }

  // (ETAPAS DE COBRANÇA section removed — now integrated into HISTÓRICO DE AÇÕES REALIZADAS above)

  // ── Próximo Passo ──
  const vendorName = title.vendedor || "Vendedor responsável";
  let respText: string;
  if (isComProtesto) {
    respText = `Todas as 3 ações de cobrança foram realizadas corretamente pelo responsável. Como a decisão do vendedor ${vendorName} foi de Protesto, esse cliente será encaminhado para protesto em cartório.`;
  } else {
    respText = `Todas as 3 ações de cobrança foram realizadas corretamente pelo responsável. Como o vendedor responsável ${vendorName} escolheu não protestar, fica a cargo dele definir a próxima medida a ser tomada para que a equipe de cobrança dê continuidade no processo.`;
  }
  
  // Calculate box height dynamically based on text
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

  // ── Footer ──
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

  // Convert to blob and base64
  const blob = doc.output("blob");
  const base64 = doc.output("datauristring").split(",")[1];

  return { blob, protocolo, base64 };
}
