import { describe, it, expect } from "vitest";
import { computeOrderHash } from "./billingRouter";

describe("Order Hash Stability", () => {
  it("should produce same hash regardless of item accumulation order", () => {
    // Simulate two items with values that could cause floating point issues
    const item1 = { descricao: "VARETAS BAMBU 3.0", quantidade: 100, valorUnitario: 12.34, valorTotal: 1234.00 };
    const item2 = { descricao: "ESPETO BAMBU 25cm", quantidade: 50, valorUnitario: 5.67, valorTotal: 283.50 };
    
    // Order A: item1 first, then item2
    const totalA = Math.round((1234.00 + 283.50) * 100) / 100;
    const hashA = computeOrderHash({
      pedido: "123",
      valorTotal: totalA,
      itens: [item1, item2],
    });
    
    // Order B: item2 first, then item1
    const totalB = Math.round((283.50 + 1234.00) * 100) / 100;
    const hashB = computeOrderHash({
      pedido: "123",
      valorTotal: totalB,
      itens: [item2, item1],
    });
    
    expect(hashA).toBe(hashB); // Items are sorted by descricao in hash
  });

  it("should detect floating point accumulation instability", () => {
    // These values are known to cause floating point issues
    const values = [0.1, 0.2, 0.3, 0.7, 0.11, 0.13];
    
    // Sum in order A
    let sumA = 0;
    for (const v of values) sumA += v;
    
    // Sum in order B (reversed)
    let sumB = 0;
    for (const v of [...values].reverse()) sumB += v;
    
    // These may NOT be equal due to floating point!
    const roundedA = Math.round(sumA * 100) / 100;
    const roundedB = Math.round(sumB * 100) / 100;
    
    console.log(`Sum A: ${sumA}, rounded: ${roundedA}`);
    console.log(`Sum B: ${sumB}, rounded: ${roundedB}`);
    
    // After rounding to 2 decimals, they should be equal
    expect(roundedA).toBe(roundedB);
  });

  it("should show that valorTotal accumulation can differ based on item order", () => {
    // Real-world scenario: 3 items with prices that cause FP issues
    const items = [
      { valorTotal: 1234.56 },
      { valorTotal: 789.33 },
      { valorTotal: 456.11 },
    ];
    
    // Accumulate in order 1
    let total1 = 0;
    for (const i of items) total1 += i.valorTotal;
    
    // Accumulate in order 2 (reversed)
    let total2 = 0;
    for (const i of [...items].reverse()) total2 += i.valorTotal;
    
    // Accumulate in order 3 (shuffled)
    let total3 = 0;
    total3 += items[1].valorTotal;
    total3 += items[0].valorTotal;
    total3 += items[2].valorTotal;
    
    const r1 = Math.round(total1 * 100) / 100;
    const r2 = Math.round(total2 * 100) / 100;
    const r3 = Math.round(total3 * 100) / 100;
    
    console.log(`Total 1: ${total1} -> ${r1}`);
    console.log(`Total 2: ${total2} -> ${r2}`);
    console.log(`Total 3: ${total3} -> ${r3}`);
    
    // They should all be equal after rounding
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  it("should show problematic case with many items", () => {
    // Simulate a real order with many items that have fractional values
    const itemValues = [
      33.45, 67.89, 12.34, 99.99, 45.67, 
      78.12, 23.45, 56.78, 89.01, 34.56,
      11.11, 22.22, 33.33, 44.44, 55.55,
    ];
    
    // Sum in original order
    let sum1 = 0;
    for (const v of itemValues) sum1 += v;
    
    // Sum in reversed order
    let sum2 = 0;
    for (const v of [...itemValues].reverse()) sum2 += v;
    
    // Sum in random order
    const shuffled = [...itemValues].sort(() => Math.random() - 0.5);
    let sum3 = 0;
    for (const v of shuffled) sum3 += v;
    
    console.log(`Sum original: ${sum1}`);
    console.log(`Sum reversed: ${sum2}`);
    console.log(`Sum shuffled: ${sum3}`);
    console.log(`Diff original vs reversed: ${Math.abs(sum1 - sum2)}`);
    
    // After rounding to 2 decimals
    const r1 = Math.round(sum1 * 100) / 100;
    const r2 = Math.round(sum2 * 100) / 100;
    const r3 = Math.round(sum3 * 100) / 100;
    
    console.log(`Rounded: ${r1} vs ${r2} vs ${r3}`);
    
    // Check if rounding eliminates the difference
    // This test documents the behavior - it may or may not pass
    expect(r1).toBe(r2);
  });

  it("should demonstrate the REAL problem: vtEfetivo calculation with partial billing", () => {
    // When quantidadeFaturada changes between syncs, the hash WILL change
    // This is the most likely cause of the auto-revoke
    
    // Sync 1: item not yet partially billed
    const hash1 = computeOrderHash({
      pedido: "808",
      valorTotal: 1000,
      itens: [{
        descricao: "VARETAS BAMBU",
        quantidade: 100,
        valorUnitario: 10,
        valorTotal: 1000,
      }],
    });
    
    // Sync 2: item now partially billed (quantidadeFaturada = 20)
    // qtdEfetiva = 100 - 20 = 80
    // vtEfetivo = 80 * 10 = 800
    const hash2 = computeOrderHash({
      pedido: "808",
      valorTotal: 800,
      itens: [{
        descricao: "VARETAS BAMBU",
        quantidade: 80,
        valorUnitario: 10,
        valorTotal: 800,
      }],
    });
    
    // Hashes WILL be different - this is expected but causes auto-revoke
    expect(hash1).not.toBe(hash2);
    console.log("Hash changes when quantidadeFaturada changes - this triggers auto-revoke!");
  });
});
