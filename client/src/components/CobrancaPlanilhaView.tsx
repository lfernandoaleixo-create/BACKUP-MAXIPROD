import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import {
  X, Search, Filter, ChevronDown, ChevronUp, Edit3, Save, MessageSquare,
  ArrowLeft, DollarSign, Calendar, Building2, FileText, AlertTriangle,
  CheckCircle2, Clock, Phone, Shield, Loader2, Eye
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

interface CobrancaPlanilhaViewProps {
  onClose: () => void;
}

export default function CobrancaPlanilhaView({ onClose }: CobrancaPlanilhaViewProps) {
  const { operator } = useOperator();
  const { data: items, isLoading, refetch } = trpc.cobrancaPlanilha.getAll.useQuery();
  const { data: summary } = trpc.cobrancaPlanilha.getSummary.useQuery();
  const updateField = trpc.cobrancaPlanilha.updateField.useMutation({
    onSuccess: () => { refetch(); toast.success("Atualizado!"); },
    onError: (err) => toast.error(err.message),
  });
  const updateObservacao = trpc.cobrancaPlanilha.updateObservacao.useMutation({
    onSuccess: () => { refetch(); toast.success("Observação salva!"); },
    onError: (err) => toast.error(err.message),
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [centerFilter, setCenterFilter] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<"diasVencidos" | "valor" | "empresa" | "vencimento">("diasVencidos");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editingObs, setEditingObs] = useState<number | null>(null);
  const [obsText, setObsText] = useState("");
  const [editingStatus, setEditingStatus] = useState<number | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

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
              {filteredItems.length} título{filteredItems.length !== 1 ? "s" : ""} · Total: {formatCurrency(totalValor)}
            </p>
          </div>
        </div>
      </div>

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
                return (
                  <React.Fragment key={item.id}>
                    <tr
                      className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-slate-25"}`}
                      onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                    >
                      {/* Empresa */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <div className={`w-1 h-8 rounded-full shrink-0 mt-0.5`} style={{
                            backgroundColor: item.status === "Contatado" ? "#3b82f6" :
                              item.status === "Em negociação" ? "#f59e0b" :
                              item.status === "Promessa de Pgto" ? "#10b981" :
                              item.status === "Não deu retorno" ? "#a855f7" :
                              item.status === "Não atendeu" ? "#ec4899" :
                              item.status === "Protestado" ? "#f97316" :
                              item.status === "Jurídico" ? "#ef4444" :
                              item.status === "Especial s/ cobrança" ? "#06b6d4" :
                              item.status === "Cheque em compensação" ? "#14b8a6" :
                              "#94a3b8"
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
                      {/* Obs */}
                      <td className="text-center px-2 py-2.5" onClick={e => e.stopPropagation()}>
                        {item.observacoes ? (
                          <button
                            onClick={() => { setEditingObs(item.id); setObsText(item.observacoes || ""); }}
                            className="p-1 rounded-md hover:bg-amber-100 text-amber-600 transition-colors relative"
                            title={item.observacoes}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                          </button>
                        ) : canEdit ? (
                          <button
                            onClick={() => { setEditingObs(item.id); setObsText(""); }}
                            className="p-1 rounded-md hover:bg-slate-100 text-slate-300 transition-colors"
                            title="Adicionar observação"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-slate-200">-</span>
                        )}
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
                                        defaultValue={step.value || ""}
                                        onBlur={e => {
                                          if (e.target.value !== (step.value || "")) {
                                            handleCobrancaFieldChange(item.id, step.field, e.target.value);
                                          }
                                        }}
                                        className="flex-1 px-2 py-0.5 rounded border border-slate-200 text-[11px] bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                                        placeholder="Data ou texto..."
                                      />
                                    ) : (
                                      <span className={step.value ? "text-slate-700" : "text-slate-300"}>
                                        {step.value ? (step.value.match(/^\d{4}-\d{2}-\d{2}$/) ? formatDate(step.value) : step.value) : "-"}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Observações */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                                Observações
                              </h4>
                              {canEdit ? (
                                <div className="space-y-2">
                                  <textarea
                                    defaultValue={item.observacoes || ""}
                                    onBlur={e => {
                                      if (e.target.value !== (item.observacoes || "")) {
                                        updateObservacao.mutate({
                                          id: item.id,
                                          observacoes: e.target.value,
                                          updatedBy: operator!.name,
                                        });
                                      }
                                    }}
                                    rows={4}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[11px] bg-white focus:ring-1 focus:ring-blue-400 resize-none"
                                    placeholder="Adicionar observação..."
                                  />
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-600 whitespace-pre-wrap bg-white rounded-lg border border-slate-100 p-3 min-h-[80px]">
                                  {item.observacoes || <span className="text-slate-300 italic">Sem observações</span>}
                                </div>
                              )}
                              {item.updatedBy && (
                                <div className="text-[9px] text-slate-400 italic">
                                  Última edição: {item.updatedBy}
                                </div>
                              )}
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

      {/* Observation Edit Dialog */}
      {editingObs !== null && (
        <Dialog open onOpenChange={() => setEditingObs(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                Observações
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              {canEdit ? (
                <textarea
                  value={obsText}
                  onChange={e => setObsText(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Adicionar observação..."
                  autoFocus
                />
              ) : (
                <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 min-h-[120px]">
                  {obsText || <span className="text-slate-300 italic">Sem observações</span>}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingObs(null)}>
                {canEdit ? "Cancelar" : "Fechar"}
              </Button>
              {canEdit && (
                <Button onClick={() => handleSaveObs(editingObs)} className="bg-emerald-600 hover:bg-emerald-700">
                  <Save className="w-4 h-4 mr-1" />
                  Salvar
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
