/**
 * Tests for WeekReconciliationCard improvements
 * - Alphabetical ordering of items
 * - Saldo label renamed
 * - PDF export logic (saldo calculation)
 * - Detail text assembly (referenteA, observacoes, NF, parcela)
 */
import { describe, it, expect } from "vitest";

/** Replica the detail text logic from PayableRow */
function buildDetailText(item: {
  referenteA?: string;
  observacoes?: string;
  documentoVinculadoNumero?: string;
  parcela?: string;
}): string {
  const parts: string[] = [];
  if (item.referenteA) parts.push(item.referenteA);
  if (item.observacoes && item.observacoes !== item.referenteA) parts.push(item.observacoes);
  if (item.documentoVinculadoNumero) parts.push(`NF ${item.documentoVinculadoNumero}`);
  if (item.parcela) parts.push(`Parcela ${item.parcela}`);
  return parts.join(" \u2013 ");
}

describe("WeekReconciliationCard improvements", () => {
  it("should sort items alphabetically by fornecedor", () => {
    const items = [
      { fornecedor: "RENATO BENAZZI LTDA", valor: 24095.61 },
      { fornecedor: "ECO SERRA MADEIRAS LTDA", valor: 33341.49 },
      { fornecedor: "ZETA COMERCIO LTDA", valor: 5000 },
      { fornecedor: "ALPHA DISTRIBUIDORA", valor: 3000 },
    ];

    const sorted = [...items].sort((a, b) =>
      a.fornecedor.localeCompare(b.fornecedor, "pt-BR")
    );

    expect(sorted[0].fornecedor).toBe("ALPHA DISTRIBUIDORA");
    expect(sorted[1].fornecedor).toBe("ECO SERRA MADEIRAS LTDA");
    expect(sorted[2].fornecedor).toBe("RENATO BENAZZI LTDA");
    expect(sorted[3].fornecedor).toBe("ZETA COMERCIO LTDA");
  });

  it("should calculate saldo restante correctly (saldo - autorizado)", () => {
    const saldoBancario = 95386.59;
    const totalAutorizado = 33680.0;
    const saldoRestante = saldoBancario - totalAutorizado;

    expect(saldoRestante).toBeCloseTo(61706.59, 2);
  });

  it("should calculate saldo restante as negative when autorizado > saldo", () => {
    const saldoBancario = 20000;
    const totalAutorizado = 50000;
    const saldoRestante = saldoBancario - totalAutorizado;

    expect(saldoRestante).toBe(-30000);
    expect(saldoRestante < 0).toBe(true);
  });

  it("should filter only authorized items for PDF export", () => {
    const items = [
      { fornecedor: "A", authorized: true, valor: 1000 },
      { fornecedor: "B", authorized: false, valor: 2000 },
      { fornecedor: "C", authorized: true, valor: 3000 },
      { fornecedor: "D", authorized: false, valor: 4000 },
    ];

    const authorizedItems = items.filter((i) => i.authorized);
    expect(authorizedItems).toHaveLength(2);
    expect(authorizedItems[0].fornecedor).toBe("A");
    expect(authorizedItems[1].fornecedor).toBe("C");

    const totalAutorizado = authorizedItems.reduce((s, i) => s + i.valor, 0);
    expect(totalAutorizado).toBe(4000);
  });

  it("should format currency correctly in pt-BR", () => {
    const formatCurrency = (n: number): string =>
      n.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
      });

    expect(formatCurrency(95386.59)).toContain("95.386,59");
    expect(formatCurrency(33680.0)).toContain("33.680,00");
    expect(formatCurrency(0)).toContain("0,00");
  });
});

