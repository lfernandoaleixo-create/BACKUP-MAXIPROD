import { describe, it, expect } from "vitest";
import { computeOrderHash } from "./billingRouter";

/**
 * Test the order hash computation logic used for auto-revoking production acceptance.
 * The hash is computed from CRITICAL order data only:
 *   - pedido, valorTotal, and itens (descricao, quantidade, valorUnitario, valorTotal)
 *
 * Non-critical fields (observacoes, dataEntrega, cliente, codigoItem, dataEntregaItem)
 * are EXCLUDED from the hash to prevent unnecessary revocations.
 */

const baseOrder = {
  pedido: "12345",
  cliente: "Cliente Teste",
  dataEntrega: "21/03/2026",
  observacoes: "Entregar pela manhã",
  valorTotal: 5000.50,
  itens: [
    { descricao: "VARETA BAMBU 3.0MM X 25CM", quantidade: 100, valorUnitario: 25.00, valorTotal: 2500.25, dataEntregaItem: "21/03/2026", codigoItem: "001" },
    { descricao: "VARETA BAMBU 2.5MM X 20CM", quantidade: 100, valorUnitario: 25.00, valorTotal: 2500.25, dataEntregaItem: "21/03/2026", codigoItem: "002" },
  ],
};

describe("computeOrderHash - critical fields only", () => {
  it("should produce a consistent 64-char hex hash", () => {
    const hash = computeOrderHash(baseOrder);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should produce the same hash for identical data", () => {
    const hash1 = computeOrderHash(baseOrder);
    const hash2 = computeOrderHash({ ...baseOrder });
    expect(hash1).toBe(hash2);
  });

  it("should produce the same hash regardless of item order", () => {
    const reversed = { ...baseOrder, itens: [...baseOrder.itens].reverse() };
    const hash1 = computeOrderHash(baseOrder);
    const hash2 = computeOrderHash(reversed);
    expect(hash1).toBe(hash2);
  });

  // === CRITICAL CHANGES: should trigger revoke ===

  it("should produce different hash when quantidade changes", () => {
    const modified = {
      ...baseOrder,
      itens: [
        { ...baseOrder.itens[0], quantidade: 200 }, // changed from 100 to 200
        baseOrder.itens[1],
      ],
    };
    const hash1 = computeOrderHash(baseOrder);
    const hash2 = computeOrderHash(modified);
    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hash when order valorTotal changes", () => {
    const modified = { ...baseOrder, valorTotal: 6000.00 };
    const hash1 = computeOrderHash(baseOrder);
    const hash2 = computeOrderHash(modified);
    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hash when item valorUnitario changes", () => {
    const modified = {
      ...baseOrder,
      itens: [
        { ...baseOrder.itens[0], valorUnitario: 30.00 }, // changed
        baseOrder.itens[1],
      ],
    };
    const hash1 = computeOrderHash(baseOrder);
    const hash2 = computeOrderHash(modified);
    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hash when item valorTotal changes", () => {
    const modified = {
      ...baseOrder,
      itens: [
        { ...baseOrder.itens[0], valorTotal: 3000.00 }, // changed
        baseOrder.itens[1],
      ],
    };
    const hash1 = computeOrderHash(baseOrder);
    const hash2 = computeOrderHash(modified);
    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hash when an item is added", () => {
    const modified = {
      ...baseOrder,
      itens: [
        ...baseOrder.itens,
        { descricao: "ESPETO BAMBU 30CM", quantidade: 50, valorUnitario: 10.00, valorTotal: 500.00, dataEntregaItem: "21/03/2026", codigoItem: "003" },
      ],
    };
    const hash1 = computeOrderHash(baseOrder);
    const hash2 = computeOrderHash(modified);
    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hash when an item is removed", () => {
    const modified = {
      ...baseOrder,
      itens: [baseOrder.itens[0]],
    };
    const hash1 = computeOrderHash(baseOrder);
    const hash2 = computeOrderHash(modified);
    expect(hash1).not.toBe(hash2);
  });

  // === NON-CRITICAL CHANGES: should NOT trigger revoke ===

  it("should produce SAME hash when observacoes changes (non-critical)", () => {
    const modified = { ...baseOrder, observacoes: "Entregar à tarde" };
    const hash1 = computeOrderHash(baseOrder);
    const hash2 = computeOrderHash(modified);
    expect(hash1).toBe(hash2); // SAME - observacoes is not critical
  });

  it("should produce SAME hash when dataEntrega changes (non-critical)", () => {
    const modified = { ...baseOrder, dataEntrega: "25/03/2026" };
    const hash1 = computeOrderHash(baseOrder);
    const hash2 = computeOrderHash(modified);
    expect(hash1).toBe(hash2); // SAME - dataEntrega is not critical
  });

  it("should produce SAME hash when cliente changes (non-critical)", () => {
    const modified = { ...baseOrder, cliente: "Outro Cliente" };
    const hash1 = computeOrderHash(baseOrder);
    const hash2 = computeOrderHash(modified);
    expect(hash1).toBe(hash2); // SAME - cliente is not critical
  });

  it("should produce SAME hash when codigoItem changes (non-critical)", () => {
    const modified = {
      ...baseOrder,
      itens: [
        { ...baseOrder.itens[0], codigoItem: "999" }, // changed
        baseOrder.itens[1],
      ],
    };
    const hash1 = computeOrderHash(baseOrder);
    const hash2 = computeOrderHash(modified);
    expect(hash1).toBe(hash2); // SAME - codigoItem is not critical
  });

  it("should produce SAME hash when dataEntregaItem changes (non-critical)", () => {
    const modified = {
      ...baseOrder,
      itens: [
        { ...baseOrder.itens[0], dataEntregaItem: "30/03/2026" }, // changed
        baseOrder.itens[1],
      ],
    };
    const hash1 = computeOrderHash(baseOrder);
    const hash2 = computeOrderHash(modified);
    expect(hash1).toBe(hash2); // SAME - dataEntregaItem is not critical
  });

  // === EDGE CASES ===

  it("should handle empty observacoes and dataEntrega", () => {
    const order1 = { ...baseOrder, observacoes: "", dataEntrega: "" };
    const hash = computeOrderHash(order1);
    expect(hash).toHaveLength(64);
  });

  it("should handle null codigoItem gracefully", () => {
    const order = {
      ...baseOrder,
      itens: [
        { ...baseOrder.itens[0], codigoItem: null },
        baseOrder.itens[1],
      ],
    };
    const hash = computeOrderHash(order);
    expect(hash).toHaveLength(64);
  });

  it("should handle rounding consistently (avoid floating point issues)", () => {
    const order1 = { ...baseOrder, valorTotal: 5000.505 };
    const order2 = { ...baseOrder, valorTotal: 5000.505 };
    const hash1 = computeOrderHash(order1);
    const hash2 = computeOrderHash(order2);
    expect(hash1).toBe(hash2);
  });

  it("should handle order without optional fields", () => {
    const minimalOrder = {
      pedido: "999",
      valorTotal: 100,
      itens: [{ descricao: "ITEM", quantidade: 1, valorUnitario: 100, valorTotal: 100 }],
    };
    const hash = computeOrderHash(minimalOrder);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
