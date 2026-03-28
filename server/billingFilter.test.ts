import { describe, it, expect } from "vitest";
import { isAprovadoOuFaturado, getTipoEspecial, isAmostraBonificacao } from "../shared/grupoClassification";

/**
 * Tests for billing filter logic - ensuring ONLY approved/billed orders appear
 * in the Faturamento tab.
 * 
 * REGRA DE NEGÓCIO:
 * - Apenas pedidos com estadoNota "Aprovado" ou "Faturado" devem aparecer
 * - Pedidos "A aprovar" NÃO devem aparecer
 * - Pedidos "Digitação" NÃO devem aparecer
 * - Pedidos com estadoNota null NÃO devem aparecer (dados legados sem estado)
 */

// Simulate the filter logic from billingRouter (must match exactly)
function filterOpenItems(items: Array<{ estadoItem: string; estadoNota: string | null }>) {
  return items.filter(i =>
    (i.estadoItem === "A faturar" || i.estadoItem === "Faturado parcial") &&
    isAprovadoOuFaturado(i.estadoNota)
  );
}

function filterBilledItems(items: Array<{ estadoItem: string; estadoNota: string | null; dataEmissao: string | null }>) {
  return items.filter(i =>
    i.estadoItem === "Faturado" &&
    i.dataEmissao &&
    isAprovadoOuFaturado(i.estadoNota)
  );
}

describe("isAprovadoOuFaturado - helper function", () => {
  it("should return true for 'Aprovado'", () => {
    expect(isAprovadoOuFaturado("Aprovado")).toBe(true);
  });

  it("should return true for 'APROVADO' (uppercase)", () => {
    expect(isAprovadoOuFaturado("APROVADO")).toBe(true);
  });

  it("should return true for 'aprovado' (lowercase)", () => {
    expect(isAprovadoOuFaturado("aprovado")).toBe(true);
  });

  it("should return true for 'Faturado'", () => {
    expect(isAprovadoOuFaturado("Faturado")).toBe(true);
  });

  it("should return true for 'Faturado c/ entrega futura'", () => {
    expect(isAprovadoOuFaturado("Faturado c/ entrega futura")).toBe(true);
  });

  it("should return false for 'A aprovar'", () => {
    expect(isAprovadoOuFaturado("A aprovar")).toBe(false);
  });

  it("should return false for 'Digitação'", () => {
    expect(isAprovadoOuFaturado("Digitação")).toBe(false);
  });

  it("should return false for 'Digitacao'", () => {
    expect(isAprovadoOuFaturado("Digitacao")).toBe(false);
  });

  it("should return false for 'Cancelado'", () => {
    expect(isAprovadoOuFaturado("Cancelado")).toBe(false);
  });

  it("should return false for null", () => {
    expect(isAprovadoOuFaturado(null)).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isAprovadoOuFaturado("")).toBe(false);
  });
});

