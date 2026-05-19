/**
 * Cadastro de Vendedores - Aba em Vendas
 * Gerenciamento de gestores de vendas e vendedores de rua.
 * Acesso restrito a Fernando e Guilherme.
 */

import React, { useState } from "react";
import { Users, UserPlus, Building2, Pencil, Trash2, Check, X, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function CadastroVendedoresTab() {
  const [newManagerName, setNewManagerName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Vendedores de rua state
  const [expandedManagers, setExpandedManagers] = useState<Set<number>>(new Set());
  const [addingSellerForManager, setAddingSellerForManager] = useState<number | null>(null);
  const [newSellerName, setNewSellerName] = useState("");
  const [editingSellerId, setEditingSellerId] = useState<number | null>(null);
  const [editingSellerName, setEditingSellerName] = useState("");

  const managersQuery = trpc.sales.listSalesManagers.useQuery();
  const sellersQuery = trpc.sales.listFieldSellers.useQuery();
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
      utils.sales.listFieldSellers.invalidate();
      toast.success("Gestor removido!");
    },
    onError: () => toast.error("Erro ao remover gestor"),
  });

  // Vendedores mutations
  const createSellerMutation = trpc.sales.createFieldSeller.useMutation({
    onSuccess: () => {
      utils.sales.listFieldSellers.invalidate();
      setNewSellerName("");
      setAddingSellerForManager(null);
      toast.success("Vendedor cadastrado com sucesso!");
    },
    onError: () => toast.error("Erro ao cadastrar vendedor"),
  });

  const updateSellerMutation = trpc.sales.updateFieldSeller.useMutation({
    onSuccess: () => {
      utils.sales.listFieldSellers.invalidate();
      setEditingSellerId(null);
      toast.success("Vendedor atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar vendedor"),
  });

  const deleteSellerMutation = trpc.sales.deleteFieldSeller.useMutation({
    onSuccess: () => {
      utils.sales.listFieldSellers.invalidate();
      toast.success("Vendedor removido!");
    },
    onError: () => toast.error("Erro ao remover vendedor"),
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
    const sellersForManager = sellers.filter(s => s.managerId === id);
    const msg = sellersForManager.length > 0
      ? `Tem certeza que deseja remover o gestor "${name}" e seus ${sellersForManager.length} vendedor(es)?`
      : `Tem certeza que deseja remover o gestor "${name}"?`;
    if (confirm(msg)) {
      deleteMutation.mutate({ id });
    }
  };

  const handleCreateSeller = (managerId: number) => {
    if (newSellerName.trim().length < 2) {
      toast.error("Nome deve ter pelo menos 2 caracteres");
      return;
    }
    createSellerMutation.mutate({ name: newSellerName.trim(), managerId });
  };

  const handleUpdateSeller = (id: number) => {
    if (editingSellerName.trim().length < 2) {
      toast.error("Nome deve ter pelo menos 2 caracteres");
      return;
    }
    updateSellerMutation.mutate({ id, name: editingSellerName.trim() });
  };

  const handleDeleteSeller = (id: number, name: string) => {
    if (confirm(`Tem certeza que deseja remover o vendedor "${name}"?`)) {
      deleteSellerMutation.mutate({ id });
    }
  };

  const toggleExpanded = (managerId: number) => {
    setExpandedManagers(prev => {
      const next = new Set(prev);
      if (next.has(managerId)) {
        next.delete(managerId);
      } else {
        next.add(managerId);
      }
      return next;
    });
  };

  const managers = managersQuery.data || [];
  const sellers = sellersQuery.data || [];

  // Agrupar vendedores por gestor
  const sellersByManager = (managerId: number) => sellers.filter(s => s.managerId === managerId);

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
          <div className="text-right">
            <p className="text-xs text-slate-400">
              {managers.length} gestor{managers.length !== 1 ? "es" : ""} · {sellers.length} vendedor{sellers.length !== 1 ? "es" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Gestores de Vendas + Vendedores de Rua */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 md:w-5 md:h-5 text-teal-600" />
              <h3 className="text-sm md:text-base font-semibold text-slate-800">Gestores e Vendedores</h3>
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

        {/* Lista de gestores com vendedores */}
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
            managers.map((manager) => {
              const managerSellers = sellersByManager(manager.id);
              const isExpanded = expandedManagers.has(manager.id);

              return (
                <div key={manager.id}>
                  {/* Gestor row */}
                  <div className="flex items-center justify-between p-4 md:px-6 md:py-4 hover:bg-slate-50 transition-colors">
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
                        <div
                          className="flex items-center gap-3 cursor-pointer flex-1"
                          onClick={() => toggleExpanded(manager.id)}
                        >
                          <button className="p-0.5 text-slate-400 hover:text-slate-600">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-xs md:text-sm">
                            {manager.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm md:text-base font-medium text-slate-800">{manager.name}</p>
                            <p className="text-[10px] md:text-xs text-slate-400">
                              {managerSellers.length} vendedor{managerSellers.length !== 1 ? "es" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2">
                          <button
                            onClick={() => { setAddingSellerForManager(manager.id); setExpandedManagers(prev => new Set(prev).add(manager.id)); }}
                            className="p-1.5 md:p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors cursor-pointer"
                            title="Adicionar vendedor"
                          >
                            <UserPlus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => { setEditingId(manager.id); setEditingName(manager.name); }}
                            className="p-1.5 md:p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors cursor-pointer"
                            title="Editar gestor"
                          >
                            <Pencil className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(manager.id, manager.name)}
                            className="p-1.5 md:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            title="Remover gestor"
                          >
                            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Vendedores expandidos */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-100">
                      {/* Formulário de novo vendedor */}
                      {addingSellerForManager === manager.id && (
                        <div className="px-6 md:px-10 py-3 bg-orange-50 border-b border-orange-100">
                          <div className="flex items-center gap-2 md:gap-3">
                            <UserPlus className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                            <input
                              type="text"
                              value={newSellerName}
                              onChange={(e) => setNewSellerName(e.target.value)}
                              placeholder="Nome do vendedor..."
                              className="flex-1 px-3 py-1.5 text-sm border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                              onKeyDown={(e) => e.key === "Enter" && handleCreateSeller(manager.id)}
                              autoFocus
                            />
                            <button
                              onClick={() => handleCreateSeller(manager.id)}
                              disabled={createSellerMutation.isPending}
                              className="p-1.5 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setAddingSellerForManager(null); setNewSellerName(""); }}
                              className="p-1.5 bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Lista de vendedores */}
                      {managerSellers.length === 0 && addingSellerForManager !== manager.id ? (
                        <div className="px-6 md:px-10 py-4 text-center">
                          <p className="text-xs text-slate-400">Nenhum vendedor cadastrado para este gestor</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {managerSellers.map((seller) => (
                            <div
                              key={seller.id}
                              className="flex items-center justify-between px-6 md:px-10 py-3 hover:bg-slate-100 transition-colors"
                            >
                              {editingSellerId === seller.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <input
                                    type="text"
                                    value={editingSellerName}
                                    onChange={(e) => setEditingSellerName(e.target.value)}
                                    className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                    onKeyDown={(e) => e.key === "Enter" && handleUpdateSeller(seller.id)}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleUpdateSeller(seller.id)}
                                    disabled={updateSellerMutation.isPending}
                                    className="p-1.5 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50 cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingSellerId(null)}
                                    className="p-1.5 bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300 transition-colors cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-bold text-[10px]">
                                      {seller.name.charAt(0).toUpperCase()}
                                    </div>
                                    <p className="text-sm font-medium text-slate-700">{seller.name}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => { setEditingSellerId(seller.id); setEditingSellerName(seller.name); }}
                                      className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors cursor-pointer"
                                      title="Editar vendedor"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSeller(seller.id, seller.name)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                      title="Remover vendedor"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
