/**
 * Financial History - Snapshot & Change Detection
 * 
 * Salva snapshots diários dos títulos EMITIDO (a pagar e a receber).
 * Compara snapshots entre dias para detectar mudanças:
 * - Títulos adicionados (novos)
 * - Títulos removidos (pagos/cancelados)
 * - Títulos com valor alterado
 * 
 * Rastreia todas as 8 semanas do calendário financeiro.
 */

import { getDb } from "./db";
import { accountsPayable, accountsReceivable, financialSnapshots, financialChanges } from "../drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

const RECEIVABLE_VALID_TYPES = ["TITULO", "RECEITA", "ADIANTAMENTO"];

/** Retorna a data de hoje em Brasília como string YYYY-MM-DD */
function getTodayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Adiciona N dias a uma string YYYY-MM-DD e retorna YYYY-MM-DD */
function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return dt.toISOString().slice(0, 10);
}

/** Retorna o dia da semana (0=Dom, 6=Sab) para uma string YYYY-MM-DD */
function getDayOfWeekStr(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Ajusta sábado/domingo para segunda-feira seguinte */
function adjustWeekendStr(dateStr: string): string {
  const dow = getDayOfWeekStr(dateStr);
  if (dow === 6) return addDaysStr(dateStr, 2);
  if (dow === 0) return addDaysStr(dateStr, 1);
  return dateStr;
}

/** Calcula os limites das 8 semanas a partir de hoje */
function getWeekBoundaries(todayStr: string) {
  const dayOfWeek = getDayOfWeekStr(todayStr);
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayStr = addDaysStr(todayStr, daysToMonday);

  const weeks: { start: string; end: string; label: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const wStart = addDaysStr(mondayStr, i * 7);
    const wEnd = addDaysStr(wStart, 6);
    const dd1 = wStart.slice(8, 10);
    const mm1 = wStart.slice(5, 7);
    const dd2 = wEnd.slice(8, 10);
    const mm2 = wEnd.slice(5, 7);
    weeks.push({ start: wStart, end: wEnd, label: `${dd1}/${mm1} - ${dd2}/${mm2}` });
  }
  return weeks;
}

/** Determina em qual semana um título cai */
function getWeekLabel(vencStr: string, todayStr: string, weeks: { start: string; end: string; label: string }[]): string {
  const adjVenc = adjustWeekendStr(vencStr);
  if (adjVenc < todayStr) {
    // Em vez de "Vencidas", mostrar a data real: "Venc. antes de DD/MM"
    const dd = todayStr.slice(8, 10);
    const mm = todayStr.slice(5, 7);
    return `Venc. antes de ${dd}/${mm}`;
  }
  for (const w of weeks) {
    if (adjVenc >= w.start && adjVenc <= w.end) return w.label;
  }
  // Em vez de "Além de 8 semanas", mostrar a data real
  if (weeks.length > 0) {
    const lastWeek = weeks[weeks.length - 1];
    const dd = lastWeek.end.slice(8, 10);
    const mm = lastWeek.end.slice(5, 7);
    return `Após ${dd}/${mm}`;
  }
  return "Além de 8 semanas";
}

interface SnapshotItem {
  maxiprodId: number;
  nome: string;
  valor: number;
  vencimentoData: string | null;
  referenteA: string | null;
  observacoes: string | null;
  parcela: string | null;
  empresaNome: string | null;
}

/**
 * Salva um snapshot dos títulos EMITIDO atuais.
 * Chamado diariamente (ou manualmente) para registrar o estado do dia.
 */
export async function saveFinancialSnapshot(dateStr?: string): Promise<{ payableCount: number; receivableCount: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const snapshotDate = dateStr || getTodayBR();

  // Deletar snapshot existente para este dia (para permitir re-execução)
  await db.delete(financialSnapshots).where(eq(financialSnapshots.snapshotDate, snapshotDate));

  // Buscar contas a pagar EMITIDO
  const payables = await db
    .select({
      maxiprodId: accountsPayable.maxiprodId,
      nome: accountsPayable.fornecedor,
      valorLiquido: accountsPayable.valorLiquido,
      valorPagoLiquido: accountsPayable.valorPagoLiquido,
      vencimentoData: accountsPayable.vencimentoData,
      referenteA: accountsPayable.referenteA,
      observacoes: accountsPayable.observacoes,
      parcela: accountsPayable.parcela,
      parcelasQuantidadeTotal: accountsPayable.parcelasQuantidadeTotal,
      empresaNome: accountsPayable.empresaNome,
    })
    .from(accountsPayable)
    .where(eq(accountsPayable.estado, "EMITIDO"));

  // Buscar contas a receber EMITIDO (tipos válidos)
  const receivables = await db
    .select({
      maxiprodId: accountsReceivable.maxiprodId,
      nome: accountsReceivable.cliente,
      valorLiquido: accountsReceivable.valorLiquido,
      valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
      vencimentoData: accountsReceivable.vencimentoData,
      referenteA: accountsReceivable.referenteA,
      observacoes: accountsReceivable.observacoes,
      parcela: accountsReceivable.parcela,
      parcelasQuantidadeTotal: accountsReceivable.parcelasQuantidadeTotal,
      empresaNome: accountsReceivable.empresaNome,
    })
    .from(accountsReceivable)
    .where(and(eq(accountsReceivable.estado, "EMITIDO"), inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES)));

  // Inserir snapshots em batches
  const batchSize = 200;

  for (let i = 0; i < payables.length; i += batchSize) {
    const batch = payables.slice(i, i + batchSize);
    await db.insert(financialSnapshots).values(batch.map(p => ({
      snapshotDate,
      tipo: "pagar" as const,
      maxiprodId: p.maxiprodId,
      nome: p.nome || p.referenteA || p.observacoes || "Sem nome",
      valor: String((Number(p.valorLiquido) || 0) - (Number(p.valorPagoLiquido) || 0)),
      vencimentoData: p.vencimentoData?.split("T")[0] || null,
      referenteA: p.referenteA || null,
      observacoes: p.observacoes || null,
      parcela: p.parcela && p.parcelasQuantidadeTotal ? `${p.parcela}/${p.parcelasQuantidadeTotal}` : null,
      empresaNome: p.empresaNome || null,
    })));
  }

  for (let i = 0; i < receivables.length; i += batchSize) {
    const batch = receivables.slice(i, i + batchSize);
    await db.insert(financialSnapshots).values(batch.map(r => ({
      snapshotDate,
      tipo: "receber" as const,
      maxiprodId: r.maxiprodId,
      nome: r.nome || "Sem nome",
      valor: String((Number(r.valorLiquido) || 0) - (Number(r.valorRecebidoLiquido) || 0)),
      vencimentoData: r.vencimentoData?.split("T")[0] || null,
      referenteA: r.referenteA || null,
      observacoes: r.observacoes || null,
      parcela: r.parcela && r.parcelasQuantidadeTotal ? `${r.parcela}/${r.parcelasQuantidadeTotal}` : null,
      empresaNome: r.empresaNome || null,
    })));
  }

  console.log(`[FinancialHistory] Snapshot salvo para ${snapshotDate}: ${payables.length} pagar, ${receivables.length} receber`);
  return { payableCount: payables.length, receivableCount: receivables.length };
}

