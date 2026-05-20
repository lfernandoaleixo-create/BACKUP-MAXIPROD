/**
 * GestaoMetricasVendedores - Painel consolidado de métricas de vendas
 * de todos os vendedores da Gestão Comercial.
 * Mostra: KPIs totais, ranking com barras de progresso, filtros de período.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
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
} from "lucide-react";

type SalesPeriod = "day" | "week" | "month" | "prev_month" | "3months" | "custom";

const SALES_PERIODS: { label: string; value: SalesPeriod }[] = [
  { label: "Hoje", value: "day" },
  { label: "Semana", value: "week" },
  { label: "Mês Atual", value: "month" },
  { label: "Mês Anterior", value: "prev_month" },
  { label: "3 Meses", value: "3months" },
  { label: "Personalizado", value: "custom" },
];

function getSalesDateRange(period: SalesPeriod, customStart?: string, customEnd?: string): { startDate: string; endDate: string } {
  const now = new Date();
  const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const today = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, "0")}-${String(spNow.getDate()).padStart(2, "0")}`;

  switch (period) {
    case "day":
      return { startDate: today, endDate: today };
    case "week": {
      const dow = spNow.getDay();
      const mondayOff = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(spNow);
      monday.setDate(spNow.getDate() + mondayOff);
      const startDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      return { startDate, endDate: today };
    }
    case "month": {
      const startDate = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, "0")}-01`;
      return { startDate, endDate: today };
    }
    case "prev_month": {
      const prevMonth = new Date(spNow.getFullYear(), spNow.getMonth() - 1, 1);
      const lastDay = new Date(spNow.getFullYear(), spNow.getMonth(), 0);
      const startDate = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-01`;
      const endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
      return { startDate, endDate };
    }
    case "3months": {
      const threeMonthsAgo = new Date(spNow.getFullYear(), spNow.getMonth() - 2, 1);
      const startDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;
      return { startDate, endDate: today };
    }
    case "custom":
      return { startDate: customStart || today, endDate: customEnd || today };
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function getRankIcon(index: number) {
  if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
  if (index === 1) return <Medal className="w-5 h-5 text-slate-400" />;
  if (index === 2) return <Award className="w-5 h-5 text-amber-600" />;
  return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-400">{index + 1}º</span>;
}

interface Props {
  /** List of seller names that belong to this gestão comercial */
  sellerNames: string[];
}

