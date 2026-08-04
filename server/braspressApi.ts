/**
 * Braspress API Integration — Cotação de Frete
 * 
 * Endpoint: POST https://api.braspress.com/v1/cotacao/calcular/json
 * Auth: Basic Auth (Base64 encoded usuario:senha)
 * 
 * Regra: Sempre oferecer opção de cotar pelos 3 CNPJs
 */

export interface BraspressCnpjConfig {
  cnpj: string;
  usuario: string;
  senha: string;
  label: string; // Nome amigável para exibição
}

// Credenciais de produção (3 CNPJs)
export const BRASPRESS_CNPJS: BraspressCnpjConfig[] = [
  {
    cnpj: "36562762000129",
    usuario: "36562762000129_PRD",
    senha: "q6lxQgr5y8pv8sYx",
    label: "CNPJ 1 - 36.562.762/0001-29",
  },
  {
    cnpj: "45558059000138",
    usuario: "45558059000138_PRD",
    senha: "ahNMi4R2fCDTHkzt",
    label: "CNPJ 2 - 45.558.059/0001-38",
  },
  {
    cnpj: "50128808000127",
    usuario: "50128808000127_PRD",
    senha: "1w0PLb27N06p679Q",
    label: "CNPJ 3 - 50.128.808/0001-27",
  },
];

export interface BraspressQuoteInput {
  cnpjIndex: number;           // 0, 1 ou 2 — qual CNPJ usar
  cnpjDestinatario: string;    // CNPJ do cliente (só números)
  cepOrigem: string;           // CEP do Grupo Fox (só números)
  cepDestino: string;          // CEP do cliente (só números)
  valorMercadoria: number;     // Valor total da mercadoria (R$)
  peso: number;                // Peso total em kg
  volumes: number;             // Quantidade de volumes
  // Cubagem (dimensões médias por volume)
  altura: number;              // Altura em metros
  largura: number;             // Largura em metros
  comprimento: number;         // Comprimento em metros
}

export interface BraspressQuoteResult {
  success: boolean;
  cnpjUsado: string;
  labelCnpj: string;
  prazo?: number;              // Prazo em dias úteis
  totalFrete?: number;         // Valor total do frete (R$)
  id?: number;                 // ID da cotação na Braspress
  error?: string;
}

const BRASPRESS_BASE_URL = "https://api.braspress.com";

/**
 * Realiza cotação de frete na Braspress
 */
export async function cotarBraspress(input: BraspressQuoteInput): Promise<BraspressQuoteResult> {
  const config = BRASPRESS_CNPJS[input.cnpjIndex];
  if (!config) {
    return {
      success: false,
      cnpjUsado: "",
      labelCnpj: "",
      error: "Índice de CNPJ inválido",
    };
  }

  // Basic Auth
  const authString = Buffer.from(`${config.usuario}:${config.senha}`).toString("base64");

  // Validate CNPJ - Braspress requires a valid CNPJ
  const cleanCnpjDest = input.cnpjDestinatario.replace(/\D/g, "");
  if (!cleanCnpjDest || cleanCnpjDest.length < 11 || cleanCnpjDest === "00000000000000") {
    return {
      success: false,
      cnpjUsado: config.cnpj,
      labelCnpj: config.label,
      error: "CNPJ do destinatário não cadastrado no sistema",
    };
  }

  const body = {
    cnpjRemetente: parseInt(config.cnpj),
    cnpjDestinatario: parseInt(cleanCnpjDest),
    modal: "R", // Rodoviário
    tipoFrete: "1", // Normal (1=Normal, 2=Subcontratação, 3=Redespacho)
    cepOrigem: parseInt(input.cepOrigem.replace(/\D/g, "")),
    cepDestino: parseInt(input.cepDestino.replace(/\D/g, "")),
    vlrMercadoria: input.valorMercadoria,
    peso: input.peso,
    volumes: input.volumes,
    cubagem: [
      {
        altura: input.altura,
        largura: input.largura,
        comprimento: input.comprimento,
        volumes: input.volumes,
      },
    ],
  };

  try {
    const response = await fetch(`${BRASPRESS_BASE_URL}/v1/cotacao/calcular/json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        cnpjUsado: config.cnpj,
        labelCnpj: config.label,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      cnpjUsado: config.cnpj,
      labelCnpj: config.label,
      prazo: data.prazo,
      totalFrete: data.totalFrete,
      id: data.id,
    };
  } catch (err: any) {
    return {
      success: false,
      cnpjUsado: config.cnpj,
      labelCnpj: config.label,
      error: err.message || "Erro desconhecido",
    };
  }
}

/**
 * Cota frete em todos os 3 CNPJs simultaneamente.
 * Uses allSettled to ensure one failure doesn't block others.
 * Retries failed CNPJs once before giving up.
 */
export async function cotarTodosCnpjs(
  input: Omit<BraspressQuoteInput, "cnpjIndex">
): Promise<BraspressQuoteResult[]> {
  const results = await Promise.allSettled(
    BRASPRESS_CNPJS.map((_, index) =>
      cotarBraspress({ ...input, cnpjIndex: index })
    )
  );

  const mapped = results.map((result, idx) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      return {
        success: false,
        cnpjUsado: BRASPRESS_CNPJS[idx].cnpj,
        labelCnpj: BRASPRESS_CNPJS[idx].label,
        error: result.reason?.message || "Erro desconhecido",
      } as BraspressQuoteResult;
    }
  });

  // Retry failed ones once
  const hasSuccess = mapped.some(r => r.success);
  if (hasSuccess) {
    for (let i = 0; i < mapped.length; i++) {
      if (!mapped[i].success && mapped[i].error && !mapped[i].error!.includes("não atende")) {
        try {
          await new Promise(r => setTimeout(r, 200));
          const retry = await cotarBraspress({ ...input, cnpjIndex: i });
          if (retry.success) {
            mapped[i] = retry;
            console.log(`[Braspress] Retry succeeded for CNPJ index ${i}`);
          }
        } catch (e) {
          // Keep original error
        }
      }
    }
  }

  return mapped;
}
