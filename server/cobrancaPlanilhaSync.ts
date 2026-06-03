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
import { cobrancaPlanilha, accountsReceivable, collectionActions, resolvedReceivables, salesOrders } from "../drizzle/schema";
import { eq, and, inArray, lte, isNull, sql, desc, or } from "drizzle-orm";
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

/**
 * Para títulos PIX, o campo `cliente` no Maxiprod retorna o banco (ex: "BANCO COOPERATIVO SICREDI S.A.")
 * em vez do cliente real. O nome real do cliente está no campo `referenteA` (ex: "PIX BOTICA BELADONA -J L FORMULAS").
 * Esta função extrai o nome real do cliente quando detecta esse padrão.
 */
function extractRealClientFromPix(referenteA: string | null, cliente: string): string {
  if (!referenteA) return cliente;
  const ref = referenteA.trim();
  const refUpper = ref.toUpperCase();
  const clienteUpper = cliente.toUpperCase();
  
  // Se o cliente parece ser um banco e o referenteA contém o nome real do cliente
  if (clienteUpper.includes('BANCO')) {
    // Padrão 1: "PIX NOME DO CLIENTE"
    if (refUpper.startsWith('PIX ')) {
      const realClient = ref.substring(4).trim();
      if (realClient.length > 3) return realClient;
    }
    // Padrão 2: "RECEBIMENTO PIX-PIX - NOME DO CLIENTE"
    const pixDashMatch = ref.match(/RECEBIMENTO PIX[\-\s]*PIX[\s\-]+(.+)/i);
    if (pixDashMatch && pixDashMatch[1].trim().length > 3) {
      return pixDashMatch[1].trim();
    }
  }
  return cliente;
}

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
  fundo_perdido: "Fundo Perdido",
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
      return { arId: row.id, empresa: extractRealClientFromPix(row.referenteA, (row.cliente || "").trim()), valorAReceber, vencDate, row };
    })
    .filter(t => t.valorAReceber > 0)
    .filter(t => !TEST_CLIENTS.includes(t.empresa.toUpperCase().trim()));

  const validOverdueArIds = new Set(validOverdue.map(t => t.arId));

  // 3. DEACTIVATE: planilha items whose arId is no longer in the overdue list
  //    AND save to resolved_receivables if title had 3+ days overdue
  let deactivated = 0;
  const arIdsToResolve: number[] = [];
  for (const item of activePlanilha) {
    if (item.arId && !validOverdueArIds.has(item.arId)) {
      // The underlying title is no longer EMITIDO or no longer overdue → deactivate
      await db.update(cobrancaPlanilha)
        .set({ ativo: false, updatedBy: "Auto-sync (título pago/resolvido)" })
        .where(eq(cobrancaPlanilha.id, item.id));
      deactivated++;
      arIdsToResolve.push(item.arId);
    }
  }

  // 3b. Save deactivated titles with 3+ days overdue to resolved_receivables
  if (arIdsToResolve.length > 0) {
    const titlesToResolve = await db.select()
      .from(accountsReceivable)
      .where(inArray(accountsReceivable.id, arIdsToResolve));
    
    for (const title of titlesToResolve) {
      const vencDate = (title.vencimentoData || "").split("T")[0];
      const diasAtraso = Math.floor((new Date(todayStr).getTime() - new Date(vencDate).getTime()) / 86400000);
      
      // REGRA: Só salvar se tinha 3+ dias de atraso
      if (diasAtraso >= 3) {
        // Check if already exists to prevent duplicates
        const existingRows = await db.select({ id: resolvedReceivables.id })
          .from(resolvedReceivables)
          .where(eq(resolvedReceivables.receivableId, title.id))
          .limit(1);
        if (existingRows.length > 0) continue;
        
        const valorOriginal = Number(title.valorLiquido) || 0;
        // NOTA: Quando o título sai da inadimplência (foi pago), o Maxiprod já atualizou
        // valorRecebidoLiquido = valorLiquido. O valor que ERA a receber é o próprio valorOriginal.
        const valorAReceber = valorOriginal;
        
        // Get status from planilha
        const planilhaItem = activePlanilha.find(p => p.arId === title.id);
        const statusCobranca = planilhaItem?.status || "pendente";
        
        await db.insert(resolvedReceivables).values({
          receivableId: title.id,
          maxiprodId: title.maxiprodId,
          cliente: title.cliente || "Sem nome",
          valorOriginal: String(valorOriginal),
          valorAReceber: String(valorAReceber),
          vencimentoData: vencDate,
          documento: title.documentoVinculadoNumero || null,
          empresa: title.empresaNome || null,
          vendedor: null,
          diasAtrasoNaResolucao: Math.max(0, diasAtraso),
          statusCobranca,
          totalContatos: 0,
        });
        console.log(`[Auto-sync] Título RESOLVIDO salvo: ${title.cliente} - R$ ${valorAReceber.toFixed(2)} (${diasAtraso} dias atraso)`);
      }
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

  // Pre-fetch ALL planilha records (including inactive) to inherit manual status from same empresa
  const allPlanilhaRecords = await db.select().from(cobrancaPlanilha);

  let added = 0;
  for (const title of validOverdue) {
    if (!allPlanilhaArIds.has(title.arId)) {
      // New title not in planilha at all → add it
      const vencDate = title.vencDate;
      const diasAtrasoRaw = Math.floor((new Date(todayStr).getTime() - new Date(vencDate).getTime()) / 86400000);
      const businessDaysOverdue = diasAtrasoRaw > 0 ? countBusinessDays(vencDate, todayStr) : 0;
      const action = actionsMap[title.arId];
      const statusInad = action?.status || "pendente";
      let statusPlanilha = STATUS_MAP[statusInad] || "Pendente";

      // PROTEÇÃO: Herdar status manual e etapas de cobrança de registros existentes (ativos ou inativos) da mesma empresa
      // Priorizar registros com status NÃO-Pendente (marcações manuais da Larissa/Thiago/Thalita)
      const existingOfSameEmpresa = allPlanilhaRecords.find(
        p => p.empresa === title.empresa && p.status && p.status !== 'Pendente'
      );
      if (existingOfSameEmpresa?.status) {
        statusPlanilha = existingOfSameEmpresa.status;
      }

      // PROTEÇÃO: Herdar etapas de cobrança da mesma empresa (priorizar registro com mais etapas preenchidas)
      // REGRA: Só herdar se a primeira_cobranca for >= vencimento do título novo
      // (não faz sentido cobrar antes do título vencer)
      const empresaRecords = allPlanilhaRecords.filter(p => p.empresa === title.empresa);
      const etapaSource = empresaRecords
        .filter(p => {
          if (!p.primeiraCobranca && !p.segundaCobranca && !p.terceiraCobranca && !p.acaoFinal) return false;
          // Validar: primeira cobrança deve ser >= vencimento do título novo
          if (p.primeiraCobranca && vencDate) {
            const primeiraDate = new Date(p.primeiraCobranca);
            const vencDateObj = new Date(vencDate);
            if (primeiraDate < vencDateObj) return false; // Etapas de outro título mais antigo
          }
          return true;
        })
        .sort((a, b) => {
          const countEtapas = (r: any) => [r.primeiraCobranca, r.semAcao1, r.segundaCobranca, r.semAcao2, r.terceiraCobranca, r.semAcao3, r.acaoFinal].filter(Boolean).length;
          return countEtapas(b) - countEtapas(a);
        })[0] || null;

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
        // Herdar etapas de cobrança da mesma empresa (para não perder histórico)
        primeiraCobranca: etapaSource?.primeiraCobranca || null,
        semAcao1: etapaSource?.semAcao1 || null,
        segundaCobranca: etapaSource?.segundaCobranca || null,
        semAcao2: etapaSource?.semAcao2 || null,
        terceiraCobranca: etapaSource?.terceiraCobranca || null,
        semAcao3: etapaSource?.semAcao3 || null,
        acaoFinal: etapaSource?.acaoFinal || null,
        // Rastreabilidade: de qual registro as etapas foram herdadas
        etapasHerdadasDeId: etapaSource?.id || null,
        etapasHerdadasDeDoc: etapaSource?.documento || null,
        updatedBy: "Auto-sync (novo título vencido)",
      });
      added++;
    }
  }

  // 4b. Populate apelido and vendedor for items that don't have them yet
  const itemsWithoutApelido = await db.select({ id: cobrancaPlanilha.id, empresa: cobrancaPlanilha.empresa, apelido: cobrancaPlanilha.apelido, vendedor: cobrancaPlanilha.vendedor })
    .from(cobrancaPlanilha)
    .where(and(eq(cobrancaPlanilha.ativo, true), or(isNull(cobrancaPlanilha.apelido), isNull(cobrancaPlanilha.vendedor), eq(cobrancaPlanilha.vendedor, ''))));
  
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
      if (apelido && !item.apelido) updateData.apelido = apelido;
      if (vendedor && (!item.vendedor || item.vendedor === '')) updateData.vendedor = vendedor;
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

  // 4d. BACKFILL: Preencher dados faltantes (CNPJ, Município, UF, Contato, Email) para itens ativos
  // Garante que títulos adicionados pelo auto-sync também recebam dados de contato do GraphQL
  try {
    const itemsMissingContact = await db.select({
      id: cobrancaPlanilha.id,
      empresa: cobrancaPlanilha.empresa,
      cnpjCpf: cobrancaPlanilha.cnpjCpf,
      municipio: cobrancaPlanilha.municipio,
      uf: cobrancaPlanilha.uf,
      contato: cobrancaPlanilha.contato,
      email: cobrancaPlanilha.email,
    }).from(cobrancaPlanilha).where(
      and(
        eq(cobrancaPlanilha.ativo, true),
        or(
          isNull(cobrancaPlanilha.cnpjCpf),
          eq(cobrancaPlanilha.cnpjCpf, ''),
          isNull(cobrancaPlanilha.municipio),
          eq(cobrancaPlanilha.municipio, ''),
          isNull(cobrancaPlanilha.contato),
          eq(cobrancaPlanilha.contato, '')
        )
      )
    );

    if (itemsMissingContact.length > 0) {
      // Agrupar por empresa para evitar queries duplicadas
      const empresasToFetch = Array.from(new Set(itemsMissingContact.map(i => i.empresa)));
      const contactDataMap: Record<string, { cnpj?: string; municipio?: string; uf?: string; contato?: string; email?: string }> = {};

      // Buscar dados de todas as empresas do GraphQL (paginado)
      const cnpjMap: Record<string, string> = {};
      const munMap: Record<string, string> = {};
      const ufMap: Record<string, string> = {};
      const telMap: Record<string, string> = {};
      const emailMap: Record<string, string> = {};

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
              cnpjOuCpf
              emailParaEnvioDeDocumentosFiscais
              endereco { telefone1 email municipio { descricao uf { sigla } } }
            }
          }
        }`);
        if (!resp?.empresas) break;
        total = resp.empresas.totalCount;
        for (const emp of resp.empresas.items) {
          const names = [emp.nomeFantasia, emp.razaoSocial, emp.apelido].filter(Boolean);
          const normalizedNames = names.map((n: string) => normalizeName(n));
          const cnpjVal = (emp.cnpjOuCpf || "").trim();
          const endPrincipal = emp.endereco;
          const mun = endPrincipal?.municipio?.descricao || "";
          const ufSigla = endPrincipal?.municipio?.uf?.sigla || "";
          const tel1 = (endPrincipal?.telefone1 || "").trim();
          const emailNfe = (emp.emailParaEnvioDeDocumentosFiscais || "").trim();
          const emailEnd = (endPrincipal?.email || "").trim();

          for (const normName of normalizedNames) {
            if (cnpjVal && !cnpjMap[normName]) cnpjMap[normName] = cnpjVal;
            if (mun && !munMap[normName]) munMap[normName] = mun;
            if (ufSigla && !ufMap[normName]) ufMap[normName] = ufSigla;
            if (tel1 && tel1.length >= 8 && !telMap[normName]) telMap[normName] = tel1;
            const bestEmail = emailNfe || emailEnd;
            if (bestEmail && !emailMap[normName]) emailMap[normName] = bestEmail;
          }
        }
        skip += PAGE_SIZE;
      } while (skip < total);

      // Mapear dados para cada empresa que precisa
      for (const empresa of empresasToFetch) {
        const normEmp = normalizeName(empresa);
        const data: any = {};
        if (cnpjMap[normEmp]) data.cnpj = cnpjMap[normEmp];
        if (munMap[normEmp]) data.municipio = munMap[normEmp];
        if (ufMap[normEmp]) data.uf = ufMap[normEmp];
        if (telMap[normEmp]) data.contato = telMap[normEmp];
        if (emailMap[normEmp]) data.email = emailMap[normEmp];
        if (Object.keys(data).length > 0) contactDataMap[empresa] = data;
      }

      // Aplicar backfill
      let backfilled = 0;
      for (const item of itemsMissingContact) {
        const data = contactDataMap[item.empresa];
        if (!data) continue;
        const updates: Record<string, any> = {};
        if (!item.cnpjCpf && data.cnpj) updates.cnpjCpf = data.cnpj;
        if (!item.municipio && data.municipio) updates.municipio = data.municipio;
        if (!item.uf && data.uf) updates.uf = data.uf;
        if (!item.contato && data.contato) updates.contato = data.contato;
        if (!item.email && data.email) updates.email = data.email;
        if (Object.keys(updates).length > 0) {
          await db.update(cobrancaPlanilha)
            .set(updates)
            .where(eq(cobrancaPlanilha.id, item.id));
          backfilled++;
        }
      }
      if (backfilled > 0) {
        console.log(`[Auto-sync] Backfill contato: ${backfilled}/${itemsMissingContact.length} itens atualizados`);
      }
    }
  } catch (e) {
    console.error('[Auto-sync] Erro no backfill de dados de contato:', e);
  }

  // 5. REACTIVATE: titles that were deactivated but are now back in overdue
  for (const item of await db.select().from(cobrancaPlanilha).where(eq(cobrancaPlanilha.ativo, false))) {
    if (item.arId && validOverdueArIds.has(item.arId)) {
      await db.update(cobrancaPlanilha)
        .set({ ativo: true, updatedBy: "Auto-sync (título reativado)" })
        .where(eq(cobrancaPlanilha.id, item.id));
    }
  }

  // 6. Update valor (valorAReceber) for active items when partial payments occur
  // This ensures the planilha always reflects the current amount owed after partial payments
  const updatedActive = await db.select().from(cobrancaPlanilha).where(eq(cobrancaPlanilha.ativo, true));
  const activeArIds = updatedActive.filter(i => i.arId).map(i => i.arId!) as number[];
  
  if (activeArIds.length > 0) {
    // Fetch current valorAReceber from accounts_receivable for all active items
    const arRows = await db.select({
      id: accountsReceivable.id,
      valorLiquido: accountsReceivable.valorLiquido,
      valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
    }).from(accountsReceivable).where(inArray(accountsReceivable.id, activeArIds));
    
    const arValorMap: Record<number, number> = {};
    for (const ar of arRows) {
      const valorLiq = Number(ar.valorLiquido) || 0;
      const valorPago = Number(ar.valorRecebidoLiquido) || 0;
      arValorMap[ar.id] = valorLiq - valorPago;
    }
    
    // Update planilha items where valor differs from current valorAReceber
    let valorUpdated = 0;
    for (const item of updatedActive) {
      if (item.arId && arValorMap[item.arId] !== undefined) {
        const currentValorAReceber = arValorMap[item.arId];
        const planilhaValor = Number(item.valor) || 0;
        // Only update if there's a meaningful difference (> 0.01)
        if (Math.abs(currentValorAReceber - planilhaValor) > 0.01) {
          await db.update(cobrancaPlanilha)
            .set({ valor: String(currentValorAReceber) })
            .where(eq(cobrancaPlanilha.id, item.id));
          valorUpdated++;
          console.log(`[Auto-sync] Valor atualizado: ${item.empresa} - R$ ${planilhaValor.toFixed(2)} → R$ ${currentValorAReceber.toFixed(2)} (pagamento parcial)`);
        }
      }
    }
    if (valorUpdated > 0) {
      console.log(`[Auto-sync] ${valorUpdated} títulos com valor atualizado (pagamentos parciais)`);
    }
  }

  // 7. Update diasVencidos for all active items
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
