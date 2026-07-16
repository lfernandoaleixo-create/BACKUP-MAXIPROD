import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, X, Package, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface StockInsufficientAlertsProps {
  operatorName?: string;
  /** Whether the current operator can respond (Maria, Erica, or admin) */
  canRespond?: boolean;
}

export default function StockInsufficientAlerts({ operatorName, canRespond = false }: StockInsufficientAlertsProps) {
  const [expanded, setExpanded] = useState(true);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");

  const { data: alerts = [], refetch } = trpc.stockAlert.getAlerts.useQuery({});
  const { data: pendingCount = 0 } = trpc.stockAlert.countPending.useQuery();
  const respondMutation = trpc.stockAlert.respondAlert.useMutation({
    onSuccess: () => {
      refetch();
      setRespondingId(null);
      setObservacao("");
      toast.success("Resposta registrada com sucesso!");
    },
    onError: (err) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const pendingAlerts = alerts.filter((a: any) => a.status === "pendente");
  const resolvedAlerts = alerts.filter((a: any) => a.status !== "pendente");

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

  if (alerts.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border-2 border-red-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 bg-red-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-red-900 text-sm">
              Alertas de Estoque Insuficiente
            </h3>
            <p className="text-xs text-red-600">
              Itens em pedidos "Em Digitação" sem estoque disponível
            </p>
          </div>
          {pendingCount > 0 && (
            <Badge className="bg-red-500 text-white text-xs ml-2">
              {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-red-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-red-400" />
        )}
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
                        <Badge className="bg-red-100 text-red-700 text-xs">
                          {Number(alert.quantidadePedida).toFixed(0)} {alert.unidadeMedida}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-800 mt-1 font-medium truncate">
                        {alert.descricaoItem}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Cliente: {alert.cliente}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Estoque disponível: {Number(alert.estoqueDisponivel || 0).toFixed(0)} un
                      </p>
                    </div>

                    {/* Actions */}
                    {canRespond && (
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

          {/* Resolved alerts (last 10) */}
          {resolvedAlerts.length > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Resolvidos recentemente
              </p>
              {resolvedAlerts.slice(0, 10).map((alert: any) => (
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
                      <p className="text-sm text-gray-700 mt-1 truncate">
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
        </div>
      )}
    </div>
  );
}
