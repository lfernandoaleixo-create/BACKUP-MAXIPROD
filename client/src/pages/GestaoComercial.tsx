/**
 * Gestão Comercial - Reestruturada com duas abas principais:
 * 1. GESTORES - Painel administrativo onde cada gestor configura seus vendedores
 * 2. VENDEDORES - Visão do vendedor após configuração
 * 
 * Hierarquia:
 * - Jordão Laine (gestor)
 * - Ana Paula Aleixo (gestora - promovida)
 * - Juvenal Teixeira (gestor)
 *   - Renato Aleixo (sub-gestor do Juvenal)
 * 
 * Vitória tem acesso restrito: apenas à parte de Pedidos
 */
import { useState, useMemo, useEffect } from "react";
import TopNav from "@/components/TopNav";
import GestaoMetricasVendedores from "@/components/GestaoMetricasVendedores";
import { trpc } from "@/lib/trpc";
import {
  Users, BarChart3, ClipboardCheck, ShieldCheck, Shield, Settings,
  ChevronDown, ChevronRight, Lock, RefreshCw, AlertCircle, Crown,
  Package, Tag, FolderOpen, Target, Eye, UserPlus
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useOperator } from "@/contexts/OperatorContext";

type GestaoView = "gestores" | "vendedores" | "metricas";

// Gestores promovidos: vendedores no Maxiprod que são tratados como gestores
const PROMOTED_GESTORES = ["ANA PAULA ALEIXO"];

