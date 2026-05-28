import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { importSuppliers, importPayments } from "../drizzle/schema";
import { eq, asc } from "drizzle-orm";

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

  // ===== PAYMENTS =====
  getPayments: publicProcedure
    .input(z.object({ supplierId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (input?.supplierId) {
        return db.select().from(importPayments)
          .where(eq(importPayments.supplierId, input.supplierId))
          .orderBy(asc(importPayments.id));
      }
      return db.select().from(importPayments).orderBy(asc(importPayments.id));
    }),

  createPayment: publicProcedure
    .input(z.object({
      supplierId: z.number(),
      status: z.string().min(1),
      pedido: z.string().min(1),
      doc: z.string().min(1),
      totalUsd: z.string(),
      brasilUsd: z.string().optional(),
      paraguaiUsd: z.string().optional(),
      rastreio: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const totalUsd = parseFloat(input.totalUsd) || 0;
      const halfValue = totalUsd / 2;
      const brasilUsd = parseFloat(input.brasilUsd || "0") || 0;
      const paraguaiUsd = parseFloat(input.paraguaiUsd || "0") || 0;
      const totalPago = brasilUsd + paraguaiUsd;
      const saldoDevedorBrasil = halfValue - brasilUsd;
      const saldoDevedorParaguai = halfValue - paraguaiUsd;
      const saldoDevedorTotal = totalUsd - totalPago;

      const [result] = await db.insert(importPayments).values({
        supplierId: input.supplierId,
        status: input.status,
        pedido: input.pedido,
        doc: input.doc,
        totalUsd: totalUsd.toFixed(2),
        halfValue: halfValue.toFixed(2),
        brasilUsd: brasilUsd.toFixed(2),
        paraguaiUsd: paraguaiUsd.toFixed(2),
        totalPago: totalPago.toFixed(2),
        saldoDevedorBrasil: saldoDevedorBrasil.toFixed(2),
        saldoDevedorParaguai: saldoDevedorParaguai.toFixed(2),
        saldoDevedorTotal: saldoDevedorTotal.toFixed(2),
        rastreio: input.rastreio || null,
      });
      return { id: result.insertId };
    }),

  updatePayment: publicProcedure
    .input(z.object({
      id: z.number(),
      status: z.string().optional(),
      pedido: z.string().optional(),
      doc: z.string().optional(),
      totalUsd: z.string().optional(),
      brasilUsd: z.string().optional(),
      paraguaiUsd: z.string().optional(),
      rastreio: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...rawData } = input;

      if (rawData.totalUsd !== undefined || rawData.brasilUsd !== undefined || rawData.paraguaiUsd !== undefined) {
        const [current] = await db.select().from(importPayments).where(eq(importPayments.id, id));
        if (!current) throw new Error("Payment not found");

        const totalUsd = rawData.totalUsd !== undefined ? parseFloat(rawData.totalUsd) : parseFloat(String(current.totalUsd));
        const halfValue = totalUsd / 2;
        const brasilUsd = rawData.brasilUsd !== undefined ? parseFloat(rawData.brasilUsd) : parseFloat(String(current.brasilUsd));
        const paraguaiUsd = rawData.paraguaiUsd !== undefined ? parseFloat(rawData.paraguaiUsd) : parseFloat(String(current.paraguaiUsd));
        const totalPago = brasilUsd + paraguaiUsd;
        const saldoDevedorBrasil = halfValue - brasilUsd;
        const saldoDevedorParaguai = halfValue - paraguaiUsd;
        const saldoDevedorTotal = totalUsd - totalPago;

        const updateData: Record<string, any> = {
          totalUsd: totalUsd.toFixed(2),
          halfValue: halfValue.toFixed(2),
          brasilUsd: brasilUsd.toFixed(2),
          paraguaiUsd: paraguaiUsd.toFixed(2),
          totalPago: totalPago.toFixed(2),
          saldoDevedorBrasil: saldoDevedorBrasil.toFixed(2),
          saldoDevedorParaguai: saldoDevedorParaguai.toFixed(2),
          saldoDevedorTotal: saldoDevedorTotal.toFixed(2),
        };
        if (rawData.status !== undefined) updateData.status = rawData.status;
        if (rawData.pedido !== undefined) updateData.pedido = rawData.pedido;
        if (rawData.doc !== undefined) updateData.doc = rawData.doc;
        if (rawData.rastreio !== undefined) updateData.rastreio = rawData.rastreio;

        await db.update(importPayments).set(updateData).where(eq(importPayments.id, id));
      } else {
        const updateData: Record<string, any> = {};
        if (rawData.status !== undefined) updateData.status = rawData.status;
        if (rawData.pedido !== undefined) updateData.pedido = rawData.pedido;
        if (rawData.doc !== undefined) updateData.doc = rawData.doc;
        if (rawData.rastreio !== undefined) updateData.rastreio = rawData.rastreio;
        if (Object.keys(updateData).length > 0) {
          await db.update(importPayments).set(updateData).where(eq(importPayments.id, id));
        }
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

  // ===== FULL DATA (suppliers + payments together) =====
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
