/**
 * Cadastro de Clientes - Painel dedicado para clientes cadastrados pelos vendedores (sem pedido)
 * Separado do painel de Pedidos de Vendas para cada um ter sua função específica
 */
import { useState } from "react";
import TopNav from "@/components/TopNav";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import {
  User, MapPin, ArrowLeft, RefreshCw, ChevronDown,
  Download, FileSpreadsheet, UserPlus
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function CadastroClientes() {
  const { operator, getVisiblePeopleForFeature } = useOperator();
  const [exportingClientId, setExportingClientId] = useState<number | null>(null);
  const visibleSellers = getVisiblePeopleForFeature("gc.cadastroClientes");

  const { data: rawClients, isLoading, refetch: refetchClients } = trpc.salesOrders.getNewClientsForOperator.useQuery(
    undefined,
    { staleTime: 15 * 1000, refetchInterval: 30 * 1000 }
  );
  // Filter clients by visible sellers - STRICT: only show sellers that are explicitly ticked
  const newClients = rawClients?.filter((c: any) => {
    if (visibleSellers.length === 0) return false; // No sub-perms ticked = show nothing
    const sellerSlug = (c.sellerName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    return visibleSellers.includes(sellerSlug);
  });
  const exportVendorClientMutation = trpc.salesOrders.exportVendorClientMaxiprod.useMutation();
  const markExportedMutation = trpc.salesOrders.markClientExported.useMutation();
  const utils = trpc.useUtils();

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
              <p className="text-xs text-slate-500 dark:text-slate-400">Clientes cadastrados pelos vendedores que precisam ser exportados para o Maxiprod</p>
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

        {/* Client count */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 shadow-sm p-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
              {newClients?.length || 0} cliente{(newClients?.length || 0) !== 1 ? "s" : ""} cadastrado{(newClients?.length || 0) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Client list */}
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
          <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 shadow-sm overflow-hidden">
            <div className="divide-y divide-emerald-100 dark:divide-emerald-800">
              {newClients.map((client: any) => (
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
          </div>
        )}
      </main>
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
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{client.sellerName}</span>
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
            {/* PDF Download button */}
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
                    ${client.perfil ? '<div class="field"><span class="label">Perfil:</span> ' + client.perfil + '</div>' : ''}
                    ${client.produtos ? '<div class="field" style="grid-column:span 2"><span class="label">Produtos:</span> ' + client.produtos + '</div>' : ''}
                    ${client.probabilidadeNegocio ? '<div class="field"><span class="label">Probabilidade:</span> ' + client.probabilidadeNegocio + '</div>' : ''}
                    ${client.tamanho ? '<div class="field"><span class="label">Tamanho:</span> ' + client.tamanho + '</div>' : ''}
                    ${client.fornecedorAtual ? '<div class="field"><span class="label">Fornecedor Atual:</span> ' + client.fornecedorAtual + '</div>' : ''}
                    </div>
                    ${client.possuiRedespacho === 1 ? '<h2>REDESPACHO</h2><div class="grid">' + (client.redespachoCnpj ? '<div class="field"><span class="label">CNPJ:</span> ' + client.redespachoCnpj + '</div>' : '') + (client.redespachoRazaoSocial ? '<div class="field"><span class="label">Razão:</span> ' + client.redespachoRazaoSocial + '</div>' : '') + (client.redespachoCep ? '<div class="field"><span class="label">CEP:</span> ' + client.redespachoCep + '</div>' : '') + (enderecoRedespacho ? '<div class="field" style="grid-column:span 2"><span class="label">Endereço:</span> ' + enderecoRedespacho + '</div>' : '') + (client.redespachoTelefone ? '<div class="field"><span class="label">Tel:</span> ' + client.redespachoTelefone + '</div>' : '') + '</div>' : ''}
                    ${client.enderecoEntregaMesmo === 0 ? '<h2>ENDEREÇO DE ENTREGA</h2><div class="grid">' + (client.entregaCep ? '<div class="field"><span class="label">CEP:</span> ' + client.entregaCep + '</div>' : '') + (enderecoEntrega ? '<div class="field" style="grid-column:span 2"><span class="label">Endereço:</span> ' + enderecoEntrega + '</div>' : '') + (client.entregaTelefone ? '<div class="field"><span class="label">Tel:</span> ' + client.entregaTelefone + '</div>' : '') + '</div>' : ''}
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

            {/* Export Maxiprod button */}
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
