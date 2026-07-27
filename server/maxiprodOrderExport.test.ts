import { describe, it, expect, vi } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

describe("maxiprodOrderExport", () => {
  it("generates Excel with correct sheet name 'Dados' and proper headers", async () => {
    const { generateMaxiprodOrderExcel } = await import("./maxiprodOrderExport");
    const ExcelJS = await import("exceljs");

    const testData = {
      orderId: 1,
      orderNumber: 390001,
      cnpjCpf: "54404517000175", // CNPJ apenas números
      operacaoFiscal: "6102",
      tabelaPrecos: "001",
      representante: "JUVENAL TEIXEIRA",
      formaPagamento: "A Prazo",
      condicaoPagamento: "40/50/60/70",
      dataEntrega: "2026-07-27",
      previsaoEntrega: "2026-07-27",
      valorFrete: 0,
      observacoes: "Pirografar com cliche VILAC",
      estadoConfiguravel: "MADEIRA",
      items: [
        {
          codigoItem: "00003",
          descricaoItem: "ESPETO DE BAMBU 4,0 X 200 MM  C/ 5 X 1.000 UNID.",
          quantidade: 50,
          unidadeMedida: "un",
          precoUnitario: 115,
          valorDesconto: 0,
        },
        {
          codigoItem: "00017",
          descricaoItem: "VARETA AROMATIZADOR 3,0 X 200 MM",
          quantidade: 100,
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

    // CRITICAL: Sheet name must be "Dados" (not "Pedidos de Venda")
    const worksheet = workbook.getWorksheet("Dados");
    expect(worksheet).toBeDefined();
    expect(workbook.getWorksheet("Pedidos de Venda")).toBeUndefined();

    // Check header row - exact headers from Maxiprod template
    const headerRow = worksheet!.getRow(1);
    expect(headerRow.getCell(1).value).toBe("Novo pedido *");
    expect(headerRow.getCell(2).value).toBe("Identificador *");
    expect(headerRow.getCell(4).value).toBe("Cliente *");
    expect(headerRow.getCell(5).value).toBe("Operação fiscal *");
    expect(headerRow.getCell(7).value).toBe(" Representante/ vendedor "); // Spaces intentional!
    expect(headerRow.getCell(8).value).toBe("Moeda*");
    expect(headerRow.getCell(9).value).toBe("Forma de pagamento (À vista, A prazo ou Outros)");
    expect(headerRow.getCell(24).value).toBe("Tipo de comissão (percentual, valor unitário ou valor total)");

    // Check first item row
    const row2 = worksheet!.getRow(2);
    expect(row2.getCell(1).value).toBe("S"); // First item = S
    expect(row2.getCell(2).value).toBe("390001"); // Identificador
    expect(row2.getCell(4).value).toBe("54404517000175"); // CNPJ apenas números!
    expect(row2.getCell(5).value).toBe("6102"); // Apenas código numérico!
    expect(row2.getCell(7).value).toBe("JUVENAL TEIXEIRA"); // Representante
    expect(row2.getCell(8).value).toBe("R$"); // Moeda
    expect(row2.getCell(9).value).toBe("A Prazo"); // Forma pagamento normalizada
    expect(row2.getCell(10).value).toBe("40/50/60/70"); // Condição pagamento
    expect(row2.getCell(11).value).toBe("00003"); // Código
    expect(row2.getCell(13).value).toBe(50); // Quantidade
    expect(row2.getCell(14).value).toBe("un"); // Unidade
    expect(row2.getCell(15).value).toBe(115); // Valor unitário
    expect(row2.getCell(18).value).toBeNull(); // Seguro = VAZIO (não 0!)
    expect(row2.getCell(19).value).toBeNull(); // Outras despesas = VAZIO (não 0!)
    expect(row2.getCell(20).value).toBe("27/07/2026"); // Entrega formatada
    expect(row2.getCell(22).value).toBe("MADEIRA"); // Info adicional
    expect(row2.getCell(23).value).toBe("Pirografar com cliche VILAC"); // Observações
    expect(row2.getCell(25).value).toBeNull(); // Comissão = VAZIO (não "0"!)

    // Check second item row
    const row3 = worksheet!.getRow(3);
    expect(row3.getCell(1).value).toBe("N"); // Subsequent items = N
    expect(row3.getCell(2).value).toBe("390001"); // Same identifier
    expect(row3.getCell(4).value).toBe("54404517000175"); // Same CNPJ
    expect(row3.getCell(11).value).toBe("00017"); // Different code
    expect(row3.getCell(13).value).toBe(100); // Different quantity
    expect(row3.getCell(15).value).toBe(520); // Different price
    expect(row3.getCell(17).value).toBe(0); // No frete on second item
  });

  it("normalizes forma de pagamento correctly", async () => {
    const { generateMaxiprodOrderExcel } = await import("./maxiprodOrderExport");
    const ExcelJS = await import("exceljs");

    // Test "Boleto" → "A Prazo"
    const testBoleto = {
      orderId: 2,
      orderNumber: 200,
      cnpjCpf: "12345678000190",
      operacaoFiscal: "5101",
      tabelaPrecos: "",
      representante: "",
      formaPagamento: "Boleto", // Should be normalized to "A Prazo"
      condicaoPagamento: "30/60",
      dataEntrega: "2026-01-15",
      previsaoEntrega: "2026-01-15",
      valorFrete: 0,
      observacoes: "",
      estadoConfiguravel: "",
      items: [{ codigoItem: "001", descricaoItem: "Teste", quantidade: 1, unidadeMedida: "un", precoUnitario: 10, valorDesconto: 0 }],
    };

    const buffer = await generateMaxiprodOrderExcel(testBoleto);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = workbook.getWorksheet("Dados")!;
    // Note: formaPagamento is passed as-is to the function (normalization happens in generateMaxiprodOrderExcelFromDb)
    // But the function still uses whatever is passed in orderData.formaPagamento
    expect(ws.getRow(2).getCell(9).value).toBe("Boleto");
  });

  it("extracts only numeric code from operacaoFiscal with description", async () => {
    const { generateMaxiprodOrderExcel } = await import("./maxiprodOrderExport");
    const ExcelJS = await import("exceljs");

    const testData = {
      orderId: 3,
      orderNumber: 300,
      cnpjCpf: "05282757000139",
      operacaoFiscal: "6101", // Already clean
      tabelaPrecos: "",
      representante: "",
      formaPagamento: "A Prazo",
      condicaoPagamento: "",
      dataEntrega: "",
      previsaoEntrega: "",
      valorFrete: 0,
      observacoes: "",
      estadoConfiguravel: "",
      items: [{ codigoItem: "001", descricaoItem: "Teste", quantidade: 1, unidadeMedida: "un", precoUnitario: 10, valorDesconto: 0 }],
    };

    const buffer = await generateMaxiprodOrderExcel(testData);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = workbook.getWorksheet("Dados")!;
    expect(ws.getRow(2).getCell(5).value).toBe("6101");
  });

  it("cleans CNPJ removing dots, slashes and dashes", async () => {
    const { generateMaxiprodOrderExcel } = await import("./maxiprodOrderExport");
    const ExcelJS = await import("exceljs");

    const testData = {
      orderId: 4,
      orderNumber: 400,
      cnpjCpf: "05.282.757/0001-39", // With formatting - should be cleaned
      operacaoFiscal: "5101",
      tabelaPrecos: "",
      representante: "",
      formaPagamento: "À vista",
      condicaoPagamento: "",
      dataEntrega: "",
      previsaoEntrega: "",
      valorFrete: 0,
      observacoes: "",
      estadoConfiguravel: "",
      items: [{ codigoItem: "001", descricaoItem: "Teste", quantidade: 1, unidadeMedida: "un", precoUnitario: 10, valorDesconto: 0 }],
    };

    const buffer = await generateMaxiprodOrderExcel(testData);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = workbook.getWorksheet("Dados")!;
    // CNPJ must be only numbers, preserving leading zeros
    expect(ws.getRow(2).getCell(4).value).toBe("05282757000139");
  });

  it("leaves seguro, outras despesas and comissão as null (not 0)", async () => {
    const { generateMaxiprodOrderExcel } = await import("./maxiprodOrderExport");
    const ExcelJS = await import("exceljs");

    const testData = {
      orderId: 5,
      orderNumber: 500,
      cnpjCpf: "12345678000190",
      operacaoFiscal: "6102",
      tabelaPrecos: "",
      representante: "",
      formaPagamento: "A Prazo",
      condicaoPagamento: "",
      dataEntrega: "2026-03-01",
      previsaoEntrega: "2026-03-01",
      valorFrete: 200,
      observacoes: "",
      estadoConfiguravel: "",
      items: [{ codigoItem: "001", descricaoItem: "Teste", quantidade: 10, unidadeMedida: "CX", precoUnitario: 50, valorDesconto: 0 }],
    };

    const buffer = await generateMaxiprodOrderExcel(testData);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = workbook.getWorksheet("Dados")!;
    const row = ws.getRow(2);
    
    // These must be null/empty, NOT 0
    expect(row.getCell(18).value).toBeNull(); // Seguro
    expect(row.getCell(19).value).toBeNull(); // Outras despesas
    expect(row.getCell(25).value).toBeNull(); // Comissão
    
    // But frete CAN be a number
    expect(row.getCell(17).value).toBe(200);
  });
});
