/**
 * Classificação de grupos de pedidos de venda.
 * 
 * FONTE ÚNICA DE VERDADE para classificação de pedidos nos 3 grupos:
 * - Prod. Importados (Revenda): BAMBU, FIBRA
 * - Industrializados: MADEIRA, MADEIRA CONTABILIZADO
 * - Import. Matéria-Prima: MADEIRA IMPORTAÇÃO, MADEIRA IMPORTACAO, MADEIRA IMPORTADA
 * 
 * Para pedidos AMOSTRA/BONIFICAÇÃO, o grupo é inferido pelos itens do pedido (grupoDescricao):
 * - ESPETO, VARETA → Revenda (importados)
 * - PALITO → Industrializados
 * 
 * TODAS as abas (Vendas, Faturamento, Estoque, Financeiro) DEVEM usar estas funções.
 * NUNCA duplique esta lógica em outros arquivos.
 */

export type GrupoKey = "importacao_revenda" | "industrializacao" | "importacao_mp" | "ecommerce" | "outros";
export type SubgrupoKey = "bambu" | "fibra" | "madeira" | "madeira_importada" | "outros";

/**
 * Mapeia o campo estadoConfiguravel para o grupo do pedido.
 * Regra de negócio central - NÃO altere sem autorização.
 */
export function estadoToGrupo(estado: string | null): GrupoKey {
  if (!estado) return "outros";
  const e = estado.toUpperCase();
  if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
  if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
  if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
  if (e === "E-COMMERCE") return "ecommerce";
  return "outros";
}

/**
 * Mapeia o campo estadoConfiguravel para o subgrupo do pedido.
 */
export function estadoToSubgrupo(estado: string | null): SubgrupoKey {
  if (!estado) return "outros";
  const e = estado.toUpperCase();
  if (e === "BAMBU") return "bambu";
  if (e === "FIBRA") return "fibra";
  if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "madeira";
  if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "madeira_importada";
  return "outros";
}

/**
 * Labels para exibição dos grupos no frontend.
 */
export const GRUPO_LABELS: Record<GrupoKey, string> = {
  importacao_revenda: "Prod. Importados (Revenda)",
  industrializacao: "Industrializados",
  importacao_mp: "Import. Matéria-Prima",
  ecommerce: "E-commerce",
  outros: "Outros",
};

/**
 * Labels curtos para uso em labels combinados (Amostra / Revenda, Bonificação / Industr.)
 */
export const GRUPO_LABELS_SHORT: Record<GrupoKey, string> = {
  importacao_revenda: "Revenda",
  industrializacao: "Industr.",
  importacao_mp: "Matéria-Prima",
  ecommerce: "E-commerce",
  outros: "Outros",
};

/**
 * Labels para exibição dos subgrupos no frontend.
 */
export const SUBGRUPO_LABELS: Record<SubgrupoKey, string> = {
  bambu: "Bambu",
  fibra: "Fibra",
  madeira: "Madeira",
  madeira_importada: "Madeira Importada",
  outros: "Outros",
};

/**
 * Infere o grupo do pedido a partir dos grupoDescricao dos itens.
 * Usado para pedidos AMOSTRA/BONIFICAÇÃO onde o estadoConfiguravel não indica o grupo.
 * 
 * Regras:
 * - ESPETO, VARETA → importacao_revenda (produtos importados)
 * - PALITO → industrializacao (produtos industrializados)
 * - Mix → usa o grupo predominante (mais itens)
 * - Sem grupoDescricao → outros
 */
export function inferGrupoFromItems(grupoDescricoes: (string | null)[]): GrupoKey {
  if (!grupoDescricoes || grupoDescricoes.length === 0) return "outros";
  
  let revendaCount = 0;
  let industrializacaoCount = 0;
  let materiaPrimaCount = 0;
  
  for (const gd of grupoDescricoes) {
    if (!gd) continue;
    const g = gd.toUpperCase().trim();
    if (g === "ESPETO" || g === "VARETA") {
      revendaCount++;
    } else if (g === "PALITO") {
      industrializacaoCount++;
    }
    // Matéria-prima items would be rare in AMOSTRA/BONIFICAÇÃO but handle anyway
  }
  
  // Return the predominant group
  if (revendaCount >= industrializacaoCount && revendaCount > 0) return "importacao_revenda";
  if (industrializacaoCount > 0) return "industrializacao";
  
  // If no recognized items, default to outros
  return "outros";
}

/**
 * Gera o label combinado para pedidos AMOSTRA/BONIFICAÇÃO.
 * Ex: "Bonificação / Revenda", "Amostra / Industr.", "Amostra / Matéria-Prima"
 * 
 * @param tipoEspecial - "AMOSTRA" ou "BONIFICACAO"
 * @param grupoKey - grupo inferido dos itens do pedido
 * @returns Label combinado para exibição
 */
export function getAmostraBonificacaoLabel(
  tipoEspecial: TipoEspecialPedido,
  grupoKey: GrupoKey,
): string {
  const tipoLabel = tipoEspecial === "BONIFICACAO" ? "Bonificação" : tipoEspecial === "AMOSTRA" ? "Amostra" : "Amostra/Bonif.";
  const grupoShort = GRUPO_LABELS_SHORT[grupoKey] || "Outros";
  return `${tipoLabel} / ${grupoShort}`;
}

