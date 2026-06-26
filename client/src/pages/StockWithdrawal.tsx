/**
 * Módulo: Solicitação de Baixa Manual no Estoque
 * Sub-aba "Movimentação de Estoque" dentro da aba Produção
 * 
 * Fluxo: Líder solicita → Fiscal aprova → Fiscal faz baixa no sistema → Fiscal confirma
 * Status: Pendente → Aprovada → Concluída (ou Pendente → Recusada)
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import { toast } from "sonner";
import {
  Plus, Search, Check, X, Clock, CheckCircle2, XCircle, AlertTriangle,
  Package, ArrowRight, Loader2, Filter, History, ChevronDown, ChevronUp,
} from "lucide-react";

const MOTIVO_LABELS: Record<string, string> = {
  amostra: "Amostra",
  reembalagem: "Reembalagem",
  complemento_pedido: "Complemento de Pedido",
  outro: "Outro",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pendente: { label: "Pendente", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  aprovada: { label: "Aprovada — Aguardando Baixa", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: CheckCircle2 },
  concluida: { label: "Concluída", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  recusada: { label: "Recusada", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: XCircle },
};

export default function StockWithdrawal() {
  const { operator, hasGranularAccess } = useOperator();
  const [activeView, setActiveView] = useState<"solicitar" | "pendentes" | "historico" | "indicadores">("pendentes");
  
  // Permissões
  const canCreate = hasGranularAccess("prod.mov_solicitar");
  const canApprove = hasGranularAccess("prod.mov_aprovar");

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        {canCreate && (
          <button
            onClick={() => setActiveView("solicitar")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === "solicitar" ? "bg-violet-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            <Plus className="w-4 h-4" /> Nova Solicitação
          </button>
        )}
        <button
          onClick={() => setActiveView("pendentes")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === "pendentes" ? "bg-amber-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
        >
          <Clock className="w-4 h-4" /> Pendentes
          <PendingBadge />
        </button>
        <button
          onClick={() => setActiveView("historico")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === "historico" ? "bg-slate-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
        >
          <History className="w-4 h-4" /> Histórico
        </button>
        <button
          onClick={() => setActiveView("indicadores")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === "indicadores" ? "bg-teal-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
        >
          <Package className="w-4 h-4" /> Indicadores
        </button>
      </div>

      {/* Alert for approved > 24h */}
      <AlertOver24h canApprove={canApprove} />

      {/* Content */}
      {activeView === "solicitar" && canCreate && <SolicitarForm />}
      {activeView === "pendentes" && <PendingList canApprove={canApprove} />}
      {activeView === "historico" && <HistoricoList />}
      {activeView === "indicadores" && <Indicadores />}
    </div>
  );
}

/* ─── Badge de pendências ─── */
function PendingBadge() {
  const { data } = trpc.stockWithdrawal.countPending.useQuery(undefined, { refetchInterval: 30000 });
  if (!data || data.pending === 0) return null;
  return (
    <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center">
      {data.pending}
    </span>
  );
}

/* ─── Alerta de aprovadas > 24h ─── */
function AlertOver24h({ canApprove }: { canApprove: boolean }) {
  const { data } = trpc.stockWithdrawal.countPending.useQuery(undefined, { refetchInterval: 30000 });
  if (!data || data.approvedOver24h === 0) return null;
  return (
    <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
      <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
      <span className="text-sm text-orange-800 font-medium">
        {data.approvedOver24h} solicitação(ões) aprovada(s) há mais de 24h sem confirmação de baixa.
        {canApprove && " Verifique se a baixa foi realizada no sistema."}
      </span>
    </div>
  );
}

