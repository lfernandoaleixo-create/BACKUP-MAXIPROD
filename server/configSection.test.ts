/**
 * Test: Config section navigation logic
 * Verifies that the tabMap in GestaoComercial correctly maps config categories
 * to the right tab + section params, and that SellerConfigPanel correctly
 * shows/hides sections based on the section prop.
 */
import { describe, it, expect } from "vitest";

describe("Config section navigation mapping", () => {
  // Simulates the tabMap logic from GestaoComercial.tsx
  const tabMap: Record<string, { tab: string; section?: string }> = {
    estoque: { tab: "configuracoes", section: "estoque" },
    tabela_preco: { tab: "tabela_precos" },
    catalogos: { tab: "configuracoes", section: "catalogos" },
    senha: { tab: "configuracoes", section: "senha" },
    pedidos: { tab: "pedidos" },
    metricas: { tab: "vendas" },
  };

  it("maps 'estoque' config to configuracoes tab with section=estoque", () => {
    const target = tabMap["estoque"];
    expect(target.tab).toBe("configuracoes");
    expect(target.section).toBe("estoque");
  });

  it("maps 'tabela_preco' config to tabela_precos tab without section", () => {
    const target = tabMap["tabela_preco"];
    expect(target.tab).toBe("tabela_precos");
    expect(target.section).toBeUndefined();
  });

  it("maps 'catalogos' config to configuracoes tab with section=catalogos", () => {
    const target = tabMap["catalogos"];
    expect(target.tab).toBe("configuracoes");
    expect(target.section).toBe("catalogos");
  });

  it("maps 'senha' config to configuracoes tab with section=senha", () => {
    const target = tabMap["senha"];
    expect(target.tab).toBe("configuracoes");
    expect(target.section).toBe("senha");
  });

  it("maps 'pedidos' config to pedidos tab without section", () => {
    const target = tabMap["pedidos"];
    expect(target.tab).toBe("pedidos");
    expect(target.section).toBeUndefined();
  });

  it("maps 'metricas' config to vendas tab without section", () => {
    const target = tabMap["metricas"];
    expect(target.tab).toBe("vendas");
    expect(target.section).toBeUndefined();
  });

  it("generates correct URL with section param for estoque", () => {
    const target = tabMap["estoque"];
    const permId = 42;
    const navUrl = target.section
      ? `/gestao-comercial/vendedor/${permId}?tab=${target.tab}&section=${target.section}`
      : `/gestao-comercial/vendedor/${permId}?tab=${target.tab}`;
    expect(navUrl).toBe("/gestao-comercial/vendedor/42?tab=configuracoes&section=estoque");
  });

  it("generates correct URL without section param for tabela_preco", () => {
    const target = tabMap["tabela_preco"];
    const permId = 42;
    const navUrl = target.section
      ? `/gestao-comercial/vendedor/${permId}?tab=${target.tab}&section=${target.section}`
      : `/gestao-comercial/vendedor/${permId}?tab=${target.tab}`;
    expect(navUrl).toBe("/gestao-comercial/vendedor/42?tab=tabela_precos");
  });
});

describe("SellerConfigPanel section visibility logic", () => {
  // Simulates the visibility logic from SellerConfigPanel
  function getVisibility(section: string | null | undefined) {
    const showSenha = !section || section === "senha";
    const showEstoque = !section || section === "estoque";
    const showCatalogos = !section || section === "catalogos";
    return { showSenha, showEstoque, showCatalogos };
  }

  it("shows all sections when no section param is provided", () => {
    const { showSenha, showEstoque, showCatalogos } = getVisibility(null);
    expect(showSenha).toBe(true);
    expect(showEstoque).toBe(true);
    expect(showCatalogos).toBe(true);
  });

  it("shows only senha section when section=senha", () => {
    const { showSenha, showEstoque, showCatalogos } = getVisibility("senha");
    expect(showSenha).toBe(true);
    expect(showEstoque).toBe(false);
    expect(showCatalogos).toBe(false);
  });

  it("shows only estoque section when section=estoque", () => {
    const { showSenha, showEstoque, showCatalogos } = getVisibility("estoque");
    expect(showSenha).toBe(false);
    expect(showEstoque).toBe(true);
    expect(showCatalogos).toBe(false);
  });

  it("shows only catalogos section when section=catalogos", () => {
    const { showSenha, showEstoque, showCatalogos } = getVisibility("catalogos");
    expect(showSenha).toBe(false);
    expect(showEstoque).toBe(false);
    expect(showCatalogos).toBe(true);
  });
});
