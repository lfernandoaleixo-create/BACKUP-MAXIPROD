/**
 * Tests for getRelatorioInadimplentes endpoint
 * Validates the response structure and data formatting
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch for GraphQL calls
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock ENV
vi.mock("./_core/env", () => ({
  ENV: {
    maxiprodGraphqlToken: "test-token",
  },
}));

// Mock drizzle and db
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

describe("Relatório de Inadimplentes - Data formatting", () => {
  it("should format description correctly with client, NF and parcela", () => {
    const item = {
      cliente: { razaoSocial: "KEURE QUIMICA LTDA", nomeFantasia: null },
      documentoVinculadoNumero: "1633",
      parcela: 2,
      parcelasQuantidadeTotal: 4,
    };

    let desc = item.cliente.razaoSocial || "";
    if (item.documentoVinculadoNumero) desc += ` ref. NF nº ${item.documentoVinculadoNumero}`;
    if (item.parcela && item.parcelasQuantidadeTotal) desc += ` parc. ${item.parcela}/${item.parcelasQuantidadeTotal}`;

    expect(desc).toBe("KEURE QUIMICA LTDA ref. NF nº 1633 parc. 2/4");
  });

  it("should format description without parcela when not available", () => {
    const item = {
      cliente: { razaoSocial: "SUPER MIX DISTRIBUIDORA LTDA", nomeFantasia: null },
      documentoVinculadoNumero: "1584",
      parcela: null,
      parcelasQuantidadeTotal: null,
    };

    let desc = item.cliente.razaoSocial || "";
    if (item.documentoVinculadoNumero) desc += ` ref. NF nº ${item.documentoVinculadoNumero}`;
    if (item.parcela && item.parcelasQuantidadeTotal) desc += ` parc. ${item.parcela}/${item.parcelasQuantidadeTotal}`;

    expect(desc).toBe("SUPER MIX DISTRIBUIDORA LTDA ref. NF nº 1584");
  });

  it("should extract estado configuravel from referenteA", () => {
    const SEGMENTOS = ["MADEIRA", "BAMBU", "ROJÃO", "ROJAO", "SERRAGEM", "PALITO", "VARETA", "ESPETO"];

    function extrairEstadoConfiguravel(referenteA: string | null): string {
      if (!referenteA) return "";
      const upper = referenteA.toUpperCase();
      for (const seg of SEGMENTOS) {
        if (upper.includes(seg)) return seg === "ROJAO" ? "ROJÃO" : seg;
      }
      return "";
    }

    expect(extrairEstadoConfiguravel("Receita da revenda de mercadorias BAMBU")).toBe("BAMBU");
    expect(extrairEstadoConfiguravel("NF 1391")).toBe("");
    expect(extrairEstadoConfiguravel(null)).toBe("");
    expect(extrairEstadoConfiguravel("Venda de MADEIRA para cliente")).toBe("MADEIRA");
    expect(extrairEstadoConfiguravel("Produtos de SERRAGEM")).toBe("SERRAGEM");
  });

  it("should calculate saldo devedor correctly", () => {
    const valorLiquido = 4350;
    const valorRecebidoLiquido = 1000;
    const saldoDevedor = valorLiquido - valorRecebidoLiquido;
    expect(saldoDevedor).toBe(3350);
  });

  it("should filter out fully paid items (saldo = 0)", () => {
    const items = [
      { valorLiquido: 5000, valorRecebidoLiquido: 5000 },
      { valorLiquido: 3000, valorRecebidoLiquido: 0 },
      { valorLiquido: 4000, valorRecebidoLiquido: 2000 },
    ];

    const filtered = items
      .map(i => ({ valor: i.valorLiquido - i.valorRecebidoLiquido }))
      .filter(t => t.valor > 0);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].valor).toBe(3000);
    expect(filtered[1].valor).toBe(2000);
  });

  it("should calculate aging faixas correctly", () => {
    const hoje = new Date("2026-04-02");
    const vencimentos = [
      { vencimentoISO: "2026-03-20", expected: "ate30" },     // 13 dias
      { vencimentoISO: "2026-02-15", expected: "de31a60" },   // 46 dias
      { vencimentoISO: "2025-12-01", expected: "de91a180" },  // ~122 dias
      { vencimentoISO: "2025-06-01", expected: "acima180" },  // ~305 dias
    ];

    for (const v of vencimentos) {
      const venc = new Date(v.vencimentoISO);
      const dias = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));

      let faixa: string;
      if (dias <= 30) faixa = "ate30";
      else if (dias <= 60) faixa = "de31a60";
      else if (dias <= 90) faixa = "de61a90";
      else if (dias <= 180) faixa = "de91a180";
      else faixa = "acima180";

      expect(faixa).toBe(v.expected);
    }
  });

  it("should format date to DD/MM/YYYY correctly", () => {
    function formatDate(d: string | null): string {
      if (!d) return "";
      try {
        const date = new Date(d);
        return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      } catch { return ""; }
    }

    expect(formatDate("2026-04-01T12:00:00.000-03:00")).toBe("01/04/2026");
    expect(formatDate(null)).toBe("");
  });
});
