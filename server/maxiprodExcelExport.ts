/**
 * Generates an Excel file in Maxiprod "Empresas" import format
 * from vendor_clients data.
 * 
 * IMPORTANT: Only fields marked with * are truly required.
 * All other fields should be left BLANK (empty string) when no data is available.
 * Maxiprod handles blank fields better than placeholder text like "NAO INFORMADO".
 */
import ExcelJS from "exceljs";
import { getDb } from "./db";
import { vendorClients } from "../drizzle/schema";
import { inArray, sql } from "drizzle-orm";

// Maxiprod column headers (44 columns)
const MAXIPROD_HEADERS = [
  "Apelido *",
  "Ativa",
  "CNPJ_OU_CPF",
  "Razão social/Nome",
  "Nome fantasia",
  "Regime tributário *",
  "Tipo IE",
  "IE",
  "IM",
  "RNTRC",
  "Website",
  "Limite de crédito (R$)",
  "E-mail para envio da NF-e",
  "CEP",
  "Endereço",
  "Número",
  "Complemento",
  "Bairro",
  "Caixa postal",
  "Município",
  "UF",
  "Região do cliente",
  "Perfil do cliente",
  "Segmento do cliente",
  "Forma de pedido do cliente",
  "Fone 1",
  "Fone 2",
  "Fone 3",
  "Fone 4",
  "É cliente potencial *",
  "É cliente *",
  "É representante *",
  "É transportadora *",
  "É fornecedor *",
  "É parceiro *",
  "É concorrente *",
  "É instituição financeira *",
  "E-mail",
  "Representante/Vendedor",
  "Representante/Vendedor 2",
  "Representante/Vendedor 3",
  "Perfil de acesso para visualizar documentos de compra",
  "Observações",
  "Resultado da importação",
];

/**
 * Generate an "apelido" (short name) from razaoSocial.
 * Maxiprod uses this as a unique identifier.
 * Rules: uppercase, no special chars, max 20 chars.
 */
function generateApelido(razaoSocial: string, cnpjCpf: string): string {
  // Use first meaningful word(s) from razao social + last 4 digits of CNPJ
  const cleaned = razaoSocial.trim().toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ");
  const words = cleaned.split(" ");
  const shortName = words.slice(0, 2).join(" ").substring(0, 16);
  const suffix = cnpjCpf.replace(/\D/g, "").slice(-4);
  const apelido = `${shortName}${suffix}`.substring(0, 20).trim();
  // Apelido CANNOT be empty
  return apelido || `CLI${suffix || "0000"}`;
}

/**
 * Derive "Tipo IE" from inscricaoEstadual value
 * Valid values: "Contribuinte", "Isento", "Não-contribuinte"
 */
function deriveTipoIE(ie: string | null | undefined, tipoContribuinte: string | null | undefined): string {
  if (tipoContribuinte) {
    const lower = tipoContribuinte.toLowerCase();
    if (lower.includes("não") || lower.includes("nao")) {
      return "Não-contribuinte";
    }
    if (lower.includes("isento")) {
      return "Isento";
    }
    return "Contribuinte";
  }
  if (!ie || ie.trim() === "" || ie.toUpperCase() === "ISENTO") {
    return "Isento";
  }
  return "Contribuinte";
}

/**
 * Derive Regime Tributário - REQUIRED field
 * Valid values in Maxiprod: "Normal", "Simples Nacional", "Simples Nacional - Excesso", "MEI"
 */
function deriveRegimeTributario(regime: string | null | undefined): string {
  if (!regime || regime.trim() === "") return "Normal";
  const lower = regime.toLowerCase();
  if (lower.includes("simples") && lower.includes("excesso")) return "Simples Nacional - Excesso";
  if (lower.includes("simples")) return "Simples Nacional";
  if (lower.includes("mei")) return "MEI";
  return "Normal";
}

/**
 * Format limit as Brazilian currency string (1.000,00)
 */
