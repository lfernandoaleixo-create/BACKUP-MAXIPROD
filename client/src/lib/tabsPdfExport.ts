/**
 * PDF Export utilities for Fornecedores Brasileiros and Métrica de Vendas tabs
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Logo B&W for PDF headers
const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png";
const LOGO_RATIO = 2.11; // width/height

// Trophy image for Best Seller PDF
const TROPHY_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663487476806/TMh5HqmzfeBw9KakgJtjjo/download_88c919e4.png";

let trophyBase64Cache: string | null = null;

async function getTrophyBase64(): Promise<string | null> {
  if (trophyBase64Cache) return trophyBase64Cache;
  try {
    const response = await fetch(TROPHY_URL);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        trophyBase64Cache = reader.result as string;
        resolve(trophyBase64Cache);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

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

// Pre-load logo and trophy on module init
getLogoBase64();
getTrophyBase64();

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
}

async function drawHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageW = doc.internal.pageSize.getWidth();
  // Dark header bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageW, 36, "F");
  // Teal accent line
  doc.setFillColor(13, 148, 136); // teal-600
  doc.rect(0, 36, pageW, 2, "F");

  // Logo
  const logoData = await getLogoBase64();
  if (logoData) {
    const logoH = 12;
    const logoW = logoH * LOGO_RATIO;
    doc.addImage(logoData, "PNG", pageW - 14 - logoW, 4, logoW, logoH);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("GRUPO FOX", 14, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 22);
  if (subtitle) {
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(subtitle, 14, 30);
  }
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageW - 14 - doc.getTextWidth(`Gerado em: ${new Date().toLocaleString("pt-BR")}`), 30);
}

function drawFooter(doc: jsPDF, finalY: number, text: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setDrawColor(226, 232, 240);
  doc.line(14, finalY + 6, pageW - 14, finalY + 6);
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.text(text, 14, finalY + 12);
  doc.text("Documento gerado automaticamente", pageW - 14 - doc.getTextWidth("Documento gerado automaticamente"), finalY + 12);
}

// ===== PROSPECÇÃO (Fornecedores por segmento/estado) =====
export async function exportProspeccaoPdf(data: {
  suppliers: Array<{ nome: string; cidade: string; estado: string; segmento: string; contactCount: number }>;
  segmento?: string;
  estado?: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const subtitle = [data.segmento, data.estado].filter(Boolean).join(" / ") || "Todos os segmentos";
  await drawHeader(doc, "Prospecção — Fornecedores Brasileiros", subtitle);

  let y = 44;

  // Summary
  doc.setFillColor(13, 148, 136);
  doc.roundedRect(14, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("TOTAL FORNECEDORES", 18, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(data.suppliers.length), 18, y + 14);

  const contatados = data.suppliers.filter(s => s.contactCount > 0).length;
  doc.setFillColor(71, 85, 105);
  doc.roundedRect(75, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("JÁ CONTATADOS", 79, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(contatados), 79, y + 14);

  y += 26;

  // Table
  const tableData = data.suppliers.map(s => [
    s.nome,
    s.cidade,
    s.estado,
    s.segmento,
    s.contactCount > 0 ? `${s.contactCount} contato(s)` : "Sem contato",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Fornecedor", "Cidade", "UF", "Segmento", "Contatos"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold", cellPadding: 3 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 35 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 40 },
      4: { cellWidth: 30, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (d: any) => {
      if (d.section === "body" && d.column.index === 4) {
        if (d.cell.raw === "Sem contato") {
          d.cell.styles.textColor = [220, 38, 38];
        } else {
          d.cell.styles.textColor = [21, 128, 61];
          d.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  drawFooter(doc, finalY, "Grupo Fox — Prospecção de Fornecedores Brasileiros");

  const fileName = `Prospeccao_${data.segmento || "Todos"}_${data.estado || "Todos"}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}

// ===== RANKING DE VENDEDORES (Fornecedores Brasileiros) =====
export async function exportRankingFornecedoresPdf(data: {
  ranking: Array<{ vendedor: string; totalContatos: number; conversoes: number }>;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await drawHeader(doc, "Ranking de Vendedores — Fornecedores Brasileiros");

  let y = 44;

  const totalContatos = data.ranking.reduce((s, v) => s + v.totalContatos, 0);
  const totalConversoes = data.ranking.reduce((s, v) => s + v.conversoes, 0);

  // Summary boxes
  doc.setFillColor(13, 148, 136);
  doc.roundedRect(14, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("TOTAL CONTATOS", 18, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(totalContatos), 18, y + 14);

  doc.setFillColor(16, 185, 129);
  doc.roundedRect(75, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("TOTAL CONVERSÕES", 79, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(totalConversoes), 79, y + 14);

  doc.setFillColor(71, 85, 105);
  doc.roundedRect(136, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("VENDEDORES", 140, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(data.ranking.length), 140, y + 14);

  y += 26;

  // Table
  const tableData = data.ranking.map((v, idx) => {
    const efficiency = v.totalContatos > 0 ? ((v.conversoes / v.totalContatos) * 100).toFixed(1) : "0.0";
    return [
      `${idx + 1}º`,
      v.vendedor,
      String(v.totalContatos),
      String(v.conversoes),
      `${efficiency}%`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["#", "Vendedor", "Contatos", "Conversões", "Eficiência"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold", cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 60 },
      2: { cellWidth: 30, halign: "center" },
      3: { cellWidth: 30, halign: "center" },
      4: { cellWidth: 30, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (d: any) => {
      if (d.section === "body" && d.column.index === 0 && d.row.index === 0) {
        d.cell.styles.textColor = [217, 119, 6]; // amber
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  drawFooter(doc, finalY, "Grupo Fox — Ranking de Vendedores (Prospecção)");
  doc.save(`Ranking_Fornecedores_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ===== POR STATUS (Fornecedores Brasileiros) =====
export async function exportStatusPdf(data: {
  contacts: Array<{ supplierNome: string; supplierEstado: string; supplierCidade: string; vendedor: string; status: string; observacao?: string }>;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await drawHeader(doc, "Fornecedores por Status — Prospecção");

  let y = 44;

  const statusLabels: Record<string, string> = {
    ja_cliente: "Já é cliente",
    possivel_cliente: "Possível cliente",
    novo_cliente: "Novo cliente",
    sem_interesse: "Sem interesse",
    nao_possivel_contato: "S/ Contato",
  };

  // Summary per status
  const statusCounts: Record<string, number> = {};
  data.contacts.forEach(c => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  });

  let boxX = 14;
  const statusColors: Record<string, [number, number, number]> = {
    novo_cliente: [16, 185, 129],
    possivel_cliente: [245, 158, 11],
    ja_cliente: [59, 130, 246],
    sem_interesse: [239, 68, 68],
    nao_possivel_contato: [168, 85, 247],
  };

  Object.entries(statusCounts).forEach(([status, count]) => {
    const color = statusColors[status] || [100, 116, 139];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(boxX, y, 48, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(statusLabels[status] || status, boxX + 4, y + 5.5);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(String(count), boxX + 4, y + 13);
    boxX += 52;
  });

  y += 24;

  // Table
  const tableData = data.contacts.map(c => [
    c.supplierNome,
    c.supplierCidade,
    c.supplierEstado,
    c.vendedor,
    statusLabels[c.status] || c.status,
    c.observacao || "-",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Fornecedor", "Cidade", "UF", "Vendedor", "Status", "Observação"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold", cellPadding: 3 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 35 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 30 },
      4: { cellWidth: 30, halign: "center" },
      5: { cellWidth: 95 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (d: any) => {
      if (d.section === "body" && d.column.index === 4) {
        const val = d.cell.raw;
        if (val === "Novo cliente") d.cell.styles.textColor = [16, 185, 129];
        else if (val === "Possível cliente") d.cell.styles.textColor = [245, 158, 11];
        else if (val === "Já é cliente") d.cell.styles.textColor = [59, 130, 246];
        else if (val === "Sem interesse") d.cell.styles.textColor = [239, 68, 68];
        else if (val === "S/ Contato") d.cell.styles.textColor = [168, 85, 247];
        d.cell.styles.fontStyle = "bold";
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  drawFooter(doc, finalY, "Grupo Fox — Fornecedores por Status");
  doc.save(`Status_Fornecedores_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ===== HISTÓRICO DE MIGRAÇÕES =====
export async function exportHistoricoPdf(data: {
  history: Array<{
    supplierNome: string;
    supplierEstado: string;
    vendedor: string;
    statusAnterior: string | null;
    statusNovo: string;
    formaContato: string;
    formaContatoOutra?: string;
    observacao?: string;
    createdAt: string;
  }>;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await drawHeader(doc, "Histórico de Migrações — Prospecção", `${data.history.length} registros`);

  let y = 44;

  const statusLabels: Record<string, string> = {
    ja_cliente: "Já é cliente",
    possivel_cliente: "Possível cliente",
    novo_cliente: "Novo cliente",
    sem_interesse: "Sem interesse",
    nao_possivel_contato: "S/ Contato",
  };

  const formaLabel = (f: string, outra?: string) => {
    if (f === "ligacao") return "Ligação";
    if (f === "email") return "Email";
    if (f === "whatsapp") return "WhatsApp";
    return outra || "Outra";
  };

  const tableData = data.history.map(m => [
    formatDate(m.createdAt),
    m.supplierNome,
    m.supplierEstado,
    m.vendedor,
    m.statusAnterior ? statusLabels[m.statusAnterior] || m.statusAnterior : "Primeiro contato",
    statusLabels[m.statusNovo] || m.statusNovo,
    formaLabel(m.formaContato, m.formaContatoOutra),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Data", "Fornecedor", "UF", "Vendedor", "Status Anterior", "Novo Status", "Via"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold", cellPadding: 3 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 60 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 30 },
      4: { cellWidth: 35, halign: "center" },
      5: { cellWidth: 35, halign: "center" },
      6: { cellWidth: 25, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (d: any) => {
      if (d.section === "body" && d.column.index === 5) {
        const val = d.cell.raw;
        if (val === "Novo cliente") d.cell.styles.textColor = [16, 185, 129];
        else if (val === "Possível cliente") d.cell.styles.textColor = [245, 158, 11];
        else if (val === "Já é cliente") d.cell.styles.textColor = [59, 130, 246];
        else if (val === "Sem interesse") d.cell.styles.textColor = [239, 68, 68];
        else if (val === "S/ Contato") d.cell.styles.textColor = [168, 85, 247];
        d.cell.styles.fontStyle = "bold";
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  drawFooter(doc, finalY, "Grupo Fox — Histórico de Migrações de Status");
  doc.save(`Historico_Migracoes_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ===== RANKING DE VENDEDORES (Métrica de Vendas) =====
export async function exportRankingVendasPdf(data: {
  ranking: Array<{ vendedor: string; totalVendas: number; qtdPedidos: number; qtdClientes: number }>;
  periodLabel: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await drawHeader(doc, "Ranking de Vendedores — Métrica de Vendas", data.periodLabel);

  let y = 44;

  const totalVendas = data.ranking.reduce((s, v) => s + v.totalVendas, 0);
  const totalPedidos = data.ranking.reduce((s, v) => s + v.qtdPedidos, 0);
  const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;

  // Summary boxes
  doc.setFillColor(13, 148, 136);
  doc.roundedRect(14, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("TOTAL VENDAS", 18, y + 6);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(totalVendas), 18, y + 14);

  doc.setFillColor(71, 85, 105);
  doc.roundedRect(75, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("TOTAL PEDIDOS", 79, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(totalPedidos), 79, y + 14);

  doc.setFillColor(126, 34, 206);
  doc.roundedRect(136, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("TICKET MÉDIO", 140, y + 6);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(ticketMedio), 140, y + 14);

  y += 26;

  // Table
  const tableData = data.ranking.map((v, idx) => {
    const pct = totalVendas > 0 ? ((v.totalVendas / totalVendas) * 100).toFixed(1) : "0.0";
    return [
      `${idx + 1}º`,
      v.vendedor,
      String(v.qtdPedidos),
      String(v.qtdClientes),
      formatCurrency(v.totalVendas),
      `${pct}%`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["#", "Vendedor", "Pedidos", "Clientes", "Total Vendas", "% do Total"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold", cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 50 },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 38, halign: "right", fontStyle: "bold" },
      5: { cellWidth: 25, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (d: any) => {
      if (d.section === "body" && d.column.index === 4) {
        d.cell.styles.textColor = [13, 148, 136]; // teal
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  drawFooter(doc, finalY, "Grupo Fox — Ranking de Vendedores (Vendas)");
  doc.save(`Ranking_Vendas_${data.periodLabel.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ===== INADIMPLÊNCIA (Métrica de Vendas) =====
export async function exportInadimplenciaPdf(data: {
  inadimplencia: Array<{
    vendedor: string;
    qtdClientesInadimplentes: number;
    totalDevido: number;
    clientes: Array<{ nome: string; qtdTitulos: number; totalDevido: number }>;
  }>;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await drawHeader(doc, "Inadimplência por Vendedor — Métrica de Vendas");

  let y = 44;

  const totalClientes = data.inadimplencia.reduce((s, v) => s + v.qtdClientesInadimplentes, 0);
  const totalDevido = data.inadimplencia.reduce((s, v) => s + v.totalDevido, 0);

  // Summary boxes
  doc.setFillColor(239, 68, 68); // red
  doc.roundedRect(14, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("TOTAL EM ABERTO", 18, y + 6);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(totalDevido), 18, y + 14);

  doc.setFillColor(71, 85, 105);
  doc.roundedRect(75, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("CLIENTES INADIMPLENTES", 79, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(totalClientes), 79, y + 14);

  doc.setFillColor(126, 34, 206);
  doc.roundedRect(136, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("VENDEDORES", 140, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(data.inadimplencia.length), 140, y + 14);

  y += 26;

  // Table with all clients grouped by vendedor
  const tableData: string[][] = [];
  data.inadimplencia.forEach(v => {
    v.clientes.forEach((c, idx) => {
      tableData.push([
        idx === 0 ? v.vendedor : "",
        c.nome,
        String(c.qtdTitulos),
        formatCurrency(c.totalDevido),
      ]);
    });
    // Subtotal row
    tableData.push([
      "",
      `SUBTOTAL (${v.vendedor})`,
      String(v.clientes.reduce((s, c) => s + c.qtdTitulos, 0)),
      formatCurrency(v.totalDevido),
    ]);
  });

  autoTable(doc, {
    startY: y,
    head: [["Vendedor", "Cliente", "Títulos", "Valor Devido"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold", cellPadding: 3 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: "bold" },
      1: { cellWidth: 75 },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 35, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (d: any) => {
      if (d.section === "body" && d.column.index === 1 && typeof d.cell.raw === "string" && d.cell.raw.startsWith("SUBTOTAL")) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.fillColor = [254, 242, 242]; // red-50
        d.cell.styles.textColor = [185, 28, 28]; // red-700
      }
      if (d.section === "body" && d.column.index === 3 && d.row.raw && typeof d.row.raw[1] === "string" && d.row.raw[1].startsWith("SUBTOTAL")) {
        d.cell.styles.textColor = [185, 28, 28];
        d.cell.styles.fillColor = [254, 242, 242];
      }
      if (d.section === "body" && d.column.index === 2 && d.row.raw && typeof d.row.raw[1] === "string" && d.row.raw[1].startsWith("SUBTOTAL")) {
        d.cell.styles.fillColor = [254, 242, 242];
        d.cell.styles.textColor = [185, 28, 28];
      }
      if (d.section === "body" && d.column.index === 0 && d.row.raw && typeof d.row.raw[1] === "string" && d.row.raw[1].startsWith("SUBTOTAL")) {
        d.cell.styles.fillColor = [254, 242, 242];
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  drawFooter(doc, finalY, "Grupo Fox — Inadimplência por Vendedor");
  doc.save(`Inadimplencia_Vendedores_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ===== DETALHE DO VENDEDOR (Métrica de Vendas) =====
export async function exportVendedorDetailPdf(data: {
  vendedor: string;
  periodLabel: string;
  filterEstados: string[];
  filterSegmentos: string[];
  clientes: Array<{
    cliente: string;
    totalVendas: number;
    qtdPedidos: number;
    ultimoPedido: string;
    estadosConfiguraveis?: string[];
    segmentos?: string[];
    vendedoresReais?: string[];
  }>;
  estadoBreakdown?: Array<{ estado: string; total: number; count: number }> | null;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Build subtitle with filters
  const filterParts: string[] = [data.periodLabel];
  if (data.filterEstados.length > 0) filterParts.push(`Estado: ${data.filterEstados.join(", ")}`);
  if (data.filterSegmentos.length > 0) filterParts.push(`Segmento: ${data.filterSegmentos.join(", ")}`);
  const subtitle = filterParts.join(" | ");

  await drawHeader(doc, `Vendas de ${data.vendedor}`, subtitle);

  let y = 44;
  const pageW = doc.internal.pageSize.getWidth();

  // KPI Summary boxes
  const totalVendas = data.clientes.reduce((s, c) => s + c.totalVendas, 0);
  const totalPedidos = data.clientes.reduce((s, c) => s + c.qtdPedidos, 0);
  const totalClientes = data.clientes.length;
  const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;

  // Box 1 - Total Vendas
  doc.setFillColor(13, 148, 136); // teal-600
  doc.roundedRect(14, y, 43, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("TOTAL VENDAS", 17, y + 6);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(totalVendas), 17, y + 14);

  // Box 2 - Pedidos
  doc.setFillColor(71, 85, 105); // slate-600
  doc.roundedRect(61, y, 43, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("PEDIDOS", 64, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(totalPedidos), 64, y + 14);

  // Box 3 - Clientes
  doc.setFillColor(59, 130, 246); // blue-500
  doc.roundedRect(108, y, 43, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("CLIENTES", 111, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(totalClientes), 111, y + 14);

  // Box 4 - Ticket Médio
  doc.setFillColor(126, 34, 206); // purple-700
  doc.roundedRect(155, y, 43, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("TICKET MÉDIO", 158, y + 6);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(ticketMedio), 158, y + 14);

  y += 24;

  // Estado breakdown if available
  if (data.estadoBreakdown && data.estadoBreakdown.length > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Detalhamento por Estado Configurável:", 14, y);
    y += 4;

    let boxX = 14;
    const boxWidth = Math.min(45, (pageW - 28) / data.estadoBreakdown.length - 4);
    data.estadoBreakdown.forEach(eb => {
      doc.setFillColor(240, 253, 244); // green-50
      doc.setDrawColor(167, 243, 208); // green-200
      doc.roundedRect(boxX, y, boxWidth, 14, 1.5, 1.5, "FD");
      doc.setTextColor(21, 128, 61);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.text(eb.estado, boxX + 3, y + 5);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(8);
      doc.text(formatCurrency(eb.total), boxX + 3, y + 11);
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6);
      doc.text(`${eb.count} cli.`, boxX + boxWidth - 12, y + 11);
      boxX += boxWidth + 4;
    });
    y += 20;
  }

  // Table with client details
  const tableData = data.clientes.map((c, idx) => {
    const tags: string[] = [];
    if (c.estadosConfiguraveis) tags.push(...c.estadosConfiguraveis);
    if (c.segmentos) tags.push(...c.segmentos);
    return [
      String(idx + 1),
      c.cliente,
      String(c.qtdPedidos),
      formatDate(c.ultimoPedido),
      tags.join(", ") || "-",
      formatCurrency(c.totalVendas),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["#", "Cliente", "Ped.", "Último Pedido", "Estado / Segmento", "Total"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold", cellPadding: 2.5 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 55 },
      2: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 45 },
      5: { cellWidth: 30, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (d: any) => {
      if (d.section === "body" && d.column.index === 5) {
        d.cell.styles.textColor = [13, 148, 136]; // teal
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  drawFooter(doc, finalY, `Grupo Fox — Vendas de ${data.vendedor}`);

  const safeName = data.vendedor.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`Vendas_${safeName}_${data.periodLabel.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ===== WHATSAPP SHARE UTILITY =====
/**
 * Generates a PDF using the provided generator function and shares it via WhatsApp.
 * Since WhatsApp Web doesn't support direct file sharing via URL, we:
 * 1. Generate the PDF blob
 * 2. Use the Web Share API if available (mobile), or
 * 3. Download the PDF and open WhatsApp with a text message
 */
