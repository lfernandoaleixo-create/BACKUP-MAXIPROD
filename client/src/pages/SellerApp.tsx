/**
 * App Mobile do Vendedor
 * Login com senha (primeiro nome) e visualização completa
 * idêntica ao VendedorDetalhe do gestor, exceto aba Configurações.
 * 
 * Para Renato e Juvenal: após login, mostra hub com 2 cards:
 * - "Painel do Gestor" (configuração dos vendedores + aprovações)
 * - "Painel do Vendedor" (app de vendas normal)
 */

import React, { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Package, Lock, AlertCircle, Crown, ShoppingCart, ArrowLeft, Settings, ClipboardCheck, RefreshCw, Users, ChevronRight, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import VendedorDetalhe from "./VendedorDetalhe";
import { GestaoComercialFullInline } from "./GestaoComercial";
import TopNav from "@/components/TopNav";
import { useOperator } from "@/contexts/OperatorContext";

interface SellerSession {
  id: number;
  name: string;
  gestor: string;
}

// Nomes que são gestores E vendedores ao mesmo tempo
const GESTOR_VENDEDOR_NAMES = ["RENATO LEDESMA", "JUVENAL TEIXEIRA"];

function isGestorVendedor(name: string): boolean {
  return GESTOR_VENDEDOR_NAMES.some(
    gv => gv.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase() === name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
  );
}

export default function SellerApp({ gestorMode = false }: { gestorMode?: boolean }) {
  const [session, setSession] = useState<SellerSession | null>(() => {
    // Recover session from sessionStorage (set by LoginScreen when seller logs in from main page)
    try {
      const stored = sessionStorage.getItem("sellerSession");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id && parsed.name) {
          return { id: parsed.id, name: parsed.name, gestor: parsed.gestor || "" };
        }
      }
    } catch {}
    return null;
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [hubChoice, setHubChoice] = useState<"hub" | "gestor" | "vendedor" | null>(null);
  const [multipleMatches, setMultipleMatches] = useState<{id: number; name: string; gestor: string}[] | null>(null);

  const loginMutation = trpc.sales.sellerLogin.useMutation();

  const handleLogin = (sellerId?: number) => {
    const pw = password.trim();
    if (!pw) {
      setError("Digite sua senha");
      return;
    }
    setError("");
    loginMutation.mutate(
      { password: pw, ...(sellerId ? { sellerId } : {}) },
      {
        onSuccess: (result: any) => {
          if (result.success && result.seller) {
            const sess = {
              id: result.seller.id,
              name: result.seller.name,
              gestor: result.seller.gestor,
            };
            sessionStorage.setItem("sellerSession", JSON.stringify(sess));
            setMultipleMatches(null);
            setSession(sess);
          } else if (result.multipleMatches && result.multipleMatches.length > 1) {
            setMultipleMatches(result.multipleMatches);
          } else {
            setError(result.error || "Erro ao fazer login");
          }
        },
        onError: (err) => {
          setError(err.message || "Erro de conex\u00e3o");
        },
      }
    );
  };

  const [, navigate] = useLocation();

  const handleLogout = () => {
    sessionStorage.removeItem("sellerSession");
    setSession(null);
    setPassword("");
    setError("");
    setHubChoice(null);
    navigate("/gestao-comercial");
  };

  // Modo gestor: mostra lista de todos os vendedores para Guilherme/Fernando/Bruno
  if (gestorMode) {
    return <GestorSellerPicker onLogout={handleLogout} />;
  }

  if (!session) {
    // Show seller selector when multiple sellers share the same password
    if (multipleMatches && multipleMatches.length > 1) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="text-center mb-4">
              <Users className="w-10 h-10 text-teal-600 mx-auto mb-2" />
              <h2 className="text-lg font-bold text-slate-800">Quem está acessando?</h2>
              <p className="text-xs text-slate-500 mt-1">Selecione seu nome para continuar</p>
            </div>
            <div className="space-y-2">
              {multipleMatches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => handleLogin(match.id)}
                  disabled={loginMutation.isPending}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50 transition-colors text-left cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-teal-700 font-bold text-sm">{match.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{match.name}</p>
                    {match.gestor && match.gestor !== match.name && (
                      <p className="text-[10px] text-slate-400">Gestor: {match.gestor}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => { setMultipleMatches(null); setPassword(""); }}
              className="mt-4 w-full text-center text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              ← Voltar
            </button>
          </div>
        </div>
      );
    }
    return <LoginView password={password} setPassword={setPassword} error={error} onLogin={() => handleLogin()} isPending={loginMutation.isPending} />;
  }

  // Se é Renato ou Juvenal e ainda não escolheu, mostra o hub
  if (isGestorVendedor(session.name) && hubChoice !== "vendedor" && hubChoice !== "gestor") {
    return <GestorVendedorHub session={session} onChoice={setHubChoice} onLogout={handleLogout} />;
  }

  // Se escolheu "gestor", renderiza o painel de gestão comercial inline (sem redirecionar)
  if (hubChoice === "gestor") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Header with back button */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHubChoice(null)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors text-xs font-medium cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </button>
            <div>
              <p className="text-sm font-bold text-slate-800">Painel do Gestor</p>
              <p className="text-[10px] text-slate-500">{session.name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors text-xs font-medium cursor-pointer"
          >
            Sair
          </button>
        </div>
        {/* Render the full gestor panel inline */}
        <GestaoComercialFullInline autoExpandName={session.name} />
      </div>
    );
  }

  // Renderiza o VendedorDetalhe em modo vendedor (sem aba Configurações, com logout)
  const handleBackToHub = isGestorVendedor(session.name) ? () => setHubChoice(null) : undefined;
  return (
    <VendedorDetalhe 
      sellerMode={true} 
      externalSellerId={session.id} 
      onLogout={handleBackToHub || handleLogout} 
    />
  );
}

