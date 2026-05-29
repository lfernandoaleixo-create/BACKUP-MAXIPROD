/**
 * VendedorDetalhe - Página de detalhe de um vendedor específico
 * Abas: Estoque, Cadastro de Cliente, Vendas, Configurações
 * Acessível via /gestao-comercial/vendedor/:sellerId
 * 
 * - Aba Estoque: mostra APENAS os produtos que o gestor ticou, com dados reais
 *   (disponível p/ venda, POs projetadas, reservas)
 * - Aba Configurações: ticagem de produtos visíveis, autorização, senha, catálogos
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import TopNav from "@/components/TopNav";
import { trpc } from "@/lib/trpc";
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
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import SellerVisitReportTab from "@/components/SellerVisitReportTab";

type TabType = "estoque" | "clientes" | "tabela_precos" | "catalogos" | "pedidos" | "relatorio_vendas" | "vendas" | "configuracoes";

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
  const { sellerMode = false, externalSellerId, onLogout } = props;
  const params = useParams<{ sellerId: string }>();
  const [, setLocation] = useLocation();
  const sellerId = externalSellerId || parseInt(params.sellerId || "0", 10);
  const [activeTab, setActiveTab] = useState<TabType>("estoque");

  // Buscar dados do vendedor
  const permissionsQuery = trpc.sales.listSellerPermissions.useQuery(undefined, {
    staleTime: 30 * 1000,
  });

  const seller = permissionsQuery.data?.find((p: any) => p.id === sellerId);

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

  const allTabs: { id: TabType; label: string; icon: typeof Package }[] = [
    { id: "estoque", label: "Estoque", icon: Package },
    { id: "clientes", label: "Cadastro de Cliente", icon: UserPlus },
    { id: "tabela_precos", label: "Tabela de Preços", icon: Tag },
    { id: "catalogos", label: "Catálogos", icon: FolderOpen },
    { id: "pedidos", label: "Pedidos de Venda", icon: ShoppingCart },
    { id: "relatorio_vendas", label: "Relatório de Vendas", icon: FileCheck },
    { id: "vendas", label: "Métrica de Vendas", icon: BarChart3 },
    { id: "configuracoes", label: "Configurações", icon: Settings },
  ];

  // No modo vendedor, esconde a aba Configurações
  const tabs = sellerMode ? allTabs.filter(t => t.id !== "configuracoes") : allTabs;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {!sellerMode && <TopNav />}

      <main className="container py-4 md:py-6 space-y-4 pb-20 md:pb-6">
        {/* Header com botão voltar e info do vendedor */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-3">
            {!sellerMode ? (
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
            {sellerMode && onLogout && (
              <button
                onClick={onLogout}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors ml-2"
                title="Sair"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Abas de navegação */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-1 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                <span>{tab.label}</span>
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
          <TabelaPrecosView sellerId={sellerId} sellerName={seller.sellerName} />
        )}

        {activeTab === "catalogos" && (
          <SellerCatalogosView sellerId={sellerId} sellerName={seller.sellerName} />
        )}

        {activeTab === "pedidos" && (
          <SellerOrdersView sellerId={sellerId} sellerName={seller.sellerName} />
        )}

        {activeTab === "relatorio_vendas" && (
          <SellerVisitReportTab sellerId={sellerId} sellerName={seller.sellerName} />
        )}

        {activeTab === "vendas" && (
          <SellerSalesView sellerName={seller.sellerName} />
        )}

        {activeTab === "configuracoes" && (
          <SellerConfigPanel sellerId={sellerId} sellerName={seller.sellerName} seller={seller} />
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
 * ABA ESTOQUE - Mostra produtos ticados com dados reais
 * Disponível p/ Venda + POs projetadas
 * ============================================================
 */
function SellerStockView({ sellerId, sellerName }: { sellerId: number; sellerName: string }) {
  const [reservationItem, setReservationItem] = useState<DashboardItem | null>(null);
  const [reservationPO, setReservationPO] = useState<{ referencia: string; dataEntrega: string; quantidade: number } | null>(null);

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

  const madeiraProducts = useMemo(() =>
    visibleProducts.filter(item => item.grupo === "industrializacao" && item.subgrupo === "madeira"),
    [visibleProducts]
  );

  const bambuProducts = useMemo(() =>
    visibleProducts.filter(item => item.grupo === "importacao_revenda" && item.subgrupo === "bambu"),
    [visibleProducts]
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
          allowReserve={true}
          onReserve={(item, po) => { setReservationItem(item); setReservationPO(po || null); }}
          reservationSummary={reservationSummary.data || {}}
        />
      )}

      {/* Reservas ativas */}
      {reservationsQuery.data && reservationsQuery.data.length > 0 && (
        <ReservationsPanel reservations={reservationsQuery.data} onCancelSuccess={() => {
          reservationsQuery.refetch();
          reservationSummary.refetch();
        }} />
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
}: {
  title: string;
  items: DashboardItem[];
  color: "amber" | "green";
  sellerName: string;
  sellerId: number;
  allowReserve: boolean;
  onReserve: (item: DashboardItem, po?: { referencia: string; dataEntrega: string; quantidade: number }) => void;
  reservationSummary: Record<string, number>;
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
          {/* Header da tabela - mobile-friendly */}
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
                <div className="md:hidden px-4 py-3 space-y-2">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-tight">
                    <span className="font-mono text-slate-400 mr-1">{item.codigoItem}</span>
                    {item.descricaoItem}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3 text-emerald-500" />
                      <span className={`text-xs font-bold ${
                        dispCx > 0 ? "text-emerald-600" : "text-orange-500"
                      }`}>
                        {dispCx.toLocaleString("pt-BR")} cx
                      </span>
                    </div>
                    {poCx > 0 && (
                      <button
                        onClick={() => setExpandedPO(isPOExpanded ? null : item.codigoItem)}
                        className="flex items-center gap-1 cursor-pointer"
                      >
                        <Ship className="w-3 h-3 text-blue-500" />
                        <span className="text-xs font-bold text-blue-600">
                          +{poCx.toLocaleString("pt-BR")} cx
                        </span>
                      </button>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-purple-600">
                        = {projCx.toLocaleString("pt-BR")} cx
                      </span>
                    </div>
                    {allowReserve && (
                      <span className="ml-auto text-[9px] text-amber-600 font-bold">
                        {reservationSummary[item.codigoItem] > 0 ? `${reservationSummary[item.codigoItem]} res.` : ''}
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
function SellerConfigPanel({ sellerId, sellerName, seller }: { sellerId: number; sellerName: string; seller: any }) {
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

  return (
    <div className="space-y-4">
      {/* Card de Autorização e Senha */}
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

      {/* Card de Produtos Visíveis (ticagem) */}
      <SellerProductsPanel sellerId={sellerId} sellerName={sellerName} />

      {/* Card de PDFs/Catálogos */}
      <SellerCatalogsPanel sellerId={sellerId} sellerName={sellerName} />
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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["madeira", "bambu"]));

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

  const stockItems: SimpleStockItem[] = (stockQuery.data?.items || []) as SimpleStockItem[];
  const madeiraItems = stockItems.filter((item) =>
    item.grupo === "industrializacao" && item.subgrupo === "madeira"
  );
  const bambuItems = stockItems.filter((item) =>
    item.grupo === "importacao_revenda" && item.subgrupo === "bambu"
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
  color: "amber" | "green";
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

  const visibleCatalogs = useMemo(() => {
    if (!catalogsQuery.data || !sellerCatalogsQuery.data) return [];
    const allowedIds = new Set(sellerCatalogsQuery.data);
    return catalogsQuery.data.filter(c => allowedIds.has(c.id));
  }, [catalogsQuery.data, sellerCatalogsQuery.data]);

  const folders = useMemo(() => {
    return Array.from(new Set(visibleCatalogs.map(c => c.folder)));
  }, [visibleCatalogs]);

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
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Nenhum catálogo disponível</h3>
        <p className="text-xs text-slate-400">O gestor ainda não liberou catálogos para você. Entre em contato com seu gestor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Catálogos</h2>
          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
            {visibleCatalogs.length} {visibleCatalogs.length === 1 ? 'arquivo' : 'arquivos'}
          </span>
        </div>
      </div>

      {folders.map(folder => (
        <div key={folder} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 border-b border-slate-100 dark:border-slate-700">
            <FolderOpen className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{folder}</span>
            <span className="text-[10px] text-slate-400">
              ({visibleCatalogs.filter(c => c.folder === folder).length} arquivos)
            </span>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {visibleCatalogs.filter(c => c.folder === folder).map(catalog => (
              <div
                key={catalog.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4.5 h-4.5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{catalog.name}</p>
                  <p className="text-[10px] text-slate-400">PDF • Catálogo de produtos</p>
                </div>
                <a
                  href={catalog.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-medium rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  Abrir PDF
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
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
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
        <div className="text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Nenhum cliente encontrado</p>
          <p className="text-xs text-slate-400 mt-1">
            Não há pedidos de venda registrados para {sellerName}.
          </p>
        </div>
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

      {/* Formulário de Cadastro de Novo Cliente */}
      {showNewClientForm && (
        <NewClientForm
          sellerId={sellerId}
          sellerName={sellerName}
          onClose={() => setShowNewClientForm(false)}
          onSuccess={() => {
            setShowNewClientForm(false);
            refetchManual();
          }}
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
                <ManualClientRow key={mc.id} client={mc} onDeleted={refetchManual} />
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
function NewClientForm({ sellerId, sellerName, onClose, onSuccess }: {
  sellerId: number;
  sellerName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [cnpjCpf, setCnpjCpf] = useState("");
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const createMutation = trpc.sales.createVendorClient.useMutation();

  const handleSave = async () => {
    if (!cnpjCpf.trim() || !razaoSocial.trim()) {
      setError("CNPJ/CPF e Razão Social são obrigatórios.");
      return;
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
      });
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  };

  const segmentoOptions = ["", "DISTRIBUIDORA", "SUPERMERCADO", "ATACADO", "VAREJO", "INDÚSTRIA", "RESTAURANTE", "LOJA", "OUTROS"];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-teal-300 dark:border-teal-600 shadow-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-teal-600" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Cadastrar Novo Cliente</h3>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

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
          <FormInput label="CNPJ/CPF *" value={cnpjCpf} onChange={setCnpjCpf} placeholder="00.000.000/0001-00" />
          <FormInput label="Inscrição Estadual" value={inscricaoEstadual} onChange={setInscricaoEstadual} placeholder="IE" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          <FormInput label="Razão Social *" value={razaoSocial} onChange={setRazaoSocial} placeholder="Nome completo da empresa" />
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
        <div className="grid grid-cols-3 gap-2">
          <FormInput label="CEP" value={cep} onChange={setCep} placeholder="00000-000" />
          <div className="col-span-2">
            <FormInput label="Logradouro" value={logradouro} onChange={setLogradouro} placeholder="Rua/Av" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          <FormInput label="Número" value={numero} onChange={setNumero} placeholder="Nº" />
          <FormInput label="Complemento" value={complemento} onChange={setComplemento} placeholder="Sala, Bloco..." />
          <FormInput label="Bairro" value={bairro} onChange={setBairro} placeholder="Bairro" />
          <FormInput label="Cidade" value={cidade} onChange={setCidade} placeholder="Cidade" />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          <FormInput label="UF" value={uf} onChange={setUf} placeholder="XX" />
          <FormInput label="Telefone 1" value={telefone1} onChange={setTelefone1} placeholder="(00) 00000-0000" />
          <FormInput label="Telefone 2" value={telefone2} onChange={setTelefone2} placeholder="(00) 00000-0000" />
          <FormInput label="Email" value={email} onChange={setEmail} placeholder="email@empresa.com" />
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
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
        >
          {saving ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saving ? "Salvando..." : "Salvar Cliente"}
        </button>
      </div>
    </div>
  );
}

/**
 * Helper input field for the form
 */
function FormInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
    </div>
  );
}

/**
 * Row for manually registered clients
 */
function ManualClientRow({ client, onDeleted }: { client: any; onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = trpc.sales.deleteVendorClient.useMutation();

  const handleDelete = async () => {
    await deleteMutation.mutateAsync({ id: client.id });
    onDeleted();
  };

  const endereco = [client.logradouro, client.numero, client.bairro, client.cidade, client.uf]
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
            {client.nomeFantasia && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">Nome Fantasia:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.nomeFantasia}</span>
              </div>
            )}
            {client.inscricaoEstadual && (
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 font-medium whitespace-nowrap">IE:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.inscricaoEstadual}</span>
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
            {client.observacoes && (
              <div className="flex items-start gap-1.5 sm:col-span-2">
                <span className="text-slate-400 font-medium whitespace-nowrap">Obs:</span>
                <span className="text-slate-600 dark:text-slate-300">{client.observacoes}</span>
              </div>
            )}
          </div>
          {/* Delete button */}
          <div className="mt-3 flex items-center gap-2">
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

function SellerOrdersView({ sellerId, sellerName }: { sellerId: number; sellerName: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [expandedPedido, setExpandedPedido] = useState<string | null>(null);
  const [period, setPeriod] = useState("current");
  const [customMonth, setCustomMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);

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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
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
        <NewOrderInline sellerId={sellerId} sellerName={sellerName} onClose={() => setShowNewOrder(false)} />
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
            {pedidosManuais.slice(0, 10).map((pm: any) => (
              <div key={pm.id} className="px-4 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                      {pm.razaoSocial || pm.nomeFantasia || "Cliente"}
                    </p>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      pm.status === "aprovado" ? "bg-green-50 text-green-600" :
                      pm.status === "pendente" ? "bg-amber-50 text-amber-600" :
                      pm.status === "rejeitado" ? "bg-red-50 text-red-600" :
                      "bg-blue-50 text-blue-600"
                    }`}>
                      {pm.status?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {pm.createdAt ? new Date(pm.createdAt).toLocaleDateString("pt-BR") : ""}
                    {pm.condicaoPagamento && ` · Pgto: ${pm.condicaoPagamento}`}
                  </p>
                </div>
                <p className="text-xs font-bold text-green-700 dark:text-green-400 ml-3">
                  {formatCurrencySales(Number(pm.totalProdutos || 0))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de pedidos Maxiprod */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
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
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${
                    expandedPedido === pedido.pedido ? "rotate-180" : ""
                  }`} />
                </button>

                {/* Detalhes expandidos do pedido */}
                {expandedPedido === pedido.pedido && (
                  <div className="px-4 pb-3 ml-4 border-l-2 border-teal-200 dark:border-teal-800">
                    {pedido.itens && pedido.itens.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Itens do Pedido</p>
                        {pedido.itens.map((item: { descricao: string; estadoItem: string; quantidade: number; valorUnitario: number; valorTotal: number; unidade: string }, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-slate-700 dark:text-slate-200 truncate text-[11px]">
                                {item.descricao}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {item.quantidade} {item.unidade || ""} × {formatCurrencySales(item.valorUnitario)}
                              </p>
                            </div>
                            <div className="text-right ml-2 flex-shrink-0">
                              <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                {formatCurrencySales(item.valorTotal)}
                              </p>
                              {item.estadoItem && (
                                <p className="text-[9px] text-slate-400">{item.estadoItem}</p>
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
    </div>
  );
}

/**
 * NewOrderInline - Formulário inline para criar novo pedido de venda
 * Puxa produtos do estoque visível do vendedor com especificações
 */
function NewOrderInline({ sellerId, sellerName, onClose }: { sellerId: number; sellerName: string; onClose: () => void }) {
  const [step, setStep] = useState<"cliente" | "produtos" | "pagamento" | "revisao">("cliente");
  
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

  // Products
  interface OrderItem {
    codigoItem: string;
    descricaoItem: string;
    quantidade: number;
    unidadeMedida: string;
    precoUnitario: number;
    precoMinimo: number | null;
    grupo: string;
    disponivel: string;
  }
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [reservePO, setReservePO] = useState<{ codigoItem: string; descricaoItem: string; referencia: string; dataEntrega: string; quantidade: number } | null>(null);

  // Payment
  const [condicaoPagamento, setCondicaoPagamento] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [tipoFrete, setTipoFrete] = useState("CIF");
  const [observacoes, setObservacoes] = useState("");

  // Queries
  const clientSearchQuery = trpc.salesOrders.searchClients.useQuery(
    { query: clientSearch },
    { enabled: clientSearch.length >= 1 }
  );
  const productsQuery = trpc.salesOrders.getProductsForSeller.useQuery({ sellerId });
  const createOrderMutation = trpc.salesOrders.createOrder.useMutation();
  const utils = trpc.useUtils();

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
    setTelefone1(client.telefone1 || "");
    setTelefone2(client.telefone2 || "");
    setEmailContato(client.emailContato || "");
    setSegmento(client.segmento || "");
    setShowClientDropdown(false);
    setClientSearch("");
  };

  // Filtered products for selection
  const availableProducts = useMemo(() => {
    if (!productsQuery.data) return [];
    const addedCodes = new Set(items.map(i => i.codigoItem));
    let filtered = productsQuery.data.filter((p: any) => !addedCodes.has(p.codigoItem));
    if (productSearch.trim()) {
      const term = productSearch.trim().toLowerCase();
      filtered = filtered.filter((p: any) =>
        p.codigoItem.toLowerCase().includes(term) ||
        p.descricaoItem.toLowerCase().includes(term) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(term)) ||
        (p.grupo && p.grupo.toLowerCase().includes(term))
      );
    }
    return filtered;
  }, [productsQuery.data, items, productSearch]);

  const addProduct = (product: any) => {
    setItems(prev => [...prev, {
      codigoItem: product.codigoItem,
      descricaoItem: product.descricaoItem,
      quantidade: 1,
      unidadeMedida: product.unidadeMedida || "CX",
      precoUnitario: product.precoMinimo ? Number(product.precoMinimo) : 0,
      precoMinimo: product.precoMinimo ? Number(product.precoMinimo) : null,
      grupo: product.grupo || "",
      disponivel: product.disponivel || "0",
    }]);
    setProductSearch("");
  };

  const removeProduct = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const totalProdutos = items.reduce((sum, item) => sum + item.quantidade * item.precoUnitario, 0);
  const totalPedido = totalProdutos + (Number(valorFrete) || 0);
  const hasPrecoAbaixo = items.some(item => item.precoMinimo !== null && item.precoUnitario < item.precoMinimo);

  const handleSubmit = () => {
    createOrderMutation.mutate({
      sellerId,
      cnpjCpf,
      razaoSocial,
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
      condicaoPagamento: condicaoPagamento || undefined,
      valorFrete: Number(valorFrete) || undefined,
      tipoFrete: tipoFrete || undefined,
      observacoes: observacoes || undefined,
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
          onClose();
        }
      },
    });
  };

  const canProceedCliente = cnpjCpf.length >= 11 && razaoSocial.length >= 2;
  const canProceedProdutos = items.length > 0 && items.every(i => i.quantidade > 0 && i.precoUnitario > 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-teal-300 dark:border-teal-700 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-teal-50 dark:bg-teal-900/30 px-4 py-3 border-b border-teal-200 dark:border-teal-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-teal-600" />
            <h4 className="text-sm font-bold text-teal-800 dark:text-teal-200">Novo Pedido de Venda</h4>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-teal-100 dark:hover:bg-teal-800 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        {/* Progress */}
        <div className="flex gap-1 mt-2">
          {(["cliente", "produtos", "pagamento", "revisao"] as const).map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full ${
                (["cliente", "produtos", "pagamento", "revisao"] as const).indexOf(step) >= i
                  ? "bg-teal-500"
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
                        <span className="text-[10px] text-slate-500 font-mono">{c.cnpjCpf}</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <OrderFormInput label="CNPJ/CPF *" value={cnpjCpf} onChange={setCnpjCpf} placeholder="00.000.000/0000-00" />
              <OrderFormInput label="Razão Social *" value={razaoSocial} onChange={setRazaoSocial} placeholder="Razão social do cliente" />
              <OrderFormInput label="Nome Fantasia" value={nomeFantasia} onChange={setNomeFantasia} placeholder="Nome fantasia" />
              <OrderFormInput label="Inscrição Estadual" value={inscricaoEstadual} onChange={setInscricaoEstadual} placeholder="IE" />
              <OrderFormInput label="CEP" value={cep} onChange={setCep} placeholder="00000-000" />
              <OrderFormInput label="Endereço" value={endereco} onChange={setEndereco} placeholder="Rua/Av" />
              <OrderFormInput label="Número" value={numero} onChange={setNumero} placeholder="Nº" />
              <OrderFormInput label="Bairro" value={bairro} onChange={setBairro} placeholder="Bairro" />
              <OrderFormInput label="Município" value={municipio} onChange={setMunicipio} placeholder="Cidade" />
              <OrderFormInput label="UF" value={uf} onChange={setUf} placeholder="UF" />
              <OrderFormInput label="Telefone 1" value={telefone1} onChange={setTelefone1} placeholder="(00) 00000-0000" />
              <OrderFormInput label="Email" value={emailContato} onChange={setEmailContato} placeholder="email@empresa.com" />
              <OrderFormInput label="Segmento" value={segmento} onChange={setSegmento} placeholder="Indústria, Loja, Distribuidora..." />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep("produtos")}
                
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Próximo: Produtos
              </button>
            </div>
          </div>
        )}

        {step === "produtos" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">2. Produtos do Estoque</p>
              <span className="text-[10px] text-slate-400">{productsQuery.data?.length || 0} produtos disponíveis</span>
            </div>
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
            {/* Available products list - always visible */}
            {availableProducts.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-600 rounded-lg max-h-[420px] overflow-y-auto">
                {availableProducts.map((p: any) => {
                  const fator = Number(p.unidadeDeVendaFator) || 1;
                  const qtdRaw = Number(p.disponivel) || 0;
                  const qtdCaixas = fator > 1 ? Math.floor(qtdRaw / fator) : qtdRaw;
                  const unidadeVenda = p.unidadeDeVendaCodigo || (fator >= 1000 ? "CX" : p.unidadeMedida || "un");
                  // Parse dimensions from descricaoComplementar (format: LxAxC like 45X22X20)
                  const dims = p.descricaoComplementar ? p.descricaoComplementar.match(/([\d,.]+)[xX]([\d,.]+)[xX]([\d,.]+)/) : null;
                  const isExpanded = expandedProduct === p.codigoItem;
                  const hasPOs = p.pendingPOs && p.pendingPOs.length > 0;
                  return (
                    <div key={p.codigoItem} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                      {/* Main product row - clickable to add */}
                      <div className="flex items-stretch">
                        <button
                          onClick={() => addProduct(p)}
                          className="flex-1 text-left px-2 sm:px-3 py-2.5 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors min-w-0"
                        >
                          <p className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 break-words">{p.descricaoItem}</p>
                          <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 mt-1.5">
                            <span className="text-[10px] text-slate-500">Cód: <strong>{p.codigoItem}</strong></span>
                            {p.grupo && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400 font-medium">{p.grupo}</span>}
                            {dims && (
                              <span className="text-[10px] bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded text-orange-700 dark:text-orange-400 font-medium">
                                📐 {dims[1]}×{dims[2]}×{dims[3]} cm
                              </span>
                            )}
                            {p.pesoBruto && Number(p.pesoBruto) > 0 && (
                              <span className="text-[10px] bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded text-purple-700 dark:text-purple-400 font-medium">
                                ⚖️ {(Number(p.pesoBruto) * fator).toFixed(2)} kg/cx
                              </span>
                            )}
                          </div>
                          {/* Availability in caixas + PO projection */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                            <span className={`text-xs font-bold ${qtdCaixas > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              📦 {qtdCaixas.toLocaleString('pt-BR')} {unidadeVenda}
                            </span>
                            {p.precoMinimo && <span className="text-[10px] text-slate-400">Mín: {formatCurrencySales(Number(p.precoMinimo))}</span>}
                            {hasPOs && (
                              <span className="text-[10px] bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded text-green-700 dark:text-green-400 font-medium">
                                🚢 {p.pendingPOs.reduce((sum: number, po: any) => sum + Math.floor(Number(po.quantidade) || 0), 0).toLocaleString('pt-BR')} {unidadeVenda} chegando
                              </span>
                            )}
                          </div>
                        </button>
                        {/* Expand button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedProduct(isExpanded ? null : p.codigoItem); }}
                          className="px-2 flex items-center justify-center border-l border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Ver detalhes completos"
                        >
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-2 sm:px-3 pb-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
                          <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-1.5 pt-2">
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Código</p>
                              <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">{p.codigoItem}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Unidade Medida</p>
                              <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">{p.unidadeMedida || '-'}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Grupo</p>
                              <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">{p.grupo || '-'}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Fator de Venda</p>
                              <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">{fator.toLocaleString('pt-BR')} un/{unidadeVenda}</p>
                            </div>
                            {dims && (
                              <>
                                <div>
                                  <p className="text-[9px] text-slate-400 uppercase font-bold">Largura</p>
                                  <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">{dims[1]} cm</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-slate-400 uppercase font-bold">Altura</p>
                                  <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">{dims[2]} cm</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-slate-400 uppercase font-bold">Comprimento</p>
                                  <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">{dims[3]} cm</p>
                                </div>
                              </>
                            )}
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Peso Bruto (un)</p>
                              <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">{p.pesoBruto ? `${Number(p.pesoBruto).toFixed(5)} kg` : '-'}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Peso por Caixa</p>
                              <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">{p.pesoBruto ? `${(Number(p.pesoBruto) * fator).toFixed(2)} kg` : '-'}</p>
                            </div>
                            {p.codigoBarras && (
                              <div>
                                <p className="text-[9px] text-slate-400 uppercase font-bold">Código de Barras</p>
                                <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">{p.codigoBarras}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Procedência</p>
                              <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">{p.procedencia || '-'}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Estoque Disponível</p>
                              <p className="text-[11px] text-emerald-600 font-bold">{qtdCaixas.toLocaleString('pt-BR')} {unidadeVenda} ({qtdRaw.toLocaleString('pt-BR')} un)</p>
                            </div>
                            {p.precoMinimo && (
                              <div>
                                <p className="text-[9px] text-slate-400 uppercase font-bold">Preço Mínimo</p>
                                <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">{formatCurrencySales(Number(p.precoMinimo))}</p>
                              </div>
                            )}
                          </div>
                          {/* PO Projections */}
                          {hasPOs && (
                            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-600">
                              <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">🚢 Pedidos de Compra (Chegando)</p>
                              {p.pendingPOs.map((po: any, idx: number) => {
                                const poQtd = Math.floor(Number(po.quantidade) || 0);
                                const poDate = po.dataEntrega ? new Date(po.dataEntrega).toLocaleDateString('pt-BR') : 'Sem data';
                                return (
                                  <div key={idx} className="py-2 border-b border-dashed border-slate-200 dark:border-slate-600 last:border-0">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2">
                                      <span className="text-[11px] text-slate-600 dark:text-slate-300">{po.referencia || 'PO'} — <strong className="text-slate-800 dark:text-slate-100">{poQtd.toLocaleString('pt-BR')} {unidadeVenda}</strong></span>
                                      <span className="text-[10px] text-blue-600 font-medium">Previsão: {poDate}</span>
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setReservePO({ codigoItem: p.codigoItem, descricaoItem: p.descricaoItem, referencia: po.referencia || 'PO', dataEntrega: poDate, quantidade: poQtd }); }}
                                      className="mt-1.5 w-full px-2 sm:px-3 py-2 sm:py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-md text-[11px] sm:text-[11px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                                    >
                                      <Bookmark className="w-3 h-3" /> Reservar Caixas desta PO
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
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
            {/* Selected items */}
            {items.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Itens adicionados ({items.length})</p>
                {items.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 sm:p-3 border border-slate-200 dark:border-slate-600">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 break-words leading-tight">{item.descricaoItem}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-400">Cód: {item.codigoItem}</span>
                          {item.grupo && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-600 rounded text-slate-500 dark:text-slate-400">{item.grupo}</span>}

                        </div>
                      </div>
                      <button onClick={() => removeProduct(idx)} className="p-1 hover:bg-red-50 rounded">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-2">
                      <div>
                        <label className="text-[8px] sm:text-[9px] text-slate-400 uppercase">Qtd ({item.unidadeMedida})</label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantidade}
                          onChange={(e) => updateItem(idx, "quantidade", Number(e.target.value))}
                          className="w-full mt-0.5 px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] sm:text-[9px] text-slate-400 uppercase">Preço Unit.</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={item.precoUnitario}
                          onChange={(e) => updateItem(idx, "precoUnitario", Number(e.target.value))}
                          className={`w-full mt-0.5 px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs border rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 ${
                            item.precoMinimo && item.precoUnitario < item.precoMinimo
                              ? "border-red-300 bg-red-50"
                              : "border-slate-200 dark:border-slate-600"
                          }`}
                        />
                        {item.precoMinimo && <p className="text-[8px] sm:text-[9px] text-slate-400 mt-0.5">Mín: {formatCurrencySales(item.precoMinimo)}</p>}
                      </div>
                      <div>
                        <label className="text-[8px] sm:text-[9px] text-slate-400 uppercase">Total</label>
                        <p className="mt-0.5 px-1 sm:px-2 py-1 text-[11px] sm:text-xs font-medium text-green-600">
                          {formatCurrencySales(item.quantidade * item.precoUnitario)}
                        </p>
                      </div>
                    </div>
                    {item.precoMinimo && item.precoUnitario < item.precoMinimo && (
                      <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                        <span>⚠️</span> Preço abaixo do mínimo - pedido precisará de aprovação
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep("cliente")} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
                Voltar
              </button>
              <button
                onClick={() => setStep("pagamento")}
                
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Próximo: Pagamento
              </button>
            </div>
          </div>
        )}

        {step === "pagamento" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">3. Condições de Pagamento</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <OrderFormInput label="Condição de Pagamento" value={condicaoPagamento} onChange={setCondicaoPagamento} placeholder="Ex: 30/60/90 dias" />
              <OrderFormInput label="Valor do Frete (R$)" value={valorFrete} onChange={setValorFrete} placeholder="0,00" type="number" />
              <div>
                <label className="text-[10px] text-slate-500 font-medium">Tipo de Frete</label>
                <select
                  value={tipoFrete}
                  onChange={(e) => setTipoFrete(e.target.value)}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="CIF">CIF (Frete por conta do vendedor)</option>
                  <option value="FOB">FOB (Frete por conta do comprador)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-medium">Observações</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações adicionais do pedido..."
                rows={3}
                className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 resize-none"
              />
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep("produtos")} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
                Voltar
              </button>
              <button
                onClick={() => setStep("revisao")}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Próximo: Revisão
              </button>
            </div>
          </div>
        )}

        {step === "revisao" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">4. Revisão do Pedido</p>
            {/* Summary */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2">
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
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-700 dark:text-slate-200">Total:</span>
                  <span className="text-green-600">{formatCurrencySales(totalPedido)}</span>
                </div>
              </div>
            </div>
            {hasPrecoAbaixo && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  ⚠️ Este pedido contém itens abaixo do preço mínimo e ficará <strong>pendente de aprovação</strong> do gestor.
                </p>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep("pagamento")} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
                Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={createOrderMutation.isPending}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                {createOrderMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Enviar Pedido
              </button>
            </div>
          </div>
        )}
      </div>
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

function OrderFormInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-slate-500 font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
      />
    </div>
  );
}

function SellerSalesView({ sellerName }: { sellerName: string }) {
  const [period, setPeriod] = useState<SalesPeriod>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);

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
 * Mostra: Código, Produto, Preço, Desc.Máx%, Preço Mínimo
 * ============================================================
 */
function TabelaPrecosView({ sellerId, sellerName }: { sellerId: number; sellerName: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const { data, isLoading, error } = trpc.sales.getPriceTableItems.useQuery({ sellerId });
  const syncMutation = trpc.sales.syncPriceTables.useMutation({
    onSuccess: () => {
      // Refetch after sync
      window.location.reload();
    },
  });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!searchTerm) return data.items;
    const term = searchTerm.toLowerCase();
    return data.items.filter((item: any) =>
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
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Tabela de Preços</h3>
            <span className="text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full font-medium">
              {data.items.length} produtos
            </span>
          </div>
          <span className="text-xs text-slate-400">{data.priceTable.descricao}</span>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Código</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Produto</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Preço</th>
              <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Desc. Máx.</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Preço Mínimo</th>
              <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Comissão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredItems.map((item: any) => (
              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-2.5">
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                    {item.itemCodigo}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-xs text-slate-700 dark:text-slate-200 line-clamp-1">
                    {item.itemDescricao}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    R$ {parseFloat(item.preco).toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                    {item.descontoMaximoEmPercentual ? `${parseFloat(item.descontoMaximoEmPercentual)}%` : "—"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    R$ {parseFloat(item.precoMinimo).toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {item.comissaoEmPercentual ? `${parseFloat(item.comissaoEmPercentual)}%` : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with summary */}
      <div className="px-4 md:px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {filteredItems.length === data.items.length
              ? `${data.items.length} produtos na tabela`
              : `${filteredItems.length} de ${data.items.length} produtos`}
          </span>
          <span className="text-[10px] text-slate-400">
            Sincronizado automaticamente do Maxiprod
          </span>
        </div>
      </div>
    </div>
  );
}
