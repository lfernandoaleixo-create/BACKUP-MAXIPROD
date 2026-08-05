/**
 * MarginBar - Barra de Margem de Lucro
 * Exibida após o fechamento do pedido (lançado no Maxiprod)
 * Calcula: Impostos + Frete + Comissão + Custo Mercadoria = Margem
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Calculator, TrendingUp, TrendingDown, Truck, Percent,
  DollarSign, ChevronDown, ChevronUp, AlertTriangle, Loader2,
  BarChart3, Package
} from "lucide-react";
import { toast } from "sonner";

interface MarginBarProps {
  orderId: number;
  orderUf: string;
  orderCep: string;
  orderCnpj: string;
  orderTotal: number;
  tipoContribuinte: string;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number) {
  return value.toFixed(2) + "%";
}

export default function MarginBar({ orderId, orderUf, orderCep, orderCnpj, orderTotal, tipoContribuinte }: MarginBarProps) {
  const [tipoProduto, setTipoProduto] = useState<"importado" | "industrializado">("importado");
  const [comissaoPerc, setComissaoPerc] = useState(0);
  const [freteManual, setFreteManual] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [showFreight, setShowFreight] = useState(false);
  const [selectedCnpjIndex, setSelectedCnpjIndex] = useState(0);

  // Margin calculation query
  const { data: marginData, isLoading: marginLoading, refetch: refetchMargin } = trpc.salesOrders.calculateMargin.useQuery(
    {
      orderId,
      tipoProduto,
      comissaoPercentual: comissaoPerc,
      freteValor: freteManual,
    },
    { staleTime: 60 * 1000 }
  );

  // Freight CNPJs
  const { data: freightCnpjs } = trpc.salesOrders.getFreightCnpjs.useQuery();

  // Freight quote mutation - ALL carriers (Braspress + Alfa)
  const quoteAllMutation = trpc.salesOrders.quoteAllCarriers.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.length} cotações de frete recebidas!`);
    },
    onError: (err) => {
      toast.error("Erro ao cotar frete: " + err.message);
    },
  });

  const handleQuoteFreight = () => {
    if (!orderCep) {
      toast.error("CEP do cliente não informado no pedido");
      return;
    }
    quoteAllMutation.mutate({
      cnpjDestinatario: orderCnpj.replace(/\D/g, "") || undefined,
      cepDestino: orderCep.replace(/\D/g, ""),
      valorMercadoria: orderTotal,
      peso: 100, // TODO: get from order items weight
      volumes: 1,
      metroCubico: 0.05,
    });
  };

  const handleSelectFreight = (valor: number) => {
    setFreteManual(valor);
    setShowFreight(false);
    toast.success(`Frete de ${formatCurrency(valor)} aplicado na margem`);
  };

  // Margin color based on percentage
  const getMarginColor = (perc: number) => {
    if (perc >= 20) return "text-green-600 bg-green-50 border-green-200";
    if (perc >= 10) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (perc >= 5) return "text-amber-600 bg-amber-50 border-amber-200";
    if (perc >= 0) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getBarWidth = (perc: number) => {
    return Math.max(0, Math.min(100, perc + 10)); // shift so 0% shows some bar
  };

  if (marginLoading) {
    return (
      <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600 animate-pulse">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-teal-500 animate-spin" />
          <span className="text-xs text-slate-500">Calculando margem de lucro...</span>
        </div>
      </div>
    );
  }

  if (!marginData) return null;

  const { impostos, margem, custoMercadoria, comissao, faturamentoTrimestral } = marginData;
  const marginColor = getMarginColor(margem.margemPercentual);

  return (
    <div className="mt-3 space-y-2">
      {/* Main Margin Bar */}
      <div className={`p-3 rounded-lg border ${marginColor}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Margem de Lucro</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black">{formatPercent(margem.margemPercentual)}</span>
            {margem.margemPercentual >= 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 bg-white/50 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              margem.margemPercentual >= 10 ? "bg-green-500" :
              margem.margemPercentual >= 5 ? "bg-amber-500" :
              margem.margemPercentual >= 0 ? "bg-orange-500" : "bg-red-500"
            }`}
            style={{ width: `${getBarWidth(margem.margemPercentual)}%` }}
          />
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-5 gap-1 text-center text-[9px]">
          <div>
            <p className="font-bold">{formatCurrency(margem.valorVenda)}</p>
            <p className="text-slate-500">Venda</p>
          </div>
          <div>
            <p className="font-bold text-red-600">-{formatCurrency(margem.totalImpostos)}</p>
            <p className="text-slate-500">Impostos</p>
          </div>
          <div>
            <p className="font-bold text-red-600">-{formatCurrency(margem.frete)}</p>
            <p className="text-slate-500">Frete</p>
          </div>
          <div>
            <p className="font-bold text-red-600">-{formatCurrency(margem.comissao)}</p>
            <p className="text-slate-500">Comissão</p>
          </div>
          <div>
            <p className="font-bold text-red-600">-{formatCurrency(margem.custoMercadoria)}</p>
            <p className="text-slate-500">Custo</p>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-current/20 flex items-center justify-between">
          <span className="text-[10px] font-medium">Lucro Líquido:</span>
          <span className="text-sm font-black">{formatCurrency(margem.lucroLiquido)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2">
        {/* Tipo Produto */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
          <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Tipo Produto</label>
          <select
            value={tipoProduto}
            onChange={(e) => setTipoProduto(e.target.value as any)}
            className="w-full text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5"
          >
            <option value="importado">Importado</option>
            <option value="industrializado">Industrializado</option>
          </select>
        </div>

        {/* Comissão */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
          <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Comissão (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={comissaoPerc}
            onChange={(e) => setComissaoPerc(Number(e.target.value))}
            className="w-full text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5"
          />
        </div>
      </div>

      {/* Freight Section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">FRETE</span>
            {freteManual > 0 && (
              <span className="text-[9px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-medium">
                {formatCurrency(freteManual)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleQuoteFreight}
              disabled={quoteAllMutation.isPending}
              className="text-[9px] px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium hover:bg-blue-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              {quoteAllMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin inline" />
              ) : (
                "Cotar Todas Transportadoras"
              )}
            </button>
            <button
              onClick={() => setShowFreight(!showFreight)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
            >
              {showFreight ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {showFreight && (
          <div className="mt-2 space-y-2">
            {/* Manual freight input */}
            <div className="flex items-center gap-2">
              <label className="text-[9px] text-slate-400 whitespace-nowrap">Frete manual (R$):</label>
              <input
                type="number"
                min="0"
                step="10"
                value={freteManual}
                onChange={(e) => setFreteManual(Number(e.target.value))}
                className="flex-1 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1"
              />
            </div>

            {/* All carriers quotes results */}
            {quoteAllMutation.data && (
              <div className="space-y-1.5">
                <p className="text-[9px] text-slate-400 uppercase font-bold">Cotações (Braspress + Alfa + Camilo + Rodonaves):</p>
                {quoteAllMutation.data.map((quote: any, idx: number) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded border text-[10px] ${
                      !quote.error
                        ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                        : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-700 dark:text-slate-200">
                        {quote.transportadora}
                      </p>
                      <p className="text-slate-500 text-[9px]">
                        CNPJ: {quote.cnpj ? quote.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : "—"}
                      </p>
                    </div>
                    {!quote.error ? (
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-bold text-green-700">
                            {formatCurrency(quote.totalFrete)}
                            {orderTotal > 0 && <span className="ml-1 font-normal text-[9px] text-slate-500">({((quote.totalFrete / orderTotal) * 100).toFixed(1)}%)</span>}
                          </p>
                          <p className="text-slate-400">{quote.prazo}</p>
                        </div>
                        <button
                          onClick={() => handleSelectFreight(quote.totalFrete)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-[9px] font-bold hover:bg-green-700 cursor-pointer"
                        >
                          Usar
                        </button>
                      </div>
                    ) : (
                      <span className="text-red-600 text-[9px]">{quote.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tax Details Toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Calculator className="w-3.5 h-3.5" />
          <span>Detalhamento de Impostos</span>
        </div>
        {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {showDetails && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          {/* Tax context */}
          <div className="grid grid-cols-3 gap-2 text-[9px] pb-2 border-b border-slate-100 dark:border-slate-700">
            <div>
              <span className="text-slate-400 uppercase font-bold">UF Destino</span>
              <p className="font-bold text-slate-700 dark:text-slate-200">{marginData.uf}</p>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-bold">Contribuinte</span>
              <p className="font-bold text-slate-700 dark:text-slate-200">{marginData.tipoContribuinte || "—"}</p>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-bold">Fat. Trimestral</span>
              <p className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(faturamentoTrimestral)}</p>
            </div>
          </div>

          {/* Tax breakdown table */}
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-slate-400 uppercase">
                <th className="text-left py-1 font-bold">Imposto</th>
                <th className="text-right py-1 font-bold">Alíquota</th>
                <th className="text-right py-1 font-bold">Valor</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-200">
              <tr>
                <td className="py-0.5">ICMS Efetivo</td>
                <td className="text-right">{formatPercent(impostos.icmsEfetivo)}</td>
                <td className="text-right font-medium">{formatCurrency(impostos.icmsValor)}</td>
              </tr>
              <tr>
                <td className="py-0.5">PIS</td>
                <td className="text-right">{formatPercent(impostos.pisEfetivo)}</td>
                <td className="text-right font-medium">{formatCurrency(impostos.pisValor)}</td>
              </tr>
              <tr>
                <td className="py-0.5">COFINS</td>
                <td className="text-right">{formatPercent(impostos.cofinsEfetiva)}</td>
                <td className="text-right font-medium">{formatCurrency(impostos.cofinsValor)}</td>
              </tr>
              <tr>
                <td className="py-0.5">IRPJ</td>
                <td className="text-right">{formatPercent(impostos.irpjEfetivo)}</td>
                <td className="text-right font-medium">{formatCurrency(impostos.irpjValor)}</td>
              </tr>
              <tr>
                <td className="py-0.5">CSLL</td>
                <td className="text-right">{formatPercent(impostos.csllEfetiva)}</td>
                <td className="text-right font-medium">{formatCurrency(impostos.csllValor)}</td>
              </tr>
              {impostos.temDifal && (
                <tr className="text-amber-700 dark:text-amber-400">
                  <td className="py-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    DIFAL
                  </td>
                  <td className="text-right">{formatPercent(impostos.difalEfetivo)}</td>
                  <td className="text-right font-medium">{formatCurrency(impostos.difalValor)}</td>
                </tr>
              )}
              <tr className="border-t border-slate-200 dark:border-slate-600 font-bold">
                <td className="py-1">TOTAL IMPOSTOS</td>
                <td className="text-right">{formatPercent(impostos.totalImpostosPerc)}</td>
                <td className="text-right">{formatCurrency(impostos.totalImpostosValor)}</td>
              </tr>
            </tbody>
          </table>

          {/* Cost breakdown */}
          {custoMercadoria.items.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
              <p className="text-[9px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1">
                <Package className="w-3 h-3" />
                Custo da Mercadoria ({custoMercadoria.items.length} itens)
              </p>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {custoMercadoria.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-[9px] py-0.5">
                    <span className="truncate flex-1 text-slate-600 dark:text-slate-300">
                      {item.codigoItem} - {item.descricao}
                    </span>
                    <div className="flex items-center gap-2 ml-2">
                      <span className={`px-1 py-0.5 rounded text-[8px] font-medium ${
                        item.fonte === "Projetado" ? "bg-orange-100 text-orange-700" :
                        item.fonte === "Real" ? "bg-green-100 text-green-700" :
                        "bg-slate-100 text-slate-500"
                      }`}>
                        {item.fonte}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {formatCurrency(item.custoTotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1 pt-1 border-t border-slate-100 dark:border-slate-700 text-[10px] font-bold">
                <span>Total Custo Mercadoria</span>
                <span>{formatCurrency(custoMercadoria.total)}</span>
              </div>
            </div>
          )}

          {custoMercadoria.items.some((i: any) => i.fonte === "Sem custo") && (
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-[9px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span>Alguns itens não possuem custo cadastrado na importação. A margem pode estar imprecisa.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
