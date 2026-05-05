import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockGroupBy = vi.fn();

const mockDb = {
  select: mockSelect,
};

vi.mock("./db", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("../drizzle/schema", () => ({
  productionSectors: { id: "id", ordem: "ordem", nome: "nome" },
  productionMachines: { id: "id", sectorId: "sectorId", ordem: "ordem" },
  productionEntries: {
    id: "id", sectorId: "sectorId", machineId: "machineId",
    data: "data", quantidade: "quantidade", status: "status",
    tipoMadeira: "tipoMadeira", observacoes: "observacoes", lancadoPor: "lancadoPor",
  },
  dashboardData: {},
  stockItems: {},
  madeiraStock: {},
  stockEditHistory: {},
  pirografiaEntries: {},
}));

import { productionRouter } from "./productionRouter";
import { appRouter } from "./routers";

describe("Production Monthly Average", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ groupBy: mockGroupBy });
    mockGroupBy.mockResolvedValue([]);
  });

  it("should return empty array when no data exists", async () => {
    mockGroupBy.mockResolvedValue([]);

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.production.getMonthlyAverage({ data: "2026-05-05" });
    expect(result).toEqual([]);
  });

  it("should calculate correct daily average per sector", async () => {
    mockGroupBy.mockResolvedValue([
      { sectorId: 1, total: "165228.000", diasTrabalhados: 20 },
      { sectorId: 2, total: "1449.200", diasTrabalhados: 20 },
      { sectorId: 3, total: "1226.400", diasTrabalhados: 20 },
      { sectorId: 4, total: "1088.600", diasTrabalhados: 20 },
      { sectorId: 5, total: "2093.000", diasTrabalhados: 20 },
      { sectorId: 6, total: "607.200", diasTrabalhados: 20 },
    ]);

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.production.getMonthlyAverage({ data: "2026-05-05" });

    expect(result).toHaveLength(6);
    
    // Multilâmina: 165228 / 20 = 8261.4
    expect(result[0].sectorId).toBe(1);
    expect(result[0].totalMes).toBeCloseTo(165228, 0);
    expect(result[0].mediaDiaria).toBeCloseTo(8261.4, 1);
    expect(result[0].diasTrabalhados).toBe(20);

    // Vareteiras: 1449.2 / 20 = 72.46
    expect(result[1].sectorId).toBe(2);
    expect(result[1].mediaDiaria).toBeCloseTo(72.46, 1);

    // Seleção toco: 1226.4 / 20 = 61.32
    expect(result[2].sectorId).toBe(3);
    expect(result[2].mediaDiaria).toBeCloseTo(61.32, 1);

    // Seleção automática: 1088.6 / 20 = 54.43
    expect(result[3].sectorId).toBe(4);
    expect(result[3].mediaDiaria).toBeCloseTo(54.43, 1);

    // Seleção visual: 2093 / 20 = 104.65
    expect(result[4].sectorId).toBe(5);
    expect(result[4].mediaDiaria).toBeCloseTo(104.65, 1);

    // Flow Pack: 607.2 / 20 = 30.36
    expect(result[5].sectorId).toBe(6);
    expect(result[5].mediaDiaria).toBeCloseTo(30.36, 1);
  });

  it("should handle zero working days gracefully", async () => {
    mockGroupBy.mockResolvedValue([
      { sectorId: 1, total: "0", diasTrabalhados: 0 },
    ]);

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.production.getMonthlyAverage({ data: "2026-05-05" });
    expect(result[0].mediaDiaria).toBe(0);
  });

  it("should use current date when no data parameter is provided", async () => {
    mockGroupBy.mockResolvedValue([]);

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.production.getMonthlyAverage({});
    expect(result).toEqual([]);
    // Verify that select was called (query was executed)
    expect(mockSelect).toHaveBeenCalled();
  });
});
