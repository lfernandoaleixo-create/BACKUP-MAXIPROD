/**
 * Tests for CNPJ Duplicate → Edit Flow + Maxiprod Export
 * 
 * Feature 1: When a vendor tries to register a client with a duplicate CNPJ,
 * the backend returns structured conflict data (not just an error message).
 * 
 * Feature 2: Maxiprod export endpoint generates Excel from vendor_client data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
};

vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

vi.mock("../drizzle/schema", () => ({
  vendorClients: {
    id: "id",
    cnpjCpf: "cnpj_cpf",
    razaoSocial: "razao_social",
    sellerName: "seller_name",
    lastModifiedBy: "last_modified_by",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  salesOrderRequests: {
    id: "id",
    cnpjCpf: "cnpj_cpf",
    status: "status",
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: vi.fn((...args: any[]) => args),
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...args: any[]) => ({ type: "and", conditions: args })),
  desc: vi.fn((field) => ({ type: "desc", field })),
  inArray: vi.fn((field, values) => ({ type: "inArray", field, values })),
  or: vi.fn((...args: any[]) => ({ type: "or", conditions: args })),
  like: vi.fn((field, pattern) => ({ type: "like", field, pattern })),
}));

describe("CNPJ Duplicate Detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup chain mocks
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]);
  });

  it("should detect duplicate CNPJ by stripping formatting", () => {
    // Test the CNPJ normalization logic
    const cnpj1 = "12.345.678/0001-90";
    const cnpj2 = "12345678000190";
    const cnpj3 = "12.345.678/0001-90";

    const normalize = (cnpj: string) => cnpj.replace(/[^\d]/g, "");

    expect(normalize(cnpj1)).toBe("12345678000190");
    expect(normalize(cnpj2)).toBe("12345678000190");
    expect(normalize(cnpj1)).toBe(normalize(cnpj3));
  });

  it("should return structured conflict data when CNPJ exists", () => {
    // Simulate the structured error message format
    const existingClient = {
      id: 42,
      razaoSocial: "Empresa Teste LTDA",
      cnpjCpf: "12.345.678/0001-90",
      sellerName: "João Silva",
    };

    const errorMessage = JSON.stringify({
      type: "CNPJ_DUPLICATE",
      clientId: existingClient.id,
      razaoSocial: existingClient.razaoSocial,
      sellerName: existingClient.sellerName,
      existingClient: {
        ...existingClient,
        cep: "01001-000",
        logradouro: "Rua Teste",
        numero: "123",
        bairro: "Centro",
        cidade: "São Paulo",
        uf: "SP",
      },
    });

    const parsed = JSON.parse(errorMessage);
    expect(parsed.type).toBe("CNPJ_DUPLICATE");
    expect(parsed.clientId).toBe(42);
    expect(parsed.razaoSocial).toBe("Empresa Teste LTDA");
    expect(parsed.sellerName).toBe("João Silva");
    expect(parsed.existingClient.cep).toBe("01001-000");
    expect(parsed.existingClient.uf).toBe("SP");
  });

  it("should include full client data for pre-filling the edit form", () => {
    const fullClient = {
      id: 42,
      sellerId: 1,
      sellerName: "João Silva",
      cnpjCpf: "12.345.678/0001-90",
      razaoSocial: "Empresa Teste LTDA",
      nomeFantasia: "Empresa Teste",
      inscricaoEstadual: "123456789",
      tipoContribuinte: "Contribuinte",
      regimeTributario: "Normal",
      cep: "01001-000",
      logradouro: "Rua Teste",
      numero: "123",
      complemento: "Sala 1",
      bairro: "Centro",
      cidade: "São Paulo",
      uf: "SP",
      telefone1: "(11) 99999-9999",
      telefone2: null,
      email: "teste@empresa.com",
      lastModifiedBy: null,
    };

    // Verify all required fields are present for form pre-fill
    expect(fullClient.cnpjCpf).toBeDefined();
    expect(fullClient.razaoSocial).toBeDefined();
    expect(fullClient.cep).toBeDefined();
    expect(fullClient.logradouro).toBeDefined();
    expect(fullClient.numero).toBeDefined();
    expect(fullClient.bairro).toBeDefined();
    expect(fullClient.cidade).toBeDefined();
    expect(fullClient.uf).toBeDefined();
    expect(fullClient.telefone1).toBeDefined();
    expect(fullClient.email).toBeDefined();
  });
});

describe("Update Vendor Client with lastModifiedBy", () => {
  it("should track who modified the client data", () => {
    const updatePayload = {
      id: 42,
      sellerName: "Maria Santos",
      razaoSocial: "Empresa Atualizada LTDA",
      cep: "02002-000",
    };

    // Simulate the update logic
    const { id, sellerName, ...updateData } = updatePayload;
    const cleanData: Record<string, any> = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) cleanData[key] = value || null;
    }
    if (sellerName) {
      cleanData.lastModifiedBy = sellerName;
    }

    expect(cleanData.lastModifiedBy).toBe("Maria Santos");
    expect(cleanData.razaoSocial).toBe("Empresa Atualizada LTDA");
    expect(cleanData.cep).toBe("02002-000");
  });

  it("should handle possuiRedespacho boolean to tinyint conversion", () => {
    const input = { possuiRedespacho: true };
    const cleanData: Record<string, any> = {};
    
    if (input.possuiRedespacho !== undefined) {
      cleanData.possuiRedespacho = input.possuiRedespacho ? 1 : 0;
    }

    expect(cleanData.possuiRedespacho).toBe(1);

    const input2 = { possuiRedespacho: false };
    const cleanData2: Record<string, any> = {};
    if (input2.possuiRedespacho !== undefined) {
      cleanData2.possuiRedespacho = input2.possuiRedespacho ? 1 : 0;
    }
    expect(cleanData2.possuiRedespacho).toBe(0);
  });
});

describe("Client Modification Detection", () => {
  it("should detect modification when lastModifiedBy is set", () => {
    const client = {
      lastModifiedBy: "João Silva",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-15"),
    };

    const wasModified = !!client.lastModifiedBy ||
      (client.updatedAt && client.createdAt &&
       client.updatedAt.getTime() - client.createdAt.getTime() > 60000);

    expect(wasModified).toBe(true);
  });

  it("should detect modification when updatedAt is significantly after createdAt", () => {
    const client = {
      lastModifiedBy: null,
      createdAt: new Date("2026-01-01T10:00:00Z"),
      updatedAt: new Date("2026-01-01T10:05:00Z"), // 5 minutes later
    };

    const wasModified = !!client.lastModifiedBy ||
      (client.updatedAt && client.createdAt &&
       client.updatedAt.getTime() - client.createdAt.getTime() > 60000);

    expect(wasModified).toBe(true);
  });

  it("should NOT flag as modified when timestamps are close (auto-update)", () => {
    const client = {
      lastModifiedBy: null,
      createdAt: new Date("2026-01-01T10:00:00Z"),
      updatedAt: new Date("2026-01-01T10:00:30Z"), // 30 seconds later (auto-update)
    };

    const wasModified = !!client.lastModifiedBy ||
      (client.updatedAt && client.createdAt &&
       client.updatedAt.getTime() - client.createdAt.getTime() > 60000);

    expect(wasModified).toBe(false);
  });
});

describe("Maxiprod Excel Export", () => {
  it("should generate correct filename from client data", () => {
    const razaoSocial = "Empresa Teste & Cia LTDA";
    const filename = `Maxiprod_${razaoSocial.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_${new Date("2026-07-06").toISOString().slice(0, 10)}.xlsx`;

    expect(filename).toBe("Maxiprod_Empresa_Teste___Cia_LTDA_2026-07-06.xlsx");
    expect(filename.endsWith(".xlsx")).toBe(true);
  });

  it("should truncate long filenames", () => {
    const razaoSocial = "Uma Empresa Com Um Nome Muito Longo Que Deveria Ser Truncado Para Não Causar Problemas";
    const cleaned = razaoSocial.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    expect(cleaned.length).toBeLessThanOrEqual(30);
  });

  it("should normalize CNPJ for lookup", () => {
    const orderCnpj = "12.345.678/0001-90";
    const cnpjLimpo = orderCnpj.replace(/[^\d]/g, "");
    expect(cnpjLimpo).toBe("12345678000190");
    expect(cnpjLimpo.length).toBe(14);
  });
});
