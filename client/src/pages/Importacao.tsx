/**
 * Importação - Aba de controle de importações
 * Sub-abas:
 * 1. Relação de Pagamentos com Fornecedores Chineses
 * 2. Custo da Mercadoria
 */

import { useState } from "react";
import TopNav from "@/components/TopNav";
import { Ship, Receipt, Calculator } from "lucide-react";

type SubTab = "pagamentos" | "custo";

export default function Importacao() {
  const [activeTab, setActiveTab] = useState<SubTab>("pagamentos");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <TopNav />
      
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-blue-100 rounded-xl">
            <Ship className="w-6 h-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Importação</h1>
            <p className="text-sm text-slate-500">Controle de pagamentos e custos de importação</p>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("pagamentos")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "pagamentos"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Relação de Pagamentos com Fornecedores Chineses</span>
          </button>
          <button
            onClick={() => setActiveTab("custo")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "custo"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Custo da Mercadoria</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {activeTab === "pagamentos" && <PagamentosFornecedores />}
        {activeTab === "custo" && <CustoMercadoria />}
      </div>
    </div>
  );
}

function PagamentosFornecedores() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
      <div className="flex items-center gap-3 mb-4">
        <Receipt className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-slate-800">Relação de Pagamentos com Fornecedores Chineses</h2>
      </div>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 bg-blue-50 rounded-full mb-4">
          <Ship className="w-10 h-10 text-blue-400" />
        </div>
        <p className="text-slate-500 text-sm max-w-md">
          Em breve: controle de pagamentos realizados e pendentes com fornecedores chineses, 
          incluindo rastreamento de remessas e histórico de transações.
        </p>
      </div>
    </div>
  );
}

function CustoMercadoria() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
      <div className="flex items-center gap-3 mb-4">
        <Calculator className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-slate-800">Custo da Mercadoria</h2>
      </div>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 bg-blue-50 rounded-full mb-4">
          <Calculator className="w-10 h-10 text-blue-400" />
        </div>
        <p className="text-slate-500 text-sm max-w-md">
          Em breve: cálculo detalhado do custo de mercadoria importada, 
          incluindo frete, impostos, câmbio e demais despesas de internação.
        </p>
      </div>
    </div>
  );
}
