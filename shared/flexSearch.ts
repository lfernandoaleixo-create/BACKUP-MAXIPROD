/**
 * Utilitário de busca flexível para todas as barras de pesquisa do sistema.
 * Remove acentos, pontos, traços, espaços extras e faz busca parcial em qualquer posição.
 * Exemplo: "rio" encontra "Beta Rio", "G.Atacado" encontra "G. Atacado"
 */

/**
 * Normaliza texto para busca: remove acentos, converte para minúsculas,
 * remove pontuação e espaços extras
 */
export function normalizeForSearch(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[.\-\/\\,;:!?'"()[\]{}]/g, "") // remove pontuação
    .replace(/\s+/g, " ") // normaliza espaços
    .trim();
}

/**
 * Verifica se o texto contém o termo de busca de forma flexível.
 * Busca parcial em qualquer posição, ignorando acentos, pontos e espaços.
 */
export function flexMatch(text: string, searchTerm: string): boolean {
  if (!searchTerm) return true;
  if (!text) return false;
  
  const normalizedText = normalizeForSearch(text);
  const normalizedSearch = normalizeForSearch(searchTerm);
  
  // Busca direta (parcial em qualquer posição)
  if (normalizedText.includes(normalizedSearch)) return true;
  
  // Busca por palavras individuais do termo (todas devem estar presentes)
  const searchWords = normalizedSearch.split(" ").filter(w => w.length > 0);
  if (searchWords.length > 1) {
    return searchWords.every(word => normalizedText.includes(word));
  }
  
  // Busca sem espaços (para quando o usuário digita junto)
  const textNoSpaces = normalizedText.replace(/\s/g, "");
  const searchNoSpaces = normalizedSearch.replace(/\s/g, "");
  if (textNoSpaces.includes(searchNoSpaces)) return true;
  
  return false;
}

/**
 * Busca flexível em múltiplos campos de um objeto.
 * Retorna true se qualquer um dos campos contiver o termo de busca.
 */
export function flexMatchMultiple(fields: (string | undefined | null)[], searchTerm: string): boolean {
  if (!searchTerm) return true;
  const normalizedSearch = normalizeForSearch(searchTerm);
  if (!normalizedSearch) return true;
  
  // Concatena todos os campos em um único texto para busca
  const combined = fields.filter(Boolean).join(" ");
  return flexMatch(combined, searchTerm);
}
