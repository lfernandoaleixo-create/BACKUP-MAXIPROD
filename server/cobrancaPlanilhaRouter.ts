import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { cobrancaPlanilha } from "../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

/**
 * Router para a Planilha de Cobrança interativa.
 * Reproduz a planilha Excel INADIMPLÊNCIA.xlsx no dashboard.
 * 
 * REGRA: NUNCA apagar registros. Dados manuais que não podem ser re-sincronizados.
 * Editável pelo Thiago e operadores com acesso financeiro.
 */
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
      
      // Whitelist of editable fields
      const editableFields = [
        'status', 'observacoes', 'promessaPgto', 'primeiraCobranca',
        'semAcao1', 'segundaCobranca', 'semAcao2', 'terceiraCobranca',
        'semAcao3', 'acaoFinal', 'tipo', 'diasVencidos',
      ];
      
      if (!editableFields.includes(input.field)) {
        throw new Error(`Campo '${input.field}' não é editável`);
      }
      
      // Map camelCase field names to DB column names
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
      };
      
      const colName = fieldToColumn[input.field] || input.field;
      
      await db.execute(
        sql`UPDATE cobranca_planilha SET ${sql.raw(colName)} = ${input.value}, updated_by = ${input.updatedBy} WHERE id = ${input.id}`
      );
      return { success: true };
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
      // Insert in batches of 20
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
    
    const all = await db.select().from(cobrancaPlanilha);
    
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
});
