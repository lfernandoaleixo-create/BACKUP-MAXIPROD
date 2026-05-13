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

describe("SerragemRojao Router - getRecebido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns total and count for Serragem by crossing NFs with Contas a Receber", async () => {
    // First call: fetch NFs with estadoConfiguravel SERRAGEM
    mockGql.mockResolvedValueOnce({
      notasFiscais: {
        totalCount: 3,
        items: [
          { numero: 1001 },
          { numero: 1002 },
          { numero: 1003 },
        ],
      },
    });

    // Second call: fetch Contas a Receber RECEBIDO
    mockGql.mockResolvedValueOnce({
      contaAReceber: {
        totalCount: 4,
        items: [
          { valorRecebidoLiquido: 10000, documentoVinculadoNumero: "1001" },
          { valorRecebidoLiquido: 15000, documentoVinculadoNumero: "1002" },
          { valorRecebidoLiquido: 5000, documentoVinculadoNumero: "9999" }, // NF não pertence a SERRAGEM
          { valorRecebidoLiquido: 23250.67, documentoVinculadoNumero: "1003" },
        ],
      },
    });

    const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    const result = await caller.getRecebido({
      tipo: "SERRAGEM",
      startDate: null,
      endDate: "2026-05-12",
    });

    // Should only match NFs 1001, 1002, 1003 (not 9999)
    expect(result.total).toBeCloseTo(48250.67, 2);
    expect(result.count).toBe(3);
  });

  it("returns zero when no NFs match Contas a Receber", async () => {
    // NFs
    mockGql.mockResolvedValueOnce({
      notasFiscais: {
        totalCount: 2,
        items: [
          { numero: 2001 },
          { numero: 2002 },
        ],
      },
    });

    // Contas a Receber - none match the NFs
    mockGql.mockResolvedValueOnce({
      contaAReceber: {
        totalCount: 2,
        items: [
          { valorRecebidoLiquido: 5000, documentoVinculadoNumero: "9998" },
          { valorRecebidoLiquido: 3000, documentoVinculadoNumero: "9999" },
        ],
      },
    });

    const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    const result = await caller.getRecebido({
      tipo: "SERRAGEM",
      startDate: null,
      endDate: "2026-05-12",
    });

    expect(result.total).toBe(0);
    expect(result.count).toBe(0);
  });

  it("uses default start date 2026-02-01 for Serragem when startDate is null", async () => {
    mockGql.mockResolvedValueOnce({
      notasFiscais: { totalCount: 0, items: [] },
    });
    mockGql.mockResolvedValueOnce({
      contaAReceber: { totalCount: 0, items: [] },
    });

    const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    await caller.getRecebido({
      tipo: "SERRAGEM",
      startDate: null,
      endDate: "2026-05-12",
    });

    // Second call should have liquidacaoData with gte 2026-02-01
    expect(mockGql).toHaveBeenCalledTimes(2);
    const secondCallQuery = mockGql.mock.calls[1][0] as string;
    expect(secondCallQuery).toContain("2026-02-01");
    expect(secondCallQuery).toContain("RECEBIDO");
  });

  it("handles API errors gracefully returning zero", async () => {
    mockGql.mockRejectedValueOnce(new Error("Network error"));

    const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    const result = await caller.getRecebido({
      tipo: "SERRAGEM",
      startDate: null,
      endDate: "2026-05-12",
    });

    expect(result.total).toBe(0);
    expect(result.count).toBe(0);
  });

  it("handles paginated NFs correctly", async () => {
    // First page of NFs
    mockGql.mockResolvedValueOnce({
      notasFiscais: {
        totalCount: 2,
        items: [{ numero: 3001 }],
      },
    });
    // Second page of NFs (simulating pagination with take=1000 but totalCount=2)
    // Actually with take=1000 and totalCount=2, first page returns all 2
    // Let's test with totalCount > items returned
    mockGql.mockReset();
    
    // First call: NFs page 1 (totalCount=1500, returns 1000)
    mockGql.mockResolvedValueOnce({
      notasFiscais: {
        totalCount: 1500,
        items: Array.from({ length: 1000 }, (_, i) => ({ numero: i + 1 })),
      },
    });
    // Second call: NFs page 2 (remaining 500)
    mockGql.mockResolvedValueOnce({
      notasFiscais: {
        totalCount: 1500,
        items: Array.from({ length: 500 }, (_, i) => ({ numero: i + 1001 })),
      },
    });
    // Third call: Contas a Receber - matches NF 500
    mockGql.mockResolvedValueOnce({
      contaAReceber: {
        totalCount: 1,
        items: [
          { valorRecebidoLiquido: 7500, documentoVinculadoNumero: "500" },
        ],
      },
    });

    const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    const result = await caller.getRecebido({
      tipo: "SERRAGEM",
      startDate: "2026-02-01",
      endDate: "2026-05-12",
    });

    expect(result.total).toBe(7500);
    expect(result.count).toBe(1);
  });
});

