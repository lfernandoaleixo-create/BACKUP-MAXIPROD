/**
 * E-commerce Tab - Despesas e Estornos da operação e-commerce (contas a pagar filial)
 * Acesso restrito: Pedro, Flavio, Guilherme
 */
import React, { useState, useMemo, useCallback } from "react";
import RefundsSection from "@/components/RefundsSection";
import { generateSalesReportPdf } from "@/lib/ecommerceSalesReportPdf";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ShoppingCart,
  Plus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  Calendar,
  DollarSign,
  Package,
  Loader2,
  X,
  AlertTriangle,
  TrendingUp,
  Search,
  Filter,
  SlidersHorizontal,
  User,
  FileDown,
  Warehouse,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Pencil,
  RefreshCw,
  Settings,
  Check,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const FORMA_PAGAMENTO_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pix: { label: "PIX", icon: <QrCode className="w-3.5 h-3.5" />, color: "bg-green-100 text-green-700 border-green-200" },
  boleto: { label: "Boleto", icon: <Banknote className="w-3.5 h-3.5" />, color: "bg-blue-100 text-blue-700 border-blue-200" },
  cartao_credito: { label: "Cartão de Crédito", icon: <CreditCard className="w-3.5 h-3.5" />, color: "bg-purple-100 text-purple-700 border-purple-200" },
};

