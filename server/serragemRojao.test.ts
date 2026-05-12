import { describe, it, expect, vi, beforeEach } from "vitest";
import { serragemRojaoRouter } from "./serragemRojaoRouter";

// Mock the gql function from maxiprodGraphQL
vi.mock("./maxiprodGraphQL", () => ({
  gql: vi.fn(),
}));

import { gql } from "./maxiprodGraphQL";
const mockGql = vi.mocked(gql);

describe("SerragemRojao Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getVendasFaturamento", () => {
    it("should return total and count for SERRAGEM NFs", async () => {
      mockGql.mockResolvedValueOnce({
        notasFiscais: {
          totalCount: 3,
          items: [
            { numero: 103, valorTotal: 1020, emissaoData: "2026-02-04T12:00:00.000-03:00", nfeRetornoCodigo: null },
            { numero: 112, valorTotal: 3686.4, emissaoData: "2026-02-06T12:00:00.000-03:00", nfeRetornoCodigo: null },
            { numero: 200, valorTotal: 1210.96, emissaoData: "2026-05-01T12:00:00.000-03:00", nfeRetornoCodigo: "100" },
          ],
        },
      });

      const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const result = await caller.getVendasFaturamento({
        tipo: "SERRAGEM",
        startDate: null,
        endDate: "2026-05-12",
      });

      expect(result.total).toBe(5917.36);
      expect(result.count).toBe(3);
      expect(result.nfs).toHaveLength(3);
    });

    it("should return total and count for ROJÃO NFs", async () => {
      mockGql.mockResolvedValueOnce({
        notasFiscais: {
          totalCount: 2,
          items: [
            { numero: 50, valorTotal: 50000, emissaoData: "2026-03-01T12:00:00.000-03:00", nfeRetornoCodigo: null },
            { numero: 51, valorTotal: 53500, emissaoData: "2026-03-15T12:00:00.000-03:00", nfeRetornoCodigo: null },
          ],
        },
      });

      const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const result = await caller.getVendasFaturamento({
        tipo: "ROJÃO",
        startDate: null,
        endDate: "2026-05-12",
      });

      expect(result.total).toBe(103500);
      expect(result.count).toBe(2);
    });

    it("should filter out NFs with nfeRetornoCodigo other than 100 or null", async () => {
      mockGql.mockResolvedValueOnce({
        notasFiscais: {
          totalCount: 3,
          items: [
            { numero: 1, valorTotal: 1000, emissaoData: "2026-01-01T12:00:00.000-03:00", nfeRetornoCodigo: null }, // Não Enviada - include
            { numero: 2, valorTotal: 2000, emissaoData: "2026-01-02T12:00:00.000-03:00", nfeRetornoCodigo: "100" }, // Autorizada - include
            { numero: 3, valorTotal: 5000, emissaoData: "2026-01-03T12:00:00.000-03:00", nfeRetornoCodigo: "302" }, // Rejeitada - exclude
          ],
        },
      });

      const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const result = await caller.getVendasFaturamento({
        tipo: "SERRAGEM",
        startDate: null,
        endDate: "2026-05-12",
      });

      expect(result.total).toBe(3000);
      expect(result.count).toBe(2);
      expect(result.nfs).toHaveLength(2);
      expect(result.nfs[0].situacao).toBe("Não Enviada");
      expect(result.nfs[1].situacao).toBe("Autorizada");
    });

    it("should use startDate when provided (period filter)", async () => {
      mockGql.mockResolvedValueOnce({
        notasFiscais: {
          totalCount: 1,
          items: [
            { numero: 10, valorTotal: 5000, emissaoData: "2026-04-15T12:00:00.000-03:00", nfeRetornoCodigo: "100" },
          ],
        },
      });

      const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const result = await caller.getVendasFaturamento({
        tipo: "SERRAGEM",
        startDate: "2026-04-01",
        endDate: "2026-04-30",
      });

      expect(result.total).toBe(5000);
      expect(result.count).toBe(1);

      // Verify the query included startDate
      const queryStr = mockGql.mock.calls[0][0] as string;
      expect(queryStr).toContain("gte:");
      expect(queryStr).toContain("2026-04-01");
    });

    it("should not include gte when startDate is null", async () => {
      mockGql.mockResolvedValueOnce({
        notasFiscais: {
          totalCount: 0,
          items: [],
        },
      });

      const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      await caller.getVendasFaturamento({
        tipo: "SERRAGEM",
        startDate: null,
        endDate: "2026-05-12",
      });

      const queryStr = mockGql.mock.calls[0][0] as string;
      expect(queryStr).not.toContain("gte:");
      expect(queryStr).toContain("lte:");
    });

    it("should handle GraphQL errors gracefully", async () => {
      mockGql.mockRejectedValueOnce(new Error("Network error"));

      const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const result = await caller.getVendasFaturamento({
        tipo: "SERRAGEM",
        startDate: null,
        endDate: "2026-05-12",
      });

      expect(result.total).toBe(0);
      expect(result.count).toBe(0);
      expect(result.nfs).toHaveLength(0);
    });

    it("should return empty when no NFs found", async () => {
      mockGql.mockResolvedValueOnce({
        notasFiscais: {
          totalCount: 0,
          items: [],
        },
      });

      const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const result = await caller.getVendasFaturamento({
        tipo: "ROJÃO",
        startDate: null,
        endDate: "2026-05-12",
      });

      expect(result.total).toBe(0);
      expect(result.count).toBe(0);
      expect(result.nfs).toHaveLength(0);
    });
  });
});
