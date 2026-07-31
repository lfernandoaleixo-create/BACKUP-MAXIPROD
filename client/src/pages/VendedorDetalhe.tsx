/**
 * VendedorDetalhe - Página de detalhe de um vendedor específico
 * Abas: Estoque, Cadastro de Cliente, Vendas, Configurações
 * Acessível via /gestao-comercial/vendedor/:sellerId
 * 
 * - Aba Estoque: mostra APENAS os produtos que o gestor ticou, com dados reais
 *   (disponível p/ venda, POs projetadas, reservas)
 * - Aba Configurações: ticagem de produtos visíveis, autorização, senha, catálogos
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import TopNav from "@/components/TopNav";
import SellerCobrancaView from "@/components/SellerCobrancaView";
import { trpc } from "@/lib/trpc";
import { useOrderDraft, type DraftOrderItem, type DraftClientData } from "@/contexts/OrderDraftContext";
import {
  ArrowLeft,
  Package,
  UserPlus,
  BarChart3,
  Settings,
  Layers,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCircle2,
  FileText,
  Upload,
  Trash2,
  X,
  FolderOpen,
  Lock,
  ShieldCheck,
  Shield,
  RefreshCw,
  Construction,
  Ship,
  Navigation,
  ShoppingCart,
  Calendar,
  Bookmark,
  DollarSign,
  TrendingUp,
  Users,
  Trophy,
  Filter,
  Search,
  Phone,
  Mail,
  MapPin,
  Plus,
  Save,
  Building2,
  FileCheck,
  ChevronLeft,
  Tag,
  Target,
  CreditCard,
  Globe,
  Briefcase,
  AlertTriangle,
  Truck,
  Pencil,
  Download,
  FileSpreadsheet,
  Calculator,
  RotateCcw,
  Eye,
  ClipboardCheck,
  TrendingDown,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrackingModal } from "@/components/TrackingModal";
import CustosDeVendaStep from "@/components/CustosDeVendaStep";
import { ProductMarginBar, MarginParamsEditor } from "@/components/ProductMarginBar";
import { RealCostMarginBar, MarginSimulationParams } from "@/components/RealCostMarginBar";
import { useOperator } from "@/contexts/OperatorContext";
import { SerasaConsulta } from "@/components/SerasaConsulta";

type TabType = "estoque" | "clientes" | "tabela_precos" | "catalogos" | "pedidos" | "vendas" | "configuracoes" | "aprovacoes";

interface DashboardItem {
  codigoItem: string;
  descricaoItem: string;
  grupo: string;
  subgrupo: string;
  unidadeMedida: string;
  estoqueUn: number;
  estoqueCx: number | null;
  unidadesPorCaixa: number | null;
  pedidosUn: number;
  pedidosCx: number | null;
  disponivelUn: number;
  disponivelCx: number | null;
  poCx: number | null;
  poUn: number;
  poEntregas: string[];
  poFornecedores: string[];
  poLotes: {
    numeroPedido: string;
    referenciaPO: string;
    tipoPO: string;
    quantidade: number;
    quantidadeUn: number;
    dataEntrega: string;
    fornecedor: string;
  }[];
  projetadoUn: number;
  projetadoCx: number | null;
  isKgProduct: boolean;
}

export interface VendedorDetalheProps {
  sellerMode?: boolean;
  externalSellerId?: number;
  onLogout?: () => void;
  [key: string]: any;
}

export default function VendedorDetalhe(props: VendedorDetalheProps = {}) {
  const { sellerMode = false, externalSellerId, onLogout, gestorSelfMode = false, gestorName: gestorNameProp } = props;
  const params = useParams<{ sellerId: string }>();
  const [, setLocation] = useLocation();
  const sellerId = externalSellerId || parseInt(params.sellerId || "0", 10);
  // Support opening a specific tab via URL search param ?tab=estoque&section=senha
  const urlParams = new URLSearchParams(window.location.search);
  const urlTab = urlParams.get("tab") as TabType | null;
  const urlSection = urlParams.get("section") as string | null;
  const validTabs: TabType[] = ["estoque", "clientes", "tabela_precos", "catalogos", "pedidos", "vendas", "configuracoes", "aprovacoes"];
  const defaultTab: TabType = gestorSelfMode ? "estoque" : (urlTab && validTabs.includes(urlTab) ? urlTab : "estoque");
  const [activeTab, setActiveTab] = useState<TabType>(urlTab && validTabs.includes(urlTab) ? urlTab : defaultTab);
  // Section filter for configuracoes tab: shows only the relevant sub-section
  const [configSection] = useState<string | null>(urlSection);
  // Seller alert count for blinking effect on "clientes" tab
  const [sellerAlertCount, setSellerAlertCount] = useState(0);

  // Buscar dados do vendedor
  const permissionsQuery = trpc.sales.listSellerPermissions.useQuery(undefined, {
    staleTime: 30 * 1000,
  });

    const seller = permissionsQuery.data?.find((p: any) => p.id === sellerId);
  const sellerNameForAlerts = seller?.sellerName || "";
  // Always-on query to check for pending alerts (even when not on clientes tab)
  const sellerAlertsQuery = trpc.cobrancaPlanilha.getSellerAlerts.useQuery(
    { vendedor: sellerNameForAlerts },
    { enabled: !!sellerNameForAlerts, staleTime: 5 * 1000, refetchInterval: 10 * 1000 }
  );
  useEffect(() => {
    if (sellerAlertsQuery.data) {
      const pending = sellerAlertsQuery.data.filter((a: any) => a.status === "pendente");
      setSellerAlertCount(pending.length);
    }
  }, [sellerAlertsQuery.data]);
  if (permissionsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <TopNav />
        <main className="container py-8">
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-teal-500 animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <TopNav />
        <main className="container py-8">
          <div className="text-center py-20">
            <p className="text-slate-500">Vendedor não encontrado.</p>
            <button
              onClick={() => setLocation("/gestao-comercial")}
              className="mt-4 text-teal-600 hover:text-teal-700 text-sm font-medium"
            >
              Voltar para Gestão Comercial
            </button>
          </div>
        </main>
      </div>
    );
  }

  const allTabs: { id: TabType; label: string; icon: typeof Package }[] = gestorSelfMode
    ? [
        { id: "estoque", label: "Estoque", icon: Package },
        { id: "tabela_precos", label: "Tabela de Preços", icon: Tag },
        { id: "catalogos", label: "Catálogos", icon: FolderOpen },
        { id: "vendas", label: "Comissão/Vendas", icon: BarChart3 },
        { id: "aprovacoes", label: "Aprovações", icon: ClipboardCheck },
      ]
    : [
        { id: "estoque", label: "Estoque", icon: Package },
        { id: "clientes", label: "Cadastro de Cliente", icon: UserPlus },
        { id: "tabela_precos", label: "Tabela de Preços", icon: Tag },
        { id: "catalogos", label: "Documentos/Catálogos", icon: FolderOpen },
        { id: "pedidos", label: "Pedidos de Venda", icon: ShoppingCart },
        { id: "vendas", label: "Vendas", icon: BarChart3 },
      ];

  const tabs = allTabs;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {!sellerMode && !gestorSelfMode && <TopNav />}

      <main className="container py-4 md:py-6 space-y-4 pb-20 md:pb-6">
        {/* Header com botão voltar e info do vendedor */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-3">
            {!sellerMode && !gestorSelfMode ? (
              <button
                onClick={() => setLocation("/gestao-comercial")}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : null}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
              {seller.sellerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 truncate">
                {seller.sellerName}
              </h1>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Gestor: {seller.gestorName}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
              seller.authorized
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            }`}>
              {seller.authorized ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Autorizado</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Bloqueado</span>
                </>
              )}
            </div>
            {sellerMode && (
              <button
                onClick={() => {
                  // Force reload all data from server (latest publication)
                  window.location.reload();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors ml-1 shadow-sm"
                title="Atualizar última versão"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="text-[10px] font-bold leading-tight">Atualizar</span>
              </button>
            )}
            {(sellerMode || gestorSelfMode) && onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors ml-1 shadow-sm"
                title={gestorSelfMode ? "Voltar ao Hub" : "Sair do aplicativo"}
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-[10px] font-bold leading-tight">{gestorSelfMode ? "Voltar" : "Sair"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Abas de navegação */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-1 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const hasAlert = tab.id === "vendas" && sellerAlertCount > 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                  hasAlert && !isActive
                    ? "bg-red-100 text-red-700 animate-pulse ring-2 ring-red-400 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                    : isActive
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 ${hasAlert && !isActive ? 'animate-bounce' : ''}`} />
                <span>{tab.label}</span>
                {hasAlert && (
                  <span className="ml-1 w-5 h-5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                    {sellerAlertCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Conteúdo das abas */}
        {activeTab === "estoque" && (
          <SellerStockView sellerId={sellerId} sellerName={seller.sellerName} />
        )}

        {activeTab === "clientes" && (
          <SellerClientsView sellerId={sellerId} sellerName={seller.sellerName} />
        )}



        {activeTab === "tabela_precos" && (
          <TabelaPrecosView sellerId={sellerId} sellerName={seller.sellerName} gestorName={seller.gestorName} />
        )}

        {activeTab === "catalogos" && (
          <SellerCatalogosView sellerId={sellerId} sellerName={seller.sellerName} />
        )}

        {activeTab === "pedidos" && (
          <SellerOrdersView sellerId={sellerId} sellerName={seller.sellerName} />
        )}


        {activeTab === "vendas" && (
          <SellerSalesView sellerId={sellerId} sellerName={seller.sellerName} gestorName={seller.gestorName} />
        )}

        {activeTab === "vendas" && (
          <SellerCobrancaView sellerName={seller.sellerName} onAlertCount={setSellerAlertCount} />
        )}

        {activeTab === "aprovacoes" && gestorSelfMode && (
          <GestorAprovacoesMini gestorName={gestorNameProp || seller.gestorName} />
        )}

      </main>
    </div>
  );
}

/**
 * Placeholder para abas em desenvolvimento
 */
function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 md:p-12">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
          <Construction className="w-7 h-7 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">{title}</h3>
        <p className="text-sm text-slate-400 dark:text-slate-500 max-w-sm">{description}</p>
      </div>
    </div>
  );
}

/**
 * ============================================================
 * ABA APROVAÇÕES - Mini painel de aprovação de pedidos (para gestorSelfMode)
 * Mostra pedidos dos vendedores subordinados filtrados por gestorName
 * ============================================================
 */
