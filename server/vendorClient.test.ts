import { describe, it, expect } from "vitest";
import { z } from "zod";

// Test the input schema validation for createVendorClient
const createVendorClientSchema = z.object({
  sellerId: z.number(),
  sellerName: z.string(),
  cnpjCpf: z.string().max(20),
  razaoSocial: z.string().max(300),
  nomeFantasia: z.string().max(300).optional(),
  inscricaoEstadual: z.string().max(30).optional(),
  cep: z.string().max(10).optional(),
  logradouro: z.string().max(300).optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(200).optional(),
  bairro: z.string().max(200).optional(),
  cidade: z.string().max(200).optional(),
  uf: z.string().max(2).optional(),
  telefone1: z.string().max(30).optional(),
  telefone2: z.string().max(30).optional(),
  email: z.string().max(300).optional(),
  nomeContato: z.string().max(200).optional(),
  segmento: z.string().max(100).optional(),
  observacoes: z.string().optional(),
  tipoContribuinte: z.string().max(30).optional(),
  // Dados fiscais
  regimeTributario: z.string().max(50).optional(),
  inscricaoMunicipal: z.string().max(30).optional(),
  inscricaoSuframa: z.string().max(30).optional(),
  situacaoFiscalEspecial: z.string().max(100).optional(),
  cnaeFiscal: z.string().max(20).optional(),
  emailNfe: z.string().max(300).optional(),
  website: z.string().max(300).optional(),
  // Dados de venda
  limiteCredito: z.string().max(30).optional(),
  formaCobranca: z.string().max(200).optional(),
  tabelaPrecos: z.string().max(200).optional(),
  condicaoPagamento: z.string().max(200).optional(),
  // CRM
  regiao: z.string().max(100).optional(),
  perfil: z.string().max(100).optional(),
  formaPedido: z.string().max(100).optional(),
  produtos: z.string().optional(),
  probabilidadeNegocio: z.string().max(50).optional(),
  tamanho: z.string().max(50).optional(),
  atencao: z.string().max(50).optional(),
  fornecedorAtual: z.string().max(200).optional(),
  // Cobrança
  situacaoCobranca: z.string().max(30).optional(),
});

describe("createVendorClient schema validation", () => {
  it("should accept minimal required fields", () => {
    const input = {
      sellerId: 1,
      sellerName: "Jordão",
      cnpjCpf: "63.286.962/0001-79",
      razaoSocial: "GMR DISTRIBUIDORA LTDA",
    };
    const result = createVendorClientSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept all expanded fields", () => {
    const input = {
      sellerId: 1,
      sellerName: "Jordão",
      cnpjCpf: "63.286.962/0001-79",
      razaoSocial: "GMR DISTRIBUIDORA LTDA",
      nomeFantasia: "GMR",
      inscricaoEstadual: "9118165559",
      tipoContribuinte: "Contribuinte",
      regimeTributario: "Normal",
      inscricaoMunicipal: "12345",
      inscricaoSuframa: "",
      situacaoFiscalEspecial: "Isento",
      cnaeFiscal: "8122200",
      emailNfe: "nfe@gmr.com.br",
      website: "www.gmr.com.br",
      limiteCredito: "999999.99",
      formaCobranca: "Boleto (com registro)",
      tabelaPrecos: "Tabela Padrão",
      condicaoPagamento: "30/60/90 dias",
      regiao: "Sul",
      perfil: "A",
      formaPedido: "WhatsApp",
      produtos: "Dedetização, Controle de pragas",
      probabilidadeNegocio: "Alta",
      tamanho: "Grande",
      atencao: "VIP",
      fornecedorAtual: "Concorrente X",
      situacaoCobranca: "SEM PROTESTO",
      cep: "85.825-000",
      logradouro: "Rua Principal",
      numero: "44",
      complemento: "SL FRENTE",
      bairro: "MALUCELLI",
      cidade: "GUARAPUAVA",
      uf: "PR",
      telefone1: "4598192933",
      telefone2: "000000000000",
      email: "contato@gmr.com.br",
      nomeContato: "João",
      segmento: "DISTRIBUIDORA",
      observacoes: "Cliente prioritário",
    };
    const result = createVendorClientSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should reject invalid tipoContribuinte (too long)", () => {
    const input = {
      sellerId: 1,
      sellerName: "Jordão",
      cnpjCpf: "63.286.962/0001-79",
      razaoSocial: "GMR DISTRIBUIDORA LTDA",
      tipoContribuinte: "A".repeat(31),
    };
    const result = createVendorClientSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject invalid regimeTributario (too long)", () => {
    const input = {
      sellerId: 1,
      sellerName: "Jordão",
      cnpjCpf: "63.286.962/0001-79",
      razaoSocial: "GMR DISTRIBUIDORA LTDA",
      regimeTributario: "A".repeat(51),
    };
    const result = createVendorClientSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should accept situacaoCobranca with valid values", () => {
    const validValues = ["COM PROTESTO", "SEM PROTESTO", ""];
    for (const val of validValues) {
      const input = {
        sellerId: 1,
        sellerName: "Jordão",
        cnpjCpf: "63.286.962/0001-79",
        razaoSocial: "GMR DISTRIBUIDORA LTDA",
        situacaoCobranca: val,
      };
      const result = createVendorClientSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });
});
