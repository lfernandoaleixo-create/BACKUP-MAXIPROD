import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock jsPDF and autoTable before importing the module
const mockDoc = {
  internal: {
    pageSize: {
      getWidth: () => 210,
      getHeight: () => 297,
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
  lastAutoTable: { finalY: 120 },
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
const sampleData = {
  topNomes: [
    { nome: "João Silva", quantidade: 150.5, registros: 25 },
    { nome: "Maria Santos", quantidade: 120, registros: 18 },
    { nome: "Pedro Oliveira", quantidade: 80.2, registros: 12 },
  ],
  topProdutos: [
    { codigoItem: "ESP001", descricaoItem: "Espeto Bambu 25cm", materialOrigem: "bambu", quantidade: 200, registros: 30 },
    { codigoItem: "ESP002", descricaoItem: "Espeto Madeira 30cm", materialOrigem: "madeira", quantidade: 100, registros: 15 },
    { codigoItem: "ESP003", descricaoItem: "Palito Bambu 18cm", materialOrigem: "bambu", quantidade: 50.5, registros: 8 },
  ],
  total: 350.7,
};

const emptyData = {
  topNomes: [],
  topProdutos: [],
  total: 0,
};

describe("Pirografia PDF Export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateDailyPdf", () => {
    it("should generate a daily PDF with correct filename", async () => {
      const { generateDailyPdf } = await import("@/lib/pirografiaPdfExport");
      const jsPDF = (await import("jspdf")).default;

      await generateDailyPdf(sampleData, "2026-05-25");

      // jsPDF constructor should have been called with portrait A4
      expect(jsPDF).toHaveBeenCalledWith({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // save should have been called with correct filename
      expect(mockDoc.save).toHaveBeenCalledWith("Pirografia_Diario_20260525.pdf");
    });

    it("should render header with period label", async () => {
      const { generateDailyPdf } = await import("@/lib/pirografiaPdfExport");

      await generateDailyPdf(sampleData, "2026-05-25");

      // Should draw text for title and period
      const textCalls = mockDoc.text.mock.calls.map((c: any) => c[0]);
      expect(textCalls.some((t: string) => typeof t === "string" && t.includes("PIROGRAFIA"))).toBe(true);
      expect(textCalls.some((t: string) => typeof t === "string" && t.includes("25/05/2026"))).toBe(true);
    });

    it("should handle empty data gracefully", async () => {
      const { generateDailyPdf } = await import("@/lib/pirografiaPdfExport");

      await expect(generateDailyPdf(emptyData, "2026-05-25")).resolves.not.toThrow();
      expect(mockDoc.save).toHaveBeenCalledWith("Pirografia_Diario_20260525.pdf");
    });

    it("should display total caixas in summary box", async () => {
      const { generateDailyPdf } = await import("@/lib/pirografiaPdfExport");

      await generateDailyPdf(sampleData, "2026-05-25");

      const textCalls = mockDoc.text.mock.calls.map((c: any) => c[0]);
      // Should show "Caixas Pirografadas" label
      expect(textCalls.some((t: string) => typeof t === "string" && t.includes("Caixas Pirografadas"))).toBe(true);
    });
  });

  describe("generateWeeklyPdf", () => {
    it("should generate a weekly PDF with correct filename", async () => {
      const { generateWeeklyPdf } = await import("@/lib/pirografiaPdfExport");

      await generateWeeklyPdf(sampleData, "2026-05-19", "2026-05-25");

      expect(mockDoc.save).toHaveBeenCalledWith("Pirografia_Semanal_20260519_20260525.pdf");
    });

    it("should show period range in subtitle", async () => {
      const { generateWeeklyPdf } = await import("@/lib/pirografiaPdfExport");

      await generateWeeklyPdf(sampleData, "2026-05-19", "2026-05-25");

      const textCalls = mockDoc.text.mock.calls.map((c: any) => c[0]);
      expect(textCalls.some((t: string) => typeof t === "string" && t.includes("19/05/2026"))).toBe(true);
      expect(textCalls.some((t: string) => typeof t === "string" && t.includes("25/05/2026"))).toBe(true);
    });
  });

  describe("generateMonthlyPdf", () => {
    it("should generate a monthly PDF with correct filename", async () => {
      const { generateMonthlyPdf } = await import("@/lib/pirografiaPdfExport");

      await generateMonthlyPdf(sampleData, "2026-05");

      expect(mockDoc.save).toHaveBeenCalledWith("Pirografia_Mensal_202605.pdf");
    });

    it("should show month name in subtitle", async () => {
      const { generateMonthlyPdf } = await import("@/lib/pirografiaPdfExport");

      await generateMonthlyPdf(sampleData, "2026-05");

      const textCalls = mockDoc.text.mock.calls.map((c: any) => c[0]);
      expect(textCalls.some((t: string) => typeof t === "string" && t.includes("Maio 2026"))).toBe(true);
    });

    it("should handle different months correctly", async () => {
      const { generateMonthlyPdf } = await import("@/lib/pirografiaPdfExport");

      await generateMonthlyPdf(sampleData, "2026-01");

      const textCalls = mockDoc.text.mock.calls.map((c: any) => c[0]);
      expect(textCalls.some((t: string) => typeof t === "string" && t.includes("Janeiro 2026"))).toBe(true);
      expect(mockDoc.save).toHaveBeenCalledWith("Pirografia_Mensal_202601.pdf");
    });
  });

  describe("autoTable integration", () => {
    it("should call autoTable for nomes and produtos tables", async () => {
      const { generateDailyPdf } = await import("@/lib/pirografiaPdfExport");
      const autoTable = (await import("jspdf-autotable")).default;

      await generateDailyPdf(sampleData, "2026-05-25");

      // autoTable should be called twice: once for nomes, once for produtos
      expect(autoTable).toHaveBeenCalledTimes(2);
    });

    it("should not call autoTable for empty data", async () => {
      const { generateDailyPdf } = await import("@/lib/pirografiaPdfExport");
      const autoTable = (await import("jspdf-autotable")).default;
      vi.mocked(autoTable).mockClear();

      await generateDailyPdf(emptyData, "2026-05-25");

      // autoTable should NOT be called when there's no data
      expect(autoTable).not.toHaveBeenCalled();
    });
  });
});
