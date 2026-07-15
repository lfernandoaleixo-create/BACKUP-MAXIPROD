/**
 * Controle de Lotes - Módulo de rastreabilidade de produção
 * - Lançamento de Lote (líder no tablet)
 * - Estoque de Lotes (saldo > 0)
 * - Histórico (busca por lote ou cliente)
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Package, Plus, Search, Loader2, ChevronDown, ChevronRight,
  Box, History, Layers, X, Check, Trash2, Send, Clock, CheckCircle2, XCircle, Shield,
} from "lucide-react";
import { useOperator } from "@/contexts/OperatorContext";

type Tab = "lancamento" | "estoque" | "historico" | "autorizacoes";

export default function LotControl() {
  const [tab, setTab] = useState<Tab>("lancamento");
  const { operator } = useOperator();
  const isApprover = operator?.name === "Bruno" || operator?.name === "Guilherme" || operator?.name === "Fernando";
  const { data: pendingCount } = trpc.production.countPendingRetroactive.useQuery(undefined, {
    enabled: isApprover,
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Layers className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Controle de Lotes</h2>
            <p className="text-xs text-slate-500">Rastreabilidade de produção por lote</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTab("lancamento")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "lancamento" ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Plus className="w-4 h-4" /> Lançamento
          </button>
          <button
            onClick={() => setTab("estoque")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "estoque" ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Box className="w-4 h-4" /> Estoque
          </button>
          <button
            onClick={() => setTab("historico")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "historico" ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <History className="w-4 h-4" /> Histórico
          </button>
          {isApprover && (
            <button
              onClick={() => setTab("autorizacoes")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                tab === "autorizacoes" ? "bg-amber-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              } ${(pendingCount?.pending ?? 0) > 0 && tab !== "autorizacoes" ? "animate-discount-blink" : ""}`}
            >
              <Shield className="w-4 h-4" /> Autorizações
              {(pendingCount?.pending ?? 0) > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingCount!.pending}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {tab === "lancamento" && <LancamentoLote />}
      {tab === "estoque" && <EstoqueLotes />}
      {tab === "historico" && <HistoricoLotes />}
      {tab === "autorizacoes" && isApprover && <AutorizacoesRetroativas />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LANÇAMENTO DE LOTE
   ═══════════════════════════════════════════════════════════ */
