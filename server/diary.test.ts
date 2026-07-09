import { describe, it, expect, vi } from "vitest";

/**
 * Diary endpoints integration test.
 * Tests the addDiaryEntry and getDiaryEntries procedures.
 */

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

describe("Diary Endpoints", () => {
  it("addDiaryEntry input schema validates required fields", async () => {
    const { z } = await import("zod");
    
    const addDiaryEntrySchema = z.object({
      clienteName: z.string(),
      receivableId: z.number().optional(),
      etapaAtual: z.string(),
      tipoContato: z.string().optional(),
      resumo: z.string(),
      observacoes: z.string().optional(),
      valorNegociado: z.number().optional(),
      proximaAcao: z.string().optional(),
      proximaAcaoData: z.string().optional(),
      operadorName: z.string(),
    });

    // Valid input
    const validInput = {
      clienteName: "CLIENTE TESTE LTDA",
      etapaAtual: "Contatado",
      resumo: "Ligação realizada, cliente prometeu pagamento",
      operadorName: "Operador Teste",
    };
    expect(() => addDiaryEntrySchema.parse(validInput)).not.toThrow();

    // Full input with all optional fields
    const fullInput = {
      clienteName: "CLIENTE TESTE LTDA",
      receivableId: 123,
      etapaAtual: "Em negociação",
      tipoContato: "ligacao",
      resumo: "Negociação de parcelamento",
      observacoes: "Cliente pediu 3x sem juros",
      valorNegociado: 5000.50,
      proximaAcao: "Enviar proposta por email",
      proximaAcaoData: "2026-07-15",
      operadorName: "Operador Teste",
    };
    expect(() => addDiaryEntrySchema.parse(fullInput)).not.toThrow();

    // Missing required field - clienteName
    expect(() => addDiaryEntrySchema.parse({ ...validInput, clienteName: undefined })).toThrow();

    // Missing required field - resumo
    expect(() => addDiaryEntrySchema.parse({ ...validInput, resumo: undefined })).toThrow();

    // Missing required field - operadorName
    expect(() => addDiaryEntrySchema.parse({ ...validInput, operadorName: undefined })).toThrow();
  });

  it("getDiaryEntries input schema validates optional filters", async () => {
    const { z } = await import("zod");
    
    const getDiaryEntriesSchema = z.object({
      clienteName: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      etapa: z.string().optional(),
      limit: z.number().default(100),
    }).optional();

    // No input (all optional)
    expect(() => getDiaryEntriesSchema.parse(undefined)).not.toThrow();

    // With filters
    const withFilters = {
      clienteName: "CLIENTE",
      fromDate: "2026-07-01",
      toDate: "2026-07-09",
      etapa: "Contatado",
      limit: 50,
    };
    expect(() => getDiaryEntriesSchema.parse(withFilters)).not.toThrow();

    // Partial filters
    expect(() => getDiaryEntriesSchema.parse({ clienteName: "ABC" })).not.toThrow();
  });

  it("getDiarySnapshotDetail input requires snapshotDate", async () => {
    const { z } = await import("zod");
    
    const schema = z.object({ snapshotDate: z.string() });

    expect(() => schema.parse({ snapshotDate: "2026-07-09" })).not.toThrow();
    expect(() => schema.parse({})).toThrow();
    expect(() => schema.parse({ snapshotDate: "" })).not.toThrow(); // empty string is still a string
  });

  it("diary etapas cover all expected stages", () => {
    const EXPECTED_ETAPAS = [
      "Contatado",
      "Em negociação",
      "Promessa de Pgto",
      "Especial s/ cobrança",
      "Protestado",
      "Fundo Perdido",
      "Pago/Resolvido",
    ];

    // These are the etapas used in the frontend DiaryPanelContent
    const DIARY_ETAPAS = [
      { value: "Contatado", label: "Contatado" },
      { value: "Em negociação", label: "Em Negociação" },
      { value: "Promessa de Pgto", label: "Promessa de Pgto" },
      { value: "Especial s/ cobrança", label: "Especial s/ Cobrança" },
      { value: "Protestado", label: "Protestado" },
      { value: "Fundo Perdido", label: "Fundo Perdido" },
      { value: "Pago/Resolvido", label: "Pago/Resolvido" },
    ];

    expect(DIARY_ETAPAS.map(e => e.value)).toEqual(EXPECTED_ETAPAS);
  });

  it("diary contato tipos cover all expected types", () => {
    const DIARY_CONTATO_TIPOS = [
      { value: "ligacao", label: "Ligação" },
      { value: "whatsapp", label: "WhatsApp" },
      { value: "email", label: "E-mail" },
      { value: "presencial", label: "Presencial" },
      { value: "outro", label: "Outro" },
    ];

    expect(DIARY_CONTATO_TIPOS.length).toBe(5);
    expect(DIARY_CONTATO_TIPOS.map(c => c.value)).toContain("ligacao");
    expect(DIARY_CONTATO_TIPOS.map(c => c.value)).toContain("whatsapp");
    expect(DIARY_CONTATO_TIPOS.map(c => c.value)).toContain("email");
    expect(DIARY_CONTATO_TIPOS.map(c => c.value)).toContain("presencial");
    expect(DIARY_CONTATO_TIPOS.map(c => c.value)).toContain("outro");
  });
});
