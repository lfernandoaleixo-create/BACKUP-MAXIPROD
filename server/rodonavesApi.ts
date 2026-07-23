/**
 * Rodonaves (RTE/Paulineris) API Integration
 * Cotação de frete via REST/JSON
 * 
 * API Docs: https://dev.paulineris.com.br/reference
 * 
 * Flow:
 * 1. Get city IDs from CEP via DNE API (with ViaCEP fallback): GET https://dne-api.rte.com.br/api/cities/byzipcode?zipCode={cep}
 * 2. Authenticate: POST https://quotation-apigateway.rte.com.br/token
 * 3. Quote freight: POST https://quotation-apigateway.rte.com.br/api/v1/gera-cotacao
 * 4. Get delivery time: POST https://01wapi.rte.com.br/api/v1/prazo-entrega (separate token)
 */

// ===== Configuration =====
const RODONAVES_USERNAME = process.env.RODONAVES_USERNAME || "VARETAS";
const RODONAVES_PASSWORD = process.env.RODONAVES_PASSWORD || "";

// CNPJs remetentes (same as other carriers)
export const RODONAVES_CNPJS = [
  { cnpj: "36562762000129", label: "Palitos Indústria e Comércio" },
  { cnpj: "45558059000138", label: "Varetas Indústria e Comércio" },
  { cnpj: "50128808000127", label: "Espetos Indústria e Comércio" },
];

// CEP de origem padrão (Betim-MG)
const DEFAULT_ORIGIN_CEP = "32210130";

// ===== Types =====
interface RodonavesCityResponse {
  Id: number;
  Description: string;
  IbgeCityCode: number;
}

interface RodonavesTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface RodonavesQuoteResponse {
  Date: string;
  ProtocolId: number;
  RecipientCustomer: string;
  SenderCustomer: string;
  Phone: string;
  Requester: string;
  Type: string;
  FreightValue: string;
  Discount: string;
  Status: string;
  Competence: string;
  Freight: string;
  CustomLogKey: string;
  ClassName: string;
  Revision: number;
}

interface RodonavesDeliveryTimeResponse {
  DeliveryTime: number;
}

// ===== Token cache =====
let tokenCache: { token: string; expiresAt: number } | null = null;
let deliveryTokenCache: { token: string; expiresAt: number } | null = null;

// ===== City ID cache =====
const cityCache = new Map<string, RodonavesCityResponse>();

// ===== Helper functions =====

/**
 * Get city info from ViaCEP as fallback (returns IBGE code which Rodonaves accepts)
 */
async function getCityFromViaCep(cep: string): Promise<RodonavesCityResponse> {
  const cleanCep = cep.replace(/\D/g, "");
  const response = await fetch(
    `https://viacep.com.br/ws/${cleanCep}/json/`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!response.ok) {
    throw new Error(`ViaCEP error: ${response.status}`);
  }

  const data = await response.json();
  if (data.erro) {
    throw new Error(`ViaCEP: CEP ${cleanCep} não encontrado`);
  }

  // Return in Rodonaves format using IBGE code
  return {
    Id: parseInt(data.ibge) || 0,
    Description: data.localidade || "",
    IbgeCityCode: parseInt(data.ibge) || 0,
  };
}

/**
 * Get city ID from CEP using the DNE API with ViaCEP fallback
 */
