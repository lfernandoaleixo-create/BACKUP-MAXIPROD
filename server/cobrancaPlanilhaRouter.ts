import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { cobrancaPlanilha, cobrancaPlanilhaBackup, accountsReceivable, collectionActions, cobrancaEtapaObs, salesOrders, sellerAlerts } from "../drizzle/schema";
import { eq, desc, sql, and, inArray, lte, asc, isNull, like, or, gte } from "drizzle-orm";
import { gql, normalizeVendedorName } from "./maxiprodGraphQL";

/**
 * Router para a Planilha de Cobrança interativa.
 * Reproduz a planilha Excel INADIMPLÊNCIA.xlsx no dashboard.
 * 
 * REGRA: NUNCA apagar registros. Dados manuais que não podem ser re-sincronizados.
 * Editável pela Thalita e operadores com acesso financeiro.
 */

// Normalizar nome removendo acentos para match correto
function normalizeName(name: string): string {
  return name.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Clientes com vendedor fixo "Grupo Fox" (definido manualmente por Fernando)
const CLIENTES_GRUPO_FOX = ["JOHNSON", "KEURE", "S C JOHNSON", "SC JOHNSON", "S. C. JOHNSON"];

function isClienteGrupoFox(nome: string): boolean {
  const upper = nome.toUpperCase();
  return CLIENTES_GRUPO_FOX.some(prefix => upper.includes(prefix));
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

// Mapeamento de status da inadimplência (collection_actions) → planilha de cobrança
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
  rafael_especial: "Rafael - Especial s/ cobrança",
};

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

export const cobrancaPlanilhaRouter = router({
  /**
   * Listar todos os títulos da planilha de cobrança
   */
  getAll: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(cobrancaPlanilha)
      .where(eq(cobrancaPlanilha.ativo, true))
      .orderBy(desc(cobrancaPlanilha.diasVencidos));
  }),

  /**
   * Atualizar status de um título
   */
  updateStatus: publicProcedure
    .input(z.object({
      id: z.number(),
      status: z.string(),
      updatedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(cobrancaPlanilha)
        .set({
          status: input.status,
          updatedBy: input.updatedBy,
        })
        .where(eq(cobrancaPlanilha.id, input.id));
      return { success: true };
    }),

  /**
   * Atualizar observações/comentários de um título
   */
  updateObservacao: publicProcedure
    .input(z.object({
      id: z.number(),
      observacoes: z.string(),
      updatedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(cobrancaPlanilha)
        .set({
          observacoes: input.observacoes,
          updatedBy: input.updatedBy,
        })
        .where(eq(cobrancaPlanilha.id, input.id));
      return { success: true };
    }),

  /**
   * Atualizar campos de cobrança (datas, ações, promessa)
   */
  updateCobranca: publicProcedure
    .input(z.object({
      id: z.number(),
      promessaPgto: z.string().nullable().optional(),
      primeiraCobranca: z.string().nullable().optional(),
      semAcao1: z.string().nullable().optional(),
      segundaCobranca: z.string().nullable().optional(),
      semAcao2: z.string().nullable().optional(),
      terceiraCobranca: z.string().nullable().optional(),
      semAcao3: z.string().nullable().optional(),
      acaoFinal: z.string().nullable().optional(),
      updatedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, updatedBy, ...fields } = input;
      const updateData: Record<string, any> = { updatedBy };
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }
      await db.update(cobrancaPlanilha)
        .set(updateData)
        .where(eq(cobrancaPlanilha.id, id));
      return { success: true };
    }),

  /**
   * Atualizar um campo genérico de um título (para edição inline)
   */
  updateField: publicProcedure
    .input(z.object({
      id: z.number(),
      field: z.string(),
      value: z.string().nullable(),
      updatedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const editableFields = [
        'status', 'observacoes', 'promessaPgto', 'primeiraCobranca',
        'semAcao1', 'segundaCobranca', 'semAcao2', 'terceiraCobranca',
        'semAcao3', 'acaoFinal', 'tipo', 'diasVencidos',
        'contato', 'email', 'regiao', 'municipio', 'uf', 'cnpjCpf', 'centroCustos', 'documento',
        'vendedor', 'formaCobranca',
      ];
      
      if (!editableFields.includes(input.field)) {
        throw new Error(`Campo '${input.field}' não é editável`);
      }
      
      const fieldToColumn: Record<string, string> = {
        status: 'status',
        observacoes: 'observacoes',
        promessaPgto: 'promessa_pgto',
        primeiraCobranca: 'primeira_cobranca',
        semAcao1: 'sem_acao_1',
        segundaCobranca: 'segunda_cobranca',
        semAcao2: 'sem_acao_2',
        terceiraCobranca: 'terceira_cobranca',
        semAcao3: 'sem_acao_3',
        acaoFinal: 'acao_final',
        tipo: 'tipo',
        diasVencidos: 'dias_vencidos',
        contato: 'contato',
        email: 'email',
        regiao: 'regiao',
        municipio: 'municipio',
        uf: 'uf',
        cnpjCpf: 'cnpj_cpf',
        centroCustos: 'centro_custos',
        documento: 'documento',
        vendedor: 'vendedor',
        formaCobranca: 'forma_cobranca',
      };
      
      const colName = fieldToColumn[input.field] || input.field;
      
      await db.execute(
        sql`UPDATE cobranca_planilha SET ${sql.raw(colName)} = ${input.value}, updated_by = ${input.updatedBy} WHERE id = ${input.id}`
      );
      
      // AUTO-FILL: Quando ação final é registrada, preencher etapas anteriores vazias
      // Regra: se acaoFinal é definida e etapas anteriores estão vazias, auto-preencher com datas calculadas
      // baseadas no vencimento (vencimento+1, vencimento+3, vencimento+5) — SEM alterar status
      if (input.field === 'acaoFinal' && input.value) {
        const [record] = await db.select()
          .from(cobrancaPlanilha)
          .where(eq(cobrancaPlanilha.id, input.id))
          .limit(1);
        
        if (record && record.vencimento) {
          const venc = new Date(record.vencimento + 'T00:00:00');
          const updates: Record<string, string> = {};
          
          // Calcular datas: vencimento + 1 dia, +3 dias, +5 dias
          const addDays = (d: Date, n: number) => {
            const r = new Date(d);
            r.setDate(r.getDate() + n);
            return r.toISOString().split('T')[0];
          };
          
          if (!record.primeiraCobranca) updates['primeira_cobranca'] = addDays(venc, 1);
          if (!record.semAcao1) updates['sem_acao_1'] = addDays(venc, 2);
          if (!record.segundaCobranca) updates['segunda_cobranca'] = addDays(venc, 3);
          if (!record.semAcao2) updates['sem_acao_2'] = addDays(venc, 4);
          if (!record.terceiraCobranca) updates['terceira_cobranca'] = addDays(venc, 5);
          if (!record.semAcao3) updates['sem_acao_3'] = addDays(venc, 6);
          
          if (Object.keys(updates).length > 0) {
            const setClauses = Object.entries(updates)
              .map(([col, val]) => `${col} = '${val}'`)
              .join(', ');
            await db.execute(
              sql`UPDATE cobranca_planilha SET ${sql.raw(setClauses)} WHERE id = ${input.id} AND ativo = true`
            );
          }
        }
      }
      
      return { success: true };
    }),

  /**
   * Toggle "Cobrança Pausada" para uma etapa específica de um título.
   * Armazena no campo JSON etapas_pausadas: { campo: boolean }
   */
  toggleEtapaPausada: publicProcedure
    .input(z.object({
      id: z.number(),
      etapa: z.string(),
      pausada: z.boolean(),
      updatedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const validEtapas = ['primeiraCobranca', 'semAcao1', 'segundaCobranca', 'semAcao2', 'terceiraCobranca', 'semAcao3', 'acaoFinal'];
      if (!validEtapas.includes(input.etapa)) {
        throw new Error(`Etapa '${input.etapa}' inválida`);
      }
      
      // Get current value
      const [row] = await db.select({ etapasPausadas: cobrancaPlanilha.etapasPausadas })
        .from(cobrancaPlanilha)
        .where(eq(cobrancaPlanilha.id, input.id));
      
      const current = (row?.etapasPausadas as Record<string, boolean>) || {};
      const updated = { ...current, [input.etapa]: input.pausada };
      
      await db.update(cobrancaPlanilha)
        .set({
          etapasPausadas: updated,
          updatedBy: input.updatedBy,
        })
        .where(eq(cobrancaPlanilha.id, input.id));
      
      return { success: true, etapasPausadas: updated };
    }),

  /**
   * Importar dados em lote (para migração inicial da planilha Excel)
   */
  importBatch: publicProcedure
    .input(z.object({
      items: z.array(z.object({
        empresa: z.string(),
        descricao: z.string().nullable().optional(),
        cnpjCpf: z.string().nullable().optional(),
        municipio: z.string().nullable().optional(),
        uf: z.string().nullable().optional(),
        pais: z.string().nullable().optional(),
        centroCustos: z.string().nullable().optional(),
        valor: z.number().nullable().optional(),
        vencimento: z.string().nullable().optional(),
        diasVencidos: z.number().nullable().optional(),
        tipo: z.string().nullable().optional(),
        status: z.string().optional(),
        promessaPgto: z.string().nullable().optional(),
        primeiraCobranca: z.string().nullable().optional(),
        semAcao1: z.string().nullable().optional(),
        segundaCobranca: z.string().nullable().optional(),
        semAcao2: z.string().nullable().optional(),
        terceiraCobranca: z.string().nullable().optional(),
        semAcao3: z.string().nullable().optional(),
        acaoFinal: z.string().nullable().optional(),
        observacoes: z.string().nullable().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      let inserted = 0;
      for (let i = 0; i < input.items.length; i += 20) {
        const batch = input.items.slice(i, i + 20);
        const values = batch.map(item => ({
          empresa: item.empresa,
          descricao: item.descricao || null,
          cnpjCpf: item.cnpjCpf || null,
          municipio: item.municipio || null,
          uf: item.uf || null,
          pais: item.pais || null,
          centroCustos: item.centroCustos || null,
          valor: item.valor != null ? String(item.valor) : null,
          vencimento: item.vencimento || null,
          diasVencidos: item.diasVencidos != null ? Math.round(item.diasVencidos) : null,
          tipo: item.tipo || null,
          status: item.status || "Pendente",
          promessaPgto: item.promessaPgto || null,
          primeiraCobranca: item.primeiraCobranca || null,
          semAcao1: item.semAcao1 || null,
          segundaCobranca: item.segundaCobranca || null,
          semAcao2: item.semAcao2 || null,
          terceiraCobranca: item.terceiraCobranca || null,
          semAcao3: item.semAcao3 || null,
          acaoFinal: item.acaoFinal || null,
          observacoes: item.observacoes || null,
          updatedBy: "Importação Excel",
        }));
        await db.insert(cobrancaPlanilha).values(values);
        inserted += batch.length;
      }
      
      return { success: true, inserted };
    }),

  /**
   * Obter resumo/estatísticas da planilha
   */
    getSummary: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, byStatus: {}, byCenter: {}, totalValor: 0, rafaelCount: 0, rafaelValor: 0 };
    const all = await db.select().from(cobrancaPlanilha).where(eq(cobrancaPlanilha.ativo, true));
    const byStatus: Record<string, { count: number; valor: number }> = {};
    const byCenter: Record<string, { count: number; valor: number }> = {};
    let totalValor = 0;
    let rafaelCount = 0;
    let rafaelValor = 0;
    for (const item of all) {
      const valor = item.valor ? parseFloat(String(item.valor)) : 0;
      // Track Rafael items separately but ALSO include in byStatus for the small card
      if ((item.vendedor || "").toUpperCase().includes("RAFAEL LEONEL") || item.status === "Rafael - Especial s/ cobrança") {
        rafaelCount++;
        rafaelValor += valor;
        // Add to byStatus under the Rafael status key so the small card appears
        const rafStatus = "Rafael - Especial s/ cobrança";
        if (!byStatus[rafStatus]) byStatus[rafStatus] = { count: 0, valor: 0 };
        byStatus[rafStatus].count++;
        byStatus[rafStatus].valor += valor;
        // Do NOT add to totalValor or byCenter (keep separate from main stats)
        continue;
      }
      const status = item.status || "Pendente";
      const center = item.centroCustos || "Outros";
      if (!byStatus[status]) byStatus[status] = { count: 0, valor: 0 };
      byStatus[status].count++;
      byStatus[status].valor += valor;
      if (!byCenter[center]) byCenter[center] = { count: 0, valor: 0 };
      byCenter[center].count++;
      byCenter[center].valor += valor;
      totalValor += valor;
    }
    return { total: all.length - rafaelCount, byStatus, byCenter, totalValor, rafaelCount, rafaelValor };
  }),

  /**
   * Obter estatísticas em tempo real da inadimplência (sem depender da tabela local)
   * Usa a mesma lógica do sync para garantir que os valores coincidam
   */
  getLiveInadimplenciaStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalTitulos: 0, totalValor: 0 };

    const cutoff = getPreviousBusinessDay();
    const todayStr = getTodayBR();

    const rows = await db
      .select({
        id: accountsReceivable.id,
        cliente: accountsReceivable.cliente,
        valorLiquido: accountsReceivable.valorLiquido,
        valorRecebidoLiquido: accountsReceivable.valorRecebidoLiquido,
        vencimentoData: accountsReceivable.vencimentoData,
        tipo: accountsReceivable.tipo,
      })
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          inArray(accountsReceivable.tipo, RECEIVABLE_VALID_TYPES),
          lte(accountsReceivable.vencimentoData, cutoff + "T23:59:59")
        )
      );

    const TEST_CLIENTS = ['CLIENTE TESTE REGRA', 'CLIENTE MANUAL TICK TEST', 'CLIENTE LEGACY VIBRATION TEST', 'CLIENTE RECENT VIBRATION TEST', 'CLIENTE TESTE COBRANCA'];

    let totalTitulos = 0;
    let totalValor = 0;

    for (const row of rows) {
      const valorOriginal = Number(row.valorLiquido) || 0;
      const valorPago = Number(row.valorRecebidoLiquido) || 0;
      const valorAReceber = valorOriginal - valorPago;
      const cliente = (row.cliente || "").toUpperCase().trim();
      if (valorAReceber > 0 && !TEST_CLIENTS.includes(cliente)) {
        totalTitulos++;
        totalValor += valorAReceber;
      }
    }

    return { totalTitulos, totalValor };
  }),

  /**
   * Criar backup instantâneo da planilha de cobrança
   */
  createBackup: publicProcedure
    .input(z.object({
      createdBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const all = await db.select().from(cobrancaPlanilha);
      
      await db.insert(cobrancaPlanilhaBackup).values({
        dataJson: all,
        totalItems: all.length,
        createdBy: input.createdBy,
      });
      
      return { success: true, totalItems: all.length };
    }),

  /**
   * Listar backups existentes (mais recentes primeiro)
   */
  listBackups: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        id: cobrancaPlanilhaBackup.id,
        snapshotDate: cobrancaPlanilhaBackup.snapshotDate,
        totalItems: cobrancaPlanilhaBackup.totalItems,
        createdBy: cobrancaPlanilhaBackup.createdBy,
        createdAt: cobrancaPlanilhaBackup.createdAt,
      })
      .from(cobrancaPlanilhaBackup)
      .orderBy(desc(cobrancaPlanilhaBackup.id))
      .limit(20);
  }),

  /**
   * SINCRONIZAR planilha de cobrança com dados da inadimplência.
   * 
   * Lógica MELHORADA com arId:
   * 1. Busca TODOS os títulos vencidos da inadimplência (accounts_receivable + collection_actions)
   * 2. Cruza com a planilha por arId (chave primária) — mais confiável que nome+data+valor
   * 3. Para títulos sem arId: tenta match por empresa+vencimento+valorAReceber
   * 4. Atualiza: valor, dias vencidos — SEM sobrescrever status, tipo ou marcações manuais
   * 5. Adiciona novos títulos que apareceram na inadimplência
   * 6. Títulos pagos (não mais na inadimplência) ficam intactos com marcação
   * 
   * PRESERVA (NUNCA sobrescreve): status, tipo, observacoes, promessaPgto, primeiraCobranca,
   *           semAcao1, segundaCobranca, semAcao2, terceiraCobranca, semAcao3, acaoFinal, centroCustos
   * 
   * REGRA CRÍTICA: O status e tipo que o Thalita marcarem ficam FIXOS
   *               até eles mudarem manualmente. A sincronização NUNCA sobrescreve esses campos.
   */
  syncFromInadimplencia: publicProcedure
    .input(z.object({
      updatedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Fazer backup automático antes de sincronizar
      const allBefore = await db.select().from(cobrancaPlanilha);
      await db.insert(cobrancaPlanilhaBackup).values({
        dataJson: allBefore,
        totalItems: allBefore.length,
        createdBy: `Auto-backup (sync por ${input.updatedBy})`,
      });

      // 2. Buscar títulos vencidos da inadimplência
      // Usar cutoff do dia útil anterior (mesmo que o getOverdueTitles da inadimplência)
      const cutoffCobranca = getPreviousBusinessDay();
      const todayStr = getTodayBR();

      const rows = await db
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
            lte(accountsReceivable.vencimentoData, cutoffCobranca + "T23:59:59")
          )
        )
        .orderBy(asc(accountsReceivable.vencimentoData));

      // 3. Buscar ações de cobrança
      const allActions = await db.select().from(collectionActions);
      const actionsMap: Record<number, typeof allActions[0]> = {};
      for (const a of allActions) {
        actionsMap[a.receivableId] = a;
      }

      // Filtrar clientes de teste
      const TEST_CLIENTS = ['CLIENTE TESTE REGRA', 'CLIENTE MANUAL TICK TEST', 'CLIENTE LEGACY VIBRATION TEST', 'CLIENTE RECENT VIBRATION TEST', 'CLIENTE TESTE COBRANCA'];

      // 4. Montar lista de títulos da inadimplência com valor a receber > 0
      const inadTitles = rows
        .map(row => {
          const valorOriginal = Number(row.valorLiquido) || 0;
          const valorPago = Number(row.valorRecebidoLiquido) || 0;
          const valorAReceber = valorOriginal - valorPago;
          const vencDate = (row.vencimentoData || "").split("T")[0];
          const diasAtrasoRaw = Math.floor((new Date(todayStr).getTime() - new Date(vencDate).getTime()) / 86400000);
          const businessDaysOverdue = diasAtrasoRaw > 0 ? countBusinessDays(vencDate, todayStr) : 0;
          const action = actionsMap[row.id];
          const statusInad = action?.status || "pendente";
          const statusPlanilha = STATUS_MAP[statusInad] || "Pendente";
          
          // Tipo: protesto — texto completo
          const decisao = (row.decisaoCobranca || "").toUpperCase();
          let tipoPlanilha = "SEM PROTESTO";
          if (decisao.includes("COM PROTESTO")) {
            tipoPlanilha = "COM PROTESTO (CART\u00d3RIO)";
          } else if (decisao.includes("SEM PROTESTO") || decisao === "") {
            tipoPlanilha = "SEM PROTESTO";
          }

          // Build documento string (NF + parcela)
          let documento: string | null = null;
          if (row.documentoVinculadoNumero) {
            documento = `NF ${row.documentoVinculadoNumero}`;
            if (row.parcela && row.parcelasQuantidadeTotal) {
              documento += ` (${row.parcela}/${row.parcelasQuantidadeTotal})`;
            } else if (row.parcela) {
              documento += ` (${row.parcela})`;
            }
          }

          return {
            arId: row.id,
            empresa: extractRealClientFromPix(row.referenteA, (row.cliente || "").trim()),
            descricao: row.referenteA || "",
            vencimento: vencDate,
            valorOriginal,
            valorAReceber,
            diasVencidos: businessDaysOverdue,
            tipo: tipoPlanilha,
            status: statusPlanilha,
            documento,
          };
        })
        .filter(t => t.valorAReceber > 0)
        .filter(t => !TEST_CLIENTS.includes(t.empresa.toUpperCase().trim()));

      // 4b. Enriquecer dados de contato do cliente via sales_orders (telefone, email, cidade, UF, região)
      const clienteNames = Array.from(new Set(inadTitles.map(t => t.empresa)));
      const clienteDataMap: Record<string, { contato?: string; email?: string; municipio?: string; uf?: string; regiao?: string }> = {};
      
      if (clienteNames.length > 0) {
        // Buscar dados mais recentes de cada cliente nos pedidos de venda
        const salesData = await db
          .select({
            cliente: salesOrders.cliente,
            clienteTelefone: salesOrders.clienteTelefone,
            clienteEmail: salesOrders.clienteEmail,
            enderecoCidade: salesOrders.enderecoCidade,
            uf: salesOrders.uf,
            regiao: salesOrders.regiao,
          })
          .from(salesOrders)
          .where(inArray(salesOrders.cliente, clienteNames))
          .orderBy(desc(salesOrders.id))
          .limit(5000);
        
        // Pegar o dado mais recente (primeiro encontrado) de cada cliente
        for (const row of salesData) {
          const key = (row.cliente || "").trim();
          if (!key) continue;
          if (!clienteDataMap[key]) {
            clienteDataMap[key] = {};
          }
          const data = clienteDataMap[key];
          if (!data.contato && row.clienteTelefone) data.contato = row.clienteTelefone;
          if (!data.email && row.clienteEmail) data.email = row.clienteEmail;
          if (!data.municipio && row.enderecoCidade) data.municipio = row.enderecoCidade;
          if (!data.uf && row.uf) data.uf = row.uf;
          if (!data.regiao && row.regiao) data.regiao = row.regiao;
        }
      }

      // 4c. Buscar vendedor, apelido, email NF-e, CNPJ/CPF, município e UF de cada cliente via GraphQL
      const vendedorMap: Record<string, string> = {};
      const apelidoMap: Record<string, string> = {};
      const emailNfeMap: Record<string, string> = {};
      const cnpjCpfMap: Record<string, string> = {};
      const municipioGqlMap: Record<string, string> = {};
      const ufGqlMap: Record<string, string> = {};
      const contatoGqlMap: Record<string, string> = {};
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
                cnpjOuCpf
                emailParaEnvioDeDocumentosFiscais
                representanteOuVendedor1Preferencial { nomeFantasia razaoSocial }
                endereco { telefone1 municipio { descricao uf { sigla } } }
              }
            }
          }`);
          if (!resp?.empresas) break;
          total = resp.empresas.totalCount;
          for (const emp of resp.empresas.items) {
            const names = [emp.nomeFantasia, emp.razaoSocial, emp.apelido].filter(Boolean);
            const normalizedNames = names.map((n: string) => normalizeName(n));
            
            // Mapear apelido: usar apelido se disponível, senão nomeFantasia
            const apelidoValue = (emp.apelido || emp.nomeFantasia || "").trim();
            if (apelidoValue) {
              for (const normName of normalizedNames) {
                if (!apelidoMap[normName]) apelidoMap[normName] = apelidoValue;
              }
            }
            
            // Mapear CNPJ/CPF
            const cnpjVal = (emp.cnpjOuCpf || "").trim();
            if (cnpjVal) {
              for (const normName of normalizedNames) {
                if (!cnpjCpfMap[normName]) cnpjCpfMap[normName] = cnpjVal;
              }
            }
            
            // Mapear município e UF do endereço principal
            const endPrincipal = emp.endereco;
            if (endPrincipal) {
              const mun = endPrincipal.municipio?.descricao || "";
              const ufSigla = endPrincipal.municipio?.uf?.sigla || "";
              const tel1 = (endPrincipal.telefone1 || "").trim();
              if (mun) {
                for (const normName of normalizedNames) {
                  if (!municipioGqlMap[normName]) municipioGqlMap[normName] = mun;
                }
              }
              if (ufSigla) {
                for (const normName of normalizedNames) {
                  if (!ufGqlMap[normName]) ufGqlMap[normName] = ufSigla;
                }
              }
              if (tel1 && tel1.length >= 8) {
                for (const normName of normalizedNames) {
                  if (!contatoGqlMap[normName]) contatoGqlMap[normName] = tel1;
                }
              }
            }
            
            // Mapear email para envio de NF-e
            const emailNfe = (emp.emailParaEnvioDeDocumentosFiscais || "").trim();
            if (emailNfe) {
              for (const normName of normalizedNames) {
                if (!emailNfeMap[normName]) emailNfeMap[normName] = emailNfe;
              }
            }
            
            // Mapear vendedor
            const rep = emp.representanteOuVendedor1Preferencial;
            if (!rep) continue;
            const vendedorNameRaw = rep.nomeFantasia || rep.razaoSocial || "";
            if (!vendedorNameRaw) continue;
            const vendedorName = normalizeVendedorName(vendedorNameRaw);
            for (const normName of normalizedNames) {
              if (!vendedorMap[normName]) vendedorMap[normName] = vendedorName;
            }
          }
          skip += PAGE_SIZE;
        } while (skip < total);
        console.log(`[Sync] Empresas GraphQL: ${total} total, ${Object.keys(cnpjCpfMap).length} no cnpjMap, ${Object.keys(municipioGqlMap).length} no municipioMap`);
      } catch (e) {
        console.error("[Sync] Erro ao buscar vendedores:", e);
      }

      // 4c2. Buscar representante/vendedor 2 dos pedidos de venda (ex: RAFAEL LEONEL)
      const representante2Map: Record<string, string> = {};
      try {
        const PAGE_SIZE = 200;
        let skip = 0;
        let total = 0;
        do {
          const resp = await gql<any>(`{
            pedidosDeVenda(skip: ${skip}, take: ${PAGE_SIZE}, where: { representanteOuVendedor2: { razaoSocial: { neq: null } } }) {
              totalCount
              items {
                cliente { nomeFantasia razaoSocial }
                representanteOuVendedor2 { nomeFantasia razaoSocial apelido }
              }
            }
          }`);
          if (!resp?.pedidosDeVenda) break;
          total = resp.pedidosDeVenda.totalCount;
          for (const p of resp.pedidosDeVenda.items) {
            const rep2 = p.representanteOuVendedor2;
            if (!rep2) continue;
            const rep2Name = rep2.apelido || rep2.nomeFantasia || rep2.razaoSocial || "";
            if (!rep2Name) continue;
            const rep2Normalized = normalizeVendedorName(rep2Name);
            const clienteNome = p.cliente?.nomeFantasia || p.cliente?.razaoSocial || "";
            if (clienteNome) {
              const normCliente = normalizeName(clienteNome);
              if (!representante2Map[normCliente]) representante2Map[normCliente] = rep2Normalized;
            }
          }
          skip += PAGE_SIZE;
        } while (skip < total);
        console.log(`[Sync] Representante2 map: ${Object.keys(representante2Map).length} clientes com rep2`);
      } catch (e) {
        console.error("[Sync] Erro ao buscar representante2:", e);
      }

      // 4d. Buscar contatos extras (múltiplos telefones) e email do endereço de cada cliente via GraphQL
      const contatosExtrasMap: Record<string, string[]> = {};
      const emailEnderecoMap: Record<string, string> = {};
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
                endereco { telefone1 telefone2 telefone3 telefone4 email }
                enderecoDeCobranca { telefone1 telefone2 telefone3 telefone4 email }
                enderecoDeEntrega { telefone1 telefone2 telefone3 telefone4 email }
                enderecoDeFaturamento { telefone1 telefone2 telefone3 telefone4 email }
              }
            }
          }`);
          if (!resp?.empresas) break;
          total = resp.empresas.totalCount;
          for (const emp of resp.empresas.items) {
            const phones = new Set<string>();
            const emails = new Set<string>();
            const addrs = [emp.endereco, emp.enderecoDeCobranca, emp.enderecoDeEntrega, emp.enderecoDeFaturamento];
            for (const addr of addrs) {
              if (!addr) continue;
              for (const key of ['telefone1', 'telefone2', 'telefone3', 'telefone4']) {
                const tel = (addr[key] || "").trim();
                if (tel && tel.length >= 8) phones.add(tel);
              }
              // Coletar email do endereço
              const addrEmail = (addr.email || "").trim();
              if (addrEmail && addrEmail.includes('@')) emails.add(addrEmail);
            }
            const names = [emp.nomeFantasia, emp.razaoSocial, emp.apelido].filter(Boolean);
            if (phones.size > 0) {
              const phonesArr = Array.from(phones);
              for (const name of names) {
                const normName = normalizeName(name);
                if (!contatosExtrasMap[normName]) contatosExtrasMap[normName] = phonesArr;
              }
            }
            if (emails.size > 0) {
              const firstEmail = Array.from(emails)[0];
              for (const name of names) {
                const normName = normalizeName(name);
                if (!emailEnderecoMap[normName]) emailEnderecoMap[normName] = firstEmail;
              }
            }
          }
          skip += PAGE_SIZE;
        } while (skip < total);
      } catch (e) {
        console.error("[Sync] Erro ao buscar contatos extras (empresas):", e);
      }
      // 4d2. Buscar contatos da seção "Ocultar Contatos" (root query contatos)
      try {
        const PAGE_SIZE = 200;
        let cSkip = 0;
        let cTotal = 0;
        do {
          const resp = await gql<any>(`{
            contatos(skip: ${cSkip}, take: ${PAGE_SIZE}) {
              totalCount
              items {
                nome
                cargo
                telefone1
                telefone2
                telefone3
                empresa { nomeFantasia razaoSocial apelido }
              }
            }
          }`);
          if (!resp?.contatos) break;
          cTotal = resp.contatos.totalCount;
          for (const contato of resp.contatos.items) {
            if (!contato.empresa) continue;
            const emp = contato.empresa;
            const names = [emp.nomeFantasia, emp.razaoSocial, emp.apelido].filter(Boolean);
            for (const fKey of ['telefone1', 'telefone2', 'telefone3']) {
              const tel = ((contato as any)[fKey] || "").trim();
              if (tel && tel.length >= 8) {
                for (const name of names) {
                  const normName = normalizeName(name);
                  if (!contatosExtrasMap[normName]) contatosExtrasMap[normName] = [];
                  if (!contatosExtrasMap[normName].includes(tel)) {
                    contatosExtrasMap[normName].push(tel);
                  }
                }
              }
            }
          }
          cSkip += PAGE_SIZE;
        } while (cSkip < cTotal);
      } catch (e) {
        console.error("[Sync] Erro ao buscar contatos (Ocultar Contatos):", e);
      }

      // 4e. Mapear forma de cobrança por arId
      const formaCobrancaMap: Record<number, string> = {};
      for (const inad of inadTitles) {
        const row = rows.find(r => r.id === inad.arId);
        if (row?.formaCobranca) {
          formaCobrancaMap[inad.arId] = row.formaCobranca;
        }
      }

      // 5. Buscar planilha atual
      const planilhaAtual = await db.select().from(cobrancaPlanilha);

      // 6. Criar índices para cruzamento
      // Índice por arId (mais confiável)
      const planilhaByArId = new Map<number, typeof planilhaAtual[0]>();
      // Índice por empresa+vencimento+valor (fallback para registros sem arId)
      const planilhaByKey = new Map<string, typeof planilhaAtual[0]>();
      // Índice por empresa+vencimento (último fallback)
      const planilhaByEmpVenc = new Map<string, (typeof planilhaAtual[0])[]>();
      
      const matchedPlanilhaIds = new Set<number>();
      const matchedInadArIds = new Set<number>();

      for (const item of planilhaAtual) {
        if (item.arId) {
          // Priorizar registros ativos quando há duplicatas de arId
          const existing = planilhaByArId.get(item.arId);
          if (!existing || (item.ativo && !existing.ativo)) {
            planilhaByArId.set(item.arId, item);
          }
        }
        // Fallback indexes: only use ACTIVE items to avoid matching new titles with old inactive records
        if (item.ativo) {
          const empresaUpper = (item.empresa || "").toUpperCase().trim();
          const valor = parseFloat(String(item.valor || 0)).toFixed(2);
          const key = `${empresaUpper}|${item.vencimento || ""}|${valor}`;
          planilhaByKey.set(key, item);
          
          const empVencKey = `${empresaUpper}|${item.vencimento || ""}`;
          if (!planilhaByEmpVenc.has(empVencKey)) {
            planilhaByEmpVenc.set(empVencKey, []);
          }
          planilhaByEmpVenc.get(empVencKey)!.push(item);
        }
      }

      let updated = 0;
      let added = 0;
      let statusUpdated = 0;

      // 7. Two-pass approach: first process titles that have arId match (most reliable),
      //    then process remaining titles with fallback strategies.
      //    This prevents fallback matches from "stealing" records that belong to arId-matched titles.
      
      // Pass 1: Match by arId only
      const inadWithArIdMatch: typeof inadTitles = [];
      const inadWithoutArIdMatch: typeof inadTitles = [];
      
      for (const inad of inadTitles) {
        const arIdMatch = planilhaByArId.get(inad.arId);
        if (arIdMatch) {
          inadWithArIdMatch.push(inad);
        } else {
          inadWithoutArIdMatch.push(inad);
        }
      }

      // Process arId matches first
      for (const inad of inadWithArIdMatch) {
        const match = planilhaByArId.get(inad.arId)!;
        matchedPlanilhaIds.add(match.id);
        matchedInadArIds.add(inad.arId);
        
        const updateData: Record<string, any> = {
          valor: String(inad.valorAReceber),
          diasVencidos: inad.diasVencidos,
          arId: inad.arId,
          updatedBy: `Sync: ${input.updatedBy}`,
        };
        
        // REGRA CRÍTICA: NUNCA sobrescrever campos editados manualmente.
        // O status e tipo que o Thalita marcarem ficam FIXOS até eles mudarem manualmente.
        // Apenas preencher se ainda estiver vazio/null.
        if (!match.status || match.status === '') {
          updateData.status = inad.status;
        }
        // Tipo (protesto): SEMPRE atualizar do Maxiprod pois vem do campo SITUAÇÃO do cadastro do cliente
        if (inad.tipo && match.tipo !== inad.tipo) {
          updateData.tipo = inad.tipo;
        }
        // Contar se houve diferença (apenas para log, sem sobrescrever)
        if (match.status !== inad.status) {
          statusUpdated++;
        }

        // Enriquecer dados de contato se ainda não preenchidos
        const clienteData = clienteDataMap[inad.empresa] || {};
        const empresaNorm = normalizeName(inad.empresa);
        // CNPJ/CPF: sempre atualizar do GraphQL (fonte mais confiável)
        const cnpjVal = cnpjCpfMap[empresaNorm];
        if (cnpjVal) updateData.cnpjCpf = cnpjVal;
        // Contato: prioridade GraphQL > sales_orders
        if (!match.contato) {
          const contatoGql = contatoGqlMap[empresaNorm];
          if (contatoGql) updateData.contato = contatoGql;
          else if (clienteData.contato) updateData.contato = clienteData.contato;
        }
        // Email: combinar emailParaEnvioDeDocumentosFiscais + email do endereço (ambos quando existirem)
        {
          const nfeEmail = emailNfeMap[empresaNorm] || "";
          const endEmail = emailEnderecoMap[empresaNorm] || "";
          const pedidoEmail = clienteData.email || "";
          const allEmails = new Set<string>();
          if (nfeEmail) allEmails.add(nfeEmail.toLowerCase());
          if (endEmail) allEmails.add(endEmail.toLowerCase());
          if (pedidoEmail && allEmails.size === 0) allEmails.add(pedidoEmail.toLowerCase());
          const combinedEmail = Array.from(allEmails).join(' / ');
          if (combinedEmail) updateData.email = combinedEmail;
        }
        // Município e UF: prioridade GraphQL > sales_orders
        if (!match.municipio) {
          const munGql = municipioGqlMap[empresaNorm];
          if (munGql) updateData.municipio = munGql;
          else if (clienteData.municipio) updateData.municipio = clienteData.municipio;
        }
        if (!match.uf) {
          const ufGql = ufGqlMap[empresaNorm];
          if (ufGql) updateData.uf = ufGql;
          else if (clienteData.uf) updateData.uf = clienteData.uf;
        }
        if (!match.regiao && clienteData.regiao) updateData.regiao = clienteData.regiao;

        // Vendedor, apelido, forma de cobrança e contatos extras (sempre atualizar)
        // REGRA: Se representante2 é RAFAEL LEONEL → vendedor = "RAFAEL LEONEL"
        const rep2 = representante2Map[empresaNorm] || "";
        const vendedor = rep2.toUpperCase().includes("RAFAEL LEONEL") ? "RAFAEL LEONEL" : (isClienteGrupoFox(inad.empresa) ? "Grupo Fox" : vendedorMap[empresaNorm]);
        if (vendedor) updateData.vendedor = vendedor;
        const apelidoVal = apelidoMap[empresaNorm];
        if (apelidoVal) updateData.apelido = apelidoVal;
        const fc = formaCobrancaMap[inad.arId];
        if (fc) updateData.formaCobranca = fc;
        const contExtras = contatosExtrasMap[empresaNorm];
        if (contExtras && contExtras.length > 0) updateData.contatosAdicionais = contExtras;
        
        await db.update(cobrancaPlanilha)
          .set(updateData)
          .where(eq(cobrancaPlanilha.id, match.id));
        updated++;
      }

      // Pass 2: Process remaining titles with fallback strategies
      for (const inad of inadWithoutArIdMatch) {
        const empresaUpper = inad.empresa.toUpperCase().trim();
        let match: typeof planilhaAtual[0] | undefined;
        
        // Estratégia 2: Match por empresa+vencimento+valorAReceber
        if (!match) {
          const key = `${empresaUpper}|${inad.vencimento}|${inad.valorAReceber.toFixed(2)}`;
          const candidate = planilhaByKey.get(key);
          if (candidate && !matchedPlanilhaIds.has(candidate.id)) {
            match = candidate;
          }
        }
        
        // Estratégia 3: Match por empresa+vencimento+valorOriginal
        if (!match) {
          const key = `${empresaUpper}|${inad.vencimento}|${inad.valorOriginal.toFixed(2)}`;
          const candidate = planilhaByKey.get(key);
          if (candidate && !matchedPlanilhaIds.has(candidate.id)) {
            match = candidate;
          }
        }

        // Estratégia 4: Match por empresa+vencimento (pegar o primeiro não-matched)
        if (!match) {
          const empVencKey = `${empresaUpper}|${inad.vencimento}`;
          const candidates = planilhaByEmpVenc.get(empVencKey) || [];
          for (const c of candidates) {
            if (!matchedPlanilhaIds.has(c.id)) {
              match = c;
              break;
            }
          }
        }

        if (match) {
          // ATUALIZAR título existente — preservar marcações manuais
          matchedPlanilhaIds.add(match.id);
          matchedInadArIds.add(inad.arId);
          
          const updateData: Record<string, any> = {
            valor: String(inad.valorAReceber),
            diasVencidos: inad.diasVencidos,
            arId: inad.arId,
            updatedBy: `Sync: ${input.updatedBy}`,
          };
          
          // REGRA CRÍTICA: NUNCA sobrescrever campos editados manualmente.
          // Apenas preencher se ainda estiver vazio/null.
          if (!match.status || match.status === '') {
            updateData.status = inad.status;
          }
          // Tipo (protesto): SEMPRE atualizar do Maxiprod pois vem do campo SITUAÇÃO do cadastro do cliente
          if (inad.tipo && match.tipo !== inad.tipo) {
            updateData.tipo = inad.tipo;
          }
          if (match.status !== inad.status) {
            statusUpdated++;
          }

          // Enriquecer dados de contato se ainda não preenchidos
          const clienteData = clienteDataMap[inad.empresa] || {};
          const empresaNormFb = normalizeName(inad.empresa);
          // CNPJ/CPF: sempre atualizar do GraphQL (fonte mais confiável)
          const cnpjValFb = cnpjCpfMap[empresaNormFb];
          if (cnpjValFb) updateData.cnpjCpf = cnpjValFb;
          // Contato: prioridade GraphQL > sales_orders
          if (!match.contato) {
            const contatoGql = contatoGqlMap[empresaNormFb];
            if (contatoGql) updateData.contato = contatoGql;
            else if (clienteData.contato) updateData.contato = clienteData.contato;
          }
          // Email: combinar emailParaEnvioDeDocumentosFiscais + email do endereço (ambos quando existirem)
          {
            const nfeEmail = emailNfeMap[empresaNormFb] || "";
            const endEmail = emailEnderecoMap[empresaNormFb] || "";
            const pedidoEmail = clienteData.email || "";
            const allEmails = new Set<string>();
            if (nfeEmail) allEmails.add(nfeEmail.toLowerCase());
            if (endEmail) allEmails.add(endEmail.toLowerCase());
            if (pedidoEmail && allEmails.size === 0) allEmails.add(pedidoEmail.toLowerCase());
            const combinedEmail = Array.from(allEmails).join(' / ');
            if (combinedEmail) updateData.email = combinedEmail;
          }
          // Município e UF: prioridade GraphQL > sales_orders
          if (!match.municipio) {
            const munGql = municipioGqlMap[empresaNormFb];
            if (munGql) updateData.municipio = munGql;
            else if (clienteData.municipio) updateData.municipio = clienteData.municipio;
          }
          if (!match.uf) {
            const ufGql = ufGqlMap[empresaNormFb];
            if (ufGql) updateData.uf = ufGql;
            else if (clienteData.uf) updateData.uf = clienteData.uf;
          }
          if (!match.regiao && clienteData.regiao) updateData.regiao = clienteData.regiao;

          // Documento: atualizar se disponível
          if (inad.documento && !match.documento) {
            updateData.documento = inad.documento;
          }

          // Vendedor, apelido, forma de cobrança e contatos extras
          const empresaNorm2 = normalizeName(inad.empresa);
          // REGRA: Se representante2 é RAFAEL LEONEL → vendedor = "RAFAEL LEONEL"
          const rep2b = representante2Map[empresaNorm2] || "";
          const vendedor2 = rep2b.toUpperCase().includes("RAFAEL LEONEL") ? "RAFAEL LEONEL" : (isClienteGrupoFox(inad.empresa) ? "Grupo Fox" : vendedorMap[empresaNorm2]);
          if (vendedor2) updateData.vendedor = vendedor2;
          const apelidoVal2 = apelidoMap[empresaNorm2];
          if (apelidoVal2) updateData.apelido = apelidoVal2;
          const fc2 = formaCobrancaMap[inad.arId];
          if (fc2) updateData.formaCobranca = fc2;
          const contExtras2 = contatosExtrasMap[empresaNorm2];
          if (contExtras2 && contExtras2.length > 0) updateData.contatosAdicionais = contExtras2;
          
          await db.update(cobrancaPlanilha)
            .set(updateData)
            .where(eq(cobrancaPlanilha.id, match.id));
          updated++;
        } else {
          // NOVO título — adicionar à planilha
          matchedInadArIds.add(inad.arId);
          
          // Enriquecer com dados de contato do cliente (GraphQL + sales_orders)
          const clienteData = clienteDataMap[inad.empresa] || {};
          const normEmpNew = normalizeName(inad.empresa);
          
          // PROTEÇÃO: Herdar campos manuais de itens existentes da mesma empresa
          // (status, observacoes, datas de cobrança, etapa pausada, forma de cobrança)
          // REGRA: Priorizar registros com status NÃO-Pendente (marcações manuais)
          const existingOfSameEmpresa = planilhaAtual.find(
            p => p.empresa === inad.empresa && p.status && p.status !== 'Pendente'
          ) || planilhaAtual.find(
            p => p.empresa === inad.empresa && (p.observacoes || p.primeiraCobranca || p.segundaCobranca || p.terceiraCobranca || p.acaoFinal)
          );
          // HERANÇA DE STATUS FORTE: Se a empresa tem títulos (ativos ou inativos) com status forte,
          // novos títulos herdam esse status automaticamente (evita perda de status por troca de arId)
          const STRONG_STATUSES_SYNC = ["Protestado", "Protesto em Análise", "Fundo Perdido", "Especial s/ cobrança", "Rafael - Especial s/ cobrança", "Contatado", "Em negociação", "Promessa de Pgto"];
          if (inad.status === "Pendente") {
            const strongMatch = planilhaAtual.find(
              p => p.empresa === inad.empresa && p.status && STRONG_STATUSES_SYNC.includes(p.status)
            );
            if (strongMatch) {
              inad.status = strongMatch.status!;
            }
          }

          // VALIDAÇÃO: Só herdar etapas se primeira_cobranca >= vencimento do título novo
          // (não faz sentido cobrar antes do título vencer - seriam etapas de outro título mais antigo)
          const etapasValidas = (() => {
            if (!existingOfSameEmpresa?.primeiraCobranca || !inad.vencimento) return true;
            const primeiraDate = new Date(existingOfSameEmpresa.primeiraCobranca);
            const vencDateObj = new Date(inad.vencimento);
            return primeiraDate >= vencDateObj;
          })();
          
          await db.insert(cobrancaPlanilha).values({
            arId: inad.arId,
            empresa: inad.empresa,
            descricao: inad.descricao || null,
            cnpjCpf: cnpjCpfMap[normEmpNew] || null,
            municipio: municipioGqlMap[normEmpNew] || clienteData.municipio || null,
            uf: ufGqlMap[normEmpNew] || clienteData.uf || null,
            pais: null,
            centroCustos: null, // Will be populated from sales_orders lookup below
            documento: inad.documento || null,
            valor: String(inad.valorAReceber),
            vencimento: inad.vencimento,
            diasVencidos: inad.diasVencidos,
            tipo: inad.tipo,
            // Cada título entra com status Pendente (tratamento individual por título)
            status: inad.status,
            contato: contatoGqlMap[normEmpNew] || clienteData.contato || null,
            email: (() => {
              const nfe = emailNfeMap[normEmpNew] || "";
              const end = emailEnderecoMap[normEmpNew] || "";
              const ped = clienteData.email || "";
              const set = new Set<string>();
              if (nfe) set.add(nfe.toLowerCase());
              if (end) set.add(end.toLowerCase());
              if (ped && set.size === 0) set.add(ped.toLowerCase());
              return set.size > 0 ? Array.from(set).join(' / ') : null;
            })(),
            regiao: clienteData.regiao || null,
            apelido: apelidoMap[normEmpNew] || null,
            vendedor: isClienteGrupoFox(inad.empresa) ? "Grupo Fox" : (vendedorMap[normEmpNew] || null),
            formaCobranca: formaCobrancaMap[inad.arId] || existingOfSameEmpresa?.formaCobranca || null,
            contatosAdicionais: contatosExtrasMap[normEmpNew] || [],
            // HERDAR campos manuais de cobrança da mesma empresa (só se datas forem compatíveis)
            observacoes: existingOfSameEmpresa?.observacoes || null,
            primeiraCobranca: etapasValidas ? (existingOfSameEmpresa?.primeiraCobranca || null) : null,
            semAcao1: etapasValidas ? (existingOfSameEmpresa?.semAcao1 || null) : null,
            segundaCobranca: etapasValidas ? (existingOfSameEmpresa?.segundaCobranca || null) : null,
            semAcao2: etapasValidas ? (existingOfSameEmpresa?.semAcao2 || null) : null,
            terceiraCobranca: etapasValidas ? (existingOfSameEmpresa?.terceiraCobranca || null) : null,
            semAcao3: etapasValidas ? (existingOfSameEmpresa?.semAcao3 || null) : null,
            acaoFinal: etapasValidas ? (existingOfSameEmpresa?.acaoFinal || null) : null,
            etapasPausadas: etapasValidas ? (existingOfSameEmpresa?.etapasPausadas || null) : null,
            // Rastreabilidade: de qual registro as etapas foram herdadas
            etapasHerdadasDeId: etapasValidas ? (existingOfSameEmpresa?.id || null) : null,
            etapasHerdadasDeDoc: etapasValidas ? (existingOfSameEmpresa?.documento || null) : null,
            updatedBy: `Sync: ${input.updatedBy}`,
          });
          
          // FIX APAGÕES - MIGRAR HISTÓRICO DE ETAPAS no sync manual também:
          if (existingOfSameEmpresa && etapasValidas && existingOfSameEmpresa.id) {
            // Buscar o ID do registro recém-inserido
            const lastInserted = await db.select({ id: cobrancaPlanilha.id })
              .from(cobrancaPlanilha)
              .where(eq(cobrancaPlanilha.arId, inad.arId))
              .orderBy(desc(cobrancaPlanilha.id))
              .limit(1);
            if (lastInserted.length > 0) {
              const newId = lastInserted[0].id;
              const donorObs = await db.select().from(cobrancaEtapaObs)
                .where(eq(cobrancaEtapaObs.planilhaId, existingOfSameEmpresa.id));
              if (donorObs.length > 0) {
                for (const obs of donorObs) {
                  await db.insert(cobrancaEtapaObs).values({
                    planilhaId: newId,
                    etapa: obs.etapa,
                    observacao: obs.observacao,
                    registradoPor: obs.registradoPor,
                  });
                }
                console.log(`[Sync] Histórico de etapas migrado: ${donorObs.length} registros de ID ${existingOfSameEmpresa.id} → ID ${newId} (${inad.empresa})`);
              }
            }
          }
          added++;
        }
      }

      // 8. Para títulos da planilha que NÃO foram matched (não estão mais na inadimplência)
      // Marcar como inativos (pago/resolvido) — NÃO deletar
      //
      // REGRA CRÍTICA (FIX APAGÕES): NUNCA desativar títulos com status diferente de "Pendente".
      // Se o financeiro trabalhou o título, ele JAMAIS pode ser desativado automaticamente.
      let notInInadimplencia = 0;
      let deactivated = 0;
      for (const item of planilhaAtual) {
        if (!matchedPlanilhaIds.has(item.id)) {
          // PROTEÇÃO ABSOLUTA: NUNCA desativar títulos com status diferente de "Pendente"
          if (item.status && item.status !== "Pendente") {
            notInInadimplencia++;
            continue; // NÃO desativar - título foi trabalhado pelo financeiro
          }
          // Marcar como inativo — título Pendente que não está mais na inadimplência (pago ou removido)
          await db.update(cobrancaPlanilha)
            .set({ ativo: false, updatedBy: `Sync: ${input.updatedBy} (pago/resolvido)` })
            .where(eq(cobrancaPlanilha.id, item.id));
          if (item.ativo) deactivated++;
          notInInadimplencia++;
        }
      }

      // 8b. Reativar títulos que voltaram à inadimplência (estavam inativos mas agora têm match)
      for (const item of planilhaAtual) {
        if (matchedPlanilhaIds.has(item.id) && !item.ativo) {
          await db.update(cobrancaPlanilha)
            .set({ ativo: true })
            .where(eq(cobrancaPlanilha.id, item.id));
        }
      }

      // 8c. BACKFILL: Preencher dados faltantes (CNPJ, Município, UF, Contato, Email) para itens ativos
      // Isso garante que mesmo títulos que entraram antes da correção ou cujo match por nome falhou
      // sejam enriquecidos buscando diretamente do GraphQL por nome parcial
      try {
        const itemsMissingData = await db.select({
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

        if (itemsMissingData.length > 0) {
          // Agrupar por empresa para evitar queries duplicadas
          const empresasToFetch = Array.from(new Set(itemsMissingData.map(i => i.empresa)));
          const backfillDataMap: Record<string, { cnpj?: string; municipio?: string; uf?: string; contato?: string; email?: string }> = {};

          for (const empresa of empresasToFetch) {
            // Primeiro tentar match exato nos mapas já carregados
            const normEmp = normalizeName(empresa);
            const existingCnpj = cnpjCpfMap[normEmp];
            const existingMun = municipioGqlMap[normEmp];
            const existingUf = ufGqlMap[normEmp];
            const existingContato = contatoGqlMap[normEmp];
            const existingEmail = emailNfeMap[normEmp] || emailEnderecoMap[normEmp];

            if (existingCnpj || existingMun || existingContato) {
              backfillDataMap[empresa] = {
                cnpj: existingCnpj || undefined,
                municipio: existingMun || undefined,
                uf: existingUf || undefined,
                contato: existingContato || undefined,
                email: existingEmail || undefined,
              };
            } else {
              // Se não encontrou nos mapas, buscar diretamente do GraphQL por nome parcial
              // Usar a primeira palavra significativa do nome (ignorar artigos e preposições)
              const words = empresa.split(/\s+/).filter(w => w.length > 2 && !['LTDA', 'EIRELI', 'EPP', 'MEI', 'COMERCIO', 'INDUSTRIA', 'DISTRIBUIDORA'].includes(w.toUpperCase()));
              const searchTerm = words.slice(0, 2).join(' ');
              if (searchTerm.length >= 3) {
                try {
                  const gqlResp = await gql<any>(`{
                    empresas(where: { razaoSocial: { contains: "${searchTerm.replace(/"/g, '')}" } }, take: 5) {
                      items {
                        razaoSocial
                        nomeFantasia
                        apelido
                        cnpjOuCpf
                        emailParaEnvioDeDocumentosFiscais
                        endereco { telefone1 email municipio { descricao uf { sigla } } }
                      }
                    }
                  }`);
                  if (gqlResp?.empresas?.items?.length) {
                    // Encontrar o melhor match
                    const bestMatch = gqlResp.empresas.items.find((e: any) => {
                      const names = [e.razaoSocial, e.nomeFantasia, e.apelido].filter(Boolean);
                      return names.some((n: string) => normalizeName(n) === normEmp);
                    }) || gqlResp.empresas.items[0];

                    const data: any = {};
                    if (bestMatch.cnpjOuCpf) data.cnpj = bestMatch.cnpjOuCpf.trim();
                    if (bestMatch.endereco?.municipio?.descricao) data.municipio = bestMatch.endereco.municipio.descricao;
                    if (bestMatch.endereco?.municipio?.uf?.sigla) data.uf = bestMatch.endereco.municipio.uf.sigla;
                    if (bestMatch.endereco?.telefone1) data.contato = bestMatch.endereco.telefone1.trim();
                    const emailVal = bestMatch.emailParaEnvioDeDocumentosFiscais || bestMatch.endereco?.email || '';
                    if (emailVal) data.email = emailVal.trim();
                    if (Object.keys(data).length > 0) backfillDataMap[empresa] = data;
                  }
                } catch (e) {
                  // Ignorar erros de busca individual
                }
              }
            }
          }

          // Aplicar backfill
          for (const item of itemsMissingData) {
            const data = backfillDataMap[item.empresa];
            if (!data) continue;
            const updates: any = {};
            if (!item.cnpjCpf && data.cnpj) updates.cnpjCpf = data.cnpj;
            if (!item.municipio && data.municipio) updates.municipio = data.municipio;
            if (!item.uf && data.uf) updates.uf = data.uf;
            if (!item.contato && data.contato) updates.contato = data.contato;
            if (!item.email && data.email) updates.email = data.email;
            if (Object.keys(updates).length > 0) {
              await db.update(cobrancaPlanilha)
                .set(updates)
                .where(eq(cobrancaPlanilha.id, item.id));
            }
          }
          console.log(`[Sync] Backfill: ${Object.keys(backfillDataMap).length}/${empresasToFetch.length} empresas enriquecidas`);
        }
      } catch (e) {
        console.error('[Sync] Erro no backfill de dados:', e);
      }

      // 9. Populate centroCustos for items that don't have it yet (from sales_orders)
      const itemsNeedCentro = await db.select({ id: cobrancaPlanilha.id, empresa: cobrancaPlanilha.empresa })
        .from(cobrancaPlanilha)
        .where(and(eq(cobrancaPlanilha.ativo, true), isNull(cobrancaPlanilha.centroCustos)));
      
      if (itemsNeedCentro.length > 0) {
        const centroClientes = Array.from(new Set(itemsNeedCentro.map(i => i.empresa)));
        const centroMap: Record<string, string> = {};
        for (const cliente of centroClientes) {
          const [result] = await db
            .select({ ec: salesOrders.estadoConfiguravel })
            .from(salesOrders)
            .where(and(
              eq(salesOrders.cliente, cliente),
              inArray(salesOrders.estadoConfiguravel, ['BAMBU', 'MADEIRA', 'ROJ\u00c3O', 'SERRAGEM'])
            ))
            .groupBy(salesOrders.estadoConfiguravel)
            .orderBy(desc(sql`COUNT(*)`))
            .limit(1);
          if (result?.ec) centroMap[cliente] = result.ec;
        }
        for (const item of itemsNeedCentro) {
          const centro = centroMap[item.empresa];
          if (centro) {
            await db.update(cobrancaPlanilha)
              .set({ centroCustos: centro })
              .where(eq(cobrancaPlanilha.id, item.id));
          }
        }
      }

      // 10. Buscar planilha atualizada para retornar contagem (apenas ativos)
      const planilhaFinal = await db.select().from(cobrancaPlanilha).where(eq(cobrancaPlanilha.ativo, true));

      return {
        success: true,
        summary: {
          totalBefore: planilhaAtual.filter(p => p.ativo).length,
          totalAfter: planilhaFinal.length,
          updated,
          added,
          statusUpdated,
          deactivated,
          notInInadimplencia,
          inadimplenciaTotal: inadTitles.length,
          backupCreated: true,
        },
      };
    }),

  // ==================== OBSERVAÇÕES POR ETAPA ====================

  /** Adicionar observação a uma etapa específica */
  addEtapaObs: publicProcedure
    .input(z.object({
      planilhaId: z.number(),
      etapa: z.string(),
      observacao: z.string().min(1),
      registradoPor: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Deduplicação: não inserir se a mesma observação já existe para esta etapa nos últimos 60 segundos
      const existing = await db.select({ id: cobrancaEtapaObs.id })
        .from(cobrancaEtapaObs)
        .where(and(
          eq(cobrancaEtapaObs.planilhaId, input.planilhaId),
          eq(cobrancaEtapaObs.etapa, input.etapa),
          eq(cobrancaEtapaObs.observacao, input.observacao),
          gte(cobrancaEtapaObs.createdAt, new Date(Date.now() - 60_000)),
        ))
        .limit(1);
      
      if (existing.length > 0) {
        return { success: true, deduplicated: true };
      }
      
      await db.insert(cobrancaEtapaObs).values({
        planilhaId: input.planilhaId,
        etapa: input.etapa,
        observacao: input.observacao,
        registradoPor: input.registradoPor,
      });
      return { success: true };
    }),

  /** Listar observações de uma etapa específica de um título */
  getEtapaObs: publicProcedure
    .input(z.object({
      planilhaId: z.number(),
      etapa: z.string().optional(), // se não informar, retorna todas as etapas
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Buscar observações apenas do planilhaId específico (cada entrada é uma cobrança independente)
      const conditions: any[] = [eq(cobrancaEtapaObs.planilhaId, input.planilhaId)];
      if (input.etapa) {
        conditions.push(eq(cobrancaEtapaObs.etapa, input.etapa));
      }
      const rows = await db.select().from(cobrancaEtapaObs)
        .where(and(...conditions))
        .orderBy(desc(cobrancaEtapaObs.createdAt));
      return rows;
    }),

  /** Listar TODAS as observações de um título (para o balãozinho de histórico) */
  getAllEtapaObs: publicProcedure
    .input(z.object({ planilhaId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Buscar observações apenas do planilhaId específico (cada entrada na inadimplência é uma cobrança nova)
      const rows = await db.select().from(cobrancaEtapaObs)
        .where(eq(cobrancaEtapaObs.planilhaId, input.planilhaId))
        .orderBy(desc(cobrancaEtapaObs.createdAt));
      return rows;
    }),

  /** Editar uma observação existente */
  updateEtapaObs: publicProcedure
    .input(z.object({
      id: z.number(),
      observacao: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(cobrancaEtapaObs)
        .set({ observacao: input.observacao })
        .where(eq(cobrancaEtapaObs.id, input.id));
      return { success: true };
    }),

  /** Excluir uma observação */
  deleteEtapaObs: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(cobrancaEtapaObs)
        .where(eq(cobrancaEtapaObs.id, input.id));
      return { success: true };
    }),

  /** Contar observações por título (para badge no balãozinho) */
  countEtapaObs: publicProcedure
    .input(z.object({ planilhaIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      if (input.planilhaIds.length === 0) return {};
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const rows = await db.select({
        planilhaId: cobrancaEtapaObs.planilhaId,
        count: sql<number>`COUNT(*)`,
      }).from(cobrancaEtapaObs)
        .where(inArray(cobrancaEtapaObs.planilhaId, input.planilhaIds))
        .groupBy(cobrancaEtapaObs.planilhaId);
      const map: Record<number, number> = {};
      for (const r of rows) {
        map[r.planilhaId] = Number(r.count);
      }
      return map;
    }),

  /** Buscar dados da planilha de cobrança por nome de empresa (para enriquecer PDF) */
  getByEmpresa: publicProcedure
    .input(z.object({ empresa: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Buscar títulos ativos dessa empresa
      const items = await db.select().from(cobrancaPlanilha)
        .where(and(
          like(cobrancaPlanilha.empresa, `%${input.empresa}%`),
          eq(cobrancaPlanilha.ativo, true)
        ));
      if (items.length === 0) return null;
      // Buscar observações de etapa de todos os títulos encontrados
      const planilhaIds = items.map(i => i.id);
      const obs = await db.select().from(cobrancaEtapaObs)
        .where(inArray(cobrancaEtapaObs.planilhaId, planilhaIds))
        .orderBy(cobrancaEtapaObs.createdAt);
      return {
        items: items.map(i => ({
          id: i.id,
          empresa: i.empresa,
          valor: i.valor,
          vencimento: i.vencimento,
          diasVencidos: i.diasVencidos,
          tipo: i.tipo,
          status: i.status,
          primeiraCobranca: i.primeiraCobranca,
          semAcao1: i.semAcao1,
          segundaCobranca: i.segundaCobranca,
          semAcao2: i.semAcao2,
          terceiraCobranca: i.terceiraCobranca,
          semAcao3: i.semAcao3,
          acaoFinal: i.acaoFinal,
          contato: i.contato,
          email: i.email,
        })),
        observacoes: obs.map(o => ({
          etapa: o.etapa,
          observacao: o.observacao,
          registradoPor: o.registradoPor,
          createdAt: o.createdAt,
        })),
      };
    }),

  /** Buscar TODAS as observações de etapa para múltiplos planilhaIds (para exportação PDF) */
  getBulkEtapaObs: publicProcedure
    .input(z.object({ planilhaIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      if (input.planilhaIds.length === 0) return {};
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const rows = await db.select().from(cobrancaEtapaObs)
        .where(inArray(cobrancaEtapaObs.planilhaId, input.planilhaIds))
        .orderBy(cobrancaEtapaObs.createdAt);
      // Group by planilhaId
      const map: Record<number, Array<{ etapa: string; observacao: string; registradoPor: string; createdAt: Date }>> = {};
      for (const r of rows) {
        if (!map[r.planilhaId]) map[r.planilhaId] = [];
        map[r.planilhaId].push({
          etapa: r.etapa,
          observacao: r.observacao,
          registradoPor: r.registradoPor,
          createdAt: r.createdAt,
        });
      }
      return map;
    }),

  // ============ SELLER ALERTS (Acionar Vendedor) ============

  /**
   * Criar alerta para vendedor (acionado pelo financeiro)
   */
  createSellerAlert: publicProcedure
    .input(z.object({
      empresa: z.string(),
      cnpj: z.string().nullable().optional(),
      vendedor: z.string(),
      mensagem: z.string(),
      valorTotal: z.number().nullable().optional(),
      titulosVencidos: z.number().nullable().optional(),
      diasAtrasoMax: z.number().nullable().optional(),
      criadoPor: z.string(),
      planilhaId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(sellerAlerts).values({
        empresa: input.empresa,
        cnpj: input.cnpj || null,
        vendedor: input.vendedor,
        mensagem: input.mensagem,
        valorTotal: input.valorTotal?.toString() || null,
        titulosVencidos: input.titulosVencidos || null,
        diasAtrasoMax: input.diasAtrasoMax || null,
        criadoPor: input.criadoPor,
        planilhaId: input.planilhaId || null,
      });
      return { success: true, id: result.insertId };
    }),

  /**
   * Listar alertas pendentes para um vendedor específico
   */
  getSellerAlerts: publicProcedure
    .input(z.object({
      vendedor: z.string(),
      includeResolved: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      // Normalize: remove accents for matching (seller_permissions has "JORDÃO LAINE", planilha has "JORDAO")
      const normalized = normalizeName(input.vendedor);
      const firstName = normalized.split(' ')[0];
      // Match by: exact, normalized first name starts with, or COLLATE accent-insensitive
      const conditions: any[] = [
        sql`(
          UPPER(${sellerAlerts.vendedor}) COLLATE utf8mb4_general_ci = ${normalized}
          OR UPPER(${sellerAlerts.vendedor}) COLLATE utf8mb4_general_ci LIKE ${firstName + '%'}
          OR ${sellerAlerts.vendedor} = ${input.vendedor}
        )`
      ];
      if (!input.includeResolved) {
        conditions.push(sql`${sellerAlerts.status} != 'resolvido'`);
        conditions.push(sql`${sellerAlerts.status} != 'cancelado'`);
      }
      return db.select()
        .from(sellerAlerts)
        .where(and(...conditions))
        .orderBy(desc(sellerAlerts.createdAt));
    }),

  /**
   * Contar alertas pendentes por vendedor (para badge/piscar)
   */
  countPendingAlerts: publicProcedure
    .input(z.object({
      vendedor: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { count: 0 };
      const normalized = normalizeName(input.vendedor);
      const firstName = normalized.split(' ')[0];
      const [result] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(sellerAlerts)
        .where(and(
          sql`(
            UPPER(${sellerAlerts.vendedor}) COLLATE utf8mb4_general_ci = ${normalized}
            OR UPPER(${sellerAlerts.vendedor}) COLLATE utf8mb4_general_ci LIKE ${firstName + '%'}
            OR ${sellerAlerts.vendedor} = ${input.vendedor}
          )`,
          eq(sellerAlerts.status, 'pendente')
        ));
      return { count: result?.count || 0 };
    }),

  /**
   * Marcar alerta como visto pelo vendedor
   */
  markAlertViewed: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(sellerAlerts)
        .set({ status: 'visto', viewedAt: new Date() })
        .where(eq(sellerAlerts.id, input.id));
      return { success: true };
    }),

  /**
   * Marcar alerta como "em andamento" pelo vendedor
   * Indica que o vendedor está trabalhando no caso mas ainda não resolveu
   */
  markAlertInProgress: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(sellerAlerts)
        .set({ status: 'em_andamento', viewedAt: new Date() })
        .where(eq(sellerAlerts.id, input.id));
      return { success: true };
    }),

  /**
   * Marcar alerta como resolvido pelo vendedor
   */
  markAlertResolved: publicProcedure
    .input(z.object({
      id: z.number(),
      respostaVendedor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the alert details first
      const [alert] = await db.select().from(sellerAlerts).where(eq(sellerAlerts.id, input.id));
      if (!alert) throw new Error("Alert not found");

      // Mark as resolved
      await db.update(sellerAlerts)
        .set({
          status: 'resolvido',
          resolvedAt: new Date(),
          respostaVendedor: input.respostaVendedor || null,
        })
        .where(eq(sellerAlerts.id, input.id));

      // Add a note in the cobrança history for the financeiro to see
      const nota = input.respostaVendedor
        ? `[VENDEDOR ATUOU] ${alert.vendedor} resolveu o alerta. Resposta: ${input.respostaVendedor}`
        : `[VENDEDOR ATUOU] ${alert.vendedor} marcou o alerta como resolvido.`;

      if (alert.planilhaId) {
        await db.insert(cobrancaEtapaObs).values({
          planilhaId: alert.planilhaId,
          etapa: "intervencaoVendedor",
          observacao: nota,
          registradoPor: alert.vendedor,
        });
      } else {
        // If no planilhaId, try to find by empresa
        const [planilhaRecord] = await db.select({ id: cobrancaPlanilha.id })
          .from(cobrancaPlanilha)
          .where(and(
            eq(cobrancaPlanilha.empresa, alert.empresa),
            eq(cobrancaPlanilha.ativo, true),
          ))
          .limit(1);
        if (planilhaRecord) {
          await db.insert(cobrancaEtapaObs).values({
            planilhaId: planilhaRecord.id,
            etapa: "intervencaoVendedor",
            observacao: nota,
            registradoPor: alert.vendedor,
          });
        }
      }

      return { success: true };
    }),

  /**
   * Obter dados da planilha de cobrança filtrados por vendedor
   * (para exibir na aba de vendas do vendedor)
   */
  getByVendedor: publicProcedure
    .input(z.object({
      vendedor: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], etapasObs: [] };
      // Normalize for accent-insensitive matching (JORDÃO LAINE vs JORDAO)
      const normalized = normalizeName(input.vendedor);
      const firstName = normalized.split(' ')[0];
      const items = await db.select()
        .from(cobrancaPlanilha)
        .where(and(
          eq(cobrancaPlanilha.ativo, true),
          sql`(
            UPPER(${cobrancaPlanilha.vendedor}) COLLATE utf8mb4_general_ci = ${normalized}
            OR UPPER(${cobrancaPlanilha.vendedor}) COLLATE utf8mb4_general_ci LIKE ${firstName + '%'}
            OR ${cobrancaPlanilha.vendedor} = ${input.vendedor}
          )`
        ))
        .orderBy(desc(cobrancaPlanilha.diasVencidos));
      
      // Also get etapa observations for these items
      const planilhaIds = items.map(i => i.id);
      let etapasObs: any[] = [];
      if (planilhaIds.length > 0) {
        etapasObs = await db.select()
          .from(cobrancaEtapaObs)
          .where(inArray(cobrancaEtapaObs.planilhaId, planilhaIds))
          .orderBy(desc(cobrancaEtapaObs.createdAt));
      }
      return { items, etapasObs };
    }),
  /**
   * Listar todos os alertas de vendedor (para o financeiro ver quais clientes foram acionados)
   */
  getAllSellerAlerts: publicProcedure
    .input(z.object({
      includeResolved: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (!input?.includeResolved) {
        conditions.push(sql`${sellerAlerts.status} NOT IN ('resolvido', 'cancelado')`);
      }
      const result = await db.select()
        .from(sellerAlerts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sellerAlerts.createdAt))
        .limit(200);
      return result;
    }),
  /**
   * Cancelar/remover alerta pelo financeiro (Flávio, Thalita, Guilherme)
   */
  cancelAlertByFinanceiro: publicProcedure
    .input(z.object({
      id: z.number(),
      cancelledBy: z.string(),
      cancelReason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [alert] = await db.select().from(sellerAlerts).where(eq(sellerAlerts.id, input.id));
      if (!alert) throw new Error("Alerta n\u00e3o encontrado");
      if (alert.status === 'cancelado') throw new Error("Alerta j\u00e1 foi cancelado");
      if (alert.status === 'resolvido') throw new Error("Alerta j\u00e1 foi resolvido pelo vendedor");
      await db.update(sellerAlerts)
        .set({
          status: 'cancelado',
          cancelledBy: input.cancelledBy,
          cancelReason: input.cancelReason || null,
          cancelledAt: new Date(),
        })
        .where(eq(sellerAlerts.id, input.id));
      // Add note in cobranca history
      const nota = input.cancelReason
        ? `[ALERTA CANCELADO] ${input.cancelledBy} cancelou o acionamento do vendedor ${alert.vendedor}. Motivo: ${input.cancelReason}`
        : `[ALERTA CANCELADO] ${input.cancelledBy} cancelou o acionamento do vendedor ${alert.vendedor}.`;
      if (alert.planilhaId) {
        await db.insert(cobrancaEtapaObs).values({
          planilhaId: alert.planilhaId,
          etapa: "intervencaoVendedor",
          observacao: nota,
          registradoPor: input.cancelledBy,
        });
      }
      return { success: true };
    }),
  /**
   * Histórico completo de acionamentos com métricas
   */
  getAlertsHistory: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(500),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { alerts: [], metrics: { total: 0, pendentes: 0, vistos: 0, emAndamento: 0, resolvidos: 0, cancelados: 0, tempoMedioResolucaoHoras: 0 } };
      const allAlerts = await db.select()
        .from(sellerAlerts)
        .orderBy(desc(sellerAlerts.createdAt))
        .limit(input?.limit || 500);
      // Calculate metrics
      const total = allAlerts.length;
      const pendentes = allAlerts.filter(a => a.status === 'pendente').length;
      const vistos = allAlerts.filter(a => a.status === 'visto').length;
      const resolvidos = allAlerts.filter(a => a.status === 'resolvido').length;
      const emAndamento = allAlerts.filter(a => a.status === 'em_andamento').length;
      const cancelados = allAlerts.filter(a => a.status === 'cancelado').length;
      // Average resolution time
      const resolvedAlerts = allAlerts.filter(a => a.status === 'resolvido' && a.resolvedAt && a.createdAt);
      let tempoMedioResolucaoHoras = 0;
      if (resolvedAlerts.length > 0) {
        const totalHours = resolvedAlerts.reduce((sum, a) => {
          const diff = new Date(a.resolvedAt!).getTime() - new Date(a.createdAt).getTime();
          return sum + diff / (1000 * 60 * 60);
        }, 0);
        tempoMedioResolucaoHoras = Math.round((totalHours / resolvedAlerts.length) * 10) / 10;
      }
      return {
        alerts: allAlerts,
        metrics: { total, pendentes, vistos, emAndamento, resolvidos, cancelados, tempoMedioResolucaoHoras },
      };
    }),

  /**
   * Excluir um alerta do histórico (apenas Guilherme)
   */
  deleteAlert: publicProcedure
    .input(z.object({
      id: z.number(),
      operador: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Apenas Guilherme pode excluir
      const allowed = input.operador.toLowerCase().includes('guilherme');
      if (!allowed) throw new Error("Apenas Guilherme pode excluir alertas do histórico.");
      await db.delete(sellerAlerts).where(eq(sellerAlerts.id, input.id));
      return { success: true };
    }),

  /**
   * Financeiro confirma que viu a devolutiva do vendedor (clica no sininho)
   * Isso para de piscar o cliente na aba Inadimplência
   */
  acknowledgeSellerResponse: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(sellerAlerts)
        .set({ financeiroAcknowledgedAt: new Date() })
        .where(eq(sellerAlerts.id, input.id));
      return { success: true };
    }),

  /**
   * Buscar alertas que o vendedor respondeu mas o financeiro ainda não confirmou
   * (status != pendente && financeiroAcknowledgedAt IS NULL)
   */
  getUnacknowledgedAlerts: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const result = await db.select()
        .from(sellerAlerts)
        .where(and(
          sql`${sellerAlerts.status} IN ('visto', 'em_andamento', 'resolvido')`,
          sql`${sellerAlerts.financeiroAcknowledgedAt} IS NULL`
        ))
        .orderBy(desc(sellerAlerts.updatedAt));
      return result;
    }),
});
