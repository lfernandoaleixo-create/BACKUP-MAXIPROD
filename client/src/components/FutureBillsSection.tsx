/**
 * Previsão de Contas Futuras - E-commerce
 * Card com mesmas funcionalidades de Despesas (formulário, tabela, filtros, PDF, clips)
 */
import React, { useState, useMemo, useRef } from "react";
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
  Plus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  Calendar,
  DollarSign,
  Loader2,
  X,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  FileDown,
  Pencil,
  Paperclip,
  FileText,
  Image,
  Download,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const FORMA_PAGAMENTO_INFO: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pix: { label: "PIX", icon: <QrCode className="w-3.5 h-3.5" />, color: "bg-green-100 text-green-700 border-green-200" },
  boleto: { label: "Boleto", icon: <Banknote className="w-3.5 h-3.5" />, color: "bg-blue-100 text-blue-700 border-blue-200" },
  cartao_credito: { label: "Cartão de Crédito", icon: <CreditCard className="w-3.5 h-3.5" />, color: "bg-purple-100 text-purple-700 border-purple-200" },
};

const STATUS_INFO: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pendente: { label: "Pendente", icon: <Clock className="w-3.5 h-3.5" />, color: "bg-amber-100 text-amber-700 border-amber-200" },
  pago: { label: "Pago", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "bg-green-100 text-green-700 border-green-200" },
  cancelado: { label: "Cancelado", icon: <XCircle className="w-3.5 h-3.5" />, color: "bg-red-100 text-red-700 border-red-200" },
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image className="w-4 h-4 text-purple-500 flex-shrink-0" />;
  if (mimeType === "application/pdf") return <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />;
  return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
}

const FORMA_PAGAMENTO_PDF_LABELS: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao_credito: "Cartão de Crédito",
};

