/*
 * Dashboard Grupo Fox - Aba de Vendas
 * Analytics de pedidos de venda do Maxiprod
 */

import React, { useState, useMemo, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import ConnectionStatusCard from "@/components/ConnectionStatusCard";
import { ClientSearchCard } from "@/components/ClientSearchCard";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Package,
  ClipboardList,
  Calendar,
  PenLine,
  Building2,
  CreditCard,
  Truck,
  AlertCircle,
  CheckCircle,
  Copy,
  User,
  FileDown,
  Phone,
  Mail,
  ListFilter,
  Gift,
  Eye,
  ExternalLink,
  X,
  CheckCircle2,
  Ban,
  Info,
} from "lucide-react";
import { Link } from "wouter";
import TopNav from "@/components/TopNav";
import { InadimplenciaCard, ClientesInadimplentesCard } from "@/components/InadimplenciaCards";
import { generateSalesPDF } from "@/lib/salesPdfExport";
import { useOperator } from "@/contexts/OperatorContext";
import MaxiprodAutoVerifier from "@/components/MaxiprodAutoVerifier";
import type { VerifySection } from "@/components/MaxiprodAutoVerifier";
import FornecedoresBrasileirosTab from "@/components/FornecedoresBrasileirosTab";
import MetricaVendasTab from "@/components/MetricaVendasTab";

const MAXIPROD_AUTHORIZED_OPERATORS = ["Guilherme", "Fernando", "Bruno"];
const MAXIPROD_LOGIN_URL = "https://app.maxiprod.com.br/";

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
// Usa strings YYYY-MM-DD para evitar bugs de timezone (UTC vs BRT)
function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

function getMonthRangeStr(year: number, month: number): { start: string; end: string } {
  // month: 0-indexed (0=Jan, 11=Dec)
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    start: `${year}-${pad2(month + 1)}-01`,
    end: `${year}-${pad2(month + 1)}-${pad2(lastDay)}`,
  };
}