const FORMA_PAGAMENTO_PDF_LABELS: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao_credito: "Cartão de Crédito",
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function generateExpensesPdf(
  expenses: any[],
  filters: { descricao: string; formaPagamento: string; dataInicio: string; dataFim: string; registradoPor: string },
  total: number,
  creditCards: any[] = [],
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header - dark gradient bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageW, 36, "F");
  // Orange accent line
  doc.setFillColor(234, 88, 12); // orange-600
  doc.rect(0, 36, pageW, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("GRUPO FOX", 14, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório de Despesas — E-commerce", 14, 22);
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 30);

  // Filtros aplicados
  let y = 44;
  const activeFilters: string[] = [];
  if (filters.descricao) activeFilters.push(`Descrição: "${filters.descricao}"`);
  if (filters.formaPagamento) activeFilters.push(`Pagamento: ${FORMA_PAGAMENTO_PDF_LABELS[filters.formaPagamento] || filters.formaPagamento}`);
  if (filters.dataInicio) activeFilters.push(`De: ${formatDate(filters.dataInicio)}`);
  if (filters.dataFim) activeFilters.push(`Até: ${formatDate(filters.dataFim)}`);
  if (filters.registradoPor) activeFilters.push(`Registrado por: ${filters.registradoPor}`);

  if (activeFilters.length > 0) {
    doc.setFillColor(255, 247, 237); // orange-50
    doc.roundedRect(14, y, pageW - 28, 14, 2, 2, "F");
    doc.setDrawColor(251, 191, 36); // amber-400
    doc.roundedRect(14, y, pageW - 28, 14, 2, 2, "S");
    doc.setTextColor(146, 64, 14); // amber-800
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("FILTROS APLICADOS:", 18, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text(activeFilters.join("  •  "), 18, y + 10);
    y += 20;
  } else {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text("Sem filtros aplicados — exibindo todas as despesas", 14, y);
    y += 8;
  }

  // Summary boxes
  const boxW = 52;
  const gap = 6;
  const boxH = 18;

  // Total
  doc.setFillColor(234, 88, 12); // orange-600
  doc.roundedRect(14, y, boxW, boxH, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("TOTAL", 18, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(total), 18, y + 14);

  // Qtd itens
  doc.setFillColor(71, 85, 105); // slate-600
  doc.roundedRect(14 + boxW + gap, y, boxW, boxH, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("LANÇAMENTOS", 18 + boxW + gap, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(expenses.length), 18 + boxW + gap, y + 14);

  // Média por item
  const media = expenses.length > 0 ? total / expenses.length : 0;
  doc.setFillColor(8, 145, 178); // cyan-600
  doc.roundedRect(14 + 2 * (boxW + gap), y, boxW, boxH, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("MÉDIA/ITEM", 18 + 2 * (boxW + gap), y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(media), 18 + 2 * (boxW + gap), y + 14);

  y += boxH + 8;

  // Table
  const getCardName = (cardId: number | null) => {
    if (!cardId) return "—";
    const card = creditCards.find((c: any) => c.id === cardId);
    return card ? `${card.nome} (${card.bandeira} ••${card.ultimos4})` : "—";
  };

  const tableData = expenses.map((exp: any) => [
    formatDate(exp.dataCompra),
    exp.descricao,
    FORMA_PAGAMENTO_PDF_LABELS[exp.formaPagamento] || exp.formaPagamento,
    exp.formaPagamento === "cartao_credito" && exp.parcelas > 1 ? `${exp.parcelas}x` : "1x",
    formatCurrency(Number(exp.valorTotal)),
    exp.formaPagamento === "cartao_credito" ? getCardName(exp.cartaoId) : "—",
    exp.recorrente === 1 ? "Sim" : "Não",
    exp.registradoPor,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Data", "Descrição", "Pagamento", "Parc.", "Valor", "Cartão", "Recor.", "Por"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: "bold",
      cellPadding: 2.5,
    },
    bodyStyles: { fontSize: 6.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 42 },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 24, halign: "right", fontStyle: "bold" },
      5: { cellWidth: 32 },
      6: { cellWidth: 14, halign: "center" },
      7: { cellWidth: 18, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 2) {
        const val = data.cell.raw;
        if (val === "PIX") {
          data.cell.styles.textColor = [21, 128, 61];
          data.cell.styles.fontStyle = "bold";
        } else if (val === "Boleto") {
          data.cell.styles.textColor = [29, 78, 216];
          data.cell.styles.fontStyle = "bold";
        } else if (val === "Cartão de Crédito") {
          data.cell.styles.textColor = [126, 34, 206];
          data.cell.styles.fontStyle = "bold";
        }
      }
      // Highlight recorrente
      if (data.section === "body" && data.column.index === 6) {
        if (data.cell.raw === "Sim") {
          data.cell.styles.textColor = [161, 98, 7]; // amber-700
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // Footer
  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, finalY + 6, pageW - 14, finalY + 6);
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.text("Grupo Fox — Sistema de Gestão de Despesas E-commerce", 14, finalY + 12);
  doc.text("Documento gerado automaticamente", pageW - 14 - doc.getTextWidth("Documento gerado automaticamente"), finalY + 12);

  // Generate filename
  const parts = ["Despesas_Ecommerce"];
  if (filters.dataInicio || filters.dataFim) {
    if (filters.dataInicio) parts.push(filters.dataInicio.replace(/-/g, ""));
    parts.push("a");
    if (filters.dataFim) parts.push(filters.dataFim.replace(/-/g, ""));
  }
  if (filters.formaPagamento) parts.push(FORMA_PAGAMENTO_PDF_LABELS[filters.formaPagamento]?.replace(/\s+/g, "") || filters.formaPagamento);
  const fileName = `${parts.join("_")}.pdf`;
  doc.save(fileName);
}

export default function EcommerceTab() {
  const { operator } = useOperator();
  const [showForm, setShowForm] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [dataCompra, setDataCompra] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [formaPagamento, setFormaPagamento] = useState<"pix" | "boleto" | "cartao_credito">("pix");
  const [parcelas, setParcelas] = useState(1);
  const [valorTotal, setValorTotal] = useState("");
  const [observacao, setObservacao] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [recorrente, setRecorrente] = useState(false);
  const [cartaoId, setCartaoId] = useState<number | null>(null);
  const [showCardManager, setShowCardManager] = useState(false);
  const [cardNome, setCardNome] = useState("");
  const [cardBandeira, setCardBandeira] = useState("");
  const [cardUltimos4, setCardUltimos4] = useState("");
  const [cardTitular, setCardTitular] = useState("");
  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);

  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [filterDescricao, setFilterDescricao] = useState("");
  const [filterFormaPagamento, setFilterFormaPagamento] = useState<"" | "pix" | "boleto" | "cartao_credito">("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [filterRegistradoPor, setFilterRegistradoPor] = useState("");

  const operatorName = operator?.name || "";

  const { data: listData, isLoading, refetch } = trpc.ecommerce.listExpenses.useQuery(
    { operatorName },
    { enabled: !!operatorName, refetchInterval: 30000 }
  );

  const { data: summaryData } = trpc.ecommerce.getSummary.useQuery(
    { operatorName },
    { enabled: !!operatorName, refetchInterval: 30000 }
  );

  const { data: cardsData, refetch: refetchCards } = trpc.ecommerce.listCreditCards.useQuery(
    { operatorName },
    { enabled: !!operatorName }
  );
  const creditCards = cardsData?.cards || [];
  const activeCards = creditCards.filter((c: any) => c.ativo === 1);

  const addMutation = trpc.ecommerce.addExpense.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        resetExpenseForm();
        refetch();
      }
    },
  });

  const addCardMutation = trpc.ecommerce.addCreditCard.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setShowCardForm(false);
        setCardNome(""); setCardBandeira(""); setCardUltimos4(""); setCardTitular("");
        setEditingCardId(null);
        refetchCards();
      }
    },
  });
  const updateCardMutation = trpc.ecommerce.updateCreditCard.useMutation({
    onSuccess: (data) => { if (data.success) { setShowCardForm(false); setEditingCardId(null); setCardNome(""); setCardBandeira(""); setCardUltimos4(""); setCardTitular(""); refetchCards(); } },
  });
  const deleteCardMutation = trpc.ecommerce.deleteCreditCard.useMutation({
    onSuccess: (data) => { if (data.success) refetchCards(); },
  });

  const updateMutation = trpc.ecommerce.updateExpense.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        resetExpenseForm();
        refetch();
      }
    },
  });

  const deleteMutation = trpc.ecommerce.deleteExpense.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setDeleteConfirm(null);
        refetch();
      }
    },
  });

  const resetExpenseForm = () => {
    setShowForm(false);
    setDescricao("");
    setValorTotal("");
    setObservacao("");
    setParcelas(1);
    setRecorrente(false);
    setCartaoId(null);
    setEditingId(null);
  };

  const startEditExpense = (exp: any) => {
    setEditingId(exp.id);
    setDescricao(exp.descricao);
    setDataCompra(exp.dataCompra);
    setFormaPagamento(exp.formaPagamento);
    setParcelas(exp.parcelas || 1);
    setValorTotal(String(Number(exp.valorTotal)));
    setObservacao(exp.observacao || "");
    setRecorrente(exp.recorrente === 1);
    setCartaoId(exp.cartaoId || null);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseFloat(valorTotal.replace(",", "."));
    if (!descricao.trim() || isNaN(valor) || valor <= 0) return;
    const payload = {
      operatorName,
      descricao: descricao.trim(),
      dataCompra,
      formaPagamento,
      parcelas: (formaPagamento === "cartao_credito" || formaPagamento === "boleto") ? parcelas : 1,
      valorTotal: valor,
      observacao: observacao.trim() || undefined,
      recorrente,
      cartaoId: formaPagamento === "cartao_credito" ? cartaoId : null,
    };
    if (editingId) {
      updateMutation.mutate({ ...payload, id: editingId });
    } else {
      addMutation.mutate(payload);
    }
  };

  const allExpenses = listData?.expenses || [];
  const summary = summaryData?.summary;

  // Aplicar filtros
  const filteredExpenses = useMemo(() => {
    return allExpenses.filter((exp: any) => {
      if (filterDescricao.trim()) {
        const search = filterDescricao.toLowerCase().trim();
        const matchDesc = exp.descricao?.toLowerCase().includes(search);
        const matchObs = exp.observacao?.toLowerCase().includes(search);
        if (!matchDesc && !matchObs) return false;
      }
      if (filterFormaPagamento && exp.formaPagamento !== filterFormaPagamento) return false;
      if (filterDataInicio && exp.dataCompra < filterDataInicio) return false;
      if (filterDataFim && exp.dataCompra > filterDataFim) return false;
      if (filterRegistradoPor && exp.registradoPor !== filterRegistradoPor) return false;
      return true;
    });
  }, [allExpenses, filterDescricao, filterFormaPagamento, filterDataInicio, filterDataFim, filterRegistradoPor]);

  // Lista de operadores únicos que registraram despesas
  const registradores = useMemo(() => {
    const names = new Set(allExpenses.map((e: any) => e.registradoPor));
    return Array.from(names).sort();
  }, [allExpenses]);

  // Total filtrado
  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((sum: number, exp: any) => sum + Number(exp.valorTotal), 0);
  }, [filteredExpenses]);

  const hasActiveFilters = filterDescricao || filterFormaPagamento || filterDataInicio || filterDataFim || filterRegistradoPor;

  const clearFilters = () => {
    setFilterDescricao("");
    setFilterFormaPagamento("");
    setFilterDataInicio("");
    setFilterDataFim("");
    setFilterRegistradoPor("");
  };

  const handleExportPdf = () => {
    generateExpensesPdf(
      filteredExpenses,
      {
        descricao: filterDescricao,
        formaPagamento: filterFormaPagamento,
        dataInicio: filterDataInicio,
        dataFim: filterDataFim,
        registradoPor: filterRegistradoPor,
      },
      filteredTotal,
      creditCards,
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-3" />
        <p className="text-sm text-slate-500">Carregando despesas do e-commerce...</p>
      </div>
    );
  }

  const salesReportAllowed = ["Pedro", "Fernando", "Bruno", "Guilherme"];
  const showSalesReport = salesReportAllowed.includes(operatorName);

  return (
    <div className="space-y-5 mt-4">
      {/* Sales Report Section */}
      {showSalesReport && (
        <SalesReportSection operatorName={operatorName} />
      )}

      {/* Separator between Sales Report and Despesas */}
      {showSalesReport && (
        <div className="my-10">
          <div className="h-[2px] bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />
        </div>
      )}

      {/* Title */}
      <div className="flex items-center gap-2">
        <ShoppingCart className="w-5 h-5 text-orange-600" />
        <h3 className="text-lg font-semibold text-slate-800">Despesas E-commerce</h3>
        <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">
          {hasActiveFilters ? `${filteredExpenses.length}/${allExpenses.length}` : allExpenses.length}
        </Badge>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Geral</span>
              <DollarSign className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(summary.totalGeral)}</p>
            <p className="text-[11px] text-slate-400 mt-1">{summary.totalCount} lançamentos</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mês Atual</span>
              <Calendar className="w-4 h-4 text-teal-500" />
            </div>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(summary.mesAtual.total)}</p>
            <p className="text-[11px] text-slate-400 mt-1">{summary.mesAtual.count} lançamentos</p>
          </div>
          {summary.porFormaPagamento.map((fp: any) => {
            const info = FORMA_PAGAMENTO_LABELS[fp.forma] || { label: fp.forma, icon: null, color: "" };
            return (
              <div key={fp.forma} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{info.label}</span>
                  {info.icon}
                </div>
                <p className="text-xl font-bold text-slate-800">{formatCurrency(fp.total)}</p>
                <p className="text-[11px] text-slate-400 mt-1">{fp.count} lançamentos</p>
              </div>
            );
          })}
        </div>
      )}



      {/* Filtros */}
      {showFilters && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Filtros</span>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-[11px] text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Busca por descrição */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Descrição / Produto</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={filterDescricao}
                  onChange={(e) => setFilterDescricao(e.target.value)}
                  placeholder="Buscar por nome..."
                  className="bg-white pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {/* Forma de pagamento */}
            <div>
              <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Pagamento</label>
              <select
                value={filterFormaPagamento}
                onChange={(e) => setFilterFormaPagamento(e.target.value as any)}
                className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                <option value="">Todos</option>
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="cartao_credito">Cartão de Crédito</option>
              </select>
            </div>

            {/* Período */}
            <div>
              <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Data início</label>
              <Input
                type="date"
                value={filterDataInicio}
                onChange={(e) => setFilterDataInicio(e.target.value)}
                className="bg-white h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Data fim</label>
              <Input
                type="date"
                value={filterDataFim}
                onChange={(e) => setFilterDataFim(e.target.value)}
                className="bg-white h-8 text-xs"
              />
            </div>
          </div>

          {/* Segunda linha: registrado por */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Registrado por</label>
              <select
                value={filterRegistradoPor}
                onChange={(e) => setFilterRegistradoPor(e.target.value)}
                className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                <option value="">Todos</option>
                {registradores.map((name: string) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <div className="md:col-span-4 flex items-end">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{filteredExpenses.length}</span> resultado{filteredExpenses.length !== 1 ? "s" : ""}
                  {filteredExpenses.length > 0 && (
                    <span className="text-slate-400">
                      — Total: <span className="font-semibold text-orange-700">{formatCurrency(filteredTotal)}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-orange-50/50 border border-orange-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-orange-800">{editingId ? "Editar Despesa" : "Nova Despesa"}</span>
            {editingId && (
              <Button type="button" variant="outline" size="sm" onClick={resetExpenseForm} className="text-xs">
                <X className="w-3 h-3 mr-1" /> Cancelar edição
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Descrição do gasto *</label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: 1 pó de café, material de escritório..."
                className="bg-white"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Data da compra *</label>
              <Input
                type="date"
                value={dataCompra}
                onChange={(e) => setDataCompra(e.target.value)}
                className="bg-white"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Valor total (R$) *</label>
              <Input
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                placeholder="0,00"
                className="bg-white"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Forma de pagamento *</label>
              <div className="flex gap-2">
                {(["pix", "boleto", "cartao_credito"] as const).map((fp) => {
                  const info = FORMA_PAGAMENTO_LABELS[fp];
                  return (
                    <button
                      key={fp}
                      type="button"
                      onClick={() => setFormaPagamento(fp)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                        formaPagamento === fp
                          ? `${info.color} border-current ring-2 ring-current/20`
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {info.icon}
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {(formaPagamento === "cartao_credito" || formaPagamento === "boleto") && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Parcelas</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={48}
                    value={parcelas}
                    onChange={(e) => setParcelas(parseInt(e.target.value) || 1)}
                    className="bg-white w-20"
                  />
                  <span className="text-xs text-slate-500">
                    {parcelas === 1 ? "à vista" : `${parcelas}x`}
                    {parcelas > 1 && valorTotal && ` de ${formatCurrency(parseFloat(valorTotal.replace(",", ".")) / parcelas)}`}
                  </span>
                </div>
              </div>
            )}
            {/* Cartão selector - only when cartao_credito is selected */}
            {formaPagamento === "cartao_credito" && activeCards.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Cartão utilizado</label>
                <select
                  value={cartaoId || ""}
                  onChange={(e) => setCartaoId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200"
                >
                  <option value="">Selecione o cartão...</option>
                  {activeCards.map((card: any) => (
                    <option key={card.id} value={card.id}>
                      {card.nome} ({card.bandeira}) •••• {card.ultimos4}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Recorrente toggle */}
            <div className="flex items-center gap-3 py-2">
              <Switch
                checked={recorrente}
                onCheckedChange={setRecorrente}
                id="recorrente"
              />
              <label htmlFor="recorrente" className="text-xs font-semibold text-slate-600 cursor-pointer">
                Despesa recorrente
              </label>
              {recorrente && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Recorrente
                </Badge>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Observação (opcional)</label>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Detalhes adicionais..."
                className="bg-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editingId && (
              <Button type="button" variant="outline" onClick={resetExpenseForm}>
                Cancelar
              </Button>
            )}
            <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={addMutation.isPending || updateMutation.isPending}>
              {(addMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : editingId ? <Check className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              {editingId ? "Salvar Alterações" : "Registrar Despesa"}
            </Button>
          </div>
          {addMutation.data && !addMutation.data.success && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {addMutation.data.error}
            </p>
          )}
          {updateMutation.data && !updateMutation.data.success && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {updateMutation.data.error}
            </p>
          )}
        </form>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleExportPdf}
              size="sm"
              variant="outline"
              disabled={filteredExpenses.length === 0}
              className="gap-1.5 border-slate-300 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="w-3.5 h-3.5" />
              Exportar PDF
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {filteredExpenses.length === 0
              ? "Nenhuma despesa para exportar"
              : hasActiveFilters
                ? `Exportar ${filteredExpenses.length} itens filtrados (${formatCurrency(filteredTotal)})`
                : `Exportar todas as ${allExpenses.length} despesas`}
          </TooltipContent>
        </Tooltip>
        <Button
          onClick={() => setShowFilters(!showFilters)}
          size="sm"
          variant="outline"
          className={`gap-1.5 ${hasActiveFilters ? "border-orange-300 bg-orange-50 text-orange-700" : ""}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros
          {hasActiveFilters && (
            <Badge className="bg-orange-600 text-white text-[9px] px-1.5 py-0 ml-1">
              {[filterDescricao, filterFormaPagamento, filterDataInicio, filterDataFim, filterRegistradoPor].filter(Boolean).length}
            </Badge>
          )}
        </Button>
        <Button
          onClick={() => {
            if (showForm) {
              resetExpenseForm();
            } else {
              setEditingId(null);
              setShowForm(true);
            }
          }}
          size="sm"
          className={showForm && !editingId ? "bg-slate-500 hover:bg-slate-600" : "bg-orange-600 hover:bg-orange-700"}
        >
          {showForm && !editingId ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showForm && !editingId ? "Cancelar" : "Nova Despesa"}
        </Button>
      </div>

      {/* Expenses List */}
      {filteredExpenses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          {hasActiveFilters ? (
            <>
              <p className="text-sm text-slate-500">Nenhuma despesa encontrada com os filtros aplicados</p>
              <button
                onClick={clearFilters}
                className="text-xs text-orange-600 hover:text-orange-800 font-medium mt-2 cursor-pointer"
              >
                Limpar filtros
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500">Nenhuma despesa registrada ainda</p>
              <p className="text-xs text-slate-400 mt-1">Clique em "Nova Despesa" para começar</p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pagamento</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Cartão</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Registrado por</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((exp: any) => {
                const info = FORMA_PAGAMENTO_LABELS[exp.formaPagamento] || { label: exp.formaPagamento, icon: null, color: "" };
                const canDelete = operator?.name === exp.registradoPor || operator?.name === "Guilherme";
                const canEdit = operator?.name === exp.registradoPor || operator?.name === "Guilherme";
                return (
                  <tr key={exp.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs font-medium">
                      {formatDate(exp.dataCompra)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800 font-medium text-xs">{exp.descricao}</p>
                      {exp.observacao && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{exp.observacao}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge className={`${info.color} text-[10px] gap-1`}>
                          {info.icon}
                          {info.label}
                          {exp.formaPagamento === "cartao_credito" && exp.parcelas > 1 && (
                            <span className="ml-0.5">{exp.parcelas}x</span>
                          )}
                        </Badge>
                        {exp.recorrente === 1 && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] gap-0.5">
                            <RefreshCw className="w-2.5 h-2.5" />
                            Recorrente
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {exp.cartaoId ? (() => {
                        const card = creditCards.find((c: any) => c.id === exp.cartaoId);
                        return card ? (
                          <span className="text-[10px] text-slate-600">
                            <CreditCard className="w-3 h-3 inline mr-1" />
                            {card.nome} ••••{card.ultimos4}
                          </span>
                        ) : <span className="text-[10px] text-slate-400">—</span>;
                      })() : <span className="text-[10px] text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap text-xs">
                      {formatCurrency(Number(exp.valorTotal))}
                      {exp.formaPagamento === "cartao_credito" && exp.parcelas > 1 && (
                        <p className="text-[10px] text-slate-400 font-normal">
                          {exp.parcelas}x de {formatCurrency(Number(exp.valorTotal) / exp.parcelas)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-slate-500">{exp.registradoPor}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {canEdit && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => startEditExpense(exp)}
                                className="text-slate-300 hover:text-orange-500 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Editar despesa</TooltipContent>
                          </Tooltip>
                        )}
                        {canDelete && (
                          deleteConfirm === exp.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteMutation.mutate({ operatorName, id: exp.id })}
                                className="text-red-600 hover:text-red-800 text-[10px] font-bold cursor-pointer"
                              >
                                Sim
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setDeleteConfirm(exp.id)}
                                  className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Excluir despesa</TooltipContent>
                            </Tooltip>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Footer com total filtrado */}
            {hasActiveFilters && filteredExpenses.length > 0 && (
              <tfoot>
                <tr className="bg-orange-50/50 border-t border-orange-200">
                  <td colSpan={4} className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total filtrado ({filteredExpenses.length} itens)
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-orange-700 text-sm">
                    {formatCurrency(filteredTotal)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {/* Card Manager Section */}
      <div className="mt-6">
        <button
          onClick={() => setShowCardManager(!showCardManager)}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          Gerenciar Cartões de Crédito
          {showCardManager ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">{creditCards.length}</Badge>
        </button>

        {showCardManager && (
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Cartões Cadastrados</span>
              </div>
              <Button
                size="sm"
                onClick={() => { setShowCardForm(true); setEditingCardId(null); setCardNome(""); setCardBandeira(""); setCardUltimos4(""); setCardTitular(""); }}
                className="bg-slate-700 hover:bg-slate-800 gap-1 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Cartão
              </Button>
            </div>

            {/* Card form */}
            {showCardForm && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Nome do cartão *</label>
                    <Input
                      value={cardNome}
                      onChange={(e) => setCardNome(e.target.value)}
                      placeholder="Ex: Nubank PJ"
                      className="bg-white h-8 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Bandeira *</label>
                    <select
                      value={cardBandeira}
                      onChange={(e) => setCardBandeira(e.target.value)}
                      className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="">Selecione...</option>
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="Elo">Elo</option>
                      <option value="Amex">Amex</option>
                      <option value="Hipercard">Hipercard</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Últimos 4 dígitos *</label>
                    <Input
                      value={cardUltimos4}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setCardUltimos4(v);
                      }}
                      placeholder="1234"
                      className="bg-white h-8 text-xs"
                      maxLength={4}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Titular *</label>
                    <Input
                      value={cardTitular}
                      onChange={(e) => setCardTitular(e.target.value)}
                      placeholder="Nome do titular"
                      className="bg-white h-8 text-xs"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setShowCardForm(false); setEditingCardId(null); }} className="text-xs">
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-slate-700 hover:bg-slate-800 text-xs"
                    disabled={!cardNome.trim() || !cardBandeira || cardUltimos4.length !== 4 || !cardTitular.trim() || addCardMutation.isPending || updateCardMutation.isPending}
                    onClick={() => {
                      if (editingCardId) {
                        updateCardMutation.mutate({
                          operatorName,
                          id: editingCardId,
                          nome: cardNome.trim(),
                          bandeira: cardBandeira,
                          ultimos4: cardUltimos4,
                          titular: cardTitular.trim(),
                          ativo: true,
                        });
                      } else {
                        addCardMutation.mutate({
                          operatorName,
                          nome: cardNome.trim(),
                          bandeira: cardBandeira,
                          ultimos4: cardUltimos4,
                          titular: cardTitular.trim(),
                        });
                      }
                    }}
                  >
                    {(addCardMutation.isPending || updateCardMutation.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                    {editingCardId ? "Atualizar" : "Cadastrar"}
                  </Button>
                </div>
              </div>
            )}

            {/* Cards list */}
            {creditCards.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Nenhum cartão cadastrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {creditCards.map((card: any) => (
                  <div key={card.id} className={`bg-white rounded-lg border p-3 ${card.ativo === 1 ? 'border-slate-200' : 'border-red-200 opacity-60'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-sm font-semibold text-slate-700">{card.nome}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{card.bandeira} •••• {card.ultimos4}</p>
                        <p className="text-[10px] text-slate-400">Titular: {card.titular}</p>
                        {card.ativo !== 1 && (
                          <Badge className="bg-red-100 text-red-600 border-red-200 text-[9px] mt-1">Inativo</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingCardId(card.id);
                            setCardNome(card.nome);
                            setCardBandeira(card.bandeira);
                            setCardUltimos4(card.ultimos4);
                            setCardTitular(card.titular);
                            setShowCardForm(true);
                          }}
                          className="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer p-1"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Excluir cartão "${card.nome}"?`)) {
                              deleteCardMutation.mutate({ operatorName, id: card.id });
                            }
                          }}
                          className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {deleteCardMutation.data && !deleteCardMutation.data.success && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {deleteCardMutation.data.error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Separator between Despesas and Estornos */}
      <div className="my-10">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />
      </div>

      {/* Refunds Section */}
      <RefundsSection />

      {/* Separator before Depósito */}
      {operatorName === "Guilherme" && (
        <>
          <div className="my-10">
            <div className="h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
          </div>
          <DepotSection operatorName={operatorName} />
        </>
      )}
    </div>
  );
}

/* ─── Depósito da Matriz - Perdões ─── */
function DepotSection({ operatorName }: { operatorName: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, refetch } = trpc.ecommerce.getDepotInventory.useQuery(
    { operatorName },
    { enabled: !!operatorName && operatorName === "Guilherme" }
  );

  const items = data?.items || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-4">
      {/* Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl px-5 py-4 shadow-md transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <Warehouse className="w-6 h-6" />
          <div className="text-left">
            <p className="font-bold text-base">Depósito da Matriz - Perdões</p>
            <p className="text-emerald-100 text-xs">{items.length} produtos · Total: {total.toLocaleString("pt-BR")} caixas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">{total.toLocaleString("pt-BR")}</span>
          <span className="text-xs text-emerald-200">cx</span>
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-emerald-50 border-b border-emerald-100">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">#</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Produto</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Qtd (cx)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, idx: number) => (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{idx + 1}</td>
                      <td className="px-4 py-2.5 text-slate-700 font-medium">{item.productName}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-800">{item.quantityCx.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                    <td colSpan={2} className="px-4 py-3 font-bold text-emerald-800 text-sm">TOTAL</td>
                    <td className="px-4 py-3 text-right font-extrabold text-emerald-800 text-lg">{total.toLocaleString("pt-BR")} cx</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Relatório de Vendas do E-commerce ─── */
const SALES_MONTHS = [
  { value: "all", label: "Todos" },
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

function SalesReportSection({ operatorName }: { operatorName: string }) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  });
  const [formSales, setFormSales] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const isPedro = operatorName === "Pedro";

  const queryMonth = selectedMonth === "all" ? undefined : Number(selectedMonth);
  const queryYear = selectedMonth === "all" ? undefined : selectedYear;

  const { data, isLoading, refetch } = trpc.ecommerce.listDailySales.useQuery(
    { operatorName, month: queryMonth, year: queryYear },
    { enabled: !!operatorName, refetchInterval: 30000 }
  );

  const addMutation = trpc.ecommerce.addDailySale.useMutation({
    onSuccess: () => { resetForm(); refetch(); },
  });
  const updateMutation = trpc.ecommerce.updateDailySale.useMutation({
    onSuccess: () => { resetForm(); refetch(); },
  });
  const deleteMutation = trpc.ecommerce.deleteDailySale.useMutation({
    onSuccess: () => { setDeleteConfirm(null); refetch(); },
  });

  const entries = data?.entries || [];
  const summary = data?.summary || { totalEntries: 0, totalSales: 0, totalValue: 0, avgDailyValue: 0, avgSalesPerDay: 0 };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormDate(() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    });
    setFormSales("");
    setFormValue("");
    setFormNotes("");
  };

  const handleSubmit = () => {
    const salesNum = parseInt(formSales, 10);
    const valueNum = parseFloat(formValue.replace(",", "."));
    if (isNaN(salesNum) || isNaN(valueNum) || salesNum < 0 || valueNum < 0) return;
    if (!formDate) return;

    if (editingId) {
      updateMutation.mutate({
        operatorName,
        id: editingId,
        numberOfSales: salesNum,
        totalValue: valueNum,
        notes: formNotes.trim() || undefined,
      });
    } else {
      addMutation.mutate({
        operatorName,
        saleDate: formDate,
        numberOfSales: salesNum,
        totalValue: valueNum,
        notes: formNotes.trim() || undefined,
      });
    }
  };

  const startEdit = (entry: any) => {
    setEditingId(entry.id);
    // saleDate can be a Date object or string
    const d = entry.saleDate instanceof Date ? entry.saleDate : new Date(entry.saleDate);
    setFormDate(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`);
    setFormSales(String(entry.numberOfSales));
    setFormValue(String(Number(entry.totalValue)));
    setFormNotes(entry.notes || "");
    setShowForm(true);
  };

  const formatEntryDate = (d: any) => {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  };

  const formatEntryWeekday = (d: any) => {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" });
  };

  const fmtCurrency = (v: number | string) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const periodLabel = useMemo(() => {
    if (selectedMonth === "all") return "Todos";
    const m = SALES_MONTHS.find(m => m.value === selectedMonth);
    return `${m?.label || ""} ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  const handleExportPdf = async () => {
    await generateSalesReportPdf(
      entries.map((e: any) => ({
        id: e.id,
        saleDate: e.saleDate,
        numberOfSales: e.numberOfSales,
        totalValue: e.totalValue,
        notes: e.notes,
        createdBy: e.createdBy,
      })),
      summary,
      periodLabel,
    );
  };

  // Year options: 2024 to current year + 1
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = 2024; y <= now.getFullYear() + 1; y++) years.push(y);
    return years;
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-800">Relatório de Vendas do E-commerce</h3>
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
            {summary.totalEntries} registros
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month filter */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {SALES_MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {/* Year filter */}
          {selectedMonth !== "all" && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}

          {/* Export PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={entries.length === 0}
            className="h-8 text-xs gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" />
            PDF
          </Button>

          {/* Add button - Pedro only */}
          {isPedro && (
            <Button
              size="sm"
              onClick={() => { resetForm(); setShowForm(true); }}
              className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Dias Registrados</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{summary.totalEntries}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Vendas</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{summary.totalSales.toLocaleString("pt-BR")}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Faturamento Total</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{fmtCurrency(summary.totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Média Diária (R$)</p>
          <p className="text-xl font-bold text-slate-700 mt-1">{fmtCurrency(summary.avgDailyValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm col-span-2 md:col-span-1">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Média Vendas/Dia</p>
          <p className="text-xl font-bold text-slate-700 mt-1">{summary.avgSalesPerDay.toFixed(1)}</p>
        </div>
      </div>

      {/* Add/Edit Form - Pedro only */}
      {showForm && isPedro && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-blue-800">
              {editingId ? "Editar Registro" : "Novo Registro de Vendas"}
            </h4>
            <button onClick={resetForm} className="text-blue-400 hover:text-blue-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-medium text-blue-700 mb-1 block">Data</label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="h-9 text-sm bg-white"
                disabled={!!editingId}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-blue-700 mb-1 block">Nº de Vendas</label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={formSales}
                onChange={(e) => setFormSales(e.target.value)}
                className="h-9 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-blue-700 mb-1 block">Valor Total (R$)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0,00"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                className="h-9 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-blue-700 mb-1 block">Observações</label>
              <Input
                type="text"
                placeholder="(opcional)"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="h-9 text-sm bg-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={resetForm} className="text-xs">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={addMutation.isPending || updateMutation.isPending || !formDate || !formSales || !formValue}
              className="text-xs bg-blue-600 hover:bg-blue-700 gap-1.5"
            >
              {(addMutation.isPending || updateMutation.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingId ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
          <p className="text-xs text-slate-400">Carregando registros...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <BarChart3 className="w-10 h-10 mb-2 opacity-40" />
          <p className="text-sm">Nenhum registro de vendas encontrado</p>
          <p className="text-xs mt-1">
            {isPedro ? "Clique em \"Adicionar\" para registrar vendas do dia." : "Aguardando registros."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50 border-b border-blue-100">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Data</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Nº Vendas</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Valor Total</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-blue-700 uppercase tracking-wider hidden md:table-cell">Obs.</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-blue-700 uppercase tracking-wider hidden md:table-cell">Registrado por</th>
                  {isPedro && (
                    <th className="text-center px-3 py-3 text-[11px] font-semibold text-blue-700 uppercase tracking-wider w-20">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: any, idx: number) => (
                  <tr key={entry.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-700">{formatEntryDate(entry.saleDate)}</span>
                      <span className="text-[10px] text-slate-400 ml-1.5 capitalize">{formatEntryWeekday(entry.saleDate)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-blue-700">{entry.numberOfSales.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-700">{fmtCurrency(entry.totalValue)}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs hidden md:table-cell max-w-[200px] truncate">{entry.notes || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs hidden md:table-cell">{entry.createdBy}</td>
                    {isPedro && (
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => startEdit(entry)}
                                className="p-1.5 rounded-md hover:bg-blue-100 text-blue-500 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                          {deleteConfirm === entry.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteMutation.mutate({ operatorName, id: entry.id })}
                                className="p-1.5 rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setDeleteConfirm(entry.id)}
                                  className="p-1.5 rounded-md hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Excluir</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td className="px-4 py-3 font-bold text-blue-800 text-sm">TOTAL</td>
                  <td className="px-4 py-3 text-center font-extrabold text-blue-800">{summary.totalSales.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-right font-extrabold text-emerald-800">{fmtCurrency(summary.totalValue)}</td>
                  <td className="hidden md:table-cell" colSpan={isPedro ? 3 : 2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
