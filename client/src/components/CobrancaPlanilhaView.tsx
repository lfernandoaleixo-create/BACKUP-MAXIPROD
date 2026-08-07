import React, { useState, useMemo } from "react";
import { flexMatch } from "@shared/flexSearch";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import { ClientSearchCard } from "@/components/ClientSearchCard";
import { UnidentifiedPaymentsButton } from "@/components/UnidentifiedPayments";
import {
  X, Search, Filter, ChevronDown, ChevronUp, Edit3, Save, MessageSquare, BellOff,
  ArrowLeft, DollarSign, Calendar, Building2, FileText, AlertTriangle,
  CheckCircle2, Clock, Phone, Shield, Loader2, Eye, Database, Download, RefreshCw,
  History, Plus, Paperclip, Pencil, Trash2, Check, FileDown, User, CreditCard,
  ShieldCheck, Stamp, ArrowUpDown, ArrowDown, ArrowUp, Users, TreePine, Leaf, Flame, Layers, BookOpen, UserCheck, Bell
} from "lucide-react";
import CobrancaGuideSimulator from "@/components/CobrancaGuideSimulator";
import { generateDecisionPdf, type DecisionPdfInput } from "@/lib/decisionPdfExport";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  "Fundo Perdido": {
    label: "Fundo Perdido",
    bg: "bg-stone-50",
    text: "text-stone-700",
    border: "border-stone-400",
    icon: <Flame className="w-3 h-3" />,
  },
  "Rafael - Especial s/ cobrança": {
    label: "Rafael - Especial s/ cobrança",
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-400",
    icon: <UserCheck className="w-3 h-3" />,
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
    case "Fundo Perdido": return "#78716c";
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

function CobrancaPlanilhaViewInner({ onClose }: CobrancaPlanilhaViewProps) {
  const { operator } = useOperator();
  const { data: items, isLoading, refetch } = trpc.cobrancaPlanilha.getAll.useQuery();
  const { data: summary } = trpc.cobrancaPlanilha.getSummary.useQuery();
  const { data: liveStats } = trpc.cobrancaPlanilha.getLiveInadimplenciaStats.useQuery();
  const { data: clientPhonesMap } = trpc.financial.getClientPhones.useQuery();
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
  const [showDiary, setShowDiary] = useState(false);
  const [showCobrancaGuide, setShowCobrancaGuide] = useState(false);
  const [showDecisionPdfHistory, setShowDecisionPdfHistory] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [resolvedSortBy, setResolvedSortBy] = useState<'resolvedAt' | 'diasAtraso' | 'valor'>('resolvedAt');
  const [resolvedSortDir, setResolvedSortDir] = useState<'asc' | 'desc'>('desc');
  const [resolvedSearch, setResolvedSearch] = useState('');
  const [resolvedChecked, setResolvedChecked] = useState<Set<number>>(new Set());
  const [decisionPdfItemId, setDecisionPdfItemId] = useState<number | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfHistoryFilterMonth, setPdfHistoryFilterMonth] = useState("");
  const [pdfHistorySelectedIds, setPdfHistorySelectedIds] = useState<number[]>([]);
  const [segmentDetailOpen, setSegmentDetailOpen] = useState<string | null>(null);
  const [showFundoPerdido, setShowFundoPerdido] = useState(false);
  const [showEspecialSemCobranca, setShowEspecialSemCobranca] = useState(false);
  const [showProtestados, setShowProtestados] = useState(false);
  const [showRafael, setShowRafael] = useState(false);
  const [editingVendedorId, setEditingVendedorId] = useState<number | null>(null);
  const [editingVendedorValue, setEditingVendedorValue] = useState("");
  // Acionar Vendedor
  const [acionarVendedorDialog, setAcionarVendedorDialog] = useState<{ item: NonNullable<typeof items>[0]; vendedorName: string; etapa: string; mensagem: string } | null>(null);
  const [acionarMensagem, setAcionarMensagem] = useState("");
  const [acionarVendedorName, setAcionarVendedorName] = useState("");
  const [acionarEtapa, setAcionarEtapa] = useState("1");
  const createSellerAlert = trpc.cobrancaPlanilha.createSellerAlert.useMutation({
    onSuccess: () => {
      toast.success("Vendedor acionado com sucesso! Ele receberá o alerta na tela.");
      setAcionarVendedorDialog(null);
      setAcionarMensagem("");
      setAcionarVendedorName("");
    },
    onError: () => toast.error("Erro ao acionar vendedor. Tente novamente."),
  });

  const [acionadosFilter, setAcionadosFilter] = useState(false);
  // Cancel alert state
  const [cancelAlertDialog, setCancelAlertDialog] = useState<{ id: number; empresa: string; vendedor: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showAlertsHistory, setShowAlertsHistory] = useState(false);
  const [historyFilterVendedor, setHistoryFilterVendedor] = useState("");
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>("todos");
  const [historyFilterDateFrom, setHistoryFilterDateFrom] = useState("");
  const [historyFilterDateTo, setHistoryFilterDateTo] = useState("");
  const cancelAlert = trpc.cobrancaPlanilha.cancelAlertByFinanceiro.useMutation({
    onSuccess: () => {
      toast.success("Alerta cancelado com sucesso.");
      setCancelAlertDialog(null);
      setCancelReason("");
      utils.cobrancaPlanilha.getAllSellerAlerts.invalidate();
      utils.cobrancaPlanilha.getAlertsHistory.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao cancelar alerta."),
  });
  const deleteAlertMutation = trpc.cobrancaPlanilha.deleteAlert.useMutation({
    onSuccess: () => {
      toast.success("Alerta excluído do histórico.");
      utils.cobrancaPlanilha.getAlertsHistory.invalidate();
      utils.cobrancaPlanilha.getAllSellerAlerts.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao excluir alerta."),
  });
  const isGuilherme = operator?.name?.toLowerCase().includes('guilherme');
  const utils = trpc.useUtils();
  // Queries que dependem dos estados acima
  const { data: allSellerAlerts } = trpc.cobrancaPlanilha.getAllSellerAlerts.useQuery({ includeResolved: true });
  const { data: alertsHistoryData } = trpc.cobrancaPlanilha.getAlertsHistory.useQuery(undefined, { enabled: showAlertsHistory });
  const { data: acionarDialogObs } = trpc.cobrancaPlanilha.getAllEtapaObs.useQuery(
    { planilhaId: acionarVendedorDialog?.item?.id ?? 0 },
    { enabled: !!acionarVendedorDialog }
  );
  const { data: resolvedData } = trpc.financial.getResolvedTitles.useQuery({ sortOrder: 'newest', sortBy: resolvedSortBy, sortDir: resolvedSortDir });
  const { data: decisionPdfsData } = trpc.financial.listAllDecisionPdfs.useQuery();
  const deletePdf = trpc.financial.deleteDecisionPdf.useMutation();
  const markPaid = trpc.financial.markDecisionPdfsPaid.useMutation();
  const saveDecisionPdf = trpc.financial.saveDecisionPdf.useMutation();
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

  // Permission: Guilherme, Flavio, Thalita can edit
  const canEdit = operator && ["Guilherme", "Flavio", "Thalita"].includes(operator.name);
  const COBRANCA_GUIDE_OPERATORS = ["Flavio", "Guilherme", "Fernando", "Bruno", "Gilson", "Thalita"];
  const canSeeCobrancaGuide = operator && COBRANCA_GUIDE_OPERATORS.includes(operator.name);

  // Helper: filtrar alertas do histórico
  const getFilteredAlerts = () => {
    if (!alertsHistoryData?.alerts) return [];
    return alertsHistoryData.alerts.filter(alert => {
      // Filtro por vendedor/empresa
      if (historyFilterVendedor) {
        const q = historyFilterVendedor.toLowerCase();
        if (!alert.vendedor.toLowerCase().includes(q) && !alert.empresa.toLowerCase().includes(q)) return false;
      }
      // Filtro por status
      if (historyFilterStatus !== "todos" && alert.status !== historyFilterStatus) return false;
      // Filtro por data
      if (historyFilterDateFrom) {
        const alertDate = new Date(alert.createdAt).toISOString().slice(0, 10);
        if (alertDate < historyFilterDateFrom) return false;
      }
      if (historyFilterDateTo) {
        const alertDate = new Date(alert.createdAt).toISOString().slice(0, 10);
        if (alertDate > historyFilterDateTo) return false;
      }
      return true;
    });
  };

  const filteredItems = useMemo(() => {
    if (!items) return [];
    // Exclude Fundo Perdido, Especial s/ cobrança, Protestado, and Rafael from main list (unless specifically filtered)
    let result = statusFilter === "Fundo Perdido" || statusFilter === "Especial s/ cobrança" || statusFilter === "Protestado" || statusFilter === "Rafael - Especial s/ cobrança"
      ? [...items]
      : items.filter(item => item.status !== "Fundo Perdido" && item.status !== "Especial s/ cobrança" && item.status !== "Protestado" && item.status !== "Rafael - Especial s/ cobrança" && !(item.vendedor || "").toUpperCase().includes("RAFAEL LEONEL"));

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
        ((item as any).apelido || "").toLowerCase().includes(s) ||
        (item.documento || "").toLowerCase().includes(s) ||
        (item.centroCustos || "").toLowerCase().includes(s)
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
    // Acionados filter: show only clients that have seller alerts
    if (acionadosFilter && allSellerAlerts && allSellerAlerts.length > 0) {
      const acionadosEmpresas = new Set(allSellerAlerts.map(a => a.empresa.toUpperCase().trim()));
      result = result.filter(item => acionadosEmpresas.has((item.empresa || "").toUpperCase().trim()));
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
  }, [items, search, statusFilter, centerFilter, sortBy, sortDir, acionadosFilter, allSellerAlerts]);

  const totalValor = filteredItems.reduce((sum, item) => sum + parseFloat(String(item.valor || 0)), 0);
  const uniqueClients = useMemo(() => new Set(filteredItems.map(i => getClientKey(i.empresa))), [filteredItems]);

  // Dados agrupados por segmento (centro de custos) - REMOVED segment cards per user request

  // Items de Protestado
  const protestadoItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => item.status === "Protestado");
  }, [items]);
  const protestadoTotal = protestadoItems.reduce((sum, item) => sum + parseFloat(String(item.valor || 0)), 0);
  const protestadoClients = useMemo(() => new Set(protestadoItems.map(i => getClientKey(i.empresa))), [protestadoItems]);

  // Items de Fundo Perdido
  const fundoPerdidoItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => item.status === "Fundo Perdido");
  }, [items]);

  // Items de Especial s/ Cobrança
  const especialItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => item.status === "Especial s/ cobrança");
  }, [items]);

  // Items do Rafael (vendedor = RAFAEL LEONEL)
  const rafaelItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => (item.vendedor || "").toUpperCase().includes("RAFAEL LEONEL") || item.status === "Rafael - Especial s/ cobrança");
  }, [items]);
  const rafaelTotal = rafaelItems.reduce((sum, item) => sum + parseFloat(String(item.valor || 0)), 0);
  const rafaelClients = useMemo(() => new Set(rafaelItems.map(i => getClientKey(i.empresa))), [rafaelItems]);

  const fundoPerdidoTotal = fundoPerdidoItems.reduce((sum, item) => sum + parseFloat(String(item.valor || 0)), 0);
  const fundoPerdidoClients = useMemo(() => new Set(fundoPerdidoItems.map(i => getClientKey(i.empresa))), [fundoPerdidoItems]);
  const especialTotal = especialItems.reduce((sum, item) => sum + parseFloat(String(item.valor || 0)), 0);
  const especialClients = useMemo(() => new Set(especialItems.map(i => getClientKey(i.empresa))), [especialItems]);

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
    // Build segment data on-the-fly from items
    const segItems = (items || []).filter(item => (item.centroCustos || "SEM CLASSIFICAÇÃO") === center);
    const segTotalValor = segItems.reduce((sum, item) => sum + parseFloat(String(item.valor || 0)), 0);
    const segUniqueClients = new Set(segItems.map(i => getClientKey(i.empresa)));
    const seg = segItems.length > 0 ? { center, items: segItems, totalValor: segTotalValor, uniqueClients: segUniqueClients } : null;
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

  async function handleExportPdf() {
    if (filteredItems.length === 0) {
      toast.error("Nenhum título para exportar");
      return;
    }
    setIsGeneratingPdf(true);
    try {
      // Fetch all etapa observations for all filtered items
      const allPlanilhaIds = filteredItems.map(i => i.id);
      let obsMap: Record<number, Array<{ etapa: string; observacao: string; registradoPor: string; createdAt: string }>> = {};
      try {
        const rawMap = await utils.cobrancaPlanilha.getBulkEtapaObs.fetch({ planilhaIds: allPlanilhaIds });
        if (rawMap) {
          // Normalize createdAt to string
          for (const [key, arr] of Object.entries(rawMap)) {
            obsMap[Number(key)] = (arr as any[]).map((o: any) => ({
              etapa: o.etapa,
              observacao: o.observacao,
              registradoPor: o.registradoPor,
              createdAt: String(o.createdAt || ""),
            }));
          }
        }
      } catch (e) {
        console.warn("Não foi possível buscar observações de etapa para PDF:", e);
      }

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
      doc.text("Planilha de Cobrança — Inadimplência", 14, 20);
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
        doc.text(activeFilters.join("  •  "), 18, y + 10);
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
      doc.text("TÍTULOS", 18 + boxW + gap, y + 5);
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
        primeiraCobranca: "1ª Cob",
        segundaCobranca: "2ª Cob",
        terceiraCobranca: "3ª Cob",
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
            } else if (val === "Em negociação") {
              data.cell.styles.textColor = [180, 120, 20];
              data.cell.styles.fontStyle = "bold";
            } else if (val === "Promessa de Pgto") {
              data.cell.styles.textColor = [21, 128, 61];
              data.cell.styles.fontStyle = "bold";
            } else if (val === "Protestado" || val === "Jurídico") {
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

      // ============ HISTÓRICO DE ETAPAS DE COBRANÇA ============
      const ETAPA_LABELS_PDF: Record<string, string> = {
        promessaPgto: "Promessa de Pgto",
        primeiraCobranca: "1ª Cobrança",
        semAcao1: "Intervalo 1",
        segundaCobranca: "2ª Cobrança",
        semAcao2: "Intervalo 2",
        terceiraCobranca: "3ª Cobrança",
        semAcao3: "Intervalo 3",
        acaoFinal: "Ação Final",
        intervencaoVendedor: "Intervenção Vendedor",
      };

      // New page for history section
      doc.addPage();
      const pageW2 = doc.internal.pageSize.getWidth();
      const pageH2 = doc.internal.pageSize.getHeight();

      // Header for history section
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW2, 28, "F");
      doc.setFillColor(16, 185, 129);
      doc.rect(0, 28, pageW2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("HISTÓRICO COMPLETO DE ETAPAS DE COBRANÇA", 14, 12);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(180, 180, 180);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")} — ${filteredItems.length} títulos`, 14, 22);

      let histY = 36;

      for (const item of filteredItems) {
        const itemObs = obsMap[item.id] || [];
        // Etapas fields from the item itself
        const etapasFields = [
          { key: "promessaPgto", value: (item as any).promessaPgto },
          { key: "primeiraCobranca", value: item.primeiraCobranca },
          { key: "semAcao1", value: (item as any).semAcao1 },
          { key: "segundaCobranca", value: item.segundaCobranca },
          { key: "semAcao2", value: (item as any).semAcao2 },
          { key: "terceiraCobranca", value: item.terceiraCobranca },
          { key: "semAcao3", value: (item as any).semAcao3 },
          { key: "acaoFinal", value: item.acaoFinal },
        ];
        const hasEtapas = etapasFields.some(e => e.value);
        const hasObs = itemObs.length > 0;

        // Skip items with no history at all
        if (!hasEtapas && !hasObs) continue;

        // Check if we need a new page (estimate: header ~20mm + at least 30mm content)
        if (histY > pageH2 - 40) {
          doc.addPage();
          histY = 14;
        }

        // Client header
        doc.setFillColor(241, 245, 249); // slate-100
        doc.roundedRect(14, histY, pageW2 - 28, 10, 1.5, 1.5, "F");
        doc.setDrawColor(148, 163, 184);
        doc.roundedRect(14, histY, pageW2 - 28, 10, 1.5, 1.5, "S");
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        const clientLabel = `${item.empresa || "-"} — ${item.documento || "-"} — ${formatCurrency(parseFloat(String(item.valor || 0)))} — Venc: ${item.vencimento ? formatDate(item.vencimento) : "-"} — ${item.diasVencidos ?? 0} dias — Status: ${item.status || "-"}`;
        doc.text(clientLabel, 18, histY + 6.5);
        histY += 13;

        // Etapas summary row
        if (hasEtapas) {
          const etapaSummaryData: string[][] = [];
          for (const ef of etapasFields) {
            if (ef.value) {
              etapaSummaryData.push([ETAPA_LABELS_PDF[ef.key] || ef.key, ef.value]);
            }
          }
          if (etapaSummaryData.length > 0) {
            autoTable(doc, {
              startY: histY,
              head: [["Etapa", "Data/Valor"]],
              body: etapaSummaryData,
              theme: "grid",
              headStyles: {
                fillColor: [59, 130, 246],
                textColor: [255, 255, 255],
                fontSize: 5.5,
                fontStyle: "bold",
                cellPadding: 1.2,
              },
              bodyStyles: { fontSize: 5.5, cellPadding: 1.2 },
              columnStyles: {
                0: { cellWidth: 30, fontStyle: "bold" },
                1: { cellWidth: "auto" },
              },
              margin: { left: 16, right: 16 },
              tableWidth: pageW2 - 32,
            });
            histY = (doc as any).lastAutoTable.finalY + 3;
          }
        }

        // Observations detail
        if (hasObs) {
          const obsTableData: string[][] = itemObs.map(o => {
            const etapaLabel = ETAPA_LABELS_PDF[o.etapa] || o.etapa;
            const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
            return [etapaLabel, o.observacao || "-", o.registradoPor || "-", dateStr];
          });

          // Check if we need a new page
          if (histY > pageH2 - 30) {
            doc.addPage();
            histY = 14;
          }

          autoTable(doc, {
            startY: histY,
            head: [["Etapa", "Observação", "Registrado por", "Data/Hora"]],
            body: obsTableData,
            theme: "grid",
            headStyles: {
              fillColor: [180, 120, 20],
              textColor: [255, 255, 255],
              fontSize: 5.5,
              fontStyle: "bold",
              cellPadding: 1.2,
            },
            bodyStyles: { fontSize: 5.5, cellPadding: 1.2 },
            columnStyles: {
              0: { cellWidth: 25, fontStyle: "bold" },
              1: { cellWidth: "auto" },
              2: { cellWidth: 25 },
              3: { cellWidth: 28, halign: "center" },
            },
            margin: { left: 16, right: 16 },
            tableWidth: pageW2 - 32,
          });
          histY = (doc as any).lastAutoTable.finalY + 6;
        } else {
          histY += 3;
        }
      }

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, pageH - 12, pageW - 14, pageH - 12);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(6.5);
        doc.text("Grupo Fox — Planilha de Cobrança", 14, pageH - 7);
        doc.text(`Página ${p} de ${totalPages}`, pageW - 14 - doc.getTextWidth(`Página ${p} de ${totalPages}`), pageH - 7);
      }

      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      doc.save(`Planilha_Cobranca_${datePart}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setIsGeneratingPdf(false);
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
          <UnidentifiedPaymentsButton />
          <button
            onClick={handleExportPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
            title="Exportar planilha de cobrança como PDF com histórico completo"
          >
            {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            {isGeneratingPdf ? "Gerando..." : "Exportar PDF"}
          </button>
          {operator?.name === "Guilherme" && (
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
          )}
          <button
            onClick={() => setShowBackupInfo(!showBackupInfo)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-medium transition-colors"
            title="Ver backups"
          >
            <Database className="w-3.5 h-3.5" />
            {backups && backups.length > 0 ? `${backups.length} backup${backups.length !== 1 ? "s" : ""}` : "Backups"}
          </button>
          <button
            onClick={() => setShowDiary(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors shadow-sm"
            title="Abrir Diário de Cobrança - histórico de negociações e etapas"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Diário de Cobrança
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

      {/* Consulta ao Cliente */}
      <ClientSearchCard />

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
              {/* Search bar + Calculator */}
              <div className="px-4 py-3 bg-emerald-50/50 border-b border-emerald-200 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
                    <input
                      type="text"
                      placeholder="Pesquisar por nome do cliente..."
                      value={resolvedSearch}
                      onChange={(e) => setResolvedSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-sm text-slate-800 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    {resolvedSearch && (
                      <button onClick={() => setResolvedSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                        <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                      </button>
                    )}
                  </div>
                  {resolvedChecked.size > 0 && (
                    <button onClick={() => setResolvedChecked(new Set())} className="text-[10px] text-emerald-600 hover:text-emerald-800 whitespace-nowrap underline">
                      Limpar seleção
                    </button>
                  )}
                </div>
                {/* Sort buttons */}
                <div className="flex flex-wrap items-center gap-2">
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
                {/* Calculator bar - shows when items are checked */}
                {resolvedChecked.size > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-200/60 rounded-lg border border-emerald-300">
                    <DollarSign className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-medium text-emerald-800">
                      {resolvedChecked.size} selecionado{resolvedChecked.size !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-emerald-600">•</span>
                    <span className="text-sm font-bold text-emerald-900">
                      Total: {formatCurrency(
                        resolvedData!.titles
                          .filter(t => resolvedChecked.has(t.id))
                          .reduce((sum, t) => sum + (t.valorAReceber || 0), 0)
                      )}
                    </span>
                  </div>
                )}
              </div>
              <div className="divide-y divide-emerald-100 max-h-[400px] overflow-y-auto">
                {resolvedData!.titles
                  .filter(t => !resolvedSearch || flexMatch(t.cliente, resolvedSearch))
                  .map((t) => (
                  <div key={t.id} className={`flex items-center justify-between px-4 py-3 hover:bg-emerald-50/80 transition-colors ${resolvedChecked.has(t.id) ? 'bg-emerald-100/60' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => {
                          setResolvedChecked(prev => {
                            const next = new Set(prev);
                            if (next.has(t.id)) next.delete(t.id);
                            else next.add(t.id);
                            return next;
                          });
                        }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          resolvedChecked.has(t.id)
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-emerald-300 hover:border-emerald-500'
                        }`}
                      >
                        {resolvedChecked.has(t.id) && <Check className="w-3 h-3 text-white" />}
                      </button>
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
            const isAlertStatus = (status === "Protestado" || status === "Fundo Perdido") && data.count > 0;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(isActive ? "todos" : status)}
                className={`rounded-xl border p-3 text-left transition-all hover:shadow-md ${
                  isAlertStatus
                    ? status === "Protestado"
                      ? "bg-red-100 border-2 border-red-500 shadow-lg ring-2 ring-red-300 animate-pulse"
                      : "bg-stone-200 border-2 border-stone-600 shadow-lg ring-2 ring-stone-400 animate-pulse"
                    : `${cfg.bg} ${cfg.border}`
                } ${isActive ? "ring-2 ring-blue-500 shadow-md" : ""}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={isAlertStatus ? (status === "Protestado" ? "text-red-700" : "text-stone-800") : cfg.text}>{cfg.icon}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${isAlertStatus ? (status === "Protestado" ? "text-red-700" : "text-stone-800") : cfg.text}`}>{cfg.label}</span>
                </div>
                <div className={`text-xl font-bold ${isAlertStatus ? (status === "Protestado" ? "text-red-800" : "text-stone-900") : cfg.text}`}>{data.count}</div>
                <div className={`text-[10px] ${isAlertStatus ? (status === "Protestado" ? "text-red-600" : "text-stone-700") : cfg.text} opacity-70`}>{formatCurrency(data.valor)}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Cards Protestados, Fundo Perdido, Especial s/ Cobrança e Rafael */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        {/* Card Protestados */}
        <div className="rounded-xl border-2 border-red-400 bg-gradient-to-br from-red-50 via-rose-50 to-red-50 overflow-hidden transition-all hover:shadow-lg">
          <button
            onClick={(e) => { e.stopPropagation(); setShowProtestados(prev => !prev); }}
            className="w-full p-4 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center shadow-md">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-red-900">Protestados</h3>
                  <p className="text-xs text-red-600">{protestadoClients.size} cliente{protestadoClients.size !== 1 ? "s" : ""} • {protestadoItems.length} título{protestadoItems.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-red-800">{formatCurrency(protestadoTotal)}</span>
                {showProtestados ? <ChevronUp className="w-5 h-5 text-red-500" /> : <ChevronDown className="w-5 h-5 text-red-500" />}
              </div>
            </div>
          </button>
          {showProtestados && protestadoItems.length > 0 && (
            <div className="border-t border-red-300 divide-y divide-red-200 max-h-[400px] overflow-y-auto">
              {protestadoItems.map((item) => {
                return (
                  <div key={item.id} className="px-4 py-3 hover:bg-white/60 transition-colors space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-full min-h-[40px] rounded-full bg-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 truncate flex-1">{item.empresa}</p>
                          <span className={`inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                            (item.diasVencidos || 0) > 30 ? "bg-red-100 text-red-700" :
                            (item.diasVencidos || 0) > 10 ? "bg-amber-100 text-amber-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {item.diasVencidos || 0}d
                          </span>
                        </div>
                        {(item as any).apelido && <p className="text-[10px] font-bold text-purple-600">({(item as any).apelido})</p>}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-bold text-red-800 text-xs">{formatCurrency(parseFloat(String(item.valor || 0)))}</span>
                          <span>Venc: {item.vencimento ? formatDate(item.vencimento) : "-"}</span>
                          {item.vendedor && <span className="text-slate-600">{item.vendedor}</span>}
                        </div>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="pl-4">
                        <select
                          value={item.status}
                          onChange={e => handleStatusChange(item.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="text-[10px] font-semibold px-2 py-1 rounded-lg border bg-red-50 text-red-700 border-red-400 cursor-pointer focus:ring-2 focus:ring-blue-400 w-full max-w-[180px]"
                        >
                          {ALL_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card Fundo Perdido */}
        <div className="rounded-xl border-2 border-stone-400 bg-gradient-to-br from-stone-50 via-stone-100 to-stone-50 overflow-hidden transition-all hover:shadow-lg">
          <button
            onClick={(e) => { e.stopPropagation(); setShowFundoPerdido(prev => !prev); }}
            className="w-full p-4 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center shadow-md">
                  <Flame className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-stone-900">Fundo Perdido</h3>
                  <p className="text-xs text-stone-600">{fundoPerdidoClients.size} cliente{fundoPerdidoClients.size !== 1 ? "s" : ""} • {fundoPerdidoItems.length} título{fundoPerdidoItems.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-stone-800">{formatCurrency(fundoPerdidoTotal)}</span>
                {showFundoPerdido ? <ChevronUp className="w-5 h-5 text-stone-500" /> : <ChevronDown className="w-5 h-5 text-stone-500" />}
              </div>
            </div>
          </button>
          {showFundoPerdido && fundoPerdidoItems.length > 0 && (
            <div className="border-t border-stone-300 divide-y divide-stone-200 max-h-[400px] overflow-y-auto">
              {fundoPerdidoItems.map((item) => {
                return (
                  <div key={item.id} className="px-4 py-3 hover:bg-white/60 transition-colors space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-full min-h-[40px] rounded-full bg-stone-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 truncate flex-1">{item.empresa}</p>
                          <span className={`inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                            (item.diasVencidos || 0) > 30 ? "bg-red-100 text-red-700" :
                            (item.diasVencidos || 0) > 10 ? "bg-amber-100 text-amber-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {item.diasVencidos || 0}d
                          </span>
                        </div>
                        {(item as any).apelido && <p className="text-[10px] font-bold text-purple-600">({(item as any).apelido})</p>}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-bold text-stone-800 text-xs">{formatCurrency(parseFloat(String(item.valor || 0)))}</span>
                          <span>Venc: {item.vencimento ? formatDate(item.vencimento) : "-"}</span>
                          {item.vendedor && <span className="text-slate-600">{item.vendedor}</span>}
                        </div>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="pl-4">
                        <select
                          value={item.status}
                          onChange={e => handleStatusChange(item.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="text-[10px] font-semibold px-2 py-1 rounded-lg border bg-stone-50 text-stone-700 border-stone-400 cursor-pointer focus:ring-2 focus:ring-blue-400 w-full max-w-[180px]"
                        >
                          {ALL_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card Especial s/ Cobrança */}
        <div className="rounded-xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 via-sky-50 to-cyan-50 overflow-hidden transition-all hover:shadow-lg">
          <button
            onClick={(e) => { e.stopPropagation(); setShowEspecialSemCobranca(prev => !prev); }}
            className="w-full p-4 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-sky-700 flex items-center justify-center shadow-md">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-cyan-900">Especial s/ Cobrança</h3>
                  <p className="text-xs text-cyan-600">{especialClients.size} cliente{especialClients.size !== 1 ? "s" : ""} • {especialItems.length} título{especialItems.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-cyan-800">{formatCurrency(especialTotal)}</span>
                {showEspecialSemCobranca ? <ChevronUp className="w-5 h-5 text-cyan-500" /> : <ChevronDown className="w-5 h-5 text-cyan-500" />}
              </div>
            </div>
          </button>
          {showEspecialSemCobranca && especialItems.length > 0 && (
            <div className="border-t border-cyan-200 divide-y divide-cyan-100 max-h-[400px] overflow-y-auto">
              {especialItems.map((item) => {
                return (
                  <div key={item.id} className="px-4 py-3 hover:bg-white/60 transition-colors space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-full min-h-[40px] rounded-full bg-cyan-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 truncate flex-1">{item.empresa}</p>
                          <span className={`inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                            (item.diasVencidos || 0) > 30 ? "bg-red-100 text-red-700" :
                            (item.diasVencidos || 0) > 10 ? "bg-amber-100 text-amber-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {item.diasVencidos || 0}d
                          </span>
                        </div>
                        {(item as any).apelido && <p className="text-[10px] font-bold text-purple-600">({(item as any).apelido})</p>}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-bold text-cyan-800 text-xs">{formatCurrency(parseFloat(String(item.valor || 0)))}</span>
                          <span>Venc: {item.vencimento ? formatDate(item.vencimento) : "-"}</span>
                          {item.vendedor && <span className="text-slate-600">{item.vendedor}</span>}
                        </div>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="pl-4">
                        <select
                          value={item.status}
                          onChange={e => handleStatusChange(item.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="text-[10px] font-semibold px-2 py-1 rounded-lg border bg-cyan-50 text-cyan-700 border-cyan-300 cursor-pointer focus:ring-2 focus:ring-blue-400 w-full max-w-[180px]"
                        >
                          {ALL_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card Rafael - Especial sem cobrança */}
        {rafaelItems.length > 0 && (
          <div className="rounded-xl border-2 border-purple-400 bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 overflow-hidden transition-all hover:shadow-lg">
            <button
              onClick={(e) => { e.stopPropagation(); setShowRafael(prev => !prev); }}
              className="w-full p-4 text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-violet-700 flex items-center justify-center shadow-md">
                    <UserCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-purple-900">Rafael - Especial s/ Cobrança</h3>
                    <p className="text-xs text-purple-600">{rafaelClients.size} cliente{rafaelClients.size !== 1 ? "s" : ""} • {rafaelItems.length} título{rafaelItems.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-purple-800">{formatCurrency(rafaelTotal)}</span>
                  {showRafael ? <ChevronUp className="w-5 h-5 text-purple-500" /> : <ChevronDown className="w-5 h-5 text-purple-500" />}
                </div>
              </div>
            </button>
            {showRafael && rafaelItems.length > 0 && (
              <div className="border-t border-purple-300 divide-y divide-purple-200 max-h-[400px] overflow-y-auto">
                {rafaelItems.map((item) => {
                  return (
                    <div key={item.id} className="px-4 py-3 hover:bg-white/60 transition-colors space-y-1.5">
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-full min-h-[40px] rounded-full bg-purple-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800 truncate flex-1">{item.empresa}</p>
                            <span className={`inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                              (item.diasVencidos || 0) > 30 ? "bg-red-100 text-red-700" :
                              (item.diasVencidos || 0) > 10 ? "bg-amber-100 text-amber-700" :
                              "bg-blue-100 text-blue-700"
                            }`}>
                              {item.diasVencidos || 0}d
                            </span>
                          </div>
                          {(item as any).apelido && <p className="text-[10px] font-bold text-purple-600">({(item as any).apelido})</p>}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 mt-0.5">
                            <span className="font-bold text-purple-800 text-xs">{formatCurrency(parseFloat(String(item.valor || 0)))}</span>
                            <span>Venc: {item.vencimento ? formatDate(item.vencimento) : "-"}</span>
                            {item.vendedor && <span className="text-slate-600">{item.vendedor}</span>}
                          </div>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="pl-4">
                          <select
                            value={item.status}
                            onChange={e => handleStatusChange(item.id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="text-[10px] font-semibold px-2 py-1 rounded-lg border bg-purple-50 text-purple-700 border-purple-400 cursor-pointer focus:ring-2 focus:ring-blue-400 w-full max-w-[180px]"
                          >
                            {ALL_STATUSES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

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

      {/* Filtro Acionados */}
      {allSellerAlerts && (
        <div className="flex items-center gap-2 flex-wrap">
          {allSellerAlerts.length > 0 && (
            <button
              onClick={() => setAcionadosFilter(!acionadosFilter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                acionadosFilter
                  ? "bg-red-600 text-white shadow-md"
                  : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
              }`}
            >
              <Bell className="w-3 h-3" />
              Vendedor Acionado ({allSellerAlerts.filter(a => a.status !== 'resolvido' && a.status !== 'cancelado').length} pendentes)
            </button>
          )}
          {acionadosFilter && (
            <button
              onClick={() => setAcionadosFilter(false)}
              className="text-[10px] text-red-500 hover:text-red-700 underline"
            >
              Limpar filtro
            </button>
          )}
          {/* Botão Histórico */}
          <button
            onClick={() => setShowAlertsHistory(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all"
          >
            <History className="w-3 h-3" />
            Histórico de Acionamentos
          </button>
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
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 transition-colors"
            title="Limpar busca"
          >
            <X className="w-3 h-3 text-slate-600" />
          </button>
        )}
      </div>
      {search.trim() && (
        <div className="text-xs text-slate-500 -mt-1">
          {filteredItems.length} {filteredItems.length === 1 ? 'resultado' : 'resultados'} para "{search}"
        </div>
      )}

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
                        <span className="text-[9px] font-medium text-slate-600 break-words block max-w-[120px]" title={item.vendedor || ""}>
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
                          {canEdit && (() => {
                            const activeAlert = allSellerAlerts?.find(a => a.empresa.toUpperCase().trim() === (item.empresa || "").toUpperCase().trim() && a.status !== 'resolvido' && a.status !== 'cancelado');
                            return (
                              <>
                                {activeAlert ? (
                                  <button
                                    onClick={() => setCancelAlertDialog({ id: activeAlert.id, empresa: activeAlert.empresa, vendedor: activeAlert.vendedor })}
                                    className="p-1 rounded-md hover:bg-orange-100 text-orange-600 transition-colors animate-pulse"
                                    title={`Cancelar alerta para ${activeAlert.vendedor}`}
                                  >
                                    <BellOff className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      let currentEtapa = "1";
                                      if (item.terceiraCobranca) currentEtapa = "3";
                                      else if (item.segundaCobranca) currentEtapa = "2";
                                      setAcionarEtapa(currentEtapa);
                                      setAcionarVendedorName(item.vendedor || "");
                                      setAcionarMensagem("");
                                      setAcionarVendedorDialog({ item, vendedorName: item.vendedor || "", etapa: currentEtapa, mensagem: "" });
                                    }}
                                    className="p-1 rounded-md hover:bg-red-100 text-red-600 transition-colors"
                                    title="Acionar Vendedor"
                                  >
                                    <Bell className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            );
                          })()}
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
                                {/* Vendedor (editável) */}
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-500 w-[70px] shrink-0">Vendedor:</span>
                                  {editingVendedorId === item.id ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        className="text-xs border border-slate-300 rounded px-1.5 py-0.5 w-[160px]"
                                        value={editingVendedorValue}
                                        onChange={e => setEditingVendedorValue(e.target.value)}
                                        autoFocus
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            updateField.mutate({ id: item.id, field: 'vendedor', value: editingVendedorValue || null, updatedBy: operator?.name || 'Sistema' });
                                            setEditingVendedorId(null);
                                          }
                                          if (e.key === 'Escape') setEditingVendedorId(null);
                                        }}
                                      />
                                      <button
                                        className="text-emerald-600 hover:text-emerald-800"
                                        onClick={() => {
                                          updateField.mutate({ id: item.id, field: 'vendedor', value: editingVendedorValue || null, updatedBy: operator?.name || 'Sistema' });
                                          setEditingVendedorId(null);
                                        }}
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        className="text-slate-400 hover:text-slate-600"
                                        onClick={() => setEditingVendedorId(null)}
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-700 font-medium">{item.vendedor || "-"}</span>
                                      {canEdit && (
                                        <button
                                          className="text-slate-400 hover:text-blue-600 transition-colors"
                                          title="Editar vendedor"
                                          onClick={() => {
                                            setEditingVendedorId(item.id);
                                            setEditingVendedorValue(item.vendedor || "");
                                          }}
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  )}
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
                                {/* Contatos adicionais do Maxiprod (endereços) */}
                                {(() => {
                                  const extras = (item.contatosAdicionais as string[] | null) || [];
                                  if (extras.length > 0) {
                                    return extras.map((tel, i) => (
                                      <div key={`extra-${i}`} className="flex items-center gap-1.5">
                                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                        <a href={`tel:${tel}`} className="text-blue-600 hover:underline">
                                          {tel}
                                        </a>
                                      </div>
                                    ));
                                  }
                                  return null;
                                })()}
                                {/* Contatos nomeados (seção "Ocultar Contatos" do Maxiprod) */}
                                {(() => {
                                  if (!clientPhonesMap) return null;
                                  const normKey = (item.empresa || "").toUpperCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
                                  const phoneData = clientPhonesMap[normKey];
                                  if (!phoneData?.contacts || phoneData.contacts.length === 0) return null;
                                  return (
                                    <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                                      <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">CONTATOS</span>
                                      {phoneData.contacts.map((c, i) => (
                                        <div key={`contact-${i}`} className="flex items-center gap-1.5 mt-1">
                                          <User className="w-3 h-3 text-violet-400 shrink-0" />
                                          <span className="text-slate-700 font-medium">{c.nome}</span>
                                          {c.cargo && <span className="text-[9px] text-slate-400">({c.cargo})</span>}
                                          {c.telefones.map((tel, j) => (
                                            <a key={j} href={`tel:${tel}`} className="text-blue-600 hover:underline ml-1">
                                              {tel}
                                            </a>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                                {/* Telefones extras do GraphQL (não presentes nos anteriores) */}
                                {(() => {
                                  if (!clientPhonesMap) return null;
                                  const normKey = (item.empresa || "").toUpperCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
                                  const phoneData = clientPhonesMap[normKey];
                                  const extras = (item.contatosAdicionais as string[] | null) || [];
                                  const principal = (item as any).contato || "";
                                  const shown = new Set([...extras, principal].filter(Boolean));
                                  // Show phones from GraphQL that aren't already shown
                                  const newPhones = (phoneData?.phones || []).filter(p => !shown.has(p));
                                  if (newPhones.length === 0) return null;
                                  return (
                                    <div className="mt-1">
                                      {newPhones.map((tel, i) => (
                                        <div key={`gql-${i}`} className="flex items-center gap-1.5">
                                          <Phone className="w-3 h-3 text-green-400 shrink-0" />
                                          <a href={`tel:${tel}`} className="text-blue-600 hover:underline">
                                            {tel}
                                          </a>
                                          <span className="text-[8px] text-slate-300">(Maxiprod)</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                                {/* Mensagem se nenhum telefone encontrado */}
                                {(() => {
                                  const extras = (item.contatosAdicionais as string[] | null) || [];
                                  const principal = (item as any).contato || "";
                                  const normKey = (item.empresa || "").toUpperCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
                                  const phoneData = clientPhonesMap?.[normKey];
                                  if (!principal && extras.length === 0 && (!phoneData || phoneData.phones.length === 0)) {
                                    return <p className="text-slate-400 italic text-[10px]">Nenhum telefone encontrado no Maxiprod.</p>;
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>

                            {/* Cobrança Timeline */}
                            <div className="space-y-2 overflow-visible">
                              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                Etapas de Cobrança
                                {(item as any).etapasHerdadasDeDoc && (
                                  <span
                                    className="ml-1 text-[9px] font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 cursor-help"
                                    title={`Etapas herdadas do título: ${(item as any).etapasHerdadasDeDoc} (ID #${(item as any).etapasHerdadasDeId})`}
                                  >
                                    ⇢ Herdado de: {(item as any).etapasHerdadasDeDoc}
                                  </span>
                                )}
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
          operatorName={operator?.name || ""}
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

      {/* ==================== DIÁRIO DE COBRANÇA MODAL ==================== */}
      {showDiary && (
        <Dialog open={showDiary} onOpenChange={setShowDiary}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-700">
                <BookOpen className="w-5 h-5" />
                Diário de Cobrança
              </DialogTitle>
            </DialogHeader>
            <DiaryPanelContent
              operatorName={operator?.name || "Operador"}
              clienteNames={Array.from(new Set((items || []).map(i => i.empresa).filter(Boolean)))}
            />
                    </DialogContent>
        </Dialog>
      )}
      {/* ==================== CANCELAR ALERTA DIALOG ==================== */}
      {cancelAlertDialog && (
        <Dialog open={true} onOpenChange={() => setCancelAlertDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-700">
                <BellOff className="w-5 h-5" /> Cancelar Alerta
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  Cancelar o acionamento do vendedor <strong>{cancelAlertDialog.vendedor}</strong> para o cliente <strong>{cancelAlertDialog.empresa}</strong>?
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  O vendedor não verá mais este alerta. Uma nota será registrada no histórico.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Motivo do cancelamento (opcional)</label>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Ex: Resolvido diretamente, erro de acionamento, cliente já pagou..."
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none h-20 focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setCancelAlertDialog(null)}>Voltar</Button>
                <Button
                  onClick={() => {
                    cancelAlert.mutate({
                      id: cancelAlertDialog.id,
                      cancelledBy: operator?.name || "Financeiro",
                      cancelReason: cancelReason.trim() || undefined,
                    });
                  }}
                  disabled={cancelAlert.isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {cancelAlert.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelando...</>
                  ) : (
                    <><BellOff className="w-4 h-4 mr-2" /> Confirmar Cancelamento</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ==================== HISTÓRICO DE ACIONAMENTOS ==================== */}
      {showAlertsHistory && (
        <Dialog open={true} onOpenChange={() => setShowAlertsHistory(false)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" /> Histórico de Acionamentos de Vendedores
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Métricas */}
              {alertsHistoryData?.metrics && (
                <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-slate-800">{alertsHistoryData.metrics.total}</div>
                    <div className="text-[10px] text-slate-500">Total</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-red-700">{alertsHistoryData.metrics.pendentes}</div>
                    <div className="text-[10px] text-red-500">Pendentes</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-amber-700">{alertsHistoryData.metrics.vistos}</div>
                    <div className="text-[10px] text-amber-500">Vistos</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-blue-700">{alertsHistoryData.metrics.emAndamento}</div>
                    <div className="text-[10px] text-blue-500">Em Andamento</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-green-700">{alertsHistoryData.metrics.resolvidos}</div>
                    <div className="text-[10px] text-green-500">Resolvidos</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-orange-700">{alertsHistoryData.metrics.cancelados}</div>
                    <div className="text-[10px] text-orange-500">Cancelados</div>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-indigo-700">{alertsHistoryData.metrics.tempoMedioResolucaoHoras}h</div>
                    <div className="text-[10px] text-indigo-500">Tempo Médio</div>
                  </div>
                </div>
              )}
              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={historyFilterVendedor}
                    onChange={e => setHistoryFilterVendedor(e.target.value)}
                    placeholder="Buscar vendedor ou empresa..."
                    className="px-2 py-1 text-xs border border-slate-200 rounded-md w-48 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  />
                </div>
                <select
                  value={historyFilterStatus}
                  onChange={e => setHistoryFilterStatus(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-400"
                >
                  <option value="todos">Todos os status</option>
                  <option value="pendente">Pendente</option>
                  <option value="visto">Visto</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="resolvido">Resolvido</option>
                  <option value="cancelado">Cancelado</option>
                </select>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={historyFilterDateFrom}
                    onChange={e => setHistoryFilterDateFrom(e.target.value)}
                    className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-400"
                  />
                  <span className="text-xs text-slate-400">até</span>
                  <input
                    type="date"
                    value={historyFilterDateTo}
                    onChange={e => setHistoryFilterDateTo(e.target.value)}
                    className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                {(historyFilterVendedor || historyFilterStatus !== "todos" || historyFilterDateFrom || historyFilterDateTo) && (
                  <button
                    onClick={() => { setHistoryFilterVendedor(""); setHistoryFilterStatus("todos"); setHistoryFilterDateFrom(""); setHistoryFilterDateTo(""); }}
                    className="px-2 py-1 text-xs bg-slate-200 hover:bg-slate-300 rounded-md transition-colors"
                  >
                    Limpar filtros
                  </button>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => {
                      const filtered = getFilteredAlerts();
                      const csv = ["Status,Empresa,Vendedor,Mensagem,Criado por,Data,Valor,Dias Atraso,Resposta,Cancelado por,Motivo Cancelamento"];
                      filtered.forEach(a => {
                        csv.push([a.status, a.empresa, a.vendedor, `"${(a.mensagem || '').replace(/"/g, '""')}"`, a.criadoPor, new Date(a.createdAt).toLocaleString('pt-BR'), a.valorTotal || '', a.diasAtrasoMax || '', `"${(a.respostaVendedor || '').replace(/"/g, '""')}"`, a.cancelledBy || '', `"${(a.cancelReason || '').replace(/"/g, '""')}"`].join(','));
                      });
                      const blob = new Blob(["\uFEFF" + csv.join("\n")], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `historico_acionamentos_${new Date().toISOString().slice(0,10)}.csv`;
                      a.click(); URL.revokeObjectURL(url);
                    }}
                    className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors flex items-center gap-1"
                    title="Exportar CSV"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </button>
                  <button
                    onClick={() => {
                      const filtered = getFilteredAlerts();
                      let html = '<html><head><meta charset="utf-8"><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px;text-align:left;font-size:11px}th{background:#f0f0f0;font-weight:bold}</style></head><body>';
                      html += '<h2>Histórico de Acionamentos de Vendedores</h2>';
                      html += `<p>Exportado em: ${new Date().toLocaleString('pt-BR')} | Total: ${filtered.length} registros</p>`;
                      html += '<table><tr><th>Status</th><th>Empresa</th><th>Vendedor</th><th>Mensagem</th><th>Criado por</th><th>Data</th><th>Valor</th><th>Dias Atraso</th><th>Resposta</th><th>Cancelado por</th><th>Motivo</th></tr>';
                      filtered.forEach(a => {
                        html += `<tr><td>${a.status}</td><td>${a.empresa}</td><td>${a.vendedor}</td><td>${a.mensagem || ''}</td><td>${a.criadoPor}</td><td>${new Date(a.createdAt).toLocaleString('pt-BR')}</td><td>${a.valorTotal ? 'R$ ' + Number(a.valorTotal).toLocaleString('pt-BR', {minimumFractionDigits:2}) : ''}</td><td>${a.diasAtrasoMax || ''}</td><td>${a.respostaVendedor || ''}</td><td>${a.cancelledBy || ''}</td><td>${a.cancelReason || ''}</td></tr>`;
                      });
                      html += '</table></body></html>';
                      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `historico_acionamentos_${new Date().toISOString().slice(0,10)}.xls`;
                      a.click(); URL.revokeObjectURL(url);
                    }}
                    className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors flex items-center gap-1"
                    title="Exportar Excel"
                  >
                    <FileDown className="w-3 h-3" /> Excel
                  </button>
                  <button
                    onClick={() => {
                      const filtered = getFilteredAlerts();
                      const printWin = window.open('', '_blank');
                      if (!printWin) return;
                      let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Histórico de Acionamentos</title>';
                      html += '<style>body{font-family:Arial,sans-serif;padding:20px;font-size:11px}h1{font-size:16px;color:#1e40af}table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}th{background:#e2e8f0;font-weight:600}.status-pendente{color:#dc2626;font-weight:bold}.status-visto{color:#d97706;font-weight:bold}.status-resolvido{color:#16a34a;font-weight:bold}.status-cancelado{color:#ea580c;font-weight:bold}.meta{color:#64748b;margin-bottom:15px}@media print{body{padding:10px}}</style>';
                      html += '</head><body>';
                      html += '<h1>Histórico de Acionamentos de Vendedores</h1>';
                      html += `<p class="meta">Grupo Fox | Exportado em: ${new Date().toLocaleString('pt-BR')} | Total: ${filtered.length} registros</p>`;
                      html += '<table><thead><tr><th>Status</th><th>Empresa</th><th>Vendedor</th><th>Mensagem</th><th>Criado por</th><th>Data</th><th>Valor</th><th>Dias</th><th>Resposta</th></tr></thead><tbody>';
                      filtered.forEach(a => {
                        html += `<tr><td class="status-${a.status}">${a.status.toUpperCase()}</td><td>${a.empresa}</td><td>${a.vendedor}</td><td>${a.mensagem || ''}</td><td>${a.criadoPor}</td><td>${new Date(a.createdAt).toLocaleString('pt-BR')}</td><td>${a.valorTotal ? 'R$ ' + Number(a.valorTotal).toLocaleString('pt-BR', {minimumFractionDigits:2}) : '-'}</td><td>${a.diasAtrasoMax || '-'}</td><td>${a.respostaVendedor || (a.status === 'cancelado' ? `Cancelado por ${a.cancelledBy || 'N/A'}${a.cancelReason ? ': ' + a.cancelReason : ''}` : '-')}</td></tr>`;
                      });
                      html += '</tbody></table></body></html>';
                      printWin.document.write(html);
                      printWin.document.close();
                      setTimeout(() => { printWin.print(); }, 500);
                    }}
                    className="px-2 py-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-md transition-colors flex items-center gap-1"
                    title="Exportar PDF (imprimir)"
                  >
                    <Download className="w-3 h-3" /> PDF
                  </button>
                </div>
              </div>
              {/* Lista de alertas */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {getFilteredAlerts().map(alert => (
                  <div key={alert.id} className={`border rounded-lg p-3 text-sm ${
                    alert.status === 'pendente' ? 'border-red-200 bg-red-50/50' :
                    alert.status === 'visto' ? 'border-amber-200 bg-amber-50/50' :
                    alert.status === 'em_andamento' ? 'border-blue-200 bg-blue-50/50' :
                    alert.status === 'resolvido' ? 'border-green-200 bg-green-50/50' :
                    alert.status === 'cancelado' ? 'border-orange-200 bg-orange-50/50' :
                    'border-slate-200 bg-slate-50/50'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            alert.status === 'pendente' ? 'bg-red-200 text-red-800' :
                            alert.status === 'visto' ? 'bg-amber-200 text-amber-800' :
                            alert.status === 'em_andamento' ? 'bg-blue-200 text-blue-800' :
                            alert.status === 'resolvido' ? 'bg-green-200 text-green-800' :
                            'bg-orange-200 text-orange-800'
                          }`}>{alert.status === 'em_andamento' ? 'EM ANDAMENTO' : alert.status.toUpperCase()}</span>
                          <span className="font-semibold text-slate-800 truncate">{alert.empresa}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-blue-700 font-medium">{alert.vendedor}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{alert.mensagem}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                          <span>Criado por: {alert.criadoPor}</span>
                          <span>{new Date(alert.createdAt).toLocaleString('pt-BR')}</span>
                          {alert.valorTotal && <span>R$ {Number(alert.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                          {alert.diasAtrasoMax && <span>{alert.diasAtrasoMax} dias atraso</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Cancel button for pending/visto alerts */}
                        {(alert.status === 'pendente' || alert.status === 'visto' || alert.status === 'em_andamento') && canEdit && (
                          <button
                            onClick={() => setCancelAlertDialog({ id: alert.id, empresa: alert.empresa, vendedor: alert.vendedor })}
                            className="p-1.5 rounded-md hover:bg-orange-100 text-orange-600 transition-colors"
                            title="Cancelar este alerta"
                          >
                            <BellOff className="w-4 h-4" />
                          </button>
                        )}
                        {/* Delete button - only Guilherme */}
                        {isGuilherme && (
                          <button
                            onClick={() => {
                              if (confirm(`Excluir permanentemente este alerta de ${alert.empresa}?`)) {
                                deleteAlertMutation.mutate({ id: alert.id, operador: operator?.name || '' });
                              }
                            }}
                            className="p-1.5 rounded-md hover:bg-red-100 text-red-500 transition-colors"
                            title="Excluir permanentemente (apenas Guilherme)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Resposta do vendedor */}
                    {alert.respostaVendedor && (
                      <div className="mt-2 bg-green-100 border border-green-200 rounded-md p-2">
                        <p className="text-[10px] font-bold text-green-700">Resposta do Vendedor:</p>
                        <p className="text-xs text-green-800">{alert.respostaVendedor}</p>
                        {alert.resolvedAt && <p className="text-[9px] text-green-500 mt-0.5">Resolvido em: {new Date(alert.resolvedAt).toLocaleString('pt-BR')}</p>}
                      </div>
                    )}
                    {/* Cancelamento */}
                    {alert.status === 'cancelado' && (
                      <div className="mt-2 bg-orange-100 border border-orange-200 rounded-md p-2">
                        <p className="text-[10px] font-bold text-orange-700">Cancelado por: {alert.cancelledBy || 'N/A'}</p>
                        {alert.cancelReason && <p className="text-xs text-orange-800">Motivo: {alert.cancelReason}</p>}
                        {alert.cancelledAt && <p className="text-[9px] text-orange-500 mt-0.5">Em: {new Date(alert.cancelledAt).toLocaleString('pt-BR')}</p>}
                      </div>
                    )}
                  </div>
                ))}
                {getFilteredAlerts().length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">{alertsHistoryData?.alerts?.length ? 'Nenhum resultado para os filtros aplicados.' : 'Nenhum acionamento registrado.'}</div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ==================== ACIONAR VENDEDOR DIALOG ==================== */}
      {acionarVendedorDialog && (
        <Dialog open onOpenChange={() => { setAcionarVendedorDialog(null); setAcionarMensagem(""); setAcionarVendedorName(""); }}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <Bell className="w-5 h-5" />
                Acionar Vendedor
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Client info */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-sm font-bold text-red-800">{acionarVendedorDialog.item.empresa}</div>
                <div className="text-xs text-red-600 mt-1">
                  {formatCurrency(parseFloat(String(acionarVendedorDialog.item.valor || 0)))} • {acionarVendedorDialog.item.diasVencidos || 0}d atraso • {acionarVendedorDialog.item.documento || ""}
                </div>
              </div>
              {/* Vendedor */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Vendedor responsável
                </label>
                {acionarVendedorDialog.vendedorName ? (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-blue-700">{acionarVendedorDialog.vendedorName}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      value={acionarVendedorName}
                      onChange={(e) => setAcionarVendedorName(e.target.value)}
                      placeholder="Digite o nome do vendedor..."
                      className="text-sm"
                    />
                    {/* Suggestions */}
                    {acionarVendedorName.length > 0 && (() => {
                      const allVendedores = Array.from(new Set((items || []).map(i => i.vendedor).filter(Boolean) as string[]));
                      const suggestions = allVendedores.filter(v => v.toLowerCase().includes(acionarVendedorName.toLowerCase()));
                      if (suggestions.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1">
                          {suggestions.slice(0, 5).map(v => (
                            <button
                              key={v}
                              onClick={() => setAcionarVendedorName(v)}
                              className="text-[10px] px-2 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              {/* Etapa selection */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Etapa da cobrança
                </label>
                <div className="flex gap-2">
                  {[{ v: "1", label: "1ª Cobrança" }, { v: "2", label: "2ª Cobrança" }, { v: "3", label: "3ª Cobrança" }].map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setAcionarEtapa(opt.v)}
                      className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg border-2 transition-all ${
                        acionarEtapa === opt.v
                          ? "bg-red-600 text-white border-red-600 shadow-md"
                          : "bg-white text-slate-600 border-slate-300 hover:border-red-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Selecionado automaticamente com base nas etapas preenchidas.</p>
              </div>
              {/* Etapa history from the item */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Histórico de etapas
                </label>
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-2 space-y-1 max-h-28 overflow-y-auto">
                  {acionarVendedorDialog.item.primeiraCobranca && (
                    <div className="flex items-center gap-2 text-[11px] py-0.5">
                      <span className="font-bold text-green-700">1ª Cob:</span>
                      <span className="text-slate-600">{formatDate(acionarVendedorDialog.item.primeiraCobranca)}</span>
                    </div>
                  )}
                  {acionarVendedorDialog.item.segundaCobranca && (
                    <div className="flex items-center gap-2 text-[11px] py-0.5">
                      <span className="font-bold text-amber-700">2ª Cob:</span>
                      <span className="text-slate-600">{formatDate(acionarVendedorDialog.item.segundaCobranca)}</span>
                    </div>
                  )}
                  {acionarVendedorDialog.item.terceiraCobranca && (
                    <div className="flex items-center gap-2 text-[11px] py-0.5">
                      <span className="font-bold text-red-700">3ª Cob:</span>
                      <span className="text-slate-600">{formatDate(acionarVendedorDialog.item.terceiraCobranca)}</span>
                    </div>
                  )}
                  {acionarVendedorDialog.item.acaoFinal && (
                    <div className="flex items-center gap-2 text-[11px] py-0.5">
                      <span className="font-bold text-purple-700">Ação Final:</span>
                      <span className="text-slate-600">{formatDate(acionarVendedorDialog.item.acaoFinal)}</span>
                    </div>
                  )}
                  {!acionarVendedorDialog.item.primeiraCobranca && !acionarVendedorDialog.item.segundaCobranca && !acionarVendedorDialog.item.terceiraCobranca && !acionarVendedorDialog.item.acaoFinal && (
                    <div className="text-[11px] text-slate-400 italic">Nenhuma etapa registrada ainda.</div>
                  )}
                  {acionarVendedorDialog.item.observacoes && (
                    <div className="mt-1 pt-1 border-t border-slate-200">
                      <span className="text-[10px] font-medium text-slate-500">Obs:</span>
                      <span className="text-[10px] text-slate-600 ml-1">{acionarVendedorDialog.item.observacoes}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Histórico de observações de cobrança */}
              {acionarDialogObs && acionarDialogObs.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">
                    Histórico de cobrança (últimas ações)
                  </label>
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-2 max-h-40 overflow-y-auto space-y-1.5">
                    {acionarDialogObs
                      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                      .map((obs, i) => {
                        const ETAPA_LABELS: Record<string, string> = {
                          primeiraCobranca: "1ª Cobrança",
                          semAcao1: "Intervalo 1",
                          segundaCobranca: "2ª Cobrança",
                          semAcao2: "Intervalo 2",
                          terceiraCobranca: "3ª Cobrança",
                          semAcao3: "Intervalo 3",
                          acaoFinal: "Ação Final",
                          intervencaoVendedor: "Intervenção Vendedor",
                        };
                        return (
                          <div key={obs.id || i} className="bg-white rounded-md p-2 border border-slate-100">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                {ETAPA_LABELS[obs.etapa] || obs.etapa}
                              </span>
                              {obs.registradoPor && (
                                <span className="text-[10px] text-slate-400">{obs.registradoPor}</span>
                              )}
                              {obs.createdAt && (
                                <span className="text-[10px] text-slate-400 ml-auto">
                                  {new Date(obs.createdAt).toLocaleDateString('pt-BR')}, {new Date(obs.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed">{obs.observacao}</p>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              {/* Message */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Mensagem para o vendedor <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={acionarMensagem}
                  onChange={(e) => setAcionarMensagem(e.target.value)}
                  placeholder="Descreva o motivo do acionamento e o que sugere que o vendedor faça..."
                  className="w-full h-28 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Ex: &quot;Cliente não atende ligações há 3 dias. Sugerimos que o vendedor entre em contato pessoalmente.&quot;</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setAcionarVendedorDialog(null); setAcionarMensagem(""); setAcionarVendedorName(""); }}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    const vendedorFinal = acionarVendedorDialog.vendedorName || acionarVendedorName.trim();
                    if (!vendedorFinal) {
                      toast.error("Informe o vendedor responsável.");
                      return;
                    }
                    if (!acionarMensagem.trim()) {
                      toast.error("Escreva uma mensagem para o vendedor.");
                      return;
                    }
                    createSellerAlert.mutate({
                      empresa: acionarVendedorDialog.item.empresa,
                      cnpj: acionarVendedorDialog.item.cnpjCpf || null,
                      vendedor: vendedorFinal,
                      mensagem: `[Etapa: ${acionarEtapa}ª Cobrança] ${acionarMensagem.trim()}`,
                      criadoPor: operator?.name || "Financeiro",
                      valorTotal: parseFloat(String(acionarVendedorDialog.item.valor || 0)),
                      titulosVencidos: 1,
                      diasAtrasoMax: acionarVendedorDialog.item.diasVencidos || 0,
                      planilhaId: acionarVendedorDialog.item.id,
                    });
                  }}
                  disabled={createSellerAlert.isPending || !acionarMensagem.trim() || (!acionarVendedorDialog.vendedorName && !acionarVendedorName.trim())}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {createSellerAlert.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><Bell className="w-4 h-4 mr-2" /> Acionar Vendedor</>
                  )}
                </Button>
              </DialogFooter>
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
function HistoryObsDialog({ planilhaId, empresa, operatorName, onClose }: {
  planilhaId: number; empresa: string; operatorName: string; onClose: () => void;
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
    intervencaoVendedor: "Intervenção Vendedor",
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
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingId(obs.id); setEditText(obs.observacao); }}
                            className="p-1 rounded hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          {operatorName.toLowerCase().includes('guilherme') && (
                            <button
                              onClick={() => { if (confirm("Excluir esta observação permanentemente?")) deleteObs.mutate({ id: obs.id }); }}
                              className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                              title="Excluir (apenas Guilherme)"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
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

/** ==================== DIÁRIO DE COBRANÇA - Componente Interno ==================== */
const DIARY_ETAPAS = [
  { value: "primeiraCobranca", label: "1ª Cobrança", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "segundaCobranca", label: "2ª Cobrança", color: "bg-indigo-100 text-indigo-700 border-indigo-300" },
  { value: "terceiraCobranca", label: "3ª Cobrança", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "semAcao1", label: "Sem Ação (1/2)", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "semAcao2", label: "Sem Ação (2/2)", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "semAcao3", label: "Sem Ação (3/3)", color: "bg-red-100 text-red-700 border-red-300" },
  { value: "acaoFinal", label: "Ação Final", color: "bg-red-200 text-red-800 border-red-400" },
  { value: "Contatado", label: "Contatado", color: "bg-teal-100 text-teal-700 border-teal-300" },
  { value: "Em negociação", label: "Em Negociação", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "Promessa de Pgto", label: "Promessa de Pgto", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "Especial s/ cobrança", label: "Especial s/ Cobrança", color: "bg-cyan-100 text-cyan-700 border-cyan-300" },
  { value: "Protestado", label: "Protestado", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "Fundo Perdido", label: "Fundo Perdido", color: "bg-stone-100 text-stone-700 border-stone-400" },
  { value: "Pago/Resolvido", label: "Pago/Resolvido", color: "bg-green-100 text-green-700 border-green-300" },
];

const DIARY_CONTATO_TIPOS = [
  { value: "ligacao", label: "Ligação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "presencial", label: "Presencial" },
  { value: "outro", label: "Outro" },
];

function DiaryPanelContent({ operatorName, clienteNames }: { operatorName: string; clienteNames: string[] }) {
  const [activeTab, setActiveTab] = useState<string>("historico");
  const [filterCliente, setFilterCliente] = useState("");
  const [filterEtapa, setFilterEtapa] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);

  // Form state for new entry
  const [formCliente, setFormCliente] = useState("");
  const [formEtapa, setFormEtapa] = useState("");
  const [formTipoContato, setFormTipoContato] = useState("");
  const [formResumo, setFormResumo] = useState("");
  const [formObs, setFormObs] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formProximaAcao, setFormProximaAcao] = useState("");
  const [formProximaData, setFormProximaData] = useState("");
  const [showForm, setShowForm] = useState(false);

  const utils = trpc.useUtils();

  // Queries
  const { data: entries, isLoading: loadingEntries } = trpc.financial.getDiaryEntries.useQuery({
    clienteName: filterCliente || undefined,
    fromDate: filterFromDate || undefined,
    toDate: filterToDate || undefined,
    etapa: filterEtapa || undefined,
    limit: 200,
  });

  const { data: snapshots, isLoading: loadingSnapshots } = trpc.financial.getDiarySnapshots.useQuery({ limit: 60 });

  const { data: snapshotDetail, isLoading: loadingDetail } = trpc.financial.getDiarySnapshotDetail.useQuery(
    { snapshotDate: selectedSnapshot! },
    { enabled: !!selectedSnapshot }
  );

  // Mutations
  const addEntry = trpc.financial.addDiaryEntry.useMutation({
    onSuccess: () => {
      toast.success("Entrada adicionada ao diário!");
      utils.financial.getDiaryEntries.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  function resetForm() {
    setFormCliente("");
    setFormEtapa("");
    setFormTipoContato("");
    setFormResumo("");
    setFormObs("");
    setFormValor("");
    setFormProximaAcao("");
    setFormProximaData("");
    setShowForm(false);
  }

  function handleSubmitEntry() {
    if (!formCliente.trim()) { toast.error("Selecione o cliente"); return; }
    if (!formEtapa) { toast.error("Selecione a etapa"); return; }
    if (!formResumo.trim()) { toast.error("Preencha o resumo da interação"); return; }
    addEntry.mutate({
      clienteName: formCliente.trim(),
      etapaAtual: formEtapa,
      tipoContato: formTipoContato || undefined,
      resumo: formResumo.trim(),
      observacoes: formObs.trim() || undefined,
      valorNegociado: formValor ? parseFloat(formValor.replace(",", ".")) : undefined,
      proximaAcao: formProximaAcao.trim() || undefined,
      proximaAcaoData: formProximaData || undefined,
      operadorName: operatorName,
    });
  }

  function getEtapaBadge(etapa: string) {
    const found = DIARY_ETAPAS.find(e => e.value === etapa);
    if (!found) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">{etapa}</span>;
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${found.color}`}>{found.label}</span>;
  }

  function getContatoLabel(tipo: string | null) {
    if (!tipo) return null;
    const found = DIARY_CONTATO_TIPOS.find(c => c.value === tipo);
    return found?.label || tipo;
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2 mb-3">
          <TabsTrigger value="historico" className="text-xs">
            <History className="w-3.5 h-3.5 mr-1.5" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="snapshots" className="text-xs">
            <Database className="w-3.5 h-3.5 mr-1.5" />
            Backups/Snapshots
          </TabsTrigger>
        </TabsList>

        {/* ========== TAB: HISTÓRICO ========== */}
        <TabsContent value="historico" className="flex-1 overflow-hidden flex flex-col mt-0">
          {/* Filtros - sticky no topo com z-index para não ser sobreposto pelo scroll */}
          <div className="flex flex-col gap-2 mb-3 p-2 bg-slate-50 rounded-lg border border-slate-200 relative z-10 shrink-0">
            {/* Linha 1: Busca cliente + Etapa */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-[120px]">
                <Input
                  placeholder="Buscar cliente..."
                  value={filterCliente}
                  onChange={(e) => setFilterCliente(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <select
                value={filterEtapa}
                onChange={(e) => setFilterEtapa(e.target.value)}
                className="h-8 px-2 text-xs border border-slate-200 rounded-md bg-white"
              >
                <option value="">Todas etapas</option>
                {DIARY_ETAPAS.map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>
            {/* Linha 2: Datas De e Até na mesma linha + botão Limpar */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500">De:</span>
                <Input
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                  className="h-8 text-xs w-[130px]"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500">Até:</span>
                <Input
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                  className="h-8 text-xs w-[130px]"
                />
              </div>
              {(filterCliente || filterEtapa || filterFromDate || filterToDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-slate-500"
                  onClick={() => { setFilterCliente(""); setFilterEtapa(""); setFilterFromDate(""); setFilterToDate(""); }}
                >
                  <X className="w-3 h-3 mr-1" /> Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Lista de entradas - scroll independente abaixo dos filtros */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 relative z-0">
            {loadingEntries ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando histórico...
              </div>
            ) : !entries || entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <BookOpen className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm font-medium">Nenhuma entrada no diário</p>
                <p className="text-xs mt-1">As entradas são geradas automaticamente a partir do histórico de cobrança</p>
              </div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors space-y-2">
                  {/* Linha 1: Nome do cliente (bloco inteiro, sem nada ao lado) */}
                  <p className="font-semibold text-sm text-slate-800 leading-tight">
                    {entry.clienteName}
                  </p>

                  {/* Linha 2: Badges (etapa + documento) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {getEtapaBadge(entry.etapaAtual)}
                    {(entry as any).documento && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 border border-blue-200">
                        {(entry as any).documento}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-slate-400">
                      {new Date(entry.createdAt).toLocaleDateString("pt-BR")}{" "}
                      {new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      <User className="w-2.5 h-2.5 inline mr-0.5" />{entry.operadorName}
                    </span>
                  </div>

                  {/* Linha 3: Observação/resumo */}
                  {entry.resumo && (
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded p-2 border border-slate-100">
                      {entry.resumo}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
          {entries && entries.length > 0 && (
            <div className="pt-2 border-t border-slate-100 mt-2">
              <p className="text-[10px] text-slate-400 text-center">{entries.length} entrada(s) encontrada(s)</p>
            </div>
          )}
        </TabsContent>


        {/* ========== TAB: SNAPSHOTS/BACKUPS ========== */}
        <TabsContent value="snapshots" className="flex-1 overflow-hidden flex flex-col mt-0">
          {!selectedSnapshot ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-xs text-blue-800 font-medium">Backups automáticos salvos diariamente às 17:15</p>
                <p className="text-[10px] text-blue-600 mt-0.5">Cada snapshot contém o estado completo de todos os clientes inadimplentes naquele dia.</p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {loadingSnapshots ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando snapshots...
                  </div>
                ) : !snapshots || snapshots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Database className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm font-medium">Nenhum snapshot salvo ainda</p>
                    <p className="text-xs mt-1">O primeiro backup será gerado automaticamente às 17:15</p>
                  </div>
                ) : (
                  snapshots.map((snap) => (
                    <button
                      key={snap.id}
                      onClick={() => setSelectedSnapshot(snap.snapshotDate)}
                      className="w-full text-left border border-slate-200 rounded-lg p-3 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {snap.snapshotDate.split("-").reverse().join("/")}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {snap.totalClientes} clientes | {snap.totalTitulos} títulos | {snap.entriesCount} entradas no dia
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-700">
                            R$ {Number(snap.valorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(snap.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            /* Detalhe do snapshot selecionado */
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSnapshot(null)}
                  className="text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
                </Button>
                <h3 className="text-sm font-bold text-slate-800">
                  Snapshot de {selectedSnapshot.split("-").reverse().join("/")}
                </h3>
              </div>

              {loadingDetail ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando detalhes...
                </div>
              ) : !snapshotDetail ? (
                <p className="text-sm text-slate-500 text-center py-8">Snapshot não encontrado.</p>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2">
                  {/* Resumo do snapshot */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-200">
                      <p className="text-lg font-bold text-slate-800">{snapshotDetail.totalClientes}</p>
                      <p className="text-[10px] text-slate-500">Clientes</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-200">
                      <p className="text-lg font-bold text-slate-800">{snapshotDetail.totalTitulos}</p>
                      <p className="text-[10px] text-slate-500">Títulos</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-200">
                      <p className="text-lg font-bold text-emerald-700">R$ {Number(snapshotDetail.valorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-slate-500">Valor Total</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-200">
                      <p className="text-lg font-bold text-amber-700">{snapshotDetail.entriesCount}</p>
                      <p className="text-[10px] text-slate-500">Entradas no Dia</p>
                    </div>
                  </div>

                  {/* Lista de clientes do snapshot */}
                  {(snapshotDetail.snapshotData as any[])?.map((client: any, idx: number) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-800">{client.clienteName}</span>
                          {getEtapaBadge(client.etapa)}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-slate-700">
                            {client.titulosCount} título(s) | R$ {Number(client.valorDevido || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      {client.ultimaAcao && (
                        <p className="text-[11px] text-slate-600 mt-1.5 pl-2 border-l-2 border-amber-300">
                          Última ação: {client.ultimaAcao}
                        </p>
                      )}
                      {client.entriesDoDia && client.entriesDoDia.length > 0 && (
                        <div className="mt-2 space-y-1 pl-2 border-l-2 border-blue-200">
                          {client.entriesDoDia.map((e: any, eIdx: number) => (
                            <div key={eIdx} className="text-[10px] text-slate-600">
                              <span className="font-medium text-blue-600">{e.hora}</span>
                              {e.tipoContato && <span className="ml-1 text-slate-400">({getContatoLabel(e.tipoContato)})</span>}
                              <span className="ml-1">{e.resumo}</span>
                              <span className="ml-1 text-slate-400">— {e.operador}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const CobrancaPlanilhaView = React.memo(CobrancaPlanilhaViewInner);
export default CobrancaPlanilhaView;
