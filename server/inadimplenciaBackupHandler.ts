import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { collectionActions, collectionDailyActions, receivableProtestConfig, resolvedReceivables, inadimplenciaBackup, CollectionAction, CollectionDailyAction, ReceivableProtestConfig, ResolvedReceivable } from "../drizzle/schema";

/**
 * Handler para backup automático dos dados de inadimplência.
 * Chamado via Heartbeat (cron) a cada 6 horas.
 * 
 * REGRA CRÍTICA: Este endpoint NUNCA deve ser removido ou alterado em rollbacks.
 * Os dados de inadimplência (status, observações, histórico de contatos) são
 * inseridos manualmente pelo time e NUNCA devem ser perdidos.
 * 
 * O backup salva um snapshot completo de:
 * - collectionActions (status de cobrança, observações, promessas)
 * - collectionDailyActions (ações diárias dos vendedores)
 * - receivableProtestConfig (configuração de protesto)
 * - resolvedReceivables (títulos resolvidos)
 */
export async function inadimplenciaBackupCronHandler(req: Request, res: Response) {
  try {
    console.log("[Inadimplência Backup] Iniciando snapshot...");

    // Buscar todos os dados atuais
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [actions, dailyActions, protestConfigs, resolved] = await Promise.all([
      db.select().from(collectionActions),
      db.select().from(collectionDailyActions),
      db.select().from(receivableProtestConfig),
      db.select().from(resolvedReceivables),
    ]);

    // Serializar para JSON (converter Dates para strings)
    const actionsJson = actions.map((a: CollectionAction) => ({
      id: a.id,
      receivableId: a.receivableId,
      status: a.status,
      promessaData: a.promessaData,
      promessaValor: a.promessaValor,
      lembreteData: a.lembreteData,
      observacoes: a.observacoes,
      contatoHistorico: a.contatoHistorico || [],
      cobrancaStartedAt: a.cobrancaStartedAt,
      phoneMutedBy: a.phoneMutedBy,
      phoneMutedAt: a.phoneMutedAt,
      updatedBy: a.updatedBy,
      createdAt: a.createdAt?.toISOString() || "",
      updatedAt: a.updatedAt?.toISOString() || "",
    }));

    const dailyActionsJson = dailyActions.map((d: CollectionDailyAction) => ({
      id: d.id,
      receivableId: d.receivableId,
      actionDate: d.actionDate,
      actionType: d.actionType,
      operatorName: d.operatorName,
      notes: d.notes,
      isAutomatic: d.isAutomatic,
      createdAt: d.createdAt?.toISOString() || "",
    }));

    const protestConfigJson = protestConfigs.map((p: ReceivableProtestConfig) => ({
      id: p.id,
      receivableId: p.receivableId,
      protestType: p.protestType,
      actionPlan: p.actionPlan,
      deadlineDate: p.deadlineDate,
      actionPlanBy: p.actionPlanBy,
      updatedBy: p.updatedBy,
    }));

    const resolvedJson = resolved.map((r: ResolvedReceivable) => ({
      id: r.id,
      receivableId: r.receivableId,
      maxiprodId: r.maxiprodId,
      cliente: r.cliente,
      valorOriginal: r.valorOriginal,
      valorAReceber: r.valorAReceber,
      vencimentoData: r.vencimentoData,
      documento: r.documento,
      empresa: r.empresa,
      vendedor: r.vendedor,
      diasAtrasoNaResolucao: r.diasAtrasoNaResolucao,
      statusCobranca: r.statusCobranca,
      totalContatos: r.totalContatos,
    }));

    // Inserir snapshot
    await db.insert(inadimplenciaBackup as any).values({
      collectionActionsJson: actionsJson,
      dailyActionsJson: dailyActionsJson,
      protestConfigJson: protestConfigJson,
      resolvedJson: resolvedJson,
      totalCollectionActions: actions.length,
      totalDailyActions: dailyActions.length,
      totalProtestConfigs: protestConfigs.length,
      totalResolved: resolved.length,
    });

    // Manter apenas os últimos 30 backups (7.5 dias de dados a cada 6h)
    const allBackups = await db.select({ id: inadimplenciaBackup.id })
      .from(inadimplenciaBackup as any)
      .orderBy(inadimplenciaBackup.id);
    
    if (allBackups.length > 30) {
      const toDelete = allBackups.slice(0, allBackups.length - 30);
      for (const backup of toDelete) {
        await db.delete(inadimplenciaBackup as any).where(
          eq(inadimplenciaBackup.id, backup.id)
        );
      }
    }

    console.log(`[Inadimplência Backup] Snapshot salvo com sucesso: ${actions.length} actions, ${dailyActions.length} daily, ${protestConfigs.length} protest, ${resolved.length} resolved`);

    res.json({
      ok: true,
      snapshot: {
        collectionActions: actions.length,
        dailyActions: dailyActions.length,
        protestConfigs: protestConfigs.length,
        resolved: resolved.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[Inadimplência Backup] Erro:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      context: { url: req.url, taskUid: req.headers["x-manus-cron-task-uid"] },
      timestamp: new Date().toISOString(),
    });
  }
}
