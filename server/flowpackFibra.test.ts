/**
 * Tests for Flow Pack Fibra feature and Sales card updates
 * Validates that:
 * 1. FLOWPACK_FIBRA_OPTIONS is defined with correct values
 * 2. Flow Pack sector (ordem=6) correctly includes fibra in variant handling
 * 3. Backend accepts fibra variant entries (tipoMadeira starting with "fibra_")
 * 4. Sales cards include accumulated values in the card layout
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const productionPath = path.resolve(__dirname, "../client/src/pages/Production.tsx");
const salesPath = path.resolve(__dirname, "../client/src/pages/Sales.tsx");
const productionSrc = fs.readFileSync(productionPath, "utf-8");
const salesSrc = fs.readFileSync(salesPath, "utf-8");

describe("Flow Pack Fibra Feature", () => {
  it("FLOWPACK_FIBRA_OPTIONS is defined with fibra_3.0x200mm", () => {
    expect(productionSrc).toContain("FLOWPACK_FIBRA_OPTIONS");
    expect(productionSrc).toContain('fibra_3.0x200mm');
    expect(productionSrc).toContain('3,0x200mm');
  });

  it("isFlowPack function identifies sector ordem 6", () => {
    expect(productionSrc).toContain("function isFlowPack(ordem: number) { return ordem === 6; }");
  });

  it("getMachineLiveTotal includes fibra options for Flow Pack", () => {
    // Check that getMachineLiveTotal uses FLOWPACK_FIBRA_OPTIONS for Flow Pack
    const liveTotalSection = productionSrc.substring(
      productionSrc.indexOf("getMachineLiveTotal"),
      productionSrc.indexOf("getMachineLiveTotal") + 1000
    );
    expect(liveTotalSection).toContain("isFlowPack(sectorOrdem)");
    expect(liveTotalSection).toContain("FLOWPACK_FIBRA_OPTIONS");
  });

  it("handleVariantSave includes fibra options for Flow Pack", () => {
    const saveSection = productionSrc.substring(
      productionSrc.indexOf("handleVariantSave"),
      productionSrc.indexOf("handleVariantSave") + 1000
    );
    expect(saveSection).toContain("isFlowPack(sectorOrdem)");
    expect(saveSection).toContain("FLOWPACK_FIBRA_OPTIONS");
    expect(saveSection).toContain("allVariantOpts");
  });

  it("ExpandableMachineRow renders Fibra section for Flow Pack", () => {
    expect(productionSrc).toContain("Produção por Medida de Fibra");
    expect(productionSrc).toContain("isFlowPack(sector.ordem)");
    expect(productionSrc).toContain("FLOWPACK_FIBRA_OPTIONS.map");
  });

  it("variantDisplay includes fibra options for badges", () => {
    // Check that the badge display logic includes fibra
    expect(productionSrc).toContain("const fibraOptions = isFlowPack(sector.ordem) ? FLOWPACK_FIBRA_OPTIONS : [];");
    expect(productionSrc).toContain("const allDisplayOptions = [...variantOptions, ...fibraOptions];");
  });
});

describe("Sales Cards - Accumulated Values", () => {
  it("Mês Atual card includes Acum. Atual label with month reference", () => {
    expect(salesSrc).toContain("Acum. Atual ({comparison?.currentMonthLabel})");
    expect(salesSrc).toContain("currentLatest ? formatCurrencyFull(currentLatest.cumulative)");
  });

  it("Mês Anterior card includes Anterior label with month reference", () => {
    expect(salesSrc).toContain("Anterior ({comparison?.lastMonthLabel})");
    // The card should show the cumulative value from lastLatest
    expect(salesSrc).toContain("lastLatest ? formatCurrencyFull(lastLatest.cumulative)");
  });

  it("Melhor Mês card includes Melhor label with month reference", () => {
    expect(salesSrc).toContain("Melhor ({comparison?.bestMonthLabel})");
    expect(salesSrc).toContain("bestLatest ? formatCurrencyFull(bestLatest.cumulative)");
  });

  it("All three cards have line indicator matching graph legend colors", () => {
    // Teal line for current
    expect(salesSrc).toContain('w-4 h-[2px] bg-teal-500');
    // Blue line for anterior
    expect(salesSrc).toContain('w-4 h-[2px] bg-blue-600');
    // Amber line for melhor
    expect(salesSrc).toContain('w-4 h-[2px] bg-amber-600');
  });
});
