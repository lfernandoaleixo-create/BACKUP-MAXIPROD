/**
 * SellerCobrancaView - Planilha de Cobrança filtrada por vendedor
 * Exibe na aba de Vendas do vendedor os títulos inadimplentes dos seus clientes
 * com todas as informações: status, etapas, histórico e observações.
 * 
 * Também mostra alertas do setor de cobrança (sistema "Acionar Vendedor").
 */
import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  FileText,
  MessageSquare,
  Phone,
  Mail,
  CheckCircle2,
  Bell,
  Eye,
} from "lucide-react";

interface SellerCobrancaViewProps {
  sellerName: string;
  onAlertCount?: (count: number) => void;
}

function formatCurrency(value: number | string | null): string {
  if (!value) return "R$ 0,00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function SellerCobrancaView({ sellerName, onAlertCount }: SellerCobrancaViewProps) {
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [expandedAlert, setExpandedAlert] = useState<number | null>(null);

  // Fetch cobrança data for this seller
  const { data: cobrancaData, isLoading } = trpc.cobrancaPlanilha.getByVendedor.useQuery(
    { vendedor: sellerName },
    { staleTime: 60 * 1000 }
  );

  // Fetch pending alerts for this seller
  const { data: alerts, refetch: refetchAlerts } = trpc.cobrancaPlanilha.getSellerAlerts.useQuery(
    { vendedor: sellerName },
    { staleTime: 10 * 1000 }
  );

  const markViewedMutation = trpc.cobrancaPlanilha.markAlertViewed.useMutation({
    onSuccess: () => refetchAlerts(),
  });

  const markResolvedMutation = trpc.cobrancaPlanilha.markAlertResolved.useMutation({
    onSuccess: () => refetchAlerts(),
  });

  // Notify parent about alert count
  const pendingAlerts = useMemo(() => {
    return alerts?.filter(a => a.status === "pendente") || [];
  }, [alerts]);

  // Notify parent about alert count via useEffect (not during render)
  useEffect(() => {
    onAlertCount?.(pendingAlerts.length);
  }, [pendingAlerts.length, onAlertCount]);

  // Group items by empresa
  const clientGroups = useMemo(() => {
    if (!cobrancaData?.items) return [];
    const groups: Record<string, typeof cobrancaData.items> = {};
    for (const item of cobrancaData.items) {
      const key = item.empresa;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return Object.entries(groups).map(([empresa, items]) => ({
      empresa,
      items,
      totalValor: items.reduce((sum, i) => sum + parseFloat(String(i.valor || "0")), 0),
      maxDias: Math.max(...items.map(i => i.diasVencidos || 0)),
      cnpj: items[0]?.cnpjCpf || "",
    })).sort((a, b) => b.maxDias - a.maxDias);
  }, [cobrancaData]);

  // Get etapa observations for a specific item
  const getEtapaObs = (planilhaId: number) => {
    return cobrancaData?.etapasObs?.filter(o => o.planilhaId === planilhaId) || [];
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 text-red-500 animate-spin" />
          <span className="text-sm text-slate-500">Carregando dados de cobrança...</span>
        </div>
      </div>
    );
  }

  const totalItems = cobrancaData?.items?.length || 0;
  const totalValor = cobrancaData?.items?.reduce((sum, i) => sum + parseFloat(String(i.valor || "0")), 0) || 0;

  if (totalItems === 0 && (!alerts || alerts.length === 0)) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-700 p-6">
        <div className="text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Nenhum título inadimplente</p>
          <p className="text-xs text-slate-400 mt-1">Seus clientes estão em dia!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alertas do setor de cobrança (pisca quando pendente) */}
      {pendingAlerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600 rounded-xl p-4 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-red-600 animate-bounce" />
            <h3 className="text-sm font-bold text-red-700 dark:text-red-400">
              Intervenção Necessária ({pendingAlerts.length})
            </h3>
          </div>
          <p className="text-xs text-red-600 dark:text-red-400 mb-3">
            O setor de cobrança precisa da sua intervenção nos clientes abaixo:
          </p>
          <div className="space-y-2">
            {pendingAlerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-700 p-3 cursor-pointer hover:shadow-md transition-all"
                onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">{alert.empresa}</p>
                    <p className="text-[10px] text-slate-500">
                      {alert.titulosVencidos} título(s) • {alert.diasAtrasoMax}d atraso • {formatCurrency(alert.valorTotal)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Acionado por {alert.criadoPor} em {new Date(alert.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedAlert === alert.id ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>
                {expandedAlert === alert.id && (
                  <div className="mt-3 pt-3 border-t border-red-100 dark:border-red-800">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mensagem da cobrança:</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 bg-red-50 dark:bg-red-900/30 p-2 rounded-lg whitespace-pre-wrap">
                      {alert.mensagem}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markViewedMutation.mutate({ id: alert.id });
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 text-[11px] font-medium rounded-lg hover:bg-amber-200 transition-colors"
                      >
                        <Eye className="w-3 h-3" /> Marcar como Visto
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markResolvedMutation.mutate({ id: alert.id });
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-[11px] font-medium rounded-lg hover:bg-emerald-200 transition-colors"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Resolvido
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumo geral */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-700 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-red-700 dark:text-red-400">Planilha de Cobrança</h3>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-red-600 font-medium">{clientGroups.length} cliente(s)</span>
              <span className="text-red-600 font-medium">{totalItems} título(s)</span>
              <span className="text-red-700 font-bold">{formatCurrency(totalValor)}</span>
            </div>
          </div>
        </div>

        {/* Client list */}
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {clientGroups.map((group) => (
            <div key={group.empresa}>
              {/* Client header - clickable to expand */}
              <button
                onClick={() => setExpandedClient(expandedClient === group.empresa ? null : group.empresa)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${group.maxDias > 30 ? 'bg-red-500' : group.maxDias > 15 ? 'bg-amber-500' : 'bg-yellow-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{group.empresa}</p>
                    <p className="text-[10px] text-slate-400">
                      {group.items.length} título(s) • máx {group.maxDias}d atraso
                      {group.cnpj && ` • ${group.cnpj}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-red-600">{formatCurrency(group.totalValor)}</span>
                  {expandedClient === group.empresa ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Expanded client details */}
              {expandedClient === group.empresa && (
                <div className="px-4 pb-4 bg-slate-50 dark:bg-slate-800/50">
                  {group.items.map((item) => {
                    const obs = getEtapaObs(item.id);
                    return (
                      <div key={item.id} className="mt-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                        {/* Title info */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              item.status === 'Pendente' ? 'bg-amber-100 text-amber-700' :
                              item.status === 'Contatado' ? 'bg-blue-100 text-blue-700' :
                              item.status === 'Em negociação' ? 'bg-green-100 text-green-700' :
                              item.status === 'Promessa de Pgto' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {item.status}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Doc: {item.documento || "-"} • {item.tipo || "Título"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${item.diasVencidos && item.diasVencidos > 30 ? 'text-red-600' : 'text-amber-600'}`}>
                              {item.diasVencidos}d
                            </span>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              {formatCurrency(item.valor)}
                            </span>
                          </div>
                        </div>

                        {/* Dates and details */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-500 mb-2">
                          <div>
                            <span className="text-slate-400">Vencimento:</span>{" "}
                            <span className="font-medium">{formatDate(item.vencimento)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Forma:</span>{" "}
                            <span className="font-medium">{item.formaCobranca || "-"}</span>
                          </div>
                          {item.contato && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" />
                              <span className="font-medium">{item.contato}</span>
                            </div>
                          )}
                          {item.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-2.5 h-2.5" />
                              <span className="font-medium">{item.email}</span>
                            </div>
                          )}
                        </div>

                        {/* Etapas de cobrança */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {[
                            { label: "1ª Cob", value: item.primeiraCobranca },
                            { label: "S/A 1", value: item.semAcao1 },
                            { label: "2ª Cob", value: item.segundaCobranca },
                            { label: "S/A 2", value: item.semAcao2 },
                            { label: "3ª Cob", value: item.terceiraCobranca },
                            { label: "S/A 3", value: item.semAcao3 },
                            { label: "Ação Final", value: item.acaoFinal },
                          ].map((etapa, idx) => (
                            <div key={idx} className={`text-center p-1 rounded ${etapa.value ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200' : 'bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600'}`}>
                              <p className="text-[8px] text-slate-400 uppercase">{etapa.label}</p>
                              <p className={`text-[9px] font-medium ${etapa.value ? 'text-emerald-700' : 'text-slate-300'}`}>
                                {etapa.value ? formatDate(etapa.value) : "—"}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Observações do título */}
                        {item.observacoes && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 mb-2 border border-amber-100 dark:border-amber-800">
                            <div className="flex items-center gap-1 mb-0.5">
                              <FileText className="w-2.5 h-2.5 text-amber-600" />
                              <span className="text-[9px] font-bold text-amber-700 uppercase">Observações</span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{item.observacoes}</p>
                          </div>
                        )}

                        {/* Histórico de etapas (observações por etapa) */}
                        {obs.length > 0 && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-100 dark:border-blue-800">
                            <div className="flex items-center gap-1 mb-1">
                              <MessageSquare className="w-2.5 h-2.5 text-blue-600" />
                              <span className="text-[9px] font-bold text-blue-700 uppercase">Histórico de Etapas</span>
                            </div>
                            <div className="space-y-1">
                              {obs.slice(0, 5).map((o, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-[10px]">
                                  <span className="text-blue-500 font-medium whitespace-nowrap">
                                    {o.etapa?.replace("Cobranca", " Cob").replace("semAcao", "S/A ").replace("primeira", "1ª").replace("segunda", "2ª").replace("terceira", "3ª").replace("acaoFinal", "Ação Final") || "—"}:
                                  </span>
                                  <span className="text-slate-600 dark:text-slate-400">{o.observacao}</span>
                                  <span className="text-slate-300 whitespace-nowrap ml-auto">
                                    {o.registradoPor} • {o.createdAt ? new Date(o.createdAt).toLocaleDateString("pt-BR") : ""}
                                  </span>
                                </div>
                              ))}
                              {obs.length > 5 && (
                                <p className="text-[9px] text-blue-400">+ {obs.length - 5} registros anteriores</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Viewed/resolved alerts history */}
      {alerts && alerts.filter(a => a.status !== "pendente").length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Alertas Anteriores</p>
          <div className="space-y-2">
            {alerts.filter(a => a.status !== "pendente").map((alert) => (
              <div key={alert.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg text-xs">
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{alert.empresa}</span>
                  <span className="text-slate-400 ml-2">
                    {new Date(alert.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  alert.status === "visto" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {alert.status === "visto" ? "Visto" : "Resolvido"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
