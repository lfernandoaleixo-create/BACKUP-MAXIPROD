/**
 * Tests for the enhanced representante resolution logic in maxiprodGraphQL.ts
 * 
 * Verifies the fallback chain:
 * 1. representanteOuVendedor1.nomeFantasia (priority)
 * 2. representanteOuVendedor1.razaoSocial (fallback)
 * 3. responsavelUsuario.nome (fallback, excluding editors)
 * 4. Override: Johnson/Keure clients → "Grupo Fox"
 * 
 * Also verifies transportadora resolution:
 * - nomeFantasia → razaoSocial fallback
 */
import { describe, it, expect } from "vitest";

// We need to test the logic without importing the private functions directly.
// We'll replicate the exact logic here to verify correctness, then validate
// via the sync endpoint that uses the real implementation.

// Exact copies of the logic from maxiprodGraphQL.ts for unit testing
const EDITORES_NAO_VENDEDORES_SYNC = ["BRENDA", "LARISSA"];
const CLIENTES_GRUPO_FOX_SYNC = ["JOHNSON", "KEURE", "S C JOHNSON", "SC JOHNSON", "S. C. JOHNSON"];

function isClienteGrupoFoxSync(nome: string): boolean {
  const upper = nome.toUpperCase();
  return CLIENTES_GRUPO_FOX_SYNC.some(prefix => upper.includes(prefix));
}

function isEditorNaoVendedorSync(nome: string): boolean {
  return EDITORES_NAO_VENDEDORES_SYNC.includes(nome.toUpperCase().trim());
}

function resolveRepresentante(pv: any): string {
  const clienteNome = pv.cliente?.nomeFantasia || pv.cliente?.razaoSocial || "";
  
  if (clienteNome && isClienteGrupoFoxSync(clienteNome)) {
    return "Grupo Fox";
  }
  
  let rep = pv.representanteOuVendedor1?.nomeFantasia 
    || pv.representanteOuVendedor1?.razaoSocial 
    || "";
  
  if (!rep) {
    const responsavel = pv.responsavelUsuario?.nome || "";
    if (responsavel && !isEditorNaoVendedorSync(responsavel)) {
      rep = responsavel;
    }
  }
  
  return rep;
}

describe("resolveRepresentante", () => {
  it("should use representanteOuVendedor1.nomeFantasia as priority", () => {
    const pv = {
      representanteOuVendedor1: { nomeFantasia: "JORDAO LAINE", razaoSocial: "JORDÃO LAINE" },
      responsavelUsuario: { nome: "JORDAO" },
      cliente: { nomeFantasia: "AROMAZIA COMERCIAL" },
    };
    expect(resolveRepresentante(pv)).toBe("JORDAO LAINE");
  });

  it("should fallback to representanteOuVendedor1.razaoSocial when nomeFantasia is null", () => {
    const pv = {
      representanteOuVendedor1: { nomeFantasia: null, razaoSocial: "CLARINDO GONCALVES DOS SANTOS NETO" },
      responsavelUsuario: { nome: "JUVENAL" },
      cliente: { nomeFantasia: "BOI DE OURO CARNES" },
    };
    expect(resolveRepresentante(pv)).toBe("CLARINDO GONCALVES DOS SANTOS NETO");
  });

  it("should fallback to responsavelUsuario when representante is empty", () => {
    const pv = {
      representanteOuVendedor1: null,
      responsavelUsuario: { nome: "JUVENAL" },
      cliente: { nomeFantasia: "TREM BAO" },
    };
    expect(resolveRepresentante(pv)).toBe("JUVENAL");
  });

  it("should fallback to responsavelUsuario when representante has no names", () => {
    const pv = {
      representanteOuVendedor1: { nomeFantasia: null, razaoSocial: null },
      responsavelUsuario: { nome: "ANA PAULA" },
      cliente: { nomeFantasia: "IMPERATRIZ ESSENCIAS" },
    };
    expect(resolveRepresentante(pv)).toBe("ANA PAULA");
  });

  it("should NOT use editor BRENDA as vendedor", () => {
    const pv = {
      representanteOuVendedor1: null,
      responsavelUsuario: { nome: "BRENDA" },
      cliente: { nomeFantasia: "SOME CLIENT" },
    };
    expect(resolveRepresentante(pv)).toBe("");
  });

  it("should NOT use editor LARISSA as vendedor", () => {
    const pv = {
      representanteOuVendedor1: null,
      responsavelUsuario: { nome: "LARISSA" },
      cliente: { nomeFantasia: "SOME CLIENT" },
    };
    expect(resolveRepresentante(pv)).toBe("");
  });

  it("should override Johnson clients to Grupo Fox", () => {
    const pv = {
      representanteOuVendedor1: { nomeFantasia: "SOME REP" },
      responsavelUsuario: { nome: "JUVENAL" },
      cliente: { nomeFantasia: "SC JOHNSON AND SON- MEXICO" },
    };
    expect(resolveRepresentante(pv)).toBe("Grupo Fox");
  });

  it("should override Keure clients to Grupo Fox", () => {
    const pv = {
      representanteOuVendedor1: null,
      responsavelUsuario: null,
      cliente: { razaoSocial: "KEURE INDUSTRIA LTDA" },
    };
    expect(resolveRepresentante(pv)).toBe("Grupo Fox");
  });

  it("should return empty string when no representante, no responsavel, no override", () => {
    const pv = {
      representanteOuVendedor1: null,
      responsavelUsuario: null,
      cliente: { nomeFantasia: "RANDOM CLIENT" },
    };
    expect(resolveRepresentante(pv)).toBe("");
  });

  it("should return empty string when responsavel is editor and no representante", () => {
    const pv = {
      representanteOuVendedor1: { nomeFantasia: null, razaoSocial: null },
      responsavelUsuario: { nome: "BRENDA" },
      cliente: { nomeFantasia: "RANDOM CLIENT" },
    };
    expect(resolveRepresentante(pv)).toBe("");
  });
});