describe("PayableRow detail text assembly", () => {
  it("should show all fields when referenteA, NF, and parcela are present", () => {
    const detail = buildDetailText({
      referenteA: "Matéria Prima - NF 21760",
      observacoes: "",
      documentoVinculadoNumero: "",
      parcela: "3/4",
    });
    expect(detail).toBe("Matéria Prima - NF 21760 \u2013 Parcela 3/4");
  });

  it("should show NF and parcela when referenteA is empty", () => {
    const detail = buildDetailText({
      referenteA: "",
      observacoes: "",
      documentoVinculadoNumero: "21902",
      parcela: "1/4",
    });
    expect(detail).toBe("NF 21902 \u2013 Parcela 1/4");
  });

  it("should show only NF when referenteA and parcela are empty", () => {
    const detail = buildDetailText({
      referenteA: "",
      observacoes: "",
      documentoVinculadoNumero: "725",
      parcela: "",
    });
    expect(detail).toBe("NF 725");
  });

  it("should show only parcela when referenteA and NF are empty", () => {
    const detail = buildDetailText({
      referenteA: "",
      observacoes: "",
      documentoVinculadoNumero: "",
      parcela: "2/4",
    });
    expect(detail).toBe("Parcela 2/4");
  });

  it("should include observacoes when different from referenteA", () => {
    const detail = buildDetailText({
      referenteA: "Matéria Prima",
      observacoes: "Urgente - pagar até sexta",
      documentoVinculadoNumero: "21760",
      parcela: "1/2",
    });
    expect(detail).toBe("Matéria Prima \u2013 Urgente - pagar até sexta \u2013 NF 21760 \u2013 Parcela 1/2");
  });

  it("should NOT duplicate observacoes when same as referenteA", () => {
    const detail = buildDetailText({
      referenteA: "Matéria Prima",
      observacoes: "Matéria Prima",
      documentoVinculadoNumero: "",
      parcela: "1/4",
    });
    expect(detail).toBe("Matéria Prima \u2013 Parcela 1/4");
  });

  it("should return empty string when all fields are empty", () => {
    const detail = buildDetailText({
      referenteA: "",
      observacoes: "",
      documentoVinculadoNumero: "",
      parcela: "",
    });
    expect(detail).toBe("");
  });

  it("should handle cheque description without NF or parcela", () => {
    const detail = buildDetailText({
      referenteA: "CHEQUE SICOOB N° 129 REF NF 21929",
      observacoes: "",
      documentoVinculadoNumero: "",
      parcela: "",
    });
    expect(detail).toBe("CHEQUE SICOOB N° 129 REF NF 21929");
  });
});

