/**
 * App Mobile do Vendedor
 * Login com senha (primeiro nome) e visualização de estoque filtrado
 * conforme permissões configuradas pelo gestor.
 */

import React, { useState, useMemo } from "react";
import { Package, LogOut, Lock, AlertCircle, Search, RefreshCw, FileText, FolderOpen, ShoppingCart, ClipboardList, Users, Tag, BarChart3 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import SalesOrderForm from "@/components/SalesOrderForm";

interface SellerSession {
  id: number;
  name: string;
  gestor: string;
  visibleProducts: string[];
  catalogs: { id: number; name: string; folder: string; url: string }[];
}

export default function SellerApp({ gestorMode = false }: { gestorMode?: boolean }) {
  const [session, setSession] = useState<SellerSession | null>(() => {
    // Recover session from sessionStorage (set by LoginScreen when seller logs in from main page)
    try {
      const stored = sessionStorage.getItem("sellerSession");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id && parsed.name) {
          return parsed as SellerSession;
        }
      }
    } catch {}
    return null;
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loginMutation = trpc.sales.sellerLogin.useMutation();

  // Modo gestor: acesso completo sem precisar de senha de vendedor
  const gestorSession: SellerSession = {
    id: 0,
    name: "Gestor",
    gestor: "Admin",
    visibleProducts: ["__ALL__"],
    catalogs: [],
  };

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
    if (gestorMode) {
      window.location.href = "/";
      return;
    }
    sessionStorage.removeItem("sellerSession");
    setSession(null);
    setPassword("");
    setError("");
    // Redirect back to main login
    window.location.href = "/";
  };

  // Modo gestor: pula login e mostra tudo
  if (gestorMode) {
    return <SellerMainView session={gestorSession} search={search} setSearch={setSearch} onLogout={handleLogout} gestorMode={true} />;
  }

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
  gestorMode = false,
}: {
  session: SellerSession;
  search: string;
  setSearch: (v: string) => void;
  onLogout: () => void;
  gestorMode?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"estoque" | "clientes" | "tabela_precos" | "catalogos" | "pedidos" | "metricas">("estoque");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

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

        {/* Tabs - scrollable */}
        <div className="flex overflow-x-auto border-b border-slate-100 scrollbar-hide">
          <button
            onClick={() => setActiveTab("estoque")}
            className={`flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "estoque"
                ? "text-teal-600 border-b-2 border-teal-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Estoque
          </button>
          <button
            onClick={() => setActiveTab("clientes")}
            className={`flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "clientes"
                ? "text-purple-600 border-b-2 border-purple-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Cadastro de Cliente
          </button>
          <button
            onClick={() => setActiveTab("tabela_precos")}
            className={`flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "tabela_precos"
                ? "text-amber-600 border-b-2 border-amber-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Tabela de Preços
          </button>
          <button
            onClick={() => setActiveTab("catalogos")}
            className={`flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "catalogos"
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
          <button
            onClick={() => setActiveTab("pedidos")}
            className={`flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "pedidos"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Pedidos de Venda
          </button>
          <button
            onClick={() => setActiveTab("metricas")}
            className={`flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "metricas"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Métrica de Vendas
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
      ) : activeTab === "clientes" ? (
        <ClientesTab sellerId={session.id} />
      ) : activeTab === "tabela_precos" ? (
        <TabelaPrecosTab sellerId={session.id} />
      ) : activeTab === "catalogos" ? (
        <CatalogsTab catalogs={session.catalogs} />
      ) : activeTab === "pedidos" ? (
        <OrdersTab session={session} showOrderForm={showOrderForm} setShowOrderForm={setShowOrderForm} orderSuccess={orderSuccess} setOrderSuccess={setOrderSuccess} />
      ) : activeTab === "metricas" ? (
        <MetricasTab sellerId={session.id} />
      ) : null}
    </div>
  );
}

