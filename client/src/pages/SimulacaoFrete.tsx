/**
 * Simulação de Frete - Card na Gestão Comercial
 * Permite cotar frete por número do pedido de venda (busca automática do Maxiprod)
 * Suporta múltiplos pedidos combinados em uma única simulação
 */
import { useState } from "react";
import TopNav from "@/components/TopNav";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Truck, Search, Loader2, AlertCircle, CheckCircle2, FileText, Download, Plus, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOperator } from "@/contexts/OperatorContext";

interface CarrierResult {
  transportadora: string;
  cnpj: string;
  totalFrete: number;
  prazo: string;
  protocolo?: string;
  error?: string;
}

interface ItemBreakdown {
  codigo: string;
  descricao: string;
  qtd: number;
  unidade: string;
  pesoBrutoUn: number;
  fatorConv: number;
  pesoCx: number;
  pesoTotal: number;
  dimensoes: string;
  comprimento: number;
  largura: number;
  altura: number;
  volCxM3: number;
  cubagem: number;
}

interface CepChange {
  de: string;
  para: string;
  data: string;
  motivo: string;
}

interface QuoteResult {
  pedido: string;
  pedidos?: string[];
  cliente: string;
  cepDestino: string;
  cnpjDestinatario: string;
  valorMercadoria: number;
  pesoTotal: number;
  volumes: number;
  metroCubico?: number;
  tipoContribuinte?: string;
  carriers: CarrierResult[];
  itemsBreakdown?: ItemBreakdown[];
  endereco?: {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  dimensoes?: {
    altura: number;
    largura: number;
    comprimento: number;
  };
  // Histórico de mudanças de CEP
  enderecoEntregaUsado?: boolean;
  cepOriginalCliente?: string;
  cepChangeHistory?: CepChange[];
}

/**
 * Translate raw carrier error messages into user-friendly Portuguese messages
 */
function friendlyError(error: string): string {
  if (!error) return "";
  const lower = error.toLowerCase();
  if (lower.includes("http 500") || lower.includes("statuscode") || lower.includes("internal server"))
    return "Serviço temporariamente indisponível. Tente novamente em instantes.";
  if (lower.includes("timeout") || lower.includes("econnaborted"))
    return "Tempo de resposta excedido. A transportadora não respondeu a tempo.";
  if (lower.includes("network") || lower.includes("econnrefused"))
    return "Erro de conexão com a transportadora. Verifique sua internet.";
  if (lower.includes("não atende") || lower.includes("nao atende") || lower.includes("fora da área") || lower.includes("fora da area"))
    return "CEP fora da área de cobertura desta transportadora.";
  if (lower.includes("login inválido") || lower.includes("login invalido"))
    return "Erro de autenticação com a transportadora. Contate o suporte.";
  if (lower.includes("não foi possível identificar"))
    return "Cidade de destino não identificada pela transportadora.";
  if (lower.includes("cep") && (lower.includes("inválido") || lower.includes("invalido")))
    return "CEP de destino inválido ou não encontrado.";
  if (lower.includes("tabela") && (lower.includes("não") || lower.includes("nao")))
    return "Sem tabela de preço cadastrada para este destino.";
  // Return cleaned-up version if no match
  return error.length > 120 ? error.substring(0, 120) + "..." : error;
}

export default function SimulacaoFrete() {
  const { hasGranularAccess } = useOperator();
  // Tab mode: "pedido" or "manual"
  const [mode, setMode] = useState<"pedido" | "manual">("pedido");
  // Multiple pedidos support
  const [pedidoInputs, setPedidoInputs] = useState<string[]>([""]);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const quoteSingleMutation = trpc.salesOrders.quoteByPedido.useMutation();
  const quoteMultipleMutation = trpc.salesOrders.quoteByMultiplePedidos.useMutation();
  const quoteManualMutation = trpc.salesOrders.quoteAllCarriers.useMutation();
  const saveSimMutation = trpc.salesOrders.saveFreightSimulation.useMutation();
  const [simulationId, setSimulationId] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Manual mode fields
  const [manualCep, setManualCep] = useState("");
  const [manualCnpj, setManualCnpj] = useState("");
  const [manualPeso, setManualPeso] = useState("");
  const [manualCubagem, setManualCubagem] = useState("");
  const [manualValorNf, setManualValorNf] = useState("");
  const [manualVolumes, setManualVolumes] = useState("1");
  const [manualResult, setManualResult] = useState<any>(null);

  const handleSimularManual = async () => {
    const cep = manualCep.replace(/\D/g, "");
    if (cep.length !== 8) { setErrorMsg("CEP deve ter 8 dígitos"); return; }
    const peso = parseFloat(manualPeso);
    const cubagem = parseFloat(manualCubagem);
    const valorNf = parseFloat(manualValorNf.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!peso || peso <= 0) { setErrorMsg("Informe o peso em kg"); return; }
    if (!valorNf || valorNf <= 0) { setErrorMsg("Informe o valor da NF"); return; }
    setIsLoading(true);
    setErrorMsg("");
    setResult(null);
    setManualResult(null);
    setSimulationId(null);
    setPdfUrl(null);
    try {
      const carriers = await quoteManualMutation.mutateAsync({
        cepDestino: cep,
        cnpjDestinatario: manualCnpj.replace(/\D/g, "") || undefined,
        peso,
        metroCubico: cubagem || peso * 0.004,
        valorMercadoria: valorNf,
        volumes: parseInt(manualVolumes) || 1,
      });
      // Build a QuoteResult-like object for display
      const manualRes: QuoteResult = {
        pedido: "AVULSO",
        cliente: manualCnpj ? `CNPJ: ${manualCnpj}` : "Simulação Avulsa",
        cepDestino: cep,
        cnpjDestinatario: manualCnpj.replace(/\D/g, ""),
        valorMercadoria: valorNf,
        pesoTotal: peso,
        volumes: parseInt(manualVolumes) || 1,
        metroCubico: cubagem || peso * 0.004,
        carriers: carriers as CarrierResult[],
      };
      setResult(manualRes);
      setManualResult(manualRes);
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao simular frete.");
    } finally {
      setIsLoading(false);
    }
  };

  const addPedidoInput = () => {
    setPedidoInputs(prev => [...prev, ""]);
  };

  const removePedidoInput = (index: number) => {
    setPedidoInputs(prev => prev.filter((_, i) => i !== index));
  };

  const updatePedidoInput = (index: number, value: string) => {
    setPedidoInputs(prev => prev.map((v, i) => i === index ? value : v));
  };

  const validPedidos = pedidoInputs.map(p => p.trim()).filter(Boolean);

  const handleSimular = async () => {
    if (validPedidos.length === 0) return;
    setIsLoading(true);
    setErrorMsg("");
    setResult(null);
    setSimulationId(null);
    setPdfUrl(null);
    try {
      let res: any;
      if (validPedidos.length === 1) {
        res = await quoteSingleMutation.mutateAsync({ pedido: validPedidos[0] });
      } else {
        res = await quoteMultipleMutation.mutateAsync({ pedidos: validPedidos });
      }
      setResult(res as QuoteResult);
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao simular frete. Verifique o(s) número(s) do(s) pedido(s).");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSimular();
  };

  const handleGerarPdf = async () => {
    if (!result) return;
    setGeneratingPdf(true);
    try {
      // Save simulation to DB first (if not already saved)
      let simId = simulationId;
      if (!simId) {
        const saved = await saveSimMutation.mutateAsync({
          cepDestino: result.cepDestino,
          cnpjDestinatario: result.cnpjDestinatario || undefined,
          valorMercadoria: result.valorMercadoria,
          pesoTotal: result.pesoTotal,
          volumes: result.volumes,
          cubagemTotal: result.metroCubico || result.volumes * 0.05,
          tipoContribuinte: result.tipoContribuinte || undefined,
          results: {
            carriers: result.carriers,
            pedido: result.pedido,
            pedidos: result.pedidos || [result.pedido],
            cliente: result.cliente,
            itemsBreakdown: result.itemsBreakdown,
            endereco: result.endereco,
            dimensoes: result.dimensoes,
          },
          operatorName: "Simulação de Frete (GC)",
        });
        simId = Number(saved.id);
        setSimulationId(simId);
      }
      // Generate PDF via the export endpoint
      const resp = await fetch(`/api/freight/export-pdf/${simId}`);
      if (resp.ok) {
        const data = await resp.json();
        setPdfUrl(data.pdfUrl);
        window.open(data.pdfUrl, "_blank");
      } else {
        throw new Error("Falha ao gerar PDF");
      }
    } catch (err: any) {
      alert("Erro ao gerar PDF: " + (err?.message || "Erro desconhecido"));
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Permission check
  if (!hasGranularAccess("gc.simulacaoFrete")) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <TopNav />
        <main className="container py-8">
          <p className="text-center text-slate-500">Você não tem permissão para acessar esta funcionalidade.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <TopNav />
      <main className="container py-4 md:py-6 space-y-4 md:space-y-5 pb-20 md:pb-6">
        {/* Header */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-1.5 flex-wrap">
          <Link href="/gestao-comercial">
            <button className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          </Link>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 text-white shadow-sm">
            <Truck className="w-4 h-4" />
            Simulação de Frete
          </div>
        </div>

        {/* Mode tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-1.5 flex gap-1">
          <button
            onClick={() => { setMode("pedido"); setResult(null); setErrorMsg(""); }}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${mode === "pedido" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
          >
            <Search className="w-4 h-4 inline mr-1.5" />
            Por Nº do Pedido
          </button>
          <button
            onClick={() => { setMode("manual"); setResult(null); setErrorMsg(""); }}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${mode === "manual" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
          >
            <Truck className="w-4 h-4 inline mr-1.5" />
            Estimativa Avulsa
          </button>
        </div>

        {/* Input card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          {mode === "pedido" ? (
          <>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
            Cotar Frete por Número do Pedido
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Digite o(s) número(s) do(s) pedido(s) de venda. Para simular frete de múltiplos pedidos juntos (mesmo cliente, mesma entrega), adicione mais pedidos com o botão <strong>+</strong>.
          </p>

          {/* Pedido inputs */}
          <div className="space-y-3 mb-4">
            {pedidoInputs.map((value, index) => (
              <div key={index} className="flex gap-2 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder={index === 0 ? "Nº do pedido (ex: 1596)" : "Nº do pedido adicional"}
                    value={value}
                    onChange={(e) => updatePedidoInput(index, e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
                {index > 0 && (
                  <button
                    onClick={() => removePedidoInput(index)}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Remover pedido"
                    disabled={isLoading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {index === pedidoInputs.length - 1 && (
                  <button
                    onClick={addPedidoInput}
                    className="p-2 rounded-lg text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors border border-cyan-200 dark:border-cyan-800"
                    title="Adicionar outro pedido"
                    disabled={isLoading}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {validPedidos.length > 1 && (
            <p className="text-xs text-cyan-600 dark:text-cyan-400 mb-3 font-medium">
              {validPedidos.length} pedidos serão combinados em uma única simulação de frete.
            </p>
          )}

          <Button
            onClick={handleSimular}
            disabled={isLoading || validPedidos.length === 0}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Simulando...
              </>
            ) : (
              <>
                <Truck className="w-4 h-4 mr-2" />
                Simular Frete
              </>
            )}
          </Button>
          </>
          ) : (
          <>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
            Estimativa Avulsa (Sem Pedido)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Preencha os dados manualmente para obter uma estimativa de frete nas 5 transportadoras.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">CEP Destino *</label>
              <Input
                type="text"
                placeholder="00000-000"
                value={manualCep}
                onChange={(e) => setManualCep(e.target.value)}
                disabled={isLoading}
                maxLength={9}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">CNPJ Destinatário</label>
              <Input
                type="text"
                placeholder="00.000.000/0001-00"
                value={manualCnpj}
                onChange={(e) => setManualCnpj(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Peso (kg) *</label>
              <Input
                type="number"
                placeholder="Ex: 150"
                value={manualPeso}
                onChange={(e) => setManualPeso(e.target.value)}
                disabled={isLoading}
                step="0.1"
                min="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Cubagem (m³)</label>
              <Input
                type="number"
                placeholder="Ex: 0.5"
                value={manualCubagem}
                onChange={(e) => setManualCubagem(e.target.value)}
                disabled={isLoading}
                step="0.01"
                min="0"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Se vazio, estima automaticamente pelo peso</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Valor da NF (R$) *</label>
              <Input
                type="text"
                placeholder="Ex: 5000.00"
                value={manualValorNf}
                onChange={(e) => setManualValorNf(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Volumes</label>
              <Input
                type="number"
                placeholder="1"
                value={manualVolumes}
                onChange={(e) => setManualVolumes(e.target.value)}
                disabled={isLoading}
                min="1"
              />
            </div>
          </div>

          <Button
            onClick={handleSimularManual}
            disabled={isLoading}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Simulando...
              </>
            ) : (
              <>
                <Truck className="w-4 h-4 mr-2" />
                Simular Frete
              </>
            )}
          </Button>
          </>
          )}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Erro na simulação</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{friendlyError(errorMsg)}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
            {/* Order summary */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Resultado - {result.pedidos && result.pedidos.length > 1
                  ? `Pedidos #${result.pedidos.join(", #")}`
                  : `Pedido #${result.pedido}`}
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGerarPdf}
                  disabled={generatingPdf}
                  className="text-cyan-600 border-cyan-300 hover:bg-cyan-50"
                >
                  {generatingPdf ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-1" />
                  )}
                  Gerar Relatório PDF
                </Button>
                {pdfUrl && (
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-800 underline">
                    <Download className="w-3.5 h-3.5" />
                    Baixar PDF
                  </a>
                )}
              </div>
            </div>

            {/* Order info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Cliente</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate" title={result.cliente}>{result.cliente || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">CEP Destino</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{result.cepDestino ? result.cepDestino.replace(/(\d{5})(\d{3})/, "$1-$2") : "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Valor Mercadoria</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">R$ {result.valorMercadoria.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Peso / Volumes</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{result.pesoTotal.toFixed(1)} kg / {result.volumes} vol</p>
              </div>
            </div>

            {/* Endereço de entrega diferente - aviso */}
            {result.enderecoEntregaUsado && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Endereço de entrega diferente do cadastro</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    CEP do cliente: {result.cepOriginalCliente?.replace(/(\d{5})(\d{3})/, "$1-$2")} → CEP de entrega usado: {result.cepDestino.replace(/(\d{5})(\d{3})/, "$1-$2")}
                  </p>
                </div>
              </div>
            )}

            {/* Histórico de mudanças de CEP */}
            {result.cepChangeHistory && result.cepChangeHistory.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">Histórico de Mudanças de CEP</p>
                <div className="space-y-1.5">
                  {result.cepChangeHistory.map((change: { de: string; para: string; data: string; motivo: string }, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                      <span className="font-mono bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded">{change.de.replace(/(\d{5})(\d{3})/, "$1-$2")}</span>
                      <span>→</span>
                      <span className="font-mono bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded">{change.para.replace(/(\d{5})(\d{3})/, "$1-$2")}</span>
                      <span className="text-blue-500">({change.motivo})</span>
                      {change.data && <span className="text-blue-400 ml-auto">{new Date(change.data).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Carriers table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 px-3 font-medium text-slate-600 dark:text-slate-300">Transportadora</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 dark:text-slate-300">CNPJ</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600 dark:text-slate-300">Valor Frete</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 dark:text-slate-300">Prazo</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 dark:text-slate-300">Protocolo</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 dark:text-slate-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.carriers.map((carrier, idx) => (
                    <tr key={idx} className={`border-b border-slate-100 dark:border-slate-700/50 ${carrier.error ? "opacity-70" : ""}`}>
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">{carrier.transportadora}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-xs font-mono">
                        {carrier.cnpj ? carrier.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {carrier.error ? (
                          <span className="text-red-500 text-xs">-</span>
                        ) : (
                          <span className="font-bold text-green-600 dark:text-green-400">
                            R$ {carrier.totalFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            {result.valorMercadoria > 0 && (
                              <span className="ml-1 text-[10px] font-normal text-slate-500 dark:text-slate-400">
                                ({((carrier.totalFrete / result.valorMercadoria) * 100).toFixed(1)}%)
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-400">{carrier.prazo}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-xs font-mono">{carrier.protocolo || "-"}</td>
                      <td className="py-2.5 px-3">
                        {carrier.error ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400" title={carrier.error}>
                            <AlertCircle className="w-3.5 h-3.5" />
                            {friendlyError(carrier.error).substring(0, 40)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            {result.carriers.filter(c => !c.error && c.totalFrete > 0).length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm text-green-700 dark:text-green-300">
                  <strong>Melhor opção:</strong>{" "}
                  {(() => {
                    const best = result.carriers.find(c => !c.error && c.totalFrete > 0);
                    return best ? `${best.transportadora} - R$ ${best.totalFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${best.prazo})` : "";
                  })()}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
