import { describe, it, expect } from "vitest";
import { normalizeForSearch, flexMatch, flexMatchMultiple } from "../shared/flexSearch";

describe("normalizeForSearch", () => {
  it("removes accents", () => {
    expect(normalizeForSearch("Jordão")).toBe("jordao");
    expect(normalizeForSearch("São Paulo")).toBe("sao paulo");
    expect(normalizeForSearch("Lívia")).toBe("livia");
  });

  it("removes punctuation", () => {
    expect(normalizeForSearch("G.Atacado")).toBe("gatacado");
    expect(normalizeForSearch("Beta-Rio")).toBe("betario");
    expect(normalizeForSearch("12.345.678/0001-90")).toBe("12345678000190");
  });

  it("normalizes spaces", () => {
    expect(normalizeForSearch("  hello   world  ")).toBe("hello world");
  });

  it("handles empty/null", () => {
    expect(normalizeForSearch("")).toBe("");
    expect(normalizeForSearch(null as any)).toBe("");
  });
});

describe("flexMatch", () => {
  it("finds partial match anywhere", () => {
    expect(flexMatch("Beta Rio Alimentos", "rio")).toBe(true);
    expect(flexMatch("Beta Rio Alimentos", "beta")).toBe(true);
    expect(flexMatch("Beta Rio Alimentos", "alim")).toBe(true);
  });

  it("ignores accents in search", () => {
    expect(flexMatch("Jordão Line", "jordao")).toBe(true);
    expect(flexMatch("Jordao Line", "jordão")).toBe(true);
  });

  it("ignores dots and special chars", () => {
    expect(flexMatch("G.Atacado", "G Atacado")).toBe(true);
    expect(flexMatch("G. Atacado", "gatacado")).toBe(true);
  });

  it("multi-word search matches all words", () => {
    expect(flexMatch("Beta Rio Alimentos LTDA", "beta alimentos")).toBe(true);
    expect(flexMatch("Beta Rio Alimentos LTDA", "beta xyz")).toBe(false);
  });

  it("returns true for empty search", () => {
    expect(flexMatch("anything", "")).toBe(true);
  });

  it("returns false for empty text", () => {
    expect(flexMatch("", "something")).toBe(false);
  });
});

describe("flexMatchMultiple", () => {
  it("matches across multiple fields", () => {
    expect(flexMatchMultiple(["00541", "Espeto Bambu"], "espeto")).toBe(true);
    expect(flexMatchMultiple(["00541", "Espeto Bambu"], "541")).toBe(true);
    expect(flexMatchMultiple(["00541", "Espeto Bambu"], "bambu")).toBe(true);
  });

  it("handles null/undefined fields", () => {
    expect(flexMatchMultiple([null, undefined, "Produto X"], "produto")).toBe(true);
  });

  it("returns true for empty search", () => {
    expect(flexMatchMultiple(["abc", "def"], "")).toBe(true);
  });

  it("CNPJ search works", () => {
    expect(flexMatchMultiple(["12.345.678/0001-90", "Empresa X"], "12345")).toBe(true);
    expect(flexMatchMultiple(["12.345.678/0001-90", "Empresa X"], "0001")).toBe(true);
  });
});