function LancamentoLote() {
  const { operator } = useOperator();
  const [codigoItem, setCodigoItem] = useState("");
  const [descricaoItem, setDescricaoItem] = useState("");
  const [notaCarga, setNotaCarga] = useState("");
  const [qtdProduzida, setQtdProduzida] = useState("");
  const [dataProducao, setDataProducao] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [searchProduct, setSearchProduct] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [showRetroModal, setShowRetroModal] = useState(false);
  const [motivo, setMotivo] = useState("");

  const { data: products, isLoading: loadingProducts } = trpc.production.getLotProducts.useQuery();
  const { data: myRequests } = trpc.production.myRetroactiveRequests.useQuery(
    { solicitanteNome: operator?.name || "" },
    { enabled: !!operator?.name }
  );
  const utils = trpc.useUtils();

  const createLot = trpc.production.createLot.useMutation({
    onSuccess: (data) => {
      toast.success(`Lote ${data.codigo} criado com sucesso!`);
      resetForm();
      utils.production.getAllLots.invalidate();
      utils.production.getLotsWithBalance.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const requestRetroactive = trpc.production.requestRetroactiveLot.useMutation({
    onSuccess: (data) => {
      toast.success(`Solicitação enviada! Lote ${data.codigoLotePreview} aguardando autorização de Bruno ou Guilherme.`);
      resetForm();
      setShowRetroModal(false);
      setMotivo("");
      utils.production.myRetroactiveRequests.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setCodigoItem("");
    setDescricaoItem("");
    setNotaCarga("");
    setQtdProduzida("");
    setDataProducao(new Date().toISOString().slice(0, 10));
    setPreview(null);
  };

  // Detectar se a data é retroativa (anterior a hoje)
  const todayStr = new Date().toISOString().slice(0, 10);
  const isRetroactive = dataProducao < todayStr;

  const filteredProducts = useMemo(() => {
    if (!products || !searchProduct) return products || [];
    const q = searchProduct.toLowerCase();
    return products.filter(p =>
      p.codigoItem.toLowerCase().includes(q) ||
      p.descricaoItem.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [products, searchProduct]);

  const generatePreview = () => {
    if (!codigoItem || !notaCarga || !qtdProduzida) {
      toast.error("Preencha todos os campos");
      return;
    }
    const [year, month, day] = dataProducao.split("-");
    const dd = day;
    const mm = month;
    const aa = year.slice(-2);
    setPreview(`${codigoItem}-${dd}${mm}${aa}-${notaCarga}`);
  };

  const handleConfirm = () => {
    if (!preview) return;
    if (isRetroactive) {
      // Mostrar modal de solicitação
      setShowRetroModal(true);
    } else {
      createLot.mutate({
        codigoItem,
        descricaoItem,
        notaCarga,
        qtdProduzida: parseFloat(qtdProduzida),
        lancadoPor: operator?.name || "Operador",
      });
    }
  };

  const handleSendRequest = () => {
    requestRetroactive.mutate({
      solicitanteNome: operator?.name || "Operador",
      codigoItem,
      descricaoItem,
      notaCarga,
      qtdProduzida: parseFloat(qtdProduzida),
      dataProducao,
      motivo: motivo || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-indigo-500" /> Lançamento de Novo Lote
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SKU Dropdown */}
          <div className="relative">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Produto (SKU)</label>
            <input
              type="text"
              value={codigoItem ? `${codigoItem} - ${descricaoItem}` : searchProduct}
              onChange={(e) => {
                setSearchProduct(e.target.value);
                setCodigoItem("");
                setDescricaoItem("");
                setShowDropdown(true);
                setPreview(null);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Buscar produto..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {codigoItem && (
              <button onClick={() => { setCodigoItem(""); setDescricaoItem(""); setSearchProduct(""); setPreview(null); }}
                className="absolute right-2 top-7 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
            {showDropdown && !codigoItem && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {loadingProducts ? (
                  <div className="p-3 text-center text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Carregando...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-3 text-center text-sm text-slate-400">Nenhum produto encontrado</div>
                ) : (
                  filteredProducts.map(p => (
                    <button key={p.codigoItem}
                      onClick={() => { setCodigoItem(p.codigoItem); setDescricaoItem(p.descricaoItem); setShowDropdown(false); setSearchProduct(""); setPreview(null); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                    >
                      <span className="font-medium text-indigo-700">{p.codigoItem}</span>
                      <span className="text-slate-500 ml-2">{p.descricaoItem}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Nota da Carga */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Nota da Carga</label>
            <input
              type="text"
              value={notaCarga}
              onChange={(e) => { setNotaCarga(e.target.value); setPreview(null); }}
              placeholder="Ex: 12345"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Quantidade */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Caixas Produzidas</label>
            <input
              type="number"
              value={qtdProduzida}
              onChange={(e) => { setQtdProduzida(e.target.value); setPreview(null); }}
              placeholder="0"
              min="1"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Data de Produção (editável) */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Data de Produção</label>
            <input
              type="date"
              value={dataProducao}
              onChange={(e) => { setDataProducao(e.target.value); setPreview(null); }}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                isRetroactive ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200"
              }`}
            />
            {isRetroactive && (
              <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Data retroativa: requer autorização
              </p>
            )}
          </div>
        </div>

        {/* Preview & Confirm */}
        <div className="mt-5 flex items-center gap-3">
          {!preview ? (
            <button onClick={generatePreview}
              className={`px-4 py-2.5 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                isRetroactive ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700"
              }`}>
              <Package className="w-4 h-4" /> {isRetroactive ? "Solicitar Autorização" : "Gerar Código do Lote"}
            </button>
          ) : (
            <div className="flex items-center gap-4 w-full">
              <div className={`flex-1 rounded-lg p-3 border ${
                isRetroactive ? "bg-amber-50 border-amber-200" : "bg-indigo-50 border-indigo-200"
              }`}>
                <div className={`text-xs font-medium mb-0.5 ${isRetroactive ? "text-amber-600" : "text-indigo-600"}`}>
                  {isRetroactive ? "Lote Retroativo (requer autorização):" : "Código do Lote:"}
                </div>
                <div className={`text-lg font-bold font-mono ${isRetroactive ? "text-amber-800" : "text-indigo-800"}`}>{preview}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {qtdProduzida} caixas · {descricaoItem} · {dataProducao.split("-").reverse().join("/")}
                </div>
              </div>
              <button onClick={handleConfirm} disabled={createLot.isPending || requestRetroactive.isPending}
                className={`px-4 py-2.5 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${
                  isRetroactive ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}>
                {(createLot.isPending || requestRetroactive.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : isRetroactive ? <Send className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                {isRetroactive ? "Enviar Solicitação" : "Confirmar Lote"}
              </button>
              <button onClick={() => setPreview(null)}
                className="px-3 py-2.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg">
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Solicitação Retroativa */}
      {showRetroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRetroModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Solicitação de Lote Retroativo</h3>
                <p className="text-xs text-slate-500">Será enviada para análise de Bruno ou Guilherme</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="text-xs text-amber-700 font-medium">Lote:</div>
              <div className="text-base font-bold font-mono text-amber-800">{preview}</div>
              <div className="text-xs text-slate-600 mt-1">
                {qtdProduzida} caixas · {descricaoItem} · Data: {dataProducao.split("-").reverse().join("/")}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Motivo (opcional)</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Produção realizada ontem mas não foi lançada no sistema..."
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSendRequest}
                disabled={requestRetroactive.isPending}
                className="flex-1 px-4 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {requestRetroactive.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar Solicitação
              </button>
              <button
                onClick={() => setShowRetroModal(false)}
                className="px-4 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minhas Solicitações Retroativas */}
      {myRequests && myRequests.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-500" /> Minhas Solicitações Retroativas
          </h4>
          <div className="space-y-2">
            {myRequests.slice(0, 5).map((req: any) => (
              <div key={req.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${
                req.status === "pendente" ? "bg-amber-50 border-amber-200" :
                req.status === "aprovado" ? "bg-emerald-50 border-emerald-200" :
                "bg-red-50 border-red-200"
              }`}>
                <div>
                  <div className="text-xs font-mono font-medium text-slate-700">{req.codigoLotePreview}</div>
                  <div className="text-[10px] text-slate-500">
                    {req.descricaoItem?.slice(0, 40)} · {req.dataProducao.split("-").reverse().join("/")}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {req.status === "pendente" && (
                    <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Aguardando
                    </span>
                  )}
                  {req.status === "aprovado" && (
                    <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Aprovado por {req.aprovadorNome}
                    </span>
                  )}
                  {req.status === "recusado" && (
                    <span className="text-[10px] font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Recusado{req.aprovadorNome ? ` por ${req.aprovadorNome}` : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ESTOQUE DE LOTES
   ═══════════════════════════════════════════════════════════ */
function EstoqueLotes() {
  const [filterSku, setFilterSku] = useState("");
  const { data: lots, isLoading, refetch: refetchLots } = trpc.production.getAllLots.useQuery({ onlyWithBalance: true, codigoItem: filterSku || undefined });
  const { data: products } = trpc.production.getLotProducts.useQuery();
  const [expandedLot, setExpandedLot] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <Box className="w-4 h-4 text-emerald-500" /> Estoque de Lotes (saldo &gt; 0)
        </h3>
        <select
          value={filterSku}
          onChange={(e) => setFilterSku(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">Todos os SKUs</option>
          {products?.map(p => (
            <option key={p.codigoItem} value={p.codigoItem}>{p.codigoItem} - {p.descricaoItem.slice(0, 40)}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <span className="ml-2 text-sm text-slate-500">Carregando lotes...</span>
        </div>
      ) : !lots || lots.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400">
          <Box className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          Nenhum lote com saldo disponível
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Código</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Produto</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Data Prod.</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Nota</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Produzido</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Saldo</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lots.map(lot => (
                <LotRow key={lot.id} lot={lot} expanded={expandedLot === lot.id} onToggle={() => setExpandedLot(expandedLot === lot.id ? null : lot.id)} onDeleted={() => { setExpandedLot(null); refetchLots(); }} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LotRow({ lot, expanded, onToggle, onDeleted }: { lot: any; expanded: boolean; onToggle: () => void; onDeleted: () => void }) {
  const { operator } = useOperator();
  const { data: movements } = trpc.production.getLotMovements.useQuery(
    { lotId: lot.id },
    { enabled: expanded }
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteMutation = trpc.production.deleteLot.useMutation({
    onSuccess: (data) => {
      toast.success(`Lote ${data.deletedLot} apagado com sucesso`);
      setConfirmDelete(false);
      onDeleted();
    },
    onError: (err) => {
      toast.error(`Erro ao apagar lote: ${err.message}`);
    },
  });

  const saldo = parseFloat(String(lot.saldoAtual));
  const produzido = parseFloat(String(lot.qtdProduzida));
  const pct = produzido > 0 ? ((produzido - saldo) / produzido) * 100 : 0;

  return (
    <>
      <tr className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-2.5 font-mono text-xs font-medium text-indigo-700">{lot.codigo}</td>
        <td className="px-4 py-2.5 text-slate-700 text-xs">{lot.descricaoItem.slice(0, 50)}</td>
        <td className="px-4 py-2.5 text-center text-slate-600 text-xs">{lot.dataProducao.split("-").reverse().join("/")}</td>
        <td className="px-4 py-2.5 text-center text-slate-600 text-xs">{lot.notaCarga}</td>
        <td className="px-4 py-2.5 text-right font-medium text-slate-700 tabular-nums text-xs">{produzido}</td>
        <td className="px-4 py-2.5 text-right">
          <span className={`font-bold tabular-nums text-xs ${saldo <= produzido * 0.2 ? "text-red-600" : saldo <= produzido * 0.5 ? "text-amber-600" : "text-emerald-600"}`}>
            {saldo}
          </span>
        </td>
        <td className="px-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-slate-50 px-6 py-3">
            <div className="mb-2">
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{pct.toFixed(0)}% consumido</div>
            </div>
            {!movements || movements.length === 0 ? (
              <div className="text-xs text-slate-400">Nenhuma movimentação registrada</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500">
                    <th className="text-left py-1">Cliente</th>
                    <th className="text-left py-1">Pedido</th>
                    <th className="text-right py-1">Qtd</th>
                    <th className="text-right py-1">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m: any) => (
                    <tr key={m.id}>
                      <td className="py-1 text-slate-700">{m.cliente}</td>
                      <td className="py-1 text-slate-500">{m.pedido || "-"}</td>
                      <td className="py-1 text-right font-medium text-slate-700 tabular-nums">{parseFloat(String(m.qtdEnviada))}</td>
                      <td className="py-1 text-right text-slate-500">{m.dataEnvio.split("-").reverse().join("/")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Botão Apagar Lote */}
            <div className="mt-3 pt-3 border-t border-slate-200">
              {!confirmDelete ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-md transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Apagar Lote
                </button>
              ) : (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <span className="text-xs text-red-700 font-medium flex-1">
                    Tem certeza? Isso apagará o lote, movimentações e atribuições vinculadas.
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate({ lotId: lot.id, operador: operator?.name || "Gestor" });
                    }}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-md disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Confirmar
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                    className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-md hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   HISTÓRICO DE LOTES
   ═══════════════════════════════════════════════════════════ */
function HistoricoLotes() {
  const [searchType, setSearchType] = useState<"lote" | "cliente">("lote");
  const [searchTerm, setSearchTerm] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const { data: movements, isLoading } = trpc.production.getLotMovements.useQuery(
    {
      codigoLote: searchType === "lote" && searchTerm ? searchTerm : undefined,
      cliente: searchType === "cliente" && searchTerm ? searchTerm : undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
    },
    { enabled: searchTerm.length >= 2 }
  );

  const { data: allLots } = trpc.production.getAllLots.useQuery(
    { search: searchType === "lote" && searchTerm ? searchTerm : undefined },
    { enabled: searchType === "lote" && searchTerm.length >= 2 }
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
        <History className="w-4 h-4 text-violet-500" /> Histórico de Movimentações
      </h3>

      {/* Search Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Buscar por</label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button onClick={() => { setSearchType("lote"); setSearchTerm(""); }}
              className={`px-3 py-2 text-xs font-medium ${searchType === "lote" ? "bg-indigo-600 text-white" : "bg-white text-slate-600"}`}>
              Lote
            </button>
            <button onClick={() => { setSearchType("cliente"); setSearchTerm(""); }}
              className={`px-3 py-2 text-xs font-medium ${searchType === "cliente" ? "bg-indigo-600 text-white" : "bg-white text-slate-600"}`}>
              Cliente
            </button>
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-500 mb-1 block">
            {searchType === "lote" ? "Código do Lote" : "Nome do Cliente"}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchType === "lote" ? "Ex: 00123-130726-NF456" : "Ex: Restaurante..."}
              className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">De</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Até</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
      </div>

      {/* Results */}
      {searchTerm.length < 2 ? (
        <div className="text-center py-8 text-sm text-slate-400">
          <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          Digite pelo menos 2 caracteres para buscar
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* If searching by lot, show lot info first */}
          {searchType === "lote" && allLots && allLots.length > 0 && (
            <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
              <div className="text-xs font-medium text-indigo-600 mb-2">Lotes encontrados:</div>
              {allLots.map(lot => (
                <div key={lot.id} className="flex items-center justify-between py-1.5 border-b border-indigo-100 last:border-0">
                  <div>
                    <span className="font-mono text-xs font-medium text-indigo-800">{lot.codigo}</span>
                    <span className="text-xs text-slate-500 ml-2">{lot.descricaoItem.slice(0, 40)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">Produzido: {parseFloat(String(lot.qtdProduzida))}</span>
                    <span className="mx-2">|</span>
                    <span className="font-medium text-emerald-600">Saldo: {parseFloat(String(lot.saldoAtual))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Movements table */}
          {!movements || movements.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400">Nenhuma movimentação encontrada</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Lote</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Cliente</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Pedido</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Qtd</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-mono text-xs text-indigo-700">{m.codigoLote}</td>
                      <td className="px-4 py-2.5 text-slate-700">{m.cliente}</td>
                      <td className="px-4 py-2.5 text-slate-500">{m.pedido || "-"}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">{parseFloat(String(m.qtdEnviada))}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{m.dataEnvio.split("-").reverse().join("/")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   AUTORIZAÇÕES RETROATIVAS (Bruno/Guilherme/Fernando)
   ═══════════════════════════════════════════════════════════ */
function AutorizacoesRetroativas() {
  const { operator } = useOperator();
  const [motivoRecusa, setMotivoRecusa] = useState<Record<number, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<number | null>(null);

  const { data: pending, isLoading: loadingPending } = trpc.production.listPendingRetroactive.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const { data: history, isLoading: loadingHistory } = trpc.production.retroactiveHistory.useQuery({});
  const utils = trpc.useUtils();

  const approveMut = trpc.production.approveRetroactiveLot.useMutation({
    onSuccess: (data) => {
      toast.success(`Lote ${data.codigoLote} aprovado e criado com sucesso!`);
      utils.production.listPendingRetroactive.invalidate();
      utils.production.countPendingRetroactive.invalidate();
      utils.production.retroactiveHistory.invalidate();
      utils.production.getAllLots.invalidate();
      utils.production.getLotsWithBalance.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMut = trpc.production.rejectRetroactiveLot.useMutation({
    onSuccess: () => {
      toast.success("Solicitação recusada.");
      setShowRejectInput(null);
      utils.production.listPendingRetroactive.invalidate();
      utils.production.countPendingRetroactive.invalidate();
      utils.production.retroactiveHistory.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      {/* Pendentes */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-500" /> Solicitações Pendentes
        </h3>

        {loadingPending ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
            <span className="ml-2 text-sm text-slate-500">Carregando...</span>
          </div>
        ) : !pending || pending.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
            Nenhuma solicitação pendente
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((req: any) => (
              <div key={req.id} className="border border-amber-200 bg-amber-50 rounded-lg p-4 animate-pulse-slow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        PENDENTE
                      </span>
                      <span className="text-xs text-slate-500">
                        Solicitado por <span className="font-medium text-slate-700">{req.solicitanteNome}</span>
                      </span>
                    </div>
                    <div className="font-mono text-base font-bold text-slate-800 mb-1">{req.codigoLotePreview}</div>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      <div>Produto: <span className="font-medium">{req.codigoItem}</span> - {req.descricaoItem?.slice(0, 50)}</div>
                      <div>Quantidade: <span className="font-medium">{parseFloat(String(req.qtdProduzida))} caixas</span></div>
                      <div>Data retroativa: <span className="font-medium text-amber-700">{req.dataProducao.split("-").reverse().join("/")}</span></div>
                      <div>Nota da Carga: <span className="font-medium">{req.notaCarga}</span></div>
                      {req.motivo && <div className="mt-1 italic text-slate-500">Motivo: "{req.motivo}"</div>}
                      <div className="text-[10px] text-slate-400 mt-1">
                        Solicitado em: {new Date(req.createdAt).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => approveMut.mutate({ requestId: req.id, aprovadorNome: operator?.name || "Gestor" })}
                      disabled={approveMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {approveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Autorizar
                    </button>
                    {showRejectInput === req.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Motivo (opcional)"
                          value={motivoRecusa[req.id] || ""}
                          onChange={(e) => setMotivoRecusa(prev => ({ ...prev, [req.id]: e.target.value }))}
                          className="w-full text-xs border border-red-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => rejectMut.mutate({ requestId: req.id, aprovadorNome: operator?.name || "Gestor", motivoRecusa: motivoRecusa[req.id] || undefined })}
                            disabled={rejectMut.isPending}
                            className="flex-1 text-[10px] font-bold text-white bg-red-600 rounded-md px-2 py-1.5 hover:bg-red-700 disabled:opacity-50"
                          >
                            Confirmar Recusa
                          </button>
                          <button
                            onClick={() => setShowRejectInput(null)}
                            className="text-[10px] text-slate-500 px-2 py-1.5 hover:bg-slate-100 rounded-md"
                          >
                            Voltar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowRejectInput(req.id)}
                        className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Recusar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-violet-500" /> Histórico de Autorizações
        </h3>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : !history || history.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400">Nenhum registro no histórico</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase">Lote</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase">Solicitante</th>
                  <th className="text-center px-3 py-2 font-semibold text-slate-500 uppercase">Data Retro</th>
                  <th className="text-center px-3 py-2 font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase">Aprovador</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase">Data Decisão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h: any) => (
                  <tr key={h.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-mono font-medium text-slate-700">{h.codigoLotePreview}</td>
                    <td className="px-3 py-2 text-slate-600">{h.solicitanteNome}</td>
                    <td className="px-3 py-2 text-center text-slate-600">{h.dataProducao.split("-").reverse().join("/")}</td>
                    <td className="px-3 py-2 text-center">
                      {h.status === "aprovado" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Aprovado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded-full font-medium">
                          <XCircle className="w-3 h-3" /> Recusado
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{h.aprovadorNome || "-"}</td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {h.dataDecisao ? new Date(h.dataDecisao).toLocaleString("pt-BR") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
