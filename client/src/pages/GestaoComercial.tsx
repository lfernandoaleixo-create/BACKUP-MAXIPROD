/**
 * Gestão Comercial - Cadastro de Vendedores e Métricas de Vendas consolidadas
 * Conteúdo migrado da aba Vendas + novo painel de métricas
 * Vitória tem acesso restrito: apenas à parte de Pedidos
 */
import { useState, useMemo, useEffect } from "react";
import TopNav from "@/components/TopNav";
import CadastroVendedoresTab from "@/components/CadastroVendedoresTab";
import GestaoMetricasVendedores from "@/components/GestaoMetricasVendedores";
import { trpc } from "@/lib/trpc";
import { Users, BarChart3, ClipboardCheck, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useOperator } from "@/contexts/OperatorContext";

type GestaoView = "vendedores" | "metricas";

export default function GestaoComercial() {
  const [view, setView] = useState<GestaoView>("vendedores");
  const { operator } = useOperator();
  const [, setLocation] = useLocation();

  const isVitoria = operator?.name === "Vitoria" || operator?.name === "Vitória";

  // Auto-redirect Vitória to her Pedidos page
  useEffect(() => {
    if (isVitoria) {
      setLocation("/gestao-comercial/pedidos-operador");
    }
  }, [isVitoria, setLocation]);

  // Fetch seller list to pass to metrics component
  const representantesQuery = trpc.sales.listRepresentantesMaxiprod.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    enabled: !isVitoria,
  });

  // Extract all seller names from all gestores
  const allSellerNames = useMemo(() => {
    if (!representantesQuery.data) return [];
    const names: string[] = [];
    for (const grupo of representantesQuery.data.gestores) {
      for (const vendedor of grupo.vendedores) {
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
            Métricas de Vendas
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
        {view === "vendedores" && <CadastroVendedoresTab />}
        {view === "metricas" && (
          <GestaoMetricasVendedores sellerNames={allSellerNames} />
        )}
      </main>
    </div>
  );
}
