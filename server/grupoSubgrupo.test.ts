import { describe, it, expect } from "vitest";

/**
 * Tests for the grupo/subgrupo classification logic in stockProcessor
 * classifyGrupo maps superGrupoCodigo/grupoCodigo to business grupo/subgrupo
 */

// Replicate the classifyGrupo logic from stockProcessor.ts
function classifyGrupo(superGrupoCodigo: string, grupoCodigo: string): { grupo: string; subgrupo: string } {
  // SG:12 = Importação de Produtos Prontos (Revenda)
  if (superGrupoCodigo === "12") {
    if (grupoCodigo === "20") return { grupo: "importacao_revenda", subgrupo: "bambu" };
    if (grupoCodigo === "21") return { grupo: "importacao_revenda", subgrupo: "fibra" };
    return { grupo: "importacao_revenda", subgrupo: "outros" };
  }
  // SG:05 = Industrialização (Bambu matéria prima)
  if (superGrupoCodigo === "05") {
    if (grupoCodigo === "06") return { grupo: "industrializacao", subgrupo: "varetas" };
    if (grupoCodigo === "07") return { grupo: "industrializacao", subgrupo: "espetos" };
    if (grupoCodigo === "08") return { grupo: "industrializacao", subgrupo: "palitos" };
    return { grupo: "industrializacao", subgrupo: "outros" };
  }
  // SG:16 = Importação de Matéria-Prima (Madeira)
  if (superGrupoCodigo === "16") {
    if (grupoCodigo === "18" || grupoCodigo === "19") return { grupo: "importacao_mp", subgrupo: "madeira" };
    if (grupoCodigo === "24") return { grupo: "outros", subgrupo: "outros" }; // Embalagem
    return { grupo: "importacao_mp", subgrupo: "outros" };
  }
  return { grupo: "outros", subgrupo: "outros" };
}

describe("classifyGrupo", () => {
  describe("Importação de Produtos Prontos (Revenda) - SG:12", () => {
    it("should classify grupo 20 as bambu", () => {
      const result = classifyGrupo("12", "20");
      expect(result.grupo).toBe("importacao_revenda");
      expect(result.subgrupo).toBe("bambu");
    });

    it("should classify grupo 21 as fibra", () => {
      const result = classifyGrupo("12", "21");
      expect(result.grupo).toBe("importacao_revenda");
      expect(result.subgrupo).toBe("fibra");
    });

    it("should classify unknown grupo under SG:12 as revenda/outros", () => {
      const result = classifyGrupo("12", "99");
      expect(result.grupo).toBe("importacao_revenda");
      expect(result.subgrupo).toBe("outros");
    });
  });

  describe("Industrialização - SG:05", () => {
    it("should classify grupo 06 as varetas", () => {
      const result = classifyGrupo("05", "06");
      expect(result.grupo).toBe("industrializacao");
      expect(result.subgrupo).toBe("varetas");
    });

    it("should classify grupo 07 as espetos", () => {
      const result = classifyGrupo("05", "07");
      expect(result.grupo).toBe("industrializacao");
      expect(result.subgrupo).toBe("espetos");
    });

    it("should classify grupo 08 as palitos", () => {
      const result = classifyGrupo("05", "08");
      expect(result.grupo).toBe("industrializacao");
      expect(result.subgrupo).toBe("palitos");
    });
  });

  describe("Importação de Matéria-Prima - SG:16", () => {
    it("should classify grupo 18 as madeira", () => {
      const result = classifyGrupo("16", "18");
      expect(result.grupo).toBe("importacao_mp");
      expect(result.subgrupo).toBe("madeira");
    });

    it("should classify grupo 19 as madeira", () => {
      const result = classifyGrupo("16", "19");
      expect(result.grupo).toBe("importacao_mp");
      expect(result.subgrupo).toBe("madeira");
    });

    it("should classify grupo 24 (embalagem) as outros", () => {
      const result = classifyGrupo("16", "24");
      expect(result.grupo).toBe("outros");
      expect(result.subgrupo).toBe("outros");
    });
  });

  describe("Unknown groups", () => {
    it("should classify unknown superGrupo as outros", () => {
      const result = classifyGrupo("99", "01");
      expect(result.grupo).toBe("outros");
      expect(result.subgrupo).toBe("outros");
    });
  });
});

