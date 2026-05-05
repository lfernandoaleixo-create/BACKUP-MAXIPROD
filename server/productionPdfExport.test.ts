import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock jsPDF and autoTable before importing the module
const mockDoc = {
  internal: {
    pageSize: {
      getWidth: () => 297,
      getHeight: () => 210,
    },
    getNumberOfPages: () => 1,
  },
  setFillColor: vi.fn(),
  setTextColor: vi.fn(),
  setFontSize: vi.fn(),
  setFont: vi.fn(),
  setDrawColor: vi.fn(),
  rect: vi.fn(),
  roundedRect: vi.fn(),
  text: vi.fn(),
  addImage: vi.fn(),
  setPage: vi.fn(),
  splitTextToSize: vi.fn((text: string) => [text]),
  getTextWidth: vi.fn(() => 40),
  setLineWidth: vi.fn(),
  line: vi.fn(),
  addPage: vi.fn(),
  save: vi.fn(),
  lastAutoTable: { finalY: 80 },
};

vi.mock("jspdf", () => ({
  default: vi.fn(() => mockDoc),
}));

vi.mock("jspdf-autotable", () => ({
  default: vi.fn(),
}));

// Mock fetch for logo loading
global.fetch = vi.fn(() =>
  Promise.resolve({
    blob: () => Promise.resolve(new Blob(["fake-image"], { type: "image/png" })),
  })
) as any;

// Mock FileReader for base64 conversion
class MockFileReader {
  result: string = "data:image/png;base64,fakebase64";
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL() {
    setTimeout(() => this.onloadend?.(), 0);
  }
}
(global as any).FileReader = MockFileReader;

// ─── Sample data ───
const sampleSectors = [
  { id: 1, nome: "Multilamina", ordem: 1, unidadeMedida: "pç", unidadeLabel: "peças", machines: [{ id: 10, nome: "Máquina 1", ordem: 1 }, { id: 11, nome: "Máquina 2", ordem: 2 }] },
  { id: 2, nome: "Vareteira", ordem: 2, unidadeMedida: "saco", unidadeLabel: "sacos", machines: [{ id: 20, nome: "Máquina 1", ordem: 1 }] },
  { id: 3, nome: "Seletora Toco", ordem: 3, unidadeMedida: "saco", unidadeLabel: "sacos", machines: [] },
];

const sampleDailyEntries = [
  { id: 1, sectorId: 1, machineId: 10, data: "2026-04-28", quantidade: "150", status: "producao_normal", tipoMadeira: "benazzi", observacoes: "Tudo ok", lancadoPor: "Maria" },
  { id: 2, sectorId: 1, machineId: 10, data: "2026-04-28", quantidade: "80", status: "producao_normal", tipoMadeira: "madeira_dura", observacoes: null, lancadoPor: "Maria" },
  { id: 3, sectorId: 1, machineId: 11, data: "2026-04-28", quantidade: "120", status: "producao_normal", tipoMadeira: "benazzi", observacoes: null, lancadoPor: "Maria" },
  { id: 4, sectorId: 2, machineId: 20, data: "2026-04-28", quantidade: "45", status: "producao_normal", tipoMadeira: "3.8x200mm_saco", observacoes: "Faltou material", lancadoPor: "Maria" },
];

const sampleWeeklyEntries = [
  ...sampleDailyEntries,
  { id: 5, sectorId: 1, machineId: 10, data: "2026-04-29", quantidade: "200", status: "producao_normal", tipoMadeira: "benazzi", observacoes: null, lancadoPor: "Maria" },
  { id: 6, sectorId: 2, machineId: 20, data: "2026-04-29", quantidade: "60", status: "manutencao_pontual", tipoMadeira: "3.8x200mm_saco", observacoes: null, lancadoPor: "Maria" },
];

