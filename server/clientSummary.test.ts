import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { salesOrders, accountsReceivable } from "../drizzle/schema";
import { eq } from "drizzle-orm";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("sales.getClientSummary", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);

  it("returns null for non-existent client", async () => {
    const result = await caller.sales.getClientSummary({
      clienteName: "CLIENTE_INEXISTENTE_XYZ_12345",
    });
    // Should return null or empty data
    expect(result).toBeDefined();
    if (result) {
      expect(result.orders.totalPedidos).toBe(0);
    }
  }, 15000);

  it("returns correct structure with 4 order status fields", async () => {
    // Seed test data
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const testClient = "__TEST_CLIENT_SUMMARY__";

    // Clean up any previous test data
    await db.delete(salesOrders).where(eq(salesOrders.cliente, testClient));
    await db.delete(accountsReceivable).where(eq(accountsReceivable.cliente, testClient));

    // Insert test orders with different statuses
    await db.insert(salesOrders).values([
      {
        pedido: "T001",
        cliente: testClient,
        dataEmissao: "2026-01-10",
        estadoNota: "Faturado",
        estadoItem: "Faturado",
        valorTotal: "1000.00",
        valorTotalPedido: "1000.00",
        quantidade: "10",
        descricao: "Produto A",
      },
      {
        pedido: "T002",
        cliente: testClient,
        dataEmissao: "2026-02-15",
        estadoNota: "Aprovado",
        estadoItem: "A faturar",
        valorTotal: "500.00",
        valorTotalPedido: "500.00",
        quantidade: "5",
        descricao: "Produto B",
      },
      {
        pedido: "T003",
        cliente: testClient,
        dataEmissao: "2026-03-01",
        estadoNota: "A aprovar",
        estadoItem: "A aprovar",
        valorTotal: "300.00",
        valorTotalPedido: "300.00",
        quantidade: "3",
        descricao: "Produto C",
      },
      {
        pedido: "T004",
        cliente: testClient,
        dataEmissao: "2026-03-05",
        estadoNota: "Digitação",
        estadoItem: "Digitação",
        valorTotal: "200.00",
        valorTotalPedido: "200.00",
        quantidade: "2",
        descricao: "Produto D",
      },
    ]);

    // Insert test receivables - including duplicates to test deduplication
    await db.insert(accountsReceivable).values([
      {
        maxiprodId: 99901,
        cliente: testClient,
        documentoVinculadoNumero: "NF100",
        estado: "RECEBIDO",
        valorOriginal: "1000.00",
        valorRecebidoLiquido: "1000.00",
        vencimentoData: "2026-02-10",
        emissaoData: "2026-01-10",
        parcela: 1,
        parcelasQuantidadeTotal: 1,
        bancoNome: "Banco do Brasil",
      },
      {
        maxiprodId: 99902,
        cliente: testClient,
        documentoVinculadoNumero: "T002",
        estado: "EMITIDO",
        valorOriginal: "500.00",
        valorRecebidoLiquido: "0",
        vencimentoData: "2026-03-15",
        emissaoData: "2026-02-15",
        parcela: 1,
        parcelasQuantidadeTotal: 1,
      },
      // DUPLICATE: same doc+parcela+valor+vencimento but older maxiprodId with different state
      {
        maxiprodId: 99900,
        cliente: testClient,
        documentoVinculadoNumero: "T002",
        estado: "RECEBIDO",
        valorOriginal: "500.00",
        valorRecebidoLiquido: "500.00",
        vencimentoData: "2026-03-15",
        emissaoData: "2026-02-15",
        parcela: 1,
        parcelasQuantidadeTotal: 1,
      },
    ]);

    try {
      const result = await caller.sales.getClientSummary({
        clienteName: testClient,
      });

      expect(result).not.toBeNull();
      if (!result) return;

      // Verify 4 order status counts
      expect(result.orders).toHaveProperty("pedidosFaturados");
      expect(result.orders).toHaveProperty("pedidosAFaturar");
      expect(result.orders).toHaveProperty("pedidosAprovar");
      expect(result.orders).toHaveProperty("pedidosEmDigitacao");

      // Verify correct counts
      expect(result.orders.pedidosFaturados).toBe(1);
      expect(result.orders.pedidosAFaturar).toBe(1);
      expect(result.orders.pedidosAprovar).toBe(1);
      expect(result.orders.pedidosEmDigitacao).toBe(1);
      expect(result.orders.totalPedidos).toBe(4);

      // Verify values
      expect(result.orders.valorFaturado).toBe(1000);
      expect(result.orders.valorAFaturar).toBe(500);
      expect(result.orders.valorAprovar).toBe(300);
      expect(result.orders.valorEmDigitacao).toBe(200);

      // Verify deduplication: T002 has 2 records but should only count as 1 (EMITIDO, the newer one)
      // The older RECEBIDO (maxiprodId=99900) should be discarded
      expect(result.receivables.parcelasEmAberto).toBeGreaterThanOrEqual(1);
      // T002 should be EMITIDO (newer), not RECEBIDO (older)
      const t002Group = result.groupedReceivables.find((g: any) => 
        g.docNumero === "T002" || g.pedidoNumero === "T002"
      );
      if (t002Group) {
        // Should have only 1 titulo (deduplicated), and it should be EMITIDO
        expect(t002Group.titulos.length).toBe(1);
        expect(t002Group.titulos[0].estado).toBe("EMITIDO");
      }

      // Verify recentOrders has notasFiscais field
      expect(result.recentOrders.length).toBeGreaterThan(0);
      for (const order of result.recentOrders) {
        expect(order).toHaveProperty("notasFiscais");
        expect(Array.isArray(order.notasFiscais)).toBe(true);
      }

      // Verify groupedReceivables
      expect(result.groupedReceivables).toBeDefined();
      expect(result.groupedReceivables.length).toBeGreaterThan(0);
    } finally {
      // Cleanup
      await db.delete(salesOrders).where(eq(salesOrders.cliente, testClient));
      await db.delete(accountsReceivable).where(eq(accountsReceivable.cliente, testClient));
    }
  }, 15000);

  it("accepts optional tiposFilter parameter without error", async () => {
    const result = await caller.sales.getClientSummary({
      clienteName: "CLIENTE_INEXISTENTE_XYZ_12345",
      tiposFilter: ["TITULO"],
    });
    expect(result).toBeDefined();
    if (result) {
      expect(result.orders.totalPedidos).toBe(0);
      // Should still have receivables structure
      expect(result.receivables).toBeDefined();
      expect(result.receivables.valorAReceber).toBeDefined();
    }
  }, 15000);

  it("accepts all tipo filter values", async () => {
    const result = await caller.sales.getClientSummary({
      clienteName: "CLIENTE_INEXISTENTE_XYZ_12345",
      tiposFilter: ["TITULO", "RECEITA", "ADIANTAMENTO", "TITULO_PEDIDO_DE_VENDA"],
    });
    expect(result).toBeDefined();
    if (result) {
      expect(result.receivables).toBeDefined();
      expect(result.receivables.valorEmAbertoLive).toBeDefined();
      expect(result.receivables.valorDescontados).toBeDefined();
    }
  }, 15000);

  it("returns inadimplencia field in response", async () => {
    const result = await caller.sales.getClientSummary({
      clienteName: "CLIENTE_INEXISTENTE_XYZ_12345",
    });
    expect(result).toBeDefined();
    if (result) {
      // inadimplencia should always be present
      expect(result.inadimplencia).toBeDefined();
      expect(result.inadimplencia.isInadimplente).toBe(false);
      expect(result.inadimplencia.titulos).toEqual([]);
      expect(result.inadimplencia.totalValor).toBe(0);
      expect(result.inadimplencia.totalTitulos).toBe(0);
    }
  }, 15000);

  it("works without tiposFilter (backward compatible)", async () => {
    const result = await caller.sales.getClientSummary({
      clienteName: "CLIENTE_INEXISTENTE_XYZ_12345",
    });
    expect(result).toBeDefined();
    if (result) {
      expect(result.orders).toBeDefined();
      expect(result.receivables).toBeDefined();
      expect(result.inadimplencia).toBeDefined();
    }
  }, 15000);
});
