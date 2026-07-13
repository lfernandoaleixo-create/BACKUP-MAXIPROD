/**
 * Gestão Comercial - Reestruturada com duas abas principais:
 * 1. GESTORES - 4 cards (Jordão, Ana Paula, Juvenal, Renato) com painel de configuração
 * 2. VENDEDORES - Visão do vendedor (inclui gestores como vendedores)
 * 
 * Hierarquia:
 * - Jordão Laine (Gestor)
 * - Ana Paula Aleixo (Gestora)
 * - Juvenal Teixeira (Gestor)
 * - Renato Ledesma (Sub-gestor)
 */
import { useState, useMemo, useEffect } from "react";
import TopNav from "@/components/TopNav";
import GestaoMetricasVendedores from "@/components/GestaoMetricasVendedores";
import { trpc } from "@/lib/trpc";
import {
  Users, BarChart3, ClipboardCheck, ShieldCheck, Shield, Settings, ShoppingCart,
  ChevronDown, ChevronRight, Lock, RefreshCw, AlertCircle, Crown,
  Package, Tag, FolderOpen, Target, Eye, UserPlus, ArrowLeft, DollarSign, Calculator, FileText, Check,
  TrendingUp, Pencil, Upload, Plus, Trash2, FolderPlus, Download, X, ArrowRightLeft, Percent, FileSpreadsheet
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useOperator } from "@/contexts/OperatorContext";

type GestaoView = "gestores" | "vendedores" | "metricas";

// Config categories available for each gestor
type ConfigCategory = "estoque" | "tabela_preco" | "catalogos" | "senha" | "pedidos" | "metricas" | "acesso" | "comissao";

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
  { name: "RENATO LEDESMA", role: "Sub-gestor", parentGestor: "JUVENAL TEIXEIRA" },
];

// Map gestor names to their Maxiprod group names (may differ in accents/case)
const GESTOR_NAME_MAP: Record<string, string> = {
  "JORDÃO LAINE": "JORDÃO LAINE",
  "ANA PAULA ALEIXO": "ANA PAULA ALEIXO",
  "JUVENAL TEIXEIRA": "JUVENAL TEIXEIRA",
  "RENATO LEDESMA": "RENATO ALEIXO",  // Nome no Maxiprod ainda é RENATO ALEIXO
};

/**
 * Button to export vendor clients as Maxiprod-format Excel
 */
