/**
 * Manual CX mappings for E-commerce transfers (Industrialização/Madeira).
 * These mappings will be taught by the business owner product-by-product.
 *
 * RULE: The E-commerce history on the Madeira stock tab should ONLY show
 * products from Industrialização (Madeira). Products from Importação should be excluded.
 *
 * RULE: When a sales order has estadoConfiguravel = "E-COMMERCE" and the client
 * is the filial (PALITOS E-COMMERCE / PALITOS INDUSTRIA E COMERCIO LTDA),
 * it's a transfer order (not revenue-generating).
 */

/**
 * Products that are already in CX (no conversion needed).
 * These are launched directly in boxes in the transfer order.
 * 
 * TODO: Owner will provide the list of madeira products sold to E-commerce
 */
export const MADEIRA_CX_DIRECT_PRODUCTS: Record<string, { descricao: string }> = {
  // Will be populated when owner provides the product list
};

/**
 * Manual mappings for PC→CX conversion (Madeira products).
 * childCode → { parentCode, parentDescricao, unPerPc, unPerCxParent }
 *
 * Formula: caixas = (qtdPacotes × unPerPc) / unPerCxParent
 * 
 * TODO: Owner will provide the conversion mappings
 */
export const MADEIRA_PC_TO_CX_MAPPINGS: Record<string, {
  parentCode: string;
  parentDescricao: string;
  unPerPc: number;
  unPerCxParent: number;
}> = {
  // Will be populated when owner provides the conversion mappings
};

/**
 * Convert a PC item to CX using manual mappings (Madeira).
 */
export function convertMadeiraPcToCx(
  codigoItem: string,
  qtdPacotes: number
): { caixas: number; parentCode: string; parentDescricao: string } | null {
  const mapping = MADEIRA_PC_TO_CX_MAPPINGS[codigoItem];
  if (!mapping) return null;

  const totalUnidades = qtdPacotes * mapping.unPerPc;
  const caixas = totalUnidades / mapping.unPerCxParent;

  return {
    caixas,
    parentCode: mapping.parentCode,
    parentDescricao: mapping.parentDescricao,
  };
}

/**
 * Check if a product code is a direct CX madeira product.
 */
export function isMadeiraDirectCxProduct(codigoItem: string): boolean {
  return codigoItem in MADEIRA_CX_DIRECT_PRODUCTS;
}

/**
 * Check if a product code is a known PC variant for madeira.
 */
export function isMadeiraPcVariant(codigoItem: string): boolean {
  return codigoItem in MADEIRA_PC_TO_CX_MAPPINGS;
}

/**
 * Get all known madeira product codes (both CX direct and PC variants).
 */
export function getAllMadeiraEcommerceProductCodes(): string[] {
  return [
    ...Object.keys(MADEIRA_CX_DIRECT_PRODUCTS),
    ...Object.keys(MADEIRA_PC_TO_CX_MAPPINGS),
  ];
}

/**
 * Check if a product is a known madeira e-commerce product.
 */
export function isMadeiraEcommerceProduct(codigoItem: string): boolean {
  return isMadeiraDirectCxProduct(codigoItem) || isMadeiraPcVariant(codigoItem);
}
