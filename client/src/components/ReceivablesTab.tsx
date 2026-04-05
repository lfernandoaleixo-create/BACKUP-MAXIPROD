import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  Landmark,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
  X,
  Banknote,
  FileText,
  TrendingUp,
  Calendar,
  CreditCard,
  Receipt,
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
function formatMonth(mes: string) {
  const [y, m] = mes.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function shortBankName(nome: string) {
  if (nome.toUpperCase().includes("SICREDI")) return "Sicredi";
  if (nome.toUpperCase().includes("SICOOB") || nome.toUpperCase().includes("BANCOOB")) return "Sicoob";
  if (nome.toUpperCase().includes("CAIXA")) return "Caixa";
  if (nome.toUpperCase().includes("BRADESCO")) return "Bradesco";
  if (nome.toUpperCase().includes("ITAU") || nome.toUpperCase().includes("ITAÚ")) return "Itaú";
  if (nome.toUpperCase().includes("BANCO DO BRASIL")) return "BB";
  if (nome === "Sem Banco") return "Sem Banco";
  return nome;
}

function shortEmpresaName(nome: string) {
  if (nome.toUpperCase().includes("PALITOS")) return "PALITOS";
  if (nome.toUpperCase().includes("VARETAS")) return "VARETAS";
  if (nome.toUpperCase().includes("ESPETOS")) return "ESPETOS";
  return nome;
}

const EMPRESA_COLORS: Record<string, { bg: string; border: string; text: string; accent: string; light: string }> = {
  PALITOS: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700", accent: "bg-blue-600", light: "bg-blue-100" },
  VARETAS: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", accent: "bg-amber-600", light: "bg-amber-100" },
  ESPETOS: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", accent: "bg-emerald-600", light: "bg-emerald-100" },
};
const DEFAULT_EMPRESA_COLOR = { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-700", accent: "bg-slate-600", light: "bg-slate-100" };

function getEmpresaColor(nome: string) {
  const short = shortEmpresaName(nome);
  return EMPRESA_COLORS[short] || DEFAULT_EMPRESA_COLOR;
}

const BANK_COLORS: Record<string, { bg: string; border: string; icon: string; bar: string }> = {
  Sicredi: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600", bar: "bg-emerald-500" },
  Sicoob: { bg: "bg-green-50", border: "border-green-200", icon: "text-green-600", bar: "bg-green-500" },
  Caixa: { bg: "bg-sky-50", border: "border-sky-200", icon: "text-sky-600", bar: "bg-sky-500" },
  "Sem Banco": { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-500", bar: "bg-slate-400" },
};
const DEFAULT_BANK_COLOR = { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-500", bar: "bg-slate-400" };

function getBankColor(nome: string) {
  const short = shortBankName(nome);
  return BANK_COLORS[short] || DEFAULT_BANK_COLOR;
}

const TIPO_LABELS: Record<string, { label: string; icon: typeof Banknote }> = {
  TITULO: { label: "Títulos / Boletos", icon: FileText },
  RECEITA: { label: "Receitas", icon: Receipt },
  ADIANTAMENTO: { label: "Adiantamentos", icon: CreditCard },
  OUTROS: { label: "Outros", icon: Banknote },
};

type ItemData = {
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
  estado: string | null;
  parcela: string;
  documento: string;
  empresa: string;
  bancoNome: string;
  contaNumero: string;
  agencia: string;
  isOverdue: boolean;
};

export default function ReceivablesTab() {
  const [estado, setEstado] = useState<"EMITIDO" | "RECEBIDO" | "ALL">("EMITIDO");
  const [search, setSearch] = useState("");
  const [expandedEmpresas, setExpandedEmpresas] = useState<Set<string>>(new Set());
  const [expandedMeses, setExpandedMeses] = useState<Set<string>>(new Set());
  const [expandedContas, setExpandedContas] = useState<Set<string>>(new Set());
  const [expandedTipos, setExpandedTipos] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const { data, isLoading } = trpc.financial.getReceivablesByBank.useQuery({ estado });

  // Filter items by search
  const filteredData = useMemo(() => {
    if (!data?.empresas || !search) return data;
    const s = search.toUpperCase();

    const empresas = data.empresas.map(emp => {
      const meses = emp.meses.map(mes => {
        const contas = mes.contas.map(conta => {
          const tipos = conta.tipos.map(tipo => {
            const items = tipo.items.filter(i =>
              i.cliente.toUpperCase().includes(s) ||
              i.referenteA.toUpperCase().includes(s) ||
              i.documento.toUpperCase().includes(s)
            );
            return { ...tipo, items, total: items.reduce((a, b) => a + b.valorAReceber, 0), count: items.length };
          }).filter(t => t.count > 0);
          return {
            ...conta, tipos,
            total: tipos.reduce((a, b) => a + b.total, 0),
            count: tipos.reduce((a, b) => a + b.count, 0),
          };
        }).filter(c => c.count > 0);
        return {
          ...mes, contas,
          total: contas.reduce((a, b) => a + b.total, 0),
          count: contas.reduce((a, b) => a + b.count, 0),
        };
      }).filter(m => m.count > 0);
      return {
        ...emp, meses,
        total: meses.reduce((a, b) => a + b.total, 0),
        count: meses.reduce((a, b) => a + b.count, 0),
      };
    }).filter(e => e.count > 0);

    return {
      empresas,
      totals: {
        total: empresas.reduce((a, b) => a + b.total, 0),
        count: empresas.reduce((a, b) => a + b.count, 0),
        vencido: data.totals.vencido,
        aVencer: data.totals.aVencer,
      },
    };
  }, [data, search]);

  function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-96 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const { empresas = [], totals = { total: 0, count: 0, vencido: 0, aVencer: 0 } } = filteredData || {};
  const maxEmpresaTotal = Math.max(...empresas.map(e => e.total), 1);

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
            {totals.vencido > 0 && (
              <span className="text-red-500 ml-2">· Vencido: {formatCurrency(totals.vencido)}</span>
            )}
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

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por cliente, documento ou referência..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Cards resumo por empresa */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {empresas.map(emp => {
          const colors = getEmpresaColor(emp.nome);
          const pctTotal = (emp.total / maxEmpresaTotal) * 100;
          const pctVencido = emp.total > 0 ? (emp.vencido / emp.total) * 100 : 0;

          return (
            <button
              key={emp.nome}
              onClick={() => toggleSet(setExpandedEmpresas, emp.nome)}
              className={`rounded-xl border-2 p-4 text-left transition-all hover:shadow-lg ${colors.bg} ${
                expandedEmpresas.has(emp.nome) ? `${colors.border} ring-2 ring-offset-1 ring-blue-400 shadow-lg` : colors.border
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/80 shadow-sm">
                    <Building2 className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">{shortEmpresaName(emp.nome)}</h3>
                    <span className="text-xs text-slate-500">{emp.count} títulos · {emp.meses.length} {emp.meses.length === 1 ? "mês" : "meses"}</span>
                  </div>
                </div>
                {expandedEmpresas.has(emp.nome)
                  ? <ChevronDown className="w-4 h-4 text-slate-400" />
                  : <ChevronRight className="w-4 h-4 text-slate-400" />
                }
              </div>

              <div className="text-2xl font-bold text-slate-800 mb-3">{formatCurrency(emp.total)}</div>

              {/* Barra vencido/a vencer */}
              <div className="w-full h-2.5 rounded-full bg-white/60 overflow-hidden mb-2.5">
                <div className="h-full flex">
                  {pctVencido > 0 && <div className="bg-red-400 h-full transition-all" style={{ width: `${pctVencido}%` }} />}
                  <div className={`${colors.accent} h-full transition-all opacity-70`} style={{ width: `${100 - pctVencido}%` }} />
                </div>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Vencido: {formatCurrency(emp.vencido)}
                </span>
                <span className={`${colors.text} flex items-center gap-1`}>
                  <Clock className="w-3 h-3" />
                  A vencer: {formatCurrency(emp.aVencer)}
                </span>
              </div>

              {/* Barra relativa */}
              <div className="mt-3 w-full h-1.5 rounded-full bg-white/40 overflow-hidden">
                <div className={`${colors.accent} h-full rounded-full transition-all opacity-60`} style={{ width: `${pctTotal}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Hierarquia expandida: Empresa → Mês → Banco → Forma */}
      <div className="space-y-4">
        {empresas.filter(emp => expandedEmpresas.has(emp.nome)).map(emp => {
          const empColors = getEmpresaColor(emp.nome);

          return (
            <div key={emp.nome} className={`rounded-xl border-2 ${empColors.border} overflow-hidden`}>
              {/* Header empresa */}
              <div className={`px-5 py-3 ${empColors.bg} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <Building2 className={`w-5 h-5 ${empColors.text}`} />
                  <div>
                    <h3 className="font-bold text-slate-800">{emp.nome}</h3>
                    <span className="text-xs text-slate-500">{emp.count} títulos · {formatCurrency(emp.total)}</span>
                  </div>
                </div>
                <button onClick={() => toggleSet(setExpandedEmpresas, emp.nome)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Meses */}
              <div className="bg-white divide-y divide-slate-100">
                {emp.meses.map((mes) => {
                  const mesKey = `${emp.nome}|${mes.mes}`;
                  const isMesOpen = expandedMeses.has(mesKey);
                  const isOverdueMonth = mes.mes < new Date().toISOString().substring(0, 7);
                  const currentMonth = mes.mes === new Date().toISOString().substring(0, 7);

                  return (
                    <div key={mes.mes}>
                      {/* Header mês */}
                      <button
                        onClick={() => toggleSet(setExpandedMeses, mesKey)}
                        className={`w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50/80 transition-all cursor-pointer ${
                          isOverdueMonth ? "bg-red-50/40" : currentMonth ? "bg-blue-50/30" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            isOverdueMonth ? "bg-red-100 border border-red-200" : currentMonth ? "bg-blue-100 border border-blue-200" : "bg-slate-100 border border-slate-200"
                          }`}>
                            <Calendar className={`w-4 h-4 ${
                              isOverdueMonth ? "text-red-500" : currentMonth ? "text-blue-500" : "text-slate-500"
                            }`} />
                          </div>
                          <div className="text-left">
                            <h4 className={`font-semibold text-sm ${
                              isOverdueMonth ? "text-red-700" : "text-slate-800"
                            }`}>
                              {formatMonth(mes.mes)}
                              {isOverdueMonth && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">VENCIDO</span>
                              )}
                              {currentMonth && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">MÊS ATUAL</span>
                              )}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span>{mes.count} títulos</span>
                              <span>{mes.contas.length} {mes.contas.length === 1 ? "conta" : "contas"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-bold text-sm ${isOverdueMonth ? "text-red-600" : "text-slate-800"}`}>
                            {formatCurrency(mes.total)}
                          </span>
                          {isMesOpen
                            ? <ChevronDown className="w-4 h-4 text-slate-400" />
                            : <ChevronRight className="w-4 h-4 text-slate-400" />
                          }
                        </div>
                      </button>

                      {/* Contas bancárias dentro do mês */}
                      {isMesOpen && (
                        <div className="bg-slate-50/50 border-t border-slate-100">
                          {mes.contas.map((conta, ci) => {
                            const contaKey = `${mesKey}|${conta.bancoNome}|${conta.contaNumero}`;
                            const bankColor = getBankColor(conta.bancoNome);
                            const isContaOpen = expandedContas.has(contaKey);
                            const contaLabel = conta.contaNumero
                              ? `${shortBankName(conta.bancoNome)} · Ag ${conta.agencia || "-"} · Cc ${conta.contaNumero}`
                              : shortBankName(conta.bancoNome);

                            return (
                              <div key={ci}>
                                {/* Header conta */}
                                <button
                                  onClick={() => toggleSet(setExpandedContas, contaKey)}
                                  className="w-full px-5 pl-12 py-2.5 flex items-center justify-between hover:bg-white/60 transition-all cursor-pointer"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-7 h-7 rounded-md ${bankColor.bg} ${bankColor.border} border flex items-center justify-center`}>
                                      <Landmark className={`w-3.5 h-3.5 ${bankColor.icon}`} />
                                    </div>
                                    <div className="text-left">
                                      <span className="text-sm font-medium text-slate-700">{contaLabel}</span>
                                      <span className="text-xs text-slate-400 ml-2 bg-slate-100 px-1.5 py-0.5 rounded">{conta.count}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-semibold text-sm text-slate-700">{formatCurrency(conta.total)}</span>
                                    {isContaOpen
                                      ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                      : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                    }
                                  </div>
                                </button>

                                {/* Formas de recebimento (tipos) dentro da conta */}
                                {isContaOpen && (
                                  <div className="bg-white/80">
                                    {conta.tipos.map((tipo, ti) => {
                                      const tipoKey = `${contaKey}|${tipo.tipo}`;
                                      const isTipoOpen = expandedTipos.has(tipoKey);
                                      const tipoInfo = TIPO_LABELS[tipo.tipo] || TIPO_LABELS.OUTROS;
                                      const TipoIcon = tipoInfo.icon;

                                      return (
                                        <div key={ti}>
                                          {/* Header tipo */}
                                          <button
                                            onClick={() => toggleSet(setExpandedTipos, tipoKey)}
                                            className="w-full px-5 pl-20 py-2 flex items-center justify-between hover:bg-slate-50 transition-all cursor-pointer"
                                          >
                                            <div className="flex items-center gap-2">
                                              <TipoIcon className="w-3.5 h-3.5 text-slate-400" />
                                              <span className="text-sm text-slate-600">{tipoInfo.label}</span>
                                              <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{tipo.count}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <span className="font-medium text-sm text-slate-600">{formatCurrency(tipo.total)}</span>
                                              {isTipoOpen
                                                ? <ChevronDown className="w-3 h-3 text-slate-400" />
                                                : <ChevronRight className="w-3 h-3 text-slate-400" />
                                              }
                                            </div>
                                          </button>

                                          {/* Items do tipo */}
                                          {isTipoOpen && (
                                            <div className="bg-white border-t border-slate-50">
                                              {/* Header tabela */}
                                              <div className="hidden md:grid grid-cols-[1fr_120px_100px_80px] gap-2 px-5 pl-24 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                                <span>Cliente / Referência</span>
                                                <span className="text-right">Valor</span>
                                                <span>Vencimento</span>
                                                <span className="text-center">Status</span>
                                              </div>
                                              <div className="divide-y divide-slate-50 max-h-[50vh] overflow-y-auto">
                                                {tipo.items.map(item => (
                                                  <ItemRow
                                                    key={item.id}
                                                    item={item}
                                                    isExpanded={expandedItem === item.id}
                                                    onToggle={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                                                  />
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mensagem quando nenhuma empresa expandida */}
      {empresas.length > 0 && expandedEmpresas.size === 0 && (
        <div className="text-center py-8 text-slate-400">
          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Clique em uma empresa acima para ver os detalhes</p>
        </div>
      )}

      {empresas.length === 0 && !isLoading && (
        <div className="text-center py-12 text-slate-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum recebível encontrado</p>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, isExpanded, onToggle }: { item: ItemData; isExpanded: boolean; onToggle: () => void }) {
  return (
    <div>
      <div
        onClick={onToggle}
        className={`grid grid-cols-1 md:grid-cols-[1fr_120px_100px_80px] gap-2 px-5 pl-24 py-2 cursor-pointer transition-colors items-center ${
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
      {isExpanded && (
        <div className="px-5 pl-24 pb-3 bg-slate-50/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-white rounded-lg border border-slate-100">
            <DetailItem label="Valor Original" value={formatCurrency(item.valorOriginal)} />
            <DetailItem label="Valor Pago" value={formatCurrency(item.valorPago)} />
            <DetailItem label="Emissão" value={formatDate(item.emissao)} />
            <DetailItem label="Empresa" value={item.empresa || "-"} />
            <DetailItem label="Banco" value={item.bancoNome} />
            <DetailItem label="Conta" value={item.contaNumero || "-"} />
            <DetailItem label="Agência" value={item.agencia || "-"} />
            <DetailItem label="Tipo" value={TIPO_LABELS[item.tipo]?.label || item.tipo} />
            <DetailItem label="Estado" value={item.estado || "-"} />
            {item.liquidacao && <DetailItem label="Liquidação" value={formatDate(item.liquidacao)} />}
          </div>
        </div>
      )}
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
