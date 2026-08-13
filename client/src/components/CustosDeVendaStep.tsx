/**
 * CustosDeVendaStep - Resumo dos Custos de Venda
 * Clean summary with: valor total, custo unitário + total, impostos, comissão, frete details, gastos adicionais
 * Button "Recalcular Margem" only enabled when frete is available
 */
import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  DollarSign, Percent, Package, TrendingUp, PlusCircle, ArrowLeft, RefreshCw, Truck
} from "lucide-react";
import { useOperator } from "@/contexts/OperatorContext";

interface OrderItem {
  codigoItem: string;
  descricaoItem: string;
  quantidade: number;
  unidadeMedida: string;
  precoUnitario: number;
  precoMinimo: number | null;
  precoVendedor: number | null;
  grupo: string;
  disponivel: string;
  pesoBrutoCaixa?: number;
  dimsStr?: string;
}

interface CustosDeVendaStepProps {
  cep: string;
  cnpjCpf: string;
  tipoContribuinte: string;
  uf: string;
  items: OrderItem[];
  sellerId?: number;
  condicaoPagamento: string;
  setCondicaoPagamento: (v: string) => void;
  valorFrete: string;
  setValorFrete: (v: string) => void;
  tipoFrete: string;
  setTipoFrete: (v: string) => void;
  observacoes: string;
  setObservacoes: (v: string) => void;
  operacaoFiscal: string;
  setOperacaoFiscal: (v: string) => void;
  naturezaOperacao: string;
  setNaturezaOperacao: (v: string) => void;
  estadoConfiguravel: string;
  setEstadoConfiguravel: (v: string) => void;
  formaPagamento: string;
  setFormaPagamento: (v: string) => void;
  dataEntregaPedido: string;
  setDataEntregaPedido: (v: string) => void;
  previsaoEntregaPedido: string;
  setPrevisaoEntregaPedido: (v: string) => void;
  onTransportadoraSelect?: (nome: string) => void;
  onProtocoloSet?: (protocolo: string) => void;
  onTrackingUrlSet?: (url: string) => void;
  onBack: () => void;
  onNext: () => void;
  onRealCostsCalculated?: (data: { comissaoPerc: number; fretePerc: number; margemReal: number; comissaoFonte?: string; comissaoTier?: string }) => void;
  skipMarginBlock?: boolean;
  nfPercent?: number;
  // Freight info from parent
  transportadoraNome?: string;
  protocoloCotacao?: string;
  transportadoraCnpj?: string;
}

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TAX_RATES: Record<string, { icms: number; pis: number; cofins: number; irpj: number; csll: number }> = {
  DEFAULT: { icms: 12, pis: 1.65, cofins: 7.6, irpj: 1.2, csll: 1.08 },
  MG: { icms: 18, pis: 1.65, cofins: 7.6, irpj: 1.2, csll: 1.08 },
  SP: { icms: 12, pis: 1.65, cofins: 7.6, irpj: 1.2, csll: 1.08 },
  RJ: { icms: 12, pis: 1.65, cofins: 7.6, irpj: 1.2, csll: 1.08 },
};