export default function GestaoMetricasVendedores({ sellerNames }: Props) {
  const [, navigate] = useLocation();
  const [period, setPeriod] = useState<SalesPeriod>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const { startDate, endDate } = useMemo(
    () => getSalesDateRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  // Fetch the full ranking (all sellers)
  const { data: ranking, isLoading } = trpc.salesMetrics.getVendedorRanking.useQuery(
    { startDate, endDate },
    { staleTime: 60 * 1000 }
  );

  // Filter ranking to only show sellers from this gestão comercial
  // Use fuzzy matching: seller_permissions has short names (e.g. "DANIEL TAVARES")
  // but ranking may have full names (e.g. "DANIEL DA CONCEIÇÃO TAVARES")
  const sellerNamesUpper = useMemo(() => sellerNames.map(n => n.toUpperCase()), [sellerNames]);

  // Check if a ranking vendedor name matches any of our seller names (partial match)
  const matchesSeller = (rankingName: string): string | null => {
    const upper = rankingName.toUpperCase();
    // First try exact match
    for (const sn of sellerNamesUpper) {
      if (upper === sn) return sn;
    }
    // Then try: all words of the short name appear in the full name
    for (const sn of sellerNamesUpper) {
      const shortWords = sn.split(/\s+/);
      if (shortWords.length >= 2 && shortWords.every(w => upper.includes(w))) {
        return sn;
      }
    }
    // Try: first and last word of short name match first and last word of full name
    for (const sn of sellerNamesUpper) {
      const shortWords = sn.split(/\s+/);
      const fullWords = upper.split(/\s+/);
      if (shortWords.length >= 2 && fullWords.length >= 2) {
        if (shortWords[0] === fullWords[0] && shortWords[shortWords.length - 1] === fullWords[fullWords.length - 1]) {
          return sn;
        }
      }
    }
    return null;
  };

  const filteredRanking = useMemo(() => {
    if (!ranking) return [];
    return ranking.filter(r => matchesSeller(r.vendedor) !== null);
  }, [ranking, sellerNamesUpper]);

  // Also show sellers with 0 sales (not in ranking)
  const allSellersWithMetrics = useMemo(() => {
    // Track which seller_permissions names have been matched
    const matchedSellerNames = new Set<string>();
    const result: Array<{
      vendedor: string;
      totalVendas: number;
      qtdPedidos: number;
      qtdClientes: number;
      vendedoresReais?: string[];
    }> = [];

    // Add sellers from ranking first (sorted by totalVendas desc)
    for (const r of filteredRanking) {
      result.push(r);
      const matched = matchesSeller(r.vendedor);
      if (matched) matchedSellerNames.add(matched);
    }

    // Add sellers not in ranking with 0 values
    for (const name of sellerNames) {
      if (!matchedSellerNames.has(name.toUpperCase())) {
        result.push({
          vendedor: name,
          totalVendas: 0,
          qtdPedidos: 0,
          qtdClientes: 0,
        });
      }
    }

    return result;
  }, [filteredRanking, sellerNames]);

  // KPIs
  const totalVendas = filteredRanking.reduce((sum, v) => sum + v.totalVendas, 0);
  const totalPedidos = filteredRanking.reduce((sum, v) => sum + v.qtdPedidos, 0);
  const totalClientes = filteredRanking.reduce((sum, v) => sum + v.qtdClientes, 0);
  const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;
  const maxVendas = allSellersWithMetrics.length > 0 ? Math.max(...allSellersWithMetrics.map(s => s.totalVendas)) : 0;

  const periodLabel = SALES_PERIODS.find(p => p.value === period)?.label || "";

  return (
    <div className="space-y-4">
      {/* Header with period filter */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-200">
                Métricas de Vendas — Equipe
              </h3>
              <p className="text-[10px] md:text-xs text-slate-400">
                {sellerNames.length} vendedor{sellerNames.length !== 1 ? "es" : ""} · {periodLabel}
              </p>
            </div>
          </div>

          {/* Period chips */}
          <div className="flex flex-wrap gap-1.5">
            {SALES_PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  setPeriod(p.value);
                  if (p.value === "custom") setShowCustom(true);
                  else setShowCustom(false);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  period === p.value
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date inputs */}
        {showCustom && period === "custom" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            />
            <span className="text-xs text-slate-400">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            />
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 text-teal-500 animate-spin" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-green-600" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-medium">Total Vendas</span>
              </div>
              <p className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-100 truncate" title={formatCurrency(totalVendas)}>
                {formatCurrency(totalVendas)}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-medium">Pedidos</span>
              </div>
              <p className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-100">
                {totalPedidos}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-medium">Clientes</span>
              </div>
              <p className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-100">
                {totalClientes}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-medium">Ticket Médio</span>
              </div>
              <p className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-100 truncate" title={formatCurrency(ticketMedio)}>
                {formatCurrency(ticketMedio)}
              </p>
            </div>
          </div>

          {/* Ranking de vendedores */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Ranking de Vendedores
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400">{periodLabel}</span>
              </div>
            </div>

            {allSellersWithMetrics.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                Nenhum vendedor cadastrado.
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700">
                {allSellersWithMetrics.map((seller, idx) => {
                  const percentual = maxVendas > 0 ? (seller.totalVendas / maxVendas) * 100 : 0;
                  const percentOfTotal = totalVendas > 0 ? (seller.totalVendas / totalVendas) * 100 : 0;

                  return (
                    <div
                      key={seller.vendedor}
                      className="flex items-center gap-3 p-3 md:p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                      onClick={() => {
                        // Navigate to seller detail page if we can find their ID
                        // For now just show the detail inline
                      }}
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
                            className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${percentual}%` }}
                          />
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 transition-colors flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
