/**
 * Importação - Aba de controle de importações
 * Sub-abas:
 * 1. Relação de Pagamentos com Fornecedores Chineses
 * 2. Custo da Mercadoria
 * 
 * REGRA: TODOS os campos são 100% manuais. NENHUM auto-cálculo.
 * Larissa pode atualizar qualquer campo a qualquer momento e salvar.
 */

import { useState } from "react";
import TopNav from "@/components/TopNav";
import { Ship, Receipt, Calculator, Plus, Pencil, Trash2, X, Check, Package, ChevronDown, ChevronUp, DollarSign, AlertCircle, Layers, ArrowLeftRight, RefreshCw, FileDown, Loader2, Bell, XCircle, Navigation, Settings, Search, MapPin, FileText, ArrowUpDown } from "lucide-react";
import { TrackingModal } from "@/components/TrackingModal";
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
  const { data: activeAlerts, refetch: refetchAlerts } = trpc.import.getActiveAlerts.useQuery();
  const dismissAlert = trpc.import.dismissAlert.useMutation({
    onSuccess: () => { refetchAlerts(); toast.success("Alerta dispensado"); },
    onError: () => toast.error("Erro ao dispensar alerta"),
  });
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCategory, setNewSupplierCategory] = useState("");
  const [currency, setCurrency] = useState<"USD" | "BRL">("USD");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [trackingUuid, setTrackingUuid] = useState<string | null>(null);
  const [trackingBl, setTrackingBl] = useState<string | null>(null);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const params = new URLSearchParams({ currency, rate: String(exchangeRate) });
      const response = await fetch(`/api/import/export-pdf?${params}`);
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
    supplier.payments.forEach((p: any) => {
      acc.totalUsd += parseFloat(String(p.totalUsd)) || 0;
      acc.totalPago += parseFloat(String(p.totalPago)) || 0;
      acc.saldoTotal += parseFloat(String(p.saldoDevedorTotal)) || 0;
    });
    return acc;
  }, { totalUsd: 0, totalPago: 0, saldoTotal: 0 });

  return (
    <div className="space-y-4">
      {/* Sticky: Toolbar + Summary Cards */}
      <div className="sticky top-0 z-30 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm -mx-4 px-4 pt-2 pb-3 space-y-3 border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm">
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
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 ${
            currency === "USD"
              ? "bg-blue-100 border-blue-400 text-blue-800"
              : "bg-green-100 border-green-400 text-green-800"
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              currency === "USD" ? "bg-blue-500" : "bg-green-500"
            }`}></span>
            {currency === "USD" ? "DÓLAR (USD)" : "REAL (BRL)"}
          </div>
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
      </div>

      {/* Payment Alert Cards (Winnie - Harbin) */}
      {activeAlerts && activeAlerts.length > 0 && (
        <div className="space-y-2">
          {activeAlerts.map((alert) => (
            <div key={alert.id} className="relative bg-red-50 border-2 border-red-400 rounded-xl p-4 shadow-md animate-pulse-subtle">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-100 rounded-full shrink-0">
                  <Bell className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-red-800">ALERTA DE PAGAMENTO</h4>
                    <span className="px-2 py-0.5 bg-red-200 text-red-800 rounded-full text-[10px] font-bold">
                      {alert.daysRemaining <= 0 ? "VENCIDO" : `${alert.daysRemaining} dia${alert.daysRemaining !== 1 ? 's' : ''} restante${alert.daysRemaining !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <p className="text-xs text-red-700 mb-1">
                    <strong>{alert.supplierName}</strong>{alert.sectionTitle ? ` - ${alert.sectionTitle}` : ''} | Pedido: <strong>{alert.pedido}</strong>
                  </p>
                  <p className="text-xs text-red-600">
                    Data de chegada: <strong>{alert.arrivalDate}</strong> | Alerta configurado: <strong>{alert.alertDaysBefore} dias antes</strong> | Saldo devedor: <strong>$ {parseFloat(alert.saldoDevedorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </p>
                </div>
                <button
                  onClick={() => dismissAlert.mutate({ id: alert.id })}
                  className="shrink-0 p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-800 transition-colors"
                  title="Dispensar alerta (não apaga dados)"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supplier Sections */}
      {(fullData || []).map((supplier: any) => (
        <SupplierSection key={supplier.id} supplier={supplier} onRefetch={refetch} currency={currency} exchangeRate={exchangeRate} onTrack={(uuid) => setTrackingUuid(uuid)} onTrackBl={(bl) => setTrackingBl(bl)} />
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
                    createSupplier.mutate({ name: newSupplierName.trim(), category: newSupplierCategory.trim() || undefined, context: 'pagamentos' as const });
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

      {/* Tracking Modal */}
      {(trackingUuid || trackingBl) && (
        <TrackingModal trackingUuid={trackingUuid} blNumber={trackingBl} onClose={() => { setTrackingUuid(null); setTrackingBl(null); }} />
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
  blNumber: string | null;
  totalUsd: string;
  totalBrasilUsd: string;
  totalParaguaiUsd: string;
  brasilUsd: string;
  paraguaiUsd: string;
  totalPago: string;
  saldoDevedorBrasil: string;
  saldoDevedorParaguai: string;
  saldoDevedorTotal: string;
  rastreio: string | null;
  trackingUuid: string | null;
  arrivalDate: string | null;
  alertDaysBefore: number | null;
  alertDismissed: boolean;
}

interface SupplierData {
  id: number;
  name: string;
  category: string | null;
  displayOrder: number;
  payments: PaymentData[];
}

function SupplierSection({ supplier, onRefetch, currency, exchangeRate, onTrack, onTrackBl }: { supplier: SupplierData; onRefetch: () => void; currency: "USD" | "BRL"; exchangeRate: number; onTrack: (uuid: string) => void; onTrackBl: (bl: string) => void }) {
  const convertValue = (val: number) => currency === "BRL" ? val * exchangeRate : val;
  const currencySymbol = currency === "USD" ? "$" : "R$";
  const [expanded, setExpanded] = useState(false);
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
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border-2 ${
            currency === "USD"
              ? "bg-blue-100 border-blue-400 text-blue-800"
              : "bg-green-100 border-green-400 text-green-800"
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${currency === "USD" ? "bg-blue-500" : "bg-green-500"}`}></span>
            {currency === "USD" ? "DÓLAR (USD)" : "REAL (BRL)"}
          </div>
          <div className="hidden sm:flex items-center gap-0 text-xs">
            <div className="text-right w-[140px]">
              <span className="text-slate-400">Total</span>
              <p className="font-semibold text-slate-700 whitespace-nowrap">{currencySymbol}{"\u00A0"}{convertValue(totals.totalUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right w-[120px]">
              <span className="text-slate-400">Pago</span>
              <p className="font-semibold text-green-600 whitespace-nowrap">{currencySymbol}{"\u00A0"}{convertValue(totals.totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right w-[140px]">
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
              isWinnie={supplier.name.toUpperCase().includes("WINNIE")}
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
              onTrack={onTrack}
              onTrackBl={onTrackBl}
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

// ===== SECTION TABLE =====

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
  onTrack,
  onTrackBl,
  isWinnie = false,
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
  onTrack?: (uuid: string) => void;
  onTrackBl?: (bl: string) => void;
  isWinnie?: boolean;
}) {
  const convertValue = (val: number) => currency === "BRL" ? val * exchangeRate : val;
  const currencySymbol = currency === "USD" ? "$" : "R$";
  const [showAddRow, setShowAddRow] = useState(false);
  const [editingSectionTitle, setEditingSectionTitle] = useState(false);
  const [editSectionName, setEditSectionName] = useState("");
  const [editSectionSubtitle, setEditSectionSubtitle] = useState("");

  // Section totals (all manual values, just summed for display)
  const sectionTotals = payments.reduce((acc, p) => {
    acc.totalUsd += parseFloat(String(p.totalUsd)) || 0;
    acc.totalBrasilUsd += parseFloat(String(p.totalBrasilUsd)) || 0;
    acc.totalParaguaiUsd += parseFloat(String(p.totalParaguaiUsd)) || 0;
    acc.brasilUsd += parseFloat(String(p.brasilUsd)) || 0;
    acc.paraguaiUsd += parseFloat(String(p.paraguaiUsd)) || 0;
    acc.totalPago += parseFloat(String(p.totalPago)) || 0;
    acc.saldoDevedorBrasil += parseFloat(String(p.saldoDevedorBrasil)) || 0;
    acc.saldoDevedorParaguai += parseFloat(String(p.saldoDevedorParaguai)) || 0;
    acc.saldoDevedorTotal += parseFloat(String(p.saldoDevedorTotal)) || 0;
    return acc;
  }, { totalUsd: 0, totalBrasilUsd: 0, totalParaguaiUsd: 0, brasilUsd: 0, paraguaiUsd: 0, totalPago: 0, saldoDevedorBrasil: 0, saldoDevedorParaguai: 0, saldoDevedorTotal: 0 });

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
                      const newTitle = newSub ? `${newName} – ${newSub}` : newName;
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
      <table className={`${isWinnie ? 'min-w-[1150px]' : 'min-w-[1050px]'} w-full text-[11px] border-collapse`}>
        <thead>
          <tr>
            <th colSpan={isWinnie ? 4 : 3} className="bg-white"></th>
            <th colSpan={3} className="bg-blue-50 px-2 py-1.5 text-center font-bold text-[11px] uppercase tracking-wider text-blue-700 border-b-2 border-blue-400 whitespace-nowrap">Total a pagar</th>
            <th colSpan={3} className="bg-green-50 px-2 py-1.5 text-center font-bold text-[11px] uppercase tracking-wider text-green-700 border-b-2 border-green-400 whitespace-nowrap">O que pagou</th>
            <th colSpan={3} className="bg-red-50 px-2 py-1.5 text-center font-bold text-[11px] uppercase tracking-wider text-red-600 border-b-2 border-red-400 whitespace-nowrap">O que falta pagar</th>
            <th colSpan={2} className="bg-white"></th>
          </tr>
          <tr className="bg-slate-50 text-slate-500 uppercase text-[10px]">
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap min-w-[80px]">Status</th>
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap min-w-[70px]">Pedido</th>
            {isWinnie && <th className="px-2 py-2 text-center font-semibold whitespace-nowrap min-w-[85px]">Data Chegada</th>}
            <th className="px-2 py-2 text-center font-semibold whitespace-nowrap min-w-[35px]">Doc</th>
            <th className="px-2 py-2 text-center font-semibold bg-blue-50/50 whitespace-nowrap min-w-[80px]">Total</th>
            <th className="px-2 py-2 text-center font-semibold bg-blue-50/50 whitespace-nowrap min-w-[75px]">Brasil</th>
            <th className="px-2 py-2 text-center font-semibold bg-blue-50/50 whitespace-nowrap min-w-[75px]">Paraguai</th>
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
              <EditPaymentRow key={payment.id} payment={payment} onCancel={() => setEditingId(null)} onRefetch={onRefetch} isWinnie={isWinnie} />
            ) : (
              <PaymentRow key={payment.id} payment={payment} onEdit={() => setEditingId(payment.id)} onRefetch={onRefetch} onTrack={onTrack} onTrackBl={onTrackBl} currency={currency} exchangeRate={exchangeRate} isWinnie={isWinnie} />
            )
          ))}
          {payments.length === 0 && (
            <tr>
              <td colSpan={isWinnie ? 15 : 14} className="px-3 py-8 text-center">
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
              isWinnie={isWinnie}
            />
          )}
          {/* Totals row */}
          {payments.length > 0 && (
            <tr className="bg-slate-50 font-semibold border-t border-slate-200">
              <td className="px-2 py-2 text-slate-700" colSpan={isWinnie ? 4 : 3}>TOTAIS</td>
              <td className="px-2 py-2 text-center text-blue-700 whitespace-nowrap">{sectionTotals.totalUsd ? `${currencySymbol}\u00A0${convertValue(sectionTotals.totalUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}</td>
              <td className="px-2 py-2 text-center text-blue-700 whitespace-nowrap">{sectionTotals.totalBrasilUsd ? `${currencySymbol}\u00A0${convertValue(sectionTotals.totalBrasilUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}</td>
              <td className="px-2 py-2 text-center text-blue-700 whitespace-nowrap">{sectionTotals.totalParaguaiUsd ? `${currencySymbol}\u00A0${convertValue(sectionTotals.totalParaguaiUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}</td>
              <td className="px-2 py-2 text-center text-green-700 whitespace-nowrap">{sectionTotals.brasilUsd ? `${currencySymbol}\u00A0${convertValue(sectionTotals.brasilUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}</td>
              <td className="px-2 py-2 text-center text-green-700 whitespace-nowrap">{sectionTotals.paraguaiUsd ? `${currencySymbol}\u00A0${convertValue(sectionTotals.paraguaiUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}</td>
              <td className="px-2 py-2 text-center text-green-700 whitespace-nowrap">{sectionTotals.totalPago ? `${currencySymbol}\u00A0${convertValue(sectionTotals.totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}</td>
              <td className="px-2 py-2 text-center text-red-600 whitespace-nowrap">{`${currencySymbol}\u00A0${convertValue(sectionTotals.saldoDevedorBrasil || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}</td>
              <td className="px-2 py-2 text-center text-red-600 whitespace-nowrap">{`${currencySymbol}\u00A0${convertValue(sectionTotals.saldoDevedorParaguai || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}</td>
              <td className="px-2 py-2 text-center text-red-700 whitespace-nowrap">{`${currencySymbol}\u00A0${convertValue(sectionTotals.saldoDevedorTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}</td>
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

// ===== PAYMENT ROW (display only - all fields manual) =====

function PaymentRow({ payment, onEdit, onRefetch, onTrack, onTrackBl, currency, exchangeRate, isWinnie = false }: { payment: PaymentData; onEdit: () => void; onRefetch: () => void; onTrack?: (uuid: string) => void; onTrackBl?: (bl: string) => void; currency: "USD" | "BRL"; exchangeRate: number; isWinnie?: boolean }) {
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

  // Green section: show "-" when empty/zero
  const fmtGreen = (v: string | null) => {
    const n = parseFloat(String(v || "0"));
    if (n === 0) return <span className="text-slate-300">-</span>;
    const converted = convertValue(n);
    return <span className="whitespace-nowrap font-mono tabular-nums">{currencySymbol}{"\u00A0"}{converted.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>;
  };

  // Red section: show "$ 0,00" when empty/zero
  const fmtRed = (v: string | null) => {
    const n = parseFloat(String(v || "0"));
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
      {isWinnie && <td className="px-2 py-2 text-center whitespace-nowrap">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] font-medium text-slate-700">{payment.arrivalDate || <span className="text-slate-300">-</span>}</span>
          {payment.arrivalDate && (
            <AlertDaysSelector paymentId={payment.id} currentDays={payment.alertDaysBefore} dismissed={payment.alertDismissed} onRefetch={onRefetch} />
          )}
        </div>
      </td>}
      <td className="px-2 py-2 text-center">
        <span className="px-1 py-0.5 rounded bg-slate-100 text-slate-600 font-medium text-[10px]">{payment.doc}</span>
      </td>
      {/* BLUE SECTION: Total a pagar (Total, Brasil, Paraguai) - ALL INDEPENDENT */}
      <td className="px-2 py-2 text-center font-medium text-slate-800 bg-blue-50/30 whitespace-nowrap">{fmtUsd(payment.totalUsd)}</td>
      <td className="px-2 py-2 text-center text-slate-700 bg-blue-50/30 whitespace-nowrap">{fmtUsd(payment.totalBrasilUsd)}</td>
      <td className="px-2 py-2 text-center text-slate-700 bg-blue-50/30 whitespace-nowrap">{fmtUsd(payment.totalParaguaiUsd)}</td>
      {/* GREEN SECTION: O que pagou (Brasil, Paraguai, Total) - ALL INDEPENDENT */}
      <td className="px-2 py-2 text-center text-slate-700 bg-green-50/30 whitespace-nowrap">{fmtGreen(payment.brasilUsd)}</td>
      <td className="px-2 py-2 text-center text-slate-700 bg-green-50/30 whitespace-nowrap">{fmtGreen(payment.paraguaiUsd)}</td>
      <td className="px-2 py-2 text-center font-medium text-green-700 bg-green-50/30 whitespace-nowrap">{fmtGreen(payment.totalPago)}</td>
      {/* RED SECTION: O que falta pagar (Brasil, Paraguai, Total) - ALL INDEPENDENT */}
      <td className={`px-2 py-2 text-center bg-red-50/30 whitespace-nowrap ${saldoColor(payment.saldoDevedorBrasil)}`}>{fmtRed(payment.saldoDevedorBrasil)}</td>
      <td className={`px-2 py-2 text-center bg-red-50/30 whitespace-nowrap ${saldoColor(payment.saldoDevedorParaguai)}`}>{fmtRed(payment.saldoDevedorParaguai)}</td>
      <td className={`px-2 py-2 text-center font-medium bg-red-50/30 whitespace-nowrap ${saldoColor(payment.saldoDevedorTotal)}`}>{fmtRed(payment.saldoDevedorTotal)}</td>
      <td className="px-2 py-2 text-center whitespace-nowrap">
        <div className="flex flex-col items-center gap-1">
          {(payment.blNumber || payment.trackingUuid) ? (
            <button
              onClick={() => {
                if (payment.trackingUuid) {
                  onTrack && onTrack(payment.trackingUuid);
                } else if (payment.blNumber) {
                  onTrackBl && onTrackBl(payment.blNumber);
                }
              }}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md text-blue-700 font-mono text-[10px] font-medium transition-colors"
              title={payment.trackingUuid ? "Rastrear via Logcomex" : "Rastrear via ONE Line"}
            >
              <Navigation className="w-3 h-3" />
              Rastrear
            </button>
          ) : payment.rastreio ? (
            <span className="text-[10px] text-slate-500 font-mono bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">{payment.rastreio}</span>
          ) : (
            <span className="text-slate-300 text-[10px]">-</span>
          )}
          {payment.blNumber && (
            <span className="text-[9px] text-slate-500 font-mono">{payment.blNumber}</span>
          )}
        </div>
      </td>
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

// ===== EDIT PAYMENT ROW (all fields 100% manual, no auto-calculation) =====

function EditPaymentRow({ payment, onCancel, onRefetch, isWinnie = false }: { payment: PaymentData; onCancel: () => void; onRefetch: () => void; isWinnie?: boolean }) {
  const [form, setForm] = useState({
    status: payment.status,
    pedido: payment.pedido,
    doc: payment.doc,
    totalUsd: String(payment.totalUsd),
    totalBrasilUsd: String(payment.totalBrasilUsd || "0"),
    totalParaguaiUsd: String(payment.totalParaguaiUsd || "0"),
    brasilUsd: String(payment.brasilUsd),
    paraguaiUsd: String(payment.paraguaiUsd),
    totalPago: String(payment.totalPago),
    saldoDevedorBrasil: String(payment.saldoDevedorBrasil),
    saldoDevedorParaguai: String(payment.saldoDevedorParaguai),
    saldoDevedorTotal: String(payment.saldoDevedorTotal),
    rastreio: payment.rastreio || "",
    trackingUuid: payment.trackingUuid || "",
    blNumber: payment.blNumber || "",
    arrivalDate: payment.arrivalDate || "",
    alertDaysBefore: payment.alertDaysBefore !== null ? String(payment.alertDaysBefore) : "",
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
      {isWinnie && <td className="px-1 py-1.5">
        <div className="flex flex-col gap-0.5">
          <input value={form.arrivalDate} onChange={e => setForm({ ...form, arrivalDate: e.target.value })} className={inputClass} placeholder="dd/mm/aaaa" />
          <input type="number" min="0" max="90" value={form.alertDaysBefore} onChange={e => setForm({ ...form, alertDaysBefore: e.target.value })} className={`${inputClass} text-center`} placeholder="Alerta (dias)" title="Dias de antecedência para alerta" />
        </div>
      </td>}
      <td className="px-1 py-1.5">
        <select value={form.doc} onChange={e => setForm({ ...form, doc: e.target.value })} className={`${inputClass} text-center`}>
          <option value="PI">PI</option>
          <option value="CI">CI</option>
        </select>
      </td>
      {/* BLUE: Total a pagar */}
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.totalUsd} onChange={e => setForm({ ...form, totalUsd: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.totalBrasilUsd} onChange={e => setForm({ ...form, totalBrasilUsd: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.totalParaguaiUsd} onChange={e => setForm({ ...form, totalParaguaiUsd: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      {/* GREEN: O que pagou */}
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.brasilUsd} onChange={e => setForm({ ...form, brasilUsd: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.paraguaiUsd} onChange={e => setForm({ ...form, paraguaiUsd: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.totalPago} onChange={e => setForm({ ...form, totalPago: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      {/* RED: O que falta pagar */}
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
        <div className="flex flex-col gap-1">
          <input value={form.blNumber} onChange={e => setForm({ ...form, blNumber: e.target.value })} className={`${inputClass} font-mono`} placeholder="Nº BL (ex: ONEYXMNG50123700)" />
          <input value={form.rastreio} onChange={e => setForm({ ...form, rastreio: e.target.value })} className={`${inputClass} text-[9px]`} placeholder="Container (opcional)" />
          <input value={form.trackingUuid} onChange={e => {
            let val = e.target.value;
            const match = val.match(/workflow-item\/([a-f0-9-]+)/i);
            if (match) val = match[1];
            setForm({ ...form, trackingUuid: val });
          }} className={`${inputClass} text-[9px]`} placeholder="Link Logcomex (opcional)" />
        </div>
      </td>
      <td className="px-1 py-1.5 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <button
            onClick={() => updatePayment.mutate({ id: payment.id, ...form, blNumber: form.blNumber || undefined, trackingUuid: form.trackingUuid || undefined, sectionTitle: form.sectionTitle || undefined, arrivalDate: form.arrivalDate || undefined, alertDaysBefore: form.alertDaysBefore ? parseInt(form.alertDaysBefore) : null })}
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

// ===== INLINE ADD PAYMENT ROW (all fields 100% manual) =====

function InlineAddPaymentRow({ supplierId, sectionTitle, onCancel, onRefetch, isWinnie = false }: { supplierId: number; sectionTitle: string | null; onCancel: () => void; onRefetch: () => void; isWinnie?: boolean }) {
  const [form, setForm] = useState({
    status: "",
    pedido: "",
    doc: "PI",
    totalUsd: "",
    totalBrasilUsd: "0",
    totalParaguaiUsd: "0",
    brasilUsd: "0",
    paraguaiUsd: "0",
    totalPago: "0",
    saldoDevedorBrasil: "0",
    saldoDevedorParaguai: "0",
    saldoDevedorTotal: "0",
    rastreio: "",
    trackingUuid: "",
    blNumber: "",
    arrivalDate: "",
    alertDaysBefore: "",
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
      {isWinnie && <td className="px-1 py-1.5">
        <div className="flex flex-col gap-0.5">
          <input value={form.arrivalDate} onChange={e => setForm({ ...form, arrivalDate: e.target.value })} className={inputClass} placeholder="dd/mm/aaaa" />
          <input type="number" min="0" max="90" value={form.alertDaysBefore} onChange={e => setForm({ ...form, alertDaysBefore: e.target.value })} className={`${inputClass} text-center`} placeholder="Alerta (dias)" title="Dias de antecedência para alerta" />
        </div>
      </td>}
      <td className="px-1 py-1.5">
        <select value={form.doc} onChange={e => setForm({ ...form, doc: e.target.value })} className={`${inputClass} text-center`}>
          <option value="PI">PI</option>
          <option value="CI">CI</option>
        </select>
      </td>
      {/* BLUE: Total a pagar */}
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.totalUsd} onChange={e => setForm({ ...form, totalUsd: e.target.value })} className={`${inputClass} text-right`} placeholder="0.00" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.totalBrasilUsd} onChange={e => setForm({ ...form, totalBrasilUsd: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.totalParaguaiUsd} onChange={e => setForm({ ...form, totalParaguaiUsd: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      {/* GREEN: O que pagou */}
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.brasilUsd} onChange={e => setForm({ ...form, brasilUsd: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.paraguaiUsd} onChange={e => setForm({ ...form, paraguaiUsd: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="0.01" value={form.totalPago} onChange={e => setForm({ ...form, totalPago: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      {/* RED: O que falta pagar */}
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
        <div className="flex flex-col gap-1">
          <input value={form.blNumber} onChange={e => setForm({ ...form, blNumber: e.target.value })} className={`${inputClass} font-mono`} placeholder="Nº BL (ex: ONEYXMNG50123700)" />
          <input value={form.rastreio} onChange={e => setForm({ ...form, rastreio: e.target.value })} className={`${inputClass} text-[9px]`} placeholder="Container (opcional)" />
          <input value={form.trackingUuid} onChange={e => {
            let val = e.target.value;
            const match = val.match(/workflow-item\/([a-f0-9-]+)/i);
            if (match) val = match[1];
            setForm({ ...form, trackingUuid: val });
          }} className={`${inputClass} text-[9px]`} placeholder="Link Logcomex (opcional)" />
        </div>
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
                totalBrasilUsd: form.totalBrasilUsd || undefined,
                totalParaguaiUsd: form.totalParaguaiUsd || undefined,
                brasilUsd: form.brasilUsd || undefined,
                paraguaiUsd: form.paraguaiUsd || undefined,
                totalPago: form.totalPago || undefined,
                saldoDevedorBrasil: form.saldoDevedorBrasil || undefined,
                saldoDevedorParaguai: form.saldoDevedorParaguai || undefined,
                saldoDevedorTotal: form.saldoDevedorTotal || undefined,
                rastreio: form.rastreio || undefined,
                trackingUuid: form.trackingUuid || undefined,
                blNumber: form.blNumber || undefined,
                arrivalDate: form.arrivalDate || undefined,
                alertDaysBefore: form.alertDaysBefore ? parseInt(form.alertDaysBefore) : null,
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

// ===== ALERT DAYS SELECTOR (inline, Winnie only) =====

function AlertDaysSelector({ paymentId, currentDays, dismissed, onRefetch }: { paymentId: number; currentDays: number | null; dismissed: boolean; onRefetch: () => void }) {
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState(currentDays !== null ? String(currentDays) : "");

  const updatePayment = trpc.import.updatePayment.useMutation({
    onSuccess: () => { onRefetch(); setEditing(false); toast.success("Alerta configurado!"); },
    onError: () => toast.error("Erro ao configurar alerta"),
  });

  const reactivateAlert = trpc.import.reactivateAlert.useMutation({
    onSuccess: () => { onRefetch(); toast.success("Alerta reativado!"); },
    onError: () => toast.error("Erro ao reativar"),
  });

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-center">
        <div className="flex items-center gap-0.5 bg-white border border-amber-300 rounded-md px-1.5 py-1 shadow-sm">
          <Bell className="w-3 h-3 text-amber-500" />
          <input
            type="number"
            min="1"
            max="90"
            value={days}
            onChange={e => setDays(e.target.value)}
            className="w-8 px-0.5 py-0 border-0 border-b border-amber-300 rounded-none text-[11px] text-center font-bold text-amber-700 focus:outline-none focus:border-amber-500 bg-transparent"
            placeholder="15"
            autoFocus
          />
          <span className="text-[9px] text-amber-600 font-medium">dias</span>
        </div>
        <button
          onClick={() => {
            const d = parseInt(days);
            if (d > 0) updatePayment.mutate({ id: paymentId, alertDaysBefore: d });
            else { updatePayment.mutate({ id: paymentId, alertDaysBefore: null }); }
          }}
          className="p-1 rounded-md bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition-colors"
          title="Salvar"
        >
          <Check className="w-3 h-3" />
        </button>
        <button onClick={() => setEditing(false)} className="p-1 rounded-md bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  if (currentDays !== null) {
    return (
      <div className="flex items-center gap-1 justify-center">
        <button
          onClick={() => setEditing(true)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-sm transition-all ${
            dismissed
              ? "bg-slate-50 text-slate-400 border-slate-200 opacity-60"
              : "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 hover:shadow"
          }`}
          title={dismissed ? "Alerta dispensado (clique para editar)" : `Alerta: ${currentDays} dias antes da chegada`}
        >
          <Bell className={`w-3 h-3 ${dismissed ? 'text-slate-400' : 'text-amber-500'}`} />
          <span className={dismissed ? 'line-through' : ''}>{currentDays}d</span>
        </button>
        {dismissed && (
          <button
            onClick={() => reactivateAlert.mutate({ id: paymentId })}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 text-[10px] font-medium border border-amber-200 shadow-sm transition-colors"
            title="Reativar alerta"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>Ativar</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-amber-600 bg-amber-50/80 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 hover:shadow-sm transition-all"
      title="Configurar alerta de pagamento"
    >
      <Bell className="w-3 h-3" />
      <span>Alerta</span>
    </button>
  );
}

// ===== CUSTO MERCADORIA =====

type CustoSubTab = "pos" | "config";
function CustoMercadoria() {
  const [custoTab, setCustoTab] = useState<CustoSubTab>("pos");
  const { data: exchangeData } = trpc.import.getExchangeRate.useQuery();
  const [currency, setCurrency] = useState<"USD" | "BRL">("USD");
  const [exportingPdf, setExportingPdf] = useState(false);
  const exchangeRate = exchangeData?.rate || 5.50;

  const handleExportCustoPdf = async () => {
    setExportingPdf(true);
    try {
      const params = new URLSearchParams({ currency, rate: String(exchangeRate) });
      const response = await fetch(`/api/import/export-custo-pdf?${params}`);
      if (!response.ok) throw new Error("Erro ao gerar PDF");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
      a.download = `Custo_Mercadoria_${dateStr}.pdf`;
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

  return (
    <div className="space-y-3">
      {/* STICKY HEADER + TOOLBAR - stays fixed below TopNav when scrolling */}
      <div className="sticky top-12 z-40 bg-white border border-slate-200 rounded-xl shadow-sm px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
            <h2 className="text-sm sm:text-lg font-semibold text-slate-800">Custo da Mercadoria</h2>
          </div>
          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
            <button
              onClick={() => setCustoTab("pos")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                custoTab === "pos"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              POs
            </button>
            <button
              onClick={() => setCustoTab("config")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                custoTab === "config"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Configurações
            </button>
          </div>
        </div>
        {custoTab === "pos" && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 mt-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                onClick={handleExportCustoPdf}
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
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 ${
                currency === "USD"
                  ? "bg-blue-100 border-blue-400 text-blue-800"
                  : "bg-green-100 border-green-400 text-green-800"
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                  currency === "USD" ? "bg-blue-500" : "bg-green-500"
                }`}></span>
                {currency === "USD" ? "DÓLAR (USD)" : "REAL (BRL)"}
              </div>
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
        )}
      </div>

      {custoTab === "pos" && <CustoPosView currency={currency} exchangeRate={exchangeRate} />}
      {custoTab === "config" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
          <CustoConfigView />
        </div>
      )}
    </div>
  );
}

function CustoPosView({ currency, exchangeRate }: { currency: "USD" | "BRL"; exchangeRate: number }) {
  const { data: suppliers, isLoading } = trpc.import.getSuppliersWithPoCount.useQuery();
  const [expandedSupplier, setExpandedSupplier] = useState<number | null>(null);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierCategory, setNewSupplierCategory] = useState('');
  const utils = trpc.useUtils();
  const createSupplierMut = trpc.import.createSupplier.useMutation({
    onSuccess: () => {
      utils.import.getSuppliersWithPoCount.invalidate();
      setShowNewSupplier(false);
      setNewSupplierName('');
      setNewSupplierCategory('');
      toast.success('Fornecedor criado!');
    },
  });
  const updateSupplierOrderMut = trpc.import.updateSupplier.useMutation({
    onSuccess: () => { utils.import.getSuppliersWithPoCount.invalidate(); },
  });

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  const allSuppliers = suppliers || [];

  const moveSupplier = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= allSuppliers.length) return;
    const current = allSuppliers[index];
    const target = allSuppliers[newIndex];
    // Use index-based ordering to avoid duplicate displayOrder issues
    updateSupplierOrderMut.mutate({ id: current.id, displayOrder: newIndex }, {
      onSuccess: () => {
        updateSupplierOrderMut.mutate({ id: target.id, displayOrder: index }, {
          onSuccess: () => utils.import.getSuppliersWithPoCount.invalidate(),
        });
      },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">Selecione um fornecedor para ver as POs e produtos.</p>
        <button
          onClick={() => setShowNewSupplier(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo Fornecedor
        </button>
      </div>

      {showNewSupplier && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-xs font-medium text-blue-800 mb-2">Novo Fornecedor</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500">Nome</label>
              <input
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                placeholder="Ex: BETTY, WINNIE..."
                value={newSupplierName}
                onChange={e => setNewSupplierName(e.target.value)}
              />
            </div>
            <div className="w-32">
              <label className="text-[10px] text-slate-500">Categoria</label>
              <input
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                placeholder="BAMBU, MADEIRA..."
                value={newSupplierCategory}
                onChange={e => setNewSupplierCategory(e.target.value)}
              />
            </div>
            <button
              onClick={() => {
                if (!newSupplierName.trim()) return toast.error('Nome obrigatório');
                createSupplierMut.mutate({ name: newSupplierName.trim(), category: newSupplierCategory.trim() || undefined, context: 'custo' as const });
              }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
            >
              Criar
            </button>
            <button
              onClick={() => setShowNewSupplier(false)}
              className="px-2 py-1.5 text-slate-500 hover:text-red-500 text-xs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {allSuppliers.map((supplier, idx) => (
          <div key={supplier.id} className="flex items-start gap-1">
            <div className="flex flex-col gap-0.5 pt-3">
              <button
                onClick={() => moveSupplier(idx, 'up')}
                disabled={idx === 0}
                className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-blue-50 transition-colors"
                title="Mover para cima"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => moveSupplier(idx, 'down')}
                disabled={idx === allSuppliers.length - 1}
                className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-blue-50 transition-colors"
                title="Mover para baixo"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1">
              <SupplierPoCard
                supplier={supplier}
                isExpanded={expandedSupplier === supplier.id}
                onToggle={() => setExpandedSupplier(expandedSupplier === supplier.id ? null : supplier.id)}
                currency={currency}
                exchangeRate={exchangeRate}
              />
            </div>
          </div>
        ))}
        {allSuppliers.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">Nenhum fornecedor cadastrado.</p>
        )}
      </div>
    </div>
  );
}

// ===== CONFIGURAÇÕES DE IMPOSTOS =====
function CustoConfigView() {
  return (
    <div className="space-y-6">
      <IcmsConfigSection />
      <NcmTaxesSection />
    </div>
  );
}

function IcmsConfigSection() {
  const { data, isLoading } = trpc.import.getIcmsConfig.useQuery();
  const utils = trpc.useUtils();
  const updateRate = trpc.import.updateIcmsRate.useMutation({
    onSuccess: () => { utils.import.getIcmsConfig.invalidate(); toast.success('ICMS atualizado!'); },
  });
  const setUf = trpc.import.setSelectedUf.useMutation({
    onSuccess: () => { utils.import.getIcmsConfig.invalidate(); toast.success('Estado selecionado!'); },
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRate, setEditRate] = useState('');

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>;

  const { states, selectedUf } = data || { states: [], selectedUf: 'SP' };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-slate-700">ICMS por Estado</h3>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Selecione o estado de destino da importação. A alíquota será usada no cálculo de impostos.
        Você pode editar a alíquota de qualquer estado.
      </p>
      
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-slate-600 font-medium">Estado ativo:</span>
        <select
          value={selectedUf}
          onChange={e => setUf.mutate({ uf: e.target.value })}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50"
        >
          {states.map(s => (
            <option key={s.uf} value={s.uf}>{s.uf} - {s.stateName} ({s.icmsRate}%)</option>
          ))}
        </select>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="px-3 py-2 text-left font-medium">UF</th>
              <th className="px-3 py-2 text-left font-medium">Estado</th>
              <th className="px-3 py-2 text-center font-medium">Alíquota ICMS (%)</th>
              <th className="px-3 py-2 text-center font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {states.map((s, idx) => (
              <tr key={s.id} className={`border-t border-slate-100 ${s.uf === selectedUf ? 'bg-blue-50/50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                <td className="px-3 py-2 font-mono font-bold text-slate-700">{s.uf}</td>
                <td className="px-3 py-2 text-slate-600">{s.stateName}</td>
                <td className="px-3 py-2 text-center">
                  {editingId === s.id ? (
                    <input
                      className="w-16 text-center border border-blue-300 rounded px-1 py-0.5 text-xs"
                      value={editRate}
                      onChange={e => setEditRate(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          updateRate.mutate({ id: s.id, icmsRate: editRate });
                          setEditingId(null);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span className="font-mono font-medium text-emerald-700">{Number(s.icmsRate).toFixed(2)}%</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {editingId === s.id ? (
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => { updateRate.mutate({ id: s.id, icmsRate: editRate }); setEditingId(null); }} className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingId(null)} className="p-0.5 text-red-500 hover:bg-red-50 rounded"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingId(s.id); setEditRate(String(s.icmsRate)); }} className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NcmTaxesSection() {
  const { data: ncmList, isLoading } = trpc.import.getNcmTaxes.useQuery();
  const utils = trpc.useUtils();
  const createNcm = trpc.import.createNcmTax.useMutation({
    onSuccess: () => { utils.import.getNcmTaxes.invalidate(); toast.success('NCM adicionado!'); setShowAdd(false); resetForm(); },
  });
  const updateNcm = trpc.import.updateNcmTax.useMutation({
    onSuccess: () => { utils.import.getNcmTaxes.invalidate(); toast.success('NCM atualizado!'); setEditingId(null); },
  });
  const deleteNcm = trpc.import.deleteNcmTax.useMutation({
    onSuccess: () => { utils.import.getNcmTaxes.invalidate(); toast.success('NCM removido!'); },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ncm: '', description: '', iiRate: '', ipiRate: '', pisRate: '2.10', cofinsRate: '9.65' });
  const resetForm = () => setForm({ ncm: '', description: '', iiRate: '', ipiRate: '', pisRate: '2.10', cofinsRate: '9.65' });

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-700">Alíquotas por NCM</h3>
        </div>
        <button
          onClick={() => { setShowAdd(true); resetForm(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo NCM
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Cadastre os NCMs dos produtos importados com suas alíquotas de II e IPI.
        PIS (2,10%) e COFINS (9,65%) já vêm preenchidos mas podem ser editados.
      </p>

      {showAdd && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs font-medium text-amber-800 mb-2">Novo NCM</p>
          <div className="grid grid-cols-6 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">NCM</label>
              <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono" placeholder="0000.00.00" value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500">Descrição</label>
              <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" placeholder="Descrição do produto" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">II (%)</label>
              <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs text-center" placeholder="18" value={form.iiRate} onChange={e => setForm({ ...form, iiRate: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">IPI (%)</label>
              <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs text-center" placeholder="5" value={form.ipiRate} onChange={e => setForm({ ...form, ipiRate: e.target.value })} />
            </div>
            <div className="flex items-end gap-1">
              <button
                onClick={() => {
                  if (!form.ncm.trim() || !form.iiRate || !form.ipiRate) return toast.error('NCM, II e IPI obrigatórios');
                  createNcm.mutate({ ncm: form.ncm.trim(), description: form.description.trim() || undefined, iiRate: form.iiRate, ipiRate: form.ipiRate, pisRate: form.pisRate, cofinsRate: form.cofinsRate });
                }}
                className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700"
              >
                Salvar
              </button>
              <button onClick={() => setShowAdd(false)} className="p-1.5 text-slate-500 hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-2 mt-2">
            <div className="col-start-4">
              <label className="text-[10px] text-slate-500">PIS (%)</label>
              <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs text-center" value={form.pisRate} onChange={e => setForm({ ...form, pisRate: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">COFINS (%)</label>
              <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs text-center" value={form.cofinsRate} onChange={e => setForm({ ...form, cofinsRate: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="px-3 py-2 text-left font-medium">NCM</th>
              <th className="px-3 py-2 text-left font-medium">Descrição</th>
              <th className="px-3 py-2 text-center font-medium">II (%)</th>
              <th className="px-3 py-2 text-center font-medium">IPI (%)</th>
              <th className="px-3 py-2 text-center font-medium">PIS (%)</th>
              <th className="px-3 py-2 text-center font-medium">COFINS (%)</th>
              <th className="px-3 py-2 text-center font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(ncmList || []).length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Nenhum NCM cadastrado. Clique em "Novo NCM" para adicionar.</td></tr>
            )}
            {(ncmList || []).map((ncm, idx) => (
              <tr key={ncm.id} className={`border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                <td className="px-3 py-2 font-mono font-bold text-slate-700">
                  {editingId === ncm.id ? (
                    <input className="w-24 border border-blue-300 rounded px-1 py-0.5 text-xs font-mono" value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value })} />
                  ) : ncm.ncm}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {editingId === ncm.id ? (
                    <input className="w-full border border-blue-300 rounded px-1 py-0.5 text-xs" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  ) : (ncm.description || '—')}
                </td>
                <td className="px-3 py-2 text-center font-mono text-red-600 font-medium">
                  {editingId === ncm.id ? (
                    <input className="w-14 text-center border border-blue-300 rounded px-1 py-0.5 text-xs" value={form.iiRate} onChange={e => setForm({ ...form, iiRate: e.target.value })} />
                  ) : `${Number(ncm.iiRate).toFixed(2)}`}
                </td>
                <td className="px-3 py-2 text-center font-mono text-orange-600 font-medium">
                  {editingId === ncm.id ? (
                    <input className="w-14 text-center border border-blue-300 rounded px-1 py-0.5 text-xs" value={form.ipiRate} onChange={e => setForm({ ...form, ipiRate: e.target.value })} />
                  ) : `${Number(ncm.ipiRate).toFixed(2)}`}
                </td>
                <td className="px-3 py-2 text-center font-mono text-blue-600">
                  {editingId === ncm.id ? (
                    <input className="w-14 text-center border border-blue-300 rounded px-1 py-0.5 text-xs" value={form.pisRate} onChange={e => setForm({ ...form, pisRate: e.target.value })} />
                  ) : `${Number(ncm.pisRate).toFixed(2)}`}
                </td>
                <td className="px-3 py-2 text-center font-mono text-purple-600">
                  {editingId === ncm.id ? (
                    <input className="w-14 text-center border border-blue-300 rounded px-1 py-0.5 text-xs" value={form.cofinsRate} onChange={e => setForm({ ...form, cofinsRate: e.target.value })} />
                  ) : `${Number(ncm.cofinsRate).toFixed(2)}`}
                </td>
                <td className="px-3 py-2 text-center">
                  {editingId === ncm.id ? (
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => { updateNcm.mutate({ id: ncm.id, ...form }); }} className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingId(null)} className="p-0.5 text-red-500 hover:bg-red-50 rounded"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => { setEditingId(ncm.id); setForm({ ncm: ncm.ncm, description: ncm.description || '', iiRate: String(ncm.iiRate), ipiRate: String(ncm.ipiRate), pisRate: String(ncm.pisRate), cofinsRate: String(ncm.cofinsRate) }); }} className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { if (confirm('Remover NCM?')) deleteNcm.mutate({ id: ncm.id }); }} className="p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SupplierPoCard({ supplier, isExpanded, onToggle, currency, exchangeRate }: {
  supplier: { id: number; name: string; displayName: string | null; category: string | null; poCount: number };
  isExpanded: boolean;
  onToggle: () => void;
  currency: "USD" | "BRL";
  exchangeRate: number;
}) {
  const utils = trpc.useUtils();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(supplier.displayName || supplier.name);
  const deleteSupplierMut = trpc.import.deleteSupplier.useMutation({
    onSuccess: () => {
      utils.import.getSuppliersWithPoCount.invalidate();
      toast.success('Fornecedor excluído!');
    },
  });
  const updateSupplierMut = trpc.import.updateSupplier.useMutation({
    onSuccess: () => {
      utils.import.getSuppliersWithPoCount.invalidate();
      toast.success('Nome atualizado!');
      setIsEditing(false);
    },
  });

  // Color scheme based on category
  const cat = (supplier.category || '').toUpperCase();
  const colorScheme = cat.includes('BAMBU') ? {
    gradient: 'from-emerald-50 to-white',
    hoverGradient: 'hover:from-emerald-100',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-700',
    border: 'border-emerald-200',
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    categoryBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  } : cat.includes('MADEIRA') ? {
    gradient: 'from-amber-50 to-white',
    hoverGradient: 'hover:from-amber-100',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-700',
    border: 'border-amber-200',
    badgeBg: 'bg-amber-600',
    badgeText: 'text-white',
    categoryBadge: 'bg-amber-50 text-amber-700 border-amber-200',
  } : cat.includes('MÁQUINA') || cat.includes('MAQUINA') ? {
    gradient: 'from-purple-50 to-white',
    hoverGradient: 'hover:from-purple-100',
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-700',
    border: 'border-purple-200',
    badgeBg: 'bg-purple-600',
    badgeText: 'text-white',
    categoryBadge: 'bg-purple-50 text-purple-700 border-purple-200',
  } : {
    gradient: 'from-blue-50 to-white',
    hoverGradient: 'hover:from-blue-100',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-700',
    border: 'border-blue-200',
    badgeBg: 'bg-blue-600',
    badgeText: 'text-white',
    categoryBadge: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  return (
    <div className={`border ${colorScheme.border} rounded-xl overflow-hidden shadow-sm`}>
      <div className={`flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r ${colorScheme.gradient} ${colorScheme.hoverGradient} transition-colors`}>
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-3 text-left"
        >
          <div className={`w-9 h-9 rounded-lg ${colorScheme.iconBg} flex items-center justify-center`}>
            <Package className={`w-4 h-4 ${colorScheme.iconText}`} />
          </div>
          <div>
            {isEditing ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="font-semibold text-sm text-slate-800 border border-slate-300 rounded px-2 py-0.5 w-48"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editName.trim()) {
                      updateSupplierMut.mutate({ id: supplier.id, displayName: editName.trim().toUpperCase() });
                    } else if (e.key === 'Escape') {
                      setIsEditing(false);
                      setEditName(supplier.displayName || supplier.name);
                    }
                  }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); if (editName.trim()) updateSupplierMut.mutate({ id: supplier.id, displayName: editName.trim().toUpperCase() }); }}
                  className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditing(false); setEditName(supplier.displayName || supplier.name); }}
                  className="p-0.5 text-red-500 hover:bg-red-50 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <p className="font-semibold text-sm text-slate-800">{supplier.displayName || supplier.name}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              {supplier.category && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colorScheme.categoryBadge}`}>
                  {supplier.category}
                </span>
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center min-w-[36px] h-9 rounded-lg ${colorScheme.badgeBg} ${colorScheme.badgeText} font-bold text-sm px-2 shadow-sm`}>
            {supplier.poCount}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditName(supplier.displayName || supplier.name); }}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Editar nome"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir fornecedor "${supplier.name}" e todas as suas POs e produtos?`)) deleteSupplierMut.mutate({ id: supplier.id }); }}
            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
            title="Excluir Fornecedor"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onToggle}>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>
      {isExpanded && <SupplierPoList supplierId={supplier.id} currency={currency} exchangeRate={exchangeRate} />}
    </div>
  );
}

function SupplierPoList({ supplierId, currency, exchangeRate }: { supplierId: number; currency: "USD" | "BRL"; exchangeRate: number }) {
  const { data: pos, isLoading } = trpc.import.getPosBySupplier.useQuery({ supplierId });
  const [expandedPo, setExpandedPo] = useState<number | null>(null);
  const [showNewPo, setShowNewPo] = useState(false);
  const [newPoName, setNewPoName] = useState('');
  const [showLogisticsFields, setShowLogisticsFields] = useState(false);
  const [newPoLogistics, setNewPoLogistics] = useState<Record<string, string>>({});
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const utils = trpc.useUtils();
  const createPoMut = trpc.import.createPo.useMutation({
    onSuccess: () => {
      utils.import.getPosBySupplier.invalidate({ supplierId });
      utils.import.getSuppliersWithPoCount.invalidate();
      setShowNewPo(false);
      setNewPoName('');
      toast.success('PO criada!');
    },
  });
  const deletePoMut = trpc.import.deletePo.useMutation({
    onSuccess: () => {
      utils.import.getPosBySupplier.invalidate({ supplierId });
      utils.import.getSuppliersWithPoCount.invalidate();
      toast.success('PO excluída!');
    },
  });

  if (isLoading) {
    return <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/50 p-2 sm:p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">{(pos || []).length} POs</span>
          <button
            onClick={() => setSortOrder(prev => prev === "newest" ? "oldest" : "newest")}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-slate-200"
            title={sortOrder === "newest" ? "Mais recentes primeiro" : "Mais antigas primeiro"}
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortOrder === "newest" ? "Recentes" : "Antigas"}
          </button>
        </div>
        <button
          onClick={() => setShowNewPo(true)}
          className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white rounded text-[10px] font-medium hover:bg-amber-600 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Nova PO
        </button>
      </div>
      {showNewPo && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 font-medium">Nome da PO *</label>
              <input
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                placeholder="Ex: PO66, PO67..."
                value={newPoName}
                onChange={e => setNewPoName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 font-medium">Contêiner (opcional)</label>
              <input
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                placeholder="Ex: CONTÊINER PO-66"
                value={newPoLogistics.containerName || ''}
                onChange={e => setNewPoLogistics({ ...newPoLogistics, containerName: e.target.value })}
              />
            </div>
          </div>
          <button
            onClick={() => setShowLogisticsFields(!showLogisticsFields)}
            className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-medium"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showLogisticsFields ? 'rotate-180' : ''}`} />
            {showLogisticsFields ? 'Ocultar campos logísticos' : 'Preencher custos logísticos (opcional)'}
          </button>
          {showLogisticsFields && (
            <div className="space-y-3 border-t border-amber-200 pt-3">
              {/* ROTA */}
              <div>
                <p className="text-[10px] font-semibold text-slate-600 mb-1">✈️ ROTA DA IMPORTAÇÃO</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-500">Porto de Chegada</label>
                    <select className="w-full border border-slate-300 rounded px-1 py-1 text-[10px]" value={newPoLogistics.portoChegada || ''} onChange={e => setNewPoLogistics({ ...newPoLogistics, portoChegada: e.target.value })}>
                      <option value="">Selecione...</option>
                      <option value="Santos">Santos</option>
                      <option value="Paranaguá">Paranaguá</option>
                      <option value="Itajaí">Itajaí</option>
                      <option value="Navegantes">Navegantes</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500">Cidade de Desembaraço</label>
                    <select className="w-full border border-slate-300 rounded px-1 py-1 text-[10px]" value={newPoLogistics.cidadeDesembaraco || ''} onChange={e => setNewPoLogistics({ ...newPoLogistics, cidadeDesembaraco: e.target.value })}>
                      <option value="">Selecione...</option>
                      <option value="Santos">Santos</option>
                      <option value="Curitiba">Curitiba</option>
                      <option value="Itajaí">Itajaí</option>
                      <option value="São Paulo">São Paulo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500">Local Final</label>
                    <select className="w-full border border-slate-300 rounded px-1 py-1 text-[10px]" value={newPoLogistics.localFinal || ''} onChange={e => setNewPoLogistics({ ...newPoLogistics, localFinal: e.target.value })}>
                      <option value="">Selecione...</option>
                      <option value="Uberaba">Uberaba</option>
                      <option value="Uberlândia">Uberlândia</option>
                      <option value="São Paulo">São Paulo</option>
                    </select>
                  </div>
                </div>
              </div>
              {/* PAGAMENTOS */}
              <div>
                <p className="text-[10px] font-semibold text-slate-600 mb-1">💵 PAGAMENTOS REALIZADOS (R$)</p>
                <div className="grid grid-cols-4 gap-2">
                  {[['pagamento1Remessa', '1ª Remessa'], ['pagamento2Remessa', '2ª Remessa'], ['pagamento3Remessa', '3ª Remessa'], ['taxasRemessa', 'Taxas Remessa']].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-[9px] text-slate-500">{label}</label>
                      <input className="w-full border border-slate-300 rounded px-1 py-1 text-[10px]" placeholder="0.00" value={newPoLogistics[key] || ''} onChange={e => setNewPoLogistics({ ...newPoLogistics, [key]: e.target.value })} />
                    </div>
                  ))}
                </div>
              </div>
              {/* CUSTOS ADICIONAIS */}
              <div>
                <p className="text-[10px] font-semibold text-slate-600 mb-1">📦 CUSTOS ADICIONAIS (R$)</p>
                <div className="grid grid-cols-4 gap-2">
                  {[['despesasLiberacaoRemessa', 'Despesas Liberação'], ['freteTermestreRemessa', 'Frete Terrestre'], ['difalValor', 'DIFAL'], ['comissaoSilverio', 'Comissão Silvério']].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-[9px] text-slate-500">{label}</label>
                      <input className="w-full border border-slate-300 rounded px-1 py-1 text-[10px]" placeholder="0.00" value={newPoLogistics[key] || ''} onChange={e => setNewPoLogistics({ ...newPoLogistics, [key]: e.target.value })} />
                    </div>
                  ))}
                </div>
              </div>
              {/* INFORMAÇÕES IMPORTANTES */}
              <div>
                <p className="text-[10px] font-semibold text-slate-600 mb-1">ⓘ INFORMAÇÕES IMPORTANTES</p>
                <div className="grid grid-cols-3 gap-2">
                  {[['valorTotalProdutosUsdRemessa', 'Valor Total Produtos (USD)'], ['valorFreteMaritimoCnBr', 'Frete Marítimo CN/BR (USD)'], ['totalCiRemessa', 'Total CI (USD)']].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-[9px] text-slate-500">{label}</label>
                      <input className="w-full border border-slate-300 rounded px-1 py-1 text-[10px]" placeholder="0.00" value={newPoLogistics[key] || ''} onChange={e => setNewPoLogistics({ ...newPoLogistics, [key]: e.target.value })} />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[['valorDolar1Remessa', 'Dólar 1ª Remessa'], ['valorDolar2Remessa', 'Dólar 2ª Remessa'], ['valorDolar3Remessa', 'Dólar 3ª Remessa']].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-[9px] text-slate-500">{label}</label>
                      <input className="w-full border border-slate-300 rounded px-1 py-1 text-[10px]" placeholder="0.0000" value={newPoLogistics[key] || ''} onChange={e => setNewPoLogistics({ ...newPoLogistics, [key]: e.target.value })} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2 border-t border-amber-200">
            <button onClick={() => { setShowNewPo(false); setShowLogisticsFields(false); setNewPoLogistics({}); setNewPoName(''); }} className="px-3 py-1 text-slate-500 hover:text-red-500 text-xs">Cancelar</button>
            <button
              onClick={() => {
                if (!newPoName.trim()) return toast.error('Nome obrigatório');
                const payload: any = { supplierId, poNumber: newPoName.trim() };
                if (newPoLogistics.containerName) payload.containerName = newPoLogistics.containerName;
                for (const [key, value] of Object.entries(newPoLogistics)) {
                  if (key !== 'containerName' && value && value.trim()) payload[key] = value.trim();
                }
                createPoMut.mutate(payload);
                setShowLogisticsFields(false);
                setNewPoLogistics({});
              }}
              className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700"
            >Criar PO</button>
          </div>
        </div>
      )}
      {[...(pos || [])].sort((a, b) => sortOrder === "newest" ? b.id - a.id : a.id - b.id).map(po => (
        <div key={po.id} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
          <button
            onClick={() => setExpandedPo(expandedPo === po.id ? null : po.id)}
            className="w-full flex items-center justify-between p-2.5 sm:p-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-amber-50 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-xs sm:text-sm text-slate-700">{po.poNumber}</p>
                <p className="text-[10px] text-slate-400">{po.containerName || ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">

              {po.pdfUrl && (
                <a
                  href={po.pdfUrl}
                  download={`Meia Nota - ${po.poNumber}.pdf`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex flex-col items-center gap-0.5 px-2 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
                  title="Baixar Meia Nota"
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-[8px] font-medium leading-none">PO Meia Nota</span>
                </a>
              )}
              {po.pdfNotaCheiaUrl && (
                <a
                  href={po.pdfNotaCheiaUrl}
                  download={`Nota Cheia - ${po.poNumber}.pdf`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex flex-col items-center gap-0.5 px-2 py-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded border border-emerald-200 transition-colors"
                  title="Baixar Nota Cheia"
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-[8px] font-medium leading-none">PO Nota Cheia</span>
                </a>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir PO "${po.poNumber}" e todos os seus produtos?`)) deletePoMut.mutate({ id: po.id }); }}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
                title="Excluir PO"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {expandedPo === po.id ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </button>
          {expandedPo === po.id && (
            <div>
              <PoLogisticsPanel po={po} currency={currency} exchangeRate={exchangeRate} />
              <PoProductsTable poId={po.id} valorFator={po.valorFator ? Number(po.valorFator) : null} currency={currency} exchangeRate={exchangeRate} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ===== PAINEL DE CUSTOS LOGÍSTICOS POR PO =====
function PoLogisticsPanel({ po, currency, exchangeRate }: { po: any; currency: "USD" | "BRL"; exchangeRate: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const utils = trpc.useUtils();
  const { data: exchangeData } = trpc.import.getExchangeRate.useQuery();
  const updateLogistics = trpc.import.updatePoLogistics.useMutation({
    onSuccess: () => {
      utils.import.getPosBySupplier.invalidate({ supplierId: po.supplierId });
      toast.success('Custos atualizados!');
    },
    onError: () => toast.error('Erro ao salvar custos'),
  });

  // Local state for all fields
  const [portoChegada, setPortoChegada] = useState(po.portoChegada || '');
  const [cidadeDesembaraco, setCidadeDesembaraco] = useState(po.cidadeDesembaraco || '');
  const [localFinal, setLocalFinal] = useState(po.localFinal || '');
  const [pag1, setPag1] = useState(po.pagamento1Remessa || '');
  const [pag2, setPag2] = useState(po.pagamento2Remessa || '');
  const [pag3, setPag3] = useState(po.pagamento3Remessa || '');
  const [taxasRemessa, setTaxasRemessa] = useState(po.taxasRemessa || '');
  const [despLib, setDespLib] = useState(po.despesasLiberacaoRemessa || '');
  const [freteTerr, setFreteTerr] = useState(po.freteTermestreRemessa || '');
  const [difal, setDifal] = useState(po.difalValor || '');
  const [comSilverio, setComSilverio] = useState(po.comissaoSilverio || '');
  const [dolar1, setDolar1] = useState(po.valorDolar1Remessa || '');
  const [dolar2, setDolar2] = useState(po.valorDolar2Remessa || '');
  const [dolar3, setDolar3] = useState(po.valorDolar3Remessa || '');
  const [freteMaritimo, setFreteMaritimo] = useState(po.valorFreteMaritimoCnBr || '');
  const [totalCi, setTotalCi] = useState(po.totalCiRemessa || '');
  const [totalProdUsd, setTotalProdUsd] = useState(po.valorTotalProdutosUsdRemessa || '');

  const portosOptions = ['Santos - SP', 'Itajaí - SC', 'Paranaguá - PR', 'Rio de Janeiro - RJ', 'Vitória - ES', 'Navegantes - SC', 'Manaus - AM'];
  const cidadesDesembaracoOptions = ['Varginha - MG', 'Pouso Alegre - MG', 'Juiz de Fora - MG', 'Santos - SP', 'São Paulo - SP', 'Campinas - SP', 'Uberlândia - MG'];
  const locaisFinaisOptions = ['Ribeirão Vermelho - MG', 'Lavras - MG', 'Varginha - MG', 'São João del-Rei - MG', 'Belo Horizonte - MG'];

  // Auto-calculate total
  const totalCustos = [
    Number(pag1 || 0), Number(pag2 || 0), Number(pag3 || 0),
    Number(taxasRemessa || 0), Number(despLib || 0),
    Number(freteTerr || 0), Number(difal || 0), Number(comSilverio || 0)
  ].reduce((a, b) => a + b, 0);

  const handleSave = () => {
    updateLogistics.mutate({
      id: po.id,
      portoChegada: portoChegada || null,
      cidadeDesembaraco: cidadeDesembaraco || null,
      localFinal: localFinal || null,
      pagamento1Remessa: pag1 || null,
      pagamento2Remessa: pag2 || null,
      pagamento3Remessa: pag3 || null,
      taxasRemessa: taxasRemessa || null,
      despesasLiberacaoRemessa: despLib || null,
      freteTermestreRemessa: freteTerr || null,
      difalValor: difal || null,
      comissaoSilverio: comSilverio || null,
      valorDolar1Remessa: dolar1 || null,
      valorDolar2Remessa: dolar2 || null,
      valorDolar3Remessa: dolar3 || null,
      valorFreteMaritimoCnBr: freteMaritimo || null,
      totalCiRemessa: totalCi || null,
      valorTotalProdutosUsdRemessa: totalProdUsd || null,
    });
  };

  const liveRate = exchangeData?.rate || 0;
  const liveSource = exchangeData?.source || '';

  return (
    <div className="border-t border-slate-100">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-xs font-semibold text-indigo-700">Custos Logísticos & Informações</span>
          {totalCustos > 0 && (
            <span className="text-[10px] font-mono text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded">
              R$ {totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {liveRate > 0 && (
            <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              USD R$ {liveRate.toFixed(4)}
            </span>
          )}
          {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-3 sm:p-4 bg-gradient-to-br from-slate-50 to-indigo-50/30 space-y-4">
          {/* ROTA */}
          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Navigation className="w-3 h-3" /> Rota da Importação
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-500">Porto de Chegada</label>
                <select
                  value={portoChegada}
                  onChange={e => setPortoChegada(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white"
                >
                  <option value="">Selecione...</option>
                  {portosOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Cidade de Desembaraço</label>
                <select
                  value={cidadeDesembaraco}
                  onChange={e => setCidadeDesembaraco(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white"
                >
                  <option value="">Selecione...</option>
                  {cidadesDesembaracoOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Local Final de Chegada</label>
                <select
                  value={localFinal}
                  onChange={e => setLocalFinal(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white"
                >
                  <option value="">Selecione...</option>
                  {locaisFinaisOptions.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* PAGAMENTOS */}
          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Receipt className="w-3 h-3" /> Pagamentos Realizados {currency === "USD" ? "(USD)" : "(R$)"}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-slate-500">1ª Remessa</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(pag1 || 0) / exchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(pag1 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
                <input type="hidden" value={pag1} />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">2ª Remessa</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(pag2 || 0) / exchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(pag2 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">3ª Remessa</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(pag3 || 0) / exchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(pag3 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Taxas Remessa</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(taxasRemessa || 0) / exchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(taxasRemessa || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
            </div>
          </div>

          {/* CUSTOS ADICIONAIS */}
          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calculator className="w-3 h-3" /> Custos Adicionais {currency === "USD" ? "(USD)" : "(R$)"}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-slate-500">Despesas Liberação</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(despLib || 0) / exchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(despLib || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Frete Terrestre</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(freteTerr || 0) / exchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(freteTerr || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">DIFAL</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(difal || 0) / exchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(difal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Comissão do Silvério</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(comSilverio || 0) / exchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(comSilverio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
            </div>
          </div>

          {/* TOTAL CUSTOS */}
          <div className="flex items-center justify-between bg-white border border-indigo-200 rounded-lg px-3 py-2">
            <span className="text-xs font-semibold text-indigo-700">Total Custos Importação</span>
            <span className="text-sm font-bold font-mono text-indigo-800">
              {currency === "USD" && exchangeRate > 0
                ? `$ ${(totalCustos / exchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `R$ ${totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
            </span>
          </div>

          {/* INFORMAÇÕES IMPORTANTES */}
          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" /> Informações Importantes
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-slate-500">Valor Total Produtos {currency === "USD" ? "(USD)" : "(R$)"}</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "BRL" && exchangeRate > 0 ? `R$ ${(Number(totalProdUsd || 0) * exchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$ ${Number(totalProdUsd || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Frete Marítimo CN/BR {currency === "USD" ? "(USD)" : "(R$)"}</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "BRL" && exchangeRate > 0 ? `R$ ${(Number(freteMaritimo || 0) * exchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$ ${Number(freteMaritimo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Total CI {currency === "USD" ? "(USD)" : "(R$)"}</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "BRL" && exchangeRate > 0 ? `R$ ${(Number(totalCi || 0) * exchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$ ${Number(totalCi || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5">
                <label className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  Dólar Tempo Real
                </label>
                <p className="text-sm font-bold font-mono text-emerald-800">
                  R$ {liveRate > 0 ? liveRate.toFixed(4) : '...'}
                </p>
                <p className="text-[9px] text-emerald-600">{liveSource}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              <div>
                <label className="text-[10px] text-slate-500">Dólar 1ª Remessa</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {Number(dolar1 || 0).toFixed(4)}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Dólar 2ª Remessa</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {Number(dolar2 || 0).toFixed(4)}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Dólar 3ª Remessa</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {Number(dolar3 || 0).toFixed(4)}
                </div>
              </div>
            </div>
          </div>

          {/* BOTÃO SALVAR */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={updateLogistics.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {updateLogistics.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Salvar Custos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== TAX DETAIL CARD (popup ao clicar em Impostos) =====
function TaxDetailCard({ prod, onClose }: { prod: any; onClose: () => void }) {
  const ncm = prod.ncm || '';
  const valorMenor = Number(prod.valorPoMenor || 0);
  const { data: taxCalc } = trpc.import.calculateTaxes.useQuery(
    { ncm, valorMenorUsd: valorMenor, freteUsd: Number(prod.totalFreightUsd || 0) },
    { enabled: !!ncm && valorMenor > 0 }
  );

  return (
    <div className="absolute z-50 right-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-xl p-3 text-left">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-bold text-slate-700">Detalhamento de Impostos</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
      </div>
      {!ncm ? (
        <p className="text-[10px] text-amber-600">NCM não informado. Cadastre o NCM para calcular.</p>
      ) : !taxCalc ? (
        <p className="text-[10px] text-amber-600">NCM não encontrado nas configurações. Cadastre as alíquotas na aba Configurações.</p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-500">Base: PO Menor = <span className="font-mono font-bold">${valorMenor.toFixed(4)}</span> | UF: {taxCalc.selectedUf}</p>
          <div className="border-t border-slate-100 pt-1.5 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-600">II ({taxCalc.iiRate}%)</span>
              <span className="font-mono font-medium text-red-600">${taxCalc.iiValor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-600">IPI ({taxCalc.ipiRate}%)</span>
              <span className="font-mono font-medium text-red-600">${taxCalc.ipiValor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-600">PIS ({taxCalc.pisRate}%)</span>
              <span className="font-mono font-medium text-red-600">${taxCalc.pisValor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-600">COFINS ({taxCalc.cofinsRate}%)</span>
              <span className="font-mono font-medium text-red-600">${taxCalc.cofinsValor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-600">ICMS ({taxCalc.icmsRate}% por dentro)</span>
              <span className="font-mono font-medium text-red-600">${taxCalc.icmsValor.toFixed(2)}</span>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-1.5 flex justify-between text-[11px] font-bold">
            <span className="text-slate-700">TOTAL IMPOSTOS</span>
            <span className="font-mono text-red-700">${taxCalc.totalImpostos.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PoProductsTable({ poId, valorFator, currency = "USD", exchangeRate = 5.50 }: { poId: number; valorFator: number | null; currency?: "USD" | "BRL"; exchangeRate?: number }) {
  const { data: products, isLoading } = trpc.import.getPoProducts.useQuery({ poId });
  const utils = trpc.useUtils();
  const updateProduct = trpc.import.updatePoProduct.useMutation({
    onSuccess: () => utils.import.getPoProducts.invalidate({ poId }),
  });
  const addProduct = trpc.import.addPoProduct.useMutation({
    onSuccess: () => { utils.import.getPoProducts.invalidate({ poId }); setShowAddProduct(false); setNewProductCode(''); setNewProductDesc(''); setNewProductNcm(''); setAddCodeSearch(''); toast.success('Produto adicionado!'); },
  });
  const deleteProduct = trpc.import.deletePoProduct.useMutation({
    onSuccess: () => { utils.import.getPoProducts.invalidate({ poId }); toast.success('Produto removido!'); },
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ productCode?: string; ncm?: string; valorPoCheia?: string; valorPoMenor?: string; freteMaritimo?: string; freteTerrestre?: string; incoterm?: string }>({});
  const [taxDetailId, setTaxDetailId] = useState<number | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductCode, setNewProductCode] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductNcm, setNewProductNcm] = useState('');
  const [newProductIncoterm, setNewProductIncoterm] = useState('');
  
  // Product code search for ADD flow
  const [addCodeSearch, setAddCodeSearch] = useState('');
  const [showAddCodeDropdown, setShowAddCodeDropdown] = useState(false);
  const { data: addSearchResults } = trpc.import.searchStockProducts.useQuery(
    { query: addCodeSearch },
    { enabled: addCodeSearch.length >= 2 }
  );
  
  // Product code search for EDIT flow
  const [codeSearch, setCodeSearch] = useState('');
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
  const { data: searchResults } = trpc.import.searchStockProducts.useQuery(
    { query: codeSearch },
    { enabled: codeSearch.length >= 2 }
  );

  if (isLoading) {
    return <div className="p-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>;
  }

  const startEdit = (product: any) => {
    setEditingId(product.id);
    setEditValues({
      productCode: product.productCode || '',
      ncm: product.ncm || '',
      valorPoCheia: product.valorPoCheia || '',
      valorPoMenor: product.valorPoMenor || '',
      freteMaritimo: product.freteMaritimo || '',
      freteTerrestre: product.freteTerrestre || '',
      incoterm: product.incoterm || '',
    });
    setCodeSearch(product.productCode || '');
    setShowCodeDropdown(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateProduct.mutateAsync({ id: editingId, ...editValues });
    setEditingId(null);
    setShowCodeDropdown(false);
  };

  const selectProduct = (code: string, desc: string) => {
    setEditValues({ ...editValues, productCode: code });
    setCodeSearch(code);
    setShowCodeDropdown(false);
  };

  return (
    <div className="border-t border-slate-100 overflow-hidden">
      {/* Add product button */}
      <div className="p-2 flex justify-end border-b border-slate-100">
        <button
          onClick={() => setShowAddProduct(true)}
          className="flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white rounded text-[10px] font-medium hover:bg-emerald-600 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Adicionar Produto
        </button>
      </div>
      {showAddProduct && (
        <div className="p-3 bg-emerald-50 border-b border-emerald-200">
          <div className="flex gap-3 items-end">
            {/* Step 1: Code selector */}
            <div className="w-40 relative">
              <label className="text-[10px] text-slate-500 font-medium">1. Código do Produto</label>
              <input
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono"
                placeholder="Buscar código..."
                value={addCodeSearch}
                onChange={e => { setAddCodeSearch(e.target.value); setShowAddCodeDropdown(true); }}
                onFocus={() => { if (addCodeSearch.length >= 2) setShowAddCodeDropdown(true); }}
                autoFocus
              />
              {showAddCodeDropdown && addSearchResults && addSearchResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 w-72 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                  {addSearchResults.map(item => (
                    <button
                      key={item.codigoItem}
                      onClick={() => {
                        setNewProductCode(item.codigoItem);
                        setNewProductDesc(item.descricaoItem);
                        setAddCodeSearch(item.codigoItem);
                        setShowAddCodeDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-[11px] border-b border-slate-50 last:border-0"
                    >
                      <span className="font-mono font-bold text-blue-600">{item.codigoItem}</span>
                      <span className="ml-2 text-slate-600">{item.descricaoItem}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Step 2: Description (auto-filled) */}
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 font-medium">2. Descrição {newProductDesc && <span className="text-emerald-600">(preenchido)</span>}</label>
              <input
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-slate-50"
                placeholder="Selecione o código acima..."
                value={newProductDesc}
                onChange={e => setNewProductDesc(e.target.value)}
                readOnly={!!newProductCode}
              />
            </div>
            {/* Step 3: NCM */}
            <div className="w-32">
              <label className="text-[10px] text-slate-500 font-medium">3. NCM</label>
              <input
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono"
                placeholder="0000.00.00"
                value={newProductNcm}
                onChange={e => setNewProductNcm(e.target.value)}
              />
            </div>
            {/* Step 4: Incoterm */}
            <div className="w-28">
              <label className="text-[10px] text-slate-500 font-medium">4. Tipo Frete</label>
              <select
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white"
                value={newProductIncoterm}
                onChange={e => setNewProductIncoterm(e.target.value)}
              >
                <option value="">Selecione...</option>
                <option value="EXW">EXW - Ex Works (na fábrica)</option>
                <option value="FOB">FOB - Fornecedor coloca no porto</option>
                <option value="CIF">CIF - Fornecedor entrega em Santos</option>
              </select>
            </div>
            {/* Actions */}
            <button
              onClick={() => { if (!newProductDesc.trim()) { toast.error('Selecione um produto pelo código'); return; } addProduct.mutate({ poId, description: newProductDesc.trim(), productCode: newProductCode || undefined, ncm: newProductNcm || undefined, incoterm: newProductIncoterm || undefined }); }}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 whitespace-nowrap"
            >Adicionar</button>
            <button onClick={() => { setShowAddProduct(false); setAddCodeSearch(''); setNewProductCode(''); setNewProductDesc(''); setNewProductNcm(''); setNewProductIncoterm(''); }} className="p-1 text-slate-500 hover:text-red-500"><X className="w-4 h-4" /></button>
          </div>
          {newProductCode && (
            <p className="mt-1.5 text-[10px] text-emerald-700">✓ Produto selecionado: <span className="font-mono font-bold">{newProductCode}</span> — {newProductDesc}</p>
          )}
        </div>
      )}
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[9px]">
            <th className="px-1.5 py-2 text-left font-medium">Descrição</th>
            <th className="px-1 py-2 text-center font-medium">Cód</th>
            <th className="px-1 py-2 text-center font-medium">NCM</th>
            <th className="px-1 py-2 text-center font-medium">Frete</th>
            <th className="px-1 py-2 text-center font-medium">Un/Cx</th>
            <th className="px-1 py-2 text-center font-medium">Vlr Forn</th>
            <th className="px-1 py-2 text-center font-medium">PO Cheia</th>
            <th className="px-1 py-2 text-center font-medium">PO Meia</th>
            <th className="px-1 py-2 text-center font-medium">Qtd</th>
            <th className="px-1 py-2 text-center font-medium">Fr/Cx</th>
            <th className="px-1 py-2 text-center font-medium">Fr Tot</th>
            <th className="px-1 py-2 text-center font-medium">Vlr Ref</th>
            <th className="px-1 py-2 text-center font-medium">%Rep</th>
            <th className="px-1 py-2 text-center font-medium">Cx R$</th>
            <th className="px-1 py-2 text-center font-medium">Mil/Un</th>
            <th className="px-1 py-2 text-center font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {(products || []).filter(p => (p.quantidade && Number(p.quantidade) > 0) || editingId === p.id).map((prod, idx) => (
            <tr key={prod.id} className={`border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-blue-50/30`}>
              <td className="px-1.5 py-1.5 text-slate-700 max-w-[200px] truncate" title={prod.description}>{prod.description}</td>
              <td className="px-1 py-1.5 text-center relative">
                {editingId === prod.id ? (
                  <div className="relative">
                    <input
                      className="w-16 text-center border border-blue-300 rounded px-1 py-0.5 text-[10px]"
                      value={codeSearch}
                      onChange={e => { setCodeSearch(e.target.value); setEditValues({ ...editValues, productCode: e.target.value }); setShowCodeDropdown(true); }}
                      onFocus={() => { if (codeSearch.length >= 2) setShowCodeDropdown(true); }}
                      placeholder="Buscar..."
                    />
                    {showCodeDropdown && searchResults && searchResults.length > 0 && (
                      <div className="absolute z-50 top-full left-0 mt-1 w-64 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                        {searchResults.map(item => (
                          <button
                            key={item.codigoItem}
                            onClick={() => selectProduct(item.codigoItem, item.descricaoItem)}
                            className="w-full text-left px-2 py-1.5 hover:bg-blue-50 text-[10px] border-b border-slate-50 last:border-0"
                          >
                            <span className="font-mono font-bold text-blue-600">{item.codigoItem}</span>
                            <span className="ml-2 text-slate-600 truncate">{item.descricaoItem}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className={`font-mono ${prod.productCode ? 'text-blue-600' : 'text-slate-300'}`}>
                    {prod.productCode || '—'}
                  </span>
                )}
              </td>
              <td className="px-1 py-1.5 text-center">
                {editingId === prod.id ? (
                  <input
                    className="w-18 text-center border border-blue-300 rounded px-1 py-0.5 text-[10px]"
                    value={editValues.ncm || ''}
                    onChange={e => setEditValues({ ...editValues, ncm: e.target.value })}
                    placeholder="0000.00.00"
                  />
                ) : (
                  <span className={`font-mono ${prod.ncm ? 'text-emerald-600' : 'text-slate-300'}`}>
                    {prod.ncm || '—'}
                  </span>
                )}
              </td>
              <td className="px-1 py-1.5 text-center">
                {editingId === prod.id ? (
                  <select
                    className="w-14 text-center border border-blue-300 rounded px-0.5 py-0.5 text-[9px]"
                    value={editValues.incoterm || ''}
                    onChange={e => setEditValues({ ...editValues, incoterm: e.target.value })}
                  >
                    <option value="">—</option>
                    <option value="EXW">EXW</option>
                    <option value="FOB">FOB</option>
                    <option value="CIF">CIF</option>
                  </select>
                ) : (
                  <span className={`font-mono text-[9px] px-1 py-0.5 rounded ${prod.incoterm === 'CIF' ? 'bg-green-100 text-green-700' : prod.incoterm === 'FOB' ? 'bg-blue-100 text-blue-700' : prod.incoterm === 'EXW' ? 'bg-amber-100 text-amber-700' : 'text-slate-300'}`}>
                    {prod.incoterm || '—'}
                  </span>
                )}
              </td>
              <td className="px-1 py-1.5 text-center text-slate-600 font-mono">{prod.unidCaixa || '—'}</td>
              <td className="px-1 py-1.5 text-center text-slate-600 font-mono">
                {prod.valorUsd ? (currency === "USD" ? `$${Number(prod.valorUsd).toFixed(2)}` : `R$ ${(Number(prod.valorUsd) * exchangeRate).toFixed(2)}`) : '—'}
              </td>
              <td className="px-1 py-1.5 text-center">
                {editingId === prod.id ? (
                  <input
                    className="w-14 text-center border border-blue-300 rounded px-1 py-0.5 text-[10px]"
                    value={editValues.valorPoCheia || ''}
                    onChange={e => setEditValues({ ...editValues, valorPoCheia: e.target.value })}
                    placeholder="0.00"
                  />
                ) : (
                  <span className="font-mono text-slate-600">
                    {prod.valorPoCheia ? (currency === "USD" ? `$${Number(prod.valorPoCheia).toFixed(2)}` : `R$ ${(Number(prod.valorPoCheia) * exchangeRate).toFixed(2)}`) : '—'}
                  </span>
                )}
              </td>
              <td className="px-1 py-1.5 text-center">
                {editingId === prod.id ? (
                  <input
                    className="w-14 text-center border border-blue-300 rounded px-1 py-0.5 text-[10px]"
                    value={editValues.valorPoMenor || ''}
                    onChange={e => setEditValues({ ...editValues, valorPoMenor: e.target.value })}
                    placeholder="0.00"
                  />
                ) : (
                  <span className="font-mono text-slate-600">
                    {prod.valorPoMenor ? (currency === "USD" ? `$${Number(prod.valorPoMenor).toFixed(2)}` : `R$ ${(Number(prod.valorPoMenor) * exchangeRate).toFixed(2)}`) : '—'}
                  </span>
                )}
              </td>
              <td className="px-1 py-1.5 text-center text-slate-600 font-mono">{prod.quantidade || '—'}</td>
              <td className="px-1 py-1.5 text-center font-mono text-orange-600">
                {(() => {
                  const ci = Number(prod.valorPoCheia || 0);
                  const val = Number(prod.valorUsd || 0);
                  const freteCx = ci > 0 && val > 0 ? ci - val : 0;
                  const rawVal = freteCx > 0 ? freteCx : (prod.totalFreightUsd && prod.quantidade ? Number(prod.totalFreightUsd) / Number(prod.quantidade) : 0);
                  if (!rawVal) return '—';
                  return currency === "USD" ? `$${rawVal.toFixed(2)}` : `R$ ${(rawVal * exchangeRate).toFixed(2)}`;
                })()}
              </td>
              <td className="px-1 py-1.5 text-center font-mono text-orange-700 font-semibold">
                {(() => {
                  const ci = Number(prod.valorPoCheia || 0);
                  const val = Number(prod.valorUsd || 0);
                  const qty = Number(prod.quantidade || 0);
                  const freteCx = ci > 0 && val > 0 ? ci - val : 0;
                  const freteTotal = freteCx > 0 && qty > 0 ? freteCx * qty : 0;
                  const rawVal = freteTotal > 0 ? freteTotal : (prod.totalFreightUsd ? Number(prod.totalFreightUsd) : 0);
                  if (!rawVal) return '—';
                  return currency === "USD" ? `$${rawVal.toFixed(2)}` : `R$ ${(rawVal * exchangeRate).toFixed(2)}`;
                })()}
              </td>
              <td className="px-1 py-1.5 text-center font-mono text-slate-600">
                {prod.valorReferencia ? (currency === "USD" ? `$${Number(prod.valorReferencia).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `R$ ${(Number(prod.valorReferencia) * exchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`) : '—'}
              </td>
              <td className="px-1 py-1.5 text-center font-mono text-slate-500">
                {prod.percRepresentatividade ? `${(Number(prod.percRepresentatividade) * 100).toFixed(2)}%` : '—'}
              </td>
              <td className="px-1 py-1.5 text-center font-mono text-emerald-700 font-semibold">
                {prod.valorCaixaBrl ? (currency === "BRL" ? `R$ ${Number(prod.valorCaixaBrl).toFixed(2)}` : `$${(Number(prod.valorCaixaBrl) / exchangeRate).toFixed(2)}`) : '—'}
              </td>
              <td className="px-1 py-1.5 text-center font-mono text-blue-700 font-medium">
                {prod.precoMilUnid ? (currency === "BRL" ? `R$ ${Number(prod.precoMilUnid).toFixed(2)}` : `$${(Number(prod.precoMilUnid) / exchangeRate).toFixed(2)}`) : '—'}
              </td>
              <td className="px-1 py-1.5 text-center">
                {editingId === prod.id ? (
                  <div className="flex gap-1 justify-center">
                    <button onClick={saveEdit} className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditingId(null); setShowCodeDropdown(false); }} className="p-0.5 text-red-500 hover:bg-red-50 rounded">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => startEdit(prod)} className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (confirm('Remover produto?')) deleteProduct.mutate({ id: prod.id }); }} className="p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(products || []).length === 0 && (
        <p className="text-center text-slate-400 text-xs py-6">Nenhum produto nesta PO. Clique em "Adicionar Produto" para começar.</p>
      )}
      {(products || []).length > 0 && (products || []).filter(p => p.quantidade && Number(p.quantidade) > 0).length === 0 && (
        <p className="text-center text-slate-400 text-xs py-4">Nenhum produto preenchido nesta PO. ({(products || []).length} produtos cadastrados sem dados de QTD CX)</p>
      )}
    </div>
  );
}
