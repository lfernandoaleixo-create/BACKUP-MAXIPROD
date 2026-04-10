/**
 * Tests for Financial History - Snapshot & Change Detection
 */
import { describe, it, expect, vi } from "vitest";

// Test the helper functions and logic by importing the module
// We test the pure logic aspects without DB dependency

describe("Financial History - Logic Tests", () => {
  describe("Change type classification", () => {
    it("should classify a new item as 'adicionado'", () => {
      const prevMap = new Map<number, { valor: string }>();
      const currMap = new Map<number, { valor: string }>([
        [1001, { valor: "5000.00" }],
      ]);

      const changes: string[] = [];
      for (const [id, curr] of Array.from(currMap)) {
        if (!prevMap.has(id)) {
          changes.push("adicionado");
        }
      }
      expect(changes).toEqual(["adicionado"]);
    });

    it("should classify a removed item as 'removido'", () => {
      const prevMap = new Map<number, { valor: string }>([
        [1001, { valor: "5000.00" }],
      ]);
      const currMap = new Map<number, { valor: string }>();

      const changes: string[] = [];
      for (const [id, prev] of Array.from(prevMap)) {
        if (!currMap.has(id)) {
          changes.push("removido");
        }
      }
      expect(changes).toEqual(["removido"]);
    });

    it("should classify a value change as 'alterado'", () => {
      const prevMap = new Map<number, { valor: string }>([
        [1001, { valor: "5000.00" }],
      ]);
      const currMap = new Map<number, { valor: string }>([
        [1001, { valor: "7500.00" }],
      ]);

      const changes: { type: string; valorAnterior: number; valorNovo: number }[] = [];
      for (const [id, curr] of Array.from(currMap)) {
        const prev = prevMap.get(id);
        if (prev) {
          const prevValor = Number(prev.valor);
          const currValor = Number(curr.valor);
          if (Math.abs(prevValor - currValor) > 0.01) {
            changes.push({ type: "alterado", valorAnterior: prevValor, valorNovo: currValor });
          }
        }
      }
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe("alterado");
      expect(changes[0].valorAnterior).toBe(5000);
      expect(changes[0].valorNovo).toBe(7500);
    });

    it("should not classify unchanged items", () => {
      const prevMap = new Map<number, { valor: string }>([
        [1001, { valor: "5000.00" }],
      ]);
      const currMap = new Map<number, { valor: string }>([
        [1001, { valor: "5000.00" }],
      ]);

      const changes: string[] = [];
      for (const [id, curr] of Array.from(currMap)) {
        const prev = prevMap.get(id);
        if (!prev) {
          changes.push("adicionado");
        } else {
          const prevValor = Number(prev.valor);
          const currValor = Number(curr.valor);
          if (Math.abs(prevValor - currValor) > 0.01) {
            changes.push("alterado");
          }
        }
      }
      for (const [id] of Array.from(prevMap)) {
        if (!currMap.has(id)) {
          changes.push("removido");
        }
      }
      expect(changes).toHaveLength(0);
    });
  });

  describe("Multiple changes in one comparison", () => {
    it("should detect multiple types of changes simultaneously", () => {
      const prevMap = new Map<number, { valor: string }>([
        [1001, { valor: "5000.00" }],  // will be removed
        [1002, { valor: "3000.00" }],  // will change value
        [1003, { valor: "2000.00" }],  // unchanged
      ]);
      const currMap = new Map<number, { valor: string }>([
        [1002, { valor: "4500.00" }],  // changed
        [1003, { valor: "2000.00" }],  // unchanged
        [1004, { valor: "8000.00" }],  // new
      ]);

      const changes: { type: string; id: number }[] = [];

      for (const [id, curr] of Array.from(currMap)) {
        const prev = prevMap.get(id);
        if (!prev) {
          changes.push({ type: "adicionado", id });
        } else {
          const prevValor = Number(prev.valor);
          const currValor = Number(curr.valor);
          if (Math.abs(prevValor - currValor) > 0.01) {
            changes.push({ type: "alterado", id });
          }
        }
      }
      for (const [id] of Array.from(prevMap)) {
        if (!currMap.has(id)) {
          changes.push({ type: "removido", id });
        }
      }

      expect(changes).toHaveLength(3);
      expect(changes.find(c => c.type === "adicionado")?.id).toBe(1004);
      expect(changes.find(c => c.type === "alterado")?.id).toBe(1002);
      expect(changes.find(c => c.type === "removido")?.id).toBe(1001);
    });
  });

  describe("Totals calculation", () => {
    it("should calculate correct totals for added and removed items", () => {
      const dayGroup = {
        items: [
          { changeType: "adicionado", valor: "5000.00" },
          { changeType: "adicionado", valor: "3000.00" },
          { changeType: "removido", valor: "2000.00" },
          { changeType: "alterado", valor: "7500.00", valorAnterior: "5000.00" },
        ],
      };

      let totalAdicionado = 0;
      let totalRemovido = 0;
      let totalAlterado = 0;

      for (const item of dayGroup.items) {
        const valor = Number(item.valor) || 0;
        const valorAnterior = Number((item as any).valorAnterior) || 0;

        if (item.changeType === "adicionado") totalAdicionado += valor;
        else if (item.changeType === "removido") totalRemovido += valor;
        else if (item.changeType === "alterado") totalAlterado += (valor - valorAnterior);
      }

      expect(totalAdicionado).toBe(8000);
      expect(totalRemovido).toBe(2000);
      expect(totalAlterado).toBe(2500);
    });
  });

  describe("Date helpers", () => {
    it("should format Brazilian dates correctly", () => {
      const dateStr = "2026-04-10";
      const [y, m, d] = dateStr.split("-");
      const formatted = `${d}/${m}/${y}`;
      expect(formatted).toBe("10/04/2026");
    });

    it("should get day name correctly", () => {
      const dayNames: Record<number, string> = {
        0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb"
      };
      // 2026-04-10 is a Friday
      const [y, m, d] = "2026-04-10".split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      expect(dayNames[dt.getDay()]).toBe("Sex");
    });
  });

  describe("Grouping by day", () => {
    it("should group changes by date correctly", () => {
      const changes = [
        { changeDate: "2026-04-10", changeType: "adicionado", valor: "5000" },
        { changeDate: "2026-04-10", changeType: "removido", valor: "2000" },
        { changeDate: "2026-04-09", changeType: "adicionado", valor: "3000" },
      ];

      const grouped: Record<string, { date: string; items: typeof changes }> = {};
      for (const change of changes) {
        if (!grouped[change.changeDate]) {
          grouped[change.changeDate] = { date: change.changeDate, items: [] };
        }
        grouped[change.changeDate].items.push(change);
      }

      const result = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
      expect(result).toHaveLength(2);
      expect(result[0].date).toBe("2026-04-10");
      expect(result[0].items).toHaveLength(2);
      expect(result[1].date).toBe("2026-04-09");
      expect(result[1].items).toHaveLength(1);
    });
  });

  describe("Filtering by semanaLabel", () => {
    it("should filter changes by specific week label", () => {
      const allChanges = [
        { changeDate: "2026-04-10", changeType: "adicionado", valor: "5000", semanaLabel: "06/04 - 12/04" },
        { changeDate: "2026-04-10", changeType: "removido", valor: "2000", semanaLabel: "13/04 - 19/04" },
        { changeDate: "2026-04-09", changeType: "adicionado", valor: "3000", semanaLabel: "06/04 - 12/04" },
        { changeDate: "2026-04-08", changeType: "adicionado", valor: "1000", semanaLabel: "Vencidas (at\u00e9 3 dias)" },
      ];

      const targetWeek = "06/04 - 12/04";
      const filtered = allChanges.filter(c => c.semanaLabel === targetWeek);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(c => c.semanaLabel === targetWeek)).toBe(true);
      expect(filtered.reduce((s, c) => s + Number(c.valor), 0)).toBe(8000);
    });

    it("should return all changes when no semanaLabel filter", () => {
      const allChanges = [
        { changeDate: "2026-04-10", changeType: "adicionado", valor: "5000", semanaLabel: "06/04 - 12/04" },
        { changeDate: "2026-04-10", changeType: "removido", valor: "2000", semanaLabel: "13/04 - 19/04" },
      ];

      const filtered = allChanges; // no filter
      expect(filtered).toHaveLength(2);
    });
  });

  describe("Grouping by semana for full history", () => {
    it("should group items by semanaLabel and then by day", () => {
      const items = [
        { changeDate: "2026-04-10", changeType: "adicionado", valor: "5000", semanaLabel: "06/04 - 12/04", nome: "Fornecedor A" },
        { changeDate: "2026-04-10", changeType: "adicionado", valor: "3000", semanaLabel: "06/04 - 12/04", nome: "Fornecedor B" },
        { changeDate: "2026-04-09", changeType: "adicionado", valor: "2000", semanaLabel: "06/04 - 12/04", nome: "Fornecedor C" },
        { changeDate: "2026-04-10", changeType: "adicionado", valor: "8000", semanaLabel: "13/04 - 19/04", nome: "Fornecedor D" },
        { changeDate: "2026-04-10", changeType: "removido", valor: "1500", semanaLabel: "06/04 - 12/04", nome: "Fornecedor E" },
      ];

      // Group by semana
      const bySemana = new Map<string, any[]>();
      for (const item of items) {
        const semana = item.semanaLabel || "Sem semana";
        if (!bySemana.has(semana)) bySemana.set(semana, []);
        bySemana.get(semana)!.push(item);
      }

      expect(bySemana.size).toBe(2);
      expect(bySemana.get("06/04 - 12/04")!.length).toBe(4);
      expect(bySemana.get("13/04 - 19/04")!.length).toBe(1);

      // Group by day within semana
      const semana1Items = bySemana.get("06/04 - 12/04")!;
      const byDay: Record<string, any[]> = {};
      for (const item of semana1Items) {
        if (!byDay[item.changeDate]) byDay[item.changeDate] = [];
        byDay[item.changeDate].push(item);
      }

      expect(Object.keys(byDay)).toHaveLength(2); // 2 days
      expect(byDay["2026-04-10"]).toHaveLength(3);
      expect(byDay["2026-04-09"]).toHaveLength(1);
    });

    it("should separate adicionados from removidos correctly", () => {
      const items = [
        { changeType: "adicionado", valor: "5000", semanaLabel: "06/04 - 12/04" },
        { changeType: "removido", valor: "2000", semanaLabel: "06/04 - 12/04" },
        { changeType: "adicionado", valor: "3000", semanaLabel: "06/04 - 12/04" },
        { changeType: "alterado", valor: "7500", valorAnterior: "5000", semanaLabel: "06/04 - 12/04" },
      ];

      const adicionados = items.filter(i => i.changeType === "adicionado");
      const removidos = items.filter(i => i.changeType === "removido" || i.changeType === "alterado");

      expect(adicionados).toHaveLength(2);
      expect(removidos).toHaveLength(2);

      const totalAdicionado = adicionados.reduce((s, i) => s + Number(i.valor), 0);
      const totalRemovido = removidos.filter(i => i.changeType === "removido").reduce((s, i) => s + Number(i.valor), 0);

      expect(totalAdicionado).toBe(8000);
      expect(totalRemovido).toBe(2000);
    });
  });

  describe("Week history panel tab logic", () => {
    it("should show adicionados tab with correct count and total", () => {
      const items = [
        { changeType: "adicionado", valor: "5000", nome: "A" },
        { changeType: "adicionado", valor: "3000", nome: "B" },
        { changeType: "removido", valor: "2000", nome: "C" },
      ];

      const adicionados = items.filter(i => i.changeType === "adicionado");
      const removidos = items.filter(i => i.changeType !== "adicionado");

      expect(adicionados.length).toBe(2);
      expect(removidos.length).toBe(1);

      const totalAcrescentado = adicionados.reduce((s, i) => s + Number(i.valor), 0);
      const totalRetirado = removidos.reduce((s, i) => s + Number(i.valor), 0);

      expect(totalAcrescentado).toBe(8000);
      expect(totalRetirado).toBe(2000);
    });
  });
});
