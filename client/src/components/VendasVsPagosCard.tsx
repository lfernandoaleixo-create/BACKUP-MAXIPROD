/**
 * Card: Vendas vs Contas Pagas
 * Compara o total de pedidos de venda (Aprovados + A aprovar + Faturados)
 * com as contas efetivamente pagas no mesmo período.
 *
 * Reutiliza o mesmo sistema de cache/avisos de contas pagas do FaturamentoVsPagosCard.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Loader2, TrendingUp, TrendingDown, ShoppingCart, CreditCard, BarChart3,
  Calendar, Info, Database, AlertTriangle
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

type PeriodPreset = "mes_atual" | "mes_anterior" | "custom";

function getPeriodDates(preset: PeriodPreset): { start: string; end: string } {
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const today = `${curY}-${String(curM).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  switch (preset) {
    case "mes_atual": {
      const start = `${curY}-${String(curM).padStart(2, '0')}-01`;
      return { start, end: today };
    }
    case "mes_anterior": {
      const prevDate = new Date(curY, curM - 2, 1);
      const prevY = prevDate.getFullYear();
      const prevM = prevDate.getMonth() + 1;
      const lastDay = new Date(prevY, prevM, 0).getDate();
      return {
        start: `${prevY}-${String(prevM).padStart(2, '0')}-01`,
        end: `${prevY}-${String(prevM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      };
    }
    default:
      return { start: "", end: "" };
  }
}

export default function VendasVsPagosCard() {
  const [period, setPeriod] = useState<PeriodPreset>("mes_atual");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const dates = useMemo(() => {
    if (period === "custom" && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return getPeriodDates(period);
  }, [period, customStart, customEnd]);

  const { data, isLoading } = trpc.financial.getSalesVsPaid.useQuery(
    dates.start && dates.end ? { startDate: dates.start, endDate: dates.end } : undefined,
    { enabled: !!(dates.start && dates.end) }
  );

  const handlePeriodChange = (val: string) => {
    setPeriod(val as PeriodPreset);
    if (val !== "custom") {
      setCustomStart("");
      setCustomEnd("");
    }
  };

  const applyCustomDates = () => {
    const startEl = document.getElementById("sales-vs-paid-custom-start") as HTMLInputElement | null;
    const endEl = document.getElementById("sales-vs-paid-custom-end") as HTMLInputElement | null;
    const s = startEl?.value || customStart;
    const e = endEl?.value || customEnd;
    if (s && e) {
      setCustomStart(s);
      setCustomEnd(e);
      setPeriod("custom");
    }
  };

  const periodLabel = useMemo(() => {
    if (!dates.start || !dates.end) return "";
    const [sY, sM, sD] = dates.start.split("-").map(Number);
    const [eY, eM, eD] = dates.end.split("-").map(Number);
    const startD = new Date(sY, sM - 1, sD);
    const endD = new Date(eY, eM - 1, eD);
    return `${startD.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} a ${endD.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`;
  }, [dates]);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header with period selector */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Vendas vs Contas Pagas
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-44 h-8 text-xs bg-white">
                <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes_atual">Mes Atual</SelectItem>
                <SelectItem value="mes_anterior">Mes Anterior</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {period === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input
                  id="sales-vs-paid-custom-start"
                  type="date"
                  className="h-8 text-xs w-32"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className="text-xs text-slate-400">a</span>
                <Input
                  id="sales-vs-paid-custom-end"
                  type="date"
                  className="h-8 text-xs w-32"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
                <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={applyCustomDates}>
                  Aplicar
                </Button>
              </div>
            )}

            {periodLabel && (
              <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded">
                {periodLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="px-5 py-8 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      ) : !data ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">
          Selecione um periodo para visualizar
        </div>
      ) : (
        <CardContent data={data} />
      )}
    </div>
  );
}

interface SalesVsPaidData {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  vendas: { total: number; pedidos: number; itens: number };
  contasPagas: { total: number; count: number; isFromCache?: boolean; isComplete?: boolean };
  saldo: number;
}

function CardContent({ data }: { data: SalesVsPaidData }) {
  const { vendas, contasPagas, saldo } = data;
  const isPositive = saldo >= 0;

  // Calculate bar widths proportionally
  const maxVal = Math.max(vendas.total, contasPagas.total, 1);
  const vendasPct = (vendas.total / maxVal) * 100;
  const pagPct = (contasPagas.total / maxVal) * 100;

  // Data quality indicators
  const isFromCache = contasPagas.isFromCache === true;
  const isComplete = contasPagas.isComplete !== false;
  const hasNoPaidData = contasPagas.count === 0 && contasPagas.total === 0;

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Data quality warning */}
      {hasNoPaidData && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-700">
            <span className="font-semibold">Dados indisponiveis:</span> O Maxiprod nao possui dados de contas pagas para este periodo.
            Dados historicos sao retidos por aproximadamente 2 meses. A partir de agora, os dados serao salvos localmente para manter o historico.
          </div>
        </div>
      )}

      {!isComplete && !hasNoPaidData && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-700">
            <span className="font-semibold">Dados parciais:</span> O valor de contas pagas pode estar incompleto para este periodo.
            O Maxiprod retém dados por ~2 meses. Apenas {contasPagas.count} contas foram encontradas.
          </div>
        </div>
      )}

      {/* Vendas Row */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-slate-600">Vendas (Pedidos)</span>
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {vendas.pedidos} pedidos
            </span>
          </div>
          <span className="text-sm font-bold text-blue-700">{formatCurrency(vendas.total)}</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-700"
            style={{ width: `${vendasPct}%` }}
          />
        </div>
      </div>

      {/* Contas Pagas Row */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-slate-600">Contas Pagas</span>
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {contasPagas.count} contas
            </span>
            {isFromCache && (
              <Tooltip>
                <TooltipTrigger>
                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    <Database className="w-2.5 h-2.5" />
                    Dados salvos
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Estes dados foram salvos localmente porque o Maxiprod nao retém contas pagas por mais de ~2 meses.
                  O valor reflete o snapshot salvo anteriormente.
                </TooltipContent>
              </Tooltip>
            )}
            {!isComplete && !hasNoPaidData && (
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Dados possivelmente incompletos. O Maxiprod retém dados de contas pagas por ~2 meses.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <span className="text-sm font-bold text-red-600">{formatCurrency(contasPagas.total)}</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-400 rounded-full transition-all duration-700"
            style={{ width: `${pagPct}%` }}
          />
        </div>
      </div>

      {/* Saldo / Difference */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-lg ${
        isPositive ? "bg-blue-50 border border-blue-200" : "bg-red-50 border border-red-200"
      }`}>
        <div className="flex items-center gap-2">
          {isPositive ? (
            <TrendingUp className="w-5 h-5 text-blue-600" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-600" />
          )}
          <span className={`text-sm font-semibold ${isPositive ? "text-blue-700" : "text-red-700"}`}>
            {isPositive ? "Saldo Positivo" : "Saldo Negativo"}
          </span>
        </div>
        <span className={`text-lg font-bold ${isPositive ? "text-blue-700" : "text-red-700"}`}>
          {isPositive ? "+" : ""}{formatCurrency(saldo)}
        </span>
      </div>
    </div>
  );
}
