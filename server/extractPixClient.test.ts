import { describe, it, expect } from "vitest";

/**
 * Test the PIX client extraction logic.
 * The function is duplicated in cobrancaPlanilhaSync.ts and cobrancaPlanilhaRouter.ts.
 * We test the logic inline here to verify correctness.
 */
function extractRealClientFromPix(referenteA: string | null, cliente: string): string {
  if (!referenteA) return cliente;
  const ref = referenteA.trim();
  const refUpper = ref.toUpperCase();
  const clienteUpper = cliente.toUpperCase();
  
  // Se o cliente parece ser um banco e o referenteA contém o nome real do cliente
  if (clienteUpper.includes('BANCO')) {
    // Padrão 1: "PIX NOME DO CLIENTE"
    if (refUpper.startsWith('PIX ')) {
      const realClient = ref.substring(4).trim();
      if (realClient.length > 3) return realClient;
    }
    // Padrão 2: "RECEBIMENTO PIX-PIX - NOME DO CLIENTE"
    const pixDashMatch = ref.match(/RECEBIMENTO PIX[\-\s]*PIX[\s\-]+(.+)/i);
    if (pixDashMatch && pixDashMatch[1].trim().length > 3) {
      return pixDashMatch[1].trim();
    }
  }
  return cliente;
}

describe("extractRealClientFromPix", () => {
  it("should extract client name from PIX prefix when cliente is a bank", () => {
    const result = extractRealClientFromPix(
      "PIX BOTICA BELADONA -J L FORMULAS ",
      "BANCO COOPERATIVO SICREDI S.A."
    );
    expect(result).toBe("BOTICA BELADONA -J L FORMULAS");
  });

  it("should extract client name from RECEBIMENTO PIX-PIX pattern", () => {
    const result = extractRealClientFromPix(
      "RECEBIMENTO PIX-PIX - RITA DE CASSIA DOMICIANO NOGUEIRA ",
      "BANCO COOPERATIVO SICREDI S.A."
    );
    expect(result).toBe("RITA DE CASSIA DOMICIANO NOGUEIRA");
  });

  it("should NOT modify empresa when cliente is not a bank", () => {
    const result = extractRealClientFromPix(
      "PIX ALGUMA COISA",
      "EMPRESA NORMAL LTDA"
    );
    expect(result).toBe("EMPRESA NORMAL LTDA");
  });

  it("should NOT modify empresa when referenteA is null", () => {
    const result = extractRealClientFromPix(null, "BANCO COOPERATIVO SICREDI S.A.");
    expect(result).toBe("BANCO COOPERATIVO SICREDI S.A.");
  });

  it("should NOT modify empresa when referenteA does not start with PIX", () => {
    const result = extractRealClientFromPix(
      "CHEQUE NAO INDENTIFICADO ",
      "BANCO COOPERATIVO SICREDI S.A."
    );
    expect(result).toBe("BANCO COOPERATIVO SICREDI S.A.");
  });

  it("should NOT modify empresa when extracted name is too short", () => {
    const result = extractRealClientFromPix(
      "PIX AB",
      "BANCO COOPERATIVO SICREDI S.A."
    );
    expect(result).toBe("BANCO COOPERATIVO SICREDI S.A.");
  });

  it("should handle various bank name patterns", () => {
    const result = extractRealClientFromPix(
      "PIX CLIENTE REAL LTDA",
      "BANCO DO BRASIL S.A."
    );
    expect(result).toBe("CLIENTE REAL LTDA");
  });

  it("should handle RECEBIMENTO PIX PIX pattern (without dash)", () => {
    const result = extractRealClientFromPix(
      "RECEBIMENTO PIX PIX - MARIA SILVA",
      "BANCO ITAU S.A."
    );
    expect(result).toBe("MARIA SILVA");
  });
});
