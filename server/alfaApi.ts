/**
 * Alfa Transportes API Integration
 * Cotação de frete via REST/JSON
 * URL Base: https://api.alfatransportes.com.br/cotacao/v1.2/
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

  const response = await fetch("https://api.alfatransportes.com.br/cotacao/v1.2/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Alfa API error: ${response.status} ${response.statusText}`);
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
