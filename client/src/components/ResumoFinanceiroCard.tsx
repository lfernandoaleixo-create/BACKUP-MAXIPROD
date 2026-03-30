/**
 * Card Unificado: Resumo Financeiro (Recebimentos, Outras Entradas, Faturamento, Vendas e Contas Pagas)
 * 
 * Modo compacto: mostra 5 valores principais + saldos
 * Modo expandido: revela barras de progresso, detalhes e avisos de dados parciais
 * Cada barra é expansível para mostrar a lista de itens que compõem o valor
 * Tabelas de detalhe com colunas ordenáveis (setinhas)
 * 
 * Lógica de fechamento:
 * Recebimentos (clientes) + Outras Entradas = Total Entradas
 * Total Entradas - Contas Pagas = Variação do Saldo
 */

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Loader2, TrendingUp, TrendingDown, Receipt, ShoppingCart, CreditCard,
  Calendar, Info, Database, AlertTriangle, ChevronDown, ChevronRight, Scale,
  ChevronUp, List, ArrowUpDown, ArrowUp, ArrowDown, Banknote, ArrowRightLeft,
  Wallet, PiggyBank
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

function formatCurrencyShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `R$ ${(n / 1_000).toFixed(0)}K`;
  }
  return formatCurrency(n);
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === '-') return '-';
  const d = dateStr.slice(0, 10);
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

type SortDir = "asc" | "desc";

