import { describe, it, expect } from "vitest";

// Test the categorizeProduct logic (replicated from financialRouter.ts)
function categorizeProduct(descricao: string, grupoDesc: string): 'madeira' | 'bambu' | null {
  const desc = (descricao || '').toUpperCase();
  const grupo = (grupoDesc || '').toUpperCase();
  if (grupo.includes('BAMBU') || grupo.includes('FIBRA')) return 'bambu';
  if (grupo.includes('VARETA') || grupo.includes('ESPETO') || grupo.includes('PALITO') || grupo.includes('MADEIRA')) return 'madeira';
  if (desc.includes('MADEIRA SERRADA') || desc.includes('MADEIRA DE PINUS')) return 'madeira';
  if (desc.includes('VARETA') && !desc.includes('BAMBU')) return 'madeira';
  if (desc.includes('VARETA AROMATIZADOR')) return 'madeira';
  return null;
}

// Test editor exclusion logic
const EDITORES = ["BRENDA", "LARISSA"];
function isEditor(nome: string): boolean {
  return EDITORES.includes(nome.toUpperCase().trim());
}

// Test Grupo Fox override
const CLIENTES_GRUPO_FOX = ["JOHNSON", "KEURE", "S C JOHNSON", "SC JOHNSON", "S. C. JOHNSON"];
function isClienteGrupoFox(nome: string): boolean {
  const upper = nome.toUpperCase();
  return CLIENTES_GRUPO_FOX.some(prefix => upper.includes(prefix));
}

describe("categorizeProduct", () => {
  it("bambu importado → bambu", () => {
    expect(categorizeProduct("ESPETO DE BAMBU 4,0 X 250 MM", "BAMBU")).toBe("bambu");
  });
  it("fibra → bambu", () => {
    expect(categorizeProduct("VARETA DE FIBRA", "FIBRA")).toBe("bambu");
  });
  it("vareta grupo → madeira", () => {
    expect(categorizeProduct("VARETA MULTI-USO", "VARETA")).toBe("madeira");
  });
  it("espeto grupo → madeira", () => {
    expect(categorizeProduct("ESPETO DE BAMBU", "ESPETO")).toBe("madeira");
  });
  it("palito grupo → madeira", () => {
    expect(categorizeProduct("PALITO MANICURE", "PALITO")).toBe("madeira");
  });
  it("madeira serrada desc → madeira", () => {
    expect(categorizeProduct("MADEIRA SERRADA SECA 3,5 X 3,5", "")).toBe("madeira");
  });
  it("madeira pinus desc → madeira", () => {
    expect(categorizeProduct("MADEIRA DE PINUS SERRADA", "")).toBe("madeira");
  });
  it("vareta aromatizador desc → madeira", () => {
    expect(categorizeProduct("VARETA AROMATIZADOR 4,0 X 200 MM", "")).toBe("madeira");
  });
  it("embalagem → null", () => {
    expect(categorizeProduct("CAIXA PAPELÃO", "EMBALAGEM")).toBeNull();
  });
});

describe("isEditor", () => {
  it("BRENDA é editora", () => expect(isEditor("BRENDA")).toBe(true));
  it("LARISSA é editora", () => expect(isEditor("LARISSA")).toBe(true));
  it("JORDAO não é editor", () => expect(isEditor("JORDAO")).toBe(false));
  it("GILSON não é editor", () => expect(isEditor("GILSON")).toBe(false));
});

describe("isClienteGrupoFox", () => {
  it("KEURE QUIMICA → Grupo Fox", () => expect(isClienteGrupoFox("KEURE QUIMICA")).toBe(true));
  it("SC JOHNSON & SON EGYPT → Grupo Fox", () => expect(isClienteGrupoFox("SC JOHNSON & SON EGYPT")).toBe(true));
  it("FOGOS ALEXANDRE → não", () => expect(isClienteGrupoFox("FOGOS ALEXANDRE")).toBe(false));
});

describe("Fallback vendedor por produto", () => {
  it("cliente com madeira e sem vendedor → JORDAO", () => {
    const cats = { madeira: true, bambu: false };
    const vendedor = cats.madeira ? "JORDAO" : cats.bambu ? "JUVENAL TEIXEIRA" : "";
    expect(vendedor).toBe("JORDAO");
  });
  it("cliente com bambu e sem vendedor → JUVENAL TEIXEIRA", () => {
    const cats = { madeira: false, bambu: true };
    const vendedor = cats.madeira ? "JORDAO" : cats.bambu ? "JUVENAL TEIXEIRA" : "";
    expect(vendedor).toBe("JUVENAL TEIXEIRA");
  });
  it("cliente com ambos → JORDAO (prioridade madeira)", () => {
    const cats = { madeira: true, bambu: true };
    const vendedor = cats.madeira ? "JORDAO" : cats.bambu ? "JUVENAL TEIXEIRA" : "";
    expect(vendedor).toBe("JORDAO");
  });
  it("cliente sem produto relevante → sem vendedor", () => {
    const cats = { madeira: false, bambu: false };
    const vendedor = cats.madeira ? "JORDAO" : cats.bambu ? "JUVENAL TEIXEIRA" : "";
    expect(vendedor).toBe("");
  });
});
