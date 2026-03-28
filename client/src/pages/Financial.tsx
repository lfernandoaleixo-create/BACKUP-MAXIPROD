/**
 * Dashboard Grupo Fox - Aba Financeiro
 * Contas a Pagar e Receber do Maxiprod (SOMENTE LEITURA)
 */

import React, { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
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
  Landmark,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import TopNav from "@/components/TopNav";

/* ---- Helpers ---- */
function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
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

/* ---- Expandable Bucket Card ---- */
function BucketCard({ bucket, colorClass, textColorClass }: {
  bucket: { label: string; total: number; count: number; items: any[] };
  colorClass: string;
  textColorClass: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE = 5;
  const hasMore = bucket.items.length > VISIBLE;
  const visibleItems = expanded ? bucket.items : bucket.items.slice(0, VISIBLE);

  return (
    <div className={`rounded-lg border ${colorClass} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-semibold ${textColorClass}`}>{bucket.label}</span>
        <div className="text-right">
          <span className={`text-sm font-bold ${textColorClass}`}>{formatCurrency(bucket.total)}</span>
          <span className="text-xs text-slate-400 ml-2">({bucket.count})</span>
        </div>
      </div>
      {visibleItems.length > 0 && (
        <div className="space-y-1">
          {visibleItems.map((item: any, idx: number) => (
            <div key={idx} className="flex items-baseline gap-x-2 text-xs leading-5">
              <span className="text-slate-600 truncate min-w-0" style={{ flex: '1 1 0', maxWidth: 'calc(100% - 180px)' }}>{item.fornecedor}</span>
              <span className="text-slate-400 whitespace-nowrap text-right shrink-0" style={{ width: '78px', fontVariantNumeric: 'tabular-nums', fontSize: '11px' }}>{formatDate(item.vencimento)}</span>
              <span className="font-semibold text-slate-700 whitespace-nowrap text-right shrink-0" style={{ width: '90px', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.valor)}</span>
            </div>
          ))}
        </div>
      )}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors py-1 rounded hover:bg-slate-100"
        >
          {expanded ? (
            <><ChevronUp className="w-4 h-4" />Recolher</>
          ) : (
            <><ChevronDown className="w-4 h-4" />+{bucket.items.length - VISIBLE} mais</>
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
                      <span className="text-sm font-medium text-slate-800">{item.fornecedor || "—"}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-500 truncate block max-w-[200px]">{item.referenteA || "—"}</span>
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
                    <span className="text-xs font-medium text-slate-800 truncate block max-w-[180px]">{item.cliente || "\u2014"}</span>
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
function OverviewCalendars({ calendarPagar, loadingPagar }: {
  calendarPagar: any;
  loadingPagar: boolean;
}) {
  const { data: calendarReceber, isLoading: loadingReceber } = trpc.financial.getReceivableCalendar.useQuery();

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
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
          <h3 className="text-sm font-bold text-emerald-700 flex items-center justify-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Recebimentos
          </h3>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <h3 className="text-sm font-bold text-red-700 flex items-center justify-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Pagamentos
          </h3>
        </div>
      </div>

      {/* Paired rows */}
      {rows.map((row, idx) => {
        const isVencida = row.colorIdx === -1;
        const color = isVencida
          ? { border: "border-red-300 bg-red-50", text: "text-red-700" }
          : weekColors[row.colorIdx % weekColors.length];

        return (
          <div key={idx} className="grid grid-cols-2 gap-4">
            <BucketCard
              bucket={{ ...row.receber, label: row.label }}
              colorClass={isVencida ? "border-emerald-300 bg-emerald-50" : `border-emerald-200 bg-emerald-50/50`}
              textColorClass={isVencida ? "text-emerald-700" : "text-emerald-700"}
            />
            <BucketCard
              bucket={{ ...row.pagar, label: row.label }}
              colorClass={isVencida ? "border-red-300 bg-red-50" : `border-red-200 bg-red-50/50`}
              textColorClass={isVencida ? "text-red-700" : "text-red-700"}
            />
          </div>
        );
      })}


    </div>
  );
}

/* ---- Bank Balance Card ---- */
function BankBalanceCard() {
  const { data, isLoading } = trpc.financial.getBankBalances.useQuery();
  const [collapsed, setCollapsed] = useState(true);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const shortBank = (name: string) => {
    if (name.includes("Bradesco")) return "Bradesco";
    if (name.includes("Sicredi")) return "Sicredi";
    if (name.includes("BANCOOB") || name.includes("Sicoob")) return "Sicoob";
    if (name.includes("Caixa")) return "Caixa";
    if (name.includes("Brasil")) return "BB";
    return name.substring(0, 12);
  };

  const shortCo = (name: string) => {
    if (name.includes("PALITOS")) return "Palitos";
    if (name.includes("VARETAS")) return "Varetas";
    if (name.includes("ESPETOS")) return "Espetos";
    if (name.includes("MESA")) return "Mesa";
    return name;
  };

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

  // Group accounts by company
  const byCompany = new Map<string, typeof data.accounts>();
  data.accounts.forEach(acc => {
    const co = acc.empresaNome || "Outros";
    const list = byCompany.get(co) || [];
    list.push(acc);
    byCompany.set(co, list);
  });

  // Only show accounts that have saldoInicial set (configured)
  const configuredAccounts = data.accounts.filter(a => a.saldoInicial !== 0 || a.saldoInicialData);
  const hasConfigured = configuredAccounts.length > 0;

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
              {hasConfigured
                ? `${configuredAccounts.length} contas configuradas`
                : "Configure os saldos em Config > Bancos"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {hasConfigured && (
            <span className={`font-bold text-lg tabular-nums ${
              data.totalSaldo >= 0 ? "text-emerald-600" : "text-red-600"
            }`}>
              {formatCurrency(data.totalSaldo)}
            </span>
          )}
          {collapsed ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="border-t border-slate-100 p-4">
          {!hasConfigured ? (
            <div className="text-center py-6 text-slate-400">
              <Landmark className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum saldo inicial configurado</p>
              <p className="text-xs mt-1">Vá em <strong>Config &gt; Bancos</strong> para definir os saldos iniciais</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(byCompany.entries()).map(([company, accounts]) => {
                const companyConfigured = accounts.filter(a => a.saldoInicial !== 0 || a.saldoInicialData);
                if (companyConfigured.length === 0) return null;
                const companyTotal = companyConfigured.reduce((s, a) => s + a.saldoAtual, 0);
                return (
                  <div key={company}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {shortCo(company)}
                      </span>
                      <span className={`text-sm font-bold tabular-nums ${
                        companyTotal >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}>
                        {formatCurrency(companyTotal)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {companyConfigured.map(acc => (
                        <div key={acc.maxiprodId} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-700 font-medium">{shortBank(acc.bancoNome || "")}</span>
                            <span className="text-xs text-slate-400">Cc {acc.contaNumero}</span>
                          </div>
                          <span className={`text-sm font-semibold tabular-nums ${
                            acc.saldoAtual >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}>
                            {formatCurrency(acc.saldoAtual)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
        className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-blue-100/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-blue-700">Fluxo de Caixa</h3>
          <span className="text-[10px] text-blue-500 ml-1">8 semanas</span>
          {collapsed ? <ChevronDown className="w-5 h-5 text-blue-600 ml-1" /> : <ChevronUp className="w-5 h-5 text-blue-600 ml-1" />}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-emerald-600 font-semibold">Receber: {formatCurrency(totalReceber)}</span>
          <span className="text-xs text-red-600 font-semibold">Pagar: {formatCurrency(totalPagar)}</span>
          <span className={`text-sm font-bold ${saldoTotal >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            Saldo: {formatCurrency(saldoTotal)}
          </span>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4">
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

/* ---- Inadimplência Card with Line Chart ---- */
/* ---- Painel de detalhes do mês selecionado ---- */
function MesDetalhePanel({ mes, clienteFilter }: { mes: string; clienteFilter: string }) {
  const { data, isLoading } = trpc.financial.getInadimplenciaDetalhesMes.useQuery(
    { mes, clienteFilter: clienteFilter || undefined }
  );

  const formatMonth = (m: string) => {
    const [y, mo] = m.split("-");
    const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    return `${months[parseInt(mo, 10) - 1]} ${y}`;
  };

  const formatDate = (d: string) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
    </div>
  );

  if (!data || data.titulos.length === 0) return (
    <div className="flex items-center justify-center h-full text-xs text-slate-400">
      Sem títulos neste mês
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50">
        <p className="text-xs font-semibold text-slate-700">{formatMonth(mes)}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-sm font-bold text-amber-700">{formatCurrency(data.total)}</span>
          <span className="text-[10px] text-slate-400">{data.count} título{data.count !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {data.titulos.map((t: any, i: number) => (
          <div key={i} className={`px-3 py-1.5 flex items-center justify-between gap-2 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"} hover:bg-amber-50/40 transition-colors`}>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-slate-700 truncate" title={t.cliente}>{t.cliente}</p>
              <p className="text-[9px] text-slate-400">{formatDate(t.vencimento)}{t.referenteA ? ` · ${t.referenteA.split(" ref. ")[1] || t.referenteA}` : ""}</p>
            </div>
            <span className="text-[11px] font-semibold text-amber-700 whitespace-nowrap">{formatCurrency(t.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InadimplenciaCard({ summary }: { summary: any }) {
  const [chartFilter, setChartFilter] = useState("");
  const { data: timeline, isLoading } = trpc.financial.getInadimplenciaTimeline.useQuery(
    chartFilter ? { clienteFilter: chartFilter } : undefined
  );
  const [collapsed, setCollapsed] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [hoveredDot, setHoveredDot] = useState<number | null>(null);

  const formatMonth = (mes: string) => {
    const [y, m] = mes.split("-");
    const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return `${months[parseInt(m, 10) - 1]}/${y.slice(2)}`;
  };

  const chartData = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    let accumulated = 0;
    return timeline.map((point: any) => {
      accumulated += point.total;
      return {
        mes: point.mes,
        label: formatMonth(point.mes),
        valor: point.total,
        acumulado: accumulated,
        count: point.count,
      };
    });
  }, [timeline]);

  // Selecionar último mês por padrão quando dados carregam
  useMemo(() => {
    if (chartData.length > 0 && selectedIdx === null) {
      setSelectedIdx(chartData.length - 1);
    }
  }, [chartData]);

  // Dimensões do SVG - mais compacto para layout split
  const svgWidth = 420;
  const svgHeight = 220;
  const paddingLeft = 50;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 30;
  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = svgHeight - paddingTop - paddingBottom;

  const maxVal = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map((d: any) => d.valor), 1);
  }, [chartData]);

  const bars = useMemo(() => {
    if (chartData.length === 0) return [];
    const barW = Math.min(22, Math.max(8, (chartW - (chartData.length - 1) * 4) / chartData.length));
    const gap = Math.min(4, (chartW - chartData.length * barW) / Math.max(chartData.length - 1, 1));
    const totalBarsWidth = chartData.length * barW + (chartData.length - 1) * gap;
    const offsetX = paddingLeft + (chartW - totalBarsWidth) / 2;
    return chartData.map((d: any, i: number) => {
      const x = offsetX + i * (barW + gap);
      const h = Math.max((d.valor / maxVal) * chartH, 2);
      const y = paddingTop + chartH - h;
      return { x, y, w: barW, h, ...d };
    });
  }, [chartData, chartW, chartH, maxVal]);

  const gridLines = useMemo(() => {
    const lines = [];
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const val = (maxVal / steps) * i;
      const y = paddingTop + chartH - (val / maxVal) * chartH;
      lines.push({ y, val });
    }
    return lines;
  }, [maxVal, chartH]);

  const handleBarClick = (idx: number) => {
    setSelectedIdx(idx);
  };

  return (
    <div className="bg-white rounded-lg border border-amber-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-amber-100/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-bold text-amber-700">Inadimplência</h3>
          <span className="text-[10px] text-amber-500 ml-1">{summary.receber.vencidas.count} títulos</span>
          {collapsed ? <ChevronDown className="w-5 h-5 text-amber-600 ml-1" /> : <ChevronUp className="w-5 h-5 text-amber-600 ml-1" />}
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-amber-800">{formatCurrency(summary.receber.vencidas.total)}</span>
        </div>
      </div>

      {!collapsed && (
        <div>
          {/* Filtros compactos */}
          <div className="px-5 py-2.5 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-[280px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
              <Input
                placeholder="Filtrar por cliente..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") setChartFilter(searchInput.trim()); }}
                className="pl-8 h-7 text-xs bg-white border-slate-200"
              />
            </div>
            <button
              onClick={() => {
                if (chartFilter === "keure") { setChartFilter(""); setSearchInput(""); }
                else { setChartFilter("keure"); setSearchInput("keure"); }
              }}
              className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all border ${
                chartFilter === "keure"
                  ? "bg-red-500 text-white border-red-500 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-600"
              }`}
            >
              Keure
            </button>
            <button
              onClick={() => {
                if (chartFilter === "johnson") { setChartFilter(""); setSearchInput(""); }
                else { setChartFilter("johnson"); setSearchInput("johnson"); }
              }}
              className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all border ${
                chartFilter === "johnson"
                  ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              Johnson
            </button>
            {chartFilter && (
              <button
                onClick={() => { setChartFilter(""); setSearchInput(""); }}
                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            </div>
          ) : chartData.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">{chartFilter ? `Nenhum dado para "${chartFilter}"` : "Sem dados"}</p>
          ) : (
            <div className="flex flex-col lg:flex-row">
              {/* Lado esquerdo: Gráfico */}
              <div className="lg:w-[55%] p-4 lg:border-r border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-600">
                      {chartFilter ? `Evolução — ${chartFilter.toUpperCase()}` : "Evolução Mensal"}
                    </h4>
                    <p className="text-[9px] text-slate-400 mt-0.5">Clique em uma barra para ver detalhes · <span className="text-amber-800/50">Linha = acumulado</span></p>
                  </div>
                </div>
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-auto"
                >
                  <defs>
                    <linearGradient id="inadBarDefault" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.6" />
                    </linearGradient>
                    <linearGradient id="inadBarActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#d97706" />
                    </linearGradient>
                  </defs>

                  {/* Grid lines - subtle */}
                  {gridLines.map((line, i) => (
                    <g key={i}>
                      <line
                        x1={paddingLeft}
                        y1={line.y}
                        x2={svgWidth - paddingRight}
                        y2={line.y}
                        stroke="#f1f5f9"
                        strokeWidth="0.5"
                      />
                      <text
                        x={paddingLeft - 5}
                        y={line.y + 3}
                        textAnchor="end"
                        fill="#94a3b8"
                        fontSize="7"
                        fontFamily="system-ui"
                      >
                        {line.val >= 1000 ? `${(line.val / 1000).toFixed(0)}K` : line.val.toFixed(0)}
                      </text>
                    </g>
                  ))}

                  {/* Bars */}
                  {bars.map((bar, i) => {
                    const isActive = selectedIdx === i;
                    return (
                      <g key={i} className="cursor-pointer" onClick={() => handleBarClick(i)}>
                        {/* Bar */}
                        <rect
                          x={bar.x}
                          y={bar.y}
                          width={bar.w}
                          height={Math.max(bar.h, 2)}
                          rx={bar.w > 12 ? 4 : 2}
                          fill={isActive ? "url(#inadBarActive)" : "url(#inadBarDefault)"}
                          opacity={selectedIdx !== null && !isActive ? 0.45 : 1}
                          style={{ transition: "all 0.2s ease" }}
                        />
                        {/* Value on top of active bar */}
                        {isActive && (
                          <text
                            x={bar.x + bar.w / 2}
                            y={bar.y - 5}
                            textAnchor="middle"
                            fill="#92400e"
                            fontSize="7.5"
                            fontWeight="600"
                            fontFamily="system-ui"
                          >
                            {formatCurrencyShort(bar.valor)}
                          </text>
                        )}
                        {/* X label */}
                        <text
                          x={bar.x + bar.w / 2}
                          y={paddingTop + chartH + 14}
                          textAnchor="middle"
                          fill={isActive ? "#92400e" : "#94a3b8"}
                          fontSize="6.5"
                          fontWeight={isActive ? "600" : "400"}
                          fontFamily="system-ui"
                          style={{ transition: "fill 0.2s ease" }}
                        >
                          {bar.label}
                        </text>
                        {/* Active indicator dot */}
                        {isActive && (
                          <circle
                            cx={bar.x + bar.w / 2}
                            cy={paddingTop + chartH + 21}
                            r="1.5"
                            fill="#f59e0b"
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Trend line - rendered AFTER bars so dots are on top and hoverable */}
                  {bars.length > 1 && (() => {
                    const maxAcum = bars.reduce((s: number, b: any) => s + b.valor, 0) || 1;
                    const normalizedPoints = bars.map((bar: any, i: number) => {
                      const acumAtI = bars.slice(0, i + 1).reduce((s: number, b: any) => s + b.valor, 0);
                      const y = paddingTop + chartH - (acumAtI / maxAcum) * (chartH - 5);
                      return { x: bar.x + bar.w / 2, y };
                    });
                    const pathD = normalizedPoints.map((p: any, i: number) => {
                      if (i === 0) return `M ${p.x} ${p.y}`;
                      const prev = normalizedPoints[i - 1];
                      const cpx = (prev.x + p.x) / 2;
                      return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
                    }).join(" ");
                    const acumValues = bars.map((_: any, i: number) =>
                      bars.slice(0, i + 1).reduce((s: number, b: any) => s + b.valor, 0)
                    );
                    return (
                      <g>
                        {/* Line */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#92400e"
                          strokeWidth="1"
                          strokeOpacity="0.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Dots on line - with hover tooltip */}
                        {normalizedPoints.map((p: any, i: number) => (
                          <g key={`dot-${i}`}>
                            {/* Invisible larger hit area */}
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="10"
                              fill="transparent"
                              onMouseEnter={() => setHoveredDot(i)}
                              onMouseLeave={() => setHoveredDot(null)}
                              className="cursor-pointer"
                              style={{ pointerEvents: "all" }}
                            />
                            {/* Visible dot */}
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={hoveredDot === i ? 4 : 2.5}
                              fill="#92400e"
                              fillOpacity={hoveredDot === i ? 0.8 : 0.5}
                              stroke={hoveredDot === i ? "#fef3c7" : "none"}
                              strokeWidth={hoveredDot === i ? 1.5 : 0}
                              style={{ transition: "all 0.15s ease", pointerEvents: "none" }}
                            />
                            {/* Tooltip on hover */}
                            {hoveredDot === i && (
                              <g style={{ pointerEvents: "none" }}>
                                <rect
                                  x={p.x - 40}
                                  y={p.y - 24}
                                  width="80"
                                  height="18"
                                  rx="4"
                                  fill="#292524"
                                  fillOpacity="0.9"
                                />
                                <text
                                  x={p.x}
                                  y={p.y - 12}
                                  textAnchor="middle"
                                  fill="#fef3c7"
                                  fontSize="7.5"
                                  fontWeight="600"
                                  fontFamily="system-ui"
                                >
                                  {formatCurrencyShort(acumValues[i])}
                                </text>
                              </g>
                            )}
                          </g>
                        ))}
                      </g>
                    );
                  })()}
                </svg>
              </div>

              {/* Lado direito: Detalhes do mês */}
              <div className="lg:w-[45%] bg-slate-50/30 flex flex-col" style={{ minHeight: "280px", maxHeight: "340px" }}>
                {/* Resumo da série no topo */}
                <div className="px-3 py-2 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-amber-100/50">
                  <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">
                    {chartFilter ? `Série — ${chartFilter.toUpperCase()}` : "Série Histórica"}
                  </p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-lg font-bold text-amber-800">
                      {formatCurrency(chartData.reduce((sum: number, d: any) => sum + d.valor, 0))}
                    </span>
                    <span className="text-[10px] text-amber-600/70">
                      {chartData.reduce((sum: number, d: any) => sum + d.count, 0)} títulos · {chartData.length} meses
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                {selectedIdx !== null && chartData[selectedIdx] ? (
                  <MesDetalhePanel
                    mes={chartData[selectedIdx].mes}
                    clienteFilter={chartFilter}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                    <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-xs">Selecione um mês no gráfico</p>
                  </div>
                )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Card Clientes Inadimplentes ---- */
type SortFieldClientes = "valor" | "data" | "titulos";
type SortDirClientes = "asc" | "desc";

function ClientesInadimplentesCard() {
  const { data: clientes, isLoading } = trpc.financial.getClientesInadimplentes.useQuery();
  const [collapsed, setCollapsed] = useState(true);
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortFieldClientes>("valor");
  const [sortDir, setSortDir] = useState<SortDirClientes>("desc");

  const totalGeral = useMemo(() => {
    if (!clientes) return 0;
    return clientes.reduce((sum: number, c: any) => sum + c.total, 0);
  }, [clientes]);

  // Enriquecer clientes com data do título mais antigo
  const enrichedClientes = useMemo(() => {
    if (!clientes) return [];
    return clientes.map((c: any) => {
      const oldest = c.titulos.reduce((min: string | null, t: any) => {
        if (!t.vencimento) return min;
        if (!min) return t.vencimento;
        return t.vencimento < min ? t.vencimento : min;
      }, null as string | null);
      return { ...c, oldestDate: oldest };
    });
  }, [clientes]);

  // Filtrar e ordenar
  const filteredClientes = useMemo(() => {
    let result = [...enrichedClientes];

    // Busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((c: any) => c.cliente.toLowerCase().includes(term));
    }

    // Ordenação
    result.sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortField) {
        case "valor":
          cmp = a.total - b.total;
          break;
        case "titulos":
          cmp = a.count - b.count;
          break;
        case "data":
          cmp = (a.oldestDate || "9999").localeCompare(b.oldestDate || "9999");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [enrichedClientes, searchTerm, sortField, sortDir]);

  const handleSort = (field: SortFieldClientes) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const toggleCliente = (clienteKey: string) => {
    setExpandedCliente(expandedCliente === clienteKey ? null : clienteKey);
  };

  const SortIcon = ({ field }: { field: SortFieldClientes }) => (
    <ArrowUpDown className={`w-3 h-3 inline ml-0.5 ${sortField === field ? "text-amber-600" : "text-slate-300"}`} />
  );

  return (
    <div className="bg-white rounded-lg border border-amber-200 shadow-sm">
      <div
        className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-amber-100/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-bold text-amber-700">Clientes Inadimplentes</h3>
          {collapsed ? <ChevronDown className="w-5 h-5 text-amber-600" /> : <ChevronUp className="w-5 h-5 text-amber-600" />}
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-amber-800">{clientes ? `${clientes.length} clientes` : "..."}</span>
          <span className="text-xs text-amber-600 ml-2">{formatCurrency(totalGeral)}</span>
        </div>
      </div>
      {!collapsed && (
        <div>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            </div>
          ) : !clientes || clientes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Nenhum cliente inadimplente</p>
          ) : (
            <>
              {/* Barra de busca */}
              <div className="px-4 py-2.5 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-xs bg-white"
                  />
                </div>
                {/* Filtros rápidos */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-slate-400 font-medium">Filtros:</span>
                  <button
                    onClick={() => setSearchTerm(searchTerm === "keure" ? "" : "keure")}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all border ${
                      searchTerm.toLowerCase() === "keure"
                        ? "bg-red-100 text-red-700 border-red-300"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    }`}
                  >
                    Keure
                  </button>
                  <button
                    onClick={() => setSearchTerm(searchTerm === "johnson" ? "" : "johnson")}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all border ${
                      searchTerm.toLowerCase() === "johnson"
                        ? "bg-blue-100 text-blue-700 border-blue-300"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                    }`}
                  >
                    Johnson
                  </button>
                </div>
                {searchTerm && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    {filteredClientes.length} de {clientes.length} clientes
                  </p>
                )}
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2 text-left text-slate-500 font-semibold w-8">#</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Cliente</th>
                      <th
                        className="px-3 py-2 text-right text-slate-500 font-semibold cursor-pointer hover:text-amber-600 select-none"
                        onClick={() => handleSort("valor")}
                      >
                        Valor Total <SortIcon field="valor" />
                      </th>
                      <th
                        className="px-3 py-2 text-center text-slate-500 font-semibold cursor-pointer hover:text-amber-600 select-none"
                        onClick={() => handleSort("titulos")}
                      >
                        Títulos <SortIcon field="titulos" />
                      </th>
                      <th
                        className="px-3 py-2 text-center text-slate-500 font-semibold cursor-pointer hover:text-amber-600 select-none"
                        onClick={() => handleSort("data")}
                      >
                        Mais Antigo <SortIcon field="data" />
                      </th>
                      <th className="px-3 py-2 text-right text-slate-500 font-semibold">% do Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClientes.map((c: any, idx: number) => {
                      const pct = totalGeral > 0 ? (c.total / totalGeral) * 100 : 0;
                      const clienteKey = c.cliente;
                      const isExpanded = expandedCliente === clienteKey;
                      const diasAntigo = c.oldestDate ? daysUntil(c.oldestDate) : null;
                      return (
                        <React.Fragment key={clienteKey}>
                          <tr
                            className={`transition-colors cursor-pointer ${
                              isExpanded ? "bg-amber-50" : "hover:bg-slate-50"
                            }`}
                            onClick={() => toggleCliente(clienteKey)}
                          >
                            <td className="px-4 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <ChevronRight className={`w-4 h-4 text-amber-600 transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`} />
                                <span className="font-medium text-slate-800 truncate max-w-[240px]" title={c.cliente}>{c.cliente}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className="font-bold text-amber-700">{formatCurrency(c.total)}</span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <Badge className="bg-amber-100 text-amber-700 text-[10px] border-0">{c.count}</Badge>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {c.oldestDate ? (
                                <div>
                                  <span className="text-slate-700">{formatDate(c.oldestDate)}</span>
                                  {diasAntigo !== null && diasAntigo < 0 && (
                                    <span className="text-red-500 text-[10px] ml-1">({Math.abs(diasAntigo)}d)</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-500 rounded-full"
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-slate-500 w-10 text-right">{pct.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                          {/* Detalhes dos títulos expandidos inline */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="p-0">
                                <div className="bg-amber-50/60 border-t border-amber-100 px-6 py-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-[11px] font-bold text-amber-700">
                                      Títulos vencidos — {c.cliente}
                                    </h4>
                                    <span className="text-[10px] text-amber-600">
                                      {c.count} título(s) • Total: {formatCurrency(c.total)}
                                    </span>
                                  </div>
                                  <div className="bg-white rounded border border-amber-100 overflow-hidden">
                                    <table className="w-full text-[11px]">
                                      <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                          <th className="px-3 py-1.5 text-left text-slate-500 font-semibold">Vencimento</th>
                                          <th className="px-3 py-1.5 text-left text-slate-500 font-semibold">Dias</th>
                                          <th className="px-3 py-1.5 text-right text-slate-500 font-semibold">Valor</th>
                                          <th className="px-3 py-1.5 text-left text-slate-500 font-semibold">Referência</th>
                                          <th className="px-3 py-1.5 text-center text-slate-500 font-semibold">Parcela</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50">
                                        {c.titulos.map((t: any, i: number) => {
                                          const dias = daysUntil(t.vencimento);
                                          return (
                                            <tr key={i} className="hover:bg-amber-50/50">
                                              <td className="px-3 py-1.5 text-slate-700">{formatDate(t.vencimento)}</td>
                                              <td className="px-3 py-1.5">
                                                {dias !== null && dias < 0 ? (
                                                  <span className="text-red-600 font-semibold">{Math.abs(dias)}d atr.</span>
                                                ) : (
                                                  <span className="text-slate-400">—</span>
                                                )}
                                              </td>
                                              <td className="px-3 py-1.5 text-right font-semibold text-amber-700">
                                                {formatCurrency(t.valor)}
                                              </td>
                                              <td className="px-3 py-1.5 text-slate-500 truncate max-w-[200px]">
                                                {t.referenteA || t.documento || "—"}
                                              </td>
                                              <td className="px-3 py-1.5 text-center text-slate-400">
                                                {t.parcela || "—"}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredClientes.length === 0 && searchTerm && (
                <p className="text-xs text-slate-400 text-center py-4">Nenhum cliente encontrado para "{searchTerm}"</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Main Financial Page ---- */
export default function Financial() {
  const { data: summary, isLoading: loadingSummary } = trpc.financial.getSummary.useQuery();
  const { data: calendarData, isLoading: loadingCalendar } = trpc.financial.getPaymentCalendar.useQuery();
  const { data: monthlyData, isLoading: loadingMonthly } = trpc.financial.getMonthlyBreakdown.useQuery();

  // Seletor de mês
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
        {isLoading ? (
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
            {/* Título elegante */}
            <div className="text-center py-2">
              <h2 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                <span className="text-slate-700">Dashboard de Análise Financeira</span>
                <span className="text-teal-600 ml-2">Grupo Fox</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 tracking-widest uppercase">Contas a Pagar e Receber</p>
            </div>

            {/* Inadimplência */}
            {summary!.receber.vencidas.count > 0 && (
              <InadimplenciaCard summary={summary!} />
            )}

            {/* Clientes Inadimplentes */}
            {summary!.receber.vencidas.count > 0 && (
              <ClientesInadimplentesCard />
            )}

            {/* Seletor de mês */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Ver contas de:</span>
                {monthlyData?.map((m) => (
                  <button
                    key={m.label}
                    onClick={() => setSelectedMonth(selectedMonth === m.label ? null : m.label)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedMonth === m.label
                        ? "bg-teal-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabelas do mês selecionado */}
            {selectedMonth && monthRange && (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <button
                    onClick={() => setSelectedMonth(null)}
                    className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Ocultar detalhes
                  </button>
                </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Contas a Receber do mês */}
                <div className="bg-white rounded-lg border border-emerald-200 shadow-sm overflow-hidden">
                  <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-emerald-700">A Receber - {selectedMonth}</h3>
                    <span className="text-sm font-bold text-emerald-800">
                      {loadingMonthReceber ? "..." : `${formatCurrency(monthReceber?.totalValor || 0)} (${monthReceber?.total || 0})`}
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {loadingMonthReceber ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                    ) : monthReceber?.items.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">Nenhuma conta neste mês</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-slate-500 font-semibold">Cliente</th>
                            <th className="px-3 py-2 text-right text-slate-500 font-semibold">Valor</th>
                            <th className="px-3 py-2 text-center text-slate-500 font-semibold">Vencimento</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {monthReceber?.items.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-700 truncate max-w-[200px]">{item.cliente || "—"}</td>
                              <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCurrency(Number(item.valorLiquido || 0))}</td>
                              <td className="px-3 py-2 text-center text-slate-500">{formatDate(item.vencimentoData)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Contas a Pagar do mês */}
                <div className="bg-white rounded-lg border border-red-200 shadow-sm overflow-hidden">
                  <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-red-700">A Pagar - {selectedMonth}</h3>
                    <span className="text-sm font-bold text-red-800">
                      {loadingMonthPagar ? "..." : `${formatCurrency(monthPagar?.totalValor || 0)} (${monthPagar?.total || 0})`}
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {loadingMonthPagar ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                    ) : monthPagar?.items.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">Nenhuma conta neste mês</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-slate-500 font-semibold">Fornecedor</th>
                            <th className="px-3 py-2 text-right text-slate-500 font-semibold">Valor</th>
                            <th className="px-3 py-2 text-center text-slate-500 font-semibold">Vencimento</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {monthPagar?.items.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-700 truncate max-w-[200px]">{item.fornecedor || "—"}</td>
                              <td className="px-3 py-2 text-right font-semibold text-red-700">{formatCurrency(Number(item.valorLiquido || 0))}</td>
                              <td className="px-3 py-2 text-center text-slate-500">{formatDate(item.vencimentoData)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
              </div>
            )}

            {/* 1. Fluxo de Caixa */}
            <CashFlowCard />

            {/* 2. Saldo Bancário */}
            <BankBalanceCard />

            {/* 3. Cards mensais lado a lado: A Receber vs A Pagar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* A Receber */}
              <div className="bg-white rounded-lg border border-emerald-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowCharts(!showCharts)}
                  className="w-full bg-emerald-50 border-b border-emerald-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-emerald-100 transition-colors"
                >
                  <h3 className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    A Receber
                    {showReceberChart ? <ChevronUp className="w-5 h-5 text-emerald-600" /> : <ChevronDown className="w-5 h-5 text-emerald-600" />}
                  </h3>
                  <span className="text-sm font-bold text-emerald-800">
                    Total: {formatCurrency(summary!.receber.emAberto.total)}
                  </span>
                </button>
                {showReceberChart && (
                  <div className="p-4 space-y-1.5">
                    {loadingMonthly ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                    ) : monthlyData?.map((m, idx) => {
                      const maxTotal = Math.max(...(monthlyData || []).map(x => x.receber.total), 1);
                      const pct = (m.receber.total / maxTotal) * 100;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-500 w-20 shrink-0">{m.label}</span>
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* A Pagar */}
              <div className="bg-white rounded-lg border border-red-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowCharts(!showCharts)}
                  className="w-full bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-red-100 transition-colors"
                >
                  <h3 className="text-sm font-bold text-red-700 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    A Pagar
                    {showPagarChart ? <ChevronUp className="w-5 h-5 text-red-600" /> : <ChevronDown className="w-5 h-5 text-red-600" />}
                  </h3>
                  <span className="text-sm font-bold text-red-800">
                    Total: {formatCurrency(summary!.pagar.emAberto.total)}
                  </span>
                </button>
                {showPagarChart && (
                  <div className="p-4 space-y-1.5">
                    {loadingMonthly ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                    ) : monthlyData?.map((m, idx) => {
                      const maxTotal = Math.max(...(monthlyData || []).map(x => x.pagar.total), 1);
                      const pct = (m.pagar.total / maxTotal) * 100;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-500 w-20 shrink-0">{m.label}</span>
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Calendários lado a lado */}
            <OverviewCalendars
              calendarPagar={calendarData}
              loadingPagar={loadingCalendar}
            />

          </>
        )}
      </main>
    </div>
  );
}
