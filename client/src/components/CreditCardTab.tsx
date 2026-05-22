import React, { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CreditCard,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const CREDIT_CARD_ALLOWED = ["Guilherme", "Flavio"];

// Helpers
function formatCurrency(val: number | string | null | undefined): string {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  if (isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getMonthColumns(startMonth?: string, count: number = 6): string[] {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed
  if (startMonth) {
    const [y, m] = startMonth.split("-").map(Number);
    year = y;
    month = m - 1;
  }
  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(year, month + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[m - 1]}/${y}`;
}

function getParcelValueForMonth(entry: any, targetMonth: string): number {
  if (!entry.mesInicio || !entry.quantParcelas) return 0;
  const [startY, startM] = entry.mesInicio.split("-").map(Number);
  const [targetY, targetM] = targetMonth.split("-").map(Number);
  const diff = (targetY - startY) * 12 + (targetM - startM);
  if (diff < 0 || diff >= entry.quantParcelas) return 0;
  return parseFloat(entry.valorParcela || "0");
}

// Card Header Component
function CardHeader({ card, onEdit, onDelete, isExpanded, onToggle }: {
  card: any;
  onEdit: () => void;
  onDelete: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-xl p-4 md:p-5 cursor-pointer shadow-lg hover:shadow-xl transition-all"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-base md:text-lg">{card.titularCartao}</h3>
            <div className="flex items-center gap-3 text-xs text-slate-300 mt-0.5">
              {card.vencimentoFatura && <span>Venc. dia {card.vencimentoFatura}</span>}
              {card.fechamentoFatura && <span>Fech. dia {card.fechamentoFatura}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Edit3 className="w-4 h-4 text-slate-300" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </div>
      {/* Limite info */}
      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/10">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Limite Total</p>
          <p className="text-sm font-semibold text-white">{card.limiteTotal ? formatCurrency(card.limiteTotal) : "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Utilizado</p>
          <p className="text-sm font-semibold text-amber-400">{card.limiteUtilizado ? formatCurrency(card.limiteUtilizado) : "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Disponível</p>
          <p className="text-sm font-semibold text-emerald-400">{card.limiteDisponivel ? formatCurrency(card.limiteDisponivel) : "—"}</p>
        </div>
      </div>
    </div>
  );
}

// Inline edit row component
function EntryRow({ entry, monthColumns, onSave, onDelete, isNew, fechamentoFatura }: {
  entry: any;
  monthColumns: string[];
  onSave: (data: any) => void;
  onDelete: () => void;
  isNew?: boolean;
  fechamentoFatura?: number;
}) {
  const [editing, setEditing] = useState(isNew || false);
  const [form, setForm] = useState({
    dataCompra: entry.dataCompra || "",
    estabelecimento: entry.estabelecimento || "",
    descricaoDespesa: entry.descricaoDespesa || "",
    centroDeCusto: entry.centroDeCusto || "",
    valorTotal: entry.valorTotal ? parseFloat(entry.valorTotal).toString() : "",
    quantParcelas: entry.quantParcelas?.toString() || "1",
  });

  // Auto-calculate valor parcela in real time
  const computedValorParcela = useMemo(() => {
    const total = parseFloat(form.valorTotal) || 0;
    const parcelas = parseInt(form.quantParcelas) || 1;
    if (total <= 0) return 0;
    return total / parcelas;
  }, [form.valorTotal, form.quantParcelas]);

  // Auto-calculate mesInicio for preview
  const computedMesInicio = useMemo(() => {
    if (!form.dataCompra) return null;
    const fech = fechamentoFatura || 1;
    const [year, month, day] = form.dataCompra.split("-").map(Number);
    if (!year || !month || !day) return null;
    if (day <= fech) {
      return `${year}-${String(month).padStart(2, "0")}`;
    } else {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
    }
  }, [form.dataCompra, fechamentoFatura]);

  // Preview parcel distribution in months
  function getPreviewValueForMonth(targetMonth: string): number {
    if (!computedMesInicio || computedValorParcela <= 0) return 0;
    const parcelas = parseInt(form.quantParcelas) || 1;
    const [startY, startM] = computedMesInicio.split("-").map(Number);
    const [targetY, targetM] = targetMonth.split("-").map(Number);
    const diff = (targetY - startY) * 12 + (targetM - startM);
    if (diff < 0 || diff >= parcelas) return 0;
    return computedValorParcela;
  }

  const handleSave = () => {
    if (!form.dataCompra) {
      toast.error("Informe a data da compra");
      return;
    }
    const valorTotal = parseFloat(form.valorTotal) || 0;
    const quantParcelas = parseInt(form.quantParcelas) || 1;
    onSave({
      ...form,
      valorTotal,
      quantParcelas,
      valorParcela: computedValorParcela,
    });
    if (isNew) {
      // Reset form for next entry - keep adding
      setForm({
        dataCompra: "",
        estabelecimento: "",
        descricaoDespesa: "",
        centroDeCusto: "",
        valorTotal: "",
        quantParcelas: "1",
      });
    } else {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <tr className="bg-blue-50/50 border-b border-slate-200">
        <td className="px-2 py-1.5">
          <Input
            type="date"
            value={form.dataCompra}
            onChange={(e) => setForm({ ...form, dataCompra: e.target.value })}
            className="h-7 text-xs w-36"
          />
        </td>
        <td className="px-2 py-1.5">
          <Input
            value={form.estabelecimento}
            onChange={(e) => setForm({ ...form, estabelecimento: e.target.value })}
            className="h-7 text-xs w-32"
            placeholder="Estabelecimento"
          />
        </td>
        <td className="px-2 py-1.5">
          <Input
            value={form.descricaoDespesa}
            onChange={(e) => setForm({ ...form, descricaoDespesa: e.target.value })}
            className="h-7 text-xs w-40"
            placeholder="Descrição"
          />
        </td>
        <td className="px-2 py-1.5">
          <Input
            value={form.centroDeCusto}
            onChange={(e) => setForm({ ...form, centroDeCusto: e.target.value })}
            className="h-7 text-xs w-28"
            placeholder="Centro custo"
          />
        </td>
        <td className="px-2 py-1.5">
          <Input
            type="number"
            value={form.valorTotal}
            onChange={(e) => setForm({ ...form, valorTotal: e.target.value })}
            className="h-7 text-xs w-24"
            placeholder="0,00"
          />
        </td>
        <td className="px-2 py-1.5">
          <Input
            type="number"
            value={form.quantParcelas}
            onChange={(e) => setForm({ ...form, quantParcelas: e.target.value })}
            className="h-7 text-xs w-14"
            min="1"
          />
        </td>
        <td className="px-2 py-1.5 text-xs font-semibold text-slate-700 text-right whitespace-nowrap">
          {computedValorParcela > 0 ? formatCurrency(computedValorParcela) : "—"}
        </td>
        {monthColumns.map((m) => {
          const val = getPreviewValueForMonth(m);
          return (
            <td key={m} className={`px-2 py-1.5 text-xs text-right ${val > 0 ? "font-semibold text-green-700 bg-green-50/60" : "text-slate-300"}`}>
              {val > 0 ? formatCurrency(val) : "—"}
            </td>
          );
        })}
        <td className="px-2 py-1.5 text-xs text-slate-500 italic whitespace-nowrap">
          {computedMesInicio ? formatMonthLabel(computedMesInicio) : "Auto"}
        </td>
        <td className="px-2 py-1.5">
          <div className="flex gap-1">
            <button onClick={handleSave} className="p-1 rounded hover:bg-green-100 text-green-600">
              <Save className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { if (isNew) onDelete(); else setEditing(false); }} className="p-1 rounded hover:bg-red-100 text-red-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
      <td className="px-2 py-2 text-xs text-slate-600 whitespace-nowrap">
        {entry.dataCompra ? new Date(entry.dataCompra + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
      </td>
      <td className="px-2 py-2 text-xs font-medium text-slate-700 max-w-[120px] truncate">{entry.estabelecimento || "—"}</td>
      <td className="px-2 py-2 text-xs text-slate-600 max-w-[150px] truncate">{entry.descricaoDespesa || "—"}</td>
      <td className="px-2 py-2 text-xs text-slate-500">{entry.centroDeCusto || "—"}</td>
      <td className="px-2 py-2 text-xs font-semibold text-slate-800 text-right">{formatCurrency(entry.valorTotal)}</td>
      <td className="px-2 py-2 text-xs text-center text-slate-600">{entry.quantParcelas || 1}</td>
      <td className="px-2 py-2 text-xs font-medium text-slate-700 text-right">{formatCurrency(entry.valorParcela)}</td>
      {monthColumns.map((m) => {
        const val = getParcelValueForMonth(entry, m);
        return (
          <td key={m} className={`px-2 py-2 text-xs text-right ${val > 0 ? "font-semibold text-blue-700 bg-blue-50/40" : "text-slate-300"}`}>
            {val > 0 ? formatCurrency(val) : "—"}
          </td>
        );
      })}
      <td className="px-2 py-2 text-xs text-slate-500">{entry.mesInicio ? formatMonthLabel(entry.mesInicio) : "—"}</td>
      <td className="px-2 py-2">
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-slate-200 text-slate-500">
            <Edit3 className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-100 text-red-400">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Card Spreadsheet Component
function CardSpreadsheet({ card, operatorName }: { card: any; operatorName: string }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingHeader, setEditingHeader] = useState(false);
  const [addingEntryKey, setAddingEntryKey] = useState(0); // 0 = hidden, >0 = showing (key for re-mount)
  const [headerForm, setHeaderForm] = useState({
    titularCartao: card.titularCartao,
    vencimentoFatura: card.vencimentoFatura?.toString() || "",
    fechamentoFatura: card.fechamentoFatura?.toString() || "",
    previsaoPagamento: card.previsaoPagamento || "",
    limiteTotal: card.limiteTotal ? parseFloat(card.limiteTotal).toString() : "",
    limiteUtilizado: card.limiteUtilizado ? parseFloat(card.limiteUtilizado).toString() : "",
    limiteDisponivel: card.limiteDisponivel ? parseFloat(card.limiteDisponivel).toString() : "",
  });

  const utils = trpc.useUtils();
  const { data: entriesData } = trpc.creditCard.listEntries.useQuery(
    { operatorName, cardId: card.id },
    { refetchInterval: 30000 }
  );
  const entries = entriesData?.entries || [];

  const updateCardMut = trpc.creditCard.updateCard.useMutation({
    onSuccess: () => { utils.creditCard.listCards.invalidate(); toast.success("Cartão atualizado"); setEditingHeader(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteCardMut = trpc.creditCard.deleteCard.useMutation({
    onSuccess: () => { utils.creditCard.listCards.invalidate(); toast.success("Cartão excluído"); },
    onError: (e) => toast.error(e.message),
  });
  const createEntryMut = trpc.creditCard.createEntry.useMutation({
    onSuccess: () => { utils.creditCard.listEntries.invalidate(); toast.success("Lançamento adicionado"); },
    onError: (e) => toast.error(e.message),
  });
  const updateEntryMut = trpc.creditCard.updateEntry.useMutation({
    onSuccess: () => { utils.creditCard.listEntries.invalidate(); toast.success("Lançamento atualizado"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteEntryMut = trpc.creditCard.deleteEntry.useMutation({
    onSuccess: () => { utils.creditCard.listEntries.invalidate(); toast.success("Lançamento excluído"); },
    onError: (e) => toast.error(e.message),
  });

  const monthColumns = useMemo(() => getMonthColumns(undefined, 6), []);

  // Calculate totals per month
  const monthTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    monthColumns.forEach(m => { totals[m] = 0; });
    entries.forEach((entry: any) => {
      monthColumns.forEach(m => {
        totals[m] += getParcelValueForMonth(entry, m);
      });
    });
    return totals;
  }, [entries, monthColumns]);

  const handleSaveHeader = () => {
    updateCardMut.mutate({
      operatorName,
      id: card.id,
      titularCartao: headerForm.titularCartao,
      vencimentoFatura: headerForm.vencimentoFatura ? parseInt(headerForm.vencimentoFatura) : null,
      fechamentoFatura: headerForm.fechamentoFatura ? parseInt(headerForm.fechamentoFatura) : null,
      previsaoPagamento: headerForm.previsaoPagamento || null,
      limiteTotal: headerForm.limiteTotal ? parseFloat(headerForm.limiteTotal) : null,
      limiteUtilizado: headerForm.limiteUtilizado ? parseFloat(headerForm.limiteUtilizado) : null,
      limiteDisponivel: headerForm.limiteDisponivel ? parseFloat(headerForm.limiteDisponivel) : null,
    });
  };

  const handleDeleteCard = () => {
    if (confirm(`Excluir o cartão "${card.titularCartao}" e todos os lançamentos?`)) {
      deleteCardMut.mutate({ operatorName, id: card.id });
    }
  };

  const handleSaveEntry = (data: any) => {
    createEntryMut.mutate({
      operatorName,
      cardId: card.id,
      dataCompra: data.dataCompra,
      estabelecimento: data.estabelecimento || undefined,
      descricaoDespesa: data.descricaoDespesa || undefined,
      centroDeCusto: data.centroDeCusto || undefined,
      valorTotal: data.valorTotal,
      quantParcelas: data.quantParcelas,
      valorParcela: data.valorParcela,
    });
  };

  const handleUpdateEntry = (id: number, data: any) => {
    updateEntryMut.mutate({
      operatorName,
      id,
      dataCompra: data.dataCompra || null,
      estabelecimento: data.estabelecimento || null,
      descricaoDespesa: data.descricaoDespesa || null,
      centroDeCusto: data.centroDeCusto || null,
      valorTotal: data.valorTotal,
      quantParcelas: data.quantParcelas,
      valorParcela: data.valorParcela,
    });
  };

  const handleDeleteEntry = (id: number) => {
    if (confirm("Excluir este lançamento?")) {
      deleteEntryMut.mutate({ operatorName, id });
    }
  };

  return (
    <div className="space-y-3">
      <CardHeader
        card={card}
        onEdit={() => setEditingHeader(true)}
        onDelete={handleDeleteCard}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />

      {/* Edit Header Modal */}
      {editingHeader && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <h4 className="font-semibold text-sm text-slate-700">Editar Cartão</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase">Titular</label>
              <Input value={headerForm.titularCartao} onChange={(e) => setHeaderForm({ ...headerForm, titularCartao: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase">Vencimento (dia)</label>
              <Input type="number" min="1" max="31" value={headerForm.vencimentoFatura} onChange={(e) => setHeaderForm({ ...headerForm, vencimentoFatura: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase">Fechamento (dia)</label>
              <Input type="number" min="1" max="31" value={headerForm.fechamentoFatura} onChange={(e) => setHeaderForm({ ...headerForm, fechamentoFatura: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase">Previsão Pagamento</label>
              <Input value={headerForm.previsaoPagamento} onChange={(e) => setHeaderForm({ ...headerForm, previsaoPagamento: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase">Limite Total</label>
              <Input type="number" value={headerForm.limiteTotal} onChange={(e) => setHeaderForm({ ...headerForm, limiteTotal: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase">Limite Utilizado</label>
              <Input type="number" value={headerForm.limiteUtilizado} onChange={(e) => setHeaderForm({ ...headerForm, limiteUtilizado: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase">Limite Disponível</label>
              <Input type="number" value={headerForm.limiteDisponivel} onChange={(e) => setHeaderForm({ ...headerForm, limiteDisponivel: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleSaveHeader} disabled={updateCardMut.isPending}>
              <Save className="w-3.5 h-3.5 mr-1" /> Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingHeader(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Spreadsheet Table */}
      {isExpanded && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-2 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Data</th>
                  <th className="px-2 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Estabelecimento</th>
                  <th className="px-2 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Descrição</th>
                  <th className="px-2 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Centro Custo</th>
                  <th className="px-2 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap text-right">Valor Total</th>
                  <th className="px-2 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap text-center">Parc.</th>
                  <th className="px-2 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap text-right">Vl. Parcela</th>
                  {monthColumns.map(m => (
                    <th key={m} className="px-2 py-2.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider whitespace-nowrap text-right bg-blue-50/30">
                      {formatMonthLabel(m)}
                    </th>
                  ))}
                  <th className="px-2 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Início</th>
                  <th className="px-2 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-16"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: any) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    monthColumns={monthColumns}
                    onSave={(data) => handleUpdateEntry(entry.id, data)}
                    onDelete={() => handleDeleteEntry(entry.id)}
                    fechamentoFatura={card.fechamentoFatura ? parseInt(card.fechamentoFatura) : undefined}
                  />
                ))}
                {addingEntryKey > 0 && (
                  <EntryRow
                    key={`new-${addingEntryKey}`}
                    entry={{}}
                    monthColumns={monthColumns}
                    onSave={handleSaveEntry}
                    onDelete={() => setAddingEntryKey(0)}
                    isNew
                    fechamentoFatura={card.fechamentoFatura ? parseInt(card.fechamentoFatura) : undefined}
                  />
                )}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300">
                  <td colSpan={7} className="px-2 py-2.5 text-xs font-bold text-slate-700 uppercase">
                    Total por Mês
                  </td>
                  {monthColumns.map(m => (
                    <td key={m} className="px-2 py-2.5 text-xs font-bold text-blue-800 text-right bg-blue-50/50">
                      {monthTotals[m] > 0 ? formatCurrency(monthTotals[m]) : "—"}
                    </td>
                  ))}
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Add entry button - always visible */}
          <div className="p-3 border-t border-slate-100">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddingEntryKey(k => k + 1)}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Novo Lançamento
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Tab Component
export default function CreditCardTab() {
  const { operator } = useOperator();
  const operatorName = operator?.name || "";
  const hasAccess = CREDIT_CARD_ALLOWED.includes(operatorName);

  const { data: cardsData, isLoading } = trpc.creditCard.listCards.useQuery(
    { operatorName },
    { enabled: hasAccess, refetchInterval: 30000 }
  );
  const cards = cardsData?.cards || [];

  const utils = trpc.useUtils();
  const createCardMut = trpc.creditCard.createCard.useMutation({
    onSuccess: () => { utils.creditCard.listCards.invalidate(); toast.success("Cartão criado"); setShowNewCard(false); },
    onError: (e) => toast.error(e.message),
  });

  const [showNewCard, setShowNewCard] = useState(false);
  const [newCardForm, setNewCardForm] = useState({
    titularCartao: "",
    vencimentoFatura: "",
    fechamentoFatura: "",
    limiteTotal: "",
  });

  const handleCreateCard = () => {
    if (!newCardForm.titularCartao.trim()) {
      toast.error("Informe o titular do cartão");
      return;
    }
    createCardMut.mutate({
      operatorName,
      titularCartao: newCardForm.titularCartao,
      vencimentoFatura: newCardForm.vencimentoFatura ? parseInt(newCardForm.vencimentoFatura) : undefined,
      fechamentoFatura: newCardForm.fechamentoFatura ? parseInt(newCardForm.fechamentoFatura) : undefined,
      limiteTotal: newCardForm.limiteTotal ? parseFloat(newCardForm.limiteTotal) : undefined,
    });
  };

  // Access denied
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">Acesso Restrito</h3>
        <p className="text-sm text-slate-500">Esta planilha é restrita ao Guilherme e Flávio.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-3 border-slate-300 border-t-teal-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-600" />
            Planilha de Cartões de Crédito
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Controle de despesas parceladas por cartão</p>
        </div>
        <Button onClick={() => setShowNewCard(true)} disabled={showNewCard} size="sm" className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-1" /> Novo Cartão
        </Button>
      </div>

      {/* New Card Form */}
      {showNewCard && (
        <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-sm space-y-3">
          <h4 className="font-semibold text-sm text-slate-700">Adicionar Novo Cartão</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase">Titular *</label>
              <Input
                value={newCardForm.titularCartao}
                onChange={(e) => setNewCardForm({ ...newCardForm, titularCartao: e.target.value })}
                className="h-8 text-xs"
                placeholder="Ex: BRADESCO ESPETOS"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase">Vencimento (dia)</label>
              <Input
                type="number"
                min="1"
                max="31"
                value={newCardForm.vencimentoFatura}
                onChange={(e) => setNewCardForm({ ...newCardForm, vencimentoFatura: e.target.value })}
                className="h-8 text-xs"
                placeholder="10"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase">Fechamento (dia)</label>
              <Input
                type="number"
                min="1"
                max="31"
                value={newCardForm.fechamentoFatura}
                onChange={(e) => setNewCardForm({ ...newCardForm, fechamentoFatura: e.target.value })}
                className="h-8 text-xs"
                placeholder="2"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase">Limite Total</label>
              <Input
                type="number"
                value={newCardForm.limiteTotal}
                onChange={(e) => setNewCardForm({ ...newCardForm, limiteTotal: e.target.value })}
                className="h-8 text-xs"
                placeholder="50000"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleCreateCard} disabled={createCardMut.isPending} className="bg-purple-600 hover:bg-purple-700">
              <Save className="w-3.5 h-3.5 mr-1" /> Criar Cartão
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowNewCard(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Cards List */}
      {cards.length === 0 && !showNewCard ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-sm font-semibold text-slate-600 mb-1">Nenhum cartão cadastrado</h3>
          <p className="text-xs text-slate-400">Clique em "Novo Cartão" para começar.</p>
        </div>
      ) : (
        cards.map((card: any) => (
          <CardSpreadsheet key={card.id} card={card} operatorName={operatorName} />
        ))
      )}
    </div>
  );
}
