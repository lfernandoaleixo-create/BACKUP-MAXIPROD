import { describe, it, expect, vi } from "vitest";

// Mock jsPDF and autoTable before importing the module
vi.mock("jspdf", () => {
  const mockDoc = {
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
    setFillColor: vi.fn(),
    setTextColor: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setDrawColor: vi.fn(),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    save: vi.fn(),
    lastAutoTable: { finalY: 150 },
  };
  return {
    default: vi.fn(() => mockDoc),
  };
});

vi.mock("jspdf-autotable", () => ({
  default: vi.fn(),
}));

describe("generateOrderPdf", () => {
  it("should generate a PDF with order data and call save", async () => {
    const { generateOrderPdf } = await import("@/lib/generateOrderPdf");
    const jsPDF = (await import("jspdf")).default;

    const mockOrder = {
      pedido: "12345",
      cliente: "Cliente Teste LTDA",
      clienteApelido: "Cliente Teste",
      uf: "SP",
      dataEmissao: "2026-03-15",
      dataEntrega: "2026-03-20",
      empresa: "Grupo Fox",
      representante: "João Silva",
      segmento: "Varejo",
      condicaoPagamento: "30",
      transportadora: "Transportes ABC",
      observacoes: "Entregar pela manhã",
      grupo: "Prod. Importados",
      valorTotal: 5000,
      itens: [
        {
          descricao: "Vareta Bambu 25cm",
          quantidade: 100,
          valorUnitario: 25,
          valorTotal: 2500,
          codigoItem: "V001",
          unidadeMedida: "cx",
        },
        {
          descricao: "Vareta Bambu 30cm",
          quantidade: 100,
          valorUnitario: 25,
          valorTotal: 2500,
          codigoItem: "V002",
          unidadeMedida: "cx",
        },
      ],
      etapa: "Em Aberto",
    };

    // Should not throw
    expect(() => generateOrderPdf(mockOrder, true)).not.toThrow();

    // jsPDF constructor should have been called
    expect(jsPDF).toHaveBeenCalledWith({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // save should have been called with correct filename
    const mockInstance = (jsPDF as any).mock.results[0].value;
    expect(mockInstance.save).toHaveBeenCalledWith("Pedido_12345_GrupoFox.pdf");
  });

  it("should generate PDF without values when showValues is false", async () => {
    const { generateOrderPdf } = await import("@/lib/generateOrderPdf");
    const jsPDF = (await import("jspdf")).default;

    const mockOrder = {
      pedido: "99999",
      cliente: "Produção Teste",
      clienteApelido: "",
      uf: "MG",
      dataEmissao: "2026-03-10",
      dataEntrega: "2026-03-25",
      empresa: "Grupo Fox",
      representante: "Maria",
      segmento: "Indústria",
      valorTotal: 1000,
      itens: [
        {
          descricao: "Produto X",
          quantidade: 50,
          valorUnitario: 20,
          valorTotal: 1000,
          codigoItem: "PX01",
        },
      ],
      etapa: "Aceite da Produção",
    };

    expect(() => generateOrderPdf(mockOrder, false)).not.toThrow();

    const mockInstance = (jsPDF as any).mock.results[1].value;
    expect(mockInstance.save).toHaveBeenCalledWith("Pedido_99999_GrupoFox.pdf");
  });

  it("should include NFs in PDF when provided", async () => {
    const { generateOrderPdf } = await import("@/lib/generateOrderPdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const mockOrder = {
      pedido: "55555",
      cliente: "Cliente Faturado",
      clienteApelido: "Faturado",
      uf: "RJ",
      dataEmissao: "2026-03-01",
      dataEntrega: "2026-03-10",
      empresa: "Grupo Fox",
      representante: "Carlos",
      segmento: "Atacado",
      valorTotal: 8000,
      itens: [
        {
          descricao: "Item A",
          quantidade: 200,
          valorUnitario: 40,
          valorTotal: 8000,
          codigoItem: "IA01",
        },
      ],
      nfs: [
        {
          numero: "001234",
          serie: "1",
          emissaoData: "2026-03-05",
          valorTotal: 8000,
          chaveDeAcesso: "12345678901234567890123456789012345678901234",
        },
      ],
      etapa: "Faturado",
    };

    expect(() => generateOrderPdf(mockOrder, true)).not.toThrow();

    // autoTable should have been called twice: once for items, once for NFs
    const calls = (autoTable as any).mock.calls;
    const lastTwoCalls = calls.slice(-2);
    expect(lastTwoCalls.length).toBe(2);
  });
});
