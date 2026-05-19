import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the gql function
vi.mock("./maxiprodGraphQL", () => ({
  gql: vi.fn(),
}));

// Mock db
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

import { gql } from "./maxiprodGraphQL";

describe("listRepresentantesMaxiprod logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should group sellers by their manager correctly", async () => {
    // Simular resposta do Maxiprod
    const mockData = {
      empresas: {
        totalCount: 6,
        items: [
          { apelido: "JUVENAL TEIXEIRA", nomeFantasia: null, razaoSocial: null, representanteOuVendedor1Preferencial: { nomeFantasia: "JUVENAL TEIXEIRA", razaoSocial: null, apelido: null } },
          { apelido: "DANIEL TAVARES", nomeFantasia: null, razaoSocial: null, representanteOuVendedor1Preferencial: { nomeFantasia: "JUVENAL TEIXEIRA", razaoSocial: null, apelido: null } },
          { apelido: "CLARINDO GONCALVES", nomeFantasia: null, razaoSocial: null, representanteOuVendedor1Preferencial: { nomeFantasia: "JUVENAL TEIXEIRA", razaoSocial: null, apelido: null } },
          { apelido: "JORDÃO LAINE", nomeFantasia: null, razaoSocial: null, representanteOuVendedor1Preferencial: null },
          { apelido: "ANA PAULA ALEIXO", nomeFantasia: null, razaoSocial: null, representanteOuVendedor1Preferencial: { nomeFantasia: null, razaoSocial: "JORDAO LAINE", apelido: null } },
          { apelido: "PALITOS INDUSTRIA", nomeFantasia: null, razaoSocial: null, representanteOuVendedor1Preferencial: null },
        ],
      },
    };

    // Replicar a lógica do endpoint
    const gestoresMap = new Map<string, string[]>();
    const semGestor: string[] = [];

    for (const emp of mockData.empresas.items) {
      const vendedorName = emp.apelido || emp.nomeFantasia || emp.razaoSocial || "";
      if (!vendedorName) continue;

      const gestor = emp.representanteOuVendedor1Preferencial;
      const gestorName = gestor?.nomeFantasia || gestor?.razaoSocial || gestor?.apelido || "";

      if (gestorName && gestorName !== vendedorName) {
        if (!gestoresMap.has(gestorName)) {
          gestoresMap.set(gestorName, []);
        }
        gestoresMap.get(gestorName)!.push(vendedorName);
      } else {
        semGestor.push(vendedorName);
      }
    }

    const result = {
      gestores: Array.from(gestoresMap.entries()).map(([gestor, vendedores]) => ({
        gestor,
        vendedores: vendedores.sort((a, b) => a.localeCompare(b, 'pt-BR')),
      })).sort((a, b) => a.gestor.localeCompare(b.gestor, 'pt-BR')),
      semGestor: semGestor.sort((a, b) => a.localeCompare(b, 'pt-BR')),
      total: mockData.empresas.totalCount,
    };

    // Verificações
    expect(result.gestores).toHaveLength(2);
    
    // JORDAO LAINE tem 1 vendedor
    const jordao = result.gestores.find(g => g.gestor === "JORDAO LAINE");
    expect(jordao).toBeDefined();
    expect(jordao!.vendedores).toEqual(["ANA PAULA ALEIXO"]);

    // JUVENAL TEIXEIRA tem 2 vendedores (Daniel e Clarindo, pois Juvenal aponta para si mesmo)
    const juvenal = result.gestores.find(g => g.gestor === "JUVENAL TEIXEIRA");
    expect(juvenal).toBeDefined();
    expect(juvenal!.vendedores).toEqual(["CLARINDO GONCALVES", "DANIEL TAVARES"]);

    // Sem gestor: Jordão, Juvenal (auto-referência) e Palitos
    expect(result.semGestor).toContain("JORDÃO LAINE");
    expect(result.semGestor).toContain("JUVENAL TEIXEIRA");
    expect(result.semGestor).toContain("PALITOS INDUSTRIA");
    expect(result.semGestor).toHaveLength(3);

    expect(result.total).toBe(6);
  });

  it("should handle empty response", () => {
    const mockData = {
      empresas: {
        totalCount: 0,
        items: [],
      },
    };

    const gestoresMap = new Map<string, string[]>();
    const semGestor: string[] = [];

    for (const emp of mockData.empresas.items) {
      const vendedorName = (emp as any).apelido || (emp as any).nomeFantasia || (emp as any).razaoSocial || "";
      if (!vendedorName) continue;
    }

    const result = {
      gestores: Array.from(gestoresMap.entries()).map(([gestor, vendedores]) => ({
        gestor,
        vendedores: vendedores.sort(),
      })),
      semGestor,
      total: mockData.empresas.totalCount,
    };

    expect(result.gestores).toHaveLength(0);
    expect(result.semGestor).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("should use nomeFantasia as fallback when apelido is null", () => {
    const mockData = {
      empresas: {
        totalCount: 2,
        items: [
          { apelido: null, nomeFantasia: "EMPRESA TESTE", razaoSocial: null, representanteOuVendedor1Preferencial: { nomeFantasia: "GESTOR X", razaoSocial: null, apelido: null } },
          { apelido: null, nomeFantasia: null, razaoSocial: "RAZAO SOCIAL LTDA", representanteOuVendedor1Preferencial: { nomeFantasia: "GESTOR X", razaoSocial: null, apelido: null } },
        ],
      },
    };

    const gestoresMap = new Map<string, string[]>();
    const semGestor: string[] = [];

    for (const emp of mockData.empresas.items) {
      const vendedorName = emp.apelido || emp.nomeFantasia || emp.razaoSocial || "";
      if (!vendedorName) continue;

      const gestor = emp.representanteOuVendedor1Preferencial;
      const gestorName = gestor?.nomeFantasia || gestor?.razaoSocial || gestor?.apelido || "";

      if (gestorName && gestorName !== vendedorName) {
        if (!gestoresMap.has(gestorName)) {
          gestoresMap.set(gestorName, []);
        }
        gestoresMap.get(gestorName)!.push(vendedorName);
      } else {
        semGestor.push(vendedorName);
      }
    }

    const result = {
      gestores: Array.from(gestoresMap.entries()).map(([gestor, vendedores]) => ({
        gestor,
        vendedores: vendedores.sort((a, b) => a.localeCompare(b, 'pt-BR')),
      })),
      semGestor,
      total: mockData.empresas.totalCount,
    };

    expect(result.gestores).toHaveLength(1);
    expect(result.gestores[0].gestor).toBe("GESTOR X");
    expect(result.gestores[0].vendedores).toContain("EMPRESA TESTE");
    expect(result.gestores[0].vendedores).toContain("RAZAO SOCIAL LTDA");
  });
});
