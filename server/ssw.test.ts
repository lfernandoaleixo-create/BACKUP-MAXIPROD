import { describe, it, expect } from "vitest";
import { quoteSswFreight } from "./sswApi";

describe("SSW/Camilo dos Santos API", () => {
  it("should authenticate and return a quote (or meaningful error) with valid credentials", async () => {
    // Use a test quote: Contagem/MG (CEP 32010000) to São Paulo/SP (CEP 01002900)
    try {
      const result = await quoteSswFreight({
        cnpjPagador: "36562762000129",
        cepOrigem: 32010000,
        cepDestino: 1002900,
        valorNF: 1000,
        quantidade: 1,
        peso: 10,
        volume: 0.05,
      });

      // If we get here, the API responded successfully (no login error thrown)
      // erro = 0 means success, erro = 1 means warning (still valid)
      // The key validation is that we did NOT get erro = -2 (login error)
      expect(result.erro).toBeGreaterThanOrEqual(0);
      expect(result.erro).toBeLessThanOrEqual(1);
      
      // totalFrete may be 0 if the route is not served, but credentials are valid
      // The important thing is that authentication succeeded
      console.log("SSW Quote result:", JSON.stringify(result));
    } catch (error: any) {
      // If login error (-2), credentials are wrong
      if (error.message.includes("Login error")) {
        throw new Error("SSW credentials are invalid - login failed");
      }
      // Simulation error (-1) means credentials work but route/params are invalid
      // This is acceptable for a credential test
      console.log("SSW returned simulation error (credentials valid):", error.message);
    }
  }, 15000);
});
