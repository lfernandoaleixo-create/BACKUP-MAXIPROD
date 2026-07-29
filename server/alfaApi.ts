/**
 * Alfa Transportes API Integration
 * Cotação de frete via REST/JSON: https://api.alfatransportes.com.br/cotacao/v1.2/
 * Rastreamento via REST/JSON: https://api.alfatransportes.com.br/rastreamento/v1.3/
 */

interface AlfaQuoteParams {
  apiKey: string;
  cepDestino: string; // 8 digits
  cepOrigem?: string; // 8 digits
  valorMercadoria: number;
  peso: number; // kg
  metroCubico: number; // m³
  volumes?: number;
  cnpjDestinatario?: string;
  tipoPessoa?: 1 | 2; // 1=PJ, 2=PF
}

interface AlfaQuoteResult {
  id: string;
  status: {
    numero: number;
    descricao: string;
  };
  cotacao?: {
    codigoCotacao: string;
    emissao: {
      remetente: {
        cnpjRemetente: string;
        nomeRemetente: string;
      };
      detinatario: {
        cnpjDestinatario: string;
        nomeDestinatario: string;
        cidadeDestinatario: string;
      };
      transportadora: {
        cnpjTransportadora: string;
        nomeTransportadora: string;
        cidadeTransportadora: string;
      };
      valoresCotacao: {
        valorInicial: number;
        valorPedagio: number;
        valorSeguro: number;
        valorTaxa: number;
        valorImposto: number;
        valorTotal: number;
      };
      diasEntrega: string;
    };
  };
}

