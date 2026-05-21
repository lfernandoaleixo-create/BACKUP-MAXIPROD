import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import {
  X, Search, Filter, ChevronDown, ChevronUp, Edit3, Save, MessageSquare,
  ArrowLeft, DollarSign, Calendar, Building2, FileText, AlertTriangle,
  CheckCircle2, Clock, Phone, Shield, Loader2, Eye, Database, Download, RefreshCw,
  History, Plus, Paperclip, Pencil, Trash2, Check, FileDown, User, CreditCard,
  ShieldCheck, Stamp, ArrowUpDown, ArrowDown, ArrowUp, Users, TreePine, Leaf, Flame, Layers
} from "lucide-react";
import CobrancaGuideSimulator from "@/components/CobrancaGuideSimulator";
import { generateDecisionPdf, type DecisionPdfInput } from "@/lib/decisionPdfExport";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Status colors matching the inadimplência (mesmos status)
const PLANILHA_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  "Pendente": {
    label: "Pendente",
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-300",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  "Contatado": {
    label: "Contatado",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-300",
    icon: <Phone className="w-3 h-3" />,
  },
  "Em negociação": {
    label: "Em negociação",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-300",
    icon: <Clock className="w-3 h-3" />,
  },
  "Promessa de Pgto": {
    label: "Promessa de Pgto",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-300",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  "Não deu retorno": {
    label: "Não deu retorno",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-300",
    icon: <Clock className="w-3 h-3" />,
  },
  "Não atendeu": {
    label: "Não atendeu",
    bg: "bg-pink-50",
    text: "text-pink-700",
    border: "border-pink-300",
    icon: <Phone className="w-3 h-3" />,
  },
  "Protesto em Análise": {
    label: "Protesto em Análise",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-300",
    icon: <Clock className="w-3 h-3" />,
  },
  "Protestado": {
    label: "Protestado",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-300",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  "Jurídico": {
    label: "Jurídico",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-300",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  "Especial s/ cobrança": {
    label: "Especial s/ cobrança",
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-300",
    icon: <Shield className="w-3 h-3" />,
  },
  "Cheque em compensação": {
    label: "Cheque em compensação",
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-300",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
};

const ALL_STATUSES = Object.keys(PLANILHA_STATUS_CONFIG);

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "-";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  if (d.includes("/")) return d;
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

function getStatusConfig(status: string) {
  return PLANILHA_STATUS_CONFIG[status] || PLANILHA_STATUS_CONFIG["Pendente"];
}

function getRowBg(status: string) {
  const cfg = getStatusConfig(status);
  return cfg.bg;
}

/** Extrair o nome-base do cliente (sem ref, NF, etc.) para agrupar */
function getClientKey(empresa: string): string {
  // Normaliza: remove espaços extras, uppercase
  return (empresa || "").trim().toUpperCase();
}

/** Cor da barra lateral por status */
function getStatusBarColor(status: string): string {
  switch (status) {
    case "Contatado": return "#3b82f6";
    case "Em negociação": return "#f59e0b";
    case "Promessa de Pgto": return "#10b981";
    case "Não deu retorno": return "#a855f7";
    case "Não atendeu": return "#ec4899";
    case "Protestado": return "#f97316";
    case "Jurídico": return "#ef4444";
    case "Especial s/ cobrança": return "#06b6d4";
    case "Cheque em compensação": return "#14b8a6";
    default: return "#94a3b8";
  }
}

/** Encurtar forma de cobrança para exibição na tabela */
function shortFormaCobranca(desc: string | null | undefined): { label: string; color: string } {
  if (!desc) return { label: "", color: "text-slate-400" };
  const d = desc.toUpperCase();
  if (d.startsWith("PIX")) return { label: "PIX", color: "text-emerald-600" };
  if (d.startsWith("BOLETO")) return { label: "Boleto", color: "text-blue-600" };
  if (d.startsWith("CHEQUE")) return { label: "Cheque", color: "text-amber-600" };
  if (d.startsWith("DEPÓSITO") || d.startsWith("DEPOSITO")) return { label: "Depósito", color: "text-purple-600" };
  if (d.startsWith("DINHEIRO")) return { label: "Dinheiro", color: "text-green-700" };
  const first = desc.split(" ")[0];
  return { label: first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(), color: "text-slate-600" };
}

/** Renderizar badge de tipo (protesto) com cores */
function renderTipoBadge(tipo: string | null | undefined) {
  if (!tipo) return <span className="text-slate-300 text-[9px]">-</span>;
  const upper = tipo.toUpperCase();
  if (upper.includes("COM PROTESTO")) {
    return (
      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 whitespace-nowrap">
        COM PROTESTO
      </span>
    );
  }
  if (upper.includes("SEM PROTESTO")) {
    return (
      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300 whitespace-nowrap">
        SEM PROTESTO
      </span>
    );
  }
  // Fallback para valores antigos
  if (upper === "COM PROTESTO" || upper === "PROTESTO") {
    return (
      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 whitespace-nowrap">
        COM PROTESTO
      </span>
    );
  }
  if (upper === "SEM PROTESTO" || upper === "S/ PROT." || upper === "S/ PROT") {
    return (
      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300 whitespace-nowrap">
        SEM PROTESTO
      </span>
    );
  }
  return <span className="text-[9px] text-slate-500">{tipo}</span>;
}

interface CobrancaPlanilhaViewProps {
  onClose: () => void;
}

