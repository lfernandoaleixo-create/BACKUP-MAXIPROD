import { describe, it, expect } from "vitest";

/**
 * Tests for weekly summary conversion logic.
 * The getWeeklySummary endpoint now returns tipoMadeira per row,
 * and the frontend applies cxp/cxg→saco conversion for dual-unit sectors.
 * These tests validate the frontend conversion logic in isolation.
 */

// Replicate the CONVERSION_FACTORS from Production.tsx
const CONVERSION_FACTORS: Record<string, { cxp: number; cxg: number }> = {
  "3.8x150mm": { cxp: 0, cxg: 0 },
  "3.8x180mm": { cxp: 0.5, cxg: 0 },
  "3.8x200mm": { cxp: 0.6, cxg: 0.8 },
  "3.8x218mm": { cxp: 0, cxg: 0 },
  "3.8x220mm": { cxp: 0.5, cxg: 0.7 },
  "3.8x250mm": { cxp: 0, cxg: 0.8 },
  "3.8x350mm": { cxp: 0.4, cxg: 0.6 },
  "3.5x200mm": { cxp: 0.6, cxg: 0.8 },
  "3.5x250mm": { cxp: 0, cxg: 0 },
  "3.5x350mm": { cxp: 0, cxg: 0 },
};

function convertCxpToSaco(medida: string, caixas: number): number {
  const fator = CONVERSION_FACTORS[medida]?.cxp || 1;
  return caixas * fator;
}
function convertCxgToSaco(medida: string, caixas: number): number {
  const fator = CONVERSION_FACTORS[medida]?.cxg || 1;
  return caixas * fator;
}

function isDualUnitSector(ordem: number) { return ordem === 2 || ordem === 3 || ordem === 4; }

// Replicate the matrix building logic from HistoryView
function buildMatrix(
  sectors: { id: number; ordem: number }[],
  weekDays: string[],
  weeklySummary: { sectorId: number; data: string; tipoMadeira: string | null; total: string }[]
) {
  const m: Record<number, Record<string, number>> = {};
  for (const sector of sectors) {
    m[sector.id] = {};
    for (const day of weekDays) m[sector.id][day] = 0;
  }
  for (const entry of weeklySummary) {
    if (m[entry.sectorId] && m[entry.sectorId][entry.data] !== undefined) {
      const qty = Number(entry.total);
      const sector = sectors.find(s => s.id === entry.sectorId);
      const isDual = sector && isDualUnitSector(sector.ordem);
      if (isDual && entry.tipoMadeira) {
        const variant = entry.tipoMadeira;
        const parts = variant.split("_");
        const suffix = parts[parts.length - 1];
        const medida = parts.slice(0, -1).join("_");
        if (suffix === "cxp") {
          m[entry.sectorId][entry.data] += convertCxpToSaco(medida, qty);
        } else if (suffix === "cxg") {
          m[entry.sectorId][entry.data] += convertCxgToSaco(medida, qty);
        } else {
          m[entry.sectorId][entry.data] += qty;
        }
      } else {
        m[entry.sectorId][entry.data] += qty;
      }
    }
  }
  return m;
}

describe("Weekly Summary conversion logic", () => {
  const sectors = [
    { id: 1, ordem: 1 }, // Multilamina (not dual)
    { id: 2, ordem: 2 }, // Vareteira (dual)
    { id: 3, ordem: 3 }, // Seletoras Toco (dual)
    { id: 6, ordem: 6 }, // Flow Pack (not dual)
  ];
  const weekDays = ["2026-04-16"];

  it("should convert cxp entries to sacos for dual-unit sectors", () => {
    const summary = [
      { sectorId: 2, data: "2026-04-16", tipoMadeira: "3.5x200mm_cxp", total: "37" },
    ];
    const m = buildMatrix(sectors, weekDays, summary);
    // 37 cxp * 0.6 factor = 22.2 sacos
    expect(m[2]["2026-04-16"]).toBeCloseTo(22.2, 1);
  });

  it("should convert cxg entries to sacos for dual-unit sectors", () => {
    const summary = [
      { sectorId: 2, data: "2026-04-16", tipoMadeira: "3.8x200mm_cxg", total: "30" },
    ];
    const m = buildMatrix(sectors, weekDays, summary);
    // 30 cxg * 0.8 factor = 24 sacos
    expect(m[2]["2026-04-16"]).toBeCloseTo(24, 1);
  });

  it("should keep saco entries as-is for dual-unit sectors", () => {
    const summary = [
      { sectorId: 2, data: "2026-04-16", tipoMadeira: "3.8x250mm_saco", total: "41" },
    ];
    const m = buildMatrix(sectors, weekDays, summary);
    expect(m[2]["2026-04-16"]).toBe(41);
  });

  it("should sum all variants correctly for Vareteira (real scenario from 16/04)", () => {
    // Real data: Máquina 4: 30 cxg (3.8x200mm), Máquina 6: 41 saco (3.8x250mm), Máquina 7: 37 cxp (3.5x200mm)
    const summary = [
      { sectorId: 2, data: "2026-04-16", tipoMadeira: "3.8x200mm_cxg", total: "30" },
      { sectorId: 2, data: "2026-04-16", tipoMadeira: "3.8x250mm_saco", total: "41" },
      { sectorId: 2, data: "2026-04-16", tipoMadeira: "3.5x200mm_cxp", total: "37" },
    ];
    const m = buildMatrix(sectors, weekDays, summary);
    // 30*0.8 + 41 + 37*0.6 = 24 + 41 + 22.2 = 87.2
    expect(m[2]["2026-04-16"]).toBeCloseTo(87.2, 1);
  });

  it("should NOT apply conversion for non-dual-unit sectors", () => {
    const summary = [
      { sectorId: 1, data: "2026-04-16", tipoMadeira: null, total: "6.828" },
    ];
    const m = buildMatrix(sectors, weekDays, summary);
    expect(m[1]["2026-04-16"]).toBeCloseTo(6.828, 3);
  });

  it("should NOT apply conversion for Flow Pack (non-dual)", () => {
    const summary = [
      { sectorId: 6, data: "2026-04-16", tipoMadeira: "3.8x250mm", total: "22.5" },
    ];
    const m = buildMatrix(sectors, weekDays, summary);
    expect(m[6]["2026-04-16"]).toBeCloseTo(22.5, 1);
  });

  it("should handle entries with no tipoMadeira for dual-unit sectors (legacy data)", () => {
    const summary = [
      { sectorId: 2, data: "2026-04-16", tipoMadeira: null, total: "50" },
    ];
    const m = buildMatrix(sectors, weekDays, summary);
    // No tipoMadeira = raw value, no conversion
    expect(m[2]["2026-04-16"]).toBe(50);
  });
});