export default function CustosDeVendaStep(props: CustosDeVendaStepProps) {
  const { items, uf, onBack, onNext, onRealCostsCalculated, nfPercent = 100 } = props;
  const { operator } = useOperator();
  const [gastosAdicionais, setGastosAdicionais] = useState("");
  const [recalculated, setRecalculated] = useState(false);

  const { data: costData } = trpc.import.getRealTimeCosts.useQuery();
  const { data: permData } = trpc.sales.listSellerPermissions.useQuery();

  const sellerPerm = useMemo(() => {
    if (!permData || !operator) return null;
    return permData.find((p: any) => p.sellerName?.toLowerCase().includes(operator.name?.toLowerCase().split(" ")[0] || "---"));
  }, [permData, operator]);
  const comissaoPerc = sellerPerm?.commissionPercent ? Number(sellerPerm.commissionPercent) : 5.85;

  // Totals
  const totalVenda = useMemo(() => items.reduce((sum, i) => sum + (i.precoUnitario * i.quantidade), 0), [items]);
  const totalVolumes = useMemo(() => items.reduce((sum, i) => sum + i.quantidade, 0), [items]);
  const totalPeso = useMemo(() => items.reduce((sum, i) => sum + (i.pesoBrutoCaixa || 0) * i.quantidade, 0), [items]);

  // Cost per item (with unit cost)
  const itemCosts = useMemo(() => {
    if (!costData) return items.map(i => ({ ...i, custoTotal: 0, custoUnit: 0, fonte: "N/A" }));
    return items.map(i => {
      const c = costData.find((cd: any) => cd.codigoItem === i.codigoItem);
      const custoUnit = c ? (c.custoReal || c.custoProjetado || c.custoEstimado || 0) : 0;
      const fonte = c ? (c.custoReal ? "Real" : c.custoProjetado ? "Projetado" : c.custoEstimado ? "Estimado" : "N/A") : "N/A";
      return { ...i, custoTotal: custoUnit * i.quantidade, custoUnit, fonte };
    });
  }, [items, costData]);

  const totalCusto = useMemo(() => itemCosts.reduce((sum, i) => sum + i.custoTotal, 0), [itemCosts]);

  // Tax
  const taxRates = TAX_RATES[uf] || TAX_RATES.DEFAULT;
  const nfFactor = nfPercent / 100;
  const totalImpostos = useMemo(() => {
    const taxPerc = (taxRates.icms + taxRates.pis + taxRates.cofins + taxRates.irpj + taxRates.csll) / 100;
    return totalVenda * taxPerc * nfFactor;
  }, [totalVenda, taxRates, nfFactor]);
  const impostosPerc = totalVenda > 0 ? (totalImpostos / totalVenda) * 100 : 0;

  // Commission (fixed by gestor)
  const totalComissao = totalVenda * (comissaoPerc / 100);

  // Freight
  const freteValue = parseFloat(props.valorFrete) || 0;
  const hasFrete = freteValue > 0;

  // Additional costs
  const gastosValue = parseFloat(gastosAdicionais) || 0;

  // Net profit
  const lucroLiquido = totalVenda - totalCusto - totalImpostos - totalComissao - freteValue - gastosValue;
  const margemPerc = totalVenda > 0 ? (lucroLiquido / totalVenda) * 100 : 0;

  // Report to parent on recalculate
  const handleRecalculate = () => {
    if (onRealCostsCalculated && totalVenda > 0) {
      onRealCostsCalculated({
        comissaoPerc,
        fretePerc: totalVenda > 0 ? (freteValue / totalVenda) * 100 : 0,
        margemReal: margemPerc,
      });
    }
    setRecalculated(true);
    setTimeout(() => setRecalculated(false), 2000);
  };

  // Auto-report on mount if has frete
  useEffect(() => {
    if (hasFrete && onRealCostsCalculated && totalVenda > 0) {
      onRealCostsCalculated({
        comissaoPerc,
        fretePerc: (freteValue / totalVenda) * 100,
        margemReal: margemPerc,
      });
    }
  }, []);

  const margemColor = margemPerc >= 40 ? "text-blue-600" : margemPerc >= 25 ? "text-green-600" : margemPerc >= 15 ? "text-amber-600" : "text-red-600";
  const barColor = margemPerc >= 40 ? "bg-blue-500" : margemPerc >= 25 ? "bg-green-500" : margemPerc >= 15 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">3. RESUMO DOS CUSTOS DE VENDA</p>

      {/* Header - Valor Total */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-6 h-6" />
            <span className="font-bold text-base uppercase tracking-wide">Valor Total do Pedido</span>
          </div>
          <span className="text-3xl font-black">{fmt(totalVenda)}</span>
        </div>
        <p className="text-teal-200 text-sm mt-2">{items.length} produto(s) | {totalVolumes} volumes | {totalPeso.toFixed(1)} kg</p>
      </div>

      {/* Margin Bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-600" /> MARGEM DE LUCRO
          </span>
          <span className={`text-3xl font-black ${margemColor}`}>{margemPerc.toFixed(2)}%</span>
        </div>
        <div className="w-full h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${Math.min(Math.max(margemPerc, 0), 100)}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mt-3">
          <span className="text-green-600 font-bold">{fmt(totalVenda)} Venda</span>
          <span className="text-red-500 font-medium">-{fmt(totalCusto)} Custo</span>
          <span className="text-red-500 font-medium">-{fmt(totalImpostos)} Impostos</span>
          <span className="text-red-500 font-medium">-{fmt(totalComissao)} Comissão</span>
          <span className="text-red-500 font-medium">-{fmt(freteValue)} Frete</span>
          {gastosValue > 0 && <span className="text-red-500 font-medium">-{fmt(gastosValue)} Gastos</span>}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <span className="text-sm text-slate-500 font-medium">Lucro Líquido:</span>
          <span className={`text-2xl font-black ${margemColor}`}>{fmt(lucroLiquido)}</span>
        </div>
      </div>

      {/* Custo da Mercadoria - with unit cost */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-teal-600" />
          <span className="text-base font-bold text-slate-700 dark:text-slate-200">Custo da Mercadoria</span>
          <span className="ml-auto text-lg font-black text-red-600">{fmt(totalCusto)}</span>
        </div>
        <div className="space-y-2">
          {itemCosts.map((item, idx) => (
            <div key={idx} className="bg-slate-50 dark:bg-slate-750 rounded-lg px-3 py-2.5 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400">{item.codigoItem}</span>
                  <span className="mx-1.5 text-slate-300">—</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">{item.descricaoItem?.substring(0, 45)}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 font-medium ml-2">{item.fonte}</span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-slate-500">
                  Unit: <span className="font-bold text-slate-700 dark:text-slate-200">{fmt(item.custoUnit)}</span>
                  <span className="mx-1">×</span>
                  <span className="font-bold">{item.quantidade} cx</span>
                </span>
                <span className="text-sm font-bold text-red-600">{fmt(item.custoTotal)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Impostos */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-orange-500" />
          <span className="text-base font-bold text-slate-700 dark:text-slate-200">Impostos</span>
          <span className="text-sm text-slate-400 ml-1">({impostosPerc.toFixed(2)}%{nfPercent < 100 ? ` — ${nfPercent === 0 ? "Sem NF" : nfPercent + "% NF"}` : ""})</span>
          <span className="ml-auto text-lg font-black text-red-600">{fmt(totalImpostos)}</span>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2 text-xs text-slate-500">
          <div className="bg-slate-50 dark:bg-slate-700 rounded px-2 py-1 text-center">
            <div className="font-bold text-slate-700 dark:text-slate-200">ICMS</div>
            <div>{(taxRates.icms * nfFactor).toFixed(1)}%</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700 rounded px-2 py-1 text-center">
            <div className="font-bold text-slate-700 dark:text-slate-200">PIS</div>
            <div>{(taxRates.pis * nfFactor).toFixed(2)}%</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700 rounded px-2 py-1 text-center">
            <div className="font-bold text-slate-700 dark:text-slate-200">COFINS</div>
            <div>{(taxRates.cofins * nfFactor).toFixed(2)}%</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700 rounded px-2 py-1 text-center">
            <div className="font-bold text-slate-700 dark:text-slate-200">IRPJ</div>
            <div>{(taxRates.irpj * nfFactor).toFixed(2)}%</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700 rounded px-2 py-1 text-center">
            <div className="font-bold text-slate-700 dark:text-slate-200">CSLL</div>
            <div>{(taxRates.csll * nfFactor).toFixed(2)}%</div>
          </div>
        </div>
      </div>

      {/* Comissão */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-purple-500" />
          <span className="text-base font-bold text-slate-700 dark:text-slate-200">Comissão do Vendedor</span>
          <span className="text-sm text-purple-400 font-bold ml-1">({comissaoPerc}%)</span>
          <span className="ml-auto text-lg font-black text-red-600">{fmt(totalComissao)}</span>
        </div>
      </div>

      {/* Frete - with details */}
      <div className={`bg-white dark:bg-slate-800 border rounded-2xl p-5 shadow-sm ${hasFrete ? "border-blue-200 dark:border-blue-700" : "border-slate-200 dark:border-slate-700"}`}>
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-500" />
          <span className="text-base font-bold text-slate-700 dark:text-slate-200">Frete</span>
          <span className="ml-auto text-lg font-black text-red-600">{hasFrete ? fmt(freteValue) : "—"}</span>
        </div>
        {hasFrete && (props.transportadoraNome || props.protocoloCotacao) && (
          <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 space-y-1">
            {props.transportadoraNome && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Transportadora:</span>
                <span className="font-bold text-blue-700 dark:text-blue-300">{props.transportadoraNome}</span>
              </div>
            )}
            {props.protocoloCotacao && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Protocolo:</span>
                <span className="font-bold text-blue-700 dark:text-blue-300">{props.protocoloCotacao}</span>
              </div>
            )}
            {props.transportadoraCnpj && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">CNPJ:</span>
                <span className="font-medium text-slate-600 dark:text-slate-400">{props.transportadoraCnpj}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Valor:</span>
              <span className="font-bold text-blue-700 dark:text-blue-300">{fmt(freteValue)}</span>
            </div>
          </div>
        )}
        {!hasFrete && (
          <p className="text-xs text-slate-400 mt-2 italic">Simule o frete antes de recalcular a margem</p>
        )}
      </div>

      {/* Gastos Adicionais */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <PlusCircle className="w-5 h-5 text-slate-400" />
          <span className="text-base font-bold text-slate-700 dark:text-slate-200">Gastos Adicionais</span>
          <span className="text-xs text-slate-400 ml-1">(opcional)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 font-medium">R$</span>
          <input
            type="number"
            value={gastosAdicionais}
            onChange={(e) => setGastosAdicionais(e.target.value)}
            placeholder="0,00"
            className="w-40 px-3 py-2 text-base font-bold border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-teal-400 outline-none"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-3">
        <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button
          onClick={() => { handleRecalculate(); onNext(); }}
          disabled={!hasFrete}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl shadow-md transition-all ${
            hasFrete
              ? "text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700"
              : "text-slate-400 bg-slate-200 dark:bg-slate-700 cursor-not-allowed"
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${recalculated ? "animate-spin" : ""}`} />
          {recalculated ? "Recalculado!" : "Recalcular Margem"}
        </button>
      </div>
    </div>
  );
}