/* ─── Formulário de Solicitação (Líder) ─── */
function SolicitarForm() {
  const { operator } = useOperator();
  const utils = trpc.useUtils();
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{ codigoItem: string; descricaoItem: string } | null>(null);
  const [quantity, setQuantity] = useState("");
  const [motivo, setMotivo] = useState<"amostra" | "reembalagem" | "complemento_pedido" | "outro">("amostra");
  const [motivoDescricao, setMotivoDescricao] = useState("");
  const [produtoDestinoSearch, setProdutoDestinoSearch] = useState("");
  const [selectedProdutoDestino, setSelectedProdutoDestino] = useState<{ codigoItem: string; descricaoItem: string } | null>(null);
  const [quantidadeDestino, setQuantidadeDestino] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showDestinoDropdown, setShowDestinoDropdown] = useState(false);

  const { data: products } = trpc.stockWithdrawal.searchProducts.useQuery(
    { query: productSearch },
    { enabled: productSearch.length >= 2 }
  );
  const { data: destinoProducts } = trpc.stockWithdrawal.searchProducts.useQuery(
    { query: produtoDestinoSearch },
    { enabled: produtoDestinoSearch.length >= 2 && motivo === "reembalagem" }
  );

  const createMutation = trpc.stockWithdrawal.create.useMutation({
    onSuccess: () => {
      toast.success("Solicitação criada com sucesso!");
      resetForm();
      utils.stockWithdrawal.list.invalidate();
      utils.stockWithdrawal.countPending.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao criar solicitação");
    },
  });

  function resetForm() {
    setProductSearch("");
    setSelectedProduct(null);
    setQuantity("");
    setMotivo("amostra");
    setMotivoDescricao("");
    setProdutoDestinoSearch("");
    setSelectedProdutoDestino(null);
    setQuantidadeDestino("");
  }

  function handleSubmit() {
    if (!selectedProduct) return toast.error("Selecione um produto");
    if (!quantity || parseFloat(quantity) <= 0) return toast.error("Informe a quantidade");
    if (motivo === "outro" && !motivoDescricao.trim()) return toast.error("Descreva o motivo");
    if (motivo === "reembalagem" && (!selectedProdutoDestino || !quantidadeDestino)) {
      return toast.error("Informe o produto de destino e a quantidade para Reembalagem");
    }

    createMutation.mutate({
      productCode: selectedProduct.codigoItem,
      productName: selectedProduct.descricaoItem,
      quantity,
      motivo,
      motivoDescricao: motivo === "outro" ? motivoDescricao : undefined,
      produtoDestinoCode: motivo === "reembalagem" ? selectedProdutoDestino?.codigoItem : undefined,
      produtoDestinoName: motivo === "reembalagem" ? selectedProdutoDestino?.descricaoItem : undefined,
      quantidadeDestino: motivo === "reembalagem" ? quantidadeDestino : undefined,
      solicitanteId: operator?.id || 0,
      solicitanteName: operator?.name || "Desconhecido",
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
        <Plus className="w-5 h-5 text-violet-600" />
        Nova Solicitação de Baixa
      </h3>

      {/* Produto */}
      <div className="relative">
        <label className="block text-sm font-medium text-slate-700 mb-1">Produto *</label>
        {selectedProduct ? (
          <div className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <Package className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-medium text-violet-900">{selectedProduct.codigoItem} — {selectedProduct.descricaoItem}</span>
            <button onClick={() => { setSelectedProduct(null); setProductSearch(""); }} className="ml-auto text-violet-500 hover:text-violet-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
              onFocus={() => setShowProductDropdown(true)}
              placeholder="Buscar por código ou nome do produto..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {showProductDropdown && products && products.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {products.map((p) => (
                  <button
                    key={p.codigoItem}
                    onClick={() => { setSelectedProduct(p); setShowProductDropdown(false); setProductSearch(""); }}
                    className="w-full text-left px-3 py-2 hover:bg-violet-50 text-sm border-b border-slate-100 last:border-0"
                  >
                    <span className="font-medium text-slate-700">{p.codigoItem}</span>
                    <span className="text-slate-500 ml-2">{p.descricaoItem}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quantidade */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade Retirada *</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Ex: 5"
          min="0.01"
          step="0.01"
          className="w-full max-w-xs px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Motivo */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Motivo *</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(["amostra", "reembalagem", "complemento_pedido", "outro"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMotivo(m)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${motivo === m ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
            >
              {MOTIVO_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Campo condicional: Reembalagem */}
      {motivo === "reembalagem" && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
          <p className="text-sm font-medium text-blue-800 flex items-center gap-1.5">
            <ArrowRight className="w-4 h-4" /> Produto de Destino (entra no estoque)
          </p>
          {/* Produto destino */}
          <div className="relative">
            {selectedProdutoDestino ? (
              <div className="flex items-center gap-2 p-2.5 bg-blue-100 border border-blue-300 rounded-lg">
                <Package className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">{selectedProdutoDestino.codigoItem} — {selectedProdutoDestino.descricaoItem}</span>
                <button onClick={() => { setSelectedProdutoDestino(null); setProdutoDestinoSearch(""); }} className="ml-auto text-blue-500 hover:text-blue-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                <input
                  type="text"
                  value={produtoDestinoSearch}
                  onChange={(e) => { setProdutoDestinoSearch(e.target.value); setShowDestinoDropdown(true); }}
                  onFocus={() => setShowDestinoDropdown(true)}
                  placeholder="Buscar produto de destino..."
                  className="w-full pl-9 pr-4 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {showDestinoDropdown && destinoProducts && destinoProducts.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-white border border-blue-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {destinoProducts.map((p) => (
                      <button
                        key={p.codigoItem}
                        onClick={() => { setSelectedProdutoDestino(p); setShowDestinoDropdown(false); setProdutoDestinoSearch(""); }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-blue-100 last:border-0"
                      >
                        <span className="font-medium text-slate-700">{p.codigoItem}</span>
                        <span className="text-slate-500 ml-2">{p.descricaoItem}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Quantidade destino */}
          <div>
            <label className="block text-xs font-medium text-blue-700 mb-1">Quantidade que entra no estoque</label>
            <input
              type="number"
              value={quantidadeDestino}
              onChange={(e) => setQuantidadeDestino(e.target.value)}
              placeholder="Ex: 10"
              min="0.01"
              step="0.01"
              className="w-full max-w-xs px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>
      )}

      {/* Campo condicional: Outro */}
      {motivo === "outro" && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descreva o motivo *</label>
          <textarea
            value={motivoDescricao}
            onChange={(e) => setMotivoDescricao(e.target.value)}
            placeholder="Descreva o motivo da retirada..."
            rows={3}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
        </div>
      )}

      {/* Info do solicitante */}
      <div className="text-xs text-slate-500 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5" />
        Solicitante: <span className="font-medium">{operator?.name || "—"}</span> | Data/Hora: {new Date().toLocaleString("pt-BR")}
      </div>

      {/* Botão enviar */}
      <button
        onClick={handleSubmit}
        disabled={createMutation.isPending}
        className="w-full sm:w-auto px-6 py-3 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 justify-center"
      >
        {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Enviar Solicitação
      </button>
    </div>
  );
}

/* ─── Lista de Pendentes (Fiscal) ─── */
function PendingList({ canApprove }: { canApprove: boolean }) {
  const { operator } = useOperator();
  const utils = trpc.useUtils();
  const { data: requests, isLoading } = trpc.stockWithdrawal.list.useQuery(
    { status: "pendente" },
    { refetchInterval: 15000 }
  );
  const { data: approved } = trpc.stockWithdrawal.list.useQuery(
    { status: "aprovada" },
    { refetchInterval: 15000 }
  );

  const approveMutation = trpc.stockWithdrawal.approve.useMutation({
    onSuccess: () => {
      toast.success("Solicitação aprovada!");
      utils.stockWithdrawal.list.invalidate();
      utils.stockWithdrawal.countPending.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao aprovar"),
  });

  const rejectMutation = trpc.stockWithdrawal.reject.useMutation({
    onSuccess: () => {
      toast.success("Solicitação recusada");
      utils.stockWithdrawal.list.invalidate();
      utils.stockWithdrawal.countPending.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao recusar"),
  });

  const completeMutation = trpc.stockWithdrawal.complete.useMutation({
    onSuccess: () => {
      toast.success("Baixa confirmada com sucesso!");
      utils.stockWithdrawal.list.invalidate();
      utils.stockWithdrawal.countPending.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao confirmar baixa"),
  });

  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectJustificativa, setRejectJustificativa] = useState("");

  function handleApprove(id: number) {
    if (!operator) return;
    approveMutation.mutate({ id, fiscalId: operator.id, fiscalName: operator.name });
  }

  function handleReject(id: number) {
    if (!operator) return;
    rejectMutation.mutate({ id, fiscalId: operator.id, fiscalName: operator.name, justificativa: rejectJustificativa || undefined });
    setRejectId(null);
    setRejectJustificativa("");
  }

  function handleComplete(id: number) {
    if (!operator) return;
    completeMutation.mutate({ id, fiscalId: operator.id, fiscalName: operator.name });
  }

  if (isLoading) return <div className="flex items-center gap-2 text-slate-500 py-8 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Carregando...</div>;

  const pendingList = requests || [];
  const approvedList = approved || [];

  return (
    <div className="space-y-6">
      {/* Pendentes */}
      <div>
        <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          Aguardando Aprovação ({pendingList.length})
        </h3>
        {pendingList.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-slate-200">
            Nenhuma solicitação pendente
          </div>
        ) : (
          <div className="space-y-3">
            {pendingList.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                actions={canApprove ? (
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={approveMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Aprovar
                    </button>
                    {rejectId === req.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={rejectJustificativa}
                          onChange={(e) => setRejectJustificativa(e.target.value)}
                          placeholder="Justificativa (opcional)"
                          className="flex-1 px-3 py-1.5 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <button onClick={() => handleReject(req.id)} className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">
                          Confirmar
                        </button>
                        <button onClick={() => setRejectId(null)} className="px-2 py-1.5 text-slate-500 hover:text-slate-700">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRejectId(req.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Recusar
                      </button>
                    )}
                  </div>
                ) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Aprovadas aguardando baixa */}
      {approvedList.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            Aprovadas — Aguardando Baixa no Sistema ({approvedList.length})
          </h3>
          <div className="space-y-3">
            {approvedList.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                actions={canApprove ? (
                  <div className="mt-3">
                    <button
                      onClick={() => handleComplete(req.id)}
                      disabled={completeMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Baixa Realizada
                    </button>
                  </div>
                ) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Card de Solicitação ─── */
function RequestCard({ request, actions }: { request: any; actions?: React.ReactNode }) {
  const statusCfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.pendente;
  const StatusIcon = statusCfg.icon;
  const isOver24h = request.status === "aprovada" && request.dataAprovacao && (Date.now() - new Date(request.dataAprovacao).getTime() > 24 * 60 * 60 * 1000);

  return (
    <div className={`bg-white rounded-xl border p-4 ${isOver24h ? "border-orange-300 ring-1 ring-orange-200" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.bg} ${statusCfg.color}`}>
              <StatusIcon className="w-3 h-3" /> {statusCfg.label}
            </span>
            {isOver24h && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                <AlertTriangle className="w-3 h-3" /> +24h
              </span>
            )}
            <span className="text-xs text-slate-400">#{request.id}</span>
          </div>
          <div className="mt-2">
            <p className="text-sm font-semibold text-slate-800">
              {request.productCode} — {request.productName}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              Quantidade: <span className="font-medium">{request.quantity}</span> | Motivo: <span className="font-medium">{MOTIVO_LABELS[request.motivo] || request.motivo}</span>
            </p>
            {request.motivo === "reembalagem" && request.produtoDestinoName && (
              <p className="text-xs text-blue-700 mt-1 flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> Destino: {request.produtoDestinoCode} — {request.produtoDestinoName} (Qtd: {request.quantidadeDestino})
              </p>
            )}
            {request.motivo === "outro" && request.motivoDescricao && (
              <p className="text-xs text-slate-500 mt-1 italic">"{request.motivoDescricao}"</p>
            )}
            {request.justificativaRecusa && (
              <p className="text-xs text-red-600 mt-1">Justificativa: "{request.justificativaRecusa}"</p>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            <span>Solicitante: <span className="font-medium text-slate-600">{request.solicitanteName}</span></span>
            <span>{new Date(request.dataSolicitacao).toLocaleString("pt-BR")}</span>
            {request.fiscalName && <span>Fiscal: <span className="font-medium text-slate-600">{request.fiscalName}</span></span>}
          </div>
        </div>
      </div>
      {actions}
    </div>
  );
}

/* ─── Histórico Completo ─── */
function HistoricoList() {
  const [statusFilter, setStatusFilter] = useState<"todas" | "pendente" | "aprovada" | "concluida" | "recusada">("todas");
  const { data: requests, isLoading } = trpc.stockWithdrawal.list.useQuery({ status: statusFilter, limit: 200 });

  if (isLoading) return <div className="flex items-center gap-2 text-slate-500 py-8 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-500" />
        {(["todas", "pendente", "aprovada", "concluida", "recusada"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${statusFilter === s ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            {s === "todas" ? "Todas" : STATUS_CONFIG[s]?.label || s}
          </button>
        ))}
      </div>

      {(!requests || requests.length === 0) ? (
        <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-slate-200">
          Nenhuma solicitação encontrada
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <RequestCard key={req.id} request={req} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Indicadores do Mês ─── */
function Indicadores() {
  const { data, isLoading } = trpc.stockWithdrawal.monthlyStats.useQuery({});

  if (isLoading) return <div className="flex items-center gap-2 text-slate-500 py-8 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Carregando...</div>;
  if (!data) return null;

  const motivoColors: Record<string, string> = {
    amostra: "bg-purple-100 text-purple-700",
    reembalagem: "bg-blue-100 text-blue-700",
    complemento_pedido: "bg-amber-100 text-amber-700",
    outro: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="space-y-4">
      {/* Total do mês */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
          <p className="text-3xl font-bold text-slate-800">{data.total}</p>
          <p className="text-sm text-slate-500 mt-1">Movimentações no mês</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-medium text-slate-700 mb-2">Por Motivo</p>
          <div className="space-y-1.5">
            {data.byMotivo.map((m) => (
              <div key={m.motivo} className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${motivoColors[m.motivo] || "bg-slate-100 text-slate-700"}`}>
                  {MOTIVO_LABELS[m.motivo] || m.motivo}
                </span>
                <span className="text-sm font-bold text-slate-700">{m.count}</span>
              </div>
            ))}
            {data.byMotivo.length === 0 && <p className="text-xs text-slate-400">Sem dados</p>}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-medium text-slate-700 mb-2">Por Status</p>
          <div className="space-y-1.5">
            {data.byStatus.map((s) => {
              const cfg = STATUS_CONFIG[s.status];
              return (
                <div key={s.status} className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cfg?.bg || "bg-slate-50"} ${cfg?.color || "text-slate-700"}`}>
                    {cfg?.label || s.status}
                  </span>
                  <span className="text-sm font-bold text-slate-700">{s.count}</span>
                </div>
              );
            })}
            {data.byStatus.length === 0 && <p className="text-xs text-slate-400">Sem dados</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
