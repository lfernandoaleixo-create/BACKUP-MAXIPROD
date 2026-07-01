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
  Users, BarChart3, ClipboardCheck, ShieldCheck, Shield, Settings,
  ChevronDown, ChevronRight, Lock, RefreshCw, AlertCircle, Crown,
  Package, Tag, FolderOpen, Target, Eye, UserPlus, ArrowLeft
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useOperator } from "@/contexts/OperatorContext";

type GestaoView = "gestores" | "vendedores" | "metricas";

// Config categories available for each gestor
type ConfigCategory = "estoque" | "tabela_preco" | "catalogos" | "senha";

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

  // Get vendedores for a gestor card (for sub-gestor Renato, he has no vendedores yet)
  const getVendedoresForCard = (card: GestorCard): string[] => {
    if (card.role === "Sub-gestor") return []; // Sub-gestor doesn't have vendedores yet
    return getVendedoresForGestor(card.name);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-white">Painel dos Gestores</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {GESTOR_CARDS.filter(g => g.role !== "Sub-gestor").length} gestores · 1 sub-gestor · {totalVendedores} vendedores
              </p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={isFetching}
            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            title="Atualizar do Maxiprod"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
          <RefreshCw className="w-6 h-6 text-teal-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Buscando representantes do Maxiprod...</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-800 shadow-sm p-6">
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
        const vendedores = getVendedoresForCard(card);
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Catálogos</span>
                      </button>
                      <button
                        onClick={() => setActiveConfig("senha")}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 hover:border-teal-300 hover:bg-teal-50 dark:hover:border-teal-600 dark:hover:bg-teal-900/20 transition-all cursor-pointer"
                      >
                        <Lock className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Senhas</span>
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
                        {activeConfig === "catalogos" && "Configurar Catálogos"}
                        {activeConfig === "senha" && "Configurar Senhas"}
                      </span>
                    </div>

                    {/* Vendedores list */}
                    <div className="space-y-2">
                      {vendedores.length === 0 && (
                        <div className="text-center py-6">
                          <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum vendedor cadastrado</p>
                        </div>
                      )}
                      {vendedores.map((vendedor) => {
                        const perm = getPermission(vendedor, card.name) || getPermissionByName(vendedor);
                        return (
                          <div
                            key={vendedor}
                            onClick={() => { if (perm) navigate(`/gestao-comercial/vendedor/${perm.id}`); }}
                            className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700 hover:border-teal-200 dark:hover:border-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-900/10 transition-all cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-bold text-[10px]">
                              {vendedor.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{vendedor}</p>
                              {activeConfig === "senha" && perm && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">Senha atual: {perm.password}</p>
                              )}
                              {activeConfig === "tabela_preco" && perm?.priceTableCode && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">Tabela: {perm.priceTableCode}</p>
                              )}
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
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
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
