/**
 * Card: Vendas vs Contas Pagas
 * Compara o total de pedidos de venda (Aprovados + A aprovar + Faturados)
 * com as contas efetivamente pagas no mesmo período.
 *
 * Reutiliza o mesmo sistema de cache/avisos de contas pagas do FaturamentoVsPagosCard.
 * Inclui contraprova Maxiprod com olho de conferência (apenas Fernando/Guilherme).
 */

import { useState, useMemo } from "react";
import { useOperator } from "@/contexts/OperatorContext";
import { trpc } from "@/lib/trpc";
import {
  Loader2, TrendingUp, TrendingDown, ShoppingCart, CreditCard, BarChart3,
  Calendar, Info, Database, AlertTriangle, Eye, ExternalLink, ClipboardList, X
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

const MAXIPROD_AUTHORIZED_OPERATORS = ["Guilherme", "Fernando"];
const MAXIPROD_LOGIN_URL = "https://app.maxiprod.com.br/";

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

/* ============================================================
   Modal de Contraprova Maxiprod para Vendas
   ============================================================ */
function MaxiprodVerifyModalVendas({
  onClose,
  section,
  context,
}: {
  onClose: () => void;
  section: "vendas" | "contas_pagas";
  context: {
    periodStart?: string;
    periodEnd?: string;
    valorManus?: number;
    valorMaxiprod?: number;
    maxiprodLoading?: boolean;
  };
}) {
  const steps = useMemo(() => {
    const s: { step: number; text: string; highlight?: boolean }[] = [];
    let n = 1;
    s.push({ step: n++, text: "Acesse o Maxiprod: app.maxiprod.com.br" });
    s.push({ step: n++, text: "Login: lfernandoaleixo@gmail.com | Senha: Luizfernando7008*" });

    if (section === "vendas") {
      s.push({ step: n++, text: "Vá em: Vendas \u2192 Pedidos de Venda" });
      if (context.periodStart && context.periodEnd) {
        const [sy, sm, sd] = context.periodStart.split("-");
        const [ey, em, ed] = context.periodEnd.split("-");
        s.push({ step: n++, text: `Data do pedido: ${sd}/${sm}/${sy} a ${ed}/${em}/${ey}` });
      }
      s.push({ step: n++, text: 'Exclua pedidos com estado: Cancelado' });
      s.push({ step: n++, text: 'Verifique o total de pedidos e o valor total', highlight: true });
    } else if (section === "contas_pagas") {
      s.push({ step: n++, text: "Vá em: Financeiro \u2192 Contas a pagar" });
      s.push({ step: n++, text: 'Estado: marque apenas "Pagos"' });
      if (context.periodStart && context.periodEnd) {
        const [sy, sm, sd] = context.periodStart.split("-");
        const [ey, em, ed] = context.periodEnd.split("-");
        s.push({ step: n++, text: `Liquidação: ${sd}/${sm}/${sy} a ${ed}/${em}/${ey}` });
      }
      s.push({ step: n++, text: 'Exclua contas com estado: Cancelado' });
    }

    if (context.valorManus !== undefined) {
      s.push({ step: n++, text: `Compare o total com o valor da Manus: ${formatCurrency(context.valorManus)}`, highlight: true });
    }
    return s;
  }, [section, context]);

  const labels: Record<string, string> = {
    vendas: "Pedidos de Venda",
    contas_pagas: "Contas a Pagar",
  };

  const divergencia = context.valorManus !== undefined && context.valorMaxiprod !== undefined
    ? Math.abs(context.valorManus - context.valorMaxiprod)
    : null;
  const hasDivergencia = divergencia !== null && divergencia > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Contraprova Maxiprod</h3>
                <p className="text-indigo-300 text-xs">{labels[section]}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Valores lado a lado */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="px-4 py-2.5 bg-white/10 rounded-lg border border-white/20">
              <span className="text-indigo-300 text-[10px] uppercase tracking-wider">Valor na Manus</span>
              <p className="text-white font-bold text-lg" style={{ textShadow: "0 0 15px rgba(34,211,238,0.4)" }}>
                {context.valorManus !== undefined ? formatCurrency(context.valorManus) : "-"}
              </p>
            </div>
            <div className={`px-4 py-2.5 rounded-lg border ${
              context.maxiprodLoading ? "bg-white/5 border-white/10" :
              hasDivergencia ? "bg-red-500/20 border-red-400/40" : "bg-emerald-500/20 border-emerald-400/40"
            }`}>
              <span className="text-indigo-300 text-[10px] uppercase tracking-wider">Valor Maxiprod (API)</span>
              {context.maxiprodLoading ? (
                <div className="flex items-center gap-2 mt-1">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
                  <span className="text-indigo-300 text-sm">Consultando...</span>
                </div>
              ) : context.valorMaxiprod !== undefined ? (
                <p className={`font-bold text-lg ${hasDivergencia ? "text-red-300" : "text-emerald-300"}`}
                  style={{ textShadow: hasDivergencia ? "0 0 15px rgba(239,68,68,0.4)" : "0 0 15px rgba(52,211,153,0.4)" }}>
                  {formatCurrency(context.valorMaxiprod)}
                </p>
              ) : (
                <p className="text-white/50 text-sm mt-1">Indisponível</p>
              )}
            </div>
          </div>
          {hasDivergencia && (
            <div className="mt-2 px-4 py-2 bg-red-500/20 rounded-lg border border-red-400/30 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-300 flex-shrink-0" />
              <span className="text-red-200 text-xs font-semibold">
                Divergência de {formatCurrency(divergencia!)} detectada! Solicite autorização para corrigir.
              </span>
            </div>
          )}
          {!hasDivergencia && context.valorMaxiprod !== undefined && !context.maxiprodLoading && (
            <div className="mt-2 px-4 py-2 bg-emerald-500/20 rounded-lg border border-emerald-400/30 flex items-center gap-2">
              <span className="text-emerald-200 text-xs font-semibold">Valores conferem! Sem divergência.</span>
            </div>
          )}
        </div>
        <div className="px-6 py-5 max-h-[50vh] overflow-y-auto space-y-2.5">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Passo a passo para verificação
          </div>
          {steps.map(st => (
            <div key={st.step} className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
              st.highlight ? "bg-amber-50 border-2 border-amber-300 shadow-sm" : "bg-slate-50 border border-slate-200"
            }`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                st.highlight ? "bg-amber-500 text-white shadow-md shadow-amber-500/30" : "bg-indigo-600 text-white"
              }`}>{st.step}</div>
              <p className={`text-sm leading-relaxed pt-0.5 ${
                st.highlight ? "text-amber-800 font-semibold" : "text-slate-700"
              }`}>{st.text}</p>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <a href={MAXIPROD_LOGIN_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:scale-[1.02]">
            <ExternalLink className="w-4 h-4" /> Abrir Maxiprod
          </a>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium">Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Main Component
   ============================================================ */
export default function VendasVsPagosCard() {
  const { operator } = useOperator();
  const canVerifyMaxiprod = operator && MAXIPROD_AUTHORIZED_OPERATORS.includes(operator.name);

  const [period, setPeriod] = useState<PeriodPreset>("mes_atual");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [verifySection, setVerifySection] = useState<"vendas" | "contas_pagas" | null>(null);

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

  // Contraprova queries
  const contraprovaEnabled = !!canVerifyMaxiprod && !!dates.start && !!dates.end;

  const { data: cpVendas, isLoading: cpVendasLoading } = trpc.financial.getMaxiprodContraprova.useQuery(
    { section: "vendas", startDate: dates.start, endDate: dates.end },
    { enabled: contraprovaEnabled }
  );

  const { data: cpContasPagas, isLoading: cpContasPagasLoading } = trpc.financial.getMaxiprodContraprova.useQuery(
    { section: "contas_pagas", startDate: dates.start, endDate: dates.end },
    { enabled: contraprovaEnabled }
  );

  const divVendas = cpVendas && data ? Math.abs(data.vendas.total - cpVendas.valorMaxiprod) : null;
  const hasDivVendas = divVendas !== null && divVendas > 1;

  const divPagas = cpContasPagas && data ? Math.abs(data.contasPagas.total - cpContasPagas.valorMaxiprod) : null;
  const hasDivPagas = divPagas !== null && divPagas > 1;

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
        <CardContent
          data={data}
          canVerifyMaxiprod={!!canVerifyMaxiprod}
          cpVendas={cpVendas}
          cpVendasLoading={cpVendasLoading}
          cpContasPagas={cpContasPagas}
          cpContasPagasLoading={cpContasPagasLoading}
          hasDivVendas={hasDivVendas}
          divVendas={divVendas}
          hasDivPagas={hasDivPagas}
          divPagas={divPagas}
          onVerify={setVerifySection}
        />
      )}

      {/* Modal de Contraprova */}
      {verifySection && (
        <MaxiprodVerifyModalVendas
          onClose={() => setVerifySection(null)}
          section={verifySection}
          context={{
            periodStart: dates.start,
            periodEnd: dates.end,
            valorManus: verifySection === "vendas" ? data?.vendas.total : data?.contasPagas.total,
            valorMaxiprod: verifySection === "vendas" ? cpVendas?.valorMaxiprod : cpContasPagas?.valorMaxiprod,
            maxiprodLoading: verifySection === "vendas" ? cpVendasLoading : cpContasPagasLoading,
          }}
        />
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

function CardContent({
  data,
  canVerifyMaxiprod,
  cpVendas,
  cpVendasLoading,
  cpContasPagas,
  cpContasPagasLoading,
  hasDivVendas,
  divVendas,
  hasDivPagas,
  divPagas,
  onVerify,
}: {
  data: SalesVsPaidData;
  canVerifyMaxiprod: boolean;
  cpVendas: any;
  cpVendasLoading: boolean;
  cpContasPagas: any;
  cpContasPagasLoading: boolean;
  hasDivVendas: boolean;
  divVendas: number | null;
  hasDivPagas: boolean;
  divPagas: number | null;
  onVerify: (s: "vendas" | "contas_pagas") => void;
}) {
  const { vendas, contasPagas, saldo } = data;
  const isPositive = saldo >= 0;

  const maxVal = Math.max(vendas.total, contasPagas.total, 1);
  const vendasPct = (vendas.total / maxVal) * 100;
  const pagPct = (contasPagas.total / maxVal) * 100;

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
      <div className={`space-y-1.5 p-3 rounded-lg relative group transition-all ${
        hasDivVendas ? "bg-red-50/80 border-2 border-red-300 shadow-md shadow-red-100" : "bg-slate-50/50"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-slate-600">Vendas (Pedidos)</span>
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {vendas.pedidos} pedidos
            </span>
            {canVerifyMaxiprod && (
              <button onClick={() => onVerify("vendas")}
                className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-blue-500/20 hover:bg-blue-500/40 flex items-center justify-center" title="Verificar no Maxiprod">
                <Eye className="w-3 h-3 text-blue-700" />
              </button>
            )}
          </div>
          <span className="text-sm font-bold text-blue-700">{formatCurrency(vendas.total)}</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-700"
            style={{ width: `${vendasPct}%` }}
          />
        </div>
        {/* Contraprova Maxiprod */}
        {canVerifyMaxiprod && (
          <div className="mt-1.5 pt-1.5 border-t border-slate-200/60">
            {cpVendasLoading ? (
              <div className="flex items-center gap-1 justify-center"><Loader2 className="w-3 h-3 animate-spin text-blue-400" /><span className="text-[10px] text-blue-400">Maxiprod...</span></div>
            ) : cpVendas ? (
              <div className="text-center">
                <span className="text-[10px] text-slate-400">Maxiprod: </span>
                <span className={`text-[10px] font-bold ${hasDivVendas ? "text-red-600" : "text-emerald-600"}`}>{formatCurrency(cpVendas.valorMaxiprod)}</span>
                {hasDivVendas && (
                  <>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                      <span className="text-[10px] font-bold text-red-600">Dif: {formatCurrency(divVendas!)}</span>
                    </div>
                    <button onClick={() => onVerify("vendas")} className="mt-1 text-[9px] text-red-500 hover:text-red-700 underline font-semibold">
                      Ver origem e solicitar correção
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Contas Pagas Row */}
      <div className={`space-y-1.5 p-3 rounded-lg relative group transition-all ${
        hasDivPagas ? "bg-red-50/80 border-2 border-red-300 shadow-md shadow-red-100" : "bg-slate-50/50"
      }`}>
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
            {canVerifyMaxiprod && (
              <button onClick={() => onVerify("contas_pagas")}
                className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center" title="Verificar no Maxiprod">
                <Eye className="w-3 h-3 text-red-700" />
              </button>
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
        {/* Contraprova Maxiprod */}
        {canVerifyMaxiprod && (
          <div className="mt-1.5 pt-1.5 border-t border-slate-200/60">
            {cpContasPagasLoading ? (
              <div className="flex items-center gap-1 justify-center"><Loader2 className="w-3 h-3 animate-spin text-red-400" /><span className="text-[10px] text-red-400">Maxiprod...</span></div>
            ) : cpContasPagas ? (
              <div className="text-center">
                <span className="text-[10px] text-slate-400">Maxiprod: </span>
                <span className={`text-[10px] font-bold ${hasDivPagas ? "text-red-600" : "text-emerald-600"}`}>{formatCurrency(cpContasPagas.valorMaxiprod)}</span>
                {hasDivPagas && (
                  <>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                      <span className="text-[10px] font-bold text-red-600">Dif: {formatCurrency(divPagas!)}</span>
                    </div>
                    <button onClick={() => onVerify("contas_pagas")} className="mt-1 text-[9px] text-red-500 hover:text-red-700 underline font-semibold">
                      Ver origem e solicitar correção
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}
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
