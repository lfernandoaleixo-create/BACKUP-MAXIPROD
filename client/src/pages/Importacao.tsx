/**
 * Importação - Aba de controle de importações
 * Sub-abas:
 * 1. Relação de Pagamentos com Fornecedores Chineses
 * 2. Custo da Mercadoria
 */

import { useState } from "react";
import TopNav from "@/components/TopNav";
import { Ship, Receipt, Calculator, Plus, Pencil, Trash2, X, Check, Package, ChevronDown, ChevronUp, DollarSign, AlertCircle, Layers, ArrowLeftRight, RefreshCw, FileDown, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type SubTab = "pagamentos" | "custo";

export default function Importacao() {
  const [activeTab, setActiveTab] = useState<SubTab>("pagamentos");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 pb-24 md:pb-8">
      <TopNav />
      
      {/* Header */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 pt-4 sm:pt-6 pb-3 sm:pb-4">
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
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4">
        {activeTab === "pagamentos" && <PagamentosFornecedores />}
        {activeTab === "custo" && <CustoMercadoria />}
      </div>
    </div>
  );
}

// ===== PAGAMENTOS FORNECEDORES =====

function PagamentosFornecedores() {
  const { data: fullData, isLoading, refetch } = trpc.import.getFullData.useQuery();
  const { data: exchangeData } = trpc.import.getExchangeRate.useQuery();
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCategory, setNewSupplierCategory] = useState("");
  const [currency, setCurrency] = useState<"USD" | "BRL">("USD");
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const response = await fetch("/api/import/export-pdf");
      if (!response.ok) throw new Error("Erro ao gerar PDF");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
      a.download = `Importacao_Grupo_Fox_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      toast.error("Erro ao exportar PDF. Tente novamente.");
    } finally {
      setExportingPdf(false);
    }
  };

  const exchangeRate = exchangeData?.rate || 5.50;
  const convertValue = (val: number) => currency === "BRL" ? val * exchangeRate : val;
  const currencySymbol = currency === "USD" ? "$" : "R$";
  const currencyLabel = currency === "USD" ? "USD" : "BRL";

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
      {/* Toolbar: PDF Export + Currency Conversion */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-all shadow-sm bg-red-50 border-red-300 text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Exportar PDF
          </button>
          {exchangeData && (
            <span className="text-[10px] sm:text-xs text-slate-500">
              Cotação: <strong className="text-slate-700">1 USD = R$ {exchangeRate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </span>
          )}
          <button
            onClick={() => setCurrency(prev => prev === "USD" ? "BRL" : "USD")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-all shadow-sm ${
              currency === "BRL"
                ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                : "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            {currency === "USD" ? "USD → BRL" : "BRL → USD"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500 uppercase font-medium">Total Pedidos ({currencyLabel})</span>
          </div>
          <p className="text-xl font-bold text-slate-800 whitespace-nowrap">
            {currencySymbol}{"\u00A0"}{convertValue(grandTotals.totalUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-xs text-slate-500 uppercase font-medium">Total Pago ({currencyLabel})</span>
          </div>
          <p className="text-xl font-bold text-green-700 whitespace-nowrap">
            {currencySymbol}{"\u00A0"}{convertValue(grandTotals.totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-slate-500 uppercase font-medium">Saldo Devedor ({currencyLabel})</span>
          </div>
          <p className="text-xl font-bold text-red-700 whitespace-nowrap">
            {currencySymbol}{"\u00A0"}{convertValue(grandTotals.saldoTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Supplier Sections */}
      {(fullData || []).map(supplier => (
        <SupplierSection key={supplier.id} supplier={supplier} onRefetch={refetch} currency={currency} exchangeRate={exchangeRate} />
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

interface PaymentData {
  id: number;
  supplierId: number;
  sectionTitle: string | null;
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
}

interface SupplierData {
  id: number;
  name: string;
  category: string | null;
  displayOrder: number;
  payments: PaymentData[];
}

function SupplierSection({ supplier, onRefetch, currency, exchangeRate }: { supplier: SupplierData; onRefetch: () => void; currency: "USD" | "BRL"; exchangeRate: number }) {
  const convertValue = (val: number) => currency === "BRL" ? val * exchangeRate : val;
  const currencySymbol = currency === "USD" ? "$" : "R$";
  const [expanded, setExpanded] = useState(true);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionSupplierName, setNewSectionSupplierName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [emptySections, setEmptySections] = useState<string[]>([]);
  // Inline editing state for supplier card header
  const [editingHeader, setEditingHeader] = useState(false);
  const [editName, setEditName] = useState(supplier.name);
  const [editCategory, setEditCategory] = useState(supplier.category || "");

  const deleteSupplier = trpc.import.deleteSupplier.useMutation({
    onSuccess: () => { onRefetch(); toast.success("Fornecedor removido"); },
    onError: () => toast.error("Erro ao remover"),
  });

  const deleteSectionMut = trpc.import.deleteSection.useMutation({
    onSuccess: () => { onRefetch(); toast.success("Sub-seção removida"); },
    onError: () => toast.error("Erro ao remover sub-seção"),
  });

  const renameSectionMut = trpc.import.renameSection.useMutation({
    onSuccess: () => { onRefetch(); toast.success("Título atualizado"); },
    onError: () => toast.error("Erro ao renomear sub-seção"),
  });

  const updateSupplierMut = trpc.import.updateSupplier.useMutation({
    onSuccess: () => { onRefetch(); toast.success("Fornecedor atualizado"); setEditingHeader(false); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  // Group payments by sectionTitle
  const sections: { title: string | null; payments: PaymentData[] }[] = [];
  const defaultSection: PaymentData[] = [];
  const sectionMap = new Map<string, PaymentData[]>();

  supplier.payments.forEach(p => {
    if (p.sectionTitle) {
      const existing = sectionMap.get(p.sectionTitle);
      if (existing) {
        existing.push(p);
      } else {
        sectionMap.set(p.sectionTitle, [p]);
      }
    } else {
      defaultSection.push(p);
    }
  });

  // Default section first (main supplier name)
  if (defaultSection.length > 0 || sectionMap.size === 0) {
    sections.push({ title: null, payments: defaultSection });
  }
  sectionMap.forEach((payments, title) => {
    sections.push({ title, payments });
  });
  // Add empty sections that were just created
  emptySections.forEach(title => {
    if (!sectionMap.has(title)) {
      sections.push({ title, payments: [] });
    }
  });

  // Totals for this supplier (all payments)
  const totals = supplier.payments.reduce((acc, p) => {
    acc.totalUsd += parseFloat(String(p.totalUsd)) || 0;
    acc.totalPago += parseFloat(String(p.totalPago)) || 0;
    acc.saldoDevedorTotal += parseFloat(String(p.saldoDevedorTotal)) || 0;
    return acc;
  }, { totalUsd: 0, totalPago: 0, saldoDevedorTotal: 0 });

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
        className="group/header flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => !editingHeader && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${categoryColor === "emerald" ? "bg-emerald-100" : categoryColor === "amber" ? "bg-amber-100" : categoryColor === "purple" ? "bg-purple-100" : "bg-blue-100"}`}>
            <Package className={`w-5 h-5 ${categoryColor === "emerald" ? "text-emerald-700" : categoryColor === "amber" ? "text-amber-700" : categoryColor === "purple" ? "text-purple-700" : "text-blue-700"}`} />
          </div>
          <div>
            {editingHeader ? (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="px-2 py-1 border border-slate-300 rounded text-sm font-bold text-slate-800 w-32 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  autoFocus
                />
                <input
                  type="text"
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  placeholder="Categoria"
                  className="px-2 py-1 border border-slate-300 rounded text-xs text-slate-600 w-28 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  onClick={() => {
                    if (editName.trim()) {
                      updateSupplierMut.mutate({ id: supplier.id, name: editName.trim().toUpperCase(), category: editCategory.trim().toUpperCase() || undefined });
                    }
                  }}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setEditingHeader(false); setEditName(supplier.name); setEditCategory(supplier.category || ""); }}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base">{supplier.name}</h3>
                  {supplier.category && (
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${colorMap[categoryColor]}`}>
                      {supplier.category}
                    </span>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setEditingHeader(true); }}
                  className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover/header:opacity-100"
                  title="Editar título"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <div className="text-right">
              <span className="text-slate-400">Total</span>
              <p className="font-semibold text-slate-700 whitespace-nowrap">{currencySymbol}{"\u00A0"}{convertValue(totals.totalUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Pago</span>
              <p className="font-semibold text-green-600 whitespace-nowrap">{currencySymbol}{"\u00A0"}{convertValue(totals.totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Saldo Devedor</span>
              <p className="font-semibold text-red-600 whitespace-nowrap">{currencySymbol}{"\u00A0"}{convertValue(totals.saldoDevedorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
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
            <p className="text-xs font-semibold text-slate-700 whitespace-nowrap">{currencySymbol}{"\u00A0"}{convertValue(totals.totalUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="text-center bg-green-50 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 block">Pago</span>
            <p className="text-xs font-semibold text-green-600 whitespace-nowrap">{currencySymbol}{"\u00A0"}{convertValue(totals.totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="text-center bg-red-50 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 block">Devedor</span>
            <p className="text-xs font-semibold text-red-600 whitespace-nowrap">{currencySymbol}{"\u00A0"}{convertValue(totals.saldoDevedorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

      {/* Sections with tables */}
      {expanded && (
        <div className="border-t border-slate-100">
          {sections.map((section, sIdx) => (
            <SectionTable
              key={sIdx}
              sectionTitle={section.title}
              supplierName={supplier.name}
              supplierCategory={supplier.category}
              payments={section.payments}
              supplierId={supplier.id}
              editingId={editingId}
              setEditingId={setEditingId}
              onRefetch={onRefetch}
              currency={currency}
              exchangeRate={exchangeRate}
              totalSections={sections.length}
              onRemoveSection={(title) => {
                // If it's an empty local section, just remove from state
                if (emptySections.includes(title)) {
                  setEmptySections(prev => prev.filter(s => s !== title));
                } else {
                  // Has payments in DB - call deleteSection mutation
                  deleteSectionMut.mutate({ supplierId: supplier.id, sectionTitle: title });
                }
              }}
              onRenameSection={(oldTitle, newTitle) => {
                // If it's an empty local section, just rename in state
                if (emptySections.includes(oldTitle)) {
                  setEmptySections(prev => prev.map(s => s === oldTitle ? newTitle : s));
                } else {
                  // Has payments in DB - call renameSection mutation
                  renameSectionMut.mutate({ supplierId: supplier.id, oldSectionTitle: oldTitle, newSectionTitle: newTitle });
                }
              }}
            />
          ))}

          {/* Actions footer */}
          <div className="px-3 sm:px-4 py-3 border-t border-slate-100 flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => { setShowAddSection(true); setNewSectionSupplierName(supplier.name); }}
              className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Sub-seção
            </button>
            <div className="ml-auto">
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
          </div>

          {/* Add Section Form */}
          {showAddSection && (
            <div className="px-4 py-3 border-t border-purple-100 bg-purple-50/30">
              <p className="text-xs font-medium text-purple-700 mb-2">Nova Sub-seção</p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 uppercase font-medium mb-0.5 block">Título (Fornecedor)</label>
                    <input
                      type="text"
                      placeholder="Ex: Betty, Betty 1..."
                      value={newSectionSupplierName}
                      onChange={e => setNewSectionSupplierName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <span className="text-slate-400 font-bold mt-4">–</span>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 uppercase font-medium mb-0.5 block">Subtítulo (Categoria)</label>
                    <input
                      type="text"
                      placeholder="Ex: Diversos, Bambu, Plástico..."
                      value={newSectionTitle}
                      onChange={e => setNewSectionTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => {
                      const title = newSectionSupplierName.trim().toUpperCase();
                      const subtitle = newSectionTitle.trim().toUpperCase();
                      if (title && subtitle) {
                        const sectionName = `${title} – ${subtitle}`;
                        setEmptySections(prev => [...prev, sectionName]);
                        setShowAddSection(false);
                        setNewSectionTitle("");
                        setNewSectionSupplierName("");
                        toast.success(`Seção "${sectionName}" criada!`);
                      } else if (!title) {
                        toast.error("Preencha o título (fornecedor)");
                      } else {
                        toast.error("Preencha o subtítulo (categoria)");
                      }
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 whitespace-nowrap"
                  >
                    Criar Seção
                  </button>
                  <button
                    onClick={() => { setShowAddSection(false); setNewSectionTitle(""); setNewSectionSupplierName(""); }}
                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">A sub-seção aparecerá como: <strong>{newSectionSupplierName.trim().toUpperCase() || "..."} – {newSectionTitle.trim().toUpperCase() || "..."}</strong></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== SECTION TABLE (no horizontal scroll) =====

function SectionTable({
  sectionTitle,
  supplierName,
  supplierCategory,
  payments,
  supplierId,
  editingId,
  setEditingId,
  onRefetch,
  currency,
  exchangeRate,
  totalSections,
  onRemoveSection,
  onRenameSection,
}: {
  sectionTitle: string | null;
  supplierName: string;
  supplierCategory: string | null;
  payments: PaymentData[];
  supplierId: number;
  editingId: number | null;
  setEditingId: (id: number | null) => void;
  onRefetch: () => void;
  currency: "USD" | "BRL";
  exchangeRate: number;
  totalSections: number;
  onRemoveSection?: (sectionTitle: string) => void;
  onRenameSection?: (oldTitle: string, newTitle: string) => void;
}) {
  const convertValue = (val: number) => currency === "BRL" ? val * exchangeRate : val;
  const currencySymbol = currency === "USD" ? "$" : "R$";
  const [showAddRow, setShowAddRow] = useState(false);
  const [editingSectionTitle, setEditingSectionTitle] = useState(false);
  const [editSectionName, setEditSectionName] = useState("");
  const [editSectionSubtitle, setEditSectionSubtitle] = useState("");
  // Section totals
  const sectionTotals = payments.reduce((acc, p) => {
    acc.totalUsd += parseFloat(String(p.totalUsd)) || 0;
    acc.totalPago += parseFloat(String(p.totalPago)) || 0;
    acc.saldoDevedorBrasil += parseFloat(String(p.saldoDevedorBrasil)) || 0;
    acc.saldoDevedorParaguai += parseFloat(String(p.saldoDevedorParaguai)) || 0;
    acc.saldoDevedorTotal += parseFloat(String(p.saldoDevedorTotal)) || 0;
    return acc;
  }, { totalUsd: 0, totalPago: 0, saldoDevedorBrasil: 0, saldoDevedorParaguai: 0, saldoDevedorTotal: 0 });

  const displayTitle = sectionTitle || `${supplierName}${supplierCategory ? ` - ${supplierCategory}` : ""}`;

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      {/* Section title bar - only show if it's a different sub-section from the main supplier */}
      {sectionTitle && (() => {
        const parts = sectionTitle.split(/ [\u2013\u002D] /);
        const title = parts[0];
        const subtitle = parts.length > 1 ? parts.slice(1).join(" - ") : null;
        // Hide if there's only a single section (no need for sub-section header when there's only one)
        if (totalSections <= 1) return null;
        return (
          <div className="group/section bg-gradient-to-r from-slate-50 to-blue-50 px-3 sm:px-4 py-3 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 border-b border-blue-100">
            <div className="p-2 rounded-lg bg-blue-100">
              <Layers className="w-4 h-4 text-blue-700" />
            </div>
            {editingSectionTitle ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={editSectionName}
                  onChange={e => setEditSectionName(e.target.value)}
                  className="px-2 py-1 border border-slate-300 rounded text-sm font-bold text-slate-800 w-32 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Título"
                  autoFocus
                />
                <span className="text-slate-400 font-bold">–</span>
                <input
                  type="text"
                  value={editSectionSubtitle}
                  onChange={e => setEditSectionSubtitle(e.target.value)}
                  className="px-2 py-1 border border-slate-300 rounded text-xs text-slate-600 w-28 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Subtítulo"
                />
                <button
                  onClick={() => {
                    const newName = editSectionName.trim().toUpperCase();
                    const newSub = editSectionSubtitle.trim().toUpperCase();
                    if (newName) {
                      const newTitle = newSub ? `${newName} \u2013 ${newSub}` : newName;
                      if (newTitle !== sectionTitle) {
                        onRenameSection?.(sectionTitle!, newTitle);
                      }
                      setEditingSectionTitle(false);
                    }
                  }}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingSectionTitle(false)}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
                  {subtitle && (
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-emerald-50 border-emerald-200 text-emerald-700">
                      {subtitle}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setEditSectionName(title);
                    setEditSectionSubtitle(subtitle || "");
                    setEditingSectionTitle(true);
                  }}
                  className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover/section:opacity-100"
                  title="Editar título da sub-seção"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={() => {
                if (confirm(`Remover sub-seção "${sectionTitle}" e todos os seus pedidos?`)) {
                  onRemoveSection?.(sectionTitle!);
                }
              }}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition-colors border border-red-200 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remover Sub-seção
            </button>
          </div>
        );
      })()}

      {/* Table - scrollable on mobile */}
      <div className="overflow-x-auto -mx-2 px-2 pb-1">
      <table className="min-w-[950px] w-full text-[11px] border-collapse">
        <thead>
          <tr>
            <th colSpan={5} className="bg-white"></th>
            <th colSpan={3} className="bg-green-50 px-2 py-1.5 text-center font-bold text-[11px] uppercase tracking-wider text-green-700 border-b-2 border-green-400 whitespace-nowrap">O que pagou</th>
            <th colSpan={3} className="bg-red-50 px-2 py-1.5 text-center font-bold text-[11px] uppercase tracking-wider text-red-600 border-b-2 border-red-400 whitespace-nowrap">O que falta pagar</th>
            <th colSpan={2} className="bg-white"></th>
          </tr>
          <tr className="bg-slate-50 text-slate-500 uppercase text-[10px]">
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap min-w-[80px]">Status</th>
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap min-w-[70px]">Pedido</th>
            <th className="px-2 py-2 text-center font-semibold whitespace-nowrap min-w-[35px]">Doc</th>
            <th className="px-2 py-2 text-center font-semibold whitespace-nowrap min-w-[80px]">Total USD</th>
            <th className="px-2 py-2 text-center font-semibold whitespace-nowrap min-w-[65px]">50%</th>
            <th className="px-2 py-2 text-center font-semibold bg-green-50/50 whitespace-nowrap min-w-[75px]">Brasil</th>
            <th className="px-2 py-2 text-center font-semibold bg-green-50/50 whitespace-nowrap min-w-[75px]">Paraguai</th>
            <th className="px-2 py-2 text-center font-semibold bg-green-50/50 whitespace-nowrap min-w-[70px]">Total</th>
            <th className="px-2 py-2 text-center font-semibold bg-red-50/50 whitespace-nowrap min-w-[75px]">Brasil</th>
            <th className="px-2 py-2 text-center font-semibold bg-red-50/50 whitespace-nowrap min-w-[75px]">Paraguai</th>
            <th className="px-2 py-2 text-center font-semibold bg-red-50/50 whitespace-nowrap min-w-[70px]">Total</th>
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap min-w-[70px]">Rastreio</th>
            <th className="px-1 py-2 text-center font-semibold min-w-[30px]"></th>
          </tr>
        </thead>
        <tbody>
          {payments.map(payment => (
            editingId === payment.id ? (
              <EditPaymentRow key={payment.id} payment={payment} onCancel={() => setEditingId(null)} onRefetch={onRefetch} />
            ) : (
              <PaymentRow key={payment.id} payment={payment} onEdit={() => setEditingId(payment.id)} onRefetch={onRefetch} currency={currency} exchangeRate={exchangeRate} />
            )
          ))}
          {payments.length === 0 && (
            <tr>
              <td colSpan={13} className="px-3 py-8 text-center">
                <p className="text-slate-400 text-xs mb-2">Nenhum pedido nesta seção</p>
                <p className="text-[10px] text-slate-300">Use o botão "Adicionar Pedido" abaixo e selecione esta sub-seção</p>
              </td>
            </tr>
          )}
          {/* Inline add row */}
          {showAddRow && (
            <InlineAddPaymentRow
              supplierId={supplierId}
              sectionTitle={sectionTitle}
              onCancel={() => setShowAddRow(false)}
              onRefetch={onRefetch}
            />
          )}
          {/* Totals row */}
          {payments.length > 0 && (
            <tr className="bg-slate-50 font-semibold border-t border-slate-200">
              <td className="px-2 py-2 text-slate-700" colSpan={3}>TOTAIS</td>
              <td className="px-2 py-2 text-center text-slate-700 whitespace-nowrap">{currencySymbol}{"\u00A0"}{convertValue(sectionTotals.totalUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
              <td className="px-2 py-2"></td>
              <td className="px-2 py-2"></td>
              <td className="px-2 py-2"></td>
              <td className="px-2 py-2 text-center text-green-700 whitespace-nowrap">{currencySymbol}{"\u00A0"}{convertValue(sectionTotals.totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
              <td className="px-2 py-2 text-center text-red-600 whitespace-nowrap">{currencySymbol}{"\u00A0"}{convertValue(sectionTotals.saldoDevedorBrasil).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
              <td className="px-2 py-2 text-center text-red-600 whitespace-nowrap">{currencySymbol}{"\u00A0"}{convertValue(sectionTotals.saldoDevedorParaguai).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
              <td className="px-2 py-2 text-center text-red-700 whitespace-nowrap">{currencySymbol}{"\u00A0"}{convertValue(sectionTotals.saldoDevedorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
              <td className="px-2 py-2"></td>
              <td className="px-1 py-2"></td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      {/* Add button below table */}
      {!showAddRow && (
        <div className="px-4 py-2 border-t border-slate-50">
          <button
            onClick={() => setShowAddRow(true)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-green-600 hover:text-green-700 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Adicionar Pedido
          </button>
        </div>
      )}
    </div>
  );
}

// ===== PAYMENT ROW =====

function PaymentRow({ payment, onEdit, onRefetch, currency, exchangeRate }: { payment: PaymentData; onEdit: () => void; onRefetch: () => void; currency: "USD" | "BRL"; exchangeRate: number }) {
  const convertValue = (val: number) => currency === "BRL" ? val * exchangeRate : val;
  const currencySymbol = currency === "USD" ? "$" : "R$";

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
    if (n === 0) return null;
    const converted = convertValue(n);
    return <span className="whitespace-nowrap font-mono tabular-nums">{currencySymbol}{"\u00A0"}{converted.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>;
  };

  const saldoColor = (v: string) => {
    const n = parseFloat(String(v));
    return n > 0 ? "text-red-600 font-medium" : "text-green-600";
  };

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="px-2 py-2">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border leading-tight ${statusColor(payment.status)}`}>
          {payment.status}
        </span>
      </td>
      <td className="px-2 py-2 font-mono font-medium text-slate-700 text-[11px] whitespace-nowrap">{payment.pedido}</td>
      <td className="px-2 py-2 text-center">
        <span className="px-1 py-0.5 rounded bg-slate-100 text-slate-600 font-medium text-[10px]">{payment.doc}</span>
      </td>
      <td className="px-2 py-2 text-center font-medium text-slate-800 whitespace-nowrap">{fmtUsd(payment.totalUsd)}</td>
      <td className="px-2 py-2 text-center text-slate-500 whitespace-nowrap">{fmtUsd(payment.halfValue)}</td>
      <td className="px-2 py-2 text-center text-slate-700 bg-green-50/30 whitespace-nowrap">{fmtUsd(payment.brasilUsd)}</td>
      <td className="px-2 py-2 text-center text-slate-700 bg-green-50/30 whitespace-nowrap">{fmtUsd(payment.paraguaiUsd)}</td>
      <td className="px-2 py-2 text-center font-medium text-green-700 bg-green-50/30 whitespace-nowrap">{fmtUsd(payment.totalPago)}</td>
      <td className={`px-2 py-2 text-center bg-red-50/30 whitespace-nowrap ${saldoColor(payment.saldoDevedorBrasil)}`}>{fmtUsd(payment.saldoDevedorBrasil)}</td>
      <td className={`px-2 py-2 text-center bg-red-50/30 whitespace-nowrap ${saldoColor(payment.saldoDevedorParaguai)}`}>{fmtUsd(payment.saldoDevedorParaguai)}</td>
      <td className={`px-2 py-2 text-center font-medium bg-red-50/30 whitespace-nowrap ${saldoColor(payment.saldoDevedorTotal)}`}>{fmtUsd(payment.saldoDevedorTotal)}</td>
      <td className="px-2 py-2 text-slate-600 font-mono text-[10px] whitespace-nowrap">{payment.rastreio || <span className="text-slate-300">-</span>}</td>
      <td className="px-1 py-2 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <button onClick={onEdit} className="p-1 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => { if (confirm("Remover este pedido?")) deletePayment.mutate({ id: payment.id }); }}
            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ===== EDIT PAYMENT ROW (all fields manual) =====

