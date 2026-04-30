/**
 * Painel de Métricas e Analytics de Cobrança
 * Exibe gráficos profissionais, tabelas e KPIs sobre o processo de cobrança
 */
import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from "recharts";
import {
  X, TrendingUp, TrendingDown, Users, DollarSign, Phone, MessageCircle,
  Mail, CheckCircle2, AlertTriangle, BarChart3, Activity, Target, Clock,
  FileText, Shield, ChevronDown, ChevronUp, Calendar, Filter, ArrowRight,
  Zap, Award, PieChart as PieChartIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---- Helpers ----
function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function formatNumber(v: number) {
  return new Intl.NumberFormat("pt-BR").format(v);
}
function pct(part: number, total: number) {
  if (!total) return "0%";
  return ((part / total) * 100).toFixed(1) + "%";
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  contatado: "Contatado",
  em_negociacao: "Em Negociação",
  promessa: "Promessa de Pgto",
  nao_retornou: "Não deu retorno",
  nao_atendeu: "Não atendeu",
  protestado: "Protestado",
  juridico: "Jurídico",
  especial_sem_cobranca: "Especial S/ Cobrança",
  cheque_compensacao: "Cheque em Compensação",
};
const STATUS_COLORS: Record<string, string> = {
  pendente: "#94a3b8",
  contatado: "#3b82f6",
  em_negociacao: "#f59e0b",
  promessa: "#10b981",
  nao_retornou: "#a855f7",
  nao_atendeu: "#ec4899",
  protestado: "#f97316",
  juridico: "#ef4444",
  especial_sem_cobranca: "#06b6d4",
  cheque_compensacao: "#84cc16",
};

const ACTION_COLORS: Record<string, string> = {
  whatsapp: "#25D366",
  email: "#4285F4",
  ligacao: "#FF6B35",
  outro: "#8B5CF6",
};
const ACTION_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  ligacao: "Ligação",
  outro: "Outro",
};

const STEP_COLORS = {
  green: "#10b981",
  blue: "#3b82f6",
  red: "#ef4444",
};

// Tradução das ações do histórico de ticks
const TICK_ACTION_LABELS: Record<string, string> = {
  tick: "Marcação (concluído)",
  manual_blue: "Contato Realizado (manual)",
  untick: "Desmarcação",
  phone_mute: "Telefone Silenciado",
  phone_unmute: "Telefone Reativado",
  auto_red: "Falha Automática (sistema)",
  sync_green: "Sincronização (concluído)",
  manual_red: "Falha Manual",
  sync_red: "Sincronização (falha)",
};

// Custom tooltip for charts
function CustomTooltip({ active, payload, label, valuePrefix, valueSuffix }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-xl px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-bold text-slate-800">
            {valuePrefix}{typeof entry.value === "number" ? formatNumber(entry.value) : entry.value}{valueSuffix}
          </span>
        </div>
      ))}
    </div>
  );
}

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-xl px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-bold text-slate-800">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ---- KPI Card ----
function KpiCard({ icon: Icon, label, value, subValue, color, trend }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  trend?: "up" | "down" | "neutral";
}) {
  const colorMap: Record<string, { bg: string; icon: string; text: string; border: string }> = {
    blue: { bg: "bg-blue-50", icon: "text-blue-600", text: "text-blue-900", border: "border-blue-200" },
    green: { bg: "bg-emerald-50", icon: "text-emerald-600", text: "text-emerald-900", border: "border-emerald-200" },
    red: { bg: "bg-red-50", icon: "text-red-600", text: "text-red-900", border: "border-red-200" },
    amber: { bg: "bg-amber-50", icon: "text-amber-600", text: "text-amber-900", border: "border-amber-200" },
    purple: { bg: "bg-purple-50", icon: "text-purple-600", text: "text-purple-900", border: "border-purple-200" },
    cyan: { bg: "bg-cyan-50", icon: "text-cyan-600", text: "text-cyan-900", border: "border-cyan-200" },
    orange: { bg: "bg-orange-50", icon: "text-orange-600", text: "text-orange-900", border: "border-orange-200" },
    slate: { bg: "bg-slate-50", icon: "text-slate-600", text: "text-slate-900", border: "border-slate-200" },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4 transition-all hover:shadow-md`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-2xl font-bold ${c.text} tabular-nums`}>{value}</span>
        {trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-500 mb-1" />}
        {trend === "down" && <TrendingDown className="w-4 h-4 text-red-500 mb-1" />}
      </div>
      {subValue && <p className="text-[11px] text-slate-500 mt-1">{subValue}</p>}
    </div>
  );
}

