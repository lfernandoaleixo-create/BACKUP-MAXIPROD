/**
 * Gestor Aprovações - Painel de aprovação de pedidos de venda
 * Mostra todos os pedidos dos vendedores:
 * - Verde: pedidos com preço OK (apenas para visualização)
 * - Vermelho: pedidos com preço abaixo do mínimo (precisa aprovar/recusar)
 */
import { useState, useMemo } from "react";
import TopNav from "@/components/TopNav";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Eye, ChevronDown, ChevronUp,
  ShoppingCart, User, MapPin, DollarSign, Package, ArrowLeft, Filter, RefreshCw, RotateCcw
} from "lucide-react";
import { Link } from "wouter";

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? Number(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type OrderWithItems = {
  id: number;
  sellerId: number;
  sellerName: string;
  gestorName: string | null;
  status: "pendente" | "aprovado" | "rejeitado" | "processado";
  cnpjCpf: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  municipio: string | null;
  uf: string | null;
  totalProdutos: string;
  totalPedido: string;
  temPrecoAbaixoMinimo: boolean;
  motivoAlerta: string | null;
  condicaoPagamento: string | null;
  observacoes: string | null;
  createdAt: string | Date;
  aprovadoPor: string | null;
  dataAprovacao: string | Date | null;
  motivoRejeicao: string | null;
  items: Array<{
    id: number;
    orderId: number;
    codigoItem: string;
    descricaoItem: string;
    quantidade: string;
    unidadeMedida: string | null;
    precoUnitario: string;
    precoMinimo: string | null;
    totalItem: string;
    abaixoDoMinimo: boolean;
  }>;
};

export default function GestorAprovacoes() {
  const [filter, setFilter] = useState<"todos" | "pendente" | "aprovado" | "rejeitado">("todos");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Fetch all orders (gestor sees all)
  const { data: orders, isLoading, refetch } = trpc.salesOrders.listOrders.useQuery(
    { status: filter === "todos" ? "todos" : filter },
    { staleTime: 30 * 1000 }
  );

  // Get items for expanded order
  const { data: orderDetails } = trpc.salesOrders.getOrderDetails.useQuery(
    { orderId: expandedOrder! },
    { enabled: expandedOrder !== null }
  );

  const approveMutation = trpc.salesOrders.approveOrder.useMutation();
  const rejectMutation = trpc.salesOrders.rejectOrder.useMutation();
  const resetMutation = trpc.salesOrders.resetOrderNumbers.useMutation();
  const utils = trpc.useUtils();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleApprove = (orderId: number) => {
    approveMutation.mutate(
      { orderId, aprovadoPor: "Gestor" },
      {
        onSuccess: () => {
          utils.salesOrders.listOrders.invalidate();
          utils.salesOrders.getOrdersForGestor.invalidate();
        },
      }
    );
  };

  const handleReject = (orderId: number) => {
    if (!rejectReason.trim()) return;
    rejectMutation.mutate(
      { orderId, aprovadoPor: "Gestor", motivoRejeicao: rejectReason.trim() },
      {
        onSuccess: () => {
          utils.salesOrders.listOrders.invalidate();
          utils.salesOrders.getOrdersForGestor.invalidate();
          setRejectingOrder(null);
          setRejectReason("");
        },
      }
    );
  };

  const stats = useMemo(() => {
    if (!orders) return { pendentes: 0, aprovados: 0, rejeitados: 0, total: 0 };
    return {
      pendentes: orders.filter((o: any) => o.status === "pendente").length,
      aprovados: orders.filter((o: any) => o.status === "aprovado").length,
      rejeitados: orders.filter((o: any) => o.status === "rejeitado").length,
      total: orders.length,
    };
  }, [orders]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <TopNav />

      <main className="container py-4 md:py-6 space-y-4 md:space-y-5 pb-20 md:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/gestao-comercial">
              <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </button>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Aprovação de Pedidos</h1>
              <p className="text-xs text-slate-500">Gerencie os pedidos dos vendedores de rua</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                title="Resetar número de pedidos (apaga todos os pedidos de teste)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Resetar Pedidos
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-red-600 font-medium">Apagar TODOS os pedidos?</span>
                <button
                  onClick={() => {
                    resetMutation.mutate(undefined, {
                      onSuccess: () => {
                        utils.salesOrders.listOrders.invalidate();
                        utils.salesOrders.getOrdersForGestor.invalidate();
                        setShowResetConfirm(false);
                      }
                    });
                  }}
                  disabled={resetMutation.isPending}
                  className="px-2.5 py-1.5 text-[10px] font-bold text-white bg-red-500 rounded-md hover:bg-red-600 cursor-pointer"
                >
                  {resetMutation.isPending ? "..." : "Sim, resetar"}
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2.5 py-1.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded-md hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-lg text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] text-slate-500 uppercase font-bold">Total</span>
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-800 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-red-500" />
              <span className="text-[10px] text-red-600 uppercase font-bold">Pendentes</span>
            </div>
            <p className="text-xl font-bold text-red-600">{stats.pendentes}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-green-200 dark:border-green-800 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-[10px] text-green-600 uppercase font-bold">Aprovados</span>
            </div>
            <p className="text-xl font-bold text-green-600">{stats.aprovados}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] text-slate-500 uppercase font-bold">Recusados</span>
            </div>
            <p className="text-xl font-bold text-slate-600 dark:text-slate-300">{stats.rejeitados}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-1.5">
          <Filter className="w-4 h-4 text-slate-400 ml-2" />
          {(["todos", "pendente", "aprovado", "rejeitado"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === f
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              {f === "todos" ? "Todos" : f === "pendente" ? "Pendentes" : f === "aprovado" ? "Aprovados" : "Recusados"}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
            <RefreshCw className="w-5 h-5 text-teal-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-500">Carregando pedidos...</p>
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
            <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(orders as any[]).map((order) => {
              const isExpanded = expandedOrder === order.id;
              const isPending = order.status === "pendente";
              const isRed = order.temPrecoAbaixoMinimo;
              const borderColor = isPending && isRed
                ? "border-l-4 border-l-red-500"
                : order.status === "aprovado"
                ? "border-l-4 border-l-green-500"
                : order.status === "rejeitado"
                ? "border-l-4 border-l-slate-400"
                : "border-l-4 border-l-green-400";

              return (
                <div
                  key={order.id}
                  className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden ${borderColor}`}
                >
                  {/* Order Header */}
                  <button
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left cursor-pointer"
                  >
                    {/* Status Icon */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isPending && isRed ? "bg-red-100 dark:bg-red-900/30" :
                      order.status === "aprovado" ? "bg-green-100 dark:bg-green-900/30" :
                      order.status === "rejeitado" ? "bg-slate-100 dark:bg-slate-700" :
                      "bg-green-50 dark:bg-green-900/20"
                    }`}>
                      {isPending && isRed ? (
                        <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
                      ) : order.status === "aprovado" ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-600" />
                      ) : order.status === "rejeitado" ? (
                        <XCircle className="w-4.5 h-4.5 text-slate-500" />
                      ) : (
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-500" />
                      )}
                    </div>

                    {/* Order Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400">#{order.orderNumber || order.id}</span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {order.razaoSocial || order.nomeFantasia}
                        </p>
                        {/* Status Badge */}
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isPending && isRed ? "bg-red-100 text-red-700" :
                          isPending ? "bg-green-100 text-green-700" :
                          order.status === "aprovado" ? "bg-green-50 text-green-600" :
                          order.status === "rejeitado" ? "bg-red-50 text-red-600" :
                          "bg-blue-50 text-blue-600"
                        }`}>
                          {isPending && isRed ? "PREÇO ABAIXO - AGUARDANDO" :
                           isPending ? "OK - APROVADO AUTO" :
                           order.status === "aprovado" ? "APROVADO" :
                           order.status === "rejeitado" ? "RECUSADO" :
                           "PROCESSADO"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {order.sellerName}
                        </span>
                        {order.municipio && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {order.municipio}/{order.uf}
                          </span>
                        )}
                        <span>
                          {order.createdAt ? new Date(order.createdAt as string).toLocaleDateString("pt-BR") : ""}
                        </span>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(order.totalPedido)}
                      </p>
                    </div>

                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                      {/* Alert for below-min items */}
                      {order.temPrecoAbaixoMinimo && order.motivoAlerta && (
                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <p className="text-[11px] font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5 mb-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Vendendo abaixo do preço mínimo:
                          </p>
                          {order.motivoAlerta.split("; ").map((alerta: string, idx: number) => (
                            <p key={idx} className="text-[10px] text-red-600 dark:text-red-400 ml-5 mt-0.5">
                              • {alerta}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Order Items */}
                      {orderDetails && orderDetails.order.id === order.id && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            Itens do Pedido ({orderDetails.items.length})
                          </p>
                          {orderDetails.items.map((item) => (
                            <div
                              key={item.id}
                              className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${
                                item.abaixoDoMinimo
                                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                                  : "bg-slate-50 dark:bg-slate-700/50"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className={`text-[11px] font-medium truncate ${
                                  item.abaixoDoMinimo ? "text-red-800 dark:text-red-200" : "text-slate-700 dark:text-slate-200"
                                }`}>
                                  {item.descricaoItem}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-slate-400">
                                    {Number(item.quantidade).toFixed(0)} {item.unidadeMedida || "un"} × {formatCurrency(Number(item.precoUnitario))}
                                  </span>
                                  {item.abaixoDoMinimo && item.precoMinimo && (
                                    <span className="text-[9px] font-bold text-red-600 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded">
                                      Mín: {formatCurrency(Number(item.precoMinimo))} | -{((Number(item.precoMinimo) - Number(item.precoUnitario)) / Number(item.precoMinimo) * 100).toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 ml-2">
                                {formatCurrency(Number(item.totalItem))}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Client Info */}
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                        <div>
                          <span className="text-slate-400 uppercase font-bold">CNPJ/CPF</span>
                          <p className="text-slate-700 dark:text-slate-200 font-mono">{order.cnpjCpf}</p>
                        </div>
                        {order.condicaoPagamento && (
                          <div>
                            <span className="text-slate-400 uppercase font-bold">Pagamento</span>
                            <p className="text-slate-700 dark:text-slate-200">{order.condicaoPagamento}</p>
                          </div>
                        )}
                        {order.observacoes && (
                          <div className="col-span-2">
                            <span className="text-slate-400 uppercase font-bold">Observações</span>
                            <p className="text-slate-700 dark:text-slate-200">{order.observacoes}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions for pending orders */}
                      {order.status === "pendente" && order.temPrecoAbaixoMinimo && (
                        <div className="mt-4 flex gap-3">
                          {rejectingOrder === order.id ? (
                            <div className="flex-1 space-y-2">
                              <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Motivo da recusa (obrigatório)..."
                                rows={2}
                                className="w-full px-3 py-2 text-xs border border-red-200 dark:border-red-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setRejectingOrder(null); setRejectReason(""); }}
                                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => handleReject(order.id)}
                                  disabled={!rejectReason.trim() || rejectMutation.isPending}
                                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  {rejectMutation.isPending ? "Enviando..." : "Confirmar Recusa"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleApprove(order.id)}
                                disabled={approveMutation.isPending}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                {approveMutation.isPending ? "Aprovando..." : "Autorizar Pedido"}
                              </button>
                              <button
                                onClick={() => setRejectingOrder(order.id)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                                Recusar Pedido
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Rejection info */}
                      {order.status === "rejeitado" && order.motivoRejeicao && (
                        <div className="mt-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <p className="text-[10px] font-bold text-red-700 dark:text-red-400">Motivo da recusa:</p>
                          <p className="text-[11px] text-red-600 dark:text-red-300 mt-0.5">{order.motivoRejeicao}</p>
                          {order.aprovadoPor && (
                            <p className="text-[9px] text-red-500 mt-1">Recusado por: {order.aprovadoPor}</p>
                          )}
                        </div>
                      )}

                      {/* Approval info */}
                      {order.status === "aprovado" && order.aprovadoPor && (
                        <div className="mt-3 p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <p className="text-[10px] text-green-700 dark:text-green-400">
                            Aprovado por: <strong>{order.aprovadoPor}</strong>
                            {order.dataAprovacao && ` em ${new Date(order.dataAprovacao as string).toLocaleDateString("pt-BR")}`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
