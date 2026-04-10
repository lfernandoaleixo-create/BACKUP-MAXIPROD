import { useState, useMemo, useEffect } from "react";
import React from "react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import { Search, Phone, MessageCircle, Mail, User, Calendar, AlertTriangle, Clock, FileText, ChevronDown, ChevronUp, ChevronRight, X, Users, DollarSign, History, Shield, ShieldAlert, ShieldCheck, Send, ExternalLink, Download, Lock, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-slate-100 text-slate-700 border-slate-300" },
  { value: "contatado", label: "Contatado", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "em_negociacao", label: "Em Negociação", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "promessa", label: "Promessa de Pgto", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
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

const AGING_RANGES = [
  { key: "1-15", label: "1-15 dias", min: 1, max: 15, color: "bg-amber-50 border-amber-200 text-amber-700" },
  { key: "16-30", label: "16-30 dias", min: 16, max: 30, color: "bg-orange-50 border-orange-200 text-orange-700" },
  { key: "31-60", label: "31-60 dias", min: 31, max: 60, color: "bg-red-50 border-red-200 text-red-600" },
  { key: "61-90", label: "61-90 dias", min: 61, max: 90, color: "bg-red-100 border-red-300 text-red-700" },
  { key: "90+", label: "90+ dias", min: 91, max: 99999, color: "bg-red-200 border-red-400 text-red-800" },
];

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
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
  vendedor: string;
  decisaoCobranca: string;
  observacoesMaxiprod: string;
  cobranca: {
    status: string;
    promessaData: string | null;
    promessaValor: number | null;
    lembreteData: string | null;
    observacoes: string | null;
    contatoHistorico: Array<{ data: string; tipo: string; resumo: string; usuario?: string }>;
    updatedAt: string;
  } | null;
};

