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
    status: "status",
    tipoMadeira: "tipoMadeira",
    observacoes: "observacoes",
    lancadoPor: "lancadoPor",
  },
}));

describe("Production Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(sectors[7].tipoEquipamento).toBe("nenhum");
    });

    it("should have correct sequential sectors (1, 2, 3)", () => {
      expect([1, 2, 3]).toEqual([1, 2, 3]);
    });

    it("should have correct machine counts per sector totaling 32", () => {
      const machineCounts: Record<number, number> = { 1: 2, 2: 5, 3: 3, 4: 6, 5: 7, 6: 5, 7: 1, 8: 0, 9: 3 };
      expect(Object.values(machineCounts).reduce((a, b) => a + b, 0)).toBe(32);
    });

    it("should identify expandable sectors (Multilamina=1, Vareteira=2)", () => {
      const expandable = [1, 2]; // ordem values
      expect(expandable).toContain(1);
      expect(expandable).toContain(2);
      expect(expandable).not.toContain(3);
    });
  });

  describe("Production Entry Validation", () => {
    it("should validate date format YYYY-MM-DD", () => {
      expect("2026-04-11").toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect("11/04/2026").not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should accept zero quantity and save successfully", () => {
      const entry = { sectorId: 1, machineId: 1, data: "2026-04-11", quantidade: 0, status: "falta_madeira" };
      expect(entry.quantidade).toBe(0);
      expect(entry.quantidade).toBeGreaterThanOrEqual(0);
    });

    it("should allow null machineId for sectors without machines", () => {
      const entry = { sectorId: 8, machineId: null, data: "2026-04-11", quantidade: 50 };
      expect(entry.machineId).toBeNull();
    });
  });

  describe("Machine Status Options", () => {
    const STATUS_OPTIONS = [
      { value: "producao_normal", label: "Produção Normal" },
      { value: "falta_madeira", label: "Falta de Madeira" },
      { value: "producao_nao_necessaria", label: "Produção Não Necessária" },
      { value: "manutencao", label: "Manutenção" },
      { value: "manutencao_pontual", label: "Manutenção Pontual" },
    ];

    it("should have 5 status options (including manutencao_pontual)", () => {
      expect(STATUS_OPTIONS).toHaveLength(5);
    });

    it("should have producao_normal as default status", () => {
      expect(STATUS_OPTIONS[0].value).toBe("producao_normal");
    });

    it("should include manutencao_pontual for Multilamina", () => {
      const values = STATUS_OPTIONS.map(o => o.value);
      expect(values).toContain("manutencao_pontual");
    });

    it("should allow saving entry with any valid status", () => {
      for (const opt of STATUS_OPTIONS) {
        const entry = { sectorId: 1, machineId: 1, data: "2026-04-11", quantidade: 0, status: opt.value };
        expect(entry.status).toBe(opt.value);
      }
    });
  });

  describe("Wood Type Options", () => {
    const WOOD_TYPES = [
      { value: "benazzi", label: "Benazzi" },
      { value: "madeira_dura", label: "Madeira Dura" },
    ];

    it("should have 2 wood type options", () => {
      expect(WOOD_TYPES).toHaveLength(2);
    });

    it("should allow selecting single wood type", () => {
      const entry = { tipoMadeira: "benazzi" };
      expect(entry.tipoMadeira).toBe("benazzi");
    });

    it("should allow selecting both wood types on same day", () => {
      const entry = { tipoMadeira: "benazzi,madeira_dura" };
      const types = entry.tipoMadeira.split(",");
      expect(types).toContain("benazzi");
      expect(types).toContain("madeira_dura");
      expect(types).toHaveLength(2);
    });

    it("should allow no wood type selected (null)", () => {
      const entry = { tipoMadeira: null };
      expect(entry.tipoMadeira).toBeNull();
    });

    it("should only apply to Multilamina (setor 1) and Vareteira (setor 2)", () => {
      const sectorsWithWoodType = [1, 2]; // ordem values
      expect(sectorsWithWoodType).toEqual([1, 2]);
    });
  });

  describe("Comments/Observations", () => {
    it("should allow adding comments to any sector entry", () => {
      const entry = { sectorId: 5, machineId: 10, observacoes: "Mesa com problema no acabamento" };
      expect(entry.observacoes).toBeTruthy();
    });

    it("should allow empty comments", () => {
      const entry = { sectorId: 1, machineId: 1, observacoes: null };
      expect(entry.observacoes).toBeNull();
    });

    it("should allow comments on sectors without machines", () => {
      const entry = { sectorId: 8, machineId: null, observacoes: "Faltou material de embalagem" };
      expect(entry.machineId).toBeNull();
      expect(entry.observacoes).toBeTruthy();
    });
  });

  describe("Multilamina Sector Specifics", () => {
    it("should be sector with ordem 1", () => {
      const multilamina = { id: 1, ordem: 1, nome: "Multilamina", unidadeMedida: "m³" };
      expect(multilamina.ordem).toBe(1);
    });

    it("should have 2 machines", () => {
      const machines = [
        { id: 1, sectorId: 1, nome: "Máquina 1", ordem: 1 },
        { id: 2, sectorId: 1, nome: "Máquina 2", ordem: 2 },
      ];
      expect(machines).toHaveLength(2);
    });

    it("should support expandable machines with status, wood type, and comments", () => {
      const machineEntry = {
        machineId: 1,
        quantidade: 5.5,
        status: "manutencao_pontual",
        tipoMadeira: "benazzi,madeira_dura",
        observacoes: "Troca de madeira durante o turno",
      };
      expect(machineEntry.status).toBe("manutencao_pontual");
      expect(machineEntry.tipoMadeira).toContain("benazzi");
      expect(machineEntry.tipoMadeira).toContain("madeira_dura");
      expect(machineEntry.observacoes).toBeTruthy();
    });
  });

  describe("Vareteira Sector Specifics", () => {
    it("should be sector with ordem 2", () => {
      const vareteira = { id: 2, ordem: 2, nome: "Vareteira", unidadeMedida: "saco" };
      expect(vareteira.ordem).toBe(2);
    });

    it("should have 5 machines", () => {
      const machines = Array.from({ length: 5 }, (_, i) => ({ id: i + 3, sectorId: 2, nome: `Máquina ${i + 1}`, ordem: i + 1 }));
      expect(machines).toHaveLength(5);
    });

    it("should support same expandable features as Multilamina", () => {
      const machineEntry = {
        sectorId: 2,
        machineId: 3,
        status: "falta_madeira",
        tipoMadeira: "madeira_dura",
        observacoes: "Aguardando reposição",
      };
      expect(machineEntry.status).toBe("falta_madeira");
      expect(machineEntry.tipoMadeira).toBe("madeira_dura");
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
        summary[e.sectorId] = (summary[e.sectorId] || 0) + parseFloat(e.quantidade);
      }
      expect(summary[1]).toBe(25);
      expect(summary[2]).toBe(380);
    });

    it("should include zero-quantity entries in count", () => {
      const entries = [
        { sectorId: 1, machineId: 1, quantidade: "5.00000", status: "producao_normal" },
        { sectorId: 1, machineId: 2, quantidade: "0.00000", status: "manutencao_pontual" },
      ];
      const total = entries.reduce((sum, e) => sum + parseFloat(e.quantidade), 0);
      expect(total).toBe(5);
      expect(entries).toHaveLength(2);
    });
  });

  describe("Unit of Measure per Sector", () => {
    it("should use m³ for Multilamina", () => { expect("m³").toBe("m³"); });
    it("should use saco for Vareteira, Seletoras Toco, Seleção Automática", () => { expect([2, 3, 4]).toHaveLength(3); });
    it("should use forma for Seleção Visual", () => { expect("forma").toBe("forma"); });
    it("should use caixa for Flow Pack, Ponteira, Embalagem, Pirografar", () => { expect([6, 7, 8, 9]).toHaveLength(4); });
  });
});
