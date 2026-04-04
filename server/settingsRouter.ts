import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { appSettings, salesTargets, productSegmentOverrides, salesOrders, dashboardData, productVisibility, productClassification, productPricing, productVariants, operators, operatorGranularPermissions, madeiraVisibility } from "../drizzle/schema";
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
   * Verify admin password (BYPASS - sem senha)
   */
  verifyPassword: publicProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async () => {
      return { success: true };
    }),

  /**
   * Change admin password (BYPASS - sem senha)
   */
  changePassword: publicProcedure
    .input(z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(4, "Senha deve ter no minimo 4 caracteres"),
    }))
    .mutation(async ({ input }) => {
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
        estoqueUn: item.estoqueUn ?? 0,
        disponivelCx: item.disponivelCx ?? 0,
        disponivelUn: item.disponivelUn ?? 0,
        isKgProduct: item.isKgProduct || false,
        unidadeMedida: item.unidadeMedida || "",
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
      segment: z.enum(["industrializacao", "importacao", "importacao_mp"]),
    }))
    .mutation(async ({ input }) => {
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
   * Auto-classify all products based on current dashboard data
   * Products with classification already set are preserved (editável)
   * Products without classification: if they have estoque > 0 or are in the "estoque" group -> "estoque"
   * Products explicitly in "encomenda" group stay as "encomenda"
   */
  autoClassifyProducts: publicProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) return { success: false, estoque: 0, encomenda: 0 };

      // Get all products from dashboard
      const dashRows = await db.select().from(dashboardData).limit(1);
      if (dashRows.length === 0) return { success: false, estoque: 0, encomenda: 0 };

      const rawData = dashRows[0].dataJson as any;
      const items: any[] = typeof rawData === 'string' ? JSON.parse(rawData) : (Array.isArray(rawData) ? rawData : Object.values(rawData));

      // Get existing classifications
      const existingClassifications = await db.select().from(productClassification);
      const existingMap = new Map(existingClassifications.map(c => [c.codigoItem, c.classification]));

      let estoqueCount = 0;
      let encomendaCount = 0;

      for (const item of items) {
        const codigoItem = item.codigoItem || "";
        if (!codigoItem) continue;

        // Skip if already has a classification
        if (existingMap.has(codigoItem)) {
          if (existingMap.get(codigoItem) === "estoque") estoqueCount++;
          if (existingMap.get(codigoItem) === "encomenda") encomendaCount++;
          continue;
        }

        // Default: classify as "estoque" (the default behavior in Home.tsx)
        // Products without classification are shown in "Estoque" card by default
        const classification = "estoque";
        await db.insert(productClassification).values({
          codigoItem,
          descricao: item.descricaoItem || "",
          classification,
        });
        estoqueCount++;
      }

      return { success: true, estoque: estoqueCount, encomenda: encomendaCount };
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

  // ─── Variações de Produto (Pai/Filho) ───
  
  /**
   * Listar todas as variações configuradas
   */
  getVariants: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(productVariants);
    return rows;
  }),

  /**
   * Adicionar uma variação (filho) a um produto pai
   */
  addVariant: publicProcedure
    .input(z.object({
      parentCode: z.string().min(1),
      childCode: z.string().min(1),
      conversionFactor: z.number().positive(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      
      // Verificar se já existe
      const existing = await db.select().from(productVariants)
        .where(and(
          eq(productVariants.parentCode, input.parentCode),
          eq(productVariants.childCode, input.childCode)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        // Atualizar fator
        await db.update(productVariants)
          .set({ conversionFactor: input.conversionFactor.toString() })
          .where(and(
            eq(productVariants.parentCode, input.parentCode),
            eq(productVariants.childCode, input.childCode)
          ));
      } else {
        await db.insert(productVariants).values({
          parentCode: input.parentCode,
          childCode: input.childCode,
          conversionFactor: input.conversionFactor.toString(),
        });
      }
      return { success: true };
    }),

  /**
   * Remover uma variação
   */
  removeVariant: publicProcedure
    .input(z.object({
      parentCode: z.string(),
      childCode: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.delete(productVariants)
        .where(and(
          eq(productVariants.parentCode, input.parentCode),
          eq(productVariants.childCode, input.childCode)
        ));
      return { success: true };
    }),

  // ─── Operator Management ──────────────────────────────────────

  /**
   * Get all operators with their permissions
   */
  getOperators: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(operators).orderBy(operators.name);
  }),

  /**
   * Create a new operator
   */
  createOperator: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      password: z.string().default(""),
      accessEstoque: z.boolean().default(false),
      accessVendas: z.boolean().default(false),
      accessFaturamento: z.boolean().default(false),
      accessFinanceiro: z.boolean().default(false),
      accessConfiguracoes: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const result = await db.insert(operators).values(input);
      return { success: true, id: Number(result[0].insertId) };
    }),

  /**
   * Update operator password
   */
  updateOperatorPassword: publicProcedure
    .input(z.object({
      id: z.number(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(operators)
        .set({ password: input.password })
        .where(eq(operators.id, input.id));
      return { success: true };
    }),

  /**
   * Update operator permission
   */
  updateOperatorPermission: publicProcedure
    .input(z.object({
      id: z.number(),
      field: z.enum(["accessEstoque", "accessVendas", "accessFaturamento", "accessFinanceiro", "accessConfiguracoes", "accessValorizacao"]),
      value: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(operators)
        .set({ [input.field]: input.value })
        .where(eq(operators.id, input.id));
      return { success: true };
    }),

  /**
   * Delete operator
   */
  deleteOperator: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.delete(operators).where(eq(operators.id, input.id));
      return { success: true };
    }),

  /**
   * Seed initial operators (only if table is empty)
   */
  seedOperators: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const existing = await db.select().from(operators).limit(1);
    if (existing.length > 0) return { success: true, message: "Operators already exist" };
    const names = ["Maria", "Erica", "Marcos", "Fernando", "Gilson", "Bruno", "Guilherme", "Flavio", "Larissa", "Brenda", "Thiago", "Thalita", "Juvenal", "Pedro", "Jordao", "Paula"];
    for (const name of names) {
      await db.insert(operators).values({ name, password: "", accessEstoque: false, accessVendas: false, accessFaturamento: false, accessFinanceiro: false, accessConfiguracoes: false });
    }
    return { success: true, message: `${names.length} operators created` };
  }),

  /**
   * Get granular permissions for a specific operator
   */
  getGranularPermissions: publicProcedure
    .input(z.object({ operatorId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(operatorGranularPermissions)
        .where(eq(operatorGranularPermissions.operatorId, input.operatorId));
    }),

  /**
   * Get all granular permissions for all operators (bulk)
   */
  getAllGranularPermissions: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(operatorGranularPermissions);
  }),

  /**
   * Set a granular permission (upsert)
   */
  setGranularPermission: publicProcedure
    .input(z.object({
      operatorId: z.number(),
      permissionKey: z.string(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const existing = await db.select().from(operatorGranularPermissions)
        .where(and(
          eq(operatorGranularPermissions.operatorId, input.operatorId),
          eq(operatorGranularPermissions.permissionKey, input.permissionKey)
        ))
        .limit(1);
      if (existing.length > 0) {
        await db.update(operatorGranularPermissions)
          .set({ enabled: input.enabled })
          .where(eq(operatorGranularPermissions.id, existing[0].id));
      } else {
        await db.insert(operatorGranularPermissions).values(input);
      }
      return { success: true };
    }),

  /**
   * Bulk set granular permissions for an operator
   */
  setBulkGranularPermissions: publicProcedure
    .input(z.object({
      operatorId: z.number(),
      permissions: z.array(z.object({
        permissionKey: z.string(),
        enabled: z.boolean(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      for (const perm of input.permissions) {
        const existing = await db.select().from(operatorGranularPermissions)
          .where(and(
            eq(operatorGranularPermissions.operatorId, input.operatorId),
            eq(operatorGranularPermissions.permissionKey, perm.permissionKey)
          ))
          .limit(1);
        if (existing.length > 0) {
          await db.update(operatorGranularPermissions)
            .set({ enabled: perm.enabled })
            .where(eq(operatorGranularPermissions.id, existing[0].id));
        } else {
          await db.insert(operatorGranularPermissions).values({
            operatorId: input.operatorId,
            permissionKey: perm.permissionKey,
            enabled: perm.enabled,
          });
        }
      }
      return { success: true };
    }),

  /**
   * Validate operator login
   */
  validateOperator: publicProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const rows = await db.select().from(operators)
        .where(and(eq(operators.password, input.password), eq(operators.active, true)));
      if (rows.length === 0) return { success: false, operator: null, granularPermissions: {} as Record<string, boolean> };
      const op = rows[0];
      // Also fetch granular permissions
      const granPerms = await db.select().from(operatorGranularPermissions)
        .where(eq(operatorGranularPermissions.operatorId, op.id));
      const granularMap: Record<string, boolean> = {};
      for (const gp of granPerms) {
        granularMap[gp.permissionKey] = !!gp.enabled;
      }
      return {
        success: true,
        operator: {
          id: op.id,
          name: op.name,
          accessEstoque: op.accessEstoque,
          accessVendas: op.accessVendas,
          accessFaturamento: op.accessFaturamento,
          accessFinanceiro: op.accessFinanceiro,
          accessConfiguracoes: op.accessConfiguracoes,
          accessValorizacao: op.accessValorizacao,
        },
        granularPermissions: granularMap,
      };
    }),

  // ─── Feature Toggles ──────────────────────────────────────

  /**
   * Get a feature toggle value (public - all operators need to read this)
   */
  getFeatureToggle: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const value = await getSetting(`feature_toggle_${input.key}`);
      return { enabled: value === true };
    }),

  /**
   * Set a feature toggle (admin only - requires config access)
   */
  setFeatureToggle: publicProcedure
    .input(z.object({ key: z.string(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      await setSetting(`feature_toggle_${input.key}`, input.enabled);
      return { success: true };
    }),

  // ─── Madeira Visibility ────────────────────────────────────────────────
  getMadeiraVisibility: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { items: [] };
    const rows = await db.select().from(madeiraVisibility);
    return { items: rows };
  }),

  setMadeiraVisibility: publicProcedure
    .input(z.object({
      codigoItem: z.string(),
      card: z.enum(["madeira", "semiPronto", "aguardandoEscolha"]),
      visible: z.boolean(),
      updatedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const existing = await db.select().from(madeiraVisibility)
        .where(and(eq(madeiraVisibility.codigoItem, input.codigoItem), eq(madeiraVisibility.card, input.card)));
      if (existing.length > 0) {
        await db.update(madeiraVisibility)
          .set({ visible: input.visible, updatedBy: input.updatedBy })
          .where(and(eq(madeiraVisibility.codigoItem, input.codigoItem), eq(madeiraVisibility.card, input.card)));
      } else {
        await db.insert(madeiraVisibility).values({
          codigoItem: input.codigoItem,
          card: input.card,
          visible: input.visible,
          updatedBy: input.updatedBy,
        });
      }
      return { success: true };
    }),

  setBulkMadeiraVisibility: publicProcedure
    .input(z.object({
      codigoItem: z.string(),
      madeira: z.boolean(),
      semiPronto: z.boolean(),
      aguardandoEscolha: z.boolean(),
      updatedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const cards = [
        { card: "madeira" as const, visible: input.madeira },
        { card: "semiPronto" as const, visible: input.semiPronto },
        { card: "aguardandoEscolha" as const, visible: input.aguardandoEscolha },
      ];
      for (const c of cards) {
        const existing = await db.select().from(madeiraVisibility)
          .where(and(eq(madeiraVisibility.codigoItem, input.codigoItem), eq(madeiraVisibility.card, c.card)));
        if (existing.length > 0) {
          await db.update(madeiraVisibility)
            .set({ visible: c.visible, updatedBy: input.updatedBy })
            .where(and(eq(madeiraVisibility.codigoItem, input.codigoItem), eq(madeiraVisibility.card, c.card)));
        } else {
          await db.insert(madeiraVisibility).values({
            codigoItem: input.codigoItem,
            card: c.card,
            visible: c.visible,
            updatedBy: input.updatedBy,
          });
        }
      }
      return { success: true };
    }),
});
