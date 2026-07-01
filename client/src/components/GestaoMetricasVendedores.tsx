/**
 * GestaoMetricasVendedores - Painel consolidado de métricas de vendas
 * de todos os vendedores da Gestão Comercial.
 * Mostra simultaneamente: Vendas do Dia, Mês Atual, Mês Anterior com rankings.
 * Drill-down: clique no vendedor para ver detalhes (clientes, valores, etc.)
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  Trophy,
  Medal,
  Award,
  Calendar,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function getDateRanges() {
  const now = new Date();
  const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const today = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, "0")}-${String(spNow.getDate()).padStart(2, "0")}`;
  
  // Day
  const dayRange = { startDate: today, endDate: today };
  
  // Week (Monday to today)
  const dayOfWeek = spNow.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(spNow);
  monday.setDate(spNow.getDate() - diffToMonday);
  const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  const weekRange = { startDate: weekStart, endDate: today };
  
  // Current month
  const monthStart = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, "0")}-01`;
  const monthRange = { startDate: monthStart, endDate: today };
  
  // Previous month
  const prevMonth = new Date(spNow.getFullYear(), spNow.getMonth() - 1, 1);
  const lastDay = new Date(spNow.getFullYear(), spNow.getMonth(), 0);
  const prevMonthStart = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const prevMonthEnd = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
  const prevMonthRange = { startDate: prevMonthStart, endDate: prevMonthEnd };
  
  return { dayRange, weekRange, monthRange, prevMonthRange };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const d = dateStr.substring(0, 10);
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function getRankIcon(index: number) {
  if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
  if (index === 1) return <Medal className="w-5 h-5 text-slate-400" />;
  if (index === 2) return <Award className="w-5 h-5 text-amber-600" />;
  return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-400">{index + 1}º</span>;
}

function getRankBgColor(index: number) {
  if (index === 0) return "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800";
  if (index === 1) return "bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-600";
  if (index === 2) return "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800";
  return "border-slate-100 dark:border-slate-700";
}

interface Props {
  sellerNames: string[];
}

type RankingItem = {
  vendedor: string;
  totalVendas: number;
  qtdPedidos: number;
  qtdClientes: number;
  vendedoresReais?: string[];
};

export default function GestaoMetricasVendedores({ sellerNames }: Props) {
  const [selectedVendedor, setSelectedVendedor] = useState<string | null>(null);
  const [detailPeriod, setDetailPeriod] = useState<"day" | "week" | "month" | "prev_month" | "custom">("month");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    day: false,
    week: false,
    month: false,
    prev_month: false,
    custom: false,
  });
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const { dayRange, weekRange, monthRange, prevMonthRange } = useMemo(() => getDateRanges(), []);
  const customRange = useMemo(() => ({
    startDate: customStartDate || monthRange.startDate,
    endDate: customEndDate || monthRange.endDate,
  }), [customStartDate, customEndDate, monthRange]);

  // Fetch rankings for all 3 periods simultaneously
  const { data: dayRanking, isLoading: loadingDay, isError: errorDay } = trpc.salesMetrics.getVendedorRanking.useQuery(
    dayRange,
    { staleTime: 60 * 1000, retry: 1 }
  );
  const { data: monthRanking, isLoading: loadingMonth, isError: errorMonth } = trpc.salesMetrics.getVendedorRanking.useQuery(
    monthRange,
    { staleTime: 60 * 1000, retry: 1 }
  );
  const { data: prevMonthRanking, isLoading: loadingPrevMonth, isError: errorPrevMonth } = trpc.salesMetrics.getVendedorRanking.useQuery(
    prevMonthRange,
    { staleTime: 60 * 1000, retry: 1 }
  );
  const { data: weekRanking, isLoading: loadingWeek, isError: errorWeek } = trpc.salesMetrics.getVendedorRanking.useQuery(
    weekRange,
    { staleTime: 60 * 1000, retry: 1 }
  );
  const { data: customRanking, isLoading: loadingCustom, isError: errorCustom } = trpc.salesMetrics.getVendedorRanking.useQuery(
    customRange,
    { staleTime: 60 * 1000, retry: 1, enabled: !!customStartDate && !!customEndDate }
  );

  // Fetch detail when a seller is selected
  const detailRange = detailPeriod === "day" ? dayRange : detailPeriod === "week" ? weekRange : detailPeriod === "month" ? monthRange : detailPeriod === "custom" ? customRange : prevMonthRange;
  const { data: vendedorDetail, isLoading: loadingDetail } = trpc.salesMetrics.getVendedorDetail.useQuery(
    { vendedor: selectedVendedor || "", startDate: detailRange.startDate, endDate: detailRange.endDate },
    { enabled: !!selectedVendedor }
  );

  // Filter ranking to only show sellers from this gestão comercial
  const sellerNamesUpper = useMemo(() => sellerNames.map(n => n.toUpperCase()), [sellerNames]);

  const matchesSeller = (rankingName: string): string | null => {
    const upper = rankingName.toUpperCase();
    for (const sn of sellerNamesUpper) {
      if (upper === sn) return sn;
    }
    for (const sn of sellerNamesUpper) {
      const shortWords = sn.split(/\s+/);
      if (shortWords.length >= 2 && shortWords.every(w => upper.includes(w))) return sn;
    }
    for (const sn of sellerNamesUpper) {
      const shortWords = sn.split(/\s+/);
      const fullWords = upper.split(/\s+/);
      if (shortWords.length >= 2 && fullWords.length >= 2) {
        if (shortWords[0] === fullWords[0] && shortWords[shortWords.length - 1] === fullWords[fullWords.length - 1]) return sn;
      }
    }
    for (const sn of sellerNamesUpper) {
      const shortWords = sn.split(/\s+/);
      const fullWords = upper.split(/\s+/);
      if (shortWords.length >= 1 && fullWords.length >= 1 && shortWords[0].length >= 4) {
        if (shortWords[0] === fullWords[0]) return sn;
      }
    }
    return null;
  };

  const filterRanking = (ranking: RankingItem[] | undefined): RankingItem[] => {
    if (!ranking) return [];
    const filtered = ranking.filter(r => matchesSeller(r.vendedor) !== null);
    // Add sellers with 0 sales
    const matchedNames = new Set<string>();
    for (const r of filtered) {
      const matched = matchesSeller(r.vendedor);
      if (matched) matchedNames.add(matched);
    }
    const result = [...filtered];
    for (const name of sellerNames) {
      if (!matchedNames.has(name.toUpperCase())) {
        result.push({ vendedor: name, totalVendas: 0, qtdPedidos: 0, qtdClientes: 0 });
      }
    }
    return result;
  };

  const filteredDay = useMemo(() => filterRanking(dayRanking), [dayRanking, sellerNamesUpper]);
  const filteredWeek = useMemo(() => filterRanking(weekRanking), [weekRanking, sellerNamesUpper]);
  const filteredMonth = useMemo(() => filterRanking(monthRanking), [monthRanking, sellerNamesUpper]);
  const filteredPrevMonth = useMemo(() => filterRanking(prevMonthRanking), [prevMonthRanking, sellerNamesUpper]);
  const filteredCustom = useMemo(() => filterRanking(customRanking), [customRanking, sellerNamesUpper]);

  const totalDay = filteredDay.reduce((s, v) => s + v.totalVendas, 0);
  const totalWeek = filteredWeek.reduce((s, v) => s + v.totalVendas, 0);
  const totalMonth = filteredMonth.reduce((s, v) => s + v.totalVendas, 0);
  const totalPrevMonth = filteredPrevMonth.reduce((s, v) => s + v.totalVendas, 0);
  const totalCustom = filteredCustom.reduce((s, v) => s + v.totalVendas, 0);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Detail view
  if (selectedVendedor) {
    const detailTotal = vendedorDetail?.reduce((s, c) => s + c.totalVendas, 0) || 0;
    const periodLabel = detailPeriod === "day" ? "Hoje" : detailPeriod === "week" ? "Semana" : detailPeriod === "month" ? "Mês Atual" : detailPeriod === "custom" ? "Personalizado" : "Mês Anterior";

    return (
      <div className="space-y-4">
        {/* Back button */}
        <button
          onClick={() => setSelectedVendedor(null)}
          className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-medium cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Ranking
        </button>

        {/* Seller header */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                {selectedVendedor.charAt(0)}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {selectedVendedor}
                </h3>
                <p className="text-xs text-slate-400">Detalhes de vendas — {periodLabel}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(detailTotal)}</p>
              <p className="text-[10px] text-slate-400">Total no período</p>
            </div>
          </div>

          {/* Period tabs */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
            {([
              { key: "day", label: "Hoje" },
              { key: "week", label: "Semana" },
              { key: "month", label: "Mês Atual" },
              { key: "prev_month", label: "Mês Anterior" },
              ...(customStartDate && customEndDate ? [{ key: "custom" as const, label: "Personalizado" }] : []),
            ] as const).map(p => (
              <button
                key={p.key}
                onClick={() => setDetailPeriod(p.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  detailPeriod === p.key
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Detail content */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {loadingDetail ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-5 h-5 text-teal-500 animate-spin mx-auto" />
              <p className="text-sm text-slate-400 mt-2">Carregando detalhes...</p>
            </div>
          ) : !vendedorDetail || vendedorDetail.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Nenhuma venda encontrada para {selectedVendedor} no período</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">{vendedorDetail.length}</span> clientes atendidos
                  </p>
                  <p className="text-sm font-bold text-teal-700 dark:text-teal-400">
                    Total: {formatCurrency(detailTotal)}
                  </p>
                </div>
              </div>

              {/* Client list */}
              <div className="divide-y divide-slate-50 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
                {vendedorDetail.map((c) => (
                  <div key={c.cliente} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{c.cliente}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {c.qtdPedidos} pedido{c.qtdPedidos > 1 ? "s" : ""} • Último: {formatDate(c.ultimoPedido)}
                        </p>
                        {c.estadosConfiguraveis && c.estadosConfiguraveis.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {c.estadosConfiguraveis.map((ec: string) => (
                              <span key={ec} className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-100 dark:border-teal-800">{ec}</span>
                            ))}
                            {c.segmentos && c.segmentos.map((seg: string) => (
                              <span key={seg} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800">{seg}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="font-bold text-sm text-green-700 dark:text-green-400 flex-shrink-0">{formatCurrency(c.totalVendas)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Main view: 5 ranking sections
  const isLoading = (loadingDay && !errorDay) || (loadingWeek && !errorWeek) || (loadingMonth && !errorMonth) || (loadingPrevMonth && !errorPrevMonth);
  const hasAnyError = errorDay || errorMonth || errorPrevMonth || errorWeek;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center">
            <TrendingUp className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-200">
              Métricas de Vendas — Visão Geral
            </h3>
            <p className="text-[10px] md:text-xs text-slate-400">
              {sellerNames.length} vendedor{sellerNames.length !== 1 ? "es" : ""} · Clique no vendedor para ver detalhes
            </p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 text-teal-500 animate-spin" />
        </div>
      )}

      {hasAnyError && !isLoading && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
          <p className="text-sm text-amber-700 dark:text-amber-300">Alguns dados podem estar indisponíveis temporariamente. Tente novamente em alguns segundos.</p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-orange-600" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-medium">Vendas Hoje</span>
              </div>
              <p className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{formatCurrency(totalDay)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{filteredDay.filter(v => v.totalVendas > 0).length} vendedores com vendas</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-medium">Semana</span>
              </div>
              <p className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{formatCurrency(totalWeek)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{filteredWeek.filter(v => v.totalVendas > 0).length} vendedores com vendas</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-green-600" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-medium">Mês Atual</span>
              </div>
              <p className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{formatCurrency(totalMonth)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{filteredMonth.filter(v => v.totalVendas > 0).length} vendedores com vendas</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-medium">Mês Anterior</span>
              </div>
              <p className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{formatCurrency(totalPrevMonth)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{filteredPrevMonth.filter(v => v.totalVendas > 0).length} vendedores com vendas</p>
            </div>
          </div>

          {/* Ranking: Vendas do Dia */}
          <RankingSection
            title="Vendas do Dia"
            subtitle="Hoje"
            icon={<Calendar className="w-4 h-4 text-orange-500" />}
            ranking={filteredDay}
            total={totalDay}
            expanded={expandedSections.day}
            onToggle={() => toggleSection("day")}
            onSelectVendedor={(name) => { setSelectedVendedor(name); setDetailPeriod("day"); }}
            accentColor="orange"
          />

          {/* Ranking: Vendas da Semana */}
          <RankingSection
            title="Vendas da Semana"
            subtitle="Seg-Hoje"
            icon={<Calendar className="w-4 h-4 text-purple-500" />}
            ranking={filteredWeek}
            total={totalWeek}
            expanded={expandedSections.week}
            onToggle={() => toggleSection("week")}
            onSelectVendedor={(name) => { setSelectedVendedor(name); setDetailPeriod("week"); }}
            accentColor="purple"
          />

          {/* Ranking: Mês Atual */}
          <RankingSection
            title="Mês Atual"
            subtitle="Acumulado"
            icon={<DollarSign className="w-4 h-4 text-green-500" />}
            ranking={filteredMonth}
            total={totalMonth}
            expanded={expandedSections.month}
            onToggle={() => toggleSection("month")}
            onSelectVendedor={(name) => { setSelectedVendedor(name); setDetailPeriod("month"); }}
            accentColor="green"
          />

          {/* Ranking: Mês Anterior */}
          <RankingSection
            title="Mês Anterior"
            subtitle="Fechado"
            icon={<TrendingUp className="w-4 h-4 text-blue-500" />}
            ranking={filteredPrevMonth}
            total={totalPrevMonth}
            expanded={expandedSections.prev_month}
            onToggle={() => toggleSection("prev_month")}
            onSelectVendedor={(name) => { setSelectedVendedor(name); setDetailPeriod("prev_month"); }}
            accentColor="blue"
          />

          {/* Vendas Personalizado */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSection("custom")}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-rose-50 to-pink-100/50 dark:from-rose-900/10 dark:to-rose-900/5 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-rose-500" />
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Vendas Personalizado</h4>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">Período Livre</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Escolha as datas para ver o ranking
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {customStartDate && customEndDate && (
                  <p className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totalCustom)}</p>
                )}
                {expandedSections.custom ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {expandedSections.custom && (
              <div>
                {/* Date selectors */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 uppercase font-medium mb-1 block">Data Início</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-300 focus:border-rose-400 outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 uppercase font-medium mb-1 block">Data Fim</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-300 focus:border-rose-400 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Custom ranking results */}
                {customStartDate && customEndDate && (
                  loadingCustom ? (
                    <div className="p-6 text-center">
                      <RefreshCw className="w-5 h-5 text-rose-500 animate-spin mx-auto" />
                      <p className="text-sm text-slate-400 mt-2">Carregando...</p>
                    </div>
                  ) : filteredCustom.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">
                      Nenhuma venda encontrada no período.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-700">
                      {filteredCustom.map((seller, idx) => {
                        const maxVendas = Math.max(...filteredCustom.map(s => s.totalVendas));
                        const percentual = maxVendas > 0 ? (seller.totalVendas / maxVendas) * 100 : 0;
                        const percentOfTotal = totalCustom > 0 ? (seller.totalVendas / totalCustom) * 100 : 0;
                        return (
                          <div
                            key={seller.vendedor}
                            className={`flex items-center gap-3 p-3 md:p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group border-l-3 ${getRankBgColor(idx)}`}
                            onClick={() => { setSelectedVendedor(seller.vendedor); setDetailPeriod("custom"); }}
                          >
                            <div className="flex-shrink-0 w-8 text-center">{getRankIcon(idx)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{seller.vendedor}</p>
                                <p className="text-xs md:text-sm font-bold text-green-700 dark:text-green-400 ml-2 flex-shrink-0">{formatCurrency(seller.totalVendas)}</p>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] md:text-xs text-slate-500">
                                <span>{seller.qtdPedidos} pedido{seller.qtdPedidos !== 1 ? "s" : ""}</span>
                                <span>{seller.qtdClientes} cliente{seller.qtdClientes !== 1 ? "s" : ""}</span>
                                {percentOfTotal > 0 && <span>{percentOfTotal.toFixed(1)}% do total</span>}
                              </div>
                              <div className="mt-1.5 h-1.5 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full transition-all duration-500" style={{ width: `${percentual}%` }} />
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 transition-colors flex-shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {!customStartDate || !customEndDate ? (
                  <div className="p-6 text-center text-slate-400 text-sm">
                    Selecione as datas acima para ver o ranking do período.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Ranking Section Component
// ============================================================
interface RankingSectionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  ranking: RankingItem[];
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onSelectVendedor: (name: string) => void;
  accentColor: "orange" | "green" | "blue" | "purple" | "rose";
}

function RankingSection({ title, subtitle, icon, ranking, total, expanded, onToggle, onSelectVendedor, accentColor }: RankingSectionProps) {
  const maxVendas = ranking.length > 0 ? Math.max(...ranking.map(s => s.totalVendas)) : 0;
  const activeCount = ranking.filter(v => v.totalVendas > 0).length;

  const accentClasses = {
    orange: {
      header: "from-orange-50 to-orange-100/50 dark:from-orange-900/10 dark:to-orange-900/5",
      badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      bar: "from-orange-400 to-amber-500",
    },
    green: {
      header: "from-green-50 to-emerald-100/50 dark:from-green-900/10 dark:to-green-900/5",
      badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      bar: "from-teal-400 to-emerald-500",
    },
    blue: {
      header: "from-blue-50 to-indigo-100/50 dark:from-blue-900/10 dark:to-blue-900/5",
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      bar: "from-blue-400 to-indigo-500",
    },
    purple: {
      header: "from-purple-50 to-violet-100/50 dark:from-purple-900/10 dark:to-purple-900/5",
      badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      bar: "from-purple-400 to-violet-500",
    },
    rose: {
      header: "from-rose-50 to-pink-100/50 dark:from-rose-900/10 dark:to-rose-900/5",
      badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
      bar: "from-rose-400 to-pink-500",
    },
  };

  const colors = accentClasses[accentColor];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 bg-gradient-to-r ${colors.header} cursor-pointer hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-3">
          {icon}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h4>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${colors.badge}`}>{subtitle}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {activeCount} vendedor{activeCount !== 1 ? "es" : ""} com vendas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-100">{formatCurrency(total)}</p>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Ranking list */}
      {expanded && (
        <div className="divide-y divide-slate-50 dark:divide-slate-700">
          {ranking.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">
              Nenhum vendedor cadastrado.
            </div>
          ) : (
            ranking.map((seller, idx) => {
              const percentual = maxVendas > 0 ? (seller.totalVendas / maxVendas) * 100 : 0;
              const percentOfTotal = total > 0 ? (seller.totalVendas / total) * 100 : 0;

              return (
                <div
                  key={seller.vendedor}
                  className={`flex items-center gap-3 p-3 md:p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group border-l-3 ${getRankBgColor(idx)}`}
                  onClick={() => onSelectVendedor(seller.vendedor)}
                >
                  {/* Rank icon */}
                  <div className="flex-shrink-0 w-8 text-center">
                    {getRankIcon(idx)}
                  </div>

                  {/* Seller info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {seller.vendedor}
                      </p>
                      <p className="text-xs md:text-sm font-bold text-green-700 dark:text-green-400 ml-2 flex-shrink-0">
                        {formatCurrency(seller.totalVendas)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] md:text-xs text-slate-500">
                      <span>{seller.qtdPedidos} pedido{seller.qtdPedidos !== 1 ? "s" : ""}</span>
                      <span>{seller.qtdClientes} cliente{seller.qtdClientes !== 1 ? "s" : ""}</span>
                      {percentOfTotal > 0 && <span>{percentOfTotal.toFixed(1)}% do total</span>}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1.5 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${colors.bar} rounded-full transition-all duration-500`}
                        style={{ width: `${percentual}%` }}
                      />
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 transition-colors flex-shrink-0" />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