export default function InadimplenciaTab() {
  const { operator, hasGranularAccess } = useOperator();
  const canCobranca = hasGranularAccess("fin.cobranca");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [agingFilter, setAgingFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"titulos" | "clientes">("titulos");
  const [sortBy, setSortBy] = useState<"valor" | "dias" | "cliente" | "vencimento">("dias");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
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

  const COLLECTION_PASSWORD = "Thiago";

  function handlePhoneClick(titleId: number, phoneState: string, hasDocument: boolean, needsPlan: boolean) {
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

  // Mutation para registrar ação de cobrança diária
  const registerAction = trpc.financial.registerCollectionAction.useMutation({
    onSuccess: () => {
      refetchTodayActions();
      refetchPendingActions();
      refetch();
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

  // Filtro por faixa de atraso
  const filteredTitles = useMemo(() => {
    if (!agingFilter) return titles;
    const range = AGING_RANGES.find(r => r.key === agingFilter);
    if (!range) return titles;
    return titles.filter(t => t.diasAtraso >= range.min && t.diasAtraso <= range.max);
  }, [titles, agingFilter]);

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

  // Verificar se hoje é dia de cobrança (1, 3 ou 5 após vencimento)
  function isCollectionDay(title: Title): boolean {
    return COLLECTION_DAYS.includes(title.diasAtraso);
  }

  // Verificar se tem ações pendentes de dias anteriores
  function hasPendingActions(title: Title): boolean {
    const pending = pendingActionsMap?.[title.id];
    return !!pending?.hasPendingAction;
  }

  // Determinar se precisa de plano de ação (dia 7+ e não protestar)
  function needsActionPlan(title: Title): boolean {
    if (title.diasAtraso < 7) return false;
    const config = protestConfigsMap?.[title.id];
    if (!config || config.protestType === "automatico") return false;
    if (!config.actionPlan) return true;
    return false;
  }

  // Verificar se tem documento de cobrança gerado
  function hasCollectionDocument(title: Title): boolean {
    return !!collectionDocsMap?.[title.id];
  }

  // Cor do telefone baseada no estado
  // REGRA: vibra nos dias 1/3/5 e NÃO PARA até que ação seja registrada
  function getPhoneState(title: Title): "blink" | "done" | "urgent" | "idle" | "document" {
    if (title.diasAtraso < 1) return "idle";
    // Se tem documento gerado (dia 7+ não protestar) - mostrar documento
    if (hasCollectionDocument(title)) return "document";
    // Se precisa plano de ação urgente
    if (needsActionPlan(title)) return "urgent";
    // Se tem ações pendentes de dias anteriores - continua vibrando!
    if (hasPendingActions(title)) return "blink";
    // Se hoje é dia de cobrança (1, 3 ou 5)
    if (isCollectionDay(title)) {
      const hasActionToday = todayActionsMap?.[title.id] || false;
      if (hasActionToday) return "done";
      return "blink"; // Dia de cobrança sem ação - vibra!
    }
    // Dia que não é de cobrança e sem pendentes
    if (todayActionsMap?.[title.id]) return "done";
    return "idle";
  }

  // Badge Dia X/5 (mostra qual dia de cobrança)
  function getDayBadge(title: Title): string | null {
    if (title.diasAtraso < 1) return null;
    if (title.diasAtraso <= 5) {
      // Mostrar próximo dia de cobrança
      if (COLLECTION_DAYS.includes(title.diasAtraso)) {
        return `Dia ${title.diasAtraso} • Cobrança`;
      }
      const nextDay = COLLECTION_DAYS.find(d => d > title.diasAtraso);
      if (nextDay) return `Dia ${title.diasAtraso} • Próx: dia ${nextDay}`;
      return `Dia ${title.diasAtraso}`;
    }
    if (title.diasAtraso === 6) return "Dia 6 • Próx: dia 7";
    if (title.diasAtraso >= 7) return `Dia ${title.diasAtraso} • Prazo esgotado`;
    return null;
  }

  // Protesto type label
  function getProtestLabel(title: Title): { label: string; color: string } | null {
    const config = protestConfigsMap?.[title.id];
    if (!config) return null;
    if (config.protestType === "automatico") {
      return { label: "Protesto Auto", color: "bg-orange-100 text-orange-700 border-orange-300" };
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

      {/* Busca */}
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
        {(statusFilter !== "todos" || agingFilter) && (
          <button
            onClick={() => { setStatusFilter("todos"); setAgingFilter(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm hover:bg-slate-200"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
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
                    <div className="hidden md:grid grid-cols-[1fr_100px_80px_60px_140px_110px_100px] bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200/60">
                      <span className="flex items-center justify-center px-3 py-2 border-r border-slate-200/60">Referência / Documento</span>
                      <span className="flex items-center justify-center px-2 py-2 border-r border-slate-200/60">Valor</span>
                      <span className="flex items-center justify-center px-2 py-2 border-r border-slate-200/60">Venc.</span>
                      <span className="flex items-center justify-center px-2 py-2 border-r border-slate-200/60">Atraso</span>
                      <span className="flex items-center justify-center px-2 py-2 border-r border-slate-200/60">Decisão de Cobrança</span>
                      <span className="flex items-center justify-center px-2 py-2 border-r border-slate-200/60">Status</span>
                      <span className="flex items-center justify-center px-2 py-2">Ações</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {group.titulos.map(title => (
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
          <div className="hidden md:grid grid-cols-[1fr_110px_95px_65px_150px_130px_110px] bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <button onClick={() => toggleSort("cliente")} className="flex items-center justify-center gap-1 hover:text-slate-700 px-3 py-2.5 border-r border-slate-200">
              Cliente {sortBy === "cliente" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
            <button onClick={() => toggleSort("valor")} className="flex items-center justify-center gap-1 hover:text-slate-700 px-3 py-2.5 border-r border-slate-200">
              Valor {sortBy === "valor" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
            <button onClick={() => toggleSort("vencimento")} className="flex items-center justify-center gap-1 hover:text-slate-700 px-3 py-2.5 border-r border-slate-200">
              Venc. {sortBy === "vencimento" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
            <button onClick={() => toggleSort("dias")} className="flex items-center justify-center gap-1 hover:text-slate-700 px-3 py-2.5 border-r border-slate-200">
              Atraso {sortBy === "dias" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
            <div className="flex items-center justify-center px-3 py-2.5 border-r border-slate-200">Decisão de Cobrança</div>
            <div className="flex items-center justify-center px-3 py-2.5 border-r border-slate-200">Status</div>
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
function PhoneIcon({ state, onClick }: { state: "blink" | "done" | "urgent" | "idle" | "document"; onClick: () => void }) {
  const baseClasses = "p-1.5 rounded-md transition-colors cursor-pointer";

  if (state === "idle") {
    return (
      <button onClick={onClick} title="Sem ação necessária" className={`${baseClasses} text-slate-300`}>
        <Phone className="w-4 h-4" />
      </button>
    );
  }

  if (state === "done") {
    return (
      <button onClick={onClick} title="Ação registrada hoje" className={`${baseClasses} text-blue-600 bg-blue-50 hover:bg-blue-100`}>
        <Phone className="w-4 h-4" />
      </button>
    );
  }

  if (state === "urgent") {
    return (
      <button onClick={onClick} title="URGENTE: Plano de ação obrigatório!" className={`${baseClasses} text-red-600 bg-red-50 hover:bg-red-100 animate-pulse`}>
        <Phone className="w-4 h-4" />
      </button>
    );
  }

  if (state === "document") {
    return (
      <button onClick={onClick} title="Documento de cobrança gerado - Clique para ver" className={`${baseClasses} text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 animate-pulse`}>
        <FileText className="w-4 h-4" />
      </button>
    );
  }

  // blink
  return (
    <button onClick={onClick} title="Ação de cobrança necessária! Não para até registrar ação." className={`${baseClasses} text-blue-600 hover:bg-blue-100 animate-pulse`}>
      <Phone className="w-4 h-4" />
    </button>
  );
}

/* ---- Componente TitleRow (vista por título) ---- */
function TitleRow({ title, isExpanded, onToggle, onOpenAction, onOpenContato, onOpenHistory, onOpenActionPlan, onOpenDocument, onPhoneClick, onStatusChange, phoneState, dayBadge, protestLabel, needsActionPlan: needsPlan, hasDocument, canCobranca = true }: {
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
  phoneState: "blink" | "done" | "urgent" | "idle" | "document";
  dayBadge: string | null;
  protestLabel: { label: string; color: string } | null;
  needsActionPlan: boolean;
  hasDocument: boolean;
  canCobranca?: boolean;
}) {
  const statusBadge = getStatusBadge(title.cobranca?.status || "pendente");
  const hasHistorico = title.cobranca?.contatoHistorico && title.cobranca.contatoHistorico.length > 0;

  return (
    <div className={`${getAgingBg(title.diasAtraso)} transition-all`}>
      <div
        className="grid grid-cols-1 md:grid-cols-[1fr_110px_95px_65px_150px_130px_110px] cursor-pointer hover:bg-white/50 items-center"
        onClick={onToggle}
      >
        {/* Cliente + Referência + Badges */}
        <div className="flex flex-col min-w-0 px-3 py-3 border-r border-slate-200/60">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="font-semibold text-sm text-slate-800 truncate">{title.cliente}</span>
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
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mt-0.5 truncate">
            <span className="truncate">{title.referenteA}</span>
            {title.documento && <span className="shrink-0">· {title.documento}</span>}
            {title.parcela && <span className="shrink-0">· {title.parcela}</span>}
            {title.vendedor && <span className="shrink-0 text-blue-500">· {title.vendedor}</span>}
          </div>
        </div>

        {/* Valor */}
        <div className="flex items-center justify-center px-2 py-3 border-r border-slate-200/60">
          <span className={`font-bold text-sm ${getAgingColor(title.diasAtraso)}`}>
            {formatCurrency(title.valorAReceber)}
          </span>
        </div>

        {/* Vencimento */}
        <div className="flex items-center justify-center px-2 py-3 border-r border-slate-200/60 text-sm text-slate-600">{formatDate(title.vencimento)}</div>

        {/* Dias atraso */}
        <div className="flex items-center justify-center px-2 py-3 border-r border-slate-200/60">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getAgingColor(title.diasAtraso)}`}>
            {title.diasAtraso}d
          </span>
        </div>

        {/* Decisão de Cobrança */}
        <div className="flex items-center justify-center px-2 py-3 border-r border-slate-200/60">
          {title.decisaoCobranca ? (
            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              title.decisaoCobranca.toUpperCase().includes('COM PROTESTO')
                ? 'bg-orange-100 text-orange-700 border-orange-300'
                : 'bg-blue-100 text-blue-700 border-blue-300'
            }`}>
              {title.decisaoCobranca}
            </span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center justify-center px-2 py-3 border-r border-slate-200/60" onClick={e => e.stopPropagation()}>
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
        <div className="flex items-center justify-center gap-0.5 px-2 py-3" onClick={e => e.stopPropagation()}>
          {canCobranca && <PhoneIcon state={phoneState} onClick={() => onPhoneClick(phoneState, hasDocument, needsPlan)} />}
          {hasDocument && (
            <button onClick={onOpenDocument} title="Ver documento de cobrança" className="p-1.5 rounded-md hover:bg-amber-100 text-amber-700 hover:text-amber-900 transition-colors border border-amber-200">
              <FileText className="w-4 h-4" />
            </button>
          )}
          {canCobranca && (
            <button onClick={onOpenHistory} title="Histórico de cobrança" className="p-1.5 rounded-md hover:bg-white/80 text-emerald-600 hover:text-emerald-800 transition-colors">
              <History className="w-4 h-4" />
            </button>
          )}
          {canCobranca && (
            <button onClick={onOpenAction} title="Gerenciar cobrança" className="p-1.5 rounded-md hover:bg-white/80 text-slate-600 hover:text-slate-800 transition-colors">
              <FileText className="w-4 h-4" />
            </button>
          )}
          <button onClick={onToggle} className="p-1.5 rounded-md hover:bg-white/80 text-slate-400">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && <TitleDetails title={title} />}
    </div>
  );
}

/* ---- Componente ClienteTitleRow (vista por cliente) ---- */
function ClienteTitleRow({ title, isExpanded, onToggle, onOpenAction, onOpenContato, onOpenHistory, onOpenActionPlan, onOpenDocument, onPhoneClick, onStatusChange, phoneState, dayBadge, protestLabel, needsActionPlan: needsPlan, hasDocument, canCobranca = true }: {
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
  phoneState: "blink" | "done" | "urgent" | "idle" | "document";
  dayBadge: string | null;
  protestLabel: { label: string; color: string } | null;
  needsActionPlan: boolean;
  hasDocument: boolean;
  canCobranca?: boolean;
}) {
  const statusBadge = getStatusBadge(title.cobranca?.status || "pendente");

  return (
    <div className="transition-all">
      <div
        className="grid grid-cols-1 md:grid-cols-[1fr_100px_80px_60px_140px_110px_100px] cursor-pointer hover:bg-slate-50/80 items-center"
        onClick={onToggle}
      >
        <div className="min-w-0 px-3 py-2.5 border-r border-slate-200/60">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-sm text-slate-700 truncate">
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
        <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-200/60">
          <span className={`font-bold text-sm ${getAgingColor(title.diasAtraso)}`}>
            {formatCurrency(title.valorAReceber)}
          </span>
        </div>
        <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-200/60 text-sm text-slate-600">{formatDate(title.vencimento)}</div>
        <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-200/60">
          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${getAgingColor(title.diasAtraso)}`}>
            {title.diasAtraso}d
          </span>
        </div>
        {/* Decisão de Cobrança */}
        <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-200/60">
          {title.decisaoCobranca ? (
            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
              title.decisaoCobranca.toUpperCase().includes('COM PROTESTO')
                ? 'bg-orange-100 text-orange-700 border-orange-300'
                : 'bg-blue-100 text-blue-700 border-blue-300'
            }`}>
              {title.decisaoCobranca}
            </span>
          ) : (
            <span className="text-[10px] text-slate-300">—</span>
          )}
        </div>
        <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-200/60" onClick={e => e.stopPropagation()}>
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
                      {new Date(c.data).toLocaleDateString("pt-BR")} {new Date(c.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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
  onSave: (data: { receivableId: number; actionType: "ligacao" | "whatsapp" | "email" | "visita" | "outro"; operatorName: string; notes?: string }) => void;
  isSaving: boolean;
}) {
  const [actionType, setActionType] = useState<"ligacao" | "whatsapp" | "email" | "visita" | "outro">("ligacao");
  const [notes, setNotes] = useState("");

  const ACTION_TYPES = [
    { value: "ligacao" as const, label: "Ligação", icon: Phone },
    { value: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle },
    { value: "email" as const, label: "E-mail", icon: Mail },
    { value: "visita" as const, label: "Visita", icon: User },
    { value: "outro" as const, label: "Outro", icon: Send },
  ];

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
            {title.diasAtraso >= 1 && title.diasAtraso <= 7 && (
              <div className="mt-1.5 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded inline-block">
                Dia {title.diasAtraso}/7 — {7 - title.diasAtraso} dia(s) para protesto
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Tipo de Contato</label>
            <div className="grid grid-cols-5 gap-2 mt-1">
              {ACTION_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => setActionType(t.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                      actionType === t.value ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
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
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button
              onClick={() => {
                if (!notes.trim()) {
                  toast.error("Preencha as observações da ação!");
                  return;
                }
                onSave({
                  receivableId: title.id,
                  actionType,
                  operatorName,
                  notes: notes.trim(),
                });
              }}
              disabled={isSaving || !notes.trim()}
              className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Registrando..." : "Registrar Ação"}
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
  const { data: history, isLoading } = trpc.financial.getCollectionHistory.useQuery({ receivableId: title.id });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            Histórico de Cobrança
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 overflow-hidden">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="font-semibold text-sm">{title.cliente}</div>
            <div className="text-xs text-slate-500">{title.referenteA} · {formatCurrency(title.valorAReceber)} · {title.diasAtraso}d atraso</div>
          </div>

          <div className="overflow-y-auto max-h-[50vh] space-y-2 pr-1">
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
              return (
                <div
                  key={action.id || i}
                  className={`rounded-lg border p-3 ${
                    isSemContato
                      ? "bg-red-50 border-red-200"
                      : isAutomatic
                      ? "bg-slate-50 border-slate-200"
                      : "bg-green-50 border-green-200"
                  }`}
                >
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
                    </div>
                    <span className={`text-xs font-medium ${isAutomatic ? "text-slate-400" : "text-blue-600"}`}>
                      {action.operatorName}
                    </span>
                  </div>
                  {action.notes && (
                    <p className="text-sm text-slate-700 mt-1.5">{action.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
                Protesto Automático
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

            {/* Histórico de ações resumido */}
            {doc.acoesCobanca && Array.isArray(doc.acoesCobanca) && (
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
              Documento gerado em: {doc.createdAt ? new Date(String(doc.createdAt)).toLocaleString('pt-BR') : '-'}
              {doc.visualizadoEm && ` | Visualizado em: ${new Date(String(doc.visualizadoEm)).toLocaleString('pt-BR')}`}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
