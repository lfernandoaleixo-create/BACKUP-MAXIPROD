/**
 * Tests for getSalesDetails returning observacoes and descricoes fields
 * Validates that the sales detail endpoint includes description data for display
 */
import { describe, it, expect } from "vitest";

// Replicate the grouping logic from getSalesDetails
function groupSalesItems(items: Array<{
  pedido: string | null;
  cliente: string | null;
  dataEmissao: string | null;
  valorTotal: string | null;
  estadoNota: string | null;
  estadoConfiguravel: string | null;
  observacoes: string | null;
  descricao: string | null;
}>) {
  const estadoToGrupo = (estado: string | null): string => {
    if (!estado) return "outros";
    const e = estado.toUpperCase();
    if (e === "BAMBU" || e === "FIBRA") return "importacao_revenda";
    if (e === "MADEIRA" || e === "MADEIRA CONTABILIZADO") return "industrializacao";
    if (e === "MADEIRA IMPORTAÇÃO" || e === "MADEIRA IMPORTACAO" || e === "MADEIRA IMPORTADA") return "importacao_mp";
    return "outros";
  };

  const isDigitacao = (nota: string | null) => {
    if (!nota) return false;
    const n = nota.toUpperCase();
    return n === "DIGITAÇÃO" || n === "DIGITACAO";
  };

  const isOutros = (estado: string | null) => estadoToGrupo(estado) === "outros";

  const filtered = items.filter(item => !isDigitacao(item.estadoNota) && !isOutros(item.estadoConfiguravel));

  const pedidoMap = new Map<string, {
    pedido: string; cliente: string; total: number; data: string;
    itens: number; estado: string; grupo: string; observacoes: string; descricoes: string[];
  }>();

  for (const item of filtered) {
    const key = item.pedido || "sem-pedido";
    if (!pedidoMap.has(key)) {
      pedidoMap.set(key, {
        pedido: item.pedido || "-",
        cliente: item.cliente || "-",
        total: 0,
        data: item.dataEmissao?.slice(0, 10) || "-",
        itens: 0,
        estado: item.estadoNota || "-",
        grupo: estadoToGrupo(item.estadoConfiguravel),
        observacoes: item.observacoes || "",
        descricoes: [],
      });
    }
    const entry = pedidoMap.get(key)!;
    entry.total += Number(item.valorTotal || 0);
    entry.itens += 1;
    if (item.descricao && !entry.descricoes.includes(item.descricao)) {
      entry.descricoes.push(item.descricao);
    }
  }

  return Array.from(pedidoMap.values())
    .sort((a, b) => b.total - a.total)
    .map(e => ({ ...e, total: Math.round(e.total * 100) / 100, descricoes: e.descricoes.slice(0, 5) }));
}

describe("getSalesDetails - observacoes and descricoes", () => {
  it("should include observacoes from the first item of a pedido", () => {
    const items = [
      { pedido: "1001", cliente: "Cliente A", dataEmissao: "2026-04-01T00:00:00", valorTotal: "1000.00", estadoNota: "Aprovado", estadoConfiguravel: "BAMBU", observacoes: "Entrega urgente", descricao: "Espeto bambu 25cm" },
      { pedido: "1001", cliente: "Cliente A", dataEmissao: "2026-04-01T00:00:00", valorTotal: "500.00", estadoNota: "Aprovado", estadoConfiguravel: "BAMBU", observacoes: "Entrega urgente", descricao: "Espeto bambu 30cm" },
    ];

    const result = groupSalesItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].observacoes).toBe("Entrega urgente");
  });

  it("should collect unique descricoes from items of same pedido", () => {
    const items = [
      { pedido: "1002", cliente: "Cliente B", dataEmissao: "2026-04-01T00:00:00", valorTotal: "200.00", estadoNota: "Aprovado", estadoConfiguravel: "FIBRA", observacoes: "", descricao: "Vareta fibra 3mm" },
      { pedido: "1002", cliente: "Cliente B", dataEmissao: "2026-04-01T00:00:00", valorTotal: "300.00", estadoNota: "Aprovado", estadoConfiguravel: "FIBRA", observacoes: "", descricao: "Vareta fibra 4mm" },
      { pedido: "1002", cliente: "Cliente B", dataEmissao: "2026-04-01T00:00:00", valorTotal: "100.00", estadoNota: "Aprovado", estadoConfiguravel: "FIBRA", observacoes: "", descricao: "Vareta fibra 3mm" }, // duplicate
    ];

    const result = groupSalesItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].descricoes).toEqual(["Vareta fibra 3mm", "Vareta fibra 4mm"]);
    expect(result[0].itens).toBe(3);
  });

  it("should limit descricoes to 5 items max", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      pedido: "1003",
      cliente: "Cliente C",
      dataEmissao: "2026-04-01T00:00:00",
      valorTotal: "100.00",
      estadoNota: "Aprovado",
      estadoConfiguravel: "MADEIRA",
      observacoes: "",
      descricao: `Produto ${i + 1}`,
    }));

    const result = groupSalesItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].descricoes).toHaveLength(5);
  });

  it("should handle empty observacoes and descricao gracefully", () => {
    const items = [
      { pedido: "1004", cliente: "Cliente D", dataEmissao: "2026-04-01T00:00:00", valorTotal: "500.00", estadoNota: "Aprovado", estadoConfiguravel: "BAMBU", observacoes: null, descricao: null },
    ];

    const result = groupSalesItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].observacoes).toBe("");
    expect(result[0].descricoes).toEqual([]);
  });

  it("should filter out Digitação and Outros items", () => {
    const items = [
      { pedido: "1005", cliente: "Cliente E", dataEmissao: "2026-04-01T00:00:00", valorTotal: "1000.00", estadoNota: "Digitação", estadoConfiguravel: "BAMBU", observacoes: "Test", descricao: "Prod" },
      { pedido: "1006", cliente: "Cliente F", dataEmissao: "2026-04-01T00:00:00", valorTotal: "2000.00", estadoNota: "Aprovado", estadoConfiguravel: "AMOSTRA", observacoes: "Test2", descricao: "Prod2" },
      { pedido: "1007", cliente: "Cliente G", dataEmissao: "2026-04-01T00:00:00", valorTotal: "3000.00", estadoNota: "Aprovado", estadoConfiguravel: "FIBRA", observacoes: "Valid", descricao: "Valid Prod" },
    ];

    const result = groupSalesItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].pedido).toBe("1007");
    expect(result[0].observacoes).toBe("Valid");
  });
});
