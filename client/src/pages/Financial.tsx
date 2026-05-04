/**
 * Dashboard Grupo Fox - Aba Financeiro
 * Contas a Pagar e Receber do Maxiprod (SOMENTE LEITURA)
 */

import React, { useState, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import ConnectionStatusCard from "@/components/ConnectionStatusCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  BarChart3,
  Calendar,
  Users,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Wallet,
  Banknote,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Landmark,
  SlidersHorizontal,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowDown01,
  ArrowUp01,
  CalendarDays,
  MessageSquare,
  CheckSquare,
  Square,
  Eye,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import TopNav from "@/components/TopNav";
import { InadimplenciaCard, ClientesInadimplentesCard } from "@/components/InadimplenciaCards";
import WeekReconciliationCard from "@/components/WeekReconciliationCard";
import ResumoFinanceiroCard from "@/components/ResumoFinanceiroCard";
import InadimplenciaTab from "@/components/InadimplenciaTab";
import ReceivablesTab from "@/components/ReceivablesTab";
import EcommerceTab from "@/components/EcommerceTab";
import MaxiprodAutoVerifier from "@/components/MaxiprodAutoVerifier";
import { useOperator } from "@/contexts/OperatorContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Calculator, History, ShoppingCart } from "lucide-react";
import FinancialHistoryPanel, { WeekHistoryPanel } from "@/components/FinancialHistoryPanel";
import { useDiscountAlerts } from "@/contexts/DiscountAlertContext";

const MAXIPROD_AUTHORIZED_OPERATORS = ["Guilherme", "Fernando", "Bruno"];
const MAXIPROD_LOGIN_URL = "https://app.maxiprod.com.br/";

/* ---- Helpers ---- */
function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
  if (n < 0) return formatted.replace("R$", "R$ -");
  return formatted;
}

