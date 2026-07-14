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
  Box, History, Layers, X, Check, Trash2,
} from "lucide-react";
import { useOperator } from "@/contexts/OperatorContext";

type Tab = "lancamento" | "estoque" | "historico";

export default function LotControl() {
  const [tab, setTab] = useState<Tab>("lancamento");

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
        <div className="flex gap-2">
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
        </div>
      </div>

      {tab === "lancamento" && <LancamentoLote />}
      {tab === "estoque" && <EstoqueLotes />}
      {tab === "historico" && <HistoricoLotes />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LANÇAMENTO DE LOTE
   ═══════════════════════════════════════════════════════════ */
function LancamentoLote() {
  const [codigoItem, setCodigoItem] = useState("");
  const [descricaoItem, setDescricaoItem] = useState("");
  const [notaCarga, setNotaCarga] = useState("");
  const [qtdProduzida, setQtdProduzida] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const { data: products, isLoading: loadingProducts } = trpc.production.getLotProducts.useQuery();
  const utils = trpc.useUtils();

  const createLot = trpc.production.createLot.useMutation({
    onSuccess: (data) => {
      toast.success(`Lote ${data.codigo} criado com sucesso!`);
      setCodigoItem("");
      setDescricaoItem("");
      setNotaCarga("");
      setQtdProduzida("");
      setPreview(null);
      utils.production.getAllLots.invalidate();
      utils.production.getLotsWithBalance.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

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
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const aa = String(today.getFullYear()).slice(-2);
    setPreview(`${codigoItem}-${dd}${mm}${aa}-${notaCarga}`);
  };

  const handleConfirm = () => {
    if (!preview) return;
    createLot.mutate({
      codigoItem,
      descricaoItem,
      notaCarga,
      qtdProduzida: parseFloat(qtdProduzida),
      lancadoPor: "Operador",
    });
  };

  return (
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

        {/* Data (automática) */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Data de Produção</label>
          <input
            type="text"
            value={new Date().toLocaleDateString("pt-BR")}
            disabled
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 text-slate-500"
          />
        </div>
      </div>

      {/* Preview & Confirm */}
      <div className="mt-5 flex items-center gap-3">
        {!preview ? (
          <button onClick={generatePreview}
            className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
            <Package className="w-4 h-4" /> Gerar Código do Lote
          </button>
        ) : (
          <div className="flex items-center gap-4 w-full">
            <div className="flex-1 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <div className="text-xs text-indigo-600 font-medium mb-0.5">Código do Lote:</div>
              <div className="text-lg font-bold text-indigo-800 font-mono">{preview}</div>
              <div className="text-xs text-slate-500 mt-1">{qtdProduzida} caixas · {descricaoItem}</div>
            </div>
            <button onClick={handleConfirm} disabled={createLot.isPending}
              className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50">
              {createLot.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirmar Lote
            </button>
            <button onClick={() => setPreview(null)}
              className="px-3 py-2.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg">
              Cancelar
            </button>
          </div>
        )}
      </div>
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
