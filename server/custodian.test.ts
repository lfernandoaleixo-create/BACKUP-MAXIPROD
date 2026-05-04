import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000/api/trpc";

// Helper to make tRPC query calls with superjson
async function trpcQuery(proc: string, input?: any) {
  const params = new URLSearchParams({ batch: "1" });
  if (input !== undefined) {
    params.set("input", JSON.stringify({ "0": { json: input } }));
  } else {
    params.set("input", JSON.stringify({ "0": { json: {} } }));
  }
  const res = await fetch(`${BASE}/${proc}?${params}`);
  const body = await res.json();
  return body[0]?.result?.data?.json;
}

// Helper to make tRPC mutation calls with superjson
async function trpcMutate(proc: string, input: any) {
  const res = await fetch(`${BASE}/${proc}?batch=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ "0": { json: input } }),
  });
  const body = await res.json();
  return body[0]?.result?.data?.json;
}

describe("Cheque Custodian Endpoints", () => {
  const testChequeId = 99999;

  it("should return empty map when no custodians exist for test cheque", async () => {
    const map = await trpcQuery("financial.getCustodians");
    expect(map).toBeDefined();
    expect(typeof map).toBe("object");
    // testChequeId should not exist yet (or was cleaned up)
  });

  it("should set a custodian for a cheque", async () => {
    const result = await trpcMutate("financial.setCustodian", {
      chequeId: testChequeId,
      responsavel: "Flavio",
    });
    expect(result).toEqual({ success: true, removed: false });
  });

  it("should return the custodian in the map", async () => {
    const map = await trpcQuery("financial.getCustodians");
    expect(map[testChequeId]).toBe("Flavio");
  });

  it("should update an existing custodian", async () => {
    const result = await trpcMutate("financial.setCustodian", {
      chequeId: testChequeId,
      responsavel: "Gilson",
    });
    expect(result).toEqual({ success: true, removed: false });

    const map = await trpcQuery("financial.getCustodians");
    expect(map[testChequeId]).toBe("Gilson");
  });

  it("should remove a custodian when empty string is sent", async () => {
    const result = await trpcMutate("financial.setCustodian", {
      chequeId: testChequeId,
      responsavel: "",
    });
    expect(result).toEqual({ success: true, removed: true });

    const map = await trpcQuery("financial.getCustodians");
    expect(map[testChequeId]).toBeUndefined();
  });
});