describe("Billing filter - only Aprovado orders in Faturamento", () => {
  it("should include 'A faturar' items with Aprovado status", () => {
    const items = [{ estadoItem: "A faturar", estadoNota: "Aprovado" }];
    expect(filterOpenItems(items)).toHaveLength(1);
  });

  it("should EXCLUDE 'A faturar' items with 'A aprovar' status", () => {
    const items = [{ estadoItem: "A faturar", estadoNota: "A aprovar" }];
    expect(filterOpenItems(items)).toHaveLength(0);
  });

  it("should EXCLUDE 'A faturar' items with 'Digitação' status", () => {
    const items = [{ estadoItem: "A faturar", estadoNota: "Digitação" }];
    expect(filterOpenItems(items)).toHaveLength(0);
  });

  it("should EXCLUDE items with 'Digitacao' (no accent)", () => {
    const items = [{ estadoItem: "A faturar", estadoNota: "Digitacao" }];
    expect(filterOpenItems(items)).toHaveLength(0);
  });

  it("should EXCLUDE items with 'DIGITACAO' (uppercase)", () => {
    const items = [{ estadoItem: "A faturar", estadoNota: "DIGITACAO" }];
    expect(filterOpenItems(items)).toHaveLength(0);
  });

  it("should include 'Faturado parcial' items with Aprovado status", () => {
    const items = [{ estadoItem: "Faturado parcial", estadoNota: "Aprovado" }];
    expect(filterOpenItems(items)).toHaveLength(1);
  });

  it("should EXCLUDE 'Faturado parcial' items with 'Digitação' status", () => {
    const items = [{ estadoItem: "Faturado parcial", estadoNota: "Digitação" }];
    expect(filterOpenItems(items)).toHaveLength(0);
  });

  it("should EXCLUDE 'Faturado parcial' items with 'A aprovar' status", () => {
    const items = [{ estadoItem: "Faturado parcial", estadoNota: "A aprovar" }];
    expect(filterOpenItems(items)).toHaveLength(0);
  });

  it("should exclude Faturado items from open filter (they go to billed)", () => {
    const items = [{ estadoItem: "Faturado", estadoNota: "Aprovado" }];
    expect(filterOpenItems(items)).toHaveLength(0);
  });

  it("should EXCLUDE items with null estadoNota (unknown status)", () => {
    const items = [{ estadoItem: "A faturar", estadoNota: null }];
    expect(filterOpenItems(items)).toHaveLength(0);
  });

  it("should EXCLUDE items with 'Cancelado' status", () => {
    const items = [{ estadoItem: "A faturar", estadoNota: "Cancelado" }];
    expect(filterOpenItems(items)).toHaveLength(0);
  });

  it("should correctly filter mixed list - only Aprovado passes", () => {
    const items = [
      { estadoItem: "A faturar", estadoNota: "Aprovado" },      // INCLUDE
      { estadoItem: "A faturar", estadoNota: "A aprovar" },      // EXCLUDE
      { estadoItem: "A faturar", estadoNota: "Digitação" },      // EXCLUDE
      { estadoItem: "Faturado parcial", estadoNota: "Aprovado" }, // INCLUDE
      { estadoItem: "Faturado", estadoNota: "Aprovado" },        // EXCLUDE (not open)
      { estadoItem: "A faturar", estadoNota: null },              // EXCLUDE
      { estadoItem: "A faturar", estadoNota: "Cancelado" },      // EXCLUDE
    ];
    const result = filterOpenItems(items);
    expect(result).toHaveLength(2);
    expect(result.every(i => i.estadoNota === "Aprovado")).toBe(true);
  });
});

describe("Billing filter - billed items", () => {
  it("should include Faturado items with Faturado estadoNota", () => {
    const items = [{ estadoItem: "Faturado", estadoNota: "Faturado", dataEmissao: "2026-03-15" }];
    expect(filterBilledItems(items)).toHaveLength(1);
  });

  it("should include Faturado items with Aprovado estadoNota", () => {
    const items = [{ estadoItem: "Faturado", estadoNota: "Aprovado", dataEmissao: "2026-03-15" }];
    expect(filterBilledItems(items)).toHaveLength(1);
  });

  it("should EXCLUDE Faturado items with 'A aprovar' estadoNota", () => {
    const items = [{ estadoItem: "Faturado", estadoNota: "A aprovar", dataEmissao: "2026-03-15" }];
    expect(filterBilledItems(items)).toHaveLength(0);
  });

  it("should EXCLUDE Faturado items with null estadoNota", () => {
    const items = [{ estadoItem: "Faturado", estadoNota: null, dataEmissao: "2026-03-15" }];
    expect(filterBilledItems(items)).toHaveLength(0);
  });

  it("should EXCLUDE Faturado items with Digitação estadoNota", () => {
    const items = [{ estadoItem: "Faturado", estadoNota: "Digitação", dataEmissao: "2026-03-15" }];
    expect(filterBilledItems(items)).toHaveLength(0);
  });
});

describe("isAmostraBonificacao - detect AMOSTRA/BONIFICAÇÃO estadoConfiguravel", () => {
  it("should return true for 'AMOSTRA/BONIFICAÇÃO'", () => {
    expect(isAmostraBonificacao("AMOSTRA/BONIFICAÇÃO")).toBe(true);
  });

  it("should return true for 'AMOSTRA'", () => {
    expect(isAmostraBonificacao("AMOSTRA")).toBe(true);
  });

  it("should return true for 'BONIFICAÇÃO'", () => {
    expect(isAmostraBonificacao("BONIFICAÇÃO")).toBe(true);
  });

  it("should return false for 'BAMBU'", () => {
    expect(isAmostraBonificacao("BAMBU")).toBe(false);
  });

  it("should return false for 'MADEIRA'", () => {
    expect(isAmostraBonificacao("MADEIRA")).toBe(false);
  });

  it("should return false for null", () => {
    expect(isAmostraBonificacao(null)).toBe(false);
  });
});

