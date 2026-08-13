/**
 * Tabela DIFAL 2026 - Saídas de Minas Gerais
 * Destinada a Consumidores Finais Não Contribuintes
 * 
 * Quando o cliente NÃO tem Inscrição Estadual (isento) ou é CPF,
 * quem paga o DIFAL somos nós (Grupo Fox).
 * 
 * Colunas:
 * - importado: DIFAL Base Importado (produto importado - bambu/fibra)
 * - industrializado: DIFAL Base Industrializado (produto nacional - madeira)
 */

export interface DifalRate {
  estado: string;
  sigla: string;
  regiao: string;
  aliqInterna: number;      // Alíquota interna do estado destino (2026)
  interestadualImportado: number;   // 4% (fixo para importados)
  interestadualIndustrializado: number; // 7% ou 12% dependendo da região
  difalImportado: number;   // % DIFAL para produtos importados
  difalIndustrializado: number; // % DIFAL para produtos industrializados
}

export const DIFAL_RATES: Record<string, DifalRate> = {
  AC: { estado: "Acre", sigla: "AC", regiao: "Norte", aliqInterna: 19, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 15, difalIndustrializado: 12 },
  AL: { estado: "Alagoas", sigla: "AL", regiao: "Nordeste", aliqInterna: 20.5, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 16.5, difalIndustrializado: 13.5 },
  AM: { estado: "Amazonas", sigla: "AM", regiao: "Norte", aliqInterna: 20, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 16, difalIndustrializado: 13 },
  AP: { estado: "Amapá", sigla: "AP", regiao: "Norte", aliqInterna: 18, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 14, difalIndustrializado: 11 },
  BA: { estado: "Bahia", sigla: "BA", regiao: "Nordeste", aliqInterna: 20.5, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 16.5, difalIndustrializado: 13.5 },
  CE: { estado: "Ceará", sigla: "CE", regiao: "Nordeste", aliqInterna: 20, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 16, difalIndustrializado: 13 },
  DF: { estado: "Distrito Federal", sigla: "DF", regiao: "Centro-Oeste", aliqInterna: 20, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 16, difalIndustrializado: 13 },
  ES: { estado: "Espírito Santo", sigla: "ES", regiao: "Sudeste", aliqInterna: 17, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 13, difalIndustrializado: 10 },
  GO: { estado: "Goiás", sigla: "GO", regiao: "Centro-Oeste", aliqInterna: 19, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 15, difalIndustrializado: 12 },
  MA: { estado: "Maranhão", sigla: "MA", regiao: "Nordeste", aliqInterna: 23, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 19, difalIndustrializado: 16 },
  MG: { estado: "Minas Gerais", sigla: "MG", regiao: "Sudeste", aliqInterna: 18, interestadualImportado: 0, interestadualIndustrializado: 0, difalImportado: 0, difalIndustrializado: 0 },
  MS: { estado: "Mato Grosso do Sul", sigla: "MS", regiao: "Centro-Oeste", aliqInterna: 17, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 13, difalIndustrializado: 10 },
  MT: { estado: "Mato Grosso", sigla: "MT", regiao: "Centro-Oeste", aliqInterna: 17, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 13, difalIndustrializado: 10 },
  PA: { estado: "Pará", sigla: "PA", regiao: "Norte", aliqInterna: 19, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 15, difalIndustrializado: 12 },
  PB: { estado: "Paraíba", sigla: "PB", regiao: "Nordeste", aliqInterna: 20, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 16.5, difalIndustrializado: 13.5 },
  PE: { estado: "Pernambuco", sigla: "PE", regiao: "Nordeste", aliqInterna: 20.5, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 18.5, difalIndustrializado: 15.5 },
  PI: { estado: "Piauí", sigla: "PI", regiao: "Nordeste", aliqInterna: 22.5, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 18.5, difalIndustrializado: 15.5 },
  PR: { estado: "Paraná", sigla: "PR", regiao: "Sul", aliqInterna: 19.5, interestadualImportado: 4, interestadualIndustrializado: 12, difalImportado: 15.5, difalIndustrializado: 7.5 },
  RJ: { estado: "Rio de Janeiro", sigla: "RJ", regiao: "Sudeste", aliqInterna: 20, interestadualImportado: 4, interestadualIndustrializado: 12, difalImportado: 16, difalIndustrializado: 8 },
  RN: { estado: "Rio Grande do Norte", sigla: "RN", regiao: "Nordeste", aliqInterna: 20, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 16, difalIndustrializado: 13 },
  RO: { estado: "Rondônia", sigla: "RO", regiao: "Norte", aliqInterna: 19.5, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 15.5, difalIndustrializado: 12.5 },
  RR: { estado: "Roraima", sigla: "RR", regiao: "Norte", aliqInterna: 20, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 16, difalIndustrializado: 13 },
  RS: { estado: "Rio Grande do Sul", sigla: "RS", regiao: "Sul", aliqInterna: 17, interestadualImportado: 4, interestadualIndustrializado: 12, difalImportado: 13, difalIndustrializado: 5 },
  SC: { estado: "Santa Catarina", sigla: "SC", regiao: "Sul", aliqInterna: 17, interestadualImportado: 4, interestadualIndustrializado: 12, difalImportado: 13, difalIndustrializado: 5 },
  SE: { estado: "Sergipe", sigla: "SE", regiao: "Nordeste", aliqInterna: 19, interestadualImportado: 4, interestadualIndustrializado: 12, difalImportado: 14, difalIndustrializado: 12 },
  SP: { estado: "São Paulo", sigla: "SP", regiao: "Sudeste", aliqInterna: 18, interestadualImportado: 4, interestadualIndustrializado: 12, difalImportado: 14, difalIndustrializado: 6 },
  TO: { estado: "Tocantins", sigla: "TO", regiao: "Norte", aliqInterna: 20, interestadualImportado: 4, interestadualIndustrializado: 7, difalImportado: 16, difalIndustrializado: 13 },
};

/**
 * Determina se o Grupo Fox paga o DIFAL
 * @param inscricaoEstadual - IE do cliente (null/undefined/"ISENTO" = sem IE)
 * @param cnpjCpf - CNPJ ou CPF do cliente
 * @returns true se nós pagamos o DIFAL
 */
export function grupoFoxPagaDifal(inscricaoEstadual: string | null | undefined, cnpjCpf: string | null | undefined): boolean {
  // Se é CPF (11 dígitos), nós pagamos
  const cleanDoc = (cnpjCpf || "").replace(/\D/g, "");
  if (cleanDoc.length === 11) return true;
  
  // Se não tem IE ou é ISENTO, nós pagamos
  if (!inscricaoEstadual || inscricaoEstadual.trim() === "" || inscricaoEstadual.toUpperCase() === "ISENTO") {
    return true;
  }
  
  return false;
}

/**
 * Calcula o valor do DIFAL para um pedido
 * @param ufDestino - UF do estado de destino (endereço de entrega)
 * @param valorPedido - Valor total do pedido
 * @param isImportado - true se produto importado (bambu/fibra), false se industrializado (madeira)
 * @returns { percentual, valor } ou null se MG (operação interna)
 */
export function calcularDifal(
  ufDestino: string,
  valorPedido: number,
  isImportado: boolean
): { percentual: number; valor: number } | null {
  const uf = (ufDestino || "").toUpperCase().trim();
  const rate = DIFAL_RATES[uf];
  
  if (!rate || uf === "MG") return null; // Operação interna em MG, sem DIFAL
  
  const percentual = isImportado ? rate.difalImportado : rate.difalIndustrializado;
  const valor = (valorPedido * percentual) / 100;
  
  return { percentual, valor };
}
