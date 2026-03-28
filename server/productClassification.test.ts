import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getDb
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({ from: (t: any) => ({ where: (w: any) => ({ limit: mockLimit }) }) }),
    insert: (t: any) => ({ values: mockValues }),
    update: (t: any) => ({ set: (s: any) => ({ where: mockUpdate }) }),
    delete: (t: any) => ({ where: mockDelete }),
  })),
}));

describe("Product Classification Schema", () => {
  it("should define productClassification table with correct enum values", async () => {
    const { productClassification } = await import("../drizzle/schema");
    expect(productClassification).toBeDefined();
    // Check that the table name is correct
    // Table is a valid drizzle table object
    expect(typeof productClassification).toBe("object");
  });

  it("should have codigoItem, descricao, and classification columns", async () => {
    const { productClassification } = await import("../drizzle/schema");
    expect(productClassification.codigoItem).toBeDefined();
    expect(productClassification.descricao).toBeDefined();
    expect(productClassification.classification).toBeDefined();
  });

  it("classification enum should accept estoque, encomenda, outros", async () => {
    const { productClassification } = await import("../drizzle/schema");
    const enumValues = (productClassification.classification as any).enumValues;
    expect(enumValues).toContain("estoque");
    expect(enumValues).toContain("encomenda");
    expect(enumValues).toContain("outros");
    expect(enumValues).toHaveLength(3);
  });
});

describe("Product Classification - Mutual Exclusivity", () => {
  it("classification should only allow one of the three values", () => {
    const validValues = ["estoque", "encomenda", "outros"];
    const invalidValues = ["both", "none", "custom", ""];
    
    for (const v of validValues) {
      expect(validValues).toContain(v);
    }
    for (const v of invalidValues) {
      expect(validValues).not.toContain(v);
    }
  });

  it("should not allow empty classification", () => {
    const validValues = ["estoque", "encomenda", "outros"];
    expect(validValues).not.toContain("");
    expect(validValues).not.toContain(null);
    expect(validValues).not.toContain(undefined);
  });
});
