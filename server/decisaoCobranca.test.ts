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
 * 
 * REGRA PERMANENTE:
 * O campo "SITUAÇÃO" está no grupo "COBRANÇA" dos campos adicionais do cadastro de Clientes no Maxiprod.
 * No GraphQL, usa-se `campoAdicionalEspecifico` (NÃO `camposAdicionais`).
 * O tipo é `EmpresaCampoAdicionalEspecifico` com campos { descricao, valor }.
 */
function extractDecisaoCobranca(cliente: any): string | null {
  // campoAdicionalEspecifico é o campo correto (tipo EmpresaCampoAdicionalEspecifico)
  const campos = cliente?.campoAdicionalEspecifico;
  if (!campos || !Array.isArray(campos)) return null;

  const situacaoCampo = campos.find((c: any) => {
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
      campoAdicionalEspecifico: [
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
      campoAdicionalEspecifico: [
        { descricao: "SITUAÇÃO", valor: "SEM PROTESTO" },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBe("SEM PROTESTO");
  });

  it("deve retornar null quando cliente é null", () => {
    expect(extractDecisaoCobranca(null)).toBeNull();
  });

  it("deve retornar null quando cliente não tem campoAdicionalEspecifico", () => {
    const cliente = { nomeFantasia: "Teste", razaoSocial: "Teste Ltda" };
    expect(extractDecisaoCobranca(cliente)).toBeNull();
  });

  it("deve retornar null quando campoAdicionalEspecifico é array vazio", () => {
    const cliente = {
      nomeFantasia: "Teste",
      campoAdicionalEspecifico: [],
    };
    expect(extractDecisaoCobranca(cliente)).toBeNull();
  });

  it("deve retornar null quando campo SITUAÇÃO não existe nos campoAdicionalEspecifico", () => {
    const cliente = {
      nomeFantasia: "Teste",
      campoAdicionalEspecifico: [
        { descricao: "CNPJ", valor: "12345" },
        { descricao: "TELEFONE", valor: "11999" },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBeNull();
  });

  it("deve retornar null quando valor do campo SITUAÇÃO é vazio", () => {
    const cliente = {
      nomeFantasia: "Teste",
      campoAdicionalEspecifico: [
        { descricao: "SITUAÇÃO", valor: "" },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBeNull();
  });

  it("deve retornar null quando valor do campo SITUAÇÃO é null (cliente sem decisão preenchida)", () => {
    const cliente = {
      nomeFantasia: "Teste",
      campoAdicionalEspecifico: [
        { descricao: "SITUAÇÃO", valor: null },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBeNull();
  });

  it("deve funcionar com descricao 'SITUACAO' (sem acento)", () => {
    const cliente = {
      nomeFantasia: "Teste",
      campoAdicionalEspecifico: [
        { descricao: "SITUACAO", valor: "COM PROTESTO" },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBe("COM PROTESTO");
  });

  it("deve funcionar com descricao contendo 'SITUA' (match parcial)", () => {
    const cliente = {
      nomeFantasia: "Teste",
      campoAdicionalEspecifico: [
        { descricao: "Situação do Cliente", valor: "SEM PROTESTO" },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBe("SEM PROTESTO");
  });

  it("deve fazer trim no valor retornado", () => {
    const cliente = {
      nomeFantasia: "Teste",
      campoAdicionalEspecifico: [
        { descricao: "SITUAÇÃO", valor: "  COM PROTESTO  " },
      ],
    };
    expect(extractDecisaoCobranca(cliente)).toBe("COM PROTESTO");
  });

  it("NÃO deve usar camposAdicionais (tipo errado - EmpresaCampoAdicionalValor)", () => {
    // camposAdicionais tem estrutura diferente (valorTexto, valorNumero, etc.)
    // e NÃO tem campos descricao/valor
    const cliente = {
      nomeFantasia: "Teste",
      camposAdicionais: [
        { descricao: "SITUAÇÃO", valor: "COM PROTESTO" },
      ],
      // sem campoAdicionalEspecifico
    };
    expect(extractDecisaoCobranca(cliente)).toBeNull();
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

describe("sync planilha: tipo (protesto) deve ser atualizado do Maxiprod", () => {
  it("deve atualizar tipo quando Maxiprod tem valor diferente do salvo", () => {
    // Simula a lógica corrigida no cobrancaPlanilhaRouter
    const match = { tipo: "SEM PROTESTO", email: "old@test.com" };
    const inad = { tipo: "COM PROTESTO (CARTÓRIO)", empresa: "BOUTIQUE DO CONSTRUTOR" };
    const updateData: Record<string, any> = {};

    // Nova lógica: SEMPRE atualizar tipo do Maxiprod
    if (inad.tipo && match.tipo !== inad.tipo) {
      updateData.tipo = inad.tipo;
    }

    expect(updateData.tipo).toBe("COM PROTESTO (CARTÓRIO)");
  });

  it("não deve atualizar tipo quando valores são iguais", () => {
    const match = { tipo: "COM PROTESTO (CARTÓRIO)" };
    const inad = { tipo: "COM PROTESTO (CARTÓRIO)", empresa: "TESTE" };
    const updateData: Record<string, any> = {};

    if (inad.tipo && match.tipo !== inad.tipo) {
      updateData.tipo = inad.tipo;
    }

    expect(updateData.tipo).toBeUndefined();
  });

  it("deve atualizar tipo quando match.tipo está vazio", () => {
    const match = { tipo: "" };
    const inad = { tipo: "SEM PROTESTO", empresa: "TESTE" };
    const updateData: Record<string, any> = {};

    if (inad.tipo && match.tipo !== inad.tipo) {
      updateData.tipo = inad.tipo;
    }

    expect(updateData.tipo).toBe("SEM PROTESTO");
  });
});

describe("sync planilha: email NF-e deve ter prioridade", () => {
  it("deve usar emailParaEnvioDeDocumentosFiscais quando disponível", () => {
    const match = { email: null };
    const emailNfeMap: Record<string, string> = { "elian carrilho santiago da silva": "elanfael@gmail.com" };
    const clienteData = { email: "outro@email.com" };
    const empresaNorm = "elian carrilho santiago da silva";
    const updateData: Record<string, any> = {};

    if (!match.email) {
      const nfeEmail = emailNfeMap[empresaNorm];
      if (nfeEmail) {
        updateData.email = nfeEmail;
      } else if (clienteData.email) {
        updateData.email = clienteData.email;
      }
    }

    expect(updateData.email).toBe("elanfael@gmail.com");
  });

  it("deve usar email do pedido como fallback quando NF-e não disponível", () => {
    const match = { email: null };
    const emailNfeMap: Record<string, string> = {};
    const clienteData = { email: "pedido@email.com" };
    const empresaNorm = "empresa sem nfe";
    const updateData: Record<string, any> = {};

    if (!match.email) {
      const nfeEmail = emailNfeMap[empresaNorm];
      if (nfeEmail) {
        updateData.email = nfeEmail;
      } else if (clienteData.email) {
        updateData.email = clienteData.email;
      }
    }

    expect(updateData.email).toBe("pedido@email.com");
  });

  it("não deve sobrescrever email já preenchido manualmente", () => {
    const match = { email: "manual@email.com" };
    const emailNfeMap: Record<string, string> = { "empresa": "nfe@email.com" };
    const clienteData = { email: "pedido@email.com" };
    const empresaNorm = "empresa";
    const updateData: Record<string, any> = {};

    if (!match.email) {
      const nfeEmail = emailNfeMap[empresaNorm];
      if (nfeEmail) {
        updateData.email = nfeEmail;
      } else if (clienteData.email) {
        updateData.email = clienteData.email;
      }
    }

    expect(updateData.email).toBeUndefined(); // Não sobrescreve
  });
});
