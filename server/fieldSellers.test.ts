import { describe, it, expect } from "vitest";

/**
 * Tests for field sellers (vendedores de rua) CRUD endpoints
 */
describe("Field Sellers", () => {
  const BASE = "http://localhost:3000/api/trpc";

  it("listFieldSellers returns array with pre-seeded sellers for Juvenal", async () => {
    const res = await fetch(`${BASE}/sales.listFieldSellers`);
    expect(res.ok).toBe(true);
    const json = await res.json();
    const sellers = json.result.data.json;
    expect(Array.isArray(sellers)).toBe(true);
    expect(sellers.length).toBeGreaterThanOrEqual(5);
    const names = sellers.map((s: any) => s.name);
    expect(names).toContain("Clarindo");
    expect(names).toContain("Daniel");
    expect(names).toContain("Romera");
    expect(names).toContain("Luiz Matias");
    expect(names).toContain("Renato");
  });

  it("all pre-seeded sellers belong to Juvenal (managerId=1)", async () => {
    const res = await fetch(`${BASE}/sales.listFieldSellers`);
    const json = await res.json();
    const sellers = json.result.data.json;
    const juvenalSellers = sellers.filter((s: any) => s.managerId === 1);
    expect(juvenalSellers.length).toBeGreaterThanOrEqual(5);
    const names = juvenalSellers.map((s: any) => s.name);
    expect(names).toContain("Clarindo");
    expect(names).toContain("Daniel");
    expect(names).toContain("Romera");
    expect(names).toContain("Luiz Matias");
    expect(names).toContain("Renato");
  });

  it("createFieldSeller creates a new seller linked to a manager", async () => {
    // Get Jordão's ID (managerId=2)
    const res = await fetch(`${BASE}/sales.createFieldSeller`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { name: "Vendedor Teste", managerId: 2 } }),
    });
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.result.data.json.success).toBe(true);

    // Verify it was created
    const listRes = await fetch(`${BASE}/sales.listFieldSellers`);
    const listJson = await listRes.json();
    const sellers = listJson.result.data.json;
    const created = sellers.find((s: any) => s.name === "Vendedor Teste");
    expect(created).toBeDefined();
    expect(created.managerId).toBe(2);

    // Cleanup
    if (created) {
      await fetch(`${BASE}/sales.deleteFieldSeller`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { id: created.id } }),
      });
    }
  });

  it("updateFieldSeller updates name", async () => {
    // Create
    await fetch(`${BASE}/sales.createFieldSeller`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { name: "Update Seller Test", managerId: 1 } }),
    });
    const listRes = await fetch(`${BASE}/sales.listFieldSellers`);
    const listJson = await listRes.json();
    const created = listJson.result.data.json.find((s: any) => s.name === "Update Seller Test");
    expect(created).toBeDefined();

    // Update
    const updateRes = await fetch(`${BASE}/sales.updateFieldSeller`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { id: created.id, name: "Updated Seller" } }),
    });
    expect(updateRes.ok).toBe(true);

    // Verify
    const verifyRes = await fetch(`${BASE}/sales.listFieldSellers`);
    const verifyJson = await verifyRes.json();
    const updated = verifyJson.result.data.json.find((s: any) => s.id === created.id);
    expect(updated.name).toBe("Updated Seller");

    // Cleanup
    await fetch(`${BASE}/sales.deleteFieldSeller`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { id: created.id } }),
    });
  });

  it("deleteFieldSeller removes a seller", async () => {
    // Create
    await fetch(`${BASE}/sales.createFieldSeller`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { name: "Delete Seller Test", managerId: 1 } }),
    });
    const listRes = await fetch(`${BASE}/sales.listFieldSellers`);
    const listJson = await listRes.json();
    const created = listJson.result.data.json.find((s: any) => s.name === "Delete Seller Test");
    expect(created).toBeDefined();

    // Delete
    const delRes = await fetch(`${BASE}/sales.deleteFieldSeller`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { id: created.id } }),
    });
    expect(delRes.ok).toBe(true);

    // Verify deleted
    const verifyRes = await fetch(`${BASE}/sales.listFieldSellers`);
    const verifyJson = await verifyRes.json();
    const deleted = verifyJson.result.data.json.find((s: any) => s.id === created.id);
    expect(deleted).toBeUndefined();
  });

  it("each seller has required fields", async () => {
    const res = await fetch(`${BASE}/sales.listFieldSellers`);
    const json = await res.json();
    const sellers = json.result.data.json;
    for (const s of sellers) {
      expect(s).toHaveProperty("id");
      expect(s).toHaveProperty("name");
      expect(s).toHaveProperty("managerId");
      expect(s).toHaveProperty("active");
      expect(s).toHaveProperty("createdAt");
      expect(s).toHaveProperty("updatedAt");
      expect(typeof s.name).toBe("string");
      expect(typeof s.managerId).toBe("number");
      expect(typeof s.active).toBe("boolean");
    }
  });
});
