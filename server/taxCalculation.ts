/**
 * Tax Calculation Engine — Grupo Fox
 * 
 * Calculates all applicable taxes for a sales order based on:
 * - Product type (importado vs industrializado)
 * - Destination (MG internal vs interestadual)
 * - Client type (contribuinte vs não contribuinte)
 * - Quarterly revenue (for IRPJ calculation)
 */

// ===== ALÍQUOTAS INTERNAS POR ESTADO (diagonal tabela ICMS 2026) =====
export const ALIQUOTAS_INTERNAS: Record<string, number> = {
  AC: 19, AL: 20, AM: 20, AP: 18, BA: 20.5,
  CE: 20, DF: 20, ES: 17, GO: 19, MA: 23,
  MG: 18, MS: 17, MT: 17, PA: 19, PB: 20,
  PE: 20.5, PI: 22.5, PR: 19.5, RJ: 22, RN: 20,
  RO: 19.5, RR: 20, RS: 17, SC: 17, SE: 20,
  SP: 18, TO: 20,
};

// ===== TIPO DE CÁLCULO DIFAL POR ESTADO =====
export type DifAlCalcMethod = "simples" | "por_dentro" | "por_dentro_sem_descontar";

export const DIFAL_CALC_METHOD: Record<string, DifAlCalcMethod> = {
  AC: "simples", AL: "simples", AM: "simples", AP: "simples",
  BA: "simples", CE: "simples", DF: "simples", ES: "simples",
  GO: "por_dentro_sem_descontar", MA: "simples", MG: "por_dentro",
  MS: "simples", MT: "simples", PA: "simples", PB: "simples",
  PE: "simples", PI: "simples", PR: "por_dentro", RJ: "simples",
  RN: "simples", RO: "simples", RR: "simples", RS: "por_dentro",
  SC: "simples", SE: "simples", SP: "simples", TO: "simples",
};

// ===== TIPOS =====
export type TipoProduto = "importado" | "industrializado";
export type TipoContribuinte = "Contribuinte" | "Não contribuinte" | "Isento" | null;

export interface TaxInput {
  valorVenda: number;          // Valor total da venda (R$)
  ufDestino: string;           // UF do cliente
  tipoProduto: TipoProduto;    // Importado ou Industrializado
  tipoContribuinte: TipoContribuinte; // Contribuinte, Não contribuinte, Isento
  faturamentoTrimestral: number; // Faturamento do trimestre atual (R$) - para IRPJ
}

export interface TaxBreakdown {
  icmsEfetivo: number;         // % efetivo de ICMS
  icmsValor: number;           // R$ de ICMS
  pisEfetivo: number;          // % efetivo de PIS
  pisValor: number;            // R$ de PIS
  cofinsEfetiva: number;       // % efetiva de COFINS
  cofinsValor: number;         // R$ de COFINS
  irpjEfetivo: number;        // % efetivo de IRPJ
  irpjValor: number;          // R$ de IRPJ
  csllEfetiva: number;        // % efetiva de CSLL
  csllValor: number;          // R$ de CSLL
  difalEfetivo: number;       // % efetivo de DIFAL (0 se contribuinte ou interna MG)
  difalValor: number;         // R$ de DIFAL
  totalImpostosPerc: number;  // % total de impostos
  totalImpostosValor: number; // R$ total de impostos
  isInternaMG: boolean;       // Se é venda interna MG
  temDifal: boolean;          // Se tem DIFAL aplicado
}

export interface MarginInput {
  valorVenda: number;
  custoMercadoria: number;     // Custo total da mercadoria (R$)
  frete: number;               // Valor do frete (R$)
  comissao: number;            // Valor da comissão (R$)
  impostos: TaxBreakdown;      // Breakdown de impostos
}

export interface MarginResult {
  valorVenda: number;
  custoMercadoria: number;
  frete: number;
  comissao: number;
  totalImpostos: number;
  lucroLiquido: number;
  margemPercentual: number;    // % de margem sobre a venda
}

// ===== CÁLCULOS =====

/**
 * Calcula o ICMS efetivo baseado no tipo de produto e destino
 */
function calcularICMS(tipoProduto: TipoProduto, isInternaMG: boolean): number {
  if (tipoProduto === "importado") {
    return isInternaMG ? 14.0 : 1.5;
  } else {
    // Industrializado
    return isInternaMG ? 18.0 : 12.0;
  }
}

/**
 * Calcula PIS efetivo
 */
function calcularPIS(isInternaMG: boolean): number {
  return isInternaMG ? 0.533 : 0.572;
}

/**
 * Calcula COFINS efetiva
 */
function calcularCOFINS(isInternaMG: boolean): number {
  return isInternaMG ? 2.46 : 2.64;
}

/**
 * Calcula IRPJ baseado no faturamento trimestral
 * Base: presunção de 8% sobre receita bruta → 15% de IRPJ = 1,20%
 * Adicional: se base > R$ 60.000/trimestre (equivale a faturamento > R$ 750.000)
 * Na prática: se faturamento > R$ 1.250.000/trimestre → alíquota entre 1,20% e 2,28%
 */
