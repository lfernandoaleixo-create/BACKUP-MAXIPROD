import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { importSuppliers, importPayments } from "../drizzle/schema";
import { eq, asc, and } from "drizzle-orm";
import { callDataApi } from "./_core/dataApi";

// Cache de cotação USD/BRL em memória (TTL: 30 minutos)
let exchangeRateCache: { data: { rate: number; source: string; timestamp: string }; timestamp: number } | null = null;

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

  // ===== PAYMENTS (all fields 100% manual, no auto-calculation) =====
  createPayment: publicProcedure
    .input(z.object({
      supplierId: z.number(),
      sectionTitle: z.string().optional(),
      status: z.string().min(1),
      pedido: z.string().min(1),
      doc: z.string().min(1),
      totalUsd: z.string(),
      totalBrasilUsd: z.string().optional(),
      totalParaguaiUsd: z.string().optional(),
      brasilUsd: z.string().optional(),
      paraguaiUsd: z.string().optional(),
      totalPago: z.string().optional(),
      saldoDevedorBrasil: z.string().optional(),
      saldoDevedorParaguai: z.string().optional(),
      saldoDevedorTotal: z.string().optional(),
      rastreio: z.string().optional(),
      arrivalDate: z.string().optional(),
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
        totalBrasilUsd: input.totalBrasilUsd || "0.00",
        totalParaguaiUsd: input.totalParaguaiUsd || "0.00",
        brasilUsd: input.brasilUsd || "0.00",
        paraguaiUsd: input.paraguaiUsd || "0.00",
        totalPago: input.totalPago || "0.00",
        saldoDevedorBrasil: input.saldoDevedorBrasil || "0.00",
        saldoDevedorParaguai: input.saldoDevedorParaguai || "0.00",
        saldoDevedorTotal: input.saldoDevedorTotal || "0.00",
        rastreio: input.rastreio || null,
        arrivalDate: input.arrivalDate || null,
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
      totalBrasilUsd: z.string().optional(),
      totalParaguaiUsd: z.string().optional(),
      brasilUsd: z.string().optional(),
      paraguaiUsd: z.string().optional(),
      totalPago: z.string().optional(),
      saldoDevedorBrasil: z.string().optional(),
      saldoDevedorParaguai: z.string().optional(),
      saldoDevedorTotal: z.string().optional(),
      rastreio: z.string().optional(),
      arrivalDate: z.string().optional(),
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
      if (rawData.totalBrasilUsd !== undefined) updateData.totalBrasilUsd = rawData.totalBrasilUsd;
      if (rawData.totalParaguaiUsd !== undefined) updateData.totalParaguaiUsd = rawData.totalParaguaiUsd;
      if (rawData.brasilUsd !== undefined) updateData.brasilUsd = rawData.brasilUsd;
      if (rawData.paraguaiUsd !== undefined) updateData.paraguaiUsd = rawData.paraguaiUsd;
      if (rawData.totalPago !== undefined) updateData.totalPago = rawData.totalPago;
      if (rawData.saldoDevedorBrasil !== undefined) updateData.saldoDevedorBrasil = rawData.saldoDevedorBrasil;
      if (rawData.saldoDevedorParaguai !== undefined) updateData.saldoDevedorParaguai = rawData.saldoDevedorParaguai;
      if (rawData.saldoDevedorTotal !== undefined) updateData.saldoDevedorTotal = rawData.saldoDevedorTotal;
      if (rawData.rastreio !== undefined) updateData.rastreio = rawData.rastreio || null;
      if (rawData.arrivalDate !== undefined) updateData.arrivalDate = rawData.arrivalDate || null;

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
    // Cache em memória para evitar chamadas excessivas (TTL: 30 minutos)
    const now = Date.now();
    if (exchangeRateCache && now - exchangeRateCache.timestamp < 30 * 60 * 1000) {
      return exchangeRateCache.data;
    }

    // 1. Banco Central do Brasil (PTAX) - fonte oficial, formato MM-DD-YYYY
    try {
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const yyyy = today.getFullYear();
      const dateStr = `${mm}-${dd}-${yyyy}`;
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao=%27${dateStr}%27&$top=1&$orderby=dataHoraCotacao%20desc&$format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        if (data.value && data.value.length > 0) {
          const result = { rate: data.value[0].cotacaoVenda, source: "BCB PTAX", timestamp: data.value[0].dataHoraCotacao };
          exchangeRateCache = { data: result, timestamp: now };
          return result;
        }
      }
    } catch (e) {
      console.log("[ExchangeRate] BCB failed:", (e as Error).message);
    }

    // 2. BCB dia anterior (caso hoje não tenha cotação ainda - fim de semana/feriado)
    try {
      const yesterday = new Date(Date.now() - 86400000);
      const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
      const dd = String(yesterday.getDate()).padStart(2, '0');
      const yyyy = yesterday.getFullYear();
      const dateStr = `${mm}-${dd}-${yyyy}`;
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao=%27${dateStr}%27&$top=1&$orderby=dataHoraCotacao%20desc&$format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        if (data.value && data.value.length > 0) {
          const result = { rate: data.value[0].cotacaoVenda, source: "BCB PTAX (D-1)", timestamp: data.value[0].dataHoraCotacao };
          exchangeRateCache = { data: result, timestamp: now };
          return result;
        }
      }
    } catch (e) {
      console.log("[ExchangeRate] BCB D-1 failed:", (e as Error).message);
    }

    // 3. AwesomeAPI (free, no key needed) - pode ter rate limit
    try {
      const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        if (data.USDBRL) {
          const rate = parseFloat(data.USDBRL.bid);
          const result = { rate, source: "AwesomeAPI", timestamp: data.USDBRL.create_date };
          exchangeRateCache = { data: result, timestamp: now };
          return result;
        }
      }
    } catch (e) {
      console.log("[ExchangeRate] AwesomeAPI failed:", (e as Error).message);
    }

    // 4. Usar cache antigo se disponível (melhor que fallback fixo)
    if (exchangeRateCache) {
      return { ...exchangeRateCache.data, source: exchangeRateCache.data.source + " (cache)" };
    }

    // Last resort fallback
    return { rate: 5.04, source: "fallback", timestamp: new Date().toISOString() };
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
