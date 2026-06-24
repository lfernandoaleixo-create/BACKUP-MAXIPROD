/**
 * Vitória Orders - Painel da operadora para processar pedidos aprovados
 * Recebe pedidos aprovados e marca como processados após digitar no Maxiprod
 */
import { useState } from "react";
import TopNav from "@/components/TopNav";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2, Package, User, MapPin, DollarSign, ArrowLeft,
  RefreshCw, ClipboardCheck, Clock, Eye, ChevronDown, ChevronUp, FileText
} from "lucide-react";
import { Link } from "wouter";

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? Number(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function VitoriaOrders() {
  const [statusFilter, setStatusFilter] = useState<"aprovado" | "processado" | "todos">("aprovado");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const { data: orders, isLoading, refetch } = trpc.salesOrders.getOrdersForOperator.useQuery(
    { status: statusFilter },
    { staleTime: 30 * 1000 }
  );

  const { data: orderDetails } = trpc.salesOrders.getOrderDetails.useQuery(
    { orderId: expandedOrder! },
    { enabled: expandedOrder !== null }
  );

  const markProcessedMutation = trpc.salesOrders.markAsProcessed.useMutation();
  const utils = trpc.useUtils();

  const handleMarkProcessed = (orderId: number) => {
    markProcessedMutation.mutate(
      { orderId, processadoPor: "Vitória" },
      {
        onSuccess: () => {
          utils.salesOrders.getOrdersForOperator.invalidate();
        },
      }
    );
  };

  const pendingCount = orders?.filter((o: any) => o.status === "aprovado").length || 0;
  const processedCount = orders?.filter((o: any) => o.status === "processado").length || 0;

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

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-green-200 dark:border-green-800 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-green-500" />
              <span className="text-[10px] text-green-600 uppercase font-bold">A Processar</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{pendingCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardCheck className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] text-blue-600 uppercase font-bold">Processados</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{processedCount}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-1.5">
          {(["aprovado", "processado", "todos"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                statusFilter === f
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              {f === "aprovado" ? "A Processar" : f === "processado" ? "Processados" : "Todos"}
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
            <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {statusFilter === "aprovado" ? "Nenhum pedido pendente de processamento" : "Nenhum pedido encontrado"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(orders as any[]).map((order) => {
              const isExpanded = expandedOrder === order.id;
              const isProcessed = order.status === "processado";

              return (
                <div
                  key={order.id}
                  className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden ${
                    isProcessed
                      ? "border-blue-200 dark:border-blue-800 border-l-4 border-l-blue-400"
                      : "border-green-200 dark:border-green-800 border-l-4 border-l-green-500"
                  }`}
                >
                  {/* Order Header */}
                  <button
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left cursor-pointer"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isProcessed ? "bg-blue-100 dark:bg-blue-900/30" : "bg-green-100 dark:bg-green-900/30"
                    }`}>
                      {isProcessed ? (
                        <ClipboardCheck className="w-4.5 h-4.5 text-blue-600" />
                      ) : (
                        <FileText className="w-4.5 h-4.5 text-green-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400">#{order.id}</span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {order.razaoSocial || order.nomeFantasia}
                        </p>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isProcessed ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
                        }`}>
                          {isProcessed ? "PROCESSADO" : "PRONTO"}
                        </span>
                        {order.temPrecoAbaixoMinimo && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-700">
                            Gestor autorizou abaixo do mín.
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

                      {/* Mark as processed button */}
                      {order.status === "aprovado" && (
                        <div className="mt-4">
                          <button
                            onClick={() => handleMarkProcessed(order.id)}
                            disabled={markProcessedMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            <ClipboardCheck className="w-4 h-4" />
                            {markProcessedMutation.isPending ? "Processando..." : "Marcar como Digitado no Maxiprod"}
                          </button>
                        </div>
                      )}

                      {/* Processed info */}
                      {order.status === "processado" && (
                        <div className="mt-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-[10px] text-blue-700 dark:text-blue-400">
                            Processado por: <strong>{order.processadoPor || "Operador"}</strong>
                            {order.dataProcessamento && ` em ${new Date(order.dataProcessamento).toLocaleDateString("pt-BR")}`}
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