function generateFutureBillsPdf(
  bills: any[],
  filters: { descricao: string; formaPagamento: string; dataInicio: string; dataFim: string; status: string },
  total: number,
  creditCards: any[] = [],
  attachmentCounts: Record<number, number> = {},
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 36, "F");
  doc.setFillColor(234, 88, 12);
  doc.rect(0, 36, pageW, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("GRUPO FOX", 14, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Previsão de Contas Futuras — E-commerce", 14, 22);
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 30);

  let y = 44;
  const activeFilters: string[] = [];
  if (filters.descricao) activeFilters.push(`Descrição: "${filters.descricao}"`);
  if (filters.formaPagamento) activeFilters.push(`Pagamento: ${FORMA_PAGAMENTO_PDF_LABELS[filters.formaPagamento] || filters.formaPagamento}`);
  if (filters.dataInicio) activeFilters.push(`De: ${formatDate(filters.dataInicio)}`);
  if (filters.dataFim) activeFilters.push(`Até: ${formatDate(filters.dataFim)}`);
  if (filters.status) activeFilters.push(`Status: ${filters.status}`);

  if (activeFilters.length > 0) {
    doc.setFillColor(255, 247, 237);
    doc.roundedRect(14, y, pageW - 28, 14, 2, 2, "F");
    doc.setDrawColor(251, 191, 36);
    doc.roundedRect(14, y, pageW - 28, 14, 2, 2, "S");
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("FILTROS APLICADOS:", 18, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text(activeFilters.join("  •  "), 18, y + 10);
    y += 20;
  } else {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text("Sem filtros aplicados — exibindo todas as contas", 14, y);
    y += 8;
  }

  const boxW = 52;
  const gap = 6;
  const boxH = 18;

  doc.setFillColor(234, 88, 12);
  doc.roundedRect(14, y, boxW, boxH, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("TOTAL", 18, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(total), 18, y + 14);

  doc.setFillColor(71, 85, 105);
  doc.roundedRect(14 + boxW + gap, y, boxW, boxH, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("LANÇAMENTOS", 18 + boxW + gap, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(bills.length), 18 + boxW + gap, y + 14);

  y += boxH + 8;

  const getCardName = (cardId: number | null) => {
    if (!cardId) return "—";
    const card = creditCards.find((c: any) => c.id === cardId);
    return card ? `${card.nome} (${card.bandeira} ••${card.ultimos4})` : "—";
  };

  const tableData = bills.map((bill: any) => [
    formatDate(bill.dataVencimento),
    bill.descricao,
    FORMA_PAGAMENTO_PDF_LABELS[bill.formaPagamento] || bill.formaPagamento,
    bill.parcelas > 1 ? `${bill.parcelas}x` : "1x",
    formatCurrency(Number(bill.valorTotal)),
    bill.formaPagamento === "cartao_credito" ? getCardName(bill.cartaoId) : "—",
    bill.status === "pendente" ? "Pendente" : bill.status === "pago" ? "Pago" : "Cancelado",
    bill.registradoPor,
    attachmentCounts[bill.id] ? `${attachmentCounts[bill.id]} doc(s)` : "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Vencimento", "Descrição", "Pagamento", "Parc.", "Valor", "Cartão", "Status", "Por", "Anexos"]],
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
      0: { cellWidth: 16 },
      1: { cellWidth: 36 },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 10, halign: "center" },
      4: { cellWidth: 22, halign: "right", fontStyle: "bold" },
      5: { cellWidth: 28 },
      6: { cellWidth: 16, halign: "center" },
      7: { cellWidth: 16, halign: "center" },
      8: { cellWidth: 14, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 6) {
        const val = data.cell.raw;
        if (val === "Pendente") {
          data.cell.styles.textColor = [161, 98, 7];
          data.cell.styles.fontStyle = "bold";
        } else if (val === "Pago") {
          data.cell.styles.textColor = [21, 128, 61];
          data.cell.styles.fontStyle = "bold";
        } else if (val === "Cancelado") {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, finalY + 6, pageW - 14, finalY + 6);
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.text("Grupo Fox — Previsão de Contas Futuras E-commerce", 14, finalY + 12);
  doc.text("Documento gerado automaticamente", pageW - 14 - doc.getTextWidth("Documento gerado automaticamente"), finalY + 12);

  const parts = ["Contas_Futuras_Ecommerce"];
  if (filters.dataInicio || filters.dataFim) {
    if (filters.dataInicio) parts.push(filters.dataInicio.replace(/-/g, ""));
    parts.push("a");
    if (filters.dataFim) parts.push(filters.dataFim.replace(/-/g, ""));
  }
  const fileName = `${parts.join("_")}.pdf`;
  doc.save(fileName);
}

export default function FutureBillsSection() {
  const { operator } = useOperator();
  const operatorName = operator?.name || "";

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [formaPagamento, setFormaPagamento] = useState<"pix" | "boleto" | "cartao_credito">("pix");
  const [parcelas, setParcelas] = useState(1);
  const [valorTotal, setValorTotal] = useState("");
  const [observacao, setObservacao] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [cartaoId, setCartaoId] = useState<number | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterDescricao, setFilterDescricao] = useState("");
  const [filterFormaPagamento, setFilterFormaPagamento] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Attachment state
  const [attachmentBillId, setAttachmentBillId] = useState<number | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: billsData, isLoading, refetch: refetchBills } = trpc.ecommerce.listFutureBills.useQuery({ operatorName });
  const { data: summaryData } = trpc.ecommerce.getFutureBillsSummary.useQuery({ operatorName });
  const { data: cardsData } = trpc.ecommerce.listCreditCards.useQuery({ operatorName });
  const { data: attachCountsData } = trpc.ecommerce.getFutureBillAttachmentCounts.useQuery({ operatorName });
  const { data: attachmentsData, refetch: refetchAttachments } = trpc.ecommerce.listFutureBillAttachments.useQuery(
    { operatorName, billId: attachmentBillId! },
    { enabled: !!attachmentBillId }
  );

  // Mutations
  const addBillMutation = trpc.ecommerce.addFutureBill.useMutation({ onSuccess: () => { refetchBills(); resetForm(); } });
  const updateBillMutation = trpc.ecommerce.updateFutureBill.useMutation({ onSuccess: () => { refetchBills(); resetForm(); } });
  const deleteBillMutation = trpc.ecommerce.deleteFutureBill.useMutation({ onSuccess: () => refetchBills() });
  const uploadAttachmentMutation = trpc.ecommerce.uploadFutureBillAttachment.useMutation({ onSuccess: () => refetchAttachments() });
  const deleteAttachmentMutation = trpc.ecommerce.deleteFutureBillAttachment.useMutation({ onSuccess: () => refetchAttachments() });

  const bills = billsData?.bills || [];
  const creditCards = cardsData?.cards || [];
  const attachmentCounts: Record<number, number> = attachCountsData?.counts || {};
  const currentAttachments = attachmentsData?.attachments || [];
  const summary = summaryData?.summary;

  const filteredBills = useMemo(() => {
    return bills.filter((bill: any) => {
      if (filterDescricao && !bill.descricao.toLowerCase().includes(filterDescricao.toLowerCase())) return false;
      if (filterFormaPagamento && bill.formaPagamento !== filterFormaPagamento) return false;
      if (filterDataInicio && bill.dataVencimento < filterDataInicio) return false;
      if (filterDataFim && bill.dataVencimento > filterDataFim) return false;
      if (filterStatus && bill.status !== filterStatus) return false;
      return true;
    });
  }, [bills, filterDescricao, filterFormaPagamento, filterDataInicio, filterDataFim, filterStatus]);

  const filteredTotal = useMemo(() => {
    return filteredBills.reduce((acc: number, bill: any) => acc + Number(bill.valorTotal), 0);
  }, [filteredBills]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setDescricao("");
    const now = new Date();
    setDataVencimento(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
    setFormaPagamento("pix");
    setParcelas(1);
    setValorTotal("");
    setObservacao("");
    setRecorrente(false);
    setCartaoId(null);
  };

  const handleSubmit = () => {
    const valor = parseFloat(valorTotal.replace(",", "."));
    if (!descricao.trim() || isNaN(valor) || valor <= 0) return;

    if (editingId) {
      updateBillMutation.mutate({
        operatorName,
        id: editingId,
        descricao,
        dataVencimento,
        formaPagamento,
        parcelas,
        valorTotal: valor,
        observacao: observacao || undefined,
        recorrente,
        cartaoId: formaPagamento === "cartao_credito" ? cartaoId : null,
      });
    } else {
      addBillMutation.mutate({
        operatorName,
        descricao,
        dataVencimento,
        formaPagamento,
        parcelas,
        valorTotal: valor,
        observacao: observacao || undefined,
        recorrente,
        cartaoId: formaPagamento === "cartao_credito" ? cartaoId : null,
      });
    }
  };

  const startEdit = (bill: any) => {
    setEditingId(bill.id);
    setDescricao(bill.descricao);
    setDataVencimento(bill.dataVencimento);
    setFormaPagamento(bill.formaPagamento);
    setParcelas(bill.parcelas);
    setValorTotal(String(bill.valorTotal));
    setObservacao(bill.observacao || "");
    setRecorrente(bill.recorrente === 1);
    setCartaoId(bill.cartaoId || null);
    setShowForm(true);
  };

  const handleMarkAsPaid = (bill: any) => {
    if (confirm(`Marcar "${bill.descricao}" como PAGO?`)) {
      updateBillMutation.mutate({
        operatorName,
        id: bill.id,
        descricao: bill.descricao,
        dataVencimento: bill.dataVencimento,
        formaPagamento: bill.formaPagamento,
        parcelas: bill.parcelas,
        valorTotal: Number(bill.valorTotal),
        observacao: bill.observacao || undefined,
        recorrente: bill.recorrente === 1,
        cartaoId: bill.cartaoId,
        status: "pago",
      });
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !attachmentBillId) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      alert("Arquivo muito grande (máx. 10MB)");
      return;
    }
    setUploadingAttachment(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(Array.from(new Uint8Array(buffer), (b) => String.fromCharCode(b)).join(""));
      uploadAttachmentMutation.mutate({
        operatorName,
        billId: attachmentBillId,
        fileName: file.name,
        fileData: base64,
        mimeType: file.type,
        fileSize: file.size,
      });
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExportPdf = () => {
    generateFutureBillsPdf(
      filteredBills,
      {
        descricao: filterDescricao,
        formaPagamento: filterFormaPagamento,
        dataInicio: filterDataInicio,
        dataFim: filterDataFim,
        status: filterStatus,
      },
      filteredTotal,
      creditCards,
      attachmentCounts,
    );
  };

  const clearFilters = () => {
    setFilterDescricao("");
    setFilterFormaPagamento("");
    setFilterDataInicio("");
    setFilterDataFim("");
    setFilterStatus("");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500 mb-2" />
        <p className="text-sm text-slate-500">Carregando contas futuras...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Previsão de Contas Futuras</h2>
            <p className="text-xs text-slate-500">Contas a pagar no futuro</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500 uppercase">Total Pendente</span>
              <DollarSign className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(summary.totalPendente)}</p>
            <p className="text-[10px] text-slate-400">{summary.totalCount} lançamentos</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500 uppercase">Mês Atual</span>
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(summary.mesAtual.total)}</p>
            <p className="text-[10px] text-slate-400">{summary.mesAtual.count} lançamentos</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500 uppercase">Total Listado</span>
              <FileDown className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(filteredTotal)}</p>
            <p className="text-[10px] text-slate-400">{filteredBills.length} na lista</p>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button
          size="sm"
          onClick={handleExportPdf}
          variant="outline"
          className="text-xs gap-1.5"
        >
          <FileDown className="w-3.5 h-3.5" />
          Exportar PDF
        </Button>
        <Button
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          variant="outline"
          className="text-xs gap-1.5"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros
        </Button>
        <div className="ml-auto">
          <Button
            size="sm"
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Conta
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">Descrição</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  value={filterDescricao}
                  onChange={(e) => setFilterDescricao(e.target.value)}
                  className="pl-8 h-8 text-xs"
                  placeholder="Buscar..."
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">Pagamento</label>
              <select
                value={filterFormaPagamento}
                onChange={(e) => setFilterFormaPagamento(e.target.value)}
                className="w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white"
              >
                <option value="">Todos</option>
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="cartao_credito">Cartão de Crédito</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">De</label>
              <Input type="date" value={filterDataInicio} onChange={(e) => setFilterDataInicio(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">Até</label>
              <Input type="date" value={filterDataFim} onChange={(e) => setFilterDataFim(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white"
              >
                <option value="">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={clearFilters} className="text-xs text-slate-500">
              Limpar filtros
            </Button>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">
              {editingId ? "Editar Conta" : "Nova Conta Futura"}
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">Descrição *</label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Mensalidade plataforma X" className="text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">Data de Vencimento *</label>
              <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">Forma de Pagamento *</label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value as any)}
                className="w-full h-9 text-sm border border-slate-200 rounded-md px-3 bg-white"
              >
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="cartao_credito">Cartão de Crédito</option>
              </select>
            </div>
            {formaPagamento === "cartao_credito" && (
              <>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">Parcelas</label>
                  <Input type="number" min={1} max={48} value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className="text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">Cartão</label>
                  <select
                    value={cartaoId || ""}
                    onChange={(e) => setCartaoId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full h-9 text-sm border border-slate-200 rounded-md px-3 bg-white"
                  >
                    <option value="">Selecione...</option>
                    {creditCards.map((card: any) => (
                      <option key={card.id} value={card.id}>{card.nome} ({card.bandeira} ••{card.ultimos4})</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">Valor Total (R$) *</label>
              <Input value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="0,00" className="text-sm" />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <Switch checked={recorrente} onCheckedChange={setRecorrente} />
              <span className="text-xs text-slate-600">Recorrente</span>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">Observação</label>
              <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" className="text-sm" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button
              onClick={handleSubmit}
              disabled={addBillMutation.isPending || updateBillMutation.isPending}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs gap-1.5"
            >
              {(addBillMutation.isPending || updateBillMutation.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingId ? "Salvar Alterações" : "Adicionar Conta"}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase">Vencimento</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase">Descrição</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 uppercase">Pagamento</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-500 uppercase">Valor</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 uppercase">Por</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs">
                    Nenhuma conta futura encontrada
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill: any) => {
                  const info = FORMA_PAGAMENTO_INFO[bill.formaPagamento] || FORMA_PAGAMENTO_INFO.pix;
                  const statusInfo = STATUS_INFO[bill.status] || STATUS_INFO.pendente;
                  const canEdit = bill.registradoPor === operatorName || operatorName === "Guilherme";
                  const canDelete = bill.registradoPor === operatorName || operatorName === "Guilherme";
                  return (
                    <tr key={bill.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs font-medium">
                        {formatDate(bill.dataVencimento)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <p className="text-slate-800 font-medium text-xs">{bill.descricao}</p>
                          {attachmentCounts[bill.id] && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-0.5 text-[9px] text-orange-500 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 cursor-default">
                                  <Paperclip className="w-2.5 h-2.5" />
                                  {attachmentCounts[bill.id]}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{attachmentCounts[bill.id]} anexo(s)</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {bill.observacao && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{bill.observacao}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={`${info.color} text-[10px] gap-1`}>
                          {info.icon}
                          {info.label}
                          {bill.formaPagamento === "cartao_credito" && bill.parcelas > 1 && (
                            <span className="ml-0.5">{bill.parcelas}x</span>
                          )}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={`${statusInfo.color} text-[10px] gap-1`}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-slate-800 text-xs">{formatCurrency(Number(bill.valorTotal))}</span>
                        {bill.formaPagamento === "cartao_credito" && bill.parcelas > 1 && (
                          <p className="text-[9px] text-slate-400">{bill.parcelas}x de {formatCurrency(Number(bill.valorTotal) / bill.parcelas)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-600">{bill.registradoPor}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {/* Mark as paid */}
                          {bill.status === "pendente" && canEdit && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleMarkAsPaid(bill)}
                                  className="text-slate-400 hover:text-green-600 transition-colors p-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Marcar como Pago</TooltipContent>
                            </Tooltip>
                          )}
                          {/* Clips */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => { setAttachmentBillId(bill.id); setPreviewImage(null); }}
                                className="text-slate-400 hover:text-orange-500 transition-colors p-1 cursor-pointer relative"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                {attachmentCounts[bill.id] && (
                                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-orange-500 text-white text-[7px] rounded-full flex items-center justify-center">
                                    {attachmentCounts[bill.id]}
                                  </span>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Anexos</TooltipContent>
                          </Tooltip>
                          {/* Edit */}
                          {canEdit && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => startEdit(bill)}
                                  className="text-slate-400 hover:text-blue-500 transition-colors p-1 cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                          )}
                          {/* Delete */}
                          {canDelete && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    if (confirm(`Excluir "${bill.descricao}"?`)) {
                                      deleteBillMutation.mutate({ operatorName, id: bill.id });
                                    }
                                  }}
                                  className="text-slate-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Excluir</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attachment Modal */}
      <Dialog open={!!attachmentBillId} onOpenChange={(open) => { if (!open) setAttachmentBillId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Paperclip className="w-4 h-4 text-orange-500" />
              Anexos da Conta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Upload area */}
            <div
              className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-orange-300 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFileUpload(e.dataTransfer.files); }}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.xlsx,.xls,.csv,.docx,.jpg,.jpeg,.png,.webp,.gif"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              {uploadingAttachment ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                  <span className="text-sm text-slate-500">Enviando...</span>
                </div>
              ) : (
                <>
                  <Paperclip className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Clique ou arraste um arquivo aqui</p>
                  <p className="text-[10px] text-slate-400 mt-1">PDF, Excel, imagem (máx. 10MB)</p>
                </>
              )}
            </div>

            {/* Image preview */}
            {previewImage && (
              <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute top-2 right-2 bg-white/90 rounded-full p-1 shadow-sm hover:bg-white transition-colors cursor-pointer z-10"
                >
                  <X className="w-4 h-4 text-slate-600" />
                </button>
                <img
                  src={previewImage.url}
                  alt={previewImage.name}
                  className="w-full max-h-64 object-contain"
                />
                <p className="text-[10px] text-slate-500 text-center py-1 bg-white/80">{previewImage.name}</p>
              </div>
            )}

            {/* Attachment list */}
            {currentAttachments.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {currentAttachments.map((att: any) => (
                  <div key={att.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    {att.mimeType.startsWith("image/") ? (
                      <button
                        onClick={() => setPreviewImage({ url: att.fileUrl, name: att.fileName })}
                        className="w-8 h-8 rounded overflow-hidden border border-slate-200 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-orange-300 transition-all"
                      >
                        <img src={att.fileUrl} alt={att.fileName} className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      getFileIcon(att.mimeType)
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{att.fileName}</p>
                      <p className="text-[10px] text-slate-400">{formatFileSize(att.fileSize)} • {att.uploadedBy}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {att.mimeType.startsWith("image/") ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setPreviewImage({ url: att.fileUrl, name: att.fileName })}
                              className="text-slate-400 hover:text-blue-500 transition-colors p-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Visualizar</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={att.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-blue-500 transition-colors p-1"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>Baixar</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={att.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-green-500 transition-colors p-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>Baixar</TooltipContent>
                      </Tooltip>
                      {(operatorName === att.uploadedBy || operatorName === "Guilherme") && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                if (confirm(`Excluir "${att.fileName}"?`)) {
                                  deleteAttachmentMutation.mutate({ operatorName, id: att.id });
                                }
                              }}
                              className="text-slate-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Excluir anexo</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-3">Nenhum anexo nesta conta</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