function formatCurrencyShort(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}K`;
  return formatCurrency(n);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = dateStr.split("T")[0];
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = dateStr.split("T")[0];
  const venc = new Date(d + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.floor((venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function DueBadge({ dateStr }: { dateStr: string | null }) {
  const days = daysUntil(dateStr);
  if (days === null) return <Badge variant="outline" className="text-xs">—</Badge>;
  if (days < 0) return <Badge className="bg-red-100 text-red-700 text-xs border-0">Vencido {Math.abs(days)}d</Badge>;
  if (days === 0) return <Badge className="bg-amber-100 text-amber-700 text-xs border-0">Vence hoje</Badge>;
  if (days <= 7) return <Badge className="bg-amber-100 text-amber-700 text-xs border-0">{days}d</Badge>;
  if (days <= 30) return <Badge className="bg-blue-100 text-blue-700 text-xs border-0">{days}d</Badge>;
  return <Badge className="bg-slate-100 text-slate-600 text-xs border-0">{days}d</Badge>;
}

function EstadoBadge({ estado }: { estado: string }) {
  switch (estado) {
    case "EMITIDO":
      return <Badge className="bg-amber-100 text-amber-700 text-xs border-0"><Clock className="w-3 h-3 mr-1" />Em Aberto</Badge>;
    case "PAGO":
    case "RECEBIDO":
      return <Badge className="bg-emerald-100 text-emerald-700 text-xs border-0"><CheckCircle2 className="w-3 h-3 mr-1" />{estado === "PAGO" ? "Pago" : "Recebido"}</Badge>;
    case "CANCELADO":
      return <Badge className="bg-red-100 text-red-700 text-xs border-0"><XCircle className="w-3 h-3 mr-1" />Cancelado</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{estado}</Badge>;
  }
}

/* ---- Date period helpers ---- */
type PeriodKey = "mes_corrente" | "proximo_mes" | "60dias";

function getPeriodDates(period: PeriodKey): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based

  switch (period) {
    case "mes_corrente": {
      const from = new Date(y, m, 1);
      const to = new Date(y, m + 1, 0); // last day of month
      return {
        from: from.toISOString().split("T")[0],
        to: to.toISOString().split("T")[0],
        label: from.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      };
    }
    case "proximo_mes": {
      const from = new Date(y, m + 1, 1);
      const to = new Date(y, m + 2, 0);
      return {
        from: from.toISOString().split("T")[0],
        to: to.toISOString().split("T")[0],
        label: from.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      };
    }
    case "60dias": {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + 60);
      return {
        from: from.toISOString().split("T")[0],
        to: to.toISOString().split("T")[0],
        label: "Proximos 60 dias",
      };
    }
  }
}

/* ---- KPI Card ---- */
function KPICard({ label, value, sub, icon: Icon, theme, onClick }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  theme: "teal" | "emerald" | "red" | "amber" | "blue" | "violet" | "slate" | "orange";
  onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    teal: "bg-teal-500",
    emerald: "bg-emerald-500",
    red: "bg-red-500",
    amber: "bg-amber-500",
    blue: "bg-blue-500",
    violet: "bg-violet-500",
    slate: "bg-slate-400",
    orange: "bg-orange-500",
  };

  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 p-4 shadow-sm transition-all ${onClick ? "cursor-pointer hover:shadow-md hover:border-slate-300" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[theme]}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide truncate">{label}</p>
          <p className="text-lg font-bold text-slate-800">{value}</p>
          {sub && <p className="text-xs text-slate-400 truncate">{sub}</p>}
        </div>
        {onClick && <ChevronRight className="w-5 h-5 text-slate-400" />}
      </div>
    </div>
  );
}

/* ---- Aging Bar ---- */
function AgingBar({ aging }: { aging: any }) {
  if (!aging) return null;
  const total = aging.aVencer.total + aging.de1a30.total + aging.de31a60.total + aging.de61a90.total + aging.acima90.total;
  if (total === 0) return <p className="text-sm text-slate-400 text-center py-4">Nenhuma conta em aberto</p>;

  const segments = [
    { key: "aVencer", label: "A vencer", color: "bg-emerald-400", data: aging.aVencer },
    { key: "de1a30", label: "1-30 dias", color: "bg-amber-400", data: aging.de1a30 },
    { key: "de31a60", label: "31-60 dias", color: "bg-orange-400", data: aging.de31a60 },
    { key: "de61a90", label: "61-90 dias", color: "bg-red-400", data: aging.de61a90 },
    { key: "acima90", label: "90+ dias", color: "bg-red-600", data: aging.acima90 },
  ];

  return (
    <div className="space-y-3">
      <div className="flex h-6 rounded-full overflow-hidden">
        {segments.map((seg) => {
          const pct = (seg.data.total / total) * 100;
          if (pct < 0.5) return null;
          return (
            <Tooltip key={seg.key}>
              <TooltipTrigger asChild>
                <div className={`${seg.color} transition-all cursor-pointer hover:opacity-80`} style={{ width: `${pct}%` }} />
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">{seg.label}</p>
                <p>{formatCurrency(seg.data.total)} ({seg.data.count} titulos)</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {segments.map((seg) => (
          <div key={seg.key} className="text-center">
            <div className={`w-3 h-3 rounded-full ${seg.color} mx-auto mb-1`} />
            <p className="text-xs font-medium text-slate-600">{seg.label}</p>
            <p className="text-xs font-bold text-slate-800">{formatCurrencyShort(seg.data.total)}</p>
            <p className="text-xs text-slate-400">{seg.data.count} titulos</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Month Detail Table with sorting ---- */
type MonthDetailSort = "nome_asc" | "nome_desc" | "valor_asc" | "valor_desc" | "data_asc" | "data_desc";

function MonthDetailTable({ items, isLoading, nameField, colorScheme }: {
  items: any[] | undefined;
  isLoading: boolean;
  nameField: string;
  colorScheme: "emerald" | "red";
}) {
  const [sort, setSort] = useState<MonthDetailSort>("data_asc");
  const [calcMode, setCalcMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Helper: saldo restante = valorLiquido - valorPagoLiquido (ou valorRecebidoLiquido)
  const getSaldo = (item: any) => {
    const liquido = Number(item.valorLiquido || 0);
    const pago = Number(item.valorPagoLiquido || item.valorRecebidoLiquido || 0);
    return liquido - pago;
  };

  const colors = colorScheme === "emerald" ? {
    border: "border-emerald-200",
    headerBg: "bg-emerald-50",
    headerText: "text-emerald-700",
    hoverBg: "hover:bg-emerald-50/30",
    valueText: "text-emerald-700",
    sortActive: "text-emerald-600",
    sortInactive: "text-slate-300",
    calcBg: "bg-emerald-100",
    calcBorder: "border-emerald-300",
    calcText: "text-emerald-700",
    calcIcon: "text-emerald-600",
    calcCheckedBg: "bg-emerald-50",
    checkboxBorder: "border-emerald-400",
    checkboxChecked: "data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600",
  } : {
    border: "border-red-200",
    headerBg: "bg-red-50",
    headerText: "text-red-700",
    hoverBg: "hover:bg-red-50/30",
    valueText: "text-red-700",
    sortActive: "text-red-600",
    sortInactive: "text-slate-300",
    calcBg: "bg-red-100",
    calcBorder: "border-red-300",
    calcText: "text-red-700",
    calcIcon: "text-red-600",
    calcCheckedBg: "bg-red-50",
    checkboxBorder: "border-red-400",
    checkboxChecked: "data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600",
  };

  const toggleSort = (field: "nome" | "valor" | "data") => {
    if (sort === `${field}_asc`) setSort(`${field}_desc` as MonthDetailSort);
    else setSort(`${field}_asc` as MonthDetailSort);
  };

  const sortedItems = useMemo(() => {
    if (!items) return [];
    const sorted = [...items];
    switch (sort) {
      case "nome_asc":
        sorted.sort((a, b) => (a[nameField] || "").localeCompare(b[nameField] || ""));
        break;
      case "nome_desc":
        sorted.sort((a, b) => (b[nameField] || "").localeCompare(a[nameField] || ""));
        break;
      case "valor_asc":
        sorted.sort((a, b) => getSaldo(a) - getSaldo(b));
        break;
      case "valor_desc":
        sorted.sort((a, b) => getSaldo(b) - getSaldo(a));
        break;
      case "data_asc":
        sorted.sort((a, b) => (a.vencimentoData || "").localeCompare(b.vencimentoData || ""));
        break;
      case "data_desc":
        sorted.sort((a, b) => (b.vencimentoData || "").localeCompare(a.vencimentoData || ""));
        break;
    }
    return sorted;
  }, [items, sort, nameField]);

  // Calculator: sum of selected items
  const calcTotal = useMemo(() => {
    if (!calcMode || selectedIds.size === 0) return 0;
    return sortedItems
      .filter((_: any, i: number) => selectedIds.has(i))
      .reduce((sum: number, item: any) => sum + getSaldo(item), 0);
  }, [calcMode, selectedIds, sortedItems]);

  const toggleItem = useCallback((idx: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === sortedItems.length) return new Set();
      return new Set(sortedItems.map((_, i) => i));
    });
  }, [sortedItems]);

  const nameLabel = nameField === "cliente" ? "Cliente" : "Fornecedor";

  const SortArrow = ({ field }: { field: "nome" | "valor" | "data" }) => {
    const isActive = sort.startsWith(field);
    const isAsc = sort === `${field}_asc`;
    return (
      <ArrowUpDown className={`w-3 h-3 ml-1 inline-block cursor-pointer transition-colors ${
        isActive ? colors.sortActive : colors.sortInactive
      } ${isActive && !isAsc ? "rotate-180" : ""}`} />
    );
  };

  return (
    <div className={`mt-1 ml-2 mr-2 mb-2 border ${colors.border} rounded-lg overflow-hidden`}>
      {/* Calculator toolbar - always at top */}
      <div className={`${colors.headerBg} border-b ${colors.border} px-3 py-1.5 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCalcMode(!calcMode); if (calcMode) setSelectedIds(new Set()); }}
            className={`p-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              calcMode
                ? `${colors.calcBg} ${colors.calcIcon} shadow-sm`
                : 'text-slate-400 hover:text-slate-600 hover:bg-black/5'
            }`}
            title="Calculadora: selecione itens para somar"
          >
            <Calculator className="w-4.5 h-4.5" />
            <span className={`text-[10px] font-medium ${calcMode ? colors.calcText : 'text-slate-500'}`}>Calculadora</span>
          </button>
          {calcMode && selectedIds.size > 0 && (
            <div className={`${colors.calcBg} rounded-md px-2.5 py-1 flex items-center gap-1.5 shadow-sm`}>
              <span className={`text-xs font-bold ${colors.calcText} tabular-nums`}>{formatCurrency(calcTotal)}</span>
              <span className="text-[9px] text-slate-500">({selectedIds.size} sel.)</span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[9px] text-slate-500 hover:text-slate-700 underline ml-1"
              >Limpar</button>
            </div>
          )}
        </div>
        <span className={`text-[10px] text-slate-500`}>{sortedItems.length} contas</span>
      </div>
      <div className="max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
        ) : !sortedItems.length ? (
          <div className="text-center py-6 text-slate-400 text-xs">Nenhuma conta neste mês</div>
        ) : (
          <table className="w-full text-xs">
            <thead className={`${colors.headerBg} sticky top-0 z-10`}>
              <tr>
                {calcMode && (
                  <th className="px-2 py-2 w-8">
                    <Checkbox
                      checked={selectedIds.size === sortedItems.length && sortedItems.length > 0}
                      onCheckedChange={toggleAll}
                      className={`w-3.5 h-3.5 ${colors.checkboxBorder} ${colors.checkboxChecked}`}
                    />
                  </th>
                )}
                <th
                  className={`px-3 py-2 text-left ${colors.headerText} font-semibold cursor-pointer select-none hover:opacity-80`}
                  onClick={() => toggleSort("nome")}
                >
                  {nameLabel} <SortArrow field="nome" />
                </th>
                <th className={`px-3 py-2 text-left ${colors.headerText} font-semibold`}>
                  Referente a
                </th>
                <th
                  className={`px-3 py-2 text-right ${colors.headerText} font-semibold cursor-pointer select-none hover:opacity-80`}
                  onClick={() => toggleSort("valor")}
                >
                  Saldo <SortArrow field="valor" />
                </th>
                <th
                  className={`px-3 py-2 text-center ${colors.headerText} font-semibold cursor-pointer select-none hover:opacity-80`}
                  onClick={() => toggleSort("data")}
                >
                  Vencimento <SortArrow field="data" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedItems.map((item: any, i: number) => {
                const saldo = getSaldo(item);
                const temAbatimento = Number(item.valorPagoLiquido || item.valorRecebidoLiquido || 0) > 0;
                const isChecked = selectedIds.has(i);
                return (
                  <tr
                    key={i}
                    className={`${calcMode && isChecked ? colors.calcCheckedBg : ''} ${colors.hoverBg} ${calcMode ? 'cursor-pointer' : ''}`}
                    onClick={calcMode ? () => toggleItem(i) : undefined}
                  >
                    {calcMode && (
                      <td className="px-2 py-2">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleItem(i)}
                          className={`w-3.5 h-3.5 ${colors.checkboxBorder} ${colors.checkboxChecked}`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 text-slate-700 truncate max-w-[180px]" title={item[nameField] || ""}>{item[nameField] || (item.referenteA || item.observacoes || "—")}</td>
                    <td className="px-3 py-2 text-slate-500 text-[11px] truncate max-w-[220px]" title={item.referenteA || ""}>{item.referenteA || "—"}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${calcMode && isChecked ? colors.calcText : colors.valueText}`}>
                      {formatCurrency(saldo)}
                      {temAbatimento && (
                        <span className="block text-[10px] text-slate-400 font-normal line-through">
                          {formatCurrency(Number(item.valorLiquido || 0))}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-500">{formatDate(item.vencimentoData)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {sortedItems.length > 0 && (
        <div className={`${colors.headerBg} px-3 py-1.5 border-t ${colors.border} flex justify-end items-center`}>
          <span className={`text-[10px] font-semibold ${colors.headerText}`}>
            Total: {formatCurrency(sortedItems.reduce((sum: number, item: any) => sum + getSaldo(item), 0))}
          </span>
        </div>
      )}
    </div>
  );
}

/* ---- Sort types for bucket cards ---- */
type BucketSortMode = "data_asc" | "data_desc" | "valor_asc" | "valor_desc" | "nome_asc";

const SORT_LABELS: Record<BucketSortMode, { label: string; icon: React.ElementType }> = {
  data_asc: { label: "Data (mais antiga)", icon: CalendarDays },
  data_desc: { label: "Data (mais recente)", icon: CalendarDays },
  valor_asc: { label: "Valor (crescente)", icon: ArrowUp01 },
  valor_desc: { label: "Valor (decrescente)", icon: ArrowDown01 },
  nome_asc: { label: "Nome (A-Z)", icon: ArrowDownAZ },
};

/* ---- Auth Status Config ---- */
const AUTH_STATUS_OPTIONS = [
  { value: "autorizado" as const, label: "Autorizado", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  { value: "nao_autorizado" as const, label: "Nao Autorizado", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  { value: "autorizado_ressalva" as const, label: "Com Ressalva", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  { value: "prorrogar" as const, label: "Prorrogar", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  { value: "outros" as const, label: "Outros", color: "bg-slate-100 text-slate-600 border-slate-300", dot: "bg-slate-400" },
];

function getAuthStatusConfig(status: string | null) {
  return AUTH_STATUS_OPTIONS.find(o => o.value === status) || null;
}

/* ---- Comment Dialog ---- */
function PaymentCommentDialog({ item, onClose }: { item: any; onClose: () => void }) {
  const [comment, setComment] = useState(item.authNotes || "");
  const utils = trpc.useUtils();
  const updateNotes = trpc.financial.updatePaymentAuthNotes.useMutation({
    onSuccess: () => {
      utils.financial.getPaymentCalendar.invalidate();
      utils.financial.getWeekReconciliation.invalidate();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-80 p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-700">Comentario</h4>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-2 truncate">{item.fornecedor} - {formatCurrency(item.valor)}</p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Adicionar observacao..."
          className="w-full h-24 text-xs border border-slate-200 rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-teal-400"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 rounded">Cancelar</button>
          <button
            onClick={() => updateNotes.mutate({ accountPayableId: item.maxiprodId, notes: comment })}
            disabled={updateNotes.isPending}
            className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
          >
            {updateNotes.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Expandable Bucket Card with sort & search ---- */
function BucketCard({ bucket, colorClass, textColorClass, isPagar, canAuthorize = true, canComment = true }: {
  bucket: { label: string; total: number; count: number; items: any[] };
  colorClass: string;
  textColorClass: string;
  isPagar?: boolean;
  canAuthorize?: boolean;
  canComment?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [sortMode, setSortMode] = useState<BucketSortMode>("data_asc");
  const [searchTerm, setSearchTerm] = useState("");
  const [showWeekHistory, setShowWeekHistory] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  // Calculator checkbox state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [calcMode, setCalcMode] = useState(false);

  const VISIBLE = 5;

  const processedItems = useMemo(() => {
    let items = [...bucket.items];

    // Filter by search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      items = items.filter((item: any) =>
        (item.fornecedor || "").toLowerCase().includes(term) ||
        (item.referenteA || "").toLowerCase().includes(term) ||
        (item.anotacoes || "").toLowerCase().includes(term)
      );
    }

    // Sort
    switch (sortMode) {
      case "data_asc":
        items.sort((a: any, b: any) => (a.vencimento || "").localeCompare(b.vencimento || ""));
        break;
      case "data_desc":
        items.sort((a: any, b: any) => (b.vencimento || "").localeCompare(a.vencimento || ""));
        break;
      case "valor_asc":
        items.sort((a: any, b: any) => a.valor - b.valor);
        break;
      case "valor_desc":
        items.sort((a: any, b: any) => b.valor - a.valor);
        break;
      case "nome_asc":
        items.sort((a: any, b: any) => (a.fornecedor || "").localeCompare(b.fornecedor || ""));
        break;
    }

    return items;
  }, [bucket.items, sortMode, searchTerm]);

  const filteredTotal = useMemo(() => {
    if (!searchTerm.trim()) return bucket.total;
    return processedItems.reduce((sum: number, item: any) => sum + item.valor, 0);
  }, [processedItems, searchTerm, bucket.total]);

  // Calculator: sum of selected items
  const calcTotal = useMemo(() => {
    if (!calcMode || selectedIds.size === 0) return 0;
    return processedItems
      .filter((item: any) => selectedIds.has(String(item.maxiprodId || processedItems.indexOf(item))))
      .reduce((sum: number, item: any) => sum + item.valor, 0);
  }, [calcMode, selectedIds, processedItems]);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const hasMore = processedItems.length > VISIBLE;
  const visibleItems = expanded ? processedItems : processedItems.slice(0, VISIBLE);
  const hasItems = bucket.items.length > 0;

  // Status summary for Pagar cards
  const statusSummary = useMemo(() => {
    if (!isPagar) return [];
    const grouped: Record<string, { count: number; total: number }> = {};
    for (const item of bucket.items) {
      if (item.authStatus) {
        if (!grouped[item.authStatus]) grouped[item.authStatus] = { count: 0, total: 0 };
        grouped[item.authStatus].count++;
        grouped[item.authStatus].total += item.valor || 0;
      }
    }
    return AUTH_STATUS_OPTIONS
      .filter(opt => grouped[opt.value])
      .map(opt => ({ ...opt, count: grouped[opt.value].count, total: grouped[opt.value].total }));
  }, [isPagar, bucket.items]);

  return (
    <div className={`rounded-lg border ${colorClass} p-3`}>

      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-semibold ${textColorClass}`}>{bucket.label}</span>
        <div className="flex items-center gap-1.5">
          {/* Calculator total badge */}
          {calcMode && selectedIds.size > 0 && (
            <div className="flex items-center gap-1 bg-violet-100 border border-violet-300 rounded-md px-2 py-0.5">
              <Calculator className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-bold text-violet-700 tabular-nums">{formatCurrency(calcTotal)}</span>
              <span className="text-[9px] text-violet-500">({selectedIds.size})</span>
            </div>
          )}
          <div className="text-right">
            <span className={`text-sm font-bold ${textColorClass}`}>{formatCurrency(filteredTotal)}</span>
            <span className="text-xs text-slate-400 ml-1">({searchTerm.trim() ? processedItems.length : bucket.count})</span>
          </div>
          {/* Sort arrows + Search + Calculator toggle */}
          {hasItems && (
            <div className="flex items-end gap-1.5">
              {/* DATA: label + ↑↓ */}
              <div className="flex flex-col items-center gap-0">
                <span className="text-[8px] font-semibold text-slate-400 uppercase leading-none">Data</span>
                <button
                  onClick={() => {
                    if (sortMode === 'data_desc') setSortMode('data_asc');
                    else setSortMode('data_desc');
                  }}
                  className={`flex items-center gap-0 cursor-pointer transition-colors p-0.5 rounded hover:bg-black/5 ${
                    sortMode.startsWith('data') ? 'text-teal-600' : 'text-slate-300 hover:text-slate-500'
                  }`}
                  title={sortMode === 'data_desc' ? 'Data mais antiga primeiro' : 'Data mais recente primeiro'}
                >
                  <ArrowUp className="w-3 h-3" />
                  <ArrowDown className="w-3 h-3 -ml-0.5" />
                </button>
              </div>
              {/* VALOR: label + ↑↓ */}
              <div className="flex flex-col items-center gap-0">
                <span className="text-[8px] font-semibold text-slate-400 uppercase leading-none">Valor</span>
                <button
                  onClick={() => {
                    if (sortMode === 'valor_desc') setSortMode('valor_asc');
                    else setSortMode('valor_desc');
                  }}
                  className={`flex items-center gap-0 cursor-pointer transition-colors p-0.5 rounded hover:bg-black/5 ${
                    sortMode.startsWith('valor') ? 'text-teal-600' : 'text-slate-300 hover:text-slate-500'
                  }`}
                  title={sortMode === 'valor_desc' ? 'Menor valor primeiro' : 'Maior valor primeiro'}
                >
                  <ArrowUp className="w-3 h-3" />
                  <ArrowDown className="w-3 h-3 -ml-0.5" />
                </button>
              </div>
              {/* Search toggle */}
              <button
                onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchTerm(""); }}
                className={`p-1 rounded transition-colors cursor-pointer ${showSearch ? 'bg-teal-100 text-teal-600' : 'text-slate-400 hover:text-slate-600 hover:bg-black/5'}`}
                title="Buscar"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              {/* Calculator toggle */}
              <button
                onClick={() => { setCalcMode(!calcMode); if (calcMode) setSelectedIds(new Set()); }}
                className={`p-1 rounded transition-colors cursor-pointer ${calcMode ? 'bg-violet-100 text-violet-600' : 'text-slate-400 hover:text-slate-600 hover:bg-black/5'}`}
                title="Calculadora: selecione itens para somar"
              >
                <Calculator className="w-4.5 h-4.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Botão Histórico de Modificação Semanal (topo do card) */}
      <div className="flex justify-center mb-2">
        <button
          onClick={() => setShowWeekHistory(!showWeekHistory)}
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-4 py-1.5 rounded-md transition-all cursor-pointer ${
            showWeekHistory
              ? isPagar ? "bg-red-100 text-red-700 border border-red-200" : "bg-emerald-100 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 hover:shadow-sm"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          {showWeekHistory ? "Ocultar Histórico" : "Histórico de Modificação Semanal"}
        </button>
      </div>

      {/* Week History Panel */}
      {showWeekHistory && (
        <WeekHistoryPanel
          tipo={isPagar ? "pagar" : "receber"}
          semanaLabel={bucket.label}
          onClose={() => setShowWeekHistory(false)}
        />
      )}

      {/* Search input */}
      {showSearch && (
        <div className="mb-2 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full pl-7 pr-7 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400"
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Items list */}
      {visibleItems.length > 0 && (
        <div className="divide-y divide-slate-200/80">
          {visibleItems.map((item: any, idx: number) => {
            const itemId = String(item.maxiprodId || idx);
            const isChecked = selectedIds.has(itemId);
            const hasSecondary = item.referenteA || item.vencimentoOriginal;
            return (
              <div
                key={item.maxiprodId || idx}
                className={`py-2.5 px-1 transition-colors ${
                  calcMode && isChecked
                    ? 'bg-violet-50/80'
                    : idx % 2 === 0
                      ? 'bg-transparent'
                      : 'bg-slate-50/40'
                } hover:bg-slate-100/60`}
              >
                {/* Main row: checkbox + name + date + value */}
                <div className="flex items-center gap-x-2">
                  {calcMode && (
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleItem(itemId)}
                      className="w-3.5 h-3.5 shrink-0 border-violet-400 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                    />
                  )}
                  <span className="text-[13px] font-medium text-slate-700 truncate min-w-0" style={{ flex: '1 1 0' }}>
                    {item.fornecedor || item.referenteA || "—"}
                  </span>
                  <span
                    className="text-[11px] text-slate-400 whitespace-nowrap text-right shrink-0"
                    style={{ width: '72px', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatDate(item.vencimento)}
                  </span>
                  <span
                    className={`text-[13px] font-bold whitespace-nowrap text-right shrink-0 ${
                      calcMode && isChecked ? 'text-violet-700' : isPagar ? 'text-red-700' : 'text-emerald-700'
                    }`}
                    style={{ width: '90px', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatCurrency(item.valor)}
                  </span>
                </div>
                {/* Secondary row: referenteA + vencimento original */}
                {hasSecondary && (
                  <div className="flex items-center gap-x-2 mt-0.5" style={{ paddingLeft: calcMode ? '22px' : '0' }}>
                    {item.referenteA && (
                      <span className="text-[10.5px] text-slate-400 truncate min-w-0 italic" style={{ flex: '1 1 0' }}>
                        {item.referenteA}
                      </span>
                    )}
                    {item.vencimentoOriginal && (
                      <span
                        className={`text-[10px] font-medium whitespace-nowrap shrink-0 ${
                          item.vencimentoOriginal !== item.vencimento ? 'text-orange-500' : 'text-slate-400'
                        }`}
                        title="Vencimento Original do boleto"
                      >
                        Venc. Orig. {formatDate(item.vencimentoOriginal)}
                      </span>
                    )}
                  </div>
                )}
                {/* Annotations */}
                {item.anotacoes && (
                  <div className="mt-1" style={{ paddingLeft: calcMode ? '22px' : '0' }}>
                    <span
                      className="inline-flex items-center text-[10px] font-bold text-pink-800 bg-pink-100 border border-pink-300 px-1.5 py-0.5 rounded"
                      style={{ wordBreak: 'break-word' }}
                    >
                      📌 {item.anotacoes}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No results from search */}
      {searchTerm.trim() && processedItems.length === 0 && (
        <div className="text-center py-3 text-xs text-slate-400">
          Nenhum resultado para "{searchTerm}"
        </div>
      )}

      {/* Expand/collapse */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors py-1 rounded hover:bg-slate-100"
        >
          {expanded ? (
            <><ChevronUp className="w-4 h-4" />Recolher</>
          ) : (
            <><ChevronDown className="w-4 h-4" />+{processedItems.length - VISIBLE} mais</>
          )}
        </button>
      )}


    </div>
  );
}

/* ---- Top List ---- */
function TopList({ items, type }: { items: any[]; type: "fornecedor" | "cliente" }) {
  if (!items || items.length === 0) return <p className="text-sm text-slate-400 text-center py-4">Sem dados</p>;

  const maxVal = Math.max(...items.map((i) => i.totalEmAberto));

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const valor = item.totalEmAberto;
        const pct = maxVal > 0 ? (valor / maxVal) * 100 : 0;
        const name = type === "fornecedor" ? item.fornecedor : item.cliente;

        return (
          <div key={idx} className="relative">
            <div className="flex items-center justify-between text-sm py-1.5 px-2 relative z-10">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}</span>
                <span className="text-slate-700 truncate">{name}</span>
              </div>
              <span className="font-semibold text-slate-800 whitespace-nowrap ml-2">{formatCurrency(valor)}</span>
            </div>
            <div
              className={`absolute inset-y-0 left-0 ${type === "fornecedor" ? "bg-red-50" : "bg-teal-50"} rounded`}
              style={{ width: `${pct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ---- Main Tab Type ---- */
// Sem abas - tudo na mesma página

/* ---- Contas a Pagar Table ---- */
function ContasAPagarTable() {
  const [estado, setEstado] = useState<string>("EMITIDO");
  const [period, setPeriod] = useState<PeriodKey>("60dias");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const dates = useMemo(() => getPeriodDates(period), [period]);

  const { data, isLoading } = trpc.financial.getContasAPagar.useQuery({
    estado: estado || undefined,
    dateFrom: dates.from,
    dateTo: dates.to,
    limit: pageSize,
    offset: page * pageSize,
    sortBy: "vencimentoData",
    sortDir: "asc",
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalValor = (data as any)?.totalValor || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Period filter + status filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
          {([
            { value: "mes_corrente" as PeriodKey, label: "Mes Corrente" },
            { value: "proximo_mes" as PeriodKey, label: "Proximo Mes" },
            { value: "60dias" as PeriodKey, label: "Prox. 60 dias" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setPeriod(opt.value); setPage(0); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === opt.value
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
          {[
            { value: "EMITIDO", label: "Em Aberto" },
            { value: "PAGO", label: "Pagas" },
            { value: "", label: "Todas" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setEstado(opt.value); setPage(0); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                estado === opt.value
                  ? "bg-teal-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-500">{dates.label}</span>
        <span className="text-slate-400">|</span>
        <span className="font-semibold text-slate-700">{total} contas</span>
        <span className="text-slate-400">|</span>
        <span className="font-bold text-slate-800">{formatCurrency(totalValor)}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fornecedor</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Referente a</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-amber-600 uppercase tracking-wider">Anotações</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vencimento</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Prazo</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Parcela</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item: any, idx: number) => {
                const isOverdue = daysUntil(item.vencimentoData) !== null && daysUntil(item.vencimentoData)! < 0 && item.estado === "EMITIDO";
                return (
                  <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isOverdue ? "bg-red-50/50" : ""}`}>
                    <td className="px-3 py-2.5">
                    <span className="text-sm font-medium text-slate-800">{item.fornecedor || item.referenteA || item.observacoes || "—"}</span>                  </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-500 truncate block max-w-[200px]">{item.referenteA || "—"}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {item.anotacoes ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded max-w-[200px] truncate" title={item.anotacoes}>
                          {item.anotacoes}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm font-semibold text-slate-800">
                        {item.estado === "PAGO" ? formatCurrency(Number(item.valorPagoLiquido) || 0) : formatCurrency(Number(item.valorLiquido) || 0)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-slate-600">{formatDate(item.vencimentoData)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {item.estado === "EMITIDO" ? <DueBadge dateStr={item.vencimentoData} /> : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <EstadoBadge estado={item.estado} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-500">
                        {item.parcela && item.parcelasQuantidadeTotal ? `${item.parcela}/${item.parcelasQuantidadeTotal}` : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {items.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma conta encontrada neste periodo</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="text-xs text-slate-500">Pagina {page + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Proxima</Button>
        </div>
      )}
    </div>
  );
}

/* ---- Contas a Receber Table ---- */
function ContasAReceberTable() {
  const [estado, setEstado] = useState<string>("EMITIDO");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading } = trpc.financial.getContasAReceber.useQuery({
    estado: estado || undefined,
    limit: pageSize,
    offset: page * pageSize,
    sortBy: "vencimentoData",
    sortDir: "asc",
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
          {[
            { value: "EMITIDO", label: "Em Aberto" },
            { value: "RECEBIDO", label: "Recebidas" },
            { value: "", label: "Todas" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setEstado(opt.value); setPage(0); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                estado === opt.value
                  ? "bg-teal-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">{total} registros</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Referente a</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-amber-600 uppercase tracking-wider">Anotações</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vencimento</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Prazo</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Parcela</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item: any, idx: number) => {
                const isOverdue = daysUntil(item.vencimentoData) !== null && daysUntil(item.vencimentoData)! < 0 && item.estado === "EMITIDO";
                return (
                  <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isOverdue ? "bg-red-50/50" : ""}`}>
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-medium text-slate-800">{item.cliente || "—"}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-500 truncate block max-w-[200px]">{item.referenteA || "—"}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {item.anotacoes ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded max-w-[200px] truncate" title={item.anotacoes}>
                          {item.anotacoes}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm font-semibold text-slate-800">
                        {item.estado === "RECEBIDO" ? formatCurrency(Number(item.valorRecebidoLiquido) || 0) : formatCurrency(Number(item.valorLiquido) || 0)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-slate-600">{formatDate(item.vencimentoData)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {item.estado === "EMITIDO" ? <DueBadge dateStr={item.vencimentoData} /> : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <EstadoBadge estado={item.estado} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-500">
                        {item.parcela && item.parcelasQuantidadeTotal ? `${item.parcela}/${item.parcelasQuantidadeTotal}` : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {items.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Banknote className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma conta encontrada</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="text-xs text-slate-500">Pagina {page + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Proxima</Button>
        </div>
      )}
    </div>
  );
}

/* ---- Week colors for alternating ---- */
const weekColors = [
  { border: "border-blue-300 bg-blue-50", text: "text-blue-700" },
  { border: "border-teal-300 bg-teal-50", text: "text-teal-700" },
  { border: "border-emerald-300 bg-emerald-50", text: "text-emerald-700" },
  { border: "border-cyan-300 bg-cyan-50", text: "text-cyan-700" },
  { border: "border-indigo-300 bg-indigo-50", text: "text-indigo-700" },
  { border: "border-violet-300 bg-violet-50", text: "text-violet-700" },
  { border: "border-slate-300 bg-slate-50", text: "text-slate-700" },
  { border: "border-slate-200 bg-white", text: "text-slate-600" },
];

/* ---- Overview Contas a Receber Mini Table ---- */
function OverviewReceberTable() {
  const dates = useMemo(() => getPeriodDates("60dias"), []);

  const { data, isLoading } = trpc.financial.getContasAReceber.useQuery({
    estado: "EMITIDO",
    dateFrom: dates.from,
    dateTo: dates.to,
    limit: 50,
    offset: 0,
    sortBy: "vencimentoData",
    sortDir: "asc",
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalValor = (data as any)?.totalValor || 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold text-slate-700">{total} contas</span>
        <span className="text-slate-400">|</span>
        <span className="font-bold text-emerald-700">{formatCurrency(totalValor)}</span>
      </div>
      <div className="overflow-y-auto max-h-[400px]">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Cliente</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Valor</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Venc.</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Prazo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item: any, idx: number) => {
              const isOverdue = daysUntil(item.vencimentoData) !== null && daysUntil(item.vencimentoData)! < 0;
              return (
                <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isOverdue ? "bg-red-50/50" : ""}`}>
                  <td className="px-2 py-2">
                    <span className="text-xs font-medium text-slate-800 truncate block max-w-[180px]">{item.cliente || "—"}</span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className="text-xs font-semibold text-slate-800">{formatCurrency(Number(item.valorLiquido) || 0)}</span>
                  </td>
                  <td className="px-2 py-2">
                    <span className="text-xs text-slate-600">{formatDate(item.vencimentoData)}</span>
                  </td>
                  <td className="px-2 py-2">
                    <DueBadge dateStr={item.vencimentoData} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {items.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <Banknote className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Nenhuma conta a receber nos proximos 60 dias</p>
        </div>
      )}
      {total > 50 && <p className="text-xs text-slate-400 text-center">Mostrando 50 de {total} contas</p>}
    </div>
  );
}

/* ---- Overview Calendars Side by Side ---- */
function OverviewCalendars({ calendarPagar, loadingPagar, canAuthorize = true, canComment = true, canViewPagar = true, canViewReceber = true }: {
  calendarPagar: any;
  loadingPagar: boolean;
  canAuthorize?: boolean;
  canComment?: boolean;
  canViewPagar?: boolean;
  canViewReceber?: boolean;
}) {
  const { data: calendarReceber, isLoading: loadingReceber } = trpc.financial.getReceivableCalendar.useQuery();
  const [showHistoryPagar, setShowHistoryPagar] = useState(false);
  const [showHistoryReceber, setShowHistoryReceber] = useState(false);

  const isLoading = loadingPagar || loadingReceber;

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  // Build paired rows: vencidas + 8 weeks
  const rows: { label: string; receber: any; pagar: any; colorIdx: number }[] = [];

  // Row 0: Vencidas (até 3 dias)
  rows.push({
    label: "Vencidas (até 3 dias)",
    receber: calendarReceber?.vencidas || { label: "Vencidas (até 3 dias)", total: 0, count: 0, items: [] },
    pagar: calendarPagar?.vencidas || { label: "Vencidas", total: 0, count: 0, items: [] },
    colorIdx: -1,
  });

  // Rows 1-8: weeks
  const maxWeeks = Math.max(calendarReceber?.weeks?.length || 0, calendarPagar?.weeks?.length || 0);
  for (let i = 0; i < maxWeeks; i++) {
    const rWeek = calendarReceber?.weeks?.[i] || { label: `Semana ${i + 1}`, total: 0, count: 0, items: [] };
    const pWeek = calendarPagar?.weeks?.[i] || { label: `Semana ${i + 1}`, total: 0, count: 0, items: [] };
    rows.push({
      label: rWeek.label || pWeek.label,
      receber: rWeek,
      pagar: pWeek,
      colorIdx: i,
    });
  }

  return (
    <div className="space-y-6">
      {/* Calendar comparison header */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-emerald-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Recebimentos
            </h3>
            <button
              onClick={() => setShowHistoryReceber(!showHistoryReceber)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                showHistoryReceber
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Histórico Completo
            </button>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-red-700 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Pagamentos
            </h3>
            <button
              onClick={() => setShowHistoryPagar(!showHistoryPagar)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                showHistoryPagar
                  ? "bg-red-600 text-white shadow-sm"
                  : "bg-white text-red-700 border border-red-300 hover:bg-red-100"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Histórico Completo
            </button>
          </div>
        </div>
      </div>

      {/* History panels */}
      {(showHistoryReceber || showHistoryPagar) && (
        <div className="grid grid-cols-2 gap-4">
          {showHistoryReceber ? (
            <FinancialHistoryPanel tipo="receber" onClose={() => setShowHistoryReceber(false)} />
          ) : <div />}
          {showHistoryPagar ? (
            <FinancialHistoryPanel tipo="pagar" onClose={() => setShowHistoryPagar(false)} />
          ) : <div />}
        </div>
      )}

      {/* Paired rows */}
      {rows.map((row, idx) => {
        const isVencida = row.colorIdx === -1;
        const color = isVencida
          ? { border: "border-red-300 bg-red-50", text: "text-red-700" }
          : weekColors[row.colorIdx % weekColors.length];

        return (
          <React.Fragment key={idx}>
            <div className="grid grid-cols-2 gap-4">
              {canViewReceber && <BucketCard
                bucket={{ ...row.receber, label: row.label }}
                colorClass={isVencida ? "border-emerald-300 bg-emerald-50" : `border-emerald-200 bg-emerald-50/50`}
                textColorClass={isVencida ? "text-emerald-700" : "text-emerald-700"}
              />}
              {canViewPagar && <BucketCard
                bucket={{ ...row.pagar, label: row.label }}
                colorClass={isVencida ? "border-red-300 bg-red-50" : `border-red-200 bg-red-50/50`}
                textColorClass={isVencida ? "text-red-700" : "text-red-700"}
                isPagar
                canAuthorize={canAuthorize}
                canComment={canComment}
              />}
            </div>
            {/* Card de Conciliação após a primeira semana (idx=1, pois idx=0 é Vencidas) */}
            {idx === 1 && <WeekReconciliationCard />}
          </React.Fragment>
        );
      })}


    </div>
  );
}

/* ---- Bank Balance Card ---- */
type BankPeriodPreset = "mes_atual" | "mes_anterior";

function getBankPeriodDates(preset: BankPeriodPreset): { start: string; end: string } {
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const today = `${curY}-${String(curM).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  switch (preset) {
    case "mes_atual": {
      const start = `${curY}-${String(curM).padStart(2, '0')}-01`;
      return { start, end: today };
    }
    case "mes_anterior": {
      const prevDate = new Date(curY, curM - 2, 1);
      const prevY = prevDate.getFullYear();
      const prevM = prevDate.getMonth() + 1;
      const lastDay = new Date(prevY, prevM, 0).getDate();
      return {
        start: `${prevY}-${String(prevM).padStart(2, '0')}-01`,
        end: `${prevY}-${String(prevM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      };
    }
  }
}

function BankBalanceCard() {
  const [bankPeriod, setBankPeriod] = useState<BankPeriodPreset>("mes_atual");
  const bankDates = useMemo(() => getBankPeriodDates(bankPeriod), [bankPeriod]);
  const { data, isLoading } = trpc.financial.getBankBalancesDetailed.useQuery(
    { startDate: bankDates.start, endDate: bankDates.end }
  );
  const [collapsed, setCollapsed] = useState(true);
  const { data: reconStatus, refetch: refetchRecon } = trpc.financial.getBankReconciliationStatus.useQuery();
  const setReconMutation = trpc.financial.setBankReconciliation.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        refetchRecon();
        setShowPasswordDialog(false);
        setPasswordInput("");
        setPasswordError("");
      } else {
        setPasswordError(res.error || "Erro desconhecido");
      }
    },
  });
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const fmt = (v: number) => {
    const abs = Math.abs(v);
    const formatted = abs.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if (v < 0) return formatted.replace("R$", "R$ -");
    return formatted;
  };

  const fmtShort = (v: number) =>
    Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando saldos bancários...</span>
        </div>
      </div>
    );
  }

  if (!data || data.accounts.length === 0) return null;

  // Recalcular variação no frontend: Saldo Atual - Saldo Inicial
  const accountsWithVariacao = data.accounts.map(a => ({
    ...a,
    variacao: Math.round((a.saldoAtual - a.saldoInicial) * 100) / 100,
  }));

  // Filter out accounts with zero everywhere
  const activeAccounts = accountsWithVariacao.filter(
    a => a.saldoInicial !== 0 || a.saldoAtual !== 0 || a.variacao !== 0
  );

  // Recalcular totais
  const totalVariacao = Math.round(activeAccounts.reduce((sum, a) => sum + a.variacao, 0) * 100) / 100;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Landmark className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-slate-800 text-sm">Saldo Bancário</h3>
            <p className="text-xs text-slate-500">
              {activeAccounts.length} contas | {data.periodLabel}
            </p>
          </div>
          {/* Period filter */}
          <div className="ml-3 flex gap-1 bg-slate-100 rounded-md p-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setBankPeriod("mes_atual")}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                bankPeriod === "mes_atual"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Mês Atual
            </button>
            <button
              onClick={() => setBankPeriod("mes_anterior")}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                bankPeriod === "mes_anterior"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Mês Anterior
            </button>
          </div>
          {/* Checkbox Conciliação Feita */}
          <div
            className={`ml-4 flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
              reconStatus?.reconciled
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (reconStatus?.reconciled) return; // já marcado hoje
              setShowPasswordDialog(true);
            }}
            title={reconStatus?.reconciled ? `Conciliado por ${reconStatus.reconciledBy}` : "Clique para marcar conciliação"}
          >
            {reconStatus?.reconciled ? (
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span className="text-xs font-medium whitespace-nowrap">
              {reconStatus?.reconciled ? "Conciliação Feita" : "Conciliação Feita"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-tight">Saldo Atual</p>
            <span className={`text-sm font-bold tabular-nums ${
              data.totalSaldoAtual >= 0 ? "text-emerald-600" : "text-red-600"
            }`}>
              {fmt(data.totalSaldoAtual)}
            </span>
          </div>
          {collapsed ? (
            <ChevronDown className="w-5 h-5 text-slate-400 ml-1" />
          ) : (
            <ChevronUp className="w-5 h-5 text-slate-400 ml-1" />
          )}
        </div>
      </button>

      {/* Content - Table */}
      {!collapsed && (
        <div className="border-t border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide">Conta Bancária</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide">Saldo Inicial</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide">Saldo Atual</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide">Variação</th>
                </tr>
              </thead>
              <tbody>
                {activeAccounts.map((acc, idx) => (
                  <tr key={acc.codigoEstruturado} className={`border-b border-slate-50 ${
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  } hover:bg-indigo-50/30 transition-colors`}>
                    <td className="py-2 px-4 font-medium text-slate-700">{acc.descricao}</td>
                    <td className={`py-2 px-4 text-right tabular-nums ${acc.saldoInicial < 0 ? "text-red-600" : "text-slate-600"}`}>
                      {acc.saldoInicial < 0 ? "R$ -" : "R$ "}{fmtShort(acc.saldoInicial)}
                    </td>
                    <td className={`py-2 px-4 text-right tabular-nums font-semibold ${
                      acc.saldoAtual >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {acc.saldoAtual < 0 ? "R$ -" : "R$ "}{fmtShort(acc.saldoAtual)}
                    </td>
                    {(() => { const v = acc.saldoAtual - acc.saldoInicial; return (
                    <td className={`py-2 px-4 text-right tabular-nums ${
                      v > 0 ? "text-emerald-600" : v < 0 ? "text-red-600" : "text-slate-500"
                    }`}>
                      {v > 0 ? "+R$ " : v < 0 ? "-R$ " : "R$ "}{fmtShort(v)}
                    </td>
                    ); })()}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                  <td className="py-2.5 px-4 text-slate-800">TOTAL</td>
                  <td className={`py-2.5 px-4 text-right tabular-nums ${data.totalSaldoInicial < 0 ? "text-red-700" : "text-slate-800"}`}>
                    {data.totalSaldoInicial < 0 ? "R$ -" : "R$ "}{fmtShort(data.totalSaldoInicial)}
                  </td>
                  <td className={`py-2.5 px-4 text-right tabular-nums ${
                    data.totalSaldoAtual >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}>
                    {data.totalSaldoAtual < 0 ? "R$ -" : "R$ "}{fmtShort(data.totalSaldoAtual)}
                  </td>
                  {(() => { const tv = data.totalSaldoAtual - data.totalSaldoInicial; return (
                  <td className={`py-2.5 px-4 text-right tabular-nums ${
                    tv > 0 ? "text-emerald-700" : tv < 0 ? "text-red-700" : "text-slate-600"
                  }`}>
                    {tv > 0 ? "+R$ " : tv < 0 ? "-R$ " : "R$ "}{fmtShort(tv)}
                  </td>
                  ); })()}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Dialog de senha para conciliação */}
      {showPasswordDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowPasswordDialog(false); setPasswordInput(""); setPasswordError(""); }}>
          <div className="bg-white rounded-lg p-6 w-80 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-slate-800 mb-2">Confirmar Conciliação</h4>
            <p className="text-sm text-slate-500 mb-4">Digite a senha para marcar a conciliação como feita.</p>
            <input
              type="password"
              placeholder="Senha"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && passwordInput) {
                  setReconMutation.mutate({ password: passwordInput, reconciled: true });
                }
              }}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              autoFocus
            />
            {passwordError && <p className="text-xs text-red-500 mb-2">{passwordError}</p>}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setShowPasswordDialog(false); setPasswordInput(""); setPasswordError(""); }}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (passwordInput) {
                    setReconMutation.mutate({ password: passwordInput, reconciled: true });
                  }
                }}
                disabled={!passwordInput || setReconMutation.isPending}
                className="flex-1 px-3 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {setReconMutation.isPending ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Cash Flow Chart Card ---- */
function CashFlowCard() {
  const { data, isLoading } = trpc.financial.getCashFlowChart.useQuery();
  const [collapsed, setCollapsed] = useState(true);
  const [hoveredBar, setHoveredBar] = useState<{ x: number; y: number; text: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      </div>
    );
  }

  if (!data) return null;

  const { vencidas, weeks } = data;

  // Calcular totais para o header
  const totalReceber = vencidas.recebimentos + weeks.reduce((s: number, w: any) => s + w.recebimentos, 0);
  const totalPagar = vencidas.pagamentos + weeks.reduce((s: number, w: any) => s + w.pagamentos, 0);
  const saldoTotal = totalReceber - totalPagar;

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 300;
  const paddingLeft = 70;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 45;
  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = svgHeight - paddingTop - paddingBottom;

  // Fixed scale: -1M to +1M, zero in the center
  const fixedMax = 1_000_000;
  const yMin = -fixedMax;
  const yMax = fixedMax;
  const yRange = yMax - yMin; // 2M

  // Map value to Y coordinate (zero is exactly at center)
  const valToY = (val: number) => paddingTop + chartH - ((val - yMin) / yRange) * chartH;
  const zeroY = valToY(0); // center of chart

  const barGroupWidth = chartW / weeks.length;

  // Saldo points
  const saldoPoints = weeks.map((w: any, i: number) => {
    const x = paddingLeft + i * barGroupWidth + barGroupWidth / 2;
    const clamped = Math.max(yMin, Math.min(yMax, w.saldoAcumulado));
    const y = valToY(clamped);
    return { x, y, value: w.saldoAcumulado };
  });

  const saldoLinePath = saldoPoints.map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Grid lines: -1M, -500K, 0, +500K, +1M
  const gridLines: { y: number; val: number }[] = [
    { y: valToY(1_000_000), val: 1_000_000 },
    { y: valToY(500_000), val: 500_000 },
    { y: valToY(0), val: 0 },
    { y: valToY(-500_000), val: -500_000 },
    { y: valToY(-1_000_000), val: -1_000_000 },
  ];

  // Format short value for labels
  const fmtShort = (v: number) => {
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
    return v.toFixed(0);
  };

  return (
    <div className="bg-white rounded-lg border border-blue-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="bg-blue-50 border-b border-blue-200 cursor-pointer hover:bg-blue-100/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-blue-700">Fluxo de Caixa</h3>
            <span className="text-[10px] text-blue-500 ml-1">8 semanas</span>
            {collapsed ? <ChevronDown className="w-5 h-5 text-blue-600 ml-1" /> : <ChevronUp className="w-5 h-5 text-blue-600 ml-1" />}
          </div>
          {!collapsed && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${saldoTotal >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              Saldo: {formatCurrency(saldoTotal)}
            </span>
          )}
        </div>
        {/* Collapsed preview - sophisticated summary */}
        {collapsed && (
          <div className="px-4 pb-3 pt-0">
            <div className="grid grid-cols-3 gap-2">
              {/* A Receber mini card */}
              <div className="bg-white/80 border border-emerald-200/60 rounded-lg px-3 py-2 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">A Receber</p>
                  <p className="text-base font-bold text-emerald-700 tabular-nums truncate">{formatCurrency(totalReceber)}</p>
                  <p className="text-[9px] text-slate-400">8 semanas + vencidas</p>
                </div>
              </div>
              {/* A Pagar mini card */}
              <div className="bg-white/80 border border-red-200/60 rounded-lg px-3 py-2 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">A Pagar</p>
                  <p className="text-base font-bold text-red-700 tabular-nums truncate">{formatCurrency(totalPagar)}</p>
                  <p className="text-[9px] text-slate-400">8 semanas + vencidas</p>
                </div>
              </div>
              {/* Saldo Projetado mini card */}
              <div className={`bg-white/80 border ${saldoTotal >= 0 ? "border-blue-200/60" : "border-amber-200/60"} rounded-lg px-3 py-2 flex items-center gap-2.5`}>
                <div className={`w-7 h-7 rounded-full ${saldoTotal >= 0 ? "bg-blue-100" : "bg-amber-100"} flex items-center justify-center flex-shrink-0`}>
                  <Wallet className={`w-3.5 h-3.5 ${saldoTotal >= 0 ? "text-blue-600" : "text-amber-600"}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[10px] font-semibold ${saldoTotal >= 0 ? "text-blue-600" : "text-amber-600"} uppercase tracking-wider`}>Saldo</p>
                  <p className={`text-base font-bold tabular-nums truncate ${saldoTotal >= 0 ? "text-blue-700" : "text-red-700"}`}>{formatCurrency(saldoTotal)}</p>
                  <p className="text-[9px] text-slate-400">Receber - Pagar</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="p-4">
          {/* Summary Cards - Receber / Pagar / Saldo */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {/* A Receber */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3.5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">A Receber</span>
              </div>
              <p className="text-lg font-bold text-emerald-700 tabular-nums">{formatCurrency(totalReceber)}</p>
              <p className="text-[9px] text-slate-500 mt-1 leading-tight">Total de contas a receber nas proximas 8 semanas (incluindo vencidas)</p>
            </div>
            {/* A Pagar */}
            <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-3.5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                  <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                </div>
                <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">A Pagar</span>
              </div>
              <p className="text-lg font-bold text-red-700 tabular-nums">{formatCurrency(totalPagar)}</p>
              <p className="text-[9px] text-slate-500 mt-1 leading-tight">Total de contas a pagar nas proximas 8 semanas (incluindo vencidas)</p>
            </div>
            {/* Saldo */}
            <div className={`bg-gradient-to-br ${saldoTotal >= 0 ? "from-blue-50 to-indigo-50 border-blue-200" : "from-amber-50 to-orange-50 border-amber-200"} border rounded-xl p-3.5 shadow-sm`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-6 h-6 rounded-full ${saldoTotal >= 0 ? "bg-blue-100" : "bg-amber-100"} flex items-center justify-center`}>
                  <Wallet className={`w-3.5 h-3.5 ${saldoTotal >= 0 ? "text-blue-600" : "text-amber-600"}`} />
                </div>
                <span className={`text-[10px] font-semibold ${saldoTotal >= 0 ? "text-blue-600" : "text-amber-600"} uppercase tracking-wider`}>Saldo Projetado</span>
              </div>
              <p className={`text-lg font-bold tabular-nums ${saldoTotal >= 0 ? "text-blue-700" : "text-red-700"}`}>{formatCurrency(saldoTotal)}</p>
              <p className="text-[9px] text-slate-500 mt-1 leading-tight">{saldoTotal >= 0 ? "Recebimentos cobrem os pagamentos no periodo" : "Pagamentos excedem os recebimentos no periodo"} (Receber - Pagar)</p>
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-5 mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-blue-500 rounded" />
              <span className="text-slate-600">Saldo Acumulado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-slate-600">Positivo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-600">Negativo</span>
            </div>
          </div>

          {/* Chart SVG */}
          <svg ref={svgRef} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
            {/* Grid lines */}
            {gridLines.map((line, i) => (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={line.y}
                  x2={svgWidth - paddingRight}
                  y2={line.y}
                  stroke={line.val === 0 ? "#475569" : "#e2e8f0"}
                  strokeWidth={line.val === 0 ? "1.2" : "0.5"}
                  strokeDasharray={line.val === 0 ? "none" : "4,3"}
                />
                <text x={paddingLeft - 8} y={line.y + 3} textAnchor="end" fill="#94a3b8" fontSize="8" fontFamily="system-ui">
                  {fmtShort(line.val)}
                </text>
              </g>
            ))}

            {/* Vertical bars for receber/pagar - wider and stronger color with tooltips */}
            {weeks.map((w: any, i: number) => {
              const cx = paddingLeft + i * barGroupWidth + barGroupWidth / 2;
              const barW = 14;
              // Receber bar goes up from zero
              const receberH = w.recebimentos > 0 ? Math.max((w.recebimentos / yRange) * chartH, 2) : 0;
              // Pagar bar goes down from zero
              const pagarH = w.pagamentos > 0 ? Math.max((w.pagamentos / yRange) * chartH, 2) : 0;
              return (
                <g key={`bars-${i}`}>
                  {/* Receber - bar up from zero */}
                  {receberH > 0 && (
                    <rect
                      x={cx - barW - 2}
                      y={zeroY - receberH}
                      width={barW}
                      height={receberH}
                      fill="#10b981"
                      opacity="0.45"
                      rx="2"
                      className="cursor-pointer hover:opacity-70 transition-opacity"
                      onMouseEnter={(e) => {
                        const svg = svgRef.current;
                        if (!svg) return;
                        const rect = svg.getBoundingClientRect();
                        const scaleX = svgWidth / rect.width;
                        const scaleY = svgHeight / rect.height;
                        const mx = (e.clientX - rect.left) * scaleX;
                        const my = (e.clientY - rect.top) * scaleY;
                        setHoveredBar({ x: mx, y: my - 14, text: `Receber: ${formatCurrency(w.recebimentos)}` });
                      }}
                      onMouseLeave={() => setHoveredBar(null)}
                    />
                  )}
                  {/* Pagar - bar down from zero */}
                  {pagarH > 0 && (
                    <rect
                      x={cx + 2}
                      y={zeroY}
                      width={barW}
                      height={pagarH}
                      fill="#ef4444"
                      opacity="0.45"
                      rx="2"
                      className="cursor-pointer hover:opacity-70 transition-opacity"
                      onMouseEnter={(e) => {
                        const svg = svgRef.current;
                        if (!svg) return;
                        const rect = svg.getBoundingClientRect();
                        const scaleX = svgWidth / rect.width;
                        const scaleY = svgHeight / rect.height;
                        const mx = (e.clientX - rect.left) * scaleX;
                        const my = (e.clientY - rect.top) * scaleY;
                        setHoveredBar({ x: mx, y: my + 16, text: `Pagar: ${formatCurrency(w.pagamentos)}` });
                      }}
                      onMouseLeave={() => setHoveredBar(null)}
                    />
                  )}
                </g>
              );
            })}

            {/* Saldo acumulado line */}
            <path d={saldoLinePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

            {/* Saldo dots with values */}
            {saldoPoints.map((p: any, i: number) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="5" fill={p.value >= 0 ? "#10b981" : "#ef4444"} stroke="white" strokeWidth="2" />
                <text
                  x={p.x}
                  y={p.value >= 0 ? p.y - 10 : p.y + 15}
                  textAnchor="middle"
                  fill={p.value >= 0 ? "#059669" : "#dc2626"}
                  fontSize="8"
                  fontWeight="700"
                  fontFamily="system-ui"
                >
                  {fmtShort(p.value)}
                </text>
              </g>
            ))}

            {/* Week labels + saldo semanal */}
            {weeks.map((w: any, i: number) => {
              const cx = paddingLeft + i * barGroupWidth + barGroupWidth / 2;
              return (
                <g key={`label-${i}`}>
                  <text
                    x={cx}
                    y={svgHeight - 6}
                    textAnchor="middle"
                    fill="#475569"
                    fontSize="8.5"
                    fontWeight="500"
                    fontFamily="system-ui"
                  >
                    {w.label}
                  </text>
                  <text
                    x={cx}
                    y={svgHeight - 19}
                    textAnchor="middle"
                    fill={w.saldo >= 0 ? "#059669" : "#dc2626"}
                    fontSize="7.5"
                    fontWeight="600"
                    fontFamily="system-ui"
                  >
                    {w.saldo >= 0 ? "+" : ""}{fmtShort(w.saldo)}
                  </text>
                </g>
              );
            })}

            {/* Hover tooltip */}
            {hoveredBar && (
              <g>
                <rect
                  x={hoveredBar.x - 70}
                  y={hoveredBar.y - 10}
                  width="140"
                  height="18"
                  rx="4"
                  fill="#1e293b"
                  opacity="0.9"
                />
                <text
                  x={hoveredBar.x}
                  y={hoveredBar.y + 3}
                  textAnchor="middle"
                  fill="white"
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="system-ui"
                >
                  {hoveredBar.text}
                </text>
              </g>
            )}
          </svg>

          {/* Weekly summary table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">Semana</th>
                  <th className="text-right py-2 px-2 text-emerald-600 font-medium">Receber</th>
                  <th className="text-right py-2 px-2 text-red-600 font-medium">Pagar</th>
                  <th className="text-right py-2 px-2 text-slate-600 font-medium">Saldo Sem.</th>
                  <th className="text-right py-2 px-2 text-blue-600 font-medium">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {vencidas.recebimentos > 0 || vencidas.pagamentos > 0 ? (
                  <tr className="border-b border-slate-100 bg-red-50/30">
                    <td className="py-1.5 px-2 font-medium text-red-700">Vencidas</td>
                    <td className="py-1.5 px-2 text-right text-emerald-700 font-semibold">{formatCurrency(vencidas.recebimentos)}</td>
                    <td className="py-1.5 px-2 text-right text-red-700 font-semibold">{formatCurrency(vencidas.pagamentos)}</td>
                    <td className={`py-1.5 px-2 text-right font-bold ${vencidas.saldo >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(vencidas.saldo)}</td>
                    <td className="py-1.5 px-2 text-right text-slate-400">—</td>
                  </tr>
                ) : null}
                {weeks.map((w: any, i: number) => (
                  <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                    <td className="py-1.5 px-2 font-medium text-slate-700">{w.label}</td>
                    <td className="py-1.5 px-2 text-right text-emerald-700">{formatCurrency(w.recebimentos)}</td>
                    <td className="py-1.5 px-2 text-right text-red-700">{formatCurrency(w.pagamentos)}</td>
                    <td className={`py-1.5 px-2 text-right font-semibold ${w.saldo >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(w.saldo)}</td>
                    <td className={`py-1.5 px-2 text-right font-bold ${w.saldoAcumulado >= 0 ? "text-blue-700" : "text-red-700"}`}>{formatCurrency(w.saldoAcumulado)}</td>
                  </tr>
                ))}
                {/* Total row */}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <td className="py-2 px-2 text-slate-800">TOTAL</td>
                  <td className="py-2 px-2 text-right text-emerald-700">{formatCurrency(totalReceber)}</td>
                  <td className="py-2 px-2 text-right text-red-700">{formatCurrency(totalPagar)}</td>
                  <td className={`py-2 px-2 text-right ${saldoTotal >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(saldoTotal)}</td>
                  <td className="py-2 px-2 text-right text-slate-400">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* MonthVerifyModal removed - replaced by MaxiprodAutoVerifier (auto-verification) */

/* ---- Main Financial Page ---- */
export default function Financial() {
  const { hasGranularAccess, operator } = useOperator();
  const canVerifyMaxiprod = operator && MAXIPROD_AUTHORIZED_OPERATORS.includes(operator.name);
  const ECOMMERCE_TAB_OPERATORS = ["Pedro", "Flavio", "Guilherme"];
  const canSeeEcommerce = operator && ECOMMERCE_TAB_OPERATORS.includes(operator.name);
  const [activeTab, setActiveTab] = useState<"visao-geral" | "inadimplencia" | "recebiveis" | "ecommerce">("visao-geral");
  let discountAlerts: ReturnType<typeof useDiscountAlerts> | null = null;
  try { discountAlerts = useDiscountAlerts(); } catch { /* not in provider */ }
  const recebiveisBlinking = discountAlerts?.isAlertOperator && discountAlerts.blinkLevel === "recebiveis-tab" && discountAlerts.unreadCount > 0;
  const [verifyingMonth, setVerifyingMonth] = useState<{ label: string; type: "receber" | "pagar"; from: string; to: string; total: number } | null>(null);
  const [showTotalReceberSim, setShowTotalReceberSim] = useState(false);
  const [showTotalPagarSim, setShowTotalPagarSim] = useState(false);
  const { data: summary, isLoading: loadingSummary } = trpc.financial.getSummary.useQuery(undefined, { refetchInterval: 60000 });
  const { data: calendarData, isLoading: loadingCalendar } = trpc.financial.getPaymentCalendar.useQuery(undefined, { refetchInterval: 60000 });
  const { data: monthlyData, isLoading: loadingMonthly } = trpc.financial.getMonthlyBreakdown.useQuery(undefined, { refetchInterval: 60000 });

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);


  const [showCharts, setShowCharts] = useState(false);
  const showReceberChart = showCharts;
  const showPagarChart = showCharts;

  // Calcular dateFrom/dateTo do mês selecionado
  // Regra: mês corrente começa a partir de HOJE (contas que faltam), meses futuros do dia 1
  const monthRange = useMemo(() => {
    if (!selectedMonth || !monthlyData) return null;
    const idx = monthlyData.findIndex(m => m.label === selectedMonth);
    if (idx === -1) return null;
    const now = new Date();
    const targetMonth = new Date(now.getFullYear(), now.getMonth() + idx, 1);
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    
    // Se é o mês corrente (idx === 0), começa a partir de hoje
    const isCurrentMonth = idx === 0;
    const fromDay = isCurrentMonth
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
      : `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, "0")}-01`;
    
    return {
      from: fromDay,
      to: `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`,
    };
  }, [selectedMonth, monthlyData]);

  const { data: monthPagar, isLoading: loadingMonthPagar } = trpc.financial.getContasAPagar.useQuery(
    { estado: "EMITIDO", dateFrom: monthRange?.from, dateTo: monthRange?.to, limit: 500, sortBy: "vencimentoData", sortDir: "asc" },
    { enabled: !!monthRange }
  );
  const { data: monthReceber, isLoading: loadingMonthReceber } = trpc.financial.getContasAReceber.useQuery(
    { estado: "EMITIDO", dateFrom: monthRange?.from, dateTo: monthRange?.to, limit: 500, sortBy: "vencimentoData", sortDir: "asc" },
    { enabled: !!monthRange }
  );

  const isLoading = loadingSummary;
  const hasData = summary && (summary.pagar.emAberto.count > 0 || summary.receber.emAberto.count > 0 || summary.pagar.pagas.count > 0 || summary.receber.recebidas.count > 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <main className="container py-6 space-y-6">
        {/* Título elegante */}
        <div className="text-center py-2">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            <span className="text-slate-700">Dashboard de Análise Financeira</span>
            <span className="text-teal-600 ml-2">Grupo Fox</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1.5 tracking-widest uppercase">Contas a Pagar e Receber</p>
        </div>

        {/* Sub-abas */}
        <div className="flex items-center justify-center gap-1 bg-white rounded-lg border border-slate-200 shadow-sm p-1">
          <button
            onClick={() => setActiveTab("visao-geral")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "visao-geral"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab("inadimplencia")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "inadimplencia"
                ? "bg-red-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Inadimplência
            {summary && summary.receber.vencidas.count > 0 && (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] ml-1">
                {summary.receber.vencidas.count}
              </Badge>
            )}
          </button>
          <button
            onClick={() => {
              if (recebiveisBlinking && discountAlerts) {
                discountAlerts.advanceBlink("recebiveis-tab");
              }
              setActiveTab("recebiveis");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "recebiveis"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            } ${recebiveisBlinking ? "animate-discount-blink" : ""}`}
          >
            <Landmark className="w-4 h-4" />
            Recebíveis
            {recebiveisBlinking && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
            )}
          </button>
          {canSeeEcommerce && (
            <button
              onClick={() => setActiveTab("ecommerce")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "ecommerce"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              E-commerce
            </button>
          )}
        </div>

        {/* Tab: Inadimplência */}
        {activeTab === "inadimplencia" && <InadimplenciaTab />}

        {/* Tab: Recebíveis */}
        {activeTab === "recebiveis" && <ReceivablesTab />}

        {/* Tab: E-commerce */}
        {activeTab === "ecommerce" && canSeeEcommerce && <EcommerceTab />}

        {/* Tab: Visão Geral */}
        {activeTab === "visao-geral" && (
        isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-teal-500 mb-3" />
            <p className="text-sm text-slate-500">Carregando dados financeiros...</p>
          </div>
        ) : !hasData ? (
          <div className="text-center py-20">
            <DollarSign className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h2 className="text-lg font-semibold text-slate-600 mb-2">Sem dados financeiros</h2>
            <p className="text-sm text-slate-400">Clique em Sincronizar na aba Estoque para importar os dados do Maxiprod.</p>
          </div>
        ) : (
          <>
            {/* Verificação automática Maxiprod para mês específico */}
            {verifyingMonth && (
              <MaxiprodAutoVerifier
                title={verifyingMonth.type === "receber" ? "A Receber" : "A Pagar"}
                subtitle={`Conferencia automatica — ${verifyingMonth.label}`}
                section={verifyingMonth.type === "receber" ? "contas_receber_mes" : "contas_pagar_mes"}
                startDate={verifyingMonth.from}
                endDate={verifyingMonth.to}
                valorManus={verifyingMonth.total}
                onClose={() => setVerifyingMonth(null)}
              />
            )}
            {/* Verificação automática Maxiprod para total geral A Receber */}
            {showTotalReceberSim && (
              <MaxiprodAutoVerifier
                title="Total A Receber"
                subtitle="Conferencia automatica do total geral de contas a receber"
                section="contas_receber_mes"
                startDate="2020-01-01"
                endDate="2099-12-31"
                valorManus={monthlyData ? monthlyData.reduce((s, m) => s + m.receber.total, 0) : (summary?.receber.emAberto.total ?? 0)}
                onClose={() => setShowTotalReceberSim(false)}
              />
            )}
            {/* Verificação automática Maxiprod para total geral A Pagar */}
            {showTotalPagarSim && (
              <MaxiprodAutoVerifier
                title="Total A Pagar"
                subtitle="Conferencia automatica do total geral de contas a pagar"
                section="contas_pagar_mes"
                startDate="2020-01-01"
                endDate="2099-12-31"
                valorManus={monthlyData ? monthlyData.reduce((s, m) => s + m.pagar.total, 0) : (summary?.pagar.emAberto.total ?? 0)}
                onClose={() => setShowTotalPagarSim(false)}
              />
            )}
            <ConnectionStatusCard />



            {/* Resumo Financeiro (Faturamento + Vendas vs Contas Pagas) */}
            {hasGranularAccess("fin.verResumoFinanceiro") && <ResumoFinanceiroCard />}

            {/* Cards mensais lado a lado: A Receber vs A Pagar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* A Receber */}
              {hasGranularAccess("fin.verContasReceber") && <div className="bg-white rounded-lg border border-emerald-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowCharts(!showCharts)}
                  className="w-full bg-emerald-50 border-b border-emerald-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-emerald-100 transition-colors"
                >
                  <h3 className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    A Receber
                    {showReceberChart ? <ChevronUp className="w-5 h-5 text-emerald-600" /> : <ChevronDown className="w-5 h-5 text-emerald-600" />}
                  </h3>
                  <span className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                    Total: {formatCurrency(monthlyData ? monthlyData.reduce((s, m) => s + m.receber.total, 0) : (summary!.receber.emAberto.total))}
                    {canVerifyMaxiprod && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowTotalReceberSim(true); }}
                        className="p-1 rounded-full hover:bg-emerald-200 transition-colors" title="Conferir total no Maxiprod"
                      >
                        <Eye className="w-4 h-4 text-emerald-600" />
                      </button>
                    )}
                  </span>
                </button>
                {showReceberChart && (
                  <div className="p-4 space-y-1.5">
                    {loadingMonthly ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                    ) : monthlyData?.map((m, idx) => {
                      const maxTotal = Math.max(...(monthlyData || []).map(x => x.receber.total), 1);
                      const pct = (m.receber.total / maxTotal) * 100;
                      const isSelected = selectedMonth === m.label;
                      return (
                        <div key={idx}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedMonth(isSelected ? null : m.label); }}
                            className={`w-full flex items-center gap-3 py-1 px-2 rounded-md transition-colors cursor-pointer ${
                              isSelected ? "bg-emerald-100 ring-1 ring-emerald-300" : "hover:bg-emerald-50/50"
                            }`}
                          >
                            <span className="text-xs font-medium text-slate-500 w-20 shrink-0 text-left">{m.label}</span>
                            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative">
                              <div
                                className="h-full bg-emerald-400 rounded-full transition-all"
                                style={{ width: `${Math.max(pct, 1)}%` }}
                              />
                            </div>
                            <div className="text-right shrink-0 w-36">
                              <span className="text-xs font-bold text-slate-800">{formatCurrency(m.receber.total)}</span>
                              <span className="text-xs text-slate-400 ml-1">({m.receber.count})</span>
                            </div>
                            {isSelected ? <ChevronUp className="w-4 h-4 text-emerald-600 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />}
                            {canVerifyMaxiprod && (m as any).from && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setVerifyingMonth({ label: m.label, type: "receber", from: (m as any).from, to: (m as any).to, total: m.receber.total }); }}
                                className="p-1 rounded hover:bg-emerald-200 transition-colors shrink-0" title="Conferir no Maxiprod"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                              </button>
                            )}
                          </button>
                          {isSelected && (
                            <MonthDetailTable
                              items={monthReceber?.items}
                              isLoading={loadingMonthReceber}
                              nameField="cliente"
                              colorScheme="emerald"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>}

              {/* A Pagar */}
              {hasGranularAccess("fin.verContasPagar") && <div className="bg-white rounded-lg border border-red-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowCharts(!showCharts)}
                  className="w-full bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-red-100 transition-colors"
                >
                  <h3 className="text-sm font-bold text-red-700 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    A Pagar
                    {showPagarChart ? <ChevronUp className="w-5 h-5 text-red-600" /> : <ChevronDown className="w-5 h-5 text-red-600" />}
                  </h3>
                  <span className="text-sm font-bold text-red-800 flex items-center gap-2">
                    Total: {formatCurrency(monthlyData ? monthlyData.reduce((s, m) => s + m.pagar.total, 0) : (summary!.pagar.emAberto.total))}
                    {canVerifyMaxiprod && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowTotalPagarSim(true); }}
                        className="p-1 rounded-full hover:bg-red-200 transition-colors" title="Conferir total no Maxiprod"
                      >
                        <Eye className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </span>
                </button>
                {showPagarChart && (
                  <div className="p-4 space-y-1.5">
                    {loadingMonthly ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                    ) : monthlyData?.map((m, idx) => {
                      const maxTotal = Math.max(...(monthlyData || []).map(x => x.pagar.total), 1);
                      const pct = (m.pagar.total / maxTotal) * 100;
                      const isSelected = selectedMonth === m.label;
                      return (
                        <div key={idx}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedMonth(isSelected ? null : m.label); }}
                            className={`w-full flex items-center gap-3 py-1 px-2 rounded-md transition-colors cursor-pointer ${
                              isSelected ? "bg-red-100 ring-1 ring-red-300" : "hover:bg-red-50/50"
                            }`}
                          >
                            <span className="text-xs font-medium text-slate-500 w-20 shrink-0 text-left">{m.label}</span>
                            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative">
                              <div
                                className="h-full bg-red-400 rounded-full transition-all"
                                style={{ width: `${Math.max(pct, 1)}%` }}
                              />
                            </div>
                            <div className="text-right shrink-0 w-36">
                              <span className="text-xs font-bold text-slate-800">{formatCurrency(m.pagar.total)}</span>
                              <span className="text-xs text-slate-400 ml-1">({m.pagar.count})</span>
                            </div>
                            {isSelected ? <ChevronUp className="w-4 h-4 text-red-600 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />}
                            {canVerifyMaxiprod && (m as any).from && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setVerifyingMonth({ label: m.label, type: "pagar", from: (m as any).from, to: (m as any).to, total: m.pagar.total }); }}
                                className="p-1 rounded hover:bg-red-200 transition-colors shrink-0" title="Conferir no Maxiprod"
                              >
                                <Eye className="w-3.5 h-3.5 text-red-600" />
                              </button>
                            )}
                          </button>
                          {isSelected && (
                            <MonthDetailTable
                              items={monthPagar?.items}
                              isLoading={loadingMonthPagar}
                              nameField="fornecedor"
                              colorScheme="red"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>}
            </div>

            {/* Fluxo de Caixa */}
            {hasGranularAccess("fin.verFluxoCaixa") && <CashFlowCard />}

            {/* Inadimplência */}
            {hasGranularAccess("fin.verInadimplencia") && summary!.receber.vencidas.count > 0 && (
              <InadimplenciaCard summary={summary!} />
            )}

            {/* Clientes Inadimplentes */}
            {hasGranularAccess("fin.verInadimplencia") && summary!.receber.vencidas.count > 0 && (
              <ClientesInadimplentesCard />
            )}

            {/* Saldo Bancário */}
            {hasGranularAccess("fin.verSaldoBancario") && <BankBalanceCard />}

            {/* Calendários lado a lado */}
            <OverviewCalendars
              calendarPagar={calendarData}
              loadingPagar={loadingCalendar}
              canAuthorize={hasGranularAccess("fin.autorizacaoPagamento")}
              canComment={hasGranularAccess("fin.comentarioPagamento")}
              canViewPagar={hasGranularAccess("fin.verContasPagar")}
              canViewReceber={hasGranularAccess("fin.verContasReceber")}
            />

          </>
        )
        )}
      </main>
    </div>
  );
}