describe("SerragemRojao Router - getContasPagas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("separates sócios from regular payments correctly", async () => {
    mockGql.mockResolvedValueOnce({
      contaAPagar: {
        totalCount: 3,
        items: [
          {
            valorPagoLiquido: 5000,
            liquidacaoData: "2026-03-10T00:00:00",
            referenteA: "RETIRADA MARÇO",
            contaDeDestino: { codigo: "458", descricao: "Gilson - Retirada" },
            fornecedor: { apelido: "GILSON ALEIXO", razaoSocial: "Gilson" },
          },
          {
            valorPagoLiquido: 3000,
            liquidacaoData: "2026-03-11T00:00:00",
            referenteA: "LUCRO MARÇO",
            contaDeDestino: { codigo: "459", descricao: "Fernando - Retirada" },
            fornecedor: { apelido: "FERNANDO ALEIXO", razaoSocial: "Fernando" },
          },
          {
            valorPagoLiquido: 2000,
            liquidacaoData: "2026-03-12T00:00:00",
            referenteA: "ENERGIA ELÉTRICA",
            contaDeDestino: { codigo: "496", descricao: "Despesa - Serragem" },
            fornecedor: { apelido: "CPFL", razaoSocial: "CPFL Paulista" },
          },
        ],
      },
    });

    const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    const result = await caller.getContasPagas({
      tipo: "SERRAGEM",
      startDate: null,
      endDate: "2026-05-12",
    });

    // Total bruto = 5000 + 3000 + 2000 = 10000
    // Retirada sócios = 5000 + 3000 = 8000
    // Contas Pagas = total bruto - retirada sócios = 10000 - 8000 = 2000
    // Saídas Total = total bruto = 10000
    expect(result.saidasTotal).toBe(10000);
    expect(result.retiradaSocios).toBe(8000);
    expect(result.contasPagas).toBe(2000);
    expect(result.countSocios).toBe(2);
    expect(result.contasPagasDetalhado).toHaveLength(1); // Only CPFL
    expect(result.contasPagasDetalhado[0].fornecedor).toBe("CPFL");
  });

  it("identifies sócios by conta de destino (458/459/460), not by fornecedor name", async () => {
    mockGql.mockResolvedValueOnce({
      contaAPagar: {
        totalCount: 3,
        items: [
          {
            valorPagoLiquido: 4000,
            liquidacaoData: "2026-04-01T00:00:00",
            referenteA: "PIX PARA GENOVEVA", // Doesn't mention RETIRADA but goes to conta 458
            contaDeDestino: { codigo: "458", descricao: "Gilson - Retirada" },
            fornecedor: { apelido: "GENOVEVA ARAUJO", razaoSocial: "Genoveva" },
          },
          {
            valorPagoLiquido: 6000,
            liquidacaoData: "2026-04-02T00:00:00",
            referenteA: "RETIRADA ABRIL",
            contaDeDestino: { codigo: "460", descricao: "Bruno - Retirada" },
            fornecedor: { apelido: "BRUNO ALEIXO", razaoSocial: "Bruno" },
          },
          {
            valorPagoLiquido: 1000,
            liquidacaoData: "2026-04-03T00:00:00",
            referenteA: "FOLHA PAGAMENTO",
            contaDeDestino: { codigo: "496", descricao: "Despesa - Serragem" },
            fornecedor: { apelido: "PALITOS INDUSTRIA", razaoSocial: "Palitos" },
          },
        ],
      },
    });

    const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    const result = await caller.getContasPagas({
      tipo: "SERRAGEM",
      startDate: null,
      endDate: "2026-05-12",
    });

    // Both Genoveva (conta 458) and Bruno (conta 460) are sócios by conta de destino
    expect(result.retiradaSocios).toBe(10000); // 4000 + 6000
    expect(result.contasPagas).toBe(1000); // 11000 - 10000
    expect(result.saidasTotal).toBe(11000);
    expect(result.countSocios).toBe(2);
  });

  it("handles API errors gracefully", async () => {
    mockGql.mockRejectedValueOnce(new Error("API timeout"));

    const caller = serragemRojaoRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    const result = await caller.getContasPagas({
      tipo: "ROJÃO",
      startDate: null,
      endDate: "2026-05-12",
    });

    expect(result.contasPagas).toBe(0);
    expect(result.retiradaSocios).toBe(0);
    expect(result.saidasTotal).toBe(0);
  });
});
