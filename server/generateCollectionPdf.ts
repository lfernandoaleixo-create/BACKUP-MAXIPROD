import PDFDocument from "pdfkit";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png";

interface CollectionDocData {
  cliente: string;
  vendedor: string;
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
          Title: "Documento de Transferência de Responsabilidade",
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
      const bgLight = "#f0fdf4";

      // ── HEADER ──
      const logoBuf = await fetchLogoBuffer();
      if (logoBuf) {
        doc.image(logoBuf, leftMargin, 35, { width: 80 });
      }

      // Header line
      doc.moveTo(leftMargin, 85).lineTo(leftMargin + contentWidth, 85).lineWidth(2).strokeColor(darkGreen).stroke();

      // Title
      doc.fontSize(16).fillColor(darkGreen).font("Helvetica-Bold");
      doc.text("DOCUMENTO DE TRANSFERÊNCIA", leftMargin, 95, { align: "center", width: contentWidth });
      doc.text("DE RESPONSABILIDADE", leftMargin, 113, { align: "center", width: contentWidth });

      doc.fontSize(10).fillColor(mediumGray).font("Helvetica");
      doc.text("COBRANÇA DE INADIMPLÊNCIA", leftMargin, 133, { align: "center", width: contentWidth });

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
        // Alternating bg
        if (dataRows.indexOf([label, value] as any) % 2 === 0) {
          // light bg
        }
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
          const icon = acao.realizada ? "✓" : "✗";
          const iconColor = acao.realizada ? greenOk : redAlert;

          // Row background
          const rowBg = acao.realizada ? "#f0fdf4" : "#fef2f2";
          doc.rect(leftMargin + 5, y - 2, contentWidth - 10, 16).fill(rowBg);

          // Icon - draw circle instead of Unicode character
          const circleX = leftMargin + 16;
          const circleY = y + 5;
          if (acao.realizada) {
            // Green filled circle with checkmark text
            doc.circle(circleX, circleY, 5).fill(greenOk);
            doc.fontSize(7).font("Helvetica-Bold").fillColor("#ffffff");
            doc.text("OK", circleX - 5, circleY - 3.5, { width: 10, align: "center" });
          } else {
            // Red filled circle with X text
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

      // ── COMUNICADO FORMAL ──
      doc.rect(leftMargin, y, contentWidth, 22).fill(redAlert);
      doc.fontSize(10).fillColor("#ffffff").font("Helvetica-Bold");
      doc.text("COMUNICADO FORMAL", leftMargin + 10, y + 6, { width: contentWidth - 20 });
      y += 30;

      // Border box for the formal text
      const formalStartY = y;
      doc.fontSize(9.5).font("Helvetica").fillColor(darkGray).lineGap(4);

      const paragraphs = [
        `Prezado(a) Sr(a). ${data.vendedor},`,
        `Por meio deste documento, informamos que o cliente ${data.cliente}, que está sob sua responsabilidade comercial, encontra-se INADIMPLENTE há ${data.diasAtraso} dias.`,
        `Conforme o protocolo interno de cobrança da empresa, a opção selecionada para este cliente foi "NÃO PROTESTAR AUTOMATICAMENTE", o que significa que o título NÃO será encaminhado a cartório para protesto.`,
        `Informamos que TODAS as medidas cabíveis e protocolares de cobrança já foram devidamente executadas pelo setor responsável, conforme detalhado no histórico acima.`,
        `Apesar de todos os esforços realizados, o cliente não efetuou o pagamento do valor em aberto de ${valorFormatted}.`,
      ];

      for (const p of paragraphs) {
        doc.text(p, leftMargin + 10, y, { width: contentWidth - 20, align: "justify" });
        y = doc.y + 8;
      }

      // Highlight box for responsibility transfer
      y += 5;
      doc.rect(leftMargin + 5, y, contentWidth - 10, 55).fill("#fef2f2").stroke();
      doc.rect(leftMargin + 5, y, 4, 55).fill(redAlert);

      doc.fontSize(10).font("Helvetica-Bold").fillColor(redAlert);
      doc.text(
        "A PARTIR DESTA DATA, A RESPONSABILIDADE PELA RESOLUÇÃO DESTA INADIMPLÊNCIA É INTEIRAMENTE SUA,",
        leftMargin + 18,
        y + 8,
        { width: contentWidth - 35, align: "left" }
      );
      doc.fontSize(9.5).font("Helvetica").fillColor(darkGray);
      doc.text(
        "cabendo ao(à) senhor(a) tomar as medidas que julgar necessárias para a regularização do débito.",
        leftMargin + 18,
        doc.y + 2,
        { width: contentWidth - 35, align: "left" }
      );

      y = doc.y + 20;

      doc.fontSize(8.5).font("Helvetica").fillColor(mediumGray).lineGap(3);
      doc.text(
        "Este documento ficará registrado no sistema e visível para toda a equipe como comprovante de que o processo de cobrança foi conduzido corretamente e que a responsabilidade foi formalmente transferida.",
        leftMargin + 10,
        y,
        { width: contentWidth - 20, align: "justify" }
      );

      y = doc.y + 20;

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
