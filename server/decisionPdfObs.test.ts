import { describe, it, expect } from "vitest";

/**
 * Tests for the PDF de Decisão de Cobrança observações integration.
 * Verifies that the etapa observations are correctly matched and formatted
 * for inclusion in the PDF's "HISTÓRICO DE AÇÕES REALIZADAS" and "OBSERVAÇÕES" sections.
 */

describe("Decision PDF - HISTÓRICO DE AÇÕES with observações", () => {
  // Simulate the matching logic from decisionPdfExport.ts
  const HIST_ETAPA_LABELS: Record<string, string> = {
    primeiraCobranca: "1ª Cobrança",
    semAcao1: "Sem Ação 1",
    segundaCobranca: "2ª Cobrança",
    semAcao2: "Sem Ação 2",
    terceiraCobranca: "3ª Cobrança",
    semAcao3: "Sem Ação 3",
    acaoFinal: "Ação Final",
  };

  const labelToKey: Record<string, string> = {};
  Object.entries(HIST_ETAPA_LABELS).forEach(([key, label]) => { labelToKey[label] = key; });
  labelToKey["Intervalo 1"] = "semAcao1";
  labelToKey["Intervalo 2"] = "semAcao2";
  labelToKey["Intervalo 3"] = "semAcao3";

  function buildHistoricoTable(
    doneSteps: Array<{ label: string; data: string; status: string }>,
    observacoes: Array<{ etapa: string; observacao: string; registradoPor: string; createdAt: string }>
  ) {
    return doneSteps.map((step, idx) => {
      const etapaKey = labelToKey[step.label] || Object.entries(HIST_ETAPA_LABELS).find(([, v]) => v === step.label)?.[0] || "";
      const obsForStep = observacoes.filter(o => o.etapa === etapaKey);
      const obsText = obsForStep.length > 0 ? obsForStep.map(o => o.observacao).join("; ") : "—";
      return [String(idx + 1), step.label, step.data, obsText];
    });
  }

  it("should match observações to HISTÓRICO steps by etapa key", () => {
    const doneSteps = [
      { label: "1ª Cobrança", data: "2026-04-30", status: "verde" },
      { label: "Sem Ação 1", data: "2026-05-04", status: "verde" },
      { label: "3ª Cobrança", data: "2026-05-13", status: "verde" },
      { label: "Ação Final", data: "2026-05-19", status: "verde" },
    ];
    const observacoes = [
      { etapa: "terceiraCobranca", observacao: "Ligações sem retorno.", registradoPor: "Thiago", createdAt: "2026-05-13 16:00:00" },
      { etapa: "acaoFinal", observacao: "Valor enviado para protesto.", registradoPor: "Thiago", createdAt: "2026-05-19 16:00:00" },
    ];
    const result = buildHistoricoTable(doneSteps, observacoes);
    expect(result).toHaveLength(4);
    expect(result[0][3]).toBe("—"); // 1ª Cobrança - no obs
    expect(result[1][3]).toBe("—"); // Sem Ação 1 - no obs
    expect(result[2][3]).toBe("Ligações sem retorno."); // 3ª Cobrança
    expect(result[3][3]).toBe("Valor enviado para protesto."); // Ação Final
  });

  it("should join multiple observações for the same etapa", () => {
    const doneSteps = [
      { label: "Ação Final", data: "2026-05-19", status: "verde" },
    ];
    const observacoes = [
      { etapa: "acaoFinal", observacao: "Primeira obs.", registradoPor: "Thiago", createdAt: "2026-05-19 16:00:00" },
      { etapa: "acaoFinal", observacao: "Segunda obs.", registradoPor: "Thiago", createdAt: "2026-05-20 16:00:00" },
    ];
    const result = buildHistoricoTable(doneSteps, observacoes);
    expect(result[0][3]).toBe("Primeira obs.; Segunda obs.");
  });

  it("should handle Intervalo labels correctly", () => {
    const doneSteps = [
      { label: "Intervalo 1", data: "2026-05-04", status: "verde" },
      { label: "Intervalo 2", data: "2026-05-07", status: "verde" },
    ];
    const observacoes = [
      { etapa: "semAcao1", observacao: "Aguardando.", registradoPor: "Thiago", createdAt: "2026-05-04 16:00:00" },
    ];
    const result = buildHistoricoTable(doneSteps, observacoes);
    expect(result[0][3]).toBe("Aguardando.");
    expect(result[1][3]).toBe("—");
  });
});

describe("Decision PDF - OBSERVAÇÕES box consolidation", () => {
  const ETAPA_LABELS_OBS: Record<string, string> = {
    primeiraCobranca: "1ª Cobrança",
    semAcao1: "Intervalo 1",
    segundaCobranca: "2ª Cobrança",
    semAcao2: "Intervalo 2",
    terceiraCobranca: "3ª Cobrança",
    semAcao3: "Intervalo 3",
    acaoFinal: "Ação Final",
  };

  function buildObsText(
    observacoes: Array<{ etapa: string; observacao: string; registradoPor: string; createdAt: string }>
  ) {
    if (observacoes.length > 0) {
      return observacoes
        .map(o => `[${ETAPA_LABELS_OBS[o.etapa] || o.etapa}] ${o.observacao}`)
        .join("\n");
    }
    return "";
  }

  it("should format all observações with etapa labels", () => {
    const observacoes = [
      { etapa: "terceiraCobranca", observacao: "Ligações sem retorno.", registradoPor: "Thiago", createdAt: "2026-05-15 16:00:00" },
      { etapa: "acaoFinal", observacao: "Valor enviado para protesto.", registradoPor: "Thiago", createdAt: "2026-05-19 16:00:00" },
    ];
    const result = buildObsText(observacoes);
    expect(result).toBe("[3ª Cobrança] Ligações sem retorno.\n[Ação Final] Valor enviado para protesto.");
  });

  it("should return empty string when no observações", () => {
    const result = buildObsText([]);
    expect(result).toBe("");
  });

  it("should handle multiple observações for same etapa", () => {
    const observacoes = [
      { etapa: "acaoFinal", observacao: "Obs 1.", registradoPor: "Thiago", createdAt: "2026-05-19 16:00:00" },
      { etapa: "acaoFinal", observacao: "Obs 2.", registradoPor: "Thiago", createdAt: "2026-05-20 16:00:00" },
    ];
    const result = buildObsText(observacoes);
    expect(result).toBe("[Ação Final] Obs 1.\n[Ação Final] Obs 2.");
  });
});