// Replicate the classifyGrupoFromDesc logic from stockProcessor.ts
function classifyGrupoFromDesc(desc: string, referenciaPO?: string): { grupo: string; subgrupo: string } {
  const d = desc.toUpperCase();
  const ref = (referenciaPO || "").toUpperCase();
  
  // Se a referência da PO indica MADEIRA, é matéria-prima importada
  if (ref.startsWith("MADEIRA")) return { grupo: "importacao_mp", subgrupo: "madeira_importada" };
  
  // MADEIRA/PINUS na descrição → matéria-prima importada (ex: "ESPETO DE MADEIRA")
  if ((d.includes("MADEIRA") || d.includes("PINUS")) && !d.includes("BAMBU")) {
    return { grupo: "importacao_mp", subgrupo: "madeira_importada" };
  }
  
  // MÁQUINA DE ESPETINHO → importação revenda, subgrupo próprio
  if (d.includes("MAQUINA") || d.includes("MÁQUINA")) {
    return { grupo: "importacao_revenda", subgrupo: "maquina_espetinho" };
  }
  if (d.includes("FIBRA")) return { grupo: "importacao_revenda", subgrupo: "fibra" };
  if (d.includes("BAMBU") || d.includes("ESPETO") || d.includes("PALITO") || d.includes("VARETA") || d.includes("HASHI")) {
    return { grupo: "importacao_revenda", subgrupo: "bambu" };
  }
  return { grupo: "outros", subgrupo: "outros" };
}

describe("classifyGrupoFromDesc", () => {
  describe("MADEIRA products (Import. Matéria-Prima)", () => {
    it("should classify ESPETO DE MADEIRA as importacao_mp/madeira_importada", () => {
      const result = classifyGrupoFromDesc("ESPETO DE MADEIRA 3,8 X 200MM 10.000 POR PACOTE (POLIDOS, SEM PONTA, SEM SELEÇÃO)");
      expect(result.grupo).toBe("importacao_mp");
      expect(result.subgrupo).toBe("madeira_importada");
    });

    it("should classify MADEIRA SERRADA as importacao_mp/madeira_importada", () => {
      const result = classifyGrupoFromDesc("MADEIRA SERRADA PINUS");
      expect(result.grupo).toBe("importacao_mp");
      expect(result.subgrupo).toBe("madeira_importada");
    });

    it("should classify PINUS as importacao_mp/madeira_importada", () => {
      const result = classifyGrupoFromDesc("PINUS SERRADO 2M");
      expect(result.grupo).toBe("importacao_mp");
      expect(result.subgrupo).toBe("madeira_importada");
    });

    it("should use referenciaPO MADEIRA to classify as importacao_mp", () => {
      const result = classifyGrupoFromDesc("PRODUTO GENERICO", "MADEIRA");
      expect(result.grupo).toBe("importacao_mp");
      expect(result.subgrupo).toBe("madeira_importada");
    });

    it("should use referenciaPO MADEIRA - CONTRATO to classify as importacao_mp", () => {
      const result = classifyGrupoFromDesc("ESPETO 200MM", "MADEIRA - CONTRATO");
      expect(result.grupo).toBe("importacao_mp");
      expect(result.subgrupo).toBe("madeira_importada");
    });
  });

  describe("BAMBU products (Revenda)", () => {
    it("should classify ESPETO DE BAMBU as importacao_revenda/bambu", () => {
      const result = classifyGrupoFromDesc("ESPETO DE BAMBU 3,5 X 180MM");
      expect(result.grupo).toBe("importacao_revenda");
      expect(result.subgrupo).toBe("bambu");
    });

    it("should classify PALITO DE BAMBU as importacao_revenda/bambu", () => {
      const result = classifyGrupoFromDesc("PALITO DE BAMBU 65MM");
      expect(result.grupo).toBe("importacao_revenda");
      expect(result.subgrupo).toBe("bambu");
    });

    it("should classify VARETA as importacao_revenda/bambu", () => {
      const result = classifyGrupoFromDesc("VARETA DE BAMBU 3MM");
      expect(result.grupo).toBe("importacao_revenda");
      expect(result.subgrupo).toBe("bambu");
    });

    it("should classify HASHI as importacao_revenda/bambu", () => {
      const result = classifyGrupoFromDesc("HASHI DESCARTAVEL");
      expect(result.grupo).toBe("importacao_revenda");
      expect(result.subgrupo).toBe("bambu");
    });

    it("should classify plain ESPETO (no material) as importacao_revenda/bambu", () => {
      const result = classifyGrupoFromDesc("ESPETO 250MM C/ 100 UNID");
      expect(result.grupo).toBe("importacao_revenda");
      expect(result.subgrupo).toBe("bambu");
    });
  });

  describe("FIBRA products", () => {
    it("should classify FIBRA as importacao_revenda/fibra", () => {
      const result = classifyGrupoFromDesc("VARETA DE FIBRA 3,0 X 200MM");
      expect(result.grupo).toBe("importacao_revenda");
      expect(result.subgrupo).toBe("fibra");
    });
  });

  describe("MÁQUINA products", () => {
    it("should classify MÁQUINA DE ESPETINHO as importacao_revenda/maquina_espetinho", () => {
      const result = classifyGrupoFromDesc("MÁQUINA DE ESPETINHO");
      expect(result.grupo).toBe("importacao_revenda");
      expect(result.subgrupo).toBe("maquina_espetinho");
    });

    it("should classify MAQUINA (sem acento) as importacao_revenda/maquina_espetinho", () => {
      const result = classifyGrupoFromDesc("MAQUINA INDUSTRIAL");
      expect(result.grupo).toBe("importacao_revenda");
      expect(result.subgrupo).toBe("maquina_espetinho");
    });
  });

  describe("Other products", () => {
    it("should classify unknown product as outros", () => {
      const result = classifyGrupoFromDesc("CAIXA DE EMBALAGEM");
      expect(result.grupo).toBe("outros");
      expect(result.subgrupo).toBe("outros");
    });
  });

  describe("referenciaPO takes priority", () => {
    it("should prioritize referenciaPO MADEIRA even for BAMBU description", () => {
      // Edge case: if PO ref says MADEIRA but desc says BAMBU, PO ref wins
      const result = classifyGrupoFromDesc("PRODUTO BAMBU", "MADEIRA");
      expect(result.grupo).toBe("importacao_mp");
      expect(result.subgrupo).toBe("madeira_importada");
    });

    it("should not affect classification when referenciaPO is PO number", () => {
      const result = classifyGrupoFromDesc("ESPETO DE BAMBU 200MM", "PO62");
      expect(result.grupo).toBe("importacao_revenda");
      expect(result.subgrupo).toBe("bambu");
    });
  });
});

