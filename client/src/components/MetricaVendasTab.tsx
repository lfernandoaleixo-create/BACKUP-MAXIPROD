import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { TrendingUp, Users, DollarSign, AlertTriangle, ChevronLeft, Trophy, Medal, Award, FileDown } from "lucide-react";
import { exportRankingVendasPdf, exportInadimplenciaPdf } from "@/lib/tabsPdfExport";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

type ViewMode = "ranking" | "detail" | "inadimplencia" | "inadimplenciaDetail";

const PERIOD_OPTIONS = [
  { label: "Mês Atual", value: "current" },
  { label: "Mês Anterior", value: "previous" },
];

function getDateRange(period: string) {
  const now = new Date();
  if (period === "previous") {
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      startDate: firstDay.toISOString().split("T")[0],
      endDate: lastDay.toISOString().split("T")[0],
    };
  }
  // current
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: firstDay.toISOString().split("T")[0],
    endDate: now.toISOString().split("T")[0],
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  // Handle ISO datetime strings like "2026-05-04T12:00:00.000-03:00"
  const datePart = dateStr.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export default function MetricaVendasTab() {
  const [period, setPeriod] = useState("current");
  const [view, setView] = useState<ViewMode>("ranking");
  const [selectedVendedor, setSelectedVendedor] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filterSegmento, setFilterSegmento] = useState<string>("all");

  const { startDate, endDate } = useMemo(() => getDateRange(period), [period]);

  const { data: ranking, isLoading: loadingRanking } = trpc.salesMetrics.getVendedorRanking.useQuery({ startDate, endDate });
  const { data: inadimplencia, isLoading: loadingInadimplencia } = trpc.salesMetrics.getInadimplenciaPorVendedor.useQuery();
  const { data: vendedorDetail, isLoading: loadingDetail } = trpc.salesMetrics.getVendedorDetail.useQuery(
    { vendedor: selectedVendedor, startDate, endDate },
    { enabled: !!selectedVendedor && view === "detail" }
  );

  const totalVendas = ranking?.reduce((sum, v) => sum + v.totalVendas, 0) || 0;
  const totalPedidos = ranking?.reduce((sum, v) => sum + v.qtdPedidos, 0) || 0;
  const totalInadimplentes = inadimplencia?.reduce((sum, v) => sum + v.qtdClientesInadimplentes, 0) || 0;
  const totalDevido = inadimplencia?.reduce((sum, v) => sum + v.totalDevido, 0) || 0;

  const periodLabel = period === "current" ? "Mês Atual" : "Mês Anterior";

  const goBack = () => {
    if (view === "detail") { setView("ranking"); setSelectedVendedor(""); setFilterEstado("all"); setFilterSegmento("all"); }
    else if (view === "inadimplenciaDetail") { setView("inadimplencia"); setSelectedVendedor(""); }
  };

  // Compute available filter options from vendedorDetail data
  const detailFilterOptions = useMemo(() => {
    if (!vendedorDetail) return { estados: [] as string[], segmentos: [] as string[] };
    const estadosSet = new Set<string>();
    const segmentosSet = new Set<string>();
    for (const c of vendedorDetail) {
      if (c.estadosConfiguraveis) c.estadosConfiguraveis.forEach((e: string) => estadosSet.add(e));
      if (c.segmentos) c.segmentos.forEach((s: string) => segmentosSet.add(s));
    }
    return { estados: Array.from(estadosSet).sort(), segmentos: Array.from(segmentosSet).sort() };
  }, [vendedorDetail]);

  // Filter vendedorDetail based on selected filters
  const filteredDetail = useMemo(() => {
    if (!vendedorDetail) return [];
    return vendedorDetail.filter((c) => {
      if (filterEstado !== "all" && c.estadosConfiguraveis && !c.estadosConfiguraveis.includes(filterEstado)) return false;
      if (filterSegmento !== "all" && c.segmentos && !c.segmentos.includes(filterSegmento)) return false;
      return true;
    });
  }, [vendedorDetail, filterEstado, filterSegmento]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Medal className="w-5 h-5 text-slate-400" />;
    if (index === 2) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-400">{index + 1}º</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header with period filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(view === "detail" || view === "inadimplenciaDetail") && (
            <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
          )}
          <h2 className="text-lg font-semibold text-slate-800">
            {view === "ranking" && "Ranking de Vendedores"}
            {view === "detail" && `Vendas de ${selectedVendedor}`}
            {view === "inadimplencia" && "Inadimplência por Vendedor"}
            {view === "inadimplenciaDetail" && `Inadimplência - ${selectedVendedor}`}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                period === opt.value
                  ? "bg-teal-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-teal-600" />
            <span className="text-xs text-slate-500">Total Vendas ({periodLabel})</span>
          </div>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(totalVendas)}</p>
          <p className="text-xs text-slate-400">{totalPedidos} pedidos</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-slate-500">Vendedores Ativos</span>
          </div>
          <p className="text-lg font-bold text-slate-800">{ranking?.length || 0}</p>
          <p className="text-xs text-slate-400">com vendas no período</p>
        </div>
        <div
          className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm cursor-pointer hover:border-red-200 transition-colors"
          onClick={() => setView("inadimplencia")}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-slate-500">Clientes Inadimplentes</span>
          </div>
          <p className="text-lg font-bold text-red-600">{totalInadimplentes}</p>
          <p className="text-xs text-slate-400">{formatCurrency(totalDevido)} em aberto</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-slate-500">Ticket Médio</span>
          </div>
          <p className="text-lg font-bold text-slate-800">
            {totalPedidos > 0 ? formatCurrency(totalVendas / totalPedidos) : "R$ 0,00"}
          </p>
          <p className="text-xs text-slate-400">por pedido</p>
        </div>
      </div>

      {/* Navigation tabs */}
      {(view === "ranking" || view === "inadimplencia") && (
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  if (view === "ranking") {
                    if (!ranking?.length) { toast.error("Nenhum dado para exportar."); return; }
                    exportRankingVendasPdf({ ranking: ranking.map(v => ({ vendedor: v.vendedor, totalVendas: v.totalVendas, qtdPedidos: v.qtdPedidos, qtdClientes: v.qtdClientes })), periodLabel });
                    toast.success("PDF de Ranking gerado!");
                  } else {
                    if (!inadimplencia?.length) { toast.error("Nenhum dado para exportar."); return; }
                    exportInadimplenciaPdf({ inadimplencia: inadimplencia as any });
                    toast.success("PDF de Inadimplência gerado!");
                  }
                }}
                size="sm"
                variant="outline"
                className="gap-1.5 ml-auto border-slate-300 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-all"
              >
                <FileDown className="w-3.5 h-3.5" />
                Exportar PDF
              </Button>
            </TooltipTrigger>
            <TooltipContent>Exportar dados da aba atual em PDF</TooltipContent>
          </Tooltip>
          <button
            onClick={() => setView("ranking")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              view === "ranking" ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-1" /> Ranking de Vendas
          </button>
          <button
            onClick={() => setView("inadimplencia")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              view === "inadimplencia" ? "bg-red-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <AlertTriangle className="w-4 h-4 inline mr-1" /> Inadimplência
          </button>
        </div>
      )}

      {/* Ranking View */}
      {view === "ranking" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {loadingRanking ? (
            <div className="p-8 text-center text-slate-400">Carregando ranking...</div>
          ) : !ranking || ranking.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Nenhuma venda encontrada no período</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {ranking.map((v, idx) => {
                const percentual = totalVendas > 0 ? (v.totalVendas / totalVendas) * 100 : 0;
                return (
                  <div
                    key={v.vendedor}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => { setSelectedVendedor(v.vendedor); setView("detail"); }}
                  >
                    <div className="flex-shrink-0">{getRankIcon(idx)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-slate-800 truncate">{v.vendedor}</p>
                        <p className="font-bold text-teal-700">{formatCurrency(v.totalVendas)}</p>
                      </div>
                      {v.vendedor === "Grupo Fox" && v.vendedoresReais && v.vendedoresReais.length > 0 && (
                        <p className="text-[11px] text-slate-400 italic -mt-0.5 mb-0.5">Vendido por: {v.vendedoresReais.join(", ")}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{v.qtdPedidos} pedidos</span>
                        <span>{v.qtdClientes} clientes</span>
                        <span>{percentual.toFixed(1)}% do total</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full transition-all"
                          style={{ width: `${percentual}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Detail View - Vendas por cliente */}
      {view === "detail" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {loadingDetail ? (
            <div className="p-8 text-center text-slate-400">Carregando detalhes...</div>
          ) : !vendedorDetail || vendedorDetail.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Nenhuma venda encontrada para {selectedVendedor} no período</div>
          ) : (
            <>
              {/* Filters */}
              {(detailFilterOptions.estados.length > 0 || detailFilterOptions.segmentos.length > 0) && (
                <div className="p-3 border-b border-slate-100 bg-slate-50/30 flex flex-wrap gap-2">
                  {detailFilterOptions.estados.length > 0 && (
                    <select
                      value={filterEstado}
                      onChange={(e) => setFilterEstado(e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-400"
                    >
                      <option value="all">Todos os Estados</option>
                      {detailFilterOptions.estados.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  )}
                  {detailFilterOptions.segmentos.length > 0 && (
                    <select
                      value={filterSegmento}
                      onChange={(e) => setFilterSegmento(e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-400"
                    >
                      <option value="all">Todos os Segmentos</option>
                      {detailFilterOptions.segmentos.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                  {(filterEstado !== "all" || filterSegmento !== "all") && (
                    <button
                      onClick={() => { setFilterEstado("all"); setFilterSegmento("all"); }}
                      className="text-[10px] text-teal-600 hover:text-teal-800 underline"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              )}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">{filteredDetail.length}</span> clientes{filteredDetail.length !== vendedorDetail.length ? ` (de ${vendedorDetail.length})` : " atendidos"}
                  </p>
                  <p className="text-sm font-semibold text-teal-700">
                    Total: {formatCurrency(filteredDetail.reduce((s, c) => s + c.totalVendas, 0))}
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                {filteredDetail.map((c) => (
                  <div key={c.cliente} className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="font-medium text-slate-800">{c.cliente}</p>
                      {selectedVendedor === "Grupo Fox" && c.vendedoresReais && c.vendedoresReais.length > 0 && (
                        <p className="text-[11px] text-slate-400 italic">Vendido por: {c.vendedoresReais.join(", ")}</p>
                      )}
                      <p className="text-xs text-slate-500">
                        {c.qtdPedidos} pedido{c.qtdPedidos > 1 ? "s" : ""} • Último: {formatDate(c.ultimoPedido)}
                      </p>
                      {(c.estadosConfiguraveis && c.estadosConfiguraveis.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.estadosConfiguraveis.map((ec: string) => (
                            <span key={ec} className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-100">{ec}</span>
                          ))}
                          {c.segmentos && c.segmentos.map((seg: string) => (
                            <span key={seg} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{seg}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="font-semibold text-slate-700 flex-shrink-0">{formatCurrency(c.totalVendas)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Inadimplência View */}
      {view === "inadimplencia" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {loadingInadimplencia ? (
            <div className="p-8 text-center text-slate-400">Carregando inadimplência...</div>
          ) : !inadimplencia || inadimplencia.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Nenhum cliente inadimplente encontrado</div>
          ) : (
            <>
              <div className="p-3 border-b border-slate-100 bg-red-50/30">
                <p className="text-xs text-slate-500">
                  Dados da aba Inadimplência (títulos vencidos até o último dia útil)
                </p>
              </div>
              <div className="divide-y divide-slate-50">
                {inadimplencia.map((v) => (
                  <div
                    key={v.vendedor}
                    className="flex items-center justify-between p-4 hover:bg-red-50/30 cursor-pointer transition-colors"
                    onClick={() => { setSelectedVendedor(v.vendedor); setView("inadimplenciaDetail"); }}
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{v.vendedor}</p>
                      <p className="text-xs text-slate-500">
                        {v.qtdClientesInadimplentes} cliente{v.qtdClientesInadimplentes > 1 ? "s" : ""} inadimplente{v.qtdClientesInadimplentes > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{formatCurrency(v.totalDevido)}</p>
                      <p className="text-xs text-slate-400">em aberto</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Inadimplência Detail View - Clientes do vendedor com valores */}
      {view === "inadimplenciaDetail" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {(() => {
            const vendedorData = inadimplencia?.find(v => v.vendedor === selectedVendedor);
            if (!vendedorData) return <div className="p-8 text-center text-slate-400">Nenhum dado encontrado</div>;
            return (
              <>
                <div className="p-4 border-b border-slate-100 bg-red-50/30">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold">{vendedorData.qtdClientesInadimplentes}</span> clientes inadimplentes
                    </p>
                    <p className="text-sm font-bold text-red-600">
                      Total: {formatCurrency(vendedorData.totalDevido)}
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                  {vendedorData.clientes.map((cliente) => (
                    <div key={cliente.nome} className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium text-slate-800">{cliente.nome}</p>
                        <p className="text-xs text-slate-500">
                          {cliente.qtdTitulos} título{cliente.qtdTitulos > 1 ? "s" : ""} vencido{cliente.qtdTitulos > 1 ? "s" : ""}
                        </p>
                      </div>
                      <p className="font-semibold text-red-600">{formatCurrency(cliente.totalDevido)}</p>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
