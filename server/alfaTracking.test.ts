import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
vi.stubEnv("ALFA_API_KEY_1", "test-key-1");
vi.stubEnv("ALFA_API_KEY_2", "test-key-2");

describe("Alfa Tracking API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("trackAlfaFreight", () => {
    it("should call the Alfa tracking API with correct parameters", async () => {
      const { trackAlfaFreight } = await import("./alfaApi");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "TRACK001",
          status: { numero: 2, descricao: "RASTREAMENTO CONCLUIDO COM SUCESSO" },
          rastreamento: {
            dadosCte: {
              numeroCte: "12345",
              valorCte: 500.0,
              emissaoData: "2026-07-20",
              dataPrevista: "2026-07-25",
              nomeDestinatario: "CLIENTE TESTE",
              agenciaInicio: "SAO PAULO",
              agenciaFim: "CURITIBA",
              cidadeEntrega: "CURITIBA",
              notas: [{ numero: "1001", serie: "1", chave: "123456" }],
            },
            dadosEmbarque: [
              {
                cidadeOrigem: "SAO PAULO",
                cidadeDestino: "CURITIBA",
                codigoViagem: "V001",
                horaSaida: "2026-07-20 08:00",
                horaChegada: "2026-07-21 14:00",
              },
            ],
            dadosEntrega: {
              recebedorMercadoria: "JOAO SILVA",
              dataEntrega: "2026-07-21 14:30",
              urlComprovante: "https://alfa.com/comprovante/123",
            },
          },
        }),
      });

      const result = await trackAlfaFreight({
        apiKey: "test-key-1",
        merNF: "1001",
        tomCnpj: "36562762000129",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.alfatransportes.com.br/rastreamento/v1.3/",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idr: "test-key-1",
            merNF: "1001",
            modoJson: 1,
            tomCnpj: "36562762000129",
          }),
        })
      );

      expect(result.status.numero).toBe(2);
      expect(result.rastreamento?.dadosCte?.numeroCte).toBe("12345");
      expect(result.rastreamento?.dadosEntrega?.recebedorMercadoria).toBe("JOAO SILVA");
    });

    it("should throw on non-OK HTTP response", async () => {
      const { trackAlfaFreight } = await import("./alfaApi");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(
        trackAlfaFreight({ apiKey: "test-key-1", merNF: "1001" })
      ).rejects.toThrow("Alfa Tracking API error: 500 Internal Server Error");
    });
  });

  describe("trackAllAlfaCnpjs", () => {
    it("should return success when first key finds the NF", async () => {
      const { trackAllAlfaCnpjs } = await import("./alfaApi");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "TRACK001",
          status: { numero: 2, descricao: "RASTREAMENTO CONCLUIDO COM SUCESSO" },
          rastreamento: {
            dadosCte: { numeroCte: "99999" },
          },
        }),
      });

      const result = await trackAllAlfaCnpjs("5001");

      expect(result.success).toBe(true);
      expect(result.cnpjUsed).toBe("36562762000129");
      expect(result.data?.rastreamento?.dadosCte?.numeroCte).toBe("99999");
    });

    it("should try second key if first returns error status", async () => {
      const { trackAllAlfaCnpjs } = await import("./alfaApi");

      // First key: NF not found
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "TRACK001",
          status: { numero: 9, descricao: "NOTA FISCAL NAO ENCONTRADA NESTE CNPJ" },
        }),
      });

      // Second key: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "TRACK002",
          status: { numero: 2, descricao: "RASTREAMENTO CONCLUIDO COM SUCESSO" },
          rastreamento: {
            dadosCte: { numeroCte: "88888" },
          },
        }),
      });

      const result = await trackAllAlfaCnpjs("5002");

      expect(result.success).toBe(true);
      expect(result.cnpjUsed).toBe("50128808000127");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should return errors when all keys fail", async () => {
      const { trackAllAlfaCnpjs } = await import("./alfaApi");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "TRACK001",
          status: { numero: 9, descricao: "NOTA FISCAL NAO ENCONTRADA NESTE CNPJ" },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "TRACK002",
          status: { numero: 9, descricao: "NOTA FISCAL NAO ENCONTRADA NESTE CNPJ" },
        }),
      });

      const result = await trackAllAlfaCnpjs("9999");

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors?.[0].cnpj).toBe("36562762000129");
      expect(result.errors?.[1].cnpj).toBe("50128808000127");
    });

    it("should return in-transit status (numero=1) as success", async () => {
      const { trackAllAlfaCnpjs } = await import("./alfaApi");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "TRACK001",
          status: { numero: 1, descricao: "RASTREAMENTO NAO CONCLUIDO" },
          rastreamento: {
            dadosCte: { numeroCte: "77777" },
            dadosEmbarque: [
              { cidadeOrigem: "SAO PAULO", cidadeDestino: "CURITIBA", codigoViagem: "V1", horaSaida: "2026-07-22 08:00", horaChegada: "" },
            ],
          },
        }),
      });

      const result = await trackAllAlfaCnpjs("7777");

      expect(result.success).toBe(true);
      expect(result.data?.status.numero).toBe(1);
      expect(result.data?.rastreamento?.dadosEmbarque?.[0].cidadeOrigem).toBe("SAO PAULO");
    });
  });
});
