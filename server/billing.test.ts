import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Mock the GraphQL fetch to avoid real API calls during tests
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// We need to import after mocking
import { billingRouter } from "./billingRouter";
import { router } from "./_core/trpc";

describe("Billing Router", () => {
  describe("getInvoicesForOrders", () => {
    it("should return empty invoicesByPedido when pedidos array is empty", async () => {
      // Create a caller for the billing router
      const caller = billingRouter.createCaller({
        user: null,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.getInvoicesForOrders({ pedidos: [] });
      expect(result).toEqual({ invoicesByPedido: {} });
    });

    it("should accept up to 200 pedidos", async () => {
      // This tests the zod validation
      const caller = billingRouter.createCaller({
        user: null,
        req: {} as any,
        res: {} as any,
      });

      // Should not throw for 200 pedidos
      const pedidos = Array.from({ length: 200 }, (_, i) => String(i + 1));
      
      // Mock the GraphQL response for pedido items
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            itensDosPedidosDeVendas: {
              totalCount: 0,
              items: [],
            },
          },
        }),
      });

      const result = await caller.getInvoicesForOrders({ pedidos });
      expect(result).toEqual({ invoicesByPedido: {} });
    });

    it("should reject more than 200 pedidos", async () => {
      const caller = billingRouter.createCaller({
        user: null,
        req: {} as any,
        res: {} as any,
      });

      const pedidos = Array.from({ length: 201 }, (_, i) => String(i + 1));
      
      await expect(
        caller.getInvoicesForOrders({ pedidos })
      ).rejects.toThrow();
    });

    it("should fetch and group NFs by pedido number", async () => {
      const caller = billingRouter.createCaller({
        user: null,
        req: {} as any,
        res: {} as any,
      });

      // Mock: first call returns pedido items
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            itensDosPedidosDeVendas: {
              totalCount: 2,
              items: [
                { id: 100, pedidoDeVenda: { numero: "541" } },
                { id: 101, pedidoDeVenda: { numero: "542" } },
              ],
            },
          },
        }),
      });

      // Mock: second call returns NF items linked to those pedido items
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            itensDasNotasFiscais: {
              totalCount: 2,
              items: [
                {
                  itemDoPedidoDeVendaId: 100,
                  notaFiscal: {
                    numero: "1967",
                    serie: "1",
                    chaveDeAcesso: "31260275627628012955010000019671234567890",
                    emissaoData: "2026-02-20",
                    valorTotal: 48000,
                  },
                },
                {
                  itemDoPedidoDeVendaId: 101,
                  notaFiscal: {
                    numero: "1968",
                    serie: "1",
                    chaveDeAcesso: "31260275627628012955010000019681234567890",
                    emissaoData: "2026-02-20",
                    valorTotal: 48000,
                  },
                },
              ],
            },
          },
        }),
      });

      const result = await caller.getInvoicesForOrders({ pedidos: ["541", "542"] });

      expect(result.invoicesByPedido).toBeDefined();
      expect(result.invoicesByPedido["541"]).toHaveLength(1);
      expect(result.invoicesByPedido["541"][0].numero).toBe("1967");
      expect(result.invoicesByPedido["541"][0].chaveDeAcesso).toBe("31260275627628012955010000019671234567890");
      expect(result.invoicesByPedido["542"]).toHaveLength(1);
      expect(result.invoicesByPedido["542"][0].numero).toBe("1968");
    });

    it("should deduplicate NFs with same number and serie for the same pedido", async () => {
      const caller = billingRouter.createCaller({
        user: null,
        req: {} as any,
        res: {} as any,
      });

      // Mock: pedido items (2 items from same pedido)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            itensDosPedidosDeVendas: {
              totalCount: 2,
              items: [
                { id: 200, pedidoDeVenda: { numero: "600" } },
                { id: 201, pedidoDeVenda: { numero: "600" } },
              ],
            },
          },
        }),
      });

      // Mock: both items linked to the same NF
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            itensDasNotasFiscais: {
              totalCount: 2,
              items: [
                {
                  itemDoPedidoDeVendaId: 200,
                  notaFiscal: {
                    numero: "2000",
                    serie: "1",
                    chaveDeAcesso: "12345",
                    emissaoData: "2026-03-01",
                    valorTotal: 10000,
                  },
                },
                {
                  itemDoPedidoDeVendaId: 201,
                  notaFiscal: {
                    numero: "2000",
                    serie: "1",
                    chaveDeAcesso: "12345",
                    emissaoData: "2026-03-01",
                    valorTotal: 10000,
                  },
                },
              ],
            },
          },
        }),
      });

      const result = await caller.getInvoicesForOrders({ pedidos: ["600"] });

      // Should have only 1 NF (deduplicated)
      expect(result.invoicesByPedido["600"]).toHaveLength(1);
      expect(result.invoicesByPedido["600"][0].numero).toBe("2000");
    });

    it("should handle GraphQL errors gracefully", async () => {
      const caller = billingRouter.createCaller({
        user: null,
        req: {} as any,
        res: {} as any,
      });

      // Mock: API returns error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const result = await caller.getInvoicesForOrders({ pedidos: ["541"] });
      
      // Should return empty instead of throwing
      expect(result).toEqual({ invoicesByPedido: {} });
    });
  });
});