/**
 * Compara dois snapshots e registra as mudanças detectadas.
 * @param previousDate - Data do snapshot anterior (YYYY-MM-DD)
 * @param currentDate - Data do snapshot atual (YYYY-MM-DD)
 */
export async function detectFinancialChanges(previousDate: string, currentDate: string): Promise<{
  pagarChanges: number;
  receberChanges: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const todayStr = currentDate;
  const weeks = getWeekBoundaries(todayStr);

  // Deletar mudanças existentes para este par de datas
  await db.delete(financialChanges).where(eq(financialChanges.changeDate, currentDate));

  let pagarChanges = 0;
  let receberChanges = 0;

  for (const tipo of ["pagar", "receber"] as const) {
    // Buscar snapshots anterior e atual
    const prevItems = await db
      .select()
      .from(financialSnapshots)
      .where(and(eq(financialSnapshots.snapshotDate, previousDate), eq(financialSnapshots.tipo, tipo)));

    const currItems = await db
      .select()
      .from(financialSnapshots)
      .where(and(eq(financialSnapshots.snapshotDate, currentDate), eq(financialSnapshots.tipo, tipo)));

    // Criar mapas por maxiprodId
    const prevMap = new Map(prevItems.map(item => [item.maxiprodId, item]));
    const currMap = new Map(currItems.map(item => [item.maxiprodId, item]));

    const changesToInsert: any[] = [];

    // Detectar títulos ADICIONADOS (estão no atual mas não no anterior)
    for (const [id, curr] of Array.from(currMap)) {
      const prev = prevMap.get(id);
      if (!prev) {
        // Novo título
        const semanaLabel = curr.vencimentoData ? getWeekLabel(curr.vencimentoData, todayStr, weeks) : "Sem vencimento";
        changesToInsert.push({
          changeDate: currentDate,
          tipo,
          changeType: "adicionado",
          maxiprodId: id,
          nome: curr.nome,
          valor: curr.valor,
          valorAnterior: null,
          vencimentoData: curr.vencimentoData,
          referenteA: curr.referenteA,
          observacoes: curr.observacoes,
          parcela: curr.parcela,
          empresaNome: curr.empresaNome,
          semanaLabel,
        });
      } else {
        // Verificar se o valor mudou
        const prevValor = Number(prev.valor);
        const currValor = Number(curr.valor);
        if (Math.abs(prevValor - currValor) > 0.01) {
          const semanaLabel = curr.vencimentoData ? getWeekLabel(curr.vencimentoData, todayStr, weeks) : "Sem vencimento";
          changesToInsert.push({
            changeDate: currentDate,
            tipo,
            changeType: "alterado",
            maxiprodId: id,
            nome: curr.nome,
            valor: String(currValor),
            valorAnterior: String(prevValor),
            vencimentoData: curr.vencimentoData,
            referenteA: curr.referenteA,
            observacoes: curr.observacoes,
            parcela: curr.parcela,
            empresaNome: curr.empresaNome,
            semanaLabel,
          });
        }
      }
    }

    // Detectar títulos REMOVIDOS (estavam no anterior mas não no atual)
    for (const [id, prev] of Array.from(prevMap)) {
      if (!currMap.has(id)) {
        const semanaLabel = prev.vencimentoData ? getWeekLabel(prev.vencimentoData, todayStr, weeks) : "Sem vencimento";
        changesToInsert.push({
          changeDate: currentDate,
          tipo,
          changeType: "removido",
          maxiprodId: id,
          nome: prev.nome,
          valor: prev.valor,
          valorAnterior: null,
          vencimentoData: prev.vencimentoData,
          referenteA: prev.referenteA,
          observacoes: prev.observacoes,
          parcela: prev.parcela,
          empresaNome: prev.empresaNome,
          semanaLabel,
        });
      }
    }

    // Inserir mudanças em batches
    if (changesToInsert.length > 0) {
      for (let i = 0; i < changesToInsert.length; i += 200) {
        const batch = changesToInsert.slice(i, i + 200);
        await db.insert(financialChanges).values(batch);
      }
    }

    if (tipo === "pagar") pagarChanges = changesToInsert.length;
    else receberChanges = changesToInsert.length;

    console.log(`[FinancialHistory] ${tipo}: ${changesToInsert.length} mudanças detectadas (${currentDate} vs ${previousDate})`);
  }

  return { pagarChanges, receberChanges };
}