async function getCityIdFromCep(cep: string): Promise<RodonavesCityResponse> {
  const cleanCep = cep.replace(/\D/g, "");
  
  // Check cache first
  if (cityCache.has(cleanCep)) {
    return cityCache.get(cleanCep)!;
  }

  // Try DNE API first (Rodonaves native)
  try {
    const response = await fetch(
      `https://dne-api.rte.com.br/api/cities/byzipcode?zipCode=${cleanCep}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (response.ok) {
      const data: RodonavesCityResponse = await response.json();
      if (data && data.Id) {
        cityCache.set(cleanCep, data);
        return data;
      }
    }
  } catch {
    // DNE API failed, try fallback
  }

  // Fallback: use ViaCEP to get IBGE code
  try {
    const viaCepData = await getCityFromViaCep(cleanCep);
    if (viaCepData.Id) {
      cityCache.set(cleanCep, viaCepData);
      return viaCepData;
    }
  } catch {
    // Both failed
  }

  throw new Error(`Rodonaves: Não foi possível buscar cidade para CEP ${cleanCep} (DNE e ViaCEP indisponíveis)`);
}

/**
 * Get authentication token for the Quotation API
 */
async function getQuotationToken(): Promise<string> {
  // Check cache
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  if (!RODONAVES_PASSWORD) {
    throw new Error("Rodonaves: Credenciais não configuradas (RODONAVES_PASSWORD)");
  }

  const body = new URLSearchParams({
    auth_type: "DEV",
    grant_type: "password",
    username: RODONAVES_USERNAME,
    password: RODONAVES_PASSWORD,
  });

  const response = await fetch("https://quotation-apigateway.rte.com.br/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Rodonaves auth error: ${response.status} ${response.statusText} - ${text}`);
  }

  const data: RodonavesTokenResponse = await response.json();
  
  // Cache token (expire 5 minutes before actual expiry)
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

/**
 * Get authentication token for the Delivery Time API (separate endpoint)
 */
async function getDeliveryTimeToken(): Promise<string> {
  if (deliveryTokenCache && Date.now() < deliveryTokenCache.expiresAt) {
    return deliveryTokenCache.token;
  }

  if (!RODONAVES_PASSWORD) {
    throw new Error("Rodonaves: Credenciais não configuradas (RODONAVES_PASSWORD)");
  }

  const body = new URLSearchParams({
    auth_type: "DEV",
    grant_type: "password",
    username: RODONAVES_USERNAME,
    password: RODONAVES_PASSWORD,
  });

  const response = await fetch("https://01wapi.rte.com.br/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Rodonaves delivery time auth error: ${response.status}`);
  }

  const data: RodonavesTokenResponse = await response.json();
  deliveryTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

/**
 * Remove accents and convert to uppercase for the delivery time API
 */
function normalizeCity(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

// ===== Main API functions =====

/**
 * Quote freight via Rodonaves for a single CNPJ remetente
 */
export async function quoteRodonavesFreight(params: {
  cnpjRemetente: string;
  cnpjDestinatario: string;
  cepOrigem: string;
  cepDestino: string;
  valorMercadoria: number;
  peso: number;
  volumes?: number;
  nomeContato?: string;
  telefoneContato?: string;
}): Promise<{
  totalFrete: number;
  prazo: string;
  protocolo: number;
  tipo: string;
  raw: RodonavesQuoteResponse;
}> {
  // Step 1: Get city IDs for origin and destination (with fallback)
  const [originCity, destCity] = await Promise.all([
    getCityIdFromCep(params.cepOrigem),
    getCityIdFromCep(params.cepDestino),
  ]);

  // Step 2: Get auth token
  const token = await getQuotationToken();

  // Step 3: Build quote request body
  const requestBody = {
    OriginZipCode: params.cepOrigem.replace(/\D/g, ""),
    OriginCityId: originCity.Id,
    DestinationZipCode: params.cepDestino.replace(/\D/g, ""),
    DestinationCityId: destCity.Id,
    TotalWeight: params.peso,
    EletronicInvoiceValue: params.valorMercadoria,
    CustomerTaxIdRegistration: params.cnpjRemetente.replace(/\D/g, ""),
    ReceiverCpfcnp: params.cnpjDestinatario.replace(/\D/g, ""),
    ContactName: params.nomeContato || "Grupo Fox",
    ContactPhoneNumber: params.telefoneContato || "31999999999",
    TotalPackages: params.volumes || 1,
    Packs: [],
  };

  // Step 4: Call quote API
  const response = await fetch(
    "https://quotation-apigateway.rte.com.br/api/v1/gera-cotacao",
    {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Rodonaves cotação error: ${response.status} - ${text}`);
  }

  const data: RodonavesQuoteResponse = await response.json();

  // Parse freight value (comes as string like "150.00")
  const freightValue = parseFloat(data.FreightValue) || 0;

  // Step 5: Try to get delivery time (optional, don't fail if it doesn't work)
  let prazo = "N/A";
  try {
    const deliveryToken = await getDeliveryTimeToken();
    const deliveryResponse = await fetch(
      "https://01wapi.rte.com.br/api/v1/prazo-entrega",
      {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: {
          "Content-Type": "application/json",
          Accept: "*/*",
          Authorization: `Bearer ${deliveryToken}`,
        },
        body: JSON.stringify({
          OriginCityDescription: normalizeCity(originCity.Description),
          OriginUFDescription: "",
          DestinationCityDescription: normalizeCity(destCity.Description),
          DestinationUFDescription: "",
        }),
      }
    );

    if (deliveryResponse.ok) {
      const deliveryData: RodonavesDeliveryTimeResponse = await deliveryResponse.json();
      if (deliveryData.DeliveryTime > 0) {
        prazo = `${deliveryData.DeliveryTime} dias úteis`;
      }
    }
  } catch {
    // Delivery time is optional, don't fail the whole quote
    prazo = "N/A";
  }

  return {
    totalFrete: freightValue,
    prazo,
    protocolo: data.ProtocolId,
    tipo: data.Type || "Normal",
    raw: data,
  };
}

/**
 * Quote freight from Rodonaves for all available CNPJs simultaneously
 */
export async function quoteAllRodonavesCnpjs(params: {
  cepOrigem?: string;
  cepDestino: string;
  valorMercadoria: number;
  peso: number;
  volumes?: number;
  cnpjDestinatario?: string;
}): Promise<Array<{
  cnpj: string;
  totalFrete: number;
  prazo: string;
  error?: string;
}>> {
  const cepOrigem = params.cepOrigem || DEFAULT_ORIGIN_CEP;
  const cnpjDest = params.cnpjDestinatario || "00000000000000";

  const results = await Promise.allSettled(
    RODONAVES_CNPJS.map(config =>
      quoteRodonavesFreight({
        cnpjRemetente: config.cnpj,
        cnpjDestinatario: cnpjDest,
        cepOrigem,
        cepDestino: params.cepDestino,
        valorMercadoria: params.valorMercadoria,
        peso: params.peso,
        volumes: params.volumes,
      })
    )
  );

  return results.map((result, idx) => {
    if (result.status === "fulfilled") {
      return {
        cnpj: RODONAVES_CNPJS[idx].cnpj,
        totalFrete: result.value.totalFrete,
        prazo: result.value.prazo,
      };
    } else {
      return {
        cnpj: RODONAVES_CNPJS[idx].cnpj,
        totalFrete: 0,
        prazo: "",
        error: result.reason?.message || "Erro desconhecido Rodonaves",
      };
    }
  });
}
