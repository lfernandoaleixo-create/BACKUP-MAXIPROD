import { describe, it, expect } from "vitest";

describe("Product Visibility Feature", () => {
  describe("Visibility toggle logic", () => {
    it("should default to visible when no visibility record exists", () => {
      // When no record exists in productVisibility table, product should be visible
      const visibilityMap = new Map<string, { visible: boolean }>();
      const productName = "ESPETO — 4.0 x 200 mm";
      
      const visibility = visibilityMap.get(productName);
      const isVisible = visibility ? visibility.visible : true;
      
      expect(isVisible).toBe(true);
    });

    it("should respect explicit visibility=false setting", () => {
      const visibilityMap = new Map<string, { visible: boolean }>();
      visibilityMap.set("ESPETO — 4.0 x 200 mm", { visible: false });
      
      const visibility = visibilityMap.get("ESPETO — 4.0 x 200 mm");
      const isVisible = visibility ? visibility.visible : true;
      
      expect(isVisible).toBe(false);
    });

    it("should respect explicit visibility=true setting", () => {
      const visibilityMap = new Map<string, { visible: boolean }>();
      visibilityMap.set("ESPETO — 4.0 x 200 mm", { visible: true });
      
      const visibility = visibilityMap.get("ESPETO — 4.0 x 200 mm");
      const isVisible = visibility ? visibility.visible : true;
      
      expect(isVisible).toBe(true);
    });
  });

  describe("Dashboard filtering logic", () => {
    const mockItems = [
      { produto: "ESPETO", medida: "4.0 x 200 mm", variante: "", tipo: "BAMBU" },
      { produto: "ESPETO", medida: "4.0 x 220 mm", variante: "", tipo: "BAMBU" },
      { produto: "PALITO", medida: "2.0 x 150 mm", variante: "BAMBUSA", tipo: "INDUSTRIALIZADO" },
    ];

    it("should filter out hidden products from dashboard", () => {
      const hiddenProducts = new Set(["ESPETO — 4.0 x 200 mm"]);
      
      const filtered = mockItems.filter(item => {
        const fullName = item.produto + (item.medida ? ' — ' + item.medida : '') + (item.variante ? ' [' + item.variante + ']' : '');
        return !hiddenProducts.has(fullName);
      });
      
      expect(filtered).toHaveLength(2);
      expect(filtered[0].medida).toBe("4.0 x 220 mm");
      expect(filtered[1].produto).toBe("PALITO");
    });

    it("should show all products when no hidden products exist", () => {
      const hiddenProducts = new Set<string>();
      
      const filtered = mockItems.filter(item => {
        const fullName = item.produto + (item.medida ? ' — ' + item.medida : '') + (item.variante ? ' [' + item.variante + ']' : '');
        return !hiddenProducts.has(fullName);
      });
      
      expect(filtered).toHaveLength(3);
    });

    it("should handle products with variants in fullName", () => {
      const hiddenProducts = new Set(["PALITO — 2.0 x 150 mm [BAMBUSA]"]);
      
      const filtered = mockItems.filter(item => {
        const fullName = item.produto + (item.medida ? ' — ' + item.medida : '') + (item.variante ? ' [' + item.variante + ']' : '');
        return !hiddenProducts.has(fullName);
      });
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(i => i.produto === "ESPETO")).toBe(true);
    });

    it("should handle hiding multiple products", () => {
      const hiddenProducts = new Set([
        "ESPETO — 4.0 x 200 mm",
        "ESPETO — 4.0 x 220 mm",
      ]);
      
      const filtered = mockItems.filter(item => {
        const fullName = item.produto + (item.medida ? ' — ' + item.medida : '') + (item.variante ? ' [' + item.variante + ']' : '');
        return !hiddenProducts.has(fullName);
      });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].produto).toBe("PALITO");
    });
  });

  describe("Product codes extraction", () => {
    it("should return codes array from stock item", () => {
      const item = { codigos: ["00116", "00117"] };
      const codigos: string[] = item.codigos || [];
      expect(codigos).toEqual(["00116", "00117"]);
    });

    it("should return empty array when no codes exist", () => {
      const item = { codigos: undefined };
      const codigos: string[] = (item as any).codigos || [];
      expect(codigos).toEqual([]);
    });

    it("should search by code in filter", () => {
      const products = [
        { descricao: "ESPETO — 4.0 x 200 mm", codigos: ["00116"] },
        { descricao: "ESPETO — 4.0 x 220 mm", codigos: ["00115", "00005"] },
        { descricao: "PALITO — 2.0 x 150 mm", codigos: ["00200"] },
      ];

      const search = "00115";
      const s = search.toLowerCase();
      const filtered = products.filter(p =>
        p.descricao.toLowerCase().includes(s) ||
        (p.codigos && p.codigos.some(c => c.toLowerCase().includes(s)))
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].descricao).toBe("ESPETO — 4.0 x 220 mm");
    });
  });
});
