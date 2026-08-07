/**
 * BonificacaoSection - Seção de bonificação no pedido de venda
 * Pergunta obrigatória: "Esse pedido vai com alguma bonificação?"
 * Se sim, permite selecionar produtos que afetam apenas peso/cubagem no frete
 */
import { useState } from "react";
import { Trash2, Gift, Search } from "lucide-react";

interface BonificacaoItem {
  codigoItem: string;
  descricaoItem: string;
  quantidade: number;
  pesoBrutoCaixa: number;
  dimsStr: string;
}

interface Product {
  codigoItem: string;
  descricaoItem: string;
  pesoBrutoCaixa?: number;
  dimsStr?: string;
}

interface BonificacaoSectionProps {
  temBonificacao: "" | "sim" | "nao";
  setTemBonificacao: (v: "" | "sim" | "nao") => void;
  itensBonificacao: BonificacaoItem[];
  setItensBonificacao: (v: BonificacaoItem[] | ((prev: BonificacaoItem[]) => BonificacaoItem[])) => void;
  products: Product[];
}

export type { BonificacaoItem };

export default function BonificacaoSection({
  temBonificacao,
  setTemBonificacao,
  itensBonificacao,
  setItensBonificacao,
  products,
}: BonificacaoSectionProps) {
  const [search, setSearch] = useState("");

  const filteredProducts = search.length >= 2
    ? products.filter(p =>
        p.descricaoItem.toLowerCase().includes(search.toLowerCase()) ||
        p.codigoItem.includes(search)
      ).slice(0, 10)
    : [];

  const totalCaixas = itensBonificacao.reduce((s, b) => s + b.quantidade, 0);
  const totalPeso = itensBonificacao.reduce((s, b) => s + b.pesoBrutoCaixa * b.quantidade, 0);
  const totalCubagem = itensBonificacao.reduce((s, b) => {
    const d = b.dimsStr.split("x").map(Number);
    return s + (d.length === 3 ? (d[0] * d[1] * d[2] / 1000000) * b.quantidade : 0.03 * b.quantidade);
  }, 0);

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
          <Gift className="w-4 h-4" />
          Esse pedido vai com alguma bonificação? <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setTemBonificacao("nao"); setItensBonificacao([]); }}
            className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${temBonificacao === "nao" ? "bg-green-600 text-white border-green-600" : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50"}`}
          >
            Não
          </button>
          <button
            type="button"
            onClick={() => setTemBonificacao("sim")}
            className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${temBonificacao === "sim" ? "bg-amber-600 text-white border-amber-600" : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50"}`}
          >
            Sim
          </button>
        </div>
      </div>
      {!temBonificacao && <p className="text-[8px] text-red-500">Resposta obrigatória</p>}

      {temBonificacao === "sim" && (
        <div className="space-y-2 pt-2 border-t border-amber-200 dark:border-amber-700">
          <p className="text-[10px] text-amber-700 dark:text-amber-400">
            Selecione os produtos que vão como bonificação (afeta apenas peso/cubagem no frete, não altera valor do pedido):
          </p>
          <div className="relative">
            <div className="flex items-center gap-1 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-slate-800 px-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto para bonificação..."
                className="w-full py-2 text-xs bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none"
              />
            </div>
            {filteredProducts.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {filteredProducts.map((p) => (
                  <button
                    key={p.codigoItem}
                    type="button"
                    onClick={() => {
                      if (!itensBonificacao.find(b => b.codigoItem === p.codigoItem)) {
                        setItensBonificacao(prev => [...prev, {
                          codigoItem: p.codigoItem,
                          descricaoItem: p.descricaoItem,
                          quantidade: 1,
                          pesoBrutoCaixa: p.pesoBrutoCaixa || 5,
                          dimsStr: p.dimsStr || "50x30x20",
                        }]);
                      }
                      setSearch("");
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50 dark:hover:bg-amber-900/30 border-b border-slate-100 dark:border-slate-700 last:border-0 cursor-pointer"
                  >
                    <span className="font-medium text-amber-700">{p.codigoItem}</span> - {p.descricaoItem}
                    {p.pesoBrutoCaixa && <span className="text-slate-400 ml-1">({p.pesoBrutoCaixa}kg/cx)</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {itensBonificacao.length > 0 && (
            <div className="space-y-1.5">
              {itensBonificacao.map((item, idx) => {
                const dims = item.dimsStr.split("x").map(Number);
                const cubagem = dims.length === 3 ? (dims[0] * dims[1] * dims[2] / 1000000) * item.quantidade : 0.03 * item.quantidade;
                return (
                  <div key={item.codigoItem} className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-600 rounded-lg p-2 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-slate-700 dark:text-slate-200 truncate">{item.codigoItem} - {item.descricaoItem}</p>
                      <p className="text-[9px] text-slate-500">Peso: {item.pesoBrutoCaixa}kg/cx | Dims: {item.dimsStr}cm | Cubagem: {cubagem.toFixed(4)} m³</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) => {
                          const qty = Math.max(1, Number(e.target.value) || 1);
                          setItensBonificacao(prev => prev.map((b, i) => i === idx ? { ...b, quantidade: qty } : b));
                        }}
                        className="w-14 px-1.5 py-1 text-xs text-center border border-amber-300 dark:border-amber-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                      />
                      <span className="text-[9px] text-slate-500">cx</span>
                      <button
                        type="button"
                        onClick={() => setItensBonificacao(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium pt-1 bg-amber-100 dark:bg-amber-900/40 rounded px-2 py-1">
                Total bonificação: {totalCaixas} cx | Peso: {totalPeso.toFixed(1)} kg | Cubagem: {totalCubagem.toFixed(4)} m³
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
