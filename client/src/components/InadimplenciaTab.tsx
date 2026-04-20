import { useState, useMemo, useEffect } from "react";
import React from "react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import { Search, Phone, MessageCircle, Mail, User, Calendar, AlertTriangle, Clock, FileText, ChevronDown, ChevronUp, ChevronRight, X, Users, DollarSign, History, Shield, ShieldAlert, ShieldCheck, Send, ExternalLink, Download, Lock, Loader2, FileDown, Filter, Check, CheckCircle2, XCircle, Circle, ListChecks, Pencil, Save, RotateCcw } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import CobrancaGuideSimulator from "@/components/CobrancaGuideSimulator";
import DecisaoCobrancaTutorial from "@/components/DecisaoCobrancaTutorial";
import { Eye, Plus, PhoneOff, PhoneCall } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const COBRANCA_GUIDE_OPERATORS = ["Flavio", "Thiago", "Guilherme", "Fernando", "Bruno", "Gilson"];
const MANUAL_TICK_OPERATORS = ["Thiago", "Guilherme", "Flavio", "Fernando", "Bruno", "Gilson"];
const TICK_LABELS = ["Ação 1", "Intervalo", "Ação 2", "Intervalo", "Ação 3", "Intervalo", "Decisão"];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-slate-100 text-slate-700 border-slate-300" },
  { value: "contatado", label: "Contatado", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "em_negociacao", label: "Em Negociação", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "promessa", label: "Promessa de Pgto", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "nao_retornou", label: "Não deu retorno", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "nao_atendeu", label: "Não atendeu", color: "bg-pink-100 text-pink-700 border-pink-300" },
  { value: "protestado", label: "Protestado", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "juridico", label: "Jurídico", color: "bg-red-100 text-red-700 border-red-300" },
];

const CONTATO_TIPOS = [
  { value: "ligacao", label: "Ligação", icon: Phone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "presencial", label: "Presencial", icon: User },
];

const ACTION_TYPE_LABELS: Record<string, string> = {
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  visita: "Visita",
  outro: "Outro",
  sem_contato: "Sem contato",
};

// Dias úteis de atraso (exclui fds e feriados)
const AGING_RANGES = [
  { key: "1-10", label: "1-10 dias úteis", min: 1, max: 10, color: "bg-amber-50 border-amber-200 text-amber-700" },
  { key: "11-20", label: "11-20 dias úteis", min: 11, max: 20, color: "bg-orange-50 border-orange-200 text-orange-700" },
  { key: "21-40", label: "21-40 dias úteis", min: 21, max: 40, color: "bg-red-50 border-red-200 text-red-600" },
  { key: "41-60", label: "41-60 dias úteis", min: 41, max: 60, color: "bg-red-100 border-red-300 text-red-700" },
  { key: "60+", label: "60+ dias úteis", min: 61, max: 99999, color: "bg-red-200 border-red-400 text-red-800" },
];

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

