/**
 * Métrica de Vendas Tab
 * Aba restrita a Guilherme e Fernando dentro da página de Vendas
 */

import React from "react";
import { TrendingUp, BarChart3 } from "lucide-react";

export default function MetricaVendasTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Métrica de Vendas</h3>
            <p className="text-sm text-slate-500">Indicadores e métricas de desempenho de vendas</p>
          </div>
        </div>

        {/* Placeholder content - será preenchido conforme instruções do usuário */}
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="w-16 h-16 text-slate-300 mb-4" />
          <p className="text-lg font-medium text-slate-500">Aba em construção</p>
          <p className="text-sm text-slate-400 mt-1">O conteúdo será adicionado conforme suas instruções</p>
        </div>
      </div>
    </div>
  );
}
