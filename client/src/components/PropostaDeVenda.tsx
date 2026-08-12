/**
 * PropostaDeVenda - Formulário inline para criar uma Proposta de Venda (simulação para cliente)
 * 
 * Reutiliza os mesmos hooks tRPC do pedido de venda (searchClients, getProductsForSeller)
 * mas NÃO entra no fluxo de aprovação e NÃO reserva caixas no estoque.
 * 
 * Gera um PDF via POST /api/proposta/export-pdf
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { flexMatchMultiple } from "@shared/flexSearch";
import { trpc } from "@/lib/trpc";
import { useCepLookup } from "@/hooks/useCepLookup";
import { parseDimensions } from "@shared/parseDimensions";
import {
  X,
  Search,
  FileText,
  Download,
  Plus,
  Trash2,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  Building2,
  MapPin,
  CreditCard,
  Truck,
} from "lucide-react";
import { UserPlus } from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface PropostaItem {
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

interface PropostaDeVendaProps {
  sellerId: number;
  sellerName: string;
  onClose: () => void;
  editProposalId?: number | null;
}
type Step = "cliente" | "produtos" | "pagamento" | "revisao";
export default function PropostaDeVenda({ sellerId, sellerName, onClose, editProposalId }: PropostaDeVendaProps) {
  const [step, setStep] = useState<Step>("cliente");
  
  // Client fields
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [tipoContribuinte, setTipoContribuinte] = useState("Contribuinte");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("");
  const [telefone1, setTelefone1] = useState("");
  const [emailContato, setEmailContato] = useState("");
  
  // Delivery address
  const [enderecoEntregaMesmo, setEnderecoEntregaMesmo] = useState(true);
  const [entregaCep, setEntregaCep] = useState("");
  const [entregaLogradouro, setEntregaLogradouro] = useState("");
  const [entregaNumero, setEntregaNumero] = useState("");
  const [entregaBairro, setEntregaBairro] = useState("");
  const [entregaCidade, setEntregaCidade] = useState("");
  const [entregaUf, setEntregaUf] = useState("");

  // Products
  const [items, setItems] = useState<PropostaItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productCalc, setProductCalc] = useState<Record<string, { discount: string; finalValue: string; quantity: number; showQty: boolean }>>({});

  // Payment
  const [formaPagamento, setFormaPagamento] = useState("");
  const [meioPagamento, setMeioPagamento] = useState("");
  const [condicaoPagamento, setCondicaoPagamento] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [tipoFrete, setTipoFrete] = useState("CIF");
  const [transportadora, setTransportadora] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [naturezaOperacao, setNaturezaOperacao] = useState("Venda de produção do estabelecimento");

  // Validade da proposta
  const [validadeDias, setValidadeDias] = useState(30);

  // PDF export state
  const [isExporting, setIsExporting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [isConverting, setIsConverting] = useState(false);


  // Edit proposal - load existing data
  const editProposalQuery = trpc.proposal.getById.useQuery(
    { id: editProposalId! },
    { enabled: !!editProposalId }
  );
  useEffect(() => {
    if (editProposalQuery.data && editProposalId) {
      const p = editProposalQuery.data as any;
      setCnpjCpf(p.cnpjCpf || "");
      setRazaoSocial(p.razaoSocial || "");
      setNomeFantasia(p.nomeFantasia || "");
      setInscricaoEstadual(p.inscricaoEstadual || "");
      setCep(p.cep || "");
      setEndereco(p.endereco || "");
      setNumero(p.numero || "");
      setBairro(p.bairro || "");
      setMunicipio(p.municipio || "");
      setUf(p.uf || "");
      setTelefone1(p.telefone || "");
      setEmailContato(p.emailContato || "");
      setFormaPagamento(p.formaPagamento || "");
      setCondicaoPagamento(p.condicaoPagamento || "");
      setObservacoes(p.observacoes || "");
      if (p.items && Array.isArray(p.items)) {
        setItems(p.items.map((i: any) => ({
          codigoItem: i.codigoItem || "",
          descricaoItem: i.descricaoItem || i.descricao || "",
          quantidade: Number(i.quantidade || 1),
          unidadeMedida: i.unidadeMedida || "CX",
          precoUnitario: Number(i.precoUnitario || i.valorUnitario || 0),
          precoMinimo: null,
          precoVendedor: null,
          grupo: "",
          disponivel: "0",
        })));
      }
      setSavedId(editProposalId);
    }
  }, [editProposalQuery.data, editProposalId]);

  // Save proposal mutation
  const saveMutation = trpc.proposal.create.useMutation();
  const createOrderMutation = trpc.salesOrders.createOrder.useMutation();
  const createClientMutation = trpc.sales.createVendorClient.useMutation();

  // Sintegra CNPJ lookup state
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false);
  const [cnpjLookupDone, setCnpjLookupDone] = useState(false);
  const lastLookedUpCnpj = useRef("");
  const [showCadastrarCliente, setShowCadastrarCliente] = useState(false);
  const [cadastrarClienteSuccess, setCadastrarClienteSuccess] = useState(false);

  // CEP lookup
  const { fetchCep: fetchMainCep } = useCepLookup();
  const { fetchCep: fetchEntregaCep } = useCepLookup();

  const handleCepChange = (value: string) => {
    setCep(value);
    fetchMainCep(value, { setEndereco, setBairro, setMunicipio, setUf });
  };
  const handleEntregaCepChange = (value: string) => {
    setEntregaCep(value);
    fetchEntregaCep(value, { setLogradouro: setEntregaLogradouro, setBairro: setEntregaBairro, setCidade: setEntregaCidade, setUf: setEntregaUf });
  };

  // tRPC queries
  const clientSearchQuery = trpc.salesOrders.searchClients.useQuery(
    { query: clientSearch, sellerId },
    { enabled: clientSearch.length >= 1 }
  );
  const productsQuery = trpc.salesOrders.getProductsForSeller.useQuery({ sellerId });

  // Select client
  const selectClient = (client: any) => {
    setCnpjCpf(client.cnpjCpf || "");
    setRazaoSocial(client.razaoSocial || "");
    setNomeFantasia(client.nomeFantasia || "");
    setInscricaoEstadual(client.inscricaoEstadual || "");
    setTipoContribuinte(client.tipoContribuinte || "Contribuinte");
    setCep(client.cep || "");
    setEndereco(client.endereco || "");
    setNumero(client.numero || "");
    setBairro(client.bairro || "");
    setMunicipio(client.municipio || "");
    setUf(client.uf || "");
    setTelefone1(client.telefone1 || "");
    setEmailContato(client.emailContato || "");
    // Auto-fill payment from client
    if (client.formaCobranca && !formaPagamento) {
      const fc = client.formaCobranca.toLowerCase();
      if (fc.includes('boleto') || fc.includes('prazo') || fc.includes('faturad')) {
        setFormaPagamento('A prazo');
      } else {
        setFormaPagamento('À vista');
      }
      if (!meioPagamento) {
        if (fc.includes('boleto')) setMeioPagamento('Boleto');
        else if (fc.includes('pix')) setMeioPagamento('PIX');
        else if (fc.includes('cartão') || fc.includes('cartao')) setMeioPagamento('Cartão');
        else if (fc.includes('dinheiro')) setMeioPagamento('Dinheiro');
        else if (fc.includes('cheque')) setMeioPagamento('Cheque');
      }
    }
    if (client.condicaoPagamento && !condicaoPagamento) {
      setCondicaoPagamento(client.condicaoPagamento);
    }
    setShowClientDropdown(false);
    setClientSearch("");
  };

  // Sintegra auto-lookup when CNPJ has 14 digits
  useEffect(() => {
    const cleanCnpj = cnpjCpf.replace(/\D/g, "");
    if (cleanCnpj.length === 14 && cleanCnpj !== lastLookedUpCnpj.current) {
      lastLookedUpCnpj.current = cleanCnpj;
      setCnpjLookupLoading(true);
      setCnpjLookupDone(false);
      const SINTEGRA_TOKEN = (import.meta as any).env?.VITE_SINTEGRA_API_TOKEN || "";
      const SINTEGRA_BASE = "https://www.sintegraws.com.br/api/v1/execute-api.php";
      const safeFetch = (url: string) => fetch(url).then(r => {
        if (!r.ok) return null;
        const ct = r.headers.get("content-type") || "";
        if (!ct.includes("json")) return null;
        return r.json();
      }).catch(() => null);
      Promise.allSettled([
        safeFetch(`${SINTEGRA_BASE}?token=${SINTEGRA_TOKEN}&cnpj=${cleanCnpj}&plugin=RF`),
        safeFetch(`${SINTEGRA_BASE}?token=${SINTEGRA_TOKEN}&cnpj=${cleanCnpj}&plugin=ST`),
      ]).then(([rfRes, stRes]) => {
        const rfData = rfRes.status === "fulfilled" ? rfRes.value : null;
        const stData = stRes.status === "fulfilled" ? stRes.value : null;
        if (rfData && rfData.code === "0") {
          if (rfData.nome && !razaoSocial) setRazaoSocial(rfData.nome);
          if (rfData.fantasia && rfData.fantasia !== "********" && !nomeFantasia) setNomeFantasia(rfData.fantasia);
          if (rfData.cep && !cep) {
            const cleanCep = rfData.cep.replace(/[^\d]/g, "");
            setCep(cleanCep);
            handleCepChange(cleanCep);
          }
          if (rfData.logradouro && !endereco) setEndereco(rfData.logradouro);
          if (rfData.numero && !numero) setNumero(rfData.numero);
          if (rfData.bairro && !bairro) setBairro(rfData.bairro);
          if (rfData.municipio && !municipio) setMunicipio(rfData.municipio);
          if (rfData.uf && !uf) setUf(rfData.uf);
          if (rfData.telefone && !telefone1) setTelefone1(rfData.telefone);
          if (rfData.email && !emailContato) setEmailContato(rfData.email);
        }
        if (stData && stData.code === "0") {
          if (stData.inscricao_estadual) {
            setInscricaoEstadual(stData.inscricao_estadual);
          } else {
            setInscricaoEstadual("ISENTO");
          }
          if (stData.contribuinte_icms === true) {
            setTipoContribuinte("Contribuinte");
          } else if (stData.inscricao_estadual?.toUpperCase() === "ISENTO") {
            setTipoContribuinte("Isento");
          } else {
            setTipoContribuinte("Não contribuinte");
          }
        } else {
          if (!inscricaoEstadual.trim()) setInscricaoEstadual("ISENTO");
          setTipoContribuinte("Não contribuinte");
        }
        setCnpjLookupDone(true);
        setShowCadastrarCliente(true);
        setTimeout(() => setCnpjLookupDone(false), 3000);
      }).catch(() => {}).finally(() => setCnpjLookupLoading(false));
    }
  }, [cnpjCpf]);

  // Handle cadastrar cliente from proposta
  const handleCadastrarCliente = async () => {
    if (!cnpjCpf.trim() || !razaoSocial.trim()) return;
    try {
      await createClientMutation.mutateAsync({
        sellerId,
        sellerName,
        cnpjCpf: cnpjCpf.trim(),
        razaoSocial: razaoSocial.trim(),
        nomeFantasia: nomeFantasia || undefined,
        inscricaoEstadual: inscricaoEstadual || undefined,
        tipoContribuinte: tipoContribuinte || undefined,
        cep: cep || undefined,
        logradouro: endereco || undefined,
        numero: numero || undefined,
        bairro: bairro || undefined,
        cidade: municipio || undefined,
        uf: uf || undefined,
        telefone1: telefone1 || undefined,
        email: emailContato || undefined,
      });
      setCadastrarClienteSuccess(true);
      setTimeout(() => setCadastrarClienteSuccess(false), 5000);
    } catch (err) {
      console.error("Erro ao cadastrar cliente:", err);
    }
  };

  // Product filtering
  const availableProducts = useMemo(() => {
    if (!productsQuery.data) return [];
    const addedCodes = new Set(items.map(i => i.codigoItem));
    let filtered = (productsQuery.data as any[]).filter((p: any) => !addedCodes.has(p.codigoItem));
    if (productSearch.trim()) {
      const s = productSearch.trim().toLowerCase();
      filtered = filtered.filter((p: any) => 
        flexMatchMultiple([p.codigoItem, p.descricaoItem, p.codigoBarras || "", p.grupo || ""], s)
      );
    }
    return filtered;
  }, [productsQuery.data, items, productSearch]);

  // Add product to cart
  const addProduct = (product: any, customPrice?: number, customQty?: number) => {
    const precoVendedor = product.precoVendedor ? Number(product.precoVendedor) : null;
    const precoUnit = customPrice || precoVendedor || (product.precoMinimo ? Number(product.precoMinimo) : 0);
    const qty = customQty || 1;
    const fatorProd = Number(product.unidadeDeVendaFator) || 1;
    const pesoBrutoCaixa = product.pesoBruto && Number(product.pesoBruto) > 0 ? Number(product.pesoBruto) * fatorProd : undefined;
    const dimsMatch = product.descricaoComplementar ? product.descricaoComplementar.match(/([\d,.]+)[xX×]([\d,.]+)[xX×]([\d,.]+)/) : null;
    const claMatch = product.descricaoComplementar ? product.descricaoComplementar.match(/C\s*=\s*([\d,.]+).*?L\s*=\s*([\d,.]+).*?A\s*=\s*([\d,.]+)/i) : null;
    const dimsStr = dimsMatch ? `${dimsMatch[1]}x${dimsMatch[2]}x${dimsMatch[3]}` : claMatch ? `${claMatch[1].replace(',','.')}x${claMatch[2].replace(',','.')}x${claMatch[3].replace(',','.')}` : undefined;
    setItems(prev => [...prev, {
      codigoItem: product.codigoItem,
      descricaoItem: product.descricaoItem,
      quantidade: qty,
      unidadeMedida: product.unidadeMedida || "CX",
      precoUnitario: precoUnit,
      precoMinimo: product.precoMinimo ? Number(product.precoMinimo) : null,
      precoVendedor: precoVendedor,
      grupo: product.grupo || "",
      disponivel: product.disponivel || "0",
      pesoBrutoCaixa,
      dimsStr,
    }]);
    setProductSearch("");
    setProductCalc(prev => { const next = { ...prev }; delete next[product.codigoItem]; return next; });
  };

  const removeProduct = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalProdutos = items.reduce((sum, item) => sum + item.quantidade * item.precoUnitario, 0);
  const totalFrete = Number(valorFrete) || 0;
  const totalPedido = totalProdutos + totalFrete;
  const totalPeso = items.reduce((sum, item) => sum + (item.pesoBrutoCaixa || 0) * item.quantidade, 0);
  const totalVolumes = items.reduce((sum, item) => sum + item.quantidade, 0);
  const totalCubagem = useMemo(() => {
    return items.reduce((sum, item) => {
      if (!item.dimsStr) return sum;
      const dims = parseDimensions(item.dimsStr);
      if (!dims) return sum;
      const volM3 = (dims.comprimento * dims.largura * dims.altura) / 1_000_000;
      return sum + volM3 * item.quantidade;
    }, 0);
  }, [items]);

  // Freight simulation
  const [showFreightModal, setShowFreightModal] = useState(false);
  const [freightResult, setFreightResult] = useState<any>(null);
  const [freightManualVolumes, setFreightManualVolumes] = useState("");
  const [freightManualValorNf, setFreightManualValorNf] = useState("");
  const quoteFreightMutation = trpc.salesOrders.quoteAllCarriers.useMutation();

  // Validade helper
  const getDataValidade = () => {
    const d = new Date();
    d.setDate(d.getDate() + validadeDias);
    return d.toLocaleDateString("pt-BR");
  };

  // Save proposal to DB
  const handleSaveProposal = async () => {
    setIsSaving(true);
    try {
      const result = await saveMutation.mutateAsync({
        sellerId,
        sellerName,
        cnpjCpf,
        razaoSocial,
        nomeFantasia,
        inscricaoEstadual,
        cep,
        endereco,
        numero,
        bairro,
        municipio,
        uf,
        telefone: telefone1,
        emailContato,
        enderecoEntregaDiferente: !enderecoEntregaMesmo,
        entregaCep: !enderecoEntregaMesmo ? entregaCep : undefined,
        entregaLogradouro: !enderecoEntregaMesmo ? entregaLogradouro : undefined,
        entregaNumero: !enderecoEntregaMesmo ? entregaNumero : undefined,
        entregaBairro: !enderecoEntregaMesmo ? entregaBairro : undefined,
        entregaCidade: !enderecoEntregaMesmo ? entregaCidade : undefined,
        entregaUf: !enderecoEntregaMesmo ? entregaUf : undefined,
        formaPagamento,
        meioPagamento,
        condicaoPagamento,
        valorFrete: valorFrete || "0",
        tipoFrete,
        transportadora,
        observacoes,
        validadeDias,
        dataValidade: getDataValidade(),
        items: items.map(i => ({
          codigoItem: i.codigoItem,
          descricaoItem: i.descricaoItem,
          quantidade: i.quantidade,
          unidadeMedida: i.unidadeMedida,
          precoUnitario: i.precoUnitario,
          precoMinimo: i.precoMinimo,
          grupo: i.grupo,
        })),
        totalProdutos,
        totalPedido,
        pdfUrl: pdfUrl || undefined,
      });
      setSavedId(result.id);
    } catch (err: any) {
      setExportError(err.message || "Erro ao salvar proposta");
    } finally {
      setIsSaving(false);
    }
  };

  // Convert proposal to order
  const handleConvertToOrder = async () => {
    setIsConverting(true);
    try {
      const orderResult = await createOrderMutation.mutateAsync({
        sellerId,
        cnpjCpf,
        razaoSocial,
        nomeFantasia,
        inscricaoEstadual,
        tipoContribuinte,
        cep,
        endereco,
        numero,
        bairro,
        municipio,
        uf,
        telefone1,
        emailContato,
        enderecoEntregaMesmo,
        entregaCep: !enderecoEntregaMesmo ? entregaCep : undefined,
        entregaLogradouro: !enderecoEntregaMesmo ? entregaLogradouro : undefined,
        entregaNumero: !enderecoEntregaMesmo ? entregaNumero : undefined,
        entregaBairro: !enderecoEntregaMesmo ? entregaBairro : undefined,
        entregaCidade: !enderecoEntregaMesmo ? entregaCidade : undefined,
        entregaUf: !enderecoEntregaMesmo ? entregaUf : undefined,
        formaPagamento,
        meioPagamento,
        condicaoPagamento,
        valorFrete: Number(valorFrete) || 0,
        tipoFrete,
        transportadora,
        observacoes,
        naturezaOperacao,
        items: items.map(i => ({
          codigoItem: i.codigoItem,
          descricaoItem: i.descricaoItem,
          quantidade: i.quantidade,
          unidadeMedida: i.unidadeMedida,
          precoUnitario: i.precoUnitario,
        })),
      });
      // If we saved the proposal, mark it as converted
      if (savedId && orderResult.orderId) {
        // We'd need a markConverted mutation but for now just close
      }
      alert(`Pedido de Venda criado com sucesso! (ID: ${orderResult.orderId})`);
      onClose();
    } catch (err: any) {
      setExportError(err.message || "Erro ao converter em pedido");
    } finally {
      setIsConverting(false);
    }
  };

  // Steps array
  const steps: Step[] = ["cliente", "produtos", "pagamento", "revisao"];
  const stepLabels: Record<Step, string> = {
    cliente: "1. Cliente",
    produtos: "2. Produtos",
    pagamento: "3. Pagamento",
    revisao: "4. Revisão",
  };

  // Export PDF
  const handleExportPdf = async () => {
    setIsExporting(true);
    setExportError(null);
    setPdfUrl(null);
    try {
      const enderecoEntrega = !enderecoEntregaMesmo
        ? `${entregaLogradouro}, ${entregaNumero} - ${entregaBairro} - ${entregaCidade}/${entregaUf} CEP ${entregaCep}`
        : undefined;

      const payload = {
        dataEmissao: new Date().toLocaleDateString("pt-BR"),
        cnpjCpf,
        razaoSocial,
        inscricaoEstadual,
        endereco,
        numero,
        bairro,
        municipio,
        uf,
        cep,
        naturezaOperacao,
        representante: sellerName,
        items: items.map((item, idx) => ({
          seq: idx + 1,
          codigoItem: item.codigoItem,
          descricaoItem: item.descricaoItem,
          quantidade: item.quantidade,
          unidadeMedida: item.unidadeMedida,
          precoUnitario: item.precoUnitario,
          desconto: 0,
          valorTotal: item.quantidade * item.precoUnitario,
        })),
        valorTotalProdutos: totalProdutos,
        valorFrete: totalFrete,
        valorSeguro: 0,
        outrasDespesas: 0,
        valorDesconto: 0,
        valorTotal: totalPedido,
        enderecoEntrega,
        formaPagamento,
        condicaoPagamento: condicaoPagamento || meioPagamento || "—",
        condicaoFrete: tipoFrete,
        transportadora: transportadora || undefined,
        quantidadeVolumes: items.reduce((sum, i) => sum + i.quantidade, 0),
        especieVolumes: "CX",
        pesoBruto: totalPeso,
        pesoLiquido: totalPeso * 0.95,
        tipoProduto: "industrializado" as const,
        tipoContribuinte: tipoContribuinte as any,
        assinatura: sellerName,
        emailContato: emailContato || undefined,
        validadeDias,
        dataValidade: getDataValidade(),
      };

      const response = await fetch("/api/proposta/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setPdfUrl(result.url);
    } catch (err: any) {
      setExportError(err.message || "Erro ao gerar PDF");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-blue-300 dark:border-blue-700 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200">
              Nova Proposta de Venda
            </h4>
            <span className="text-[10px] bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
              Simulação — não reserva estoque
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        {/* Progress */}
        <div className="flex gap-1 mt-2">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full ${
                steps.indexOf(step) >= i ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-600"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-4">
        {/* ============ STEP 1: CLIENTE ============ */}
        {step === "cliente" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">1. Dados do Cliente</p>
            {/* Client search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
              <input
                type="text"
                placeholder="Digite o nome, fantasia ou CNPJ do cliente..."
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                onFocus={() => { if (clientSearch.length >= 1) setShowClientDropdown(true); }}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                className="w-full pl-9 pr-3 py-3 text-sm border-2 border-blue-200 dark:border-blue-700 rounded-xl bg-blue-50/50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
              />
              {clientSearch.length >= 1 && clientSearchQuery.isLoading && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg p-3">
                  <p className="text-xs text-slate-400 text-center">Buscando clientes...</p>
                </div>
              )}
              {showClientDropdown && clientSearchQuery.data && (clientSearchQuery.data as any[]).length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-blue-200 dark:border-slate-600 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                  <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800">
                    <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase">Clientes encontrados ({(clientSearchQuery.data as any[]).length})</p>
                  </div>
                  {(clientSearchQuery.data as any[]).map((c: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => selectClient(c)}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
                    >
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{c.razaoSocial}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {c.cnpjCpf && <span className="text-[10px] text-slate-500 font-mono">{c.cnpjCpf}</span>}
                        {c.nomeFantasia && <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">{c.nomeFantasia}</span>}
                        {c.municipio && <span className="text-[10px] text-slate-400">{c.municipio}/{c.uf}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected client info */}
            {cnpjCpf && (
              <div className="bg-blue-50/50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2 border border-blue-100 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Cliente selecionado</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">Razão Social</label>
                    <input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">CNPJ/CPF</label>
                    <input value={cnpjCpf} onChange={(e) => setCnpjCpf(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Inscrição Estadual</label>
                    <input value={inscricaoEstadual} onChange={(e) => setInscricaoEstadual(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">CEP</label>
                    <input value={cep} onChange={(e) => handleCepChange(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500">Endereço</label>
                    <input value={endereco} onChange={(e) => setEndereco(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Número</label>
                    <input value={numero} onChange={(e) => setNumero(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Bairro</label>
                    <input value={bairro} onChange={(e) => setBairro(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Município</label>
                    <input value={municipio} onChange={(e) => setMunicipio(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">UF</label>
                    <input value={uf} onChange={(e) => setUf(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" maxLength={2} />
                  </div>
                </div>
                {/* Delivery address toggle */}
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enderecoEntregaMesmo}
                      onChange={(e) => setEnderecoEntregaMesmo(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-[11px] text-slate-600 dark:text-slate-300">Endereço de entrega é o mesmo</span>
                  </label>
                  {!enderecoEntregaMesmo && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="text-[10px] text-slate-500">CEP Entrega</label>
                        <input value={entregaCep} onChange={(e) => handleEntregaCepChange(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">Logradouro</label>
                        <input value={entregaLogradouro} onChange={(e) => setEntregaLogradouro(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">Número</label>
                        <input value={entregaNumero} onChange={(e) => setEntregaNumero(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">Bairro</label>
                        <input value={entregaBairro} onChange={(e) => setEntregaBairro(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">Cidade</label>
                        <input value={entregaCidade} onChange={(e) => setEntregaCidade(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">UF</label>
                        <input value={entregaUf} onChange={(e) => setEntregaUf(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" maxLength={2} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Manual entry if no client selected */}
            {!cnpjCpf && (
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
                <p className="text-[10px] text-slate-500 mb-2">Ou preencha manualmente:</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500">Razão Social *</label>
                    <input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Nome do cliente" className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div className="relative">
                    <label className="text-[10px] text-slate-500">CNPJ/CPF</label>
                    <input value={cnpjCpf} onChange={(e) => setCnpjCpf(e.target.value)} placeholder="00.000.000/0000-00" className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                    {cnpjLookupLoading && <span className="absolute right-2 top-5 text-[9px] text-teal-500 animate-pulse">Consultando Sintegra...</span>}
                    {cnpjLookupDone && <span className="absolute right-2 top-5 text-[9px] text-green-600">u2713 Dados preenchidos</span>}
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">CEP</label>
                    <input value={cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Município</label>
                    <input value={municipio} onChange={(e) => setMunicipio(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">UF</label>
                    <input value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>
              </div>
            )}

            {/* Cadastrar este Cliente */}
            {showCadastrarCliente && cnpjCpf && razaoSocial && (
              <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded-lg p-3">
                <p className="text-[10px] text-teal-700 dark:text-teal-300 mb-2">
                  Dados do cliente preenchidos via Sintegra. Deseja cadastrar este cliente no sistema?
                </p>
                {cadastrarClienteSuccess ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-300 font-medium">
                    <Check className="w-3.5 h-3.5" />
                    Cliente cadastrado com sucesso!
                  </div>
                ) : (
                  <button
                    onClick={handleCadastrarCliente}
                    disabled={createClientMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    {createClientMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                    Cadastrar este Cliente
                  </button>
                )}
              </div>
            )}
            {/* Next button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep("produtos")}
                disabled={!razaoSocial.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Próximo: Produtos →
              </button>
            </div>
          </div>
        )}

        {/* ============ STEP 2: PRODUTOS ============ */}
        {step === "produtos" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">2. Produtos</p>
              <span className="text-[10px] text-slate-400">{productsQuery.data ? (productsQuery.data as any[]).length : 0} produtos disponíveis</span>
            </div>

            {/* Product search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar produto por código ou descrição..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {/* Cart (items added) */}
            {items.length > 0 && (
              <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 pb-2 border-b-2 border-blue-300 dark:border-blue-700 shadow-md rounded-lg mb-3">
                <div className="flex items-center justify-between px-3 py-2 bg-blue-600 rounded-t-lg">
                  <p className="text-[11px] font-bold text-white flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4" /> Proposta ({items.length} {items.length === 1 ? 'item' : 'itens'}) — {items.reduce((sum, i) => sum + i.quantidade, 0)} caixas
                  </p>
                  <p className="text-sm font-bold text-white">
                    {formatCurrency(totalProdutos)}
                  </p>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-1.5 hover:bg-blue-50/50 dark:hover:bg-slate-700/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
                          <span className="font-mono text-blue-600">{item.codigoItem}</span> — {item.descricaoItem}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {item.quantidade} {item.unidadeMedida} × {formatCurrency(item.precoUnitario)} = {formatCurrency(item.quantidade * item.precoUnitario)}
                        </p>
                      </div>
                      <button onClick={() => removeProduct(idx)} className="p-1 hover:bg-red-100 rounded">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Product list */}
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {availableProducts.slice(0, 50).map((product: any) => {
                const calc = productCalc[product.codigoItem] || { discount: '', finalValue: '', quantity: 1, showQty: false };
                const precoVendedor = product.precoVendedor ? Number(product.precoVendedor) : null;
                const precoBase = precoVendedor || (product.precoMinimo ? Number(product.precoMinimo) : 0);

                return (
                  <div key={product.codigoItem} className="border border-slate-100 dark:border-slate-700 rounded-lg p-2 hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                          <span className="font-mono text-blue-600 mr-1">{product.codigoItem}</span>
                          {product.descricaoItem}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {precoBase > 0 && (
                            <span className="text-[10px] text-slate-500">
                              Preço: {formatCurrency(precoBase)}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            Disp: {product.disponivel || "0"} {product.unidadeMedida || "CX"}
                          </span>
                          {product.grupo && <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1 rounded">{product.grupo}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (calc.showQty) {
                            // Add with custom values
                            const price = calc.finalValue ? Number(calc.finalValue.replace(',', '.')) : (calc.discount ? precoBase * (1 - Number(calc.discount.replace(',', '.')) / 100) : precoBase);
                            addProduct(product, price > 0 ? price : undefined, calc.quantity);
                          } else {
                            setProductCalc(prev => ({ ...prev, [product.codigoItem]: { ...calc, showQty: true } }));
                          }
                        }}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded hover:bg-blue-200 transition-colors"
                      >
                        {calc.showQty ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {/* Quantity/price calculator */}
                    {calc.showQty && (
                      <div className="mt-2 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded p-1.5">
                        <div className="flex items-center gap-1">
                          <label className="text-[9px] text-slate-500">Qtd:</label>
                          <input
                            type="number"
                            min={1}
                            value={calc.quantity}
                            onChange={(e) => setProductCalc(prev => ({ ...prev, [product.codigoItem]: { ...calc, quantity: Math.max(1, Number(e.target.value) || 1) } }))}
                            className="w-14 text-xs px-1.5 py-1 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-center"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-[9px] text-slate-500">Desc%:</label>
                          <input
                            type="text"
                            value={calc.discount}
                            onChange={(e) => {
                              const d = e.target.value;
                              const finalVal = d && precoBase > 0 ? (precoBase * (1 - Number(d.replace(',', '.')) / 100)).toFixed(2) : '';
                              setProductCalc(prev => ({ ...prev, [product.codigoItem]: { ...calc, discount: d, finalValue: finalVal } }));
                            }}
                            placeholder="0"
                            className="w-12 text-xs px-1.5 py-1 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-center"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-[9px] text-slate-500">Valor:</label>
                          <input
                            type="text"
                            value={calc.finalValue}
                            onChange={(e) => {
                              const v = e.target.value;
                              const numVal = Number(v.replace(',', '.'));
                              const disc = numVal > 0 && precoBase > 0 ? (((precoBase - numVal) / precoBase) * 100).toFixed(1) : '';
                              setProductCalc(prev => ({ ...prev, [product.codigoItem]: { ...calc, finalValue: v, discount: disc } }));
                            }}
                            placeholder={precoBase > 0 ? precoBase.toFixed(2) : "0.00"}
                            className="w-16 text-xs px-1.5 py-1 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-center"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {availableProducts.length === 0 && productSearch && (
                <p className="text-xs text-slate-400 text-center py-4">Nenhum produto encontrado para "{productSearch}"</p>
              )}
              {availableProducts.length > 50 && (
                <p className="text-[10px] text-slate-400 text-center py-2">Mostrando 50 de {availableProducts.length} produtos. Refine a busca.</p>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep("cliente")} className="px-3 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium">
                ← Voltar
              </button>
              <button
                onClick={() => setStep("pagamento")}
                disabled={items.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Próximo: Pagamento →
              </button>
            </div>
          </div>
        )}

        {/* ============ STEP 3: PAGAMENTO ============ */}
        {step === "pagamento" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">3. Condições de Pagamento e Frete</p>

            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-3 border border-slate-200 dark:border-slate-600">
              {/* Forma de pagamento */}
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[10px] font-bold text-slate-600 uppercase">Pagamento</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">Forma de Pagamento *</label>
                  <select
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">Selecione...</option>
                    <option value="À vista">À vista</option>
                    <option value="A prazo">A prazo</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Meio de Pagamento *</label>
                  <select
                    value={meioPagamento}
                    onChange={(e) => setMeioPagamento(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">Selecione...</option>
                    <option value="Boleto">Boleto</option>
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão">Cartão</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Depósito">Depósito</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-500">Condição de Pagamento</label>
                  <input
                    value={condicaoPagamento}
                    onChange={(e) => setCondicaoPagamento(e.target.value)}
                    placeholder="Ex: 30/60/90 dias, à vista, etc."
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Frete */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[10px] font-bold text-slate-600 uppercase">Frete</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">Tipo Frete</label>
                  <select
                    value={tipoFrete}
                    onChange={(e) => setTipoFrete(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="CIF">CIF (Remetente)</option>
                    <option value="FOB">FOB (Destinatário)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Valor Frete (R$)</label>
                  <input
                    type="text"
                    value={valorFrete}
                    onChange={(e) => setValorFrete(e.target.value)}
                    placeholder="0,00"
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Transportadora</label>
                  <input
                    value={transportadora}
                    onChange={(e) => setTransportadora(e.target.value)}
                    placeholder="Nome da transportadora"
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Observações */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                <label className="text-[10px] text-slate-500">Observações</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                  placeholder="Observações adicionais para a proposta..."
                  className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 resize-none"
                />
              </div>

              {/* Validade da Proposta */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Validade da Proposta</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">Dias de Validade</label>
                    <select
                      value={validadeDias}
                      onChange={(e) => setValidadeDias(Number(e.target.value))}
                      className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      <option value={7}>7 dias</option>
                      <option value={15}>15 dias</option>
                      <option value={30}>30 dias</option>
                      <option value={45}>45 dias</option>
                      <option value={60}>60 dias</option>
                      <option value={90}>90 dias</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Válida até</label>
                    <div className="text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                      {getDataValidade()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep("produtos")} className="px-3 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium">
                ← Voltar
              </button>
              <button
                onClick={() => setStep("revisao")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Próximo: Revisão →
              </button>
            </div>
          </div>
        )}

        {/* ============ STEP 4: REVISÃO ============ */}
        {step === "revisao" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">4. Revisão da Proposta</p>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-2 mb-2">
              <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                Esta é uma <strong>Proposta de Venda</strong> — documento de simulação para o cliente. Não reserva estoque e não entra no fluxo de aprovação.
              </p>
            </div>

            {/* Summary */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{razaoSocial}</span>
              </div>
              {cnpjCpf && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">CNPJ/CPF:</span>
                  <span className="text-slate-700 dark:text-slate-200">{cnpjCpf}</span>
                </div>
              )}
              {municipio && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Local:</span>
                  <span className="text-slate-700 dark:text-slate-200">{municipio}/{uf}</span>
                </div>
              )}
              {formaPagamento && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Pagamento:</span>
                  <span className="text-slate-700 dark:text-slate-200">{formaPagamento} {meioPagamento ? `(${meioPagamento})` : ''}</span>
                </div>
              )}
              {condicaoPagamento && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Condição:</span>
                  <span className="text-slate-700 dark:text-slate-200">{condicaoPagamento}</span>
                </div>
              )}
              {transportadora && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Transportadora:</span>
                  <span className="text-slate-700 dark:text-slate-200">{transportadora}</span>
                </div>
              )}
              {totalFrete > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Frete ({tipoFrete}):</span>
                  <span className="text-slate-700 dark:text-slate-200">{formatCurrency(totalFrete)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-600">
                <span className="text-slate-500">Validade da Proposta:</span>
                <span className="font-medium text-blue-700 dark:text-blue-300">{getDataValidade()} ({validadeDias} dias)</span>
              </div>
            </div>

            {/* Items table */}
            <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
              <div className="bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 border-b border-blue-100 dark:border-blue-800">
                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase">
                  Itens da Proposta ({items.length})
                </p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map((item, idx) => (
                  <div key={idx} className="px-3 py-1.5 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-700 dark:text-slate-200">
                        <span className="font-mono text-blue-600 mr-1">{item.codigoItem}</span>
                        {item.descricaoItem}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                        {item.quantidade} {item.unidadeMedida} × {formatCurrency(item.precoUnitario)}
                      </p>
                      <p className="text-[10px] text-blue-600 font-bold">
                        {formatCurrency(item.quantidade * item.precoUnitario)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">Total Produtos:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(totalProdutos)}</span>
              </div>
              {totalFrete > 0 && (
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Frete:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{formatCurrency(totalFrete)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-1 border-t border-blue-200 dark:border-blue-700">
                <span className="font-bold text-blue-800 dark:text-blue-200">TOTAL DA PROPOSTA:</span>
                <span className="font-bold text-blue-800 dark:text-blue-200">{formatCurrency(totalPedido)}</span>
              </div>
              <div className="flex justify-between text-[10px] mt-1 text-slate-500">
                <span>Peso bruto estimado:</span>
                <span>{totalPeso.toFixed(2)} kg</span>
              </div>
            </div>

            {/* Simular Frete Avulso */}
            <button
              onClick={() => {
                setShowFreightModal(true);
                setFreightResult(null);
                setFreightManualVolumes(String(totalVolumes || 1));
                setFreightManualValorNf(String(totalProdutos.toFixed(2)));
              }}
              disabled={items.length === 0 || !cep}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-slate-300 disabled:to-slate-400 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
            >
              <Truck className="w-3.5 h-3.5" />
              Simular Frete Avulso
            </button>

            {/* Export PDF */}
            {pdfUrl && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
                <p className="text-xs text-green-700 dark:text-green-300 font-medium mb-2">PDF gerado com sucesso!</p>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar PDF da Proposta
                </a>
              </div>
            )}
            {exportError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-2">
                <p className="text-xs text-red-700 dark:text-red-300">{exportError}</p>
              </div>
            )}

            {/* Freight Simulation Results */}
            {showFreightModal && (
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">Simulação de Frete</span>
                  <button onClick={() => setShowFreightModal(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                </div>
                <div className="text-[10px] text-slate-500 space-x-3">
                  <span>CEP: {cep}</span>
                  <span>Peso: {totalPeso.toFixed(1)}kg</span>
                  <span>Cubagem: {totalCubagem.toFixed(4)}m³</span>
                </div>
                {/* Manual input fields */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-slate-600 dark:text-slate-300">Volumes *</label>
                    <input
                      type="number"
                      min="1"
                      value={freightManualVolumes}
                      onChange={(e) => setFreightManualVolumes(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      placeholder="Ex: 10"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-slate-600 dark:text-slate-300">Valor da NF (R$) *</label>
                    <input
                      type="text"
                      value={freightManualValorNf}
                      onChange={(e) => setFreightManualValorNf(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      placeholder="Ex: 5000.00"
                    />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setFreightResult(null);
                    const cepClean = cep.replace(/\D/g, "");
                    if (cepClean.length !== 8) { setFreightResult({ error: "CEP inválido" }); return; }
                    const valorNf = parseFloat(freightManualValorNf.replace(/[^\d.,]/g, "").replace(",", "."));
                    const volumes = parseInt(freightManualVolumes) || 1;
                    if (!valorNf || valorNf <= 0) { setFreightResult({ error: "Informe o valor da NF" }); return; }
                    try {
                      const result = await quoteFreightMutation.mutateAsync({
                        cepDestino: cepClean,
                        cnpjDestinatario: cnpjCpf.replace(/\D/g, "") || undefined,
                        peso: totalPeso > 0 ? totalPeso : volumes * 10,
                        metroCubico: totalCubagem > 0 ? totalCubagem : (totalPeso > 0 ? totalPeso * 0.004 : volumes * 0.05),
                        valorMercadoria: valorNf,
                        volumes,
                      });
                      setFreightResult(result);
                    } catch (err: any) {
                      setFreightResult({ error: err?.message || "Erro ao simular frete" });
                    }
                  }}
                  disabled={quoteFreightMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  {quoteFreightMutation.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cotando...</>
                  ) : (
                    <><Truck className="w-3.5 h-3.5" /> Simular Frete</>
                  )}
                </button>
                {freightResult?.error && (
                  <p className="text-xs text-red-600">{freightResult.error}</p>
                )}
                {freightResult && !freightResult.error && Array.isArray(freightResult) && (
                  <div className="space-y-1">
                    {(freightResult as any[]).sort((a: any, b: any) => {
                      if (a.error && !b.error) return 1;
                      if (!a.error && b.error) return -1;
                      return (a.totalFrete || 999999) - (b.totalFrete || 999999);
                    }).map((carrier: any, idx: number) => (
                      <div key={idx} className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                        carrier.error ? 'bg-red-50 dark:bg-red-900/20' : idx === 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200' : 'bg-white dark:bg-slate-700'
                      }`}>
                        <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{carrier.transportadora}</span>
                        {carrier.error ? (
                          <span className="text-red-500 text-[10px] truncate ml-2">{carrier.error.substring(0, 40)}</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500">{carrier.prazo} dias</span>
                            <span className={`font-bold ${idx === 0 ? 'text-green-700' : 'text-slate-700 dark:text-slate-200'}`}>
                              {formatCurrency(carrier.totalFrete)}
                              {totalProdutos > 0 && <span className="ml-1 font-normal text-[10px] text-slate-500">({((carrier.totalFrete / totalProdutos) * 100).toFixed(1)}%)</span>}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex justify-between">
                <button onClick={() => setStep("pagamento")} className="px-3 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium">
                  ← Voltar
                </button>
                <div className="flex gap-2">
                  {/* Salvar Proposta */}
                  <button
                    onClick={handleSaveProposal}
                    disabled={isSaving || items.length === 0 || !!savedId}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : savedId ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <ShoppingCart className="w-3.5 h-3.5" />
                    )}
                    {savedId ? "Salva" : "Salvar"}
                  </button>
                  {/* Exportar PDF */}
                  <button
                    onClick={handleExportPdf}
                    disabled={isExporting || items.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-300 disabled:to-slate-400 text-white text-xs font-bold rounded-lg transition-all shadow-md"
                  >
                    {isExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    {isExporting ? "Gerando..." : "Exportar PDF"}
                  </button>
                </div>
              </div>
              {/* Converter em Pedido */}
              <button
                onClick={handleConvertToOrder}
                disabled={isConverting || items.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 disabled:from-slate-300 disabled:to-slate-400 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Convertendo...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Converter em Pedido de Venda
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
