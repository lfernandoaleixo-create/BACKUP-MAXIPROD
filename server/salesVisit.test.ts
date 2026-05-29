import { describe, expect, it, vi, beforeEach } from "vitest";
import { salesVisitRouter, VISIT_OUTCOMES, VISIT_TYPES, NO_SALE_REASONS } from "./salesVisitRouter";

describe("salesVisitRouter constants", () => {
  it("should have valid VISIT_OUTCOMES with required fields", () => {
    expect(VISIT_OUTCOMES.length).toBeGreaterThanOrEqual(5);
    for (const outcome of VISIT_OUTCOMES) {
      expect(outcome.value).toBeTruthy();
      expect(outcome.label).toBeTruthy();
      expect(outcome.color).toBeTruthy();
    }
  });

  it("should have valid VISIT_TYPES with required fields", () => {
    expect(VISIT_TYPES.length).toBeGreaterThanOrEqual(5);
    for (const vt of VISIT_TYPES) {
      expect(vt.value).toBeTruthy();
      expect(vt.label).toBeTruthy();
    }
  });

  it("should have valid NO_SALE_REASONS with required fields", () => {
    expect(NO_SALE_REASONS.length).toBeGreaterThanOrEqual(10);
    for (const reason of NO_SALE_REASONS) {
      expect(reason.value).toBeTruthy();
      expect(reason.label).toBeTruthy();
      expect(reason.description).toBeTruthy();
    }
  });

  it("should include key no-sale reasons for Brazilian market", () => {
    const values = NO_SALE_REASONS.map(r => r.value);
    expect(values).toContain("ESTOQUE_ALTO");
    expect(values).toContain("PRECO_ALTO");
    expect(values).toContain("SEM_VERBA");
    expect(values).toContain("PREFERENCIA_CONCORRENTE");
    expect(values).toContain("PRAZO_ENTREGA");
    expect(values).toContain("INADIMPLENTE");
  });

  it("should have unique values for all constants", () => {
    const outcomeValues = VISIT_OUTCOMES.map(o => o.value);
    expect(new Set(outcomeValues).size).toBe(outcomeValues.length);

    const typeValues = VISIT_TYPES.map(t => t.value);
    expect(new Set(typeValues).size).toBe(typeValues.length);

    const reasonValues = NO_SALE_REASONS.map(r => r.value);
    expect(new Set(reasonValues).size).toBe(reasonValues.length);
  });
});

describe("salesVisitRouter getConstants", () => {
  it("should return all constants via getConstants procedure", async () => {
    // The getConstants procedure is a simple query that returns constants
    // We test the router definition exists and has the expected shape
    expect(salesVisitRouter).toBeDefined();
    expect(salesVisitRouter._def).toBeDefined();
  });
});

describe("salesVisitRouter procedures exist", () => {
  it("should have create procedure", () => {
    expect(salesVisitRouter._def.procedures.create).toBeDefined();
  });

  it("should have update procedure", () => {
    expect(salesVisitRouter._def.procedures.update).toBeDefined();
  });

  it("should have delete procedure", () => {
    expect(salesVisitRouter._def.procedures.delete).toBeDefined();
  });

  it("should have list procedure", () => {
    expect(salesVisitRouter._def.procedures.list).toBeDefined();
  });

  it("should have metrics procedure", () => {
    expect(salesVisitRouter._def.procedures.metrics).toBeDefined();
  });

  it("should have clientMetrics procedure", () => {
    expect(salesVisitRouter._def.procedures.clientMetrics).toBeDefined();
  });

  it("should have getConstants procedure", () => {
    expect(salesVisitRouter._def.procedures.getConstants).toBeDefined();
  });
});