function EditPaymentRow({ payment, onCancel, onRefetch }: { payment: PaymentData; onCancel: () => void; onRefetch: () => void }) {
  const [form, setForm] = useState({
    status: payment.status,
    pedido: payment.pedido,
    doc: payment.doc,
    totalUsd: String(payment.totalUsd),
    halfValue: String(payment.halfValue || "0"),
    brasilUsd: String(payment.brasilUsd),
    paraguaiUsd: String(payment.paraguaiUsd),
    totalPago: String(payment.totalPago),
    saldoDevedorBrasil: String(payment.saldoDevedorBrasil),
    saldoDevedorParaguai: String(payment.saldoDevedorParaguai),
    saldoDevedorTotal: String(payment.saldoDevedorTotal),
    rastreio: payment.rastreio || "",
    sectionTitle: payment.sectionTitle || "",
  });

  const updatePayment = trpc.import.updatePayment.useMutation({
    onSuccess: () => { onRefetch(); onCancel(); toast.success("Pedido atualizado!"); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const inputClass = "w-full px-1.5 py-1 border border-blue-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white";

  return (
    <tr className="border-t border-blue-100 bg-blue-50/30">
      <td className="px-1 py-1.5">
        <input value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputClass} />
      </td>
      <td className="px-1 py-1.5">
        <input value={form.pedido} onChange={e => setForm({ ...form, pedido: e.target.value })} className={inputClass} />
      </td>
      <td className="px-1 py-1.5">
        <select value={form.doc} onChange={e => setForm({ ...form, doc: e.target.value })} className={`${inputClass} text-center`}>
          <option value="PI">PI</option>
          <option value="CI">CI</option>
        </select>
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.totalUsd} onChange={e => setForm({ ...form, totalUsd: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.halfValue} onChange={e => setForm({ ...form, halfValue: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.brasilUsd} onChange={e => setForm({ ...form, brasilUsd: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.paraguaiUsd} onChange={e => setForm({ ...form, paraguaiUsd: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.totalPago} onChange={e => setForm({ ...form, totalPago: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.saldoDevedorBrasil} onChange={e => setForm({ ...form, saldoDevedorBrasil: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.saldoDevedorParaguai} onChange={e => setForm({ ...form, saldoDevedorParaguai: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.saldoDevedorTotal} onChange={e => setForm({ ...form, saldoDevedorTotal: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      <td className="px-1 py-1.5">
        <input value={form.rastreio} onChange={e => setForm({ ...form, rastreio: e.target.value })} className={inputClass} placeholder="Container" />
      </td>
      <td className="px-1 py-1.5 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <button
            onClick={() => updatePayment.mutate({ id: payment.id, ...form, sectionTitle: form.sectionTitle || undefined })}
            className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Check className="w-3 h-3" />
          </button>
          <button onClick={onCancel} className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ===== INLINE ADD PAYMENT ROW (matches table structure) =====

function InlineAddPaymentRow({ supplierId, sectionTitle, onCancel, onRefetch }: { supplierId: number; sectionTitle: string | null; onCancel: () => void; onRefetch: () => void }) {
  const [form, setForm] = useState({
    status: "",
    pedido: "",
    doc: "PI",
    totalUsd: "",
    halfValue: "",
    brasilUsd: "0",
    paraguaiUsd: "0",
    totalPago: "0",
    saldoDevedorBrasil: "0",
    saldoDevedorParaguai: "0",
    saldoDevedorTotal: "0",
    rastreio: "",
  });

  const createPayment = trpc.import.createPayment.useMutation({
    onSuccess: () => { onRefetch(); onCancel(); toast.success("Pedido adicionado!"); },
    onError: () => toast.error("Erro ao adicionar"),
  });

  const inputClass = "w-full px-1.5 py-1 border border-green-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-green-400 bg-green-50/30";

  return (
    <tr className="border-t border-green-200 bg-green-50/20 animate-pulse-once">
      <td className="px-1 py-1.5">
        <input value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputClass} placeholder="Status" autoFocus />
      </td>
      <td className="px-1 py-1.5">
        <input value={form.pedido} onChange={e => setForm({ ...form, pedido: e.target.value })} className={inputClass} placeholder="PO..." />
      </td>
      <td className="px-1 py-1.5">
        <select value={form.doc} onChange={e => setForm({ ...form, doc: e.target.value })} className={`${inputClass} text-center`}>
          <option value="PI">PI</option>
          <option value="CI">CI</option>
        </select>
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.totalUsd} onChange={e => setForm({ ...form, totalUsd: e.target.value })} className={`${inputClass} text-right`} placeholder="0.00" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.halfValue} onChange={e => setForm({ ...form, halfValue: e.target.value })} className={`${inputClass} text-right`} placeholder="0.00" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.brasilUsd} onChange={e => setForm({ ...form, brasilUsd: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.paraguaiUsd} onChange={e => setForm({ ...form, paraguaiUsd: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.totalPago} onChange={e => setForm({ ...form, totalPago: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.saldoDevedorBrasil} onChange={e => setForm({ ...form, saldoDevedorBrasil: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.saldoDevedorParaguai} onChange={e => setForm({ ...form, saldoDevedorParaguai: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.saldoDevedorTotal} onChange={e => setForm({ ...form, saldoDevedorTotal: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input value={form.rastreio} onChange={e => setForm({ ...form, rastreio: e.target.value })} className={inputClass} placeholder="Container" />
      </td>
      <td className="px-1 py-1.5 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <button
            onClick={() => {
              if (!form.status || !form.pedido || !form.totalUsd) {
                toast.error("Preencha Status, Pedido e Total USD");
                return;
              }
              createPayment.mutate({
                supplierId,
                sectionTitle: sectionTitle || undefined,
                status: form.status,
                pedido: form.pedido,
                doc: form.doc,
                totalUsd: form.totalUsd,
                halfValue: form.halfValue || undefined,
                brasilUsd: form.brasilUsd || undefined,
                paraguaiUsd: form.paraguaiUsd || undefined,
                totalPago: form.totalPago || undefined,
                saldoDevedorBrasil: form.saldoDevedorBrasil || undefined,
                saldoDevedorParaguai: form.saldoDevedorParaguai || undefined,
                saldoDevedorTotal: form.saldoDevedorTotal || undefined,
                rastreio: form.rastreio || undefined,
              });
            }}
            className="p-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
            title="Salvar"
          >
            <Check className="w-3 h-3" />
          </button>
          <button onClick={onCancel} className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors" title="Cancelar">
            <X className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
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
