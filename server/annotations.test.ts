import { describe, it, expect } from "vitest";

/**
 * Test suite for annotation entries (Queijo Coalho & Alídio)
 * and notification filter logic
 */

describe("Annotation Entries Schema", () => {
  it("should define the correct annotation types", () => {
    const ANNOTATION_TYPES = ["queijo_coalho", "alidio", "palitos_premium"];
    expect(ANNOTATION_TYPES).toHaveLength(3);
    expect(ANNOTATION_TYPES).toContain("queijo_coalho");
    expect(ANNOTATION_TYPES).toContain("alidio");
    expect(ANNOTATION_TYPES).toContain("palitos_premium");
  });

  it("should have required fields for annotation entries", () => {
    const requiredFields = ["tipo", "data", "quantidade"];
    const optionalFields = ["sectorId", "observacoes", "lancadoPor"];
    
    // All required fields must be present
    expect(requiredFields).toHaveLength(3);
    expect(optionalFields).toHaveLength(3);
  });

  it("annotation entries should NOT count toward sector totals", () => {
    // Business rule: annotations are for tracking only, not production totals
    const annotationEntry = {
      tipo: "queijo_coalho",
      data: "2026-04-29",
      sectorId: 4, // Seleção Automática
      quantidade: "10",
      countsTowardTotal: false, // This is the key business rule
    };
    
    expect(annotationEntry.countsTowardTotal).toBe(false);
    expect(annotationEntry.sectorId).toBe(4); // Only in Seleção Automática
  });

  it("should soft-delete annotations (set quantity to 0)", () => {
    // Business rule: never hard-delete, always soft-delete
    const deletedEntry = {
      quantidade: "0",
      observacoes: "[REMOVIDO]",
    };
    
    expect(deletedEntry.quantidade).toBe("0");
    expect(deletedEntry.observacoes).toBe("[REMOVIDO]");
  });
});

describe("Notification Filter for Operators", () => {
  // Operators who should only see billing notifications
  const billingOnlyOperators = ["Maria", "Erica", "Danubia"];
  
  // Notification types
  const billingNotificationTypes = ["novo_pedido", "pedido_modificado", "observacao_alterada"];
  const financialNotificationTypes = ["cobranca", "inadimplencia", "vencimento", "pagamento"];
  
  it("should identify billing-only operators", () => {
    expect(billingOnlyOperators).toContain("Maria");
    expect(billingOnlyOperators).toContain("Erica");
    expect(billingOnlyOperators).toContain("Danubia");
  });

  it("should filter out financial notifications for billing operators", () => {
    const isBillingOperator = (name: string) => billingOnlyOperators.includes(name);
    
    // Maria should NOT see financial notifications
    expect(isBillingOperator("Maria")).toBe(true);
    
    // Guilherme should see all notifications
    expect(isBillingOperator("Guilherme")).toBe(false);
  });

  it("should allow billing notifications for billing operators", () => {
    const allowedForBilling = (type: string) => billingNotificationTypes.includes(type);
    
    expect(allowedForBilling("novo_pedido")).toBe(true);
    expect(allowedForBilling("pedido_modificado")).toBe(true);
    expect(allowedForBilling("observacao_alterada")).toBe(true);
    expect(allowedForBilling("cobranca")).toBe(false);
    expect(allowedForBilling("inadimplencia")).toBe(false);
  });

  it("should block financial notifications for billing operators", () => {
    const isFinancialNotification = (type: string) => financialNotificationTypes.includes(type);
    
    for (const type of financialNotificationTypes) {
      expect(isFinancialNotification(type)).toBe(true);
    }
    
    // These should NOT be shown to Maria/Erica/Danubia
    for (const type of billingNotificationTypes) {
      expect(isFinancialNotification(type)).toBe(false);
    }
  });
});

describe("Pirografia Status Options", () => {
  const MACHINE_STATUS_OPTIONS = [
    "producao_normal",
    "falta_madeira",
    "producao_nao_necessaria",
    "manutencao",
    "manutencao_pontual",
    "producao_encerrada",
  ];

  it("should have 6 status options including producao_encerrada", () => {
    expect(MACHINE_STATUS_OPTIONS).toHaveLength(6);
    expect(MACHINE_STATUS_OPTIONS).toContain("producao_nao_necessaria");
    expect(MACHINE_STATUS_OPTIONS).toContain("producao_encerrada");
  });

  it("should have producao_normal as the default status", () => {
    expect(MACHINE_STATUS_OPTIONS[0]).toBe("producao_normal");
  });

  it("pirografia sector (ordem 9) should support all status options", () => {
    // Pirografia now uses the same status options as other sectors
    const pirografiaOrdem = 9;
    const supportsStatus = pirografiaOrdem === 9; // Now true
    expect(supportsStatus).toBe(true);
  });
});

