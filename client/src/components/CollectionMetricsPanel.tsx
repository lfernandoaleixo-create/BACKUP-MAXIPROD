/**
 * Painel de Métricas e Analytics de Cobrança
 * Exibe gráficos profissionais, tabelas e KPIs sobre o processo de cobrança
 * 
 * TOOLTIPS: Cada card, gráfico, porcentagem e texto tem tooltip detalhado
 * explicando o que significa, como é calculado e quais exclusões se aplicam.
 */
import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  ComposedChart
} from "recharts";
import {
  X, TrendingUp, TrendingDown, Users, DollarSign, Phone, MessageCircle,
  Mail, CheckCircle2, AlertTriangle, BarChart3, Activity, Target, Clock,
  FileText, Shield, ChevronDown, ChevronUp, Calendar, Filter, ArrowRight,
  Zap, Award, PieChart as PieChartIcon, Info, HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

// Explicações detalhadas de cada ação do histórico
const TICK_ACTION_EXPLANATIONS: Record<string, string> = {
  tick: "O operador marcou manualmente o checkbox verde de um step, indicando que a ação de cobrança daquele dia foi concluída com sucesso (ex: enviou WhatsApp, fez ligação).",
  manual_blue: "O operador registrou manualmente um contato realizado com o cliente (marcação azul). Significa que houve comunicação efetiva com o devedor, independente do step do roteiro.",
  untick: "O operador desmarcou um checkbox que estava marcado. Pode acontecer quando uma marcação foi feita por engano ou quando o status precisa ser corrigido.",
  phone_mute: "O operador silenciou o telefone de um cliente. Usado quando o cliente pede para não ser mais contatado por ligação, ou quando o número está incorreto/inexistente.",
  phone_unmute: "O operador reativou o telefone de um cliente que estava silenciado. O cliente volta a receber ligações de cobrança.",
  auto_red: "O SISTEMA marcou automaticamente uma falha (vermelho) quando o prazo do step expirou sem que o operador tivesse concluído a ação. NÃO é uma falha do operador — é um registro automático do sistema.",
  sync_green: "Uma sincronização automática do sistema marcou um step como concluído (verde). Acontece quando o sistema detecta que a ação foi realizada por outro meio.",
  manual_red: "O operador marcou manualmente uma falha (vermelho) em um step. Indica que tentou realizar a ação de cobrança mas não conseguiu contato com o cliente.",
  sync_red: "Uma sincronização do sistema registrou uma falha. Diferente do auto_red, esta é uma falha detectada durante processo de sincronização.",
};

// ---- InfoTooltip: ícone de info com tooltip explicativo ----
function InfoTip({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center cursor-help ${className || ""}`}>
          <Info className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500 transition-colors" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed whitespace-pre-line">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

// ---- HoverTip: wrap any element with a tooltip ----
function HoverTip({ children, text, className }: { children: React.ReactNode; text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`cursor-help ${className || ""}`}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm text-xs leading-relaxed whitespace-pre-line">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

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

// ---- KPI Card with tooltip ----
function KpiCard({ icon: Icon, label, value, subValue, color, trend, tooltip }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  trend?: "up" | "down" | "neutral";
  tooltip?: string;
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

  const card = (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4 transition-all hover:shadow-md ${tooltip ? "cursor-help" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        {tooltip && <Info className="w-3 h-3 text-slate-300 ml-auto flex-shrink-0" />}
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-2xl font-bold ${c.text} tabular-nums`}>{value}</span>
        {trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-500 mb-1" />}
        {trend === "down" && <TrendingDown className="w-4 h-4 text-red-500 mb-1" />}
      </div>
      {subValue && <p className="text-[11px] text-slate-500 mt-1">{subValue}</p>}
    </div>
  );

  if (!tooltip) return card;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm text-xs leading-relaxed whitespace-pre-line">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

// ---- Section Header ----
function SectionHeader({ icon: Icon, title, subtitle, color, tooltip }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  color: string;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          {tooltip && <InfoTip text={tooltip} />}
        </div>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

// ---- Period Selector for Recovery Summary ----
function PeriodSelector({ groupBy, onGroupByChange, startDate, endDate, onStartDateChange, onEndDateChange }: {
  groupBy: "day" | "week" | "month" | "year";
  onGroupByChange: (v: "day" | "week" | "month" | "year") => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
}) {
  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const months: { value: string; label: string; start: string; end: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
      months.push({
        value: `${y}-${m}`,
        label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        start: `${y}-${m}-01`,
        end: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
      });
    }
    return months;
  }, []);

  // Generate year options
  const yearOptions = useMemo(() => {
    const years: { value: string; label: string; start: string; end: string }[] = [];
    const now = new Date();
    for (let y = now.getFullYear(); y >= 2025; y--) {
      years.push({
        value: String(y),
        label: String(y),
        start: `${y}-01-01`,
        end: `${y}-12-31`,
      });
    }
    return years;
  }, []);

  // Generate week options (last 12 weeks)
  const weekOptions = useMemo(() => {
    const weeks: { value: string; label: string; start: string; end: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - (i * 7));
      // Get Monday of that week
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const startStr = monday.toISOString().split("T")[0];
      const endStr = sunday.toISOString().split("T")[0];
      const label = `${monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} a ${sunday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
      weeks.push({ value: startStr, label, start: startStr, end: endStr });
    }
    return weeks;
  }, []);

  const handlePeriodSelect = (value: string, options: { value: string; start: string; end: string }[]) => {
    const opt = options.find(o => o.value === value || o.start === value);
    if (opt) {
      onStartDateChange(opt.start);
      onEndDateChange(opt.end);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Granularity buttons */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
        {(["day", "week", "month", "year"] as const).map(g => (
          <button
            key={g}
            onClick={() => {
              onGroupByChange(g);
              // Clear date filter when switching granularity to show all
              onStartDateChange("");
              onEndDateChange("");
            }}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              groupBy === g ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {g === "day" ? "Dia" : g === "week" ? "Semana" : g === "month" ? "Mês" : "Ano"}
          </button>
        ))}
      </div>

      {/* Specific period picker based on granularity */}
      <div className="flex items-center gap-2">
        {groupBy === "day" && (
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={startDate}
              onChange={e => {
                onStartDateChange(e.target.value);
                onEndDateChange(e.target.value);
              }}
              className="w-40 h-8 text-xs"
              placeholder="Selecionar dia"
            />
          </div>
        )}

        {groupBy === "week" && (
          <Select
            value={startDate || "all"}
            onValueChange={(v) => {
              if (v === "all") {
                onStartDateChange("");
                onEndDateChange("");
              } else {
                handlePeriodSelect(v, weekOptions);
              }
            }}
          >
            <SelectTrigger className="w-64 h-8 text-xs">
              <SelectValue placeholder="Todas as semanas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as semanas</SelectItem>
              {weekOptions.map(w => (
                <SelectItem key={w.value} value={w.start}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {groupBy === "month" && (
          <Select
            value={startDate ? startDate.substring(0, 7) : "all"}
            onValueChange={(v) => {
              if (v === "all") {
                onStartDateChange("");
                onEndDateChange("");
              } else {
                const opt = monthOptions.find(m => m.value === v);
                if (opt) {
                  onStartDateChange(opt.start);
                  onEndDateChange(opt.end);
                }
              }
            }}
          >
            <SelectTrigger className="w-52 h-8 text-xs">
              <SelectValue placeholder="Todos os meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {monthOptions.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {groupBy === "year" && (
          <Select
            value={startDate ? startDate.substring(0, 4) : "all"}
            onValueChange={(v) => {
              if (v === "all") {
                onStartDateChange("");
                onEndDateChange("");
              } else {
                const opt = yearOptions.find(y => y.value === v);
                if (opt) {
                  onStartDateChange(opt.start);
                  onEndDateChange(opt.end);
                }
              }
            }}
          >
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Todos os anos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {yearOptions.map(y => (
                <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(startDate || endDate) && (
          <Button variant="ghost" size="sm" onClick={() => { onStartDateChange(""); onEndDateChange(""); }} className="text-xs h-8 px-2">
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}

// ---- Main Component ----
export default function CollectionMetricsPanel({ onClose }: { onClose: () => void }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [recoveryGroupBy, setRecoveryGroupBy] = useState<"day" | "week" | "month">("day");
  const [summaryGroupBy, setSummaryGroupBy] = useState<"day" | "week" | "month" | "year">("day");
  const [summaryStartDate, setSummaryStartDate] = useState("");
  const [summaryEndDate, setSummaryEndDate] = useState("");
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

  const summaryFilter = useMemo(() => {
    const f: { groupBy: "day" | "week" | "month" | "year"; startDate?: string; endDate?: string } = { groupBy: summaryGroupBy };
    if (summaryStartDate) f.startDate = summaryStartDate;
    if (summaryEndDate) f.endDate = summaryEndDate;
    return f;
  }, [summaryGroupBy, summaryStartDate, summaryEndDate]);

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
  const { data: recoverySummary } = trpc.collectionMetrics.getRecoverySummaryByPeriod.useQuery(summaryFilter);

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
  const resolvedExcSpecial = overview?.resolvedExcludingSpecial?.count || 0;
  const taxaRecuperacao = totalInCollection > 0 ? ((totalResolved / (totalInCollection + totalResolved)) * 100).toFixed(1) : "0";
  const eficiencia = totalActions > 0 ? (resolvedExcSpecial / totalActions * 100).toFixed(1) : "0";

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
            <HoverTip text="Use este filtro para restringir TODOS os dados do painel a um período específico. Afeta KPIs, gráficos e tabelas. Quando vazio, mostra dados de todo o histórico.">
              <div className="flex items-center gap-1">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Filtrar período:</span>
              </div>
            </HoverTip>
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
                <SectionHeader
                  icon={Target}
                  title="Indicadores Chave (KPIs)"
                  subtitle="Visão geral do desempenho da cobrança"
                  color="from-indigo-500 to-blue-600"
                  tooltip="Estes indicadores resumem o desempenho geral do processo de cobrança. Cada card mostra um número-chave com explicação detalhada ao passar o mouse. Os dados são filtrados pelo período selecionado acima (quando aplicável). Apenas ações do operador Thiago são contabilizadas — Guilherme (gestor) é excluído de todas as métricas."
                />
                {expandedSections.kpis ? <ChevronUp className="w-5 h-5 text-slate-400 ml-auto" /> : <ChevronDown className="w-5 h-5 text-slate-400 ml-auto" />}
              </button>
              {expandedSections.kpis && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  <KpiCard
                    icon={FileText}
                    label="Títulos em Cobrança"
                    value={formatNumber(totalInCollection)}
                    subValue="Títulos ativos no processo"
                    color="blue"
                    tooltip={`Quantidade total de títulos (boletos/duplicatas) que estão atualmente no processo de cobrança de inadimplência.\n\nInclui todos os status: Pendente, Contatado, Em Negociação, Promessa, etc.\n\nNÃO inclui títulos já pagos/resolvidos — esses saem da cobrança ativa.\n\nAtualmente: ${formatNumber(totalInCollection)} títulos ativos.`}
                  />
                  <KpiCard
                    icon={CheckCircle2}
                    label="Recuperados"
                    value={formatNumber(totalResolved)}
                    subValue={`${taxaRecuperacao}% de taxa de recuperação`}
                    color="green"
                    trend="up"
                    tooltip={`Títulos que foram pagos/resolvidos após o processo de cobrança.\n\nCritério: título precisa ter sido pago pelo menos 3 dias úteis após o vencimento (para descartar pagamentos que já estavam em trânsito bancário antes da cobrança).\n\nExclui clientes de teste.\n\nDeduplificado: se o mesmo título (mesmo cliente + documento + vencimento) aparece mais de uma vez no banco, conta apenas 1 vez.\n\nAtualmente: ${formatNumber(totalResolved)} títulos recuperados.`}
                  />
                  <KpiCard
                    icon={DollarSign}
                    label="Valor Recuperado"
                    value={formatCurrency(totalRecuperado)}
                    subValue="Total de valores pagos"
                    color="green"
                    tooltip={`Soma dos valores (R$) de todos os títulos recuperados.\n\nMesmos critérios do card "Recuperados": mínimo 3 dias de atraso, exclui testes, deduplificado.\n\nEste valor representa o retorno financeiro direto do trabalho de cobrança.\n\nAtualmente: ${formatCurrency(totalRecuperado)}.`}
                  />
                  <KpiCard
                    icon={Activity}
                    label="Ações Realizadas"
                    value={formatNumber(totalActions)}
                    subValue="WhatsApp, e-mail, ligações"
                    color="purple"
                    tooltip={`Total de ações de cobrança registradas pelo operador Thiago.\n\nInclui: mensagens de WhatsApp, e-mails enviados, ligações telefônicas e outros tipos de contato.\n\nGuilherme (gestor/supervisor) é EXCLUÍDO desta contagem — apenas ações do operador de cobrança contam.\n\nCada ação representa uma tentativa de contato com um cliente inadimplente.\n\nAtualmente: ${formatNumber(totalActions)} ações.`}
                  />
                  <KpiCard
                    icon={Shield}
                    label="Decisões (Dia 7)"
                    value={formatNumber(totalDecisoes)}
                    subValue={`${totalDecisionPdfs} PDFs gerados`}
                    color="amber"
                    tooltip={`Decisões tomadas no Dia 7 do roteiro de cobrança.\n\nNo roteiro de 7 dias, o último step é a "Decisão": quando todas as tentativas de contato falharam, o operador decide o próximo passo (protesto, jurídico, negociação especial, etc.).\n\nPDFs gerados: documentos formais de decisão criados para registro.\n\nAtualmente: ${formatNumber(totalDecisoes)} decisões, ${totalDecisionPdfs} PDFs.`}
                  />
                  <KpiCard
                    icon={Phone}
                    label="Contatos Registrados"
                    value={formatNumber(totalContatos)}
                    subValue="Registros de contato com clientes"
                    color="cyan"
                    tooltip={`Total de registros de contato salvos no histórico de cada cliente.\n\nDiferente de "Ações Realizadas": aqui conta cada entrada no histórico de contato (contatoHistorico) de cada título.\n\nUm contato pode incluir: anotação de conversa, registro de promessa, observação sobre o cliente, etc.\n\nAtualmente: ${formatNumber(totalContatos)} registros.`}
                  />
                  <KpiCard
                    icon={AlertTriangle}
                    label="Falhas do Operador"
                    value={formatNumber(totalFalhas)}
                    subValue={totalFalhas === 0 ? "Nenhuma falha manual do Thiago!" : "Tentativas sem sucesso pelo operador"}
                    color={totalFalhas === 0 ? "green" : "red"}
                    tooltip={`Falhas MANUAIS do operador Thiago — quando ele marcou explicitamente que não conseguiu realizar o contato.\n\nIMPORTANTE: Falhas automáticas do sistema (auto_red) NÃO são contadas aqui. O sistema marca automaticamente como "falha" quando o prazo de um step expira, mas isso não é responsabilidade do operador.\n\nAtualmente existem 6 marcações auto_red do sistema no Step 3 (Ação 2), mas essas são IGNORADAS nesta métrica.\n\nApenas falhas que o Thiago marcou manualmente contam.\n\nAtualmente: ${formatNumber(totalFalhas)} falhas manuais.`}
                  />
                  <KpiCard
                    icon={Zap}
                    label="Taxa de Recuperação"
                    value={`${taxaRecuperacao}%`}
                    subValue={`${totalResolved} de ${totalInCollection + totalResolved} títulos`}
                    color="orange"
                    tooltip={`Porcentagem de títulos recuperados em relação ao total que passou pela cobrança.\n\nFórmula: Recuperados ÷ (Ativos + Recuperados) × 100\n= ${totalResolved} ÷ (${totalInCollection} + ${totalResolved}) × 100\n= ${taxaRecuperacao}%\n\nEsta taxa mostra a eficácia geral do processo de cobrança em converter títulos inadimplentes em pagos.\n\nInclui TODOS os títulos recuperados (inclusive clientes Especial s/ Cobrança).`}
                  />
                  <KpiCard
                    icon={Target}
                    label="Eficiência"
                    value={`${eficiencia}%`}
                    subValue={`${resolvedExcSpecial} recuperações regulares / ${totalActions} ações (excl. Especiais)`}
                    color="blue"
                    tooltip={`Eficiência do operador: quantas recuperações foram obtidas por ação realizada.\n\nFórmula: Recuperações de clientes regulares ÷ Total de ações × 100\n= ${resolvedExcSpecial} ÷ ${totalActions} × 100\n= ${eficiencia}%\n\nEXCLUI clientes com status "Especial s/ Cobrança" do numerador, pois esses clientes têm tratamento diferenciado e não são cobrados ativamente pelo operador.\n\nO denominador conta TODAS as ações do Thiago (WhatsApp, e-mail, ligação, outro).\n\nEsta métrica mede o retorno real do esforço de cobrança.`}
                  />
                </div>
              )}
            </div>


            {/* ===== Recuperações ===== */}
            <div>
              <button onClick={() => toggleSection("recovery")} className="flex items-center gap-2 w-full text-left mb-3">
                <SectionHeader
                  icon={TrendingUp}
                  title="Recuperações (Pagos / Resolvidos)"
                  subtitle="Títulos que saíram da inadimplência após cobrança"
                  color="from-emerald-500 to-green-600"
                  tooltip={`Seção dedicada aos títulos que foram efetivamente pagos/resolvidos após o processo de cobrança.\n\nCritérios para contar como "recuperado":\n1. O título precisa ter sido pago pelo menos 3 dias úteis após o vencimento (para descartar pagamentos que já estavam em trânsito bancário, feriados e fins de semana)\n2. Clientes de teste são excluídos\n3. Registros duplicados (mesmo cliente + documento + vencimento) contam apenas 1 vez\n\nInclui: gráfico de evolução temporal, resumo por período com filtro, e tabela detalhada de cada título recuperado.`}
                />
                {expandedSections.recovery ? <ChevronUp className="w-5 h-5 text-slate-400 ml-auto" /> : <ChevronDown className="w-5 h-5 text-slate-400 ml-auto" />}
              </button>
              {expandedSections.recovery && (
                <div className="space-y-6">

                  {/* Recovery Summary Table */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex flex-col gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-700">Resumo de Recuperações por Período</h4>
                        <InfoTip text="Tabela resumo das recuperações agrupadas por período.\n\nEscolha a granularidade (Dia/Semana/Mês/Ano) e opcionalmente selecione um período específico para filtrar.\n\nQtd Recuperados: número de títulos pagos no período (deduplificado).\nValor Total: soma dos valores recuperados.\nMédia Dias Atraso: média de dias entre o vencimento e o pagamento.\nTotal Contatos: soma dos contatos registrados para os títulos recuperados.\n\nA linha TOTAL no final soma todos os períodos visíveis." />
                      </div>
                      <PeriodSelector
                        groupBy={summaryGroupBy}
                        onGroupByChange={setSummaryGroupBy}
                        startDate={summaryStartDate}
                        endDate={summaryEndDate}
                        onStartDateChange={setSummaryStartDate}
                        onEndDateChange={setSummaryEndDate}
                      />
                    </div>
                    {recoverySummary && recoverySummary.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">
                                <HoverTip text="O período de agrupamento. Formato depende da granularidade selecionada: data completa (dia), início da semana (semana), mês/ano (mês), ou ano (ano).">
                                  <span>Período</span>
                                </HoverTip>
                              </th>
                              <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">
                                <HoverTip text="Quantidade de títulos únicos recuperados (pagos) neste período. Deduplificado: mesmo cliente + documento + vencimento conta apenas 1 vez.">
                                  <span>Qtd Recuperados</span>
                                </HoverTip>
                              </th>
                              <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">
                                <HoverTip text="Soma dos valores (R$) dos títulos recuperados neste período.">
                                  <span>Valor Total</span>
                                </HoverTip>
                              </th>
                              <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">
                                <HoverTip text="Média de dias de atraso dos títulos recuperados neste período. Calculada como: média dos dias entre o vencimento e a data de resolução de cada título.">
                                  <span>Média Dias Atraso</span>
                                </HoverTip>
                              </th>
                              <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">
                                <HoverTip text="Soma total de contatos registrados para os títulos recuperados neste período. Inclui WhatsApp, e-mail, ligação e outros contatos.">
                                  <span>Total Contatos</span>
                                </HoverTip>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {recoverySummary.map((s, i) => {
                              // Format period label based on groupBy
                              let periodLabel = s.period;
                              if (summaryGroupBy === "day") {
                                const d = new Date(s.period + "T12:00:00");
                                periodLabel = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
                              } else if (summaryGroupBy === "week") {
                                const d = new Date(s.period + "T12:00:00");
                                const end = new Date(d);
                                end.setDate(end.getDate() + 6);
                                periodLabel = `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} a ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
                              } else if (summaryGroupBy === "month") {
                                const [y, m] = s.period.split("-");
                                const d = new Date(Number(y), Number(m) - 1, 1);
                                periodLabel = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                              }
                              return (
                                <tr key={i} className="border-b border-slate-100 hover:bg-emerald-50/50">
                                  <td className="py-2.5 px-3 font-semibold text-slate-800">{periodLabel}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-bold">{s.count}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-emerald-700 tabular-nums">{formatCurrency(s.totalValor)}</td>
                                  <td className="py-2.5 px-3 text-center text-slate-600 tabular-nums">{s.avgDiasAtraso}d</td>
                                  <td className="py-2.5 px-3 text-center text-slate-600 tabular-nums">{s.totalContatos}</td>
                                </tr>
                              );
                            })}
                            {/* Totals row */}
                            <tr className="bg-emerald-50 font-bold">
                              <td className="py-2.5 px-3 text-emerald-800">TOTAL</td>
                              <td className="py-2.5 px-3 text-center text-emerald-800">{recoverySummary.reduce((a, b) => a + b.count, 0)}</td>
                              <td className="py-2.5 px-3 text-right text-emerald-800 tabular-nums">{formatCurrency(recoverySummary.reduce((a, b) => a + b.totalValor, 0))}</td>
                              <td className="py-2.5 px-3 text-center text-emerald-700">
                                <HoverTip text="Média ponderada: soma(diasAtraso × qtdRecuperados) ÷ totalRecuperados">
                                  <span>{Math.round(recoverySummary.reduce((a, b) => a + b.avgDiasAtraso * b.count, 0) / Math.max(recoverySummary.reduce((a, b) => a + b.count, 0), 1))}d</span>
                                </HoverTip>
                              </td>
                              <td className="py-2.5 px-3 text-center text-emerald-700">{recoverySummary.reduce((a, b) => a + b.totalContatos, 0)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-8">Nenhuma recuperação registrada{(summaryStartDate || summaryEndDate) ? " no período selecionado" : ""}</p>
                    )}
                  </div>

                  {/* Recovery Details Table */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <button onClick={() => toggleSection("recoveryTable")} className="flex items-center gap-2 w-full text-left mb-3">
                      <h4 className="text-sm font-semibold text-slate-700">Títulos Recuperados (Detalhado)</h4>
                      <InfoTip text="Lista detalhada de cada título recuperado, com informações do cliente, valor, datas e status.\n\nDeduplificado: se o mesmo título aparece mais de uma vez no banco de dados (mesmo cliente + documento + vencimento), apenas um registro é exibido.\n\nDias Atraso: dias entre o vencimento e a data de resolução.\nContatos: número de contatos registrados para este título.\nStatus: status de cobrança no momento da resolução." />
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold ml-2">{recoveryDetails?.total || 0}</span>
                      {expandedSections.recoveryTable ? <ChevronUp className="w-4 h-4 text-slate-400 ml-auto" /> : <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />}
                    </button>
                    {expandedSections.recoveryTable && recoveryDetails && recoveryDetails.items.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="text-left py-2 px-2 font-semibold text-slate-500">
                                <HoverTip text="Nome/razão social do cliente que pagou o título.">
                                  <span>Cliente</span>
                                </HoverTip>
                              </th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-500">
                                <HoverTip text="Número do documento (duplicata/boleto).">
                                  <span>Doc</span>
                                </HoverTip>
                              </th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-500">
                                <HoverTip text="Empresa do Grupo Fox que emitiu o título.">
                                  <span>Empresa</span>
                                </HoverTip>
                              </th>
                              <th className="text-right py-2 px-2 font-semibold text-slate-500">
                                <HoverTip text="Valor a receber do título (valor original ou renegociado).">
                                  <span>Valor</span>
                                </HoverTip>
                              </th>
                              <th className="text-center py-2 px-2 font-semibold text-slate-500">
                                <HoverTip text="Data de vencimento original do título.">
                                  <span>Vencimento</span>
                                </HoverTip>
                              </th>
                              <th className="text-center py-2 px-2 font-semibold text-slate-500">
                                <HoverTip text="Data em que o título foi marcado como pago/resolvido no sistema.">
                                  <span>Resolvido em</span>
                                </HoverTip>
                              </th>
                              <th className="text-center py-2 px-2 font-semibold text-slate-500">
                                <HoverTip text="Quantidade de dias entre o vencimento e a data de resolução. Mínimo 3 dias (critério de filtro).">
                                  <span>Dias Atraso</span>
                                </HoverTip>
                              </th>
                              <th className="text-center py-2 px-2 font-semibold text-slate-500">
                                <HoverTip text="Número de contatos registrados no histórico deste título.">
                                  <span>Contatos</span>
                                </HoverTip>
                              </th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-500">
                                <HoverTip text="Status de cobrança do título no momento em que foi resolvido.">
                                  <span>Status</span>
                                </HoverTip>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {recoveryDetails.items.map((r, i) => (
                              <tr key={r.id || i} className="border-b border-slate-100 hover:bg-emerald-50/30">
                                <td className="py-2 px-2 font-medium text-slate-800 max-w-[180px] truncate" title={r.cliente}>{r.cliente}</td>
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
