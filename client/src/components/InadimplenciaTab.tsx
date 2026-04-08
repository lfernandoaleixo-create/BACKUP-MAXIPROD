import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Search, Phone, MessageCircle, Mail, User, Calendar, AlertTriangle, Clock, FileText, ChevronDown, ChevronUp, ChevronRight, X, Users, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
                    <div className="hidden md:grid grid-cols-[1fr_100px_80px_60px_130px_90px] gap-2 px-4 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      <span>Referência / Documento</span>
                      <span className="text-right">Valor</span>
                      <span>Venc.</span>
                      <span className="text-center">Atraso</span>
                      <span>Status</span>
                      <span className="text-center">Ações</span>
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
                          onStatusChange={(status) => upsertAction.mutate({ receivableId: title.id, status })}
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
          <div className="hidden md:grid grid-cols-[1fr_120px_100px_80px_140px_110px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <button onClick={() => toggleSort("cliente")} className="flex items-center gap-1 hover:text-slate-700">
              Cliente {sortBy === "cliente" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
            <button onClick={() => toggleSort("valor")} className="flex items-center gap-1 hover:text-slate-700 justify-end">
              Valor {sortBy === "valor" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
            <button onClick={() => toggleSort("vencimento")} className="flex items-center gap-1 hover:text-slate-700">
              Venc. {sortBy === "vencimento" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
            <button onClick={() => toggleSort("dias")} className="flex items-center gap-1 hover:text-slate-700 justify-center">
              Atraso {sortBy === "dias" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
            <div>Status</div>
            <div className="text-center">Ações</div>
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
                onStatusChange={(status) => {
                  upsertAction.mutate({ receivableId: title.id, status });
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Dialog de Ação */}
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
        />
      )}

      {/* Dialog de Contato */}
      {contatoDialogId && (filteredTitles.find(t => t.id === contatoDialogId) || titles.find(t => t.id === contatoDialogId)) && (
        <ContatoDialog
          title={(filteredTitles.find(t => t.id === contatoDialogId) || titles.find(t => t.id === contatoDialogId))!}
          onClose={() => setContatoDialogId(null)}
          onSave={(data) => {
            upsertAction.mutate({ receivableId: contatoDialogId, novoContato: data }, {
              onSuccess: () => setContatoDialogId(null),
            });
          }}
          isSaving={upsertAction.isPending}
        />
      )}
    </div>
  );
}

/* ---- Componente TitleRow (vista por título) ---- */
function TitleRow({ title, isExpanded, onToggle, onOpenAction, onOpenContato, onStatusChange }: {
  title: Title;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenAction: () => void;
  onOpenContato: () => void;
  onStatusChange: (status: string) => void;
}) {
  const statusBadge = getStatusBadge(title.cobranca?.status || "pendente");
  const hasLembrete = title.cobranca?.lembreteData;
  const lembreteVencido = hasLembrete && title.cobranca!.lembreteData! <= new Date().toISOString().split("T")[0];
  const hasHistorico = title.cobranca?.contatoHistorico && title.cobranca.contatoHistorico.length > 0;

  return (
    <div className={`${getAgingBg(title.diasAtraso)} transition-all`}>
      {/* Linha principal */}
      <div
        className="grid grid-cols-1 md:grid-cols-[1fr_120px_100px_80px_140px_110px] gap-2 px-4 py-3 cursor-pointer hover:bg-white/50 items-center"
        onClick={onToggle}
      >
        {/* Cliente + Referência */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-800 truncate">{title.cliente}</span>
            {hasLembrete && (
              <span className={`flex items-center gap-0.5 text-[10px] shrink-0 ${lembreteVencido ? "text-red-600 font-bold" : "text-blue-600"}`}>
                <Clock className="w-3 h-3" />
                {formatDate(title.cobranca!.lembreteData!)}
              </span>
            )}
            {hasHistorico && (
              <span className="flex items-center gap-0.5 text-[10px] text-green-600 shrink-0">
                <MessageCircle className="w-3 h-3" />
                {title.cobranca!.contatoHistorico.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 truncate">
            <span className="truncate">{title.referenteA}</span>
            {title.documento && <span className="shrink-0">· {title.documento}</span>}
            {title.parcela && <span className="shrink-0">· {title.parcela}</span>}
            {title.vendedor && <span className="shrink-0 text-blue-500">· {title.vendedor}</span>}
          </div>
        </div>

        {/* Valor */}
        <div className="text-right">
          <span className={`font-bold text-sm ${getAgingColor(title.diasAtraso)}`}>
            {formatCurrency(title.valorAReceber)}
          </span>
        </div>

        {/* Vencimento */}
        <div className="text-sm text-slate-600">{formatDate(title.vencimento)}</div>

        {/* Dias atraso */}
        <div className="text-center">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getAgingColor(title.diasAtraso)}`}>
            {title.diasAtraso}d
          </span>
        </div>

        {/* Status */}
        <div onClick={e => e.stopPropagation()}>
          <select
            value={title.cobranca?.status || "pendente"}
            onChange={e => onStatusChange(e.target.value)}
            className={`text-xs font-medium px-2 py-1 rounded-md border cursor-pointer w-full ${statusBadge.color}`}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={onOpenContato} title="Registrar contato" className="p-1.5 rounded-md hover:bg-white/80 text-blue-600 hover:text-blue-800 transition-colors">
            <Phone className="w-4 h-4" />
          </button>
          <button onClick={onOpenAction} title="Gerenciar cobrança" className="p-1.5 rounded-md hover:bg-white/80 text-slate-600 hover:text-slate-800 transition-colors">
            <FileText className="w-4 h-4" />
          </button>
          <button onClick={onToggle} className="p-1.5 rounded-md hover:bg-white/80 text-slate-400">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Detalhes expandidos */}
      {isExpanded && <TitleDetails title={title} />}
    </div>
  );
}

/* ---- Componente ClienteTitleRow (vista por cliente) ---- */
function ClienteTitleRow({ title, isExpanded, onToggle, onOpenAction, onOpenContato, onStatusChange }: {
  title: Title;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenAction: () => void;
  onOpenContato: () => void;
  onStatusChange: (status: string) => void;
}) {
  const statusBadge = getStatusBadge(title.cobranca?.status || "pendente");

  return (
    <div className="transition-all">
      <div
        className="grid grid-cols-1 md:grid-cols-[1fr_100px_80px_60px_130px_90px] gap-2 px-4 py-2.5 cursor-pointer hover:bg-slate-50/80 items-center"
        onClick={onToggle}
      >
        <div className="min-w-0">
          <div className="text-sm text-slate-700 truncate">
            {title.referenteA}
            {title.documento && ` · ${title.documento}`}
            {title.parcela && ` · ${title.parcela}`}
          </div>
        </div>
        <div className="text-right">
          <span className={`font-bold text-sm ${getAgingColor(title.diasAtraso)}`}>
            {formatCurrency(title.valorAReceber)}
          </span>
        </div>
        <div className="text-sm text-slate-600">{formatDate(title.vencimento)}</div>
        <div className="text-center">
          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${getAgingColor(title.diasAtraso)}`}>
            {title.diasAtraso}d
          </span>
        </div>
        <div onClick={e => e.stopPropagation()}>
          <select
            value={title.cobranca?.status || "pendente"}
            onChange={e => onStatusChange(e.target.value)}
            className={`text-[10px] font-medium px-1.5 py-1 rounded-md border cursor-pointer w-full ${statusBadge.color}`}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={onOpenContato} title="Registrar contato" className="p-1 rounded-md hover:bg-white/80 text-blue-600">
            <Phone className="w-3.5 h-3.5" />
          </button>
          <button onClick={onOpenAction} title="Gerenciar cobrança" className="p-1 rounded-md hover:bg-white/80 text-slate-600">
            <FileText className="w-3.5 h-3.5" />
          </button>
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
          <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Histórico de Contatos</div>
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

function ActionDialog({ title, onClose, onSave, isSaving }: {
  title: Title;
  onClose: () => void;
  onSave: (data: { status?: string; promessaData?: string | null; promessaValor?: number | null; lembreteData?: string | null; observacoes?: string | null }) => void;
  isSaving: boolean;
}) {
  const [status, setStatus] = useState(title.cobranca?.status || "pendente");
  const [promessaData, setPromessaData] = useState(title.cobranca?.promessaData || "");
  const [promessaValor, setPromessaValor] = useState(title.cobranca?.promessaValor?.toString() || "");
  const [lembreteData, setLembreteData] = useState(title.cobranca?.lembreteData || "");
  const [observacoes, setObservacoes] = useState(title.cobranca?.observacoes || "");

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

function ContatoDialog({ title, onClose, onSave, isSaving }: {
  title: Title;
  onClose: () => void;
  onSave: (data: { tipo: string; resumo: string }) => void;
  isSaving: boolean;
}) {
  const [tipo, setTipo] = useState("ligacao");
  const [resumo, setResumo] = useState("");

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Contato</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="font-semibold text-sm">{title.cliente}</div>
            <div className="text-xs text-slate-500">{title.referenteA} · {formatCurrency(title.valorAReceber)} · {title.diasAtraso}d atraso</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Tipo de Contato</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {CONTATO_TIPOS.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => setTipo(t.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                      tipo === t.value ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
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
            <label className="text-xs font-semibold text-slate-500 uppercase">Resumo do Contato</label>
            <textarea value={resumo} onChange={e => setResumo(e.target.value)} rows={4} placeholder="Descreva o que foi conversado..." className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none" autoFocus />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button
              onClick={() => { if (!resumo.trim()) return; onSave({ tipo, resumo: resumo.trim() }); }}
              disabled={isSaving || !resumo.trim()}
              className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Salvando..." : "Registrar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