function calcularIRPJ(faturamentoTrimestral: number): number {
  const basePresuncao = faturamentoTrimestral * 0.08; // 8% presunção
  const irpjBase = basePresuncao * 0.15; // 15% sobre a base
  
  // Adicional de 10% sobre excesso de R$ 60.000 no trimestre
  let irpjAdicional = 0;
  if (basePresuncao > 60000) {
    irpjAdicional = (basePresuncao - 60000) * 0.10;
  }
  
  const totalIRPJ = irpjBase + irpjAdicional;
  // Retorna como % do faturamento
  if (faturamentoTrimestral === 0) return 1.20;
  const percentual = (totalIRPJ / faturamentoTrimestral) * 100;
  
  // Limitar entre 1,20% e 2,28%
  return Math.min(Math.max(percentual, 1.20), 2.28);
}

/**
 * CSLL fixa
 */
function calcularCSLL(): number {
  return 1.188;
}

/**
 * Calcula o DIFAL baseado no estado de destino e tipo de produto
 * Retorna a % efetiva do DIFAL sobre o valor da venda
 */
function calcularDIFAL(
  ufDestino: string,
  tipoProduto: TipoProduto,
  tipoContribuinte: TipoContribuinte,
  valorVenda: number
): { percentual: number; valor: number } {
  // DIFAL só se aplica para não contribuinte em vendas interestaduais
  if (
    tipoContribuinte === "Contribuinte" ||
    ufDestino === "MG" ||
    !ufDestino
  ) {
    return { percentual: 0, valor: 0 };
  }

  const aliquotaInterna = ALIQUOTAS_INTERNAS[ufDestino.toUpperCase()];
  if (!aliquotaInterna) return { percentual: 0, valor: 0 };

  // Alíquota interestadual
  const aliquotaInter = tipoProduto === "importado" ? 4 : 12;
  
  const metodo = DIFAL_CALC_METHOD[ufDestino.toUpperCase()] || "simples";

  let difalValor = 0;

  switch (metodo) {
    case "simples":
      // DIFAL = (Alíq interna - Alíq inter) × Valor
      difalValor = valorVenda * (aliquotaInterna - aliquotaInter) / 100;
      break;

    case "por_dentro":
      // Base = Valor / (1 - Alíq interna/100)
      // DIFAL = (Base × Alíq interna/100) - (Valor × Alíq inter/100)
      const basePorDentro = valorVenda / (1 - aliquotaInterna / 100);
      difalValor = (basePorDentro * aliquotaInterna / 100) - (valorVenda * aliquotaInter / 100);
      break;

    case "por_dentro_sem_descontar":
      // GO: Por dentro sem descontar ICMS interestadual
      // Base = Valor / (1 - Alíq interna/100)
      // DIFAL = Base × Alíq interna/100 - Valor × Alíq inter/100
      // (mesmo cálculo que por_dentro, mas a lógica pode diferir em edge cases)
      const baseGO = valorVenda / (1 - aliquotaInterna / 100);
      difalValor = (baseGO * aliquotaInterna / 100) - (valorVenda * aliquotaInter / 100);
      break;
  }

  const percentual = valorVenda > 0 ? (difalValor / valorVenda) * 100 : 0;

  return { percentual, valor: difalValor };
}

/**
 * Calcula todos os impostos para uma venda
 */
export function calcularImpostos(input: TaxInput): TaxBreakdown {
  const { valorVenda, ufDestino, tipoProduto, tipoContribuinte, faturamentoTrimestral } = input;
  
  const isInternaMG = !ufDestino || ufDestino.toUpperCase() === "MG";

  // ICMS
  const icmsEfetivo = calcularICMS(tipoProduto, isInternaMG);
  const icmsValor = valorVenda * icmsEfetivo / 100;

  // PIS
  const pisEfetivo = calcularPIS(isInternaMG);
  const pisValor = valorVenda * pisEfetivo / 100;

  // COFINS
  const cofinsEfetiva = calcularCOFINS(isInternaMG);
  const cofinsValor = valorVenda * cofinsEfetiva / 100;

  // IRPJ
  const irpjEfetivo = calcularIRPJ(faturamentoTrimestral);
  const irpjValor = valorVenda * irpjEfetivo / 100;

  // CSLL
  const csllEfetiva = calcularCSLL();
  const csllValor = valorVenda * csllEfetiva / 100;

  // DIFAL
  const difal = calcularDIFAL(ufDestino, tipoProduto, tipoContribuinte, valorVenda);
  const temDifal = difal.valor > 0;

  // Total
  const totalImpostosValor = icmsValor + pisValor + cofinsValor + irpjValor + csllValor + difal.valor;
  const totalImpostosPerc = valorVenda > 0 ? (totalImpostosValor / valorVenda) * 100 : 0;

  return {
    icmsEfetivo,
    icmsValor,
    pisEfetivo,
    pisValor,
    cofinsEfetiva,
    cofinsValor,
    irpjEfetivo,
    irpjValor,
    csllEfetiva,
    csllValor,
    difalEfetivo: difal.percentual,
    difalValor: difal.valor,
    totalImpostosPerc,
    totalImpostosValor,
    isInternaMG,
    temDifal,
  };
}

/**
 * Calcula a margem de lucro final
 */
export function calcularMargem(input: MarginInput): MarginResult {
  const { valorVenda, custoMercadoria, frete, comissao, impostos } = input;

  const lucroLiquido = valorVenda - custoMercadoria - frete - comissao - impostos.totalImpostosValor;
  const margemPercentual = valorVenda > 0 ? (lucroLiquido / valorVenda) * 100 : 0;

  return {
    valorVenda,
    custoMercadoria,
    frete,
    comissao,
    totalImpostos: impostos.totalImpostosValor,
    lucroLiquido,
    margemPercentual,
  };
}
