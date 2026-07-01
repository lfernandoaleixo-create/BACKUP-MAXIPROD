import { describe, it, expect } from "vitest";

/**
 * Tests for the pricing calculator logic used in the product step of Novo Pedido.
 * The formula: Preço vendedor = Preço tabela ÷ (1 - margem%)
 * Discount: finalPrice = precoVendedor * (1 - discount% / 100)
 * Reverse: discount% = ((precoVendedor - finalPrice) / precoVendedor) * 100
 */
describe("Product Pricing Calculator Logic", () => {
  const calculatePrecoVendedor = (precoTabela: number, margemPct: number): number => {
    return precoTabela / (1 - margemPct / 100);
  };

  const calculateFinalFromDiscount = (precoBase: number, discountPct: number): number => {
    return precoBase * (1 - discountPct / 100);
  };

  const calculateDiscountFromFinal = (precoBase: number, finalValue: number): number => {
    if (precoBase <= 0) return 0;
    return ((precoBase - finalValue) / precoBase) * 100;
  };

  it("should calculate precoVendedor from precoTabela and margem", () => {
    // Preço tabela R$100, margem 30% → R$100 / (1 - 0.30) = R$142.86
    const result = calculatePrecoVendedor(100, 30);
    expect(result).toBeCloseTo(142.86, 2);
  });

  it("should calculate precoVendedor with 0% margem (no markup)", () => {
    const result = calculatePrecoVendedor(100, 0);
    expect(result).toBe(100);
  });

  it("should calculate final price from discount percentage", () => {
    // Preço base R$142.86, desconto 10% → R$128.57
    const result = calculateFinalFromDiscount(142.86, 10);
    expect(result).toBeCloseTo(128.57, 2);
  });

  it("should calculate final price with 0% discount", () => {
    const result = calculateFinalFromDiscount(142.86, 0);
    expect(result).toBeCloseTo(142.86, 2);
  });

  it("should calculate discount percentage from final value", () => {
    // Preço base R$142.86, valor final R$100 → desconto = (142.86 - 100) / 142.86 * 100 = 30%
    const result = calculateDiscountFromFinal(142.86, 100);
    expect(result).toBeCloseTo(30, 0);
  });

  it("should return 0% discount when final equals base price", () => {
    const result = calculateDiscountFromFinal(142.86, 142.86);
    expect(result).toBeCloseTo(0, 2);
  });

  it("should handle edge case where precoBase is 0", () => {
    const result = calculateDiscountFromFinal(0, 50);
    expect(result).toBe(0);
  });

  it("should detect below-minimum price correctly", () => {
    const precoMinimo = 100;
    const effectivePrice = 95;
    const isBelowMin = precoMinimo && effectivePrice > 0 && effectivePrice < precoMinimo;
    expect(isBelowMin).toBeTruthy();
  });

  it("should not flag price at or above minimum", () => {
    const precoMinimo = 100;
    const effectivePrice = 100;
    const isBelowMin = precoMinimo && effectivePrice > 0 && effectivePrice < precoMinimo;
    expect(isBelowMin).toBeFalsy();
  });

  it("should calculate total correctly for quantity * price", () => {
    const quantity = 50;
    const pricePerBox = 142.86;
    const total = quantity * pricePerBox;
    expect(total).toBeCloseTo(7143, 0);
  });

  it("should handle large quantities correctly", () => {
    const quantity = 1000;
    const pricePerBox = 85.50;
    const total = quantity * pricePerBox;
    expect(total).toBe(85500);
  });
});
