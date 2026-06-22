/**
 * Checklist de Desperdício - Backend Router
 * 
 * Manages waste checklist rounds, items, and responses.
 * Auto-generates rounds Mon/Wed/Fri at 07:00 (America/Sao_Paulo).
 * Locks rounds at 17:00 if not completed.
 */
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { checklistRounds, checklistItems, checklistResponses, operators, appSettings } from "../drizzle/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { storagePut } from "./storage";

// Default admin password fallback
const DEFAULT_ADMIN_PASSWORD = "admin123";

// Validate operator password and return operator name
async function validateOperatorPassword(password: string): Promise<{ valid: boolean; operatorName: string | null }> {
  const db = await getDb();
  if (!db) return { valid: false, operatorName: null };
  
  // Check against active operator passwords
  const opRows = await db.select().from(operators)
    .where(and(eq(operators.password, password), eq(operators.active, true)))
    .limit(1);
  if (opRows.length > 0) {
    return { valid: true, operatorName: opRows[0].name };
  }
  
  // Fallback: check admin password
  const adminRows = await db.select().from(appSettings)
    .where(eq(appSettings.settingKey, "admin_password"))
    .limit(1);
  const adminPwd = adminRows.length > 0 ? (adminRows[0].settingValue as string) : DEFAULT_ADMIN_PASSWORD;
  if (password === adminPwd) {
    return { valid: true, operatorName: "Administrador" };
  }
  
  return { valid: false, operatorName: null };
}

// Helper: get today's date in YYYY-MM-DD format (São Paulo timezone)
function getTodayBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Helper: check if a date is Mon/Wed/Fri
function isChecklistDay(dateStr: string): boolean {
  const date = new Date(dateStr + "T12:00:00-03:00");
  const day = date.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  return day === 1 || day === 3 || day === 5;
}

// Helper: check if current time in São Paulo is before 17:00
function isBeforeLockTime(): boolean {
  const now = new Date();
  const spHour = parseInt(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }));
  return spHour < 17;
}

// Helper: check if current time in São Paulo is after 07:00
function isAfterOpenTime(): boolean {
  const now = new Date();
  const spHour = parseInt(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }));
  return spHour >= 7;
}

