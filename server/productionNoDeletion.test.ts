import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests to verify that production history is NEVER deleted.
 * REGRA: Tudo que a Maria registrar de histórico nunca pode ser apagado.
 * 
 * Verifies:
 * 1. deleteEntry does soft-delete (sets quantity to 0) instead of hard-delete
 * 2. batchUpsertEntries does soft-delete for removed variants
 * 3. deletePirografiaEntry does soft-delete instead of hard-delete
 * 4. stockEditHistory query returns all history (no 15-day filter)
 */

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
const mockOnDuplicateKeyUpdate = vi.fn();

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
  productionSectors: { id: "id", ordem: "ordem", nome: "nome", tipoEquipamento: "tipoEquipamento" },
  productionMachines: { id: "id", sectorId: "sectorId", ordem: "ordem" },
  productionEntries: {
    id: "id", sectorId: "sectorId", machineId: "machineId",
    data: "data", quantidade: "quantidade", status: "status",
    tipoMadeira: "tipoMadeira", observacoes: "observacoes", lancadoPor: "lancadoPor",
  },
  pirografiaEntries: {
    id: "id", sectorId: "sectorId", machineId: "machineId",
    data: "data", quantidade: "quantidade", observacoes: "observacoes",
    codigoItem: "codigoItem", descricaoItem: "descricaoItem",
    materialOrigem: "materialOrigem", nomePirografado: "nomePirografado",
    lancadoPor: "lancadoPor",
  },
  dashboardData: { key: "key", value: "value" },
  stockItems: { id: "id" },
  madeiraStock: { id: "id", codigoItem: "codigoItem", quantidade: "quantidade" },
  stockEditHistory: { id: "id", card: "card", codigoItem: "codigoItem", createdAt: "createdAt" },
}));

describe("Production History Protection - NUNCA APAGAR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy, groupBy: mockGroupBy, limit: mockLimit });
    mockOrderBy.mockReturnValue({ where: mockWhere });
    mockGroupBy.mockReturnValue({ orderBy: mockOrderBy });
    mockLimit.mockResolvedValue([]);
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onDuplicateKeyUpdate: mockOnDuplicateKeyUpdate });
    mockOnDuplicateKeyUpdate.mockResolvedValue([{ insertId: 1 }]);
    mockValues.mockResolvedValue([{ insertId: 1 }]);
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  });

  describe("deleteEntry - Soft Delete", () => {
    it("should use db.update instead of db.delete for production entries", async () => {
      // Import the router source to check it uses update, not delete
      const routerSource = await import("fs").then(fs =>
        fs.readFileSync("/home/ubuntu/grupo-fox-dashboard/server/productionRouter.ts", "utf-8")
      );

      // Find the deleteEntry mutation
      const deleteEntryMatch = routerSource.match(/deleteEntry:[\s\S]*?\.mutation\(async[\s\S]*?\}\),/);
      expect(deleteEntryMatch).toBeTruthy();
      const deleteEntryCode = deleteEntryMatch![0];

      // MUST NOT contain db.delete for productionEntries
      expect(deleteEntryCode).not.toContain("db.delete(productionEntries)");

      // MUST contain db.update (soft-delete)
      expect(deleteEntryCode).toContain("db.update(productionEntries)");

      // MUST set quantidade to "0"
      expect(deleteEntryCode).toContain('quantidade: "0"');

      // MUST mark as [REMOVIDO]
      expect(deleteEntryCode).toContain("[REMOVIDO]");
    });
  });

  describe("batchUpsertEntries - Soft Delete for removed variants", () => {
    it("should use db.update instead of db.delete for old variants", async () => {
      const routerSource = await import("fs").then(fs =>
        fs.readFileSync("/home/ubuntu/grupo-fox-dashboard/server/productionRouter.ts", "utf-8")
      );

      // Find the section that handles old entries not in new set
      const batchSection = routerSource.match(/Soft-delete old entries[\s\S]*?results\.push/);
      expect(batchSection).toBeTruthy();
      const batchCode = batchSection![0];

      // MUST NOT contain db.delete for productionEntries in this section
      expect(batchCode).not.toContain("db.delete(productionEntries)");

      // MUST contain db.update (soft-delete)
      expect(batchCode).toContain("db.update(productionEntries)");

      // MUST set quantidade to "0"
      expect(batchCode).toContain('quantidade: "0"');
    });
  });

  describe("deletePirografiaEntry - Soft Delete", () => {
    it("should use db.update instead of db.delete for pirografia entries", async () => {
      const routerSource = await import("fs").then(fs =>
        fs.readFileSync("/home/ubuntu/grupo-fox-dashboard/server/productionRouter.ts", "utf-8")
      );

      // Find the deletePirografiaEntry mutation
      const deletePiroMatch = routerSource.match(/deletePirografiaEntry:[\s\S]*?\.mutation\(async[\s\S]*?return \{ success: true \};[\s\S]*?\}\),/);
      expect(deletePiroMatch).toBeTruthy();
      const deletePiroCode = deletePiroMatch![0];

      // MUST NOT contain db.delete for pirografiaEntries
      expect(deletePiroCode).not.toContain("db.delete(pirografiaEntries)");

      // MUST contain db.update for pirografiaEntries (soft-delete)
      expect(deletePiroCode).toContain("db.update(pirografiaEntries)");

      // MUST NOT contain db.delete for productionEntries in the subtraction section
      expect(deletePiroCode).not.toContain("db.delete(productionEntries)");

      // MUST mark pirografia as [REMOVIDO]
      expect(deletePiroCode).toContain("[REMOVIDO]");
    });
  });

  describe("stockEditHistory - No time filter", () => {
    it("should NOT have a 15-day filter in getStockEditHistory", async () => {
      const routerSource = await import("fs").then(fs =>
        fs.readFileSync("/home/ubuntu/grupo-fox-dashboard/server/routers.ts", "utf-8")
      );

      // Find the getStockEditHistory query
      const historyMatch = routerSource.match(/getStockEditHistory:[\s\S]*?return \{ history: rows \};/);
      expect(historyMatch).toBeTruthy();
      const historyCode = historyMatch![0];

      // MUST NOT contain fifteenDaysAgo or any date filter
      expect(historyCode).not.toContain("fifteenDaysAgo");
      expect(historyCode).not.toContain("getDate() - 15");

      // MUST have a higher limit (>= 500)
      expect(historyCode).toContain(".limit(500)");
    });
  });

  describe("No hard-delete anywhere in productionRouter", () => {
    it("should NOT have any db.delete(productionEntries) calls", async () => {
      const routerSource = await import("fs").then(fs =>
        fs.readFileSync("/home/ubuntu/grupo-fox-dashboard/server/productionRouter.ts", "utf-8")
      );

      // Count occurrences of db.delete(productionEntries)
      const hardDeletes = (routerSource.match(/db\.delete\(productionEntries\)/g) || []).length;
      expect(hardDeletes).toBe(0);
    });

    it("should NOT have any db.delete(pirografiaEntries) calls", async () => {
      const routerSource = await import("fs").then(fs =>
        fs.readFileSync("/home/ubuntu/grupo-fox-dashboard/server/productionRouter.ts", "utf-8")
      );

      // Count occurrences of db.delete(pirografiaEntries)
      const hardDeletes = (routerSource.match(/db\.delete\(pirografiaEntries\)/g) || []).length;
      expect(hardDeletes).toBe(0);
    });
  });
});
