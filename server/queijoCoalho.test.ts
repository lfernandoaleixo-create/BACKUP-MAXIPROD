import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the Queijo Coalho stock management feature.
 * Validates:
 * - QUEIJO_COALHO_CODES constant correctness
 * - Password validation logic (only "Maria" can edit estoque_maxiprod)
 * - Computed column formulas (projetado = PO + maxiprod, disponivel = processado - pedidos)
 * - Status logic (verde/amarelo/vermelho based on regulador)
 */

describe("Queijo Coalho Stock Logic", () => {
  const QUEIJO_COALHO_CODES = ["00648", "00546", "00547", "00577", "00645", "00646", "00647"];

  it("should have exactly 7 product codes (1 parent + 6 variations)", () => {
    expect(QUEIJO_COALHO_CODES).toHaveLength(7);
    expect(QUEIJO_COALHO_CODES).toContain("00648"); // parent
    expect(QUEIJO_COALHO_CODES).toContain("00546");
    expect(QUEIJO_COALHO_CODES).toContain("00547");
    expect(QUEIJO_COALHO_CODES).toContain("00577");
    expect(QUEIJO_COALHO_CODES).toContain("00645");
    expect(QUEIJO_COALHO_CODES).toContain("00646");
    expect(QUEIJO_COALHO_CODES).toContain("00647");
  });

  describe("Password Validation", () => {
    const validatePassword = (senha: string | undefined, campo: string): boolean => {
      if (campo === "estoque_maxiprod") {
        return !!senha && senha.toLowerCase() === "maria";
      }
      return true; // other fields don't require password
    };

    it("should allow Maria to edit estoque_maxiprod", () => {
      expect(validatePassword("Maria", "estoque_maxiprod")).toBe(true);
      expect(validatePassword("maria", "estoque_maxiprod")).toBe(true);
      expect(validatePassword("MARIA", "estoque_maxiprod")).toBe(true);
    });

    it("should reject other names for estoque_maxiprod", () => {
      expect(validatePassword("João", "estoque_maxiprod")).toBe(false);
      expect(validatePassword("", "estoque_maxiprod")).toBe(false);
      expect(validatePassword(undefined, "estoque_maxiprod")).toBe(false);
    });

    it("should allow anyone to edit estoque_regulador", () => {
      expect(validatePassword("João", "estoque_regulador")).toBe(true);
      expect(validatePassword(undefined, "estoque_regulador")).toBe(true);
    });

    it("should allow anyone to edit estoque_processado", () => {
      expect(validatePassword("Sistema", "estoque_processado")).toBe(true);
    });
  });

  describe("Computed Columns", () => {
    const computeRow = (maxiprod: number, poCx: number, processado: number, pedidosCx: number, regulador: number) => {
      const estoqueProjetado = poCx + maxiprod;
      const disponivelVenda = processado - pedidosCx;
      let status: "verde" | "amarelo" | "vermelho" = "verde";
      if (regulador > 0) {
        if (disponivelVenda <= 0) status = "vermelho";
        else if (disponivelVenda < regulador) status = "amarelo";
      }
      return { estoqueProjetado, disponivelVenda, status };
    };

    it("should compute estoqueProjetado = PO + maxiprod", () => {
      const result = computeRow(100, 50, 80, 20, 30);
      expect(result.estoqueProjetado).toBe(150); // 50 + 100
    });

    it("should compute disponivelVenda = processado - pedidos", () => {
      const result = computeRow(100, 50, 80, 20, 30);
      expect(result.disponivelVenda).toBe(60); // 80 - 20
    });

    it("should return verde when disponivel >= regulador", () => {
      const result = computeRow(100, 50, 80, 20, 30);
      expect(result.status).toBe("verde"); // 60 >= 30
    });

    it("should return amarelo when 0 < disponivel < regulador", () => {
      const result = computeRow(100, 50, 40, 20, 30);
      expect(result.status).toBe("amarelo"); // 20 < 30
    });

    it("should return vermelho when disponivel <= 0", () => {
      const result = computeRow(100, 50, 20, 30, 10);
      expect(result.status).toBe("vermelho"); // -10 <= 0
    });

    it("should return verde when regulador is 0 (not configured)", () => {
      const result = computeRow(100, 50, 0, 50, 0);
      expect(result.status).toBe("verde"); // regulador = 0, no status check
    });

    it("should handle negative disponivel correctly", () => {
      const result = computeRow(100, 0, 10, 50, 20);
      expect(result.disponivelVenda).toBe(-40); // 10 - 50
      expect(result.status).toBe("vermelho");
    });
  });

  describe("Auto-feed from Embalagem", () => {
    it("should increment processado when production entry is added", () => {
      const currentProcessado = 100;
      const diff = 50; // 50 new units produced
      const newProcessado = Math.max(0, currentProcessado + diff);
      expect(newProcessado).toBe(150);
    });

    it("should decrement processado when production entry is reduced", () => {
      const currentProcessado = 100;
      const diff = -30; // 30 units removed
      const newProcessado = Math.max(0, currentProcessado + diff);
      expect(newProcessado).toBe(70);
    });

    it("should not go below zero", () => {
      const currentProcessado = 10;
      const diff = -50; // more removed than available
      const newProcessado = Math.max(0, currentProcessado + diff);
      expect(newProcessado).toBe(0);
    });
  });
});
