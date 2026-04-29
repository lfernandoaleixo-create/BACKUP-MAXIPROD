/**
 * ProductionCharts — Gráficos de produção por máquina e por setor geral
 * Com filtro de manutenções realizadas
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  BarChart3, Filter, Wrench, Calendar, ChevronDown, ChevronUp,
  Loader2, Factory, TrendingUp, AlertTriangle,
} from "lucide-react";

// ─── Colors ───
const SECTOR_COLORS = [
  "#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444",
  "#ec4899", "#14b8a6", "#6366f1", "#f97316",
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
  producao_nao_necessaria: "Produção Não Necessária",
  manutencao: "Manutenção",
  manutencao_pontual: "Manutenção Pontual",
};

function fmtNum(n: number, decimals = 1): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}`;
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

export default function ProductionCharts({ selectedDate, sectors }: ProductionChartsProps) {
  const [chartPeriod, setChartPeriod] = useState<"week" | "month">("week");
  const [showMaintenanceFilter, setShowMaintenanceFilter] = useState(false);
  const [selectedSector, setSelectedSector] = useState<number | null>(null);
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  // Calculate date ranges
  const dateRange = useMemo(() => {
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
  }, [selectedDate, chartPeriod]);

  const { data: historyData, isLoading } = trpc.production.getHistory.useQuery({
    dataInicio: dateRange.start,
    dataFim: dateRange.end,
  });

  // ─── Process data ───
  const processedData = useMemo(() => {
    if (!historyData || !sectors.length) return null;

    // Group entries by date
    const byDate = new Map<string, typeof historyData>();
    for (const entry of historyData) {
      const arr = byDate.get(entry.data) || [];
      arr.push(entry);
      byDate.set(entry.data, arr);
    }

    // Sort dates
    const sortedDates = Array.from(byDate.keys()).sort();

    // ─── 1. Daily production by sector (stacked bar chart) ───
    const dailyBySector = sortedDates.map(date => {
      const dayEntries = byDate.get(date) || [];
      const row: Record<string, any> = { date, dateLabel: fmtDate(date) };
      for (const sector of sectors) {
        const sectorEntries = dayEntries.filter(e => e.sectorId === sector.id);
        row[`sector_${sector.id}`] = sectorEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
      }
      row.total = sectors.reduce((sum, s) => sum + (row[`sector_${s.id}`] || 0), 0);
      return row;
    });

    // ─── 2. Sector totals (for pie chart) ───
    const sectorTotals = sectors.map((sector, idx) => {
      const total = (historyData || [])
        .filter(e => e.sectorId === sector.id)
        .reduce((sum, e) => sum + Number(e.quantidade), 0);
      return {
        name: sector.nome,
        value: total,
        unit: sector.unidade,
        color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
      };
    }).filter(s => s.value > 0);

    // ─── 3. Machine breakdown for selected sector ───
    const machineData = selectedSector ? (() => {
      const sector = sectors.find(s => s.id === selectedSector);
      if (!sector || !sector.machines.length) return [];
      return sector.machines.map(machine => {
        const machineEntries = (historyData || []).filter(
          e => e.sectorId === selectedSector && e.machineId === machine.id
        );
        const total = machineEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
        const days = new Set(machineEntries.map(e => e.data)).size;
        return {
          name: machine.nome,
          total,
          media: days > 0 ? total / days : 0,
          dias: days,
        };
      });
    })() : [];

    // ─── 4. Maintenance count by sector ───
    const maintenanceData = sectors.map(sector => {
      const sectorEntries = (historyData || []).filter(e => e.sectorId === sector.id);
      const manutencao = sectorEntries.filter(e => e.status === "manutencao").length;
      const manutencaoPontual = sectorEntries.filter(e => e.status === "manutencao_pontual").length;
      const faltaMadeira = sectorEntries.filter(e => e.status === "falta_madeira").length;
      const prodNaoNecessaria = sectorEntries.filter(e => e.status === "producao_nao_necessaria").length;
      const total = manutencao + manutencaoPontual;
      return {
        name: sector.nome,
        manutencao,
        manutencaoPontual,
        faltaMadeira,
        prodNaoNecessaria,
        totalManutencao: total,
      };
    }).filter(s => s.totalManutencao > 0 || s.faltaMadeira > 0 || s.prodNaoNecessaria > 0);

    // ─── 5. Status distribution (pie) ───
    const statusCounts: Record<string, number> = {};
    for (const entry of historyData) {
      const st = entry.status || "producao_normal";
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    }
    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || "#94a3b8",
    }));

    // ─── 6. Daily production trend line ───
    const dailyTrend = sortedDates.map(date => {
      const dayEntries = byDate.get(date) || [];
      return {
        date,
        dateLabel: fmtDate(date),
        total: dayEntries.reduce((sum, e) => sum + Number(e.quantidade), 0),
      };
    });

    return {
      dailyBySector,
      sectorTotals,
      machineData,
      maintenanceData,
      statusData,
      dailyTrend,
      sortedDates,
    };
  }, [historyData, sectors, selectedSector]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        <span className="ml-3 text-slate-500">Carregando dados para gráficos...</span>
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

  const { dailyBySector, sectorTotals, machineData, maintenanceData, statusData, dailyTrend } = processedData;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
        <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-600">{p.name}:</span>
            <span className="font-semibold text-slate-800">{fmtNum(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header / Period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Gráficos de Produção</h3>
            <p className="text-xs text-slate-500">
              {fmtDate(dateRange.start)} a {fmtDate(dateRange.end)} — {dailyTrend.length} dias com dados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartPeriod("week")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              chartPeriod === "week"
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setChartPeriod("month")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              chartPeriod === "month"
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Mês
          </button>
        </div>
      </div>

      {/* ─── 1. Produção Diária por Setor (Stacked Bar) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className="px-5 py-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setExpandedChart(expandedChart === "daily" ? null : "daily")}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            <h4 className="font-semibold text-slate-700">Produção Diária por Setor</h4>
          </div>
          {expandedChart === "daily" ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
        {expandedChart === "daily" && (
          <div className="p-5">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyBySector} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px" }}
                    formatter={(value: string) => {
                      const sectorId = parseInt(value.replace("sector_", ""));
                      const sector = sectors.find(s => s.id === sectorId);
                      return sector?.nome || value;
                    }}
                  />
                  {sectors.map((sector, idx) => (
                    <Bar
                      key={sector.id}
                      dataKey={`sector_${sector.id}`}
                      name={`sector_${sector.id}`}
                      stackId="a"
                      fill={SECTOR_COLORS[idx % SECTOR_COLORS.length]}
                      radius={idx === sectors.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ─── 2. Tendência de Produção (Line Chart) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className="px-5 py-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setExpandedChart(expandedChart === "trend" ? null : "trend")}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h4 className="font-semibold text-slate-700">Tendência de Produção Total</h4>
          </div>
          {expandedChart === "trend" ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
        {expandedChart === "trend" && (
          <div className="p-5">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ─── 3. Distribuição por Setor (Pie + Totals) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className="px-5 py-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setExpandedChart(expandedChart === "sectors" ? null : "sectors")}
        >
          <div className="flex items-center gap-2">
            <Factory className="w-4 h-4 text-indigo-600" />
            <h4 className="font-semibold text-slate-700">Distribuição por Setor</h4>
          </div>
          {expandedChart === "sectors" ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
        {expandedChart === "sectors" && (
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie chart */}
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorTotals}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                    >
                      {sectorTotals.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [fmtNum(value), name]}
                      contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Sector totals table */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Totais por Setor</p>
                {sectorTotals.map((sector, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => {
                      const s = sectors.find(s => s.nome === sector.name);
                      if (s) setSelectedSector(selectedSector === s.id ? null : s.id);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sector.color }} />
                      <span className="text-sm text-slate-700 font-medium">{sector.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-800">{fmtNum(sector.value)}</span>
                      <span className="text-xs text-slate-400 ml-1">{sector.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── 4. Detalhamento por Máquina (aparece quando seleciona um setor) ─── */}
      {selectedSector && machineData.length > 0 && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50/50">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-indigo-600" />
              <h4 className="font-semibold text-indigo-800">
                Detalhamento por Máquina — {sectors.find(s => s.id === selectedSector)?.nome}
              </h4>
              <button
                onClick={() => setSelectedSector(null)}
                className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 underline"
              >
                Fechar
              </button>
            </div>
          </div>
          <div className="p-5">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={machineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" name="Total" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="media" name="Média Diária" fill="#a5b4fc" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Machine stats table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">Máquina</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-medium text-xs">Total</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-medium text-xs">Média/Dia</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-medium text-xs">Dias c/ Dados</th>
                  </tr>
                </thead>
                <tbody>
                  {machineData.map((m, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="py-2 px-3 font-medium text-slate-700">{m.name}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-800">{fmtNum(m.total)}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{fmtNum(m.media)}</td>
                      <td className="py-2 px-3 text-right text-slate-500">{m.dias}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. Manutenções e Paradas (Bar Chart) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className="px-5 py-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setShowMaintenanceFilter(!showMaintenanceFilter)}
        >
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-violet-600" />
            <h4 className="font-semibold text-slate-700">Manutenções e Paradas por Setor</h4>
            {maintenanceData.length > 0 && (
              <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                {maintenanceData.reduce((s, d) => s + d.totalManutencao, 0)} manutenções
              </span>
            )}
          </div>
          {showMaintenanceFilter ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
        {showMaintenanceFilter && (
          <div className="p-5">
            {maintenanceData.length === 0 ? (
              <div className="text-center py-8">
                <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Nenhuma manutenção ou parada registrada no período.</p>
              </div>
            ) : (
              <>
                <div className="h-[300px] mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={maintenanceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="manutencao" name="Manutenção" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="manutencaoPontual" name="Manutenção Pontual" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="faltaMadeira" name="Falta de Madeira" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="prodNaoNecessaria" name="Prod. Não Necessária" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-indigo-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-indigo-700">
                      {maintenanceData.reduce((s, d) => s + d.manutencao, 0)}
                    </p>
                    <p className="text-xs text-indigo-500 mt-0.5">Manutenção</p>
                  </div>
                  <div className="bg-violet-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-violet-700">
                      {maintenanceData.reduce((s, d) => s + d.manutencaoPontual, 0)}
                    </p>
                    <p className="text-xs text-violet-500 mt-0.5">Manutenção Pontual</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">
                      {maintenanceData.reduce((s, d) => s + d.faltaMadeira, 0)}
                    </p>
                    <p className="text-xs text-red-500 mt-0.5">Falta de Madeira</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">
                      {maintenanceData.reduce((s, d) => s + d.prodNaoNecessaria, 0)}
                    </p>
                    <p className="text-xs text-amber-500 mt-0.5">Prod. Não Necessária</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── 6. Distribuição de Status (Pie) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className="px-5 py-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setExpandedChart(expandedChart === "status" ? null : "status")}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h4 className="font-semibold text-slate-700">Distribuição de Status</h4>
          </div>
          {expandedChart === "status" ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
        {expandedChart === "status" && (
          <div className="p-5">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                  >
                    {statusData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} registros`, name]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
