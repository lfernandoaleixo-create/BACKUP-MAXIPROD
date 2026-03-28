import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;

/**
 * tRPC uses superjson transformer, so:
 * - Query responses are in {result: {data: {json: ..., meta: ...}}}
 * - Mutations need input wrapped as {json: input}
 */
async function trpcQuery(path: string, input?: any) {
  const url = input
    ? `${BASE}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : `${BASE}/api/trpc/${path}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.result?.data?.json;
}

async function trpcMutation(path: string, input: any) {
  const res = await fetch(`${BASE}/api/trpc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const json = await res.json();
  if (json.error) return json.error?.json || json.error;
  return json.result?.data?.json;
}

describe("settings router", () => {
  let backupTargets: any[] = [];
  let testTargetId: number | null = null;

  beforeAll(async () => {
    backupTargets = (await trpcQuery("settings.getSalesTargets")) || [];
  });

  afterAll(async () => {
    // Clean up: delete any test target we created
    if (testTargetId) {
      await trpcMutation("settings.deleteSalesTarget", {
        password: "240288",
        id: testTargetId,
      });
    }
    // Also clean up any 2099-12 targets
    const currentTargets = (await trpcQuery("settings.getSalesTargets")) || [];
    for (const target of currentTargets) {
      if (target.yearMonth === "2099-12") {
        await trpcMutation("settings.deleteSalesTarget", {
          password: "240288",
          id: target.id,
        });
      }
    }
  });

  describe("verifyPassword", () => {
    it("should accept correct password", async () => {
      const result = await trpcMutation("settings.verifyPassword", {
        password: "240288",
      });
      expect(result).toEqual({ success: true });
    });

    it("should reject incorrect password", async () => {
      const result = await trpcMutation("settings.verifyPassword", {
        password: "wrongpassword",
      });
      expect(result).toEqual({ success: false });
    });
  });

  describe("salesTargets", () => {
    it("should get sales targets list", async () => {
      const result = await trpcQuery("settings.getSalesTargets");
      expect(Array.isArray(result)).toBe(true);
    });

    it("should create a sales target with correct password", async () => {
      const result = await trpcMutation("settings.setSalesTarget", {
        password: "240288",
        yearMonth: "2099-12",
        segment: "all",
        targetValue: 999999,
      });
      expect(result.success).toBe(true);

      // Save the ID for cleanup and later tests
      const targets = await trpcQuery("settings.getSalesTargets", {
        yearMonth: "2099-12",
      });
      if (Array.isArray(targets) && targets.length > 0) {
        const t = targets.find((t: any) => t.yearMonth === "2099-12");
        if (t) testTargetId = t.id;
      }
    });

    it("should reject sales target with wrong password", async () => {
      const result = await trpcMutation("settings.setSalesTarget", {
        password: "wrong",
        yearMonth: "2099-11",
        segment: "all",
        targetValue: 100000,
      });
      // Returns {success: false, error: "Senha incorreta"}
      expect(result.success).toBe(false);
    });

    it("should filter targets by yearMonth", async () => {
      const result = await trpcQuery("settings.getSalesTargets", {
        yearMonth: "2099-12",
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      const testTarget = result.find((t: any) => t.yearMonth === "2099-12");
      expect(testTarget).toBeDefined();
      expect(testTarget.targetValue).toBe("999999.00");
    });

    it("should delete a sales target", async () => {
      expect(testTargetId).not.toBeNull();
      const result = await trpcMutation("settings.deleteSalesTarget", {
        password: "240288",
        id: testTargetId!,
      });
      expect(result.success).toBe(true);
      testTargetId = null; // Already cleaned up
    });
  });

  describe("alertSettings", () => {
    it("should get alert settings with defaults", async () => {
      const result = await trpcQuery("settings.getAlertSettings");
      expect(result).toBeDefined();
      expect(typeof result.stockMinEnabled).toBe("boolean");
      expect(typeof result.stockMinThreshold).toBe("number");
    });
  });

  describe("generalSettings", () => {
    it("should get general settings with data info", async () => {
      const result = await trpcQuery("settings.getGeneralSettings");
      expect(result).toBeDefined();
      expect(result.dataInfo).toBeDefined();
    });
  });
});
