/**
 * Vitest tests for discount history endpoints
 * Tests: getDiscountHistoryAll, getDiscountHistoryById
 */
import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000/api/trpc";

async function trpcQuery(path: string, input: any) {
  const url = `${BASE}/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await fetch(url);
  const body = await res.json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result.data.json;
}

describe("financial.getDiscountHistoryAll", () => {
  it("returns an array of discount history records", async () => {
    const records = await trpcQuery("financial.getDiscountHistoryAll", { limit: 50 });
    expect(Array.isArray(records)).toBe(true);
  });

  it("each record has required fields", async () => {
    const records = await trpcQuery("financial.getDiscountHistoryAll", { limit: 5 });
    if (records.length === 0) return; // skip if no data
    const record = records[0];
    expect(record).toHaveProperty("id");
    expect(record).toHaveProperty("operatorName");
    expect(record).toHaveProperty("empresa");
    expect(record).toHaveProperty("contaLabel");
    expect(record).toHaveProperty("mesKey");
    expect(record).toHaveProperty("totalTitulos");
    expect(record).toHaveProperty("valorTotal");
    expect(record).toHaveProperty("titulosJson");
    expect(record).toHaveProperty("createdAt");
  });

  it("records are ordered by createdAt descending", async () => {
    const records = await trpcQuery("financial.getDiscountHistoryAll", { limit: 50 });
    if (records.length < 2) return;
    for (let i = 0; i < records.length - 1; i++) {
      const a = new Date(records[i].createdAt).getTime();
      const b = new Date(records[i + 1].createdAt).getTime();
      expect(a).toBeGreaterThanOrEqual(b);
    }
  });

  it("titulosJson is valid JSON array with expected fields", async () => {
    const records = await trpcQuery("financial.getDiscountHistoryAll", { limit: 1 });
    if (records.length === 0) return;
    const titulos = JSON.parse(records[0].titulosJson);
    expect(Array.isArray(titulos)).toBe(true);
    if (titulos.length > 0) {
      expect(titulos[0]).toHaveProperty("cliente");
      expect(titulos[0]).toHaveProperty("valor");
      expect(titulos[0]).toHaveProperty("vencimento");
    }
  });

  it("respects limit parameter", async () => {
    const records = await trpcQuery("financial.getDiscountHistoryAll", { limit: 1 });
    expect(records.length).toBeLessThanOrEqual(1);
  });
});

describe("financial.getDiscountHistoryById", () => {
  it("returns a specific record by ID", async () => {
    // First get all to find an ID
    const all = await trpcQuery("financial.getDiscountHistoryAll", { limit: 1 });
    if (all.length === 0) return;
    const id = all[0].id;

    const record = await trpcQuery("financial.getDiscountHistoryById", { id });
    expect(record).not.toBeNull();
    expect(record.id).toBe(id);
    expect(record.operatorName).toBe(all[0].operatorName);
    expect(record.empresa).toBe(all[0].empresa);
    expect(record.totalTitulos).toBe(all[0].totalTitulos);
  });

  it("returns null for non-existent ID", async () => {
    const record = await trpcQuery("financial.getDiscountHistoryById", { id: 999999 });
    expect(record).toBeNull();
  });
});
