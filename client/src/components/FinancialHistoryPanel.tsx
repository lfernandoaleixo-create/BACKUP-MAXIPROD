/**
 * FinancialHistoryPanel - Painel de Histórico de Mudanças Financeiras
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

  // Flatten all items and separate by type
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

  // Group current tab items by day
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
    <div className={`mt-2 rounded-lg border ${isPagar ? "border-red-200 bg-red-50/30" : "border-emerald-200 bg-emerald-50/30"} overflow-hidden`}>
      {/* Header */}
      <div className={`${isPagar ? "bg-red-100" : "bg-emerald-100"} px-3 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-xs font-bold text-slate-700">Histórico — {semanaLabel}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      ) : !hasChanges ? (
        <div className="text-center py-4 text-xs text-slate-400">
          Nenhuma mudança registrada nesta semana
        </div>
      ) : (
        <>
          {/* Tabs: Acrescentados / Retirados */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("adicionado")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "adicionado"
                  ? "bg-green-50 text-green-700 border-b-2 border-green-500"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Acrescentados</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === "adicionado" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
              }`}>
                {allItems.adicionado.length}
              </span>
              {totalAdicionado > 0 && (
                <span className="text-[10px] text-green-600 font-bold">
                  +{formatCurrency(totalAdicionado)}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("removido")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "removido"
                  ? "bg-red-50 text-red-700 border-b-2 border-red-500"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Retirados</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === "removido" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
              }`}>
                {allItems.removido.length + allItems.alterado.length}
              </span>
              {totalRemovido > 0 && (
                <span className="text-[10px] text-red-600 font-bold">
                  -{formatCurrency(totalRemovido)}
                </span>
              )}
            </button>
          </div>

          {/* Items grouped by day */}
          <div className="max-h-[300px] overflow-y-auto">
            {groupedByDay.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">
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
                        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="w-3 h-3 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-600">{formatDateBR(date)}</span>
                          <span className="text-[10px] text-slate-400">({getDayName(date)})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">{items.length} itens</span>
                          <span className={`text-[11px] font-bold ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(dayTotal)}
                          </span>
                          {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-2 space-y-0.5">
                          {items.map((item: any, idx: number) => (
                            <div key={item.maxiprodId || idx} className="text-[11px] leading-5">
                              <div className="flex items-center gap-x-1.5">
                                {item.changeType === "adicionado" ? (
                                  <Plus className="w-3 h-3 text-green-500 shrink-0" />
                                ) : item.changeType === "removido" ? (
                                  <Minus className="w-3 h-3 text-red-500 shrink-0" />
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 text-amber-500 shrink-0" />
                                )}
                                <span className="text-slate-600 truncate min-w-0" style={{ flex: '1 1 0' }}>
                                  {item.nome || "—"}
                                </span>
                                {item.vencimentoData && (
                                  <span className="text-slate-400 whitespace-nowrap text-right shrink-0 text-[10px]" style={{ width: '42px', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatVencimento(item.vencimentoData)}
                                  </span>
                                )}
                                <span className={`font-semibold whitespace-nowrap text-right shrink-0 ${
                                  item.changeType === "adicionado" ? "text-green-700" :
                                  item.changeType === "removido" ? "text-red-700" : "text-amber-700"
                                }`} style={{ width: '80px', fontVariantNumeric: 'tabular-nums' }}>
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
                                <p className="text-[9px] text-slate-400 truncate pl-5 mt-0">
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

  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"adicionado" | "removido">("adicionado");

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

  return (
    <div className={`bg-white rounded-xl border-2 ${isPagar ? "border-red-200" : "border-emerald-200"} shadow-lg overflow-hidden`}>
      {/* Header */}
      <div className={`${isPagar ? "bg-red-600" : "bg-emerald-600"} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-white" />
          <h3 className="text-sm font-bold text-white">
            Histórico Completo — {title}
          </h3>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Summary bar */}
      <div className={`${isPagar ? "bg-red-50" : "bg-emerald-50"} px-4 py-2 flex items-center justify-between border-b ${isPagar ? "border-red-100" : "border-emerald-100"}`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Plus className="w-3 h-3 text-green-600" />
            <span className="text-xs font-semibold text-green-700">{formatCurrency(totalAdicionado)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Minus className="w-3 h-3 text-red-600" />
            <span className="text-xs font-semibold text-red-700">{formatCurrency(totalRemovido)}</span>
          </div>
        </div>
        <span className="text-[10px] text-slate-400">Desde início do mês</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("adicionado")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "adicionado"
              ? "bg-green-50 text-green-700 border-b-2 border-green-500"
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Acrescentados
        </button>
        <button
          onClick={() => setActiveTab("removido")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "removido"
              ? "bg-red-50 text-red-700 border-b-2 border-red-500"
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Retirados
        </button>
      </div>

      {/* Content grouped by semana */}
      <div className="max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : currentMap.size === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">
            Nenhum item {activeTab === "adicionado" ? "acrescentado" : "retirado"} neste mês
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {Array.from(currentMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([semana, items]) => {
                const semanaTotal = items.reduce((s: number, i: any) => s + Number(i.valor || 0), 0);
                
                // Group items by day within this semana
                const byDay: Record<string, any[]> = {};
                for (const item of items) {
                  const date = item._changeDate || item.changeDate;
                  if (!byDay[date]) byDay[date] = [];
                  byDay[date].push(item);
                }
                const dayEntries = Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a));

                return (
                  <div key={semana} className="py-2">
                    {/* Semana header */}
                    <div className={`px-4 py-1.5 flex items-center justify-between ${
                      activeTab === "adicionado" ? "bg-green-50/50" : "bg-red-50/50"
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs font-bold text-slate-700">{semana}</span>
                        <span className="text-[10px] text-slate-400">({items.length} itens)</span>
                      </div>
                      <span className={`text-xs font-bold ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`}>
                        {activeTab === "adicionado" ? "+" : "-"}{formatCurrency(semanaTotal)}
                      </span>
                    </div>

                    {/* Days within semana */}
                    {dayEntries.map(([date, dayItems]) => {
                      const isExpanded = expandedDays.has(`${semana}-${date}`);
                      const dayTotal = dayItems.reduce((s: number, i: any) => s + Number(i.valor || 0), 0);

                      return (
                        <div key={date}>
                          <button
                            onClick={() => toggleDay(`${semana}-${date}`)}
                            className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-slate-600 ml-4">{formatDateBR(date)}</span>
                              <span className="text-[10px] text-slate-400">({getDayName(date)})</span>
                              <span className="text-[10px] text-slate-400">{dayItems.length} itens</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[11px] font-bold ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`}>
                                {formatCurrency(dayTotal)}
                              </span>
                              {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-2 ml-4 space-y-0.5">
                              {dayItems.map((item: any, idx: number) => (
                                <div key={item.maxiprodId || idx} className="text-[11px] leading-5">
                                  <div className="flex items-center gap-x-1.5">
                                    {item.changeType === "adicionado" ? (
                                      <Plus className="w-3 h-3 text-green-500 shrink-0" />
                                    ) : item.changeType === "removido" ? (
                                      <Minus className="w-3 h-3 text-red-500 shrink-0" />
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 text-amber-500 shrink-0" />
                                    )}
                                    <span className="text-slate-600 truncate min-w-0" style={{ flex: '1 1 0' }}>
                                      {item.nome || "—"}
                                    </span>
                                    {item.vencimentoData && (
                                      <span className="text-slate-400 whitespace-nowrap text-right shrink-0 text-[10px]" style={{ width: '42px', fontVariantNumeric: 'tabular-nums' }}>
                                        {formatVencimento(item.vencimentoData)}
                                      </span>
                                    )}
                                    <span className={`font-semibold whitespace-nowrap text-right shrink-0 ${
                                      item.changeType === "adicionado" ? "text-green-700" :
                                      item.changeType === "removido" ? "text-red-700" : "text-amber-700"
                                    }`} style={{ width: '80px', fontVariantNumeric: 'tabular-nums' }}>
                                      {formatCurrency(Number(item.valor || 0))}
                                    </span>
                                  </div>
                                  {(item.referenteA || item.observacoes) && (
                                    <p className="text-[9px] text-slate-400 truncate pl-5 mt-0">
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
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
