/**
 * Análise Serragem/Rojão - Sub-aba do Financeiro
 * Mostra dois sub-cards (Serragem e Rojão) com layout financeiro
 * Valores zerados por enquanto - serão preenchidos via Maxiprod
 */

import React, { useState } from "react";
import { ArrowLeft, Flame, TreePine } from "lucide-react";

/* ---- Helpers ---- */
function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

/* ---- Layout de Cards Financeiros ---- */
interface FinancialData {
  vendasFaturamento: number;
  recebido: number;
  contasPagas: number;
  retiradaSocios: number;
  saidasTotal: number;
  saldoDisponivelCaixa: number;
  totalParaDivisao: number;
  totalParaDivisaoDisponivel: number;
  totalParaDivisaoAReceber: number;
}

function FinancialCardsLayout({ data, title, icon }: { data: FinancialData; title: string; icon: React.ReactNode }) {
  return (
    <div className="space-y-4">
      {/* Header do card */}
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>

      {/* Card principal: VENDAS/FATURAMENTO */}
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/30 dark:to-emerald-900/30 border border-teal-200 dark:border-teal-700 rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-wider">Vendas/Faturamento</p>
        <p className="text-2xl font-bold text-teal-900 dark:text-teal-100 mt-1">{formatCurrency(data.vendasFaturamento)}</p>
      </div>

      {/* Grid 2 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Coluna Esquerda */}
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Recebido</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-400 mt-0.5">{formatCurrency(data.recebido)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contas Pagas</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-0.5">{formatCurrency(data.contasPagas)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Retirada Sócios</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-400 mt-0.5">{formatCurrency(data.retiradaSocios)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Saídas Total</p>
            <p className="text-lg font-bold text-red-700 dark:text-red-400 mt-0.5">{formatCurrency(data.saidasTotal)}</p>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Saldo Disponível Caixa</p>
            <p className="text-lg font-bold text-blue-900 dark:text-blue-100 mt-0.5">{formatCurrency(data.saldoDisponivelCaixa)}</p>
          </div>
        </div>

        {/* Coluna Direita */}
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total para Divisão</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">{formatCurrency(data.totalParaDivisao)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total para Divisão Disponível</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{formatCurrency(data.totalParaDivisaoDisponivel)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total para Divisão à Receber</p>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-400 mt-0.5">{formatCurrency(data.totalParaDivisaoAReceber)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Componente Principal ---- */
export default function SerragemRojaoTab() {
  const [selectedView, setSelectedView] = useState<"menu" | "serragem" | "rojao">("menu");

  // Dados zerados - serão preenchidos via Maxiprod futuramente
  const emptyData: FinancialData = {
    vendasFaturamento: 0,
    recebido: 0,
    contasPagas: 0,
    retiradaSocios: 0,
    saidasTotal: 0,
    saldoDisponivelCaixa: 0,
    totalParaDivisao: 0,
    totalParaDivisaoDisponivel: 0,
    totalParaDivisaoAReceber: 0,
  };

  if (selectedView === "menu") {
    return (
      <div className="space-y-6">
        <div className="text-center py-4">
          <h3 className="text-lg md:text-2xl font-semibold text-slate-700 dark:text-slate-200">
            Selecione a análise
          </h3>
          <p className="text-xs md:text-sm text-slate-400 mt-1">Escolha entre Serragem ou Rojão</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {/* Card Serragem */}
          <button
            onClick={() => setSelectedView("serragem")}
            className="group bg-white dark:bg-slate-800 border-2 border-green-200 dark:border-green-700 rounded-2xl p-8 shadow-sm hover:shadow-lg hover:border-green-400 dark:hover:border-green-500 transition-all cursor-pointer"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TreePine className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-xl font-bold text-green-800 dark:text-green-300">Serragem</span>
              <span className="text-xs text-slate-400">Análise financeira</span>
            </div>
          </button>

          {/* Card Rojão */}
          <button
            onClick={() => setSelectedView("rojao")}
            className="group bg-white dark:bg-slate-800 border-2 border-orange-200 dark:border-orange-700 rounded-2xl p-8 shadow-sm hover:shadow-lg hover:border-orange-400 dark:hover:border-orange-500 transition-all cursor-pointer"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Flame className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-xl font-bold text-orange-800 dark:text-orange-300">Rojão</span>
              <span className="text-xs text-slate-400">Análise financeira</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botão Voltar */}
      <button
        onClick={() => setSelectedView("menu")}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar</span>
      </button>

      {/* Conteúdo */}
      {selectedView === "serragem" && (
        <FinancialCardsLayout
          data={emptyData}
          title="Serragem"
          icon={<TreePine className="w-6 h-6 text-green-600 dark:text-green-400" />}
        />
      )}
      {selectedView === "rojao" && (
        <FinancialCardsLayout
          data={emptyData}
          title="Rojão"
          icon={<Flame className="w-6 h-6 text-orange-600 dark:text-orange-400" />}
        />
      )}
    </div>
  );
}
