/**
 * Flor de Minas - Cotação de frete baseada em planilha
 * Transportadora: Expresso Flor de Minas
 * 
 * Fórmula: Valor da Faixa de Peso + Taxa de Entrega (R$95) + Pedágio (R$12,30) + Seguro (0,7% do valor NF)
 * 
 * Para peso acima de 250kg: valor = peso × R$0,747 (por kg)
 * 
 * Cidades atendidas: SP (Grande SP) e MG (região de Lavras/Varginha/BH)
 * Prazos: 24h ou 48h dependendo da cidade
 */

// Tabela de preços por faixa de peso
const FAIXAS_PESO = [
  { min: 0, max: 50, valor: 103.03, ref: 1 },
  { min: 51, max: 150, valor: 160.27, ref: 2 },
  { min: 151, max: 250, valor: 186.00, ref: 3 },
  // Acima de 250kg: R$ 0,747 por kg
];

const VALOR_POR_KG_ACIMA_250 = 0.747;
const TAXA_ENTREGA = 95.00;
const PEDAGIO = 12.30;
const SEGURO_PERCENTUAL = 0.007; // 0,7%

// Tabela de cidades atendidas com prazo
const CIDADES_ATENDIDAS: Array<{ cidade: string; estado: string; prazo: string }> = [
  // São Paulo
  { cidade: "São Paulo", estado: "SP", prazo: "48 horas" },
  { cidade: "Araçariguama", estado: "SP", prazo: "48 horas" },
  { cidade: "Arujá", estado: "SP", prazo: "48 horas" },
  { cidade: "Barueri", estado: "SP", prazo: "48 horas" },
  { cidade: "Biritiba Mirim", estado: "SP", prazo: "48 horas" },
  { cidade: "Caieiras", estado: "SP", prazo: "48 horas" },
  { cidade: "Cajamar", estado: "SP", prazo: "48 horas" },
  { cidade: "Carapicuíba", estado: "SP", prazo: "48 horas" },
  { cidade: "Cotia", estado: "SP", prazo: "48 horas" },
  { cidade: "Diadema", estado: "SP", prazo: "48 horas" },
  { cidade: "Embu", estado: "SP", prazo: "48 horas" },
  { cidade: "Embu das Artes", estado: "SP", prazo: "48 horas" },
  { cidade: "Embu-Guaçu", estado: "SP", prazo: "48 horas" },
  { cidade: "Ferraz de Vasconcelos", estado: "SP", prazo: "48 horas" },
  { cidade: "Francisco Morato", estado: "SP", prazo: "48 horas" },
  { cidade: "Franco da Rocha", estado: "SP", prazo: "48 horas" },
  { cidade: "Guararema", estado: "SP", prazo: "48 horas" },
  { cidade: "Guarulhos", estado: "SP", prazo: "48 horas" },
  { cidade: "Itapecerica da Serra", estado: "SP", prazo: "48 horas" },
  { cidade: "Itapevi", estado: "SP", prazo: "48 horas" },
  { cidade: "Itaquaquecetuba", estado: "SP", prazo: "48 horas" },
  { cidade: "Jandira", estado: "SP", prazo: "48 horas" },
  { cidade: "Jundiaí", estado: "SP", prazo: "48 horas" },
  { cidade: "Mairiporã", estado: "SP", prazo: "48 horas" },
  { cidade: "Mauá", estado: "SP", prazo: "48 horas" },
  { cidade: "Mogi das Cruzes", estado: "SP", prazo: "48 horas" },
  { cidade: "Osasco", estado: "SP", prazo: "48 horas" },
  { cidade: "Poá", estado: "SP", prazo: "48 horas" },
  { cidade: "Riacho Grande", estado: "SP", prazo: "48 horas" },
  { cidade: "Ribeirão Pires", estado: "SP", prazo: "48 horas" },
  { cidade: "Rio Grande da Serra", estado: "SP", prazo: "48 horas" },
  { cidade: "Santa Isabel", estado: "SP", prazo: "48 horas" },
  { cidade: "Santana do Parnaíba", estado: "SP", prazo: "48 horas" },
  { cidade: "Santana de Parnaíba", estado: "SP", prazo: "48 horas" },
  { cidade: "Santo André", estado: "SP", prazo: "48 horas" },
  { cidade: "São Bernardo do Campo", estado: "SP", prazo: "48 horas" },
  { cidade: "São Caetano do Sul", estado: "SP", prazo: "48 horas" },
  { cidade: "Suzano", estado: "SP", prazo: "48 horas" },
  { cidade: "Taboão da Serra", estado: "SP", prazo: "48 horas" },
  { cidade: "Vargem Grande Paulista", estado: "SP", prazo: "48 horas" },
  // Minas Gerais
  { cidade: "Alfenas", estado: "MG", prazo: "48 horas" },
  { cidade: "Belo Horizonte", estado: "MG", prazo: "48 horas" },
  { cidade: "Betim", estado: "MG", prazo: "48 horas" },
  { cidade: "Boa Esperança", estado: "MG", prazo: "24 horas" },
  { cidade: "Bom Despacho", estado: "MG", prazo: "48 horas" },
  { cidade: "Bom Sucesso", estado: "MG", prazo: "24 horas" },
  { cidade: "Campo Belo", estado: "MG", prazo: "24 horas" },
  { cidade: "Campos Gerais", estado: "MG", prazo: "48 horas" },
  { cidade: "Cana Verde", estado: "MG", prazo: "24 horas" },
  { cidade: "Candeias", estado: "MG", prazo: "24 horas" },
  { cidade: "Carmo da Cachoeira", estado: "MG", prazo: "24 horas" },
  { cidade: "Carmo da Mata", estado: "MG", prazo: "24 horas" },
  { cidade: "Carmópolis de Minas", estado: "MG", prazo: "24 horas" },
  { cidade: "Cláudio", estado: "MG", prazo: "24 horas" },
  { cidade: "Confins", estado: "MG", prazo: "48 horas" },
  { cidade: "Contagem", estado: "MG", prazo: "24 horas" },
  { cidade: "Coqueiral", estado: "MG", prazo: "24 horas" },
  { cidade: "Cristais", estado: "MG", prazo: "24 horas" },
  { cidade: "Crucilândia", estado: "MG", prazo: "48 horas" },
  { cidade: "Desterro de Entre Rios", estado: "MG", prazo: "48 horas" },
  { cidade: "Divinópolis", estado: "MG", prazo: "48 horas" },
  { cidade: "Elói Mendes", estado: "MG", prazo: "24 horas" },
  { cidade: "Ibirité", estado: "MG", prazo: "48 horas" },
  { cidade: "Ibituruna", estado: "MG", prazo: "48 horas" },
  { cidade: "Igarapé", estado: "MG", prazo: "24 horas" },
  { cidade: "Ijaci", estado: "MG", prazo: "24 horas" },
  { cidade: "Itaguara", estado: "MG", prazo: "24 horas" },
  { cidade: "Itapecerica", estado: "MG", prazo: "48 horas" },
  { cidade: "Itatiaiuçu", estado: "MG", prazo: "24 horas" },
  { cidade: "Itaúna", estado: "MG", prazo: "48 horas" },
  { cidade: "Itumirim", estado: "MG", prazo: "24 horas" },
  { cidade: "Itutinga", estado: "MG", prazo: "48 horas" },
  { cidade: "Juatuba", estado: "MG", prazo: "48 horas" },
  { cidade: "Lagoa Santa", estado: "MG", prazo: "48 horas" },
  { cidade: "Lavras", estado: "MG", prazo: "24 horas" },
  { cidade: "Luminárias", estado: "MG", prazo: "48 horas" },
  { cidade: "Machado", estado: "MG", prazo: "48 horas" },
  { cidade: "Mateus Leme", estado: "MG", prazo: "48 horas" },
  { cidade: "Matozinhos", estado: "MG", prazo: "48 horas" },
  { cidade: "Monsenhor Paulo", estado: "MG", prazo: "48 horas" },
  { cidade: "Nazareno", estado: "MG", prazo: "48 horas" },
  { cidade: "Nepomuceno", estado: "MG", prazo: "24 horas" },
  { cidade: "Nova Lima", estado: "MG", prazo: "48 horas" },
  { cidade: "Oliveira", estado: "MG", prazo: "24 horas" },
  { cidade: "Pará de Minas", estado: "MG", prazo: "48 horas" },
  { cidade: "Paraguaçu", estado: "MG", prazo: "48 horas" },
  { cidade: "Passa Tempo", estado: "MG", prazo: "48 horas" },
  { cidade: "Pedro Leopoldo", estado: "MG", prazo: "48 horas" },
  { cidade: "Perdões", estado: "MG", prazo: "24 horas" },
  { cidade: "Piracema", estado: "MG", prazo: "48 horas" },
  { cidade: "Pouso Alegre", estado: "MG", prazo: "48 horas" },
  { cidade: "Ribeirão das Neves", estado: "MG", prazo: "48 horas" },
  { cidade: "Ribeirão Vermelho", estado: "MG", prazo: "24 horas" },
  { cidade: "Rio Manso", estado: "MG", prazo: "48 horas" },
  { cidade: "Sabará", estado: "MG", prazo: "48 horas" },
  { cidade: "Santa Luzia", estado: "MG", prazo: "48 horas" },
  { cidade: "Santana da Vargem", estado: "MG", prazo: "48 horas" },
  { cidade: "Santana do Jacaré", estado: "MG", prazo: "48 horas" },
  { cidade: "Santo Antônio do Amparo", estado: "MG", prazo: "24 horas" },
  { cidade: "São Francisco de Paula", estado: "MG", prazo: "24 horas" },
  { cidade: "São Gonçalo do Sapucaí", estado: "MG", prazo: "48 horas" },
  { cidade: "São João Del Rey", estado: "MG", prazo: "48 horas" },
  { cidade: "São João del Rei", estado: "MG", prazo: "48 horas" },
  { cidade: "São Joaquim de Bicas", estado: "MG", prazo: "48 horas" },
  { cidade: "São José da Lapa", estado: "MG", prazo: "48 horas" },
  { cidade: "São Tiago", estado: "MG", prazo: "48 horas" },
  { cidade: "Sarzedo", estado: "MG", prazo: "48 horas" },
  { cidade: "Três Corações", estado: "MG", prazo: "24 horas" },
  { cidade: "Três Pontas", estado: "MG", prazo: "24 horas" },
  { cidade: "Varginha", estado: "MG", prazo: "24 horas" },
  { cidade: "Vespasiano", estado: "MG", prazo: "48 horas" },
];

