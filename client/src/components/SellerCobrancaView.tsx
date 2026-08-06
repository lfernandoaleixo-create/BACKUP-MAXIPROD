/**
 * SellerCobrancaView - Planilha de Cobrança filtrada por vendedor
 * Exibe na aba de Vendas do vendedor os títulos inadimplentes dos seus clientes
 * com todas as informações: status, etapas, histórico e observações.
 * 
 * Também mostra alertas do setor de cobrança (sistema "Acionar Vendedor").
 * - Campo de resposta para o vendedor informar resultado da negociação
 * - Filtro rápido para listar apenas clientes com alertas pendentes
 * - Botão "Resolvido" adiciona nota no histórico de cobrança do financeiro
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
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
  Send,
  Filter,
} from "lucide-react";
import { MessageCircle, History } from "lucide-react";

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
  const [respostaTexts, setRespostaTexts] = useState<Record<number, string>>({});
  const [filterAlertOnly, setFilterAlertOnly] = useState(false);

  // Fetch cobrança data for this seller
  const { data: cobrancaData, isLoading } = trpc.cobrancaPlanilha.getByVendedor.useQuery(
    { vendedor: sellerName },
    { staleTime: 60 * 1000 }
  );

  // Fetch pending alerts for this seller (polling every 15s for real-time notifications)
  const { data: alerts, refetch: refetchAlerts } = trpc.cobrancaPlanilha.getSellerAlerts.useQuery(
    { vendedor: sellerName },
    { staleTime: 5 * 1000, refetchInterval: 15 * 1000 }
  );

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Track previous alert IDs to detect new alerts and show toast notification
  const prevAlertIdsRef = useRef<Set<number>>(new Set());
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (!alerts) return;
    const currentIds = new Set(alerts.map(a => a.id));
    
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      prevAlertIdsRef.current = currentIds;
      return;
    }

    // Detect new alerts that weren't in the previous set
    const newAlerts = alerts.filter(a => !prevAlertIdsRef.current.has(a.id) && a.status === 'pendente');
    
    if (newAlerts.length > 0) {
      for (const alert of newAlerts) {
        toast.error(`🔔 Novo alerta de cobrança!`, {
          description: `${alert.empresa} - ${alert.mensagem?.substring(0, 100)}${(alert.mensagem?.length || 0) > 100 ? '...' : ''}`,
          duration: 15000,
        });
      }
      // Also play a sound effect via browser notification if possible
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Alerta de Cobrança - Grupo Fox', {
            body: `${newAlerts.length} novo(s) alerta(s) do setor financeiro`,
            icon: '/favicon.ico',
          });
        }
      } catch (e) { /* ignore */ }
    }
    prevAlertIdsRef.current = currentIds;
  }, [alerts]);

  const markViewedMutation = trpc.cobrancaPlanilha.markAlertViewed.useMutation({
    onSuccess: () => {
      refetchAlerts();
      toast.success('Alerta marcado como visto');
    },
  });

  const markInProgressMutation = trpc.cobrancaPlanilha.markAlertInProgress.useMutation({
    onSuccess: () => {
      refetchAlerts();
      toast.info('Alerta marcado como "Em Andamento". Resposta enviada ao financeiro.');
    },
  });

  const markResolvedMutation = trpc.cobrancaPlanilha.markAlertResolved.useMutation({
    onSuccess: () => {
      refetchAlerts();
      toast.success('Alerta resolvido! Resposta enviada ao financeiro.');
    },
  });

  // Notify parent about alert count (pendente + em_andamento both need attention)
  const pendingAlerts = useMemo(() => {
    return alerts?.filter(a => a.status === "pendente" || a.status === "em_andamento") || [];
  }, [alerts]);

  // Notify parent about alert count via useEffect (not during render)
  useEffect(() => {
    onAlertCount?.(pendingAlerts.length);
  }, [pendingAlerts.length, onAlertCount]);

  // Get empresas that have any active alerts (pendente, em_andamento, or visto)
  const alertEmpresas = useMemo(() => {
    if (!alerts) return new Set<string>();
    return new Set(alerts.filter(a => a.status === "pendente" || a.status === "em_andamento" || a.status === "visto").map(a => a.empresa));
  }, [alerts]);

  // Group items by empresa
  const clientGroups = useMemo(() => {
    if (!cobrancaData?.items) return [];
    const groups: Record<string, typeof cobrancaData.items> = {};
    for (const item of cobrancaData.items) {
      const key = item.empresa;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    let result = Object.entries(groups).map(([empresa, items]) => ({
      empresa,
      items,
      totalValor: items.reduce((sum, i) => sum + parseFloat(String(i.valor || "0")), 0),
      maxDias: Math.max(...items.map(i => i.diasVencidos || 0)),
      cnpj: items[0]?.cnpjCpf || "",
      hasAlert: alertEmpresas.has(empresa),
    })).sort((a, b) => b.maxDias - a.maxDias);

    // Apply filter
    if (filterAlertOnly) {
      result = result.filter(g => g.hasAlert);
    }

    return result;
  }, [cobrancaData, alertEmpresas, filterAlertOnly]);

  // Get etapa observations for a specific item
  const getEtapaObs = (planilhaId: number) => {
    return cobrancaData?.etapasObs?.filter(o => o.planilhaId === planilhaId) || [];
  };

  // Handle "Resolvido" with response text
  const handleResolved = (alertId: number) => {
    const resposta = respostaTexts[alertId]?.trim();
    if (!resposta) {
      toast.error("Observação obrigatória! Descreva o que foi feito antes de marcar como resolvido.");
      return;
    }
    markResolvedMutation.mutate({
      id: alertId,
      respostaVendedor: resposta,
    });
    // Clear the text
    setRespostaTexts(prev => ({ ...prev, [alertId]: "" }));
  };

  // Handle "Em Andamento" with response text (mandatory)
  const handleInProgress = (alertId: number) => {
    const resposta = respostaTexts[alertId]?.trim();
    if (!resposta) {
      toast.error("Observação obrigatória! Descreva o que está sendo feito antes de marcar como em andamento.");
      return;
    }
    markInProgressMutation.mutate({
      id: alertId,
      respostaVendedor: resposta,
    });
    setRespostaTexts(prev => ({ ...prev, [alertId]: "" }));
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
                  <div className="mt-3 pt-3 border-t border-red-100 dark:border-red-800" onClick={(e) => e.stopPropagation()}>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mensagem da cobrança:</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 bg-red-50 dark:bg-red-900/30 p-2 rounded-lg whitespace-pre-wrap">
                      {alert.mensagem}
                    </p>

                    {/* Histórico de interações (conversa ping-pong) */}
                    <AlertInteractionHistory alertId={alert.id} />

                    {/* Etapas de cobrança (se tiver planilhaId) */}
                    {alert.planilhaId && <AlertEtapaHistory planilhaId={alert.planilhaId} />}

                    {/* Campo de resposta do vendedor */}
                    <div className="mt-3">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Sua resposta ao financeiro (OBRIGATÓRIO) *:
                      </label>
                      <textarea
                        value={respostaTexts[alert.id] || ""}
                        onChange={(e) => setRespostaTexts(prev => ({ ...prev, [alert.id]: e.target.value }))}
                        placeholder="Descreva o resultado do contato com o cliente... Ex: Liguei para o cliente, ele disse que vai pagar dia 25/07."
                        className={`w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none ${respostaTexts[alert.id]?.trim() ? 'border-emerald-300 dark:border-emerald-600' : 'border-red-300 dark:border-red-600'}`}
                        rows={3}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {!respostaTexts[alert.id]?.trim() && (
                        <p className="text-[9px] text-red-500 mt-0.5 font-medium">* Preencha a observação antes de clicar em "Em Andamento" ou "Resolvido"</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markViewedMutation.mutate({ id: alert.id });
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 text-[11px] font-medium rounded-lg hover:bg-amber-200 transition-colors"
                      >
                        <Eye className="w-3 h-3" /> Visto
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInProgress(alert.id);
                        }}
                        disabled={markInProgressMutation.isPending || !respostaTexts[alert.id]?.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 text-[11px] font-medium rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Clock className="w-3 h-3" /> Em Andamento
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResolved(alert.id);
                        }}
                        disabled={markResolvedMutation.isPending || !respostaTexts[alert.id]?.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-[11px] font-medium rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Resumo geral + Filtro rápido */}
      <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-red-200 dark:border-red-700`}>
        <div className={`px-4 py-3 border-b bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 text-red-600 ${pendingAlerts.length > 0 ? 'animate-bounce' : ''}`} />
              <h3 className="text-sm font-bold text-red-700 dark:text-red-400 uppercase">INADIMPLÊNCIA</h3>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-red-200/60 dark:bg-red-800/40 rounded text-[9px] font-semibold text-red-600 dark:text-red-400 uppercase">
                <FileText className="w-3 h-3" />
                Planilha de Cobrança
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {/* Filtro rápido: apenas com alertas pendentes */}
              {pendingAlerts.length > 0 && (
                <button
                  onClick={() => setFilterAlertOnly(!filterAlertOnly)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    filterAlertOnly
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-red-100 text-red-600 hover:bg-red-200"
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  Com alerta ({alertEmpresas.size})
                </button>
              )}
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
                className={`w-full px-4 py-3 flex items-center justify-between transition-colors text-left ${group.hasAlert ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${group.hasAlert ? 'bg-red-500 animate-pulse' : group.maxDias > 30 ? 'bg-red-500' : group.maxDias > 15 ? 'bg-amber-500' : 'bg-yellow-400'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{group.empresa}</p>
                      {group.hasAlert && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[8px] font-bold rounded animate-pulse">
                          ALERTA
                        </span>
                      )}
                    </div>
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
                        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <div className="grid grid-cols-7 gap-1 mb-2 min-w-[500px]">
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
                                    {o.etapa === "intervencaoVendedor" ? "Vendedor" : o.etapa?.replace("Cobranca", " Cob").replace("semAcao", "S/A ").replace("primeira", "1ª").replace("segunda", "2ª").replace("terceira", "3ª").replace("acaoFinal", "Ação Final") || "—"}:
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
      {alerts && alerts.filter(a => a.status !== "pendente" && a.status !== "em_andamento").length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Alertas Anteriores</p>
          <div className="space-y-2">
            {alerts.filter(a => a.status !== "pendente" && a.status !== "em_andamento").map((alert) => (
              <div key={alert.id} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{alert.empresa}</span>
                    <span className="text-slate-400 ml-2">
                      {new Date(alert.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    alert.status === "visto" ? "bg-amber-100 text-amber-700" :
                    alert.status === "resolvido" ? "bg-emerald-100 text-emerald-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {alert.status === "visto" ? "Visto" : alert.status === "resolvido" ? "Resolvido" : alert.status}
                  </span>
                </div>
                {/* Show seller response if available */}
                {alert.respostaVendedor && (
                  <div className="mt-1.5 pl-2 border-l-2 border-blue-300">
                    <p className="text-[10px] text-blue-600 font-medium">Resposta do vendedor:</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400">{alert.respostaVendedor}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Sub-component: shows the full interaction history (ping-pong messages) for an alert */
function AlertInteractionHistory({ alertId }: { alertId: number }) {
  const { data: interactions } = trpc.cobrancaPlanilha.getAlertInteractions.useQuery(
    { alertId },
    { staleTime: 10 * 1000 }
  );

  if (!interactions || interactions.length === 0) return null;

  return (
    <div className="mt-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-1 mb-2">
        <MessageCircle className="w-3 h-3 text-slate-500" />
        <span className="text-[10px] font-bold text-slate-500 uppercase">Histórico da conversa</span>
      </div>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {interactions.map((msg) => (
          <div
            key={msg.id}
            className={`px-2 py-1.5 rounded text-[11px] ${
              msg.tipo === "financeiro_msg"
                ? "bg-orange-50 border-l-2 border-orange-400 text-orange-800"
                : "bg-blue-50 border-l-2 border-blue-400 text-blue-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[10px]">
                {msg.tipo === "financeiro_msg" ? "Financeiro" : "Vendedor"} ({msg.autor})
              </span>
              <span className="text-[9px] text-slate-400">
                {new Date(msg.createdAt).toLocaleDateString("pt-BR")} {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap">{msg.mensagem}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Sub-component: shows the etapa history (cobrancaEtapaObs) for the planilha related to this alert */
function AlertEtapaHistory({ planilhaId }: { planilhaId: number }) {
  const { data: etapas } = trpc.cobrancaPlanilha.getAllEtapaObs.useQuery(
    { planilhaId },
    { staleTime: 30 * 1000 }
  );

  if (!etapas || etapas.length === 0) return null;

  const etapaLabels: Record<string, string> = {
    promessaPgto: "Promessa de Pagamento",
    primeiraCobranca: "1ª Cobrança",
    semAcao1: "Sem Ação 1",
    segundaCobranca: "2ª Cobrança",
    semAcao2: "Sem Ação 2",
    terceiraCobranca: "3ª Cobrança",
    semAcao3: "Sem Ação 3",
    acaoFinal: "Ação Final",
    intervencaoVendedor: "Intervenção Vendedor",
  };

  return (
    <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 border border-amber-200 dark:border-amber-700">
      <div className="flex items-center gap-1 mb-2">
        <History className="w-3 h-3 text-amber-600" />
        <span className="text-[10px] font-bold text-amber-700 uppercase">Etapas de cobrança realizadas</span>
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {etapas.slice(0, 10).map((obs) => (
          <div key={obs.id} className="px-2 py-1 bg-white dark:bg-slate-800 rounded text-[10px] border border-amber-100 dark:border-amber-800">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-700">
                {etapaLabels[obs.etapa] || obs.etapa}
              </span>
              <span className="text-[9px] text-slate-400">
                {new Date(obs.createdAt).toLocaleDateString("pt-BR")} • {obs.registradoPor}
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">{obs.observacao}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