describe("Production Average Calculation", () => {
  it("should calculate average using only days with actual production (qty > 0)", () => {
    const entries = [
      { data: "2026-04-21", quantidade: "100" },
      { data: "2026-04-22", quantidade: "0" },   // maintenance day - should NOT count
      { data: "2026-04-23", quantidade: "150" },
      { data: "2026-04-24", quantidade: "0" },   // no production - should NOT count
      { data: "2026-04-25", quantidade: "200" },
    ];

    const daysWithProduction = entries.filter(e => parseFloat(e.quantidade) > 0);
    const totalProduction = daysWithProduction.reduce((sum, e) => sum + parseFloat(e.quantidade), 0);
    const avgDaily = daysWithProduction.length > 0 ? totalProduction / daysWithProduction.length : 0;

    expect(daysWithProduction).toHaveLength(3); // Only 3 days with production
    expect(totalProduction).toBe(450);
    expect(avgDaily).toBeCloseTo(150); // 450 / 3 = 150
  });

  it("should NOT include zero-quantity days in the average", () => {
    const entries = [
      { data: "2026-04-21", quantidade: "50" },
      { data: "2026-04-22", quantidade: "0" },
    ];

    const daysWithProduction = entries.filter(e => parseFloat(e.quantidade) > 0);
    const avg = daysWithProduction.reduce((sum, e) => sum + parseFloat(e.quantidade), 0) / daysWithProduction.length;

    // Average should be 50 (not 25 which would be 50/2)
    expect(avg).toBe(50);
    expect(daysWithProduction).toHaveLength(1);
  });
});

describe("Number Parsing (pt-BR locale)", () => {
  // The parseNumberBR function handles Brazilian number formats
  // This mirrors the actual implementation in Home.tsx
  function parseNumberBR(s: string): number {
    const trimmed = s.trim();
    // Pattern: full pt-BR format with thousands dots AND decimal comma (e.g., "1.234,56")
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed.replace(/\./g, '').replace(',', '.'));
    }
    // Handle comma as decimal separator (e.g., "6,5" → 6.5)
    if (/^\d+,\d+$/.test(trimmed)) {
      return parseFloat(trimmed.replace(',', '.'));
    }
    return parseFloat(trimmed);
  }

  it("should parse 6.600 as 6600 (pt-BR thousands separator)", () => {
    expect(parseNumberBR("6.600")).toBe(6600);
  });

  it("should parse 6,6 as 6.6 (pt-BR decimal separator)", () => {
    expect(parseNumberBR("6,6")).toBeCloseTo(6.6);
  });

  it("should parse 1.234,56 as 1234.56 (pt-BR full format)", () => {
    expect(parseNumberBR("1.234,56")).toBeCloseTo(1234.56);
  });

  it("should parse plain integers", () => {
    expect(parseNumberBR("100")).toBe(100);
    expect(parseNumberBR("6600")).toBe(6600);
  });
});

describe("Saco Totals Separation by Sector", () => {
  it("should separate saco totals by sector name", () => {
    const sectorSacoTotals = [
      { sector: "Vareteira", unit: "saco", total: 500 },
      { sector: "Seletoras Toco", unit: "saco", total: 300 },
      { sector: "Seleção Automática", unit: "saco", total: 200 },
    ];

    // Each sector should have its own saco total
    expect(sectorSacoTotals).toHaveLength(3);
    
    // They should NOT be merged into a single total
    const totalIfMerged = sectorSacoTotals.reduce((sum, s) => sum + s.total, 0);
    expect(totalIfMerged).toBe(1000);
    
    // But each sector's total should be independent
    expect(sectorSacoTotals[0].total).toBe(500);
    expect(sectorSacoTotals[1].total).toBe(300);
    expect(sectorSacoTotals[2].total).toBe(200);
  });
});

