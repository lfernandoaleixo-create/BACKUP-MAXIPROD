/**
 * ProductionCharts — Gráficos profissionais de produção
 * Com filtros avançados, KPIs, animações dinâmicas, labels sem corte
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, LabelList,
  Area, AreaChart, ComposedChart, RadialBarChart, RadialBar,
} from "recharts";
import {
  BarChart3, Filter, Wrench, Calendar, ChevronDown, ChevronUp,
  Loader2, Factory, TrendingUp, AlertTriangle, X, Search,
  ArrowUpRight, ArrowDownRight, Minus, Eye, EyeOff, Zap, Activity,
  Info, CheckCircle,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════
   Constants & Helpers
   ═══════════════════════════════════════════════════════ */

const SECTOR_COLORS = [
  "#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444",
  "#ec4899", "#14b8a6", "#6366f1", "#f97316", "#84cc16",
];

const STATUS_COLORS: Record<string, string> = {
  producao_normal: "#10b981",
  falta_madeira: "#ef4444",
  producao_nao_necessaria: "#f59e0b",
  manutencao: "#6366f1",
  manutencao_pontual: "#8b5cf6",
};

const STATUS_LABELS: Record<string, string> = {
  producao_normal: "Produção Normal",
  falta_madeira: "Falta de Madeira",
  producao_nao_necessaria: "Prod. Não Necessária",
  manutencao: "Manutenção",
  manutencao_pontual: "Manutenção Pontual",
};

const MAINT_TYPES = [
  { key: "manutencao", label: "Manutenção", color: "#6366f1" },
  { key: "manutencaoPontual", label: "Manutenção Pontual", color: "#8b5cf6" },
  { key: "faltaMadeira", label: "Falta de Madeira", color: "#ef4444" },
  { key: "prodNaoNecessaria", label: "Prod. Não Necessária", color: "#f59e0b" },
];

// Animation constants
const ANIM = {
  barDuration: 1200,
  barEasing: "ease-out" as const,
  pieDuration: 1500,
  pieEasing: "ease-out" as const,
  areaDuration: 1400,
  areaEasing: "ease-in-out" as const,
  lineDuration: 1000,
  lineEasing: "ease-out" as const,
};

