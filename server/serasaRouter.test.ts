import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000/api/trpc";

function buildQueryUrl(procedure: string, input: any): string {
  const encoded = encodeURIComponent(JSON.stringify({ json: input }));
  return `${BASE_URL}/${procedure}?input=${encoded}`;
}

describe("Serasa Router", () => {
  describe("checkAuthorization", () => {
    it("should authorize Fernando", async () => {
      const res = await fetch(buildQueryUrl("serasa.checkAuthorization", { operadorName: "Fernando" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.data.json.authorized).toBe(true);
    });

    it("should authorize Guilherme", async () => {
      const res = await fetch(buildQueryUrl("serasa.checkAuthorization", { operadorName: "Guilherme" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.data.json.authorized).toBe(true);
    });

    it("should authorize Bruno", async () => {
      const res = await fetch(buildQueryUrl("serasa.checkAuthorization", { operadorName: "Bruno" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.data.json.authorized).toBe(true);
    });

    it("should NOT authorize a random vendedor", async () => {
      const res = await fetch(buildQueryUrl("serasa.checkAuthorization", { operadorName: "Joao" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.data.json.authorized).toBe(false);
    });

    it("should NOT authorize Vitoria", async () => {
      const res = await fetch(buildQueryUrl("serasa.checkAuthorization", { operadorName: "Vitoria" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.data.json.authorized).toBe(false);
    });
  });

  describe("ultimaConsulta", () => {
    it("should return found=false for a document with no history", async () => {
      const res = await fetch(buildQueryUrl("serasa.ultimaConsulta", { documento: "00000000000000" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.data.json.found).toBe(false);
      expect(data.result.data.json.consulta).toBeNull();
    });
  });

  describe("metricas", () => {
    it("should return valid metrics structure for 30d period", async () => {
      const res = await fetch(buildQueryUrl("serasa.metricas", { periodo: "30d" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      const metricas = data.result.data.json;
      expect(metricas).toHaveProperty("porOperador");
      expect(metricas).toHaveProperty("totais");
      expect(metricas).toHaveProperty("ultimasConsultas");
      expect(Array.isArray(metricas.porOperador)).toBe(true);
      expect(Array.isArray(metricas.ultimasConsultas)).toBe(true);
    });

    it("should return valid metrics for all periods", async () => {
      for (const periodo of ["7d", "30d", "90d", "all"]) {
        const res = await fetch(buildQueryUrl("serasa.metricas", { periodo }));
        expect(res.status).toBe(200);
      }
    });
  });

  describe("consultar", () => {
    it("should reject unauthorized operator", async () => {
      const res = await fetch(`${BASE_URL}/serasa.consultar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: {
            documento: "36562762000129",
            tipoPessoa: "PJ",
            operadorName: "Joao",
            operadorPassword: "qualquer",
          },
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.data.json.success).toBe(false);
      expect(data.result.data.json.error).toContain("não autorizado");
    });

    it("should reject wrong password for authorized operator", async () => {
      const res = await fetch(`${BASE_URL}/serasa.consultar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: {
            documento: "36562762000129",
            tipoPessoa: "PJ",
            operadorName: "Fernando",
            operadorPassword: "senha_errada_123",
          },
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.data.json.success).toBe(false);
      expect(data.result.data.json.error).toContain("Senha incorreta");
    });
  });
});