describe("Filter logic", () => {
  const items = [
    { grupo: "importacao_revenda", subgrupo: "bambu", descricao: "ESPETO BAMBU" },
    { grupo: "importacao_revenda", subgrupo: "bambu", descricao: "PALITO BAMBU" },
    { grupo: "importacao_revenda", subgrupo: "fibra", descricao: "VARETA FIBRA" },
    { grupo: "importacao_mp", subgrupo: "madeira", descricao: "MADEIRA SERRADA" },
    { grupo: "industrializacao", subgrupo: "varetas", descricao: "VARETA MULTI-USO" },
    { grupo: "outros", subgrupo: "outros", descricao: "CAIXA EMBALAGEM" },
  ];

  it("should filter by grupo importacao_revenda", () => {
    const filtered = items.filter(i => i.grupo === "importacao_revenda");
    expect(filtered).toHaveLength(3);
  });

  it("should filter by subgrupo bambu within revenda", () => {
    const filtered = items.filter(i => i.grupo === "importacao_revenda" && i.subgrupo === "bambu");
    expect(filtered).toHaveLength(2);
  });

  it("should filter by subgrupo fibra within revenda", () => {
    const filtered = items.filter(i => i.grupo === "importacao_revenda" && i.subgrupo === "fibra");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].descricao).toBe("VARETA FIBRA");
  });

  it("should show available subgrupos for selected grupo", () => {
    const grupoFilter = "importacao_revenda";
    const base = items.filter(i => i.grupo === grupoFilter);
    const subgrupos = Array.from(new Set(base.map(i => i.subgrupo))).sort();
    expect(subgrupos).toEqual(["bambu", "fibra"]);
  });

  it("should show all grupos when no filter", () => {
    const grupos = Array.from(new Set(items.map(i => i.grupo))).sort();
    expect(grupos).toEqual(["importacao_mp", "importacao_revenda", "industrializacao", "outros"]);
  });

  it("should reset subgrupo when grupo changes", () => {
    let subgrupoFilter = "bambu";
    // Simulate grupo change
    const handleGrupoChange = () => { subgrupoFilter = "all"; };
    handleGrupoChange();
    expect(subgrupoFilter).toBe("all");
  });
});
