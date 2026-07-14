import { describe, it, expect } from "vitest";

const SERASA_LOGIN_URL = "https://apiksiconsultas.com.br/auth/login";

describe("Serasa API credentials", () => {
  it("should authenticate successfully with SERASA_API_LOGIN and SERASA_API_PASSWORD", async () => {
    const login = process.env.SERASA_API_LOGIN;
    const password = process.env.SERASA_API_PASSWORD;

    expect(login).toBeTruthy();
    expect(password).toBeTruthy();

    const response = await fetch(SERASA_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe("Autorizado");
    expect(data.token).toBeTruthy();
    expect(typeof data.token).toBe("string");
    expect(data.token.length).toBeGreaterThan(10);
  });
});
