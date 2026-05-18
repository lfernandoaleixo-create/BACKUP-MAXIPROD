import { describe, it, expect } from "vitest";

/**
 * Tests for the dadosCheque field extraction logic.
 * Verifies that the extractDadosCheque function correctly extracts
 * cheque data from the campoAdicionalEspecifico array.
 */

// Replicate the extractDadosCheque logic from maxiprodGraphQL.ts
function extractDadosCheque(campos: any[] | null | undefined): string | null {
  if (!campos || !Array.isArray(campos)) return null;
  const dadosCampo = campos.find((c: any) => {
    const tag = (c.tag || '').trim();
    return tag === 'DadosDoCheque' || tag === 'dadosDoCheque';
  });
  if (!dadosCampo) return null;
  const valor = (dadosCampo.valor || '').trim();
  return valor || null;
}

describe("extractDadosCheque", () => {
  it("should extract cheque data from campoAdicionalEspecifico with DadosDoCheque tag", () => {
    const campos = [
      { tag: "Situacao", descricao: "SITUAÇÃO", valor: null },
      { tag: "DadosDoCheque", descricao: "Dados do cheque", valor: "SANTANDER - Nº 90 - M D DA SILVA" },
    ];
    expect(extractDadosCheque(campos)).toBe("SANTANDER - Nº 90 - M D DA SILVA");
  });

  it("should handle SICREDI cheque data", () => {
    const campos = [
      { tag: "DadosDoCheque", descricao: "Dados do cheque", valor: "SICREDI - Nº 7 - DISTRIBUIDORA M7 EMBALAGENS" },
    ];
    expect(extractDadosCheque(campos)).toBe("SICREDI - Nº 7 - DISTRIBUIDORA M7 EMBALAGENS");
  });

  it("should handle SICOOB cheque data", () => {
    const campos = [
      { tag: "DadosDoCheque", descricao: "Dados do cheque", valor: "SICOOB - Nº 19 - APARECIDO GARCIA DA SILVA" },
      { tag: "Situacao", descricao: "SITUAÇÃO", valor: null },
    ];
    expect(extractDadosCheque(campos)).toBe("SICOOB - Nº 19 - APARECIDO GARCIA DA SILVA");
  });

  it("should return null when campos is null", () => {
    expect(extractDadosCheque(null)).toBeNull();
  });

  it("should return null when campos is undefined", () => {
    expect(extractDadosCheque(undefined)).toBeNull();
  });

  it("should return null when campos is empty array", () => {
    expect(extractDadosCheque([])).toBeNull();
  });

  it("should return null when DadosDoCheque tag is not present", () => {
    const campos = [
      { tag: "Situacao", descricao: "SITUAÇÃO", valor: "COM PROTESTO" },
    ];
    expect(extractDadosCheque(campos)).toBeNull();
  });

  it("should return null when DadosDoCheque value is empty string", () => {
    const campos = [
      { tag: "DadosDoCheque", descricao: "Dados do cheque", valor: "" },
    ];
    expect(extractDadosCheque(campos)).toBeNull();
  });

  it("should return null when DadosDoCheque value is null", () => {
    const campos = [
      { tag: "DadosDoCheque", descricao: "Dados do cheque", valor: null },
    ];
    expect(extractDadosCheque(campos)).toBeNull();
  });

  it("should trim whitespace from the value", () => {
    const campos = [
      { tag: "DadosDoCheque", descricao: "Dados do cheque", valor: "  SANTANDER - Nº 92 - M D DA SILVA  " },
    ];
    expect(extractDadosCheque(campos)).toBe("SANTANDER - Nº 92 - M D DA SILVA");
  });

  it("should handle lowercase tag variant", () => {
    const campos = [
      { tag: "dadosDoCheque", descricao: "Dados do cheque", valor: "SICOOB - Nº 786 - FABIANA LEOPOLDINO" },
    ];
    expect(extractDadosCheque(campos)).toBe("SICOOB - Nº 786 - FABIANA LEOPOLDINO");
  });
});
