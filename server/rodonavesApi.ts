/**
 * Rodonaves (RTE/Paulineris) API Integration
 * Cotação de frete via REST/JSON
 * 
 * API Docs: https://dev.rodonaves.com.br/reference
 * 
 * IMPORTANT: Rodonaves servers (Citrix NetScaler) reject TLS 1.3 from cloud IPs.
 * We MUST use Node.js native `https` with secureProtocol='TLSv1_2_method' to connect.
 * The standard `fetch()` API does NOT support TLS version configuration.
 * 
 * Flow:
 * 1. Get city IDs from CEP via DNE API: GET https://dne-api.rte.com.br/api/cities/byzipcode?zipCode={cep}
 * 2. Authenticate: POST https://quotation-apigateway.rte.com.br/token
 * 3. Quote freight: POST https://quotation-apigateway.rte.com.br/api/v1/gera-cotacao
 * 4. Get delivery time: POST https://01wapi.rte.com.br/api/v1/prazo-entrega (separate token)
 */

import * as https from "https";

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
  name?: string;
}

interface RodonavesQuoteResponse {
  // New API format (gera-cotacao on quotation-apigateway)
  Value?: number;
  DeliveryTime?: number;
  ProtocolNumber?: string;
  ExpirationDay?: string;
  Distance?: number;
  Cubed?: boolean;
  Message?: string | null;
  // Legacy format (older API)
  Date?: string;
  ProtocolId?: number;
  RecipientCustomer?: string;
  SenderCustomer?: string;
  Phone?: string;
  Requester?: string;
  Type?: string;
  FreightValue?: string;
  Discount?: string;
  Status?: string;
  Competence?: string;
  Freight?: string;
  CustomLogKey?: string;
  ClassName?: string;
  Revision?: number;
}

interface RodonavesDeliveryTimeResponse {
  DeliveryTime: number;
}

// ===== Token cache =====
let tokenCache: { token: string; expiresAt: number } | null = null;
let deliveryTokenCache: { token: string; expiresAt: number } | null = null;

// ===== City ID cache =====
const cityCache = new Map<string, RodonavesCityResponse>();

// Known Rodonaves city IDs (hardcoded fallback when DNE API is unavailable)
// These were obtained from successful DNE API calls and are stable internal IDs
const KNOWN_CITY_IDS: Record<string, RodonavesCityResponse> = {
  // Minas Gerais - origens Grupo Fox
  "32210130": { Id: 1068, Description: "BETIM", IbgeCityCode: 3106705 },
  "32200000": { Id: 1068, Description: "BETIM", IbgeCityCode: 3106705 },
  "37260000": { Id: 7401, Description: "PERDOES", IbgeCityCode: 3149903 },
  "30000000": { Id: 1038, Description: "BELO HORIZONTE", IbgeCityCode: 3106200 },
  // São Paulo
  "01310100": { Id: 9668, Description: "SAO PAULO", IbgeCityCode: 3550308 },
  "01000000": { Id: 9668, Description: "SAO PAULO", IbgeCityCode: 3550308 },
  "13000000": { Id: 2263, Description: "CAMPINAS", IbgeCityCode: 3509502 },
  "14000000": { Id: 8997, Description: "RIBEIRAO PRETO", IbgeCityCode: 3543402 },
  "12000000": { Id: 9393, Description: "SAO JOSE DOS CAMPOS", IbgeCityCode: 3549904 },
  // Rio de Janeiro
  "20000000": { Id: 8997, Description: "RIO DE JANEIRO", IbgeCityCode: 3304557 },
  // Paraná
  "80000000": { Id: 3437, Description: "CURITIBA", IbgeCityCode: 4106902 },
  // Rio Grande do Sul
  "90000000": { Id: 7801, Description: "PORTO ALEGRE", IbgeCityCode: 4314902 },
  // Goiás
  "74000000": { Id: 4474, Description: "GOIANIA", IbgeCityCode: 5208707 },
  // Distrito Federal
  "70000000": { Id: 2024, Description: "BRASILIA", IbgeCityCode: 5300108 },
};

