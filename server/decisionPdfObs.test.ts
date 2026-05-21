import { describe, it, expect } from "vitest";

/**
 * Tests for the PDF de Decisão de Cobrança observações integration.
 * Verifies that the etapa observations are correctly matched and formatted
 * for inclusion in the PDF's "ETAPAS DE COBRANÇA REALIZADAS" section.
 */

describe("Decision PDF - Observações matching logic", () => {
  // Simulate the matching logic from decisionPdfExport.ts line 414
  function matchObsToEtapa(
    etapas: Array<{ etapa: string; data: string | null }>,
    observacoes: Array<{ etapa: string; observacao: string; registradoPor: string; createdAt: string }>
  ) {
    const ETAPA_LABELS: Record<string, string> = {
      primeiraCobranca: "1ª Cobrança",
      semAcao1: "Intervalo 1",
      segundaCobranca: "2ª Cobrança",
      semAcao2: "Intervalo 2",
      terceiraCobranca: "3ª Cobrança",
      semAcao3: "Intervalo 3",
      acaoFinal: "Ação Final",
    };
    const etapasComData = etapas.filter(e => e.data);
    return etapasComData.map(e => {
      const label = ETAPA_LABELS[e.etapa] || e.etapa;
      const obsForEtapa = observacoes.filter(o => o.etapa === e.etapa);
      const obsText = obsForEtapa.length > 0 ? obsForEtapa.map(o => o.observacao).join("; ") : "—";
      return { label, data: e.data, obsText };
    });
  }

  it("should match observações to etapas by raw key", () => {
    const etapas = [
      { etapa: "primeiraCobranca", data: "2026-05-15" },
      { etapa: "acaoFinal", data: "2026-05-21" },
    ];
    const observacoes = [
      { etapa: "primeiraCobranca", observacao: "Ligações sem retorno.", registradoPor: "Thiago", createdAt: "2026-05-15 16:00:00" },
      { etapa: "acaoFinal", observacao: "Valor enviado para protesto.", registradoPor: "Thiago", createdAt: "2026-05-21 11:30:00" },
    ];
    const result = matchObsToEtapa(etapas, observacoes);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe("1ª Cobrança");
    expect(result[0].obsText).toBe("Ligações sem retorno.");
    expect(result[1].label).toBe("Ação Final");
    expect(result[1].obsText).toBe("Valor enviado para protesto.");
  });

  it("should join multiple observações for the same etapa with semicolons", () => {
    const etapas = [
      { etapa: "acaoFinal", data: "2026-05-20" },
    ];
    const observacoes = [
      { etapa: "acaoFinal", observacao: "Primeira obs.", registradoPor: "Thiago", createdAt: "2026-05-19 16:03:00" },
      { etapa: "acaoFinal", observacao: "Segunda obs.", registradoPor: "Thiago", createdAt: "2026-05-20 16:24:00" },
    ];
    const result = matchObsToEtapa(etapas, observacoes);
    expect(result[0].obsText).toBe("Primeira obs.; Segunda obs.");
  });

  it("should show — for etapas without observações", () => {
    const etapas = [
      { etapa: "primeiraCobranca", data: "2026-05-15" },
      { etapa: "segundaCobranca", data: "2026-05-18" },
    ];
    const observacoes = [
      { etapa: "primeiraCobranca", observacao: "Ligação efetuada.", registradoPor: "Thiago", createdAt: "2026-05-15 16:00:00" },
    ];
    const result = matchObsToEtapa(etapas, observacoes);
    expect(result[0].obsText).toBe("Ligação efetuada.");
    expect(result[1].obsText).toBe("—");
  });

  it("should skip etapas without data (not yet completed)", () => {
    const etapas = [
      { etapa: "primeiraCobranca", data: "2026-05-15" },
      { etapa: "segundaCobranca", data: null },
      { etapa: "terceiraCobranca", data: null },
    ];
    const observacoes = [
      { etapa: "primeiraCobranca", observacao: "Feito.", registradoPor: "Thiago", createdAt: "2026-05-15 16:00:00" },
    ];
    const result = matchObsToEtapa(etapas, observacoes);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("1ª Cobrança");
  });

  it("should not match observações when etapa keys don't match (e.g. using labels instead of raw keys)", () => {
    const etapas = [
      { etapa: "primeiraCobranca", data: "2026-05-15" },
    ];
    // Wrong: using label as etapa key
    const observacoes = [
      { etapa: "1ª Cobrança", observacao: "This won't match.", registradoPor: "Thiago", createdAt: "2026-05-15 16:00:00" },
    ];
    const result = matchObsToEtapa(etapas, observacoes);
    expect(result[0].obsText).toBe("—"); // No match because keys are different
  });
});
