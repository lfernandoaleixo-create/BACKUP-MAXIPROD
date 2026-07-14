import { Request, Response } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { getDb } from "./db";
import { 
  accountsReceivable, 
  collectionActions, 
  collectionDiaryEntries, 
  collectionDiarySnapshots,
  cobrancaPlanilha,
  cobrancaEtapaObs
} from "../drizzle/schema";

/**
 * Handler para backup automático do Diário de Cobrança.
 * Chamado via Heartbeat (cron) todos os dias às 17:15 (Brasília) = 20:15 UTC.
 * 
 * Gera um snapshot COMPLETO e IMUTÁVEL do estado de todos os clientes inadimplentes,
 * incluindo:
 * - Status atual de cada título (da planilha de cobrança)
 * - Etapas de cobrança (1ª, 2ª, 3ª Cob, Ação Final) com datas
 * - Observações de cada etapa
 * - Histórico completo de cobrança (collection_actions + diary entries)
 * - Dados do título (valor, vencimento, tipo, forma, vendedor)
 * 
 * REGRA FUNDAMENTAL: Este snapshot NUNCA é alterado ou deletado por nenhuma sincronização.
 * Ele apenas ADICIONA novos registros diariamente. É um registro histórico imutável.
 */
export async function diarySnapshotCronHandler(req: Request, res: Response) {
  try {
    console.log("[Diary Snapshot] Iniciando backup diário completo...");
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const today = new Date().toISOString().slice(0, 10);

    // 1. Buscar TODOS os títulos ativos da planilha de cobrança (fonte principal)
    const allPlanilha = await db
      .select()
      .from(cobrancaPlanilha)
      .where(eq(cobrancaPlanilha.ativo, true));

    // 2. Buscar TODAS as observações de etapas
    const allEtapaObs = await db.select().from(cobrancaEtapaObs);
    const etapaObsMap = new Map<number, typeof allEtapaObs>();
    for (const obs of allEtapaObs) {
      if (!etapaObsMap.has(obs.planilhaId)) {
        etapaObsMap.set(obs.planilhaId, []);
      }
      etapaObsMap.get(obs.planilhaId)!.push(obs);
    }

    // 3. Buscar TODAS as ações de cobrança (collection_actions)
    const allActions = await db.select().from(collectionActions);
    const actionMap = new Map(allActions.map(a => [a.receivableId, a]));

    // 4. Buscar TODAS as entradas do diário (histórico completo, não apenas hoje)
    const allDiaryEntries = await db
      .select()
      .from(collectionDiaryEntries)
      .orderBy(desc(collectionDiaryEntries.createdAt));

    // Agrupar diary entries por cliente
    const diaryByCliente = new Map<string, typeof allDiaryEntries>();
    for (const entry of allDiaryEntries) {
      if (!diaryByCliente.has(entry.clienteName)) {
        diaryByCliente.set(entry.clienteName, []);
      }
      diaryByCliente.get(entry.clienteName)!.push(entry);
    }

    // 5. Buscar entradas do diário feitas HOJE especificamente
    const todayEntries = allDiaryEntries.filter(e => {
      const entryDate = new Date(e.createdAt).toISOString().slice(0, 10);
      return entryDate === today;
    });

    // 6. Montar snapshot COMPLETO por título da planilha
    const snapshotData = allPlanilha.map(titulo => {
      const etapaObs = etapaObsMap.get(titulo.id) || [];
      const action = titulo.arId ? actionMap.get(titulo.arId) : null;
      const clienteDiary = diaryByCliente.get(titulo.empresa) || [];
      const todayClienteDiary = clienteDiary.filter(e => {
        const entryDate = new Date(e.createdAt).toISOString().slice(0, 10);
        return entryDate === today;
      });

      return {
        // Identificação
        planilhaId: titulo.id,
        arId: titulo.arId,
        clienteName: titulo.empresa,
        apelido: titulo.apelido || undefined,
        cnpjCpf: titulo.cnpjCpf || undefined,

        // Dados do título
        valor: Number(titulo.valor || 0),
        vencimento: titulo.vencimento || undefined,
        diasVencidos: titulo.diasVencidos || 0,
        tipo: titulo.tipo || undefined, // Com protesto / Sem protesto
        centroCustos: titulo.centroCustos || undefined,
        documento: titulo.documento || undefined,
        formaCobranca: titulo.formaCobranca || undefined,
        vendedor: titulo.vendedor || undefined,

        // STATUS atual (campo mais importante - nunca pode ser perdido)
        status: titulo.status,

        // Etapas de cobrança com datas
        etapasCobranca: {
          primeiraCobranca: titulo.primeiraCobranca || null,
          semAcao1: titulo.semAcao1 || null,
          segundaCobranca: titulo.segundaCobranca || null,
          semAcao2: titulo.semAcao2 || null,
          terceiraCobranca: titulo.terceiraCobranca || null,
          semAcao3: titulo.semAcao3 || null,
          acaoFinal: titulo.acaoFinal || null,
          promessaPgto: titulo.promessaPgto || null,
        },

        // Etapas pausadas
        etapasPausadas: titulo.etapasPausadas || {},

        // Observações de cada etapa (registros detalhados)
        etapaObservacoes: etapaObs.map(obs => ({
          etapa: obs.etapa,
          observacao: obs.observacao,
          registradoPor: obs.registradoPor,
          data: new Date(obs.createdAt).toISOString(),
        })),

        // Collection Action (status da inadimplência)
        collectionAction: action ? {
          status: action.status,
          observacoes: action.observacoes || undefined,
          promessaData: action.promessaData || undefined,
          promessaValor: action.promessaValor ? Number(action.promessaValor) : undefined,
          contatoHistorico: action.contatoHistorico || [],
          cobrancaStartedAt: action.cobrancaStartedAt || undefined,
        } : null,

        // Histórico completo do diário para este cliente (TODAS as entradas, não só hoje)
        historicoCobranca: clienteDiary.map(e => ({
          etapaAtual: e.etapaAtual,
          tipoContato: e.tipoContato || undefined,
          resumo: e.resumo,
          observacoes: e.observacoes || undefined,
          valorNegociado: e.valorNegociado ? Number(e.valorNegociado) : undefined,
          proximaAcao: e.proximaAcao || undefined,
          proximaAcaoData: e.proximaAcaoData || undefined,
          operador: e.operadorName,
          data: new Date(e.createdAt).toISOString(),
        })),

        // Entradas do dia (para referência rápida)
        entriesDoDia: todayClienteDiary.map(e => ({
          resumo: e.resumo,
          tipoContato: e.tipoContato || undefined,
          operador: e.operadorName,
          hora: new Date(e.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        })),

        // Observações gerais do título
        observacoes: titulo.observacoes || undefined,
      };
    });

    // 7. Salvar snapshot (IMUTÁVEL - nunca será alterado depois de inserido)
    await db.insert(collectionDiarySnapshots).values({
      snapshotDate: today,
      totalClientes: new Set(allPlanilha.map(t => t.empresa)).size,
      totalTitulos: allPlanilha.length,
      valorTotal: String(allPlanilha.reduce((sum, t) => sum + Number(t.valor || 0), 0)),
      entriesCount: todayEntries.length,
      snapshotData: snapshotData as any,
    });

    const totalClientes = new Set(allPlanilha.map(t => t.empresa)).size;
    console.log(`[Diary Snapshot] Backup COMPLETO concluído: ${totalClientes} clientes, ${allPlanilha.length} títulos, ${todayEntries.length} entradas do dia, ${allEtapaObs.length} obs de etapas, ${allActions.length} collection_actions`);
    
    res.json({ 
      ok: true, 
      date: today, 
      clientes: totalClientes, 
      titulos: allPlanilha.length, 
      entries: todayEntries.length,
      etapaObs: allEtapaObs.length,
      collectionActions: allActions.length,
      historicoTotal: allDiaryEntries.length,
    });
  } catch (error: any) {
    console.error("[Diary Snapshot] Erro:", error);
    res.status(500).json({ 
      error: error.message, 
      stack: error.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString()
    });
  }
}
