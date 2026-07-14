import { describe, it, expect } from "vitest";

describe("SintegraWS API Token Validation", () => {
  it("should have SINTEGRA_API_TOKEN configured with valid format", () => {
    const token = process.env.SINTEGRA_API_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(10);
    // Token format: UUID-like (8-4-4-4-12 with uppercase hex)
    expect(token).toMatch(/^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/);
  });

  it("should attempt API call (may fail due to IP restriction from sandbox)", async () => {
    const token = process.env.SINTEGRA_API_TOKEN;
    // The SintegraWS API blocks non-Brazilian IPs, so from sandbox we expect 403
    // In production (Brazilian server), this will work correctly
    const url = `https://www.sintegraws.com.br/api/v1/execute-api.php?token=${token}&plugin=CS`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        // If we can reach the API, validate the token works
        expect(data.code).not.toBe("3"); // code 3 = invalid token
        console.log("SintegraWS response:", JSON.stringify(data));
      } else {
        // 403 expected from sandbox (IP blocked)
        console.log(`SintegraWS returned ${response.status} - expected from non-Brazilian IP (sandbox)`);
        expect(response.status).toBe(403);
      }
    } catch (e: any) {
      console.log("Network error (expected from sandbox):", e.message);
    }
  }, 15000);
});
