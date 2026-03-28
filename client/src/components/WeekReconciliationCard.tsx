/**
 * Card de Autorização de Pagamentos da Semana
 * Exibe contas a pagar organizadas por dia (seg-sex) com checkbox de autorização
 * Fernando marca as contas → Financeiro executa os pagamentos autorizados
 */

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  Loader2,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCheck,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatCurrencyShort(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `R$ ${(n / 1000).toFixed(1)}k`;
  }
  return formatCurrency(n);
}

type PayableItem = {
  maxiprodId: number;
  fornecedor: string;
  valor: number;
  vencimento: string;
  referenteA: string;
  parcela: string;
  empresaNome: string;
  authorized: boolean;
  authStatus: string | null;
  authNotes: string | null;
};

type DayData = {
  date: string;
  dayLabel: string;
  items: PayableItem[];
  total: number;
  authorizedTotal: number;
  authorizedCount: number;
  count: number;
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
};

const AUTH_STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  autorizado: { label: "Autorizado", bg: "bg-emerald-100", text: "text-emerald-700" },
  nao_autorizado: { label: "Nao Autoriz.", bg: "bg-red-100", text: "text-red-700" },
  autorizado_ressalva: { label: "Ressalva", bg: "bg-amber-100", text: "text-amber-700" },
  prorrogar: { label: "Prorrogar", bg: "bg-blue-100", text: "text-blue-700" },
  outros: { label: "Outros", bg: "bg-slate-100", text: "text-slate-600" },
};

