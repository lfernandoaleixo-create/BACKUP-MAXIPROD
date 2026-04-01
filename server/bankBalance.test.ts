import { describe, it, expect } from "vitest";

/**
 * Tests for Bank Balance display logic.
 * Verifies that variation is calculated as saldoAtual - saldoInicial,
 * and that negative saldoInicial values are properly handled.
 */

// Replicate the frontend fmtShort function
const fmtShort = (v: number) =>
  Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Replicate the frontend variation calculation
function calculateVariacao(saldoAtual: number, saldoInicial: number): number {
  return Math.round((saldoAtual - saldoInicial) * 100) / 100;
}

// Replicate the frontend sign prefix logic for variation
function formatVariacaoPrefix(variacao: number): string {
  if (variacao > 0) return "+R$ ";
  if (variacao < 0) return "-R$ ";
  return "R$ ";
}

// Replicate the frontend sign prefix logic for saldo inicial
function formatSaldoInicialPrefix(saldoInicial: number): string {
  return saldoInicial < 0 ? "R$ -" : "R$ ";
}

// Replicate the frontend sign prefix logic for saldo atual
function formatSaldoAtualPrefix(saldoAtual: number): string {
  return saldoAtual < 0 ? "R$ -" : "R$ ";
}

describe("Bank Balance Variation Calculation", () => {
  it("should calculate zero variation when saldos are equal", () => {
    const variacao = calculateVariacao(6861.11, 6861.11);
    expect(variacao).toBe(0);
    expect(formatVariacaoPrefix(variacao)).toBe("R$ ");
    expect(`${formatVariacaoPrefix(variacao)}${fmtShort(variacao)}`).toBe("R$ 0,00");
  });

  it("should calculate negative variation when saldoAtual < saldoInicial", () => {
    // Sicredi Palitos: 32234.81 - 39307.14 = -7072.33
    const variacao = calculateVariacao(32234.81, 39307.14);
    expect(variacao).toBe(-7072.33);
    expect(formatVariacaoPrefix(variacao)).toBe("-R$ ");
    expect(`${formatVariacaoPrefix(variacao)}${fmtShort(variacao)}`).toBe("-R$ 7.072,33");
  });

  it("should calculate positive variation when saldoAtual > saldoInicial", () => {
    // Sicredi Mesa: 610.09 - 140.09 = 470.00
    const variacao = calculateVariacao(610.09, 140.09);
    expect(variacao).toBe(470);
    expect(formatVariacaoPrefix(variacao)).toBe("+R$ ");
    expect(`${formatVariacaoPrefix(variacao)}${fmtShort(variacao)}`).toBe("+R$ 470,00");
  });

  it("should handle NEGATIVE saldoInicial correctly (Sicredi Varetas case)", () => {
    // Sicredi Varetas: saldoInicial = -5946.01, saldoAtual = 4053.99
    // variacao = 4053.99 - (-5946.01) = 10000.00
    const saldoInicial = -5946.01;
    const saldoAtual = 4053.99;
    const variacao = calculateVariacao(saldoAtual, saldoInicial);
    
    expect(variacao).toBe(10000);
    
    // Saldo Inicial should show as NEGATIVE
    expect(formatSaldoInicialPrefix(saldoInicial)).toBe("R$ -");
    expect(`${formatSaldoInicialPrefix(saldoInicial)}${fmtShort(saldoInicial)}`).toBe("R$ -5.946,01");
    
    // Saldo Atual should show as POSITIVE
    expect(formatSaldoAtualPrefix(saldoAtual)).toBe("R$ ");
    expect(`${formatSaldoAtualPrefix(saldoAtual)}${fmtShort(saldoAtual)}`).toBe("R$ 4.053,99");
    
    // Variação should show as POSITIVE
    expect(formatVariacaoPrefix(variacao)).toBe("+R$ ");
    expect(`${formatVariacaoPrefix(variacao)}${fmtShort(variacao)}`).toBe("+R$ 10.000,00");
  });

  it("should handle negative saldoAtual correctly", () => {
    const saldoInicial = 1000;
    const saldoAtual = -500;
    const variacao = calculateVariacao(saldoAtual, saldoInicial);
    
    expect(variacao).toBe(-1500);
    
    // Saldo Inicial positive
    expect(formatSaldoInicialPrefix(saldoInicial)).toBe("R$ ");
    expect(`${formatSaldoInicialPrefix(saldoInicial)}${fmtShort(saldoInicial)}`).toBe("R$ 1.000,00");
    
    // Saldo Atual negative
    expect(formatSaldoAtualPrefix(saldoAtual)).toBe("R$ -");
    expect(`${formatSaldoAtualPrefix(saldoAtual)}${fmtShort(saldoAtual)}`).toBe("R$ -500,00");
    
    // Variação negative
    expect(formatVariacaoPrefix(variacao)).toBe("-R$ ");
    expect(`${formatVariacaoPrefix(variacao)}${fmtShort(variacao)}`).toBe("-R$ 1.500,00");
  });

  it("should handle both negative saldos correctly", () => {
    const saldoInicial = -2000;
    const saldoAtual = -500;
    const variacao = calculateVariacao(saldoAtual, saldoInicial);
    
    // -500 - (-2000) = 1500 (positive variation - improved from -2000 to -500)
    expect(variacao).toBe(1500);
    expect(formatVariacaoPrefix(variacao)).toBe("+R$ ");
  });

  it("should calculate total variation correctly from multiple accounts", () => {
    const accounts = [
      { saldoInicial: 6861.11, saldoAtual: 6861.11 },   // variacao: 0
      { saldoInicial: 39307.14, saldoAtual: 32234.81 },  // variacao: -7072.33
      { saldoInicial: -5946.01, saldoAtual: 4053.99 },   // variacao: 10000
      { saldoInicial: 140.09, saldoAtual: 610.09 },      // variacao: 470
    ];

    const accountsWithVariacao = accounts.map(a => ({
      ...a,
      variacao: calculateVariacao(a.saldoAtual, a.saldoInicial),
    }));

    const totalVariacao = Math.round(
      accountsWithVariacao.reduce((sum, a) => sum + a.variacao, 0) * 100
    ) / 100;

    expect(totalVariacao).toBe(3397.67);
  });

  it("should filter out zero accounts correctly", () => {
    const accounts = [
      { saldoInicial: 0, saldoAtual: 0, variacao: 0 },
      { saldoInicial: 100, saldoAtual: 200, variacao: 100 },
      { saldoInicial: 0, saldoAtual: 50, variacao: 50 },
    ];

    const activeAccounts = accounts.filter(
      a => a.saldoInicial !== 0 || a.saldoAtual !== 0 || a.variacao !== 0
    );

    expect(activeAccounts.length).toBe(2);
  });

  it("fmtShort should always return absolute value formatted", () => {
    expect(fmtShort(-1234.56)).toBe("1.234,56");
    expect(fmtShort(1234.56)).toBe("1.234,56");
    expect(fmtShort(0)).toBe("0,00");
    expect(fmtShort(-0.01)).toBe("0,01");
  });
});
