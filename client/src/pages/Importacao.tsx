/**
 * Importação - Aba de controle de importações
 * Sub-abas:
 * 1. Relação de Pagamentos com Fornecedores Chineses
 * 2. Custo da Mercadoria
 */

import { useState } from "react";
import TopNav from "@/components/TopNav";
import { Ship, Receipt, Calculator, Plus, Pencil, Trash2, X, Check, Package, ChevronDown, ChevronUp, DollarSign, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type SubTab = "pagamentos" | "custo";

export default function Importacao() {
  const [activeTab, setActiveTab] = useState<SubTab>("pagamentos");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 pb-24 md:pb-8">
      <TopNav />
      
      {/* Header */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 pb-3 sm:pb-4">
        <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6">
          <div className="p-2 sm:p-2.5 bg-blue-100 rounded-xl shrink-0">
            <Ship className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Importação</h1>
            <p className="text-xs sm:text-sm text-slate-500">Controle de pagamentos e custos de importação</p>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-1 bg-slate-100 p-1.5 sm:p-1 rounded-xl sm:w-fit">
          <button
            onClick={() => setActiveTab("pagamentos")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === "pagamentos"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
            }`}
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span className="text-left leading-tight">Pagamentos Fornecedores Chineses</span>
          </button>
          <button
            onClick={() => setActiveTab("custo")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === "custo"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
            }`}
          >
            <Calculator className="w-4 h-4 shrink-0" />
            <span className="text-left leading-tight">Custo da Mercadoria</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        {activeTab === "pagamentos" && <PagamentosFornecedores />}
        {activeTab === "custo" && <CustoMercadoria />}
      </div>
    </div>
  );
}

// ===== PAGAMENTOS FORNECEDORES =====

