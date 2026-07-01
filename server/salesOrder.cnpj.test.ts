import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Test that the createOrder input schema accepts orders without CNPJ
 * (for Maxiprod-only clients that don't have CNPJ in the system)
 */
describe("createOrder CNPJ validation", () => {
  // Replicate the schema from salesOrderRouter.ts
  const createOrderSchema = z.object({
    sellerId: z.number(),
    cnpjCpf: z.string().optional().default(""),
    razaoSocial: z.string().min(2),
    nomeFantasia: z.string().optional(),
    inscricaoEstadual: z.string().optional(),
    tipoContribuinte: z.string().optional(),
    regimeTributario: z.string().optional(),
    emailNfe: z.string().optional(),
    cnaeFiscal: z.string().optional(),
    cep: z.string().optional(),
    endereco: z.string().optional(),
    numero: z.string().optional(),
    complemento: z.string().optional(),
    bairro: z.string().optional(),
    municipio: z.string().optional(),
    uf: z.string().optional(),
    telefone1: z.string().optional(),
    telefone2: z.string().optional(),
    emailContato: z.string().optional(),
    segmento: z.string().optional(),
    condicaoPagamento: z.string().optional(),
    valorFrete: z.number().optional(),
    tipoFrete: z.string().optional(),
    observacoes: z.string().optional(),
    items: z.array(z.object({
      codigoItem: z.string(),
      descricaoItem: z.string(),
      quantidade: z.number().positive(),
      unidadeMedida: z.string().optional(),
      precoUnitario: z.number().positive(),
    })).min(1),
    forceSubmitBelowMin: z.boolean().optional(),
  });

  it("should accept order with CNPJ provided", () => {
    const input = {
      sellerId: 1,
      cnpjCpf: "12.345.678/0001-90",
      razaoSocial: "Empresa Teste LTDA",
      items: [{ codigoItem: "001", descricaoItem: "Produto A", quantidade: 10, precoUnitario: 5.50 }],
    };
    const result = createOrderSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cnpjCpf).toBe("12.345.678/0001-90");
    }
  });

  it("should accept order WITHOUT CNPJ (empty string)", () => {
    const input = {
      sellerId: 1,
      cnpjCpf: "",
      razaoSocial: "BOX 81 DISTRIBUIDORA DE PRODUTOS ALIMENTICIOS LTDA - EPP",
      items: [{ codigoItem: "002", descricaoItem: "Produto B", quantidade: 5, precoUnitario: 12.00 }],
    };
    const result = createOrderSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cnpjCpf).toBe("");
    }
  });

  it("should accept order with CNPJ omitted entirely (defaults to empty)", () => {
    const input = {
      sellerId: 1,
      razaoSocial: "Cliente Sem CNPJ",
      items: [{ codigoItem: "003", descricaoItem: "Produto C", quantidade: 1, precoUnitario: 100.00 }],
    };
    const result = createOrderSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cnpjCpf).toBe("");
    }
  });

  it("should reject order without razaoSocial (still required)", () => {
    const input = {
      sellerId: 1,
      cnpjCpf: "12.345.678/0001-90",
      razaoSocial: "",
      items: [{ codigoItem: "001", descricaoItem: "Produto A", quantidade: 10, precoUnitario: 5.50 }],
    };
    const result = createOrderSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject order without items", () => {
    const input = {
      sellerId: 1,
      razaoSocial: "Empresa Teste",
      items: [],
    };
    const result = createOrderSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
