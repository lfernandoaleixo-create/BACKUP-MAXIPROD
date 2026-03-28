import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules BEFORE imports - vi.mock is hoisted
vi.mock("./db", () => {
  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  const mockInsertChain = {
    values: vi.fn().mockResolvedValue(undefined),
  };
  const mockDeleteChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  const db = {
    select: vi.fn().mockReturnValue(mockSelectChain),
    insert: vi.fn().mockReturnValue(mockInsertChain),
    delete: vi.fn().mockReturnValue(mockDeleteChain),
    update: vi.fn(),
    _selectChain: mockSelectChain,
    _insertChain: mockInsertChain,
    _deleteChain: mockDeleteChain,
  };
  return {
    getDb: vi.fn().mockResolvedValue(db),
    __mockDb: db,
  };
});

vi.mock("./_core/env", () => ({
  ENV: {
    MAXIPROD_GRAPHQL_TOKEN: "test-token",
  },
}));

// Mock fetch for GraphQL calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { billingRouter } from "./billingRouter";
import { getDb } from "./db";

function createCaller() {
  return billingRouter.createCaller({
    user: null,
    req: {} as any,
    res: {} as any,
  });
}

describe("Billing Authorization", () => {
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb = (await getDb()) as any;
    // Reset chain defaults
    mockDb._selectChain.from.mockReturnThis();
    mockDb._selectChain.where.mockReturnThis();
    mockDb._selectChain.limit.mockResolvedValue([]);
    mockDb.select.mockReturnValue(mockDb._selectChain);
    mockDb.insert.mockReturnValue(mockDb._insertChain);
    mockDb.delete.mockReturnValue(mockDb._deleteChain);
    mockDb._insertChain.values.mockResolvedValue(undefined);
    mockDb._deleteChain.where.mockResolvedValue(undefined);
  });

  describe("getAuthorizedOrders", () => {
    it("should return empty array when no authorizations exist", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockResolvedValueOnce([]),
      });
      const caller = createCaller();
      const result = await caller.getAuthorizedOrders();
      expect(result.authorizedPedidos).toEqual([]);
    });

    it("should return list of authorized pedido numbers", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockResolvedValueOnce([
          { pedido: "155" },
          { pedido: "437" },
          { pedido: "502" },
        ]),
      });
      const caller = createCaller();
      const result = await caller.getAuthorizedOrders();
      expect(result.authorizedPedidos).toEqual(["155", "437", "502"]);
    });
  });

  describe("authorizeOrders", () => {
    it("should reject with wrong password", async () => {
      // Mock: no billing-specific password, no admin password override
      mockDb._selectChain.limit
        .mockResolvedValueOnce([]) // billing_auth_password
        .mockResolvedValueOnce([]); // admin_password (fallback to default)

      const caller = createCaller();
      const result = await caller.authorizeOrders({
        password: "wrong_password",
        pedidos: ["155"],
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Senha incorreta");
    });

    it("should accept with default admin password", async () => {
      // Mock: no billing-specific password, no admin password override → uses default "240288"
      mockDb._selectChain.limit
        .mockResolvedValueOnce([]) // billing_auth_password
        .mockResolvedValueOnce([]); // admin_password (fallback to default)

      const caller = createCaller();
      const result = await caller.authorizeOrders({
        password: "240288",
        pedidos: ["155"],
      });
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it("should accept with custom billing password", async () => {
      // Mock: billing-specific password exists
      mockDb._selectChain.limit
        .mockResolvedValueOnce([{ settingValue: "custom_billing_pwd" }]);

      const caller = createCaller();
      const result = await caller.authorizeOrders({
        password: "custom_billing_pwd",
        pedidos: ["155", "437"],
      });
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });

    it("should validate pedidos array is not empty", async () => {
      const caller = createCaller();
      await expect(
        caller.authorizeOrders({ password: "240288", pedidos: [] })
      ).rejects.toThrow();
    });

    it("should validate pedidos array max length is 50", async () => {
      const caller = createCaller();
      const pedidos = Array.from({ length: 51 }, (_, i) => String(i + 1));
      await expect(
        caller.authorizeOrders({ password: "240288", pedidos })
      ).rejects.toThrow();
    });
  });

  describe("deauthorizeOrders", () => {
    it("should reject with wrong password", async () => {
      mockDb._selectChain.limit
        .mockResolvedValueOnce([]) // billing_auth_password
        .mockResolvedValueOnce([]); // admin_password

      const caller = createCaller();
      const result = await caller.deauthorizeOrders({
        password: "wrong",
        pedidos: ["155"],
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Senha incorreta");
    });

    it("should accept with correct password and delete authorizations", async () => {
      mockDb._selectChain.limit
        .mockResolvedValueOnce([]) // billing_auth_password
        .mockResolvedValueOnce([]); // admin_password

      const caller = createCaller();
      const result = await caller.deauthorizeOrders({
        password: "240288",
        pedidos: ["155"],
      });
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });
  });

  describe("cleanupBilledAuthorizations", () => {
    it("should return removed: 0 when no authorizations exist", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockResolvedValueOnce([]),
      });

      const caller = createCaller();
      const result = await caller.cleanupBilledAuthorizations();
      expect(result.removed).toBe(0);
    });
  });
});
