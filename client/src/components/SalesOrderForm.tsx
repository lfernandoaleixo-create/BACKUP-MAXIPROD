/**
 * Formulário de Pedido de Venda para o App do Vendedor
 * - Busca de cliente existente (autocomplete) ou cadastro novo
 * - Seleção de produtos com quantidade e preço
 * - Condição de pagamento e frete
 * - Validação de preço mínimo antes de enviar
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, Plus, Trash2, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, ArrowLeft, ShoppingCart, User, MapPin, Package as PackageIcon, CreditCard, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface OrderItem {
  codigoItem: string;
  descricaoItem: string;
  quantidade: number;
  unidadeMedida: string;
  precoUnitario: number;
  precoMinimo: number | null;
}

interface SalesOrderFormProps {
  sellerId: number;
  onBack: () => void;
  onSuccess: () => void;
}

export default function SalesOrderForm({ sellerId, onBack, onSuccess }: SalesOrderFormProps) {
  const [step, setStep] = useState<"cliente" | "produtos" | "pagamento" | "revisao">("cliente");

  // Client data
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [tipoContribuinte, setTipoContribuinte] = useState("Contribuinte");
  const [regimeTributario, setRegimeTributario] = useState("Normal");
  const [emailNfe, setEmailNfe] = useState("");
  const [cnaeFiscal, setCnaeFiscal] = useState("");
  // Address
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("");
  const [telefone1, setTelefone1] = useState("");
  const [telefone2, setTelefone2] = useState("");
  const [emailContato, setEmailContato] = useState("");
  const [segmento, setSegmento] = useState("");

  // Products
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Payment
  const [condicaoPagamento, setCondicaoPagamento] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [tipoFrete, setTipoFrete] = useState("CIF");
  const [observacoes, setObservacoes] = useState("");

  // Client search
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  const clientSearchQuery = trpc.salesOrders.searchClients.useQuery(
    { query: clientSearch },
    { enabled: clientSearch.length >= 2 }
  );

  const productsQuery = trpc.salesOrders.getProductsForSeller.useQuery({ sellerId });
  const createOrderMutation = trpc.salesOrders.createOrder.useMutation();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectClient = (client: any) => {
    setCnpjCpf(client.cnpjCpf || "");
    setRazaoSocial(client.razaoSocial || "");
    setNomeFantasia(client.nomeFantasia || "");
    setInscricaoEstadual(client.inscricaoEstadual || "");
    setTipoContribuinte(client.tipoContribuinte || "Contribuinte");
    setRegimeTributario(client.regimeTributario || "Normal");
    setEmailNfe(client.emailNfe || "");
    setCnaeFiscal(client.cnaeFiscal || "");
    setCep(client.cep || "");
    setEndereco(client.endereco || "");
    setNumero(client.numero || "");
    setComplemento(client.complemento || "");
    setBairro(client.bairro || "");
    setMunicipio(client.municipio || "");
    setUf(client.uf || "");
    setTelefone1(client.telefone1 || "");
    setTelefone2(client.telefone2 || "");
    setEmailContato(client.emailContato || "");
    setSegmento(client.segmento || "");
    setShowClientDropdown(false);
    setClientSearch("");
  };

  // Filtered products for selection
  const availableProducts = useMemo(() => {
    if (!productsQuery.data) return [];
    const addedCodes = new Set(items.map(i => i.codigoItem));
    let filtered = productsQuery.data.filter(p => !addedCodes.has(p.codigoItem));
    if (productSearch.trim()) {
      const term = productSearch.trim().toLowerCase();
      filtered = filtered.filter(p =>
        p.codigoItem.toLowerCase().includes(term) ||
        p.descricaoItem.toLowerCase().includes(term)
      );
    }
    return filtered.slice(0, 50);
  }, [productsQuery.data, items, productSearch]);

  const addProduct = (product: any) => {
    setItems(prev => [...prev, {
      codigoItem: product.codigoItem,
      descricaoItem: product.descricaoItem,
      quantidade: 1,
      unidadeMedida: product.unidadeMedida || "UN",
      precoUnitario: product.precoMinimo ? Number(product.precoMinimo) : 0,
      precoMinimo: product.precoMinimo ? Number(product.precoMinimo) : null,
    }]);
    setProductSearch("");
  };

  const removeProduct = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const totalProdutos = items.reduce((sum, item) => sum + item.quantidade * item.precoUnitario, 0);
  const totalPedido = totalProdutos + (Number(valorFrete) || 0);
  const hasPrecoAbaixo = items.some(item => item.precoMinimo !== null && item.precoUnitario < item.precoMinimo);

  const handleSubmit = () => {
    createOrderMutation.mutate({
      sellerId,
      cnpjCpf,
      razaoSocial,
      nomeFantasia: nomeFantasia || undefined,
      inscricaoEstadual: inscricaoEstadual || undefined,
      tipoContribuinte: tipoContribuinte || undefined,
      regimeTributario: regimeTributario || undefined,
      emailNfe: emailNfe || undefined,
      cnaeFiscal: cnaeFiscal || undefined,
      cep: cep || undefined,
      endereco: endereco || undefined,
      numero: numero || undefined,
      complemento: complemento || undefined,
      bairro: bairro || undefined,
      municipio: municipio || undefined,
      uf: uf || undefined,
      telefone1: telefone1 || undefined,
      telefone2: telefone2 || undefined,
      emailContato: emailContato || undefined,
      segmento: segmento || undefined,
      condicaoPagamento: condicaoPagamento || undefined,
      valorFrete: Number(valorFrete) || undefined,
      tipoFrete: tipoFrete || undefined,
      observacoes: observacoes || undefined,
      items: items.map(item => ({
        codigoItem: item.codigoItem,
        descricaoItem: item.descricaoItem,
        quantidade: item.quantidade,
        unidadeMedida: item.unidadeMedida,
        precoUnitario: item.precoUnitario,
      })),
    }, {
      onSuccess: (result) => {
        if (result.success) {
          onSuccess();
        }
      },
    });
  };

  const canProceedCliente = cnpjCpf.length >= 11 && razaoSocial.length >= 2;
  const canProceedProdutos = items.length > 0 && items.every(i => i.quantidade > 0 && i.precoUnitario > 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-sm font-bold text-slate-800">Novo Pedido de Venda</h1>
        </div>

        {/* Progress steps */}
        <div className="px-4 pb-3 flex gap-1">
          {(["cliente", "produtos", "pagamento", "revisao"] as const).map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full ${
                (["cliente", "produtos", "pagamento", "revisao"] as const).indexOf(step) >= i
                  ? "bg-teal-500"
                  : "bg-slate-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="p-4">
        {step === "cliente" && (
          <ClientStep
            clientSearch={clientSearch}
            setClientSearch={setClientSearch}
            showClientDropdown={showClientDropdown}
            setShowClientDropdown={setShowClientDropdown}
            clientSearchRef={clientSearchRef}
            clientResults={clientSearchQuery.data || []}
            selectClient={selectClient}
            cnpjCpf={cnpjCpf} setCnpjCpf={setCnpjCpf}
            razaoSocial={razaoSocial} setRazaoSocial={setRazaoSocial}
            nomeFantasia={nomeFantasia} setNomeFantasia={setNomeFantasia}
            inscricaoEstadual={inscricaoEstadual} setInscricaoEstadual={setInscricaoEstadual}
            tipoContribuinte={tipoContribuinte} setTipoContribuinte={setTipoContribuinte}
            regimeTributario={regimeTributario} setRegimeTributario={setRegimeTributario}
            emailNfe={emailNfe} setEmailNfe={setEmailNfe}
            cnaeFiscal={cnaeFiscal} setCnaeFiscal={setCnaeFiscal}
            cep={cep} setCep={setCep}
            endereco={endereco} setEndereco={setEndereco}
            numero={numero} setNumero={setNumero}
            complemento={complemento} setComplemento={setComplemento}
            bairro={bairro} setBairro={setBairro}
            municipio={municipio} setMunicipio={setMunicipio}
            uf={uf} setUf={setUf}
            telefone1={telefone1} setTelefone1={setTelefone1}
            telefone2={telefone2} setTelefone2={setTelefone2}
            emailContato={emailContato} setEmailContato={setEmailContato}
            segmento={segmento} setSegmento={setSegmento}
          />
        )}

        {step === "produtos" && (
          <ProductsStep
            items={items}
            productSearch={productSearch}
            setProductSearch={setProductSearch}
            availableProducts={availableProducts}
            addProduct={addProduct}
            removeProduct={removeProduct}
            updateItem={updateItem}
            totalProdutos={totalProdutos}
          />
        )}

        {step === "pagamento" && (
          <PaymentStep
            condicaoPagamento={condicaoPagamento} setCondicaoPagamento={setCondicaoPagamento}
            valorFrete={valorFrete} setValorFrete={setValorFrete}
            tipoFrete={tipoFrete} setTipoFrete={setTipoFrete}
            observacoes={observacoes} setObservacoes={setObservacoes}
            totalProdutos={totalProdutos}
            totalPedido={totalPedido}
          />
        )}

        {step === "revisao" && (
          <ReviewStep
            razaoSocial={razaoSocial}
            cnpjCpf={cnpjCpf}
            municipio={municipio}
            uf={uf}
            items={items}
            totalProdutos={totalProdutos}
            valorFrete={Number(valorFrete) || 0}
            totalPedido={totalPedido}
            condicaoPagamento={condicaoPagamento}
            tipoFrete={tipoFrete}
            hasPrecoAbaixo={hasPrecoAbaixo}
            observacoes={observacoes}
          />
        )}
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex gap-3">
        {step !== "cliente" && (
          <button
            onClick={() => {
              const steps = ["cliente", "produtos", "pagamento", "revisao"] as const;
              const idx = steps.indexOf(step);
              if (idx > 0) setStep(steps[idx - 1]);
            }}
            className="flex-1 py-3 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Voltar
          </button>
        )}

        {step === "revisao" ? (
          <button
            onClick={handleSubmit}
            disabled={createOrderMutation.isPending}
            className="flex-1 py-3 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {createOrderMutation.isPending ? "Enviando..." : hasPrecoAbaixo ? "Enviar p/ Aprovação" : "Enviar Pedido"}
          </button>
        ) : (
          <button
            onClick={() => {
              const steps = ["cliente", "produtos", "pagamento", "revisao"] as const;
              const idx = steps.indexOf(step);
              if (idx < steps.length - 1) setStep(steps[idx + 1]);
            }}
            disabled={
              (step === "cliente" && !canProceedCliente) ||
              (step === "produtos" && !canProceedProdutos)
            }
            className="flex-1 py-3 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Próximo
          </button>
        )}
      </div>
    </div>
  );
}

