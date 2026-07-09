import { Request, Response } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { getDb } from "./db";
import { accountsReceivable, collectionActions, collectionDiaryEntries, collectionDiarySnapshots } from "../drizzle/schema";

/**
 * Handler para backup automático do Diário de Cobrança.
 * Chamado via Heartbeat (cron) todos os dias às 17:15 (Brasília) = 20:15 UTC.
 * 
 * Gera um snapshot completo do estado de todos os clientes inadimplentes,
 * incluindo as entradas do diário feitas no dia.
 */
export async function diarySnapshotCronHandler(req: Request, res: Response) {
  try {
    console.log("[Diary Snapshot] Iniciando backup diário...");
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const today = new Date().toISOString().slice(0, 10);

    // Buscar todos os títulos vencidos (inadimplentes)
    const allReceivables = await db
      .select()
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.estado, "EMITIDO"),
          lte(accountsReceivable.vencimentoData, today)
        )
      );

    // Buscar todas as ações de cobrança
    const allActions = await db.select().from(collectionActions);
    const actionMap = new Map(allActions.map(a => [a.receivableId, a]));

    // Buscar entradas do diário de hoje
    const todayEntries = await db
      .select()
      .from(collectionDiaryEntries)
      .where(
        and(
          gte(collectionDiaryEntries.createdAt, new Date(today + "T00:00:00")),
          lte(collectionDiaryEntries.createdAt, new Date(today + "T23:59:59"))
        )
      );

    // Agrupar por cliente
    const clienteMap = new Map<string, {
      titulos: typeof allReceivables;
      etapa: string;
      entriesDoDia: typeof todayEntries;
    }>();

    for (const rec of allReceivables) {
      const nome = rec.cliente || "Desconhecido";
      if (!clienteMap.has(nome)) {
        clienteMap.set(nome, { titulos: [], etapa: "pendente", entriesDoDia: [] });
      }
      clienteMap.get(nome)!.titulos.push(rec);
      const action = actionMap.get(rec.id);
      if (action) {
        clienteMap.get(nome)!.etapa = action.status;
      }
    }

    // Associar entradas do dia aos clientes
    for (const entry of todayEntries) {
      const clientData = clienteMap.get(entry.clienteName);
      if (clientData) {
        clientData.entriesDoDia.push(entry);
        clientData.etapa = entry.etapaAtual;
      }
    }

    // Montar snapshot
    const snapshotData = Array.from(clienteMap.entries()).map(([nome, data]) => ({
      clienteName: nome,
      etapa: data.etapa,
      titulosCount: data.titulos.length,
      valorDevido: data.titulos.reduce((sum, t) => sum + Number(t.valorOriginal || 0), 0),
      ultimaAcao: data.entriesDoDia.length > 0 ? data.entriesDoDia[0].resumo : undefined,
      entriesDoDia: data.entriesDoDia.map(e => ({
        resumo: e.resumo,
        tipoContato: e.tipoContato || undefined,
        operador: e.operadorName,
        hora: new Date(e.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      })),
    }));

    // Salvar snapshot
    await db.insert(collectionDiarySnapshots).values({
      snapshotDate: today,
      totalClientes: clienteMap.size,
      totalTitulos: allReceivables.length,
      valorTotal: String(allReceivables.reduce((sum, t) => sum + Number(t.valorOriginal || 0), 0)),
      entriesCount: todayEntries.length,
      snapshotData,
    });

    console.log(`[Diary Snapshot] Backup concluído: ${clienteMap.size} clientes, ${allReceivables.length} títulos, ${todayEntries.length} entradas do dia`);
    res.json({ 
      ok: true, 
      date: today, 
      clientes: clienteMap.size, 
      titulos: allReceivables.length, 
      entries: todayEntries.length 
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
