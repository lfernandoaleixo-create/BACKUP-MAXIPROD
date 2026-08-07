/**
 * Vitória Orders - Painel da operadora para processar pedidos aprovados
 * Fluxo de status: Pendente → Recebido → Lançado no Maxiprod
 */
import { useState, useMemo } from "react";
import TopNav from "@/components/TopNav";
import SecureInput from "@/components/SecureInput";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import { RealCostMarginBar } from "@/components/RealCostMarginBar";
import { ProductMarginBar } from "@/components/ProductMarginBar";
import {
  CheckCircle2, Package, User, MapPin, ArrowLeft,
  RefreshCw, ClipboardCheck, Clock, ChevronDown, ChevronUp, FileText,
  Inbox, CheckCheck, AlertCircle, Building2, Phone, Mail, Tag, CreditCard, Trash2,
  FileSpreadsheet, AlertTriangle, Download, UserPlus, CheckSquare, TrendingUp, TrendingDown, Calendar, Eye
  Gift,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? Number(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type VitoriaFilter = "pendente" | "aprovado" | "recusado" | "recebido" | "lancado" | "todos";

export default function VitoriaOrders() {
  const { operator, hasGranularAccess, getVisiblePeopleForFeature } = useOperator();
  const visibleSellersForOrders = getVisiblePeopleForFeature("gc.pedidosVenda");
  const [statusFilter, setStatusFilter] = useState<VitoriaFilter>("pendente");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const { data: orders, isLoading, refetch } = trpc.salesOrders.getOrdersForOperator.useQuery(
    { status: "todos", viewer: operator?.name || "" },
    { staleTime: 15 * 1000, refetchInterval: 30 * 1000 }
  );

  const { data: orderDetails } = trpc.salesOrders.getOrderDetails.useQuery(
    { orderId: expandedOrder! },
    { enabled: expandedOrder !== null }
  );

  // Margin data for gestores (Fernando, Guilherme, Bruno, Juvenal, Renato)
  const isGestor = ["Fernando", "Guilherme", "Bruno", "Juvenal", "Renato"].some(
    n => (operator?.name || "").toLowerCase().includes(n.toLowerCase())
  );
  const orderUf = orderDetails?.order?.uf || "MG";
  const orderTipoContrib = orderDetails?.order?.tipoContribuinte || "Contribuinte";
  const orderSellerId = orderDetails?.order?.sellerId;

  const productMarginsQuery = trpc.salesOrders.getProductMargins.useQuery(
    { ufDestino: orderUf, tipoContribuinte: orderTipoContrib },
    { enabled: isGestor && !!orderDetails, staleTime: 60 * 1000 }
  );

  const monthlyMarginInput = useMemo(() => ({
    sellerId: orderSellerId || 0,
  }), [orderSellerId]);
  const monthlyMarginQuery = trpc.salesOrders.getSellerMonthlyMargin.useQuery(
    monthlyMarginInput,
    { enabled: isGestor && !!orderSellerId && orderSellerId > 0, staleTime: 30 * 1000 }
  );
  const [showMonthlyDetails, setShowMonthlyDetails] = useState(false);

  const markRecebidoMutation = trpc.salesOrders.markRecebido.useMutation();
  const markLancadoMutation = trpc.salesOrders.markLancado.useMutation();
  const deleteOrderMutation = trpc.salesOrders.deleteOrder.useMutation();
  const approveOrderMutation = trpc.salesOrders.approveOrder.useMutation();
  const gestorApproveMutation = trpc.salesOrders.gestorApproveSubgestorOrder.useMutation();
  const exportMaxiprodMutation = trpc.salesOrders.exportClientMaxiprod.useMutation();
  const exportOrderMutation = trpc.salesOrders.exportOrderMaxiprod.useMutation();
  const exportBonifMutation = trpc.salesOrders.exportBonificacaoMaxiprod.useMutation();
  const utils = trpc.useUtils();
  const [approvingOrderId, setApprovingOrderId] = useState<number | null>(null);
  const [approvalObs, setApprovalObs] = useState("");
  const [approvalPassword, setApprovalPassword] = useState("");
  const [approvalPasswordError, setApprovalPasswordError] = useState("");
  // Juvenal gestor-final approval state
  const [gestorApprovingOrderId, setGestorApprovingOrderId] = useState<number | null>(null);
  const [gestorPassword, setGestorPassword] = useState("");
  const [gestorObs, setGestorObs] = useState("");
  const [gestorPasswordError, setGestorPasswordError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [exportingOrderId, setExportingOrderId] = useState<number | null>(null);
  const [exportingPedidoId, setExportingPedidoId] = useState<number | null>(null);

  // New clients registered without orders
  const { data: newClients, refetch: refetchClients } = trpc.salesOrders.getNewClientsForOperator.useQuery(
    undefined,
    { staleTime: 15 * 1000, refetchInterval: 30 * 1000 }
  );
  const exportVendorClientMutation = trpc.salesOrders.exportVendorClientMaxiprod.useMutation();
  const markExportedMutation = trpc.salesOrders.markClientExported.useMutation();
  const [exportingClientId, setExportingClientId] = useState<number | null>(null);

  // Get modification info for all visible orders
  const orderIds = useMemo(() => (orders || []).map((o: any) => o.id), [orders]);
  const { data: modificationInfo } = trpc.salesOrders.getClientModificationInfo.useQuery(
    { orderIds },
    { enabled: orderIds.length > 0, staleTime: 60 * 1000 }
  );

  // Helper to get modification info for a specific order
  const getModInfo = (orderId: number) => {
    if (!modificationInfo) return null;
    return modificationInfo.find((m: any) => m.orderId === orderId) || null;
  };

  // Handle Maxiprod CLIENT export download
  const handleExportMaxiprod = (orderId: number) => {
    setExportingOrderId(orderId);
    exportMaxiprodMutation.mutate(
      { orderId },
      {
        onSuccess: (data) => {
          const byteCharacters = atob(data.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = data.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success(`Planilha Cliente exportada: ${data.clientName}`);
          setExportingOrderId(null);
        },
        onError: (err) => {
          toast.error(err.message || "Erro ao exportar planilha de cliente");
          setExportingOrderId(null);
        },
      }
    );
  };

  // Handle Maxiprod ORDER export download
  const handleExportPedido = (orderId: number) => {
    setExportingPedidoId(orderId);
    exportOrderMutation.mutate(
      { orderId },
      {
        onSuccess: (data) => {
          const byteCharacters = atob(data.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = data.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success(`Planilha Pedido de Venda exportada!`);
          setExportingPedidoId(null);
        },
        onError: (err) => {
          toast.error(err.message || "Erro ao exportar pedido de venda");
          setExportingPedidoId(null);
        },
      }
    );
  const handleExportBonificacao = (orderId: number) => {
    exportBonifMutation.mutate(
      { orderId },
      {
        onSuccess: (data) => {
          const byteCharacters = atob(data.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = data.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success("Planilha Bonificação exportada!");
        },
        onError: (err: any) => {
          toast.error(err.message || "Erro ao exportar bonificação");
        },
      }
    );
  };
  };

  const handleDeleteOrder = (orderId: number) => {
    deleteOrderMutation.mutate(
      { orderId },
      {
        onSuccess: () => {
          toast.success("Pedido apagado com sucesso!");
          setConfirmDelete(null);
          setExpandedOrder(null);
          utils.salesOrders.getOrdersForOperator.invalidate();
          utils.salesOrders.countPendingVitoria.invalidate();
        },
      }
    );
  };

    const handleApproveOrder = (orderId: number) => {
    setApprovingOrderId(orderId);
    setApprovalObs("");
    setApprovalPassword("");
    setApprovalPasswordError("");
  };
  const confirmApproveOrder = () => {
    if (approvingOrderId === null) return;
    if (!approvalPassword.trim()) {
      setApprovalPasswordError("Digite sua senha para aprovar");
      return;
    }
    setApprovalPasswordError("");
    approveOrderMutation.mutate(
      { orderId: approvingOrderId, aprovadoPor: operator?.name || "Gestor", password: approvalPassword.trim(), observacaoAprovacao: approvalObs.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Pedido aprovado com sucesso!");
          utils.salesOrders.getOrdersForOperator.invalidate();
          setApprovingOrderId(null);
          setApprovalObs("");
          setApprovalPassword("");
          setApprovalPasswordError("");
        },
        onError: (err) => {
          if (err.message.includes("Senha incorreta")) {
            setApprovalPasswordError("Senha incorreta. Use seu primeiro nome com inicial mai\u00fascula.");
          } else {
            toast.error(err.message || "Erro ao aprovar pedido");
          }
        },
      }
    );
  };

  // Juvenal gestor-final approval
  const confirmGestorApprove = () => {
    if (gestorApprovingOrderId === null || !gestorPassword.trim()) return;
    setGestorPasswordError("");
    gestorApproveMutation.mutate(
      { orderId: gestorApprovingOrderId, password: gestorPassword.trim(), observacaoGestor: gestorObs.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Pedido aprovado pelo gestor com sucesso!");
          utils.salesOrders.getOrdersForOperator.invalidate();
          utils.salesOrders.getOrdersPendingGestorApproval.invalidate();
          setGestorApprovingOrderId(null);
          setGestorPassword("");
          setGestorObs("");
          setGestorPasswordError("");
        },
        onError: (err) => {
          if (err.message.includes("Senha incorreta")) {
            setGestorPasswordError("Senha incorreta.");
          } else {
            toast.error(err.message || "Erro ao aprovar pedido");
          }
        },
      }
    );
  };

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
      { orderId, operadorNome: operator?.name || "Vitória" },
      {
        onSuccess: () => {
          toast.success("Pedido marcado como lançado no Maxiprod!");
          utils.salesOrders.getOrdersForOperator.invalidate();
          utils.salesOrders.countPendingVitoria.invalidate();
        },
      }
    );
  };

  // Determine viewer role
  const isGuilhermeViewer = operator?.name === "Guilherme";
  const isFernandoViewer = (operator?.name || "").toLowerCase().includes("fernando");
  const isBrunoViewer = (operator?.name || "").toLowerCase().includes("bruno");
  const isJuvenalViewer = operator?.name === "Juvenal";
  const isVitoriaViewer = operator?.name === "Vitoria" || operator?.name === "Vitória";
  const canSeeAguardandoAprovacao = isGuilhermeViewer || isFernandoViewer || isBrunoViewer;

  // Filter orders based on status flow
  // "Novos" tab: for Guilherme/Fernando/Bruno includes 'pendente', 'aprovado_subgestor' AND 'aprovado' not yet received
  // For Juvenal: same as Vitória (only 'aprovado' not received) - his approvals happen in "Aprovações de Pedidos"
  // For Vitória: only 'aprovado' not yet received
  // NOTE: For top gestores (Fernando/Guilherme/Bruno/Juvenal), apply gc.pedidosVenda sub-permission filter.
  const isTopGestorFilter = canSeeAguardandoAprovacao || isJuvenalViewer;
  const filteredOrders = (orders || []).filter((o: any) => {
    // Sub-permission filter: only for top gestores (who see ALL statuses and need filtering)
    if (isTopGestorFilter) {
      if (visibleSellersForOrders.length === 0) return false;
      const sellerSlug = (o.sellerName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      if (!visibleSellersForOrders.includes(sellerSlug)) return false;
    }
    if (statusFilter === "todos") return true;
    if (statusFilter === "pendente") {
      if (canSeeAguardandoAprovacao) {
        return (o.status === "pendente" || o.status === "aprovado_subgestor");
      }
      return o.status === "pendente" || o.status === "aprovado_subgestor";
    }
    if (statusFilter === "aprovado") {
      // Aprovados que ainda não foram lançados
      return o.status === "aprovado" && !o.vitoriaLancado;
    }
    if (statusFilter === "recusado") return o.status === "rejeitado";
    if (statusFilter === "recebido") return o.vitoriaRecebido && !o.vitoriaLancado;
    if (statusFilter === "lancado") return o.vitoriaLancado;
    return true;
  });

  const pendingCount = (orders || []).filter((o: any) => o.status === "pendente" || o.status === "aprovado_subgestor").length;
  const aprovadoCount = (orders || []).filter((o: any) => o.status === "aprovado" && !o.vitoriaLancado).length;
  const recusadoCount = (orders || []).filter((o: any) => o.status === "rejeitado").length;
  const recebidoCount = (orders || []).filter((o: any) => o.vitoriaRecebido && !o.vitoriaLancado).length;
  const lancadoCount = (orders || []).filter((o: any) => o.vitoriaLancado).length;

  // Calculate order margin for each order (for collapsed card bars)
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

  // Group filtered orders by seller for Fernando/Guilherme/Bruno/Juvenal view
  const isTopGestor = isFernandoViewer || isGuilhermeViewer || isBrunoViewer || isJuvenalViewer;
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);

  const sellerGroups = useMemo(() => {
    if (!isTopGestor) return [];
    const groups: { sellerName: string; sellerId: number; orders: any[] }[] = [];
    const map = new Map<string, { sellerId: number; orders: any[] }>();
    for (const order of filteredOrders as any[]) {
      const name = order.sellerName || 'Sem vendedor';
      if (!map.has(name)) {
        map.set(name, { sellerId: order.sellerId, orders: [] });
      }
      map.get(name)!.orders.push(order);
    }
    Array.from(map.entries()).forEach(([sellerName, data]) => {
      groups.push({ sellerName, sellerId: data.sellerId, orders: data.orders });
    });
    return groups;
  }, [filteredOrders, isTopGestor]);

  // For isTopGestor: use the expanded seller's ID for monthly margin query
  const expandedSellerIdForMonthly = useMemo(() => {
    if (expandedSeller) {
      const group = sellerGroups.find(g => g.sellerName === expandedSeller);
      return group?.sellerId || 0;
    }
    return orderSellerId || 0;
  }, [expandedSeller, sellerGroups, orderSellerId]);

  // Override monthly margin query for seller-grouped view
  const sellerMonthlyInput = useMemo(() => ({
    sellerId: expandedSellerIdForMonthly,
  }), [expandedSellerIdForMonthly]);
  const sellerMonthlyQuery = trpc.salesOrders.getSellerMonthlyMargin.useQuery(
    sellerMonthlyInput,
    { enabled: isTopGestor && expandedSellerIdForMonthly > 0, staleTime: 30 * 1000 }
  );
  const sellerDiscountQuery = trpc.salesOrders.getSellerMonthlyDiscount.useQuery(
    sellerMonthlyInput,
    { enabled: isTopGestor && expandedSellerIdForMonthly > 0, staleTime: 30 * 1000 }
  );

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

        {/* Stats - 5 cards showing the flow */}
        <div className="grid grid-cols-5 gap-2">
          <div className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm p-3 cursor-pointer transition-all ${
            statusFilter === "pendente" ? "border-amber-400 ring-2 ring-amber-200" : "border-amber-200 dark:border-amber-800"
          }`} onClick={() => setStatusFilter("pendente")}>
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[8px] text-amber-600 uppercase font-bold">Pendentes</span>
            </div>
            <p className={`text-xl font-bold ${pendingCount > 0 ? "text-amber-600" : "text-slate-300"}`}>{pendingCount}</p>
          </div>
          <div className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm p-3 cursor-pointer transition-all relative ${
            statusFilter === "aprovado" ? "border-teal-400 ring-2 ring-teal-200" : "border-teal-200 dark:border-teal-800"
          }`} onClick={() => setStatusFilter("aprovado")}>
            {aprovadoCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-teal-500 rounded-full animate-ping" />
            )}
            {aprovadoCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-teal-500 rounded-full" />
            )}
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
              <span className="text-[8px] text-teal-600 uppercase font-bold">Aprovados</span>
            </div>
            <p className={`text-xl font-bold ${aprovadoCount > 0 ? "text-teal-600" : "text-slate-300"}`}>{aprovadoCount}</p>
          </div>
          <div className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm p-3 cursor-pointer transition-all ${
            statusFilter === "recusado" ? "border-red-400 ring-2 ring-red-200" : "border-red-200 dark:border-red-800"
          }`} onClick={() => setStatusFilter("recusado")}>
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[8px] text-red-600 uppercase font-bold">Recusados</span>
            </div>
            <p className={`text-xl font-bold ${recusadoCount > 0 ? "text-red-600" : "text-slate-300"}`}>{recusadoCount}</p>
          </div>
          <div className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm p-3 cursor-pointer transition-all ${
            statusFilter === "recebido" ? "border-blue-400 ring-2 ring-blue-200" : "border-blue-200 dark:border-blue-800"
          }`} onClick={() => setStatusFilter("recebido")}>
            <div className="flex items-center gap-1.5 mb-1">
              <Inbox className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[8px] text-blue-600 uppercase font-bold">Recebidos</span>
            </div>
            <p className={`text-xl font-bold ${recebidoCount > 0 ? "text-blue-600" : "text-slate-300"}`}>{recebidoCount}</p>
          </div>
          <div className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm p-3 cursor-pointer transition-all ${
            statusFilter === "lancado" ? "border-green-400 ring-2 ring-green-200" : "border-green-200 dark:border-green-800"
          }`} onClick={() => setStatusFilter("lancado")}>
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCheck className="w-3.5 h-3.5 text-green-500" />
              <span className="text-[8px] text-green-600 uppercase font-bold">Lançados</span>
            </div>
            <p className={`text-xl font-bold ${lancadoCount > 0 ? "text-green-600" : "text-slate-300"}`}>{lancadoCount}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-1.5 flex-wrap">
          {([
            { key: "pendente", label: "Pendentes", icon: Clock, color: "amber" },
            { key: "aprovado", label: "Aprovados", icon: CheckCircle2, color: "teal" },
            { key: "recusado", label: "Recusados", icon: AlertTriangle, color: "red" },
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
              {statusFilter === "pendente" ? "Nenhum pedido pendente de aprovação" :
               statusFilter === "aprovado" ? "Nenhum pedido aprovado aguardando lançamento" :
               statusFilter === "recusado" ? "Nenhum pedido recusado" :
               statusFilter === "recebido" ? "Nenhum pedido recebido pendente de lançamento" :
               statusFilter === "lancado" ? "Nenhum pedido lançado ainda" :
               "Nenhum pedido encontrado"}
            </p>
          </div>
        ) : isTopGestor ? (
          /* ===== SELLER-GROUPED VIEW for Fernando/Guilherme/Bruno ===== */
          <div className="space-y-4">
            {sellerGroups.map((group) => {
              const isSellerExpanded = expandedSeller === group.sellerName;
              return (
                <div key={group.sellerName} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  {/* Seller Header */}
                  <button
                    onClick={() => setExpandedSeller(isSellerExpanded ? null : group.sellerName)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                        <User className="w-4.5 h-4.5 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{group.sellerName}</p>
                        <p className="text-[10px] text-slate-500">{group.orders.length} pedido{group.orders.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(group.orders.reduce((s: number, o: any) => s + (Number(o.totalPedido) || 0), 0))}
                      </p>
                      {isSellerExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {/* Seller Expanded Content */}
                  {isSellerExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                      {/* Monthly Discount-Based Commission Bar (comparativo) */}
                      {sellerDiscountQuery.data && sellerDiscountQuery.data.sellerId === group.sellerId && sellerDiscountQuery.data.avgDiscount !== null && (() => {
                        const dd = sellerDiscountQuery.data;
                        const avgDisc = dd.avgDiscount!;
                        const dColor = avgDisc < 20 ? { text: 'text-blue-700', label: 'Comissão Alta' } : avgDisc <= 23 ? { text: 'text-green-700', label: 'Comissão Média-Alta' } : avgDisc <= 27 ? { text: 'text-yellow-700', label: 'Comissão Média' } : avgDisc <= 32 ? { text: 'text-orange-700', label: 'Comissão Baixa' } : { text: 'text-red-700', label: 'Crítico' };
                        const barMin = 0, barMax = 40;
                        const clamped = Math.max(barMin, Math.min(barMax, avgDisc));
                        const pos = 100 - (((clamped - barMin) / (barMax - barMin)) * 100);
                        return (
                          <div className="mt-3 bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <TrendingDown className="w-3.5 h-3.5 text-purple-600" />
                                <span className="text-[10px] font-bold text-purple-700 uppercase">Comissão por Desconto Médio — {group.sellerName}</span>
                              </div>
                              <span className={`text-sm font-black tabular-nums ${dColor.text}`}>
                                {avgDisc.toFixed(1)}% desc. ({dColor.label})
                              </span>
                            </div>
                            <div className="relative w-full">
                              <div className="relative h-6 rounded-full overflow-visible border-2 border-slate-300 shadow-sm">
                                <div className="absolute inset-0 rounded-full overflow-hidden flex">
                                  <div className="h-full bg-red-500" style={{ width: "20%" }} />
                                  <div className="h-full bg-orange-500" style={{ width: "12.5%" }} />
                                  <div className="h-full bg-yellow-400" style={{ width: "10%" }} />
                                  <div className="h-full bg-green-500" style={{ width: "7.5%" }} />
                                  <div className="h-full bg-blue-500" style={{ width: "50%" }} />
                                </div>
                                <div className="absolute top-0 bottom-0 w-[2px] bg-white/90" style={{ left: "20%" }} />
                                <div className="absolute top-0 bottom-0 w-[2px] bg-white/90" style={{ left: "32.5%" }} />
                                <div className="absolute top-0 bottom-0 w-[2px] bg-white/90" style={{ left: "42.5%" }} />
                                <div className="absolute top-0 bottom-0 w-[2px] bg-white/90" style={{ left: "50%" }} />
                                <div className="absolute flex flex-col items-center" style={{ left: `${pos}%`, transform: "translateX(-50%)", top: "-6px", bottom: "-2px" }}>
                                  <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-slate-900" />
                                  <div className="w-[2px] flex-1 bg-slate-900 rounded-full" />
                                </div>
                              </div>
                              <div className="relative w-full h-3 mt-0.5">
                                <span className="absolute text-[8px] font-bold text-purple-400" style={{ left: "20%", transform: "translateX(-50%)" }}>32%</span>
                                <span className="absolute text-[8px] font-bold text-purple-400" style={{ left: "32.5%", transform: "translateX(-50%)" }}>27%</span>
                                <span className="absolute text-[8px] font-bold text-purple-400" style={{ left: "42.5%", transform: "translateX(-50%)" }}>23%</span>
                                <span className="absolute text-[8px] font-bold text-purple-400" style={{ left: "50%", transform: "translateX(-50%)" }}>20%</span>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[10px]">
                              <span className="text-slate-500">{dd.totalOrders} pedido{dd.totalOrders !== 1 ? 's' : ''} analisados</span>
                              {dd.discountComissao && (
                                <span className="font-bold text-purple-600">Comissão: {dd.discountComissao}%</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Monthly Margin Bar */}
                      {sellerMonthlyQuery.data && sellerMonthlyQuery.data.sellerId === group.sellerId && (() => {
                        const md = sellerMonthlyQuery.data;
                        const margin = md.currentMonthlyMargin ?? 0;
                        if (md.totalOrders === 0) return null;
                        const mColor = margin >= 29 ? { text: 'text-blue-700', label: 'Comissão Alta' } : margin >= 25 ? { text: 'text-green-700', label: 'Comissão Média-Alta' } : margin >= 20 ? { text: 'text-yellow-700', label: 'Comissão Média' } : margin >= 15 ? { text: 'text-orange-700', label: 'Comissão Baixa' } : { text: 'text-red-700', label: 'Crítico' };
                        const barMin = -5, barMax = 40;
                        const clamped = Math.max(barMin, Math.min(barMax, margin));
                        const pos = ((clamped - barMin) / (barMax - barMin)) * 100;
                        return (
                          <div className="mt-3 bg-indigo-50 border-2 border-indigo-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="text-[10px] font-bold text-indigo-700 uppercase">Reputação do Mês — {group.sellerName} ({md.month})</span>
                              </div>
                              <span className={`text-sm font-black tabular-nums ${mColor.text}`}>
                                {margin.toFixed(1)}% ({mColor.label})
                              </span>
                            </div>
                            <div className="relative w-full">
                              <div className="relative h-6 rounded-full overflow-visible border-2 border-slate-300 shadow-sm">
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
                                <div className="absolute flex flex-col items-center" style={{ left: `${pos}%`, transform: "translateX(-50%)", top: "-6px", bottom: "-2px" }}>
                                  <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-slate-900" />
                                  <div className="w-[2px] flex-1 bg-slate-900 rounded-full" />
                                </div>
                              </div>
                              <div className="relative w-full h-3 mt-0.5">
                                <span className="absolute text-[8px] font-bold text-indigo-400" style={{ left: "44.4%", transform: "translateX(-50%)" }}>15%</span>
                                <span className="absolute text-[8px] font-bold text-indigo-400" style={{ left: "55.5%", transform: "translateX(-50%)" }}>20%</span>
                                <span className="absolute text-[8px] font-bold text-indigo-400" style={{ left: "66.6%", transform: "translateX(-50%)" }}>25%</span>
                                <span className="absolute text-[8px] font-bold text-indigo-400" style={{ left: "75.5%", transform: "translateX(-50%)" }}>29%</span>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[10px]">
                              <span className="text-slate-500">{md.totalOrders} pedido{md.totalOrders !== 1 ? 's' : ''} no mês</span>
                              {md.monthlyComissaoPercentual > 0 && (
                                <span className="font-bold text-emerald-600">Comissão: {md.monthlyComissaoPercentual}%</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Orders for this seller */}
                      <div className="space-y-3 mt-3">
                        {group.orders.map((order: any) => {
                          const isExpanded = expandedOrder === order.id;
                          const isLancado = order.vitoriaLancado;
                          const isRecebido = order.vitoriaRecebido && !order.vitoriaLancado;
                          const isPendente = order.status === "pendente";
                          const isAwaitingGestor = order.status === "aprovado_subgestor";
                          const isAprovado = order.status === "aprovado" && !order.vitoriaLancado;
                          const isRecusado = order.status === "rejeitado";
                          const borderClass = isLancado
                            ? "border-green-200 dark:border-green-800 border-l-4 border-l-green-500"
                            : isRecusado
                              ? "border-red-200 dark:border-red-800 border-l-4 border-l-red-500"
                            : isRecebido
                              ? "border-blue-200 dark:border-blue-800 border-l-4 border-l-blue-400"
                              : isAprovado
                                ? "border-teal-200 dark:border-teal-800 border-l-4 border-l-teal-500"
                              : (isPendente || isAwaitingGestor)
                                ? "border-orange-200 dark:border-orange-800 border-l-4 border-l-orange-500"
                                : "border-amber-200 dark:border-amber-800 border-l-4 border-l-amber-500";
                          const orderMargin = orderMarginsMap.get(order.id);

                          return (
                            <div key={order.id} className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden ${borderClass}`}>
                              {/* Order Header */}
                              <div
                                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                className="w-full px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left cursor-pointer"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    isLancado ? "bg-green-100 dark:bg-green-900/30" :
                                    isRecusado ? "bg-red-100 dark:bg-red-900/30" :
                                    isRecebido ? "bg-blue-100 dark:bg-blue-900/30" :
                                    isAprovado ? "bg-teal-100 dark:bg-teal-900/30" :
                                    (isPendente || isAwaitingGestor) ? "bg-orange-100 dark:bg-orange-900/30" :
                                    "bg-amber-100 dark:bg-amber-900/30"
                                  }`}>
                                    {isLancado ? <CheckCheck className="w-4.5 h-4.5 text-green-600" /> :
                                     isRecusado ? <AlertTriangle className="w-4.5 h-4.5 text-red-600" /> :
                                     isRecebido ? <Inbox className="w-4.5 h-4.5 text-blue-600" /> :
                                     isAprovado ? <CheckCircle2 className="w-4.5 h-4.5 text-teal-600" /> :
                                     (isPendente || isAwaitingGestor) ? <Clock className="w-4.5 h-4.5 text-orange-600" /> :
                                     <AlertCircle className="w-4.5 h-4.5 text-amber-600" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[10px] font-bold text-slate-400">#{String(order.orderNumber || order.id).padStart(2, '0')}</span>
                                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{order.razaoSocial || order.nomeFantasia}</p>
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                        isLancado ? "bg-green-50 text-green-600" :
                                        isRecusado ? "bg-red-50 text-red-600" :
                                        isRecebido ? "bg-blue-50 text-blue-600" :
                                        isAprovado ? "bg-teal-50 text-teal-600" :
                                        (isPendente || isAwaitingGestor) ? "bg-orange-50 text-orange-700" :
                                        "bg-amber-50 text-amber-700"
                                      }`}>
                                        {isLancado ? "LANÇADO" : isRecusado ? "RECUSADO" : isRecebido ? "RECEBIDO" : isAprovado ? "APROVADO" : isAwaitingGestor ? "AGUARDANDO GESTOR" : isPendente ? "AGUARDANDO APROVAÇÃO" : "NOVO"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                                      {order.municipio && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{order.municipio}/{order.uf}</span>}
                                      <span>{order.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-BR") : ""}</span>
                                      {(order.formaPagamento || order.formaCobranca || order.condicaoPagamento) && (
                                        <span className="flex items-center gap-1 text-[9px] font-semibold text-violet-600 dark:text-violet-400">
                                          <CreditCard className="w-2.5 h-2.5" />
                                          {order.formaPagamento || ""}
                                          {order.formaCobranca && order.formaPagamento !== order.formaCobranca ? ` (${order.formaCobranca})` : ""}
                                          {order.condicaoPagamento ? ` ${order.condicaoPagamento}` : ""}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0 flex items-center gap-2">
                                    <p className="text-sm font-bold text-green-700 dark:text-green-400">{formatCurrency(order.totalPedido)}</p>
                                    {/* Mini order margin bar */}
                                    {orderMargin !== undefined && (() => {
                                      const barMin = -5, barMax = 40;
                                      const clamped = Math.max(barMin, Math.min(barMax, orderMargin));
                                      const pos = ((clamped - barMin) / (barMax - barMin)) * 100;
                                      const mc = getMarginColor(orderMargin);
                                      return (
                                        <div className="flex items-center gap-1.5">
                                          <div className="relative w-24 h-4 rounded-full overflow-visible border border-slate-300">
                                            <div className="absolute inset-0 rounded-full overflow-hidden flex">
                                              <div className="h-full bg-red-500" style={{ width: "44.4%" }} />
                                              <div className="h-full bg-orange-500" style={{ width: "11.1%" }} />
                                              <div className="h-full bg-yellow-400" style={{ width: "11.1%" }} />
                                              <div className="h-full bg-green-500" style={{ width: "8.9%" }} />
                                              <div className="h-full bg-blue-500" style={{ width: "24.5%" }} />
                                            </div>
                                            <div className="absolute flex flex-col items-center" style={{ left: `${pos}%`, transform: "translateX(-50%)", top: "-3px", bottom: "-1px" }}>
                                              <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[5px] border-t-slate-900" />
                                              <div className="w-[2px] flex-1 bg-slate-900 rounded-full" />
                                            </div>
                                          </div>
                                          <span className={`text-[9px] font-bold ${mc.text}`}>{orderMargin.toFixed(1)}%</span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                </div>
                              </div>

                              {/* Expanded Details - reuse existing expanded content */}
                              {isExpanded && orderDetails && orderDetails.order.id === order.id && (
                                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                                  {/* Items with ProductMarginBar */}
                                  <div className="mt-3 space-y-1.5">
                                    <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                      <Package className="w-3.5 h-3.5" />
                                      Itens do Pedido ({orderDetails.items.length})
                                    </p>
                                    {orderDetails.items.map((item: any) => {
                                      const precoMostrado = orderDetails.priceTableMap?.[item.codigoItem];
                                      const precoVenda = Number(item.precoUnitario);
                                      const descontoDado = precoMostrado && precoMostrado > 0 ? ((precoMostrado - precoVenda) / precoMostrado) * 100 : null;
                                      return (
                                        <div key={item.id} className="space-y-1">
                                          <div className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${
                                            item.abaixoDoMinimo ? "bg-amber-50 border border-amber-200" : "bg-slate-50"
                                          }`}>
                                            <div className="min-w-0 flex-1">
                                              <p className="text-sm font-semibold text-slate-700 truncate">{item.codigoItem} - {item.descricaoItem}</p>
                                              <span className="text-xs text-slate-400">{Number(item.quantidade).toFixed(0)} {item.unidadeMedida || "CX"} × {formatCurrency(precoVenda)}</span>
                                            </div>
                                            <p className="text-sm font-bold text-slate-700 ml-2">{formatCurrency(Number(item.totalItem))}</p>
                                          </div>
                                          {descontoDado !== null && hasGranularAccess("gc.barraProduto") && (
                                            <div className="pl-3">
                                              <ProductMarginBar desconto={descontoDado} showValues={false} />
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Approve button for pending */}
                                  {isPendente && (
                                    <div className="mt-4">
                                      {approvingOrderId === order.id ? (
                                        <div className="space-y-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                          <label className="text-xs font-bold text-green-700 block">Senha de aprovação (obrigatória):</label>
                                          <SecureInput
                                            value={approvalPassword}
                                            onChange={(v) => { setApprovalPassword(v); setApprovalPasswordError(""); }}
                                            placeholder="Digite sua senha (primeiro nome)"
                                            className="w-full px-3 py-2 text-xs border border-green-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30"
                                          />
                                          {approvalPasswordError && (
                                            <p className="text-xs text-red-500 font-medium">{approvalPasswordError}</p>
                                          )}
                                          <label className="text-xs font-bold text-green-700 block">Observação de aprovação (opcional):</label>
                                          <textarea
                                            value={approvalObs}
                                            onChange={(e) => setApprovalObs(e.target.value)}
                                            placeholder="Justifique a aprovação e/ou o preço praticado..."
                                            rows={2}
                                            className="w-full px-3 py-2 text-xs border border-green-200 rounded-lg bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 resize-none"
                                          />
                                          <div className="flex gap-2">
                                            <button
                                              onClick={confirmApproveOrder}
                                              disabled={approveOrderMutation.isPending}
                                              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                            >
                                              {approveOrderMutation.isPending ? "Aprovando..." : "Confirmar Autorização"}
                                            </button>
                                            <button
                                              onClick={() => { setApprovingOrderId(null); setApprovalObs(""); }}
                                              className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-medium cursor-pointer"
                                            >
                                              Cancelar
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => handleApproveOrder(order.id)}
                                          disabled={approveOrderMutation.isPending}
                                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                                        >
                                          <CheckCircle2 className="w-4 h-4" />
                                          Aprovar Pedido
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  {/* GESTOR INFO - Approval moved to dedicated Aprovações page */}
                                  {isAwaitingGestor && (
                                    <div className="mt-4">
                                      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                                        <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">
                                          <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                                          Aguardando aprovação do gestor Juvenal
                                        </p>
                                        <p className="text-[10px] text-orange-600 dark:text-orange-300 mt-1">
                                          Aprovado pelo subgestor: {order.aprovadoPor}{order.dataAprovacao && ` em ${new Date(order.dataAprovacao).toLocaleDateString("pt-BR")}`}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {(filteredOrders as any[]).map((order) => {
              const isExpanded = expandedOrder === order.id;
              const isLancado = order.vitoriaLancado;
              const isRecebido = order.vitoriaRecebido && !order.vitoriaLancado;
              const isPendente = order.status === "pendente";
              const isAwaitingGestor = order.status === "aprovado_subgestor";
              const isAprovado = order.status === "aprovado" && !order.vitoriaLancado;
              const isRecusado = order.status === "rejeitado";
              const isNovo = order.status === "aprovado" && !order.vitoriaRecebido;
              const borderClass = isLancado
                ? "border-green-200 dark:border-green-800 border-l-4 border-l-green-500"
                : isRecusado
                  ? "border-red-200 dark:border-red-800 border-l-4 border-l-red-500"
                : isRecebido
                  ? "border-blue-200 dark:border-blue-800 border-l-4 border-l-blue-400"
                  : isAprovado
                    ? "border-teal-200 dark:border-teal-800 border-l-4 border-l-teal-500"
                  : (isPendente || isAwaitingGestor)
                    ? "border-orange-200 dark:border-orange-800 border-l-4 border-l-orange-500"
                    : "border-amber-200 dark:border-amber-800 border-l-4 border-l-amber-500";

              return (
                <div
                  key={order.id}
                  className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden ${borderClass}`}
                >
                  {/* Order Header */}
                  <div
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left cursor-pointer"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isLancado ? "bg-green-100 dark:bg-green-900/30" :
                      isRecebido ? "bg-blue-100 dark:bg-blue-900/30" :
                      (isPendente || isAwaitingGestor) ? "bg-orange-100 dark:bg-orange-900/30" :
                      "bg-amber-100 dark:bg-amber-900/30"
                    }`}>
                      {isLancado ? (
                        <CheckCheck className="w-4.5 h-4.5 text-green-600" />
                      ) : isRecebido ? (
                        <Inbox className="w-4.5 h-4.5 text-blue-600" />
                      ) : isPendente ? (
                        <Clock className="w-4.5 h-4.5 text-orange-600" />
                      ) : (
                        <AlertCircle className="w-4.5 h-4.5 text-amber-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400">#{String(order.orderNumber || order.id).padStart(2, '0')}</span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {order.razaoSocial || order.nomeFantasia}
                        </p>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isLancado ? "bg-green-50 text-green-600" :
                          isRecebido ? "bg-blue-50 text-blue-600" :
                          (isPendente || isAwaitingGestor) ? "bg-orange-50 text-orange-700" :
                          "bg-amber-50 text-amber-700"
                        }`}>
                          {isLancado ? "LANÇADO" : isRecebido ? "RECEBIDO" : isAwaitingGestor ? "AGUARDANDO GESTOR" : isPendente ? "AGUARDANDO APROVAÇÃO" : "NOVO"}
                        </span>
                        {order.temPrecoAbaixoMinimo && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-100 text-red-700">
                            Preço abaixo do mín.
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500 flex-wrap">
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
                        {(order.formaPagamento || order.formaCobranca || order.condicaoPagamento) && (
                          <span className="flex items-center gap-1 text-[9px] font-semibold text-violet-600 dark:text-violet-400">
                            <CreditCard className="w-2.5 h-2.5" />
                            {order.formaPagamento || ""}
                            {order.formaCobranca && order.formaPagamento !== order.formaCobranca ? ` (${order.formaCobranca})` : ""}
                            {order.condicaoPagamento ? ` ${order.condicaoPagamento}` : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <p className="text-sm font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(order.totalPedido)}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(order.id); }}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                        title="Excluir pedido"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                      {/* Status Progress Bar */}
                      <div className="mt-3 mb-4">
                        <div className="flex items-center gap-1">
                          <div className={`flex-1 h-2 rounded-full ${isPendente || isNovo || isRecebido || isLancado ? (isPendente ? "bg-orange-400" : "bg-orange-400") : "bg-slate-200"}`} />
                          <div className={`flex-1 h-2 rounded-full ${isNovo || isRecebido || isLancado ? "bg-amber-400" : "bg-slate-200"}`} />
                          <div className={`flex-1 h-2 rounded-full ${isRecebido || isLancado ? "bg-blue-400" : "bg-slate-200"}`} />
                          <div className={`flex-1 h-2 rounded-full ${isLancado ? "bg-green-400" : "bg-slate-200"}`} />
                        </div>
                        <div className="flex justify-between mt-1 text-[9px] text-slate-400 font-medium">
                          <span className={isPendente || isNovo || isRecebido || isLancado ? "text-orange-600" : ""}>Pendente</span>
                          <span className={isNovo || isRecebido || isLancado ? "text-amber-600" : ""}>Aprovado</span>
                          <span className={isRecebido || isLancado ? "text-blue-600" : ""}>Recebido</span>
                          <span className={isLancado ? "text-green-600" : ""}>Lançado</span>
                        </div>
                      </div>

                      {/* Approval observation */}
                      {order.status !== "pendente" && (order as any).observacaoAprovacao && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <p className="text-[10px] text-green-700 dark:text-green-400 font-medium">
                            Obs. aprovação ({(order as any).aprovadoPor || "Gestor"}):
                          </p>
                          <p className="text-[11px] text-green-600 dark:text-green-300 italic mt-0.5">
                            “{(order as any).observacaoAprovacao}”
                          </p>
                        </div>
                      )}

                      {/* Order Items */}
                      {orderDetails && orderDetails.order.id === order.id && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            Itens do Pedido ({orderDetails.items.length})
                          </p>
                          {orderDetails.items.map((item) => {
                            const precoMostrado = orderDetails.priceTableMap?.[item.codigoItem];
                            const precoVenda = Number(item.precoUnitario);
                            const descontoDado = precoMostrado && precoMostrado > 0 ? ((precoMostrado - precoVenda) / precoMostrado) * 100 : null;
                            return (
                              <div key={item.id} className="space-y-1">
                                <div className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${
                                  item.abaixoDoMinimo
                                    ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                                    : "bg-slate-50 dark:bg-slate-700/50"
                                }`}>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                                      {item.codigoItem} - {item.descricaoItem}
                                    </p>
                                    <span className="text-xs text-slate-400">
                                      {Number(item.quantidade).toFixed(0)} {item.unidadeMedida || "CX"} × {formatCurrency(precoVenda)}
                                    </span>
                                  </div>
                                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-2">
                                    {formatCurrency(Number(item.totalItem))}
                                  </p>
                                </div>
                                {descontoDado !== null && hasGranularAccess("gc.barraProduto") && (
                                  <div className="pl-3">
                                    <ProductMarginBar desconto={descontoDado} showValues={false} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Client Info - Full Data */}
                      <div className="mt-4 space-y-3">
                        {/* Modification Banner + Export Button */}
                        {(() => {
                          const modInfo = getModInfo(order.id);
                          return (
                            <div className="flex flex-col gap-2">
                              {/* Modification warning banner */}
                              {modInfo?.modified && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                  <p className="text-[11px] text-amber-800 dark:text-amber-200 font-medium">
                                    Dados do cliente <strong>{modInfo.clientName || order.razaoSocial}</strong> foram modificados
                                    {modInfo.modifiedBy ? ` por ${modInfo.modifiedBy}` : " por um vendedor"}
                                  </p>
                                </div>
                              )}
                              {/* Exportar Maxiprod buttons */}
                              <div className="flex flex-wrap gap-2">
                                {/* Exportar Cliente */}
                                {modInfo?.hasVendorClient && (
                                  <button
                                    onClick={() => handleExportMaxiprod(order.id)}
                                    disabled={exportingOrderId === order.id}
                                    className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    {exportingOrderId === order.id ? (
                                      <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
                                    ) : (
                                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                    )}
                                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                      {exportingOrderId === order.id ? "Gerando..." : "Exportar Cliente"}
                                    </span>
                                    <span className="text-[9px] text-emerald-500 dark:text-emerald-400">
                                      (Planilha Empresas .xlsx)
                                    </span>
                                  </button>
                                )}
                                {/* Exportar Pedido de Venda */}
                                <button
                                  onClick={() => handleExportPedido(order.id)}
                                  disabled={exportingPedidoId === order.id}
                                  className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {exportingPedidoId === order.id ? (
                                    <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                                  ) : (
                                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                                  )}
                                  <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                                    {exportingPedidoId === order.id ? "Gerando..." : "Exportar Pedido"}
                                  </span>
                                  <span className="text-[9px] text-blue-500 dark:text-blue-400">
                                    (Pedido de Venda .xlsx)
                                  </span>
                                </button>
                              </div>
                                {/* Exportar Bonificação (se houver) */}
                                {(order as any).bonificacaoItems && JSON.parse((order as any).bonificacaoItems || "[]").length > 0 && (
                                <button
                                  onClick={() => {
                                    handleExportBonificacao(order.id);
                                  }}
                                  className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                                >
                                  <Gift className="w-4 h-4 text-amber-600" />
                                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Exportar Bonificação</span>
                                  <span className="text-[9px] text-amber-500 dark:text-amber-400">(Pedido Bonif. .xlsx)</span>
                                </button>
                                )}
                            </div>
                          );
                        })()}

                        {/* Section: Dados do Cliente */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-2">
                            <Building2 className="w-3.5 h-3.5" />
                            Dados do Cliente
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                            {order.razaoSocial && (
                              <div className="col-span-2 md:col-span-3">
                                <span className="text-slate-400 font-semibold text-[11px]">Razão Social</span>
                                <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm">{order.razaoSocial}</p>
                              </div>
                            )}
                            {order.nomeFantasia && (
                              <div className="col-span-2 md:col-span-2">
                                <span className="text-slate-400 font-semibold text-[11px]">Nome Fantasia</span>
                                <p className="text-slate-800 dark:text-slate-100 text-sm">{order.nomeFantasia}</p>
                              </div>
                            )}
                            {order.cnpjCpf && (
                              <div>
                                <span className="text-slate-400 font-semibold text-[11px]">CNPJ/CPF</span>
                                <p className="text-slate-800 dark:text-slate-100 font-mono text-xs">{order.cnpjCpf}</p>
                              </div>
                            )}

                            {order.regimeTributario && (
                              <div>
                                <span className="text-slate-400 font-semibold text-[11px]">Regime Tributário</span>
                                <p className="text-slate-800 dark:text-slate-100 text-sm">{order.regimeTributario}</p>
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
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-2">
                              <MapPin className="w-3.5 h-3.5" />
                              Endereço
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                              {order.cep && (
                                <div>
                                  <span className="text-slate-400 font-semibold text-[11px]">CEP</span>
                                  <p className="text-slate-800 dark:text-slate-100 font-mono text-sm">{order.cep}</p>
                                </div>
                              )}
                              {(order.endereco || order.numero) && (
                                <div className="col-span-2">
                                  <span className="text-slate-400 font-semibold text-[11px]">Endereço</span>
                                  <p className="text-slate-800 dark:text-slate-100 text-sm">
                                    {order.endereco}{order.numero ? `, ${order.numero}` : ""}{order.complemento ? ` - ${order.complemento}` : ""}
                                  </p>
                                </div>
                              )}
                              {order.bairro && (
                                <div>
                                  <span className="text-slate-400 font-semibold text-[11px]">Bairro</span>
                                  <p className="text-slate-800 dark:text-slate-100 text-sm">{order.bairro}</p>
                                </div>
                              )}
                              {(order.municipio || order.uf) && (
                                <div>
                                  <span className="text-slate-400 font-semibold text-[11px]">Município/UF</span>
                                  <p className="text-slate-800 dark:text-slate-100 text-sm">{order.municipio}{order.uf ? `/${order.uf}` : ""}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Section: Contato */}
                        {(order.telefone1 || order.telefone2 || order.emailContato) && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-2">
                              <Phone className="w-3.5 h-3.5" />
                              Contato
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                              {order.telefone1 && (
                                <div>
                                  <span className="text-slate-400 font-semibold text-[11px]">Telefone 1</span>
                                  <p className="text-slate-800 dark:text-slate-100 text-sm">{order.telefone1}</p>
                                </div>
                              )}
                              {order.telefone2 && (
                                <div>
                                  <span className="text-slate-400 font-semibold text-[11px]">Telefone 2</span>
                                  <p className="text-slate-800 dark:text-slate-100 text-sm">{order.telefone2}</p>
                                </div>
                              )}
                              {order.emailContato && (
                                <div>
                                  <span className="text-slate-400 font-semibold text-[11px]">Email</span>
                                  <p className="text-slate-800 dark:text-slate-100 text-sm truncate">{order.emailContato}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Section: Dados Comerciais */}
                        {/* Dados Fiscais */}
                        {(order.regimeTributario || order.inscricaoMunicipal || order.inscricaoSuframa || order.situacaoFiscalEspecial || order.cnaeFiscal || order.emailNfe || order.website) && (
                          <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1 mb-2">
                              📋 Dados Fiscais
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
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
                        {(order.segmento || order.condicaoPagamento || order.formaCobranca || order.limiteCredito || order.tabelaPrecos || order.observacoes || order.formaPagamento || order.transportadora || order.valorFrete) && (
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
                              {order.formaPagamento && (<div><span className="text-slate-400 font-semibold">Forma Pagamento</span><p className="text-slate-800 dark:text-slate-100 font-bold">{order.formaPagamento}</p></div>)}
                              {(order as any).meioPagamento && (<div><span className="text-slate-400 font-semibold">Meio Pagamento</span><p className="text-amber-700 dark:text-amber-300 font-bold">{(order as any).meioPagamento}</p></div>)}
                              {order.transportadora && (<div><span className="text-slate-400 font-semibold">Transportadora</span><p className="text-blue-700 dark:text-blue-300 font-bold">{order.transportadora}</p></div>)}
                              {order.valorFrete && Number(order.valorFrete) > 0 && (<div><span className="text-slate-400 font-semibold">Valor Frete</span><p className="text-emerald-700 dark:text-emerald-300 font-bold">R$ {Number(order.valorFrete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>)}
                              {order.tipoFrete && (<div><span className="text-slate-400 font-semibold">Tipo Frete</span><p className="text-slate-800 dark:text-slate-100">{order.tipoFrete}</p></div>)}
                              {order.protocoloCotacao && (<div><span className="text-slate-400 font-semibold">Protocolo Frete</span><p className="text-teal-700 dark:text-teal-300 font-mono font-bold">{order.protocoloCotacao}</p></div>)}
                              {order.trackingUrl && (<div className="col-span-2"><span className="text-slate-400 font-semibold">Link Rastreio</span><a href={order.trackingUrl as string} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-teal-400 underline text-[9px] block truncate">{order.trackingUrl}</a></div>)}
                              {order.observacoes && (<div className="col-span-2 md:col-span-3"><span className="text-slate-400 font-semibold">Observações (Produção)</span><p className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{order.observacoes}</p></div>)}
                              {(order as any).observacoesInternas && (<div className="col-span-2 md:col-span-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded p-2"><span className="text-amber-700 dark:text-amber-400 font-semibold text-xs">⚠️ Observações Internas (NÃO exportado p/ Maxiprod — preencher manualmente)</span><p className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap mt-1">{(order as any).observacoesInternas}</p></div>)}
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

                        {/* Section: Redespacho */}
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

                        {/* Section: Endereço de Entrega */}
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

                      {/* MARGIN BARS - Gestores only */}
                      {isGestor && orderDetails && orderDetails.order.id === order.id && productMarginsQuery.data && (() => {
                        const items = orderDetails.items;
                        const costMap = productMarginsQuery.data!.costMap;
                        const taxBdImportado = productMarginsQuery.data!.taxBreakdownImportado;
                        const taxBdIndustrializado = productMarginsQuery.data!.taxBreakdownIndustrializado;
                        const defaultFrete = 13;
                        const defaultComissao = 5.85;
                        const defaultCustosAd = 0;

                        // Calculate weighted average margin for the order
                        let sumPVxMargin = 0;
                        let sumPV = 0;
                        items.forEach((item: any) => {
                          const costData = costMap[item.codigoItem];
                          if (!costData) return;
                          const pv = Number(item.precoUnitario);
                          if (pv <= 0) return;
                          const custoPerc = (costData.cost / pv) * 100;
                          const taxBd = costData.tipoProduto === "industrializado" ? taxBdIndustrializado : taxBdImportado;
                          const totalDeducoes = custoPerc + (taxBd?.total || 0) + defaultFrete + defaultComissao + defaultCustosAd;
                          const itemMargin = 100 - totalDeducoes;
                          const totalPV = pv * Number(item.quantidade);
                          sumPVxMargin += totalPV * itemMargin;
                          sumPV += totalPV;
                        });

                        const weightedMargin = sumPV > 0 ? sumPVxMargin / sumPV : null;

                        const getRepColor = (m: number) => {
                          if (m < 15) return { text: 'text-red-700', label: 'Crítico' };
                          if (m < 20) return { text: 'text-orange-700', label: 'Comissão Baixa' };
                          if (m < 25) return { text: 'text-yellow-700', label: 'Comissão Média' };
                          if (m < 29) return { text: 'text-green-700', label: 'Comissão Média-Alta' };
                          return { text: 'text-blue-700', label: 'Comissão Alta' };
                        };

                        return (
                          <div className="mt-4 space-y-3">
                            {/* 1. Per-product RealCostMarginBar */}
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                              <p className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                                <TrendingUp className="w-3.5 h-3.5" /> Margem Real por Produto
                              </p>
                              <div className="space-y-2">
                                {items.map((item: any, idx: number) => {
                                  const costData = costMap[item.codigoItem];
                                  if (!costData) return (
                                    <div key={idx} className="text-[10px] text-slate-400 bg-white rounded px-2 py-1">
                                      {item.descricaoItem} — sem custo cadastrado
                                    </div>
                                  );
                                  const taxBd = costData.tipoProduto === "industrializado" ? taxBdIndustrializado : taxBdImportado;
                                  if (!taxBd) return null;
                                  return (
                                    <div key={idx} className="bg-white rounded-lg p-2 border border-slate-100">
                                      <p className="text-[10px] font-medium text-slate-600 truncate mb-1">{item.descricaoItem}</p>
                                      <RealCostMarginBar
                                        precoVenda={Number(item.precoUnitario)}
                                        custoBox={costData.cost}
                                        fonte={costData.fonte}
                                        tipoProduto={costData.tipoProduto}
                                        taxBreakdown={taxBd}
                                        fretePerc={defaultFrete}
                                        comissaoPerc={defaultComissao}
                                        custosAdicionaisPerc={defaultCustosAd}
                                        quantidade={Number(item.quantidade)}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 2. Order Reputation Bar */}
                            {weightedMargin !== null && (() => {
                              const repColor = getRepColor(weightedMargin);
                              const barMin = -5;
                              const barMax = 40;
                              const clamped = Math.max(barMin, Math.min(barMax, weightedMargin));
                              const pos = ((clamped - barMin) / (barMax - barMin)) * 100;
                              return (
                                <div className="bg-indigo-50 border-2 border-indigo-300 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-bold text-indigo-700">🏆 Reputação do Pedido</span>
                                    <span className={`text-sm font-black tabular-nums ${repColor.text}`}>
                                      {weightedMargin.toFixed(1)}% ({repColor.label})
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
                                </div>
                              );
                            })()}

                            {/* 3. Monthly Seller Reputation Bar */}
                            {monthlyMarginQuery.data && (() => {
                              const md = monthlyMarginQuery.data;
                              const margin = md.currentMonthlyMargin ?? 0;
                              if (md.totalOrders === 0) return null;
                              const getMonthColor = (m: number) => {
                                if (m < 15) return { text: 'text-red-700', label: 'Crítico' };
                                if (m < 20) return { text: 'text-orange-700', label: 'Comissão Baixa' };
                                if (m < 25) return { text: 'text-yellow-700', label: 'Comissão Média' };
                                if (m < 29) return { text: 'text-green-700', label: 'Comissão Média-Alta' };
                                return { text: 'text-blue-700', label: 'Comissão Alta' };
                              };
                              const mColor = getMonthColor(margin);
                              const barMin = -5;
                              const barMax = 40;
                              const clamped = Math.max(barMin, Math.min(barMax, margin));
                              const pos = ((clamped - barMin) / (barMax - barMin)) * 100;
                              return (
                                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                      <span className="text-[10px] font-bold text-indigo-700 uppercase">Reputação do Mês — {order.sellerName} ({md.month})</span>
                                    </div>
                                    <span className={`text-sm font-black tabular-nums ${mColor.text}`}>
                                      {margin.toFixed(1)}% ({mColor.label})
                                    </span>
                                  </div>
                                  <div className="relative w-full">
                                    <div className="relative h-6 rounded-full overflow-visible border-2 border-slate-300 shadow-sm">
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
                                        style={{ left: `${pos}%`, transform: "translateX(-50%)", top: "-6px", bottom: "-2px" }}
                                      >
                                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-slate-900" />
                                        <div className="w-[2px] flex-1 bg-slate-900 rounded-full" />
                                      </div>
                                    </div>
                                    <div className="relative w-full h-3 mt-0.5">
                                      <span className="absolute text-[8px] font-bold text-indigo-400" style={{ left: "44.4%", transform: "translateX(-50%)" }}>15%</span>
                                      <span className="absolute text-[8px] font-bold text-indigo-400" style={{ left: "55.5%", transform: "translateX(-50%)" }}>20%</span>
                                      <span className="absolute text-[8px] font-bold text-indigo-400" style={{ left: "66.6%", transform: "translateX(-50%)" }}>25%</span>
                                      <span className="absolute text-[8px] font-bold text-indigo-400" style={{ left: "75.5%", transform: "translateX(-50%)" }}>29%</span>
                                    </div>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between text-[10px]">
                                    <span className="text-slate-500">{md.totalOrders} pedido{md.totalOrders !== 1 ? 's' : ''} no mês</span>
                                    <div className="flex items-center gap-2">
                                      {md.monthlyComissaoPercentual > 0 && (
                                        <span className="font-bold text-emerald-600">Comissão: {md.monthlyComissaoPercentual}%</span>
                                      )}
                                      {md.orderBreakdown && md.orderBreakdown.length > 0 && (
                                        <button
                                          onClick={() => setShowMonthlyDetails(prev => !prev)}
                                          className="text-[10px] font-medium text-teal-600 hover:underline flex items-center gap-0.5"
                                        >
                                          <Eye className="w-3 h-3" />
                                          {showMonthlyDetails ? 'Ocultar' : 'Detalhes'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {showMonthlyDetails && md.orderBreakdown && md.orderBreakdown.length > 0 && (
                                    <div className="mt-2 border-t border-slate-200 pt-2">
                                      <p className="text-[10px] font-bold text-slate-600 mb-1.5">Pedidos do mês:</p>
                                      <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {md.orderBreakdown.map((ob: any, idx: number) => {
                                          const peso = md.totalValue > 0 ? (ob.valor / md.totalValue) * 100 : 0;
                                          const tierColor = ob.margem >= 29 ? 'text-blue-600' : ob.margem >= 25 ? 'text-green-600' : ob.margem >= 20 ? 'text-yellow-600' : ob.margem >= 15 ? 'text-orange-600' : 'text-red-600';
                                          return (
                                            <div key={idx} className="flex items-center justify-between bg-white rounded px-2 py-1">
                                              <span className="text-[9px] text-slate-600 truncate flex-1">#{ob.orderId} — {ob.clienteNome || 'Cliente'}</span>
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
                          </div>
                        );
                      })()}

                      {/* APPROVE BUTTON - For pending orders (Guilherme/Juvenal only) */}
                      {isPendente && canSeeAguardandoAprovacao && (
                        <div className="mt-4">
                          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg mb-3">
                            <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">
                              <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                              Pedido aguardando aprovação do gestor
                            </p>
                          </div>
                          {approvingOrderId === order.id ? (
                            <div className="space-y-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <label className="text-xs font-bold text-green-700 block">Senha de aprovação (obrigatória):</label>
                              <SecureInput
                                value={approvalPassword}
                                onChange={(v) => { setApprovalPassword(v); setApprovalPasswordError(""); }}
                                placeholder="Digite sua senha (primeiro nome)"
                                className="w-full px-3 py-2 text-xs border border-green-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30"
                              />
                              {approvalPasswordError && (
                                <p className="text-xs text-red-500 font-medium">{approvalPasswordError}</p>
                              )}
                              <label className="text-xs font-bold text-green-700 block">Observação de aprovação (opcional):</label>
                              <textarea
                                value={approvalObs}
                                onChange={(e) => setApprovalObs(e.target.value)}
                                placeholder="Justifique a aprovação e/ou o preço praticado..."
                                rows={2}
                                className="w-full px-3 py-2 text-xs border border-green-200 rounded-lg bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 resize-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={confirmApproveOrder}
                                  disabled={approveOrderMutation.isPending}
                                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  {approveOrderMutation.isPending ? "Aprovando..." : "Confirmar Autorização"}
                                </button>
                                <button
                                  onClick={() => { setApprovingOrderId(null); setApprovalObs(""); setApprovalPassword(""); setApprovalPasswordError(""); }}
                                  className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-medium cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleApproveOrder(order.id)}
                              disabled={approveOrderMutation.isPending}
                              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              ✓ Aprovar Pedido
                            </button>
                          )}
                        </div>
                      )}

                      {/* GESTOR INFO - Approval moved to dedicated Aprovações page */}
                      {isAwaitingGestor && (
                        <div className="mt-4">
                          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                            <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">
                              <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                              Aguardando aprovação do gestor Juvenal
                            </p>
                            <p className="text-[10px] text-orange-600 dark:text-orange-300 mt-1">
                              Aprovado pelo subgestor: {order.aprovadoPor}{order.dataAprovacao && ` em ${new Date(order.dataAprovacao).toLocaleDateString("pt-BR")}`}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ACTION BUTTONS - Status flow (only Vitória can mark as received/launched) */}
                      {isNovo && isVitoriaViewer && (
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
                      {/* Button "Lançado no Maxiprod" for approved orders */}
                      {isAprovado && !isLancado && (
                        <div className="mt-4">
                          <div className="p-2.5 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg mb-3">
                            <p className="text-[10px] text-teal-700 dark:text-teal-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Pedido aprovado{order.dataAprovacao ? ` em ${new Date(order.dataAprovacao).toLocaleString("pt-BR")}` : ""}
                              {order.aprovadoPor ? ` por ${order.aprovadoPor}` : ""}
                            </p>
                          </div>
                          <button
                            onClick={() => handleMarkLancado(order.id)}
                            disabled={markLancadoMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                          >
                            <CheckCheck className="w-4 h-4" />
                            {markLancadoMutation.isPending ? "Marcando..." : "✓ Lançado no Maxiprod"}
                          </button>
                        </div>
                      )}

                      {isRecebido && isVitoriaViewer && (
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
                      {isRecebido && !isVitoriaViewer && (
                        <div className="mt-3">
                          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-[10px] text-blue-700 dark:text-blue-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Pedido recebido — aguardando lançamento no Maxiprod
                            </p>
                          </div>
                        </div>
                      )}

                      {isLancado && (
                        <div className="mt-3">
                          <div className="p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
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
                          {/* PDF Download button for completed orders */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const items = orderDetails && orderDetails.order.id === order.id ? orderDetails.items : [];
                              const printWindow = window.open("", "_blank");
                              if (printWindow) {
                                printWindow.document.write(`
                                  <html><head><title>Pedido #${String(order.orderNumber || order.id).padStart(2, '0')} - ${order.razaoSocial || order.nomeFantasia}</title>
                                  <style>
                                    body { font-family: Arial, sans-serif; padding: 30px; font-size: 11px; line-height: 1.5; color: #333; }
                                    h1 { font-size: 18px; color: #1a5c3a; border-bottom: 2px solid #1a5c3a; padding-bottom: 8px; margin-bottom: 20px; }
                                    h2 { font-size: 13px; color: #555; margin-top: 18px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
                                    .header-info { display: flex; justify-content: space-between; margin-bottom: 15px; }
                                    .header-info div { font-size: 11px; }
                                    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 16px; }
                                    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
                                    .field { margin: 3px 0; }
                                    .label { font-weight: bold; color: #555; font-size: 10px; }
                                    .value { color: #111; }
                                    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
                                    th { background: #f0f9f4; color: #1a5c3a; padding: 6px 8px; text-align: left; border: 1px solid #ddd; font-size: 10px; }
                                    td { padding: 5px 8px; border: 1px solid #eee; }
                                    tr:nth-child(even) { background: #fafafa; }
                                    .total-row { font-weight: bold; background: #f0f9f4 !important; }
                                    .total-row td { border-top: 2px solid #1a5c3a; }
                                    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #888; }
                                    .status-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #dcfce7; color: #166534; }
                                  </style></head><body>
                                  <h1>PEDIDO DE VENDA #${String(order.orderNumber || order.id).padStart(2, '0')}</h1>
                                  <div class="header-info">
                                    <div>
                                      <strong>Cliente:</strong> ${order.razaoSocial || order.nomeFantasia || "—"}<br/>
                                      ${order.cnpjCpf ? '<strong>CNPJ/CPF:</strong> ' + order.cnpjCpf + '<br/>' : ''}
                                      ${order.municipio ? '<strong>Cidade:</strong> ' + order.municipio + (order.uf ? '/' + order.uf : '') + '<br/>' : ''}
                                      ${order.telefone1 ? '<strong>Telefone:</strong> ' + order.telefone1 + '<br/>' : ''}
                                    </div>
                                    <div style="text-align:right">
                                      <strong>Vendedor:</strong> ${order.sellerName || "—"}<br/>
                                      <strong>Data:</strong> ${order.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-BR") : "—"}<br/>
                                      <span class="status-badge">LANÇADO</span>
                                    </div>
                                  </div>

                                  <h2>ITENS DO PEDIDO</h2>
                                  <table>
                                    <thead>
                                      <tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:center">Un</th><th style="text-align:right">Preço Unit.</th><th style="text-align:right">Total</th></tr>
                                    </thead>
                                    <tbody>
                                      ${items.map((item: any) => '<tr><td>' + (item.descricaoItem || '—') + '</td><td style="text-align:center">' + Number(item.quantidade).toFixed(0) + '</td><td style="text-align:center">' + (item.unidadeMedida || 'un') + '</td><td style="text-align:right">' + formatCurrency(Number(item.precoUnitario)) + '</td><td style="text-align:right">' + formatCurrency(Number(item.totalItem)) + '</td></tr>').join('')}
                                      <tr class="total-row"><td colspan="4" style="text-align:right">TOTAL DO PEDIDO</td><td style="text-align:right">${formatCurrency(order.totalPedido)}</td></tr>
                                    </tbody>
                                  </table>

                                  ${order.condicaoPagamento || order.formaCobranca || order.tabelaPrecos || order.formaPagamento || order.transportadora || order.valorFrete ? '<h2>CONDIÇÕES COMERCIAIS</h2><div class="grid">' + (order.condicaoPagamento ? '<div class="field"><span class="label">Cond. Pagamento:</span> <span class="value">' + order.condicaoPagamento + '</span></div>' : '') + (order.formaPagamento ? '<div class="field"><span class="label">Forma Pagamento:</span> <span class="value" style="font-weight:bold">' + order.formaPagamento + '</span></div>' : '') + ((order as any).meioPagamento ? '<div class="field"><span class="label">Meio Pagamento:</span> <span class="value" style="font-weight:bold;color:#b45309">' + (order as any).meioPagamento + '</span></div>' : '') + (order.formaCobranca ? '<div class="field"><span class="label">Forma Cobrança:</span> <span class="value">' + order.formaCobranca + '</span></div>' : '') + (order.tabelaPrecos ? '<div class="field"><span class="label">Tabela Preços:</span> <span class="value">' + order.tabelaPrecos + '</span></div>' : '') + (order.transportadora ? '<div class="field"><span class="label">Transportadora:</span> <span class="value" style="font-weight:bold;color:#1d4ed8">' + order.transportadora + '</span></div>' : '') + (order.valorFrete && Number(order.valorFrete) > 0 ? '<div class="field"><span class="label">Valor Frete:</span> <span class="value" style="font-weight:bold;color:#047857">R$ ' + Number(order.valorFrete).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '</span></div>' : '') + (order.tipoFrete ? '<div class="field"><span class="label">Tipo Frete:</span> <span class="value">' + order.tipoFrete + '</span></div>' : '') + (order.protocoloCotacao ? '<div class="field"><span class="label">Protocolo Frete:</span> <span class="value" style="font-weight:bold;color:#0d9488;font-family:monospace">' + order.protocoloCotacao + '</span></div>' : '') + '</div>' : ''}

                                  ${order.observacoes ? '<h2>OBSERVAÇÕES</h2><p>' + order.observacoes + '</p>' : ''}

                                  ${order.possuiRedespacho ? '<h2>REDESPACHO</h2><div class="grid">' + (order.redespachoCnpj ? '<div class="field"><span class="label">CNPJ:</span> ' + order.redespachoCnpj + '</div>' : '') + (order.redespachoRazaoSocial ? '<div class="field"><span class="label">Razão Social:</span> ' + order.redespachoRazaoSocial + '</div>' : '') + (order.redespachoLogradouro ? '<div class="field"><span class="label">Endereço:</span> ' + [order.redespachoLogradouro, order.redespachoNumero, order.redespachoBairro, order.redespachoCidade, order.redespachoUf].filter(Boolean).join(', ') + '</div>' : '') + (order.redespachoTelefone ? '<div class="field"><span class="label">Telefone:</span> ' + order.redespachoTelefone + '</div>' : '') + '</div>' : ''}

                                  ${!order.enderecoEntregaMesmo ? '<h2>ENDEREÇO DE ENTREGA (DIFERENTE)</h2><div class="grid">' + (order.entregaCep ? '<div class="field"><span class="label">CEP:</span> ' + order.entregaCep + '</div>' : '') + (order.entregaLogradouro ? '<div class="field"><span class="label">Endereço:</span> ' + [order.entregaLogradouro, order.entregaNumero, order.entregaBairro, order.entregaCidade, order.entregaUf].filter(Boolean).join(', ') + '</div>' : '') + (order.entregaTelefone ? '<div class="field"><span class="label">Telefone:</span> ' + order.entregaTelefone + '</div>' : '') + '</div>' : ''}

                                  <div class="footer">
                                    <p>Pedido gerado em ${order.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-BR") : "—"} | Lançado em ${order.vitoriaLancadoAt ? new Date(order.vitoriaLancadoAt).toLocaleDateString("pt-BR") : "—"} | Grupo Fox</p>
                                  </div>
                                  </body></html>
                                `);
                                printWindow.document.close();
                                setTimeout(() => { printWindow.print(); }, 300);
                              }
                            }}
                            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                            Baixar Pedido em PDF
                          </button>
                        </div>
                      )}

                      {/* Delete Order Button */}
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        {confirmDelete === order.id ? (
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-red-600 font-medium flex-1">Tem certeza? Esta ação não pode ser desfeita.</p>
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              disabled={deleteOrderMutation.isPending}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-[10px] font-bold rounded transition-colors cursor-pointer"
                            >
                              {deleteOrderMutation.isPending ? "Apagando..." : "Confirmar"}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded transition-colors cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(order.id)}
                            className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Apagar Pedido (teste)
                          </button>
                        )}
                      </div>


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


function NewClientExpandableRow({ client, exportingClientId, setExportingClientId, exportVendorClientMutation, markExportedMutation, refetchClients, utils }: any) {
  const [expanded, setExpanded] = useState(false);

  const endereco = [client.logradouro, client.numero, client.bairro, client.cidade, client.uf]
    .filter(Boolean).join(", ");
  const enderecoEntrega = [client.entregaLogradouro, client.entregaNumero, client.entregaBairro, client.entregaCidade, client.entregaUf]
    .filter(Boolean).join(", ");
  const enderecoRedespacho = [client.redespachoLogradouro, client.redespachoNumero, client.redespachoBairro, client.redespachoCidade, client.redespachoUf]
    .filter(Boolean).join(", ");

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{client.razaoSocial}</p>
            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500 flex-wrap">
              <span>{client.cnpjCpf}</span>
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{client.sellerName}</span>
              {client.cidade && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{client.cidade}/{client.uf}</span>}
              <span>{new Date(client.createdAt).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-l-4 border-emerald-300 dark:border-emerald-700 ml-4 bg-emerald-50/30 dark:bg-emerald-900/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2">
            {client.razaoSocial && (
              <div><span className="text-slate-400 font-medium">Razão Social:</span> <span className="text-slate-700 dark:text-slate-200">{client.razaoSocial}</span></div>
            )}
            {client.nomeFantasia && (
              <div><span className="text-slate-400 font-medium">Nome Fantasia:</span> <span className="text-slate-700 dark:text-slate-200">{client.nomeFantasia}</span></div>
            )}
            {client.cnpjCpf && (
              <div><span className="text-slate-400 font-medium">CNPJ/CPF:</span> <span className="text-slate-700 dark:text-slate-200 font-mono">{client.cnpjCpf}</span></div>
            )}
            {client.inscricaoEstadual && (
              <div><span className="text-slate-400 font-medium">IE:</span> <span className="text-slate-700 dark:text-slate-200">{client.inscricaoEstadual}</span></div>
            )}
            {client.inscricaoMunicipal && (
              <div><span className="text-slate-400 font-medium">IM:</span> <span className="text-slate-700 dark:text-slate-200">{client.inscricaoMunicipal}</span></div>
            )}
            {client.inscricaoSuframa && (
              <div><span className="text-slate-400 font-medium">SUFRAMA:</span> <span className="text-slate-700 dark:text-slate-200">{client.inscricaoSuframa}</span></div>
            )}
            {client.cep && (
              <div><span className="text-slate-400 font-medium">CEP:</span> <span className="text-slate-700 dark:text-slate-200">{client.cep}</span></div>
            )}
            {endereco && (
              <div className="sm:col-span-2"><span className="text-slate-400 font-medium">Endereço:</span> <span className="text-slate-700 dark:text-slate-200">{endereco}</span></div>
            )}
            {client.telefone1 && (
              <div><span className="text-slate-400 font-medium">Telefone:</span> <span className="text-slate-700 dark:text-slate-200">{client.telefone1}{client.telefone2 ? ` / ${client.telefone2}` : ""}</span></div>
            )}
            {client.email && (
              <div><span className="text-slate-400 font-medium">Email:</span> <span className="text-slate-700 dark:text-slate-200">{client.email}</span></div>
            )}
            {client.emailNfe && (
              <div><span className="text-slate-400 font-medium">Email NFe:</span> <span className="text-slate-700 dark:text-slate-200">{client.emailNfe}</span></div>
            )}
            {client.nomeContato && (
              <div><span className="text-slate-400 font-medium">Contato:</span> <span className="text-slate-700 dark:text-slate-200">{client.nomeContato}</span></div>
            )}
            {client.segmento && (
              <div><span className="text-slate-400 font-medium">Segmento:</span> <span className="text-slate-700 dark:text-slate-200">{client.segmento}</span></div>
            )}
            {client.regimeTributario && (
              <div><span className="text-slate-400 font-medium">Regime Tributário:</span> <span className="text-slate-700 dark:text-slate-200">{client.regimeTributario}</span></div>
            )}
            {client.situacaoFiscalEspecial && client.situacaoFiscalEspecial !== "Nenhuma" && (
              <div><span className="text-slate-400 font-medium">Sit. Fiscal:</span> <span className="text-slate-700 dark:text-slate-200">{client.situacaoFiscalEspecial}</span></div>
            )}
            {client.cnaeFiscal && (
              <div><span className="text-slate-400 font-medium">CNAE:</span> <span className="text-slate-700 dark:text-slate-200">{client.cnaeFiscal}</span></div>
            )}
            {client.limiteCredito && (
              <div><span className="text-slate-400 font-medium">Limite Crédito:</span> <span className="text-slate-700 dark:text-slate-200">R$ {client.limiteCredito}</span></div>
            )}
            {client.formaCobranca && (
              <div><span className="text-slate-400 font-medium">Forma Cobrança:</span> <span className="text-slate-700 dark:text-slate-200">{client.formaCobranca}</span></div>
            )}
            {client.tabelaPrecos && (
              <div><span className="text-slate-400 font-medium">Tabela Preços:</span> <span className="text-slate-700 dark:text-slate-200">{client.tabelaPrecos}</span></div>
            )}
            {client.condicaoPagamento && (
              <div><span className="text-slate-400 font-medium">Cond. Pagamento:</span> <span className="text-slate-700 dark:text-slate-200">{client.condicaoPagamento}</span></div>
            )}
            {client.regiao && (
              <div><span className="text-slate-400 font-medium">Região:</span> <span className="text-slate-700 dark:text-slate-200">{client.regiao}</span></div>
            )}
            {client.perfil && (
              <div><span className="text-slate-400 font-medium">Perfil:</span> <span className="text-slate-700 dark:text-slate-200">{client.perfil}</span></div>
            )}
            {client.produtos && (
              <div className="sm:col-span-2"><span className="text-slate-400 font-medium">Produtos:</span> <span className="text-slate-700 dark:text-slate-200">{client.produtos}</span></div>
            )}
            {client.probabilidadeNegocio && (
              <div><span className="text-slate-400 font-medium">Probabilidade:</span> <span className="text-slate-700 dark:text-slate-200">{client.probabilidadeNegocio}</span></div>
            )}
            {client.tamanho && (
              <div><span className="text-slate-400 font-medium">Tamanho:</span> <span className="text-slate-700 dark:text-slate-200">{client.tamanho}</span></div>
            )}
            {client.fornecedorAtual && (
              <div><span className="text-slate-400 font-medium">Fornecedor Atual:</span> <span className="text-slate-700 dark:text-slate-200">{client.fornecedorAtual}</span></div>
            )}
            {client.website && (
              <div><span className="text-slate-400 font-medium">Website:</span> <span className="text-slate-700 dark:text-slate-200">{client.website}</span></div>
            )}
            {client.observacoes && (
              <div className="sm:col-span-2"><span className="text-slate-400 font-medium">Obs:</span> <span className="text-slate-700 dark:text-slate-200">{client.observacoes}</span></div>
            )}
          </div>

          {/* Redespacho */}
          {client.possuiRedespacho === 1 && (
            <div className="mt-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
              <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Redespacho</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                {client.redespachoCnpj && <span className="text-slate-600 dark:text-slate-300">CNPJ: {client.redespachoCnpj}</span>}
                {client.redespachoRazaoSocial && <span className="text-slate-600 dark:text-slate-300">Razão: {client.redespachoRazaoSocial}</span>}
                {client.redespachoCep && <span className="text-slate-600 dark:text-slate-300">CEP: {client.redespachoCep}</span>}
                {enderecoRedespacho && <span className="text-slate-600 dark:text-slate-300">{enderecoRedespacho}</span>}
                {client.redespachoTelefone && <span className="text-slate-600 dark:text-slate-300">Tel: {client.redespachoTelefone}</span>}
              </div>
            </div>
          )}

          {/* Endereço de entrega diferente */}
          {client.enderecoEntregaMesmo === 0 && (
            <div className="mt-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700">
              <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Endereço de Entrega (diferente)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                {client.entregaCep && <span className="text-slate-600 dark:text-slate-300">CEP: {client.entregaCep}</span>}
                {enderecoEntrega && <span className="text-slate-600 dark:text-slate-300">{enderecoEntrega}</span>}
                {client.entregaTelefone && <span className="text-slate-600 dark:text-slate-300">Tel: {client.entregaTelefone}</span>}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-3 flex gap-2">
            {/* PDF Download button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Generate PDF client-side
                const lines: string[] = [];
                lines.push("CADASTRO DE CLIENTE");
                lines.push("=".repeat(50));
                lines.push("");
                if (client.razaoSocial) lines.push(`Razão Social: ${client.razaoSocial}`);
                if (client.nomeFantasia) lines.push(`Nome Fantasia: ${client.nomeFantasia}`);
                if (client.cnpjCpf) lines.push(`CNPJ/CPF: ${client.cnpjCpf}`);
                if (client.inscricaoEstadual) lines.push(`Inscrição Estadual: ${client.inscricaoEstadual}`);
                if (client.inscricaoMunicipal) lines.push(`Inscrição Municipal: ${client.inscricaoMunicipal}`);
                if (client.inscricaoSuframa) lines.push(`SUFRAMA: ${client.inscricaoSuframa}`);
                if (client.cnaeFiscal) lines.push(`CNAE: ${client.cnaeFiscal}`);
                lines.push("");
                lines.push("--- ENDEREÇO ---");
                if (client.cep) lines.push(`CEP: ${client.cep}`);
                if (endereco) lines.push(`Endereço: ${endereco}`);
                lines.push("");
                lines.push("--- CONTATO ---");
                if (client.telefone1) lines.push(`Telefone: ${client.telefone1}${client.telefone2 ? " / " + client.telefone2 : ""}`);
                if (client.email) lines.push(`Email: ${client.email}`);
                if (client.emailNfe) lines.push(`Email NFe: ${client.emailNfe}`);
                if (client.nomeContato) lines.push(`Contato: ${client.nomeContato}`);
                if (client.website) lines.push(`Website: ${client.website}`);
                lines.push("");
                lines.push("--- COMERCIAL ---");
                if (client.segmento) lines.push(`Segmento: ${client.segmento}`);
                if (client.regimeTributario) lines.push(`Regime Tributário: ${client.regimeTributario}`);
                if (client.situacaoFiscalEspecial && client.situacaoFiscalEspecial !== "Nenhuma") lines.push(`Sit. Fiscal Especial: ${client.situacaoFiscalEspecial}`);
                if (client.formaCobranca) lines.push(`Forma Cobrança: ${client.formaCobranca}`);
                if (client.condicaoPagamento) lines.push(`Cond. Pagamento: ${client.condicaoPagamento}`);
                if (client.tabelaPrecos) lines.push(`Tabela Preços: ${client.tabelaPrecos}`);
                if (client.limiteCredito) lines.push(`Limite Crédito: R$ ${client.limiteCredito}`);
                if (client.regiao) lines.push(`Região: ${client.regiao}`);
                if (client.perfil) lines.push(`Perfil: ${client.perfil}`);
                if (client.produtos) lines.push(`Produtos: ${client.produtos}`);
                if (client.probabilidadeNegocio) lines.push(`Probabilidade: ${client.probabilidadeNegocio}`);
                if (client.tamanho) lines.push(`Tamanho: ${client.tamanho}`);
                if (client.fornecedorAtual) lines.push(`Fornecedor Atual: ${client.fornecedorAtual}`);
                if (client.observacoes) { lines.push(""); lines.push(`Observações: ${client.observacoes}`); }
                if (client.possuiRedespacho === 1) {
                  lines.push("");
                  lines.push("--- REDESPACHO ---");
                  if (client.redespachoCnpj) lines.push(`CNPJ: ${client.redespachoCnpj}`);
                  if (client.redespachoRazaoSocial) lines.push(`Razão: ${client.redespachoRazaoSocial}`);
                  if (client.redespachoCep) lines.push(`CEP: ${client.redespachoCep}`);
                  if (enderecoRedespacho) lines.push(`Endereço: ${enderecoRedespacho}`);
                  if (client.redespachoTelefone) lines.push(`Tel: ${client.redespachoTelefone}`);
                }
                if (client.enderecoEntregaMesmo === 0) {
                  lines.push("");
                  lines.push("--- ENDEREÇO DE ENTREGA ---");
                  if (client.entregaCep) lines.push(`CEP: ${client.entregaCep}`);
                  if (enderecoEntrega) lines.push(`Endereço: ${enderecoEntrega}`);
                  if (client.entregaTelefone) lines.push(`Tel: ${client.entregaTelefone}`);
                }
                lines.push("");
                lines.push(`Vendedor: ${client.sellerName || "N/A"}`);
                lines.push(`Data Cadastro: ${new Date(client.createdAt).toLocaleDateString("pt-BR")}`);
                
                // Create a printable HTML and trigger print as PDF
                const printWindow = window.open("", "_blank");
                if (printWindow) {
                  printWindow.document.write(`
                    <html><head><title>Cadastro - ${client.razaoSocial}</title>
                    <style>
                      body { font-family: Arial, sans-serif; padding: 40px; font-size: 12px; line-height: 1.6; }
                      h1 { font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 8px; }
                      h2 { font-size: 13px; color: #555; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
                      .field { margin: 4px 0; }
                      .label { font-weight: bold; color: #333; }
                      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
                    </style></head><body>
                    <h1>CADASTRO DE CLIENTE</h1>
                    <div class="grid">
                    ${client.razaoSocial ? '<div class="field"><span class="label">Razão Social:</span> ' + client.razaoSocial + '</div>' : ''}
                    ${client.nomeFantasia ? '<div class="field"><span class="label">Nome Fantasia:</span> ' + client.nomeFantasia + '</div>' : ''}
                    ${client.cnpjCpf ? '<div class="field"><span class="label">CNPJ/CPF:</span> ' + client.cnpjCpf + '</div>' : ''}
                    ${client.inscricaoEstadual ? '<div class="field"><span class="label">IE:</span> ' + client.inscricaoEstadual + '</div>' : ''}
                    ${client.cep ? '<div class="field"><span class="label">CEP:</span> ' + client.cep + '</div>' : ''}
                    ${endereco ? '<div class="field" style="grid-column:span 2"><span class="label">Endereço:</span> ' + endereco + '</div>' : ''}
                    ${client.telefone1 ? '<div class="field"><span class="label">Telefone:</span> ' + client.telefone1 + (client.telefone2 ? ' / ' + client.telefone2 : '') + '</div>' : ''}
                    ${client.email ? '<div class="field"><span class="label">Email:</span> ' + client.email + '</div>' : ''}
                    ${client.nomeContato ? '<div class="field"><span class="label">Contato:</span> ' + client.nomeContato + '</div>' : ''}
                    ${client.segmento ? '<div class="field"><span class="label">Segmento:</span> ' + client.segmento + '</div>' : ''}
                    ${client.regimeTributario ? '<div class="field"><span class="label">Regime Tributário:</span> ' + client.regimeTributario + '</div>' : ''}
                    ${client.formaCobranca ? '<div class="field"><span class="label">Forma Cobrança:</span> ' + client.formaCobranca + '</div>' : ''}
                    ${client.condicaoPagamento ? '<div class="field"><span class="label">Cond. Pagamento:</span> ' + client.condicaoPagamento + '</div>' : ''}
                    ${client.regiao ? '<div class="field"><span class="label">Região:</span> ' + client.regiao + '</div>' : ''}
                    ${client.perfil ? '<div class="field"><span class="label">Perfil:</span> ' + client.perfil + '</div>' : ''}
                    ${client.produtos ? '<div class="field" style="grid-column:span 2"><span class="label">Produtos:</span> ' + client.produtos + '</div>' : ''}
                    ${client.probabilidadeNegocio ? '<div class="field"><span class="label">Probabilidade:</span> ' + client.probabilidadeNegocio + '</div>' : ''}
                    ${client.tamanho ? '<div class="field"><span class="label">Tamanho:</span> ' + client.tamanho + '</div>' : ''}
                    ${client.fornecedorAtual ? '<div class="field"><span class="label">Fornecedor Atual:</span> ' + client.fornecedorAtual + '</div>' : ''}
                    </div>
                    ${client.possuiRedespacho === 1 ? '<h2>REDESPACHO</h2><div class="grid">' + (client.redespachoCnpj ? '<div class="field"><span class="label">CNPJ:</span> ' + client.redespachoCnpj + '</div>' : '') + (client.redespachoRazaoSocial ? '<div class="field"><span class="label">Razão:</span> ' + client.redespachoRazaoSocial + '</div>' : '') + (client.redespachoCep ? '<div class="field"><span class="label">CEP:</span> ' + client.redespachoCep + '</div>' : '') + (enderecoRedespacho ? '<div class="field" style="grid-column:span 2"><span class="label">Endereço:</span> ' + enderecoRedespacho + '</div>' : '') + (client.redespachoTelefone ? '<div class="field"><span class="label">Tel:</span> ' + client.redespachoTelefone + '</div>' : '') + '</div>' : ''}
                    ${client.enderecoEntregaMesmo === 0 ? '<h2>ENDEREÇO DE ENTREGA</h2><div class="grid">' + (client.entregaCep ? '<div class="field"><span class="label">CEP:</span> ' + client.entregaCep + '</div>' : '') + (enderecoEntrega ? '<div class="field" style="grid-column:span 2"><span class="label">Endereço:</span> ' + enderecoEntrega + '</div>' : '') + (client.entregaTelefone ? '<div class="field"><span class="label">Tel:</span> ' + client.entregaTelefone + '</div>' : '') + '</div>' : ''}
                    ${client.observacoes ? '<h2>OBSERVAÇÕES</h2><p>' + client.observacoes + '</p>' : ''}
                    <hr style="margin-top:20px">
                    <p style="color:#888;font-size:10px">Vendedor: ${client.sellerName || 'N/A'} | Cadastrado em: ${new Date(client.createdAt).toLocaleDateString('pt-BR')}</p>
                    </body></html>
                  `);
                  printWindow.document.close();
                  setTimeout(() => { printWindow.print(); }, 300);
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200 rounded-lg hover:bg-blue-200 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Baixar PDF
            </button>

            {/* Export Maxiprod button */}
            <button
              onClick={async (e) => {
                e.stopPropagation();
                setExportingClientId(client.id);
                try {
                  const result = await exportVendorClientMutation.mutateAsync({ clientId: client.id });
                  const byteCharacters = atob(result.base64);
                  const byteNumbers = new Array(byteCharacters.length);
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = result.filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success(`Planilha exportada: ${result.clientName}`);
                } catch (err: any) {
                  toast.error(err.message || "Erro ao exportar");
                } finally {
                  setExportingClientId(null);
                }
              }}
              disabled={exportingClientId === client.id}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-lg hover:bg-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              {exportingClientId === client.id ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              {exportingClientId === client.id ? "Exportando..." : "Exportar Maxiprod"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
