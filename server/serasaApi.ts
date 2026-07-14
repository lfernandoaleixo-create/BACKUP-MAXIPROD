/**
 * Serasa API Integration - KSI Consultas (Relatório GOLD)
 * 
 * Consulta de crédito via API paga. Cada consulta afeta o score do pesquisado.
 * NÃO automatizar - apenas sob ação explícita do operador com confirmação de senha.
 */

import { ENV } from "./_core/env";

const LOGIN_URL = "https://apiksiconsultas.com.br/auth/login";
const CONSULTA_URL = "https://apiksiconsultas.com.br/consultar/relatorio/gold";

// Cache do token (JWT expira em ~24h baseado no exp do token)
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Autentica na API KSI e retorna o token JWT.
 * Usa cache para evitar login desnecessário.
 */
async function getToken(): Promise<string> {
  // Se token ainda válido (com 5min de margem), reutiliza
  if (cachedToken && Date.now() < tokenExpiry - 300000) {
    return cachedToken;
  }

  const response = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      login: ENV.serasaApiLogin,
      password: ENV.serasaApiPassword,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha na autenticação Serasa: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.token) {
    throw new Error(`Falha na autenticação Serasa: ${data.message || "Token não retornado"}`);
  }

  cachedToken = data.token;
  // Parse JWT to get expiry
  try {
    const payload = JSON.parse(Buffer.from(data.token.split(".")[1], "base64").toString());
    tokenExpiry = (payload.exp || 0) * 1000;
  } catch {
    // Fallback: assume 23h de validade
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  }

  return cachedToken!;
}

export interface SerasaConsultaResult {
  success: boolean;
  error?: string;
  data?: {
    timestamp: string;
    status: number;
    mensagem: string;
    baseDisponivel: boolean;
    // Dados cadastrais
    cadastraispf: any | null;
    cadastraispj: any | null;
    // Crédito
    credito: {
      qntTotalPendenciasGeral: number;
      valorTotalPendenciasGeral: number;
      contemRgi: boolean;
      qntRgi: number;
      valorTotalRgi: number;
      registrosRgi: any[];
      contemProtesto: boolean;
      qntProtesto: number;
      valorTotalProtesto: number;
      registrosProtesto: any[];
      contemChequeSemFundo: boolean;
      qntChequeSemFundo: number;
      registrosChequeSemFundo: any[];
    };
    // Análise IA
    relatorioIA: {
      analiseAiConsultado: boolean;
      aprovado: boolean;
      analiseAi: string;
    } | null;
    // Resultado completo para armazenamento
    rawResponse: any;
  };
}

/**
 * Realiza consulta de crédito no Serasa (Relatório GOLD).
 * ATENÇÃO: Cada chamada é PAGA e afeta o score do consultado.
 * 
 * @param documento CPF (11 dígitos) ou CNPJ (14 dígitos) sem máscara
 * @param tipoPessoa "PF" ou "PJ"
 */
export async function consultarSerasa(
  documento: string,
  tipoPessoa: "PF" | "PJ"
): Promise<SerasaConsultaResult> {
  // Limpa documento (remove pontos, traços, barras)
  const docLimpo = documento.replace(/[.\-\/]/g, "");

  // Valida formato
  if (tipoPessoa === "PF" && docLimpo.length !== 11) {
    return { success: false, error: "CPF deve ter 11 dígitos" };
  }
  if (tipoPessoa === "PJ" && docLimpo.length !== 14) {
    return { success: false, error: "CNPJ deve ter 14 dígitos" };
  }

  try {
    const token = await getToken();

    const response = await fetch(CONSULTA_URL, {
      method: "POST",
      headers: {
        "Authorization": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tipoPessoa: tipoPessoa === "PF" ? "0" : "1",
        documento: docLimpo,
        opcional: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expirado, limpa cache e tenta novamente
        cachedToken = null;
        tokenExpiry = 0;
        const newToken = await getToken();
        const retryResponse = await fetch(CONSULTA_URL, {
          method: "POST",
          headers: {
            "Authorization": newToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tipoPessoa: tipoPessoa === "PF" ? "0" : "1",
            documento: docLimpo,
            opcional: false,
          }),
        });
        if (!retryResponse.ok) {
          return { success: false, error: `Erro na API Serasa: HTTP ${retryResponse.status}` };
        }
        const retryData = await retryResponse.json();
        return parseSerasaResponse(retryData);
      }
      return { success: false, error: `Erro na API Serasa: HTTP ${response.status}` };
    }

    const data = await response.json();
    return parseSerasaResponse(data);
  } catch (err: any) {
    return { success: false, error: `Erro ao consultar Serasa: ${err.message}` };
  }
}

function parseSerasaResponse(data: any): SerasaConsultaResult {
  if (data.status !== 200 || !data.dados) {
    return { success: false, error: data.mensagem || data.erros || "Resposta inválida da API" };
  }

  const dados = data.dados;

  return {
    success: true,
    data: {
      timestamp: data.timestamp,
      status: data.status,
      mensagem: data.mensagem,
      baseDisponivel: dados.baseDisponivel,
      cadastraispf: dados.cadastraispf,
      cadastraispj: dados.cadastraispj,
      credito: dados.credito || {
        qntTotalPendenciasGeral: 0,
        valorTotalPendenciasGeral: 0,
        contemRgi: false,
        qntRgi: 0,
        valorTotalRgi: 0,
        registrosRgi: [],
        contemProtesto: false,
        qntProtesto: 0,
        valorTotalProtesto: 0,
        registrosProtesto: [],
        contemChequeSemFundo: false,
        qntChequeSemFundo: 0,
        registrosChequeSemFundo: [],
      },
      relatorioIA: dados.relatorioIA || null,
      rawResponse: data,
    },
  };
}

/**
 * Busca a última consulta feita para um determinado documento.
 * Usado para mostrar "Última consulta feita há X dias" para a Vitória.
 */
export function calcularDiasDesdeUltimaConsulta(dataConsulta: Date): string {
  const agora = new Date();
  const diffMs = agora.getTime() - dataConsulta.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias === 0) return "hoje";
  if (diffDias === 1) return "há 1 dia";
  if (diffDias < 30) return `há ${diffDias} dias`;
  if (diffDias < 60) return "há 1 mês";
  const meses = Math.floor(diffDias / 30);
  return `há ${meses} meses`;
}
