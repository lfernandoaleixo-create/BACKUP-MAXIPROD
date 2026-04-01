import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for "Faturado c/ entrega futura" handling
 * 
 * Business rules:
 * 1. In Sales tab (getAnalytics): counted as "Faturado" (financially billed)
 * 2. In Billing/Production tab (getOpenOrders): appears as "Em Aberto" (goods not yet delivered)
 * 3. Should NOT be excluded by isOutros or isDigitacao filters
 * 4. Should NOT be removed from billing authorizations or production acceptance
 */

// Mock the database
vi.mock("./db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onDuplicateKeyUpdate: vi.fn().mockReturnThis(),
    set: vi.fn().mockResolvedValue({}),
  },
}));

// Test the classification logic directly
import { isAprovadoOuFaturado, isOutros, isDigitacao, estadoToGrupo } from "../shared/grupoClassification";

describe("Faturado c/ entrega futura - Classification", () => {
  it("isAprovadoOuFaturado should accept 'Faturado c/ entrega futura' as estadoNota", () => {
    expect(isAprovadoOuFaturado("Faturado c/ entrega futura")).toBe(true);
  });

  it("isDigitacao should NOT flag 'Faturado c/ entrega futura'", () => {
    expect(isDigitacao("Faturado c/ entrega futura")).toBe(false);
  });

  it("isOutros should NOT flag BAMBU (estadoConfiguravel of pedido 808)", () => {
    expect(isOutros("BAMBU")).toBe(false);
    expect(estadoToGrupo("BAMBU")).toBe("importacao_revenda");
  });
});

describe("Faturado c/ entrega futura - Filtering logic", () => {
  const mockItems = [
    { pedido: "808", estadoItem: "Faturado c/ entrega futura", estadoNota: "Faturado c/ entrega futura", estadoConfiguravel: "BAMBU", valorTotal: "7650.00", cliente: "Cliente A" },
    { pedido: "100", estadoItem: "Faturado", estadoNota: "Faturado", estadoConfiguravel: "BAMBU", valorTotal: "1000.00", cliente: "Cliente B" },
    { pedido: "200", estadoItem: "A faturar", estadoNota: "Aprovado", estadoConfiguravel: "MADEIRA", valorTotal: "2000.00", cliente: "Cliente C" },
    { pedido: "300", estadoItem: "Faturado parcial", estadoNota: "Faturado parcial", estadoConfiguravel: "FIBRA", valorTotal: "3000.00", cliente: "Cliente D" },
  ];

  it("totalFaturado should include 'Faturado', 'Faturado c/ entrega futura', and 'Faturado parcial'", () => {
    const totalFaturado = mockItems
      .filter((i) => i.estadoItem === "Faturado" || i.estadoItem === "Faturado c/ entrega futura" || i.estadoItem === "Faturado parcial")
      .reduce((sum, i) => sum + Number(i.valorTotal || 0), 0);
    
    // 1000 + 7650 + 3000 = 11650
    expect(totalFaturado).toBe(11650);
  });

  it("totalAFaturar should only include 'A faturar'", () => {
    const totalAFaturar = mockItems
      .filter((i) => i.estadoItem === "A faturar")
      .reduce((sum, i) => sum + Number(i.valorTotal || 0), 0);
    
    expect(totalAFaturar).toBe(2000);
  });

  it("openItems filter should include 'Faturado c/ entrega futura' for production/billing", () => {
    const openItems = mockItems.filter(i => 
      (i.estadoItem === "A faturar" || i.estadoItem === "Faturado parcial" || i.estadoItem === "Faturado c/ entrega futura") &&
      isAprovadoOuFaturado(i.estadoNota)
    );
    
    // Should include pedido 808 (Faturado c/ entrega futura), 200 (A faturar), 300 (Faturado parcial)
    expect(openItems.length).toBe(3);
    expect(openItems.map(i => i.pedido)).toContain("808");
    expect(openItems.map(i => i.pedido)).toContain("200");
    expect(openItems.map(i => i.pedido)).toContain("300");
  });

  it("billedItems filter should NOT include 'Faturado c/ entrega futura'", () => {
    const billedItems = mockItems.filter(i => i.estadoItem === "Faturado");
    
    // Only pedido 100
    expect(billedItems.length).toBe(1);
    expect(billedItems[0].pedido).toBe("100");
  });

  it("authorization cleanup should NOT remove 'Faturado c/ entrega futura' pedidos", () => {
    // Simulate the cleanup logic from billingRouter
    const pedidoStates = new Map<string, Set<string>>();
    for (const item of mockItems) {
      if (!pedidoStates.has(item.pedido)) pedidoStates.set(item.pedido, new Set());
      pedidoStates.get(item.pedido)!.add(item.estadoItem);
    }

    const toRemove: string[] = [];
    for (const [pedido, states] of pedidoStates) {
      // Remove if all items are "Faturado"
      if (states.size === 1 && states.has("Faturado")) {
        toRemove.push(pedido);
      }
    }

    // Only pedido 100 should be removed (fully Faturado)
    expect(toRemove).toContain("100");
    // Pedido 808 should NOT be removed
    expect(toRemove).not.toContain("808");
  });
});
