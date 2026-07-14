/**
 * LotAssignmentPanel - Seleção de Lote no Pedido (Tela 2)
 * Permite ao líder/gestor selecionar lotes disponíveis para cada item do pedido
 * antes de enviar para faturamento. A baixa do saldo é automática.
 */
import React, { useState } from "react";
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
import { Package, Plus, Trash2, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
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
          {assignments.length > 0 && (
            <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
              <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
              {assignments.length} lote{assignments.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* Existing assignments */}
        {assignments.length > 0 && (
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
          {uniqueItems.map((item) => (
            <Button
              key={item.codigoItem}
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs border-purple-200 text-purple-700 hover:bg-purple-100 h-8"
              onClick={() => {
                setSelectedItem(item);
                setShowLotModal(true);
              }}
            >
              <Plus className="w-3 h-3 mr-1.5" />
              Adicionar Lote — {item.descricaoItem?.substring(0, 30) || item.codigoItem}
            </Button>
          ))}
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
