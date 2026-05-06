import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { TrendingUp, Users, DollarSign, AlertTriangle, ChevronLeft, Trophy, Medal, Award, FileDown, Calendar as CalendarIcon, Share2 } from "lucide-react";
import { exportRankingVendasPdf, exportInadimplenciaPdf, exportVendedorDetailPdf, exportInadimplenciaDetailPdf } from "@/lib/tabsPdfExport";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

type ViewMode = "ranking" | "detail" | "inadimplencia" | "inadimplenciaDetail";

const PERIOD_OPTIONS = [
  { label: "Mês Atual", value: "current" },
  { label: "Mês Anterior", value: "previous" },
  { label: "Personalizado", value: "custom" },
];

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function getDateRange(period: string, customMonth?: { year: number; month: number }) {
  const now = new Date();
  if (period === "custom" && customMonth) {
    const firstDay = new Date(customMonth.year, customMonth.month, 1);
    const lastDay = new Date(customMonth.year, customMonth.month + 1, 0);
    // If custom month is current month, use today as end
    const isCurrentMonth = customMonth.year === now.getFullYear() && customMonth.month === now.getMonth();
    return {
      startDate: firstDay.toISOString().split("T")[0],
      endDate: isCurrentMonth ? now.toISOString().split("T")[0] : lastDay.toISOString().split("T")[0],
    };
  }
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
  const [customMonth, setCustomMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [view, setView] = useState<ViewMode>("ranking");
  const [selectedVendedor, setSelectedVendedor] = useState("");
  const [filterEstados, setFilterEstados] = useState<string[]>([]);
  const [filterSegmentos, setFilterSegmentos] = useState<string[]>([]);

  const { startDate, endDate } = useMemo(() => getDateRange(period, customMonth), [period, customMonth]);

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

  const periodLabel = period === "current" ? "Mês Atual" : period === "previous" ? "Mês Anterior" : `${MONTHS_PT[customMonth.month].slice(0,3)}/${customMonth.year}`;

  const goBack = () => {
    if (view === "detail") { setView("ranking"); setSelectedVendedor(""); setFilterEstados([]); setFilterSegmentos([]); }
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

  // Filter vendedorDetail based on selected filters (multi-select)
  const filteredDetail = useMemo(() => {
    if (!vendedorDetail) return [];
    return vendedorDetail.filter((c) => {
      if (filterEstados.length > 0 && c.estadosConfiguraveis && !c.estadosConfiguraveis.some((e: string) => filterEstados.includes(e))) return false;
      if (filterSegmentos.length > 0 && c.segmentos && !c.segmentos.some((s: string) => filterSegmentos.includes(s))) return false;
      return true;
    });
  }, [vendedorDetail, filterEstados, filterSegmentos]);

  // Breakdown by selected estados (for multi-select cards)
  const estadoBreakdown = useMemo(() => {
    if (filterEstados.length <= 1 || !vendedorDetail) return null;
    return filterEstados.map(est => {
      const items = vendedorDetail.filter(c => c.estadosConfiguraveis?.includes(est));
      const total = items.reduce((s, c) => s + c.totalVendas, 0);
      const count = items.length;
      return { estado: est, total, count };
    });
  }, [filterEstados, vendedorDetail]);

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
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
          <button
            onClick={() => setPeriod("current")}
            className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors ${
              period === "current" ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            Mês Atual
          </button>
          <button
            onClick={() => setPeriod("previous")}
            className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors ${
              period === "previous" ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            Mês Anterior
          </button>
          <Popover open={showMonthPicker} onOpenChange={setShowMonthPicker}>
            <PopoverTrigger asChild>
              <button
                className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                  period === "custom" ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                <CalendarIcon className="w-3 h-3" />
                {period === "custom" ? `${MONTHS_PT[customMonth.month].slice(0,3)}/${customMonth.year}` : "Personalizado"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCustomMonth(prev => {
                      const newYear = prev.month === 0 ? prev.year - 1 : prev.year;
                      const newMonth = prev.month === 0 ? 11 : prev.month - 1;
                      return { year: newYear, month: newMonth };
                    })}
                    className="p-1 rounded hover:bg-slate-100"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-semibold">{customMonth.year}</span>
                  <button
                    onClick={() => setCustomMonth(prev => {
                      const newYear = prev.month === 11 ? prev.year + 1 : prev.year;
                      const newMonth = prev.month === 11 ? 0 : prev.month + 1;
                      return { year: newYear, month: newMonth };
                    })}
                    className="p-1 rounded hover:bg-slate-100 rotate-180"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MONTHS_PT.map((m, idx) => (
                    <button
                      key={m}
                      onClick={() => {
                        setCustomMonth(prev => ({ ...prev, month: idx }));
                        setPeriod("custom");
                        setShowMonthPicker(false);
                      }}
                      className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                        customMonth.month === idx && period === "custom"
                          ? "bg-teal-600 text-white"
                          : "hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      {m.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-teal-600" />
            <span className="text-xs text-slate-500">Total Vendas ({periodLabel})</span>
          </div>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(totalVendas)}</p>
          <p className="text-xs text-slate-400">{totalPedidos} pedidos</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-slate-500">Vendedores Ativos</span>
          </div>
          <p className="text-lg font-bold text-slate-800">{ranking?.length || 0}</p>
          <p className="text-xs text-slate-400">com vendas no período</p>
        </div>
        <div
          className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm cursor-pointer hover:border-red-200 transition-colors"
          onClick={() => setView("inadimplencia")}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-slate-500">Clientes Inadimplentes</span>
          </div>
          <p className="text-lg font-bold text-red-600">{totalInadimplentes}</p>
          <p className="text-xs text-slate-400">{formatCurrency(totalDevido)} em aberto</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm">
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
                onClick={async () => {
                  if (view === "ranking") {
                    if (!ranking?.length) { toast.error("Nenhum dado para exportar."); return; }
                    await exportRankingVendasPdf({ ranking: ranking.map(v => ({ vendedor: v.vendedor, totalVendas: v.totalVendas, qtdPedidos: v.qtdPedidos, qtdClientes: v.qtdClientes })), periodLabel });
                    toast.success("PDF de Ranking gerado!");
                  } else {
                    if (!inadimplencia?.length) { toast.error("Nenhum dado para exportar."); return; }
                    await exportInadimplenciaPdf({ inadimplencia: inadimplencia as any });
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
              view === "ranking" ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-1" /> Ranking de Vendas
          </button>
          <button
            onClick={() => setView("inadimplencia")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              view === "inadimplencia" ? "bg-red-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <AlertTriangle className="w-4 h-4 inline mr-1" /> Inadimplência
          </button>
        </div>
      )}

      {/* Ranking View */}
      {view === "ranking" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          {loadingRanking ? (
            <div className="p-8 text-center text-slate-400">Carregando ranking...</div>
          ) : !ranking || ranking.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Nenhuma venda encontrada no período</div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-700">
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
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          {loadingDetail ? (
            <div className="p-8 text-center text-slate-400">Carregando detalhes...</div>
          ) : !vendedorDetail || vendedorDetail.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Nenhuma venda encontrada para {selectedVendedor} no período</div>
          ) : (
            <>
              {/* Multi-select Filters */}
              {(detailFilterOptions.estados.length > 0 || detailFilterOptions.segmentos.length > 0) && (
                <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 space-y-2">
                  {detailFilterOptions.estados.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1 font-medium uppercase tracking-wide">Estado Configurável</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailFilterOptions.estados.map((e) => {
                          const isSelected = filterEstados.includes(e);
                          return (
                            <button
                              key={e}
                              onClick={() => setFilterEstados(prev => isSelected ? prev.filter(x => x !== e) : [...prev, e])}
                              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                                isSelected
                                  ? "bg-teal-600 text-white border-teal-600"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:bg-teal-50"
                              }`}
                            >
                              {e}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {detailFilterOptions.segmentos.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1 font-medium uppercase tracking-wide">Segmento</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailFilterOptions.segmentos.map((s) => {
                          const isSelected = filterSegmentos.includes(s);
                          return (
                            <button
                              key={s}
                              onClick={() => setFilterSegmentos(prev => isSelected ? prev.filter(x => x !== s) : [...prev, s])}
                              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                                isSelected
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                              }`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {(filterEstados.length > 0 || filterSegmentos.length > 0) && (
                    <button
                      onClick={() => { setFilterEstados([]); setFilterSegmentos([]); }}
                      className="text-[10px] text-teal-600 hover:text-teal-800 underline"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              )}

              {/* Breakdown cards when multiple estados selected */}
              {estadoBreakdown && (
                <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-teal-50/30">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                    {estadoBreakdown.map(eb => (
                      <div key={eb.estado} className="bg-white rounded-lg border border-teal-100 p-2.5 text-center">
                        <p className="text-[10px] font-medium text-teal-700 uppercase">{eb.estado}</p>
                        <p className="text-sm font-bold text-slate-800">{formatCurrency(eb.total)}</p>
                        <p className="text-[10px] text-slate-500">{eb.count} clientes</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-lg border border-teal-200 p-2.5 text-center">
                    <p className="text-[10px] font-medium text-slate-500">SOMA TOTAL</p>
                    <p className="text-base font-bold text-teal-700">{formatCurrency(estadoBreakdown.reduce((s, e) => s + e.total, 0))}</p>
                  </div>
                </div>
              )}

              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">{filteredDetail.length}</span> clientes{filteredDetail.length !== vendedorDetail.length ? ` (de ${vendedorDetail.length})` : " atendidos"}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-teal-700">
                      Total: {formatCurrency(filteredDetail.reduce((s, c) => s + c.totalVendas, 0))}
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={async () => {
                            if (!filteredDetail.length) { toast.error("Nenhum dado para exportar."); return; }
                            await exportVendedorDetailPdf({
                              vendedor: selectedVendedor,
                              periodLabel,
                              filterEstados,
                              filterSegmentos,
                              clientes: filteredDetail.map(c => ({
                                cliente: c.cliente,
                                totalVendas: c.totalVendas,
                                qtdPedidos: c.qtdPedidos,
                                ultimoPedido: c.ultimoPedido,
                                estadosConfiguraveis: c.estadosConfiguraveis,
                                segmentos: c.segmentos,
                                vendedoresReais: c.vendedoresReais,
                              })),
                              estadoBreakdown: estadoBreakdown,
                            });
                            toast.success("PDF gerado com sucesso!");
                          }}
                          size="sm"
                          variant="outline"
                          className="gap-1 h-7 px-2 border-slate-300 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-all"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline text-xs">PDF</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Exportar detalhes do vendedor em PDF</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={async () => {
                            if (!filteredDetail.length) { toast.error("Nenhum dado para compartilhar."); return; }
                            const safeName = selectedVendedor.replace(/[^a-zA-Z0-9]/g, "_");
                            const fileName = `Vendas_${safeName}_${periodLabel.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
                            const totalVendas = filteredDetail.reduce((s, c) => s + c.totalVendas, 0);
                            // Download the PDF first, then open WhatsApp
                            await exportVendedorDetailPdf({
                              vendedor: selectedVendedor,
                              periodLabel,
                              filterEstados,
                              filterSegmentos,
                              clientes: filteredDetail.map(c => ({
                                cliente: c.cliente,
                                totalVendas: c.totalVendas,
                                qtdPedidos: c.qtdPedidos,
                                ultimoPedido: c.ultimoPedido,
                                estadosConfiguraveis: c.estadosConfiguraveis,
                                segmentos: c.segmentos,
                                vendedoresReais: c.vendedoresReais,
                              })),
                              estadoBreakdown: estadoBreakdown,
                            });
                            const whatsappText = encodeURIComponent(`\ud83d\udcca Vendas de ${selectedVendedor} (${periodLabel}): ${filteredDetail.length} clientes, ${formatCurrency(totalVendas)} total`);
                            window.open(`https://wa.me/?text=${whatsappText}`, "_blank");
                          }}
                          size="sm"
                          variant="outline"
                          className="gap-1 h-7 px-2 border-green-200 hover:border-green-400 hover:bg-green-50 hover:text-green-700 transition-all"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Compartilhar via WhatsApp</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
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
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          {loadingInadimplencia ? (
            <div className="p-8 text-center text-slate-400">Carregando inadimplência...</div>
          ) : !inadimplencia || inadimplencia.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Nenhum cliente inadimplente encontrado</div>
          ) : (
            <>
              <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-red-50/30">
                <p className="text-xs text-slate-500">
                  Dados da aba Inadimplência (títulos vencidos até o último dia útil)
                </p>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-700">
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
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          {(() => {
            const vendedorData = inadimplencia?.find(v => v.vendedor === selectedVendedor);
            if (!vendedorData) return <div className="p-8 text-center text-slate-400">Nenhum dado encontrado</div>;
            return (
              <>
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-red-50/30">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold">{vendedorData.qtdClientesInadimplentes}</span> clientes inadimplentes
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-red-600">
                        Total: {formatCurrency(vendedorData.totalDevido)}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={async () => {
                              await exportInadimplenciaDetailPdf({
                                vendedor: selectedVendedor,
                                clientes: vendedorData.clientes,
                              });
                              toast.success("PDF gerado com sucesso!");
                            }}
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7 px-2 border-red-200 hover:border-red-300 hover:bg-red-50 hover:text-red-700 transition-all"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-xs">PDF</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Exportar inadimplência em PDF</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={async () => {
                              await exportInadimplenciaDetailPdf({
                                vendedor: selectedVendedor,
                                clientes: vendedorData.clientes,
                              });
                              const whatsappText = encodeURIComponent(`\ud83d\udcca Inadimpl\u00eancia - ${selectedVendedor}: ${vendedorData.qtdClientesInadimplentes} clientes, ${formatCurrency(vendedorData.totalDevido)} em aberto`);
                              window.open(`https://wa.me/?text=${whatsappText}`, "_blank");
                            }}
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7 px-2 border-green-200 hover:border-green-400 hover:bg-green-50 hover:text-green-700 transition-all"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Compartilhar via WhatsApp</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
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
