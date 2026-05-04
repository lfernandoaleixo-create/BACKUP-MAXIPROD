import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { accountsReceivable, salesOrders } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Test salesMetrics.getInadimplenciaPorVendedor
 * Verifies that the inadimplência data uses the same logic as the Inadimplência tab:
 * - estado = "EMITIDO"
 * - tipo IN (TITULO, RECEITA, ADIANTAMENTO)
 * - vencimentoData <= cutoff (previous business day)
 * - valorAReceber = valorLiquido - valorRecebidoLiquido > 0
 */

// Test data IDs to clean up
const TEST_PREFIX = "TSM_";
const TEST_CLIENTE = `${TEST_PREFIX}CLI_A`;
const TEST_CLIENTE_2 = `${TEST_PREFIX}CLI_B`;

describe("salesMetrics.getInadimplenciaPorVendedor", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let insertedIds: number[] = [];

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Insert test receivables that are overdue (EMITIDO, past due date, valid type)
    const pastDate = "2025-01-15T00:00:00";
    
    // Insert test data
    const result1 = await db.insert(accountsReceivable).values({
      maxiprodId: 999901,
      cliente: TEST_CLIENTE,
      valorLiquido: "1000.00",
      valorRecebidoLiquido: "200.00", // valorAReceber = 800.00
      vencimentoData: pastDate,
      estado: "EMITIDO",
      tipo: "TITULO",
      empresaNome: "Teste Empresa",
      referenteA: "NF 99901",
    });
    insertedIds.push(Number((result1 as any).insertId || (result1 as any)[0]?.insertId));

    const result2 = await db.insert(accountsReceivable).values({
      maxiprodId: 999902,
      cliente: TEST_CLIENTE,
      valorLiquido: "500.00",
      valorRecebidoLiquido: "0.00", // valorAReceber = 500.00
      vencimentoData: pastDate,
      estado: "EMITIDO",
      tipo: "RECEITA",
      empresaNome: "Teste Empresa",
      referenteA: "NF 99902",
    });
    insertedIds.push(Number((result2 as any).insertId || (result2 as any)[0]?.insertId));

    const result3 = await db.insert(accountsReceivable).values({
      maxiprodId: 999903,
      cliente: TEST_CLIENTE_2,
      valorLiquido: "2000.00",
      valorRecebidoLiquido: "500.00", // valorAReceber = 1500.00
      vencimentoData: pastDate,
      estado: "EMITIDO",
      tipo: "TITULO",
      empresaNome: "Teste Empresa",
      referenteA: "NF 99903",
    });
    insertedIds.push(Number((result3 as any).insertId || (result3 as any)[0]?.insertId));

    // Insert one that should NOT appear (CANCELADO estado)
    const result4 = await db.insert(accountsReceivable).values({
      maxiprodId: 999904,
      cliente: TEST_CLIENTE,
      valorLiquido: "9999.00",
      valorRecebidoLiquido: "0.00",
      vencimentoData: pastDate,
      estado: "CANCELADO", // Should be excluded
      tipo: "TITULO",
      empresaNome: "Teste Empresa",
      referenteA: "NF 99904",
    });
    insertedIds.push(Number((result4 as any).insertId || (result4 as any)[0]?.insertId));

    // Insert one that should NOT appear (TITULO_PEDIDO_DE_VENDA type)
    const result5 = await db.insert(accountsReceivable).values({
      maxiprodId: 999905,
      cliente: TEST_CLIENTE,
      valorLiquido: "8888.00",
      valorRecebidoLiquido: "0.00",
      vencimentoData: pastDate,
      estado: "EMITIDO",
      tipo: "TITULO_PEDIDO_DE_VENDA", // Should be excluded
      empresaNome: "Teste Empresa",
      referenteA: "NF 99905",
    });
    insertedIds.push(Number((result5 as any).insertId || (result5 as any)[0]?.insertId));

    // Insert one that should NOT appear (future date - not yet overdue)
    const result6 = await db.insert(accountsReceivable).values({
      maxiprodId: 999906,
      cliente: TEST_CLIENTE,
      valorLiquido: "7777.00",
      valorRecebidoLiquido: "0.00",
      vencimentoData: "2099-12-31T00:00:00", // Far future
      estado: "EMITIDO",
      tipo: "TITULO",
      empresaNome: "Teste Empresa",
      referenteA: "NF 99906",
    });
    insertedIds.push(Number((result6 as any).insertId || (result6 as any)[0]?.insertId));

    // Insert a sales order to map TEST_CLIENTE to a vendedor
    await db.insert(salesOrders).values({
      pedido: `${TEST_PREFIX}PED001`,
      cliente: TEST_CLIENTE,
      representante: "PAULA",
      dataEmissao: "2025-01-10",
      valorTotal: "1000.00",
      estadoNota: "Aprovado",
    });

    await db.insert(salesOrders).values({
      pedido: `${TEST_PREFIX}PED002`,
      cliente: TEST_CLIENTE_2,
      representante: "GILSON",
      dataEmissao: "2025-01-10",
      valorTotal: "2000.00",
      estadoNota: "Aprovado",
    });
  });

  afterAll(async () => {
    if (!db) return;
    // Clean up test data
    for (const id of insertedIds) {
      if (id) {
        await db.delete(accountsReceivable).where(eq(accountsReceivable.id, id));
      }
    }
    await db.delete(salesOrders).where(sql`${salesOrders.pedido} LIKE 'TSM_%'`);
  });

  it("should return inadimplência data grouped by vendedor", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const result = await caller.salesMetrics.getInadimplenciaPorVendedor();

    // Should be an array
    expect(Array.isArray(result)).toBe(true);

    // Find our test vendedores (they might be mapped via local salesOrders or "Não identificado")
    // The important thing is that our test clients appear with correct values
    const allClientes = result.flatMap(v => v.clientes.map(c => c.nome));
    
    // TEST_CLIENTE should appear (has 2 valid overdue titles: 800 + 500 = 1300)
    expect(allClientes).toContain(TEST_CLIENTE);
    
    // TEST_CLIENTE_2 should appear (has 1 valid overdue title: 1500)
    expect(allClientes).toContain(TEST_CLIENTE_2);

    // Find the entry for TEST_CLIENTE and verify values
    let clienteAData: any = null;
    for (const v of result) {
      const found = v.clientes.find(c => c.nome === TEST_CLIENTE);
      if (found) { clienteAData = found; break; }
    }
    expect(clienteAData).not.toBeNull();
    expect(clienteAData.totalDevido).toBeCloseTo(1300, 0); // 800 + 500
    expect(clienteAData.qtdTitulos).toBe(2); // 2 valid titles

    // Find the entry for TEST_CLIENTE_2
    let clienteBData: any = null;
    for (const v of result) {
      const found = v.clientes.find(c => c.nome === TEST_CLIENTE_2);
      if (found) { clienteBData = found; break; }
    }
    expect(clienteBData).not.toBeNull();
    expect(clienteBData.totalDevido).toBeCloseTo(1500, 0);
    expect(clienteBData.qtdTitulos).toBe(1);
  });

  it("should exclude CANCELADO estado and invalid types", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const result = await caller.salesMetrics.getInadimplenciaPorVendedor();

    // Find TEST_CLIENTE data
    let clienteAData: any = null;
    for (const v of result) {
      const found = v.clientes.find(c => c.nome === TEST_CLIENTE);
      if (found) { clienteAData = found; break; }
    }

    // Should only have 2 titles (not 4 - excludes CANCELADO and TITULO_PEDIDO_DE_VENDA)
    expect(clienteAData).not.toBeNull();
    expect(clienteAData.qtdTitulos).toBe(2);
    // Total should be 1300 (800 + 500), not including the 9999 CANCELADO or 8888 invalid type
    expect(clienteAData.totalDevido).toBeCloseTo(1300, 0);
  });

  it("should exclude future-dated receivables", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const result = await caller.salesMetrics.getInadimplenciaPorVendedor();

    // The 7777 future-dated title should NOT be included
    let clienteAData: any = null;
    for (const v of result) {
      const found = v.clientes.find(c => c.nome === TEST_CLIENTE);
      if (found) { clienteAData = found; break; }
    }

    // Total should still be 1300 (not 1300 + 7777)
    expect(clienteAData).not.toBeNull();
    expect(clienteAData.totalDevido).toBeCloseTo(1300, 0);
  });

  it("should return clientes sorted by totalDevido descending within each vendedor", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const result = await caller.salesMetrics.getInadimplenciaPorVendedor();

    // Each vendedor's clientes should be sorted by totalDevido desc
    for (const v of result) {
      for (let i = 1; i < v.clientes.length; i++) {
        expect(v.clientes[i - 1].totalDevido).toBeGreaterThanOrEqual(v.clientes[i].totalDevido);
      }
    }

    // Overall result should be sorted by totalDevido desc
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].totalDevido).toBeGreaterThanOrEqual(result[i].totalDevido);
    }
  });

  it("should have correct response shape", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const result = await caller.salesMetrics.getInadimplenciaPorVendedor();

    expect(result.length).toBeGreaterThan(0);
    const first = result[0];
    expect(first).toHaveProperty("vendedor");
    expect(first).toHaveProperty("qtdClientesInadimplentes");
    expect(first).toHaveProperty("totalDevido");
    expect(first).toHaveProperty("clientes");
    expect(Array.isArray(first.clientes)).toBe(true);
    if (first.clientes.length > 0) {
      expect(first.clientes[0]).toHaveProperty("nome");
      expect(first.clientes[0]).toHaveProperty("totalDevido");
      expect(first.clientes[0]).toHaveProperty("qtdTitulos");
    }
  });
});
