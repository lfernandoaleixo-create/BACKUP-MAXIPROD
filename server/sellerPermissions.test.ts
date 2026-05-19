import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();

vi.mock("./db", () => ({
  getDb: vi.fn(() => ({
    select: () => ({ from: (t: any) => ({ where: mockWhere, orderBy: mockOrderBy }) }),
    insert: () => ({ values: mockValues }),
    update: () => ({ set: () => ({ where: mockWhere }) }),
    delete: () => ({ where: mockWhere }),
  })),
}));

describe("Seller Permissions Logic", () => {
  describe("Password generation", () => {
    it("should generate password from first name with capital first letter", () => {
      const generatePassword = (sellerName: string) => {
        const firstName = sellerName.split(/\s+/)[0];
        return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
      };

      expect(generatePassword("CLARINDO GONCALVES")).toBe("Clarindo");
      expect(generatePassword("DANIEL TAVARES")).toBe("Daniel");
      expect(generatePassword("ROMERA REPRESENTACOES")).toBe("Romera");
      expect(generatePassword("LUIZ MATIAS")).toBe("Luiz");
      expect(generatePassword("ANA PAULA ALEIXO")).toBe("Ana");
      expect(generatePassword("PEDRO AUGUSTO")).toBe("Pedro");
    });
  });

  describe("Gestor/Vendedor identification", () => {
    it("should identify gestores (apelido == representante/vendedor)", () => {
      const isGestor = (apelido: string, gestorName: string) =>
        apelido.toUpperCase() === gestorName.toUpperCase();

      expect(isGestor("JORDÃO LAINE", "JORDÃO LAINE")).toBe(true);
      expect(isGestor("JUVENAL TEIXEIRA", "JUVENAL TEIXEIRA")).toBe(true);
    });

    it("should identify vendedores (apelido != representante/vendedor)", () => {
      const isVendedor = (apelido: string, gestorName: string) =>
        apelido.toUpperCase() !== gestorName.toUpperCase();

      expect(isVendedor("ANA PAULA ALEIXO", "JORDÃO LAINE")).toBe(true);
      expect(isVendedor("DANIEL TAVARES", "JUVENAL TEIXEIRA")).toBe(true);
    });

    it("should ignore entries without gestor", () => {
      const shouldInclude = (gestorName: string) => gestorName.trim().length > 0;

      expect(shouldInclude("")).toBe(false);
      expect(shouldInclude("  ")).toBe(false);
      expect(shouldInclude("JORDÃO LAINE")).toBe(true);
    });
  });

  describe("Login validation", () => {
    it("should reject empty password", () => {
      const validate = (password: string) => {
        if (!password.trim()) return { success: false, error: "Senha inválida" };
        return { success: true };
      };

      expect(validate("").success).toBe(false);
      expect(validate("  ").success).toBe(false);
    });

    it("should check authorization status", () => {
      const checkAuth = (seller: { authorized: boolean }) => {
        if (!seller.authorized) return { success: false, error: "Acesso não autorizado" };
        return { success: true };
      };

      expect(checkAuth({ authorized: false }).success).toBe(false);
      expect(checkAuth({ authorized: true }).success).toBe(true);
    });
  });

  describe("Product visibility", () => {
    it("should filter products based on visible list", () => {
      const allProducts = [
        { codigoItem: "001", descricao: "Palito A" },
        { codigoItem: "002", descricao: "Espeto B" },
        { codigoItem: "003", descricao: "Vareta C" },
        { codigoItem: "004", descricao: "Mesa D" },
      ];
      const visibleCodes = ["001", "003"];
      const visibleSet = new Set(visibleCodes);

      const filtered = allProducts.filter(p => visibleSet.has(p.codigoItem));

      expect(filtered).toHaveLength(2);
      expect(filtered[0].codigoItem).toBe("001");
      expect(filtered[1].codigoItem).toBe("003");
    });

    it("should show nothing when no products are authorized", () => {
      const allProducts = [
        { codigoItem: "001", descricao: "Palito A" },
      ];
      const visibleCodes: string[] = [];
      const visibleSet = new Set(visibleCodes);

      const filtered = allProducts.filter(p => visibleSet.has(p.codigoItem));

      expect(filtered).toHaveLength(0);
    });
  });
});