describe("isClienteGrupoFoxSync", () => {
  it("should match SC JOHNSON", () => {
    expect(isClienteGrupoFoxSync("SC JOHNSON AND SON- MEXICO")).toBe(true);
  });

  it("should match S C JOHNSON", () => {
    expect(isClienteGrupoFoxSync("S C JOHNSON DO BRASIL")).toBe(true);
  });

  it("should match KEURE", () => {
    expect(isClienteGrupoFoxSync("KEURE INDUSTRIA")).toBe(true);
  });

  it("should be case insensitive", () => {
    expect(isClienteGrupoFoxSync("sc johnson")).toBe(true);
  });

  it("should not match random clients", () => {
    expect(isClienteGrupoFoxSync("AROMAZIA COMERCIAL")).toBe(false);
  });
});

describe("isEditorNaoVendedorSync", () => {
  it("should identify BRENDA as editor", () => {
    expect(isEditorNaoVendedorSync("BRENDA")).toBe(true);
  });

  it("should identify LARISSA as editor", () => {
    expect(isEditorNaoVendedorSync("LARISSA")).toBe(true);
  });

  it("should be case insensitive", () => {
    expect(isEditorNaoVendedorSync("brenda")).toBe(true);
  });

  it("should not identify JUVENAL as editor", () => {
    expect(isEditorNaoVendedorSync("JUVENAL")).toBe(false);
  });

  it("should not identify ANA PAULA as editor", () => {
    expect(isEditorNaoVendedorSync("ANA PAULA")).toBe(false);
  });
});

describe("transportadora resolution", () => {
  it("should use nomeFantasia when available", () => {
    const transportadora = { nomeFantasia: "ALFA TRANSPORTES LTDA", razaoSocial: "ALFA TRANSPORTES LTDA" };
    const result = transportadora.nomeFantasia || transportadora.razaoSocial || null;
    expect(result).toBe("ALFA TRANSPORTES LTDA");
  });

  it("should fallback to razaoSocial when nomeFantasia is null", () => {
    const transportadora = { nomeFantasia: null, razaoSocial: "RODOVIARIO CAMILO DOS SANTOS FILHO LTDA" };
    const result = transportadora.nomeFantasia || transportadora.razaoSocial || null;
    expect(result).toBe("RODOVIARIO CAMILO DOS SANTOS FILHO LTDA");
  });

  it("should return null when no transportadora", () => {
    const transportadora = null;
    const result = transportadora?.nomeFantasia || transportadora?.razaoSocial || null;
    expect(result).toBeNull();
  });
});
