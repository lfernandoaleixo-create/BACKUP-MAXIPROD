import { describe, it, expect, vi } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

describe("maxiprodOrderExport", () => {
  it("generateMaxiprodOrderExcel generates correct Excel buffer with proper headers", async () => {
    const { generateMaxiprodOrderExcel } = await import("./maxiprodOrderExport");
    const ExcelJS = await import("exceljs");

    const testData = {
      orderId: 1,
      orderNumber: 176,
      razaoSocial: "GMR DISTRIBUIDORA LTDA",
      operacaoFiscal: "6101 - Fora do Estado - Madeira",
      tabelaPrecos: "",
      representante: "JORDAO",
      moeda: "R$",
      formaPagamento: "A prazo",
      condicaoPagamento: "21/35",
      dataEntrega: "2025-12-16",
      previsaoEntrega: "2025-12-16",
      valorFrete: 0,
      observacoes: "Teste de observação",
      estadoConfiguravel: "MADEIRA",
      items: [
        {
          codigoItem: "00089",
          descricaoItem: "VARETA AROMATIZADOR 4,0 X 250 MM",
          quantidade: 8,
          unidadeMedida: "CX",
          precoUnitario: 500,
          valorDesconto: 0,
        },
        {
          codigoItem: "00090",
          descricaoItem: "VARETA AROMATIZADOR 4,0 X 250 MM 2",
          quantidade: 8,
          unidadeMedida: "CX",
          precoUnitario: 520,
          valorDesconto: 0,
        },
      ],
    };

    const buffer = await generateMaxiprodOrderExcel(testData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Parse the generated Excel to verify content
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet("Pedidos de Venda");
    expect(worksheet).toBeDefined();

    // Check header row (29 columns)
    const headerRow = worksheet!.getRow(1);
    expect(headerRow.getCell(1).value).toBe("Novo pedido *");
    expect(headerRow.getCell(2).value).toBe("Identificador *");
    expect(headerRow.getCell(4).value).toBe("Cliente *");
    expect(headerRow.getCell(5).value).toBe("Operação fiscal *");
    expect(headerRow.getCell(8).value).toBe("Moeda*");
    expect(headerRow.getCell(11).value).toBe("Código");
    expect(headerRow.getCell(13).value).toBe("Quantidade*");
    expect(headerRow.getCell(14).value).toBe("Unidade de venda*");
    expect(headerRow.getCell(15).value).toBe("Valor unitário");
    expect(headerRow.getCell(20).value).toBe("Entrega");
    expect(headerRow.getCell(21).value).toBe("Previsão entrega");

    // Check first item row
    const row2 = worksheet!.getRow(2);
    expect(row2.getCell(1).value).toBe("S"); // Novo pedido = S for first item
    expect(row2.getCell(2).value).toBe("176"); // Identificador
    expect(row2.getCell(4).value).toBe("GMR DISTRIBUIDORA LTDA"); // Cliente
    expect(row2.getCell(5).value).toBe("6101 - Fora do Estado - Madeira"); // Operação fiscal
    expect(row2.getCell(7).value).toBe("JORDAO"); // Representante
    expect(row2.getCell(8).value).toBe("R$"); // Moeda
    expect(row2.getCell(9).value).toBe("A prazo"); // Forma pagamento
    expect(row2.getCell(10).value).toBe("21/35"); // Condição pagamento
    expect(row2.getCell(11).value).toBe("00089"); // Código
    expect(row2.getCell(12).value).toBe("VARETA AROMATIZADOR 4,0 X 250 MM"); // Descrição
    expect(row2.getCell(13).value).toBe(8); // Quantidade
    expect(row2.getCell(14).value).toBe("CX"); // Unidade
    expect(row2.getCell(15).value).toBe(500); // Valor unitário
    expect(row2.getCell(20).value).toBe("16/12/2025"); // Entrega (formatted)
    expect(row2.getCell(21).value).toBe("16/12/2025"); // Previsão entrega (formatted)
    expect(row2.getCell(22).value).toBe("MADEIRA"); // Estado configurável in info adicional
    expect(row2.getCell(23).value).toBe("Teste de observação"); // Observações

    // Check second item row
    const row3 = worksheet!.getRow(3);
    expect(row3.getCell(1).value).toBe("N"); // Novo pedido = N for subsequent items
    expect(row3.getCell(2).value).toBe("176"); // Same identifier
    expect(row3.getCell(11).value).toBe("00090"); // Different code
    expect(row3.getCell(13).value).toBe(8); // Quantidade
    expect(row3.getCell(15).value).toBe(520); // Different price
    expect(row3.getCell(17).value).toBe(0); // No frete on second item
    expect(row3.getCell(23).value).toBe("NAO INFORMADO"); // Placeholder on second item
  });

  it("formatDateBR handles various date formats", async () => {
    // We test the date formatting indirectly through the export
    const { generateMaxiprodOrderExcel } = await import("./maxiprodOrderExport");
    const ExcelJS = await import("exceljs");

    const testData = {
      orderId: 2,
      orderNumber: 200,
      razaoSocial: "TEST LTDA",
      operacaoFiscal: "5101",
      tabelaPrecos: "",
      representante: "VENDEDOR",
      moeda: "R$",
      formaPagamento: "À vista",
      condicaoPagamento: "30",
      dataEntrega: "2026-01-15",
      previsaoEntrega: "15/01/2026", // Already in BR format
      valorFrete: 150.50,
      observacoes: "",
      estadoConfiguravel: "AROMAS",
      items: [
        {
          codigoItem: "001",
          descricaoItem: "Produto Teste",
          quantidade: 5,
          unidadeMedida: "UN",
          precoUnitario: 100,
          valorDesconto: 10,
        },
      ],
    };

    const buffer = await generateMaxiprodOrderExcel(testData);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet("Pedidos de Venda")!;

    const row2 = worksheet.getRow(2);
    expect(row2.getCell(20).value).toBe("15/01/2026"); // YYYY-MM-DD converted to DD/MM/YYYY
    expect(row2.getCell(21).value).toBe("15/01/2026"); // Already in correct format
    expect(row2.getCell(17).value).toBe(150.50); // Frete on first item
    expect(row2.getCell(16).value).toBe(10); // Desconto
    expect(row2.getCell(22).value).toBe("AROMAS"); // Estado configurável
  });
});
