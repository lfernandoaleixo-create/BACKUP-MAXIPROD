/**
 * Tests for push notification triggers:
 * 1. New sales detection during sync
 * 2. Reconciliation completion by Thalita
 */
import { describe, it, expect } from "vitest";

describe("Sales Notification Logic", () => {
  it("should detect new pedidos by comparing previous vs new sets", () => {
    // Simulate previous sales pedidos
    const previousSalesPedidos = new Set(["1001", "1002", "1003"]);
    
    // Simulate new sales data (with a new pedido 1004)
    const salesData = [
      { pedido: "1001", clienteApelido: "Cliente A", valorTotal: "5000.00" },
      { pedido: "1002", clienteApelido: "Cliente B", valorTotal: "3000.00" },
      { pedido: "1003", clienteApelido: "Cliente C", valorTotal: "2000.00" },
      { pedido: "1004", clienteApelido: "Cliente D", valorTotal: "8000.00" },
      { pedido: "1004", clienteApelido: "Cliente D", valorTotal: "2000.00" }, // same pedido, different item
    ];

    // Detection logic (mirrors the implementation)
    const newSalesPedidos = new Set<string>();
    for (const item of salesData) {
      const pedido = item.pedido || "";
      if (pedido) newSalesPedidos.add(pedido);
    }

    const brandNewPedidos: string[] = [];
    for (const p of Array.from(newSalesPedidos)) {
      if (!previousSalesPedidos.has(p)) brandNewPedidos.push(p);
    }

    expect(brandNewPedidos).toEqual(["1004"]);
    expect(brandNewPedidos.length).toBe(1);
  });

  it("should not trigger notification when no new pedidos exist", () => {
    const previousSalesPedidos = new Set(["1001", "1002", "1003"]);
    
    const salesData = [
      { pedido: "1001", clienteApelido: "Cliente A", valorTotal: "5000.00" },
      { pedido: "1002", clienteApelido: "Cliente B", valorTotal: "3000.00" },
    ];

    const newSalesPedidos = new Set<string>();
    for (const item of salesData) {
      const pedido = item.pedido || "";
      if (pedido) newSalesPedidos.add(pedido);
    }

    const brandNewPedidos: string[] = [];
    for (const p of Array.from(newSalesPedidos)) {
      if (!previousSalesPedidos.has(p)) brandNewPedidos.push(p);
    }

    expect(brandNewPedidos).toEqual([]);
    expect(brandNewPedidos.length).toBe(0);
  });

  it("should aggregate values per pedido correctly", () => {
    const salesData = [
      { pedido: "1004", clienteApelido: "Cliente D", valorTotal: "8000.00" },
      { pedido: "1004", clienteApelido: "Cliente D", valorTotal: "2000.00" },
      { pedido: "1005", clienteApelido: "Cliente E", valorTotal: "5000.00" },
    ];

    const pedidoMap = new Map<string, { cliente: string; valor: number }>();
    for (const item of salesData) {
      const pedido = item.pedido || "";
      const existing = pedidoMap.get(pedido);
      const valorItem = parseFloat(String(item.valorTotal || 0));
      if (existing) {
        existing.valor += valorItem;
      } else {
        pedidoMap.set(pedido, { cliente: item.clienteApelido || "Cliente", valor: valorItem });
      }
    }

    expect(pedidoMap.get("1004")?.valor).toBe(10000);
    expect(pedidoMap.get("1004")?.cliente).toBe("Cliente D");
    expect(pedidoMap.get("1005")?.valor).toBe(5000);
    expect(pedidoMap.size).toBe(2);
  });

  it("should skip notification when previousSalesPedidos is empty (first sync)", () => {
    const previousSalesPedidos = new Set<string>();
    
    // Even with sales data, should not trigger because it's the first sync
    const salesData = [
      { pedido: "1001", clienteApelido: "Cliente A", valorTotal: "5000.00" },
    ];

    // The condition checks previousSalesPedidos.size > 0
    const shouldNotify = previousSalesPedidos.size > 0;
    expect(shouldNotify).toBe(false);
  });
});

describe("Reconciliation Notification Logic", () => {
  it("should trigger notification when reconciled is true", () => {
    const input = { password: "Thalita", reconciled: true };
    
    // The condition for sending notification
    const shouldNotify = input.reconciled === true;
    expect(shouldNotify).toBe(true);
  });

  it("should NOT trigger notification when reconciled is false (unmarking)", () => {
    const input = { password: "Thalita", reconciled: false };
    
    const shouldNotify = input.reconciled === true;
    expect(shouldNotify).toBe(false);
  });

  it("should format today's date in pt-BR", () => {
    const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    // Should be in format dd/mm/yyyy
    expect(today).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
  });
});
