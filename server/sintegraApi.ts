import { ENV } from "./_core/env";

const SINTEGRA_BASE_URL = "https://www.sintegraws.com.br/api/v1/execute-api.php";

interface SintegraRFResponse {
  code: string;
  status: string;
  message: string;
  cnpj?: string;
  nome?: string;
  fantasia?: string;
  tipo_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  email?: string;
  telefone?: string;
  situacao?: string;
  abertura?: string;
  capital_social?: string;
  natureza_juridica?: string;
  porte?: string;
  tipo?: string;
  inscricao_municipal?: string;
  atividade_principal?: Array<{ code: string; text: string }>;
  atividades_secundarias?: Array<{ code: string; text: string }>;
}

interface SintegraSTResponse {
  code: string;
  status: string;
  message: string;
  cnpj?: string;
  inscricao_estadual?: string;
  nome_empresarial?: string;
  nome_fantasia?: string;
  situacao_cnpj?: string;
  situacao_ie?: string;
  situacao_ie_desc?: string;
  regime_tributacao?: string;
  informacao_ie_como_destinatario?: string;
  porte_empresa?: string;
  tipo_inscricao?: string;
  contribuinte_icms?: boolean;
  cnae_principal?: { code: string; text: string };
  cep?: string;
  uf?: string;
  municipio?: string;
  bairro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  data_inicio_atividade?: string;
  outras_ies?: Array<{
    inscricao_estadual: string;
    uf: string;
    situacao_ie: string;
    contribuinte_icms: boolean;
  }>;
}

export interface CnpjConsultaResult {
  success: boolean;
  error?: string;
  // Dados da Receita Federal
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacao: string;
  abertura: string;
  porte: string;
  naturezaJuridica: string;
  capitalSocial: string;
  // Endereço
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  // Contato
  telefone: string;
  email: string;
  // CNAE
  cnaePrincipal: string;
  cnaeDescricao: string;
  // Dados do Sintegra (IE e contribuinte)
  inscricaoEstadual: string;
  contribuinteIcms: boolean;
  situacaoIe: string;
  regimeTributacao: string;
  tipoContribuinte: "Contribuinte" | "Não contribuinte" | "Isento";
  informacaoIeDestinatario: string;
  // Inscrição Municipal
  inscricaoMunicipal: string;
}

/**
 * Consulta CNPJ na Receita Federal (plugin=RF)
 */
async function consultaReceitaFederal(cnpj: string): Promise<SintegraRFResponse> {
  const url = `${SINTEGRA_BASE_URL}?token=${ENV.sintegraApiToken}&cnpj=${cnpj}&plugin=RF`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "GrupoFox-Dashboard/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Receita Federal API returned ${response.status}`);
  }
  return response.json();
}

/**
 * Consulta CNPJ no Sintegra (plugin=ST) - retorna IE e contribuinte_icms
 */
async function consultaSintegra(cnpj: string): Promise<SintegraSTResponse> {
  const url = `${SINTEGRA_BASE_URL}?token=${ENV.sintegraApiToken}&cnpj=${cnpj}&plugin=ST`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "GrupoFox-Dashboard/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Sintegra API returned ${response.status}`);
  }
  return response.json();
}

/**
 * Determina o tipo de contribuinte baseado nos dados do Sintegra
 */
function determinarTipoContribuinte(stData: SintegraSTResponse): "Contribuinte" | "Não contribuinte" | "Isento" {
  if (stData.code !== "0") {
    // Se não encontrou no Sintegra, assume não contribuinte
    return "Não contribuinte";
  }
  
  if (stData.contribuinte_icms === true) {
    return "Contribuinte";
  }
  
  // Se tem IE mas não é contribuinte ICMS, pode ser isento
  if (stData.inscricao_estadual && stData.situacao_ie === "Ativo") {
    return "Contribuinte";
  }
  
  // Verificar se é isento (IE = ISENTO ou sem IE ativa)
  if (stData.inscricao_estadual?.toUpperCase() === "ISENTO" || 
      stData.tipo_inscricao?.toUpperCase()?.includes("ISENT")) {
    return "Isento";
  }
  
  return "Não contribuinte";
}

/**
 * Consulta completa de CNPJ: Receita Federal + Sintegra
 * Retorna dados unificados para preenchimento automático do cadastro de cliente
 */