// ---- Section Header ----
function SectionHeader({ icon: Icon, title, subtitle, color }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

// ---- Main Component ----
export default function CollectionMetricsPanel({ onClose }: { onClose: () => void }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [recoveryGroupBy, setRecoveryGroupBy] = useState<"day" | "week" | "month">("day");
  const [summaryGroupBy, setSummaryGroupBy] = useState<"day" | "week" | "month" | "year">("month");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    kpis: true,
    status: true,
    actions: true,
    steps: true,
    recovery: true,
    recoveryTable: true,
    operator: true,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const dateFilter = useMemo(() => {
    const f: { startDate?: string; endDate?: string } = {};
    if (startDate) f.startDate = startDate;
    if (endDate) f.endDate = endDate;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [startDate, endDate]);

  // ---- Queries ----
  const { data: overview, isLoading: loadingOverview } = trpc.collectionMetrics.getOverviewMetrics.useQuery(dateFilter);
  const { data: recoveryTimeline, isLoading: loadingTimeline } = trpc.collectionMetrics.getRecoveryTimeline.useQuery({
    ...dateFilter,
    groupBy: recoveryGroupBy,
  });
  const { data: actionTimeline } = trpc.collectionMetrics.getActionTimeline.useQuery(dateFilter);
  const { data: stepBreakdown } = trpc.collectionMetrics.getStepBreakdown.useQuery();
  const { data: recoveryDetails } = trpc.collectionMetrics.getRecoveryDetails.useQuery(dateFilter);
  const { data: statusDist } = trpc.collectionMetrics.getStatusDistribution.useQuery();
  const { data: operatorMetrics } = trpc.collectionMetrics.getOperatorMetrics.useQuery(dateFilter);
  const { data: recoverySummary } = trpc.collectionMetrics.getRecoverySummaryByPeriod.useQuery({ groupBy: summaryGroupBy });

  // ---- Derived Data ----
  const statusChartData = useMemo(() => {
    if (!overview?.statusBreakdown) return [];
    return overview.statusBreakdown
      .filter(s => s.count > 0)
      .map(s => ({
        name: STATUS_LABELS[s.status] || s.status,
        value: s.count,
        fill: STATUS_COLORS[s.status] || "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [overview]);

  const actionPieData = useMemo(() => {
    if (!overview?.dailyActionsByType) return [];
    return overview.dailyActionsByType
      .filter(a => a.count > 0)
      .map(a => ({
        name: ACTION_LABELS[a.type] || a.type,
        value: a.count,
        fill: ACTION_COLORS[a.type] || "#8B5CF6",
      }));
  }, [overview]);

  const stepChartData = useMemo(() => {
    if (!stepBreakdown?.steps) return [];
    return stepBreakdown.steps.map(s => ({
      name: s.label.replace(" (Dia ", "\n(Dia ").replace(")", ")"),
      shortName: s.label.split(" (")[0],
      concluido: s.green,
      contato: s.blue,
      falha: s.red,
      total: s.total,
    }));
  }, [stepBreakdown]);

  const statusDistData = useMemo(() => {
    if (!statusDist) return { active: [], resolved: [] };
    return {
      active: statusDist.active.map(s => ({
        name: STATUS_LABELS[s.status] || s.status,
        value: s.count,
        fill: STATUS_COLORS[s.status] || "#94a3b8",
      })),
      resolved: statusDist.resolved.map(s => ({
        name: STATUS_LABELS[s.status] || s.status || "Sem status",
        value: s.count,
        fill: STATUS_COLORS[s.status] || "#94a3b8",
      })),
    };
  }, [statusDist]);

  // Total titles in collection
  const totalInCollection = overview?.totalTitulosComCobranca || 0;
  const totalResolved = overview?.resolvedAllTime?.count || 0;
  const totalRecuperado = overview?.resolvedAllTime?.totalValor || 0;
  const totalActions = overview?.totalDailyActions || 0;
  const totalFalhas = overview?.totalFalhas || 0;
  const totalDecisoes = overview?.totalDecisoes || 0;
  const totalDecisionPdfs = overview?.totalDecisionPdfs || 0;
  const totalContatos = overview?.totalContatos || 0;
  const totalEdits = overview?.totalEdits || 0;
  const taxaRecuperacao = totalInCollection > 0 ? ((totalResolved / (totalInCollection + totalResolved)) * 100).toFixed(1) : "0";

  if (loadingOverview) {
    return (
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-slate-600 font-medium">Carregando métricas de cobrança...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen py-4 px-4">
        <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-700 via-blue-700 to-cyan-600 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Métricas de Cobrança</h2>
                <p className="text-blue-100 text-sm">Métricas completas do processo de cobrança de inadimplentes</p>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Date Filter */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-600">Filtrar período:</span>
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-40 h-8 text-xs"
              placeholder="Data início"
            />
            <span className="text-xs text-slate-400">até</span>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-40 h-8 text-xs"
              placeholder="Data fim"
            />
            {(startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); }} className="text-xs h-8">
                Limpar filtro
              </Button>
            )}
          </div>

          <div className="p-6 space-y-6">
            {/* ===== KPIs ===== */}
            <div>
              <button onClick={() => toggleSection("kpis")} className="flex items-center gap-2 w-full text-left mb-3">
                <SectionHeader icon={Target} title="Indicadores Chave (KPIs)" subtitle="Visão geral do desempenho da cobrança" color="from-indigo-500 to-blue-600" />
                {expandedSections.kpis ? <ChevronUp className="w-5 h-5 text-slate-400 ml-auto" /> : <ChevronDown className="w-5 h-5 text-slate-400 ml-auto" />}
              </button>
              {expandedSections.kpis && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  <KpiCard icon={FileText} label="Títulos em Cobrança" value={formatNumber(totalInCollection)} subValue="Títulos ativos no processo" color="blue" />
                  <KpiCard icon={CheckCircle2} label="Recuperados" value={formatNumber(totalResolved)} subValue={`${taxaRecuperacao}% de taxa de recuperação`} color="green" trend="up" />
                  <KpiCard icon={DollarSign} label="Valor Recuperado" value={formatCurrency(totalRecuperado)} subValue="Total de valores pagos" color="green" />
                  <KpiCard icon={Activity} label="Ações Realizadas" value={formatNumber(totalActions)} subValue="WhatsApp, e-mail, ligações" color="purple" />
                  <KpiCard icon={Shield} label="Decisões (Dia 7)" value={formatNumber(totalDecisoes)} subValue={`${totalDecisionPdfs} PDFs gerados`} color="amber" />
                  <KpiCard icon={Phone} label="Contatos Registrados" value={formatNumber(totalContatos)} subValue="Registros de contato com clientes" color="cyan" />
                  <KpiCard icon={AlertTriangle} label="Falhas do Operador" value={formatNumber(totalFalhas)} subValue={totalFalhas === 0 ? "Nenhuma falha manual do Thiago!" : "Tentativas sem sucesso pelo operador"} color={totalFalhas === 0 ? "green" : "red"} />
                  <KpiCard icon={Zap} label="Taxa de Recuperação" value={`${taxaRecuperacao}%`} subValue={`${totalResolved} de ${totalInCollection + totalResolved} títulos`} color="orange" />
                  <KpiCard icon={Award} label="Edições de Ação" value={formatNumber(totalEdits)} subValue="Ajustes no roteiro de cobrança" color="slate" />
                  <KpiCard icon={Target} label="Eficiência" value={totalActions > 0 ? (totalResolved / totalActions * 100).toFixed(1) + "%" : "N/A"} subValue="Recuperações por ação realizada" color="blue" />
                </div>
              )}
            </div>

            {/* ===== Status Distribution ===== */}
            <div>
              <button onClick={() => toggleSection("status")} className="flex items-center gap-2 w-full text-left mb-3">
                <SectionHeader icon={PieChartIcon} title="Distribuição por Status" subtitle="Como os títulos estão distribuídos no processo de cobrança" color="from-purple-500 to-pink-600" />
                {expandedSections.status ? <ChevronUp className="w-5 h-5 text-slate-400 ml-auto" /> : <ChevronDown className="w-5 h-5 text-slate-400 ml-auto" />}
              </button>
              {expandedSections.status && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pie Chart */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Títulos Ativos por Status</h4>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            labelLine={false}
                          >
                            {statusChartData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Status Table */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Detalhamento por Status</h4>
                    <div className="space-y-2">
                      {statusChartData.map((s, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.fill }} />
                          <span className="text-sm text-slate-700 flex-1">{s.name}</span>
                          <span className="text-sm font-bold text-slate-800 tabular-nums">{s.value}</span>
                          <span className="text-xs text-slate-500 w-12 text-right tabular-nums">
                            {pct(s.value, statusChartData.reduce((a, b) => a + b.value, 0))}
                          </span>
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${(s.value / Math.max(...statusChartData.map(x => x.value))) * 100}%`,
                                backgroundColor: s.fill,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Resolved status comparison */}
                    {statusDistData.resolved.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <h5 className="text-xs font-semibold text-emerald-700 mb-2">Status dos Títulos Recuperados</h5>
                        {statusDistData.resolved.map((s, i) => (
                          <div key={i} className="flex items-center gap-3 py-1">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.fill }} />
                            <span className="text-xs text-slate-600 flex-1">{s.name}</span>
                            <span className="text-xs font-bold text-slate-700 tabular-nums">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ===== Ações de Cobrança ===== */}
            <div>
              <button onClick={() => toggleSection("actions")} className="flex items-center gap-2 w-full text-left mb-3">
                <SectionHeader icon={MessageCircle} title="Ações de Cobrança" subtitle="WhatsApp, e-mails, ligações e outros contatos realizados" color="from-green-500 to-emerald-600" />
                {expandedSections.actions ? <ChevronUp className="w-5 h-5 text-slate-400 ml-auto" /> : <ChevronDown className="w-5 h-5 text-slate-400 ml-auto" />}
              </button>
              {expandedSections.actions && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Action Pie */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Distribuição por Tipo de Ação</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={actionPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {actionPieData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Action summary cards */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {actionPieData.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: a.fill }} />
                          <span className="text-xs text-slate-600">{a.name}</span>
                          <span className="text-xs font-bold text-slate-800 ml-auto tabular-nums">{a.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Timeline */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Ações ao Longo do Tempo</h4>
                    {actionTimeline && actionTimeline.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={actionTimeline} barSize={16}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 10 }}
                              tickFormatter={(v) => {
                                const d = new Date(v + "T12:00:00");
                                return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                              }}
                            />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="whatsapp" name="WhatsApp" fill="#25D366" stackId="a" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="email" name="E-mail" fill="#4285F4" stackId="a" />
                            <Bar dataKey="ligacao" name="Ligação" fill="#FF6B35" stackId="a" />
                            <Bar dataKey="outro" name="Outro" fill="#8B5CF6" stackId="a" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
                        Nenhuma ação registrada no período
                      </div>
                    )}
                  </div>

                  {/* Operator metrics */}
                  {operatorMetrics && operatorMetrics.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-2">
                      <button onClick={() => toggleSection("operator")} className="flex items-center gap-2 w-full text-left mb-3">
                        <h4 className="text-sm font-semibold text-slate-700">Desempenho por Operador</h4>
                        {expandedSections.operator ? <ChevronUp className="w-4 h-4 text-slate-400 ml-auto" /> : <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />}
                      </button>
                      {expandedSections.operator && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Operador</th>
                                <th className="text-center py-2 px-3 text-xs font-semibold text-green-600">
                                  <div className="flex items-center justify-center gap-1"><MessageCircle className="w-3 h-3" /> WhatsApp</div>
                                </th>
                                <th className="text-center py-2 px-3 text-xs font-semibold text-blue-600">
                                  <div className="flex items-center justify-center gap-1"><Mail className="w-3 h-3" /> E-mail</div>
                                </th>
                                <th className="text-center py-2 px-3 text-xs font-semibold text-orange-600">
                                  <div className="flex items-center justify-center gap-1"><Phone className="w-3 h-3" /> Ligação</div>
                                </th>
                                <th className="text-center py-2 px-3 text-xs font-semibold text-purple-600">Outro</th>
                                <th className="text-center py-2 px-3 text-xs font-semibold text-slate-700">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {operatorMetrics.map((op, i) => (
                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="py-2 px-3 font-semibold text-slate-800">{op.operatorName}</td>
                                  <td className="py-2 px-3 text-center tabular-nums text-green-700 font-medium">{op.whatsapp}</td>
                                  <td className="py-2 px-3 text-center tabular-nums text-blue-700 font-medium">{op.email}</td>
                                  <td className="py-2 px-3 text-center tabular-nums text-orange-700 font-medium">{op.ligacao}</td>
                                  <td className="py-2 px-3 text-center tabular-nums text-purple-700 font-medium">{op.outro}</td>
                                  <td className="py-2 px-3 text-center tabular-nums font-bold text-slate-900">{op.total}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ===== Roteiro de Cobrança (Steps) ===== */}
            <div>
              <button onClick={() => toggleSection("steps")} className="flex items-center gap-2 w-full text-left mb-3">
                <SectionHeader icon={FileText} title="Roteiro de Cobrança (7 Dias)" subtitle="Progresso das ações por step do roteiro" color="from-amber-500 to-orange-600" />
                {expandedSections.steps ? <ChevronUp className="w-5 h-5 text-slate-400 ml-auto" /> : <ChevronDown className="w-5 h-5 text-slate-400 ml-auto" />}
              </button>
              {expandedSections.steps && stepChartData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Stacked Bar Chart */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-1">Ações por Step</h4>
                    <p className="text-[10px] text-slate-400 mb-3">Verde = ação concluída com sucesso | Azul = contato realizado manualmente | Vermelho = falha (não conseguiu contato)</p>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stepChartData} barSize={28}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="shortName" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="concluido" name="Ação Concluída (verde)" fill={STEP_COLORS.green} stackId="a" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="contato" name="Contato Realizado (azul)" fill={STEP_COLORS.blue} stackId="a" />
                          <Bar dataKey="falha" name="Falha (vermelho)" fill={STEP_COLORS.red} stackId="a" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Step Table */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-1">Detalhamento por Step</h4>
                    <p className="text-[10px] text-slate-400 mb-3">Cada step do roteiro de 7 dias — marcações feitas pelo operador Thiago</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Step</th>
                            <th className="text-center py-2 px-2 text-xs font-semibold text-emerald-600" title="Ação do roteiro concluída com sucesso pelo operador">Concluído</th>
                            <th className="text-center py-2 px-2 text-xs font-semibold text-blue-600" title="Contato realizado manualmente pelo operador (marcação azul)">Contato Realizado</th>
                            <th className="text-center py-2 px-2 text-xs font-semibold text-red-600" title="Ação marcada como falha (não conseguiu contato)">Falha</th>
                            <th className="text-center py-2 px-2 text-xs font-semibold text-slate-700">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stepBreakdown?.steps.map((s, i) => (
                            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-2 px-2 font-medium text-slate-800 text-xs">{s.label}</td>
                              <td className="py-2 px-2 text-center tabular-nums">
                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold">{s.green}</span>
                              </td>
                              <td className="py-2 px-2 text-center tabular-nums">
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{s.blue}</span>
                              </td>
                              <td className="py-2 px-2 text-center tabular-nums">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.red > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-400"}`}>{s.red}</span>
                              </td>
                              <td className="py-2 px-2 text-center tabular-nums font-bold text-slate-800">{s.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Tick history actions */}
                    {stepBreakdown?.tickHistoryActions && stepBreakdown.tickHistoryActions.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <h5 className="text-xs font-semibold text-slate-600 mb-2">Histórico de Ações no Roteiro</h5>
                        <div className="flex flex-wrap gap-2">
                          {stepBreakdown.tickHistoryActions.map((a, i) => (
                            <span key={i} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-medium">
                              {TICK_ACTION_LABELS[a.action] || a.action}: <strong>{a.count}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ===== Recuperações ===== */}
            <div>
              <button onClick={() => toggleSection("recovery")} className="flex items-center gap-2 w-full text-left mb-3">
                <SectionHeader icon={TrendingUp} title="Recuperações (Pagos / Resolvidos)" subtitle="Títulos que saíram da inadimplência após cobrança" color="from-emerald-500 to-green-600" />
                {expandedSections.recovery ? <ChevronUp className="w-5 h-5 text-slate-400 ml-auto" /> : <ChevronDown className="w-5 h-5 text-slate-400 ml-auto" />}
              </button>
              {expandedSections.recovery && (
                <div className="space-y-6">
                  {/* Recovery Timeline Chart */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-700">Evolução de Recuperações</h4>
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                        {(["day", "week", "month"] as const).map(g => (
                          <button
                            key={g}
                            onClick={() => setRecoveryGroupBy(g)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                              recoveryGroupBy === g ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            {g === "day" ? "Diário" : g === "week" ? "Semanal" : "Mensal"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {recoveryTimeline && recoveryTimeline.length > 0 ? (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={recoveryTimeline}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis
                              dataKey="period"
                              tick={{ fontSize: 10 }}
                              tickFormatter={(v) => {
                                const d = new Date(v + "T12:00:00");
                                return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                              }}
                            />
                            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                            <Tooltip content={<CurrencyTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar yAxisId="left" dataKey="count" name="Qtd Recuperados" fill="#10b981" barSize={20} radius={[4, 4, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="totalValor" name="Valor Recuperado" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-72 flex items-center justify-center text-slate-400 text-sm">
                        Nenhuma recuperação no período selecionado
                      </div>
                    )}
                  </div>

                  {/* Recovery Summary Table */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-700">Resumo de Recuperações por Período</h4>
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                        {(["day", "week", "month", "year"] as const).map(g => (
                          <button
                            key={g}
                            onClick={() => setSummaryGroupBy(g)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                              summaryGroupBy === g ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            {g === "day" ? "Dia" : g === "week" ? "Semana" : g === "month" ? "Mês" : "Ano"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {recoverySummary && recoverySummary.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Período</th>
                              <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Qtd Recuperados</th>
                              <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Valor Total</th>
                              <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Média Dias Atraso</th>
                              <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Total Contatos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recoverySummary.map((s, i) => (
                              <tr key={i} className="border-b border-slate-100 hover:bg-emerald-50/50">
                                <td className="py-2.5 px-3 font-semibold text-slate-800">{s.period}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-bold">{s.count}</span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-emerald-700 tabular-nums">{formatCurrency(s.totalValor)}</td>
                                <td className="py-2.5 px-3 text-center text-slate-600 tabular-nums">{s.avgDiasAtraso}d</td>
                                <td className="py-2.5 px-3 text-center text-slate-600 tabular-nums">{s.totalContatos}</td>
                              </tr>
                            ))}
                            {/* Totals row */}
                            <tr className="bg-emerald-50 font-bold">
                              <td className="py-2.5 px-3 text-emerald-800">TOTAL</td>
                              <td className="py-2.5 px-3 text-center text-emerald-800">{recoverySummary.reduce((a, b) => a + b.count, 0)}</td>
                              <td className="py-2.5 px-3 text-right text-emerald-800 tabular-nums">{formatCurrency(recoverySummary.reduce((a, b) => a + b.totalValor, 0))}</td>
                              <td className="py-2.5 px-3 text-center text-emerald-700">
                                {Math.round(recoverySummary.reduce((a, b) => a + b.avgDiasAtraso * b.count, 0) / Math.max(recoverySummary.reduce((a, b) => a + b.count, 0), 1))}d
                              </td>
                              <td className="py-2.5 px-3 text-center text-emerald-700">{recoverySummary.reduce((a, b) => a + b.totalContatos, 0)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-8">Nenhuma recuperação registrada</p>
                    )}
                  </div>

                  {/* Recovery Details Table */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <button onClick={() => toggleSection("recoveryTable")} className="flex items-center gap-2 w-full text-left mb-3">
                      <h4 className="text-sm font-semibold text-slate-700">Títulos Recuperados (Detalhado)</h4>
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold ml-2">{recoveryDetails?.total || 0}</span>
                      {expandedSections.recoveryTable ? <ChevronUp className="w-4 h-4 text-slate-400 ml-auto" /> : <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />}
                    </button>
                    {expandedSections.recoveryTable && recoveryDetails && recoveryDetails.items.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="text-left py-2 px-2 font-semibold text-slate-500">Cliente</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-500">Doc</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-500">Empresa</th>
                              <th className="text-right py-2 px-2 font-semibold text-slate-500">Valor</th>
                              <th className="text-center py-2 px-2 font-semibold text-slate-500">Vencimento</th>
                              <th className="text-center py-2 px-2 font-semibold text-slate-500">Resolvido em</th>
                              <th className="text-center py-2 px-2 font-semibold text-slate-500">Dias Atraso</th>
                              <th className="text-center py-2 px-2 font-semibold text-slate-500">Contatos</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-500">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recoveryDetails.items.map((r, i) => (
                              <tr key={i} className="border-b border-slate-100 hover:bg-emerald-50/30">
                                <td className="py-2 px-2 font-medium text-slate-800 max-w-[180px] truncate">{r.cliente}</td>
                                <td className="py-2 px-2 text-slate-600">{r.documento || "-"}</td>
                                <td className="py-2 px-2 text-slate-600">{r.empresa || "-"}</td>
                                <td className="py-2 px-2 text-right font-bold text-emerald-700 tabular-nums">{formatCurrency(r.valorAReceber)}</td>
                                <td className="py-2 px-2 text-center text-slate-600">
                                  {r.vencimentoData ? new Date(r.vencimentoData + "T12:00:00").toLocaleDateString("pt-BR") : "-"}
                                </td>
                                <td className="py-2 px-2 text-center text-emerald-700 font-medium">
                                  {r.resolvedAt ? new Date(r.resolvedAt).toLocaleDateString("pt-BR") : "-"}
                                </td>
                                <td className="py-2 px-2 text-center tabular-nums">{r.diasAtrasoNaResolucao || 0}d</td>
                                <td className="py-2 px-2 text-center tabular-nums">{r.totalContatos || 0}</td>
                                <td className="py-2 px-2">
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
                                    backgroundColor: STATUS_COLORS[r.statusCobranca || ""] ? STATUS_COLORS[r.statusCobranca || ""] + "20" : "#f1f5f9",
                                    color: STATUS_COLORS[r.statusCobranca || ""] || "#64748b",
                                  }}>
                                    {STATUS_LABELS[r.statusCobranca || ""] || r.statusCobranca || "—"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
