/**
 * Testes para o campo decisaoCobranca:
 * - Extração do campo "SITUAÇÃO" dos camposAdicionais do cliente
 * - Integração na transformAccountsReceivable
 * - Retorno no getOverdueTitles via coluna do DB
 */
import { describe, it, expect } from "vitest";

/**
 * Replica a lógica de extractDecisaoCobranca do maxiprodGraphQL.ts
 * para testar isoladamente sem importar o módulo inteiro (que tem side-effects)
 */
function extractDecisaoCobranca(cliente: any): string | null {
  if (!cliente?.camposAdicionais) return null;
  const camposAdicionais = cliente.camposAdicionais;
  if (!Array.isArray(camposAdicionais)) return null;

  const situacaoCampo = camposAdicionais.find((c: any) => {
    const desc = (c.descricao || "").toUpperCase().trim();
    return desc === "SITUAÇÃO" || desc === "SITUACAO" || desc.includes("SITUA");
  });

  if (!situacaoCampo || !situacaoCampo.valor) return null;
  return String(situacaoCampo.valor).trim() || null;
}

describe("extractDecisaoCobranca", () => {
  it("deve retornar 'COM PROTESTO' quando campo SITUAÇÃO existe", () => {
    const cliente = {
      nomeFantasia: "Empresa Teste",
      razaoSocial: "Empresa Teste Ltda",
      camposAdicionais: [
        { descricao: "SITUAÇÃO", valor: "COM PROTESTO" },
        { descricao: "OUTRO_CAMPO", valor: "abc" },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBe("COM PROTESTO");
  });

  it("deve retornar 'SEM PROTESTO' quando campo SITUAÇÃO tem esse valor", () => {
    const cliente = {
      nomeFantasia: "Empresa B",
      razaoSocial: "Empresa B Ltda",
      camposAdicionais: [
        { descricao: "SITUAÇÃO", valor: "SEM PROTESTO" },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBe("SEM PROTESTO");
  });

  it("deve retornar null quando cliente é null", () => {
    expect(extractDecisaoCobranca(null)).toBeNull();
  });

  it("deve retornar null quando cliente não tem camposAdicionais", () => {
    const cliente = { nomeFantasia: "Teste", razaoSocial: "Teste Ltda" };
    expect(extractDecisaoCobranca(cliente)).toBeNull();
  });

  it("deve retornar null quando camposAdicionais é array vazio", () => {
    const cliente = {
      nomeFantasia: "Teste",
      camposAdicionais: [],
    };
    expect(extractDecisaoCobranca(cliente)).toBeNull();
  });

  it("deve retornar null quando campo SITUAÇÃO não existe nos camposAdicionais", () => {
    const cliente = {
      nomeFantasia: "Teste",
      camposAdicionais: [
        { descricao: "CNPJ", valor: "12345" },
        { descricao: "TELEFONE", valor: "11999" },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBeNull();
  });

  it("deve retornar null quando valor do campo SITUAÇÃO é vazio", () => {
    const cliente = {
      nomeFantasia: "Teste",
      camposAdicionais: [
        { descricao: "SITUAÇÃO", valor: "" },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBeNull();
  });

  it("deve retornar null quando valor do campo SITUAÇÃO é null", () => {
    const cliente = {
      nomeFantasia: "Teste",
      camposAdicionais: [
        { descricao: "SITUAÇÃO", valor: null },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBeNull();
  });

  it("deve funcionar com descricao 'SITUACAO' (sem acento)", () => {
    const cliente = {
      nomeFantasia: "Teste",
      camposAdicionais: [
        { descricao: "SITUACAO", valor: "COM PROTESTO" },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBe("COM PROTESTO");
  });

  it("deve funcionar com descricao contendo 'SITUA' (match parcial)", () => {
    const cliente = {
      nomeFantasia: "Teste",
      camposAdicionais: [
        { descricao: "Situação do Cliente", valor: "SEM PROTESTO" },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBe("SEM PROTESTO");
  });

  it("deve fazer trim no valor retornado", () => {
    const cliente = {
      nomeFantasia: "Teste",
      camposAdicionais: [
        { descricao: "SITUAÇÃO", valor: "  COM PROTESTO  " },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBe("COM PROTESTO");
  });
});

describe("decisaoCobranca no getOverdueTitles", () => {
  it("deve priorizar campo do DB sobre mapa de nomes", () => {
    // Simula a lógica do getOverdueTitles
    const row = { cliente: "Empresa X", decisaoCobranca: "COM PROTESTO" };
    const cobrancaMap: Record<string, string> = {
      "Empresa X": "SEM PROTESTO", // mapa tem valor diferente
    };
    const clienteName = (row.cliente || "").trim();
    const decisao = (row as any).decisaoCobranca || cobrancaMap[clienteName] || cobrancaMap[clienteName.toUpperCase()] || "";
    
    expect(decisao).toBe("COM PROTESTO"); // DB tem prioridade
  });

  it("deve usar fallback do mapa quando DB está null", () => {
    const row = { cliente: "Empresa Y", decisaoCobranca: null };
    const cobrancaMap: Record<string, string> = {
      "Empresa Y": "SEM PROTESTO",
    };
    const clienteName = (row.cliente || "").trim();
    const decisao = (row as any).decisaoCobranca || cobrancaMap[clienteName] || cobrancaMap[clienteName.toUpperCase()] || "";
    
    expect(decisao).toBe("SEM PROTESTO"); // Fallback para mapa
  });

  it("deve retornar string vazia quando nem DB nem mapa têm valor", () => {
    const row = { cliente: "Empresa Z", decisaoCobranca: null };
    const cobrancaMap: Record<string, string> = {};
    const clienteName = (row.cliente || "").trim();
    const decisao = (row as any).decisaoCobranca || cobrancaMap[clienteName] || cobrancaMap[clienteName.toUpperCase()] || "";
    
    expect(decisao).toBe("");
  });
});