/**
 * Normalize city name for comparison (remove accents, lowercase, trim)
 */
function normalizeCidade(cidade: string): string {
  return cidade
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Find a city in the Flor de Minas coverage table.
 * Uses multiple matching strategies:
 * 1. Exact normalized match
 * 2. Partial/substring match
 * 3. Word-boundary match (for compound names)
 */
function findCidade(cidade: string, estado?: string): typeof CIDADES_ATENDIDAS[0] | null {
  const normalizedInput = normalizeCidade(cidade);
  
  // Strategy 1: Exact match
  for (const entry of CIDADES_ATENDIDAS) {
    const normalizedEntry = normalizeCidade(entry.cidade);
    if (normalizedEntry === normalizedInput) {
      if (estado && entry.estado.toLowerCase() !== estado.toLowerCase()) continue;
      return entry;
    }
  }
  
  // Strategy 2: Partial/substring match (for cases like "Embu das Artes" vs "Embu")
  for (const entry of CIDADES_ATENDIDAS) {
    const normalizedEntry = normalizeCidade(entry.cidade);
    if (normalizedInput.includes(normalizedEntry) || normalizedEntry.includes(normalizedInput)) {
      if (estado && entry.estado.toLowerCase() !== estado.toLowerCase()) continue;
      return entry;
    }
  }

  // Strategy 3: Word-start match (for "São João del-Rei" vs "São João Del Rey")
  const inputWords = normalizedInput.split(" ").filter(w => w.length > 2);
  if (inputWords.length >= 2) {
    for (const entry of CIDADES_ATENDIDAS) {
      if (estado && entry.estado.toLowerCase() !== estado.toLowerCase()) continue;
      const entryWords = normalizeCidade(entry.cidade).split(" ").filter(w => w.length > 2);
      // If at least 2 significant words match
      const matchCount = inputWords.filter(w => entryWords.some(ew => ew.startsWith(w.slice(0, 3)) || w.startsWith(ew.slice(0, 3)))).length;
      if (matchCount >= 2 && matchCount >= Math.min(inputWords.length, entryWords.length) - 1) {
        return entry;
      }
    }
  }
  
  return null;
}

/**
 * Calculate freight value based on weight range
 */
function calcularValorFaixa(pesoKg: number): number {
  if (pesoKg <= 50) return FAIXAS_PESO[0].valor;
  if (pesoKg <= 150) return FAIXAS_PESO[1].valor;
  if (pesoKg <= 250) return FAIXAS_PESO[2].valor;
  // Acima de 250kg: valor por kg
  return pesoKg * VALOR_POR_KG_ACIMA_250;
}

/**
 * Calculate total freight for Flor de Minas
 * 
 * Formula: Valor Faixa + Taxa Entrega + Pedágio + (Seguro % × Valor NF)
 */
function calcularFrete(pesoKg: number, valorNF: number): number {
  const valorFaixa = calcularValorFaixa(pesoKg);
  const seguro = valorNF * SEGURO_PERCENTUAL;
  return valorFaixa + TAXA_ENTREGA + PEDAGIO + seguro;
}

/**
 * Look up city from CEP using multiple APIs with retry and fallback.
 * Priority: ViaCEP → BrasilAPI → OpenCEP
 */
async function lookupCidadeFromCep(cep: string): Promise<{ cidade: string; estado: string } | null> {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length !== 8) return null;

  // Try ViaCEP first
  const viacepResult = await fetchWithRetry(
    `https://viacep.com.br/ws/${cleanCep}/json/`,
    (data: any) => !data.erro ? { cidade: data.localidade || "", estado: data.uf || "" } : null,
    "ViaCEP"
  );
  if (viacepResult) return viacepResult;

  // Fallback: BrasilAPI
  const brasilapiResult = await fetchWithRetry(
    `https://brasilapi.com.br/api/cep/v2/${cleanCep}`,
    (data: any) => data.city ? { cidade: data.city, estado: data.state } : null,
    "BrasilAPI"
  );
  if (brasilapiResult) return brasilapiResult;

  // Fallback: OpenCEP
  const opencepResult = await fetchWithRetry(
    `https://opencep.com/v1/${cleanCep}`,
    (data: any) => data.localidade ? { cidade: data.localidade, estado: data.uf } : null,
    "OpenCEP"
  );
  if (opencepResult) return opencepResult;

  console.error(`[FlorDeMinas] All CEP APIs failed for ${cleanCep}`);
  return null;
}

