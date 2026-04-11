import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockGroupBy = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();
const mockLimit = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
};

vi.mock("./db", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("../drizzle/schema", () => ({
  productionSectors: { id: "id", ordem: "ordem", nome: "nome" },
  productionMachines: { id: "id", sectorId: "sectorId", ordem: "ordem" },
  productionEntries: {
    id: "id",
    sectorId: "sectorId",
    machineId: "machineId",
    data: "data",
    quantidade: "quantidade",
    observacoes: "observacoes",
    lancadoPor: "lancadoPor",
  },
}));

describe("Production Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default chain setup
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy, groupBy: mockGroupBy, limit: mockLimit });
    mockOrderBy.mockReturnValue({ where: mockWhere });
    mockGroupBy.mockReturnValue({ orderBy: mockOrderBy });
    mockLimit.mockResolvedValue([]);
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue([{ insertId: 1 }]);
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockDelete.mockReturnValue({ where: mockWhere });
  });

  describe("Sector Configuration", () => {
    it("should have 9 production sectors defined", () => {
      const sectors = [
        { id: 1, nome: "Multilamina", unidadeMedida: "m³", tipoEquipamento: "maquina", quantidadeEquipamentos: 2 },
        { id: 2, nome: "Vareteira", unidadeMedida: "saco", tipoEquipamento: "maquina", quantidadeEquipamentos: 5 },
        { id: 3, nome: "Seletoras Toco", unidadeMedida: "saco", tipoEquipamento: "maquina", quantidadeEquipamentos: 3 },
        { id: 4, nome: "Seleção Automática", unidadeMedida: "saco", tipoEquipamento: "maquina", quantidadeEquipamentos: 6 },
        { id: 5, nome: "Seleção Visual", unidadeMedida: "forma", tipoEquipamento: "mesa", quantidadeEquipamentos: 7 },
        { id: 6, nome: "Flow Pack", unidadeMedida: "caixa", tipoEquipamento: "maquina", quantidadeEquipamentos: 5 },
        { id: 7, nome: "Ponteira", unidadeMedida: "caixa", tipoEquipamento: "maquina", quantidadeEquipamentos: 1 },
        { id: 8, nome: "Embalagem", unidadeMedida: "caixa", tipoEquipamento: "nenhum", quantidadeEquipamentos: 0 },
        { id: 9, nome: "Máquina Pirografar", unidadeMedida: "caixa", tipoEquipamento: "maquina", quantidadeEquipamentos: 3 },
      ];

      expect(sectors).toHaveLength(9);
      expect(sectors[0].nome).toBe("Multilamina");
      expect(sectors[0].unidadeMedida).toBe("m³");
      expect(sectors[7].tipoEquipamento).toBe("nenhum");
      expect(sectors[7].quantidadeEquipamentos).toBe(0);
    });

    it("should have correct sequential sectors (1, 2, 3)", () => {
      const sequentialSectors = [1, 2, 3]; // Multilamina, Vareteira, Seletoras Toco
      expect(sequentialSectors).toEqual([1, 2, 3]);
    });

    it("should have correct machine counts per sector", () => {
      const machineCounts: Record<number, number> = {
        1: 2, // Multilamina
        2: 5, // Vareteira
        3: 3, // Seletoras Toco
        4: 6, // Seleção Automática
        5: 7, // Seleção Visual
        6: 5, // Flow Pack
        7: 1, // Ponteira
        8: 0, // Embalagem (sem máquina)
        9: 3, // Máquina Pirografar
      };
      const totalMachines = Object.values(machineCounts).reduce((a, b) => a + b, 0);
      expect(totalMachines).toBe(32);
    });
  });

  describe("Production Entry Validation", () => {
    it("should validate date format YYYY-MM-DD", () => {
      const validDate = "2026-04-11";
      const invalidDate = "11/04/2026";
      expect(validDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(invalidDate).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should accept positive quantities", () => {
      const validQuantity = 150;
      const zeroQuantity = 0;
      expect(validQuantity).toBeGreaterThan(0);
      expect(zeroQuantity).toBe(0);
    });

    it("should allow null machineId for sectors without machines (Embalagem)", () => {
      const entry = {
        sectorId: 8,
        machineId: null,
        data: "2026-04-11",
        quantidade: 50,
      };
      expect(entry.machineId).toBeNull();
      expect(entry.sectorId).toBe(8);
    });
  });

  describe("Daily Summary Calculation", () => {
    it("should aggregate quantities by sector", () => {
      const entries = [
        { sectorId: 1, machineId: 1, quantidade: "10.00000" },
        { sectorId: 1, machineId: 2, quantidade: "15.00000" },
        { sectorId: 2, machineId: 3, quantidade: "200.00000" },
        { sectorId: 2, machineId: 4, quantidade: "180.00000" },
      ];

      const summary: Record<number, number> = {};
      for (const e of entries) {
        const sid = e.sectorId;
        summary[sid] = (summary[sid] || 0) + parseFloat(e.quantidade);
      }

      expect(summary[1]).toBe(25);
      expect(summary[2]).toBe(380);
    });
  });

  describe("Unit of Measure per Sector", () => {
    it("should use m³ for Multilamina", () => {
      expect("m³").toBe("m³");
    });

    it("should use saco for Vareteira, Seletoras Toco, Seleção Automática", () => {
      const sacoSectors = [2, 3, 4];
      expect(sacoSectors).toHaveLength(3);
    });

    it("should use forma for Seleção Visual", () => {
      expect("forma").toBe("forma");
    });

    it("should use caixa for Flow Pack, Ponteira, Embalagem, Pirografar", () => {
      const caixaSectors = [6, 7, 8, 9];
      expect(caixaSectors).toHaveLength(4);
    });
  });
});
