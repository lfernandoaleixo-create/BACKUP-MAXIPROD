import { describe, it, expect } from "vitest";
import { parseDimensions } from "../shared/parseDimensions";

describe("parseDimensions", () => {
  describe("returns null for invalid input", () => {
    it("null", () => expect(parseDimensions(null)).toBeNull());
    it("undefined", () => expect(parseDimensions(undefined)).toBeNull());
    it("empty string", () => expect(parseDimensions("")).toBeNull());
    it("whitespace", () => expect(parseDimensions("   ")).toBeNull());
    it("no dimensions", () => expect(parseDimensions("some text")).toBeNull());
  });

  describe("MILLIMETERS - 3+ digit integer part (>=100) -> divide by 10", () => {
    it("415x280x405 -> 41.5 x 28.0 x 40.5 cm", () => {
      const result = parseDimensions("415x280x405");
      expect(result).toEqual({ comprimento: 41.5, largura: 28, altura: 40.5 });
    });

    it("420x330x280 -> 42.0 x 33.0 x 28.0 cm", () => {
      const result = parseDimensions("420x330x280");
      expect(result).toEqual({ comprimento: 42, largura: 33, altura: 28 });
    });

    it("450x290x230 -> 45.0 x 29.0 x 23.0 cm", () => {
      const result = parseDimensions("450x290x230");
      expect(result).toEqual({ comprimento: 45, largura: 29, altura: 23 });
    });

    it("415X230X380 (uppercase) -> 41.5 x 23.0 x 38.0 cm", () => {
      const result = parseDimensions("415X230X380");
      expect(result).toEqual({ comprimento: 41.5, largura: 23, altura: 38 });
    });

    it("215 x 280 x 405 (with spaces) -> 21.5 x 28.0 x 40.5 cm", () => {
      const result = parseDimensions("215 x 280 x 405");
      expect(result).toEqual({ comprimento: 21.5, largura: 28, altura: 40.5 });
    });

    it("C=415, L=280, A=405 (CLA format) -> 41.5 x 28.0 x 40.5 cm", () => {
      const result = parseDimensions("C=415, L=280, A=405");
      expect(result).toEqual({ comprimento: 41.5, largura: 28, altura: 40.5 });
    });
  });

  describe("CENTIMETERS - 1-2 digit integer part (<100) -> use as-is", () => {
    it("42X24X39 -> 42 x 24 x 39 cm", () => {
      const result = parseDimensions("42X24X39");
      expect(result).toEqual({ comprimento: 42, largura: 24, altura: 39 });
    });

    it("45,5X13,5X29,5 (comma decimals) -> 45.5 x 13.5 x 29.5 cm", () => {
      const result = parseDimensions("45,5X13,5X29,5");
      expect(result).toEqual({ comprimento: 45.5, largura: 13.5, altura: 29.5 });
    });

    it("41.5x28x40 -> 41.5 x 28 x 40 cm", () => {
      const result = parseDimensions("41.5x28x40");
      expect(result).toEqual({ comprimento: 41.5, largura: 28, altura: 40 });
    });

    it("C=42, L=28, A=19 -> 42 x 28 x 19 cm", () => {
      const result = parseDimensions("C=42, L=28, A=19");
      expect(result).toEqual({ comprimento: 42, largura: 28, altura: 19 });
    });

    it("C=42, L = 32,5, A =20 -> 42 x 32.5 x 20 cm", () => {
      const result = parseDimensions("C=42, L = 32,5, A =20");
      expect(result).toEqual({ comprimento: 42, largura: 32.5, altura: 20 });
    });

    it("C43 L31 H19 -> 43 x 31 x 19 cm", () => {
      const result = parseDimensions("C43 L31 H19");
      expect(result).toEqual({ comprimento: 43, largura: 31, altura: 19 });
    });

    it("42 30 20 (space separated) -> 42 x 30 x 20 cm", () => {
      const result = parseDimensions("42 30 20");
      expect(result).toEqual({ comprimento: 42, largura: 30, altura: 20 });
    });
  });

  describe("METERS - all values < 1 (0.xxx) -> multiply by 100", () => {
    it("0,415x0,28x0,4 -> 41.5 x 28 x 40 cm", () => {
      const result = parseDimensions("0,415x0,28x0,4");
      expect(result).toEqual({ comprimento: 41.5, largura: 28, altura: 40 });
    });

    it("0.42x0.28x0.40 -> 42 x 28 x 40 cm", () => {
      const result = parseDimensions("0.42x0.28x0.40");
      expect(result).toEqual({ comprimento: 42, largura: 28, altura: 40 });
    });

    it("0.45x0.29x0.23 -> 45 x 29 x 23 cm", () => {
      const result = parseDimensions("0.45x0.29x0.23");
      expect(result).toEqual({ comprimento: 45, largura: 29, altura: 23 });
    });
  });

  describe("edge cases", () => {
    it("99x99x99 -> cm (2 digits, stays as-is)", () => {
      const result = parseDimensions("99x99x99");
      expect(result).toEqual({ comprimento: 99, largura: 99, altura: 99 });
    });

    it("100x100x100 -> mm (3 digits, divide by 10)", () => {
      const result = parseDimensions("100x100x100");
      expect(result).toEqual({ comprimento: 10, largura: 10, altura: 10 });
    });

    it("mixed: 50x200x30 -> mm because 200 >= 100", () => {
      // If ANY dimension has 3+ digits, all are treated as mm
      const result = parseDimensions("50x200x30");
      expect(result).toEqual({ comprimento: 5, largura: 20, altura: 3 });
    });
  });
});
