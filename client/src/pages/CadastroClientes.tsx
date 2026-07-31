/**
 * Cadastro de Clientes - Painel dedicado para clientes cadastrados pelos vendedores
 * Mostra clientes do App (pendentes de exportação) E clientes do Maxiprod, organizados por vendedor
 */
import { useState, useMemo } from "react";
import TopNav from "@/components/TopNav";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import {
  User, MapPin, ArrowLeft, RefreshCw, ChevronDown, ChevronRight,
  Download, FileSpreadsheet, UserPlus, Users, Database, Search
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function CadastroClientes() {
  const { operator, getVisiblePeopleForFeature } = useOperator();
  const [exportingClientId, setExportingClientId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"app" | "maxiprod">("app");
  const [searchTerm, setSearchTerm] = useState("");
  const visibleSellers = getVisiblePeopleForFeature("gc.cadastroClientes");

  // App clients (pending export)
  const { data: rawClients, isLoading, refetch: refetchClients } = trpc.salesOrders.getNewClientsForOperator.useQuery(
    undefined,
    { staleTime: 15 * 1000, refetchInterval: 30 * 1000 }
  );

  // Seller list
  const { data: sellerPerms } = trpc.sales.listSellerPermissions.useQuery(undefined, { staleTime: 60 * 1000 });

  const exportVendorClientMutation = trpc.salesOrders.exportVendorClientMaxiprod.useMutation();
  const markExportedMutation = trpc.salesOrders.markClientExported.useMutation();
  const utils = trpc.useUtils();

  // Filter clients by visible sellers
  const newClients = rawClients?.filter((c: any) => {
    if (visibleSellers.length === 0) return false;
    const sellerSlug = (c.sellerName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    return visibleSellers.includes(sellerSlug);
  });

  // Group app clients by seller
  const clientsBySeller = useMemo(() => {
    if (!newClients) return {};
    const grouped: Record<string, any[]> = {};
    for (const c of newClients) {
      const seller = c.sellerName || "Não identificado";
      if (!grouped[seller]) grouped[seller] = [];
      grouped[seller].push(c);
    }
    return grouped;
  }, [newClients]);

  // Get visible seller names for Maxiprod tab
  const visibleSellerNames = useMemo(() => {
    if (!sellerPerms || visibleSellers.length === 0) return [];
    return sellerPerms
      .filter((sp: any) => {
        const slug = (sp.sellerName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
        return visibleSellers.includes(slug);
      })
      .map((sp: any) => sp.sellerName);
  }, [sellerPerms, visibleSellers]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <TopNav />
      <main className="container py-4 md:py-6 space-y-4 md:space-y-5 pb-20 md:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/gestao-comercial">
              <button className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Cadastro de Clientes</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Clientes cadastrados pelos vendedores (App + Maxiprod)</p>
            </div>
          </div>
          <button
            onClick={() => refetchClients()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("app")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
              activeTab === "app"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Cadastrados no App ({newClients?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("maxiprod")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
              activeTab === "maxiprod"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
            }`}
          >
            <Database className="w-4 h-4" />
            Clientes Maxiprod
          </button>
        </div>

        {/* App Tab - grouped by seller */}
        {activeTab === "app" && (
          <>
            {isLoading ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
                <RefreshCw className="w-5 h-5 text-teal-500 animate-spin mx-auto mb-2" />
                <p className="text-sm text-slate-500">Carregando clientes...</p>
              </div>
            ) : !newClients || newClients.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
                <UserPlus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Nenhum cliente cadastrado aguardando exportação</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(clientsBySeller).map(([sellerName, clients]) => (
                  <SellerGroupCard
                    key={sellerName}
                    sellerName={sellerName}
                    clients={clients}
                    exportingClientId={exportingClientId}
                    setExportingClientId={setExportingClientId}
                    exportVendorClientMutation={exportVendorClientMutation}
                    markExportedMutation={markExportedMutation}
                    refetchClients={refetchClients}
                    utils={utils}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Maxiprod Tab - clients from Maxiprod organized by seller */}
        {activeTab === "maxiprod" && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar cliente por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {visibleSellerNames.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Nenhum vendedor configurado</p>
              </div>
            ) : (
              visibleSellerNames.map((sellerName: string) => (
                <MaxiprodSellerSection key={sellerName} sellerName={sellerName} searchTerm={searchTerm} />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/** Group card for app-registered clients by seller */
function SellerGroupCard({ sellerName, clients, exportingClientId, setExportingClientId, exportVendorClientMutation, markExportedMutation, refetchClients, utils }: any) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">{sellerName}</span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
            {clients.length} cliente{clients.length !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-emerald-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="divide-y divide-emerald-100 dark:divide-emerald-800">
          {clients.map((client: any) => (
            <NewClientExpandableRow
              key={client.id}
              client={client}
              exportingClientId={exportingClientId}
              setExportingClientId={setExportingClientId}
              exportVendorClientMutation={exportVendorClientMutation}
              markExportedMutation={markExportedMutation}
              refetchClients={refetchClients}
              utils={utils}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Maxiprod clients section for a single seller */
function MaxiprodSellerSection({ sellerName, searchTerm }: { sellerName: string; searchTerm: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: clientes, isLoading } = trpc.salesMetrics.getClientesByVendedor.useQuery(
    { vendedor: sellerName },
    { staleTime: 5 * 60 * 1000, enabled: expanded }
  );

  const filteredClientes = useMemo(() => {
    if (!clientes) return [];
    if (!searchTerm) return clientes;
    const term = searchTerm.toUpperCase();
    return clientes.filter((c: any) =>
      (c.cliente || "").toUpperCase().includes(term) ||
      (c.razaoSocial || "").toUpperCase().includes(term)
    );
  }, [clientes, searchTerm]);

  const totalVendas = filteredClientes.reduce((sum: number, c: any) => sum + (c.totalVendas || 0), 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-blue-800 dark:text-blue-200">{sellerName}</span>
          {expanded && clientes && (
            <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
              {filteredClientes.length} cliente{filteredClientes.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {expanded && clientes && (
            <span className="text-xs font-medium text-blue-600">
              R$ {totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          )}
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-blue-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-blue-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="w-4 h-4 text-blue-500 animate-spin mr-2" />
              <span className="text-xs text-slate-500">Carregando clientes do Maxiprod...</span>
            </div>
          ) : filteredClientes.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Nenhum cliente encontrado no Maxiprod</p>
          ) : (
            <div className="space-y-1">
              {filteredClientes.map((c: any, i: number) => (
                <MaxiprodClientRow key={`${c.cliente}-${i}`} client={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Single Maxiprod client row */
function MaxiprodClientRow({ client }: { client: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left cursor-pointer"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{client.cliente}</p>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500 flex-wrap">
            {client.uf && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{client.cidade ? `${client.cidade}/${client.uf}` : client.uf}</span>}
            {client.segmento && <span>{client.segmento}</span>}
            <span>{client.qtdPedidos} pedido{client.qtdPedidos !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold text-emerald-600">
            R$ {(client.totalVendas || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-2 border-t border-slate-100 dark:border-slate-700 pt-2">
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            {client.razaoSocial && client.razaoSocial !== client.cliente && (
              <div className="col-span-2"><span className="text-slate-400">Razão Social:</span> <span className="text-slate-700 dark:text-slate-200">{client.razaoSocial}</span></div>
            )}
            {client.telefone && (
              <div><span className="text-slate-400">Tel:</span> <span className="text-slate-700 dark:text-slate-200">{client.telefone}</span></div>
            )}
            {client.email && (
              <div><span className="text-slate-400">Email:</span> <span className="text-slate-700 dark:text-slate-200">{client.email}</span></div>
            )}
            {client.endereco && (
              <div className="col-span-2"><span className="text-slate-400">Endereço:</span> <span className="text-slate-700 dark:text-slate-200">{client.endereco}</span></div>
            )}
            {client.primeiroPedido && (
              <div><span className="text-slate-400">1º Pedido:</span> <span className="text-slate-700 dark:text-slate-200">{new Date(client.primeiroPedido).toLocaleDateString("pt-BR")}</span></div>
            )}
            {client.ultimoPedido && (
              <div><span className="text-slate-400">Último:</span> <span className="text-slate-700 dark:text-slate-200">{new Date(client.ultimoPedido).toLocaleDateString("pt-BR")}</span></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NewClientExpandableRow({ client, exportingClientId, setExportingClientId, exportVendorClientMutation, markExportedMutation, refetchClients, utils }: any) {
  const [expanded, setExpanded] = useState(false);

  const endereco = [client.logradouro, client.numero, client.bairro, client.cidade, client.uf]
    .filter(Boolean).join(", ");
  const enderecoEntrega = [client.entregaLogradouro, client.entregaNumero, client.entregaBairro, client.entregaCidade, client.entregaUf]
    .filter(Boolean).join(", ");
  const enderecoRedespacho = [client.redespachoLogradouro, client.redespachoNumero, client.redespachoBairro, client.redespachoCidade, client.redespachoUf]
    .filter(Boolean).join(", ");

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{client.razaoSocial}</p>
            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500 flex-wrap">
              <span>{client.cnpjCpf}</span>
              {client.cidade && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{client.cidade}/{client.uf}</span>}
              <span>{new Date(client.createdAt).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-l-4 border-emerald-300 dark:border-emerald-700 ml-4 bg-emerald-50/30 dark:bg-emerald-900/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2">
            {client.razaoSocial && (
              <div><span className="text-slate-400 font-medium">Razão Social:</span> <span className="text-slate-700 dark:text-slate-200">{client.razaoSocial}</span></div>
            )}
            {client.nomeFantasia && (
              <div><span className="text-slate-400 font-medium">Nome Fantasia:</span> <span className="text-slate-700 dark:text-slate-200">{client.nomeFantasia}</span></div>
            )}
            {client.cnpjCpf && (
              <div><span className="text-slate-400 font-medium">CNPJ/CPF:</span> <span className="text-slate-700 dark:text-slate-200 font-mono">{client.cnpjCpf}</span></div>
            )}
            {client.inscricaoEstadual && (
              <div><span className="text-slate-400 font-medium">IE:</span> <span className="text-slate-700 dark:text-slate-200">{client.inscricaoEstadual}</span></div>
            )}
            {client.inscricaoMunicipal && (
              <div><span className="text-slate-400 font-medium">IM:</span> <span className="text-slate-700 dark:text-slate-200">{client.inscricaoMunicipal}</span></div>
            )}
            {client.inscricaoSuframa && (
              <div><span className="text-slate-400 font-medium">SUFRAMA:</span> <span className="text-slate-700 dark:text-slate-200">{client.inscricaoSuframa}</span></div>
            )}
            {client.cep && (
              <div><span className="text-slate-400 font-medium">CEP:</span> <span className="text-slate-700 dark:text-slate-200">{client.cep}</span></div>
            )}
            {endereco && (
              <div className="sm:col-span-2"><span className="text-slate-400 font-medium">Endereço:</span> <span className="text-slate-700 dark:text-slate-200">{endereco}</span></div>
            )}
            {client.telefone1 && (
              <div><span className="text-slate-400 font-medium">Telefone:</span> <span className="text-slate-700 dark:text-slate-200">{client.telefone1}{client.telefone2 ? ` / ${client.telefone2}` : ""}</span></div>
            )}
            {client.email && (
              <div><span className="text-slate-400 font-medium">Email:</span> <span className="text-slate-700 dark:text-slate-200">{client.email}</span></div>
            )}
            {client.emailNfe && (
              <div><span className="text-slate-400 font-medium">Email NFe:</span> <span className="text-slate-700 dark:text-slate-200">{client.emailNfe}</span></div>
            )}
            {client.nomeContato && (
              <div><span className="text-slate-400 font-medium">Contato:</span> <span className="text-slate-700 dark:text-slate-200">{client.nomeContato}</span></div>
            )}
            {client.segmento && (
              <div><span className="text-slate-400 font-medium">Segmento:</span> <span className="text-slate-700 dark:text-slate-200">{client.segmento}</span></div>
            )}
            {client.regimeTributario && (
              <div><span className="text-slate-400 font-medium">Regime Tributário:</span> <span className="text-slate-700 dark:text-slate-200">{client.regimeTributario}</span></div>
            )}
            {client.situacaoFiscalEspecial && client.situacaoFiscalEspecial !== "Nenhuma" && (
              <div><span className="text-slate-400 font-medium">Sit. Fiscal:</span> <span className="text-slate-700 dark:text-slate-200">{client.situacaoFiscalEspecial}</span></div>
            )}
            {client.cnaeFiscal && (
              <div><span className="text-slate-400 font-medium">CNAE:</span> <span className="text-slate-700 dark:text-slate-200">{client.cnaeFiscal}</span></div>
            )}
            {client.limiteCredito && (
              <div><span className="text-slate-400 font-medium">Limite Crédito:</span> <span className="text-slate-700 dark:text-slate-200">R$ {client.limiteCredito}</span></div>
            )}
            {client.formaCobranca && (
              <div><span className="text-slate-400 font-medium">Forma Cobrança:</span> <span className="text-slate-700 dark:text-slate-200">{client.formaCobranca}</span></div>
            )}
            {client.tabelaPrecos && (
              <div><span className="text-slate-400 font-medium">Tabela Preços:</span> <span className="text-slate-700 dark:text-slate-200">{client.tabelaPrecos}</span></div>
            )}
            {client.condicaoPagamento && (
              <div><span className="text-slate-400 font-medium">Cond. Pagamento:</span> <span className="text-slate-700 dark:text-slate-200">{client.condicaoPagamento}</span></div>
            )}
            {client.regiao && (
              <div><span className="text-slate-400 font-medium">Região:</span> <span className="text-slate-700 dark:text-slate-200">{client.regiao}</span></div>
            )}
            {client.perfil && (
              <div><span className="text-slate-400 font-medium">Perfil:</span> <span className="text-slate-700 dark:text-slate-200">{client.perfil}</span></div>
            )}
            {client.produtos && (
              <div className="sm:col-span-2"><span className="text-slate-400 font-medium">Produtos:</span> <span className="text-slate-700 dark:text-slate-200">{client.produtos}</span></div>
            )}
            {client.probabilidadeNegocio && (
              <div><span className="text-slate-400 font-medium">Probabilidade:</span> <span className="text-slate-700 dark:text-slate-200">{client.probabilidadeNegocio}</span></div>
            )}
            {client.tamanho && (
              <div><span className="text-slate-400 font-medium">Tamanho:</span> <span className="text-slate-700 dark:text-slate-200">{client.tamanho}</span></div>
            )}
            {client.fornecedorAtual && (
              <div><span className="text-slate-400 font-medium">Fornecedor Atual:</span> <span className="text-slate-700 dark:text-slate-200">{client.fornecedorAtual}</span></div>
            )}
            {client.website && (
              <div><span className="text-slate-400 font-medium">Website:</span> <span className="text-slate-700 dark:text-slate-200">{client.website}</span></div>
            )}
            {client.observacoes && (
              <div className="sm:col-span-2"><span className="text-slate-400 font-medium">Obs:</span> <span className="text-slate-700 dark:text-slate-200">{client.observacoes}</span></div>
            )}
          </div>

          {/* Redespacho */}
          {client.possuiRedespacho === 1 && (
            <div className="mt-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
              <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Redespacho</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                {client.redespachoCnpj && <span className="text-slate-600 dark:text-slate-300">CNPJ: {client.redespachoCnpj}</span>}
                {client.redespachoRazaoSocial && <span className="text-slate-600 dark:text-slate-300">Razão: {client.redespachoRazaoSocial}</span>}
                {client.redespachoCep && <span className="text-slate-600 dark:text-slate-300">CEP: {client.redespachoCep}</span>}
                {enderecoRedespacho && <span className="text-slate-600 dark:text-slate-300">{enderecoRedespacho}</span>}
                {client.redespachoTelefone && <span className="text-slate-600 dark:text-slate-300">Tel: {client.redespachoTelefone}</span>}
              </div>
            </div>
          )}

          {/* Endereço de entrega diferente */}
          {client.enderecoEntregaMesmo === 0 && (
            <div className="mt-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700">
              <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Endereço de Entrega (diferente)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                {client.entregaCep && <span className="text-slate-600 dark:text-slate-300">CEP: {client.entregaCep}</span>}
                {enderecoEntrega && <span className="text-slate-600 dark:text-slate-300">{enderecoEntrega}</span>}
                {client.entregaTelefone && <span className="text-slate-600 dark:text-slate-300">Tel: {client.entregaTelefone}</span>}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const printWindow = window.open("", "_blank");
                if (printWindow) {
                  printWindow.document.write(`
                    <html><head><title>Cadastro - ${client.razaoSocial}</title>
                    <style>
                      body { font-family: Arial, sans-serif; padding: 40px; font-size: 12px; line-height: 1.6; }
                      h1 { font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 8px; }
                      h2 { font-size: 13px; color: #555; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
                      .field { margin: 4px 0; }
                      .label { font-weight: bold; color: #333; }
                      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
                    </style></head><body>
                    <h1>CADASTRO DE CLIENTE</h1>
                    <div class="grid">
                    ${client.razaoSocial ? '<div class="field"><span class="label">Razão Social:</span> ' + client.razaoSocial + '</div>' : ''}
                    ${client.nomeFantasia ? '<div class="field"><span class="label">Nome Fantasia:</span> ' + client.nomeFantasia + '</div>' : ''}
                    ${client.cnpjCpf ? '<div class="field"><span class="label">CNPJ/CPF:</span> ' + client.cnpjCpf + '</div>' : ''}
                    ${client.inscricaoEstadual ? '<div class="field"><span class="label">IE:</span> ' + client.inscricaoEstadual + '</div>' : ''}
                    ${client.cep ? '<div class="field"><span class="label">CEP:</span> ' + client.cep + '</div>' : ''}
                    ${endereco ? '<div class="field" style="grid-column:span 2"><span class="label">Endereço:</span> ' + endereco + '</div>' : ''}
                    ${client.telefone1 ? '<div class="field"><span class="label">Telefone:</span> ' + client.telefone1 + (client.telefone2 ? ' / ' + client.telefone2 : '') + '</div>' : ''}
                    ${client.email ? '<div class="field"><span class="label">Email:</span> ' + client.email + '</div>' : ''}
                    ${client.nomeContato ? '<div class="field"><span class="label">Contato:</span> ' + client.nomeContato + '</div>' : ''}
                    ${client.segmento ? '<div class="field"><span class="label">Segmento:</span> ' + client.segmento + '</div>' : ''}
                    ${client.regimeTributario ? '<div class="field"><span class="label">Regime Tributário:</span> ' + client.regimeTributario + '</div>' : ''}
                    ${client.formaCobranca ? '<div class="field"><span class="label">Forma Cobrança:</span> ' + client.formaCobranca + '</div>' : ''}
                    ${client.condicaoPagamento ? '<div class="field"><span class="label">Cond. Pagamento:</span> ' + client.condicaoPagamento + '</div>' : ''}
                    ${client.regiao ? '<div class="field"><span class="label">Região:</span> ' + client.regiao + '</div>' : ''}
                    </div>
                    ${client.possuiRedespacho === 1 ? '<h2>REDESPACHO</h2><div class="grid">' + (client.redespachoCnpj ? '<div class="field"><span class="label">CNPJ:</span> ' + client.redespachoCnpj + '</div>' : '') + (client.redespachoRazaoSocial ? '<div class="field"><span class="label">Razão:</span> ' + client.redespachoRazaoSocial + '</div>' : '') + '</div>' : ''}
                    ${client.enderecoEntregaMesmo === 0 ? '<h2>ENDEREÇO DE ENTREGA</h2><div class="grid">' + (client.entregaCep ? '<div class="field"><span class="label">CEP:</span> ' + client.entregaCep + '</div>' : '') + (enderecoEntrega ? '<div class="field" style="grid-column:span 2"><span class="label">Endereço:</span> ' + enderecoEntrega + '</div>' : '') + '</div>' : ''}
                    ${client.observacoes ? '<h2>OBSERVAÇÕES</h2><p>' + client.observacoes + '</p>' : ''}
                    <hr style="margin-top:20px">
                    <p style="color:#888;font-size:10px">Vendedor: ${client.sellerName || 'N/A'} | Cadastrado em: ${new Date(client.createdAt).toLocaleDateString('pt-BR')}</p>
                    </body></html>
                  `);
                  printWindow.document.close();
                  setTimeout(() => { printWindow.print(); }, 300);
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200 rounded-lg hover:bg-blue-200 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Baixar PDF
            </button>

            <button
              onClick={async (e) => {
                e.stopPropagation();
                setExportingClientId(client.id);
                try {
                  const result = await exportVendorClientMutation.mutateAsync({ clientId: client.id });
                  const byteCharacters = atob(result.base64);
                  const byteNumbers = new Array(byteCharacters.length);
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = result.filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success(`Planilha exportada: ${result.clientName}`);
                } catch (err: any) {
                  toast.error(err.message || "Erro ao exportar");
                } finally {
                  setExportingClientId(null);
                }
              }}
              disabled={exportingClientId === client.id}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-lg hover:bg-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              {exportingClientId === client.id ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              {exportingClientId === client.id ? "Exportando..." : "Exportar Maxiprod"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
