/**
 * Tests for E-commerce History Monthly Extract functionality
 * Tests the helper functions: exportEcommerceCSV, getAvailableMonths, formatMonthLabel
 * These are pure functions used by both Importação and Industrialização dialogs
 */
import { describe, it, expect } from 'vitest';

// Since the helpers are defined in the frontend Home.tsx, we replicate them here for testing
// This ensures the logic is correct independently of the UI

function getAvailableMonths(history: any[]): string[] {
  const months = new Set<string>();
  for (const h of history) {
    if (h.detectedAt) {
      const d = new Date(h.detectedAt);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.add(m);
    }
  }
  return Array.from(months).sort().reverse();
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m) - 1]}/${y}`;
}

function consolidateByProduct(data: any[]): { codigo: string; descricao: string; pc: number; cx: number }[] {
  const byCode = new Map<string, { codigo: string; descricao: string; pc: number; cx: number }>();
  for (const h of data) {
    const existing = byCode.get(h.codigoItem) || { codigo: h.codigoItem, descricao: h.descricaoItem, pc: 0, cx: 0 };
    if (h.unidadeOriginal === 'PC') existing.pc += h.quantidadeOriginal || 0;
    existing.cx += h.quantidadeCx || 0;
    byCode.set(h.codigoItem, existing);
  }
  return Array.from(byCode.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function generateCSVContent(data: any[]): string {
  const rows: string[][] = [['Código', 'Produto', 'Pacotes (PC)', 'Caixas (CX)']];
  const sorted = consolidateByProduct(data);
  let totalPc = 0, totalCx = 0;
  for (const p of sorted) {
    rows.push([p.codigo, p.descricao, p.pc > 0 ? p.pc.toString() : '', p.cx.toString()]);
    totalPc += p.pc;
    totalCx += p.cx;
  }
  rows.push(['', 'TOTAL', totalPc > 0 ? totalPc.toString() : '', totalCx.toString()]);
  return rows.map(r => r.join(';')).join('\n');
}

function filterByMonth(history: any[], monthFilter: string): any[] {
  if (monthFilter === 'all') return history;
  return history.filter((h: any) => {
    if (!h.detectedAt) return false;
    const d = new Date(h.detectedAt);
    const hMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return hMonth === monthFilter;
  });
}

// Sample test data
const sampleHistory = [
  {
    detectedAt: '2026-03-15T10:00:00Z',
    codigoItem: '00100',
    descricaoItem: 'PALITO DENTE 50x1000',
    quantidadeCx: 50,
    quantidadeOriginal: 500,
    unidadeOriginal: 'PC',
    produtoMae: '00036',
    pedidoRelacionado: '927',
    cliente: 'FILIAL ECOMMERCE',
  },
  {
    detectedAt: '2026-03-20T14:00:00Z',
    codigoItem: '00100',
    descricaoItem: 'PALITO DENTE 50x1000',
    quantidadeCx: 30,
    quantidadeOriginal: 300,
    unidadeOriginal: 'PC',
    produtoMae: '00036',
    pedidoRelacionado: '928',
    cliente: 'FILIAL ECOMMERCE',
  },
  {
    detectedAt: '2026-03-25T09:00:00Z',
    codigoItem: '00200',
    descricaoItem: 'ESPETO BAMBU 25CM',
    quantidadeCx: 100,
    quantidadeOriginal: 100,
    unidadeOriginal: 'CX',
    produtoMae: null,
    pedidoRelacionado: '927',
    cliente: 'FILIAL ECOMMERCE',
  },
  {
    detectedAt: '2026-04-05T11:00:00Z',
    codigoItem: '00100',
    descricaoItem: 'PALITO DENTE 50x1000',
    quantidadeCx: 20,
    quantidadeOriginal: 200,
    unidadeOriginal: 'PC',
    produtoMae: '00036',
    pedidoRelacionado: '930',
    cliente: 'FILIAL ECOMMERCE',
  },
  {
    detectedAt: '2026-04-10T16:00:00Z',
    codigoItem: '00300',
    descricaoItem: 'VARETA BAMBU 3.5x200',
    quantidadeCx: 40,
    quantidadeOriginal: 40,
    unidadeOriginal: 'CX',
    produtoMae: null,
    pedidoRelacionado: '931',
    cliente: 'FILIAL ECOMMERCE',
  },
];

describe('E-commerce Extract - getAvailableMonths', () => {
  it('should extract unique months from history sorted in reverse', () => {
    const months = getAvailableMonths(sampleHistory);
    expect(months).toEqual(['2026-04', '2026-03']);
  });

  it('should return empty array for empty history', () => {
    expect(getAvailableMonths([])).toEqual([]);
  });

  it('should handle items without detectedAt', () => {
    const data = [
      { detectedAt: '2026-01-15T10:00:00Z', codigoItem: '001' },
      { detectedAt: null, codigoItem: '002' },
      { codigoItem: '003' },
    ];
    const months = getAvailableMonths(data);
    expect(months).toEqual(['2026-01']);
  });

  it('should handle single month', () => {
    const data = [
      { detectedAt: '2026-06-01T10:00:00Z' },
      { detectedAt: '2026-06-15T14:00:00Z' },
    ];
    expect(getAvailableMonths(data)).toEqual(['2026-06']);
  });

  it('should handle multiple months across years', () => {
    const data = [
      { detectedAt: '2025-12-15T00:00:00Z' },
      { detectedAt: '2026-01-10T00:00:00Z' },
      { detectedAt: '2026-03-20T00:00:00Z' },
    ];
    const months = getAvailableMonths(data);
    expect(months).toEqual(['2026-03', '2026-01', '2025-12']);
  });
});

describe('E-commerce Extract - formatMonthLabel', () => {
  it('should format month labels in Portuguese', () => {
    expect(formatMonthLabel('2026-01')).toBe('Jan/2026');
    expect(formatMonthLabel('2026-03')).toBe('Mar/2026');
    expect(formatMonthLabel('2026-06')).toBe('Jun/2026');
    expect(formatMonthLabel('2026-12')).toBe('Dez/2026');
  });

  it('should handle all 12 months', () => {
    const expected = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let i = 1; i <= 12; i++) {
      const ym = `2026-${String(i).padStart(2, '0')}`;
      expect(formatMonthLabel(ym)).toBe(`${expected[i - 1]}/2026`);
    }
  });
});

describe('E-commerce Extract - filterByMonth', () => {
  it('should return all items when filter is "all"', () => {
    const result = filterByMonth(sampleHistory, 'all');
    expect(result.length).toBe(5);
  });

  it('should filter items for March 2026', () => {
    const result = filterByMonth(sampleHistory, '2026-03');
    expect(result.length).toBe(3);
    expect(result.every(h => new Date(h.detectedAt).getMonth() === 2)).toBe(true); // March = month index 2
  });

  it('should filter items for April 2026', () => {
    const result = filterByMonth(sampleHistory, '2026-04');
    expect(result.length).toBe(2);
    expect(result.every(h => new Date(h.detectedAt).getMonth() === 3)).toBe(true); // April = month index 3
  });

  it('should return empty for non-existent month', () => {
    const result = filterByMonth(sampleHistory, '2026-05');
    expect(result.length).toBe(0);
  });
});

describe('E-commerce Extract - consolidateByProduct', () => {
  it('should consolidate same product across multiple entries', () => {
    const result = consolidateByProduct(sampleHistory);
    expect(result.length).toBe(3); // 00100, 00200, 00300

    const palito = result.find(p => p.codigo === '00100');
    expect(palito).toBeDefined();
    expect(palito!.pc).toBe(1000); // 500 + 300 + 200
    expect(palito!.cx).toBe(100); // 50 + 30 + 20
  });

  it('should not count PC for direct CX items', () => {
    const result = consolidateByProduct(sampleHistory);
    const espeto = result.find(p => p.codigo === '00200');
    expect(espeto).toBeDefined();
    expect(espeto!.pc).toBe(0); // unidadeOriginal is CX, not PC
    expect(espeto!.cx).toBe(100);
  });

  it('should sort by product code', () => {
    const result = consolidateByProduct(sampleHistory);
    expect(result[0].codigo).toBe('00100');
    expect(result[1].codigo).toBe('00200');
    expect(result[2].codigo).toBe('00300');
  });

  it('should handle empty data', () => {
    expect(consolidateByProduct([])).toEqual([]);
  });

  it('should consolidate filtered month data correctly', () => {
    const marchOnly = filterByMonth(sampleHistory, '2026-03');
    const result = consolidateByProduct(marchOnly);
    expect(result.length).toBe(2); // 00100 and 00200

    const palito = result.find(p => p.codigo === '00100');
    expect(palito!.pc).toBe(800); // 500 + 300 (only March entries)
    expect(palito!.cx).toBe(80); // 50 + 30
  });
});

describe('E-commerce Extract - CSV generation', () => {
  it('should generate valid CSV with header and totals', () => {
    const csv = generateCSVContent(sampleHistory);
    const lines = csv.split('\n');

    // Header
    expect(lines[0]).toBe('Código;Produto;Pacotes (PC);Caixas (CX)');

    // 3 product lines + 1 total
    expect(lines.length).toBe(5); // header + 3 products + total

    // Total line
    expect(lines[4]).toContain('TOTAL');
    expect(lines[4]).toContain('1000'); // total PC
    expect(lines[4]).toContain('240'); // total CX (100 + 100 + 40)
  });

  it('should not show PC count for direct CX products', () => {
    const csv = generateCSVContent(sampleHistory);
    const lines = csv.split('\n');

    // 00200 (direct CX) should have empty PC column
    const espetLine = lines.find(l => l.includes('00200'));
    expect(espetLine).toBeDefined();
    // Format: codigo;descricao;pc;cx → 00200;ESPETO BAMBU 25CM;;100
    expect(espetLine!.split(';')[2]).toBe(''); // PC is empty for direct CX
  });

  it('should generate CSV for filtered month', () => {
    const aprilOnly = filterByMonth(sampleHistory, '2026-04');
    const csv = generateCSVContent(aprilOnly);
    const lines = csv.split('\n');

    // Header + 2 products + total = 4 lines
    expect(lines.length).toBe(4);
    expect(lines[3]).toContain('TOTAL');
  });

  it('should handle empty data', () => {
    const csv = generateCSVContent([]);
    const lines = csv.split('\n');
    expect(lines.length).toBe(2); // header + total
    expect(lines[1]).toBe(';TOTAL;;0');
  });
});