describe("Production PDF Export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateDailyPdf", () => {
    it("should generate a daily PDF with correct filename", async () => {
      const { generateDailyPdf } = await import("@/lib/productionPdfExport");
      const jsPDF = (await import("jspdf")).default;

      await generateDailyPdf(sampleSectors as any, sampleDailyEntries as any, "2026-04-28");

      // jsPDF constructor should have been called with landscape A4
      expect(jsPDF).toHaveBeenCalledWith({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // save should have been called with correct filename
      expect(mockDoc.save).toHaveBeenCalledWith("Producao_Diario_20260428.pdf");
    });

    it("should draw sector cards with text for each sector", async () => {
      const { generateDailyPdf } = await import("@/lib/productionPdfExport");

      await generateDailyPdf(sampleSectors as any, sampleDailyEntries as any, "2026-04-28");

      // Should draw text for sector names (roundedRect for card backgrounds + text for sector names)
      expect(mockDoc.roundedRect).toHaveBeenCalled();
      expect(mockDoc.text).toHaveBeenCalled();

      // Verify sector names appear in text calls
      const textCalls = mockDoc.text.mock.calls.map((c: any) => c[0]);
      expect(textCalls.some((t: string) => t.includes("Multilamina"))).toBe(true);
      expect(textCalls.some((t: string) => t.includes("Vareteira"))).toBe(true);
    });

    it("should handle empty entries gracefully", async () => {
      const { generateDailyPdf } = await import("@/lib/productionPdfExport");

      // Should not throw with empty entries
      await expect(generateDailyPdf(sampleSectors as any, [], "2026-04-28")).resolves.not.toThrow();
    });

    it("should show TOTAL text for each sector card", async () => {
      const { generateDailyPdf } = await import("@/lib/productionPdfExport");

      await generateDailyPdf(sampleSectors as any, sampleDailyEntries as any, "2026-04-28");

      const textCalls = mockDoc.text.mock.calls.map((c: any) => c[0]);
      // Each sector card should have a TOTAL label
      const totalCount = textCalls.filter((t: string) => t === "TOTAL:").length;
      expect(totalCount).toBe(sampleSectors.length);
    });
  });

  describe("generateWeeklyPdf", () => {
    it("should generate a weekly PDF with correct filename", async () => {
      const { generateWeeklyPdf } = await import("@/lib/productionPdfExport");

      await generateWeeklyPdf(sampleSectors as any, sampleWeeklyEntries as any, "2026-04-27", "2026-05-03");

      expect(mockDoc.save).toHaveBeenCalledWith("Producao_Semanal_20260427_20260503.pdf");
    });

    it("should draw sector cards with machine totals", async () => {
      const { generateWeeklyPdf } = await import("@/lib/productionPdfExport");

      await generateWeeklyPdf(sampleSectors as any, sampleWeeklyEntries as any, "2026-04-27", "2026-05-03");

      // Should draw rounded rects for cards
      expect(mockDoc.roundedRect).toHaveBeenCalled();
      // Should show TOTAL for each sector
      const textCalls = mockDoc.text.mock.calls.map((c: any) => c[0]);
      const totalCount = textCalls.filter((t: string) => t === "TOTAL:").length;
      expect(totalCount).toBe(sampleSectors.length);
    });

    it("should show monthly averages when monthlyAverages is provided", async () => {
      const { generateWeeklyPdf } = await import("@/lib/productionPdfExport");

      const monthlyAverages = [
        { sectorId: 1, mediaDiaria: 350 },
        { sectorId: 2, mediaDiaria: 80 },
      ];

      await generateWeeklyPdf(sampleSectors as any, sampleWeeklyEntries as any, "2026-04-27", "2026-05-03", monthlyAverages);

      // Should render "M\u00e9dia M\u00eas:" label (bold, prominent)
      const textCalls = mockDoc.text.mock.calls.map((c: any) => c[0]);
      const monthlyLabels = textCalls.filter((t: string) => typeof t === "string" && t.includes("M\u00e9dia M\u00eas"));
      // Sectors with monthlyAverages should have the label
      expect(monthlyLabels.length).toBeGreaterThan(0);
    });

    it("should show weekly average when no monthlyAverages provided", async () => {
      const { generateWeeklyPdf } = await import("@/lib/productionPdfExport");

      await generateWeeklyPdf(sampleSectors as any, sampleWeeklyEntries as any, "2026-04-27", "2026-05-03");

      // Should render "M\u00e9dia Semana:" label for sectors with entries
      const textCalls = mockDoc.text.mock.calls.map((c: any) => c[0]);
      const weeklyLabels = textCalls.filter((t: string) => typeof t === "string" && t.includes("M\u00e9dia Semana"));
      expect(weeklyLabels.length).toBeGreaterThan(0);
    });
  });

  describe("generateMonthlyPdf", () => {
    it("should generate a monthly PDF with correct filename", async () => {
      const { generateMonthlyPdf } = await import("@/lib/productionPdfExport");

      await generateMonthlyPdf(sampleSectors as any, sampleWeeklyEntries as any, "2026-04");

      expect(mockDoc.save).toHaveBeenCalledWith("Producao_Mensal_202604.pdf");
    });

    it("should draw sector cards for monthly report", async () => {
      const { generateMonthlyPdf } = await import("@/lib/productionPdfExport");

      await generateMonthlyPdf(sampleSectors as any, sampleWeeklyEntries as any, "2026-04");

      // Should draw rounded rects for cards
      expect(mockDoc.roundedRect).toHaveBeenCalled();
      // Should show sector names
      const textCalls = mockDoc.text.mock.calls.map((c: any) => c[0]);
      expect(textCalls.some((t: string) => t.includes("Multilamina"))).toBe(true);
    });
  });
});