function PayableRow({
  item,
  onToggle,
  isToggling,
}: {
  item: PayableItem;
  onToggle: () => void;
  isToggling: boolean;
}) {
  const badge = item.authStatus ? AUTH_STATUS_BADGE[item.authStatus] : null;
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border-b border-slate-100 last:border-b-0 transition-colors ${
        item.authorized
          ? "bg-emerald-100 hover:bg-emerald-200/80"
          : "hover:bg-slate-50/50"
      }`}
    >
      <div className="flex-shrink-0">
        {isToggling ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        ) : (
          <Checkbox
            checked={item.authorized}
            onCheckedChange={onToggle}
            className={`w-5 h-5 ${
              item.authorized
                ? "border-emerald-600 bg-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                : "border-slate-300"
            }`}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {item.authorized && (
            <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          )}
          <span
            className={`text-sm font-semibold truncate ${
              item.authorized ? "text-emerald-900" : "text-slate-800"
            }`}
          >
            {item.fornecedor}
          </span>
          {item.parcela && (
            <span
              className={`text-[10px] font-medium flex-shrink-0 ${
                item.authorized ? "text-emerald-500" : "text-slate-400"
              }`}
            >
              ({item.parcela})
            </span>
          )}
          {badge && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text} shrink-0`}>
              {badge.label}
            </span>
          )}
        </div>
        {item.referenteA && (
          <p
            className={`text-[10px] truncate ${
              item.authorized ? "text-emerald-500/70" : "text-slate-400"
            }`}
          >
            {item.referenteA}
          </p>
        )}
        {item.authNotes && (
          <p className="text-[9px] text-slate-500 italic truncate mt-0.5">
            {item.authNotes}
          </p>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        <span
          className={`text-base font-bold tabular-nums ${
            item.authorized ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {formatCurrency(item.valor)}
        </span>
        <div
          className={`text-[9px] ${
            item.authorized ? "text-emerald-400" : "text-slate-400"
          }`}
        >
          {item.vencimento.split("-").reverse().join("/")}
        </div>
      </div>
    </div>
  );
}

function DayCard({
  day,
  onToggleItem,
  onToggleAll,
  togglingIds,
  isVencidas,
  saldoBancario,
}: {
  day:
    | DayData
    | {
        dayLabel: string;
        items: PayableItem[];
        total: number;
        authorizedTotal: number;
        authorizedCount: number;
        count: number;
      };
  onToggleItem: (id: number, authorized: boolean) => void;
  onToggleAll: (ids: number[], authorized: boolean) => void;
  togglingIds: Set<number>;
  isVencidas?: boolean;
  saldoBancario: number;
}) {
  const isToday = "isToday" in day ? day.isToday : false;
  const isPast = "isPast" in day ? day.isPast : false;
  const [expanded, setExpanded] = useState(isVencidas || isToday);
  const allAuthorized = day.count > 0 && day.authorizedCount === day.count;

  let borderColor = "border-slate-200";
  if (isVencidas) {
    borderColor = "border-red-200";
  } else if (isToday) {
    borderColor = "border-blue-300";
  } else if (allAuthorized && day.count > 0) {
    borderColor = "border-emerald-200";
  } else if (isPast && day.count > 0) {
    borderColor = "border-amber-200";
  }

  if (day.count === 0) return null;

  const pendingIds = day.items
    .filter((i) => !i.authorized)
    .map((i) => i.maxiprodId);
  const allIds = day.items.map((i) => i.maxiprodId);

  return (
    <div className={`rounded-lg border ${borderColor} overflow-hidden`}>
      {/* Header - Clickable to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full cursor-pointer hover:brightness-95 transition-all"
      >
        {/* Top bar: Saldo (verde) | Autorizado (vermelho) | Total do dia (azul) */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
          {/* Saldo Bancário - VERDE */}
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-emerald-600" />
            <div>
              <span className="text-[10px] text-emerald-500 font-medium block leading-tight">Saldo</span>
              <span className="text-lg font-extrabold tabular-nums text-emerald-600">
                {formatCurrency(saldoBancario)}
              </span>
            </div>
          </div>

          {/* Autorizado - VERMELHO */}
          <div className="flex items-center gap-2">
            {day.authorizedTotal > 0 && (
              <>
                <ShieldCheck className="w-5 h-5 text-red-500" />
                <div>
                  <span className="text-[10px] text-red-400 font-medium block leading-tight">Autorizado</span>
                  <span className="text-lg font-extrabold tabular-nums text-red-600">
                    {formatCurrency(day.authorizedTotal)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Total do dia - AZUL (direita) */}
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-[10px] text-blue-400 font-medium block leading-tight">Total</span>
              <span className="text-lg font-extrabold tabular-nums text-blue-600">
                {formatCurrency(day.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Day label row */}
        <div
          className={`px-3 py-2 flex items-center justify-between ${
            isVencidas
              ? "bg-red-50"
              : isToday
                ? "bg-blue-50"
                : allAuthorized
                  ? "bg-emerald-50"
                  : "bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-2">
            {isVencidas ? (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            ) : allAuthorized ? (
              <CheckCheck className="w-4 h-4 text-emerald-500" />
            ) : (
              <CheckCircle2
                className={`w-4 h-4 ${isToday ? "text-blue-500" : "text-slate-400"}`}
              />
            )}
            <span
              className={`text-sm font-bold ${
                isVencidas
                  ? "text-red-700"
                  : isToday
                    ? "text-blue-700"
                    : allAuthorized
                      ? "text-emerald-700"
                      : "text-slate-700"
              }`}
            >
              {day.dayLabel}
            </span>
            {isToday && (
              <span className="text-[10px] font-semibold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                HOJE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">
              {day.authorizedCount}/{day.count}
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="bg-white">
          {/* Authorize all / none toggle */}
          {day.count > 1 && (
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <button
                onClick={() => {
                  if (allAuthorized) {
                    onToggleAll(allIds, false);
                  } else {
                    onToggleAll(pendingIds, true);
                  }
                }}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors"
              >
                {allAuthorized ? "Desmarcar todos" : "Autorizar todos"}
              </button>
            </div>
          )}

          {/* Items list */}
          <div className="max-h-[300px] overflow-y-auto">
            {day.items.map((item) => (
              <PayableRow
                key={item.maxiprodId}
                item={item}
                onToggle={() =>
                  onToggleItem(item.maxiprodId, !item.authorized)
                }
                isToggling={togglingIds.has(item.maxiprodId)}
              />
            ))}
          </div>

          {/* Footer summary */}
          <div className="px-3 py-2 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">
              {day.count} conta{day.count > 1 ? "s" : ""}
            </span>
            <span className="text-sm font-bold text-blue-600 tabular-nums">
              {formatCurrency(day.total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WeekReconciliationCard() {
  const { data, isLoading } = trpc.financial.getWeekReconciliation.useQuery();
  const { data: bankData } = trpc.financial.getBankBalances.useQuery();
  const utils = trpc.useUtils();
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  const toggleMutation = trpc.financial.togglePaymentAuth.useMutation({
    onMutate: ({ accountPayableId }) => {
      setTogglingIds((prev) => new Set(prev).add(accountPayableId));
    },
    onSettled: (_data, _err, { accountPayableId }) => {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(accountPayableId);
        return next;
      });
      utils.financial.getWeekReconciliation.invalidate();
    },
  });

  const batchToggleMutation =
    trpc.financial.batchTogglePaymentAuth.useMutation({
      onMutate: ({ accountPayableIds }) => {
        setTogglingIds((prev) => {
          const next = new Set(prev);
          accountPayableIds.forEach((id) => next.add(id));
          return next;
        });
      },
      onSettled: (_data, _err, { accountPayableIds }) => {
        setTogglingIds((prev) => {
          const next = new Set(prev);
          accountPayableIds.forEach((id) => next.delete(id));
          return next;
        });
        utils.financial.getWeekReconciliation.invalidate();
      },
    });

  const [collapsed, setCollapsed] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-indigo-200 shadow-sm p-6">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando autorizações...</span>
        </div>
      </div>
    );
  }

  if (
    !data ||
    (data.days.every((d) => d.count === 0) && data.vencidas.count === 0)
  ) {
    return null;
  }

  const visibleDays = data.days.filter((d) => !d.isPast || d.isToday);
  const totalContas =
    visibleDays.reduce((s, d) => s + d.count, 0) + data.vencidas.count;
  const totalValor =
    visibleDays.reduce((s, d) => s + d.total, 0) + data.vencidas.total;
  const totalAuthorized =
    visibleDays.reduce((s, d) => s + d.authorizedCount, 0) +
    (data.vencidas.authorizedCount || 0);
  const totalAuthorizedValor =
    visibleDays.reduce((s, d) => s + d.authorizedTotal, 0) +
    (data.vencidas.authorizedTotal || 0);

  const saldoBancario = bankData?.totalSaldo ?? 0;

  const handleToggleItem = (id: number, authorized: boolean) => {
    toggleMutation.mutate({ accountPayableId: id, authorized });
  };

  const handleToggleAll = (ids: number[], authorized: boolean) => {
    if (ids.length === 0) return;
    batchToggleMutation.mutate({ accountPayableIds: ids, authorized });
  };

  return (
    <div className="bg-white rounded-xl border-2 border-indigo-200 shadow-sm overflow-hidden">
      {/* Main Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full bg-indigo-50 border-b border-indigo-200 px-4 py-3 cursor-pointer hover:bg-indigo-100/70 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-indigo-700">
                Autorização de Pagamentos
              </h3>
              <p className="text-xs text-indigo-500">
                Semana {data.weekLabel} — {totalAuthorized}/{totalContas}{" "}
                autorizados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {totalAuthorized === totalContas && totalContas > 0 ? (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                Tudo Autorizado
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                {totalContas - totalAuthorized} pendente
                {totalContas - totalAuthorized > 1 ? "s" : ""}
              </span>
            )}
            {collapsed ? (
              <ChevronDown className="w-5 h-5 text-indigo-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-indigo-400" />
            )}
          </div>
        </div>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="p-4">
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>
                {totalAuthorized} de {totalContas} contas autorizadas
              </span>
              <span>
                {formatCurrency(totalAuthorizedValor)} de{" "}
                {formatCurrency(totalValor)}
              </span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${totalContas > 0 ? (totalAuthorized / totalContas) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Day cards */}
          <div className="space-y-3">
            {/* Vencidas */}
            {data.vencidas.count > 0 && (
              <DayCard
                day={{
                  dayLabel: `Vencidas (${data.vencidas.count})`,
                  items: data.vencidas.items,
                  total: data.vencidas.total,
                  authorizedTotal: data.vencidas.authorizedTotal || 0,
                  authorizedCount: data.vencidas.authorizedCount || 0,
                  count: data.vencidas.count,
                }}
                onToggleItem={handleToggleItem}
                onToggleAll={handleToggleAll}
                togglingIds={togglingIds}
                isVencidas
                saldoBancario={saldoBancario}
              />
            )}

            {/* Week days */}
            {data.days
              .filter((day) => !day.isPast || day.isToday)
              .map((day) => (
                <DayCard
                  key={day.date}
                  day={day}
                  onToggleItem={handleToggleItem}
                  onToggleAll={handleToggleAll}
                  togglingIds={togglingIds}
                  saldoBancario={saldoBancario}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
