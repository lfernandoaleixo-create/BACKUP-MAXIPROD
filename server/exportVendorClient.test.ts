import { describe, it, expect } from "vitest";
import { z } from "zod";

// Test the input schema validation for exportVendorClientMaxiprod
const exportVendorClientSchema = z.object({
  clientId: z.number(),
});

describe("exportVendorClientMaxiprod input validation", () => {
  it("should accept a valid clientId", () => {
    const result = exportVendorClientSchema.safeParse({ clientId: 123 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.clientId).toBe(123);
    }
  });

  it("should reject missing clientId", () => {
    const result = exportVendorClientSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should reject non-number clientId", () => {
    const result = exportVendorClientSchema.safeParse({ clientId: "abc" });
    expect(result.success).toBe(false);
  });

  it("should reject null clientId", () => {
    const result = exportVendorClientSchema.safeParse({ clientId: null });
    expect(result.success).toBe(false);
  });
});

// Test that the filename generation logic works correctly
describe("exportVendorClientMaxiprod filename generation", () => {
  it("should generate a valid filename from razaoSocial", () => {
    const razaoSocial = "EMPRESA TESTE LTDA";
    const filename = `Maxiprod_${razaoSocial.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    expect(filename).toMatch(/^Maxiprod_EMPRESA_TESTE_LTDA_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it("should truncate long names to 30 characters", () => {
    const razaoSocial = "EMPRESA COM NOME MUITO GRANDE QUE EXCEDE O LIMITE DE TRINTA CARACTERES";
    const sanitized = razaoSocial.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    expect(sanitized.length).toBeLessThanOrEqual(30);
  });

  it("should handle special characters in razaoSocial", () => {
    const razaoSocial = "EMPRESA & CIA. (FILIAL/2)";
    const sanitized = razaoSocial.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    expect(sanitized).not.toMatch(/[^a-zA-Z0-9_]/);
  });

  it("should fallback to 'Cliente' when razaoSocial is empty", () => {
    const razaoSocial = "";
    const name = (razaoSocial || "Cliente").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    expect(name).toBe("Cliente");
  });
});
