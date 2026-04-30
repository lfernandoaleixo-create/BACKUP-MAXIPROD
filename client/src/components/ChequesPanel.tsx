import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  CreditCard,
  Building2,
  Calendar,
  Filter,
  ChevronDown,
  ChevronRight,
  Info,
  X,
  Search,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";

/* ---- Constants ---- */
const CHEQUE_STATES = [
  { key: "CHEQUE DISPONÍVEL", label: "Disponível", shortLabel: "Disponível", color: "bg-emerald-100 text-emerald-800 border-emerald-300", dotColor: "bg-emerald-500", description: "Cheques que estão em nossas mãos" },
  { key: "CHEQUE À RECEBER DE CLIENTES", label: "À Receber de Clientes", shortLabel: "À Receber", color: "bg-blue-100 text-blue-800 border-blue-300", dotColor: "bg-blue-500", description: "Cheques que os clientes se comprometeram a encaminhar para empresa" },
  { key: "CHEQUE EM COMPENSAÇÃO", label: "Em Compensação", shortLabel: "Compensação", color: "bg-amber-100 text-amber-800 border-amber-300", dotColor: "bg-amber-500", description: "Cheques depositados no nosso banco aguardando creditar na nossa conta" },
  { key: "CHEQUE CUSTÓDIA SICOOB", label: "Custódia Sicoob", shortLabel: "Cust. Sicoob", color: "bg-cyan-100 text-cyan-800 border-cyan-300", dotColor: "bg-cyan-500", description: "Cheques depositados no Sicoob aguardando a data para depositar automático na nossa conta" },
  { key: "CHEQUE CUSTÓDIA SICREDI", label: "Custódia Sicredi", shortLabel: "Cust. Sicredi", color: "bg-teal-100 text-teal-800 border-teal-300", dotColor: "bg-teal-500", description: "Cheques depositados no Sicredi aguardando a data para depositar automático na nossa conta" },
  { key: "CHEQUE LINHA 11", label: "Linha 11", shortLabel: "Linha 11", color: "bg-red-100 text-red-800 border-red-300", dotColor: "bg-red-500", description: "Cheques que voltaram porque não tinha o valor na conta do cliente" },
  { key: "CHEQUE LINHA 12", label: "Linha 12", shortLabel: "Linha 12", color: "bg-rose-100 text-rose-800 border-rose-300", dotColor: "bg-rose-500", description: "Cheques que voltaram porque já foi 2 vezes na conta do cliente e não tinha saldo" },
  { key: "CHEQUE VOLTOU OUTROS MOTIVOS", label: "Voltou Outros Motivos", shortLabel: "Voltou", color: "bg-orange-100 text-orange-800 border-orange-300", dotColor: "bg-orange-500", description: "Cheques que voltaram por vários motivos (rasuras, assinaturas, etc.)" },
  { key: "CHEQUE EM FACTORING", label: "Em Factoring", shortLabel: "Factoring", color: "bg-purple-100 text-purple-800 border-purple-300", dotColor: "bg-purple-500", description: "Cheques que estão em factoring aguardando desconto" },
] as const;

const EMPRESAS = ["PALITOS", "VARETAS", "ESPETOS"] as const;

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

function getChequeStateInfo(key: string) {
  return CHEQUE_STATES.find(s => s.key === key) || { key, label: key, shortLabel: key, color: "bg-slate-100 text-slate-800 border-slate-300", dotColor: "bg-slate-500", description: "" };
}