/**
 * Fetch with timeout and 1 retry
 */
async function fetchWithRetry(
  url: string,
  parser: (data: any) => { cidade: string; estado: string } | null,
  label: string,
  retries = 1
): Promise<{ cidade: string; estado: string } | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        console.log(`[FlorDeMinas] ${label} returned ${response.status} (attempt ${attempt + 1})`);
        if (attempt < retries) { await sleep(500); continue; }
        return null;
      }

      const data = await response.json();
      const result = parser(data);
      if (result && result.cidade) return result;
      return null;
    } catch (e: any) {
      console.log(`[FlorDeMinas] ${label} failed (attempt ${attempt + 1}): ${e?.message || e}`);
      if (attempt < retries) { await sleep(500); continue; }
    }
  }
  return null;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export interface FlorDeMinasQuoteResult {
  transportadora: string;
  cnpj: string;
  totalFrete: number;
  prazo: string;
  error?: string;
  detalhes?: {
    valorFaixa: number;
    taxaEntrega: number;
    pedagio: number;
    seguro: number;
    faixaPeso: string;
    cidadeDestino: string;
  };
}

/**
 * Quote freight from Flor de Minas based on spreadsheet data.
 * 
 * Improvements:
 * - Multiple CEP API fallbacks (ViaCEP → BrasilAPI → OpenCEP)
 * - Retry on API failure
 * - Better city name matching (partial, word-boundary)
 * - State-level check: if destination is MG or SP but city not in list, returns
 *   informative error instead of generic failure
 * 
 * @param cepDestino - CEP de destino
 * @param valorMercadoria - Valor da NF-e
 * @param pesoKg - Peso total em kg
 * @returns Quote result or error if city not covered
 */
