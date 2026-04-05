/**
 * Sub-aba Recebíveis - Controle de recebíveis por banco e tipo
 */
import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Landmark,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpDown,
  TrendingUp,
  AlertTriangle,
  Building2,
  Filter,
  FileText,
} from "lucide-react";

/* ---- Helpers ---- */
function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
  if (n < 0) return formatted.replace("R$", "R$ -");
  return formatted;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = dateStr.split("T")[0];
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = dateStr.split("T")[0];
  const venc = new Date(d + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.floor((venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function DueBadge({ dateStr }: { dateStr: string | null }) {
  const days = daysUntil(dateStr);
  if (days === null) return <Badge variant="outline" className="text-xs">—</Badge>;
  if (days < 0) return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">{Math.abs(days)}d atraso</Badge>;
  if (days === 0) return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Hoje</Badge>;
  if (days <= 7) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">{days}d</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">{days}d</Badge>;
}

/* ---- Bank Card ---- */
function BankCard({ bank, isExpanded, onToggle, items }: {
  bank: { banco: string; total: number; count: number; vencido: number; aVencer: number };
  isExpanded: boolean;
  onToggle: () => void;
  items: any[];
}) {
  const [sortBy, setSortBy] = useState<"vencimento" | "valor" | "cliente">("vencimento");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    let filtered = items.filter(i => i.banco === bank.banco);
    if (search) {
      const s = search.toUpperCase();
      filtered = filtered.filter(i =>
        i.cliente.toUpperCase().includes(s) ||
        i.referenteA.toUpperCase().includes(s) ||
        i.documento.toUpperCase().includes(s)
      );
    }
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "vencimento") cmp = a.vencimento.localeCompare(b.vencimento);
      else if (sortBy === "valor") cmp = a.valorAReceber - b.valorAReceber;
      else cmp = a.cliente.localeCompare(b.cliente);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return filtered;
  }, [items, bank.banco, search, sortBy, sortDir]);

  const pctVencido = bank.total > 0 ? (bank.vencido / bank.total) * 100 : 0;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <Landmark className="w-4 h-4 text-blue-700" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-bold text-slate-800">{bank.banco}</h4>
            <p className="text-xs text-slate-500">{bank.count} título{bank.count !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {bank.vencido > 0 && (
            <div className="text-right">
              <span className="text-xs text-red-600 font-medium">Vencido</span>
              <p className="text-xs font-bold text-red-700">{formatCurrency(bank.vencido)}</p>
            </div>
          )}
          <div className="text-right">
            <span className="text-xs text-emerald-600 font-medium">A Vencer</span>
            <p className="text-xs font-bold text-emerald-700">{formatCurrency(bank.aVencer)}</p>
          </div>
          <div className="text-right min-w-[100px]">
            <span className="text-xs text-slate-500">Total</span>
            <p className="text-sm font-bold text-slate-800">{formatCurrency(bank.total)}</p>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-1">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
          {bank.vencido > 0 && (
            <div className="h-full bg-red-400 rounded-l-full" style={{ width: `${pctVencido}%` }} />
          )}
          <div className="h-full bg-emerald-400" style={{ width: `${100 - pctVencido}%` }} />
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {/* Search & Sort */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar cliente, documento..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <ArrowUpDown className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vencimento">Vencimento</SelectItem>
                <SelectItem value="valor">Valor</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
            >
              {sortDir === "asc" ? "↑" : "↓"}
            </Button>
          </div>

          {/* Items table */}
          <div className="overflow-y-auto max-h-[400px]">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-500 uppercase">Cliente</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-500 uppercase">Ref.</th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-500 uppercase">Valor</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-500 uppercase">Venc.</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-500 uppercase">Prazo</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-500 uppercase">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, idx) => (
                  <tr key={idx} className={`hover:bg-slate-50 transition-colors ${item.isOverdue ? "bg-red-50/30" : ""}`}>
                    <td className="px-2 py-1.5">
                      <span className="text-xs font-medium text-slate-800 truncate block max-w-[200px]">{item.cliente}</span>
                      {item.documento && <span className="text-[10px] text-slate-400 block">{item.documento} {item.parcela && `(${item.parcela})`}</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="text-xs text-slate-600 truncate block max-w-[150px]">{item.referenteA || "—"}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span className={`text-xs font-semibold ${item.isOverdue ? "text-red-700" : "text-slate-800"}`}>
                        {formatCurrency(item.valorAReceber)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="text-xs text-slate-600">{formatDate(item.vencimento)}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <DueBadge dateStr={item.vencimento} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Badge variant="outline" className="text-[10px]">{item.tipo}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredItems.length === 0 && (
            <div className="text-center py-6 text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Nenhum título encontrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Type Summary Card ---- */
function TypeSummaryCard({ types }: { types: { tipo: string; total: number; count: number }[] }) {
  const tipoLabels: Record<string, string> = {
    TITULO: "Títulos",
    RECEITA: "Receitas",
    ADIANTAMENTO: "Adiantamentos",
    Outros: "Outros",
  };

  const tipoColors: Record<string, string> = {
    TITULO: "bg-blue-100 text-blue-700 border-blue-200",
    RECEITA: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ADIANTAMENTO: "bg-amber-100 text-amber-700 border-amber-200",
    Outros: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
      <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-slate-500" />
        Por Tipo de Recebimento
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {types.map((t, idx) => (
          <div key={idx} className={`rounded-lg border p-3 ${tipoColors[t.tipo] || tipoColors.Outros}`}>
            <p className="text-xs font-medium opacity-80">{tipoLabels[t.tipo] || t.tipo}</p>
            <p className="text-lg font-bold mt-1">{formatCurrency(t.total)}</p>
            <p className="text-xs opacity-70">{t.count} título{t.count !== 1 ? "s" : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Main ReceivablesTab Component ---- */
export default function ReceivablesTab() {
  const [expandedBank, setExpandedBank] = useState<string | null>(null);
  const [estadoFilter, setEstadoFilter] = useState<"EMITIDO" | "RECEBIDO" | "ALL">("EMITIDO");

  const { data, isLoading } = trpc.financial.getReceivablesByBank.useQuery({
    estado: estadoFilter,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-slate-500">Carregando recebíveis...</p>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="text-center py-20">
        <Landmark className="w-16 h-16 mx-auto mb-4 text-slate-300" />
        <h2 className="text-lg font-semibold text-slate-600 mb-2">Sem recebíveis</h2>
        <p className="text-sm text-slate-400">Nenhum recebível encontrado para o filtro selecionado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com totais e filtro */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Recebíveis
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {data.totals.count} título{data.totals.count !== 1 ? "s" : ""} totalizando{" "}
              <span className="font-bold text-emerald-700">{formatCurrency(data.totals.total)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={estadoFilter} onValueChange={(v: any) => setEstadoFilter(v)}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMITIDO">Em Aberto</SelectItem>
                <SelectItem value="RECEBIDO">Recebidos</SelectItem>
                <SelectItem value="ALL">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Cards por tipo */}
      {data.byType.length > 0 && <TypeSummaryCard types={data.byType} />}

      {/* Cards por banco */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 px-1">
          <Building2 className="w-4 h-4 text-slate-500" />
          Por Banco / Conta
        </h3>
        {data.byBank.map((bank, idx) => (
          <BankCard
            key={idx}
            bank={bank}
            isExpanded={expandedBank === bank.banco}
            onToggle={() => setExpandedBank(expandedBank === bank.banco ? null : bank.banco)}
            items={data.items}
          />
        ))}
      </div>
    </div>
  );
}