function formatCurrency(value: string | null | undefined): string {
  if (!value) return "";
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format CNPJ/CPF with proper mask
 * CNPJ: 00.000.000/0000-00
 * CPF: 000.000.000-00
 */
function formatCnpjCpf(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return digits;
}

/**
 * Map a vendor_client row to a Maxiprod row (44 columns)
 * Fields without data are left BLANK for proper Maxiprod import.
 * Only truly required fields (marked with *) get default values.
 */
function mapClientToMaxiprodRow(client: any): string[] {
  const row: string[] = new Array(44).fill("");

  // Col 1: Apelido * (REQUIRED - unique identifier)
  row[0] = generateApelido(client.razaoSocial || "CLIENTE", client.cnpjCpf || "0000");
  // Col 2: Ativa (always "Sim")
  row[1] = "Sim";
  // Col 3: CNPJ_OU_CPF (formatted) - MUST have value
  row[2] = formatCnpjCpf(client.cnpjCpf) || "00.000.000/0000-00";
  // Col 4: Razão social/Nome
  row[3] = client.razaoSocial || client.nomeFantasia || row[0];
  // Col 5: Nome fantasia
  row[4] = client.nomeFantasia || client.razaoSocial || row[0];
  // Col 6: Regime tributário * (REQUIRED)
  row[5] = deriveRegimeTributario(client.regimeTributario);
  // Col 7: Tipo IE - MUST have value
  row[6] = deriveTipoIE(client.inscricaoEstadual, client.tipoContribuinte);
  // Col 8: IE
  row[7] = (client.inscricaoEstadual && client.inscricaoEstadual.toUpperCase() !== "ISENTO")
    ? client.inscricaoEstadual
    : "ISENTO";
  // Col 9: IM
  row[8] = client.inscricaoMunicipal || "";
  // Col 10: RNTRC
  row[9] = "";
  // Col 11: Website
  row[10] = client.website || "";
  // Col 12: Limite de crédito (R$)
  row[11] = formatCurrency(client.limiteCredito) || "0,00";
  // Col 13: E-mail para envio da NF-e
  row[12] = client.emailNfe || client.email || "";
  // Col 14: CEP
  row[13] = client.cep || "";
  // Col 15: Endereço
  row[14] = client.logradouro || "";
  // Col 16: Número - MUST have value
  row[15] = client.numero || "S/N";
  // Col 17: Complemento
  row[16] = client.complemento || "";
  // Col 18: Bairro
  row[17] = client.bairro || "";
  // Col 19: Caixa postal
  row[18] = "";
  // Col 20: Município
  row[19] = client.cidade || "";
  // Col 21: UF - MUST have value
  row[20] = client.uf || "PR";
  // Col 22: Região do cliente
  row[21] = client.regiao || "";
  // Col 23: Perfil do cliente
  row[22] = client.perfil || "";
  // Col 24: Segmento do cliente
  row[23] = client.segmento || "";
  // Col 25: Forma de pedido do cliente
  row[24] = client.formaPedido || "";
  // Col 26: Fone 1
  row[25] = client.telefone1 || "";
  // Col 27: Fone 2
  row[26] = client.telefone2 || "";
  // Col 28: Fone 3
  row[27] = "";
  // Col 29: Fone 4
  row[28] = "";
  // Col 30: É cliente potencial * (REQUIRED)
  row[29] = "Não";
  // Col 31: É cliente * (REQUIRED)
  row[30] = "Sim";
  // Col 32: É representante * (REQUIRED)
  row[31] = "Não";
  // Col 33: É transportadora * (REQUIRED)
  row[32] = "Não";
  // Col 34: É fornecedor * (REQUIRED)
  row[33] = "Não";
  // Col 35: É parceiro * (REQUIRED)
  row[34] = "Não";
  // Col 36: É concorrente * (REQUIRED)
  row[35] = "Não";
  // Col 37: É instituição financeira * (REQUIRED)
  row[36] = "Não";
  // Col 38: E-mail
  row[37] = client.email || "";
  // Col 39: Representante/Vendedor
  row[38] = client.sellerName || "";
  // Col 40-41: Representante/Vendedor 2, 3
  row[39] = "";
  row[40] = "";
  // Col 42: Perfil de acesso
  row[41] = "";
  // Col 43: Observações
  row[42] = client.observacoes || "";
  // Col 44: Resultado da importação (left empty - filled by Maxiprod)
  row[43] = "";

  return row;
}

/**
 * Generate Excel buffer in Maxiprod format for given client IDs
 * If no IDs provided, exports all clients not yet exported.
 */
export async function generateMaxiprodExcel(clientIds?: number[]): Promise<Buffer> {
  let clients: any[];

  const db = (await getDb())!;

  if (clientIds && clientIds.length > 0) {
    clients = await db
      .select()
      .from(vendorClients)
      .where(inArray(vendorClients.id, clientIds));
  } else {
    // Export all clients
    clients = await db
      .select()
      .from(vendorClients);
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Empresas");

  // Add header row
  worksheet.addRow(MAXIPROD_HEADERS);

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
  });

  // Add data rows
  for (const client of clients) {
    const row = mapClientToMaxiprodRow(client);
    worksheet.addRow(row);
  }

  // Auto-fit column widths (approximate)
  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = cell.value ? cell.value.toString().length : 0;
      if (length > maxLength) maxLength = Math.min(length, 40);
    });
    column.width = maxLength + 2;
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate Excel for clients created after a specific date
 */
export async function generateMaxiprodExcelByDate(sinceDate: Date): Promise<{ buffer: Buffer; count: number }> {
  const db = (await getDb())!;
  const clients = await db
    .select()
    .from(vendorClients)
    .where(sql`${vendorClients.createdAt} >= ${sinceDate}`);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Empresas");

  worksheet.addRow(MAXIPROD_HEADERS);
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
  });

  for (const client of clients) {
    worksheet.addRow(mapClientToMaxiprodRow(client));
  }

  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = cell.value ? cell.value.toString().length : 0;
      if (length > maxLength) maxLength = Math.min(length, 40);
    });
    column.width = maxLength + 2;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), count: clients.length };
}
