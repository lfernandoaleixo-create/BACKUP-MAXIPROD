/**
 * Gestão Comercial - Reestruturada com duas abas principais:
 * 1. GESTORES - 4 cards (Jordão, Ana Paula, Juvenal, Renato) com painel de configuração
 * 2. VENDEDORES - Visão do vendedor (inclui gestores como vendedores)
 * 
 * Hierarquia:
 * - Jordão Laine (Gestor)
 * - Ana Paula Aleixo (Gestora)
 * - Juvenal Teixeira (Gestor)
 * - Renato Aleixo (Sub-gestor)
 */
import { useState, useMemo, useEffect } from "react";
import TopNav from "@/components/TopNav";
import GestaoMetricasVendedores from "@/components/GestaoMetricasVendedores";
import { trpc } from "@/lib/trpc";
import {
  Users, BarChart3, ClipboardCheck, ShieldCheck, Shield, Settings, ShoppingCart,
  ChevronDown, ChevronRight, Lock, RefreshCw, AlertCircle, Crown,
  Package, Tag, FolderOpen, Target, Eye, UserPlus, ArrowLeft, DollarSign, Calculator, FileText, Check,
  TrendingUp, Pencil, Upload, Plus, Trash2, FolderPlus, Download, X, ArrowRightLeft
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useOperator } from "@/contexts/OperatorContext";

type GestaoView = "gestores" | "vendedores" | "metricas";

// Config categories available for each gestor
type ConfigCategory = "estoque" | "tabela_preco" | "catalogos" | "senha" | "pedidos" | "metricas";

interface GestorGroup {
  gestor: string;
  vendedores: string[];
}

interface SellerPermission {
  id: number;
  sellerName: string;
  gestorName: string;
  password: string;
  authorized: boolean;
  priceTableCode?: string | null;
}

// Define the 4 gestores/sub-gestores with their roles
interface GestorCard {
  name: string;
  role: "Gestor" | "Gestora" | "Sub-gestor";
  parentGestor?: string; // For sub-gestores
}

const GESTOR_CARDS: GestorCard[] = [
  { name: "JORDÃO LAINE", role: "Gestor" },
  { name: "ANA PAULA ALEIXO", role: "Gestora" },
  { name: "JUVENAL TEIXEIRA", role: "Gestor" },
  { name: "RENATO ALEIXO", role: "Sub-gestor", parentGestor: "JUVENAL TEIXEIRA" },
];

// Map gestor names to their Maxiprod group names (may differ in accents/case)
const GESTOR_NAME_MAP: Record<string, string> = {
  "JORDÃO LAINE": "JORDÃO LAINE",
  "ANA PAULA ALEIXO": "ANA PAULA ALEIXO",
  "JUVENAL TEIXEIRA": "JUVENAL TEIXEIRA",
  "RENATO ALEIXO": "RENATO ALEIXO",
};

