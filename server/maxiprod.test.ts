import { describe, expect, it } from "vitest";

describe("Maxiprod credentials", () => {
  it("should have MAXIPROD_EMAIL configured", () => {
    const email = process.env.MAXIPROD_EMAIL;
    expect(email).toBeDefined();
    expect(email).not.toBe("");
    expect(email).toContain("@");
  });

  it("should have MAXIPROD_PASSWORD configured", () => {
    const password = process.env.MAXIPROD_PASSWORD;
    expect(password).toBeDefined();
    expect(password).not.toBe("");
    expect(password!.length).toBeGreaterThan(5);
  });

  it("should be able to reach Maxiprod login page", async () => {
    const response = await fetch("https://app.maxiprod.com.br/", {
      method: "GET",
      redirect: "follow",
    });
    expect(response.status).toBe(200);
  }, 15000);
});
