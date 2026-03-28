import { describe, it, expect } from "vitest";
import { testGraphQLConnection, runGraphQLSync, getSyncProgress } from "./maxiprodGraphQL";

describe("Maxiprod GraphQL Sync", () => {
  it("should connect to GraphQL API successfully", async () => {
    const result = await testGraphQLConnection();
    expect(result.connected).toBe(true);
    expect(result.itemCount).toBeGreaterThan(0);
    expect(result.error).toBeUndefined();
  }, 15000);

  it("should return idle progress before sync", () => {
    const progress = getSyncProgress();
    expect(progress.status).toBeDefined();
    expect(typeof progress.percent).toBe("number");
  });

  it("should run full sync via GraphQL API", async () => {
    const result = await runGraphQLSync();
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.counts).toBeDefined();
    expect(result.counts!.stock).toBeGreaterThan(0);
    expect(result.counts!.openOrders).toBeGreaterThanOrEqual(0);
    expect(result.counts!.purchaseOrders).toBeGreaterThanOrEqual(0);
    expect(result.counts!.salesOrders).toBeGreaterThanOrEqual(0);
  }, 120000); // 2 min timeout for full sync

  it("should show success progress after sync", () => {
    const progress = getSyncProgress();
    expect(progress.status).toBe("success");
    expect(progress.percent).toBe(100);
  });
});
