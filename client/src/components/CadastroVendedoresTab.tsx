/**
 * Cadastro de Vendedores - Aba em Vendas
 * Exibe gestores e vendedores de rua puxados diretamente do Maxiprod.
 * Apelido = vendedor, Representante/vendedor = gestor.
 * Cards expandíveis por gestor.
 */

import React, { useState } from "react";
import { Users, ChevronDown, ChevronRight, RefreshCw, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function CadastroVendedoresTab() {
  const [expandedGestores, setExpandedGestores] = useState<Set<string>>(new Set());

  const representantesQuery = trpc.sales.listRepresentantesMaxiprod.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 min
  });
  const utils = trpc.useUtils();

  const toggleExpanded = (gestor: string) => {
    setExpandedGestores(prev => {
      const next = new Set(prev);
      if (next.has(gestor)) {
        next.delete(gestor);
      } else {
        next.add(gestor);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (representantesQuery.data) {
      setExpandedGestores(new Set(representantesQuery.data.gestores.map((g: { gestor: string; vendedores: string[] }) => g.gestor)));
    }
  };

  const collapseAll = () => {
    setExpandedGestores(new Set());
  };

  const data = representantesQuery.data;
  const totalVendedores = data?.gestores.reduce((acc: number, g: { gestor: string; vendedores: string[] }) => acc + g.vendedores.length, 0) || 0;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-teal-100 flex items-center justify-center">
              <Users className="w-4 h-4 md:w-5 md:h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-800">Cadastro de Vendedores</h2>
              <p className="text-xs md:text-sm text-slate-500">
                Gestores e vendedores de rua — dados do Maxiprod
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                {data.gestores.length} gestor{data.gestores.length !== 1 ? "es" : ""} · {totalVendedores} vendedor{totalVendedores !== 1 ? "es" : ""}
              </span>
            )}
            <button
              onClick={() => utils.sales.listRepresentantesMaxiprod.invalidate()}
              disabled={representantesQuery.isFetching}
              className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              title="Atualizar do Maxiprod"
            >
              <RefreshCw className={`w-4 h-4 ${representantesQuery.isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Controles */}
      {data && data.gestores.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <button
            onClick={expandAll}
            className="text-xs text-teal-600 hover:text-teal-800 font-medium cursor-pointer"
          >
            Expandir todos
          </button>
          <span className="text-xs text-slate-300">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-teal-600 hover:text-teal-800 font-medium cursor-pointer"
          >
            Recolher todos
          </button>
        </div>
      )}

      {/* Loading */}
      {representantesQuery.isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <RefreshCw className="w-6 h-6 text-teal-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Buscando representantes do Maxiprod...</p>
        </div>
      )}

      {/* Error */}
      {representantesQuery.isError && (
        <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Erro ao buscar representantes</p>
              <p className="text-xs text-red-500 mt-1">{representantesQuery.error?.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Gestores com vendedores */}
      {data && data.gestores.map((grupo: { gestor: string; vendedores: string[] }) => {
        const isExpanded = expandedGestores.has(grupo.gestor);

        return (
          <div key={grupo.gestor} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Gestor header - clicável */}
            <button
              onClick={() => toggleExpanded(grupo.gestor)}
              className="w-full flex items-center justify-between p-4 md:px-6 md:py-4 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="text-slate-400">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                  {grupo.gestor.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-sm md:text-base font-semibold text-slate-800">{grupo.gestor}</p>
                  <p className="text-[10px] md:text-xs text-slate-400">
                    {grupo.vendedores.length} vendedor{grupo.vendedores.length !== 1 ? "es" : ""}
                  </p>
                </div>
              </div>
              <span className="text-xs bg-teal-100 text-teal-700 px-2.5 py-1 rounded-full font-medium">
                {grupo.vendedores.length}
              </span>
            </button>

            {/* Vendedores expandidos */}
            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50">
                <div className="divide-y divide-slate-100">
                  {grupo.vendedores.map((vendedor: string) => (
                    <div
                      key={vendedor}
                      className="flex items-center gap-3 px-6 md:px-10 py-3 hover:bg-slate-100 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-bold text-[10px]">
                        {vendedor.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm font-medium text-slate-700">{vendedor}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}


    </div>
  );
}
