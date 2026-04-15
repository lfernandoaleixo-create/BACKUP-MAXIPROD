import { describe, it, expect } from "vitest";

/**
 * Tests for the automatic stock deduction logic (Baixa Automática)
 * 
 * The logic works as follows:
 * 1. Before syncing, snapshot current order totals per codigoItem
 * 2. After syncing new orders, compare totals
 * 3. If orders decreased (delivery/baixa), subtract delta from madeiraStock
 * 4. Never let stock go below 0
 * 5. Record each deduction in stockEditHistory
 */

// Pure function that calculates order totals by code (mirrors the logic in maxiprodGraphQL.ts)
function calculateOrderTotals(orders: Array<{ codigoItem: string; quantidade: string; estadoNota: string }>): Map<string, number> {
  const totals = new Map<string, number>();
  for (const order of orders) {
    if (!order.codigoItem) continue;
    if (order.estadoNota === "Digitação" || order.estadoNota === "Digitacao" || order.estadoNota === "Cancelado") continue;
    const qty = parseFloat(order.quantidade) || 0;
    totals.set(order.codigoItem, (totals.get(order.codigoItem) || 0) + qty);
  }
  return totals;
}

// Pure function that calculates stock deductions based on order deltas
function calculateDeductions(
  previousOrders: Map<string, number>,
  newOrders: Map<string, number>,
  currentStock: Map<string, number>
): Array<{ code: string; previousQty: number; newQty: number; delta: number; oldStock: number; newStock: number }> {
  const deductions: Array<{ code: string; previousQty: number; newQty: number; delta: number; oldStock: number; newStock: number }> = [];
  
  for (const [code, previousQty] of Array.from(previousOrders.entries())) {
    const newQty = newOrders.get(code) || 0;
    const delta = previousQty - newQty;
    
    if (delta > 0) {
      const stock = currentStock.get(code);
      if (stock !== undefined) {
        const newStock = Math.max(0, stock - delta);
        if (newStock !== stock) {
          deductions.push({ code, previousQty, newQty, delta, oldStock: stock, newStock });
        }
      }
    }
  }
  
  return deductions;
}

describe("Baixa Automática - Cálculo de Totais de Pedidos", () => {
  it("deve calcular totais por codigoItem corretamente", () => {
    const orders = [
      { codigoItem: "00001", quantidade: "100", estadoNota: "Aprovado" },
      { codigoItem: "00001", quantidade: "50", estadoNota: "A aprovar" },
      { codigoItem: "00002", quantidade: "200", estadoNota: "Aprovado" },
    ];
    
    const totals = calculateOrderTotals(orders);
    expect(totals.get("00001")).toBe(150);
    expect(totals.get("00002")).toBe(200);
  });

  it("deve excluir pedidos em Digitação do cálculo", () => {
    const orders = [
      { codigoItem: "00001", quantidade: "100", estadoNota: "Aprovado" },
      { codigoItem: "00001", quantidade: "50", estadoNota: "Digitação" },
      { codigoItem: "00002", quantidade: "200", estadoNota: "Digitacao" },
    ];
    
    const totals = calculateOrderTotals(orders);
    expect(totals.get("00001")).toBe(100); // 50 de Digitação excluído
    expect(totals.has("00002")).toBe(false); // todo em Digitação
  });

  it("deve excluir pedidos Cancelados do cálculo", () => {
    const orders = [
      { codigoItem: "00001", quantidade: "100", estadoNota: "Aprovado" },
      { codigoItem: "00001", quantidade: "50", estadoNota: "Cancelado" },
    ];
    
    const totals = calculateOrderTotals(orders);
    expect(totals.get("00001")).toBe(100);
  });

  it("deve ignorar itens sem codigoItem", () => {
    const orders = [
      { codigoItem: "", quantidade: "100", estadoNota: "Aprovado" },
      { codigoItem: "00001", quantidade: "50", estadoNota: "Aprovado" },
    ];
    
    const totals = calculateOrderTotals(orders);
    expect(totals.size).toBe(1);
    expect(totals.get("00001")).toBe(50);
  });

  it("deve lidar com quantidades inválidas como 0", () => {
    const orders = [
      { codigoItem: "00001", quantidade: "abc", estadoNota: "Aprovado" },
      { codigoItem: "00001", quantidade: "50", estadoNota: "Aprovado" },
    ];
    
    const totals = calculateOrderTotals(orders);
    expect(totals.get("00001")).toBe(50); // abc = NaN → 0
  });
});

