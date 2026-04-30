/**
 * Seção de Estornos do E-commerce
 * Pedro registra estornos de compras feitas no cartão da filial,
 * para que Flávio tenha visibilidade sobre valores que retornam à matriz.
 */
import React, { useState, useMemo } from "react";
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
  RotateCcw,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Loader2,
  X,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  Filter,
  Check,
  Clock,
  CheckCircle2,
  Edit2,
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
} from "lucide-react";

const MOTIVO_LABELS: Record<string, { label: string; color: string }> = {
  produto_defeituoso: { label: "Produto Defeituoso", color: "bg-red-100 text-red-700 border-red-200" },
  produto_errado: { label: "Produto Errado", color: "bg-orange-100 text-orange-700 border-orange-200" },
  cancelamento: { label: "Cancelamento", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  duplicidade: { label: "Duplicidade", color: "bg-blue-100 text-blue-700 border-blue-200" },
  acordo_comercial: { label: "Acordo Comercial", color: "bg-purple-100 text-purple-700 border-purple-200" },
  outro: { label: "Outro", color: "bg-slate-100 text-slate-700 border-slate-200" },
};

const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  pendente: {
    label: "Pendente",
    icon: <Clock className="w-3.5 h-3.5" />,
    color: "text-amber-700",
    bg: "bg-amber-100 border-amber-200",
  },
  creditado: {
    label: "Creditado",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    color: "text-emerald-700",
    bg: "bg-emerald-100 border-emerald-200",
  },
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function RefundsSection() {
  const { operator } = useOperator();
  const operatorName = operator?.name || "";

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [dataCompraOriginal, setDataCompraOriginal] = useState("");
  const [dataEstorno, setDataEstorno] = useState(todayStr);
  const [valorEstorno, setValorEstorno] = useState("");
  const [motivo, setMotivo] = useState<"produto_defeituoso" | "produto_errado" | "cancelamento" | "duplicidade" | "acordo_comercial" | "outro">("cancelamento");
  const [motivoDetalhe, setMotivoDetalhe] = useState("");
  const [statusForm, setStatusForm] = useState<"pendente" | "creditado">("pendente");
  const [dataCreditado, setDataCreditado] = useState("");
  const [observacao, setObservacao] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterBusca, setFilterBusca] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "pendente" | "creditado">("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Expanded rows
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: listData, isLoading, refetch } = trpc.ecommerce.listRefunds.useQuery(
    { operatorName },
    { enabled: !!operatorName, refetchInterval: 30000 }
  );

  const { data: summaryData } = trpc.ecommerce.getRefundSummary.useQuery(
    { operatorName },
    { enabled: !!operatorName, refetchInterval: 30000 }
  );

  const addMutation = trpc.ecommerce.addRefund.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        resetForm();
        refetch();
      }
    },
  });

  const updateMutation = trpc.ecommerce.updateRefund.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setEditingId(null);
        resetForm();
        refetch();
      }
    },
  });

  const deleteMutation = trpc.ecommerce.deleteRefund.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setDeleteConfirm(null);
        refetch();
      }
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setDescricao("");
    setFornecedor("");
    setDataCompraOriginal("");
    setDataEstorno(todayStr());
    setValorEstorno("");
    setMotivo("cancelamento");
    setMotivoDetalhe("");
    setStatusForm("pendente");
    setDataCreditado("");
    setObservacao("");
    setEditingId(null);
  };

  const startEdit = (refund: any) => {
    setEditingId(refund.id);
    setDescricao(refund.descricao);
    setFornecedor(refund.fornecedor || "");
    setDataCompraOriginal(refund.dataCompraOriginal);
    setDataEstorno(refund.dataEstorno);
    setValorEstorno(String(Number(refund.valorEstorno)));
    setMotivo(refund.motivo);
    setMotivoDetalhe(refund.motivoDetalhe || "");
    setStatusForm(refund.status);
    setDataCreditado(refund.dataCreditado || "");
    setObservacao(refund.observacao || "");
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseFloat(valorEstorno.replace(",", "."));
    if (!descricao.trim() || isNaN(valor) || valor <= 0 || !dataCompraOriginal || !dataEstorno) return;

    const payload = {
      operatorName,
      descricao: descricao.trim(),
      fornecedor: fornecedor.trim() || undefined,
      dataCompraOriginal,
      dataEstorno,
      valorEstorno: valor,
      motivo,
      motivoDetalhe: motivoDetalhe.trim() || undefined,
      status: statusForm,
      dataCreditado: statusForm === "creditado" ? (dataCreditado || dataEstorno) : undefined,
      observacao: observacao.trim() || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ ...payload, id: editingId });
    } else {
      addMutation.mutate(payload);
    }
  };

  const handleMarkCredited = (refund: any) => {
    updateMutation.mutate({
      operatorName,
      id: refund.id,
      status: "creditado",
      dataCreditado: todayStr(),
    });
  };

  const allRefunds = listData?.refunds || [];
  const summary = summaryData?.summary;

  // Apply filters
  const filteredRefunds = useMemo(() => {
    return allRefunds.filter((r: any) => {
      if (filterBusca.trim()) {
        const search = filterBusca.toLowerCase().trim();
        const matchDesc = r.descricao?.toLowerCase().includes(search);
        const matchForn = r.fornecedor?.toLowerCase().includes(search);
        const matchObs = r.observacao?.toLowerCase().includes(search);
        const matchDetalhe = r.motivoDetalhe?.toLowerCase().includes(search);
        if (!matchDesc && !matchForn && !matchObs && !matchDetalhe) return false;
      }
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterDataInicio && r.dataEstorno < filterDataInicio) return false;
      if (filterDataFim && r.dataEstorno > filterDataFim) return false;
      return true;
    });
  }, [allRefunds, filterBusca, filterStatus, filterDataInicio, filterDataFim]);

  const filteredTotal = useMemo(() => {
    return filteredRefunds.reduce((sum: number, r: any) => sum + Number(r.valorEstorno), 0);
  }, [filteredRefunds]);

  const hasActiveFilters = filterBusca || filterStatus || filterDataInicio || filterDataFim;

  const clearFilters = () => {
    setFilterBusca("");
    setFilterStatus("");
    setFilterDataInicio("");
    setFilterDataFim("");
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-teal-500 mb-2" />
        <p className="text-sm text-slate-500">Carregando estornos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Estornos</span>
              <ArrowDownLeft className="w-4 h-4 text-teal-500" />
            </div>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(summary.totalGeral)}</p>
            <p className="text-[11px] text-slate-400 mt-1">{summary.totalCount} estorno{summary.totalCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mês Atual</span>
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(summary.mesAtual.total)}</p>
            <p className="text-[11px] text-slate-400 mt-1">{summary.mesAtual.count} estorno{summary.mesAtual.count !== 1 ? "s" : ""}</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm border-l-4 border-l-amber-400">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Pendentes</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold text-amber-700">{formatCurrency(summary.pendente.total)}</p>
            <p className="text-[11px] text-amber-500 mt-1">{summary.pendente.count} aguardando crédito</p>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm border-l-4 border-l-emerald-400">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Creditados</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-bold text-emerald-700">{formatCurrency(summary.creditado.total)}</p>
            <p className="text-[11px] text-emerald-500 mt-1">{summary.creditado.count} já creditado{summary.creditado.count !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      {/* Header + Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-teal-600" />
          <h3 className="text-lg font-semibold text-slate-800">Estornos</h3>
          <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[10px]">
            {hasActiveFilters ? `${filteredRefunds.length}/${allRefunds.length}` : allRefunds.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            size="sm"
            variant="outline"
            className={`gap-1.5 ${hasActiveFilters ? "border-teal-300 bg-teal-50 text-teal-700" : ""}`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
            {hasActiveFilters && (
              <Badge className="bg-teal-600 text-white text-[9px] px-1.5 py-0 ml-1">
                {[filterBusca, filterStatus, filterDataInicio, filterDataFim].filter(Boolean).length}
              </Badge>
            )}
          </Button>
          <Button
            onClick={() => { if (showForm && !editingId) { resetForm(); } else { resetForm(); setShowForm(true); } }}
            size="sm"
            className={showForm && !editingId ? "bg-slate-500 hover:bg-slate-600" : "bg-teal-600 hover:bg-teal-700"}
          >
            {showForm && !editingId ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {showForm && !editingId ? "Cancelar" : "Novo Estorno"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Filtros</span>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-[11px] text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1 cursor-pointer">
                <X className="w-3 h-3" /> Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-1">
              <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Buscar</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input value={filterBusca} onChange={(e) => setFilterBusca(e.target.value)} placeholder="Descrição, fornecedor..." className="bg-white pl-8 h-8 text-xs" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200">
                <option value="">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="creditado">Creditado</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Data início</label>
              <Input type="date" value={filterDataInicio} onChange={(e) => setFilterDataInicio(e.target.value)} className="bg-white h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Data fim</label>
              <Input type="date" value={filterDataFim} onChange={(e) => setFilterDataFim(e.target.value)} className="bg-white h-8 text-xs" />
            </div>
          </div>
          {hasActiveFilters && filteredRefunds.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{filteredRefunds.length}</span> resultado{filteredRefunds.length !== 1 ? "s" : ""}
              <span className="text-slate-400">— Total: <span className="font-semibold text-teal-700">{formatCurrency(filteredTotal)}</span></span>
            </div>
          )}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-teal-50/50 border border-teal-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-semibold text-teal-800">{editingId ? "Editar Estorno" : "Registrar Novo Estorno"}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">O que foi estornado? *</label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: 2 caixas de embalagem kraft, material de escritório..." className="bg-white" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Fornecedor / Loja</label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ex: Mercado Livre, Amazon, Loja X..." className="bg-white" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Valor do estorno (R$) *</label>
              <Input value={valorEstorno} onChange={(e) => setValorEstorno(e.target.value)} placeholder="0,00" className="bg-white" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Data da compra original *</label>
              <Input type="date" value={dataCompraOriginal} onChange={(e) => setDataCompraOriginal(e.target.value)} className="bg-white" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Data do estorno *</label>
              <Input type="date" value={dataEstorno} onChange={(e) => setDataEstorno(e.target.value)} className="bg-white" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Motivo do estorno *</label>
              <select value={motivo} onChange={(e) => setMotivo(e.target.value as any)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200">
                <option value="produto_defeituoso">Produto Defeituoso</option>
                <option value="produto_errado">Produto Errado</option>
                <option value="cancelamento">Cancelamento</option>
                <option value="duplicidade">Duplicidade</option>
                <option value="acordo_comercial">Acordo Comercial</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Status</label>
              <div className="flex gap-2">
                {(["pendente", "creditado"] as const).map((s) => {
                  const info = STATUS_LABELS[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusForm(s)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                        statusForm === s
                          ? `${info.bg} ${info.color} ring-2 ring-current/20`
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
            {statusForm === "creditado" && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Data do crédito na conta</label>
                <Input type="date" value={dataCreditado} onChange={(e) => setDataCreditado(e.target.value)} className="bg-white" />
              </div>
            )}
            {(motivo === "outro" || motivo === "acordo_comercial") && (
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Detalhe do motivo</label>
                <Input value={motivoDetalhe} onChange={(e) => setMotivoDetalhe(e.target.value)} placeholder="Explique o motivo em detalhes..." className="bg-white" />
              </div>
            )}
            <div className={motivo !== "outro" && motivo !== "acordo_comercial" ? "md:col-span-2" : ""}>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Observação (opcional)</label>
              <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Informações adicionais para o Flávio..." className="bg-white" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm} size="sm">
                Cancelar edição
              </Button>
            )}
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : editingId ? <Check className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              {editingId ? "Salvar Alterações" : "Registrar Estorno"}
            </Button>
          </div>
          {(addMutation.data && !addMutation.data.success) && (
            <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{addMutation.data.error}</p>
          )}
          {(updateMutation.data && !updateMutation.data.success) && (
            <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{updateMutation.data.error}</p>
          )}
        </form>
      )}

      {/* Refunds List */}
      {filteredRefunds.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <RotateCcw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          {hasActiveFilters ? (
            <>
              <p className="text-sm text-slate-500">Nenhum estorno encontrado com os filtros aplicados</p>
              <button onClick={clearFilters} className="text-xs text-teal-600 hover:text-teal-800 font-medium mt-2 cursor-pointer">Limpar filtros</button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500">Nenhum estorno registrado ainda</p>
              <p className="text-xs text-slate-400 mt-1">Clique em "Novo Estorno" para registrar o primeiro</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRefunds.map((refund: any) => {
            const motivoInfo = MOTIVO_LABELS[refund.motivo] || MOTIVO_LABELS.outro;
            const statusInfo = STATUS_LABELS[refund.status] || STATUS_LABELS.pendente;
            const isExpanded = expandedId === refund.id;
            const canModify = operator?.name === refund.registradoPor || operator?.name === "Guilherme";

            return (
              <div key={refund.id} className={`bg-white rounded-xl border ${refund.status === "pendente" ? "border-amber-200" : "border-emerald-200"} shadow-sm overflow-hidden transition-all`}>
                {/* Main row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : refund.id)}
                >
                  {/* Status indicator */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${refund.status === "pendente" ? "bg-amber-400" : "bg-emerald-400"}`} />

                  {/* Description + Fornecedor */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{refund.descricao}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {refund.fornecedor && (
                        <span className="text-[10px] text-slate-400">{refund.fornecedor}</span>
                      )}
                      <span className="text-[10px] text-slate-400">por {refund.registradoPor}</span>
                    </div>
                  </div>

                  {/* Motivo badge */}
                  <Badge className={`${motivoInfo.color} text-[10px] hidden md:flex`}>
                    {motivoInfo.label}
                  </Badge>

                  {/* Dates */}
                  <div className="text-right hidden md:block">
                    <p className="text-[10px] text-slate-400">Compra: {formatDate(refund.dataCompraOriginal)}</p>
                    <p className="text-[10px] text-slate-500 font-medium">Estorno: {formatDate(refund.dataEstorno)}</p>
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    <p className="text-sm font-bold text-teal-700">{formatCurrency(Number(refund.valorEstorno))}</p>
                  </div>

                  {/* Status badge */}
                  <Badge className={`${statusInfo.bg} ${statusInfo.color} text-[10px] gap-1`}>
                    {statusInfo.icon}
                    {statusInfo.label}
                  </Badge>

                  {/* Expand icon */}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-0.5">Descrição</span>
                        <span className="text-slate-700">{refund.descricao}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-0.5">Fornecedor</span>
                        <span className="text-slate-700">{refund.fornecedor || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-0.5">Data Compra Original</span>
                        <span className="text-slate-700">{formatDate(refund.dataCompraOriginal)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-0.5">Data do Estorno</span>
                        <span className="text-slate-700">{formatDate(refund.dataEstorno)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-0.5">Valor</span>
                        <span className="text-teal-700 font-bold">{formatCurrency(Number(refund.valorEstorno))}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-0.5">Motivo</span>
                        <Badge className={`${motivoInfo.color} text-[10px]`}>{motivoInfo.label}</Badge>
                        {refund.motivoDetalhe && <p className="text-slate-500 mt-0.5">{refund.motivoDetalhe}</p>}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-0.5">Status</span>
                        <Badge className={`${statusInfo.bg} ${statusInfo.color} text-[10px] gap-1`}>{statusInfo.icon}{statusInfo.label}</Badge>
                        {refund.status === "creditado" && refund.dataCreditado && (
                          <p className="text-slate-500 mt-0.5">Creditado em {formatDate(refund.dataCreditado)}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-0.5">Registrado por</span>
                        <span className="text-slate-700">{refund.registradoPor}</span>
                      </div>
                      {refund.observacao && (
                        <div className="md:col-span-4">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-0.5">Observação</span>
                          <span className="text-slate-700">{refund.observacao}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {canModify && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
                        {refund.status === "pendente" && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 gap-1 text-xs h-7"
                            onClick={(e) => { e.stopPropagation(); handleMarkCredited(refund); }}
                            disabled={updateMutation.isPending}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Marcar como Creditado
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs h-7"
                          onClick={(e) => { e.stopPropagation(); startEdit(refund); }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Editar
                        </Button>
                        {deleteConfirm === refund.id ? (
                          <div className="flex items-center gap-2 ml-2">
                            <span className="text-[11px] text-red-600 font-medium">Excluir?</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ operatorName, id: refund.id }); }}
                              className="text-red-600 hover:text-red-800 text-[11px] font-bold cursor-pointer"
                            >
                              Sim
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                              className="text-slate-400 hover:text-slate-600 text-[11px] cursor-pointer"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-xs h-7 text-red-500 hover:text-red-700 hover:border-red-300"
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(refund.id); }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir estorno</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