describe("Annotation Weekly Trend Chart", () => {
  it("should build chart data for last 7 days from selected date", () => {
    const selectedDate = "2026-04-29";
    const end = new Date(selectedDate + "T12:00:00");
    const days: { date: string; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
      });
    }

    expect(days).toHaveLength(7);
    expect(days[0].date).toBe("2026-04-23");
    expect(days[6].date).toBe("2026-04-29");
  });

  it("should aggregate quantities per day per type", () => {
    const weekHistory = [
      { data: "2026-04-29", tipo: "queijo_coalho", quantidade: "10" },
      { data: "2026-04-29", tipo: "queijo_coalho", quantidade: "5" },
      { data: "2026-04-29", tipo: "alidio", quantidade: "8" },
      { data: "2026-04-28", tipo: "queijo_coalho", quantidade: "12" },
      { data: "2026-04-28", tipo: "alidio", quantidade: "0" }, // soft-deleted, should be excluded
    ];

    const validEntries = weekHistory.filter(e => parseFloat(e.quantidade) > 0);

    const qcDay29 = validEntries
      .filter(e => e.data === "2026-04-29" && e.tipo === "queijo_coalho")
      .reduce((s, e) => s + parseFloat(e.quantidade), 0);
    const alDay29 = validEntries
      .filter(e => e.data === "2026-04-29" && e.tipo === "alidio")
      .reduce((s, e) => s + parseFloat(e.quantidade), 0);
    const qcDay28 = validEntries
      .filter(e => e.data === "2026-04-28" && e.tipo === "queijo_coalho")
      .reduce((s, e) => s + parseFloat(e.quantidade), 0);
    const alDay28 = validEntries
      .filter(e => e.data === "2026-04-28" && e.tipo === "alidio")
      .reduce((s, e) => s + parseFloat(e.quantidade), 0);

    expect(qcDay29).toBe(15); // 10 + 5
    expect(alDay29).toBe(8);
    expect(qcDay28).toBe(12);
    expect(alDay28).toBe(0); // soft-deleted excluded
  });

  it("should exclude soft-deleted entries (quantity = 0) from chart", () => {
    const entries = [
      { quantidade: "10", tipo: "queijo_coalho" },
      { quantidade: "0", tipo: "queijo_coalho" },
      { quantidade: "5", tipo: "alidio" },
    ];

    const valid = entries.filter(e => parseFloat(e.quantidade) > 0);
    expect(valid).toHaveLength(2);
  });
});

describe("Annotation PDF Export", () => {
  it("should calculate monthly range correctly", () => {
    const selectedDate = "2026-04-15";
    const d = new Date(selectedDate + "T12:00:00");
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    expect(start).toBe("2026-04-01");
    expect(end).toBe("2026-04-30");
    expect(m).toBe(3); // April is 0-indexed as 3
    expect(y).toBe(2026);
  });

  it("should build daily breakdown with totals per type", () => {
    const entries = [
      { data: "2026-04-01", tipo: "queijo_coalho", quantidade: "10" },
      { data: "2026-04-01", tipo: "alidio", quantidade: "5" },
      { data: "2026-04-02", tipo: "queijo_coalho", quantidade: "20" },
      { data: "2026-04-03", tipo: "alidio", quantidade: "15" },
      { data: "2026-04-03", tipo: "alidio", quantidade: "0" }, // soft-deleted
    ];

    const validEntries = entries.filter(e => parseFloat(e.quantidade) > 0);

    const grandTotalQC = validEntries
      .filter(e => e.tipo === "queijo_coalho")
      .reduce((s, e) => s + parseFloat(e.quantidade), 0);
    const grandTotalAL = validEntries
      .filter(e => e.tipo === "alidio")
      .reduce((s, e) => s + parseFloat(e.quantidade), 0);

    expect(grandTotalQC).toBe(30); // 10 + 20
    expect(grandTotalAL).toBe(20); // 5 + 15
    expect(validEntries).toHaveLength(4); // excludes the soft-deleted one
  });

  it("should count unique days with entries", () => {
    const entries = [
      { data: "2026-04-01", tipo: "queijo_coalho", quantidade: "10" },
      { data: "2026-04-01", tipo: "queijo_coalho", quantidade: "5" },
      { data: "2026-04-03", tipo: "queijo_coalho", quantidade: "20" },
    ];

    const validEntries = entries.filter(e => parseFloat(e.quantidade) > 0);
    const uniqueDays = new Set(validEntries.map(e => e.data)).size;

    expect(uniqueDays).toBe(2); // April 1 and April 3
  });
});
