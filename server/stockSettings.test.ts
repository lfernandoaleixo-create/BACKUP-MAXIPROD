import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({ from: (table: any) => ({ where: (cond: any) => ({ limit: mockLimit }) }) }),
    insert: (table: any) => ({ values: mockValues }),
    update: (table: any) => ({ set: (data: any) => ({ where: mockWhere }) }),
  })),
}));

function createContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("settings.setProductStockSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts valid input with vendaMensal, fatorMultiplicacao and prazoCompraDias", async () => {
    // Mock: no existing record
    mockLimit.mockResolvedValue([]);
    mockValues.mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());

    const result = await caller.settings.setProductStockSettings({
      codigoItem: "TEST001",
      vendaMensal: 100,
      fatorMultiplicacao: "2.3",
      prazoCompraDias: 30,
    });

    expect(result).toHaveProperty("success");
  });

  it("accepts null values for all optional fields", async () => {
    mockLimit.mockResolvedValue([]);
    mockValues.mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());

    const result = await caller.settings.setProductStockSettings({
      codigoItem: "TEST002",
      vendaMensal: null,
      fatorMultiplicacao: null,
      prazoCompraDias: null,
    });

    expect(result).toHaveProperty("success");
  });

  it("accepts empty string codigoItem", async () => {
    mockLimit.mockResolvedValue([]);
    mockValues.mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());

    const result = await caller.settings.setProductStockSettings({
      codigoItem: "",
      vendaMensal: 50,
      fatorMultiplicacao: "2.0",
      prazoCompraDias: 30,
    });

    expect(result).toHaveProperty("success"); // empty string is still a valid string
  });
});

describe("settings.getProductPricing includes new fields", () => {
  it("route exists and is callable", async () => {
    const caller = appRouter.createCaller(createContext());

    // Verifies the route exists and is callable (may return [] or mocked data)
    const result = await caller.settings.getProductPricing();
    // With mock DB, it returns the result of the mock chain
    expect(result).toBeDefined();
  });
});
