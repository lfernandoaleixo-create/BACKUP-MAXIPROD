import { describe, it, expect } from "vitest";

/**
 * Tests for the production charts data processing logic.
 * We test the pure data transformation functions that the component uses.
 */

const STATUS_LABELS: Record<string, string> = {
  producao_normal: "Produção Normal",
  falta_madeira: "Falta de Madeira",
  producao_nao_necessaria: "Produção Não Necessária",
  manutencao: "Manutenção",
  manutencao_pontual: "Manutenção Pontual",
};

const SECTOR_COLORS = [
  "#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444",
  "#ec4899", "#14b8a6", "#6366f1", "#f97316",
];

// Replicate the data processing logic from ProductionCharts
function processChartData(
  historyData: Array<{
    sectorId: number;
    machineId: number | null;
    data: string;
    quantidade: string;
    status: string | null;
  }>,
  sectors: Array<{
    id: number;
    nome: string;
    ordem: number;
    unidade: string;
    machines: Array<{ id: number; nome: string; ordem: number }>;
  }>,
  selectedSector: number | null
) {
  // Group entries by date
  const byDate = new Map<string, typeof historyData>();
  for (const entry of historyData) {
    const arr = byDate.get(entry.data) || [];
    arr.push(entry);
    byDate.set(entry.data, arr);
  }
  const sortedDates = Array.from(byDate.keys()).sort();

  // Daily by sector
  const dailyBySector = sortedDates.map(date => {
    const dayEntries = byDate.get(date) || [];
    const row: Record<string, any> = { date, dateLabel: date };
    for (const sector of sectors) {
      const sectorEntries = dayEntries.filter(e => e.sectorId === sector.id);
      row[`sector_${sector.id}`] = sectorEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
    }
    row.total = sectors.reduce((sum, s) => sum + (row[`sector_${s.id}`] || 0), 0);
    return row;
  });

  // Sector totals
  const sectorTotals = sectors.map((sector, idx) => {
    const total = historyData
      .filter(e => e.sectorId === sector.id)
      .reduce((sum, e) => sum + Number(e.quantidade), 0);
    return {
      name: sector.nome,
      value: total,
      unit: sector.unidade,
      color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
    };
  }).filter(s => s.value > 0);

  // Machine data for selected sector
  const machineData = selectedSector ? (() => {
    const sector = sectors.find(s => s.id === selectedSector);
    if (!sector || !sector.machines.length) return [];
    return sector.machines.map(machine => {
      const machineEntries = historyData.filter(
        e => e.sectorId === selectedSector && e.machineId === machine.id
      );
      const total = machineEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
      const days = new Set(machineEntries.map(e => e.data)).size;
      return {
        name: machine.nome,
        total,
        media: days > 0 ? total / days : 0,
        dias: days,
      };
    });
  })() : [];

  // Maintenance data
  const maintenanceData = sectors.map(sector => {
    const sectorEntries = historyData.filter(e => e.sectorId === sector.id);
    const manutencao = sectorEntries.filter(e => e.status === "manutencao").length;
    const manutencaoPontual = sectorEntries.filter(e => e.status === "manutencao_pontual").length;
    const faltaMadeira = sectorEntries.filter(e => e.status === "falta_madeira").length;
    const prodNaoNecessaria = sectorEntries.filter(e => e.status === "producao_nao_necessaria").length;
    const total = manutencao + manutencaoPontual;
    return {
      name: sector.nome,
      manutencao,
      manutencaoPontual,
      faltaMadeira,
      prodNaoNecessaria,
      totalManutencao: total,
    };
  }).filter(s => s.totalManutencao > 0 || s.faltaMadeira > 0 || s.prodNaoNecessaria > 0);

  // Status distribution
  const statusCounts: Record<string, number> = {};
  for (const entry of historyData) {
    const st = entry.status || "producao_normal";
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  }
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
  }));

  return { dailyBySector, sectorTotals, machineData, maintenanceData, statusData, sortedDates };
}

// Sample data
const sampleSectors = [
  { id: 1, nome: "Multilamina", ordem: 1, unidade: "m³", machines: [
    { id: 1, nome: "Máquina 1", ordem: 1 },
    { id: 2, nome: "Máquina 2", ordem: 2 },
  ]},
  { id: 2, nome: "Vareteira", ordem: 2, unidade: "saco", machines: [
    { id: 3, nome: "Máquina 1", ordem: 1 },
  ]},
];