describe("getTipoEspecial - Heurística inteligente AMOSTRA/BONIFICAÇÃO", () => {
  // ===== Pedidos normais (não AMOSTRA/BONIFICAÇÃO) =====
  it("should return null for BAMBU (pedido normal)", () => {
    expect(getTipoEspecial("BAMBU")).toBeNull();
  });

  it("should return null for MADEIRA (pedido normal)", () => {
    expect(getTipoEspecial("MADEIRA")).toBeNull();
  });

  it("should return null for FIBRA (pedido normal)", () => {
    expect(getTipoEspecial("FIBRA")).toBeNull();
  });

  it("should return null for null", () => {
    expect(getTipoEspecial(null)).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(getTipoEspecial("")).toBeNull();
  });

  it("should return null for CANCELADO", () => {
    expect(getTipoEspecial("CANCELADO")).toBeNull();
  });

  it("should return null for GILSON", () => {
    expect(getTipoEspecial("GILSON")).toBeNull();
  });

  // ===== Regra 1: Observações contém "bonificação" → BONIFICAÇÃO =====
  it("should return BONIFICACAO when obs says 'Bonificação' (pedido #727)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "Bonificação", 2400)).toBe("BONIFICACAO");
  });

  it("should return BONIFICACAO when obs says 'BONIFICAÇÃO DO PEDIDO 661' (pedido #662)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "BONIFICAÇÃO DO PEDIDO 661", 143.44)).toBe("BONIFICACAO");
  });

  it("should return BONIFICACAO when obs says 'mercadoria BONIFICADA' (pedido #333)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "mercadoria BONIFICADA QUE DEVE SER ENTREGUE JUNTO COM O ULTIMO PEDIDO!304", 4120)).toBe("BONIFICACAO");
  });

  it("should return BONIFICACAO when obs says '1 CX DE BONIFICAÇÃO' (pedido #275)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "1 CX DE BONIFICAÇÃO", 210)).toBe("BONIFICACAO");
  });

  // ===== Regra 2: Observações contém "amostra" → AMOSTRA =====
  it("should return AMOSTRA when obs says 'PROVIDENCIAR UM KIT DE AMOSTRAS' (pedido #721)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "GENTILEZA PROVIDENCIAR UM KIT DE AMOSTRAS PARA AROMATIZADOR.", 10)).toBe("AMOSTRA");
  });

  it("should return AMOSTRA when obs says 'Amostra.' (pedido #497)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "Amostra.", 10)).toBe("AMOSTRA");
  });

  it("should return AMOSTRA when obs says 'PROVIDENCIAR AMOSTRAS DE FIBRA' (pedido #704)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "GENTILEZA PROVIDENCIAR AMOSTRAS DE FIBRA", 10)).toBe("AMOSTRA");
  });

  // ===== Regra 3: Valor <= R$ 100 sem obs → AMOSTRA =====
  it("should return AMOSTRA for low value R$ 10 without obs (pedido #550)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", null, 10)).toBe("AMOSTRA");
  });

  it("should return AMOSTRA for low value R$ 20 without obs (pedido #610)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", null, 20)).toBe("AMOSTRA");
  });

  it("should return AMOSTRA for value R$ 5.36 without obs (pedido #336)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", null, 5.36)).toBe("AMOSTRA");
  });

  it("should return AMOSTRA for value exactly R$ 100", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", null, 100)).toBe("AMOSTRA");
  });

  // ===== Regra 4: Valor > R$ 100 sem indicação → PEDIDO NORMAL (null) =====
  it("should return null for high value R$ 3814 with generic obs (pedido #643 - complemento)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "faturar junto com o pedido principal", 3814)).toBeNull();
  });

  it("should return null for value R$ 301.88 without obs (pedido #689 - venda)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", null, 301.88)).toBeNull();
  });

  it("should return null for value R$ 450 with generic obs (pedido #371)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "O 4,5 X30 É SÓ UMA REFERENCIA", 450)).toBeNull();
  });

  it("should return null for value R$ 510 with 'entregar junto' obs (pedido #309)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "ENTREGAR JUNTO COM O PEDIDO DE COMPRA. 276", 510)).toBeNull();
  });

  it("should return null for value R$ 125 without obs (pedido #357)", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", null, 125)).toBeNull();
  });

  // ===== Prioridade: obs "bonificação" vence sobre valor baixo =====
  it("should return BONIFICACAO even with low value if obs says bonificação", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "Bonificação de teste", 10)).toBe("BONIFICACAO");
  });

  // ===== Prioridade: obs "amostra" vence sobre valor alto =====
  it("should return AMOSTRA even with high value if obs says amostra", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "Preparar amostra especial", 500)).toBe("AMOSTRA");
  });

  // ===== Sem valor informado → AMOSTRA (fallback seguro para AMOSTRA/BONIFICAÇÃO) =====
  it("should return null when no valor and no obs for AMOSTRA/BONIFICAÇÃO", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO")).toBeNull();
  });

  it("should return null when valor is undefined and no obs", () => {
    expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", null, undefined)).toBeNull();
  });
});
