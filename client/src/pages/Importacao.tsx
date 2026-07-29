/**
 * Importação - Aba de controle de importações
 * Sub-abas:
 * 1. Relação de Pagamentos com Fornecedores Chineses
 * 2. Custo da Mercadoria
 * 
 * REGRA: TODOS os campos são 100% manuais. NENHUM auto-cálculo.
 * Larissa pode atualizar qualquer campo a qualquer momento e salvar.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import TopNav from "@/components/TopNav";
import { useOperator } from "@/contexts/OperatorContext";
import { Ship, Receipt, Calculator, Plus, Pencil, Trash2, X, Check, Package, ChevronDown, ChevronUp, DollarSign, AlertCircle, Layers, ArrowLeftRight, RefreshCw, FileDown, Loader2, Bell, XCircle, Navigation, Settings, Search, MapPin, FileText, ArrowUpDown, Eye, Download, TrendingUp, Upload, Anchor, CalendarDays, CheckCircle, Table2 } from "lucide-react";
import { SpreadsheetTable } from "@/components/SpreadsheetTable";
import { TrackingModal } from "@/components/TrackingModal";
import { RastreioEmConjunto } from "@/components/RastreioEmConjunto";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type SubTab = "pagamentos" | "custo" | "rastreio";

export default function Importacao() {
  const { hasGranularAccess } = useOperator();
  const [activeTab, setActiveTab] = useState<SubTab>(() => {
    // Default to first accessible tab
    if (hasGranularAccess("imp.pagamentos")) return "pagamentos";
    if (hasGranularAccess("imp.custo")) return "custo";
    if (hasGranularAccess("imp.rastreio")) return "rastreio";
    return "pagamentos";
  });

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
          {hasGranularAccess("imp.pagamentos") && (
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
          )}
          {hasGranularAccess("imp.custo") && (
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
          )}
          {hasGranularAccess("imp.rastreio") && (
          <button
            onClick={() => setActiveTab("rastreio")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === "rastreio"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
            }`}
          >
            <Navigation className="w-4 h-4 shrink-0" />
            <span className="text-left leading-tight">Rastreio em Conjunto</span>
          </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4">
        {activeTab === "pagamentos" && hasGranularAccess("imp.pagamentos") && <PagamentosFornecedores />}
        {activeTab === "custo" && hasGranularAccess("imp.custo") && <CustoMercadoria />}
        {activeTab === "rastreio" && hasGranularAccess("imp.rastreio") && <RastreioEmConjunto />}
      </div>
    </div>
  );
}

// ===== PAGAMENTOS FORNECEDORES =====

function PagamentosFornecedores() {
  const { data: fullData, isLoading, refetch } = trpc.import.getFullData.useQuery();
  const { data: exchangeData } = trpc.import.getExchangeRate.useQuery(undefined, { refetchInterval: 5 * 60 * 1000 });
  const { data: activeAlerts, refetch: refetchAlerts } = trpc.import.getActiveAlerts.useQuery();
  const dismissAlert = trpc.import.dismissAlert.useMutation({
    onSuccess: () => { refetchAlerts(); toast.success("Alerta dispensado"); },
    onError: () => toast.error("Erro ao dispensar alerta"),
  });
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCategory, setNewSupplierCategory] = useState("");
  const [currency, setCurrency] = useState<"USD" | "BRL" | "RMB">("USD");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [trackingUuid, setTrackingUuid] = useState<string | null>(null);
  const [trackingBl, setTrackingBl] = useState<string | null>(null);
  const [trackingContainer, setTrackingContainer] = useState<string | null>(null);
  const [trackingArmador, setTrackingArmador] = useState<string | null>(null);
  const [trackingSupplier, setTrackingSupplier] = useState<string | null>(null);
  const [trackingPo, setTrackingPo] = useState<string | null>(null);
  const [trackingProducts, setTrackingProducts] = useState<Array<{ description: string; quantidade?: number | null }> | null>(null);

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
  const rmbRate = (exchangeData as any)?.rmbRate || 7.25;
  // Cross rate for direct RMB→BRL (avoids USD intermediate rounding errors)
  const crossRateBrl: number = (exchangeData as any)?.crossRateBrl || (exchangeRate / rmbRate);
  const convertValue = (val: number) => {
    if (currency === "BRL") return val * exchangeRate;
    if (currency === "RMB") return val * rmbRate;
    return val;
  };
  const currencySymbol = currency === "USD" ? "$" : currency === "BRL" ? "R$" : "¥";
  const currencyLabel = currency === "USD" ? "USD" : currency === "BRL" ? "BRL" : "RMB";

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
      <div className="sticky top-12 z-30 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 backdrop-blur-sm -mx-4 px-4 pt-2 pb-3 space-y-3 border-b border-slate-200/60 shadow-sm">
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
              Cotação: <strong className="text-slate-700">1 USD = R$ {exchangeRate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | 1 USD = ¥ {rmbRate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | 1 RMB = R$ {crossRateBrl.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</strong>
            </span>
          )}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 ${
            currency === "USD"
              ? "bg-blue-100 border-blue-400 text-blue-800"
              : currency === "BRL"
                ? "bg-green-100 border-green-400 text-green-800"
                : "bg-red-100 border-red-400 text-red-800"
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              currency === "USD" ? "bg-blue-500" : currency === "BRL" ? "bg-green-500" : "bg-red-500"
            }`}></span>
            {currency === "USD" ? "DÓLAR (USD)" : currency === "BRL" ? "REAL (BRL)" : "RENMINBI (RMB)"}
          </div>
          <button
            onClick={() => setCurrency(prev => prev === "USD" ? "RMB" : prev === "RMB" ? "BRL" : "USD")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-all shadow-sm ${
              currency === "USD"
                ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                : currency === "BRL"
                  ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                  : "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            {currency === "USD" ? "USD → RMB" : currency === "RMB" ? "RMB → BRL" : "BRL → USD"}  
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
            {currencySymbol}{" "}{convertValue(grandTotals.totalUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-xs text-slate-500 uppercase font-medium">Total Pago ({currencyLabel})</span>
          </div>
          <p className="text-xl font-bold text-green-700 whitespace-nowrap">
            {currencySymbol}{" "}{convertValue(grandTotals.totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-slate-500 uppercase font-medium">Saldo Devedor ({currencyLabel})</span>
          </div>
          <p className="text-xl font-bold text-red-700 whitespace-nowrap">
            {currencySymbol}{" "}{convertValue(grandTotals.saldoTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        <SupplierSection key={supplier.id} supplier={supplier} onRefetch={refetch} currency={currency} exchangeRate={exchangeRate} rmbRate={rmbRate} onTrack={(uuid) => setTrackingUuid(uuid)} onTrackBl={(bl) => setTrackingBl(bl)} onTrackAi={(container, armador, bl, supplierName, poNumber, products) => { setTrackingContainer(container); setTrackingArmador(armador); if (bl) setTrackingBl(bl); setTrackingSupplier(supplierName || null); setTrackingPo(poNumber || null); setTrackingProducts(products || null); }} />
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
      {(trackingUuid || trackingBl || trackingContainer) && (
        <TrackingModal
          trackingUuid={trackingUuid}
          blNumber={trackingBl}
          containerNumber={trackingContainer}
          armador={trackingArmador}
          poNumber={trackingPo}
          supplierName={trackingSupplier}
          products={trackingProducts}
          onClose={() => { setTrackingUuid(null); setTrackingBl(null); setTrackingContainer(null); setTrackingArmador(null); setTrackingSupplier(null); setTrackingPo(null); setTrackingProducts(null); }}
        />
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
  armador: string | null;
  arrivalDate: string | null;
  alertDaysBefore: number | null;
  alertDismissed: boolean;
  cells?: Record<string, string> | null;
}

interface SupplierData {
  id: number;
  name: string;
  category: string | null;
  displayOrder: number;
  payments: PaymentData[];
}

function SupplierSection({ supplier, onRefetch, currency, exchangeRate, rmbRate, onTrack, onTrackBl, onTrackAi }: { supplier: SupplierData; onRefetch: () => void; currency: "USD" | "BRL" | "RMB"; exchangeRate: number; rmbRate: number; onTrack: (uuid: string) => void; onTrackBl: (bl: string) => void; onTrackAi: (container: string, armador: string | null, bl?: string | null, supplierName?: string | null, poNumber?: string | null, products?: Array<{ description: string; quantidade?: number | null }> | null) => void }) {
  
  const convertValue = (val: number) => {
    if (currency === "BRL") return val * exchangeRate;
    if (currency === "RMB") return val * rmbRate;
    return val;
  };
  const currencySymbol = currency === "USD" ? "$" : currency === "BRL" ? "R$" : "¥";
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
              : currency === "BRL"
                ? "bg-green-100 border-green-400 text-green-800"
                : "bg-red-100 border-red-400 text-red-800"
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${currency === "USD" ? "bg-blue-500" : currency === "BRL" ? "bg-green-500" : "bg-red-500"}`}></span>
            {currency === "USD" ? "DÓLAR (USD)" : currency === "BRL" ? "REAL (BRL)" : "RENMINBI (RMB)"}
          </div>
          <div className="hidden sm:flex items-center gap-0 text-xs">
            <div className="text-right w-[140px]">
              <span className="text-slate-400">Total</span>
              <p className="font-semibold text-slate-700 whitespace-nowrap">{currencySymbol}{" "}{convertValue(totals.totalUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right w-[120px]">
              <span className="text-slate-400">Pago</span>
              <p className="font-semibold text-green-600 whitespace-nowrap">{currencySymbol}{" "}{convertValue(totals.totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right w-[140px]">
              <span className="text-slate-400">Saldo Devedor</span>
              <p className="font-semibold text-red-600 whitespace-nowrap">{currencySymbol}{" "}{convertValue(totals.saldoDevedorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
            <p className="text-xs font-semibold text-slate-700 whitespace-nowrap">{currencySymbol}{" "}{convertValue(totals.totalUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="text-center bg-green-50 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 block">Pago</span>
            <p className="text-xs font-semibold text-green-600 whitespace-nowrap">{currencySymbol}{" "}{convertValue(totals.totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="text-center bg-red-50 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 block">Devedor</span>
            <p className="text-xs font-semibold text-red-600 whitespace-nowrap">{currencySymbol}{" "}{convertValue(totals.saldoDevedorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
              rmbRate={rmbRate}
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
              onTrackAi={onTrackAi}
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
  rmbRate,
  totalSections,
  onRemoveSection,
  onRenameSection,
  onTrack,
  onTrackBl,
  onTrackAi,
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
  currency: "USD" | "BRL" | "RMB";
  exchangeRate: number;
  rmbRate: number;
  totalSections: number;
  onRemoveSection?: (sectionTitle: string) => void;
  onRenameSection?: (oldTitle: string, newTitle: string) => void;
  onTrack?: (uuid: string) => void;
  onTrackBl?: (bl: string) => void;
  onTrackAi?: (container: string, armador: string | null, bl?: string | null, supplierName?: string | null, poNumber?: string | null, products?: Array<{ description: string; quantidade?: number | null }> | null) => void;
  isWinnie?: boolean;
}) {
  
  const convertValue = (val: number) => {
    if (currency === "BRL") return val * exchangeRate;
    if (currency === "RMB") return val * rmbRate;
    return val;
  };
  const currencySymbol = currency === "USD" ? "$" : currency === "BRL" ? "R$" : "¥";
  const [showAddRow, setShowAddRow] = useState(false);
  const [spreadsheetMode, setSpreadsheetMode] = useState(false); // Default to visualização mode
  const [editingSectionTitle, setEditingSectionTitle] = useState(false);
  const [editSectionName, setEditSectionName] = useState("");
  const [editSectionSubtitle, setEditSectionSubtitle] = useState("");

  // Spreadsheet config query - always enabled so custom columns show in visualization mode too
  const spreadsheetConfig = trpc.import.getSpreadsheetConfig.useQuery(
    { supplierId, sectionTitle: sectionTitle || undefined }
  );
  const updateConfigMut = trpc.import.updateSpreadsheetConfig.useMutation({
    onSuccess: () => spreadsheetConfig.refetch(),
  });
  const updateCellsMut = trpc.import.updatePaymentCells.useMutation({
    onSuccess: () => onRefetch(),
    onError: (err) => toast.error(`Erro ao salvar: ${err.message}`),
  });
  const addRowMut = trpc.import.addSpreadsheetRow.useMutation({
    onSuccess: () => onRefetch(),
  });
  const deletePaymentMut = trpc.import.deletePayment.useMutation({
    onSuccess: () => { onRefetch(); toast.success("Linha removida"); },
  });
  const moveRowMut = trpc.import.moveSpreadsheetRow.useMutation({
    onSuccess: () => onRefetch(),
  });

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
        const parts = sectionTitle.split(/ [–-] /);
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

      {/* Mode toggle */}
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-slate-50">
        <button
          onClick={() => setSpreadsheetMode(!spreadsheetMode)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
            spreadsheetMode
              ? "bg-blue-100 text-blue-700 border border-blue-200"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200"
          }`}
          title={spreadsheetMode ? "Modo planilha (editável)" : "Modo visualização"}
        >
          <Table2 className="w-3 h-3" />
          {spreadsheetMode ? "Planilha" : "Visualização"}
        </button>
      </div>

      {/* Spreadsheet mode */}
      {spreadsheetMode && spreadsheetConfig.data ? (
        <div className="px-3 py-2">
          <SpreadsheetTable
            supplierId={supplierId}
            sectionTitle={sectionTitle}
            columns={spreadsheetConfig.data.columns || []}
            rows={payments.map(p => ({
              id: p.id,
              cells: (p as any).cells || {
                status: p.status || "",
                pedido: p.pedido || "",
                doc: p.doc || "",
                totalUsd: String(p.totalUsd || "0"),
                totalBrasilUsd: String(p.totalBrasilUsd || "0"),
                totalParaguaiUsd: String(p.totalParaguaiUsd || "0"),
                brasilUsd: String(p.brasilUsd || "0"),
                paraguaiUsd: String(p.paraguaiUsd || "0"),
                totalPago: String(p.totalPago || "0"),
                saldoDevedorBrasil: String(p.saldoDevedorBrasil || "0"),
                saldoDevedorParaguai: String(p.saldoDevedorParaguai || "0"),
                saldoDevedorTotal: String(p.saldoDevedorTotal || "0"),
                rastreio: p.rastreio || "",
                arrivalDate: (p as any).arrivalDate || "",
              },
            }))}
            onColumnsChange={(cols) => {
              updateConfigMut.mutate({
                supplierId,
                sectionTitle: sectionTitle || undefined,
                columns: cols,
              });
            }}
            onCellChange={(rowId, cells) => {
              updateCellsMut.mutate({ id: rowId, cells });
            }}
            onAddRow={() => {
              addRowMut.mutate({
                supplierId,
                sectionTitle: sectionTitle || undefined,
                cells: {},
              });
            }}
            onDeleteRow={(rowId) => {
              deletePaymentMut.mutate({ id: rowId });
            }}
            onMoveRow={(rowId, direction) => {
              moveRowMut.mutate({ id: rowId, direction, supplierId, sectionTitle: sectionTitle || undefined });
            }}
            currency={currency}
            exchangeRate={exchangeRate}
            rmbRate={rmbRate}
          />
        </div>
      ) : spreadsheetMode && !spreadsheetConfig.data ? (
        <div className="px-4 py-8 text-center text-slate-400 text-xs">
          Carregando configuração da planilha...
        </div>
      ) : (
      /* Original table mode */
      <>
      {/* Table - scrollable on mobile */}
      <div className="overflow-x-auto -mx-2 px-2 pb-1">
      <table className={`${isWinnie ? 'min-w-[1150px]' : 'min-w-[1050px]'} w-full text-[11px] border-collapse`}>
        <thead>
          <tr>
            <th colSpan={isWinnie ? 4 : 3} className="bg-white"></th>
            <th colSpan={3} className="bg-blue-50 px-2 py-1.5 text-center font-bold text-[11px] uppercase tracking-wider text-blue-700 border-b-2 border-blue-400 whitespace-nowrap">Total a pagar</th>
            <th colSpan={3} className="bg-green-50 px-2 py-1.5 text-center font-bold text-[11px] uppercase tracking-wider text-green-700 border-b-2 border-green-400 whitespace-nowrap">O que pagou</th>
            <th colSpan={3} className="bg-red-50 px-2 py-1.5 text-center font-bold text-[11px] uppercase tracking-wider text-red-600 border-b-2 border-red-400 whitespace-nowrap">O que falta pagar</th>
            <th colSpan={1 + (spreadsheetConfig.data?.columns?.filter((c: any) => c.key.startsWith('custom_')).length || 0) + 1} className="bg-white"></th>
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
            {/* Custom columns from spreadsheet config */}
            {spreadsheetConfig.data?.columns?.filter((c: any) => c.key.startsWith('custom_')).map((col: any) => (
              <th key={col.key} className="px-2 py-2 text-center font-semibold whitespace-nowrap min-w-[70px] bg-yellow-50/50">{col.name}</th>
            ))}
            <th className="px-1 py-2 text-center font-semibold min-w-[30px]"></th>
          </tr>
        </thead>
        <tbody>
          {payments.map(payment => (
            editingId === payment.id ? (
              <EditPaymentRow key={payment.id} payment={payment} onCancel={() => setEditingId(null)} onRefetch={onRefetch} isWinnie={isWinnie} currency={currency} exchangeRate={exchangeRate} rmbRate={rmbRate} customColumns={spreadsheetConfig.data?.columns?.filter((c: any) => c.key.startsWith('custom_')) || []} />
            ) : (
              <PaymentRow key={payment.id} payment={payment} supplierName={supplierName} onEdit={() => setEditingId(payment.id)} onRefetch={onRefetch} onTrack={onTrack} onTrackBl={onTrackBl} onTrackAi={onTrackAi} currency={currency} exchangeRate={exchangeRate} rmbRate={rmbRate} isWinnie={isWinnie} customColumns={spreadsheetConfig.data?.columns?.filter((c: any) => c.key.startsWith('custom_')) || []} />
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
              currency={currency}
              exchangeRate={exchangeRate}
              rmbRate={rmbRate}
              customColumns={spreadsheetConfig.data?.columns?.filter((c: any) => c.key.startsWith('custom_')) || []}
            />
          )}
          {/* Totals row */}
          {payments.length > 0 && (
            <tr className="bg-slate-50 font-semibold border-t border-slate-200">
              <td className="px-2 py-2 text-slate-700" colSpan={isWinnie ? 4 : 3}>TOTAIS</td>
              <td className="px-2 py-2 text-center text-blue-700 whitespace-nowrap">{sectionTotals.totalUsd ? `${currencySymbol} ${convertValue(sectionTotals.totalUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}</td>
              <td className="px-2 py-2 text-center text-blue-700 whitespace-nowrap">{sectionTotals.totalBrasilUsd ? `${currencySymbol} ${convertValue(sectionTotals.totalBrasilUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}</td>
              <td className="px-2 py-2 text-center text-blue-700 whitespace-nowrap">{sectionTotals.totalParaguaiUsd ? `${currencySymbol} ${convertValue(sectionTotals.totalParaguaiUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}</td>
              <td className="px-2 py-2 text-center text-green-700 whitespace-nowrap">{sectionTotals.brasilUsd ? `${currencySymbol} ${convertValue(sectionTotals.brasilUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}</td>
              <td className="px-2 py-2 text-center text-green-700 whitespace-nowrap">{sectionTotals.paraguaiUsd ? `${currencySymbol} ${convertValue(sectionTotals.paraguaiUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}</td>
              <td className="px-2 py-2 text-center text-green-700 whitespace-nowrap">{sectionTotals.totalPago ? `${currencySymbol} ${convertValue(sectionTotals.totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}</td>
              <td className="px-2 py-2 text-center text-red-600 whitespace-nowrap">{`${currencySymbol} ${convertValue(sectionTotals.saldoDevedorBrasil || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td>
              <td className="px-2 py-2 text-center text-red-600 whitespace-nowrap">{`${currencySymbol} ${convertValue(sectionTotals.saldoDevedorParaguai || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td>
              <td className="px-2 py-2 text-center text-red-700 whitespace-nowrap">{`${currencySymbol} ${convertValue(sectionTotals.saldoDevedorTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td>
              <td className="px-2 py-2"></td>
              {/* Empty cells for custom columns */}
              {spreadsheetConfig.data?.columns?.filter((c: any) => c.key.startsWith('custom_')).map((col: any) => (
                <td key={col.key} className="px-2 py-2"></td>
              ))}
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
      </>
      )}
    </div>
  );
}

// ===== PAYMENT ROW (display only - all fields manual) =====

function PaymentRow({ payment, supplierName, onEdit, onRefetch, onTrack, onTrackBl, onTrackAi, currency, exchangeRate, rmbRate, isWinnie = false, customColumns = [] }: { payment: PaymentData; supplierName?: string; onEdit: () => void; onRefetch: () => void; onTrack?: (uuid: string) => void; onTrackBl?: (bl: string) => void; onTrackAi?: (container: string, armador: string | null, bl?: string | null, supplierName?: string | null, poNumber?: string | null, products?: Array<{ description: string; quantidade?: number | null }> | null) => void; currency: "USD" | "BRL" | "RMB"; exchangeRate: number; rmbRate: number; isWinnie?: boolean; customColumns?: Array<{ key: string; name: string; type: string }> }) {
  
  const convertValue = (val: number) => {
    if (currency === "BRL") return val * exchangeRate;
    if (currency === "RMB") return val * rmbRate;
    return val;
  };
  const currencySymbol = currency === "USD" ? "$" : currency === "BRL" ? "R$" : "¥";

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
    return <span className="whitespace-nowrap font-mono tabular-nums">{currencySymbol}{" "}{converted.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
  };

  // Green section: show "-" when empty/zero
  const fmtGreen = (v: string | null) => {
    const n = parseFloat(String(v || "0"));
    if (n === 0) return <span className="text-slate-300">-</span>;
    const converted = convertValue(n);
    return <span className="whitespace-nowrap font-mono tabular-nums">{currencySymbol}{" "}{converted.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
  };

  // Red section: show "$ 0,00" when empty/zero
  const fmtRed = (v: string | null) => {
    const n = parseFloat(String(v || "0"));
    const converted = convertValue(n);
    return <span className="whitespace-nowrap font-mono tabular-nums">{currencySymbol}{" "}{converted.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
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
          {payment.rastreio && payment.armador ? (
            <button
              onClick={() => onTrackAi && onTrackAi(payment.rastreio!, payment.armador, payment.blNumber, supplierName || null, payment.pedido || null, null)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md text-purple-700 font-mono text-[10px] font-medium transition-colors"
              title="Rastrear via Logcomex AI (dados mais atualizados)"
            >
              <Navigation className="w-3 h-3" />
              {payment.rastreio}
            </button>
          ) : (payment.blNumber || payment.trackingUuid) ? (
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
            <button
              onClick={() => onTrackAi && onTrackAi(payment.rastreio!, payment.armador, payment.blNumber, supplierName || null, payment.pedido || null, null)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md text-purple-700 font-mono text-[10px] font-medium transition-colors"
              title="Rastrear via Logcomex AI"
            >
              <Navigation className="w-3 h-3" />
              {payment.rastreio}
            </button>
          ) : (
            <span className="text-slate-300 text-[10px]">-</span>
          )}
          {payment.blNumber && (
            <span className="text-[9px] text-slate-500 font-mono">{payment.blNumber}</span>
          )}
        </div>
      </td>
      {/* Custom columns */}
      {customColumns.map(col => (
        <td key={col.key} className="px-2 py-2 text-center bg-yellow-50/30 whitespace-nowrap">
          <span className="text-[11px] text-slate-700">{payment.cells?.[col.key] || <span className="text-slate-300">-</span>}</span>
        </td>
      ))}
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

function EditPaymentRow({ payment, onCancel, onRefetch, isWinnie = false, currency = "USD", exchangeRate = 5.50, rmbRate = 7.25, customColumns = [] }: { payment: PaymentData; onCancel: () => void; onRefetch: () => void; isWinnie?: boolean; currency?: "USD" | "BRL" | "RMB"; exchangeRate?: number; rmbRate?: number; customColumns?: Array<{ key: string; name: string; type: string }> }) {
  
  
  // Convert USD to display currency
  const fromUsd = (val: number) => {
    if (currency === "BRL") return val * exchangeRate;
    if (currency === "RMB") return val * rmbRate;
    return val;
  };
  // Convert display currency back to USD (10 decimal places to avoid cent discrepancies)
  const toUsd = (val: string) => {
    const num = parseFloat(val) || 0;
    if (currency === "BRL") return String(num / exchangeRate);
    if (currency === "RMB") return String(num / rmbRate);
    return String(num);
  };
  const displayVal = (usdVal: number | string | null) => {
    const num = parseFloat(String(usdVal || 0)) || 0;
    const converted = fromUsd(num);
    return converted ? String(Math.round(converted * 100) / 100) : "0";
  };
  const [form, setForm] = useState({
    status: payment.status,
    pedido: payment.pedido,
    doc: payment.doc,
    totalUsd: displayVal(payment.totalUsd),
    totalBrasilUsd: displayVal(payment.totalBrasilUsd),
    totalParaguaiUsd: displayVal(payment.totalParaguaiUsd),
    brasilUsd: displayVal(payment.brasilUsd),
    paraguaiUsd: displayVal(payment.paraguaiUsd),
    totalPago: displayVal(payment.totalPago),
    saldoDevedorBrasil: displayVal(payment.saldoDevedorBrasil),
    saldoDevedorParaguai: displayVal(payment.saldoDevedorParaguai),
    saldoDevedorTotal: displayVal(payment.saldoDevedorTotal),
    rastreio: payment.rastreio || "",
    trackingUuid: payment.trackingUuid || "",
    blNumber: payment.blNumber || "",
    armador: payment.armador || "",
    arrivalDate: payment.arrivalDate || "",
    alertDaysBefore: payment.alertDaysBefore !== null ? String(payment.alertDaysBefore) : "",
    sectionTitle: payment.sectionTitle || "",
  });
  // Custom column values from cells JSON
  const [customCells, setCustomCells] = useState<Record<string, string>>(() => {
    const cells = payment.cells || {};
    const result: Record<string, string> = {};
    for (const col of customColumns) {
      result[col.key] = cells[col.key] || "";
    }
    return result;
  });

  const updatePayment = trpc.import.updatePayment.useMutation({
    onSuccess: () => { onRefetch(); onCancel(); toast.success("Pedido atualizado!"); },
    onError: () => toast.error("Erro ao atualizar"),
  });
  const updateCellsMut = trpc.import.updatePaymentCells.useMutation({
    onSuccess: () => onRefetch(),
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
<input type="number" step="any" value={form.totalUsd} onChange={e => setForm({ ...form, totalUsd: e.target.value })} className={`${inputClass} text-right`} />
       </td>
       <td className="px-1 py-1.5">
         <input type="number" step="any" value={form.totalBrasilUsd} onChange={e => setForm({ ...form, totalBrasilUsd: e.target.value })} className={`${inputClass} text-right`} />
       </td>
       <td className="px-1 py-1.5">
         <input type="number" step="any" value={form.totalParaguaiUsd} onChange={e => setForm({ ...form, totalParaguaiUsd: e.target.value })} className={`${inputClass} text-right`} />
       </td>
       {/* GREEN: O que pagou */}
       <td className="px-1 py-1.5">
         <input type="number" step="any" value={form.brasilUsd} onChange={e => setForm({ ...form, brasilUsd: e.target.value })} className={`${inputClass} text-right`} />
       </td>
       <td className="px-1 py-1.5">
         <input type="number" step="any" value={form.paraguaiUsd} onChange={e => setForm({ ...form, paraguaiUsd: e.target.value })} className={`${inputClass} text-right`} />
       </td>
       <td className="px-1 py-1.5">
         <input type="number" step="any" value={form.totalPago} onChange={e => setForm({ ...form, totalPago: e.target.value })} className={`${inputClass} text-right`} />
       </td>
       {/* RED: O que falta pagar */}
       <td className="px-1 py-1.5">
         <input type="number" step="any" value={form.saldoDevedorBrasil} onChange={e => setForm({ ...form, saldoDevedorBrasil: e.target.value })} className={`${inputClass} text-right`} />
       </td>
       <td className="px-1 py-1.5">
         <input type="number" step="any" value={form.saldoDevedorParaguai} onChange={e => setForm({ ...form, saldoDevedorParaguai: e.target.value })} className={`${inputClass} text-right`} />
       </td>
       <td className="px-1 py-1.5">
         <input type="number" step="any" value={form.saldoDevedorTotal} onChange={e => setForm({ ...form, saldoDevedorTotal: e.target.value })} className={`${inputClass} text-right`} />
      </td>
      <td className="px-1 py-1.5">
        <div className="flex flex-col gap-1">
          <input value={form.blNumber} onChange={e => setForm({ ...form, blNumber: e.target.value })} className={`${inputClass} font-mono`} placeholder="Nº BL (ex: ONEYXMNG50123700)" />
          <input value={form.rastreio} onChange={e => setForm({ ...form, rastreio: e.target.value })} className={`${inputClass} text-[9px]`} placeholder="Container (opcional)" />
          <select value={form.armador} onChange={e => setForm({ ...form, armador: e.target.value })} className={`${inputClass} text-[9px]`}>
            <option value="">Armador (AI)</option>
            <option value="ONE">ONE</option>
            <option value="MSC">MSC</option>
            <option value="MAERSK">MAERSK</option>
            <option value="CMA CGM">CMA CGM</option>
            <option value="HAPAG-LLOYD">HAPAG-LLOYD</option>
            <option value="EVERGREEN">EVERGREEN</option>
            <option value="COSCO">COSCO</option>
            <option value="YANG MING">YANG MING</option>
            <option value="HMM">HMM</option>
            <option value="ZIM">ZIM</option>
            <option value="PIL">PIL</option>
            <option value="WAN HAI">WAN HAI</option>
            <option value="OOCL">OOCL</option>
          </select>
          <input value={form.trackingUuid} onChange={e => {
            let val = e.target.value;
            const match = val.match(/workflow-item\/([a-f0-9-]+)/i);
            if (match) val = match[1];
            setForm({ ...form, trackingUuid: val });
          }} className={`${inputClass} text-[9px]`} placeholder="Link Logcomex (opcional)" />
        </div>
      </td>
      {/* Custom columns */}
      {customColumns.map(col => (
        <td key={col.key} className="px-1 py-1.5">
          <input value={customCells[col.key] || ""} onChange={e => setCustomCells({ ...customCells, [col.key]: e.target.value })} className={`${inputClass} text-center`} placeholder={col.name} />
        </td>
      ))}
      <td className="px-1 py-1.5 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <button
            onClick={() => {
              updatePayment.mutate({ id: payment.id, status: form.status, pedido: form.pedido, doc: form.doc, totalUsd: toUsd(form.totalUsd), totalBrasilUsd: toUsd(form.totalBrasilUsd), totalParaguaiUsd: toUsd(form.totalParaguaiUsd), brasilUsd: toUsd(form.brasilUsd), paraguaiUsd: toUsd(form.paraguaiUsd), totalPago: toUsd(form.totalPago), saldoDevedorBrasil: toUsd(form.saldoDevedorBrasil), saldoDevedorParaguai: toUsd(form.saldoDevedorParaguai), saldoDevedorTotal: toUsd(form.saldoDevedorTotal), rastreio: form.rastreio || undefined, blNumber: form.blNumber || undefined, trackingUuid: form.trackingUuid || undefined, armador: form.armador || undefined, sectionTitle: form.sectionTitle || undefined, arrivalDate: form.arrivalDate || undefined, alertDaysBefore: form.alertDaysBefore ? parseInt(form.alertDaysBefore) : null });
              // Save custom cells if any custom columns exist
              if (customColumns.length > 0) {
                const existingCells = payment.cells || {};
                const mergedCells = { ...existingCells, ...customCells };
                updateCellsMut.mutate({ id: payment.id, cells: mergedCells });
              }
            }}
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

function InlineAddPaymentRow({ supplierId, sectionTitle, onCancel, onRefetch, isWinnie = false, currency = "USD", exchangeRate = 5.50, rmbRate = 7.25, customColumns = [] }: { supplierId: number; sectionTitle: string | null; onCancel: () => void; onRefetch: () => void; isWinnie?: boolean; currency?: "USD" | "BRL" | "RMB"; exchangeRate?: number; rmbRate?: number; customColumns?: Array<{ key: string; name: string; type: string }> }) {
  
  
  // Convert display currency back to USD for storage (full precision to avoid cent discrepancies)
  const toUsd = (val: string) => {
    const num = parseFloat(val) || 0;
    if (currency === "BRL") return String(num / exchangeRate);
    if (currency === "RMB") return String(num / rmbRate);
    return String(num);
  };
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
    armador: "",
    arrivalDate: "",
    alertDaysBefore: "",
  });
  // Custom column values
  const [customCells, setCustomCells] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const col of customColumns) {
      result[col.key] = "";
    }
    return result;
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
        <input type="number" step="any" value={form.totalUsd} onChange={e => setForm({ ...form, totalUsd: e.target.value })} className={`${inputClass} text-right`} placeholder="0.00" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="any" value={form.totalBrasilUsd} onChange={e => setForm({ ...form, totalBrasilUsd: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="any" value={form.totalParaguaiUsd} onChange={e => setForm({ ...form, totalParaguaiUsd: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      {/* GREEN: O que pagou */}
      <td className="px-1 py-1.5">
        <input type="number" step="any" value={form.brasilUsd} onChange={e => setForm({ ...form, brasilUsd: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="any" value={form.paraguaiUsd} onChange={e => setForm({ ...form, paraguaiUsd: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="any" value={form.totalPago} onChange={e => setForm({ ...form, totalPago: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      {/* RED: O que falta pagar */}
      <td className="px-1 py-1.5">
        <input type="number" step="any" value={form.saldoDevedorBrasil} onChange={e => setForm({ ...form, saldoDevedorBrasil: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="any" value={form.saldoDevedorParaguai} onChange={e => setForm({ ...form, saldoDevedorParaguai: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <input type="number" step="any" value={form.saldoDevedorTotal} onChange={e => setForm({ ...form, saldoDevedorTotal: e.target.value })} className={`${inputClass} text-right`} placeholder="0" />
      </td>
      <td className="px-1 py-1.5">
        <div className="flex flex-col gap-1">
          <input value={form.blNumber} onChange={e => setForm({ ...form, blNumber: e.target.value })} className={`${inputClass} font-mono`} placeholder="Nº BL (ex: ONEYXMNG50123700)" />
          <input value={form.rastreio} onChange={e => setForm({ ...form, rastreio: e.target.value })} className={`${inputClass} text-[9px]`} placeholder="Container (opcional)" />
          <select value={form.armador} onChange={e => setForm({ ...form, armador: e.target.value })} className={`${inputClass} text-[9px]`}>
            <option value="">Armador (AI)</option>
            <option value="ONE">ONE</option>
            <option value="MSC">MSC</option>
            <option value="MAERSK">MAERSK</option>
            <option value="CMA CGM">CMA CGM</option>
            <option value="HAPAG-LLOYD">HAPAG-LLOYD</option>
            <option value="EVERGREEN">EVERGREEN</option>
            <option value="COSCO">COSCO</option>
            <option value="YANG MING">YANG MING</option>
            <option value="HMM">HMM</option>
            <option value="ZIM">ZIM</option>
            <option value="PIL">PIL</option>
            <option value="WAN HAI">WAN HAI</option>
            <option value="OOCL">OOCL</option>
          </select>
          <input value={form.trackingUuid} onChange={e => {
            let val = e.target.value;
            const match = val.match(/workflow-item\/([a-f0-9-]+)/i);
            if (match) val = match[1];
            setForm({ ...form, trackingUuid: val });
          }} className={`${inputClass} text-[9px]`} placeholder="Link Logcomex (opcional)" />
        </div>
      </td>
      {/* Custom columns */}
      {customColumns.map(col => (
        <td key={col.key} className="px-1 py-1.5">
          <input value={customCells[col.key] || ""} onChange={e => setCustomCells({ ...customCells, [col.key]: e.target.value })} className={`${inputClass} text-center`} placeholder={col.name} />
        </td>
      ))}
      <td className="px-1 py-1.5 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <button
            onClick={() => {
              if (!form.status || !form.pedido || !form.totalUsd) {
                toast.error("Preencha Status, Pedido e Total USD");
                return;
              }
              // Include custom cells in the cells field
              const hasCustomData = Object.values(customCells).some(v => v.trim() !== "");
              createPayment.mutate({
                supplierId,
                sectionTitle: sectionTitle || undefined,
                status: form.status,
                pedido: form.pedido,
                doc: form.doc,
                totalUsd: toUsd(form.totalUsd),
                totalBrasilUsd: toUsd(form.totalBrasilUsd) || undefined,
                totalParaguaiUsd: toUsd(form.totalParaguaiUsd) || undefined,
                brasilUsd: toUsd(form.brasilUsd) || undefined,
                paraguaiUsd: toUsd(form.paraguaiUsd) || undefined,
                totalPago: toUsd(form.totalPago) || undefined,
                saldoDevedorBrasil: toUsd(form.saldoDevedorBrasil) || undefined,
                saldoDevedorParaguai: toUsd(form.saldoDevedorParaguai) || undefined,
                saldoDevedorTotal: toUsd(form.saldoDevedorTotal) || undefined,
                rastreio: form.rastreio || undefined,
                trackingUuid: form.trackingUuid || undefined,
                blNumber: form.blNumber || undefined,
                armador: form.armador || undefined,
                arrivalDate: form.arrivalDate || undefined,
                alertDaysBefore: form.alertDaysBefore ? parseInt(form.alertDaysBefore) : null,
                ...(hasCustomData ? { cells: customCells } : {}),
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

type CustoSubTab = "realtime" | "pos" | "config";
function CustoMercadoria() {
  const [custoTab, setCustoTab] = useState<CustoSubTab>("realtime");
  const { data: exchangeData } = trpc.import.getExchangeRate.useQuery(undefined, { refetchInterval: 5 * 60 * 1000 });
  const [currency, setCurrency] = useState<"USD" | "BRL" | "RMB">("USD");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [pdfViewerTitle, setPdfViewerTitle] = useState("");
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
              onClick={() => setCustoTab("realtime")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                custoTab === "realtime"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Custo em Tempo Real
            </button>
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
        {/* Currency toggle + Export PDF - visible for realtime and pos tabs */}
        {(custoTab === "realtime" || custoTab === "pos") && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 mt-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {custoTab === "pos" && (
                <button
                  onClick={handleExportCustoPdf}
                  disabled={exportingPdf}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-all shadow-sm bg-red-50 border-red-300 text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  Exportar PDF
                </button>
              )}
              {exchangeData && (
                <span className="text-[10px] sm:text-xs text-slate-500">
                  Cotação: <strong className="text-slate-700">1 USD = R$ {exchangeRate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </span>
              )}
              <span className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-full px-2.5 py-1">
                <span className="text-[10px] font-semibold text-purple-700">SPREAD: + R$ 0,20</span>
                <span className="text-[10px] text-purple-500">na conversão</span>
              </span>
              {exchangeData && (
                <span className="text-[10px] sm:text-xs bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 text-emerald-700 font-semibold">
                  Taxa efetiva: 1 USD = R$ {(exchangeRate + 0.20).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 ${
                currency === "USD"
                  ? "bg-blue-100 border-blue-400 text-blue-800"
                  : currency === "BRL"
                    ? "bg-green-100 border-green-400 text-green-800"
                    : "bg-red-100 border-red-400 text-red-800"
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                  currency === "USD" ? "bg-blue-500" : currency === "BRL" ? "bg-green-500" : "bg-red-500"
                }`}></span>
                {currency === "USD" ? "DÓLAR (USD)" : currency === "BRL" ? "REAL (BRL)" : "RENMINBI (RMB)"}
              </div>
              <button
                onClick={() => setCurrency(prev => prev === "USD" ? "RMB" : prev === "RMB" ? "BRL" : "USD")}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-all shadow-sm ${
                  currency === "USD"
                    ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                    : currency === "BRL"
                      ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                      : "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                {currency === "USD" ? "USD → RMB" : currency === "RMB" ? "RMB → BRL" : "BRL → USD"}
              </button>
            </div>
          </div>
        )}
      </div>

      {custoTab === "realtime" && <CustoTempoReal exchangeRate={exchangeRate} currency={currency} />}
      {custoTab === "pos" && <CustoPosView currency={currency} exchangeRate={exchangeRate} setPdfViewerUrl={setPdfViewerUrl} setPdfViewerTitle={setPdfViewerTitle} />}
      {custoTab === "config" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
          <CustoConfigView />
        </div>
      )}

      {/* PDF Viewer Modal */}
      {pdfViewerUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPdfViewerUrl(null)}>
          <div className="relative w-[95vw] h-[90vh] max-w-5xl bg-white rounded-xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">{pdfViewerTitle}</h3>
              <div className="flex items-center gap-2">
                <a
                  href={pdfViewerUrl}
                  download={`${pdfViewerTitle}.pdf`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md border border-blue-200 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar
                </a>
                <button
                  onClick={() => setPdfViewerUrl(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe src={pdfViewerUrl} className="w-full h-full" title={pdfViewerTitle} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustoTempoReal({ exchangeRate, currency }: { exchangeRate: number; currency: "USD" | "BRL" | "RMB" }) {
  const { data: costs, isLoading } = trpc.import.getRealTimeCosts.useQuery();
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      </div>
    );
  }

  const allCosts = costs || [];
  const filtered = searchTerm
    ? allCosts.filter((c: any) => c.codigoItem.toLowerCase().includes(searchTerm.toLowerCase()) || c.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
    : allCosts;

  const SPREAD = 0.20; // R$ 0,20 de spread na conversão USD→BRL
  const effectiveRate = exchangeRate + SPREAD; // Cotação efetiva para conversão
  const formatBrl = (val: number) => val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const displayVal = (brl: number) => {
    // Valores no banco já estão em BRL (salvos com a taxa do momento do save)
    // Exibir diretamente sem reconverter - o valor é FIXO após salvo
    if (currency === "BRL") {
      return `R$ ${formatBrl(brl)}`;
    }
    // USD: divide pela taxa efetiva atual para dar uma referência em USD
    return `$ ${formatBrl(brl / effectiveRate)}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-slate-800">Custo da Mercadoria em Tempo Real</h3>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{allCosts.length} produtos</span>
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-3">Custo Médio Ponderado Móvel: preço fixo entre POs, recalcula apenas quando chega nova PO.</p>

      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] text-slate-600">Custo Real (POs 100% Concluído)</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px] bg-gray-900 text-white text-xs p-3 rounded-lg">
            Quando todo o processo daquele contêiner onde estava a mercadoria foi concluído e todos os custos foram quitados.
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-[10px] text-slate-600">Custo Projetado (POs Chegou no Pátio)</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px] bg-gray-900 text-white text-xs p-3 rounded-lg">
            Quando a mercadoria chegou no pátio. É o preço que deve ser considerado para vender.
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-[10px] text-slate-600">Estimativa (POs Navegando)</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px] bg-gray-900 text-white text-xs p-3 rounded-lg">
            Quando tem uma nova CI preenchida na China e o contêiner com essa carga está navegando. Esse valor vai afetar o preço projetado quando chegar no pátio.
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por código ou descrição..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="pb-2 pr-4 font-medium text-slate-600">Código</th>
              <th className="pb-2 pr-4 font-medium text-slate-600">Descrição</th>
              <th className="pb-2 pr-4 font-medium text-slate-600 text-right">Estoque</th>
              <th className="pb-2 pr-4 font-medium text-emerald-700 text-right">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help inline-flex items-center gap-1">
                      Custo Real
                      <svg className="w-3.5 h-3.5 text-emerald-500 opacity-60" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] bg-gray-900 text-white text-xs p-3 rounded-lg">
                    Quando todo o processo daquele contêiner onde estava a mercadoria foi concluído e todos os custos foram quitados (POs 100% Concluído).
                  </TooltipContent>
                </Tooltip>
              </th>
              <th className="pb-2 pr-4 font-medium text-amber-700 text-right">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help inline-flex items-center gap-1">
                      Projetado
                      <svg className="w-3.5 h-3.5 text-amber-500 opacity-60" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] bg-gray-900 text-white text-xs p-3 rounded-lg">
                    Quando a mercadoria chegou no pátio. É o preço que deve ser considerado para vender (POs Chegou no Pátio).
                  </TooltipContent>
                </Tooltip>
              </th>
              <th className="pb-2 pr-4 font-medium text-blue-700 text-right">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help inline-flex items-center gap-1">
                      Estimativa
                      <svg className="w-3.5 h-3.5 text-blue-500 opacity-60" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] bg-gray-900 text-white text-xs p-3 rounded-lg">
                    Quando tem uma nova CI preenchida na China e o contêiner com essa carga está navegando. Esse valor vai afetar o preço projetado quando chegar no pátio (POs Navegando).
                  </TooltipContent>
                </Tooltip>
              </th>
              <th className="pb-2 font-medium text-slate-600 text-center">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item: any) => (
              <>
                <tr
                  key={item.codigoItem}
                  className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${
                    expandedProduct === item.codigoItem ? "bg-blue-50/50" : ""
                  }`}
                  onClick={() => setExpandedProduct(expandedProduct === item.codigoItem ? null : item.codigoItem)}
                >
                  <td className="py-2.5 pr-4 font-mono text-xs text-slate-700 font-medium">{item.codigoItem}</td>
                  <td className="py-2.5 pr-4 text-slate-700 text-xs">{item.descricao}</td>
                  <td className="py-2.5 pr-4 text-right font-medium">
                    {item.semEstoque ? (
                      <span className="text-orange-500 text-xs">Sem estoque</span>
                    ) : (
                      <span className="text-slate-800">{item.caixasEstoque.toLocaleString("pt-BR")}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded whitespace-nowrap">
                      {item.custoReal > 0 ? displayVal(item.custoReal) : '-'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <span className={`font-semibold px-2 py-0.5 rounded whitespace-nowrap ${
                      item.temPatio ? 'text-amber-700 bg-amber-50' : 'text-slate-500 bg-slate-50'
                    }`}>
                      {item.custoProjetado > 0 ? displayVal(item.custoProjetado) : '-'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    {item.temNavegando ? (
                      <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded whitespace-nowrap">
                        {displayVal(item.custoEstimativa)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </td>
                  <td className="py-2.5 text-center">
                    <button className="p-1 rounded hover:bg-slate-200 transition-colors">
                      {expandedProduct === item.codigoItem ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </td>
                </tr>
                {expandedProduct === item.codigoItem && (
                  <tr key={`${item.codigoItem}-detail`}>
                    <td colSpan={7} className="p-0">
                      <div className="mx-2 my-2 space-y-3">
                        {/* Green breakdown - POs 100% Concluído */}
                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Layers className="w-4 h-4 text-emerald-600" />
                            <h4 className="text-sm font-semibold text-emerald-800">Custo Real (Média Ponderada - POs 100% Concluído)</h4>
                          </div>
                          {item.semEstoque && (
                            <p className="text-xs text-orange-600 mb-2 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200">
                              Sem estoque atual. Custo baseado na última PO concluída.
                            </p>
                          )}
                          {item.breakdownReal.length > 0 ? (
                            <div className="space-y-1.5">
                              {item.breakdownReal.map((b: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between bg-white/80 rounded-lg px-3 py-2 border border-emerald-100/50">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">{b.poNumber}</span>
                                    <span className="text-xs text-slate-600">
                                      {b.caixasUsadas > 0 ? `${b.caixasUsadas.toLocaleString("pt-BR")} caixas` : "Referência"}
                                    </span>
                                  </div>
                                  <span className="text-xs font-semibold text-emerald-800 whitespace-nowrap">{displayVal(b.valorCaixa)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">Nenhuma PO 100% concluída com custo cadastrado para este produto.</p>
                          )}
                          {!item.semEstoque && item.breakdownReal.length > 1 && (
                            <div className="mt-3 pt-3 border-t border-emerald-200/50 flex items-center justify-between">
                              <span className="text-xs text-emerald-700 font-medium">Custo Médio Atual:</span>
                              <span className="text-sm font-bold text-emerald-700">{displayVal(item.custoReal)}</span>
                            </div>
                          )}
                        </div>

                        {/* Orange breakdown - POs Chegou no Pátio */}
                        {item.temPatio && (
                          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Anchor className="w-4 h-4 text-amber-600" />
                              <h4 className="text-sm font-semibold text-amber-800">Custo Projetado (POs Chegou no Pátio)</h4>
                            </div>
                            <div className="space-y-1.5">
                              {item.breakdownProjetado.map((b: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between bg-white/80 rounded-lg px-3 py-2 border border-amber-100/50">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">{b.poNumber}</span>
                                    <span className="text-xs text-slate-600">
                                      {b.caixasUsadas > 0 ? `${b.caixasUsadas.toLocaleString("pt-BR")} caixas` : "Referência"}
                                    </span>
                                  </div>
                                  <span className="text-xs font-semibold text-amber-800 whitespace-nowrap">{displayVal(b.valorCaixa)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-amber-200/50 flex items-center justify-between">
                              <span className="text-xs text-amber-700 font-medium">Média Projetada (estoque + pátio):</span>
                              <span className="text-sm font-bold text-amber-700">{displayVal(item.custoProjetado)}</span>
                            </div>
                          </div>
                        )}

                        {/* Blue breakdown - POs Navegando (Estimativa) */}
                        {item.temNavegando && (
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Ship className="w-4 h-4 text-blue-600" />
                              <h4 className="text-sm font-semibold text-blue-800">Estimativa (POs Navegando)</h4>
                            </div>
                            <div className="space-y-1.5">
                              {item.breakdownEstimativa.map((b: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between bg-white/80 rounded-lg px-3 py-2 border border-blue-100/50">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">{b.poNumber}</span>
                                    <span className="text-xs text-slate-600">
                                      {b.caixasUsadas > 0 ? `${b.caixasUsadas.toLocaleString("pt-BR")} caixas` : "Referência"}
                                    </span>
                                  </div>
                                  <span className="text-xs font-semibold text-blue-800 whitespace-nowrap">{displayVal(b.valorCaixa)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-blue-200/50 flex items-center justify-between">
                              <span className="text-xs text-blue-700 font-medium">Média Estimada (tudo incluso):</span>
                              <span className="text-sm font-bold text-blue-700">{displayVal(item.custoEstimativa)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum produto encontrado.</p>
        </div>
      )}
    </div>
  );
}

function CustoPosView({ currency, exchangeRate, setPdfViewerUrl, setPdfViewerTitle }: { currency: "USD" | "BRL" | "RMB"; exchangeRate: number; setPdfViewerUrl: (url: string | null) => void; setPdfViewerTitle: (title: string) => void }) {
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
                setPdfViewerUrl={setPdfViewerUrl}
                setPdfViewerTitle={setPdfViewerTitle}
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
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>;

  const { states, selectedUf } = data || { states: [], selectedUf: 'SP' };

  return (
    <div>
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-700">ICMS por Estado</h3>
          <span className="text-xs text-slate-400 ml-2">Estado ativo: <span className="font-medium text-blue-600">{selectedUf}</span></span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>
      {isExpanded && (<>
      <p className="text-xs text-slate-500 mb-3 mt-3">
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
      </>)}
    </div>
  );
}

function NcmTaxesSection() {
  const { data: ncmList, isLoading } = trpc.import.getNcmTaxes.useQuery();
  const utils = trpc.useUtils();
  const createNcm = trpc.import.createNcmTax.useMutation({
    onSuccess: () => { utils.import.getNcmTaxes.invalidate(); toast.success('NCM adicionado!'); setShowAdd(false); resetForm(); },
    onError: (err) => toast.error(err.message?.includes('Duplicate') ? 'NCM já cadastrado!' : err.message?.includes('Valor') ? err.message : 'Erro ao cadastrar NCM'),
  });
  const updateNcm = trpc.import.updateNcmTax.useMutation({
    onSuccess: () => { utils.import.getNcmTaxes.invalidate(); toast.success('NCM atualizado!'); setEditingId(null); },
    onError: (err) => toast.error(err.message?.includes('Valor') ? err.message : 'Erro ao atualizar NCM'),
  });
  const deleteNcm = trpc.import.deleteNcmTax.useMutation({
    onSuccess: () => { utils.import.getNcmTaxes.invalidate(); toast.success('NCM removido!'); },
    onError: () => toast.error('Erro ao remover NCM'),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ncm: '', description: '', grupo: '', iiRate: '', ipiRate: '', pisRate: '2.10', cofinsRate: '9.65' });
  const resetForm = () => setForm({ ncm: '', description: '', grupo: '', iiRate: '', ipiRate: '', pisRate: '2.10', cofinsRate: '9.65' });

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
          <div className="grid grid-cols-7 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">NCM</label>
              <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono" placeholder="0000.00.00" value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500">Descrição</label>
              <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" placeholder="Descrição do produto" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Grupo</label>
              <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" placeholder="Ex: Bambu" value={form.grupo} onChange={e => setForm({ ...form, grupo: e.target.value })} />
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
                  if (!form.ncm.trim() || form.iiRate === '' || form.ipiRate === '') return toast.error('NCM, II e IPI obrigatórios');
                  const sanitize = (v: string) => v.trim().replace(',', '.');
                  const ii = sanitize(form.iiRate), ipi = sanitize(form.ipiRate);
                  if (isNaN(Number(ii)) || isNaN(Number(ipi))) return toast.error('II e IPI devem ser números válidos (use ponto para decimais)');
                  createNcm.mutate({ ncm: form.ncm.trim(), description: form.description.trim() || undefined, grupo: form.grupo.trim() || undefined, iiRate: ii, ipiRate: ipi, pisRate: sanitize(form.pisRate), cofinsRate: sanitize(form.cofinsRate) });
                }}
                className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700"
              >
                Salvar
              </button>
              <button onClick={() => setShowAdd(false)} className="p-1.5 text-slate-500 hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 mt-2">
            <div className="col-start-5">
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
              <th className="px-3 py-2 text-left font-medium">Grupo</th>
              <th className="px-3 py-2 text-center font-medium">II (%)</th>
              <th className="px-3 py-2 text-center font-medium">IPI (%)</th>
              <th className="px-3 py-2 text-center font-medium">PIS (%)</th>
              <th className="px-3 py-2 text-center font-medium">COFINS (%)</th>
              <th className="px-3 py-2 text-center font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(ncmList || []).length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Nenhum NCM cadastrado. Clique em "Novo NCM" para adicionar.</td></tr>
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
                <td className="px-3 py-2 text-slate-600">
                  {editingId === ncm.id ? (
                    <input className="w-full border border-blue-300 rounded px-1 py-0.5 text-xs" value={form.grupo} onChange={e => setForm({ ...form, grupo: e.target.value })} />
                  ) : (ncm.grupo || '—')}
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
                      <button onClick={() => { updateNcm.mutate({ id: ncm.id, ncm: form.ncm, description: form.description, grupo: form.grupo, iiRate: form.iiRate, ipiRate: form.ipiRate, pisRate: form.pisRate, cofinsRate: form.cofinsRate }); }} className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingId(null)} className="p-0.5 text-red-500 hover:bg-red-50 rounded"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => { setEditingId(ncm.id); setForm({ ncm: ncm.ncm, description: ncm.description || '', grupo: ncm.grupo || '', iiRate: String(ncm.iiRate), ipiRate: String(ncm.ipiRate), pisRate: String(ncm.pisRate), cofinsRate: String(ncm.cofinsRate) }); }} className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5" /></button>
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

function SupplierPoCard({ supplier, isExpanded, onToggle, currency, exchangeRate, setPdfViewerUrl, setPdfViewerTitle }: {
  supplier: { id: number; name: string; displayName: string | null; category: string | null; poCount: number };
  isExpanded: boolean;
  onToggle: () => void;
  currency: "USD" | "BRL" | "RMB";
  exchangeRate: number;
  setPdfViewerUrl: (url: string | null) => void;
  setPdfViewerTitle: (title: string) => void;
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
      {isExpanded && <SupplierPoList supplierId={supplier.id} currency={currency} exchangeRate={exchangeRate} setPdfViewerUrl={setPdfViewerUrl} setPdfViewerTitle={setPdfViewerTitle} />}
    </div>
  );
}

function SupplierPoList({ supplierId, currency, exchangeRate, setPdfViewerUrl, setPdfViewerTitle }: { supplierId: number; currency: "USD" | "BRL" | "RMB"; exchangeRate: number; setPdfViewerUrl: (url: string | null) => void; setPdfViewerTitle: (title: string) => void }) {
  const { data: pos, isLoading } = trpc.import.getPosBySupplier.useQuery({ supplierId });
  const [expandedPo, setExpandedPo] = useState<number | null>(null);
  const [showNewPo, setShowNewPo] = useState(false);
  const [newPoName, setNewPoName] = useState('');
  const [showLogisticsFields, setShowLogisticsFields] = useState(false);
  const [newPoLogistics, setNewPoLogistics] = useState<Record<string, string>>({});
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "arrival">("arrival");
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
  const uploadDocMut = trpc.import.uploadPoDocument.useMutation({
    onSuccess: () => {
      utils.import.getPosBySupplier.invalidate({ supplierId });
    },
  });
  const removeDocMut = trpc.import.removePoDocument.useMutation({
    onSuccess: () => {
      utils.import.getPosBySupplier.invalidate({ supplierId });
      toast.success('Documento removido!');
    },
    onError: () => {
      toast.error('Erro ao remover documento');
    },
  });
  const deletePoMut = trpc.import.deletePo.useMutation({
    onSuccess: () => {
      utils.import.getPosBySupplier.invalidate({ supplierId });
      utils.import.getSuppliersWithPoCount.invalidate();
      toast.success('PO excluída!');
    },
  });
  const renamePoMut = trpc.import.renamePo.useMutation({
    onSuccess: () => {
      utils.import.getPosBySupplier.invalidate({ supplierId });
      toast.success('PO atualizada!');
      setEditingPoId(null);
    },
  });
  const navStatusMut = trpc.import.updatePoNavigationStatus.useMutation({
    onSuccess: () => {
      utils.import.getPosBySupplier.invalidate({ supplierId });
      utils.import.getActiveContainers.invalidate();
      utils.import.getRealTimeCosts.invalidate(); // Refresh Estimativa
    },
  });
  const [editingPoId, setEditingPoId] = useState<number | null>(null);
  const [editPoNumber, setEditPoNumber] = useState('');
  const [editContainerName, setEditContainerName] = useState('');
  const [editingPrevisaoPoId, setEditingPrevisaoPoId] = useState<number | null>(null);
  const [editPrevisaoDate, setEditPrevisaoDate] = useState('');
  const updatePrevisaoMut = trpc.import.updatePrevisaoEntrega.useMutation({
    onSuccess: () => {
      utils.import.getPosBySupplier.invalidate({ supplierId });
      setEditingPrevisaoPoId(null);
      setEditPrevisaoDate('');
      toast.success('Data de previsão atualizada!');
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
            onClick={() => setSortOrder(prev => prev === "arrival" ? "newest" : prev === "newest" ? "oldest" : "arrival")}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-slate-200"
            title={sortOrder === "arrival" ? "Por data de chegada" : sortOrder === "newest" ? "Mais recentes primeiro" : "Mais antigas primeiro"}
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortOrder === "arrival" ? "Chegada" : sortOrder === "newest" ? "Recentes" : "Antigas"}
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
          {/* DOCUMENTOS: Upload CI e Ordem de Pagamento */}
          <div className="border-t border-amber-200 pt-3">
            <p className="text-[10px] font-semibold text-slate-600 mb-2">📎 DOCUMENTOS (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-slate-500 font-medium block mb-1">CI (Commercial Invoice)</label>
                <label className="flex items-center gap-1.5 px-2 py-1.5 border border-dashed border-blue-300 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[10px] text-blue-600 truncate">{newPoLogistics._ciFileName || 'Selecionar arquivo...'}</span>
                  <input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 16 * 1024 * 1024) { toast.error('Arquivo muito grande (máx 16MB)'); return; }
                    const reader = new FileReader();
                    reader.onload = () => {
                      const base64 = (reader.result as string).split(',')[1];
                      setNewPoLogistics(prev => ({ ...prev, _ciFileName: file.name, _ciBase64: base64, _ciMime: file.type }));
                    };
                    reader.readAsDataURL(file);
                  }} />
                </label>
                {newPoLogistics._ciFileName && (
                  <button onClick={() => setNewPoLogistics(prev => { const n = { ...prev }; delete n._ciFileName; delete n._ciBase64; delete n._ciMime; return n; })} className="text-[9px] text-red-500 hover:text-red-700 mt-0.5">✕ Remover</button>
                )}
              </div>
              <div>
                <label className="text-[9px] text-slate-500 font-medium block mb-1">Ordem de Pagamento</label>
                <label className="flex items-center gap-1.5 px-2 py-1.5 border border-dashed border-emerald-300 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] text-emerald-600 truncate">{newPoLogistics._opFileName || 'Selecionar arquivo...'}</span>
                  <input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 16 * 1024 * 1024) { toast.error('Arquivo muito grande (máx 16MB)'); return; }
                    const reader = new FileReader();
                    reader.onload = () => {
                      const base64 = (reader.result as string).split(',')[1];
                      setNewPoLogistics(prev => ({ ...prev, _opFileName: file.name, _opBase64: base64, _opMime: file.type }));
                    };
                    reader.readAsDataURL(file);
                  }} />
                </label>
                {newPoLogistics._opFileName && (
                  <button onClick={() => setNewPoLogistics(prev => { const n = { ...prev }; delete n._opFileName; delete n._opBase64; delete n._opMime; return n; })} className="text-[9px] text-red-500 hover:text-red-700 mt-0.5">✕ Remover</button>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-amber-200">
            <button onClick={() => { setShowNewPo(false); setShowLogisticsFields(false); setNewPoLogistics({}); setNewPoName(''); }} className="px-3 py-1 text-slate-500 hover:text-red-500 text-xs">Cancelar</button>
            <button
              onClick={async () => {
                if (!newPoName.trim()) return toast.error('Nome obrigatório');
                const payload: any = { supplierId, poNumber: newPoName.trim() };
                if (newPoLogistics.containerName) payload.containerName = newPoLogistics.containerName;
                for (const [key, value] of Object.entries(newPoLogistics)) {
                  if (key.startsWith('_') || key === 'containerName') continue;
                  if (value && value.trim()) payload[key] = value.trim();
                }
                const result = await createPoMut.mutateAsync(payload);
                // Upload documents if provided
                if (newPoLogistics._ciBase64 && result?.id) {
                  try {
                    await uploadDocMut.mutateAsync({ poId: result.id, type: 'ci', fileBase64: newPoLogistics._ciBase64, fileName: newPoLogistics._ciFileName!, mimeType: newPoLogistics._ciMime! });
                  } catch { toast.error('Erro ao enviar CI'); }
                }
                if (newPoLogistics._opBase64 && result?.id) {
                  try {
                    await uploadDocMut.mutateAsync({ poId: result.id, type: 'ordemPagamento', fileBase64: newPoLogistics._opBase64, fileName: newPoLogistics._opFileName!, mimeType: newPoLogistics._opMime! });
                  } catch { toast.error('Erro ao enviar Ordem de Pagamento'); }
                }
                setShowLogisticsFields(false);
                setNewPoLogistics({});
              }}
              disabled={createPoMut.isPending || uploadDocMut.isPending}
              className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50"
            >{createPoMut.isPending || uploadDocMut.isPending ? 'Criando...' : 'Criar PO'}</button>
          </div>
        </div>
      )}
      {[...(pos || [])].sort((a, b) => {
        if (sortOrder === "arrival") {
          const dateA = a.previsaoEntrega ? new Date(a.previsaoEntrega).getTime() : 0;
          const dateB = b.previsaoEntrega ? new Date(b.previsaoEntrega).getTime() : 0;
          // POs with dates come first, sorted by nearest date
          if (dateA && dateB) return dateA - dateB;
          if (dateA && !dateB) return -1;
          if (!dateA && dateB) return 1;
          return b.id - a.id;
        }
        return sortOrder === "newest" ? b.id - a.id : a.id - b.id;
      }).map(po => (
        <div key={po.id} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
          <button
            onClick={() => setExpandedPo(expandedPo === po.id ? null : po.id)}
            className="w-full flex items-center justify-between p-2.5 sm:p-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-amber-50 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 text-amber-600" />
              </div>
              {editingPoId === po.id ? (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <input
                    className="border border-blue-300 rounded px-2 py-0.5 text-xs font-medium w-24 bg-white"
                    value={editPoNumber}
                    onChange={e => setEditPoNumber(e.target.value)}
                    placeholder="Nº PO"
                    autoFocus
                  />
                  <input
                    className="border border-slate-300 rounded px-2 py-0.5 text-[10px] w-40 bg-white"
                    value={editContainerName}
                    onChange={e => setEditContainerName(e.target.value)}
                    placeholder="Nome do contêiner"
                  />
                  <button
                    onClick={() => renamePoMut.mutate({ id: po.id, poNumber: editPoNumber.trim(), containerName: editContainerName.trim() })}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                    title="Salvar"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingPoId(null)}
                    className="p-1 text-red-400 hover:bg-red-50 rounded"
                    title="Cancelar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="text-left flex items-center gap-1.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-xs sm:text-sm text-slate-700">{po.poNumber}</p>
                      {po.isFromSpreadsheet && (
                        <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-medium" title="Preço da caixa travado (importado da planilha)">travado</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">{po.containerName || ''}</p>
                  </div>
                  {editingPrevisaoPoId === po.id ? (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <input
                        type="date"
                        className="border border-indigo-300 rounded px-1.5 py-0.5 text-[10px] w-28 bg-white"
                        value={editPrevisaoDate}
                        onChange={e => setEditPrevisaoDate(e.target.value)}
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          if (editPrevisaoDate) {
                            updatePrevisaoMut.mutate({ poId: po.id, previsaoEntrega: editPrevisaoDate + 'T00:00:00.000-03:00' });
                          }
                        }}
                        className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                        title="Salvar"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => { setEditingPrevisaoPoId(null); setEditPrevisaoDate(''); }}
                        className="p-0.5 text-red-400 hover:bg-red-50 rounded"
                        title="Cancelar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : po.previsaoEntrega ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPrevisaoPoId(po.id);
                        const d = new Date(po.previsaoEntrega!);
                        setEditPrevisaoDate(d.toISOString().split('T')[0]);
                      }}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                      title="Clique para editar a Previsão de Entrega"
                    >
                      <CalendarDays className="w-3 h-3 text-indigo-500" />
                      <span className="text-[10px] font-medium text-indigo-700">
                        {(() => { const m = String(po.previsaoEntrega || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : new Date(po.previsaoEntrega).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }); })()}
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPrevisaoPoId(po.id);
                        setEditPrevisaoDate('');
                      }}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-dashed border-slate-300 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                      title="Definir Previsão de Entrega"
                    >
                      <CalendarDays className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] text-slate-400">Definir data</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingPoId(po.id); setEditPoNumber(po.poNumber || ''); setEditContainerName(po.containerName || ''); }}
                    className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                    title="Editar nome da PO"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">

              {/* Upload CI button (when no CI exists) */}
              {!po.pdfUrl && (
                <label className="flex items-center gap-1 px-2 py-1 rounded border border-dashed border-blue-300 text-blue-500 hover:bg-blue-50 cursor-pointer transition-colors text-[10px] font-medium" onClick={(e) => e.stopPropagation()} title="Upload CI">
                  <Upload className="w-3 h-3" />
                  <span>CI</span>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async () => {
                      const base64 = (reader.result as string).split(',')[1];
                      try {
                        await uploadDocMut.mutateAsync({ poId: po.id, type: 'ci', fileBase64: base64, fileName: file.name, mimeType: file.type });
                        toast.success('CI enviada com sucesso!');
                      } catch { toast.error('Erro ao enviar CI'); }
                    };
                    reader.readAsDataURL(file);
                  }} />
                </label>
              )}
              {po.pdfUrl && (
                <div className="flex items-center gap-0.5 rounded border border-blue-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col items-center gap-0.5 px-2 py-1 text-blue-600">
                    <FileText className="w-4 h-4" />
                    <span className="text-[8px] font-medium leading-none">CI</span>
                  </div>
                  <button
                    onClick={() => { setPdfViewerUrl(po.pdfUrl!); setPdfViewerTitle(`CI - ${po.poNumber}`); }}
                    className="flex items-center px-1.5 py-1 text-blue-600 hover:bg-blue-50 border-l border-blue-200 h-full"
                    title="Visualizar"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={po.pdfUrl}
                    download={`CI - ${po.poNumber}.pdf`}
                    className="flex items-center px-1.5 py-1 text-blue-600 hover:bg-blue-50 border-l border-blue-200 h-full"
                    title="Baixar"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => {
                      if (window.confirm('Tem certeza que deseja remover a CI desta PO?')) {
                        removeDocMut.mutate({ poId: po.id, type: 'ci' });
                      }
                    }}
                    className="flex items-center px-1.5 py-1 text-red-500 hover:bg-red-50 border-l border-blue-200 h-full"
                    title="Remover CI"
                    disabled={removeDocMut.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {/* Upload Ordem de Pagamento button (when no OP exists) */}
              {!po.pdfNotaCheiaUrl && (
                <label className="flex items-center gap-1 px-2 py-1 rounded border border-dashed border-emerald-300 text-emerald-500 hover:bg-emerald-50 cursor-pointer transition-colors text-[10px] font-medium" onClick={(e) => e.stopPropagation()} title="Upload Ordem de Pagamento">
                  <Upload className="w-3 h-3" />
                  <span>Ordem de Pagamento</span>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async () => {
                      const base64 = (reader.result as string).split(',')[1];
                      try {
                        await uploadDocMut.mutateAsync({ poId: po.id, type: 'ordemPagamento', fileBase64: base64, fileName: file.name, mimeType: file.type });
                        toast.success('Ordem de Pagamento enviada com sucesso!');
                      } catch { toast.error('Erro ao enviar Ordem de Pagamento'); }
                    };
                    reader.readAsDataURL(file);
                  }} />
                </label>
              )}
              {po.pdfNotaCheiaUrl && (
                <div className="flex items-center gap-0.5 rounded border border-emerald-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col items-center gap-0.5 px-2 py-1 text-emerald-600">
                    <FileText className="w-4 h-4" />
                    <span className="text-[8px] font-medium leading-none">Ordem de Pagamento</span>
                  </div>
                  <button
                    onClick={() => { setPdfViewerUrl(po.pdfNotaCheiaUrl!); setPdfViewerTitle(`Ordem de Pagamento - ${po.poNumber}`); }}
                    className="flex items-center px-1.5 py-1 text-emerald-600 hover:bg-emerald-50 border-l border-emerald-200 h-full"
                    title="Visualizar"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={po.pdfNotaCheiaUrl}
                    download={`Ordem de Pagamento - ${po.poNumber}.pdf`}
                    className="flex items-center px-1.5 py-1 text-emerald-600 hover:bg-emerald-50 border-l border-emerald-200 h-full"
                    title="Baixar"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => {
                      if (window.confirm('Tem certeza que deseja remover a Ordem de Pagamento desta PO?')) {
                        removeDocMut.mutate({ poId: po.id, type: 'ordemPagamento' });
                      }
                    }}
                    className="flex items-center px-1.5 py-1 text-red-500 hover:bg-red-50 border-l border-emerald-200 h-full"
                    title="Remover Ordem de Pagamento"
                    disabled={removeDocMut.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {/* Navigation Status Checkboxes */}
              <div className="flex items-center gap-1.5 mr-1" onClick={(e) => e.stopPropagation()}>
                <label className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium cursor-pointer transition-all ${
                  po.navigationStatus === 'navegando' || !po.navigationStatus
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-blue-200'
                }`}>
                  <input
                    type="radio"
                    name={`nav-${po.id}`}
                    checked={po.navigationStatus === 'navegando' || !po.navigationStatus}
                    onChange={() => navStatusMut.mutate({ poId: po.id, navigationStatus: 'navegando' })}
                    className="sr-only"
                  />
                  <Ship className="w-3 h-3" />
                  Navegando
                </label>
                <label className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium cursor-pointer transition-all ${
                  po.navigationStatus === 'chegou_patio'
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-amber-200'
                }`}>
                  <input
                    type="radio"
                    name={`nav-${po.id}`}
                    checked={po.navigationStatus === 'chegou_patio'}
                    onChange={() => navStatusMut.mutate({ poId: po.id, navigationStatus: 'chegou_patio' })}
                    className="sr-only"
                  />
                  <Anchor className="w-3 h-3" />
                  Chegou no Pátio
                </label>
                <label className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium cursor-pointer transition-all ${
                  po.navigationStatus === 'concluida'
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-green-200'
                }`}>
                  <input
                    type="radio"
                    name={`nav-${po.id}`}
                    checked={po.navigationStatus === 'concluida'}
                    onChange={() => navStatusMut.mutate({ poId: po.id, navigationStatus: 'concluida', exchangeRate })}
                    className="sr-only"
                  />
                  <CheckCircle className="w-3 h-3" />
                  100% Concluído
                </label>
              </div>
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
              {/* PoLogisticsPanel só para POs legacy (Guangzhou - têm valorFator preenchido) */}
              {po.valorFator && <PoLogisticsPanel po={po} currency={currency} exchangeRate={exchangeRate} />}
              <PoProductsTable poId={po.id} po={po} valorFator={po.valorFator ? Number(po.valorFator) : null} currency={currency} exchangeRate={exchangeRate} onCollapse={() => setExpandedPo(null)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ===== PAINEL DE CUSTOS LOGÍSTICOS POR PO =====
function PoLogisticsPanel({ po, currency, exchangeRate }: { po: any; currency: "USD" | "BRL" | "RMB"; exchangeRate: number }) {
  const effectiveRate = exchangeRate + 0.20;
  const [isOpen, setIsOpen] = useState(false);
  const utils = trpc.useUtils();
  const { data: exchangeData } = trpc.import.getExchangeRate.useQuery(undefined, { refetchInterval: 5 * 60 * 1000 });
  const updateLogistics = trpc.import.updatePoLogistics.useMutation({
    onSuccess: () => {
      utils.import.getPosBySupplier.invalidate({ supplierId: po.supplierId });
      toast.success('Custos atualizados!');
      setIsOpen(false);
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
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(pag1 || 0) / effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(pag1 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
                <input type="hidden" value={pag1} />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">2ª Remessa</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(pag2 || 0) / effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(pag2 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">3ª Remessa</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(pag3 || 0) / effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(pag3 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Taxas Remessa</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(taxasRemessa || 0) / effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(taxasRemessa || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(despLib || 0) / effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(despLib || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Frete Terrestre</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(freteTerr || 0) / effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(freteTerr || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">DIFAL</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(difal || 0) / effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(difal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Comissão do Silvério</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "USD" && exchangeRate > 0 ? `$ ${(Number(comSilverio || 0) / effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(comSilverio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
            </div>
          </div>

          {/* TOTAL CUSTOS */}
          <div className="flex items-center justify-between bg-white border border-indigo-200 rounded-lg px-3 py-2">
            <span className="text-xs font-semibold text-indigo-700">Total Custos Importação</span>
            <span className="text-sm font-bold font-mono text-indigo-800">
              {currency === "USD" && exchangeRate > 0
                ? `$ ${(totalCustos / effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
                  {currency === "BRL" && exchangeRate > 0 ? `R$ ${(Number(totalProdUsd || 0) * effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$ ${Number(totalProdUsd || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Frete Marítimo CN/BR {currency === "USD" ? "(USD)" : "(R$)"}</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "BRL" && exchangeRate > 0 ? `R$ ${(Number(freteMaritimo || 0) * effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$ ${Number(freteMaritimo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Total CI {currency === "USD" ? "(USD)" : "(R$)"}</label>
                <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono bg-white">
                  {currency === "BRL" && exchangeRate > 0 ? `R$ ${(Number(totalCi || 0) * effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$ ${Number(totalCi || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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

function PoProductsTable({ poId, po, valorFator, currency = "USD", exchangeRate = 5.50, onCollapse }: { poId: number; po: any; valorFator: number | null; currency?: "USD" | "BRL" | "RMB"; exchangeRate?: number; onCollapse?: () => void }) {
  const { data: products, isLoading } = trpc.import.getPoProducts.useQuery({ poId });
  const { data: ncmListForProducts } = trpc.import.getNcmTaxes.useQuery();
  const { data: vilelaConfig } = trpc.import.getVilelaPercent.useQuery();
  const vilelaPercent = vilelaConfig?.percent ?? 37;
  const utils = trpc.useUtils();
  const setVilelaPercent = trpc.import.setVilelaPercent.useMutation({
    onSuccess: () => { utils.import.getVilelaPercent.invalidate(); toast.success('Porcentagem Vilela atualizada!'); },
  });
  const updateProduct = trpc.import.updatePoProduct.useMutation({
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await utils.import.getPoProducts.cancel({ poId });
      // Snapshot previous value
      const prev = utils.import.getPoProducts.getData({ poId });
      // Optimistically update the cache
      utils.import.getPoProducts.setData({ poId }, (old: any) => {
        if (!old) return old;
        return old.map((p: any) => p.id === newData.id ? { ...p, ...newData } : p);
      });
      return { prev };
    },
    onError: (_err, _newData, context: any) => {
      // Rollback on error
      if (context?.prev) utils.import.getPoProducts.setData({ poId }, context.prev);
    },
    onSettled: () => {
      utils.import.getPoProducts.invalidate({ poId });
      utils.import.getRealTimeCosts.invalidate(); // Refresh Estimativa
      // Mark that we need to save productCosts after products refetch
      needsSaveAfterEditRef.current = true;
    },
  });
  // Silent auto-save mutation for product costs (no toast, no invalidation loop)
  const autoSaveProductCosts = trpc.import.updatePoLogistics.useMutation({
    onSuccess: () => {
      utils.import.getRealTimeCosts.invalidate(); // Refresh Estimativa column after save
    },
  });
  const shouldCollapseRef = useRef(false);
  // Flag: save productCosts on next products change (after edit/add/delete)
  const needsSaveAfterEditRef = useRef(false);
  const updateLogistics = trpc.import.updatePoLogistics.useMutation({
    onSuccess: () => {
      utils.import.getPosBySupplier.invalidate({ supplierId: po.supplierId });
      utils.import.getRealTimeCosts.invalidate(); // Refresh Estimativa
      if (shouldCollapseRef.current) {
        toast.success('Custos salvos!');
        onCollapse?.();
        shouldCollapseRef.current = false;
      }
    },
  });
  const addProduct = trpc.import.addPoProduct.useMutation({
    onSuccess: () => { utils.import.getPoProducts.invalidate({ poId }); utils.import.getRealTimeCosts.invalidate(); needsSaveAfterEditRef.current = true; setShowAddProduct(false); setNewProductCode(''); setNewProductDesc(''); setNewProductNcm(''); setAddCodeSearch(''); toast.success('Produto adicionado!'); },
  });
  const deleteProduct = trpc.import.deletePoProduct.useMutation({
    onSuccess: () => { utils.import.getPoProducts.invalidate({ poId }); utils.import.getRealTimeCosts.invalidate(); needsSaveAfterEditRef.current = true; toast.success('Produto removido!'); },
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ productCode?: string; ncm?: string; valorPoCheia?: string; valorPoMenor?: string; valorUsd?: string; quantidade?: string; freteMaritimo?: string; freteTerrestre?: string; incoterm?: string; unidCaixa?: string }>({});
  const [editNcmDropdownId, setEditNcmDropdownId] = useState<number | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductCode, setNewProductCode] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductNcm, setNewProductNcm] = useState('');
  const [newProductIncoterm, setNewProductIncoterm] = useState('');
  const [newProductUnidCaixa, setNewProductUnidCaixa] = useState('');
  const [showNcmCard, setShowNcmCard] = useState(false);
  const [ncmSearchFilter, setNcmSearchFilter] = useState('');
  
  // Costs panel state - all values stored in USD internally
  const [valorCiUsd, setValorCiUsd] = useState(po.totalCiRemessa || '');
  const [pag1, setPag1] = useState(po.pagamento1Remessa || '');
  const [pag2Usd, setPag2Usd] = useState(po.pagamento2Remessa || '');
  const [pag3Usd, setPag3Usd] = useState(po.pagamento3Remessa || '');
  // Para POs antigas (legacy), os valores de frete terrestre, DIFAL e comissão estão em BRL no banco.
  // Precisamos converter para USD (dividir pelo dólar da PO) para que o displayVal funcione corretamente.
  const legacyRate = Number(po.valorDolar1 || po.valorDolar1Remessa || exchangeRate);
  const isLegacyInit = !!(po.freteTermestreRemessa || po.comissaoSilverio || po.difalValor);
  const [freteTerrestreSPUsd, setFreteTerrestreSPUsd] = useState(
    isLegacyInit && po.freteTermestreRemessa ? String(Number(po.freteTermestreRemessa) / legacyRate) : (po.freteTermestreRemessa || '')
  );
  const [difalValUsd, setDifalValUsd] = useState(
    isLegacyInit && po.difalValor ? String(Number(po.difalValor) / legacyRate) : (po.difalValor || '')
  );
  const [comSilverioUsd, setComSilverioUsd] = useState(
    isLegacyInit && po.comissaoSilverio ? String(Number(po.comissaoSilverio) / legacyRate) : (po.comissaoSilverio || '')
  );
  // Frete override: null = usa cálculo automático, string = valor manual em USD
  const [freteOverrideUsd, setFreteOverrideUsd] = useState<string | null>(po.freteOverrideUsd ? String(po.freteOverrideUsd) : null);
  const [freteEditing, setFreteEditing] = useState(false);
  // Vilela valor real: valor exato pago (quando preenchido, substitui a estimativa %)
  const [vilelaReal, setVilelaReal] = useState(po.vilelaValorReal || '');
  
  // Helper: display value in current currency (uses legacyRate for legacy POs)
  // SPREAD: +R$0,20 na taxa efetiva para conversão USD→BRL
  const SPREAD = 0.20;
  const effectiveRate = (isLegacyInit ? legacyRate : exchangeRate) + SPREAD;
  const displayVal = (usdVal: string) => {
    if (!usdVal) return '';
    const n = Number(usdVal);
    if (isNaN(n)) return usdVal;
    return currency === 'BRL' ? (n * effectiveRate).toFixed(2) : n.toFixed(2);
  };
  // Helper: convert input from current currency to USD for storage
  const toUsd = (inputVal: string) => {
    const n = Number(inputVal.replace(',', '.'));
    if (isNaN(n)) return '0';
    return currency === 'BRL' ? String(n / effectiveRate) : String(n);
  };
  // Aliases for compatibility
  const valorCi = valorCiUsd;
  const pag2 = pag2Usd;
  const pag3 = pag3Usd;
  const freteTerrestreSP = freteTerrestreSPUsd;
  const difalVal = difalValUsd;
  const comSilverio = comSilverioUsd;
  
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

  // NOTE: Auto-save useEffect was REMOVED to prevent valorCaixaBrl from varying with exchange rate.
  // The valorCaixaBrl is now saved ONLY when:
  // 1. User clicks "Salvar Custos" button (saveCosts function)
  // 2. User edits a product (updateProduct.onSettled triggers saveProductCostsNow)
  // This ensures the value stays FIXED after being saved, regardless of exchange rate fluctuations.
  
  // Helper function to calculate and save productCosts to the database
  const saveProductCostsNow = useCallback(() => {
    if (!products || products.length === 0) return;
    const filteredProds = products.filter((p: any) => p.productCode && p.productCode.trim() !== '');
    if (filteredProds.length === 0) return;

    const totalValRef = filteredProds.reduce((sum: number, p: any) => {
      const valorForn = Number(String(p.valorUsd || 0).replace(',', '.'));
      const qty = Number(p.quantidade || 0);
      return sum + (valorForn * qty);
    }, 0);
    let totalFrete = 0;
    if (freteOverrideUsd !== null && Number(freteOverrideUsd) > 0) {
      totalFrete = Number(freteOverrideUsd);
    } else {
      totalFrete = filteredProds.reduce((sum: number, p: any) => {
        const valorForn = Number(String(p.valorUsd || 0).replace(',', '.'));
        const valorOrdem = Number(String(p.valorPoCheia || 0).replace(',', '.'));
        const qty = Number(p.quantidade || 0);
        const diff = valorOrdem - valorForn;
        return sum + (diff > 0 ? diff * qty : 0);
      }, 0);
    }
    const totalCi = Number(valorCiUsd || 0);
    const despLib = Number(vilelaReal || 0) > 0 ? Number(vilelaReal) : (totalCi * (vilelaPercent / 100));
    const freteSP = Number(freteTerrestreSPUsd || 0);
    const difal = Number(difalValUsd || 0);
    const comissao = Number(comSilverioUsd || 0);
    const custosTotaisCalc = totalValRef + totalFrete + despLib + freteSP + difal + comissao;

    const productCosts = filteredProds.map((p: any) => {
      const valorForn = Number(String(p.valorUsd || 0).replace(',', '.'));
      const qty = Number(p.quantidade || 0);
      const valorRef = valorForn * qty;
      const percProduto = totalValRef > 0 ? (valorRef / totalValRef) * 100 : 0;
      const valorDaCaixaUsd = qty > 0 ? (custosTotaisCalc * (percProduto / 100)) / qty : 0;
      const valorCaixaBrl = valorDaCaixaUsd * effectiveRate;
      const unid = Number(p.unidCaixa || 0);
      const precoMilUnid = unid > 0 ? valorCaixaBrl / unid : 0;
      return { id: p.id, valorCaixaBrl: valorCaixaBrl.toFixed(6), precoMilUnid: precoMilUnid.toFixed(6) };
    });

    // Convert USD values to BRL before saving (DB stores BRL for frete/difal/comissao)
    // Use .toFixed(6) to avoid rounding drift when converting back on reload
    const saveRate = isLegacyInit ? legacyRate : exchangeRate;
    const convertToBrl = (usdVal: string) => {
      if (!usdVal) return null;
      const n = Number(usdVal);
      if (isNaN(n) || n === 0) return null;
      return String((n * saveRate).toFixed(6));
    };
    autoSaveProductCosts.mutate({
      id: poId,
      totalCiRemessa: valorCiUsd,
      pagamento1Remessa: pag1,
      pagamento2Remessa: pag2Usd,
      pagamento3Remessa: pag3Usd,
      freteTermestreRemessa: convertToBrl(freteTerrestreSPUsd),
      difalValor: convertToBrl(difalValUsd),
      comissaoSilverio: convertToBrl(comSilverioUsd),
      freteOverrideUsd: freteOverrideUsd,
      vilelaValorReal: vilelaReal,
      valorDolar1Remessa: String(exchangeRate),
      productCosts,
    });
  }, [products, freteOverrideUsd, valorCiUsd, vilelaReal, freteTerrestreSPUsd, difalValUsd, comSilverioUsd, effectiveRate, vilelaPercent, pag1, pag2Usd, pag3Usd, poId, isLegacyInit, legacyRate, exchangeRate]);

  // Effect: save productCosts ONLY after a user-triggered product edit (not on rate changes)
  useEffect(() => {
    if (needsSaveAfterEditRef.current && products && products.length > 0) {
      needsSaveAfterEditRef.current = false;
      saveProductCostsNow();
    }
  }, [products, saveProductCostsNow]);

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
      valorUsd: product.valorUsd || '',
      quantidade: product.quantidade ? String(product.quantidade) : '',
      freteMaritimo: product.freteMaritimo || '',
      freteTerrestre: product.freteTerrestre || '',
      incoterm: product.incoterm || '',
      unidCaixa: product.unidCaixa || '',
    });
    setCodeSearch(product.productCode || '');
    setShowCodeDropdown(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { quantidade, ...rest } = editValues;
    await updateProduct.mutateAsync({ id: editingId, ...rest, quantidade: quantidade ? parseInt(quantidade) : null });
    setEditingId(null);
    setShowCodeDropdown(false);
  };

  const selectProduct = (code: string, desc: string) => {
    setEditValues({ ...editValues, productCode: code });
    setCodeSearch(code);
    setShowCodeDropdown(false);
  };

  // === CALCULATIONS ===
  const filteredProducts = products || [];
  
  // Detect if this is a PO from the spreadsheet (frozen prices - never recalculate)
  const isLegacyPo = !!po.isFromSpreadsheet;

  // Total Frete Calculado pelo Fornecedor (soma de todos os fretes col5)
  const totalFreteAutoCalc = filteredProducts.reduce((sum, prod) => {
    const valorForn = Number(String(prod.valorUsd || 0).replace(',', '.'));
    const valorOrdem = Number(String(prod.valorPoCheia || 0).replace(',', '.'));
    const qty = Number(prod.quantidade || 0);
    const diff = valorOrdem - valorForn;
    return sum + (diff > 0 ? diff * qty : 0);
  }, 0);
  
  // Frete override: usa valor manual se definido, senão usa o automático
  const totalFreteCalculado = freteOverrideUsd !== null ? Number(freteOverrideUsd) : totalFreteAutoCalc;

  // Total Valor de Referência (soma col7 = valorFornecedor × qtd)
  const totalValorReferencia = filteredProducts.reduce((sum, prod) => {
    const valorForn = Number(String(prod.valorUsd || 0).replace(',', '.'));
    const qty = Number(prod.quantidade || 0);
    return sum + (valorForn * qty);
  }, 0);

  // Despesas de Liberação - Valor Vilela
  // Prioridade: 1) Valor Real (verde) se preenchido, 2) Estimativa % da CI (alaranjado), 3) Legacy fixo
  const vilelaEstimativa = Number(valorCi || 0) * (vilelaPercent / 100);
  const despesasLiberacao = isLegacyPo
    ? Number(po.despesasLiberacaoRemessa || 0)
    : (vilelaReal ? Number(vilelaReal) : vilelaEstimativa);

  // Custos Totais da Importação
  // Para POs antigas: usa o valor fixo salvo no banco (total_custos_importacao) direto da planilha
  // Para POs novas: calcula dinamicamente (tudo em USD, convertido no display)
  const poExchangeRate = Number(po.valorDolar1 || po.valorDolar1Remessa || exchangeRate);
  const custosTotais = isLegacyPo
    ? Number(po.totalCustosImportacao || 0)
    : totalValorReferencia + totalFreteCalculado + despesasLiberacao + Number(freteTerrestreSP || 0) + Number(difalVal || 0) + Number(comSilverio || 0);

  // Remessa logic: 1ª = total - 2ª - 3ª
  const totalOrdemPagamento = totalValorReferencia;
  const remessa2 = Number(pag2 || 0);
  const remessa3 = Number(pag3 || 0);
  const remessa1Calculada = totalOrdemPagamento - remessa2 - remessa3;

  // Auto-save per-product valorCaixaBrl after each product update settles
  // This ensures the Estimativa column always shows the exact same value as the PO
  // The save happens via updateProduct.onSettled and saveCosts function

  // Helper: convert internal USD value to BRL for database storage
  const toBrl = (usdVal: string) => {
    if (!usdVal) return null;
    const n = Number(usdVal);
    if (isNaN(n) || n === 0) return null;
    const rate = isLegacyInit ? legacyRate : exchangeRate;
    return String((n * rate).toFixed(6));
  };

  const saveCosts = () => {
    shouldCollapseRef.current = true;
    // Calculate per-product valorCaixaBrl to save alongside logistics
    const productCosts = !isLegacyPo ? filteredProducts.map(prod => {
      const valorForn = Number(String(prod.valorUsd || 0).replace(',', '.'));
      const qty = Number(prod.quantidade || 0);
      const valorRef = valorForn * qty;
      const percProdutoNoTotal = totalValorReferencia > 0 ? (valorRef / totalValorReferencia) * 100 : 0;
      const valorDaCaixaUsd = qty > 0 ? (custosTotais * (percProdutoNoTotal / 100)) / qty : 0;
      const valorCaixaBrlCalc = valorDaCaixaUsd * effectiveRate;
      const unid = Number(prod.unidCaixa || 0);
      const precoMilUnidCalc = unid > 0 ? valorCaixaBrlCalc / unid : 0;
      return {
        id: prod.id,
        valorCaixaBrl: valorCaixaBrlCalc.toFixed(6),
        precoMilUnid: precoMilUnidCalc > 0 ? precoMilUnidCalc.toFixed(6) : null,
      };
    }).filter(p => Number(p.valorCaixaBrl) > 0) : undefined;

    updateLogistics.mutate({
      id: po.id,
      totalCiRemessa: valorCi || null,
      pagamento1Remessa: String(remessa1Calculada > 0 ? remessa1Calculada.toFixed(2) : pag1) || null,
      pagamento2Remessa: pag2 || null,
      pagamento3Remessa: pag3 || null,
      // Converter de USD interno para BRL antes de salvar (banco armazena em BRL)
      freteTermestreRemessa: toBrl(freteTerrestreSP),
      difalValor: toBrl(difalVal),
      comissaoSilverio: toBrl(comSilverio),
      despesasLiberacaoRemessa: despesasLiberacao > 0 ? String((despesasLiberacao * (isLegacyInit ? legacyRate : exchangeRate)).toFixed(6)) : (po.despesasLiberacaoRemessa || null),
      vilelaValorReal: vilelaReal || null,
      freteOverrideUsd: freteOverrideUsd || null,
      // Save the exchange rate used so that on reload, values don't vary with live rate
      valorDolar1Remessa: String(exchangeRate),
      productCosts,
    });
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
                        setNewProductDesc(item.descricaoItem || "");
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
            {/* Step 3: NCM Selector - Card Expansivo */}
            <div className="w-48 relative">
              <label className="text-[10px] text-slate-500 font-medium">3. NCM</label>
              <button
                type="button"
                onClick={() => { setShowNcmCard(!showNcmCard); setNcmSearchFilter(''); }}
                className={`w-full border rounded px-2 py-1.5 text-xs font-mono text-left flex items-center justify-between gap-1 transition-colors ${
                  newProductNcm ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-500'
                }`}
              >
                <span className="truncate">{newProductNcm || 'Selecione NCM...'}</span>
                <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${showNcmCard ? 'rotate-180' : ''}`} />
              </button>
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
            {/* Step 5: Unid. Caixa */}
            <div className="w-24">
              <label className="text-[10px] text-slate-500 font-medium">5. Unid. Caixa</label>
              <input
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono text-center"
                placeholder="Ex: 1000"
                value={newProductUnidCaixa}
                onChange={e => setNewProductUnidCaixa(e.target.value)}
                type="number"
              />
            </div>
            {/* Actions */}
            <button
              onClick={() => { if (!newProductDesc.trim()) { toast.error('Selecione um produto pelo código'); return; } addProduct.mutate({ poId, description: newProductDesc.trim(), productCode: newProductCode || undefined, ncm: newProductNcm || undefined, incoterm: newProductIncoterm || undefined, unidCaixa: newProductUnidCaixa || undefined }); }}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 whitespace-nowrap"
            >Adicionar</button>
            <button onClick={() => { setShowAddProduct(false); setAddCodeSearch(''); setNewProductCode(''); setNewProductDesc(''); setNewProductNcm(''); setNewProductIncoterm(''); setNewProductUnidCaixa(''); setShowNcmCard(false); setNcmSearchFilter(''); }} className="p-1 text-slate-500 hover:text-red-500"><X className="w-4 h-4" /></button>
          </div>
          {/* NCM Card Expansivo */}
          {showNcmCard && (
            <div className="mt-2 bg-white border border-blue-200 rounded-lg shadow-lg p-3 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  Selecionar NCM
                </h4>
                <button onClick={() => setShowNcmCard(false)} className="p-0.5 text-slate-400 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs mb-2 placeholder:text-slate-400"
                placeholder="Buscar por código, grupo ou descrição..."
                value={ncmSearchFilter}
                onChange={e => setNcmSearchFilter(e.target.value)}
                autoFocus
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {(ncmListForProducts || [])
                  .filter(n => {
                    if (!ncmSearchFilter) return true;
                    const q = ncmSearchFilter.toLowerCase();
                    return n.ncm.toLowerCase().includes(q) || (n.grupo || '').toLowerCase().includes(q) || (n.description || '').toLowerCase().includes(q);
                  })
                  .map(n => (
                    <button
                      key={n.id}
                      onClick={() => { setNewProductNcm(n.ncm); setShowNcmCard(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md border transition-all hover:border-blue-300 hover:bg-blue-50 flex items-center gap-3 ${
                        newProductNcm === n.ncm ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <span className="font-mono font-bold text-[11px] text-blue-700">{n.ncm}</span>
                      </div>
                      {n.grupo && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-semibold flex-shrink-0">
                          {n.grupo}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-600 truncate flex-1">{n.description || '—'}</span>
                      {newProductNcm === n.ncm && (
                        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      )}
                    </button>
                  ))
                }
                {(ncmListForProducts || []).filter(n => {
                  if (!ncmSearchFilter) return true;
                  const q = ncmSearchFilter.toLowerCase();
                  return n.ncm.toLowerCase().includes(q) || (n.grupo || '').toLowerCase().includes(q) || (n.description || '').toLowerCase().includes(q);
                }).length === 0 && (
                  <p className="text-center text-[10px] text-slate-400 py-3">Nenhum NCM encontrado. Cadastre em Configurações.</p>
                )}
              </div>
            </div>
          )}
          {newProductCode && (
            <p className="mt-1.5 text-[10px] text-emerald-700">✓ Produto selecionado: <span className="font-mono font-bold">{newProductCode}</span> — {newProductDesc}</p>
          )}
        </div>
      )}
      {/* === TABELA DE PRODUTOS COM 7 COLUNAS === */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gradient-to-r from-slate-100 to-blue-50 text-slate-600 text-[9px]">
              <th className="px-2 py-2.5 text-left font-semibold border-b-2 border-slate-200">Produto</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-slate-200">Código</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-slate-200">NCM</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-slate-200">Tipo Frete</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-teal-200 bg-teal-50">Unid. Caixa</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-blue-200 bg-blue-50">Valor Pago ao Fornecedor</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-blue-200 bg-blue-50">Valor Pago na Ordem de Pagamento</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-orange-200 bg-orange-50">Diferença</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-slate-200">Quantidade de Caixas</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-orange-200 bg-orange-50">Frete Calculado pelo Fornecedor</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-purple-200 bg-purple-50">Frete com Rateio Correto</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-emerald-200 bg-emerald-50">Valor de Referência</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-indigo-200 bg-indigo-50">Porcentagem que o Produto Representa no Valor do Total da Ordem de Pagamento</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-emerald-200 bg-emerald-50">Valor da Caixa</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-teal-200 bg-teal-50">Preço Mil/Unid.</th>
              <th className="px-2 py-2.5 text-center font-semibold border-b-2 border-slate-200">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((prod, idx) => {
              const valorForn = Number(String(prod.valorUsd || 0).replace(',', '.'));
              const valorOrdem = Number(String(prod.valorPoCheia || 0).replace(',', '.'));
              const qty = Number(prod.quantidade || 0);
              const diferenca = valorOrdem - valorForn;
              const freteCalcFornecedor = diferenca > 0 && qty > 0 ? diferenca * qty : 0;
              const valorRef = valorForn * qty;
              // % que o produto representa no total da ordem = Valor de Referência / Total da Ordem de Pagamento
              const percProdutoNaOrdem = totalValorReferencia > 0 ? valorRef / totalValorReferencia : 0;
              // Frete com Rateio Correto = % do produto × Valor Total do Frete
              const freteRateioCorreto = percProdutoNaOrdem * totalFreteCalculado;
              // Porcentagem que o produto representa no valor total da ordem de pagamento (sem frete)
              const percProdutoNoTotal = totalValorReferencia > 0 ? (valorRef / totalValorReferencia) * 100 : 0;
              // Valor da Caixa = (Custos Totais da Importação × porcentagem / 100) / Quantidade de Caixas
              const valorDaCaixa = qty > 0 ? (custosTotais * (percProdutoNoTotal / 100)) / qty : 0;

              return (
                <tr key={prod.id} className={`border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-blue-50/30`}>
                  <td className="px-2 py-2 text-slate-700 font-medium text-xs whitespace-normal break-words min-w-[200px]">{prod.description}</td>
                  <td className="px-2 py-2 text-center relative">
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
                                onClick={() => selectProduct(item.codigoItem, item.descricaoItem || "")}
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
                      <span className={`font-mono ${prod.productCode ? 'text-blue-600 font-semibold' : 'text-slate-300'}`}>
                        {prod.productCode || '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center relative">
                    {editingId === prod.id ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setEditNcmDropdownId(editNcmDropdownId === prod.id ? null : prod.id)}
                          className={`w-24 text-center border rounded px-1 py-0.5 text-[10px] font-mono flex items-center justify-between ${
                            editValues.ncm ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-blue-300 bg-white text-slate-500'
                          }`}
                        >
                          <span className="truncate">{editValues.ncm || 'NCM...'}</span>
                          <ChevronDown className="w-2.5 h-2.5 flex-shrink-0" />
                        </button>
                        {editNcmDropdownId === prod.id && (
                          <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-blue-200 rounded-lg shadow-xl p-2">
                            <div className="max-h-36 overflow-y-auto space-y-0.5">
                              {(ncmListForProducts || []).map(n => (
                                <button
                                  key={n.id}
                                  onClick={() => { setEditValues({ ...editValues, ncm: n.ncm }); setEditNcmDropdownId(null); }}
                                  className={`w-full text-left px-2 py-1.5 rounded text-[10px] flex items-center gap-2 transition-colors hover:bg-blue-50 ${
                                    editValues.ncm === n.ncm ? 'bg-emerald-50 border border-emerald-300' : ''
                                  }`}
                                >
                                  <span className="font-mono font-bold text-blue-700">{n.ncm}</span>
                                  {n.grupo && <span className="px-1 bg-amber-100 text-amber-700 rounded text-[8px] font-semibold">{n.grupo}</span>}
                                  <span className="text-slate-500 truncate flex-1 text-[9px]">{n.description || ''}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className={`font-mono ${prod.ncm ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {prod.ncm || '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
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
                      <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded ${prod.incoterm === 'CIF' ? 'bg-green-100 text-green-700' : prod.incoterm === 'FOB' ? 'bg-blue-100 text-blue-700' : prod.incoterm === 'EXW' ? 'bg-amber-100 text-amber-700' : 'text-slate-300'}`}>
                        {prod.incoterm || '—'}
                      </span>
                    )}
                  </td>
                  {/* Unid. Caixa - editável para POs novas, fixo para legacy */}
                  <td className="px-2 py-2 text-center bg-teal-50/30 whitespace-nowrap">
                    {isLegacyPo ? (
                      <span className="font-mono text-teal-700 font-semibold">
                        {prod.unidCaixa ? Number(prod.unidCaixa).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—'}
                      </span>
                    ) : editingId === prod.id ? (
                      <input
                        className="w-16 text-center border border-teal-300 rounded px-1 py-0.5 text-[10px] font-mono"
                        value={editValues.unidCaixa || ''}
                        onChange={e => setEditValues({ ...editValues, unidCaixa: e.target.value })}
                        placeholder="0"
                        type="number"
                      />
                    ) : (
                      <input
                        key={`unidcaixa-${prod.id}-${prod.unidCaixa}`}
                        className="w-16 text-center border border-slate-200 rounded px-1 py-1 text-[10px] font-mono text-teal-700 font-semibold bg-white hover:border-teal-300 focus:border-teal-400 focus:ring-1 focus:ring-teal-200 outline-none"
                        defaultValue={prod.unidCaixa || ''}
                        placeholder="0"
                        type="number"
                        onBlur={e => {
                          const val = e.target.value;
                          if (val !== String(prod.unidCaixa || '')) {
                            updateProduct.mutate({ id: prod.id, unidCaixa: val || undefined });
                          }
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                    )}
                  </td>
                  {/* Col 1: Valor Pago ao Fornecedor (sempre editável) */}
                  <td className="px-2 py-2 text-center whitespace-nowrap">
                    {editingId === prod.id ? (
                      <div className="relative inline-flex items-center">
                        <span className="absolute left-1.5 text-[9px] text-slate-400 font-mono pointer-events-none">{currency === 'USD' ? '$' : 'R$'}</span>
                        <input
                          className="w-20 text-center border border-blue-300 rounded pl-5 pr-1 py-0.5 text-[10px] font-mono"
                          value={editValues.valorUsd || ''}
                          onChange={e => setEditValues({ ...editValues, valorUsd: e.target.value })}
                          placeholder="0,00"
                        />
                      </div>
                    ) : (
                      <div className="relative inline-flex items-center">
                        <span className="absolute left-1.5 text-[9px] text-blue-500 font-mono pointer-events-none">{currency === 'USD' ? '$' : 'R$'}</span>
                        <input
                          key={`val-${prod.id}-${prod.valorUsd}-${currency}`}
                          className="w-20 text-center border border-slate-200 rounded pl-5 pr-1 py-1 text-[10px] font-mono text-blue-700 font-semibold bg-white hover:border-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                          defaultValue={prod.valorUsd ? (currency === 'BRL' ? String(Number(prod.valorUsd) * (isLegacyPo ? poExchangeRate + 0.20 : effectiveRate)) : String(Number(prod.valorUsd))) : ''}
                          placeholder="0,00"
                          onBlur={e => {
                            const normalized = e.target.value.replace(',', '.');
                            const rate = isLegacyPo ? poExchangeRate + 0.20 : effectiveRate;
                            const valueInUsd = currency === 'BRL' ? String(Number(normalized) / rate) : normalized;
                            if (valueInUsd !== String(prod.valorUsd || '')) {
                              updateProduct.mutate({ id: prod.id, valorUsd: valueInUsd });
                            }
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                      </div>
                    )}
                  </td>
                  {/* Col 2: Valor Pago na Ordem de Pagamento (sempre editável) */}
                  <td className="px-2 py-2 text-center bg-blue-50/30 whitespace-nowrap">
                    {editingId === prod.id ? (
                      <div className="relative inline-flex items-center">
                        <span className="absolute left-1.5 text-[9px] text-slate-400 font-mono pointer-events-none">{currency === 'USD' ? '$' : 'R$'}</span>
                        <input
                          className="w-20 text-center border border-blue-300 rounded pl-5 pr-1 py-0.5 text-[10px] font-mono"
                          value={editValues.valorPoCheia || ''}
                          onChange={e => setEditValues({ ...editValues, valorPoCheia: e.target.value })}
                          placeholder="0,00"
                        />
                      </div>
                    ) : (
                      <div className="relative inline-flex items-center">
                        <span className="absolute left-1.5 text-[9px] text-blue-500 font-mono pointer-events-none">{currency === 'USD' ? '$' : 'R$'}</span>
                        <input
                          key={`ordem-${prod.id}-${prod.valorPoCheia}-${currency}`}
                          className="w-20 text-center border border-slate-200 rounded pl-5 pr-1 py-1 text-[10px] font-mono text-blue-700 bg-white hover:border-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                          defaultValue={prod.valorPoCheia ? (currency === 'BRL' ? String(Number(prod.valorPoCheia) * (isLegacyPo ? poExchangeRate + 0.20 : effectiveRate)) : String(Number(prod.valorPoCheia))) : ''}
                          placeholder="0,00"
                          onBlur={e => {
                            const normalized = e.target.value.replace(',', '.');
                            const rate = isLegacyPo ? poExchangeRate + 0.20 : effectiveRate;
                            const valueInUsd = currency === 'BRL' ? String(Number(normalized) / rate) : normalized;
                            if (valueInUsd !== String(prod.valorPoCheia || '')) {
                              updateProduct.mutate({ id: prod.id, valorPoCheia: valueInUsd });
                            }
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                      </div>
                    )}
                  </td>
                  {/* Col 3: Diferença (automático) */}
                  <td className="px-2 py-2 text-center bg-orange-50/30 whitespace-nowrap">
                    <span className={`font-mono font-medium ${diferenca > 0 ? 'text-orange-600' : diferenca < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {(valorForn > 0 || valorOrdem > 0) ? (currency === "USD" ? `$ ${Math.round(diferenca * 100) / 100 === diferenca ? diferenca.toFixed(2) : (Math.ceil(diferenca * 100) / 100).toFixed(2)}` : `R$ ${(Math.round(diferenca * (isLegacyPo ? poExchangeRate + 0.20 : effectiveRate) * 100) / 100).toFixed(2)}`) : '—'}
                    </span>
                  </td>
                  {/* Col 4: Quantidade de Caixas (sempre editável) */}
                  <td className="px-2 py-2 text-center">
                    {editingId === prod.id ? (
                      <input
                        className="w-16 text-center border border-blue-300 rounded px-1 py-0.5 text-[10px] font-mono"
                        value={editValues.quantidade || ''}
                        onChange={e => setEditValues({ ...editValues, quantidade: e.target.value })}
                        placeholder="0"
                        type="number"
                      />
                    ) : (
                      <input
                        key={`qty-${prod.id}-${prod.quantidade}`}
                        className="w-16 text-center border border-slate-200 rounded px-1 py-1 text-[10px] font-mono text-slate-700 font-semibold bg-white hover:border-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                        defaultValue={prod.quantidade || ''}
                        placeholder="0"
                        type="number"
                        onBlur={e => {
                          const val = e.target.value;
                          if (val !== String(prod.quantidade || '')) {
                            updateProduct.mutate({ id: prod.id, quantidade: val ? parseInt(val) : null });
                          }
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                    )}
                  </td>
                  {/* Col 5: Frete Calculado pelo Fornecedor */}
                  <td className="px-2 py-2 text-center bg-orange-50/30 whitespace-nowrap">
                    <span className="font-mono text-orange-700 font-semibold">
                      {(valorForn > 0 && valorOrdem > 0 && qty > 0) ? (currency === "USD" ? `$ ${(Math.round(freteCalcFornecedor * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(Math.round(freteCalcFornecedor * (isLegacyPo ? poExchangeRate + 0.20 : effectiveRate) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : '—'}
                    </span>
                  </td>
                  {/* Col 6: Frete com Rateio Correto (% na ordem × frete total) */}
                  <td className="px-2 py-2 text-center bg-purple-50/30 whitespace-nowrap">
                    <span className="font-mono text-purple-700 font-medium">
                      {(valorForn > 0 && qty > 0 && totalValorReferencia > 0 && totalFreteCalculado > 0) ? (currency === "USD" ? `$ ${(Math.round(freteRateioCorreto * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(Math.round(freteRateioCorreto * (isLegacyPo ? poExchangeRate + 0.20 : effectiveRate) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : '—'}
                    </span>
                  </td>
                  {/* Col 7: Valor de Referência (Valor Pago ao Fornecedor × Quantidade de Caixas) */}
                  <td className="px-2 py-2 text-center bg-emerald-50/30 whitespace-nowrap">
                    <span className="font-mono text-emerald-700 font-semibold">
                      {(valorForn > 0 && qty > 0) ? (currency === "USD" ? `$ ${(Math.round(valorRef * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(Math.round(valorRef * (isLegacyPo ? poExchangeRate + 0.20 : effectiveRate) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : '—'}
                    </span>
                  </td>
                  {/* Porcentagem que o Produto Representa no Valor do Total da Ordem de Pagamento */}
                  <td className="px-2 py-2 text-center bg-indigo-50/30 whitespace-nowrap">
                    <span className="font-mono text-indigo-700 font-semibold">
                      {percProdutoNoTotal > 0 ? `${(Math.round(percProdutoNoTotal * 100) / 100).toFixed(2)} %` : '—'}
                    </span>
                  </td>
                  {/* Valor da Caixa - para legacy usa valor do banco, para novas POs mostra cálculo LIVE */}
                  <td className="px-2 py-2 text-center bg-emerald-50/30 whitespace-nowrap">
                    <span className="font-mono text-emerald-800 font-bold text-[11px]">
                      {isLegacyPo && prod.valorCaixaBrl && Number(prod.valorCaixaBrl) > 0
                        ? (currency === "USD"
                            ? `$ ${(Number(prod.valorCaixaBrl) / (poExchangeRate + 0.20)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `R$ ${Number(prod.valorCaixaBrl).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                        : valorDaCaixa > 0 ? (currency === "USD" ? `$ ${valorDaCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(valorDaCaixa * effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : '—'}
                    </span>
                    {isLegacyPo && prod.valorCaixaBrl && Number(prod.valorCaixaBrl) > 0 && (
                      <span className="block text-[8px] text-emerald-500 mt-0.5">(planilha - travado)</span>
                    )}
                  </td>
                  {/* Preço Mil/Unid. - do banco para legacy, calculado para novas */}
                  <td className="px-2 py-2 text-center bg-teal-50/30 whitespace-nowrap">
                    <span className="font-mono text-teal-800 font-bold text-[11px]">
                      {isLegacyPo
                        ? (prod.precoMilUnid
                            ? (currency === "USD"
                                ? `$ ${(Number(prod.precoMilUnid) / 5.5).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `R$ ${Number(prod.precoMilUnid).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                            : '—')
                        : (() => {
                            const unid = Number(prod.unidCaixa || 0);
                            // For new POs: valorDaCaixa is in USD (custosTotais is USD for new POs)
                            // Convert to BRL then divide by unid
                            const valorCaixaBrl = valorDaCaixa * effectiveRate;
                            const precoCalc = unid > 0 ? valorCaixaBrl / unid : 0;
                            if (precoCalc <= 0) return '—';
                            return currency === "USD"
                              ? `$ ${(precoCalc / effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `R$ ${precoCalc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                          })()
                      }
                    </span>
                  </td>
                  {/* Ações */}
                  <td className="px-2 py-2 text-center">
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
              );
            })}
          </tbody>
        </table>
      </div>

      {(products || []).length === 0 && (
        <p className="text-center text-slate-400 text-xs py-6">Nenhum produto nesta PO. Clique em "Adicionar Produto" para começar.</p>
      )}

      {/* === TOTALIZADORES === */}
      {filteredProducts.length > 0 && (
        <div className="p-4 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/30 space-y-4">
          {/* Totais da Tabela */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-emerald-200 rounded-lg p-3">
              <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Valor Total da Ordem de Pagamento</p>
              <p className="text-lg font-bold font-mono text-emerald-800">
                {currency === "USD" ? `$ ${totalValorReferencia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(totalValorReferencia * (isLegacyPo ? poExchangeRate + 0.20 : effectiveRate)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
              <p className="text-[9px] text-slate-500">Soma dos Valores de Referência</p>
            </div>
            <div className="bg-white border border-orange-200 rounded-lg p-3">
              <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider">Valor Total do Frete</p>
              {freteEditing ? (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-sm font-mono text-orange-800">{currency === 'USD' ? '$' : 'R$'}</span>
                  <input
                    autoFocus
                    type="number"
                    step="any"
                    className="w-32 text-lg font-bold font-mono text-orange-800 border border-orange-300 rounded px-2 py-0.5 focus:ring-1 focus:ring-orange-300 outline-none"
                    defaultValue={freteOverrideUsd !== null
                      ? (currency === 'BRL' ? (Number(freteOverrideUsd) * (isLegacyPo ? poExchangeRate + 0.20 : effectiveRate)).toString() : freteOverrideUsd)
                      : (currency === 'BRL' ? (totalFreteAutoCalc * (isLegacyPo ? poExchangeRate + 0.20 : effectiveRate)).toString() : totalFreteAutoCalc.toString())
                    }
                    onBlur={e => {
                      const normalized = e.target.value.replace(',', '.');
                      const rate = isLegacyPo ? poExchangeRate + 0.20 : effectiveRate;
                      const valUsd = currency === 'BRL' ? String(Number(normalized) / rate) : normalized;
                      let newOverride: string | null;
                      if (Math.abs(Number(valUsd) - totalFreteAutoCalc) < 0.001) {
                        newOverride = null; // volta ao automático se igual
                      } else {
                        newOverride = valUsd;
                      }
                      setFreteOverrideUsd(newOverride);
                      setFreteEditing(false);
                      // Auto-save imediatamente ao sair do campo
                      updateLogistics.mutate({
                        id: po.id,
                        freteOverrideUsd: newOverride || null,
                      });
                      // Mark to recalculate and save productCosts since frete affects Valor da Caixa
                      needsSaveAfterEditRef.current = true;
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setFreteEditing(false); } }}
                  />
                </div>
              ) : (
                <p className="text-lg font-bold font-mono text-orange-800 cursor-pointer hover:text-orange-600" onClick={() => setFreteEditing(true)}>
                  {currency === "USD" ? `$ ${totalFreteCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(totalFreteCalculado * (isLegacyPo ? poExchangeRate + 0.20 : effectiveRate)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </p>
              )}
              <div className="flex items-center gap-1 mt-0.5">
                <p className="text-[9px] text-slate-500">{freteOverrideUsd !== null ? 'Valor editado manualmente' : 'Soma Frete Calculado pelo Fornecedor'}</p>
                {freteOverrideUsd !== null && (
                  <button onClick={() => setFreteOverrideUsd(null)} className="text-[8px] text-orange-500 hover:text-orange-700 underline">
                    Resetar
                  </button>
                )}
                {!freteEditing && freteOverrideUsd === null && (
                  <button onClick={() => setFreteEditing(true)} className="text-[8px] text-slate-400 hover:text-orange-600">
                    ✏️
                  </button>
                )}
              </div>
            </div>
            <div className="bg-white border border-indigo-200 rounded-lg p-3">
              <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Total Geral (Ordem + Frete)</p>
              <p className="text-lg font-bold font-mono text-indigo-800">
                {currency === "USD" ? `$ ${(totalValorReferencia + totalFreteCalculado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${((totalValorReferencia + totalFreteCalculado) * (isLegacyPo ? poExchangeRate + 0.20 : effectiveRate)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
            </div>
          </div>

          {/* Remessas + Custos Adicionais + Card Roxo (sempre visível) */}
          <>
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Receipt className="w-3 h-3" /> Remessas de Pagamento
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 font-medium">1ª Remessa (valor total menos 2ª e 3ª)</label>
                <div className="w-full border border-emerald-200 bg-emerald-50 rounded px-3 py-2 text-sm font-mono font-bold text-emerald-800">
                  {currency === "USD" ? `$ ${(remessa1Calculada > 0 ? remessa1Calculada : totalOrdemPagamento).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${((remessa1Calculada > 0 ? remessa1Calculada : totalOrdemPagamento) * (isLegacyPo ? poExchangeRate + 0.20 : effectiveRate)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-medium">2ª Remessa</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none">{currency === 'USD' ? '$' : 'R$'}</span>
                  <input
                    key={`pag2-${currency}`}
                    className="w-full border border-slate-300 rounded pl-8 pr-3 py-2 text-sm font-mono bg-white"
                    placeholder="0,00"
                    defaultValue={displayVal(pag2Usd)}
                    onBlur={e => setPag2Usd(toUsd(e.target.value))}
                    type="number"
                    step="any"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-medium">3ª Remessa</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none">{currency === 'USD' ? '$' : 'R$'}</span>
                  <input
                    key={`pag3-${currency}`}
                    className="w-full border border-slate-300 rounded pl-8 pr-3 py-2 text-sm font-mono bg-white"
                    placeholder="0,00"
                    defaultValue={displayVal(pag3Usd)}
                    onBlur={e => setPag3Usd(toUsd(e.target.value))}
                    type="number"
                    step="any"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CI + Despesas + Frete Terrestre + DIFAL + Comissão */}
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calculator className="w-3 h-3" /> Custos Adicionais da Importação
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 font-medium">Valor da CI (Commercial Invoice)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none">{currency === 'USD' ? '$' : 'R$'}</span>
                  <input
                    key={`ci-${currency}`}
                    className="w-full border border-slate-300 rounded pl-8 pr-3 py-2 text-sm font-mono bg-white"
                    placeholder="0,00"
                    defaultValue={displayVal(valorCiUsd)}
                    onBlur={e => setValorCiUsd(toUsd(e.target.value))}
                    type="number"
                    step="any"
                  />
                </div>
              </div>
              <div className="col-span-2">
                {isLegacyPo ? (
                  <>
                    <label className="text-[10px] text-slate-500 font-medium">Despesas de Liberação (valor fixo da planilha)</label>
                    <div className="w-full border border-amber-200 bg-amber-50 rounded px-3 py-2 text-sm font-mono font-bold text-amber-800">
                      {currency === "USD" ? `$ ${(Number(po.despesasLiberacaoRemessa || 0) / poExchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(po.despesasLiberacaoRemessa || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Campo Alaranjado - Estimativa (% da CI) */}
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5">
                        Desp. Liberação – Estimativa (
                        <input
                          className="w-10 border border-amber-300 rounded px-1 py-0 text-[10px] font-mono text-center bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          defaultValue={vilelaPercent}
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          onBlur={e => {
                            const val = Number(e.target.value);
                            if (val !== vilelaPercent && val >= 0 && val <= 100) {
                              setVilelaPercent.mutate({ percent: val });
                            }
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                        % da CI)
                      </label>
                      <div className={`w-full border rounded px-3 py-2 text-sm font-mono font-bold ${vilelaReal ? 'border-slate-200 bg-slate-50 text-slate-400 line-through' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        {currency === "USD" ? `$ ${vilelaEstimativa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(vilelaEstimativa * effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </div>
                    </div>
                    {/* Campo Verde - Valor Real Vilela */}
                    <div>
                      <label className="text-[10px] text-green-700 font-medium">
                        Valor Real Vilela (USD)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-green-500 font-mono pointer-events-none">$</span>
                        <input
                          className="w-full border-2 border-green-300 bg-green-50 rounded px-3 py-2 pl-7 text-sm font-mono font-bold text-green-800 focus:outline-none focus:ring-2 focus:ring-green-400 placeholder:text-green-300"
                          placeholder="0.00"
                          type="number"
                          step="any"
                          value={vilelaReal}
                          onChange={e => setVilelaReal(e.target.value)}
                        />
                      </div>
                      {vilelaReal && (
                        <p className="text-[9px] text-green-600 mt-0.5 font-medium">
                          ✓ Usando valor real no cálculo
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-medium">Frete Terrestre SP/MG</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none">{currency === 'USD' ? '$' : 'R$'}</span>
                  <input
                    key={`frete-sp-${currency}`}
                    className="w-full border border-slate-300 rounded pl-8 pr-3 py-2 text-sm font-mono bg-white"
                    placeholder="0,00"
                    defaultValue={displayVal(freteTerrestreSPUsd)}
                    onBlur={e => setFreteTerrestreSPUsd(toUsd(e.target.value))}
                    type="number"
                    step="any"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-medium">DIFAL</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none">{currency === 'USD' ? '$' : 'R$'}</span>
                  <input
                    key={`difal-${currency}`}
                    className="w-full border border-slate-300 rounded pl-8 pr-3 py-2 text-sm font-mono bg-white"
                    placeholder="0,00"
                    defaultValue={displayVal(difalValUsd)}
                    onBlur={e => setDifalValUsd(toUsd(e.target.value))}
                    type="number"
                    step="any"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-medium">Comissão Silvério</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none">{currency === 'USD' ? '$' : 'R$'}</span>
                  <input
                    key={`com-silverio-${currency}`}
                    className="w-full border border-slate-300 rounded pl-8 pr-3 py-2 text-sm font-mono bg-white"
                    placeholder="0,00"
                    defaultValue={displayVal(comSilverioUsd)}
                    onBlur={e => setComSilverioUsd(toUsd(e.target.value))}
                    type="number"
                    step="any"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CUSTOS TOTAIS DA IMPORTAÇÃO */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-5 sm:p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-indigo-100">Custos Totais da Importação</p>
                <p className="text-[10px] sm:text-xs text-indigo-200 mt-1">{isLegacyPo ? 'Ordem de Pagamento (CI) + Despesas Liberação + Frete Terrestre + DIFAL + Comissão Silvério' : 'Ordem de Pagamento + Frete + Despesas Liberação + Frete Terrestre + DIFAL + Comissão Silvério'}</p>
              </div>
              <p className="text-3xl sm:text-4xl font-bold font-mono">
                {isLegacyPo
                  ? (currency === "USD" ? `$ ${(custosTotais / poExchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${custosTotais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                  : (currency === "USD" ? `$ ${custosTotais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(custosTotais * effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
              </p>
            </div>
            <div className={`mt-4 grid grid-cols-2 ${isLegacyPo ? 'sm:grid-cols-5' : 'sm:grid-cols-6'} gap-2 sm:gap-3`}>
              <div className="bg-white/15 rounded-lg px-3 py-2">
                <p className="text-[10px] sm:text-xs text-indigo-200 font-medium">Ordem Pgto</p>
                <p className="font-mono font-bold text-sm sm:text-base mt-0.5">{isLegacyPo
                  ? (currency === "USD" ? `$ ${(Number(po.pagamento1Remessa || 0) / poExchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(po.pagamento1Remessa || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                  : (currency === "USD" ? `$ ${totalValorReferencia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(totalValorReferencia * effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}</p>
              </div>
              {!isLegacyPo && (
              <div className="bg-white/15 rounded-lg px-3 py-2">
                <p className="text-[10px] sm:text-xs text-indigo-200 font-medium">Frete</p>
                <p className="font-mono font-bold text-sm sm:text-base mt-0.5">
                  {currency === "USD" ? `$ ${totalFreteCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(totalFreteCalculado * effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
              </div>
              )}
              <div className="bg-white/15 rounded-lg px-3 py-2">
                <p className="text-[10px] sm:text-xs text-indigo-200 font-medium">Desp. Lib.</p>
                <p className="font-mono font-bold text-sm sm:text-base mt-0.5">{isLegacyPo
                  ? (currency === "USD" ? `$ ${(Number(po.despesasLiberacaoRemessa || 0) / poExchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(po.despesasLiberacaoRemessa || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                  : (currency === "USD" ? `$ ${despesasLiberacao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(despesasLiberacao * effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}</p>
              </div>
              <div className="bg-white/15 rounded-lg px-3 py-2">
                <p className="text-[10px] sm:text-xs text-indigo-200 font-medium">Frete SP/MG</p>
                <p className="font-mono font-bold text-sm sm:text-base mt-0.5">{isLegacyPo
                  ? (currency === "USD" ? `$ ${(Number(po.freteTermestreRemessa || 0) / poExchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(po.freteTermestreRemessa || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                  : (currency === "USD" ? `$ ${Number(freteTerrestreSP || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(Number(freteTerrestreSP || 0) * effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}</p>
              </div>
              <div className="bg-white/15 rounded-lg px-3 py-2">
                <p className="text-[10px] sm:text-xs text-indigo-200 font-medium">DIFAL</p>
                <p className="font-mono font-bold text-sm sm:text-base mt-0.5">{isLegacyPo
                  ? (currency === "USD" ? `$ ${(Number(po.difalValor || 0) / poExchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(po.difalValor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                  : (currency === "USD" ? `$ ${Number(difalVal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(Number(difalVal || 0) * effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}</p>
              </div>
              <div className="bg-white/15 rounded-lg px-3 py-2">
                <p className="text-[10px] sm:text-xs text-indigo-200 font-medium">Com. Silvério</p>
                <p className="font-mono font-bold text-sm sm:text-base mt-0.5">{isLegacyPo
                  ? (currency === "USD" ? `$ ${(Number(po.comissaoSilverio || 0) / poExchangeRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${Number(po.comissaoSilverio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                  : (currency === "USD" ? `$ ${Number(comSilverio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${(Number(comSilverio || 0) * effectiveRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}</p>
              </div>
            </div>
          </div>

          {/* Botão Salvar Custos */}
          <div className="flex justify-end">
            <button
              onClick={saveCosts}
              disabled={updateLogistics.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {updateLogistics.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Salvar Custos
            </button>
          </div>
          </>
        </div>
      )}
    </div>
  );
}
