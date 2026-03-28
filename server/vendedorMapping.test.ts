/**
 * Tests for vendedor mapping logic in financial router
 * Validates: editor exclusion, Grupo Fox override, vendedor priority
 */
import { describe, it, expect } from "vitest";

// Replicate the pure functions from financialRouter.ts for testing
const EDITORES_NAO_VENDEDORES = ["BRENDA", "LARISSA"];
const CLIENTES_GRUPO_FOX = ["JOHNSON", "KEURE", "S C JOHNSON", "SC JOHNSON", "S. C. JOHNSON"];

function isClienteGrupoFox(nome: string): boolean {
  const upper = nome.toUpperCase();
  return CLIENTES_GRUPO_FOX.some(prefix => upper.includes(prefix));
}

function isEditorNaoVendedor(nome: string): boolean {
  return EDITORES_NAO_VENDEDORES.includes(nome.toUpperCase().trim());
}

/**
 * Simulates the vendedor resolution logic from fetchVendedorMapFromGraphQL
 */
function resolveVendedor(pedido: {
  representante?: string;
  responsavel?: string;
  clienteNome: string;
}): string {
  // 1. Priority: representanteOuVendedor1
  let vendedor = pedido.representante || "";

  // 2. Fallback: responsavelUsuario, only if real seller (not editor)
  if (!vendedor && pedido.responsavel) {
    if (!isEditorNaoVendedor(pedido.responsavel)) {
      vendedor = pedido.responsavel;
    }
  }

  // 3. Override: Johnson/Keure → "Grupo Fox"
  if (isClienteGrupoFox(pedido.clienteNome)) {
    return "Grupo Fox";
  }

  return vendedor;
}

describe("isEditorNaoVendedor", () => {
  it("should identify BRENDA as editor", () => {
    expect(isEditorNaoVendedor("BRENDA")).toBe(true);
    expect(isEditorNaoVendedor("brenda")).toBe(true);
    expect(isEditorNaoVendedor("Brenda")).toBe(true);
    expect(isEditorNaoVendedor(" BRENDA ")).toBe(true);
  });

  it("should identify LARISSA as editor", () => {
    expect(isEditorNaoVendedor("LARISSA")).toBe(true);
    expect(isEditorNaoVendedor("larissa")).toBe(true);
  });

  it("should NOT identify real sellers as editors", () => {
    expect(isEditorNaoVendedor("JORDAO")).toBe(false);
    expect(isEditorNaoVendedor("ANA PAULA")).toBe(false);
    expect(isEditorNaoVendedor("PEDRO AUGUSTO")).toBe(false);
    expect(isEditorNaoVendedor("JUVENAL TEIXEIRA")).toBe(false);
  });
});

describe("isClienteGrupoFox", () => {
  it("should match KEURE QUIMICA", () => {
    expect(isClienteGrupoFox("KEURE QUIMICA")).toBe(true);
  });

  it("should match Johnson variants", () => {
    expect(isClienteGrupoFox("SC JOHNSON & SON EGYPT")).toBe(true);
    expect(isClienteGrupoFox("S. C. JOHNSON & SON DE ARGENTINA S.A.I.C")).toBe(true);
    expect(isClienteGrupoFox("S C JOHNSON")).toBe(true);
  });

  it("should be case insensitive", () => {
    expect(isClienteGrupoFox("keure quimica")).toBe(true);
    expect(isClienteGrupoFox("sc johnson")).toBe(true);
  });

  it("should NOT match unrelated clients", () => {
    expect(isClienteGrupoFox("FOGOS ALEXANDRE")).toBe(false);
    expect(isClienteGrupoFox("ESPETOLIN")).toBe(false);
    expect(isClienteGrupoFox("N. DE A. SULINO")).toBe(false);
  });
});

describe("resolveVendedor", () => {
  it("should use representante when available", () => {
    expect(resolveVendedor({
      representante: "JORDAO",
      responsavel: "BRENDA",
      clienteNome: "FOGOS ALEXANDRE",
    })).toBe("JORDAO");
  });

  it("should fallback to responsavel when no representante and responsavel is real seller", () => {
    expect(resolveVendedor({
      representante: "",
      responsavel: "JORDAO",
      clienteNome: "FOGOS ALEXANDRE",
    })).toBe("JORDAO");
  });

  it("should NOT use BRENDA as vendedor", () => {
    expect(resolveVendedor({
      representante: "",
      responsavel: "BRENDA",
      clienteNome: "DINAMICA DISTRIBUIDORA",
    })).toBe("");
  });

  it("should NOT use LARISSA as vendedor", () => {
    expect(resolveVendedor({
      representante: "",
      responsavel: "LARISSA",
      clienteNome: "GOS COMERCIO",
    })).toBe("");
  });

  it("should override Johnson to Grupo Fox regardless of representante", () => {
    expect(resolveVendedor({
      representante: "JORDAO",
      responsavel: "",
      clienteNome: "SC JOHNSON & SON EGYPT",
    })).toBe("Grupo Fox");
  });

  it("should override Keure to Grupo Fox", () => {
    expect(resolveVendedor({
      representante: "",
      responsavel: "BRENDA",
      clienteNome: "KEURE QUIMICA",
    })).toBe("Grupo Fox");
  });

  it("should return empty when no vendedor and responsavel is editor", () => {
    expect(resolveVendedor({
      representante: "",
      responsavel: "BRENDA",
      clienteNome: "BOUTIQUE DO CONSTRUTOR",
    })).toBe("");
  });

  it("should return empty when no vendedor and no responsavel", () => {
    expect(resolveVendedor({
      representante: "",
      responsavel: "",
      clienteNome: "ESPETOLIN",
    })).toBe("");
  });

  it("should use ANA PAULA as vendedor when she is responsavel", () => {
    expect(resolveVendedor({
      representante: "",
      responsavel: "ANA PAULA",
      clienteNome: "GLAUCIENE MATEUS GOMES GERTH",
    })).toBe("ANA PAULA");
  });

  it("should use PEDRO AUGUSTO as vendedor", () => {
    expect(resolveVendedor({
      representante: "PEDRO AUGUSTO",
      responsavel: "",
      clienteNome: "ESPETINHOS OSASCO",
    })).toBe("PEDRO AUGUSTO");
  });

  it("should use JUVENAL TEIXEIRA as vendedor", () => {
    expect(resolveVendedor({
      representante: "JUVENAL TEIXEIRA",
      responsavel: "",
      clienteNome: "FESTLAR",
    })).toBe("JUVENAL TEIXEIRA");
  });
});
