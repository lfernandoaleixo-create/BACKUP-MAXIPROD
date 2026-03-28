/*
 * Dashboard Grupo Fox - Aba de Vendas
 * Analytics de pedidos de venda do Maxiprod
 */

import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  FileCheck,
  Clock,
  BarChart3,
  Loader2,
  ArrowLeft,
  MapPin,
  Tag,
  Factory,
  Leaf,
  Search,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
import TopNav from "@/components/TopNav";

/* ---- Helpers ---- */
function formatCurrencyFull(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function getMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
}

/* ---- Period helpers ---- */
function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function getPeriodRange(period: string): { start: string; end: string; label: string } {
  const now = new Date();
  
  if (period === "current_month") {
    const { start, end } = getMonthRange(now.getFullYear(), now.getMonth());
    return { start, end, label: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  }
  if (period === "last_month") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const { start, end } = getMonthRange(d.getFullYear(), d.getMonth());
    return { start, end, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  }
  if (period === "last_3_months") {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const { start } = getMonthRange(d.getFullYear(), d.getMonth());
    const { end } = getMonthRange(now.getFullYear(), now.getMonth());
    return { start, end, label: "Ultimos 3 meses" };
  }
  if (period === "last_6_months") {
    const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const { start } = getMonthRange(d.getFullYear(), d.getMonth());
    const { end } = getMonthRange(now.getFullYear(), now.getMonth());
    return { start, end, label: "Ultimos 6 meses" };
  }
  if (period === "all") {
    return {
      start: "2020-01-01T00:00:00.000Z",
      end: "2030-12-31T23:59:59.999Z",
      label: "Todo o periodo",
    };
  }
  // Custom period: "custom:YYYY-MM-DD:YYYY-MM-DD"
  if (period.startsWith("custom:")) {
    const parts = period.split(":");
    const startDate = parts[1];
    const endDate = parts[2];
    if (startDate && endDate) {
      const s = new Date(startDate + "T00:00:00.000Z");
      const e = new Date(endDate + "T23:59:59.999Z");
      const fmtStart = s.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      const fmtEnd = e.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
      return { start: s.toISOString(), end: e.toISOString(), label: `${fmtStart} a ${fmtEnd}` };
    }
  }
  const { start, end } = getMonthRange(now.getFullYear(), now.getMonth());
  return { start, end, label: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
}

/* ---- KPI Card (same style as Estoque) ---- */
const kpiStyles: Record<string, { iconBg: string; iconColor: string; bar: string }> = {
  teal:    { iconBg: "bg-teal-50",    iconColor: "text-teal-600",    bar: "bg-gradient-to-r from-teal-400 to-teal-600" },
  orange:  { iconBg: "bg-orange-50",  iconColor: "text-orange-600",  bar: "bg-gradient-to-r from-orange-400 to-orange-600" },
  emerald: { iconBg: "bg-emerald-50", iconColor: "text-emerald-600", bar: "bg-gradient-to-r from-emerald-400 to-emerald-600" },
  blue:    { iconBg: "bg-blue-50",    iconColor: "text-blue-600",    bar: "bg-gradient-to-r from-blue-400 to-blue-600" },
  indigo:  { iconBg: "bg-indigo-50",  iconColor: "text-indigo-600",  bar: "bg-gradient-to-r from-indigo-400 to-indigo-600" },
  violet:  { iconBg: "bg-violet-50",  iconColor: "text-violet-600",  bar: "bg-gradient-to-r from-violet-400 to-violet-600" },
  red:     { iconBg: "bg-red-50",     iconColor: "text-red-600",     bar: "bg-gradient-to-r from-red-400 to-red-600" },
  amber:   { iconBg: "bg-amber-50",   iconColor: "text-amber-600",   bar: "bg-gradient-to-r from-amber-400 to-amber-600" },
  slate:   { iconBg: "bg-slate-50",   iconColor: "text-slate-500",   bar: "bg-gradient-to-r from-slate-300 to-slate-400" },
};

function KPICard({ label, value, sub, icon: Icon, theme }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  theme: keyof typeof kpiStyles;
}) {
  const s = kpiStyles[theme];
  return (
    <div className="group relative bg-white rounded-xl border border-slate-100 overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      <div className={`h-1 ${s.bar}`} />
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider leading-tight">{label}</p>
          <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${s.iconBg} transition-transform group-hover:scale-110`}>
            <Icon className={`w-4 h-4 ${s.iconColor}`} />
          </div>
        </div>
        <p className="text-lg font-extrabold text-slate-900 tracking-tight leading-none truncate" title={value}>{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-1.5 font-medium">{sub}</p>}
      </div>
    </div>
  );
}

function KPICardWithBreakdown({ label, value, sub, icon: Icon, theme, segments }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  theme: keyof typeof kpiStyles;
  segments?: Array<{ name: string; value: string; color: string }>;
}) {
  const s = kpiStyles[theme];
  return (
    <div className="group relative bg-white rounded-xl border border-slate-100 overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      <div className={`h-1 ${s.bar}`} />
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider leading-tight">{label}</p>
          <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${s.iconBg} transition-transform group-hover:scale-110`}>
            <Icon className={`w-4 h-4 ${s.iconColor}`} />
          </div>
        </div>
        <p className="text-lg font-extrabold text-slate-900 tracking-tight leading-none truncate" title={value}>{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-1.5 font-medium">{sub}</p>}
        {segments && segments.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
            {segments.map((seg) => (
              <div key={seg.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${seg.color}`} />
                  <span className="text-[10px] text-slate-500 font-medium">{seg.name}</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-700">{seg.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Daily Evolution Chart (CSS bars) - All days of month ---- */
function DailyChart({ data, mode, period }: { data: Array<{ day: string; value: number; orders: number }>; mode: "value" | "orders"; period: string }) {
  // Build a map of existing data
  const dataMap = useMemo(() => {
    const map = new Map<string, { value: number; orders: number }>();
    for (const d of data) {
      map.set(d.day, { value: d.value, orders: d.orders });
    }
    return map;
  }, [data]);

  // Generate all days of the current selected month(s)
  const allDays = useMemo(() => {
    if (data.length === 0) return [];

    // For single-month periods, show all days 1-31 of that month
    if (period === "current_month" || period === "last_month") {
      const firstDay = data[0]?.day || new Date().toISOString().substring(0, 10);
      const [y, m] = firstDay.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const days: Array<{ day: string; value: number; orders: number; isFuture: boolean }> = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const existing = dataMap.get(dayStr);
        days.push({
          day: dayStr,
          value: existing?.value || 0,
          orders: existing?.orders || 0,
          isFuture: dayStr > todayStr,
        });
      }
      return days;
    }

    // For multi-month periods, just use the data as-is
    return data.map(d => ({ ...d, isFuture: false }));
  }, [data, dataMap, period]);

  if (allDays.length === 0) return <p className="text-sm text-slate-400 text-center py-8">Sem dados para o periodo</p>;

  const key = mode === "value" ? "value" : "orders";
  const maxVal = Math.max(...allDays.map((d) => d[key]), 1);
  const maxBarHeight = 140; // px

  const formatWeekday = (dayStr: string) => {
    const d = new Date(dayStr + "T12:00:00");
    const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"];
    return weekdays[d.getDay()];
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-px" style={{ minWidth: "100%" }}>
        {allDays.map((item, idx) => {
          const val = item[key];
          const barHeight = val > 0 ? Math.max(Math.round((val / maxVal) * maxBarHeight), 3) : 0;
          const isWeekend = new Date(item.day + "T12:00:00").getDay() === 0 || new Date(item.day + "T12:00:00").getDay() === 6;
          const dayNum = parseInt(item.day.split("-")[2]);

          return (
            <div
              key={idx}
              className="flex flex-col items-center"
              style={{ flex: "1", minWidth: "22px", maxWidth: "32px" }}
              title={`Dia ${dayNum} (${formatWeekday(item.day)}) \u2014 ${mode === "value" ? formatCurrencyFull(item.value) : item.orders + " pedidos"}`}
            >
              {/* Value label */}
              <span className="text-[10px] font-bold text-slate-600 text-center whitespace-nowrap" style={{ minHeight: "16px" }}>
                {val > 0 ? (mode === "value" ? (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)) : val) : ""}
              </span>
              {/* Bar */}
              <div className="w-full relative" style={{ height: `${maxBarHeight}px` }}>
                <div
                  className={`w-[70%] mx-auto rounded-t-sm absolute bottom-0 left-[15%] transition-all duration-300 ${
                    item.isFuture ? "bg-slate-50 border border-dashed border-slate-200" :
                    val === 0 ? "bg-slate-100" :
                    isWeekend ? "bg-slate-300" : "bg-teal-500"
                  }`}
                  style={{ height: item.isFuture ? `${maxBarHeight}px` : val > 0 ? `${barHeight}px` : "2px" }}
                />
              </div>
              {/* Day number */}
              <span className={`text-[11px] font-semibold mt-1 ${isWeekend ? "text-red-400" : "text-slate-600"}`}>
                {dayNum}
              </span>
              {/* Weekday */}
              <span className={`text-[10px] ${isWeekend ? "text-red-300" : "text-slate-400"}`}>
                {formatWeekday(item.day)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Cumulative Line Chart with comparison ---- */
function CumulativeLineChart({ comparison }: {
  comparison: {
    currentMonth: Array<{ day: number; value: number; cumulative: number }>;
    currentMonthLabel?: string;
    lastMonth: Array<{ day: number; value: number; cumulative: number }>;
    lastMonthLabel?: string;
    bestMonth: Array<{ day: number; value: number; cumulative: number }>;
    bestMonthLabel?: string;
  };
}) {
  const { currentMonth, lastMonth, bestMonth } = comparison;

  // Find max cumulative across all series for Y-axis scaling
  const allCumulatives = [
    ...currentMonth.map(d => d.cumulative),
    ...lastMonth.map(d => d.cumulative),
    ...bestMonth.map(d => d.cumulative),
  ];
  const maxCumulative = Math.max(...allCumulatives, 1);

  // Chart dimensions
  const chartWidth = 800;
  const chartHeight = 220;
  const paddingLeft = 80;
  const paddingRight = 20;
  const paddingTop = 10;
  const paddingBottom = 30;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  // Max days across all series
  const maxDays = Math.max(currentMonth.length, lastMonth.length, bestMonth.length, 28);

  // Build SVG path from data
  const buildPath = (data: Array<{ day: number; cumulative: number }>) => {
    if (data.length === 0) return "";
    return data.map((d, i) => {
      const x = paddingLeft + ((d.day - 1) / (maxDays - 1)) * plotWidth;
      const y = paddingTop + plotHeight - (d.cumulative / maxCumulative) * plotHeight;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  };

  // Today's day number (for current month indicator)
  const today = new Date().getDate();

  // Y-axis labels (5 ticks)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    value: maxCumulative * pct,
    y: paddingTop + plotHeight - pct * plotHeight,
  }));

  // X-axis labels (every 5 days)
  const xTicks: Array<{ day: number; x: number }> = [];
  for (let d = 1; d <= maxDays; d += 5) {
    xTicks.push({ day: d, x: paddingLeft + ((d - 1) / (maxDays - 1)) * plotWidth });
  }
  // Always include last day
  xTicks.push({ day: maxDays, x: paddingLeft + ((maxDays - 1) / (maxDays - 1)) * plotWidth });

  // Current month's latest point for label
  const currentLatest = currentMonth.length > 0 ? currentMonth[currentMonth.length - 1] : null;
  const lastLatest = lastMonth.length > 0 ? lastMonth[lastMonth.length - 1] : null;
  const bestLatest = bestMonth.length > 0 ? bestMonth[bestMonth.length - 1] : null;

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-teal-500 rounded" />
          <span className="text-xs font-semibold text-teal-700">Mes Atual ({comparison.currentMonthLabel})</span>
          {currentLatest && <span className="text-xs text-teal-600 font-bold">{formatCurrencyFull(currentLatest.cumulative)}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-blue-400 rounded" />
          <span className="text-xs font-semibold text-blue-600">Mes Anterior ({comparison.lastMonthLabel})</span>
          {lastLatest && <span className="text-xs text-blue-500 font-bold">{formatCurrencyFull(lastLatest.cumulative)}</span>}
        </div>
        {bestMonth.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-amber-400 rounded" />
            <span className="text-xs font-semibold text-amber-600">Melhor Mes ({comparison.bestMonthLabel})</span>
            {bestLatest && <span className="text-xs text-amber-500 font-bold">{formatCurrencyFull(bestLatest.cumulative)}</span>}
          </div>
        )}
      </div>

      {/* SVG Chart */}
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ minWidth: "500px" }}>
          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line x1={paddingLeft} y1={tick.y} x2={chartWidth - paddingRight} y2={tick.y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={paddingLeft - 8} y={tick.y + 4} textAnchor="end" className="text-[10px]" fill="#94a3b8">
                {tick.value >= 1000 ? `${(tick.value / 1000).toFixed(0)}k` : tick.value.toFixed(0)}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {xTicks.map((tick, i) => (
            <text key={i} x={tick.x} y={chartHeight - 5} textAnchor="middle" className="text-[10px]" fill="#94a3b8">
              {tick.day}
            </text>
          ))}

          {/* Best month line (background) */}
          {bestMonth.length > 0 && (
            <path d={buildPath(bestMonth)} fill="none" stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="6 3" opacity="0.7" />
          )}

          {/* Last month line */}
          {lastMonth.length > 0 && (
            <path d={buildPath(lastMonth)} fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.8" />
          )}

          {/* Current month line (on top) */}
          {currentMonth.length > 0 && (
            <>
              <path d={buildPath(currentMonth)} fill="none" stroke="#14b8a6" strokeWidth="1.8" />
              {/* Dot on the latest day */}
              {currentLatest && (
                <circle
                  cx={paddingLeft + ((currentLatest.day - 1) / (maxDays - 1)) * plotWidth}
                  cy={paddingTop + plotHeight - (currentLatest.cumulative / maxCumulative) * plotHeight}
                  r="3.5"
                  fill="#14b8a6"
                  stroke="white"
                  strokeWidth="1.5"
                />
              )}
            </>
          )}

          {/* Today marker line */}
          {today <= maxDays && (
            <line
              x1={paddingLeft + ((today - 1) / (maxDays - 1)) * plotWidth}
              y1={paddingTop}
              x2={paddingLeft + ((today - 1) / (maxDays - 1)) * plotWidth}
              y2={paddingTop + plotHeight}
              stroke="#14b8a6"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.5"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

/* ---- UF Map (simple table) ---- */
function UFTable({ data }: { data: Array<{ uf: string; value: number }> }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="space-y-1.5">
      {data.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono w-8 justify-center flex-shrink-0">
            {item.uf}
          </Badge>
          <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${Math.max((item.value / (data[0]?.value || 1)) * 100, 2)}%` }}
            />
          </div>
          <span className="text-xs text-slate-600 w-28 text-right flex-shrink-0">
            {formatCurrencyFull(item.value)}
          </span>
          <span className="text-xs text-slate-400 w-10 text-right flex-shrink-0">
            {total > 0 ? `${((item.value / total) * 100).toFixed(0)}%` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---- Segmento List ---- */
function SegmentoList({ data }: { data: Array<{ segmento: string; value: number }> }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const colors = ["bg-teal-500", "bg-blue-500", "bg-violet-500", "bg-orange-500", "bg-emerald-500", "bg-pink-500", "bg-amber-500", "bg-cyan-500"];
  
  return (
    <div className="space-y-2">
      {data.map((item, idx) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <div key={idx} className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]} flex-shrink-0`} />
            <span className="text-sm text-slate-700 flex-1 truncate">{item.segmento}</span>
            <span className="text-xs text-slate-500 w-12 text-right">{pct.toFixed(0)}%</span>
            <span className="text-xs font-semibold text-slate-700 w-28 text-right">{formatCurrencyFull(item.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---- Sort types ---- */
type ClientSortField = "name" | "value" | "orders" | "uf" | "segmento";
type ProductSortField = "name" | "value" | "qty" | "orders";
type SortDir = "asc" | "desc";

/* ---- Full Client Ranking with filters ---- */
function ClientRanking({ data }: { data: Array<{ name: string; value: number; orders: number; items: number; uf: string; segmento: string }> }) {
  const [search, setSearch] = useState("");
  const [ufFilter, setUfFilter] = useState("all");
  const [segFilter, setSegFilter] = useState("all");
  const [sortField, setSortField] = useState<ClientSortField>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Extract unique UFs and segmentos for filter dropdowns
  const ufs = useMemo(() => Array.from(new Set(data.map(d => d.uf).filter(Boolean))).sort(), [data]);
  const segmentos = useMemo(() => Array.from(new Set(data.map(d => d.segmento).filter(Boolean))).sort(), [data]);

  const filtered = useMemo(() => {
    let result = [...data];

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(s) ||
        c.uf.toLowerCase().includes(s) ||
        c.segmento.toLowerCase().includes(s)
      );
    }
    if (ufFilter !== "all") {
      result = result.filter(c => c.uf === ufFilter);
    }
    if (segFilter !== "all") {
      result = result.filter(c => c.segmento === segFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name" || sortField === "uf" || sortField === "segmento") {
        cmp = (a[sortField] || "").localeCompare(b[sortField] || "");
      } else {
        cmp = (a[sortField] || 0) - (b[sortField] || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [data, search, ufFilter, segFilter, sortField, sortDir]);

  const totalFiltered = filtered.reduce((sum, c) => sum + c.value, 0);

  const handleSort = (field: ClientSortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  };

  const SortHeader = ({ field, children, align = "left" }: { field: ClientSortField; children: React.ReactNode; align?: "left" | "right" }) => (
    <th
      className={`px-3 py-2.5 text-${align} text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-teal-600 select-none`}
      onClick={() => handleSort(field)}
    >
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-teal-600" : "text-slate-300"}`} />
      </div>
    </th>
  );

  return (
    <div>
      {/* Filters */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Ranking de Clientes
          </h3>
          <span className="text-xs text-slate-400">
            {filtered.length} de {data.length} clientes &bull; Total: {formatCurrencyFull(totalFiltered)}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar cliente, UF, segmento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white h-9 text-sm"
            />
          </div>
          <Select value={ufFilter} onValueChange={setUfFilter}>
            <SelectTrigger className="w-full sm:w-36 bg-white h-9">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos UFs</SelectItem>
              {ufs.map(uf => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={segFilter} onValueChange={setSegFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-white h-9">
              <SelectValue placeholder="Segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Segmentos</SelectItem>
              {segmentos.map(seg => (
                <SelectItem key={seg} value={seg}>{seg}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-10">#</th>
              <SortHeader field="name">Cliente</SortHeader>
              <SortHeader field="uf">UF</SortHeader>
              <SortHeader field="segmento">Segmento</SortHeader>
              <SortHeader field="orders" align="right">Pedidos</SortHeader>
              <SortHeader field="value" align="right">Valor Total</SortHeader>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">% Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((client, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 text-xs text-slate-400 font-mono">{idx + 1}</td>
                <td className="px-3 py-2 text-sm font-medium text-slate-800 max-w-[250px]" title={client.name}>
                  <span className="truncate block">{client.name}</span>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="text-xs">{client.uf || "—"}</Badge>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{client.segmento || "—"}</td>
                <td className="px-3 py-2 text-sm text-right text-slate-600">{client.orders}</td>
                <td className="px-3 py-2 text-sm text-right font-semibold text-slate-800">{formatCurrencyFull(client.value)}</td>
                <td className="px-3 py-2 text-xs text-right text-slate-400">
                  {totalFiltered > 0 ? `${((client.value / totalFiltered) * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum cliente encontrado</p>
        </div>
      )}
    </div>
  );
}

/* ---- Full Product Ranking with filters ---- */
function ProductRanking({ data }: { data: Array<{ name: string; value: number; qty: number; orders: number }> }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<ProductSortField>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    let result = [...data];

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(s));
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = (a[sortField] || 0) - (b[sortField] || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [data, search, sortField, sortDir]);

  const totalFiltered = filtered.reduce((sum, p) => sum + p.value, 0);

  const handleSort = (field: ProductSortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  };

  const SortHeader = ({ field, children, align = "left" }: { field: ProductSortField; children: React.ReactNode; align?: "left" | "right" }) => (
    <th
      className={`px-3 py-2.5 text-${align} text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-teal-600 select-none`}
      onClick={() => handleSort(field)}
    >
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-teal-600" : "text-slate-300"}`} />
      </div>
    </th>
  );

  return (
    <div>
      {/* Filters */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Ranking de Produtos
          </h3>
          <span className="text-xs text-slate-400">
            {filtered.length} de {data.length} produtos &bull; Total: {formatCurrencyFull(totalFiltered)}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white h-9 text-sm max-w-md"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-10">#</th>
              <SortHeader field="name">Produto</SortHeader>
              <SortHeader field="qty" align="right">Quantidade</SortHeader>
              <SortHeader field="orders" align="right">Pedidos</SortHeader>
              <SortHeader field="value" align="right">Valor Total</SortHeader>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">% Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((product, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 text-xs text-slate-400 font-mono">{idx + 1}</td>
                <td className="px-3 py-2 text-sm font-medium text-slate-800 max-w-[350px]" title={product.name}>
                  <span className="truncate block">{product.name}</span>
                </td>
                <td className="px-3 py-2 text-sm text-right text-slate-600">{formatNumber(product.qty)}</td>
                <td className="px-3 py-2 text-sm text-right text-slate-600">{product.orders}</td>
                <td className="px-3 py-2 text-sm text-right font-semibold text-slate-800">{formatCurrencyFull(product.value)}</td>
                <td className="px-3 py-2 text-xs text-right text-slate-400">
                  {totalFiltered > 0 ? `${((product.value / totalFiltered) * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum produto encontrado</p>
        </div>
      )}
    </div>
  );
}

/* ---- Simple Bar Chart for overview top 10 ---- */
function SimpleBarChart({ data, labelKey, valueKey, formatValue, maxBars = 10, color = "bg-teal-500" }: {
  data: Array<Record<string, any>>;
  labelKey: string;
  valueKey: string;
  formatValue: (v: number) => string;
  maxBars?: number;
  color?: string;
}) {
  const sliced = data.slice(0, maxBars);
  const maxVal = Math.max(...sliced.map((d) => d[valueKey] || 0), 1);

  return (
    <div className="space-y-2">
      {sliced.map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <div className="w-36 sm:w-48 text-xs text-slate-600 truncate text-right flex-shrink-0" title={item[labelKey]}>
            {item[labelKey]}
          </div>
          <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${color} rounded-full transition-all duration-500`}
              style={{ width: `${Math.max((item[valueKey] / maxVal) * 100, 2)}%` }}
            />
          </div>
          <div className="w-28 text-xs font-semibold text-slate-700 text-right flex-shrink-0">
            {formatValue(item[valueKey])}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Main Sales Page ---- */
export default function Sales() {
  const [period, setPeriod] = useState("current_month");
  const [team, setTeam] = useState<"all" | "industrializacao" | "importacao">("all");
  const [chartMode, setChartMode] = useState<"value" | "orders">("value");
  const [activeTab, setActiveTab] = useState<"overview" | "clients" | "products">("overview");
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const handlePeriodChange = useCallback((v: string) => {
    if (v === "custom") {
      setShowCustomDates(true);
      // Don't change period yet, wait for dates
    } else {
      setShowCustomDates(false);
      setPeriod(v);
    }
  }, []);

  const applyCustomDates = useCallback((s?: string, e?: string) => {
    const startVal = s || customStart;
    const endVal = e || customEnd;
    if (startVal && endVal) {
      setPeriod(`custom:${startVal}:${endVal}`);
    }
  }, [customStart, customEnd]);

  const handleCustomStartChange = useCallback((val: string) => {
    setCustomStart(val);
    if (val && customEnd) {
      setPeriod(`custom:${val}:${customEnd}`);
    }
  }, [customEnd]);

  const handleCustomEndChange = useCallback((val: string) => {
    setCustomEnd(val);
    if (customStart && val) {
      setPeriod(`custom:${customStart}:${val}`);
    }
  }, [customStart]);

  const { start, end, label } = useMemo(() => getPeriodRange(period), [period]);

  const { data: dateRange } = trpc.sales.getDateRange.useQuery();
  const { data: analytics, isLoading } = trpc.sales.getAnalytics.useQuery(
    { startDate: start, endDate: end, team },
    { enabled: !!dateRange && (dateRange.totalCount ?? 0) > 0 }
  );

  // Cumulative comparison data for line chart
  const { data: comparison } = trpc.sales.getCumulativeComparison.useQuery(
    { team },
    { enabled: !!dateRange && (dateRange.totalCount ?? 0) > 0 }
  );

  const hasData = dateRange && (dateRange.totalCount ?? 0) > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />

      {/* Filters bar */}
      <div className="bg-white border-b border-slate-100">
        <div className="container py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
              {/* Segment filter */}
              <Select value={team} onValueChange={(v) => setTeam(v as any)}>
                <SelectTrigger className="w-52 bg-white">
                  <SelectValue placeholder="Segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">Todos os Segmentos</span>
                  </SelectItem>
                  <SelectItem value="industrializacao">
                    <span className="flex items-center gap-2">
                      <Factory className="w-3.5 h-3.5 text-violet-500" />
                      Industrializacao
                    </span>
                  </SelectItem>
                  <SelectItem value="importacao">
                    <span className="flex items-center gap-2">
                      <Leaf className="w-3.5 h-3.5 text-teal-500" />
                      Importacao (Bambu)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Period selector */}
              <Select
                value={period.startsWith("custom:") ? "custom" : period}
                onValueChange={handlePeriodChange}
              >
                <SelectTrigger className="w-48 bg-white">
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_month">Mes atual</SelectItem>
                  <SelectItem value="last_month">Mes anterior</SelectItem>
                  <SelectItem value="last_3_months">Ultimos 3 meses</SelectItem>
                  <SelectItem value="last_6_months">Ultimos 6 meses</SelectItem>
                  <SelectItem value="all">Todo o periodo</SelectItem>
                  <SelectItem value="custom">Periodo personalizado</SelectItem>
                </SelectContent>
              </Select>
          </div>

          {/* Custom date range picker */}
          {(showCustomDates || period.startsWith("custom:")) && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500 uppercase">De:</span>
              <input
                type="date"
                value={customStart || (period.startsWith("custom:") ? period.split(":")[1] : "")}
                onChange={(e) => handleCustomStartChange(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <span className="text-xs font-medium text-slate-500 uppercase">Ate:</span>
              <input
                type="date"
                value={customEnd || (period.startsWith("custom:") ? period.split(":")[2] : "")}
                onChange={(e) => handleCustomEndChange(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <Button
                size="sm"
                onClick={() => applyCustomDates()}
                disabled={!customStart || !customEnd}
                className="bg-teal-500 hover:bg-teal-600 text-white"
              >
                Aplicar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowCustomDates(false); setPeriod("current_month"); setCustomStart(""); setCustomEnd(""); }}
                className="text-slate-500"
              >
                Limpar
              </Button>
            </div>
          )}
        </div>
      </div>

      <main className="container py-6 space-y-6">
        {!hasData ? (
          <div className="text-center py-20">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-500">Nenhum dado de vendas carregado</p>
            <p className="text-sm text-slate-400 mt-1">Carregue os dados de vendas do Maxiprod para ver as analytics</p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-teal-500" />
            <p className="text-slate-500">Calculando analytics...</p>
          </div>
        ) : analytics ? (
          <>
            {/* Period + team label */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-slate-500">
                Periodo: <span className="font-semibold text-slate-700">{label}</span>
                {team !== "all" && (
                  <>
                    {" "}&bull;{" "}
                    <span className="font-semibold text-slate-700">
                      {team === "industrializacao" ? "Industrializacao" : "Importacao (Bambu)"}
                    </span>
                  </>
                )}
                {" "}&mdash; {analytics.totalItems} itens em {analytics.totalOrders} pedidos
              </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KPICardWithBreakdown
                label="Valor Total"
                value={formatCurrencyFull(analytics.totalValue)}
                sub={`${analytics.totalOrders} pedidos`}
                icon={DollarSign}
                theme="teal"
                segments={(analytics.bySegmentKPI || []).map(s => ({
                  name: s.name,
                  value: formatCurrencyFull(s.value),
                  color: s.name === "Bambu" ? "bg-teal-500" : s.name === "Industrializado" ? "bg-violet-500" : "bg-slate-400",
                }))}
              />
              <KPICardWithBreakdown
                label="Faturado"
                value={formatCurrencyFull(analytics.totalFaturado)}
                sub={`${((analytics.totalFaturado / (analytics.totalValue || 1)) * 100).toFixed(0)}% do total`}
                icon={FileCheck}
                theme="emerald"
                segments={(analytics.bySegmentKPI || []).filter(s => s.faturado > 0).map(s => ({
                  name: s.name,
                  value: formatCurrencyFull(s.faturado),
                  color: s.name === "Bambu" ? "bg-teal-500" : s.name === "Industrializado" ? "bg-violet-500" : "bg-slate-400",
                }))}
              />
              <KPICardWithBreakdown
                label="A Faturar (Periodo)"
                value={formatCurrencyFull(analytics.totalAFaturar)}
                sub="Periodo selecionado"
                icon={Clock}
                theme="orange"
                segments={(analytics.bySegmentKPI || []).filter(s => s.aFaturar > 0).map(s => ({
                  name: s.name,
                  value: formatCurrencyFull(s.aFaturar),
                  color: s.name === "Bambu" ? "bg-teal-500" : s.name === "Industrializado" ? "bg-violet-500" : "bg-slate-400",
                }))}
              />
              <KPICardWithBreakdown
                label="A Faturar (Anterior)"
                value={formatCurrencyFull(analytics.totalAFaturarAnterior ?? 0)}
                sub="Meses anteriores"
                icon={AlertTriangle}
                theme="red"
                segments={(analytics.bySegmentKPI || []).filter(s => s.aFaturarAnterior > 0).map(s => ({
                  name: s.name,
                  value: formatCurrencyFull(s.aFaturarAnterior),
                  color: s.name === "Bambu" ? "bg-teal-500" : s.name === "Industrializado" ? "bg-violet-500" : "bg-slate-400",
                }))}
              />
              <KPICard
                label="Clientes"
                value={formatNumber(analytics.totalClients)}
                sub="Unicos no periodo"
                icon={Users}
                theme="violet"
              />
              <KPICard
                label="Itens"
                value={formatNumber(analytics.totalItems)}
                sub="Linhas de pedido"
                icon={TrendingUp}
                theme="indigo"
              />
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1 shadow-sm w-fit">
              {[
                { key: "overview" as const, label: "Visao Geral" },
                { key: "clients" as const, label: `Clientes (${analytics.byClient.length})` },
                { key: "products" as const, label: `Produtos (${analytics.byProduct.length})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.key
                      ? "bg-teal-500 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily evolution */}
                <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                      Evolucao Diaria
                    </h3>
                    <div className="flex gap-1 bg-slate-100 rounded-md p-0.5">
                      <button
                        onClick={() => setChartMode("value")}
                        className={`px-3 py-1 text-xs rounded-md ${chartMode === "value" ? "bg-white shadow-sm text-slate-700" : "text-slate-500"}`}
                      >
                        Valor (R$)
                      </button>
                      <button
                        onClick={() => setChartMode("orders")}
                        className={`px-3 py-1 text-xs rounded-md ${chartMode === "orders" ? "bg-white shadow-sm text-slate-700" : "text-slate-500"}`}
                      >
                        Pedidos
                      </button>
                    </div>
                  </div>
                  <DailyChart data={analytics.byDay} mode={chartMode} period={period} />
                </div>

                {/* Cumulative comparison line chart */}
                {comparison && comparison.currentMonth.length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm lg:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-teal-500" />
                      Evolucao Acumulada — Mes Atual vs Anterior vs Melhor
                    </h3>
                    <CumulativeLineChart comparison={comparison} />
                  </div>
                )}

                {/* By UF */}
                <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    Vendas por UF
                  </h3>
                  <UFTable data={analytics.byUF} />
                </div>

                {/* By Segmento */}
                <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-violet-500" />
                    Vendas por Segmento
                  </h3>
                  <SegmentoList data={analytics.bySegmento} />
                </div>

                {/* Top Products (bar) */}
                <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm lg:col-span-2">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
                    Top 10 Produtos por Valor
                  </h3>
                  <SimpleBarChart
                    data={analytics.byProduct}
                    labelKey="name"
                    valueKey="value"
                    formatValue={formatCurrencyFull}
                    maxBars={10}
                    color="bg-teal-500"
                  />
                </div>
              </div>
            )}

            {activeTab === "clients" && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <ClientRanking data={analytics.byClient} />
              </div>
            )}

            {activeTab === "products" && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <ProductRanking data={analytics.byProduct} />
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