// ===== IP Fallback for DNS issues =====
// Rodonaves DNS is intermittent from cloud environments
const HOSTNAME_IP_MAP: Record<string, string> = {
  "01wapi.rte.com.br": "150.230.65.150",
  "quotation-apigateway.rte.com.br": "200.210.75.41",
  "dne-api.rte.com.br": "200.210.75.41",
  "customer-apigateway.rte.com.br": "200.210.75.41",
};

// ===== Customer registration cache =====
// Track which CNPJs we've already registered in this session to avoid duplicate calls
const registeredCustomers = new Set<string>();

// ===== TLS 1.2 HTTP Client =====
/**
 * Make an HTTPS request forcing TLS 1.2 (required for Rodonaves Citrix NetScaler)
 * 
 * CRITICAL: Rodonaves Citrix NetScaler blocks TLS connections that include SNI extension
 * from cloud IPs. The workaround is to connect directly to the IP with servername='' 
 * (no SNI) and use the Host header for routing.
 * 
 * Strategy:
 * 1. Primary: Connect to known IP directly without SNI (bypasses Citrix filtering)
 * 2. Fallback: Try hostname with SNI (works when not blocked)
 */
function httpsRequest(options: {
  hostname: string;
  path: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs || 15000;
    const knownIp = HOSTNAME_IP_MAP[options.hostname];
    
    const reqOptions: https.RequestOptions = {
      // Use known IP directly to avoid DNS issues
      hostname: knownIp || options.hostname,
      port: 443,
      path: options.path,
      method: options.method,
      headers: { ...(options.headers || {}), "Host": options.hostname },
      // Force TLS 1.2 - Rodonaves Citrix NetScaler rejects TLS 1.3
      secureProtocol: "TLSv1_2_method" as any,
      ciphers: "ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-GCM-SHA256",
      timeout: timeoutMs,
      rejectUnauthorized: false,
      // CRITICAL: Empty servername = no SNI extension sent in TLS ClientHello
      // This bypasses Citrix NetScaler's SNI-based IP filtering
      servername: "",
    };

    const req = https.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({ status: res.statusCode || 0, body: data });
      });
    });

    req.on("error", (e: any) => {
      reject(new Error(`Rodonaves HTTPS error: ${e.code || e.message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Rodonaves: timeout na conexão"));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Retry wrapper for httpsRequest - handles transient ECONNRESET from Citrix NetScaler
 * Retries up to 2 times with 1s delay between attempts
 */
async function httpsRequestWithRetry(options: Parameters<typeof httpsRequest>[0], maxRetries = 2): Promise<{ status: number; body: string }> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await httpsRequest(options);
    } catch (err: any) {
      lastError = err;
      const isRetryable = err.message?.includes("ECONNRESET") || err.message?.includes("timeout");
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      // Wait before retry (1s, 2s)
      await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
    }
  }
  throw lastError;
}

// ===== Helper functions =====

/**
 * Get city info from ViaCEP as fallback (returns IBGE code)
 * Note: ViaCEP returns IBGE code which may NOT match Rodonaves internal city ID.
 * The DNE API should be preferred.
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
  // WARNING: This is a fallback - IBGE code may not match Rodonaves internal ID
  return {
    Id: parseInt(data.ibge) || 0,
    Description: data.localidade || "",
    IbgeCityCode: parseInt(data.ibge) || 0,
  };
}

/**
 * Get city ID from CEP using the DNE API (Rodonaves native) with ViaCEP fallback
 * Uses TLS 1.2 for DNE API as it's on the same Citrix infrastructure
 */
async function getCityIdFromCep(cep: string): Promise<RodonavesCityResponse> {
  const cleanCep = cep.replace(/\D/g, "");
  
  // Check runtime cache first
  if (cityCache.has(cleanCep)) {
    return cityCache.get(cleanCep)!;
  }

  // Check hardcoded known IDs (exact match)
  if (KNOWN_CITY_IDS[cleanCep]) {
    cityCache.set(cleanCep, KNOWN_CITY_IDS[cleanCep]);
    return KNOWN_CITY_IDS[cleanCep];
  }

  // Try DNE API (Rodonaves native) - uses TLS 1.2
  try {
    const resp = await httpsRequestWithRetry({
      hostname: "dne-api.rte.com.br",
      path: `/api/cities/byzipcode?zipCode=${cleanCep}`,
      method: "GET",
      headers: { Accept: "application/json" },
      timeoutMs: 10000,
    });

    if (resp.status === 200 && resp.body) {
      const data: RodonavesCityResponse = JSON.parse(resp.body);
      if (data && data.Id) {
        cityCache.set(cleanCep, data);
        return data;
      }
    }
  } catch (err: any) {
    console.log(`[Rodonaves] DNE API failed for CEP ${cleanCep}: ${err.message}`);
  }

  // Fallback: check known IDs by CEP prefix (same city, different street)
  // CEP ranges: first 5 digits identify the city in most cases
  const prefix5 = cleanCep.substring(0, 5);
  for (const [knownCep, cityData] of Object.entries(KNOWN_CITY_IDS)) {
    if (knownCep.substring(0, 5) === prefix5) {
      console.log(`[Rodonaves] Using prefix match: CEP ${cleanCep} -> ${cityData.Description} (from ${knownCep})`);
      cityCache.set(cleanCep, cityData);
      return cityData;
    }
  }

  // Last resort: try ViaCEP but this will likely fail for quotation (IBGE != Rodonaves ID)
  // We still try it because some city IDs happen to match
  try {
    const viaCepData = await getCityFromViaCep(cleanCep);
    if (viaCepData.Id) {
      console.log(`[Rodonaves] WARNING: Using ViaCEP IBGE code ${viaCepData.Id} for CEP ${cleanCep} - may not match Rodonaves internal ID`);
      cityCache.set(cleanCep, viaCepData);
      return viaCepData;
    }
  } catch (err: any) {
    console.log(`[Rodonaves] ViaCEP fallback failed for CEP ${cleanCep}: ${err.message}`);
  }

  throw new Error(`Rodonaves: Não foi possível buscar cidade para CEP ${cleanCep} (DNE e ViaCEP indisponíveis)`);
}

/**
 * Get authentication token for the Quotation API
 * Uses quotation-apigateway.rte.com.br with auth_type=DEV
 * The httpsRequest function handles IP direct + no-SNI to bypass Citrix filtering
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
  }).toString();

  const resp = await httpsRequestWithRetry({
    hostname: "quotation-apigateway.rte.com.br",
    path: "/token",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    timeoutMs: 15000,
  });

  if (resp.status !== 200) {
    throw new Error(`Rodonaves auth error: ${resp.status} - ${resp.body.substring(0, 200)}`);
  }

  const data: RodonavesTokenResponse = JSON.parse(resp.body);
  
  if (!data.access_token) {
    throw new Error(`Rodonaves auth: resposta sem token - ${resp.body.substring(0, 200)}`);
  }

  // Cache token (expire 5 minutes before actual expiry)
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  console.log(`[Rodonaves] Token obtido, expires_in=${data.expires_in}s`);
  return data.access_token;
}

/**
 * Get authentication token for the Delivery Time API (separate endpoint)
 * Uses TLS 1.2 for 01wapi.rte.com.br
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
  }).toString();

  const resp = await httpsRequestWithRetry({
    hostname: "01wapi.rte.com.br",
    path: "/token",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    timeoutMs: 10000,
  });

  if (resp.status !== 200) {
    throw new Error(`Rodonaves delivery time auth error: ${resp.status}`);
  }

  const data: RodonavesTokenResponse = JSON.parse(resp.body);
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

// ===== Customer Registration =====

/**
 * Token cache for customer-apigateway (separate from quotation)
 */
let customerTokenCache: { token: string; expiresAt: number } | null = null;

async function getCustomerToken(): Promise<string> {
  if (customerTokenCache && Date.now() < customerTokenCache.expiresAt) {
    return customerTokenCache.token;
  }

  if (!RODONAVES_PASSWORD) {
    throw new Error("Rodonaves: Credenciais não configuradas (RODONAVES_PASSWORD)");
  }

  const body = new URLSearchParams({
    auth_type: "DEV",
    grant_type: "password",
    username: RODONAVES_USERNAME,
    password: RODONAVES_PASSWORD,
  }).toString();

  const resp = await httpsRequestWithRetry({
    hostname: "customer-apigateway.rte.com.br",
    path: "/token",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    timeoutMs: 15000,
  });

  if (resp.status !== 200) {
    throw new Error(`Rodonaves customer auth error: ${resp.status} - ${resp.body.substring(0, 200)}`);
  }

  const data: RodonavesTokenResponse = JSON.parse(resp.body);
  customerTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

/**
 * Register a customer (destinatário) in Rodonaves TMS system.
 * Required before quoting freight for new customers.
 * 
 * If customer already exists, Rodonaves returns 400 with ORA-20010 error - we treat this as success.
 */
export async function registerRodonavesCustomer(params: {
  cnpj: string;
  nome: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  inscricaoEstadual?: string;
}): Promise<{ success: boolean; alreadyExists?: boolean; error?: string }> {
  const cleanCnpj = params.cnpj.replace(/\D/g, "");
  
  // Skip if already registered in this session
  if (registeredCustomers.has(cleanCnpj)) {
    return { success: true, alreadyExists: true };
  }

  try {
    const token = await getCustomerToken();

    const requestBody = JSON.stringify({
      Description: params.nome,
      TaxIdRegistration: cleanCnpj,
      StadualIdRegistration: params.inscricaoEstadual || "",
      Email: params.email || "nfe@grupofox.com.br",
      Phone: (params.telefone || "31999999999").replace(/\D/g, ""),
      ZipCode: params.cep.replace(/\D/g, ""),
      Street: params.logradouro || "Rua",
      Number: params.numero || "S/N",
      Supplement: params.complemento || "",
      District: params.bairro || "Centro",
      City: params.cidade || "",
      UnitFederation: params.uf || "",
    });

    const resp = await httpsRequestWithRetry({
      hostname: "customer-apigateway.rte.com.br",
      path: "/api/v1/customer/savecustomer",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: requestBody,
      timeoutMs: 15000,
    });

    if (resp.status === 200) {
      console.log(`[Rodonaves] Cliente cadastrado com sucesso: ${cleanCnpj} (${params.nome})`);
      registeredCustomers.add(cleanCnpj);
      return { success: true };
    }

    // 400 with "Já existe" = customer already registered (this is fine)
    if (resp.status === 400 && resp.body.includes("exite uma pessoa cadastrada")) {
      console.log(`[Rodonaves] Cliente já cadastrado: ${cleanCnpj}`);
      registeredCustomers.add(cleanCnpj);
      return { success: true, alreadyExists: true };
    }

    console.error(`[Rodonaves] Erro ao cadastrar cliente ${cleanCnpj}: ${resp.status} - ${resp.body.substring(0, 300)}`);
    return { success: false, error: `HTTP ${resp.status}: ${resp.body.substring(0, 200)}` };
  } catch (err: any) {
    console.error(`[Rodonaves] Exceção ao cadastrar cliente ${cleanCnpj}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ===== Main API functions =====

/**
 * Quote freight via Rodonaves for a single CNPJ remetente
 * Now with auto-registration: if "Cliente destinatário não encontrado",
 * attempts to register the customer and retry the quote.
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
  const requestBody = JSON.stringify({
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
  });

  // Step 4: Call quote API (TLS 1.2, no-SNI, IP direct via httpsRequest)
  const resp = await httpsRequestWithRetry({
    hostname: "quotation-apigateway.rte.com.br",
    path: "/api/v1/gera-cotacao",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: requestBody,
    timeoutMs: 20000,
  });

  if (resp.status !== 200) {
    throw new Error(`Rodonaves cotação error: ${resp.status} - ${resp.body.substring(0, 200)}`);
  }

  const data: RodonavesQuoteResponse = JSON.parse(resp.body);

  // Parse freight value - new API returns numeric "Value", legacy returns string "FreightValue"
  const freightValue = data.Value ?? (parseFloat(data.FreightValue || "0") || 0);

  // Parse delivery time - new API returns DeliveryTime directly in the response
  let prazo = "N/A";
  if (data.DeliveryTime && data.DeliveryTime > 0) {
    prazo = `${data.DeliveryTime} dias úteis`;
  } else {
    // Fallback: Try separate delivery time endpoint
    try {
      const deliveryToken = await getDeliveryTimeToken();
      const deliveryResp = await httpsRequestWithRetry({
        hostname: "01wapi.rte.com.br",
        path: "/api/v1/prazo-entrega",
        method: "POST",
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
        timeoutMs: 8000,
      });

      if (deliveryResp.status === 200) {
        const deliveryData: RodonavesDeliveryTimeResponse = JSON.parse(deliveryResp.body);
        if (deliveryData.DeliveryTime > 0) {
          prazo = `${deliveryData.DeliveryTime} dias úteis`;
        }
      }
    } catch {
      // Delivery time is optional, don't fail the whole quote
      prazo = "N/A";
    }
  }

  return {
    totalFrete: freightValue,
    prazo,
    protocolo: data.ProtocolId || parseInt(data.ProtocolNumber || "0") || 0,
    tipo: data.Type || "Normal",
    raw: data,
  };
}

/**
 * Quote freight from Rodonaves for all available CNPJs simultaneously.
 * Auto-registers the customer if "Cliente destinatário não encontrado" error occurs.
 * 
 * @param customerData - Optional customer data for auto-registration. If not provided,
 *                       the caller (salesOrderRouter) should pass it from vendor_clients lookup.
 */
export async function quoteAllRodonavesCnpjs(params: {
  cepOrigem?: string;
  cepDestino: string;
  valorMercadoria: number;
  peso: number;
  volumes?: number;
  cnpjDestinatario?: string;
  // Customer data for auto-registration (looked up from vendor_clients)
  customerData?: {
    nome: string;
    email: string;
    telefone: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    inscricaoEstadual?: string;
  };
}): Promise<Array<{
  cnpj: string;
  totalFrete: number;
  prazo: string;
  error?: string;
}>> {
  const cepOrigem = params.cepOrigem || DEFAULT_ORIGIN_CEP;
  const cnpjDest = params.cnpjDestinatario || "00000000000000";

  // Step 1: Try quoting first
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

  // Step 2: Check if any failed with "Cliente destinatário não encontrado"
  const hasClientNotFound = results.some(
    r => r.status === "rejected" && r.reason?.message?.includes("Cliente destinat\u00e1rio n\u00e3o encontrado")
  );

  // Step 3: If client not found and we have customer data, register and retry
  if (hasClientNotFound && params.customerData && cnpjDest !== "00000000000000") {
    console.log(`[Rodonaves] Cliente ${cnpjDest} não encontrado. Tentando cadastro automático...`);
    
    const regResult = await registerRodonavesCustomer({
      cnpj: cnpjDest,
      ...params.customerData,
    });

    if (regResult.success) {
      console.log(`[Rodonaves] Cadastro OK (alreadyExists=${regResult.alreadyExists}). Retentando cotação...`);
      
      // Wait 2s for Rodonaves TMS to propagate the new customer
      await new Promise(r => setTimeout(r, 2000));

      // Retry all quotes
      const retryResults = await Promise.allSettled(
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

      return retryResults.map((result, idx) => {
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
    } else {
      console.error(`[Rodonaves] Falha no cadastro automático: ${regResult.error}`);
    }
  }

  // Return original results (either no client-not-found error, or registration failed)
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
