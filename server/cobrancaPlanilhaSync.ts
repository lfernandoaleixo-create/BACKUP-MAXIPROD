/**
 * Cobrança Planilha Auto-Sync
 * 
 * Lightweight sync that runs automatically after each Maxiprod sync.
 * It does two things:
 * 1. Deactivates titles in cobranca_planilha whose underlying accounts_receivable
 *    record is no longer EMITIDO (i.e., it was paid/liquidated).
 * 2. Adds new overdue titles that appeared since the last sync.
 * 
 * This does NOT call the full syncFromInadimplencia (which enriches data from GraphQL),
 * because that would be too heavy to run every 5 minutes. Instead, it does a fast
 * database-only check.
 */

import { getDb } from "./db";
import { cobrancaPlanilha, accountsReceivable, collectionActions, salesOrders } from "../drizzle/schema";
import { eq, and, inArray, lte, isNull, sql, desc } from "drizzle-orm";
import { gql } from "./maxiprodGraphQL";

// Clientes com vendedor fixo "Grupo Fox"
const CLIENTES_GRUPO_FOX = ["JOHNSON", "KEURE", "S C JOHNSON", "SC JOHNSON", "S. C. JOHNSON"];
function isClienteGrupoFox(empresa: string): boolean {
  const upper = empresa.toUpperCase();
  return CLIENTES_GRUPO_FOX.some(c => upper.includes(c));
}
function normalizeName(name: string): string {
  return name.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Tipos válidos de contas a receber (mesmo filtro da inadimplência)
const RECEIVABLE_VALID_TYPES = ["TITULO", "RECEITA", "ADIANTAMENTO"];

// Clientes de teste a ignorar
const TEST_CLIENTS = ['CLIENTE TESTE REGRA', 'CLIENTE MANUAL TICK TEST', 'CLIENTE LEGACY VIBRATION TEST', 'CLIENTE RECENT VIBRATION TEST', 'CLIENTE TESTE COBRANCA'];

/** Retorna a data de hoje em Brasília como string YYYY-MM-DD */
function getTodayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Feriados nacionais fixos + variáveis (Páscoa, Carnaval, Corpus Christi) */
function isHoliday(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const fixos = [`${y}-01-01`, `${y}-04-21`, `${y}-05-01`, `${y}-09-07`, `${y}-10-12`, `${y}-11-02`, `${y}-11-15`, `${y}-12-25`];
  if (fixos.includes(dateStr)) return true;
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const dd = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - dd - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * mm + 114) / 31);
  const day = ((h + l - 7 * mm + 114) % 31) + 1;
  const easter = new Date(y, month - 1, day);
  const fmt = (dt: Date) => dt.toISOString().split('T')[0];
  const carnaval = new Date(easter); carnaval.setDate(carnaval.getDate() - 47);
  const sextaSanta = new Date(easter); sextaSanta.setDate(sextaSanta.getDate() - 2);
  const corpusChristi = new Date(easter); corpusChristi.setDate(corpusChristi.getDate() + 60);
  const variaveis = [fmt(carnaval), fmt(sextaSanta), fmt(easter), fmt(corpusChristi)];
  return variaveis.includes(dateStr);
}

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return dt.toISOString().split('T')[0];
}

function isBusinessDay(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow !== 0 && dow !== 6 && !isHoliday(dateStr);
}

/** Retorna o dia útil anterior a hoje */
function getPreviousBusinessDay(): string {
  const todayStr = getTodayBR();
  let candidate = addDaysStr(todayStr, -1);
  for (let i = 0; i < 10; i++) {
    if (isBusinessDay(candidate)) return candidate;
    candidate = addDaysStr(candidate, -1);
  }
  return candidate;
}

/** Conta quantos dias úteis passaram entre fromDate (exclusivo) e toDate (inclusivo) */
function countBusinessDays(fromDateStr: string, toDateStr: string): number {
  let count = 0;
  let current = addDaysStr(fromDateStr, 1);
  while (current <= toDateStr) {
    if (isBusinessDay(current)) count++;
    current = addDaysStr(current, 1);
  }
  return count;
}

