import { describe, it, expect } from "vitest";

/**
 * Testes para a lógica de variação de Madeira Produto Acabado.
 * 
 * Regra: Quando um pedido de variação é gerado em Madeira Acabado,
 * o estoque do produto mãe deve ser abatido e um estoque virtual
 * deve ser criado na variação. Quando o pedido sair (faturar),
 * desconta da variação (evita baixa dupla).
 */

// Simula a lógica do stockProcessor para Madeira Acabado
function processVariant(params: {
  parentEstoqueUn: number;
  parentEstoqueCx: number;
  parentUnidadesPorCaixa: number;
  parentPedidosUn: number;
  childPedidosUn: number;
  childEstoqueUn: number;
  childEstoqueCx: number | null;
  childUnidadesPorCaixa: number | null;
  conversionFactor: number;
  grupo: string;
  subgrupo: string;
}) {
  const isMadeiraAcabado = params.grupo === "industrializacao" && params.subgrupo === "madeira";
  
  let variantEstoqueUn = params.childEstoqueUn;
  let variantEstoqueCx = params.childEstoqueCx;
  let extraPedidosUn = 0;
  
  if (isMadeiraAcabado) {
    // MADEIRA PRODUTO ACABADO: sempre abater do mãe
    extraPedidosUn += params.childPedidosUn * params.conversionFactor;
    // Criar estoque virtual na variação
    if (params.childEstoqueUn === 0 && params.childPedidosUn > 0) {
      variantEstoqueUn = params.childPedidosUn;
      variantEstoqueCx = params.childUnidadesPorCaixa
        ? Math.floor(params.childPedidosUn / params.childUnidadesPorCaixa)
        : null;
    }
  }
  
  // Ajustar pai
  const parentPedidosUn = params.parentPedidosUn + extraPedidosUn;
  const parentDisponivelUn = params.parentEstoqueUn - parentPedidosUn;
  const parentDisponivelCx = params.parentUnidadesPorCaixa
    ? Math.floor(parentDisponivelUn / params.parentUnidadesPorCaixa)
    : null;
  const parentEstoqueCxFinal = params.parentEstoqueCx; // Estoque bruto não muda
  
  return {
    parentPedidosUn,
    parentDisponivelUn,
    parentDisponivelCx,
    parentEstoqueCx: parentEstoqueCxFinal,
    variantEstoqueUn,
    variantEstoqueCx,
  };
}

