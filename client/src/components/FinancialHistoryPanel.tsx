/**
 * FinancialHistoryPanel - Painel de Histórico de Mudanças Financeiras
 * 
 * Design sofisticado e profissional com:
 * - Header com gradiente e estatísticas resumidas
 * - Cards por semana com barras de progresso visual
 * - Itens com layout limpo e hierarquia visual clara
 * - Animações suaves e micro-interações
 * 
 * Dois modos:
 * 1. Por semana (inline no BucketCard): mostra mudanças de uma semana específica
 * 2. Completo (painel grande): mostra todas as mudanças do mês, agrupadas por semana e dia
 */

import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  ArrowUpDown,
  Clock,
  X,
  CalendarDays,
  FolderOpen,
  History,
  TrendingUp,
  TrendingDown,
  FileText,
  BarChart3,
} from "lucide-react";

function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
  if (n < 0) return formatted.replace("R$", "R$ -");
  return formatted;
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatVencimento(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = dateStr.split("T")[0];
  const [y, m, day] = d.split("-");
  return `${day}/${m}`;
}

const dayNames: Record<number, string> = {
  0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb"
};

function getDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dayNames[dt.getDay()] || "";
}

/* ============================================
   MINI PANEL - Inline dentro de cada BucketCard
   ============================================ */

interface WeekHistoryPanelProps {
  tipo: "pagar" | "receber";
  semanaLabel: string;
  onClose: () => void;
}

