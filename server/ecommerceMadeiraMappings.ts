/**
 * Manual CX mappings for E-commerce transfers (Industrialização/Madeira).
 * These mappings were taught by the business owner product-by-product.
 *
 * RULE: The E-commerce history on the Madeira stock tab should ONLY show
 * products from Industrialização (Madeira). Products from Importação should be excluded.
 *
 * RULE: When a sales order has estadoConfiguravel = "E-COMMERCE" and the client
 * is the filial (PALITOS E-COMMERCE / PALITOS INDUSTRIA E COMERCIO LTDA),
 * it's a transfer order (not revenue-generating).
 *
 * Conversion rules (all products have 10.000 unidades por caixa):
 *
 * Regular products (sem Flow Pack):
 *   caixas = (qtdPacotes × unidadesPorPacote) / 10.000
 *   Ex: 00487 → 1000 PC × 100 un/PC = 100.000 / 10.000 = 10 cx
 *
 * Flow Pack products (contém "FLOW PACK" no nome):
 *   caixas = (qtdPacotes × varetasPorFlowPack × flowPacksPorPacote) / 10.000
 *   Ex: 00488 → 1000 PC × (6 × 50) = 300.000 / 10.000 = 30 cx
 *   (6 varetas por flow pack × 50 flow packs por pacote = 300 varetas por pacote)
 */

/**
 * Products that are already in CX (no conversion needed).
 * These are launched directly in boxes in the transfer order.
 */
export const MADEIRA_CX_DIRECT_PRODUCTS: Record<string, { descricao: string }> = {
  // Currently no madeira products are sold directly in CX to E-commerce
};

/**
 * Manual mappings for PC→CX conversion (Madeira products).
 * childCode → { parentCode, parentDescricao, unPerPc, unPerCxParent }
 *
 * Formula: caixas = (qtdPacotes × unPerPc) / unPerCxParent
 *
 * For regular products: unPerPc = units per pack
 * For Flow Pack products: unPerPc = varetas_per_flowpack × flowpacks_per_pack
 *   (e.g. 6 varetas × 50 flowpacks = 300 unPerPc)
 */
