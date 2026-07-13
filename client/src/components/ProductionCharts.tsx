/**
 * ProductionCharts — Semáforo Geral + Gráfico por Setor + Tabela de Paradas
 * Versão simplificada conforme requisitos Jul/2026
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, LabelList,
} from "recharts";
import {
  BarChart3, Calendar, Loader2, Activity, TrendingUp, TrendingDown,
  ArrowUp, ArrowDown, Minus, ChevronLeft, Wrench, AlertTriangle,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

function fmtNum(n: number, decimals = 1): string {
  if (n == null || isNaN(n)) return "0";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtFullDate(dateStr: string): string {
  const parts = dateStr.split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function fmtDate(dateStr: string): string {
  const parts = dateStr.split("-");
  return `${parts[2]}/${parts[1]}`;
}

function getMonthRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T12:00:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  return { start: firstDay.toISOString().slice(0, 10), end: lastDay.toISOString().slice(0, 10) };
}

function getPrevMonthRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T12:00:00");
  const y = d.getFullYear();
  const m = d.getMonth() - 1;
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  return { start: firstDay.toISOString().slice(0, 10), end: lastDay.toISOString().slice(0, 10) };
}

function getWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

// Count working days (Mon-Fri) in a date range up to today
function countWorkingDays(start: string, end: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const endDate = end > today ? today : end;
  let count = 0;
  const d = new Date(start + "T12:00:00");
  const endD = new Date(endDate + "T12:00:00");
  while (d <= endD) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* ═══════════════════════════════════════════════════════
   AnimatedNumber
   ═══════════════════════════════════════════════════════ */
function AnimatedNumber({ value, decimals = 0, duration = 800 }: { value: number; decimals?: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();
    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + diff * eased);
      if (progress < 1) requestAnimationFrame(animate);
      else prevRef.current = value;
    }
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{fmtNum(display, decimals)}</>;
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */

interface ProductionChartsProps {
  selectedDate: string;
  sectors: Array<{
    id: number;
    nome: string;
    ordem: number;
    unidade: string;
    machines: Array<{ id: number; nome: string; ordem: number }>;
  }>;
}

