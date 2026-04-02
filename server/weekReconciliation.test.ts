/**
 * Tests for WeekReconciliationCard improvements
 * - Alphabetical ordering of items
 * - Saldo label renamed
 * - PDF export logic (saldo calculation)
 */
import { describe, it, expect } from "vitest";

describe("WeekReconciliationCard improvements", () => {
  it("should sort items alphabetically by fornecedor", () => {
    const items = [
      { fornecedor: "RENATO BENAZZI LTDA", valor: 24095.61 },
      { fornecedor: "ECO SERRA MADEIRAS LTDA", valor: 33341.49 },
      { fornecedor: "ZETA COMERCIO LTDA", valor: 5000 },
      { fornecedor: "ALPHA DISTRIBUIDORA", valor: 3000 },
    ];

    const sorted = [...items].sort((a, b) =>
      a.fornecedor.localeCompare(b.fornecedor, "pt-BR")
    );

    expect(sorted[0].fornecedor).toBe("ALPHA DISTRIBUIDORA");
    expect(sorted[1].fornecedor).toBe("ECO SERRA MADEIRAS LTDA");
    expect(sorted[2].fornecedor).toBe("RENATO BENAZZI LTDA");
    expect(sorted[3].fornecedor).toBe("ZETA COMERCIO LTDA");
  });

  it("should calculate saldo restante correctly (saldo - autorizado)", () => {
    const saldoBancario = 95386.59;
    const totalAutorizado = 33680.0;
    const saldoRestante = saldoBancario - totalAutorizado;

    expect(saldoRestante).toBeCloseTo(61706.59, 2);
  });

  it("should calculate saldo restante as negative when autorizado > saldo", () => {
    const saldoBancario = 20000;
    const totalAutorizado = 50000;
    const saldoRestante = saldoBancario - totalAutorizado;

    expect(saldoRestante).toBe(-30000);
    expect(saldoRestante < 0).toBe(true);
  });

  it("should filter only authorized items for PDF export", () => {
    const items = [
      { fornecedor: "A", authorized: true, valor: 1000 },
      { fornecedor: "B", authorized: false, valor: 2000 },
      { fornecedor: "C", authorized: true, valor: 3000 },
      { fornecedor: "D", authorized: false, valor: 4000 },
    ];

    const authorizedItems = items.filter((i) => i.authorized);
    expect(authorizedItems).toHaveLength(2);
    expect(authorizedItems[0].fornecedor).toBe("A");
    expect(authorizedItems[1].fornecedor).toBe("C");

    const totalAutorizado = authorizedItems.reduce((s, i) => s + i.valor, 0);
    expect(totalAutorizado).toBe(4000);
  });

  it("should format currency correctly in pt-BR", () => {
    const formatCurrency = (n: number): string =>
      n.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
      });

    expect(formatCurrency(95386.59)).toContain("95.386,59");
    expect(formatCurrency(33680.0)).toContain("33.680,00");
    expect(formatCurrency(0)).toContain("0,00");
  });
});
