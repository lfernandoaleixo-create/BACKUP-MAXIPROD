import PDFDocument from "pdfkit";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png";

interface CollectionDocData {
  cliente: string;
  vendedor: string;
  responsavelCobranca?: string; // Responsável pelas cobranças (ex: Thalita)
  valorTitulo: string | number;
  vencimentoData: string; // YYYY-MM-DD
  diasAtraso: number;
  documento?: string | null;
  referenteA?: string | null;
  acoesCobanca: Array<{
    dia: number;
    data: string;
    tipo: string;
    realizada: boolean;
    notas?: string;
  }>;
  protocolo: string;
  dataEmissao: string; // DD/MM/YYYY
}

const TIPO_ACAO_MAP: Record<string, string> = {
  ligacao: "Ligação telefônica",
  whatsapp: "Mensagem via WhatsApp",
  email: "E-mail de cobrança",
  visita: "Visita presencial",
  outro: "Outra forma de contato",
  sem_contato: "NENHUMA AÇÃO REALIZADA",
};

async function fetchLogoBuffer(): Promise<Buffer | null> {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}

export async function generateCollectionPdf(data: CollectionDocData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 55, right: 55 },
        info: {
          Title: "Documento para Tomada de Decisão",
          Author: "Grupo Fox - Sistema de Gestão",
          Subject: `Cobrança - ${data.cliente}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - 110; // margins
      const leftMargin = 55;

      // Colors
      const darkGreen = "#0d6b4e";
      const mediumGreen = "#15803d";
      const darkGray = "#1f2937";
      const mediumGray = "#4b5563";
      const lightGray = "#9ca3af";
      const redAlert = "#dc2626";
      const greenOk = "#16a34a";
      const blueAccent = "#1e40af";
      const amberDark = "#b45309";

      // ── HEADER ──
      const logoBuf = await fetchLogoBuffer();
      if (logoBuf) {
        doc.image(logoBuf, leftMargin, 35, { width: 80 });
      }

      // Header line
      doc.moveTo(leftMargin, 85).lineTo(leftMargin + contentWidth, 85).lineWidth(2).strokeColor(darkGreen).stroke();

      // Title - NOVO
      doc.fontSize(16).fillColor(darkGreen).font("Helvetica-Bold");
      doc.text("DOCUMENTO PARA TOMADA", leftMargin, 95, { align: "center", width: contentWidth });
      doc.text("DE DECISÃO", leftMargin, 113, { align: "center", width: contentWidth });

      doc.fontSize(10).fillColor(mediumGray).font("Helvetica");
      doc.text("ACOMPANHAMENTO DE INADIMPLÊNCIA E PRÓXIMOS PASSOS", leftMargin, 133, { align: "center", width: contentWidth });

      // Subtitle line
      doc.moveTo(leftMargin, 150).lineTo(leftMargin + contentWidth, 150).lineWidth(1).strokeColor(mediumGreen).stroke();

      // Protocol & Date
      doc.fontSize(8).fillColor(lightGray).font("Helvetica");
      doc.text(`Protocolo: ${data.protocolo}`, leftMargin, 157);
      doc.text(`Data de emissão: ${data.dataEmissao}`, leftMargin, 157, { align: "right", width: contentWidth });

      // ── DADOS DO TÍTULO ──
      let y = 178;

      // Section header with bg
      doc.rect(leftMargin, y, contentWidth, 22).fill(darkGreen);
      doc.fontSize(10).fillColor("#ffffff").font("Helvetica-Bold");
      doc.text("DADOS DO TÍTULO", leftMargin + 10, y + 6, { width: contentWidth - 20 });
      y += 30;

      // Data rows
      const valorNum = typeof data.valorTitulo === "string" ? parseFloat(data.valorTitulo) : data.valorTitulo;
      const valorFormatted = valorNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const vencFormatted = data.vencimentoData.split("-").reverse().join("/");

      const dataRows = [
        ["Cliente:", data.cliente],
        ["Referência:", data.referenteA || "—"],
        ["Documento:", data.documento || "—"],
        ["Valor em aberto:", valorFormatted],
        ["Data de vencimento:", vencFormatted],
        ["Dias em atraso:", `${data.diasAtraso} dias`],
      ];

      for (const [label, value] of dataRows) {
        const isValor = label === "Valor em aberto:" || label === "Dias em atraso:";
        doc.fontSize(9).font("Helvetica-Bold").fillColor(darkGray);
        doc.text(label, leftMargin + 10, y, { continued: false, width: 130 });
        doc.font("Helvetica").fillColor(isValor ? redAlert : mediumGray);
        doc.text(value, leftMargin + 145, y, { width: contentWidth - 155 });
        y += 16;
      }

      y += 5;

      // ── VENDEDOR RESPONSÁVEL ──
      doc.rect(leftMargin, y, contentWidth, 22).fill(darkGreen);
      doc.fontSize(10).fillColor("#ffffff").font("Helvetica-Bold");
      doc.text("VENDEDOR(A) RESPONSÁVEL", leftMargin + 10, y + 6, { width: contentWidth - 20 });
      y += 30;

      doc.fontSize(12).font("Helvetica-Bold").fillColor(darkGray);
      doc.text(`Sr(a). ${data.vendedor}`, leftMargin + 10, y);
      y += 25;

      // ── RESPONSÁVEL PELA COBRANÇA ──
      if (data.responsavelCobranca) {
        doc.rect(leftMargin, y, contentWidth, 22).fill(blueAccent);
        doc.fontSize(10).fillColor("#ffffff").font("Helvetica-Bold");
        doc.text("RESPONSÁVEL PELA COBRANÇA", leftMargin + 10, y + 6, { width: contentWidth - 20 });
        y += 30;

        doc.fontSize(12).font("Helvetica-Bold").fillColor(darkGray);
        doc.text(`${data.responsavelCobranca}`, leftMargin + 10, y);
        doc.fontSize(9).font("Helvetica").fillColor(mediumGray);
        doc.text("Responsável pelas ações de cobrança nos dias 1, 3 e 5 após vencimento", leftMargin + 10, doc.y + 3);
        doc.fontSize(8.5).font("Helvetica").fillColor(blueAccent);
        doc.text("Régua de Cobrança:", leftMargin + 10, doc.y + 6);
        doc.fontSize(8).font("Helvetica").fillColor(mediumGray);
        doc.text("• Dia 1: WhatsApp + E-mail (registro formal)", leftMargin + 18, doc.y + 3);
        doc.text("• Dia 3: Ligação + E-mail (2º contato)", leftMargin + 18, doc.y + 2);
        doc.text("• Dia 5: Ligação + E-mail (último contato, aviso de protesto)", leftMargin + 18, doc.y + 2);
        y = doc.y + 12;
      }

      // ── HISTÓRICO DE AÇÕES ──
      doc.rect(leftMargin, y, contentWidth, 22).fill(darkGreen);
      doc.fontSize(10).fillColor("#ffffff").font("Helvetica-Bold");
      doc.text("HISTÓRICO DE AÇÕES DE COBRANÇA", leftMargin + 10, y + 6, { width: contentWidth - 20 });
      y += 30;

      if (data.acoesCobanca.length === 0) {
        doc.fontSize(9).font("Helvetica").fillColor(redAlert);
        doc.text("Nenhuma ação de cobrança foi registrada.", leftMargin + 10, y);
        y += 18;
      } else {
        for (const acao of data.acoesCobanca) {
          const dataFormatted = acao.data.split("-").reverse().join("/");
          const tipoLabel = TIPO_ACAO_MAP[acao.tipo] || acao.tipo;

          // Row background
          const rowBg = acao.realizada ? "#f0fdf4" : "#fef2f2";
          doc.rect(leftMargin + 5, y - 2, contentWidth - 10, 16).fill(rowBg);

          // Icon - draw circle
          const circleX = leftMargin + 16;
          const circleY = y + 5;
          if (acao.realizada) {
            doc.circle(circleX, circleY, 5).fill(greenOk);
            doc.fontSize(7).font("Helvetica-Bold").fillColor("#ffffff");
            doc.text("OK", circleX - 5, circleY - 3.5, { width: 10, align: "center" });
          } else {
            doc.circle(circleX, circleY, 5).fill(redAlert);
            doc.fontSize(7).font("Helvetica-Bold").fillColor("#ffffff");
            doc.text("X", circleX - 5, circleY - 3.5, { width: 10, align: "center" });
          }

          // Day
          doc.fontSize(9).font("Helvetica-Bold").fillColor(darkGray);
          doc.text(`Dia ${acao.dia}`, leftMargin + 28, y);

          // Date
          doc.font("Helvetica").fillColor(mediumGray);
          doc.text(`(${dataFormatted})`, leftMargin + 60, y);

          // Type
          doc.font("Helvetica").fillColor(acao.realizada ? mediumGray : redAlert);
          doc.text(tipoLabel, leftMargin + 120, y);

          y += 16;

          // Notes
          if (acao.notas) {
            doc.fontSize(8).font("Helvetica").fillColor(lightGray);
            doc.text(`   > ${acao.notas}`, leftMargin + 28, y, { width: contentWidth - 40 });
            y += 14;
          }
        }
      }

      y += 10;

      // ── COMUNICADO AO VENDEDOR ──
      doc.rect(leftMargin, y, contentWidth, 22).fill(amberDark);
      doc.fontSize(10).fillColor("#ffffff").font("Helvetica-Bold");
      doc.text("COMUNICADO AO VENDEDOR — DEFINIÇÃO DE PRÓXIMOS PASSOS", leftMargin + 10, y + 6, { width: contentWidth - 20 });
      y += 30;

      doc.fontSize(9.5).font("Helvetica").fillColor(darkGray).lineGap(4);

      const responsavelTexto = data.responsavelCobranca || "o setor responsável";

      const paragraphs = [
        `Prezado(a) Sr(a). ${data.vendedor},`,
        `Por meio deste documento, informamos que o cliente ${data.cliente}, que está sob sua responsabilidade comercial, encontra-se INADIMPLENTE há ${data.diasAtraso} dias.`,
        `Conforme o protocolo interno de cobrança da empresa, a opção selecionada para este cliente foi "NÃO PROTESTAR AUTOMATICAMENTE", o que significa que o título NÃO será encaminhado a cartório para protesto.`,
        `Informamos que todas as ações de cobrança previstas no protocolo foram executadas por ${responsavelTexto} conforme a régua de cobrança: Dia 1 (WhatsApp + E-mail), Dia 3 (Ligação + E-mail) e Dia 5 (Ligação + E-mail). Todas as ações foram registradas formalmente no sistema.`,
        `Apesar dos esforços realizados, o cliente não efetuou o pagamento do valor em aberto de ${valorFormatted}.`,
      ];

      for (const p of paragraphs) {
        doc.text(p, leftMargin + 10, y, { width: contentWidth - 20, align: "justify" });
        y = doc.y + 8;
      }

      // Highlight box - DECISÃO DO VENDEDOR (com altura dinâmica)
      y += 5;
      const boxX = leftMargin + 5;
      const boxWidth = contentWidth - 10;
      const textX = boxX + 14;
      const textWidth = boxWidth - 25;

      const line1 = "SOLICITAMOS QUE DEFINA O PRÓXIMO PASSO PARA ESTE CLIENTE:";
      const line2 = "• Manter a cobrança ativa (o responsável continuará as tentativas de contato)";
      const line3 = "• Negociar diretamente com o cliente";
      const line4 = "• Encaminhar para protesto manual";
      const line5 = "• Outra ação que julgar necessária";

      // Calcular altura necessária
      const heightLine1 = doc.fontSize(9.5).font("Helvetica-Bold").heightOfString(line1, { width: textWidth });
      const heightLines = doc.fontSize(9).font("Helvetica").heightOfString(line2 + "\n" + line3 + "\n" + line4 + "\n" + line5, { width: textWidth });
      const totalBoxHeight = 16 + heightLine1 + 6 + heightLines + 16;

      // Verificar se o box + footer + texto final cabem na página atual
      const footerHeight = 80; // footer + disclaimer
      const disclaimerHeight = 50;
      const neededSpace = totalBoxHeight + disclaimerHeight + footerHeight;
      const pageBottom = doc.page.height - doc.page.margins.bottom;
      if (y + neededSpace > pageBottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      // Desenhar o box com altura correta
      doc.rect(boxX, y, boxWidth, totalBoxHeight).fill("#fffbeb").stroke();
      doc.rect(boxX, y, 4, totalBoxHeight).fill(amberDark);

      doc.fontSize(9.5).font("Helvetica-Bold").fillColor(amberDark);
      doc.text(line1, textX, y + 10, { width: textWidth, align: "left" });

      const afterTitle = doc.y + 6;
      doc.fontSize(9).font("Helvetica").fillColor(darkGray);
      doc.text(line2, textX, afterTitle, { width: textWidth });
      doc.text(line3, textX, doc.y + 2, { width: textWidth });
      doc.text(line4, textX, doc.y + 2, { width: textWidth });
      doc.text(line5, textX, doc.y + 2, { width: textWidth });

      y = y + totalBoxHeight + 15;

      doc.fontSize(8.5).font("Helvetica").fillColor(mediumGray).lineGap(3);
      doc.text(
        "Este documento ficará registrado no sistema e visível para toda a equipe como comprovante de que o processo de cobrança foi conduzido corretamente e que a definição dos próximos passos cabe ao vendedor responsável.",
        leftMargin + 10,
        y,
        { width: contentWidth - 20, align: "justify" }
      );

      y = doc.y + 20;

      // Verificar se footer cabe na página atual
      if (y + footerHeight > pageBottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      // ── FOOTER ──
      doc.moveTo(leftMargin, y).lineTo(leftMargin + contentWidth, y).lineWidth(1).strokeColor(mediumGreen).stroke();
      y += 8;

      doc.fontSize(8).font("Helvetica").fillColor(lightGray);
      doc.text(`Gerado automaticamente em: ${data.dataEmissao}`, leftMargin, y);
      doc.text("Sistema: Grupo Fox - Dashboard de Gestão", leftMargin, y + 12);
      doc.text(`Protocolo: ${data.protocolo}`, leftMargin, y + 24);

      doc.text("Documento gerado eletronicamente — não necessita de assinatura", leftMargin, y + 12, {
        align: "right",
        width: contentWidth,
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