// ===== CLIENT STEP =====
function ClientStep(props: any) {
  const {
    clientSearch, setClientSearch, showClientDropdown, setShowClientDropdown,
    clientSearchRef, clientResults, selectClient,
    cnpjCpf, setCnpjCpf, razaoSocial, setRazaoSocial, nomeFantasia, setNomeFantasia,
    inscricaoEstadual, setInscricaoEstadual, tipoContribuinte, setTipoContribuinte,
    regimeTributario, setRegimeTributario, emailNfe, setEmailNfe, cnaeFiscal, setCnaeFiscal,
    cep, setCep, endereco, setEndereco, numero, setNumero, complemento, setComplemento,
    bairro, setBairro, municipio, setMunicipio, uf, setUf,
    telefone1, setTelefone1, telefone2, setTelefone2, emailContato, setEmailContato,
    segmento, setSegmento,
  } = props;

  return (
    <div className="space-y-4 pb-24">
      {/* Client autocomplete search */}
      <div ref={clientSearchRef} className="relative">
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          <User className="w-3.5 h-3.5 inline mr-1" />
          Buscar Cliente Existente
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={clientSearch}
            onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
            onFocus={() => clientSearch.length >= 2 && setShowClientDropdown(true)}
            placeholder="Digite o nome ou CNPJ do cliente..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        {showClientDropdown && clientResults.length > 0 && (
          <div className="absolute z-30 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {clientResults.map((client: any, i: number) => (
              <button
                key={i}
                onClick={() => selectClient(client)}
                className="w-full text-left px-4 py-2.5 hover:bg-teal-50 border-b border-slate-50 last:border-0 cursor-pointer"
              >
                <p className="text-sm font-medium text-slate-800">{client.razaoSocial}</p>
                <p className="text-[10px] text-slate-400">{client.cnpjCpf} • {client.municipio}/{client.uf}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <p className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" /> Dados do Cliente
        </p>
      </div>

      {/* CNPJ/CPF with lookup button */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <InputField label="CNPJ/CPF *" value={cnpjCpf} onChange={setCnpjCpf} placeholder="00.000.000/0001-00" />
          {cnpjCpf.replace(/\D/g, "").length >= 14 && (
            <CnpjLookupButton
              cnpj={cnpjCpf}
              onResult={(data) => {
                if (data.razaoSocial) setRazaoSocial(data.razaoSocial);
                if (data.nomeFantasia) setNomeFantasia(data.nomeFantasia);
                if (data.inscricaoEstadual) setInscricaoEstadual(data.inscricaoEstadual);
                if (data.tipoContribuinte) setTipoContribuinte(data.tipoContribuinte);
                if (data.regimeTributacao) setRegimeTributario(data.regimeTributacao === "Normal" ? "Normal" : data.regimeTributacao.includes("Simples") ? "Simples Nacional" : "Normal");
                if (data.email) setEmailNfe(data.email);
                if (data.cnaePrincipal) setCnaeFiscal(data.cnaePrincipal);
                if (data.cep) setCep(data.cep);
                if (data.logradouro) setEndereco(data.logradouro);
                if (data.numero) setNumero(data.numero);
                if (data.complemento) setComplemento(data.complemento);
                if (data.bairro) setBairro(data.bairro);
                if (data.municipio) setMunicipio(data.municipio);
                if (data.uf) setUf(data.uf);
                if (data.telefone) setTelefone1(data.telefone);
              }}
            />
          )}
        </div>
        <SelectField label="Regime Tributário" value={regimeTributario} onChange={setRegimeTributario} options={["Normal", "Simples Nacional", "MEI"]} />
      </div>

      <InputField label="Razão Social *" value={razaoSocial} onChange={setRazaoSocial} placeholder="Nome da empresa" />
      <InputField label="Nome Fantasia" value={nomeFantasia} onChange={setNomeFantasia} placeholder="Nome fantasia (opcional)" />

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tipo Contribuinte" value={tipoContribuinte} onChange={setTipoContribuinte} options={["Contribuinte", "Isento", "Não contribuinte"]} />
        <InputField label="Inscrição Estadual" value={inscricaoEstadual} onChange={setInscricaoEstadual} placeholder="IE" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InputField label="Email NF-e" value={emailNfe} onChange={setEmailNfe} placeholder="email@empresa.com" type="email" />
        <InputField label="CNAE Fiscal" value={cnaeFiscal} onChange={setCnaeFiscal} placeholder="0000000" />
      </div>

      <SelectField label="Segmento" value={segmento} onChange={setSegmento} options={["", "DISTRIBUIDORA", "SUPERMERCADO", "ATACADO", "VAREJO", "INDÚSTRIA", "RESTAURANTE", "OUTROS"]} />

      {/* Address */}
      <div className="border-t border-slate-200 pt-4">
        <p className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" /> Endereço
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <InputField label="CEP" value={cep} onChange={setCep} placeholder="00000-000" />
        <div className="col-span-2">
          <InputField label="Endereço" value={endereco} onChange={setEndereco} placeholder="Rua/Av" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <InputField label="Número" value={numero} onChange={setNumero} placeholder="Nº" />
        <div className="col-span-2">
          <InputField label="Complemento" value={complemento} onChange={setComplemento} placeholder="Sala, Bloco..." />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InputField label="Bairro" value={bairro} onChange={setBairro} placeholder="Bairro" />
        <InputField label="Município" value={municipio} onChange={setMunicipio} placeholder="Cidade" />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <InputField label="UF" value={uf} onChange={setUf} placeholder="XX" />
        <InputField label="Telefone 1" value={telefone1} onChange={setTelefone1} placeholder="(00) 0000-0000" />
        <InputField label="Telefone 2" value={telefone2} onChange={setTelefone2} placeholder="(00) 0000-0000" />
        <InputField label="Email" value={emailContato} onChange={setEmailContato} placeholder="email" type="email" />
      </div>
    </div>
  );
}

// ===== PRODUCTS STEP =====
function ProductsStep({
  items, productSearch, setProductSearch, availableProducts,
  addProduct, removeProduct, updateItem, totalProdutos,
}: any) {
  const [showProductList, setShowProductList] = useState(false);

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
          <PackageIcon className="w-3.5 h-3.5" /> Produtos ({items.length})
        </p>
        <button
          onClick={() => setShowProductList(!showProductList)}
          className="flex items-center gap-1 text-xs font-semibold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg hover:bg-teal-100 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar
        </button>
      </div>

      {/* Product search/add */}
      {showProductList && (
        <div className="bg-white border border-teal-200 rounded-xl p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {availableProducts.map((p: any) => (
              <button
                key={p.codigoItem}
                onClick={() => { addProduct(p); setShowProductList(false); }}
                className="w-full text-left px-3 py-2 hover:bg-teal-50 rounded-lg cursor-pointer"
              >
                <p className="text-xs font-medium text-slate-800 truncate">{p.descricaoItem}</p>
                <p className="text-[10px] text-slate-400">
                  Cód: {p.codigoItem} • Disp: {p.disponivel} {p.unidadeMedida}
                  {p.precoMinimo && ` • Mín: R$ ${Number(p.precoMinimo).toFixed(2)}`}
                </p>
              </button>
            ))}
            {availableProducts.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-3">Nenhum produto encontrado</p>
            )}
          </div>
        </div>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <div className="text-center py-8">
          <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Nenhum produto adicionado</p>
          <p className="text-[10px] text-slate-400 mt-1">Toque em "Adicionar" para selecionar produtos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: OrderItem, index: number) => {
            const abaixo = item.precoMinimo !== null && item.precoUnitario < item.precoMinimo;
            const total = item.quantidade * item.precoUnitario;
            return (
              <div key={item.codigoItem} className={`bg-white rounded-xl border ${abaixo ? "border-amber-300 bg-amber-50" : "border-slate-100"} p-3`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-medium text-slate-800 flex-1">{item.descricaoItem}</p>
                  <button onClick={() => removeProduct(index)} className="p-1 text-red-400 hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">Qtd</label>
                    <input
                      type="number"
                      value={item.quantidade}
                      onChange={(e) => updateItem(index, "quantidade", Number(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                      min="0.001"
                      step="1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">
                      Preço Unit.
                      {item.precoMinimo !== null && (
                        <span className="text-[9px] text-slate-400 ml-1">(mín: {item.precoMinimo.toFixed(2)})</span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={item.precoUnitario}
                      onChange={(e) => updateItem(index, "precoUnitario", Number(e.target.value) || 0)}
                      className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 ${abaixo ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}
                      min="0.01"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Total</label>
                    <p className="px-2 py-1.5 text-xs font-bold text-slate-700">R$ {total.toFixed(2)}</p>
                  </div>
                </div>
                {abaixo && (
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    Preço abaixo do mínimo! Pedido irá para aprovação do gestor.
                  </div>
                )}
              </div>
            );
          })}

          {/* Total */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-teal-700">Total Produtos</p>
            <p className="text-sm font-bold text-teal-800">R$ {totalProdutos.toFixed(2)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== PAYMENT STEP =====
function PaymentStep({
  condicaoPagamento, setCondicaoPagamento,
  valorFrete, setValorFrete,
  tipoFrete, setTipoFrete,
  observacoes, setObservacoes,
  totalProdutos, totalPedido,
}: any) {
  return (
    <div className="space-y-4 pb-24">
      <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
        <CreditCard className="w-3.5 h-3.5" /> Pagamento e Frete
      </p>

      <SelectField
        label="Condição de Pagamento"
        value={condicaoPagamento}
        onChange={setCondicaoPagamento}
        options={["", "À VISTA", "7 DIAS", "14 DIAS", "21 DIAS", "28 DIAS", "30 DIAS", "30/60", "30/60/90", "BOLETO 30 DIAS", "BOLETO 30/60", "PIX", "CARTÃO"]}
      />

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tipo de Frete" value={tipoFrete} onChange={setTipoFrete} options={["CIF", "FOB", "RETIRA"]} />
        <InputField label="Valor do Frete (R$)" value={valorFrete} onChange={setValorFrete} placeholder="0.00" type="number" />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Observações adicionais sobre o pedido..."
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          rows={3}
        />
      </div>

      {/* Summary */}
      <div className="bg-slate-100 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-xs text-slate-600">
          <span>Produtos</span>
          <span>R$ {totalProdutos.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span>Frete</span>
          <span>R$ {(Number(valorFrete) || 0).toFixed(2)}</span>
        </div>
        <div className="border-t border-slate-300 pt-2 flex justify-between text-sm font-bold text-slate-800">
          <span>Total</span>
          <span>R$ {totalPedido.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// ===== REVIEW STEP =====
function ReviewStep({
  razaoSocial, cnpjCpf, municipio, uf, items, totalProdutos, valorFrete, totalPedido,
  condicaoPagamento, tipoFrete, hasPrecoAbaixo, observacoes,
}: any) {
  return (
    <div className="space-y-4 pb-24">
      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Revisão do Pedido</p>

      {hasPrecoAbaixo && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-700">Atenção: Preço abaixo do mínimo</p>
            <p className="text-[10px] text-amber-600 mt-0.5">Este pedido será enviado para aprovação do gestor antes de chegar na Vitória.</p>
          </div>
        </div>
      )}

      {/* Client summary */}
      <div className="bg-white rounded-xl border border-slate-100 p-3">
        <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Cliente</p>
        <p className="text-sm font-medium text-slate-800">{razaoSocial}</p>
        <p className="text-[10px] text-slate-500">{cnpjCpf} • {municipio}/{uf}</p>
      </div>

      {/* Items summary */}
      <div className="bg-white rounded-xl border border-slate-100 p-3">
        <p className="text-[10px] text-slate-400 uppercase font-semibold mb-2">Itens ({items.length})</p>
        {items.map((item: OrderItem) => (
          <div key={item.codigoItem} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-700 truncate">{item.descricaoItem}</p>
              <p className="text-[10px] text-slate-400">{item.quantidade} x R$ {item.precoUnitario.toFixed(2)}</p>
            </div>
            <p className="text-xs font-semibold text-slate-700 ml-2">R$ {(item.quantidade * item.precoUnitario).toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 space-y-1.5">
        <div className="flex justify-between text-xs text-teal-700">
          <span>Produtos</span>
          <span>R$ {totalProdutos.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs text-teal-700">
          <span>Frete ({tipoFrete})</span>
          <span>R$ {valorFrete.toFixed(2)}</span>
        </div>
        <div className="border-t border-teal-300 pt-1.5 flex justify-between text-sm font-bold text-teal-800">
          <span>Total do Pedido</span>
          <span>R$ {totalPedido.toFixed(2)}</span>
        </div>
        {condicaoPagamento && (
          <p className="text-[10px] text-teal-600 pt-1">Pagamento: {condicaoPagamento}</p>
        )}
      </div>

      {observacoes && (
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Observações</p>
          <p className="text-xs text-slate-600">{observacoes}</p>
        </div>
      )}

      {!hasPrecoAbaixo && (
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          <p className="text-xs font-medium">Pedido será enviado diretamente para a Vitória.</p>
        </div>
      )}
    </div>
  );
}

// ===== SHARED COMPONENTS =====
function InputField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-slate-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt || "Selecione..."}</option>
        ))}
      </select>
    </div>
  );
}


// ===== CNPJ LOOKUP BUTTON (SintegraWS - Client-Side) =====
const SINTEGRA_TOKEN = import.meta.env.VITE_SINTEGRA_API_TOKEN || "";
const SINTEGRA_BASE = "https://www.sintegraws.com.br/api/v1/execute-api.php";

async function consultaCnpjClientSide(cnpj: string) {
  const cleanCnpj = cnpj.replace(/\D/g, "");
  if (cleanCnpj.length !== 14) return { success: false, error: "CNPJ inv\u00e1lido" };

  // Consultar Receita Federal (RF) e Sintegra (ST) em paralelo
  const [rfRes, stRes] = await Promise.allSettled([
    fetch(`${SINTEGRA_BASE}?token=${SINTEGRA_TOKEN}&cnpj=${cleanCnpj}&plugin=RF`).then(r => r.json()),
    fetch(`${SINTEGRA_BASE}?token=${SINTEGRA_TOKEN}&cnpj=${cleanCnpj}&plugin=ST`).then(r => r.json()),
  ]);

  const rfData = rfRes.status === "fulfilled" ? rfRes.value : null;
  const stData = stRes.status === "fulfilled" ? stRes.value : null;

  if (!rfData || rfData.code !== "0") {
    return { success: false, error: rfData?.message || "Erro na consulta. Verifique se o CNPJ est\u00e1 correto." };
  }

  // Determinar tipo contribuinte
  let tipoContribuinte = "N\u00e3o contribuinte";
  if (stData && stData.code === "0") {
    if (stData.contribuinte_icms === true) tipoContribuinte = "Contribuinte";
    else if (stData.inscricao_estadual?.toUpperCase() === "ISENTO") tipoContribuinte = "Isento";
    else if (stData.inscricao_estadual && stData.situacao_ie === "Ativo") tipoContribuinte = "Contribuinte";
  }

  return {
    success: true,
    razaoSocial: rfData.nome || "",
    nomeFantasia: rfData.fantasia && rfData.fantasia !== "********" ? rfData.fantasia : "",
    inscricaoEstadual: stData?.inscricao_estadual || "",
    tipoContribuinte,
    regimeTributacao: stData?.regime_tributacao || "",
    cnaePrincipal: rfData.atividade_principal?.[0]?.code || "",
    email: rfData.email || "",
    telefone: rfData.telefone || "",
    cep: (rfData.cep || "").replace(/[^\d]/g, ""),
    logradouro: rfData.logradouro || "",
    numero: rfData.numero || "",
    complemento: rfData.complemento || "",
    bairro: rfData.bairro || "",
    municipio: rfData.municipio || "",
    uf: rfData.uf || "",
  };
}

function CnpjLookupButton({ cnpj, onResult }: { cnpj: string; onResult: (data: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const cleanCnpj = cnpj.replace(/\D/g, "");

  const handleLookup = async () => {
    if (cleanCnpj.length < 14) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await consultaCnpjClientSide(cleanCnpj);
      if (result.success) {
        onResult(result);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "Erro na consulta");
      }
    } catch (e: any) {
      setError(e.message || "Erro de conex\u00e3o com SintegraWS");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={handleLookup}
        disabled={loading || cleanCnpj.length < 14}
        className={`w-full px-3 py-1.5 text-[10px] font-semibold rounded-lg transition-all ${
          success
            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
            : "bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-1.5">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Consultando Receita Federal...
          </span>
        ) : success ? (
          <span className="flex items-center justify-center gap-1">
            <CheckCircle className="w-3 h-3" /> Dados preenchidos!
          </span>
        ) : (
          "🔍 Consultar CNPJ (Receita Federal + Sintegra)"
        )}
      </button>
      {error && (
        <p className="mt-1 text-[9px] text-red-500 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}
