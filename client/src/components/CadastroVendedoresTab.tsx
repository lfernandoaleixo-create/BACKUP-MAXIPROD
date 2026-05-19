/**
 * Cadastro de Vendedores - Aba em Vendas
 * Gerenciamento de gestores de vendas e vendedores de rua.
 * Acesso restrito a Fernando e Guilherme.
 */

import React, { useState } from "react";
import { Users, UserPlus, Building2, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function CadastroVendedoresTab() {
  const [newManagerName, setNewManagerName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const managersQuery = trpc.sales.listSalesManagers.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.sales.createSalesManager.useMutation({
    onSuccess: () => {
      utils.sales.listSalesManagers.invalidate();
      setNewManagerName("");
      setShowAddForm(false);
      toast.success("Gestor cadastrado com sucesso!");
    },
    onError: () => toast.error("Erro ao cadastrar gestor"),
  });

  const updateMutation = trpc.sales.updateSalesManager.useMutation({
    onSuccess: () => {
      utils.sales.listSalesManagers.invalidate();
      setEditingId(null);
      toast.success("Gestor atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar gestor"),
  });

  const deleteMutation = trpc.sales.deleteSalesManager.useMutation({
    onSuccess: () => {
      utils.sales.listSalesManagers.invalidate();
      toast.success("Gestor removido!");
    },
    onError: () => toast.error("Erro ao remover gestor"),
  });

  const handleCreate = () => {
    if (newManagerName.trim().length < 2) {
      toast.error("Nome deve ter pelo menos 2 caracteres");
      return;
    }
    createMutation.mutate({ name: newManagerName.trim() });
  };

  const handleUpdate = (id: number) => {
    if (editingName.trim().length < 2) {
      toast.error("Nome deve ter pelo menos 2 caracteres");
      return;
    }
    updateMutation.mutate({ id, name: editingName.trim() });
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Tem certeza que deseja remover o gestor "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const managers = managersQuery.data || [];

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
              <p className="text-xs md:text-sm text-slate-500">Gestores internos e vendedores de rua</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gestores de Vendas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 md:w-5 md:h-5 text-teal-600" />
              <h3 className="text-sm md:text-base font-semibold text-slate-800">Gestores de Vendas</h3>
              <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                {managers.length}
              </span>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-teal-600 text-white text-xs md:text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Novo Gestor</span>
              <span className="sm:hidden">Novo</span>
            </button>
          </div>
        </div>

        {/* Formulário de novo gestor */}
        {showAddForm && (
          <div className="p-4 md:p-6 bg-teal-50 border-b border-teal-100">
            <div className="flex items-center gap-2 md:gap-3">
              <UserPlus className="w-4 h-4 text-teal-600 flex-shrink-0" />
              <input
                type="text"
                value={newManagerName}
                onChange={(e) => setNewManagerName(e.target.value)}
                placeholder="Nome do gestor..."
                className="flex-1 px-3 py-2 text-sm md:text-base border border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewManagerName(""); }}
                className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Lista de gestores */}
        <div className="divide-y divide-slate-100">
          {managersQuery.isLoading ? (
            <div className="p-6 text-center text-slate-500 text-sm">Carregando...</div>
          ) : managers.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Building2 className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">Nenhum gestor cadastrado</p>
            </div>
          ) : (
            managers.map((manager) => (
              <div
                key={manager.id}
                className="flex items-center justify-between p-4 md:px-6 md:py-4 hover:bg-slate-50 transition-colors"
              >
                {editingId === manager.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm md:text-base border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(manager.id)}
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdate(manager.id)}
                      disabled={updateMutation.isPending}
                      className="p-1.5 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-xs md:text-sm">
                        {manager.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm md:text-base font-medium text-slate-800">{manager.name}</p>
                        <p className="text-[10px] md:text-xs text-slate-400">
                          Cadastrado em {new Date(manager.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 md:gap-2">
                      <button
                        onClick={() => { setEditingId(manager.id); setEditingName(manager.name); }}
                        className="p-1.5 md:p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(manager.id, manager.name)}
                        className="p-1.5 md:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        title="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Placeholder - Vendedores de Rua (futuro) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 opacity-60">
        <div className="flex flex-col items-center justify-center text-center py-4">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-orange-400" />
          </div>
          <h3 className="text-sm md:text-base font-semibold text-slate-600 mb-1">Vendedores de Rua</h3>
          <p className="text-xs md:text-sm text-slate-400 max-w-sm">
            Em breve — cadastro de vendedores externos vinculados aos gestores acima.
          </p>
        </div>
      </div>
    </div>
  );
}
