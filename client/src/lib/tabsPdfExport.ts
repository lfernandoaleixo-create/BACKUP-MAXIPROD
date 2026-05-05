/**
 * PDF Export utilities for Fornecedores Brasileiros and Métrica de Vendas tabs
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
}

function drawHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageW = doc.internal.pageSize.getWidth();
  // Dark header bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageW, 36, "F");
  // Teal accent line
  doc.setFillColor(13, 148, 136); // teal-600
  doc.rect(0, 36, pageW, 2, "F");

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
export function exportProspeccaoPdf(data: {
  suppliers: Array<{ nome: string; cidade: string; estado: string; segmento: string; contactCount: number }>;
  segmento?: string;
  estado?: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const subtitle = [data.segmento, data.estado].filter(Boolean).join(" / ") || "Todos os segmentos";
  drawHeader(doc, "Prospecção — Fornecedores Brasileiros", subtitle);

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
export function exportRankingFornecedoresPdf(data: {
  ranking: Array<{ vendedor: string; totalContatos: number; conversoes: number }>;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawHeader(doc, "Ranking de Vendedores — Fornecedores Brasileiros");

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
export function exportStatusPdf(data: {
  contacts: Array<{ supplierNome: string; supplierEstado: string; supplierCidade: string; vendedor: string; status: string; observacao?: string }>;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  drawHeader(doc, "Fornecedores por Status — Prospecção");

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
export function exportHistoricoPdf(data: {
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
  drawHeader(doc, "Histórico de Migrações — Prospecção", `${data.history.length} registros`);

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
export function exportRankingVendasPdf(data: {
  ranking: Array<{ vendedor: string; totalVendas: number; qtdPedidos: number; qtdClientes: number }>;
  periodLabel: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawHeader(doc, "Ranking de Vendedores — Métrica de Vendas", data.periodLabel);

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
export function exportInadimplenciaPdf(data: {
  inadimplencia: Array<{
    vendedor: string;
    qtdClientesInadimplentes: number;
    totalDevido: number;
    clientes: Array<{ nome: string; qtdTitulos: number; totalDevido: number }>;
  }>;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawHeader(doc, "Inadimplência por Vendedor — Métrica de Vendas");

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