/**
 * Verifica se um pedido é classificado como "outros" (deve ser excluído).
 * Itens "outros" incluem: CANCELADO, GILSON, NULL, etc.
 * NOTA: AMOSTRA/BONIFICAÇÃO NÃO são "outros" — são pedidos especiais que devem aparecer.
 */
export function isOutros(estado: string | null): boolean {
  if (!estado) return true;
  // AMOSTRA/BONIFICAÇÃO nunca devem ser considerados "outros"
  if (isAmostraBonificacao(estado)) return false;
  return estadoToGrupo(estado) === "outros";
}

/**
 * Verifica se o pedido está em digitação (não deve ser considerado).
 */
export function isDigitacao(estadoNota: string | null): boolean {
  if (!estadoNota) return false;
  const e = estadoNota.toUpperCase();
  return e === "DIGITAÇÃO" || e === "DIGITACAO" || e === "DIGITAÇÃO";
}

/**
 * Verifica se o pedido está aprovado.
 * REGRA DE NEGÓCIO: Na aba Faturamento, APENAS pedidos aprovados devem aparecer.
 * Pedidos "A aprovar" e "Digitação" NÃO devem aparecer.
 * 
 * Valores aceitos como aprovado: "Aprovado", "APROVADO", "aprovado"
 * Também aceita: "Faturado", "Faturado c/ entrega futura" (pedidos já faturados)
 */
export function isAprovadoOuFaturado(estadoNota: string | null): boolean {
  if (!estadoNota) return false;
  const e = estadoNota.toUpperCase();
  return e === "APROVADO" || e === "FATURADO" || e.startsWith("FATURADO ");
}

/**
 * Tipo especial do pedido baseado em heurística inteligente.
 * Usado para exibir badges visuais na aba Faturamento.
 * 
 * O Maxiprod agrupa AMOSTRA e BONIFICAÇÃO no mesmo estadoConfiguravel = "AMOSTRA/BONIFICAÇÃO".
 * Para distinguir, usamos heurística baseada em:
 * 1. Observações do pedido (se contém "bonificação" → BONIFICAÇÃO, se contém "amostra" → AMOSTRA)
 * 2. Valor total do pedido (valor <= R$ 100 → AMOSTRA, valor > R$ 100 sem indicação → PEDIDO NORMAL)
 * 
 * - AMOSTRA: pedidos de amostra grátis com valor simbólico (badge amarelo)
 * - BONIFICAÇÃO: pedidos de bonificação identificados nas observações (badge roxo)
 * - null: pedido normal / complemento / venda real (sem badge especial)
 */
export type TipoEspecialPedido = "AMOSTRA" | "BONIFICACAO" | null;

/**
 * Verifica se o estadoConfiguravel indica AMOSTRA/BONIFICAÇÃO no Maxiprod.
 */
export function isAmostraBonificacao(estadoConfiguravel: string | null): boolean {
  if (!estadoConfiguravel) return false;
  const e = estadoConfiguravel.toUpperCase();
  return e.includes("AMOSTRA") || e.includes("BONIFICA");
}

/**
 * Classifica o tipo especial do pedido usando heurística inteligente.
 * 
 * @param estadoConfiguravel - Campo do Maxiprod (ex: "AMOSTRA/BONIFICAÇÃO", "BAMBU", etc.)
 * @param observacoes - Observações do pedido (texto livre do comercial)
 * @param valorTotalPedido - Valor total do pedido em reais
 * 
 * Regras (em ordem de prioridade):
 * 1. Se estadoConfiguravel NÃO contém "AMOSTRA" nem "BONIFICA" → null (pedido normal)
 * 2. Se estadoConfiguravel é exatamente "BONIFICAÇÃO" → BONIFICAÇÃO
 * 3. Se estadoConfiguravel é exatamente "AMOSTRA" → AMOSTRA
 * 4. Se observações contém "bonificação"/"bonificada"/"bonificado" → BONIFICAÇÃO
 * 5. Se observações contém "amostra" → AMOSTRA
 * 6. Se valor total <= R$ 100 → AMOSTRA (valor simbólico)
 * 7. Se valor > R$ 100 sem indicação clara → AMOSTRA (default para AMOSTRA/BONIF)
 */
export function getTipoEspecial(
  estadoConfiguravel: string | null,
  observacoes?: string | null,
  valorTotalPedido?: number | null,
): TipoEspecialPedido {
  // Só classifica se o Maxiprod marcou como AMOSTRA/BONIFICAÇÃO
  if (!isAmostraBonificacao(estadoConfiguravel)) return null;

  // 0. Se o estadoConfiguravel é exatamente "BONIFICAÇÃO" ou "AMOSTRA", usar diretamente
  if (estadoConfiguravel) {
    const ec = estadoConfiguravel.toUpperCase().trim();
    if (ec === "BONIFICAÇÃO" || ec === "BONIFICACAO") return "BONIFICACAO";
    if (ec === "AMOSTRA") return "AMOSTRA";
  }

  // 1. Observações são a fonte mais confiável
  if (observacoes) {
    const obs = observacoes.toUpperCase();
    if (obs.includes("BONIFICA")) return "BONIFICACAO";
    if (obs.includes("AMOSTRA")) return "AMOSTRA";
  }

  // 2. Valor simbólico indica amostra (R$ 5, R$ 10, R$ 20, R$ 30)
  if (valorTotalPedido != null && valorTotalPedido <= 100) return "AMOSTRA";

  // 3. Default: se caiu aqui é AMOSTRA/BONIF sem indicação clara → AMOSTRA
  return "AMOSTRA";
}
