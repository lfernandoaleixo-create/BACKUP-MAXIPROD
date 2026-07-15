/**
 * PedidosVendedoresTab - Gestão de Pedidos de Venda dos Vendedores de Rua
 * Fluxo: Pendente → Aprovado → Processado (Vitória)
 */
import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  User,
  Phone,
  MapPin,
  FileCheck,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  Download,
} from "lucide-react";
// import MarginBar from "@/components/MarginBar"; // oculto temporariamente - fase de teste
import { useOperator } from "@/contexts/OperatorContext";
import { SerasaConsulta } from "@/components/SerasaConsulta";
import { LotAssignmentPanel, LotStatusIndicator } from "@/components/LotAssignmentPanel";
import { generateOrderPdf } from "@/lib/generateOrderPdf";

type OrderStatus = "pendente" | "aprovado" | "rejeitado" | "processado" | "todos";
type ExtraFilter = "comissao_travada" | null;

export default function PedidosVendedoresTab() {
  const { operator } = useOperator();
  const [statusFilter, setStatusFilter] = useState<OrderStatus>("todos");
  const [extraFilter, setExtraFilter] = useState<ExtraFilter>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [maxiprodNumber, setMaxiprodNumber] = useState("");
  const [showProcessDialog, setShowProcessDialog] = useState(false);

  const ordersQuery = trpc.salesOrders.listOrders.useQuery(
    { status: statusFilter === "todos" ? undefined : statusFilter, comissaoTravada: extraFilter === "comissao_travada" ? true : undefined },
    { refetchInterval: 30000 }
  );

  const detailsQuery = trpc.salesOrders.getOrderDetails.useQuery(
    { orderId: selectedOrderId! },
    { enabled: !!selectedOrderId }
  );

  const approveMutation = trpc.salesOrders.approveOrder.useMutation({
    onSuccess: () => {
      ordersQuery.refetch();
      setSelectedOrderId(null);
    },
  });

  const rejectMutation = trpc.salesOrders.rejectOrder.useMutation({
    onSuccess: () => {
      ordersQuery.refetch();
      setSelectedOrderId(null);
      setShowRejectDialog(false);
      setRejectReason("");
    },
  });

  const processMutation = trpc.salesOrders.markAsProcessed.useMutation({
    onSuccess: () => {
      ordersQuery.refetch();
      setSelectedOrderId(null);
      setShowProcessDialog(false);
      setMaxiprodNumber("");
    },
  });

  const orders = ordersQuery.data || [];

  const statusCounts = {
    pendente: orders.filter(o => o.status === "pendente").length,
    aprovado: orders.filter(o => o.status === "aprovado").length,
    processado: orders.filter(o => o.status === "processado").length,
    rejeitado: orders.filter(o => o.status === "rejeitado").length,
  };

  const formatCurrency = (val: string | null) => {
    if (!val) return "R$ 0,00";
    return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (d: Date | string | null) => {
    if (!d) return "-";
    const date = new Date(d);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case "aprovado":
        return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case "rejeitado":
        return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Rejeitado</Badge>;
      case "processado":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><FileCheck className="w-3 h-3 mr-1" />Processado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header com contadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => setStatusFilter("pendente")}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "pendente" ? "border-amber-400 bg-amber-50 shadow-sm" : "border-slate-200 bg-white hover:border-amber-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-slate-600">Pendentes</span>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-1">{statusCounts.pendente}</p>
        </button>

        <button
          onClick={() => setStatusFilter("aprovado")}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "aprovado" ? "border-green-400 bg-green-50 shadow-sm" : "border-slate-200 bg-white hover:border-green-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium text-slate-600">Aprovados</span>
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1">{statusCounts.aprovado}</p>
        </button>

        <button
          onClick={() => setStatusFilter("processado")}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "processado" ? "border-blue-400 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-blue-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-slate-600">Processados</span>
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-1">{statusCounts.processado}</p>
        </button>

        <button
          onClick={() => setStatusFilter("todos")}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "todos" ? "border-teal-400 bg-teal-50 shadow-sm" : "border-slate-200 bg-white hover:border-teal-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-teal-500" />
            <span className="text-xs font-medium text-slate-600">Todos</span>
          </div>
          <p className="text-2xl font-bold text-teal-600 mt-1">{orders.length}</p>
        </button>
      </div>

      {/* Filtro extra: Comissão Travada */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExtraFilter(extraFilter === "comissao_travada" ? null : "comissao_travada")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            extraFilter === "comissao_travada"
              ? "bg-amber-100 border-amber-400 text-amber-700 shadow-sm"
              : "bg-white border-slate-200 text-slate-600 hover:border-amber-200"
          }`}
        >
          <span className="mr-1">⚠️</span> Comissão Travada 4%
        </button>
        {extraFilter && (
          <button
            onClick={() => setExtraFilter(null)}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Limpar filtro
          </button>
        )}
      </div>

      {/* Lista de pedidos */}
      {ordersQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Nenhum pedido encontrado</p>
          <p className="text-sm text-slate-400 mt-1">Os pedidos dos vendedores aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => (
            <button
              key={order.id}
              onClick={() => setSelectedOrderId(order.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${
                order.status === "pendente" ? "border-amber-200 bg-amber-50/50" :
                order.status === "aprovado" ? "border-green-200 bg-green-50/30" :
                "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(order.status)}
                    {order.temPrecoAbaixoMinimo && (
                      <Badge className="bg-red-100 text-red-600 border-red-200 text-[10px]">
                        <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />Preço abaixo
                      </Badge>
                    )}
                    {["aprovado", "pendente"].includes(order.status) && (
                      <LotStatusIndicator orderId={order.id} />
                    )}
                  </div>
                  <p className="font-semibold text-slate-800 truncate">{order.razaoSocial}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {order.sellerName} • {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-slate-800">{formatCurrency(order.totalPedido)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">#{order.id}</p>
                </div>
              </div>
              {order.motivoAlerta && (
                <p className="text-xs text-red-600 mt-2 bg-red-50 rounded px-2 py-1 border border-red-100">
                  {order.motivoAlerta}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrderId} onOpenChange={(open) => { if (!open) setSelectedOrderId(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-teal-600" />
              Pedido #{selectedOrderId}
            </DialogTitle>
          </DialogHeader>

          {detailsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
            </div>
          ) : detailsQuery.data ? (
            <div className="space-y-4">
              {/* Status + Exportar PDF */}
              <div className="flex items-center justify-between">
                {getStatusBadge(detailsQuery.data.order.status)}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1 border-teal-200 text-teal-700 hover:bg-teal-50"
                    onClick={async () => {
                      const o = detailsQuery.data!.order;
                      const items = detailsQuery.data!.items;
                      await generateOrderPdf({
                        pedido: String(o.orderNumber || o.id),
                        cliente: o.razaoSocial || o.nomeFantasia || "",
                        clienteApelido: o.nomeFantasia || undefined,
                        uf: o.uf || "MG",
                        dataEmissao: o.createdAt ? new Date(o.createdAt).toLocaleDateString("pt-BR") : "",
                        dataEntrega: o.dataEntrega ? new Date(o.dataEntrega).toLocaleDateString("pt-BR") : "",
                        empresa: "GRUPO FOX",
                        representante: o.sellerName || "",
                        segmento: o.segmento || "",
                        condicaoPagamento: o.condicaoPagamento || undefined,
                        transportadora: (o as any).transportadora || undefined,
                        observacoes: o.observacoes || undefined,
                        valorTotal: items.reduce((sum, it) => sum + Number(it.totalItem || 0), 0),
                        endereco: o.endereco ? {
                          logradouro: o.endereco,
                          numero: o.numero || "",
                          complemento: o.complemento || "",
                          bairro: o.bairro || "",
                          cep: o.cep || "",
                          cidade: o.municipio || "",
                          uf: o.uf || "",
                        } : null,
                        itens: items.map(it => ({
                          descricao: it.descricaoItem || "",
                          quantidade: Number(it.quantidade) || 0,
                          valorUnitario: Number(it.precoUnitario) || 0,
                          valorTotal: Number(it.totalItem) || 0,
                          codigoItem: it.codigoItem || null,
                          unidadeMedida: it.unidadeMedida || "CX",
                        })),
                      }, true);
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar PDF
                  </Button>
                  <span className="text-xs text-slate-400">{formatDate(detailsQuery.data.order.createdAt)}</span>
                </div>
              </div>

              {/* Vendedor */}
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 font-medium mb-1">Vendedor</p>
                <p className="font-semibold text-slate-700">{detailsQuery.data.order.sellerName}</p>
              </div>

              {/* Cliente */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                <p className="text-xs text-slate-500 font-medium">Dados do Cliente</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] text-slate-400">Razão Social</p>
                    <p className="font-medium text-slate-700">{detailsQuery.data.order.razaoSocial}</p>
                  </div>
                  {detailsQuery.data.order.nomeFantasia && (
                    <div>
                      <p className="text-[10px] text-slate-400">Nome Fantasia</p>
                      <p className="font-medium text-slate-700">{detailsQuery.data.order.nomeFantasia}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-slate-400">CNPJ/CPF</p>
                    <p className="font-medium text-slate-700">{detailsQuery.data.order.cnpjCpf}</p>
                  </div>
                  {detailsQuery.data.order.inscricaoEstadual && (
                    <div>
                      <p className="text-[10px] text-slate-400">Inscrição Estadual</p>
                      <p className="font-medium text-slate-700">{detailsQuery.data.order.inscricaoEstadual}</p>
                    </div>
                  )}
                  {detailsQuery.data.order.telefone1 && (
                    <div>
                      <p className="text-[10px] text-slate-400">Telefone</p>
                      <p className="font-medium text-slate-700">{detailsQuery.data.order.telefone1}</p>
                    </div>
                  )}
                  {detailsQuery.data.order.emailNfe && (
                    <div>
                      <p className="text-[10px] text-slate-400">Email NF-e</p>
                      <p className="font-medium text-slate-700">{detailsQuery.data.order.emailNfe}</p>
                    </div>
                  )}
                </div>
                {detailsQuery.data.order.endereco && (
                  <div className="pt-1 border-t border-slate-200">
                    <p className="text-[10px] text-slate-400">Endereço</p>
                    <p className="text-sm text-slate-700">
                      {detailsQuery.data.order.endereco}, {detailsQuery.data.order.numero}
                      {detailsQuery.data.order.complemento && ` - ${detailsQuery.data.order.complemento}`}
                      {" - "}{detailsQuery.data.order.bairro}, {detailsQuery.data.order.municipio}/{detailsQuery.data.order.uf}
                      {detailsQuery.data.order.cep && ` - CEP: ${detailsQuery.data.order.cep}`}
                    </p>
                  </div>
                )}
              </div>

              {/* Itens */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                <p className="text-xs text-slate-500 font-medium">Itens do Pedido</p>
                <div className="space-y-1.5">
                  {detailsQuery.data.items.map((item, idx) => (
                    <div key={idx} className={`flex items-center justify-between text-sm p-2 rounded ${
                      item.abaixoDoMinimo ? "bg-red-50 border border-red-200" : "bg-white border border-slate-100"
                    }`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 truncate text-xs">{item.descricaoItem}</p>
                        <p className="text-[10px] text-slate-400">
                          {item.codigoItem === '00556' ? Math.round(Number(item.quantidade) / 10.002) : item.codigoItem === '00808' ? Math.round(Number(item.quantidade) / 11.6) : Number(item.quantidade).toFixed(0)} {item.codigoItem === '00556' || item.codigoItem === '00808' ? 'cx' : (item.unidadeMedida || 'un')} × {formatCurrency(item.precoUnitario)}
                          {item.abaixoDoMinimo && item.precoMinimo && (
                            <span className="text-red-500 ml-1">(mín: {formatCurrency(item.precoMinimo)})</span>
                          )}
                        </p>
                      </div>
                      <p className={`font-bold text-sm flex-shrink-0 ml-2 ${item.abaixoDoMinimo ? "text-red-600" : "text-slate-700"}`}>
                        {formatCurrency(item.totalItem)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seleção de Lotes */}
              {detailsQuery.data.items && detailsQuery.data.items.length > 0 && (
                <LotAssignmentPanel
                  orderId={detailsQuery.data.order.id}
                  items={detailsQuery.data.items}
                  orderStatus={detailsQuery.data.order.status}
                />
              )}

              {/* Totais */}
              <div className="bg-teal-50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Produtos:</span>
                  <span className="font-medium">{formatCurrency(detailsQuery.data.order.totalProdutos)}</span>
                </div>
                {/* Frete oculto temporariamente - fase de teste */}
                <div className="flex justify-between text-sm font-bold border-t border-teal-200 pt-1">
                  <span className="text-teal-700">Total:</span>
                  <span className="text-teal-700">{formatCurrency(detailsQuery.data.order.totalPedido)}</span>
                </div>
              </div>

              {/* Condição de pagamento */}
              {detailsQuery.data.order.condicaoPagamento && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium">Condição de Pagamento</p>
                  <p className="font-medium text-slate-700">{detailsQuery.data.order.condicaoPagamento}</p>
                </div>
              )}

              {/* Observações */}
              {detailsQuery.data.order.observacoes && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium">Observações</p>
                  <p className="text-sm text-slate-700">{detailsQuery.data.order.observacoes}</p>
                </div>
              )}

              {/* Consulta Serasa - Mostra última consulta ou botão para gestores */}
              {detailsQuery.data.order.cnpjCpf && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <SerasaConsulta
                    documento={detailsQuery.data.order.cnpjCpf}
                    clienteNome={detailsQuery.data.order.razaoSocial || detailsQuery.data.order.nomeFantasia || ""}
                    operadorName={operator?.name || ""}
                    salesOrderRequestId={detailsQuery.data.order.id}
                    compact={!(["Fernando", "Guilherme", "Bruno"].some(n => (operator?.name || "").toLowerCase().includes(n.toLowerCase())))}
                  />
                </div>
              )}

              {/* Card LUCRO - Margem de Lucro (oculto temporariamente - fase de teste) */}

              {/* Alerta */}
              {detailsQuery.data.order.motivoAlerta && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Motivo do Alerta
                  </p>
                  <p className="text-sm text-red-700 mt-1">{detailsQuery.data.order.motivoAlerta}</p>
                </div>
              )}

              {/* Action buttons */}
              {detailsQuery.data.order.status === "pendente" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => {
                      approveMutation.mutate({
                        orderId: selectedOrderId!,
                        aprovadoPor: operator?.name || "Gestor",
                      });
                    }}
                    disabled={approveMutation.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {approveMutation.isPending ? "Aprovando..." : "Aprovar"}
                  </Button>
                  <Button
                    onClick={() => setShowRejectDialog(true)}
                    variant="outline"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Rejeitar
                  </Button>
                </div>
              )}

              {detailsQuery.data.order.status === "aprovado" && (
                <div className="pt-2">
                  <Button
                    onClick={() => setShowProcessDialog(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <FileCheck className="w-4 h-4 mr-1" />
                    Marcar como Processado (Vitória)
                  </Button>
                </div>
              )}

              {/* Rejection info */}
              {detailsQuery.data.order.status === "rejeitado" && detailsQuery.data.order.motivoRejeicao && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-500 font-medium">Motivo da Rejeição</p>
                  <p className="text-sm text-red-700">{detailsQuery.data.order.motivoRejeicao}</p>
                  <p className="text-[10px] text-red-400 mt-1">
                    Por: {detailsQuery.data.order.aprovadoPor} em {formatDate(detailsQuery.data.order.dataAprovacao)}
                  </p>
                </div>
              )}

              {/* Processed info */}
              {detailsQuery.data.order.status === "processado" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-500 font-medium">Processado</p>
                  <p className="text-sm text-blue-700">
                    Por: {detailsQuery.data.order.processadoPor} em {formatDate(detailsQuery.data.order.dataProcessamento)}
                  </p>
                  {detailsQuery.data.order.numeroPedidoMaxiprod && (
                    <p className="text-sm text-blue-700 font-medium mt-1">
                      Pedido Maxiprod: #{detailsQuery.data.order.numeroPedidoMaxiprod}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rejeitar Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Informe o motivo da rejeição:</p>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Preço abaixo do mínimo, frete inadequado..."
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  rejectMutation.mutate({
                    orderId: selectedOrderId!,
                    aprovadoPor: operator?.name || "Gestor",
                    motivoRejeicao: rejectReason,
                  });
                }}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {rejectMutation.isPending ? "Rejeitando..." : "Confirmar Rejeição"}
              </Button>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Process Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como Processado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Informe o número do pedido no Maxiprod (opcional):</p>
            <Input
              value={maxiprodNumber}
              onChange={(e) => setMaxiprodNumber(e.target.value)}
              placeholder="Ex: 12345"
            />
            <Button
              onClick={() => {
                processMutation.mutate({
                  orderId: selectedOrderId!,
                  processadoPor: operator?.name || "Vitória",
                  numeroPedidoMaxiprod: maxiprodNumber || undefined,
                });
              }}
              disabled={processMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {processMutation.isPending ? "Processando..." : "Confirmar Processamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
