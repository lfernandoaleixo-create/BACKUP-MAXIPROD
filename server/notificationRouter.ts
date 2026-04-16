/**
 * Notification Router - Sistema de notificações do dashboard
 * 
 * Gerencia notificações geradas automaticamente pelo sistema:
 * - Novos pedidos detectados durante sincronização
 * - Pedidos modificados no Maxiprod
 * - Campos obrigatórios não preenchidos
 * - Problemas de senha/operadores
 * - Erros de sincronização
 * - Alertas de estoque
 * 
 * Leitura independente por operador: cada operador tem seu próprio
 * estado de leitura via tabela notification_reads.
 */

import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { systemNotifications, notificationReads } from "../drizzle/schema";
import { desc, eq, sql, and, isNull, isNotNull, lt, inArray } from "drizzle-orm";

// Tipos de notificação relevantes para a produção
const ALLOWED_NOTIFICATION_TYPES = ["novo_pedido", "pedido_modificado", "observacao_alterada", "cobranca_documento", "cobranca_alerta"];

export const notificationRouter = router({
  /**
   * Listar notificações recentes (últimas 200)
   * Retorna não-lidas primeiro (para o operador), depois lidas, ordenadas por data
   * operatorId é passado pelo frontend (do contexto do operador logado)
   */
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).default(200),
      unreadOnly: z.boolean().default(false),
      operatorId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { notifications: [], unreadCount: 0 };

      const limit = input?.limit ?? 200;
      const unreadOnly = input?.unreadOnly ?? false;
      const operatorId = input?.operatorId;

      // Fetch all recent notifications - apenas tipos relevantes para produção
      const notifications = await db
        .select()
        .from(systemNotifications)
        .where(inArray(systemNotifications.type, ALLOWED_NOTIFICATION_TYPES))
        .orderBy(desc(systemNotifications.createdAt))
        .limit(limit);

      if (!operatorId) {
        // Fallback: sem operador, usa readAt global (compatibilidade)
        const filtered = unreadOnly
          ? notifications.filter(n => !n.readAt)
          : notifications;
        const unreadCount = notifications.filter(n => !n.readAt).length;
        return { notifications: filtered, unreadCount };
      }

      // Buscar quais notificações este operador já leu
      const notifIds = notifications.map(n => n.id);
      let readSet = new Set<number>();

      if (notifIds.length > 0) {
        const reads = await db
          .select({ notificationId: notificationReads.notificationId })
          .from(notificationReads)
          .where(
            and(
              eq(notificationReads.operatorId, operatorId),
              inArray(notificationReads.notificationId, notifIds)
            )
          );
        readSet = new Set(reads.map(r => r.notificationId));
      }

      // Enriquecer notificações com readAt por operador
      const enriched = notifications.map(n => ({
        ...n,
        readAt: readSet.has(n.id) ? (n.readAt || new Date()) : null,
      }));

      const filtered = unreadOnly
        ? enriched.filter(n => !n.readAt)
        : enriched;

      const unreadCount = enriched.filter(n => !n.readAt).length;

      return { notifications: filtered, unreadCount };
    }),

  /**
   * Contar notificações não lidas (polling leve) - por operador
   */
  unreadCount: publicProcedure
    .input(z.object({ operatorId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { count: 0 };

      const operatorId = input?.operatorId;

      // Total de notificações - apenas tipos relevantes para produção
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(systemNotifications)
        .where(inArray(systemNotifications.type, ALLOWED_NOTIFICATION_TYPES));
      const total = Number(totalResult[0]?.count ?? 0);

      if (!operatorId) {
        // Fallback global
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(systemNotifications)
          .where(
            and(
              isNull(systemNotifications.readAt),
              inArray(systemNotifications.type, ALLOWED_NOTIFICATION_TYPES)
            )
          );
        return { count: Number(result[0]?.count ?? 0) };
      }

      // Contar quantas notificações relevantes este operador já leu
      const relevantNotifs = await db
        .select({ id: systemNotifications.id })
        .from(systemNotifications)
        .where(inArray(systemNotifications.type, ALLOWED_NOTIFICATION_TYPES));
      const relevantIds = relevantNotifs.map(n => n.id);

      if (relevantIds.length === 0) return { count: 0 };

      const readResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(notificationReads)
        .where(
          and(
            eq(notificationReads.operatorId, operatorId),
            inArray(notificationReads.notificationId, relevantIds)
          )
        );
      const readCount = Number(readResult[0]?.count ?? 0);

      return { count: Math.max(0, relevantIds.length - readCount) };
    }),

  /**
   * Marcar uma notificação como lida - por operador
   */
  markRead: publicProcedure
    .input(z.object({ id: z.number(), operatorId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      if (input.operatorId) {
        // Verificar se já existe registro
        const existing = await db
          .select({ id: notificationReads.id })
          .from(notificationReads)
          .where(
            and(
              eq(notificationReads.notificationId, input.id),
              eq(notificationReads.operatorId, input.operatorId)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(notificationReads).values({
            notificationId: input.id,
            operatorId: input.operatorId,
          });
        }
      } else {
        // Fallback: marcar globalmente (compatibilidade)
        await db
          .update(systemNotifications)
          .set({ readAt: new Date() })
          .where(eq(systemNotifications.id, input.id));
      }

      return { success: true };
    }),

  /**
   * Marcar todas as notificações como lidas - por operador
   */
  markAllRead: publicProcedure
    .input(z.object({ operatorId: z.number().optional() }).optional())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      const operatorId = input?.operatorId;

      if (operatorId) {
        // Buscar todas as notificações que este operador ainda não leu
        const allNotifs = await db
          .select({ id: systemNotifications.id })
          .from(systemNotifications);

        const alreadyRead = await db
          .select({ notificationId: notificationReads.notificationId })
          .from(notificationReads)
          .where(eq(notificationReads.operatorId, operatorId));

        const readSet = new Set(alreadyRead.map(r => r.notificationId));
        const unreadIds = allNotifs.filter(n => !readSet.has(n.id)).map(n => n.id);

        if (unreadIds.length > 0) {
          // Insert em batch
          await db.insert(notificationReads).values(
            unreadIds.map(nId => ({
              notificationId: nId,
              operatorId,
            }))
          );
        }
      } else {
        // Fallback global
        await db
          .update(systemNotifications)
          .set({ readAt: new Date() })
          .where(isNull(systemNotifications.readAt));
      }

      return { success: true };
    }),

  /**
   * Buscar notificações recentes por tipo (ex: novo_pedido, campo_obrigatorio)
   */
  getRecentByType: publicProcedure
    .input(z.object({
      type: z.string(),
      hours: z.number().min(1).max(168).default(24),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { notifications: [] };

      const since = new Date();
      since.setHours(since.getHours() - input.hours);

      const notifications = await db
        .select()
        .from(systemNotifications)
        .where(
          and(
            eq(systemNotifications.type, input.type),
            sql`${systemNotifications.createdAt} >= ${since}`
          )
        )
        .orderBy(desc(systemNotifications.createdAt))
        .limit(100);

      return { notifications };
    }),

  /**
   * Limpar notificações antigas (mais de 30 dias) e seus reads
   */
  cleanup: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { deleted: 0 };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Buscar IDs antigos para limpar reads também
    const oldNotifs = await db
      .select({ id: systemNotifications.id })
      .from(systemNotifications)
      .where(lt(systemNotifications.createdAt, thirtyDaysAgo));

    const oldIds = oldNotifs.map(n => n.id);

    if (oldIds.length > 0) {
      // Limpar reads dos antigos
      await db
        .delete(notificationReads)
        .where(inArray(notificationReads.notificationId, oldIds));
    }

    const result = await db
      .delete(systemNotifications)
      .where(lt(systemNotifications.createdAt, thirtyDaysAgo));

    return { deleted: (result as any)[0]?.affectedRows ?? 0 };
  }),
});

/**
 * Helper: criar uma notificação no banco de dados
 * Usado internamente pelo sistema (sync, aceite, etc.)
 */
export async function createNotification(params: {
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error" | "success";
  metadata?: Record<string, any>;
}) {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(systemNotifications).values({
      type: params.type,
      title: params.title,
      message: params.message,
      severity: params.severity,
      metadata: params.metadata || null,
    });
  } catch (err) {
    console.error("[Notification] Failed to create notification:", err);
  }
}