function GestorAprovacoesMini({ gestorName }: { gestorName: string }) {
  const [filter, setFilter] = useState<"todos" | "pendente" | "aprovado" | "rejeitado">("pendente");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingOrder, setApprovingOrder] = useState<number | null>(null);
  const [approvalObs, setApprovalObs] = useState("");
  const [approvalPassword, setApprovalPassword] = useState("");
  const [approvalPasswordError, setApprovalPasswordError] = useState("");

  const { data: orders, isLoading, refetch } = trpc.salesOrders.listOrders.useQuery(
    { status: filter === "todos" ? "todos" : filter, gestorName },
    { staleTime: 30 * 1000 }
  );

  const { data: orderDetails } = trpc.salesOrders.getOrderDetails.useQuery(
    { orderId: expandedOrder! },
    { enabled: expandedOrder !== null }
  );

  const approveMutation = trpc.salesOrders.approveOrder.useMutation();
  const rejectMutation = trpc.salesOrders.rejectOrder.useMutation();
  const utils = trpc.useUtils();

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
      { orderId: approvingOrder, aprovadoPor: gestorName, password: approvalPassword.trim(), observacaoAprovacao: approvalObs.trim() || undefined },
      {
        onSuccess: () => {
          utils.salesOrders.listOrders.invalidate();
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
      { orderId, aprovadoPor: gestorName, motivoRejeicao: rejectReason.trim() },
      {
        onSuccess: () => {
          utils.salesOrders.listOrders.invalidate();
          setRejectingOrder(null);
          setRejectReason("");
        },
      }
    );
  };

  const stats = {
    pendentes: orders?.filter((o: any) => o.status === "pendente").length || 0,
    aprovados: orders?.filter((o: any) => o.status === "aprovado").length || 0,
    rejeitados: orders?.filter((o: any) => o.status === "rejeitado").length || 0,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-amber-700">{stats.pendentes}</p>
          <p className="text-[10px] text-amber-600">Pendentes</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-emerald-700">{stats.aprovados}</p>
          <p className="text-[10px] text-emerald-600">Aprovados</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-red-700">{stats.rejeitados}</p>
          <p className="text-[10px] text-red-600">Rejeitados</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["pendente", "aprovado", "rejeitado", "todos"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filter === f ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f === "pendente" ? "Pendentes" : f === "aprovado" ? "Aprovados" : f === "rejeitado" ? "Rejeitados" : "Todos"}
          </button>
        ))}
        <button onClick={() => refetch()} className="ml-auto p-1.5 text-slate-400 hover:text-teal-600 rounded-lg cursor-pointer">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="w-5 h-5 text-teal-500 animate-spin" />
        </div>
      ) : !orders || orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Nenhum pedido {filter !== "todos" ? filter : ""} encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => (
            <div key={order.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
              order.status === "pendente" && order.temPrecoAbaixoMinimo
                ? "border-red-200"
                : order.status === "pendente"
                ? "border-amber-200"
                : order.status === "aprovado"
                ? "border-emerald-200"
                : "border-red-200"
            }`}>
              <div
                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">#{String(order.orderNumber || order.id).padStart(2, '0')}</span>
                      <span className="text-sm font-bold text-slate-800 truncate">{order.razaoSocial}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500">{order.sellerName}</span>
                      {order.municipio && <span className="text-[10px] text-slate-400">{order.municipio}/{order.uf}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">
                      {Number(order.totalPedido).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      order.status === "pendente" ? "bg-amber-100 text-amber-700"
                      : order.status === "aprovado_subgestor" ? "bg-orange-100 text-orange-700"
                      : order.status === "aprovado" ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                    }`}>
                      {order.status === "pendente" ? "AGUARDANDO" : order.status === "aprovado_subgestor" ? "AGUARDANDO GESTOR" : order.status === "aprovado" ? "APROVADO" : "REJEITADO"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {expandedOrder === order.id && orderDetails && (
                <div className="border-t border-slate-100 p-4 bg-slate-50">
                  <div className="space-y-2 mb-3">
                    {orderDetails.items.map((item: any) => (
                      <div key={item.id} className={`flex items-center justify-between text-xs p-2 rounded-lg ${
                        item.abaixoDoMinimo ? "bg-red-50 border border-red-100" : "bg-white border border-slate-100"
                      }`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-700 truncate">{item.descricaoItem}</p>
                          <p className="text-[10px] text-slate-400">{item.quantidade} {item.unidadeMedida || "CX"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{Number(item.precoUnitario).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                          {item.abaixoDoMinimo && item.precoMinimo && (
                            <p className="text-[10px] text-red-500">Mín: {Number(item.precoMinimo).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action buttons for pending orders */}
                  {order.status === "pendente" && (
                    <div className="flex gap-2 mt-3">
                      {rejectingOrder === order.id ? (
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Motivo da rejeição..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReject(order.id)}
                              disabled={!rejectReason.trim()}
                              className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer"
                            >
                              Confirmar Rejeição
                            </button>
                            <button
                              onClick={() => { setRejectingOrder(null); setRejectReason(""); }}
                              className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-medium cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : approvingOrder === order.id ? (
                        <div className="flex-1 space-y-2">
                          <label className="text-[10px] font-bold text-green-700 block">Senha de aprovação (obrigatória):</label>
                          <input
                            type="password"
                            value={approvalPassword}
                            onChange={(e) => { setApprovalPassword(e.target.value); setApprovalPasswordError(""); }}
                            placeholder="Digite sua senha (primeiro nome)"
                            className="w-full px-3 py-2 border border-green-200 rounded-lg text-xs bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                          />
                          {approvalPasswordError && (
                            <p className="text-[10px] text-red-500 font-medium">{approvalPasswordError}</p>
                          )}
                          <label className="text-[10px] font-bold text-green-700 block mt-1">Observação de aprovação (opcional):</label>
                          <textarea
                            value={approvalObs}
                            onChange={(e) => setApprovalObs(e.target.value)}
                            placeholder="Justifique a aprovação e/ou o preço praticado..."
                            rows={2}
                            className="w-full px-3 py-2 border border-green-200 rounded-lg text-xs bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={confirmApprove}
                              disabled={approveMutation.isPending}
                              className="flex-1 px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 disabled:opacity-50 cursor-pointer"
                            >
                              {approveMutation.isPending ? "Aprovando..." : "Confirmar Autorização"}
                            </button>
                            <button
                              onClick={() => { setApprovingOrder(null); setApprovalObs(""); setApprovalPassword(""); setApprovalPasswordError(""); }}
                              className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-medium cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleApprove(order.id)}
                            disabled={approveMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Aprovar
                          </button>
                          <button
                            onClick={() => setRejectingOrder(order.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            Rejeitar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ============================================================
 * ABA ESTOQUE - Mostra produtos ticados com dados reais
 * Disponível p/ Venda + POs projetadas
 * ============================================================
 */
function SellerStockView({ sellerId, sellerName }: { sellerId: number; sellerName: string }) {
  const [reservationItem, setReservationItem] = useState<DashboardItem | null>(null);
  const [reservationPO, setReservationPO] = useState<{ referencia: string; dataEntrega: string; quantidade: number } | null>(null);
  const [stockSearch, setStockSearch] = useState("");
  const [trackingUuid, setTrackingUuid] = useState<string | null>(null);
  const [trackingBl, setTrackingBl] = useState<string | null>(null);

  // Fetch tracking links for POs
  const trackingQuery = trpc.dashboard.getPoTrackingLinks.useQuery(undefined, { staleTime: 60_000 });

  // Produtos ticados para este vendedor
  const productsQuery = trpc.sales.getSellerProducts.useQuery({ sellerId });
  // Dados completos do dashboard (estoque, pedidos, POs)
  const stockQuery = trpc.dashboard.getData.useQuery(undefined, {
    staleTime: 2 * 60 * 1000,
  });
  // Resumo de reservas ativas
  const productCodes = useMemo(() => {
    if (!productsQuery.data) return [];
    return productsQuery.data.map((p: { productCode: string }) => p.productCode);
  }, [productsQuery.data]);
  const reservationSummary = trpc.sales.getReservationSummary.useQuery(
    { productCodes },
    { enabled: productCodes.length > 0, staleTime: 30 * 1000 }
  );
  const reservationsQuery = trpc.sales.listReservations.useQuery(
    { sellerId },
    { staleTime: 30 * 1000 }
  );

  const visibleProducts = useMemo(() => {
    if (!productsQuery.data || !stockQuery.data?.items) return [];
    const visibleCodes = new Set(productsQuery.data.map((p: { productCode: string }) => p.productCode));
    return (stockQuery.data.items as DashboardItem[]).filter(item => visibleCodes.has(item.codigoItem));
  }, [productsQuery.data, stockQuery.data]);

  const filteredProducts = useMemo(() => {
    if (!stockSearch.trim()) return visibleProducts;
    const s = stockSearch.toLowerCase().trim();
    return visibleProducts.filter(item => {
      const searchable = `${item.codigoItem} ${item.descricaoItem}`.toLowerCase();
      return searchable.includes(s);
    });
  }, [visibleProducts, stockSearch]);

  const madeiraProducts = useMemo(() =>
    filteredProducts.filter(item => item.grupo === "industrializacao" && item.subgrupo === "madeira"),
    [filteredProducts]
  );

  const QC_SELLER_CODES = ["00648", "00546", "00547", "00577", "00645", "00646", "00647", "00649"];
  const bambuProducts = useMemo(() =>
    filteredProducts.filter(item => item.grupo === "importacao_revenda" && item.subgrupo === "bambu" && !QC_SELLER_CODES.includes(item.codigoItem)),
    [filteredProducts]
  );
  const queijoCoalhoProducts = useMemo(() =>
    filteredProducts.filter(item => QC_SELLER_CODES.includes(item.codigoItem)),
    [filteredProducts]
  );

  if (productsQuery.isLoading || stockQuery.isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
        <div className="flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 text-teal-500 animate-spin" />
          <span className="text-sm text-slate-500">Carregando estoque...</span>
        </div>
      </div>
    );
  }

  if (visibleProducts.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
        <div className="text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Nenhum produto configurado</p>
          <p className="text-xs text-slate-400 mt-1">
            Vá na aba "Configurações" para selecionar os produtos visíveis para {sellerName}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de pesquisa */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código ou nome do produto..."
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
          />
          {stockSearch && (
            <button
              onClick={() => setStockSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {stockSearch && filteredProducts.length === 0 && (
          <p className="text-xs text-slate-400 mt-2 text-center">Nenhum produto encontrado para "{stockSearch}"</p>
        )}
      </div>

      {/* Madeira */}
      {madeiraProducts.length > 0 && (
        <StockCategorySection
          title="Madeira"
          items={madeiraProducts}
          color="amber"
          sellerName={sellerName}
          sellerId={sellerId}
          allowReserve={false}
          onReserve={() => {}}
          reservationSummary={reservationSummary.data || {}}
          trackingMap={trackingQuery.data?.trackingByPO || {}}
          onTrack={(uuid, bl) => { if (uuid) setTrackingUuid(uuid); else if (bl) setTrackingBl(bl); }}
        />
      )}

      {/* Bambu */}
      {bambuProducts.length > 0 && (
        <StockCategorySection
          title="Bambu (Importação)"
          items={bambuProducts}
          color="green"
          sellerName={sellerName}
          sellerId={sellerId}
          allowReserve={false}
          onReserve={() => {}}
          reservationSummary={reservationSummary.data || {}}
          trackingMap={trackingQuery.data?.trackingByPO || {}}
          onTrack={(uuid, bl) => { if (uuid) setTrackingUuid(uuid); else if (bl) setTrackingBl(bl); }}
        />
      )}
      {/* Queijo Coalho */}
      {queijoCoalhoProducts.length > 0 && (
        <StockCategorySection
          title="Queijo Coalho"
          items={queijoCoalhoProducts}
          color="teal"
          sellerName={sellerName}
          sellerId={sellerId}
          allowReserve={false}
          onReserve={() => {}}
          reservationSummary={reservationSummary.data || {}}
          trackingMap={trackingQuery.data?.trackingByPO || {}}
          onTrack={(uuid, bl) => { if (uuid) setTrackingUuid(uuid); else if (bl) setTrackingBl(bl); }}
        />
      )}

      {/* Reservas ativas */}
      {reservationsQuery.data && reservationsQuery.data.length > 0 && (
        <ReservationsPanel reservations={reservationsQuery.data} onCancelSuccess={() => {
          reservationsQuery.refetch();
          reservationSummary.refetch();
        }} />
      )}

      {/* Modal de Rastreio */}
      {(trackingUuid || trackingBl) && (
        <TrackingModal
          trackingUuid={trackingUuid}
          blNumber={trackingBl}
          onClose={() => { setTrackingUuid(null); setTrackingBl(null); }}
        />
      )}

      {/* Modal de Reserva */}
      {reservationItem && (
        <ReservationModal
          item={reservationItem}
          po={reservationPO}
          sellerId={sellerId}
          sellerName={sellerName}
          onClose={() => { setReservationItem(null); setReservationPO(null); }}
          onSuccess={() => {
            setReservationItem(null);
            setReservationPO(null);
            reservationsQuery.refetch();
            reservationSummary.refetch();
          }}
        />
      )}
    </div>
  );
}

/**
 * Seção de categoria de estoque com tabela de produtos
 */
function StockCategorySection({
  title,
  items,
  color,
  sellerName,
  sellerId,
  allowReserve,
  onReserve,
  reservationSummary,
  trackingMap,
  onTrack,
}: {
  title: string;
  items: DashboardItem[];
  color: "amber" | "green" | "teal";
  sellerName: string;
  sellerId: number;
  allowReserve: boolean;
  onReserve: (item: DashboardItem, po?: { referencia: string; dataEntrega: string; quantidade: number }) => void;
  reservationSummary: Record<string, number>;
  trackingMap: Record<string, { blNumber: string | null; trackingUuid: string | null; supplierName: string | null }>;
  onTrack: (uuid: string | null, bl: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  const colorClasses = {
    amber: {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      border: "border-amber-200 dark:border-amber-800",
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
      icon: "text-amber-600 dark:text-amber-400",
    },
    green: {
      bg: "bg-green-50 dark:bg-green-900/20",
      border: "border-green-200 dark:border-green-800",
      badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
      icon: "text-green-600 dark:text-green-400",
    },
    teal: {
      bg: "bg-teal-50 dark:bg-teal-900/20",
      border: "border-teal-200 dark:border-teal-800",
      badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
      icon: "text-teal-600 dark:text-teal-400",
    },
  };

  const colors = colorClasses[color];

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border ${colors.border} shadow-sm overflow-hidden`}>
      {/* Header da categoria */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-4 py-3 ${colors.bg} hover:opacity-90 transition-opacity cursor-pointer`}
      >
        <div className="flex items-center gap-2">
          <div className={colors.icon}>
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
            {items.length} produtos
          </span>
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {/* Mobile legend */}
          <div className="md:hidden px-4 py-2.5 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-600 space-y-1.5">
            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Legenda</p>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <ShoppingCart className="w-3 h-3 text-emerald-500 shrink-0" />
                <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">Disp.</span>
                <span className="text-[8px] text-slate-500 dark:text-slate-400">= Estoque físico − Pedidos de venda aprovados</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Ship className="w-3 h-3 text-blue-500 shrink-0" />
                <span className="text-[9px] font-semibold text-blue-700 dark:text-blue-300">PO</span>
                <span className="text-[8px] text-slate-500 dark:text-slate-400">= Pedidos de compra a caminho (reposição)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
                <span className="text-[9px] font-semibold text-purple-700 dark:text-purple-300">Proj.</span>
                <span className="text-[8px] text-slate-500 dark:text-slate-400">= Disponível + PO (estoque futuro)</span>
              </div>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-600 pt-1.5 mt-1">
              <div className="flex items-start gap-1.5">
                <span className="text-[9px] text-red-500 font-bold shrink-0">⚠️</span>
                <span className="text-[8px] text-red-600 dark:text-red-400 font-medium">Disp. negativo = pedidos aprovados excedem estoque (aguardando reposição/produção)</span>
              </div>
            </div>
          </div>
          {/* Header da tabela - desktop */}
          <div className={`hidden md:grid ${allowReserve ? 'md:grid-cols-12' : 'md:grid-cols-11'} gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-700/30 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider`}>
            <div className={allowReserve ? 'col-span-5' : 'col-span-5'}>Produto</div>
            <div className="col-span-2 text-center">Disponível</div>
            <div className="col-span-2 text-center">PO (chegando)</div>
            <div className="col-span-2 text-center">Projetado</div>
            {allowReserve && <div className="col-span-1 text-center">Ação</div>}
          </div>

          {items.map((item) => {
            const isPOExpanded = expandedPO === item.codigoItem;
            const dispCx = item.disponivelCx ?? 0;
            const poCx = item.poCx ?? 0;
            const projCx = item.projetadoCx ?? 0;

            return (
              <div key={item.codigoItem}>
                {/* Desktop row */}
                <div className={`hidden md:grid ${allowReserve ? 'md:grid-cols-12' : 'md:grid-cols-11'} gap-2 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors`}>
                  <div className="col-span-5">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-tight">
                      <span className="font-mono text-slate-400 dark:text-slate-500 mr-1">{item.codigoItem}</span>
                      {item.descricaoItem}
                    </p>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className={`text-sm font-bold ${
                      dispCx > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-orange-500"
                    }`}>
                      {dispCx.toLocaleString("pt-BR")} cx
                    </span>
                  </div>
                  <div className="col-span-2 text-center">
                    {poCx > 0 ? (
                      <button
                        onClick={() => setExpandedPO(isPOExpanded ? null : item.codigoItem)}
                        className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 cursor-pointer"
                      >
                        <Ship className="w-3 h-3" />
                        {poCx.toLocaleString("pt-BR")} cx
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {projCx.toLocaleString("pt-BR")} cx
                    </span>
                  </div>
                  {allowReserve && (
                    <div className="col-span-1 text-center">
                      {reservationSummary[item.codigoItem] > 0 && (
                        <span className="text-[9px] text-amber-600 font-bold block mt-0.5">
                          {reservationSummary[item.codigoItem]} res.
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Mobile row */}
                <div className="md:hidden px-4 py-3 space-y-1.5">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-tight">
                    <span className="font-mono text-slate-500 dark:text-slate-400 font-bold mr-1.5">{item.codigoItem}</span>
                    {item.descricaoItem}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="flex items-center gap-1.5">
                      <ShoppingCart className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Disp:</span>
                      <span className={`text-xs font-bold ${
                        dispCx > 0 ? "text-emerald-600 dark:text-emerald-400" : dispCx < 0 ? "text-red-600 dark:text-red-400" : "text-orange-500"
                      }`}>
                        {dispCx.toLocaleString("pt-BR")} cx
                      </span>
                    </div>
                    {poCx > 0 && (
                      <button
                        onClick={() => setExpandedPO(isPOExpanded ? null : item.codigoItem)}
                        className="flex items-center gap-1.5 cursor-pointer"
                      >
                        <Ship className="w-3 h-3 text-blue-500 shrink-0" />
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">PO:</span>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          +{poCx.toLocaleString("pt-BR")} cx
                        </span>
                      </button>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Proj:</span>
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                        {projCx.toLocaleString("pt-BR")} cx
                      </span>
                    </div>
                    {allowReserve && reservationSummary[item.codigoItem] > 0 && (
                      <span className="text-[9px] text-amber-600 font-bold">
                        {reservationSummary[item.codigoItem]} reservas
                      </span>
                    )}
                  </div>
                </div>

                {/* Detalhes da PO expandida */}
                {isPOExpanded && item.poLotes && item.poLotes.length > 0 && (
                  <div className="px-4 md:px-8 py-3 bg-blue-50/50 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900/30">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Ship className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase">
                        Pedidos de Compra (POs) chegando
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {item.poLotes.map((lote, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs bg-white dark:bg-slate-800 rounded-md px-2 sm:px-3 py-2 border border-blue-100 dark:border-blue-900/30">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {lote.referenciaPO || lote.numeroPedido}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300 font-medium">
                            {lote.quantidade.toLocaleString("pt-BR")} cx
                          </span>
                          {lote.dataEntrega && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Calendar className="w-3 h-3" />
                              {lote.dataEntrega}
                            </span>
                          )}
                          {lote.fornecedor && (
                            <span className="text-slate-400 hidden md:inline truncate max-w-[150px]">
                              {lote.fornecedor}
                            </span>
                          )}
                          {lote.tipoPO && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              lote.tipoPO === "COMERCIAL"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {lote.tipoPO}
                            </span>
                          )}
                          {/* Botão Rastrear - se PO tem tracking */}
                          {(() => {
                            const poKey = (lote.referenciaPO || lote.numeroPedido || "").toUpperCase();
                            const poMatch = poKey.match(/^PO0*(\d+)$/);
                            const normalizedKey = poMatch ? `PO${poMatch[1]}` : poKey;
                            const tracking = trackingMap[normalizedKey] || trackingMap[poKey];
                            if (!tracking) return null;
                            return (
                              <button
                                onClick={() => onTrack(tracking.trackingUuid, tracking.blNumber)}
                                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 sm:py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-700 rounded text-blue-700 dark:text-blue-400 text-[10px] font-medium transition-colors cursor-pointer"
                                title="Rastrear navio em tempo real"
                              >
                                <Navigation className="w-3 h-3" />
                                <span>Rastrear</span>
                              </button>
                            );
                          })()}
                          {allowReserve && (
                            <button
                              onClick={() => onReserve(item, {
                                referencia: lote.referenciaPO || lote.numeroPedido,
                                dataEntrega: lote.dataEntrega,
                                quantidade: lote.quantidade,
                              })}
                              className="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-1 px-2 py-1.5 sm:py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded text-[10px] font-medium hover:bg-teal-100 dark:hover:bg-teal-900/50 cursor-pointer"
                            >
                              <Bookmark className="w-3 h-3" />
                              Reservar
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * ============================================================
 * ABA CONFIGURAÇÕES - Autorização, senha, ticagem de produtos, catálogos
 * ============================================================
 */
function SellerConfigPanel({ sellerId, sellerName, seller, section }: { sellerId: number; sellerName: string; seller: any; section?: string | null }) {
  const toggleAuthMutation = trpc.sales.toggleSellerAuthorization.useMutation();
  const utils = trpc.useUtils();

  const handleToggleAuth = () => {
    toggleAuthMutation.mutate(
      { sellerId, authorized: !seller.authorized },
      {
        onSuccess: () => {
          utils.sales.listSellerPermissions.invalidate();
        },
      }
    );
  };

  // If a specific section is requested, show only that section
  const showSenha = !section || section === "senha";
  const showEstoque = !section || section === "estoque";
  const showCatalogos = !section || section === "catalogos";

  return (
    <div className="space-y-4">
      {/* Card de Autorização e Senha */}
      {showSenha && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Acesso e Credenciais</h3>
          </div>

          <div className="space-y-4">
            {/* Status de autorização */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Status de Acesso</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {seller.authorized ? "O vendedor pode acessar o app" : "O vendedor está bloqueado"}
                </p>
              </div>
              <button
                onClick={handleToggleAuth}
                disabled={toggleAuthMutation.isPending}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  seller.authorized
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400"
                    : "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-400"
                }`}
              >
                {seller.authorized ? (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Autorizado
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Bloqueado
                  </>
                )}
              </button>
            </div>

            {/* Senha */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Senha</p>
                <p className="text-xs text-slate-400 mt-0.5">Senha de acesso ao app do vendedor</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-600 rounded-lg border border-slate-200 dark:border-slate-500">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-200">
                  {seller.password}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card de Produtos Visíveis (ticagem) */}
      {showEstoque && <SellerProductsPanel sellerId={sellerId} sellerName={sellerName} />}

      {/* Card de PDFs/Catálogos */}
      {showCatalogos && <SellerCatalogsPanel sellerId={sellerId} sellerName={sellerName} />}
    </div>
  );
}

/**
 * Painel de ticagem de produtos visíveis (agora na aba Configurações)
 */
function SellerProductsPanel({ sellerId, sellerName }: { sellerId: number; sellerName: string }) {
  const productsQuery = trpc.sales.getSellerProducts.useQuery({ sellerId });
  const setProductsMutation = trpc.sales.setSellerProducts.useMutation();
  const utils = trpc.useUtils();

  const stockQuery = trpc.dashboard.getData.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["madeira", "bambu", "queijo_coalho"]));

  useEffect(() => {
    if (productsQuery.data && !initialized) {
      setSelectedProducts(new Set(productsQuery.data.map((p: { productCode: string }) => p.productCode)));
      setInitialized(true);
    }
  }, [productsQuery.data, initialized]);

  const toggleProduct = (code: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  interface SimpleStockItem {
    codigoItem: string;
    descricaoItem: string;
    grupo: string;
    subgrupo: string;
  }

  const QC_CODES = ["00648", "00546", "00547", "00577", "00645", "00646", "00647", "00649"];
  const stockItems: SimpleStockItem[] = (stockQuery.data?.items || []) as SimpleStockItem[];
  const madeiraItems = stockItems.filter((item) =>
    item.grupo === "industrializacao" && item.subgrupo === "madeira"
  );
  const bambuItems = stockItems.filter((item) =>
    item.grupo === "importacao_revenda" && item.subgrupo === "bambu" && !QC_CODES.includes(item.codigoItem)
  );
  const queijoCoalhoItems = stockItems.filter((item) =>
    QC_CODES.includes(item.codigoItem)
  );

  const selectAllCategory = (items: SimpleStockItem[]) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      items.forEach(item => next.add(item.codigoItem));
      return next;
    });
  };

  const deselectAllCategory = (items: SimpleStockItem[]) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      items.forEach(item => next.delete(item.codigoItem));
      return next;
    });
  };

  const saveProducts = () => {
    setProductsMutation.mutate(
      { sellerId, productCodes: Array.from(selectedProducts) },
      {
        onSuccess: () => {
          utils.sales.getSellerProducts.invalidate({ sellerId });
        },
      }
    );
  };

  const hasChanges = (() => {
    if (!productsQuery.data) return false;
    const current = new Set(productsQuery.data.map((p: { productCode: string }) => p.productCode));
    if (current.size !== selectedProducts.size) return true;
    const arr = Array.from(selectedProducts);
    for (let i = 0; i < arr.length; i++) {
      if (!current.has(arr[i])) return true;
    }
    return false;
  })();

  const countSelected = (items: SimpleStockItem[]) => items.filter(i => selectedProducts.has(i.codigoItem)).length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-teal-200 dark:border-teal-800 shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Produtos Visíveis</h3>
          <span className="text-[10px] text-slate-400 ml-1">
            {selectedProducts.size} selecionados
          </span>
        </div>
        {hasChanges && (
          <button
            onClick={saveProducts}
            disabled={setProductsMutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-3 h-3" />
            Salvar
          </button>
        )}
      </div>

      {stockQuery.isLoading ? (
        <p className="text-xs text-slate-400">Carregando produtos...</p>
      ) : (
        <div className="space-y-3">
          <ConfigCategorySection
            title="Madeira"
            items={madeiraItems}
            selectedProducts={selectedProducts}
            isExpanded={expandedCategories.has("madeira")}
            onToggleExpand={() => toggleCategory("madeira")}
            onToggleProduct={toggleProduct}
            onSelectAll={() => selectAllCategory(madeiraItems)}
            onDeselectAll={() => deselectAllCategory(madeiraItems)}
            countSelected={countSelected(madeiraItems)}
            color="amber"
          />
          <ConfigCategorySection
            title="Bambu"
            items={bambuItems}
            selectedProducts={selectedProducts}
            isExpanded={expandedCategories.has("bambu")}
            onToggleExpand={() => toggleCategory("bambu")}
            onToggleProduct={toggleProduct}
            onSelectAll={() => selectAllCategory(bambuItems)}
            onDeselectAll={() => deselectAllCategory(bambuItems)}
            countSelected={countSelected(bambuItems)}
            color="green"
          />
          <ConfigCategorySection
            title="Queijo Coalho"
            items={queijoCoalhoItems}
            selectedProducts={selectedProducts}
            isExpanded={expandedCategories.has("queijo_coalho")}
            onToggleExpand={() => toggleCategory("queijo_coalho")}
            onToggleProduct={toggleProduct}
            onSelectAll={() => selectAllCategory(queijoCoalhoItems)}
            onDeselectAll={() => deselectAllCategory(queijoCoalhoItems)}
            countSelected={countSelected(queijoCoalhoItems)}
            color="teal"
          />
        </div>
      )}

      {setProductsMutation.isSuccess && (
        <p className="text-[10px] text-emerald-600 mt-3">
          Produtos salvos com sucesso! ({selectedProducts.size} selecionados no total)
        </p>
      )}
    </div>
  );
}

/**
 * Seção de categoria com checkboxes (para Configurações)
 */
function ConfigCategorySection({
  title,
  items,
  selectedProducts,
  isExpanded,
  onToggleExpand,
  onToggleProduct,
  onSelectAll,
  onDeselectAll,
  countSelected,
  color,
}: {
  title: string;
  items: { codigoItem: string; descricaoItem: string }[];
  selectedProducts: Set<string>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleProduct: (code: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  countSelected: number;
  color: "amber" | "green" | "teal";
}) {
  const colorClasses = {
    amber: {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      border: "border-amber-200 dark:border-amber-800",
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
      icon: "text-amber-600 dark:text-amber-400",
    },
    green: {
      bg: "bg-green-50 dark:bg-green-900/20",
      border: "border-green-200 dark:border-green-800",
      badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
      icon: "text-green-600 dark:text-green-400",
    },
    teal: {
      bg: "bg-teal-50 dark:bg-teal-900/20",
      border: "border-teal-200 dark:border-teal-800",
      badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
      icon: "text-teal-600 dark:text-teal-400",
    },
  };

  const colors = colorClasses[color];

  return (
    <div className={`rounded-lg border ${colors.border} overflow-hidden`}>
      <button
        onClick={onToggleExpand}
        className={`w-full flex items-center justify-between px-3 py-2.5 ${colors.bg} hover:opacity-90 transition-opacity cursor-pointer`}
      >
        <div className="flex items-center gap-2">
          <div className={colors.icon}>
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{title}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors.badge}`}>
            {countSelected}/{items.length}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="bg-white dark:bg-slate-800">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100 dark:border-slate-700">
            <button
              onClick={(e) => { e.stopPropagation(); onSelectAll(); }}
              className="text-[10px] text-teal-600 hover:text-teal-800 font-medium cursor-pointer"
            >
              Todos
            </button>
            <span className="text-[10px] text-slate-300">|</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDeselectAll(); }}
              className="text-[10px] text-teal-600 hover:text-teal-800 font-medium cursor-pointer"
            >
              Nenhum
            </button>
          </div>

          {items.length > 0 ? (
            <div className="max-h-60 overflow-y-auto">
              {items.map((item) => (
                <label
                  key={item.codigoItem}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(item.codigoItem)}
                    onChange={() => onToggleProduct(item.codigoItem)}
                    className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer flex-shrink-0"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300 leading-tight">
                    <span className="font-mono font-semibold text-slate-500 dark:text-slate-400">{item.codigoItem}</span>
                    <span className="text-slate-400 mx-1">—</span>
                    <span className="font-medium">{item.descricaoItem}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 px-3 py-3">Nenhum produto nesta categoria.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Painel de gestão de Catálogos/PDFs visíveis para um vendedor
 */
function SellerCatalogsPanel({ sellerId, sellerName }: { sellerId: number; sellerName: string }) {
  const catalogsQuery = trpc.sales.listCatalogs.useQuery();
  const sellerCatalogsQuery = trpc.sales.getSellerCatalogs.useQuery({ sellerId });
  const setCatalogsMutation = trpc.sales.setSellerCatalogs.useMutation();
  const uploadMutation = trpc.sales.uploadCatalog.useMutation();
  const deleteMutation = trpc.sales.deleteCatalog.useMutation();
  const utils = trpc.useUtils();

  const [selectedCatalogs, setSelectedCatalogs] = useState<Set<number>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFolder, setUploadFolder] = useState("Catálogos");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (sellerCatalogsQuery.data && !initialized) {
      setSelectedCatalogs(new Set(sellerCatalogsQuery.data));
      setInitialized(true);
    }
  }, [sellerCatalogsQuery.data, initialized]);

  const toggleCatalog = (id: number) => {
    setSelectedCatalogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveCatalogs = () => {
    setCatalogsMutation.mutate(
      { sellerId, catalogIds: Array.from(selectedCatalogs) },
      {
        onSuccess: () => {
          utils.sales.getSellerCatalogs.invalidate({ sellerId });
        },
      }
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      if (!uploadName) {
        setUploadName(file.name.replace(/\.pdf$/i, ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadName) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await uploadMutation.mutateAsync({
          name: uploadName,
          folder: uploadFolder,
          fileBase64: base64,
          fileName: selectedFile.name,
        });
        utils.sales.listCatalogs.invalidate();
        setSelectedFile(null);
        setUploadName("");
        setShowUploadForm(false);
        setUploading(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch {
      setUploading(false);
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Excluir este PDF?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        utils.sales.listCatalogs.invalidate();
        setSelectedCatalogs(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
    });
  };

  const hasChanges = (() => {
    if (!sellerCatalogsQuery.data) return false;
    const current = new Set(sellerCatalogsQuery.data);
    if (current.size !== selectedCatalogs.size) return true;
    const arr = Array.from(selectedCatalogs);
    for (let i = 0; i < arr.length; i++) {
      if (!current.has(arr[i])) return true;
    }
    return false;
  })();

  const allCatalogs = catalogsQuery.data || [];
  const folders = Array.from(new Set(allCatalogs.map(c => c.folder)));

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-rose-200 dark:border-rose-800 shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-rose-600" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Catálogos / PDFs</h3>
          <span className="text-[10px] text-slate-400 ml-1">
            Visíveis para {sellerName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={saveCatalogs}
              disabled={setCatalogsMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-md hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3 h-3" />
              Salvar
            </button>
          )}
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
          >
            <Upload className="w-3 h-3" />
            Upload PDF
          </button>
        </div>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-100 dark:border-rose-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Novo PDF</span>
            <button onClick={() => setShowUploadForm(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Nome do catálogo"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-400 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            />
            <input
              type="text"
              placeholder="Pasta (ex: Catálogos)"
              value={uploadFolder}
              onChange={(e) => setUploadFolder(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-400 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            />
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer"
              >
                <FileText className="w-3 h-3" />
                {selectedFile ? selectedFile.name : "Escolher arquivo"}
              </button>
              {selectedFile && uploadName && (
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-md hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                >
                  {uploading ? "Enviando..." : "Enviar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lista de catálogos por pasta */}
      {catalogsQuery.isLoading ? (
        <p className="text-xs text-slate-400">Carregando catálogos...</p>
      ) : allCatalogs.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhum catálogo cadastrado. Use o botão "Upload PDF" para adicionar.</p>
      ) : (
        <div className="space-y-3">
          {folders.map(folder => (
            <div key={folder} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50">
                <FolderOpen className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{folder}</span>
                <span className="text-[10px] text-slate-400">
                  ({allCatalogs.filter(c => c.folder === folder).length} arquivos)
                </span>
              </div>
              <div className="bg-white dark:bg-slate-800 divide-y divide-slate-50 dark:divide-slate-700/50">
                {allCatalogs.filter(c => c.folder === folder).map(catalog => (
                  <label
                    key={catalog.id}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCatalogs.has(catalog.id)}
                      onChange={() => toggleCatalog(catalog.id)}
                      className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer flex-shrink-0"
                    />
                    <FileText className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium flex-1">{catalog.name}</span>
                    <a
                      href={catalog.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                    >
                      Ver
                    </a>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(catalog.id); }}
                      className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {setCatalogsMutation.isSuccess && (
        <p className="text-[10px] text-emerald-600 mt-3">
          Catálogos salvos com sucesso! ({selectedCatalogs.size} selecionados)
        </p>
      )}
    </div>
  );
}


/**
 * ============================================================
 * ABA CATÁLOGOS - Mostra apenas os catálogos que o gestor liberou
 * ============================================================
 */
function SellerCatalogosView({ sellerId, sellerName }: { sellerId: number; sellerName: string }) {
  const catalogsQuery = trpc.sales.listCatalogs.useQuery();
  const sellerCatalogsQuery = trpc.sales.getSellerCatalogs.useQuery({ sellerId });
  const [openFolderId, setOpenFolderId] = useState<number | null>(null);

  const visibleCatalogs = useMemo(() => {
    if (!catalogsQuery.data) return [];
    // Se não há restrições configuradas, mostrar TODOS os catálogos (mesma visão do gestor)
    if (!sellerCatalogsQuery.data || sellerCatalogsQuery.data.length === 0) {
      return catalogsQuery.data;
    }
    // Incluir os IDs permitidos E suas pastas-pai
    const allowedIds = new Set(sellerCatalogsQuery.data);
    // Encontrar pastas-pai dos arquivos permitidos e incluí-las
    const allItems = catalogsQuery.data;
    const expandedIds = new Set(allowedIds);
    for (const id of Array.from(allowedIds)) {
      const item = allItems.find(c => c.id === id);
      if (item && item.parentId) {
        expandedIds.add(item.parentId);
        // Também incluir avô (pasta raiz) se necessário
        const parent = allItems.find(c => c.id === item.parentId);
        if (parent && parent.parentId) {
          expandedIds.add(parent.parentId);
        }
      }
    }
    return allItems.filter(c => expandedIds.has(c.id));
  }, [catalogsQuery.data, sellerCatalogsQuery.data]);

  // Get root-level folders (isFolder=true, parentId=null)
  const rootFolders = useMemo(() => {
    return visibleCatalogs.filter(c => c.isFolder && (c.parentId === null || c.parentId === undefined));
  }, [visibleCatalogs]);

  // Get files inside a folder (parentId = folderId, isFolder=false)
  const getFilesInFolder = (folderId: number) => {
    return visibleCatalogs.filter(c => !c.isFolder && c.parentId === folderId);
  };

  // Count items in a folder (direct children)
  const countItemsInFolder = (folderId: number) => {
    return visibleCatalogs.filter(c => c.parentId === folderId).length;
  };

  if (catalogsQuery.isLoading || sellerCatalogsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (visibleCatalogs.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
        <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Nenhum documento disponível</h3>
        <p className="text-xs text-slate-400">O gestor ainda não liberou documentos para você. Entre em contato com seu gestor.</p>
      </div>
    );
  }

  // If a folder is open, show its contents
  if (openFolderId !== null) {
    const currentFolder = visibleCatalogs.find(c => c.id === openFolderId);
    const folderFiles = getFilesInFolder(openFolderId);
    const folderName = currentFolder?.name || "Pasta";
    return (
      <div className="space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setOpenFolderId(null)}
            className="flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>
          <span className="text-slate-300">|</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">Documentos/Catálogos</span>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-violet-600">{folderName}</span>
        </div>

        {/* Folder header */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-b border-slate-100 dark:border-slate-700">
            <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{folderName}</h3>
              <p className="text-[10px] text-slate-400">{folderFiles.length} {folderFiles.length === 1 ? 'documento' : 'documentos'}</p>
            </div>
          </div>

          {/* File list */}
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {folderFiles.map(catalog => (
              <div
                key={catalog.id}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{catalog.name}</p>
                  <p className="text-[10px] text-slate-400">PDF • {folderName}</p>
                </div>
                <a
                  href={catalog.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-semibold rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  Abrir PDF
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Main folder grid view - show root folders
  const totalFiles = visibleCatalogs.filter(c => !c.isFolder).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Documentos/Catálogos</h2>
          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
            {rootFolders.length} {rootFolders.length === 1 ? 'pasta' : 'pastas'} • {totalFiles} {totalFiles === 1 ? 'arquivo' : 'arquivos'}
          </span>
        </div>
      </div>

      {/* Folder cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rootFolders.map(folder => {
          const itemCount = countItemsInFolder(folder.id);
          return (
            <button
              key={folder.id}
              onClick={() => setOpenFolderId(folder.id)}
              className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FolderOpen className="w-6 h-6 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">{folder.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


/**
 * ============================================================
 * MODAL DE RESERVA - Permite reservar caixas de um produto
 * ============================================================
 */
function ReservationModal({
  item,
  po,
  sellerId,
  sellerName,
  onClose,
  onSuccess,
}: {
  item: DashboardItem;
  po: { referencia: string; dataEntrega: string; quantidade: number } | null;
  sellerId: number;
  sellerName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [clienteNome, setClienteNome] = useState("");
  const [clienteCnpj, setClienteCnpj] = useState("");
  const [quantidadeCx, setQuantidadeCx] = useState("");
  const [observacao, setObservacao] = useState("");
  const [error, setError] = useState("");

  const createMutation = trpc.sales.createReservation.useMutation();

  const handleSubmit = () => {
    setError("");
    const qty = parseInt(quantidadeCx, 10);
    if (!clienteNome.trim()) {
      setError("Informe o nome do cliente");
      return;
    }
    if (!qty || qty <= 0) {
      setError("Informe uma quantidade válida");
      return;
    }

    createMutation.mutate(
      {
        sellerId,
        sellerName,
        codigoItem: item.codigoItem,
        descricaoItem: item.descricaoItem,
        quantidadeCx: qty,
        clienteNome: clienteNome.trim(),
        clienteCnpj: clienteCnpj.trim() || undefined,
        fonte: po ? "po" : "estoque",
        poReferencia: po?.referencia || undefined,
        poDataEntrega: po?.dataEntrega || undefined,
        observacao: observacao.trim() || undefined,
      },
      {
        onSuccess: () => {
          onSuccess();
        },
        onError: (err) => {
          setError(err.message || "Erro ao criar reserva");
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Nova Reserva</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Produto info */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
            <span className="font-mono text-slate-400 mr-1">{item.codigoItem}</span>
            {item.descricaoItem}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-emerald-600 font-medium">
              Disponível: {(item.disponivelCx ?? 0).toLocaleString("pt-BR")} cx
            </span>
            {po && (
              <span className="text-[10px] text-blue-600 font-medium">
                PO {po.referencia}: {po.quantidade.toLocaleString("pt-BR")} cx ({po.dataEntrega})
              </span>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="p-4 space-y-3">
          {po && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <Ship className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <p className="text-[10px] text-blue-700 dark:text-blue-300">
                Reservando da <strong>PO {po.referencia}</strong> (previsão: {po.dataEntrega})
              </p>
            </div>
          )}

          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Cliente *
            </label>
            <input
              type="text"
              placeholder="Nome do cliente"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              CNPJ/CPF (opcional)
            </label>
            <input
              type="text"
              placeholder="00.000.000/0000-00"
              value={clienteCnpj}
              onChange={(e) => setClienteCnpj(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Quantidade (caixas) *
            </label>
            <input
              type="number"
              placeholder="Ex: 100"
              value={quantidadeCx}
              onChange={(e) => setQuantidadeCx(e.target.value)}
              min="1"
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Observação (opcional)
            </label>
            <textarea
              placeholder="Informações adicionais..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 font-medium">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="px-4 py-2 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            {createMutation.isPending ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Reservando...
              </>
            ) : (
              <>
                <Bookmark className="w-3 h-3" />
                Confirmar Reserva
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================
 * PAINEL DE RESERVAS ATIVAS
 * ============================================================
 */
function ReservationsPanel({
  reservations,
  onCancelSuccess,
}: {
  reservations: any[];
  onCancelSuccess: () => void;
}) {
  const cancelMutation = trpc.sales.cancelReservation.useMutation();

  const handleCancel = (id: number) => {
    if (!confirm("Cancelar esta reserva?")) return;
    cancelMutation.mutate(
      { id },
      { onSuccess: onCancelSuccess }
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20">
        <Bookmark className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Reservas Ativas
        </h3>
        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full">
          {reservations.length}
        </span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
        {reservations.map((r) => (
          <div key={r.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  <span className="font-mono text-slate-400 mr-1">{r.codigoItem}</span>
                  {r.descricaoItem}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs font-bold text-teal-600">
                    {r.quantidadeCx.toLocaleString("pt-BR")} cx
                  </span>
                  <span className="text-[10px] text-slate-400">→</span>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {r.clienteNome}
                  </span>
                  {r.fonte === "po" && r.poReferencia && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 font-medium">
                      PO {r.poReferencia}
                    </span>
                  )}
                  {r.poDataEntrega && (
                    <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      {r.poDataEntrega}
                    </span>
                  )}
                </div>
                {r.observacao && (
                  <p className="text-[10px] text-slate-400 mt-1 italic">{r.observacao}</p>
                )}
              </div>
              <button
                onClick={() => handleCancel(r.id)}
                disabled={cancelMutation.isPending}
                className="flex-shrink-0 p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                title="Cancelar reserva"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[9px] text-slate-300 mt-1">
              Reservado por {r.sellerName} em {new Date(r.createdAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}


/**
 * ============================================================
 * SellerSalesView - Métricas de vendas do vendedor
 * Usa salesMetrics.getVendedorRanking e getVendedorDetail
 * Filtros: Hoje, Semana, Mês Atual, Mês Anterior, 3 Meses, Personalizado
 * ============================================================
 */

type SalesPeriod = "day" | "week" | "month" | "prev_month" | "3months" | "custom";

const SALES_PERIODS: { label: string; value: SalesPeriod }[] = [
  { label: "Hoje", value: "day" },
  { label: "Semana", value: "week" },
  { label: "Mês Atual", value: "month" },
  { label: "Mês Anterior", value: "prev_month" },
  { label: "3 Meses", value: "3months" },
  { label: "Personalizado", value: "custom" },
];

function getSalesDateRange(period: SalesPeriod, customStart?: string, customEnd?: string): { startDate: string; endDate: string } {
  const now = new Date();
  const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const today = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, "0")}-${String(spNow.getDate()).padStart(2, "0")}`;

  switch (period) {
    case "day":
      return { startDate: today, endDate: today };
    case "week": {
      const dow = spNow.getDay();
      const mondayOff = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(spNow);
      monday.setDate(spNow.getDate() + mondayOff);
      const startDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      return { startDate, endDate: today };
    }
    case "month": {
      const startDate = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, "0")}-01`;
      return { startDate, endDate: today };
    }
    case "prev_month": {
      const prevMonth = new Date(spNow.getFullYear(), spNow.getMonth() - 1, 1);
      const lastDay = new Date(spNow.getFullYear(), spNow.getMonth(), 0);
      const startDate = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-01`;
      const endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
      return { startDate, endDate };
    }
    case "3months": {
      const threeMonthsAgo = new Date(spNow.getFullYear(), spNow.getMonth() - 2, 1);
      const startDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;
      return { startDate, endDate: today };
    }
    case "custom":
      return { startDate: customStart || today, endDate: customEnd || today };
  }
}

function formatCurrencySales(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDateSales(dateStr: string) {
  if (!dateStr) return "-";
  const datePart = dateStr.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

/**
 * ============================================================
 * ABA CADASTRO DE CLIENTE - Lista todos os clientes do vendedor
 * Dados combinados: sales_orders DB + GraphQL vendedorMap
 * ============================================================
 */
function SellerClientsView({ sellerId, sellerName }: { sellerId: number; sellerName: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"valor" | "pedidos" | "recente">("valor");
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

  const { data: clientes, isLoading } = trpc.salesMetrics.getClientesByVendedor.useQuery(
    { vendedor: sellerName },
    { staleTime: 2 * 60 * 1000 }
  );

  // Clientes cadastrados manualmente
  const { data: manualClients, refetch: refetchManual } = trpc.sales.listVendorClients.useQuery(
    { sellerId },
    { staleTime: 60 * 1000 }
  );

  const filteredClientes = useMemo(() => {
    if (!clientes) return [];
    let result = [...clientes];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      result = result.filter(
        (c) =>
          c.cliente.toUpperCase().includes(q) ||
          (c.razaoSocial || "").toUpperCase().includes(q) ||
          (c.cidade || "").toUpperCase().includes(q) ||
          (c.uf || "").toUpperCase().includes(q) ||
          (c.segmento || "").toUpperCase().includes(q)
      );
    }
    // Sort
    switch (sortBy) {
      case "valor":
        result.sort((a, b) => b.totalVendas - a.totalVendas);
        break;
      case "pedidos":
        result.sort((a, b) => b.qtdPedidos - a.qtdPedidos);
        break;
      case "recente":
        result.sort((a, b) => (b.ultimoPedido || "").localeCompare(a.ultimoPedido || ""));
        break;
    }
    return result;
  }, [clientes, searchQuery, sortBy]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
        <div className="flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 text-teal-500 animate-spin" />
          <span className="text-sm text-slate-500">Carregando clientes...</span>
        </div>
      </div>
    );
  }

  if (!clientes || clientes.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
          <div className="text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">Nenhum cliente encontrado</p>
            <p className="text-xs text-slate-400 mt-1">
              Não há pedidos de venda registrados para {sellerName}.
            </p>
            <button
              onClick={() => setShowNewClientForm(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Novo Cliente
            </button>
          </div>
        </div>

        {/* Formulário de Cadastro/Edição de Cliente */}
        {(showNewClientForm || editingClient) && (
          <NewClientForm
            sellerId={sellerId}
            sellerName={sellerName}
            onClose={() => { setShowNewClientForm(false); setEditingClient(null); }}
            onSuccess={() => {
              setShowNewClientForm(false);
              setEditingClient(null);
              refetchManual();
            }}
            editClient={editingClient}
          />
        )}

        {/* Clientes cadastrados manualmente */}
        {manualClients && manualClients.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Clientes Cadastrados</p>
            <div className="space-y-2">
              {manualClients.map((client: any) => (
                <ManualClientRow key={client.id} client={client} onDeleted={refetchManual} onEdit={(c) => setEditingClient(c)} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const totalClientes = (clientes?.length || 0) + (manualClients?.length || 0);
  const totalVendasGeral = clientes?.reduce((sum, c) => sum + c.totalVendas, 0) || 0;
  const totalPedidosGeral = clientes?.reduce((sum, c) => sum + c.qtdPedidos, 0) || 0;

  return (
    <div className="space-y-4">
      {/* Header com KPIs + Botão Cadastrar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Clientes de {sellerName}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {totalClientes} cliente{totalClientes !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1">
                <ShoppingCart className="w-3.5 h-3.5" />
                {totalPedidosGeral} pedidos
              </span>
              <span className="flex items-center gap-1 font-medium text-green-600">
                <DollarSign className="w-3.5 h-3.5" />
                {formatCurrencySales(totalVendasGeral)}
              </span>
            </div>
            <button
              onClick={() => setShowNewClientForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Novo Cliente
            </button>
          </div>
        </div>

        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cliente por nome, cidade, UF ou segmento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 whitespace-nowrap">Ordenar:</span>
            {(["valor", "pedidos", "recente"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                  sortBy === s
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50"
                }`}
              >
                {s === "valor" ? "Valor" : s === "pedidos" ? "Pedidos" : "Recente"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Formulário de Cadastro/Edição de Cliente */}
      {(showNewClientForm || editingClient) && (
        <NewClientForm
          sellerId={sellerId}
          sellerName={sellerName}
          onClose={() => { setShowNewClientForm(false); setEditingClient(null); }}
          onSuccess={() => {
            setShowNewClientForm(false);
            setEditingClient(null);
            refetchManual();
          }}
          editClient={editingClient}
        />
      )}

      {/* Clientes cadastrados manualmente */}
      {manualClients && manualClients.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-teal-200 dark:border-teal-700 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-100 dark:border-teal-800">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold text-teal-700 dark:text-teal-400">Clientes Cadastrados ({manualClients.length})</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {manualClients
              .filter((mc) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.trim().toUpperCase();
                return (
                  mc.razaoSocial.toUpperCase().includes(q) ||
                  (mc.nomeFantasia || "").toUpperCase().includes(q) ||
                  (mc.cidade || "").toUpperCase().includes(q) ||
                  (mc.uf || "").toUpperCase().includes(q) ||
                  (mc.segmento || "").toUpperCase().includes(q) ||
                  mc.cnpjCpf.includes(q)
                );
              })
              .map((mc) => (
                <ManualClientRow key={mc.id} client={mc} onDeleted={refetchManual} onEdit={(c) => setEditingClient(c)} />
              ))}
          </div>
        </div>
      )}

      {/* Lista de clientes */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {filteredClientes.length === 0 ? (
          <div className="p-8 text-center">
            <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhum cliente encontrado para "{searchQuery}"</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredClientes.map((client, idx) => (
              <ClientRow key={client.cliente} client={client} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientRow({ client, index }: { client: {
  cliente: string;
  razaoSocial: string;
  uf: string;
  segmento: string;
  totalVendas: number;
  qtdPedidos: number;
  primeiroPedido: string;
  ultimoPedido: string;
  telefone: string;
  email: string;
  cidade: string;
  endereco: string;
}; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left cursor-pointer"
      >
        <span className="text-[10px] font-bold text-slate-400 w-5 text-right flex-shrink-0">
          {index + 1}.
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
              {client.cliente}
            </p>
            {client.uf && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0">
                {client.uf}
              </span>
            )}
            {client.segmento && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 flex-shrink-0 hidden sm:inline">
                {client.segmento}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-400">
              {client.qtdPedidos} pedido{client.qtdPedidos !== 1 ? "s" : ""}
            </span>
            {client.ultimoPedido && (
              <span className="text-[10px] text-slate-400">
                · Último: {formatDateSales(client.ultimoPedido)}
              </span>
            )}
            {client.cidade && (
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                · {client.cidade}
              </span>
            )}
          </div>
        </div>
        <div className="text-right ml-3 flex-shrink-0">
          <p className="text-xs md:text-sm font-bold text-green-700 dark:text-green-400">
            {formatCurrencySales(client.totalVendas)}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${
          expanded ? "rotate-180" : ""
        }`} />
      </button>

      {/* Detalhes expandidos */}
      {expanded && (
        <div className="px-4 pb-3 ml-8 border-l-2 border-teal-200 dark:border-teal-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {client.razaoSocial && client.razaoSocial !== client.cliente && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Razão Social:</span>
                <span className="text-slate-600 dark:text-slate-300 truncate">{client.razaoSocial}</span>
              </div>
            )}
            {client.endereco && (
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600 dark:text-slate-300">{client.endereco}</span>
              </div>
            )}
            {client.telefone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <a href={`tel:${client.telefone}`} className="text-teal-600 hover:underline">{client.telefone}</a>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <a href={`mailto:${client.email}`} className="text-teal-600 hover:underline truncate">{client.email}</a>
              </div>
            )}
            {client.primeiroPedido && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="text-slate-400 font-medium">Cliente desde:</span>
                <span className="text-slate-600 dark:text-slate-300">{formatDateSales(client.primeiroPedido)}</span>
              </div>
            )}
            {client.segmento && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Segmento:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.segmento}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Formulário de cadastro de novo cliente
 */
function NewClientForm({ sellerId, sellerName, onClose, onSuccess, editClient }: {
  sellerId: number;
  sellerName: string;
  onClose: () => void;
  onSuccess: () => void;
  editClient?: any;
}) {
  const { operator } = useOperator();
  const isGuilherme = operator?.name === "Guilherme";
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState(""); // ddmmaaaa para consulta CPF
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [telefone1, setTelefone1] = useState("");
  const [telefone2, setTelefone2] = useState("");
  const [email, setEmail] = useState("");
  const [nomeContato, setNomeContato] = useState("");
  const [segmento, setSegmento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [tipoContribuinte, setTipoContribuinte] = useState<string>("");
  // showContribuinteCard removido - contribuinte agora é auto-determinado pela IE
  // Dados fiscais
  const [regimeTributario, setRegimeTributario] = useState("");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [inscricaoSuframa, setInscricaoSuframa] = useState("");
  const [situacaoFiscalEspecial, setSituacaoFiscalEspecial] = useState("");
  const [cnaeFiscal, setCnaeFiscal] = useState("");
  const [emailNfe, setEmailNfe] = useState("");
  const [website, setWebsite] = useState("");
  // Dados de venda
  const [limiteCredito, setLimiteCredito] = useState("");
  const [formaCobranca, setFormaCobranca] = useState("");
  const [tabelaPrecos, setTabelaPrecos] = useState("");
  const [condicaoPagamento, setCondicaoPagamento] = useState("");
  // CRM
  const [regiao, setRegiao] = useState("");
  const [perfil, setPerfil] = useState("");
  const [formaPedido, setFormaPedido] = useState("");
  const [produtos, setProdutos] = useState("");
  const [probabilidadeNegocio, setProbabilidadeNegocio] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [atencao, setAtencao] = useState("");
  const [fornecedorAtual, setFornecedorAtual] = useState("");
  // Cobrança
  const [situacaoCobranca, setSituacaoCobranca] = useState("");
  // Redespacho
  const [possuiRedespacho, setPossuiRedespacho] = useState<boolean | null>(null);
  const [redespachoCnpj, setRedespachoCnpj] = useState("");
  const [redespachoRazaoSocial, setRedespachoRazaoSocial] = useState("");
  const [redespachoCep, setRedespachoCep] = useState("");
  const [redespachoLogradouro, setRedespachoLogradouro] = useState("");
  const [redespachoNumero, setRedespachoNumero] = useState("");
  const [redespachoComplemento, setRedespachoComplemento] = useState("");
  const [redespachoBairro, setRedespachoBairro] = useState("");
  const [redespachoCidade, setRedespachoCidade] = useState("");
  const [redespachoUf, setRedespachoUf] = useState("");
  const [redespachoTelefone, setRedespachoTelefone] = useState("");
  // Endereço de entrega
  const [enderecoEntregaMesmo, setEnderecoEntregaMesmo] = useState<boolean | null>(null);
  const [entregaCep, setEntregaCep] = useState("");
  const [entregaLogradouro, setEntregaLogradouro] = useState("");
  const [entregaNumero, setEntregaNumero] = useState("");
  const [entregaComplemento, setEntregaComplemento] = useState("");
  const [entregaBairro, setEntregaBairro] = useState("");
  const [entregaCidade, setEntregaCidade] = useState("");
  const [entregaUf, setEntregaUf] = useState("");
  const [entregaTelefone, setEntregaTelefone] = useState("");
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  // Edit mode: when CNPJ duplicate is detected and user confirms edit
  const [editMode, setEditMode] = useState(false);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ clientId: number; razaoSocial: string; sellerName: string } | null>(null);

  const createMutation = trpc.sales.createVendorClient.useMutation();
  const updateMutation = trpc.sales.updateVendorClient.useMutation();

  // Hydrate form when editClient prop is provided (edit from card)
  useEffect(() => {
    if (editClient) {
      setEditMode(true);
      setEditingClientId(editClient.id);
      setCnpjCpf(editClient.cnpjCpf || "");
      setRazaoSocial(editClient.razaoSocial || "");
      setNomeFantasia(editClient.nomeFantasia || "");
      setInscricaoEstadual(editClient.inscricaoEstadual || "");
      setCep(editClient.cep || "");
      setLogradouro(editClient.logradouro || "");
      setNumero(editClient.numero || "");
      setComplemento(editClient.complemento || "");
      setBairro(editClient.bairro || "");
      setCidade(editClient.cidade || "");
      setUf(editClient.uf || "");
      setTelefone1(editClient.telefone1 || "");
      setTelefone2(editClient.telefone2 || "");
      setEmail(editClient.email || "");
      setNomeContato(editClient.nomeContato || "");
      setSegmento(editClient.segmento || "");
      setObservacoes(editClient.observacoes || "");
      setRegimeTributario(editClient.regimeTributario || "");
      setInscricaoMunicipal(editClient.inscricaoMunicipal || "");
      setInscricaoSuframa(editClient.inscricaoSuframa || "");
      setSituacaoFiscalEspecial(editClient.situacaoFiscalEspecial || "");
      setCnaeFiscal(editClient.cnaeFiscal || "");
      setEmailNfe(editClient.emailNfe || "");
      setWebsite(editClient.website || "");
      setLimiteCredito(editClient.limiteCredito || "");
      setFormaCobranca(editClient.formaCobranca || "");
      setTabelaPrecos(editClient.tabelaPrecos || "");
      setCondicaoPagamento(editClient.condicaoPagamento || "");
      setRegiao(editClient.regiao || "");
      setPerfil(editClient.perfil || "");
      setFormaPedido(editClient.formaPedido || "");
      setProdutos(editClient.produtos || "");
      setProbabilidadeNegocio(editClient.probabilidadeNegocio || "");
      setTamanho(editClient.tamanho || "");
      setAtencao(editClient.atencao || "");
      setFornecedorAtual(editClient.fornecedorAtual || "");
      setSituacaoCobranca(editClient.situacaoCobranca || "");
      setPossuiRedespacho(editClient.possuiRedespacho === 1 ? true : editClient.possuiRedespacho === 0 ? false : null);
      setRedespachoCep(editClient.redespachoCep || "");
      setRedespachoLogradouro(editClient.redespachoLogradouro || "");
      setRedespachoNumero(editClient.redespachoNumero || "");
      setRedespachoComplemento(editClient.redespachoComplemento || "");
      setRedespachoBairro(editClient.redespachoBairro || "");
      setRedespachoCidade(editClient.redespachoCidade || "");
      setRedespachoUf(editClient.redespachoUf || "");
      setRedespachoTelefone(editClient.redespachoTelefone || "");
      setRedespachoCnpj(editClient.redespachoCnpj || "");
      setRedespachoRazaoSocial(editClient.redespachoRazaoSocial || "");
      setEnderecoEntregaMesmo(editClient.enderecoEntregaMesmo !== 0 && editClient.enderecoEntregaMesmo !== false ? true : false);
      setEntregaCep(editClient.entregaCep || "");
      setEntregaLogradouro(editClient.entregaLogradouro || "");
      setEntregaNumero(editClient.entregaNumero || "");
      setEntregaComplemento(editClient.entregaComplemento || "");
      setEntregaBairro(editClient.entregaBairro || "");
      setEntregaCidade(editClient.entregaCidade || "");
      setEntregaUf(editClient.entregaUf || "");
      setEntregaTelefone(editClient.entregaTelefone || "");
    }
  }, [editClient]);

  // Auto-consulta CNPJ/CPF via SintegraWS (client-side)
  const cleanDoc = cnpjCpf.replace(/\D/g, "");
  const isCnpj = cleanDoc.length >= 14;
  const isCpf = cleanDoc.length === 11;
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false);
  const [cnpjLookupDone, setCnpjLookupDone] = useState(false);
  const [cpfLookupError, setCpfLookupError] = useState<string | null>(null);
  const lastLookedUpCnpj = useRef("");

  // CNPJ: consulta automática quando 14 dígitos
  useEffect(() => {
    const cleanCnpj = cnpjCpf.replace(/\D/g, "");
    if (cleanCnpj.length === 14 && cleanCnpj !== lastLookedUpCnpj.current && !editMode) {
      lastLookedUpCnpj.current = cleanCnpj;
      setCnpjLookupLoading(true);
      setCnpjLookupDone(false);
      const SINTEGRA_TOKEN = (import.meta as any).env?.VITE_SINTEGRA_API_TOKEN || "";
      const SINTEGRA_BASE = "https://www.sintegraws.com.br/api/v1/execute-api.php";
      Promise.allSettled([
        fetch(`${SINTEGRA_BASE}?token=${SINTEGRA_TOKEN}&cnpj=${cleanCnpj}&plugin=RF`).then(r => r.json()),
        fetch(`${SINTEGRA_BASE}?token=${SINTEGRA_TOKEN}&cnpj=${cleanCnpj}&plugin=ST`).then(r => r.json()),
      ]).then(([rfRes, stRes]) => {
        const rfData = rfRes.status === "fulfilled" ? rfRes.value : null;
        const stData = stRes.status === "fulfilled" ? stRes.value : null;
        if (rfData && rfData.code === "0") {
          if (rfData.nome && !razaoSocial) setRazaoSocial(rfData.nome);
          if (rfData.fantasia && rfData.fantasia !== "********" && !nomeFantasia) setNomeFantasia(rfData.fantasia);
          if (rfData.cep && !cep) setCep(rfData.cep.replace(/[^\d]/g, ""));
          if (rfData.logradouro && !logradouro) setLogradouro(rfData.logradouro);
          if (rfData.numero && !numero) setNumero(rfData.numero);
          if (rfData.complemento && !complemento) setComplemento(rfData.complemento);
          if (rfData.bairro && !bairro) setBairro(rfData.bairro);
          if (rfData.municipio && !cidade) setCidade(rfData.municipio);
          if (rfData.uf && !uf) setUf(rfData.uf);
          if (rfData.telefone && !telefone1) setTelefone1(rfData.telefone);
          if (rfData.email && !email) setEmail(rfData.email);
          if (rfData.atividade_principal?.[0]?.code && !cnaeFiscal) setCnaeFiscal(rfData.atividade_principal[0].code);
        }
        if (stData && stData.code === "0") {
          if (stData.inscricao_estadual) setInscricaoEstadual(stData.inscricao_estadual);
          if (stData.contribuinte_icms === true) {
            setTipoContribuinte("Contribuinte");
          } else if (stData.inscricao_estadual?.toUpperCase() === "ISENTO") {
            setTipoContribuinte("Isento");
          } else if (stData.inscricao_estadual && stData.situacao_ie === "Ativo") {
            setTipoContribuinte("Contribuinte");
          } else {
            setTipoContribuinte("Não contribuinte");
          }
          if (stData.regime_tributacao && !regimeTributario) setRegimeTributario(stData.regime_tributacao);
        } else {
          setTipoContribuinte("Não contribuinte");
        }
        setCnpjLookupDone(true);
        setTimeout(() => setCnpjLookupDone(false), 3000);
      }).catch(() => {}).finally(() => setCnpjLookupLoading(false));
    }
  }, [cnpjCpf]);

  // CPF: consulta quando data de nascimento é preenchida (8 dígitos)
  const lastLookedUpCpf = useRef("");
  useEffect(() => {
    const cleanCpf = cnpjCpf.replace(/\D/g, "");
    const cleanDt = dataNascimento.replace(/\D/g, "");
    const lookupKey = `${cleanCpf}_${cleanDt}`;
    if (cleanCpf.length === 11 && cleanDt.length === 8 && lookupKey !== lastLookedUpCpf.current && !editMode) {
      lastLookedUpCpf.current = lookupKey;
      setCnpjLookupLoading(true);
      setCnpjLookupDone(false);
      setCpfLookupError(null);
      const SINTEGRA_TOKEN = (import.meta as any).env?.VITE_SINTEGRA_API_TOKEN || "";
      const SINTEGRA_BASE = "https://www.sintegraws.com.br/api/v1/execute-api.php";
      fetch(`${SINTEGRA_BASE}?token=${SINTEGRA_TOKEN}&cpf=${cleanCpf}&data-nascimento=${cleanDt}&plugin=CPF`)
        .then(r => r.json())
        .then((cpfData) => {
          if (cpfData && cpfData.code === "0") {
            if (cpfData.nome && !razaoSocial) setRazaoSocial(cpfData.nome);
            // CPF é pessoa física - sempre Não contribuinte de ICMS
            setTipoContribuinte("Não contribuinte");
            // UF pode vir no array
            if (cpfData.uf && cpfData.uf.length > 0 && !uf) setUf(cpfData.uf[0]);
            setCnpjLookupDone(true);
            setTimeout(() => setCnpjLookupDone(false), 3000);
          } else if (cpfData && cpfData.code === "9") {
            setCpfLookupError("Data de nascimento divergente da Receita Federal.");
          } else {
            setCpfLookupError(cpfData?.message || "CPF não encontrado na Receita Federal.");
          }
        })
        .catch(() => {
          setCpfLookupError("Erro de conexão com SintegraWS.");
        })
        .finally(() => setCnpjLookupLoading(false));
    }
  }, [cnpjCpf, dataNascimento]);

  const handleSave = async () => {
    // Campos obrigatórios que bloqueiam: CNPJ, CEP, Telefone 1, Email (exceto Guilherme)
    if (!isGuilherme) {
      const strictMissing: string[] = [];
      if (!cnpjCpf.trim()) strictMissing.push("CNPJ/CPF");
      if (!cep.trim()) strictMissing.push("CEP");
      if (!uf.trim()) strictMissing.push("UF (estado)");
      if (!telefone1.trim()) strictMissing.push("Telefone 1");
      if (!email.trim()) strictMissing.push("E-mail");
      // Perguntas obrigatórias: devem ser respondidas (Sim ou Não)
      if (possuiRedespacho === null) strictMissing.push("Possui redespacho? (selecione Sim ou Não)");
      if (enderecoEntregaMesmo === null) strictMissing.push("Endereço de entrega (selecione Sim ou Não)");
      // Redespacho: CNPJ e Razão Social obrigatórios
      if (possuiRedespacho === true) {
        if (!redespachoCnpj.trim()) strictMissing.push("CNPJ do Redespacho");
        if (!redespachoRazaoSocial.trim()) strictMissing.push("Razão Social do Redespacho");
      }
      // Endereço de entrega diferente: CEP e Telefone obrigatórios
      if (enderecoEntregaMesmo === false) {
        if (!entregaCep.trim()) strictMissing.push("CEP da Entrega");
        if (!entregaTelefone.trim()) strictMissing.push("Telefone da Entrega");
      }
      if (strictMissing.length > 0) {
        setError(`Campos obrigatórios não preenchidos: ${strictMissing.join(", ")}`);
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      await createMutation.mutateAsync({
        sellerId,
        sellerName,
        cnpjCpf: cnpjCpf.trim(),
        razaoSocial: razaoSocial.trim(),
        nomeFantasia: nomeFantasia.trim() || undefined,
        inscricaoEstadual: inscricaoEstadual.trim() || undefined,
        cep: cep.trim() || undefined,
        logradouro: logradouro.trim() || undefined,
        numero: numero.trim() || undefined,
        complemento: complemento.trim() || undefined,
        bairro: bairro.trim() || undefined,
        cidade: cidade.trim() || undefined,
        uf: uf.trim() || undefined,
        telefone1: telefone1.trim() || undefined,
        telefone2: telefone2.trim() || undefined,
        email: email.trim() || undefined,
        nomeContato: nomeContato.trim() || undefined,
        segmento: segmento || undefined,
        observacoes: observacoes.trim() || undefined,
        tipoContribuinte: tipoContribuinte || undefined,
        regimeTributario: regimeTributario || undefined,
        inscricaoMunicipal: inscricaoMunicipal.trim() || undefined,
        inscricaoSuframa: inscricaoSuframa.trim() || undefined,
        situacaoFiscalEspecial: situacaoFiscalEspecial || undefined,
        cnaeFiscal: cnaeFiscal.trim() || undefined,
        emailNfe: emailNfe.trim() || undefined,
        website: website.trim() || undefined,
        limiteCredito: limiteCredito.trim() || undefined,
        formaCobranca: formaCobranca || undefined,
        tabelaPrecos: tabelaPrecos || undefined,
        condicaoPagamento: condicaoPagamento.trim() || undefined,
        regiao: regiao || undefined,
        perfil: perfil || undefined,
        formaPedido: formaPedido || undefined,
        produtos: produtos.trim() || undefined,
        probabilidadeNegocio: probabilidadeNegocio || undefined,
        tamanho: tamanho || undefined,
        atencao: atencao || undefined,
        fornecedorAtual: fornecedorAtual.trim() || undefined,
        situacaoCobranca: situacaoCobranca || undefined,
        possuiRedespacho: possuiRedespacho === true ? true : undefined,
        redespachoCnpj: redespachoCnpj.trim() || undefined,
        redespachoRazaoSocial: redespachoRazaoSocial.trim() || undefined,
        redespachoCep: redespachoCep.trim() || undefined,
        redespachoLogradouro: redespachoLogradouro.trim() || undefined,
        redespachoNumero: redespachoNumero.trim() || undefined,
        redespachoComplemento: redespachoComplemento.trim() || undefined,
        redespachoBairro: redespachoBairro.trim() || undefined,
        redespachoCidade: redespachoCidade.trim() || undefined,
        redespachoUf: redespachoUf.trim() || undefined,
        redespachoTelefone: redespachoTelefone.trim() || undefined,
        enderecoEntregaMesmo: enderecoEntregaMesmo ?? true,
        entregaCep: !enderecoEntregaMesmo ? entregaCep.trim() || undefined : undefined,
        entregaLogradouro: !enderecoEntregaMesmo ? entregaLogradouro.trim() || undefined : undefined,
        entregaNumero: !enderecoEntregaMesmo ? entregaNumero.trim() || undefined : undefined,
        entregaComplemento: !enderecoEntregaMesmo ? entregaComplemento.trim() || undefined : undefined,
        entregaBairro: !enderecoEntregaMesmo ? entregaBairro.trim() || undefined : undefined,
        entregaCidade: !enderecoEntregaMesmo ? entregaCidade.trim() || undefined : undefined,
        entregaUf: !enderecoEntregaMesmo ? entregaUf.trim() || undefined : undefined,
        entregaTelefone: !enderecoEntregaMesmo ? entregaTelefone.trim() || undefined : undefined,
      });
      onSuccess();
    } catch (e: any) {
      // Check if this is a CNPJ duplicate conflict with structured data
      const errMsg = e.message || "";
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed.type === "CNPJ_DUPLICATE") {
          setDuplicateInfo({
            clientId: parsed.clientId,
            razaoSocial: parsed.razaoSocial,
            sellerName: parsed.sellerName,
          });
          setShowDuplicateDialog(true);
          // Pre-fill form with existing client data
          if (parsed.existingClient) {
            const ec = parsed.existingClient;
            setRazaoSocial(ec.razaoSocial || "");
            setNomeFantasia(ec.nomeFantasia || "");
            setInscricaoEstadual(ec.inscricaoEstadual || "");
            setCep(ec.cep || "");
            setLogradouro(ec.logradouro || "");
            setNumero(ec.numero || "");
            setComplemento(ec.complemento || "");
            setBairro(ec.bairro || "");
            setCidade(ec.cidade || "");
            setUf(ec.uf || "");
            setTelefone1(ec.telefone1 || "");
            setTelefone2(ec.telefone2 || "");
            setEmail(ec.email || "");
            setNomeContato(ec.nomeContato || "");
            setSegmento(ec.segmento || "");
            setObservacoes(ec.observacoes || "");
            setRegimeTributario(ec.regimeTributario || "");
            setInscricaoMunicipal(ec.inscricaoMunicipal || "");
            setInscricaoSuframa(ec.inscricaoSuframa || "");
            setSituacaoFiscalEspecial(ec.situacaoFiscalEspecial || "");
            setCnaeFiscal(ec.cnaeFiscal || "");
            setEmailNfe(ec.emailNfe || "");
            setWebsite(ec.website || "");
            setLimiteCredito(ec.limiteCredito || "");
            setFormaCobranca(ec.formaCobranca || "");
            setTabelaPrecos(ec.tabelaPrecos || "");
            setCondicaoPagamento(ec.condicaoPagamento || "");
            setRegiao(ec.regiao || "");
            setPerfil(ec.perfil || "");
            setFormaPedido(ec.formaPedido || "");
            setProdutos(ec.produtos || "");
            setProbabilidadeNegocio(ec.probabilidadeNegocio || "");
            setTamanho(ec.tamanho || "");
            setAtencao(ec.atencao || "");
            setFornecedorAtual(ec.fornecedorAtual || "");
            setSituacaoCobranca(ec.situacaoCobranca || "");
            setPossuiRedespacho(ec.possuiRedespacho === 1);
            setRedespachoCep(ec.redespachoCep || "");
            setRedespachoLogradouro(ec.redespachoLogradouro || "");
            setRedespachoNumero(ec.redespachoNumero || "");
            setRedespachoComplemento(ec.redespachoComplemento || "");
            setRedespachoBairro(ec.redespachoBairro || "");
            setRedespachoCidade(ec.redespachoCidade || "");
            setRedespachoUf(ec.redespachoUf || "");
            setRedespachoTelefone(ec.redespachoTelefone || "");
            setRedespachoCnpj(ec.redespachoCnpj || "");
            setRedespachoRazaoSocial(ec.redespachoRazaoSocial || "");
            setEnderecoEntregaMesmo(ec.enderecoEntregaMesmo !== 0);
            setEntregaCep(ec.entregaCep || "");
            setEntregaLogradouro(ec.entregaLogradouro || "");
            setEntregaNumero(ec.entregaNumero || "");
            setEntregaComplemento(ec.entregaComplemento || "");
            setEntregaBairro(ec.entregaBairro || "");
            setEntregaCidade(ec.entregaCidade || "");
            setEntregaUf(ec.entregaUf || "");
            setEntregaTelefone(ec.entregaTelefone || "");
          }
          return;
        }
      } catch { /* not JSON, show raw error */ }
      setError(errMsg || "Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  };

  // Handle update when in edit mode
  const handleUpdate = async () => {
    if (!editingClientId) return;
    setSaving(true);
    setError("");
    try {
      await updateMutation.mutateAsync({
        id: editingClientId,
        sellerName,
        cnpjCpf: cnpjCpf.trim() || undefined,
        razaoSocial: razaoSocial.trim() || undefined,
        nomeFantasia: nomeFantasia.trim() || undefined,
        inscricaoEstadual: inscricaoEstadual.trim() || undefined,
        tipoContribuinte: tipoContribuinte || undefined,
        cep: cep.trim() || undefined,
        logradouro: logradouro.trim() || undefined,
        numero: numero.trim() || undefined,
        complemento: complemento.trim() || undefined,
        bairro: bairro.trim() || undefined,
        cidade: cidade.trim() || undefined,
        uf: uf.trim() || undefined,
        telefone1: telefone1.trim() || undefined,
        telefone2: telefone2.trim() || undefined,
        email: email.trim() || undefined,
        nomeContato: nomeContato.trim() || undefined,
        segmento: segmento || undefined,
        observacoes: observacoes.trim() || undefined,
        regimeTributario: regimeTributario || undefined,
        inscricaoMunicipal: inscricaoMunicipal.trim() || undefined,
        inscricaoSuframa: inscricaoSuframa.trim() || undefined,
        situacaoFiscalEspecial: situacaoFiscalEspecial || undefined,
        cnaeFiscal: cnaeFiscal.trim() || undefined,
        emailNfe: emailNfe.trim() || undefined,
        website: website.trim() || undefined,
        limiteCredito: limiteCredito.trim() || undefined,
        formaCobranca: formaCobranca || undefined,
        tabelaPrecos: tabelaPrecos || undefined,
        condicaoPagamento: condicaoPagamento.trim() || undefined,
        regiao: regiao || undefined,
        perfil: perfil || undefined,
        formaPedido: formaPedido || undefined,
        produtos: produtos.trim() || undefined,
        probabilidadeNegocio: probabilidadeNegocio || undefined,
        tamanho: tamanho || undefined,
        atencao: atencao || undefined,
        fornecedorAtual: fornecedorAtual.trim() || undefined,
        situacaoCobranca: situacaoCobranca || undefined,
        possuiRedespacho: possuiRedespacho === true ? true : undefined,
        redespachoCnpj: redespachoCnpj.trim() || undefined,
        redespachoRazaoSocial: redespachoRazaoSocial.trim() || undefined,
        redespachoCep: redespachoCep.trim() || undefined,
        redespachoLogradouro: redespachoLogradouro.trim() || undefined,
        redespachoNumero: redespachoNumero.trim() || undefined,
        redespachoComplemento: redespachoComplemento.trim() || undefined,
        redespachoBairro: redespachoBairro.trim() || undefined,
        redespachoCidade: redespachoCidade.trim() || undefined,
        redespachoUf: redespachoUf.trim() || undefined,
        redespachoTelefone: redespachoTelefone.trim() || undefined,
        enderecoEntregaMesmo: enderecoEntregaMesmo ?? true,
        entregaCep: !enderecoEntregaMesmo ? entregaCep.trim() || undefined : undefined,
        entregaLogradouro: !enderecoEntregaMesmo ? entregaLogradouro.trim() || undefined : undefined,
        entregaNumero: !enderecoEntregaMesmo ? entregaNumero.trim() || undefined : undefined,
        entregaComplemento: !enderecoEntregaMesmo ? entregaComplemento.trim() || undefined : undefined,
        entregaBairro: !enderecoEntregaMesmo ? entregaBairro.trim() || undefined : undefined,
        entregaCidade: !enderecoEntregaMesmo ? entregaCidade.trim() || undefined : undefined,
        entregaUf: !enderecoEntregaMesmo ? entregaUf.trim() || undefined : undefined,
        entregaTelefone: !enderecoEntregaMesmo ? entregaTelefone.trim() || undefined : undefined,
      });
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Erro ao atualizar cliente.");
    } finally {
      setSaving(false);
    }
  };

  const segmentoOptions = ["", "DISTRIBUIDORA", "SUPERMERCADO", "ATACADO", "VAREJO", "INDÚSTRIA", "RESTAURANTE", "LOJA", "OUTROS"];

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border-2 ${editMode ? "border-amber-400 dark:border-amber-600" : "border-teal-300 dark:border-teal-600"} shadow-lg p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className={`w-5 h-5 ${editMode ? "text-amber-600" : "text-teal-600"}`} />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {editMode ? "Alterar Dados Cadastrais" : "Cadastrar Novo Cliente"}
          </h3>
          {editMode && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              Editando cliente existente
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* CNPJ Duplicate Dialog */}
      {showDuplicateDialog && duplicateInfo && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-600 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-1">
                CNPJ já cadastrado!
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                Cliente: <strong>{duplicateInfo.razaoSocial}</strong> (cadastrado por {duplicateInfo.sellerName})
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                Deseja fazer alterações cadastrais nesse cliente? Os dados atuais já foram carregados no formulário.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditMode(true);
                    setEditingClientId(duplicateInfo.clientId);
                    setShowDuplicateDialog(false);
                    setError("");
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
                >
                  Sim, alterar dados
                </button>
                <button
                  onClick={() => {
                    setShowDuplicateDialog(false);
                    setError("");
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Não, cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Dados da Empresa */}
      <div className="mb-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
          <Building2 className="w-3 h-3" /> Dados da Empresa
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <FormInput label="CNPJ/CPF" value={cnpjCpf} onChange={(v) => { setCnpjCpf(v); setCpfLookupError(null); }} placeholder="00.000.000/0001-00" required />
            {cnpjLookupLoading && (
              <p className="mt-1 text-[9px] text-teal-600 flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                {isCpf ? "Consultando CPF na Receita Federal..." : "Consultando Receita Federal + Sintegra..."}
              </p>
            )}
            {cnpjLookupDone && (
              <p className="mt-1 text-[9px] text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Dados preenchidos automaticamente!
              </p>
            )}
            {cpfLookupError && (
              <p className="mt-1 text-[9px] text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {cpfLookupError}
              </p>
            )}
          </div>
          {/* Campo Data de Nascimento - aparece quando CPF (11 dígitos) */}
          {isCpf && !editMode && (
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-1">Data de Nascimento <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={dataNascimento.length === 8 ? `${dataNascimento.slice(4,8)}-${dataNascimento.slice(2,4)}-${dataNascimento.slice(0,2)}` : ""}
                onChange={(e) => {
                  const val = e.target.value; // yyyy-mm-dd
                  if (val) {
                    const [y, m, d] = val.split("-");
                    setDataNascimento(`${d}${m}${y}`); // ddmmaaaa
                  } else {
                    setDataNascimento("");
                  }
                }}
                className="w-full px-3 py-2 border border-amber-300 dark:border-amber-600 rounded-lg text-xs bg-amber-50 dark:bg-amber-900/20 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="mt-0.5 text-[9px] text-amber-600">Necessário para consultar CPF na Receita Federal</p>
            </div>
          )}
          {!isCpf && (
            <FormInput label="Inscrição Estadual" value={inscricaoEstadual} onChange={setInscricaoEstadual} placeholder="IE" />
          )}
        </div>

        {/* Contribuinte determinado automaticamente pela IE - DESATIVADO temporariamente */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          <FormInput label="Razão Social" value={razaoSocial} onChange={setRazaoSocial} placeholder="Nome completo da empresa" />
          <FormInput label="Nome Fantasia" value={nomeFantasia} onChange={setNomeFantasia} placeholder="Nome fantasia (opcional)" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-1">Segmento</label>
            <select
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {segmentoOptions.map(opt => (
                <option key={opt} value={opt}>{opt || "Selecione..."}</option>
              ))}
            </select>
          </div>
          <FormInput label="Pessoa de Contato" value={nomeContato} onChange={setNomeContato} placeholder="Nome do contato" />
        </div>
      </div>

      {/* Endereço */}
      <div className="mb-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Endereço
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <FormInput label="CEP" value={cep} onChange={setCep} placeholder="00000-000" required />
          <div className="sm:col-span-2">
            <FormInput label="Logradouro" value={logradouro} onChange={setLogradouro} placeholder="Rua/Av" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
          <FormInput label="Número" value={numero} onChange={setNumero} placeholder="Nº" />
          <FormInput label="Complemento" value={complemento} onChange={setComplemento} placeholder="Sala, Bloco..." />
          <FormInput label="Bairro" value={bairro} onChange={setBairro} placeholder="Bairro" />
          <FormInput label="Cidade" value={cidade} onChange={setCidade} placeholder="Cidade" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
          <FormInput label="UF" value={uf} onChange={setUf} placeholder="XX" />
          <FormInput label="Telefone 1" value={telefone1} onChange={setTelefone1} placeholder="(00) 00000-0000" required />
          <FormInput label="Telefone 2" value={telefone2} onChange={setTelefone2} placeholder="(00) 00000-0000" />
          <FormInput label="Email" value={email} onChange={setEmail} placeholder="email@empresa.com" required />
        </div>

        {/* Possui Redespacho? */}
        <div className="mt-3 flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Possui redespacho? <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPossuiRedespacho(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${possuiRedespacho === true ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-600 border-slate-300 hover:border-teal-400"}`}
            >
              Sim
            </button>
            <button
              type="button"
              onClick={() => setPossuiRedespacho(false)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${possuiRedespacho === false ? "bg-slate-600 text-white border-slate-600" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}
            >
              Não
            </button>
          </div>
        </div>

        {/* Endereço Redespacho */}
        {possuiRedespacho === true && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-300 uppercase mb-2 flex items-center gap-1">
              <Truck className="w-3 h-3" /> Endereço Redespacho
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <FormInput label="CNPJ do Redespacho" value={redespachoCnpj} onChange={setRedespachoCnpj} placeholder="00.000.000/0001-00" required />
              <FormInput label="Razão Social" value={redespachoRazaoSocial} onChange={setRedespachoRazaoSocial} placeholder="Razão social do redespacho" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <FormInput label="CEP" value={redespachoCep} onChange={setRedespachoCep} placeholder="00000-000" />
              <div className="sm:col-span-2">
                <FormInput label="Logradouro" value={redespachoLogradouro} onChange={setRedespachoLogradouro} placeholder="Rua/Av" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              <FormInput label="Número" value={redespachoNumero} onChange={setRedespachoNumero} placeholder="Nº" />
              <FormInput label="Complemento" value={redespachoComplemento} onChange={setRedespachoComplemento} placeholder="Sala, Bloco..." />
              <FormInput label="Bairro" value={redespachoBairro} onChange={setRedespachoBairro} placeholder="Bairro" />
              <FormInput label="Cidade" value={redespachoCidade} onChange={setRedespachoCidade} placeholder="Cidade" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              <FormInput label="UF" value={redespachoUf} onChange={setRedespachoUf} placeholder="XX" />
              <FormInput label="Telefone" value={redespachoTelefone} onChange={setRedespachoTelefone} placeholder="(00) 00000-0000" />
            </div>
          </div>
        )}

        {/* Endereço de Entrega */}
        <div className="mt-3 flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Endereço de entrega é o mesmo do cadastro? <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEnderecoEntregaMesmo(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${enderecoEntregaMesmo === true ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-600 border-slate-300 hover:border-teal-400"}`}
            >
              Sim
            </button>
            <button
              type="button"
              onClick={() => setEnderecoEntregaMesmo(false)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${enderecoEntregaMesmo === false ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}
            >
              Não
            </button>
          </div>
        </div>

        {/* Endereço de Entrega diferente */}
        {enderecoEntregaMesmo === false && (
          <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl">
            <p className="text-[10px] font-bold text-orange-600 dark:text-orange-300 uppercase mb-2 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Endereço de Entrega
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <FormInput label="CEP" value={entregaCep} onChange={setEntregaCep} placeholder="00000-000" required />
              <div className="sm:col-span-2">
                <FormInput label="Logradouro" value={entregaLogradouro} onChange={setEntregaLogradouro} placeholder="Rua/Av" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              <FormInput label="Número" value={entregaNumero} onChange={setEntregaNumero} placeholder="Nº" />
              <FormInput label="Complemento" value={entregaComplemento} onChange={setEntregaComplemento} placeholder="Sala, Bloco..." />
              <FormInput label="Bairro" value={entregaBairro} onChange={setEntregaBairro} placeholder="Bairro" />
              <FormInput label="Cidade" value={entregaCidade} onChange={setEntregaCidade} placeholder="Cidade" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              <FormInput label="UF" value={entregaUf} onChange={setEntregaUf} placeholder="XX" />
              <FormInput label="Telefone" value={entregaTelefone} onChange={setEntregaTelefone} placeholder="(00) 00000-0000" required />
            </div>
          </div>
        )}
      </div>

      {/* Dados Fiscais */}
      <div className="mb-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
          <FileText className="w-3 h-3" /> Dados Fiscais
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-1">Regime Tributário</label>
            <select
              value={regimeTributario}
              onChange={(e) => setRegimeTributario(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Selecione...</option>
              <option value="Normal">Normal</option>
              <option value="Simples Nacional">Simples Nacional</option>
              <option value="Simples Nacional - Excesso">Simples Nacional - Excesso</option>
              <option value="MEI">MEI</option>
            </select>
          </div>
          <FormInput label="Inscrição Municipal" value={inscricaoMunicipal} onChange={setInscricaoMunicipal} placeholder="IM" />
          <FormInput label="Inscrição SUFRAMA" value={inscricaoSuframa} onChange={setInscricaoSuframa} placeholder="SUFRAMA" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-1">Situação Fiscal Especial</label>
            <select
              value={situacaoFiscalEspecial}
              onChange={(e) => setSituacaoFiscalEspecial(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Nenhuma</option>
              <option value="Isento">Isento</option>
              <option value="Imune">Imune</option>
              <option value="Substituto Tributário">Substituto Tributário</option>
            </select>
          </div>
          <FormInput label="CNAE Fiscal" value={cnaeFiscal} onChange={setCnaeFiscal} placeholder="0000000" />
          <FormInput label="Email NF-e/NFC-e" value={emailNfe} onChange={setEmailNfe} placeholder="nfe@empresa.com" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          <FormInput label="Website" value={website} onChange={setWebsite} placeholder="www.empresa.com.br" />
        </div>
      </div>

      {/* Dados de Venda */}
      <div className="mb-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
          <CreditCard className="w-3 h-3" /> Dados de Venda
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <FormInput label="Limite de Crédito (R$)" value={limiteCredito} onChange={setLimiteCredito} placeholder="999.999,99" />
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-1">Forma de Cobrança (padrão)</label>
            <select
              value={formaCobranca}
              onChange={(e) => setFormaCobranca(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Selecione...</option>
              <option value="Boleto">Boleto</option>
              <option value="Boleto (com registro)">Boleto (com registro)</option>
              <option value="Depósito">Depósito</option>
              <option value="PIX">PIX</option>
              <option value="Cartão">Cartão</option>
              <option value="Cheque">Cheque</option>
              <option value="Dinheiro">Dinheiro</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          <FormInput label="Tabela de Preços" value={tabelaPrecos} onChange={setTabelaPrecos} placeholder="Nome da tabela" />
          <FormInput label="Condição de Pagamento" value={condicaoPagamento} onChange={setCondicaoPagamento} placeholder="30/60/90 dias" />
        </div>
      </div>

      {/* Dados de Relacionamento (CRM) */}
      <div className="mb-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
          <Briefcase className="w-3 h-3" /> Dados de Relacionamento (CRM)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <FormInput label="Região" value={regiao} onChange={setRegiao} placeholder="Região" />
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-1">Perfil</label>
            <select
              value={perfil}
              onChange={(e) => setPerfil(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Selecione...</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-1">Forma de Pedido</label>
            <select
              value={formaPedido}
              onChange={(e) => setFormaPedido(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Selecione...</option>
              <option value="Presencial">Presencial</option>
              <option value="Telefone">Telefone</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Email">Email</option>
              <option value="App">App</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <FormInput label="Produtos" value={produtos} onChange={setProdutos} placeholder="Produtos de interesse" />
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-1">Probabilidade de Negócio</label>
            <select
              value={probabilidadeNegocio}
              onChange={(e) => setProbabilidadeNegocio(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Selecione...</option>
              <option value="Alta">Alta</option>
              <option value="Média">Média</option>
              <option value="Baixa">Baixa</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-1">Tamanho</label>
            <select
              value={tamanho}
              onChange={(e) => setTamanho(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Selecione...</option>
              <option value="Pequeno">Pequeno</option>
              <option value="Médio">Médio</option>
              <option value="Grande">Grande</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-1">Atenção</label>
            <select
              value={atencao}
              onChange={(e) => setAtencao(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Selecione...</option>
              <option value="Normal">Normal</option>
              <option value="Prioritário">Prioritário</option>
              <option value="VIP">VIP</option>
            </select>
          </div>
          <FormInput label="Fornecedor Atual" value={fornecedorAtual} onChange={setFornecedorAtual} placeholder="Concorrente atual" />
        </div>
      </div>

      {/* Cobrança */}
      <div className="mb-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Cobrança
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-1">Situação</label>
            <select
              value={situacaoCobranca}
              onChange={(e) => setSituacaoCobranca(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Selecione...</option>
              <option value="COM PROTESTO">COM PROTESTO</option>
              <option value="SEM PROTESTO">SEM PROTESTO</option>
            </select>
          </div>
        </div>
      </div>

      {/* Observações */}
      <div className="mb-4">
        <label className="block text-[10px] font-medium text-slate-500 mb-1">Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Observações sobre o cliente (opcional)"
          rows={2}
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
        />
      </div>

      {/* Botões */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          onClick={editMode ? handleUpdate : handleSave}
          disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-50 transition-colors shadow-sm cursor-pointer ${editMode ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-600 hover:bg-teal-700"}`}
        >
          {saving ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saving ? "Salvando..." : editMode ? "Salvar Alterações" : "Salvar Cliente"}
        </button>
      </div>
    </div>
  );
}

/**
 * Helper input field for the form
 */
function FormInput({ label, value, onChange, placeholder, type = "text", required = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-slate-500 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 ${required && !value.trim() ? "border-red-300 dark:border-red-600" : "border-slate-200 dark:border-slate-600"}`}
      />
    </div>
  );
}

/**
 * Row for manually registered clients
 */
function ManualClientRow({ client, onDeleted, onEdit }: { client: any; onDeleted: () => void; onEdit?: (client: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportingClient, setExportingClient] = useState(false);
  const deleteMutation = trpc.sales.deleteVendorClient.useMutation();
  const exportClientMutation = trpc.salesOrders.exportVendorClientMaxiprod.useMutation();

  const handleDelete = async () => {
    await deleteMutation.mutateAsync({ id: client.id });
    onDeleted();
  };

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
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left cursor-pointer"
      >
        <div className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-3 h-3 text-teal-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
              {client.razaoSocial}
            </p>
            {client.uf && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0">
                {client.uf}
              </span>
            )}
            {client.segmento && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 flex-shrink-0 hidden sm:inline">
                {client.segmento}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400 flex-shrink-0">
              NOVO
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-400">{client.cnpjCpf}</span>
            {client.cidade && (
              <span className="text-[10px] text-slate-400">· {client.cidade}</span>
            )}
            {client.nomeContato && (
              <span className="text-[10px] text-slate-400 hidden sm:inline">· Contato: {client.nomeContato}</span>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${
          expanded ? "rotate-180" : ""
        }`} />
      </button>

      {expanded && (
        <div className="px-4 pb-3 ml-8 border-l-2 border-teal-200 dark:border-teal-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {client.razaoSocial && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Razão Social:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.razaoSocial}</span>
              </div>
            )}
            {client.nomeFantasia && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Nome Fantasia:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.nomeFantasia}</span>
              </div>
            )}
            {client.cnpjCpf && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">CNPJ/CPF:</span>
                <span className="text-slate-600 dark:text-slate-300 font-mono">{client.cnpjCpf}</span>
              </div>
            )}
            {client.inscricaoEstadual && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">IE:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.inscricaoEstadual}</span>
              </div>
            )}
            {client.cep && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">CEP:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.cep}</span>
              </div>
            )}
            {endereco && (
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600 dark:text-slate-300">{endereco}</span>
              </div>
            )}
            {client.telefone1 && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <a href={`tel:${client.telefone1}`} className="text-teal-600 hover:underline">{client.telefone1}</a>
                {client.telefone2 && <span className="text-slate-400">/ {client.telefone2}</span>}
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <a href={`mailto:${client.email}`} className="text-teal-600 hover:underline truncate">{client.email}</a>
              </div>
            )}
            {client.nomeContato && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Contato:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.nomeContato}</span>
              </div>
            )}
            {client.segmento && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Segmento:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.segmento}</span>
              </div>
            )}
            {client.regimeTributario && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Regime:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.regimeTributario}</span>
              </div>
            )}
            {client.inscricaoMunicipal && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">IM:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.inscricaoMunicipal}</span>
              </div>
            )}
            {client.inscricaoSuframa && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">SUFRAMA:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.inscricaoSuframa}</span>
              </div>
            )}
            {client.situacaoFiscalEspecial && client.situacaoFiscalEspecial !== "Nenhuma" && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Sit. Fiscal:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.situacaoFiscalEspecial}</span>
              </div>
            )}
            {client.cnaeFiscal && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">CNAE:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.cnaeFiscal}</span>
              </div>
            )}
            {client.emailNfe && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Email NFe:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.emailNfe}</span>
              </div>
            )}
            {client.website && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Website:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.website}</span>
              </div>
            )}
            {client.limiteCredito && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Limite Créd.:</span>
                <span className="text-slate-600 dark:text-slate-300">R$ {client.limiteCredito}</span>
              </div>
            )}
            {client.formaCobranca && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Cobrança:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.formaCobranca}</span>
              </div>
            )}
            {client.tabelaPrecos && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Tabela Preços:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.tabelaPrecos}</span>
              </div>
            )}
            {client.condicaoPagamento && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Pag.:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.condicaoPagamento}</span>
              </div>
            )}
            {client.regiao && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Região:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.regiao}</span>
              </div>
            )}
            {client.perfil && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Perfil:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.perfil}</span>
              </div>
            )}
            {client.formaPedido && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Forma Pedido:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.formaPedido}</span>
              </div>
            )}
            {client.produtos && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Produtos:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.produtos}</span>
              </div>
            )}
            {client.probabilidadeNegocio && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Probabilidade:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.probabilidadeNegocio}</span>
              </div>
            )}
            {client.tamanho && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Tamanho:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.tamanho}</span>
              </div>
            )}
            {client.atencao && client.atencao !== "Normal" && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Atenção:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.atencao}</span>
              </div>
            )}
            {client.fornecedorAtual && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Fornecedor Atual:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.fornecedorAtual}</span>
              </div>
            )}
            {client.situacaoCobranca && client.situacaoCobranca !== "SEM PROTESTO" && (
              <div className="flex items-start gap-1.5">
                <span className="text-red-500 font-medium whitespace-nowrap">Sit. Cobrança:</span>
                <span className="text-red-600 dark:text-red-400 font-bold">{client.situacaoCobranca}</span>
              </div>
            )}
            {client.observacoes && (
              <div className="flex items-start gap-1.5 sm:col-span-2">
                <span className="text-slate-400 font-medium whitespace-nowrap">Obs:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.observacoes}</span>
              </div>
            )}
          </div>
          {/* Redespacho info */}
          <div className={`mt-2 p-2 rounded-lg border ${client.possuiRedespacho === 1 ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700" : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"}`}>
            <p className={`text-[9px] font-bold uppercase mb-1 ${client.possuiRedespacho === 1 ? "text-blue-600 dark:text-blue-300" : "text-slate-500 dark:text-slate-400"}`}>
              Possui Redespacho: <span className={`${client.possuiRedespacho === 1 ? "text-blue-700" : "text-slate-600"}`}>{client.possuiRedespacho === 1 ? "Sim" : "Não"}</span>
            </p>
            {client.possuiRedespacho === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                {client.redespachoCnpj && <span className="text-slate-600 dark:text-slate-300">CNPJ: {client.redespachoCnpj}</span>}
                {client.redespachoRazaoSocial && <span className="text-slate-600 dark:text-slate-300">Razão: {client.redespachoRazaoSocial}</span>}
                {client.redespachoCep && <span className="text-slate-600 dark:text-slate-300">CEP: {client.redespachoCep}</span>}
                {enderecoRedespacho && <span className="text-slate-600 dark:text-slate-300">{enderecoRedespacho}</span>}
                {client.redespachoTelefone && <span className="text-slate-600 dark:text-slate-300">Tel: {client.redespachoTelefone}</span>}
              </div>
            )}
          </div>
          {/* Endereço de entrega */}
          <div className={`mt-2 p-2 rounded-lg border ${client.enderecoEntregaMesmo === 0 ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700" : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"}`}>
            <p className={`text-[9px] font-bold uppercase mb-1 ${client.enderecoEntregaMesmo === 0 ? "text-orange-600 dark:text-orange-300" : "text-slate-500 dark:text-slate-400"}`}>
              Endereço de entrega é o mesmo do cadastro: <span className={`${client.enderecoEntregaMesmo === 0 ? "text-orange-700" : "text-slate-600"}`}>{client.enderecoEntregaMesmo === 0 ? "Não" : "Sim"}</span>
            </p>
            {client.enderecoEntregaMesmo === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                {client.entregaCep && <span className="text-slate-600 dark:text-slate-300">CEP: {client.entregaCep}</span>}
                {enderecoEntrega && <span className="text-slate-600 dark:text-slate-300">{enderecoEntrega}</span>}
                {client.entregaTelefone && <span className="text-slate-600 dark:text-slate-300">Tel: {client.entregaTelefone}</span>}
              </div>
            )}
          </div>
          {/* Export Maxiprod button */}
          <button
            onClick={async () => {
              setExportingClient(true);
              try {
                const result = await exportClientMutation.mutateAsync({ clientId: client.id });
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
              } catch (err: any) {
                alert(err.message || "Erro ao exportar cliente");
              } finally {
                setExportingClient(false);
              }
            }}
            disabled={exportingClient}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exportingClient ? "Exportando..." : "Exportar Maxiprod"}
            <span className="text-[10px] text-green-500">(Planilha Empresas .xlsx)</span>
          </button>

          {/* Edit and Delete buttons */}
          <div className="mt-3 flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(client)}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-amber-600 bg-amber-50 rounded-md hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                Editar
              </button>
            )}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-red-500 bg-red-50 rounded-md hover:bg-red-100 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Excluir
              </button>
            ) : (
              <>
                <span className="text-[10px] text-red-500 font-medium">Confirmar exclusão?</span>
                <button
                  onClick={handleDelete}
                  className="px-2.5 py-1 text-[10px] font-medium text-white bg-red-500 rounded-md hover:bg-red-600 cursor-pointer"
                >
                  Sim, excluir
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 text-[10px] font-medium text-slate-500 bg-slate-100 rounded-md hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ============================================================
 * ABA PEDIDOS DE VENDA - Mostra os pedidos do vendedor no Maxiprod
 * Dados da tabela sales_orders agrupados por número de pedido
 * ============================================================
 */
const MONTHS_PT_ORDERS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function getOrderDateRange(period: string, customMonth?: { year: number; month: number }) {
  const now = new Date();
  if (period === "custom" && customMonth) {
    const firstDay = new Date(customMonth.year, customMonth.month, 1);
    const lastDay = new Date(customMonth.year, customMonth.month + 1, 0);
    const isCurrentMonth = customMonth.year === now.getFullYear() && customMonth.month === now.getMonth();
    return {
      startDate: firstDay.toISOString().split("T")[0],
      endDate: isCurrentMonth ? now.toISOString().split("T")[0] : lastDay.toISOString().split("T")[0],
    };
  }
  if (period === "previous") {
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      startDate: firstDay.toISOString().split("T")[0],
      endDate: lastDay.toISOString().split("T")[0],
    };
  }
  // current
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: firstDay.toISOString().split("T")[0],
    endDate: now.toISOString().split("T")[0],
  };
}

/**
 * OrderDeleteButton - Botão de lixeira inline para excluir pedido
 */
function OrderDeleteButton({ orderId, onDeleted }: { orderId: number; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const deleteMutation = trpc.salesOrders.deleteOrder.useMutation();

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={async () => {
            await deleteMutation.mutateAsync({ orderId });
            onDeleted();
            setConfirming(false);
          }}
          disabled={deleteMutation.isPending}
          className="px-2 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded hover:bg-red-600 cursor-pointer"
        >
          {deleteMutation.isPending ? "..." : "Sim"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2 py-0.5 text-[9px] font-medium text-slate-500 bg-slate-100 rounded hover:bg-slate-200 cursor-pointer"
        >
          Não
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
      className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
      title="Excluir pedido"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

function SellerOrdersView({ sellerId, sellerName }: { sellerId: number; sellerName: string }) {
  const utils = trpc.useUtils();
  const { operator } = useOperator();
  const canSkipClient = operator?.name === "Guilherme" || operator?.name === "Luís Eduardo";
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [expandedPedido, setExpandedPedido] = useState<string | null>(null);
  const [period, setPeriod] = useState("current");
  const [customMonth, setCustomMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const { hasDraft } = useOrderDraft();
  const resumeDraft = new URLSearchParams(window.location.search).get("resumeDraft") === "1";
  const [showNewOrder, setShowNewOrder] = useState(resumeDraft && hasDraft);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [showMonthlyDetails, setShowMonthlyDetails] = useState(false);

  const { startDate, endDate } = useMemo(() => getOrderDateRange(period, customMonth), [period, customMonth]);

  // Buscar pedidos do vendedor (do Maxiprod via sales_orders)
  const { data: pedidos, isLoading } = trpc.salesMetrics.getPedidosByVendedor.useQuery(
    { vendedor: sellerName },
    { staleTime: 2 * 60 * 1000 }
  );

  // Buscar pedidos manuais (do app do vendedor via salesOrderRequests)
  const { data: pedidosManuais } = trpc.salesOrders.getSellerOrders.useQuery(
    { sellerId },
    { staleTime: 60 * 1000 }
  );

  const filteredPedidos = useMemo(() => {
    if (!pedidos) return [];
    let result = [...pedidos];
    // Filter by date range
    result = result.filter((p) => {
      if (!p.dataEmissao) return false;
      const dateStr = p.dataEmissao.split("T")[0];
      return dateStr >= startDate && dateStr <= endDate;
    });
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      result = result.filter(
        (p) =>
          p.pedido.toUpperCase().includes(q) ||
          p.cliente.toUpperCase().includes(q) ||
          (p.estadoNota || "").toUpperCase().includes(q)
      );
    }
    if (statusFilter !== "todos") {
      result = result.filter((p) => (p.estadoNota || "").toUpperCase() === statusFilter.toUpperCase());
    }
    return result;
  }, [pedidos, searchQuery, statusFilter, startDate, endDate]);

  // Extract unique statuses for filter
  const statusOptions = useMemo((): string[] => {
    if (!pedidos) return [];
    const statuses = new Set<string>(pedidos.map((p) => p.estadoNota || "Sem status"));
    return Array.from(statuses).sort();
  }, [pedidos]);

  // Monthly reputation panel (no pending order - just shows current state)
  // MUST be declared before any early return to respect React Rules of Hooks
  const monthlyRepQuery = trpc.salesOrders.getSellerMonthlyMargin.useQuery(
    { sellerId },
    { staleTime: 60 * 1000 }
  );
  const monthlyDiscountQuery = trpc.salesOrders.getSellerMonthlyDiscount.useQuery(
    { sellerId },
    { staleTime: 60 * 1000 }
  );

  // Alfa Tracking state
  const [trackingPedido, setTrackingPedido] = useState<string | null>(null);
  const trackAlfaMutation = trpc.billing.trackAlfaShipment.useMutation();

  // Freight simulation state
  const { hasGranularAccess } = useOperator();
  const canCotarFrete = hasGranularAccess("gc.cotarFretePedido");
  const [freightPedido, setFreightPedido] = useState<string | null>(null);
  const quoteByPedidoMutation = trpc.salesOrders.quoteByPedido.useMutation();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
        <div className="flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 text-teal-500 animate-spin" />
          <span className="text-sm text-slate-500">Carregando pedidos...</span>
        </div>
      </div>
    );
  }

  const totalPedidos = filteredPedidos.length;
  const totalValor = filteredPedidos.reduce((sum: number, p) => sum + p.valorTotal, 0);
  const totalPedidosManuais = pedidosManuais?.length || 0;
  const periodLabel = period === "current" ? "Mês Atual" : period === "previous" ? "Mês Anterior" : `${MONTHS_PT_ORDERS[customMonth.month].slice(0,3)}/${customMonth.year}`;

  return (
    <div className="space-y-4">
      {/* Monthly Reputation Panel */}
      {monthlyRepQuery.data && monthlyRepQuery.data.totalOrders > 0 && (() => {
        const md = monthlyRepQuery.data;
        const margin = md.currentMonthlyMargin ?? 0;
        const getColor = (m: number) => {
          if (m < 15) return { bg: 'from-red-500 to-red-600', text: 'text-red-600 dark:text-red-400', label: 'Crítico', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
          if (m < 20) return { bg: 'from-orange-500 to-orange-600', text: 'text-orange-600 dark:text-orange-400', label: 'Comissão Baixa', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' };
          if (m < 25) return { bg: 'from-yellow-400 to-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', label: 'Comissão Média', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' };
          if (m < 29) return { bg: 'from-green-500 to-green-600', text: 'text-green-600 dark:text-green-400', label: 'Comissão Média-Alta', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' };
          return { bg: 'from-blue-500 to-blue-600', text: 'text-blue-600 dark:text-blue-400', label: 'Comissão Alta', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' };
        };
        const c = getColor(margin);
        const barMin = -5;
        const barMax = 40;
        const clamped = Math.max(barMin, Math.min(barMax, margin));
        const pos = ((clamped - barMin) / (barMax - barMin)) * 100;
        return (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${c.bg} flex items-center justify-center`}>
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Reputação do Mês</h3>
                  <p className="text-[10px] text-slate-400">{md.month} • {md.totalOrders} pedido{md.totalOrders !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-black tabular-nums ${c.text}`}>{margin.toFixed(1)}%</div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{c.label}</span>
              </div>
            </div>
            {/* Bar */}
            <div className="relative w-full">
              <div className="relative h-5 rounded-full overflow-visible border border-slate-200 dark:border-slate-600 shadow-inner">
                <div className="absolute inset-0 rounded-full overflow-hidden flex">
                  <div className="h-full bg-red-400" style={{ width: "44.4%" }} />
                  <div className="h-full bg-orange-400" style={{ width: "11.1%" }} />
                  <div className="h-full bg-yellow-300" style={{ width: "11.1%" }} />
                  <div className="h-full bg-green-400" style={{ width: "8.9%" }} />
                  <div className="h-full bg-blue-400" style={{ width: "24.5%" }} />
                </div>
                <div className="absolute top-0 bottom-0 w-[1.5px] bg-white/80" style={{ left: "44.4%" }} />
                <div className="absolute top-0 bottom-0 w-[1.5px] bg-white/80" style={{ left: "55.5%" }} />
                <div className="absolute top-0 bottom-0 w-[1.5px] bg-white/80" style={{ left: "66.6%" }} />
                <div className="absolute top-0 bottom-0 w-[1.5px] bg-white/80" style={{ left: "75.5%" }} />
                <div
                  className="absolute flex flex-col items-center"
                  style={{ left: `${pos}%`, transform: "translateX(-50%)", top: "-5px", bottom: "-2px" }}
                >
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-slate-900 dark:border-t-white" />
                  <div className="w-[2px] flex-1 bg-slate-900 dark:bg-white rounded-full" />
                </div>
              </div>
              <div className="relative w-full h-3 mt-0.5">
                <span className="absolute text-[8px] text-slate-400" style={{ left: "44.4%", transform: "translateX(-50%)" }}>15%</span>
                <span className="absolute text-[8px] text-slate-400" style={{ left: "55.5%", transform: "translateX(-50%)" }}>20%</span>
                <span className="absolute text-[8px] text-slate-400" style={{ left: "66.6%", transform: "translateX(-50%)" }}>25%</span>
                <span className="absolute text-[8px] text-slate-400" style={{ left: "75.5%", transform: "translateX(-50%)" }}>29%</span>
              </div>
            </div>
            {/* Footer info */}
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
              <span>Valor total: {formatCurrencySales(md.totalValue)}</span>
              <div className="flex items-center gap-2">
                {md.monthlyComissaoPercentual > 0 && (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Comissão: {md.monthlyComissaoPercentual}%</span>
                )}
                <button
                  onClick={() => setShowMonthlyDetails(prev => !prev)}
                  className="text-[10px] font-medium text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5"
                >
                  <Eye className="w-3 h-3" />
                  {showMonthlyDetails ? 'Ocultar' : 'Detalhes'}
                </button>
              </div>
            </div>
            {/* Expandable details */}
            {showMonthlyDetails && md.orderBreakdown && md.orderBreakdown.length > 0 && (
              <div className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-2">Pedidos que compõem a média ponderada:</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {md.orderBreakdown.map((ob: { orderId: number; valor: number; margem: number; clienteNome?: string; createdAt?: string }, idx: number) => {
                    const peso = md.totalValue > 0 ? (ob.valor / md.totalValue) * 100 : 0;
                    const tierColor = ob.margem >= 29 ? 'text-blue-600' : ob.margem >= 25 ? 'text-green-600' : ob.margem >= 20 ? 'text-yellow-600' : ob.margem >= 15 ? 'text-orange-600' : 'text-red-600';
                    return (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-md px-2.5 py-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">
                            #{ob.orderId} — {ob.clienteNome || 'Cliente'}
                          </p>
                          {ob.createdAt && (
                            <p className="text-[9px] text-slate-400">{new Date(ob.createdAt).toLocaleDateString('pt-BR')}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] shrink-0">
                          <span className="text-slate-500">{formatCurrencySales(ob.valor)}</span>
                          <span className={`font-bold ${tierColor}`}>{ob.margem.toFixed(1)}%</span>
                          <span className="text-slate-400">Peso: {peso.toFixed(0)}%</span>
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

      {/* Header com KPIs + Period + Novo Pedido */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Pedidos de Venda
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              {totalPedidos} pedido{totalPedidos !== 1 ? "s" : ""}
            </span>
            {totalPedidosManuais > 0 && (
              <span className="flex items-center gap-1 text-teal-600">
                <FileCheck className="w-3.5 h-3.5" />
                {totalPedidosManuais} via App
              </span>
            )}
            <span className="flex items-center gap-1 font-medium text-green-600">
              <DollarSign className="w-3.5 h-3.5" />
              {formatCurrencySales(totalValor)}
            </span>
          </div>
        </div>

        {/* Period filter + Novo Pedido button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPeriod("current")}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
                period === "current" ? "bg-teal-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50"
              }`}
            >
              Mês Atual
            </button>
            <button
              onClick={() => setPeriod("previous")}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
                period === "previous" ? "bg-teal-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50"
              }`}
            >
              Mês Anterior
            </button>
            <Popover open={showMonthPicker} onOpenChange={setShowMonthPicker}>
              <PopoverTrigger asChild>
                <button
                  className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors flex items-center gap-1 ${
                    period === "custom" ? "bg-teal-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50"
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  {period === "custom" ? `${MONTHS_PT_ORDERS[customMonth.month].slice(0,3)}/${customMonth.year}` : "Personalizado"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setCustomMonth(prev => {
                        const newYear = prev.month === 0 ? prev.year - 1 : prev.year;
                        const newMonth = prev.month === 0 ? 11 : prev.month - 1;
                        return { year: newYear, month: newMonth };
                      })}
                      className="p-1 rounded hover:bg-slate-100"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-semibold">{customMonth.year}</span>
                    <button
                      onClick={() => setCustomMonth(prev => {
                        const newYear = prev.month === 11 ? prev.year + 1 : prev.year;
                        const newMonth = prev.month === 11 ? 0 : prev.month + 1;
                        return { year: newYear, month: newMonth };
                      })}
                      className="p-1 rounded hover:bg-slate-100 rotate-180"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MONTHS_PT_ORDERS.map((m, idx) => (
                      <button
                        key={m}
                        onClick={() => {
                          setCustomMonth(prev => ({ ...prev, month: idx }));
                          setPeriod("custom");
                          setShowMonthPicker(false);
                        }}
                        className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                          customMonth.month === idx && period === "custom"
                            ? "bg-teal-600 text-white"
                            : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {m.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <button
            onClick={() => setShowNewOrder(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            Novo Pedido
          </button>
        </div>

        {/* Search + Status Filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nº pedido, cliente ou status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] text-slate-400 whitespace-nowrap">Status:</span>
            <button
              onClick={() => setStatusFilter("todos")}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                statusFilter === "todos"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter("Aprovado")}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                statusFilter === "Aprovado"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50"
              }`}
            >
              Aprovado
            </button>
            <button
              onClick={() => setStatusFilter("Faturado")}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                statusFilter === "Faturado"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50"
              }`}
            >
              Faturado
            </button>
            {statusOptions.filter(s => s !== "Aprovado" && s !== "Faturado").slice(0, 3).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                  statusFilter === s
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Novo Pedido de Venda Form */}
      {showNewOrder && (
        <NewOrderInline sellerId={sellerId} sellerName={sellerName} canSkipClient={canSkipClient} editOrderId={editingOrderId} onClose={() => { setShowNewOrder(false); setEditingOrderId(null); }} />
      )}

      {/* Pedidos manuais (via App) */}
      {pedidosManuais && pedidosManuais.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-teal-200 dark:border-teal-700 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-100 dark:border-teal-800">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold text-teal-700 dark:text-teal-400">Pedidos via App ({pedidosManuais.length})</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {pedidosManuais.slice(0, 20).map((pm: any) => (
              <div key={pm.id} className={`px-4 py-3 ${
                pm.status === "rejeitado" ? "bg-red-50/50 dark:bg-red-900/10 border-l-4 border-l-red-400" :
                pm.status === "pendente" && pm.temPrecoAbaixoMinimo ? "bg-amber-50/50 dark:bg-amber-900/10 border-l-4 border-l-amber-400" :
                ""
              }`}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400">#{String(pm.orderNumber || pm.id).padStart(2, '0')}</span>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                        {pm.razaoSocial || pm.nomeFantasia || "Cliente"}
                      </p>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        pm.status === "aprovado" ? "bg-green-50 text-green-600" :
                        pm.status === "pendente" ? "bg-amber-50 text-amber-600" :
                        pm.status === "rejeitado" ? "bg-red-50 text-red-600" :
                        pm.status === "processado" ? "bg-blue-50 text-blue-600" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {pm.status === "pendente" ? "⏳ AGUARDANDO GESTOR" :
                         pm.status === "aprovado" ? "✅ APROVADO" :
                         pm.status === "rejeitado" ? "❌ RECUSADO" :
                         pm.status === "processado" ? "✅ PROCESSADO" :
                         pm.status?.toUpperCase()}
                      </span>
                      {pm.temPrecoAbaixoMinimo && pm.status === "pendente" && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-100 text-red-700">
                          Preço abaixo do mínimo
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {pm.createdAt ? new Date(pm.createdAt).toLocaleDateString("pt-BR") : ""}
                      {pm.condicaoPagamento && ` · Pgto: ${pm.condicaoPagamento}`}
                      {pm.items?.length > 0 && ` · ${pm.items.length} ite${pm.items.length !== 1 ? "ns" : "m"}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <p className="text-xs font-bold text-green-700 dark:text-green-400">
                      {formatCurrencySales(Number(pm.totalPedido || pm.totalProdutos || 0))}
                    </p>
                    {pm.status === "pendente" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingOrderId(pm.id); setShowNewOrder(true); }}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                        title="Editar pedido"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <OrderDeleteButton orderId={pm.id} onDeleted={() => utils.salesOrders.getSellerOrders.invalidate()} />
                  </div>
                </div>
                {/* Approval notification */}
                {pm.status === "aprovado" && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-[11px] font-bold text-green-700 dark:text-green-400 flex items-center gap-1">
                      <span>✅</span> Pedido aprovado{pm.aprovadoPor ? ` por ${pm.aprovadoPor}` : ""}
                    </p>
                    {pm.dataAprovacao && (
                      <p className="text-[10px] text-green-600 dark:text-green-300 mt-0.5">
                        Em {new Date(pm.dataAprovacao).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {pm.observacaoAprovacao && (
                      <p className="text-[10px] text-green-600 dark:text-green-300 mt-0.5">
                        Obs: {pm.observacaoAprovacao}
                      </p>
                    )}
                  </div>
                )}
                {/* Rejection notification */}
                {pm.status === "rejeitado" && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-[11px] font-bold text-red-700 dark:text-red-400 flex items-center gap-1">
                      <span>⚠️</span> Gestor não autorizou este pedido
                    </p>
                    {pm.motivoRejeicao && (
                      <p className="text-[10px] text-red-600 dark:text-red-300 mt-0.5">
                        Motivo: {pm.motivoRejeicao}
                      </p>
                    )}
                    <p className="text-[10px] text-red-500 dark:text-red-400 mt-1 font-medium">
                      Por favor, reedite o pedido com os preços corretos.
                    </p>
                  </div>
                )}
                {/* Show items for pending/rejected orders */}
                {(pm.status === "pendente" || pm.status === "rejeitado") && pm.items?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {pm.items.filter((it: any) => it.abaixoDoMinimo).map((it: any, idx: number) => (
                      <div key={idx} className="text-[10px] bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1 flex items-center justify-between">
                        <span className="text-amber-800 dark:text-amber-300 truncate">{it.descricaoItem}</span>
                        <span className="text-amber-600 font-medium ml-2 whitespace-nowrap">
                          R$ {Number(it.precoUnitario).toFixed(2)} (mín: R$ {Number(it.precoMinimo).toFixed(2)})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de pedidos Maxiprod - hidden when new order form is open (tablet optimization) */}
      {/* Alfa Tracking Modal */}
      {trackingPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setTrackingPedido(null); trackAlfaMutation.reset(); }}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Rastreio - Pedido #{trackingPedido}</h3>
              </div>
              <button onClick={() => { setTrackingPedido(null); trackAlfaMutation.reset(); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              {trackAlfaMutation.isPending && (
                <div className="flex items-center justify-center gap-2 py-8">
                  <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                  <span className="text-sm text-slate-500">Consultando Alfa Transportes...</span>
                </div>
              )}
              {trackAlfaMutation.isError && (
                <div className="text-center py-6">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-red-600 dark:text-red-400">Erro ao consultar rastreio</p>
                  <p className="text-xs text-slate-400 mt-1">{trackAlfaMutation.error?.message}</p>
                </div>
              )}
              {trackAlfaMutation.isSuccess && !trackAlfaMutation.data.success && (
                <div className="text-center py-6">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">Rastreio não encontrado</p>
                  <p className="text-xs text-slate-500 mt-1">{trackAlfaMutation.data.error}</p>
                  {trackAlfaMutation.data.nfUsed && (
                    <p className="text-xs text-slate-400 mt-1">NF consultada: {trackAlfaMutation.data.nfUsed}</p>
                  )}
                </div>
              )}
              {trackAlfaMutation.isSuccess && trackAlfaMutation.data.success && trackAlfaMutation.data.tracking && (() => {
                const t = trackAlfaMutation.data.tracking;
                const r = t.rastreamento;
                const isDelivered = t.status.numero === 2;
                return (
                  <div className="space-y-4">
                    {/* Status geral */}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      isDelivered ? "bg-green-50 dark:bg-green-900/20" : "bg-blue-50 dark:bg-blue-900/20"
                    }`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        isDelivered ? "bg-green-500" : "bg-blue-500 animate-pulse"
                      }`} />
                      <span className={`text-sm font-bold ${
                        isDelivered ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-400"
                      }`}>
                        {isDelivered ? "ENTREGUE" : "EM TR\u00C2NSITO"}
                      </span>
                      <span className="text-xs text-slate-500 ml-auto">{t.status.descricao}</span>
                    </div>

                    {/* CT-e Info */}
                    {r?.dadosCte && (
                      <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3 space-y-1.5">
                        <p className="text-xs font-bold text-slate-500 uppercase">CT-e</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-slate-400">Número:</span> <span className="text-slate-700 dark:text-slate-200 font-medium">{r.dadosCte.numeroCte}</span></div>
                          <div><span className="text-slate-400">Valor:</span> <span className="text-slate-700 dark:text-slate-200 font-medium">R$ {Number(r.dadosCte.valorCte).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                          <div><span className="text-slate-400">Emissão:</span> <span className="text-slate-700 dark:text-slate-200">{r.dadosCte.emissaoData}</span></div>
                          <div><span className="text-slate-400">Previsão:</span> <span className="text-slate-700 dark:text-slate-200 font-medium">{r.dadosCte.dataPrevista || "-"}</span></div>
                          <div className="col-span-2"><span className="text-slate-400">Destinatário:</span> <span className="text-slate-700 dark:text-slate-200">{r.dadosCte.nomeDestinatario}</span></div>
                          <div><span className="text-slate-400">Origem:</span> <span className="text-slate-700 dark:text-slate-200">{r.dadosCte.agenciaInicio}</span></div>
                          <div><span className="text-slate-400">Destino:</span> <span className="text-slate-700 dark:text-slate-200">{r.dadosCte.agenciaFim}</span></div>
                        </div>
                      </div>
                    )}

                    {/* Trechos/Embarque */}
                    {r?.dadosEmbarque && r.dadosEmbarque.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-slate-500 uppercase">Trechos</p>
                        <div className="space-y-1">
                          {r.dadosEmbarque.map((trecho, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/30 rounded px-3 py-2">
                              <div className="flex-1 text-xs">
                                <span className="text-slate-700 dark:text-slate-200 font-medium">{trecho.cidadeOrigem}</span>
                                <span className="text-slate-400 mx-1">→</span>
                                <span className="text-slate-700 dark:text-slate-200 font-medium">{trecho.cidadeDestino}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 text-right">
                                {trecho.horaSaida && <div>Saída: {trecho.horaSaida}</div>}
                                {trecho.horaChegada && <div>Chegada: {trecho.horaChegada}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Entrega */}
                    {r?.dadosEntrega && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 space-y-1.5">
                        <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase">Entrega Realizada</p>
                        <div className="text-xs space-y-1">
                          <div><span className="text-slate-500">Recebedor:</span> <span className="text-slate-700 dark:text-slate-200 font-medium">{r.dadosEntrega.recebedorMercadoria}</span></div>
                          <div><span className="text-slate-500">Data:</span> <span className="text-slate-700 dark:text-slate-200 font-medium">{r.dadosEntrega.dataEntrega}</span></div>
                          {r.dadosEntrega.urlComprovante && (
                            <a href={r.dadosEntrega.urlComprovante} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline mt-1">
                              <FileText className="w-3 h-3" />
                              Ver comprovante de entrega
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Ocorrências extras */}
                    {r?.ocorrenciasExtras && r.ocorrenciasExtras.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-slate-500 uppercase">Ocorrências</p>
                        <div className="space-y-1">
                          {r.ocorrenciasExtras.map((oc, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 rounded px-3 py-1.5">
                              <span className="text-amber-600 dark:text-amber-400 font-medium">{oc.dataOcorrencia}</span>
                              <span className="text-slate-600 dark:text-slate-300">{oc.descricaoOcorrencia}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* NF usada */}
                    {trackAlfaMutation.data.nfUsed && (
                      <p className="text-[10px] text-slate-400 text-center">NF consultada: {trackAlfaMutation.data.nfUsed} | CNPJ: {trackAlfaMutation.data.cnpjUsed}</p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal Simulação de Frete */}
      {freightPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setFreightPedido(null); quoteByPedidoMutation.reset(); }}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Simulação de Frete - Pedido #{freightPedido}</h3>
              </div>
              <button onClick={() => { setFreightPedido(null); quoteByPedidoMutation.reset(); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              {quoteByPedidoMutation.isPending && (
                <div className="flex items-center justify-center gap-2 py-8">
                  <RefreshCw className="w-5 h-5 text-teal-500 animate-spin" />
                  <span className="text-sm text-slate-500">Simulando frete nas 5 transportadoras...</span>
                </div>
              )}
              {quoteByPedidoMutation.isError && (
                <div className="text-center py-6">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">Erro na simulação</p>
                  <p className="text-xs text-slate-400 mt-1">{quoteByPedidoMutation.error?.message}</p>
                </div>
              )}
              {quoteByPedidoMutation.isSuccess && quoteByPedidoMutation.data && (
                <div className="space-y-4">
                  {/* Dados usados */}
                  <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400">Cliente</span>
                        <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{quoteByPedidoMutation.data.cliente}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">CEP Destino</span>
                        <p className="font-medium text-slate-700 dark:text-slate-200">{quoteByPedidoMutation.data.cepDestino}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Peso Total</span>
                        <p className="font-medium text-slate-700 dark:text-slate-200">{quoteByPedidoMutation.data.pesoTotal.toFixed(2)} kg</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Valor Mercadoria</span>
                        <p className="font-medium text-slate-700 dark:text-slate-200">R$ {quoteByPedidoMutation.data.valorMercadoria.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>
                  {/* Resultados das transportadoras */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">Cotações (menor para maior)</p>
                    {quoteByPedidoMutation.data.carriers.map((c, idx) => (
                      <div key={idx} className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
                        c.error ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10" :
                        idx === 0 ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10" :
                        "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                      }`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{c.transportadora}</span>
                            {idx === 0 && !c.error && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">MENOR</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {c.cnpj && <span className="text-[10px] text-slate-400">CNPJ: {c.cnpj}</span>}
                            {c.prazo && <span className="text-[10px] text-slate-400">Prazo: {c.prazo}</span>}
                            {c.protocolo && <span className="text-[10px] text-blue-500">Prot: {c.protocolo}</span>}
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          {c.error ? (
                            <span className="text-xs text-red-500 font-medium">{c.error.length > 40 ? c.error.slice(0, 40) + "..." : c.error}</span>
                          ) : (
                            <span className="text-sm font-bold text-green-700 dark:text-green-400">
                              R$ {c.totalFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!showNewOrder && (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Histórico de Pedidos de Venda</h3>
        </div>
        {!pedidos || filteredPedidos.length === 0 ? (
          <div className="p-8 text-center">
            <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {searchQuery || statusFilter !== "todos" ? `Nenhum pedido encontrado` : "Nenhum pedido registrado no Maxiprod"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredPedidos.map((pedido) => (
              <div key={pedido.pedido} className="group">
                <button
                  onClick={() => setExpandedPedido(expandedPedido === pedido.pedido ? null : pedido.pedido)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400">#{pedido.pedido}</span>
                      <p className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {pedido.cliente}
                      </p>
                      {pedido.uf && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0">
                          {pedido.uf}
                        </span>
                      )}
                      {pedido.estadoNota && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0 ${
                          pedido.estadoNota === "Aprovado" ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                          pedido.estadoNota === "Faturado" ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                          pedido.estadoNota === "Digitação" ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                          "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                        }`}>
                          {pedido.estadoNota}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400">
                        {pedido.dataEmissao ? formatDateSales(pedido.dataEmissao) : ""}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        · {pedido.qtdItens} ite{pedido.qtdItens !== 1 ? "ns" : "m"}
                      </span>
                      {pedido.condicaoPagamento && (
                        <span className="text-[10px] text-slate-400 hidden sm:inline">
                          · Pgto: {pedido.condicaoPagamento}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-xs md:text-sm font-bold text-green-700 dark:text-green-400">
                      {formatCurrencySales(pedido.valorTotal)}
                    </p>
                  </div>
                  {/* Botão Simular Frete - para pedidos em Digitação ou A aprovar */}
                  {canCotarFrete && (pedido.estadoNota === "Digitação" || pedido.estadoNota === "A aprovar" || pedido.estadoNota === "Aprovado") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFreightPedido(pedido.pedido);
                        quoteByPedidoMutation.mutate({ pedido: pedido.pedido });
                      }}
                      disabled={quoteByPedidoMutation.isPending && freightPedido === pedido.pedido}
                      className="ml-1 px-2 py-1 rounded-md text-[10px] font-bold bg-teal-50 text-teal-600 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50 transition-colors flex items-center gap-1 flex-shrink-0 cursor-pointer disabled:opacity-50"
                      title="Simular frete nas 5 transportadoras"
                    >
                      {quoteByPedidoMutation.isPending && freightPedido === pedido.pedido ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Truck className="w-3 h-3" />
                      )}
                      <span className="hidden sm:inline">Simular Frete</span>
                    </button>
                  )}
                  {/* Botão Rastrear - só para pedidos faturados com transportadora */}
                  {(pedido.estadoNota === "Faturado" || pedido.estadoNota === "Faturado c/ entrega futura") && pedido.transportadora && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTrackingPedido(pedido.pedido);
                        trackAlfaMutation.mutate({ pedido: pedido.pedido });
                      }}
                      className="ml-1 px-2 py-1 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1 flex-shrink-0 cursor-pointer"
                      title="Rastrear entrega via Alfa Transportes"
                    >
                      <Truck className="w-3 h-3" />
                      <span className="hidden sm:inline">Rastrear</span>
                    </button>
                  )}
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${
                    expandedPedido === pedido.pedido ? "rotate-180" : ""
                  }`} />
                </button>

                {/* Detalhes expandidos do pedido */}
                {expandedPedido === pedido.pedido && (
                  <div className="px-4 pb-3 ml-4 border-l-2 border-teal-200 dark:border-teal-800">
                    {pedido.itens && pedido.itens.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Itens do Pedido</p>
                        {pedido.itens.map((item: { descricao: string; estadoItem: string; quantidade: number; valorUnitario: number; valorTotal: number; unidade: string }, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-slate-700 dark:text-slate-200 truncate text-sm font-semibold">
                                {item.descricao}
                              </p>
                              <p className="text-xs text-slate-400">
                                {item.quantidade} {item.unidade || ""} × {formatCurrencySales(item.valorUnitario)}
                              </p>
                            </div>
                            <div className="text-right ml-2 flex-shrink-0">
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {formatCurrencySales(item.valorTotal)}
                              </p>
                              {item.estadoItem && (
                                <p className="text-[10px] text-slate-400">{item.estadoItem}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Info adicional */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-xs">
                      {pedido.transportadora && (
                        <div className="flex items-start gap-1.5">
                          <Ship className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-600 dark:text-slate-300 truncate">{pedido.transportadora}</span>
                        </div>
                      )}
                      {pedido.dataEntrega && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="text-slate-400 text-[10px]">Entrega:</span>
                          <span className="text-slate-600 dark:text-slate-300 text-[10px]">{formatDateSales(pedido.dataEntrega)}</span>
                        </div>
                      )}
                      {pedido.observacoes && (
                        <div className="flex items-start gap-1.5 col-span-2 sm:col-span-3">
                          <span className="text-slate-400 text-[10px] font-medium">Obs:</span>
                          <span className="text-slate-600 dark:text-slate-300 text-[10px]">{pedido.observacoes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

/**
 * NewOrderInline - Formulário inline para criar novo pedido de venda
 * Puxa produtos do estoque visível do vendedor com especificações
 */
function NewOrderInline({ sellerId, sellerName, canSkipClient = false, editOrderId = null, onClose }: { sellerId: number; sellerName: string; canSkipClient?: boolean; editOrderId?: number | null; onClose: () => void }) {
  const isEditMode = editOrderId !== null;
  const [isSimulation, setIsSimulation] = useState(false);
  const [step, setStep] = useState<"cliente" | "produtos" | "pagamento" | "revisao" | "resumo_final">("cliente");
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState<number | null>(null);
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState<number | null>(null);
  const [editDataLoaded, setEditDataLoaded] = useState(false);
  const [showDadosComplementares, setShowDadosComplementares] = useState(false);
  
  // Client fields
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [tipoContribuinte, setTipoContribuinte] = useState("Contribuinte");
  const [regimeTributario, setRegimeTributario] = useState("Normal");
  const [emailNfe, setEmailNfe] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("");
  const [telefone1, setTelefone1] = useState("");
  const [telefone2, setTelefone2] = useState("");
  const [emailContato, setEmailContato] = useState("");
  const [segmento, setSegmento] = useState("");
  const [nomeContato, setNomeContato] = useState("");
  const [formaCobranca, setFormaCobranca] = useState("");
  const [fornecedorAtual, setFornecedorAtual] = useState("");
  const [observacoesCliente, setObservacoesCliente] = useState("");
  // Dados Fiscais extras
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [inscricaoSuframa, setInscricaoSuframa] = useState("");
  const [situacaoFiscalEspecial, setSituacaoFiscalEspecial] = useState("Nenhuma");
  const [cnaeFiscal, setCnaeFiscal] = useState("");
  const [websiteCliente, setWebsiteCliente] = useState("");
  // Dados de Venda
  const [limiteCredito, setLimiteCredito] = useState("");
  const [tabelaPrecos, setTabelaPrecos] = useState("");
  // CRM / Relacionamento
  const [regiao, setRegiao] = useState("");
  const [perfil, setPerfil] = useState("");
  const [formaPedido, setFormaPedido] = useState("");
  const [produtosInteresse, setProdutosInteresse] = useState("");
  const [probabilidadeNegocio, setProbabilidadeNegocio] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [atencao, setAtencao] = useState("Normal");
  // Cobrança
  const [situacaoCobranca, setSituacaoCobranca] = useState("SEM PROTESTO");
  // Redespacho
  const [possuiRedespacho, setPossuiRedespacho] = useState(false);
  const [redespachoCnpj, setRedespachoCnpj] = useState("");
  const [redespachoRazaoSocial, setRedespachoRazaoSocial] = useState("");
  const [redespachoCep, setRedespachoCep] = useState("");
  const [redespachoLogradouro, setRedespachoLogradouro] = useState("");
  const [redespachoNumero, setRedespachoNumero] = useState("");
  const [redespachoComplemento, setRedespachoComplemento] = useState("");
  const [redespachoBairro, setRedespachoBairro] = useState("");
  const [redespachoCidade, setRedespachoCidade] = useState("");
  const [redespachoUf, setRedespachoUf] = useState("");
  const [redespachoTelefone, setRedespachoTelefone] = useState("");
  // Endereço de entrega
  const [enderecoEntregaMesmo, setEnderecoEntregaMesmo] = useState(true);
  const [entregaCep, setEntregaCep] = useState("");
  const [entregaLogradouro, setEntregaLogradouro] = useState("");
  const [entregaNumero, setEntregaNumero] = useState("");
  const [entregaComplemento, setEntregaComplemento] = useState("");
  const [entregaBairro, setEntregaBairro] = useState("");
  const [entregaCidade, setEntregaCidade] = useState("");
  const [entregaUf, setEntregaUf] = useState("");
  const [entregaTelefone, setEntregaTelefone] = useState("");

  // Products
  interface OrderItem {
    codigoItem: string;
    descricaoItem: string;
    quantidade: number;
    unidadeMedida: string;
    precoUnitario: number;
    precoMinimo: number | null;
    precoVendedor: number | null;
    grupo: string;
    disponivel: string;
    pesoBrutoCaixa?: number; // peso bruto por caixa em kg
    dimsStr?: string; // "LxAxP" em cm
  }
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [reservePO, setReservePO] = useState<{ codigoItem: string; descricaoItem: string; referencia: string; dataEntrega: string; quantidade: number } | null>(null);
  // Product pricing calculator state: { [codigoItem]: { discount%, finalValue, quantity } }
  const [productCalc, setProductCalc] = useState<Record<string, { discount: string; finalValue: string; quantity: number; showQty: boolean; locked: boolean }>>({});
  const [editingCartIdx, setEditingCartIdx] = useState<number | null>(null);
  const [editCartQty, setEditCartQty] = useState(1);
  const [editCartPrice, setEditCartPrice] = useState("");

  // Manager override for monthly margin block
  const [monthlyOverrideApproved, setMonthlyOverrideApproved] = useState(false);
  const [showManagerPasswordInput, setShowManagerPasswordInput] = useState(false);
  const [showMonthlyDetailsInline, setShowMonthlyDetailsInline] = useState(false);
  const [managerPassword, setManagerPassword] = useState("");
  const [managerPasswordError, setManagerPasswordError] = useState("");
  const [approvedByManager, setApprovedByManager] = useState("");
  const verifyManagerMutation = trpc.salesOrders.verifyManagerPassword.useMutation();

  const startEditCartItem = (idx: number) => {
    const item = items[idx];
    if (item) {
      // Remove item from cart and restore it to the product list with pre-filled calc
      const precoVendedor = item.precoVendedor || 0;
      const precoBase = precoVendedor || item.precoMinimo || 0;
      const discountPct = precoBase > 0 && item.precoUnitario < precoBase
        ? (((precoBase - item.precoUnitario) / precoBase) * 100).toFixed(1)
        : '';
      // Pre-fill the calculator with the item's current values
      setProductCalc(prev => ({
        ...prev,
        [item.codigoItem]: {
          discount: discountPct ? String(discountPct) : '',
          finalValue: !discountPct ? String(item.precoUnitario) : '',
          quantity: item.quantidade,
          showQty: true,
          locked: true,
        }
      }));
      // Remove from cart
      setItems(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const saveCartEdit = (idx: number) => {
    const price = Number(editCartPrice.replace(',', '.')) || 0;
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantidade: editCartQty, precoUnitario: price } : item));
    setEditingCartIdx(null);
  };

  // Payment
  const [condicaoPagamento, setCondicaoPagamento] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [tipoFrete, setTipoFrete] = useState("CIF");
  const [observacoes, setObservacoes] = useState("");
  const [observacoesInternas, setObservacoesInternas] = useState("");
  const [transportadoraSelecionada, setTransportadoraSelecionada] = useState("");
  const [protocoloCotacao, setProtocoloCotacao] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  // Campos Maxiprod
  const [operacaoFiscal, setOperacaoFiscal] = useState("6101 - Fora do Estado - Madeira");
  const [naturezaOperacao, setNaturezaOperacao] = useState("Venda de produção do estabelecimento");
  const [estadoConfiguravel, setEstadoConfiguravel] = useState("MADEIRA");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [dataEntregaPedido, setDataEntregaPedido] = useState("");
  const [previsaoEntregaPedido, setPrevisaoEntregaPedido] = useState("");

  // === ORDER DRAFT PERSISTENCE ===
  const { draft, saveDraft, clearDraft } = useOrderDraft();

  // Load draft on mount (only for new orders, not edits)
  useEffect(() => {
    if (isEditMode) return;
    if (draft && draft.sellerId === sellerId && draft.items.length > 0) {
      setItems(draft.items as OrderItem[]);
      if (draft.client) {
        setCnpjCpf(draft.client.cnpjCpf || "");
        setRazaoSocial(draft.client.razaoSocial || "");
        setNomeFantasia(draft.client.nomeFantasia || "");
        setInscricaoEstadual(draft.client.inscricaoEstadual || "");
        setCep(draft.client.cep || "");
        setEndereco(draft.client.endereco || "");
        setNumero(draft.client.numero || "");
        setComplemento(draft.client.complemento || "");
        setBairro(draft.client.bairro || "");
        setMunicipio(draft.client.municipio || "");
        setUf(draft.client.uf || "");
        setTelefone1(draft.client.telefone1 || "");
        setEmailNfe(draft.client.emailNfe || "");
        setSegmento(draft.client.segmento || "");
        setTipoContribuinte(draft.client.tipoContribuinte || "Contribuinte");
        setRegimeTributario(draft.client.regimeTributario || "Normal");
      }
      if (draft.observacoes) setObservacoes(draft.observacoes);
      if (draft.formaPagamento) setFormaPagamento(draft.formaPagamento);
      if (draft.condicaoPagamento) setCondicaoPagamento(draft.condicaoPagamento);
      if (draft.step) setStep(draft.step);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft whenever items or client data changes
  useEffect(() => {
    if (isEditMode || orderSubmitted) return;
    if (items.length === 0 && !cnpjCpf) return; // nothing to save
    const clientData: DraftClientData | null = cnpjCpf ? {
      cnpjCpf, razaoSocial, nomeFantasia, inscricaoEstadual,
      cep, endereco, numero, complemento, bairro, municipio, uf,
      telefone1, emailNfe, segmento, tipoContribuinte, regimeTributario
    } : null;
    saveDraft({
      sellerId,
      sellerName,
      step,
      items: items as DraftOrderItem[],
      client: clientData,
      observacoes,
      formaPagamento,
      condicaoPagamento,
      updatedAt: Date.now()
    });
  }, [items, cnpjCpf, razaoSocial, step, observacoes, formaPagamento, condicaoPagamento]); // eslint-disable-line react-hooks/exhaustive-deps

  // Queries
  const clientSearchQuery = trpc.salesOrders.searchClients.useQuery(
    { query: clientSearch, sellerId },
    { enabled: clientSearch.length >= 1 }
  );
  const productsQuery = trpc.salesOrders.getProductsForSeller.useQuery({ sellerId });
  const createOrderMutation = trpc.salesOrders.createOrder.useMutation();
  const updateOrderMutation = trpc.salesOrders.updateOrder.useMutation();
  const deleteOrderMutation = trpc.salesOrders.deleteOrder.useMutation();
  // Load existing order data for edit mode
  const editOrderQuery = trpc.salesOrders.getOrderDetails.useQuery(
    { orderId: editOrderId! },
    { enabled: isEditMode && !editDataLoaded }
  );
  // Monthly weighted-average margin query (Level 3 commission)
  const monthlyMarginInput = useMemo(() => ({
    sellerId,
    pendingOrder: items.length > 0 ? {
      items: items.map(i => ({ codigoItem: i.codigoItem, quantidade: i.quantidade, precoUnitario: i.precoUnitario })),
      ufDestino: uf || "MG",
      tipoContribuinte: tipoContribuinte || "Contribuinte",
      freteValor: Number(valorFrete) || 0,
      gastosAdicionais: 0,
    } : undefined,
  }), [sellerId, items, uf, tipoContribuinte, valorFrete]);
  const monthlyMarginQuery = trpc.salesOrders.getSellerMonthlyMargin.useQuery(
    monthlyMarginInput,
    { enabled: !isSimulation && items.length > 0, staleTime: 30 * 1000 }
  );
  const monthlyDiscountQuery = trpc.salesOrders.getSellerMonthlyDiscount.useQuery(
    { sellerId },
    { enabled: !isSimulation && items.length > 0, staleTime: 60 * 1000 }
  );
  const utils = trpc.useUtils();

  // Prefill form when editing an existing order
  useEffect(() => {
    if (isEditMode && editOrderQuery.data && !editDataLoaded) {
      const { order, items: orderItems } = editOrderQuery.data;
      // Client fields
      setCnpjCpf(order.cnpjCpf || "");
      setRazaoSocial(order.razaoSocial || "");
      setNomeFantasia(order.nomeFantasia || "");
      setInscricaoEstadual(order.inscricaoEstadual || "");
      setTipoContribuinte(order.tipoContribuinte || "");
      setRegimeTributario(order.regimeTributario || "");
      setEmailNfe(order.emailNfe || "");
      setCep(order.cep || "");
      setEndereco(order.endereco || "");
      setNumero(order.numero || "");
      setComplemento(order.complemento || "");
      setBairro(order.bairro || "");
      setMunicipio(order.municipio || "");
      setUf(order.uf || "");
      setTelefone1(order.telefone1 || "");
      setTelefone2(order.telefone2 || "");
      setEmailContato(order.emailContato || "");
      setSegmento(order.segmento || "");
      setNomeContato(order.nomeContato || "");
      setFormaCobranca(order.formaCobranca || "");
      setFornecedorAtual(order.fornecedorAtual || "");
      setInscricaoMunicipal(order.inscricaoMunicipal || "");
      setInscricaoSuframa(order.inscricaoSuframa || "");
      setSituacaoFiscalEspecial(order.situacaoFiscalEspecial || "Nenhuma");
      setCnaeFiscal(order.cnaeFiscal || "");
      setWebsiteCliente(order.website || "");
      setLimiteCredito(order.limiteCredito || "");
      setTabelaPrecos(order.tabelaPrecos || "");
      // Payment fields
      setCondicaoPagamento(order.condicaoPagamento || "");
      setValorFrete(order.valorFrete || "");
      setTipoFrete(order.tipoFrete || "CIF");
      setObservacoes(order.observacoes || "");
      setOperacaoFiscal(order.operacaoFiscal || "6101 - Fora do Estado - Madeira");
      setNaturezaOperacao(order.naturezaOperacao || "Venda de produção do estabelecimento");
      setEstadoConfiguravel(order.estadoConfiguravel || "MADEIRA");
      setFormaPagamento(order.formaPagamento || "");
      setDataEntregaPedido(order.dataEntrega || "");
      setPrevisaoEntregaPedido(order.previsaoEntrega || "");
      // CRM fields
      setRegiao(order.regiao || "");
      setPerfil(order.perfil || "");
      setFormaPedido(order.formaPedido || "");
      setProdutosInteresse(order.produtos || "");
      setProbabilidadeNegocio(order.probabilidadeNegocio || "");
      setTamanho(order.tamanho || "");
      setAtencao(order.atencao || "Normal");
      setSituacaoCobranca(order.situacaoCobranca || "SEM PROTESTO");
      // Redespacho
      setPossuiRedespacho(order.possuiRedespacho || false);
      setRedespachoCnpj(order.redespachoCnpj || "");
      setRedespachoRazaoSocial(order.redespachoRazaoSocial || "");
      setRedespachoCep(order.redespachoCep || "");
      setRedespachoLogradouro(order.redespachoLogradouro || "");
      setRedespachoNumero(order.redespachoNumero || "");
      setRedespachoComplemento(order.redespachoComplemento || "");
      setRedespachoBairro(order.redespachoBairro || "");
      setRedespachoCidade(order.redespachoCidade || "");
      setRedespachoUf(order.redespachoUf || "");
      setRedespachoTelefone(order.redespachoTelefone || "");
      // Entrega
      setEnderecoEntregaMesmo(order.enderecoEntregaMesmo ?? true);
      setEntregaCep(order.entregaCep || "");
      setEntregaLogradouro(order.entregaLogradouro || "");
      setEntregaNumero(order.entregaNumero || "");
      setEntregaComplemento(order.entregaComplemento || "");
      setEntregaBairro(order.entregaBairro || "");
      setEntregaCidade(order.entregaCidade || "");
      setEntregaUf(order.entregaUf || "");
      setEntregaTelefone(order.entregaTelefone || "");
      // Items
      setItems(orderItems.map((item: any) => ({
        codigoItem: item.codigoItem,
        descricaoItem: item.descricaoItem,
        quantidade: Number(item.quantidade),
        unidadeMedida: item.unidadeMedida || "CX",
        precoUnitario: Number(item.precoUnitario),
        precoMinimo: item.precoMinimo ? Number(item.precoMinimo) : null,
        precoVendedor: null,
        grupo: "",
        disponivel: "",
      })));
      setIsSimulation((order as any).isSimulation || false);
      setStep("produtos");
      setEditDataLoaded(true);
    }
  }, [isEditMode, editOrderQuery.data, editDataLoaded]);

  // Margin bar state - controlled per seller via seller_permissions table
  const { operator: marginOperator, hasAccess: marginHasAccess, hasGranularAccess } = useOperator();
  // Real costs from CustosDeVendaStep (step 3)
  const [realComissaoPerc, setRealComissaoPerc] = useState<number | null>(null);
  const [realFretePerc, setRealFretePerc] = useState<number | null>(null);
  const [realMargemPerc, setRealMargemPerc] = useState<number | null>(null);
  const [realComissaoFonte, setRealComissaoFonte] = useState<string | null>(null);
  const [realComissaoTier, setRealComissaoTier] = useState<string | null>(null);
  const [marginRecalculated, setMarginRecalculated] = useState(false);
  const sellerPermsQuery = trpc.sales.listSellerPermissions.useQuery();
  const currentSellerPerm = sellerPermsQuery.data?.find(
    (p: any) => p.sellerName.toLowerCase() === sellerName.toLowerCase()
  );
  // Margin bar visible for everyone (sellers and gestores)
  const isGestorMode = !!marginOperator;
  // Gestores accessing via /gestao-comercial/vendedor/:id should NOT be blocked by monthly margin
  // Block only applies to vendedores using the seller app (/app-vendedor route)
  const isSellerAppRoute = window.location.pathname.startsWith('/app-vendedor');
  const isMonthlyMarginBlockActive = isSellerAppRoute && isGestorMode && !isSimulation;
  const showMarginBar = hasGranularAccess("gc.barraProduto"); // barra de desconto por produto
  const showMarginValues = currentSellerPerm?.showMarginValues === true; // default false
  // Real cost bar (reputação) - only visible for operators with gc.barraComissao permission AND specific operators
  const showRealCostBar = hasGranularAccess("gc.barraComissao") && (marginOperator?.name === "Guilherme" || marginOperator?.name === "Fernando" || marginOperator?.name === "Juvenal" || marginOperator?.name === "Bruno" || marginOperator?.name === "Renato");
  const [marginComissao, setMarginComissao] = useState(5.85);
  const [marginFrete, setMarginFrete] = useState(13);
  const [marginCustosAdicionais, setMarginCustosAdicionais] = useState(0);
  const [marginUfSimulacao, setMarginUfSimulacao] = useState(uf || "MG");
  // Auto-sync: whenever the client UF changes (from selection, draft restore, edit, or manual input),
  // update the margin simulation UF to match
  useEffect(() => {
    if (uf) setMarginUfSimulacao(uf);
  }, [uf]);
  // Fetch product costs for margin calculation
  const validTipoContrib = ["Contribuinte", "Não contribuinte", "Isento"].includes(tipoContribuinte || "") 
    ? (tipoContribuinte as "Contribuinte" | "Não contribuinte" | "Isento") 
    : "Contribuinte";
  const productMarginsQuery = trpc.salesOrders.getProductMargins.useQuery(
    { ufDestino: marginUfSimulacao || "MG", tipoContribuinte: validTipoContrib },
    { enabled: showRealCostBar, staleTime: 60 * 1000 }
  );

  const [selectedClientName, setSelectedClientName] = useState("");
  const [clientInfoExpanded, setClientInfoExpanded] = useState(false);
  const [vendorClientId, setVendorClientId] = useState<number | null>(null);
  const [showClientValidationError, setShowClientValidationError] = useState(false);

  // Client history query - fires when a client is selected
  const clientHistoryQuery = trpc.salesOrders.getClientHistory.useQuery(
    { clientName: selectedClientName },
    { enabled: selectedClientName.length >= 3 }
  );

  // Last order items query - for "Repetir Último Pedido" feature
  const lastOrderQuery = trpc.salesOrders.getLastOrderItems.useQuery(
    { clientName: selectedClientName, cnpjCpf: cnpjCpf || undefined },
    { enabled: selectedClientName.length >= 3 && items.length === 0 }
  );

  const updateVendorClientMutation = trpc.sales.updateVendorClient.useMutation();

  const selectClient = (client: any) => {
    setCnpjCpf(client.cnpjCpf || "");
    setRazaoSocial(client.razaoSocial || "");
    setNomeFantasia(client.nomeFantasia || "");
    setInscricaoEstadual(client.inscricaoEstadual || "");
    setTipoContribuinte(client.tipoContribuinte || "Contribuinte");
    setRegimeTributario(client.regimeTributario || "Normal");
    setEmailNfe(client.emailNfe || "");
    setCep(client.cep || "");
    setEndereco(client.endereco || "");
    setNumero(client.numero || "");
    setComplemento(client.complemento || "");
    setBairro(client.bairro || "");
    setMunicipio(client.municipio || "");
    setUf(client.uf || "");
    // Auto-sync UF to margin simulation bar (step 2)
    if (client.uf) setMarginUfSimulacao(client.uf);
    setTelefone1(client.telefone1 || "");
    setTelefone2(client.telefone2 || "");
    setEmailContato(client.emailContato || "");
    setSegmento(client.segmento || "");
    setNomeContato(client.nomeContato || "");
    setFormaCobranca(client.formaCobranca || "");
    setFornecedorAtual(client.fornecedorAtual || "");
    setObservacoesCliente(client.observacoes || "");
    // Dados Fiscais extras
    setInscricaoMunicipal(client.inscricaoMunicipal || "");
    setInscricaoSuframa(client.inscricaoSuframa || "");
    setSituacaoFiscalEspecial(client.situacaoFiscalEspecial || "Nenhuma");
    setCnaeFiscal(client.cnaeFiscal || "");
    setWebsiteCliente(client.website || "");
    // Dados de Venda
    setLimiteCredito(client.limiteCredito || "");
    setTabelaPrecos(client.tabelaPrecos || "");
    // CRM
    setRegiao(client.regiao || "");
    setPerfil(client.perfil || "");
    setFormaPedido(client.formaPedido || "");
    setProdutosInteresse(client.produtos || "");
    setProbabilidadeNegocio(client.probabilidadeNegocio || "");
    setTamanho(client.tamanho || "");
    setAtencao(client.atencao || "Normal");
    // Cobrança
    setSituacaoCobranca(client.situacaoCobranca || "SEM PROTESTO");
    // Redespacho
    setPossuiRedespacho(!!client.possuiRedespacho);
    setRedespachoCnpj(client.redespachoCnpj || "");
    setRedespachoRazaoSocial(client.redespachoRazaoSocial || "");
    setRedespachoCep(client.redespachoCep || "");
    setRedespachoLogradouro(client.redespachoLogradouro || "");
    setRedespachoNumero(client.redespachoNumero || "");
    setRedespachoComplemento(client.redespachoComplemento || "");
    setRedespachoBairro(client.redespachoBairro || "");
    setRedespachoCidade(client.redespachoCidade || "");
    setRedespachoUf(client.redespachoUf || "");
    setRedespachoTelefone(client.redespachoTelefone || "");
    // Endereço de entrega
    setEnderecoEntregaMesmo(client.enderecoEntregaMesmo !== false);
    setEntregaCep(client.entregaCep || "");
    setEntregaLogradouro(client.entregaLogradouro || "");
    setEntregaNumero(client.entregaNumero || "");
    setEntregaComplemento(client.entregaComplemento || "");
    setEntregaBairro(client.entregaBairro || "");
    setEntregaCidade(client.entregaCidade || "");
    setEntregaUf(client.entregaUf || "");
    setEntregaTelefone(client.entregaTelefone || "");
    // Cond. pagamento do cliente (preenche automaticamente)
    if (client.condicaoPagamento && !condicaoPagamento) {
      setCondicaoPagamento(client.condicaoPagamento);
    }
    // Auto-fill formaPagamento from client's formaCobranca
    if (client.formaCobranca && !formaPagamento) {
      const fc = client.formaCobranca.toLowerCase();
      if (fc.includes('boleto')) {
        setFormaPagamento('Boleto');
      } else if (fc.includes('prazo')) {
        setFormaPagamento('A prazo');
      } else if (fc.includes('pix')) {
        setFormaPagamento('PIX');
      } else if (fc.includes('depósito') || fc.includes('deposito')) {
        setFormaPagamento('Depósito');
      } else if (fc.includes('cartão') || fc.includes('cartao')) {
        setFormaPagamento('Cartão');
      } else {
        setFormaPagamento('À vista');
      }
    }
    setVendorClientId(client.vendorClientId || null);
    setShowClientDropdown(false);
    setClientSearch("");
    setShowClientValidationError(false);
    // Set client name for history lookup
    setSelectedClientName(client.razaoSocial || client.nomeFantasia || "");
  };

  // Filtered products for selection
  const availableProducts = useMemo(() => {
    if (!productsQuery.data) return [];
    const addedCodes = new Set(items.map(i => i.codigoItem));
    let filtered = productsQuery.data.filter((p: any) => !addedCodes.has(p.codigoItem));
    if (productSearch.trim()) {
      const s = productSearch.trim().toLowerCase();
      filtered = filtered.filter((p: any) => {
        const searchable = [
          p.codigoItem,
          p.descricaoItem,
          p.codigoBarras || "",
          p.grupo || "",
        ].join(" ").toLowerCase();
        return searchable.includes(s);
      });
    }
    return filtered;
  }, [productsQuery.data, items, productSearch]);

  const addProduct = (product: any, customPrice?: number, customQty?: number) => {
    const precoVendedor = product.precoVendedor ? Number(product.precoVendedor) : null;
    const precoUnit = customPrice || precoVendedor || (product.precoMinimo ? Number(product.precoMinimo) : 0);
    const qty = customQty || 1;
    const fatorProd = Number(product.unidadeDeVendaFator) || 1;
    const pesoBrutoCaixa = product.pesoBruto && Number(product.pesoBruto) > 0 ? Number(product.pesoBruto) * fatorProd : undefined;
    const dimsMatch = product.descricaoComplementar ? product.descricaoComplementar.match(/([\d,.]+)[xX]([\d,.]+)[xX]([\d,.]+)/) : null;
    const dimsStr = dimsMatch ? `${dimsMatch[1]}x${dimsMatch[2]}x${dimsMatch[3]}` : undefined;
    setItems(prev => [...prev, {
      codigoItem: product.codigoItem,
      descricaoItem: product.descricaoItem,
      quantidade: qty,
      unidadeMedida: product.unidadeMedida || "CX",
      precoUnitario: precoUnit,
      precoMinimo: product.precoMinimo ? Number(product.precoMinimo) : null,
      precoVendedor: precoVendedor,
      grupo: product.grupo || "",
      disponivel: product.disponivel || "0",
      pesoBrutoCaixa,
      dimsStr,
    }]);
    setProductSearch("");
    // Clear calculator state for this product
    setProductCalc(prev => { const next = { ...prev }; delete next[product.codigoItem]; return next; });
  };

  const removeProduct = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const totalProdutos = items.reduce((sum, item) => sum + item.quantidade * item.precoUnitario, 0);
  const totalPedido = totalProdutos; // Frete NÃO é somado ao valor do pedido (empresa paga frete em pedidos > R$2000)
  const hasPrecoAbaixo = items.some(item => item.precoMinimo !== null && item.precoUnitario < item.precoMinimo);
  const [showBelowMinConfirm, setShowBelowMinConfirm] = useState(false);

  // Items below minimum for the confirmation modal
  const itemsBelowMin = items.filter(item => item.precoMinimo !== null && item.precoUnitario < item.precoMinimo);

  const doSubmitOrder = (forceSubmitBelowMin?: boolean) => {
    // UF validation: only block in gestor mode. Sellers' orders go to gestor review,
    // so the gestor can add UF before processing in Maxiprod.
    if (!isSimulation && !uf.trim() && isGestorMode) {
      alert("Preencha a UF (estado) do cliente antes de finalizar o pedido. A UF é obrigatória para o cálculo correto de impostos.");
      return;
    }
    if (!formaPagamento) {
      alert("Selecione a Forma de Pagamento antes de finalizar o pedido.");
      return;
    }
    if (formaPagamento === "A prazo" && !condicaoPagamento) {
      alert("Preencha a Condição de Pagamento (ex: 21/35 ou 30/60/90) para pagamentos a prazo.");
      return;
    }
    if (isEditMode && editOrderId) {
      // Update existing order
      updateOrderMutation.mutate({
        orderId: editOrderId,
        cnpjCpf: isSimulation ? (cnpjCpf || "SIMULACAO") : cnpjCpf,
        razaoSocial: isSimulation ? (razaoSocial || "SIMULAÇÃO - " + sellerName) : razaoSocial,
        nomeFantasia: nomeFantasia || undefined,
        inscricaoEstadual: inscricaoEstadual || undefined,
        tipoContribuinte: tipoContribuinte || undefined,
        regimeTributario: regimeTributario || undefined,
        emailNfe: emailNfe || undefined,
        cep: cep || undefined,
        endereco: endereco || undefined,
        numero: numero || undefined,
        complemento: complemento || undefined,
        bairro: bairro || undefined,
        municipio: municipio || undefined,
        uf: uf || undefined,
        telefone1: telefone1 || undefined,
        telefone2: telefone2 || undefined,
        emailContato: emailContato || undefined,
        segmento: segmento || undefined,
        nomeContato: nomeContato || undefined,
        formaCobranca: formaCobranca || undefined,
        fornecedorAtual: fornecedorAtual || undefined,
        inscricaoMunicipal: inscricaoMunicipal || undefined,
        inscricaoSuframa: inscricaoSuframa || undefined,
        situacaoFiscalEspecial: situacaoFiscalEspecial !== "Nenhuma" ? situacaoFiscalEspecial : undefined,
        cnaeFiscal: cnaeFiscal || undefined,
        website: websiteCliente || undefined,
        limiteCredito: limiteCredito || undefined,
        tabelaPrecos: tabelaPrecos || undefined,
        condicaoPagamento: condicaoPagamento || undefined,
        valorFrete: Number(valorFrete) || undefined,
        tipoFrete: tipoFrete || undefined,
        observacoes: observacoes || undefined,
        operacaoFiscal: operacaoFiscal || undefined,
        naturezaOperacao: naturezaOperacao || undefined,
        estadoConfiguravel: estadoConfiguravel || undefined,
        formaPagamento: formaPagamento || undefined,
        dataEntrega: dataEntregaPedido || undefined,
        previsaoEntrega: previsaoEntregaPedido || undefined,
        regiao: regiao || undefined,
        perfil: perfil || undefined,
        formaPedido: formaPedido || undefined,
        produtos: produtosInteresse || undefined,
        probabilidadeNegocio: probabilidadeNegocio || undefined,
        tamanho: tamanho || undefined,
        atencao: atencao !== "Normal" ? atencao : undefined,
        situacaoCobranca: situacaoCobranca !== "SEM PROTESTO" ? situacaoCobranca : undefined,
        possuiRedespacho: possuiRedespacho || undefined,
        redespachoCnpj: possuiRedespacho ? (redespachoCnpj || undefined) : undefined,
        redespachoRazaoSocial: possuiRedespacho ? (redespachoRazaoSocial || undefined) : undefined,
        redespachoCep: possuiRedespacho ? (redespachoCep || undefined) : undefined,
        redespachoLogradouro: possuiRedespacho ? (redespachoLogradouro || undefined) : undefined,
        redespachoNumero: possuiRedespacho ? (redespachoNumero || undefined) : undefined,
        redespachoComplemento: possuiRedespacho ? (redespachoComplemento || undefined) : undefined,
        redespachoBairro: possuiRedespacho ? (redespachoBairro || undefined) : undefined,
        redespachoCidade: possuiRedespacho ? (redespachoCidade || undefined) : undefined,
        redespachoUf: possuiRedespacho ? (redespachoUf || undefined) : undefined,
        redespachoTelefone: possuiRedespacho ? (redespachoTelefone || undefined) : undefined,
        enderecoEntregaMesmo: enderecoEntregaMesmo,
        entregaCep: !enderecoEntregaMesmo ? (entregaCep || undefined) : undefined,
        entregaLogradouro: !enderecoEntregaMesmo ? (entregaLogradouro || undefined) : undefined,
        entregaNumero: !enderecoEntregaMesmo ? (entregaNumero || undefined) : undefined,
        entregaComplemento: !enderecoEntregaMesmo ? (entregaComplemento || undefined) : undefined,
        entregaBairro: !enderecoEntregaMesmo ? (entregaBairro || undefined) : undefined,
        entregaCidade: !enderecoEntregaMesmo ? (entregaCidade || undefined) : undefined,
        entregaUf: !enderecoEntregaMesmo ? (entregaUf || undefined) : undefined,
        entregaTelefone: !enderecoEntregaMesmo ? (entregaTelefone || undefined) : undefined,
        items: items.map(item => ({
          codigoItem: item.codigoItem,
          descricaoItem: item.descricaoItem,
          quantidade: item.quantidade,
          unidadeMedida: item.unidadeMedida,
          precoUnitario: item.precoUnitario,
        })),
      }, {
        onSuccess: (result) => {
          if (result.success) {
            utils.salesOrders.getSellerOrders.invalidate();
            setShowBelowMinConfirm(false);
            setOrderSubmitted(true);
            clearDraft();
            setSubmittedOrderId(result.orderId);
            setSubmittedOrderNumber(result.orderNumber);
            setStep("resumo_final");
          }
        },
      });
      return;
    }
    createOrderMutation.mutate({
      sellerId,
      cnpjCpf: isSimulation ? (cnpjCpf || "SIMULACAO") : cnpjCpf,
      razaoSocial: isSimulation ? (razaoSocial || "SIMULAÇÃO - " + sellerName) : razaoSocial,
      isSimulation,
      nomeFantasia: nomeFantasia || undefined,
      inscricaoEstadual: inscricaoEstadual || undefined,
      tipoContribuinte: tipoContribuinte || undefined,
      regimeTributario: regimeTributario || undefined,
      emailNfe: emailNfe || undefined,
      cep: cep || undefined,
      endereco: endereco || undefined,
      numero: numero || undefined,
      complemento: complemento || undefined,
      bairro: bairro || undefined,
      municipio: municipio || undefined,
      uf: uf || undefined,
      telefone1: telefone1 || undefined,
      telefone2: telefone2 || undefined,
      emailContato: emailContato || undefined,
      segmento: segmento || undefined,
      nomeContato: nomeContato || undefined,
      formaCobranca: formaCobranca || undefined,
      fornecedorAtual: fornecedorAtual || undefined,
      // Dados Fiscais extras
      inscricaoMunicipal: inscricaoMunicipal || undefined,
      inscricaoSuframa: inscricaoSuframa || undefined,
      situacaoFiscalEspecial: situacaoFiscalEspecial !== "Nenhuma" ? situacaoFiscalEspecial : undefined,
      cnaeFiscal: cnaeFiscal || undefined,
      website: websiteCliente || undefined,
      // Dados de Venda
      limiteCredito: limiteCredito || undefined,
      tabelaPrecos: tabelaPrecos || undefined,
      condicaoPagamento: condicaoPagamento || undefined,
      valorFrete: Number(valorFrete) || undefined,
      tipoFrete: tipoFrete || undefined,
      observacoes: observacoes || undefined,
      observacoesInternas: observacoesInternas || undefined,
      transportadora: transportadoraSelecionada || undefined,
      protocoloCotacao: protocoloCotacao || undefined,
      trackingUrl: trackingUrl || undefined,
      // Campos Maxiprod
      operacaoFiscal: operacaoFiscal || undefined,
      naturezaOperacao: naturezaOperacao || undefined,
      estadoConfiguravel: estadoConfiguravel || undefined,
      formaPagamento: formaPagamento || undefined,
      dataEntrega: dataEntregaPedido || undefined,
      previsaoEntrega: previsaoEntregaPedido || undefined,
      // CRM / Relacionamento
      regiao: regiao || undefined,
      perfil: perfil || undefined,
      formaPedido: formaPedido || undefined,
      produtos: produtosInteresse || undefined,
      probabilidadeNegocio: probabilidadeNegocio || undefined,
      tamanho: tamanho || undefined,
      atencao: atencao !== "Normal" ? atencao : undefined,
      // Cobrança
      situacaoCobranca: situacaoCobranca !== "SEM PROTESTO" ? situacaoCobranca : undefined,
      // Redespacho
      possuiRedespacho: possuiRedespacho || undefined,
      redespachoCnpj: possuiRedespacho ? (redespachoCnpj || undefined) : undefined,
      redespachoRazaoSocial: possuiRedespacho ? (redespachoRazaoSocial || undefined) : undefined,
      redespachoCep: possuiRedespacho ? (redespachoCep || undefined) : undefined,
      redespachoLogradouro: possuiRedespacho ? (redespachoLogradouro || undefined) : undefined,
      redespachoNumero: possuiRedespacho ? (redespachoNumero || undefined) : undefined,
      redespachoComplemento: possuiRedespacho ? (redespachoComplemento || undefined) : undefined,
      redespachoBairro: possuiRedespacho ? (redespachoBairro || undefined) : undefined,
      redespachoCidade: possuiRedespacho ? (redespachoCidade || undefined) : undefined,
      redespachoUf: possuiRedespacho ? (redespachoUf || undefined) : undefined,
      redespachoTelefone: possuiRedespacho ? (redespachoTelefone || undefined) : undefined,
      // Endereço de entrega
      enderecoEntregaMesmo: enderecoEntregaMesmo,
      entregaCep: !enderecoEntregaMesmo ? (entregaCep || undefined) : undefined,
      entregaLogradouro: !enderecoEntregaMesmo ? (entregaLogradouro || undefined) : undefined,
      entregaNumero: !enderecoEntregaMesmo ? (entregaNumero || undefined) : undefined,
      entregaComplemento: !enderecoEntregaMesmo ? (entregaComplemento || undefined) : undefined,
      entregaBairro: !enderecoEntregaMesmo ? (entregaBairro || undefined) : undefined,
      entregaCidade: !enderecoEntregaMesmo ? (entregaCidade || undefined) : undefined,
      entregaUf: !enderecoEntregaMesmo ? (entregaUf || undefined) : undefined,
      entregaTelefone: !enderecoEntregaMesmo ? (entregaTelefone || undefined) : undefined,
      forceSubmitBelowMin: forceSubmitBelowMin || false,
      // Comissão
      comissaoFonte: realComissaoFonte || undefined,
      comissaoPercentual: realComissaoPerc || undefined,
      comissaoTier: realComissaoTier || undefined,
      margemPercentual: realMargemPerc || undefined,
      items: items.map(item => ({
        codigoItem: item.codigoItem,
        descricaoItem: item.descricaoItem,
        quantidade: item.quantidade,
        unidadeMedida: item.unidadeMedida,
        precoUnitario: item.precoUnitario,
      })),
    }, {
      onSuccess: (result) => {
        if (result.success) {
          utils.salesOrders.getSellerOrders.invalidate();
          setShowBelowMinConfirm(false);
          setOrderSubmitted(true);
          clearDraft();
          setSubmittedOrderId(result.orderId);
          setSubmittedOrderNumber(result.orderNumber);
          setStep("resumo_final");
        }
      },
    });
  };

  const handleSubmit = () => {
    if (hasPrecoAbaixo) {
      // Show confirmation modal instead of submitting directly
      setShowBelowMinConfirm(true);
    } else {
      doSubmitOrder(false);
    }
  };

  // Export XLS for Maxiprod import (Pedido de Venda format)
  const exportOrderMaxiprodMutation = trpc.salesOrders.exportOrderMaxiprod.useMutation();
  const handleExportCSV = () => {
    if (!submittedOrderId) return;
    exportOrderMaxiprodMutation.mutate(
      { orderId: submittedOrderId },
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
          alert("Planilha Maxiprod exportada com sucesso!");
        },
        onError: (err) => {
          alert(err.message || "Erro ao exportar planilha Maxiprod");
        },
      }
    );
  };

  // Required fields for client (same as new client registration)
  const getClientMissingFields = () => {
    const missing: string[] = [];
    if (!cnpjCpf.trim()) missing.push("CNPJ/CPF");
    if (!cep.trim()) missing.push("CEP");
    if (!telefone1.trim()) missing.push("Telefone 1");
    if (!emailContato.trim()) missing.push("Email");
    return missing;
  };
  const clientMissingFields = getClientMissingFields();
  const canProceedCliente = clientMissingFields.length === 0;
  const canProceedProdutos = items.length > 0 && items.every(i => i.quantidade > 0 && i.precoUnitario > 0);

  const handleProceedToProducts = async () => {
    // Campos OBRIGATÓRIOS que bloqueiam: CNPJ, CEP, Telefone 1, Email (exceto Guilherme)
    if (!canSkipClient) {
      const strictMissing: string[] = [];
      if (!cnpjCpf.trim()) strictMissing.push("CNPJ/CPF");
      if (!cep.trim()) strictMissing.push("CEP");
      if (!telefone1.trim()) strictMissing.push("Telefone 1");
      if (!emailContato.trim()) strictMissing.push("Email");
      if (strictMissing.length > 0) {
        setShowClientValidationError(true);
        return; // Bloqueia avanço
      }
    }
    // Campos com asterisco continuam sinalizados, mas não bloqueiam o avanço
    if (!canProceedCliente) {
      setShowClientValidationError(true);
    } else {
      setShowClientValidationError(false);
    }
    // If this client came from vendor_clients, save any completed fields back
    if (vendorClientId) {
      try {
        await updateVendorClientMutation.mutateAsync({
          id: vendorClientId,
          cnpjCpf: cnpjCpf.trim() || undefined,
          razaoSocial: razaoSocial.trim() || undefined,
          inscricaoEstadual: inscricaoEstadual.trim() || undefined,
          cep: cep.trim() || undefined,
          logradouro: endereco.trim() || undefined,
          numero: numero.trim() || undefined,
          complemento: complemento.trim() || undefined,
          bairro: bairro.trim() || undefined,
          cidade: municipio.trim() || undefined,
          uf: uf.trim() || undefined,
          telefone1: telefone1.trim() || undefined,
          telefone2: telefone2.trim() || undefined,
          email: emailContato.trim() || undefined,
          segmento: segmento.trim() || undefined,
        });
      } catch (e) {
        // Silently continue - saving back is best-effort
        console.warn("Failed to update vendor client:", e);
      }
    }
    setStep("produtos");
  };

  const showCustosDeVenda = isGestorMode && hasGranularAccess("gc.custosDeVenda");
  const simulationSteps = isSimulation 
    ? (showCustosDeVenda ? ["produtos", "pagamento", "revisao"] as const : ["produtos", "revisao"] as const)
    : (showCustosDeVenda ? ["cliente", "produtos", "pagamento", "revisao"] as const : ["cliente", "produtos", "revisao"] as const);

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border-2 ${isSimulation ? 'border-amber-300 dark:border-amber-700' : 'border-teal-300 dark:border-teal-700'} shadow-lg overflow-hidden`}>
      {/* Header */}
      <div className={`${isSimulation ? 'bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800' : 'bg-teal-50 dark:bg-teal-900/30 border-b border-teal-200 dark:border-teal-800'} px-4 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className={`w-4 h-4 ${isSimulation ? 'text-amber-600' : 'text-teal-600'}`} />
            <h4 className={`text-sm font-bold ${isSimulation ? 'text-amber-800 dark:text-amber-200' : 'text-teal-800 dark:text-teal-200'}`}>
              {isSimulation ? 'Simular Pedido de Venda' : 'Novo Pedido de Venda'}
            </h4>
            {isSimulation && (
              <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-[10px] font-bold rounded-full">SIMULAÇÃO</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canSkipClient && (
              <button
                onClick={() => { setIsSimulation(!isSimulation); setStep(isSimulation ? 'cliente' : 'produtos'); }}
                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  isSimulation
                    ? 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
              >
                {isSimulation ? 'Pedido Real' : 'Simular'}
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-teal-100 dark:hover:bg-teal-800 rounded-lg">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
        {/* Progress */}
        <div className="flex gap-1 mt-2">
          {simulationSteps.map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full ${
                (step === "resumo_final" ? simulationSteps.length : simulationSteps.indexOf(step as any)) >= i
                  ? (isSimulation ? "bg-amber-500" : "bg-teal-500")
                  : "bg-slate-200 dark:bg-slate-600"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-4">
        {step === "cliente" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">1. Dados do Cliente</p>
            {/* Client search - autocomplete */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-500" />
              <input
                type="text"
                placeholder="Digite o nome, fantasia ou CNPJ do cliente..."
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                onFocus={() => { if (clientSearch.length >= 1) setShowClientDropdown(true); }}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                className="w-full pl-9 pr-3 py-3 text-sm border-2 border-teal-200 dark:border-teal-700 rounded-xl bg-teal-50/50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400"
              />
              {clientSearch.length >= 1 && clientSearchQuery.isLoading && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg p-3">
                  <p className="text-xs text-slate-400 text-center">Buscando clientes...</p>
                </div>
              )}
              {showClientDropdown && clientSearchQuery.data && clientSearchQuery.data.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-teal-200 dark:border-slate-600 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                  <div className="px-3 py-1.5 bg-teal-50 dark:bg-teal-900/30 border-b border-teal-100 dark:border-teal-800">
                    <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-400 uppercase">Clientes encontrados ({clientSearchQuery.data.length})</p>
                  </div>
                  {clientSearchQuery.data.map((c: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => selectClient(c)}
                      className="w-full text-left px-3 py-2.5 hover:bg-teal-50 dark:hover:bg-teal-900/20 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
                    >
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{c.razaoSocial}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {c.cnpjCpf ? (
                          <span className="text-[10px] text-slate-500 font-mono">{c.cnpjCpf}</span>
                        ) : (
                          <span className="text-[10px] italic text-slate-400">Sem CNPJ</span>
                        )}
                        {c.nomeFantasia && <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">{c.nomeFantasia}</span>}
                        {c.municipio && <span className="text-[10px] text-slate-400">{c.municipio}/{c.uf}</span>}
                        {c.telefone1 && <span className="text-[10px] text-slate-400">{c.telefone1}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showClientDropdown && clientSearch.length >= 1 && clientSearchQuery.data && clientSearchQuery.data.length === 0 && !clientSearchQuery.isLoading && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg p-3">
                  <p className="text-xs text-slate-400 text-center">Nenhum cliente encontrado. Preencha os dados manualmente abaixo.</p>
                </div>
              )}
            </div>

            {/* Consulta Serasa - Aparece imediatamente após selecionar o cliente */}
            {cnpjCpf && cnpjCpf.replace(/\D/g, "").length >= 11 && marginOperator?.name && hasGranularAccess("gc.consultaSerasa") && (
              <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 rounded-xl">
                <SerasaConsulta
                  documento={cnpjCpf}
                  clienteNome={razaoSocial || nomeFantasia}
                  operadorName={marginOperator.name}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <OrderFormInput label="CNPJ/CPF" value={cnpjCpf} onChange={(v) => { setCnpjCpf(v); setShowClientValidationError(false); }} placeholder="00.000.000/0001-00" required error={showClientValidationError} />
              <OrderFormInput label="Razão Social" value={razaoSocial} onChange={(v) => { setRazaoSocial(v); setShowClientValidationError(false); }} placeholder="Razão social do cliente" />
              <OrderFormInput label="Nome Fantasia" value={nomeFantasia} onChange={setNomeFantasia} placeholder="Nome fantasia" />
              <OrderFormInput label="Inscrição Estadual" value={inscricaoEstadual} onChange={(v) => { setInscricaoEstadual(v); setShowClientValidationError(false); }} placeholder="IE" />
              <OrderFormInput label="CEP" value={cep} onChange={(v) => { setCep(v); setShowClientValidationError(false); }} placeholder="00000-000" required error={showClientValidationError} />
              <OrderFormInput label="Endereço" value={endereco} onChange={(v) => { setEndereco(v); setShowClientValidationError(false); }} placeholder="Rua/Av" />
              <OrderFormInput label="Número" value={numero} onChange={(v) => { setNumero(v); setShowClientValidationError(false); }} placeholder="Nº" />
              <OrderFormInput label="Bairro" value={bairro} onChange={(v) => { setBairro(v); setShowClientValidationError(false); }} placeholder="Bairro" />
              <OrderFormInput label="Município" value={municipio} onChange={(v) => { setMunicipio(v); setShowClientValidationError(false); }} placeholder="Cidade" />
              <OrderFormInput label="UF" value={uf} onChange={(v) => { setUf(v); setShowClientValidationError(false); }} placeholder="UF" />
              <OrderFormInput label="Telefone 1" value={telefone1} onChange={(v) => { setTelefone1(v); setShowClientValidationError(false); }} placeholder="(00) 00000-0000" required error={showClientValidationError} />
              <OrderFormInput label="Email" value={emailContato} onChange={(v) => { setEmailContato(v); setShowClientValidationError(false); }} placeholder="email@empresa.com" required error={showClientValidationError} />
              <OrderFormInput label="Segmento" value={segmento} onChange={setSegmento} placeholder="Indústria, Loja, Distribuidora..." />
            </div>

            {/* COBRANÇA */}
            <div className="mt-4 p-3 bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase mb-2">⚠️ COBRANÇA</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Situação</label>
                  <select value={situacaoCobranca} onChange={(e) => setSituacaoCobranca(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    <option value="SEM PROTESTO">SEM PROTESTO</option>
                    <option value="COM PROTESTO">COM PROTESTO</option>
                    <option value="NEGATIVADO">NEGATIVADO</option>
                    <option value="INADIMPLENTE">INADIMPLENTE</option>
                  </select>
                </div>
                <OrderFormInput label="Observações" value={observacoesCliente} onChange={setObservacoesCliente} placeholder="Observações sobre o cliente (opcional)" />
              </div>
            </div>

            {/* Redespacho toggle */}
            <div className="mt-4 flex items-center gap-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Possui redespacho? <span className="text-red-500">*</span></p>
              <button
                type="button"
                onClick={() => setPossuiRedespacho(true)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${possuiRedespacho === true ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-600 border-slate-300 hover:border-teal-400"}`}
              >Sim</button>
              <button
                type="button"
                onClick={() => setPossuiRedespacho(false)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${possuiRedespacho === false ? "bg-slate-600 text-white border-slate-600" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}
              >Não</button>
            </div>
            {possuiRedespacho === true && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-300 uppercase mb-2">🚚 ENDEREÇO REDESPACHO</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <OrderFormInput label="CNPJ do Redespacho" value={redespachoCnpj} onChange={setRedespachoCnpj} placeholder="00.000.000/0001-00" required />
                  <OrderFormInput label="Razão Social" value={redespachoRazaoSocial} onChange={setRedespachoRazaoSocial} placeholder="Razão Social do Redespacho" required />
                  <OrderFormInput label="CEP" value={redespachoCep} onChange={setRedespachoCep} placeholder="00000-000" />
                  <OrderFormInput label="Logradouro" value={redespachoLogradouro} onChange={setRedespachoLogradouro} placeholder="Rua/Av" />
                  <OrderFormInput label="Número" value={redespachoNumero} onChange={setRedespachoNumero} placeholder="Nº" />
                  <OrderFormInput label="Complemento" value={redespachoComplemento} onChange={setRedespachoComplemento} placeholder="Sala, Bloco..." />
                  <OrderFormInput label="Bairro" value={redespachoBairro} onChange={setRedespachoBairro} placeholder="Bairro" />
                  <OrderFormInput label="Cidade" value={redespachoCidade} onChange={setRedespachoCidade} placeholder="Cidade" />
                  <OrderFormInput label="UF" value={redespachoUf} onChange={setRedespachoUf} placeholder="XX" />
                  <OrderFormInput label="Telefone" value={redespachoTelefone} onChange={setRedespachoTelefone} placeholder="(00) 00000-0000" />
                </div>
              </div>
            )}

            {/* Endereço de entrega toggle */}
            <div className="mt-4 flex items-center gap-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Endereço de entrega é o mesmo do cadastro? <span className="text-red-500">*</span></p>
              <button
                type="button"
                onClick={() => setEnderecoEntregaMesmo(true)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${enderecoEntregaMesmo === true ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-600 border-slate-300 hover:border-teal-400"}`}
              >Sim</button>
              <button
                type="button"
                onClick={() => setEnderecoEntregaMesmo(false)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${enderecoEntregaMesmo === false ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}
              >Não</button>
            </div>
            {enderecoEntregaMesmo === false && (
              <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
                <p className="text-[10px] font-bold text-orange-600 dark:text-orange-300 uppercase mb-2">📦 ENDEREÇO DE ENTREGA</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <OrderFormInput label="CEP" value={entregaCep} onChange={setEntregaCep} placeholder="00000-000" required />
                  <OrderFormInput label="Logradouro" value={entregaLogradouro} onChange={setEntregaLogradouro} placeholder="Rua/Av" />
                  <OrderFormInput label="Número" value={entregaNumero} onChange={setEntregaNumero} placeholder="Nº" />
                  <OrderFormInput label="Complemento" value={entregaComplemento} onChange={setEntregaComplemento} placeholder="Sala, Bloco..." />
                  <OrderFormInput label="Bairro" value={entregaBairro} onChange={setEntregaBairro} placeholder="Bairro" />
                  <OrderFormInput label="Cidade" value={entregaCidade} onChange={setEntregaCidade} placeholder="Cidade" />
                  <OrderFormInput label="UF" value={entregaUf} onChange={setEntregaUf} placeholder="XX" />
                  <OrderFormInput label="Telefone" value={entregaTelefone} onChange={setEntregaTelefone} placeholder="(00) 00000-0000" required />
                </div>
              </div>
            )}

            {/* Validation error message */}
            {showClientValidationError && (() => {
              const strictMissing = ["CNPJ/CPF", "CEP", "Telefone 1", "Email"].filter(f => {
                if (f === "CNPJ/CPF") return !cnpjCpf.trim();
                if (f === "CEP") return !cep.trim();
                if (f === "Telefone 1") return !telefone1.trim();
                if (f === "Email") return !emailContato.trim();
                return false;
              });
              const hasStrictError = !canSkipClient && strictMissing.length > 0;
              return (
                <div className={`mt-3 px-3 py-2.5 ${hasStrictError ? 'bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'} rounded-lg`}>
                  {hasStrictError && (
                    <>
                      <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-1">Campos obrigatórios (bloqueiam avanço):</p>
                      <p className="text-xs text-red-500 dark:text-red-300">{strictMissing.join(", ")}</p>
                    </>
                  )}
                  {clientMissingFields.length > 0 && !hasStrictError && (
                    <>
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">Campos pendentes (não obrigatórios para avançar):</p>
                      <p className="text-xs text-amber-500 dark:text-amber-300">{clientMissingFields.join(", ")}</p>
                      <p className="text-[10px] text-amber-400 dark:text-amber-500 mt-1">Você pode avançar e preencher depois.</p>
                    </>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleProceedToProducts}
                disabled={updateVendorClientMutation.isPending}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
              >
                {updateVendorClientMutation.isPending ? "Salvando..." : "Próximo: Produtos"}
              </button>
            </div>

            {/* Informações do Cliente - Card com histórico (starts collapsed) */}
            {selectedClientName && (
              <div className={`mt-4 rounded-xl overflow-hidden transition-all duration-300 ${
                clientHistoryQuery.data?.summary?.titulosVencidos
                  ? 'border-2 border-red-400 dark:border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                  : clientHistoryQuery.data?.summary?.totalEmAberto
                    ? 'border-2 border-amber-400 dark:border-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                    : clientHistoryQuery.data
                      ? 'border-2 border-emerald-400 dark:border-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                      : 'border border-slate-200 dark:border-slate-700'
              }`}>
                {/* Collapsed Header - always visible, clickable to expand */}
                <button
                  onClick={() => setClientInfoExpanded(!clientInfoExpanded)}
                  className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                    clientHistoryQuery.data?.summary?.titulosVencidos
                      ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                      : clientHistoryQuery.data?.summary?.totalEmAberto
                        ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800'
                        : clientHistoryQuery.data
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800'
                          : 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900'
                  }`}
                >
                  {/* Status Icon */}
                  {clientHistoryQuery.isLoading ? (
                    <div className="animate-spin w-5 h-5 border-2 border-white/40 border-t-white rounded-full flex-shrink-0"></div>
                  ) : clientHistoryQuery.data?.summary?.titulosVencidos ? (
                    <div className="w-8 h-8 rounded-full bg-red-500/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    </div>
                  ) : clientHistoryQuery.data?.summary?.totalEmAberto ? (
                    <div className="w-8 h-8 rounded-full bg-amber-500/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                  ) : clientHistoryQuery.data ? (
                    <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                  )}

                  {/* Main info */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white truncate">{selectedClientName}</h4>
                      {clientHistoryQuery.data?.summary?.titulosVencidos ? (
                        <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full animate-pulse">
                          INADIMPLENTE
                        </span>
                      ) : clientHistoryQuery.data?.summary?.totalEmAberto ? (
                        <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full">
                          TÍTULOS EM ABERTO
                        </span>
                      ) : clientHistoryQuery.data ? (
                        <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full">
                          EM DIA
                        </span>
                      ) : null}
                    </div>
                    {clientHistoryQuery.data && (
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-white/70">
                          {clientHistoryQuery.data.summary.totalPedidos} pedido(s)
                        </span>
                        <span className="text-[11px] text-white/70">
                          Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(clientHistoryQuery.data.summary.totalCompras)}
                        </span>
                        {clientHistoryQuery.data.summary.totalEmAberto > 0 && (
                          <span className="text-[11px] text-white font-semibold">
                            Em aberto: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(clientHistoryQuery.data.summary.totalEmAberto)}
                          </span>
                        )}
                        {clientHistoryQuery.data.summary.titulosVencidos > 0 && (
                          <span className="text-[11px] text-white font-bold">
                            {clientHistoryQuery.data.summary.titulosVencidos} vencido(s) — {clientHistoryQuery.data.summary.diasAtrasoMax}d atraso
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expand/Collapse chevron */}
                  <ChevronDown className={`w-5 h-5 text-white/70 transition-transform duration-200 flex-shrink-0 ${clientInfoExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded Content */}
                {clientInfoExpanded && clientHistoryQuery.data && (
                  <div className="p-4 space-y-4 bg-slate-50 dark:bg-slate-800/50">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Total Comprado</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(clientHistoryQuery.data.summary.totalCompras)}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Pedidos</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{clientHistoryQuery.data.summary.totalPedidos}</p>
                      </div>
                      <div className={`bg-white dark:bg-slate-800 rounded-lg p-2.5 border ${clientHistoryQuery.data.summary.totalEmAberto > 0 ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-700'}`}>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Em Aberto</p>
                        <p className={`text-sm font-bold ${clientHistoryQuery.data.summary.totalEmAberto > 0 ? 'text-amber-600' : 'text-slate-800 dark:text-slate-200'}`}>
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(clientHistoryQuery.data.summary.totalEmAberto)}
                        </p>
                      </div>
                      <div className={`bg-white dark:bg-slate-800 rounded-lg p-2.5 border ${clientHistoryQuery.data.summary.titulosVencidos > 0 ? 'border-red-300 dark:border-red-700' : 'border-slate-200 dark:border-slate-700'}`}>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Vencidos</p>
                        <p className={`text-sm font-bold ${clientHistoryQuery.data.summary.titulosVencidos > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {clientHistoryQuery.data.summary.titulosVencidos} título(s)
                          {clientHistoryQuery.data.summary.diasAtrasoMax > 0 && (
                            <span className="text-[10px] font-normal text-red-400 ml-1">({clientHistoryQuery.data.summary.diasAtrasoMax} dias)</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Débitos em Aberto */}
                    {clientHistoryQuery.data.debts.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Títulos em Aberto ({clientHistoryQuery.data.debts.length})
                        </h5>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {clientHistoryQuery.data.debts.map((d: any, idx: number) => (
                            <div key={idx} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${d.vencido ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${d.vencido ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`}></span>
                                <span className="text-slate-600 dark:text-slate-300">
                                  {d.documento || `Parcela ${d.parcela || '-'}/${d.totalParcelas || '-'}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-400">{d.vencimento ? new Date(d.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                                <span className={`font-semibold ${d.vencido ? 'text-red-600' : 'text-slate-700 dark:text-slate-200'}`}>
                                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(d.valor)}
                                </span>
                                {d.vencido && d.diasAtraso > 0 && (
                                  <span className="text-[10px] text-red-500 font-medium">{d.diasAtraso}d atraso</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Histórico de Compras */}
                    {clientHistoryQuery.data.purchases.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                          Últimas Compras ({clientHistoryQuery.data.purchases.length})
                        </h5>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {clientHistoryQuery.data.purchases.slice(0, 10).map((p: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400">#{p.pedido}</span>
                                <span className="text-slate-600 dark:text-slate-300">
                                  {p.dataEmissao ? new Date(p.dataEmissao).toLocaleDateString('pt-BR') : '-'}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  p.estado === 'Faturado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                  p.estado === 'Aprovado' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                  'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                }`}>{p.estado || 'N/A'}</span>
                              </div>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.valor)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Última compra info */}
                    {clientHistoryQuery.data.summary.ultimaCompra && (
                      <p className="text-[10px] text-slate-400 text-center">
                        Última compra: {new Date(clientHistoryQuery.data.summary.ultimaCompra).toLocaleDateString('pt-BR')}
                        {' · '}
                        Vendedor: {clientHistoryQuery.data.purchases[0]?.representante || '-'}
                      </p>
                    )}

                    {/* Placeholder for future Serasa integration */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      <span className="text-[10px] text-slate-400">Consulta Serasa — em breve</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === "produtos" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">2. Produtos do Estoque</p>
              <div className="flex items-center gap-2">
                {lastOrderQuery.data && lastOrderQuery.data.items.length > 0 && items.length === 0 && (
                  <button
                    onClick={() => {
                      const lastItems = lastOrderQuery.data!.items;
                      const availableProds = productsQuery.data || [];
                      const newItems: typeof items = [];
                      for (const li of lastItems) {
                        const prod = availableProds.find((p: any) => p.codigoItem === li.codigoItem);
                        // Usar o preço EXATO do último pedido (li.precoUnitario) - idêntico ao original
                        newItems.push({
                          codigoItem: li.codigoItem,
                          descricaoItem: li.descricaoItem,
                          quantidade: li.quantidade,
                          unidadeMedida: li.unidadeMedida || "CX",
                          precoUnitario: li.precoUnitario,
                          precoMinimo: prod?.precoMinimo ? Number(prod.precoMinimo) : null,
                          precoVendedor: prod?.precoVendedor ? Number(prod.precoVendedor) : null,
                          grupo: prod?.grupo || "",
                          disponivel: prod?.disponivel || "0",
                          pesoBrutoCaixa: prod?.pesoBruto && Number(prod.pesoBruto) > 0 ? Number(prod.pesoBruto) * (Number(prod.unidadeDeVendaFator) || 1) : undefined,
                          dimsStr: prod?.descricaoComplementar?.match(/([\ d,.]+)[xX]([\ d,.]+)[xX]([\ d,.]+)/)?.[0] || undefined,
                        });
                      }
                      setItems(newItems);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-[11px] font-semibold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Repetir Último Pedido
                    {lastOrderQuery.data.source === "maxiprod" && lastOrderQuery.data.pedidoNumber && (
                      <span className="text-[9px] text-blue-500 dark:text-blue-400">#{lastOrderQuery.data.pedidoNumber}</span>
                    )}
                  </button>
                )}
                <span className="text-[10px] text-slate-400">{productsQuery.data?.length || 0} produtos disponíveis</span>
              </div>
            </div>
            {/* Margin simulation params (Fernando/Guilherme only) */}
            {showRealCostBar && (
              <MarginSimulationParams
                comissao={marginComissao}
                frete={marginFrete}
                custosAdicionais={marginCustosAdicionais}
                ufDestino={marginUfSimulacao}
                onComissaoChange={setMarginComissao}
                onFreteChange={setMarginFrete}
                onCustosAdicionaisChange={setMarginCustosAdicionais}
                onUfDestinoChange={setMarginUfSimulacao}
              />
            )}
            {/* Product search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar produto por código ou descrição..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
            {/* Confirmed items - STICKY at top */}
            {items.length > 0 && (
              <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 pb-2 border-b-2 border-emerald-300 dark:border-emerald-700 shadow-md rounded-lg mb-3">
                <div className="flex items-center justify-between px-3 py-2 bg-emerald-600 rounded-t-lg">
                  <p className="text-[11px] font-bold text-white flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4" /> Pedido ({items.length} {items.length === 1 ? 'item' : 'itens'}) — {items.reduce((sum, i) => sum + i.quantidade, 0)} caixas
                  </p>
                  <p className="text-sm font-bold text-white">
                    {formatCurrencySales(items.reduce((sum, i) => sum + i.quantidade * i.precoUnitario, 0))}
                  </p>
                </div>
                {/* Cumulative Debit/Credit Summary */}
                {showMarginBar && items.length > 0 && (() => {
                  let runningBalance = 0;
                  const balances = items.map(item => {
                    const precoMostrado = item.precoVendedor || 0;
                    if (precoMostrado <= 0) return { diff: 0, balance: runningBalance };
                    // Preço Alto = preço mostrado com 20% de desconto (ponto zero do D/C)
                    const precoAlto = precoMostrado * 0.80;
                    const diff = (item.precoUnitario - precoAlto) * item.quantidade;
                    runningBalance += diff;
                    return { diff, balance: runningBalance };
                  });
                  const totalBalance = balances[balances.length - 1]?.balance || 0;
                  return (
                    <div className={`flex items-center justify-between px-3 py-1.5 text-xs font-bold ${
                      totalBalance > 0 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' :
                      totalBalance < 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                      'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      <span>Saldo D/C:</span>
                      <span className="text-sm tabular-nums">
                        {totalBalance >= 0 ? '+' : ''}{formatCurrencySales(totalBalance)}
                      </span>
                    </div>
                  );
                })()}
                {/* Order Reputation Bar - weighted average margin (Fernando/Guilherme only) */}
                {showRealCostBar && items.length > 0 && productMarginsQuery.data && (() => {
                  // Calculate weighted average margin for the entire order
                  let sumPVxMargin = 0;
                  let sumPV = 0;
                  items.forEach(item => {
                    const costData = productMarginsQuery.data?.costMap[item.codigoItem];
                    if (!costData) return;
                    const pv = item.precoUnitario;
                    if (pv <= 0) return;
                    const custoPerc = (costData.cost / pv) * 100;
                    const taxBd = costData.tipoProduto === "industrializado"
                      ? productMarginsQuery.data?.taxBreakdownIndustrializado
                      : productMarginsQuery.data?.taxBreakdownImportado;
                    const totalDeducoes = custoPerc + (taxBd?.total || 0) + marginFrete + marginComissao + marginCustosAdicionais;
                    const itemMargin = 100 - totalDeducoes;
                    const totalPV = pv * item.quantidade;
                    sumPVxMargin += totalPV * itemMargin;
                    sumPV += totalPV;
                  });
                  if (sumPV <= 0) return null;
                  const weightedMargin = sumPVxMargin / sumPV;
                  // Colors: <15% red, 15-20% orange, 20-25% yellow, 25-29% green, >29% blue
                  const getRepColor = (m: number) => {
                     if (m < 15) return { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-300', label: 'Crítico' };
                     if (m < 20) return { bg: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300', label: 'Comissão Baixa' };
                     if (m < 25) return { bg: 'bg-yellow-400', text: 'text-yellow-700 dark:text-yellow-300', label: 'Comissão Média' };
                     if (m < 29) return { bg: 'bg-green-500', text: 'text-green-700 dark:text-green-300', label: 'Comissão Média-Alta' };
                     return { bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', label: 'Comissão Alta' };
                  };
                  const repColor = getRepColor(weightedMargin);
                  // Bar position: range -5% to 40%
                  const barMin = -5;
                  const barMax = 40;
                  const clamped = Math.max(barMin, Math.min(barMax, weightedMargin));
                  const pos = ((clamped - barMin) / (barMax - barMin)) * 100;
                  return (
                    <div className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-t border-indigo-200 dark:border-indigo-700">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">🏆 Reputação do Pedido</span>
                        <span className={`text-sm font-black tabular-nums ${repColor.text}`}>
                          {weightedMargin.toFixed(1)}% ({repColor.label})
                        </span>
                      </div>
                      <div className="relative w-full">
                        <div className="relative h-7 rounded-full overflow-visible border-2 border-slate-300 dark:border-slate-500 shadow-sm">
                          <div className="absolute inset-0 rounded-full overflow-hidden flex">
                            <div className="h-full bg-red-500" style={{ width: "44.4%" }} />
                            <div className="h-full bg-orange-500" style={{ width: "11.1%" }} />
                            <div className="h-full bg-yellow-400" style={{ width: "11.1%" }} />
                            <div className="h-full bg-green-500" style={{ width: "8.9%" }} />
                            <div className="h-full bg-blue-500" style={{ width: "24.5%" }} />
                          </div>
                          {/* Divider lines */}
                          <div className="absolute top-0 bottom-0 w-[2px] bg-white/90" style={{ left: "44.4%" }} />
                          <div className="absolute top-0 bottom-0 w-[2px] bg-white/90" style={{ left: "55.5%" }} />
                          <div className="absolute top-0 bottom-0 w-[2px] bg-white/90" style={{ left: "66.6%" }} />
                          <div className="absolute top-0 bottom-0 w-[2px] bg-white/90" style={{ left: "75.5%" }} />
                          {/* Indicator */}
                          <div
                            className="absolute flex flex-col items-center"
                            style={{ left: `${pos}%`, transform: "translateX(-50%)", top: "-7px", bottom: "-3px" }}
                          >
                            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-slate-900 dark:border-t-white" />
                            <div className="w-[3px] flex-1 bg-slate-900 dark:bg-white rounded-full" />
                          </div>
                        </div>
                        {/* Margin numbers at dividers */}
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
                {/* Gestor-only: Recalcular Margem Real button */}
                {showRealCostBar && realComissaoPerc !== null && (
                  <div className="px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 border-t border-violet-200 dark:border-violet-700 flex items-center justify-between gap-2">
                    {!marginRecalculated ? (
                      <button
                        onClick={() => {
                          if (realComissaoPerc !== null) setMarginComissao(realComissaoPerc);
                          if (realFretePerc !== null) setMarginFrete(realFretePerc);
                          setMarginRecalculated(true);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold rounded-md transition-colors cursor-pointer"
                      >
                        <Calculator className="w-3 h-3" />
                        Recalcular Margem Real
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setMarginComissao(5.85);
                          setMarginFrete(13);
                          setMarginRecalculated(false);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-500 hover:bg-slate-600 text-white text-[10px] font-bold rounded-md transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restaurar Simulação (5.85% / 13%)
                      </button>
                    )}
                    <span className="text-[9px] text-violet-600 dark:text-violet-300 font-medium">
                      {marginRecalculated
                        ? `Real: ${realComissaoPerc?.toFixed(1)}% com. / ${realFretePerc?.toFixed(1)}% frete`
                        : `Custos reais disponíveis: ${realComissaoPerc?.toFixed(1)}% com. / ${realFretePerc?.toFixed(1)}% frete`
                      }
                    </span>
                  </div>
                )}
                <div className="max-h-[200px] overflow-y-auto px-2 pt-2 space-y-1.5">
                  {items.map((item, idx) => (
                    <div key={idx} className={`rounded-lg border ${showMarginBar && item.precoVendedor && item.precoVendedor > 0 ? (() => {
                      const descItem = item.precoVendedor > 0 ? ((item.precoVendedor - item.precoUnitario) / item.precoVendedor) * 100 : 0;
                      const pts = [{desc:0,marg:36.25},{desc:20,marg:29},{desc:23,marg:25},{desc:27,marg:20},{desc:32,marg:15},{desc:37,marg:10},{desc:42,marg:5},{desc:50,marg:0}];
                      let m = 0;
                      if (descItem <= pts[0].desc) m = pts[0].marg;
                      else if (descItem >= pts[pts.length-1].desc) m = pts[pts.length-1].marg;
                      else { for (let i=0;i<pts.length-1;i++) { if (descItem>=pts[i].desc&&descItem<=pts[i+1].desc) { const t=(descItem-pts[i].desc)/(pts[i+1].desc-pts[i].desc); m=pts[i].marg+t*(pts[i+1].marg-pts[i].marg); break; } } }
                      m = m - (marginComissao - 5.85) - (marginFrete - 13);
                      if (m >= 29) return 'border-2 border-blue-400 dark:border-blue-500 bg-blue-100 dark:bg-blue-900/40';
                      if (m >= 25) return 'border-2 border-green-400 dark:border-green-500 bg-green-100 dark:bg-green-900/40';
                      if (m >= 20) return 'border-2 border-yellow-400 dark:border-yellow-500 bg-yellow-100 dark:bg-yellow-900/40';
                      if (m >= 15) return 'border-2 border-orange-400 dark:border-orange-500 bg-orange-100 dark:bg-orange-900/40';
                      return 'border-2 border-red-400 dark:border-red-500 bg-red-100 dark:bg-red-900/40';
                    })() : 'border-emerald-100 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10'}`}>
                      {editingCartIdx === idx ? (
                        /* Editing mode - redirect to original */
                        <div className="p-2.5">
                          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-2 truncate">{item.descricaoItem}</p>
                          <div className="flex flex-wrap items-end gap-3">
                            <div>
                              <label className="text-[8px] text-slate-400 uppercase font-bold">Qtd ({item.unidadeMedida})</label>
                              <div className="flex items-center mt-0.5 border border-emerald-300 dark:border-emerald-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                                <button onClick={() => setEditCartQty(Math.max(1, editCartQty - 1))} className="px-2 py-1 text-emerald-600 hover:bg-emerald-50">-</button>
                                <span className="px-3 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 min-w-[2rem] text-center">{editCartQty}</span>
                                <button onClick={() => setEditCartQty(editCartQty + 1)} className="px-2 py-1 text-emerald-600 hover:bg-emerald-50">+</button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[8px] text-slate-400 uppercase font-bold">Preço unit.</label>
                              <input type="text" inputMode="decimal" value={editCartPrice} onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, ''); setEditCartPrice(v); }} className="mt-0.5 w-20 px-2 py-1 text-xs border border-emerald-300 dark:border-emerald-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                            </div>
                            <button onClick={() => saveCartEdit(idx)} className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700">Salvar</button>
                            <button onClick={() => setEditingCartIdx(null)} className="px-3 py-1.5 text-slate-500 text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        /* Display mode */
                        <div className="flex items-center justify-between px-2.5 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{item.descricaoItem}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              <span className="font-mono text-slate-400">{item.codigoItem}</span>
                              {' '}
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                {item.quantidade} cx × {formatCurrencySales(item.precoUnitario)} = {formatCurrencySales(item.quantidade * item.precoUnitario)}
                              </span>
                              {item.precoVendedor && item.precoUnitario < item.precoVendedor && (
                                <span className="text-orange-500 ml-1">({(((item.precoVendedor - item.precoUnitario) / item.precoVendedor) * 100).toFixed(1)}% desc.)</span>
                              )}
                              {/* Cumulative balance per item */}
                              {showMarginBar && item.precoVendedor && item.precoVendedor > 0 && (() => {
                                let balance = 0;
                                for (let i = 0; i <= idx; i++) {
                                  const it = items[i];
                                  const precoMostrado = it.precoVendedor || 0;
                                  // Preço Alto = preço mostrado com 20% de desconto (ponto zero)
                                  if (precoMostrado > 0) balance += (it.precoUnitario - precoMostrado * 0.80) * it.quantidade;
                                }
                                return (
                                  <span className={`ml-1.5 font-black text-[10px] tabular-nums ${
                                    balance > 0 ? 'text-blue-600 dark:text-blue-400' :
                                    balance < 0 ? 'text-red-600 dark:text-red-400' :
                                    'text-slate-500'
                                  }`}>
                                    [{balance >= 0 ? '+' : ''}{formatCurrencySales(balance)}]
                                  </span>
                                );
                              })()}
                            </p>
                            {/* Weight + Volume in saved cart item - with large visible labels */}
                            {(item.pesoBrutoCaixa || item.dimsStr) && (
                              <div className="flex items-center gap-3 mt-1.5">
                                {item.pesoBrutoCaixa && item.pesoBrutoCaixa > 0 && (
                                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-lg">
                                    ⚖️ Peso Total: {(item.pesoBrutoCaixa * item.quantidade).toFixed(1)} kg
                                  </span>
                                )}
                                {item.dimsStr && (() => {
                                  const d = item.dimsStr!.split('x').map(v => parseFloat(v.replace(',', '.')));
                                  const vol = d.length === 3 ? (d[0] * d[1] * d[2] / 1000000) * item.quantidade : 0;
                                  return vol > 0 ? (
                                    <span className="text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-lg">
                                      📦 Cubagem: {vol.toFixed(3)} m³
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button
                              onClick={() => startEditCartItem(idx)}
                              className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => removeProduct(idx)}
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Available products list - always visible */}
            {availableProducts.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-600 rounded-lg max-h-[520px] overflow-y-auto">
                {availableProducts.map((p: any) => {
                  const fator = Number(p.unidadeDeVendaFator) || 1;
                  const qtdRaw = Number(p.disponivel) || 0;
                  const qtdCaixas = fator > 1 ? Math.floor(qtdRaw / fator) : qtdRaw;
                  const unidadeVenda = p.unidadeDeVendaCodigo || (fator >= 1000 ? "CX" : p.unidadeMedida || "CX");
                  const dims = p.descricaoComplementar ? p.descricaoComplementar.match(/([\d,.]+)[xX]([\d,.]+)[xX]([\d,.]+)/) : null;
                  const isExpanded = expandedProduct === p.codigoItem;
                  const hasPOs = p.pendingPOs && p.pendingPOs.length > 0;
                  const precoVendedor = p.precoVendedor ? Number(p.precoVendedor) : null;
                  const precoMinimo = p.precoMinimo ? Number(p.precoMinimo) : null;
                  const precoBase = precoVendedor || precoMinimo || 0;
                  const calc = productCalc[p.codigoItem] || { discount: "", finalValue: "", quantity: 1, showQty: false, locked: false };

                  // Calculate derived values
                  const discountPct = calc.discount ? parseFloat(calc.discount) : 0;
                  const finalFromDiscount = precoBase > 0 && discountPct > 0 ? precoBase * (1 - discountPct / 100) : precoBase;
                  const finalFromValue = calc.finalValue ? parseFloat(calc.finalValue.replace(',', '.')) : 0;
                  const discountFromValue = precoBase > 0 && finalFromValue > 0 ? ((precoBase - finalFromValue) / precoBase) * 100 : 0;

                  // The effective price to use (discount takes priority if set, otherwise finalValue)
                  const effectivePrice = calc.discount ? finalFromDiscount : (calc.finalValue ? finalFromValue : precoBase);
                  const isBelowMin = precoMinimo && effectivePrice > 0 && effectivePrice < precoMinimo;

                  const updateCalc = (field: string, value: any) => {
                    setProductCalc(prev => ({
                      ...prev,
                      [p.codigoItem]: { ...calc, [field]: value }
                    }));
                  };

                  return (
                    <div key={p.codigoItem} className="border-b-2 border-slate-200 dark:border-slate-600 last:border-0 px-2 sm:px-3 py-0.5">
                      {/* Row 1: Product name | code/dims/weight */}
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0">
                        <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 break-words leading-tight">{p.descricaoItem}</p>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="flex flex-col items-center">
                            <span className="text-[7px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">Código do Produto</span>
                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{p.codigoItem}</span>
                          </div>
                          {dims && (
                            <span className="text-[9px] sm:text-[10px] bg-orange-50 dark:bg-orange-900/20 px-1 py-0.5 rounded text-orange-700 dark:text-orange-400 font-bold">
                              📐 {dims[1]}×{dims[2]}×{dims[3]} cm
                            </span>
                          )}
                          {p.pesoBruto && Number(p.pesoBruto) > 0 && (
                            <span className="text-[9px] sm:text-[10px] bg-purple-50 dark:bg-purple-900/20 px-1 py-0.5 rounded text-purple-700 dark:text-purple-400 font-bold">
                              ⚖️ {(Number(p.pesoBruto) * fator).toFixed(2)} kg/cx
                            </span>
                          )}
                          {hasPOs && (
                            <span className="text-[9px] sm:text-[10px] bg-green-50 dark:bg-green-900/20 px-1 py-0.5 rounded text-green-700 dark:text-green-400 font-medium">
                              🚢 {p.pendingPOs.reduce((sum: number, po: any) => sum + Math.floor(Number(po.quantidade) || 0), 0).toLocaleString('pt-BR')} {unidadeVenda} chegando
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Row 2: Pricing controls + margin bars on the right */}
                      {precoBase > 0 && (
                        <div>
                            <div className="flex items-end gap-2 sm:gap-3">
                            {/* Left: pricing controls */}
                            <div className="flex flex-wrap items-end gap-2 sm:gap-3 flex-1">
                              {/* Stock */}
                              <div className="flex flex-col items-center">
                                <span className="text-[8px] sm:text-[9px] text-slate-500 dark:text-slate-400 font-medium mb-0.5 whitespace-nowrap">Caixas disponíveis</span>
                                <div className={`flex items-center gap-0.5 px-2 py-1 rounded-lg ${qtdCaixas > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                  <span className={`text-sm font-black ${qtdCaixas > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>
                                    {qtdCaixas.toLocaleString('pt-BR')}
                                  </span>
                                  <span className={`text-[8px] font-bold uppercase ${qtdCaixas > 0 ? 'text-emerald-500' : 'text-red-400'}`}>{unidadeVenda}</span>
                                </div>
                              </div>

                              {/* Price per box */}
                              <div className="flex flex-col items-center">

                                <span className="text-xs sm:text-sm font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 px-2 py-1 rounded-lg whitespace-nowrap">
                                  {formatCurrencySales(precoBase)}
                                </span>
                              </div>

                              {/* Discount % */}
                              <div className="flex flex-col items-center">
                                <span className="text-[8px] sm:text-[9px] text-slate-500 dark:text-slate-400 font-medium mb-0.5 whitespace-nowrap">Desconto %</span>
                                <div className={`flex items-center gap-0.5 rounded-lg px-1.5 py-1 ${calc.locked ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'}`}>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0"
                                    disabled={calc.locked}
                                    value={calc.discount !== '' ? calc.discount : (calc.finalValue && precoBase > 0 && parseFloat(calc.finalValue.replace(',', '.')) > 0 ? ((1 - parseFloat(calc.finalValue.replace(',', '.')) / precoBase) * 100).toFixed(1) : '')}
                                    onChange={(e) => {
                                      const v = e.target.value.replace(/[^0-9.,]/g, '');
                                      setProductCalc(prev => ({
                                        ...prev,
                                        [p.codigoItem]: { ...calc, discount: v, finalValue: '' }
                                      }));
                                    }}
                                    className={`w-12 px-1 py-0.5 text-xs font-bold text-center border rounded focus:outline-none ${calc.locked ? 'border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 cursor-not-allowed' : 'border-amber-300 dark:border-amber-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-amber-400'}`}
                                  />
                                  <span className={`text-[10px] font-bold ${calc.locked ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>%</span>
                                </div>
                              </div>

                              {/* Final value after discount - HIGHLIGHTED when locked */}
                              <div className="flex flex-col items-center">
                                <span className={`text-[8px] sm:text-[9px] font-medium mb-0.5 whitespace-nowrap ${calc.locked ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>{calc.locked ? '✓ Valor Final' : 'Valor com desconto'}</span>
                                <div className={`flex items-center gap-0.5 rounded-lg px-1.5 py-1 ${calc.locked ? 'bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-400 dark:border-emerald-500 shadow-md' : 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700'}`}>
                                  <span className={`text-[10px] font-bold ${calc.locked ? 'text-emerald-700 dark:text-emerald-300' : 'text-indigo-600 dark:text-indigo-400'}`}>R$</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                    disabled={calc.locked}
                                    value={calc.finalValue !== '' ? calc.finalValue : (calc.discount && discountPct > 0 ? finalFromDiscount.toFixed(2) : '')}
                                    onChange={(e) => {
                                      const v = e.target.value.replace(/[^0-9.,]/g, '');
                                      setProductCalc(prev => ({
                                        ...prev,
                                        [p.codigoItem]: { ...calc, finalValue: v, discount: '' }
                                      }));
                                    }}
                                    className={`w-16 px-1 py-0.5 text-xs font-bold text-center border rounded focus:outline-none ${calc.locked ? 'border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 text-sm cursor-not-allowed' : 'border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-indigo-400'}`}
                                  />
                                </div>
                              </div>

                              {/* OK / Editar button */}
                              {(calc.discount || calc.finalValue) && (
                                <div className="flex flex-col items-center">
                                  <span className="text-[8px] sm:text-[9px] text-transparent font-medium mb-0.5">.</span>
                                  {calc.locked ? (
                                    <button
                                      onClick={() => updateCalc('locked', false)}
                                      className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/40 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 rounded-lg text-[10px] font-bold transition-all"
                                    >
                                      ✏️ Editar
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => updateCalc('locked', true)}
                                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                                    >
                                      OK
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Cart + Quantity */}
                              <div className="flex flex-col items-center">
                                <span className="text-[8px] sm:text-[9px] text-slate-500 dark:text-slate-400 font-medium mb-0.5 whitespace-nowrap">Qtd. pedido</span>
                                {!calc.showQty ? (
                                  <button
                                    onClick={() => updateCalc('showQty', true)}
                                    className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition-all"
                                  >
                                    <ShoppingCart className="w-3.5 h-3.5" /> Adicionar
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex items-center border border-emerald-300 dark:border-emerald-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                                      <button onClick={() => updateCalc('quantity', Math.max(0, calc.quantity - 1))} className="px-2 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-sm">−</button>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={calc.quantity}
                                        onChange={(e) => { const v = Math.max(0, parseInt(e.target.value) || 0); updateCalc('quantity', v); }}
                                        className="w-12 text-center py-1.5 text-xs font-bold border-x border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
                                      />
                                      <button onClick={() => updateCalc('quantity', calc.quantity + 1)} className="px-2 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-sm">+</button>
                                    </div>
                                    {/* Live subtotal */}
                                    {calc.quantity > 0 && (
                                      <span className="text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg whitespace-nowrap">
                                        = {formatCurrencySales(calc.quantity * effectivePrice)}
                                      </span>
                                    )}
                                    {/* Weight + Volume totals */}
                                    {calc.quantity > 0 && (p.pesoBruto || dims) && (
                                      <div className="flex items-center gap-1.5">
                                        {p.pesoBruto && Number(p.pesoBruto) > 0 && (
                                          <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                                            ⚖️ {(Number(p.pesoBruto) * fator * calc.quantity).toFixed(1)} kg
                                          </span>
                                        )}
                                        {dims && (
                                          <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                                            📦 {((parseFloat(dims[1].replace(',', '.')) * parseFloat(dims[2].replace(',', '.')) * parseFloat(dims[3].replace(',', '.')) / 1000000) * calc.quantity).toFixed(3)} m³
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    <button
                                      onClick={() => { addProduct(p, effectivePrice, calc.quantity); updateCalc('showQty', false); updateCalc('quantity', 1); }}
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm"
                                    >
                                      <Plus className="w-3 h-3" /> Salvar
                                    </button>
                                    <button
                                      onClick={() => {
                                        setProductCalc(prev => {
                                          const next = { ...prev };
                                          delete next[p.codigoItem];
                                          return next;
                                        });
                                      }}
                                      className="px-2.5 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-[10px] font-bold transition-colors"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Below min warning */}
                              {isBelowMin && (
                                <span className="text-[9px] text-red-500 font-bold self-end pb-1.5">⚠️ Abaixo mín.</span>
                              )}
                            </div>

                            {/* Margin bars on the right side of pricing row */}
                            {(showMarginBar || showRealCostBar) && (() => {
                              const descontoDado = precoBase > 0 && effectivePrice > 0 
                                ? ((precoBase - effectivePrice) / precoBase) * 100 
                                : 0;
                              const costData = productMarginsQuery.data?.costMap[p.codigoItem];
                              const taxBd = costData?.tipoProduto === "industrializado"
                                ? productMarginsQuery.data?.taxBreakdownIndustrializado
                                : productMarginsQuery.data?.taxBreakdownImportado;
                              return (
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {showMarginBar && (
                                    <ProductMarginBar desconto={descontoDado} showValues={showMarginValues} />
                                  )}
                                  {showRealCostBar && costData && taxBd && (
                                    <RealCostMarginBar
                                      precoVenda={effectivePrice}
                                      custoBox={costData.cost}
                                      fonte={costData.fonte}
                                      tipoProduto={costData.tipoProduto}
                                      taxBreakdown={taxBd}
                                      fretePerc={marginFrete}
                                      comissaoPerc={marginComissao}
                                      custosAdicionaisPerc={marginCustosAdicionais}
                                      quantidade={calc.quantity}
                                    />
                                  )}
                                </div>
                              );
                            })()}
                            </div>
                            {/* Highlighted totals row when locked + quantity selected */}
                            {calc.locked && calc.quantity > 0 && (p.pesoBruto || dims) && (
                              <div className="mt-2 flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">📦 Totais ({calc.quantity} cx):</span>
                                {p.pesoBruto && Number(p.pesoBruto) > 0 && (
                                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-lg">
                                    ⚖️ Peso: {(Number(p.pesoBruto) * fator * calc.quantity).toFixed(1)} kg
                                  </span>
                                )}
                                {dims && (
                                  <span className="text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-lg">
                                    📦 Cubagem: {((parseFloat(dims[1].replace(',', '.')) * parseFloat(dims[2].replace(',', '.')) * parseFloat(dims[3].replace(',', '.')) / 1000000) * calc.quantity).toFixed(3)} m³
                                  </span>
                                )}
                              </div>
                            )}

                        </div>
                      )}
                      {/* If no price table, show manual price input + cart */}
                      {precoBase === 0 && (
                        <div className="mt-2">
                          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                            {/* Stock */}
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] sm:text-[9px] text-slate-500 dark:text-slate-400 font-medium mb-0.5 whitespace-nowrap">Caixas disponíveis</span>
                              <div className={`flex items-center gap-0.5 px-2 py-1 rounded-lg ${qtdCaixas > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                <span className={`text-sm font-black ${qtdCaixas > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>
                                  {qtdCaixas.toLocaleString('pt-BR')}
                                </span>
                                <span className={`text-[8px] font-bold uppercase ${qtdCaixas > 0 ? 'text-emerald-500' : 'text-red-400'}`}>{unidadeVenda}</span>
                              </div>
                            </div>

                            {/* Manual price input */}
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] sm:text-[9px] text-amber-600 dark:text-amber-400 font-medium mb-0.5 whitespace-nowrap">Preço Manual (R$/cx)</span>
                              <div className="flex items-center gap-0.5 rounded-lg px-1.5 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">R$</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0,00"
                                  value={calc.finalValue}
                                  onChange={(e) => {
                                    const v = e.target.value.replace(/[^0-9.,]/g, '');
                                    setProductCalc(prev => ({
                                      ...prev,
                                      [p.codigoItem]: { ...calc, finalValue: v, discount: '' }
                                    }));
                                  }}
                                  className="w-20 px-1 py-0.5 text-xs font-bold text-center border border-amber-300 dark:border-amber-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                              </div>
                            </div>

                            {/* Quantity */}
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] sm:text-[9px] text-slate-500 dark:text-slate-400 font-medium mb-0.5 whitespace-nowrap">Qtd. pedido</span>
                              <div className="flex items-center border border-emerald-300 dark:border-emerald-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                                <button onClick={() => updateCalc('quantity', Math.max(0, calc.quantity - 1))} className="px-2 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-sm">−</button>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={calc.quantity}
                                  onChange={(e) => { const v = Math.max(0, parseInt(e.target.value) || 0); updateCalc('quantity', v); }}
                                  className="w-12 text-center py-1.5 text-xs font-bold border-x border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
                                />
                                <button onClick={() => updateCalc('quantity', calc.quantity + 1)} className="px-2 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-sm">+</button>
                              </div>
                            </div>

                            {/* Subtotal + Save */}
                            {calc.quantity > 0 && effectivePrice > 0 && (
                              <span className="text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg whitespace-nowrap">
                                = {formatCurrencySales(calc.quantity * effectivePrice)}
                              </span>
                            )}

                            <button
                              onClick={() => {
                                const manualPrice = calc.finalValue ? parseFloat(calc.finalValue.replace(',', '.')) : 0;
                                if (manualPrice <= 0) { return; }
                                addProduct(p, manualPrice, calc.quantity);
                                setProductCalc(prev => { const next = { ...prev }; delete next[p.codigoItem]; return next; });
                              }}
                              disabled={!calc.finalValue || parseFloat(calc.finalValue.replace(',', '.')) <= 0}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
                            >
                              <Plus className="w-3 h-3" /> Salvar
                            </button>
                          </div>
                          {/* No price table notice */}
                          <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-1 font-medium">⚠️ Sem tabela de preço — insira o valor manualmente</p>
                        </div>
                      )}

                      {/* PO Projections (if any) - compact */}
                      {hasPOs && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {p.pendingPOs.map((po: any, idx: number) => {
                            const poQtd = Math.floor(Number(po.quantidade) || 0);
                            const poDate = po.dataEntrega ? new Date(po.dataEntrega).toLocaleDateString('pt-BR') : 'S/D';
                            return (
                              <button
                                key={idx}
                                onClick={() => setReservePO({ codigoItem: p.codigoItem, descricaoItem: p.descricaoItem, referencia: po.referencia || 'PO', dataEntrega: poDate, quantidade: poQtd })}
                                className="text-[9px] bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded px-1.5 py-0.5 text-teal-700 dark:text-teal-300 font-medium hover:bg-teal-100 transition-colors"
                              >
                                🚢 {poQtd.toLocaleString('pt-BR')} {unidadeVenda} ({poDate})
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {availableProducts.length === 0 && productsQuery.data && productsQuery.data.length > 0 && (
              <p className="text-xs text-slate-400 text-center py-3">Nenhum produto encontrado para "{productSearch}"</p>
            )}
            {productsQuery.isLoading && (
              <p className="text-xs text-slate-400 text-center py-3">Carregando produtos...</p>
            )}

            {/* Forma de Pagamento - sempre visível para permitir conclusão rápida do pedido */}
            {true && (
              <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-700 mt-3">
                <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase mb-2">💰 Pagamento</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium">Forma de Pagamento <span className="text-red-500">*</span></label>
                    <select
                      value={formaPagamento}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                      className={`w-full mt-0.5 px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 ${!formaPagamento ? 'border-red-300 dark:border-red-600' : 'border-slate-200 dark:border-slate-600'}`}
                    >
                      <option value="">Selecione...</option>
                      <option value="Boleto">Boleto</option>
                      <option value="A prazo">A prazo</option>
                      <option value="À vista">À vista</option>
                      <option value="PIX">PIX</option>
                      <option value="Depósito">Depósito</option>
                      <option value="Cartão">Cartão</option>
                      <option value="Sem pagamento">Sem pagamento</option>
                      <option value="Outros">Outros</option>
                    </select>
                    {!formaPagamento && <p className="text-[8px] text-red-500 mt-0.5">Campo obrigatório</p>}
                  </div>
                  {(formaPagamento === 'A prazo' || formaPagamento === 'Boleto') && (
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium">Condição de Pagamento {formaPagamento === 'A prazo' && <span className="text-red-500">*</span>}</label>
                      <input
                        type="text"
                        value={condicaoPagamento}
                        onChange={(e) => setCondicaoPagamento(e.target.value)}
                        placeholder="Ex: 30/60/90 dias"
                        className={`w-full mt-0.5 px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 ${formaPagamento === 'A prazo' && !condicaoPagamento ? 'border-red-300 dark:border-red-600' : 'border-slate-200 dark:border-slate-600'}`}
                      />
                      {formaPagamento === 'A prazo' && !condicaoPagamento && <p className="text-[8px] text-red-500 mt-0.5">Obrigatório para pagamento a prazo</p>}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Observações - visível na tela de produtos */}
            <div className="pt-2">
              <label className="text-[10px] text-slate-500 font-medium">Observações (opcional)</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações adicionais para o gestor/operação..."
                rows={2}
                className="w-full mt-0.5 px-3 py-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none"
              />
            </div>

            {/* ===== DADOS DO CLIENTE (pré-preenchidos do cadastro) ===== */}
            <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-700 mt-3">
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">📋 Dados Fiscais do Cliente</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Regime Tributário</label>
                  <select value={regimeTributario} onChange={(e) => setRegimeTributario(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="Normal">Normal</option>
                    <option value="Simples Nacional">Simples Nacional</option>
                    <option value="MEI">MEI</option>
                    <option value="Lucro Presumido">Lucro Presumido</option>
                    <option value="Lucro Real">Lucro Real</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Inscrição Municipal</label>
                  <input type="text" value={inscricaoMunicipal} onChange={(e) => setInscricaoMunicipal(e.target.value)} placeholder="IM" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Inscrição SUFRAMA</label>
                  <input type="text" value={inscricaoSuframa} onChange={(e) => setInscricaoSuframa(e.target.value)} placeholder="SUFRAMA" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Situação Fiscal Especial</label>
                  <select value={situacaoFiscalEspecial} onChange={(e) => setSituacaoFiscalEspecial(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="Nenhuma">Nenhuma</option>
                    <option value="Zona Franca de Manaus">Zona Franca de Manaus</option>
                    <option value="Área de Livre Comércio">Área de Livre Comércio</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">CNAE Fiscal</label>
                  <input type="text" value={cnaeFiscal} onChange={(e) => setCnaeFiscal(e.target.value)} placeholder="0000000" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Email NF-e/NFC-e</label>
                  <input type="text" value={emailNfe} onChange={(e) => setEmailNfe(e.target.value)} placeholder="nfe@empresa.com" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Website</label>
                  <input type="text" value={websiteCliente} onChange={(e) => setWebsiteCliente(e.target.value)} placeholder="www.empresa.com.br" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
              </div>
            </div>

            {/* Dados de Venda */}
            <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-700 mt-2">
              <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase mb-2">💼 Dados de Venda</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Limite de Crédito (R$)</label>
                  <input type="text" value={limiteCredito} onChange={(e) => setLimiteCredito(e.target.value)} placeholder="999.999,99" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Forma de Cobrança (padrão)</label>
                  <select value={formaCobranca} onChange={(e) => setFormaCobranca(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="">Selecione...</option>
                    <option value="Boleto">Boleto</option>
                    <option value="A prazo">A prazo</option>
                    <option value="À vista">À vista</option>
                    <option value="PIX">PIX</option>
                    <option value="Depósito">Depósito</option>
                    <option value="Cartão">Cartão</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Tabela de Preços</label>
                  <input type="text" value={tabelaPrecos} onChange={(e) => setTabelaPrecos(e.target.value)} placeholder="Nome da tabela" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Condição de Pagamento</label>
                  <input type="text" value={condicaoPagamento} onChange={(e) => setCondicaoPagamento(e.target.value)} placeholder="30/60/90 dias" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
              </div>
            </div>

            {/* Dados de Relacionamento (CRM) */}
            <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-700 mt-2">
              <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase mb-2">🌐 Dados de Relacionamento (CRM)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Região</label>
                  <input type="text" value={regiao} onChange={(e) => setRegiao(e.target.value)} placeholder="Região" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Perfil</label>
                  <select value={perfil} onChange={(e) => setPerfil(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="">Selecione...</option>
                    <option value="Distribuidor">Distribuidor</option>
                    <option value="Varejista">Varejista</option>
                    <option value="Atacadista">Atacadista</option>
                    <option value="Indústria">Indústria</option>
                    <option value="Consumidor Final">Consumidor Final</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Forma de Pedido</label>
                  <select value={formaPedido} onChange={(e) => setFormaPedido(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="">Selecione...</option>
                    <option value="Telefone">Telefone</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="Presencial">Presencial</option>
                    <option value="App">App</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Produtos de Interesse</label>
                  <input type="text" value={produtosInteresse} onChange={(e) => setProdutosInteresse(e.target.value)} placeholder="Produtos de interesse" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Probabilidade de Negócio</label>
                  <select value={probabilidadeNegocio} onChange={(e) => setProbabilidadeNegocio(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="">Selecione...</option>
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Tamanho</label>
                  <select value={tamanho} onChange={(e) => setTamanho(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="">Selecione...</option>
                    <option value="Pequeno">Pequeno</option>
                    <option value="Médio">Médio</option>
                    <option value="Grande">Grande</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Atenção</label>
                  <select value={atencao} onChange={(e) => setAtencao(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="Normal">Normal</option>
                    <option value="Prioritário">Prioritário</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Fornecedor Atual</label>
                  <input type="text" value={fornecedorAtual} onChange={(e) => setFornecedorAtual(e.target.value)} placeholder="Concorrente atual" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
              </div>
            </div>

            {/* Cobrança */}
            <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-700 mt-2">
              <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase mb-2">⚠️ Cobrança</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Situação</label>
                  <select value={situacaoCobranca} onChange={(e) => setSituacaoCobranca(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="SEM PROTESTO">SEM PROTESTO</option>
                    <option value="EM PROTESTO">EM PROTESTO</option>
                    <option value="PROTESTADO">PROTESTADO</option>
                    <option value="NEGATIVADO">NEGATIVADO</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ===== DADOS PARA MAXIPROD (movidos de Custos de Venda) ===== */}
            <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-700 mt-2">
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-2">🏭 Dados para Maxiprod (Pedido de Venda)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[10px] text-slate-500 font-medium">Operação Fiscal <span className="text-red-500">*</span></label>
                  <select value={operacaoFiscal} onChange={(e) => setOperacaoFiscal(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="6101 - Fora do Estado - Madeira">6101 - Fora do Estado - Madeira</option>
                    <option value="6101 - Fora do Estado - Aromas">6101 - Fora do Estado - Aromas</option>
                    <option value="5101 - Dentro do Estado - Madeira">5101 - Dentro do Estado - Madeira</option>
                    <option value="5101 - Dentro do Estado - Aromas">5101 - Dentro do Estado - Aromas</option>
                    <option value="6108 - Fora do Estado - Consumidor Final">6108 - Fora do Estado - Consumidor Final</option>
                    <option value="5102 - Dentro do Estado - Revenda">5102 - Dentro do Estado - Revenda</option>
                    <option value="6102 - Fora do Estado - Revenda">6102 - Fora do Estado - Revenda</option>
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[10px] text-slate-500 font-medium">Natureza da Operação</label>
                  <select value={naturezaOperacao} onChange={(e) => setNaturezaOperacao(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="Venda de produção do estabelecimento">Venda de produção do estabelecimento</option>
                    <option value="Venda de mercadoria adquirida">Venda de mercadoria adquirida</option>
                    <option value="Transferência de produção do estabelecimento">Transferência de produção do estabelecimento</option>
                    <option value="Devolução de compra">Devolução de compra</option>
                    <option value="Remessa para industrialização">Remessa para industrialização</option>
                    <option value="Remessa para conserto">Remessa para conserto</option>
                    <option value="Venda para entrega futura">Venda para entrega futura</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Estado Configurável</label>
                  <select value={estadoConfiguravel} onChange={(e) => setEstadoConfiguravel(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="MADEIRA">MADEIRA</option>
                    <option value="MADEIRA CONTABILIZADO">MADEIRA CONTABILIZADO</option>
                    <option value="MADEIRA IMPORTADA">MADEIRA IMPORTADA</option>
                    <option value="MADEIRA IMPORTAÇÃO">MADEIRA IMPORTAÇÃO</option>
                    <option value="BAMBU">BAMBU</option>
                    <option value="FIBRA">FIBRA</option>
                    <option value="AROMAS">AROMAS</option>
                    <option value="ESPETOS">ESPETOS</option>
                    <option value="SERRAGEM">SERRAGEM</option>
                    <option value="ROJÃO">ROJÃO</option>
                    <option value="E-COMMERCE">E-COMMERCE</option>
                    <option value="MATÉRIA-PRIMA IMPORTADA">MATÉRIA-PRIMA IMPORTADA</option>
                    <option value="EMBALAGENS">EMBALAGENS</option>
                    <option value="PALITOS">PALITOS</option>
                    <option value="DESCARTÁVEIS">DESCARTÁVEIS</option>
                    <option value="AMOSTRA">AMOSTRA</option>
                    <option value="BONIFICAÇÃO">BONIFICAÇÃO</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Data de Entrega</label>
                  <input type="date" value={dataEntregaPedido} onChange={(e) => setDataEntregaPedido(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Previsão de Entrega</label>
                  <input type="date" value={previsaoEntregaPedido} onChange={(e) => setPrevisaoEntregaPedido(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                </div>
              </div>
              <p className="text-[8px] text-amber-500 mt-1">Estes campos serão usados na exportação do pedido para o Maxiprod.</p>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => isSimulation ? onClose() : setStep("cliente")} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
                {isSimulation ? 'Cancelar' : 'Voltar'}
              </button>
              <div className="flex gap-2">
                {showCustosDeVenda && (
                <button
                  onClick={() => setStep("pagamento")}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                >
                  Custos de Venda
                </button>
                )}
                {items.length > 0 && (
                  <button
                    onClick={handleSubmit}
                    disabled={createOrderMutation.isPending || !canProceedProdutos}
                    className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {createOrderMutation.isPending ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Pedido Concluído
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === "pagamento" && (
          <CustosDeVendaStep
            cep={cep}
            cnpjCpf={cnpjCpf}
            tipoContribuinte={tipoContribuinte}
            uf={uf}
            items={items}
            sellerId={sellerId}
            skipMarginBlock={!isMonthlyMarginBlockActive && isGestorMode}
            condicaoPagamento={condicaoPagamento}
            setCondicaoPagamento={setCondicaoPagamento}
            valorFrete={valorFrete}
            setValorFrete={setValorFrete}
            tipoFrete={tipoFrete}
            setTipoFrete={setTipoFrete}
            observacoes={observacoes}
            setObservacoes={setObservacoes}
            operacaoFiscal={operacaoFiscal}
            setOperacaoFiscal={setOperacaoFiscal}
            naturezaOperacao={naturezaOperacao}
            setNaturezaOperacao={setNaturezaOperacao}
            estadoConfiguravel={estadoConfiguravel}
            setEstadoConfiguravel={setEstadoConfiguravel}
            formaPagamento={formaPagamento}
            setFormaPagamento={setFormaPagamento}
            dataEntregaPedido={dataEntregaPedido}
            setDataEntregaPedido={setDataEntregaPedido}
            previsaoEntregaPedido={previsaoEntregaPedido}
            setPrevisaoEntregaPedido={setPrevisaoEntregaPedido}
            onTransportadoraSelect={setTransportadoraSelecionada}
            onProtocoloSet={setProtocoloCotacao}
            onTrackingUrlSet={setTrackingUrl}
            onBack={() => setStep("produtos")}
            onNext={() => setStep("revisao")}
            onRealCostsCalculated={(data) => {
              setRealComissaoPerc(data.comissaoPerc);
              setRealFretePerc(data.fretePerc);
              setRealMargemPerc(data.margemReal);
              setRealComissaoFonte(data.comissaoFonte || null);
              setRealComissaoTier(data.comissaoTier || null);
            }}
          />
        )}

        {step === "revisao" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">{isSimulation ? '3. Revisão da Simulação' : '4. Revisão do Pedido'}</p>
            {isSimulation && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-2 mb-2">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">Este é um pedido de <strong>simulação</strong> — não será enviado ao Maxiprod e não reserva estoque.</p>
              </div>
            )}
            {/* Summary */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2">
              {!isSimulation && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Cliente:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{razaoSocial}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">CNPJ/CPF:</span>
                    <span className="text-slate-700 dark:text-slate-200">{cnpjCpf}</span>
                  </div>
                  {municipio && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Local:</span>
                      <span className="text-slate-700 dark:text-slate-200">{municipio}/{uf}</span>
                    </div>
                  )}
                  {telefone1 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Telefone:</span>
                      <span className="text-slate-700 dark:text-slate-200">{telefone1}</span>
                    </div>
                  )}
                  {emailContato && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Email:</span>
                      <span className="text-slate-700 dark:text-slate-200">{emailContato}</span>
                    </div>
                  )}
                  {possuiRedespacho && (
                    <div className="border-t border-blue-200 dark:border-blue-700 pt-1.5 mt-1.5">
                      <p className="text-[10px] font-bold text-blue-600 uppercase mb-0.5">Redespacho</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">CNPJ:</span>
                        <span className="text-slate-700 dark:text-slate-200">{redespachoCnpj}</span>
                      </div>
                      {redespachoRazaoSocial && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Razão Social:</span>
                          <span className="text-slate-700 dark:text-slate-200">{redespachoRazaoSocial}</span>
                        </div>
                      )}
                      {redespachoCep && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Endereço:</span>
                          <span className="text-slate-700 dark:text-slate-200">{redespachoLogradouro}{redespachoNumero ? `, ${redespachoNumero}` : ''} - {redespachoBairro} - {redespachoCidade}/{redespachoUf} - CEP {redespachoCep}</span>
                        </div>
                      )}
                      {redespachoTelefone && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Telefone:</span>
                          <span className="text-slate-700 dark:text-slate-200">{redespachoTelefone}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {!enderecoEntregaMesmo && (
                    <div className="border-t border-orange-200 dark:border-orange-700 pt-1.5 mt-1.5">
                      <p className="text-[10px] font-bold text-orange-600 uppercase mb-0.5">Endereço de Entrega (diferente)</p>
                      {entregaCep && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Endereço:</span>
                          <span className="text-slate-700 dark:text-slate-200">{entregaLogradouro}{entregaNumero ? `, ${entregaNumero}` : ''} - {entregaBairro} - {entregaCidade}/{entregaUf} - CEP {entregaCep}</span>
                        </div>
                      )}
                      {entregaTelefone && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Telefone:</span>
                          <span className="text-slate-700 dark:text-slate-200">{entregaTelefone}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {isSimulation && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Modo:</span>
                  <span className="font-bold text-amber-600">SIMULAÇÃO</span>
                </div>
              )}
              <div className="border-t border-slate-200 dark:border-slate-600 pt-2 mt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Itens ({items.length})</p>
                {items.map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:justify-between text-[11px] py-1 gap-0.5">
                    <span className="text-slate-600 dark:text-slate-300 truncate">{item.descricaoItem}</span>
                    <span className="text-slate-500 text-[10px] sm:text-[11px] sm:ml-2 whitespace-nowrap">{item.quantidade} {item.unidadeMedida} × {formatCurrencySales(item.precoUnitario)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 dark:border-slate-600 pt-2 mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Subtotal Produtos:</span>
                  <span className="text-slate-700 dark:text-slate-200">{formatCurrencySales(totalProdutos)}</span>
                </div>
                {Number(valorFrete) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Frete ({tipoFrete}):</span>
                    <span className="text-slate-700 dark:text-slate-200">{formatCurrencySales(Number(valorFrete))}</span>
                  </div>
                )}
                {transportadoraSelecionada && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Transportadora:</span>
                    <span className="text-slate-700 dark:text-slate-200">{transportadoraSelecionada}</span>
                  </div>
                )}
                {trackingUrl && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Rastreio:</span>
                    <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:text-teal-700 underline truncate max-w-[200px]">
                      Rastrear Entrega
                    </a>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-700 dark:text-slate-200">Valor do Pedido:</span>
                  <span className="text-green-600">{formatCurrencySales(totalPedido)}</span>
                </div>
                {Number(valorFrete) > 0 && (
                  <div className="flex justify-between text-[11px] text-slate-400 italic mt-0.5">
                    <span>Frete (pago pela empresa):</span>
                    <span>{formatCurrencySales(Number(valorFrete))}</span>
                  </div>
                )}
              </div>
            </div>
            {hasPrecoAbaixo && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  ⚠️ Este pedido contém itens abaixo do preço mínimo e ficará <strong>pendente de aprovação</strong> do gestor.
                </p>
              </div>
            )}
            {/* Monthly Reputation Bar - Level 3 Commission (gestores only) */}
            {isGestorMode && !isSimulation && hasGranularAccess("gc.barraMes") && monthlyMarginQuery.data && (() => {
              const md = monthlyMarginQuery.data;
              const margin = md.projectedMonthlyMargin ?? md.currentMonthlyMargin ?? 0;
              const hasOrders = md.totalOrders > 0 || md.projectedMonthlyMargin !== null;
              if (!hasOrders) return null;
              const getMonthColor = (m: number) => {
                if (m < 15) return { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-300', label: 'Crítico' };
                if (m < 20) return { bg: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300', label: 'Comissão Baixa' };
                if (m < 25) return { bg: 'bg-yellow-400', text: 'text-yellow-700 dark:text-yellow-300', label: 'Comissão Média' };
                if (m < 29) return { bg: 'bg-green-500', text: 'text-green-700 dark:text-green-300', label: 'Comissão Média-Alta' };
                return { bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', label: 'Comissão Alta' };
              };
              const mColor = getMonthColor(margin);
              const barMin = -5;
              const barMax = 40;
              const clamped = Math.max(barMin, Math.min(barMax, margin));
              const pos = ((clamped - barMin) / (barMax - barMin)) * 100;
              return (
                <div className={`rounded-lg p-3 border-2 ${md.canCloseOrder ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700' : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Reputação do Mês ({md.month})</span>
                    </div>
                    <span className={`text-sm font-black tabular-nums ${mColor.text}`}>
                      {margin.toFixed(1)}% ({mColor.label})
                    </span>
                  </div>
                  <div className="relative w-full">
                    <div className="relative h-6 rounded-full overflow-visible border-2 border-slate-300 dark:border-slate-500 shadow-sm">
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
                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-slate-900 dark:border-t-white" />
                        <div className="w-[2px] flex-1 bg-slate-900 dark:bg-white rounded-full" />
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
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{md.totalOrders} pedido{md.totalOrders !== 1 ? 's' : ''} no mês</span>
                      {md.currentMonthlyMargin !== null && md.projectedMonthlyMargin !== null && (
                        <span className="text-slate-400">Atual: {md.currentMonthlyMargin.toFixed(1)}% → Projetado: {md.projectedMonthlyMargin.toFixed(1)}%</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {md.monthlyComissaoPercentual > 0 && (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">Comissão: {md.monthlyComissaoPercentual}%</span>
                      )}
                      {md.orderBreakdown && md.orderBreakdown.length > 0 && (
                        <button
                          onClick={() => setShowMonthlyDetailsInline(prev => !prev)}
                          className="text-[10px] font-medium text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5"
                        >
                          <Eye className="w-3 h-3" />
                          {showMonthlyDetailsInline ? 'Ocultar' : 'Detalhes'}
                        </button>
                      )}
                    </div>
                  </div>
                  {showMonthlyDetailsInline && md.orderBreakdown && md.orderBreakdown.length > 0 && (
                    <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-2">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">Pedidos do mês:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {md.orderBreakdown.map((ob: any, idx: number) => {
                          const peso = md.totalValue > 0 ? (ob.valor / md.totalValue) * 100 : 0;
                          const tierColor = ob.margem >= 29 ? 'text-blue-600' : ob.margem >= 25 ? 'text-green-600' : ob.margem >= 20 ? 'text-yellow-600' : ob.margem >= 15 ? 'text-orange-600' : 'text-red-600';
                          return (
                            <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded px-2 py-1">
                              <span className="text-[9px] text-slate-600 dark:text-slate-300 truncate flex-1">#{ob.orderId} — {ob.clienteNome || 'Cliente'}</span>
                              <div className="flex items-center gap-2 text-[9px] shrink-0">
                                <span className="text-slate-400">{formatCurrencySales(ob.valor)}</span>
                                <span className={`font-bold ${tierColor}`}>{ob.margem.toFixed(1)}%</span>
                                <span className="text-slate-400">({peso.toFixed(0)}%)</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {!md.canCloseOrder && !monthlyOverrideApproved && isMonthlyMarginBlockActive && (
                    <div className="mt-2 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded-md p-2 flex items-start gap-2">
                      <Lock className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] font-bold text-red-700 dark:text-red-300">Pedido Bloqueado</p>
                        <p className="text-[10px] text-red-600 dark:text-red-400">
                          Com este pedido, sua média ponderada mensal cairia para {md.projectedMonthlyMargin?.toFixed(1)}% (abaixo dos 15% mínimos).
                          Ajuste os preços ou remova itens para manter a média acima de 15%.
                        </p>
                      </div>
                    </div>
                  )}
                  {!md.canCloseOrder && !monthlyOverrideApproved && isMonthlyMarginBlockActive && !showManagerPasswordInput && (
                    <button
                      onClick={() => setShowManagerPasswordInput(true)}
                      className="mt-2 w-full px-3 py-2 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Liberar com Senha do Gestor
                    </button>
                  )}
                  {!md.canCloseOrder && !monthlyOverrideApproved && isMonthlyMarginBlockActive && showManagerPasswordInput && (
                    <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-3">
                      <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 mb-2">Aprovação do Gestor</p>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={managerPassword}
                          onChange={(e) => { setManagerPassword(e.target.value); setManagerPasswordError(""); }}
                          placeholder="Senha do gestor"
                          className="flex-1 px-3 py-1.5 text-xs border border-amber-300 dark:border-amber-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && managerPassword.trim()) {
                              verifyManagerMutation.mutate({ password: managerPassword }, {
                                onSuccess: (res) => {
                                  if (res.success) {
                                    setMonthlyOverrideApproved(true);
                                    setApprovedByManager(res.operatorName || "Gestor");
                                    setShowManagerPasswordInput(false);
                                    setManagerPassword("");
                                    setManagerPasswordError("");
                                  } else {
                                    setManagerPasswordError("Senha incorreta");
                                  }
                                },
                              });
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (!managerPassword.trim()) return;
                            verifyManagerMutation.mutate({ password: managerPassword }, {
                              onSuccess: (res) => {
                                if (res.success) {
                                  setMonthlyOverrideApproved(true);
                                  setApprovedByManager(res.operatorName || "Gestor");
                                  setShowManagerPasswordInput(false);
                                  setManagerPassword("");
                                  setManagerPasswordError("");
                                } else {
                                  setManagerPasswordError("Senha incorreta");
                                }
                              },
                            });
                          }}
                          disabled={verifyManagerMutation.isPending || !managerPassword.trim()}
                          className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-md transition-colors"
                        >
                          {verifyManagerMutation.isPending ? '...' : 'Liberar'}
                        </button>
                        <button
                          onClick={() => { setShowManagerPasswordInput(false); setManagerPassword(""); setManagerPasswordError(""); }}
                          className="px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
                        >
                          Cancelar
                        </button>
                      </div>
                      {managerPasswordError && (
                        <p className="text-[10px] text-red-600 mt-1 font-medium">{managerPasswordError}</p>
                      )}
                    </div>
                  )}
                  {!md.canCloseOrder && monthlyOverrideApproved && isMonthlyMarginBlockActive && (
                    <div className="mt-2 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-md p-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                      <p className="text-[11px] font-bold text-green-700 dark:text-green-300">
                        Liberado por {approvedByManager} — Pedido pode ser fechado apesar da margem mensal.
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
            {isGestorMode && !isSimulation && hasGranularAccess("gc.barraMes") && monthlyMarginQuery.isLoading && items.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Calculando reputação mensal...
              </div>
            )}
            {/* Second bar: Discount-based commission (comparativo) */}
            {isGestorMode && !isSimulation && hasGranularAccess("gc.comissaoPercentual") && monthlyDiscountQuery.data && (() => {
              const dd = monthlyDiscountQuery.data;
              if (!dd.avgDiscount && dd.avgDiscount !== 0) return null;
              if (dd.totalOrders === 0) return null;
              const discount = dd.avgDiscount ?? 0;
              const getDiscountColor = (d: number) => {
                if (d < 20) return { bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', label: 'Comissão Alta' };
                if (d <= 23) return { bg: 'bg-green-500', text: 'text-green-700 dark:text-green-300', label: 'Comissão Média-Alta' };
                if (d <= 27) return { bg: 'bg-yellow-400', text: 'text-yellow-700 dark:text-yellow-300', label: 'Comissão Média' };
                if (d <= 32) return { bg: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300', label: 'Comissão Baixa' };
                return { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-300', label: 'Crítico' };
              };
              const dColor = getDiscountColor(discount);
              // Bar: 0% to 40% discount range (mirrored: Red left, Blue right)
              const barMin = 0;
              const barMax = 40;
              const clamped = Math.max(barMin, Math.min(barMax, discount));
              const pos = 100 - (((clamped - barMin) / (barMax - barMin)) * 100);
              return (
                <div className="rounded-lg p-3 border-2 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 mt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Comissão por Desconto Médio</span>
                    </div>
                    <span className={`text-sm font-black tabular-nums ${dColor.text}`}>
                      {discount.toFixed(1)}% desc. ({dColor.label})
                    </span>
                  </div>
                  <div className="relative w-full">
                    <div className="relative h-6 rounded-full overflow-visible border-2 border-slate-300 dark:border-slate-500 shadow-sm">
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
                      <div
                        className="absolute flex flex-col items-center"
                        style={{ left: `${pos}%`, transform: "translateX(-50%)", top: "-6px", bottom: "-2px" }}
                      >
                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-slate-900 dark:border-t-white" />
                        <div className="w-[2px] flex-1 bg-slate-900 dark:bg-white rounded-full" />
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
                    <span className="text-slate-500">{dd.totalOrders} pedido{dd.totalOrders !== 1 ? 's' : ''} · Média pond. dos descontos</span>
                    {dd.discountComissao && (
                      <span className="font-bold text-purple-600 dark:text-purple-400">Comissão: {dd.discountComissao}%</span>
                    )}
                  </div>
                </div>
              );
            })()}
            {/* DADOS COMPLEMENTARES DO CLIENTE - Collapsible section */}
            {!isSimulation && (
            <div className="mt-3 border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDadosComplementares(!showDadosComplementares)}
                className="w-full px-3 py-2.5 flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">Dados Complementares do Cliente</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDadosComplementares ? 'rotate-180' : ''}`} />
              </button>
              {showDadosComplementares && (
                <div className="p-3 space-y-3 border-t border-slate-200 dark:border-slate-600">
                  {/* DADOS FISCAIS */}
                  <div className="p-3 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-2">DADOS FISCAIS</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1">Regime Tributario</label>
                        <select value={regimeTributario} onChange={(e) => setRegimeTributario(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          <option value="Normal">Normal</option>
                          <option value="Simples Nacional">Simples Nacional</option>
                          <option value="Lucro Presumido">Lucro Presumido</option>
                          <option value="Lucro Real">Lucro Real</option>
                          <option value="MEI">MEI</option>
                        </select>
                      </div>
                      <OrderFormInput label="Inscricao Municipal" value={inscricaoMunicipal} onChange={setInscricaoMunicipal} placeholder="IM" />
                      <OrderFormInput label="Inscricao SUFRAMA" value={inscricaoSuframa} onChange={setInscricaoSuframa} placeholder="SUFRAMA" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1">Situacao Fiscal Especial</label>
                        <select value={situacaoFiscalEspecial} onChange={(e) => setSituacaoFiscalEspecial(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          <option value="Nenhuma">Nenhuma</option>
                          <option value="Zona Franca de Manaus">Zona Franca de Manaus</option>
                          <option value="Area de Livre Comercio">Area de Livre Comercio</option>
                        </select>
                      </div>
                      <OrderFormInput label="CNAE Fiscal" value={cnaeFiscal} onChange={setCnaeFiscal} placeholder="0000000" />
                      <OrderFormInput label="Email NF-e/NFC-e" value={emailNfe} onChange={setEmailNfe} placeholder="nfe@empresa.com" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <OrderFormInput label="Website" value={websiteCliente} onChange={setWebsiteCliente} placeholder="www.empresa.com.br" />
                    </div>
                  </div>

                  {/* DADOS DE VENDA */}
                  <div className="p-3 bg-green-50/50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase mb-2">DADOS DE VENDA</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <OrderFormInput label="Limite de Credito (R$)" value={limiteCredito} onChange={setLimiteCredito} placeholder="999.999,99" />
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1">Forma de Cobranca (padrao)</label>
                        <select value={formaCobranca} onChange={(e) => setFormaCobranca(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          <option value="">Selecione...</option>
                          <option value="Boleto">Boleto</option>
                          <option value="Deposito">Deposito</option>
                          <option value="PIX">PIX</option>
                          <option value="Cartao">Cartao</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Dinheiro">Dinheiro</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <OrderFormInput label="Tabela de Precos" value={tabelaPrecos} onChange={setTabelaPrecos} placeholder="Nome da tabela" />
                      <OrderFormInput label="Condicao de Pagamento" value={condicaoPagamento} onChange={setCondicaoPagamento} placeholder="30/60/90 dias" />
                    </div>
                  </div>

                  {/* DADOS DE RELACIONAMENTO (CRM) */}
                  <div className="p-3 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase mb-2">DADOS DE RELACIONAMENTO (CRM)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <OrderFormInput label="Regiao" value={regiao} onChange={setRegiao} placeholder="Regiao" />
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1">Perfil</label>
                        <select value={perfil} onChange={(e) => setPerfil(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          <option value="">Selecione...</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1">Forma de Pedido</label>
                        <select value={formaPedido} onChange={(e) => setFormaPedido(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          <option value="">Selecione...</option>
                          <option value="Telefone">Telefone</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Email">Email</option>
                          <option value="Presencial">Presencial</option>
                          <option value="App">App</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                      <OrderFormInput label="Produtos de Interesse" value={produtosInteresse} onChange={setProdutosInteresse} placeholder="Produtos de interesse" />
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1">Probabilidade de Negocio</label>
                        <select value={probabilidadeNegocio} onChange={(e) => setProbabilidadeNegocio(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          <option value="">Selecione...</option>
                          <option value="Alta">Alta</option>
                          <option value="Media">Media</option>
                          <option value="Baixa">Baixa</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1">Tamanho</label>
                        <select value={tamanho} onChange={(e) => setTamanho(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          <option value="">Selecione...</option>
                          <option value="Pequeno">Pequeno</option>
                          <option value="Medio">Medio</option>
                          <option value="Grande">Grande</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1">Atencao</label>
                        <select value={atencao} onChange={(e) => setAtencao(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          <option value="Normal">Normal</option>
                          <option value="Urgente">Urgente</option>
                          <option value="VIP">VIP</option>
                        </select>
                      </div>
                      <OrderFormInput label="Fornecedor Atual" value={fornecedorAtual} onChange={setFornecedorAtual} placeholder="Concorrente atual" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}
            <div className="flex justify-between pt-2">
              <button onClick={() => showCustosDeVenda ? setStep("pagamento") : setStep("produtos")} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
                Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={createOrderMutation.isPending || (isMonthlyMarginBlockActive && monthlyMarginQuery.data?.canCloseOrder === false && !monthlyOverrideApproved)}
                className={`px-5 py-2 ${isSimulation ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'} disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5`}
              >
                {createOrderMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (isMonthlyMarginBlockActive && monthlyMarginQuery.data?.canCloseOrder === false && !monthlyOverrideApproved) ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {isSimulation ? 'Concluir Simulação' : (isMonthlyMarginBlockActive && monthlyMarginQuery.data?.canCloseOrder === false && !monthlyOverrideApproved) ? 'Bloqueado (Margem Mensal)' : 'Pedido Concluído'}
              </button>
            </div>
          </div>
        )}
      </div>
      {/* RESUMO FINAL - Shown after order is submitted */}
      {step === "resumo_final" && orderSubmitted && (
        <div className="p-4 space-y-4">
          <div className="text-center py-4">
            <div className={`w-16 h-16 mx-auto ${isSimulation ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-green-100 dark:bg-green-900/30'} rounded-full flex items-center justify-center mb-3`}>
              <svg className={`w-8 h-8 ${isSimulation ? 'text-amber-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className={`text-lg font-bold ${isSimulation ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>
              {isSimulation ? 'Simulação Concluída!' : 'Pedido Enviado com Sucesso!'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {isSimulation
                ? `Simulação #${submittedOrderNumber || submittedOrderId} • Apenas para referência interna`
                : `Pedido #${submittedOrderNumber || submittedOrderId} • Notificação enviada para Vitória, Juvenal e Guilherme`
              }
            </p>
          </div>
          {/* Resumo completo */}
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-600">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase border-b border-slate-200 dark:border-slate-600 pb-2">Resumo do Pedido</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-slate-400">Vendedor:</span> <span className="font-bold text-slate-700 dark:text-slate-200">{sellerName}</span></div>
              <div><span className="text-slate-400">Cliente:</span> <span className="font-bold text-slate-700 dark:text-slate-200">{razaoSocial}</span></div>
              {cnpjCpf && <div><span className="text-slate-400">CNPJ/CPF:</span> <span className="text-slate-700 dark:text-slate-200">{cnpjCpf}</span></div>}
              {municipio && <div><span className="text-slate-400">Local:</span> <span className="text-slate-700 dark:text-slate-200">{municipio}/{uf}</span></div>}
              {condicaoPagamento && <div><span className="text-slate-400">Pagamento:</span> <span className="text-slate-700 dark:text-slate-200">{condicaoPagamento}</span></div>}
              {tipoFrete && <div><span className="text-slate-400">Frete:</span> <span className="text-slate-700 dark:text-slate-200">{tipoFrete}</span></div>}
              {telefone1 && <div><span className="text-slate-400">Telefone:</span> <span className="text-slate-700 dark:text-slate-200">{telefone1}</span></div>}
              {emailContato && <div><span className="text-slate-400">Email:</span> <span className="text-slate-700 dark:text-slate-200">{emailContato}</span></div>}
              {cep && <div><span className="text-slate-400">CEP:</span> <span className="text-slate-700 dark:text-slate-200">{cep}</span></div>}
              {endereco && <div className="col-span-2"><span className="text-slate-400">Endereço:</span> <span className="text-slate-700 dark:text-slate-200">{endereco}{numero ? `, ${numero}` : ''}{complemento ? ` - ${complemento}` : ''} - {bairro} - {municipio}/{uf}</span></div>}
            </div>
            {possuiRedespacho && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-2 mt-2">
                <p className="text-[10px] font-bold text-blue-600 uppercase">Redespacho</p>
                <div className="grid grid-cols-2 gap-1 text-xs mt-1">
                  <div><span className="text-slate-400">CNPJ:</span> <span className="text-slate-700 dark:text-slate-200">{redespachoCnpj}</span></div>
                  {redespachoRazaoSocial && <div><span className="text-slate-400">Razão:</span> <span className="text-slate-700 dark:text-slate-200">{redespachoRazaoSocial}</span></div>}
                  {redespachoCep && <div className="col-span-2"><span className="text-slate-400">End:</span> <span className="text-slate-700 dark:text-slate-200">{redespachoLogradouro}{redespachoNumero ? `, ${redespachoNumero}` : ''} - {redespachoBairro} - {redespachoCidade}/{redespachoUf} CEP {redespachoCep}</span></div>}
                  {redespachoTelefone && <div><span className="text-slate-400">Tel:</span> <span className="text-slate-700 dark:text-slate-200">{redespachoTelefone}</span></div>}
                </div>
              </div>
            )}
            {!enderecoEntregaMesmo && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-2 mt-2">
                <p className="text-[10px] font-bold text-orange-600 uppercase">Endereço de Entrega (diferente)</p>
                <div className="grid grid-cols-2 gap-1 text-xs mt-1">
                  {entregaCep && <div><span className="text-slate-400">CEP:</span> <span className="text-slate-700 dark:text-slate-200">{entregaCep}</span></div>}
                  {entregaLogradouro && <div className="col-span-2"><span className="text-slate-400">End:</span> <span className="text-slate-700 dark:text-slate-200">{entregaLogradouro}{entregaNumero ? `, ${entregaNumero}` : ''} - {entregaBairro} - {entregaCidade}/{entregaUf}</span></div>}
                  {entregaTelefone && <div><span className="text-slate-400">Tel:</span> <span className="text-slate-700 dark:text-slate-200">{entregaTelefone}</span></div>}
                </div>
              </div>
            )}
            {/* Items */}
            <div className="border-t border-slate-200 dark:border-slate-600 pt-3 mt-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Itens do Pedido ({items.length})</p>
              <div className="space-y-2">
                {items.map((item, idx) => {
                  const pesoTotal = item.pesoBrutoCaixa ? item.pesoBrutoCaixa * item.quantidade : 0;
                  const dimsArr = item.dimsStr ? item.dimsStr.split('x').map(v => parseFloat(v.replace(',', '.'))) : [];
                  const volumeTotal = dimsArr.length === 3 ? (dimsArr[0] * dimsArr[1] * dimsArr[2] / 1000000) * item.quantidade : 0;
                  return (
                    <div key={idx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-3">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.descricaoItem}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px]">
                        <span className="text-slate-400">Cód: <span className="font-mono text-slate-600 dark:text-slate-300">{item.codigoItem}</span></span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">{item.quantidade} cx × {formatCurrencySales(item.precoUnitario)} = {formatCurrencySales(item.quantidade * item.precoUnitario)}</span>
                        {item.precoVendedor && item.precoUnitario < item.precoVendedor && (
                          <span className="text-orange-500">({(((item.precoVendedor - item.precoUnitario) / item.precoVendedor) * 100).toFixed(1)}% desc.)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        {pesoTotal > 0 && <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded">⚖️ Peso Total: {pesoTotal.toFixed(1)} kg</span>}
                        {volumeTotal > 0 && <span className="text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded">📦 Cubagem: {volumeTotal.toFixed(3)} m³</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Totais gerais */}
            <div className="border-t border-slate-200 dark:border-slate-600 pt-3 mt-2 space-y-2">
              {(() => {
                const pesoGeral = items.reduce((sum, i) => sum + (i.pesoBrutoCaixa ? i.pesoBrutoCaixa * i.quantidade : 0), 0);
                const volumeGeral = items.reduce((sum, i) => {
                  const d = i.dimsStr ? i.dimsStr.split('x').map(v => parseFloat(v.replace(',', '.'))) : [];
                  return sum + (d.length === 3 ? (d[0] * d[1] * d[2] / 1000000) * i.quantidade : 0);
                }, 0);
                const totalCaixas = items.reduce((sum, i) => sum + i.quantidade, 0);
                return (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Total de Caixas:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{totalCaixas} caixas</span>
                    </div>
                    {pesoGeral > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 font-bold text-purple-600">⚖️ Peso Total Geral:</span>
                        <span className="font-bold text-purple-700 dark:text-purple-300 text-sm">{pesoGeral.toFixed(1)} kg</span>
                      </div>
                    )}
                    {volumeGeral > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 font-bold text-orange-600">📦 Cubagem Total:</span>
                        <span className="font-bold text-orange-700 dark:text-orange-300 text-sm">{volumeGeral.toFixed(3)} m³</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Subtotal Produtos:</span>
                      <span className="text-slate-700 dark:text-slate-200">{formatCurrencySales(totalProdutos)}</span>
                    </div>
                    {Number(valorFrete) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Frete ({tipoFrete}):</span>
                        <span className="text-slate-700 dark:text-slate-200">{formatCurrencySales(Number(valorFrete))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold border-t border-slate-300 dark:border-slate-500 pt-2">
                      <span className="text-slate-700 dark:text-slate-200">VALOR DO PEDIDO:</span>
                      <span className="text-green-600 text-lg">{formatCurrencySales(totalPedido)}</span>
                    </div>
                    {Number(valorFrete) > 0 && (
                      <div className="flex justify-between text-xs text-slate-400 italic mt-0.5">
                        <span>Frete (pago pela empresa):</span>
                        <span>{formatCurrencySales(Number(valorFrete))}</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
          {observacoes && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-[10px] font-bold text-amber-600 uppercase">Observações:</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{observacoes}</p>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={() => handleExportCSV()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Exportar Pedido Maxiprod (.xlsx)
            </button>
            <button
              onClick={() => {
                if (submittedOrderId && confirm("Tem certeza que deseja APAGAR este pedido? Esta ação não pode ser desfeita.")) {
                  deleteOrderMutation.mutate({ orderId: submittedOrderId }, {
                    onSuccess: () => {
                      utils.salesOrders.getSellerOrders.invalidate();
                      onClose();
                    }
                  });
                }
              }}
              disabled={deleteOrderMutation.isPending}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-bold rounded-lg transition-colors"
            >
              {deleteOrderMutation.isPending ? "Apagando..." : "🗑️ Apagar Pedido"}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-lg transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
      {/* Below Minimum Price Confirmation Modal */}
      {showBelowMinConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="bg-red-50 dark:bg-red-900/30 px-5 py-4 border-b border-red-200 dark:border-red-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <span className="text-xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-red-800 dark:text-red-200">Preço Abaixo do Mínimo</h3>
                  <p className="text-[11px] text-red-600 dark:text-red-400">Atenção: produtos com preço inferior ao permitido</p>
                </div>
              </div>
            </div>
            {/* Body */}
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Você está vendendo os seguintes produtos a um preço <strong>menor que o mínimo</strong>:
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {itemsBelowMin.map((item, idx) => {
                  const diff = item.precoMinimo! - item.precoUnitario;
                  const pct = ((diff / item.precoMinimo!) * 100).toFixed(1);
                  return (
                    <div key={idx} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight">{item.descricaoItem}</p>
                      <div className="grid grid-cols-3 gap-2 mt-1.5">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Seu preço</p>
                          <p className="text-[11px] font-bold text-red-600">R$ {item.precoUnitario.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Mínimo</p>
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">R$ {item.precoMinimo!.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Diferença</p>
                          <p className="text-[11px] font-bold text-red-600">-{pct}% (R$ {diff.toFixed(2)})</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  <strong>Se confirmar:</strong> o pedido será enviado para aprovação do gestor antes de ser processado.
                </p>
              </div>
            </div>
            {/* Actions */}
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex gap-3">
              <button
                onClick={() => { setShowBelowMinConfirm(false); setStep("produtos"); }}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
              >
                Editar Pedido
              </button>
              <button
                onClick={() => doSubmitOrder(true)}
                disabled={createOrderMutation.isPending || (isMonthlyMarginBlockActive && monthlyMarginQuery.data?.canCloseOrder === false && !monthlyOverrideApproved)}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                {createOrderMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (isMonthlyMarginBlockActive && monthlyMarginQuery.data?.canCloseOrder === false && !monthlyOverrideApproved) ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : null}
                {(isMonthlyMarginBlockActive && monthlyMarginQuery.data?.canCloseOrder === false && !monthlyOverrideApproved) ? 'Bloqueado (Margem Mensal)' : 'Sim, Enviar Mesmo Assim'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PO Reservation Modal */}
      {reservePO && (
        <ReservationModal
          item={{ codigoItem: reservePO.codigoItem, descricaoItem: reservePO.descricaoItem, disponivelCx: 0 } as any}
          po={{ referencia: reservePO.referencia, dataEntrega: reservePO.dataEntrega, quantidade: reservePO.quantidade }}
          sellerId={sellerId}
          sellerName={sellerName}
          onClose={() => setReservePO(null)}
          onSuccess={() => setReservePO(null)}
        />
      )}
    </div>
  );
}

function OrderFormInput({ label, value, onChange, placeholder, type = "text", required, error }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; error?: boolean;
}) {
  const showError = error && required && !value.trim();
  return (
    <div>
      <label className={`text-[10px] font-medium ${showError ? 'text-red-500' : 'text-slate-500'}`}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full mt-0.5 px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500/30 ${
          showError ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-600'
        }`}
      />
    </div>
  );
}

function SellerSalesView({ sellerId, sellerName, gestorName }: { sellerId: number; sellerName: string; gestorName: string }) {
  const [period, setPeriod] = useState<SalesPeriod>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [targetMonth, setTargetMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [targetType, setTargetType] = useState<"valor" | "quantidade">("valor");
  const [targetValue, setTargetValue] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");

  const { startDate, endDate } = useMemo(
    () => getSalesDateRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  // Buscar ranking geral para posicionar o vendedor
  const { data: ranking, isLoading: loadingRanking } = trpc.salesMetrics.getVendedorRanking.useQuery(
    { startDate, endDate },
    { staleTime: 60 * 1000 }
  );

  // Buscar detalhe do vendedor (por cliente)
  const { data: vendedorDetail, isLoading: loadingDetail } = trpc.salesMetrics.getVendedorDetail.useQuery(
    { vendedor: sellerName, startDate, endDate },
    { staleTime: 60 * 1000 }
  );

  // Encontrar posição no ranking
  const sellerRankData = ranking?.find(
    (r) => r.vendedor.toUpperCase() === sellerName.toUpperCase()
  );
  const rankPosition = ranking?.findIndex(
    (r) => r.vendedor.toUpperCase() === sellerName.toUpperCase()
  );
  const position = rankPosition !== undefined && rankPosition >= 0 ? rankPosition + 1 : null;

  const totalVendas = sellerRankData?.totalVendas || 0;
  const qtdPedidos = sellerRankData?.qtdPedidos || 0;
  const qtdClientes = sellerRankData?.qtdClientes || 0;
  const ticketMedio = qtdPedidos > 0 ? totalVendas / qtdPedidos : 0;
  const totalRanking = ranking?.length || 0;

  const isLoading = loadingRanking || loadingDetail;

  const periodLabel = SALES_PERIODS.find((p) => p.value === period)?.label || "";

  // === METAS E AVALIAÇÃO ===
  const utils = trpc.useUtils();
  const { data: evaluation, isLoading: loadingEval } = trpc.salesMetrics.getSellerEvaluation.useQuery(
    { sellerId, sellerName },
    { staleTime: 60 * 1000 }
  );
  const { data: targets } = trpc.salesMetrics.getSellerTargets.useQuery(
    { sellerId },
    { staleTime: 60 * 1000 }
  );
  const upsertTarget = trpc.salesMetrics.upsertSellerTarget.useMutation({
    onSuccess: () => {
      utils.salesMetrics.getSellerTargets.invalidate();
      utils.salesMetrics.getSellerEvaluation.invalidate();
      setShowTargetForm(false);
      setTargetValue("");
      setCommissionPercent("");
    },
  });
  const deleteTarget = trpc.salesMetrics.deleteSellerTarget.useMutation({
    onSuccess: () => {
      utils.salesMetrics.getSellerTargets.invalidate();
      utils.salesMetrics.getSellerEvaluation.invalidate();
    },
  });

  const handleSaveTarget = () => {
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const value = parseFloat(targetValue);
    const commission = parseFloat(commissionPercent);
    if (!year || !month || isNaN(value) || isNaN(commission)) return;
    upsertTarget.mutate({
      sellerId,
      sellerName,
      gestorName,
      year,
      month,
      targetType,
      targetValue: value,
      commissionPercent: commission,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header com seletor de período */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Vendas de {sellerName}
            </h3>
          </div>

          {/* Period chips */}
          <div className="flex flex-wrap gap-1.5">
            {SALES_PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  setPeriod(p.value);
                  if (p.value === "custom") setShowCustom(true);
                  else setShowCustom(false);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  period === p.value
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date inputs */}
        {showCustom && period === "custom" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            />
            <span className="text-xs text-slate-400">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            />
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 text-teal-500 animate-spin" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-green-600" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-medium">Total Vendas</span>
              </div>
              <p className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">
                {formatCurrencySales(totalVendas)}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-medium">Pedidos</span>
              </div>
              <p className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">
                {qtdPedidos}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-medium">Clientes</span>
              </div>
              <p className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">
                {qtdClientes}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <Trophy className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-medium">Ranking</span>
              </div>
              <p className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">
                {position ? `${position}º` : "-"}{" "}
                <span className="text-xs font-normal text-slate-400">/ {totalRanking}</span>
              </p>
            </div>
          </div>

          {/* Ticket Médio */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Ticket Médio</span>
              </div>
              <span className="text-sm font-bold text-teal-700 dark:text-teal-400">
                {formatCurrencySales(ticketMedio)}
              </span>
            </div>
          </div>

          {/* Detalhe por cliente */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Vendas por Cliente
                </h4>
                <span className="text-[10px] text-slate-400 ml-auto">{periodLabel}</span>
              </div>
            </div>

            {(!vendedorDetail || vendedorDetail.length === 0) ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-400">Nenhuma venda encontrada no período.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {vendedorDetail.map((client, idx) => (
                  <div key={client.cliente} className="p-3 md:p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 w-5 text-right">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                            {client.cliente}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400">
                              {client.qtdPedidos} pedido{client.qtdPedidos !== 1 ? "s" : ""}
                            </span>
                            {client.ultimoPedido && (
                              <span className="text-[10px] text-slate-400">
                                · Último: {formatDateSales(client.ultimoPedido)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-xs md:text-sm font-bold text-green-700 dark:text-green-400">
                          {formatCurrencySales(client.totalVendas)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


/**
 * ============================================================
 * ABA TABELA DE PREÇOS - Preços dos produtos do vendedor
 * Dados sincronizados do Maxiprod (tabela de vendas)
 * Mostra: Código, Produto, Preço Mostrado, Preço Alto, Preço Médio-Alto, Preço Médio, Preço Baixo
 * ============================================================
 */
function TabelaPrecosView({ sellerId, sellerName, gestorName }: { sellerId: number; sellerName: string; gestorName: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const { data, isLoading, error } = trpc.sales.getPriceTableItems.useQuery({ sellerId });
  const tiersQuery = trpc.sales.getPriceTierDiscounts.useQuery({ gestorName });
  const tiers = tiersQuery.data?.tiers || { alto: 20, medioAlto: 23, medio: 27, baixo: 32 };
  const syncMutation = trpc.sales.syncPriceTables.useMutation({
    onSuccess: () => {
      // Refetch after sync
      window.location.reload();
    },
  });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    const sorted = [...data.items].sort((a: any, b: any) => a.itemCodigo.localeCompare(b.itemCodigo, undefined, { numeric: true }));
    if (!searchTerm) return sorted;
    const term = searchTerm.toLowerCase();
    return sorted.filter((item: any) =>
      item.itemCodigo.toLowerCase().includes(term) ||
      item.itemDescricao.toLowerCase().includes(term)
    );
  }, [data?.items, searchTerm]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando tabela de preços...</span>
        </div>
      </div>
    );
  }

  if (!data?.priceTable || data.items.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Tabela de Preços</h3>
          </div>
          <span className="text-xs text-slate-400">{sellerName}</span>
        </div>
        <div className="p-8 md:p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mb-4">
              <Tag className="w-7 h-7 text-amber-500 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Sem Tabela de Preços</h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 max-w-sm">
              Este vendedor ainda não possui uma tabela de preços cadastrada no Maxiprod.
              Quando o gestor criar a tabela, ela aparecerá aqui automaticamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 md:px-6 py-5 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-sm">
              <Tag className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{data.priceTable.descricao}</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{data.items.length} produtos cadastrados</p>
            </div>
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-300 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-700/40 border-b border-slate-200 dark:border-slate-600">
              <th className="w-[80px] px-3 py-3 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Código</th>
              <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Produto</th>
              <th className="w-[110px] px-3 py-3 text-right text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Preço Mostrado</th>
              <th className="w-[100px] px-3 py-3 text-right text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Alto ({tiers.alto}%)</th>
              <th className="w-[100px] px-3 py-3 text-right text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Médio-Alto ({tiers.medioAlto}%)</th>
              <th className="w-[100px] px-3 py-3 text-right text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Médio ({tiers.medio}%)</th>
              <th className="w-[100px] px-3 py-3 text-right text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Baixo ({tiers.baixo}%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredItems.map((item: any, idx: number) => (
              <tr key={item.id} className={`transition-colors hover:bg-teal-50/40 dark:hover:bg-teal-900/10 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/40 dark:bg-slate-750/30'}`}>
                <td className="px-3 py-2.5 align-middle">
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-medium">
                    {item.itemCodigo}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-middle truncate">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    {item.itemDescricao}
                  </span>
                </td>
                {(() => {
                  const precoMostrado = parseFloat(item.preco);
                  // Preço Mostrado = preço direto da tabela Maxiprod (sem margem)
                  return (
                    <>
                      <td className="px-3 py-2.5 text-right align-middle">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                          R$ {precoMostrado.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          R$ {(precoMostrado * (1 - tiers.alto / 100)).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle">
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                          R$ {(precoMostrado * (1 - tiers.medioAlto / 100)).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle">
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                          R$ {(precoMostrado * (1 - tiers.medio / 100)).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle">
                        <span className="text-xs font-bold text-red-600 dark:text-red-400 tabular-nums">
                          R$ {(precoMostrado * (1 - tiers.baixo / 100)).toFixed(2)}
                        </span>
                      </td>
                    </>
                  );
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 md:px-6 py-3.5 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50/80 to-white dark:from-slate-800 dark:to-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            {filteredItems.length === data.items.length
              ? `${data.items.length} produtos na tabela`
              : `Exibindo ${filteredItems.length} de ${data.items.length} produtos`}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Sincronizado do Maxiprod
          </span>
        </div>
      </div>
    </div>
  );
}