describe("Baixa Automática - Cálculo de Deduções", () => {
  it("deve calcular dedução quando pedidos diminuem (entrega)", () => {
    const previous = new Map([["00001", 250]]);
    const current = new Map([["00001", 190]]);
    const stock = new Map([["00001", 300]]);
    
    const deductions = calculateDeductions(previous, current, stock);
    expect(deductions).toHaveLength(1);
    expect(deductions[0]).toEqual({
      code: "00001",
      previousQty: 250,
      newQty: 190,
      delta: 60,
      oldStock: 300,
      newStock: 240,
    });
  });

  it("deve deduzir tudo quando todos os pedidos são entregues", () => {
    const previous = new Map([["00001", 250]]);
    const current = new Map<string, number>(); // pedidos zerados
    const stock = new Map([["00001", 300]]);
    
    const deductions = calculateDeductions(previous, current, stock);
    expect(deductions).toHaveLength(1);
    expect(deductions[0].delta).toBe(250);
    expect(deductions[0].newStock).toBe(50); // 300 - 250
  });

  it("deve nunca deixar estoque negativo", () => {
    const previous = new Map([["00001", 500]]);
    const current = new Map<string, number>(); // pedidos zerados
    const stock = new Map([["00001", 200]]); // estoque menor que delta
    
    const deductions = calculateDeductions(previous, current, stock);
    expect(deductions).toHaveLength(1);
    expect(deductions[0].newStock).toBe(0); // Math.max(0, 200 - 500)
  });

  it("não deve deduzir quando pedidos aumentam", () => {
    const previous = new Map([["00001", 100]]);
    const current = new Map([["00001", 200]]); // novos pedidos
    const stock = new Map([["00001", 300]]);
    
    const deductions = calculateDeductions(previous, current, stock);
    expect(deductions).toHaveLength(0);
  });

  it("não deve deduzir quando pedidos permanecem iguais", () => {
    const previous = new Map([["00001", 250]]);
    const current = new Map([["00001", 250]]);
    const stock = new Map([["00001", 300]]);
    
    const deductions = calculateDeductions(previous, current, stock);
    expect(deductions).toHaveLength(0);
  });

  it("não deve deduzir se item não existe no estoque", () => {
    const previous = new Map([["00001", 250]]);
    const current = new Map([["00001", 190]]);
    const stock = new Map<string, number>(); // sem estoque
    
    const deductions = calculateDeductions(previous, current, stock);
    expect(deductions).toHaveLength(0);
  });

  it("deve processar múltiplos itens independentemente", () => {
    const previous = new Map([
      ["00001", 250],
      ["00002", 100],
      ["00003", 50],
    ]);
    const current = new Map([
      ["00001", 190], // diminuiu 60
      ["00002", 100], // igual
      // 00003 sumiu = diminuiu 50
    ]);
    const stock = new Map([
      ["00001", 300],
      ["00002", 200],
      ["00003", 80],
    ]);
    
    const deductions = calculateDeductions(previous, current, stock);
    expect(deductions).toHaveLength(2); // 00001 e 00003
    
    const d1 = deductions.find(d => d.code === "00001");
    expect(d1?.delta).toBe(60);
    expect(d1?.newStock).toBe(240);
    
    const d3 = deductions.find(d => d.code === "00003");
    expect(d3?.delta).toBe(50);
    expect(d3?.newStock).toBe(30);
  });

  it("não deve deduzir quando estoque já é 0", () => {
    const previous = new Map([["00001", 250]]);
    const current = new Map([["00001", 190]]);
    const stock = new Map([["00001", 0]]); // estoque zerado
    
    const deductions = calculateDeductions(previous, current, stock);
    // newStock = Math.max(0, 0 - 60) = 0, same as current → no deduction
    expect(deductions).toHaveLength(0);
  });

  it("cenário real: pedido de 250cx, entregues 60, sobram 190", () => {
    // Cenário descrito pelo usuário:
    // Pedido: 250 caixas
    // Entregues: 60 caixas (dadas baixa no Maxiprod)
    // Pedidos restantes: 190
    // Estoque deve diminuir 60
    const previous = new Map([["00103", 250]]);
    const current = new Map([["00103", 190]]);
    const stock = new Map([["00103", 296]]); // ESPETO P/ QUEIJO COALHO

    const deductions = calculateDeductions(previous, current, stock);
    expect(deductions).toHaveLength(1);
    expect(deductions[0]).toEqual({
      code: "00103",
      previousQty: 250,
      newQty: 190,
      delta: 60,
      oldStock: 296,
      newStock: 236, // 296 - 60
    });
  });

  it("cenário real: todas as 250cx entregues, pedidos zeram", () => {
    // Se todas as 250 forem entregues:
    // Estoque = Disponível (pois pedidos = 0)
    const previous = new Map([["00103", 250]]);
    const current = new Map<string, number>(); // zerou
    const stock = new Map([["00103", 296]]);

    const deductions = calculateDeductions(previous, current, stock);
    expect(deductions).toHaveLength(1);
    expect(deductions[0].delta).toBe(250);
    expect(deductions[0].newStock).toBe(46); // 296 - 250
  });
});
