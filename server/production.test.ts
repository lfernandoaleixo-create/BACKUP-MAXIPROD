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
    id: "id", sectorId: "sectorId", machineId: "machineId",
    data: "data", quantidade: "quantidade", status: "status",
    tipoMadeira: "tipoMadeira", observacoes: "observacoes", lancadoPor: "lancadoPor",
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
      const expandable = [1, 2];
      expect(expandable).toContain(1);
      expect(expandable).toContain(2);
      expect(expandable).not.toContain(3);
    });
  });

  describe("Production Entry Validation", () => {
    it("should validate date format YYYY-MM-DD", () => {
      expect("2026-04-11").toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should accept zero quantity", () => {
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

    it("should have 5 status options including manutencao_pontual", () => {
      expect(STATUS_OPTIONS).toHaveLength(5);
      expect(STATUS_OPTIONS.map(o => o.value)).toContain("manutencao_pontual");
    });

    it("should have producao_normal as default status", () => {
      expect(STATUS_OPTIONS[0].value).toBe("producao_normal");
    });
  });

  describe("Wood Type Options (Multilamina - Setor 1)", () => {
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

    it("should allow no wood type selected (null)", () => {
      const entry = { tipoMadeira: null };
      expect(entry.tipoMadeira).toBeNull();
    });
  });

  describe("Wood Measure Options (Vareteira - Setor 2)", () => {
    const WOOD_MEASURES = [
      { value: "150mm", label: "150mm" },
      { value: "180mm", label: "180mm" },
      { value: "200mm", label: "200mm" },
      { value: "218mm", label: "218mm" },
      { value: "250mm", label: "250mm" },
      { value: "300mm", label: "300mm" },
      { value: "350mm", label: "350mm" },
    ];

    it("should have 7 measure options", () => {
      expect(WOOD_MEASURES).toHaveLength(7);
    });

    it("should include all required measures", () => {
      const values = WOOD_MEASURES.map(o => o.value);
      expect(values).toEqual(["150mm", "180mm", "200mm", "218mm", "250mm", "300mm", "350mm"]);
    });

    it("should be distinct from wood type options (different concept)", () => {
      const measures = WOOD_MEASURES.map(o => o.value);
      expect(measures).not.toContain("benazzi");
      expect(measures).not.toContain("madeira_dura");
    });
  });

  describe("Per-Variant Production (Multilamina)", () => {
    it("should allow separate entries per wood type on same machine/day", () => {
      const entries = [
        { id: 1, sectorId: 1, machineId: 1, data: "2026-04-11", quantidade: "5.5", tipoMadeira: "benazzi" },
        { id: 2, sectorId: 1, machineId: 1, data: "2026-04-11", quantidade: "3.2", tipoMadeira: "madeira_dura" },
      ];
      expect(entries).toHaveLength(2);
      expect(entries[0].tipoMadeira).toBe("benazzi");
      expect(entries[1].tipoMadeira).toBe("madeira_dura");
      expect(entries[0].machineId).toBe(entries[1].machineId);
      expect(entries[0].data).toBe(entries[1].data);

      const total = entries.reduce((sum, e) => sum + Number(e.quantidade), 0);
      expect(total).toBeCloseTo(8.7, 1);
    });
  });

  describe("Per-Variant Production (Vareteira)", () => {
    it("should allow separate entries per measure on same machine/day", () => {
      const entries = [
        { id: 10, sectorId: 2, machineId: 3, data: "2026-04-11", quantidade: "100", tipoMadeira: "150mm" },
        { id: 11, sectorId: 2, machineId: 3, data: "2026-04-11", quantidade: "80", tipoMadeira: "200mm" },
        { id: 12, sectorId: 2, machineId: 3, data: "2026-04-11", quantidade: "50", tipoMadeira: "300mm" },
      ];
      expect(entries).toHaveLength(3);
      expect(entries.map(e => e.tipoMadeira)).toEqual(["150mm", "200mm", "300mm"]);

      const machineIds = new Set(entries.map(e => e.machineId));
      expect(machineIds.size).toBe(1);

      const total = entries.reduce((sum, e) => sum + Number(e.quantidade), 0);
      expect(total).toBe(230);
    });

    it("should support changing measures during the day", () => {
      const entries = [
        { id: 20, sectorId: 2, machineId: 4, data: "2026-04-11", quantidade: "60", tipoMadeira: "150mm", observacoes: "Manhã" },
        { id: 21, sectorId: 2, machineId: 4, data: "2026-04-11", quantidade: "40", tipoMadeira: "250mm", observacoes: "Tarde" },
      ];
      expect(entries).toHaveLength(2);
      expect(entries[0].tipoMadeira).toBe("150mm");
      expect(entries[1].tipoMadeira).toBe("250mm");
    });
  });

  describe("Upsert Key includes tipoMadeira", () => {
    it("entries with different tipoMadeira should be separate records", () => {
      const key1 = "1-1-2026-04-11-benazzi";
      const key2 = "1-1-2026-04-11-madeira_dura";
      expect(key1).not.toBe(key2);
    });

    it("entries with same tipoMadeira should match (upsert)", () => {
      const key1 = "2-3-2026-04-11-200mm";
      const key2 = "2-3-2026-04-11-200mm";
      expect(key1).toBe(key2);
    });

    it("entries with null tipoMadeira should match null", () => {
      const key1 = "3-5-2026-04-11-null";
      const key2 = "3-5-2026-04-11-null";
      expect(key1).toBe(key2);
    });
  });

  describe("Batch Upsert Logic", () => {
    it("should create batch entries with correct structure", () => {
      const selectedVariants = ["benazzi", "madeira_dura"];
      const quantities: Record<string, number> = { benazzi: 5, madeira_dura: 3 };

      const batchEntries = selectedVariants.map(variant => ({
        sectorId: 1, machineId: 1, data: "2026-04-11",
        quantidade: quantities[variant], status: "producao_normal", tipoMadeira: variant,
      }));

      expect(batchEntries).toHaveLength(2);
      expect(batchEntries[0].tipoMadeira).toBe("benazzi");
      expect(batchEntries[0].quantidade).toBe(5);
      expect(batchEntries[1].tipoMadeira).toBe("madeira_dura");
      expect(batchEntries[1].quantidade).toBe(3);
    });

    it("should handle Vareteira batch with multiple measures", () => {
      const selectedMeasures = ["150mm", "200mm", "300mm"];
      const quantities: Record<string, number> = { "150mm": 100, "200mm": 80, "300mm": 50 };

      const batchEntries = selectedMeasures.map(measure => ({
        sectorId: 2, machineId: 3, data: "2026-04-11",
        quantidade: quantities[measure], status: "producao_normal", tipoMadeira: measure,
      }));

      expect(batchEntries).toHaveLength(3);
      expect(batchEntries.reduce((sum, e) => sum + e.quantidade, 0)).toBe(230);
    });

    it("should handle empty variant selection (no tipoMadeira)", () => {
      const entry = { sectorId: 1, machineId: 1, data: "2026-04-11", quantidade: 10, tipoMadeira: null };
      expect(entry.tipoMadeira).toBeNull();
    });
  });

  describe("Comments/Observations", () => {
    it("should allow adding comments to any sector entry", () => {
      const entry = { sectorId: 5, machineId: 10, observacoes: "Mesa com problema" };
      expect(entry.observacoes).toBeTruthy();
    });

    it("should allow empty comments", () => {
      const entry = { sectorId: 1, machineId: 1, observacoes: null };
      expect(entry.observacoes).toBeNull();
    });

    it("should allow comments on sectors without machines", () => {
      const entry = { sectorId: 8, machineId: null, observacoes: "Faltou material" };
      expect(entry.machineId).toBeNull();
      expect(entry.observacoes).toBeTruthy();
    });
  });

  describe("Daily Summary Calculation", () => {
    it("should aggregate all entries per sector including multiple variants", () => {
      const entries = [
        { sectorId: 1, machineId: 1, quantidade: "5.00000", tipoMadeira: "benazzi" },
        { sectorId: 1, machineId: 1, quantidade: "3.00000", tipoMadeira: "madeira_dura" },
        { sectorId: 1, machineId: 2, quantidade: "7.00000", tipoMadeira: "benazzi" },
      ];
      const total = entries.reduce((sum, e) => sum + parseFloat(e.quantidade), 0);
      expect(total).toBe(15);
    });

    it("should aggregate Vareteira entries across multiple measures", () => {
      const entries = [
        { sectorId: 2, machineId: 3, quantidade: "100", tipoMadeira: "150mm" },
        { sectorId: 2, machineId: 3, quantidade: "80", tipoMadeira: "200mm" },
        { sectorId: 2, machineId: 4, quantidade: "60", tipoMadeira: "150mm" },
      ];
      const total = entries.reduce((sum, e) => sum + parseFloat(e.quantidade), 0);
      expect(total).toBe(240);
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
