/**
 * Cadastro de Vendedores - Aba em Vendas
 * Gerenciamento de vendedores de rua vinculados a gestores internos.
 * Acesso restrito a Fernando e Guilherme.
 */

import React from "react";
import { Users, UserPlus, Building2 } from "lucide-react";

export default function CadastroVendedoresTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Cadastro de Vendedores</h2>
            <p className="text-sm text-slate-500">Gerencie os vendedores de rua e seus gestores internos</p>
          </div>
        </div>
      </div>

      {/* Placeholder - Área de gestores e vendedores */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <UserPlus className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Em breve</h3>
          <p className="text-sm text-slate-500 max-w-md">
            Esta área será utilizada para cadastrar vendedores de rua e vinculá-los aos gestores de vendas internos.
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
            <div className="flex items-center gap-3 p-4 bg-teal-50 rounded-lg border border-teal-100">
              <Building2 className="w-5 h-5 text-teal-600 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-teal-800">Gestores Internos</p>
                <p className="text-xs text-teal-600">Equipe do escritório</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg border border-orange-100">
              <Users className="w-5 h-5 text-orange-600 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-orange-800">Vendedores de Rua</p>
                <p className="text-xs text-orange-600">Equipe externa</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