function getPeriodRange(period: string): { start: string; end: string; label: string } {
  const now = new Date();
  // Usar data local do navegador (que está no fuso do usuário)
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  
  if (period === "current_month") {
    const { start, end } = getMonthRangeStr(y, m);
    return { start, end, label: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  }
  if (period === "last_month") {
    const d = new Date(y, m - 1, 1);
    const { start, end } = getMonthRangeStr(d.getFullYear(), d.getMonth());
    return { start, end, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  }
  if (period === "last_3_months") {
    const d = new Date(y, m - 2, 1);
    const { start } = getMonthRangeStr(d.getFullYear(), d.getMonth());
    const { end } = getMonthRangeStr(y, m);
    return { start, end, label: "Ultimos 3 meses" };
  }
  if (period === "last_6_months") {
    const d = new Date(y, m - 5, 1);
    const { start } = getMonthRangeStr(d.getFullYear(), d.getMonth());
    const { end } = getMonthRangeStr(y, m);
    return { start, end, label: "Ultimos 6 meses" };
  }
  if (period === "all") {
    return {
      start: "2020-01-01",
      end: "2030-12-31",
      label: "Todo o periodo",
    };
  }
  // Custom period: "custom:YYYY-MM-DD:YYYY-MM-DD"
  if (period.startsWith("custom:")) {
    const parts = period.split(":");
    const startDate = parts[1];
    const endDate = parts[2];
    if (startDate && endDate) {
      const [sY, sM, sD] = startDate.split("-").map(Number);
      const [eY, eM, eD] = endDate.split("-").map(Number);
      const sLocal = new Date(sY, sM - 1, sD);
      const eLocal = new Date(eY, eM - 1, eD);
      const fmtStart = sLocal.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      const fmtEnd = eLocal.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
      return { start: startDate, end: endDate, label: `${fmtStart} a ${fmtEnd}` };
    }
  }
  const { start, end } = getMonthRangeStr(y, m);
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

/* ---- Segment Table Body with expandable "Outros" ---- */
type SegmentDetail = { name: string; value: number; faturado: number; aFaturar: number; aFaturarAnterior: number };
type SegmentRow = { name: string; value: number; faturado: number; aFaturar: number; aFaturarAnterior: number; detail?: SegmentDetail[] };

function SegmentTableBody({ segments, totalValue }: { segments: SegmentRow[]; totalValue: number }) {
  const [outrosExpanded, setOutrosExpanded] = useState(false);

  return (
    <tbody className="divide-y divide-slate-50">
      {segments.map((seg) => {
        const pctTotal = totalValue > 0 ? ((seg.value / totalValue) * 100) : 0;
        const segColor = seg.name.includes("Revenda") ? "bg-teal-500" : seg.name.includes("Industrializado") ? "bg-violet-500" : seg.name.includes("Matéria") ? "bg-blue-500" : "bg-slate-400";
        const isOutros = seg.name === "Outros" && seg.detail && seg.detail.length > 0;

        return (
          <React.Fragment key={seg.name}>
            <tr
              className={`hover:bg-slate-50 transition-colors ${isOutros ? "cursor-pointer" : ""}`}
              onClick={isOutros ? () => setOutrosExpanded(!outrosExpanded) : undefined}
            >
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <span className={`w-3 h-3 rounded-full ${segColor} flex-shrink-0`} />
                  <span className="text-sm font-semibold text-slate-800">{seg.name}</span>
                  {isOutros && (
                    outrosExpanded
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-sm font-bold text-slate-900">{formatCurrencyFull(seg.value)}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-sm font-semibold text-emerald-700">{formatCurrencyFull(seg.faturado)}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-sm font-semibold text-orange-700">{seg.aFaturar > 0 ? formatCurrencyFull(seg.aFaturar) : "—"}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${segColor} rounded-full`} style={{ width: `${pctTotal}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-600 w-10 text-right">{pctTotal.toFixed(0)}%</span>
                </div>
              </td>
            </tr>
            {isOutros && outrosExpanded && seg.detail!.map((d) => {
              const dPct = totalValue > 0 ? ((d.value / totalValue) * 100) : 0;
              return (
                <tr key={`outros-${d.name}`} className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                  <td className="px-5 py-2 pl-12">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                      <span className="text-xs font-medium text-slate-600">{d.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="text-xs font-semibold text-slate-700">{formatCurrencyFull(d.value)}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="text-xs font-medium text-emerald-600">{formatCurrencyFull(d.faturado)}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="text-xs font-medium text-orange-600">{d.aFaturar > 0 ? formatCurrencyFull(d.aFaturar) : "—"}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="text-xs text-slate-500">{dPct.toFixed(1)}%</span>
                  </td>
                </tr>
              );
            })}
          </React.Fragment>
        );
      })}
    </tbody>
  );
}

/* ---- Daily Evolution Chart (SVG bars + line overlays) ---- */
function DailyChart({ data, mode, period, comparison }: {
  data: Array<{ day: string; value: number; orders: number; orderList?: Array<{ pedido: string; cliente: string; valor: number }> }>;
  mode: "value" | "orders";
  period: string;
  comparison?: {
    currentMonth: Array<{ day: number; value: number; cumulative: number }>;
    currentMonthLabel?: string;
    lastMonth: Array<{ day: number; value: number; cumulative: number }>;
    lastMonthLabel?: string;
    bestMonth: Array<{ day: number; value: number; cumulative: number }>;
    bestMonthLabel?: string;
  } | null;
}) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dataMap = useMemo(() => {
    const map = new Map<string, { value: number; orders: number; orderList?: Array<{ pedido: string; cliente: string; valor: number }> }>();
    for (const d of data) {
      map.set(d.day, { value: d.value, orders: d.orders, orderList: d.orderList });
    }
    return map;
  }, [data]);

  const allDays = useMemo(() => {
    if (data.length === 0) return [];
    if (period === "current_month" || period === "last_month") {
      const firstDay = data[0]?.day || new Date().toISOString().substring(0, 10);
      const [y, m] = firstDay.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const days: Array<{ day: string; value: number; orders: number; isFuture: boolean; orderList?: Array<{ pedido: string; cliente: string; valor: number }> }> = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const existing = dataMap.get(dayStr);
        days.push({ day: dayStr, value: existing?.value || 0, orders: existing?.orders || 0, isFuture: dayStr > todayStr, orderList: existing?.orderList });
      }
      return days;
    }
    return data.map(d => ({ ...d, isFuture: false, orderList: d.orderList }));
  }, [data, dataMap, period]);

  if (allDays.length === 0) return <p className="text-sm text-slate-400 text-center py-8">Sem dados para o periodo</p>;

  const key = mode === "value" ? "value" : "orders";
  const maxVal = Math.max(...allDays.map((d) => d[key]), 1);

  const formatWeekday = (dayStr: string) => {
    const d = new Date(dayStr + "T12:00:00");
    return ["D", "S", "T", "Q", "Q", "S", "S"][d.getDay()];
  };

  // SVG dimensions - bigger chart
  const svgWidth = 1000;
  const svgHeight = 420;
  const paddingLeft = 65;
  const paddingRight = 75;
  const paddingTop = 25;
  const paddingBottom = 55;
  const plotW = svgWidth - paddingLeft - paddingRight;
  const plotH = svgHeight - paddingTop - paddingBottom;

  const barWidth = Math.min(20, plotW / allDays.length * 0.65);
  const barGap = (plotW - barWidth * allDays.length) / Math.max(allDays.length - 1, 1);

  // Cumulative line data
  const showLines = mode === "value" && comparison && (period === "current_month" || period === "last_month");
  const allCumulatives = showLines ? [
    ...(comparison?.currentMonth?.map(d => d.cumulative) || []),
    ...(comparison?.lastMonth?.map(d => d.cumulative) || []),
    ...(comparison?.bestMonth?.map(d => d.cumulative) || []),
  ] : [];
  const realMaxCumulative = Math.max(...allCumulatives, 1);
  // Round up to nice number for right axis
  const maxCumulative = showLines ? Math.ceil(realMaxCumulative / 500000) * 500000 || 500000 : realMaxCumulative;

  // Dual scale: bars use maxVal (left axis), lines use maxCumulative (right axis)

  const buildLinePath = (lineData: Array<{ day: number; cumulative: number }>) => {
    if (!lineData || lineData.length === 0) return "";
    return lineData.map((d, i) => {
      const x = paddingLeft + ((d.day - 1) / Math.max(allDays.length - 1, 1)) * plotW;
      const y = paddingTop + plotH - (d.cumulative / maxCumulative) * plotH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  };
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    value: maxVal * pct,
    y: paddingTop + plotH - pct * plotH,
  }));

  const todayDay = new Date().getDate();
  const currentLatest = comparison?.currentMonth?.length ? comparison.currentMonth[comparison.currentMonth.length - 1] : null;
  const lastLatest = comparison?.lastMonth?.length ? comparison.lastMonth[comparison.lastMonth.length - 1] : null;
  const bestLatest = comparison?.bestMonth?.length ? comparison.bestMonth[comparison.bestMonth.length - 1] : null;

  // --- Médias diárias ---
  // Mês atual: total / dias corridos até hoje
  const currentTotal = currentLatest?.cumulative ?? 0;
  const currentDays = todayDay; // dias corridos no mês atual
  const currentAvg = currentDays > 0 ? currentTotal / currentDays : 0;

  // Mês anterior: total / dias do mês completo
  const lastTotal = lastLatest?.cumulative ?? 0;
  const lastDays = comparison?.lastMonth?.length ?? 0;
  const lastAvg = lastDays > 0 ? lastTotal / lastDays : 0;

  // Melhor mês: total / dias do mês completo
  const bestTotal = bestLatest?.cumulative ?? 0;
  const bestDays = comparison?.bestMonth?.length ?? 0;
  const bestAvg = bestDays > 0 ? bestTotal / bestDays : 0;

  // Percentual da média atual vs melhor e anterior
  const pctVsBest = bestAvg > 0 ? ((currentAvg / bestAvg) * 100) : 0;
  const pctVsLast = lastAvg > 0 ? ((currentAvg / lastAvg) * 100) : 0;

  return (
    <div className="relative">
      {showLines && (
        <>
        {/* --- Painel de Médias Diárias --- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {/* Mês Atual */}
          <div className="relative bg-gradient-to-br from-teal-50 via-white to-teal-50/30 border border-teal-200/50 rounded-2xl p-5 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-teal-400 via-emerald-500 to-teal-600" />
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-teal-100/30 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-teal-600/70">Média diária do mês atual</span>
                <span className="text-[9px] text-teal-600 bg-teal-100/80 px-2 py-0.5 rounded-full font-semibold">Total de {currentDays} dias do mês</span>
              </div>
              <div className="text-lg sm:text-2xl font-black text-teal-800 tracking-tight leading-none">{formatCurrencyFull(currentAvg)}</div>
              <div className="mt-3 pt-3 border-t border-teal-100/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-[2px] bg-teal-500 rounded" />
                    <span className="text-xs font-medium text-teal-600 uppercase tracking-wide">Acum. Atual ({comparison?.currentMonthLabel})</span>
                  </div>
                  <span className="text-sm font-bold text-teal-700">{currentLatest ? formatCurrencyFull(currentLatest.cumulative) : 'R$ 0'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mês Anterior */}
          <div className="relative bg-gradient-to-br from-blue-50 via-white to-blue-50/30 border border-blue-200/50 rounded-2xl p-5 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600" />
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-100/30 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-600/70">Média diária do mês anterior</span>
                <span className="text-[9px] text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded-full font-semibold">Total de {lastDays} dias do mês</span>
              </div>
              <div className="text-lg sm:text-2xl font-black text-blue-800 tracking-tight leading-none">{formatCurrencyFull(lastAvg)}</div>
              <div className="mt-3 pt-3 border-t border-blue-100/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-[2px] bg-blue-600 rounded" />
                    <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Anterior ({comparison?.lastMonthLabel})</span>
                  </div>
                  <span className="text-sm font-bold text-blue-700">{lastLatest ? formatCurrencyFull(lastLatest.cumulative) : 'R$ 0'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Melhor Mês */}
          {comparison?.bestMonth && comparison.bestMonth.length > 0 && (
            <div className="relative bg-gradient-to-br from-amber-50 via-white to-amber-50/30 border border-amber-200/50 rounded-2xl p-5 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600" />
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-100/30 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-600/70">Média diária do melhor mês de vendas</span>
                  <span className="text-[9px] text-amber-600 bg-amber-100/80 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">Total de {bestDays} dias do mês</span>
                </div>
                <div className="text-lg sm:text-2xl font-black text-amber-800 tracking-tight leading-none">{formatCurrencyFull(bestAvg)}</div>
                <div className="mt-3 pt-3 border-t border-amber-100/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-[2px] bg-amber-600 rounded" />
                      <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">Melhor ({comparison?.bestMonthLabel})</span>
                    </div>
                    <span className="text-sm font-bold text-amber-700">{bestLatest ? formatCurrencyFull(bestLatest.cumulative) : 'R$ 0'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </>
      )}

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full" style={{ minWidth: "600px" }}>
          {/* CSS animation for bars growing from bottom */}
          <defs>
            <style>{`
              @keyframes barGrow {
                from { transform: scaleY(0); }
                to { transform: scaleY(1); }
              }
              @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .bar-animated {
                animation: barGrow 0.5s ease-out forwards;
                transform-origin: bottom;
              }
              .label-animated {
                animation: fadeInUp 0.3s ease-out forwards;
                opacity: 0;
              }
            `}</style>
          </defs>
          {/* Grid lines + left axis (bars) */}
          {yTicks.map((tick, i) => (
            <g key={`grid-${i}`}>
              <line x1={paddingLeft} y1={tick.y} x2={svgWidth - paddingRight} y2={tick.y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={paddingLeft - 8} y={tick.y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">
                {mode === "value" ? (tick.value >= 1000 ? `${(tick.value / 1000).toFixed(0)}k` : tick.value.toFixed(0)) : tick.value.toFixed(0)}
              </text>
            </g>
          ))}

          {/* Right axis ticks (cumulative) */}
          {showLines && [0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const val = maxCumulative * pct;
            const yPos = paddingTop + plotH - pct * plotH;
            return (
              <text key={`rtick-${i}`} x={svgWidth - paddingRight + 8} y={yPos + 4} fill="#94a3b8" fontSize="9" fontWeight="500">
                {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
              </text>
            );
          })}

          {/* Bars */}
          {allDays.map((item, idx) => {
            const val = item[key];
            const barH = val > 0 ? Math.max((val / maxVal) * plotH, 2) : 1;
            const x = paddingLeft + idx * (barWidth + barGap);
            const y = paddingTop + plotH - barH;
            const isWeekend = new Date(item.day + "T12:00:00").getDay() === 0 || new Date(item.day + "T12:00:00").getDay() === 6;
            const dayNum = parseInt(item.day.split("-")[2]);

            return (
              <g key={`bar-${idx}`}>
                <rect
                  x={x}
                  y={item.isFuture ? paddingTop : y}
                  width={barWidth}
                  height={item.isFuture ? plotH : barH}
                  rx="2"
                  fill={item.isFuture ? "#f8fafc" : val === 0 ? "#f1f5f9" : isWeekend ? "#cbd5e1" : "#14b8a6"}
                  opacity={item.isFuture ? 0.5 : 0.85}
                  stroke={item.isFuture ? "#e2e8f0" : "none"}
                  strokeWidth={item.isFuture ? 1 : 0}
                  strokeDasharray={item.isFuture ? "3 2" : "none"}
                  className={!item.isFuture && val > 0 ? "bar-animated" : undefined}
                  style={!item.isFuture && val > 0 ? { animationDelay: `${idx * 60}ms`, transformBox: "fill-box" as any } : undefined}
                />
                {val > 0 && !item.isFuture && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 8}
                    textAnchor="middle"
                    fill="#1e293b"
                    fontSize="13"
                    fontWeight="700"
                    className="label-animated"
                    style={{ animationDelay: `${idx * 60 + 300}ms` }}
                  >
                    {mode === "value" ? (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)) : val}
                  </text>
                )}
                <text x={x + barWidth / 2} y={paddingTop + plotH + 18} textAnchor="middle" fill={isWeekend ? "#f87171" : "#475569"} fontSize="13" fontWeight="600">
                  {dayNum}
                </text>
                <text x={x + barWidth / 2} y={paddingTop + plotH + 34} textAnchor="middle" fill={isWeekend ? "#fca5a5" : "#94a3b8"} fontSize="11">
                  {formatWeekday(item.day)}
                </text>
                {/* Invisible wider rect for hover */}
                <rect
                  x={x - barGap / 2}
                  y={paddingTop}
                  width={barWidth + barGap}
                  height={plotH}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => {
                    setHoveredDay(item.day);
                    const containerRect = (e.target as SVGElement).closest('.relative')?.getBoundingClientRect();
                    if (containerRect) {
                      const relX = e.clientX - containerRect.left;
                      const relY = e.clientY - containerRect.top;
                      setTooltipPos({ x: relX, y: relY });
                    }
                  }}
                  onMouseMove={(e) => {
                    const containerRect = (e.target as SVGElement).closest('.relative')?.getBoundingClientRect();
                    if (containerRect) {
                      const relX = e.clientX - containerRect.left;
                      const relY = e.clientY - containerRect.top;
                      setTooltipPos({ x: relX, y: relY });
                    }
                  }}
                  onMouseLeave={() => setHoveredDay(null)}
                />
              </g>
            );
          })}

          {/* Overlay: cumulative lines (subtle) */}
          {showLines && comparison?.bestMonth && comparison.bestMonth.length > 0 && (
            <path d={buildLinePath(comparison.bestMonth)} fill="none" stroke="#d97706" strokeWidth="1.2" strokeDasharray="5 3" opacity="0.85" />
          )}
          {showLines && comparison?.lastMonth && comparison.lastMonth.length > 0 && (
            <path d={buildLinePath(comparison.lastMonth)} fill="none" stroke="#2563eb" strokeWidth="1.2" opacity="0.85" />
          )}
          {showLines && comparison?.currentMonth && comparison.currentMonth.length > 0 && (
            <>
              <path d={buildLinePath(comparison.currentMonth)} fill="none" stroke="#0d9488" strokeWidth="1.5" opacity="0.9" />
              {currentLatest && (
                <circle
                  cx={paddingLeft + ((currentLatest.day - 1) / Math.max(allDays.length - 1, 1)) * plotW}
                  cy={paddingTop + plotH - (currentLatest.cumulative / maxCumulative) * plotH}
                  r="4" fill="#0d9488" stroke="white" strokeWidth="2"
                />
              )}
            </>
          )}

          {/* Today marker */}
          {(period === "current_month") && todayDay <= allDays.length && (
            <line
              x1={paddingLeft + (todayDay - 1) * (barWidth + barGap) + barWidth / 2}
              y1={paddingTop}
              x2={paddingLeft + (todayDay - 1) * (barWidth + barGap) + barWidth / 2}
              y2={paddingTop + plotH}
              stroke="#0d9488" strokeWidth="1" strokeDasharray="4 3" opacity="0.4"
            />
          )}
        </svg>
      </div>

      {/* Weekly Summaries (business weeks Mon-Sun) */}
      {(period === "current_month" || period === "last_month") && allDays.length > 0 && (() => {
        // Group days into calendar weeks (Mon-Sun), tracking business vs weekend days
        const weeks: Array<{ weekNum: number; days: typeof allDays; startDay: number; endDay: number; total: number; totalOrders: number; weekendSales: number; weekendDaysWithSales: number }> = [];
        let currentWeekAll: typeof allDays = []; // all days in this calendar week

        for (let i = 0; i < allDays.length; i++) {
          const d = new Date(allDays[i].day + "T12:00:00");
          const dow = d.getDay(); // 0=Sun, 1=Mon...6=Sat

          currentWeekAll.push(allDays[i]);

          // End of week = Sunday (dow===0) or last day of month
          const isLastDay = i === allDays.length - 1;
          const isEndOfWeek = dow === 0 || isLastDay;

          if (isEndOfWeek) {
            const businessDays = currentWeekAll.filter(day => {
              const dd = new Date(day.day + "T12:00:00").getDay();
              return dd >= 1 && dd <= 5;
            });
            const weekendDays = currentWeekAll.filter(day => {
              const dd = new Date(day.day + "T12:00:00").getDay();
              return dd === 0 || dd === 6;
            });
            const total = currentWeekAll.reduce((s, d) => s + (d.isFuture ? 0 : d.value), 0);
            const totalOrders = currentWeekAll.reduce((s, d) => s + (d.isFuture ? 0 : d.orders), 0);
            const weekendSales = weekendDays.reduce((s, d) => s + (d.isFuture ? 0 : d.value), 0);
            const weekendDaysWithSales = weekendDays.filter(d => !d.isFuture && d.value > 0).length;
            const startDayNum = parseInt(currentWeekAll[0].day.split("-")[2]);
            const endDayNum = parseInt(currentWeekAll[currentWeekAll.length - 1].day.split("-")[2]);
            weeks.push({
              weekNum: weeks.length + 1,
              days: businessDays,
              startDay: startDayNum,
              endDay: endDayNum,
              total,
              totalOrders,
              weekendSales,
              weekendDaysWithSales,
            });
            currentWeekAll = [];
          }
        }

        if (weeks.length === 0) return null;

        // Gradient colors for each week
        const weekColors = [
          { from: "from-teal-500", to: "to-emerald-600", bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", accent: "text-teal-500", light: "bg-teal-100", ring: "ring-teal-200" },
          { from: "from-blue-500", to: "to-indigo-600", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", accent: "text-blue-500", light: "bg-blue-100", ring: "ring-blue-200" },
          { from: "from-violet-500", to: "to-purple-600", bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", accent: "text-violet-500", light: "bg-violet-100", ring: "ring-violet-200" },
          { from: "from-amber-500", to: "to-orange-600", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", accent: "text-amber-500", light: "bg-amber-100", ring: "ring-amber-200" },
          { from: "from-rose-500", to: "to-pink-600", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", accent: "text-rose-500", light: "bg-rose-100", ring: "ring-rose-200" },
        ];

        const formatVal = (v: number) => {
          if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
          if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
          return v.toFixed(0);
        };

        return (
          <div className="grid gap-2.5 mt-4 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(140px, 1fr))` }}>
            {weeks.map((week, idx) => {
              const colors = weekColors[idx % weekColors.length];
              const hasValue = week.total > 0;
              const activeDays = week.days.filter(d => !d.isFuture && d.value > 0).length;
              const avg = activeDays > 0 ? week.total / activeDays : 0;
              return (
                <div
                  key={idx}
                  className={`relative overflow-hidden rounded-xl border ${colors.border} ${colors.bg} shadow-sm hover:shadow-md transition-all duration-200`}
                >
                  {/* Top gradient accent */}
                  <div className={`h-1.5 bg-gradient-to-r ${colors.from} ${colors.to}`} />

                  <div className="px-4 pt-3 pb-3 flex flex-col gap-2">
                    {/* Row 1: Semana + Dias - all on one line, no wrap */}
                    <div className="flex items-baseline justify-between gap-2" style={{ whiteSpace: 'nowrap' }}>
                      <span className={`text-xs font-extrabold uppercase tracking-wide ${colors.accent}`}>Semana {week.weekNum}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Dias {week.startDay}–{week.endDay}</span>
                    </div>

                    {/* Row 2: Big value */}
                    <div style={{ whiteSpace: 'nowrap' }}>
                      {hasValue ? (
                        <span className={`text-xl font-black ${colors.text} tracking-tight leading-none`}>
                          {mode === "value" ? `R$ ${formatVal(week.total)}` : `${week.totalOrders} pedidos`}
                        </span>
                      ) : (
                        <span className="text-lg text-slate-300 font-semibold">—</span>
                      )}
                    </div>

                    {/* Row 3: Média (only if has value and value mode) */}
                    {hasValue && mode === "value" && (
                      <div style={{ whiteSpace: 'nowrap' }}>
                        <span className={`text-[10px] font-semibold ${colors.accent}`}>média {formatCurrencyFull(avg)}/dia</span>
                      </div>
                    )}

                    {/* Row 4: Weekend sales note */}
                    {week.weekendSales > 0 && mode === "value" && (
                      <div className="flex items-center gap-1" style={{ whiteSpace: 'nowrap' }}>
                        <span className="text-[10px] text-amber-600 font-medium">
                          +R$ {formatVal(week.weekendSales)} em {week.weekendDaysWithSales} dia{week.weekendDaysWithSales > 1 ? 's' : ''} não útil{week.weekendDaysWithSales > 1 ? 'eis' : ''}
                        </span>
                      </div>
                    )}

                    {/* Row 5: Dias úteis - at the bottom, separated */}
                    <div className="pt-1.5 mt-auto border-t border-slate-200/50" style={{ whiteSpace: 'nowrap' }}>
                      <span className="text-[10px] text-slate-400 font-medium">{week.days.length} dias úteis</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Tooltip with order details */}
      {hoveredDay && (() => {
        const hoveredItem = allDays.find(d => d.day === hoveredDay);
        if (!hoveredItem || hoveredItem.isFuture) return null;
        const dayNum = parseInt(hoveredDay.split("-")[2]);
        const orders = hoveredItem.orderList || [];
        const tooltipLeft = tooltipPos.x > 500 ? tooltipPos.x - 260 : tooltipPos.x + 10;
        const tooltipTop = Math.max(0, tooltipPos.y - 20);
        return (
          <div
            className="absolute bg-white border border-slate-200 rounded-lg shadow-xl p-3 z-50 pointer-events-none"
            style={{ left: `${tooltipLeft}px`, top: `${tooltipTop}px`, minWidth: "240px", maxWidth: "300px" }}
          >
            <div className="flex items-center justify-between mb-2 border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-700">Dia {dayNum} ({formatWeekday(hoveredDay)})</span>
              <span className="text-xs font-bold text-teal-600">{formatCurrencyFull(hoveredItem.value)}</span>
            </div>
            {orders.length > 0 ? (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {orders.map((o, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] py-0.5">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <span className="text-slate-500 font-mono">#{o.pedido}</span>
                      <span className="text-slate-600 truncate">{o.cliente}</span>
                    </div>
                    <span className="text-slate-700 font-semibold ml-2 whitespace-nowrap">{formatCurrencyFull(o.valor)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400">Sem pedidos neste dia</p>
            )}
            {orders.length > 0 && (
              <div className="mt-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                {orders.length} pedido{orders.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
        );
      })()}
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
  const chartWidth = 1000;
  const chartHeight = 300;
  const paddingLeft = 85;
  const paddingRight = 25;
  const paddingTop = 15;
  const paddingBottom = 35;
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

/* ---- Orders Card ---- */
type OrderData = {
  pedido: string;
  cliente: string;
  clienteApelido: string;
  uf: string;
  dataEmissao: string;
  estadoItem: string;
  valorTotal: number;
  condicaoPagamento?: string | null;
  transportadora?: string | null;
  razaoSocial?: string | null;
  inscricaoEstadual?: string | null;
  endereco?: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cep: string;
    cidade: string;
    uf: string;
  } | null;
  valorTotalPedido?: number | null;
  representante?: string | null;
  empresa?: string | null;
  itens: Array<{
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
    estadoItem: string;
    dataEntregaItem?: string | null;
    codigoGrupo?: string;
    codigoItem?: string | null;
    descricaoItem?: string | null;
  }>;
};

function OrderStatusBadge({ status }: { status: string }) {
  if (status === "Faturado") return <Badge className="bg-emerald-100 text-emerald-700 text-xs border-0">Faturado</Badge>;
  if (status === "A faturar") return <Badge className="bg-orange-100 text-orange-700 text-xs border-0">A Faturar</Badge>;
  if (status === "Misto") return <Badge className="bg-blue-100 text-blue-700 text-xs border-0">Misto</Badge>;
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("pt-BR");
}

function OrderRow({ order }: { order: OrderData }) {
  const [expanded, setExpanded] = useState(false);
  const displayName = order.cliente;
  const dateStr = order.dataEmissao ? formatDateBR(order.dataEmissao) : "—";

  // Determine earliest delivery date for the order
  const earliestDelivery = useMemo(() => {
    const dates = order.itens
      .map(i => i.dataEntregaItem)
      .filter(Boolean)
      .map(d => new Date(d!))
      .filter(d => !isNaN(d.getTime()));
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates.map(d => d.getTime())));
  }, [order.itens]);

  // Only show overdue indicator for non-faturado orders
  const isFaturado = order.estadoItem === "Faturado";
  const isOverdue = !isFaturado && earliestDelivery && earliestDelivery < new Date();

  return (
    <div className={`transition-all duration-300 ${
      expanded 
        ? "border-2 border-teal-400 bg-teal-50/40 rounded-xl my-3 mx-2 shadow-xl shadow-teal-200/60 relative z-10 ring-4 ring-teal-200/40" 
        : "border-b border-slate-100"
    }`}>
      <div
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-4 py-3 transition-colors text-left cursor-pointer ${
          expanded 
            ? "bg-gradient-to-r from-teal-100/80 via-teal-50 to-white border-b-2 border-teal-400 py-4 rounded-t-xl" 
            : "hover:bg-slate-50"
        }`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
      >
        {/* STATUS */}
        <div className="w-28 flex-shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm ${
            order.estadoItem === "Faturado" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
            order.estadoItem === "A faturar" ? "bg-orange-100 text-orange-800 border-orange-300" :
            order.estadoItem === "Misto" ? "bg-blue-100 text-blue-800 border-blue-300" :
            "bg-slate-100 text-slate-700 border-slate-300"
          }`}>
            {order.estadoItem === "A faturar" && <Clock className="w-3.5 h-3.5" />}
            {order.estadoItem === "Faturado" && <CheckCircle className="w-3.5 h-3.5" />}
            {order.estadoItem === "Misto" && <AlertCircle className="w-3.5 h-3.5" />}
            {order.estadoItem}
          </span>
        </div>

        {/* Expand arrow */}
        <div className="flex-shrink-0 text-slate-400">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>

        {/* Pedido number */}
        <div className="w-14 flex-shrink-0">
          <span className="text-sm font-bold text-teal-600">#{order.pedido}</span>
        </div>

        {/* Client name */}
        <div className="flex-1 min-w-0">
          <span className="text-base text-slate-700 truncate block" title={order.cliente}>{displayName}</span>
        </div>

        {/* UF */}
        <div className="w-10 flex-shrink-0 text-center">
          {order.uf && <span className="text-sm text-slate-500 font-medium">{order.uf}</span>}
        </div>

        {/* Data emissão */}
        <div className="w-20 flex-shrink-0 text-center">
          <span className="text-base text-slate-500">{dateStr}</span>
        </div>

        {/* Delivery date */}
        <div className="w-24 flex-shrink-0 text-center">
          {earliestDelivery ? (
            <div className="flex flex-col items-center">
              <span className={`text-sm font-medium ${
                isOverdue ? "text-orange-600" : "text-slate-600"
              }`}>
                {earliestDelivery.toLocaleDateString("pt-BR")}
              </span>
              {isOverdue && (
                <span className="text-[9px] text-orange-500 font-medium">vencida</span>
              )}
            </div>
          ) : (
            <span className="text-sm text-slate-300">—</span>
          )}
        </div>

        {/* Items count */}
        <div className="w-12 flex-shrink-0 text-center">
          <span className="text-sm text-slate-500">{order.itens.length} {order.itens.length === 1 ? "item" : "itens"}</span>
        </div>

        {/* Value */}
        <div className="w-24 flex-shrink-0 text-right">
          <span className="text-sm font-medium text-slate-600">{formatCurrencyFull(order.valorTotal)}</span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="bg-white border-t-0 rounded-b-xl overflow-hidden">
          {/* Order details section */}
          {(order.condicaoPagamento || order.transportadora || order.razaoSocial || order.endereco || order.representante) && (
            <div className="px-4 py-3 pl-12 bg-blue-50/40 border-b border-blue-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Razão Social */}
                {order.razaoSocial && (
                  <div className="flex items-start gap-2">
                    <Building2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold block">Razão Social</span>
                      <span className="text-sm text-slate-700">{order.razaoSocial}</span>
                      {order.inscricaoEstadual && (
                        <span className="text-xs text-slate-400 block">IE: {order.inscricaoEstadual}</span>
                      )}
                    </div>
                  </div>
                )}
                {/* Condição de Pagamento */}
                {order.condicaoPagamento && (
                  <div className="flex items-start gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold block">Condição de Pagamento</span>
                      <span className="text-sm text-slate-700 font-medium">{order.condicaoPagamento} dias</span>
                    </div>
                  </div>
                )}
                {/* Transportadora */}
                {order.transportadora && (
                  <div className="flex items-start gap-2">
                    <Truck className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold block">Transportadora</span>
                      <span className="text-sm text-slate-700">{order.transportadora}</span>
                    </div>
                  </div>
                )}
                {/* Representante */}
                {order.representante && (
                  <div className="flex items-start gap-2">
                    <User className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold block">Representante</span>
                      <span className="text-sm text-slate-700">{order.representante}</span>
                    </div>
                  </div>
                )}
                {/* Endereço */}
                {order.endereco && (
                  <div className="flex items-start gap-2 sm:col-span-2 lg:col-span-3">
                    <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold block">Endereço de Entrega</span>
                      <span className="text-sm text-slate-700">
                        {order.endereco.logradouro}{order.endereco.numero ? `, ${order.endereco.numero}` : ""}
                        {order.endereco.complemento ? ` - ${order.endereco.complemento}` : ""}
                        {order.endereco.bairro ? ` — ${order.endereco.bairro}` : ""}
                        {order.endereco.cidade ? `, ${order.endereco.cidade}` : ""}
                        {order.endereco.uf ? `/${order.endereco.uf}` : ""}
                        {order.endereco.cep ? ` — CEP: ${order.endereco.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}` : ""}
                      </span>
                    </div>
                  </div>
                )}
                {/* Valor total do pedido */}
                {order.valorTotalPedido && order.valorTotalPedido !== order.valorTotal && (
                  <div className="flex items-start gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold block">Valor Total do Pedido</span>
                      <span className="text-sm text-slate-700 font-medium">{formatCurrencyFull(order.valorTotalPedido)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items table */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-teal-600" />
              Itens do Pedido ({order.itens.length})
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-500 uppercase">
                <th className="px-4 py-2 text-left pl-12">Produto</th>
                <th className="px-3 py-2 text-right w-20">Qtd</th>
                <th className="px-3 py-2 text-right w-28">Valor Unit.</th>
                <th className="px-3 py-2 text-right w-28">Valor Total</th>
                <th className="px-3 py-2 text-center w-24">Entrega</th>
                <th className="px-3 py-2 text-center w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {order.itens.map((item, idx) => (
                <tr key={idx} className="border-t border-slate-100 hover:bg-slate-100/50">
                  <td className="px-4 py-2 pl-12">
                    <span className="text-base font-medium text-slate-800">{item.descricao}</span>
                    {item.codigoItem && <div className="text-xs text-slate-400 mt-0.5">Cod: {item.codigoItem}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-600 text-right">{formatNumber(item.codigoItem === '00808' ? item.quantidade / 11.6 : item.quantidade)}</td>
                   <td className="px-3 py-2.5 text-sm text-slate-600 text-right">{formatCurrencyFull(item.valorUnitario)}</td>
                   <td className="px-3 py-2.5 text-base font-semibold text-slate-800 text-right">{formatCurrencyFull(item.valorTotal)}</td>
                   <td className="px-3 py-2 text-center">
                    {item.dataEntregaItem ? (
                      <span className="text-xs text-slate-600">{formatDateBR(item.dataEntregaItem)}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-medium ${
                      item.estadoItem === "Faturado" ? "text-emerald-600" :
                      item.estadoItem === "A faturar" ? "text-orange-600" :
                      item.estadoItem === "Faturado parcial" ? "text-blue-600" : "text-slate-500"
                    }`}>
                      {item.estadoItem}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type OrderSortField = "pedido" | "cliente" | "uf" | "data" | "entrega" | "status" | "itens" | "valor";
type OrderSortDir = "asc" | "desc";

function SortableHeader({ field, label, currentSort, currentDir, onSort, className }: {
  field: OrderSortField;
  label: string;
  currentSort: OrderSortField;
  currentDir: OrderSortDir;
  onSort: (field: OrderSortField) => void;
  className?: string;
}) {
  const isActive = currentSort === field;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSort(field); }}
      className={`flex items-center gap-1 hover:text-teal-600 transition-colors select-none ${className || ""}`}
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${isActive ? "text-teal-600" : "text-slate-300"}`} />
    </button>
  );
}

function OrdersCard({ orders, title = "Pedidos", variant = "all" }: { orders: OrderData[]; title?: string; variant?: "all" | "faturado" | "a_faturar" }) {
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "faturado" | "a_faturar">("all");
  const [sortField, setSortField] = useState<OrderSortField>("data");
  const [sortDir, setSortDir] = useState<OrderSortDir>("desc");

  const handleSort = (field: OrderSortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const totalValue = useMemo(() => orders.reduce((sum, o) => sum + o.valorTotal, 0), [orders]);

  const statusCounts = useMemo(() => {
    const faturadoOrders = orders.filter(o => o.estadoItem === "Faturado");
    const aFaturarOrders = orders.filter(o => o.estadoItem !== "Faturado");
    return {
      faturado: faturadoOrders.length,
      aFaturar: aFaturarOrders.length,
      faturadoValue: faturadoOrders.reduce((sum, o) => sum + o.valorTotal, 0),
      aFaturarValue: aFaturarOrders.reduce((sum, o) => sum + o.valorTotal, 0),
    };
  }, [orders]);

  const filtered = useMemo(() => {
    let result = orders;

    // Status filter
    if (statusFilter === "faturado") {
      result = result.filter(o => o.estadoItem === "Faturado");
    } else if (statusFilter === "a_faturar") {
      result = result.filter(o => o.estadoItem !== "Faturado");
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(o =>
        o.pedido.toLowerCase().includes(s) ||
        o.cliente.toLowerCase().includes(s) ||
        (o.clienteApelido && o.clienteApelido.toLowerCase().includes(s)) ||
        o.uf.toLowerCase().includes(s)
      );
    }

    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "pedido":
          cmp = Number(a.pedido) - Number(b.pedido);
          break;
        case "cliente": {
          const nameA = a.cliente.toLowerCase();
          const nameB = b.cliente.toLowerCase();
          cmp = nameA.localeCompare(nameB);
          break;
        }
        case "uf":
          cmp = (a.uf || "").localeCompare(b.uf || "");
          break;
        case "data":
          cmp = (a.dataEmissao || "").localeCompare(b.dataEmissao || "");
          break;
        case "entrega": {
          const aDate = a.itens.map(i => i.dataEntregaItem).filter(Boolean).sort()[0] || "";
          const bDate = b.itens.map(i => i.dataEntregaItem).filter(Boolean).sort()[0] || "";
          cmp = aDate.localeCompare(bDate);
          break;
        }
        case "status":
          cmp = (a.estadoItem || "").localeCompare(b.estadoItem || "");
          break;
        case "itens":
          cmp = a.itens.length - b.itens.length;
          break;
        case "valor":
          cmp = a.valorTotal - b.valorTotal;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [orders, searchTerm, statusFilter, sortField, sortDir]);

  const filteredTotal = useMemo(() => filtered.reduce((sum, o) => sum + o.valorTotal, 0), [filtered]);

  return (
    <div className={`${variant === "a_faturar" ? "bg-orange-50/40" : "bg-emerald-50/40"} rounded-lg border ${variant === "a_faturar" ? "border-orange-200" : "border-emerald-200"} shadow-sm overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-5 py-4 ${variant === "a_faturar" ? "hover:bg-orange-50/50" : "hover:bg-emerald-50/50"} transition-colors`}
      >
        <div className="flex items-center gap-3">
          <ClipboardList className={`w-5 h-5 ${variant === "a_faturar" ? "text-orange-600" : "text-emerald-600"}`} />
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h3>
          <Badge variant="outline" className="text-xs">{orders.length} pedidos</Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-slate-800">{formatCurrencyFull(totalValue)}</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className={`border-t ${variant === "a_faturar" ? "border-orange-200" : "border-emerald-200"}`}>
          {/* Filters: search */}
          <div className={`px-4 py-3 ${variant === "a_faturar" ? "bg-orange-50/30 border-b border-orange-100" : "bg-emerald-50/30 border-b border-emerald-100"} flex flex-col sm:flex-row gap-2`}>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por pedido, cliente, UF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white h-8 text-sm"
              />
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              <span className="text-xs text-slate-500">{filtered.length} pedidos</span>
              <span className="text-sm font-bold text-slate-800">{formatCurrencyFull(filteredTotal)}</span>
            </div>
          </div>

          {/* Table header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold">
            {/* Status */}
            <div className="w-28 flex-shrink-0">
              <SortableHeader field="status" label="Status" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            </div>
            {/* Arrow spacer */}
            <div className="w-4 flex-shrink-0" />
            {/* Pedido */}
            <div className="w-14 flex-shrink-0">
              <SortableHeader field="pedido" label="Pedido" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            </div>
            {/* Cliente */}
            <div className="flex-1 min-w-0">
              <SortableHeader field="cliente" label="Cliente" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            </div>
            {/* UF */}
            <div className="w-10 flex-shrink-0 text-center">
              <SortableHeader field="uf" label="UF" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {/* Emissão */}
            <div className="w-20 flex-shrink-0 text-center">
              <SortableHeader field="data" label="Emissão" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {/* Entrega */}
            <div className="w-24 flex-shrink-0 text-center">
              <SortableHeader field="entrega" label="Entrega" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {/* Itens */}
            <div className="w-12 flex-shrink-0 text-center">
              <SortableHeader field="itens" label="Itens" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {/* Valor */}
            <div className="w-24 flex-shrink-0 text-right">
              <SortableHeader field="valor" label="Valor" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-end" />
            </div>
          </div>

          {/* Orders list */}
          <div className="max-h-[500px] overflow-y-auto">
            {filtered.map((order) => (
              <OrderRow key={order.pedido} order={order} />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum pedido encontrado</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Previous Unbilled Card ---- */
type PreviousOrderData = OrderData & { month: string };

function getMonthLabelFull(monthStr: string): string {
  const [y, m] = monthStr.split("-");
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function PreviousUnbilledCard({ months, orders }: { months: string[]; orders: PreviousOrderData[] }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<OrderSortField>("data");
  const [sortDir, setSortDir] = useState<OrderSortDir>("desc");

  const handleSort = (field: OrderSortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const totalValue = useMemo(() => orders.reduce((sum, o) => sum + o.valorTotal, 0), [orders]);

  // Month counts
  const monthCounts = useMemo(() => {
    const counts: Record<string, { count: number; value: number }> = {};
    for (const o of orders) {
      if (!counts[o.month]) counts[o.month] = { count: 0, value: 0 };
      counts[o.month].count++;
      counts[o.month].value += o.valorTotal;
    }
    return counts;
  }, [orders]);

  const filtered = useMemo(() => {
    let result = orders;

    // Month filter
    if (selectedMonth !== "all") {
      result = result.filter(o => o.month === selectedMonth);
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(o =>
        o.pedido.toLowerCase().includes(s) ||
        o.cliente.toLowerCase().includes(s) ||
        (o.clienteApelido && o.clienteApelido.toLowerCase().includes(s)) ||
        o.uf.toLowerCase().includes(s)
      );
    }

    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "pedido":
          cmp = Number(a.pedido) - Number(b.pedido);
          break;
        case "cliente": {
          const nameA = a.cliente.toLowerCase();
          const nameB = b.cliente.toLowerCase();
          cmp = nameA.localeCompare(nameB);
          break;
        }
        case "uf":
          cmp = (a.uf || "").localeCompare(b.uf || "");
          break;
        case "data":
          cmp = (a.dataEmissao || "").localeCompare(b.dataEmissao || "");
          break;
        case "entrega": {
          const aDate = a.itens.map(i => i.dataEntregaItem).filter(Boolean).sort()[0] || "";
          const bDate = b.itens.map(i => i.dataEntregaItem).filter(Boolean).sort()[0] || "";
          cmp = aDate.localeCompare(bDate);
          break;
        }
        case "status":
          cmp = (a.estadoItem || "").localeCompare(b.estadoItem || "");
          break;
        case "itens":
          cmp = a.itens.length - b.itens.length;
          break;
        case "valor":
          cmp = a.valorTotal - b.valorTotal;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [orders, searchTerm, selectedMonth, sortField, sortDir]);

  const filteredTotal = useMemo(() => filtered.reduce((sum, o) => sum + o.valorTotal, 0), [filtered]);

  if (orders.length === 0) return null;

  return (
    <div className="bg-orange-50/40 rounded-lg border border-orange-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-orange-50/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">A Faturar (Anterior)</h3>
          <Badge variant="outline" className="text-xs">{orders.length} pedidos</Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-slate-800">{formatCurrencyFull(totalValue)}</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-orange-200">
          {/* Filters: month + search */}
          <div className="px-4 py-3 bg-orange-50/30 border-b border-orange-100 flex flex-col sm:flex-row gap-2">
            <div className="flex gap-1 bg-white rounded-md border border-slate-200 p-0.5 flex-shrink-0 flex-wrap">
              <button
                onClick={() => setSelectedMonth("all")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${selectedMonth === "all" ? "bg-orange-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Todos ({orders.length})
              </button>
              {months.map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${selectedMonth === m ? "bg-orange-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {getMonthLabel(m)} ({monthCounts[m]?.count || 0})
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por pedido, cliente, UF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white h-8 text-sm"
              />
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              <span className="text-xs text-slate-500">{filtered.length} pedidos</span>
              <span className="text-sm font-bold text-slate-800">{formatCurrencyFull(filteredTotal)}</span>
            </div>
          </div>

          {/* Table header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold">
            {/* Status */}
            <div className="w-28 flex-shrink-0">
              <SortableHeader field="status" label="Status" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            </div>
            {/* Arrow spacer */}
            <div className="w-4 flex-shrink-0" />
            {/* Pedido */}
            <div className="w-14 flex-shrink-0">
              <SortableHeader field="pedido" label="Pedido" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            </div>
            {/* Cliente */}
            <div className="flex-1 min-w-0">
              <SortableHeader field="cliente" label="Cliente" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            </div>
            {/* UF */}
            <div className="w-10 flex-shrink-0 text-center">
              <SortableHeader field="uf" label="UF" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {/* Emissão */}
            <div className="w-20 flex-shrink-0 text-center">
              <SortableHeader field="data" label="Emissão" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {/* Entrega */}
            <div className="w-24 flex-shrink-0 text-center">
              <SortableHeader field="entrega" label="Entrega" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {/* Itens */}
            <div className="w-12 flex-shrink-0 text-center">
              <SortableHeader field="itens" label="Itens" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {/* Valor */}
            <div className="w-24 flex-shrink-0 text-right">
              <SortableHeader field="valor" label="Valor" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-end" />
            </div>
          </div>

          {/* Orders list */}
          <div className="max-h-[500px] overflow-y-auto">
            {filtered.map((order, idx) => (
              <OrderRow key={`${order.pedido}-${order.month}-${idx}`} order={order} />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum pedido encontrado</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Unified Unbilled Card (A Faturar Completo - 90 dias) ---- */
type UnifiedOrderData = OrderData & { month: string; clienteTelefone?: string | null; clienteEmail?: string | null; observacoes?: string | null };

function UnifiedUnbilledCard({ months, orders, totalValue }: { months: string[]; orders: UnifiedOrderData[]; totalValue: number }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<OrderSortField>("data");
  const [sortDir, setSortDir] = useState<OrderSortDir>("desc");

  const handleSort = (field: OrderSortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // Month counts
  const monthCounts = useMemo(() => {
    const counts: Record<string, { count: number; value: number }> = {};
    for (const o of orders) {
      if (!counts[o.month]) counts[o.month] = { count: 0, value: 0 };
      counts[o.month].count++;
      counts[o.month].value += o.valorTotal;
    }
    return counts;
  }, [orders]);

  const filtered = useMemo(() => {
    let result = orders;

    // Month filter
    if (selectedMonth !== "all") {
      result = result.filter(o => o.month === selectedMonth);
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(o =>
        o.pedido.toLowerCase().includes(s) ||
        o.cliente.toLowerCase().includes(s) ||
        (o.clienteApelido && o.clienteApelido.toLowerCase().includes(s)) ||
        o.uf.toLowerCase().includes(s) ||
        (o.razaoSocial && o.razaoSocial.toLowerCase().includes(s)) ||
        (o.representante && o.representante.toLowerCase().includes(s)) ||
        (o.empresa && o.empresa.toLowerCase().includes(s))
      );
    }

    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "pedido":
          cmp = Number(a.pedido) - Number(b.pedido);
          break;
        case "cliente": {
          const nameA = a.cliente.toLowerCase();
          const nameB = b.cliente.toLowerCase();
          cmp = nameA.localeCompare(nameB);
          break;
        }
        case "uf":
          cmp = (a.uf || "").localeCompare(b.uf || "");
          break;
        case "data":
          cmp = (a.dataEmissao || "").localeCompare(b.dataEmissao || "");
          break;
        case "entrega": {
          const aDate = a.itens.map(i => i.dataEntregaItem).filter(Boolean).sort()[0] || "";
          const bDate = b.itens.map(i => i.dataEntregaItem).filter(Boolean).sort()[0] || "";
          cmp = aDate.localeCompare(bDate);
          break;
        }
        case "status":
          cmp = (a.estadoItem || "").localeCompare(b.estadoItem || "");
          break;
        case "itens":
          cmp = a.itens.length - b.itens.length;
          break;
        case "valor":
          cmp = a.valorTotal - b.valorTotal;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [orders, searchTerm, selectedMonth, sortField, sortDir]);

  const filteredTotal = useMemo(() => filtered.reduce((sum, o) => sum + o.valorTotal, 0), [filtered]);

  if (orders.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-white rounded-lg border border-orange-300 shadow-md overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-orange-50/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <ListFilter className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">A Faturar (Completo)</h3>
            <span className="text-[10px] text-slate-500">Últimos 90 dias • {months.length} {months.length === 1 ? "mês" : "meses"}</span>
          </div>
          <Badge className="bg-orange-100 text-orange-700 text-xs border-0 font-bold">{orders.length} pedidos</Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-slate-800">{formatCurrencyFull(totalValue)}</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-orange-200">
          {/* Filters: month tabs + search */}
          <div className="px-4 py-3 bg-orange-50/30 border-b border-orange-100 flex flex-col gap-2">
            {/* Month tabs */}
            <div className="flex gap-1 bg-white rounded-md border border-slate-200 p-0.5 flex-shrink-0 flex-wrap">
              <button
                onClick={() => setSelectedMonth("all")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedMonth === "all" ? "bg-orange-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
              >
                Todos ({orders.length})
              </button>
              {months.map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedMonth === m ? "bg-orange-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
                >
                  {getMonthLabelFull(m)} ({monthCounts[m]?.count || 0}) • {formatCurrencyFull(monthCounts[m]?.value || 0)}
                </button>
              ))}
            </div>
            {/* Search + count */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por pedido, cliente, razão social, representante, UF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-white h-9 text-sm"
                />
              </div>
              <div className="flex-shrink-0 flex items-center gap-3 px-2">
                <span className="text-xs text-slate-500">{filtered.length} pedidos</span>
                <span className="text-sm font-bold text-orange-700">{formatCurrencyFull(filteredTotal)}</span>
              </div>
            </div>
          </div>

          {/* Table header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold">
            {/* Status */}
            <div className="w-28 flex-shrink-0">
              <SortableHeader field="status" label="Status" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            </div>
            {/* Arrow spacer */}
            <div className="w-4 flex-shrink-0" />
            {/* Pedido */}
            <div className="w-14 flex-shrink-0">
              <SortableHeader field="pedido" label="Pedido" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            </div>
            {/* Cliente */}
            <div className="flex-1 min-w-0">
              <SortableHeader field="cliente" label="Cliente" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            </div>
            {/* UF */}
            <div className="w-10 flex-shrink-0 text-center">
              <SortableHeader field="uf" label="UF" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {/* Emissão */}
            <div className="w-20 flex-shrink-0 text-center">
              <SortableHeader field="data" label="Emissão" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {/* Entrega */}
            <div className="w-24 flex-shrink-0 text-center">
              <SortableHeader field="entrega" label="Entrega" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {/* Itens */}
            <div className="w-12 flex-shrink-0 text-center">
              <SortableHeader field="itens" label="Itens" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {/* Valor */}
            <div className="w-24 flex-shrink-0 text-right">
              <SortableHeader field="valor" label="Valor" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-end" />
            </div>
          </div>

          {/* Orders list */}
          <div className="max-h-[600px] overflow-y-auto">
            {filtered.map((order, idx) => (
              <UnifiedOrderRow key={`${order.pedido}-${order.month}-${idx}`} order={order} />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum pedido encontrado</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UnifiedOrderRow({ order }: { order: UnifiedOrderData }) {
  const [expanded, setExpanded] = useState(false);
  const displayName = order.cliente;
  const dateStr = order.dataEmissao ? formatDateBR(order.dataEmissao) : "—";

  // Determine earliest delivery date for the order
  const earliestDelivery = useMemo(() => {
    const dates = order.itens
      .map(i => i.dataEntregaItem)
      .filter(Boolean)
      .map(d => new Date(d!))
      .filter(d => !isNaN(d.getTime()));
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates.map(d => d.getTime())));
  }, [order.itens]);

  const isOverdue = earliestDelivery && earliestDelivery < new Date();

  return (
    <div className={`transition-all duration-300 ${
      expanded 
        ? "border-2 border-orange-400 bg-orange-50/40 rounded-xl my-3 mx-2 shadow-xl shadow-orange-200/60 relative z-10 ring-4 ring-orange-200/40" 
        : "border-b border-slate-100"
    }`}>
      <div
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 transition-colors text-left cursor-pointer ${
          expanded 
            ? "bg-gradient-to-r from-orange-100/80 via-orange-50 to-white border-b-2 border-orange-400 py-3.5 rounded-t-xl" 
            : "hover:bg-slate-50"
        }`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
      >
        {/* STATUS */}
        <div className="w-28 flex-shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm ${
            order.estadoItem === "Faturado" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
            order.estadoItem === "A faturar" ? "bg-orange-100 text-orange-800 border-orange-300" :
            order.estadoItem === "Misto" ? "bg-blue-100 text-blue-800 border-blue-300" :
            "bg-slate-100 text-slate-700 border-slate-300"
          }`}>
            {order.estadoItem === "A faturar" && <Clock className="w-3.5 h-3.5" />}
            {order.estadoItem === "Faturado" && <CheckCircle className="w-3.5 h-3.5" />}
            {order.estadoItem === "Misto" && <AlertCircle className="w-3.5 h-3.5" />}
            {order.estadoItem}
          </span>
        </div>

        {/* Expand arrow */}
        <div className="flex-shrink-0 text-slate-400">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>

        {/* Pedido number */}
        <div className="w-14 flex-shrink-0">
          <span className="text-xs font-bold text-orange-600">#{order.pedido}</span>
        </div>

        {/* Client name */}
        <div className="flex-1 min-w-0">
          <span className="text-base text-slate-700 truncate block" title={order.cliente}>{displayName}</span>
        </div>

        {/* UF */}
        <div className="w-10 flex-shrink-0 text-center">
          {order.uf && <span className="text-sm text-slate-500 font-medium">{order.uf}</span>}
        </div>

        {/* Data emissão */}
        <div className="w-20 flex-shrink-0 text-center">
          <span className="text-base text-slate-500">{dateStr}</span>
        </div>

        {/* Delivery date */}
        <div className="w-24 flex-shrink-0 text-center">
          {earliestDelivery ? (
            <div className="flex flex-col items-center">
              <span className={`text-sm font-medium ${
                isOverdue ? "text-orange-600" : "text-slate-600"
              }`}>
                {earliestDelivery.toLocaleDateString("pt-BR")}
              </span>
              {isOverdue && (
                <span className="text-[9px] text-orange-500 font-medium">vencida</span>
              )}
            </div>
          ) : (
            <span className="text-sm text-slate-300">—</span>
          )}
        </div>

        {/* Items count */}
        <div className="w-12 flex-shrink-0 text-center">
          <span className="text-sm text-slate-500">{order.itens.length} {order.itens.length === 1 ? "item" : "itens"}</span>
        </div>

        {/* Value */}
        <div className="w-24 flex-shrink-0 text-right">
          <span className="text-sm font-medium text-slate-600">{formatCurrencyFull(order.valorTotal)}</span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="bg-white border-t-0 rounded-b-xl overflow-hidden">
          {/* Order details section - ALL customer info */}
          <div className="px-4 py-3 pl-12 bg-blue-50/40 border-b border-blue-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Razão Social */}
              {order.razaoSocial && (
                <div className="flex items-start gap-2">
                  <Building2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold block">Razão Social</span>
                    <span className="text-xs text-slate-700">{order.razaoSocial}</span>
                    {order.inscricaoEstadual && (
                      <span className="text-xs text-slate-400 block">IE: {order.inscricaoEstadual}</span>
                    )}
                  </div>
                </div>
              )}
              {/* Condição de Pagamento */}
              {order.condicaoPagamento && (
                <div className="flex items-start gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold block">Condição de Pagamento</span>
                    <span className="text-xs text-slate-700 font-medium">{order.condicaoPagamento} dias</span>
                  </div>
                </div>
              )}
              {/* Transportadora */}
              {order.transportadora && (
                <div className="flex items-start gap-2">
                  <Truck className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold block">Transportadora</span>
                    <span className="text-xs text-slate-700">{order.transportadora}</span>
                  </div>
                </div>
              )}
              {/* Representante */}
              {order.representante && (
                <div className="flex items-start gap-2">
                  <User className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold block">Representante</span>
                    <span className="text-xs text-slate-700">{order.representante}</span>
                  </div>
                </div>
              )}
              {/* Empresa */}
              {order.empresa && (
                <div className="flex items-start gap-2">
                  <Factory className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold block">Empresa</span>
                    <span className="text-xs text-slate-700">{order.empresa}</span>
                  </div>
                </div>
              )}
              {/* Telefone */}
              {order.clienteTelefone && (
                <div className="flex items-start gap-2">
                  <Phone className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold block">Telefone</span>
                    <span className="text-xs text-slate-700">{order.clienteTelefone}</span>
                  </div>
                </div>
              )}
              {/* Email */}
              {order.clienteEmail && (
                <div className="flex items-start gap-2">
                  <Mail className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold block">Email</span>
                    <span className="text-xs text-slate-700">{order.clienteEmail}</span>
                  </div>
                </div>
              )}
              {/* Endereço */}
              {order.endereco && (
                <div className="flex items-start gap-2 sm:col-span-2 lg:col-span-3">
                  <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold block">Endereço de Entrega</span>
                    <span className="text-xs text-slate-700">
                      {order.endereco.logradouro}{order.endereco.numero ? `, ${order.endereco.numero}` : ""}
                      {order.endereco.complemento ? ` - ${order.endereco.complemento}` : ""}
                      {order.endereco.bairro ? ` — ${order.endereco.bairro}` : ""}
                      {order.endereco.cidade ? `, ${order.endereco.cidade}` : ""}
                      {order.endereco.uf ? `/${order.endereco.uf}` : ""}
                      {order.endereco.cep ? ` — CEP: ${order.endereco.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}` : ""}
                    </span>
                  </div>
                </div>
              )}
              {/* Valor total do pedido */}
              {order.valorTotalPedido && order.valorTotalPedido !== order.valorTotal && (
                <div className="flex items-start gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold block">Valor Total do Pedido</span>
                    <span className="text-xs text-slate-700 font-medium">{formatCurrencyFull(order.valorTotalPedido)}</span>
                  </div>
                </div>
              )}
              {/* Observações */}
              {order.observacoes && (
                <div className="flex items-start gap-2 sm:col-span-2 lg:col-span-3">
                  <PenLine className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold block">Observações</span>
                    <span className="text-xs text-slate-700 whitespace-pre-line">{order.observacoes}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Items table */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-orange-600" />
              Itens do Pedido ({order.itens.length})
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-500 uppercase">
                <th className="px-4 py-2 text-left pl-12">Produto</th>
                <th className="px-3 py-2 text-right w-20">Qtd</th>
                <th className="px-3 py-2 text-right w-28">Valor Unit.</th>
                <th className="px-3 py-2 text-right w-28">Valor Total</th>
                <th className="px-3 py-2 text-center w-24">Entrega</th>
                <th className="px-3 py-2 text-center w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {order.itens.map((item, idx) => (
                <tr key={idx} className="border-t border-slate-100 hover:bg-slate-100/50">
                  <td className="px-4 py-2 pl-12">
                    <span className="text-base font-medium text-slate-800">{item.descricao}</span>
                    {item.codigoItem && <div className="text-xs text-slate-400 mt-0.5">Cod: {item.codigoItem}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-600 text-right">{formatNumber(item.codigoItem === '00808' ? item.quantidade / 11.6 : item.quantidade)}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-600 text-right">{formatCurrencyFull(item.valorUnitario)}</td>
                  <td className="px-3 py-2.5 text-base font-semibold text-slate-800 text-right">{formatCurrencyFull(item.valorTotal)}</td>
                  <td className="px-3 py-2 text-center">
                    {item.dataEntregaItem ? (
                      <span className="text-xs text-slate-600">{formatDateBR(item.dataEntregaItem)}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-medium ${
                      item.estadoItem === "Faturado" ? "text-emerald-600" :
                      item.estadoItem === "A faturar" ? "text-orange-600" :
                      item.estadoItem === "Faturado parcial" ? "text-blue-600" : "text-slate-500"
                    }`}>
                      {item.estadoItem}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---- Draft Orders Card (Em Digitação) ---- */
type DraftOrderData = {
  pedido: string;
  cliente: string;
  dataEmissao: string;
  valorTotal: number;
  itens: Array<{
    descricao: string;
    codigoItem: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }>;
};

function DraftOrderRow({ order }: { order: DraftOrderData }) {
  const [expanded, setExpanded] = useState(false);
  const dateStr = order.dataEmissao ? new Date(order.dataEmissao).toLocaleDateString("pt-BR") : "—";

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition-colors text-left"
      >
        <div className="w-4 flex-shrink-0">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        </div>
        <div className="w-16 flex-shrink-0">
          <span className="text-sm font-medium text-blue-600">#{order.pedido}</span>
        </div>
        <div className="flex-1 truncate">
          <span className="text-sm text-slate-700">{order.cliente}</span>
        </div>
        <div className="w-20 flex-shrink-0 text-center">
          <span className="text-xs text-slate-500">{dateStr}</span>
        </div>
        <div className="w-12 flex-shrink-0 text-center">
          <span className="text-sm text-slate-500">{order.itens.length} {order.itens.length === 1 ? "item" : "itens"}</span>
        </div>
        <div className="w-28 flex-shrink-0 text-right">
          <span className="text-sm font-semibold text-slate-600">{formatCurrencyFull(order.valorTotal)}</span>
        </div>
      </button>

      {/* Expanded items */}
      {expanded && (
        <div className="bg-slate-50 border-t border-slate-100">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-500 uppercase">
                <th className="px-4 py-2 text-left pl-12">Produto</th>
                <th className="px-3 py-2 text-right w-20">Qtd</th>
                <th className="px-3 py-2 text-right w-28">Valor Unit.</th>
                <th className="px-3 py-2 text-right w-28">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {order.itens.map((item, idx) => (
                <tr key={idx} className="border-t border-slate-100 hover:bg-slate-100/50">
                  <td className="px-4 py-2 pl-12">
                    <span className="text-base font-medium text-slate-800">{item.descricao}</span>
                    {item.codigoItem && <div className="text-xs text-slate-400 mt-0.5">Cod: {item.codigoItem}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-600 text-right">{formatNumber(item.codigoItem === '00808' ? item.quantidade / 11.6 : item.quantidade)}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-600 text-right">{formatCurrencyFull(item.valorUnitario)}</td>
                  <td className="px-3 py-2.5 text-base font-semibold text-slate-800 text-right">{formatCurrencyFull(item.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DraftOrdersCard({ orders }: { orders: DraftOrderData[] }) {
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const totalValue = useMemo(() => orders.reduce((sum, o) => sum + o.valorTotal, 0), [orders]);
  const totalItems = useMemo(() => orders.reduce((sum, o) => sum + o.itens.length, 0), [orders]);

  const filtered = useMemo(() => {
    if (!searchTerm) return orders;
    const s = searchTerm.toLowerCase();
    return orders.filter(o =>
      o.pedido.toLowerCase().includes(s) ||
      o.cliente.toLowerCase().includes(s) ||
      o.itens.some(i => i.descricao.toLowerCase().includes(s) || i.codigoItem.toLowerCase().includes(s))
    );
  }, [orders, searchTerm]);

  if (orders.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-dashed border-slate-300 shadow-sm overflow-hidden opacity-80">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <PenLine className="w-5 h-5 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Em Digitação</h3>
          <Badge variant="outline" className="text-xs text-slate-400 border-slate-300">{orders.length} pedidos · {totalItems} itens</Badge>
          <span className="text-xs text-slate-400 italic">Informativo — não soma nos KPIs</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-slate-500">{formatCurrencyFull(totalValue)}</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-dashed border-slate-300">
          {/* Search */}
          <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por pedido, cliente, produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white h-8 text-sm"
              />
            </div>
          </div>

          {/* Table header */}
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold">
            <div className="w-4 flex-shrink-0" />
            <div className="w-16 flex-shrink-0">Pedido</div>
            <div className="flex-1">Cliente</div>
            <div className="w-20 flex-shrink-0 text-center">Data</div>
            <div className="w-12 flex-shrink-0 text-center">Itens</div>
            <div className="w-28 flex-shrink-0 text-right">Valor</div>
          </div>

          {/* Orders list */}
          <div className="max-h-[400px] overflow-y-auto">
            {filtered.map((order) => (
              <DraftOrderRow key={order.pedido} order={order} />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum pedido encontrado</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Sales KPI Verify Modal (Contraprova Maxiprod) ---- */
function SalesVerifyModal({ card, startDate, endDate, dashboardValue, onClose }: {
  card: string;
  startDate: string;
  endDate: string;
  dashboardValue: number;
  onClose: () => void;
}) {
  // Map card names to section and labels
  const sectionMap: Record<string, { section: string; label: string; color: string }> = {
    vendas: { section: "vendas", label: "Valor Total do Período", color: "teal" },
    faturamento: { section: "vendas_faturado", label: "Faturado (Vendas)", color: "emerald" },
    a_faturar: { section: "a_faturar", label: "A Faturar (Período)", color: "orange" },
    amostra_bonif: { section: "amostra_bonif", label: "Amostra / Bonificação", color: "blue" },
  };
  const cfg = sectionMap[card] || sectionMap.vendas;

  const { data, isLoading } = trpc.financial.getMaxiprodContraprova.useQuery(
    { section: cfg.section as any, startDate, endDate },
    { refetchOnWindowFocus: false }
  );

  // Each card now has its own dedicated section in the backend for direct comparison
  const isDirectComparison = true;
  const maxiprodValue = data?.valorMaxiprod ?? 0;
  const diff = Math.abs(dashboardValue - maxiprodValue);
  const matches = diff < 1;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className={`bg-${cfg.color}-50 border-b border-${cfg.color}-200 px-5 py-4 rounded-t-xl flex items-center justify-between`}>
          <div>
            <h3 className={`text-sm font-bold text-${cfg.color}-700`}>Contraprova Maxiprod</h3>
            <p className="text-xs text-slate-500">{cfg.label}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/50 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Dashboard</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrencyFull(dashboardValue)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">{isDirectComparison ? "Maxiprod" : "Vendas Total (Maxiprod)"}</p>
                  <p className={`text-lg font-bold ${isDirectComparison ? (matches ? "text-emerald-600" : "text-red-600") : "text-slate-700"}`}>{formatCurrencyFull(maxiprodValue)}</p>
                </div>
              </div>
              {isDirectComparison ? (
                matches ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-700">Valores conferem!</p>
                      <p className="text-xs text-emerald-600">{data.label}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Diferença: {formatCurrencyFull(diff)}</p>
                      <p className="text-xs text-red-600">{data.label}</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-700"><strong>Nota:</strong> O valor de "{cfg.label}" é um subconjunto do total de vendas. A contraprova mostra o total de vendas do Maxiprod para referência.</p>
                  <p className="text-xs text-blue-600 mt-1">{data.label}</p>
                </div>
              )}
              <p className="text-[10px] text-slate-400">Período: {startDate} a {endDate}</p>
              <a
                href={MAXIPROD_LOGIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir Maxiprod
              </a>
            </>
          ) : (
            <p className="text-sm text-slate-500 text-center">Erro ao carregar dados</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Main Sales Page ---- */
export default function Sales() {
  const { operator } = useOperator();
  const canVerifyMaxiprod = operator && MAXIPROD_AUTHORIZED_OPERATORS.includes(operator.name);
  const FORNECEDORES_OPERATORS = ["Guilherme", "Fernando"];
  const canSeeFornecedores = operator && FORNECEDORES_OPERATORS.includes(operator.name);
  const [salesTab, setSalesTab] = useState<"vendas" | "fornecedores" | "metricas">("vendas");
  const [verifyingCard, setVerifyingCard] = useState<{ card: string; startDate: string; endDate: string; dashboardValue: number } | null>(null);
  const [simulatorCard, setSimulatorCard] = useState<{ section: string; title: string; subtitle: string; value: number } | null>(null);
  const [showCanceledDialog, setShowCanceledDialog] = useState(false);
  const [period, setPeriod] = useState("current_month");
  const [grupo, setGrupo] = useState("all");
  const [subgrupo, setSubgrupo] = useState("all");
  const [crmSegmento, setCrmSegmento] = useState("all");
  const [chartMode, setChartMode] = useState<"value" | "orders">("value");
  const [chartExpanded, setChartExpanded] = useState(false);
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const customStartRef = useRef("");
  const customEndRef = useRef("");
  const [pdfExporting, setPdfExporting] = useState(false);

  // Available filter options from DB
  const { data: availableFilters } = trpc.sales.getAvailableFilters.useQuery();

  // Reset subgrupo when grupo changes
  const handleGrupoChange = useCallback((v: string) => {
    setGrupo(v);
    setSubgrupo("all");
  }, []);

  // Available subgrupos for the selected grupo
  const subgrupoOptions = useMemo(() => {
    if (!availableFilters || grupo === "all") return [];
    return availableFilters.subgrupos[grupo] || [];
  }, [availableFilters, grupo]);

  const handlePeriodChange = useCallback((v: string) => {
    if (v === "custom") {
      setShowCustomDates(true);
      // Don't change period yet, wait for dates
    } else {
      setShowCustomDates(false);
      setCustomStart("");
      setCustomEnd("");
      customStartRef.current = "";
      customEndRef.current = "";
      setPeriod(v);
    }
  }, []);

  const applyCustomDates = useCallback(() => {
    // Read from refs first, then fallback to DOM inputs
    let startVal = customStartRef.current;
    let endVal = customEndRef.current;
    if (!startVal || !endVal) {
      const dateInputs = document.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      const visibleInputs = Array.from(dateInputs).filter(i => i.offsetParent !== null);
      if (visibleInputs.length >= 2) {
        startVal = startVal || visibleInputs[0].value;
        endVal = endVal || visibleInputs[1].value;
        // Sync refs and state
        if (visibleInputs[0].value) {
          customStartRef.current = visibleInputs[0].value;
          setCustomStart(visibleInputs[0].value);
        }
        if (visibleInputs[1].value) {
          customEndRef.current = visibleInputs[1].value;
          setCustomEnd(visibleInputs[1].value);
        }
      }
    }
    if (startVal && endVal) {
      setPeriod(`custom:${startVal}:${endVal}`);
    }
  }, []);

  const handleCustomStartChange = useCallback((val: string) => {
    setCustomStart(val);
    customStartRef.current = val;
  }, []);

  const handleCustomEndChange = useCallback((val: string) => {
    setCustomEnd(val);
    customEndRef.current = val;
  }, []);

  const { start, end, label } = useMemo(() => getPeriodRange(period), [period]);

  // Filter params object (stable reference)
  const filterParams = useMemo(() => ({
    grupo: grupo as any,
    subgrupo,
    crmSegmento,
  }), [grupo, subgrupo, crmSegmento]);

  const { data: dateRange } = trpc.sales.getDateRange.useQuery();
  const { data: analytics, isLoading } = trpc.sales.getAnalytics.useQuery(
    { startDate: start, endDate: end, ...filterParams },
    { enabled: !!dateRange && (dateRange.totalCount ?? 0) > 0, refetchInterval: 60000 }
  );

  // Cumulative comparison data for line chart
  const { data: comparison } = trpc.sales.getCumulativeComparison.useQuery(
    { ...filterParams },
    { enabled: !!dateRange && (dateRange.totalCount ?? 0) > 0, refetchInterval: 60000 }
  );

  // Financial summary for inadimplência cards
  const { data: financialSummary } = trpc.financial.getSummary.useQuery(undefined, { refetchInterval: 60000 });

  // Orders list for the period
  const { data: orders } = trpc.sales.getOrders.useQuery(
    { startDate: start, endDate: end, ...filterParams },
    { enabled: !!dateRange && (dateRange.totalCount ?? 0) > 0, refetchInterval: 60000 }
  );

  // Previous unbilled orders
  const { data: previousUnbilled } = trpc.sales.getPreviousUnbilled.useQuery(
    { currentPeriodStart: start, ...filterParams },
    { enabled: !!dateRange && (dateRange.totalCount ?? 0) > 0, refetchInterval: 60000 }
  );

  // Feature toggle: A Faturar (Completo) visibility
  const { data: aFaturarCompletoToggle } = trpc.settings.getFeatureToggle.useQuery(
    { key: "vendas_a_faturar_completo" },
    { refetchInterval: 30000 }
  );
  const showAFaturarCompleto = aFaturarCompletoToggle?.enabled ?? false;

  // All unbilled orders (last 90 days) - unified card
  const { data: allUnbilled } = trpc.sales.getAllUnbilled.useQuery(
    { ...filterParams },
    { enabled: showAFaturarCompleto && !!dateRange && (dateRange.totalCount ?? 0) > 0, refetchInterval: 60000 }
  );

  // Draft orders (Em Digitação) - informational only
  const { data: draftOrders } = trpc.sales.getDraftOrders.useQuery(undefined, { refetchInterval: 60000 });

  const hasData = dateRange && (dateRange.totalCount ?? 0) > 0;

  const handleExportPdf = useCallback(async () => {
    if (!analytics || pdfExporting) return;
    setPdfExporting(true);
    try {
      // Ensure chart is expanded so SVG is in the DOM
      const wasExpanded = chartExpanded;
      if (!wasExpanded) {
        setChartExpanded(true);
        // Wait for React to render the chart
        await new Promise(r => setTimeout(r, 300));
      }
      await generateSalesPDF(
        analytics,
        label,
        grupo,
        crmSegmento,
        "sales-daily-chart",
        comparison,
        period,
      );
      // Restore chart state if it was collapsed
      if (!wasExpanded) {
        setChartExpanded(false);
      }
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setPdfExporting(false);
    }
  }, [analytics, pdfExporting, chartExpanded, label, grupo, crmSegmento, comparison, period]);

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      {/* Filters bar - hidden, moved below */}
      <div className="hidden">
        <div className="container py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
              {/* Grupo filter */}
              <Select value={grupo} onValueChange={handleGrupoChange}>
                <SelectTrigger className="w-72 bg-white">
                  <SelectValue placeholder="Grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">Todos os Grupos</span>
                  </SelectItem>
                  {(availableFilters?.grupos || []).map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      <span className="flex items-center gap-2">
                        {g.value === "importacao_revenda" && <Leaf className="w-3.5 h-3.5 text-teal-500" />}
                        {g.value === "industrializacao" && <Factory className="w-3.5 h-3.5 text-violet-500" />}
                        {g.value === "importacao_mp" && <Package className="w-3.5 h-3.5 text-blue-500" />}
                        {g.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Subgrupo filter - only shown when a grupo is selected */}
              {grupo !== "all" && subgrupoOptions.length > 1 && (
                <Select value={subgrupo} onValueChange={setSubgrupo}>
                  <SelectTrigger className="w-48 bg-white">
                    <SelectValue placeholder="Subgrupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Subgrupos</SelectItem>
                    {subgrupoOptions.map((s: { value: string; label: string }) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* CRM Segmento filter */}
              {(availableFilters?.crmSegmentos || []).length > 0 && (
                <Select value={crmSegmento} onValueChange={setCrmSegmento}>
                  <SelectTrigger className="w-48 bg-white">
                    <SelectValue placeholder="Segmento CRM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Seg. CRM</SelectItem>
                    {(availableFilters?.crmSegmentos || []).map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

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
                className="bg-teal-500 hover:bg-teal-600 text-white"
              >
                Aplicar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowCustomDates(false); setPeriod("current_month"); setCustomStart(""); setCustomEnd(""); customStartRef.current = ""; customEndRef.current = ""; }}
                className="text-slate-500"
              >
                Limpar
              </Button>
            </div>
          )}
        </div>
      </div>

      <main className="container py-6 pb-20 md:pb-6 space-y-6">
        <div className="text-center py-2">
          <h2 className="text-xl md:text-4xl font-semibold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            <span className="text-slate-700">Dashboard de Vendas</span>
            <span className="text-teal-600 ml-1 md:ml-2">Grupo Fox</span>
          </h2>
          <p className="text-[10px] md:text-sm text-slate-400 mt-1 md:mt-1.5 tracking-widest uppercase">Pedidos, Faturamento e Inadimplência</p>
        </div>

        {/* Sub-abas Vendas */}
        {canSeeFornecedores && (
          <div className="flex items-center md:justify-center gap-0.5 md:gap-1 bg-white rounded-lg border border-slate-200 shadow-sm p-1 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setSalesTab("vendas")}
              className={`flex items-center gap-1 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                salesTab === "vendas"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 md:w-4 md:h-4 hidden md:block" />
              Vendas
            </button>
            <button
              onClick={() => setSalesTab("fornecedores")}
              className={`flex items-center gap-1 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                salesTab === "fornecedores"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Truck className="w-3.5 h-3.5 md:w-4 md:h-4 hidden md:block" />
              Fornecedores Brasileiros
            </button>
            <button
              onClick={() => setSalesTab("metricas")}
              className={`flex items-center gap-1 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                salesTab === "metricas"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 hidden md:block" />
              Métricas de Vendas
            </button>
          </div>
        )}

        {/* Tab: Fornecedores Brasileiros */}
        {salesTab === "fornecedores" && canSeeFornecedores && (
          <FornecedoresBrasileirosTab />
        )}

        {/* Tab: Métrica de Vendas */}
        {salesTab === "metricas" && canSeeFornecedores && (
          <MetricaVendasTab />
        )}

        {/* Tab: Vendas (conteúdo original) */}
        {salesTab === "vendas" && (
        <>
        <ConnectionStatusCard />

        <ClientSearchCard />

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
            {/* Filters bar - destacado */}
            <div className="bg-white rounded-xl border-2 border-teal-200 shadow-sm p-4 mb-2">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Grupo filter */}
                <Select value={grupo} onValueChange={handleGrupoChange}>
                  <SelectTrigger className="w-72 bg-slate-50 border-slate-200 font-medium">
                    <SelectValue placeholder="Grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2">Todos os Grupos</span>
                    </SelectItem>
                    {(availableFilters?.grupos || []).map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        <span className="flex items-center gap-2">
                          {g.value === "importacao_revenda" && <Leaf className="w-3.5 h-3.5 text-teal-500" />}
                          {g.value === "industrializacao" && <Factory className="w-3.5 h-3.5 text-violet-500" />}
                          {g.value === "importacao_mp" && <Package className="w-3.5 h-3.5 text-blue-500" />}
                          {g.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Subgrupo filter */}
                {grupo !== "all" && subgrupoOptions.length > 1 && (
                  <Select value={subgrupo} onValueChange={setSubgrupo}>
                    <SelectTrigger className="w-48 bg-slate-50 border-slate-200 font-medium">
                      <SelectValue placeholder="Subgrupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Subgrupos</SelectItem>
                      {subgrupoOptions.map((s: { value: string; label: string }) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* CRM Segmento filter */}
                {(availableFilters?.crmSegmentos || []).length > 0 && (
                  <Select value={crmSegmento} onValueChange={setCrmSegmento}>
                    <SelectTrigger className="w-48 bg-slate-50 border-slate-200 font-medium">
                      <SelectValue placeholder="Segmento CRM" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Seg. CRM</SelectItem>
                      {(availableFilters?.crmSegmentos || []).map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Period selector */}
                <Select
                  value={period.startsWith("custom:") ? "custom" : period}
                  onValueChange={handlePeriodChange}
                >
                  <SelectTrigger className="w-48 bg-slate-50 border-slate-200 font-medium">
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

                {/* PDF Export button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={pdfExporting || !analytics}
                  className="ml-auto bg-white border-slate-200 hover:bg-teal-50 hover:border-teal-300 text-slate-600 hover:text-teal-700 transition-colors"
                >
                  {pdfExporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4 mr-2" />
                  )}
                  {pdfExporting ? "Gerando..." : "Exportar PDF"}
                </Button>
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
                    className="bg-teal-500 hover:bg-teal-600 text-white"
                  >
                    Aplicar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowCustomDates(false); setPeriod("current_month"); setCustomStart(""); setCustomEnd(""); customStartRef.current = ""; customEndRef.current = ""; }}
                    className="text-slate-500"
                  >
                    Limpar
                  </Button>
                </div>
              )}
            </div>

            {/* Period + filter label */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-base text-slate-500">
                Periodo: <span className="text-lg font-bold text-slate-800">{label}</span>
                {grupo !== "all" && (
                  <>
                    {" "}&bull;{" "}
                    <span className="font-semibold text-slate-700">
                      {availableFilters?.grupos.find(g => g.value === grupo)?.label || grupo}
                    </span>
                  </>
                )}
                {subgrupo !== "all" && (
                  <>
                    {" "}&rsaquo;{" "}
                    <span className="font-semibold text-slate-700">
                      {subgrupoOptions.find((s: { value: string; label: string }) => s.value === subgrupo)?.label || subgrupo}
                    </span>
                  </>
                )}
                {crmSegmento !== "all" && (
                  <>
                    {" "}&bull;{" "}
                    <span className="font-semibold text-teal-600">{crmSegmento}</span>
                  </>
                )}
                {" "}&mdash; {analytics.totalItems} itens em {analytics.totalOrders} pedidos
              </p>
            </div>

            {/* KPI Principal - Valor Total + Faturado + A Faturar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-teal-400 to-teal-600" />
              <div className="grid grid-cols-1 md:grid-cols-4">
                {/* Valor Total */}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-teal-50">
                      <DollarSign className="w-4.5 h-4.5 text-teal-600" />
                    </div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex-1">Valor Total do Periodo</p>
                    {canVerifyMaxiprod && (
                      <button onClick={() => setSimulatorCard({ section: "vendas", title: "Contraprova: Valor Total", subtitle: "Pedidos de Venda", value: analytics.totalValue })}
                        className="w-7 h-7 rounded-full bg-teal-100 hover:bg-teal-200 flex items-center justify-center transition-colors" title="Ver passo a passo Maxiprod">
                        <Eye className="w-3.5 h-3.5 text-teal-600" />
                      </button>
                    )}
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{formatCurrencyFull(analytics.totalValue)}</p>
                  <p className="text-xs text-slate-400 mt-1.5">{analytics.totalOrders} pedidos &bull; {analytics.totalClients} clientes</p>
                  <p className="text-xs text-slate-400">Ticket medio: {formatCurrencyFull(analytics.ticketMedio)}</p>
                  {/* Botão vermelho de cancelados */}
                  {analytics.totalCancelado > 0 && (
                    <button
                      onClick={() => setShowCanceledDialog(true)}
                      className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300 transition-all group"
                    >
                      <Ban className="w-4 h-4 text-red-500 group-hover:text-red-600" />
                      <div className="flex-1 text-left">
                        <p className="text-xs font-bold text-red-600">{formatCurrencyFull(analytics.totalCancelado)} cancelado</p>
                        <p className="text-[10px] text-red-400">{analytics.canceledOrders.length} {analytics.canceledOrders.length === 1 ? 'pedido' : 'pedidos'} — clique para detalhes</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-red-400 group-hover:text-red-500" />
                    </button>
                  )}
                </div>

                {/* Faturado */}
                <div className="p-5 border-t md:border-t-0 md:border-l border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-50">
                      <FileCheck className="w-4.5 h-4.5 text-emerald-600" />
                    </div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex-1">Faturado</p>
                    {canVerifyMaxiprod && (
                      <button onClick={() => setSimulatorCard({ section: "vendas_faturado", title: "Contraprova: Faturado (Vendas)", subtitle: "Pedidos de venda com estado Faturado", value: analytics.totalFaturado })}
                        className="w-7 h-7 rounded-full bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center transition-colors" title="Ver passo a passo Maxiprod">
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      </button>
                    )}
                  </div>
                  <p className="text-2xl font-extrabold text-emerald-700 tracking-tight">{formatCurrencyFull(analytics.totalFaturado)}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(((analytics.totalFaturado / (analytics.totalValue || 1)) * 100), 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">
                      {((analytics.totalFaturado / (analytics.totalValue || 1)) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* A Faturar */}
                <div className="p-5 border-t md:border-t-0 md:border-l border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-orange-50">
                      <Clock className="w-4.5 h-4.5 text-orange-600" />
                    </div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex-1">A Faturar (Periodo)</p>
                    {canVerifyMaxiprod && (
                      <button onClick={() => setSimulatorCard({ section: "a_faturar", title: "Contraprova: A Faturar", subtitle: "Pedidos A Faturar", value: analytics.totalAFaturar })}
                        className="w-7 h-7 rounded-full bg-orange-100 hover:bg-orange-200 flex items-center justify-center transition-colors" title="Ver passo a passo Maxiprod">
                        <Eye className="w-3.5 h-3.5 text-orange-600" />
                      </button>
                    )}
                  </div>
                  <p className="text-2xl font-extrabold text-orange-700 tracking-tight">{formatCurrencyFull(analytics.totalAFaturar)}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(((analytics.totalAFaturar / (analytics.totalValue || 1)) * 100), 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-orange-600 whitespace-nowrap">
                      {((analytics.totalAFaturar / (analytics.totalValue || 1)) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Amostra / Bonificação */}
                <div className="p-5 border-t md:border-t-0 md:border-l border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50">
                        <Gift className="w-4.5 h-4.5 text-blue-600" />
                      </div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex-1">Amostra / Bonificação</p>
                      {canVerifyMaxiprod && (
                        <button onClick={() => setSimulatorCard({ section: "amostra_bonif", title: "Contraprova: Amostra/Bonificação", subtitle: "Pedidos de Amostra e Bonificação", value: analytics.totalAmostraBonif })}
                          className="w-7 h-7 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center transition-colors" title="Ver passo a passo Maxiprod">
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                        </button>
                      )}
                    </div>
                    <p className="text-2xl font-extrabold text-blue-700 tracking-tight">{formatCurrencyFull(analytics.totalAmostraBonif)}</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Amostra</span>
                        <span className="font-semibold text-blue-600">{formatCurrencyFull(analytics.totalAmostra)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Bonificação</span>
                        <span className="font-semibold text-blue-600">{formatCurrencyFull(analytics.totalBonificacao)}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(((analytics.totalAmostraBonif / (analytics.totalValue || 1)) * 100), 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-blue-600 whitespace-nowrap">
                        {((analytics.totalAmostraBonif / (analytics.totalValue || 1)) * 100).toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 italic">Percentual que amostra/bonificação representam no total de vendas do período</p>
                    <p className="text-xs text-slate-400 mt-1">{analytics.pedidosAmostraBonif} pedidos</p>
                  </div>
              </div>
              {/* Barra informativa de pedidos cancelados */}
              {analytics.totalCancelado > 0 && (
                <div className="border-t border-slate-100 px-5 py-3 bg-gradient-to-r from-red-50/50 to-transparent">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Info className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-red-600">{formatCurrencyFull(analytics.totalCancelado)}</span>
                      <span className="text-slate-400"> em pedidos cancelados ({analytics.canceledOrders.length} {analytics.canceledOrders.length === 1 ? 'pedido' : 'pedidos'})</span>
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 ml-7 italic">Cancelados ESTÃO incluídos no valor total (para valorizar o vendedor). Use o botão vermelho para ver o impacto na comissão.</p>
                </div>
              )}
            </div>

            {/* Dialog de Pedidos Cancelados */}
            <Dialog open={showCanceledDialog} onOpenChange={setShowCanceledDialog}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-700">
                    <Ban className="w-5 h-5" />
                    Pedidos Cancelados no Período
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-red-700">Total Cancelado</span>
                      <span className="text-lg font-extrabold text-red-700">{formatCurrencyFull(analytics.totalCancelado)}</span>
                    </div>
                    <p className="text-xs text-red-500 mt-1">
                      Estes pedidos foram cancelados neste período. O valor total de vendas INCLUI estes pedidos (para valorizar o vendedor). Para cálculo de comissão, subtraia este valor do total.
                    </p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700">Impacto na Comissão</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          <span className="font-bold">Base de comissão = Total Vendas - Cancelados</span><br/>
                          Total Vendas: {formatCurrencyFull(analytics.totalValue)} - Cancelados: {formatCurrencyFull(analytics.totalCancelado)} = <span className="font-bold">{formatCurrencyFull(analytics.totalValue - analytics.totalCancelado)}</span> (base para comissão)
                        </p>
                      </div>
                    </div>
                  </div>
                  {analytics.canceledOrders.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Pedido</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Cliente</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {analytics.canceledOrders.map((order: { pedido: string; cliente: string; valor: number; dataEmissao: string; dataCancelamento?: string; representante?: string }, idx: number) => (
                            <tr key={idx} className="hover:bg-red-50/50 transition-colors">
                              <td className="px-4 py-2.5">
                                <span className="font-mono font-semibold text-slate-700">#{order.pedido}</span>
                                {order.dataEmissao && (
                                  <p className="text-[10px] text-slate-400">Emitido: {new Date(order.dataEmissao).toLocaleDateString('pt-BR')}</p>
                                )}
                                {order.dataCancelamento && (
                                  <p className="text-[10px] text-red-400">Cancelado: {new Date(order.dataCancelamento).toLocaleDateString('pt-BR')}</p>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-slate-600 text-xs">{order.cliente}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-red-600">{formatCurrencyFull(order.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-red-50 border-t border-red-200">
                            <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-red-700 uppercase">Total Cancelado</td>
                            <td className="px-4 py-2.5 text-right font-extrabold text-red-700">{formatCurrencyFull(analytics.totalCancelado)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Tabela de Detalhamento por Segmento / CRM */}
            {(() => {
              const showCrm = grupo !== "all" && (analytics.byCrmSegmentKPI || []).length > 0;
              const segments = showCrm ? (analytics.byCrmSegmentKPI || []) : (analytics.bySegmentKPI || []);
              const title = showCrm ? "Detalhamento por CRM" : "Detalhamento por Segmento";
              const colLabel = showCrm ? "Segmento CRM" : "Segmento";
              return segments.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{colLabel}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Total</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-600 uppercase tracking-wider">Faturado</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-orange-600 uppercase tracking-wider">A Faturar</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">% Total</th>
                      </tr>
                    </thead>
                    <SegmentTableBody segments={segments} totalValue={analytics.totalValue} />
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td className="px-5 py-3">
                          <span className="text-sm font-bold text-slate-700 uppercase">Total</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-extrabold text-slate-900">{formatCurrencyFull(analytics.totalValue)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-extrabold text-emerald-700">{formatCurrencyFull(analytics.totalFaturado)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-extrabold text-orange-700">{formatCurrencyFull(analytics.totalAFaturar)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-bold text-slate-600">100%</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : null;
            })()}

            {/* Card Evolução Diária - colapsável */}
            <div className="bg-emerald-50/40 rounded-lg border border-emerald-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setChartExpanded(!chartExpanded)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-emerald-50/50 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 flex-shrink-0" />
                  <h3 className="text-sm sm:text-base font-semibold text-slate-700 uppercase tracking-wide">Evolucao Diaria</h3>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                  <span className="text-sm sm:text-base font-bold text-slate-800">{formatCurrencyFull(analytics.totalValue)}</span>
                  {chartExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              </button>
              {chartExpanded && (
                <div id="sales-daily-chart" className="border-t border-emerald-200 p-5">
                  <div className="flex items-center justify-end mb-4">
                    <div className="flex gap-1 bg-slate-100 rounded-md p-0.5">
                      <button
                        onClick={() => setChartMode("value")}
                        className={`px-4 py-1.5 text-sm rounded-md ${chartMode === "value" ? "bg-white shadow-sm text-slate-700" : "text-slate-500"}`}
                      >
                        Valor (R$)
                      </button>
                      <button
                        onClick={() => setChartMode("orders")}
                        className={`px-4 py-1.5 text-sm rounded-md ${chartMode === "orders" ? "bg-white shadow-sm text-slate-700" : "text-slate-500"}`}
                      >
                        Pedidos
                      </button>
                    </div>
                  </div>
                  <DailyChart data={analytics.byDay} mode={chartMode} period={period} comparison={comparison} />
                </div>
              )}
            </div>

            {/* Card Pedidos Faturados */}
            {orders && orders.filter(o => o.estadoItem === "Faturado").length > 0 && (
              <OrdersCard orders={orders.filter(o => o.estadoItem === "Faturado")} title="Pedidos Faturados" variant="faturado" />
            )}

            {/* Card A Faturar Mês Atual */}
            {orders && orders.filter(o => o.estadoItem !== "Faturado").length > 0 && (
              <OrdersCard orders={orders.filter(o => o.estadoItem !== "Faturado")} title='A Faturar "Mês Atual"' variant="a_faturar" />
            )}

            {/* Card A Faturar (Anterior) */}
            {previousUnbilled && previousUnbilled.orders.length > 0 && (
              <PreviousUnbilledCard months={previousUnbilled.months} orders={previousUnbilled.orders} />
            )}

            {/* Card EXTRA: A Faturar (Completo) - Pesquisa rápida últimos 90 dias */}
            {showAFaturarCompleto && allUnbilled && allUnbilled.orders.length > 0 && (
              <UnifiedUnbilledCard months={allUnbilled.months} orders={allUnbilled.orders} totalValue={allUnbilled.totalValue} />
            )}

            {/* Cards de Inadimplência - compartilhados com aba Financeiro */}
            {financialSummary && financialSummary.receber.vencidas.count > 0 && (
              <div className="space-y-4">
                <InadimplenciaCard summary={financialSummary} grupo={grupo} crmSegmento={crmSegmento} />
                <ClientesInadimplentesCard grupo={grupo} crmSegmento={crmSegmento} />
              </div>
            )}

            {/* Card Em Digitação - informativo, não soma nos KPIs */}
            {draftOrders && draftOrders.orders.length > 0 && (
              <DraftOrdersCard orders={draftOrders.orders} />
            )}
          </>
        ) : null}
        </>
        )}
      </main>

      {/* Maxiprod Auto-Verifier Modal */}
      {simulatorCard && start && end && (
        <MaxiprodAutoVerifier
          title={simulatorCard.title}
          subtitle={simulatorCard.subtitle}
          section={simulatorCard.section as VerifySection}
          startDate={start}
          endDate={end}
          valorManus={simulatorCard.value}
          onClose={() => setSimulatorCard(null)}
        />
      )}
    </div>
  );
}
