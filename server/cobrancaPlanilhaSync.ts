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
import { cobrancaPlanilha, accountsReceivable, collectionActions, resolvedReceivables, salesOrders, cobrancaEtapaObs } from "../drizzle/schema";
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

  // FIX APAGÕES: A proteção baseada em horário (17:15) foi REMOVIDA.
  // Agora a proteção é ABSOLUTA: qualquer título com status != "Pendente" NUNCA é desativado.
  // Isso resolve definitivamente o problema de perda de dados que ocorria após 17:15.

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
  //
  // REGRA CRÍTICA (FIX APAGÕES): NUNCA desativar títulos que tenham status diferente de "Pendente".
  // Se o financeiro trabalhou o título (marcou status, fez anotações, registrou etapas),
  // ele JAMAIS pode ser desativado automaticamente. Isso previne a perda de dados que
  // acontecia diariamente após 17:15.
  //
  // Títulos com status != "Pendente" que saíram da inadimplência serão mantidos como ativos
  // mas com uma flag indicando que o título foi pago/resolvido no Maxiprod.
  // O financeiro decide manualmente quando arquivar.
  let deactivated = 0;
  const arIdsToResolve: number[] = [];
  for (const item of activePlanilha) {
    // PROTEÇÃO ABSOLUTA: NUNCA desativar títulos com status diferente de "Pendente"
    // Isso inclui: Contatado, Em negociação, Promessa de Pgto, Especial s/ cobrança,
    // Protestado, Protesto em Análise, Fundo Perdido, Rafael - Especial s/ cobrança,
    // Cheque em compensação, Não deu retorno, Não atendeu, Jurídico, etc.
    if (item.status && item.status !== "Pendente") continue;
    
    if (item.arId && !validOverdueArIds.has(item.arId)) {
      // Título com status "Pendente" que saiu da inadimplência → pode desativar
      // (ninguém trabalhou nele ainda, então não há dados manuais a preservar)
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

      // REGRA DE HERANÇA DE STATUS:
      // 1. Se a empresa já tem títulos ativos com status "Especial s/ cobrança" → herda "Especial s/ cobrança"
      // 2. Se existe registro inativo com mesma empresa+vencimento e status não-Pendente → herda esse status
      //    (caso de arId que mudou no Maxiprod mas é o mesmo título)
      // 3. Se existe registro inativo com mesma empresa+valor e status não-Pendente → herda esse status
      //    (caso de parcela com vencimento diferente mas mesmo valor)
      // 4. Se a empresa tem títulos inativos com status forte (Protestado/Fundo Perdido/etc) → herda
      //    (empresa já protestada, novos títulos devem manter o mesmo status)
      // 5. Caso contrário → entra como Pendente (cada título é tratado individualmente)
      const empresaUpper = title.empresa.toUpperCase().trim();
      const especialMatch = allPlanilhaRecords.find(
        r => r.ativo && r.empresa && r.empresa.toUpperCase().trim() === empresaUpper && r.status === "Especial s/ cobrança"
      );
      if (especialMatch) {
        statusPlanilha = "Especial s/ cobrança";
      } else {
        // Check for same empresa+vencimento in inactive records (arId changed in Maxiprod)
        const sameEmpVenc = allPlanilhaRecords.find(
          r => !r.ativo && r.empresa && r.empresa.toUpperCase().trim() === empresaUpper
            && r.vencimento === title.vencDate && r.status && r.status !== "Pendente"
        );
        if (sameEmpVenc) {
          statusPlanilha = sameEmpVenc.status!;
        } else {
          // Check for same empresa+valor in inactive records (parcela com vencimento diferente)
          const valorStr = String(title.valorAReceber.toFixed(2));
          const sameEmpValor = allPlanilhaRecords.find(
            r => !r.ativo && r.empresa && r.empresa.toUpperCase().trim() === empresaUpper
              && r.valor && parseFloat(String(r.valor)).toFixed(2) === valorStr
              && r.status && r.status !== "Pendente"
          );
          if (sameEmpValor) {
            statusPlanilha = sameEmpValor.status!;
          } else {
            // Fallback: se a empresa tem títulos inativos recentes com status forte,
            // herdar esse status para novos títulos da mesma empresa
            // STRONG_STATUSES: apenas status PERMANENTES/DEFINITIVOS que devem ser herdados por novos títulos.
            // NÃO incluir status de progresso (Contatado, Em negociação, Promessa de Pgto)
            // pois novos títulos devem começar como Pendente para serem cobrados normalmente.
            const STRONG_STATUSES = ["Protestado", "Protesto em Análise", "Fundo Perdido", "Especial s/ cobrança"];
            const recentInactiveOfEmpresa = allPlanilhaRecords
              .filter(r => !r.ativo && r.empresa && r.empresa.toUpperCase().trim() === empresaUpper
                && r.status && STRONG_STATUSES.includes(r.status))
              .sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
            if (recentInactiveOfEmpresa.length > 0) {
              statusPlanilha = recentInactiveOfEmpresa[0].status!;
            } else {
              // Também verificar títulos ATIVOS da mesma empresa com status forte
              const activeOfEmpresa = allPlanilhaRecords.find(
                r => r.ativo && r.empresa && r.empresa.toUpperCase().trim() === empresaUpper
                  && r.status && STRONG_STATUSES.includes(r.status)
              );
              if (activeOfEmpresa) {
                statusPlanilha = activeOfEmpresa.status!;
              } else {
                // Cada título novo entra como Pendente — tratamento individual
                statusPlanilha = "Pendente";
              }
            }
          }
        }
      }



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

      // FIX APAGÕES: Buscar donor para herdar TUDO (etapas + observações + histórico)
      const donor = allPlanilhaRecords
        .filter(r => r.empresa && r.empresa.toUpperCase().trim() === empresaUpper
          && (r.primeiraCobranca || r.promessaPgto || r.semAcao1 || r.segundaCobranca || r.semAcao2 || r.terceiraCobranca || r.semAcao3 || r.acaoFinal || r.observacoes))
        .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
      
      // VALIDAÇÃO: Só herdar etapas se primeiraCobranca >= vencimento do título novo
      const etapasValidas = (() => {
        if (!donor?.primeiraCobranca || !vencDate) return true;
        const primeiraDate = new Date(donor.primeiraCobranca);
        const vencDateObj = new Date(vencDate);
        return primeiraDate >= vencDateObj;
      })();

      const insertResult = await db.insert(cobrancaPlanilha).values({
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
        // HERÂNCIA DE OBSERVAÇÕES (FIX APAGÕES): sempre herdar observações da mesma empresa
        observacoes: donor?.observacoes || null,
        // HERÂNCIA DE ETAPAS: herda do registro mais recente da mesma empresa que tenha etapas
        primeiraCobranca: etapasValidas ? (donor?.primeiraCobranca || null) : null,
        promessaPgto: etapasValidas ? (donor?.promessaPgto || null) : null,
        semAcao1: etapasValidas ? (donor?.semAcao1 || null) : null,
        segundaCobranca: etapasValidas ? (donor?.segundaCobranca || null) : null,
        semAcao2: etapasValidas ? (donor?.semAcao2 || null) : null,
        terceiraCobranca: etapasValidas ? (donor?.terceiraCobranca || null) : null,
        semAcao3: etapasValidas ? (donor?.semAcao3 || null) : null,
        acaoFinal: etapasValidas ? (donor?.acaoFinal || null) : null,
        etapasHerdadasDeId: etapasValidas ? (donor?.id || null) : null,
        etapasHerdadasDeDoc: etapasValidas ? (donor?.documento || null) : null,
        etapasPausadas: etapasValidas ? (donor?.etapasPausadas || null) : null,
        updatedBy: "Auto-sync (novo título vencido)",
      });
      
      // FIX APAGÕES - MIGRAR HISTÓRICO DE ETAPAS:
      // Copiar cobranca_etapa_obs do donor para o novo registro
      // Isso garante que o histórico de anotações por etapa não se perca
      if (donor && etapasValidas) {
        const newId = (insertResult as any)[0]?.insertId || (insertResult as any).insertId;
        if (newId && donor.id) {
          const donorObs = await db.select().from(cobrancaEtapaObs)
            .where(eq(cobrancaEtapaObs.planilhaId, donor.id));
          if (donorObs.length > 0) {
            // Copiar todas as observações de etapa para o novo ID
            for (const obs of donorObs) {
              await db.insert(cobrancaEtapaObs).values({
                planilhaId: newId,
                etapa: obs.etapa,
                observacao: obs.observacao,
                registradoPor: obs.registradoPor,
              });
            }
            console.log(`[Auto-sync] Histórico de etapas migrado: ${donorObs.length} registros de ID ${donor.id} → ID ${newId} (${title.empresa})`);
          }
        }
      }
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
    let valorZeroDeactivated = 0;
    for (const item of updatedActive) {
      if (item.arId && arValorMap[item.arId] !== undefined) {
        const currentValorAReceber = arValorMap[item.arId];
        const planilhaValor = Number(item.valor) || 0;
        // Only update if there's a meaningful difference (> 0.01)
        if (Math.abs(currentValorAReceber - planilhaValor) > 0.01) {
          // Se o valor a receber chegou a 0 ou menos, o t\u00edtulo foi totalmente pago.
          // Desativar independente do status - n\u00e3o h\u00e1 mais nada a cobrar.
          if (currentValorAReceber <= 0) {
            await db.update(cobrancaPlanilha)
              .set({ ativo: false, valor: "0.00", updatedBy: "Sync: Sistema (pago/resolvido)" })
              .where(eq(cobrancaPlanilha.id, item.id));
            valorZeroDeactivated++;
            console.log(`[Auto-sync] T\u00edtulo PAGO desativado: ${item.empresa} - R$ ${planilhaValor.toFixed(2)} \u2192 R$ 0,00 (status: ${item.status})`);
          } else {
            await db.update(cobrancaPlanilha)
              .set({ valor: String(currentValorAReceber) })
              .where(eq(cobrancaPlanilha.id, item.id));
            valorUpdated++;
            console.log(`[Auto-sync] Valor atualizado: ${item.empresa} - R$ ${planilhaValor.toFixed(2)} \u2192 R$ ${currentValorAReceber.toFixed(2)} (pagamento parcial)`);
          }
        }
      }
    }
    if (valorUpdated > 0) {
      console.log(`[Auto-sync] ${valorUpdated} t\u00edtulos com valor atualizado (pagamentos parciais)`);
    }
    if (valorZeroDeactivated > 0) {
      console.log(`[Auto-sync] ${valorZeroDeactivated} t\u00edtulos desativados (valor zerou - totalmente pagos)`);
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

  // 8. Sync Fundo Perdido from Contas a Pagar (conta destino 571 = FUNDO PERDIDO 4.02.21.06.01, estado PAGO)
  try {
    await syncFundoPerdidoFromPayables();
  } catch (fpErr: any) {
    console.error(`[Auto-sync] Fundo Perdido sync failed: ${fpErr.message}`);
  }

  const finalCountAfterFP = await db.select({ id: cobrancaPlanilha.id }).from(cobrancaPlanilha).where(eq(cobrancaPlanilha.ativo, true));

  return { added, deactivated, total: finalCountAfterFP.length };
}

/**
 * Sync Fundo Perdido titles from Maxiprod Contas a Pagar.
 * Filters: estado = PAGO, conta de destino with codigoEstruturado starting with "4.02.21.06"
 * (which is the FUNDO PERDIDO account 571 in Maxiprod).
 * 
 * These are titles that the company has written off as uncollectable losses.
 * They appear in the Planilha de Cobrança with status "Fundo Perdido".
 */
async function syncFundoPerdidoFromPayables(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Fetch PAGO contas a pagar where referenteA contains "FUNDO PERDIDO"
  // Note: The conta field returns null for these records in the GraphQL API,
  // but the referenteA field always contains "FUNDO PERDIDO" in the description.
  // This matches the Maxiprod UI filter: conta destino 571, estado PAGO.
  let allFundoPerdido: any[] = [];
  let skip = 0;
  const take = 500;

  while (true) {
    const data = await gql<any>(`{
      contaAPagar(
        skip: ${skip}, take: ${take},
        where: {
          estado: { eq: PAGO },
          referenteA: { contains: "FUNDO PERDIDO" }
        }
      ) {
        totalCount
        items {
          id
          valorOriginal
          valorLiquido
          valorPagoLiquido
          vencimentoData
          vencimentoOriginalData
          emissaoData
          liquidacaoData
          referenteA
          documentoVinculadoNumero
          fornecedor { apelido nomeFantasia razaoSocial }
          minhaEmpresaId
        }
      }
    }`);

    if (!data?.contaAPagar) break;
    allFundoPerdido.push(...data.contaAPagar.items);
    if (allFundoPerdido.length >= data.contaAPagar.totalCount) break;
    skip += take;
  }

  if (allFundoPerdido.length === 0) {
    console.log(`[Fundo Perdido] Nenhum título encontrado na conta 571 (FUNDO PERDIDO)`);
    return;
  }

  console.log(`[Fundo Perdido] ${allFundoPerdido.length} títulos encontrados na conta FUNDO PERDIDO`);

  // Get existing Fundo Perdido records to avoid duplicates
  const existingFP = await db.select({ id: cobrancaPlanilha.id, descricao: cobrancaPlanilha.descricao, empresa: cobrancaPlanilha.empresa, documento: cobrancaPlanilha.documento, updatedBy: cobrancaPlanilha.updatedBy, ativo: cobrancaPlanilha.ativo })
    .from(cobrancaPlanilha)
    .where(eq(cobrancaPlanilha.status, 'Fundo Perdido'));

  // FIX APAGÕES: NÃO desativar registros de Fundo Perdido marcados manualmente.
  // Registros manuais de Fundo Perdido são válidos e devem ser preservados.
  // Apenas adicionar novos registros da conta 571 que ainda não existem.

  // Re-fetch after deactivation to get updated ativo status
  const existingFPAfter = await db.select({ id: cobrancaPlanilha.id, descricao: cobrancaPlanilha.descricao, empresa: cobrancaPlanilha.empresa, documento: cobrancaPlanilha.documento, updatedBy: cobrancaPlanilha.updatedBy, ativo: cobrancaPlanilha.ativo })
    .from(cobrancaPlanilha)
    .where(eq(cobrancaPlanilha.status, 'Fundo Perdido'));

  // Build a set of existing records for dedup (by referenteA or documento+empresa)
  // Include ALL Fundo Perdido records (active and inactive from conta 571) to avoid duplicates
  const existingKeys = new Set<string>();
  const inactiveRecords: Map<string, number> = new Map(); // key -> id (for reactivation)
  for (const rec of existingFPAfter) {
    // Use descricao (which stores referenteA) as key
    if (rec.descricao) {
      existingKeys.add(normalizeName(rec.descricao));
      if (!rec.ativo) {
        inactiveRecords.set(normalizeName(rec.descricao), rec.id);
      }
    }
    // Also use empresa+documento combo
    if (rec.empresa && rec.documento) {
      const key = normalizeName(`${rec.empresa}|${rec.documento}`);
      existingKeys.add(key);
      if (!rec.ativo) {
        inactiveRecords.set(key, rec.id);
      }
    }
  }

  let addedFP = 0;
  for (const item of allFundoPerdido) {
    const referenteA = (item.referenteA || "").trim();
    // Use apelido or nomeFantasia (what user sees in Maxiprod) as primary, fallback to razaoSocial
    const fornecedorNome = item.fornecedor?.apelido || item.fornecedor?.nomeFantasia || item.fornecedor?.razaoSocial || "";
    const docNum = item.documentoVinculadoNumero || "";
    const valor = Math.abs(item.valorPagoLiquido || item.valorLiquido || item.valorOriginal || 0);
    const vencimento = (item.vencimentoData || item.vencimentoOriginalData || "").split("T")[0];

    // Build empresa name from referenteA or fornecedor
    // referenteA typically has format: "FUNDO PERDIDO - NFE 169 VENCIMENTO 08/10/2025"
    // The fornecedor is the actual client name
    const empresa = fornecedorNome;

    // Build documento from referenteA or documentoVinculadoNumero
    let documento = "";
    if (referenteA) {
      // Extract NFE number from referenteA (e.g., "FUNDO PERDIDO - NFE 169 VENCIMENTO...")
      const nfeMatch = referenteA.match(/NFE?\s*(\d+)/i);
      if (nfeMatch) documento = `NFE ${nfeMatch[1]}`;
    }
    if (!documento && docNum) documento = docNum;

    // Dedup check - also reactivate inactive conta 571 records
    const keyByRef = normalizeName(referenteA);
    const keyByEmpDoc = normalizeName(`${empresa}|${documento}`);
    if ((keyByRef && existingKeys.has(keyByRef)) || (empresa && documento && existingKeys.has(keyByEmpDoc))) {
      // Check if this is an inactive record from conta 571 that should be reactivated
      const inactiveId = inactiveRecords.get(keyByRef) || (empresa && documento ? inactiveRecords.get(keyByEmpDoc) : undefined);
      if (inactiveId) {
        await db.update(cobrancaPlanilha)
          .set({ ativo: true, updatedBy: 'Auto-sync (Fundo Perdido - Conta 571)' })
          .where(eq(cobrancaPlanilha.id, inactiveId));
        addedFP++;
      }
      continue; // Already exists (active or just reactivated)
    }

    // Determine centro de custos from minhaEmpresaId
    const empresaId = item.minhaEmpresaId;
    let centroCustos: string | null = null;
    // Map company ID to centro de custos name (from screenshot: "17 GRUPO FOX (5.09)" and "11 BAMBU (5.02)")
    if (empresaId === 409300001619248) centroCustos = "PALITOS";
    else if (empresaId === 409300001624530) centroCustos = "VARETAS";
    else if (empresaId === 409300001630645) centroCustos = "BAMBU";
    else if (empresaId === 409300001704502) centroCustos = "GRUPO FOX";

    if (!empresa) continue; // Skip if no empresa name

    await db.insert(cobrancaPlanilha).values({
      empresa,
      descricao: referenteA || `FUNDO PERDIDO - ${documento}`,
      documento: documento || null,
      valor: String(valor),
      vencimento: vencimento || null,
      centroCustos,
      status: "Fundo Perdido",
      ativo: true,
      updatedBy: "Auto-sync (Fundo Perdido - Conta 571)",
    });
    addedFP++;
    existingKeys.add(keyByRef);
    if (empresa && documento) existingKeys.add(keyByEmpDoc);
  }

  if (addedFP > 0) {
    console.log(`[Fundo Perdido] ${addedFP} novos títulos adicionados à planilha de cobrança`);
  } else {
    console.log(`[Fundo Perdido] Nenhum título novo (${existingFP.length} já existentes)`);
  }
}
