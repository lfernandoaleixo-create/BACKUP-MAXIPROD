import { useState, useMemo, useCallback } from "react";
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
  TrendingUp,
  Calendar,
  CheckSquare,
  Square,
  MinusSquare,
  FileDown,
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

const EMPRESA_COLORS: Record<string, { bg: string; border: string; text: string; accent: string; headerBg: string }> = {
  PALITOS: { bg: "bg-blue-50/60", border: "border-blue-400", text: "text-blue-700", accent: "bg-blue-600", headerBg: "bg-blue-100" },
  VARETAS: { bg: "bg-amber-50/60", border: "border-amber-400", text: "text-amber-700", accent: "bg-amber-600", headerBg: "bg-amber-100" },
  ESPETOS: { bg: "bg-emerald-50/60", border: "border-emerald-400", text: "text-emerald-700", accent: "bg-emerald-600", headerBg: "bg-emerald-100" },
};
const DEFAULT_EMPRESA_COLOR = { bg: "bg-slate-50/60", border: "border-slate-400", text: "text-slate-700", accent: "bg-slate-600", headerBg: "bg-slate-100" };

function getEmpresaColor(nome: string) {
  return EMPRESA_COLORS[shortEmpresaName(nome)] || DEFAULT_EMPRESA_COLOR;
}

