/**
 * App Mobile do Vendedor
 * Login com senha (primeiro nome) e visualização de estoque filtrado
 * conforme permissões configuradas pelo gestor.
 */

import React, { useState, useMemo } from "react";
import { Package, LogOut, Lock, AlertCircle, Search, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SellerSession {
  id: number;
  name: string;
  gestor: string;
  visibleProducts: string[];
}

export default function SellerApp() {
  const [session, setSession] = useState<SellerSession | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loginMutation = trpc.sales.sellerLogin.useMutation();

  const handleLogin = () => {
    if (!password.trim()) {
      setError("Digite sua senha");
      return;
    }
    setError("");
    loginMutation.mutate(
      { password: password.trim() },
      {
        onSuccess: (result) => {
          if (result.success && result.seller) {
            setSession({
              id: result.seller.id,
              name: result.seller.name,
              gestor: result.seller.gestor,
              visibleProducts: result.visibleProducts || [],
            });
          } else {
            setError(result.error || "Erro ao fazer login");
          }
        },
        onError: (err) => {
          setError(err.message || "Erro de conexão");
        },
      }
    );
  };

  const handleLogout = () => {
    setSession(null);
    setPassword("");
    setError("");
  };

  if (!session) {
    return <LoginView password={password} setPassword={setPassword} error={error} onLogin={handleLogin} isPending={loginMutation.isPending} />;
  }

  return <StockView session={session} search={search} setSearch={setSearch} onLogout={handleLogout} />;
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

function StockView({
  session,
  search,
  setSearch,
  onLogout,
}: {
  session: SellerSession;
  search: string;
  setSearch: (v: string) => void;
  onLogout: () => void;
}) {
  const stockQuery = trpc.dashboard.getData.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const items = useMemo(() => {
    if (!stockQuery.data?.items) return [];
    const visibleSet = new Set(session.visibleProducts);
    // Filtrar apenas produtos visíveis para este vendedor
    let filtered = stockQuery.data.items.filter((item: any) => visibleSet.has(item.codigoItem));
    // Aplicar busca
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter(
        (item: any) =>
          (item.codigoItem || "").toLowerCase().includes(term) ||
          (item.descricao || "").toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [stockQuery.data, session.visibleProducts, search]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-slate-800">{session.name}</h1>
            <p className="text-[10px] text-slate-400">Gestor: {session.gestor}</p>
          </div>
          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {stockQuery.isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-6 h-6 text-teal-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Carregando estoque...</p>
          </div>
        ) : session.visibleProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">Nenhum produto liberado</p>
            <p className="text-xs text-slate-400 mt-1">Aguarde seu gestor configurar os produtos visíveis.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 mb-3">{items.length} produto{items.length !== 1 ? "s" : ""}</p>
            {items.map((item: any) => {
              const isKg = item.isKgProduct || (item.descricao || "").toLowerCase().includes("kg");
              const qty = item.disponivelCx != null ? item.disponivelCx : item.disponivel || 0;
              const unit = isKg ? "kg" : "cx";
              const color = qty <= 0 ? "text-orange-500" : "text-emerald-700";
              return (
                <div
                  key={item.codigoItem}
                  className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center justify-between gap-3"
                >
                  <p className="text-sm font-medium text-slate-800 truncate flex-1 min-w-0">{item.descricao}</p>
                  <p className={`text-base font-bold ${color} whitespace-nowrap`}>
                    {qty} <span className="text-xs font-semibold">{unit}</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