export const checklistRouter = router({
  /**
   * Get or create today's round (only on Mon/Wed/Fri, after 07:00)
   * Returns the round with all responses
   */
  getRound: publicProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const targetDate = input?.date || getTodayBR();
      
      // Check if round exists
      const existingRounds = await db.select().from(checklistRounds)
        .where(eq(checklistRounds.date, targetDate))
        .limit(1);
      
      if (existingRounds.length > 0) {
        const round = existingRounds[0];
        // Get responses for this round
        const responses = await db.select().from(checklistResponses)
          .where(eq(checklistResponses.roundId, round.id));
        return { round, responses };
      }
      
      // Only auto-create for today if it's a checklist day and after 07:00
      const today = getTodayBR();
      if (targetDate === today && isChecklistDay(targetDate) && isAfterOpenTime()) {
        const result = await db.insert(checklistRounds).values({
          date: targetDate,
          status: "open",
        });
        const newRound = await db.select().from(checklistRounds)
          .where(eq(checklistRounds.id, Number(result[0].insertId)))
          .limit(1);
        return { round: newRound[0], responses: [] };
      }
      
      // No round for this date
      return { round: null, responses: [] };
    }),

  /**
   * Get all active checklist items grouped by sector
   */
  getItems: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const items = await db.select().from(checklistItems)
      .where(eq(checklistItems.isActive, true))
      .orderBy(checklistItems.sector, checklistItems.orderIndex);
    
    // Group by sector
    const sectors: Record<number, { sectorName: string; items: typeof items }> = {};
    for (const item of items) {
      if (!sectors[item.sector]) {
        sectors[item.sector] = { sectorName: item.sectorName, items: [] };
      }
      sectors[item.sector].items.push(item);
    }
    return sectors;
  }),

  /**
   * Submit a response for a checklist item
   * Verde (conforme) or Vermelho (nao_conforme) with optional observation and photo
   */
  submitResponse: publicProcedure
    .input(z.object({
      roundId: z.number(),
      itemId: z.number(),
      status: z.enum(["conforme", "nao_conforme"]),
      observation: z.string().optional(),
      photos: z.array(z.object({
        data: z.string(), // base64
        name: z.string(),
        type: z.string(),
      })).optional(),
      // Legacy single photo support
      photoData: z.string().optional(),
      photoFileName: z.string().optional(),
      photoMimeType: z.string().optional(),
      operatorName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Verify round exists and is open
      const rounds = await db.select().from(checklistRounds)
        .where(eq(checklistRounds.id, input.roundId))
        .limit(1);
      
      if (!rounds.length) {
        throw new Error("Ronda não encontrada");
      }
      if (rounds[0].status !== "open") {
        throw new Error("Esta ronda já foi concluída ou travada. Não é possível alterar.");
      }
      
      // Check if it's still before lock time
      const roundDate = rounds[0].date;
      const today = getTodayBR();
      if (roundDate === today && !isBeforeLockTime()) {
        throw new Error("Horário de preenchimento encerrado (após 17:00).");
      }
      
      // Upload photos (multiple)
      const uploadedUrls: string[] = [];
      if (input.photos && input.photos.length > 0) {
        for (const photo of input.photos) {
          const buffer = Buffer.from(photo.data, "base64");
          const randomSuffix = Math.random().toString(36).substring(2, 10);
          const key = `checklist-photos/${roundDate}/${input.itemId}-${randomSuffix}-${photo.name}`;
          const result = await storagePut(key, buffer, photo.type || "image/jpeg");
          uploadedUrls.push(result.url);
        }
      }
      // Legacy single photo fallback
      let photoUrl: string | null = null;
      if (!input.photos?.length && input.photoData && input.photoFileName) {
        const buffer = Buffer.from(input.photoData, "base64");
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const key = `checklist-photos/${roundDate}/${input.itemId}-${randomSuffix}-${input.photoFileName}`;
        const result = await storagePut(key, buffer, input.photoMimeType || "image/jpeg");
        photoUrl = result.url;
        uploadedUrls.push(result.url);
      }
      
      // Check if response already exists for this round+item
      const existing = await db.select().from(checklistResponses)
        .where(and(
          eq(checklistResponses.roundId, input.roundId),
          eq(checklistResponses.itemId, input.itemId)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        // Merge new photos with existing ones
        const existingPhotos: string[] = (existing[0].photoUrls as string[] || []);
        // Also include legacy photoUrl if present
        if (existing[0].photoUrl && !existingPhotos.includes(existing[0].photoUrl)) {
          existingPhotos.unshift(existing[0].photoUrl);
        }
        const allPhotos = [...existingPhotos, ...uploadedUrls];
        
        await db.update(checklistResponses)
          .set({
            status: input.status,
            observation: input.observation || null,
            photoUrl: allPhotos[0] || existing[0].photoUrl,
            photoUrls: allPhotos.length > 0 ? allPhotos : null,
            respondedBy: input.operatorName,
            respondedAt: new Date(),
          })
          .where(eq(checklistResponses.id, existing[0].id));
        return { success: true, updated: true };
      }
      
      // Insert new response
      await db.insert(checklistResponses).values({
        roundId: input.roundId,
        itemId: input.itemId,
        status: input.status,
        observation: input.observation || null,
        photoUrl: uploadedUrls[0] || photoUrl,
        photoUrls: uploadedUrls.length > 0 ? uploadedUrls : null,
        respondedBy: input.operatorName,
      });
      
      return { success: true, updated: false };
    }),

  /**
   * Clear a response (toggle back to neutral)
   */
  clearResponse: publicProcedure
    .input(z.object({
      roundId: z.number(),
      itemId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Verify round exists and is open
      const rounds = await db.select().from(checklistRounds)
        .where(eq(checklistRounds.id, input.roundId))
        .limit(1);
      
      if (!rounds.length) {
        throw new Error("Ronda não encontrada");
      }
      if (rounds[0].status !== "open") {
        throw new Error("Esta ronda já foi concluída ou travada. Não é possível alterar.");
      }
      
      // Delete the response
      await db.delete(checklistResponses)
        .where(and(
          eq(checklistResponses.roundId, input.roundId),
          eq(checklistResponses.itemId, input.itemId)
        ));
      
      return { success: true };
    }),

  /**
   * Complete a round - validates operator password, then marks round as completed
   */
  completeRound: publicProcedure
    .input(z.object({
      roundId: z.number(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Validate password and get operator name
      const { valid, operatorName } = await validateOperatorPassword(input.password);
      if (!valid || !operatorName) {
        throw new Error("Senha incorreta. Verifique e tente novamente.");
      }
      
      // Verify round exists and is open
      const rounds = await db.select().from(checklistRounds)
        .where(eq(checklistRounds.id, input.roundId))
        .limit(1);
      
      if (!rounds.length) {
        throw new Error("Ronda não encontrada");
      }
      if (rounds[0].status !== "open") {
        throw new Error("Esta ronda já foi concluída ou travada.");
      }
      
      // Count active items
      const activeItems = await db.select({ count: sql<number>`count(*)` })
        .from(checklistItems)
        .where(eq(checklistItems.isActive, true));
      const totalItems = activeItems[0].count;
      
      // Count responses for this round
      const responseCount = await db.select({ count: sql<number>`count(*)` })
        .from(checklistResponses)
        .where(eq(checklistResponses.roundId, input.roundId));
      const totalResponses = responseCount[0].count;
      
      if (totalResponses < totalItems) {
        throw new Error(`Faltam ${totalItems - totalResponses} itens para responder. Todos os itens devem ser preenchidos antes de concluir.`);
      }
      
      // Mark as completed with the validated operator name
      await db.update(checklistRounds)
        .set({
          status: "completed",
          completedBy: operatorName,
          completedAt: new Date(),
        })
        .where(eq(checklistRounds.id, input.roundId));
      
      return { success: true, operatorName };
    }),

  /**
   * Get completion history - who completed each round (clock icon history)
   */
  getCompletionHistory: publicProcedure
    .input(z.object({ limit: z.number().default(30) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const limit = input?.limit || 30;
      
      const completedRounds = await db.select({
        id: checklistRounds.id,
        date: checklistRounds.date,
        completedBy: checklistRounds.completedBy,
        completedAt: checklistRounds.completedAt,
        status: checklistRounds.status,
      }).from(checklistRounds)
        .where(eq(checklistRounds.status, "completed"))
        .orderBy(desc(checklistRounds.date))
        .limit(limit);
      
      return completedRounds;
    }),

  /**
   * Get history of rounds with responses (paginated)
   */
  getHistory: publicProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { history: [], total: 0, page: 1, pageSize: 20 };
      const page = input?.page || 1;
      const pageSize = input?.pageSize || 20;
      const offset = (page - 1) * pageSize;
      
      // Get total count
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(checklistRounds);
      const total = countResult[0].count;
      
      // Get rounds with pagination
      const rounds = await db.select().from(checklistRounds)
        .orderBy(desc(checklistRounds.date))
        .limit(pageSize)
        .offset(offset);
      
      // Get responses for these rounds
      const roundIds = rounds.map(r => r.id);
      let responses: any[] = [];
      if (roundIds.length > 0) {
        responses = await db.select().from(checklistResponses)
          .where(sql`${checklistResponses.roundId} IN (${sql.raw(roundIds.join(","))})`);
      }
      
      // Get items for context
      const items = await db.select().from(checklistItems);
      
      // Build history entries
      const history = rounds.map(round => {
        const roundResponses = responses.filter(r => r.roundId === round.id);
        const sectors = new Map<number, { sectorName: string; responses: any[]; leader: string | null }>();
        
        for (const resp of roundResponses) {
          const item = items.find(i => i.id === resp.itemId);
          if (!item) continue;
          if (!sectors.has(item.sector)) {
            sectors.set(item.sector, { sectorName: item.sectorName, responses: [], leader: null });
          }
          const sectorData = sectors.get(item.sector)!;
          sectorData.responses.push({ ...resp, itemText: item.text });
          if (!sectorData.leader) sectorData.leader = resp.respondedBy;
        }
        
        return {
          ...round,
          sectors: Array.from(sectors.entries()).map(([sectorNum, data]) => ({
            sector: sectorNum,
            ...data,
          })),
          totalResponses: roundResponses.length,
          nonConformeCount: roundResponses.filter(r => r.status === "nao_conforme").length,
        };
      });
      
      return { history, total, page, pageSize };
    }),

  /**
   * Get analytics: items that fail most in a given month
   */
  getAnalytics: publicProcedure
    .input(z.object({
      yearMonth: z.string(), // YYYY-MM
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], totalRounds: 0, completedRounds: 0, notDoneRounds: 0 };
      const startDate = `${input.yearMonth}-01`;
      const endDate = `${input.yearMonth}-31`;
      
      // Get all rounds in the month
      const monthRounds = await db.select().from(checklistRounds)
        .where(and(
          gte(checklistRounds.date, startDate),
          lte(checklistRounds.date, endDate)
        ));
      
      if (monthRounds.length === 0) {
        return { items: [], totalRounds: 0, completedRounds: 0, notDoneRounds: 0 };
      }
      
      const roundIds = monthRounds.map(r => r.id);
      
      // Get all non-conforme responses in the month
      const nonConformeResponses = await db.select().from(checklistResponses)
        .where(and(
          sql`${checklistResponses.roundId} IN (${sql.raw(roundIds.join(","))})`,
          eq(checklistResponses.status, "nao_conforme")
        ));
      
      // Count failures per item
      const failCounts: Record<number, number> = {};
      for (const resp of nonConformeResponses) {
        failCounts[resp.itemId] = (failCounts[resp.itemId] || 0) + 1;
      }
      
      // Get items info
      const items = await db.select().from(checklistItems);
      
      // Build ranked list
      const rankedItems = Object.entries(failCounts)
        .map(([itemId, count]) => {
          const item = items.find(i => i.id === Number(itemId));
          return {
            itemId: Number(itemId),
            text: item?.text || "Item removido",
            sector: item?.sector || 0,
            sectorName: item?.sectorName || "",
            failCount: count,
            failRate: Math.round((count / monthRounds.length) * 100),
          };
        })
        .sort((a, b) => b.failCount - a.failCount);
      
      return {
        items: rankedItems,
        totalRounds: monthRounds.length,
        completedRounds: monthRounds.filter(r => r.status === "completed").length,
        notDoneRounds: monthRounds.filter(r => r.status === "not_done").length,
      };
    }),

  /**
   * Lock expired rounds (called by scheduler at 17:00)
   * Marks open rounds for today as "not_done"
   */
  lockExpiredRounds: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const today = getTodayBR();
    
    const result = await db.update(checklistRounds)
      .set({
        status: "not_done",
        lockedAt: new Date(),
      })
      .where(and(
        eq(checklistRounds.date, today),
        eq(checklistRounds.status, "open")
      ));
    
    return { locked: true };
  }),

  /**
   * Generate round for today (called by scheduler at 07:00 on Mon/Wed/Fri)
   */
  generateRound: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const today = getTodayBR();
    
    if (!isChecklistDay(today)) {
      return { created: false, reason: "Hoje não é dia de checklist (Seg/Qua/Sex)" };
    }
    
    // Check if already exists
    const existing = await db.select().from(checklistRounds)
      .where(eq(checklistRounds.date, today))
      .limit(1);
    
    if (existing.length > 0) {
      return { created: false, reason: "Ronda já existe para hoje" };
    }
    
    await db.insert(checklistRounds).values({
      date: today,
      status: "open",
    });
    
    return { created: true };
  }),

  /**
   * Add a new checklist item (admin)
   */
  addItem: publicProcedure
    .input(z.object({
      sector: z.number().min(1).max(3),
      sectorName: z.string(),
      text: z.string().min(5),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Get max orderIndex for this sector
      const maxOrder = await db.select({ max: sql<number>`COALESCE(MAX(order_index), 0)` })
        .from(checklistItems)
        .where(eq(checklistItems.sector, input.sector));
      
      const nextOrder = maxOrder[0].max + 1;
      
      await db.insert(checklistItems).values({
        sector: input.sector,
        sectorName: input.sectorName,
        orderIndex: nextOrder,
        text: input.text,
      });
      
      return { success: true };
    }),

  /**
   * Deactivate a checklist item (preserves history)
   */
  deactivateItem: publicProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(checklistItems)
        .set({ isActive: false })
        .where(eq(checklistItems.id, input.itemId));
      return { success: true };
    }),
});
