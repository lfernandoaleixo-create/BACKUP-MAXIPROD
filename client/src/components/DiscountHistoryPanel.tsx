/**
 * Painel de Histórico de Descontos — Mostra todos os descontos já realizados
 * com opção de gerar PDF sob demanda de qualquer desconto passado.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { generateDiscountPdf, type DiscountHistoryRecord } from "@/lib/discountPdfExport";
import {
  History,
  FileDown,
  ChevronDown,
  ChevronUp,
  Calendar,
  DollarSign,
  FileText,
  User,
  Building2,
  Landmark,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR");
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatMonthLabel(mesKey: string) {
  const [y, m] = mesKey.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

export default function DiscountHistoryPanel({ onClose }: { onClose: () => void }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<number | null>(null);

  const { data: history, isLoading } = trpc.financial.getDiscountHistoryAll.useQuery({ limit: 100 });

  async function handleGeneratePdf(record: DiscountHistoryRecord) {
    setGeneratingPdf(record.id);
    try {
      await generateDiscountPdf(record);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGeneratingPdf(null);
    }
  }

  return (
    <div className="bg-white border-2 border-indigo-200 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Histórico de Descontos</h3>
              <p className="text-indigo-200 text-xs">Todos os descontos realizados no Sicoob</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            <span className="ml-2 text-sm text-slate-500">Carregando histórico...</span>
          </div>
        ) : !history || history.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Nenhum desconto registrado</p>
            <p className="text-xs mt-1">Os descontos aparecerão aqui após serem finalizados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((record: any) => {
              const isExpanded = expandedId === record.id;
              const titulos = JSON.parse(record.titulosJson || "[]");
              const valorTotal = typeof record.valorTotal === "string" ? parseFloat(record.valorTotal) : record.valorTotal;

              return (
                <div key={record.id} className="border border-slate-200 rounded-xl overflow-hidden hover:border-indigo-300 transition-colors">
                  {/* Summary row */}
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {record.operatorName?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-slate-800">{record.operatorName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">{record.empresa}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">{formatMonthLabel(record.mesKey)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDateTime(record.createdAt)}
                        </span>
                        <span className="text-xs font-semibold text-teal-700 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {formatCurrency(valorTotal)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {record.totalTitulos} título(s)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGeneratePdf(record as DiscountHistoryRecord);
                        }}
                        disabled={generatingPdf === record.id}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[11px] font-bold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all flex items-center gap-1.5 disabled:opacity-50"
                        title="Gerar PDF deste desconto"
                      >
                        {generatingPdf === record.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileDown className="w-3.5 h-3.5" />
                        )}
                        PDF
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/50 p-3">
                      {/* Info row */}
                      <div className="flex flex-wrap gap-3 mb-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-blue-500" />
                          <span className="font-medium">{record.empresa}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Landmark className="w-3.5 h-3.5 text-green-500" />
                          <span className="font-medium">{record.contaLabel}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <User className="w-3.5 h-3.5 text-purple-500" />
                          <span className="font-medium">Autorizado por {record.operatorName}</span>
                        </div>
                      </div>

                      {/* Titles table */}
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="px-2 py-2 text-left font-semibold text-slate-600 uppercase text-[10px]">Cliente</th>
                              <th className="px-2 py-2 text-center font-semibold text-slate-600 uppercase text-[10px]">Doc</th>
                              <th className="px-2 py-2 text-right font-semibold text-slate-600 uppercase text-[10px]">Valor</th>
                              <th className="px-2 py-2 text-center font-semibold text-slate-600 uppercase text-[10px]">Vencimento</th>
                            </tr>
                          </thead>
                          <tbody>
                            {titulos.map((t: any, idx: number) => (
                              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                <td className="px-2 py-1.5 text-slate-700 truncate max-w-[200px]" title={t.cliente}>{t.cliente}</td>
                                <td className="px-2 py-1.5 text-center text-slate-500">{t.documento || "—"}</td>
                                <td className="px-2 py-1.5 text-right font-semibold text-slate-800">{formatCurrency(t.valor)}</td>
                                <td className="px-2 py-1.5 text-center text-slate-500">{formatDate(t.vencimento)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-teal-50 border-t-2 border-teal-200">
                              <td colSpan={2} className="px-2 py-2 font-bold text-teal-800 text-xs">TOTAL ({titulos.length} títulos)</td>
                              <td className="px-2 py-2 text-right font-bold text-teal-800 text-sm">{formatCurrency(valorTotal)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
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
