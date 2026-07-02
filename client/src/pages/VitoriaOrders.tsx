/**
 * Vitória Orders - Painel da operadora para processar pedidos aprovados
 * Fluxo de status: Pendente → Recebido → Lançado no Maxiprod
 */
import { useState } from "react";
import TopNav from "@/components/TopNav";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2, Package, User, MapPin, ArrowLeft,
  RefreshCw, ClipboardCheck, Clock, ChevronDown, ChevronUp, FileText,
  Inbox, CheckCheck, AlertCircle
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? Number(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type VitoriaFilter = "pendente" | "recebido" | "lancado" | "todos";

export default function VitoriaOrders() {
  const [statusFilter, setStatusFilter] = useState<VitoriaFilter>("pendente");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const { data: orders, isLoading, refetch } = trpc.salesOrders.getOrdersForOperator.useQuery(
    { status: "todos" },
    { staleTime: 15 * 1000, refetchInterval: 30 * 1000 }
  );

  const { data: orderDetails } = trpc.salesOrders.getOrderDetails.useQuery(
    { orderId: expandedOrder! },
    { enabled: expandedOrder !== null }
  );

  const markRecebidoMutation = trpc.salesOrders.markRecebido.useMutation();
  const markLancadoMutation = trpc.salesOrders.markLancado.useMutation();
  const utils = trpc.useUtils();

  const handleMarkRecebido = (orderId: number) => {
    markRecebidoMutation.mutate(
      { orderId },
      {
        onSuccess: () => {
          toast.success("Pedido marcado como recebido!");
          utils.salesOrders.getOrdersForOperator.invalidate();
          utils.salesOrders.countPendingVitoria.invalidate();
        },
      }
    );
  };

  const handleMarkLancado = (orderId: number) => {
    markLancadoMutation.mutate(
      { orderId },
      {
        onSuccess: () => {
          toast.success("Pedido marcado como lançado no Maxiprod!");
          utils.salesOrders.getOrdersForOperator.invalidate();
          utils.salesOrders.countPendingVitoria.invalidate();
        },
      }
    );
  };

  // Filter orders based on Vitória's status flow
  const filteredOrders = (orders || []).filter((o: any) => {
    if (statusFilter === "todos") return true;
    if (statusFilter === "pendente") return o.status === "aprovado" && !o.vitoriaRecebido;
    if (statusFilter === "recebido") return o.vitoriaRecebido && !o.vitoriaLancado;
    if (statusFilter === "lancado") return o.vitoriaLancado;
    return true;
  });

  const pendingCount = (orders || []).filter((o: any) => o.status === "aprovado" && !o.vitoriaRecebido).length;
  const recebidoCount = (orders || []).filter((o: any) => o.vitoriaRecebido && !o.vitoriaLancado).length;
  const lancadoCount = (orders || []).filter((o: any) => o.vitoriaLancado).length;

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
              <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Pedidos para Processamento</h1>
              <p className="text-xs text-slate-500">Pedidos aprovados prontos para digitar no Maxiprod</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-lg text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>

        {/* Stats - 3 cards showing the flow */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm p-4 cursor-pointer transition-all ${
            statusFilter === "pendente" ? "border-amber-400 ring-2 ring-amber-200" : "border-amber-200 dark:border-amber-800"
          }`} onClick={() => setStatusFilter("pendente")}>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className="text-[9px] text-amber-600 uppercase font-bold">Novos</span>
            </div>
            <p className={`text-2xl font-bold ${pendingCount > 0 ? "text-amber-600" : "text-slate-300"}`}>{pendingCount}</p>
          </div>
          <div className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm p-4 cursor-pointer transition-all ${
            statusFilter === "recebido" ? "border-blue-400 ring-2 ring-blue-200" : "border-blue-200 dark:border-blue-800"
          }`} onClick={() => setStatusFilter("recebido")}>
            <div className="flex items-center gap-2 mb-1">
              <Inbox className="w-4 h-4 text-blue-500" />
              <span className="text-[9px] text-blue-600 uppercase font-bold">Recebidos</span>
            </div>
            <p className={`text-2xl font-bold ${recebidoCount > 0 ? "text-blue-600" : "text-slate-300"}`}>{recebidoCount}</p>
          </div>
          <div className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm p-4 cursor-pointer transition-all ${
            statusFilter === "lancado" ? "border-green-400 ring-2 ring-green-200" : "border-green-200 dark:border-green-800"
          }`} onClick={() => setStatusFilter("lancado")}>
            <div className="flex items-center gap-2 mb-1">
              <CheckCheck className="w-4 h-4 text-green-500" />
              <span className="text-[9px] text-green-600 uppercase font-bold">Lançados</span>
            </div>
            <p className={`text-2xl font-bold ${lancadoCount > 0 ? "text-green-600" : "text-slate-300"}`}>{lancadoCount}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-1.5">
          {([
            { key: "pendente", label: "Novos", icon: AlertCircle, color: "amber" },
            { key: "recebido", label: "Recebidos", icon: Inbox, color: "blue" },
            { key: "lancado", label: "Lançados", icon: CheckCheck, color: "green" },
            { key: "todos", label: "Todos", icon: Package, color: "slate" },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key as VitoriaFilter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                statusFilter === f.key
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              <f.icon className="w-3.5 h-3.5" />
              {f.label}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
            <RefreshCw className="w-5 h-5 text-teal-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-500">Carregando pedidos...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
            <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {statusFilter === "pendente" ? "Nenhum pedido novo aguardando" :
               statusFilter === "recebido" ? "Nenhum pedido recebido pendente de lançamento" :
               statusFilter === "lancado" ? "Nenhum pedido lançado ainda" :
               "Nenhum pedido encontrado"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(filteredOrders as any[]).map((order) => {
              const isExpanded = expandedOrder === order.id;
              const isLancado = order.vitoriaLancado;
              const isRecebido = order.vitoriaRecebido && !order.vitoriaLancado;
              const isNovo = order.status === "aprovado" && !order.vitoriaRecebido;

              // Determine border color based on status
              const borderClass = isLancado
                ? "border-green-200 dark:border-green-800 border-l-4 border-l-green-500"
                : isRecebido
                  ? "border-blue-200 dark:border-blue-800 border-l-4 border-l-blue-400"
                  : "border-amber-200 dark:border-amber-800 border-l-4 border-l-amber-500";

              return (
                <div
                  key={order.id}
                  className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden ${borderClass}`}
                >
                  {/* Order Header */}
                  <button
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left cursor-pointer"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isLancado ? "bg-green-100 dark:bg-green-900/30" :
                      isRecebido ? "bg-blue-100 dark:bg-blue-900/30" :
                      "bg-amber-100 dark:bg-amber-900/30"
                    }`}>
                      {isLancado ? (
                        <CheckCheck className="w-4.5 h-4.5 text-green-600" />
                      ) : isRecebido ? (
                        <Inbox className="w-4.5 h-4.5 text-blue-600" />
                      ) : (
                        <AlertCircle className="w-4.5 h-4.5 text-amber-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400">#{order.orderNumber || order.id}</span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {order.razaoSocial || order.nomeFantasia}
                        </p>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isLancado ? "bg-green-50 text-green-600" :
                          isRecebido ? "bg-blue-50 text-blue-600" :
                          "bg-amber-50 text-amber-700"
                        }`}>
                          {isLancado ? "LANÇADO" : isRecebido ? "RECEBIDO" : "NOVO"}
                        </span>
                        {order.temPrecoAbaixoMinimo && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-100 text-red-700">
                            Preço abaixo do mín.
                          </span>
                        )}
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
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-BR") : ""}
                        </span>
                      </div>
                    </div>

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
                      {/* Status Progress Bar */}
                      <div className="mt-3 mb-4">
                        <div className="flex items-center gap-1">
                          <div className={`flex-1 h-2 rounded-full ${isNovo || isRecebido || isLancado ? "bg-amber-400" : "bg-slate-200"}`} />
                          <div className={`flex-1 h-2 rounded-full ${isRecebido || isLancado ? "bg-blue-400" : "bg-slate-200"}`} />
                          <div className={`flex-1 h-2 rounded-full ${isLancado ? "bg-green-400" : "bg-slate-200"}`} />
                        </div>
                        <div className="flex justify-between mt-1 text-[9px] text-slate-400 font-medium">
                          <span className={isNovo || isRecebido || isLancado ? "text-amber-600" : ""}>Aprovado</span>
                          <span className={isRecebido || isLancado ? "text-blue-600" : ""}>Recebido</span>
                          <span className={isLancado ? "text-green-600" : ""}>Lançado</span>
                        </div>
                      </div>

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
                                  ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                                  : "bg-slate-50 dark:bg-slate-700/50"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
                                  {item.descricaoItem}
                                </p>
                                <span className="text-[10px] text-slate-400">
                                  {Number(item.quantidade).toFixed(0)} {item.unidadeMedida || "un"} × {formatCurrency(Number(item.precoUnitario))}
                                </span>
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

                      {/* ACTION BUTTONS - Status flow */}
                      {isNovo && (
                        <div className="mt-4">
                          <button
                            onClick={() => handleMarkRecebido(order.id)}
                            disabled={markRecebidoMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                          >
                            <Inbox className="w-4 h-4" />
                            {markRecebidoMutation.isPending ? "Marcando..." : "✓ OK — Recebi este pedido"}
                          </button>
                        </div>
                      )}

                      {isRecebido && (
                        <div className="mt-4">
                          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-3">
                            <p className="text-[10px] text-blue-700 dark:text-blue-400">
                              <CheckCircle2 className="w-3 h-3 inline mr-1" />
                              Recebido em {order.vitoriaRecebidoAt ? new Date(order.vitoriaRecebidoAt).toLocaleString("pt-BR") : "—"}
                            </p>
                          </div>
                          <button
                            onClick={() => handleMarkLancado(order.id)}
                            disabled={markLancadoMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                          >
                            <CheckCheck className="w-4 h-4" />
                            {markLancadoMutation.isPending ? "Marcando..." : "✓ OK — Já lancei no Maxiprod"}
                          </button>
                        </div>
                      )}

                      {isLancado && (
                        <div className="mt-3 p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <p className="text-[10px] text-green-700 dark:text-green-400 flex items-center gap-1">
                            <CheckCheck className="w-3 h-3" />
                            Lançado no Maxiprod em {order.vitoriaLancadoAt ? new Date(order.vitoriaLancadoAt).toLocaleString("pt-BR") : "—"}
                          </p>
                          {order.vitoriaRecebidoAt && (
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                              Recebido em {new Date(order.vitoriaRecebidoAt).toLocaleString("pt-BR")}
                            </p>
                          )}
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
