import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { appSettings, salesTargets, productSegmentOverrides, salesOrders, dashboardData, productVisibility, productClassification, productPricing, productVariants, operators, operatorGranularPermissions, madeiraVisibility, sicoobCardMessages, sellerPermissions, sellerProductVisibility, sellerCatalogVisibility, catalogs } from "../drizzle/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

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
      
      // Determine default segment based on grupo from stockProcessor
      // Use item.grupo if available (from processed data), otherwise classify from codes
      let grupoValue = item.grupo;
      if (!grupoValue) {
        // Fallback: classify using superGrupoCodigo and grupoCodigo (same logic as stockProcessor)
        const sgc = item.superGrupoCodigo || "";
        const gc = item.grupoCodigo || "";
        if (sgc === "12") grupoValue = "importacao_revenda";
        else if (sgc === "05") grupoValue = "industrializacao";
        else if (sgc === "16") {
          if (gc === "18" || gc === "19") grupoValue = "industrializacao";
          else grupoValue = "outros";
        } else if (sgc === "" && gc === "") grupoValue = "outros";
        else grupoValue = "outros";
      }
      let defaultSegment: string;
      if (grupoValue === "outros") {
        defaultSegment = "outros";
      } else if (grupoValue === "importacao_mp") {
        defaultSegment = "importacao_mp";
      } else if (grupoValue === "industrializacao") {
        defaultSegment = "industrializacao";
      } else {
        defaultSegment = "importacao";
      }

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
      segment: z.enum(["industrializacao", "importacao", "importacao_mp", "outros"]),
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
   * Rename operator (for employee replacement)
   */
  renameOperator: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(operators)
        .set({ name: input.name })
        .where(eq(operators.id, input.id));
      return { success: true };
    }),

  /**
   * Update operator permission
   */
  updateOperatorPermission: publicProcedure
    .input(z.object({
      id: z.number(),
      field: z.enum(["accessEstoque", "accessVendas", "accessFaturamento", "accessFinanceiro", "accessConfiguracoes", "accessValorizacao", "accessProducao", "accessGestaoComercial", "accessImportacao"]),
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
    const names = ["Maria", "Erica", "Danubia", "Fernando", "Gilson", "Bruno", "Guilherme", "Flavio", "Larissa", "Brenda", "Thalita", "Juvenal", "Pedro", "Jordao", "Paula"];
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
      // 1) Try operator login first
      const rows = await db.select().from(operators)
        .where(and(eq(operators.password, input.password), eq(operators.active, true)));
      if (rows.length > 0) {
        // Fetch all seller_permissions with this password to check authorization
        const matchingSellers = await db.select().from(sellerPermissions)
          .where(eq(sellerPermissions.password, input.password));

        // Find the first operator that is either NOT a seller, or IS an authorized seller
        let validOp = null;
        for (const op of rows) {
          const sellerForThisOp = matchingSellers.find(
            s => {
              const sellerNorm = s.sellerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
              const opNorm = op.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
              return sellerNorm === opNorm || sellerNorm.includes(opNorm) || opNorm.includes(sellerNorm.split(" ")[0]);
            }
          );
          if (!sellerForThisOp) {
            // Not a seller-operator, always allowed
            validOp = op;
            break;
          }
          if (sellerForThisOp.authorized) {
            // Is a seller-operator and is authorized
            validOp = op;
            break;
          }
          // This operator is a seller that is NOT authorized - skip and try next
        }

        if (!validOp) {
          // All matching operators are unauthorized sellers
          return { success: false, loginType: "operator" as const, operator: null, granularPermissions: {} as Record<string, boolean>, seller: null, error: "Acesso n\u00e3o autorizado. Aguarde libera\u00e7\u00e3o do gestor." };
        }

        const op = validOp;
        // Also fetch granular permissions
        const granPerms = await db.select().from(operatorGranularPermissions)
          .where(eq(operatorGranularPermissions.operatorId, op.id));
        const granularMap: Record<string, boolean> = {};
        for (const gp of granPerms) {
          granularMap[gp.permissionKey] = !!gp.enabled;
        }
        return {
          success: true,
          loginType: "operator" as const,
          operator: {
            id: op.id,
            name: op.name,
            accessEstoque: op.accessEstoque,
            accessVendas: op.accessVendas,
            accessFaturamento: op.accessFaturamento,
            accessFinanceiro: op.accessFinanceiro,
            accessConfiguracoes: op.accessConfiguracoes,
            accessValorizacao: op.accessValorizacao,
            accessProducao: op.accessProducao,
            accessGestaoComercial: op.accessGestaoComercial,
            accessImportacao: op.accessImportacao,
          },
          granularPermissions: granularMap,
          seller: null,
        };
      }

      // 2) Try seller login
      const sellers = await db.select().from(sellerPermissions)
        .where(eq(sellerPermissions.password, input.password));
      if (sellers.length > 0) {
        const authorizedSellers = sellers.filter(s => s.authorized);
        if (authorizedSellers.length === 0) {
          return { success: false, loginType: "seller" as const, operator: null, granularPermissions: {} as Record<string, boolean>, seller: null, error: "Acesso n\u00e3o autorizado. Aguarde libera\u00e7\u00e3o do gestor." };
        }
        // If multiple authorized sellers share the same password, redirect to /vendedor for selection
        if (authorizedSellers.length > 1) {
          // Store the matches info in the session so the seller page can show the selector
          return {
            success: true,
            loginType: "seller_multiple" as const,
            operator: null,
            granularPermissions: {} as Record<string, boolean>,
            seller: null,
            multipleMatches: authorizedSellers.map(s => ({ id: s.id, name: s.sellerName, gestor: s.gestorName })),
          };
        }
        const seller = authorizedSellers[0];
        // Fetch visible products
        const products = await db.select().from(sellerProductVisibility)
          .where(eq(sellerProductVisibility.sellerId, seller.id));
        // Fetch visible catalogs
        const visibleCatalogs = await db.select().from(sellerCatalogVisibility)
          .where(eq(sellerCatalogVisibility.sellerId, seller.id));
        const catalogIds = visibleCatalogs.map(c => c.catalogId);
        let sellerCatalogs: any[] = [];
        if (catalogIds.length > 0) {
          sellerCatalogs = await db.select().from(catalogs)
            .where(and(eq(catalogs.active, true), inArray(catalogs.id, catalogIds)));
        }
        return {
          success: true,
          loginType: "seller" as const,
          operator: null,
          granularPermissions: {} as Record<string, boolean>,
          seller: {
            id: seller.id,
            name: seller.sellerName,
            gestor: seller.gestorName,
            visibleProducts: products.map(p => p.productCode),
            catalogs: sellerCatalogs.map((c: any) => ({ id: c.id, name: c.name, folder: c.folder, url: c.url })),
          },
        };
      }

      // 3) No match
      return { success: false, loginType: null, operator: null, granularPermissions: {} as Record<string, boolean>, seller: null };
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

  updateMadeiraItemConfig: publicProcedure
    .input(z.object({
      codigoItem: z.string(),
      card: z.enum(["madeira", "semiPronto", "aguardandoEscolha"]),
      precoCaixa: z.number().nullable().optional(),
      alertaReposicao: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const existing = await db.select().from(madeiraVisibility)
        .where(and(eq(madeiraVisibility.codigoItem, input.codigoItem), eq(madeiraVisibility.card, input.card)));
      const updates: Record<string, any> = {};
      if (input.precoCaixa !== undefined) updates.precoCaixa = input.precoCaixa === null ? null : String(input.precoCaixa);
      if (input.alertaReposicao !== undefined) updates.alertaReposicao = input.alertaReposicao;
      if (existing.length > 0) {
        await db.update(madeiraVisibility)
          .set(updates)
          .where(and(eq(madeiraVisibility.codigoItem, input.codigoItem), eq(madeiraVisibility.card, input.card)));
      } else {
        await db.insert(madeiraVisibility).values({
          codigoItem: input.codigoItem,
          card: input.card,
          visible: true,
          ...updates,
        });
      }
      return { success: true };
    }),

  /**
   * Auto-preencher preços de Madeira PA a partir da média das últimas 5 vendas por codigoItem.
   * Busca no sales_orders (excluindo Digitação), calcula média das últimas 5 vendas,
   * e atualiza precoCaixa para todos os 3 cards de cada produto.
   * Só preenche se o produto NÃO tiver preço manual já definido.
   */
  autoFillMadeiraPrices: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { success: false, updated: 0, skipped: 0, noSales: 0 };

    // 1. Buscar todos os códigos distintos de madeira
    const allMadeira = await db.select({ codigoItem: madeiraVisibility.codigoItem }).from(madeiraVisibility);
    const distinctCodes = Array.from(new Set(allMadeira.map(r => r.codigoItem)));

    // 2. Buscar códigos que já têm preço manual (não sobrescrever)
    const withPrice = await db.select({ codigoItem: madeiraVisibility.codigoItem, precoCaixa: madeiraVisibility.precoCaixa })
      .from(madeiraVisibility)
      .where(sql`${madeiraVisibility.precoCaixa} IS NOT NULL AND ${madeiraVisibility.precoCaixa} > 0`);
    const codesWithPrice = new Set(withPrice.map(r => r.codigoItem));

    // 3. Para cada código sem preço, buscar últimas 5 vendas
    let updated = 0;
    let skipped = 0;
    let noSales = 0;

    for (const code of distinctCodes) {
      if (codesWithPrice.has(code)) {
        skipped++;
        continue;
      }

      // Buscar últimas 5 vendas deste produto (excluindo Digitação e valor 0)
      const sales = await db
        .select({ valorUnitario: salesOrders.valorUnitario })
        .from(salesOrders)
        .where(and(
          eq(salesOrders.codigoItem, code),
          sql`${salesOrders.valorUnitario} > 0`,
          sql`(${salesOrders.estadoNota} IS NULL OR UPPER(${salesOrders.estadoNota}) NOT IN ('DIGITAÇÃO', 'DIGITACAO'))`
        ))
        .orderBy(desc(salesOrders.dataEmissao))
        .limit(5);

      if (sales.length === 0) {
        noSales++;
        continue;
      }

      // Calcular média
      const values = sales.map(s => parseFloat(String(s.valorUnitario)));
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const roundedAvg = Math.round(avg * 100) / 100;

      // Atualizar precoCaixa para todos os 3 cards deste produto
      await db.update(madeiraVisibility)
        .set({ precoCaixa: String(roundedAvg) })
        .where(eq(madeiraVisibility.codigoItem, code));

      updated++;
    }

    return { success: true, updated, skipped, noSales };
  }),

  /**
   * Obter preços automáticos de Madeira PA (média últimas 5 vendas por codigoItem).
   * Retorna mapa codigoItem -> { avgPrice, salesCount } para uso no frontend.
   */
  getMadeiraAutoPrices: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { prices: {} };

    // Buscar todos os códigos distintos de madeira
    const allMadeira = await db.select({ codigoItem: madeiraVisibility.codigoItem }).from(madeiraVisibility);
    const distinctCodes = Array.from(new Set(allMadeira.map(r => r.codigoItem)));

    const prices: Record<string, { avgPrice: number; salesCount: number }> = {};

    for (const code of distinctCodes) {
      const sales = await db
        .select({ valorUnitario: salesOrders.valorUnitario })
        .from(salesOrders)
        .where(and(
          eq(salesOrders.codigoItem, code),
          sql`${salesOrders.valorUnitario} > 0`,
          sql`(${salesOrders.estadoNota} IS NULL OR UPPER(${salesOrders.estadoNota}) NOT IN ('DIGITAÇÃO', 'DIGITACAO'))`
        ))
        .orderBy(desc(salesOrders.dataEmissao))
        .limit(5);

      if (sales.length > 0) {
        const values = sales.map(s => parseFloat(String(s.valorUnitario)));
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        prices[code] = { avgPrice: Math.round(avg * 100) / 100, salesCount: sales.length };
      }
    }

    return { prices };
  }),

  /**
   * Get Sicoob Palitos "Limite disponível para troca de títulos"
   * Stored in app_settings with key 'sicoob_limite_troca'
   * Value is { valor: number, updatedBy: string, updatedAt: string }
   */
  getSicoobLimite: publicProcedure.query(async () => {
    const data = await getSetting("sicoob_limite_troca");
    if (!data) return { valor: null, updatedBy: null, updatedAt: null };
    return {
      valor: data.valor as number | null,
      updatedBy: data.updatedBy as string | null,
      updatedAt: data.updatedAt as string | null,
    };
  }),

  /**
   * Update Sicoob Palitos "Limite disponível para troca de títulos"
   * Only operator "Flavio" can update this value.
   */
  updateSicoobLimite: publicProcedure
    .input(z.object({
      valor: z.number().min(0, "Valor deve ser positivo"),
      operatorName: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Only Flavio can update
      if (input.operatorName !== "Flavio") {
        throw new Error("Apenas o operador Flávio pode atualizar o limite.");
      }
      const now = new Date().toISOString();
      await setSetting("sicoob_limite_troca", {
        valor: input.valor,
        updatedBy: input.operatorName,
        updatedAt: now,
      });
      return { success: true };
    }),

  /**
   * Get Sicoob Palitos "Valor previsto de liberação para desconto na semana"
   * Returns values for 5 weeks (current week + 4 future weeks)
   */
  getSicoobDescontoSemanal: publicProcedure.query(async () => {
    const data = await getSetting("sicoob_desconto_semanal_v2");
    if (!data) {
      // Fallback: try legacy single-value format
      const legacy = await getSetting("sicoob_desconto_semanal");
      if (legacy && legacy.valor != null) {
        return {
          weeks: [
            { weekIndex: 0, valor: legacy.valor as number, updatedBy: legacy.updatedBy as string | null, updatedAt: legacy.updatedAt as string | null },
            { weekIndex: 1, valor: null, updatedBy: null, updatedAt: null },
            { weekIndex: 2, valor: null, updatedBy: null, updatedAt: null },
            { weekIndex: 3, valor: null, updatedBy: null, updatedAt: null },
            { weekIndex: 4, valor: null, updatedBy: null, updatedAt: null },
          ],
        };
      }
      return {
        weeks: [
          { weekIndex: 0, valor: null, updatedBy: null, updatedAt: null },
          { weekIndex: 1, valor: null, updatedBy: null, updatedAt: null },
          { weekIndex: 2, valor: null, updatedBy: null, updatedAt: null },
          { weekIndex: 3, valor: null, updatedBy: null, updatedAt: null },
          { weekIndex: 4, valor: null, updatedBy: null, updatedAt: null },
        ],
      };
    }
    return { weeks: data.weeks };
  }),

  /**
   * Update Sicoob Palitos "Valor previsto de liberação para desconto na semana"
   * Supports updating a specific week (0-4). Only operator "Flavio" can update.
   */
  updateSicoobDescontoSemanal: publicProcedure
    .input(z.object({
      valor: z.number().min(0, "Valor deve ser positivo"),
      operatorName: z.string(),
      weekIndex: z.number().min(0).max(4).default(0),
    }))
    .mutation(async ({ input }) => {
      if (input.operatorName !== "Flavio") {
        throw new Error("Apenas o operador Flávio pode atualizar este valor.");
      }
      const now = new Date().toISOString();
      // Load existing data
      let data = await getSetting("sicoob_desconto_semanal_v2");
      if (!data || !data.weeks) {
        // Initialize with empty weeks
        data = {
          weeks: [
            { weekIndex: 0, valor: null, updatedBy: null, updatedAt: null },
            { weekIndex: 1, valor: null, updatedBy: null, updatedAt: null },
            { weekIndex: 2, valor: null, updatedBy: null, updatedAt: null },
            { weekIndex: 3, valor: null, updatedBy: null, updatedAt: null },
            { weekIndex: 4, valor: null, updatedBy: null, updatedAt: null },
          ],
        };
        // Migrate legacy value to week 0
        const legacy = await getSetting("sicoob_desconto_semanal");
        if (legacy && legacy.valor != null) {
          data.weeks[0] = { weekIndex: 0, valor: legacy.valor, updatedBy: legacy.updatedBy, updatedAt: legacy.updatedAt };
        }
      }
      // Update the specific week
      data.weeks[input.weekIndex] = {
        weekIndex: input.weekIndex,
        valor: input.valor,
        updatedBy: input.operatorName,
        updatedAt: now,
      };
      await setSetting("sicoob_desconto_semanal_v2", data);
      return { success: true };
    }),

  /**
   * Get messages for a Sicoob card chat
   */
  getCardMessages: publicProcedure
    .input(z.object({
      cardKey: z.string(),
      limit: z.number().min(1).max(100).optional().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(sicoobCardMessages)
        .where(eq(sicoobCardMessages.cardKey, input.cardKey))
        .orderBy(desc(sicoobCardMessages.createdAt))
        .limit(input.limit);
      return rows.reverse(); // oldest first for chat display
    }),

  /**
   * Send a message in a Sicoob card chat
   * Accessible by Flavio and operators with Sicoob Palitos access
   */
  sendCardMessage: publicProcedure
    .input(z.object({
      cardKey: z.string(),
      operatorName: z.string().min(1),
      message: z.string().min(1).max(500),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [row] = await db.insert(sicoobCardMessages).values({
        cardKey: input.cardKey,
        operatorName: input.operatorName,
        message: input.message,
        createdAt: Date.now(),
      });
      return { success: true, id: row.insertId };
    }),

  /**
   * Get Bradesco "Limite atual da conta garantida"
   * Stores per-empresa values: { palitos: {...}, espetos: {...}, varetas: {...} }
   */
  getBradescoLimiteContaGarantida: publicProcedure.query(async () => {
    const data = await getSetting("bradesco_limite_conta_garantida");
    if (!data) return {
      palitos: { valor: null, updatedBy: null, updatedAt: null },
      espetos: { valor: null, updatedBy: null, updatedAt: null },
      varetas: { valor: null, updatedBy: null, updatedAt: null },
    };
    return {
      palitos: data.palitos || { valor: null, updatedBy: null, updatedAt: null },
      espetos: data.espetos || { valor: null, updatedBy: null, updatedAt: null },
      varetas: data.varetas || { valor: null, updatedBy: null, updatedAt: null },
    };
  }),

  /**
   * Update Bradesco "Limite atual da conta garantida" for a specific empresa
   * Only operator "Flavio" can update this value.
   */
  updateBradescoLimiteContaGarantida: publicProcedure
    .input(z.object({
      empresa: z.enum(["palitos", "espetos", "varetas"]),
      valor: z.number().min(0, "Valor deve ser positivo"),
      operatorName: z.string(),
    }))
    .mutation(async ({ input }) => {
      if (input.operatorName !== "Flavio") {
        throw new Error("Apenas o operador Flávio pode atualizar o limite.");
      }
      const now = new Date().toISOString();
      const existing = await getSetting("bradesco_limite_conta_garantida") || {
        palitos: { valor: null, updatedBy: null, updatedAt: null },
        espetos: { valor: null, updatedBy: null, updatedAt: null },
        varetas: { valor: null, updatedBy: null, updatedAt: null },
      };
      existing[input.empresa] = {
        valor: input.valor,
        updatedBy: input.operatorName,
        updatedAt: now,
      };
      await setSetting("bradesco_limite_conta_garantida", existing);
      return { success: true };
    }),
});
