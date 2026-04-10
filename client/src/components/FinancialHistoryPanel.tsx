/**
 * FinancialHistoryPanel - Painel de Histórico de Mudanças Financeiras
 * 
 * Exibe mudanças detectadas nos títulos a pagar/receber desde o início do mês.
 * Mostra: títulos adicionados, removidos e alterados, agrupados por dia.
 */

import React, { useState } from "react";
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

interface FinancialHistoryPanelProps {
  tipo: "pagar" | "receber";
  onClose: () => void;
}

export default function FinancialHistoryPanel({ tipo, onClose }: FinancialHistoryPanelProps) {
  const isPagar = tipo === "pagar";
  const colorScheme = isPagar ? "red" : "emerald";
  const title = isPagar ? "Pagamentos" : "Recebimentos";

  const { data, isLoading } = trpc.financial.getChanges.useQuery({ tipo });

  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  // Calcular totais gerais
  const totalAdicionado = data?.reduce((s, d) => s + d.totalAdicionado, 0) || 0;
  const totalRemovido = data?.reduce((s, d) => s + d.totalRemovido, 0) || 0;
  const saldoLiquido = totalAdicionado - totalRemovido;

  return (
    <div className={`bg-white rounded-xl border-2 ${isPagar ? "border-red-200" : "border-emerald-200"} shadow-lg overflow-hidden`}>
      {/* Header */}
      <div className={`${isPagar ? "bg-red-600" : "bg-emerald-600"} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-white" />
          <h3 className="text-sm font-bold text-white">
            Histórico de Mudanças — {title}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white transition-colors cursor-pointer"
        >
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
        <div className="flex items-center gap-1">
          <ArrowUpDown className="w-3 h-3 text-slate-500" />
          <span className={`text-xs font-bold ${saldoLiquido >= 0 ? "text-green-700" : "text-red-700"}`}>
            Saldo: {saldoLiquido >= 0 ? "+" : ""}{formatCurrency(saldoLiquido)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">
            Nenhuma mudança registrada neste mês
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.map((dayGroup) => {
              const isExpanded = expandedDays.has(dayGroup.date);
              const dayName = getDayName(dayGroup.date);
              const addCount = dayGroup.items.filter((i: any) => i.changeType === "adicionado").length;
              const removeCount = dayGroup.items.filter((i: any) => i.changeType === "removido").length;
              const alterCount = dayGroup.items.filter((i: any) => i.changeType === "alterado").length;

              return (
                <div key={dayGroup.date}>
                  {/* Day header */}
                  <button
                    onClick={() => toggleDay(dayGroup.date)}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-bold text-slate-700">
                        {formatDateBR(dayGroup.date)}
                      </span>
                      <span className="text-xs text-slate-400">({dayName})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {addCount > 0 && (
                        <span className="flex items-center gap-0.5 text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                          <Plus className="w-3 h-3" />{addCount}
                          <span className="text-[10px] ml-0.5 text-green-500">{formatCurrency(dayGroup.totalAdicionado)}</span>
                        </span>
                      )}
                      {removeCount > 0 && (
                        <span className="flex items-center gap-0.5 text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          <Minus className="w-3 h-3" />{removeCount}
                          <span className="text-[10px] ml-0.5 text-red-500">{formatCurrency(dayGroup.totalRemovido)}</span>
                        </span>
                      )}
                      {alterCount > 0 && (
                        <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          <ArrowUpDown className="w-3 h-3" />{alterCount}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {/* Expanded items */}
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-1">
                      {/* Group by changeType */}
                      {["adicionado", "removido", "alterado"].map(changeType => {
                        const items = dayGroup.items.filter((i: any) => i.changeType === changeType);
                        if (items.length === 0) return null;

                        const typeConfig = {
                          adicionado: { label: "Adicionados", icon: Plus, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
                          removido: { label: "Removidos / Pagos", icon: Minus, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
                          alterado: { label: "Valor Alterado", icon: ArrowUpDown, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
                        }[changeType]!;

                        const Icon = typeConfig.icon;
                        const subtotal = items.reduce((s: number, i: any) => s + Number(i.valor || 0), 0);

                        return (
                          <div key={changeType} className={`rounded-lg border ${typeConfig.border} ${typeConfig.bg} p-2`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <Icon className={`w-3.5 h-3.5 ${typeConfig.color}`} />
                                <span className={`text-xs font-bold ${typeConfig.color}`}>{typeConfig.label}</span>
                                <span className="text-[10px] text-slate-400">({items.length})</span>
                              </div>
                              <span className={`text-xs font-bold ${typeConfig.color}`}>{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="space-y-0.5">
                              {items.map((item: any, idx: number) => (
                                <div key={item.maxiprodId || idx} className="text-xs leading-5">
                                  <div className="flex items-center gap-x-1.5">
                                    <span className="text-slate-600 truncate min-w-0" style={{ flex: '1 1 0' }}>
                                      {item.nome || "—"}
                                    </span>
                                    {item.vencimentoData && (
                                      <span className="text-slate-400 whitespace-nowrap text-right shrink-0 text-[10px]" style={{ width: '42px', fontVariantNumeric: 'tabular-nums' }}>
                                        {formatVencimento(item.vencimentoData)}
                                      </span>
                                    )}
                                    <span className={`font-semibold whitespace-nowrap text-right shrink-0 ${
                                      changeType === "adicionado" ? "text-green-700" :
                                      changeType === "removido" ? "text-red-700" : "text-amber-700"
                                    }`} style={{ width: '78px', fontVariantNumeric: 'tabular-nums' }}>
                                      {changeType === "alterado" ? (
                                        <>
                                          <span className="text-slate-400 line-through text-[10px]">{formatCurrency(Number(item.valorAnterior || 0))}</span>
                                          {" → "}
                                          {formatCurrency(Number(item.valor || 0))}
                                        </>
                                      ) : (
                                        formatCurrency(Number(item.valor || 0))
                                      )}
                                    </span>
                                  </div>
                                  {(item.referenteA || item.observacoes) && (
                                    <p className="text-[10px] text-slate-400 truncate pl-0.5 mt-0.5">
                                      {item.referenteA || item.observacoes}
                                    </p>
                                  )}
                                  {item.semanaLabel && (
                                    <span className="text-[9px] text-slate-400 bg-slate-100 rounded px-1 py-0.5 inline-block mt-0.5">
                                      Semana: {item.semanaLabel}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
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
    </div>
  );
}
