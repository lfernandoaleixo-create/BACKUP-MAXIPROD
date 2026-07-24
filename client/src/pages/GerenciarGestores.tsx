import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import TopNav from "@/components/TopNav";
import {
  ArrowLeft, Crown, Plus, Edit2, Trash2, Check, X, Users, UserPlus, ChevronDown, ChevronRight,
} from "lucide-react";

interface SalesManager {
  id: number;
  name: string;
  role: string;
  parentManagerId: number | null;
  maxiprodName: string | null;
  active: boolean;
}

export default function GerenciarGestores() {
  const managersQuery = trpc.sales.listSalesManagers.useQuery();
  const createMutation = trpc.sales.createSalesManager.useMutation({
    onSuccess: () => managersQuery.refetch(),
  });
  const updateMutation = trpc.sales.updateSalesManager.useMutation({
    onSuccess: () => managersQuery.refetch(),
  });
  const deleteMutation = trpc.sales.deleteSalesManager.useMutation({
    onSuccess: () => managersQuery.refetch(),
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<"gestor" | "sub-gestor">("gestor");
  const [formParentId, setFormParentId] = useState<number | null>(null);
  const [formMaxiprodName, setFormMaxiprodName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const managers: SalesManager[] = (managersQuery.data || []) as SalesManager[];
  const gestores = managers.filter(m => m.role === "gestor" && m.active);

  const handleAdd = () => {
    if (!formName.trim()) return;
    createMutation.mutate({
      name: formName.trim(),
      role: formRole,
      parentManagerId: formRole === "sub-gestor" ? formParentId : null,
      maxiprodName: formMaxiprodName.trim() || null,
    });
    resetForm();
  };

  const handleUpdate = (id: number) => {
    if (!formName.trim()) return;
    updateMutation.mutate({
      id,
      name: formName.trim(),
      role: formRole,
      parentManagerId: formRole === "sub-gestor" ? formParentId : null,
      maxiprodName: formMaxiprodName.trim() || null,
    });
    setEditingId(null);
    resetForm();
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id });
    setConfirmDeleteId(null);
  };

  const startEdit = (m: SalesManager) => {
    setEditingId(m.id);
    setFormName(m.name);
    setFormRole(m.role as "gestor" | "sub-gestor");
    setFormParentId(m.parentManagerId);
    setFormMaxiprodName(m.maxiprodName || "");
    setShowAddForm(false);
  };

  const resetForm = () => {
    setFormName("");
    setFormRole("gestor");
    setFormParentId(null);
    setFormMaxiprodName("");
    setShowAddForm(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <TopNav />
      <main className="container py-4 md:py-6 space-y-4 md:space-y-5 pb-20 md:pb-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-1.5 flex-wrap">
          <Link href="/gestao-comercial">
            <button className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white shadow-sm">
            <Crown className="w-4 h-4" />
            Gerenciar Gestores
          </div>
          <div className="flex-1" />
          <button
            onClick={() => { setShowAddForm(true); setEditingId(null); resetForm(); setShowAddForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Gestor
          </button>
        </div>

        {/* Info */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
          <p className="text-sm text-purple-800 dark:text-purple-200">
            <strong>Gestores</strong> gerenciam vendedores e aparecem no Painel dos Gestores. <strong>Sub-gestores</strong> são vinculados a um gestor pai e podem ter seus próprios vendedores.
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-300 mt-2">
            Ao cadastrar um novo gestor/sub-gestor, ele aparecerá automaticamente nas permissões granulares (Configurações → expandir operador → Gestão Comercial → "Ver [Nome]").
          </p>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-teal-200 dark:border-teal-700 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-teal-600" />
              Novo Gestor / Sub-gestor
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Nome</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Tipo</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as "gestor" | "sub-gestor")}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="gestor">Gestor</option>
                  <option value="sub-gestor">Sub-gestor</option>
                </select>
              </div>
              {formRole === "sub-gestor" && (
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Gestor Pai</label>
                  <select
                    value={formParentId || ""}
                    onChange={(e) => setFormParentId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    <option value="">Selecione...</option>
                    {gestores.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Nome no Maxiprod (opcional)</label>
                <input
                  type="text"
                  value={formMaxiprodName}
                  onChange={(e) => setFormMaxiprodName(e.target.value)}
                  placeholder="Ex: JOÃO SILVA"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={resetForm}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={!formName.trim() || createMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Salvar
              </button>
            </div>
          </div>
        )}

        {/* Managers List */}
        <div className="space-y-3">
          {managersQuery.isLoading && (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-500">Carregando gestores...</p>
            </div>
          )}
          {managers.filter(m => m.active).map((manager) => {
            const isEditing = editingId === manager.id;
            const children = managers.filter(m => m.parentManagerId === manager.id && m.active);
            const parentName = manager.parentManagerId ? managers.find(m => m.id === manager.parentManagerId)?.name : null;

            return (
              <div key={manager.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                {isEditing ? (
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Nome</label>
                        <input
                          type="text"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Tipo</label>
                        <select
                          value={formRole}
                          onChange={(e) => setFormRole(e.target.value as "gestor" | "sub-gestor")}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                        >
                          <option value="gestor">Gestor</option>
                          <option value="sub-gestor">Sub-gestor</option>
                        </select>
                      </div>
                      {formRole === "sub-gestor" && (
                        <div>
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Gestor Pai</label>
                          <select
                            value={formParentId || ""}
                            onChange={(e) => setFormParentId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                          >
                            <option value="">Selecione...</option>
                            {gestores.filter(g => g.id !== manager.id).map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Nome no Maxiprod</label>
                        <input
                          type="text"
                          value={formMaxiprodName}
                          onChange={(e) => setFormMaxiprodName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditingId(null); resetForm(); }} className="px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleUpdate(manager.id)}
                        disabled={!formName.trim()}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      manager.role === "gestor" 
                        ? "bg-gradient-to-br from-teal-400 to-teal-600" 
                        : "bg-gradient-to-br from-blue-400 to-blue-600"
                    }`}>
                      <Crown className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{manager.name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          manager.role === "gestor"
                            ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        }`}>
                          {manager.role === "gestor" ? "GESTOR" : "SUB-GESTOR"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {parentName && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">Gestor pai: {parentName}</span>
                        )}
                        {manager.maxiprodName && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">· Maxiprod: {manager.maxiprodName}</span>
                        )}
                        {children.length > 0 && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">· {children.length} sub-gestor{children.length > 1 ? "es" : ""}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(manager)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {confirmDeleteId === manager.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(manager.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg cursor-pointer">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(manager.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {/* Inactive managers */}
          {managers.filter(m => !m.active).length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Inativos</h3>
              {managers.filter(m => !m.active).map(manager => (
                <div key={manager.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex items-center gap-3 opacity-60 mb-2">
                  <Crown className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-500 dark:text-slate-400 flex-1">{manager.name}</span>
                  <button
                    onClick={() => updateMutation.mutate({ id: manager.id, active: true })}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer"
                  >
                    Reativar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