const sampleHistory = [
  { sectorId: 1, machineId: 1, data: "2026-04-28", quantidade: "10.5", status: "producao_normal" },
  { sectorId: 1, machineId: 2, data: "2026-04-28", quantidade: "8.3", status: "producao_normal" },
  { sectorId: 2, machineId: 3, data: "2026-04-28", quantidade: "50", status: "manutencao" },
  { sectorId: 1, machineId: 1, data: "2026-04-29", quantidade: "12.0", status: "producao_normal" },
  { sectorId: 1, machineId: 2, data: "2026-04-29", quantidade: "9.1", status: "falta_madeira" },
  { sectorId: 2, machineId: 3, data: "2026-04-29", quantidade: "45", status: "producao_normal" },
];

describe("ProductionCharts data processing", () => {
  it("should group entries by date correctly", () => {
    const result = processChartData(sampleHistory, sampleSectors, null);
    expect(result.sortedDates).toEqual(["2026-04-28", "2026-04-29"]);
    expect(result.dailyBySector).toHaveLength(2);
  });

  it("should calculate sector totals correctly", () => {
    const result = processChartData(sampleHistory, sampleSectors, null);
    const multilamina = result.sectorTotals.find(s => s.name === "Multilamina");
    expect(multilamina).toBeDefined();
    // 10.5 + 8.3 + 12.0 + 9.1 = 39.9
    expect(multilamina!.value).toBeCloseTo(39.9, 1);

    const vareteira = result.sectorTotals.find(s => s.name === "Vareteira");
    expect(vareteira).toBeDefined();
    // 50 + 45 = 95
    expect(vareteira!.value).toBeCloseTo(95, 1);
  });

  it("should calculate daily totals per sector", () => {
    const result = processChartData(sampleHistory, sampleSectors, null);
    const day1 = result.dailyBySector[0]; // 2026-04-28
    expect(day1.sector_1).toBeCloseTo(18.8, 1); // 10.5 + 8.3
    expect(day1.sector_2).toBeCloseTo(50, 1);
    expect(day1.total).toBeCloseTo(68.8, 1);
  });

  it("should calculate machine breakdown for selected sector", () => {
    const result = processChartData(sampleHistory, sampleSectors, 1);
    expect(result.machineData).toHaveLength(2);
    const m1 = result.machineData.find(m => m.name === "Máquina 1");
    expect(m1).toBeDefined();
    expect(m1!.total).toBeCloseTo(22.5, 1); // 10.5 + 12.0
    expect(m1!.dias).toBe(2);
    expect(m1!.media).toBeCloseTo(11.25, 1);
  });

  it("should count maintenance entries correctly", () => {
    const result = processChartData(sampleHistory, sampleSectors, null);
    // Vareteira has 1 manutencao entry
    const vareteira = result.maintenanceData.find(s => s.name === "Vareteira");
    expect(vareteira).toBeDefined();
    expect(vareteira!.manutencao).toBe(1);
    expect(vareteira!.totalManutencao).toBe(1);

    // Multilamina has 1 falta_madeira entry
    const multilamina = result.maintenanceData.find(s => s.name === "Multilamina");
    expect(multilamina).toBeDefined();
    expect(multilamina!.faltaMadeira).toBe(1);
  });

  it("should calculate status distribution", () => {
    const result = processChartData(sampleHistory, sampleSectors, null);
    const normal = result.statusData.find(s => s.name === "Produção Normal");
    expect(normal).toBeDefined();
    expect(normal!.value).toBe(4); // 4 entries with producao_normal

    const manut = result.statusData.find(s => s.name === "Manutenção");
    expect(manut).toBeDefined();
    expect(manut!.value).toBe(1);

    const falta = result.statusData.find(s => s.name === "Falta de Madeira");
    expect(falta).toBeDefined();
    expect(falta!.value).toBe(1);
  });

  it("should return empty machine data when no sector selected", () => {
    const result = processChartData(sampleHistory, sampleSectors, null);
    expect(result.machineData).toHaveLength(0);
  });

  it("should handle empty history data", () => {
    const result = processChartData([], sampleSectors, null);
    expect(result.sortedDates).toHaveLength(0);
    expect(result.dailyBySector).toHaveLength(0);
    expect(result.sectorTotals).toHaveLength(0);
    expect(result.maintenanceData).toHaveLength(0);
    expect(result.statusData).toHaveLength(0);
  });
});
