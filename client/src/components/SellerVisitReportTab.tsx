/**
 * SellerVisitReportTab - Aba "Relatório de Vendas" no VendedorDetalhe
 * Permite registrar visitas, selecionar resultado e motivos de não-compra,
 * e visualizar métricas por cliente.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Plus,
  Calendar,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  UserX,
  TrendingUp,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  BarChart3,
  ClipboardList,
  AlertTriangle,
  DollarSign,
  FileText,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SellerVisitReportTabProps {
  sellerId: number;
  sellerName: string;
}

type ViewMode = "list" | "new" | "metrics";

// ─── Constants (mirrored from server) ─────────────────────────────────────────

const VISIT_OUTCOMES = [
  { value: "PEDIDO_REALIZADO", label: "Pedido Realizado", color: "emerald", icon: CheckCircle2 },
  { value: "PEDIDO_PARCIAL", label: "Pedido Parcial", color: "amber", icon: TrendingUp },
  { value: "SEM_PEDIDO", label: "Sem Pedido", color: "red", icon: XCircle },
  { value: "AGENDOU_RETORNO", label: "Agendou Retorno", color: "blue", icon: Clock },
  { value: "CLIENTE_AUSENTE", label: "Cliente Ausente", color: "slate", icon: UserX },
] as const;

const VISIT_TYPES = [
  { value: "PRIMEIRA_VISITA", label: "Primeira Visita" },
  { value: "ROTINA", label: "Visita de Rotina" },
  { value: "NEGOCIACAO", label: "Negociação" },
  { value: "APRESENTACAO", label: "Apresentação de Produto" },
  { value: "POS_VENDA", label: "Pós-Venda" },
  { value: "COBRANCA", label: "Cobrança" },
] as const;

const NO_SALE_REASONS = [
  { value: "ESTOQUE_ALTO", label: "Estoque Alto", emoji: "📦" },
  { value: "PRECO_ALTO", label: "Preço Alto", emoji: "💰" },
  { value: "SEM_VERBA", label: "Sem Verba/Orçamento", emoji: "🚫" },
  { value: "PREFERENCIA_CONCORRENTE", label: "Preferência Concorrente", emoji: "🏢" },
  { value: "PRAZO_ENTREGA", label: "Prazo de Entrega", emoji: "🚚" },
  { value: "JA_COMPROU", label: "Já Comprou Recentemente", emoji: "🔄" },
  { value: "SAZONALIDADE", label: "Sazonalidade/Baixa Temporada", emoji: "📅" },
  { value: "DECISOR_AUSENTE", label: "Decisor Ausente", emoji: "👤" },
  { value: "QUALIDADE", label: "Problemas com Qualidade", emoji: "⚠️" },
  { value: "CONDICOES_PAGAMENTO", label: "Condições de Pagamento", emoji: "💳" },
  { value: "INADIMPLENTE", label: "Inadimplente", emoji: "🔒" },
  { value: "SEM_ESPACO", label: "Sem Espaço/Depósito Cheio", emoji: "🏠" },
  { value: "OUTRO", label: "Outro", emoji: "📝" },
] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SellerVisitReportTab({ sellerId, sellerName }: SellerVisitReportTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filterOutcome, setFilterOutcome] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // Fetch visit reports
  const reportsQuery = trpc.salesVisit.list.useQuery({
    sellerId,
    outcome: filterOutcome || undefined,
    limit: 200,
  }, { staleTime: 30_000 });

  // Fetch metrics
  const metricsQuery = trpc.salesVisit.metrics.useQuery({
    sellerId,
  }, { staleTime: 60_000 });

  // Fetch clients for autocomplete
  const clientsQuery = trpc.sales.listVendorClients.useQuery(
    { sellerId },
    { staleTime: 5 * 60_000 }
  );

  const filteredReports = useMemo(() => {
    if (!reportsQuery.data?.reports) return [];
    if (!searchTerm) return reportsQuery.data.reports;
    const term = searchTerm.toLowerCase();
    return reportsQuery.data.reports.filter(r =>
      r.clientName.toLowerCase().includes(term) ||
      (r.clientCity && r.clientCity.toLowerCase().includes(term))
    );
  }, [reportsQuery.data?.reports, searchTerm]);

  return (
    <div className="space-y-4">
      {/* Header with view toggle and action buttons */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Relatório de Vendas</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {reportsQuery.data?.total ?? 0} visitas registradas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === "list"
                    ? "bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <FileText className="w-3.5 h-3.5 inline mr-1" />
                Visitas
              </button>
              <button
                onClick={() => setViewMode("metrics")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === "metrics"
                    ? "bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 inline mr-1" />
                Métricas
              </button>
            </div>

            {/* New visit button */}
            <button
              onClick={() => setViewMode("new")}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Visita
            </button>
          </div>
        </div>
      </div>

      {/* New Visit Form */}
      {viewMode === "new" && (
        <NewVisitForm
          sellerId={sellerId}
          sellerName={sellerName}
          clients={clientsQuery.data ?? []}
          onClose={() => setViewMode("list")}
          onSuccess={() => {
            utils.salesVisit.list.invalidate();
            utils.salesVisit.metrics.invalidate();
            setViewMode("list");
          }}
        />
      )}

      {/* Metrics View */}
      {viewMode === "metrics" && metricsQuery.data && (
        <MetricsView data={metricsQuery.data} />
      )}

      {/* List View */}
      {viewMode === "list" && (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por cliente ou cidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <select
                value={filterOutcome}
                onChange={(e) => setFilterOutcome(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="">Todos os resultados</option>
                {VISIT_OUTCOMES.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reports list */}
          <div className="space-y-2">
            {filteredReports.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
                <ClipboardList className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {reportsQuery.data?.total === 0
                    ? "Nenhuma visita registrada ainda. Clique em \"Nova Visita\" para começar."
                    : "Nenhuma visita encontrada com os filtros aplicados."}
                </p>
              </div>
            ) : (
              filteredReports.map((report) => (
                <VisitReportCard
                  key={report.id}
                  report={report}
                  isEditing={editingId === report.id}
                  onEdit={() => setEditingId(report.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onDeleted={() => {
                    utils.salesVisit.list.invalidate();
                    utils.salesVisit.metrics.invalidate();
                  }}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Visit Report Card ────────────────────────────────────────────────────────

function VisitReportCard({ report, isEditing, onEdit, onCancelEdit, onDeleted }: {
  report: any;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDeleted: () => void;
}) {
  const deleteMutation = trpc.salesVisit.delete.useMutation({
    onSuccess: onDeleted,
  });

  const outcome = VISIT_OUTCOMES.find(o => o.value === report.outcome);
  const visitType = VISIT_TYPES.find(t => t.value === report.visitType);
  const OutcomeIcon = outcome?.icon ?? CheckCircle2;

  const outcomeColors: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        {/* Left: main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {/* Outcome badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${outcomeColors[outcome?.color ?? "slate"]}`}>
              <OutcomeIcon className="w-3 h-3" />
              {outcome?.label ?? report.outcome}
            </span>
            {/* Visit type */}
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {visitType?.label ?? report.visitType}
            </span>
          </div>

          {/* Client name */}
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {report.clientName}
          </h4>

          {/* Location and date */}
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(report.visitDate)}
            </span>
            {report.clientCity && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {report.clientCity}{report.clientUf ? `/${report.clientUf}` : ""}
              </span>
            )}
            {report.orderValue && parseFloat(report.orderValue) > 0 && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <DollarSign className="w-3 h-3" />
                R$ {parseFloat(report.orderValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>

          {/* No-sale reasons tags */}
          {report.noSaleReasons && report.noSaleReasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {(report.noSaleReasons as string[]).map((reason: string) => {
                const r = NO_SALE_REASONS.find(nr => nr.value === reason);
                return (
                  <span
                    key={reason}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs"
                  >
                    <span>{r?.emoji ?? "📝"}</span>
                    {r?.label ?? reason}
                  </span>
                );
              })}
            </div>
          )}

          {/* Notes */}
          {report.notes && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">
              "{report.notes}"
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer"
            title="Editar"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (confirm("Excluir esta visita?")) {
                deleteMutation.mutate({ id: report.id });
              }
            }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
            title="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Visit Form ───────────────────────────────────────────────────────────

function NewVisitForm({ sellerId, sellerName, clients, onClose, onSuccess }: {
  sellerId: number;
  sellerName: string;
  clients: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [clientName, setClientName] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientUf, setClientUf] = useState("");
  const [clientId, setClientId] = useState<number | null>(null);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split("T")[0]);
  const [visitType, setVisitType] = useState("ROTINA");
  const [outcome, setOutcome] = useState("");
  const [noSaleReasons, setNoSaleReasons] = useState<string[]>([]);
  const [orderValue, setOrderValue] = useState("");
  const [notes, setNotes] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  const createMutation = trpc.salesVisit.create.useMutation({
    onSuccess,
  });

  const filteredClients = useMemo(() => {
    if (!clientName || clientName.length < 2) return [];
    const term = clientName.toLowerCase();
    return (clients || []).filter((c: any) =>
      c.nomeFantasia?.toLowerCase().includes(term) ||
      c.razaoSocial?.toLowerCase().includes(term)
    ).slice(0, 8);
  }, [clientName, clients]);

  const handleSelectClient = (client: any) => {
    setClientName(client.nomeFantasia || client.razaoSocial);
    setClientCity(client.cidade || "");
    setClientUf(client.uf || "");
    setClientId(client.id);
    setShowClientSuggestions(false);
  };

  const toggleReason = (reason: string) => {
    setNoSaleReasons(prev =>
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
    );
  };

  const handleSubmit = () => {
    if (!clientName || !outcome) return;
    createMutation.mutate({
      sellerId,
      sellerName,
      clientId,
      clientName,
      clientCity: clientCity || null,
      clientUf: clientUf || null,
      visitDate: new Date(visitDate + "T12:00:00").toISOString(),
      visitType,
      outcome,
      noSaleReasons: noSaleReasons.length > 0 ? noSaleReasons : null,
      orderValue: orderValue ? parseFloat(orderValue.replace(",", ".")) : null,
      notes: notes || null,
      nextSteps: nextSteps || null,
      nextVisitDate: nextVisitDate ? new Date(nextVisitDate + "T12:00:00").toISOString() : null,
    });
  };

  const needsReasons = outcome === "SEM_PEDIDO" || outcome === "PEDIDO_PARCIAL";
  const needsOrderValue = outcome === "PEDIDO_REALIZADO" || outcome === "PEDIDO_PARCIAL";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Plus className="w-4 h-4 text-indigo-500" />
          Registrar Nova Visita
        </h3>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Client + Date row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Client name with autocomplete */}
        <div className="md:col-span-2 relative">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Cliente *
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => {
              setClientName(e.target.value);
              setClientId(null);
              setShowClientSuggestions(true);
            }}
            onFocus={() => setShowClientSuggestions(true)}
            placeholder="Nome do cliente..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {showClientSuggestions && filteredClients.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg max-h-48 overflow-y-auto">
              {filteredClients.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectClient(c)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {c.nomeFantasia || c.razaoSocial}
                  </span>
                  {c.cidade && (
                    <span className="text-xs text-slate-400 ml-2">
                      {c.cidade}/{c.uf}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Visit date */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Data da Visita *
          </label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* City/UF + Visit Type */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Cidade</label>
          <input
            type="text"
            value={clientCity}
            onChange={(e) => setClientCity(e.target.value)}
            placeholder="Cidade"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">UF</label>
          <input
            type="text"
            value={clientUf}
            onChange={(e) => setClientUf(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="SP"
            maxLength={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tipo de Visita</label>
          <select
            value={visitType}
            onChange={(e) => setVisitType(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            {VISIT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Outcome selection - visual cards */}
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
          Resultado da Visita *
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {VISIT_OUTCOMES.map(o => {
            const Icon = o.icon;
            const isSelected = outcome === o.value;
            const colorMap: Record<string, string> = {
              emerald: isSelected ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-emerald-500/30" : "border-slate-200 dark:border-slate-600 hover:border-emerald-300",
              amber: isSelected ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 ring-2 ring-amber-500/30" : "border-slate-200 dark:border-slate-600 hover:border-amber-300",
              red: isSelected ? "border-red-500 bg-red-50 dark:bg-red-900/30 ring-2 ring-red-500/30" : "border-slate-200 dark:border-slate-600 hover:border-red-300",
              blue: isSelected ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500/30" : "border-slate-200 dark:border-slate-600 hover:border-blue-300",
              slate: isSelected ? "border-slate-500 bg-slate-100 dark:bg-slate-700 ring-2 ring-slate-500/30" : "border-slate-200 dark:border-slate-600 hover:border-slate-400",
            };
            const textColor: Record<string, string> = {
              emerald: "text-emerald-700 dark:text-emerald-400",
              amber: "text-amber-700 dark:text-amber-400",
              red: "text-red-700 dark:text-red-400",
              blue: "text-blue-700 dark:text-blue-400",
              slate: "text-slate-600 dark:text-slate-300",
            };
            return (
              <button
                key={o.value}
                onClick={() => setOutcome(o.value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer ${colorMap[o.color]}`}
              >
                <Icon className={`w-5 h-5 ${isSelected ? textColor[o.color] : "text-slate-400"}`} />
                <span className={`text-xs font-medium text-center leading-tight ${isSelected ? textColor[o.color] : "text-slate-600 dark:text-slate-400"}`}>
                  {o.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Order value (when sale was made) */}
      {needsOrderValue && (
        <div className="max-w-xs">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Valor do Pedido (R$)
          </label>
          <input
            type="text"
            value={orderValue}
            onChange={(e) => setOrderValue(e.target.value)}
            placeholder="0,00"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      )}

      {/* No-sale reasons (when no sale) */}
      {needsReasons && (
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            Motivos de Não-Compra (selecione todos que se aplicam)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {NO_SALE_REASONS.map(r => {
              const isSelected = noSaleReasons.includes(r.value);
              return (
                <button
                  key={r.value}
                  onClick={() => toggleReason(r.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-1 ring-red-400/30"
                      : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-red-300 hover:bg-red-50/50"
                  }`}
                >
                  <span className="text-base">{r.emoji}</span>
                  <span className="truncate">{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes and Next Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Observações
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalhes da conversa, contexto..."
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Próximos Passos
          </label>
          <textarea
            value={nextSteps}
            onChange={(e) => setNextSteps(e.target.value)}
            placeholder="O que fazer a seguir..."
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* Next visit date */}
      {(outcome === "AGENDOU_RETORNO" || outcome === "SEM_PEDIDO") && (
        <div className="max-w-xs">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Data do Próximo Retorno
          </label>
          <input
            type="date"
            value={nextVisitDate}
            onChange={(e) => setNextVisitDate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Submit button */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!clientName || !outcome || createMutation.isPending}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-sm"
        >
          {createMutation.isPending ? "Salvando..." : "Salvar Visita"}
        </button>
      </div>
    </div>
  );
}

// ─── Metrics View ─────────────────────────────────────────────────────────────

function MetricsView({ data }: { data: any }) {
  const { overall, clientMetrics } = data;
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Overall KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <KpiCard
          label="Total Visitas"
          value={overall.totalVisits}
          color="indigo"
          icon={ClipboardList}
        />
        <KpiCard
          label="Pedidos"
          value={overall.pedidoRealizado + overall.pedidoParcial}
          color="emerald"
          icon={CheckCircle2}
        />
        <KpiCard
          label="Sem Pedido"
          value={overall.semPedido}
          color="red"
          icon={XCircle}
        />
        <KpiCard
          label="Agendou Retorno"
          value={overall.agendouRetorno}
          color="blue"
          icon={Clock}
        />
        <KpiCard
          label="Taxa Conversão"
          value={`${overall.conversionRate.toFixed(1)}%`}
          color="purple"
          icon={TrendingUp}
        />
        <KpiCard
          label="Valor Total"
          value={`R$ ${overall.totalOrderValue.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          color="emerald"
          icon={DollarSign}
          small
        />
      </div>

      {/* Top Reasons Chart */}
      {Object.keys(overall.reasonCounts).length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Motivos de Não-Compra (Geral)
          </h3>
          <div className="space-y-2">
            {Object.entries(overall.reasonCounts)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([reason, cnt]) => {
                const r = NO_SALE_REASONS.find(nr => nr.value === reason);
                const percentage = overall.totalVisits > 0 ? ((cnt as number) / overall.totalVisits) * 100 : 0;
                return (
                  <div key={reason} className="flex items-center gap-3">
                    <span className="text-base w-6 text-center">{r?.emoji ?? "📝"}</span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-44 truncate">
                      {r?.label ?? reason}
                    </span>
                    <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-16 text-right">
                      {cnt as number}x ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Per-Client Metrics */}
      {clientMetrics.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Métricas por Cliente
          </h3>
          <div className="space-y-1">
            {clientMetrics.map((client: any) => {
              const isExpanded = expandedClient === client.clientName;
              return (
                <div key={client.clientName} className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedClient(isExpanded ? null : client.clientName)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {client.clientName}
                      </span>
                      {client.clientCity && (
                        <span className="text-xs text-slate-400 hidden sm:inline">
                          {client.clientCity}/{client.clientUf}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-slate-500">{client.totalVisits} visitas</span>
                      <span className={`text-xs font-bold ${client.conversionRate >= 50 ? "text-emerald-600" : client.conversionRate >= 25 ? "text-amber-600" : "text-red-600"}`}>
                        {client.conversionRate.toFixed(0)}% conversão
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="text-center p-2 bg-white dark:bg-slate-700 rounded-lg">
                          <div className="text-lg font-bold text-emerald-600">{client.pedidos}</div>
                          <div className="text-xs text-slate-500">Pedidos</div>
                        </div>
                        <div className="text-center p-2 bg-white dark:bg-slate-700 rounded-lg">
                          <div className="text-lg font-bold text-red-600">{client.semPedido}</div>
                          <div className="text-xs text-slate-500">Sem Pedido</div>
                        </div>
                        <div className="text-center p-2 bg-white dark:bg-slate-700 rounded-lg">
                          <div className="text-lg font-bold text-indigo-600">
                            R$ {client.totalOrderValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-xs text-slate-500">Valor Total</div>
                        </div>
                      </div>
                      {/* Reason breakdown for this client */}
                      {client.reasonPercentages.length > 0 && (
                        <div className="space-y-1.5 mt-2">
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Motivos de não-compra:</p>
                          {client.reasonPercentages.map((rp: any) => {
                            const r = NO_SALE_REASONS.find(nr => nr.value === rp.reason);
                            return (
                              <div key={rp.reason} className="flex items-center gap-2">
                                <span className="text-sm">{r?.emoji ?? "📝"}</span>
                                <span className="text-xs text-slate-600 dark:text-slate-400 w-36 truncate">{r?.label ?? rp.reason}</span>
                                <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-red-400 rounded-full"
                                    style={{ width: `${Math.min(rp.percentage, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-20 text-right">
                                  {rp.count}x ({rp.percentage.toFixed(0)}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, icon: Icon, small }: {
  label: string;
  value: string | number;
  color: string;
  icon: any;
  small?: boolean;
}) {
  const bgColors: Record<string, string> = {
    indigo: "from-indigo-500/10 to-indigo-600/5",
    emerald: "from-emerald-500/10 to-emerald-600/5",
    red: "from-red-500/10 to-red-600/5",
    blue: "from-blue-500/10 to-blue-600/5",
    purple: "from-purple-500/10 to-purple-600/5",
    amber: "from-amber-500/10 to-amber-600/5",
  };
  const iconColors: Record<string, string> = {
    indigo: "text-indigo-500",
    emerald: "text-emerald-500",
    red: "text-red-500",
    blue: "text-blue-500",
    purple: "text-purple-500",
    amber: "text-amber-500",
  };

  return (
    <div className={`bg-gradient-to-br ${bgColors[color]} rounded-xl border border-slate-200/50 dark:border-slate-700/50 p-3`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${iconColors[color]}`} />
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</span>
      </div>
      <div className={`${small ? "text-sm" : "text-lg"} font-bold text-slate-800 dark:text-slate-100 truncate`}>
        {value}
      </div>
    </div>
  );
}