export default function ProductionCharts({ selectedDate, sectors }: ProductionChartsProps) {
  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(null);

  // Date ranges
  const currentMonthRange = useMemo(() => getMonthRange(selectedDate), [selectedDate]);
  const prevMonthRange = useMemo(() => getPrevMonthRange(selectedDate), [selectedDate]);
  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);

  // Fetch current month data
  const { data: currentMonthData, isLoading: loadingCurrent } = trpc.production.getHistory.useQuery({
    dataInicio: currentMonthRange.start,
    dataFim: currentMonthRange.end,
  });

  // Fetch previous month data for comparison
  const { data: prevMonthData, isLoading: loadingPrev } = trpc.production.getHistory.useQuery({
    dataInicio: prevMonthRange.start,
    dataFim: prevMonthRange.end,
  });

  // Fetch week data for sector drill-down
  const { data: weekData } = trpc.production.getHistory.useQuery({
    dataInicio: weekRange.start,
    dataFim: weekRange.end,
  });

  const isLoading = loadingCurrent || loadingPrev;

  // Count working days in current month up to today
  const workingDaysCurrent = useMemo(() => countWorkingDays(currentMonthRange.start, currentMonthRange.end), [currentMonthRange]);
  const workingDaysPrev = useMemo(() => {
    // Full previous month
    const d = new Date(prevMonthRange.end + "T12:00:00");
    return countWorkingDays(prevMonthRange.start, d.toISOString().slice(0, 10));
  }, [prevMonthRange]);

  // Check if we're in the first 5 working days of the month
  const isEarlyMonth = useMemo(() => workingDaysCurrent <= 5, [workingDaysCurrent]);

  // Process Semáforo data
  const semaforoData = useMemo(() => {
    if (!currentMonthData || !sectors.length) return [];

    return sectors.map(sector => {
      // Current month production
      const currentEntries = currentMonthData.filter(e => e.sectorId === sector.id && Number(e.quantidade) > 0);
      const currentTotal = currentEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
      const daysWithProd = new Set(currentEntries.map(e => e.data)).size;
      const currentAvg = daysWithProd > 0 ? currentTotal / daysWithProd : 0;

      // Previous month production
      const prevEntries = (prevMonthData || []).filter(e => e.sectorId === sector.id && Number(e.quantidade) > 0);
      const prevTotal = prevEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
      const prevDaysWithProd = new Set(prevEntries.map(e => e.data)).size;
      const prevAvg = prevDaysWithProd > 0 ? prevTotal / prevDaysWithProd : 0;

      // Reference average: if early month, use prev month avg
      const referenceAvg = isEarlyMonth ? prevAvg : currentAvg;

      // Today's production
      const todayEntries = currentMonthData.filter(e => e.sectorId === sector.id && e.data === selectedDate);
      const todayProd = todayEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);

      // Status: compare today vs reference average
      let status: "green" | "yellow" | "red" = "green";
      if (referenceAvg > 0) {
        const ratio = todayProd / referenceAvg;
        if (ratio < 0.9) status = "red";
        else if (ratio < 1.0) status = "yellow";
      } else if (todayProd === 0) {
        status = "red";
      }

      // Comparison vs previous month
      let vsPrev: "up" | "down" | "equal" = "equal";
      if (prevAvg > 0 && currentAvg > 0) {
        if (currentAvg > prevAvg * 1.02) vsPrev = "up";
        else if (currentAvg < prevAvg * 0.98) vsPrev = "down";
      }

      const diffPct = prevAvg > 0 ? ((currentAvg - prevAvg) / prevAvg) * 100 : 0;

      return {
        id: sector.id,
        name: sector.nome,
        unit: sector.unidade,
        todayProd,
        currentAvg,
        prevAvg,
        referenceAvg,
        status,
        vsPrev,
        diffPct,
        currentTotal,
        prevTotal,
      };
    }).filter(s => s.currentTotal > 0 || s.prevTotal > 0 || s.todayProd > 0);
  }, [currentMonthData, prevMonthData, sectors, selectedDate, isEarlyMonth]);

  // Process Paradas data (current month)
  const paradasData = useMemo(() => {
    if (!currentMonthData || !sectors.length) return { rows: [], prodNaoNecessaria: [] as Array<{ name: string; count: number }> };

    const rows = sectors.map(sector => {
      const entries = currentMonthData.filter(e => e.sectorId === sector.id);
      const manutencao = entries.filter(e => e.status === "manutencao").length;
      const pontual = entries.filter(e => e.status === "manutencao_pontual").length;
      const faltaMadeira = entries.filter(e => e.status === "falta_madeira").length;
      const prodNaoNec = entries.filter(e => e.status === "producao_nao_necessaria").length;
      const total = manutencao + pontual + faltaMadeira;
      return { name: sector.nome, manutencao, pontual, faltaMadeira, total, prodNaoNec };
    }).filter(r => r.total > 0 || r.prodNaoNec > 0);

    const prodNaoNecessaria = rows.filter(r => r.prodNaoNec > 0).map(r => ({ name: r.name, count: r.prodNaoNec }));

    return { rows: rows.filter(r => r.total > 0), prodNaoNecessaria };
  }, [currentMonthData, sectors]);

  // Process sector drill-down data (week view)
  const sectorDrillDown = useMemo(() => {
    if (!selectedSectorId || !weekData) return null;

    const sector = sectors.find(s => s.id === selectedSectorId);
    if (!sector) return null;

    const sectorEntries = weekData.filter(e => e.sectorId === selectedSectorId);

    // Build daily data for the week
    const days: Array<{ date: string; label: string; weekday: string; value: number; color: string }> = [];
    const d = new Date(weekRange.start + "T12:00:00");
    const endD = new Date(weekRange.end + "T12:00:00");

    // Get the reference average for this sector
    const semaforoEntry = semaforoData.find(s => s.id === selectedSectorId);
    const avg = semaforoEntry?.referenceAvg || 0;

    while (d <= endD) {
      const dateStr = d.toISOString().slice(0, 10);
      const dayEntries = sectorEntries.filter(e => e.data === dateStr);
      const value = dayEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);

      let color = "#10b981"; // green
      if (avg > 0) {
        const ratio = value / avg;
        if (ratio < 0.9) color = "#ef4444"; // red
        else if (ratio < 1.0) color = "#f59e0b"; // yellow
      } else if (value === 0) {
        color = "#94a3b8"; // gray for no production
      }

      days.push({
        date: dateStr,
        label: fmtDate(dateStr),
        weekday: WEEKDAY_NAMES[d.getDay()],
        value,
        color,
      });
      d.setDate(d.getDate() + 1);
    }

    return {
      sector,
      days,
      avg,
      prevAvg: semaforoEntry?.prevAvg || 0,
      diffPct: semaforoEntry?.diffPct || 0,
    };
  }, [selectedSectorId, weekData, weekRange, sectors, semaforoData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-teal-100 animate-spin border-t-teal-500" />
          <Activity className="w-6 h-6 text-teal-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <span className="text-slate-500 font-medium animate-pulse">Carregando dados...</span>
      </div>
    );
  }

  if (!currentMonthData?.length && !prevMonthData?.length) {
    return (
      <div className="text-center py-16">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">Nenhum dado de produção encontrado</p>
        <p className="text-xs text-slate-400 mt-1">Selecione um período com lançamentos.</p>
      </div>
    );
  }

  // If a sector is selected, show drill-down
  if (selectedSectorId && sectorDrillDown) {
    return (
      <div className="space-y-4">
        {/* Back button */}
        <button
          onClick={() => setSelectedSectorId(null)}
          className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 font-medium transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar ao Semáforo Geral
        </button>

        {/* Sector header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{sectorDrillDown.sector.nome}</h3>
              <p className="text-xs text-slate-500">
                Semana {fmtFullDate(weekRange.start)} a {fmtFullDate(weekRange.end)} — Unidade: {sectorDrillDown.sector.unidade}
              </p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorDrillDown.days} margin={{ top: 30, right: 10, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="weekday"
                  tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v: number) => fmtNum(v, 0)} />
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
                        <p className="font-bold text-slate-700 mb-1">{item.weekday} — {item.label}</p>
                        <p className="text-slate-600">Produção: <strong>{fmtNum(item.value, 0)} {sectorDrillDown.sector.unidade}</strong></p>
                        <p className="text-slate-500 mt-1">Média ref.: {fmtNum(sectorDrillDown.avg, 1)}</p>
                      </div>
                    );
                  }}
                />
                {sectorDrillDown.avg > 0 && (
                  <ReferenceLine
                    y={sectorDrillDown.avg}
                    stroke="#6366f1"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{ value: `Média: ${fmtNum(sectorDrillDown.avg, 1)}`, position: "right", fontSize: 11, fill: "#6366f1", fontWeight: 600 }}
                  />
                )}
                <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={800}>
                  {sectorDrillDown.days.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                  <LabelList dataKey="value" position="top" formatter={(v: number) => v > 0 ? fmtNum(v, 0) : ""}
                    style={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary below chart */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center">
              <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wider">Média Mês Atual</p>
              <p className="text-xl font-bold text-teal-800 mt-1">{fmtNum(sectorDrillDown.avg, 1)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Média Mês Anterior</p>
              <p className="text-xl font-bold text-blue-800 mt-1">{fmtNum(sectorDrillDown.prevAvg, 1)}</p>
            </div>
            <div className={`${sectorDrillDown.diffPct >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"} border rounded-xl p-3 text-center`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${sectorDrillDown.diffPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>Diferença</p>
              <p className={`text-xl font-bold mt-1 ${sectorDrillDown.diffPct >= 0 ? "text-emerald-800" : "text-red-800"}`}>
                {sectorDrillDown.diffPct >= 0 ? "+" : ""}{fmtNum(sectorDrillDown.diffPct, 1)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main view: Semáforo Geral + Tabela de Paradas
  return (
    <div className="space-y-6">
      {/* ═══ Semáforo Geral ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Semáforo Geral</h3>
            <p className="text-xs text-slate-500">
              Dia selecionado: {fmtFullDate(selectedDate)} — Mês: {currentMonthRange.start.slice(5, 7)}/{currentMonthRange.start.slice(0, 4)}
              {isEarlyMonth && <span className="ml-2 text-amber-600 font-medium">(Usando média mês anterior como referência)</span>}
            </p>
          </div>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wider">Produção Hoje</p>
            <p className="text-xl font-bold text-teal-800 mt-1 tabular-nums">
              <AnimatedNumber value={semaforoData.reduce((s, d) => s + d.todayProd, 0)} />
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Média Diária (Mês)</p>
            <p className="text-xl font-bold text-blue-800 mt-1 tabular-nums">
              <AnimatedNumber value={semaforoData.reduce((s, d) => s + d.currentAvg, 0)} decimals={1} />
            </p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Setores OK</p>
            <p className="text-xl font-bold text-emerald-800 mt-1 tabular-nums">
              <AnimatedNumber value={semaforoData.filter(s => s.status === "green").length} />
            </p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Setores Alerta</p>
            <p className="text-xl font-bold text-red-800 mt-1 tabular-nums">
              <AnimatedNumber value={semaforoData.filter(s => s.status === "red").length} />
            </p>
          </div>
        </div>

        {/* Semáforo Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-teal-200 bg-teal-50/50">
                <th className="text-left py-3 px-3 text-teal-700 font-semibold text-xs">Setor</th>
                <th className="text-right py-3 px-3 text-teal-700 font-semibold text-xs">Prod. Hoje</th>
                <th className="text-right py-3 px-3 text-teal-700 font-semibold text-xs">Média Mês</th>
                <th className="text-center py-3 px-3 text-teal-700 font-semibold text-xs">Status</th>
                <th className="text-center py-3 px-3 text-teal-700 font-semibold text-xs">vs Mês Ant.</th>
              </tr>
            </thead>
            <tbody>
              {semaforoData.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`transition-all duration-200 cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-teal-50 hover:shadow-sm`}
                  onClick={() => setSelectedSectorId(row.id)}
                  title={`Clique para ver gráfico semanal de ${row.name}`}
                >
                  <td className="py-3 px-3 font-medium text-slate-700">{row.name}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-800 tabular-nums">
                    {fmtNum(row.todayProd, 0)} <span className="text-[9px] text-slate-400 font-normal">{row.unit}</span>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600 tabular-nums">
                    {fmtNum(row.referenceAvg, 1)} <span className="text-[9px] text-slate-400 font-normal">{row.unit}/dia</span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className={`w-4 h-4 rounded-full mx-auto ${
                      row.status === "green" ? "bg-emerald-500" :
                      row.status === "yellow" ? "bg-amber-400" :
                      "bg-red-500"
                    }`} title={
                      row.status === "green" ? "Acima ou igual à média" :
                      row.status === "yellow" ? "Até 10% abaixo da média" :
                      "Mais de 10% abaixo da média"
                    } />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {row.vsPrev === "up" ? (
                        <>
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-xs font-semibold text-emerald-600">+{fmtNum(Math.abs(row.diffPct), 0)}%</span>
                        </>
                      ) : row.vsPrev === "down" ? (
                        <>
                          <ArrowDown className="w-3.5 h-3.5 text-red-600" />
                          <span className="text-xs font-semibold text-red-600">{fmtNum(row.diffPct, 0)}%</span>
                        </>
                      ) : (
                        <>
                          <Minus className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs text-slate-400">—</span>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {semaforoData.length > 0 && (
          <p className="text-[10px] text-slate-400 mt-3 text-center">
            Clique em um setor para ver o gráfico de barras da semana
          </p>
        )}
      </div>

      {/* ═══ Tabela de Paradas (Simplificada) ═══ */}
      {(paradasData.rows.length > 0 || paradasData.prodNaoNecessaria.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Paradas do Mês</h3>
              <p className="text-xs text-slate-500">
                {currentMonthRange.start.slice(5, 7)}/{currentMonthRange.start.slice(0, 4)} — Total: {paradasData.rows.reduce((s, r) => s + r.total, 0)} paradas
              </p>
            </div>
          </div>

          {paradasData.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-violet-200 bg-violet-50/50">
                    <th className="text-left py-3 px-3 text-violet-700 font-semibold text-xs">Setor</th>
                    <th className="text-right py-3 px-3 text-indigo-600 font-semibold text-xs">Manutenção</th>
                    <th className="text-right py-3 px-3 text-purple-600 font-semibold text-xs">Pontual</th>
                    <th className="text-right py-3 px-3 text-red-600 font-semibold text-xs">Falta Mad.</th>
                    <th className="text-right py-3 px-3 text-slate-700 font-bold text-xs">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {paradasData.rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`transition-colors duration-200 ${
                        row.total > 0 ? "bg-red-50/30 hover:bg-red-50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                      }`}
                    >
                      <td className={`py-3 px-3 font-medium ${row.total > 0 ? "text-red-700" : "text-slate-700"}`}>{row.name}</td>
                      <td className="py-3 px-3 text-right font-bold text-indigo-700 tabular-nums">{row.manutencao || "—"}</td>
                      <td className="py-3 px-3 text-right font-bold text-purple-700 tabular-nums">{row.pontual || "—"}</td>
                      <td className="py-3 px-3 text-right font-bold text-red-700 tabular-nums">{row.faltaMadeira || "—"}</td>
                      <td className={`py-3 px-3 text-right font-bold tabular-nums ${row.total > 0 ? "text-red-800 text-base" : "text-slate-600"}`}>
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-violet-200 bg-violet-50/50">
                    <td className="py-3 px-3 font-bold text-slate-800">TOTAL</td>
                    <td className="py-3 px-3 text-right font-bold text-indigo-700 tabular-nums">{paradasData.rows.reduce((s, r) => s + r.manutencao, 0)}</td>
                    <td className="py-3 px-3 text-right font-bold text-purple-700 tabular-nums">{paradasData.rows.reduce((s, r) => s + r.pontual, 0)}</td>
                    <td className="py-3 px-3 text-right font-bold text-red-700 tabular-nums">{paradasData.rows.reduce((s, r) => s + r.faltaMadeira, 0)}</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 text-base tabular-nums">{paradasData.rows.reduce((s, r) => s + r.total, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Prod. Não Necessária - separated in gray */}
          {paradasData.prodNaoNecessaria.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400 font-medium mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Produção Não Necessária (não contabilizada como parada)
              </p>
              <div className="flex flex-wrap gap-2">
                {paradasData.prodNaoNecessaria.map((item, idx) => (
                  <span key={idx} className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg">
                    {item.name}: <strong>{item.count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
