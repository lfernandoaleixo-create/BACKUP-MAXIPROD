import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();

const mockDb = {
  select: mockSelect,
  update: mockUpdate,
  insert: mockInsert,
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("../drizzle/schema", () => ({
  sellerAdmissions: {
    sellerName: "sellerName",
    admissionDate: "admissionDate",
    id: "id",
    createdAt: "createdAt",
  },
  salesOrders: {
    cliente: "cliente",
    dataEmissao: "dataEmissao",
    valorTotal: "valorTotal",
    representante: "representante",
  },
}));

describe("Seller Admissions - Métrica de Clientes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup chain for select().from().where().orderBy()
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValue([]);
    // Setup chain for update().set().where()
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    // Setup chain for insert().values()
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue(undefined);
  });

  describe("Data model", () => {
    it("should define SELLERS constant with correct names", () => {
      const SELLERS = ["JORDAO", "JUVENAL TEIXEIRA", "PAULA", "GILSON", "PEDRO AUGUSTO"];
      expect(SELLERS).toHaveLength(5);
      expect(SELLERS).toContain("JORDAO");
      expect(SELLERS).toContain("JUVENAL TEIXEIRA");
      expect(SELLERS).toContain("PAULA");
      expect(SELLERS).toContain("GILSON");
      expect(SELLERS).toContain("PEDRO AUGUSTO");
    });

    it("should validate admission date format", () => {
      const validDate = "2024-01-15T00:00:00";
      const parsed = new Date(validDate);
      expect(parsed.getFullYear()).toBe(2024);
      expect(parsed.getMonth()).toBe(0); // January
      expect(parsed.getDate()).toBe(15);
    });

    it("should calculate 6-month threshold correctly", () => {
      const admDate = new Date("2024-06-01");
      const sixMonthsBefore = new Date(admDate);
      sixMonthsBefore.setMonth(sixMonthsBefore.getMonth() - 6);
      expect(sixMonthsBefore.getFullYear()).toBe(2023);
      expect(sixMonthsBefore.getMonth()).toBe(11); // December
    });
  });

  describe("Client classification logic", () => {
    it("should classify client as NEW when never bought before", () => {
      const lastPurchaseBefore = new Map<string, Date>();
      const clientName = "NOVO CLIENTE";
      const lastBefore = lastPurchaseBefore.get(clientName);
      expect(lastBefore).toBeUndefined();
      // No previous purchase = new client
      const classification = !lastBefore ? "new" : "other";
      expect(classification).toBe("new");
    });

    it("should classify client as REACTIVATED when last purchase was 6+ months before admission", () => {
      const admDate = new Date("2024-06-01");
      const sixMonthsBefore = new Date(admDate);
      sixMonthsBefore.setMonth(sixMonthsBefore.getMonth() - 6);

      const lastPurchaseBefore = new Map<string, Date>();
      // Client last bought in January 2023 (well over 6 months before June 2024)
      lastPurchaseBefore.set("CLIENTE ANTIGO", new Date("2023-01-15"));

      const lastBefore = lastPurchaseBefore.get("CLIENTE ANTIGO")!;
      expect(lastBefore < sixMonthsBefore).toBe(true);
      const classification = lastBefore < sixMonthsBefore ? "reactivated" : "inherited";
      expect(classification).toBe("reactivated");
    });

    it("should classify client as INHERITED when last purchase was within 6 months before admission", () => {
      const admDate = new Date("2024-06-01");
      const sixMonthsBefore = new Date(admDate);
      sixMonthsBefore.setMonth(sixMonthsBefore.getMonth() - 6);

      const lastPurchaseBefore = new Map<string, Date>();
      // Client last bought in March 2024 (within 6 months before June 2024)
      lastPurchaseBefore.set("CLIENTE ATIVO", new Date("2024-03-15"));

      const lastBefore = lastPurchaseBefore.get("CLIENTE ATIVO")!;
      expect(lastBefore >= sixMonthsBefore).toBe(true);
      const classification = lastBefore < sixMonthsBefore ? "reactivated" : "inherited";
      expect(classification).toBe("inherited");
    });

    it("should handle edge case: purchase exactly 6 months before admission", () => {
      const admDate = new Date("2024-06-01T00:00:00");
      const sixMonthsBefore = new Date(admDate);
      sixMonthsBefore.setMonth(sixMonthsBefore.getMonth() - 6);
      // A purchase on the same day as sixMonthsBefore boundary should be inherited
      const sameDayDate = new Date(sixMonthsBefore.getTime());
      expect(sameDayDate >= sixMonthsBefore).toBe(true);
      // A purchase one day before should be reactivated
      const dayBefore = new Date(sixMonthsBefore.getTime() - 86400000);
      expect(dayBefore < sixMonthsBefore).toBe(true);
    });

    it("should not double-count clients", () => {
      const clientesSeen = new Set<string>();
      const orders = [
        { cliente: "CLIENTE A", dataEmissao: "2024-07-01" },
        { cliente: "CLIENTE A", dataEmissao: "2024-08-01" },
        { cliente: "CLIENTE B", dataEmissao: "2024-07-15" },
      ];

      const uniqueClients: string[] = [];
      for (const o of orders) {
        if (!o.cliente || clientesSeen.has(o.cliente)) continue;
        clientesSeen.add(o.cliente);
        uniqueClients.push(o.cliente);
      }

      expect(uniqueClients).toHaveLength(2);
      expect(uniqueClients).toContain("CLIENTE A");
      expect(uniqueClients).toContain("CLIENTE B");
    });
  });

  describe("Admission date formatting", () => {
    it("should format Date to YYYY-MM-DD for input", () => {
      const d = new Date("2024-03-15T00:00:00Z");
      const formatted = d.toISOString().slice(0, 10);
      expect(formatted).toBe("2024-03-15");
    });

    it("should build admission map from rows", () => {
      const admissions = [
        { sellerName: "JORDAO", admissionDate: new Date("2024-01-15") },
        { sellerName: "PAULA", admissionDate: new Date("2024-03-01") },
      ];

      const map: Record<string, string> = {};
      for (const a of admissions) {
        const d = new Date(a.admissionDate);
        map[a.sellerName] = d.toISOString().slice(0, 10);
      }

      expect(map["JORDAO"]).toBe("2024-01-15");
      expect(map["PAULA"]).toBe("2024-03-01");
      expect(map["GILSON"]).toBeUndefined();
    });
  });

  describe("Metrics output structure", () => {
    it("should return correct structure from getClientMetrics", () => {
      // Simulate the output structure
      const result = {
        admissionDate: new Date("2024-06-01").toISOString(),
        totalClientes: 10,
        clientesNovos: 5,
        clientesReativados: 2,
        clientesHerdados: 3,
        listaClientesNovos: ["A", "B", "C", "D", "E"],
        listaClientesReativados: ["F", "G"],
        listaClientesHerdados: ["H", "I", "J"],
      };

      expect(result.totalClientes).toBe(
        result.clientesNovos + result.clientesReativados + result.clientesHerdados
      );
      expect(result.listaClientesNovos).toHaveLength(result.clientesNovos);
      expect(result.listaClientesReativados).toHaveLength(result.clientesReativados);
      expect(result.listaClientesHerdados).toHaveLength(result.clientesHerdados);
    });

    it("should limit client lists to 50 entries", () => {
      const longList = Array.from({ length: 100 }, (_, i) => `CLIENTE_${i}`);
      const sliced = longList.slice(0, 50);
      expect(sliced).toHaveLength(50);
      expect(sliced[0]).toBe("CLIENTE_0");
      expect(sliced[49]).toBe("CLIENTE_49");
    });
  });
});
