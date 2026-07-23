/**
 * Gestor Aprovações - Painel de aprovação de pedidos de venda
 * Mostra todos os pedidos dos vendedores:
 * - Verde: pedidos com preço OK (apenas para visualização)
 * - Vermelho: pedidos com preço abaixo do mínimo (precisa aprovar/recusar)
 */
import { useState, useMemo } from "react";
import { ProductMarginBar } from "@/components/ProductMarginBar";
import TopNav from "@/components/TopNav";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Eye, ChevronDown, ChevronUp,
  ShoppingCart, User, MapPin, DollarSign, Package, ArrowLeft, Filter, RefreshCw, RotateCcw, Trash2,
  Building2, Phone, CreditCard, TrendingUp, Calendar
} from "lucide-react";
import { Link } from "wouter";

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? Number(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type OrderWithItems = {
  id: number;
  orderNumber: number | null;
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
  // Full client details
  regimeTributario: string | null;
  emailNfe: string | null;
  cnaeFiscal: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  telefone1: string | null;
  telefone2: string | null;
  emailContato: string | null;
  inscricaoMunicipal: string | null;
  inscricaoSuframa: string | null;
  situacaoFiscalEspecial: string | null;
  website: string | null;
  segmento: string | null;
  formaCobranca: string | null;
  limiteCredito: string | null;
  tabelaPrecos: string | null;
  regiao: string | null;
  perfil: string | null;
  formaPedido: string | null;
  produtos: string | null;
  probabilidadeNegocio: string | null;
  tamanho: string | null;
  atencao: string | null;
  fornecedorAtual: string | null;
  situacaoCobranca: string | null;
  possuiRedespacho: boolean | null;
  redespachoCnpj: string | null;
  redespachoRazaoSocial: string | null;
  redespachoCep: string | null;
  redespachoLogradouro: string | null;
  redespachoNumero: string | null;
  redespachoBairro: string | null;
  redespachoCidade: string | null;
  redespachoUf: string | null;
  redespachoTelefone: string | null;
  enderecoEntregaMesmo: boolean | null;
  entregaCep: string | null;
  entregaLogradouro: string | null;
  entregaNumero: string | null;
  entregaBairro: string | null;
  entregaCidade: string | null;
  entregaUf: string | null;
  entregaTelefone: string | null;
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

export default function GestorAprovacoes(props: any = {}) {
  const gestorNameProp = props?.gestorName as string | undefined;
  // Read gestorName from URL search params if not passed as prop
  const urlParams = new URLSearchParams(window.location.search);
  const gestorName = gestorNameProp || urlParams.get("gestor") || undefined;

  const [filter, setFilter] = useState<"todos" | "pendente" | "aprovado" | "aprovado_subgestor" | "rejeitado">("todos");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingOrder, setApprovingOrder] = useState<number | null>(null);
  const [approvalObs, setApprovalObs] = useState("");
  const [approvalPassword, setApprovalPassword] = useState("");
  const [approvalPasswordError, setApprovalPasswordError] = useState("");
  // Juvenal gestor approval state
  const [gestorApprovingOrder, setGestorApprovingOrder] = useState<number | null>(null);
  const [gestorPassword, setGestorPassword] = useState("");
  const [gestorObs, setGestorObs] = useState("");
  const [gestorRejectingOrder, setGestorRejectingOrder] = useState<number | null>(null);
  const [gestorRejectReason, setGestorRejectReason] = useState("");
  const [gestorPasswordReject, setGestorPasswordReject] = useState("");

  // Fetch orders - filtered by gestorName if provided (for Renato/Juvenal individual view)
  const { data: orders, isLoading, refetch } = trpc.salesOrders.listOrders.useQuery(
    { status: filter === "todos" ? "todos" : filter, ...(gestorName ? { gestorName } : {}) },
    { staleTime: 30 * 1000 }
  );

  // Get items for expanded order
  const { data: orderDetails } = trpc.salesOrders.getOrderDetails.useQuery(
    { orderId: expandedOrder! },
    { enabled: expandedOrder !== null }
  );

  // Margin data for gestores - always enabled with default UF for collapsed card margins
  const orderUf = orderDetails?.order?.uf || "PR";
  const orderTipoContrib = (orderDetails?.order as any)?.tipoContribuinte || "Contribuinte";
  const orderSellerId = orderDetails?.order?.sellerId;

  const productMarginsInput = useMemo(() => ({
    ufDestino: orderUf, tipoContribuinte: orderTipoContrib
  }), [orderUf, orderTipoContrib]);
  const productMarginsQuery = trpc.salesOrders.getProductMargins.useQuery(
    productMarginsInput,
    { staleTime: 60 * 1000 }
  );

  const monthlyMarginInput = useMemo(() => ({
    sellerId: orderSellerId || 0,
  }), [orderSellerId]);
  const monthlyMarginQuery = trpc.salesOrders.getSellerMonthlyMargin.useQuery(
    monthlyMarginInput,
    { enabled: !!orderSellerId && orderSellerId > 0, staleTime: 30 * 1000 }
  );
  const [showMonthlyDetails, setShowMonthlyDetails] = useState(false);

  const approveMutation = trpc.salesOrders.approveOrder.useMutation();
  const rejectMutation = trpc.salesOrders.rejectOrder.useMutation();
  const gestorApproveMutation = trpc.salesOrders.gestorApproveSubgestorOrder.useMutation();
  const gestorRejectMutation = trpc.salesOrders.gestorRejectSubgestorOrder.useMutation();
  const resetMutation = trpc.salesOrders.resetOrderNumbers.useMutation();
  const deleteOrderMutation = trpc.salesOrders.deleteOrder.useMutation();
  const updateObsMutation = trpc.salesOrders.updateObservacaoAprovacao.useMutation();
  const utils = trpc.useUtils();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editingObsOrderId, setEditingObsOrderId] = useState<number | null>(null);
  const [editingObsText, setEditingObsText] = useState("");

  const handleApprove = (orderId: number) => {
    setApprovingOrder(orderId);
    setApprovalObs("");
    setApprovalPassword("");
    setApprovalPasswordError("");
  };

  const confirmApprove = () => {
    if (approvingOrder === null) return;
    if (!approvalPassword.trim()) {
      setApprovalPasswordError("Digite sua senha para aprovar");
      return;
    }
    setApprovalPasswordError("");
    approveMutation.mutate(
      {
        orderId: approvingOrder,
        aprovadoPor: gestorName || "Gestor",
        password: approvalPassword.trim(),
        observacaoAprovacao: approvalObs.trim() || undefined,
      },
      {
        onSuccess: () => {
          utils.salesOrders.listOrders.invalidate();
          utils.salesOrders.getOrdersForGestor.invalidate();
          setApprovingOrder(null);
          setApprovalObs("");
          setApprovalPassword("");
          setApprovalPasswordError("");
        },
        onError: (err) => {
          if (err.message.includes("Senha incorreta")) {
            setApprovalPasswordError("Senha incorreta. Use seu primeiro nome com inicial maiúscula.");
          } else {
            setApprovalPasswordError(err.message);
          }
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

  // Gestor (Juvenal) approval handlers
  const handleGestorApprove = () => {
    if (gestorApprovingOrder === null || !gestorPassword.trim()) return;
    gestorApproveMutation.mutate(
      { orderId: gestorApprovingOrder, password: gestorPassword.trim(), observacaoGestor: gestorObs.trim() || undefined },
      {
        onSuccess: () => {
          utils.salesOrders.listOrders.invalidate();
          utils.salesOrders.getOrdersForGestor.invalidate();
          utils.salesOrders.getOrdersPendingGestorApproval.invalidate();
          setGestorApprovingOrder(null);
          setGestorPassword("");
          setGestorObs("");
        },
        onError: (err: any) => {
          alert(err.message || "Erro ao aprovar");
        },
      }
    );
  };
  const handleGestorReject = () => {
    if (gestorRejectingOrder === null || !gestorPasswordReject.trim() || !gestorRejectReason.trim()) return;
    gestorRejectMutation.mutate(
      { orderId: gestorRejectingOrder, password: gestorPasswordReject.trim(), motivoRejeicao: gestorRejectReason.trim() },
      {
        onSuccess: () => {
          utils.salesOrders.listOrders.invalidate();
          utils.salesOrders.getOrdersForGestor.invalidate();
          utils.salesOrders.getOrdersPendingGestorApproval.invalidate();
          setGestorRejectingOrder(null);
          setGestorPasswordReject("");
          setGestorRejectReason("");
        },
        onError: (err: any) => {
          alert(err.message || "Erro ao rejeitar");
        },
      }
    );
  };

  const isJuvenalViewing = gestorName === "JUVENAL TEIXEIRA";

  const stats = useMemo(() => {
    if (!orders) return { pendentes: 0, aprovados: 0, rejeitados: 0, aguardandoGestor: 0, total: 0 };
    return {
      pendentes: orders.filter((o: any) => o.status === "pendente").length,
      aprovados: orders.filter((o: any) => o.status === "aprovado" || o.status === "processado").length,
      rejeitados: orders.filter((o: any) => o.status === "rejeitado").length,
      aguardandoGestor: orders.filter((o: any) => o.status === "aprovado_subgestor").length,
      total: orders.length,
    };
  }, [orders]);

  // Calculate order margin for each order (for collapsed card badges)
  const orderMarginsMap = useMemo(() => {
    if (!orders || !productMarginsQuery.data) return new Map<number, number>();
    const map = new Map<number, number>();
    const { costMap, taxBreakdownImportado, taxBreakdownIndustrializado } = productMarginsQuery.data;
    for (const order of orders as any[]) {
      if (!order.items?.length) continue;
      let sumPVxM = 0, sumPV = 0;
      for (const item of order.items) {
        const cd = costMap[item.codigoItem];
        if (!cd) continue;
        const pv = Number(item.precoUnitario);
        if (pv <= 0) continue;
        const taxBd = cd.tipoProduto === "industrializado" ? taxBreakdownIndustrializado : taxBreakdownImportado;
        const totalDed = (cd.cost / pv) * 100 + (taxBd?.total || 0) + 13 + 5.85;
        const m = 100 - totalDed;
        const tv = pv * Number(item.quantidade);
        sumPVxM += tv * m;
        sumPV += tv;
      }
      if (sumPV > 0) map.set(order.id, sumPVxM / sumPV);
    }
    return map;
  }, [orders, productMarginsQuery.data]);

  // Helper for margin tier color
  const getMarginColor = (m: number) => {
    if (m < 15) return { bg: 'bg-red-100', text: 'text-red-700', label: 'Crítico' };
    if (m < 20) return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Comissão Baixa' };
    if (m < 25) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Comissão Média' };
    if (m < 29) return { bg: 'bg-green-100', text: 'text-green-700', label: 'Comissão Média-Alta' };
    return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Comissão Alta' };
  };

  const isInline = !!gestorNameProp; // When used inline (as component), skip page wrapper
  
  const content = (
    <div className={isInline ? "space-y-4" : "container py-4 md:py-6 space-y-4 md:space-y-5 pb-20 md:pb-6"}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isInline && (
              <Link href="/gestao-comercial">
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">
                  <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>
              </Link>
            )}
            <div>
              <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{isInline ? "Aprovações de Pedidos" : "Aprovação de Pedidos"}</h1>
              <p className="text-xs text-slate-500">{gestorName ? `Pedidos dos vendedores de ${gestorName}` : "Gerencie os pedidos dos vendedores de rua"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isInline && !showResetConfirm && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                title="Resetar número de pedidos (apaga todos os pedidos de teste)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Resetar Pedidos
              </button>
            )}
            {!isInline && showResetConfirm && (
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
          {(["todos", "pendente", ...(isJuvenalViewing ? ["aprovado_subgestor" as const] : []), "aprovado", "rejeitado"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === f
                  ? f === "aprovado_subgestor" ? "bg-amber-500 text-white shadow-sm" : "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              {f === "todos" ? "Todos" : f === "pendente" ? "Pendentes" : f === "aprovado_subgestor" ? `Aguardando Gestor (${stats.aguardandoGestor})` : f === "aprovado" ? "Aprovados" : "Recusados"}
            </button>
          ))}
        </div>

        {/* Monthly Seller Reputation Bar - TOP (above orders list) */}
        {monthlyMarginQuery.data && (() => {
          const md = monthlyMarginQuery.data;
          const margin = md.currentMonthlyMargin ?? 0;
          if (md.totalOrders === 0) return null;
          const mColor = getMarginColor(margin);
          const barMin = -5;
          const barMax = 40;
          const clamped = Math.max(barMin, Math.min(barMax, margin));
          const pos = ((clamped - barMin) / (barMax - barMin)) * 100;
          const sellerNameForBar = orderDetails?.order?.sellerName || (orders as any[])?.[0]?.sellerName || '';
          return (
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-700 uppercase">Reputação do Mês — {sellerNameForBar} ({md.month})</span>
                </div>
                <span className={`text-base font-black tabular-nums ${mColor.text}`}>
                  {margin.toFixed(1)}% ({mColor.label})
                </span>
              </div>
              <div className="relative w-full">
                <div className="relative h-7 rounded-full overflow-visible border-2 border-slate-300 shadow-sm">
                  <div className="absolute inset-0 rounded-full overflow-hidden flex">
                    <div className="h-full bg-red-500" style={{ width: "44.4%" }} />
                    <div className="h-full bg-orange-500" style={{ width: "11.1%" }} />
                    <div className="h-full bg-yellow-400" style={{ width: "11.1%" }} />
                    <div className="h-full bg-green-500" style={{ width: "8.9%" }} />
                    <div className="h-full bg-blue-500" style={{ width: "24.5%" }} />
                  </div>
                  <div className="absolute top-0 bottom-0 w-[2px] bg-white/90" style={{ left: "44.4%" }} />
                  <div className="absolute top-0 bottom-0 w-[2px] bg-white/90" style={{ left: "55.5%" }} />
                  <div className="absolute top-0 bottom-0 w-[2px] bg-white/90" style={{ left: "66.6%" }} />
                  <div className="absolute top-0 bottom-0 w-[2px] bg-white/90" style={{ left: "75.5%" }} />
                  <div
                    className="absolute flex flex-col items-center"
                    style={{ left: `${pos}%`, transform: "translateX(-50%)", top: "-7px", bottom: "-3px" }}
                  >
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-slate-900" />
                    <div className="w-[3px] flex-1 bg-slate-900 rounded-full" />
                  </div>
                </div>
                <div className="relative w-full h-3 mt-0.5">
                  <span className="absolute text-[8px] font-bold text-indigo-400" style={{ left: "44.4%", transform: "translateX(-50%)" }}>15%</span>
                  <span className="absolute text-[8px] font-bold text-indigo-400" style={{ left: "55.5%", transform: "translateX(-50%)" }}>20%</span>
                  <span className="absolute text-[8px] font-bold text-indigo-400" style={{ left: "66.6%", transform: "translateX(-50%)" }}>25%</span>
                  <span className="absolute text-[8px] font-bold text-indigo-400" style={{ left: "75.5%", transform: "translateX(-50%)" }}>29%</span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{md.totalOrders} pedido{md.totalOrders !== 1 ? 's' : ''} no mês</span>
                <div className="flex items-center gap-2">
                  {md.monthlyComissaoPercentual > 0 && (
                    <span className="font-bold text-emerald-600">Comissão: {md.monthlyComissaoPercentual}%</span>
                  )}
                  {md.orderBreakdown && md.orderBreakdown.length > 0 && (
                    <button
                      onClick={() => setShowMonthlyDetails(prev => !prev)}
                      className="text-[11px] font-medium text-teal-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {showMonthlyDetails ? 'Ocultar' : 'Detalhes'}
                    </button>
                  )}
                </div>
              </div>
              {showMonthlyDetails && md.orderBreakdown && md.orderBreakdown.length > 0 && (
                <div className="mt-2 border-t border-slate-200 pt-2">
                  <p className="text-[10px] font-bold text-slate-600 mb-1.5">Pedidos do mês:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {md.orderBreakdown.map((ob: any, idx: number) => {
                      const peso = md.totalValue > 0 ? (ob.valor / md.totalValue) * 100 : 0;
                      const tierColor = ob.margem >= 29 ? 'text-blue-600' : ob.margem >= 25 ? 'text-green-600' : ob.margem >= 20 ? 'text-yellow-600' : ob.margem >= 15 ? 'text-orange-600' : 'text-red-600';
                      return (
                        <div key={idx} className="flex items-center justify-between bg-white rounded px-2 py-1">
                          <span className="text-[9px] text-slate-600 truncate flex-1">#{ob.orderId} \u2014 {ob.clienteNome || 'Cliente'}</span>
                          <div className="flex items-center gap-2 text-[9px] shrink-0">
                            <span className="text-slate-400">{Number(ob.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            <span className={`font-bold ${tierColor}`}>{ob.margem.toFixed(1)}%</span>
                            <span className="text-slate-400">({peso.toFixed(0)}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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
              const isAwaitingGestor = order.status === "aprovado_subgestor";
              const isRed = order.temPrecoAbaixoMinimo;
              const borderColor = isPending && isRed
                ? "border-l-4 border-l-red-500"
                : isPending
                ? "border-l-4 border-l-amber-400"
                : isAwaitingGestor
                ? "border-l-4 border-l-orange-500"
                : order.status === "aprovado"
                ? "border-l-4 border-l-green-500"
                : order.status === "rejeitado"
                ? "border-l-4 border-l-slate-400"
                : "border-l-4 border-l-blue-400";

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
                      isPending ? "bg-amber-100 dark:bg-amber-900/30" :
                      isAwaitingGestor ? "bg-orange-100 dark:bg-orange-900/30" :
                      order.status === "aprovado" ? "bg-green-100 dark:bg-green-900/30" :
                      order.status === "rejeitado" ? "bg-slate-100 dark:bg-slate-700" :
                      "bg-blue-50 dark:bg-blue-900/20"
                    }`}>
                      {isPending && isRed ? (
                        <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
                      ) : isPending ? (
                        <Clock className="w-4.5 h-4.5 text-amber-600" />
                      ) : isAwaitingGestor ? (
                        <Clock className="w-4.5 h-4.5 text-orange-600" />
                      ) : order.status === "aprovado" ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-600" />
                      ) : order.status === "rejeitado" ? (
                        <XCircle className="w-4.5 h-4.5 text-slate-500" />
                      ) : (
                        <CheckCircle2 className="w-4.5 h-4.5 text-blue-500" />
                      )}
                    </div>

                    {/* Order Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400">#{String(order.orderNumber || order.id).padStart(2, '0')}</span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {order.razaoSocial || order.nomeFantasia}
                        </p>
                        {/* Status Badge */}
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isPending && isRed ? "bg-red-100 text-red-700" :
                          isPending ? "bg-amber-100 text-amber-700" :
                          isAwaitingGestor ? "bg-orange-100 text-orange-700" :
                          order.status === "aprovado" ? "bg-green-50 text-green-600" :
                          order.status === "rejeitado" ? "bg-red-50 text-red-600" :
                          "bg-blue-50 text-blue-600"
                        }`}>
                          {isPending && isRed ? "PREÇO ABAIXO - PENDENTE" :
                           isPending ? "PENDENTE" :
                           isAwaitingGestor ? "AGUARDANDO GESTOR" :
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

                    {/* Total + Margin Badge + Delete */}
                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <p className="text-sm font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(order.totalPedido)}
                      </p>
                      {/* Order Margin Badge */}
                      {orderMarginsMap.has(order.id) && (() => {
                        const m = orderMarginsMap.get(order.id)!;
                        const mc = getMarginColor(m);
                        return (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums ${mc.bg} ${mc.text}`} title={`Margem do pedido: ${m.toFixed(1)}%`}>
                            {m.toFixed(1)}%
                          </span>
                        );
                      })()}
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(order.id); }}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                        title="Excluir pedido"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                          {orderDetails.items.map((item) => {
                            return (
                              <div key={item.id} className="space-y-1">
                                <div
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
                                      <span className="text-slate-400 dark:text-slate-500 font-mono">{item.codigoItem}</span>{" "}{item.descricaoItem}
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
                                {/* Inline ProductMarginBar per product - based on discount from preço mostrado */}
                                {(() => {
                                  const precoMostrado = orderDetails.priceTableMap?.[item.codigoItem] || 0;
                                  if (precoMostrado <= 0) return null;
                                  const precoVenda = Number(item.precoUnitario);
                                  const descontoDado = ((precoMostrado - precoVenda) / precoMostrado) * 100;
                                  return (
                                    <div className="ml-2 mr-2">
                                      <ProductMarginBar desconto={descontoDado} showValues={false} />
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Full Client Info - Same as Vitoria sees */}
                      <div className="mt-4 space-y-3">
                        {/* Section: Dados do Cliente */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-2">
                            <Building2 className="w-3 h-3" />
                            Dados do Cliente
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[10px]">
                            {order.razaoSocial && (
                              <div className="col-span-2 md:col-span-3">
                                <span className="text-slate-400 font-semibold">Razão Social</span>
                                <p className="text-slate-800 dark:text-slate-100 font-medium">{order.razaoSocial}</p>
                              </div>
                            )}
                            {order.nomeFantasia && (
                              <div className="col-span-2 md:col-span-2">
                                <span className="text-slate-400 font-semibold">Nome Fantasia</span>
                                <p className="text-slate-800 dark:text-slate-100">{order.nomeFantasia}</p>
                              </div>
                            )}
                            {order.cnpjCpf && (
                              <div>
                                <span className="text-slate-400 font-semibold">CNPJ/CPF</span>
                                <p className="text-slate-800 dark:text-slate-100 font-mono text-[9px]">{order.cnpjCpf}</p>
                              </div>
                            )}
                            {order.regimeTributario && (
                              <div>
                                <span className="text-slate-400 font-semibold">Regime Tributário</span>
                                <p className="text-slate-800 dark:text-slate-100">{order.regimeTributario}</p>
                              </div>
                            )}
                            {order.emailNfe && (
                              <div>
                                <span className="text-slate-400 font-semibold">Email NF-e</span>
                                <p className="text-slate-800 dark:text-slate-100 text-[9px] truncate">{order.emailNfe}</p>
                              </div>
                            )}
                            {order.cnaeFiscal && (
                              <div>
                                <span className="text-slate-400 font-semibold">CNAE Fiscal</span>
                                <p className="text-slate-800 dark:text-slate-100 font-mono text-[9px]">{order.cnaeFiscal}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Section: Endereço */}
                        {(order.cep || order.endereco || order.municipio) && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-2">
                              <MapPin className="w-3 h-3" />
                              Endereço
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[10px]">
                              {order.cep && (
                                <div>
                                  <span className="text-slate-400 font-semibold">CEP</span>
                                  <p className="text-slate-800 dark:text-slate-100 font-mono">{order.cep}</p>
                                </div>
                              )}
                              {(order.endereco || order.numero) && (
                                <div className="col-span-2">
                                  <span className="text-slate-400 font-semibold">Endereço</span>
                                  <p className="text-slate-800 dark:text-slate-100">
                                    {order.endereco}{order.numero ? `, ${order.numero}` : ""}{order.complemento ? ` - ${order.complemento}` : ""}
                                  </p>
                                </div>
                              )}
                              {order.bairro && (
                                <div>
                                  <span className="text-slate-400 font-semibold">Bairro</span>
                                  <p className="text-slate-800 dark:text-slate-100">{order.bairro}</p>
                                </div>
                              )}
                              {(order.municipio || order.uf) && (
                                <div>
                                  <span className="text-slate-400 font-semibold">Município/UF</span>
                                  <p className="text-slate-800 dark:text-slate-100">{order.municipio}{order.uf ? `/${order.uf}` : ""}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Section: Contato */}
                        {(order.telefone1 || order.telefone2 || order.emailContato) && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-2">
                              <Phone className="w-3 h-3" />
                              Contato
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[10px]">
                              {order.telefone1 && (
                                <div>
                                  <span className="text-slate-400 font-semibold">Telefone 1</span>
                                  <p className="text-slate-800 dark:text-slate-100">{order.telefone1}</p>
                                </div>
                              )}
                              {order.telefone2 && (
                                <div>
                                  <span className="text-slate-400 font-semibold">Telefone 2</span>
                                  <p className="text-slate-800 dark:text-slate-100">{order.telefone2}</p>
                                </div>
                              )}
                              {order.emailContato && (
                                <div>
                                  <span className="text-slate-400 font-semibold">Email</span>
                                  <p className="text-slate-800 dark:text-slate-100 truncate">{order.emailContato}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Dados Fiscais */}
                        {(order.regimeTributario || order.inscricaoMunicipal || order.inscricaoSuframa || order.situacaoFiscalEspecial || order.cnaeFiscal || order.emailNfe || order.website) && (
                          <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1 mb-2">
                              📋 Dados Fiscais
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[10px]">
                              {order.regimeTributario && (<div><span className="text-slate-400 font-semibold">Regime Tributário</span><p className="text-slate-800 dark:text-slate-100">{order.regimeTributario}</p></div>)}
                              {order.inscricaoMunicipal && (<div><span className="text-slate-400 font-semibold">Inscrição Municipal</span><p className="text-slate-800 dark:text-slate-100">{order.inscricaoMunicipal}</p></div>)}
                              {order.inscricaoSuframa && (<div><span className="text-slate-400 font-semibold">SUFRAMA</span><p className="text-slate-800 dark:text-slate-100">{order.inscricaoSuframa}</p></div>)}
                              {order.situacaoFiscalEspecial && (<div><span className="text-slate-400 font-semibold">Sit. Fiscal Especial</span><p className="text-slate-800 dark:text-slate-100">{order.situacaoFiscalEspecial}</p></div>)}
                              {order.cnaeFiscal && (<div><span className="text-slate-400 font-semibold">CNAE Fiscal</span><p className="text-slate-800 dark:text-slate-100">{order.cnaeFiscal}</p></div>)}
                              {order.emailNfe && (<div><span className="text-slate-400 font-semibold">Email NFe</span><p className="text-slate-800 dark:text-slate-100">{order.emailNfe}</p></div>)}
                              {order.website && (<div><span className="text-slate-400 font-semibold">Website</span><p className="text-slate-800 dark:text-slate-100">{order.website}</p></div>)}
                            </div>
                          </div>
                        )}

                        {/* Dados Comerciais / Venda */}
                        {(order.segmento || order.condicaoPagamento || order.formaCobranca || order.limiteCredito || order.tabelaPrecos || order.observacoes) && (
                          <div className="bg-green-50/50 dark:bg-green-900/10 rounded-lg p-3 border border-green-200 dark:border-green-700">
                            <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase flex items-center gap-1 mb-2">
                              <CreditCard className="w-3 h-3" />
                              Dados de Venda
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[10px]">
                              {order.segmento && (<div><span className="text-slate-400 font-semibold">Segmento</span><p className="text-slate-800 dark:text-slate-100">{order.segmento}</p></div>)}
                              {order.limiteCredito && (<div><span className="text-slate-400 font-semibold">Limite Crédito</span><p className="text-slate-800 dark:text-slate-100">R$ {order.limiteCredito}</p></div>)}
                              {order.formaCobranca && (<div><span className="text-slate-400 font-semibold">Forma Cobrança</span><p className="text-slate-800 dark:text-slate-100">{order.formaCobranca}</p></div>)}
                              {order.tabelaPrecos && (<div><span className="text-slate-400 font-semibold">Tabela Preços</span><p className="text-slate-800 dark:text-slate-100">{order.tabelaPrecos}</p></div>)}
                              {order.condicaoPagamento && (<div><span className="text-slate-400 font-semibold">Condição Pagamento</span><p className="text-slate-800 dark:text-slate-100">{order.condicaoPagamento}</p></div>)}
                              {order.observacoes && (<div className="col-span-2 md:col-span-3"><span className="text-slate-400 font-semibold">Observações</span><p className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{order.observacoes}</p></div>)}
                            </div>
                          </div>
                        )}

                        {/* Dados CRM / Relacionamento */}
                        {(order.regiao || order.perfil || order.formaPedido || order.produtos || order.probabilidadeNegocio || order.tamanho || order.atencao || order.fornecedorAtual) && (
                          <div className="bg-purple-50/50 dark:bg-purple-900/10 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                            <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase flex items-center gap-1 mb-2">
                              🏢 Relacionamento (CRM)
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[10px]">
                              {order.regiao && (<div><span className="text-slate-400 font-semibold">Região</span><p className="text-slate-800 dark:text-slate-100">{order.regiao}</p></div>)}
                              {order.perfil && (<div><span className="text-slate-400 font-semibold">Perfil</span><p className="text-slate-800 dark:text-slate-100">{order.perfil}</p></div>)}
                              {order.formaPedido && (<div><span className="text-slate-400 font-semibold">Forma Pedido</span><p className="text-slate-800 dark:text-slate-100">{order.formaPedido}</p></div>)}
                              {order.produtos && (<div><span className="text-slate-400 font-semibold">Produtos</span><p className="text-slate-800 dark:text-slate-100">{order.produtos}</p></div>)}
                              {order.probabilidadeNegocio && (<div><span className="text-slate-400 font-semibold">Probabilidade</span><p className="text-slate-800 dark:text-slate-100">{order.probabilidadeNegocio}</p></div>)}
                              {order.tamanho && (<div><span className="text-slate-400 font-semibold">Tamanho</span><p className="text-slate-800 dark:text-slate-100">{order.tamanho}</p></div>)}
                              {order.atencao && order.atencao !== "Normal" && (<div><span className="text-slate-400 font-semibold">Atenção</span><p className="text-orange-600 dark:text-orange-400 font-bold">{order.atencao}</p></div>)}
                              {order.fornecedorAtual && (<div><span className="text-slate-400 font-semibold">Fornecedor Atual</span><p className="text-slate-800 dark:text-slate-100">{order.fornecedorAtual}</p></div>)}
                            </div>
                          </div>
                        )}

                        {/* Cobrança */}
                        {order.situacaoCobranca && order.situacaoCobranca !== "SEM PROTESTO" && (
                          <div className="bg-red-50/50 dark:bg-red-900/10 rounded-lg p-3 border border-red-200 dark:border-red-700">
                            <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase flex items-center gap-1 mb-2">
                              ⚠️ Cobrança
                            </p>
                            <div className="text-[10px]">
                              <span className="text-red-500 font-semibold">Situação:</span>
                              <span className="text-red-700 dark:text-red-300 font-bold ml-1">{order.situacaoCobranca}</span>
                            </div>
                          </div>
                        )}

                        {/* Redespacho */}
                        <div className={`rounded-lg p-3 border ${order.possuiRedespacho ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700" : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"}`}>
                          <p className={`text-[10px] font-bold uppercase flex items-center gap-1 mb-1 ${order.possuiRedespacho ? "text-blue-600 dark:text-blue-300" : "text-slate-500 dark:text-slate-400"}`}>
                            🚚 Possui Redespacho: <span className="ml-1 font-bold">{order.possuiRedespacho ? "Sim" : "Não"}</span>
                          </p>
                          {order.possuiRedespacho && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[10px] mt-1">
                              {order.redespachoCnpj && (
                                <div>
                                  <span className="text-slate-400 font-semibold">CNPJ</span>
                                  <p className="text-slate-800 dark:text-slate-100 font-mono">{order.redespachoCnpj}</p>
                                </div>
                              )}
                              {order.redespachoRazaoSocial && (
                                <div>
                                  <span className="text-slate-400 font-semibold">Razão Social</span>
                                  <p className="text-slate-800 dark:text-slate-100">{order.redespachoRazaoSocial}</p>
                                </div>
                              )}
                              {order.redespachoCep && (
                                <div>
                                  <span className="text-slate-400 font-semibold">CEP</span>
                                  <p className="text-slate-800 dark:text-slate-100">{order.redespachoCep}</p>
                                </div>
                              )}
                              {(order.redespachoLogradouro || order.redespachoNumero || order.redespachoBairro) && (
                                <div className="col-span-2">
                                  <span className="text-slate-400 font-semibold">Endereço</span>
                                  <p className="text-slate-800 dark:text-slate-100">{[order.redespachoLogradouro, order.redespachoNumero, order.redespachoBairro, order.redespachoCidade, order.redespachoUf].filter(Boolean).join(", ")}</p>
                                </div>
                              )}
                              {order.redespachoTelefone && (
                                <div>
                                  <span className="text-slate-400 font-semibold">Telefone</span>
                                  <p className="text-slate-800 dark:text-slate-100">{order.redespachoTelefone}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Endereço de Entrega */}
                        <div className={`rounded-lg p-3 border ${!order.enderecoEntregaMesmo ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700" : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"}`}>
                          <p className={`text-[10px] font-bold uppercase flex items-center gap-1 mb-1 ${!order.enderecoEntregaMesmo ? "text-orange-600 dark:text-orange-300" : "text-slate-500 dark:text-slate-400"}`}>
                            📦 Endereço de entrega é o mesmo do cadastro: <span className="ml-1 font-bold">{order.enderecoEntregaMesmo ? "Sim" : "Não"}</span>
                          </p>
                          {!order.enderecoEntregaMesmo && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[10px] mt-1">
                              {order.entregaCep && (
                                <div>
                                  <span className="text-slate-400 font-semibold">CEP</span>
                                  <p className="text-slate-800 dark:text-slate-100">{order.entregaCep}</p>
                                </div>
                              )}
                              {(order.entregaLogradouro || order.entregaNumero || order.entregaBairro) && (
                                <div className="col-span-2">
                                  <span className="text-slate-400 font-semibold">Endereço</span>
                                  <p className="text-slate-800 dark:text-slate-100">{[order.entregaLogradouro, order.entregaNumero, order.entregaBairro, order.entregaCidade, order.entregaUf].filter(Boolean).join(", ")}</p>
                                </div>
                              )}
                              {order.entregaTelefone && (
                                <div>
                                  <span className="text-slate-400 font-semibold">Telefone</span>
                                  <p className="text-slate-800 dark:text-slate-100">{order.entregaTelefone}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>



                      {/* Actions for pending orders */}
                      {order.status === "pendente" && (
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
                          ) : approvingOrder === order.id ? (
                            <div className="space-y-2 w-full">
                              <label className="text-[10px] font-bold text-green-700 dark:text-green-400 block">
                                Senha de aprovação (obrigatória):
                              </label>
                              <input
                                type="password"
                                value={approvalPassword}
                                onChange={(e) => { setApprovalPassword(e.target.value); setApprovalPasswordError(""); }}
                                placeholder="Digite sua senha (primeiro nome)"
                                className="w-full px-3 py-2 text-xs border border-green-200 dark:border-green-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                              />
                              {approvalPasswordError && (
                                <p className="text-[10px] text-red-500 font-medium">{approvalPasswordError}</p>
                              )}
                              <label className="text-[10px] font-bold text-green-700 dark:text-green-400 block mt-2">
                                Observação de aprovação (opcional):
                              </label>
                              <textarea
                                value={approvalObs}
                                onChange={(e) => setApprovalObs(e.target.value)}
                                placeholder="Justifique a aprovação e/ou o preço praticado... (ex: cliente estratégico, volume alto, negociação especial)"
                                rows={3}
                                className="w-full px-3 py-2 text-xs border border-green-200 dark:border-green-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 resize-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setApprovingOrder(null); setApprovalObs(""); setApprovalPassword(""); setApprovalPasswordError(""); }}
                                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={confirmApprove}
                                  disabled={approveMutation.isPending}
                                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  {approveMutation.isPending ? "Aprovando..." : "Confirmar Autorização"}
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
                                Autorizar Pedido
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

                      {/* Actions for orders awaiting gestor (Juvenal) approval */}
                      {order.status === "aprovado_subgestor" && isJuvenalViewing && (
                        <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                          <p className="text-[10px] font-bold text-orange-700 dark:text-orange-400 mb-2">
                            ⚠️ Aprovado pelo subgestor Renato — aguardando sua aprovação final
                          </p>
                          {order.aprovadoPor && (
                            <p className="text-[10px] text-orange-600 dark:text-orange-300 mb-2">
                              Aprovado por: {order.aprovadoPor} em {order.dataAprovacao ? new Date(order.dataAprovacao as string).toLocaleDateString("pt-BR") : "-"}
                              {order.observacaoAprovacao && <span className="block mt-0.5">Obs: {order.observacaoAprovacao}</span>}
                            </p>
                          )}
                          {gestorApprovingOrder === order.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={gestorObs}
                                onChange={(e) => setGestorObs(e.target.value)}
                                placeholder="Observação do gestor (opcional)..."
                                rows={2}
                                className="w-full px-3 py-2 text-xs border border-green-200 dark:border-green-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 resize-none"
                              />
                              <input
                                type="password"
                                value={gestorPassword}
                                onChange={(e) => setGestorPassword(e.target.value)}
                                placeholder="Senha do gestor"
                                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setGestorApprovingOrder(null); setGestorPassword(""); setGestorObs(""); }}
                                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={handleGestorApprove}
                                  disabled={!gestorPassword.trim() || gestorApproveMutation.isPending}
                                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  {gestorApproveMutation.isPending ? "Aprovando..." : "Confirmar Aprovação"}
                                </button>
                              </div>
                            </div>
                          ) : gestorRejectingOrder === order.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={gestorRejectReason}
                                onChange={(e) => setGestorRejectReason(e.target.value)}
                                placeholder="Motivo da rejeição (obrigatório)..."
                                rows={2}
                                className="w-full px-3 py-2 text-xs border border-red-200 dark:border-red-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
                              />
                              <input
                                type="password"
                                value={gestorPasswordReject}
                                onChange={(e) => setGestorPasswordReject(e.target.value)}
                                placeholder="Senha do gestor"
                                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setGestorRejectingOrder(null); setGestorPasswordReject(""); setGestorRejectReason(""); }}
                                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={handleGestorReject}
                                  disabled={!gestorPasswordReject.trim() || !gestorRejectReason.trim() || gestorRejectMutation.isPending}
                                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  {gestorRejectMutation.isPending ? "Rejeitando..." : "Confirmar Rejeição"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setGestorApprovingOrder(order.id)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Aprovar (Gestor)
                              </button>
                              <button
                                onClick={() => setGestorRejectingOrder(order.id)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                                Rejeitar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Awaiting gestor info (for non-Juvenal viewers) */}
                      {order.status === "aprovado_subgestor" && !isJuvenalViewing && (
                        <div className="mt-3 p-2.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                          <p className="text-[10px] font-bold text-orange-700 dark:text-orange-400">
                            Aguardando aprovação do gestor Juvenal
                          </p>
                          <p className="text-[10px] text-orange-600 dark:text-orange-300 mt-0.5">
                            Aprovado pelo subgestor: {order.aprovadoPor}
                            {order.dataAprovacao && ` em ${new Date(order.dataAprovacao as string).toLocaleDateString("pt-BR")}`}
                          </p>
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
                          {editingObsOrderId === order.id ? (
                            <div className="mt-1.5 space-y-1.5">
                              <textarea
                                value={editingObsText}
                                onChange={(e) => setEditingObsText(e.target.value)}
                                placeholder="Justifique a aprovação e/ou o preço praticado..."
                                rows={2}
                                className="w-full px-2 py-1.5 text-[11px] border border-green-200 rounded bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 resize-none"
                                autoFocus
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => {
                                    updateObsMutation.mutate(
                                      { orderId: order.id, observacaoAprovacao: editingObsText.trim() },
                                      { onSuccess: () => { utils.salesOrders.getOrdersForGestor.invalidate(); setEditingObsOrderId(null); setEditingObsText(""); } }
                                    );
                                  }}
                                  disabled={updateObsMutation.isPending}
                                  className="px-2 py-1 bg-green-600 text-white text-[10px] font-medium rounded hover:bg-green-700 cursor-pointer"
                                >
                                  {updateObsMutation.isPending ? "Salvando..." : "Salvar"}
                                </button>
                                <button
                                  onClick={() => { setEditingObsOrderId(null); setEditingObsText(""); }}
                                  className="px-2 py-1 bg-slate-200 text-slate-600 text-[10px] font-medium rounded cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-1 mt-1">
                              {(order as any).observacaoAprovacao ? (
                                <p className="text-[11px] text-green-600 dark:text-green-300 italic flex-1">
                                  \u201c{(order as any).observacaoAprovacao}\u201d
                                </p>
                              ) : (
                                <p className="text-[10px] text-slate-400 italic flex-1">Sem observação</p>
                              )}
                              <button
                                onClick={() => { setEditingObsOrderId(order.id); setEditingObsText((order as any).observacaoAprovacao || ""); }}
                                className="text-[9px] text-green-600 hover:text-green-800 underline cursor-pointer whitespace-nowrap"
                              >
                                {(order as any).observacaoAprovacao ? "editar" : "+ obs"}
                              </button>
                            </div>
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

      {/* Delete Confirmation Modal */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Excluir Pedido</h3>
                <p className="text-xs text-slate-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteOrderMutation.mutate({ orderId: confirmDeleteId }, {
                    onSuccess: () => {
                      utils.salesOrders.listOrders.invalidate();
                      utils.salesOrders.getOrdersForGestor.invalidate();
                      setConfirmDeleteId(null);
                      setExpandedOrder(null);
                    }
                  });
                }}
                disabled={deleteOrderMutation.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-lg cursor-pointer"
              >
                {deleteOrderMutation.isPending ? "Apagando..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isInline) {
    return content;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <TopNav />
      <main className="container py-4 md:py-6 space-y-4 md:space-y-5 pb-20 md:pb-6">
        {content}
      </main>
    </div>
  );
}
