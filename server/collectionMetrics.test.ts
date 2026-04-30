import { describe, it, expect } from "vitest";

// Test the collection metrics router endpoints structure
describe("Collection Metrics Router", () => {
  it("should export the collectionMetricsRouter", async () => {
    const { collectionMetricsRouter } = await import("./collectionMetricsRouter");
    expect(collectionMetricsRouter).toBeDefined();
  });

  it("should have getOverviewMetrics procedure", async () => {
    const { collectionMetricsRouter } = await import("./collectionMetricsRouter");
    const procedures = Object.keys((collectionMetricsRouter as any)._def.procedures);
    expect(procedures).toContain("getOverviewMetrics");
  });

  it("should have getActionTimeline procedure", async () => {
    const { collectionMetricsRouter } = await import("./collectionMetricsRouter");
    const procedures = Object.keys((collectionMetricsRouter as any)._def.procedures);
    expect(procedures).toContain("getActionTimeline");
  });

  it("should have getStepBreakdown procedure", async () => {
    const { collectionMetricsRouter } = await import("./collectionMetricsRouter");
    const procedures = Object.keys((collectionMetricsRouter as any)._def.procedures);
    expect(procedures).toContain("getStepBreakdown");
  });

  it("should have getRecoveryTimeline procedure", async () => {
    const { collectionMetricsRouter } = await import("./collectionMetricsRouter");
    const procedures = Object.keys((collectionMetricsRouter as any)._def.procedures);
    expect(procedures).toContain("getRecoveryTimeline");
  });

  it("should have getRecoveryDetails procedure", async () => {
    const { collectionMetricsRouter } = await import("./collectionMetricsRouter");
    const procedures = Object.keys((collectionMetricsRouter as any)._def.procedures);
    expect(procedures).toContain("getRecoveryDetails");
  });

  it("should have getStatusDistribution procedure", async () => {
    const { collectionMetricsRouter } = await import("./collectionMetricsRouter");
    const procedures = Object.keys((collectionMetricsRouter as any)._def.procedures);
    expect(procedures).toContain("getStatusDistribution");
  });

  it("should have getOperatorMetrics procedure", async () => {
    const { collectionMetricsRouter } = await import("./collectionMetricsRouter");
    const procedures = Object.keys((collectionMetricsRouter as any)._def.procedures);
    expect(procedures).toContain("getOperatorMetrics");
  });

  it("should have getRecoverySummaryByPeriod procedure", async () => {
    const { collectionMetricsRouter } = await import("./collectionMetricsRouter");
    const procedures = Object.keys((collectionMetricsRouter as any)._def.procedures);
    expect(procedures).toContain("getRecoverySummaryByPeriod");
  });

  it("should have all 8 required procedures", async () => {
    const { collectionMetricsRouter } = await import("./collectionMetricsRouter");
    const procedures = Object.keys((collectionMetricsRouter as any)._def.procedures);
    expect(procedures.length).toBe(8);
    expect(procedures).toEqual(expect.arrayContaining([
      "getOverviewMetrics",
      "getRecoveryTimeline",
      "getActionTimeline",
      "getStepBreakdown",
      "getRecoveryDetails",
      "getStatusDistribution",
      "getOperatorMetrics",
      "getRecoverySummaryByPeriod",
    ]));
  });
});
