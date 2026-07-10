/**
 * CustosDeVendaStep - Step "Custos de Venda" do formulário de pedido
 * Mostra 5 seções:
 * 1. Custo da Mercadoria (da importação em tempo real)
 * 2. Impostos discriminados (ICMS, PIS, COFINS, IRPJ, CSLL, DIFAL)
 * 3. Comissão do Vendedor (campo %)
 * 4. Transportadora / Frete (simulação com 3 APIs)
 * 5. Gastos Adicionais (campo manual)
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Truck, Loader2, AlertCircle, CheckCircle2, Package,
  Calculator, ChevronDown, ChevronUp, DollarSign, Percent,
  AlertTriangle, BarChart3, TrendingUp, TrendingDown, PlusCircle
} from "lucide-react";
import { toast } from "sonner";

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
  condicaoPagamento: string;
  setCondicaoPagamento: (v: string) => void;
  valorFrete: string;
  setValorFrete: (v: string) => void;
  tipoFrete: string;
  setTipoFrete: (v: string) => void;
  observacoes: string;
  setObservacoes: (v: string) => void;
  // Campos Maxiprod
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
  onBack: () => void;
  onNext: () => void;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number) {
  return value.toFixed(2) + "%";
}

function formatCnpj(cnpj: string) {
  if (!cnpj || cnpj.length < 14) return cnpj || "—";
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

// Transportadoras cadastradas
const TRANSPORTADORAS = [
  {
    nome: "Braspress",
    tipo: "REST/JSON",
    cnpjs: [
      { cnpj: "36562762000129", label: "Palitos Indústria e Comércio" },
      { cnpj: "45558059000138", label: "Varetas Indústria e Comércio" },
      { cnpj: "50128808000127", label: "Espetos Indústria e Comércio" },
    ],
    status: "Ativa",
    cor: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
    corBadge: "bg-blue-100 text-blue-700",
  },
  {
    nome: "Alfa Transportes",
    tipo: "REST/JSON",
    cnpjs: [
      { cnpj: "36562762000129", label: "Palitos Indústria e Comércio" },
      { cnpj: "50128808000127", label: "Espetos Indústria e Comércio" },
      { cnpj: "45558059000138", label: "Varetas (sem chave ainda)" },
    ],
    status: "Ativa (2 chaves)",
    cor: "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800",
    corBadge: "bg-purple-100 text-purple-700",
  },
  {
    nome: "Camilo dos Santos",
    tipo: "SOAP/XML (SSW)",
    cnpjs: [
      { cnpj: "36562762000129", label: "Palitos Indústria e Comércio" },
      { cnpj: "45558059000138", label: "Varetas Indústria e Comércio" },
      { cnpj: "50128808000127", label: "Espetos Indústria e Comércio" },
    ],
    status: "Ativa",
    cor: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
    corBadge: "bg-amber-100 text-amber-700",
  },
  {
    nome: "Rodonaves",
    tipo: "REST/JSON (RTE)",
    cnpjs: [
      { cnpj: "36562762000129", label: "Palitos Indústria e Comércio" },
      { cnpj: "45558059000138", label: "Varetas Indústria e Comércio" },
      { cnpj: "50128808000127", label: "Espetos Indústria e Comércio" },
    ],
    status: "Ativa",
    cor: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
    corBadge: "bg-green-100 text-green-700",
  },
];

export default function CustosDeVendaStep({
  cep,
  cnpjCpf,
  tipoContribuinte,
  uf,
  items,
  condicaoPagamento,
  setCondicaoPagamento,
  valorFrete,
  setValorFrete,
  tipoFrete,
  setTipoFrete,
  observacoes,
  setObservacoes,
  operacaoFiscal,
  setOperacaoFiscal,
  naturezaOperacao,
  setNaturezaOperacao,
  estadoConfiguravel,
  setEstadoConfiguravel,
  formaPagamento,
  setFormaPagamento,
  dataEntregaPedido,
  setDataEntregaPedido,
  previsaoEntregaPedido,
  setPrevisaoEntregaPedido,
  onBack,
  onNext,
}: CustosDeVendaStepProps) {
  const [comissaoPerc, setComissaoPerc] = useState(0);
  const [gastosAdicionais, setGastosAdicionais] = useState(0);
  const [tipoProduto, setTipoProduto] = useState<"importado" | "industrializado">("importado");
  const [showFreight, setShowFreight] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("custos");

  // Freight calculation
  const totalProdutos = items.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0);
  const totalVolumes = items.reduce((sum, item) => sum + item.quantidade, 0);
  const totalPeso = items.reduce((sum, item) => sum + (item.pesoBrutoCaixa || 5) * item.quantidade, 0);
  const totalMetroCubico = items.reduce((sum, item) => {
    if (item.dimsStr) {
      const parts = item.dimsStr.split("x").map(Number);
      if (parts.length === 3) {
        return sum + (parts[0] * parts[1] * parts[2] / 1000000) * item.quantidade;
      }
    }
    return sum + 0.03 * item.quantidade;
  }, 0);

  // Stabilize query input
  const queryItems = useMemo(() =>
    items.map(i => ({ codigoItem: i.codigoItem, quantidade: i.quantidade, precoUnitario: i.precoUnitario })),
    [items.map(i => `${i.codigoItem}:${i.quantidade}:${i.precoUnitario}`).join(",")]
  );

  // Calculate sales costs query
  const { data: costsData, isLoading: costsLoading, isError: costsError } = trpc.salesOrders.calculateSalesCosts.useQuery(
    {
      items: queryItems,
      ufDestino: uf || "MG",
      tipoContribuinte: tipoContribuinte as "Contribuinte" | "Não contribuinte" | "Isento",
      tipoProduto,
      comissaoPercentual: comissaoPerc,
      freteValor: Number(valorFrete) || 0,
      gastosAdicionais,
    },
    { enabled: items.length > 0, staleTime: 60 * 1000, retry: 1, retryDelay: 2000 }
  );

  // Freight quote mutation
  const quoteAllMutation = trpc.salesOrders.quoteAllCarriers.useMutation({
    onSuccess: (data) => {
      setShowResults(true);
      const validQuotes = data.filter((q: any) => !q.error && q.totalFrete > 0);
      toast.success(`${validQuotes.length} cotações válidas de ${data.length} total`);
    },
    onError: (err) => {
      toast.error("Erro ao cotar frete: " + err.message);
    },
  });

  const handleSimularFrete = () => {
    if (!cep) {
      toast.error("CEP do cliente não informado. Volte ao passo 1 e preencha o CEP.");
      return;
    }
    if (items.length === 0) {
      toast.error("Nenhum produto no carrinho.");
      return;
    }
    quoteAllMutation.mutate({
      cnpjDestinatario: cnpjCpf.replace(/\D/g, "") || undefined,
      cepDestino: cep.replace(/\D/g, ""),
      valorMercadoria: totalProdutos,
      peso: totalPeso,
      volumes: totalVolumes,
      metroCubico: totalMetroCubico > 0 ? totalMetroCubico : 0.05,
      tipoContribuinte: tipoContribuinte as "Contribuinte" | "Não Contribuinte",
    });
  };

  const handleUsarCotacao = (valor: number) => {
    setValorFrete(String(valor.toFixed(2)));
    toast.success(`Frete de ${formatCurrency(valor)} aplicado ao pedido`);
  };

  // Group freight results by transportadora
  const groupedResults = quoteAllMutation.data
    ? quoteAllMutation.data.reduce((acc: Record<string, any[]>, quote: any) => {
        if (!acc[quote.transportadora]) acc[quote.transportadora] = [];
        acc[quote.transportadora].push(quote);
        return acc;
      }, {} as Record<string, any[]>)
    : null;

  // Margin color
  const getMarginColor = (perc: number) => {
    if (perc >= 20) return "text-green-600 bg-green-50 border-green-200";
    if (perc >= 10) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (perc >= 5) return "text-amber-600 bg-amber-50 border-amber-200";
    if (perc >= 0) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase">3. Custos de Venda</p>

      {/* Controls row */}
      <div className="grid grid-cols-2 gap-2">
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
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
          <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">UF Destino</label>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 py-1.5">{uf || "MG"}</p>
        </div>
      </div>

      {/* Margin Summary Bar */}
      {costsData && (
        <div className={`p-3 rounded-lg border ${getMarginColor(costsData.margem.margemPercentual)}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Margem de Lucro</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black">{formatPercent(costsData.margem.margemPercentual)}</span>
              {costsData.margem.margemPercentual >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="w-full h-2.5 bg-white/50 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                costsData.margem.margemPercentual >= 10 ? "bg-green-500" :
                costsData.margem.margemPercentual >= 5 ? "bg-amber-500" :
                costsData.margem.margemPercentual >= 0 ? "bg-orange-500" : "bg-red-500"
              }`}
              style={{ width: `${Math.max(0, Math.min(100, costsData.margem.margemPercentual + 10))}%` }}
            />
          </div>
          <div className="grid grid-cols-6 gap-1 text-center text-[9px]">
            <div>
              <p className="font-bold">{formatCurrency(costsData.margem.valorVenda)}</p>
              <p className="text-slate-500">Venda</p>
            </div>
            <div>
              <p className="font-bold text-red-600">-{formatCurrency(costsData.margem.custoMercadoria)}</p>
              <p className="text-slate-500">Custo</p>
            </div>
            <div>
              <p className="font-bold text-red-600">-{formatCurrency(costsData.margem.totalImpostos)}</p>
              <p className="text-slate-500">Impostos</p>
            </div>
            <div>
              <p className="font-bold text-red-600">-{formatCurrency(costsData.margem.comissao)}</p>
              <p className="text-slate-500">Comissão</p>
            </div>
            <div>
              <p className="font-bold text-red-600">-{formatCurrency(costsData.margem.frete)}</p>
              <p className="text-slate-500">Frete</p>
            </div>
            <div>
              <p className="font-bold text-red-600">-{formatCurrency(costsData.margem.gastosAdicionais)}</p>
              <p className="text-slate-500">Gastos Ad.</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-current/20 flex items-center justify-between">
            <span className="text-[10px] font-medium">Lucro Líquido:</span>
            <span className="text-sm font-black">{formatCurrency(costsData.margem.lucroLiquido)}</span>
          </div>
        </div>
      )}

      {costsLoading && items.length > 0 && (
        <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600 animate-pulse">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-teal-500 animate-spin" />
            <span className="text-xs text-slate-500">Calculando custos de venda...</span>
          </div>
        </div>
      )}

      {costsError && items.length > 0 && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <span className="text-xs text-red-600 dark:text-red-400">Erro ao calcular custos. Os valores de impostos e custo da mercadoria podem estar indisponíveis. Tente novamente.</span>
        </div>
      )}

      {/* ===== SECTION 1: CUSTO DA MERCADORIA ===== */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("custos")}
          className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-green-600" />
            <span>1. Custo da Mercadoria</span>
            {costsData && (
              <span className="text-green-700 font-black">{formatCurrency(costsData.custoMercadoria.total)}</span>
            )}
          </div>
          {expandedSection === "custos" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expandedSection === "custos" && costsData && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">
              Custo em tempo real da aba Importação ({costsData.custoMercadoria.items.length} itens)
            </p>
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {costsData.custoMercadoria.items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-[10px] py-0.5">
                  <span className="truncate flex-1 text-slate-600 dark:text-slate-300">
                    {item.codigoItem} - {item.descricao} (×{item.quantidade})
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
            {costsData.custoMercadoria.items.some((i: any) => i.fonte === "Sem custo") && (
              <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-[9px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span>Alguns itens não possuem custo cadastrado na importação.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== SECTION 2: IMPOSTOS ===== */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("impostos")}
          className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Calculator className="w-3.5 h-3.5 text-red-600" />
            <span>2. Impostos</span>
            {costsData && (
              <span className="text-red-700 font-black">{formatCurrency(costsData.impostos.totalImpostosValor)} ({formatPercent(costsData.impostos.totalImpostosPerc)})</span>
            )}
          </div>
          {expandedSection === "impostos" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expandedSection === "impostos" && costsData && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            {/* Tax context */}
            <div className="grid grid-cols-3 gap-2 text-[9px] pb-2 border-b border-slate-100 dark:border-slate-700 mb-2">
              <div>
                <span className="text-slate-400 uppercase font-bold">UF Destino</span>
                <p className="font-bold text-slate-700 dark:text-slate-200">{uf || "MG"}</p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold">Contribuinte</span>
                <p className="font-bold text-slate-700 dark:text-slate-200">{tipoContribuinte || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold">Fat. Trimestral</span>
                <p className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(costsData.faturamentoTrimestral)}</p>
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
                  <td className="text-right">{formatPercent(costsData.impostos.icmsEfetivo)}</td>
                  <td className="text-right font-medium">{formatCurrency(costsData.impostos.icmsValor)}</td>
                </tr>
                <tr>
                  <td className="py-0.5">PIS</td>
                  <td className="text-right">{formatPercent(costsData.impostos.pisEfetivo)}</td>
                  <td className="text-right font-medium">{formatCurrency(costsData.impostos.pisValor)}</td>
                </tr>
                <tr>
                  <td className="py-0.5">COFINS</td>
                  <td className="text-right">{formatPercent(costsData.impostos.cofinsEfetiva)}</td>
                  <td className="text-right font-medium">{formatCurrency(costsData.impostos.cofinsValor)}</td>
                </tr>
                <tr>
                  <td className="py-0.5">IRPJ</td>
                  <td className="text-right">{formatPercent(costsData.impostos.irpjEfetivo)}</td>
                  <td className="text-right font-medium">{formatCurrency(costsData.impostos.irpjValor)}</td>
                </tr>
                <tr>
                  <td className="py-0.5">CSLL</td>
                  <td className="text-right">{formatPercent(costsData.impostos.csllEfetiva)}</td>
                  <td className="text-right font-medium">{formatCurrency(costsData.impostos.csllValor)}</td>
                </tr>
                {costsData.impostos.temDifal && (
                  <tr className="text-amber-700 dark:text-amber-400">
                    <td className="py-0.5 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      DIFAL
                    </td>
                    <td className="text-right">{formatPercent(costsData.impostos.difalEfetivo)}</td>
                    <td className="text-right font-medium">{formatCurrency(costsData.impostos.difalValor)}</td>
                  </tr>
                )}
                <tr className="border-t border-slate-200 dark:border-slate-600 font-bold">
                  <td className="py-1">TOTAL IMPOSTOS</td>
                  <td className="text-right">{formatPercent(costsData.impostos.totalImpostosPerc)}</td>
                  <td className="text-right">{formatCurrency(costsData.impostos.totalImpostosValor)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== SECTION 3: COMISSÃO DO VENDEDOR ===== */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("comissao")}
          className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Percent className="w-3.5 h-3.5 text-blue-600" />
            <span>3. Comissão do Vendedor</span>
            {costsData && (
              <span className="text-blue-700 font-black">{formatCurrency(costsData.comissao.valor)} ({comissaoPerc}%)</span>
            )}
          </div>
          {expandedSection === "comissao" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expandedSection === "comissao" && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Comissão (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={comissaoPerc}
                  onChange={(e) => setComissaoPerc(Number(e.target.value))}
                  className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5"
                />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Valor da Comissão</label>
                <p className="text-sm font-bold text-blue-700 dark:text-blue-400 py-1">
                  {costsData ? formatCurrency(costsData.comissao.valor) : "—"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== SECTION 4: TRANSPORTADORA / FRETE ===== */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("frete")}
          className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Truck className="w-3.5 h-3.5 text-teal-600" />
            <span>4. Transportadora (Frete)</span>
            {Number(valorFrete) > 0 && (
              <span className="text-teal-700 font-black">{formatCurrency(Number(valorFrete))}</span>
            )}
          </div>
          {expandedSection === "frete" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expandedSection === "frete" && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 space-y-3">
            {/* Transportadoras cadastradas */}
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <Truck className="w-3 h-3" /> Transportadoras com API Cadastradas
              </p>
              <div className="grid grid-cols-1 gap-2">
                {TRANSPORTADORAS.map((t) => (
                  <div key={t.nome} className={`rounded-lg border p-2.5 ${t.cor}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">{t.nome}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${t.corBadge}`}>{t.tipo}</span>
                      </div>
                      <span className="text-[8px] font-medium text-green-600 flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> {t.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {t.cnpjs.map((c) => (
                        <span key={c.cnpj} className="text-[8px] bg-white/60 dark:bg-slate-700/60 px-1 py-0.5 rounded border border-slate-200/50 text-slate-600 dark:text-slate-300">
                          {formatCnpj(c.cnpj)} <span className="text-slate-400">({c.label})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[8px] text-slate-400 italic">Em breve: Flor de Minas e Rodonaves</p>
            </div>

            {/* Dados da simulação */}
            <div className="bg-white dark:bg-slate-700/50 rounded-lg p-2.5 space-y-1">
              <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <Package className="w-3 h-3" /> Dados da Simulação
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[9px]">
                <div><span className="text-slate-400">CEP Destino:</span><p className="font-medium text-slate-700 dark:text-slate-200">{cep || "—"}</p></div>
                <div><span className="text-slate-400">Valor:</span><p className="font-medium text-slate-700 dark:text-slate-200">{formatCurrency(totalProdutos)}</p></div>
                <div><span className="text-slate-400">Peso:</span><p className="font-medium text-slate-700 dark:text-slate-200">{totalPeso.toFixed(1)} kg</p></div>
                <div><span className="text-slate-400">Volumes:</span><p className="font-medium text-slate-700 dark:text-slate-200">{totalVolumes}</p></div>
                <div><span className="text-slate-400">Cubagem:</span><p className="font-medium text-slate-700 dark:text-slate-200">{totalMetroCubico.toFixed(4)} m³</p></div>
                <div><span className="text-slate-400">CNPJ Dest.:</span><p className="font-medium text-slate-700 dark:text-slate-200">{cnpjCpf ? formatCnpj(cnpjCpf.replace(/\D/g, "")) : "—"}</p></div>
                <div><span className="text-slate-400">Contribuinte:</span><p className="font-medium text-slate-700 dark:text-slate-200">{tipoContribuinte || "—"}</p></div>
                <div><span className="text-slate-400">CEP Origem:</span><p className="font-medium text-slate-700 dark:text-slate-200">32210-130</p></div>
              </div>
            </div>

            {/* Botão Simular */}
            <button
              onClick={handleSimularFrete}
              disabled={quoteAllMutation.isPending || !cep || items.length === 0}
              className="w-full py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {quoteAllMutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando 4 transportadoras...</>
              ) : (
                <><Truck className="w-3.5 h-3.5" /> Simular Frete (Braspress + Alfa + Camilo + Rodonaves)</>
              )}
            </button>

            {/* Resultados */}
            {showResults && groupedResults && (
              <div className="space-y-2">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Cotações:</p>
                {Object.entries(groupedResults).map(([transportadora, quotes]: [string, any]) => {
                  const corHeader = transportadora === "Braspress"
                    ? "border-blue-300 bg-blue-50 dark:bg-blue-900/20"
                    : transportadora === "Alfa Transportes"
                    ? "border-purple-300 bg-purple-50 dark:bg-purple-900/20"
                    : transportadora === "Rodonaves"
                    ? "border-green-300 bg-green-50 dark:bg-green-900/20"
                    : "border-amber-300 bg-amber-50 dark:bg-amber-900/20";
                  return (
                    <div key={transportadora} className={`rounded-lg border ${corHeader} overflow-hidden`}>
                      <div className="px-3 py-1.5 border-b border-inherit">
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{transportadora}</span>
                      </div>
                      <div className="divide-y divide-slate-200/50">
                        {quotes.map((quote: any, idx: number) => (
                          <div key={idx} className="px-3 py-1.5 flex items-center justify-between">
                            <p className="text-[9px] text-slate-500">
                              CNPJ: <span className="font-medium text-slate-700 dark:text-slate-200">{formatCnpj(quote.cnpj)}</span>
                            </p>
                            {!quote.error ? (
                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <p className="text-[11px] font-bold text-green-700">{formatCurrency(quote.totalFrete)}</p>
                                  <p className="text-[8px] text-slate-400">{quote.prazo}</p>
                                </div>
                                <button
                                  onClick={() => handleUsarCotacao(quote.totalFrete)}
                                  className="px-2 py-1 bg-teal-600 text-white rounded text-[8px] font-bold hover:bg-teal-700 cursor-pointer"
                                >
                                  Usar
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[8px] text-red-600">
                                <AlertCircle className="w-3 h-3" />
                                <span className="max-w-[120px] truncate">{quote.error}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Manual freight fields */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-600">
              <div>
                <label className="text-[9px] text-slate-500 font-medium">Valor do Frete (R$)</label>
                <input
                  type="number"
                  value={valorFrete}
                  onChange={(e) => setValorFrete(e.target.value)}
                  placeholder="0,00"
                  className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-500 font-medium">Tipo de Frete</label>
                <select
                  value={tipoFrete}
                  onChange={(e) => setTipoFrete(e.target.value)}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="CIF">CIF (Frete por conta do vendedor)</option>
                  <option value="FOB">FOB (Frete por conta do comprador)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== SECTION 5: GASTOS ADICIONAIS ===== */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("gastos")}
          className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <PlusCircle className="w-3.5 h-3.5 text-orange-600" />
            <span>5. Gastos Adicionais</span>
            {gastosAdicionais > 0 && (
              <span className="text-orange-700 font-black">{formatCurrency(gastosAdicionais)}</span>
            )}
          </div>
          {expandedSection === "gastos" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expandedSection === "gastos" && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Valor (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={gastosAdicionais || ""}
              onChange={(e) => setGastosAdicionais(Number(e.target.value) || 0)}
              placeholder="0,00"
              className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5"
            />
            <p className="text-[8px] text-slate-400 mt-1">Custos extras não cobertos acima (embalagem especial, seguro, etc.)</p>
          </div>
        )}
      </div>

      {/* ===== CONDIÇÕES DO PEDIDO ===== */}
      <div className="border-t border-slate-200 dark:border-slate-600 pt-3 space-y-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase">Condições do Pedido</p>
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="text-[9px] text-slate-500 font-medium">
              Condição de Pagamento {formaPagamento === "A prazo" && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={condicaoPagamento}
              onChange={(e) => setCondicaoPagamento(e.target.value)}
              placeholder="Ex: 21/35 ou 30/60/90"
              className={`w-full mt-0.5 px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 ${formaPagamento === "A prazo" && !condicaoPagamento ? 'border-red-300 dark:border-red-600' : 'border-slate-200 dark:border-slate-600'}`}
              required={formaPagamento === "A prazo"}
            />
            {formaPagamento === "A prazo" && !condicaoPagamento && <p className="text-[8px] text-red-500 mt-0.5">Obrigatório para pagamento a prazo</p>}
          </div>
          <div>
            <label className="text-[9px] text-slate-500 font-medium">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais do pedido..."
              rows={2}
              className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 resize-none"
            />
          </div>
        </div>
      </div>

      {/* ===== DADOS PARA MAXIPROD ===== */}
      <div className="border-t border-slate-200 dark:border-slate-600 pt-3 space-y-2">
        <p className="text-[10px] font-bold text-amber-600 uppercase">Dados para Maxiprod (Pedido de Venda)</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="text-[9px] text-slate-500 font-medium">Operação Fiscal *</label>
            <select
              value={operacaoFiscal}
              onChange={(e) => setOperacaoFiscal(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="6101 - Fora do Estado - Madeira">6101 - Fora do Estado - Madeira</option>
              <option value="6101 - Fora do Estado - Aromas">6101 - Fora do Estado - Aromas</option>
              <option value="5101 - Dentro do Estado - Madeira">5101 - Dentro do Estado - Madeira</option>
              <option value="5101 - Dentro do Estado - Aromas">5101 - Dentro do Estado - Aromas</option>
              <option value="6108 - Fora do Estado - Consumidor Final">6108 - Fora do Estado - Consumidor Final</option>
              <option value="5102 - Dentro do Estado - Revenda">5102 - Dentro do Estado - Revenda</option>
              <option value="6102 - Fora do Estado - Revenda">6102 - Fora do Estado - Revenda</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-[9px] text-slate-500 font-medium">Natureza da Operação</label>
            <select
              value={naturezaOperacao}
              onChange={(e) => setNaturezaOperacao(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="Venda de produção do estabelecimento">Venda de produção do estabelecimento</option>
              <option value="Venda de mercadoria adquirida">Venda de mercadoria adquirida</option>
              <option value="Transferência de produção do estabelecimento">Transferência de produção do estabelecimento</option>
              <option value="Devolução de compra">Devolução de compra</option>
              <option value="Remessa para industrialização">Remessa para industrialização</option>
              <option value="Remessa para conserto">Remessa para conserto</option>
              <option value="Venda para entrega futura">Venda para entrega futura</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] text-slate-500 font-medium">Estado Configurável</label>
            <select
              value={estadoConfiguravel}
              onChange={(e) => setEstadoConfiguravel(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="MADEIRA">MADEIRA</option>
              <option value="AROMAS">AROMAS</option>
              <option value="ESPETOS">ESPETOS</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] text-slate-500 font-medium">Forma de Pagamento <span className="text-red-500">*</span></label>
            <select
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              className={`w-full mt-0.5 px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 ${!formaPagamento ? 'border-red-300 dark:border-red-600' : 'border-slate-200 dark:border-slate-600'}`}
              required
            >
              <option value="">Selecione...</option>
              <option value="A prazo">A prazo</option>
              <option value="À vista">À vista</option>
              <option value="Sem pagamento">Sem pagamento</option>
              <option value="Outros">Outros</option>
            </select>
            {!formaPagamento && <p className="text-[8px] text-red-500 mt-0.5">Campo obrigatório</p>}
          </div>
          <div>
            <label className="text-[9px] text-slate-500 font-medium">Data de Entrega</label>
            <input
              type="date"
              value={dataEntregaPedido}
              onChange={(e) => setDataEntregaPedido(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="text-[9px] text-slate-500 font-medium">Previsão de Entrega</label>
            <input
              type="date"
              value={previsaoEntregaPedido}
              onChange={(e) => setPrevisaoEntregaPedido(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
        <p className="text-[8px] text-amber-500 mt-1">Estes campos serão usados na exportação do pedido para o Maxiprod.</p>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
          Voltar
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          Próximo: Revisão
        </button>
      </div>
    </div>
  );
}
