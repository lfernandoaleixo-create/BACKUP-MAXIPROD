import React, { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import {
  X, Search, Filter, ChevronDown, ChevronUp, Edit3, Save, MessageSquare,
  ArrowLeft, DollarSign, Calendar, Building2, FileText, AlertTriangle,
  CheckCircle2, Clock, Phone, Shield, Loader2, Eye, Database, Download, RefreshCw,
  History, Plus, Paperclip
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  // Permission: Thiago, Guilherme, Flavio can edit
  const canEdit = operator && ["Thiago", "Guilherme", "Flavio"].includes(operator.name);

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
        (item.observacoes || "").toLowerCase().includes(s)
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

  function handleCreateBackup() {
    if (!operator) {
      toast.error("Operador não identificado");
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

  // Cobrança step display helper
  function renderCobrancaStep(label: string, value: string | null | undefined) {
    if (!value) return <span className="text-slate-300 text-[10px]">-</span>;
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const isPaused = value.toLowerCase().includes("pausada");
    return (
      <span className={`text-[10px] font-medium ${isPaused ? "text-amber-600 italic" : isDate ? "text-blue-600" : "text-slate-600"}`}>
        {isDate ? formatDate(value) : value}
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
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
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
        {/* Sync + Backup buttons */}
        <div className="flex items-center gap-2">
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
          placeholder="Buscar empresa, CNPJ, município, observação..."
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
                <th className="text-left px-3 py-3 font-semibold text-slate-600 min-w-[200px]">
                  <button onClick={() => toggleSort("empresa")} className="flex items-center gap-1 hover:text-slate-800">
                    Empresa
                    {sortBy === "empresa" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </button>
                </th>
                <th className="text-right px-3 py-3 font-semibold text-slate-600 min-w-[90px]">
                  <button onClick={() => toggleSort("valor")} className="flex items-center gap-1 justify-end hover:text-slate-800 ml-auto">
                    Valor
                    {sortBy === "valor" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </button>
                </th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[70px]">
                  <button onClick={() => toggleSort("vencimento")} className="flex items-center gap-1 justify-center hover:text-slate-800 mx-auto">
                    Venc.
                    {sortBy === "vencimento" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </button>
                </th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[50px]">
                  <button onClick={() => toggleSort("diasVencidos")} className="flex items-center gap-1 justify-center hover:text-slate-800 mx-auto">
                    Dias
                    {sortBy === "diasVencidos" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </button>
                </th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[60px]">Tipo</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[70px]">Centro</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[120px]">Status</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[60px]">1ª Cob</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[60px]">2ª Cob</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[60px]">3ª Cob</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[60px]">Final</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 min-w-[40px]">Obs</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
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
                return (
                  <React.Fragment key={item.id}>
                    {/* Linha divisória entre clientes diferentes */}
                    {isNewClient && (
                      <tr>
                        <td colSpan={12} className="p-0">
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
                            <div className="font-semibold text-slate-800 text-[11px] leading-tight truncate max-w-[250px]" title={item.empresa}>
                              {item.empresa}
                            </div>
                            <div className="text-[9px] text-slate-400 truncate max-w-[250px]" title={item.descricao || ""}>
                              {item.descricao || "-"}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Valor */}
                      <td className="text-right px-3 py-2.5 font-bold text-slate-800 tabular-nums">
                        {formatCurrency(valor)}
                      </td>
                      {/* Vencimento */}
                      <td className="text-center px-2 py-2.5 text-slate-600 tabular-nums">
                        {formatDate(item.vencimento)}
                      </td>
                      {/* Dias */}
                      <td className="text-center px-2 py-2.5">
                        <span className={`inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          (item.diasVencidos || 0) > 30 ? "bg-red-100 text-red-700" :
                          (item.diasVencidos || 0) > 10 ? "bg-amber-100 text-amber-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {item.diasVencidos || 0}
                        </span>
                      </td>
                      {/* Tipo */}
                      <td className="text-center px-2 py-2.5">
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                          item.tipo === "Com protesto" ? "bg-red-50 text-red-600 border border-red-200" : "bg-slate-50 text-slate-500 border border-slate-200"
                        }`}>
                          {item.tipo === "Com protesto" ? "Protesto" : item.tipo === "Sem protesto" ? "S/ Prot." : item.tipo || "-"}
                        </span>
                      </td>
                      {/* Centro */}
                      <td className="text-center px-2 py-2.5">
                        <span className="text-[10px] font-medium text-slate-600">{item.centroCustos || "-"}</span>
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
                        {renderCobrancaStep("1ª", item.primeiraCobranca)}
                      </td>
                      {/* 2ª Cobrança */}
                      <td className="text-center px-2 py-2.5">
                        {renderCobrancaStep("2ª", item.segundaCobranca)}
                      </td>
                      {/* 3ª Cobrança */}
                      <td className="text-center px-2 py-2.5">
                        {renderCobrancaStep("3ª", item.terceiraCobranca)}
                      </td>
                      {/* Ação Final */}
                      <td className="text-center px-2 py-2.5">
                        {renderCobrancaStep("Final", item.acaoFinal)}
                      </td>
                      {/* Histórico Obs */}
                      <td className="text-center px-2 py-2.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setHistoryDialog(item.id)}
                          className="p-1 rounded-md hover:bg-amber-100 text-amber-600 transition-colors relative"
                          title="Ver histórico de observações"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {obsCountMap && obsCountMap[item.id] > 0 && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                          )}
                        </button>
                      </td>
                    </tr>
                    {/* Expanded Row - Details */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={12} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Info */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                                Dados da Empresa
                              </h4>
                              <div className="text-[11px] space-y-1 text-slate-600">
                                <div><span className="font-medium text-slate-500">CNPJ/CPF:</span> {item.cnpjCpf || "-"}</div>
                                <div><span className="font-medium text-slate-500">Município:</span> {item.municipio || "-"} - {item.uf || "-"}</div>
                                <div><span className="font-medium text-slate-500">País:</span> {item.pais || "-"}</div>
                                <div><span className="font-medium text-slate-500">Centro:</span> {item.centroCustos || "-"}</div>
                              </div>
                            </div>
                            {/* Cobrança Timeline */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                Etapas de Cobrança
                              </h4>
                              <div className="space-y-1.5">
                                {[
                                  { label: "Promessa Pgto", field: "promessaPgto", value: item.promessaPgto },
                                  { label: "1ª Cobrança", field: "primeiraCobranca", value: item.primeiraCobranca },
                                  { label: "Intervalo", field: "semAcao1", value: item.semAcao1 },
                                  { label: "2ª Cobrança", field: "segundaCobranca", value: item.segundaCobranca },
                                  { label: "Intervalo", field: "semAcao2", value: item.semAcao2 },
                                  { label: "3ª Cobrança", field: "terceiraCobranca", value: item.terceiraCobranca },
                                  { label: "Intervalo", field: "semAcao3", value: item.semAcao3 },
                                  { label: "Ação Final", field: "acaoFinal", value: item.acaoFinal },
                                ].map(step => (
                                  <div key={step.field} className="flex items-center gap-2 text-[11px]">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${step.value ? "bg-emerald-400" : "bg-slate-200"}`} />
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
                                    {/* Botão de observação por etapa */}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setEtapaObsDialog({ planilhaId: item.id, etapa: step.field, label: step.label }); setNewEtapaObs(""); }}
                                      className="p-0.5 rounded hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-colors shrink-0"
                                      title={`Observações: ${step.label}`}
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Observações */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <History className="w-3.5 h-3.5 text-amber-500" />
                                Histórico de Observações
                              </h4>
                              <div className="text-[11px] text-slate-500 bg-white rounded-lg border border-slate-100 p-3">
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
    </div>
  );
}

/** Sub-componente: Diálogo de observações por etapa */
function EtapaObsDialog({ planilhaId, etapa, label, canEdit, operatorName, onClose }: {
  planilhaId: number; etapa: string; label: string; canEdit: boolean; operatorName: string; onClose: () => void;
}) {
  const [newObs, setNewObs] = useState("");
  const { data: obsList, refetch } = trpc.cobrancaPlanilha.getEtapaObs.useQuery({ planilhaId, etapa });
  const addObs = trpc.cobrancaPlanilha.addEtapaObs.useMutation({
    onSuccess: () => { setNewObs(""); refetch(); toast.success("Observação adicionada!"); },
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
          <div className="max-h-[250px] overflow-y-auto space-y-2">
            {(!obsList || obsList.length === 0) && (
              <p className="text-sm text-slate-400 italic text-center py-4">Nenhuma observação registrada para esta etapa.</p>
            )}
            {obsList?.map((obs) => (
              <div key={obs.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{obs.observacao}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                  <span className="font-medium">{obs.registradoPor}</span>
                  <span>•</span>
                  <span>{new Date(obs.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
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
                autoFocus
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
  const { data: allObs, isLoading } = trpc.cobrancaPlanilha.getAllEtapaObs.useQuery({ planilhaId });

  const ETAPA_LABELS: Record<string, string> = {
    promessaPgto: "Promessa Pgto",
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
                <div key={obs.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {ETAPA_LABELS[obs.etapa] || obs.etapa}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{obs.observacao}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                    <span className="font-medium">{obs.registradoPor}</span>
                    <span>•</span>
                    <span>{new Date(obs.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
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
