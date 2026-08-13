/**
 * CustosDeVendaStep - Resumo dos Custos de Venda
 * Mostra um resumo limpo e direto, sem cards expansíveis:
 * - Valor total do pedido
 * - Custo de cada item (código + valor)
 * - Impostos (baseado no Zap/Tipo de Faturamento)
 * - Comissão do vendedor
 * - Frete (se já simulado)
 * - Gastos Adicionais (campo editável opcional)
 * - Lucro Líquido final
 */
import { parseDimensions } from "@shared/parseDimensions";
import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  DollarSign, Percent, Package, TrendingUp, PlusCircle, ArrowLeft, ArrowRight
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
  nfPercent?: number; // from Tipo de Faturamento (Zap)
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Tax rates by state (simplified - ICMS interestadual)
const TAX_RATES: Record<string, { icms: number; pis: number; cofins: number; irpj: number; csll: number }> = {
  DEFAULT: { icms: 12, pis: 1.65, cofins: 7.6, irpj: 1.2, csll: 1.08 },
  MG: { icms: 18, pis: 1.65, cofins: 7.6, irpj: 1.2, csll: 1.08 },
  SP: { icms: 12, pis: 1.65, cofins: 7.6, irpj: 1.2, csll: 1.08 },
  RJ: { icms: 12, pis: 1.65, cofins: 7.6, irpj: 1.2, csll: 1.08 },
};

