import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { TrendingUp, Users, DollarSign, AlertTriangle, ChevronLeft, ChevronRight, Trophy, Medal, Award, FileDown, Calendar as CalendarIcon, Share2, Crown, Star, MapPin, Tag, ShoppingCart, Package, Eye } from "lucide-react";
import { exportRankingVendasPdf, exportInadimplenciaPdf, exportVendedorDetailPdf, exportInadimplenciaDetailPdf, exportBestSellerPdf } from "@/lib/tabsPdfExport";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

type ViewMode = "ranking" | "detail" | "inadimplencia" | "inadimplenciaDetail" | "bestSeller";

type BestSellerPeriod = "day" | "week" | "month" | "year";

const BEST_SELLER_PERIODS: { label: string; value: BestSellerPeriod }[] = [
  { label: "Dia", value: "day" },
  { label: "Semana", value: "week" },
  { label: "Mês", value: "month" },
  { label: "Ano", value: "year" },
];

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

  const [bestSellerPeriod, setBestSellerPeriod] = useState<BestSellerPeriod>("month");
  const [bsOffset, setBsOffset] = useState(0);
  const [bsCustomDate, setBsCustomDate] = useState<string | undefined>(undefined);
  const [bsShowDatePicker, setBsShowDatePicker] = useState(false);
  const [bsDetailSeller, setBsDetailSeller] = useState<string | null>(null);
  const [bsFilterEstados, setBsFilterEstados] = useState<string[]>([]);
  const [bsFilterSegmentos, setBsFilterSegmentos] = useState<string[]>([]);
  const [bsFilterUFs, setBsFilterUFs] = useState<string[]>([]);
  const [bsFilterClientes, setBsFilterClientes] = useState<string[]>([]);
  const { data: bestSellers, isLoading: loadingBestSellers } = trpc.sales.getBestSellers.useQuery(
    { period: bestSellerPeriod, offset: bsOffset, customDate: bsCustomDate },
    { enabled: view === "bestSeller", refetchInterval: 60000 }
  );
  const { data: bsOrders, isLoading: loadingBsOrders } = trpc.sales.getBestSellerOrders.useQuery(
    { sellerName: bsDetailSeller || "", period: bestSellerPeriod, offset: bsOffset, customDate: bsCustomDate },
    { enabled: !!bsDetailSeller }
  );
  // Compute unique filter values from orders
  const bsFilterOptions = useMemo(() => {
    if (!bsOrders?.orders) return { estados: [] as string[], segmentos: [] as string[], ufs: [] as string[], clientes: [] as string[] };
    const estados = Array.from(new Set(bsOrders.orders.map(o => o.estadoConfiguravel).filter(v => v !== "-")));
    const segmentos = Array.from(new Set(bsOrders.orders.map(o => o.crmSegmento).filter(v => v !== "-")));
    const ufs = Array.from(new Set(bsOrders.orders.map(o => o.uf).filter(v => v !== "-")));
    const clientes = Array.from(new Set(bsOrders.orders.map(o => o.clienteApelido).filter(v => v !== "-")));
    return { estados: estados.sort(), segmentos: segmentos.sort(), ufs: ufs.sort(), clientes: clientes.sort() };
  }, [bsOrders]);
  // Filtered orders
  const bsFilteredOrders = useMemo(() => {
    if (!bsOrders?.orders) return [];
    return bsOrders.orders.filter(o => {
      if (bsFilterEstados.length > 0 && !bsFilterEstados.includes(o.estadoConfiguravel)) return false;
      if (bsFilterSegmentos.length > 0 && !bsFilterSegmentos.includes(o.crmSegmento)) return false;
      if (bsFilterUFs.length > 0 && !bsFilterUFs.includes(o.uf)) return false;
      if (bsFilterClientes.length > 0 && !bsFilterClientes.includes(o.clienteApelido)) return false;
      return true;
    });
  }, [bsOrders, bsFilterEstados, bsFilterSegmentos, bsFilterUFs, bsFilterClientes]);

  const goBack = () => {
    if (view === "detail") { setView("ranking"); setSelectedVendedor(""); setFilterEstados([]); setFilterSegmentos([]); }
    else if (view === "inadimplenciaDetail") { setView("inadimplencia"); setSelectedVendedor(""); }
    else if (view === "bestSeller" && bsDetailSeller) { setBsDetailSeller(null); setBsFilterEstados([]); setBsFilterSegmentos([]); setBsFilterUFs([]); setBsFilterClientes([]); }
    else if (view === "bestSeller") { setView("ranking"); }
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
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            {view === "ranking" && "Ranking de Vendedores"}
            {view === "detail" && `Vendas de ${selectedVendedor}`}
            {view === "inadimplencia" && "Inadimplência por Vendedor"}
            {view === "inadimplenciaDetail" && `Inadimplência - ${selectedVendedor}`}
            {view === "bestSeller" && "🏆 Melhor Vendedor"}
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
      {(view === "ranking" || view === "inadimplencia" || view === "bestSeller") && (
        <div className="flex gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={async () => {
                  if (view === "ranking") {
                    if (!ranking?.length) { toast.error("Nenhum dado para exportar."); return; }
                    await exportRankingVendasPdf({ ranking: ranking.map(v => ({ vendedor: v.vendedor, totalVendas: v.totalVendas, qtdPedidos: v.qtdPedidos, qtdClientes: v.qtdClientes })), periodLabel });
                    toast.success("PDF de Ranking gerado!");
                  } else if (view === "bestSeller") {
                    if (!bestSellers?.sellers?.length) { toast.error("Nenhum dado para exportar."); return; }
                    const periodLabelBs = bestSellerPeriod === "day" ? "Dia" : bestSellerPeriod === "week" ? "Semana" : bestSellerPeriod === "month" ? "M\u00eas" : "Ano";
                    const dateRange = bestSellers.startDate && bestSellers.endDate
                      ? bestSellers.startDate === bestSellers.endDate
                        ? bestSellers.startDate.split("-").reverse().join("/")
                        : `${bestSellers.startDate.split("-").reverse().join("/")} a ${bestSellers.endDate.split("-").reverse().join("/")}`
                      : "";
                    await exportBestSellerPdf({
                      period: bestSellerPeriod,
                      periodLabel: periodLabelBs,
                      dateRange,
                      winner: bestSellers.sellers[0],
                      allSellers: bestSellers.sellers.map(s => ({ name: s.name, totalValue: s.totalValue, orders: s.orders, clients: s.clients })),
                    });
                    toast.success("PDF do Melhor Vendedor gerado!");
                  } else {
                    if (!inadimplencia?.length) { toast.error("Nenhum dado para exportar."); return; }
                    await exportInadimplenciaPdf({ inadimplencia: inadimplencia as any });
                    toast.success("PDF de Inadimpl\u00eancia gerado!");
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
          <button
            onClick={() => setView("bestSeller")}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-gradient-to-r from-amber-500 to-yellow-400 text-white shadow-sm hover:from-amber-600 hover:to-yellow-500"
          >
            <Crown className="w-4 h-4 inline mr-1" /> Melhor Vendedor
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

      {/* Best Seller View */}
      {view === "bestSeller" && (
        <div className="space-y-4">
          {/* Period selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            {BEST_SELLER_PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => { setBestSellerPeriod(p.value); setBsOffset(0); setBsCustomDate(undefined); setBsShowDatePicker(false); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  bestSellerPeriod === p.value && !bsCustomDate
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
            {/* Custom date button */}
            <button
              onClick={() => { setBsShowDatePicker(!bsShowDatePicker); }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                bsCustomDate
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              {bsCustomDate ? bsCustomDate.split("-").reverse().join("/") : "Personalizado"}
            </button>
          </div>

          {/* Custom date picker */}
          {bsShowDatePicker && (
            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Data:</label>
              <input
                type="date"
                className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={bsCustomDate || ""}
                onChange={(e) => {
                  if (e.target.value) {
                    setBsCustomDate(e.target.value);
                    setBsOffset(0);
                  }
                }}
              />
              {bsCustomDate && (
                <button
                  onClick={() => { setBsCustomDate(undefined); setBsShowDatePicker(false); setBsOffset(0); }}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
          )}

          {/* Navigation arrows + date range display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => { if (bsCustomDate) { const d = new Date(bsCustomDate + 'T12:00:00'); d.setDate(d.getDate() - 1); setBsCustomDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); } else { setBsOffset(bsOffset - 1); } }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600"
                title="Período anterior"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
              <button
                onClick={() => { setBsOffset(0); setBsCustomDate(undefined); }}
                className={`px-2 py-1 text-[10px] font-medium rounded-lg transition-colors ${
                  bsOffset === 0 && !bsCustomDate
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                Hoje
              </button>
              <button
                onClick={() => { if (bsCustomDate) { const d = new Date(bsCustomDate + 'T12:00:00'); d.setDate(d.getDate() + 1); setBsCustomDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); } else { setBsOffset(bsOffset + 1); } }}
                disabled={bsOffset >= 0 && !bsCustomDate}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Próximo período"
              >
                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
            {bestSellers && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {bestSellers.startDate && bestSellers.endDate
                  ? bestSellers.startDate === bestSellers.endDate
                    ? bestSellers.startDate.split("-").reverse().join("/")
                    : `${bestSellers.startDate.split("-").reverse().join("/")} a ${bestSellers.endDate.split("-").reverse().join("/")}`
                  : ""}
              </span>
            )}
          </div>

          {loadingBestSellers ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-8 text-center text-slate-400">
              Carregando melhor vendedor...
            </div>
          ) : !bestSellers || bestSellers.sellers.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-8 text-center text-slate-400">
              Nenhuma venda encontrada no período
            </div>
          ) : bsDetailSeller ? (
            /* Detail view for a specific seller */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={() => { setBsDetailSeller(null); setBsFilterEstados([]); setBsFilterSegmentos([]); setBsFilterUFs([]); setBsFilterClientes([]); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0">
                  <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
                <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 truncate">Vendas de {bsDetailSeller}</h3>
              </div>

              {/* Multi-select filters */}
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                {bsFilterOptions.estados.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mr-1">Estado:</span>
                    {bsFilterOptions.estados.map(e => (
                      <button key={e} onClick={() => setBsFilterEstados(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])}
                        className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${bsFilterEstados.includes(e) ? "bg-teal-500 text-white" : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"}`}>{e}</button>
                    ))}
                  </div>
                )}
                {bsFilterOptions.segmentos.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mr-1">Segmento:</span>
                    {bsFilterOptions.segmentos.map(s => (
                      <button key={s} onClick={() => setBsFilterSegmentos(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                        className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${bsFilterSegmentos.includes(s) ? "bg-purple-500 text-white" : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"}`}>{s}</button>
                    ))}
                  </div>
                )}
                {bsFilterOptions.ufs.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mr-1">UF:</span>
                    {bsFilterOptions.ufs.map(u => (
                      <button key={u} onClick={() => setBsFilterUFs(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u])}
                        className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${bsFilterUFs.includes(u) ? "bg-blue-500 text-white" : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"}`}>{u}</button>
                    ))}
                  </div>
                )}
                {bsFilterOptions.clientes.length > 1 && (
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mr-1">Cliente:</span>
                    {bsFilterOptions.clientes.map(c => (
                      <button key={c} onClick={() => setBsFilterClientes(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                        className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${bsFilterClientes.includes(c) ? "bg-amber-500 text-white" : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"}`}>{c.length > 20 ? c.substring(0, 20) + "..." : c}</button>
                    ))}
                  </div>
                )}
                {(bsFilterEstados.length > 0 || bsFilterSegmentos.length > 0 || bsFilterUFs.length > 0 || bsFilterClientes.length > 0) && (
                  <button onClick={() => { setBsFilterEstados([]); setBsFilterSegmentos([]); setBsFilterUFs([]); setBsFilterClientes([]); }}
                    className="px-2 py-0.5 text-[10px] rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">Limpar filtros</button>
                )}
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-center border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Pedidos</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{bsFilteredOrders.length}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-center border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Total</p>
                  <p className="text-sm font-bold text-teal-700 dark:text-teal-400">{formatCurrency(bsFilteredOrders.reduce((s, o) => s + o.valorTotal, 0))}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-center border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Clientes</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{new Set(bsFilteredOrders.map(o => o.cliente)).size}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-center border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Itens</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{bsFilteredOrders.reduce((s, o) => s + o.itens, 0)}</p>
                </div>
              </div>

              {/* Orders table */}
              {loadingBsOrders ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-6 text-center text-slate-400">Carregando vendas...</div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Pedido</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Cliente</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Data</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Estado Conf.</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Segmento</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">UF</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Status</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                        {bsFilteredOrders.map((order, idx) => (
                          <tr key={`${order.pedido}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">{order.pedido}</td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[150px] truncate" title={order.clienteApelido}>{order.clienteApelido}</td>
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{order.dataEmissao !== "-" ? order.dataEmissao.split("-").reverse().join("/") : "-"}</td>
                            <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-700">{order.estadoConfiguravel}</span></td>
                            <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">{order.crmSegmento}</span></td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{order.uf}</td>
                            <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded-full text-[10px] ${order.estadoItem === "Faturado" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"}`}>{order.estadoItem}</span></td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(order.valorTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Winner Card */}
              {bestSellers.sellers[0] && (
                <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/20 dark:via-yellow-900/20 dark:to-orange-900/20 rounded-2xl border-2 border-amber-200 dark:border-amber-700 shadow-lg p-4 md:p-6 relative overflow-hidden">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md flex-shrink-0">
                        <Crown className="w-5 h-5 md:w-6 md:h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] md:text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">
                          Melhor Vendedor {bestSellerPeriod === "day" ? "do Dia" : bestSellerPeriod === "week" ? "da Semana" : bestSellerPeriod === "month" ? "do M\u00eas" : "do Ano"}
                        </p>
                        <h3 className="text-lg md:text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">{bestSellers.sellers[0].name}</h3>
                      </div>
                    </div>
                    <button
                      onClick={() => setBsDetailSeller(bestSellers.sellers[0].name)}
                      className="flex-shrink-0 px-3 py-1.5 md:px-3 md:py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver vendas
                    </button>
                    <div className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 opacity-30">
                      <Trophy className="w-full h-full text-amber-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white/70 dark:bg-slate-800/70 rounded-xl p-3 text-center">
                      <DollarSign className="w-4 h-4 text-teal-600 mx-auto mb-1" />
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total Vendas</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatCurrency(bestSellers.sellers[0].totalValue)}</p>
                    </div>
                    <div className="bg-white/70 dark:bg-slate-800/70 rounded-xl p-3 text-center">
                      <ShoppingCart className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                      <p className="text-xs text-slate-500 dark:text-slate-400">Pedidos</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{bestSellers.sellers[0].orders}</p>
                    </div>
                    <div className="bg-white/70 dark:bg-slate-800/70 rounded-xl p-3 text-center">
                      <Users className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                      <p className="text-xs text-slate-500 dark:text-slate-400">Clientes</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{bestSellers.sellers[0].clients}</p>
                    </div>
                    <div className="bg-white/70 dark:bg-slate-800/70 rounded-xl p-3 text-center">
                      <Package className="w-4 h-4 text-orange-600 mx-auto mb-1" />
                      <p className="text-xs text-slate-500 dark:text-slate-400">Itens</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{bestSellers.sellers[0].items}</p>
                    </div>
                  </div>

                  {/* Faturado vs A Faturar */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50/70 dark:bg-emerald-900/20 rounded-lg p-2.5 text-center border border-emerald-100 dark:border-emerald-800">
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Faturado</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(bestSellers.sellers[0].faturado)}</p>
                    </div>
                    <div className="bg-blue-50/70 dark:bg-blue-900/20 rounded-lg p-2.5 text-center border border-blue-100 dark:border-blue-800">
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">A Faturar</p>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{formatCurrency(bestSellers.sellers[0].aFaturar)}</p>
                    </div>
                  </div>

                  {/* Segments breakdown */}
                  {bestSellers.sellers[0].bySegmento.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Por Segmento (Estado Configurável)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {bestSellers.sellers[0].bySegmento.map((seg) => (
                          <span key={seg.name} className="text-[11px] px-2 py-1 rounded-full bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300">
                            {seg.name}: <span className="font-semibold">{formatCurrency(seg.value)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CRM Segments */}
                  {bestSellers.sellers[0].byCrmSegmento.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
                        <Star className="w-3 h-3" /> Por Segmento CRM
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {bestSellers.sellers[0].byCrmSegmento.map((seg) => (
                          <span key={seg.name} className="text-[11px] px-2 py-1 rounded-full bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300">
                            {seg.name}: <span className="font-semibold">{formatCurrency(seg.value)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* UF breakdown */}
                  {bestSellers.sellers[0].byUF.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Por UF
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {bestSellers.sellers[0].byUF.map((uf) => (
                          <span key={uf.name} className="text-[11px] px-2 py-1 rounded-full bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300">
                            {uf.name}: <span className="font-semibold">{formatCurrency(uf.value)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Clients */}
                  {bestSellers.sellers[0].topClients.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Top 10 Clientes</p>
                      <div className="space-y-1">
                        {bestSellers.sellers[0].topClients.map((c, i) => (
                          <div key={c.name} className="flex items-center justify-between bg-white/60 dark:bg-slate-800/60 rounded-lg px-3 py-1.5">
                            <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1 mr-2">
                              <span className="text-slate-400 mr-1">{i + 1}.</span> {c.name}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex-shrink-0">{formatCurrency(c.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Products */}
                  {bestSellers.sellers[0].topProducts.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Top 10 Produtos</p>
                      <div className="space-y-1">
                        {bestSellers.sellers[0].topProducts.map((p, i) => (
                          <div key={p.name} className="flex items-center justify-between bg-white/60 dark:bg-slate-800/60 rounded-lg px-3 py-1.5">
                            <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1 mr-2">
                              <span className="text-slate-400 mr-1">{i + 1}.</span> {p.name}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex-shrink-0">{formatCurrency(p.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Other sellers ranking */}
              {bestSellers.sellers.length > 1 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Ranking Completo ({bestSellers.sellers.length} vendedores)</p>
                  </div>
                  <div className="divide-y divide-slate-50 dark:divide-slate-700 max-h-[400px] overflow-y-auto">
                    {bestSellers.sellers.map((seller, idx) => {
                      const totalAll = bestSellers.sellers.reduce((s, x) => s + x.totalValue, 0);
                      const pct = totalAll > 0 ? (seller.totalValue / totalAll) * 100 : 0;
                      return (
                        <div key={seller.name} onClick={() => setBsDetailSeller(seller.name)} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                          <div className="flex-shrink-0 w-7 text-center">
                            {idx === 0 ? <Trophy className="w-5 h-5 text-yellow-500 mx-auto" /> :
                             idx === 1 ? <Medal className="w-5 h-5 text-slate-400 mx-auto" /> :
                             idx === 2 ? <Award className="w-5 h-5 text-amber-600 mx-auto" /> :
                             <span className="text-xs font-bold text-slate-400">{idx + 1}\u00ba</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{seller.name}</p>
                              <p className="text-sm font-bold text-teal-700 dark:text-teal-400 flex-shrink-0 ml-2">{formatCurrency(seller.totalValue)}</p>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              <span>{seller.orders} ped.</span>
                              <span>{seller.clients} cli.</span>
                              <span>{pct.toFixed(1)}%</span>
                            </div>
                            <div className="mt-1.5 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${idx === 0 ? "bg-amber-400" : idx === 1 ? "bg-slate-400" : idx === 2 ? "bg-amber-600" : "bg-teal-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