export async function sharePdfViaWhatsApp(
  generatePdf: () => Promise<jsPDF>,
  fileName: string,
  message?: string
) {
  const doc = await generatePdf();
  const pdfBlob = doc.output("blob");
  const file = new File([pdfBlob], fileName, { type: "application/pdf" });

  // Try Web Share API first (works on mobile)
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: fileName.replace(".pdf", ""),
        text: message || "Relatório Grupo Fox",
      });
      return true;
    } catch (err: any) {
      if (err.name === "AbortError") return false;
      // Fallback below
    }
  }

  // Fallback: download the file and open WhatsApp with message
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  // Open WhatsApp with a text message
  const whatsappText = encodeURIComponent(message || `📊 Relatório: ${fileName.replace(".pdf", "").replace(/_/g, " ")}`);
  window.open(`https://wa.me/?text=${whatsappText}`, "_blank");
  return true;
}

// ===== INADIMPLÊNCIA DETALHE POR VENDEDOR =====
export async function exportInadimplenciaDetailPdf(data: {
  vendedor: string;
  clientes: Array<{
    nome: string;
    qtdTitulos: number;
    totalDevido: number;
    titulos?: Array<{ descricao: string; valor: number; vencimento: string; diasAtraso: number }>;
  }>;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await drawHeader(doc, `Inadimplência — ${data.vendedor}`, `${data.clientes.length} clientes inadimplentes`);

  let y = 44;
  const pageW = doc.internal.pageSize.getWidth();

  // KPI boxes
  const totalDevido = data.clientes.reduce((s, c) => s + c.totalDevido, 0);
  const totalTitulos = data.clientes.reduce((s, c) => s + c.qtdTitulos, 0);
  const totalClientes = data.clientes.length;

  // Box 1 - Total em Aberto
  doc.setFillColor(220, 38, 38); // red-600
  doc.roundedRect(14, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("TOTAL EM ABERTO", 18, y + 6);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(totalDevido), 18, y + 14);

  // Box 2 - Títulos Vencidos
  doc.setFillColor(71, 85, 105); // slate-600
  doc.roundedRect(75, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("TÍTULOS VENCIDOS", 79, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(totalTitulos), 79, y + 14);

  // Box 3 - Clientes
  doc.setFillColor(245, 158, 11); // amber-500
  doc.roundedRect(136, y, 55, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("CLIENTES INADIMPLENTES", 140, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(totalClientes), 140, y + 14);

  y += 26;

  // Table with client details
  const tableData = data.clientes.map((c, idx) => [
    String(idx + 1),
    c.nome,
    String(c.qtdTitulos),
    formatCurrency(c.totalDevido),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Cliente", "Títulos", "Total Devido"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold", cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 95 },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 40, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (d: any) => {
      if (d.section === "body" && d.column.index === 3) {
        d.cell.styles.textColor = [220, 38, 38]; // red
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  drawFooter(doc, finalY, `Grupo Fox — Inadimplência de ${data.vendedor}`);

  const safeName = data.vendedor.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`Inadimplencia_${safeName}_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ===== MELHOR VENDEDOR PDF EXPORT =====
export async function exportBestSellerPdf(data: {
  period: string;
  periodLabel: string;
  dateRange: string;
  winner: {
    name: string;
    totalValue: number;
    orders: number;
    clients: number;
    items: number;
    faturado: number;
    aFaturar: number;
    bySegmento: Array<{ name: string; value: number }>;
    byCrmSegmento: Array<{ name: string; value: number }>;
    byUF: Array<{ name: string; value: number }>;
    topClients: Array<{ name: string; value: number }>;
    topProducts: Array<{ name: string; value: number }>;
  };
  allSellers: Array<{
    name: string;
    totalValue: number;
    orders: number;
    clients: number;
  }>;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await drawHeader(doc, `Melhor Vendedor — ${data.periodLabel}`, data.dateRange);

  let y = 44;
  const pageW = doc.internal.pageSize.getWidth();
  const w = data.winner;

  // Winner highlight
  doc.setFillColor(255, 251, 235); // amber-50
  doc.setDrawColor(251, 191, 36); // amber-400
  doc.roundedRect(14, y, pageW - 28, 22, 3, 3, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text("MELHOR VENDEDOR", 20, y + 7);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(w.name, 20, y + 16);
  // Trophy image
  const trophyImg = await getTrophyBase64();
  if (trophyImg) {
    const trophySize = 18;
    doc.addImage(trophyImg, "PNG", pageW - 34, y + 2, trophySize, trophySize);
  }
  y += 28;

  // KPI boxes
  const boxW = (pageW - 28 - 12) / 4;
  const kpis = [
    { label: "TOTAL VENDAS", value: formatCurrency(w.totalValue), color: [13, 148, 136] },
    { label: "PEDIDOS", value: String(w.orders), color: [71, 85, 105] },
    { label: "CLIENTES", value: String(w.clients), color: [59, 130, 246] },
    { label: "ITENS", value: String(w.items), color: [234, 88, 12] },
  ];
  kpis.forEach((kpi, i) => {
    const x = 14 + i * (boxW + 4);
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.roundedRect(x, y, boxW, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label, x + 3, y + 5.5);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.value, x + 3, y + 12.5);
  });
  y += 22;

  // Faturado vs A Faturar
  const halfW = (pageW - 28 - 4) / 2;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, y, halfW, 12, 1.5, 1.5, "FD");
  doc.setTextColor(21, 128, 61);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("Faturado", 17, y + 4.5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(w.faturado), 17, y + 9.5);

  doc.setFillColor(239, 246, 255); // blue-50
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(14 + halfW + 4, y, halfW, 12, 1.5, 1.5, "FD");
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("A Faturar", 17 + halfW + 4, y + 4.5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(w.aFaturar), 17 + halfW + 4, y + 9.5);
  y += 17;

  // Segmentos breakdown
  if (w.bySegmento.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Por Segmento (Estado Configurável):", 14, y);
    y += 4;
    const segData = w.bySegmento.map(s => [s.name, formatCurrency(s.value)]);
    autoTable(doc, {
      startY: y,
      head: [["Segmento", "Valor"]],
      body: segData,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7, cellPadding: 1.5 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 50, halign: "right", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable?.finalY + 5 || y + 20;
  }

  // CRM Segments
  if (w.byCrmSegmento.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Por Segmento CRM:", 14, y);
    y += 4;
    const crmData = w.byCrmSegmento.map(s => [s.name, formatCurrency(s.value)]);
    autoTable(doc, {
      startY: y,
      head: [["Segmento CRM", "Valor"]],
      body: crmData,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7, cellPadding: 1.5 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 50, halign: "right", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable?.finalY + 5 || y + 20;
  }

  // Top Clients
  if (w.topClients.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Top 10 Clientes:", 14, y);
    y += 4;
    const clientData = w.topClients.map((c, i) => [String(i + 1), c.name, formatCurrency(c.value)]);
    autoTable(doc, {
      startY: y,
      head: [["#", "Cliente", "Valor"]],
      body: clientData,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7, cellPadding: 1.5 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 100 }, 2: { cellWidth: 40, halign: "right", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable?.finalY + 5 || y + 20;
  }

  // Top Products
  if (w.topProducts.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Top 10 Produtos:", 14, y);
    y += 4;
    const prodData = w.topProducts.map((p, i) => [String(i + 1), p.name, formatCurrency(p.value)]);
    autoTable(doc, {
      startY: y,
      head: [["#", "Produto", "Valor"]],
      body: prodData,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7, cellPadding: 1.5 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 100 }, 2: { cellWidth: 40, halign: "right", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable?.finalY + 5 || y + 20;
  }

  // Full ranking table
  if (data.allSellers.length > 1) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`Ranking Completo (${data.allSellers.length} vendedores):`, 14, y);
    y += 4;
    const totalAll = data.allSellers.reduce((s, x) => s + x.totalValue, 0);
    const rankData = data.allSellers.map((s, i) => {
      const pct = totalAll > 0 ? ((s.totalValue / totalAll) * 100).toFixed(1) + "%" : "0%";
      return [String(i + 1), s.name, String(s.orders), String(s.clients), pct, formatCurrency(s.totalValue)];
    });
    autoTable(doc, {
      startY: y,
      head: [["#", "Vendedor", "Ped.", "Cli.", "%", "Total"]],
      body: rankData,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7, cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 55 },
        2: { cellWidth: 14, halign: "center" },
        3: { cellWidth: 14, halign: "center" },
        4: { cellWidth: 16, halign: "center" },
        5: { cellWidth: 35, halign: "right", fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (d: any) => {
        if (d.section === "body" && d.column.index === 5) {
          d.cell.styles.textColor = [13, 148, 136];
        }
        if (d.section === "body" && d.row.index === 0) {
          d.cell.styles.fillColor = [255, 251, 235];
          d.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as any).lastAutoTable?.finalY || y + 20;
  }

  drawFooter(doc, y, `Grupo Fox — Melhor Vendedor ${data.periodLabel}`);
  doc.save(`Melhor_Vendedor_${data.periodLabel.replace(/\s+/g, "_")}_${data.dateRange.replace(/\s+/g, "_")}.pdf`);
}
