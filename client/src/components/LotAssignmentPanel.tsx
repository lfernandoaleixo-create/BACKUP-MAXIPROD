/**
 * LotAssignmentPanel - Seleção de Lote no Pedido (Tela 2)
 * Permite ao líder/gestor selecionar lotes disponíveis para cada item do pedido
 * antes de enviar para faturamento. A baixa do saldo é automática.
 */
import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Package, Plus, Trash2, Loader2, CheckCircle, AlertTriangle, History, Clock } from "lucide-react";
import { useOperator } from "@/contexts/OperatorContext";

interface OrderItem {
  codigoItem: string;
  descricaoItem: string;
  quantidade: string | number;
  unidadeMedida?: string | null;
  [key: string]: any;
}

interface LotAssignmentPanelProps {
  orderId: number;
  items: OrderItem[];
  orderStatus: string;
}

export function LotAssignmentPanel({ orderId, items, orderStatus }: LotAssignmentPanelProps) {
  const { operator } = useOperator();
  const [showLotModal, setShowLotModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [qtdInput, setQtdInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // Fetch existing lot assignments for this order
  const assignmentsQuery = trpc.salesOrders.getOrderLotAssignments.useQuery(
    { orderId },
    { enabled: !!orderId }
  );

  // Fetch available lots when modal is open
  const availableLotsQuery = trpc.salesOrders.getAvailableLotsForItem.useQuery(
    { codigoItem: selectedItem?.codigoItem || "" },
    { enabled: !!selectedItem?.codigoItem && showLotModal }
  );

  const assignMutation = trpc.salesOrders.assignLotsToOrder.useMutation({
    onSuccess: () => {
      assignmentsQuery.refetch();
      setShowLotModal(false);
      setSelectedItem(null);
      setQtdInput("");
    },
  });

  const removeMutation = trpc.salesOrders.removeLotAssignment.useMutation({
    onSuccess: () => {
      assignmentsQuery.refetch();
    },
  });

  const assignments = assignmentsQuery.data || [];

  // Calculate quantity comparison per item
  const quantityComparison = useMemo(() => {
    const comparison: Record<string, { pedido: number; atribuido: number }> = {};
    
    // Sum order quantities per codigoItem
    items.forEach((item) => {
      const qty = Number(item.quantidade) || 0;
      if (!comparison[item.codigoItem]) {
        comparison[item.codigoItem] = { pedido: 0, atribuido: 0 };
      }
      comparison[item.codigoItem].pedido += qty;
    });

    // Sum assigned lot quantities per codigoItem
    assignments.forEach((a) => {
      const qty = Number(a.qtdCaixas) || 0;
      if (!comparison[a.codigoItem]) {
        comparison[a.codigoItem] = { pedido: 0, atribuido: 0 };
      }
      comparison[a.codigoItem].atribuido += qty;
    });

    return comparison;
  }, [items, assignments]);

  // Check if all items have matching lot quantities
  const allItemsComplete = useMemo(() => {
    return Object.values(quantityComparison).every(
      (c) => c.atribuido >= c.pedido && c.pedido > 0
    );
  }, [quantityComparison]);

  const hasAnyAssignment = assignments.length > 0;
  const hasMismatch = hasAnyAssignment && !allItemsComplete;

  // Only show for approved orders (before processing/billing)
  if (!["aprovado", "pendente"].includes(orderStatus)) {
    // For processed orders, just show assigned lots read-only
    if (assignments.length > 0) {
      return (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
          <p className="text-xs text-purple-600 font-medium flex items-center gap-1">
            <Package className="w-3 h-3" /> Lotes Atribuídos
          </p>
          <div className="space-y-1">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs bg-white rounded p-2 border border-purple-100">
                <div>
                  <span className="font-medium text-purple-700">{a.codigoLote}</span>
                  <span className="text-slate-500 ml-2">({a.codigoItem})</span>
                </div>
                <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                  {Number(a.qtdCaixas).toFixed(0)} cx
                </Badge>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  }

  // Get unique product codes from items
  const uniqueItems = items.reduce<OrderItem[]>((acc, item) => {
    if (!acc.find(i => i.codigoItem === item.codigoItem)) {
      acc.push(item);
    }
    return acc;
  }, []);

  return (
    <>
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-purple-600 font-medium flex items-center gap-1">
            <Package className="w-3 h-3" /> Lotes do Pedido
          </p>
          <div className="flex items-center gap-1.5">
            {hasAnyAssignment && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-slate-500 hover:text-slate-700"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="w-3 h-3 mr-0.5" />
                Histórico
              </Button>
            )}
            {allItemsComplete && (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                Completo
              </Badge>
            )}
            {hasAnyAssignment && !allItemsComplete && (
              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px]">
                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                Incompleto
              </Badge>
            )}
          </div>
        </div>

        {/* Quantity mismatch alert */}
        {hasMismatch && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2.5 space-y-1.5">
            <p className="text-[11px] text-yellow-800 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Quantidade de lotes difere do pedido:
            </p>
            <div className="space-y-1">
              {Object.entries(quantityComparison).map(([codigo, comp]) => {
                const item = items.find(i => i.codigoItem === codigo);
                const isOk = comp.atribuido >= comp.pedido;
                return (
                  <div key={codigo} className={`flex items-center justify-between text-[10px] px-2 py-1 rounded ${isOk ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    <span className="truncate flex-1">{item?.descricaoItem || codigo}</span>
                    <span className="font-mono font-bold ml-2">
                      {comp.atribuido}/{comp.pedido} cx
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All complete indicator */}
        {allItemsComplete && hasAnyAssignment && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
            <p className="text-[11px] text-green-700 font-medium flex items-center justify-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Todos os lotes atribuídos corretamente
            </p>
          </div>
        )}

        {/* History log */}
        {showHistory && assignments.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5">
            <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3" /> Histórico de Atribuições
            </p>
            {assignments
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-[10px] border-l-2 border-purple-300 pl-2 py-0.5">
                  <div className="flex-1">
                    <p className="text-slate-700">
                      <span className="font-semibold text-purple-700">{a.atribuidoPor}</span>
                      {" adicionou "}
                      <span className="font-semibold">{Number(a.qtdCaixas).toFixed(0)} cx</span>
                      {" do lote "}
                      <span className="font-bold text-purple-600">{a.codigoLote}</span>
                      {" → "}
                      <span className="text-slate-500">{a.descricaoItem || a.codigoItem}</span>
                    </p>
                    <p className="text-slate-400 mt-0.5">
                      {new Date(a.createdAt).toLocaleDateString("pt-BR")} às {new Date(a.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Existing assignments */}
        {assignments.length > 0 && !showHistory && (
          <div className="space-y-1.5">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs bg-white rounded-lg p-2 border border-purple-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-purple-700">{a.codigoLote}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600 truncate">{a.descricaoItem || a.codigoItem}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    por {a.atribuidoPor} • {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                    {Number(a.qtdCaixas).toFixed(0)} cx
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => removeMutation.mutate({ assignmentId: a.id })}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No assignments yet */}
        {assignments.length === 0 && (
          <div className="text-center py-2">
            <p className="text-xs text-slate-400">Nenhum lote atribuído ainda</p>
          </div>
        )}

        {/* Add lot buttons per item */}
        <div className="space-y-1.5">
          {uniqueItems.map((item) => {
            const comp = quantityComparison[item.codigoItem];
            const isComplete = comp && comp.atribuido >= comp.pedido && comp.pedido > 0;
            return (
              <Button
                key={item.codigoItem}
                variant="outline"
                size="sm"
                className={`w-full justify-start text-xs h-8 ${isComplete ? "border-green-200 text-green-700 hover:bg-green-50" : "border-purple-200 text-purple-700 hover:bg-purple-100"}`}
                onClick={() => {
                  setSelectedItem(item);
                  setShowLotModal(true);
                }}
              >
                {isComplete ? (
                  <CheckCircle className="w-3 h-3 mr-1.5" />
                ) : (
                  <Plus className="w-3 h-3 mr-1.5" />
                )}
                {isComplete ? "Lote OK" : "Adicionar Lote"} — {item.descricaoItem?.substring(0, 25) || item.codigoItem}
                {comp && (
                  <span className="ml-auto font-mono text-[10px] opacity-70">
                    {comp.atribuido}/{comp.pedido}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Lot Selection Modal */}
      <Dialog open={showLotModal} onOpenChange={(open) => { if (!open) { setShowLotModal(false); setSelectedItem(null); setQtdInput(""); } }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="w-5 h-5 text-purple-600" />
              Selecionar Lote
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-[10px] text-slate-400">Produto</p>
                <p className="text-sm font-medium text-slate-700">{selectedItem.descricaoItem}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Código: {selectedItem.codigoItem}</p>
                {quantityComparison[selectedItem.codigoItem] && (
                  <p className="text-[10px] text-purple-600 mt-1 font-medium">
                    Pedido: {quantityComparison[selectedItem.codigoItem].pedido} cx | Atribuído: {quantityComparison[selectedItem.codigoItem].atribuido} cx
                  </p>
                )}
              </div>

              {/* Available lots */}
              <div>
                <p className="text-xs text-slate-500 font-medium mb-2">Lotes Disponíveis (com saldo)</p>
                {availableLotsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                  </div>
                ) : (availableLotsQuery.data || []).length === 0 ? (
                  <div className="text-center py-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                    <p className="text-xs text-yellow-700">Nenhum lote com saldo disponível para este produto</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(availableLotsQuery.data || []).map((lot) => (
                      <div
                        key={lot.id}
                        className="border border-purple-200 rounded-lg p-3 hover:bg-purple-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-bold text-purple-700 text-sm">{lot.codigo}</p>
                            <p className="text-[10px] text-slate-400">
                              Criado: {new Date(lot.createdAt).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            Saldo: {Number(lot.saldoAtual).toFixed(0)} cx
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Qtd caixas"
                            className="h-8 text-sm flex-1"
                            min={1}
                            max={Number(lot.saldoAtual)}
                            value={qtdInput}
                            onChange={(e) => setQtdInput(e.target.value)}
                          />
                          <Button
                            size="sm"
                            className="h-8 bg-purple-600 hover:bg-purple-700 text-white text-xs px-3"
                            disabled={!qtdInput || Number(qtdInput) <= 0 || Number(qtdInput) > Number(lot.saldoAtual) || assignMutation.isPending}
                            onClick={() => {
                              assignMutation.mutate({
                                orderId,
                                assignments: [{
                                  lotId: lot.id,
                                  codigoLote: lot.codigo,
                                  codigoItem: selectedItem.codigoItem,
                                  descricaoItem: selectedItem.descricaoItem,
                                  qtdCaixas: Number(qtdInput),
                                }],
                                atribuidoPor: operator?.name || "Gestor",
                              });
                            }}
                          >
                            {assignMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Plus className="w-3 h-3 mr-1" />
                                Atribuir
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * LotStatusIndicator - Badge para a lista principal de pedidos
 * Mostra se o pedido tem lotes completos, incompletos ou sem lotes
 */
export function LotStatusIndicator({ orderId }: { orderId: number }) {
  const assignmentsQuery = trpc.salesOrders.getOrderLotAssignments.useQuery(
    { orderId },
    { enabled: !!orderId }
  );

  const assignments = assignmentsQuery.data || [];

  if (assignmentsQuery.isLoading) return null;

  if (assignments.length === 0) {
    return (
      <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[9px] px-1.5 py-0">
        Sem lote
      </Badge>
    );
  }

  // We can't easily check completeness without items data here,
  // so just show that lots are assigned
  return (
    <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] px-1.5 py-0">
      <Package className="w-2.5 h-2.5 mr-0.5" />
      {assignments.length} lote{assignments.length > 1 ? "s" : ""}
    </Badge>
  );
}
