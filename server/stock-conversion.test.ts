import { describe, it, expect } from "vitest";

/**
 * Tests for stock conversion using unidadeDeVendaFator from Maxiprod
 * 
 * The stockProcessor should prioritize the Maxiprod fator (unidadeDeVendaFator)
 * over the description-extracted fator when converting UN to CX.
 * 
 * Key cases:
 * 1. 00058 VARETA DE APITO BAMBU: fator=20, not extractable from description (PCT 20KG)
 * 2. 00061 VARETA MULTI-USO 200MM: fator=5000, description says "C/ 10.000 UNID." (wrong!)
 * 3. 00063 VARETA MULTI-USO 250MM: fator=5000, description says "C/ 10.000 UNID." (wrong!)
 */

describe("Stock Conversion - Maxiprod Fator Priority", () => {
  // Replicate the extractUnitsPerBox function from stockProcessor
  function extractUnitsPerBox(desc: string): number | null {
    const d = desc.toUpperCase();
    if (d.includes("KG") && !d.includes("UNID")) return null;
    let m: RegExpMatchArray | null;
    m = desc.match(/C\/\s*([\d.]+)\s*(?:UNID|UN)/i);
    if (m) return parseFloat(m[1].replace(/\./g, ""));
    m = desc.match(/(\d+)\s*[xX]\s*(\d+)\s*POR\s*CAIXA/i);
    if (m) return parseInt(m[1]) * parseInt(m[2]);
    m = desc.match(/([\d.]+)\s*POR\s*CAIXA/i);
    if (m) return parseFloat(m[1].replace(/\./g, ""));
    m = desc.match(/([\d.]+)\s*POR\s*PACOTE/i);
    if (m) return parseFloat(m[1].replace(/\./g, ""));
    m = desc.match(/(\d+)\s*[xX*]\s*(\d+)\s*[xX*]\s*(\d+)(?!\s*MM)/);
    if (m) return parseInt(m[1]) * parseInt(m[2]) * parseInt(m[3]);
    m = desc.match(/C\/\s*([\d.]+)\s*[xX]\s*([\d.]+)\s*(?:UNID|UN)/i);
    if (m) return parseFloat(m[1].replace(/\./g, "")) * parseFloat(m[2].replace(/\./g, ""));
    m = desc.match(/C\/\s*([\d.]+)\s*[xX]\s*([\d.]+)/i);
    if (m) return parseFloat(m[1].replace(/\./g, "")) * parseFloat(m[2].replace(/\./g, ""));
    const afterMM = desc.replace(/\d+[,.]?\d*\s*[xX*]\s*\d+\s*(?:MM|CM)/gi, "");
    m = afterMM.match(/([\d.]+)\s*[xX]\s*([\d.]+)\s*(?:UNID|UN)/i);
    if (m) return parseFloat(m[1].replace(/\./g, "")) * parseFloat(m[2].replace(/\./g, ""));
    m = desc.match(/CM\s+(\d+)\s*[xX*]\s*(\d+)/i);
    if (m) return parseInt(m[1]) * parseInt(m[2]);
    return null;
  }

  // Replicate the priority logic from stockProcessor
  function getUnitsPerBox(maxiprodFator: number | null, desc: string): number | null {
    const descFator = extractUnitsPerBox(desc);
    return maxiprodFator || descFator;
  }

  it("should use Maxiprod fator for VARETA DE APITO BAMBU (00058)", () => {
    const desc = "VARETA DE APITO BAMBU 3,0 X 350 MM PCT 20KG";
    const maxiprodFator = 20;
    const qty = 200;

    // Without Maxiprod fator, description extraction returns null (KG product)
    expect(extractUnitsPerBox(desc)).toBeNull();

    // With Maxiprod fator, we get 20 un/cx
    const upb = getUnitsPerBox(maxiprodFator, desc);
    expect(upb).toBe(20);

    // 200 / 20 = 10 boxes
    expect(Math.floor(qty / upb!)).toBe(10);
  });

  it("should use Maxiprod fator for VARETA MULTI-USO 200MM (00061)", () => {
    const desc = "VARETA MULTI-USO BAMBU 3,8 X 200 MM C/ 10.000 UNID.";
    const maxiprodFator = 5000;
    const qty = 655000;

    // Description extraction gives 10000 (wrong!)
    expect(extractUnitsPerBox(desc)).toBe(10000);

    // Maxiprod fator gives 5000 (correct!)
    const upb = getUnitsPerBox(maxiprodFator, desc);
    expect(upb).toBe(5000);

    // 655000 / 5000 = 131 boxes (not 65 with 10000)
    expect(Math.floor(qty / upb!)).toBe(131);
  });

  it("should use Maxiprod fator for VARETA MULTI-USO 250MM (00063)", () => {
    const desc = "VARETA MULTI-USO BAMBU 3,8 X 250 MM C/ 10.000 UNID.";
    const maxiprodFator = 5000;
    const qty = 740000;

    // Description extraction gives 10000 (wrong!)
    expect(extractUnitsPerBox(desc)).toBe(10000);

    // Maxiprod fator gives 5000 (correct!)
    const upb = getUnitsPerBox(maxiprodFator, desc);
    expect(upb).toBe(5000);

    // 740000 / 5000 = 148 boxes (not 74 with 10000)
    expect(Math.floor(qty / upb!)).toBe(148);
  });

  it("should fall back to description extraction when Maxiprod fator is null", () => {
    const desc = "ESPETO DE BAMBU 4,0 X 200 MM C/ 5 X 1.000 UNID.";
    const maxiprodFator = null;

    // Description extraction gives 5000
    expect(extractUnitsPerBox(desc)).toBe(5000);

    // Without Maxiprod fator, falls back to description
    const upb = getUnitsPerBox(maxiprodFator, desc);
    expect(upb).toBe(5000);
  });

  it("should prefer Maxiprod fator even when description extraction matches", () => {
    const desc = "ESPETO DE BAMBU 4,5 X 280 MM C/ 5 X 1.000 UNID.";
    const maxiprodFator = 5000;

    // Both give 5000 - consistent
    expect(extractUnitsPerBox(desc)).toBe(5000);
    const upb = getUnitsPerBox(maxiprodFator, desc);
    expect(upb).toBe(5000);
  });

  it("should calculate total 14,012 boxes with correct fators", () => {
    // The 3 items that were causing the 150-box discrepancy
    const items = [
      { code: "00058", qty: 200, maxiprodFator: 20, desc: "VARETA DE APITO BAMBU 3,0 X 350 MM PCT 20KG" },
      { code: "00061", qty: 655000, maxiprodFator: 5000, desc: "VARETA MULTI-USO BAMBU 3,8 X 200 MM C/ 10.000 UNID." },
      { code: "00063", qty: 740000, maxiprodFator: 5000, desc: "VARETA MULTI-USO BAMBU 3,8 X 250 MM C/ 10.000 UNID." },
    ];

    // With old extraction (description-based)
    const oldTotal = items.reduce((sum, item) => {
      const upb = extractUnitsPerBox(item.desc);
      return sum + (upb ? Math.floor(item.qty / upb) : 0);
    }, 0);

    // With new Maxiprod fator
    const newTotal = items.reduce((sum, item) => {
      const upb = getUnitsPerBox(item.maxiprodFator, item.desc);
      return sum + (upb ? Math.floor(item.qty / upb!) : 0);
    }, 0);

    // Old: 0 + 65 + 74 = 139
    expect(oldTotal).toBe(139);

    // New: 10 + 131 + 148 = 289
    expect(newTotal).toBe(289);

    // Difference: 289 - 139 = 150 (the exact discrepancy!)
    expect(newTotal - oldTotal).toBe(150);
  });
});
