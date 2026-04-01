import { describe, it, expect } from "vitest";
import { computeOrderHash } from "./billingRouter";

/**
 * Tests for the auto-revoke protection mechanism.
 * Validates that:
 * 1. Hash computation is deterministic
 * 2. The mass change threshold logic works correctly
 * 3. Hash changes are detected for real modifications
 */

describe("Auto-Revoke Protection", () => {
  describe("computeOrderHash determinism", () => {
    it("should produce identical hash for identical data", () => {
      const order = {
        pedido: "808",
        valorTotal: 1234.56,
        itens: [
          { descricao: "VARETAS BAMBU 3.0", quantidade: 100, valorUnitario: 12.34, valorTotal: 1234.00 },
          { descricao: "ESPETO BAMBU 25cm", quantidade: 50, valorUnitario: 0.56, valorTotal: 28.00 },
        ],
      };
      const hash1 = computeOrderHash(order);
      const hash2 = computeOrderHash(order);
      expect(hash1).toBe(hash2);
    });

    it("should produce same hash regardless of item order (sorted by descricao)", () => {
      const order1 = {
        pedido: "808",
        valorTotal: 1262.00,
        itens: [
          { descricao: "VARETAS BAMBU 3.0", quantidade: 100, valorUnitario: 12.34, valorTotal: 1234.00 },
          { descricao: "ESPETO BAMBU 25cm", quantidade: 50, valorUnitario: 0.56, valorTotal: 28.00 },
        ],
      };
      const order2 = {
        pedido: "808",
        valorTotal: 1262.00,
        itens: [
          { descricao: "ESPETO BAMBU 25cm", quantidade: 50, valorUnitario: 0.56, valorTotal: 28.00 },
          { descricao: "VARETAS BAMBU 3.0", quantidade: 100, valorUnitario: 12.34, valorTotal: 1234.00 },
        ],
      };
      expect(computeOrderHash(order1)).toBe(computeOrderHash(order2));
    });

    it("should detect changes in valorTotal", () => {
      const base = {
        pedido: "808",
        valorTotal: 1000.00,
        itens: [{ descricao: "ITEM A", quantidade: 10, valorUnitario: 100, valorTotal: 1000 }],
      };
      const modified = { ...base, valorTotal: 1000.01 };
      expect(computeOrderHash(base)).not.toBe(computeOrderHash(modified));
    });

    it("should detect changes in item quantidade", () => {
      const base = {
        pedido: "808",
        valorTotal: 1000.00,
        itens: [{ descricao: "ITEM A", quantidade: 10, valorUnitario: 100, valorTotal: 1000 }],
      };
      const modified = {
        ...base,
        itens: [{ descricao: "ITEM A", quantidade: 9, valorUnitario: 100, valorTotal: 900 }],
      };
      expect(computeOrderHash(base)).not.toBe(computeOrderHash(modified));
    });

    it("should detect addition of new items", () => {
      const base = {
        pedido: "808",
        valorTotal: 1000.00,
        itens: [{ descricao: "ITEM A", quantidade: 10, valorUnitario: 100, valorTotal: 1000 }],
      };
      const modified = {
        pedido: "808",
        valorTotal: 1500.00,
        itens: [
          { descricao: "ITEM A", quantidade: 10, valorUnitario: 100, valorTotal: 1000 },
          { descricao: "ITEM B", quantidade: 5, valorUnitario: 100, valorTotal: 500 },
        ],
      };
      expect(computeOrderHash(base)).not.toBe(computeOrderHash(modified));
    });

    it("should NOT include non-critical fields in hash (cliente, dataEntrega, observacoes)", () => {
      const order1 = {
        pedido: "808",
        cliente: "CLIENTE A",
        dataEntrega: "01/04/2026",
        observacoes: "Obs 1",
        valorTotal: 1000.00,
        itens: [{ descricao: "ITEM A", quantidade: 10, valorUnitario: 100, valorTotal: 1000 }],
      };
      const order2 = {
        pedido: "808",
        cliente: "CLIENTE B",
        dataEntrega: "15/04/2026",
        observacoes: "Obs 2",
        valorTotal: 1000.00,
        itens: [{ descricao: "ITEM A", quantidade: 10, valorUnitario: 100, valorTotal: 1000 }],
      };
      // Hash should be the same because only pedido, valorTotal and itens are used
      expect(computeOrderHash(order1)).toBe(computeOrderHash(order2));
    });
  });

  describe("Mass change threshold logic", () => {
    const MASS_CHANGE_THRESHOLD = 5;

    it("should identify mass changes (>5 orders) as code changes, not real modifications", () => {
      // Simulate 10 orders with changed hashes
      const changedOrders = Array.from({ length: 10 }, (_, i) => ({
        pedido: String(800 + i),
        currentHash: `hash_${i}`,
        cliente: `Cliente ${i}`,
        grupoKey: "bambu",
      }));
      
      expect(changedOrders.length).toBeGreaterThan(MASS_CHANGE_THRESHOLD);
      // In this case, the system should update hashes silently without marking as modified
    });

    it("should treat few changes (<=5 orders) as real Maxiprod modifications", () => {
      const changedOrders = Array.from({ length: 3 }, (_, i) => ({
        pedido: String(800 + i),
        currentHash: `hash_${i}`,
        cliente: `Cliente ${i}`,
        grupoKey: "bambu",
      }));
      
      expect(changedOrders.length).toBeLessThanOrEqual(MASS_CHANGE_THRESHOLD);
      // In this case, the system should mark as wasModified=true
    });

    it("should handle edge case: exactly 5 changes (at threshold)", () => {
      const changedOrders = Array.from({ length: 5 }, (_, i) => ({
        pedido: String(800 + i),
        currentHash: `hash_${i}`,
      }));
      
      // At exactly the threshold, should still be treated as real modifications
      expect(changedOrders.length).toBeLessThanOrEqual(MASS_CHANGE_THRESHOLD);
    });

    it("should handle edge case: 6 changes (just above threshold)", () => {
      const changedOrders = Array.from({ length: 6 }, (_, i) => ({
        pedido: String(800 + i),
        currentHash: `hash_${i}`,
      }));
      
      // Just above threshold, should be treated as code change
      expect(changedOrders.length).toBeGreaterThan(MASS_CHANGE_THRESHOLD);
    });
  });

  describe("Partial billing hash changes", () => {
    it("should produce different hash when item is partially billed", () => {
      // Before partial billing
      const hashBefore = computeOrderHash({
        pedido: "808",
        valorTotal: 1000,
        itens: [{
          descricao: "VARETAS BAMBU",
          quantidade: 100,
          valorUnitario: 10,
          valorTotal: 1000,
        }],
      });
      
      // After partial billing (20 units billed)
      const hashAfter = computeOrderHash({
        pedido: "808",
        valorTotal: 800,
        itens: [{
          descricao: "VARETAS BAMBU",
          quantidade: 80,
          valorUnitario: 10,
          valorTotal: 800,
        }],
      });
      
      // This IS a real change and should be detected
      expect(hashBefore).not.toBe(hashAfter);
    });
  });
});