/**
 * Busca o histórico de mudanças para exibir no frontend.
 * @param tipo - "pagar" ou "receber"
 * @param fromDate - Data inicial (YYYY-MM-DD), default: início do mês
 * @param toDate - Data final (YYYY-MM-DD), default: hoje
 */
export async function getFinancialChanges(tipo: "pagar" | "receber", fromDate?: string, toDate?: string, semanaLabel?: string) {
  const db = await getDb();
  if (!db) return [];

  const todayStr = getTodayBR();
  const from = fromDate || `${todayStr.slice(0, 7)}-01`; // início do mês
  const to = toDate || todayStr;

  const conditions = [
    eq(financialChanges.tipo, tipo),
    sql`${financialChanges.changeDate} >= ${from}`,
    sql`${financialChanges.changeDate} <= ${to}`,
  ];
  if (semanaLabel) {
    conditions.push(eq(financialChanges.semanaLabel, semanaLabel));
  }

  const changes = await db
    .select()
    .from(financialChanges)
    .where(and(...conditions))
    .orderBy(sql`${financialChanges.changeDate} DESC, ${financialChanges.changeType} ASC`);

  // Agrupar por dia
  const grouped: Record<string, {
    date: string;
    totalAdicionado: number;
    totalRemovido: number;
    totalAlterado: number;
    items: typeof changes;
  }> = {};

  for (const change of changes) {
    if (!grouped[change.changeDate]) {
      grouped[change.changeDate] = {
        date: change.changeDate,
        totalAdicionado: 0,
        totalRemovido: 0,
        totalAlterado: 0,
        items: [],
      };
    }
    const group = grouped[change.changeDate];
    const valor = Number(change.valor) || 0;
    const valorAnterior = Number(change.valorAnterior) || 0;

    if (change.changeType === "adicionado") group.totalAdicionado += valor;
    else if (change.changeType === "removido") group.totalRemovido += valor;
    else if (change.changeType === "alterado") group.totalAlterado += (valor - valorAnterior);

    group.items.push(change);
  }

  return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Lista as datas de snapshots disponíveis
 */
export async function getSnapshotDates(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({ date: financialSnapshots.snapshotDate })
    .from(financialSnapshots)
    .groupBy(financialSnapshots.snapshotDate)
    .orderBy(sql`${financialSnapshots.snapshotDate} DESC`);

  return rows.map(r => r.date);
}