export function WeekHistoryPanel({ tipo, semanaLabel, onClose }: WeekHistoryPanelProps) {
  const isPagar = tipo === "pagar";
  const { data, isLoading } = trpc.financial.getChanges.useQuery({ tipo, semanaLabel });

  const [activeTab, setActiveTab] = useState<"adicionado" | "removido">("adicionado");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const allItems = useMemo(() => {
    if (!data) return { adicionado: [], removido: [], alterado: [] };
    const adicionado: any[] = [];
    const removido: any[] = [];
    const alterado: any[] = [];
    for (const dayGroup of data) {
      for (const item of dayGroup.items) {
        const enriched = { ...item, _changeDate: dayGroup.date };
        if (item.changeType === "adicionado") adicionado.push(enriched);
        else if (item.changeType === "removido") removido.push(enriched);
        else if (item.changeType === "alterado") alterado.push(enriched);
      }
    }
    return { adicionado, removido, alterado };
  }, [data]);

  const totalAdicionado = allItems.adicionado.reduce((s, i) => s + Number(i.valor || 0), 0);
  const totalRemovido = allItems.removido.reduce((s, i) => s + Number(i.valor || 0), 0);

  const currentItems = activeTab === "adicionado" ? allItems.adicionado : [...allItems.removido, ...allItems.alterado];
  const groupedByDay = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const item of currentItems) {
      const date = item._changeDate || item.changeDate;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    }
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  }, [currentItems]);

  const hasChanges = allItems.adicionado.length > 0 || allItems.removido.length > 0 || allItems.alterado.length > 0;

  return (
    <div className={`mt-2 rounded-xl border-2 ${isPagar ? "border-red-200/60" : "border-emerald-200/60"} overflow-hidden shadow-sm`}>
      {/* Header */}
      <div className={`${isPagar ? "bg-gradient-to-r from-red-600 to-red-500" : "bg-gradient-to-r from-emerald-600 to-emerald-500"} px-4 py-2.5 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <History className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <span className="text-xs font-bold text-white">Histórico — {semanaLabel}</span>
          </div>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer">
          <X className="w-3.5 h-3.5 text-white" />
        </button>
      </div>

      {/* Summary badges */}
      {hasChanges && !isLoading && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
            <TrendingUp className="w-3 h-3 text-green-600" />
            <span className="text-[10px] font-bold text-green-700">+{formatCurrency(totalAdicionado)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
            <TrendingDown className="w-3 h-3 text-red-600" />
            <span className="text-[10px] font-bold text-red-700">-{formatCurrency(totalRemovido)}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-500">Saldo:</span>
            <span className={`text-[11px] font-bold ${totalAdicionado - totalRemovido >= 0 ? "text-green-700" : "text-red-700"}`}>
              {totalAdicionado - totalRemovido >= 0 ? "+" : ""}{formatCurrency(totalAdicionado - totalRemovido)}
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          <span className="text-[10px] text-slate-400">Carregando histórico...</span>
        </div>
      ) : !hasChanges ? (
        <div className="text-center py-6">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <FileText className="w-5 h-5 text-slate-300" />
          </div>
          <span className="text-xs text-slate-400">Nenhuma mudança registrada nesta semana</span>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex">
            <button
              onClick={() => setActiveTab("adicionado")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all cursor-pointer border-b-2 ${
                activeTab === "adicionado"
                  ? "bg-green-50/80 text-green-700 border-green-500"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 border-transparent"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Acrescentados</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === "adicionado" ? "bg-green-200/60 text-green-800" : "bg-slate-100 text-slate-500"
              }`}>
                {allItems.adicionado.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("removido")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all cursor-pointer border-b-2 ${
                activeTab === "removido"
                  ? "bg-red-50/80 text-red-700 border-red-500"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 border-transparent"
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
              <span>Retirados</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === "removido" ? "bg-red-200/60 text-red-800" : "bg-slate-100 text-slate-500"
              }`}>
                {allItems.removido.length + allItems.alterado.length}
              </span>
            </button>
          </div>

          {/* Items grouped by day */}
          <div className="max-h-[300px] overflow-y-auto">
            {groupedByDay.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                Nenhum item {activeTab === "adicionado" ? "acrescentado" : "retirado"} nesta semana
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {groupedByDay.map(([date, items]) => {
                  const isExpanded = expandedDays.has(date) || groupedByDay.length === 1;
                  const dayTotal = items.reduce((s: number, i: any) => s + Number(i.valor || 0), 0);

                  return (
                    <div key={date}>
                      <button
                        onClick={() => toggleDay(date)}
                        className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded flex items-center justify-center ${activeTab === "adicionado" ? "bg-green-100" : "bg-red-100"}`}>
                            <CalendarDays className={`w-3 h-3 ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-700">{formatDateBR(date)}</span>
                          <span className="text-[10px] text-slate-400 font-medium">({getDayName(date)})</span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{items.length} itens</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(dayTotal)}
                          </span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-3 space-y-1">
                          {items.map((item: any, idx: number) => (
                            <div key={item.maxiprodId || idx} className="bg-white rounded-lg border border-slate-100 px-3 py-1.5 hover:border-slate-200 transition-colors">
                              <div className="flex items-center gap-x-2">
                                {item.changeType === "adicionado" ? (
                                  <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                    <Plus className="w-2.5 h-2.5 text-green-600" />
                                  </div>
                                ) : item.changeType === "removido" ? (
                                  <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                    <Minus className="w-2.5 h-2.5 text-red-600" />
                                  </div>
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                    <ArrowUpDown className="w-2.5 h-2.5 text-amber-600" />
                                  </div>
                                )}
                                <span className="text-[11px] text-slate-700 font-medium truncate min-w-0" style={{ flex: '1 1 0' }}>
                                  {item.nome || "—"}
                                </span>
                                {item.vencimentoData && (
                                  <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {formatVencimento(item.vencimentoData)}
                                  </span>
                                )}
                                <span className={`text-[11px] font-bold whitespace-nowrap text-right shrink-0 ${
                                  item.changeType === "adicionado" ? "text-green-700" :
                                  item.changeType === "removido" ? "text-red-700" : "text-amber-700"
                                }`} style={{ width: '85px', fontVariantNumeric: 'tabular-nums' }}>
                                  {item.changeType === "alterado" ? (
                                    <>
                                      <span className="text-slate-400 line-through text-[9px]">{formatCurrency(Number(item.valorAnterior || 0))}</span>
                                      {" → "}
                                      {formatCurrency(Number(item.valor || 0))}
                                    </>
                                  ) : (
                                    formatCurrency(Number(item.valor || 0))
                                  )}
                                </span>
                              </div>
                              {(item.referenteA || item.observacoes) && (
                                <p className="text-[9px] text-slate-400 truncate pl-6 mt-0.5">
                                  {item.referenteA || item.observacoes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================
   FULL PANEL - Histórico Completo (header principal)
   ============================================ */

interface FullHistoryPanelProps {
  tipo: "pagar" | "receber";
  onClose: () => void;
}

export default function FullHistoryPanel({ tipo, onClose }: FullHistoryPanelProps) {
  const isPagar = tipo === "pagar";
  const title = isPagar ? "Pagamentos" : "Recebimentos";

  const { data, isLoading } = trpc.financial.getChanges.useQuery({ tipo });

  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"adicionado" | "removido">("adicionado");

  const toggleWeek = (semana: string) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(semana)) next.delete(semana);
      else next.add(semana);
      return next;
    });
  };

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  // Group all items by semana, then by day
  const grouped = useMemo(() => {
    if (!data) return { adicionado: new Map<string, any[]>(), removido: new Map<string, any[]>() };
    
    const adicionadoBySemana = new Map<string, any[]>();
    const removidoBySemana = new Map<string, any[]>();

    for (const dayGroup of data) {
      for (const item of dayGroup.items) {
        const enriched = { ...item, _changeDate: dayGroup.date };
        const semana = item.semanaLabel || "Sem semana";
        
        if (item.changeType === "adicionado") {
          if (!adicionadoBySemana.has(semana)) adicionadoBySemana.set(semana, []);
          adicionadoBySemana.get(semana)!.push(enriched);
        } else {
          if (!removidoBySemana.has(semana)) removidoBySemana.set(semana, []);
          removidoBySemana.get(semana)!.push(enriched);
        }
      }
    }

    return { adicionado: adicionadoBySemana, removido: removidoBySemana };
  }, [data]);

  const currentMap = activeTab === "adicionado" ? grouped.adicionado : grouped.removido;

  // Calculate totals
  const totalAdicionado = useMemo(() => {
    let total = 0;
    for (const items of Array.from(grouped.adicionado.values())) {
      for (const item of items) total += Number(item.valor || 0);
    }
    return total;
  }, [grouped]);

  const totalRemovido = useMemo(() => {
    let total = 0;
    for (const items of Array.from(grouped.removido.values())) {
      for (const item of items) total += Number(item.valor || 0);
    }
    return total;
  }, [grouped]);

  const totalCount = useMemo(() => {
    let count = 0;
    for (const items of Array.from(grouped.adicionado.values())) count += items.length;
    for (const items of Array.from(grouped.removido.values())) count += items.length;
    return count;
  }, [grouped]);

  const saldoLiquido = totalAdicionado - totalRemovido;

  // Find max week total for progress bars
  const maxWeekTotal = useMemo(() => {
    let max = 0;
    for (const [, items] of Array.from(currentMap.entries())) {
      const total = items.reduce((s: number, i: any) => s + Number(i.valor || 0), 0);
      if (total > max) max = total;
    }
    return max;
  }, [currentMap]);

  return (
    <div className={`bg-white rounded-2xl border ${isPagar ? "border-red-200/50" : "border-emerald-200/50"} shadow-xl overflow-hidden`}>
      {/* ── Gradient Header ── */}
      <div className={`${isPagar ? "bg-gradient-to-br from-red-700 via-red-600 to-rose-500" : "bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500"} px-5 py-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Histórico Completo
              </h3>
              <p className="text-[11px] text-white/70 font-medium">{title} — Desde início do mês</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="w-3 h-3 text-green-300" />
              <span className="text-[9px] text-white/60 font-semibold uppercase tracking-wider">Acrescentados</span>
            </div>
            <span className="text-sm font-bold text-green-200">+{formatCurrency(totalAdicionado)}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingDown className="w-3 h-3 text-red-300" />
              <span className="text-[9px] text-white/60 font-semibold uppercase tracking-wider">Retirados</span>
            </div>
            <span className="text-sm font-bold text-red-200">-{formatCurrency(totalRemovido)}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
            <div className="flex items-center gap-1 mb-0.5">
              <BarChart3 className="w-3 h-3 text-white/60" />
              <span className="text-[9px] text-white/60 font-semibold uppercase tracking-wider">Saldo Líquido</span>
            </div>
            <span className={`text-sm font-bold ${saldoLiquido >= 0 ? "text-green-200" : "text-red-200"}`}>
              {saldoLiquido >= 0 ? "+" : ""}{formatCurrency(saldoLiquido)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex bg-slate-50 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("adicionado")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-all cursor-pointer border-b-[3px] ${
            activeTab === "adicionado"
              ? "bg-white text-green-700 border-green-500 shadow-sm"
              : "text-slate-400 hover:text-slate-600 border-transparent"
          }`}
        >
          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${activeTab === "adicionado" ? "bg-green-100" : "bg-slate-100"}`}>
            <Plus className={`w-3 h-3 ${activeTab === "adicionado" ? "text-green-600" : "text-slate-400"}`} />
          </div>
          Acrescentados
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeTab === "adicionado" ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-500"
          }`}>
            {Array.from(grouped.adicionado.values()).reduce((s, items) => s + items.length, 0)}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("removido")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-all cursor-pointer border-b-[3px] ${
            activeTab === "removido"
              ? "bg-white text-red-700 border-red-500 shadow-sm"
              : "text-slate-400 hover:text-slate-600 border-transparent"
          }`}
        >
          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${activeTab === "removido" ? "bg-red-100" : "bg-slate-100"}`}>
            <Minus className={`w-3 h-3 ${activeTab === "removido" ? "text-red-600" : "text-slate-400"}`} />
          </div>
          Retirados
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeTab === "removido" ? "bg-red-100 text-red-800" : "bg-slate-200 text-slate-500"
          }`}>
            {Array.from(grouped.removido.values()).reduce((s, items) => s + items.length, 0)}
          </span>
        </button>
      </div>

      {/* ── Content grouped by semana ── */}
      <div className="max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
            <span className="text-xs text-slate-400 font-medium">Carregando histórico de conciliações...</span>
          </div>
        ) : currentMap.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-slate-300" />
            </div>
            <span className="text-sm text-slate-400 font-medium">
              Nenhum item {activeTab === "adicionado" ? "acrescentado" : "retirado"} neste mês
            </span>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {Array.from(currentMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([semana, items]) => {
                const semanaTotal = items.reduce((s: number, i: any) => s + Number(i.valor || 0), 0);
                const isWeekExpanded = expandedWeeks.has(semana);
                const progressPercent = maxWeekTotal > 0 ? (semanaTotal / maxWeekTotal) * 100 : 0;
                
                // Group items by day within this semana
                const byDay: Record<string, any[]> = {};
                for (const item of items) {
                  const date = item._changeDate || item.changeDate;
                  if (!byDay[date]) byDay[date] = [];
                  byDay[date].push(item);
                }
                const dayEntries = Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a));

                return (
                  <div key={semana} className={`rounded-xl border overflow-hidden transition-all ${
                    isWeekExpanded 
                      ? activeTab === "adicionado" ? "border-green-200 shadow-md" : "border-red-200 shadow-md"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }`}>
                    {/* Semana header card */}
                    <button
                      onClick={() => toggleWeek(semana)}
                      className={`w-full px-4 py-3 flex items-center justify-between transition-all cursor-pointer ${
                        isWeekExpanded
                          ? activeTab === "adicionado" ? "bg-green-50" : "bg-red-50"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          activeTab === "adicionado" ? "bg-green-100" : "bg-red-100"
                        }`}>
                          <CalendarDays className={`w-4 h-4 ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`} />
                        </div>
                        <div className="text-left min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">{semana}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">
                              {items.length} {items.length === 1 ? "item" : "itens"}
                            </span>
                          </div>
                          {/* Mini progress bar */}
                          <div className="w-24 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                activeTab === "adicionado" ? "bg-green-400" : "bg-red-400"
                              }`}
                              style={{ width: `${Math.max(progressPercent, 5)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-bold ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`}>
                          {activeTab === "adicionado" ? "+" : "-"}{formatCurrency(semanaTotal)}
                        </span>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform ${isWeekExpanded ? "rotate-180" : ""} ${
                          activeTab === "adicionado" ? "bg-green-100" : "bg-red-100"
                        }`}>
                          <ChevronDown className={`w-3 h-3 ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`} />
                        </div>
                      </div>
                    </button>

                    {/* Days within semana */}
                    {isWeekExpanded && (
                      <div className="border-t border-slate-100">
                        {dayEntries.map(([date, dayItems]) => {
                          const isDayExpanded = expandedDays.has(`${semana}-${date}`);
                          const dayTotal = dayItems.reduce((s: number, i: any) => s + Number(i.valor || 0), 0);

                          return (
                            <div key={date} className="border-b border-slate-50 last:border-b-0">
                              <button
                                onClick={() => toggleDay(`${semana}-${date}`)}
                                className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-50/80 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-2" />
                                  <span className="text-[11px] font-bold text-slate-600">{formatDateBR(date)}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">({getDayName(date)})</span>
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{dayItems.length} itens</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[11px] font-bold ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`}>
                                    {formatCurrency(dayTotal)}
                                  </span>
                                  {isDayExpanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                                </div>
                              </button>

                              {isDayExpanded && (
                                <div className="px-4 pb-3 pl-8 space-y-1">
                                  {dayItems.map((item: any, idx: number) => (
                                    <div key={item.maxiprodId || idx} className="bg-slate-50/80 rounded-lg border border-slate-100 px-3 py-1.5 hover:bg-white hover:border-slate-200 transition-all">
                                      <div className="flex items-center gap-x-2">
                                        {item.changeType === "adicionado" ? (
                                          <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                            <Plus className="w-2.5 h-2.5 text-green-600" />
                                          </div>
                                        ) : item.changeType === "removido" ? (
                                          <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                            <Minus className="w-2.5 h-2.5 text-red-600" />
                                          </div>
                                        ) : (
                                          <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                            <ArrowUpDown className="w-2.5 h-2.5 text-amber-600" />
                                          </div>
                                        )}
                                        <span className="text-[11px] text-slate-700 font-medium truncate min-w-0" style={{ flex: '1 1 0' }}>
                                          {item.nome || "—"}
                                        </span>
                                        {item.vencimentoData && (
                                          <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100 whitespace-nowrap shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                            {formatVencimento(item.vencimentoData)}
                                          </span>
                                        )}
                                        <span className={`text-[11px] font-bold whitespace-nowrap text-right shrink-0 ${
                                          item.changeType === "adicionado" ? "text-green-700" :
                                          item.changeType === "removido" ? "text-red-700" : "text-amber-700"
                                        }`} style={{ width: '85px', fontVariantNumeric: 'tabular-nums' }}>
                                          {item.changeType === "alterado" ? (
                                            <>
                                              <span className="text-slate-400 line-through text-[9px]">{formatCurrency(Number(item.valorAnterior || 0))}</span>
                                              {" → "}
                                              {formatCurrency(Number(item.valor || 0))}
                                            </>
                                          ) : (
                                            formatCurrency(Number(item.valor || 0))
                                          )}
                                        </span>
                                      </div>
                                      {(item.referenteA || item.observacoes) && (
                                        <p className="text-[9px] text-slate-400 truncate pl-6 mt-0.5 italic">
                                          {item.referenteA || item.observacoes}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      {!isLoading && totalCount > 0 && (
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-medium">
            {totalCount} movimentações registradas neste mês
          </span>
          <span className="text-[10px] text-slate-400">
            Conciliação diária automática
          </span>
        </div>
      )}
    </div>
  );
}
