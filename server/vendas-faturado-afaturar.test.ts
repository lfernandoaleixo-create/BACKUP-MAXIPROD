import { describe, it, expect } from "vitest";

/**
 * Tests for the proportional distribution logic that ensures
 * Faturado + A Faturar = Valor Total do Período (aba Vendas).
 *
 * Replicates the business logic from salesRouter.ts getAnalytics.
 */

interface PedidoAccum {
  valorTotalPedido: number;
  somaItensBruto: number;
  somaFaturadoBruto: number;
  somaAFaturarBruto: number;
}

interface Item {
  pedido: string;
  valorTotal: number;
  valorTotalPedido: number | null;
  estadoItem: string;
}

function calcTotals(items: Item[]) {
  const pedidoMap = new Map<string, PedidoAccum>();
  for (const item of items) {
    const pedido = item.pedido || "sem-pedido";
    const itemVal = Number(item.valorTotal || 0);
    if (!pedidoMap.has(pedido)) {
      pedidoMap.set(pedido, {
        valorTotalPedido: item.valorTotalPedido ? Number(item.valorTotalPedido) : 0,
        somaItensBruto: itemVal,
        somaFaturadoBruto: item.estadoItem === "Faturado" ? itemVal : 0,
        somaAFaturarBruto: item.estadoItem === "A faturar" ? itemVal : 0,
      });
    } else {
      const p = pedidoMap.get(pedido)!;
      if (!p.valorTotalPedido && item.valorTotalPedido) {
        p.valorTotalPedido = Number(item.valorTotalPedido);
      }
      p.somaItensBruto += itemVal;
      if (item.estadoItem === "Faturado") p.somaFaturadoBruto += itemVal;
      if (item.estadoItem === "A faturar") p.somaAFaturarBruto += itemVal;
    }
  }

  let totalValue = 0;
  let totalFaturado = 0;
  let totalAFaturar = 0;
  Array.from(pedidoMap.values()).forEach((p) => {
    const pedidoTotal = p.valorTotalPedido || p.somaItensBruto;
    totalValue += pedidoTotal;

    if (p.somaItensBruto > 0 && p.valorTotalPedido) {
      const faturadoProporcional = (p.somaFaturadoBruto / p.somaItensBruto) * pedidoTotal;
      totalFaturado += faturadoProporcional;
    } else {
      totalFaturado += p.somaFaturadoBruto;
    }
  });
  totalValue = Math.round(totalValue * 100) / 100;
  totalFaturado = Math.round(totalFaturado * 100) / 100;
  totalAFaturar = Math.round((totalValue - totalFaturado) * 100) / 100;

  return { totalValue, totalFaturado, totalAFaturar };
}

describe("Vendas: Faturado + A Faturar = Valor Total", () => {
  it("should match exactly when no discounts (all items bruto)", () => {
    const items: Item[] = [
      { pedido: "001", valorTotal: 1000, valorTotalPedido: 1000, estadoItem: "Faturado" },
      { pedido: "002", valorTotal: 2000, valorTotalPedido: 2000, estadoItem: "A faturar" },
    ];
    const r = calcTotals(items);
    expect(r.totalFaturado + r.totalAFaturar).toBe(r.totalValue);
    expect(r.totalValue).toBe(3000);
    expect(r.totalFaturado).toBe(1000);
    expect(r.totalAFaturar).toBe(2000);
  });

  it("should distribute discount proportionally (pedido 837 case: R$210 discount)", () => {
    // Pedido 837: 1 item A faturar R$3135, pedido total R$2925 (desconto R$210)
    const items: Item[] = [
      { pedido: "837", valorTotal: 3135, valorTotalPedido: 2925, estadoItem: "A faturar" },
    ];
    const r = calcTotals(items);
    expect(r.totalValue).toBe(2925);
    expect(r.totalFaturado).toBe(0);
    expect(r.totalAFaturar).toBe(2925);
    expect(r.totalFaturado + r.totalAFaturar).toBe(r.totalValue);
  });

  it("should distribute freight proportionally (pedido 853 case: R$118.99 freight)", () => {
    // Pedido 853: 1 item A faturar R$740, pedido total R$858.99 (frete R$118.99)
    const items: Item[] = [
      { pedido: "853", valorTotal: 740, valorTotalPedido: 858.99, estadoItem: "A faturar" },
    ];
    const r = calcTotals(items);
    expect(r.totalValue).toBe(858.99);
    expect(r.totalFaturado).toBe(0);
    expect(r.totalAFaturar).toBe(858.99);
    expect(r.totalFaturado + r.totalAFaturar).toBe(r.totalValue);
  });

  it("should handle mixed faturado/a faturar in same pedido with discount", () => {
    // Pedido with 2 items: one faturado R$600, one a faturar R$400
    // Pedido total R$900 (desconto R$100)
    const items: Item[] = [
      { pedido: "100", valorTotal: 600, valorTotalPedido: 900, estadoItem: "Faturado" },
      { pedido: "100", valorTotal: 400, valorTotalPedido: 900, estadoItem: "A faturar" },
    ];
    const r = calcTotals(items);
    expect(r.totalValue).toBe(900);
    // Faturado: 600/1000 * 900 = 540
    expect(r.totalFaturado).toBe(540);
    // A Faturar: 900 - 540 = 360
    expect(r.totalAFaturar).toBe(360);
    expect(r.totalFaturado + r.totalAFaturar).toBe(r.totalValue);
  });

  it("should handle multiple pedidos with different adjustments", () => {
    const items: Item[] = [
      // Pedido normal sem ajuste
      { pedido: "001", valorTotal: 5000, valorTotalPedido: 5000, estadoItem: "Faturado" },
      // Pedido com desconto
      { pedido: "002", valorTotal: 3135, valorTotalPedido: 2925, estadoItem: "A faturar" },
      // Pedido com frete
      { pedido: "003", valorTotal: 740, valorTotalPedido: 858.99, estadoItem: "A faturar" },
    ];
    const r = calcTotals(items);
    expect(r.totalValue).toBe(8783.99);
    expect(r.totalFaturado + r.totalAFaturar).toBe(r.totalValue);
  });

  it("should fallback to bruto when valorTotalPedido is null", () => {
    const items: Item[] = [
      { pedido: "001", valorTotal: 1000, valorTotalPedido: null, estadoItem: "Faturado" },
      { pedido: "002", valorTotal: 2000, valorTotalPedido: null, estadoItem: "A faturar" },
    ];
    const r = calcTotals(items);
    expect(r.totalValue).toBe(3000);
    expect(r.totalFaturado).toBe(1000);
    expect(r.totalAFaturar).toBe(2000);
    expect(r.totalFaturado + r.totalAFaturar).toBe(r.totalValue);
  });

  it("should handle meia nota (partially invoiced pedido)", () => {
    // Pedido com 3 itens: 2 faturados, 1 a faturar, com desconto
    const items: Item[] = [
      { pedido: "500", valorTotal: 1000, valorTotalPedido: 2700, estadoItem: "Faturado" },
      { pedido: "500", valorTotal: 1000, valorTotalPedido: 2700, estadoItem: "Faturado" },
      { pedido: "500", valorTotal: 1000, valorTotalPedido: 2700, estadoItem: "A faturar" },
    ];
    const r = calcTotals(items);
    expect(r.totalValue).toBe(2700);
    // Faturado: 2000/3000 * 2700 = 1800
    expect(r.totalFaturado).toBe(1800);
    // A Faturar: 2700 - 1800 = 900
    expect(r.totalAFaturar).toBe(900);
    expect(r.totalFaturado + r.totalAFaturar).toBe(r.totalValue);
  });
});