export async function quoteAlfaFreight(params: AlfaQuoteParams): Promise<AlfaQuoteResult> {
  const body: Record<string, any> = {
    idr: params.apiKey,
    cliTip: params.tipoPessoa || 1,
    cliCep: params.cepDestino.replace(/\D/g, ""),
    merVlr: params.valorMercadoria,
    merPeso: params.peso,
    merM3: params.metroCubico,
    modoJson: 1, // Always return JSON
    quim: 0,
  };

  if (params.cepOrigem) {
    body.cepRem = params.cepOrigem.replace(/\D/g, "");
  }
  if (params.volumes) {
    body.merVol = params.volumes;
  }
  if (params.cnpjDestinatario) {
    body.cliCnpj = params.cnpjDestinatario.replace(/\D/g, "");
  }

  let response: Response;
  try {
    response = await fetch("https://api.alfatransportes.com.br/cotacao/v1.2/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch (fetchErr: any) {
    // Network-level errors (ECONNREFUSED, ECONNRESET, timeout, DNS failure)
    if (fetchErr.name === "TimeoutError" || fetchErr.code === "UND_ERR_CONNECT_TIMEOUT") {
      throw new Error("Alfa: timeout na conexão (servidor pode estar bloqueando IP)");
    }
    throw new Error(`Alfa: erro de rede (${fetchErr.code || fetchErr.message}). Possível bloqueio de IP.`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    // Detect IP blocking (returns 403 with "Acesso bloqueado para o IP")
    if (response.status === 403 && errorText.includes("bloqueado")) {
      const ipMatch = errorText.match(/IP:\s*([\d.]+)/);
      const blockedIp = ipMatch ? ipMatch[1] : "desconhecido";
      throw new Error(`Alfa: IP bloqueado (${blockedIp}). Solicitar liberação em chamados@alfatransportes.com.br`);
    }
    throw new Error(`Alfa API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}`);
  }

  const result: AlfaQuoteResult = await response.json();

  if (result.status.numero !== 1) {
    throw new Error(`Alfa: ${result.status.descricao} (código ${result.status.numero})`);
  }

  return result;
}

/**
 * Quote freight from Alfa Transportes for all available CNPJs
 */
// ===== RASTREAMENTO =====

export interface AlfaTrackingResult {
  id: string;
  status: {
    numero: number; // 2 = sucesso, 1 = não concluído, 4/6/8/9 = erros
    descricao: string;
  };
  rastreamento?: {
    dadosTransportadora?: {
      nomeTransportadora: string;
      cnpjTransportadora: string;
      cidadeTransportadora: string;
    };
    dadosRemetente?: {
      nomeRemetente: string;
      cnpjRemetente: string;
    };
    dadosCte?: {
      numeroCte: string;
      valorCte: number;
      emissaoData: string;
      dataPrevista: string;
      nomeDestinatario: string;
      agenciaInicio: string;
      agenciaFim: string;
      cidadeEntrega: string;
      notas: Array<{ numero: string; serie: string; chave: string }>;
    };
    complementar?: {
      tipoCte: string;
      numero: string;
      serie: string;
      valor: number;
    };
    dadosEmbarque?: Array<{
      cidadeOrigem: string;
      cidadeDestino: string;
      codigoViagem: string;
      horaSaida: string;
      horaChegada: string;
    }>;
    dadosEntrega?: {
      recebedorMercadoria: string;
      dataEntrega: string;
      urlComprovante: string;
    };
    ocorrenciasExtras?: Array<{
      codigoOcorrencia: string;
      dataOcorrencia: string;
      descricaoOcorrencia: string;
    }>;
  };
}

/**
 * Track a shipment via Alfa Transportes Rastreamento API v1.3
 * @param apiKey - Chave de acesso (idr)
 * @param merNF - Número da Nota Fiscal
 * @param tomCnpj - CNPJ (opcional)
 */
export async function trackAlfaFreight(params: {
  apiKey: string;
  merNF: string;
  tomCnpj?: string;
}): Promise<AlfaTrackingResult> {
  const body: Record<string, any> = {
    idr: params.apiKey,
    merNF: params.merNF,
    modoJson: 1,
  };

  if (params.tomCnpj) {
    body.tomCnpj = params.tomCnpj.replace(/\D/g, "");
  }

  const response = await fetch("https://api.alfatransportes.com.br/rastreamento/v1.3/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Alfa Tracking API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Track a shipment trying all available Alfa API keys
 * Returns the first successful result or all errors
 */
export async function trackAllAlfaCnpjs(merNF: string): Promise<{
  success: boolean;
  data?: AlfaTrackingResult;
  cnpjUsed?: string;
  errors?: Array<{ cnpj: string; error: string }>;
}> {
  const configs = [
    { cnpj: "36562762000129", key: process.env.ALFA_API_KEY_1 || "" },
    { cnpj: "50128808000127", key: process.env.ALFA_API_KEY_2 || "" },
  ].filter(c => c.key);

  const errors: Array<{ cnpj: string; error: string }> = [];

  for (const config of configs) {
    try {
      const result = await trackAlfaFreight({
        apiKey: config.key,
        merNF,
        tomCnpj: config.cnpj,
      });

      // Status 2 = RASTREAMENTO CONCLUIDO COM SUCESSO
      // Status 1 = RASTREAMENTO NAO CONCLUIDO (em trânsito, dados parciais)
      if (result.status.numero === 2 || result.status.numero === 1) {
        return { success: true, data: result, cnpjUsed: config.cnpj };
      }

      errors.push({ cnpj: config.cnpj, error: result.status.descricao });
    } catch (err: any) {
      errors.push({ cnpj: config.cnpj, error: err.message || "Erro desconhecido" });
    }
  }

  return { success: false, errors };
}

// ===== COTAÇÃO =====

export async function quoteAllAlfaCnpjs(params: {
  cepDestino: string;
  cepOrigem?: string;
  valorMercadoria: number;
  peso: number;
  metroCubico: number;
  volumes?: number;
  cnpjDestinatario?: string;
}): Promise<Array<{
  cnpj: string;
  totalFrete: number;
  prazo: string;
  protocolo?: string;
  error?: string;
  details?: AlfaQuoteResult;
}>> {
  // Two API keys available (third CNPJ doesn't have a key yet)
  const configs = [
    { cnpj: "36562762000129", key: process.env.ALFA_API_KEY_1 || "" },
    { cnpj: "50128808000127", key: process.env.ALFA_API_KEY_2 || "" },
  ].filter(c => c.key); // Only quote for CNPJs with valid keys

  const results = await Promise.allSettled(
    configs.map(config =>
      quoteAlfaFreight({
        apiKey: config.key,
        cepDestino: params.cepDestino,
        cepOrigem: params.cepOrigem,
        valorMercadoria: params.valorMercadoria,
        peso: params.peso,
        metroCubico: params.metroCubico,
        volumes: params.volumes,
        cnpjDestinatario: params.cnpjDestinatario,
        tipoPessoa: 1,
      })
    )
  );

  return results.map((result, idx) => {
    if (result.status === "fulfilled" && result.value.cotacao) {
      const cotacao = result.value.cotacao.emissao;
      return {
        cnpj: configs[idx].cnpj,
        totalFrete: cotacao.valoresCotacao.valorTotal,
        prazo: cotacao.diasEntrega,
        protocolo: result.value.cotacao.codigoCotacao || undefined,
        details: result.value,
      };
    } else if (result.status === "fulfilled") {
      return {
        cnpj: configs[idx].cnpj,
        totalFrete: 0,
        prazo: "",
        error: result.value.status.descricao,
      };
    } else {
      return {
        cnpj: configs[idx].cnpj,
        totalFrete: 0,
        prazo: "",
        error: result.reason?.message || "Erro desconhecido",
      };
    }
  });
}
