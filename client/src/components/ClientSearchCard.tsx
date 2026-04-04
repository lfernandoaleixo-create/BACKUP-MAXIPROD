import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  ChevronUp,
} from "lucide-react";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

type SectionKey = "orders" | "receivables" | "overdue" | "products" | "history" | "titles" | "pending";

export function ClientSearchCard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    orders: true,
    receivables: true,
    overdue: true,
    products: false,
    history: false,
    titles: false,
    pending: false,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: searchResults } = trpc.sales.searchClients.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 2 }
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

  const toggleSection = (key: SectionKey) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const clearSelection = () => {
    setSelectedClient(null);
    setSearchQuery("");
  };

  return (
    <Card className="border-blue-500/30 bg-gradient-to-br from-blue-950/20 to-slate-900/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5 text-blue-400" />
          Consulta de Cliente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Search Input */}
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite o nome do cliente..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
                if (e.target.value.length < 2) setSelectedClient(null);
              }}
              className="pl-10 pr-10 bg-slate-800/50 border-slate-700"
            />
            {selectedClient && (
              <button
                onClick={clearSelection}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Dropdown Results */}
          {showDropdown && searchResults && searchResults.length > 0 && !selectedClient && (
            <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((client, idx) => (
                <button
                  key={idx}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-700/50 flex items-center justify-between border-b border-slate-700/50 last:border-0"
                  onClick={() => {
                    setSelectedClient(client.cliente);
                    setSearchQuery(client.cliente || "");
                    setShowDropdown(false);
                  }}
                >
                  <div>
                    <div className="font-medium text-sm">{client.cliente}</div>
                    {client.clienteApelido && (
                      <div className="text-xs text-muted-foreground">{client.clienteApelido}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {client.uf && <Badge variant="outline" className="text-xs">{client.uf}</Badge>}
                    {client.crmSegmento && <Badge variant="secondary" className="text-xs">{client.crmSegmento}</Badge>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoadingSummary && selectedClient && (
          <div className="mt-6 flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            <span className="ml-3 text-muted-foreground">Carregando dados do cliente...</span>
          </div>
        )}

        {/* Client Summary */}
        {clientSummary && selectedClient && !isLoadingSummary && (
          <div className="mt-4 space-y-4">
            {/* Client Info Header */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-400" />
                    {clientSummary.clientInfo.nome}
                  </h3>
                  {clientSummary.clientInfo.razaoSocial && (
                    <p className="text-sm text-muted-foreground mt-0.5">{clientSummary.clientInfo.razaoSocial}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {clientSummary.clientInfo.uf && <Badge variant="outline">{clientSummary.clientInfo.uf}</Badge>}
                  {clientSummary.clientInfo.crmSegmento && <Badge className="bg-blue-600">{clientSummary.clientInfo.crmSegmento}</Badge>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 text-sm text-muted-foreground">
                {clientSummary.clientInfo.endereco && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{clientSummary.clientInfo.endereco}</span>
                  </div>
                )}
                {clientSummary.clientInfo.telefone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {clientSummary.clientInfo.telefone}
                  </div>
                )}
                {clientSummary.clientInfo.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {clientSummary.clientInfo.email}
                  </div>
                )}
                {clientSummary.clientInfo.clienteDesde && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    Cliente desde {formatDate(clientSummary.clientInfo.clienteDesde)}
                  </div>
                )}
              </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <ShoppingCart className="h-3.5 w-3.5 text-blue-400" />
                  Total Pedidos
                </div>
                <div className="text-xl font-bold">{clientSummary.orders.totalPedidos}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(clientSummary.orders.valorTotalPedidos)}</div>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-green-400" />
                  Faturado
                </div>
                <div className="text-xl font-bold text-green-400">{formatCurrency(clientSummary.orders.valorFaturado)}</div>
                <div className="text-xs text-muted-foreground">{clientSummary.orders.pedidosFaturados} pedidos</div>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <FileText className="h-3.5 w-3.5 text-yellow-400" />
                  Em Aberto
                </div>
                <div className="text-xl font-bold text-yellow-400">{formatCurrency(clientSummary.receivables.valorEmAberto)}</div>
                <div className="text-xs text-muted-foreground">{clientSummary.receivables.titulosEmAberto} títulos</div>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  Inadimplência
                </div>
                <div className="text-xl font-bold text-red-400">{formatCurrency(clientSummary.overdue.valorVencido)}</div>
                <div className="text-xs text-muted-foreground">
                  {clientSummary.overdue.titulosVencidos} títulos | {clientSummary.overdue.diasAtrasoMedio}d médio
                </div>
              </div>
            </div>

            {/* Collapsible Sections */}

            {/* Orders Section */}
            <CollapsibleSection
              title="Pedidos"
              icon={<ShoppingCart className="h-4 w-4 text-blue-400" />}
              expanded={expandedSections.orders}
              onToggle={() => toggleSection("orders")}
              badge={`${clientSummary.orders.totalPedidos}`}
            >
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center p-2 bg-slate-900/50 rounded">
                  <div className="text-xs text-muted-foreground">A Faturar</div>
                  <div className="font-semibold text-yellow-400">{clientSummary.orders.pedidosAFaturar}</div>
                  <div className="text-xs text-muted-foreground">{formatCurrency(clientSummary.orders.valorAFaturar)}</div>
                </div>
                <div className="text-center p-2 bg-slate-900/50 rounded">
                  <div className="text-xs text-muted-foreground">Faturados</div>
                  <div className="font-semibold text-green-400">{clientSummary.orders.pedidosFaturados}</div>
                  <div className="text-xs text-muted-foreground">{formatCurrency(clientSummary.orders.valorFaturado)}</div>
                </div>
                <div className="text-center p-2 bg-slate-900/50 rounded">
                  <div className="text-xs text-muted-foreground">Em Digitação</div>
                  <div className="font-semibold text-slate-400">{clientSummary.orders.pedidosEmDigitacao}</div>
                  <div className="text-xs text-muted-foreground">{formatCurrency(clientSummary.orders.valorEmDigitacao)}</div>
                </div>
              </div>
              {clientSummary.recentOrders.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/50 text-muted-foreground text-xs">
                        <th className="text-left py-2 px-2">Pedido</th>
                        <th className="text-left py-2 px-2">Data</th>
                        <th className="text-right py-2 px-2">Valor</th>
                        <th className="text-left py-2 px-2">Status</th>
                        <th className="text-right py-2 px-2">Itens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientSummary.recentOrders.map((order, idx) => (
                        <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="py-1.5 px-2 font-mono text-xs">{order.pedido}</td>
                          <td className="py-1.5 px-2 text-xs">{formatDate(order.data)}</td>
                          <td className="py-1.5 px-2 text-right text-xs">{formatCurrency(order.valor)}</td>
                          <td className="py-1.5 px-2">
                            <Badge variant={order.status === "Aprovado" ? "default" : "secondary"} className="text-xs">
                              {order.status}
                            </Badge>
                          </td>
                          <td className="py-1.5 px-2 text-right text-xs">{order.itens}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CollapsibleSection>

            {/* Receivables Section */}
            <CollapsibleSection
              title="Financeiro"
              icon={<DollarSign className="h-4 w-4 text-green-400" />}
              expanded={expandedSections.receivables}
              onToggle={() => toggleSection("receivables")}
              badge={`${clientSummary.receivables.totalTitulos} títulos`}
            >
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center p-2 bg-slate-900/50 rounded">
                  <div className="text-xs text-muted-foreground">Em Aberto</div>
                  <div className="font-semibold text-yellow-400">{formatCurrency(clientSummary.receivables.valorEmAberto)}</div>
                  <div className="text-xs text-muted-foreground">{clientSummary.receivables.titulosEmAberto} títulos</div>
                </div>
                <div className="text-center p-2 bg-slate-900/50 rounded">
                  <div className="text-xs text-muted-foreground">Recebido</div>
                  <div className="font-semibold text-green-400">{formatCurrency(clientSummary.receivables.valorRecebido)}</div>
                  <div className="text-xs text-muted-foreground">{clientSummary.receivables.titulosRecebidos} títulos</div>
                </div>
                <div className="text-center p-2 bg-slate-900/50 rounded">
                  <div className="text-xs text-muted-foreground">Total Títulos</div>
                  <div className="font-semibold">{clientSummary.receivables.totalTitulos}</div>
                </div>
              </div>
            </CollapsibleSection>

            {/* Overdue Section */}
            {clientSummary.overdue.titulosVencidos > 0 && (
              <CollapsibleSection
                title="Inadimplência"
                icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
                expanded={expandedSections.overdue}
                onToggle={() => toggleSection("overdue")}
                badge={`${clientSummary.overdue.titulosVencidos} vencidos`}
                variant="danger"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-2 bg-red-950/30 rounded border border-red-900/30">
                    <div className="text-xs text-muted-foreground">Valor Vencido</div>
                    <div className="font-semibold text-red-400">{formatCurrency(clientSummary.overdue.valorVencido)}</div>
                  </div>
                  <div className="text-center p-2 bg-red-950/30 rounded border border-red-900/30">
                    <div className="text-xs text-muted-foreground">Títulos Vencidos</div>
                    <div className="font-semibold text-red-400">{clientSummary.overdue.titulosVencidos}</div>
                  </div>
                  <div className="text-center p-2 bg-red-950/30 rounded border border-red-900/30">
                    <div className="text-xs text-muted-foreground">Atraso Médio</div>
                    <div className="font-semibold text-red-400">{clientSummary.overdue.diasAtrasoMedio} dias</div>
                  </div>
                  <div className="text-center p-2 bg-red-950/30 rounded border border-red-900/30">
                    <div className="text-xs text-muted-foreground">Maior Atraso</div>
                    <div className="font-semibold text-red-400">{clientSummary.overdue.diasAtrasoMax} dias</div>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {/* Top Products */}
            <CollapsibleSection
              title="Produtos Mais Comprados"
              icon={<Package className="h-4 w-4 text-purple-400" />}
              expanded={expandedSections.products}
              onToggle={() => toggleSection("products")}
              badge={`${clientSummary.topProducts.length}`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50 text-muted-foreground text-xs">
                      <th className="text-left py-2 px-2">Código</th>
                      <th className="text-left py-2 px-2">Produto</th>
                      <th className="text-right py-2 px-2">Qtd</th>
                      <th className="text-right py-2 px-2">Valor Total</th>
                      <th className="text-right py-2 px-2">Pedidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientSummary.topProducts.map((product, idx) => (
                      <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-1.5 px-2 font-mono text-xs">{product.codigo}</td>
                        <td className="py-1.5 px-2 text-xs truncate max-w-[200px]">{product.descricao}</td>
                        <td className="py-1.5 px-2 text-right text-xs">{Math.round(product.qtd).toLocaleString("pt-BR")}</td>
                        <td className="py-1.5 px-2 text-right text-xs">{formatCurrency(product.valor)}</td>
                        <td className="py-1.5 px-2 text-right text-xs">{product.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>

            {/* Monthly Evolution */}
            {clientSummary.monthlyEvolution.length > 0 && (
              <CollapsibleSection
                title="Evolução Mensal"
                icon={<TrendingUp className="h-4 w-4 text-cyan-400" />}
                expanded={expandedSections.history}
                onToggle={() => toggleSection("history")}
                badge={`${clientSummary.monthlyEvolution.length} meses`}
              >
                <div className="space-y-1.5">
                  {clientSummary.monthlyEvolution.map((m, idx) => {
                    const maxVal = Math.max(...clientSummary.monthlyEvolution.map(x => x.valor));
                    const pct = maxVal > 0 ? (m.valor / maxVal) * 100 : 0;
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">{m.month}</span>
                        <div className="flex-1 bg-slate-800/50 rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          >
                            <span className="text-[10px] font-medium whitespace-nowrap">{formatCurrency(m.valor)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            )}

            {/* Recent Titles */}
            <CollapsibleSection
              title="Últimos Títulos"
              icon={<FileText className="h-4 w-4 text-amber-400" />}
              expanded={expandedSections.titles}
              onToggle={() => toggleSection("titles")}
              badge={`${clientSummary.recentReceivables.length}`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50 text-muted-foreground text-xs">
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
                      <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-1.5 px-2 font-mono text-xs">{r.documento}</td>
                        <td className="py-1.5 px-2 text-xs">{formatDate(r.vencimento)}</td>
                        <td className="py-1.5 px-2 text-right text-xs">{formatCurrency(r.valorOriginal)}</td>
                        <td className="py-1.5 px-2 text-right text-xs">{formatCurrency(r.valorRecebido)}</td>
                        <td className="py-1.5 px-2">
                          <Badge
                            variant={r.estado === "RECEBIDO" ? "default" : "secondary"}
                            className={`text-xs ${r.estado === "EMITIDO" ? "bg-yellow-600/30 text-yellow-400" : "bg-green-600/30 text-green-400"}`}
                          >
                            {r.estado}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-2 text-xs">{r.parcela}/{r.totalParcelas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>

            {/* Pending Items */}
            {clientSummary.pendingItems.length > 0 && (
              <CollapsibleSection
                title="Itens Pendentes (Estoque)"
                icon={<Package className="h-4 w-4 text-orange-400" />}
                expanded={expandedSections.pending}
                onToggle={() => toggleSection("pending")}
                badge={`${clientSummary.pendingItems.length}`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/50 text-muted-foreground text-xs">
                        <th className="text-left py-2 px-2">Código</th>
                        <th className="text-left py-2 px-2">Produto</th>
                        <th className="text-right py-2 px-2">Quantidade</th>
                        <th className="text-left py-2 px-2">Pedido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientSummary.pendingItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="py-1.5 px-2 font-mono text-xs">{item.codigo}</td>
                          <td className="py-1.5 px-2 text-xs truncate max-w-[200px]">{item.descricao}</td>
                          <td className="py-1.5 px-2 text-right text-xs">{Math.round(item.quantidade).toLocaleString("pt-BR")}</td>
                          <td className="py-1.5 px-2 font-mono text-xs">{item.pedido}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* Empty state */}
        {!selectedClient && !isLoadingSummary && (
          <div className="mt-6 text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Digite o nome de um cliente para ver o resumo completo</p>
            <p className="text-xs mt-1">Pedidos, pagamentos, inadimplência, produtos e mais</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CollapsibleSection({
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
    <div className={`rounded-lg border ${variant === "danger" ? "border-red-900/50 bg-red-950/10" : "border-slate-700/30 bg-slate-800/20"}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-800/30 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
          {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <Separator className="mb-3" />
          {children}
        </div>
      )}
    </div>
  );
}
