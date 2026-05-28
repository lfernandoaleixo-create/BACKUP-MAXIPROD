import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { importSuppliers, importPayments } from "../drizzle/schema";
import { eq, asc, and } from "drizzle-orm";
import { callDataApi } from "./_core/dataApi";

export const importRouter = router({
  // ===== SUPPLIERS =====
  getSuppliers: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(importSuppliers).orderBy(asc(importSuppliers.displayOrder));
  }),

  createSupplier: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      category: z.string().optional(),
      displayOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(importSuppliers).values({
        name: input.name,
        category: input.category || null,
        displayOrder: input.displayOrder || 0,
      });
      return { id: result.insertId };
    }),

  updateSupplier: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      category: z.string().optional(),
      displayOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      await db.update(importSuppliers).set(data).where(eq(importSuppliers.id, id));
      return { success: true };
    }),

  deleteSupplier: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(importPayments).where(eq(importPayments.supplierId, input.id));
      await db.delete(importSuppliers).where(eq(importSuppliers.id, input.id));
      return { success: true };
    }),

  // ===== PAYMENTS (all fields manual, no auto-calculation) =====
  createPayment: publicProcedure
    .input(z.object({
      supplierId: z.number(),
      sectionTitle: z.string().optional(),
      status: z.string().min(1),
      pedido: z.string().min(1),
      doc: z.string().min(1),
      totalUsd: z.string(),
      halfValue: z.string().optional(),
      brasilUsd: z.string().optional(),
      paraguaiUsd: z.string().optional(),
      totalPago: z.string().optional(),
      saldoDevedorBrasil: z.string().optional(),
      saldoDevedorParaguai: z.string().optional(),
      saldoDevedorTotal: z.string().optional(),
      rastreio: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [result] = await db.insert(importPayments).values({
        supplierId: input.supplierId,
        sectionTitle: input.sectionTitle || null,
        status: input.status,
        pedido: input.pedido,
        doc: input.doc,
        totalUsd: input.totalUsd || "0.00",
        halfValue: input.halfValue || "0.00",
        brasilUsd: input.brasilUsd || "0.00",
        paraguaiUsd: input.paraguaiUsd || "0.00",
        totalPago: input.totalPago || "0.00",
        saldoDevedorBrasil: input.saldoDevedorBrasil || "0.00",
        saldoDevedorParaguai: input.saldoDevedorParaguai || "0.00",
        saldoDevedorTotal: input.saldoDevedorTotal || "0.00",
        rastreio: input.rastreio || null,
      });
      return { id: result.insertId };
    }),

  updatePayment: publicProcedure
    .input(z.object({
      id: z.number(),
      sectionTitle: z.string().optional(),
      status: z.string().optional(),
      pedido: z.string().optional(),
      doc: z.string().optional(),
      totalUsd: z.string().optional(),
      halfValue: z.string().optional(),
      brasilUsd: z.string().optional(),
      paraguaiUsd: z.string().optional(),
      totalPago: z.string().optional(),
      saldoDevedorBrasil: z.string().optional(),
      saldoDevedorParaguai: z.string().optional(),
      saldoDevedorTotal: z.string().optional(),
      rastreio: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...rawData } = input;

      const updateData: Record<string, any> = {};
      if (rawData.sectionTitle !== undefined) updateData.sectionTitle = rawData.sectionTitle || null;
      if (rawData.status !== undefined) updateData.status = rawData.status;
      if (rawData.pedido !== undefined) updateData.pedido = rawData.pedido;
      if (rawData.doc !== undefined) updateData.doc = rawData.doc;
      if (rawData.totalUsd !== undefined) updateData.totalUsd = rawData.totalUsd;
      if (rawData.halfValue !== undefined) updateData.halfValue = rawData.halfValue;
      if (rawData.brasilUsd !== undefined) updateData.brasilUsd = rawData.brasilUsd;
      if (rawData.paraguaiUsd !== undefined) updateData.paraguaiUsd = rawData.paraguaiUsd;
      if (rawData.totalPago !== undefined) updateData.totalPago = rawData.totalPago;
      if (rawData.saldoDevedorBrasil !== undefined) updateData.saldoDevedorBrasil = rawData.saldoDevedorBrasil;
      if (rawData.saldoDevedorParaguai !== undefined) updateData.saldoDevedorParaguai = rawData.saldoDevedorParaguai;
      if (rawData.saldoDevedorTotal !== undefined) updateData.saldoDevedorTotal = rawData.saldoDevedorTotal;
      if (rawData.rastreio !== undefined) updateData.rastreio = rawData.rastreio || null;

      if (Object.keys(updateData).length > 0) {
        await db.update(importPayments).set(updateData).where(eq(importPayments.id, id));
      }
      return { success: true };
    }),

  deletePayment: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(importPayments).where(eq(importPayments.id, input.id));
      return { success: true };
    }),

  // ===== DELETE SECTION (all payments in a section) =====
  deleteSection: publicProcedure
    .input(z.object({ supplierId: z.number(), sectionTitle: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(importPayments).where(
        and(
          eq(importPayments.supplierId, input.supplierId),
          eq(importPayments.sectionTitle, input.sectionTitle)
        )
      );
      return { success: true };
    }),

  // ===== RENAME SECTION (update sectionTitle for all payments in a section) =====
  renameSection: publicProcedure
    .input(z.object({
      supplierId: z.number(),
      oldSectionTitle: z.string(),
      newSectionTitle: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(importPayments)
        .set({ sectionTitle: input.newSectionTitle })
        .where(
          and(
            eq(importPayments.supplierId, input.supplierId),
            eq(importPayments.sectionTitle, input.oldSectionTitle)
          )
        );
      return { success: true };
    }),

  // ===== EXCHANGE RATE (USD/BRL) =====
  getExchangeRate: publicProcedure.query(async () => {
    try {
      // Try AwesomeAPI (free, no key needed)
      const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
      if (res.ok) {
        const data = await res.json();
        const rate = parseFloat(data.USDBRL.bid);
        return { rate, source: "AwesomeAPI", timestamp: data.USDBRL.create_date };
      }
    } catch (e) {
      // fallback
    }
    try {
      // Fallback: Banco Central do Brasil
      const res = await fetch("https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao=%27" + new Date().toISOString().split("T")[0].split("-").reverse().join("-") + "%27&$top=1&$format=json");
      if (res.ok) {
        const data = await res.json();
        if (data.value && data.value.length > 0) {
          return { rate: data.value[0].cotacaoCompra, source: "BCB", timestamp: new Date().toISOString() };
        }
      }
    } catch (e) {
      // fallback
    }
    // Last resort fallback
    return { rate: 5.50, source: "fallback", timestamp: new Date().toISOString() };
  }),

  // ===== FULL DATA (suppliers + payments grouped by section) =====
  getFullData: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const suppliers = await db.select().from(importSuppliers).orderBy(asc(importSuppliers.displayOrder));
    const payments = await db.select().from(importPayments).orderBy(asc(importPayments.id));

    return suppliers.map((supplier) => ({
      ...supplier,
      payments: payments.filter((p) => p.supplierId === supplier.id),
    }));
  }),
});