// Mapeamento de status da inadimplência → planilha de cobrança
const STATUS_MAP: Record<string, string> = {
  pendente: "Pendente",
  contatado: "Contatado",
  em_negociacao: "Em negociação",
  promessa: "Promessa de Pgto",
  especial_sem_cobranca: "Especial s/ cobrança",
  protesto_em_analise: "Protesto em Análise",
  protestado: "Protestado",
  cheque_compensacao: "Cheque em compensação",
  nao_retornou: "Não deu retorno",
  nao_atendeu: "Não atendeu",
  juridico: "Jurídico",
};

export async function syncCobrancaPlanilhaAuto(): Promise<{ added: number; deactivated: number; total: number }> {
  const db = await getDb();
  if (!db) return { added: 0, deactivated: 0, total: 0 };

  const cutoff = getPreviousBusinessDay();
  const todayStr = getTodayBR();

  // 1. Get all currently active planilha items
  const activePlanilha = await db.select().from(cobrancaPlanilha).where(eq(cobrancaPlanilha.ativo, true));

  // 2. Get all EMITIDO overdue titles from accounts_receivable (same logic as syncFromInadimplencia)
  const overdueRows = await db
    .select({
      id: accountsReceivable.id,
      cliente: accountsReceivable.cliente,
      valorLiquido: accountsReceivable.valorLiquido,
      valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
      vencimentoData: accountsReceivable.vencimentoData,
      referenteA: accountsReceivable.referenteA,
      tipo: accountsReceivable.tipo,
      formaCobranca: accountsReceivable.formaCobranca,
      decisaoCobranca: accountsReceivable.decisaoCobranca,
      empresaNome: accountsReceivable.empresaNome,
      documentoVinculadoNumero: accountsReceivable.documentoVinculadoNumero,
      parcela: accountsReceivable.parcela,
      parcelasQuantidadeTotal: accountsReceivable.parcelasQuantidadeTotal,
      // estadoConfiguravel not available on ContaReceber in GraphQL API
    })
    .from(accountsReceivable)
    .where(
      and(
        eq(accountsReceivable.estado, "EMITIDO"),
        inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
        lte(accountsReceivable.vencimentoData, cutoff + "T23:59:59")
      )
    );

  // Filter out test clients and zero-value titles
  const validOverdue = overdueRows
    .map(row => {
      const valorOriginal = Number(row.valorLiquido) || 0;
      const valorPago = Number(row.valorRecebidoLiquido) || 0;
      const valorAReceber = valorOriginal - valorPago;
      const vencDate = (row.vencimentoData || "").split("T")[0];
      return { arId: row.id, empresa: (row.cliente || "").trim(), valorAReceber, vencDate, row };
    })
    .filter(t => t.valorAReceber > 0)
    .filter(t => !TEST_CLIENTS.includes(t.empresa.toUpperCase().trim()));

  const validOverdueArIds = new Set(validOverdue.map(t => t.arId));

  // 3. DEACTIVATE: planilha items whose arId is no longer in the overdue list
  let deactivated = 0;
  for (const item of activePlanilha) {
    if (item.arId && !validOverdueArIds.has(item.arId)) {
      // The underlying title is no longer EMITIDO or no longer overdue → deactivate
      await db.update(cobrancaPlanilha)
        .set({ ativo: false, updatedBy: "Auto-sync (título pago/resolvido)" })
        .where(eq(cobrancaPlanilha.id, item.id));
      deactivated++;
    }
  }

  // 4. ADD: overdue titles that don't exist in the planilha yet (no arId match)
  const existingArIds = new Set(activePlanilha.map(p => p.arId).filter(Boolean));
  // Also check inactive records to avoid re-adding deactivated ones
  const allPlanilha = await db.select({ arId: cobrancaPlanilha.arId }).from(cobrancaPlanilha);
  const allPlanilhaArIds = new Set(allPlanilha.map(p => p.arId).filter(Boolean));

  // Get collection actions for status mapping
  const allActions = await db.select().from(collectionActions);
  const actionsMap: Record<number, typeof allActions[0]> = {};
  for (const a of allActions) {
    actionsMap[a.receivableId] = a;
  }

  let added = 0;
  for (const title of validOverdue) {
    if (!allPlanilhaArIds.has(title.arId)) {
      // New title not in planilha at all → add it
      const vencDate = title.vencDate;
      const diasAtrasoRaw = Math.floor((new Date(todayStr).getTime() - new Date(vencDate).getTime()) / 86400000);
      const businessDaysOverdue = diasAtrasoRaw > 0 ? countBusinessDays(vencDate, todayStr) : 0;
      const action = actionsMap[title.arId];
      const statusInad = action?.status || "pendente";
      const statusPlanilha = STATUS_MAP[statusInad] || "Pendente";

      // Determine tipo (protesto)
      const decisao = (title.row.decisaoCobranca || "").toUpperCase();
      let tipoPlanilha = "SEM PROTESTO";
      if (decisao.includes("COM PROTESTO")) {
        tipoPlanilha = "COM PROTESTO (CARTÓRIO)";
      }

      // Build documento string (NF + parcela)
      const docNum = title.row.documentoVinculadoNumero;
      const parcela = title.row.parcela;
      const totalParcelas = title.row.parcelasQuantidadeTotal;
      let documento: string | null = null;
      if (docNum) {
        documento = `NF ${docNum}`;
        if (parcela && totalParcelas) {
          documento += ` (${parcela}/${totalParcelas})`;
        } else if (parcela) {
          documento += ` (${parcela})`;
        }
      }

      // Centro: will be populated from sales_orders lookup (see below)
      const centroCustos: string | null = null; // populated after insert via batch update

      await db.insert(cobrancaPlanilha).values({
        arId: title.arId,
        empresa: title.empresa,
        descricao: title.row.referenteA || null,
        valor: String(title.valorAReceber),
        vencimento: vencDate,
        diasVencidos: businessDaysOverdue,
        tipo: tipoPlanilha,
        status: statusPlanilha,
        formaCobranca: title.row.formaCobranca || null,
        documento,
        centroCustos,
        updatedBy: "Auto-sync (novo título vencido)",
      });
      added++;
    }
  }

  // 4b. Populate apelido and vendedor for items that don't have them yet
  const itemsWithoutApelido = await db.select({ id: cobrancaPlanilha.id, empresa: cobrancaPlanilha.empresa })
    .from(cobrancaPlanilha)
    .where(and(eq(cobrancaPlanilha.ativo, true), isNull(cobrancaPlanilha.apelido)));
  
  if (itemsWithoutApelido.length > 0) {
    // Fetch apelido from Maxiprod GraphQL empresas
    const apelidoMap: Record<string, string> = {};
    const vendedorMap: Record<string, string> = {};
    try {
      const PAGE_SIZE = 200;
      let skip = 0;
      let total = 0;
      do {
        const resp = await gql<any>(`{
          empresas(skip: ${skip}, take: ${PAGE_SIZE}, where: { cliente: { eq: true } }) {
            totalCount
            items {
              nomeFantasia
              razaoSocial
              apelido
              representanteOuVendedor1Preferencial { nomeFantasia razaoSocial }
            }
          }
        }`);
        if (!resp?.empresas) break;
        total = resp.empresas.totalCount;
        for (const emp of resp.empresas.items) {
          const names = [emp.nomeFantasia, emp.razaoSocial, emp.apelido].filter(Boolean);
          const normalizedNames = names.map((n: string) => normalizeName(n));
          
          // Map apelido: use apelido field if available, otherwise nomeFantasia
          const apelidoValue = (emp.apelido || emp.nomeFantasia || "").trim();
          if (apelidoValue) {
            for (const normName of normalizedNames) {
              if (!apelidoMap[normName]) apelidoMap[normName] = apelidoValue;
            }
          }
          
          // Map vendedor
          const rep = emp.representanteOuVendedor1Preferencial;
          if (rep) {
            const vendedorName = rep.nomeFantasia || rep.razaoSocial || "";
            if (vendedorName) {
              for (const normName of normalizedNames) {
                if (!vendedorMap[normName]) vendedorMap[normName] = vendedorName;
              }
            }
          }
        }
        skip += PAGE_SIZE;
      } while (skip < total);
    } catch (e) {
      console.error("[Auto-sync] Erro ao buscar apelidos do Maxiprod:", e);
    }
    
    // Update items missing apelido/vendedor
    for (const item of itemsWithoutApelido) {
      const normEmp = normalizeName(item.empresa);
      const apelido = apelidoMap[normEmp];
      const vendedor = isClienteGrupoFox(item.empresa) ? "Grupo Fox" : vendedorMap[normEmp];
      const updateData: Record<string, any> = {};
      if (apelido) updateData.apelido = apelido;
      if (vendedor) updateData.vendedor = vendedor;
      if (Object.keys(updateData).length > 0) {
        await db.update(cobrancaPlanilha)
          .set(updateData)
          .where(eq(cobrancaPlanilha.id, item.id));
      }
    }
  }

  // 4c. Populate centroCustos for items that don't have it yet
  // Use the most common estadoConfiguravel from sales_orders for each client
  const itemsWithoutCentro = await db.select({ id: cobrancaPlanilha.id, empresa: cobrancaPlanilha.empresa })
    .from(cobrancaPlanilha)
    .where(and(eq(cobrancaPlanilha.ativo, true), isNull(cobrancaPlanilha.centroCustos)));
  
  if (itemsWithoutCentro.length > 0) {
    // Get the most common estadoConfiguravel per client from sales_orders
    const clienteNames = Array.from(new Set(itemsWithoutCentro.map(i => i.empresa)));
    const centroMap: Record<string, string> = {};
    
    for (const cliente of clienteNames) {
      const [result] = await db
        .select({ estadoConfiguravel: salesOrders.estadoConfiguravel })
        .from(salesOrders)
        .where(and(
          eq(salesOrders.cliente, cliente),
          inArray(salesOrders.estadoConfiguravel, ['BAMBU', 'MADEIRA', 'ROJÃO', 'SERRAGEM'])
        ))
        .groupBy(salesOrders.estadoConfiguravel)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(1);
      if (result?.estadoConfiguravel) {
        centroMap[cliente] = result.estadoConfiguravel;
      }
    }
    
    for (const item of itemsWithoutCentro) {
      const centro = centroMap[item.empresa];
      if (centro) {
        await db.update(cobrancaPlanilha)
          .set({ centroCustos: centro })
          .where(eq(cobrancaPlanilha.id, item.id));
      }
    }
  }

  // 5. REACTIVATE: titles that were deactivated but are now back in overdue
  for (const item of await db.select().from(cobrancaPlanilha).where(eq(cobrancaPlanilha.ativo, false))) {
    if (item.arId && validOverdueArIds.has(item.arId)) {
      await db.update(cobrancaPlanilha)
        .set({ ativo: true, updatedBy: "Auto-sync (título reativado)" })
        .where(eq(cobrancaPlanilha.id, item.id));
    }
  }

  // 6. Update diasVencidos for all active items
  const updatedActive = await db.select().from(cobrancaPlanilha).where(eq(cobrancaPlanilha.ativo, true));
  for (const item of updatedActive) {
    if (item.vencimento) {
      const diasAtrasoRaw = Math.floor((new Date(todayStr).getTime() - new Date(item.vencimento).getTime()) / 86400000);
      const businessDays = diasAtrasoRaw > 0 ? countBusinessDays(item.vencimento, todayStr) : 0;
      if (item.diasVencidos !== businessDays) {
        await db.update(cobrancaPlanilha)
          .set({ diasVencidos: businessDays })
          .where(eq(cobrancaPlanilha.id, item.id));
      }
    }
  }

  const finalCount = await db.select({ id: cobrancaPlanilha.id }).from(cobrancaPlanilha).where(eq(cobrancaPlanilha.ativo, true));

  return { added, deactivated, total: finalCount.length };
}
