/**
 * Card: Consulta de Cliente
 * Busca por nome com autocomplete e exibe resumo completo do cliente
 * 4 cards de status: Em Digitação, A Aprovar, Aprovado (A Faturar), Faturado
 * Cores: Faturado=verde, Aprovado(A Faturar)=amarelo alaranjado, A Aprovar=laranja, Em Digitação=cinza
 * Títulos: EMITIDO = em aberto (aguardando pagamento), RECEBIDO = já pago
 * Filtros profissionais: Em Aberto / Pago / Todos com ordenação por vencimento
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Search,
  User,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  Package,
  TrendingUp,
  FileText,
  X,
  MapPin,
  Phone,
  Mail,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  Landmark,
  CreditCard,
  CheckCircle2,
  Clock,
  Edit3,
  ClipboardCheck,
  Receipt,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Hash,
} from "lucide-react";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const clean = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const parts = clean.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const clean = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const target = new Date(clean + "T12:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

type TituloFilter = "todos" | "aberto" | "pago";
type TituloSort = "vencimento_asc" | "vencimento_desc" | "valor_desc" | "valor_asc";

/** Painel expandível de Valor a Receber com detalhes completos */
function ValorAReceberPanel({ receivables }: { receivables: any }) {
  const [showEmAberto, setShowEmAberto] = useState(false);
  const [showDescontados, setShowDescontados] = useState(false);

  const valorEmAbertoLive = receivables.valorEmAbertoLive || receivables.valorEmAberto || 0;
  const valorDescontados = receivables.valorDescontados || 0;
  const valorAReceber = receivables.valorAReceber || 0;
  const titulosEmAberto = receivables.titulosEmAbertoLive || [];
  const titulosDescontados = receivables.titulosDescontados || [];

  return (
    <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-300 shadow-sm">
      {/* Header com valor total */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-blue-700 font-semibold mb-1">
            <DollarSign className="h-4 w-4 text-blue-600" />
            Valor a Receber
          </div>
          <div className="text-2xl font-bold text-blue-800">{formatCurrency(valorAReceber)}</div>
        </div>
        <div className="text-right space-y-0.5">
          <div className="text-xs text-blue-600">
            Em aberto: {formatCurrency(valorEmAbertoLive)} ({titulosEmAberto.length} t\u00edtulos)
          </div>
          {valorDescontados > 0 && (
            <div className="text-xs text-purple-600">
              Descontados: {formatCurrency(valorDescontados)} ({titulosDescontados.length} t\u00edtulos)
            </div>
          )}
        </div>
      </div>

      {/* Seção Em Aberto - expansível */}
      {titulosEmAberto.length > 0 && (
        <div className="mt-3 pt-3 border-t border-blue-200">
          <button
            onClick={() => setShowEmAberto(!showEmAberto)}
            className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors w-full text-left"
          >
            {showEmAberto ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            T\u00edtulos em aberto ({titulosEmAberto.length})
          </button>
          {showEmAberto && (
            <div className="mt-2 max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-blue-100 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1 text-blue-700">Doc</th>
                    <th className="text-left px-2 py-1 text-blue-700">Parcela</th>
                    <th className="text-right px-2 py-1 text-blue-700">Valor</th>
                    <th className="text-right px-2 py-1 text-blue-700">Vencimento</th>
                  </tr>
                </thead>
                <tbody>
                  {titulosEmAberto
                    .sort((a: any, b: any) => {
                      const dA = a.vencimento || "";
                      const dB = b.vencimento || "";
                      return dA.localeCompare(dB);
                    })
                    .map((t: any, idx: number) => {
                      const days = daysUntil(t.vencimento);
                      const isOverdue = days !== null && days < 0;
                      return (
                        <tr key={idx} className={`border-b border-blue-100 ${isOverdue ? 'bg-red-50' : ''}`}>
                          <td className="px-2 py-1 text-slate-700">{t.documento || "-"}</td>
                          <td className="px-2 py-1 text-slate-700">{t.parcela || "-"}</td>
                          <td className="px-2 py-1 text-right font-medium text-slate-800">{formatCurrency(t.valorOriginal)}</td>
                          <td className={`px-2 py-1 text-right ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                            {formatDate(t.vencimento)}
                            {isOverdue && <span className="ml-1 text-[9px]">({Math.abs(days!)}d atraso)</span>}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Seção Descontados - expansível */}
      {titulosDescontados.length > 0 && (
        <div className="mt-2 pt-2 border-t border-purple-200">
          <button
            onClick={() => setShowDescontados(!showDescontados)}
            className="flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900 transition-colors w-full text-left"
          >
            {showDescontados ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            T\u00edtulos descontados ({titulosDescontados.length})
          </button>
          {showDescontados && (
            <div className="mt-2 max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-purple-100 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1 text-purple-700">Doc</th>
                    <th className="text-left px-2 py-1 text-purple-700">Parcela</th>
                    <th className="text-left px-2 py-1 text-purple-700">Situa\u00e7\u00e3o</th>
                    <th className="text-right px-2 py-1 text-purple-700">Valor</th>
                    <th className="text-right px-2 py-1 text-purple-700">Vencimento</th>
                    <th className="text-right px-2 py-1 text-purple-700">Liquida\u00e7\u00e3o</th>
                  </tr>
                </thead>
                <tbody>
                  {titulosDescontados
                    .sort((a: any, b: any) => {
                      const dA = a.vencimento || "";
                      const dB = b.vencimento || "";
                      return dA.localeCompare(dB);
                    })
                    .map((t: any, idx: number) => (
                      <tr key={idx} className="border-b border-purple-100">
                        <td className="px-2 py-1 text-slate-700">{t.documento || "-"}</td>
                        <td className="px-2 py-1 text-slate-700">{t.parcela || "-"}</td>
                        <td className="px-2 py-1 text-purple-700 font-medium">{t.situacao}</td>
                        <td className="px-2 py-1 text-right font-medium text-slate-800">{formatCurrency(t.valorOriginal)}</td>
                        <td className="px-2 py-1 text-right text-slate-600">{formatDate(t.vencimento)}</td>
                        <td className="px-2 py-1 text-right text-slate-600">{formatDate(t.liquidacao)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ClientSearchCard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tituloFilter, setTituloFilter] = useState<TituloFilter>("todos");
  const [tituloSort, setTituloSort] = useState<TituloSort>("vencimento_asc");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    orders: true,
    receivables: true,
    overdue: true,
    products: false,
    history: false,
    titles: true,
    pending: false,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: searchResults } = trpc.sales.searchClients.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 1 }
  );

  const { data: clientSummary, isLoading: isLoadingSummary } = trpc.sales.getClientSummary.useQuery(
    { clienteName: selectedClient || "" },
    { enabled: !!selectedClient }
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const clearSelection = () => {
    setSelectedClient(null);
    setSearchQuery("");
    setExpanded(false);
    setTituloFilter("todos");
    setTituloSort("vencimento_asc");
  };

  const handleSelectClient = (clientName: string) => {
    setSelectedClient(clientName);
    setSearchQuery("");
    setShowDropdown(false);
    setExpanded(true);
    setTituloFilter("todos");
    setTituloSort("vencimento_asc");
    inputRef.current?.blur();
  };

  // Filter and sort grouped receivables
  const filteredReceivables = useMemo(() => {
    if (!clientSummary?.groupedReceivables) return [];
    let groups = [...clientSummary.groupedReceivables];

    // Filter
    if (tituloFilter === "aberto") {
      groups = groups.filter(g => {
        const allRecebido = g.titulos.every(t => t.estado === "RECEBIDO");
        return !allRecebido; // Keep groups that have at least one non-RECEBIDO
      });
    } else if (tituloFilter === "pago") {
      groups = groups.filter(g => {
        const allRecebido = g.titulos.every(t => t.estado === "RECEBIDO");
        return allRecebido && g.isFaturado;
      });
    }

    // Sort
    groups.sort((a, b) => {
      // Get earliest vencimento from each group
      const getVenc = (g: typeof groups[0]) => {
        const dates = g.titulos.map(t => t.vencimento).filter(Boolean);
        if (dates.length === 0) return "9999-12-31";
        return dates.sort()[0];
      };
      const getValor = (g: typeof groups[0]) => g.valorTotalGrupo;

      switch (tituloSort) {
        case "vencimento_asc":
          return getVenc(a).localeCompare(getVenc(b));
        case "vencimento_desc":
          return getVenc(b).localeCompare(getVenc(a));
        case "valor_desc":
          return getValor(b) - getValor(a);
        case "valor_asc":
          return getValor(a) - getValor(b);
        default:
          return 0;
      }
    });

    return groups;
  }, [clientSummary?.groupedReceivables, tituloFilter, tituloSort]);

  // Count by filter
  const filterCounts = useMemo(() => {
    if (!clientSummary?.groupedReceivables) return { todos: 0, aberto: 0, pago: 0 };
    const all = clientSummary.groupedReceivables;
    const aberto = all.filter(g => !g.titulos.every(t => t.estado === "RECEBIDO")).length;
    const pago = all.filter(g => g.titulos.every(t => t.estado === "RECEBIDO") && g.isFaturado).length;
    return { todos: all.length, aberto, pago };
  }, [clientSummary?.groupedReceivables]);

  // Totals for filtered
  const filteredTotals = useMemo(() => {
    const total = filteredReceivables.reduce((s, g) => s + g.valorTotalGrupo, 0);
    const parcelas = filteredReceivables.reduce((s, g) => s + g.parcelas, 0);
    return { total, parcelas, groups: filteredReceivables.length };
  }, [filteredReceivables]);

  const summaryText = clientSummary
    ? `${clientSummary.orders.totalPedidos} pedidos | ${formatCurrency(clientSummary.orders.valorTotalPedidos)}`
    : "";

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm relative" style={{ zIndex: showDropdown ? 100 : 'auto' }}>
      {/* Header */}
      <div className="w-full flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <User className="w-6 h-6 text-blue-600 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide shrink-0">
            Consulta de Cliente
          </h3>

          <div className="relative flex-1 max-w-md ml-4" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Digite o nome do cliente..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  if (e.target.value.length < 1) {
                    setSelectedClient(null);
                    setExpanded(false);
                  }
                }}
                onFocus={() => {
                  if (searchQuery.length >= 1) setShowDropdown(true);
                }}
                className="w-full h-8 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-700 placeholder:text-slate-400"
              />
              {searchQuery.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                    setShowDropdown(false);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {showDropdown && searchResults && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-[70vh] overflow-y-auto">
                <div className="sticky top-0 bg-slate-50 px-4 py-1.5 border-b border-slate-200 text-[10px] text-slate-500 font-medium">
                  {searchResults.length} cliente{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}
                </div>
                {searchResults.map((client, idx) => (
                  <button
                    key={idx}
                    className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center justify-between border-b border-slate-100 last:border-0 transition-colors"
                    onClick={() => handleSelectClient(client.cliente || "")}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-xs text-slate-700 truncate">{client.cliente}</div>
                      {client.clienteApelido && client.clienteApelido !== client.cliente && (
                        <div className="text-[10px] text-slate-400 truncate">{client.clienteApelido}</div>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0 ml-2">
                      {client.uf && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                          {client.uf}
                        </span>
                      )}
                      {client.crmSegmento && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                          {client.crmSegmento}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {selectedClient && !isLoadingSummary && summaryText && (
            <span className="text-sm font-bold text-slate-800 hidden md:block">{summaryText}</span>
          )}
          {isLoadingSummary && selectedClient && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          )}
          {selectedClient && (
            <>
              <button onClick={() => setExpanded(!expanded)}>
                {expanded
                  ? <ChevronDown className="w-4 h-4 text-slate-400" />
                  : <ChevronRight className="w-4 h-4 text-slate-400" />
                }
              </button>
              <button
                onClick={clearSelection}
                className="text-slate-400 hover:text-red-500 transition-colors"
                title="Fechar consulta"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && selectedClient && (
        <div className="border-t border-slate-200 p-5">
          {isLoadingSummary ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-3 text-sm text-slate-500">Carregando dados do cliente...</span>
            </div>
          ) : clientSummary ? (
            <div className="space-y-4">
              {/* Client Info Header */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      {clientSummary.clientInfo.nome}
                    </h3>
                    {clientSummary.clientInfo.razaoSocial && (
                      <p className="text-xs text-slate-500 mt-0.5">{clientSummary.clientInfo.razaoSocial}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    {clientSummary.clientInfo.uf && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-medium">
                        {clientSummary.clientInfo.uf}
                      </span>
                    )}
                    {clientSummary.clientInfo.crmSegmento && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                        {clientSummary.clientInfo.crmSegmento}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3 text-xs text-slate-500">
                  {clientSummary.clientInfo.endereco && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                      <span className="truncate">{clientSummary.clientInfo.endereco}</span>
                    </div>
                  )}
                  {clientSummary.clientInfo.telefone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                      {clientSummary.clientInfo.telefone}
                    </div>
                  )}
                  {clientSummary.clientInfo.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                      {clientSummary.clientInfo.email}
                    </div>
                  )}
                  {clientSummary.clientInfo.clienteDesde && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 shrink-0 text-slate-400" />
                      Cliente desde {formatDate(clientSummary.clientInfo.clienteDesde)}
                    </div>
                  )}
                </div>
              </div>

              {/* KPI Cards: Total Pedidos, Em Digitação, A Aprovar, Aprovado (A Faturar), Faturado */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {/* Total Pedidos - Azul */}
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 mb-1">
                    <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
                    Total Pedidos
                  </div>
                  <div className="text-xl font-bold text-blue-700">{clientSummary.orders.totalPedidos}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatCurrency(clientSummary.orders.valorTotalPedidos)}</div>
                </div>
                {/* Em Digitação - Cinza */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                    Em Digitação
                  </div>
                  <div className="text-xl font-bold text-slate-700">{clientSummary.orders.pedidosEmDigitacao}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatCurrency(clientSummary.orders.valorEmDigitacao)}</div>
                </div>
                {/* A Aprovar - Laranja */}
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <div className="flex items-center gap-1.5 text-xs text-orange-600 mb-1">
                    <ClipboardCheck className="h-3.5 w-3.5 text-orange-600" />
                    A Aprovar
                  </div>
                  <div className="text-xl font-bold text-orange-700">{clientSummary.orders.pedidosAprovar || 0}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatCurrency(clientSummary.orders.valorAprovar || 0)}</div>
                </div>
                {/* Aprovado (A Faturar) - Amarelo Alaranjado */}
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 mb-1">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    Aprovado (A Faturar)
                  </div>
                  <div className="text-xl font-bold text-amber-700">{clientSummary.orders.pedidosAFaturar}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatCurrency(clientSummary.orders.valorAFaturar)}</div>
                </div>
                {/* Faturado - Verde */}
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Faturado
                  </div>
                  <div className="text-xl font-bold text-emerald-700">{clientSummary.orders.pedidosFaturados}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatCurrency(clientSummary.orders.valorFaturado)}</div>
                </div>
              </div>

              {/* VALOR A RECEBER - Destaque principal */}
              {clientSummary.receivables.valorAReceber > 0 && (
                <ValorAReceberPanel receivables={clientSummary.receivables} />
              )}

              {/* Resumo Financeiro: Títulos Em Aberto + Inadimplência */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Títulos Em Aberto (EMITIDO) */}
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 mb-1">
                    <Receipt className="h-3.5 w-3.5 text-amber-600" />
                    Títulos Em Aberto
                  </div>
                  <div className="text-xl font-bold text-amber-700">{clientSummary.receivables.parcelasEmAberto || clientSummary.receivables.titulosEmAberto}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatCurrency(clientSummary.receivables.valorEmAberto)}</div>
                  <div className="text-[10px] text-amber-500 mt-1">
                    Aguardando pagamento
                  </div>
                </div>

                {/* Inadimplência - SEMPRE VERMELHO */}
                {clientSummary.overdue.titulosVencidos > 0 ? (
                  <div className="bg-red-100 rounded-lg p-3 border-2 border-red-400 shadow-sm">
                    <div className="flex items-center gap-1.5 text-xs text-red-700 font-semibold mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                      Inadimplência
                    </div>
                    <div className="text-xl font-bold text-red-800">{formatCurrency(clientSummary.overdue.valorVencido)}</div>
                    <div className="text-xs text-red-600 mt-0.5">
                      {clientSummary.overdue.titulosVencidos} título{clientSummary.overdue.titulosVencidos !== 1 ? 's' : ''} vencido{clientSummary.overdue.titulosVencidos !== 1 ? 's' : ''}
                    </div>
                    {clientSummary.overdue.diasAtrasoMedio > 0 && (
                      <div className="text-[10px] text-red-500 mt-1">
                        Atraso médio: {clientSummary.overdue.diasAtrasoMedio}d | Máx: {clientSummary.overdue.diasAtrasoMax}d
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <div className="flex items-center gap-1.5 text-xs text-red-600 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      Inadimplência
                    </div>
                    <div className="text-xl font-bold text-red-700">Nenhuma</div>
                    <div className="text-xs text-red-400 mt-0.5">Cliente em dia</div>
                  </div>
                )}
              </div>

              {/* Collapsible Sections */}

              {/* Orders Section */}
              <SectionCard
                title="Pedidos"
                icon={<ShoppingCart className="h-4 w-4 text-blue-600" />}
                badge={`${clientSummary.orders.totalPedidos}`}
                expanded={expandedSections.orders}
                onToggle={() => toggleSection("orders")}
              >
                {clientSummary.recentOrders.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-xs">
                          <th className="text-left py-2 px-2">Pedido</th>
                          <th className="text-left py-2 px-2">Data</th>
                          <th className="text-right py-2 px-2">Valor</th>
                          <th className="text-left py-2 px-2">Status</th>
                          <th className="text-left py-2 px-2">NF</th>
                          <th className="text-left py-2 px-2">Cond. Pgto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientSummary.recentOrders.map((order, idx) => (
                          <tr key={idx} className={`border-b border-slate-100 hover:bg-slate-50 ${
                            order.status === "Faturado" ? "bg-emerald-50/30" :
                            order.status === "A faturar" || order.status === "Aprovado" ? "bg-amber-50/30" :
                            ""
                          }`}>
                            <td className="py-1.5 px-2 font-mono text-xs text-slate-700 font-semibold">{order.pedido}</td>
                            <td className="py-1.5 px-2 text-xs text-slate-600">{formatDate(order.data)}</td>
                            <td className="py-1.5 px-2 text-right text-xs text-slate-700 font-medium">{formatCurrency(order.valor)}</td>
                            <td className="py-1.5 px-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                order.status === "Faturado" ? "bg-emerald-100 text-emerald-700" :
                                order.status === "A faturar" || order.status === "Aprovado" ? "bg-amber-100 text-amber-700" :
                                order.status === "A aprovar" ? "bg-orange-100 text-orange-700" :
                                order.status === "Digitação" || order.status === "Em digitação" ? "bg-slate-100 text-slate-600" :
                                "bg-slate-100 text-slate-600"
                              }`}>
                                {order.status === "A faturar" || order.status === "Aprovado" ? "Aprovado (A Faturar)" :
                                 order.status === "Digitação" ? "Em Digitação" : order.status}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-xs">
                              {order.status === "Faturado" && (order as any).notasFiscais?.length > 0 ? (
                                <span className="font-mono text-emerald-700 font-medium">
                                  NF {(order as any).notasFiscais.join(", ")}
                                </span>
                              ) : order.status === "Faturado" ? (
                                <span className="text-slate-400">-</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-xs text-slate-500">{(order as any).condicaoPagamento || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              {/* Títulos (Contas a Receber) - with professional filters */}
              <SectionCard
                title="Títulos (Contas a Receber)"
                icon={<FileText className="h-4 w-4 text-amber-600" />}
                badge={`${clientSummary.groupedReceivables?.length || 0} documentos`}
                expanded={expandedSections.titles}
                onToggle={() => toggleSection("titles")}
              >
                {/* Professional Filter Bar */}
                <div className="mb-3 space-y-2">
                  {/* Filter tabs */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1">
                      <Filter className="h-3.5 w-3.5 text-slate-400 mr-1" />
                      <button
                        onClick={() => setTituloFilter("todos")}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                          tituloFilter === "todos"
                            ? "bg-slate-700 text-white shadow-sm"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        Todos ({filterCounts.todos})
                      </button>
                      <button
                        onClick={() => setTituloFilter("aberto")}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                          tituloFilter === "aberto"
                            ? "bg-amber-600 text-white shadow-sm"
                            : "bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200"
                        }`}
                      >
                        Em Aberto ({filterCounts.aberto})
                      </button>
                      <button
                        onClick={() => setTituloFilter("pago")}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                          tituloFilter === "pago"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200"
                        }`}
                      >
                        Pagos ({filterCounts.pago})
                      </button>
                    </div>

                    {/* Sort selector */}
                    <div className="flex items-center gap-1.5">
                      <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                      <select
                        value={tituloSort}
                        onChange={(e) => setTituloSort(e.target.value as TituloSort)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      >
                        <option value="vencimento_asc">Vencimento (mais próximo primeiro)</option>
                        <option value="vencimento_desc">Vencimento (mais distante primeiro)</option>
                        <option value="valor_desc">Maior valor primeiro</option>
                        <option value="valor_asc">Menor valor primeiro</option>
                      </select>
                    </div>
                  </div>

                  {/* Summary bar */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 text-[11px]">
                    <span className="text-slate-500">
                      <strong className="text-slate-700">{filteredTotals.groups}</strong> documento{filteredTotals.groups !== 1 ? 's' : ''} | <strong className="text-slate-700">{filteredTotals.parcelas}</strong> título{filteredTotals.parcelas !== 1 ? 's' : ''}
                    </span>
                    <span className="font-bold text-slate-700">{formatCurrency(filteredTotals.total)}</span>
                  </div>
                </div>

                {filteredReceivables.length > 0 ? (
                  <div className="space-y-2">
                    {filteredReceivables.map((group, gIdx) => (
                      <TituloGroupCard key={gIdx} group={group} />
                    ))}
                  </div>
                ) : clientSummary.orders.pedidosFaturados > 0 && tituloFilter === "todos" ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-amber-600 font-medium">Pedido faturado encontrado, mas sem títulos vinculados.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Os títulos podem ainda não ter sido gerados no Maxiprod ou estão vinculados a outro nome de cliente.</p>
                  </div>
                ) : tituloFilter !== "todos" ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-slate-400">Nenhum título encontrado com o filtro selecionado.</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">Nenhum título encontrado para este cliente.</p>
                )}
              </SectionCard>

              {/* Overdue Section - only if there are overdue items */}
              {clientSummary.overdue.titulosVencidos > 0 && (
                <SectionCard
                  title="Inadimplência"
                  icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
                  badge={`${clientSummary.overdue.titulosVencidos} vencidos`}
                  expanded={expandedSections.overdue}
                  onToggle={() => toggleSection("overdue")}
                  variant="danger"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-red-50 rounded border border-red-100">
                      <div className="text-xs text-slate-500">Valor Vencido</div>
                      <div className="font-semibold text-red-700">{formatCurrency(clientSummary.overdue.valorVencido)}</div>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded border border-red-100">
                      <div className="text-xs text-slate-500">Títulos Vencidos</div>
                      <div className="font-semibold text-red-700">{clientSummary.overdue.titulosVencidos}</div>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded border border-red-100">
                      <div className="text-xs text-slate-500">Atraso Médio</div>
                      <div className="font-semibold text-red-700">{clientSummary.overdue.diasAtrasoMedio} dias</div>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded border border-red-100">
                      <div className="text-xs text-slate-500">Maior Atraso</div>
                      <div className="font-semibold text-red-700">{clientSummary.overdue.diasAtrasoMax} dias</div>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* Top Products */}
              <SectionCard
                title="Produtos Mais Comprados"
                icon={<Package className="h-4 w-4 text-purple-600" />}
                badge={`${clientSummary.topProducts.length}`}
                expanded={expandedSections.products}
                onToggle={() => toggleSection("products")}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-xs">
                        <th className="text-left py-2 px-2">Código</th>
                        <th className="text-left py-2 px-2">Produto</th>
                        <th className="text-right py-2 px-2">Qtd</th>
                        <th className="text-right py-2 px-2">Valor Total</th>
                        <th className="text-right py-2 px-2">Pedidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientSummary.topProducts.map((product, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-1.5 px-2 font-mono text-xs text-slate-700">{product.codigo}</td>
                          <td className="py-1.5 px-2 text-xs text-slate-600 truncate max-w-[200px]">{product.descricao}</td>
                          <td className="py-1.5 px-2 text-right text-xs text-slate-700">{Math.round(product.qtd).toLocaleString("pt-BR")}</td>
                          <td className="py-1.5 px-2 text-right text-xs text-slate-700">{formatCurrency(product.valor)}</td>
                          <td className="py-1.5 px-2 text-right text-xs text-slate-600">{product.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              {/* Monthly Evolution */}
              {clientSummary.monthlyEvolution.length > 0 && (
                <SectionCard
                  title="Evolução Mensal"
                  icon={<TrendingUp className="h-4 w-4 text-cyan-600" />}
                  badge={`${clientSummary.monthlyEvolution.length} meses`}
                  expanded={expandedSections.history}
                  onToggle={() => toggleSection("history")}
                >
                  <div className="space-y-1.5">
                    {clientSummary.monthlyEvolution.map((m, idx) => {
                      const maxVal = Math.max(...clientSummary.monthlyEvolution.map(x => x.valor));
                      const pct = maxVal > 0 ? (m.valor / maxVal) * 100 : 0;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 w-16 shrink-0">{m.month}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-end pr-2"
                              style={{ width: `${Math.max(pct, 8)}%` }}
                            >
                              <span className="text-[10px] font-medium whitespace-nowrap text-white">{formatCurrency(m.valor)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              )}

              {/* Pending Items */}
              {clientSummary.pendingItems.length > 0 && (
                <SectionCard
                  title="Itens Pendentes (Estoque)"
                  icon={<Package className="h-4 w-4 text-orange-600" />}
                  badge={`${clientSummary.pendingItems.length}`}
                  expanded={expandedSections.pending}
                  onToggle={() => toggleSection("pending")}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-xs">
                          <th className="text-left py-2 px-2">Código</th>
                          <th className="text-left py-2 px-2">Produto</th>
                          <th className="text-right py-2 px-2">Quantidade</th>
                          <th className="text-left py-2 px-2">Pedido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientSummary.pendingItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-1.5 px-2 font-mono text-xs text-slate-700">{item.codigo}</td>
                            <td className="py-1.5 px-2 text-xs text-slate-600 truncate max-w-[200px]">{item.descricao}</td>
                            <td className="py-1.5 px-2 text-right text-xs text-slate-700">{Math.round(item.quantidade).toLocaleString("pt-BR")}</td>
                            <td className="py-1.5 px-2 font-mono text-xs text-slate-600">{item.pedido}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* Collapsible section sub-component - light theme */
function SectionCard({
  title,
  icon,
  expanded,
  onToggle,
  badge,
  variant = "default",
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  variant?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border overflow-hidden ${
      variant === "danger" ? "border-red-200 bg-red-50/30" : "border-slate-200 bg-slate-50/30"
    }`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm text-slate-700">{title}</span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-medium">
              {badge}
            </span>
          )}
        </div>
        {expanded
          ? <ChevronDown className="h-4 w-4 text-slate-400" />
          : <ChevronRight className="h-4 w-4 text-slate-400" />
        }
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-200">
          <div className="pt-3">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

/* Card expansível que agrupa títulos do mesmo documento/pedido - REDESENHADO com grid alinhado */
function TituloGroupCard({ group }: {
  group: {
    documento: string;
    isPedido?: boolean;
    pedidoNumero?: string;
    estadoPedido?: string;
    isFaturado?: boolean;
    nfVinculada?: string[];
    valorTotalGrupo: number;
    valorRecebidoGrupo: number;
    parcelas: number;
    titulos: Array<{
      id: number;
      documento: string;
      nfNumero?: string;
      emissao: string;
      vencimento: string;
      liquidacao: string;
      valorOriginal: number;
      valorRecebido: number;
      estado: string;
      parcela: number | null;
      totalParcelas: number | null;
      referente: string;
      bancoNome: string;
    }>;
  };
}) {
  const [expanded, setExpanded] = useState(false);

  // Determine overall status of the group
  const allRecebido = group.titulos.every(t => t.estado === "RECEBIDO");
  const someEmitido = group.titulos.some(t => t.estado === "EMITIDO");
  const pedidoFaturado = group.isFaturado === true;
  
  let groupStatus: "RECEBIDO" | "EMITIDO" | "MISTO";
  if (!pedidoFaturado) {
    groupStatus = "EMITIDO";
  } else {
    groupStatus = allRecebido ? "RECEBIDO" : someEmitido ? "EMITIDO" : "MISTO";
  }

  // Get banco info from first titulo that has it
  const bancoInfo = group.titulos.find(t => t.bancoNome)?.bancoNome || "";

  // Get earliest vencimento for "days until" badge
  const earliestVenc = group.titulos
    .filter(t => t.estado === "EMITIDO" && t.vencimento)
    .map(t => t.vencimento)
    .sort()[0];
  const daysUntilVenc = earliestVenc ? daysUntil(earliestVenc) : null;

  // Colors based on status
  const statusColor = groupStatus === "RECEBIDO"
    ? "border-emerald-200 bg-emerald-50/50"
    : groupStatus === "EMITIDO"
    ? "border-amber-200 bg-amber-50/50"
    : "border-slate-200 bg-slate-50/50";

  const statusBadgeColor = groupStatus === "RECEBIDO"
    ? "bg-emerald-100 text-emerald-700"
    : groupStatus === "EMITIDO"
    ? "bg-amber-100 text-amber-700"
    : "bg-slate-100 text-slate-600";

  const statusLabel = groupStatus === "RECEBIDO"
    ? "Pago"
    : groupStatus === "EMITIDO"
    ? "Em Aberto"
    : "Parcial";

  // Build document label - show NF, Pedido, or referência (NEVER "Título avulso")
  const buildDocLabel = () => {
    const parts: React.ReactNode[] = [];
    
    if (group.isPedido && group.pedidoNumero) {
      parts.push(<span key="ped" className="text-slate-700">Pedido <strong>{group.pedidoNumero}</strong></span>);
    } else if (group.isPedido && group.documento) {
      parts.push(<span key="ped" className="text-slate-700">Pedido <strong>{group.documento}</strong></span>);
    } else if (group.documento) {
      // Se o documento é um número, mostrar como NF
      parts.push(<span key="doc" className="text-slate-700">NF <strong>{group.documento}</strong></span>);
    } else {
      // Sem documento vinculado - buscar referência dos títulos
      const firstRef = group.titulos.find(t => t.referente)?.referente;
      if (firstRef) {
        // Truncar referência longa e mostrar de forma limpa
        const refClean = firstRef.length > 50 ? firstRef.substring(0, 47) + "..." : firstRef;
        parts.push(<span key="ref" className="text-slate-600 text-xs" style={{ fontStyle: 'normal' }}>{refClean}</span>);
      } else {
        parts.push(<span key="titulo" className="text-slate-500">Título s/nº</span>);
      }
    }

    // Add NF links
    if (group.nfVinculada && group.nfVinculada.length > 0) {
      parts.push(
        <span key="arrow" className="text-slate-400 mx-1">&rarr;</span>,
        <span key="nfs" className="text-emerald-600 font-medium">
          NF {group.nfVinculada.join(", ")}
        </span>
      );
    }

    return parts;
  };

  return (
    <div className={`rounded-lg border ${statusColor} overflow-hidden transition-all`}>
      {/* Header - clickable to expand - GRID ALINHADO */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 hover:bg-white/50 transition-colors"
      >
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: 'auto 1fr auto auto auto auto auto' }}>
          {/* Col 1: Icon + Doc label */}
          <div className="flex items-center gap-2 min-w-0">
            <FileText className={`h-4 w-4 shrink-0 ${groupStatus === "RECEBIDO" ? "text-emerald-600" : "text-amber-600"}`} />
            <span className="font-mono text-sm font-semibold truncate">
              {buildDocLabel()}
            </span>
          </div>

          {/* Col 2: spacer */}
          <div />

          {/* Col 3: Status badge - fixed width */}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap text-center ${statusBadgeColor}`} style={{ minWidth: '60px' }}>
            {statusLabel}
          </span>

          {/* Col 4: Parcelas badge - fixed width */}
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap text-center bg-slate-100 text-slate-600" style={{ minWidth: '55px' }}>
            {group.parcelas} título{group.parcelas > 1 ? 's' : ''}
          </span>

          {/* Col 5: Days badge - fixed width */}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap text-center flex items-center justify-center gap-1 ${
            groupStatus !== "EMITIDO" || daysUntilVenc === null ? "invisible" :
            daysUntilVenc < 0 ? "bg-red-100 text-red-700" :
            daysUntilVenc <= 7 ? "bg-orange-100 text-orange-700" :
            daysUntilVenc <= 30 ? "bg-yellow-100 text-yellow-700" :
            "bg-slate-100 text-slate-600"
          }`} style={{ minWidth: '65px' }}>
            <Clock className="h-2.5 w-2.5" />
            {daysUntilVenc !== null && daysUntilVenc < 0 ? `${Math.abs(daysUntilVenc)}d atraso` :
             daysUntilVenc === 0 ? "Vence hoje" :
             daysUntilVenc !== null ? `${daysUntilVenc}d` : ""}
          </span>

          {/* Col 6: Value - fixed width right-aligned */}
          <div className="text-right" style={{ minWidth: '100px' }}>
            <span className="text-sm font-bold text-slate-800">{formatCurrency(group.valorTotalGrupo)}</span>
          </div>

          {/* Col 7: Chevron */}
          <div className="flex items-center justify-center" style={{ width: '20px' }}>
            {expanded
              ? <ChevronUp className="h-4 w-4 text-slate-400" />
              : <ChevronDown className="h-4 w-4 text-slate-400" />
            }
          </div>
        </div>

        {/* Banco info row (secondary) */}
        {bancoInfo && (
          <div className="flex items-center gap-1 mt-1 ml-6">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium flex items-center gap-1">
              <Landmark className="h-2.5 w-2.5" />
              {bancoInfo.replace("Banco ", "").replace(" S.A.", "").substring(0, 25)}
            </span>
          </div>
        )}
      </button>

      {/* Expanded content - individual parcelas/títulos */}
      {expanded && (
        <div className="border-t border-slate-200 bg-white">
          <div className="px-3 pt-2 pb-1 flex items-center gap-2 text-xs text-slate-500">
            <CreditCard className="h-3 w-3" />
            <span>Forma: <strong className="text-slate-700">{bancoInfo ? "Boleto Bancário" : "Outros"}</strong></span>
            {bancoInfo && (
              <>
                <span className="text-slate-300">|</span>
                <Landmark className="h-3 w-3" />
                <span>{bancoInfo}</span>
              </>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[11px]">
                  <th className="text-left py-1.5 px-3">Parcela</th>
                  <th className="text-left py-1.5 px-3">NF/Doc</th>
                  <th className="text-left py-1.5 px-3">Referência</th>
                  <th className="text-left py-1.5 px-3">Emissão</th>
                  <th className="text-left py-1.5 px-3">Vencimento</th>
                  <th className="text-left py-1.5 px-3">Liquidação</th>
                  <th className="text-right py-1.5 px-3">Valor</th>
                  <th className="text-left py-1.5 px-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {group.titulos
                  .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""))
                  .map((t, tIdx) => {
                    const days = t.estado === "EMITIDO" ? daysUntil(t.vencimento) : null;
                    return (
                      <tr key={tIdx} className={`border-b border-slate-100 last:border-0 ${
                        t.estado === "RECEBIDO" ? "bg-emerald-50/30 hover:bg-emerald-50" : "hover:bg-slate-50"
                      }`}>
                        <td className="py-1.5 px-3 text-xs text-slate-600">
                          {t.parcela && t.totalParcelas ? `${t.parcela}/${t.totalParcelas}` : t.parcela || "Única"}
                        </td>
                        <td className="py-1.5 px-3 text-xs text-slate-600 font-mono">
                          {t.nfNumero || t.documento || "-"}
                        </td>
                        <td className="py-1.5 px-3 text-xs text-slate-500 max-w-[200px] truncate" title={t.referente || ""}>
                          {t.referente ? (t.referente.length > 35 ? t.referente.substring(0, 32) + "..." : t.referente) : "-"}
                        </td>
                        <td className="py-1.5 px-3 text-xs text-slate-600">{formatDate(t.emissao)}</td>
                        <td className="py-1.5 px-3 text-xs font-medium">
                          <span className={`${
                            days !== null && days < 0 ? "text-red-600" :
                            days !== null && days <= 7 ? "text-orange-600" :
                            "text-slate-600"
                          }`}>
                            {formatDate(t.vencimento)}
                          </span>
                          {days !== null && days < 0 && (
                            <span className="ml-1 text-[9px] text-red-500 font-normal">({Math.abs(days)}d atraso)</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-xs text-slate-600">{t.liquidacao ? formatDate(t.liquidacao) : "-"}</td>
                        <td className="py-1.5 px-3 text-right text-xs font-medium text-slate-700">{formatCurrency(t.valorOriginal)}</td>
                        <td className="py-1.5 px-3">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            (!pedidoFaturado)
                              ? "bg-amber-100 text-amber-700"
                              : t.estado === "RECEBIDO" ? "bg-emerald-100 text-emerald-700"
                              : t.estado === "EMITIDO" ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {(!pedidoFaturado)
                              ? "Em Aberto"
                              : t.estado === "RECEBIDO" ? "Pago" : t.estado === "EMITIDO" ? "Em Aberto" : t.estado}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
