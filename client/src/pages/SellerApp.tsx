/**
 * App Mobile do Vendedor
 * Login com senha (primeiro nome) e visualização completa
 * idêntica ao VendedorDetalhe do gestor, exceto aba Configurações.
 */

import React, { useState } from "react";
import { Package, Lock, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import VendedorDetalhe from "./VendedorDetalhe";

interface SellerSession {
  id: number;
  name: string;
  gestor: string;
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
    window.location.href = "/";
  };

  // Modo gestor: usa o VendedorDetalhe sem filtro de seller (mostra todos)
  if (gestorMode) {
    return <VendedorDetalhe sellerMode={true} externalSellerId={0} onLogout={handleLogout} />;
  }

  if (!session) {
    return <LoginView password={password} setPassword={setPassword} error={error} onLogin={handleLogin} isPending={loginMutation.isPending} />;
  }

  // Renderiza o VendedorDetalhe em modo vendedor (sem aba Configurações, com logout)
  return <VendedorDetalhe sellerMode={true} externalSellerId={session.id} onLogout={handleLogout} />;
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
