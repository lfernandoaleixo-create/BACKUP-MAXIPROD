/**
 * Módulo: Solicitação de Baixa Manual no Estoque
 * Sub-aba "Movimentação de Estoque" dentro da aba Produção
 * 
 * REGRAS:
 * 1. Apenas LARISSA pode aprovar/recusar (validação por senha)
 * 2. A Manus NÃO faz baixa automática no estoque - é só controle visual
 * 3. A baixa real é feita manualmente no Maxiprod pela Larissa
 * 4. Fluxo: Líder solicita → Larissa aprova/recusa → Larissa faz baixa no Maxiprod → Larissa confirma
 * 5. Status: Pendente → Aprovada → Concluída (ou Pendente → Recusada)
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import { toast } from "sonner";
import {
  Plus, Search, Check, X, Clock, CheckCircle2, XCircle, AlertTriangle,
  Package, ArrowRight, ArrowDown, ArrowUp, Loader2, Filter, History, ChevronDown, ChevronUp, Trash2, Lock,
} from "lucide-react";

const MOTIVO_LABELS: Record<string, string> = {
  consumo_pedido: "Consumo em pedido",
  amostra: "Amostra para cliente",
  reembalagem: "Reembalagem/Transformação",
  ajuste_inventario: "Ajuste de inventário",
  avaria_perda: "Avaria/Perda",
  uso_interno: "Uso interno",
  devolucao_retrabalho: "Devolução/Retrabalho",
  outro: "Outros",
};

const STATUS_CONFIG_BAIXA: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pendente: { label: "Pendente", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  aprovada: { label: "Solicitação autorizada para dar baixa no Maxiprod", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: CheckCircle2 },
  concluida: { label: "Baixa dada no Maxiprod", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  recusada: { label: "Solicitação recusada para dar baixa no Maxiprod", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: XCircle },
};

const STATUS_CONFIG_ACRESCIMO: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pendente: { label: "Pendente", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  aprovada: { label: "Solicitação autorizada para acréscimo no Maxiprod", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: CheckCircle2 },
  concluida: { label: "Acréscimo feito no Maxiprod", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  recusada: { label: "Solicitação recusada para acréscimo no Maxiprod", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: XCircle },
};

export default function StockWithdrawal() {
  const { operator, hasGranularAccess } = useOperator();
  const [activeView, setActiveView] = useState<"solicitar" | "pendentes" | "historico" | "indicadores">("solicitar");
  
  // Permissões
  const canCreate = hasGranularAccess("prod.mov_solicitar");
  const canApprove = hasGranularAccess("prod.mov_aprovar");

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-200 rounded-lg">
        <Lock className="w-4 h-4 text-violet-600 shrink-0" />
        <span className="text-xs text-violet-800">
          Apenas a <strong>Larissa</strong> pode aprovar/recusar solicitações (validação por senha). A baixa é feita manualmente no Maxiprod — a Manus apenas registra o controle.
        </span>
      </div>

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
        <PendentesButton activeView={activeView} onClick={() => setActiveView("pendentes")} />
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

/* ─── Botão Pendentes com alerta piscante ─── */
function PendentesButton({ activeView, onClick }: { activeView: string; onClick: () => void }) {
  const { data } = trpc.stockWithdrawal.countPending.useQuery(undefined, { refetchInterval: 15000 });
  const pendingCount = data?.pending ?? 0;
  const recentlyActioned = data?.recentlyActioned ?? 0;
  // Pisca para todos quando há pendentes OU quando há ações recentes (aprovado/recusado aguardando conclusão)
  const hasAlert = pendingCount > 0 || recentlyActioned > 0;
  const badgeCount = pendingCount + recentlyActioned;
  const isActive = activeView === "pendentes";
  const shouldBlink = hasAlert && !isActive;

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-amber-600 text-white shadow-sm"
          : shouldBlink
            ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.4)]"
            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }`}
    >
      <Clock className="w-4 h-4" /> Pendentes
      {hasAlert && (
        <span className={`ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full min-w-[18px] text-center ${isActive ? "bg-white text-amber-700" : "bg-red-500 text-white"} ${shouldBlink ? "animate-bounce" : ""}`}>
          {badgeCount}
        </span>
      )}
    </button>
  );
}

/* ─── Badge de pendências (legacy, mantido para compatibilidade) ─── */
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
        {data.approvedOver24h} solicitação(ões) aprovada(s) há mais de 24h sem confirmação de baixa no Maxiprod.
        {canApprove && " Larissa: verifique se a baixa já foi realizada no Maxiprod e confirme aqui."}
      </span>
    </div>
  );
}

/* ─── Formulário de Solicitação (Líder) - com sub-abas Baixa e Acréscimo ─── */
function SolicitarForm() {
  const [subTab, setSubTab] = useState<"baixa" | "acrescimo">("baixa");

  return (
    <div className="space-y-4">
      {/* Sub-tabs: Baixa vs Acréscimo */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-0">
        <button
          onClick={() => setSubTab("baixa")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            subTab === "baixa"
              ? "border-violet-600 text-violet-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Nova Solicitação de Baixa
        </button>
        <button
          onClick={() => setSubTab("acrescimo")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            subTab === "acrescimo"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Nova Solicitação de Acréscimo
        </button>
      </div>

      {subTab === "baixa" && <SolicitarBaixaForm />}
      {subTab === "acrescimo" && <SolicitarAcrescimoForm />}
    </div>
  );
}

/* ─── Formulário de Baixa (motivos exceto Devolução/Retrabalho) ─── */
function SolicitarBaixaForm() {
  const { operator } = useOperator();
  const utils = trpc.useUtils();
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{ codigoItem: string; descricaoItem: string } | null>(null);
  const [quantity, setQuantity] = useState("");
  const [motivo, setMotivo] = useState<string>("consumo_pedido");
  const [motivoDescricao, setMotivoDescricao] = useState("");
  const [produtoDestinoSearch, setProdutoDestinoSearch] = useState("");
  const [selectedProdutoDestino, setSelectedProdutoDestino] = useState<{ codigoItem: string; descricaoItem: string } | null>(null);
  const [quantidadeDestino, setQuantidadeDestino] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showDestinoDropdown, setShowDestinoDropdown] = useState(false);
  const [senha, setSenha] = useState("");

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
      toast.success("Solicitação de baixa criada com sucesso!");
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
    setMotivo("consumo_pedido");
    setMotivoDescricao("");
    setProdutoDestinoSearch("");
    setSelectedProdutoDestino(null);
    setQuantidadeDestino("");
    setSenha("");
  }

  function handleSubmit() {
    if (!selectedProduct) return toast.error("Selecione um produto");
    if (!quantity || parseFloat(quantity) <= 0) return toast.error("Informe a quantidade");
    if (motivo === "outro" && !motivoDescricao.trim()) return toast.error("Descreva o motivo");
    if (motivo === "reembalagem" && (!selectedProdutoDestino || !quantidadeDestino)) {
      return toast.error("Informe o produto de destino e a quantidade para Reembalagem");
    }
    if (!senha.trim()) return toast.error("Digite sua senha para confirmar a solicitação");

    createMutation.mutate({
      productCode: selectedProduct.codigoItem,
      productName: selectedProduct.descricaoItem,
      quantity,
      motivo: motivo as any,
      motivoDescricao: motivo === "outro" ? motivoDescricao : undefined,
      produtoDestinoCode: motivo === "reembalagem" ? selectedProdutoDestino?.codigoItem : undefined,
      produtoDestinoName: motivo === "reembalagem" ? selectedProdutoDestino?.descricaoItem : undefined,
      quantidadeDestino: motivo === "reembalagem" ? quantidadeDestino : undefined,
      senha: senha.trim(),
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

      {/* Motivo - sem Devolução/Retrabalho (agora está na aba Acréscimo) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Motivo *</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(["consumo_pedido", "amostra", "reembalagem", "ajuste_inventario", "avaria_perda", "uso_interno", "outro"] as const).map((m) => (
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do motivo *</label>
          <textarea
            value={motivoDescricao}
            onChange={(e) => setMotivoDescricao(e.target.value)}
            placeholder="Descreva o motivo da retirada..."
            rows={2}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
        </div>
      )}

      {/* Senha do operador */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Sua Senha (para confirmar) *</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Digite sua senha"
          className="w-full max-w-xs px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={createMutation.isPending}
        className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
      >
        {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Enviar Solicitação de Baixa
      </button>
    </div>
  );
}

/* ─── Formulário de Acréscimo (Devolução/Retrabalho) ─── */
function SolicitarAcrescimoForm() {
  const { operator } = useOperator();
  const utils = trpc.useUtils();
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{ codigoItem: string; descricaoItem: string } | null>(null);
  const [quantity, setQuantity] = useState("");
  const [observacao, setObservacao] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [senha, setSenha] = useState("");

  const { data: products } = trpc.stockWithdrawal.searchProducts.useQuery(
    { query: productSearch },
    { enabled: productSearch.length >= 2 }
  );

  const createMutation = trpc.stockWithdrawal.create.useMutation({
    onSuccess: () => {
      toast.success("Solicitação de acréscimo criada com sucesso!");
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
    setObservacao("");
    setSenha("");
  }

  function handleSubmit() {
    if (!selectedProduct) return toast.error("Selecione um produto");
    if (!quantity || parseFloat(quantity) <= 0) return toast.error("Informe a quantidade de caixas");
    if (!observacao.trim()) return toast.error("Descreva o motivo detalhado da devolução/retrabalho");
    if (!senha.trim()) return toast.error("Digite sua senha para confirmar a solicitação");

    createMutation.mutate({
      productCode: selectedProduct.codigoItem,
      productName: selectedProduct.descricaoItem,
      quantity,
      motivo: "devolucao_retrabalho" as any,
      motivoDescricao: observacao.trim(),
      senha: senha.trim(),
    });
  }

  return (
    <div className="bg-white rounded-xl border border-emerald-200 p-6 space-y-5">
      <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
        <Plus className="w-5 h-5 text-emerald-600" />
        Nova Solicitação de Acréscimo
      </h3>

      {/* Motivo fixo: Devolução/Retrabalho */}
      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-sm font-medium text-emerald-800">Motivo: Devolução/Retrabalho</span>
        <span className="text-xs text-emerald-600 ml-auto">(produto retorna ao estoque)</span>
      </div>

      {/* Produto */}
      <div className="relative">
        <label className="block text-sm font-medium text-slate-700 mb-1">Produto *</label>
        {selectedProduct ? (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <Package className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-900">{selectedProduct.codigoItem} — {selectedProduct.descricaoItem}</span>
            <button onClick={() => { setSelectedProduct(null); setProductSearch(""); }} className="ml-auto text-emerald-500 hover:text-emerald-700">
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
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {showProductDropdown && products && products.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {products.map((p) => (
                  <button
                    key={p.codigoItem}
                    onClick={() => { setSelectedProduct(p); setShowProductDropdown(false); setProductSearch(""); }}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm border-b border-slate-100 last:border-0"
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
        <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade de Caixas *</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Ex: 5"
          min="0.01"
          step="0.01"
          className="w-full max-w-xs px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Observação detalhada - obrigatória */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Observação (motivo detalhado) *</label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Descreva detalhadamente o motivo da devolução ou retrabalho (ex: produto voltou do cliente por defeito, lote retrabalhado na produção, etc.)..."
          rows={3}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </div>

      {/* Senha do operador */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Sua Senha (para confirmar) *</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Digite sua senha"
          className="w-full max-w-xs px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={createMutation.isPending}
        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Enviar Solicitação de Acréscimo
      </button>
    </div>
  );
}

/* ─── Lista de Pendentes + Aprovadas ─── */
function PendingList({ canApprove }: { canApprove: boolean }) {
  const utils = trpc.useUtils();
  const { data: requests, isLoading } = trpc.stockWithdrawal.list.useQuery(
    { status: "pendente" },
    { refetchInterval: 15000 }
  );
  const { data: approved } = trpc.stockWithdrawal.list.useQuery(
    { status: "aprovada" },
    { refetchInterval: 15000 }
  );

  const { operator } = useOperator();
  const canDelete = ["Bruno", "Guilherme", "Fernando"].some(n => operator?.name?.toLowerCase().includes(n.toLowerCase()));

  // State for password prompts
  const [approveId, setApproveId] = useState<number | null>(null);
  const [approveSenha, setApproveSenha] = useState("");
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectSenha, setRejectSenha] = useState("");
  const [rejectJustificativa, setRejectJustificativa] = useState("");
  const [completeId, setCompleteId] = useState<number | null>(null);
  const [completeSenha, setCompleteSenha] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteSenha, setDeleteSenha] = useState("");

  const approveMutation = trpc.stockWithdrawal.approve.useMutation({
    onSuccess: () => {
      toast.success("Solicitação aprovada pela Larissa!");
      setApproveId(null);
      setApproveSenha("");
      utils.stockWithdrawal.list.invalidate();
      utils.stockWithdrawal.countPending.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao aprovar"),
  });

  const rejectMutation = trpc.stockWithdrawal.reject.useMutation({
    onSuccess: () => {
      toast.success("Solicitação recusada pela Larissa");
      setRejectId(null);
      setRejectSenha("");
      setRejectJustificativa("");
      utils.stockWithdrawal.list.invalidate();
      utils.stockWithdrawal.countPending.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao recusar"),
  });

  const completeMutation = trpc.stockWithdrawal.complete.useMutation({
    onSuccess: () => {
      toast.success("Baixa confirmada! O sync da Manus já vai ler o estoque atualizado do Maxiprod.");
      setCompleteId(null);
      setCompleteSenha("");
      utils.stockWithdrawal.list.invalidate();
      utils.stockWithdrawal.countPending.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao confirmar baixa"),
  });

  const deleteMutation = trpc.stockWithdrawal.delete.useMutation({
    onSuccess: () => {
      toast.success("Solicitação apagada e registrada no histórico!");
      setDeleteId(null);
      setDeleteSenha("");
      utils.stockWithdrawal.list.invalidate();
      utils.stockWithdrawal.countPending.invalidate();
      utils.stockWithdrawal.monthlyStats.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao apagar"),
  });

  function handleDelete(id: number) {
    if (!deleteSenha.trim()) return toast.error("Digite sua senha para confirmar a exclusão");
    deleteMutation.mutate({ id, operatorName: operator?.name || "", senha: deleteSenha.trim() });
  }

  function handleApprove(id: number) {
    if (!approveSenha.trim()) return toast.error("Digite a senha da Larissa para aprovar");
    approveMutation.mutate({ id, senha: approveSenha.trim() });
  }

  function handleReject(id: number) {
    if (!rejectSenha.trim()) return toast.error("Digite a senha da Larissa para recusar");
    rejectMutation.mutate({ id, senha: rejectSenha.trim(), justificativa: rejectJustificativa || undefined });
  }

  function handleComplete(id: number) {
    if (!completeSenha.trim()) return toast.error("Digite a senha da Larissa para confirmar a baixa");
    completeMutation.mutate({ id, senha: completeSenha.trim() });
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
          Aguardando Aprovação da Larissa ({pendingList.length})
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
                actions={
                  <div className="mt-3 space-y-2">
                    {/* Approve flow */}
                    {approveId === req.id ? (
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                        <input
                          type="password"
                          value={approveSenha}
                          onChange={(e) => setApproveSenha(e.target.value)}
                          placeholder="Senha da Larissa"
                          className="flex-1 px-3 py-1.5 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={approveMutation.isPending}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
                        </button>
                        <button onClick={() => { setApproveId(null); setApproveSenha(""); }} className="px-2 py-1.5 text-slate-500 hover:text-slate-700">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : rejectId === req.id ? (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-red-600 shrink-0" />
                          <input
                            type="password"
                            value={rejectSenha}
                            onChange={(e) => setRejectSenha(e.target.value)}
                            placeholder="Senha da Larissa"
                            className="flex-1 px-3 py-1.5 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            autoFocus
                          />
                        </div>
                        <input
                          type="text"
                          value={rejectJustificativa}
                          onChange={(e) => setRejectJustificativa(e.target.value)}
                          placeholder="Justificativa (opcional)"
                          className="w-full px-3 py-1.5 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={rejectMutation.isPending}
                            className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
                            {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Recusa"}
                          </button>
                          <button onClick={() => { setRejectId(null); setRejectSenha(""); setRejectJustificativa(""); }} className="px-2 py-1.5 text-slate-500 hover:text-slate-700">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        {canApprove && (
                          <>
                            <button
                              onClick={() => { setApproveId(req.id); setRejectId(null); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" /> Aprovar
                            </button>
                            <button
                              onClick={() => { setRejectId(req.id); setApproveId(null); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" /> Recusar
                            </button>
                          </>
                        )}
                        {canDelete && (
                          deleteId === req.id ? (
                            <div className="flex items-center gap-2 ml-auto">
                              <input type="password" placeholder="Sua senha" value={deleteSenha} onChange={e => setDeleteSenha(e.target.value)} className="px-2 py-1 border rounded text-sm w-28" />
                              <button onClick={() => handleDelete(req.id)} disabled={deleteMutation.isPending} className="px-2 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">{deleteMutation.isPending ? "..." : "Confirmar"}</button>
                              <button onClick={() => { setDeleteId(null); setDeleteSenha(""); }} className="px-2 py-1 bg-slate-200 text-slate-600 text-sm rounded">Cancelar</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteId(req.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors ml-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Apagar
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Aprovadas aguardando baixa no Maxiprod */}
      {approvedList.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            Aprovadas — Aguardando Ação no Maxiprod ({approvedList.length})
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Larissa: faça a operação manualmente no Maxiprod e depois clique no botão para confirmar.
          </p>
          <div className="space-y-3">
            {approvedList.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                actions={
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {canApprove && (
                      <>
                        {completeId === req.id ? (
                          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg w-full">
                            <Lock className="w-4 h-4 text-blue-600 shrink-0" />
                            <input
                              type="password"
                              value={completeSenha}
                              onChange={(e) => setCompleteSenha(e.target.value)}
                              placeholder="Senha da Larissa"
                              className="flex-1 px-3 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleComplete(req.id)}
                              disabled={completeMutation.isPending}
                              className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
                            </button>
                            <button onClick={() => { setCompleteId(null); setCompleteSenha(""); }} className="px-2 py-1.5 text-slate-500 hover:text-slate-700">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setCompleteId(req.id)}
                            className="flex items-center gap-2.5 px-5 py-3 bg-amber-50 border-2 border-amber-400 text-amber-800 text-sm font-bold rounded-lg hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 transition-colors group cursor-pointer shadow-sm"
                          >
                            <span className="w-5 h-5 rounded border-2 border-amber-400 group-hover:border-emerald-500 flex items-center justify-center transition-colors shrink-0">
                            </span>
                            {req.motivo === "devolucao_retrabalho" ? "Acréscimo feito no Maxiprod" : "Baixa dada no Maxiprod"}
                          </button>
                        )}
                      </>
                    )}
                    {canDelete && (
                      deleteId === req.id ? (
                        <div className="flex items-center gap-2 ml-auto">
                          <input type="password" placeholder="Sua senha" value={deleteSenha} onChange={e => setDeleteSenha(e.target.value)} className="px-2 py-1 border rounded text-sm w-28" />
                          <button onClick={() => handleDelete(req.id)} disabled={deleteMutation.isPending} className="px-2 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">{deleteMutation.isPending ? "..." : "Confirmar"}</button>
                          <button onClick={() => { setDeleteId(null); setDeleteSenha(""); }} className="px-2 py-1 bg-slate-200 text-slate-600 text-sm rounded">Cancelar</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteId(req.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Apagar
                        </button>
                      )
                    )}
                  </div>
                }
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
  // Determinar tipo de movimentação: devolucao_retrabalho = ACRÉSCIMO, demais = BAIXA
  const isAcrescimo = request.motivo === "devolucao_retrabalho";
  const STATUS_CONFIG = isAcrescimo ? STATUS_CONFIG_ACRESCIMO : STATUS_CONFIG_BAIXA;
  const statusCfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.pendente;
  const StatusIcon = statusCfg.icon;
  const isOver24h = request.status === "aprovada" && request.dataAprovacao && (Date.now() - new Date(request.dataAprovacao).getTime() > 24 * 60 * 60 * 1000);
  const tipoLabel = isAcrescimo ? "ACRÉSCIMO" : "BAIXA";
  const tipoBg = isAcrescimo ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-red-100 text-red-800 border-red-300";
  const TipoIcon = isAcrescimo ? ArrowUp : ArrowDown;

  return (
    <div className={`bg-white rounded-xl border p-4 ${isOver24h ? "border-orange-300 ring-1 ring-orange-200" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border ${tipoBg}`}>
              <TipoIcon className="w-3.5 h-3.5" /> {tipoLabel}
            </span>
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
            {request.fiscalName && <span>Aprovado por: <span className="font-medium text-slate-600">{request.fiscalName}</span></span>}
          </div>
        </div>
      </div>
      {actions}
    </div>
  );
}

/* ─── Histórico Completo ─── */
function HistoricoList() {
  const { operator } = useOperator();
  const canDelete = ["Bruno", "Guilherme", "Fernando"].some(n => operator?.name?.toLowerCase().includes(n.toLowerCase()));
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteSenha, setDeleteSenha] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todas" | "pendente" | "aprovada" | "concluida" | "recusada">("todas");
  const [motivoFilter, setMotivoFilter] = useState<string>("todos");
  const { data: requests, isLoading } = trpc.stockWithdrawal.list.useQuery({ status: statusFilter, limit: 200 });
  const utils = trpc.useUtils();
  const deleteMutation = trpc.stockWithdrawal.delete.useMutation({
    onSuccess: () => {
      toast.success("Solicitação apagada e registrada no histórico!");
      setDeleteId(null);
      setDeleteSenha("");
      utils.stockWithdrawal.list.invalidate();
      utils.stockWithdrawal.countPending.invalidate();
      utils.stockWithdrawal.monthlyStats.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao apagar"),
  });

  function handleDelete(id: number) {
    if (!deleteSenha.trim()) return toast.error("Digite sua senha para confirmar a exclusão");
    deleteMutation.mutate({ id, operatorName: operator?.name || "", senha: deleteSenha.trim() });
  }

  // Filtrar por motivo no client-side
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    if (motivoFilter === "todos") return requests;
    return requests.filter((r) => r.motivo === motivoFilter);
  }, [requests, motivoFilter]);

  if (isLoading) return <div className="flex items-center gap-2 text-slate-500 py-8 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Carregando...</div>;

  return (
    <div className="space-y-4">
      {/* Filtro por Status */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-500" />
        <span className="text-xs text-slate-500 font-medium">Status:</span>
        {(["todas", "pendente", "aprovada", "concluida", "recusada"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${statusFilter === s ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            {s === "todas" ? "Todas" : STATUS_CONFIG_BAIXA[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Filtro por Motivo */}
      <div className="flex items-center gap-2 flex-wrap">
        <Package className="w-4 h-4 text-slate-500" />
        <span className="text-xs text-slate-500 font-medium">Motivo:</span>
        <button
          onClick={() => setMotivoFilter("todos")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${motivoFilter === "todos" ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
        >
          Todos
        </button>
        {(["consumo_pedido", "amostra", "reembalagem", "ajuste_inventario", "avaria_perda", "uso_interno", "devolucao_retrabalho", "outro"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMotivoFilter(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${motivoFilter === m ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            {MOTIVO_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Contador de resultados */}
      <div className="text-xs text-slate-500">
        {filteredRequests.length} solicitação(ões) encontrada(s)
      </div>

      {filteredRequests.length === 0 ? (
        <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-slate-200">
          Nenhuma solicitação encontrada
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <RequestCard key={req.id} request={req} actions={
              canDelete ? (
                <div className="mt-3 flex justify-end">
                  {deleteId === req.id ? (
                    <div className="flex items-center gap-2">
                      <input type="password" placeholder="Sua senha" value={deleteSenha} onChange={e => setDeleteSenha(e.target.value)} className="px-2 py-1 border rounded text-sm w-28" />
                      <button onClick={() => handleDelete(req.id)} disabled={deleteMutation.isPending} className="px-2 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">{deleteMutation.isPending ? "..." : "Confirmar"}</button>
                      <button onClick={() => { setDeleteId(null); setDeleteSenha(""); }} className="px-2 py-1 bg-slate-200 text-slate-600 text-sm rounded">Cancelar</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteId(req.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Apagar
                    </button>
                  )}
                </div>
              ) : undefined
            } />
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
    consumo_pedido: "bg-green-100 text-green-700",
    amostra: "bg-purple-100 text-purple-700",
    reembalagem: "bg-blue-100 text-blue-700",
    ajuste_inventario: "bg-amber-100 text-amber-700",
    avaria_perda: "bg-red-100 text-red-700",
    uso_interno: "bg-cyan-100 text-cyan-700",
    devolucao_retrabalho: "bg-orange-100 text-orange-700",
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
              const cfg = STATUS_CONFIG_BAIXA[s.status];
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
