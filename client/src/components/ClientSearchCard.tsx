/**
 * Card: Consulta de Cliente
 * Busca por nome com autocomplete e exibe resumo completo do cliente
 * 4 cards de status: Em Digitação, A Aprovar, Aprovado (A Faturar), Faturado
 * Cores: Faturado=verde, Aprovado(A Faturar)=amarelo alaranjado, A Aprovar=laranja, Em Digitação=cinza
 * Títulos: EMITIDO = em aberto (aguardando pagamento), RECEBIDO = já pago
 */

import { useState, useRef, useEffect } from "react";
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
    setSearchQuery("");
    setShowDropdown(false);
    setExpanded(true);
    inputRef.current?.blur();
  };

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

              {/* 4 KPI Cards: Em Digitação, A Aprovar, Aprovado (A Faturar), Faturado */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <ClipboardCheck className="h-3.5 w-3.5 text-orange-600" />
                    A Aprovar
                  </div>
                  <div className="text-xl font-bold text-orange-700">{clientSummary.orders.pedidosAprovar || 0}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatCurrency(clientSummary.orders.valorAprovar || 0)}</div>
                </div>
                {/* Aprovado (A Faturar) - Amarelo Alaranjado */}
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    Aprovado (A Faturar)
                  </div>
                  <div className="text-xl font-bold text-amber-700">{clientSummary.orders.pedidosAFaturar}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatCurrency(clientSummary.orders.valorAFaturar)}</div>
                </div>
                {/* Faturado - Verde */}
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Faturado
                  </div>
                  <div className="text-xl font-bold text-emerald-700">{clientSummary.orders.pedidosFaturados}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatCurrency(clientSummary.orders.valorFaturado)}</div>
                </div>
              </div>

              {/* Resumo Financeiro: Títulos + Inadimplência */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Títulos Em Aberto (EMITIDO) */}
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <Receipt className="h-3.5 w-3.5 text-amber-600" />
                    Títulos Em Aberto
                  </div>
                  <div className="text-xl font-bold text-amber-700">{clientSummary.receivables.parcelasEmAberto || clientSummary.receivables.titulosEmAberto}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatCurrency(clientSummary.receivables.valorEmAberto)}</div>
                  <div className="text-[10px] text-amber-500 mt-1">
                    Aguardando pagamento
                  </div>
                </div>
                {/* Títulos Recebidos (RECEBIDO) */}
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Títulos Recebidos
                  </div>
                  <div className="text-xl font-bold text-emerald-700">{clientSummary.receivables.parcelasRecebidas || clientSummary.receivables.titulosRecebidos}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatCurrency(clientSummary.receivables.valorRecebido)}</div>
                  <div className="text-[10px] text-emerald-500 mt-1">
                    Pagamento confirmado
                  </div>
                </div>
                {/* Inadimplência */}
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
                  <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Inadimplência
                    </div>
                    <div className="text-xl font-bold text-emerald-600">Nenhuma</div>
                    <div className="text-xs text-slate-500 mt-0.5">Cliente em dia</div>
                  </div>
                )}
                {/* Total Pedidos */}
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
                    Total Pedidos
                  </div>
                  <div className="text-xl font-bold text-blue-700">{clientSummary.orders.totalPedidos}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatCurrency(clientSummary.orders.valorTotalPedidos)}</div>
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

              {/* Títulos (Contas a Receber) */}
              <SectionCard
                title="Títulos (Contas a Receber)"
                icon={<FileText className="h-4 w-4 text-amber-600" />}
                badge={`${clientSummary.groupedReceivables?.length || 0} documentos`}
                expanded={expandedSections.titles}
                onToggle={() => toggleSection("titles")}
              >
                {/* Legenda explicativa */}
                <div className="mb-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-500">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                      <strong className="text-amber-700">EMITIDO</strong> = Título em aberto, aguardando pagamento
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                      <strong className="text-emerald-700">RECEBIDO</strong> = Título pago/recebido
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Receipt className="h-3 w-3 text-slate-400" />
                      Cada boleto = 1 título (parcela)
                    </div>
                  </div>
                </div>

                {clientSummary.groupedReceivables && clientSummary.groupedReceivables.length > 0 ? (
                  <div className="space-y-2">
                    {clientSummary.groupedReceivables.map((group, gIdx) => (
                      <TituloGroupCard key={gIdx} group={group} />
                    ))}
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

/* Card expansível que agrupa títulos do mesmo documento/pedido */
function TituloGroupCard({ group }: {
  group: {
    documento: string;
    valorTotalGrupo: number;
    valorRecebidoGrupo: number;
    parcelas: number;
    titulos: Array<{
      id: number;
      documento: string;
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
  const groupStatus = allRecebido ? "RECEBIDO" : someEmitido ? "EMITIDO" : "MISTO";

  // Get banco info from first titulo that has it
  const bancoInfo = group.titulos.find(t => t.bancoNome)?.bancoNome || "";

  const formaPagamento = bancoInfo ? "Boleto Bancário" : "Outros";

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

  return (
    <div className={`rounded-lg border ${statusColor} overflow-hidden transition-all`}>
      {/* Header - clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <FileText className={`h-4 w-4 ${groupStatus === "RECEBIDO" ? "text-emerald-600" : "text-amber-600"}`} />
            <span className="font-mono text-sm font-semibold text-slate-700">
              Doc {group.documento || "S/N"}
            </span>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusBadgeColor}`}>
            {statusLabel}
          </span>
          {group.parcelas > 1 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
              {group.parcelas} título{group.parcelas > 1 ? 's' : ''} (boletos)
            </span>
          )}
          {group.parcelas === 1 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
              1 título
            </span>
          )}
          {bancoInfo && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium flex items-center gap-1">
              <Landmark className="h-2.5 w-2.5" />
              {bancoInfo.replace("Banco ", "").replace(" S.A.", "").substring(0, 20)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-sm font-bold text-slate-800">{formatCurrency(group.valorTotalGrupo)}</div>
            {group.valorRecebidoGrupo > 0 && (
              <div className="text-[10px] text-emerald-600">Recebido: {formatCurrency(group.valorRecebidoGrupo)}</div>
            )}
          </div>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-slate-400" />
            : <ChevronDown className="h-4 w-4 text-slate-400" />
          }
        </div>
      </button>

      {/* Expanded content - individual parcelas/títulos */}
      {expanded && (
        <div className="border-t border-slate-200 bg-white">
          <div className="px-3 pt-2 pb-1 flex items-center gap-2 text-xs text-slate-500">
            <CreditCard className="h-3 w-3" />
            <span>Forma: <strong className="text-slate-700">{formaPagamento}</strong></span>
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
                  <th className="text-left py-1.5 px-3">Título</th>
                  <th className="text-left py-1.5 px-3">Emissão</th>
                  <th className="text-left py-1.5 px-3">Vencimento</th>
                  <th className="text-left py-1.5 px-3">Liquidação</th>
                  <th className="text-right py-1.5 px-3">Valor</th>
                  <th className="text-right py-1.5 px-3">Recebido</th>
                  <th className="text-left py-1.5 px-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {group.titulos.map((t, tIdx) => (
                  <tr key={tIdx} className={`border-b border-slate-100 last:border-0 ${
                    t.estado === "RECEBIDO" ? "bg-emerald-50/30 hover:bg-emerald-50" : "hover:bg-slate-50"
                  }`}>
                    <td className="py-1.5 px-3 text-xs text-slate-600">
                      {t.parcela && t.totalParcelas ? `${t.parcela}/${t.totalParcelas}` : t.parcela || "Única"}
                    </td>
                    <td className="py-1.5 px-3 text-xs text-slate-600">{formatDate(t.emissao)}</td>
                    <td className="py-1.5 px-3 text-xs text-slate-600 font-medium">{formatDate(t.vencimento)}</td>
                    <td className="py-1.5 px-3 text-xs text-slate-600">{t.liquidacao ? formatDate(t.liquidacao) : "-"}</td>
                    <td className="py-1.5 px-3 text-right text-xs font-medium text-slate-700">{formatCurrency(t.valorOriginal)}</td>
                    <td className="py-1.5 px-3 text-right text-xs text-slate-600">{formatCurrency(t.valorRecebido)}</td>
                    <td className="py-1.5 px-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        t.estado === "RECEBIDO" ? "bg-emerald-100 text-emerald-700" :
                        t.estado === "EMITIDO" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {t.estado === "RECEBIDO" ? "Pago" : t.estado === "EMITIDO" ? "Em Aberto" : t.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