function PagamentosFornecedores() {
  const { data: fullData, isLoading, refetch } = trpc.import.getFullData.useQuery();
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCategory, setNewSupplierCategory] = useState("");

  const createSupplier = trpc.import.createSupplier.useMutation({
    onSuccess: () => {
      refetch();
      setShowAddSupplier(false);
      setNewSupplierName("");
      setNewSupplierCategory("");
      toast.success("Fornecedor adicionado!");
    },
    onError: () => toast.error("Erro ao adicionar fornecedor"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-48 mb-4" />
            <div className="h-32 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Calculate grand totals
  const grandTotals = (fullData || []).reduce((acc, supplier) => {
    supplier.payments.forEach(p => {
      acc.totalUsd += parseFloat(String(p.totalUsd)) || 0;
      acc.totalPago += parseFloat(String(p.totalPago)) || 0;
      acc.saldoTotal += parseFloat(String(p.saldoDevedorTotal)) || 0;
    });
    return acc;
  }, { totalUsd: 0, totalPago: 0, saldoTotal: 0 });

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500 uppercase font-medium">Total Pedidos</span>
          </div>
          <p className="text-xl font-bold text-slate-800">
            $ {grandTotals.totalUsd.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-xs text-slate-500 uppercase font-medium">Total Pago</span>
          </div>
          <p className="text-xl font-bold text-green-700">
            $ {grandTotals.totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-slate-500 uppercase font-medium">Saldo Devedor</span>
          </div>
          <p className="text-xl font-bold text-red-700">
            $ {grandTotals.saldoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Supplier Sections */}
      {(fullData || []).map(supplier => (
        <SupplierSection key={supplier.id} supplier={supplier} onRefetch={refetch} />
      ))}

      {/* Add Supplier */}
      {showAddSupplier ? (
        <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Novo Fornecedor</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Nome do fornecedor"
              value={newSupplierName}
              onChange={e => setNewSupplierName(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Categoria (ex: BAMBU, MADEIRA)"
              value={newSupplierCategory}
              onChange={e => setNewSupplierCategory(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (newSupplierName.trim()) {
                    createSupplier.mutate({ name: newSupplierName.trim(), category: newSupplierCategory.trim() || undefined });
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Salvar
              </button>
              <button
                onClick={() => setShowAddSupplier(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddSupplier(true)}
          className="w-full py-3 border-2 border-dashed border-slate-300 rounded-2xl text-sm font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar Fornecedor
        </button>
      )}
    </div>
  );
}

// ===== SUPPLIER SECTION =====

interface SupplierData {
  id: number;
  name: string;
  category: string | null;
  displayOrder: number;
  payments: Array<{
    id: number;
    supplierId: number;
    status: string;
    pedido: string;
    doc: string;
    totalUsd: string;
    halfValue: string | null;
    brasilUsd: string;
    paraguaiUsd: string;
    totalPago: string;
    saldoDevedorBrasil: string;
    saldoDevedorParaguai: string;
    saldoDevedorTotal: string;
    rastreio: string | null;
  }>;
}

function SupplierSection({ supplier, onRefetch }: { supplier: SupplierData; onRefetch: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const deleteSupplier = trpc.import.deleteSupplier.useMutation({
    onSuccess: () => { onRefetch(); toast.success("Fornecedor removido"); },
    onError: () => toast.error("Erro ao remover"),
  });

  // Totals for this supplier
  const totals = supplier.payments.reduce((acc, p) => {
    acc.totalUsd += parseFloat(String(p.totalUsd)) || 0;
    acc.totalPago += parseFloat(String(p.totalPago)) || 0;
    acc.saldoDevedorBrasil += parseFloat(String(p.saldoDevedorBrasil)) || 0;
    acc.saldoDevedorParaguai += parseFloat(String(p.saldoDevedorParaguai)) || 0;
    acc.saldoDevedorTotal += parseFloat(String(p.saldoDevedorTotal)) || 0;
    return acc;
  }, { totalUsd: 0, totalPago: 0, saldoDevedorBrasil: 0, saldoDevedorParaguai: 0, saldoDevedorTotal: 0 });

  const categoryColor = supplier.category === "BAMBU" ? "emerald" :
    supplier.category === "MADEIRA" ? "amber" :
    supplier.category === "MÁQUINAS" ? "purple" : "blue";

  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${categoryColor === "emerald" ? "bg-emerald-100" : categoryColor === "amber" ? "bg-amber-100" : categoryColor === "purple" ? "bg-purple-100" : "bg-blue-100"}`}>
            <Package className={`w-5 h-5 ${categoryColor === "emerald" ? "text-emerald-700" : categoryColor === "amber" ? "text-amber-700" : categoryColor === "purple" ? "text-purple-700" : "text-blue-700"}`} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">{supplier.name}</h3>
            {supplier.category && (
              <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${colorMap[categoryColor]}`}>
                {supplier.category}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <div className="text-right">
              <span className="text-slate-400">Total</span>
              <p className="font-semibold text-slate-700">$ {totals.totalUsd.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Pago</span>
              <p className="font-semibold text-green-600">$ {totals.totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Saldo Devedor</span>
              <p className="font-semibold text-red-600">$ {totals.saldoDevedorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </div>

      {/* Mobile totals */}
      {expanded && (
        <div className="sm:hidden grid grid-cols-3 gap-2 px-4 pb-3">
          <div className="text-center bg-slate-50 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 block">Total</span>
            <p className="text-xs font-semibold text-slate-700">$ {totals.totalUsd.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="text-center bg-green-50 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 block">Pago</span>
            <p className="text-xs font-semibold text-green-600">$ {totals.totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="text-center bg-red-50 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 block">Devedor</span>
            <p className="text-xs font-semibold text-red-600">$ {totals.saldoDevedorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {expanded && (
        <div className="border-t border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase">
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium">Pedido</th>
                  <th className="px-3 py-2.5 text-center font-medium">Doc</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total USD</th>
                  <th className="px-3 py-2.5 text-right font-medium">50%</th>
                  <th className="px-3 py-2.5 text-right font-medium">Brasil USD</th>
                  <th className="px-3 py-2.5 text-right font-medium">Paraguai USD</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total Pago</th>
                  <th className="px-3 py-2.5 text-right font-medium">Saldo BR</th>
                  <th className="px-3 py-2.5 text-right font-medium">Saldo PY</th>
                  <th className="px-3 py-2.5 text-right font-medium">Saldo Total</th>
                  <th className="px-3 py-2.5 text-left font-medium">Rastreio</th>
                  <th className="px-3 py-2.5 text-center font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {supplier.payments.map(payment => (
                  editingId === payment.id ? (
                    <EditPaymentRow key={payment.id} payment={payment} onCancel={() => setEditingId(null)} onRefetch={onRefetch} />
                  ) : (
                    <PaymentRow key={payment.id} payment={payment} onEdit={() => setEditingId(payment.id)} onRefetch={onRefetch} />
                  )
                ))}
                {supplier.payments.length === 0 && !showAddPayment && (
                  <tr>
                    <td colSpan={13} className="px-3 py-8 text-center text-slate-400 text-sm">
                      Nenhum pedido cadastrado
                    </td>
                  </tr>
                )}
                {/* Totals row */}
                {supplier.payments.length > 0 && (
                  <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                    <td className="px-3 py-2.5 text-slate-700" colSpan={3}>TOTAIS</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">$ {totals.totalUsd.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5 text-right text-green-700">$ {totals.totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5 text-right text-red-600">$ {totals.saldoDevedorBrasil.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5 text-right text-red-600">$ {totals.saldoDevedorParaguai.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5 text-right text-red-700">$ {totals.saldoDevedorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add Payment */}
          {showAddPayment ? (
            <AddPaymentForm supplierId={supplier.id} onCancel={() => setShowAddPayment(false)} onRefetch={onRefetch} />
          ) : (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setShowAddPayment(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Pedido
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remover fornecedor "${supplier.name}" e todos os seus pedidos?`)) {
                    deleteSupplier.mutate({ id: supplier.id });
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover Fornecedor
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== PAYMENT ROW =====

function PaymentRow({ payment, onEdit, onRefetch }: { payment: SupplierData["payments"][0]; onEdit: () => void; onRefetch: () => void }) {
  const deletePayment = trpc.import.deletePayment.useMutation({
    onSuccess: () => { onRefetch(); toast.success("Pedido removido"); },
    onError: () => toast.error("Erro ao remover"),
  });

  const statusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("navegando")) return "bg-blue-50 text-blue-700 border-blue-200";
    if (s.includes("produção") || s.includes("producao")) return "bg-amber-50 text-amber-700 border-amber-200";
    if (s.includes("aguardando")) return "bg-red-50 text-red-700 border-red-200";
    if (s.includes("entregue") || s.includes("finalizado")) return "bg-green-50 text-green-700 border-green-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  const fmtUsd = (v: string | null) => {
    const n = parseFloat(String(v || "0"));
    if (n === 0) return <span className="text-slate-300">-</span>;
    return `$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  const saldoColor = (v: string) => {
    const n = parseFloat(String(v));
    return n > 0 ? "text-red-600" : "text-green-600";
  };

  return (
    <tr className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
      <td className="px-3 py-2.5">
        <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-medium border whitespace-nowrap ${statusColor(payment.status)}`}>
          {payment.status}
        </span>
      </td>
      <td className="px-3 py-2.5 font-mono font-medium text-slate-700 whitespace-nowrap">{payment.pedido}</td>
      <td className="px-3 py-2.5 text-center">
        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{payment.doc}</span>
      </td>
      <td className="px-3 py-2.5 text-right font-medium text-slate-800 whitespace-nowrap">{fmtUsd(payment.totalUsd)}</td>
      <td className="px-3 py-2.5 text-right text-slate-500 whitespace-nowrap">{fmtUsd(payment.halfValue)}</td>
      <td className="px-3 py-2.5 text-right text-slate-700 whitespace-nowrap">{fmtUsd(payment.brasilUsd)}</td>
      <td className="px-3 py-2.5 text-right text-slate-700 whitespace-nowrap">{fmtUsd(payment.paraguaiUsd)}</td>
      <td className="px-3 py-2.5 text-right font-medium text-green-700 whitespace-nowrap">{fmtUsd(payment.totalPago)}</td>
      <td className={`px-3 py-2.5 text-right whitespace-nowrap ${saldoColor(payment.saldoDevedorBrasil)}`}>{fmtUsd(payment.saldoDevedorBrasil)}</td>
      <td className={`px-3 py-2.5 text-right whitespace-nowrap ${saldoColor(payment.saldoDevedorParaguai)}`}>{fmtUsd(payment.saldoDevedorParaguai)}</td>
      <td className={`px-3 py-2.5 text-right font-medium whitespace-nowrap ${saldoColor(payment.saldoDevedorTotal)}`}>{fmtUsd(payment.saldoDevedorTotal)}</td>
      <td className="px-3 py-2.5 text-slate-600 font-mono text-[10px] whitespace-nowrap">{payment.rastreio || <span className="text-slate-300">-</span>}</td>
      <td className="px-3 py-2.5 text-center">
        <div className="flex items-center justify-center gap-1">
          <button onClick={onEdit} className="p-1 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { if (confirm("Remover este pedido?")) deletePayment.mutate({ id: payment.id }); }}
            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ===== EDIT PAYMENT ROW =====

function EditPaymentRow({ payment, onCancel, onRefetch }: { payment: SupplierData["payments"][0]; onCancel: () => void; onRefetch: () => void }) {
  const [form, setForm] = useState({
    status: payment.status,
    pedido: payment.pedido,
    doc: payment.doc,
    totalUsd: String(payment.totalUsd),
    brasilUsd: String(payment.brasilUsd),
    paraguaiUsd: String(payment.paraguaiUsd),
    rastreio: payment.rastreio || "",
  });

  const updatePayment = trpc.import.updatePayment.useMutation({
    onSuccess: () => { onRefetch(); onCancel(); toast.success("Pedido atualizado!"); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  return (
    <tr className="border-t border-blue-100 bg-blue-50/30">
      <td className="px-2 py-2">
        <input value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-2 py-1 border rounded text-[11px]" />
      </td>
      <td className="px-2 py-2">
        <input value={form.pedido} onChange={e => setForm({ ...form, pedido: e.target.value })} className="w-20 px-2 py-1 border rounded text-[11px]" />
      </td>
      <td className="px-2 py-2">
        <select value={form.doc} onChange={e => setForm({ ...form, doc: e.target.value })} className="px-2 py-1 border rounded text-[11px]">
          <option value="PI">PI</option>
          <option value="CI">CI</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <input type="number" step="0.01" value={form.totalUsd} onChange={e => setForm({ ...form, totalUsd: e.target.value })} className="w-24 px-2 py-1 border rounded text-[11px] text-right" />
      </td>
      <td className="px-2 py-2 text-center text-slate-400 text-[10px]">auto</td>
      <td className="px-2 py-2">
        <input type="number" step="0.01" value={form.brasilUsd} onChange={e => setForm({ ...form, brasilUsd: e.target.value })} className="w-24 px-2 py-1 border rounded text-[11px] text-right" />
      </td>
      <td className="px-2 py-2">
        <input type="number" step="0.01" value={form.paraguaiUsd} onChange={e => setForm({ ...form, paraguaiUsd: e.target.value })} className="w-24 px-2 py-1 border rounded text-[11px] text-right" />
      </td>
      <td className="px-2 py-2 text-center text-slate-400 text-[10px]" colSpan={4}>calculado automaticamente</td>
      <td className="px-2 py-2">
        <input value={form.rastreio} onChange={e => setForm({ ...form, rastreio: e.target.value })} className="w-28 px-2 py-1 border rounded text-[11px]" placeholder="Container" />
      </td>
      <td className="px-2 py-2 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => updatePayment.mutate({ id: payment.id, ...form })}
            className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={onCancel} className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ===== ADD PAYMENT FORM =====

function AddPaymentForm({ supplierId, onCancel, onRefetch }: { supplierId: number; onCancel: () => void; onRefetch: () => void }) {
  const [form, setForm] = useState({
    status: "",
    pedido: "",
    doc: "PI",
    totalUsd: "",
    brasilUsd: "0",
    paraguaiUsd: "0",
    rastreio: "",
  });

  const createPayment = trpc.import.createPayment.useMutation({
    onSuccess: () => { onRefetch(); onCancel(); toast.success("Pedido adicionado!"); },
    onError: () => toast.error("Erro ao adicionar"),
  });

  return (
    <div className="px-4 py-4 border-t border-blue-100 bg-blue-50/20">
      <h4 className="text-xs font-semibold text-slate-700 mb-3">Novo Pedido</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-0.5">Status</label>
          <input value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} placeholder="Ex: Produção" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-0.5">Pedido</label>
          <input value={form.pedido} onChange={e => setForm({ ...form, pedido: e.target.value })} placeholder="Ex: PO062" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-0.5">Doc</label>
          <select value={form.doc} onChange={e => setForm({ ...form, doc: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none">
            <option value="PI">PI - Proforma Invoice</option>
            <option value="CI">CI - Commercial Invoice</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-0.5">Total USD</label>
          <input type="number" step="0.01" value={form.totalUsd} onChange={e => setForm({ ...form, totalUsd: e.target.value })} placeholder="0.00" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-0.5">Brasil USD</label>
          <input type="number" step="0.01" value={form.brasilUsd} onChange={e => setForm({ ...form, brasilUsd: e.target.value })} placeholder="0.00" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-0.5">Paraguai USD</label>
          <input type="number" step="0.01" value={form.paraguaiUsd} onChange={e => setForm({ ...form, paraguaiUsd: e.target.value })} placeholder="0.00" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-0.5">Rastreio</label>
          <input value={form.rastreio} onChange={e => setForm({ ...form, rastreio: e.target.value })} placeholder="Container" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (!form.status || !form.pedido || !form.totalUsd) {
              toast.error("Preencha Status, Pedido e Total USD");
              return;
            }
            createPayment.mutate({ supplierId, ...form });
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          Salvar Pedido
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ===== CUSTO MERCADORIA (placeholder) =====

function CustoMercadoria() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-8">
      <div className="flex items-center gap-2 sm:gap-3 mb-4">
        <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
        <h2 className="text-sm sm:text-lg font-semibold text-slate-800">Custo da Mercadoria</h2>
      </div>
      <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center">
        <div className="p-3 sm:p-4 bg-blue-50 rounded-full mb-3 sm:mb-4">
          <Calculator className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />
        </div>
        <p className="text-slate-500 text-xs sm:text-sm max-w-md px-2">
          Em breve: cálculo detalhado do custo de mercadoria importada, 
          incluindo frete, impostos, câmbio e demais despesas de internação.
        </p>
      </div>
    </div>
  );
}
