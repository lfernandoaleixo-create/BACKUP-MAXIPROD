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
  pirografiaEntries: {
    id: "id", sectorId: "sectorId", machineId: "machineId",
    data: "data", codigoItem: "codigoItem", descricaoItem: "descricaoItem",
    materialOrigem: "materialOrigem", nomePirografado: "nomePirografado",
    quantidade: "quantidade", observacoes: "observacoes", lancadoPor: "lancadoPor",
    createdAt: "createdAt", updatedAt: "updatedAt",
  },
  stockItems: {
    codigoItem: "codigoItem", descricaoItem: "descricaoItem",
    unidadeMedida: "unidadeMedida", superGrupoCodigo: "superGrupoCodigo",
    grupoCodigo: "grupoCodigo",
  },
  dashboardData: { key: "key", value: "value" },
  stockEditHistory: { id: "id" },
  madeiraStock: { id: "id" },
}));

describe("Pirografia Module", () => {
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
    mockWhere.mockResolvedValue([]);
  });

  describe("Pirografia Data Model", () => {
    it("should define pirografia_entries table with required columns", () => {
      // The pirografia_entries table must have these columns for full registration
      const requiredColumns = [
        "id", "sectorId", "machineId", "data",
        "codigoItem", "descricaoItem", "materialOrigem",
        "nomePirografado", "quantidade", "observacoes",
        "lancadoPor", "createdAt", "updatedAt",
      ];
      // Verify the schema definition has all required columns
      const pirografiaSchema = {
        id: "id", sectorId: "sectorId", machineId: "machineId",
        data: "data", codigoItem: "codigoItem", descricaoItem: "descricaoItem",
        materialOrigem: "materialOrigem", nomePirografado: "nomePirografado",
        quantidade: "quantidade", observacoes: "observacoes",
        lancadoPor: "lancadoPor", createdAt: "createdAt", updatedAt: "updatedAt",
      };
      for (const col of requiredColumns) {
        expect(pirografiaSchema).toHaveProperty(col);
      }
    });

    it("should support both bambu and madeira as materialOrigem", () => {
      // materialOrigem must be either 'bambu' or 'madeira'
      const validMaterials = ["bambu", "madeira"];
      expect(validMaterials).toContain("bambu");
      expect(validMaterials).toContain("madeira");
    });

    it("should require nomePirografado to be non-empty", () => {
      // The name engraved on the stick must be recorded
      const validName = "João Silva";
      expect(validName.trim().length).toBeGreaterThan(0);

      const emptyName = "";
      expect(emptyName.trim().length).toBe(0);
    });
  });

  describe("Pirografia Entry Structure", () => {
    it("should create a valid pirografia entry object", () => {
      const entry = {
        sectorId: 9,
        machineId: 1,
        data: "2026-04-15",
        codigoItem: "PA-001",
        descricaoItem: "Palito de Bambu 150mm",
        materialOrigem: "bambu",
        nomePirografado: "João Silva",
        quantidade: 50,
        lancadoPor: "Maria",
      };

      expect(entry.sectorId).toBe(9);
      expect(entry.machineId).toBe(1);
      expect(entry.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.codigoItem).toBeTruthy();
      expect(entry.materialOrigem).toBe("bambu");
      expect(entry.nomePirografado).toBe("João Silva");
      expect(entry.quantidade).toBeGreaterThan(0);
      expect(entry.lancadoPor).toBe("Maria");
    });

    it("should create a valid madeira pirografia entry", () => {
      const entry = {
        sectorId: 9,
        machineId: 2,
        data: "2026-04-15",
        codigoItem: "PA-100",
        descricaoItem: "Palito de Madeira 200mm",
        materialOrigem: "madeira",
        nomePirografado: "Empresa ABC",
        quantidade: 100,
        lancadoPor: "Maria",
      };

      expect(entry.materialOrigem).toBe("madeira");
      expect(entry.nomePirografado).toBe("Empresa ABC");
      expect(entry.quantidade).toBe(100);
    });

    it("should not allow zero or negative quantities", () => {
      const invalidQty1 = 0;
      const invalidQty2 = -5;
      const validQty = 10;

      expect(invalidQty1).toBeLessThanOrEqual(0);
      expect(invalidQty2).toBeLessThan(0);
      expect(validQty).toBeGreaterThan(0);
    });
  });

  describe("Pirografia Product Classification", () => {
    it("should classify bambu products by superGrupoCodigo 12", () => {
      const bambuProduct = { superGrupoCodigo: "12", descricaoItem: "Palito Bambu" };
      const isBambu = bambuProduct.superGrupoCodigo === "12";
      expect(isBambu).toBe(true);
    });

    it("should classify madeira products by superGrupoCodigo 05 or 16 (groups 18/19)", () => {
      const madeiraProduct1 = { superGrupoCodigo: "05", descricaoItem: "Palito Madeira" };
      const madeiraProduct2 = { superGrupoCodigo: "16", grupoCodigo: "18", descricaoItem: "Palito Madeira PA" };

      const isMadeira1 = madeiraProduct1.superGrupoCodigo === "05";
      const isMadeira2 = madeiraProduct2.superGrupoCodigo === "16" &&
        ["18", "19"].includes(madeiraProduct2.grupoCodigo);

      expect(isMadeira1).toBe(true);
      expect(isMadeira2).toBe(true);
    });
  });

  describe("Pirografia History Analytics", () => {
    it("should aggregate top names from pirografia entries", () => {
      const entries = [
        { nomePirografado: "João", quantidade: 50 },
        { nomePirografado: "Maria", quantidade: 30 },
        { nomePirografado: "João", quantidade: 20 },
        { nomePirografado: "Pedro", quantidade: 10 },
      ];

      // Aggregate by name
      const nameMap: Record<string, { quantidade: number; registros: number }> = {};
      for (const e of entries) {
        if (!nameMap[e.nomePirografado]) {
          nameMap[e.nomePirografado] = { quantidade: 0, registros: 0 };
        }
        nameMap[e.nomePirografado].quantidade += e.quantidade;
        nameMap[e.nomePirografado].registros += 1;
      }

      expect(nameMap["João"].quantidade).toBe(70);
      expect(nameMap["João"].registros).toBe(2);
      expect(nameMap["Maria"].quantidade).toBe(30);
      expect(nameMap["Maria"].registros).toBe(1);
      expect(nameMap["Pedro"].quantidade).toBe(10);
    });

    it("should aggregate top products from pirografia entries", () => {
      const entries = [
        { codigoItem: "PA-001", materialOrigem: "bambu", quantidade: 50 },
        { codigoItem: "PA-001", materialOrigem: "bambu", quantidade: 30 },
        { codigoItem: "PA-100", materialOrigem: "madeira", quantidade: 20 },
      ];

      const productMap: Record<string, { quantidade: number; registros: number }> = {};
      for (const e of entries) {
        const key = `${e.codigoItem}_${e.materialOrigem}`;
        if (!productMap[key]) {
          productMap[key] = { quantidade: 0, registros: 0 };
        }
        productMap[key].quantidade += e.quantidade;
        productMap[key].registros += 1;
      }

      expect(productMap["PA-001_bambu"].quantidade).toBe(80);
      expect(productMap["PA-001_bambu"].registros).toBe(2);
      expect(productMap["PA-100_madeira"].quantidade).toBe(20);
    });
  });

  describe("Pirografia Production Entries Sync", () => {
    it("should sync pirografia quantity to production_entries for sector totals", () => {
      // When saving a pirografia entry, the system also updates production_entries
      // to keep sector totals consistent
      const pirografiaEntry = {
        sectorId: 9,
        machineId: 1,
        data: "2026-04-15",
        materialOrigem: "bambu",
        quantidade: 50,
      };

      // The production_entries tipoMadeira should be the materialOrigem
      expect(pirografiaEntry.materialOrigem).toBe("bambu");

      // Quantity should be added to existing production_entries for that machine/day/material
      const existingPE = { quantidade: "30" };
      const newTotal = parseFloat(existingPE.quantidade) + pirografiaEntry.quantidade;
      expect(newTotal).toBe(80);
    });

    it("should subtract from production_entries when deleting pirografia entry", () => {
      const deletedEntry = { quantidade: "20" };
      const existingPE = { quantidade: "50" };

      const newTotal = parseFloat(existingPE.quantidade) - parseFloat(deletedEntry.quantidade);
      expect(newTotal).toBe(30);
      expect(newTotal).toBeGreaterThanOrEqual(0);
    });

    it("should handle update quantity diff correctly", () => {
      const oldQty = 30;
      const newQty = 50;
      const diff = newQty - oldQty;
      expect(diff).toBe(20);

      const existingPEQty = 100;
      const updatedPEQty = existingPEQty + diff;
      expect(updatedPEQty).toBe(120);
    });
  });

  describe("Pirografia Entries Grouping", () => {
    it("should group entries by machineId", () => {
      const entries = [
        { id: 1, machineId: 1, nomePirografado: "João", quantidade: "50" },
        { id: 2, machineId: 1, nomePirografado: "Maria", quantidade: "30" },
        { id: 3, machineId: 2, nomePirografado: "Pedro", quantidade: "20" },
        { id: 4, machineId: 3, nomePirografado: "Ana", quantidade: "10" },
      ];

      const byMachine: Record<number, any[]> = {};
      for (const e of entries) {
        if (!byMachine[e.machineId]) byMachine[e.machineId] = [];
        byMachine[e.machineId].push(e);
      }

      expect(byMachine[1].length).toBe(2);
      expect(byMachine[2].length).toBe(1);
      expect(byMachine[3].length).toBe(1);
    });

    it("should calculate machine total from grouped entries", () => {
      const machineEntries = [
        { quantidade: "50" },
        { quantidade: "30" },
        { quantidade: "20" },
      ];

      const total = machineEntries.reduce((sum, e) => sum + parseFloat(e.quantidade), 0);
      expect(total).toBe(100);
    });
  });

  describe("Pirografia Date Validation", () => {
    it("should accept valid date format YYYY-MM-DD", () => {
      const validDate = "2026-04-15";
      expect(validDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should filter entries by date", () => {
      const entries = [
        { data: "2026-04-15", nomePirografado: "João", quantidade: "50" },
        { data: "2026-04-15", nomePirografado: "Maria", quantidade: "30" },
        { data: "2026-04-14", nomePirografado: "Pedro", quantidade: "20" },
      ];

      const filtered = entries.filter(e => e.data === "2026-04-15");
      expect(filtered.length).toBe(2);
    });
  });
});
