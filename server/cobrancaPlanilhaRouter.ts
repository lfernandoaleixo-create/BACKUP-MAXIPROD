import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { cobrancaPlanilha, cobrancaPlanilhaBackup, accountsReceivable, collectionActions, cobrancaEtapaObs, salesOrders } from "../drizzle/schema";
import { eq, desc, sql, and, inArray, lte, asc, isNull, like } from "drizzle-orm";
import { gql } from "./maxiprodGraphQL";

/**
 * Router para a Planilha de Cobrança interativa.
 * Reproduz a planilha Excel INADIMPLÊNCIA.xlsx no dashboard.
 * 
 * REGRA: NUNCA apagar registros. Dados manuais que não podem ser re-sincronizados.
 * Editável pelo Thiago e operadores com acesso financeiro.
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

// Mapeamento de status da inadimplência (collection_actions) → planilha de cobrança
const STATUS_MAP: Record<string, string> = {
  pendente: "Pendente",
  contatado: "Contatado",
  em_negociacao: "Em negociação",
  promessa: "Promessa de Pgto",
  especial_sem_cobranca: "Especial s/ cobrança",
  protestado: "Protestado",
  cheque_compensacao: "Cheque em compensação",
  nao_retornou: "Não deu retorno",
  nao_atendeu: "Não atendeu",
  juridico: "Jurídico",
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
        'contato', 'email', 'regiao', 'municipio', 'uf', 'cnpjCpf', 'centroCustos',
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
      };
      
      const colName = fieldToColumn[input.field] || input.field;
      
      await db.execute(
        sql`UPDATE cobranca_planilha SET ${sql.raw(colName)} = ${input.value}, updated_by = ${input.updatedBy} WHERE id = ${input.id}`
      );
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
    if (!db) return { total: 0, byStatus: {}, byCenter: {}, totalValor: 0 };
    
    const all = await db.select().from(cobrancaPlanilha).where(eq(cobrancaPlanilha.ativo, true));
    
    const byStatus: Record<string, { count: number; valor: number }> = {};
    const byCenter: Record<string, { count: number; valor: number }> = {};
    let totalValor = 0;
    
    for (const item of all) {
      const status = item.status || "Pendente";
      const center = item.centroCustos || "Outros";
      const valor = item.valor ? parseFloat(String(item.valor)) : 0;
      
      if (!byStatus[status]) byStatus[status] = { count: 0, valor: 0 };
      byStatus[status].count++;
      byStatus[status].valor += valor;
      
      if (!byCenter[center]) byCenter[center] = { count: 0, valor: 0 };
      byCenter[center].count++;
      byCenter[center].valor += valor;
      
      totalValor += valor;
    }
    
    return { total: all.length, byStatus, byCenter, totalValor };
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
   * REGRA CRÍTICA: O status e tipo que o Thiago/Thalita marcarem ficam FIXOS
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

          return {
            arId: row.id,
            empresa: (row.cliente || "").trim(),
            descricao: row.referenteA || "",
            vencimento: vencDate,
            valorOriginal,
            valorAReceber,
            diasVencidos: businessDaysOverdue,
            tipo: tipoPlanilha,
            status: statusPlanilha,
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

      // 4c. Buscar vendedor, apelido e email NF-e de cada cliente via GraphQL
      const vendedorMap: Record<string, string> = {};
      const apelidoMap: Record<string, string> = {};
      const emailNfeMap: Record<string, string> = {};
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
                emailParaEnvioDeDocumentosFiscais
                representanteOuVendedor1Preferencial { nomeFantasia razaoSocial }
              }
            }
          }`);
          if (!resp?.empresas) break;
          total = resp.empresas.totalCount;
          for (const emp of resp.empresas.items) {
            const names = [emp.nomeFantasia, emp.razaoSocial, emp.apelido].filter(Boolean);
            const normalizedNames = names.map((n: string) => normalizeName(n));
            
            // Mapear apelido para cada nome da empresa (só se diferente do nome/razão)
            const apelidoValue = (emp.apelido || "").trim();
            if (apelidoValue) {
              const apelidoNorm = normalizeName(apelidoValue);
              const nomeNorm = normalizeName(emp.nomeFantasia || "");
              const razaoNorm = normalizeName(emp.razaoSocial || "");
              // Só salvar apelido se for diferente do nome fantasia e razão social
              if (apelidoNorm !== nomeNorm && apelidoNorm !== razaoNorm) {
                for (const normName of normalizedNames) {
                  if (!apelidoMap[normName]) apelidoMap[normName] = apelidoValue;
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
            const vendedorName = rep.nomeFantasia || rep.razaoSocial || "";
            if (!vendedorName) continue;
            for (const normName of normalizedNames) {
              if (!vendedorMap[normName]) vendedorMap[normName] = vendedorName;
            }
          }
          skip += PAGE_SIZE;
        } while (skip < total);
      } catch (e) {
        console.error("[Sync] Erro ao buscar vendedores:", e);
      }

      // 4d. Buscar contatos extras (múltiplos telefones) de cada cliente via GraphQL
      const contatosExtrasMap: Record<string, string[]> = {};
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
                enderecoDeCobranca { telefone1 telefone2 telefone3 telefone4 }
                enderecoDeEntrega { telefone1 telefone2 telefone3 telefone4 }
                enderecoDeFaturamento { telefone1 telefone2 telefone3 telefone4 }
              }
            }
          }`);
          if (!resp?.empresas) break;
          total = resp.empresas.totalCount;
          for (const emp of resp.empresas.items) {
            const phones = new Set<string>();
            const addrs = [emp.enderecoDeCobranca, emp.enderecoDeEntrega, emp.enderecoDeFaturamento];
            for (const addr of addrs) {
              if (!addr) continue;
              for (const key of ['telefone1', 'telefone2', 'telefone3', 'telefone4']) {
                const tel = (addr[key] || "").trim();
                if (tel && tel.length >= 8) phones.add(tel);
              }
            }
            if (phones.size > 0) {
              const phonesArr = Array.from(phones);
              const names = [emp.nomeFantasia, emp.razaoSocial, emp.apelido].filter(Boolean);
              for (const name of names) {
                const normName = normalizeName(name);
                if (!contatosExtrasMap[normName]) contatosExtrasMap[normName] = phonesArr;
              }
            }
          }
          skip += PAGE_SIZE;
        } while (skip < total);
      } catch (e) {
        console.error("[Sync] Erro ao buscar contatos extras:", e);
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
        // O status e tipo que o Thiago/Thalita marcarem ficam FIXOS até eles mudarem manualmente.
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
        if (!match.contato && clienteData.contato) updateData.contato = clienteData.contato;
        // Email: priorizar emailParaEnvioDeDocumentosFiscais do Maxiprod, fallback para email do pedido
        if (!match.email) {
          const nfeEmail = emailNfeMap[empresaNorm];
          if (nfeEmail) {
            updateData.email = nfeEmail;
          } else if (clienteData.email) {
            updateData.email = clienteData.email;
          }
        }
        if (!match.municipio && clienteData.municipio) updateData.municipio = clienteData.municipio;
        if (!match.uf && clienteData.uf) updateData.uf = clienteData.uf;
        if (!match.regiao && clienteData.regiao) updateData.regiao = clienteData.regiao;

        // Vendedor, apelido, forma de cobrança e contatos extras (sempre atualizar)
        // REGRA: Se cliente é Keure/Johnson → vendedor = "Grupo Fox"
        const vendedor = isClienteGrupoFox(inad.empresa) ? "Grupo Fox" : vendedorMap[empresaNorm];
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
          if (!match.contato && clienteData.contato) updateData.contato = clienteData.contato;
          // Email: priorizar emailParaEnvioDeDocumentosFiscais do Maxiprod, fallback para email do pedido
          if (!match.email) {
            const nfeEmail = emailNfeMap[empresaNormFb];
            if (nfeEmail) {
              updateData.email = nfeEmail;
            } else if (clienteData.email) {
              updateData.email = clienteData.email;
            }
          }
          if (!match.municipio && clienteData.municipio) updateData.municipio = clienteData.municipio;
          if (!match.uf && clienteData.uf) updateData.uf = clienteData.uf;
          if (!match.regiao && clienteData.regiao) updateData.regiao = clienteData.regiao;

          // Vendedor, apelido, forma de cobrança e contatos extras
          const empresaNorm2 = normalizeName(inad.empresa);
          // REGRA: Se cliente é Keure/Johnson → vendedor = "Grupo Fox"
          const vendedor2 = isClienteGrupoFox(inad.empresa) ? "Grupo Fox" : vendedorMap[empresaNorm2];
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
          
          // Enriquecer com dados de contato do cliente
          const clienteData = clienteDataMap[inad.empresa] || {};
          
          await db.insert(cobrancaPlanilha).values({
            arId: inad.arId,
            empresa: inad.empresa,
            descricao: inad.descricao || null,
            cnpjCpf: null,
            municipio: clienteData.municipio || null,
            uf: clienteData.uf || null,
            pais: null,
            centroCustos: null, // Será preenchido manualmente
            valor: String(inad.valorAReceber),
            vencimento: inad.vencimento,
            diasVencidos: inad.diasVencidos,
            tipo: inad.tipo,
            status: inad.status,
            contato: clienteData.contato || null,
            email: emailNfeMap[normalizeName(inad.empresa)] || clienteData.email || null,
            regiao: clienteData.regiao || null,
            apelido: apelidoMap[normalizeName(inad.empresa)] || null,
            vendedor: isClienteGrupoFox(inad.empresa) ? "Grupo Fox" : (vendedorMap[normalizeName(inad.empresa)] || null),
            formaCobranca: formaCobrancaMap[inad.arId] || null,
            contatosAdicionais: contatosExtrasMap[normalizeName(inad.empresa)] || [],
            updatedBy: `Sync: ${input.updatedBy}`,
          });
          added++;
        }
      }

      // 8. Para títulos da planilha que NÃO foram matched (não estão mais na inadimplência)
      // Marcar como inativos (pago/resolvido) — NÃO deletar
      let notInInadimplencia = 0;
      let deactivated = 0;
      for (const item of planilhaAtual) {
        if (!matchedPlanilhaIds.has(item.id)) {
          // Marcar como inativo — título não está mais na inadimplência (pago ou removido)
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

      // 9. Buscar planilha atualizada para retornar contagem (apenas ativos)
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
  addEtapaObs: protectedProcedure
    .input(z.object({
      planilhaId: z.number(),
      etapa: z.string(),
      observacao: z.string().min(1),
      registradoPor: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(cobrancaEtapaObs).values({
        planilhaId: input.planilhaId,
        etapa: input.etapa,
        observacao: input.observacao,
        registradoPor: input.registradoPor,
      });
      return { success: true };
    }),

  /** Listar observações de uma etapa específica de um título */
  getEtapaObs: protectedProcedure
    .input(z.object({
      planilhaId: z.number(),
      etapa: z.string().optional(), // se não informar, retorna todas as etapas
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const conditions = [eq(cobrancaEtapaObs.planilhaId, input.planilhaId)];
      if (input.etapa) {
        conditions.push(eq(cobrancaEtapaObs.etapa, input.etapa));
      }
      const rows = await db.select().from(cobrancaEtapaObs)
        .where(and(...conditions))
        .orderBy(desc(cobrancaEtapaObs.createdAt));
      return rows;
    }),

  /** Listar TODAS as observações de um título (para o balãozinho de histórico) */
  getAllEtapaObs: protectedProcedure
    .input(z.object({ planilhaId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const rows = await db.select().from(cobrancaEtapaObs)
        .where(eq(cobrancaEtapaObs.planilhaId, input.planilhaId))
        .orderBy(desc(cobrancaEtapaObs.createdAt));
      return rows;
    }),

  /** Editar uma observação existente */
  updateEtapaObs: protectedProcedure
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
  deleteEtapaObs: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(cobrancaEtapaObs)
        .where(eq(cobrancaEtapaObs.id, input.id));
      return { success: true };
    }),

  /** Contar observações por título (para badge no balãozinho) */
  countEtapaObs: protectedProcedure
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
  getByEmpresa: protectedProcedure
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
});
