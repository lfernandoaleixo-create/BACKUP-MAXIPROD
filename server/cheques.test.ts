import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000";

async function trpcQuery(path: string, input?: any) {
  // tRPC with superjson requires input wrapped in {json: ...}
  const wrappedInput = input !== undefined ? { json: input } : { json: {} };
  const url = `${BASE}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify(wrappedInput))}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(JSON.stringify(json.error));
  return json.result?.data?.json ?? json.result?.data;
}

describe("financial.getCheques", () => {
  it("returns cheques data with correct structure", async () => {
    const data = await trpcQuery("financial.getCheques", {});
    expect(data).toBeDefined();
    expect(data).toHaveProperty("cheques");
    expect(data).toHaveProperty("totalGeral");
    expect(data).toHaveProperty("totalGeralCount");
    expect(data).toHaveProperty("totaisPorEstado");
    expect(Array.isArray(data.cheques)).toBe(true);
    expect(typeof data.totalGeral).toBe("number");
    expect(typeof data.totalGeralCount).toBe("number");
  });

  it("filters by mesKey (YYYY-MM)", async () => {
    const data = await trpcQuery("financial.getCheques", {
      mesKey: "2026-05",
    });
    expect(data).toBeDefined();
    expect(Array.isArray(data.cheques)).toBe(true);
    // All cheques should have vencimentoData in May 2026
    for (const cheque of data.cheques) {
      if (cheque.vencimentoData) {
        expect(cheque.vencimentoData.startsWith("2026-05")).toBe(true);
      }
    }
  });

  it("filters by both empresaNome and mesKey", async () => {
    // First get all cheques to find a valid empresa name
    const allData = await trpcQuery("financial.getCheques", {});
    if (allData.cheques.length === 0) return; // skip if no data
    const empresaNome = allData.cheques[0].empresaNome;

    const data = await trpcQuery("financial.getCheques", {
      empresaNome,
      mesKey: "2026-05",
    });
    expect(data).toBeDefined();
    expect(Array.isArray(data.cheques)).toBe(true);
    for (const cheque of data.cheques) {
      expect(cheque.empresaNome).toBe(empresaNome);
      if (cheque.vencimentoData) {
        expect(cheque.vencimentoData.startsWith("2026-05")).toBe(true);
      }
    }
  });

  it("totaisPorEstado has correct structure", async () => {
    const data = await trpcQuery("financial.getCheques", {});
    expect(data.totaisPorEstado).toBeDefined();
    expect(typeof data.totaisPorEstado).toBe("object");
    for (const [key, val] of Object.entries(data.totaisPorEstado as Record<string, any>)) {
      expect(typeof key).toBe("string");
      expect(val).toHaveProperty("count");
      expect(val).toHaveProperty("valor");
      expect(typeof val.count).toBe("number");
      expect(typeof val.valor).toBe("number");
    }
  });

  it("each cheque has required fields", async () => {
    const data = await trpcQuery("financial.getCheques", {});
    if (data.cheques.length > 0) {
      const cheque = data.cheques[0];
      expect(cheque).toHaveProperty("id");
      expect(cheque).toHaveProperty("cliente");
      expect(cheque).toHaveProperty("valor");
      expect(cheque).toHaveProperty("estadoCheque");
      expect(cheque).toHaveProperty("formaPagamento");
      expect(typeof cheque.valor).toBe("number");
    }
  });

  it("mesKey filter returns fewer or equal results than no filter", async () => {
    const allData = await trpcQuery("financial.getCheques", {});
    const filteredData = await trpcQuery("financial.getCheques", {
      mesKey: "2026-05",
    });
    expect(filteredData.totalGeralCount).toBeLessThanOrEqual(allData.totalGeralCount);
  });

  it("mesKey with no matching month returns 0 cheques", async () => {
    const data = await trpcQuery("financial.getCheques", {
      mesKey: "2020-01",
    });
    expect(data.totalGeralCount).toBe(0);
    expect(data.cheques).toHaveLength(0);
  });
});