// Sub-gestores: vendedores que são sub-gestores de outro gestor
const SUB_GESTORES: Record<string, string> = {
  "RENATO ALEIXO": "JUVENAL TEIXEIRA", // Renato é sub-gestor do Juvenal
};

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

  // Build the gestores hierarchy from Maxiprod data
  const gestoresHierarchy = useMemo(() => {
    if (!representantesQuery.data) return [];
    const rawGestores = representantesQuery.data.gestores as GestorGroup[];

    // Result: list of gestores with their vendedores (excluding promoted gestores and sub-gestores from vendedores lists)
    const result: { gestor: string; vendedores: string[]; subGestores: { name: string; vendedores: string[] }[]; isPromoted: boolean }[] = [];

    for (const grupo of rawGestores) {
      // Filter out promoted gestores from vendedores list
      const vendedoresFiltered = grupo.vendedores.filter(
        v => !PROMOTED_GESTORES.includes(v.toUpperCase()) && !Object.keys(SUB_GESTORES).includes(v.toUpperCase())
      );

      // Find sub-gestores under this gestor
      const subGestoresUnderThis = Object.entries(SUB_GESTORES)
        .filter(([_, parentGestor]) => parentGestor.toUpperCase() === grupo.gestor.toUpperCase())
        .map(([subGestor]) => ({
          name: subGestor,
          vendedores: [] as string[], // Sub-gestores don't have vendedores yet
        }));

      result.push({
        gestor: grupo.gestor,
        vendedores: vendedoresFiltered,
        subGestores: subGestoresUnderThis,
        isPromoted: false,
      });
    }

    // Add promoted gestores as top-level gestores
    for (const promoted of PROMOTED_GESTORES) {
      // Find which gestor group they came from
      const parentGroup = rawGestores.find(g =>
        g.vendedores.some(v => v.toUpperCase() === promoted.toUpperCase())
      );
      if (parentGroup) {
        result.push({
          gestor: promoted,
          vendedores: [], // No vendedores yet
          subGestores: [],
          isPromoted: true,
        });
      }
    }

    // Sort: non-promoted first, then promoted
    return result.sort((a, b) => a.gestor.localeCompare(b.gestor, 'pt-BR'));
  }, [representantesQuery.data]);

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
            gestoresHierarchy={gestoresHierarchy}
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
            gestoresHierarchy={gestoresHierarchy}
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
// GESTORES TAB - Painel administrativo de cada gestor
// ============================================================
interface GestoresTabProps {
  gestoresHierarchy: { gestor: string; vendedores: string[]; subGestores: { name: string; vendedores: string[] }[]; isPromoted: boolean }[];
  permissions: SellerPermission[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRefresh: () => void;
  isFetching: boolean;
}

function GestoresTab({ gestoresHierarchy, permissions, isLoading, isError, errorMessage, onRefresh, isFetching }: GestoresTabProps) {
  const [expandedGestor, setExpandedGestor] = useState<string | null>(null);
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
      (p) => p.sellerName.toUpperCase() === sellerName.toUpperCase() &&
             p.gestorName.toUpperCase() === gestorName.toUpperCase()
    );
  };

  const totalVendedores = gestoresHierarchy.reduce((acc, g) => acc + g.vendedores.length + g.subGestores.length, 0);

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
                {gestoresHierarchy.length} gestores · {totalVendedores} vendedores
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

      {/* Gestor Cards */}
      {gestoresHierarchy.map((gestorData) => {
        const isExpanded = expandedGestor === gestorData.gestor;
        const vendedorCount = gestorData.vendedores.length + gestorData.subGestores.length;

        return (
          <div key={gestorData.gestor} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {/* Gestor Header */}
            <button
              onClick={() => setExpandedGestor(isExpanded ? null : gestorData.gestor)}
              className="w-full flex items-center justify-between p-4 md:px-6 md:py-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="text-slate-400">
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-base shadow-md">
                  {gestorData.gestor.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-sm md:text-base font-bold text-slate-800 dark:text-white">{gestorData.gestor}</p>
                    {gestorData.isPromoted && (
                      <span className="text-[9px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded font-medium">
                        GESTORA
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {vendedorCount} vendedor{vendedorCount !== 1 ? "es" : ""}
                    {gestorData.subGestores.length > 0 && ` · ${gestorData.subGestores.length} sub-gestor${gestorData.subGestores.length !== 1 ? "es" : ""}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-2.5 py-1 rounded-full font-medium">
                  {vendedorCount}
                </span>
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t border-slate-100 dark:border-slate-700">
                {/* Gestor info bar */}
                <div className="px-4 md:px-6 py-2.5 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Clique em um vendedor para configurar individualmente: Estoque, Tabela de Preço, Catálogos, Meta de Venda, Senha
                  </p>
                </div>

                {/* Sub-gestores */}
                {gestorData.subGestores.length > 0 && (
                  <div className="px-4 md:px-6 py-3 border-b border-slate-100 dark:border-slate-700 bg-purple-50/50 dark:bg-purple-900/10">
                    <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">Sub-Gestores</p>
                    {gestorData.subGestores.map((sub) => {
                      const perm = getPermission(sub.name, gestorData.gestor);
                      return (
                        <div key={sub.name} className="flex items-center gap-3 py-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-300 to-purple-500 flex items-center justify-center text-white font-bold text-[10px]">
                            {sub.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { if (perm) navigate(`/gestao-comercial/vendedor/${perm.id}`); }}>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-teal-600 transition-colors">{sub.name}</p>
                            <p className="text-[10px] text-purple-500 dark:text-purple-400">Sub-gestor · {sub.vendedores.length} vendedores</p>
                          </div>
                          {perm && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleAuth(perm.id, perm.authorized); }}
                              disabled={toggleAuthMutation.isPending}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                perm.authorized
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200"
                                  : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100"
                              }`}
                            >
                              {perm.authorized ? <><ShieldCheck className="w-3.5 h-3.5" /><span className="hidden sm:inline">Autorizado</span></> : <><Shield className="w-3.5 h-3.5" /><span className="hidden sm:inline">Bloqueado</span></>}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Vendedores List */}
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {gestorData.vendedores.length === 0 && gestorData.subGestores.length === 0 && (
                    <div className="px-6 py-6 text-center">
                      <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum vendedor cadastrado</p>
                      <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Os vendedores aparecerão aqui quando forem vinculados no Maxiprod</p>
                    </div>
                  )}
                  {gestorData.vendedores.map((vendedor) => {
                    const perm = getPermission(vendedor, gestorData.gestor);
                    return (
                      <div key={vendedor} className="flex items-center gap-3 px-4 md:px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-bold text-[10px]">
                          {vendedor.charAt(0).toUpperCase()}
                        </div>

                        {/* Name & password - clickable to open detail */}
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { if (perm) navigate(`/gestao-comercial/vendedor/${perm.id}`); }}>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-teal-600 transition-colors">{vendedor}</p>
                          {perm && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Lock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">Senha: {perm.password}</span>
                            </div>
                          )}
                        </div>

                        {/* Config button */}
                        {perm && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/gestao-comercial/vendedor/${perm.id}`); }}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors cursor-pointer"
                            title="Configurar vendedor"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        )}

                        {/* Authorization toggle */}
                        {perm && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleAuth(perm.id, perm.authorized); }}
                            disabled={toggleAuthMutation.isPending}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              perm.authorized
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200"
                                : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100"
                            }`}
                            title={perm.authorized ? "Clique para bloquear acesso" : "Clique para autorizar acesso"}
                          >
                            {perm.authorized ? (
                              <><ShieldCheck className="w-3.5 h-3.5" /><span className="hidden sm:inline">Autorizado</span></>
                            ) : (
                              <><Shield className="w-3.5 h-3.5" /><span className="hidden sm:inline">Bloqueado</span></>
                            )}
                          </button>
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
  );
}

// ============================================================
// VENDEDORES TAB - Visão do vendedor após configuração
// ============================================================
interface VendedoresTabProps {
  gestoresHierarchy: { gestor: string; vendedores: string[]; subGestores: { name: string; vendedores: string[] }[]; isPromoted: boolean }[];
  permissions: SellerPermission[];
  isLoading: boolean;
}

function VendedoresTab({ gestoresHierarchy, permissions, isLoading }: VendedoresTabProps) {
  const [, navigate] = useLocation();

  // Flatten all vendedores with their gestor info
  const allVendedores = useMemo(() => {
    const result: { name: string; gestor: string; permission?: SellerPermission }[] = [];
    for (const g of gestoresHierarchy) {
      for (const v of g.vendedores) {
        const perm = permissions.find(
          p => p.sellerName.toUpperCase() === v.toUpperCase() && p.gestorName.toUpperCase() === g.gestor.toUpperCase()
        );
        result.push({ name: v, gestor: g.gestor, permission: perm });
      }
      // Include sub-gestores as vendedores too
      for (const sub of g.subGestores) {
        const perm = permissions.find(
          p => p.sellerName.toUpperCase() === sub.name.toUpperCase() && p.gestorName.toUpperCase() === g.gestor.toUpperCase()
        );
        result.push({ name: sub.name, gestor: g.gestor, permission: perm });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [gestoresHierarchy, permissions]);

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
              key={`${v.gestor}|${v.name}`}
              onClick={() => { if (v.permission) navigate(`/gestao-comercial/vendedor/${v.permission.id}`); }}
              className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm p-4 transition-all cursor-pointer hover:shadow-md hover:border-teal-300 dark:hover:border-teal-600 ${
                v.permission?.authorized
                  ? "border-slate-200 dark:border-slate-700"
                  : "border-red-200 dark:border-red-800 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  v.permission?.authorized
                    ? "bg-gradient-to-br from-orange-300 to-orange-500"
                    : "bg-gradient-to-br from-slate-300 to-slate-400"
                }`}>
                  {v.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{v.name}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Gestor: {v.gestor}</p>
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
