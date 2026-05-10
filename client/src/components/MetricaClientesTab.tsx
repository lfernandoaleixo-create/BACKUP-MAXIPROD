/**
 * Métrica de Clientes - Avaliação de vendedores por captação e manutenção de clientes
 * 
 * Métricas:
 * 1. Clientes Novos: primeira compra OU reativados (6+ meses sem comprar)
 * 2. Clientes Herdados: já compravam antes da admissão do vendedor
 * 3. Intervalo de Recompra: alerta quando cliente passa do intervalo esperado
 */

import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  UserPlus,
  UserCheck,
  Calendar,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info,
} from "lucide-react";

const SELLERS = ["JORDAO", "JUVENAL TEIXEIRA", "PAULA", "GILSON", "PEDRO AUGUSTO"];

export default function MetricaClientesTab() {
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [editingDates, setEditingDates] = useState<Record<string, string>>({});

  // Fetch all seller admissions
  const { data: admissions, isLoading: loadingAdmissions, refetch: refetchAdmissions } = trpc.sales.listSellerAdmissions.useQuery();

  // Upsert mutation
  const upsertMutation = trpc.sales.upsertSellerAdmission.useMutation({
    onSuccess: () => {
      toast.success("Data de admissão atualizada com sucesso.");
      refetchAdmissions();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Build a map of seller -> admission date
  const admissionMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (admissions) {
      for (const a of admissions) {
        const d = new Date(a.admissionDate);
        map[a.sellerName] = d.toISOString().slice(0, 10);
      }
    }
    return map;
  }, [admissions]);

  const handleSaveDate = (sellerName: string) => {
    const dateStr = editingDates[sellerName];
    if (!dateStr) {
      toast.error("Preencha a data de admissão.");
      return;
    }
    upsertMutation.mutate({ sellerName, admissionDate: dateStr });
  };

  const getDisplayDate = (seller: string) => {
    if (editingDates[seller] !== undefined) return editingDates[seller];
    return admissionMap[seller] || "";
  };

  const handleDateChange = (seller: string, value: string) => {
    setEditingDates(prev => ({ ...prev, [seller]: value }));
  };

  const hasAdmissionDate = (seller: string) => !!admissionMap[seller];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          Métrica de Clientes
        </h2>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Avaliação de vendedores por captação e manutenção de clientes
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 md:p-4">
        <div className="flex items-start gap-2 md:gap-3">
          <Info className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs md:text-sm text-blue-800 dark:text-blue-300 min-w-0">
            <p className="font-medium mb-1">Como funciona:</p>
            <ul className="list-disc list-inside space-y-1 text-[11px] md:text-xs">
              <li><strong>Cliente Novo:</strong> Primeira compra na empresa OU não comprava há 6+ meses</li>
              <li><strong>Cliente Herdado:</strong> Já comprava antes do vendedor entrar (últimos 6 meses)</li>
              <li><strong>Cliente Reativado:</strong> Não comprava há 6+ meses, mas voltou com o vendedor</li>
            </ul>
            <p className="mt-2 text-[11px] md:text-xs italic">Preencha a data de admissão de cada vendedor para ativar as métricas.</p>
          </div>
        </div>
      </div>

      {/* Seller Admission Dates */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-3 md:px-4 py-2.5 md:py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
          <h3 className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            Data de Admissão dos Vendedores
          </h3>
        </div>

        {loadingAdmissions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {SELLERS.map((seller) => (
              <div key={seller} className="px-3 md:px-4 py-3">
                {/* Mobile: stacked layout | Desktop: horizontal layout */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  {/* Seller name */}
                  <div className="flex items-center gap-2 sm:flex-1 sm:min-w-0">
                    <span className="text-xs md:text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {seller}
                    </span>
                    {hasAdmissionDate(seller) && (
                      <span className="text-[10px] md:text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap flex-shrink-0">
                        ✓ Salvo
                      </span>
                    )}
                  </div>

                  {/* Date input + save button */}
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={getDisplayDate(seller)}
                      onChange={(e) => handleDateChange(seller, e.target.value)}
                      className="flex-1 sm:w-40 sm:flex-none h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSaveDate(seller)}
                      disabled={upsertMutation.isPending}
                      className="h-8 px-2.5 flex-shrink-0"
                    >
                      {upsertMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Metrics toggle (if admission date exists) */}
                {hasAdmissionDate(seller) && (
                  <div className="mt-2">
                    <button
                      onClick={() => setExpandedSeller(expandedSeller === seller ? null : seller)}
                      className="flex items-center gap-1 text-[11px] md:text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {expandedSeller === seller ? (
                        <>
                          <ChevronUp className="w-3 h-3 flex-shrink-0" />
                          Ocultar métricas
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3 flex-shrink-0" />
                          Ver métricas
                        </>
                      )}
                    </button>

                    {expandedSeller === seller && (
                      <SellerMetricsCard sellerName={seller} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Individual seller metrics card */
function SellerMetricsCard({ sellerName }: { sellerName: string }) {
  const { data: metrics, isLoading } = trpc.sales.getClientMetrics.useQuery({ sellerName });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3">
        <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
        <span className="text-xs text-slate-500">Calculando métricas...</span>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="py-2 text-[11px] md:text-xs text-slate-500 dark:text-slate-400">
        Sem dados disponíveis. Verifique se há pedidos registrados para este vendedor.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {/* KPI Cards - 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 md:gap-2">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2 md:p-2.5">
          <div className="flex items-center gap-1 md:gap-1.5 mb-0.5 md:mb-1">
            <UserPlus className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="text-[9px] md:text-[10px] font-medium text-emerald-700 dark:text-emerald-300 uppercase truncate">Novos</span>
          </div>
          <p className="text-base md:text-lg font-bold text-emerald-800 dark:text-emerald-200">{metrics.clientesNovos}</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 md:p-2.5">
          <div className="flex items-center gap-1 md:gap-1.5 mb-0.5 md:mb-1">
            <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-[9px] md:text-[10px] font-medium text-amber-700 dark:text-amber-300 uppercase truncate">Reativados</span>
          </div>
          <p className="text-base md:text-lg font-bold text-amber-800 dark:text-amber-200">{metrics.clientesReativados}</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-lg p-2 md:p-2.5">
          <div className="flex items-center gap-1 md:gap-1.5 mb-0.5 md:mb-1">
            <UserCheck className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-600 dark:text-slate-400 flex-shrink-0" />
            <span className="text-[9px] md:text-[10px] font-medium text-slate-700 dark:text-slate-300 uppercase truncate">Herdados</span>
          </div>
          <p className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-200">{metrics.clientesHerdados}</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 md:p-2.5">
          <div className="flex items-center gap-1 md:gap-1.5 mb-0.5 md:mb-1">
            <Users className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="text-[9px] md:text-[10px] font-medium text-blue-700 dark:text-blue-300 uppercase truncate">Total</span>
          </div>
          <p className="text-base md:text-lg font-bold text-blue-800 dark:text-blue-200">{metrics.totalClientes}</p>
        </div>
      </div>

      {/* Client lists */}
      {metrics.clientesNovos > 0 && (
        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg p-2.5 md:p-3 border border-emerald-100 dark:border-emerald-800/50">
          <h4 className="text-[11px] md:text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1.5">
            Clientes Novos Abertos ({metrics.clientesNovos})
          </h4>
          <div className="flex flex-wrap gap-1">
            {metrics.listaClientesNovos.map((c, i) => (
              <span key={i} className="text-[9px] md:text-[10px] bg-emerald-100 dark:bg-emerald-800/40 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded break-all">
                {c}
              </span>
            ))}
            {metrics.clientesNovos > 50 && (
              <span className="text-[9px] md:text-[10px] text-emerald-600 dark:text-emerald-400 italic">
                +{metrics.clientesNovos - 50} outros...
              </span>
            )}
          </div>
        </div>
      )}

      {metrics.clientesReativados > 0 && (
        <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-lg p-2.5 md:p-3 border border-amber-100 dark:border-amber-800/50">
          <h4 className="text-[11px] md:text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1.5">
            Clientes Reativados ({metrics.clientesReativados})
          </h4>
          <div className="flex flex-wrap gap-1">
            {metrics.listaClientesReativados.map((c, i) => (
              <span key={i} className="text-[9px] md:text-[10px] bg-amber-100 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded break-all">
                {c}
              </span>
            ))}
            {metrics.clientesReativados > 50 && (
              <span className="text-[9px] md:text-[10px] text-amber-600 dark:text-amber-400 italic">
                +{metrics.clientesReativados - 50} outros...
              </span>
            )}
          </div>
        </div>
      )}

      {metrics.clientesHerdados > 0 && (
        <div className="bg-slate-50/50 dark:bg-slate-700/10 rounded-lg p-2.5 md:p-3 border border-slate-200 dark:border-slate-600/50">
          <h4 className="text-[11px] md:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Clientes Herdados ({metrics.clientesHerdados})
          </h4>
          <div className="flex flex-wrap gap-1">
            {metrics.listaClientesHerdados.map((c, i) => (
              <span key={i} className="text-[9px] md:text-[10px] bg-slate-100 dark:bg-slate-700/40 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded break-all">
                {c}
              </span>
            ))}
            {metrics.clientesHerdados > 50 && (
              <span className="text-[9px] md:text-[10px] text-slate-600 dark:text-slate-400 italic">
                +{metrics.clientesHerdados - 50} outros...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