function StockTab({ session, search }: { session: SellerSession; search: string }) {
  const stockQuery = trpc.dashboard.getData.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const items = useMemo(() => {
    if (!stockQuery.data?.items) return [];
    const showAll = session.visibleProducts.includes("__ALL__");
    const visibleSet = new Set(session.visibleProducts);
    let filtered = showAll
      ? stockQuery.data.items
      : stockQuery.data.items.filter((item: any) => visibleSet.has(item.codigoItem));
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter(
        (item: any) =>
          (item.codigoItem || "").toLowerCase().includes(term) ||
          (item.descricaoItem || "").toLowerCase().includes(term)
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
            const isKg = item.isKgProduct || (item.descricaoItem || "").toLowerCase().includes("kg");
            const qty = item.disponivelCx != null ? item.disponivelCx : item.disponivel || 0;
            const unit = isKg ? "kg" : "cx";
            const color = qty <= 0 ? "text-orange-500" : "text-emerald-700";
            return (
              <div
                key={item.codigoItem}
                className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center justify-between gap-3"
              >
                <p className="text-sm font-medium text-slate-800 truncate flex-1 min-w-0">{item.descricaoItem}</p>
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

function OrdersTab({ session, showOrderForm, setShowOrderForm, orderSuccess, setOrderSuccess }: {
  session: SellerSession;
  showOrderForm: boolean;
  setShowOrderForm: (v: boolean) => void;
  orderSuccess: boolean;
  setOrderSuccess: (v: boolean) => void;
}) {
  const ordersQuery = trpc.salesOrders.getSellerOrders.useQuery({ sellerId: session.id });

  if (showOrderForm) {
    return (
      <SalesOrderForm
        sellerId={session.id}
        onBack={() => setShowOrderForm(false)}
        onSuccess={() => {
          setShowOrderForm(false);
          setOrderSuccess(true);
          ordersQuery.refetch();
          setTimeout(() => setOrderSuccess(false), 5000);
        }}
      />
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {orderSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-emerald-600" />
          <p className="text-xs font-medium text-emerald-700">Pedido enviado com sucesso!</p>
        </div>
      )}

      <button
        onClick={() => setShowOrderForm(true)}
        className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
      >
        <ShoppingCart className="w-4 h-4" />
        Novo Pedido de Venda
      </button>

      {/* Orders list */}
      <p className="text-xs font-bold text-slate-500 uppercase">Meus Pedidos</p>

      {ordersQuery.isLoading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-400">Carregando...</p>
        </div>
      ) : !ordersQuery.data || ordersQuery.data.length === 0 ? (
        <div className="text-center py-8">
          <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Nenhum pedido ainda</p>
          <p className="text-[10px] text-slate-400 mt-1">Crie seu primeiro pedido de venda!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ordersQuery.data.map((order: any) => {
            const statusColors: Record<string, string> = {
              pendente: "bg-amber-100 text-amber-700",
              aprovado: "bg-emerald-100 text-emerald-700",
              rejeitado: "bg-red-100 text-red-700",
              processado: "bg-blue-100 text-blue-700",
            };
            const statusLabels: Record<string, string> = {
              pendente: "Aguardando Gestor",
              aprovado: "Aprovado",
              rejeitado: "Rejeitado",
              processado: "Processado",
            };
            return (
              <div key={order.id} className="bg-white rounded-xl border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">{order.razaoSocial}</p>
                    <p className="text-[10px] text-slate-400">{order.cnpjCpf}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[order.status] || "bg-slate-100 text-slate-600"}`}>
                    {statusLabels[order.status] || order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                  <p className="text-[10px] text-slate-400">
                    {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-xs font-bold text-slate-700">R$ {Number(order.totalPedido || 0).toFixed(2)}</p>
                </div>
                {order.status === "rejeitado" && order.motivoRejeicao && (
                  <div className="mt-2 bg-red-50 rounded-lg px-2 py-1.5">
                    <p className="text-[10px] text-red-600">Motivo: {order.motivoRejeicao}</p>
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

function ClientesTab({ sellerId }: { sellerId: number }) {
  const clientsQuery = trpc.salesOrders.getSellerOrders.useQuery({ sellerId });

  return (
    <div className="p-4">
      <div className="text-center py-12">
        <Users className="w-10 h-10 text-purple-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">Cadastro de Clientes</p>
        <p className="text-xs text-slate-400 mt-1">Em breve: cadastre e gerencie seus clientes aqui.</p>
      </div>
    </div>
  );
}

function TabelaPrecosTab({ sellerId }: { sellerId: number }) {
  const priceQuery = trpc.sales.getPriceTableItems.useQuery({ sellerId });

  if (priceQuery.isLoading) {
    return (
      <div className="p-4 text-center py-12">
        <RefreshCw className="w-6 h-6 text-amber-500 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Carregando tabela de preços...</p>
      </div>
    );
  }

  const items = priceQuery.data?.items || [];
  const priceTable = priceQuery.data?.priceTable;

  if (items.length === 0) {
    return (
      <div className="p-4 text-center py-12">
        <Tag className="w-10 h-10 text-amber-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">Nenhuma tabela de preços</p>
        <p className="text-xs text-slate-400 mt-1">Aguarde seu gestor configurar sua tabela de preços.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="text-xs text-slate-400 mb-3">
        {priceTable?.descricao || "Tabela de Preços"} — {items.length} produto{items.length !== 1 ? "s" : ""}
      </p>
      <div className="space-y-2">
        {items.map((item: any) => {
          const price = parseFloat(item.price || item.preco || 0);
          const maxDiscount = parseFloat(item.maxDiscount || item.descontoMaximo || 0);
          const precoMin = parseFloat(item.precoMinimo || (price * (1 - maxDiscount / 100)).toFixed(2));
          return (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-100 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{item.itemDescricao || item.productName}</p>
                  <p className="text-[10px] text-slate-400">{item.itemCodigo || item.productCode}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                <div>
                  <p className="text-[10px] text-slate-400">Preço</p>
                  <p className="text-sm font-bold text-slate-700">R$ {price.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400">Desc. Máx.</p>
                  <p className="text-sm font-bold text-amber-600">{maxDiscount}%</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Preço Mín.</p>
                  <p className="text-sm font-bold text-emerald-700">R$ {precoMin.toFixed(2)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricasTab({ sellerId }: { sellerId: number }) {
  return (
    <div className="p-4">
      <div className="text-center py-12">
        <BarChart3 className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">Métrica de Vendas</p>
        <p className="text-xs text-slate-400 mt-1">Em breve: acompanhe suas métricas de vendas aqui.</p>
      </div>
    </div>
  );
}
