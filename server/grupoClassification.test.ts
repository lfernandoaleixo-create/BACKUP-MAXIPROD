import { describe, it, expect } from "vitest";
import {
  estadoToGrupo,
  inferGrupoFromItems,
  getAmostraBonificacaoLabel,
  getTipoEspecial,
  isOutros,
  isAmostraBonificacao,
  GRUPO_LABELS,
  GRUPO_LABELS_SHORT,
} from "../shared/grupoClassification";

describe("grupoClassification", () => {
  describe("estadoToGrupo", () => {
    it("classifies BAMBU as importacao_revenda", () => {
      expect(estadoToGrupo("BAMBU")).toBe("importacao_revenda");
    });
    it("classifies FIBRA as importacao_revenda", () => {
      expect(estadoToGrupo("FIBRA")).toBe("importacao_revenda");
    });
    it("classifies MADEIRA as industrializacao", () => {
      expect(estadoToGrupo("MADEIRA")).toBe("industrializacao");
    });
    it("classifies MADEIRA CONTABILIZADO as industrializacao", () => {
      expect(estadoToGrupo("MADEIRA CONTABILIZADO")).toBe("industrializacao");
    });
    it("classifies MADEIRA IMPORTADA as importacao_mp", () => {
      expect(estadoToGrupo("MADEIRA IMPORTADA")).toBe("importacao_mp");
    });
    it("classifies AMOSTRA as outros (raw estadoToGrupo)", () => {
      expect(estadoToGrupo("AMOSTRA")).toBe("outros");
    });
    it("classifies BONIFICAÇÃO as outros (raw estadoToGrupo)", () => {
      expect(estadoToGrupo("BONIFICAÇÃO")).toBe("outros");
    });
    it("classifies E-COMMERCE as ecommerce", () => {
      expect(estadoToGrupo("E-COMMERCE")).toBe("ecommerce");
    });
    it("classifies null as outros", () => {
      expect(estadoToGrupo(null)).toBe("outros");
    });
  });

  describe("isOutros", () => {
    it("returns false for AMOSTRA (not considered outros)", () => {
      expect(isOutros("AMOSTRA")).toBe(false);
    });
    it("returns false for BONIFICAÇÃO (not considered outros)", () => {
      expect(isOutros("BONIFICAÇÃO")).toBe(false);
    });
    it("returns true for CANCELADO", () => {
      expect(isOutros("CANCELADO")).toBe(true);
    });
    it("returns true for GILSON", () => {
      expect(isOutros("GILSON")).toBe(true);
    });
    it("returns true for null", () => {
      expect(isOutros(null)).toBe(true);
    });
    it("returns false for BAMBU", () => {
      expect(isOutros("BAMBU")).toBe(false);
    });
    it("returns false for MADEIRA", () => {
      expect(isOutros("MADEIRA")).toBe(false);
    });
    it("returns false for E-COMMERCE", () => {
      expect(isOutros("E-COMMERCE")).toBe(false);
    });
  });

  describe("isAmostraBonificacao", () => {
    it("returns true for AMOSTRA", () => {
      expect(isAmostraBonificacao("AMOSTRA")).toBe(true);
    });
    it("returns true for BONIFICAÇÃO", () => {
      expect(isAmostraBonificacao("BONIFICAÇÃO")).toBe(true);
    });
    it("returns true for AMOSTRA/BONIFICAÇÃO", () => {
      expect(isAmostraBonificacao("AMOSTRA/BONIFICAÇÃO")).toBe(true);
    });
    it("returns false for BAMBU", () => {
      expect(isAmostraBonificacao("BAMBU")).toBe(false);
    });
    it("returns false for null", () => {
      expect(isAmostraBonificacao(null)).toBe(false);
    });
  });

  describe("inferGrupoFromItems", () => {
    it("infers importacao_revenda from ESPETO items (espeto de bambu = revenda)", () => {
      expect(inferGrupoFromItems(["ESPETO", "ESPETO"])).toBe("importacao_revenda");
    });
    it("infers industrializacao from VARETA items (vareta de madeira = industrializado)", () => {
      expect(inferGrupoFromItems(["VARETA"])).toBe("industrializacao");
    });
    it("infers importacao_revenda from PALITO items (palito de bambu = revenda)", () => {
      expect(inferGrupoFromItems(["PALITO", "PALITO"])).toBe("importacao_revenda");
    });
    it("infers importacao_revenda when ESPETO + VARETA mixed (2 revenda vs 1 industria)", () => {
      expect(inferGrupoFromItems(["ESPETO", "ESPETO", "VARETA"])).toBe("importacao_revenda");
    });
    it("infers importacao_revenda when ESPETO + PALITO (both revenda)", () => {
      expect(inferGrupoFromItems(["ESPETO", "ESPETO", "PALITO"])).toBe("importacao_revenda");
    });
    it("infers industrializacao when VARETA > ESPETO", () => {
      expect(inferGrupoFromItems(["VARETA", "VARETA", "ESPETO"])).toBe("industrializacao");
    });
    it("returns outros for empty array", () => {
      expect(inferGrupoFromItems([])).toBe("outros");
    });
    it("returns outros for all null items", () => {
      expect(inferGrupoFromItems([null, null])).toBe("outros");
    });
    it("handles mixed with null items", () => {
      expect(inferGrupoFromItems([null, "ESPETO", null])).toBe("importacao_revenda");
    });
  });

  describe("getTipoEspecial", () => {
    it("returns BONIFICACAO for estadoConfiguravel = BONIFICAÇÃO", () => {
      expect(getTipoEspecial("BONIFICAÇÃO")).toBe("BONIFICACAO");
    });
    it("returns AMOSTRA for estadoConfiguravel = AMOSTRA", () => {
      expect(getTipoEspecial("AMOSTRA")).toBe("AMOSTRA");
    });
    it("returns null for estadoConfiguravel = BAMBU", () => {
      expect(getTipoEspecial("BAMBU")).toBe(null);
    });
    it("returns BONIFICACAO when obs contains bonificação", () => {
      expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "pedido de bonificação para cliente")).toBe("BONIFICACAO");
    });
    it("returns AMOSTRA when obs contains amostra", () => {
      expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", "enviar amostra grátis")).toBe("AMOSTRA");
    });
    it("returns AMOSTRA for low value without obs", () => {
      expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", null, 50)).toBe("AMOSTRA");
    });
    it("returns AMOSTRA as default for AMOSTRA/BONIFICAÇÃO without indicators", () => {
      expect(getTipoEspecial("AMOSTRA/BONIFICAÇÃO", null, 500)).toBe("AMOSTRA");
    });
  });

  describe("getAmostraBonificacaoLabel", () => {
    it("generates Bonificação / Revenda", () => {
      expect(getAmostraBonificacaoLabel("BONIFICACAO", "importacao_revenda")).toBe("Bonificação / Revenda");
    });
    it("generates Amostra / Revenda", () => {
      expect(getAmostraBonificacaoLabel("AMOSTRA", "importacao_revenda")).toBe("Amostra / Revenda");
    });
    it("generates Bonificação / Industr.", () => {
      expect(getAmostraBonificacaoLabel("BONIFICACAO", "industrializacao")).toBe("Bonificação / Industr.");
    });
    it("generates Amostra / Industr.", () => {
      expect(getAmostraBonificacaoLabel("AMOSTRA", "industrializacao")).toBe("Amostra / Industr.");
    });
    it("generates Amostra / Matéria-Prima", () => {
      expect(getAmostraBonificacaoLabel("AMOSTRA", "importacao_mp")).toBe("Amostra / Matéria-Prima");
    });
    it("generates Amostra/Bonif. / Outros for null tipoEspecial", () => {
      expect(getAmostraBonificacaoLabel(null, "outros")).toBe("Amostra/Bonif. / Outros");
    });
  });

  describe("GRUPO_LABELS_SHORT", () => {
    it("has short labels for all grupo keys", () => {
      expect(GRUPO_LABELS_SHORT.importacao_revenda).toBe("Revenda");
      expect(GRUPO_LABELS_SHORT.industrializacao).toBe("Industr.");      expect(GRUPO_LABELS_SHORT.importacao_mp).toBe("Mat\u00e9ria-Prima");
      expect(GRUPO_LABELS_SHORT.ecommerce).toBe("E-commerce");
      expect(GRUPO_LABELS_SHORT.outros).toBe("Outros"); });
  });
});
