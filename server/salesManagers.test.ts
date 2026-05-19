import { describe, it, expect } from "vitest";

/**
 * Tests for sales managers CRUD endpoints
 */
describe("Sales Managers", () => {
  const BASE = "http://localhost:3000/api/trpc";

  it("listSalesManagers returns array with pre-seeded managers", async () => {
    const res = await fetch(`${BASE}/sales.listSalesManagers`);
    expect(res.ok).toBe(true);
    const json = await res.json();
    const managers = json.result.data.json;
    expect(Array.isArray(managers)).toBe(true);
    expect(managers.length).toBeGreaterThanOrEqual(2);
    const names = managers.map((m: any) => m.name);
    expect(names).toContain("Juvenal Teixeira");
    expect(names).toContain("Jordão Laine");
  });

  it("createSalesManager creates a new manager", async () => {
    const res = await fetch(`${BASE}/sales.createSalesManager`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { name: "Teste Vitest" } }),
    });
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.result.data.json.success).toBe(true);

    // Verify it was created
    const listRes = await fetch(`${BASE}/sales.listSalesManagers`);
    const listJson = await listRes.json();
    const managers = listJson.result.data.json;
    const created = managers.find((m: any) => m.name === "Teste Vitest");
    expect(created).toBeDefined();

    // Cleanup
    if (created) {
      await fetch(`${BASE}/sales.deleteSalesManager`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { id: created.id } }),
      });
    }
  });

  it("updateSalesManager updates name", async () => {
    // Create
    await fetch(`${BASE}/sales.createSalesManager`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { name: "Update Test" } }),
    });
    const listRes = await fetch(`${BASE}/sales.listSalesManagers`);
    const listJson = await listRes.json();
    const created = listJson.result.data.json.find((m: any) => m.name === "Update Test");
    expect(created).toBeDefined();

    // Update
    const updateRes = await fetch(`${BASE}/sales.updateSalesManager`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { id: created.id, name: "Updated Name" } }),
    });
    expect(updateRes.ok).toBe(true);

    // Verify
    const verifyRes = await fetch(`${BASE}/sales.listSalesManagers`);
    const verifyJson = await verifyRes.json();
    const updated = verifyJson.result.data.json.find((m: any) => m.id === created.id);
    expect(updated.name).toBe("Updated Name");

    // Cleanup
    await fetch(`${BASE}/sales.deleteSalesManager`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { id: created.id } }),
    });
  });

  it("deleteSalesManager removes a manager", async () => {
    // Create
    await fetch(`${BASE}/sales.createSalesManager`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { name: "Delete Test" } }),
    });
    const listRes = await fetch(`${BASE}/sales.listSalesManagers`);
    const listJson = await listRes.json();
    const created = listJson.result.data.json.find((m: any) => m.name === "Delete Test");
    expect(created).toBeDefined();

    // Delete
    const delRes = await fetch(`${BASE}/sales.deleteSalesManager`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { id: created.id } }),
    });
    expect(delRes.ok).toBe(true);

    // Verify deleted
    const verifyRes = await fetch(`${BASE}/sales.listSalesManagers`);
    const verifyJson = await verifyRes.json();
    const deleted = verifyJson.result.data.json.find((m: any) => m.id === created.id);
    expect(deleted).toBeUndefined();
  });

  it("each manager has required fields", async () => {
    const res = await fetch(`${BASE}/sales.listSalesManagers`);
    const json = await res.json();
    const managers = json.result.data.json;
    for (const m of managers) {
      expect(m).toHaveProperty("id");
      expect(m).toHaveProperty("name");
      expect(m).toHaveProperty("active");
      expect(m).toHaveProperty("createdAt");
      expect(m).toHaveProperty("updatedAt");
      expect(typeof m.name).toBe("string");
      expect(typeof m.active).toBe("boolean");
    }
  });
});
