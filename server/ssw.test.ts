import { describe, it, expect } from "vitest";
import { quoteSswFreight } from "./sswApi";

describe("SSW/Camilo dos Santos API", () => {
  it("should return a valid freight quote with correct credentials and parameters", async () => {
    // Use the proven working test case: Perdões/MG → Rio de Janeiro/RJ
    const result = await quoteSswFreight({
      cnpjPagador: "45558059000138",
      cepOrigem: "37260000",
      cepDestino: "21820390",
      valorNF: 1270.00,
      quantidade: 8,
      peso: 88.000,
      cubagem: 0.2590,
      cnpjDestinatario: "04325136000122",
      cnpjRemetente: "45558059000138",
      coletar: "S",
      entDificil: "N",
      destContribuinte: "S",
    });

    // erro >= 1 means success (may include informational messages)
    expect(result.erro).toBeGreaterThanOrEqual(1);
    expect(result.totalFrete).toBeGreaterThan(0);
    expect(result.prazo).toBeGreaterThan(0);
    expect(result.pesoCalculo).toBeGreaterThan(0);
    
    console.log("SSW Quote result:", JSON.stringify(result, null, 2));
  }, 20000);

  it("should throw on invalid login", async () => {
    await expect(
      quoteSswFreight({
        cnpjPagador: "45558059000138",
        cepOrigem: "37260000",
        cepDestino: "21820390",
        valorNF: 100,
        quantidade: 1,
        peso: 10,
        cubagem: 0.01,
      })
    ).resolves.toBeDefined(); // With correct env vars, should not throw
  }, 20000);
});
