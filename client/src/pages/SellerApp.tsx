/**
 * App Mobile do Vendedor
 * Login com senha (primeiro nome) e visualização completa
 * idêntica ao VendedorDetalhe do gestor, exceto aba Configurações.
 * 
 * Para Renato e Juvenal: após login, mostra hub com 2 cards:
 * - "Painel do Gestor" (configuração dos vendedores + aprovações)
 * - "Painel do Vendedor" (app de vendas normal)
 */

import React, { useState } from "react";
import { Package, Lock, AlertCircle, Crown, ShoppingCart, ArrowLeft, Settings, ClipboardCheck, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import VendedorDetalhe from "./VendedorDetalhe";
import { GestaoComercialFullInline } from "./GestaoComercial";

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
            const sess = {
              id: result.seller.id,
              name: result.seller.name,
              gestor: result.seller.gestor,
            };
            sessionStorage.setItem("sellerSession", JSON.stringify(sess));
            setSession(sess);
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
    sessionStorage.removeItem("sellerSession");
    setSession(null);
    setPassword("");
    setError("");
    setHubChoice(null);
    window.location.href = "/";
  };

  // Modo gestor: usa o VendedorDetalhe sem filtro de seller (mostra todos)
  if (gestorMode) {
    return <VendedorDetalhe sellerMode={true} externalSellerId={0} onLogout={handleLogout} />;
  }

  if (!session) {
    return <LoginView password={password} setPassword={setPassword} error={error} onLogin={handleLogin} isPending={loginMutation.isPending} />;
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
              className="w-full bg-white rounded-xl border-2 border-teal-200 shadow-sm p-5 hover:shadow-lg hover:border-teal-400 transition-all cursor-pointer group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors shrink-0">
                  <Crown className="w-7 h-7 text-teal-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Painel do Gestor</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Configurações dos vendedores, tabelas de preço, catálogos, comissão e aprovações de pedidos</p>
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