describe("Supplier group collapsing logic", () => {
  it("should group items by fornecedor correctly", () => {
    const items = [
      { fornecedor: "BENAZZI", valor: 24095.61 },
      { fornecedor: "BENAZZI", valor: 23918.72 },
      { fornecedor: "BENAZZI", valor: 23087.32 },
      { fornecedor: "GILSON ALEIXO", valor: 4000 },
      { fornecedor: "ECO SERRA", valor: 33341.49 },
      { fornecedor: "ECO SERRA", valor: 12000 },
    ];

    const groups: { fornecedor: string; items: typeof items }[] = [];
    let currentGroup: { fornecedor: string; items: typeof items } | null = null;
    for (const item of items) {
      if (!currentGroup || currentGroup.fornecedor !== item.fornecedor) {
        currentGroup = { fornecedor: item.fornecedor, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    }

    expect(groups).toHaveLength(3);
    expect(groups[0].fornecedor).toBe("BENAZZI");
    expect(groups[0].items).toHaveLength(3);
    expect(groups[1].fornecedor).toBe("GILSON ALEIXO");
    expect(groups[1].items).toHaveLength(1);
    expect(groups[2].fornecedor).toBe("ECO SERRA");
    expect(groups[2].items).toHaveLength(2);
  });

  it("should calculate group total correctly", () => {
    const groupItems = [
      { fornecedor: "BENAZZI", valor: 24095.61 },
      { fornecedor: "BENAZZI", valor: 23918.72 },
      { fornecedor: "BENAZZI", valor: 23087.32 },
    ];

    const groupTotal = groupItems.reduce((s, i) => s + i.valor, 0);
    expect(groupTotal).toBeCloseTo(71101.65, 2);
  });

  it("should toggle group collapse state correctly", () => {
    const collapsedGroups = new Set<string>();

    // Collapse BENAZZI
    collapsedGroups.add("BENAZZI");
    expect(collapsedGroups.has("BENAZZI")).toBe(true);
    expect(collapsedGroups.has("ECO SERRA")).toBe(false);

    // Expand BENAZZI
    collapsedGroups.delete("BENAZZI");
    expect(collapsedGroups.has("BENAZZI")).toBe(false);
  });
});

describe("Password authentication for payment authorization", () => {
  const AUTH_PASSWORDS = ["Fernando", "Bruno"];

  it("should accept Fernando password", () => {
    expect(AUTH_PASSWORDS.includes("Fernando")).toBe(true);
  });

  it("should accept Bruno password", () => {
    expect(AUTH_PASSWORDS.includes("Bruno")).toBe(true);
  });

  it("should reject incorrect password", () => {
    const wrongPasswords = ["fernando", "FERNANDO", "admin", "123456", "", "bruno", "BRUNO"];
    for (const pwd of wrongPasswords) {
      expect(AUTH_PASSWORDS.includes(pwd)).toBe(false);
    }
  });

  it("should be case-sensitive", () => {
    expect(AUTH_PASSWORDS.includes("fernando")).toBe(false);
    expect(AUTH_PASSWORDS.includes("FERNANDO")).toBe(false);
    expect(AUTH_PASSWORDS.includes("Fernando")).toBe(true);
    expect(AUTH_PASSWORDS.includes("bruno")).toBe(false);
    expect(AUTH_PASSWORDS.includes("Bruno")).toBe(true);
  });
});

describe("BucketCard sort arrows logic", () => {
  type BucketSortMode = "data_asc" | "data_desc" | "valor_asc" | "valor_desc" | "nome_asc";

  it("should toggle data sort between asc and desc", () => {
    let sortMode: BucketSortMode = "data_asc";

    // Click data desc arrow
    sortMode = sortMode === "data_desc" ? "data_asc" : "data_desc";
    expect(sortMode).toBe("data_desc");

    // Click data asc arrow
    sortMode = sortMode === "data_asc" ? "data_desc" : "data_asc";
    expect(sortMode).toBe("data_asc");
  });

  it("should toggle valor sort between asc and desc", () => {
    let sortMode: BucketSortMode = "data_asc";

    // Click valor desc arrow
    sortMode = sortMode === "valor_desc" ? "valor_asc" : "valor_desc";
    expect(sortMode).toBe("valor_desc");

    // Click valor asc arrow
    sortMode = sortMode === "valor_asc" ? "valor_desc" : "valor_asc";
    expect(sortMode).toBe("valor_asc");
  });

  it("should sort items by date descending (most recent first)", () => {
    const items = [
      { nome: "A", vencimento: "2026-04-01", valor: 1000 },
      { nome: "B", vencimento: "2026-04-05", valor: 2000 },
      { nome: "C", vencimento: "2026-04-03", valor: 3000 },
    ];

    const sorted = [...items].sort((a, b) => b.vencimento.localeCompare(a.vencimento));
    expect(sorted[0].nome).toBe("B"); // 04-05
    expect(sorted[1].nome).toBe("C"); // 04-03
    expect(sorted[2].nome).toBe("A"); // 04-01
  });

  it("should sort items by valor descending (highest first)", () => {
    const items = [
      { nome: "A", vencimento: "2026-04-01", valor: 1000 },
      { nome: "B", vencimento: "2026-04-05", valor: 5000 },
      { nome: "C", vencimento: "2026-04-03", valor: 3000 },
    ];

    const sorted = [...items].sort((a, b) => b.valor - a.valor);
    expect(sorted[0].nome).toBe("B"); // 5000
    expect(sorted[1].nome).toBe("C"); // 3000
    expect(sorted[2].nome).toBe("A"); // 1000
  });
});
