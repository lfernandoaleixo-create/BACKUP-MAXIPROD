/**
 * Sub-aba Inadimplência - Gestão de Cobrança
 * Reutiliza o InadimplenciaCard existente e adiciona funcionalidades de cobrança
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
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpDown,
  Users,
  Phone,
  Mail,
  Clock,
  FileText,
  TrendingDown,
  Calendar,
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

function daysOverdue(dateStr: string): number {
  const d = dateStr.split("T")[0];
  const venc = new Date(d + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.floor((today.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
}

function getAgingBucket(days: number): string {
  if (days <= 15) return "1-15 dias";
  if (days <= 30) return "16-30 dias";
  if (days <= 60) return "31-60 dias";
  if (days <= 90) return "61-90 dias";
  return "90+ dias";
}

function getAgingColor(days: number): string {
  if (days <= 15) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  if (days <= 30) return "bg-orange-100 text-orange-700 border-orange-200";
  if (days <= 60) return "bg-red-100 text-red-700 border-red-200";
  if (days <= 90) return "bg-red-200 text-red-800 border-red-300";
  return "bg-red-300 text-red-900 border-red-400";
}

/* ---- Client Card ---- */
function ClientDebtCard({ client, isExpanded, onToggle }: {
  client: {
    cliente: string;
    total: number;
    totalOriginal: number;
    totalPago: number;
    count: number;
    vendedor: string;
    titulos: { valor: number; vencimento: string; referenteA: string; documento: string; parcela: string; empresa: string }[];
  };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const maxDays = Math.max(...client.titulos.map(t => daysOverdue(t.vencimento)));
  const agingColor = getAgingColor(maxDays);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${agingColor}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-bold text-slate-800">{client.cliente}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500">{client.count} título{client.count !== 1 ? "s" : ""}</span>
              {client.vendedor && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-blue-600 font-medium">{client.vendedor}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge className={`text-xs ${agingColor}`}>
            <Clock className="w-3 h-3 mr-1" />
            {maxDays}d atraso
          </Badge>
          <div className="text-right min-w-[110px]">
            <p className="text-sm font-bold text-red-700">{formatCurrency(client.total)}</p>
            {client.totalPago > 0 && (
              <p className="text-[10px] text-slate-400">Pago parcial: {formatCurrency(client.totalPago)}</p>
            )}
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {/* Títulos do cliente */}
          <div className="overflow-y-auto max-h-[300px]">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-500 uppercase">Referência</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-500 uppercase">Documento</th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-500 uppercase">Valor</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-500 uppercase">Vencimento</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-500 uppercase">Atraso</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-500 uppercase">Empresa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {client.titulos.map((titulo, idx) => {
                  const days = daysOverdue(titulo.vencimento);
                  return (
                    <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                      <td className="px-2 py-1.5">
                        <span className="text-xs text-slate-700 truncate block max-w-[180px]">{titulo.referenteA || "—"}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-xs text-slate-600">{titulo.documento || "—"}</span>
                        {titulo.parcela && <span className="text-[10px] text-slate-400 ml-1">({titulo.parcela})</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <span className="text-xs font-semibold text-red-700">{formatCurrency(titulo.valor)}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-xs text-slate-600">{formatDate(titulo.vencimento)}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge className={`text-[10px] ${getAgingColor(days)}`}>{days}d</Badge>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-[10px] text-slate-500 truncate block max-w-[100px]">{titulo.empresa || "—"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Main InadimplenciaTab Component ---- */
export default function InadimplenciaTab() {
  const { data: clientes, isLoading } = trpc.financial.getClientesInadimplentes.useQuery();
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"total" | "dias" | "nome" | "count">("total");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const filteredClientes = useMemo(() => {
    if (!clientes) return [];
    let filtered = [...clientes];
    if (search) {
      const s = search.toUpperCase();
      filtered = filtered.filter(c =>
        c.cliente.toUpperCase().includes(s) ||
        c.vendedor.toUpperCase().includes(s)
      );
    }
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "total") cmp = a.total - b.total;
      else if (sortBy === "dias") {
        const maxA = Math.max(...a.titulos.map(t => daysOverdue(t.vencimento)));
        const maxB = Math.max(...b.titulos.map(t => daysOverdue(t.vencimento)));
        cmp = maxA - maxB;
      } else if (sortBy === "nome") cmp = a.cliente.localeCompare(b.cliente);
      else cmp = a.count - b.count;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return filtered;
  }, [clientes, search, sortBy, sortDir]);

  // Calcular aging buckets
  const agingBuckets = useMemo(() => {
    if (!clientes) return [];
    const buckets: Record<string, { label: string; total: number; count: number; color: string }> = {
      "1-15": { label: "1-15 dias", total: 0, count: 0, color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
      "16-30": { label: "16-30 dias", total: 0, count: 0, color: "bg-orange-100 text-orange-700 border-orange-200" },
      "31-60": { label: "31-60 dias", total: 0, count: 0, color: "bg-red-100 text-red-700 border-red-200" },
      "61-90": { label: "61-90 dias", total: 0, count: 0, color: "bg-red-200 text-red-800 border-red-300" },
      "90+": { label: "90+ dias", total: 0, count: 0, color: "bg-red-300 text-red-900 border-red-400" },
    };
    for (const c of clientes) {
      for (const t of c.titulos) {
        const days = daysOverdue(t.vencimento);
        let key = "90+";
        if (days <= 15) key = "1-15";
        else if (days <= 30) key = "16-30";
        else if (days <= 60) key = "31-60";
        else if (days <= 90) key = "61-90";
        buckets[key].total += t.valor;
        buckets[key].count++;
      }
    }
    return Object.values(buckets).filter(b => b.count > 0);
  }, [clientes]);

  const totalInadimplencia = clientes?.reduce((s, c) => s + c.total, 0) || 0;
  const totalTitulos = clientes?.reduce((s, c) => s + c.count, 0) || 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-3" />
        <p className="text-sm text-slate-500">Carregando inadimplência...</p>
      </div>
    );
  }

  if (!clientes || clientes.length === 0) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
        <h2 className="text-lg font-semibold text-slate-600 mb-2">Sem inadimplência</h2>
        <p className="text-sm text-slate-400">Nenhum título vencido encontrado. Parabéns!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com totais */}
      <div className="bg-white rounded-lg border border-red-200 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Gestão de Cobrança
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {filteredClientes.length} cliente{filteredClientes.length !== 1 ? "s" : ""} com{" "}
              {totalTitulos} título{totalTitulos !== 1 ? "s" : ""} vencido{totalTitulos !== 1 ? "s" : ""} totalizando{" "}
              <span className="font-bold text-red-700">{formatCurrency(totalInadimplencia)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Aging buckets */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-slate-500" />
          Aging - Tempo de Atraso
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {agingBuckets.map((bucket, idx) => (
            <div key={idx} className={`rounded-lg border p-3 ${bucket.color}`}>
              <p className="text-xs font-medium opacity-80">{bucket.label}</p>
              <p className="text-lg font-bold mt-1">{formatCurrency(bucket.total)}</p>
              <p className="text-xs opacity-70">{bucket.count} título{bucket.count !== 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Sort */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar cliente ou vendedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="total">Valor Total</SelectItem>
            <SelectItem value="dias">Dias Atraso</SelectItem>
            <SelectItem value="nome">Nome</SelectItem>
            <SelectItem value="count">Qtd Títulos</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3"
          onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
        >
          {sortDir === "desc" ? "↓ Maior" : "↑ Menor"}
        </Button>
      </div>

      {/* Lista de clientes inadimplentes */}
      <div className="space-y-3">
        {filteredClientes.map((client, idx) => (
          <ClientDebtCard
            key={idx}
            client={client}
            isExpanded={expandedClient === client.cliente}
            onToggle={() => setExpandedClient(expandedClient === client.cliente ? null : client.cliente)}
          />
        ))}
      </div>

      {filteredClientes.length === 0 && search && (
        <div className="text-center py-8 text-slate-400">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum cliente encontrado para "{search}"</p>
        </div>
      )}
    </div>
  );
}
