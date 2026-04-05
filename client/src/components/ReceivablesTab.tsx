import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Landmark,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  X,
  Banknote,
  FileText,
  TrendingUp,
} from "lucide-react";

/* ---- Helpers ---- */
function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(d: string | null) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const BANK_COLORS: Record<string, { bg: string; border: string; icon: string; accent: string; bar: string }> = {
  SICOOB: { bg: "bg-green-50", border: "border-green-300", icon: "text-green-600", accent: "bg-green-600", bar: "bg-green-500" },
  SICREDI: { bg: "bg-emerald-50", border: "border-emerald-300", icon: "text-emerald-600", accent: "bg-emerald-600", bar: "bg-emerald-500" },
  BRADESCO: { bg: "bg-red-50", border: "border-red-300", icon: "text-red-600", accent: "bg-red-600", bar: "bg-red-500" },
  ITAU: { bg: "bg-orange-50", border: "border-orange-300", icon: "text-orange-600", accent: "bg-orange-600", bar: "bg-orange-500" },
  "BANCO DO BRASIL": { bg: "bg-yellow-50", border: "border-yellow-300", icon: "text-yellow-600", accent: "bg-yellow-600", bar: "bg-yellow-500" },
  CAIXA: { bg: "bg-blue-50", border: "border-blue-300", icon: "text-blue-600", accent: "bg-blue-600", bar: "bg-blue-500" },
  SANTANDER: { bg: "bg-red-50", border: "border-red-300", icon: "text-red-600", accent: "bg-red-600", bar: "bg-red-500" },
};
const DEFAULT_BANK_COLOR = { bg: "bg-slate-50", border: "border-slate-300", icon: "text-slate-600", accent: "bg-slate-600", bar: "bg-slate-500" };

function getBankColor(banco: string) {
  const upper = banco.toUpperCase();
  for (const [key, val] of Object.entries(BANK_COLORS)) {
    if (upper.includes(key)) return val;
  }
  return DEFAULT_BANK_COLOR;
}

const TIPO_LABELS: Record<string, string> = {
  TITULO: "Títulos / Boletos",
  RECEITA: "Receitas",
  ADIANTAMENTO: "Adiantamentos",
};

type ReceivableItem = {
  id: number;
  cliente: string;
  valorAReceber: number;
  valorOriginal: number;
  valorPago: number;
  vencimento: string;
  emissao: string;
  liquidacao: string | null;
  referenteA: string;
  tipo: string;
  estado: string;
  parcela: string;
  documento: string;
  empresa: string;
  banco: string;
  isOverdue: boolean;
};

