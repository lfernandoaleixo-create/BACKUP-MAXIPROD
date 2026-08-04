import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, X, Package, ChevronDown, ChevronUp, History } from "lucide-react";
import { toast } from "sonner";

interface StockInsufficientAlertsProps {
  operatorName?: string;
  /** Whether the current operator can respond (Maria, Erica, or admin) */
  canRespond?: boolean;
}

export default function StockInsufficientAlerts({ operatorName, canRespond = false }: StockInsufficientAlertsProps) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");

  const { data: alerts = [], refetch } = trpc.stockAlert.getAlerts.useQuery({});
  const { data: historyAlerts = [], refetch: refetchHistory } = trpc.stockAlert.getAlerts.useQuery(
    { status: "historico" },
    { enabled: showHistory }
  );
  const { data: pendingCount = 0 } = trpc.stockAlert.countPending.useQuery();
  const respondMutation = trpc.stockAlert.respondAlert.useMutation({
    onSuccess: () => {
      refetch();
      refetchHistory();
      setRespondingId(null);
      setObservacao("");
      toast.success("Resposta registrada com sucesso!");
    },
    onError: (err) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const pendingAlerts = alerts.filter((a: any) => a.status === "pendente");
  // Only show "aceito" in the main view; "recusado" goes to history only
  const resolvedAlerts = alerts.filter((a: any) => a.status === "aceito");

  // History: all resolved (aceito/recusado/expirado) alerts
  const historyResolved = historyAlerts.filter(
    (a: any) => a.status === "aceito" || a.status === "recusado" || a.status === "expirado"
  );

  const handleRespond = (alertId: number, status: "aceito" | "recusado") => {
    if (!operatorName) {
      toast.error("Operador não identificado");
      return;
    }
    respondMutation.mutate({
      alertId,
      status,
      respondidoPor: operatorName,
      observacao: observacao || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Main Alerts Card */}
      <div className={`bg-white rounded-xl border-2 shadow-sm overflow-hidden ${pendingAlerts.length > 0 ? 'border-red-400 animate-pulse-border' : alerts.length > 0 ? 'border-red-200' : 'border-gray-200'}`}>
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-3 cursor-pointer ${alerts.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}
          onClick={() => alerts.length > 0 && setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${pendingAlerts.length > 0 ? 'bg-red-200' : alerts.length > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <AlertTriangle className={`w-5 h-5 ${alerts.length > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <h3 className={`font-semibold text-sm ${alerts.length > 0 ? 'text-red-900' : 'text-gray-700'}`}>
                Alertas de Estoque Insuficiente
              </h3>
              <p className={`text-xs ${alerts.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {alerts.length > 0 ? 'Itens em pedidos "A aprovar" sem estoque disponível' : 'Nenhum alerta ativo no momento'}
              </p>
            </div>
            {pendingCount > 0 && (
              <Badge className="bg-red-500 text-white text-xs ml-2">
                {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* History shortcut icon */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }}
              className={`p-1.5 rounded-lg transition-colors ${alerts.length > 0 ? 'hover:bg-red-100' : 'hover:bg-gray-200'}`}
              title={showHistory ? "Ocultar Histórico" : "Ver Histórico"}
            >
              <History className={`w-4 h-4 ${showHistory ? (alerts.length > 0 ? 'text-red-700' : 'text-gray-700') : (alerts.length > 0 ? 'text-red-400' : 'text-gray-400')}`} />
            </button>
            {alerts.length > 0 && (expanded ? (
              <ChevronUp className="w-5 h-5 text-red-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-red-400" />
            ))}
          </div>
        </div>

        {/* Content */}
        {expanded && (
          <div className="p-4 space-y-3">
            {/* Pending alerts */}
            {pendingAlerts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Aguardando resposta da Produção
                </p>
                {pendingAlerts.map((alert: any) => (
                  <div
                    key={alert.id}
                    className="border border-red-100 rounded-lg p-3 bg-red-50/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                            Pedido #{alert.pedidoNumero}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-gray-300">
                            <Package className="w-3 h-3 mr-1" />
                            {alert.codigoItem}
                          </Badge>
                          <Badge className="bg-red-100 text-red-700 text-xs font-bold">
                            {Number(alert.quantidadePedida).toFixed(0)} {alert.unidadeMedida}
                          </Badge>
                          {alert.tipoItem === "madeira" && (
                            <Badge className="bg-amber-100 text-amber-800 text-xs">
                              MADEIRA (auto)
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 mt-1 font-medium">
                          {alert.descricaoItem}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Cliente: {alert.cliente}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Estoque disponível: {Number(alert.estoqueDisponivel || 0).toFixed(0)} {alert.unidadeMedida} · Faltam: {Math.max(0, Number(alert.quantidadePedida) - Number(alert.estoqueDisponivel || 0)).toFixed(0)} {alert.unidadeMedida}
                        </p>
                      </div>

                      {/* Info para MADEIRA: auto-resolve */}
                      {alert.tipoItem === "madeira" && (
                        <div className="shrink-0">
                          <span className="text-xs text-amber-700 italic">Resolve ao repor estoque</span>
                        </div>
                      )}

                      {/* Actions - Não mostrar para MADEIRA (auto-resolve) */}
                      {canRespond && alert.tipoItem !== "madeira" && (
                        <div className="flex flex-col gap-1 shrink-0">
                          {respondingId === alert.id ? (
                            <div className="space-y-2">
                              <textarea
                                className="w-48 text-xs border rounded p-1.5 resize-none"
                                rows={2}
                                placeholder="Observação (opcional)..."
                                value={observacao}
                                onChange={(e) => setObservacao(e.target.value)}
                              />
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-2"
                                  onClick={() => handleRespond(alert.id, "aceito")}
                                  disabled={respondMutation.isPending}
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Aceitar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="text-xs h-7 px-2"
                                  onClick={() => handleRespond(alert.id, "recusado")}
                                  disabled={respondMutation.isPending}
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Recusar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-7 px-2"
                                  onClick={() => { setRespondingId(null); setObservacao(""); }}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => setRespondingId(alert.id)}
                            >
                              Responder
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Resolved alerts (recent, inline) */}
            {resolvedAlerts.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Resolvidos recentemente
                </p>
                {resolvedAlerts.slice(0, 5).map((alert: any) => (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-3 ${
                      alert.status === "aceito"
                        ? "border-green-100 bg-green-50/30"
                        : "border-gray-200 bg-gray-50/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs border-gray-300">
                            Pedido #{alert.pedidoNumero}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-gray-300">
                            {alert.codigoItem}
                          </Badge>
                          <Badge className="bg-blue-100 text-blue-700 text-xs font-bold">
                            {Number(alert.quantidadePedida).toFixed(0)} {alert.unidadeMedida}
                          </Badge>
                          <Badge
                            className={`text-xs ${
                              alert.status === "aceito"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {alert.status === "aceito" ? "✓ Aceito" : "✗ Recusado"}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">
                          {alert.descricaoItem}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Respondido por: {alert.respondidoPor}
                          {alert.respostaObservacao && ` — "${alert.respostaObservacao}"`}
                        </p>
                      </div>
                      <div className="text-xs text-gray-400 shrink-0">
                        {alert.respondidoEm
                          ? new Date(alert.respondidoEm).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Button to show full history */}
            <div className="pt-2 border-t border-gray-100">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-500 hover:text-gray-700 w-full"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="w-3.5 h-3.5 mr-1.5" />
                {showHistory ? "Ocultar Histórico Completo" : "Ver Histórico Completo"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Full History Section */}
      {showHistory && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold text-gray-800 text-sm">
                Histórico de Alertas de Estoque
              </h3>
              <Badge variant="outline" className="text-xs">
                {historyResolved.length} registro{historyResolved.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
          <div className="p-4">
            {historyResolved.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Nenhum alerta resolvido no histórico.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-2 pr-3 font-medium text-gray-500">Pedido</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500">Código</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500">Produto</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500">Qtd (CX)</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500">Estoque</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500">Status</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500">Respondido por</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500">Observação</th>
                      <th className="pb-2 font-medium text-gray-500">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyResolved.map((alert: any) => (
                      <tr key={alert.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 pr-3">
                          <span className="font-medium text-orange-700">#{alert.pedidoNumero}</span>
                        </td>
                        <td className="py-2 pr-3 font-mono text-gray-600">
                          {alert.codigoItem}
                        </td>
                        <td className="py-2 pr-3 text-gray-700 max-w-[200px] truncate" title={alert.descricaoItem}>
                          {alert.descricaoItem}
                        </td>
                        <td className="py-2 pr-3 font-bold text-gray-800">
                          {Number(alert.quantidadePedida).toFixed(0)} {alert.unidadeMedida}
                        </td>
                        <td className="py-2 pr-3 text-gray-600">
                          {Number(alert.estoqueDisponivel || 0).toFixed(0)} {alert.unidadeMedida}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge
                            className={`text-xs ${
                              alert.status === "aceito"
                                ? "bg-green-100 text-green-700"
                                : alert.status === "expirado"
                                ? "bg-gray-100 text-gray-600"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {alert.status === "aceito" ? "✓ Aceito" : alert.status === "expirado" ? "→ Baixa realizada" : "✗ Recusado"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-gray-600">
                          {alert.respondidoPor || (alert.status === "expirado" ? "Sistema" : "—")}
                        </td>
                        <td className="py-2 pr-3 text-gray-500 max-w-[150px] truncate" title={alert.respostaObservacao || ""}>
                          {alert.respostaObservacao || "—"}
                        </td>
                        <td className="py-2 text-gray-400 whitespace-nowrap">
                          {alert.respondidoEm
                            ? new Date(alert.respondidoEm).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : alert.createdAt
                            ? new Date(alert.createdAt).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
