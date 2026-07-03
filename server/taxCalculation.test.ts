import { describe, it, expect } from "vitest";
import { calcularImpostos, calcularMargem } from "./taxCalculation";

describe("Tax Calculation Engine", () => {
  describe("calcularImpostos", () => {
    it("should calculate taxes for imported product - internal MG", () => {
      const result = calcularImpostos({
        valorVenda: 10000,
        ufDestino: "MG",
        tipoProduto: "importado",
        tipoContribuinte: "Contribuinte",
        faturamentoTrimestral: 500000,
      });

      // ICMS efetivo importado interna MG = 14%
      expect(result.icmsEfetivo).toBe(14);
      expect(result.icmsValor).toBeCloseTo(1400, 0);
      // PIS interna MG = 0.533%
      expect(result.pisEfetivo).toBeCloseTo(0.533, 3);
      // COFINS interna MG = 2.46%
      expect(result.cofinsEfetiva).toBeCloseTo(2.46, 2);
      // CSLL = 1.188%
      expect(result.csllEfetiva).toBeCloseTo(1.188, 3);
      // No DIFAL for contribuinte
      expect(result.temDifal).toBe(false);
      expect(result.difalValor).toBe(0);
      // Is internal MG
      expect(result.isInternaMG).toBe(true);
    });

    it("should calculate taxes for imported product - interstate (SP)", () => {
      const result = calcularImpostos({
        valorVenda: 10000,
        ufDestino: "SP",
        tipoProduto: "importado",
        tipoContribuinte: "Contribuinte",
        faturamentoTrimestral: 500000,
      });

      // ICMS efetivo importado interestadual = 1.5%
      expect(result.icmsEfetivo).toBe(1.5);
      expect(result.icmsValor).toBeCloseTo(150, 0);
      // PIS interestadual = 0.572%
      expect(result.pisEfetivo).toBeCloseTo(0.572, 3);
      // COFINS interestadual = 2.64%
      expect(result.cofinsEfetiva).toBeCloseTo(2.64, 2);
      // No DIFAL for contribuinte
      expect(result.temDifal).toBe(false);
      expect(result.isInternaMG).toBe(false);
    });

    it("should calculate taxes for industrialized product - internal MG", () => {
      const result = calcularImpostos({
        valorVenda: 10000,
        ufDestino: "MG",
        tipoProduto: "industrializado",
        tipoContribuinte: "Contribuinte",
        faturamentoTrimestral: 500000,
      });

      // ICMS efetivo industrializado interna MG = 18%
      expect(result.icmsEfetivo).toBe(18);
      expect(result.icmsValor).toBeCloseTo(1800, 0);
      // PIS interna MG = 0.533%
      expect(result.pisEfetivo).toBeCloseTo(0.533, 3);
      // COFINS interna MG = 2.46%
      expect(result.cofinsEfetiva).toBeCloseTo(2.46, 2);
    });

    it("should calculate taxes for industrialized product - interstate", () => {
      const result = calcularImpostos({
        valorVenda: 10000,
        ufDestino: "SP",
        tipoProduto: "industrializado",
        tipoContribuinte: "Contribuinte",
        faturamentoTrimestral: 500000,
      });

      // ICMS efetivo industrializado interestadual = 12%
      expect(result.icmsEfetivo).toBe(12);
      expect(result.icmsValor).toBeCloseTo(1200, 0);
      // PIS interestadual = 0.572%
      expect(result.pisEfetivo).toBeCloseTo(0.572, 3);
      // COFINS interestadual = 2.64%
      expect(result.cofinsEfetiva).toBeCloseTo(2.64, 2);
    });

    it("should apply DIFAL for non-contributor interstate sale", () => {
      const result = calcularImpostos({
        valorVenda: 10000,
        ufDestino: "SP",
        tipoProduto: "importado",
        tipoContribuinte: "Não contribuinte",
        faturamentoTrimestral: 500000,
      });

      // Should have DIFAL
      expect(result.temDifal).toBe(true);
      expect(result.difalEfetivo).toBeGreaterThan(0);
      expect(result.difalValor).toBeGreaterThan(0);
      // SP internal rate is 18%, interestadual importado is 4%
      // DIFAL should be around 14% (simples method for SP)
    });

    it("should NOT apply DIFAL for internal MG sale", () => {
      const result = calcularImpostos({
        valorVenda: 10000,
        ufDestino: "MG",
        tipoProduto: "importado",
        tipoContribuinte: "Não contribuinte",
        faturamentoTrimestral: 500000,
      });

      // No DIFAL for internal MG
      expect(result.temDifal).toBe(false);
      expect(result.difalValor).toBe(0);
    });

    it("should calculate higher IRPJ when quarterly revenue exceeds 1.25M", () => {
      const resultLow = calcularImpostos({
        valorVenda: 10000,
        ufDestino: "MG",
        tipoProduto: "importado",
        tipoContribuinte: "Contribuinte",
        faturamentoTrimestral: 500000,
      });

      const resultHigh = calcularImpostos({
        valorVenda: 10000,
        ufDestino: "MG",
        tipoProduto: "importado",
        tipoContribuinte: "Contribuinte",
        faturamentoTrimestral: 2000000,
      });

      // IRPJ should be higher when revenue exceeds 1.25M
      expect(resultHigh.irpjEfetivo).toBeGreaterThan(resultLow.irpjEfetivo);
      // Low should be 1.20%, high should be between 1.20% and 2.28%
      expect(resultLow.irpjEfetivo).toBeCloseTo(1.20, 1);
      expect(resultHigh.irpjEfetivo).toBeGreaterThanOrEqual(1.20);
      expect(resultHigh.irpjEfetivo).toBeLessThanOrEqual(2.28);
    });

    it("should calculate total taxes correctly", () => {
      const result = calcularImpostos({
        valorVenda: 10000,
        ufDestino: "MG",
        tipoProduto: "importado",
        tipoContribuinte: "Contribuinte",
        faturamentoTrimestral: 500000,
      });

      const expectedTotal = result.icmsValor + result.pisValor + result.cofinsValor + result.irpjValor + result.csllValor + result.difalValor;
      expect(result.totalImpostosValor).toBeCloseTo(expectedTotal, 0);
    });
  });

  describe("calcularMargem", () => {
    it("should calculate margin correctly", () => {
      const impostos = calcularImpostos({
        valorVenda: 10000,
        ufDestino: "SP",
        tipoProduto: "importado",
        tipoContribuinte: "Contribuinte",
        faturamentoTrimestral: 500000,
      });

      const result = calcularMargem({
        valorVenda: 10000,
        custoMercadoria: 4000,
        frete: 500,
        comissao: 300,
        impostos,
      });

      expect(result.valorVenda).toBe(10000);
      expect(result.custoMercadoria).toBe(4000);
      expect(result.frete).toBe(500);
      expect(result.comissao).toBe(300);
      expect(result.totalImpostos).toBe(impostos.totalImpostosValor);
      // Lucro = 10000 - 4000 - 500 - 300 - impostos
      const expectedLucro = 10000 - 4000 - 500 - 300 - impostos.totalImpostosValor;
      expect(result.lucroLiquido).toBeCloseTo(expectedLucro, 0);
      // Margem = lucro / venda * 100
      expect(result.margemPercentual).toBeCloseTo((expectedLucro / 10000) * 100, 1);
    });

    it("should handle negative margin (loss)", () => {
      const impostos = calcularImpostos({
        valorVenda: 5000,
        ufDestino: "MG",
        tipoProduto: "importado",
        tipoContribuinte: "Contribuinte",
        faturamentoTrimestral: 500000,
      });

      const result = calcularMargem({
        valorVenda: 5000,
        custoMercadoria: 4000,
        frete: 1000,
        comissao: 500,
        impostos,
      });

      // With high costs, margin should be negative
      expect(result.lucroLiquido).toBeLessThan(0);
      expect(result.margemPercentual).toBeLessThan(0);
    });
  });
});
