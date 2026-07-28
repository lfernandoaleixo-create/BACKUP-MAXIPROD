/**
 * FreightStep - Step "Cálculo de Frete" do formulário de pedido
 * Mostra as 5 transportadoras cadastradas (Braspress, Alfa, Camilo dos Santos, Rodonaves, Flor de Minas)
 * com simulação de frete via API
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Truck, Loader2, AlertCircle, CheckCircle2, Package } from "lucide-react";
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

interface FreightStepProps {
  cep: string;
  cnpjCpf: string;
  tipoContribuinte: string;
  items: OrderItem[];
  condicaoPagamento: string;
  setCondicaoPagamento: (v: string) => void;
  valorFrete: string;
  setValorFrete: (v: string) => void;
  tipoFrete: string;
  setTipoFrete: (v: string) => void;
  observacoes: string;
  setObservacoes: (v: string) => void;
  onTransportadoraSelect?: (nome: string) => void;
  onProtocoloSet?: (protocolo: string) => void;
  onTrackingUrlSet?: (url: string) => void;
  onBack: () => void;
  onNext: () => void;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCnpj(cnpj: string) {
  if (!cnpj || cnpj.length < 14) return cnpj || "—";
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

// Transportadoras cadastradas com informações
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

export default function FreightStep({
  cep,
  cnpjCpf,
  tipoContribuinte,
  items,
  condicaoPagamento,
  setCondicaoPagamento,
  valorFrete,
  setValorFrete,
  tipoFrete,
  setTipoFrete,
  observacoes,
  setObservacoes,
  onTransportadoraSelect,
  onProtocoloSet,
  onTrackingUrlSet,
  onBack,
  onNext,
}: FreightStepProps) {
  const [showResults, setShowResults] = useState(false);

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

  // Calculate totals from items
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

  const handleSimularFrete = () => {
    if (!cep) {
      toast.error("CEP do cliente não informado. Volte ao passo 1 e preencha o CEP.");
      return;
    }
    if (items.length === 0) {
      toast.error("Nenhum produto no carrinho. Adicione produtos antes de simular.");
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

  const handleUsarCotacao = (valor: number, transportadora?: string, trackingUrl?: string, protocolo?: string) => {
    setValorFrete(String(valor.toFixed(2)));
    if (transportadora && onTransportadoraSelect) {
      onTransportadoraSelect(transportadora);
    }
    // Use real protocolo from API if available, otherwise generate one
    const protocoloFinal = protocolo || `COT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString(36).toUpperCase()}`;
    if (onProtocoloSet) {
      onProtocoloSet(protocoloFinal);
    }
    // Pass tracking URL to parent for saving with the order
    if (trackingUrl && trackingUrl !== "rastreio-interno" && onTrackingUrlSet) {
      onTrackingUrlSet(trackingUrl);
    }
    toast.success(`Frete de ${formatCurrency(valor)} aplicado ao pedido${transportadora ? ` (${transportadora})` : ''}`);
  };

  // Group results by transportadora
  const groupedResults = quoteAllMutation.data
    ? quoteAllMutation.data.reduce((acc: Record<string, typeof quoteAllMutation.data>, quote: any) => {
        if (!acc[quote.transportadora]) acc[quote.transportadora] = [];
        acc[quote.transportadora].push(quote);
        return acc;
      }, {} as Record<string, typeof quoteAllMutation.data>)
    : null;

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-slate-500 uppercase">3. Cálculo de Frete</p>

      {/* Transportadoras cadastradas */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
          <Truck className="w-3 h-3" /> Transportadoras com API Cadastradas
        </p>
        <div className="grid grid-cols-1 gap-2">
          {TRANSPORTADORAS.map((t) => (
            <div key={t.nome} className={`rounded-lg border p-3 ${t.cor}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t.nome}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${t.corBadge}`}>{t.tipo}</span>
                </div>
                <span className="text-[9px] font-medium text-green-600 flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> {t.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.cnpjs.map((c) => (
                  <span key={c.cnpj} className="text-[9px] bg-white/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded border border-slate-200/50 text-slate-600 dark:text-slate-300">
                    {formatCnpj(c.cnpj)} <span className="text-slate-400">({c.label})</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Dados para simulação */}
      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-1.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
          <Package className="w-3 h-3" /> Dados da Simulação
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
          <div>
            <span className="text-slate-400">CEP Destino:</span>
            <p className="font-medium text-slate-700 dark:text-slate-200">{cep || "Não informado"}</p>
          </div>
          <div>
            <span className="text-slate-400">Valor Mercadoria:</span>
            <p className="font-medium text-slate-700 dark:text-slate-200">{formatCurrency(totalProdutos)}</p>
          </div>
          <div>
            <span className="text-slate-400">Peso Total:</span>
            <p className="font-medium text-slate-700 dark:text-slate-200">{totalPeso.toFixed(1)} kg</p>
          </div>
          <div>
            <span className="text-slate-400">Volumes:</span>
            <p className="font-medium text-slate-700 dark:text-slate-200">{totalVolumes}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
          <div>
            <span className="text-slate-400">CEP Origem:</span>
            <p className="font-medium text-slate-700 dark:text-slate-200">32210-130 (Contagem/MG)</p>
          </div>
          <div>
            <span className="text-slate-400">Cubagem:</span>
            <p className="font-medium text-slate-700 dark:text-slate-200">{totalMetroCubico.toFixed(4)} m³</p>
          </div>
          <div>
            <span className="text-slate-400">CNPJ Destinatário:</span>
            <p className="font-medium text-slate-700 dark:text-slate-200">{cnpjCpf ? formatCnpj(cnpjCpf.replace(/\D/g, "")) : "—"}</p>
          </div>
          <div>
            <span className="text-slate-400">Contribuinte:</span>
            <p className="font-medium text-slate-700 dark:text-slate-200">{tipoContribuinte || "—"}</p>
          </div>
        </div>
      </div>

      {/* Botão Simular */}
      <button
        onClick={handleSimularFrete}
        disabled={quoteAllMutation.isPending || !cep || items.length === 0}
        className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
      >
        {quoteAllMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Consultando 5 transportadoras...
          </>
        ) : (
          <>
            <Truck className="w-4 h-4" />
            Simular Frete (Braspress + Alfa + Camilo + Rodonaves + Flor de Minas)
          </>
        )}
      </button>

      {/* Resultados agrupados por transportadora */}
      {showResults && groupedResults && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Cotações Recebidas:</p>
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
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{transportadora}</span>
                </div>
                <div className="divide-y divide-slate-200/50">
                  {quotes.map((quote: any, idx: number) => (
                    <div key={idx} className="px-3 py-2 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-500">
                          CNPJ Remetente: <span className="font-medium text-slate-700 dark:text-slate-200">{formatCnpj(quote.cnpj)}</span>
                        </p>
                      </div>
                      {!quote.error ? (
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-xs font-bold text-green-700">{formatCurrency(quote.totalFrete)}</p>
                            <p className="text-[9px] text-slate-400">{quote.prazo}</p>
                          </div>
                          <button
                            onClick={() => handleUsarCotacao(quote.totalFrete, transportadora, quote.trackingUrl, quote.protocolo)}
                            className="px-2 py-1 bg-teal-600 text-white rounded text-[9px] font-bold hover:bg-teal-700 cursor-pointer"
                          >
                            Usar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[9px] text-red-600">
                          <AlertCircle className="w-3 h-3" />
                          <span className="max-w-[150px] truncate">{quote.error}</span>
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

      {/* Campos de pagamento/frete manual */}
      <div className="border-t border-slate-200 dark:border-slate-600 pt-3 space-y-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase">Condições do Pedido</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 font-medium">Condição de Pagamento</label>
            <input
              type="text"
              value={condicaoPagamento}
              onChange={(e) => setCondicaoPagamento(e.target.value)}
              placeholder="Ex: 30/60/90 dias"
              className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-medium">Valor do Frete (R$)</label>
            <input
              type="number"
              value={valorFrete}
              onChange={(e) => setValorFrete(e.target.value)}
              placeholder="0,00"
              className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-medium">Tipo de Frete</label>
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
        <div>
          <label className="text-[10px] text-slate-500 font-medium">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Observações adicionais do pedido..."
            rows={2}
            className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 resize-none"
          />
        </div>
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