describe("Madeira Produto Acabado - Variação", () => {
  it("deve abater pedidos da variação do estoque mãe", () => {
    // Cenário: Pai tem 55 cx (55 un, 1 un/cx), variação tem pedido de 15 un
    const result = processVariant({
      parentEstoqueUn: 55,
      parentEstoqueCx: 55,
      parentUnidadesPorCaixa: 1,
      parentPedidosUn: 0,
      childPedidosUn: 15,
      childEstoqueUn: 0,
      childEstoqueCx: null,
      childUnidadesPorCaixa: 1,
      conversionFactor: 1,
      grupo: "industrializacao",
      subgrupo: "madeira",
    });
    
    // Pai deve ter 15 pedidos adicionados (da variação)
    expect(result.parentPedidosUn).toBe(15);
    // Disponível do pai = 55 - 15 = 40
    expect(result.parentDisponivelUn).toBe(40);
    expect(result.parentDisponivelCx).toBe(40);
    // Variação deve ter estoque virtual de 15
    expect(result.variantEstoqueUn).toBe(15);
    expect(result.variantEstoqueCx).toBe(15);
  });

  it("deve criar estoque virtual na variação quando não tem estoque próprio", () => {
    const result = processVariant({
      parentEstoqueUn: 100,
      parentEstoqueCx: 100,
      parentUnidadesPorCaixa: 1,
      parentPedidosUn: 10,
      childPedidosUn: 20,
      childEstoqueUn: 0,
      childEstoqueCx: null,
      childUnidadesPorCaixa: 1,
      conversionFactor: 1,
      grupo: "industrializacao",
      subgrupo: "madeira",
    });
    
    // Pai: pedidos = 10 (próprios) + 20 (variação) = 30
    expect(result.parentPedidosUn).toBe(30);
    // Disponível = 100 - 30 = 70
    expect(result.parentDisponivelUn).toBe(70);
    // Variação: estoque virtual = 20
    expect(result.variantEstoqueUn).toBe(20);
    expect(result.variantEstoqueCx).toBe(20);
  });

  it("deve manter estoque real da variação quando já tem estoque próprio (faturado)", () => {
    // Cenário: variação já tem estoque (pedido já foi faturado e baixou do mãe)
    const result = processVariant({
      parentEstoqueUn: 40,
      parentEstoqueCx: 40,
      parentUnidadesPorCaixa: 1,
      parentPedidosUn: 0,
      childPedidosUn: 15,
      childEstoqueUn: 15, // Já tem estoque próprio
      childEstoqueCx: 15,
      childUnidadesPorCaixa: 1,
      conversionFactor: 1,
      grupo: "industrializacao",
      subgrupo: "madeira",
    });
    
    // Pai: pedidos = 0 + 15 (variação) = 15
    expect(result.parentPedidosUn).toBe(15);
    // Variação: mantém estoque real (15), não cria virtual
    expect(result.variantEstoqueUn).toBe(15);
    expect(result.variantEstoqueCx).toBe(15);
  });

  it("NÃO deve afetar produtos de importação (não-madeira)", () => {
    const result = processVariant({
      parentEstoqueUn: 100,
      parentEstoqueCx: 100,
      parentUnidadesPorCaixa: 1,
      parentPedidosUn: 0,
      childPedidosUn: 10,
      childEstoqueUn: 0,
      childEstoqueCx: null,
      childUnidadesPorCaixa: 1,
      conversionFactor: 1,
      grupo: "importacao_revenda",
      subgrupo: "bambu",
    });
    
    // Não é madeira acabado, então NÃO abate do pai
    expect(result.parentPedidosUn).toBe(0);
    expect(result.parentDisponivelUn).toBe(100);
    // Variação: sem estoque virtual (mantém 0)
    expect(result.variantEstoqueUn).toBe(0);
    expect(result.variantEstoqueCx).toBe(null);
  });

  it("deve respeitar o fator de conversão ao abater do pai", () => {
    const result = processVariant({
      parentEstoqueUn: 1000,
      parentEstoqueCx: 100,
      parentUnidadesPorCaixa: 10,
      parentPedidosUn: 0,
      childPedidosUn: 50,
      childEstoqueUn: 0,
      childEstoqueCx: null,
      childUnidadesPorCaixa: 5,
      conversionFactor: 2, // 1 un do filho = 2 un do pai
      grupo: "industrializacao",
      subgrupo: "madeira",
    });
    
    // Pai: pedidos = 50 * 2 (fator) = 100 un
    expect(result.parentPedidosUn).toBe(100);
    // Disponível = 1000 - 100 = 900 un = 90 cx
    expect(result.parentDisponivelUn).toBe(900);
    expect(result.parentDisponivelCx).toBe(90);
    // Variação: estoque virtual = 50 un = 10 cx (50/5)
    expect(result.variantEstoqueUn).toBe(50);
    expect(result.variantEstoqueCx).toBe(10);
  });

  it("deve funcionar quando variação não tem pedidos", () => {
    const result = processVariant({
      parentEstoqueUn: 55,
      parentEstoqueCx: 55,
      parentUnidadesPorCaixa: 1,
      parentPedidosUn: 3,
      childPedidosUn: 0,
      childEstoqueUn: 0,
      childEstoqueCx: null,
      childUnidadesPorCaixa: 1,
      conversionFactor: 1,
      grupo: "industrializacao",
      subgrupo: "madeira",
    });
    
    // Sem pedidos na variação, pai fica com seus pedidos próprios
    expect(result.parentPedidosUn).toBe(3);
    expect(result.parentDisponivelUn).toBe(52);
    // Variação: sem estoque virtual (sem pedidos)
    expect(result.variantEstoqueUn).toBe(0);
    expect(result.variantEstoqueCx).toBe(null);
  });
});