function fmtNum(n: number, decimals = 1): string {
  if (n == null || isNaN(n)) return "0";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(dateStr: string): string {
  const parts = dateStr.split("-");
  return `${parts[2]}/${parts[1]}`;
}

function fmtFullDate(dateStr: string): string {
  const parts = dateStr.split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Abbreviate long sector names for pie labels
function abbreviate(name: string, maxLen = 14): string {
  if (name.length <= maxLen) return name;
  // Common abbreviations
  const abbrevMap: Record<string, string> = {
    "Seleção Automática": "Sel. Autom.",
    "Seleção Visual": "Sel. Visual",
    "Seletoras Toco": "Sel. Toco",
    "Máquina Pirografar": "Máq. Pirog.",
    "Flow Pack": "Flow Pack",
    "Multilamina": "Multilam.",
    "Embalagem": "Embalagem",
    "Ponteira": "Ponteira",
    "Vareteira": "Vareteira",
  };
  if (abbrevMap[name]) return abbrevMap[name];
  return name.slice(0, maxLen - 1) + ".";
}

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

/* ═══════════════════════════════════════════════════════
   Animated Counter Component
   ═══════════════════════════════════════════════════════ */
function AnimatedNumber({ value, decimals = 0, duration = 1200 }: { value: number; decimals?: number; duration?: number }) {
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
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setDisplay(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevRef.current = value;
      }
    }
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{fmtNum(display, decimals)}</>;
}

/* ═══════════════════════════════════════════════════════
   Custom Tooltip — with sector name resolution & context
   ═══════════════════════════════════════════════════════ */
interface TooltipContext {
  sectorMap?: Map<number, string>;
  grandTotal?: number;
  contextLabel?: string; // e.g. "da produção total do período"
}
let _tooltipCtx: TooltipContext = {};
function setTooltipContext(ctx: TooltipContext) { _tooltipCtx = ctx; }

function resolveName(raw: string): string {
  if (!raw) return raw;
  // Resolve sector_N keys to real sector names
  const m = raw.match(/^sector_(\d+)$/);
  if (m && _tooltipCtx.sectorMap) {
    return _tooltipCtx.sectorMap.get(Number(m[1])) || raw;
  }
  return raw;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  const gt = _tooltipCtx.grandTotal || 0;
  const ctx = _tooltipCtx.contextLabel || "";
  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-2xl px-4 py-3 text-xs min-w-[240px] max-w-[340px] animate-in fade-in zoom-in-95 duration-200">
      <p className="font-bold text-slate-700 mb-2 text-sm border-b border-slate-100 pb-1.5">{label}</p>
      {payload.map((p: any, i: number) => {
        const name = resolveName(p.name);
        const pct = gt > 0 && p.value > 0 ? ((p.value / gt) * 100) : 0;
        return (
          <div key={i} className="flex items-center justify-between gap-3 py-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-slate-600 truncate">{name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-bold text-slate-800 tabular-nums">{fmtNum(p.value)}</span>
              {gt > 0 && pct > 0 && <span className="text-slate-400 tabular-nums">({fmtNum(pct, 0)}%)</span>}
            </div>
          </div>
        );
      })}
      {payload.length > 1 && (
        <div className="flex items-center justify-between gap-3 pt-1.5 mt-1.5 border-t border-slate-100">
          <span className="font-semibold text-slate-700">Total do dia</span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-teal-700 tabular-nums">{fmtNum(total)}</span>
            {gt > 0 && <span className="text-slate-400 tabular-nums">({fmtNum((total / gt) * 100, 0)}% {ctx})</span>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Custom Pie Label (no clipping)
   ═══════════════════════════════════════════════════════ */
const RADIAN = Math.PI / 180;
const renderCustomPieLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, name, pct, index,
}: any) => {
  const radius = outerRadius + 25;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const textAnchor = x > cx ? "start" : "end";
  const shortName = abbreviate(name, 16);
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      dominantBaseline="central"
      fill="#475569"
      fontSize={11}
      fontWeight={600}
    >
      {shortName} ({fmtNum(pct, 0)}%)
    </text>
  );
};

/* ═══════════════════════════════════════════════════════
   Filter Chip
   ═══════════════════════════════════════════════════════ */
const FilterChip = ({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
      active
        ? "text-white shadow-md scale-105"
        : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:scale-105"
    }`}
    style={active ? { backgroundColor: color || "#10b981" } : {}}
  >
    {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
    {label}
  </button>
);

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function ProductionCharts({ selectedDate, sectors }: ProductionChartsProps) {
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "custom">("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedSector, setSelectedSector] = useState<number | null>(null);

  // Selected day for detail view
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Collapsible section state — all start closed
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const toggleSection = useCallback((key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Filters for production chart
  const [prodSectorFilter, setProdSectorFilter] = useState<Set<number>>(new Set());
  const [showProdFilter, setShowProdFilter] = useState(false);

  // Filters for maintenance chart
  const [maintTypeFilter, setMaintTypeFilter] = useState<Set<string>>(new Set(MAINT_TYPES.map(t => t.key)));
  const [maintSectorFilter, setMaintSectorFilter] = useState<Set<number>>(new Set());
  const [showMaintFilter, setShowMaintFilter] = useState(false);

  // Animation key to re-trigger animations on filter change
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => { setAnimKey(k => k + 1); }, [chartPeriod, customStart, customEnd]);

  // Calculate date ranges
  const dateRange = useMemo(() => {
    if (chartPeriod === "custom" && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    const d = new Date(selectedDate + "T12:00:00");
    if (chartPeriod === "week") {
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(d);
      monday.setDate(d.getDate() + diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
    } else {
      const y = d.getFullYear();
      const m = d.getMonth();
      const firstDay = new Date(y, m, 1);
      const lastDay = new Date(y, m + 1, 0);
      return { start: firstDay.toISOString().slice(0, 10), end: lastDay.toISOString().slice(0, 10) };
    }
  }, [selectedDate, chartPeriod, customStart, customEnd]);

  const { data: historyData, isLoading } = trpc.production.getHistory.useQuery({
    dataInicio: dateRange.start,
    dataFim: dateRange.end,
  });

  // Toggle helpers
  const toggleProdSector = useCallback((id: number) => {
    setProdSectorFilter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleMaintType = useCallback((key: string) => {
    setMaintTypeFilter(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleMaintSector = useCallback((id: number) => {
    setMaintSectorFilter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ─── Process data ───
  const processedData = useMemo(() => {
    if (!historyData || !sectors.length) return null;

    const activeProdSectors = prodSectorFilter.size > 0
      ? sectors.filter(s => prodSectorFilter.has(s.id))
      : sectors;

    const byDate = new Map<string, typeof historyData>();
    for (const entry of historyData) {
      const arr = byDate.get(entry.data) || [];
      arr.push(entry);
      byDate.set(entry.data, arr);
    }
    const sortedDates = Array.from(byDate.keys()).sort();
    const totalDays = sortedDates.length;

    // 1. Daily production by sector (stacked bar)
    const dailyBySector = sortedDates.map(date => {
      const dayEntries = byDate.get(date) || [];
      const row: Record<string, any> = { date, dateLabel: fmtDate(date) };
      let dayTotal = 0;
      for (const sector of activeProdSectors) {
        const val = dayEntries
          .filter(e => e.sectorId === sector.id)
          .reduce((sum, e) => sum + Number(e.quantidade), 0);
        row[`sector_${sector.id}`] = val;
        dayTotal += val;
      }
      row.total = dayTotal;
      return row;
    });

    // 2. Sector totals
    const grandTotal = historyData.reduce((s, e) => s + Number(e.quantidade), 0);
    const sectorTotals = sectors.map((sector, idx) => {
      const entries = historyData.filter(e => e.sectorId === sector.id);
      const total = entries.reduce((sum, e) => sum + Number(e.quantidade), 0);
      const daysWithData = new Set(entries.map(e => e.data)).size;
      const avg = daysWithData > 0 ? total / daysWithData : 0;
      const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
      return {
        id: sector.id,
        name: sector.nome,
        value: total,
        unit: sector.unidade,
        color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
        avg,
        pct,
        daysWithData,
      };
    }).filter(s => s.value > 0);

    // 3. Machine breakdown for selected sector
    const machineData = selectedSector ? (() => {
      const sector = sectors.find(s => s.id === selectedSector);
      if (!sector || !sector.machines.length) return [];
      const sectorEntries = historyData.filter(e => e.sectorId === selectedSector);
      const sectorTotal = sectorEntries.reduce((s, e) => s + Number(e.quantidade), 0);
      return sector.machines.map(machine => {
        const machineEntries = sectorEntries.filter(e => e.machineId === machine.id);
        const total = machineEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
        const days = new Set(machineEntries.map(e => e.data)).size;
        const pct = sectorTotal > 0 ? (total / sectorTotal) * 100 : 0;
        return { name: machine.nome, total, media: days > 0 ? total / days : 0, dias: days, pct };
      }).sort((a, b) => b.total - a.total);
    })() : [];

    // 4. Maintenance data
    const activeMaintSectors = maintSectorFilter.size > 0
      ? sectors.filter(s => maintSectorFilter.has(s.id))
      : sectors;

    const maintenanceData = activeMaintSectors.map(sector => {
      const sectorEntries = historyData.filter(e => e.sectorId === sector.id);
      const manutencao = sectorEntries.filter(e => e.status === "manutencao").length;
      const manutencaoPontual = sectorEntries.filter(e => e.status === "manutencao_pontual").length;
      const faltaMadeira = sectorEntries.filter(e => e.status === "falta_madeira").length;
      const prodNaoNecessaria = sectorEntries.filter(e => e.status === "producao_nao_necessaria").length;
      const totalEntries = sectorEntries.length;
      return {
        name: sector.nome,
        sectorId: sector.id,
        manutencao,
        manutencaoPontual,
        faltaMadeira,
        prodNaoNecessaria,
        totalManutencao: manutencao + manutencaoPontual,
        totalParadas: manutencao + manutencaoPontual + faltaMadeira + prodNaoNecessaria,
        totalEntries,
        pctParada: totalEntries > 0 ? ((manutencao + manutencaoPontual + faltaMadeira + prodNaoNecessaria) / totalEntries * 100) : 0,
      };
    });

    const filteredMaintenanceData = maintenanceData.map(d => {
      const filtered: Record<string, any> = { name: d.name, sectorId: d.sectorId };
      let total = 0;
      if (maintTypeFilter.has("manutencao")) { filtered.manutencao = d.manutencao; total += d.manutencao; }
      if (maintTypeFilter.has("manutencaoPontual")) { filtered.manutencaoPontual = d.manutencaoPontual; total += d.manutencaoPontual; }
      if (maintTypeFilter.has("faltaMadeira")) { filtered.faltaMadeira = d.faltaMadeira; total += d.faltaMadeira; }
      if (maintTypeFilter.has("prodNaoNecessaria")) { filtered.prodNaoNecessaria = d.prodNaoNecessaria; total += d.prodNaoNecessaria; }
      filtered.total = total;
      filtered.pctParada = d.pctParada;
      filtered.totalEntries = d.totalEntries;
      return filtered;
    }).filter((d: any) => d.total > 0);

    // Maintenance daily timeline
    const maintDailyTimeline = sortedDates.map(date => {
      const dayEntries = byDate.get(date) || [];
      const row: Record<string, any> = { date, dateLabel: fmtDate(date) };
      let total = 0;
      if (maintTypeFilter.has("manutencao")) {
        const v = dayEntries.filter(e => e.status === "manutencao").length;
        row.manutencao = v; total += v;
      }
      if (maintTypeFilter.has("manutencaoPontual")) {
        const v = dayEntries.filter(e => e.status === "manutencao_pontual").length;
        row.manutencaoPontual = v; total += v;
      }
      if (maintTypeFilter.has("faltaMadeira")) {
        const v = dayEntries.filter(e => e.status === "falta_madeira").length;
        row.faltaMadeira = v; total += v;
      }
      if (maintTypeFilter.has("prodNaoNecessaria")) {
        const v = dayEntries.filter(e => e.status === "producao_nao_necessaria").length;
        row.prodNaoNecessaria = v; total += v;
      }
      row.total = total;
      return row;
    });

    // 5. Status distribution
    const statusCounts: Record<string, number> = {};
    for (const entry of historyData) {
      const st = entry.status || "producao_normal";
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    }
    const totalEntries = historyData.length;
    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      pct: totalEntries > 0 ? (count / totalEntries * 100) : 0,
      color: STATUS_COLORS[status] || "#94a3b8",
    })).sort((a, b) => b.value - a.value);

    // 6. Daily trend
    const dailyTrend = sortedDates.map(date => {
      const dayEntries = byDate.get(date) || [];
      const total = dayEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
      return { date, dateLabel: fmtDate(date), total };
    });
    const avgDaily = dailyTrend.length > 0 ? dailyTrend.reduce((s, d) => s + d.total, 0) / dailyTrend.length : 0;
    const maxDay = dailyTrend.length > 0 ? Math.max(...dailyTrend.map(d => d.total)) : 0;
    const minDay = dailyTrend.length > 0 ? Math.min(...dailyTrend.map(d => d.total)) : 0;

    // Global KPIs
    const totalMaintCount = maintenanceData.reduce((s, d) => s + d.totalManutencao, 0);
    const totalParadasCount = maintenanceData.reduce((s, d) => s + d.totalParadas, 0);

    return {
      dailyBySector, sectorTotals, machineData,
      maintenanceData: filteredMaintenanceData,
      rawMaintenanceData: maintenanceData,
      maintDailyTimeline, statusData, dailyTrend,
      sortedDates, grandTotal, totalDays, avgDaily, maxDay, minDay,
      totalEntries, totalMaintCount, totalParadasCount, activeProdSectors,
    };
  }, [historyData, sectors, selectedSector, prodSectorFilter, maintTypeFilter, maintSectorFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-teal-100 animate-spin border-t-teal-500" />
          <Activity className="w-6 h-6 text-teal-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <span className="text-slate-500 font-medium animate-pulse">Carregando gráficos...</span>
      </div>
    );
  }

  if (!processedData || !historyData?.length) {
    return (
      <div className="text-center py-16">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">Nenhum dado de produção encontrado</p>
        <p className="text-xs text-slate-400 mt-1">Selecione um período com lançamentos.</p>
      </div>
    );
  }

  const {
    dailyBySector, sectorTotals, machineData, maintenanceData, rawMaintenanceData,
    maintDailyTimeline, statusData, dailyTrend,
    grandTotal, totalDays, avgDaily, maxDay, minDay,
    totalEntries, totalMaintCount, totalParadasCount, activeProdSectors,
  } = processedData;

  // Build sector name map for tooltip resolution
  const sectorNameMap = useMemo(() => {
    const m = new Map<number, string>();
    sectors.forEach(s => m.set(s.id, s.nome));
    return m;
  }, [sectors]);

  // Set tooltip context for the custom tooltip
  setTooltipContext({ sectorMap: sectorNameMap, grandTotal, contextLabel: "do total" });

  // Selected day detail data
  const selectedDayData = useMemo(() => {
    if (!selectedDay || !historyData) return null;
    const dayEntries = historyData.filter(e => e.data === selectedDay);
    if (!dayEntries.length) return null;
    const dayTotal = dayEntries.reduce((s, e) => s + Number(e.quantidade), 0);
    const bySector = sectors.map((sector, idx) => {
      const sectorEntries = dayEntries.filter(e => e.sectorId === sector.id);
      const total = sectorEntries.reduce((s, e) => s + Number(e.quantidade), 0);
      const pct = dayTotal > 0 ? (total / dayTotal) * 100 : 0;
      const pctOfGrand = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
      return {
        name: sector.nome,
        unit: sector.unidade,
        total,
        pct,
        pctOfGrand,
        color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
        machines: sector.machines.map(m => {
          const mEntries = sectorEntries.filter(e => e.machineId === m.id);
          return {
            name: m.nome,
            total: mEntries.reduce((s, e) => s + Number(e.quantidade), 0),
            status: mEntries[0]?.status || 'producao_normal',
          };
        }).filter(m => m.total > 0),
      };
    }).filter(s => s.total > 0);
    const pctOfGrandTotal = grandTotal > 0 ? (dayTotal / grandTotal) * 100 : 0;
    return { date: selectedDay, dayTotal, pctOfGrandTotal, bySector };
  }, [selectedDay, historyData, sectors, grandTotal]);

  return (
    <div className="space-y-6">
      {/* ═══ Header + Period Selector ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Gráficos de Produção</h3>
              <p className="text-xs text-slate-500">
                {fmtFullDate(dateRange.start)} a {fmtFullDate(dateRange.end)} — {totalDays} dias — {totalEntries} registros
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(["week", "month", "custom"] as const).map(p => (
              <button
                key={p}
                onClick={() => setChartPeriod(p)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  chartPeriod === p
                    ? "bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/25 scale-105"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:shadow-sm"
                }`}
              >
                {p === "week" ? "Semana" : p === "month" ? "Mês" : "Personalizado"}
              </button>
            ))}
          </div>
        </div>

        {chartPeriod === "custom" && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all" />
            <span className="text-slate-400 text-sm font-medium">até</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all" />
          </div>
        )}

        {/* ═══ Global KPI Cards with animated numbers ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Produzido", value: grandTotal, decimals: 0, from: "from-teal-50", to: "to-emerald-50", border: "border-teal-200", textColor: "text-teal-600", numColor: "text-teal-800", icon: <Zap className="w-3.5 h-3.5" /> },
            { label: "Média Diária", value: avgDaily, decimals: 1, from: "from-blue-50", to: "to-sky-50", border: "border-blue-200", textColor: "text-blue-600", numColor: "text-blue-800", icon: <Activity className="w-3.5 h-3.5" /> },
            { label: "Melhor Dia", value: maxDay, decimals: 0, from: "from-emerald-50", to: "to-green-50", border: "border-emerald-200", textColor: "text-emerald-600", numColor: "text-emerald-800", icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
            { label: "Pior Dia", value: minDay, decimals: 0, from: "from-amber-50", to: "to-yellow-50", border: "border-amber-200", textColor: "text-amber-600", numColor: "text-amber-800", icon: <ArrowDownRight className="w-3.5 h-3.5" /> },
            { label: "Manutenções", value: totalMaintCount, decimals: 0, from: "from-violet-50", to: "to-purple-50", border: "border-violet-200", textColor: "text-violet-600", numColor: "text-violet-800", icon: <Wrench className="w-3.5 h-3.5" /> },
            { label: "Total Paradas", value: totalParadasCount, decimals: 0, from: "from-rose-50", to: "to-red-50", border: "border-rose-200", textColor: "text-rose-600", numColor: "text-rose-800", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
          ].map((kpi, i) => (
            <div key={i} className={`bg-gradient-to-br ${kpi.from} ${kpi.to} border ${kpi.border} rounded-xl p-3 transition-all duration-300 hover:shadow-md hover:scale-[1.02]`}>
              <div className={`flex items-center gap-1.5 ${kpi.textColor}`}>
                {kpi.icon}
                <p className="text-[10px] font-semibold uppercase tracking-wider">{kpi.label}</p>
              </div>
              <p className={`text-xl font-bold ${kpi.numColor} mt-1 tabular-nums`}>
                <AnimatedNumber value={kpi.value} decimals={kpi.decimals} />
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Expandir / Recolher Todos ═══ */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            const ALL_KEYS = ['producao', 'tendencia', 'distribuicao', 'manutencao', 'status'];
            setOpenSections(prev => {
              const allOpen = ALL_KEYS.every(k => prev.has(k));
              return allOpen ? new Set<string>() : new Set(ALL_KEYS);
            });
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:shadow-sm transition-all duration-300"
        >
          {['producao', 'tendencia', 'distribuicao', 'manutencao', 'status'].every(k => openSections.has(k)) ? (
            <><ChevronUp className="w-4 h-4" /> Recolher Todos</>
          ) : (
            <><ChevronDown className="w-4 h-4" /> Expandir Todos</>
          )}
        </button>
      </div>

      {/* ═══ 1. Produção Diária por Setor (Stacked Bar) ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
        <div
          className="px-5 py-4 border-b border-slate-100 cursor-pointer select-none hover:bg-slate-50/50 transition-colors duration-200"
          onClick={() => toggleSection('producao')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-slate-700">Produção Diária por Setor</h4>
                {!openSections.has('producao') && <p className="text-[10px] text-slate-400 mt-0.5">{fmtNum(grandTotal, 0)} unidades em {totalDays} dias — média {fmtNum(avgDaily, 0)}/dia</p>}
              </div>
              <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">
                {fmtNum(grandTotal, 0)} total
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openSections.has('producao') ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>
        {openSections.has('producao') && (
        <div className="px-5 pt-3 pb-1 border-b border-slate-100">
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-blue-700 leading-relaxed">
              <strong>O que este gráfico mostra:</strong> Cada barra representa a produção total de um dia, dividida por setor (cores). 
              A altura total da barra é a soma de todos os setores naquele dia. 
              Período: <strong>{fmtFullDate(dateRange.start)} a {fmtFullDate(dateRange.end)}</strong> ({totalDays} dias úteis). 
              Produção total: <strong>{fmtNum(grandTotal, 0)}</strong> unidades. Média diária: <strong>{fmtNum(avgDaily, 0)}</strong> unidades/dia.
            </p>
          </div>
          <div className="flex items-center justify-between mb-3">
            <div />
            <button
              onClick={(e) => { e.stopPropagation(); setShowProdFilter(!showProdFilter); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                showProdFilter ? "bg-teal-100 text-teal-700 shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Filter className="w-3 h-3" />
              Filtrar Setores
              {prodSectorFilter.size > 0 && (
                <span className="bg-teal-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">{prodSectorFilter.size}</span>
              )}
            </button>
          </div>
          {showProdFilter && (
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-in slide-in-from-top-2 duration-300">
              <span className="text-xs text-slate-500 font-medium mr-1 self-center">Setores:</span>
              {sectors.map((sector, idx) => (
                <FilterChip key={sector.id} label={sector.nome}
                  active={prodSectorFilter.size === 0 || prodSectorFilter.has(sector.id)}
                  color={SECTOR_COLORS[idx % SECTOR_COLORS.length]}
                  onClick={() => toggleProdSector(sector.id)} />
              ))}
              {prodSectorFilter.size > 0 && (
                <button onClick={() => setProdSectorFilter(new Set())} className="text-xs text-slate-500 hover:text-slate-700 underline ml-2">Limpar</button>
              )}
            </div>
          )}
        </div>
        )}
        {openSections.has('producao') && (
        <div className="p-5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart key={`bar1-${animKey}`} data={dailyBySector} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  {activeProdSectors.map((sector, idx) => {
                    const colorIdx = sectors.findIndex(s => s.id === sector.id);
                    const c = SECTOR_COLORS[colorIdx % SECTOR_COLORS.length];
                    return (
                      <linearGradient key={sector.id} id={`grad_sector_${sector.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={1} />
                        <stop offset="100%" stopColor={c} stopOpacity={0.7} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v: number) => fmtNum(v, 0)} axisLine={{ stroke: "#e2e8f0" }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(16,185,129,0.06)" }} />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
                  formatter={(value: string) => {
                    const sectorId = parseInt(value.replace("sector_", ""));
                    const sector = sectors.find(s => s.id === sectorId);
                    return <span className="text-slate-600 font-medium">{sector?.nome || value}</span>;
                  }}
                />
                {activeProdSectors.map((sector, idx) => (
                  <Bar
                    key={sector.id}
                    dataKey={`sector_${sector.id}`}
                    name={`sector_${sector.id}`}
                    stackId="a"
                    fill={`url(#grad_sector_${sector.id})`}
                    radius={idx === activeProdSectors.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    isAnimationActive={true}
                    animationDuration={ANIM.barDuration}
                    animationEasing={ANIM.barEasing}
                    animationBegin={idx * 80}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Daily totals row — CLICKABLE */}
          <div className="mt-3 overflow-x-auto">
            <p className="text-[10px] text-slate-400 mb-1.5 flex items-center gap-1"><Info className="w-3 h-3" /> Clique em um dia para ver o detalhamento completo</p>
            <div className="flex gap-2 min-w-max">
              {dailyBySector.map((d, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedDay(selectedDay === d.date ? null : d.date)}
                  className={`text-center px-3 py-2 rounded-lg text-xs transition-all duration-200 hover:scale-105 cursor-pointer ${
                    selectedDay === d.date
                      ? "bg-teal-100 border-teal-400 border-2 shadow-md ring-2 ring-teal-200"
                      : `${i % 2 === 0 ? "bg-slate-50" : "bg-white"} border border-slate-100 hover:border-teal-200 hover:shadow-sm`
                  }`}
                >
                  <p className={`font-bold tabular-nums ${selectedDay === d.date ? "text-teal-800" : "text-slate-700"}`}>{fmtNum(d.total, 0)}</p>
                  <p className={`text-[10px] ${selectedDay === d.date ? "text-teal-600 font-semibold" : "text-slate-400"}`}>{d.dateLabel}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ Selected Day Detail Panel ═══ */}
          {selectedDayData && (
            <div className="mt-4 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-4 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-teal-500 rounded-lg flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <h5 className="font-bold text-teal-800 text-sm">Detalhamento do dia {fmtFullDate(selectedDayData.date)}</h5>
                    <p className="text-[10px] text-teal-600">
                      Produção total do dia: <strong>{fmtNum(selectedDayData.dayTotal, 0)}</strong> unidades
                      ({fmtNum(selectedDayData.pctOfGrandTotal, 1)}% de toda a produção do período)
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedDay(null)}
                  className="text-xs text-teal-600 hover:text-teal-800 bg-white px-2.5 py-1 rounded-lg border border-teal-200 hover:shadow-sm transition-all">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-teal-200">
                      <th className="text-left py-2 px-2 text-teal-700 font-semibold">Setor</th>
                      <th className="text-right py-2 px-2 text-teal-700 font-semibold">Produção do Dia</th>
                      <th className="text-right py-2 px-2 text-teal-700 font-semibold">% do Dia</th>
                      <th className="text-right py-2 px-2 text-teal-700 font-semibold">% do Período</th>
                      <th className="text-left py-2 px-2 text-teal-700 font-semibold">Máquinas Ativas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDayData.bySector.map((s, idx) => (
                      <tr key={idx} className={`${idx % 2 === 0 ? "bg-white/50" : "bg-teal-50/30"} hover:bg-white transition-colors`}>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className="font-medium text-slate-700">{s.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-slate-800 tabular-nums">{fmtNum(s.total)}</td>
                        <td className="py-2 px-2 text-right">
                          <span className="bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums">
                            {fmtNum(s.pct, 0)}% do dia
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <span className="text-slate-500 tabular-nums text-[10px]">
                            {fmtNum(s.pctOfGrand, 1)}% do período
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-600">
                          {s.machines.map(m => `${m.name} (${fmtNum(m.total)})`).join(", ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-teal-300 bg-teal-50/50">
                      <td className="py-2 px-2 font-bold text-teal-800">TOTAL DO DIA</td>
                      <td className="py-2 px-2 text-right font-bold text-teal-700 tabular-nums">{fmtNum(selectedDayData.dayTotal, 0)}</td>
                      <td className="py-2 px-2 text-right font-bold text-teal-700">100%</td>
                      <td className="py-2 px-2 text-right font-bold text-teal-700 tabular-nums">{fmtNum(selectedDayData.pctOfGrandTotal, 1)}%</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* ═══ 2. Tendência de Produção (Area Chart) ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
        <div
          className="px-5 py-4 border-b border-slate-100 cursor-pointer select-none hover:bg-slate-50/50 transition-colors duration-200"
          onClick={() => toggleSection('tendencia')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-500 rounded-lg flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-slate-700">Tendência de Produção Total</h4>
                {!openSections.has('tendencia') && <p className="text-[10px] text-slate-400 mt-0.5">Pico: {fmtNum(maxDay, 0)} — Média: {fmtNum(avgDaily, 1)} — Mín: {fmtNum(minDay, 0)}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-4 text-xs mr-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" />
                  <span className="text-slate-500">Produção</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-0.5 border-b-2 border-dashed border-amber-400" />
                  <span className="text-slate-500">Média ({fmtNum(avgDaily)})</span>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openSections.has('tendencia') ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>
        {openSections.has('tendencia') && (
        <div className="p-5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-green-700 leading-relaxed">
              <strong>O que este gráfico mostra:</strong> A linha verde mostra a produção total (soma de todos os setores) de cada dia.
              A linha tracejada amarela é a <strong>média diária do período ({fmtNum(avgDaily, 1)} unidades/dia)</strong>.
              Dias acima da linha amarela tiveram produção acima da média; abaixo, ficaram abaixo.
              <strong>Pico Máximo</strong> = dia com maior produção ({fmtNum(maxDay, 0)} un).
              <strong>Mínimo</strong> = dia com menor produção ({fmtNum(minDay, 0)} un).
            </p>
          </div>
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart key={`trend-${animKey}`} data={dailyTrend} margin={{ top: 20, right: 15, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradientAreaMain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#10b981" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v: number) => fmtNum(v, 0)} axisLine={{ stroke: "#e2e8f0" }} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#10b981", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area
                  type="monotone" dataKey="total" name="Total"
                  fill="url(#gradientAreaMain)" stroke="transparent"
                  isAnimationActive={true} animationDuration={ANIM.areaDuration} animationEasing={ANIM.areaEasing}
                />
                <Line
                  type="monotone" dataKey="total" name="Total"
                  stroke="#10b981" strokeWidth={3}
                  dot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2.5 }}
                  activeDot={{ r: 8, fill: "#10b981", stroke: "#fff", strokeWidth: 3, className: "animate-pulse" }}
                  isAnimationActive={true} animationDuration={ANIM.lineDuration} animationEasing={ANIM.lineEasing}
                >
                  <LabelList dataKey="total" position="top" formatter={(v: number) => fmtNum(v, 0)}
                    style={{ fontSize: 10, fill: "#475569", fontWeight: 700 }} />
                </Line>
                <Line
                  type="monotone" dataKey={() => avgDaily} name="Média"
                  stroke="#f59e0b" strokeWidth={2} strokeDasharray="8 4"
                  dot={false} activeDot={false}
                  isAnimationActive={true} animationDuration={ANIM.lineDuration + 400}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "Pico Máximo", value: maxDay, color: "emerald", icon: <ArrowUpRight className="w-4 h-4" />, desc: "Maior produção em um único dia no período" },
              { label: "Média Diária", value: avgDaily, color: "blue", icon: <Minus className="w-4 h-4" />, desc: `Total (${fmtNum(grandTotal, 0)}) ÷ ${totalDays} dias úteis` },
              { label: "Mínimo", value: minDay, color: "amber", icon: <ArrowDownRight className="w-4 h-4" />, desc: "Menor produção em um único dia no período" },
            ].map((stat, i) => (
              <div key={i} className={`text-center p-3 bg-${stat.color}-50 rounded-xl border border-${stat.color}-100 transition-all duration-300 hover:shadow-md hover:scale-[1.02]`}>
                <div className={`flex items-center justify-center gap-1.5 text-${stat.color}-500 mb-1`}>{stat.icon}</div>
                <p className={`text-xl font-bold text-${stat.color}-700 tabular-nums`}>
                  <AnimatedNumber value={stat.value} decimals={stat.label === "Média Diária" ? 1 : 0} />
                </p>
                <p className={`text-[10px] text-${stat.color}-500 font-semibold uppercase tracking-wider`}>{stat.label}</p>
                <p className={`text-[9px] text-${stat.color}-400 mt-0.5`}>{(stat as any).desc}</p>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* ═══ 3. Distribuição por Setor (Pie + Table) — FIXED LABELS ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
        <div
          className="px-5 py-4 border-b border-slate-100 cursor-pointer select-none hover:bg-slate-50/50 transition-colors duration-200"
          onClick={() => toggleSection('distribuicao')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-lg flex items-center justify-center">
                <Factory className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-slate-700">Distribuição por Setor</h4>
                {!openSections.has('distribuicao') && <p className="text-[10px] text-slate-400 mt-0.5">{sectorTotals.length} setores — maior: {sectorTotals[0]?.name} ({fmtNum(sectorTotals[0]?.pct || 0, 0)}%)</p>}
              </div>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                {sectorTotals.length} setores ativos
              </span>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openSections.has('distribuicao') ? 'rotate-180' : ''}`} />
          </div>
        </div>
        {openSections.has('distribuicao') && (
        <div className="p-5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-indigo-700 leading-relaxed">
              <strong>O que este gráfico mostra:</strong> A participação de cada setor na <strong>produção total do período ({fmtNum(grandTotal, 0)} unidades)</strong>.
              Exemplo: se Vareteira mostra 20%, significa que a Vareteira produziu 20% de todas as {fmtNum(grandTotal, 0)} unidades do período.
              <strong>Média/Dia</strong> = total do setor ÷ {totalDays} dias úteis. <strong>Dias</strong> = quantos dias o setor teve produção.
              Clique em um setor na tabela para ver o detalhamento por máquina.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie chart — no external labels, use tooltip + legend below */}
            <div className="flex flex-col items-center">
              <div className="h-[340px] w-full" style={{ overflow: "visible" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart key={`pie1-${animKey}`}>
                    <defs>
                      {sectorTotals.map((entry, idx) => (
                        <linearGradient key={idx} id={`pieGrad_${idx}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                          <stop offset="100%" stopColor={entry.color} stopOpacity={0.75} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={sectorTotals}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={105}
                      paddingAngle={3}
                      dataKey="value"
                      label={renderCustomPieLabel}
                      labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                      isAnimationActive={true}
                      animationDuration={ANIM.pieDuration}
                      animationEasing={ANIM.pieEasing}
                      animationBegin={0}
                    >
                      {sectorTotals.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={`url(#pieGrad_${idx})`}
                          stroke="#fff"
                          strokeWidth={2}
                          className="transition-all duration-300 hover:opacity-80"
                          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [fmtNum(value), name]}
                      contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Color legend below pie */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                {sectorTotals.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span>{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Detailed sector table */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Totais por Setor</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-2.5 px-2 text-slate-500 font-semibold text-xs">Setor</th>
                      <th className="text-right py-2.5 px-2 text-slate-500 font-semibold text-xs">Total</th>
                      <th className="text-right py-2.5 px-2 text-slate-500 font-semibold text-xs">Média/Dia</th>
                      <th className="text-right py-2.5 px-2 text-slate-500 font-semibold text-xs" title="Percentual da produção total do período">% do Total</th>
                      <th className="text-right py-2.5 px-2 text-slate-500 font-semibold text-xs">Dias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectorTotals.map((sector, idx) => (
                      <tr
                        key={idx}
                        className={`cursor-pointer transition-all duration-200 ${
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                        } hover:bg-teal-50 hover:shadow-sm`}
                        onClick={() => {
                          const s = sectors.find(s => s.nome === sector.name);
                          if (s) setSelectedSector(selectedSector === s.id ? null : s.id);
                        }}
                      >
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: sector.color }} />
                            <span className="font-medium text-slate-700 text-xs">{sector.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-slate-800 tabular-nums">{fmtNum(sector.value)}</td>
                        <td className="py-2.5 px-2 text-right text-slate-600 tabular-nums">{fmtNum(sector.avg)}</td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs font-medium tabular-nums">
                            {fmtNum(sector.pct, 0)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-500 tabular-nums">{sector.daysWithData}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-gradient-to-r from-slate-50 to-teal-50/30">
                      <td className="py-2.5 px-2 font-bold text-slate-800 text-xs">TOTAL</td>
                      <td className="py-2.5 px-2 text-right font-bold text-teal-700 tabular-nums">{fmtNum(grandTotal)}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-teal-700 tabular-nums">{fmtNum(avgDaily)}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-teal-700">100%</td>
                      <td className="py-2.5 px-2 text-right font-bold text-teal-700 tabular-nums">{totalDays}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 italic flex items-center gap-1">
                <Search className="w-3 h-3" /> Clique em um setor para ver o detalhamento por máquina
              </p>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ═══ 4. Detalhamento por Máquina ═══ */}
      {selectedSector && machineData.length > 0 && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-md overflow-hidden animate-in slide-in-from-top-4 duration-500">
          <div className="px-5 py-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Wrench className="w-4 h-4 text-white" />
                </div>
                <h4 className="font-bold text-indigo-800">
                  Detalhamento — {sectors.find(s => s.id === selectedSector)?.nome}
                </h4>
                <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">
                  {machineData.length} máquinas
                </span>
              </div>
              <button onClick={() => setSelectedSector(null)}
                className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 hover:shadow-sm transition-all duration-200">
                <X className="w-3 h-3" /> Fechar
              </button>
            </div>
          </div>
          <div className="p-5">
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                <strong>Detalhamento por máquina do setor {sectors.find(s => s.id === selectedSector)?.nome}.</strong>{" "}
                <strong>Total</strong> = produção acumulada da máquina no período.
                <strong>Média Diária</strong> = total ÷ dias em que a máquina produziu.
                <strong>% do Setor</strong> = quanto essa máquina contribuiu para o total do setor (soma = 100%).
              </p>
            </div>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={machineData} margin={{ top: 30, right: 10, left: 10, bottom: 80 }}>
                  <defs>
                    <linearGradient id="gradMachTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="gradMachAvg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a5b4fc" stopOpacity={1} />
                      <stop offset="100%" stopColor="#a5b4fc" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b", fontWeight: 500 }} angle={-35} textAnchor="end" height={80} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v: number) => fmtNum(v, 0)} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.06)" }} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Bar dataKey="total" name="Total" fill="url(#gradMachTotal)" radius={[6, 6, 0, 0]}
                    isAnimationActive={true} animationDuration={ANIM.barDuration} animationEasing={ANIM.barEasing}>
                    <LabelList dataKey="total" position="top" formatter={(v: number) => fmtNum(v)}
                      style={{ fontSize: 10, fill: "#4338ca", fontWeight: 700 }} />
                  </Bar>
                  <Bar dataKey="media" name="Média Diária" fill="url(#gradMachAvg)" radius={[6, 6, 0, 0]}
                    isAnimationActive={true} animationDuration={ANIM.barDuration} animationEasing={ANIM.barEasing} animationBegin={200}>
                    <LabelList dataKey="media" position="top" formatter={(v: number) => fmtNum(v)}
                      style={{ fontSize: 10, fill: "#818cf8", fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Machine stats table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-indigo-200 bg-indigo-50/50">
                    <th className="text-left py-2.5 px-3 text-indigo-600 font-semibold text-xs">#</th>
                    <th className="text-left py-2.5 px-3 text-indigo-600 font-semibold text-xs">Máquina</th>
                    <th className="text-right py-2.5 px-3 text-indigo-600 font-semibold text-xs">Total</th>
                    <th className="text-right py-2.5 px-3 text-indigo-600 font-semibold text-xs">Média/Dia</th>
                    <th className="text-right py-2.5 px-3 text-indigo-600 font-semibold text-xs">% do Setor</th>
                    <th className="text-right py-2.5 px-3 text-indigo-600 font-semibold text-xs">Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {machineData.map((m, idx) => (
                    <tr key={idx} className={`transition-colors duration-200 ${idx % 2 === 0 ? "bg-white" : "bg-indigo-50/30"} hover:bg-indigo-50`}>
                      <td className="py-2.5 px-3 text-slate-400 text-xs font-medium">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">{m.name}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800 tabular-nums">{fmtNum(m.total)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{fmtNum(m.media)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${Math.min(m.pct, 100)}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 w-10 text-right tabular-nums">{fmtNum(m.pct, 0)}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">{m.dias}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 5. Manutenções e Paradas ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
        <div
          className="px-5 py-4 border-b border-slate-100 cursor-pointer select-none hover:bg-slate-50/50 transition-colors duration-200"
          onClick={() => toggleSection('manutencao')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-400 to-purple-500 rounded-lg flex items-center justify-center">
                <Wrench className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-slate-700">Manutenções e Paradas</h4>
                {!openSections.has('manutencao') && <p className="text-[10px] text-slate-400 mt-0.5">{rawMaintenanceData.reduce((s, d) => s + d.totalParadas, 0)} paradas no período</p>}
              </div>
              <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">
                {rawMaintenanceData.reduce((s, d) => s + d.totalParadas, 0)} paradas
              </span>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openSections.has('manutencao') ? 'rotate-180' : ''}`} />
          </div>
        </div>
        {openSections.has('manutencao') && (
        <div className="px-5 pt-3 pb-1 border-b border-slate-100">
          <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-violet-700 leading-relaxed">
              <strong>O que este gráfico mostra:</strong> Cada tipo de parada de máquina no período.
              <strong>Manutenção</strong> = máquina parada para conserto programado.
              <strong>Manutenção Pontual</strong> = quebra inesperada que exigiu reparo imediato.
              <strong>Falta de Madeira</strong> = máquina parada por falta de matéria-prima.
              <strong>Prod. Não Necessária</strong> = máquina parada porque não havia demanda de produção.
              <strong>% Parada</strong> = total de paradas do setor ÷ total de registros do setor (quanto maior, mais tempo parado).
            </p>
          </div>
          <div className="flex items-center justify-between mb-3">
            <div />
            <button onClick={(e) => { e.stopPropagation(); setShowMaintFilter(!showMaintFilter); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                showMaintFilter ? "bg-violet-100 text-violet-700 shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}>
              <Filter className="w-3 h-3" /> Filtros
            </button>
          </div>
          {showMaintFilter && (
            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-in slide-in-from-top-2 duration-300">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Tipo de Parada:</p>
                <div className="flex flex-wrap gap-2">
                  {MAINT_TYPES.map(t => (
                    <FilterChip key={t.key} label={t.label} active={maintTypeFilter.has(t.key)} color={t.color} onClick={() => toggleMaintType(t.key)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Setores:</p>
                <div className="flex flex-wrap gap-2">
                  {sectors.map((sector, idx) => (
                    <FilterChip key={sector.id} label={sector.nome}
                      active={maintSectorFilter.size === 0 || maintSectorFilter.has(sector.id)}
                      color={SECTOR_COLORS[idx % SECTOR_COLORS.length]}
                      onClick={() => toggleMaintSector(sector.id)} />
                  ))}
                  {maintSectorFilter.size > 0 && (
                    <button onClick={() => setMaintSectorFilter(new Set())} className="text-xs text-slate-500 hover:text-slate-700 underline ml-2">Todos</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        )}
        {openSections.has('manutencao') && (
        <div className="p-5 animate-in fade-in slide-in-from-top-2 duration-300">
          {maintenanceData.length === 0 ? (
            <div className="text-center py-8">
              <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nenhuma parada encontrada com os filtros selecionados.</p>
            </div>
          ) : (
            <>
              {/* Bar chart by sector */}
              <div className="h-[380px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={maintenanceData} margin={{ top: 30, right: 10, left: 10, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b", fontWeight: 500 }} angle={-35} textAnchor="end" height={80} interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(139,92,246,0.06)" }} />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    {maintTypeFilter.has("manutencao") && (
                      <Bar dataKey="manutencao" name="Manutenção" fill="#6366f1" radius={[4, 4, 0, 0]}
                        isAnimationActive={true} animationDuration={ANIM.barDuration} animationEasing={ANIM.barEasing}>
                        <LabelList dataKey="manutencao" position="top" style={{ fontSize: 9, fill: "#4338ca", fontWeight: 700 }} />
                      </Bar>
                    )}
                    {maintTypeFilter.has("manutencaoPontual") && (
                      <Bar dataKey="manutencaoPontual" name="Manut. Pontual" fill="#8b5cf6" radius={[4, 4, 0, 0]}
                        isAnimationActive={true} animationDuration={ANIM.barDuration} animationEasing={ANIM.barEasing} animationBegin={150}>
                        <LabelList dataKey="manutencaoPontual" position="top" style={{ fontSize: 9, fill: "#7c3aed", fontWeight: 700 }} />
                      </Bar>
                    )}
                    {maintTypeFilter.has("faltaMadeira") && (
                      <Bar dataKey="faltaMadeira" name="Falta de Madeira" fill="#ef4444" radius={[4, 4, 0, 0]}
                        isAnimationActive={true} animationDuration={ANIM.barDuration} animationEasing={ANIM.barEasing} animationBegin={300}>
                        <LabelList dataKey="faltaMadeira" position="top" style={{ fontSize: 9, fill: "#dc2626", fontWeight: 700 }} />
                      </Bar>
                    )}
                    {maintTypeFilter.has("prodNaoNecessaria") && (
                      <Bar dataKey="prodNaoNecessaria" name="Prod. Não Nec." fill="#f59e0b" radius={[4, 4, 0, 0]}
                        isAnimationActive={true} animationDuration={ANIM.barDuration} animationEasing={ANIM.barEasing} animationBegin={450}>
                        <LabelList dataKey="prodNaoNecessaria" position="top" style={{ fontSize: 9, fill: "#d97706", fontWeight: 700 }} />
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Timeline chart */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Evolução Diária de Paradas</p>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart key={`maint-area-${animKey}`} data={maintDailyTimeline} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradMaint" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="gradMaintP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="gradFalta" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="gradNaoNec" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: "#64748b" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      {maintTypeFilter.has("manutencao") && (
                        <Area type="monotone" dataKey="manutencao" name="Manutenção" stackId="1"
                          fill="url(#gradMaint)" stroke="#6366f1" strokeWidth={2}
                          isAnimationActive={true} animationDuration={ANIM.areaDuration} animationEasing={ANIM.areaEasing} />
                      )}
                      {maintTypeFilter.has("manutencaoPontual") && (
                        <Area type="monotone" dataKey="manutencaoPontual" name="Manut. Pontual" stackId="1"
                          fill="url(#gradMaintP)" stroke="#8b5cf6" strokeWidth={2}
                          isAnimationActive={true} animationDuration={ANIM.areaDuration} animationEasing={ANIM.areaEasing} animationBegin={200} />
                      )}
                      {maintTypeFilter.has("faltaMadeira") && (
                        <Area type="monotone" dataKey="faltaMadeira" name="Falta de Madeira" stackId="1"
                          fill="url(#gradFalta)" stroke="#ef4444" strokeWidth={2}
                          isAnimationActive={true} animationDuration={ANIM.areaDuration} animationEasing={ANIM.areaEasing} animationBegin={400} />
                      )}
                      {maintTypeFilter.has("prodNaoNecessaria") && (
                        <Area type="monotone" dataKey="prodNaoNecessaria" name="Prod. Não Nec." stackId="1"
                          fill="url(#gradNaoNec)" stroke="#f59e0b" strokeWidth={2}
                          isAnimationActive={true} animationDuration={ANIM.areaDuration} animationEasing={ANIM.areaEasing} animationBegin={600} />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {MAINT_TYPES.filter(t => maintTypeFilter.has(t.key)).map(t => {
                  const total = rawMaintenanceData.reduce((s, d) => s + (d as any)[t.key], 0);
                  return (
                    <div key={t.key} className="rounded-xl p-3 text-center border transition-all duration-300 hover:shadow-md hover:scale-[1.02]"
                      style={{ backgroundColor: `${t.color}08`, borderColor: `${t.color}25` }}>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: t.color }}>
                        <AnimatedNumber value={total} />
                      </p>
                      <p className="text-xs mt-0.5 font-medium" style={{ color: t.color }}>{t.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Detailed table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-violet-200 bg-violet-50/50">
                      <th className="text-left py-2.5 px-3 text-violet-600 font-semibold text-xs">Setor</th>
                      {maintTypeFilter.has("manutencao") && <th className="text-right py-2.5 px-3 text-indigo-600 font-semibold text-xs">Manut.</th>}
                      {maintTypeFilter.has("manutencaoPontual") && <th className="text-right py-2.5 px-3 text-violet-600 font-semibold text-xs">Pontual</th>}
                      {maintTypeFilter.has("faltaMadeira") && <th className="text-right py-2.5 px-3 text-red-600 font-semibold text-xs">Falta Mad.</th>}
                      {maintTypeFilter.has("prodNaoNecessaria") && <th className="text-right py-2.5 px-3 text-amber-600 font-semibold text-xs">Não Nec.</th>}
                      <th className="text-right py-2.5 px-3 text-slate-600 font-semibold text-xs">Total</th>
                      <th className="text-right py-2.5 px-3 text-slate-600 font-semibold text-xs">% Parada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenanceData.map((d: any, idx: number) => (
                      <tr key={idx} className={`transition-colors duration-200 ${idx % 2 === 0 ? "bg-white" : "bg-violet-50/30"} hover:bg-violet-50`}>
                        <td className="py-2.5 px-3 font-medium text-slate-700">{d.name}</td>
                        {maintTypeFilter.has("manutencao") && <td className="py-2.5 px-3 text-right font-bold text-indigo-700 tabular-nums">{d.manutencao || 0}</td>}
                        {maintTypeFilter.has("manutencaoPontual") && <td className="py-2.5 px-3 text-right font-bold text-violet-700 tabular-nums">{d.manutencaoPontual || 0}</td>}
                        {maintTypeFilter.has("faltaMadeira") && <td className="py-2.5 px-3 text-right font-bold text-red-700 tabular-nums">{d.faltaMadeira || 0}</td>}
                        {maintTypeFilter.has("prodNaoNecessaria") && <td className="py-2.5 px-3 text-right font-bold text-amber-700 tabular-nums">{d.prodNaoNecessaria || 0}</td>}
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800 tabular-nums">{d.total}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            d.pctParada > 30 ? "bg-red-100 text-red-700" :
                            d.pctParada > 15 ? "bg-amber-100 text-amber-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {fmtNum(d.pctParada, 0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        )}
      </div>

      {/* ═══ 6. Distribuição de Status ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
        <div
          className="px-5 py-4 border-b border-slate-100 cursor-pointer select-none hover:bg-slate-50/50 transition-colors duration-200"
          onClick={() => toggleSection('status')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-slate-700">Distribuição de Status</h4>
                {!openSections.has('status') && <p className="text-[10px] text-slate-400 mt-0.5">{totalEntries} registros de produção no período</p>}
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                {totalEntries} registros
              </span>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openSections.has('status') ? 'rotate-180' : ''}`} />
          </div>
        </div>
        {openSections.has('status') && (
        <div className="p-5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              <strong>O que este gráfico mostra:</strong> Cada registro de máquina/dia tem um status.
              <strong>Produzindo</strong> = máquina funcionou normalmente.
              <strong>Manutenção</strong> = parada para conserto.
              <strong>Falta de Madeira</strong> = sem matéria-prima.
              <strong>Prod. Não Necessária</strong> = sem demanda.
              Os percentuais mostram a proporção de cada status sobre o <strong>total de {totalEntries} registros</strong> do período.
              Quanto maior o % de "Produzindo", melhor a eficiência da fábrica.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[340px]" style={{ overflow: "visible" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart key={`pie2-${animKey}`}>
                  <defs>
                    {statusData.map((entry, idx) => (
                      <linearGradient key={idx} id={`statusGrad_${idx}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                        <stop offset="100%" stopColor={entry.color} stopOpacity={0.75} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, name, pct }: any) => {
                      const radius = outerRadius + 22;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text x={x} y={y} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central"
                          fill="#475569" fontSize={10} fontWeight={600}>
                          {abbreviate(name, 18)} ({fmtNum(pct, 0)}%)
                        </text>
                      );
                    }}
                    labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                    isAnimationActive={true}
                    animationDuration={ANIM.pieDuration}
                    animationEasing={ANIM.pieEasing}
                    animationBegin={0}
                  >
                    {statusData.map((entry, idx) => (
                      <Cell key={idx} fill={`url(#statusGrad_${idx})`} stroke="#fff" strokeWidth={2}
                        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} registros`, name]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Detalhamento</p>
              <div className="space-y-2.5">
                {statusData.map((status, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 transition-all duration-200 hover:shadow-sm hover:border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: status.color }} />
                      <span className="text-sm text-slate-700 font-medium">{status.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-800 tabular-nums">{status.value}</span>
                      <span className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold w-14 text-center tabular-nums">
                        {fmtNum(status.pct, 0)}%
                      </span>
                      <div className="w-24 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(status.pct, 100)}%`, backgroundColor: status.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