const BANK_ICONS: Record<string, string> = {
  Sicredi: "text-emerald-600",
  Sicoob: "text-green-600",
  Caixa: "text-sky-600",
  "Sem Banco": "text-slate-400",
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
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data, isLoading } = trpc.financial.getReceivablesByBank.useQuery({ estado });

  // Flatten all items for selection logic
  const allItems = useMemo(() => {
    if (!data?.empresas) return [] as ItemData[];
    const items: ItemData[] = [];
    data.empresas.forEach(emp =>
      emp.meses.forEach(mes =>
        mes.contas.forEach(conta =>
          conta.tipos.forEach(tipo =>
            tipo.items.forEach(item => items.push(item))
          )
        )
      )
    );
    return items;
  }, [data]);

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
          return { ...conta, tipos, total: tipos.reduce((a, b) => a + b.total, 0), count: tipos.reduce((a, b) => a + b.count, 0) };
        }).filter(c => c.count > 0);
        return { ...mes, contas, total: contas.reduce((a, b) => a + b.total, 0), count: contas.reduce((a, b) => a + b.count, 0) };
      }).filter(m => m.count > 0);
      return { ...emp, meses, total: meses.reduce((a, b) => a + b.total, 0), count: meses.reduce((a, b) => a + b.count, 0) };
    }).filter(e => e.count > 0);
    return { empresas, totals: { total: empresas.reduce((a, b) => a + b.total, 0), count: empresas.reduce((a, b) => a + b.count, 0), vencido: data.totals.vencido, aVencer: data.totals.aVencer } };
  }, [data, search]);

  // Get all items for a specific conta (bank account within a month)
  const getContaItems = useCallback((emp: string, mes: string, bancoNome: string, contaNumero: string) => {
    if (!filteredData?.empresas) return [] as ItemData[];
    const empresa = filteredData.empresas.find(e => e.nome === emp);
    if (!empresa) return [];
    const month = empresa.meses.find(m => m.mes === mes);
    if (!month) return [];
    const conta = month.contas.find(c => c.bancoNome === bancoNome && c.contaNumero === contaNumero);
    if (!conta) return [];
    // Flatten all tipos into a single list sorted by date
    const items: ItemData[] = [];
    conta.tipos.forEach(t => items.push(...t.items));
    items.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    return items;
  }, [filteredData]);

  function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
    setter(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function toggleSelectAll(items: ItemData[]) {
    const ids = items.map(i => i.id);
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }

  // Selection summary
  const selectedItems = useMemo(() => allItems.filter(i => selectedIds.has(i.id)), [allItems, selectedIds]);
  const selectedTotal = useMemo(() => selectedItems.reduce((a, b) => a + b.valorAReceber, 0), [selectedItems]);

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
            {totals.vencido > 0 && <span className="text-red-500 ml-2">· Vencido: {formatCurrency(totals.vencido)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {(["EMITIDO", "RECEBIDO", "ALL"] as const).map(e => (
            <button key={e} onClick={() => setEstado(e)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${estado === e ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
              {e === "EMITIDO" ? "A Receber" : e === "RECEBIDO" ? "Recebidos" : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Buscar por cliente, documento ou referência..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        )}
      </div>

      {/* Barra de seleção para desconto */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-30 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl p-4 shadow-xl border border-teal-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">Selecionados para Desconto</div>
              <div className="text-teal-100 text-xs">{selectedIds.size} {selectedIds.size === 1 ? "título" : "títulos"} marcados para antecipação</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-teal-200 uppercase tracking-wide">Valor Total</div>
              <div className="text-xl font-bold">{formatCurrency(selectedTotal)}</div>
            </div>
            <button onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-medium transition-all">
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* Cards resumo por empresa */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {empresas.map(emp => {
          const colors = getEmpresaColor(emp.nome);
          const pctVencido = emp.total > 0 ? (emp.vencido / emp.total) * 100 : 0;
          const isOpen = expandedEmpresas.has(emp.nome);

          return (
            <button key={emp.nome} onClick={() => toggleSet(setExpandedEmpresas, emp.nome)}
              className={`rounded-xl border-2 p-4 text-left transition-all hover:shadow-lg ${colors.bg} ${isOpen ? `${colors.border} ring-2 ring-offset-1 ring-blue-400 shadow-lg` : colors.border}`}>
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
                {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </div>
              <div className="text-2xl font-bold text-slate-800 mb-3">{formatCurrency(emp.total)}</div>
              <div className="w-full h-2.5 rounded-full bg-white/60 overflow-hidden mb-2.5">
                <div className="h-full flex">
                  {pctVencido > 0 && <div className="bg-red-400 h-full" style={{ width: `${pctVencido}%` }} />}
                  <div className={`${colors.accent} h-full opacity-70`} style={{ width: `${100 - pctVencido}%` }} />
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Vencido: {formatCurrency(emp.vencido)}</span>
                <span className={`${colors.text} flex items-center gap-1`}><Clock className="w-3 h-3" />A vencer: {formatCurrency(emp.aVencer)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Hierarquia expandida: Empresa → Mês → Banco → Lista por data */}
      <div className="space-y-6">
        {empresas.filter(emp => expandedEmpresas.has(emp.nome)).map(emp => {
          const empColors = getEmpresaColor(emp.nome);

          return (
            <div key={emp.nome} className={`rounded-2xl border-2 ${empColors.border} overflow-hidden shadow-sm`}>
              {/* Header empresa */}
              <div className={`px-5 py-3.5 ${empColors.headerBg} flex items-center justify-between border-b-2 ${empColors.border}`}>
                <div className="flex items-center gap-3">
                  <Building2 className={`w-5 h-5 ${empColors.text}`} />
                  <div>
                    <h3 className={`font-bold text-base ${empColors.text}`}>{emp.nome}</h3>
                    <span className="text-xs text-slate-500">{emp.count} títulos · {formatCurrency(emp.total)}</span>
                  </div>
                </div>
                <button onClick={() => toggleSet(setExpandedEmpresas, emp.nome)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Meses */}
              <div className="bg-white">
                {emp.meses.map((mes, mi) => {
                  const mesKey = `${emp.nome}|${mes.mes}`;
                  const isMesOpen = expandedMeses.has(mesKey);
                  const today = new Date().toISOString().substring(0, 7);
                  const isOverdueMonth = mes.mes < today;
                  const currentMonth = mes.mes === today;

                  return (
                    <div key={mes.mes} className={mi > 0 ? "border-t-2 border-slate-200" : ""}>
                      {/* Header mês */}
                      <button onClick={() => toggleSet(setExpandedMeses, mesKey)}
                        className={`w-full px-5 py-3.5 flex items-center justify-between transition-all cursor-pointer ${
                          isOverdueMonth ? "bg-red-50/50 hover:bg-red-50" : currentMonth ? "bg-blue-50/40 hover:bg-blue-50/70" : "bg-white hover:bg-slate-50"
                        }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                            isOverdueMonth ? "bg-red-100 border-2 border-red-300" : currentMonth ? "bg-blue-100 border-2 border-blue-300" : "bg-slate-100 border-2 border-slate-200"
                          }`}>
                            <Calendar className={`w-5 h-5 ${isOverdueMonth ? "text-red-500" : currentMonth ? "text-blue-500" : "text-slate-500"}`} />
                          </div>
                          <div className="text-left">
                            <h4 className={`font-bold text-sm ${isOverdueMonth ? "text-red-700" : "text-slate-800"}`}>
                              {formatMonth(mes.mes)}
                              {isOverdueMonth && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-red-200 text-red-700 font-bold uppercase">Vencido</span>}
                              {currentMonth && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-blue-200 text-blue-700 font-bold uppercase">Mês Atual</span>}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                              <span>{mes.count} títulos</span>
                              <span className="text-slate-300">|</span>
                              <span>{mes.contas.length} {mes.contas.length === 1 ? "conta" : "contas"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-bold text-base ${isOverdueMonth ? "text-red-600" : "text-slate-800"}`}>{formatCurrency(mes.total)}</span>
                          {isMesOpen ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                        </div>
                      </button>

                      {/* Contas bancárias dentro do mês */}
                      {isMesOpen && (
                        <div className="px-4 pb-4 pt-2 bg-slate-50/80 space-y-3">
                          {mes.contas.map((conta, ci) => {
                            const contaKey = `${mesKey}|${conta.bancoNome}|${conta.contaNumero}`;
                            const isContaOpen = expandedContas.has(contaKey);
                            const bankShort = shortBankName(conta.bancoNome);
                            const bankIconColor = BANK_ICONS[bankShort] || "text-slate-500";
                            const contaLabel = conta.contaNumero
                              ? `${bankShort} · Ag ${conta.agencia || "-"} · Cc ${conta.contaNumero}`
                              : bankShort;
                            const contaItems = isContaOpen ? getContaItems(emp.nome, mes.mes, conta.bancoNome, conta.contaNumero) : [];
                            const contaItemIds = contaItems.map(i => i.id);
                            const allContaSelected = contaItemIds.length > 0 && contaItemIds.every(id => selectedIds.has(id));
                            const someContaSelected = contaItemIds.some(id => selectedIds.has(id));

                            return (
                              <div key={ci} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                {/* Header conta bancária */}
                                <button onClick={() => toggleSet(setExpandedContas, contaKey)}
                                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-all cursor-pointer">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                                      <Landmark className={`w-4 h-4 ${bankIconColor}`} />
                                    </div>
                                    <div>
                                      <span className="text-sm font-semibold text-slate-700">{contaLabel}</span>
                                      <span className="ml-2 text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md font-medium">{conta.count} títulos</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-bold text-sm text-slate-700">{formatCurrency(conta.total)}</span>
                                    {isContaOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                  </div>
                                </button>

                                {/* Lista de títulos por data */}
                                {isContaOpen && contaItems.length > 0 && (
                                  <div className="border-t border-slate-200">
                                    {/* Header tabela */}
                                    <div className="grid grid-cols-[36px_1fr_110px_90px_80px] gap-1 px-4 py-2 bg-slate-100 border-b border-slate-200">
                                      <div className="flex items-center justify-center">
                                        <button onClick={(e) => { e.stopPropagation(); toggleSelectAll(contaItems); }}
                                          className="text-slate-500 hover:text-teal-600 transition-colors" title="Selecionar todos">
                                          {allContaSelected ? <CheckSquare className="w-4 h-4 text-teal-600" />
                                            : someContaSelected ? <MinusSquare className="w-4 h-4 text-teal-500" />
                                            : <Square className="w-4 h-4" />}
                                        </button>
                                      </div>
                                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider self-center">Cliente / Documento</div>
                                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right self-center">Valor</div>
                                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider self-center">Vencimento</div>
                                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center self-center">Status</div>
                                    </div>

                                    {/* Rows */}
                                    <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                                      {contaItems.map((item, idx) => {
                                        const isSelected = selectedIds.has(item.id);
                                        const isExp = expandedItem === item.id;

                                        return (
                                          <div key={item.id}>
                                            <div className={`grid grid-cols-[36px_1fr_110px_90px_80px] gap-1 px-4 py-2.5 items-center transition-all cursor-pointer ${
                                              isSelected ? "bg-teal-50/70 hover:bg-teal-50" : item.isOverdue ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-slate-50"
                                            }`}>
                                              {/* Checkbox */}
                                              <div className="flex items-center justify-center">
                                                <button onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                                                  className={`transition-colors ${isSelected ? "text-teal-600" : "text-slate-300 hover:text-slate-500"}`}>
                                                  {isSelected ? <CheckSquare className="w-4.5 h-4.5" /> : <Square className="w-4.5 h-4.5" />}
                                                </button>
                                              </div>

                                              {/* Cliente */}
                                              <div className="min-w-0 cursor-pointer" onClick={() => setExpandedItem(isExp ? null : item.id)}>
                                                <div className="font-medium text-sm text-slate-800 truncate">{item.cliente}</div>
                                                <div className="text-xs text-slate-400 truncate">
                                                  {item.documento && `Doc ${item.documento}`}
                                                  {item.parcela && ` · ${item.parcela}`}
                                                  {item.referenteA && ` · ${item.referenteA}`}
                                                </div>
                                              </div>

                                              {/* Valor */}
                                              <div className="text-right" onClick={() => setExpandedItem(isExp ? null : item.id)}>
                                                <span className={`font-bold text-sm ${isSelected ? "text-teal-700" : item.isOverdue ? "text-red-600" : "text-slate-800"}`}>
                                                  {formatCurrency(item.valorAReceber)}
                                                </span>
                                              </div>

                                              {/* Vencimento */}
                                              <div className={`text-sm ${item.isOverdue ? "text-red-600 font-semibold" : "text-slate-600"}`}
                                                onClick={() => setExpandedItem(isExp ? null : item.id)}>
                                                {formatDate(item.vencimento)}
                                              </div>

                                              {/* Status */}
                                              <div className="text-center" onClick={() => setExpandedItem(isExp ? null : item.id)}>
                                                {item.isOverdue ? (
                                                  <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                                                    <AlertTriangle className="w-3 h-3" /> Vencido
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">
                                                    <Clock className="w-3 h-3" /> A vencer
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            {/* Detalhes expandidos */}
                                            {isExp && (
                                              <div className="px-4 pl-12 pb-3 bg-slate-50">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                                                  <DetailItem label="Valor Original" value={formatCurrency(item.valorOriginal)} />
                                                  <DetailItem label="Valor Pago" value={formatCurrency(item.valorPago)} />
                                                  <DetailItem label="Emissão" value={formatDate(item.emissao)} />
                                                  <DetailItem label="Tipo" value={item.tipo} />
                                                  <DetailItem label="Estado" value={item.estado || "-"} />
                                                  {item.liquidacao && <DetailItem label="Liquidação" value={formatDate(item.liquidacao)} />}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
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
            </div>
          );
        })}
      </div>

      {/* Mensagem quando nenhuma empresa expandida */}
      {empresas.length > 0 && expandedEmpresas.size === 0 && (
        <div className="text-center py-10 text-slate-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Clique em uma empresa acima para ver os detalhes</p>
          <p className="text-xs mt-1 text-slate-300">Os recebíveis serão organizados por mês e conta bancária</p>
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</div>
      <div className="text-sm font-medium text-slate-700 mt-0.5">{value}</div>
    </div>
  );
}
