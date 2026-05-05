/**
 * E-commerce Tab - Despesas e Estornos da operação e-commerce (contas a pagar filial)
 * Acesso restrito: Pedro, Flavio, Guilherme
 */
import React, { useState, useMemo } from "react";
import RefundsSection from "@/components/RefundsSection";
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
} from "lucide-react";
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
  const tableData = expenses.map((exp: any) => [
    formatDate(exp.dataCompra),
    exp.descricao,
    FORMA_PAGAMENTO_PDF_LABELS[exp.formaPagamento] || exp.formaPagamento,
    exp.formaPagamento === "cartao_credito" && exp.parcelas > 1 ? `${exp.parcelas}x` : "1x",
    formatCurrency(Number(exp.valorTotal)),
    exp.registradoPor,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Data", "Descrição", "Pagamento", "Parcelas", "Valor", "Registrado por"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 62 },
      2: { cellWidth: 30, halign: "center" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      5: { cellWidth: 22, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 2) {
        const val = data.cell.raw;
        if (val === "PIX") {
          data.cell.styles.textColor = [21, 128, 61]; // green-700
          data.cell.styles.fontStyle = "bold";
        } else if (val === "Boleto") {
          data.cell.styles.textColor = [29, 78, 216]; // blue-700
          data.cell.styles.fontStyle = "bold";
        } else if (val === "Cartão de Crédito") {
          data.cell.styles.textColor = [126, 34, 206]; // purple-700
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

  const addMutation = trpc.ecommerce.addExpense.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setShowForm(false);
        setDescricao("");
        setValorTotal("");
        setObservacao("");
        setParcelas(1);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseFloat(valorTotal.replace(",", "."));
    if (!descricao.trim() || isNaN(valor) || valor <= 0) return;
    addMutation.mutate({
      operatorName,
      descricao: descricao.trim(),
      dataCompra,
      formaPagamento,
      parcelas: (formaPagamento === "cartao_credito" || formaPagamento === "boleto") ? parcelas : 1,
      valorTotal: valor,
      observacao: observacao.trim() || undefined,
    });
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

  return (
    <div className="space-y-5 mt-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-semibold text-slate-800">Despesas E-commerce</h3>
          <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">
            {hasActiveFilters ? `${filteredExpenses.length}/${allExpenses.length}` : allExpenses.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Exportar PDF */}
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
            onClick={() => setShowForm(!showForm)}
            size="sm"
            className={showForm ? "bg-slate-500 hover:bg-slate-600" : "bg-orange-600 hover:bg-orange-700"}
          >
            {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {showForm ? "Cancelar" : "Nova Despesa"}
          </Button>
        </div>
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
            <div className={(formaPagamento === "cartao_credito" || formaPagamento === "boleto") ? "md:col-span-2" : ""}>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Observação (opcional)</label>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Detalhes adicionais..."
                className="bg-white"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Registrar Despesa
            </Button>
          </div>
          {addMutation.data && !addMutation.data.success && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {addMutation.data.error}
            </p>
          )}
        </form>
      )}

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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pagamento</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Registrado por</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((exp: any) => {
                const info = FORMA_PAGAMENTO_LABELS[exp.formaPagamento] || { label: exp.formaPagamento, icon: null, color: "" };
                const canDelete = operator?.name === exp.registradoPor || operator?.name === "Guilherme";
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
                      <Badge className={`${info.color} text-[10px] gap-1`}>
                        {info.icon}
                        {info.label}
                        {exp.formaPagamento === "cartao_credito" && exp.parcelas > 1 && (
                          <span className="ml-0.5">{exp.parcelas}x</span>
                        )}
                      </Badge>
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Footer com total filtrado */}
            {hasActiveFilters && filteredExpenses.length > 0 && (
              <tfoot>
                <tr className="bg-orange-50/50 border-t border-orange-200">
                  <td colSpan={3} className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
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
      {/* Separator between Despesas and Estornos */}
      <div className="my-10">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />
      </div>

      {/* Refunds Section */}
      <RefundsSection />
    </div>
  );
}