export default function CustosDeVendaStep(props: CustosDeVendaStepProps) {
  const { items, uf, sellerId, onBack, onNext, onRealCostsCalculated, nfPercent = 100 } = props;
  const { operator } = useOperator();
  const [gastosAdicionais, setGastosAdicionais] = useState("");

  // Get real-time costs
  const { data: costData } = trpc.import.getRealTimeCosts.useQuery();

  // Get seller commission from permissions
  const { data: permData } = trpc.sales.listSellerPermissions.useQuery();
  const sellerPerm = useMemo(() => {
    if (!permData || !operator) return null;
    return permData.find((p: any) => p.sellerName?.toLowerCase().includes(operator.name?.toLowerCase().split(" ")[0] || "---"));
  }, [permData, operator]);
  const comissaoPerc = sellerPerm?.commissionPercent ? Number(sellerPerm.commissionPercent) : 5.85;

  // Calculate totals
  const totalVenda = useMemo(() => items.reduce((sum, i) => sum + (i.precoUnitario * i.quantidade), 0), [items]);
  const totalVolumes = useMemo(() => items.reduce((sum, i) => sum + i.quantidade, 0), [items]);
  const totalPeso = useMemo(() => items.reduce((sum, i) => sum + (i.pesoBrutoCaixa || 0) * i.quantidade, 0), [items]);

  // Cost per item
  const itemCosts = useMemo(() => {
    if (!costData) return items.map(i => ({ ...i, custo: 0, fonte: "N/A" }));
    return items.map(i => {
      const c = costData.find((cd: any) => cd.codigoItem === i.codigoItem);
      const custo = c ? (c.custoReal || c.custoProjetado || c.custoEstimado || 0) : 0;
      const fonte = c ? (c.custoReal ? "Real" : c.custoProjetado ? "Projetado" : c.custoEstimado ? "Estimado" : "N/A") : "N/A";
      return { ...i, custo: custo * i.quantidade, custoUnit: custo, fonte };
    });
  }, [items, costData]);

  const totalCusto = useMemo(() => itemCosts.reduce((sum, i) => sum + i.custo, 0), [itemCosts]);

  // Tax calculation (affected by nfPercent/Zap)
  const taxRates = TAX_RATES[uf] || TAX_RATES.DEFAULT;
  const nfFactor = nfPercent / 100; // Normal=1, Zap0=0, Zap2=0.5, etc.
  const totalImpostos = useMemo(() => {
    const taxPerc = (taxRates.icms + taxRates.pis + taxRates.cofins + taxRates.irpj + taxRates.csll) / 100;
    return totalVenda * taxPerc * nfFactor;
  }, [totalVenda, taxRates, nfFactor]);
  const impostosPerc = totalVenda > 0 ? (totalImpostos / totalVenda) * 100 : 0;

  // Commission
  const totalComissao = totalVenda * (comissaoPerc / 100);

  // Freight (from parent state)
  const freteValue = parseFloat(props.valorFrete) || 0;

  // Additional costs
  const gastosValue = parseFloat(gastosAdicionais) || 0;

  // Net profit
  const lucroLiquido = totalVenda - totalCusto - totalImpostos - totalComissao - freteValue - gastosValue;
  const margemPerc = totalVenda > 0 ? (lucroLiquido / totalVenda) * 100 : 0;

  // Report costs to parent
  useEffect(() => {
    if (onRealCostsCalculated && totalVenda > 0) {
      onRealCostsCalculated({
        comissaoPerc,
        fretePerc: totalVenda > 0 ? (freteValue / totalVenda) * 100 : 0,
        margemReal: margemPerc,
      });
    }
  }, [margemPerc, comissaoPerc, freteValue, totalVenda]);

  const margemColor = margemPerc >= 40 ? "text-blue-600" : margemPerc >= 25 ? "text-green-600" : margemPerc >= 15 ? "text-amber-600" : "text-red-600";
  const barColor = margemPerc >= 40 ? "bg-blue-500" : margemPerc >= 25 ? "bg-green-500" : margemPerc >= 15 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">3. RESUMO DOS CUSTOS DE VENDA</p>

      {/* Header - Valor Total */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-4 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            <span className="font-bold text-sm uppercase">Valor Total do Pedido</span>
          </div>
          <span className="text-2xl font-bold">{formatCurrency(totalVenda)}</span>
        </div>
        <p className="text-teal-200 text-xs mt-1">{items.length} produto(s) | {totalVolumes} volumes | {totalPeso.toFixed(1)} kg</p>
      </div>

      {/* Margin Bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> MARGEM DE LUCRO
          </span>
          <span className={`text-xl font-bold ${margemColor}`}>{margemPerc.toFixed(2)}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(Math.max(margemPerc, 0), 100)}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-2">
          <span className="text-green-600 font-medium">{formatCurrency(totalVenda)} Venda</span>
          <span className="text-red-500">-{formatCurrency(totalCusto)} Custo</span>
          <span className="text-red-500">-{formatCurrency(totalImpostos)} Impostos</span>
          <span className="text-red-500">-{formatCurrency(totalComissao)} Comissão</span>
          <span className="text-red-500">-{formatCurrency(freteValue)} Frete</span>
          {gastosValue > 0 && <span className="text-red-500">-{formatCurrency(gastosValue)} Gastos</span>}
        </div>
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <span className="text-xs text-slate-500">Lucro Líquido:</span>
          <span className={`text-lg font-bold ${margemColor}`}>{formatCurrency(lucroLiquido)}</span>
        </div>
      </div>

      {/* 1. Custo da Mercadoria */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Custo da Mercadoria</span>
          <span className="ml-auto text-sm font-bold text-red-600">{formatCurrency(totalCusto)}</span>
        </div>
        <div className="space-y-1.5">
          {itemCosts.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-700 last:border-0">
              <div className="flex-1">
                <span className="text-slate-500">{item.codigoItem}</span>
                <span className="mx-1">—</span>
                <span className="text-slate-700 dark:text-slate-300">{item.descricaoItem?.substring(0, 40)}</span>
                <span className="text-slate-400 ml-1">(×{item.quantidade})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">{item.fonte}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(item.custo)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Impostos */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Impostos</span>
          <span className="text-xs text-slate-400 ml-1">({impostosPerc.toFixed(2)}%{nfPercent < 100 ? ` — ${nfPercent === 0 ? "Sem NF" : nfPercent + "% NF"}` : ""})</span>
          <span className="ml-auto text-sm font-bold text-red-600">{formatCurrency(totalImpostos)}</span>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1 text-[10px] text-slate-500">
          <span>ICMS {(taxRates.icms * nfFactor).toFixed(1)}%</span>
          <span>PIS {(taxRates.pis * nfFactor).toFixed(2)}%</span>
          <span>COFINS {(taxRates.cofins * nfFactor).toFixed(2)}%</span>
          <span>IRPJ {(taxRates.irpj * nfFactor).toFixed(2)}%</span>
          <span>CSLL {(taxRates.csll * nfFactor).toFixed(2)}%</span>
        </div>
      </div>

      {/* 3. Comissão */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Comissão do Vendedor</span>
          <span className="text-xs text-slate-400 ml-1">({comissaoPerc}%)</span>
          <span className="ml-auto text-sm font-bold text-red-600">{formatCurrency(totalComissao)}</span>
        </div>
      </div>

      {/* 4. Frete */}
      {freteValue > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Frete</span>
            <span className="ml-auto text-sm font-bold text-red-600">{formatCurrency(freteValue)}</span>
          </div>
        </div>
      )}

      {/* 5. Gastos Adicionais (editable) */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <PlusCircle className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Gastos Adicionais</span>
          <span className="text-xs text-slate-400">(opcional)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">R$</span>
          <input
            type="number"
            value={gastosAdicionais}
            onChange={(e) => setGastosAdicionais(e.target.value)}
            placeholder="0,00"
            className="w-32 px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-teal-400 outline-none"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </button>
        <button onClick={onNext} className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors shadow-sm">
          Avançar <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