/* ---- Main Component ---- */
export default function ChequesPanel() {
  const [selectedEmpresa, setSelectedEmpresa] = useState<string | undefined>(undefined);
  const [selectedMes, setSelectedMes] = useState<string | undefined>(undefined);
  const [selectedEstado, setSelectedEstado] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [expandedMeses, setExpandedMeses] = useState<Set<string>>(new Set());
  const [showLegend, setShowLegend] = useState(false);

  const { data, isLoading } = trpc.financial.getCheques.useQuery({
    empresa: selectedEmpresa,
    mes: selectedMes,
    chequeEstado: selectedEstado,
  });

  // Filter by search text
  const filteredData = useMemo(() => {
    if (!data || !search) return data;
    const s = search.toUpperCase();
    const empresas = data.empresas.map(emp => ({
      ...emp,
      meses: emp.meses.map(mes => ({
        ...mes,
        items: mes.items.filter(i =>
          i.cliente.toUpperCase().includes(s) ||
          i.descricao.toUpperCase().includes(s) ||
          i.documento.toUpperCase().includes(s)
        ),
      })).map(mes => ({ ...mes, total: mes.items.reduce((a, b) => a + b.valor, 0), count: mes.items.length }))
        .filter(mes => mes.count > 0),
    })).map(emp => ({ ...emp, total: emp.meses.reduce((a, b) => a + b.total, 0), count: emp.meses.reduce((a, b) => a + b.count, 0) }))
      .filter(emp => emp.count > 0);
    return { ...data, empresas, totals: { total: empresas.reduce((a, b) => a + b.total, 0), count: empresas.reduce((a, b) => a + b.count, 0) } };
  }, [data, search]);

  function toggleMes(key: string) {
    setExpandedMeses(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const { empresas = [], totals = { total: 0, count: 0 }, estadoSummary = {}, availableEmpresas = [], availableMeses = [] } = filteredData || {};

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-600" />
            Controle de Cheques
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Cheques a receber organizados por empresa e mês de vencimento</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg border-2 border-amber-300 bg-amber-50 text-base font-bold text-amber-700 shadow-sm">
            {totals.count} cheques
          </span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg border-2 border-slate-300 bg-slate-50 text-base font-bold text-slate-800 shadow-sm">
            {formatCurrency(totals.total)}
          </span>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`p-2 rounded-lg transition-all ${showLegend ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            title="Legenda dos estados"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend panel */}
      {showLegend && (
        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700">Formas de Cobrança em Cheque</h3>
            <button onClick={() => setShowLegend(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {CHEQUE_STATES.map((state, idx) => (
              <div key={state.key} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
                <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${state.dotColor}`} />
                <div>
                  <span className="text-xs font-bold text-slate-700">{idx + 1}. {state.label}</span>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{state.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-slate-200 p-3">
        <Filter className="w-4 h-4 text-slate-400" />

        {/* Empresa filter */}
        <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
          <button
            onClick={() => setSelectedEmpresa(undefined)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!selectedEmpresa ? "bg-white text-amber-700 shadow-sm border border-amber-200" : "text-slate-600 hover:text-slate-800"}`}
          >
            Todas
          </button>
          {EMPRESAS.map(emp => (
            <button
              key={emp}
              onClick={() => setSelectedEmpresa(selectedEmpresa === emp ? undefined : emp)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${selectedEmpresa === emp ? "bg-white text-amber-700 shadow-sm border border-amber-200" : "text-slate-600 hover:text-slate-800"}`}
            >
              {emp}
            </button>
          ))}
        </div>

        {/* Month filter */}
        <select
          value={selectedMes || ""}
          onChange={e => setSelectedMes(e.target.value || undefined)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-amber-400"
        >
          <option value="">Todos os meses</option>
          {(data?.availableMeses || []).map(m => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>

        {/* Estado filter */}
        <select
          value={selectedEstado || ""}
          onChange={e => setSelectedEstado(e.target.value || undefined)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-amber-400"
        >
          <option value="">Todos os estados</option>
          {CHEQUE_STATES.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar cliente, documento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-amber-400"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Clear all filters */}
        {(selectedEmpresa || selectedMes || selectedEstado || search) && (
          <button
            onClick={() => { setSelectedEmpresa(undefined); setSelectedMes(undefined); setSelectedEstado(undefined); setSearch(""); }}
            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 border border-red-200"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Estado summary badges */}
      {data?.estadoSummary && Object.keys(data.estadoSummary).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.estadoSummary)
            .sort(([, a], [, b]) => (b as any).total - (a as any).total)
            .map(([key, val]) => {
              const info = getChequeStateInfo(key);
              const v = val as { count: number; total: number };
              const isActive = selectedEstado === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedEstado(isActive ? undefined : key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${isActive ? info.color + " ring-2 ring-offset-1 ring-amber-400 shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                >
                  <span className={`w-2 h-2 rounded-full ${info.dotColor}`} />
                  <span>{info.shortLabel}</span>
                  <span className="font-bold">{v.count}</span>
                  <span className="text-[10px] opacity-70">{formatCurrency(v.total)}</span>
                </button>
              );
            })}
        </div>
      )}

      {/* Empty state */}
      {empresas.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Banknote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Nenhum cheque encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Ajuste os filtros ou aguarde a sincronização dos dados</p>
        </div>
      )}

      {/* Empresa groups */}
      {empresas.map(emp => (
        <div key={emp.nome} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Empresa header */}
          <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800">{emp.nome}</h3>
                <span className="text-[10px] text-slate-500">{emp.count} cheques • {emp.meses.length} {emp.meses.length === 1 ? "mês" : "meses"}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-extrabold text-slate-800">{formatCurrency(emp.total)}</div>
            </div>
          </div>

          {/* Meses */}
          <div className="divide-y divide-slate-100">
            {emp.meses.map(mes => {
              const mesKey = `${emp.nome}-${mes.mes}`;
              const isOpen = expandedMeses.has(mesKey);
              return (
                <div key={mesKey}>
                  {/* Mes header */}
                  <button
                    onClick={() => toggleMes(mesKey)}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      <Calendar className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-semibold text-slate-700">{formatMonth(mes.mes)}</span>
                      <span className="text-xs text-slate-400">({mes.count} cheques)</span>
                    </div>
                    <span className="text-sm font-bold text-slate-700">{formatCurrency(mes.total)}</span>
                  </button>

                  {/* Items table */}
                  {isOpen && (
                    <div className="px-4 pb-3">
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left px-3 py-2 font-semibold text-slate-500">Vencimento</th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-500">Cliente</th>
                              <th className="text-right px-3 py-2 font-semibold text-slate-500">Valor</th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-500">Estado</th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-500">Descrição</th>
                              <th className="text-center px-3 py-2 font-semibold text-slate-500">Parcela</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {mes.items.map(item => {
                              const stateInfo = getChequeStateInfo(item.chequeEstado);
                              return (
                                <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                                  <td className="px-3 py-2 text-slate-700 font-medium whitespace-nowrap">{formatDate(item.vencimento)}</td>
                                  <td className="px-3 py-2 text-slate-800 font-medium max-w-[200px] truncate" title={item.cliente}>{item.cliente}</td>
                                  <td className="px-3 py-2 text-right font-bold text-slate-800 whitespace-nowrap">{formatCurrency(item.valor)}</td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${stateInfo.color}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${stateInfo.dotColor}`} />
                                      {stateInfo.shortLabel}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-slate-600 max-w-[250px] truncate" title={item.descricao || item.documento ? `${item.descricao} ${item.documento ? `Doc: ${item.documento}` : ""}` : "-"}>
                                    {item.descricao || (item.documento ? `Doc: ${item.documento}` : "-")}
                                  </td>
                                  <td className="px-3 py-2 text-center text-slate-500">{item.parcela || "-"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 border-t border-slate-200">
                              <td className="px-3 py-2 font-bold text-slate-600" colSpan={2}>Total do mês</td>
                              <td className="px-3 py-2 text-right font-extrabold text-slate-800">{formatCurrency(mes.total)}</td>
                              <td colSpan={3}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