export default function ReceivablesTab() {
  const [estado, setEstado] = useState<"EMITIDO" | "RECEBIDO" | "ALL">("EMITIDO");
  const [search, setSearch] = useState("");
  const [expandedBank, setExpandedBank] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [bancoFilter, setBancoFilter] = useState<string | null>(null);
  const [tipoFilter, setTipoFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"vencimento" | "valor" | "cliente">("vencimento");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data, isLoading } = trpc.financial.getReceivablesByBank.useQuery({ estado });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    let items = [...data.items];
    if (bancoFilter) items = items.filter(i => i.banco === bancoFilter);
    if (tipoFilter) items = items.filter(i => i.tipo === tipoFilter);
    if (search) {
      const s = search.toUpperCase();
      items = items.filter(i =>
        i.cliente.toUpperCase().includes(s) ||
        i.referenteA.toUpperCase().includes(s) ||
        i.documento.toUpperCase().includes(s)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    items.sort((a, b) => {
      if (sortBy === "vencimento") return a.vencimento.localeCompare(b.vencimento) * dir;
      if (sortBy === "valor") return (a.valorAReceber - b.valorAReceber) * dir;
      return a.cliente.localeCompare(b.cliente) * dir;
    });
    return items;
  }, [data, search, bancoFilter, tipoFilter, sortBy, sortDir]);

  const itemsByBank = useMemo(() => {
    const map: Record<string, ReceivableItem[]> = {};
    for (const item of filteredItems) {
      if (!map[item.banco]) map[item.banco] = [];
      map[item.banco].push(item);
    }
    return map;
  }, [filteredItems]);

  function toggleSort(field: typeof sortBy) {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("asc"); }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-96 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const { byBank = [], byType = [], totals = { total: 0, count: 0 } } = data || {};
  const maxBankTotal = Math.max(...byBank.map(b => b.total), 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Controle de Recebíveis
          </h2>
          <p className="text-sm text-slate-500">
            {totals.count} títulos · Total: <span className="font-semibold text-slate-700">{formatCurrency(totals.total)}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {(["EMITIDO", "RECEBIDO", "ALL"] as const).map(e => (
            <button
              key={e}
              onClick={() => setEstado(e)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                estado === e ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              {e === "EMITIDO" ? "A Receber" : e === "RECEBIDO" ? "Recebidos" : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {/* Cards por Banco */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {byBank.map(bank => {
          const colors = getBankColor(bank.banco);
          const isActive = bancoFilter === bank.banco;
          const pctVencido = bank.total > 0 ? (bank.vencido / bank.total) * 100 : 0;
          const barWidth = (bank.total / maxBankTotal) * 100;

          return (
            <button
              key={bank.banco}
              onClick={() => {
                setBancoFilter(isActive ? null : bank.banco);
                setExpandedBank(isActive ? null : bank.banco);
              }}
              className={`rounded-xl border-2 p-4 text-left transition-all hover:shadow-lg ${colors.bg} ${
                isActive ? `${colors.border} ring-2 ring-offset-1 ring-blue-400 shadow-lg` : `${colors.border}`
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white/80 shadow-sm`}>
                    <Landmark className={`w-5 h-5 ${colors.icon}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">{bank.banco}</h3>
                    <span className="text-xs text-slate-500">{bank.count} títulos</span>
                  </div>
                </div>
                {isActive && <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />}
              </div>

              <div className="text-2xl font-bold text-slate-800 mb-3">{formatCurrency(bank.total)}</div>

              {/* Barra de proporção vencido/a vencer */}
              <div className="w-full h-2.5 rounded-full bg-white/60 overflow-hidden mb-2.5">
                <div className="h-full flex">
                  {pctVencido > 0 && <div className="bg-red-400 h-full transition-all" style={{ width: `${pctVencido}%` }} />}
                  <div className={`${colors.bar} h-full transition-all`} style={{ width: `${100 - pctVencido}%` }} />
                </div>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Vencido: {formatCurrency(bank.vencido)}
                </span>
                <span className={`${colors.icon} flex items-center gap-1`}>
                  <Clock className="w-3 h-3" />
                  A vencer: {formatCurrency(bank.aVencer)}
                </span>
              </div>

              {/* Barra relativa ao maior banco */}
              <div className="mt-3 w-full h-1.5 rounded-full bg-white/40 overflow-hidden">
                <div className={`${colors.bar} h-full rounded-full transition-all`} style={{ width: `${barWidth}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Cards por Tipo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {byType.map(t => {
          const isActive = tipoFilter === t.tipo;
          return (
            <button
              key={t.tipo}
              onClick={() => setTipoFilter(isActive ? null : t.tipo)}
              className={`rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                isActive ? "bg-blue-50 border-blue-300 ring-1 ring-blue-400" : "bg-white border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Banknote className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                <span className="text-xs font-semibold text-slate-500 uppercase">{TIPO_LABELS[t.tipo] || t.tipo}</span>
              </div>
              <div className="text-lg font-bold text-slate-800">{formatCurrency(t.total)}</div>
              <div className="text-xs text-slate-500">{t.count} títulos</div>
            </button>
          );
        })}
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, documento ou referência..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {(bancoFilter || tipoFilter) && (
          <button
            onClick={() => { setBancoFilter(null); setTipoFilter(null); setExpandedBank(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Lista de recebíveis por banco */}
      <div className="space-y-3">
        {Object.entries(itemsByBank)
          .sort(([, a], [, b]) => {
            const totalA = a.reduce((s, i) => s + i.valorAReceber, 0);
            const totalB = b.reduce((s, i) => s + i.valorAReceber, 0);
            return totalB - totalA;
          })
          .map(([banco, items]) => {
            const colors = getBankColor(banco);
            const total = items.reduce((s, i) => s + i.valorAReceber, 0);
            const vencidos = items.filter(i => i.isOverdue);
            const totalVencido = vencidos.reduce((s, i) => s + i.valorAReceber, 0);
            const isOpen = expandedBank === banco || bancoFilter === banco;

            return (
              <div key={banco} className={`rounded-xl border-2 overflow-hidden transition-all ${isOpen ? colors.border : "border-slate-200"}`}>
                {/* Header do banco */}
                <button
                  onClick={() => setExpandedBank(isOpen && !bancoFilter ? null : banco)}
                  className={`w-full px-4 py-3 flex items-center justify-between ${colors.bg} hover:brightness-[0.97] transition-all cursor-pointer`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/80 shadow-sm flex items-center justify-center">
                      <Landmark className={`w-4 h-4 ${colors.icon}`} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-sm text-slate-800">{banco}</h3>
                      <span className="text-xs text-slate-500">
                        {items.length} títulos
                        {vencidos.length > 0 && <span className="text-red-500 ml-1">· {vencidos.length} vencidos ({formatCurrency(totalVencido)})</span>}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-800">{formatCurrency(total)}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {/* Detalhes do banco */}
                {isOpen && (
                  <div className="bg-white">
                    {/* Header da tabela */}
                    <div className="hidden md:grid grid-cols-[1fr_120px_100px_80px_80px] gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <button onClick={() => toggleSort("cliente")} className="flex items-center gap-1 hover:text-slate-700">
                        Cliente / Referência
                        {sortBy === "cliente" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </button>
                      <button onClick={() => toggleSort("valor")} className="flex items-center gap-1 hover:text-slate-700 justify-end">
                        Valor
                        {sortBy === "valor" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </button>
                      <button onClick={() => toggleSort("vencimento")} className="flex items-center gap-1 hover:text-slate-700">
                        Vencimento
                        {sortBy === "vencimento" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </button>
                      <div>Tipo</div>
                      <div className="text-center">Status</div>
                    </div>

                    {/* Lista de itens */}
                    <div className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto">
                      {items.map(item => (
                        <div key={item.id}>
                          <div
                            onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                            className={`grid grid-cols-1 md:grid-cols-[1fr_120px_100px_80px_80px] gap-2 px-4 py-2.5 cursor-pointer transition-colors items-center ${
                              item.isOverdue ? "hover:bg-red-50/50 bg-red-50/20" : "hover:bg-slate-50"
                            }`}
                          >
                            {/* Cliente */}
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-slate-800 truncate">{item.cliente}</div>
                              <div className="text-xs text-slate-500 truncate">
                                {item.referenteA}
                                {item.documento && ` · ${item.documento}`}
                                {item.parcela && ` · ${item.parcela}`}
                              </div>
                            </div>

                            {/* Valor */}
                            <div className="text-right">
                              <span className={`font-bold text-sm ${item.isOverdue ? "text-red-600" : "text-slate-800"}`}>
                                {formatCurrency(item.valorAReceber)}
                              </span>
                              {item.valorPago > 0 && (
                                <div className="text-[10px] text-green-600">Pago: {formatCurrency(item.valorPago)}</div>
                              )}
                            </div>

                            {/* Vencimento */}
                            <div className={`text-sm ${item.isOverdue ? "text-red-600 font-medium" : "text-slate-600"}`}>
                              {formatDate(item.vencimento)}
                            </div>

                            {/* Tipo */}
                            <div>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {item.tipo === "TITULO" ? "Título" : item.tipo === "RECEITA" ? "Receita" : item.tipo}
                              </span>
                            </div>

                            {/* Status */}
                            <div className="text-center">
                              {item.isOverdue ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                                  <AlertTriangle className="w-3 h-3" /> Vencido
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                                  <Clock className="w-3 h-3" /> A vencer
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Detalhes expandidos */}
                          {expandedItem === item.id && (
                            <div className="px-4 pb-3 bg-slate-50/50">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-white rounded-lg border border-slate-100">
                                <DetailItem label="Valor Original" value={formatCurrency(item.valorOriginal)} />
                                <DetailItem label="Valor Pago" value={formatCurrency(item.valorPago)} />
                                <DetailItem label="Emissão" value={formatDate(item.emissao)} />
                                <DetailItem label="Empresa" value={item.empresa || "-"} />
                                <DetailItem label="Banco" value={item.banco} />
                                <DetailItem label="Tipo" value={TIPO_LABELS[item.tipo] || item.tipo} />
                                <DetailItem label="Estado" value={item.estado} />
                                {item.liquidacao && <DetailItem label="Liquidação" value={formatDate(item.liquidacao)} />}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400 uppercase">{label}</div>
      <div className="text-sm font-medium text-slate-700">{value}</div>
    </div>
  );
}