export async function consultaCnpjCompleta(cnpjRaw: string): Promise<CnpjConsultaResult> {
  // Limpar CNPJ (remover pontos, barras, traços)
  const cnpj = cnpjRaw.replace(/[^\d]/g, "");
  
  if (cnpj.length !== 14) {
    return {
      success: false,
      error: "CNPJ inválido. Deve conter 14 dígitos.",
      cnpj: "",
      razaoSocial: "",
      nomeFantasia: "",
      situacao: "",
      abertura: "",
      porte: "",
      naturezaJuridica: "",
      capitalSocial: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      municipio: "",
      uf: "",
      telefone: "",
      email: "",
      cnaePrincipal: "",
      cnaeDescricao: "",
      inscricaoEstadual: "",
      contribuinteIcms: false,
      situacaoIe: "",
      regimeTributacao: "",
      tipoContribuinte: "Não contribuinte",
      informacaoIeDestinatario: "",
      inscricaoMunicipal: "",
    };
  }

  // Consultar ambas APIs em paralelo para performance
  const [rfResult, stResult] = await Promise.allSettled([
    consultaReceitaFederal(cnpj),
    consultaSintegra(cnpj),
  ]);

  const rfData = rfResult.status === "fulfilled" ? rfResult.value : null;
  const stData = stResult.status === "fulfilled" ? stResult.value : null;

  // Verificar se pelo menos a Receita Federal retornou dados
  if (!rfData || rfData.code !== "0") {
    const errorMsg = rfData?.message || (rfResult.status === "rejected" ? (rfResult.reason as Error).message : "Erro desconhecido");
    return {
      success: false,
      error: `Erro na consulta: ${errorMsg}`,
      cnpj: "",
      razaoSocial: "",
      nomeFantasia: "",
      situacao: "",
      abertura: "",
      porte: "",
      naturezaJuridica: "",
      capitalSocial: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      municipio: "",
      uf: "",
      telefone: "",
      email: "",
      cnaePrincipal: "",
      cnaeDescricao: "",
      inscricaoEstadual: "",
      contribuinteIcms: false,
      situacaoIe: "",
      regimeTributacao: "",
      tipoContribuinte: "Não contribuinte",
      informacaoIeDestinatario: "",
      inscricaoMunicipal: "",
    };
  }

  // Montar resultado unificado
  const tipoContribuinte = stData && stData.code === "0" 
    ? determinarTipoContribuinte(stData) 
    : "Não contribuinte";

  return {
    success: true,
    cnpj: rfData.cnpj || cnpj,
    razaoSocial: rfData.nome || "",
    nomeFantasia: rfData.fantasia && rfData.fantasia !== "********" ? rfData.fantasia : "",
    situacao: rfData.situacao || "",
    abertura: rfData.abertura || "",
    porte: rfData.porte || "",
    naturezaJuridica: rfData.natureza_juridica || "",
    capitalSocial: rfData.capital_social || "",
    // Endereço - priorizar RF (mais completo)
    cep: (rfData.cep || stData?.cep || "").replace(/[^\d]/g, ""),
    logradouro: rfData.logradouro || stData?.logradouro || "",
    numero: rfData.numero || stData?.numero || "",
    complemento: rfData.complemento || stData?.complemento || "",
    bairro: rfData.bairro || stData?.bairro || "",
    municipio: rfData.municipio || stData?.municipio || "",
    uf: rfData.uf || stData?.uf || "",
    // Contato
    telefone: rfData.telefone || "",
    email: rfData.email || "",
    // CNAE
    cnaePrincipal: rfData.atividade_principal?.[0]?.code || stData?.cnae_principal?.code || "",
    cnaeDescricao: rfData.atividade_principal?.[0]?.text || stData?.cnae_principal?.text || "",
    // Dados do Sintegra
    inscricaoEstadual: stData?.inscricao_estadual || "",
    contribuinteIcms: stData?.contribuinte_icms ?? false,
    situacaoIe: stData?.situacao_ie || "",
    regimeTributacao: stData?.regime_tributacao || "",
    tipoContribuinte,
    informacaoIeDestinatario: stData?.informacao_ie_como_destinatario || "",
    // Inscrição Municipal
    inscricaoMunicipal: rfData.inscricao_municipal || "",
  };
}