/**
 * Hub de seleção para gestores que também são vendedores (Renato, Juvenal)
 */
function GestorVendedorHub({ 
  session, 
  onChoice, 
  onLogout 
}: { 
  session: SellerSession; 
  onChoice: (choice: "gestor" | "vendedor") => void;
  onLogout: () => void;
}) {
  // Query pending orders for this gestor
  const pendingOrdersQuery = trpc.salesOrders.listOrders.useQuery(
    { status: "pendente", gestorName: session.name },
    { staleTime: 30 * 1000, refetchInterval: 60 * 1000 }
  );
  const pendingCount = pendingOrdersQuery.data?.length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
            <span className="text-teal-700 font-bold text-sm">{session.name.charAt(0)}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">{session.name}</p>
            <p className="text-[10px] text-slate-500">Gestor + Vendedor</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors text-xs font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Sair
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-800">Olá, {session.name.split(" ")[0]}!</h1>
            <p className="text-sm text-slate-500 mt-1">Selecione o painel que deseja acessar</p>
          </div>

          <div className="space-y-4">
            {/* Card: Painel do Gestor */}
            <button
              onClick={() => onChoice("gestor")}
              className={`w-full rounded-xl border-2 shadow-sm p-5 hover:shadow-lg transition-all cursor-pointer group text-left relative overflow-hidden ${
                pendingCount > 0
                  ? "border-red-400 shadow-lg shadow-red-200 animate-[blink-approval_2s_ease-in-out_infinite]"
                  : "bg-white border-teal-200 hover:border-teal-400"
              }`}
            >
              {pendingCount > 0 && (
                <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-bounce">
                  {pendingCount}
                </div>
              )}
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                  pendingCount > 0
                    ? "bg-red-50 group-hover:bg-red-100"
                    : "bg-teal-50 group-hover:bg-teal-100"
                }`}>
                  <Crown className={`w-7 h-7 ${pendingCount > 0 ? "text-red-600" : "text-teal-600"}`} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Painel do Gestor</h3>
                  <p className={`text-xs mt-0.5 ${pendingCount > 0 ? "text-red-500 font-semibold" : "text-slate-500"}`}>
                    {pendingCount > 0
                      ? `${pendingCount} pedido${pendingCount > 1 ? 's' : ''} aguardando aprovação!`
                      : "Configurações dos vendedores, tabelas de preço, catálogos, comissão e aprovações de pedidos"
                    }
                  </p>
                </div>
              </div>
            </button>

            {/* Card: Painel do Vendedor */}
            <button
              onClick={() => onChoice("vendedor")}
              className="w-full bg-white rounded-xl border-2 border-blue-200 shadow-sm p-5 hover:shadow-lg hover:border-blue-400 transition-all cursor-pointer group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors shrink-0">
                  <ShoppingCart className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Painel do Vendedor</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Estoque, cadastro de clientes, pedidos de venda e catálogos</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginView({
  password,
  setPassword,
  error,
  onLogin,
  isPending,
}: {
  password: string;
  setPassword: (v: string) => void;
  error: string;
  onLogin: () => void;
  isPending: boolean;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-600 to-teal-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-teal-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Grupo Fox</h1>
          <p className="text-sm text-slate-500 mt-1">Acesso do Vendedor</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onLogin()}
                placeholder="Digite sua senha"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs">{error}</p>
            </div>
          )}

          <button
            onClick={onLogin}
            disabled={isPending}
            className="w-full py-3 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "Entrando..." : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// GESTOR SELLER PICKER - Lista todos os vendedores para super-admins
// (Guilherme, Fernando, Bruno) acessarem qualquer vendedor
// ============================================================
function GestorSellerPicker({ onLogout }: { onLogout: () => void }) {
  const [selectedSellerId, setSelectedSellerId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const permissionsQuery = trpc.sales.listSellerPermissions.useQuery(undefined, {
    staleTime: 30 * 1000,
  });

  const { hasGranularAccess, operator, granularPermissions } = useOperator();

  const sellers = useMemo(() => {
    if (!permissionsQuery.data) return [];
    // STRICT: Only show sellers that are EXPLICITLY enabled via gc.verVendedor.{slug}
    // No fallbacks - only what is ticked is visible
    return permissionsQuery.data
      .filter(s => {
        const slug = s.sellerName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
        return hasGranularAccess(`gc.verVendedor.${slug}`);
      })
      .sort((a, b) => a.sellerName.localeCompare(b.sellerName, 'pt-BR'));
  }, [permissionsQuery.data, operator, hasGranularAccess, granularPermissions]);

  const filteredSellers = useMemo(() => {
    if (!searchTerm.trim()) return sellers;
    const term = searchTerm.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return sellers.filter(s => 
      s.sellerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(term) ||
      s.gestorName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(term)
    );
  }, [sellers, searchTerm]);

  // Se um vendedor foi selecionado, mostra o VendedorDetalhe dele
  if (selectedSellerId !== null) {
    return (
      <VendedorDetalhe
        sellerMode={true}
        externalSellerId={selectedSellerId}
        onLogout={() => setSelectedSellerId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <TopNav />
      <main className="container py-4 md:py-6 space-y-4 pb-20 md:pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
          <Link href="/gestao-comercial" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-white">Painel dos Vendedores</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sellers.length} vendedores cadastrados · {sellers.filter(s => s.authorized).length} autorizados
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar vendedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* Sellers list */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {permissionsQuery.isLoading ? (
            <div className="p-6 text-center">
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Carregando vendedores...</p>
            </div>
          ) : filteredSellers.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500">Nenhum vendedor encontrado.</p>
            </div>
          ) : (
            <div>
              {filteredSellers.map((seller, idx) => (
                <button
                  key={seller.id}
                  onClick={() => setSelectedSellerId(seller.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left ${
                    idx > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                    seller.authorized
                      ? "bg-gradient-to-br from-blue-400 to-blue-600"
                      : "bg-gradient-to-br from-slate-300 to-slate-400"
                  }`}>
                    {seller.sellerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                      {seller.sellerName}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Gestor: {seller.gestorName} · {seller.authorized ? "Autorizado" : "Bloqueado"}
                      {seller.priceTableCode ? ` · Tab. ${seller.priceTableCode}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {seller.authorized ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
