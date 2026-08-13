/**
 * CustosDeVendaStep - Step "Custos de Venda" do formulário de pedido
 * Mostra 5 seções:
 * 1. Custo da Mercadoria (da importação em tempo real)
 * 2. Impostos discriminados (ICMS, PIS, COFINS, IRPJ, CSLL, DIFAL)
 * 3. Comissão do Vendedor (campo %)
 * 4. Transportadora / Frete (simulação com 3 APIs)
 * 5. Gastos Adicionais (campo manual)
 */
import { parseDimensions } from "@shared/parseDimensions";
import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Truck, Loader2, AlertCircle, CheckCircle2, Package,
  Calculator, ChevronDown, ChevronUp, DollarSign, Percent,
  AlertTriangle, BarChart3, TrendingUp, TrendingDown, PlusCircle, Download
} from "lucide-react";
import { toast } from "sonner";
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
  onTransportadoraSelect?: (nome: string) => void;
  onProtocoloSet?: (protocolo: string) => void;
  onTrackingUrlSet?: (url: string) => void;
  onBack: () => void;
  onNext: () => void;
  onRealCostsCalculated?: (data: { comissaoPerc: number; fretePerc: number; margemReal: number; comissaoFonte?: string; comissaoTier?: string }) => void;
  skipMarginBlock?: boolean; // When true, gestor can proceed even with critico_bloqueado
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
  {
    nome: "Flor de Minas",
    tipo: "Planilha/Tabela",
    cnpjs: [
      { cnpj: "—", label: "Tabela única (sem CNPJ)" },
    ],
    status: "Ativa",
    cor: "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800",
    corBadge: "bg-rose-100 text-rose-700",
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
  onTransportadoraSelect,
  onProtocoloSet,
  onTrackingUrlSet,
  onBack,
  onNext,
  sellerId,
  onRealCostsCalculated,
  skipMarginBlock = false,
}: CustosDeVendaStepProps) {
  const { hasGranularAccess } = useOperator();
  const canEditComissao = hasGranularAccess("gc.editarComissao");
  const [comissaoPercOverride, setComissaoPercOverride] = useState<number | null>(null);
  const [gastosAdicionais, setGastosAdicionais] = useState(0);
  const [tipoProduto, setTipoProduto] = useState<"importado" | "industrializado">("importado");
  const [notaFiscalPercentual, setNotaFiscalPercentual] = useState(100);
  const [showFreight, setShowFreight] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showTransportDetails, setShowTransportDetails] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("custos");

  // Freight calculation
  const totalProdutos = items.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0);
  const totalVolumes = items.reduce((sum, item) => sum + item.quantidade, 0);
  const totalPeso = items.reduce((sum, item) => sum + (item.pesoBrutoCaixa || 5) * item.quantidade, 0);
  const totalMetroCubico = items.reduce((sum, item) => {
    if (item.dimsStr) {
      const dP = parseDimensions(item.dimsStr);
      if (dP) {
        return sum + (dP.comprimento / 100) * (dP.largura / 100) * (dP.altura / 100) * item.quantidade;
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
  // Normalize tipoContribuinte to match backend enum
  const normalizedTipoContribuinte = (() => {
    const val = (tipoContribuinte || "").toUpperCase().trim();
    if (val === "CONTRIBUINTE" || val === "Contribuinte".toUpperCase()) return "Contribuinte" as const;
    if (val.includes("NAO") || val.includes("NÃO") || val.includes("NÃO")) return "Não contribuinte" as const;
    if (val === "ISENTO" || val === "Isento".toUpperCase()) return "Isento" as const;
    return "Contribuinte" as const;
  })();

  const { data: costsData, isLoading: costsLoading, isError: costsError } = trpc.salesOrders.calculateSalesCosts.useQuery(
    {
      items: queryItems,
      ufDestino: uf || "MG",
      tipoContribuinte: normalizedTipoContribuinte,
      tipoProduto,
      ...(comissaoPercOverride !== null && comissaoPercOverride > 0 ? { comissaoPercentual: comissaoPercOverride } : {}),
      ...(sellerId ? { sellerId } : {}),
      freteValor: Number(valorFrete) || 0,
      gastosAdicionais,
      notaFiscalPercentual,
    },
    { enabled: items.length > 0, staleTime: 60 * 1000, retry: 1, retryDelay: 2000 }
  );

  // Emit real costs to parent when costsData changes
  const onRealCostsRef = useRef(onRealCostsCalculated);
  onRealCostsRef.current = onRealCostsCalculated;
  useEffect(() => {
    if (costsData && onRealCostsRef.current) {
      const freteVal = Number(valorFrete) || 0;
      const valorVenda = costsData.margem.valorVenda;
      const fretePerc = valorVenda > 0 ? (freteVal / valorVenda) * 100 : 0;
      const comissaoPerc = costsData.comissao.percentual;
      const margemReal = costsData.margem.margemPercentual;
      const comissaoFonte = costsData.comissao.fonte || undefined;
      const comissaoTier = costsData.comissao.tier || undefined;
      onRealCostsRef.current({ comissaoPerc, fretePerc, margemReal, comissaoFonte, comissaoTier });
    }
  }, [costsData, valorFrete]);

  // Save freight simulation mutation
  const saveSimulationMutation = trpc.salesOrders.saveFreightSimulation.useMutation();
  // Select freight carrier mutation
  const selectCarrierMutation = trpc.salesOrders.selectFreightCarrier.useMutation();
  // Current simulation ID (after save)
  const [currentSimulationId, setCurrentSimulationId] = useState<number | null>(null);
  // PDF state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Freight quote mutation
  const quoteAllMutation = trpc.salesOrders.quoteAllCarriers.useMutation({
    onSuccess: (data) => {
      setShowResults(true);
      const validQuotes = data.filter((q: any) => !q.error && q.totalFrete > 0);
      toast.success(`${validQuotes.length} cotações válidas de ${data.length} total`);
      // Auto-save simulation to DB for persistence
      saveSimulationMutation.mutate({
        cepDestino: cep.replace(/\D/g, ""),
        cnpjDestinatario: cnpjCpf.replace(/\D/g, "") || undefined,
        valorMercadoria: totalProdutos,
        pesoTotal: totalPeso,
        volumes: totalVolumes,
        cubagemTotal: totalMetroCubico > 0 ? totalMetroCubico : 0.05,
        tipoContribuinte: tipoContribuinte || undefined,
        results: data,
      }, {
        onSuccess: (res) => {
          setCurrentSimulationId(res.id);
          console.log(`[FreightSim] Saved simulation id=${res.id}`);
        },
      });
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

  const handleUsarCotacao = async (valor: number, transportadora?: string, trackingUrl?: string, protocolo?: string, cnpj?: string) => {
    setValorFrete(String(valor.toFixed(2)));
    if (transportadora && onTransportadoraSelect) {
      onTransportadoraSelect(transportadora);
    }
    const protocoloFinal = protocolo || `COT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString(36).toUpperCase()}`;
    if (onProtocoloSet) {
      onProtocoloSet(protocoloFinal);
    }
    // Pass tracking URL to parent for saving with the order
    if (trackingUrl && trackingUrl !== "rastreio-interno" && onTrackingUrlSet) {
      onTrackingUrlSet(trackingUrl);
    }
    toast.success(`Frete de ${formatCurrency(valor)} aplicado ao pedido${transportadora ? ` (${transportadora})` : ''}`);

    // Mark selection in DB and generate PDF
    if (currentSimulationId) {
      selectCarrierMutation.mutate({
        simulationId: currentSimulationId,
        selectedTransportadora: transportadora || "Manual",
        selectedCnpj: cnpj,
        selectedValor: valor,
        selectedProtocolo: protocoloFinal,
      });
      // Generate PDF report
      setGeneratingPdf(true);
      try {
        const resp = await fetch(`/api/freight/export-pdf/${currentSimulationId}`);
        if (resp.ok) {
          const data = await resp.json();
          setPdfUrl(data.pdfUrl);
          toast.success("Relatório PDF gerado com sucesso!");
        }
      } catch (e) {
        console.error("[FreightPDF] Error generating:", e);
      } finally {
        setGeneratingPdf(false);
      }
    }
  };

  // Generate freight report as downloadable text
  const generateFreightReport = () => {
    if (!quoteAllMutation.data) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR');
    let report = `═══════════════════════════════════════════════════════════════\n`;
    report += `              RELATÓRIO DE COTAÇÃO DE FRETE\n`;
    report += `═══════════════════════════════════════════════════════════════\n\n`;
    report += `Data: ${dateStr} às ${timeStr}\n`;
    report += `CEP Origem: 37264-000 (Grupo Fox)\n`;
    report += `CEP Destino: ${cep}\n`;
    if (cnpjCpf) report += `CNPJ/CPF Destinatário: ${cnpjCpf}\n`;
    report += `\n───────────────────────────────────────────────────────────────\n`;
    report += `DADOS DA CARGA\n`;
    report += `───────────────────────────────────────────────────────────────\n`;
    report += `Valor da Mercadoria: ${formatCurrency(totalProdutos)}\n`;
    report += `Peso Total: ${totalPeso.toFixed(2)} kg\n`;
    report += `Volumes: ${totalVolumes}\n`;
    report += `Cubagem Total: ${totalMetroCubico.toFixed(4)} m³\n`;
    report += `\n───────────────────────────────────────────────────────────────\n`;
    report += `PRODUTOS\n`;
    report += `───────────────────────────────────────────────────────────────\n`;
    items.forEach((item, idx) => {
      const pesoItem = (item.pesoBrutoCaixa || 5) * item.quantidade;
      let cubagemItem = 0.03 * item.quantidade;
      if (item.dimsStr) {
        const dP2 = parseDimensions(item.dimsStr);
        if (dP2) cubagemItem = (dP2.comprimento / 100) * (dP2.largura / 100) * (dP2.altura / 100) * item.quantidade;
      }
      report += `${idx + 1}. ${item.descricaoItem} (${item.codigoItem})\n`;
      report += `   Qtd: ${item.quantidade} ${item.unidadeMedida} | Peso: ${pesoItem.toFixed(2)} kg | Cubagem: ${cubagemItem.toFixed(4)} m³\n`;
      if (item.dimsStr) report += `   Dimensões: ${item.dimsStr} cm\n`;
    });
    report += `\n───────────────────────────────────────────────────────────────\n`;
    report += `COTAÇÕES DAS TRANSPORTADORAS\n`;
    report += `───────────────────────────────────────────────────────────────\n\n`;
    const validQuotes = quoteAllMutation.data.filter((q: any) => !q.error && q.totalFrete > 0);
    const errorQuotes = quoteAllMutation.data.filter((q: any) => q.error || q.totalFrete === 0);
    validQuotes.sort((a: any, b: any) => a.totalFrete - b.totalFrete);
    validQuotes.forEach((q: any, idx: number) => {
      report += `${idx === 0 ? '★ ' : '  '}${q.transportadora}${q.cnpj ? ` (CNPJ: ${formatCnpj(q.cnpj)})` : ''}\n`;
      report += `   Valor: ${formatCurrency(q.totalFrete)} | Prazo: ${q.prazo}\n`;
      if (q.protocolo) report += `   Protocolo: ${q.protocolo}\n`;
      report += `\n`;
    });
    if (errorQuotes.length > 0) {
      report += `\nTransportadoras com erro:\n`;
      errorQuotes.forEach((q: any) => {
        report += `  ✗ ${q.transportadora}: ${q.error}\n`;
      });
    }
    report += `\n═══════════════════════════════════════════════════════════════\n`;
    // Per-carrier breakdown
    report += `\n───────────────────────────────────────────────────────────────\n`;
    report += `DETALHAMENTO POR TRANSPORTADORA\n`;
    report += `───────────────────────────────────────────────────────────────\n\n`;
    const byCarrierTxt: Record<string, any[]> = {};
    quoteAllMutation.data.forEach((q: any) => {
      if (!byCarrierTxt[q.transportadora]) byCarrierTxt[q.transportadora] = [];
      byCarrierTxt[q.transportadora].push(q);
    });
    Object.keys(byCarrierTxt).sort().forEach(carrier => {
      report += `▸ ${carrier}\n`;
      byCarrierTxt[carrier].forEach((q: any) => {
        if (!q.error && q.totalFrete > 0) {
          report += `    CNPJ: ${q.cnpj ? formatCnpj(q.cnpj) : "—"} | Valor: ${formatCurrency(q.totalFrete)} | Prazo: ${q.prazo || "—"} | Protocolo: ${q.protocolo || "SEM PROTOCOLO"}\n`;
        } else {
          report += `    CNPJ: ${q.cnpj ? formatCnpj(q.cnpj) : "—"} | ERRO: ${q.error || "Sem resposta"}\n`;
        }
      });
      report += `\n`;
    });

    report += `Relatório gerado automaticamente pelo Grupo Fox Dashboard\n`;
    // Download
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-frete-${cep.replace(/\D/g, '')}-${now.toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Relatório de frete baixado!');
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

      {/* ===== BARRA DE PROGRESSO - MÉDIA MENSAL DO VENDEDOR ===== */}
      {costsData && (costsData.comissao as any).mediaMensalVendedor !== null && (costsData.comissao as any).mediaMensalVendedor !== undefined && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">Média Mensal do Vendedor</span>
            </div>
            <span className={`text-sm font-black ${
              (costsData.comissao as any).mediaMensalVendedor > 25 ? 'text-green-600' :
              (costsData.comissao as any).mediaMensalVendedor > 20 ? 'text-emerald-600' :
              (costsData.comissao as any).mediaMensalVendedor > 15 ? 'text-amber-600' :
              'text-red-600'
            }`}>{((costsData.comissao as any).mediaMensalVendedor ?? 0).toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
            {/* Marcador de 15% */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10" style={{ left: '50%' }} />
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                (costsData.comissao as any).mediaMensalVendedor > 25 ? 'bg-green-500' :
                (costsData.comissao as any).mediaMensalVendedor > 20 ? 'bg-emerald-500' :
                (costsData.comissao as any).mediaMensalVendedor > 15 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, ((costsData.comissao as any).mediaMensalVendedor / 30) * 100))}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[8px] text-slate-400">
            <span>0%</span>
            <span className="text-red-400 font-bold">15% (mínimo)</span>
            <span>30%</span>
          </div>
        </div>
      )}

      {/* ===== VALOR TOTAL DO PEDIDO (DESTAQUE) ===== */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-white/80" />
            <span className="text-sm font-bold text-white/90 uppercase tracking-wide">Valor Total do Pedido</span>
          </div>
          <span className="text-2xl font-black text-white">{formatCurrency(totalProdutos)}</span>
        </div>
        <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-between text-xs text-white/70">
          <span>{items.length} {items.length === 1 ? 'produto' : 'produtos'} | {totalVolumes} {totalVolumes === 1 ? 'volume' : 'volumes'} | {totalPeso.toFixed(1)} kg</span>
        </div>
      </div>

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
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-center text-[9px]">
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
          className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-green-600" />
            <span className="text-sm font-bold">1. Custo da Mercadoria</span>
            {costsData && (
              <span className="text-green-700 font-black text-sm">{formatCurrency(costsData.custoMercadoria.total)}</span>
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
          className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-red-600" />
            <span className="text-sm font-bold">2. Impostos</span>
            {costsData && (
              <span className="text-red-700 font-black text-sm">{formatCurrency(costsData.impostos.totalImpostosValor)} ({formatPercent(costsData.impostos.totalImpostosPerc)})</span>
            )}
          </div>
          {expandedSection === "impostos" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expandedSection === "impostos" && costsData && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            {/* Nota Fiscal % Selector - Manual Input */}
            <div className="mb-3 p-2 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
              <p className="text-[9px] text-slate-500 uppercase font-bold mb-1.5">% da Nota Fiscal</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={notaFiscalPercentual}
                  onChange={(e) => {
                    const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                    setNotaFiscalPercentual(val);
                  }}
                  className="w-20 px-2 py-1.5 rounded-md text-sm font-bold text-center border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                />
                <span className="text-sm font-bold text-slate-500">%</span>
                <span className={`ml-2 px-2 py-1 rounded-md text-[10px] font-bold ${
                  notaFiscalPercentual === 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    : notaFiscalPercentual === 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : notaFiscalPercentual === 100 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  {notaFiscalPercentual === 0 ? 'Sem Nota' : notaFiscalPercentual === 50 ? 'Meia Nota' : notaFiscalPercentual === 100 ? 'Nota Cheia' : `${notaFiscalPercentual}% da Nota`}
                </span>
              </div>
              {notaFiscalPercentual < 100 && (
                <p className="mt-1.5 text-[9px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {notaFiscalPercentual === 0 ? 'Venda sem nota fiscal \u2014 impostos zerados' : `Impostos calculados sobre ${notaFiscalPercentual}% do valor da nota`}
                </p>
              )}
            </div>
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
          className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold">3. Comissão do Vendedor</span>
            {costsData && (
              <span className="text-blue-700 font-black text-sm">{formatCurrency(costsData.comissao.valor)} ({costsData.comissao.percentual.toFixed(1)}%)</span>
            )}
          </div>
          {expandedSection === "comissao" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expandedSection === "comissao" && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            {/* Auto commission info */}
            {costsData && (costsData.comissao as any).fonte !== "manual" && (
              <div className={`mb-2 p-2 rounded border ${
                (costsData.comissao as any).fonte === "critico_bloqueado" ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' :
                (costsData.comissao as any).fonte === "critico_liberado" ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' :
                (costsData.comissao as any).critico ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' :
                'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
              }`}>
                <p className={`text-[10px] font-medium ${
                  (costsData.comissao as any).fonte === "critico_bloqueado" ? 'text-red-700 dark:text-red-300' :
                  (costsData.comissao as any).fonte === "critico_liberado" ? 'text-amber-700 dark:text-amber-300' :
                  (costsData.comissao as any).critico ? 'text-red-700 dark:text-red-300' :
                  'text-blue-700 dark:text-blue-300'
                }`}>
                  {(costsData.comissao as any).fonte === "critico_bloqueado" ? (
                    skipMarginBlock ? (
                      <>⚠️ Margem Crítica ({((costsData.comissao as any).margemSemComissao ?? 0).toFixed(1)}% &lt; 15%) — Média mensal: {((costsData.comissao as any).mediaMensalVendedor ?? 0).toFixed(1)}% (≤ 15%). <strong>Liberado para gestor.</strong></>
                    ) : (
                      <>⚠️ Margem Crítica ({((costsData.comissao as any).margemSemComissao ?? 0).toFixed(1)}% &lt; 15%) — <strong>Pedido BLOQUEADO</strong>. Média mensal do vendedor: {((costsData.comissao as any).mediaMensalVendedor ?? 0).toFixed(1)}% (≤ 15%). Não é possível fechar este pedido.</>
                    )
                  ) : (costsData.comissao as any).fonte === "critico_liberado" ? (
                    <>⚠️ Margem abaixo de 15% ({((costsData.comissao as any).margemSemComissao ?? 0).toFixed(1)}%) — Comissão travada em <strong>4%</strong> (Meta 120%). Média mensal: {((costsData.comissao as any).mediaMensalVendedor ?? 0).toFixed(1)}% (&gt; 15%, liberado).</>
                  ) : (costsData.comissao as any).critico ? (
                    <>⚠️ Margem Crítica ({((costsData.comissao as any).margemSemComissao ?? 0).toFixed(1)}% &lt; 15%) — Comissão zerada automaticamente</>
                  ) : (
                    <>Comissão automática: <strong>{(costsData.comissao as any).autoPercentual}%</strong>
                    {" "}({(costsData.comissao as any).tier === "mostrado_alto" ? "Comissão Alta (≥29%)" : (costsData.comissao as any).tier === "medio_alto" ? "Comissão Média-Alta (25-28,99%)" : (costsData.comissao as any).tier === "medio" ? "Comissão Média (20-24,99%)" : "Comissão Baixa (15-19,99%)"}
                    {" "}| Margem c/ 5.85%: {((costsData.comissao as any).margemParaTier ?? (costsData.comissao as any).margemSemComissao ?? 0).toFixed(1)}%
                    {" "}| Meta: 120%)
                    </>
                  )}
                </p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">
                  Comissão (%) {costsData && (costsData.comissao as any).fonte !== "manual" ? "— Auto" : ""}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={comissaoPercOverride !== null ? comissaoPercOverride : (costsData?.comissao.percentual ?? 0)}
                  onChange={(e) => {
                    if (!canEditComissao) return;
                    const v = Number(e.target.value);
                    setComissaoPercOverride(v > 0 ? v : null);
                  }}
                  disabled={!canEditComissao}
                  className={`w-full text-xs border rounded px-2 py-1.5 ${!canEditComissao ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}
                  placeholder="Auto"
                />
                {!canEditComissao && (
                  <p className="text-[9px] text-slate-400 mt-0.5">Sem permiss\u00e3o para editar comiss\u00e3o</p>
                )}
                {canEditComissao && comissaoPercOverride !== null && comissaoPercOverride > 0 && (
                  <button
                    onClick={() => setComissaoPercOverride(null)}
                    className="text-[9px] text-blue-600 hover:underline mt-0.5"
                  >
                    Usar automático
                  </button>
                )}
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
          className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-bold">4. Transportadora (Frete)</span>
            {Number(valorFrete) > 0 && (
              <span className="text-teal-700 font-black text-sm">{formatCurrency(Number(valorFrete))}</span>
            )}
          </div>
          {expandedSection === "frete" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expandedSection === "frete" && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 space-y-3">
            {/* Botão Simular - SEMPRE VISÍVEL */}
            <button
              onClick={handleSimularFrete}
              disabled={quoteAllMutation.isPending || !cep || items.length === 0}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-sm"
            >
              {quoteAllMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Consultando 5 transportadoras...</>
              ) : (
                <><Truck className="w-4 h-4" /> Simular Frete (Braspress + Alfa + Camilo + Rodonaves + Flor de Minas)</>
              )}
            </button>

            {/* Card recolhível - Detalhes das transportadoras e dados da simulação */}
            <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowTransportDetails(!showTransportDetails)}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-600/50 transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Package className="w-3 h-3" /> Detalhes (CNPJs, dados da carga, transportadoras cadastradas)
                </span>
                {showTransportDetails ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>
              {showTransportDetails && (
                <div className="p-3 border-t border-slate-200 dark:border-slate-600 space-y-3">
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
                  </div>
                </div>
              )}
            </div>

            {/* Botão Baixar Relatório */}
            {showResults && quoteAllMutation.data && (
              <div className="flex gap-2">
                <button
                  onClick={generateFreightReport}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-600"
                >
                  <Download className="w-3 h-3" /> Baixar TXT
                </button>
                {pdfUrl && (
                  <>
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/30 dark:hover:bg-teal-800/40 text-teal-700 dark:text-teal-300 text-[10px] font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-teal-200 dark:border-teal-700"
                    >
                      <Download className="w-3 h-3" /> Visualizar PDF
                    </a>
                    <a
                      href={`/api/freight/export-pdf/${currentSimulationId}?download=true`}
                      className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300 text-[10px] font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-blue-200 dark:border-blue-700"
                    >
                      <Download className="w-3 h-3" /> Baixar PDF
                    </a>
                  </>
                )}
                {generatingPdf && (
                  <div className="flex-1 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-500 text-[10px] font-medium rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-600">
                    <Loader2 className="w-3 h-3 animate-spin" /> Gerando PDF...
                  </div>
                )}
              </div>
            )}
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
                    : transportadora === "Flor de Minas"
                    ? "border-rose-300 bg-rose-50 dark:bg-rose-900/20"
                    : "border-amber-300 bg-amber-50 dark:bg-amber-900/20";
                  return (
                    <div key={transportadora} className={`rounded-lg border ${corHeader} overflow-hidden`}>
                      <div className="px-3 py-1.5 border-b border-inherit">
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{transportadora}</span>
                      </div>
                      <div className="divide-y divide-slate-200/50">
                        {quotes.map((quote: any, idx: number) => (
                          <div key={idx} className="px-3 py-1.5 flex items-center justify-between">
                            <div>
                              <p className="text-[9px] text-slate-500">
                                CNPJ: <span className="font-medium text-slate-700 dark:text-slate-200">{formatCnpj(quote.cnpj)}</span>
                              </p>
                              {quote.protocolo && (
                                <p className="text-[8px] text-slate-400">
                                  Protocolo: <span className="font-mono font-medium text-slate-600 dark:text-slate-300">{quote.protocolo}</span>
                                </p>
                              )}
                            </div>
                            {!quote.error ? (
                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <p className="text-[11px] font-bold text-green-700">
                                    {formatCurrency(quote.totalFrete)}
                                    {totalProdutos > 0 && <span className="ml-1 font-normal text-[8px] text-slate-500">({((quote.totalFrete / totalProdutos) * 100).toFixed(1)}%)</span>}
                                  </p>
                                  <p className="text-[8px] text-slate-400">{quote.prazo}</p>
                                </div>
                                <button
                                  onClick={() => handleUsarCotacao(quote.totalFrete, transportadora, quote.trackingUrl, quote.protocolo, quote.cnpj)}
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
                  <option value="">Selecione...</option>
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
          className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-bold">5. Gastos Adicionais</span>
            {gastosAdicionais > 0 && (
              <span className="text-orange-700 font-black text-sm">{formatCurrency(gastosAdicionais)}</span>
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

      {/* Dados para Maxiprod foram movidos para a tela principal de finalização do pedido */}

      {/* Alerta de bloqueio */}
      {costsData && (costsData.comissao as any).fonte === "critico_bloqueado" && !skipMarginBlock && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-600 rounded-lg animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-300">Pedido Bloqueado</p>
              <p className="text-xs text-red-600 dark:text-red-400">A margem deste pedido está abaixo de 15% e a média mensal do vendedor também está ≤ 15%. Não é possível avançar.</p>
              <p className="text-xs text-red-500 dark:text-red-400 mt-1 font-semibold">
                Falta {(15 - ((costsData.comissao as any).mediaMensalVendedor ?? 0)).toFixed(1)} p.p. para a média mensal atingir 15% (atual: {((costsData.comissao as any).mediaMensalVendedor ?? 0).toFixed(1)}%)
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Alerta informativo (gestor pode prosseguir) */}
      {costsData && (costsData.comissao as any).fonte === "critico_bloqueado" && skipMarginBlock && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-600 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Atenção: Margem Crítica</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">A margem deste pedido está abaixo de 15% e a média mensal do vendedor está ≤ 15%. Liberado para gestor.</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
          Voltar
        </button>
        <button
          onClick={() => {
            if (!skipMarginBlock && costsData && (costsData.comissao as any).fonte === "critico_bloqueado") {
              toast.error("Pedido bloqueado: margem abaixo de 15% e média mensal do vendedor ≤ 15%.");
              return;
            }
            onNext();
          }}
          disabled={!skipMarginBlock && !!(costsData && (costsData.comissao as any).fonte === "critico_bloqueado")}
          className={`px-4 py-2 text-white text-xs font-medium rounded-lg transition-colors ${
            !skipMarginBlock && costsData && (costsData.comissao as any).fonte === "critico_bloqueado"
              ? "bg-slate-400 cursor-not-allowed"
              : "bg-teal-600 hover:bg-teal-700"
          }`}
        >
          Próximo: Revisão
        </button>
      </div>
    </div>
  );
}
