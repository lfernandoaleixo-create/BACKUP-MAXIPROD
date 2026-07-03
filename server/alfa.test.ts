import { describe, it, expect } from "vitest";
import { quoteAlfaFreight } from "./alfaApi";

describe("Alfa Transportes API", () => {
  it("should authenticate and return a quote with valid credentials", async () => {
    const apiKey = process.env.ALFA_API_KEY_1;
    if (!apiKey) {
      throw new Error("ALFA_API_KEY_1 not set");
    }

    const result = await quoteAlfaFreight({
      apiKey,
      cepDestino: "01002900", // São Paulo
      cepOrigem: "32010000", // Contagem/MG
      valorMercadoria: 1000,
      peso: 10,
      metroCubico: 0.05,
      volumes: 1,
      tipoPessoa: 1,
    });

    // status.numero = 1 means success
    expect(result.status.numero).toBe(1);
    expect(result.cotacao).toBeDefined();
    expect(result.cotacao!.emissao.valoresCotacao.valorTotal).toBeGreaterThan(0);
    console.log("Alfa Quote result:", JSON.stringify({
      total: result.cotacao!.emissao.valoresCotacao.valorTotal,
      prazo: result.cotacao!.emissao.diasEntrega,
      cidade: result.cotacao!.emissao.detinatario.cidadeDestinatario,
    }));
  }, 15000);
});