export async function quoteFlordeMinas(params: {
  cepDestino: string;
  valorMercadoria: number;
  pesoKg: number;
}): Promise<FlorDeMinasQuoteResult> {
  const { cepDestino, valorMercadoria, pesoKg } = params;
  
  // Look up city from CEP (with retry + fallback APIs)
  const cidadeInfo = await lookupCidadeFromCep(cepDestino);
  
  if (!cidadeInfo) {
    return {
      transportadora: "Flor de Minas",
      cnpj: "",
      totalFrete: 0,
      prazo: "N/A",
      error: `Não foi possível identificar a cidade pelo CEP ${cepDestino} (todas as APIs de CEP falharam)`,
    };
  }
  
  // Quick state check: Flor de Minas only serves MG and SP
  const estadoUpper = cidadeInfo.estado.toUpperCase();
  if (estadoUpper !== "MG" && estadoUpper !== "SP") {
    return {
      transportadora: "Flor de Minas",
      cnpj: "",
      totalFrete: 0,
      prazo: "N/A",
      error: `Não atende ${cidadeInfo.estado} (apenas MG e SP)`,
    };
  }

  // Check if city is covered
  const cidadeAtendida = findCidade(cidadeInfo.cidade, cidadeInfo.estado);
  
  if (!cidadeAtendida) {
    return {
      transportadora: "Flor de Minas",
      cnpj: "",
      totalFrete: 0,
      prazo: "N/A",
      error: `Cidade não atendida: ${cidadeInfo.cidade} - ${cidadeInfo.estado} (fora da área de cobertura)`,
    };
  }
  
  // Calculate freight
  const valorFaixa = calcularValorFaixa(pesoKg);
  const seguro = valorMercadoria * SEGURO_PERCENTUAL;
  const totalFrete = calcularFrete(pesoKg, valorMercadoria);
  
  // Determine weight range label
  let faixaPeso: string;
  if (pesoKg <= 50) faixaPeso = "até 50kg";
  else if (pesoKg <= 150) faixaPeso = "51 a 150kg";
  else if (pesoKg <= 250) faixaPeso = "151 a 250kg";
  else faixaPeso = `acima de 250kg (${pesoKg}kg × R$0,747/kg)`;
  
  return {
    transportadora: "Flor de Minas",
    cnpj: "",
    totalFrete: Math.round(totalFrete * 100) / 100,
    prazo: cidadeAtendida.prazo,
    detalhes: {
      valorFaixa: Math.round(valorFaixa * 100) / 100,
      taxaEntrega: TAXA_ENTREGA,
      pedagio: PEDAGIO,
      seguro: Math.round(seguro * 100) / 100,
      faixaPeso,
      cidadeDestino: `${cidadeAtendida.cidade} - ${cidadeAtendida.estado}`,
    },
  };
}
