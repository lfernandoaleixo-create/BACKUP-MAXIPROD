/**
 * Serasa Router - Consultas de crédito via API KSI (Relatório GOLD)
 * 
 * Funcionalidades:
 * - Consultar Serasa (protegido por senha do operador)
 * - Histórico de consultas por cliente
 * - Última consulta para um documento (para Vitória)
 * - Métricas de consultas por operador (para gestores)
 */

import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { serasaConsultas, operators } from "../drizzle/schema";
import { sql, eq, desc, and } from "drizzle-orm";
import { consultarSerasa } from "./serasaApi";

// Operadores autorizados a consultar Serasa (por enquanto apenas gestores)
const AUTHORIZED_NAMES = ["Fernando", "Guilherme", "Bruno", "Vitória"];

export const serasaRouter = router({
  /**
   * Verifica se o operador está autorizado a fazer consultas Serasa.
   * Retorna true/false baseado no nome.
   */
  checkAuthorization: publicProcedure
    .input(z.object({ operadorName: z.string() }))
    .query(async ({ input }) => {
      const isAuthorized = AUTHORIZED_NAMES.some(
        name => input.operadorName.toLowerCase().includes(name.toLowerCase())
      );
      return { authorized: isAuthorized };
    }),

  /**
   * Realiza consulta de crédito no Serasa.
   * Requer confirmação de senha do operador antes de executar.
   * Cada consulta é PAGA e fica registrada no histórico.
   */
  consultar: publicProcedure
    .input(z.object({
      documento: z.string().min(11).max(18), // CPF ou CNPJ (com ou sem máscara)
      tipoPessoa: z.enum(["PF", "PJ"]),
      operadorName: z.string(),
      operadorPassword: z.string(),
      salesOrderRequestId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();

      // 1. Verificar se o operador está autorizado
      const isAuthorized = AUTHORIZED_NAMES.some(
        name => input.operadorName.toLowerCase().includes(name.toLowerCase())
      );
      if (!isAuthorized) {
        return { success: false, error: "Operador não autorizado para consultas Serasa." };
      }

      // 2. Verificar senha do operador
      const [operator] = await db!
        .select()
        .from(operators)
        .where(
          and(
            sql`LOWER(${operators.name}) = LOWER(${input.operadorName})`,
            eq(operators.active, true)
          )
        )
        .limit(1);

      if (!operator) {
        return { success: false, error: "Operador não encontrado no sistema." };
      }

      if (operator.password !== input.operadorPassword) {
        return { success: false, error: "Senha incorreta." };
      }

      // 3. Realizar consulta na API Serasa
      const resultado = await consultarSerasa(input.documento, input.tipoPessoa);

      if (!resultado.success || !resultado.data) {
        return { success: false, error: resultado.error || "Erro desconhecido na consulta." };
      }

      // 4. Extrair dados resumidos
      const dados = resultado.data;
      const cadastro = dados.cadastraispj || dados.cadastraispf;
      const clienteNome = cadastro?.nome || null;
      const score = cadastro?.score || null;
      const pontualidade = cadastro?.pontualidadeDePagamento || null;
      const limiteCredito = cadastro?.limiteDeCredito || null;
      const rendaEstimada = cadastro?.rendaEstimada || cadastro?.faturamentoPresumido || null;
      const credito = dados.credito;
      const aprovado = credito.qntTotalPendenciasGeral === 0 && (dados.relatorioIA?.aprovado !== false);

      // 5. Salvar no histórico
      const [inserted] = await db!.insert(serasaConsultas).values({
        operadorName: input.operadorName,
        operadorId: operator.id,
        clienteDocumento: input.documento.replace(/[.\-\/]/g, ""),
        clienteNome,
        tipoPessoa: input.tipoPessoa,
        aprovado,
        score,
        pontualidade: pontualidade !== null ? String(pontualidade) : null,
        limiteCredito: limiteCredito !== null ? String(limiteCredito) : null,
        rendaEstimada: rendaEstimada !== null ? String(rendaEstimada) : null,
        totalPendencias: credito.qntTotalPendenciasGeral,
        valorTotalPendencias: String(credito.valorTotalPendenciasGeral || 0),
        temProtesto: credito.contemProtesto,
        temRgi: credito.contemRgi,
        temChequeSemFundo: credito.contemChequeSemFundo,
        analiseIA: dados.relatorioIA?.analiseAi || null,
        resultadoCompleto: dados.rawResponse,
        salesOrderRequestId: input.salesOrderRequestId || null,
      });

      // 6. Retornar resultado completo para exibição (TODOS os campos da API)
      return {
        success: true,
        consultaId: inserted.insertId,
        resultado: {
          aprovado,
          clienteNome,
          documento: input.documento,
          tipoPessoa: input.tipoPessoa,
          score,
          pontualidade,
          limiteCredito,
          rendaEstimada,
          totalPendencias: credito.qntTotalPendenciasGeral,
          valorTotalPendencias: credito.valorTotalPendenciasGeral,
          temProtesto: credito.contemProtesto,
          temRgi: credito.contemRgi,
          temChequeSemFundo: credito.contemChequeSemFundo,
          analiseIA: dados.relatorioIA?.analiseAi || null,
          analiseAprovada: dados.relatorioIA?.aprovado ?? null,
          // Dados cadastrais completos - TODOS os campos disponíveis
          cadastro: cadastro ? {
            nome: cadastro.nome,
            documento: cadastro.documento,
            dataNascimento: cadastro.dataNascimento || null, // Data de fundação (PJ) ou nascimento (PF)
            situacao: cadastro.situacao || cadastro.situacaoCPF || null,
            porte: cadastro.porte || null,
            atividadePrincipal: cadastro.atividadePrincipal || null,
            capitalSocial: cadastro.capitalSocial || null,
            faturamentoPresumido: cadastro.faturamentoPresumido || null,
            rendaEstimada: cadastro.rendaEstimada || null,
            limiteDeCredito: cadastro.limiteDeCredito || null,
            pontualidadeDePagamento: cadastro.pontualidadeDePagamento || null,
            score: cadastro.score || null,
            // Contatos
            qntEmails: cadastro.qntEmails || 0,
            emails: cadastro.emails || [],
            qntTelefones: cadastro.qntTelefones || 0,
            telefones: cadastro.telefones || [],
            // Endereços
            qntEnderecos: cadastro.qntEnderecos || 0,
            enderecos: cadastro.enderecos || [],
            // Quadro Societário
            qntQuadroSociatario: cadastro.qntQuadroSociatario || 0,
            quadroSociatario: cadastro.quadroSociatario || [],
          } : null,
          // Detalhes de pendências
          pendencias: {
            rgi: { quantidade: credito.qntRgi, valor: credito.valorTotalRgi, registros: credito.registrosRgi || [] },
            protestos: { quantidade: credito.qntProtesto, valor: credito.valorTotalProtesto, registros: credito.registrosProtesto || [] },
            chequesSemFundo: { quantidade: credito.qntChequeSemFundo, registros: credito.registrosChequeSemFundo || [] },
          },
          timestamp: dados.timestamp,
        },
      };
    }),

  /**
   * Busca a última consulta Serasa feita para um documento específico.
   * Usado para mostrar "Última consulta feita há X dias" para a Vitória.
   */
  ultimaConsulta: publicProcedure
    .input(z.object({ documento: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const docLimpo = input.documento.replace(/[.\-\/]/g, "");

      const [ultima] = await db!
        .select({
          id: serasaConsultas.id,
          operadorName: serasaConsultas.operadorName,
          aprovado: serasaConsultas.aprovado,
          score: serasaConsultas.score,
          totalPendencias: serasaConsultas.totalPendencias,
          createdAt: serasaConsultas.createdAt,
        })
        .from(serasaConsultas)
        .where(eq(serasaConsultas.clienteDocumento, docLimpo))
        .orderBy(desc(serasaConsultas.createdAt))
        .limit(1);

      if (!ultima) {
        return { found: false, consulta: null };
      }

      // Calcular dias desde a última consulta
      const agora = new Date();
      const dataConsulta = new Date(ultima.createdAt);
      const diffMs = agora.getTime() - dataConsulta.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let tempoTexto: string;
      if (diffDias === 0) tempoTexto = "hoje";
      else if (diffDias === 1) tempoTexto = "há 1 dia";
      else if (diffDias < 30) tempoTexto = `há ${diffDias} dias`;
      else if (diffDias < 60) tempoTexto = "há 1 mês";
      else tempoTexto = `há ${Math.floor(diffDias / 30)} meses`;

      return {
        found: true,
        consulta: {
          ...ultima,
          diasDesdeConsulta: diffDias,
          tempoTexto,
        },
      };
    }),

  /**
   * Histórico completo de consultas para um documento.
   */
  historicoPorDocumento: publicProcedure
    .input(z.object({ documento: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const docLimpo = input.documento.replace(/[.\-\/]/g, "");

      const consultas = await db!
        .select({
          id: serasaConsultas.id,
          operadorName: serasaConsultas.operadorName,
          clienteNome: serasaConsultas.clienteNome,
          aprovado: serasaConsultas.aprovado,
          score: serasaConsultas.score,
          totalPendencias: serasaConsultas.totalPendencias,
          valorTotalPendencias: serasaConsultas.valorTotalPendencias,
          temProtesto: serasaConsultas.temProtesto,
          analiseIA: serasaConsultas.analiseIA,
          createdAt: serasaConsultas.createdAt,
        })
        .from(serasaConsultas)
        .where(eq(serasaConsultas.clienteDocumento, docLimpo))
        .orderBy(desc(serasaConsultas.createdAt))
        .limit(20);

      return consultas;
    }),

  /**
   * Métricas de consultas por operador (para gestores).
   * Retorna quantas consultas cada operador fez no período.
   */
  metricas: publicProcedure
    .input(z.object({
      periodo: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();

      let dateFilter = "";
      const now = new Date();
      if (input.periodo === "7d") {
        const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = d.toISOString().slice(0, 19).replace("T", " ");
      } else if (input.periodo === "30d") {
        const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter = d.toISOString().slice(0, 19).replace("T", " ");
      } else if (input.periodo === "90d") {
        const d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        dateFilter = d.toISOString().slice(0, 19).replace("T", " ");
      }

      const whereClause = dateFilter
        ? sql`WHERE ${serasaConsultas.createdAt} >= ${dateFilter}`
        : sql``;

      // Consultas por operador
      const porOperador = await db!.execute(sql`
        SELECT 
          operador_name as operadorName,
          COUNT(*) as totalConsultas,
          SUM(CASE WHEN aprovado = 1 THEN 1 ELSE 0 END) as consultasAprovadas,
          SUM(CASE WHEN aprovado = 0 THEN 1 ELSE 0 END) as consultasReprovadas
        FROM serasa_consultas
        ${whereClause}
        GROUP BY operador_name
        ORDER BY totalConsultas DESC
      `);

      // Total geral
      const [totais] = await db!.execute(sql`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN aprovado = 1 THEN 1 ELSE 0 END) as aprovadas,
          SUM(CASE WHEN aprovado = 0 THEN 1 ELSE 0 END) as reprovadas
        FROM serasa_consultas
        ${whereClause}
      `);

      // Últimas 10 consultas
      const ultimasConsultas = await db!
        .select({
          id: serasaConsultas.id,
          operadorName: serasaConsultas.operadorName,
          clienteDocumento: serasaConsultas.clienteDocumento,
          clienteNome: serasaConsultas.clienteNome,
          tipoPessoa: serasaConsultas.tipoPessoa,
          aprovado: serasaConsultas.aprovado,
          score: serasaConsultas.score,
          totalPendencias: serasaConsultas.totalPendencias,
          createdAt: serasaConsultas.createdAt,
        })
        .from(serasaConsultas)
        .orderBy(desc(serasaConsultas.createdAt))
        .limit(10);

      return {
        porOperador: ((porOperador as any)[0] as any[]) || [],
        totais: (totais as any) || { total: 0, aprovadas: 0, reprovadas: 0 },
        ultimasConsultas,
      };
    }),

  /**
   * Busca resultado completo de uma consulta específica (para ver detalhes).
   */
  getConsultaDetalhe: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [consulta] = await db!
        .select()
        .from(serasaConsultas)
        .where(eq(serasaConsultas.id, input.id))
        .limit(1);

      if (!consulta) return null;
      return consulta;
    }),

  /**
   * Apaga uma consulta do histórico (apenas para Guilherme - modo teste).
   * Usado durante fase de testes para limpar consultas de teste.
   */
  deleteConsulta: publicProcedure
    .input(z.object({
      consultaId: z.number(),
      operadorPassword: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();

      // Apenas Guilherme pode apagar consultas (modo teste)
      const [operator] = await db!
        .select()
        .from(operators)
        .where(
          and(
            sql`LOWER(${operators.name}) = LOWER('Guilherme')`,
            eq(operators.active, true)
          )
        )
        .limit(1);

      if (!operator || operator.password !== input.operadorPassword) {
        return { success: false, error: "Apenas Guilherme pode apagar consultas (modo teste)." };
      }

      await db!.delete(serasaConsultas).where(eq(serasaConsultas.id, input.consultaId));
      return { success: true };
    }),
});
