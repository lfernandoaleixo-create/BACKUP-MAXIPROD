/**
 * Card: Consulta de Cliente
 * Busca por nome com autocomplete e exibe resumo completo do cliente
 * Padrão visual idêntico aos outros cards da aba Vendas (Evolução Diária, Pedidos Faturados)
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
} from "lucide-react";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  // Handle ISO datetime strings like "2026-01-23T12:00:00.000-03:00"
  const clean = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const parts = clean.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export function ClientSearchCard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    orders: true,
    receivables: true,
    overdue: true,
    products: false,
    history: false,
    titles: false,
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
  };

  const handleSelectClient = (clientName: string) => {
    setSelectedClient(clientName);
    setSearchQuery(""); // Limpa o campo de busca após selecionar
    setShowDropdown(false);
    setExpanded(true);
    inputRef.current?.blur();
  };

  // Summary line for header
  const summaryText = clientSummary
    ? `${clientSummary.orders.totalPedidos} pedidos | ${formatCurrency(clientSummary.orders.valorTotalPedidos)}`
    : "";

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm relative" style={{ zIndex: showDropdown ? 100 : 'auto' }}>
      {/* Header - same pattern as Evolução Diária */}
      <div className="w-full flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <User className="w-6 h-6 text-blue-600 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide shrink-0">
            Consulta de Cliente
          </h3>

          {/* Search Input inline in header */}
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

            {/* Dropdown Results */}
            {showDropdown && searchResults && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((client, idx) => (
                  <button
                    key={idx}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-0 transition-colors"
                    onClick={() => handleSelectClient(client.cliente || "")}
                  >
                    <div>
                      <div className="font-medium text-sm text-slate-700">{client.cliente}</div>
                      {client.clienteApelido && (
                        <div className="text-xs text-slate-400">{client.clienteApelido}</div>
                      )}
                    </div>
                    <div className="flex gap-1.5">
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

              {/* KPI Cards Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
                    Total Pedidos
                  </div>
                  <div className="text-xl font-bold text-slate-800">{clientSummary.orders.totalPedidos}</div>
                  <div className="text-xs text-slate-500">{formatCurrency(clientSummary.orders.valorTotalPedidos)}</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                    Faturado
                  </div>
                  <div className="text-xl font-bold text-emerald-700">{formatCurrency(clientSummary.orders.valorFaturado)}</div>
                  <div className="text-xs text-slate-500">{clientSummary.orders.pedidosFaturados} pedidos</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <FileText className="h-3.5 w-3.5 text-amber-600" />
                    Em Aberto
                  </div>
                  <div className="text-xl font-bold text-amber-700">{formatCurrency(clientSummary.receivables.valorEmAberto)}</div>
                  <div className="text-xs text-slate-500">{clientSummary.receivables.titulosEmAberto} títulos</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                    Inadimplência
                  </div>
                  <div className="text-xl font-bold text-red-700">{formatCurrency(clientSummary.overdue.valorVencido)}</div>
                  <div className="text-xs text-slate-500">
                    {clientSummary.overdue.titulosVencidos} títulos | {clientSummary.overdue.diasAtrasoMedio}d médio
                  </div>
                </div>
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
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center p-2 bg-slate-50 rounded border border-slate-100">
                    <div className="text-xs text-slate-500">A Faturar</div>
                    <div className="font-semibold text-amber-600">{clientSummary.orders.pedidosAFaturar}</div>
                    <div className="text-xs text-slate-400">{formatCurrency(clientSummary.orders.valorAFaturar)}</div>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded border border-slate-100">
                    <div className="text-xs text-slate-500">Faturados</div>
                    <div className="font-semibold text-emerald-600">{clientSummary.orders.pedidosFaturados}</div>
                    <div className="text-xs text-slate-400">{formatCurrency(clientSummary.orders.valorFaturado)}</div>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded border border-slate-100">
                    <div className="text-xs text-slate-500">Em Digitação</div>
                    <div className="font-semibold text-slate-600">{clientSummary.orders.pedidosEmDigitacao}</div>
                    <div className="text-xs text-slate-400">{formatCurrency(clientSummary.orders.valorEmDigitacao)}</div>
                  </div>
                </div>
                {clientSummary.recentOrders.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-xs">
                          <th className="text-left py-2 px-2">Pedido</th>
                          <th className="text-left py-2 px-2">Data</th>
                          <th className="text-right py-2 px-2">Valor</th>
                          <th className="text-left py-2 px-2">Status</th>
                          <th className="text-right py-2 px-2">Itens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientSummary.recentOrders.map((order, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-1.5 px-2 font-mono text-xs text-slate-700">{order.pedido}</td>
                            <td className="py-1.5 px-2 text-xs text-slate-600">{formatDate(order.data)}</td>
                            <td className="py-1.5 px-2 text-right text-xs text-slate-700">{formatCurrency(order.valor)}</td>
                            <td className="py-1.5 px-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                order.status === "Aprovado" ? "bg-emerald-100 text-emerald-700" :
                                order.status === "Faturado" ? "bg-blue-100 text-blue-700" :
                                "bg-slate-100 text-slate-600"
                              }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-right text-xs text-slate-600">{order.itens}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              {/* Receivables Section */}
              <SectionCard
                title="Financeiro"
                icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
                badge={`${clientSummary.receivables.totalTitulos} títulos`}
                expanded={expandedSections.receivables}
                onToggle={() => toggleSection("receivables")}
              >
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center p-2 bg-slate-50 rounded border border-slate-100">
                    <div className="text-xs text-slate-500">Em Aberto</div>
                    <div className="font-semibold text-amber-600">{formatCurrency(clientSummary.receivables.valorEmAberto)}</div>
                    <div className="text-xs text-slate-400">{clientSummary.receivables.titulosEmAberto} títulos</div>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded border border-slate-100">
                    <div className="text-xs text-slate-500">Recebido</div>
                    <div className="font-semibold text-emerald-600">{formatCurrency(clientSummary.receivables.valorRecebido)}</div>
                    <div className="text-xs text-slate-400">{clientSummary.receivables.titulosRecebidos} títulos</div>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded border border-slate-100">
                    <div className="text-xs text-slate-500">Total Títulos</div>
                    <div className="font-semibold text-slate-700">{clientSummary.receivables.totalTitulos}</div>
                  </div>
                </div>
              </SectionCard>

              {/* Overdue Section */}
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

              {/* Recent Titles */}
              <SectionCard
                title="Últimos Títulos"
                icon={<FileText className="h-4 w-4 text-amber-600" />}
                badge={`${clientSummary.recentReceivables.length}`}
                expanded={expandedSections.titles}
                onToggle={() => toggleSection("titles")}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-xs">
                        <th className="text-left py-2 px-2">Documento</th>
                        <th className="text-left py-2 px-2">Vencimento</th>
                        <th className="text-right py-2 px-2">Valor</th>
                        <th className="text-right py-2 px-2">Recebido</th>
                        <th className="text-left py-2 px-2">Estado</th>
                        <th className="text-left py-2 px-2">Parcela</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientSummary.recentReceivables.map((r, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-1.5 px-2 font-mono text-xs text-slate-700">{r.documento}</td>
                          <td className="py-1.5 px-2 text-xs text-slate-600">{formatDate(r.vencimento)}</td>
                          <td className="py-1.5 px-2 text-right text-xs text-slate-700">{formatCurrency(r.valorOriginal)}</td>
                          <td className="py-1.5 px-2 text-right text-xs text-slate-700">{formatCurrency(r.valorRecebido)}</td>
                          <td className="py-1.5 px-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              r.estado === "RECEBIDO" ? "bg-emerald-100 text-emerald-700" :
                              r.estado === "EM ABERTO" ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {r.estado}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-xs text-slate-600">{r.parcela}/{r.totalParcelas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

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