export default function GestaoComercial() {
  const [view, setView] = useState<GestaoView>("gestores");
  const { operator } = useOperator();
  const [, setLocation] = useLocation();

  const isVitoria = operator?.name === "Vitoria" || operator?.name === "Vitória";

  // Auto-redirect Vitória to her Pedidos page
  useEffect(() => {
    if (isVitoria) {
      setLocation("/gestao-comercial/pedidos-operador");
    }
  }, [isVitoria, setLocation]);

  // Fetch seller list from Maxiprod
  const representantesQuery = trpc.sales.listRepresentantesMaxiprod.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    enabled: !isVitoria,
  });

  const permissionsQuery = trpc.sales.listSellerPermissions.useQuery(undefined, {
    staleTime: 30 * 1000,
    enabled: !isVitoria,
  });

  // Get vendedores for a specific gestor from Maxiprod data
  const getVendedoresForGestor = (gestorName: string): string[] => {
    if (!representantesQuery.data) return [];
    const gestores = representantesQuery.data.gestores as GestorGroup[];
    // Try exact match first
    const grupo = gestores.find(g => g.gestor.toUpperCase() === gestorName.toUpperCase());
    if (grupo) return grupo.vendedores;
    // Try without accents
    const normalized = gestorName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const grupoNorm = gestores.find(g => 
      g.gestor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === normalized
    );
    return grupoNorm?.vendedores || [];
  };

  // Extract all seller names for metrics
  const allSellerNames = useMemo(() => {
    if (!representantesQuery.data) return [];
    const names: string[] = [];
    for (const grupo of representantesQuery.data.gestores) {
      for (const vendedor of (grupo as GestorGroup).vendedores) {
        names.push(vendedor);
      }
    }
    return names;
  }, [representantesQuery.data]);

  // If Vitória, show nothing (redirect will happen)
  if (isVitoria) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <TopNav />

      <main className="container py-4 md:py-6 space-y-4 md:space-y-5 pb-20 md:pb-6">
        {/* Sub-navigation tabs */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-1.5 flex-wrap">
          <button
            onClick={() => setView("gestores")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              view === "gestores"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <Crown className="w-4 h-4" />
            Gestores
          </button>
          <button
            onClick={() => setView("vendedores")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              view === "vendedores"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <Users className="w-4 h-4" />
            Vendedores
          </button>
          <button
            onClick={() => setView("metricas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              view === "metricas"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Métricas
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/gestao-comercial/aprovacoes" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all cursor-pointer">
              <ShieldCheck className="w-3.5 h-3.5" />
              Aprovações
            </Link>
            <Link href="/gestao-comercial/pedidos-operador" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all cursor-pointer">
              <ClipboardCheck className="w-3.5 h-3.5" />
              Pedidos (Vitória)
            </Link>
          </div>
        </div>

        {/* Content */}
        {view === "gestores" && (
          <GestoresTab
            getVendedoresForGestor={getVendedoresForGestor}
            permissions={permissionsQuery.data || []}
            isLoading={representantesQuery.isLoading}
            isError={representantesQuery.isError}
            errorMessage={representantesQuery.error?.message}
            onRefresh={() => {
              representantesQuery.refetch();
              permissionsQuery.refetch();
            }}
            isFetching={representantesQuery.isFetching}
          />
        )}
        {view === "vendedores" && (
          <VendedoresTab
            getVendedoresForGestor={getVendedoresForGestor}
            permissions={permissionsQuery.data || []}
            isLoading={representantesQuery.isLoading}
          />
        )}
        {view === "metricas" && (
          <GestaoMetricasVendedores sellerNames={allSellerNames} />
        )}
      </main>
    </div>
  );
}

// ============================================================
// GESTORES TAB - 4 cards with config panels
// ============================================================
interface GestoresTabProps {
  getVendedoresForGestor: (gestorName: string) => string[];
  permissions: SellerPermission[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRefresh: () => void;
  isFetching: boolean;
}

function GestoresTab({ getVendedoresForGestor, permissions, isLoading, isError, errorMessage, onRefresh, isFetching }: GestoresTabProps) {
  const [expandedGestor, setExpandedGestor] = useState<string | null>(null);
  const [activeConfig, setActiveConfig] = useState<ConfigCategory | null>(null);
  const [, navigate] = useLocation();

  const toggleAuthMutation = trpc.sales.toggleSellerAuthorization.useMutation();
  const utils = trpc.useUtils();

  const handleToggleAuth = (sellerId: number, currentAuth: boolean) => {
    toggleAuthMutation.mutate(
      { sellerId, authorized: !currentAuth },
      { onSuccess: () => { utils.sales.listSellerPermissions.invalidate(); } }
    );
  };

  const getPermission = (sellerName: string, gestorName: string): SellerPermission | undefined => {
    return permissions.find(
      (p) => p.sellerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === sellerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() &&
             p.gestorName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === gestorName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    );
  };

  const getPermissionByName = (sellerName: string): SellerPermission | undefined => {
    return permissions.find(
      (p) => p.sellerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === sellerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    );
  };

  const totalVendedores = useMemo(() => {
    let count = 0;
    for (const gc of GESTOR_CARDS) {
      if (gc.role !== "Sub-gestor") {
        count += getVendedoresForGestor(gc.name).length;
      }
    }
    return count;
  }, [getVendedoresForGestor]);

  const handleExpandGestor = (name: string) => {
    if (expandedGestor === name) {
      setExpandedGestor(null);
      setActiveConfig(null);
    } else {
      setExpandedGestor(name);
      setActiveConfig(null);
    }
  };

  // Get vendedores for a gestor card
  // For Juvenal: includes Renato as one of his vendedores
  // For sub-gestor Renato: no vendedores yet (future)
  // For Ana Paula: no vendedores yet (future)
  const getVendedoresForCard = (card: GestorCard): string[] => {
    if (card.role === "Sub-gestor") return []; // Sub-gestor doesn't have vendedores yet
    const vendedores = getVendedoresForGestor(card.name);
    return vendedores;
  };

  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Painel dos Gestores - Collapsible container */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Panel Header - clickable to expand/collapse */}
        <div
          onClick={() => setPanelOpen(!panelOpen)}
          className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-white">Painel dos Gestores</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {GESTOR_CARDS.filter(g => g.role !== "Sub-gestor").length} gestores · 1 sub-gestor · {totalVendedores} vendedores
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              disabled={isFetching}
              className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              title="Atualizar do Maxiprod"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </button>
            {panelOpen ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </div>
        </div>

        {/* Panel Content - 4 gestor cards inside */}
        {panelOpen && (
          <div className="border-t border-slate-100 dark:border-slate-700 p-4 md:p-5 space-y-3">
            {/* Loading */}
            {isLoading && (
              <div className="p-8 text-center">
                <RefreshCw className="w-6 h-6 text-teal-500 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Buscando representantes do Maxiprod...</p>
              </div>
            )}

            {/* Error */}
            {isError && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 p-4">
                <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Erro ao buscar representantes</p>
                    <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 4 Gestor Cards */}
            {!isLoading && GESTOR_CARDS.map((card) => {
        const isExpanded = expandedGestor === card.name;
        const vendedoresBase = getVendedoresForCard(card);
        // Include the gestor themselves as a vendedor in their own card (except sub-gestores)
        const vendedores = card.role === "Sub-gestor" 
          ? vendedoresBase 
          : [card.name, ...vendedoresBase.filter(v => v.toUpperCase() !== card.name.toUpperCase())];
        const vendedorCount = vendedores.length;
        const isSubGestor = card.role === "Sub-gestor";

        return (
          <div key={card.name} className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden transition-all ${
            isSubGestor 
              ? "border-purple-200 dark:border-purple-800 ml-4 md:ml-6" 
              : "border-slate-200 dark:border-slate-700"
          }`}>
            {/* Card Header - collapsible */}
            <button
              onClick={() => handleExpandGestor(card.name)}
              className="w-full flex items-center justify-between p-4 md:px-6 md:py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="text-slate-400">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${
                  isSubGestor 
                    ? "bg-gradient-to-br from-purple-400 to-purple-600" 
                    : "bg-gradient-to-br from-teal-400 to-teal-600"
                }`}>
                  {card.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-sm md:text-base font-bold text-slate-800 dark:text-white">{card.name}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                      isSubGestor
                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                        : "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400"
                    }`}>
                      {card.role.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {vendedorCount} vendedor{vendedorCount !== 1 ? "es" : ""}
                    {isSubGestor && card.parentGestor && ` · subordinado a ${card.parentGestor}`}
                  </p>
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                isSubGestor
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                  : "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400"
              }`}>
                {vendedorCount}
              </span>
            </button>

            {/* Expanded: Configuration Panel */}
            {isExpanded && (
              <div className="border-t border-slate-100 dark:border-slate-700">
                {/* Config buttons */}
                {!activeConfig && (
                  <div className="p-4 md:p-6">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">Configurações dos vendedores:</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <button
                        onClick={() => setActiveConfig("estoque")}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 hover:border-teal-300 hover:bg-teal-50 dark:hover:border-teal-600 dark:hover:bg-teal-900/20 transition-all cursor-pointer"
                      >
                        <Package className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Estoque</span>
                      </button>
                      <button
                        onClick={() => setActiveConfig("tabela_preco")}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 hover:border-teal-300 hover:bg-teal-50 dark:hover:border-teal-600 dark:hover:bg-teal-900/20 transition-all cursor-pointer"
                      >
                        <Tag className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Tabela de Preço</span>
                      </button>
                      <button
                        onClick={() => setActiveConfig("catalogos")}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 hover:border-teal-300 hover:bg-teal-50 dark:hover:border-teal-600 dark:hover:bg-teal-900/20 transition-all cursor-pointer"
                      >
                        <FolderOpen className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Documentos</span>
                      </button>
                      <button
                        onClick={() => setActiveConfig("senha")}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 hover:border-teal-300 hover:bg-teal-50 dark:hover:border-teal-600 dark:hover:bg-teal-900/20 transition-all cursor-pointer"
                      >
                        <Lock className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Senhas</span>
                      </button>
                      <button
                        onClick={() => setActiveConfig("pedidos")}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 hover:border-teal-300 hover:bg-teal-50 dark:hover:border-teal-600 dark:hover:bg-teal-900/20 transition-all cursor-pointer"
                      >
                        <ShoppingCart className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Pedidos de Venda</span>
                      </button>
                      <button
                        onClick={() => setActiveConfig("metricas")}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 hover:border-teal-300 hover:bg-teal-50 dark:hover:border-teal-600 dark:hover:bg-teal-900/20 transition-all cursor-pointer"
                      >
                        <BarChart3 className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Métricas de Venda</span>
                      </button>
                      <button
                        onClick={() => { /* TODO: open cadastrar vendedor modal */ }}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed border-teal-300 dark:border-teal-600 bg-teal-50/50 dark:bg-teal-900/10 hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all cursor-pointer"
                      >
                        <UserPlus className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                        <span className="text-xs font-medium text-teal-700 dark:text-teal-300">Cadastrar Vendedor</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Active config: show vendedores list for individual configuration */}
                {activeConfig && (
                  <div className="p-4 md:p-6">
                    {/* Back button */}
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        onClick={() => setActiveConfig(null)}
                        className="flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-medium cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Voltar
                      </button>
                      <span className="text-xs text-slate-300 dark:text-slate-600">|</span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {activeConfig === "estoque" && "Configurar Estoque"}
                        {activeConfig === "tabela_preco" && "Configurar Tabela de Preço"}
                        {activeConfig === "catalogos" && "Documentos/Catálogos"}
                        {activeConfig === "senha" && "Configurar Senhas"}
                        {activeConfig === "pedidos" && "Pedidos de Venda"}
                        {activeConfig === "metricas" && "Métricas de Venda"}
                      </span>
                    </div>

                    {/* Conditional content based on activeConfig */}
                    {activeConfig === "estoque" ? (
                      <EstoqueMatrixView gestorName={card.name} />
                    ) : activeConfig === "tabela_preco" ? (
                      <PriceMatrixView gestorName={card.name} />
                    ) : activeConfig === "catalogos" ? (
                      <CatalogMatrixView gestorName={card.name} />
                    ) : activeConfig === "senha" ? (
                      <PasswordManagerView gestorName={card.name} />
                    ) : (
                      <div className="space-y-2">
                        {vendedores.length === 0 && (
                          <div className="text-center py-6">
                            <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum vendedor cadastrado</p>
                          </div>
                        )}
                        {vendedores.map((vendedor) => {
                          const perm = getPermission(vendedor, card.name) || getPermissionByName(vendedor);
                          const tabMap: Record<string, { tab: string; section?: string }> = {
                            tabela_preco: { tab: "tabela_precos" },
                            catalogos: { tab: "configuracoes", section: "catalogos" },
                            senha: { tab: "configuracoes", section: "senha" },
                            pedidos: { tab: "pedidos" },
                            metricas: { tab: "vendas" },
                          };
                          const target = activeConfig ? tabMap[activeConfig] || { tab: "estoque" } : { tab: "estoque" };
                          const navUrl = target.section
                            ? `/gestao-comercial/vendedor/${perm?.id}?tab=${target.tab}&section=${target.section}`
                            : `/gestao-comercial/vendedor/${perm?.id}?tab=${target.tab}`;
                          return (
                            <div
                              key={vendedor}
                              onClick={() => { if (perm) navigate(navUrl); }}
                              className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700 hover:border-teal-200 dark:hover:border-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-900/10 transition-all cursor-pointer"
                            >
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-bold text-[10px]">
                                {vendedor.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{vendedor}</p>
                

                              </div>
                              <div className="flex items-center gap-2">
                                {perm && (
                                  <span className={`w-2 h-2 rounded-full ${perm.authorized ? "bg-emerald-500" : "bg-red-400"}`} />
                                )}
                                <Settings className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                              </div>
                            </div>
                          );
                        })}
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
      </div>
    </div>
  );
}

// ============================================================
// VENDEDORES TAB - Visão do vendedor (inclui gestores como vendedores)
// ============================================================
interface VendedoresTabProps {
  getVendedoresForGestor: (gestorName: string) => string[];
  permissions: SellerPermission[];
  isLoading: boolean;
}

function VendedoresTab({ getVendedoresForGestor, permissions, isLoading }: VendedoresTabProps) {
  const [, navigate] = useLocation();

  // Build list of ALL vendedores including gestores themselves
  const allVendedores = useMemo(() => {
    const result: { name: string; gestor: string; permission?: SellerPermission; isGestor: boolean }[] = [];
    
    // Add gestores as vendedores (they sell too)
    for (const gc of GESTOR_CARDS) {
      const perm = permissions.find(
        p => p.sellerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === gc.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
      );
      result.push({ 
        name: gc.name, 
        gestor: gc.parentGestor || "—", 
        permission: perm, 
        isGestor: true 
      });
    }

    // Add regular vendedores
    for (const gc of GESTOR_CARDS) {
      if (gc.role === "Sub-gestor") continue; // Sub-gestor doesn't have vendedores yet
      const vendedores = getVendedoresForGestor(gc.name);
      for (const v of vendedores) {
        // Skip if already added as gestor
        if (GESTOR_CARDS.some(g => g.name.toUpperCase() === v.toUpperCase())) continue;
        const perm = permissions.find(
          p => p.sellerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
        );
        result.push({ name: v, gestor: gc.name, permission: perm, isGestor: false });
      }
    }

    return result.sort((a, b) => {
      // Gestores first, then alphabetical
      if (a.isGestor && !b.isGestor) return -1;
      if (!a.isGestor && b.isGestor) return 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [getVendedoresForGestor, permissions]);

  const authorizedCount = allVendedores.filter(v => v.permission?.authorized).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-white">Vendedores</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {authorizedCount} autorizados de {allVendedores.length} · Clique para ver o app do vendedor
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
        <div className="flex items-start gap-3">
          <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Visão do Vendedor</p>
            <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
              Cada vendedor tem acesso a: Estoque, Cadastro de Clientes, Tabela de Preço, Pedidos de Venda, Métricas e Catálogos.
              Clique em um vendedor para ver exatamente o que ele vê no app.
            </p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
          <RefreshCw className="w-6 h-6 text-orange-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Carregando vendedores...</p>
        </div>
      )}

      {/* Vendedores Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {allVendedores.map((v) => (
            <div
              key={v.name}
              onClick={() => { if (v.permission) navigate(`/gestao-comercial/vendedor/${v.permission.id}`); }}
              className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm p-4 transition-all cursor-pointer hover:shadow-md hover:border-teal-300 dark:hover:border-teal-600 ${
                v.isGestor
                  ? "border-teal-200 dark:border-teal-800"
                  : v.permission?.authorized
                    ? "border-slate-200 dark:border-slate-700"
                    : "border-red-200 dark:border-red-800 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  v.isGestor
                    ? "bg-gradient-to-br from-teal-400 to-teal-600"
                    : v.permission?.authorized
                      ? "bg-gradient-to-br from-orange-300 to-orange-500"
                      : "bg-gradient-to-br from-slate-300 to-slate-400"
                }`}>
                  {v.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{v.name}</p>
                    {v.isGestor && (
                      <Crown className="w-3 h-3 text-teal-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {v.isGestor ? "Gestor · também vende" : `Gestor: ${v.gestor}`}
                  </p>
                </div>
                {v.permission?.authorized ? (
                  <div className="w-2 h-2 rounded-full bg-emerald-500" title="Autorizado" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-red-400" title="Bloqueado" />
                )}
              </div>
              {/* Quick access icons */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-1"><Package className="w-3 h-3" /> Estoque</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-1"><UserPlus className="w-3 h-3" /> Clientes</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-1"><Tag className="w-3 h-3" /> Preços</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-1"><FolderOpen className="w-3 h-3" /> Catálogos</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ============================================================
// ESTOQUE MATRIX VIEW - 2 cards: Bambu (azul) e Madeira (marrom)
// ============================================================
function EstoqueMatrixView({ gestorName }: { gestorName: string }) {
  const [search, setSearch] = useState("");
  const matrixQuery = trpc.sales.getEstoqueMatrix.useQuery(
    { gestorName },
    { staleTime: 60 * 1000 }
  );
  const toggleMutation = trpc.sales.toggleSellerProduct.useMutation();
  const utils = trpc.useUtils();

  const handleToggle = (sellerId: number, productCode: string, currentValue: boolean) => {
    toggleMutation.mutate(
      { sellerId, productCode, visible: !currentValue },
      { onSuccess: () => utils.sales.getEstoqueMatrix.invalidate() }
    );
  };

  if (matrixQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 text-teal-500 animate-spin mr-2" />
        <span className="text-sm text-slate-500 dark:text-slate-400">Carregando matriz de estoque...</span>
      </div>
    );
  }

  if (matrixQuery.isError) {
    return (
      <div className="flex items-center justify-center py-12">
        <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
        <span className="text-sm text-red-500">Erro ao carregar dados</span>
      </div>
    );
  }

    const { sellers, products } = matrixQuery.data || { sellers: [], products: [] };
  // Separate products: Bambu (estoque + sob encomenda) and Madeira Produto Acabado
  const bambuProducts = products.filter(p => p.segmento === "bambu");
  const madeiraProducts = products.filter(p => p.segmento === "madeira");

  // Filter by search
  const filterProducts = (list: typeof products) => {
    if (!search.trim()) return list;
    return list.filter(p =>
      p.descricaoItem.toLowerCase().includes(search.toLowerCase()) ||
      p.codigoItem.toLowerCase().includes(search.toLowerCase())
    );
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {bambuProducts.length} bambu · {madeiraProducts.length} madeira · {sellers.length} vendedores
        </p>
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-3 py-1.5 pl-7 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 w-52 focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
          <Package className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* BAMBU Card */}
      <EstoqueSegmentCard
        title="Bambu"
        color="blue"
        products={filterProducts(bambuProducts)}
        sellers={sellers}
        allProducts={bambuProducts}
        onToggle={handleToggle}
      />
      {/* MADEIRA PRODUTO ACABADO Card */}
      <EstoqueSegmentCard
        title="Madeira"
        color="amber"
        products={filterProducts(madeiraProducts)}
        sellers={sellers}
        allProducts={madeiraProducts}
        onToggle={handleToggle}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <input type="checkbox" checked readOnly className="w-3 h-3 accent-emerald-600" /> Na tabela de preços (Maxiprod) ou adicionado manualmente
        </span>
        <span className="flex items-center gap-1">
          <input type="checkbox" readOnly className="w-3 h-3" /> Produto não disponível (clique para adicionar)
        </span>
      </div>
    </div>
  );
}

// ============================================================
// ESTOQUE SEGMENT CARD - Card individual para Bambu ou Madeira
// ============================================================
interface EstoqueSegmentCardProps {
  title: string;
  color: "blue" | "amber" | "yellow";
  products: { codigoItem: string; descricaoItem: string; segmento: string; sellers: Record<string, boolean> }[];
  sellers: { id: number; name: string; hasTable: boolean }[];
  allProducts: { codigoItem: string; descricaoItem: string; segmento: string; sellers: Record<string, boolean> }[];
  onToggle: (sellerId: number, productCode: string, currentValue: boolean) => void;
}

function EstoqueSegmentCard({ title, color, products, sellers, allProducts, onToggle }: EstoqueSegmentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const colorMap = {
    blue: {
      border: "border-blue-200 dark:border-blue-800",
      header: "bg-blue-50 dark:bg-blue-900/30",
      headerText: "text-blue-800 dark:text-blue-200",
      badge: "bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300",
      accent: "text-blue-600 dark:text-blue-400",
    },
    yellow: {
      border: "border-yellow-200 dark:border-yellow-700",
      header: "bg-yellow-50 dark:bg-yellow-900/30",
      headerText: "text-yellow-800 dark:text-yellow-200",
      badge: "bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300",
      accent: "text-yellow-600 dark:text-yellow-400",
    },
    amber: {
      border: "border-amber-200 dark:border-amber-800",
      header: "bg-amber-50 dark:bg-amber-900/30",
      headerText: "text-amber-800 dark:text-amber-200",
      badge: "bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300",
      accent: "text-amber-600 dark:text-amber-400",
    },
  };
  const colorClasses = colorMap[color];

  // Count products per seller for this segment
  const sellerCounts = sellers.map(s => {
    const count = allProducts.filter(p => p.sellers[s.name]).length;
    return { ...s, count };
  });

  return (
    <div className={`rounded-xl border-2 ${colorClasses.border} overflow-hidden`}>
      {/* Card header */}
      <div
        className={`${colorClasses.header} px-4 py-3 flex items-center justify-between cursor-pointer`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Package className={`w-5 h-5 ${colorClasses.accent}`} />
          <h3 className={`text-sm font-bold ${colorClasses.headerText}`}>{title}</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colorClasses.badge}`}>
            {allProducts.length} produtos
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 ${colorClasses.accent} transition-transform ${expanded ? "" : "-rotate-90"}`} />
      </div>

      {/* Card body */}
      {expanded && (
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-700 z-30">
                  Produto
                </th>
                {sellerCounts.map(seller => (
                  <th
                    key={seller.id}
                    className="text-center px-3 py-3 min-w-[90px] bg-slate-50 dark:bg-slate-700"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {seller.name.split(" ")[0]}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${seller.hasTable ? colorClasses.badge : "bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400"}`}>
                        {seller.count}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((product, idx) => (
                <tr
                  key={product.codigoItem}
                  className={`border-t border-slate-100 dark:border-slate-700/50 ${idx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/30 dark:bg-slate-800/50"} hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors`}
                >
                  <td className="px-4 py-2.5 sticky left-0 bg-inherit z-10">
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 w-12 shrink-0 pt-0.5">{product.codigoItem}</span>
                      <span className="text-[11px] text-slate-700 dark:text-slate-200 leading-tight">
                        {product.descricaoItem}
                      </span>
                    </div>
                  </td>
                  {sellers.map(seller => (
                    <td key={seller.id} className="text-center px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={product.sellers[seller.name] || false}
                        onChange={() => onToggle(seller.id, product.codigoItem, product.sellers[seller.name] || false)}
                        className={`w-4 h-4 rounded cursor-pointer ${color === "blue" ? "accent-blue-600" : color === "yellow" ? "accent-yellow-600" : "accent-amber-600"}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={sellers.length + 1} className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
                    Nenhum produto encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ============================================================
// PRICE MATRIX VIEW - Tabela de preços por vendedor (gestor)
// ============================================================
function PriceMatrixView({ gestorName }: { gestorName: string }) {
  const [search, setSearch] = useState("");
  const [showMinPrice, setShowMinPrice] = useState(false);
    const [customDiscount, setCustomDiscount] = useState<string>("");
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [margemNegociacao, setMargemNegociacao] = useState<string>("");
  const [editingMargem, setEditingMargem] = useState(false);
  const matrixQuery = trpc.sales.getPriceMatrix.useQuery({ gestorName });
  const discountQuery = trpc.sales.getMaxDiscount.useQuery({ gestorName });
  const margemQuery = trpc.sales.getMargemNegociacao.useQuery({ gestorName });
  const saveDiscountMutation = trpc.sales.saveMaxDiscount.useMutation();
  const saveMargemMutation = trpc.sales.saveMargemNegociacao.useMutation();

  // Load saved discount from DB
  useEffect(() => {
    if (discountQuery.data?.discount && !customDiscount) {
      setCustomDiscount(discountQuery.data.discount);
    }
  }, [discountQuery.data]);
  // Load saved margem from DB
  useEffect(() => {
    if (margemQuery.data?.margem && !margemNegociacao) {
      setMargemNegociacao(margemQuery.data.margem);
    }
  }, [margemQuery.data]);

  if (matrixQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-teal-500" />
        <span className="ml-2 text-sm text-slate-500">Carregando tabela de preços...</span>
      </div>
    );
  }
  if (matrixQuery.error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-500">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span className="text-sm">Erro ao carregar tabela de preços</span>
      </div>
    );
  }

  const { sellers, products } = matrixQuery.data || { sellers: [], products: [] };
  const bambuProducts = products.filter(p => p.segmento === "bambu");
  const madeiraProducts = products.filter(p => p.segmento === "madeira");

  const filterProducts = (list: typeof products) => {
    if (!search.trim()) return list;
    return list.filter(p =>
      p.descricaoItem.toLowerCase().includes(search.toLowerCase()) ||
      p.codigoItem.toLowerCase().includes(search.toLowerCase())
    );
  };

  const formatPrice = (preco: string | null, descontoMax: string | null) => {
    if (!preco) return null;
    const price = parseFloat(preco);
    if (showMinPrice) {
      const discount = customDiscount ? parseFloat(customDiscount) : (descontoMax ? parseFloat(descontoMax) : 0);
      const minPrice = price * (1 - discount / 100);
      return minPrice;
    }
    return price;
  };

  return (
    <div className="space-y-4">
      {/* Margem de Negociação card */}
      <div className="rounded-xl border-2 border-teal-200 dark:border-teal-700 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-800 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-300" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-teal-800 dark:text-teal-200">Margem de Negociação</h4>
              <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Preço vendedor = Preço tabela ÷ (1 - margem%)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editingMargem ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="99"
                  step="0.5"
                  value={margemNegociacao}
                  onChange={(e) => setMargemNegociacao(e.target.value)}
                  placeholder="30"
                  className="w-20 text-sm px-3 py-1.5 rounded-lg border border-teal-300 dark:border-teal-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
                  autoFocus
                />
                <span className="text-sm font-bold text-teal-700 dark:text-teal-300">%</span>
                <button
                  onClick={() => {
                    setEditingMargem(false);
                    if (margemNegociacao) {
                      saveMargemMutation.mutate({ gestorName, margem: margemNegociacao });
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditingMargem(false)}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingMargem(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-100 dark:bg-teal-800 text-teal-700 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-700 transition-colors border border-teal-200 dark:border-teal-600"
              >
                <span className="text-lg font-bold">{margemNegociacao ? `${margemNegociacao}%` : "Definir"}</span>
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {bambuProducts.length} bambu · {madeiraProducts.length} madeira · {sellers.length} vendedores
        </p>
        <div className="flex items-center gap-2">
          {/* Discount button */}
          <div className="flex items-center gap-1">
            {editingDiscount ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={customDiscount}
                  onChange={(e) => setCustomDiscount(e.target.value)}
                  placeholder="15"
                  className="w-16 text-xs px-2 py-1 rounded border border-amber-300 dark:border-amber-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <span className="text-xs text-slate-500">%</span>
                <button
                  onClick={() => {
                    setEditingDiscount(false);
                    if (customDiscount) {
                      saveDiscountMutation.mutate({ gestorName, discount: customDiscount });
                    }
                  }}
                  className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-700"
                >
                  OK
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingDiscount(true)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/50 transition-colors"
              >
                <Tag className="w-3 h-3" />
                Desconto Máximo{customDiscount ? `: ${customDiscount}%` : ""}
              </button>
            )}
          </div>
          {/* Convert button */}
          <button
            onClick={() => setShowMinPrice(!showMinPrice)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              showMinPrice
                ? "border-emerald-300 dark:border-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
            }`}
          >
            <Calculator className="w-3 h-3" />
            {showMinPrice ? "Preço Mínimo" : "Converter"}
          </button>
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs px-3 py-1.5 pl-7 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 w-44 focus:outline-none focus:ring-1 focus:ring-teal-400"
            />
            <Package className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* BAMBU Card */}
      <PriceSegmentCard
        title="Bambu"
        color="blue"
        products={filterProducts(bambuProducts)}
        sellers={sellers}
        allProducts={bambuProducts}
        showMinPrice={showMinPrice}
        customDiscount={customDiscount}
        formatPrice={formatPrice}
      />
      {/* MADEIRA Card */}
      <PriceSegmentCard
        title="Madeira"
        color="amber"
        products={filterProducts(madeiraProducts)}
        sellers={sellers}
        allProducts={madeiraProducts}
        showMinPrice={showMinPrice}
        customDiscount={customDiscount}
        formatPrice={formatPrice}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-emerald-500" /> Preço da tabela de preços do vendedor (Maxiprod)
        </span>
        <span className="flex items-center gap-1">
          <span className="text-slate-300">—</span> Produto não disponível para este vendedor
        </span>
      </div>
    </div>
  );
}

// ============================================================
// PRICE SEGMENT CARD - Card individual para Bambu ou Madeira (preços)
// ============================================================
interface PriceSegmentCardProps {
  title: string;
  color: "blue" | "amber";
  products: { codigoItem: string; descricaoItem: string; segmento: string; sellers: Record<string, { preco: string | null; descontoMax: string | null }> }[];
  sellers: { id: number; name: string; hasTable: boolean }[];
  allProducts: { codigoItem: string; descricaoItem: string; segmento: string; sellers: Record<string, { preco: string | null; descontoMax: string | null }> }[];
  showMinPrice: boolean;
  customDiscount: string;
  formatPrice: (preco: string | null, descontoMax: string | null) => number | null;
}

function PriceSegmentCard({ title, color, products, sellers, allProducts, showMinPrice, customDiscount, formatPrice }: PriceSegmentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const colorMap = {
    blue: {
      border: "border-blue-200 dark:border-blue-800",
      header: "bg-blue-50 dark:bg-blue-900/30",
      headerText: "text-blue-800 dark:text-blue-200",
      badge: "bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300",
      accent: "text-blue-600 dark:text-blue-400",
    },
    amber: {
      border: "border-amber-200 dark:border-amber-800",
      header: "bg-amber-50 dark:bg-amber-900/30",
      headerText: "text-amber-800 dark:text-amber-200",
      badge: "bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300",
      accent: "text-amber-600 dark:text-amber-400",
    },
  };
  const colorClasses = colorMap[color];

  return (
    <div className={`border rounded-xl overflow-hidden ${colorClasses.border}`}>
      {/* Header - clickable to expand/collapse */}
      <div
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center justify-between px-4 py-3 cursor-pointer ${colorClasses.header}`}
      >
        <div className="flex items-center gap-3">
          <DollarSign className={`w-5 h-5 ${colorClasses.accent}`} />
          <h3 className={`text-sm font-bold ${colorClasses.headerText}`}>{title}</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colorClasses.badge}`}>
            {allProducts.length} produtos
          </span>
        </div>
        <ChevronRight className={`w-4 h-4 ${colorClasses.accent} transition-transform ${expanded ? "rotate-90" : ""}`} />
      </div>

      {/* Table content */}
      {expanded && (
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-20">
              <tr className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-800 min-w-[250px] z-30">
                  Produto
                </th>
                {sellers.map(seller => (
                  <th key={seller.id} className="text-center px-2 py-2 min-w-[80px] bg-white dark:bg-slate-800">
                    <span className="font-bold text-[11px] text-slate-800 dark:text-slate-100 uppercase">
                      {seller.name.split(" ")[0]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.codigoItem} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                  <td className="px-3 py-2 sticky left-0 bg-white dark:bg-slate-800">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono whitespace-nowrap">
                        {product.codigoItem}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200 leading-tight">
                        {product.descricaoItem}
                      </span>
                    </div>
                  </td>
                  {sellers.map(seller => {
                    const cellData = product.sellers[seller.name];
                    const price = cellData ? formatPrice(cellData.preco, cellData.descontoMax) : null;
                    return (
                      <td key={seller.id} className="text-center px-2 py-2">
                        {price !== null ? (
                          <span className={`text-[11px] font-bold ${showMinPrice ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100"}`}>
                            R$ {price.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={sellers.length + 1} className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
                    Nenhum produto encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ============================================================
// CATALOG MATRIX VIEW - Gerenciamento de Arquivos (gestor)
// ============================================================
function CatalogMatrixView({ gestorName }: { gestorName: string }) {
  const [currentParentId, setCurrentParentId] = useState<number | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [movingFileId, setMovingFileId] = useState<number | null>(null);
  const [movingFileName, setMovingFileName] = useState("");

  const matrixQuery = trpc.sales.getCatalogMatrix.useQuery({ gestorName, parentId: currentParentId });
  const foldersQuery = trpc.sales.getCatalogFolders.useQuery(undefined, { enabled: movingFileId !== null });
  const toggleMutation = trpc.sales.toggleCatalogVisibility.useMutation({
    onSuccess: () => matrixQuery.refetch(),
  });
  const createFolderMutation = trpc.sales.createCatalogFolder.useMutation({
    onSuccess: () => {
      matrixQuery.refetch();
      setShowNewFolderDialog(false);
      setNewFolderName("");
    },
  });
  const uploadFileMutation = trpc.sales.uploadCatalogFile.useMutation({
    onSuccess: () => {
      matrixQuery.refetch();
      setUploading(false);
    },
    onError: () => setUploading(false),
  });
  const deleteMutation = trpc.sales.deleteCatalogItem.useMutation({
    onSuccess: () => matrixQuery.refetch(),
  });
  const moveMutation = trpc.sales.moveCatalogItem.useMutation({
    onSuccess: () => {
      matrixQuery.refetch();
      setMovingFileId(null);
      setMovingFileName("");
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadFileMutation.mutate({
          name: file.name,
          parentId: currentParentId,
          fileData: base64,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        });
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    e.target.value = "";
  };

  if (matrixQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-teal-500" />
        <span className="ml-2 text-sm text-slate-500">Carregando arquivos...</span>
      </div>
    );
  }
  if (matrixQuery.error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-500">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span className="text-sm">Erro ao carregar arquivos</span>
      </div>
    );
  }

  const { sellers, folders, files, currentFolder } = matrixQuery.data || { sellers: [], folders: [], files: [], currentFolder: null };
  const totalItems = folders.length + files.length;

  return (
    <div className="space-y-4">
      {/* Breadcrumb / Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {currentParentId !== null && (
            <button
              onClick={() => setCurrentParentId(null)}
              className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </button>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {currentFolder ? `📁 ${currentFolder.name}` : "Raiz"} — {totalItems} {totalItems === 1 ? "item" : "itens"} · {sellers.length} vendedores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewFolderDialog(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/40 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Nova Pasta
          </button>
          <label className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-800/40 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "Enviando..." : "Upload"}
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20">
          <FolderPlus className="w-4 h-4 text-purple-500" />
          <input
            type="text"
            placeholder="Nome da pasta..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim()) {
                createFolderMutation.mutate({ name: newFolderName.trim(), parentId: currentParentId });
              }
            }}
            className="flex-1 text-sm px-2 py-1 rounded border border-purple-300 dark:border-purple-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
            autoFocus
          />
          <button
            onClick={() => {
              if (newFolderName.trim()) {
                createFolderMutation.mutate({ name: newFolderName.trim(), parentId: currentParentId });
              }
            }}
            disabled={!newFolderName.trim()}
            className="px-3 py-1 text-xs font-medium rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            Criar
          </button>
          <button
            onClick={() => { setShowNewFolderDialog(false); setNewFolderName(""); }}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Folders */}
      {folders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {folders.map(folder => (
            <div
              key={folder.id}
              className="group relative flex items-center gap-2 p-3 rounded-lg border border-purple-200 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/20 cursor-pointer transition-colors"
              onClick={() => setCurrentParentId(folder.id)}
            >
              <FolderOpen className="w-5 h-5 text-purple-500 dark:text-purple-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-purple-800 dark:text-purple-200 truncate">{folder.name}</p>
                <p className="text-[10px] text-purple-500 dark:text-purple-400">{folder.itemCount} {folder.itemCount === 1 ? "item" : "itens"}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: folder.id }); }}
                className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                title="Excluir pasta"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Files with visibility matrix */}
      {files.length > 0 && (
        <div className="rounded-xl border-2 border-purple-200 dark:border-purple-800 overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-20">
                <tr className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-800 min-w-[250px] z-30">
                    Arquivo
                  </th>
                  {sellers.map(seller => (
                    <th key={seller.id} className="text-center px-3 py-3 min-w-[90px] bg-white dark:bg-slate-800">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 uppercase whitespace-nowrap">
                        {seller.name.split(" ")[0]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((file, idx) => (
                  <tr
                    key={file.id}
                    className={`border-t border-slate-100 dark:border-slate-700/50 ${idx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/30 dark:bg-slate-800/50"} hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors`}
                  >
                    <td className="px-4 py-3 sticky left-0 bg-inherit z-10">
                      <div className="flex items-center gap-2 group">
                        <FileText className="w-3.5 h-3.5 text-purple-400 dark:text-purple-500 flex-shrink-0" />
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-700 dark:text-slate-200 leading-tight text-[11px] hover:text-purple-600 dark:hover:text-purple-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {file.name}
                        </a>
                        {file.fileSize && (
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                            {file.fileSize < 1024 ? `${file.fileSize}B` : file.fileSize < 1048576 ? `${(file.fileSize / 1024).toFixed(0)}KB` : `${(file.fileSize / 1048576).toFixed(1)}MB`}
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setMovingFileId(file.id); setMovingFileName(file.name); }}
                          className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-600 transition-all"
                          title="Mover para pasta"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: file.id }); }}
                          className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                          title="Excluir arquivo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    {sellers.map(seller => {
                      const vis = file.visibility.find(v => v.sellerId === seller.id);
                      const isVisible = vis?.visible || false;
                      return (
                        <td key={seller.id} className="text-center px-3 py-3">
                          <button
                            onClick={() => toggleMutation.mutate({ sellerId: seller.id, catalogId: file.id, visible: !isVisible })}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all mx-auto ${
                              isVisible
                                ? "border-teal-400 dark:border-teal-500 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-800/40"
                                : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-teal-300 dark:hover:border-teal-600 hover:bg-teal-50/50 dark:hover:bg-teal-900/20"
                            }`}
                          >
                            {isVisible && <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalItems === 0 && (
        <div className="text-center py-8">
          <FolderOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {currentParentId ? "Pasta vazia" : "Nenhum arquivo ou pasta"}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Use os botões acima para criar pastas ou fazer upload de arquivos
          </p>
        </div>
      )}

      {/* Move Dialog */}
      {movingFileId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setMovingFileId(null); setMovingFileName(""); }}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-5 w-80 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Mover Arquivo</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 truncate">Movendo: <span className="font-medium text-slate-700 dark:text-slate-200">{movingFileName}</span></p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              <button
                onClick={() => moveMutation.mutate({ id: movingFileId, targetFolderId: null })}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  currentParentId === null ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed" : "hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-200"
                }`}
                disabled={currentParentId === null}
              >
                📁 Raiz (fora de qualquer pasta)
              </button>
              {foldersQuery.data?.filter(f => f.id !== movingFileId).map(folder => (
                <button
                  key={folder.id}
                  onClick={() => moveMutation.mutate({ id: movingFileId, targetFolderId: folder.id })}
                  disabled={folder.id === currentParentId}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    folder.id === currentParentId ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed" : "hover:bg-purple-50 dark:hover:bg-purple-900/20 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5 inline mr-2 text-purple-500" />
                  {folder.name}
                  {folder.id === currentParentId && <span className="ml-2 text-[10px] text-slate-400">(atual)</span>}
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => { setMovingFileId(null); setMovingFileName(""); }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 pt-2">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded border-2 border-teal-400 bg-teal-50 flex items-center justify-center">
            <Check className="w-3 h-3 text-teal-600" />
          </div>
          <span>Vendedor pode ver este arquivo</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded border border-slate-300 bg-white"></div>
          <span>Arquivo não disponível (clique para adicionar)</span>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// PASSWORD MANAGER VIEW - Senhas dos vendedores (gestor)
// ============================================================
function PasswordManagerView({ gestorName }: { gestorName: string }) {
  const passwordsQuery = trpc.sales.getSellerPasswords.useQuery({ gestorName });
  const updateMutation = trpc.sales.updateSellerPassword.useMutation({
    onSuccess: () => passwordsQuery.refetch(),
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showPasswords, setShowPasswords] = useState<Set<number>>(new Set());

  if (passwordsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-teal-500" />
        <span className="ml-2 text-sm text-slate-500">Carregando senhas...</span>
      </div>
    );
  }
  if (passwordsQuery.error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-500">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span className="text-sm">Erro ao carregar senhas</span>
      </div>
    );
  }

  const sellers = passwordsQuery.data || [];

  const toggleShowPassword = (id: number) => {
    setShowPasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEditing = (id: number, currentPassword: string) => {
    setEditingId(id);
    setEditValue(currentPassword);
  };

  const savePassword = (sellerId: number) => {
    if (editValue.trim()) {
      updateMutation.mutate({ sellerId, password: editValue.trim() });
    }
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue("");
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {sellers.length} vendedores · Defina a senha de acesso ao aplicativo
      </p>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {sellers.map((seller, idx) => (
          <div
            key={seller.id}
            className={`flex items-center gap-4 px-4 py-3 ${
              idx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/50 dark:bg-slate-800/50"
            } ${idx > 0 ? "border-t border-slate-100 dark:border-slate-700/50" : ""}`}
          >
            {/* Lock icon */}
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>

            {/* Seller name */}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {seller.name}
              </span>
            </div>

            {/* Password field */}
            <div className="flex items-center gap-2">
              {editingId === seller.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") savePassword(seller.id);
                      if (e.key === "Escape") cancelEditing();
                    }}
                    className="w-36 px-3 py-1.5 text-sm border border-teal-300 dark:border-teal-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    autoFocus
                  />
                  <button
                    onClick={() => savePassword(seller.id)}
                    className="px-2.5 py-1.5 text-xs font-medium bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-36 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 rounded-lg text-center font-mono">
                    {showPasswords.has(seller.id) ? (
                      <span className="text-slate-800 dark:text-slate-100">{seller.password}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">••••••••</span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleShowPassword(seller.id)}
                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title={showPasswords.has(seller.id) ? "Ocultar senha" : "Mostrar senha"}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startEditing(seller.id, seller.password)}
                    className="px-2.5 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                  >
                    Editar
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
