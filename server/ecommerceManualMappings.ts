/**
 * Manual PC→CX mappings for E-commerce transfers (Importação only).
 * These mappings were taught by the business owner product-by-product.
 *
 * RULE: The E-commerce history on the Importação stock tab should ONLY show
 * products from Grupo 12 (Importação). Products from Madeira should be excluded.
 *
 * RULE: When a sales order has estadoConfiguravel = "E-COMMERCE" and the client
 * is the filial (PALITOS E-COMMERCE / PALITOS INDUSTRIA E COMERCIO LTDA),
 * it's a transfer order (not revenue-generating).
 *
 * RULE: While the order is NOT faturado, show a warning card on the stock page.
 * When faturado, remove the card and move data to the "Histórico E-commerce" dialog.
 */

/**
 * Products that are already in CX (no conversion needed).
 * These are launched directly in boxes in the transfer order.
 */
export const CX_DIRECT_PRODUCTS: Record<string, { descricao: string }> = {
  "00007B": { descricao: "ESPETO DE BAMBU 4,0 X 250 MM C/ 125 X 40 UNID. - BAMBUSA" },
  "00009":  { descricao: "ESPETO DE BAMBU 4,0 X 250 MM C/ 5 X 1.000 UNID." },
  "00033":  { descricao: "PALITO DE DENTE BAMBU EMBALADO INDIVIDUALMENTE C/ 50 X 1.000 UNID." },
  "00032":  { descricao: "PALITO DE DENTE BAMBU C/ 20 X 25 X 100 UNID." },
  "00054":  { descricao: "PALITO HASHI DE BAMBU 20 CM C/ 20 X 100 UNID." },
};

/**
 * Manual mappings for PC→CX conversion.
 * childCode → { parentCode, parentDescricao, unPerPc, unPerCxParent }
 *
 * Formula: caixas = (qtdPacotes × unPerPc) / unPerCxParent
 *
 * Example: 00470 → 1000 PC × 100 un/PC = 100.000 un / 10.000 un/CX = 10 CX
 */
export const PC_TO_CX_MAPPINGS: Record<string, {
  parentCode: string;
  parentDescricao: string;
  unPerPc: number;
  unPerCxParent: number;
}> = {
  // Palito de Manicure Duas Pontas Bambu 4,0x125mm
  "00470": {
    parentCode: "00036",
    parentDescricao: "PALITO DE MANICURE DUAS PONTAS BAMBU 4,0 X 125MM C/ 10.000 UNID.",
    unPerPc: 100,
    unPerCxParent: 10000,
  },
  "00471": {
    parentCode: "00036",
    parentDescricao: "PALITO DE MANICURE DUAS PONTAS BAMBU 4,0 X 125MM C/ 10.000 UNID.",
    unPerPc: 500,
    unPerCxParent: 10000,
  },

  // Palito de Manicure Ponta/Chanfro Bambu 4,0x125mm
  "00472": {
    parentCode: "00046",
    parentDescricao: "PALITO DE MANICURE PONTA/CHANFRO BAMBU 4,0 X 125 MM C/ 10.000 UNID.",
    unPerPc: 100,
    unPerCxParent: 10000,
  },
  "00473": {
    parentCode: "00046",
    parentDescricao: "PALITO DE MANICURE PONTA/CHANFRO BAMBU 4,0 X 125 MM C/ 10.000 UNID.",
    unPerPc: 500,
    unPerCxParent: 10000,
  },

  // Palito de Manicure Duas Pontas Bambu 5,0x140mm
  "00474": {
    parentCode: "00037",
    parentDescricao: "PALITO DE MANICURE DUAS PONTAS BAMBU 5,0 X 140 MM C/ 10.000 UNID.",
    unPerPc: 50,
    unPerCxParent: 10000,
  },
  "00475": {
    parentCode: "00037",
    parentDescricao: "PALITO DE MANICURE DUAS PONTAS BAMBU 5,0 X 140 MM C/ 10.000 UNID.",
    unPerPc: 250,
    unPerCxParent: 10000,
  },

  // Palito de Manicure Ponta/Chanfro Bambu 5,0x140mm
  "00476": {
    parentCode: "00051",
    parentDescricao: "PALITO DE MANICURE PONTA/CHANFRO BAMBU 5,0 X 140 MM C/ 10.000 UNID.",
    unPerPc: 50,
    unPerCxParent: 10000,
  },
  "00477": {
    parentCode: "00051",
    parentDescricao: "PALITO DE MANICURE PONTA/CHANFRO BAMBU 5,0 X 140 MM C/ 10.000 UNID.",
    unPerPc: 250,
    unPerCxParent: 10000,
  },

  // Palito de Manicure Duas Pontas Bambu 5,0x160mm
  "00478": {
    parentCode: "00040",
    parentDescricao: "PALITO DE MANICURE DUAS PONTAS BAMBU 5,0 X 160 MM C/ 10.000 UNID.",
    unPerPc: 50,
    unPerCxParent: 10000,
  },
  "00479": {
    parentCode: "00040",
    parentDescricao: "PALITO DE MANICURE DUAS PONTAS BAMBU 5,0 X 160 MM C/ 10.000 UNID.",
    unPerPc: 250,
    unPerCxParent: 10000,
  },

  // Vareta Aromatizador Fibra 3,0x200mm (pai tem 20.000 un/CX)
  "00484": {
    parentCode: "00110",
    parentDescricao: "VARETA DE FIBRA PARA AROMATIZADOR DE 3,0 X 200 MM C/ 20.000 UNID. PRETA",
    unPerPc: 50,
    unPerCxParent: 20000,
  },
  "00485": {
    parentCode: "00110",
    parentDescricao: "VARETA DE FIBRA PARA AROMATIZADOR DE 3,0 X 200 MM C/ 20.000 UNID. PRETA",
    unPerPc: 200,
    unPerCxParent: 20000,
  },
};

/**
 * Client names that identify the E-commerce filial.
 * Orders with estadoConfiguravel = "E-COMMERCE" and these clients are transfers.
 */
export const ECOMMERCE_FILIAL_CLIENTS = [
  "PALITOS E-COMMERCE",
  "PALITOS INDUSTRIA E COMERCIO LTDA",
  "PALITOS INDUSTRIA E COMÉRCIO LTDA",
];

/**
 * Convert a PC item to CX using manual mappings.
 * Returns the number of boxes, or null if no mapping exists.
 */
export function convertPcToCx(
  codigoItem: string,
  qtdPacotes: number
): { caixas: number; parentCode: string; parentDescricao: string } | null {
  const mapping = PC_TO_CX_MAPPINGS[codigoItem];
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
 * Check if a product code is a direct CX product (no conversion needed).
 */
export function isDirectCxProduct(codigoItem: string): boolean {
  return codigoItem in CX_DIRECT_PRODUCTS;
}

/**
 * Check if a product code is a known PC variant that needs conversion.
 */
export function isPcVariant(codigoItem: string): boolean {
  return codigoItem in PC_TO_CX_MAPPINGS;
}

/**
 * Get all known import product codes (both CX direct and PC variants).
 */
export function getAllImportEcommerceProductCodes(): string[] {
  return [
    ...Object.keys(CX_DIRECT_PRODUCTS),
    ...Object.keys(PC_TO_CX_MAPPINGS),
  ];
}
