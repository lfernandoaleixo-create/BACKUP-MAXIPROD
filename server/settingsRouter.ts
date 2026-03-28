import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { appSettings, salesTargets, productSegmentOverrides, salesOrders, dashboardData, productVisibility, productClassification, productPricing } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// Default admin password (can be changed via settings)
const DEFAULT_ADMIN_PASSWORD = "240288";

/**
 * Get a setting value from the database
 */
async function getSetting(key: string): Promise<any> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
  return rows.length > 0 ? rows[0].settingValue : null;
}

/**
 * Set a setting value in the database (upsert)
 */
async function setSetting(key: string, value: any): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
  if (existing.length > 0) {
    await db.update(appSettings).set({ settingValue: value }).where(eq(appSettings.settingKey, key));
  } else {
    await db.insert(appSettings).values({ settingKey: key, settingValue: value });
  }
}

export const settingsRouter = router({
  /**
   * Verify admin password
   */
  verifyPassword: publicProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input }) => {
      const storedPassword = await getSetting("admin_password");
      const currentPassword = storedPassword || DEFAULT_ADMIN_PASSWORD;
      const isValid = input.password === currentPassword;
      return { success: isValid };
    }),

  /**
   * Change admin password (requires current password)
   */
  changePassword: publicProcedure
    .input(z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(4, "Senha deve ter no minimo 4 caracteres"),
    }))
    .mutation(async ({ input }) => {
      const storedPassword = await getSetting("admin_password");
      const currentPassword = storedPassword || DEFAULT_ADMIN_PASSWORD;
      
      if (input.currentPassword !== currentPassword) {
        return { success: false, error: "Senha atual incorreta" };
      }
      
      await setSetting("admin_password", input.newPassword);
      return { success: true };
    }),

  /**
   * Get all sales targets
   */
  getSalesTargets: publicProcedure
    .input(z.object({
      yearMonth: z.string().optional(), // filter by specific month
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      if (input?.yearMonth) {
        return db.select().from(salesTargets).where(eq(salesTargets.yearMonth, input.yearMonth));
      }
      return db.select().from(salesTargets);
    }),

  /**
   * Set a sales target for a specific month and segment
   */
  setSalesTarget: publicProcedure
    .input(z.object({
      password: z.string(),
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "Formato: YYYY-MM"),
      segment: z.enum(["all", "industrializacao", "importacao"]),
      targetValue: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      // Verify password first
      const storedPassword = await getSetting("admin_password");
      const currentPassword = storedPassword || DEFAULT_ADMIN_PASSWORD;
      if (input.password !== currentPassword) {
        return { success: false, error: "Senha incorreta" };
      }

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      // Upsert: check if target exists for this month+segment
      const existing = await db.select().from(salesTargets)
        .where(and(
          eq(salesTargets.yearMonth, input.yearMonth),
          eq(salesTargets.segment, input.segment)
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.update(salesTargets)
          .set({ targetValue: String(input.targetValue) })
          .where(eq(salesTargets.id, existing[0].id));
      } else {
        await db.insert(salesTargets).values({
          yearMonth: input.yearMonth,
          segment: input.segment,
          targetValue: String(input.targetValue),
        });
      }

      return { success: true };
    }),

  /**
   * Delete a sales target
   */
  deleteSalesTarget: publicProcedure
    .input(z.object({
      password: z.string(),
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      const storedPassword = await getSetting("admin_password");
      const currentPassword = storedPassword || DEFAULT_ADMIN_PASSWORD;
      if (input.password !== currentPassword) {
        return { success: false, error: "Senha incorreta" };
      }

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      await db.delete(salesTargets).where(eq(salesTargets.id, input.id));
      return { success: true };
    }),

  /**
   * Get alert settings
   */
  getAlertSettings: publicProcedure.query(async () => {
    const alerts = await getSetting("alert_settings");
    return alerts || {
      stockMinEnabled: false,
      stockMinThreshold: 10, // caixas
      salesDailyEnabled: false,
      salesDailyThreshold: 20000, // R$
    };
  }),

  /**
   * Update alert settings
   */
  setAlertSettings: publicProcedure
    .input(z.object({
      password: z.string(),
      stockMinEnabled: z.boolean(),
      stockMinThreshold: z.number().min(0),
      salesDailyEnabled: z.boolean(),
      salesDailyThreshold: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      const storedPassword = await getSetting("admin_password");
      const currentPassword = storedPassword || DEFAULT_ADMIN_PASSWORD;
      if (input.password !== currentPassword) {
        return { success: false, error: "Senha incorreta" };
      }

      const { password, ...alertSettings } = input;
      await setSetting("alert_settings", alertSettings);
      return { success: true };
    }),

  /**
   * Get stock products from dashboard_data with their current segment classification
   * ESPELHO FIEL: shows products exactly as they come from Maxiprod
   */
  getProductSegments: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    // Get stock products from dashboard_data (the processed view)
    const dashRows = await db.select().from(dashboardData).limit(1);
    if (dashRows.length === 0) return [];

    const rawData = dashRows[0].dataJson as any;
    const items: any[] = typeof rawData === 'string' ? JSON.parse(rawData) : (Array.isArray(rawData) ? rawData : Object.values(rawData));

    // Get all overrides
    const overrides = await db.select().from(productSegmentOverrides);

    // Get all visibility settings
    const visibilityRows = await db.select().from(productVisibility);

    // Build product list - espelho fiel do Maxiprod
    return items.map((item: any) => {
      const codigoItem = item.codigoItem || "";
      const descricaoItem = item.descricaoItem || "";
      
      // Determine default segment
      const defaultSegment = item.segmento === "bambu" ? "importacao" : "industrializacao";

      // Look up override: match by descricao (product description) or codigoItem
      const override = overrides.find(o => o.descricao === descricaoItem || o.descricao === codigoItem || o.codigoGrupo === codigoItem);
      
      // Look up visibility by codigoItem
      const visibility = visibilityRows.find(v => v.codigoItem === codigoItem);

      return {
        descricao: descricaoItem, // Descrição EXATA do Maxiprod
        codigoItem,
        codigos: codigoItem ? [codigoItem] : [],
        palavraChave: "", // Não usamos mais palavraChave
        descricaoOriginal: descricaoItem,
        codigoGrupo: item.grupoCodigo || "",
        defaultSegment,
        currentSegment: override ? override.segment : defaultSegment,
        hasOverride: !!override,
        overrideId: override?.id || null,
        tipo: item.segmento || "",
        estoqueCx: item.estoqueCx ?? 0,
        disponivelCx: item.disponivelCx ?? 0,
        visible: visibility ? visibility.visible : true,
      };
    });
  }),

  /**
   * Set or update a product segment override
   */
  setProductSegment: publicProcedure
    .input(z.object({
      password: z.string(),
      descricao: z.string(),
      codigoGrupo: z.string().optional(),
      segment: z.enum(["industrializacao", "importacao"]),
    }))
    .mutation(async ({ input }) => {
      const storedPassword = await getSetting("admin_password");
      const currentPassword = storedPassword || DEFAULT_ADMIN_PASSWORD;
      if (input.password !== currentPassword) {
        return { success: false, error: "Senha incorreta" };
      }

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      // Check if override already exists for this product
      const existing = await db.select().from(productSegmentOverrides)
        .where(eq(productSegmentOverrides.descricao, input.descricao))
        .limit(1);

      if (existing.length > 0) {
        await db.update(productSegmentOverrides)
          .set({ segment: input.segment })
          .where(eq(productSegmentOverrides.id, existing[0].id));
      } else {
        await db.insert(productSegmentOverrides).values({
          descricao: input.descricao,
          codigoGrupo: input.codigoGrupo || null,
          segment: input.segment,
        });
      }

      return { success: true };
    }),

  /**
   * Remove a product segment override (revert to default)
   */
  removeProductSegment: publicProcedure
    .input(z.object({
      password: z.string(),
      descricao: z.string(),
    }))
    .mutation(async ({ input }) => {
      const storedPassword = await getSetting("admin_password");
      const currentPassword = storedPassword || DEFAULT_ADMIN_PASSWORD;
      if (input.password !== currentPassword) {
        return { success: false, error: "Senha incorreta" };
      }

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      await db.delete(productSegmentOverrides)
        .where(eq(productSegmentOverrides.descricao, input.descricao));

      return { success: true };
    }),

  /**
   * Get all product segment overrides (used by sales analytics)
   */
  getProductSegmentOverrides: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(productSegmentOverrides);
  }),

  /**
   * Toggle product visibility in the dashboard
   */
  toggleProductVisibility: publicProcedure
    .input(z.object({
      password: z.string(),
      descricao: z.string(),
      codigoItem: z.string().optional(),
      visible: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const storedPassword = await getSetting("admin_password");
      const currentPassword = storedPassword || DEFAULT_ADMIN_PASSWORD;
      if (input.password !== currentPassword) {
        return { success: false, error: "Senha incorreta" };
      }

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      // Use codigoItem as primary lookup if available, fallback to descricao
      let existing;
      if (input.codigoItem) {
        existing = await db.select().from(productVisibility)
          .where(eq(productVisibility.codigoItem, input.codigoItem))
          .limit(1);
      }
      if (!existing || existing.length === 0) {
        existing = await db.select().from(productVisibility)
          .where(eq(productVisibility.descricao, input.descricao))
          .limit(1);
      }

      if (existing && existing.length > 0) {
        await db.update(productVisibility)
          .set({ visible: input.visible, codigoItem: input.codigoItem || existing[0].codigoItem })
          .where(eq(productVisibility.id, existing[0].id));
      } else {
        await db.insert(productVisibility).values({
          descricao: input.descricao,
          codigoItem: input.codigoItem || null,
          visible: input.visible,
        });
      }

      return { success: true };
    }),

  /**
   * Get hidden product descriptions (used by dashboard to filter)
   */
  getHiddenProducts: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(productVisibility).where(eq(productVisibility.visible, false));
    return rows.map(r => ({ descricao: r.descricao, codigoItem: r.codigoItem }));
  }),

  /**
   * Get general settings (sync info, etc.)
   */
  getGeneralSettings: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { dataInfo: null };

    // Get data counts
    const { stockItems: si, orderItems: oi, salesOrders: so, purchaseOrderItems: poi } = await import("../drizzle/schema");
    const [stockCount] = await db.select({ count: eq(si.id, si.id) }).from(si);
    const [orderCount] = await db.select({ count: eq(oi.id, oi.id) }).from(oi);
    const [salesCount] = await db.select({ count: eq(so.id, so.id) }).from(so);
    const [poCount] = await db.select({ count: eq(poi.id, poi.id) }).from(poi);

    return {
      dataInfo: {
        stockItems: stockCount ? 1 : 0, // simplified
        orderItems: orderCount ? 1 : 0,
        salesOrders: salesCount ? 1 : 0,
        purchaseOrders: poCount ? 1 : 0,
      },
    };
  }),

  // ─── Product Classification ──────────────────────────────────

  /**
   * Get all product classifications
   */
  getProductClassifications: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(productClassification);
    return rows;
  }),

  /**
   * Set classification for a product (upsert)
   */
  setProductClassification: publicProcedure
    .input(z.object({
      codigoItem: z.string(),
      descricao: z.string().optional(),
      classification: z.enum(["estoque", "encomenda", "outros"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const existing = await db.select().from(productClassification)
        .where(eq(productClassification.codigoItem, input.codigoItem)).limit(1);
      if (existing.length > 0) {
        await db.update(productClassification)
          .set({ classification: input.classification, descricao: input.descricao })
          .where(eq(productClassification.codigoItem, input.codigoItem));
      } else {
        await db.insert(productClassification).values({
          codigoItem: input.codigoItem,
          descricao: input.descricao,
          classification: input.classification,
        });
      }
      return { success: true };
    }),

  /**
   * Remove classification for a product
   */
  removeProductClassification: publicProcedure
    .input(z.object({ codigoItem: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(productClassification)
        .where(eq(productClassification.codigoItem, input.codigoItem));
      return { success: true };
    }),

  /**
   * Get all product pricing settings
   */
  getProductPricing: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(productPricing);
  }),

  /**
   * Set product pricing mode and manual price
   */
  setProductPricing: publicProcedure
    .input(z.object({
      codigoItem: z.string(),
      mode: z.enum(["auto", "manual"]),
      manualPrice: z.number().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const existing = await db.select().from(productPricing)
        .where(eq(productPricing.codigoItem, input.codigoItem)).limit(1);
      if (existing.length > 0) {
        await db.update(productPricing)
          .set({
            mode: input.mode,
            manualPrice: input.manualPrice !== null ? String(input.manualPrice) : null,
          })
          .where(eq(productPricing.codigoItem, input.codigoItem));
      } else {
        await db.insert(productPricing).values({
          codigoItem: input.codigoItem,
          mode: input.mode,
          manualPrice: input.manualPrice !== null ? String(input.manualPrice) : null,
        });
      }
      return { success: true };
    }),

  /**
   * Set product stock settings (estoque regulador and prazo de compra)
   */
  setProductStockSettings: publicProcedure
    .input(z.object({
      codigoItem: z.string(),
      vendaMensal: z.number().nullable(),
      fatorMultiplicacao: z.string().nullable(),
      prazoCompraDias: z.number().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const existing = await db.select().from(productPricing)
        .where(eq(productPricing.codigoItem, input.codigoItem)).limit(1);
      if (existing.length > 0) {
        await db.update(productPricing)
          .set({
            vendaMensal: input.vendaMensal,
            fatorMultiplicacao: input.fatorMultiplicacao,
            prazoCompraDias: input.prazoCompraDias,
          })
          .where(eq(productPricing.codigoItem, input.codigoItem));
      } else {
        await db.insert(productPricing).values({
          codigoItem: input.codigoItem,
          mode: "auto",
          vendaMensal: input.vendaMensal,
          fatorMultiplicacao: input.fatorMultiplicacao,
          prazoCompraDias: input.prazoCompraDias,
        });
      }
      return { success: true };
    }),
});
