/**
 * App Mobile do Vendedor
 * Login com senha (primeiro nome) e visualização de estoque filtrado
 * conforme permissões configuradas pelo gestor.
 */

import React, { useState, useMemo } from "react";
import { Package, LogOut, Lock, AlertCircle, Search, RefreshCw, FileText, FolderOpen } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SellerSession {
  id: number;
  name: string;
  gestor: string;
  visibleProducts: string[];
  catalogs: { id: number; name: string; folder: string; url: string }[];
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
              catalogs: (result as any).catalogs || [],
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

  return <SellerMainView session={session} search={search} setSearch={setSearch} onLogout={handleLogout} />;
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

function SellerMainView({
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
  const [activeTab, setActiveTab] = useState<"estoque" | "pdfs">("estoque");

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

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab("estoque")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "estoque"
                ? "text-teal-600 border-b-2 border-teal-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Estoque
          </button>
          <button
            onClick={() => setActiveTab("pdfs")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "pdfs"
                ? "text-rose-600 border-b-2 border-rose-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Catálogos
            {session.catalogs.length > 0 && (
              <span className="ml-1 bg-rose-100 text-rose-600 text-[10px] px-1.5 py-0.5 rounded-full">
                {session.catalogs.length}
              </span>
            )}
          </button>
        </div>

        {/* Search (only for Estoque) */}
        {activeTab === "estoque" && (
          <div className="px-4 py-3">
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
        )}
      </div>

      {/* Content */}
      {activeTab === "estoque" ? (
        <StockTab session={session} search={search} />
      ) : (
        <CatalogsTab catalogs={session.catalogs} />
      )}
    </div>
  );
}

function StockTab({ session, search }: { session: SellerSession; search: string }) {
  const stockQuery = trpc.dashboard.getData.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const items = useMemo(() => {
    if (!stockQuery.data?.items) return [];
    const visibleSet = new Set(session.visibleProducts);
    let filtered = stockQuery.data.items.filter((item: any) => visibleSet.has(item.codigoItem));
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
  );
}

function CatalogsTab({ catalogs }: { catalogs: { id: number; name: string; folder: string; url: string }[] }) {
  if (catalogs.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Nenhum catálogo disponível</p>
          <p className="text-xs text-slate-400 mt-1">Aguarde seu gestor liberar os catálogos.</p>
        </div>
      </div>
    );
  }

  // Group by folder
  const folders = Array.from(new Set(catalogs.map(c => c.folder)));

  return (
    <div className="p-4 space-y-4">
      {folders.map(folder => (
        <div key={folder}>
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="w-4 h-4 text-rose-500" />
            <h3 className="text-xs font-bold text-slate-700 uppercase">{folder}</h3>
          </div>
          <div className="space-y-2">
            {catalogs.filter(c => c.folder === folder).map(catalog => (
              <a
                key={catalog.id}
                href={catalog.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3 hover:bg-rose-50 hover:border-rose-200 transition-colors"
              >
                <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-rose-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{catalog.name}</p>
                  <p className="text-[10px] text-slate-400">Toque para abrir PDF</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