/* ---- PDF Export ---- */
function exportInadimplenciaPDF(
  titles: Title[],
  stats: { total: number; count: number },
  protestConfigsMap: Record<number, any> | undefined,
) {
  // Explicit landscape dimensions [width, height] to guarantee macOS Preview shows it as landscape slide
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [297, 210] });
  const pageW = doc.internal.pageSize.getWidth();  // 297mm
  const pageH = doc.internal.pageSize.getHeight(); // 210mm

  // PDF metadata & viewer preferences for landscape display
  doc.setProperties({
    title: "Relatório de Inadimplência - Grupo Fox",
    subject: "Gestão de Inadimplência",
    creator: "Grupo Fox Dashboard",
  });
  doc.setDisplayMode("fullwidth", "single");

  // Inject ViewerPreferences to force landscape printing on macOS
  const pdfInternal = (doc as any).internal;
  if (pdfInternal && pdfInternal.events) {
    pdfInternal.events.subscribe("putCatalog", function (this: any) {
      pdfInternal.write("/ViewerPreferences<</PrintScaling/None/Duplex/Simplex/PrintPageRange[0 9999]>>");
    });
  }

  const STATUS_LABELS: Record<string, string> = {
    pendente: "Pendente", contatado: "Contatado", em_negociacao: "Em Negociação",
    promessa: "Promessa de Pgto", protestado: "Protestado", juridico: "Jurídico",
  };

  // Sort by diasAtraso descending (oldest first)
  const sorted = [...titles].sort((a, b) => b.diasAtraso - a.diasAtraso);

  // ── Row color gradient: oldest (dark red) → newest (light yellow) ──
  const maxDias = Math.max(...sorted.map(t => t.diasAtraso), 1);
  function getRowGradient(dias: number): [number, number, number] {
    const ratio = Math.min(dias / maxDias, 1);
    // From warm yellow [255,251,235] (ratio=0) to deep red [254,226,226] (ratio=1)
    if (ratio < 0.2) return [255, 251, 235]; // amber-50
    if (ratio < 0.4) return [255, 243, 224]; // orange-50
    if (ratio < 0.6) return [254, 242, 242]; // red-50
    if (ratio < 0.8) return [254, 226, 226]; // red-100
    return [254, 202, 202]; // red-200
  }

  // ── Status counts for header ──
  const statusCounts: Record<string, { count: number; total: number }> = {};
  for (const s of ["pendente", "contatado", "em_negociacao", "promessa", "protestado", "juridico"]) {
    statusCounts[s] = { count: 0, total: 0 };
  }
  for (const t of sorted) {
    const st = t.cobranca?.status || "pendente";
    if (!statusCounts[st]) statusCounts[st] = { count: 0, total: 0 };
    statusCounts[st].count++;
    statusCounts[st].total += t.valorAReceber;
  }

  // ── Unique clients count ──
  const uniqueClients = new Set(sorted.map(t => t.cliente)).size;

  // ══════════ PAGE 1 HEADER ══════════
  function drawHeader(startPage: boolean) {
    // Dark gradient header
    doc.setFillColor(55, 15, 15);
    doc.rect(0, 0, pageW, 22, "F");
    // Accent gradient line
    doc.setFillColor(220, 38, 38);
    doc.rect(0, 22, pageW, 1.2, "F");
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 23.2, pageW, 0.8, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("GRUPO FOX", 6, 10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(220, 200, 200);
    doc.text("Relatório de Inadimplência", 44, 10);

    // Right side: date + totals
    doc.setFontSize(7.5);
    doc.setTextColor(200, 180, 180);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageW - 6, 8, { align: "right" });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`${sorted.length} títulos  |  ${uniqueClients} clientes  |  ${formatCurrency(stats.total)}`, pageW - 6, 14, { align: "right" });

    // Subtitle line
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 180, 180);
    doc.text("Ordenado por dias de atraso (mais antigos primeiro)", 6, 18);
  }

  // Only draw full summary on first page
  drawHeader(true);

  // ── Aging boxes ──
  const y0 = 28;
  const agingRanges = [
    { label: "1-15 DIAS", min: 1, max: 15, color: [245, 158, 11] as [number, number, number] },
    { label: "16-30 DIAS", min: 16, max: 30, color: [249, 115, 22] as [number, number, number] },
    { label: "31-60 DIAS", min: 31, max: 60, color: [239, 68, 68] as [number, number, number] },
    { label: "61-90 DIAS", min: 61, max: 90, color: [220, 38, 38] as [number, number, number] },
    { label: "90+ DIAS", min: 91, max: 99999, color: [153, 27, 27] as [number, number, number] },
  ];

  const boxW = (pageW - 12 - 4 * 4) / 5; // equal width, 4px gaps, 6mm margins
  agingRanges.forEach((r, i) => {
    const count = sorted.filter(t => t.diasAtraso >= r.min && t.diasAtraso <= r.max).length;
    const total = sorted.filter(t => t.diasAtraso >= r.min && t.diasAtraso <= r.max).reduce((s, t) => s + t.valorAReceber, 0);
    const x = 6 + i * (boxW + 4);
    doc.setFillColor(r.color[0], r.color[1], r.color[2]);
    doc.roundedRect(x, y0, boxW, 14, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text(r.label, x + 3, y0 + 5);
    doc.setFontSize(8.5);
    doc.text(`${count} tít.`, x + 3, y0 + 11);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(formatCurrency(total), x + boxW - 3, y0 + 11, { align: "right" });
  });

  // ── Status boxes ──
  const y1 = y0 + 17;
  const statusDefs = [
    { key: "pendente", label: "PENDENTE", bg: [241, 245, 249] as [number, number, number], text: [71, 85, 105] as [number, number, number] },
    { key: "contatado", label: "CONTATADO", bg: [219, 234, 254] as [number, number, number], text: [29, 78, 216] as [number, number, number] },
    { key: "em_negociacao", label: "EM NEGOCIAÇÃO", bg: [254, 243, 199] as [number, number, number], text: [180, 83, 9] as [number, number, number] },
    { key: "promessa", label: "PROMESSA PGTO", bg: [209, 250, 229] as [number, number, number], text: [4, 120, 87] as [number, number, number] },
    { key: "protestado", label: "PROTESTADO", bg: [255, 237, 213] as [number, number, number], text: [194, 65, 12] as [number, number, number] },
    { key: "juridico", label: "JURÍDICO", bg: [254, 226, 226] as [number, number, number], text: [185, 28, 28] as [number, number, number] },
  ];

  const sBoxW = (pageW - 12 - 5 * 4) / 6; // 6mm margins
  statusDefs.forEach((s, i) => {
    const sc = statusCounts[s.key] || { count: 0, total: 0 };
    const x = 6 + i * (sBoxW + 4);
    // Border
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.setFillColor(s.bg[0], s.bg[1], s.bg[2]);
    doc.roundedRect(x, y1, sBoxW, 12, 1.5, 1.5, "FD");
    doc.setTextColor(s.text[0], s.text[1], s.text[2]);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.text(s.label, x + 2, y1 + 4);
    doc.setFontSize(7.5);
    doc.text(`${sc.count}`, x + 2, y1 + 9.5);
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.text(formatCurrency(sc.total), x + sBoxW - 2, y1 + 9.5, { align: "right" });
  });

  // ── Table (without Protesto column) ──
  // Build NF/Parcela column: "NF 206 \u2022 Parcela 2/3" or "NF 206" or "Parcela 2/3" or "—"
  const tableData = sorted.map(t => {
    const status = t.cobranca?.status || "pendente";
    const statusLabel = STATUS_LABELS[status] || status;
    // Build document + parcela label
    const docParts: string[] = [];
    if (t.documento) docParts.push(`NF ${t.documento}`);
    if (t.parcela) docParts.push(`Parcela ${t.parcela}`);
    const docLabel = docParts.length > 0 ? docParts.join(" \u2022 ") : "\u2014";
    return [
      t.cliente,
      docLabel,
      t.vendedor || "\u2014",
      t.formaCobranca || "\u2014",
      getDecisaoLabel(t.decisaoCobranca) || "\u2014",
      formatCurrency(t.valorAReceber),
      formatDate(t.vencimento),
      `${t.diasAtraso}d`,
      statusLabel,
      t.empresa || "\u2014",
    ];
  });

  autoTable(doc, {
    startY: y1 + 16,
    head: [["CLIENTE", "NF / PARCELA", "VENDEDOR", "FORMA DE COBRAN\u00c7A", "DECIS\u00c3O DE COBRAN\u00c7A", "VALOR", "VENCIMENTO", "ATRASO", "STATUS", "EMPRESA"]],
    body: tableData,
    theme: "grid",
    rowPageBreak: "avoid",
    headStyles: {
      fillColor: [55, 15, 15],
      textColor: [255, 255, 255],
      fontSize: 6.5,
      fontStyle: "bold",
      cellPadding: 2.5,
      halign: "center",
    },
    bodyStyles: { fontSize: 6.5, cellPadding: 2, lineColor: [230, 230, 230], lineWidth: 0.2, halign: "center" },
    columnStyles: {
      0: { cellWidth: 60, halign: "left" },   // CLIENTE (+2)
      1: { cellWidth: 30, halign: "center" }, // NF / PARCELA
      2: { cellWidth: 30, halign: "center" }, // VENDEDOR
      3: { cellWidth: 30, halign: "center" }, // FORMA DE COBRANÇA
      4: { cellWidth: 33, halign: "center" }, // DECISÃO DE COBRANÇA (+1)
      5: { cellWidth: 24, halign: "right", fontStyle: "bold" }, // VALOR
      6: { cellWidth: 24, halign: "center" }, // VENCIMENTO
      7: { cellWidth: 15, halign: "center" }, // ATRASO
      8: { cellWidth: 22, halign: "center" }, // STATUS
      9: { cellWidth: 17, halign: "center" }, // EMPRESA (+1)
    },
    didParseCell: (data: any) => {
      if (data.section === "body") {
        const rowIdx = data.row.index;
        const dias = sorted[rowIdx]?.diasAtraso || 0;

        // Row gradient background by aging
        const bg = getRowGradient(dias);
        data.cell.styles.fillColor = bg;

        // Atraso column (index 7)
        if (data.column.index === 7) {
          if (dias > 90) {
            data.cell.styles.textColor = [127, 29, 29];
            data.cell.styles.fontStyle = "bold";
          } else if (dias > 60) {
            data.cell.styles.textColor = [153, 27, 27];
            data.cell.styles.fontStyle = "bold";
          } else if (dias > 30) {
            data.cell.styles.textColor = [220, 38, 38];
          } else if (dias > 15) {
            data.cell.styles.textColor = [249, 115, 22];
          } else {
            data.cell.styles.textColor = [180, 130, 20];
          }
        }
        // Valor column (index 5) - red for high values
        if (data.column.index === 5) {
          const val = sorted[rowIdx]?.valorAReceber || 0;
          if (val > 5000) {
            data.cell.styles.textColor = [153, 27, 27];
          } else if (val > 2000) {
            data.cell.styles.textColor = [220, 38, 38];
          }
        }
        // Status column (index 8)
        if (data.column.index === 8) {
          const val = data.cell.raw;
          if (val === "Protestado" || val === "Jurídico") {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = "bold";
          } else if (val === "Promessa de Pgto") {
            data.cell.styles.textColor = [4, 120, 87];
          } else if (val === "Em Negociação") {
            data.cell.styles.textColor = [180, 83, 9];
          } else if (val === "Contatado") {
            data.cell.styles.textColor = [29, 78, 216];
          }
        }
      }
    },
    margin: { left: 6, right: 6, top: 28, bottom: 10 },
    didDrawPage: (data: any) => {
      // Repeat mini header on subsequent pages
      if (data.pageNumber > 1) {
        doc.setFillColor(55, 15, 15);
        doc.rect(0, 0, pageW, 18, "F");
        doc.setFillColor(220, 38, 38);
        doc.rect(0, 18, pageW, 0.8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("GRUPO FOX \u2014 Inadimpl\u00eancia", 6, 9);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 180, 180);
        doc.text(`${sorted.length} t\u00edtulos  |  ${formatCurrency(stats.total)}`, 6, 14.5);
        doc.text(`Página ${data.pageNumber}`, pageW - 6, 9, { align: "right" });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(6.5);
      doc.setTextColor(160, 160, 160);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}  |  GRUPO FOX \u2014 Gestão de Inadimplência  |  ${new Date().toLocaleDateString("pt-BR")}`,
        pageW / 2,
        pageH - 5,
        { align: "center" }
      );
      // Bottom accent line
      doc.setFillColor(220, 38, 38);
      doc.rect(0, pageH - 2, pageW, 2, "F");
    },
  });

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  doc.save(`Inadimplencia_GrupoFox_${dateStr}.pdf`);
}

// Helper: categorizar forma de cobrança bruta em label limpo
function getFormaCobrancaCategory(desc: string): string {
  if (!desc) return "";
  const d = desc.toUpperCase();
  if (d.startsWith("PIX")) return "PIX";
  if (d.startsWith("BOLETO")) return "Boleto";
  if (d.startsWith("CHEQUE")) return "Cheque";
  if (d.startsWith("DEP\u00d3SITO") || d.startsWith("DEPOSITO")) return "Dep\u00f3sito";
  if (d.startsWith("DINHEIRO")) return "Dinheiro";
  if (desc.trim()) {
    const first = desc.trim().split(" ")[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  return "";
}

// Helper: mapear decisão de cobrança para label de exibição
function getDecisaoLabel(raw: string): string {
  if (!raw) return "";
  const u = raw.toUpperCase().trim();
  if (u === "COM PROTESTO") return "Com Protesto (Cart\u00f3rio)";
  if (u === "SEM PROTESTO") return "Sem Protesto";
  return raw.trim();
}

function getAgingColor(dias: number) {
  if (dias <= 15) return "text-amber-600";
  if (dias <= 30) return "text-orange-600";
  if (dias <= 60) return "text-red-500";
  return "text-red-700 font-bold";
}

function getAgingBg(dias: number) {
  if (dias <= 15) return "bg-amber-50 border-amber-200";
  if (dias <= 30) return "bg-orange-50 border-orange-200";
  if (dias <= 60) return "bg-red-50 border-red-200";
  return "bg-red-100 border-red-300";
}

function getStatusBadge(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
}

type Title = {
  id: number;
  cliente: string;
  valorAReceber: number;
  valorOriginal: number;
  valorPago: number;
  vencimento: string;
  vencimentoOriginal: string;
  emissao: string;
  referenteA: string;
  tipo: string;
  parcela: string;
  documento: string;
  empresa: string;
  banco: string;
  diasAtraso: number;
  businessDaysOverdue: number;
  vendedor: string;
  decisaoCobranca: string;
  formaCobranca: string;
  observacoesMaxiprod: string;
  anotacoes: string;
  cobranca: {
    status: string;
    promessaData: string | null;
    promessaValor: number | null;
    lembreteData: string | null;
    observacoes: string | null;
    contatoHistorico: Array<{ data: string; tipo: string; resumo: string; usuario?: string }>;
    updatedAt: string;
    cobrancaStartedAt: string | null;
  } | null;
};

/* ---- Multi-Select Filter Dropdown ---- */
function MultiSelectFilter({ label, options, selected, onChange }: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(val: string) {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val));
    } else {
      onChange([...selected, val]);
    }
  }

  if (options.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
          selected.length > 0
            ? "bg-blue-50 border-blue-300 text-blue-700 shadow-sm"
            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        <Filter className="w-3 h-3" />
        {label}
        {selected.length > 0 && (
          <span className="bg-blue-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{selected.length}</span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 max-h-64 overflow-y-auto">
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 font-medium border-b border-slate-100"
            >
              Limpar seleção ({selected.length})
            </button>
          )}
          {options.map(opt => {
            const isSelected = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
                  isSelected ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="truncate">{opt}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function InadimplenciaTab() {
  const { operator, hasGranularAccess } = useOperator();
  const canCobranca = hasGranularAccess("fin.cobranca");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [agingFilter, setAgingFilter] = useState<string | null>(null);
  const [vendedorFilter, setVendedorFilter] = useState<string[]>([]);
  const [formaCobrancaFilter, setFormaCobrancaFilter] = useState<string[]>([]);
  const [decisaoCobrancaFilter, setDecisaoCobrancaFilter] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"titulos" | "clientes">("titulos");
  const [sortBy, setSortBy] = useState<"valor" | "dias" | "cliente" | "vencimento">("dias");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [clientSortBy, setClientSortBy] = useState<"valor" | "vencimento" | "dias">("dias");
  const [clientSortDir, setClientSortDir] = useState<"asc" | "desc">("desc");
  function toggleClientSort(field: typeof clientSortBy) {
    if (clientSortBy === field) {
      setClientSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setClientSortBy(field);
      setClientSortDir("desc");
    }
  }
  const [actionDialogId, setActionDialogId] = useState<number | null>(null);
  const [contatoDialogId, setContatoDialogId] = useState<number | null>(null);
  const [historyDialogId, setHistoryDialogId] = useState<number | null>(null);
  const [actionPlanDialogId, setActionPlanDialogId] = useState<number | null>(null);
  const [documentDialogId, setDocumentDialogId] = useState<number | null>(null);

  // Senha para acessar o telefone azul (cobrança)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [pendingPhoneAction, setPendingPhoneAction] = useState<{ titleId: number; action: "contato" | "actionPlan" | "document" } | null>(null);
  const [collectionUnlocked, setCollectionUnlocked] = useState(false);
  const [phoneMenuTarget, setPhoneMenuTarget] = useState<{ titleId: number; phoneState: string; hasDocument: boolean; needsPlan: boolean } | null>(null);
  const [phoneMenuSelected, setPhoneMenuSelected] = useState<'mute' | 'unmute' | 'register' | 'history' | null>(null);
  const [showCobrancaGuide, setShowCobrancaGuide] = useState(false);
  const [decisaoTutorialData, setDecisaoTutorialData] = useState<{clienteName: string; vendedorName: string} | null>(null);
  const canSeeCobrancaGuide = operator && COBRANCA_GUIDE_OPERATORS.includes(operator.name);
  const isVitoria = operator?.name === "Vitoria" || operator?.name === "Vitória";

  const COLLECTION_PASSWORD = "Thiago";

  function handlePhoneClick(titleId: number, phoneState: string, hasDocument: boolean, needsPlan: boolean) {
    const opLower = operator?.name?.toLowerCase().trim();
    const isAdminOp = opLower === 'guilherme' || opLower === 'thiago';
    if (isAdminOp) {
      // Guilherme/Thiago: sempre mostrar menu com opções (qualquer estado do telefone)
      setPhoneMenuTarget({ titleId, phoneState, hasDocument, needsPlan });
      setPhoneMenuSelected(null);
      return;
    }

    if (!collectionUnlocked) {
      // Determinar qual ação será executada após a senha
      let action: "contato" | "actionPlan" | "document" = "contato";
      if (phoneState === "document" || hasDocument) {
        action = "document";
      } else if (needsPlan) {
        action = "actionPlan";
      }
      setPendingPhoneAction({ titleId, action });
      setPasswordDialogOpen(true);
      return;
    }
    // Já desbloqueado - executar ação diretamente
    executePhoneAction(titleId, phoneState, hasDocument, needsPlan);
  }

  function executePhoneAction(titleId: number, phoneState: string, hasDocument: boolean, needsPlan: boolean) {
    if (phoneState === "document" || hasDocument) {
      setDocumentDialogId(titleId);
    } else if (needsPlan) {
      setActionPlanDialogId(titleId);
    } else {
      setContatoDialogId(titleId);
    }
  }

  function handlePasswordConfirm() {
    if (passwordInput === COLLECTION_PASSWORD) {
      setCollectionUnlocked(true);
      setPasswordDialogOpen(false);
      setPasswordInput("");
      toast.success("Acesso liberado! Bem-vindo, Thiago.");
      // Executar a ação pendente
      if (pendingPhoneAction) {
        const { titleId, action } = pendingPhoneAction;
        if (action === "document") {
          setDocumentDialogId(titleId);
        } else if (action === "actionPlan") {
          setActionPlanDialogId(titleId);
        } else {
          setContatoDialogId(titleId);
        }
        setPendingPhoneAction(null);
      }
    } else {
      toast.error("Senha incorreta!");
      setPasswordInput("");
    }
  }

  const { data, isLoading, refetch } = trpc.financial.getOverdueTitles.useQuery({
    search: search || undefined,
    status: statusFilter,
    sortBy,
    sortDir,
  });

  // Buscar títulos resolvidos (pagos que tinham cobrança)
  const { data: resolvedData } = trpc.financial.getResolvedTitles.useQuery();
  const [showResolved, setShowResolved] = useState(false);

  const upsertAction = trpc.financial.upsertCollectionAction.useMutation({
    onSuccess: () => refetch(),
  });

  const titles = data?.titles || [];
  const stats = data?.stats || { total: 0, count: 0, byStatus: {} };

  // IDs dos títulos para buscar ações de hoje e configs de protesto
  const receivableIds = useMemo(() => titles.map(t => t.id), [titles]);

  // Buscar ações de hoje (batch) para saber quais telefones piscam
  const { data: todayActionsMap, refetch: refetchTodayActions } = trpc.financial.getTodayActions.useQuery(
    { receivableIds },
    { enabled: receivableIds.length > 0, refetchInterval: 30000 }
  );

  // Buscar configs de protesto (batch)
  const { data: protestConfigsMap, refetch: refetchProtestConfigs } = trpc.financial.getProtestConfigs.useQuery(
    { receivableIds },
    { enabled: receivableIds.length > 0 }
  );

  // Buscar ações pendentes de dias anteriores (1, 3, 5) - telefone não para até resolver
  const { data: pendingActionsMap, refetch: refetchPendingActions } = trpc.financial.getPendingCollectionActions.useQuery(
    { receivableIds },
    { enabled: receivableIds.length > 0, refetchInterval: 30000 }
  );

  // Buscar documentos de cobrança gerados (dia 7+ para "não protestar")
  const { data: collectionDocsMap } = trpc.financial.getCollectionDocuments.useQuery(
    { receivableIds },
    { enabled: receivableIds.length > 0 }
  );

  // Buscar estado de mute de vibração (silenciado por Guilherme/Thiago)
  const { data: phoneMuteMap, refetch: refetchPhoneMute } = trpc.financial.getPhoneMuteStatus.useQuery(
    { receivableIds },
    { enabled: receivableIds.length > 0 }
  );
  const togglePhoneMute = trpc.financial.togglePhoneMute.useMutation({
    onSuccess: () => {
      refetchPhoneMute();
      toast.success('Vibração atualizada com sucesso!');
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // 7 bolinhas manuais — apenas para operadores autorizados
  const canManualTick = operator && MANUAL_TICK_OPERATORS.includes(operator.name);
  const { data: manualTicksMap, refetch: refetchManualTicks } = trpc.financial.getManualTicksBatch.useQuery(
    { receivableIds },
    { enabled: !!canManualTick && receivableIds.length > 0 }
  );
  const toggleTick = trpc.financial.toggleManualTick.useMutation({
    onSuccess: () => {
      refetchManualTicks();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Verificar automaticamente bolinhas que passaram do dia (controle rígido)
  const checkOverdue = trpc.financial.checkOverdueTicks.useMutation({
    onSuccess: (data) => {
      if (data.updated > 0) {
        refetchManualTicks();
      }
    },
  });

  // Sincronizar bolinhas com checklist automaticamente
  const syncTicks = trpc.financial.syncTicksFromChecklist.useMutation({
    onSuccess: (data) => {
      if (data.synced > 0) {
        refetchManualTicks();
      }
    },
  });

  const checkedOverdueRef = React.useRef(false);
  React.useEffect(() => {
    if (canManualTick && receivableIds.length > 0 && !checkedOverdueRef.current) {
      checkedOverdueRef.current = true;
      // Apenas verificar overdue (sem sync automático de bolinhas - bolinhas são manuais)
      checkOverdue.mutate({ receivableIds });
    }
  }, [canManualTick, receivableIds.length]);

  // Mutation para registrar ação de cobrança diária
  const registerAction = trpc.financial.registerCollectionAction.useMutation({
    onSuccess: () => {
      refetchTodayActions();
      refetchPendingActions();
      refetch();
      // Bolinhas são manuais - não sincronizar automaticamente
      refetchManualTicks();
      toast.success("Ação de cobrança registrada!");
    },
  });

  // Mutation para config de protesto
  const setProtestConfig = trpc.financial.setProtestConfig.useMutation({
    onSuccess: () => {
      refetchProtestConfigs();
      toast.success("Configuração de protesto salva!");
    },
  });

  // Mutation para plano de ação
  const saveActionPlan = trpc.financial.saveActionPlan.useMutation({
    onSuccess: () => {
      refetchProtestConfigs();
      refetchTodayActions();
      toast.success("Plano de ação salvo!");
    },
  });

  // Extrair opções únicas para os filtros
  const vendedorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of titles) {
      if (t.vendedor && t.vendedor.trim()) set.add(t.vendedor.trim());
    }
    return Array.from(set).sort();
  }, [titles]);

  const formaCobrancaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of titles) {
      const cat = getFormaCobrancaCategory(t.formaCobranca || "");
      if (cat) set.add(cat);
    }
    return Array.from(set).sort();
  }, [titles]);

  const decisaoCobrancaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of titles) {
      const label = getDecisaoLabel(t.decisaoCobranca || "");
      if (label) set.add(label);
    }
    return Array.from(set).sort();
  }, [titles]);

  // Filtro por faixa de atraso + vendedor + forma cobrança + decisão cobrança
  const filteredTitles = useMemo(() => {
    let result = titles;
    if (agingFilter) {
      const range = AGING_RANGES.find(r => r.key === agingFilter);
      if (range) result = result.filter(t => t.diasAtraso >= range.min && t.diasAtraso <= range.max);
    }
    if (vendedorFilter.length > 0) {
      result = result.filter(t => vendedorFilter.includes(t.vendedor?.trim() || ''));
    }
    if (formaCobrancaFilter.length > 0) {
      result = result.filter(t => formaCobrancaFilter.includes(getFormaCobrancaCategory(t.formaCobranca || '')));
    }
    if (decisaoCobrancaFilter.length > 0) {
      result = result.filter(t => decisaoCobrancaFilter.includes(getDecisaoLabel(t.decisaoCobranca || '')));
    }
    return result;
  }, [titles, agingFilter, vendedorFilter, formaCobrancaFilter, decisaoCobrancaFilter]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {};
    for (const s of STATUS_OPTIONS) {
      counts[s.value] = { count: 0, total: 0 };
    }
    for (const t of titles) {
      const st = t.cobranca?.status || "pendente";
      if (!counts[st]) counts[st] = { count: 0, total: 0 };
      counts[st].count++;
      counts[st].total += t.valorAReceber;
    }
    return counts;
  }, [titles]);

  // Aging counts
  const agingCounts = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {};
    for (const r of AGING_RANGES) {
      counts[r.key] = { count: 0, total: 0 };
    }
    for (const t of titles) {
      const range = AGING_RANGES.find(r => t.diasAtraso >= r.min && t.diasAtraso <= r.max);
      if (range) {
        counts[range.key].count++;
        counts[range.key].total += t.valorAReceber;
      }
    }
    return counts;
  }, [titles]);

  // Agrupamento por cliente
  const clienteGroups = useMemo(() => {
    const map: Record<string, { cliente: string; titulos: Title[]; total: number; count: number; maxDias: number; vendedor: string }> = {};
    for (const t of filteredTitles) {
      if (!map[t.cliente]) {
        map[t.cliente] = { cliente: t.cliente, titulos: [], total: 0, count: 0, maxDias: 0, vendedor: t.vendedor };
      }
      map[t.cliente].titulos.push(t);
      map[t.cliente].total += t.valorAReceber;
      map[t.cliente].count++;
      map[t.cliente].maxDias = Math.max(map[t.cliente].maxDias, t.diasAtraso);
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredTitles]);

  function toggleSort(field: typeof sortBy) {
    if (sortBy === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  }

  // DIAS DE COBRANÇA OBRIGATÓRIA: 1, 3 e 5 após vencimento
  const COLLECTION_DAYS = [1, 3, 5];

  // Verificar se hoje é dia de cobrança (1, 3 ou 5 DIAS ÚTEIS após vencimento)
  function isCollectionDay(title: Title): boolean {
    return COLLECTION_DAYS.includes(title.businessDaysOverdue);
  }

  // Verificar se tem ações pendentes de dias anteriores
  function hasPendingActions(title: Title): boolean {
    const pending = pendingActionsMap?.[title.id];
    return !!pending?.hasPendingAction;
  }

  // Determinar se precisa de plano de ação (dia 7+ dias úteis e não protestar)
  function needsActionPlan(title: Title): boolean {
    if (title.businessDaysOverdue < 7) return false;
    const config = protestConfigsMap?.[title.id];
    if (!config || config.protestType === "automatico") return false;
    if (!config.actionPlan) return true;
    return false;
  }

  // Verificar se tem documento de cobrança gerado
  function hasCollectionDocument(title: Title): boolean {
    return !!collectionDocsMap?.[title.id];
  }

  // Data de corte: 16/04/2026 - a partir desta data a regra de vibração 1,3,5 está ativa
  const COBRANCA_RULE_START = "2026-04-16";

  // Verificar se o título segue a regra de vibração 1,3,5
  // Só vibra se: (1) tem cobrancaStartedAt >= data de corte, OU (2) entrou com 1 dia de atraso a partir de hoje
  function shouldFollowVibrateRule(title: Title): boolean {
    const startedAt = title.cobranca?.cobrancaStartedAt;
    if (startedAt && startedAt >= COBRANCA_RULE_START) return true;
    // Títulos novos com 1 dia de atraso que ainda não têm cobrança registrada
    // também devem vibrar (serão startados quando o primeiro contato for feito)
    if (!title.cobranca && title.businessDaysOverdue === 1) return true;
    // Se não tem cobrancaStartedAt (título antigo), não vibra
    if (!startedAt) return false;
    return false;
  }

  // Ações obrigatórias por dia de cobrança (conforme guia)
  // Dia 1: WhatsApp + Email | Dia 3: Ligação + Email | Dia 5: Ligação + Email
  const REQUIRED_ACTIONS_BY_DAY: Record<number, string[]> = {
    1: ["whatsapp", "email"],
    3: ["ligacao", "email"],
    5: ["ligacao", "email"],
  };

  // Verificar se TODAS as ações obrigatórias do dia foram registradas
  function hasAllRequiredActions(title: Title): boolean {
    const todayTypes = todayActionsMap?.[title.id]; // agora é string[] ou undefined
    if (!todayTypes || todayTypes.length === 0) return false;
    const required = REQUIRED_ACTIONS_BY_DAY[title.businessDaysOverdue];
    if (!required) return todayTypes.length > 0; // dia sem regra específica: qualquer ação basta
    return required.every(r => todayTypes.includes(r));
  }

  // Cor do telefone baseada no estado
  // REGRA: vibra nos dias 1/3/5 APENAS para títulos que seguem a régua (a partir de 16/04/2026)
  // Títulos antigos (>2 dias antes de hoje sem cobrancaStartedAt) NÃO vibram
  // REGRA NOVA: telefone só para de vibrar quando TODAS as ações obrigatórias do dia forem registradas
  function getPhoneState(title: Title): "blink" | "done" | "urgent" | "idle" | "document" | "muted" {
    if (title.businessDaysOverdue < 1) return "idle";

    // Se a vibração foi manualmente silenciada por Guilherme/Thiago
    if (phoneMuteMap?.[title.id]) return "muted";

    // Se tem documento gerado (dia 7+ não protestar) - mostrar documento
    if (hasCollectionDocument(title)) return "document";
    // Se precisa plano de ação urgente
    if (needsActionPlan(title)) return "urgent";

    // REGRA DIFERENCIADA: só vibra se o título segue a régua 1,3,5
    if (!shouldFollowVibrateRule(title)) {
      // Título antigo - não vibra, mas mostra se tem ação hoje
      const todayTypes = todayActionsMap?.[title.id];
      if (todayTypes && todayTypes.length > 0) return "done";
      return "idle";
    }

    // Se tem ações pendentes de dias anteriores - continua vibrando!
    if (hasPendingActions(title)) return "blink";
    // Se hoje é dia de cobrança (1, 3 ou 5)
    if (isCollectionDay(title)) {
      if (hasAllRequiredActions(title)) return "done";
      return "blink"; // Dia de cobrança sem TODAS as ações obrigatórias - vibra!
    }
    // Dia que não é de cobrança e sem pendentes
    const todayTypes = todayActionsMap?.[title.id];
    if (todayTypes && todayTypes.length > 0) return "done";
    return "idle";
  }

  // Badge Dia X/5 (mostra qual dia útil de cobrança)
  function getDayBadge(title: Title): string | null {
    const bd = title.businessDaysOverdue;
    if (bd < 1) return null;
    if (bd <= 5) {
      // Mostrar próximo dia de cobrança
      if (COLLECTION_DAYS.includes(bd)) {
        return `Dia ${bd} • Cobrança`;
      }
      const nextDay = COLLECTION_DAYS.find(d => d > bd);
      if (nextDay) return `Dia ${bd} • Próx: dia ${nextDay}`;
      return `Dia ${bd}`;
    }
    if (bd === 6) return "Dia 6 • Próx: dia 7";
    if (bd >= 7) return `Dia ${bd} • Prazo esgotado`;
    return null;
  }

  // Protesto type label
  function getProtestLabel(title: Title): { label: string; color: string } | null {
    const config = protestConfigsMap?.[title.id];
    if (!config) return null;
    if (config.protestType === "automatico") {
      return { label: "Com Protesto", color: "bg-orange-100 text-orange-700 border-orange-300" };
    }
    return { label: "Não Protestar", color: "bg-blue-100 text-blue-700 border-blue-300" };
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-slate-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Gestão de Inadimplência
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-red-500" />
              <span className="text-sm font-bold text-red-700">{stats.count}</span>
              <span className="text-xs text-red-600">títulos vencidos</span>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-red-500" />
              <span className="text-sm font-bold text-red-700">{formatCurrency(stats.total)}</span>
            </div>
            {clienteGroups.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-red-500" />
                <span className="text-sm font-bold text-red-700">{clienteGroups.length}</span>
                <span className="text-xs text-red-600">clientes</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportInadimplenciaPDF(filteredTitles, stats, protestConfigsMap)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-600 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:from-red-800 hover:to-red-700 transition-all hover:scale-[1.02]"
            title="Exportar lista de inadimplentes em PDF"
          >
            <FileDown className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
          {canSeeCobrancaGuide && (
            <button
              onClick={() => setShowCobrancaGuide(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white text-sm font-bold shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all animate-pulse hover:animate-none border-2 border-white/30"
              title="Ver guia completo do processo de cobrança"
            >
              <Eye className="w-5 h-5" />
              <span>Guia de Cobrança</span>
              <span className="bg-white/20 rounded-full px-2 py-0.5 text-[10px] font-bold">PASSO A PASSO</span>
            </button>
          )}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("titulos")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                viewMode === "titulos" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Por Título
            </button>
            <button
              onClick={() => setViewMode("clientes")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                viewMode === "clientes" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Por Cliente
            </button>
          </div>
        </div>
      </div>

      {/* Alerta Decisão de Cobrança - Guilherme, Fernando, Vitória */}
      {(() => {
        const alertOperators = ["Guilherme", "Fernando", "Vitoria", "Vitória"];
        const isAlertOperator = operator && alertOperators.includes(operator.name);
        if (!isAlertOperator || titles.length === 0) return null;
        const semDecisao = titles.filter(t => !t.decisaoCobranca || t.decisaoCobranca.trim() === '' || t.decisaoCobranca === '—');
        if (semDecisao.length === 0) return null;
        const operatorFirstName = operator!.name.split(' ')[0];
        return (
          <div className="rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-50 via-amber-100 to-orange-50 p-4 shadow-lg" style={{ animation: 'pulse 2s ease-in-out infinite' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-amber-900 font-bold text-sm flex items-center gap-2">
                  Atenção, {operatorFirstName}!
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">{semDecisao.length} pendente{semDecisao.length > 1 ? 's' : ''}</span>
                </h3>
                <p className="text-amber-800 text-xs mt-1">
                  Existem <strong>{semDecisao.length} título{semDecisao.length > 1 ? 's' : ''}</strong> sem decisão de cobrança preenchida no Maxiprod.
                  Clientes inadimplentes a partir de hoje sem decisão preenchida precisam de atenção imediata.
                </p>
                {isVitoria && (
                  <p className="text-amber-700 text-[10px] mt-1.5">
                    Clique no ícone <Eye className="w-3 h-3 inline text-amber-600" /> ao lado de cada título sem decisão para ver o passo a passo de como preencher.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Cards de faixa de atraso (aging) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {AGING_RANGES.map(r => {
          const c = agingCounts[r.key] || { count: 0, total: 0 };
          const isActive = agingFilter === r.key;
          return (
            <button
              key={r.key}
              onClick={() => setAgingFilter(isActive ? null : r.key)}
              className={`rounded-lg border p-3 text-left transition-all hover:shadow-md ${r.color} ${
                isActive ? "ring-2 ring-blue-500 shadow-md" : ""
              }`}
            >
              <div className="text-xs font-medium uppercase tracking-wide opacity-70">{r.label}</div>
              <div className="text-xl font-bold mt-1">{c.count} <span className="text-xs font-semibold">Títulos</span></div>
              <div className="text-xs mt-0.5 opacity-80">{formatCurrency(c.total)}</div>
            </button>
          );
        })}
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {STATUS_OPTIONS.map(s => {
          const c = statusCounts[s.value] || { count: 0, total: 0 };
          const isActive = statusFilter === s.value;
          return (
            <button
              key={s.value}
              onClick={() => setStatusFilter(isActive ? "todos" : s.value)}
              className={`rounded-lg border p-2.5 text-left transition-all hover:shadow-md ${
                isActive ? "ring-2 ring-blue-500 shadow-md" : ""
              } ${s.color}`}
            >
              <div className="text-[10px] font-medium uppercase tracking-wide opacity-70">{s.label}</div>
              <div className="text-lg font-bold mt-0.5">{c.count} <span className="text-[10px] font-semibold">Títulos</span></div>
              <div className="text-[10px] mt-0.5 opacity-80">{formatCurrency(c.total)}</div>
            </button>
          );
        })}
      </div>

      {/* Card de Pagos/Resolvidos */}
      {resolvedData && resolvedData.titles.length > 0 && (
        <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 overflow-hidden">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="w-full flex items-center justify-between p-4 hover:bg-emerald-100/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-emerald-900 font-bold text-sm flex items-center gap-2">
                  Pagos / Resolvidos
                  <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{resolvedData.stats.count}</span>
                </h3>
                <p className="text-emerald-700 text-xs">Clientes que pagaram e saíram da inadimplência • {formatCurrency(resolvedData.stats.valorTotal)} recuperados</p>
              </div>
            </div>
            {showResolved ? <ChevronUp className="w-5 h-5 text-emerald-600" /> : <ChevronDown className="w-5 h-5 text-emerald-600" />}
          </button>
          {showResolved && (
            <div className="border-t border-emerald-200 divide-y divide-emerald-100">
              {resolvedData.titles.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-emerald-50/80">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{t.cliente}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        {t.documento && <span>NF {t.documento}</span>}
                        {t.empresa && <span>• {t.empresa}</span>}
                        <span>• {t.totalContatos} contato{t.totalContatos !== 1 ? 's' : ''} registrado{t.totalContatos !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-700">{formatCurrency(t.valorAReceber)}</p>
                      <p className="text-[10px] text-slate-500">Venc: {t.vencimento ? new Date(t.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-emerald-600 font-medium">Resolvido em</p>
                      <p className="text-xs font-semibold text-emerald-800">{t.resolvedAt ? new Date(t.resolvedAt).toLocaleDateString('pt-BR') : '-'}</p>
                      <p className="text-[10px] text-slate-500">{t.diasAtrasoNaResolucao}d de atraso</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Busca */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, documento, referência ou vendedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {(statusFilter !== "todos" || agingFilter || vendedorFilter.length > 0 || formaCobrancaFilter.length > 0 || decisaoCobrancaFilter.length > 0) && (
            <button
              onClick={() => { setStatusFilter("todos"); setAgingFilter(null); setVendedorFilter([]); setFormaCobrancaFilter([]); setDecisaoCobrancaFilter([]); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              Limpar filtros
            </button>
          )}
        </div>

        {/* Filtros multi-seleção */}
        <div className="flex flex-wrap gap-2">
          <MultiSelectFilter
            label="Vendedor"
            options={vendedorOptions}
            selected={vendedorFilter}
            onChange={setVendedorFilter}
          />
          <MultiSelectFilter
            label="Forma Cobr."
            options={formaCobrancaOptions}
            selected={formaCobrancaFilter}
            onChange={setFormaCobrancaFilter}
          />
          <MultiSelectFilter
            label="Decisão Cobr."
            options={decisaoCobrancaOptions}
            selected={decisaoCobrancaFilter}
            onChange={setDecisaoCobrancaFilter}
          />
          {/* Badges dos filtros ativos */}
          {vendedorFilter.map(v => (
            <span key={`v-${v}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
              {v}
              <button onClick={() => setVendedorFilter(f => f.filter(x => x !== v))} className="hover:text-blue-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {formaCobrancaFilter.map(v => (
            <span key={`fc-${v}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
              {v}
              <button onClick={() => setFormaCobrancaFilter(f => f.filter(x => x !== v))} className="hover:text-emerald-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {decisaoCobrancaFilter.map(v => (
            <span key={`dc-${v}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
              {v}
              <button onClick={() => setDecisaoCobrancaFilter(f => f.filter(x => x !== v))} className="hover:text-amber-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Vista por Cliente */}
      {viewMode === "clientes" && (
        <div className="space-y-3">
          {clienteGroups.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum cliente encontrado</p>
            </div>
          )}
          {clienteGroups.map(group => {
            const isOpen = expandedCliente === group.cliente;
            return (
              <div key={group.cliente} className={`rounded-xl border overflow-hidden transition-all ${getAgingBg(group.maxDias)}`}>
                <button
                  onClick={() => setExpandedCliente(isOpen ? null : group.cliente)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-white/80 shadow-sm flex items-center justify-center shrink-0">
                      <User className={`w-4 h-4 ${getAgingColor(group.maxDias)}`} />
                    </div>
                    <div className="text-left min-w-0">
                      <h4 className="font-bold text-sm text-slate-800 truncate">{group.cliente}</h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{group.count} título{group.count !== 1 ? "s" : ""}</span>
                        <span className={`font-medium ${getAgingColor(group.maxDias)}`}>máx {group.maxDias}d atraso</span>
                        {group.vendedor && <span className="text-blue-500">{group.vendedor}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`font-bold text-sm ${getAgingColor(group.maxDias)}`}>{formatCurrency(group.total)}</span>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="bg-white/80 border-t border-slate-100">
                    <div className="hidden md:grid grid-cols-[1fr_100px_85px_130px_95px_85px_55px_100px_120px] bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-300">
                      <span className="flex items-center justify-start px-3 py-2 border-r border-slate-300">Referência / Documento</span>
                      <span className="flex items-center justify-center px-2 py-2 border-r border-slate-300">Vendedor</span>
                      <span className="flex items-center justify-center px-2 py-2 border-r border-slate-300">Forma Cobr.</span>
                      <span className="flex items-center justify-center px-2 py-2 border-r border-slate-300">Decisão Cobr.</span>
                      <button onClick={() => toggleClientSort("valor")} className="flex items-center justify-center gap-0.5 px-2 py-2 border-r border-slate-300 hover:text-slate-700 cursor-pointer select-none">
                        Valor {clientSortBy === "valor" ? (clientSortDir === "asc" ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />) : <ChevronDown className="w-2.5 h-2.5 opacity-30" />}
                      </button>
                      <button onClick={() => toggleClientSort("vencimento")} className="flex items-center justify-center gap-0.5 px-2 py-2 border-r border-slate-300 hover:text-slate-700 cursor-pointer select-none">
                        Venc. {clientSortBy === "vencimento" ? (clientSortDir === "asc" ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />) : <ChevronDown className="w-2.5 h-2.5 opacity-30" />}
                      </button>
                      <button onClick={() => toggleClientSort("dias")} className="flex items-center justify-center gap-0.5 px-2 py-2 border-r border-slate-300 hover:text-slate-700 cursor-pointer select-none">
                        Atraso {clientSortBy === "dias" ? (clientSortDir === "asc" ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />) : <ChevronDown className="w-2.5 h-2.5 opacity-30" />}
                      </button>
                      <span className="flex items-center justify-center px-2 py-2 border-r border-slate-300">Status</span>
                      <span className="flex items-center justify-center px-2 py-2">Ações</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {[...group.titulos].sort((a, b) => {
                        let cmp = 0;
                        if (clientSortBy === "valor") cmp = a.valorAReceber - b.valorAReceber;
                        else if (clientSortBy === "vencimento") cmp = (a.vencimento || "").localeCompare(b.vencimento || "");
                        else cmp = a.diasAtraso - b.diasAtraso;
                        return clientSortDir === "asc" ? cmp : -cmp;
                      }).map(title => (
                        <ClienteTitleRow
                          key={title.id}
                          title={title}
                          isExpanded={expandedId === title.id}
                          onToggle={() => setExpandedId(expandedId === title.id ? null : title.id)}
                          onOpenAction={() => setActionDialogId(title.id)}
                          onOpenContato={() => setContatoDialogId(title.id)}
                          onOpenHistory={() => setHistoryDialogId(title.id)}
                          onOpenActionPlan={() => setActionPlanDialogId(title.id)}
                          onOpenDocument={() => setDocumentDialogId(title.id)}
                          onPhoneClick={(ps: string, hd: boolean, np: boolean) => handlePhoneClick(title.id, ps, hd, np)}
                          onStatusChange={(status) => upsertAction.mutate({ receivableId: title.id, status })}
                          phoneState={getPhoneState(title)}
                          dayBadge={getDayBadge(title)}
                          protestLabel={getProtestLabel(title)}
                          needsActionPlan={needsActionPlan(title)}
                          hasDocument={hasCollectionDocument(title)}
                          canCobranca={canCobranca}
                          isVitoria={isVitoria}
                          onOpenDecisaoTutorial={(cn, vn) => setDecisaoTutorialData({ clienteName: cn, vendedorName: vn })}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Vista por Título */}
      {viewMode === "titulos" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-[1fr_110px_90px_140px_100px_90px_60px_110px_130px] bg-slate-50 border-b border-slate-300 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            <button onClick={() => toggleSort("cliente")} className="flex items-center justify-start gap-1 hover:text-slate-700 px-3 py-2.5 border-r border-slate-300">
              Cliente {sortBy === "cliente" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
            </button>
            <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-300">Vendedor</div>
            <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-300">Forma Cobr.</div>
            <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-300">Decisão Cobr.</div>
            <button onClick={() => toggleSort("valor")} className="flex items-center justify-center gap-1 hover:text-slate-700 px-3 py-2.5 border-r border-slate-300">
              Valor {sortBy === "valor" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
            </button>
            <button onClick={() => toggleSort("vencimento")} className="flex items-center justify-center gap-1 hover:text-slate-700 px-3 py-2.5 border-r border-slate-300">
              Venc. {sortBy === "vencimento" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
            </button>
            <button onClick={() => toggleSort("dias")} className="flex items-center justify-center gap-1 hover:text-slate-700 px-3 py-2.5 border-r border-slate-300">
              Atraso {sortBy === "dias" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
            </button>
            <div className="flex items-center justify-center px-3 py-2.5 border-r border-slate-300">Status</div>
            <div className="flex items-center justify-center px-3 py-2.5">Ações</div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
            {filteredTitles.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum título encontrado</p>
              </div>
            )}
            {filteredTitles.map((title) => (
              <TitleRow
                key={title.id}
                title={title}
                isExpanded={expandedId === title.id}
                onToggle={() => setExpandedId(expandedId === title.id ? null : title.id)}
                onOpenAction={() => setActionDialogId(title.id)}
                onOpenContato={() => setContatoDialogId(title.id)}
                onOpenHistory={() => setHistoryDialogId(title.id)}
                onOpenActionPlan={() => setActionPlanDialogId(title.id)}
                onOpenDocument={() => setDocumentDialogId(title.id)}
                onPhoneClick={(ps, hd, np) => handlePhoneClick(title.id, ps, hd, np)}
                onStatusChange={(status) => {
                  upsertAction.mutate({ receivableId: title.id, status });
                }}
                phoneState={getPhoneState(title)}
                dayBadge={getDayBadge(title)}
                protestLabel={getProtestLabel(title)}
                needsActionPlan={needsActionPlan(title)}
                hasDocument={hasCollectionDocument(title)}
                canCobranca={canCobranca}
                isVitoria={isVitoria}
                onOpenDecisaoTutorial={(cn, vn) => setDecisaoTutorialData({ clienteName: cn, vendedorName: vn })}
                canManualTick={!!canManualTick}
                manualTicks={manualTicksMap?.[title.id] || []}
                onToggleTick={(step, ticked, tickStatus) => {
                  if (operator) {
                    toggleTick.mutate({ receivableId: title.id, step, ticked, operatorName: operator.name, tickStatus: tickStatus || 'green' });
                  }
                }}
                isToggling={toggleTick.isPending}
                pendingDays={pendingActionsMap?.[title.id]?.pendingDays || []}
              />
            ))}
          </div>
        </div>
      )}

      {/* Dialog de Ação (gerenciar cobrança) */}
      {actionDialogId && (filteredTitles.find(t => t.id === actionDialogId) || titles.find(t => t.id === actionDialogId)) && (
        <ActionDialog
          title={(filteredTitles.find(t => t.id === actionDialogId) || titles.find(t => t.id === actionDialogId))!}
          onClose={() => setActionDialogId(null)}
          onSave={(data) => {
            upsertAction.mutate({ receivableId: actionDialogId, ...data }, {
              onSuccess: () => setActionDialogId(null),
            });
          }}
          isSaving={upsertAction.isPending}
          protestConfig={protestConfigsMap?.[actionDialogId]}
          onSetProtest={(type) => {
            if (operator) {
              setProtestConfig.mutate({ receivableId: actionDialogId, protestType: type, operatorName: operator.name });
            }
          }}
        />
      )}

      {/* Dialog de Contato (registrar ação diária) */}
      {contatoDialogId && (filteredTitles.find(t => t.id === contatoDialogId) || titles.find(t => t.id === contatoDialogId)) && (
        <CollectionActionDialog
          title={(filteredTitles.find(t => t.id === contatoDialogId) || titles.find(t => t.id === contatoDialogId))!}
          operatorName={operator?.name || ""}
          onClose={() => setContatoDialogId(null)}
          onSave={(data) => {
            registerAction.mutate(data, {
              onSuccess: () => setContatoDialogId(null),
            });
          }}
          isSaving={registerAction.isPending}
        />
      )}

      {/* Dialog de Histórico */}
      {historyDialogId && (filteredTitles.find(t => t.id === historyDialogId) || titles.find(t => t.id === historyDialogId)) && (
        <HistoryDialog
          title={(filteredTitles.find(t => t.id === historyDialogId) || titles.find(t => t.id === historyDialogId))!}
          onClose={() => setHistoryDialogId(null)}
        />
      )}

      {/* Dialog de Plano de Ação (dia 7+ não protestar) */}
      {actionPlanDialogId && (filteredTitles.find(t => t.id === actionPlanDialogId) || titles.find(t => t.id === actionPlanDialogId)) && (
        <ActionPlanDialog
          title={(filteredTitles.find(t => t.id === actionPlanDialogId) || titles.find(t => t.id === actionPlanDialogId))!}
          operatorName={operator?.name || ""}
          onClose={() => setActionPlanDialogId(null)}
          onSave={(data) => {
            saveActionPlan.mutate(data, {
              onSuccess: () => setActionPlanDialogId(null),
            });
          }}
          isSaving={saveActionPlan.isPending}
          existingPlan={protestConfigsMap?.[actionPlanDialogId]}
        />
      )}

      {/* Dialog de Documento de Cobrança (gerado no dia 7 para "não protestar") */}
      {documentDialogId && (
        <CollectionDocumentDialog
          receivableId={documentDialogId}
          onClose={() => setDocumentDialogId(null)}
        />
      )}

      {/* Guia de Cobrança (card dinâmico) */}
      {showCobrancaGuide && (
        <CobrancaGuideSimulator
          valorTotal={stats.total}
          onClose={() => setShowCobrancaGuide(false)}
        />
      )}

      {/* Tutorial Decisão de Cobrança (Vitória) */}
      {decisaoTutorialData && (
        <DecisaoCobrancaTutorial
          clienteName={decisaoTutorialData.clienteName}
          vendedorName={decisaoTutorialData.vendedorName}
          onClose={() => setDecisaoTutorialData(null)}
        />
      )}

      {/* Menu de opções do telefone para Guilherme/Thiago */}
      {phoneMenuTarget && (
        <Dialog open onOpenChange={() => { setPhoneMenuTarget(null); setPhoneMenuSelected(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-blue-600" />
                Opções do Telefone
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {/* Opção 1: Toggle vibração (silenciar ou iniciar) */}
              <button
                onClick={() => setPhoneMenuSelected(phoneMenuTarget.phoneState === 'muted' ? 'unmute' : 'mute')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                  phoneMenuSelected === 'mute' || phoneMenuSelected === 'unmute'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                {phoneMenuTarget.phoneState === 'muted' ? (
                  <PhoneCall className="w-5 h-5 text-green-500 shrink-0" />
                ) : (
                  <PhoneOff className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {phoneMenuTarget.phoneState === 'muted' ? 'Iniciar Vibração' : 'Silenciar Vibração'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {phoneMenuTarget.phoneState === 'muted' ? 'Reativar a vibração deste título' : 'Parar a vibração deste título'}
                  </div>
                </div>
              </button>

              {/* Opção 2: Registrar ação */}
              <button
                onClick={() => setPhoneMenuSelected('register')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                  phoneMenuSelected === 'register'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <PhoneCall className="w-5 h-5 text-blue-500 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-800">Registrar Ação de Cobrança</div>
                  <div className="text-xs text-slate-500">Abrir formulário para registrar contato</div>
                </div>
              </button>

              {/* Opção 3: Ver histórico */}
              <button
                onClick={() => setPhoneMenuSelected('history')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                  phoneMenuSelected === 'history'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <History className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-800">Ver Histórico</div>
                  <div className="text-xs text-slate-500">Abrir histórico e roteiro de cobrança</div>
                </div>
              </button>
            </div>

            {/* Botão OK para confirmar */}
            <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
              <button
                onClick={() => { setPhoneMenuTarget(null); setPhoneMenuSelected(null); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!phoneMenuSelected}
                onClick={() => {
                  if (!phoneMenuSelected || !phoneMenuTarget) return;
                  const target = phoneMenuTarget;
                  if (phoneMenuSelected === 'mute') {
                    togglePhoneMute.mutate({ receivableId: target.titleId, muted: true, operatorName: operator!.name });
                  } else if (phoneMenuSelected === 'unmute') {
                    togglePhoneMute.mutate({ receivableId: target.titleId, muted: false, operatorName: operator!.name });
                  } else if (phoneMenuSelected === 'register') {
                    if (!collectionUnlocked) {
                      let action: "contato" | "actionPlan" | "document" = "contato";
                      if (target.phoneState === "document" || target.hasDocument) action = "document";
                      else if (target.needsPlan) action = "actionPlan";
                      setPendingPhoneAction({ titleId: target.titleId, action });
                      setPasswordDialogOpen(true);
                    } else {
                      executePhoneAction(target.titleId, target.phoneState, target.hasDocument, target.needsPlan);
                    }
                  } else if (phoneMenuSelected === 'history') {
                    setHistoryDialogId(target.titleId);
                  }
                  setPhoneMenuTarget(null);
                  setPhoneMenuSelected(null);
                }}
                className={`px-6 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  phoneMenuSelected
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                OK
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de Senha para Cobrança */}
      <Dialog open={passwordDialogOpen} onOpenChange={(v) => { if (!v) { setPasswordInput(""); setPendingPhoneAction(null); } setPasswordDialogOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" />
              Acesso à Cobrança
            </DialogTitle>
            <DialogDescription>Digite a senha do responsável para registrar a cobrança.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handlePasswordConfirm(); }}>
            <div className="py-4">
              <Input
                type="password"
                placeholder="Digite a senha..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
                className="text-center text-lg tracking-widest"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setPasswordInput(""); setPendingPhoneAction(null); setPasswordDialogOpen(false); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!passwordInput.trim()} className="bg-blue-600 hover:bg-blue-700">
                <ShieldCheck className="w-4 h-4 mr-2" />
                Confirmar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---- Componente PhoneIcon com animação ---- */
function PhoneIcon({ state, onClick }: { state: "blink" | "done" | "urgent" | "idle" | "document" | "muted"; onClick: () => void }) {
  const baseClasses = "p-1 rounded-md transition-colors cursor-pointer";

  if (state === "muted") {
    return (
      <button onClick={onClick} title="Vibração silenciada. Clique para reativar." className={`${baseClasses} text-slate-400 bg-slate-100 hover:bg-slate-200 border border-dashed border-slate-300`}>
        <Phone className="w-3.5 h-3.5 opacity-50" />
      </button>
    );
  }

  if (state === "idle") {
    return (
      <button onClick={onClick} title="Sem ação necessária" className={`${baseClasses} text-slate-300`}>
        <Phone className="w-3.5 h-3.5" />
      </button>
    );
  }

  if (state === "done") {
    return (
      <button onClick={onClick} title="Ação registrada hoje" className={`${baseClasses} text-blue-600 bg-blue-50 hover:bg-blue-100`}>
        <Phone className="w-3.5 h-3.5" />
      </button>
    );
  }

  if (state === "urgent") {
    return (
      <button onClick={onClick} title="URGENTE: Plano de ação obrigatório!" className={`${baseClasses} text-red-600 bg-red-100 hover:bg-red-200 border-2 border-red-400 phone-urgent`}>
        <Phone className="w-4 h-4" />
      </button>
    );
  }

  if (state === "document") {
    return (
      <button onClick={onClick} title="Documento de cobrança gerado - Clique para ver" className={`${baseClasses} text-amber-700 bg-amber-100 hover:bg-amber-200 border-2 border-amber-400 phone-document`}>
       <FileText className="w-4 h-4" />
      </button>
    );
  }

  // blink — vibração intensa para chamar atenção
  return (
    <button onClick={onClick} title="AÇÃO DE COBRANÇA NECESSÁRIA! Clique para registrar." className={`${baseClasses} text-red-600 bg-red-50 hover:bg-red-100 border-2 border-red-300 phone-vibrating`}>
      <Phone className="w-4 h-4" />
    </button>
  );
}

/* ---- Componente TitleRow (vista por título) ---- */
function TitleRow({ title, isExpanded, onToggle, onOpenAction, onOpenContato, onOpenHistory, onOpenActionPlan, onOpenDocument, onPhoneClick, onStatusChange, phoneState, dayBadge, protestLabel, needsActionPlan: needsPlan, hasDocument, canCobranca = true, isVitoria = false, onOpenDecisaoTutorial, canManualTick = false, manualTicks = [], onToggleTick, isToggling = false, pendingDays = [] }: {
  title: Title;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenAction: () => void;
  onOpenContato: () => void;
  onOpenHistory: () => void;
  onOpenActionPlan: () => void;
  onOpenDocument: () => void;
  onPhoneClick: (phoneState: string, hasDocument: boolean, needsPlan: boolean) => void;
  onStatusChange: (status: string) => void;
  phoneState: "blink" | "done" | "urgent" | "idle" | "document" | "muted";
  dayBadge: string | null;
  protestLabel: { label: string; color: string } | null;
  needsActionPlan: boolean;
  hasDocument: boolean;
  canCobranca?: boolean;
  isVitoria?: boolean;
  onOpenDecisaoTutorial?: (clienteName: string, vendedorName: string) => void;
  canManualTick?: boolean;
  manualTicks?: Array<{ step: number; ticked: boolean; tickedBy: string | null; tickedAt: number | null; tickStatus: string | null }>;
  onToggleTick?: (step: number, ticked: boolean, tickStatus?: 'green' | 'red' | 'blue') => void;
  isToggling?: boolean;
  pendingDays?: number[];
}) {
  const { operator } = useOperator();
  const statusBadge = getStatusBadge(title.cobranca?.status || "pendente");
  const hasHistorico = title.cobranca?.contatoHistorico && title.cobranca.contatoHistorico.length > 0;

  // Build tick map for quick lookup
  const tickMap = useMemo(() => {
    const m: Record<number, typeof manualTicks[0]> = {};
    for (const t of manualTicks) m[t.step] = t;
    return m;
  }, [manualTicks]);

  const tickedCount = useMemo(() => manualTicks.filter(t => t.ticked).length, [manualTicks]);
  const redCount = useMemo(() => manualTicks.filter(t => t.tickStatus === 'red').length, [manualTicks]);
  const blueCount = useMemo(() => manualTicks.filter(t => t.ticked && t.tickStatus === 'blue').length, [manualTicks]);
  const greenCount = useMemo(() => manualTicks.filter(t => t.ticked && t.tickStatus !== 'red' && t.tickStatus !== 'blue').length, [manualTicks]);
  const hasRedTicks = redCount > 0;
  const [tickChoiceStep, setTickChoiceStep] = useState<{ recId: number; step: number } | null>(null);

  return (
    <div className={`${getAgingBg(title.diasAtraso)} transition-all`}>
      <div
        className="grid grid-cols-1 md:grid-cols-[1fr_110px_90px_140px_100px_90px_60px_110px_130px] cursor-pointer hover:bg-white/50 items-center"
        onClick={onToggle}
      >
        {/* Cliente + Referência + Badges */}
        <div className="flex flex-col min-w-0 px-3 py-3 border-r border-slate-300">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[13px] text-slate-800 break-words leading-tight">{title.cliente}</span>
            {canCobranca && dayBadge && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 border border-amber-300 shrink-0">
                {dayBadge}
              </span>
            )}
            {canCobranca && protestLabel && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${protestLabel.color}`}>
                {protestLabel.label}
              </span>
            )}
            {canCobranca && needsPlan && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-200 text-red-800 border border-red-300 animate-pulse shrink-0">
                Plano Obrigatório
              </span>
            )}
            {canCobranca && hasHistorico && (
              <span className="flex items-center gap-0.5 text-[10px] text-green-600 shrink-0">
                <MessageCircle className="w-3 h-3" />
                {title.cobranca!.contatoHistorico.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
            <span className="break-words">{title.referenteA}</span>
            {title.documento && <span className="shrink-0">· {title.documento}</span>}
            {title.parcela && <span className="shrink-0">· {title.parcela}</span>}
          </div>
        </div>

        {/* Vendedor */}
        <div className="flex items-center justify-center px-2 py-3 border-r border-slate-300">
          {title.vendedor ? (
            <span className="text-[11px] font-medium text-blue-600 break-words text-center leading-tight" title={title.vendedor}>{title.vendedor}</span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </div>

        {/* Forma de Cobrança */}
        <div className="flex items-center justify-center px-2 py-3 border-r border-slate-300">
          {(() => {
            const fc = title.formaCobranca || "";
            const d = fc.toUpperCase();
            let label = "", color = "text-slate-400";
            if (d.startsWith("PIX")) { label = "PIX"; color = "text-emerald-600"; }
            else if (d.startsWith("BOLETO")) { label = "Boleto"; color = "text-blue-600"; }
            else if (d.startsWith("CHEQUE")) { label = "Cheque"; color = "text-amber-600"; }
            else if (d.startsWith("DEP\u00d3SITO") || d.startsWith("DEPOSITO")) { label = "Dep\u00f3sito"; color = "text-purple-600"; }
            else if (d.startsWith("DINHEIRO")) { label = "Dinheiro"; color = "text-green-700"; }
            else if (fc) { const first = fc.split(" ")[0]; label = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(); color = "text-slate-600"; }
            return label ? (
              <span className={`text-xs font-semibold ${color}`} title={fc}>{label}</span>
            ) : (
              <span className="text-xs text-slate-300">—</span>
            );
          })()}
        </div>

        {/* Decisão de Cobrança */}
        <div className="flex items-center justify-center px-2 py-3 border-r border-slate-300">
          {title.decisaoCobranca ? (
            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              title.decisaoCobranca.toUpperCase().includes('COM PROTESTO')
                ? 'bg-orange-100 text-orange-700 border-orange-300'
                : 'bg-blue-100 text-blue-700 border-blue-300'
            }`}>
              {getDecisaoLabel(title.decisaoCobranca)}
            </span>
          ) : (isVitoria && onOpenDecisaoTutorial) ? (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenDecisaoTutorial(title.cliente, title.vendedor || 'Vendedor'); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-700 hover:bg-amber-200 transition-all animate-pulse hover:animate-none"
              title="Clique para ver como preencher a decisão de cobrança"
            >
              <Eye className="w-3 h-3" />
              <span className="text-[9px] font-bold">Preencher</span>
            </button>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </div>

        {/* Valor */}
        <div className="flex items-center justify-center px-2 py-3 border-r border-slate-300">
          <span className={`font-bold text-sm ${getAgingColor(title.diasAtraso)}`}>
            {formatCurrency(title.valorAReceber)}
          </span>
        </div>

        {/* Vencimento */}
        <div className="flex items-center justify-center px-1 py-3 border-r border-slate-300 text-[12px] text-slate-600 whitespace-nowrap">{formatDate(title.vencimento)}</div>

        {/* Dias atraso */}
        <div className="flex items-center justify-center px-1 py-3 border-r border-slate-300">
          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[11px] font-bold ${getAgingColor(title.diasAtraso)}`} title="Dias úteis de atraso">
            {title.diasAtraso}d
          </span>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center px-2 py-3 border-r border-slate-300" onClick={e => e.stopPropagation()}>
          {canCobranca ? (
            <select
              value={title.cobranca?.status || "pendente"}
              onChange={e => onStatusChange(e.target.value)}
              className={`text-xs font-medium px-2 py-1 rounded-md border cursor-pointer w-full ${statusBadge.color}`}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          ) : (
            <span className={`text-xs font-medium px-2 py-1 rounded-md border inline-block ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center justify-center gap-0.5 px-1 py-3 flex-wrap" onClick={e => e.stopPropagation()}>
          {canCobranca && <PhoneIcon state={phoneState} onClick={() => onPhoneClick(phoneState, hasDocument, needsPlan)} />}
          {hasDocument && (
            <button onClick={onOpenDocument} title="Ver documento de cobrança" className="p-1 rounded-md hover:bg-amber-100 text-amber-700 hover:text-amber-900 transition-colors border border-amber-200">
              <FileText className="w-3.5 h-3.5" />
            </button>
          )}
          {canCobranca && (
            <button onClick={onOpenHistory} title="Histórico de cobrança" className="p-1 rounded-md hover:bg-white/80 text-emerald-600 hover:text-emerald-800 transition-colors">
              <History className="w-3.5 h-3.5" />
            </button>
          )}
          {canCobranca && (
            <button onClick={onOpenAction} title="Gerenciar cobrança" className="p-1 rounded-md hover:bg-white/80 text-slate-600 hover:text-slate-800 transition-colors">
              <FileText className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onToggle} className="p-1 rounded-md hover:bg-white/80 text-slate-400">
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

      </div>

      {/* 7 Bolinhas Manuais — Card elegante abaixo da linha */}
      {canManualTick && (
        <div className="mx-3 mb-2 mt-0.5" onClick={e => e.stopPropagation()}>
          <div className={`rounded-lg border shadow-sm px-4 py-2.5 ${hasRedTicks ? 'bg-gradient-to-r from-red-50 via-white to-red-50 border-red-200/80' : 'bg-gradient-to-r from-slate-50 via-white to-slate-50 border-slate-200/80'}`}>
            <div className="flex items-center gap-4">
              {/* Label */}
              <div className="flex items-center gap-2 shrink-0">
                <div className={`w-2 h-2 rounded-full ${hasRedTicks ? 'bg-red-500' : tickedCount === 7 ? 'bg-emerald-500' : tickedCount > 0 ? 'bg-amber-400' : 'bg-slate-300'}`} />
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${hasRedTicks ? 'text-red-600' : 'text-slate-500'}`}>Roteiro</span>
                <span className={`text-[10px] font-medium ${hasRedTicks ? 'text-red-500' : 'text-slate-400'}`}>{tickedCount}/7</span>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-slate-200" />

              {/* Steps */}
              <div className="flex items-center gap-0 flex-1">
                <TooltipProvider delayDuration={150}>
                  {[1,2,3,4,5,6,7].map((step, idx) => {
                    const tick = tickMap[step];
                    const isTicked = !!tick?.ticked;
                    const isRed = tick?.tickStatus === 'red';
                    const isBlue = tick?.tickStatus === 'blue';
                    const isGreen = isTicked && !isRed && !isBlue;
                    const prevTicked = step === 1 || !!tickMap[step - 1]?.ticked;
                    const canTickStep = !isTicked && prevTicked;
                    // Não pode desmarcar bolinha vermelha (controle rígido)
                    const isAdminTickOp = operator?.name?.toLowerCase().trim() === 'guilherme' || operator?.name?.toLowerCase().trim() === 'thiago';
                    const canUntick = isTicked && (isAdminTickOp || !isRed) && (step === 7 || !tickMap[step + 1]?.ticked);
                    const tickedDate = tick?.tickedAt ? new Date(tick.tickedAt).toLocaleDateString('pt-BR') : null;
                    const tickedBy = tick?.tickedBy || null;
                    const isActionStep = [1,3,5].includes(step);
                    const isDecisionStep = step === 7;
                    // Bolinha pisca vermelho quando: telefone vibrando (blink) e este step de ação está pendente
                    // pendingDays contém os dias de cobrança (1,3,5) que estão pendentes
                    // steps 1,3,5 correspondem aos dias de cobrança 1,3,5
                    const isPendingBlink = phoneState === 'blink' && !isTicked && isActionStep && pendingDays.includes(step);

                    return (
                      <div key={step} className="relative flex items-center">
                        {/* Connector line between steps */}
                        {idx > 0 && (
                          <div className={`h-0.5 flex-1 min-w-[8px] max-w-[20px] rounded-full transition-colors ${
                            tickMap[step - 1]?.ticked && isTicked
                              ? (tickMap[step - 1]?.tickStatus === 'red' || isRed ? 'bg-red-300' : (tickMap[step - 1]?.tickStatus === 'blue' || isBlue ? 'bg-blue-300' : 'bg-emerald-400'))
                              : tickMap[step - 1]?.ticked
                                ? (tickMap[step - 1]?.tickStatus === 'red' ? 'bg-red-200' : (tickMap[step - 1]?.tickStatus === 'blue' ? 'bg-blue-200' : 'bg-emerald-200'))
                                : 'bg-slate-200'
                          }`} />
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                if (isToggling) return;
                                if (isRed && !isAdminTickOp) {
                                  toast.error('Falha registrada. Esta bolinha não pode ser alterada.');
                                  return;
                                }
                                if (isRed && isAdminTickOp) {
                                  // Admin pode desticar vermelha
                                  onToggleTick?.(step, false);
                                  return;
                                }
                                if (isTicked && canUntick) {
                                  onToggleTick?.(step, false);
                                } else if (!isTicked && canTickStep) {
                                  // Mostrar opção verde ou vermelho
                                  setTickChoiceStep({ recId: title.id, step });
                                } else if (!isTicked && !canTickStep) {
                                  toast.error(`Complete o passo ${step - 1} antes`);
                                }
                              }}
                              disabled={isToggling}
                              className="flex flex-col items-center gap-0.5 group"
                            >
                              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                                isPendingBlink
                                  ? 'bg-red-100 border-red-400 text-red-600 animate-pulse shadow-sm shadow-red-300 cursor-pointer'
                                  : isRed
                                    ? 'bg-red-500 border-red-600 text-white shadow-sm shadow-red-200 cursor-not-allowed'
                                    : isBlue
                                      ? 'bg-blue-500 border-blue-600 text-white shadow-sm shadow-blue-200'
                                      : isGreen
                                        ? isDecisionStep
                                          ? 'bg-blue-500 border-blue-600 text-white shadow-sm shadow-blue-200'
                                          : 'bg-emerald-500 border-emerald-600 text-white shadow-sm shadow-emerald-200'
                                        : canTickStep
                                          ? 'bg-white border-slate-300 group-hover:border-emerald-400 group-hover:bg-emerald-50 group-hover:shadow-sm cursor-pointer'
                                          : 'bg-slate-50 border-slate-200 cursor-not-allowed'
                              }`}>
                                {isPendingBlink ? <Phone className="w-3.5 h-3.5 animate-bounce" /> :
                                 isRed ? <XCircle className="w-3.5 h-3.5" /> :
                                 isBlue ? <Circle className="w-3.5 h-3.5 fill-white" /> :
                                 isGreen ? <Check className="w-3.5 h-3.5" /> : (
                                  <span className={`text-[9px] font-bold ${
                                    canTickStep ? 'text-slate-400 group-hover:text-emerald-500' : 'text-slate-300'
                                  }`}>{step}</span>
                                )}
                              </div>
                              <span className={`text-[8px] leading-none font-medium whitespace-nowrap ${
                                isPendingBlink ? 'text-red-600 animate-pulse font-bold' :
                                isRed ? 'text-red-600' :
                                isBlue ? 'text-blue-600' :
                                isGreen ? 'text-emerald-600' :
                                canTickStep ? 'text-slate-500' : 'text-slate-300'
                              }`}>
                                {isDecisionStep ? 'Decisão' : isActionStep ? `Ação ${Math.ceil(step/2)}` : 'Intervalo'}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[200px]">
                            <p className="font-semibold">{TICK_LABELS[step - 1]}</p>
                            {isRed && (
                              <p className="text-red-600 mt-0.5 font-medium">✗ FALHA — Dia passou sem ticagem{tickedDate ? ` (${tickedDate})` : ''}</p>
                            )}
                            {isBlue && tickedBy && (
                              <p className="text-blue-600 mt-0.5">○ Neutro — {tickedBy}{tickedDate ? ` (${tickedDate})` : ''}</p>
                            )}
                            {isGreen && tickedBy && (
                              <p className="text-emerald-600 mt-0.5">✓ {tickedBy} — {tickedDate}</p>
                            )}
                            {isPendingBlink && <p className="text-red-600 mt-0.5 font-bold animate-pulse">⚠ AÇÃO PENDENTE — Registre a cobrança!</p>}
                            {!isTicked && canTickStep && !isPendingBlink && <p className="text-blue-600 mt-0.5">Clique para marcar</p>}
                            {!isTicked && !canTickStep && <p className="text-slate-400 mt-0.5">Complete o passo anterior</p>}
                          </TooltipContent>
                        </Tooltip>
                        {/* Popover de escolha verde/vermelho */}
                        {tickChoiceStep?.recId === title.id && tickChoiceStep?.step === step && (
                          <div className="absolute z-50 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 p-2 flex gap-2 animate-in fade-in slide-in-from-top-1" style={{ top: '100%', left: '50%', transform: 'translateX(-50%)' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleTick?.(step, true, 'green');
                                setTickChoiceStep(null);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" /> Cumprido
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleTick?.(step, true, 'red');
                                setTickChoiceStep(null);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Falha
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleTick?.(step, true, 'blue');
                                setTickChoiceStep(null);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold transition-colors"
                            >
                              <Circle className="w-3.5 h-3.5 fill-blue-500" /> Neutro
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTickChoiceStep(null);
                              }}
                              className="px-2 py-1.5 rounded-md hover:bg-slate-100 text-slate-400 text-xs transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </TooltipProvider>
              </div>

              {/* Progress bar */}
              <div className="w-px h-6 bg-slate-200" />
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                  {greenCount > 0 && (
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${(greenCount / 7) * 100}%` }}
                    />
                  )}
                  {blueCount > 0 && (
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${(blueCount / 7) * 100}%` }}
                    />
                  )}
                  {redCount > 0 && (
                    <div
                      className="h-full bg-red-500 transition-all duration-500"
                      style={{ width: `${(redCount / 7) * 100}%` }}
                    />
                  )}
                </div>
                {hasRedTicks && (
                  <span className="text-[9px] font-bold text-red-600">{redCount} falha{redCount > 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isExpanded && <TitleDetails title={title} />}
    </div>
  );
}

/* ---- Componente ClienteTitleRow (vista por cliente) ---- */
function ClienteTitleRow({ title, isExpanded, onToggle, onOpenAction, onOpenContato, onOpenHistory, onOpenActionPlan, onOpenDocument, onPhoneClick, onStatusChange, phoneState, dayBadge, protestLabel, needsActionPlan: needsPlan, hasDocument, canCobranca = true, isVitoria = false, onOpenDecisaoTutorial }: {
  title: Title;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenAction: () => void;
  onOpenContato: () => void;
  onOpenHistory: () => void;
  onOpenActionPlan: () => void;
  onOpenDocument: () => void;
  onPhoneClick: (phoneState: string, hasDocument: boolean, needsPlan: boolean) => void;
  onStatusChange: (status: string) => void;
  phoneState: "blink" | "done" | "urgent" | "idle" | "document" | "muted";
  dayBadge: string | null;
  protestLabel: { label: string; color: string } | null;
  needsActionPlan: boolean;
  hasDocument: boolean;
  canCobranca?: boolean;
  isVitoria?: boolean;
  onOpenDecisaoTutorial?: (clienteName: string, vendedorName: string) => void;
}) {
  const statusBadge = getStatusBadge(title.cobranca?.status || "pendente");

  return (
    <div className="transition-all">
      <div
        className="grid grid-cols-1 md:grid-cols-[1fr_100px_85px_130px_95px_85px_55px_100px_120px] cursor-pointer hover:bg-slate-50/80 items-center"
        onClick={onToggle}
      >
        <div className="min-w-0 px-3 py-2.5 border-r border-slate-300">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] text-slate-700 break-words leading-tight">
              {title.referenteA}
              {title.documento && ` · ${title.documento}`}
              {title.parcela && ` · ${title.parcela}`}
            </span>
            {canCobranca && dayBadge && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded-full bg-amber-200 text-amber-800 border border-amber-300 shrink-0">
                {dayBadge}
              </span>
            )}
            {canCobranca && protestLabel && (
              <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full border shrink-0 ${protestLabel.color}`}>
                {protestLabel.label}
              </span>
            )}
            {canCobranca && needsPlan && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded-full bg-red-200 text-red-800 border border-red-300 animate-pulse shrink-0">
                Plano!
              </span>
            )}
          </div>
        </div>
        {/* Vendedor */}
        <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-300">
          {title.vendedor ? (
            <span className="text-[10px] font-medium text-blue-600 break-words text-center leading-tight" title={title.vendedor}>{title.vendedor}</span>
          ) : (
            <span className="text-[10px] text-slate-300">—</span>
          )}
        </div>
        {/* Forma de Cobrança */}
        <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-300">
          {(() => {
            const fc = title.formaCobranca || "";
            const d = fc.toUpperCase();
            let label = "", color = "text-slate-400";
            if (d.startsWith("PIX")) { label = "PIX"; color = "text-emerald-600"; }
            else if (d.startsWith("BOLETO")) { label = "Boleto"; color = "text-blue-600"; }
            else if (d.startsWith("CHEQUE")) { label = "Cheque"; color = "text-amber-600"; }
            else if (d.startsWith("DEP\u00d3SITO") || d.startsWith("DEPOSITO")) { label = "Dep\u00f3sito"; color = "text-purple-600"; }
            else if (d.startsWith("DINHEIRO")) { label = "Dinheiro"; color = "text-green-700"; }
            else if (fc) { const first = fc.split(" ")[0]; label = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(); color = "text-slate-600"; }
            return label ? (
              <span className={`text-[10px] font-semibold ${color}`} title={fc}>{label}</span>
            ) : (
              <span className="text-[10px] text-slate-300">—</span>
            );
          })()}
        </div>
        {/* Decisão de Cobrança */}
        <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-300">
          {title.decisaoCobranca ? (
            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
              title.decisaoCobranca.toUpperCase().includes('COM PROTESTO')
                ? 'bg-orange-100 text-orange-700 border-orange-300'
                : 'bg-blue-100 text-blue-700 border-blue-300'
            }`}>
              {getDecisaoLabel(title.decisaoCobranca)}
            </span>
          ) : (isVitoria && onOpenDecisaoTutorial) ? (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenDecisaoTutorial(title.cliente, title.vendedor || 'Vendedor'); }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-700 hover:bg-amber-200 transition-all animate-pulse hover:animate-none"
              title="Clique para ver como preencher a decisão de cobrança"
            >
              <Eye className="w-3 h-3" />
              <span className="text-[8px] font-bold">Preencher</span>
            </button>
          ) : (
            <span className="text-[10px] text-slate-300">—</span>
          )}
        </div>
        {/* Valor */}
        <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-300">
          <span className={`font-bold text-sm ${getAgingColor(title.diasAtraso)}`}>
            {formatCurrency(title.valorAReceber)}
          </span>
        </div>
        <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-300 text-sm text-slate-600">{formatDate(title.vencimento)}</div>
        <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-300">
          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${getAgingColor(title.diasAtraso)}`}>
            {title.diasAtraso}d
          </span>
        </div>
        <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-300" onClick={e => e.stopPropagation()}>
          {canCobranca ? (
            <select
              value={title.cobranca?.status || "pendente"}
              onChange={e => onStatusChange(e.target.value)}
              className={`text-[10px] font-medium px-1.5 py-1 rounded-md border cursor-pointer w-full ${statusBadge.color}`}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          ) : (
            <span className={`text-[10px] font-medium px-1.5 py-1 rounded-md border inline-block ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          )}
        </div>
        <div className="flex items-center justify-center gap-0.5 px-2 py-2.5" onClick={e => e.stopPropagation()}>
          {canCobranca && <PhoneIcon state={phoneState} onClick={() => onPhoneClick(phoneState, hasDocument, needsPlan)} />}
          {hasDocument && (
            <button onClick={onOpenDocument} title="Ver documento" className="p-1 rounded-md hover:bg-amber-100 text-amber-700 border border-amber-200">
              <FileText className="w-3.5 h-3.5" />
            </button>
          )}
          {canCobranca && (
            <button onClick={onOpenHistory} title="Histórico" className="p-1 rounded-md hover:bg-white/80 text-emerald-600">
              <History className="w-3.5 h-3.5" />
            </button>
          )}
          {canCobranca && (
            <button onClick={onOpenAction} title="Gerenciar cobrança" className="p-1 rounded-md hover:bg-white/80 text-slate-600">
              <FileText className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onToggle} className="p-1 rounded-md hover:bg-white/80 text-slate-400">
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {isExpanded && <TitleDetails title={title} />}
    </div>
  );
}

/* ---- Detalhes compartilhados ---- */
function TitleDetails({ title }: { title: Title }) {
  const lembreteVencido = title.cobranca?.lembreteData && title.cobranca.lembreteData <= new Date().toISOString().split("T")[0];

  return (
    <div className="px-4 pb-4 space-y-3 bg-white/60">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DetailItem label="Valor Original" value={formatCurrency(title.valorOriginal)} />
        <DetailItem label="Valor Pago" value={formatCurrency(title.valorPago)} />
        <DetailItem label="Emissão" value={formatDate(title.emissao)} />
        <DetailItem label="Empresa" value={title.empresa || "-"} />
        <DetailItem label="Banco" value={title.banco || "-"} />
        <DetailItem label="Tipo" value={title.tipo} />
        {title.cobranca?.promessaData && (
          <DetailItem label="Promessa de Pgto" value={`${formatDate(title.cobranca.promessaData)}${title.cobranca.promessaValor ? ` - ${formatCurrency(title.cobranca.promessaValor)}` : ""}`} />
        )}
        {title.cobranca?.lembreteData && (
          <DetailItem label="Lembrete" value={formatDate(title.cobranca.lembreteData)} highlight={!!lembreteVencido} />
        )}
      </div>

      {title.anotacoes && (
        <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg p-3">
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">Anotações Maxiprod</div>
          <p className="text-sm font-semibold text-amber-900 whitespace-pre-line">{title.anotacoes}</p>
        </div>
      )}

      {(title.cobranca?.observacoes || title.observacoesMaxiprod) && (
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Observações</div>
          {title.cobranca?.observacoes && <p className="text-sm text-slate-700">{title.cobranca.observacoes}</p>}
          {title.observacoesMaxiprod && <p className="text-xs text-slate-400 mt-1">Maxiprod: {title.observacoesMaxiprod}</p>}
        </div>
      )}

      {title.cobranca?.contatoHistorico && title.cobranca.contatoHistorico.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Histórico de Contatos (Antigo)</div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {title.cobranca.contatoHistorico.map((c, i) => {
              const tipoInfo = CONTATO_TIPOS.find(t => t.value === c.tipo);
              const Icon = tipoInfo?.icon || Phone;
              return (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Icon className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400">
                      {new Date(c.data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} {new Date(c.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">({tipoInfo?.label || c.tipo})</span>
                    {c.usuario && <span className="text-xs text-blue-500 ml-1">· {c.usuario}</span>}
                    <p className="text-slate-700">{c.resumo}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-400 uppercase">{label}</div>
      <div className={`text-sm font-medium ${highlight ? "text-red-600" : "text-slate-700"}`}>{value}</div>
    </div>
  );
}

/* ---- Dialog de Ação de Cobrança Diária (telefone) ---- */
function CollectionActionDialog({ title, operatorName, onClose, onSave, isSaving }: {
  title: Title;
  operatorName: string;
  onClose: () => void;
  onSave: (data: { receivableId: number; actionTypes: ("ligacao" | "whatsapp" | "email" | "visita" | "outro")[]; operatorName: string; notes?: string }) => void;
  isSaving: boolean;
}) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const ACTION_TYPES = [
    { value: "ligacao" as const, label: "Ligação", icon: Phone },
    { value: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle },
    { value: "email" as const, label: "E-mail", icon: Mail },
    { value: "visita" as const, label: "Visita", icon: User },
    { value: "outro" as const, label: "Outro", icon: Send },
  ];

  // Sugestão automática baseada no dia de atraso (guia de cobrança)
  const suggestedTypes = useMemo(() => {
    if (title.businessDaysOverdue === 1) return ["whatsapp", "email"];
    if (title.businessDaysOverdue === 3) return ["ligacao", "email"];
    if (title.businessDaysOverdue === 5) return ["ligacao", "email"];
    return [];
  }, [title.businessDaysOverdue]);

  function toggleType(value: string) {
    setSelectedTypes(prev => {
      if (prev.includes(value)) return prev.filter(v => v !== value);
      return [...prev, value];
    });
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-600" />
            Registrar Ação de Cobrança
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="font-semibold text-sm text-slate-800">{title.cliente}</div>
            <div className="text-xs text-slate-500 mt-0.5">{title.referenteA} · {formatCurrency(title.valorAReceber)} · {title.diasAtraso}d atraso</div>
            {title.businessDaysOverdue >= 1 && title.businessDaysOverdue <= 7 && (
              <div className="mt-1.5 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded inline-block">
                Dia {title.businessDaysOverdue}/7 — {7 - title.businessDaysOverdue} dia(s) para protesto
              </div>
            )}
          </div>

          {/* Sugestão do guia de cobrança */}
          {suggestedTypes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <div className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Guia de Cobrança — Dia {title.businessDaysOverdue}
              </div>
              <div className="text-xs text-amber-700">
                Ações obrigatórias: <span className="font-bold">{suggestedTypes.map(t => ACTION_TYPES.find(a => a.value === t)?.label).join(" + ")}</span>
              </div>
              <div className="text-[10px] text-amber-600 mt-0.5">
                O telefone só para de vibrar quando TODAS as ações forem registradas.
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Tipo de Contato <span className="text-blue-500">(selecione um ou mais)</span></label>
            <div className="grid grid-cols-5 gap-2 mt-1">
              {ACTION_TYPES.map(t => {
                const Icon = t.icon;
                const isSelected = selectedTypes.includes(t.value);
                const isSuggested = suggestedTypes.includes(t.value);
                return (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => toggleType(t.value)}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? "bg-blue-50 border-blue-400 text-blue-700 ring-2 ring-blue-300"
                        : isSuggested
                        ? "bg-amber-50 border-amber-300 text-amber-700 hover:border-amber-400"
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Observações da Ação</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Descreva o que foi feito, resultado da conversa, próximos passos..."
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none"
              autoFocus
            />
          </div>

          <div className="text-xs text-slate-400">
            Registrando como: <span className="font-semibold text-slate-600">{operatorName}</span>
            {selectedTypes.length > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                • {selectedTypes.length} tipo(s) selecionado(s)
              </span>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button
              type="button"
              onClick={() => {
                if (selectedTypes.length === 0) {
                  toast.error("Selecione pelo menos um tipo de contato!");
                  return;
                }
                if (!notes.trim()) {
                  toast.error("Preencha as observações da ação!");
                  return;
                }
                onSave({
                  receivableId: title.id,
                  actionTypes: selectedTypes as ("ligacao" | "whatsapp" | "email" | "visita" | "outro")[],
                  operatorName,
                  notes: notes.trim(),
                });
              }}
              disabled={isSaving || !notes.trim() || selectedTypes.length === 0}
              className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Registrando..." : `Registrar ${selectedTypes.length > 0 ? selectedTypes.length + " Ação(s)" : "Ação"}`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Dialog de Histórico de Cobrança ---- */
function HistoryDialog({ title, onClose }: {
  title: Title;
  onClose: () => void;
}) {
  const { operator } = useOperator();
  const utils = trpc.useUtils();
  const isAdminEditor = operator?.name?.toLowerCase().trim() === 'guilherme' || operator?.name?.toLowerCase().trim() === 'thiago';
  const { data: history, isLoading } = trpc.financial.getCollectionHistory.useQuery({ receivableId: title.id });
  const { data: checklist, isLoading: checklistLoading } = trpc.financial.getCollectionChecklist.useQuery({ receivableId: title.id });
  const [activeTab, setActiveTab] = useState("checklist");

  // Mutation para toggle de bolinhas no roteiro
  const toggleTick = trpc.financial.toggleManualTick.useMutation({
    onSuccess: () => {
      utils.financial.getCollectionChecklist.invalidate({ receivableId: title.id });
      utils.financial.getManualTicksBatch.invalidate();
      toast.success('Bolinha atualizada!');
    },
    onError: (err) => toast.error(err.message),
  });

  // Mutation para registrar ação retroativa
  const registerAction = trpc.financial.registerCollectionAction.useMutation({
    onSuccess: () => {
      utils.financial.getCollectionHistory.invalidate({ receivableId: title.id });
      utils.financial.getCollectionChecklist.invalidate({ receivableId: title.id });
      utils.financial.getTodayActions.invalidate();
      toast.success('Ação registrada!');
    },
    onError: (err) => toast.error(err.message),
  });

  // Estado para adicionar nova ação manualmente
  const [showAddAction, setShowAddAction] = useState(false);
  const [newActionDate, setNewActionDate] = useState(new Date().toISOString().split('T')[0]);
  const [newActionTypes, setNewActionTypes] = useState<string[]>([]);
  const [newActionNotes, setNewActionNotes] = useState('');

  // ---- PDF do Histórico ----
  function exportHistoryPDF() {
    if (!history || history.length === 0) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [297, 210] });
    const pageW = 297;
    const pageH = 210;
    const margin = 8;
    const usableW = pageW - margin * 2;
    let y = margin;
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("GRUPO FOX", margin, 12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Histórico de Cobrança", margin, 19);
    const now = new Date();
    doc.setFontSize(8);
    doc.text(`Gerado em: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, pageW - margin, 12, { align: "right" });
    y = 34;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, usableW, 18, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(title.cliente, margin + 4, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const infoLine = `${title.referenteA || ""} | Valor: ${formatCurrency(title.valorAReceber)} | Vencimento: ${formatDate(title.vencimento)} | Atraso: ${title.diasAtraso} dias | Vendedor: ${title.vendedor || "—"}`;
    doc.text(infoLine, margin + 4, y + 14);
    y += 24;
    const cols = [
      { header: "DATA", width: 30 },
      { header: "TIPO", width: 35 },
      { header: "RESPONSÁVEL", width: 45 },
      { header: "STATUS", width: 30 },
      { header: "OBSERVAÇÕES", width: usableW - 30 - 35 - 45 - 30 },
    ];
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, usableW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    let colX = margin;
    for (const col of cols) {
      doc.text(col.header, colX + col.width / 2, y + 5.5, { align: "center" });
      colX += col.width;
    }
    y += 8;
    doc.setFontSize(7);
    for (let i = 0; i < history.length; i++) {
      const action: any = history[i];
      const isSemContato = action.actionType === "sem_contato";
      const rowH = 7;
      if (y + rowH > pageH - 15) {
        doc.addPage([297, 210], "landscape");
        y = margin;
        doc.setFillColor(30, 41, 59);
        doc.rect(margin, y, usableW, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        colX = margin;
        for (const col of cols) {
          doc.text(col.header, colX + col.width / 2, y + 5.5, { align: "center" });
          colX += col.width;
        }
        y += 8;
      }
      if (isSemContato) doc.setFillColor(254, 242, 242);
      else if (i % 2 === 0) doc.setFillColor(255, 255, 255);
      else doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, usableW, rowH, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      colX = margin;
      doc.text(formatDate(action.actionDate), colX + cols[0].width / 2, y + 4.5, { align: "center" });
      colX += cols[0].width;
      const tipoLabel = ACTION_TYPE_LABELS[action.actionType] || action.actionType;
      if (isSemContato) doc.setTextColor(185, 28, 28);
      else doc.setTextColor(21, 128, 61);
      doc.setFont("helvetica", "bold");
      doc.text(tipoLabel, colX + cols[1].width / 2, y + 4.5, { align: "center" });
      colX += cols[1].width;
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      doc.text(action.operatorName || "—", colX + cols[2].width / 2, y + 4.5, { align: "center" });
      colX += cols[2].width;
      const statusLabel = action.isAutomatic ? "Automático" : "Manual";
      doc.text(statusLabel, colX + cols[3].width / 2, y + 4.5, { align: "center" });
      colX += cols[3].width;
      const notes = action.notes || "—";
      const truncNotes = notes.length > 80 ? notes.substring(0, 77) + "..." : notes;
      doc.text(truncNotes, colX + 2, y + 4.5);
      y += rowH;
    }
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Página ${p} de ${totalPages} | GRUPO FOX — Histórico de Cobrança | ${now.toLocaleDateString("pt-BR")}`, pageW / 2, pageH - 5, { align: "center" });
    }
    doc.save(`Historico_Cobranca_${title.cliente.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_${now.toISOString().split("T")[0]}.pdf`);
    toast.success("PDF do histórico exportado!");
  }

  // ---- PDF do Checklist do Roteiro ----
  function exportChecklistPDF() {
    if (!checklist || !checklist.steps || checklist.steps.length === 0) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;
    const margin = 12;
    const usableW = pageW - margin * 2;
    let y = margin;
    const now = new Date();

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 32, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("GRUPO FOX", margin, 14);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Checklist do Roteiro de Cobrança", margin, 23);
    doc.setFontSize(8);
    doc.text(`Gerado em: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, pageW - margin, 14, { align: "right" });
    y = 40;

    // Client info box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, usableW, 22, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(checklist.cliente || title.cliente, margin + 4, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Valor: ${formatCurrency(checklist.valorAReceber ?? 0)} | Vencimento: ${formatDate(checklist.vencimento ?? "")} | Atraso: ${checklist.diasAtraso ?? 0} dias`, margin + 4, y + 15);
    y += 28;

    // Summary badges
    const pdfVerdes = checklist.steps.filter((s: any) => s.status === "verde").length;
    const pdfDispensados = checklist.steps.filter((s: any) => s.status === "dispensado").length;
    const pdfVermelhos = checklist.steps.filter((s: any) => s.status === "vermelho").length;
    const pdfPendentes = checklist.steps.filter((s: any) => s.status === "pendente").length;
    const pdfFuturos = checklist.steps.filter((s: any) => s.status === "futuro").length;

    // Summary row
    const hasDis = pdfDispensados > 0;
    const badgeCols = hasDis ? 5 : 4;
    const badgeW = usableW / badgeCols;
    const badges = [
      { label: "Realizados", count: pdfVerdes, r: 34, g: 197, b: 94 },
      ...(hasDis ? [{ label: "Dispensados", count: pdfDispensados, r: 245, g: 158, b: 11 }] : []),
      { label: "Falhas", count: pdfVermelhos, r: 239, g: 68, b: 68 },
      { label: "Pendentes", count: pdfPendentes, r: 59, g: 130, b: 246 },
      { label: "Futuros", count: pdfFuturos, r: 148, g: 163, b: 184 },
    ];
    for (let i = 0; i < badges.length; i++) {
      const bx = margin + i * badgeW;
      doc.setFillColor(badges[i].r, badges[i].g, badges[i].b);
      doc.roundedRect(bx + 1, y, badgeW - 2, 14, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(String(badges[i].count), bx + badgeW / 2, y + 7, { align: "center" });
      doc.setFontSize(7);
      doc.text(badges[i].label, bx + badgeW / 2, y + 12, { align: "center" });
    }
    y += 20;

    // Steps
    for (const step of checklist.steps as any[]) {
      if (y + 28 > pageH - 15) {
        doc.addPage();
        y = margin;
      }

      // Status color bar
      const statusColors: Record<string, [number, number, number]> = {
        verde: [34, 197, 94],
        dispensado: [245, 158, 11],
        vermelho: [239, 68, 68],
        pendente: [59, 130, 246],
        futuro: [148, 163, 184],
      };
      const [cr, cg, cb] = statusColors[step.status] || [148, 163, 184];

      // Step card
      const stepH = 20 + (step.acoes && step.acoes.length > 0 ? step.acoes.length * 5 : 0);
      doc.setFillColor(cr, cg, cb);
      doc.roundedRect(margin, y, 4, stepH, 1, 1, "F");
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(margin + 4, y, usableW - 4, stepH, 0, 0, "F");
      doc.setDrawColor(230, 230, 230);
      doc.roundedRect(margin, y, usableW, stepH, 1, 1, "S");

      // Status icon text
      const statusIcon = step.status === "verde" ? "[OK]" : step.status === "dispensado" ? "[~]" : step.status === "vermelho" ? "[X]" : step.status === "pendente" ? "[...]" : "[--]";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(cr, cg, cb);
      doc.text(statusIcon, margin + 8, y + 6);

      // Label
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.text(step.label, margin + 22, y + 6);

      // Date
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(formatDate(step.data), pageW - margin - 4, y + 6, { align: "right" });

      // Motivo
      doc.setFontSize(8);
      doc.setTextColor(cr, cg, cb);
      doc.text(step.motivo, margin + 22, y + 13);

      // Ações realizadas
      if (step.acoes && step.acoes.length > 0) {
        let ay = y + 18;
        for (const acao of step.acoes) {
          doc.setFontSize(7);
          doc.setTextColor(71, 85, 105);
          const aLabel = ACTION_TYPE_LABELS[acao.tipo] || acao.tipo;
          doc.text(`${acao.hora} — ${aLabel} (${acao.operador})${acao.notas ? " — " + acao.notas.substring(0, 60) : ""}`, margin + 22, ay);
          ay += 5;
        }
      }

      y += stepH + 3;
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Página ${p} de ${totalPages} | GRUPO FOX — Checklist do Roteiro de Cobrança | ${now.toLocaleDateString("pt-BR")}`, pageW / 2, pageH - 8, { align: "center" });
    }

    doc.save(`Checklist_Cobranca_${title.cliente.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_${now.toISOString().split("T")[0]}.pdf`);
    toast.success("PDF do checklist exportado!");
  }

  // Status icon helper
  function StatusIcon({ status }: { status: string }) {
    switch (status) {
      case "verde": return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
      case "dispensado": return <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0" />;
      case "vermelho": return <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
      case "neutro": return <Circle className="w-5 h-5 text-blue-500 fill-blue-500 shrink-0" />;
      case "pendente": return <Circle className="w-5 h-5 text-blue-500 animate-pulse shrink-0" />;
      case "futuro": return <Circle className="w-5 h-5 text-slate-300 shrink-0" />;
      default: return <Circle className="w-5 h-5 text-slate-300 shrink-0" />;
    }
  }

  function statusBg(status: string) {
    switch (status) {
      case "verde": return "bg-emerald-50 border-emerald-200";
      case "dispensado": return "bg-amber-50 border-amber-200";
      case "vermelho": return "bg-red-50 border-red-200";
      case "neutro": return "bg-blue-50 border-blue-200";
      case "pendente": return "bg-blue-50 border-blue-200";
      case "futuro": return "bg-slate-50 border-slate-200";
      default: return "bg-slate-50 border-slate-200";
    }
  }

  function statusTextColor(status: string) {
    switch (status) {
      case "verde": return "text-emerald-700";
      case "dispensado": return "text-amber-700";
      case "vermelho": return "text-red-700";
      case "neutro": return "text-blue-700";
      case "pendente": return "text-blue-700";
      case "futuro": return "text-slate-400";
      default: return "text-slate-400";
    }
  }

  // Checklist summary — dispensados contam como "verde" para o progresso
  const verdes = checklist?.steps?.filter((s: any) => s.status === "verde" || s.status === "dispensado").length || 0;
  const vermelhos = checklist?.steps?.filter((s: any) => s.status === "vermelho").length || 0;
  const pendentes = checklist?.steps?.filter((s: any) => s.status === "pendente").length || 0;
  const dispensados = checklist?.steps?.filter((s: any) => s.status === "dispensado").length || 0;
  const neutros = checklist?.steps?.filter((s: any) => s.status === "neutro").length || 0;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            Histórico de Cobrança
          </DialogTitle>
        </DialogHeader>

        {/* Client info */}
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="font-semibold text-sm">{title.cliente}</div>
          <div className="text-xs text-slate-500">{title.referenteA} · {formatCurrency(title.valorAReceber)} · {title.diasAtraso}d atraso</div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="checklist" className="gap-1.5 text-xs">
              <ListChecks className="w-3.5 h-3.5" />
              Roteiro (7 dias)
              {!checklistLoading && checklist?.steps && (
                <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  vermelhos > 0 ? "bg-red-100 text-red-700" : verdes === 7 ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {verdes}/7
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs">
              <History className="w-3.5 h-3.5" />
              Histórico
              {!isLoading && history && (
                <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {history.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ---- Tab: Checklist do Roteiro ---- */}
          <TabsContent value="checklist" className="flex-1 overflow-hidden flex flex-col mt-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {!checklistLoading && checklist?.steps && (
                  <>
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {verdes - dispensados}
                    </span>
                    {dispensados > 0 && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 font-medium" title="Dispensados (sistema iniciou em 16/04)">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {dispensados}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                      <XCircle className="w-3.5 h-3.5" /> {vermelhos}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                      <Circle className="w-3.5 h-3.5" /> {pendentes}
                    </span>
                    {neutros > 0 && (
                      <span className="flex items-center gap-1 text-xs text-blue-600 font-medium" title="Neutros (azul)">
                        <Circle className="w-3.5 h-3.5 fill-blue-500 text-blue-500" /> {neutros}
                      </span>
                    )}
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={exportChecklistPDF}
                disabled={checklistLoading || !checklist?.steps || checklist.steps.length === 0}
                className="text-xs gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF do Roteiro
              </Button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {checklistLoading && (
                <div className="py-8 text-center text-slate-400">
                  <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-emerald-600 rounded-full mx-auto mb-2" />
                  Carregando roteiro...
                </div>
              )}

              {/* Card amarelo para títulos legados */}
              {!checklistLoading && (checklist as any)?.isLegacyTitle && (
                <div className={`border rounded-lg p-3 flex items-start gap-2 ${
                  (checklist as any)?.legacyNotStarted
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-amber-50 border-amber-300'
                }`}>
                  {(checklist as any)?.legacyNotStarted
                    ? <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className={`text-sm font-semibold ${
                      (checklist as any)?.legacyNotStarted ? 'text-blue-800' : 'text-amber-800'
                    }`}>
                      {(checklist as any)?.legacyNotStarted
                        ? 'Aguardando primeiro contato para iniciar roteiro'
                        : 'Título já estava com mais de 1 dia de atraso quando o sistema de cobrança começou'
                      }
                    </p>
                    <p className={`text-xs mt-0.5 ${
                      (checklist as any)?.legacyNotStarted ? 'text-blue-700' : 'text-amber-700'
                    }`}>
                      {(checklist as any)?.legacyNotStarted
                        ? 'O roteiro de cobrança (1,3,5 dias) só inicia quando o primeiro contato for registrado. Faça o contato para dar start no relógio.'
                        : `O sistema de cobrança iniciou em ${(checklist as any)?.sistemaCobrancaInicio ? new Date((checklist as any).sistemaCobrancaInicio + 'T12:00:00').toLocaleDateString('pt-BR') : '16/04/2026'}. O roteiro foi ajustado a partir da data do primeiro contato.`
                      }
                    </p>
                  </div>
                </div>
              )}

              {!checklistLoading && (!checklist?.steps || checklist.steps.length === 0) && (
                <div className="py-8 text-center text-slate-400">
                  <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum roteiro disponível</p>
                  <p className="text-xs mt-1">O roteiro é calculado a partir da data de vencimento do título</p>
                </div>
              )}

              {checklist?.steps && (checklist.steps as any[]).map((step: any) => (
                <div
                  key={step.dia}
                  className={`rounded-lg border p-3 transition-all ${statusBg(step.status)} ${
                    step.isToday ? "ring-2 ring-blue-400 ring-offset-1" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <StatusIcon status={step.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-800">{step.label}</span>
                          {step.isToday && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white animate-pulse">
                              HOJE
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">{formatDate(step.data)}</span>
                      </div>

                      {/* Descrição do passo */}
                      <p className="text-xs text-slate-500 mt-0.5">{step.descricao}</p>

                      {/* Motivo do status */}
                      <p className={`text-xs font-medium mt-1 ${statusTextColor(step.status)}`}>
                        {step.motivo}
                      </p>

                      {/* Botões de edição manual para admins */}
                      {isAdminEditor && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              if (operator) {
                                toggleTick.mutate({ receivableId: title.id, step: step.dia, ticked: true, operatorName: operator.name, tickStatus: 'green' });
                              }
                            }}
                            disabled={toggleTick.isPending}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all ${
                              step.status === 'verde' || step.status === 'dispensado'
                                ? 'bg-emerald-100 border-emerald-400 text-emerald-700 ring-1 ring-emerald-300'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-emerald-50 hover:border-emerald-300'
                            }`}
                            title="Marcar como verde (concluído)"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Verde
                          </button>
                          <button
                            onClick={() => {
                              if (operator) {
                                toggleTick.mutate({ receivableId: title.id, step: step.dia, ticked: true, operatorName: operator.name, tickStatus: 'red' });
                              }
                            }}
                            disabled={toggleTick.isPending}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all ${
                              step.status === 'vermelho'
                                ? 'bg-red-100 border-red-400 text-red-700 ring-1 ring-red-300'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-300'
                            }`}
                            title="Marcar como vermelho (falha)"
                          >
                            <XCircle className="w-3 h-3" />
                            Vermelho
                          </button>
                          <button
                            onClick={() => {
                              if (operator) {
                                toggleTick.mutate({ receivableId: title.id, step: step.dia, ticked: true, operatorName: operator.name, tickStatus: 'blue' });
                              }
                            }}
                            disabled={toggleTick.isPending}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all ${
                              step.status === 'neutro'
                                ? 'bg-blue-100 border-blue-400 text-blue-700 ring-1 ring-blue-300'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-blue-50 hover:border-blue-300'
                            }`}
                            title="Marcar como neutro (azul/limpo)"
                          >
                            <Circle className="w-3 h-3 fill-blue-500 text-blue-500" />
                            Azul
                          </button>
                          {(step.status === 'verde' || step.status === 'vermelho' || step.status === 'dispensado' || step.status === 'neutro') && (
                            <button
                              onClick={() => {
                                if (operator) {
                                  toggleTick.mutate({ receivableId: title.id, step: step.dia, ticked: false, operatorName: operator.name });
                                }
                              }}
                              disabled={toggleTick.isPending}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-slate-300 transition-all"
                              title="Remover marcação"
                            >
                              <Circle className="w-3 h-3" />
                              Limpar
                            </button>
                          )}
                        </div>
                      )}

                      {/* Ações realizadas */}
                      {step.acoes && step.acoes.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {step.acoes.map((acao: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-xs bg-white/60 rounded px-2 py-1">
                              <span className="font-medium text-slate-600">{acao.hora}</span>
                              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                acao.tipo === "sem_contato" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                              }`}>
                                {ACTION_TYPE_LABELS[acao.tipo] || acao.tipo}
                              </span>
                              <span className="text-slate-500">{acao.operador}</span>
                              {acao.notas && <span className="text-slate-400 truncate">— {acao.notas}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ---- Tab: Histórico Completo (com edição) ---- */}
          <HistoryTabContent
            title={title}
            history={history}
            isLoading={isLoading}
            exportHistoryPDF={exportHistoryPDF}
          />
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Tab de Histórico com Edição Inline ---- */
function HistoryTabContent({ title, history, isLoading, exportHistoryPDF }: {
  title: Title;
  history: any[] | undefined;
  isLoading: boolean;
  exportHistoryPDF: () => void;
}) {
  const { operator } = useOperator();
  const utils = trpc.useUtils();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editType, setEditType] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [showEditsFor, setShowEditsFor] = useState<number | null>(null);
  const isAdminEditor = operator?.name?.toLowerCase().trim() === 'guilherme' || operator?.name?.toLowerCase().trim() === 'thiago';

  // Estado para adicionar nova ação manualmente
  const [showAddAction, setShowAddAction] = useState(false);
  const [newActionDate, setNewActionDate] = useState(new Date().toISOString().split('T')[0]);
  const [newActionTypes, setNewActionTypes] = useState<string[]>([]);
  const [newActionNotes, setNewActionNotes] = useState('');

  // Mutation para registrar ação retroativa
  const registerAction = trpc.financial.registerCollectionAction.useMutation({
    onSuccess: () => {
      utils.financial.getCollectionHistory.invalidate({ receivableId: title.id });
      utils.financial.getCollectionChecklist.invalidate({ receivableId: title.id });
      utils.financial.getTodayActions.invalidate();
      toast.success('Ação registrada!');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const editMutation = trpc.financial.editDailyAction.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Ação editada com sucesso! (${data.editsCount} alteração(s) registrada(s))`);
        utils.financial.getCollectionHistory.invalidate({ receivableId: title.id });
        utils.financial.getCollectionChecklist.invalidate({ receivableId: title.id });
        utils.financial.getActionEditHistory.invalidate({ receivableId: title.id });
        setEditingId(null);
      }
    },
    onError: () => toast.error("Erro ao editar ação"),
  });

  const { data: editHistory } = trpc.financial.getActionEditHistory.useQuery(
    { receivableId: title.id },
    { enabled: true }
  );

  const startEdit = (action: any) => {
    setEditingId(action.id);
    setEditType(action.actionType);
    setEditDate(action.actionDate || "");
    setEditNotes(action.notes || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditType("");
    setEditDate("");
    setEditNotes("");
  };

  const saveEdit = () => {
    if (!editingId || !operator?.name) return;
    const payload: any = {
      dailyActionId: editingId,
      actionType: editType,
      notes: editNotes,
      editedBy: operator.name,
    };
    if (isAdminEditor && editDate) {
      payload.actionDate = editDate;
    }
    editMutation.mutate(payload);
  };

  // Contar edições por ação
  const editsCountMap = useMemo(() => {
    const map = new Map<number, number>();
    if (editHistory?.edits) {
      for (const e of editHistory.edits) {
        map.set(e.dailyActionId, (map.get(e.dailyActionId) || 0) + 1);
      }
    }
    return map;
  }, [editHistory]);

  const ACTION_TYPES_OPTIONS = [
    { value: "ligacao", label: "Ligação" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "email", label: "E-mail" },
    { value: "visita", label: "Visita" },
    { value: "sem_contato", label: "Sem Contato" },
    { value: "acordo", label: "Acordo" },
    { value: "promessa", label: "Promessa" },
    { value: "negociacao", label: "Negociação" },
    { value: "protesto", label: "Protesto" },
    { value: "outro", label: "Outro" },
  ];

  return (
    <TabsContent value="history" className="flex-1 overflow-hidden flex flex-col mt-2">
      <div className="flex items-center justify-between mb-2">
        {editHistory && editHistory.edits.length > 0 && (
          <span className="text-[10px] text-amber-600 flex items-center gap-1">
            <Pencil className="w-3 h-3" />
            {editHistory.edits.length} edição(s) registrada(s)
          </span>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {isAdminEditor && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddAction(!showAddAction)}
              className="text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Ação
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={exportHistoryPDF}
            disabled={isLoading || !history || history.length === 0}
            className="text-xs gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" />
            PDF do Histórico
          </Button>
        </div>
      </div>

      {/* Formulário de nova ação manual */}
      {showAddAction && isAdminEditor && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              Registrar Ação Manual
            </span>
            <button onClick={() => setShowAddAction(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Data da Ação</label>
            <input
              type="date"
              value={newActionDate}
              onChange={(e) => setNewActionDate(e.target.value)}
              className="w-full text-sm border border-emerald-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Tipo(s) de Contato</label>
            <div className="flex flex-wrap gap-1.5">
              {[{v:'whatsapp',l:'WhatsApp'},{v:'email',l:'E-mail'},{v:'ligacao',l:'Ligação'},{v:'visita',l:'Visita'},{v:'outro',l:'Outro'}].map(t => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setNewActionTypes(prev => prev.includes(t.v) ? prev.filter(x => x !== t.v) : [...prev, t.v])}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-all ${
                    newActionTypes.includes(t.v)
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-700 ring-1 ring-emerald-300'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'
                  }`}
                >
                  {t.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Observações</label>
            <textarea
              value={newActionNotes}
              onChange={(e) => setNewActionNotes(e.target.value)}
              rows={2}
              className="w-full text-sm border border-emerald-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              placeholder="Descreva a ação realizada..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowAddAction(false); setNewActionTypes([]); setNewActionNotes(''); }} className="text-xs">Cancelar</Button>
            <Button
              size="sm"
              onClick={() => {
                if (newActionTypes.length === 0) { toast.error('Selecione pelo menos um tipo!'); return; }
                if (!newActionNotes.trim()) { toast.error('Preencha as observações!'); return; }
                registerAction.mutate({
                  receivableId: title.id,
                  actionTypes: newActionTypes as any,
                  operatorName: operator!.name,
                  notes: newActionNotes.trim(),
                  actionDate: newActionDate,
                });
                setShowAddAction(false);
                setNewActionTypes([]);
                setNewActionNotes('');
              }}
              disabled={registerAction.isPending}
              className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {registerAction.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Registrar Ação
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-y-auto flex-1 space-y-2 pr-1">
        {isLoading && (
          <div className="py-8 text-center text-slate-400">
            <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full mx-auto mb-2" />
            Carregando...
          </div>
        )}

        {!isLoading && (!history || history.length === 0) && (
          <div className="py-8 text-center text-slate-400">
            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma ação registrada ainda</p>
          </div>
        )}

        {history && history.map((action: any, i: number) => {
          const isAutomatic = action.isAutomatic;
          const isSemContato = action.actionType === "sem_contato";
          const isEditing = editingId === action.id;
          const editCount = editsCountMap.get(action.id) || 0;
          const actionEdits = editHistory?.edits?.filter((e: any) => e.dailyActionId === action.id) || [];

          return (
            <div
              key={action.id || i}
              className={`rounded-lg border p-3 ${
                isEditing
                  ? "bg-amber-50 border-amber-300 ring-2 ring-amber-200"
                  : isSemContato
                  ? "bg-red-50 border-red-200"
                  : isAutomatic
                  ? "bg-slate-50 border-slate-200"
                  : "bg-green-50 border-green-200"
              }`}
            >
              {isEditing ? (
                /* ---- Modo Edição ---- */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                      <Pencil className="w-3.5 h-3.5" />
                      Editando ação de {formatDate(action.actionDate)}
                    </span>
                    <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Tipo de Ação</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="w-full text-sm border border-amber-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      {ACTION_TYPES_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  {isAdminEditor && (
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Data da Ação</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full text-sm border border-amber-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Observações</label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      className="w-full text-sm border border-amber-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                      placeholder="Observações da ação..."
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={cancelEdit} className="text-xs">
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      disabled={editMutation.isPending}
                      className="text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {editMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Salvar Edição
                    </Button>
                  </div>
                </div>
              ) : (
                /* ---- Modo Visualização ---- */
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isSemContato
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {ACTION_TYPE_LABELS[action.actionType] || action.actionType}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDate(action.actionDate)}
                      </span>
                      {editCount > 0 && (
                        <button
                          onClick={() => setShowEditsFor(showEditsFor === action.id ? null : action.id)}
                          className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full hover:bg-amber-100 flex items-center gap-0.5"
                          title="Ver histórico de edições"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                          {editCount}x editado
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${isAutomatic ? "text-slate-400" : "text-blue-600"}`}>
                        {action.operatorName}
                      </span>
                      {!isAutomatic && action.id && (
                        <button
                          onClick={() => startEdit(action)}
                          className="text-slate-400 hover:text-amber-600 transition-colors p-0.5 rounded hover:bg-amber-50"
                          title="Editar esta ação"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {action.notes && (
                    <p className="text-sm text-slate-700 mt-1.5">{action.notes}</p>
                  )}

                  {/* Histórico de edições expandido */}
                  {showEditsFor === action.id && actionEdits.length > 0 && (
                    <div className="mt-2 border-t border-amber-200 pt-2 space-y-1">
                      <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" />
                        Histórico de edições
                      </span>
                      {actionEdits.map((edit: any, idx: number) => (
                        <div key={edit.id || idx} className="text-[10px] bg-amber-50 border border-amber-100 rounded px-2 py-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-amber-800">
                              {edit.fieldChanged === "actionType" ? "Tipo" : edit.fieldChanged === "actionDate" ? "Data" : "Observações"} alterado por <span className="font-bold">{edit.editedBy}</span>
                            </span>
                            <span className="text-amber-500">
                              {edit.editedAt ? new Date(edit.editedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-red-500 line-through">
                              {edit.fieldChanged === "actionType" ? (ACTION_TYPE_LABELS[edit.oldValue] || edit.oldValue) : edit.fieldChanged === "actionDate" ? (edit.oldValue ? formatDate(edit.oldValue) : "(vazio)") : (edit.oldValue || "(vazio)")}
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className="text-emerald-600 font-medium">
                              {edit.fieldChanged === "actionType" ? (ACTION_TYPE_LABELS[edit.newValue] || edit.newValue) : edit.fieldChanged === "actionDate" ? (edit.newValue ? formatDate(edit.newValue) : "(vazio)") : (edit.newValue || "(vazio)")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </TabsContent>
  );
}

/* ---- Dialog de Plano de Ação (dia 7+ não protestar) ---- */
function ActionPlanDialog({ title, operatorName, onClose, onSave, isSaving, existingPlan }: {
  title: Title;
  operatorName: string;
  onClose: () => void;
  onSave: (data: { receivableId: number; actionPlan: string; deadlineDate: string; operatorName: string }) => void;
  isSaving: boolean;
  existingPlan?: any;
}) {
  const [actionPlan, setActionPlan] = useState(existingPlan?.actionPlan || "");
  const [deadlineDate, setDeadlineDate] = useState(existingPlan?.deadlineDate || "");

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <ShieldAlert className="w-5 h-5" />
            Plano de Ação Obrigatório
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="font-semibold text-sm text-slate-800">{title.cliente}</div>
            <div className="text-xs text-slate-500 mt-0.5">{title.referenteA} · {formatCurrency(title.valorAReceber)} · {title.diasAtraso}d atraso</div>
            <div className="mt-2 text-xs font-bold text-red-700 bg-red-100 px-2 py-1.5 rounded">
              Este cliente está marcado como "Não Protestar". O protesto automático NÃO será feito.
              Você é responsável por definir um plano de ação e um prazo para resolução.
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">O que será feito? *</label>
            <textarea
              value={actionPlan}
              onChange={e => setActionPlan(e.target.value)}
              rows={4}
              placeholder="Descreva o plano: negociação, parcelamento, visita, acordo..."
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Prazo máximo para o cliente *</label>
            <input
              type="date"
              value={deadlineDate}
              onChange={e => setDeadlineDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm"
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="text-xs text-slate-400">
            Responsável: <span className="font-semibold text-slate-600">{operatorName}</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button
              onClick={() => {
                if (!actionPlan.trim()) {
                  toast.error("Preencha o plano de ação!");
                  return;
                }
                if (!deadlineDate) {
                  toast.error("Defina o prazo máximo!");
                  return;
                }
                onSave({
                  receivableId: title.id,
                  actionPlan: actionPlan.trim(),
                  deadlineDate,
                  operatorName,
                });
              }}
              disabled={isSaving || !actionPlan.trim() || !deadlineDate}
              className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isSaving ? "Salvando..." : "Salvar Plano de Ação"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Dialog de Gerenciar Cobrança (existente, com protesto) ---- */
function ActionDialog({ title, onClose, onSave, isSaving, protestConfig, onSetProtest }: {
  title: Title;
  onClose: () => void;
  onSave: (data: { status?: string; promessaData?: string | null; promessaValor?: number | null; lembreteData?: string | null; observacoes?: string | null }) => void;
  isSaving: boolean;
  protestConfig?: any;
  onSetProtest: (type: "automatico" | "nao_protestar") => void;
}) {
  const [status, setStatus] = useState(title.cobranca?.status || "pendente");
  const [promessaData, setPromessaData] = useState(title.cobranca?.promessaData || "");
  const [promessaValor, setPromessaValor] = useState(title.cobranca?.promessaValor?.toString() || "");
  const [lembreteData, setLembreteData] = useState(title.cobranca?.lembreteData || "");
  const [observacoes, setObservacoes] = useState(title.cobranca?.observacoes || "");

  const currentProtestType = protestConfig?.protestType || "automatico";

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar Cobrança</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 space-y-1">
            <div className="font-semibold text-sm">{title.cliente}</div>
            <div className="text-xs text-slate-500">{title.referenteA} · {formatCurrency(title.valorAReceber)} · Venc: {formatDate(title.vencimento)} · {title.diasAtraso}d atraso</div>
          </div>

          {/* Configuração de Protesto */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              Configuração de Protesto
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => onSetProtest("automatico")}
                className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  currentProtestType === "automatico"
                    ? "bg-orange-50 border-orange-300 text-orange-700 ring-2 ring-orange-400"
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <ShieldAlert className="w-4 h-4 mx-auto mb-1" />
                Com Protesto (Cartório)
                <div className="text-[10px] mt-0.5 opacity-70">Vai p/ cartório no dia 7</div>
              </button>
              <button
                onClick={() => onSetProtest("nao_protestar")}
                className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  currentProtestType === "nao_protestar"
                    ? "bg-blue-50 border-blue-300 text-blue-700 ring-2 ring-blue-400"
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <ShieldCheck className="w-4 h-4 mx-auto mb-1" />
                Não Protestar
                <div className="text-[10px] mt-0.5 opacity-70">Cliente especial</div>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Status de Cobrança</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm">
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Data Promessa Pgto</label>
              <input type="date" value={promessaData} onChange={e => setPromessaData(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Valor Prometido</label>
              <input type="number" step="0.01" value={promessaValor} onChange={e => setPromessaValor(e.target.value)} placeholder="R$ 0,00" className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Lembrete (cobrar novamente em)</label>
            <input type="date" value={lembreteData} onChange={e => setLembreteData(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Observações</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} placeholder="Anotações sobre este título..." className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button
              onClick={() => onSave({
                status,
                promessaData: promessaData || null,
                promessaValor: promessaValor ? Number(promessaValor) : null,
                lembreteData: lembreteData || null,
                observacoes: observacoes || null,
              })}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Componente CollectionDocumentDialog (exibe documento profissional de cobrança) ---- */
function CollectionDocumentDialog({ receivableId, onClose }: {
  receivableId: number;
  onClose: () => void;
}) {
  const { data: doc, isLoading } = trpc.financial.getCollectionDocument.useQuery({ receivableId });
  const { data: checklist } = trpc.financial.getCollectionChecklist.useQuery({ receivableId });
  const markViewed = trpc.financial.markDocumentViewed.useMutation();

  // Marcar como visualizado ao abrir
  React.useEffect(() => {
    if (doc && !doc.visualizadoPorVendedor) {
      markViewed.mutate({ documentId: doc.id });
    }
  }, [doc?.id]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-800">
            <FileText className="w-5 h-5" />
Documento para Tomada de Decisão
           </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="py-12 text-center text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
            <p>Carregando documento...</p>
          </div>
        )}

        {!isLoading && !doc && (
          <div className="py-12 text-center text-slate-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum documento de cobrança encontrado para este título.</p>
            <p className="text-xs mt-1">O documento é gerado automaticamente no 7º dia de atraso para títulos com opção "não protestar".</p>
          </div>
        )}

        {doc && (
          <div className="space-y-4">
            {/* Badge de status */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                {doc.diasAtraso} dias em atraso
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-300">
                NÃO PROTESTAR
              </span>
              {doc.visualizadoPorVendedor && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                  Visualizado pelo vendedor
                </span>
              )}
              {!doc.visualizadoPorVendedor && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-300 animate-pulse">
                  Pendente de visualização
                </span>
              )}
            </div>

            {/* Info resumida */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <span className="text-xs text-slate-500 uppercase font-semibold">Cliente</span>
                <p className="font-bold text-slate-800 mt-0.5">{doc.cliente}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <span className="text-xs text-slate-500 uppercase font-semibold">Vendedor Responsável</span>
                <p className="font-bold text-slate-800 mt-0.5">{doc.vendedor}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <span className="text-xs text-slate-500 uppercase font-semibold">Valor em Aberto</span>
                <p className="font-bold text-red-700 mt-0.5">{formatCurrency(Number(doc.valorTitulo))}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <span className="text-xs text-slate-500 uppercase font-semibold">Protocolo</span>
                <p className="font-mono text-xs text-slate-600 mt-0.5">DOC-COB-{doc.receivableId}-{String(doc.createdAt)?.split('T')[0]?.replace(/-/g, '') || ''}</p>
              </div>
            </div>

            {/* Checklist do Roteiro de Cobrança (7 dias) */}
            {checklist?.steps && checklist.steps.length > 0 && (
              <div className="border border-slate-200 rounded-lg p-3">
                <h4 className="text-xs font-bold text-slate-600 uppercase mb-2 flex items-center gap-2">
                  <ListChecks className="w-4 h-4" />
                  Roteiro de Cobrança (7 dias)
                </h4>
                <div className="flex items-center gap-3 mb-2">
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {checklist.steps.filter((s: any) => s.status === "verde").length} realizados
                  </span>
                  {checklist.steps.filter((s: any) => s.status === "dispensado").length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {checklist.steps.filter((s: any) => s.status === "dispensado").length} dispensados
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                    <XCircle className="w-3.5 h-3.5" /> {checklist.steps.filter((s: any) => s.status === "vermelho").length} falhas
                  </span>
                  <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                    <Circle className="w-3.5 h-3.5" /> {checklist.steps.filter((s: any) => s.status === "pendente").length} pendentes
                  </span>
                </div>
                <div className="space-y-1.5">
                  {(checklist.steps as any[]).map((step: any) => {
                    const bgClass = step.status === "verde" ? "bg-emerald-50 border-emerald-200" :
                      step.status === "dispensado" ? "bg-amber-50 border-amber-200" :
                      step.status === "vermelho" ? "bg-red-50 border-red-200" :
                      step.status === "pendente" ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200";
                    const textClass = step.status === "verde" ? "text-emerald-700" :
                      step.status === "dispensado" ? "text-amber-700" :
                      step.status === "vermelho" ? "text-red-700" :
                      step.status === "pendente" ? "text-blue-700" : "text-slate-400";
                    const icon = step.status === "verde" ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> :
                      step.status === "dispensado" ? <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" /> :
                      step.status === "vermelho" ? <XCircle className="w-4 h-4 text-red-500 shrink-0" /> :
                      step.status === "pendente" ? <Circle className="w-4 h-4 text-blue-500 shrink-0" /> :
                      <Circle className="w-4 h-4 text-slate-300 shrink-0" />;
                    return (
                      <div key={step.dia} className={`flex items-start gap-2 text-xs px-2.5 py-2 rounded-lg border ${bgClass}`}>
                        <div className="pt-0.5">{icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{step.label}</span>
                            <span className="text-slate-400 shrink-0">{formatDate(step.data)}</span>
                          </div>
                          <p className={`font-medium mt-0.5 ${textClass}`}>{step.motivo}</p>
                          {step.acoes && step.acoes.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {step.acoes.map((acao: any, idx: number) => (
                                <div key={idx} className="text-slate-500">
                                  {acao.hora} — {ACTION_TYPE_LABELS[acao.tipo] || acao.tipo} ({acao.operador}){acao.notas ? ` — ${acao.notas}` : ""}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Histórico de ações resumido (fallback se checklist não disponível) */}
            {(!checklist?.steps || checklist.steps.length === 0) && doc.acoesCobanca && Array.isArray(doc.acoesCobanca) && (
              <div className="border border-slate-200 rounded-lg p-3">
                <h4 className="text-xs font-bold text-slate-600 uppercase mb-2">Ações de Cobrança Realizadas</h4>
                <div className="space-y-1">
                  {(doc.acoesCobanca as Array<{dia: number; data: string; tipo: string; realizada: boolean; notas?: string}>).map((acao, idx) => (
                    <div key={idx} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${acao.realizada ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                      <span className="font-bold">{acao.realizada ? '✅' : '❌'}</span>
                      <span className="font-semibold">Dia {acao.dia}</span>
                      <span className="text-slate-500">({formatDate(acao.data)})</span>
                      <span className="font-medium">
                        {acao.tipo === 'ligacao' ? 'Ligação' :
                         acao.tipo === 'whatsapp' ? 'WhatsApp' :
                         acao.tipo === 'email' ? 'E-mail' :
                         acao.tipo === 'visita' ? 'Visita' :
                         acao.tipo === 'sem_contato' ? 'NENHUMA AÇÃO' :
                         acao.tipo}
                      </span>
                      {acao.notas && <span className="text-slate-500 truncate">— {acao.notas}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PDF do documento */}
            {(doc as any).pdfUrl ? (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                <h4 className="text-xs font-bold text-amber-800 uppercase mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Documento Oficial (PDF)
                </h4>
                <div className="bg-white rounded-lg border border-amber-200 overflow-hidden">
                  <iframe
                    src={(doc as any).pdfUrl}
                    className="w-full h-[50vh] border-0"
                    title="Documento para Tomada de Decisão"
                  />
                </div>
                <div className="flex gap-3 mt-3">
                  <a
                    href={(doc as any).pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir PDF em nova aba
                  </a>
                  <a
                    href={(doc as any).pdfUrl}
                    download={`DOC-COB-${doc.receivableId}.pdf`}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-amber-700 border border-amber-300 rounded-lg text-sm font-semibold hover:bg-amber-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Baixar PDF
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                <h4 className="text-xs font-bold text-amber-800 uppercase mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Documento Oficial
                </h4>
                <pre className="text-xs text-slate-800 whitespace-pre-wrap font-mono leading-relaxed bg-white rounded-lg p-4 border border-amber-200 max-h-[40vh] overflow-y-auto">
                  {doc.documentoTexto}
                </pre>
              </div>
            )}

            {/* Data de geração */}
            <div className="text-xs text-slate-400 text-center pt-2">
              Documento gerado em: {doc.createdAt ? new Date(String(doc.createdAt)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-'}
              {doc.visualizadoEm && ` | Visualizado em: ${new Date(String(doc.visualizadoEm)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