/** Reusable sortable header component */
function SortHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  align = "left",
  colorClass = "text-slate-600",
}: {
  label: string;
  field: string;
  currentField: string;
  currentDir: SortDir;
  onSort: (field: string) => void;
  align?: "left" | "center" | "right";
  colorClass?: string;
}) {
  const isActive = currentField === field;
  const alignClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

  return (
    <th
      className={`px-3 py-2 font-semibold cursor-pointer hover:bg-black/5 select-none transition-colors text-${align} ${colorClass}`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-1 ${alignClass}`}>
        <span>{label}</span>
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </div>
    </th>
  );
}

/** Hook for managing sort state */
function useSort(defaultField: string, defaultDir: SortDir = "desc") {
  const [sortField, setSortField] = useState(defaultField);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  return { sortField, sortDir, handleSort };
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

export default function ResumoFinanceiroCard() {
  const [period, setPeriod] = useState<PeriodPreset>("mes_atual");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expanded, setExpanded] = useState(false);

  const dates = useMemo(() => {
    if (period === "custom" && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return getPeriodDates(period);
  }, [period, customStart, customEnd]);

  const queryInput = dates.start && dates.end ? { startDate: dates.start, endDate: dates.end } : undefined;
  const enabled = !!(dates.start && dates.end);

  const { data: receivedData, isLoading: receivedLoading } = trpc.financial.getReceivedTotal.useQuery(
    queryInput, { enabled }
  );
  const { data: otherInflowsData, isLoading: otherInflowsLoading } = trpc.financial.getOtherInflowsTotal.useQuery(
    queryInput, { enabled }
  );
  const { data: billingData, isLoading: billingLoading } = trpc.financial.getMonthlyBillingVsPaid.useQuery(
    queryInput, { enabled }
  );
  const { data: salesData, isLoading: salesLoading } = trpc.financial.getSalesVsPaid.useQuery(
    queryInput, { enabled }
  );

  const isLoading = receivedLoading || otherInflowsLoading || billingLoading || salesLoading;

  const handlePeriodChange = (val: string) => {
    setPeriod(val as PeriodPreset);
    if (val !== "custom") {
      setCustomStart("");
      setCustomEnd("");
    }
  };

  const applyCustomDates = () => {
    const startEl = document.getElementById("resumo-custom-start") as HTMLInputElement | null;
    const endEl = document.getElementById("resumo-custom-end") as HTMLInputElement | null;
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
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-teal-500">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center">
              <Scale className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-700 uppercase tracking-wide">
              Resumo Financeiro
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
                  id="resumo-custom-start"
                  type="date"
                  className="h-8 text-xs w-32"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className="text-xs text-slate-400">a</span>
                <Input
                  id="resumo-custom-end"
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
      ) : !billingData && !salesData && !receivedData ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">
          Selecione um periodo para visualizar
        </div>
      ) : (
        <>
          {/* Compact Summary - always visible */}
          <CompactSummary
            receivedData={receivedData}
            otherInflowsData={otherInflowsData}
            billingData={billingData}
            salesData={salesData}
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
          />

          {/* Expanded Details */}
          {expanded && (
            <ExpandedDetails
              receivedData={receivedData}
              otherInflowsData={otherInflowsData}
              billingData={billingData}
              salesData={salesData}
              dates={dates}
            />
          )}
        </>
      )}
    </div>
  );
}

interface ReceivedData {
  periodStart: string;
  periodEnd: string;
  recebimentos: { total: number; count: number };
}

interface OtherInflowsData {
  periodStart: string;
  periodEnd: string;
  outrasEntradas: { total: number; count: number };
}

interface BillingData {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  contasLabel: string;
  faturamento: { total: number; count: number };
  contasPagar: { total: number; count: number; isFromCache?: boolean; isComplete?: boolean; excludedCount?: number; excludedTotal?: number };
  saldo: number;
}

interface SalesData {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  vendas: { total: number; pedidos: number; itens: number };
  contasPagas: { total: number; count: number; isFromCache?: boolean; isComplete?: boolean };
  saldo: number;
}

function CompactSummary({
  receivedData,
  otherInflowsData,
  billingData,
  salesData,
  expanded,
  onToggle,
}: {
  receivedData: ReceivedData | null | undefined;
  otherInflowsData: OtherInflowsData | null | undefined;
  billingData: BillingData | null | undefined;
  salesData: SalesData | null | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  const recebimentos = receivedData?.recebimentos?.total ?? 0;
  const outrasEntradas = otherInflowsData?.outrasEntradas?.total ?? 0;
  const faturamento = billingData?.faturamento?.total ?? 0;
  const vendas = salesData?.vendas?.total ?? 0;
  const contasPagas = billingData?.contasPagar?.total ?? salesData?.contasPagas?.total ?? 0;
  
  const totalEntradas = recebimentos + outrasEntradas;
  const variacaoSaldo = totalEntradas - contasPagas;

  return (
    <div
      className="px-6 py-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
      onClick={onToggle}
    >
      {/* 4 cards alinhados: Entradas | Faturamento | Vendas | Contas Pagas */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {/* Card 1: Entradas (Recebimentos + Outras = Total) */}
        <div className="px-3.5 py-3.5 rounded-lg bg-amber-50/60 border border-amber-100">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Entradas</span>
          </div>
          <p className="text-lg font-bold text-amber-700 leading-tight text-center">{formatCurrency(totalEntradas)}</p>
          <div className="mt-2 pt-2 border-t border-amber-200/60 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Banknote className="w-3 h-3 text-amber-500" />
                Vendas/Revenda
              </span>
              <span className="text-[11px] font-semibold text-amber-600">{formatCurrencyShort(recebimentos)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                Demais Receitas
              </span>
              <span className="text-[11px] font-semibold text-slate-500">{formatCurrencyShort(outrasEntradas)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Faturamento */}
        <div className="text-center px-3 py-3.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <Receipt className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Faturamento</span>
          </div>
          <p className="text-lg font-bold text-emerald-700 leading-tight">{formatCurrency(faturamento)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{billingData?.faturamento?.count ?? 0} NFs emitidas</p>
        </div>

        {/* Card 3: Vendas */}
        <div className="text-center px-3 py-3.5 rounded-lg bg-blue-50/60 border border-blue-100">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
              <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendas</span>
          </div>
          <p className="text-lg font-bold text-blue-700 leading-tight">{formatCurrency(vendas)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{salesData?.vendas?.pedidos ?? 0} pedidos</p>
        </div>

        {/* Card 4: Contas Pagas */}
        <div className="text-center px-3 py-3.5 rounded-lg bg-red-50/60 border border-red-100">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5 text-red-500" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contas Pagas</span>
          </div>
          <p className="text-lg font-bold text-red-600 leading-tight">{formatCurrency(contasPagas)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{billingData?.contasPagar?.count ?? salesData?.contasPagas?.count ?? 0} contas</p>
        </div>
      </div>

      {/* Saldo row: Total Entradas - Contas Pagas = Variação */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Main balance: Total Entradas vs Contas Pagas */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${
            variacaoSaldo >= 0 ? "bg-teal-50 border border-teal-200" : "bg-red-50 border border-red-200"
          }`}>
            {variacaoSaldo >= 0 ? <TrendingUp className="w-4 h-4 text-teal-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
            <span className={`text-xs font-bold ${variacaoSaldo >= 0 ? "text-teal-700" : "text-red-700"}`}>
              Entradas vs Saidas: {variacaoSaldo >= 0 ? "+" : ""}{formatCurrency(variacaoSaldo)}
            </span>
          </div>

          {/* Secondary balances */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-slate-50">
            <span className={`text-[11px] font-semibold ${faturamento - contasPagas >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              Fat. vs Pago: {formatCurrency(faturamento - contasPagas)}
            </span>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-slate-50">
            <span className={`text-[11px] font-semibold ${vendas - contasPagas >= 0 ? "text-blue-600" : "text-red-600"}`}>
              Vendas vs Pago: {formatCurrency(vendas - contasPagas)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-teal-600 transition-colors">
          <span>{expanded ? "Recolher" : "Detalhes"}</span>
          {expanded ? (
            <ChevronUp className="w-4.5 h-4.5" />
          ) : (
            <ChevronDown className="w-4.5 h-4.5" />
          )}
        </div>
      </div>
    </div>
  );
}

function ExpandedDetails({
  receivedData,
  otherInflowsData,
  billingData,
  salesData,
  dates,
}: {
  receivedData: ReceivedData | null | undefined;
  otherInflowsData: OtherInflowsData | null | undefined;
  billingData: BillingData | null | undefined;
  salesData: SalesData | null | undefined;
  dates: { start: string; end: string };
}) {
  const [showReceivedDetail, setShowReceivedDetail] = useState(false);
  const [showOtherInflowsDetail, setShowOtherInflowsDetail] = useState(false);
  const [showBillingDetail, setShowBillingDetail] = useState(false);
  const [showSalesDetail, setShowSalesDetail] = useState(false);
  const [showPaidDetail, setShowPaidDetail] = useState(false);

  const recebimentos = receivedData?.recebimentos?.total ?? 0;
  const outrasEntradas = otherInflowsData?.outrasEntradas?.total ?? 0;
  const faturamento = billingData?.faturamento?.total ?? 0;
  const vendas = salesData?.vendas?.total ?? 0;
  const contasPagas = billingData?.contasPagar?.total ?? salesData?.contasPagas?.total ?? 0;
  const totalEntradas = recebimentos + outrasEntradas;
  const variacaoSaldo = totalEntradas - contasPagas;

  // Data quality from either source
  const paidInfo = billingData?.contasPagar ?? salesData?.contasPagas;
  const isFromCache = paidInfo?.isFromCache === true;
  const isComplete = paidInfo?.isComplete !== false;
  const hasNoPaidData = (paidInfo?.count ?? 0) === 0 && (paidInfo?.total ?? 0) === 0;

  // Bar calculations - max across all values
  const maxVal = Math.max(totalEntradas, faturamento, vendas, contasPagas, 1);
  const fatPct = (faturamento / maxVal) * 100;
  const vendasPct = (vendas / maxVal) * 100;
  const pagPct = (contasPagas / maxVal) * 100;

  return (
    <div className="px-6 pb-6 space-y-6 border-t border-slate-100 pt-5 bg-slate-50/30">
      {/* Data quality warnings */}
      {hasNoPaidData && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-700">
            <span className="font-semibold">Dados indisponiveis:</span> O Maxiprod nao possui dados de contas pagas para este periodo.
            Dados historicos sao retidos por aproximadamente 2 meses. A partir de agora, os dados serao salvos localmente.
          </div>
        </div>
      )}

      {!isComplete && !hasNoPaidData && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-700">
            <span className="font-semibold">Dados parciais:</span> O valor de contas pagas pode estar incompleto.
            O Maxiprod retém dados por ~2 meses. Apenas {paidInfo?.count ?? 0} contas foram encontradas.
          </div>
        </div>
      )}

      {/* Entradas: single stacked bar (Vendas/Revenda + Demais Receitas) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Wallet className="w-5 h-5 text-teal-600" />
            <span className="text-base font-semibold text-teal-700">Total Entradas</span>
            <span className="text-base font-bold text-teal-700">{formatCurrency(totalEntradas)}</span>
          </div>
        </div>

        {/* Stacked bar: Vendas/Revenda (amber) + Demais Receitas (gray) */}
        <div className="h-5 bg-slate-100 rounded-full overflow-hidden flex">
          {recebimentos > 0 && (
            <div
              className="h-full bg-amber-500 transition-all duration-700 relative"
              style={{ width: `${(recebimentos / Math.max(totalEntradas, contasPagas, 1)) * 100}%` }}
              title={`Vendas/Revenda: ${formatCurrency(recebimentos)}`}
            />
          )}
          {outrasEntradas > 0 && (
            <div
              className="h-full bg-slate-400 transition-all duration-700 relative"
              style={{ width: `${(outrasEntradas / Math.max(totalEntradas, contasPagas, 1)) * 100}%` }}
              title={`Demais Receitas: ${formatCurrency(outrasEntradas)}`}
            />
          )}
        </div>

        {/* Legend + expandable details */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            {/* Vendas/Revenda */}
            <div
              className="flex items-center gap-2 cursor-pointer hover:bg-amber-50 rounded-md px-2 py-1 -mx-2 transition-colors"
              onClick={() => setShowReceivedDetail(!showReceivedDetail)}
            >
              <div className="w-3 h-3 rounded-sm bg-amber-500" />
              <span className="text-xs text-slate-600 font-medium">Vendas/Revenda</span>
              <span className="text-xs font-bold text-amber-700">{formatCurrencyShort(recebimentos)}</span>
              <span className="text-[10px] text-slate-400">({receivedData?.recebimentos?.count ?? 0})</span>
              {showReceivedDetail ? (
                <ChevronUp className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
              )}
            </div>

            {/* Demais Receitas */}
            <div
              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 rounded-md px-2 py-1 -mx-2 transition-colors"
              onClick={() => setShowOtherInflowsDetail(!showOtherInflowsDetail)}
            >
              <div className="w-3 h-3 rounded-sm bg-slate-400" />
              <span className="text-xs text-slate-600 font-medium">Demais Receitas</span>
              <span className="text-xs font-bold text-slate-600">{formatCurrencyShort(outrasEntradas)}</span>
              <span className="text-[10px] text-slate-400">({otherInflowsData?.outrasEntradas?.count ?? 0})</span>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-2.5 h-2.5 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Receitas que não são de venda/revenda: empréstimos, rendimentos, reembolsos e outras receitas operacionais.
                </TooltipContent>
              </Tooltip>
              {showOtherInflowsDetail ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              )}
            </div>
          </div>
        </div>

        {/* Expandable detail tables */}
        {showReceivedDetail && (
          <ReceivedDetailTable startDate={dates.start} endDate={dates.end} />
        )}
        {showOtherInflowsDetail && (
          <OtherInflowsDetailTable startDate={dates.start} endDate={dates.end} />
        )}
      </div>

      {/* Faturamento bar + detail */}
      <div className="space-y-2">
        <div
          className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-md px-1.5 py-1 -mx-1.5 transition-colors"
          onClick={() => setShowBillingDetail(!showBillingDetail)}
        >
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-emerald-500" />
            <span className="text-base font-medium text-slate-600">Faturado (NFs emitidas)</span>
            <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              {billingData?.faturamento?.count ?? 0} NFs
            </span>
            <button className="text-[11px] text-teal-600 hover:text-teal-700 flex items-center gap-0.5">
              <List className="w-3.5 h-3.5" />
              {showBillingDetail ? "Ocultar" : "Ver itens"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-emerald-700">{formatCurrency(faturamento)}</span>
            {showBillingDetail ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${fatPct}%` }}
          />
        </div>
        {showBillingDetail && (
          <BillingDetailTable startDate={dates.start} endDate={dates.end} />
        )}
      </div>

      {/* Vendas bar + detail */}
      <div className="space-y-2">
        <div
          className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-md px-1.5 py-1 -mx-1.5 transition-colors"
          onClick={() => setShowSalesDetail(!showSalesDetail)}
        >
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="w-5 h-5 text-blue-500" />
            <span className="text-base font-medium text-slate-600">Vendas (Pedidos)</span>
            <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              {salesData?.vendas?.pedidos ?? 0} pedidos
            </span>
            <button className="text-[11px] text-teal-600 hover:text-teal-700 flex items-center gap-0.5">
              <List className="w-3.5 h-3.5" />
              {showSalesDetail ? "Ocultar" : "Ver itens"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-blue-700">{formatCurrency(vendas)}</span>
            {showSalesDetail ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-700"
            style={{ width: `${vendasPct}%` }}
          />
        </div>
        {showSalesDetail && (
          <SalesDetailTable startDate={dates.start} endDate={dates.end} />
        )}
      </div>

      {/* Contas Pagas bar + detail */}
      <div className="space-y-2">
        <div
          className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-md px-1.5 py-1 -mx-1.5 transition-colors"
          onClick={() => setShowPaidDetail(!showPaidDetail)}
        >
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-red-500" />
            <span className="text-base font-medium text-slate-600">Contas Pagas</span>
            <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              {paidInfo?.count ?? 0} contas
            </span>
            {(billingData?.contasPagar?.excludedCount ?? 0) > 0 && (
              <Tooltip>
                <TooltipTrigger>
                  <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {billingData?.contasPagar?.excludedCount} previsões excluídas
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {billingData?.contasPagar?.excludedCount} contas tipo DESPESA sem fornecedor foram excluídas (previsões/provisões).
                  Valor excluído: {formatCurrency(billingData?.contasPagar?.excludedTotal ?? 0)}
                </TooltipContent>
              </Tooltip>
            )}
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
            {!hasNoPaidData && !isFromCache && (
              <button className="text-[11px] text-teal-600 hover:text-teal-700 flex items-center gap-0.5">
                <List className="w-3.5 h-3.5" />
                {showPaidDetail ? "Ocultar" : "Ver itens"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-red-600">{formatCurrency(contasPagas)}</span>
            {!hasNoPaidData && !isFromCache && (
              showPaidDetail ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-400 rounded-full transition-all duration-700"
            style={{ width: `${pagPct}%` }}
          />
        </div>
        {showPaidDetail && !hasNoPaidData && !isFromCache && (
          <PaidDetailTable startDate={dates.start} endDate={dates.end} />
        )}
      </div>

      {/* Bottom summary: Total Entradas vs Contas Pagas = Variação */}
      <div className={`flex items-center justify-between px-5 py-4 rounded-lg shadow-sm ${
        variacaoSaldo >= 0 ? "bg-teal-50 border border-teal-200" : "bg-red-50 border border-red-200"
      }`}>
        <div className="flex items-center gap-3">
          {variacaoSaldo >= 0 ? (
            <PiggyBank className="w-6 h-6 text-teal-600" />
          ) : (
            <TrendingDown className="w-6 h-6 text-red-600" />
          )}
          <div>
            <span className={`text-sm uppercase tracking-wider font-semibold ${variacaoSaldo >= 0 ? "text-teal-600" : "text-red-600"}`}>
              Variacao do Saldo (Entradas - Saidas)
            </span>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatCurrency(totalEntradas)} (entradas) - {formatCurrency(contasPagas)} (saidas)
            </p>
          </div>
        </div>
        <span className={`text-xl font-bold ${variacaoSaldo >= 0 ? "text-teal-700" : "text-red-700"}`}>
          {variacaoSaldo >= 0 ? "+" : ""}{formatCurrency(variacaoSaldo)}
        </span>
      </div>

      {/* Secondary balances */}
      <div className="grid grid-cols-2 gap-3">
        {/* Faturamento vs Pago */}
        <div className={`flex items-center justify-between px-4 py-3 rounded-lg shadow-sm ${
          faturamento - contasPagas >= 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
        }`}>
          <div className="flex items-center gap-2">
            {faturamento - contasPagas >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            <span className={`text-xs uppercase tracking-wider font-semibold ${faturamento - contasPagas >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              Fat. vs Pago
            </span>
          </div>
          <span className={`text-base font-bold ${faturamento - contasPagas >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {faturamento - contasPagas >= 0 ? "+" : ""}{formatCurrency(faturamento - contasPagas)}
          </span>
        </div>

        {/* Vendas vs Pago */}
        <div className={`flex items-center justify-between px-4 py-3 rounded-lg shadow-sm ${
          vendas - contasPagas >= 0 ? "bg-blue-50 border border-blue-200" : "bg-red-50 border border-red-200"
        }`}>
          <div className="flex items-center gap-2">
            {vendas - contasPagas >= 0 ? (
              <TrendingUp className="w-4 h-4 text-blue-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            <span className={`text-xs uppercase tracking-wider font-semibold ${vendas - contasPagas >= 0 ? "text-blue-600" : "text-red-600"}`}>
              Vendas vs Pago
            </span>
          </div>
          <span className={`text-base font-bold ${vendas - contasPagas >= 0 ? "text-blue-700" : "text-red-700"}`}>
            {vendas - contasPagas >= 0 ? "+" : ""}{formatCurrency(vendas - contasPagas)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Detail Tables - lazy loaded when user expands each bar
 * With sortable column headers
 * ============================================================ */

interface ReceivedItem {
  descricao: string;
  valor: number;
  data: string;
  tipo: string;
  classificacao: 'vendas' | 'outras';
  contaCodigo: string;
  contaDescricao: string;
}

function ReceivedDetailTable({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, isLoading } = trpc.financial.getReceivedDetails.useQuery(
    { startDate, endDate },
    { staleTime: 5 * 60 * 1000 }
  );

  const { sortField, sortDir, handleSort } = useSort("valor", "desc");

  const sorted = useMemo(() => {
    if (!data) return [];
    const items = [...data] as ReceivedItem[];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "descricao":
          cmp = a.descricao.localeCompare(b.descricao);
          break;
        case "data":
          cmp = a.data.localeCompare(b.data);
          break;
        case "valor":
        default:
          cmp = a.valor - b.valor;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [data, sortField, sortDir]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-xs">Carregando detalhes...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-3 text-xs text-slate-400">
        Nenhum recebimento encontrado no periodo
      </div>
    );
  }

  return (
    <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 bg-amber-50/50 border-b border-amber-100 text-[10px] text-amber-600 flex items-center gap-1">
        <Info className="w-3 h-3" />
        Fonte: Maxiprod Financeiro &gt; Extrato detalhado por Receita e Despesa (contaAReceber)
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-amber-50 sticky top-0">
            <tr>
              <SortHeader label="Descricao" field="descricao" currentField={sortField} currentDir={sortDir} onSort={handleSort} colorClass="text-amber-700" />
              <th className="px-3 py-2 text-left text-amber-700 font-semibold text-[10px] uppercase">Tipo</th>
              <SortHeader label="Data" field="data" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="center" colorClass="text-amber-700" />
              <SortHeader label="Valor" field="valor" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="right" colorClass="text-amber-700" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-1.5 text-slate-700 max-w-[250px] truncate" title={item.descricao}>{item.descricao}</td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium ${item.classificacao === 'vendas' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {item.classificacao === 'vendas' ? 'Venda' : 'Outra'}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-center text-slate-500">{formatDate(item.data)}</td>
                <td className="px-3 py-1.5 text-right font-semibold text-amber-700">{formatCurrency(item.valor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-amber-50 border-t border-amber-200">
            <tr>
              <td colSpan={3} className="px-3 py-2 font-bold text-amber-800">Total ({sorted.length} entradas)</td>
              <td className="px-3 py-2 text-right font-bold text-amber-800">
                {formatCurrency(sorted.reduce((sum, i) => sum + i.valor, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

interface OtherInflowItem {
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
  contaCodigo: string;
}

function OtherInflowsDetailTable({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, isLoading } = trpc.financial.getOtherInflowsDetails.useQuery(
    { startDate, endDate },
    { staleTime: 5 * 60 * 1000 }
  );

  const { sortField, sortDir, handleSort } = useSort("valor", "desc");

  const sorted = useMemo(() => {
    if (!data) return [];
    const items = [...data] as OtherInflowItem[];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "descricao":
          cmp = a.descricao.localeCompare(b.descricao);
          break;
        case "categoria":
          cmp = a.categoria.localeCompare(b.categoria);
          break;
        case "data":
          cmp = a.data.localeCompare(b.data);
          break;
        case "valor":
        default:
          cmp = a.valor - b.valor;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [data, sortField, sortDir]);

  // Group by category for summary
  const categoryTotals = useMemo(() => {
    if (!sorted.length) return [];
    const map = new Map<string, { total: number; count: number }>();
    sorted.forEach(item => {
      const existing = map.get(item.categoria) || { total: 0, count: 0 };
      existing.total += item.valor;
      existing.count += 1;
      map.set(item.categoria, existing);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([cat, data]) => ({ categoria: cat, ...data }));
  }, [sorted]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-xs">Carregando detalhes...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-3 text-xs text-slate-400">
        Nenhuma outra entrada encontrada no periodo
      </div>
    );
  }

  return (
    <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 bg-slate-100/80 border-b border-slate-200 text-[10px] text-slate-500 flex items-center gap-1">
        <Info className="w-3 h-3" />
        Demais receitas (não-venda): empréstimos, rendimentos, reembolsos e outras receitas operacionais
      </div>
      {/* Category summary */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2">
        {categoryTotals.map((cat) => (
          <span key={cat.categoria} className="inline-flex items-center gap-1 text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-full">
            <span className="font-semibold text-slate-600">{cat.categoria}</span>
            <span className="text-slate-400">({cat.count})</span>
            <span className="font-bold text-slate-700">{formatCurrencyShort(cat.total)}</span>
          </span>
        ))}
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <SortHeader label="Descricao" field="descricao" currentField={sortField} currentDir={sortDir} onSort={handleSort} colorClass="text-slate-600" />
              <SortHeader label="Categoria" field="categoria" currentField={sortField} currentDir={sortDir} onSort={handleSort} colorClass="text-slate-600" />
              <SortHeader label="Data" field="data" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="center" colorClass="text-slate-600" />
              <SortHeader label="Valor" field="valor" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="right" colorClass="text-slate-600" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-1.5 text-slate-700 max-w-[250px] truncate" title={item.descricao}>{item.descricao}</td>
                <td className="px-3 py-1.5">
                  <span className="inline-flex items-center text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    {item.categoria}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-center text-slate-500">{formatDate(item.data)}</td>
                <td className="px-3 py-1.5 text-right font-semibold text-slate-700">{formatCurrency(item.valor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 border-t border-slate-200">
            <tr>
              <td colSpan={3} className="px-3 py-2 font-bold text-slate-700">Total ({sorted.length} entradas)</td>
              <td className="px-3 py-2 text-right font-bold text-slate-700">
                {formatCurrency(sorted.reduce((sum, i) => sum + i.valor, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

interface BillingItem {
  pedido: string;
  cliente: string;
  itens: number;
  data: string;
  total: number;
}

function BillingDetailTable({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, isLoading } = trpc.financial.getBillingDetails.useQuery(
    { startDate, endDate },
    { staleTime: 5 * 60 * 1000 }
  );

  const { sortField, sortDir, handleSort } = useSort("total", "desc");

  const sorted = useMemo(() => {
    if (!data) return [];
    const items = [...data] as BillingItem[];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "pedido":
          cmp = a.pedido.localeCompare(b.pedido);
          break;
        case "cliente":
          cmp = a.cliente.localeCompare(b.cliente);
          break;
        case "data":
          cmp = a.data.localeCompare(b.data);
          break;
        case "itens":
          cmp = a.itens - b.itens;
          break;
        case "total":
        default:
          cmp = a.total - b.total;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [data, sortField, sortDir]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-xs">Carregando detalhes...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-3 text-xs text-slate-400">
        Nenhuma NF encontrada no periodo
      </div>
    );
  }

  return (
    <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-emerald-50 sticky top-0">
            <tr>
              <SortHeader label="Pedido" field="pedido" currentField={sortField} currentDir={sortDir} onSort={handleSort} colorClass="text-emerald-700" />
              <SortHeader label="Cliente" field="cliente" currentField={sortField} currentDir={sortDir} onSort={handleSort} colorClass="text-emerald-700" />
              <SortHeader label="Itens" field="itens" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="center" colorClass="text-emerald-700" />
              <SortHeader label="Data" field="data" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="center" colorClass="text-emerald-700" />
              <SortHeader label="Total" field="total" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="right" colorClass="text-emerald-700" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-1.5 font-medium text-slate-700">{item.pedido}</td>
                <td className="px-3 py-1.5 text-slate-600 max-w-[200px] truncate" title={item.cliente}>{item.cliente}</td>
                <td className="px-3 py-1.5 text-center text-slate-500">{item.itens}</td>
                <td className="px-3 py-1.5 text-center text-slate-500">{formatDate(item.data)}</td>
                <td className="px-3 py-1.5 text-right font-semibold text-emerald-700">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-emerald-50 border-t border-emerald-200">
            <tr>
              <td colSpan={4} className="px-3 py-2 font-bold text-emerald-800">Total ({sorted.length} NFs)</td>
              <td className="px-3 py-2 text-right font-bold text-emerald-800">
                {formatCurrency(sorted.reduce((sum, i) => sum + i.total, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

interface SalesItem {
  pedido: string;
  cliente: string;
  itens: number;
  data: string;
  total: number;
  vendedor?: string;
}

function SalesDetailTable({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, isLoading } = trpc.financial.getSalesDetails.useQuery(
    { startDate, endDate },
    { staleTime: 5 * 60 * 1000 }
  );

  const { sortField, sortDir, handleSort } = useSort("total", "desc");

  const sorted = useMemo(() => {
    if (!data) return [];
    const items = [...data] as SalesItem[];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "pedido":
          cmp = a.pedido.localeCompare(b.pedido);
          break;
        case "cliente":
          cmp = a.cliente.localeCompare(b.cliente);
          break;
        case "data":
          cmp = a.data.localeCompare(b.data);
          break;
        case "itens":
          cmp = a.itens - b.itens;
          break;
        case "total":
        default:
          cmp = a.total - b.total;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [data, sortField, sortDir]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-xs">Carregando detalhes...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-3 text-xs text-slate-400">
        Nenhum pedido encontrado no periodo
      </div>
    );
  }

  return (
    <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-blue-50 sticky top-0">
            <tr>
              <SortHeader label="Pedido" field="pedido" currentField={sortField} currentDir={sortDir} onSort={handleSort} colorClass="text-blue-700" />
              <SortHeader label="Cliente" field="cliente" currentField={sortField} currentDir={sortDir} onSort={handleSort} colorClass="text-blue-700" />
              <SortHeader label="Itens" field="itens" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="center" colorClass="text-blue-700" />
              <SortHeader label="Data" field="data" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="center" colorClass="text-blue-700" />
              <SortHeader label="Total" field="total" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="right" colorClass="text-blue-700" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-1.5 font-medium text-slate-700">{item.pedido}</td>
                <td className="px-3 py-1.5 text-slate-600 max-w-[200px] truncate" title={item.cliente}>{item.cliente}</td>
                <td className="px-3 py-1.5 text-center text-slate-500">{item.itens}</td>
                <td className="px-3 py-1.5 text-center text-slate-500">{formatDate(item.data)}</td>
                <td className="px-3 py-1.5 text-right font-semibold text-blue-700">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-blue-50 border-t border-blue-200">
            <tr>
              <td colSpan={4} className="px-3 py-2 font-bold text-blue-800">Total ({sorted.length} pedidos)</td>
              <td className="px-3 py-2 text-right font-bold text-blue-800">
                {formatCurrency(sorted.reduce((sum, i) => sum + i.total, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

interface PaidItem {
  fornecedor: string;
  descricao: string;
  liquidacaoData: string;
  valorPagoLiquido: number;
}

function PaidDetailTable({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, isLoading } = trpc.financial.getPaidDetails.useQuery(
    { startDate, endDate },
    { staleTime: 5 * 60 * 1000 }
  );

  const { sortField, sortDir, handleSort } = useSort("valorPagoLiquido", "desc");

  const sorted = useMemo(() => {
    if (!data) return [];
    const items = [...data] as PaidItem[];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "fornecedor":
          cmp = a.fornecedor.localeCompare(b.fornecedor);
          break;
        case "descricao":
          cmp = a.descricao.localeCompare(b.descricao);
          break;
        case "liquidacaoData":
          cmp = a.liquidacaoData.localeCompare(b.liquidacaoData);
          break;
        case "valorPagoLiquido":
        default:
          cmp = a.valorPagoLiquido - b.valorPagoLiquido;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [data, sortField, sortDir]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-xs">Carregando detalhes...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-3 text-xs text-slate-400">
        Nenhuma conta paga encontrada no periodo
      </div>
    );
  }

  return (
    <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-red-50 sticky top-0">
            <tr>
              <SortHeader label="Fornecedor" field="fornecedor" currentField={sortField} currentDir={sortDir} onSort={handleSort} colorClass="text-red-700" />
              <SortHeader label="Descricao" field="descricao" currentField={sortField} currentDir={sortDir} onSort={handleSort} colorClass="text-red-700" />
              <SortHeader label="Liquidacao" field="liquidacaoData" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="center" colorClass="text-red-700" />
              <SortHeader label="Valor Pago" field="valorPagoLiquido" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="right" colorClass="text-red-700" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-1.5 font-medium text-slate-700 max-w-[180px] truncate" title={item.fornecedor}>{item.fornecedor}</td>
                <td className="px-3 py-1.5 text-slate-600 max-w-[200px] truncate" title={item.descricao}>{item.descricao}</td>
                <td className="px-3 py-1.5 text-center text-slate-500">{formatDate(item.liquidacaoData)}</td>
                <td className="px-3 py-1.5 text-right font-semibold text-red-600">{formatCurrency(item.valorPagoLiquido)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-red-50 border-t border-red-200">
            <tr>
              <td colSpan={3} className="px-3 py-2 font-bold text-red-800">Total ({sorted.length} contas)</td>
              <td className="px-3 py-2 text-right font-bold text-red-800">
                {formatCurrency(sorted.reduce((sum, i) => sum + i.valorPagoLiquido, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
 * Stacked Bar Chart: Recebimentos + Outras Entradas por mês
 * Shows the composition of total inflows per month
 * ============================================================ */

function EntradasStackedChart() {
  const [showChart, setShowChart] = useState(false);

  // Generate last 6 months of date ranges
  const monthsInput = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      // For current month, use today as end date
      const isCurrentMonth = i === 0;
      const endDay = isCurrentMonth ? now.getDate() : lastDay;
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      months.push({
        startDate: `${year}-${String(month + 1).padStart(2, "0")}-01`,
        endDate: `${year}-${String(month + 1).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
        label: `${label}/${String(year).slice(2)}`,
      });
    }
    return months;
  }, []);

  const { data, isLoading } = trpc.financial.getMonthlyOFXInflows.useQuery(
    { months: monthsInput },
    { enabled: showChart, staleTime: 10 * 60 * 1000 }
  );

  if (!showChart) {
    return (
      <button
        onClick={() => setShowChart(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/30 transition-all text-xs font-medium"
      >
        <TrendingUp className="w-3.5 h-3.5" />
        Ver evolução mensal de Entradas
      </button>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Carregando dados mensais...</span>
      </div>
    );
  }

  if (!data?.months?.length) {
    return (
      <div className="text-center py-4 text-xs text-slate-400">
        Sem dados disponíveis para o período
      </div>
    );
  }

  const months = data.months;
  const maxTotal = Math.max(...months.map(m => m.total), 1);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Evolução Mensal de Entradas
          </span>
        </div>
        <button
          onClick={() => setShowChart(false)}
          className="text-[10px] text-slate-400 hover:text-slate-600"
        >
          Ocultar
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-500" />
          <span className="text-[10px] text-slate-500">Vendas/Revenda</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-400" />
          <span className="text-[10px] text-slate-500">Demais Receitas</span>
        </div>
      </div>

      {/* Stacked bars */}
      <div className="space-y-2.5">
        {months.map((month, idx) => {
          const recPct = (month.recebimentos / maxTotal) * 100;
          const outrasPct = (month.outrasEntradas / maxTotal) * 100;
          const isLast = idx === months.length - 1;

          return (
            <div key={month.label} className={`group ${isLast ? "bg-amber-50/50 rounded-lg px-2 py-1.5 -mx-2 border border-amber-100" : ""}`}>
              <div className="flex items-center gap-3">
                {/* Month label */}
                <span className={`text-[11px] font-medium w-12 flex-shrink-0 ${isLast ? "text-amber-700 font-bold" : "text-slate-500"}`}>
                  {month.label}
                </span>

                {/* Stacked bar */}
                <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden flex">
                  {month.recebimentos > 0 && (
                    <div
                      className="h-full bg-amber-500 transition-all duration-700 relative group/rec"
                      style={{ width: `${recPct}%` }}
                      title={`Vendas/Revenda: ${formatCurrency(month.recebimentos)}`}
                    >
                      {recPct > 15 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                          {formatCurrencyShort(month.recebimentos)}
                        </span>
                      )}
                    </div>
                  )}
                  {month.outrasEntradas > 0 && (
                    <div
                      className="h-full bg-slate-400 transition-all duration-700 relative"
                      style={{ width: `${outrasPct}%` }}
                      title={`Demais Receitas: ${formatCurrency(month.outrasEntradas)}`}
                    >
                      {outrasPct > 12 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                          {formatCurrencyShort(month.outrasEntradas)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Total value */}
                <span className={`text-[11px] font-bold w-20 text-right flex-shrink-0 ${isLast ? "text-amber-700" : "text-slate-600"}`}>
                  {formatCurrencyShort(month.total)}
                </span>
              </div>

              {/* Hover detail row */}
              <div className="hidden group-hover:flex items-center gap-3 mt-1 pl-12">
                <div className="flex items-center gap-3 text-[9px] text-slate-400">
                  <span>
                    <span className="inline-block w-2 h-2 rounded-sm bg-amber-500 mr-1" />
                    Vendas: {formatCurrency(month.recebimentos)} ({month.recebimentosCount})
                  </span>
                  <span>
                    <span className="inline-block w-2 h-2 rounded-sm bg-slate-400 mr-1" />
                    Demais: {formatCurrency(month.outrasEntradas)} ({month.outrasEntradasCount})
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          Média mensal: {formatCurrency(months.reduce((s, m) => s + m.total, 0) / months.length)}
        </span>
        <span className="text-[10px] text-slate-400">
          Fonte: Maxiprod Financeiro (contaAReceber)
        </span>
      </div>
    </div>
  );
}