export const MADEIRA_PC_TO_CX_MAPPINGS: Record<string, {
  parentCode: string;
  parentDescricao: string;
  unPerPc: number;
  unPerCxParent: number;
}> = {
  // Vareta Aromatizador 4,0 x 125mm (sem flow pack)
  // 1000 PC × 100 un = 100.000 / 10.000 = 10 cx
  "00487": {
    parentCode: "00487",
    parentDescricao: "VARETA AROMATIZADOR 4,0 X 125 MM C/ 100 UNID.",
    unPerPc: 100,
    unPerCxParent: 10000,
  },

  // Vareta Aromatizador 4,0 x 180mm KIT COM 6 FLOW PACK C/ 50 UNID.
  // 1000 PC × (6 × 50) = 300.000 / 10.000 = 30 cx
  "00488": {
    parentCode: "00488",
    parentDescricao: "VARETA AROMATIZADOR 4,0 X 180 MM KIT COM 6 FLOW PACK C/ 50 UNID.",
    unPerPc: 300,
    unPerCxParent: 10000,
  },

  // Vareta Aromatizador 4,0 x 180mm KIT COM 6 FLOW PACK C/ 200 UNID.
  // 1000 PC × (6 × 200) = 1.200.000 / 10.000 = 120 cx
  "00489": {
    parentCode: "00489",
    parentDescricao: "VARETA AROMATIZADOR 4,0 X 180 MM KIT COM 6 FLOW PACK C/ 200 UNID.",
    unPerPc: 1200,
    unPerCxParent: 10000,
  },

  // Vareta Aromatizador 4,0 x 200mm KIT COM 6 FLOW PACK C/ 50 UNID.
  // 1000 PC × (6 × 50) = 300.000 / 10.000 = 30 cx
  "00490": {
    parentCode: "00490",
    parentDescricao: "VARETA AROMATIZADOR 4,0 X 200 MM KIT COM 6 FLOW PACK C/ 50 UNID.",
    unPerPc: 300,
    unPerCxParent: 10000,
  },

  // Vareta Aromatizador 4,0 x 200mm KIT COM 6 FLOW PACK C/ 200 UNID.
  // 1000 PC × (6 × 200) = 1.200.000 / 10.000 = 120 cx
  "00491": {
    parentCode: "00491",
    parentDescricao: "VARETA AROMATIZADOR 4,0 X 200 MM KIT COM 6 FLOW PACK C/ 200 UNID.",
    unPerPc: 1200,
    unPerCxParent: 10000,
  },

  // Vareta Aromatizador 4,0 x 220mm KIT COM 6 FLOW PACK C/ 50 UNID.
  // 1000 PC × (6 × 50) = 300.000 / 10.000 = 30 cx
  "00492": {
    parentCode: "00492",
    parentDescricao: "VARETA AROMATIZADOR 4,0 X 220 MM KIT COM 6 FLOW PACK C/ 50 UNID.",
    unPerPc: 300,
    unPerCxParent: 10000,
  },

  // Vareta Aromatizador 4,0 x 220mm KIT COM 6 FLOW PACK C/ 200 UNID.
  // 1000 PC × (6 × 200) = 1.200.000 / 10.000 = 120 cx
  "00493": {
    parentCode: "00493",
    parentDescricao: "VARETA AROMATIZADOR 4,0 X 220 MM KIT COM 6 FLOW PACK C/ 200 UNID.",
    unPerPc: 1200,
    unPerCxParent: 10000,
  },

  // Vareta Aromatizador 4,0 x 250mm KIT COM 6 FLOW PACK C/ 50 UNID.
  // 1000 PC × (6 × 50) = 300.000 / 10.000 = 30 cx
  "00494": {
    parentCode: "00494",
    parentDescricao: "VARETA AROMATIZADOR 4,0 X 250 MM KIT COM 6 FLOW PACK C/ 50 UNID.",
    unPerPc: 300,
    unPerCxParent: 10000,
  },

  // Vareta Aromatizador 4,0 x 250mm KIT COM 6 FLOW PACK C/ 200 UNID.
  // 1000 PC × (6 × 200) = 1.200.000 / 10.000 = 120 cx
  "00495": {
    parentCode: "00495",
    parentDescricao: "VARETA AROMATIZADOR 4,0 X 250 MM KIT COM 6 FLOW PACK C/ 200 UNID.",
    unPerPc: 1200,
    unPerCxParent: 10000,
  },

  // Vareta para Algodão Doce Madeira 4,0 x 350mm C/ 300 UNID.
  // 500 PC × 300 un = 150.000 / 10.000 = 15 cx
  "00482": {
    parentCode: "00482",
    parentDescricao: "VARETA PARA ALGODÃO DOCE MADEIRA 4,0 X 350 MM C/ 300 UNID.",
    unPerPc: 300,
    unPerCxParent: 10000,
  },

  // Vareta para Algodão Doce Madeira 4,0 x 350mm C/ 100 UNID.
  // 500 PC × 100 un = 50.000 / 10.000 = 5 cx
  "00483": {
    parentCode: "00483",
    parentDescricao: "VARETA PARA ALGODÃO DOCE MADEIRA 4,0 X 350 MM C/ 100 UNID.",
    unPerPc: 100,
    unPerCxParent: 10000,
  },

  // Vareta Aromatizador 4,0 x 250mm C/ 50 UNID. (sem flow pack)
  // 1000 PC × 50 un = 50.000 / 10.000 = 5 cx
  "00501": {
    parentCode: "00501",
    parentDescricao: "VARETA AROMATIZADOR 4,0 X 250 MM C/ 50 UNID.",
    unPerPc: 50,
    unPerCxParent: 10000,
  },
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