function ExportMaxiprodButton() {
  const [showOptions, setShowOptions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMutation = trpc.sales.exportMaxiprodExcel.useMutation();

  const handleExport = async (sinceDays?: number) => {
    setIsExporting(true);
    setShowOptions(false);
    try {
      const result = await exportMutation.mutateAsync({ sinceDays });
      // Download the file
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
    } catch (err) {
      alert("Erro ao exportar: " + (err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={isExporting}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all cursor-pointer disabled:opacity-50"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        {isExporting ? "Exportando..." : "Exportar Maxiprod"}
      </button>

      {showOptions && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-[200px] py-1">
          <button
            onClick={() => handleExport(7)}
            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Últimos 7 dias
          </button>
          <button
            onClick={() => handleExport(30)}
            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Últimos 30 dias
          </button>
          <button
            onClick={() => handleExport(undefined)}
            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Todos os clientes
          </button>
          <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
          <button
            onClick={() => setShowOptions(false)}
            className="w-full text-left px-4 py-2 text-xs text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

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
    // Use GESTOR_NAME_MAP to resolve the Maxiprod name (e.g. "RENATO LEDESMA" -> "RENATO ALEIXO")
    const maxiprodName = GESTOR_NAME_MAP[gestorName] || gestorName;
    // Try exact match first
    const grupo = gestores.find(g => g.gestor.toUpperCase() === maxiprodName.toUpperCase());
    if (grupo) return grupo.vendedores;
    // Try without accents
    const normalized = maxiprodName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Exportar Maxiprod button */}
          <ExportMaxiprodButton />
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
  // For sub-gestor Renato: get vendedores from seller_permissions (manually added)
  // For Ana Paula: from Maxiprod
  const getVendedoresForCard = (card: GestorCard): string[] => {
    if (card.role === "Sub-gestor") {
      // Sub-gestor gets vendedores from seller_permissions (manually added via "Adicionar Vendedor")
      const permsForGestor = permissions.filter(
        p => p.gestorName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === card.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
      );
      return permsForGestor.map(p => p.sellerName);
    }
    const vendedores = getVendedoresForGestor(card.name);
    // Filter out vendedores who are also Gestor/Gestora (they have their own independent card)
    // Sub-gestores like Renato should NOT be filtered — they count as vendedores under their parent gestor
    const gestorOnlyNames = GESTOR_CARDS
      .filter(g => g.role === "Gestor" || g.role === "Gestora")
      .map(g => g.name.toUpperCase());
    return vendedores.filter(v => !gestorOnlyNames.includes(v.toUpperCase()));
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
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Documentos/Catálogos</span>
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
                        onClick={() => setActiveConfig("acesso")}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 hover:border-teal-300 hover:bg-teal-50 dark:hover:border-teal-600 dark:hover:bg-teal-900/20 transition-all cursor-pointer"
                      >
                        <Shield className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Acesso ao Aplicativo</span>
                      </button>
                      <button
                        onClick={() => setActiveConfig("comissao")}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 hover:border-teal-300 hover:bg-teal-50 dark:hover:border-teal-600 dark:hover:bg-teal-900/20 transition-all cursor-pointer"
                      >
                        <Percent className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Comissão</span>
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
                        {activeConfig === "acesso" && "Acesso ao Aplicativo"}
                        {activeConfig === "comissao" && "Comissão dos Vendedores"}
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
                    ) : activeConfig === "metricas" ? (
                      <GestaoMetricasVendedores sellerNames={vendedores} />
                    ) : activeConfig === "acesso" ? (
                      <AcessoAppView gestorName={card.name} vendedores={vendedores} permissions={permissions} onToggleAuth={handleToggleAuth} />
                    ) : activeConfig === "pedidos" ? (
                      <div className="space-y-3">
                        {/* Quick access: Aprovações + Pedidos (Vitória) */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Link href="/gestao-comercial/aprovacoes" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all cursor-pointer">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Aprovações
                          </Link>
                          <Link href="/gestao-comercial/pedidos-operador" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all cursor-pointer">
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            Pedidos (Vitória)
                          </Link>
                        </div>
                        {/* Vendedores list */}
                        {vendedores.length === 0 && (
                          <div className="text-center py-6">
                            <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum vendedor cadastrado</p>
                          </div>
                        )}
                        {vendedores.map((vendedor) => {
                          const perm = getPermission(vendedor, card.name) || getPermissionByName(vendedor);
                          const target = { tab: "pedidos" };
                          const navUrl = `/gestao-comercial/vendedor/${perm?.id}?tab=${target.tab}`;
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
                    ) : activeConfig === "comissao" ? (
                      <ComissaoView gestorName={card.name} />
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
// ACESSO AO APLICATIVO VIEW - Shows all sellers with authorized/blocked status
// ============================================================
interface AcessoAppViewProps {
  gestorName: string;
  vendedores: string[];
  permissions: SellerPermission[];
  onToggleAuth: (sellerId: number, currentAuth: boolean) => void;
}

function AcessoAppView({ gestorName, vendedores, permissions, onToggleAuth }: AcessoAppViewProps) {
  const getPermForVendedor = (vendedor: string): SellerPermission | undefined => {
    return permissions.find(
      (p) => p.sellerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === vendedor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    );
  };

  const authorizedCount = vendedores.filter(v => getPermForVendedor(v)?.authorized).length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {authorizedCount} autorizado{authorizedCount !== 1 ? "s" : ""} de {vendedores.length} vendedor{vendedores.length !== 1 ? "es" : ""}
          </span>
        </div>
      </div>

      {/* Sellers list */}
      <div className="space-y-2">
        {vendedores.map((vendedor) => {
          const perm = getPermForVendedor(vendedor);
          const isAuthorized = perm?.authorized ?? false;

          return (
            <div
              key={vendedor}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px] ${
                isAuthorized
                  ? "bg-gradient-to-br from-emerald-400 to-emerald-600"
                  : "bg-gradient-to-br from-red-300 to-red-500"
              }`}>
                {vendedor.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{vendedor}</p>
                <p className={`text-[10px] font-medium ${
                  isAuthorized
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500 dark:text-red-400"
                }`}>
                  {isAuthorized ? "Autorizado" : "Bloqueado"}
                </p>
              </div>
              {perm && (
                <button
                  onClick={() => onToggleAuth(perm.id, isAuthorized)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isAuthorized
                      ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40"
                      : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                  }`}
                >
                  {isAuthorized ? "Bloquear" : "Autorizar"}
                </button>
              )}
            </div>
          );
        })}
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
  const deleteMutation = trpc.sales.deleteSellerPermission.useMutation();
  const utils = trpc.useUtils();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleDeleteSeller = (sellerId: number) => {
    deleteMutation.mutate(
      { sellerId },
      { onSuccess: () => { utils.sales.listSellerPermissions.invalidate(); setConfirmDeleteId(null); } }
    );
  };

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

    // Add regular vendedores from Maxiprod
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

    // Also include sellers from seller_permissions that aren't already in the list
    // (e.g. manually added sellers not in Maxiprod representantes)
    const addedNames = new Set(result.map(r => r.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()));
    for (const perm of permissions) {
      const normName = perm.sellerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      if (addedNames.has(normName)) continue;
      // Skip gestores that are already in the list
      if (GESTOR_CARDS.some(g => g.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === normName)) continue;
      result.push({ name: perm.sellerName, gestor: perm.gestorName, permission: perm, isGestor: false });
      addedNames.add(normName);
    }

    return result.sort((a, b) => {
      // Gestores first, then alphabetical
      if (a.isGestor && !b.isGestor) return -1;
      if (!a.isGestor && b.isGestor) return 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [getVendedoresForGestor, permissions]);

  const authorizedCount = allVendedores.filter(v => v.permission?.authorized).length;

  const [panelExpanded, setPanelExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* Painel dos Vendedores - Collapsible */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Clickable header */}
        <button
          onClick={() => setPanelExpanded(!panelExpanded)}
          className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-white">Painel dos Vendedores</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {authorizedCount} autorizados de {allVendedores.length} · Clique para expandir
              </p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${panelExpanded ? '' : '-rotate-90'}`} />
        </button>

        {/* Expanded content - vendedores list */}
        {panelExpanded && (
          <div className="border-t border-slate-200 dark:border-slate-700">
            {isLoading ? (
              <div className="p-6 text-center">
                <RefreshCw className="w-5 h-5 text-orange-500 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Carregando vendedores...</p>
              </div>
            ) : (
              <div>
                {allVendedores.map((v, idx) => (
                  <div
                    key={v.name}
                    className={`${idx > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}`}
                  >
                    <button
                      onClick={() => { if (v.permission) navigate(`/gestao-comercial/vendedor/${v.permission.id}`); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                        v.isGestor
                          ? "bg-gradient-to-br from-teal-400 to-teal-600"
                          : v.permission?.authorized
                            ? "bg-gradient-to-br from-orange-300 to-orange-500"
                            : "bg-gradient-to-br from-slate-300 to-slate-400"
                      }`}>
                        {v.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{v.name}</p>
                        {v.isGestor && <Crown className="w-3 h-3 text-teal-500 shrink-0" />}
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                          {v.isGestor ? (GESTOR_CARDS.find(g => g.name.toUpperCase() === v.name.toUpperCase())?.role === "Gestora" ? "Vendedora" : "Vendedor") : `Vendedor \u00b7 Gestor: ${v.gestor}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {v.permission?.authorized ? (
                          <div className="w-2 h-2 rounded-full bg-emerald-500" title="Autorizado" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-red-400" title="Bloqueado" />
                        )}
                        {/* Delete button for sellers with passwords (not gestores) */}
                        {v.permission && !v.isGestor && (
                          confirmDeleteId === v.permission.id ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteSeller(v.permission!.id); }}
                                className="px-2 py-0.5 text-[10px] font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                className="px-2 py-0.5 text-[10px] font-medium bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-300 transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(v.permission!.id); }}
                              className="p-1 rounded text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                              title="Excluir vendedor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================
// VENDEDORES COLLAPSIBLE - starts collapsed, expands to show list
// ============================================================
function VendedoresCollapsible({ allVendedores, isLoading, navigate }: { allVendedores: any[]; isLoading: boolean; navigate: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm overflow-hidden">
      {/* Clickable header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors text-left"
      >
        <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Visão do Vendedor</p>
          <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
            Clique para ver os vendedores ({allVendedores.length})
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
            {allVendedores.length}
          </span>
          <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
        </div>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t border-blue-100 dark:border-blue-800">
          {isLoading ? (
            <div className="p-6 text-center">
              <RefreshCw className="w-5 h-5 text-orange-500 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Carregando vendedores...</p>
            </div>
          ) : (
            <div>
              {allVendedores.map((v, idx) => (
                <div
                  key={v.name}
                  className={`${idx > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}`}
                >
                  <button
                    onClick={() => { if (v.permission) navigate(`/gestao-comercial/vendedor/${v.permission.id}`); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                      v.isGestor
                        ? "bg-gradient-to-br from-teal-400 to-teal-600"
                        : v.permission?.authorized
                          ? "bg-gradient-to-br from-orange-300 to-orange-500"
                          : "bg-gradient-to-br from-slate-300 to-slate-400"
                    }`}>
                      {v.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{v.name}</p>
                      {v.isGestor && <Crown className="w-3 h-3 text-teal-500 shrink-0" />}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                        {v.isGestor ? (GESTOR_CARDS.find(g => g.name.toUpperCase() === v.name.toUpperCase())?.role === "Gestora" ? "Vendedora" : "Vendedor") : `Vendedor \u00b7 Gestor: ${v.gestor}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {v.permission?.authorized ? (
                        <div className="w-2 h-2 rounded-full bg-emerald-500" title="Autorizado" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-red-400" title="Bloqueado" />
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
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
  const [priceMode, setPriceMode] = useState<"mostrado" | "alto" | "medioAlto" | "medio" | "baixo">("mostrado");
  const [editingTiers, setEditingTiers] = useState(false);
  const [tierValues, setTierValues] = useState({ alto: 20, medioAlto: 23, medio: 27, baixo: 32 });

  const matrixQuery = trpc.sales.getPriceMatrix.useQuery({ gestorName });
  const tiersQuery = trpc.sales.getPriceTierDiscounts.useQuery({ gestorName });
  const saveTiersMutation = trpc.sales.savePriceTierDiscounts.useMutation();

  // Load saved tier discounts from DB
  useEffect(() => {
    if (tiersQuery.data?.tiers) {
      setTierValues(tiersQuery.data.tiers);
    }
  }, [tiersQuery.data]);


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

  const formatPrice = (preco: string | null, _descontoMax: string | null) => {
    if (!preco) return null;
    const precoMostrado = parseFloat(preco);
    // Preço Mostrado = preço direto da tabela do Maxiprod (sem margem, sem desconto)
    if (priceMode === "mostrado") return precoMostrado;
    if (priceMode === "alto") return precoMostrado * (1 - tierValues.alto / 100);
    if (priceMode === "medioAlto") return precoMostrado * (1 - tierValues.medioAlto / 100);
    if (priceMode === "medio") return precoMostrado * (1 - tierValues.medio / 100);
    if (priceMode === "baixo") return precoMostrado * (1 - tierValues.baixo / 100);
    return precoMostrado;
  };

  return (
    <div className="space-y-4">
      {/* Preço Mostrado = preço direto da tabela Maxiprod, sem margem */}

      {/* Controls bar */}
      <div className="flex flex-col gap-3">
        {/* Price mode buttons - 5 tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1 flex-wrap">
          <button
            onClick={() => setPriceMode("mostrado")}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-md font-bold transition-all ${
              priceMode === "mostrado"
                ? "bg-blue-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Preço Mostrado
          </button>
          <button
            onClick={() => setPriceMode("alto")}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-md font-bold transition-all ${
              priceMode === "alto"
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Preço Alto ({tierValues.alto}%)
          </button>
          <button
            onClick={() => setPriceMode("medioAlto")}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-md font-bold transition-all ${
              priceMode === "medioAlto"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Preço Médio-Alto ({tierValues.medioAlto}%)
          </button>
          <button
            onClick={() => setPriceMode("medio")}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-md font-bold transition-all ${
              priceMode === "medio"
                ? "bg-orange-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Preço Médio ({tierValues.medio}%)
          </button>
          <button
            onClick={() => setPriceMode("baixo")}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-md font-bold transition-all ${
              priceMode === "baixo"
                ? "bg-red-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Preço Baixo ({tierValues.baixo}%)
          </button>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Editar porcentagens */}
          <div className="flex items-center gap-1">
            {editingTiers ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500">Alto:</span>
                  <input type="number" min="0" max="100" step="0.5" value={tierValues.alto}
                    onChange={(e) => setTierValues(v => ({ ...v, alto: Number(e.target.value) }))}
                    className="w-14 text-xs px-1.5 py-1 rounded border border-emerald-300 dark:border-emerald-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500">Médio-Alto:</span>
                  <input type="number" min="0" max="100" step="0.5" value={tierValues.medioAlto}
                    onChange={(e) => setTierValues(v => ({ ...v, medioAlto: Number(e.target.value) }))}
                    className="w-14 text-xs px-1.5 py-1 rounded border border-amber-300 dark:border-amber-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-amber-400" />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500">Médio:</span>
                  <input type="number" min="0" max="100" step="0.5" value={tierValues.medio}
                    onChange={(e) => setTierValues(v => ({ ...v, medio: Number(e.target.value) }))}
                    className="w-14 text-xs px-1.5 py-1 rounded border border-orange-300 dark:border-orange-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-orange-400" />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500">Baixo:</span>
                  <input type="number" min="0" max="100" step="0.5" value={tierValues.baixo}
                    onChange={(e) => setTierValues(v => ({ ...v, baixo: Number(e.target.value) }))}
                    className="w-14 text-xs px-1.5 py-1 rounded border border-red-300 dark:border-red-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-red-400" />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
                <button
                  onClick={() => {
                    setEditingTiers(false);
                    saveTiersMutation.mutate({ gestorName, tiers: tierValues });
                  }}
                  className="text-xs px-2.5 py-1 rounded bg-teal-500 text-white hover:bg-teal-600 font-bold"
                >
                  Salvar
                </button>
                <button
                  onClick={() => {
                    setEditingTiers(false);
                    if (tiersQuery.data?.tiers) setTierValues(tiersQuery.data.tiers);
                  }}
                  className="text-xs px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 hover:bg-slate-300"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingTiers(true)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-800/50 transition-colors"
              >
                <Pencil className="w-3 h-3" />
                Editar Porcentagens
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Info badges */}
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {bambuProducts.length} bambu · {madeiraProducts.length} madeira · {sellers.length} vend.
            </span>
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
      </div>

      {/* BAMBU Card */}
      <PriceSegmentCard
        title="Bambu"
        color="blue"
        products={filterProducts(bambuProducts)}
        sellers={sellers}
        allProducts={bambuProducts}
        priceMode={priceMode}
        formatPrice={formatPrice}
      />
      {/* MADEIRA Card */}
      <PriceSegmentCard
        title="Madeira"
        color="amber"
        products={filterProducts(madeiraProducts)}
        sellers={sellers}
        allProducts={madeiraProducts}
        priceMode={priceMode}
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
  priceMode: "mostrado" | "alto" | "medioAlto" | "medio" | "baixo";
  formatPrice: (preco: string | null, descontoMax: string | null) => number | null;
}

function PriceSegmentCard({ title, color, products, sellers, allProducts, priceMode, formatPrice }: PriceSegmentCardProps) {
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
                          <span className={`text-[11px] font-bold tabular-nums ${
                            priceMode === "mostrado" ? "text-blue-600 dark:text-blue-400" :
                            priceMode === "alto" ? "text-emerald-600 dark:text-emerald-400" :
                            priceMode === "medioAlto" ? "text-amber-600 dark:text-amber-400" :
                            priceMode === "medio" ? "text-orange-600 dark:text-orange-400" :
                            priceMode === "baixo" ? "text-red-600 dark:text-red-400" :
                            "text-slate-800 dark:text-slate-100"
                          }`}>
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
  const utils = trpc.useUtils();
  const passwordsQuery = trpc.sales.getSellerPasswords.useQuery({ gestorName });
  const updateMutation = trpc.sales.updateSellerPassword.useMutation({
    onSuccess: () => passwordsQuery.refetch(),
  });
  const addSellerMutation = trpc.sales.addSellerWithPassword.useMutation({
    onSuccess: () => {
      passwordsQuery.refetch();
      utils.sales.listSellerPermissions.invalidate();
      setShowAddForm(false);
      setNewSellerName("");
      setNewSellerPassword("");
      setNewSellerAuthorized(true);
      setAddError("");
    },
  });
  const deleteMutation = trpc.sales.deleteSellerPermission.useMutation({
    onSuccess: () => { passwordsQuery.refetch(); utils.sales.listSellerPermissions.invalidate(); },
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showPasswords, setShowPasswords] = useState<Set<number>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSellerName, setNewSellerName] = useState("");
  const [newSellerPassword, setNewSellerPassword] = useState("");
  const [newSellerAuthorized, setNewSellerAuthorized] = useState(true);
  const [addError, setAddError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

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

  const handleAddSeller = async () => {
    if (!newSellerName.trim()) {
      setAddError("Informe o nome do vendedor");
      return;
    }
    if (!newSellerPassword.trim()) {
      setAddError("Informe a senha");
      return;
    }
    setAddError("");
    try {
      await addSellerMutation.mutateAsync({
        gestorName,
        sellerName: newSellerName.trim(),
        password: newSellerPassword.trim(),
        authorized: newSellerAuthorized,
      });
    } catch (e: any) {
      setAddError(e.message || "Erro ao adicionar vendedor");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {sellers.length} vendedores · Defina a senha de acesso ao aplicativo
        </p>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Adicionar Vendedor
        </button>
      </div>

      {/* Add seller form */}
      {showAddForm && (
        <div className="p-4 rounded-xl border-2 border-teal-200 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-900/10 space-y-3">
          <h4 className="text-sm font-semibold text-teal-700 dark:text-teal-300 flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Novo Vendedor
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Nome do Vendedor *</label>
              <input
                type="text"
                value={newSellerName}
                onChange={(e) => setNewSellerName(e.target.value.toUpperCase())}
                placeholder="Ex: JOÃO SILVA"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Senha *</label>
              <input
                type="text"
                value={newSellerPassword}
                onChange={(e) => setNewSellerPassword(e.target.value)}
                placeholder="Senha de acesso"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewSellerAuthorized(!newSellerAuthorized)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                newSellerAuthorized
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              }`}
            >
              {newSellerAuthorized && <Check className="w-3 h-3" />}
            </button>
            <span className="text-xs text-slate-600 dark:text-slate-400">Autorizado (libera acesso imediato)</span>
          </div>
          {addError && (
            <p className="text-xs text-red-600 font-medium">{addError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAddSeller}
              disabled={addSellerMutation.isPending}
              className="px-4 py-2 text-xs font-medium bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50"
            >
              {addSellerMutation.isPending ? "Salvando..." : "Salvar Vendedor"}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setAddError(""); }}
              className="px-4 py-2 text-xs font-medium bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

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
                  {/* Delete button */}
                  {confirmDeleteId === seller.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { deleteMutation.mutate({ sellerId: seller.id }); setConfirmDeleteId(null); }}
                        className="px-2 py-1 text-[10px] font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                      >
                        Sim, excluir
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 text-[10px] font-medium bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-300 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(seller.id)}
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                      title="Excluir vendedor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComissaoView({ gestorName }: { gestorName: string }) {
  const utils = trpc.useUtils();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data, isLoading } = trpc.sales.getCommissions.useQuery({ gestorName, year, month });
  const saveGoalMutation = trpc.sales.saveSellerGoal.useMutation({
    onSuccess: () => utils.sales.getCommissions.invalidate({ gestorName }),
  });
  const saveMatrixMutation = trpc.sales.saveCommissionMatrix.useMutation({
    onSuccess: () => utils.sales.getCommissions.invalidate({ gestorName }),
  });

  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [goalValue, setGoalValue] = useState("");
  const [editingSellerId, setEditingSellerId] = useState<number | null>(null);
  const [editingCells, setEditingCells] = useState<Record<string, number>>({});
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: { percent: number; metaPercent: number; metaValue: number; result: number } } | null>(null);

  // Default commission matrix values
  const DEFAULT_MATRIX = [
    { metaPercent: 80, mostrado_alto: 5.0, medio_alto: 4.0, medio: 3.0, baixo: 2.0 },
    { metaPercent: 90, mostrado_alto: 5.5, medio_alto: 4.5, medio: 3.5, baixo: 2.5 },
    { metaPercent: 100, mostrado_alto: 6.0, medio_alto: 5.0, medio: 4.0, baixo: 3.0 },
    { metaPercent: 110, mostrado_alto: 6.5, medio_alto: 5.5, medio: 4.5, baixo: 3.5 },
    { metaPercent: 120, mostrado_alto: 7.0, medio_alto: 6.0, medio: 5.0, baixo: 4.0 },
  ];

  const TIERS = ["mostrado_alto", "medio_alto", "medio", "baixo"] as const;
  const TIER_LABELS: Record<string, string> = {
    mostrado_alto: "Preço Mostrado/Alto",
    medio_alto: "Preço Médio-Alto",
    medio: "Preço Médio",
    baixo: "Preço Baixo",
  };
  const META_PERCENTS = [80, 90, 100, 110, 120];



  const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-5 h-5 animate-spin text-teal-500" />
        <span className="ml-2 text-sm text-slate-500">Carregando...</span>
      </div>
    );
  }

  if (!data?.sellers || data.sellers.length === 0) {
    return (
      <div className="text-center py-6">
        <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum vendedor cadastrado</p>
      </div>
    );
  }

  // Get commission value for a seller at a given metaPercent and tier
  const getSellerCommission = (sellerId: number, metaPercent: number, tier: typeof TIERS[number]) => {
    if (!data?.matrix) return DEFAULT_MATRIX.find(r => r.metaPercent === metaPercent)?.[tier] ?? 0;
    const cell = data.matrix.find(m => m.sellerId === sellerId && m.metaPercent === metaPercent && m.priceTier === tier);
    return cell ? cell.commissionPercent : DEFAULT_MATRIX.find(r => r.metaPercent === metaPercent)?.[tier] ?? 0;
  };

  const cellKey = (sellerId: number, metaPercent: number, tier: string) => `${sellerId}-${metaPercent}-${tier}`;

  const startEditingSeller = (sellerId: number) => {
    // Load current values into editing state
    const cells: Record<string, number> = {};
    for (const mp of META_PERCENTS) {
      for (const tier of TIERS) {
        cells[cellKey(sellerId, mp, tier)] = getSellerCommission(sellerId, mp, tier);
      }
    }
    setEditingCells(cells);
    setEditingSellerId(sellerId);
  };

  const saveSellerMatrix = (sellerId: number) => {
    const flat: { metaPercent: number; priceTier: "mostrado_alto" | "medio_alto" | "medio" | "baixo"; commissionPercent: number }[] = [];
    for (const mp of META_PERCENTS) {
      for (const tier of TIERS) {
        flat.push({ metaPercent: mp, priceTier: tier, commissionPercent: editingCells[cellKey(sellerId, mp, tier)] ?? 0 });
      }
    }
    saveMatrixMutation.mutate({ gestorName, sellerId, matrix: flat });
    setEditingSellerId(null);
    setEditingCells({});
  };

  const saveGoal = (sellerId: number, sellerName: string) => {
    const val = parseFloat(goalValue);
    if (isNaN(val) || val < 0) return;
    saveGoalMutation.mutate({ sellerId, sellerName, gestorName, year, month, goalAmount: val });
    setEditingGoalId(null);
  };

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
        >
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
        >
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Single unified table: rows = sellers, columns = Meta R$ | % da Meta tiers x Price tiers */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                <th rowSpan={2} className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 sticky left-0 bg-slate-50 dark:bg-slate-800 z-20 min-w-[240px] w-[240px]">Vendedor</th>
                <th rowSpan={2} className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 min-w-[100px] sticky left-[240px] bg-slate-50 dark:bg-slate-800 z-20">Meta em R$</th>
                {META_PERCENTS.map(mp => (
                  <th key={mp} colSpan={4} className="px-2 py-1.5 text-center font-semibold text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700">
                    {mp}% da Meta
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50/80 dark:bg-slate-800/80">
                {META_PERCENTS.map((mp, mpIdx) => (
                  TIERS.map((tier, tierIdx) => (
                    <th key={`${mp}-${tier}`} className={`px-1.5 py-1 text-center font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 text-[10px] whitespace-nowrap ${tierIdx === 0 ? "border-l-2 border-l-slate-300 dark:border-l-slate-600" : ""}`}>
                      {TIER_LABELS[tier]}
                    </th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sellers.map((seller) => {
                const isEditing = editingSellerId === seller.id;
                const isEditingGoal = editingGoalId === seller.id;
                return (
                  <tr key={seller.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    {/* Seller name + edit button */}
                    <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 sticky left-0 bg-white dark:bg-slate-900 z-20 min-w-[240px] w-[240px]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-teal-700 dark:text-teal-300">
                            {seller.sellerName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-slate-700 dark:text-slate-200 text-[11px] whitespace-nowrap">
                          {seller.sellerName}
                        </span>
                        {!isEditing && (
                          <button
                            onClick={() => startEditingSeller(seller.id)}
                            className="ml-1 p-0.5 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20 text-slate-400 hover:text-teal-600"
                            title="Editar comissões"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        {isEditing && (
                          <div className="flex items-center gap-0.5 ml-1">
                            <button onClick={() => saveSellerMatrix(seller.id)} className="p-0.5 rounded bg-teal-500 hover:bg-teal-600 text-white" title="Salvar">
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => { setEditingSellerId(null); setEditingCells({}); }} className="p-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300" title="Cancelar">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Meta em R$ */}
                    <td className="px-2 py-2 text-center border-r border-slate-200 dark:border-slate-700 sticky left-[240px] bg-white dark:bg-slate-900 z-20">
                      {isEditingGoal ? (
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={goalValue}
                            onChange={(e) => setGoalValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveGoal(seller.id, seller.sellerName); if (e.key === "Escape") setEditingGoalId(null); }}
                            className="w-20 px-1 py-0.5 text-xs text-center border border-teal-300 dark:border-teal-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-400"
                            autoFocus
                          />
                          <button onClick={() => saveGoal(seller.id, seller.sellerName)} className="p-0.5 rounded bg-teal-500 text-white"><Check className="w-2.5 h-2.5" /></button>
                          <button onClick={() => setEditingGoalId(null)} className="p-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-500"><X className="w-2.5 h-2.5" /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingGoalId(seller.id); setGoalValue(seller.goalAmount ? String(seller.goalAmount) : ""); }}
                          className="font-mono text-[11px] text-slate-600 dark:text-slate-300 hover:text-teal-600 cursor-pointer"
                        >
                          {seller.goalAmount ? `R$ ${seller.goalAmount.toLocaleString("pt-BR")}` : "—"}
                        </button>
                      )}
                    </td>
                    {/* Commission cells: for each metaPercent x tier */}
                    {META_PERCENTS.map((mp, mpIdx) => (
                      TIERS.map((tier, tierIdx) => {
                        const key = cellKey(seller.id, mp, tier);
                        const val = isEditing ? (editingCells[key] ?? 0) : getSellerCommission(seller.id, mp, tier);
                        return (
                          <td key={key} className={`px-1 py-1.5 text-center ${tierIdx === 0 ? "border-l-2 border-l-slate-300 dark:border-l-slate-600" : ""}`}>
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={editingCells[key] ?? 0}
                                onChange={(e) => setEditingCells(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                                className="w-12 px-0.5 py-0.5 text-center text-[10px] border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-400"
                              />
                            ) : (
                              <span
                                className="font-mono text-[11px] text-slate-700 dark:text-slate-200 cursor-pointer hover:text-teal-600 hover:underline transition-colors"
                                onClick={(e) => {
                                  if (seller.goalAmount) {
                                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                                    const metaValue = seller.goalAmount * (mp / 100);
                                    const result = (val / 100) * metaValue;
                                    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 10, content: { percent: val, metaPercent: mp, metaValue, result } });
                                  }
                                }}
                              >
                                {val}%
                              </span>
                            )}
                          </td>
                        );
                      })
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Comissão baseada na faixa de preço da venda e % da meta atingida no mês.
            Mostrado/Alto = sem desconto ou até 20% | Médio-Alto = 23% | Médio = 27% | Baixo = 32%
          </p>
        </div>
      </div>

      {/* Tooltip popover for commission calculation */}
      {tooltip && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setTooltip(null)}
        >
          <div
            className="absolute bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl p-4 min-w-[220px]"
            style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px`, transform: "translate(-50%, -100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Cálculo da Comissão</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Meta atingida ({tooltip.content.metaPercent}%):</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">R$ {tooltip.content.metaValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Comissão:</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{tooltip.content.percent}%</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-600 pt-1.5 mt-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-teal-700 dark:text-teal-300">Valor:</span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-300">R$ {tooltip.content.result.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setTooltip(null)}
              className="absolute top-1.5 right-1.5 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
