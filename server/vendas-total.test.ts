/**
 * Test: Vendas total calculation uses valorTotalPedido (with discounts/freight)
 * instead of raw item.valorTotal
 */
import { describe, it, expect } from "vitest";

describe("Vendas total calculation logic", () => {
  // Helper: replicate the exact logic from financialRouter.ts
  function calcVendasTotal(items: Array<{ pedido: string | null; valorTotal: string | null; valorTotalPedido: string | null }>) {
    const pedidoValueMap = new Map<string, number>();
    for (const item of items) {
      const pedido = item.pedido || 'sem-pedido';
      if (!pedidoValueMap.has(pedido)) {
        if (item.valorTotalPedido) {
          pedidoValueMap.set(pedido, Number(item.valorTotalPedido));
        } else {
          pedidoValueMap.set(pedido, Number(item.valorTotal || 0));
        }
      } else {
        const firstItemHasVTP = items.find(i => i.pedido === pedido && i.valorTotalPedido);
        if (!firstItemHasVTP) {
          pedidoValueMap.set(pedido, (pedidoValueMap.get(pedido) || 0) + Number(item.valorTotal || 0));
        }
      }
    }
    return Array.from(pedidoValueMap.values()).reduce((sum, v) => sum + v, 0);
  }

  it("should use valorTotalPedido when available (discount case)", () => {
    // Pedido 837: item.valorTotal = 3135, but pedido has R$210 discount → valorTotalPedido = 2925
    const items = [
      { pedido: "837", valorTotal: "3135.00", valorTotalPedido: "2925.00" },
    ];
    const total = calcVendasTotal(items);
    expect(total).toBe(2925.00);
  });

  it("should use valorTotalPedido when available (freight case)", () => {
    // Pedido 853: item.valorTotal = 740, but pedido has R$118.99 freight → valorTotalPedido = 858.99
    const items = [
      { pedido: "853", valorTotal: "740.00", valorTotalPedido: "858.99" },
    ];
    const total = calcVendasTotal(items);
    expect(total).toBe(858.99);
  });

  it("should fallback to item.valorTotal when valorTotalPedido is null", () => {
    const items = [
      { pedido: "100", valorTotal: "5000.00", valorTotalPedido: null },
    ];
    const total = calcVendasTotal(items);
    expect(total).toBe(5000.00);
  });

  it("should sum multiple items for same pedido when no valorTotalPedido", () => {
    const items = [
      { pedido: "200", valorTotal: "1000.00", valorTotalPedido: null },
      { pedido: "200", valorTotal: "500.00", valorTotalPedido: null },
    ];
    const total = calcVendasTotal(items);
    expect(total).toBe(1500.00);
  });

  it("should NOT sum items when valorTotalPedido exists (it already includes all items)", () => {
    // Pedido with 2 items: item1=1000, item2=500, but valorTotalPedido=1400 (has R$100 discount)
    const items = [
      { pedido: "300", valorTotal: "1000.00", valorTotalPedido: "1400.00" },
      { pedido: "300", valorTotal: "500.00", valorTotalPedido: "1400.00" },
    ];
    const total = calcVendasTotal(items);
    expect(total).toBe(1400.00);
  });

  it("should handle mixed pedidos correctly", () => {
    const items = [
      // Pedido 837: discount
      { pedido: "837", valorTotal: "3135.00", valorTotalPedido: "2925.00" },
      // Pedido 853: freight
      { pedido: "853", valorTotal: "740.00", valorTotalPedido: "858.99" },
      // Pedido 100: no discount/freight
      { pedido: "100", valorTotal: "5000.00", valorTotalPedido: "5000.00" },
      // Pedido 200: no valorTotalPedido (legacy)
      { pedido: "200", valorTotal: "1000.00", valorTotalPedido: null },
    ];
    const total = calcVendasTotal(items);
    // 2925 + 858.99 + 5000 + 1000 = 9783.99
    expect(total).toBeCloseTo(9783.99, 2);
  });

  it("should handle empty items array", () => {
    const total = calcVendasTotal([]);
    expect(total).toBe(0);
  });
});