export default function CobrancaPlanilhaView({ onClose }: CobrancaPlanilhaViewProps) {
  const { operator } = useOperator();
  const { data: items, isLoading, refetch } = trpc.cobrancaPlanilha.getAll.useQuery();
  const { data: summary } = trpc.cobrancaPlanilha.getSummary.useQuery();
  const { data: liveStats } = trpc.cobrancaPlanilha.getLiveInadimplenciaStats.useQuery();
  const updateField = trpc.cobrancaPlanilha.updateField.useMutation({
    onSuccess: () => { refetch(); toast.success("Atualizado!"); },
    onError: (err) => toast.error(err.message),
  });
  const updateObservacao = trpc.cobrancaPlanilha.updateObservacao.useMutation({
    onSuccess: () => { refetch(); toast.success("Observação salva!"); },
    onError: (err) => toast.error(err.message),
  });
  const createBackup = trpc.cobrancaPlanilha.createBackup.useMutation({
    onSuccess: (data) => {
      toast.success(`Backup criado com sucesso! ${data.totalItems} títulos salvos.`);
      refetchBackups();
    },
    onError: (err) => toast.error(`Erro ao criar backup: ${err.message}`),
  });
  const { data: backups, refetch: refetchBackups } = trpc.cobrancaPlanilha.listBackups.useQuery();
  // Moved queries below state declarations

  // Toggle Cobrança Pausada
  const togglePausada = trpc.cobrancaPlanilha.toggleEtapaPausada.useMutation({
    onSuccess: () => { refetch(); },
    onError: (err) => toast.error(err.message),
  });

  // Observações por etapa
  const addEtapaObs = trpc.cobrancaPlanilha.addEtapaObs.useMutation({
    onSuccess: () => { toast.success("Observação salva!"); },
    onError: (err) => toast.error(err.message),
  });
  const planilhaIds = useMemo(() => (items || []).map(i => i.id), [items]);
  const { data: obsCountMap, refetch: refetchObsCounts } = trpc.cobrancaPlanilha.countEtapaObs.useQuery(
    { planilhaIds },
    { enabled: planilhaIds.length > 0 }
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [centerFilter, setCenterFilter] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<"diasVencidos" | "valor" | "empresa" | "vencimento">("diasVencidos");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editingObs, setEditingObs] = useState<number | null>(null);
  const [obsText, setObsText] = useState("");
  const [etapaObsDialog, setEtapaObsDialog] = useState<{ planilhaId: number; etapa: string; label: string } | null>(null);
  const [newEtapaObs, setNewEtapaObs] = useState("");
  const [historyDialog, setHistoryDialog] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState<number | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showBackupInfo, setShowBackupInfo] = useState(false);
  const [showCobrancaGuide, setShowCobrancaGuide] = useState(false);
  const [showDecisionPdfHistory, setShowDecisionPdfHistory] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [resolvedSortBy, setResolvedSortBy] = useState<'resolvedAt' | 'diasAtraso' | 'valor'>('resolvedAt');
  const [resolvedSortDir, setResolvedSortDir] = useState<'asc' | 'desc'>('desc');
  const [decisionPdfItemId, setDecisionPdfItemId] = useState<number | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfHistoryFilterMonth, setPdfHistoryFilterMonth] = useState("");
  const [pdfHistorySelectedIds, setPdfHistorySelectedIds] = useState<number[]>([]);
  const [segmentDetailOpen, setSegmentDetailOpen] = useState<string | null>(null);

  // Queries que dependem dos estados acima
  const { data: resolvedData } = trpc.financial.getResolvedTitles.useQuery({ sortOrder: 'newest', sortBy: resolvedSortBy, sortDir: resolvedSortDir });
  const { data: decisionPdfsData } = trpc.financial.listAllDecisionPdfs.useQuery();
  const deletePdf = trpc.financial.deleteDecisionPdf.useMutation();
  const markPaid = trpc.financial.markDecisionPdfsPaid.useMutation();
  const saveDecisionPdf = trpc.financial.saveDecisionPdf.useMutation();
  const utils = trpc.useUtils();
  const [syncResult, setSyncResult] = useState<{ updated: number; added: number; statusUpdated: number; deactivated: number; notInInadimplencia: number; inadimplenciaTotal: number; totalAfter: number } | null>(null);
  const syncFromInadimplencia = trpc.cobrancaPlanilha.syncFromInadimplencia.useMutation({
    onSuccess: (data) => {
      const s = data.summary;
      setSyncResult({ updated: s.updated, added: s.added, statusUpdated: s.statusUpdated, deactivated: s.deactivated, notInInadimplencia: s.notInInadimplencia, inadimplenciaTotal: s.inadimplenciaTotal, totalAfter: s.totalAfter });
      toast.success(`Sincronizado! ${s.totalAfter} títulos na planilha (${s.inadimplenciaTotal} da inadimplência). ${s.updated} atualizados, ${s.added} novos.`);
      refetch();
      refetchBackups();
    },
    onError: (err) => toast.error(`Erro na sincronização: ${err.message}`),
  });

  // Permission: Thiago, Guilherme, Flavio, Thalita can edit
  const canEdit = operator && ["Thiago", "Guilherme", "Flavio", "Thalita"].includes(operator.name);
  const COBRANCA_GUIDE_OPERATORS = ["Flavio", "Thiago", "Guilherme", "Fernando", "Bruno", "Gilson", "Thalita"];
  const canSeeCobrancaGuide = operator && COBRANCA_GUIDE_OPERATORS.includes(operator.name);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    let result = [...items];

    // Search
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(item =>
        (item.empresa || "").toLowerCase().includes(s) ||
        (item.descricao || "").toLowerCase().includes(s) ||
        (item.cnpjCpf || "").toLowerCase().includes(s) ||
        (item.municipio || "").toLowerCase().includes(s) ||
        (item.observacoes || "").toLowerCase().includes(s) ||
        ((item as any).contato || "").toLowerCase().includes(s) ||
        ((item as any).email || "").toLowerCase().includes(s) ||
        (item.vendedor || "").toLowerCase().includes(s) ||
        (item.formaCobranca || "").toLowerCase().includes(s) ||
        ((item as any).apelido || "").toLowerCase().includes(s)
      );
    }

    // Status filter
    if (statusFilter !== "todos") {
      result = result.filter(item => item.status === statusFilter);
    }

    // Center filter
    if (centerFilter !== "todos") {
      result = result.filter(item => item.centroCustos === centerFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "diasVencidos":
          cmp = (a.diasVencidos || 0) - (b.diasVencidos || 0);
          break;
        case "valor":
          cmp = parseFloat(String(a.valor || 0)) - parseFloat(String(b.valor || 0));
          break;
        case "empresa":
          cmp = (a.empresa || "").localeCompare(b.empresa || "");
          break;
        case "vencimento":
          cmp = (a.vencimento || "").localeCompare(b.vencimento || "");
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [items, search, statusFilter, centerFilter, sortBy, sortDir]);

  const totalValor = filteredItems.reduce((sum, item) => sum + parseFloat(String(item.valor || 0)), 0);
  const uniqueClients = useMemo(() => new Set(filteredItems.map(i => getClientKey(i.empresa))), [filteredItems]);

  // Dados agrupados por segmento (centro de custos)
  const segmentData = useMemo(() => {
    if (!items) return [];
    const map = new Map<string, { center: string; items: typeof items; totalValor: number; uniqueClients: Set<string> }>();
    for (const item of items) {
      const center = item.centroCustos || "SEM CLASSIFICAÇÃO";
      if (!map.has(center)) {
        map.set(center, { center, items: [], totalValor: 0, uniqueClients: new Set() });
      }
      const entry = map.get(center)!;
      entry.items.push(item);
      entry.totalValor += parseFloat(String(item.valor || 0));
      entry.uniqueClients.add(getClientKey(item.empresa));
    }
    return Array.from(map.values()).sort((a, b) => b.totalValor - a.totalValor);
  }, [items]);

  const SEGMENT_STYLES: Record<string, { icon: React.ReactNode; gradient: string; border: string; bg: string; text: string; accent: string }> = {
    "MADEIRA": { icon: <TreePine className="w-5 h-5 text-white" />, gradient: "from-amber-600 to-yellow-700", border: "border-amber-300", bg: "from-amber-50 via-yellow-50 to-orange-50", text: "text-amber-900", accent: "text-amber-700" },
    "BAMBU": { icon: <Leaf className="w-5 h-5 text-white" />, gradient: "from-green-600 to-emerald-700", border: "border-green-300", bg: "from-green-50 via-emerald-50 to-teal-50", text: "text-green-900", accent: "text-green-700" },
    "ROJÃO": { icon: <Flame className="w-5 h-5 text-white" />, gradient: "from-red-600 to-rose-700", border: "border-red-300", bg: "from-red-50 via-rose-50 to-pink-50", text: "text-red-900", accent: "text-red-700" },
    "SERRAGEM": { icon: <Layers className="w-5 h-5 text-white" />, gradient: "from-purple-600 to-violet-700", border: "border-purple-300", bg: "from-purple-50 via-violet-50 to-fuchsia-50", text: "text-purple-900", accent: "text-purple-700" },
    "SEM CLASSIFICAÇÃO": { icon: <AlertTriangle className="w-5 h-5 text-white" />, gradient: "from-slate-500 to-gray-600", border: "border-slate-300", bg: "from-slate-50 via-gray-50 to-zinc-50", text: "text-slate-900", accent: "text-slate-700" },
  };

  function getSegmentStyle(center: string) {
    return SEGMENT_STYLES[center] || SEGMENT_STYLES["SEM CLASSIFICAÇÃO"];
  }

  function handleExportSegmentPdf(center: string) {
    const seg = segmentData.find(s => s.center === center);
    if (!seg || seg.items.length === 0) {
      toast.error("Nenhum título para exportar");
      return;
    }
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Header band
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 32, "F");
      const segStyle = getSegmentStyle(center);
      const headerColors: Record<string, [number, number, number]> = {
        "MADEIRA": [217, 119, 6], "BAMBU": [22, 163, 74], "ROJÃO": [220, 38, 38],
        "SERRAGEM": [147, 51, 234], "SEM CLASSIFICAÇÃO": [100, 116, 139],
      };
      const hc = headerColors[center] || [100, 116, 139];
      doc.setFillColor(hc[0], hc[1], hc[2]);
      doc.rect(0, 32, pageW, 2, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("GRUPO FOX", 14, 12);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Inadimplência — ${center}`, 14, 20);
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 27);

      let y = 38;

      // Summary boxes
      const boxW = 52;
      const gap = 6;
      const boxH = 16;

      doc.setFillColor(hc[0], hc[1], hc[2]);
      doc.roundedRect(14, y, boxW, boxH, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("TOTAL EM ABERTO", 18, y + 5);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(seg.totalValor), 18, y + 13);

      doc.setFillColor(71, 85, 105);
      doc.roundedRect(14 + boxW + gap, y, boxW, boxH, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("TÍTULOS", 18 + boxW + gap, y + 5);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(String(seg.items.length), 18 + boxW + gap, y + 13);

      doc.setFillColor(59, 130, 246);
      doc.roundedRect(14 + (boxW + gap) * 2, y, boxW, boxH, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("CLIENTES", 18 + (boxW + gap) * 2, y + 5);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(String(seg.uniqueClients.size), 18 + (boxW + gap) * 2, y + 13);

      y += boxH + 6;

      const ETAPA_SHORT: Record<string, string> = {
        primeiraCobranca: "1ª Cob", segundaCobranca: "2ª Cob",
        terceiraCobranca: "3ª Cob", acaoFinal: "Final",
      };

      const tableData = seg.items.map((item) => {
        const etapas = [
          { field: "primeiraCobranca", value: item.primeiraCobranca },
          { field: "segundaCobranca", value: item.segundaCobranca },
          { field: "terceiraCobranca", value: item.terceiraCobranca },
          { field: "acaoFinal", value: item.acaoFinal },
        ].filter(e => e.value).map(e => `${ETAPA_SHORT[e.field]}: ${formatDate(e.value!)}`);

        const tipoLabel = (() => {
          const t = (item.tipo || "").toUpperCase();
          if (t.includes("COM PROTESTO")) return "COM PROTESTO";
          if (t.includes("SEM PROTESTO")) return "SEM PROTESTO";
          return item.tipo || "-";
        })();

        return [
          item.empresa || "-",
          item.cnpjCpf || "-",
          formatCurrency(parseFloat(String(item.valor || 0))),
          item.vencimento ? formatDate(item.vencimento) : "-",
          String(item.diasVencidos ?? "-"),
          item.status || "-",
          tipoLabel,
          item.vendedor || "-",
          (item as any).contato || "-",
          etapas.length > 0 ? etapas.join("; ") : "-",
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["Empresa", "CNPJ/CPF", "Valor", "Venc.", "Dias", "Status", "Tipo", "Vendedor", "Contato", "Etapas"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 5.5, fontStyle: "bold", cellPadding: 1.5 },
        bodyStyles: { fontSize: 5.5, cellPadding: 1.2 },
        columnStyles: {
          0: { cellWidth: 38 }, 1: { cellWidth: 22 }, 2: { cellWidth: 20, halign: "right", fontStyle: "bold" },
          3: { cellWidth: 14, halign: "center" }, 4: { cellWidth: 10, halign: "center" },
          5: { cellWidth: 22, halign: "center" }, 6: { cellWidth: 22, halign: "center" },
          7: { cellWidth: 26 }, 8: { cellWidth: 24 }, 9: { cellWidth: "auto" },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 5) {
            const val = data.cell.raw;
            if (val === "Contatado") { data.cell.styles.textColor = [29, 78, 216]; data.cell.styles.fontStyle = "bold"; }
            else if (val === "Em negociação") { data.cell.styles.textColor = [180, 120, 20]; data.cell.styles.fontStyle = "bold"; }
            else if (val === "Promessa de Pgto") { data.cell.styles.textColor = [21, 128, 61]; data.cell.styles.fontStyle = "bold"; }
            else if (val === "Protestado" || val === "Jurídico") { data.cell.styles.textColor = [185, 28, 28]; data.cell.styles.fontStyle = "bold"; }
          }
          if (data.section === "body" && data.column.index === 6) {
            const val = (data.cell.raw || "").toUpperCase();
            if (val.includes("COM PROTESTO")) { data.cell.styles.textColor = [185, 28, 28]; data.cell.styles.fontStyle = "bold"; }
            else if (val.includes("SEM PROTESTO")) { data.cell.styles.textColor = [21, 128, 61]; data.cell.styles.fontStyle = "bold"; }
          }
          if (data.section === "body" && data.column.index === 4) {
            const days = parseInt(data.cell.raw);
            if (days >= 90) { data.cell.styles.textColor = [185, 28, 28]; data.cell.styles.fontStyle = "bold"; }
            else if (days >= 30) { data.cell.styles.textColor = [180, 120, 20]; data.cell.styles.fontStyle = "bold"; }
          }
        },
        margin: { left: 14, right: 14 },
      });

      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, pageH - 12, pageW - 14, pageH - 12);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(6.5);
        doc.text(`Grupo Fox — Inadimplência ${center}`, 14, pageH - 7);
        doc.text(`Página ${p} de ${totalPages}`, pageW - 14 - doc.getTextWidth(`Página ${p} de ${totalPages}`), pageH - 7);
      }

      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      doc.save(`Inadimplencia_${center.replace(/[^a-zA-Z0-9]/g, "_")}_${datePart}.pdf`);
      toast.success(`PDF de ${center} exportado com sucesso!`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF");
    }
  }

  function toggleSort(field: typeof sortBy) {
    if (sortBy === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  }

  function handleStatusChange(id: number, newStatus: string) {
    if (!canEdit) return;
    updateField.mutate({ id, field: "status", value: newStatus, updatedBy: operator!.name });
  }

  function handleSaveObs(id: number) {
    updateObservacao.mutate({ id, observacoes: obsText, updatedBy: operator!.name });
    setEditingObs(null);
  }

  function handleCobrancaFieldChange(id: number, field: string, value: string) {
    if (!canEdit) return;
    updateField.mutate({ id, field, value: value || null, updatedBy: operator!.name });
  }

  function handleExportPdf() {
    if (filteredItems.length === 0) {
      toast.error("Nenhum título para exportar");
      return;
    }
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Header band
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 32, "F");
      doc.setFillColor(16, 185, 129); // emerald-500
      doc.rect(0, 32, pageW, 2, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("GRUPO FOX", 14, 12);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Planilha de Cobran\u00E7a \u2014 Inadimpl\u00EAncia", 14, 20);
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 27);

      // Filters info
      let y = 38;
      const activeFilters: string[] = [];
      if (search) activeFilters.push(`Busca: "${search}"`);
      if (statusFilter !== "todos") activeFilters.push(`Status: ${statusFilter}`);
      if (centerFilter !== "todos") activeFilters.push(`Centro: ${centerFilter}`);

      if (activeFilters.length > 0) {
        doc.setFillColor(255, 247, 237);
        doc.roundedRect(14, y, pageW - 28, 12, 2, 2, "F");
        doc.setDrawColor(251, 191, 36);
        doc.roundedRect(14, y, pageW - 28, 12, 2, 2, "S");
        doc.setTextColor(146, 64, 14);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text("FILTROS APLICADOS:", 18, y + 5);
        doc.setFont("helvetica", "normal");
        doc.text(activeFilters.join("  \u2022  "), 18, y + 10);
        y += 16;
      }

      // Summary boxes
      const boxW = 52;
      const gap = 6;
      const boxH = 16;

      doc.setFillColor(16, 185, 129); // emerald
      doc.roundedRect(14, y, boxW, boxH, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("TOTAL EM ABERTO", 18, y + 5);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(totalValor), 18, y + 13);

      doc.setFillColor(71, 85, 105); // slate
      doc.roundedRect(14 + boxW + gap, y, boxW, boxH, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("T\u00CDTULOS", 18 + boxW + gap, y + 5);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(String(filteredItems.length), 18 + boxW + gap, y + 13);

      // Count unique clients
      const uniqueClients = new Set(filteredItems.map(i => getClientKey(i.empresa)));
      doc.setFillColor(59, 130, 246); // blue
      doc.roundedRect(14 + (boxW + gap) * 2, y, boxW, boxH, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("CLIENTES", 18 + (boxW + gap) * 2, y + 5);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(String(uniqueClients.size), 18 + (boxW + gap) * 2, y + 13);

      y += boxH + 6;

      // Main table
      const ETAPA_SHORT: Record<string, string> = {
        primeiraCobranca: "1\u00AA Cob",
        segundaCobranca: "2\u00AA Cob",
        terceiraCobranca: "3\u00AA Cob",
        acaoFinal: "Final",
      };

      const tableData = filteredItems.map((item) => {
        const etapas = [
          { field: "primeiraCobranca", value: item.primeiraCobranca },
          { field: "segundaCobranca", value: item.segundaCobranca },
          { field: "terceiraCobranca", value: item.terceiraCobranca },
          { field: "acaoFinal", value: item.acaoFinal },
        ].filter(e => e.value).map(e => `${ETAPA_SHORT[e.field]}: ${formatDate(e.value!)}`);

        // Tipo por extenso
        const tipoLabel = (() => {
          const t = (item.tipo || "").toUpperCase();
          if (t.includes("COM PROTESTO")) return "COM PROTESTO";
          if (t.includes("SEM PROTESTO")) return "SEM PROTESTO";
          return item.tipo || "-";
        })();

        // Forma de cobrança curta
        const fc = shortFormaCobranca(item.formaCobranca);

        return [
          item.empresa || "-",
          item.cnpjCpf || "-",
          formatCurrency(parseFloat(String(item.valor || 0))),
          item.vencimento ? formatDate(item.vencimento) : "-",
          String(item.diasVencidos ?? "-"),
          item.status || "-",
          tipoLabel,
          item.centroCustos || "-",
          item.documento || "-",
          item.vendedor || "-",
          fc.label || "-",
          (item as any).contato || "-",
          etapas.length > 0 ? etapas.join("; ") : "-",
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["Empresa", "CNPJ/CPF", "Valor", "Venc.", "Dias", "Status", "Tipo", "Centro", "Documento", "Vendedor", "Forma Cob.", "Contato", "Etapas"]],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 5.5,
          fontStyle: "bold",
          cellPadding: 1.5,
        },
        bodyStyles: { fontSize: 5.5, cellPadding: 1.2 },
        columnStyles: {
          0: { cellWidth: 34 },
          1: { cellWidth: 20 },
          2: { cellWidth: 18, halign: "right", fontStyle: "bold" },
          3: { cellWidth: 14, halign: "center" },
          4: { cellWidth: 8, halign: "center" },
          5: { cellWidth: 20, halign: "center" },
          6: { cellWidth: 20, halign: "center" },
          7: { cellWidth: 14, halign: "center" },
          8: { cellWidth: 18, halign: "center" },
          9: { cellWidth: 22 },
          10: { cellWidth: 14, halign: "center" },
          11: { cellWidth: 20 },
          12: { cellWidth: "auto" },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data: any) => {
          // Status colors
          if (data.section === "body" && data.column.index === 5) {
            const val = data.cell.raw;
            if (val === "Pendente") {
              data.cell.styles.textColor = [100, 116, 139];
            } else if (val === "Contatado") {
              data.cell.styles.textColor = [29, 78, 216];
              data.cell.styles.fontStyle = "bold";
            } else if (val === "Em negocia\u00E7\u00E3o") {
              data.cell.styles.textColor = [180, 120, 20];
              data.cell.styles.fontStyle = "bold";
            } else if (val === "Promessa de Pgto") {
              data.cell.styles.textColor = [21, 128, 61];
              data.cell.styles.fontStyle = "bold";
            } else if (val === "Protestado" || val === "Jur\u00EDdico") {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = "bold";
            }
          }
          // Tipo (protesto) colors
          if (data.section === "body" && data.column.index === 6) {
            const val = (data.cell.raw || "").toUpperCase();
            if (val.includes("COM PROTESTO")) {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = "bold";
            } else if (val.includes("SEM PROTESTO")) {
              data.cell.styles.textColor = [21, 128, 61];
              data.cell.styles.fontStyle = "bold";
            }
          }
          // Highlight high days overdue
          if (data.section === "body" && data.column.index === 4) {
            const days = parseInt(data.cell.raw);
            if (days >= 90) {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = "bold";
            } else if (days >= 30) {
              data.cell.styles.textColor = [180, 120, 20];
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
        margin: { left: 14, right: 14 },
      });

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, pageH - 12, pageW - 14, pageH - 12);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(6.5);
        doc.text("Grupo Fox \u2014 Planilha de Cobran\u00E7a", 14, pageH - 7);
        doc.text(`P\u00E1gina ${p} de ${totalPages}`, pageW - 14 - doc.getTextWidth(`P\u00E1gina ${p} de ${totalPages}`), pageH - 7);
      }

      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      doc.save(`Planilha_Cobranca_${datePart}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF");
    }
  }

  function handleCreateBackup() {
    if (!operator) {
      toast.error("Operador não identificado");
      return;
    }
    if (!confirm("Tem certeza que deseja criar um backup instantâneo? Esta ação irá salvar uma cópia completa dos dados atuais da planilha.")) {
      return;
    }
    createBackup.mutate({ createdBy: operator.name });
  }

  function handleSyncFromInadimplencia() {
    if (!operator) {
      toast.error("Operador não identificado");
      return;
    }
    setSyncResult(null);
    syncFromInadimplencia.mutate({ updatedBy: operator.name });
  }

  // Cobrança step display helper - agora recebe o item para verificar pausa
  function renderCobrancaStep(label: string, value: string | null | undefined, etapaField?: string, etapasPausadas?: Record<string, boolean> | null) {
    const isPausedByCheckbox = etapaField && etapasPausadas?.[etapaField];
    if (!value && !isPausedByCheckbox) return <span className="text-slate-300 text-[10px]">-</span>;
    if (isPausedByCheckbox) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          {value && /^\d{4}-\d{2}-\d{2}$/.test(value) && (
            <span className="text-[9px] text-blue-500">{formatDate(value)}</span>
          )}
          <span className="text-[9px] font-bold text-amber-600 italic leading-tight">cobrança pausada</span>
        </div>
      );
    }
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(value!);
    const isPaused = value!.toLowerCase().includes("pausada");
    return (
      <span className={`text-[10px] font-medium ${isPaused ? "text-amber-600 italic" : isDate ? "text-blue-600" : "text-slate-600"}`}>
        {isDate ? formatDate(value!) : value}
      </span>
    );
  }

  /** Determinar se um item é o primeiro de um novo grupo de cliente */
  const clientBoundaries = useMemo(() => {
    const boundaries = new Set<number>();
    if (filteredItems.length === 0) return boundaries;
    for (let i = 1; i < filteredItems.length; i++) {
      const prevKey = getClientKey(filteredItems[i - 1].empresa);
      const currKey = getClientKey(filteredItems[i].empresa);
      if (prevKey !== currKey) {
        boundaries.add(i);
      }
    }
    return boundaries;
  }, [filteredItems]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-slate-500">Carregando planilha de cobrança...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {operator?.name === "Guilherme" && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Tela Antiga
            </button>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Planilha de Cobrança
            </h2>
            <p className="text-xs text-slate-500">
              {liveStats ? liveStats.totalTitulos : filteredItems.length} título{(liveStats ? liveStats.totalTitulos : filteredItems.length) !== 1 ? "s" : ""} · Total: {formatCurrency(liveStats ? liveStats.totalValor : totalValor)}
            </p>
          </div>
        </div>
        {/* Sync + Backup + Export buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors shadow-sm"
            title="Exportar planilha de cobran\u00E7a como PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            Exportar PDF
          </button>
          <button
            onClick={handleSyncFromInadimplencia}
            disabled={syncFromInadimplencia.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
            title="Sincronizar títulos, valores, status e dias vencidos com a inadimplência (preserva marcações manuais)"
          >
            {syncFromInadimplencia.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {syncFromInadimplencia.isPending ? "Sincronizando..." : "Sincronizar c/ Inadimplência"}
          </button>
          <button
            onClick={() => setShowBackupInfo(!showBackupInfo)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-medium transition-colors"
            title="Ver backups"
          >
            <Database className="w-3.5 h-3.5" />
            {backups && backups.length > 0 ? `${backups.length} backup${backups.length !== 1 ? "s" : ""}` : "Backups"}
          </button>
          <button
            onClick={handleCreateBackup}
            disabled={createBackup.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
            title="Criar backup instantâneo de todos os dados da planilha"
          >
            {createBackup.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Backup Instantâneo
          </button>
        </div>
      </div>

      {/* Backup info panel */}
      {showBackupInfo && backups && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-500" />
              Histórico de Backups
            </h3>
            <button onClick={() => setShowBackupInfo(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          {backups.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Nenhum backup criado ainda.</p>
          ) : (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {backups.map((b) => (
                <div key={b.id} className="flex items-center justify-between bg-white rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <div>
                      <span className="text-[11px] font-medium text-slate-700">
                        {new Date(b.snapshotDate).toLocaleDateString("pt-BR")} às {new Date(b.snapshotDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-2">
                        {b.totalItems} títulos
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">por {b.createdBy || "Sistema"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sync result banner */}
      {syncResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-600" />
            <div className="text-xs font-medium text-blue-800">
              <span className="font-bold">Sincronização concluída!</span>{" "}
              {syncResult.totalAfter} títulos na planilha ({syncResult.inadimplenciaTotal} da inadimplência).
              {syncResult.updated > 0 && <span className="ml-1">{syncResult.updated} atualizados.</span>}
              {syncResult.added > 0 && <span className="ml-1 text-green-700 font-bold">{syncResult.added} novos adicionados.</span>}
              {syncResult.statusUpdated > 0 && <span className="ml-1">{syncResult.statusUpdated} status alterados.</span>}
              {syncResult.deactivated > 0 && <span className="ml-1 text-amber-700">{syncResult.deactivated} pagos/resolvidos (removidos da lista).</span>}
            </div>
          </div>
          <button onClick={() => setSyncResult(null)} className="text-blue-400 hover:text-blue-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Resumo Visual - Títulos, Valor, Clientes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-red-50 border border-red-200">
          <FileText className="w-5 h-5 text-red-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-xl sm:text-2xl font-bold text-red-600">{liveStats ? liveStats.totalTitulos : filteredItems.length}</span>
            <span className="text-xs text-red-500 ml-1.5">títulos vencidos</span>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-red-50 border border-red-200">
          <DollarSign className="w-5 h-5 text-red-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-base sm:text-lg font-bold text-red-600 truncate block">{formatCurrency(liveStats ? liveStats.totalValor : totalValor)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-red-50 border border-red-200">
          <Users className="w-5 h-5 text-red-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-xl sm:text-2xl font-bold text-red-600">{uniqueClients.size}</span>
            <span className="text-xs text-red-500 ml-1.5">clientes</span>
          </div>
        </div>
      </div>

      {/* Botões: Guia de Cobrança + PDF Decisão */}
      <div className="flex flex-wrap gap-2">
        {canSeeCobrancaGuide && (
          <button
            onClick={() => setShowCobrancaGuide(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white text-xs font-bold shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all animate-pulse hover:animate-none border-2 border-white/30"
          >
            <Eye className="w-4 h-4" />
            Guia de Cobrança
          </button>
        )}
        <button
          onClick={() => setShowDecisionPdfHistory(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 text-white text-xs font-semibold shadow-md hover:shadow-lg hover:from-blue-800 hover:to-blue-700 transition-all hover:scale-[1.02]"
        >
          <Stamp className="w-4 h-4" />
          PDF Decisão
        </button>
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
            <div className="border-t border-emerald-200">
              <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-emerald-50/50 border-b border-emerald-200">
                <span className="text-[10px] text-emerald-700 font-medium uppercase tracking-wider mr-1">Ordenar:</span>
                <button
                  onClick={() => { if (resolvedSortBy === 'resolvedAt') { setResolvedSortDir(prev => prev === 'desc' ? 'asc' : 'desc'); } else { setResolvedSortBy('resolvedAt'); setResolvedSortDir('desc'); } }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${resolvedSortBy === 'resolvedAt' ? 'bg-emerald-200 text-emerald-800 ring-1 ring-emerald-400' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'}`}
                >
                  {resolvedSortBy === 'resolvedAt' ? (resolvedSortDir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                  Data
                </button>
                <button
                  onClick={() => { if (resolvedSortBy === 'diasAtraso') { setResolvedSortDir(prev => prev === 'desc' ? 'asc' : 'desc'); } else { setResolvedSortBy('diasAtraso'); setResolvedSortDir('desc'); } }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${resolvedSortBy === 'diasAtraso' ? 'bg-emerald-200 text-emerald-800 ring-1 ring-emerald-400' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'}`}
                >
                  {resolvedSortBy === 'diasAtraso' ? (resolvedSortDir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                  Dias Atraso
                </button>
                <button
                  onClick={() => { if (resolvedSortBy === 'valor') { setResolvedSortDir(prev => prev === 'desc' ? 'asc' : 'desc'); } else { setResolvedSortBy('valor'); setResolvedSortDir('desc'); } }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${resolvedSortBy === 'valor' ? 'bg-emerald-200 text-emerald-800 ring-1 ring-emerald-400' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'}`}
                >
                  {resolvedSortBy === 'valor' ? (resolvedSortDir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                  Valor
                </button>
              </div>
              <div className="divide-y divide-emerald-100 max-h-[400px] overflow-y-auto">
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
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {Object.entries(summary.byStatus).map(([status, data]) => {
            const cfg = getStatusConfig(status);
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(isActive ? "todos" : status)}
                className={`rounded-xl border p-3 text-left transition-all hover:shadow-md ${cfg.bg} ${cfg.border} ${isActive ? "ring-2 ring-blue-500 shadow-md" : ""}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cfg.text}>{cfg.icon}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
                </div>
                <div className={`text-xl font-bold ${cfg.text}`}>{data.count}</div>
                <div className={`text-[10px] ${cfg.text} opacity-70`}>{formatCurrency(data.valor)}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Cards de Segmento (Centro de Custos) */}
      {segmentData.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {segmentData.map(seg => {
              const style = getSegmentStyle(seg.center);
              const isOpen = segmentDetailOpen === seg.center;
              const isFiltered = centerFilter === seg.center;
              return (
                <button
                  key={seg.center}
                  onClick={() => {
                    setCenterFilter(isFiltered ? "todos" : seg.center);
                    setSegmentDetailOpen(isOpen ? null : seg.center);
                  }}
                  className={`rounded-xl border-2 p-3 text-left transition-all hover:shadow-lg hover:scale-[1.02] ${style.border} bg-gradient-to-br ${style.bg} ${
                    isFiltered ? "ring-2 ring-blue-500 shadow-lg scale-[1.02]" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${style.gradient} flex items-center justify-center shadow-sm`}>
                      {style.icon}
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-bold ${style.text} truncate`}>{seg.center}</div>
                      <div className={`text-[10px] ${style.accent}`}>{seg.uniqueClients.size} cliente{seg.uniqueClients.size !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-lg font-bold ${style.text}`}>{seg.items.length}</span>
                    <span className={`text-[10px] font-semibold ${style.accent}`}>{formatCurrency(seg.totalValor)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[9px] ${style.accent} opacity-70`}>títulos</span>
                    <span className={`text-[9px] flex items-center gap-0.5 ${isOpen ? style.text : style.accent}`}>
                      {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {isOpen ? "Fechar" : "Detalhes"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detalhe do segmento expandido */}
          {segmentDetailOpen && (() => {
            const seg = segmentData.find(s => s.center === segmentDetailOpen);
            if (!seg) return null;
            const style = getSegmentStyle(seg.center);
            const segItems = seg.items.sort((a, b) => parseFloat(String(b.valor || 0)) - parseFloat(String(a.valor || 0)));
            return (
              <div className={`rounded-xl border-2 ${style.border} bg-gradient-to-r ${style.bg} overflow-hidden`}>
                <div className="flex items-center justify-between p-4 border-b border-slate-200/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center shadow-md`}>
                      {style.icon}
                    </div>
                    <div>
                      <h3 className={`font-bold text-sm ${style.text}`}>Inadimplência — {seg.center}</h3>
                      <p className={`text-xs ${style.accent}`}>{seg.items.length} títulos • {seg.uniqueClients.size} clientes • {formatCurrency(seg.totalValor)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExportSegmentPdf(seg.center); }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r ${style.gradient} text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all hover:scale-[1.02]`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Exportar PDF
                    </button>
                    <button
                      onClick={() => setSegmentDetailOpen(null)}
                      className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-slate-200/50 max-h-[400px] overflow-y-auto">
                  {segItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${style.gradient} bg-opacity-20 flex items-center justify-center flex-shrink-0`}>
                          <Building2 className={`w-4 h-4 ${style.accent}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.empresa}</p>
                          {(item as any).apelido && <p className="text-[10px] font-bold text-purple-600 truncate">({(item as any).apelido})</p>}
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            {item.cnpjCpf && <span>{item.cnpjCpf}</span>}
                            {item.vendedor && <span>• {item.vendedor}</span>}
                            <span>• {item.status}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className={`text-sm font-bold ${style.text}`}>{formatCurrency(parseFloat(String(item.valor || 0)))}</p>
                          <p className="text-[10px] text-slate-500">Venc: {item.vencimento ? formatDate(item.vencimento) : "-"}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            (item.diasVencidos || 0) > 30 ? "bg-red-100 text-red-700" :
                            (item.diasVencidos || 0) > 10 ? "bg-amber-100 text-amber-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {item.diasVencidos || 0}d
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Centro de Custos filter pills */}
      {summary && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCenterFilter("todos")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              centerFilter === "todos"
                ? "bg-slate-800 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todos
          </button>
          {Object.entries(summary.byCenter).map(([center, data]) => (
            <button
              key={center}
              onClick={() => setCenterFilter(centerFilter === center ? "todos" : center)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                centerFilter === center
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
              }`}
            >
              {center} ({data.count})
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar empresa, CNPJ, município, vendedor, forma de cobrança..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-200">
                <th className="text-left px-3 py-3 font-semibold text-slate-600 min-w-[180px]">
                  <button onClick={() => toggleSort("empresa")} className="flex items-center gap-1 hover:text-slate-800">
                    Empresa
                    {sortBy === "empresa" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </button>
                </th>
                <th className="text-right px-2 py-3 font-semibold text-slate-600 min-w-[80px]">
                  <button onClick={() => toggleSort("valor")} className="flex items-center gap-1 justify-end hover:text-slate-800 ml-auto">
                    Valor
                    {sortBy === "valor" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </button>
                </th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[65px]">
                  <button onClick={() => toggleSort("vencimento")} className="flex items-center gap-1 justify-center hover:text-slate-800 mx-auto">
                    Venc.
                    {sortBy === "vencimento" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </button>
                </th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[45px]">
                  <button onClick={() => toggleSort("diasVencidos")} className="flex items-center gap-1 justify-center hover:text-slate-800 mx-auto">
                    Dias
                    {sortBy === "diasVencidos" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </button>
                </th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[85px]">Tipo</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[50px]">Centro</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[80px]">Documento</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[70px]">Vendedor</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[55px]">Forma</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[110px]">Status</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[55px]">1ª Cob</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[55px]">2ª Cob</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[55px]">3ª Cob</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[55px]">Final</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[35px]">Obs</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum título encontrado</p>
                  </td>
                </tr>
              )}
              {filteredItems.map((item, idx) => {
                const cfg = getStatusConfig(item.status);
                const isExpanded = expandedRow === item.id;
                const valor = item.valor ? parseFloat(String(item.valor)) : 0;
                const isNewClient = clientBoundaries.has(idx);
                const fc = shortFormaCobranca(item.formaCobranca);
                return (
                  <React.Fragment key={item.id}>
                    {/* Linha divisória entre clientes diferentes */}
                    {isNewClient && (
                      <tr>
                        <td colSpan={14} className="p-0">
                          <div className="h-[3px] bg-gradient-to-r from-slate-300 via-slate-400 to-slate-300" />
                        </td>
                      </tr>
                    )}
                    <tr
                      className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-slate-25"}`}
                      onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                    >
                      {/* Empresa */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <div className="w-1 h-8 rounded-full shrink-0 mt-0.5" style={{
                            backgroundColor: getStatusBarColor(item.status)
                          }} />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 text-[11px] leading-tight truncate max-w-[220px]" title={item.empresa}>
                              {item.empresa}
                            </div>
                            {(item as any).apelido && (
                              <div className="text-[9px] font-bold text-purple-600 truncate max-w-[220px]">
                                ({(item as any).apelido})
                              </div>
                            )}
                            <div className="text-[9px] text-slate-400 truncate max-w-[220px]" title={item.descricao || ""}>
                              {item.descricao || "-"}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Valor */}
                      <td className="text-right px-2 py-2.5 font-bold text-slate-800 tabular-nums text-[11px]">
                        {formatCurrency(valor)}
                      </td>
                      {/* Vencimento */}
                      <td className="text-center px-2 py-2.5 text-slate-600 tabular-nums">
                        {formatDate(item.vencimento)}
                      </td>
                      {/* Dias */}
                      <td className="text-center px-2 py-2.5">
                        <span className={`inline-flex items-center justify-center min-w-[28px] px-1 py-0.5 rounded-full text-[10px] font-bold ${
                          (item.diasVencidos || 0) > 30 ? "bg-red-100 text-red-700" :
                          (item.diasVencidos || 0) > 10 ? "bg-amber-100 text-amber-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {item.diasVencidos || 0}
                        </span>
                      </td>
                      {/* Tipo (Protesto) */}
                      <td className="text-center px-2 py-2.5">
                        {renderTipoBadge(item.tipo)}
                      </td>
                      {/* Centro */}
                      <td className="text-center px-2 py-2.5">
                        <span className="text-[10px] font-medium text-slate-600">{item.centroCustos || "-"}</span>
                      </td>
                      {/* Documento (NF + parcela) */}
                      <td className="text-center px-2 py-2.5">
                        <span className="text-[10px] font-medium text-blue-700">{item.documento || "-"}</span>
                      </td>
                      {/* Vendedor */}
                      <td className="text-center px-2 py-2.5">
                        <span className="text-[9px] font-medium text-slate-600 truncate block max-w-[80px]" title={item.vendedor || ""}>
                          {item.vendedor || "-"}
                        </span>
                      </td>
                      {/* Forma Cobrança */}
                      <td className="text-center px-2 py-2.5">
                        {fc.label ? (
                          <span className={`text-[9px] font-semibold ${fc.color}`}>{fc.label}</span>
                        ) : (
                          <span className="text-[9px] text-slate-300">-</span>
                        )}
                      </td>
                      {/* Status */}
                      <td className="text-center px-2 py-2.5" onClick={e => e.stopPropagation()}>
                        {canEdit ? (
                          <select
                            value={item.status}
                            onChange={e => handleStatusChange(item.id, e.target.value)}
                            className={`text-[10px] font-semibold px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border} cursor-pointer focus:ring-2 focus:ring-blue-400`}
                          >
                            {ALL_STATUSES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                        )}
                      </td>
                      {/* 1ª Cobrança */}
                      <td className="text-center px-2 py-2.5">
                        {renderCobrancaStep("1ª", item.primeiraCobranca, "primeiraCobranca", item.etapasPausadas as Record<string, boolean> | null)}
                      </td>
                      {/* 2ª Cobrança */}
                      <td className="text-center px-2 py-2.5">
                        {renderCobrancaStep("2ª", item.segundaCobranca, "segundaCobranca", item.etapasPausadas as Record<string, boolean> | null)}
                      </td>
                      {/* 3ª Cobrança */}
                      <td className="text-center px-2 py-2.5">
                        {renderCobrancaStep("3ª", item.terceiraCobranca, "terceiraCobranca", item.etapasPausadas as Record<string, boolean> | null)}
                      </td>
                      {/* Ação Final */}
                      <td className="text-center px-2 py-2.5">
                        {renderCobrancaStep("Final", item.acaoFinal, "acaoFinal", item.etapasPausadas as Record<string, boolean> | null)}
                      </td>
                      {/* Ações */}
                      <td className="text-center px-2 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => setHistoryDialog(item.id)}
                            className="p-1 rounded-md hover:bg-amber-100 text-amber-600 transition-colors relative"
                            title="Ver histórico de observações"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            {Object.values((item.etapasPausadas as Record<string, boolean>) || {}).some(v => v) && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white" />
                            )}
                            {obsCountMap && obsCountMap[item.id] > 0 && !Object.values((item.etapasPausadas as Record<string, boolean>) || {}).some(v => v) && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                            )}
                          </button>
                          <button
                            onClick={() => setDecisionPdfItemId(item.id)}
                            className="p-1 rounded-md hover:bg-blue-100 text-blue-600 transition-colors"
                            title="Gerar PDF de Decisão"
                          >
                            <Stamp className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Row - Details */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={14} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                            {/* Info */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                                Dados da Empresa
                              </h4>
                              <div className="text-[11px] space-y-1.5 text-slate-600">
                                {[
                                  { label: "CNPJ/CPF", field: "cnpjCpf", value: item.cnpjCpf },
                                  { label: "Município", field: "municipio", value: item.municipio },
                                  { label: "UF", field: "uf", value: item.uf },
                                  { label: "Contato", field: "contato", value: (item as any).contato },
                                  { label: "Email", field: "email", value: (item as any).email },
                                  { label: "Centro", field: "centroCustos", value: item.centroCustos },
                                  { label: "Documento", field: "documento", value: item.documento },
                                ].map(f => (
                                  <div key={f.field} className="flex items-center gap-2">
                                    <span className="font-medium text-slate-500 w-[70px] shrink-0">{f.label}:</span>
                                    {canEdit ? (
                                      <input
                                        type="text"
                                        defaultValue={f.value || ""}
                                        placeholder="-"
                                        onBlur={e => {
                                          if (e.target.value !== (f.value || "")) {
                                            handleCobrancaFieldChange(item.id, f.field, e.target.value);
                                          }
                                        }}
                                        className="flex-1 px-2 py-0.5 rounded border border-slate-200 text-[11px] bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 max-w-[200px]"
                                      />
                                    ) : (
                                      <span>{f.value || "-"}</span>
                                    )}
                                  </div>
                                ))}
                                {/* Apelido (somente leitura - puxado do Maxiprod) */}
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-500 w-[70px] shrink-0">Apelido:</span>
                                  <span className="text-purple-700 font-bold">{(item as any).apelido || "-"}</span>
                                </div>
                                {/* Vendedor (somente leitura) */}
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-500 w-[70px] shrink-0">Vendedor:</span>
                                  <span className="text-slate-700 font-medium">{item.vendedor || "-"}</span>
                                </div>
                                {/* Forma de Cobrança (somente leitura) */}
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-500 w-[70px] shrink-0">Forma:</span>
                                  {item.formaCobranca ? (
                                    <span className={`font-semibold ${shortFormaCobranca(item.formaCobranca).color}`}>
                                      {item.formaCobranca}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </div>
                                {/* Tipo / Protesto (somente leitura) */}
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-500 w-[70px] shrink-0">Tipo:</span>
                                  {renderTipoBadge(item.tipo)}
                                </div>
                              </div>
                            </div>

                            {/* Contatos Extras */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-green-500" />
                                Contatos / Telefones
                              </h4>
                              <div className="text-[11px] space-y-1 text-slate-600">
                                {/* Contato principal */}
                                {(item as any).contato && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">PRINCIPAL</span>
                                    <a href={`tel:${(item as any).contato}`} className="text-blue-600 hover:underline font-medium">
                                      {(item as any).contato}
                                    </a>
                                  </div>
                                )}
                                {/* Contatos adicionais do Maxiprod */}
                                {(() => {
                                  const extras = (item.contatosAdicionais as string[] | null) || [];
                                  if (extras.length === 0) {
                                    return <p className="text-slate-400 italic text-[10px]">Nenhum contato adicional encontrado no Maxiprod.</p>;
                                  }
                                  return extras.map((tel, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      <a href={`tel:${tel}`} className="text-blue-600 hover:underline">
                                        {tel}
                                      </a>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </div>

                            {/* Cobrança Timeline */}
                            <div className="space-y-2 overflow-visible">
                              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                Etapas de Cobrança
                              </h4>
                              <div className="space-y-1.5">
                                {[
                                  { label: "1ª Cobrança", field: "primeiraCobranca", value: item.primeiraCobranca },
                                  { label: "Intervalo", field: "semAcao1", value: item.semAcao1 },
                                  { label: "2ª Cobrança", field: "segundaCobranca", value: item.segundaCobranca },
                                  { label: "Intervalo", field: "semAcao2", value: item.semAcao2 },
                                  { label: "3ª Cobrança", field: "terceiraCobranca", value: item.terceiraCobranca },
                                  { label: "Intervalo", field: "semAcao3", value: item.semAcao3 },
                                  { label: "Ação Final", field: "acaoFinal", value: item.acaoFinal },
                                ].map(step => {
                                  const isPaused = !!(item.etapasPausadas as Record<string, boolean> | null)?.[step.field];
                                  return (
                                  <div key={step.field} className="flex items-center gap-2 text-[11px]">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${isPaused ? "bg-amber-400" : step.value ? "bg-emerald-400" : "bg-slate-200"}`} />
                                    <span className="font-medium text-slate-500 w-[85px] shrink-0">{step.label}:</span>
                                    {canEdit ? (
                                      <input
                                        type="date"
                                        defaultValue={step.value && /^\d{4}-\d{2}-\d{2}$/.test(step.value) ? step.value : ""}
                                        onBlur={e => {
                                          if (e.target.value !== (step.value || "")) {
                                            handleCobrancaFieldChange(item.id, step.field, e.target.value);
                                          }
                                        }}
                                        onChange={e => {
                                          if (e.target.value && e.target.value !== (step.value || "")) {
                                            handleCobrancaFieldChange(item.id, step.field, e.target.value);
                                          }
                                        }}
                                        className="flex-1 px-2 py-0.5 rounded border border-slate-200 text-[11px] bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 max-w-[130px]"
                                      />
                                    ) : (
                                      <span className={step.value ? "text-slate-700" : "text-slate-300"}>
                                        {step.value ? (step.value.match(/^\d{4}-\d{2}-\d{2}$/) ? formatDate(step.value) : step.value) : "-"}
                                      </span>
                                    )}
                                    {/* Checkbox Cobrança Pausada */}
                                    <label
                                      className={`flex items-center gap-1 shrink-0 cursor-pointer select-none rounded px-1.5 py-0.5 border text-[9px] font-semibold transition-colors ${
                                        isPaused
                                          ? "bg-amber-50 border-amber-400 text-amber-700"
                                          : "bg-white border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-500"
                                      }`}
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <Checkbox
                                        checked={isPaused}
                                        onCheckedChange={(checked) => {
                                          if (!canEdit) { toast.error("Sem permissão"); return; }
                                          togglePausada.mutate({ id: item.id, etapa: step.field, pausada: !!checked, updatedBy: operator!.name });
                                        }}
                                        disabled={!canEdit}
                                        className="w-3 h-3 rounded-sm border-amber-400 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                                      />
                                      <span>Pausada</span>
                                    </label>
                                    {/* Botão de observação por etapa */}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setEtapaObsDialog({ planilhaId: item.id, etapa: step.field, label: step.label }); setNewEtapaObs(""); }}
                                      className="p-0.5 rounded hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-colors shrink-0"
                                      title={`Observações: ${step.label}`}
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                    </button>
                                  </div>
                                  );
                                })}
                              </div>
                            </div>
                            {/* Observações */}
                            <div className="space-y-2 relative z-10 ml-5">
                              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <History className="w-3.5 h-3.5 text-amber-500" />
                                Histórico de Observações
                              </h4>
                              <div className="text-[11px] text-slate-500 bg-white rounded-lg border border-slate-100 p-3 shadow-sm">
                                <p className="mb-2">Clique no ícone <MessageSquare className="w-3 h-3 inline text-amber-500" /> ao lado de cada etapa para adicionar ou ver observações individuais.</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); setHistoryDialog(item.id); }}
                                  className="text-[11px] gap-1"
                                >
                                  <History className="w-3 h-3" />
                                  Ver histórico completo
                                  {obsCountMap && obsCountMap[item.id] > 0 && (
                                    <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                                      {obsCountMap[item.id]}
                                    </span>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diálogo de Observação por Etapa */}
      {etapaObsDialog && (
        <EtapaObsDialog
          planilhaId={etapaObsDialog.planilhaId}
          etapa={etapaObsDialog.etapa}
          label={etapaObsDialog.label}
          canEdit={!!canEdit}
          operatorName={operator?.name || ""}
          onClose={() => { setEtapaObsDialog(null); refetchObsCounts(); }}
        />
      )}

      {/* Diálogo de Histórico Completo */}
      {historyDialog !== null && (
        <HistoryObsDialog
          planilhaId={historyDialog}
          empresa={items?.find(i => i.id === historyDialog)?.empresa || ""}
          onClose={() => setHistoryDialog(null)}
        />
      )}

      {/* Guia de Cobrança */}
      {showCobrancaGuide && (
        <CobrancaGuideSimulator
          valorTotal={totalValor}
          onClose={() => setShowCobrancaGuide(false)}
        />
      )}

      {/* Dialog de PDF de Decisão por item da planilha */}
      {decisionPdfItemId && (() => {
        const planilhaItem = items?.find(i => i.id === decisionPdfItemId);
        if (!planilhaItem) return null;
        return (
          <Dialog open onOpenChange={() => setDecisionPdfItemId(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <Stamp className="w-4 h-4 text-blue-600" />
                  Gerar PDF de Decisão
                </DialogTitle>
              </DialogHeader>
              <div className="py-3 space-y-3">
                <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-semibold text-slate-800">{planilhaItem.empresa}</p>
                  <p className="text-xs text-slate-500">Valor: {formatCurrency(parseFloat(String(planilhaItem.valor || 0)))}</p>
                  <p className="text-xs text-slate-500">Vencimento: {formatDate(planilhaItem.vencimento)}</p>
                  <p className="text-xs text-slate-500">Dias vencidos: {planilhaItem.diasVencidos || 0}</p>
                  <p className="text-xs text-slate-500">Tipo: {planilhaItem.tipo || '-'}</p>
                </div>
                <p className="text-xs text-slate-500">Será gerado um PDF formal de decisão de cobrança para este cliente com base nos dados da planilha.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDecisionPdfItemId(null)}>Cancelar</Button>
                <Button
                  size="sm"
                  disabled={isGeneratingPdf}
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={async () => {
                    setIsGeneratingPdf(true);
                    try {
                      const etapas = [
                        { etapa: "primeiraCobranca", data: planilhaItem.primeiraCobranca },
                        { etapa: "semAcao1", data: planilhaItem.semAcao1 },
                        { etapa: "segundaCobranca", data: planilhaItem.segundaCobranca },
                        { etapa: "semAcao2", data: planilhaItem.semAcao2 },
                        { etapa: "terceiraCobranca", data: planilhaItem.terceiraCobranca },
                        { etapa: "semAcao3", data: planilhaItem.semAcao3 },
                        { etapa: "acaoFinal", data: planilhaItem.acaoFinal },
                      ];
                      const STEP_LABELS: Record<string, string> = {
                        primeiraCobranca: "1ª Cobrança",
                        semAcao1: "Sem Ação 1",
                        segundaCobranca: "2ª Cobrança",
                        semAcao2: "Sem Ação 2",
                        terceiraCobranca: "3ª Cobrança",
                        semAcao3: "Sem Ação 3",
                        acaoFinal: "Ação Final",
                      };
                      const checklistSteps = etapas.map((e, idx) => ({
                        dia: idx + 1,
                        label: STEP_LABELS[e.etapa] || e.etapa,
                        descricao: STEP_LABELS[e.etapa] || e.etapa,
                        motivo: e.data ? "Realizada" : "Pendente",
                        data: e.data || "",
                        status: e.data ? "verde" : "pendente",
                      }));
                      const titleInput: DecisionPdfInput["title"] = {
                        id: planilhaItem.arId || planilhaItem.id,
                        cliente: planilhaItem.empresa,
                        vendedor: planilhaItem.vendedor || "",
                        valorAReceber: parseFloat(String(planilhaItem.valor || 0)),
                        vencimento: planilhaItem.vencimento || "",
                        diasAtraso: planilhaItem.diasVencidos || 0,
                        referenteA: planilhaItem.descricao || "",
                        documento: planilhaItem.documento || "",
                        parcela: "",
                        empresa: planilhaItem.centroCustos || "",
                        decisaoCobranca: planilhaItem.tipo || "",
                        formaCobranca: planilhaItem.formaCobranca || "",
                        observacoesMaxiprod: planilhaItem.observacoes || "",
                        cobranca: {
                          status: planilhaItem.status,
                          promessaData: planilhaItem.promessaPgto || null,
                          promessaValor: null,
                          observacoes: planilhaItem.observacoes || null,
                          contatoHistorico: [],
                          cobrancaStartedAt: null,
                        },
                      };
                      // Buscar observações de etapa do banco
                      let etapaObservacoes: Array<{ etapa: string; observacao: string; registradoPor: string; createdAt: string }> = [];
                      try {
                        const obsData = await utils.cobrancaPlanilha.getAllEtapaObs.fetch({ planilhaId: planilhaItem.id });
                        if (obsData) {
                          etapaObservacoes = obsData.map(o => ({
                            etapa: o.etapa,
                            observacao: o.observacao,
                            registradoPor: o.registradoPor || "",
                            createdAt: String(o.createdAt || ""),
                          }));
                        }
                      } catch (e) {
                        console.warn("Não foi possível buscar observações de etapa:", e);
                      }
                      const pdfResult = await generateDecisionPdf({
                        title: titleInput,
                        checklistSteps,
                        operatorName: operator?.name || "Operador",
                        planilhaCobranca: {
                          etapas: etapas.map(e => ({ etapa: e.etapa, data: e.data || null })),
                          observacoes: etapaObservacoes,
                          contato: planilhaItem.contato || null,
                          email: planilhaItem.email || null,
                        },
                      });
                      // Salvar no backend
                      await saveDecisionPdf.mutateAsync({
                        receivableId: planilhaItem.arId || planilhaItem.id,
                        cliente: planilhaItem.empresa,
                        vendedor: planilhaItem.vendedor || undefined,
                        valorAberto: formatCurrency(parseFloat(String(planilhaItem.valor || 0))),
                        diasAtraso: planilhaItem.diasVencidos || 0,
                        decisao: planilhaItem.tipo || undefined,
                        protocolo: pdfResult.protocolo,
                        fileBase64: pdfResult.base64,
                        generatedBy: operator?.name || "Operador",
                      });
                      // Download
                      const url = URL.createObjectURL(pdfResult.blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `decisao_${planilhaItem.empresa.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_${pdfResult.protocolo}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success(`PDF gerado! Protocolo: ${pdfResult.protocolo}`);
                      setDecisionPdfItemId(null);
                    } catch (err: any) {
                      toast.error(`Erro ao gerar PDF: ${err.message}`);
                    } finally {
                      setIsGeneratingPdf(false);
                    }
                  }}
                >
                  {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Stamp className="w-4 h-4 mr-1" />}
                  {isGeneratingPdf ? "Gerando..." : "Gerar PDF"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Histórico de PDFs de Decisão */}
      {showDecisionPdfHistory && (
        <Dialog open onOpenChange={() => setShowDecisionPdfHistory(false)}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Stamp className="w-4 h-4 text-blue-600" />
                Histórico de PDFs de Decisão
              </DialogTitle>
            </DialogHeader>
            <div className="py-2 space-y-3">
              {/* Filtro por mês */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Filtrar por mês:</span>
                <Input
                  type="month"
                  value={pdfHistoryFilterMonth}
                  onChange={e => setPdfHistoryFilterMonth(e.target.value)}
                  className="w-40 h-8 text-xs"
                />
                {pdfHistoryFilterMonth && (
                  <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setPdfHistoryFilterMonth("")}>Limpar</Button>
                )}
              </div>
              {/* Lista */}
              {(() => {
                const allPdfs = decisionPdfsData?.pdfs || [];
                const filtered = pdfHistoryFilterMonth
                  ? allPdfs.filter(p => {
                      const d = new Date(Number(p.generatedAt));
                      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      return ym === pdfHistoryFilterMonth;
                    })
                  : allPdfs;
                if (filtered.length === 0) {
                  return <p className="text-sm text-slate-400 italic text-center py-6">Nenhum PDF de decisão gerado ainda.</p>;
                }
                return (
                  <div className="space-y-2">
                    {pdfHistorySelectedIds.length > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                        <span className="text-xs text-blue-700 font-medium">{pdfHistorySelectedIds.length} selecionado(s)</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 text-green-600 border-green-200 hover:bg-green-50"
                          onClick={async () => {
                            await markPaid.mutateAsync({ ids: pdfHistorySelectedIds });
                            setPdfHistorySelectedIds([]);
                            utils.financial.listAllDecisionPdfs.invalidate();
                            toast.success("Marcado(s) como pago!");
                          }}
                        >
                          <Check className="w-3 h-3 mr-1" /> Marcar como Pago
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={async () => {
                            for (const pid of pdfHistorySelectedIds) {
                              await deletePdf.mutateAsync({ id: pid });
                            }
                            setPdfHistorySelectedIds([]);
                            utils.financial.listAllDecisionPdfs.invalidate();
                            toast.success("PDFs excluídos!");
                          }}
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Excluir
                        </Button>
                      </div>
                    )}
                    {filtered.map(pdf => {
                      const isPaid = pdf.paidAfterPdf;
                      return (
                        <div key={pdf.id} className={`border rounded-lg p-3 transition-colors ${
                          isPaid ? "bg-green-50 border-green-200" : "hover:bg-slate-50 border-slate-200"
                        }`}>
                          <div className="flex items-start gap-2">
                            {/* Checkbox / Paid icon */}
                            {!isPaid ? (
                              <button
                                onClick={() => {
                                  if (pdfHistorySelectedIds.includes(pdf.id)) {
                                    setPdfHistorySelectedIds(prev => prev.filter(x => x !== pdf.id));
                                  } else {
                                    setPdfHistorySelectedIds(prev => [...prev, pdf.id]);
                                  }
                                }}
                                className={`mt-1 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  pdfHistorySelectedIds.includes(pdf.id) ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 hover:border-blue-400"
                                }`}
                              >
                                {pdfHistorySelectedIds.includes(pdf.id) && <Check className="w-3 h-3" />}
                              </button>
                            ) : (
                              <div className="mt-1 shrink-0 w-5 h-5 rounded bg-green-600 flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-slate-800 truncate">{pdf.cliente}</p>
                                {pdf.decisao && pdf.decisao.toUpperCase().includes("COM PROTESTO") && (
                                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-300">COM PROTESTO</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                <span>Protocolo: <span className="font-mono">{pdf.protocolo}</span></span>
                                {pdf.valorAberto && <span>{pdf.valorAberto}</span>}
                                {pdf.vendedor && <span>Vendedor: {pdf.vendedor}</span>}
                              </div>
                              <p className="text-[10px] text-slate-400">Gerado em {new Date(Number(pdf.generatedAt)).toLocaleString('pt-BR')}    por {pdf.generatedBy}</p>
                              {/* Mensagem de pagamento */}
                              {isPaid && (
                                <div className="mt-1.5 px-2 py-1 bg-green-100 rounded text-xs font-semibold text-green-700">
                                  O PDF DE DECISÃO FOI GERADO, MAS O CLIENTE REALIZOU O PAGAMENTO E SAIU DA INADIMPLÊNCIA
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={pdf.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
                                title="Baixar PDF"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              <button
                                onClick={async () => {
                                  if (confirm("Excluir este PDF de decisão?")) {
                                    await deletePdf.mutateAsync({ id: pdf.id });
                                    utils.financial.listAllDecisionPdfs.invalidate();
                                    toast.success("PDF excluído!");
                                  }
                                }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                title="Excluir PDF"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** Sub-componente: Diálogo de observações por etapa */
function EtapaObsDialog({ planilhaId, etapa, label, canEdit, operatorName, onClose }: {
  planilhaId: number; etapa: string; label: string; canEdit: boolean; operatorName: string; onClose: () => void;
}) {
  const [newObs, setNewObs] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const { data: obsList, refetch } = trpc.cobrancaPlanilha.getEtapaObs.useQuery({ planilhaId, etapa });
  const addObs = trpc.cobrancaPlanilha.addEtapaObs.useMutation({
    onSuccess: () => { setNewObs(""); refetch(); toast.success("Observação adicionada!"); },
    onError: (err) => toast.error(err.message),
  });
  const updateObs = trpc.cobrancaPlanilha.updateEtapaObs.useMutation({
    onSuccess: () => { setEditingId(null); setEditText(""); refetch(); toast.success("Observação atualizada!"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteObs = trpc.cobrancaPlanilha.deleteEtapaObs.useMutation({
    onSuccess: () => { refetch(); toast.success("Observação excluída!"); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="w-4 h-4 text-amber-500" />
            Observações: {label}
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          {/* Lista de observações existentes */}
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {(!obsList || obsList.length === 0) && (
              <p className="text-sm text-slate-400 italic text-center py-4">Nenhuma observação registrada para esta etapa.</p>
            )}
            {obsList?.map((obs) => (
              <div key={obs.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100 group">
                {editingId === obs.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-blue-300 text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                      autoFocus
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => updateObs.mutate({ id: obs.id, observacao: editText })}
                        disabled={!editText.trim() || updateObs.isPending}
                        className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Salvar
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditText(""); }}
                        className="px-2 py-1 rounded bg-slate-200 text-slate-600 text-[11px] font-medium hover:bg-slate-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{obs.observacao}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="font-medium">{obs.registradoPor}</span>
                        <span>•</span>
                        <span>{new Date(obs.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingId(obs.id); setEditText(obs.observacao); }}
                            className="p-1 rounded hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => { if (confirm("Excluir esta observação?")) deleteObs.mutate({ id: obs.id }); }}
                            className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          {/* Adicionar nova */}
          {canEdit && (
            <div className="border-t border-slate-100 pt-3">
              <textarea
                value={newObs}
                onChange={e => setNewObs(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Adicionar observação..."
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {canEdit && (
            <Button
              onClick={() => addObs.mutate({ planilhaId, etapa, observacao: newObs, registradoPor: operatorName })}
              disabled={!newObs.trim() || addObs.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              Adicionar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Sub-componente: Diálogo de histórico completo de observações */
function HistoryObsDialog({ planilhaId, empresa, onClose }: {
  planilhaId: number; empresa: string; onClose: () => void;
}) {
  const { data: allObs, isLoading, refetch } = trpc.cobrancaPlanilha.getAllEtapaObs.useQuery({ planilhaId });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const updateObs = trpc.cobrancaPlanilha.updateEtapaObs.useMutation({
    onSuccess: () => { setEditingId(null); setEditText(""); refetch(); toast.success("Observação atualizada!"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteObs = trpc.cobrancaPlanilha.deleteEtapaObs.useMutation({
    onSuccess: () => { refetch(); toast.success("Observação excluída!"); },
    onError: (err) => toast.error(err.message),
  });

  const ETAPA_LABELS: Record<string, string> = {
    primeiraCobranca: "1ª Cobrança",
    semAcao1: "Intervalo 1",
    segundaCobranca: "2ª Cobrança",
    semAcao2: "Intervalo 2",
    terceiraCobranca: "3ª Cobrança",
    semAcao3: "Intervalo 3",
    acaoFinal: "Ação Final",
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <History className="w-4 h-4 text-amber-500" />
            Histórico de Observações
            <span className="text-slate-400 font-normal text-xs truncate max-w-[200px]">— {empresa}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            </div>
          )}
          {!isLoading && (!allObs || allObs.length === 0) && (
            <p className="text-sm text-slate-400 italic text-center py-8">Nenhuma observação registrada.</p>
          )}
          {!isLoading && allObs && allObs.length > 0 && (
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {allObs.map((obs) => (
                <div key={obs.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100 group">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {ETAPA_LABELS[obs.etapa] || obs.etapa}
                    </span>
                  </div>
                  {editingId === obs.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-blue-300 text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                        autoFocus
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => updateObs.mutate({ id: obs.id, observacao: editText })}
                          disabled={!editText.trim() || updateObs.isPending}
                          className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Salvar
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditText(""); }}
                          className="px-2 py-1 rounded bg-slate-200 text-slate-600 text-[11px] font-medium hover:bg-slate-300"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{obs.observacao}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="font-medium">{obs.registradoPor}</span>
                          <span>•</span>
                          <span>{new Date(obs.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingId(obs.id); setEditText(obs.observacao); }}
                            className="p-1 rounded hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => { if (confirm("Excluir esta observação?")) deleteObs.mutate({ id: obs.id }); }}
                            className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
