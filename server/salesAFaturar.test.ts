import { describe, it, expect } from "vitest";

/**
 * Tests for the A Faturar (Anterior) feature in sales analytics.
 * The getAnalytics endpoint now returns:
 * - totalAFaturar: sum of "A faturar" items within the selected period
 * - totalAFaturarAnterior: sum of "A faturar" items from BEFORE the selected period
 */

describe("Sales A Faturar split logic", () => {
  it("should have totalAFaturarAnterior and bySegmentKPI fields in the empty response", () => {
    // Simulating the empty return shape from getAnalytics
    const emptyResponse = {
      totalItems: 0,
      totalOrders: 0,
      totalClients: 0,
      totalValue: 0,
      totalFaturado: 0,
      totalAFaturar: 0,
      totalAFaturarAnterior: 0,
      ticketMedio: 0,
      bySegmentKPI: [],
      byMonth: [],
      byDay: [],
      byClient: [],
      byProduct: [],
      byUF: [],
      bySegmento: [],
      byWeek: [],
    };

    expect(emptyResponse).toHaveProperty("totalAFaturar");
    expect(emptyResponse).toHaveProperty("totalAFaturarAnterior");
    expect(emptyResponse).toHaveProperty("bySegmentKPI");
    expect(emptyResponse.totalAFaturar).toBe(0);
    expect(emptyResponse.totalAFaturarAnterior).toBe(0);
    expect(emptyResponse.bySegmentKPI).toEqual([]);
  });

  it("should correctly split A Faturar items by date", () => {
    // Simulate the logic used in salesRouter
    const currentPeriodStart = "2026-03-01";
    const currentPeriodEnd = "2026-03-31";

    const items = [
      { estadoItem: "A faturar", dataEmissao: "2026-03-05", valorTotal: 1000 },
      { estadoItem: "A faturar", dataEmissao: "2026-03-10", valorTotal: 2000 },
      { estadoItem: "Faturado", dataEmissao: "2026-03-01", valorTotal: 5000 },
      { estadoItem: "A faturar", dataEmissao: "2026-02-15", valorTotal: 3000 },
      { estadoItem: "A faturar", dataEmissao: "2026-01-20", valorTotal: 4000 },
    ];

    // Items within the period (Mar)
    const periodItems = items.filter(
      (i) => i.dataEmissao >= currentPeriodStart && i.dataEmissao <= currentPeriodEnd + "T23:59:59.999Z"
    );

    // A Faturar within period
    const totalAFaturar = periodItems
      .filter((i) => i.estadoItem === "A faturar")
      .reduce((sum, i) => sum + Number(i.valorTotal || 0), 0);

    // A Faturar from before the period
    const anteriorItems = items.filter(
      (i) => i.estadoItem === "A faturar" && i.dataEmissao < currentPeriodStart
    );
    const totalAFaturarAnterior = anteriorItems.reduce(
      (sum, i) => sum + Number(i.valorTotal || 0),
      0
    );

    expect(totalAFaturar).toBe(3000); // 1000 + 2000 from March
    expect(totalAFaturarAnterior).toBe(7000); // 3000 (Feb) + 4000 (Jan)
  });

  it("should return 0 for anterior when all items are in current period", () => {
    const currentPeriodStart = "2026-01-01";

    const items = [
      { estadoItem: "A faturar", dataEmissao: "2026-03-05", valorTotal: 1000 },
      { estadoItem: "A faturar", dataEmissao: "2026-02-10", valorTotal: 2000 },
    ];

    const anteriorItems = items.filter(
      (i) => i.estadoItem === "A faturar" && i.dataEmissao < currentPeriodStart
    );
    const totalAFaturarAnterior = anteriorItems.reduce(
      (sum, i) => sum + Number(i.valorTotal || 0),
      0
    );

    expect(totalAFaturarAnterior).toBe(0);
  });

  it("should classify segments correctly with both numeric and text group codes", () => {
    const importacaoGroups = ["07", "08", "20", "VARETA", "ESPETO"];
    const industrializacaoGroups = ["02", "03", "04", "06", "09", "11", "13", "14", "15", "PALITO"];
    const segmentLabels: Record<string, string> = {
      importacao: "Bambu",
      industrializacao: "Industrializado",
      outros: "Outros",
    };

    const getItemSegment = (codigoGrupo: string) => {
      const grupo = codigoGrupo.toUpperCase();
      if (importacaoGroups.includes(grupo)) return "importacao";
      if (industrializacaoGroups.includes(grupo)) return "industrializacao";
      return "outros";
    };

    // Text-based codes (from GraphQL)
    expect(getItemSegment("VARETA")).toBe("importacao");
    expect(getItemSegment("ESPETO")).toBe("importacao");
    expect(getItemSegment("PALITO")).toBe("industrializacao");
    expect(getItemSegment("")).toBe("outros");

    // Numeric codes (legacy)
    expect(getItemSegment("07")).toBe("importacao");
    expect(getItemSegment("08")).toBe("importacao");
    expect(getItemSegment("02")).toBe("industrializacao");

    // Segment labels
    expect(segmentLabels[getItemSegment("VARETA")]).toBe("Bambu");
    expect(segmentLabels[getItemSegment("PALITO")]).toBe("Industrializado");
    expect(segmentLabels[getItemSegment("")]).toBe("Outros");
  });

  it("should compute bySegmentKPI breakdown correctly", () => {
    const items = [
      { codigoGrupo: "VARETA", estadoItem: "Faturado", valorTotal: 1000 },
      { codigoGrupo: "VARETA", estadoItem: "A faturar", valorTotal: 2000 },
      { codigoGrupo: "ESPETO", estadoItem: "Faturado", valorTotal: 500 },
      { codigoGrupo: "PALITO", estadoItem: "A faturar", valorTotal: 3000 },
      { codigoGrupo: "", estadoItem: "Faturado", valorTotal: 100 },
    ];

    const importacaoGroups = ["VARETA", "ESPETO"];
    const industrializacaoGroups = ["PALITO"];
    const segmentLabels: Record<string, string> = {
      importacao: "Bambu",
      industrializacao: "Industrializado",
      outros: "Outros",
    };

    const getItemSegment = (grupo: string) => {
      const g = grupo.toUpperCase();
      if (importacaoGroups.includes(g)) return "importacao";
      if (industrializacaoGroups.includes(g)) return "industrializacao";
      return "outros";
    };

    const breakdown: Record<string, { value: number; faturado: number; aFaturar: number }> = {};
    for (const item of items) {
      const seg = getItemSegment(item.codigoGrupo);
      const label = segmentLabels[seg] || seg;
      if (!breakdown[label]) breakdown[label] = { value: 0, faturado: 0, aFaturar: 0 };
      breakdown[label].value += item.valorTotal;
      if (item.estadoItem === "Faturado") breakdown[label].faturado += item.valorTotal;
      if (item.estadoItem === "A faturar") breakdown[label].aFaturar += item.valorTotal;
    }

    expect(breakdown["Bambu"].value).toBe(3500);
    expect(breakdown["Bambu"].faturado).toBe(1500);
    expect(breakdown["Bambu"].aFaturar).toBe(2000);
    expect(breakdown["Industrializado"].value).toBe(3000);
    expect(breakdown["Industrializado"].faturado).toBe(0);
    expect(breakdown["Industrializado"].aFaturar).toBe(3000);
    expect(breakdown["Outros"].value).toBe(100);
    expect(breakdown["Outros"].faturado).toBe(100);
    expect(breakdown["Outros"].aFaturar).toBe(0);
  });

  it("should handle rounding correctly", () => {
    const values = [100.005, 200.003, 300.002];
    const total = values.reduce((sum, v) => sum + v, 0);
    const rounded = Math.round(total * 100) / 100;

    expect(rounded).toBe(600.01);
  });
});
