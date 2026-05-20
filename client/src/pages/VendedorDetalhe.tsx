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
} from "lucide-react";

type TabType = "estoque" | "clientes" | "vendas" | "configuracoes";

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

export default function VendedorDetalhe() {
  const params = useParams<{ sellerId: string }>();
  const [, setLocation] = useLocation();
  const sellerId = parseInt(params.sellerId || "0", 10);
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

  const tabs: { id: TabType; label: string; icon: typeof Package }[] = [
    { id: "estoque", label: "Estoque", icon: Package },
    { id: "clientes", label: "Cadastro de Cliente", icon: UserPlus },
    { id: "vendas", label: "Vendas", icon: BarChart3 },
    { id: "configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <TopNav />

      <main className="container py-4 md:py-6 space-y-4 pb-20 md:pb-6">
        {/* Header com botão voltar e info do vendedor */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/gestao-comercial")}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
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
          </div>
        </div>

        {/* Abas de navegação */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
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
          <PlaceholderTab title="Cadastro de Cliente" description="Funcionalidade em desenvolvimento. Em breve você poderá gerenciar os clientes deste vendedor." />
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
      {/* Resumo */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Estoque de {sellerName}
          </h3>
          <span className="text-[10px] text-slate-400 ml-1">
            {visibleProducts.length} produtos
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {visibleProducts.reduce((sum, p) => sum + (p.disponivelCx ?? 0), 0).toLocaleString("pt-BR")}
            </p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium">Disponível (cx)</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
              {visibleProducts.reduce((sum, p) => sum + (p.poCx ?? 0), 0).toLocaleString("pt-BR")}
            </p>
            <p className="text-[10px] text-blue-600 dark:text-blue-500 font-medium">Chegando (POs)</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-purple-700 dark:text-purple-400">
              {visibleProducts.reduce((sum, p) => sum + (p.projetadoCx ?? 0), 0).toLocaleString("pt-BR")}
            </p>
            <p className="text-[10px] text-purple-600 dark:text-purple-500 font-medium">Projetado (cx)</p>
          </div>
        </div>
      </div>

      {/* Madeira */}
      {madeiraProducts.length > 0 && (
        <StockCategorySection
          title="Madeira"
          items={madeiraProducts}
          color="amber"
          sellerName={sellerName}
          sellerId={sellerId}
          onReserve={(item, po) => { setReservationItem(item); setReservationPO(po || null); }}
          reservationSummary={reservationSummary.data || {}}
        />
      )}

      {/* Bambu */}
      {bambuProducts.length > 0 && (
        <StockCategorySection
          title="Bambu"
          items={bambuProducts}
          color="green"
          sellerName={sellerName}
          sellerId={sellerId}
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
  onReserve,
  reservationSummary,
}: {
  title: string;
  items: DashboardItem[];
  color: "amber" | "green";
  sellerName: string;
  sellerId: number;
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
          <div className="hidden md:grid md:grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-700/30 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <div className="col-span-5">Produto</div>
            <div className="col-span-2 text-center">Disponível</div>
            <div className="col-span-2 text-center">PO (chegando)</div>
            <div className="col-span-2 text-center">Projetado</div>
            <div className="col-span-1 text-center">Ação</div>
          </div>

          {items.map((item) => {
            const isPOExpanded = expandedPO === item.codigoItem;
            const dispCx = item.disponivelCx ?? 0;
            const poCx = item.poCx ?? 0;
            const projCx = item.projetadoCx ?? 0;

            return (
              <div key={item.codigoItem}>
                {/* Desktop row */}
                <div className="hidden md:grid md:grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
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
                  <div className="col-span-1 text-center">
                    <button
                      className="p-1.5 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors cursor-pointer"
                      title="Reservar"
                      onClick={() => onReserve(item)}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>
                    {reservationSummary[item.codigoItem] > 0 && (
                      <span className="text-[9px] text-amber-600 font-bold block mt-0.5">
                        {reservationSummary[item.codigoItem]} res.
                      </span>
                    )}
                  </div>
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
                    <button
                      className="ml-auto p-1 rounded text-slate-400 hover:text-teal-600 cursor-pointer"
                      title="Reservar"
                      onClick={() => onReserve(item)}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>
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
                        <div key={idx} className="flex items-center gap-3 text-xs bg-white dark:bg-slate-800 rounded-md px-3 py-2 border border-blue-100 dark:border-blue-900/30">
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
                          <button
                            onClick={() => onReserve(item, {
                              referencia: lote.referenciaPO || lote.numeroPedido,
                              dataEntrega: lote.dataEntrega,
                              quantidade: lote.quantidade,
                            })}
                            className="ml-auto flex items-center gap-1 px-2 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded text-[10px] font-medium hover:bg-teal-100 dark:hover:bg-teal-900/50 cursor-pointer"
                          >
                            <Bookmark className="w-3 h-3" />
                            Reservar
                          </button>
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
