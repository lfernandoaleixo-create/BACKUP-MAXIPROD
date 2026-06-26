import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { importSuppliers, importPayments, trackingCache, importPos, importPoProducts, importIcmsConfig, importNcmTaxes, importConfig, stockItems, purchaseOrderItems, productCatalog } from "../drizzle/schema";
import { eq, asc, and, desc, like, sql, or, inArray, isNotNull, ne } from "drizzle-orm";
import { callDataApi } from "./_core/dataApi";
import { fetchOneTracking } from "./oneTracking";
import { gql } from "./maxiprodGraphQL";

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
      context: z.enum(['pagamentos', 'custo', 'both']).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(importSuppliers).values({
        name: input.name,
        category: input.category || null,
        displayOrder: input.displayOrder || 0,
        context: input.context || 'both',
      });
      return { id: result.insertId };
    }),

  updateSupplier: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      displayName: z.string().optional(),
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
      // Get all POs for this supplier to delete their products
      const pos = await db.select({ id: importPos.id }).from(importPos).where(eq(importPos.supplierId, input.id));
      for (const po of pos) {
        await db.delete(importPoProducts).where(eq(importPoProducts.poId, po.id));
      }
      await db.delete(importPos).where(eq(importPos.supplierId, input.id));
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
      trackingUuid: z.string().optional(),
      blNumber: z.string().optional(),
      arrivalDate: z.string().optional(),
      alertDaysBefore: z.number().nullable().optional(),
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
        trackingUuid: input.trackingUuid || null,
        blNumber: input.blNumber || null,
        arrivalDate: input.arrivalDate || null,
        alertDaysBefore: input.alertDaysBefore ?? null,
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
      trackingUuid: z.string().nullable().optional(),
      blNumber: z.string().nullable().optional(),
      arrivalDate: z.string().optional(),
      alertDaysBefore: z.number().nullable().optional(),
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
      if (rawData.trackingUuid !== undefined) updateData.trackingUuid = rawData.trackingUuid || null;
      if (rawData.blNumber !== undefined) updateData.blNumber = rawData.blNumber || null;
      if (rawData.arrivalDate !== undefined) updateData.arrivalDate = rawData.arrivalDate || null;
      if (rawData.alertDaysBefore !== undefined) updateData.alertDaysBefore = rawData.alertDaysBefore;

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

  // ===== ALERT: Dismiss payment alert (manual by Larissa) =====
  dismissAlert: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(importPayments)
        .set({ alertDismissed: true })
        .where(eq(importPayments.id, input.id));
      return { success: true };
    }),

  // ===== ALERT: Reactivate alert (if Larissa needs it back) =====
  reactivateAlert: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(importPayments)
        .set({ alertDismissed: false })
        .where(eq(importPayments.id, input.id));
      return { success: true };
    }),

  // ===== ALERT: Get active payment alerts (arrival date - days_before <= today, not dismissed) =====
  getActiveAlerts: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const payments = await db.select().from(importPayments).orderBy(asc(importPayments.id));
    const suppliers = await db.select().from(importSuppliers)
      .where(or(eq(importSuppliers.context, 'pagamentos'), eq(importSuppliers.context, 'both')))
      .orderBy(asc(importSuppliers.displayOrder));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const alerts: Array<{
      id: number;
      pedido: string;
      supplierName: string;
      sectionTitle: string | null;
      arrivalDate: string;
      alertDaysBefore: number;
      alertDate: string;
      daysRemaining: number;
      totalUsd: string;
      saldoDevedorTotal: string;
    }> = [];
    
    for (const payment of payments) {
      // Only Winnie payments with arrival date + alert days configured + not dismissed
      if (!payment.arrivalDate || !payment.alertDaysBefore || payment.alertDismissed) continue;
      
      // Parse arrival date (format: DD/MM/YYYY or YYYY-MM-DD)
      let arrivalDateObj: Date;
      if (payment.arrivalDate.includes('/')) {
        const [day, month, year] = payment.arrivalDate.split('/');
        arrivalDateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        arrivalDateObj = new Date(payment.arrivalDate);
      }
      
      if (isNaN(arrivalDateObj.getTime())) continue;
      
      // Calculate alert trigger date (arrival - days_before)
      const alertTriggerDate = new Date(arrivalDateObj);
      alertTriggerDate.setDate(alertTriggerDate.getDate() - payment.alertDaysBefore);
      
      // If today >= alert trigger date, show the alert
      if (today >= alertTriggerDate) {
        const diffTime = arrivalDateObj.getTime() - today.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const supplier = suppliers.find(s => s.id === payment.supplierId);
        
        alerts.push({
          id: payment.id,
          pedido: payment.pedido,
          supplierName: supplier?.name || 'Desconhecido',
          sectionTitle: payment.sectionTitle,
          arrivalDate: payment.arrivalDate,
          alertDaysBefore: payment.alertDaysBefore,
          alertDate: alertTriggerDate.toLocaleDateString('pt-BR'),
          daysRemaining,
          totalUsd: payment.totalUsd,
          saldoDevedorTotal: payment.saldoDevedorTotal,
        });
      }
    }
    
    return alerts;
  }),

  // ===== TRACKING (Logcomex integration) =====
  fetchTracking: publicProcedure
    .input(z.object({ trackingUuid: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const response = await fetch(
          `https://backend.logcomex.ai/functions/v1/api-public-workflow-item?itemId=${input.trackingUuid}`
        );
        if (!response.ok) {
          throw new Error(`Logcomex API returned ${response.status}`);
        }
        const data = await response.json();
        const item = data.item;
        if (!item) throw new Error("No tracking data found");

        // Parse logmanager_data for detailed tracking info
        let logmanagerData: any = null;
        if (item.logmanager_data) {
          try {
            logmanagerData = typeof item.logmanager_data === 'string'
              ? JSON.parse(item.logmanager_data)
              : item.logmanager_data;
          } catch (e) {
            // ignore parse errors
          }
        }

        // Extract key info from logmanager_data
        const historic = logmanagerData?.historic || [];
        
        // Extract containers from the logmanager_data.containers object (keyed by container number)
        const containersObj = logmanagerData?.containers || {};
        const containersList = Object.entries(containersObj).map(([num, cData]: [string, any]) => ({
          number: num,
          type: cData?.volume?.type || '',
          sealNumber: cData?.volume?.seal || '',
          grossWeight: cData?.volume?.grossWeight || 0,
          volume: cData?.volume?.volume || 0,
          lastEvent: cData?.movement?.lastEvent || '',
          events: cData?.events || [],
        }));

        // Get vessel coordinates
        const coordinates = logmanagerData?.coordinates || null;
        const vesselLat = logmanagerData?.internationalLogisticVesselLatitude || coordinates?.actualLatitude || null;
        const vesselLng = logmanagerData?.internationalLogisticVesselLongitude || coordinates?.actualLongitude || null;
        const vesselRoute = coordinates?.vesselRoute || [];

        // Determine current status from last occurred event in historic
        const occurredEvents = historic.filter((e: any) => e.hasOccurred);
        const lastEvent = occurredEvents[occurredEvents.length - 1];

        return {
          shipment: logmanagerData?.shipment || logmanagerData?.transportDocument || item.tracking_number || '',
          documentType: logmanagerData?.documentType || 'BL',
          modal: logmanagerData?.modal || 'Maritimo',
          eta: logmanagerData?.eta || item.estimated_delivery || null,
          firstEta: logmanagerData?.firstEta || null,
          predictiveEta: logmanagerData?.predictiveEta || null,
          etd: logmanagerData?.etd || null,
          atd: logmanagerData?.atd || null,
          origin: logmanagerData?.loadingPortName || null,
          originCode: logmanagerData?.loadingPortCode || null,
          destination: logmanagerData?.dischargePortName || null,
          destinationCode: logmanagerData?.dischargePortCode || null,
          carrier: logmanagerData?.carrier || null,
          vessel: logmanagerData?.vessel || null,
          vesselImo: logmanagerData?.vesselImo || null,
          voyage: logmanagerData?.voyage || null,
          currentStatus: logmanagerData?.status || lastEvent?.description || 'Desconhecido',
          translatedStatus: logmanagerData?.translatedStatus || null,
          currentStatusSlug: lastEvent?.eventSlug || '',
          vesselPosition: vesselLat && vesselLng ? { lat: parseFloat(vesselLat), lng: parseFloat(vesselLng) } : null,
          vesselRoute: vesselRoute.length > 0 ? vesselRoute[0] : null,
          vesselRouteCoordinates: vesselRoute.length > 0 && vesselRoute[0]?.coordenates ? vesselRoute[0].coordenates.map((c: any) => ({ lat: parseFloat(c.lat), lng: parseFloat(c.lng) })) : [],
          vesselRouteOrigin: vesselRoute.length > 0 ? vesselRoute[0]?.origin || null : null,
          vesselRouteDestination: vesselRoute.length > 0 ? vesselRoute[0]?.destination || null : null,
          mapUrl: logmanagerData?.mapUrl || null,
          mapAvailable: logmanagerData?.mapAvailable || false,
          containers: containersList,
          historic: historic.map((event: any) => ({
            id: event.id,
            description: event.description,
            eventSlug: event.eventSlug,
            dateTime: event.dateTime,
            location: event.location,
            locationCode: event.locationCode,
            vessel: event.vessel,
            vesselImo: event.vesselImo,
            voyage: event.voyage,
            hasOccurred: event.hasOccurred,
            isCustoms: event.isCustoms,
            translatedDescriptions: event.translatedDescriptions,
          })),
          rawStatus: item.status,
          updatedAt: item.updated_at,
        };
      } catch (error: any) {
        throw new Error(`Erro ao buscar rastreamento: ${error.message}`);
      }
    }),

  // Extract tracking UUID from a Logcomex URL
  parseTrackingUrl: publicProcedure
    .input(z.object({ url: z.string().min(1) }))
    .mutation(async ({ input }) => {
      // Extract UUID from URLs like:
      // https://logcomex.ai/public/workflow-item/1a341f5b-327c-44f6-9411-e100cc022d67
      const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
      const match = input.url.match(uuidRegex);
      if (!match) {
        throw new Error("URL inválida. Cole o link completo da Logcomex.");
      }
      return { uuid: match[1] };
    }),

  // ===== ONE LINE TRACKING (direct carrier tracking) =====
  fetchOneTracking: publicProcedure
    .input(z.object({ blNumber: z.string().min(1) }))
    .query(async ({ input }) => {
      const result = fetchOneTracking(input.blNumber);
      if (!result) {
        throw new Error(`Rastreamento não encontrado para BL ${input.blNumber}. O BL precisa ser cadastrado manualmente no sistema.`);
      }
      // Atualizar cache em background
      try {
        const db = await getDb();
        if (db) {
          const existing = await db.select().from(trackingCache)
            .where(eq(trackingCache.blNumber, input.blNumber.replace(/^ONEY/i, '').trim().toUpperCase()))
            .limit(1);
          const cacheData = {
            blNumber: input.blNumber.replace(/^ONEY/i, '').trim().toUpperCase(),
            trackingSource: 'one_line',
            status: result.currentStatus,
            vesselName: result.sailingLegs[result.sailingLegs.length - 1]?.vessel || null,
            voyageNo: result.sailingLegs[result.sailingLegs.length - 1]?.vesselCode || null,
            origin: result.placeOfReceipt,
            destination: result.placeOfDelivery,
            etd: result.sailingLegs[0]?.departureDate || null,
            eta: result.podArrival,
            progress: result.progress,
            vesselLat: result.vesselPosition ? String(result.vesselPosition.lat) : null,
            vesselLng: result.vesselPosition ? String(result.vesselPosition.lng) : null,
            rawData: JSON.stringify(result),
          };
          if (existing.length > 0) {
            await db.update(trackingCache).set(cacheData).where(eq(trackingCache.id, existing[0].id));
          } else {
            await db.insert(trackingCache).values(cacheData);
          }
        }
      } catch (e) { /* cache update is best-effort */ }
      return result;
    }),

    // ===== FULL DATA (suppliers + payments grouped by section) =====
  getFullData: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const suppliers = await db.select().from(importSuppliers)
      .where(or(eq(importSuppliers.context, 'pagamentos'), eq(importSuppliers.context, 'both')))
      .orderBy(asc(importSuppliers.displayOrder));
    const payments = await db.select().from(importPayments).orderBy(asc(importPayments.id));
    return suppliers.map((supplier) => ({
      ...supplier,
      payments: payments.filter((p) => p.supplierId === supplier.id),
    }));
  }),

  // ===== CUSTO DA MERCADORIA =====
  
  // Lista POs de um fornecedor
  getPosBySupplier: publicProcedure
    .input(z.object({ supplierId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(importPos)
        .where(eq(importPos.supplierId, input.supplierId))
        .orderBy(desc(sql`CAST(SUBSTRING(${importPos.poNumber}, 3) AS UNSIGNED)`));
    }),

  // Lista todos os fornecedores com contagem de POs (apenas contexto 'custo' ou 'both')
  getSuppliersWithPoCount: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const suppliers = await db.select().from(importSuppliers)
      .where(or(eq(importSuppliers.context, 'custo'), eq(importSuppliers.context, 'both')))
      .orderBy(asc(importSuppliers.displayOrder));
    const pos = await db.select().from(importPos);
    return suppliers.map(s => ({
      ...s,
      poCount: pos.filter(p => p.supplierId === s.id).length,
    }));
  }),

  // Lista produtos de uma PO
  getPoProducts: publicProcedure
    .input(z.object({ poId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(importPoProducts)
        .where(eq(importPoProducts.poId, input.poId))
        .orderBy(asc(importPoProducts.id));
    }),

  // Atualizar produto (código, NCM, valores PO cheia/menor)
  updatePoProduct: publicProcedure
    .input(z.object({
      id: z.number(),
      productCode: z.string().optional(),
      ncm: z.string().optional(),
      valorPoCheia: z.string().optional(),
      valorPoMenor: z.string().optional(),
      valorUsd: z.string().optional(),
      quantidade: z.number().nullable().optional(),
      freteMaritimo: z.string().optional(),
      freteTerrestre: z.string().optional(),
      incoterm: z.string().optional(),
      unidCaixa: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      const updateData: Record<string, any> = {};
      if (data.productCode !== undefined) updateData.productCode = data.productCode || null;
      if (data.ncm !== undefined) updateData.ncm = data.ncm || null;
      if (data.valorPoCheia !== undefined) updateData.valorPoCheia = data.valorPoCheia || null;
      if (data.valorPoMenor !== undefined) updateData.valorPoMenor = data.valorPoMenor || null;
      if (data.valorUsd !== undefined) updateData.valorUsd = data.valorUsd || null;
      if (data.quantidade !== undefined) updateData.quantidade = data.quantidade;
      if (data.freteMaritimo !== undefined) updateData.freteMaritimo = data.freteMaritimo || null;
      if (data.freteTerrestre !== undefined) updateData.freteTerrestre = data.freteTerrestre || null;
      if (data.incoterm !== undefined) updateData.incoterm = data.incoterm || null;
      if (data.unidCaixa !== undefined) updateData.unidCaixa = data.unidCaixa || null;
      // Auto-calculate totalFreightUsd
      if (data.freteMaritimo !== undefined || data.freteTerrestre !== undefined) {
        const fm = parseFloat(data.freteMaritimo || '0') || 0;
        const ft = parseFloat(data.freteTerrestre || '0') || 0;
        updateData.totalFreightUsd = String(fm + ft);
      }
      await db.update(importPoProducts).set(updateData).where(eq(importPoProducts.id, id));
      return { success: true };
    }),

  // Buscar produto no estoque pelo código
  getStockProductByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const results = await db.select()
        .from(stockItems)
        .where(eq(stockItems.codigoItem, input.code));
      return results[0] || null;
    }),

  // ===== BUSCA DE PRODUTOS DO ESTOQUE (para seletor) =====
  // Usa product_catalog (tabela persistente que NUNCA deleta produtos)
  searchStockProducts: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const q = input.query.toUpperCase();
      const results = await db.select({
        codigoItem: productCatalog.codigoItem,
        descricaoItem: productCatalog.descricaoItem,
      })
        .from(productCatalog)
        .where(
          sql`(${productCatalog.codigoItem} LIKE ${`%${q}%`} OR UPPER(${productCatalog.descricaoItem}) LIKE ${`%${q}%`})`
        )
        .limit(30);
      return results;
    }),

  // ===== CRIAR PO =====
  createPo: publicProcedure
    .input(z.object({
      supplierId: z.number(),
      poNumber: z.string().min(1),
      containerName: z.string().optional(),
      portoChegada: z.string().nullable().optional(),
      cidadeDesembaraco: z.string().nullable().optional(),
      localFinal: z.string().nullable().optional(),
      pagamento1Remessa: z.string().nullable().optional(),
      pagamento2Remessa: z.string().nullable().optional(),
      pagamento3Remessa: z.string().nullable().optional(),
      taxasRemessa: z.string().nullable().optional(),
      freteTermestreRemessa: z.string().nullable().optional(),
      difalValor: z.string().nullable().optional(),
      comissaoSilverio: z.string().nullable().optional(),
      despesasLiberacaoRemessa: z.string().nullable().optional(),
      valorDolar1Remessa: z.string().nullable().optional(),
      valorDolar2Remessa: z.string().nullable().optional(),
      valorDolar3Remessa: z.string().nullable().optional(),
      valorFreteMaritimoCnBr: z.string().nullable().optional(),
      totalCiRemessa: z.string().nullable().optional(),
      valorTotalProdutosUsdRemessa: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { supplierId, poNumber, containerName, ...logistics } = input;
      const insertData: Record<string, any> = {
        supplierId,
        poNumber,
        containerName: containerName || null,
      };
      for (const [key, value] of Object.entries(logistics)) {
        if (value !== undefined && value !== null && value !== '') {
          insertData[key] = value;
        }
      }
      const [result] = await db.insert(importPos).values(insertData as any);
      return { id: result.insertId };
    }),

  // ===== DELETAR PO =====
  deletePo: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Delete all products in this PO first
      await db.delete(importPoProducts).where(eq(importPoProducts.poId, input.id));
      // Then delete the PO itself
      await db.delete(importPos).where(eq(importPos.id, input.id));
      return { success: true };
    }),

  // ===== ADICIONAR PRODUTO A UMA PO =====
  addPoProduct: publicProcedure
    .input(z.object({
      poId: z.number(),
      description: z.string().min(1),
      productCode: z.string().optional(),
      ncm: z.string().optional(),
      unidCaixa: z.string().optional(),
      valorUsd: z.string().optional(),
      freteMaritimo: z.string().optional(),
      freteTerrestre: z.string().optional(),
      incoterm: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const fm = parseFloat(input.freteMaritimo || '0') || 0;
      const ft = parseFloat(input.freteTerrestre || '0') || 0;
      const [result] = await db.insert(importPoProducts).values({
        poId: input.poId,
        description: input.description,
        productCode: input.productCode || null,
        ncm: input.ncm || null,
        unidCaixa: input.unidCaixa || null,
        valorUsd: input.valorUsd || null,
        freteMaritimo: input.freteMaritimo || null,
        freteTerrestre: input.freteTerrestre || null,
        totalFreightUsd: (fm + ft) > 0 ? String(fm + ft) : null,
        incoterm: input.incoterm || null,
      });
      return { id: result.insertId };
    }),

  // ===== DELETAR PRODUTO DE UMA PO =====
  deletePoProduct: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(importPoProducts).where(eq(importPoProducts.id, input.id));
      return { success: true };
    }),

  // ===== ICMS CONFIG =====
  getIcmsConfig: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { states: [], selectedUf: 'SP' };
    const states = await db.select().from(importIcmsConfig).orderBy(asc(importIcmsConfig.uf));
    const configRows = await db.select().from(importConfig).where(eq(importConfig.configKey, 'selected_uf'));
    const selectedUf = configRows[0]?.configValue || 'SP';
    return { states, selectedUf };
  }),

  updateIcmsRate: publicProcedure
    .input(z.object({ id: z.number(), icmsRate: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(importIcmsConfig)
        .set({ icmsRate: input.icmsRate })
        .where(eq(importIcmsConfig.id, input.id));
      return { success: true };
    }),

  setSelectedUf: publicProcedure
    .input(z.object({ uf: z.string().length(2) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(importConfig)
        .set({ configValue: input.uf })
        .where(eq(importConfig.configKey, 'selected_uf'));
      return { success: true };
    }),

  // ===== VILELA PERCENT =====
  getVilelaPercent: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { percent: 37 };
    const rows = await db.select().from(importConfig).where(eq(importConfig.configKey, 'vilela_percent'));
    return { percent: Number(rows[0]?.configValue || '37') };
  }),

  setVilelaPercent: publicProcedure
    .input(z.object({ percent: z.number().min(0).max(100) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const rows = await db.select().from(importConfig).where(eq(importConfig.configKey, 'vilela_percent'));
      if (rows.length === 0) {
        await db.insert(importConfig).values({ configKey: 'vilela_percent', configValue: String(input.percent) });
      } else {
        await db.update(importConfig)
          .set({ configValue: String(input.percent) })
          .where(eq(importConfig.configKey, 'vilela_percent'));
      }
      return { success: true };
    }),

  // ===== NCM TAXES =====
  getNcmTaxes: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(importNcmTaxes).orderBy(asc(importNcmTaxes.ncm));
  }),

  getNcmTaxByCode: publicProcedure
    .input(z.object({ ncm: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const results = await db.select().from(importNcmTaxes)
        .where(eq(importNcmTaxes.ncm, input.ncm));
      return results[0] || null;
    }),

  createNcmTax: publicProcedure
    .input(z.object({
      ncm: z.string().min(1),
      description: z.string().optional(),
      grupo: z.string().optional(),
      iiRate: z.string(),
      ipiRate: z.string(),
      pisRate: z.string().optional(),
      cofinsRate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(importNcmTaxes).values({
        ncm: input.ncm,
        description: input.description || null,
        grupo: input.grupo || null,
        iiRate: input.iiRate,
        ipiRate: input.ipiRate,
        pisRate: input.pisRate || "2.10",
        cofinsRate: input.cofinsRate || "9.65",
      });
      return { id: result.insertId };
    }),

  updateNcmTax: publicProcedure
    .input(z.object({
      id: z.number(),
      ncm: z.string().optional(),
      description: z.string().optional(),
      grupo: z.string().optional(),
      iiRate: z.string().optional(),
      ipiRate: z.string().optional(),
      pisRate: z.string().optional(),
      cofinsRate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      const updateData: Record<string, any> = {};
      if (data.ncm !== undefined) updateData.ncm = data.ncm;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.grupo !== undefined) updateData.grupo = data.grupo;
      if (data.iiRate !== undefined) updateData.iiRate = data.iiRate;
      if (data.ipiRate !== undefined) updateData.ipiRate = data.ipiRate;
      if (data.pisRate !== undefined) updateData.pisRate = data.pisRate;
      if (data.cofinsRate !== undefined) updateData.cofinsRate = data.cofinsRate;
      await db.update(importNcmTaxes).set(updateData).where(eq(importNcmTaxes.id, id));
      return { success: true };
    }),

  deleteNcmTax: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(importNcmTaxes).where(eq(importNcmTaxes.id, input.id));
      return { success: true };
    }),

  // ===== ATUALIZAR LOGÍSTICA DA PO =====
  updatePoLogistics: publicProcedure
    .input(z.object({
      id: z.number(),
      portoChegada: z.string().nullable().optional(),
      cidadeDesembaraco: z.string().nullable().optional(),
      localFinal: z.string().nullable().optional(),
      pagamento1Remessa: z.string().nullable().optional(),
      pagamento2Remessa: z.string().nullable().optional(),
      pagamento3Remessa: z.string().nullable().optional(),
      taxasRemessa: z.string().nullable().optional(),
      freteTermestreRemessa: z.string().nullable().optional(),
      difalValor: z.string().nullable().optional(),
      comissaoSilverio: z.string().nullable().optional(),
      despesasLiberacaoRemessa: z.string().nullable().optional(),
      valorDolar1Remessa: z.string().nullable().optional(),
      valorDolar2Remessa: z.string().nullable().optional(),
      valorDolar3Remessa: z.string().nullable().optional(),
      valorFreteMaritimoCnBr: z.string().nullable().optional(),
      totalCiRemessa: z.string().nullable().optional(),
      valorTotalProdutosUsdRemessa: z.string().nullable().optional(),
      vilelaValorReal: z.string().nullable().optional(),
      freteOverrideUsd: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      const updateData: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          updateData[key] = value === null || value === '' ? null : value;
        }
      }
      if (Object.keys(updateData).length > 0) {
        await db.update(importPos).set(updateData).where(eq(importPos.id, id));
      }
      return { success: true };
    }),

  // ===== RENOMEAR PO =====
  renamePo: publicProcedure
    .input(z.object({
      id: z.number(),
      poNumber: z.string().optional(),
      containerName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      const updateData: Record<string, any> = {};
      if (data.poNumber !== undefined) updateData.poNumber = data.poNumber || null;
      if (data.containerName !== undefined) updateData.containerName = data.containerName || null;
      if (Object.keys(updateData).length > 0) {
        await db.update(importPos).set(updateData).where(eq(importPos.id, id));
      }
      return { success: true };
    }),

  // ===== NAVIGATION STATUS =====
  updatePoNavigationStatus: publicProcedure
    .input(z.object({
      poId: z.number(),
      navigationStatus: z.enum(['navegando', 'chegou_patio', 'concluida']),
      exchangeRate: z.number().optional(), // Câmbio atual para travar quando concluída
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.update(importPos)
        .set({ navigationStatus: input.navigationStatus })
        .where(eq(importPos.id, input.poId));

      // Quando PO é marcada como "100% Concluído", travar o câmbio:
      // Calcular e salvar valorCaixaBrl para cada produto da PO (se ainda não tem valor fixo)
      if (input.navigationStatus === 'concluida' && input.exchangeRate) {
        const rate = input.exchangeRate;
        
        // Get the PO data
        const [po] = await db.select().from(importPos).where(eq(importPos.id, input.poId));
        if (!po) return { success: true };
        
        // Get products for this PO
        const products = await db.select().from(importPoProducts).where(eq(importPoProducts.poId, input.poId));
        
        // Check if this is a legacy PO (already has valorCaixaBrl from spreadsheet)
        const isLegacy = products.some(p => p.valorCaixaBrl && Number(p.valorCaixaBrl) > 0);
        if (isLegacy) return { success: true }; // Legacy POs already have fixed values
        
        // For new POs: calculate custosTotais and save valorCaixaBrl per product
        // Get vilela config
        const vilelaConfig = await db.select().from(importConfig).where(eq(importConfig.configKey, 'vilela_percent'));
        const vilelaPercent = vilelaConfig.length > 0 ? Number(vilelaConfig[0].configValue) : 37;
        
        // Calculate total costs (same formula as frontend)
        const totalValorReferencia = products.reduce((sum, p) => {
          const valorForn = Number(String(p.valorUsd || 0).replace(',', '.'));
          const qty = Number(p.quantidade || 0);
          return sum + (valorForn * qty);
        }, 0);
        
        const totalFreteCalculado = products.reduce((sum, p) => {
          const valorForn = Number(String(p.valorUsd || 0).replace(',', '.'));
          const valorOrdem = Number(String(p.valorPoCheia || 0).replace(',', '.'));
          const qty = Number(p.quantidade || 0);
          const diff = valorOrdem - valorForn;
          return sum + (diff > 0 ? diff * qty : 0);
        }, 0);
        
        // Despesas Liberação: use vilelaValorReal if set, otherwise estimate
        const totalCi = Number(po.totalCiRemessa || 0);
        const despesasLiberacao = po.vilelaValorReal 
          ? Number(po.vilelaValorReal) 
          : (totalCi * (vilelaPercent / 100));
        
        const freteTerrestreSP = Number(po.freteTermestreRemessa || 0) / rate; // stored in BRL, convert to USD
        const difalVal = Number(po.difalValor || 0) / rate;
        const comSilverio = Number(po.comissaoSilverio || 0) / rate;
        
        const custosTotais = totalValorReferencia + totalFreteCalculado + despesasLiberacao + freteTerrestreSP + difalVal + comSilverio;
        
        // Save valorCaixaBrl for each product
        for (const prod of products) {
          const valorForn = Number(String(prod.valorUsd || 0).replace(',', '.'));
          const qty = Number(prod.quantidade || 0);
          const valorRef = valorForn * qty;
          const percProdutoNoTotal = totalValorReferencia > 0 ? (valorRef / totalValorReferencia) * 100 : 0;
          const valorDaCaixaUsd = qty > 0 ? (custosTotais * (percProdutoNoTotal / 100)) / qty : 0;
          const valorCaixaBrl = valorDaCaixaUsd * rate;
          
          if (valorCaixaBrl > 0) {
            await db.update(importPoProducts)
              .set({ valorCaixaBrl: String(valorCaixaBrl.toFixed(6)) })
              .where(eq(importPoProducts.id, prod.id));
            
            // Also save precoMilUnid if unidCaixa is set
            const unid = Number(prod.unidCaixa || 0);
            if (unid > 0) {
              const precoMilUnid = valorCaixaBrl / unid;
              await db.update(importPoProducts)
                .set({ precoMilUnid: String(precoMilUnid.toFixed(6)) })
                .where(eq(importPoProducts.id, prod.id));
            }
          }
        }
      }
      
      return { success: true };
    }),

  // ===== CÁLCULO DE IMPOSTOS =====
  calculateTaxes: publicProcedure
    .input(z.object({
      ncm: z.string(),
      valorMenorUsd: z.number(), // Valor PO menor em USD (base CIF)
      freteUsd: z.number().optional(), // Frete por produto
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      
      // Get NCM rates
      const ncmResults = await db.select().from(importNcmTaxes)
        .where(eq(importNcmTaxes.ncm, input.ncm));
      if (ncmResults.length === 0) return null;
      const ncmTax = ncmResults[0];
      
      // Get selected UF and its ICMS rate
      const configRows = await db.select().from(importConfig)
        .where(eq(importConfig.configKey, 'selected_uf'));
      const selectedUf = configRows[0]?.configValue || 'SP';
      const icmsRows = await db.select().from(importIcmsConfig)
        .where(eq(importIcmsConfig.uf, selectedUf));
      const icmsRate = icmsRows[0] ? Number(icmsRows[0].icmsRate) / 100 : 0.18;
      
      const iiRate = Number(ncmTax.iiRate) / 100;
      const ipiRate = Number(ncmTax.ipiRate) / 100;
      const pisRate = Number(ncmTax.pisRate) / 100;
      const cofinsRate = Number(ncmTax.cofinsRate) / 100;
      
      // CIF = valor menor (já é o valor da meia nota)
      const cif = input.valorMenorUsd;
      const frete = input.freteUsd || 0;
      
      // II = CIF * alíquota II
      const iiValor = cif * iiRate;
      
      // IPI = (CIF + II) * alíquota IPI
      const ipiValor = (cif + iiValor) * ipiRate;
      
      // PIS = CIF * alíquota PIS
      const pisValor = cif * pisRate;
      
      // COFINS = CIF * alíquota COFINS
      const cofinsValor = cif * cofinsRate;
      
      // ICMS = Base / (1 - alíquota) * alíquota ("por dentro")
      // Base ICMS = CIF + II + IPI + PIS + COFINS + despesas
      const baseIcms = cif + iiValor + ipiValor + pisValor + cofinsValor;
      const icmsValor = (baseIcms / (1 - icmsRate)) * icmsRate;
      
      const totalImpostos = iiValor + ipiValor + pisValor + cofinsValor + icmsValor;
      
      return {
        iiRate: Number(ncmTax.iiRate),
        ipiRate: Number(ncmTax.ipiRate),
        pisRate: Number(ncmTax.pisRate),
        cofinsRate: Number(ncmTax.cofinsRate),
        icmsRate: Number(icmsRows[0]?.icmsRate || 18),
        iiValor: Math.round(iiValor * 100) / 100,
        ipiValor: Math.round(ipiValor * 100) / 100,
        pisValor: Math.round(pisValor * 100) / 100,
        cofinsValor: Math.round(cofinsValor * 100) / 100,
        icmsValor: Math.round(icmsValor * 100) / 100,
        totalImpostos: Math.round(totalImpostos * 100) / 100,
        selectedUf,
      };
    }),

  // ===== CUSTO EM TEMPO REAL =====
  getRealTimeCosts: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    // 1. Get all stock items from grupo 20/21 (imported products)
    const stockRows = await db.select({
      codigoItem: stockItems.codigoItem,
      descricaoItem: stockItems.descricaoItem,
      quantidade: stockItems.quantidade,
      unidadeDeVendaFator: stockItems.unidadeDeVendaFator,
    }).from(stockItems).where(
      or(
        eq(stockItems.grupoCodigo, '20'),
        eq(stockItems.grupoCodigo, '21')
      )
    );

    // 2. Get PO products separated by navigation status:
    //    - concluida/recebida = Custo Real (green)
    //    - chegou_patio = Custo Projetado (orange)
    //    - navegando = Estimativa (blue - new)
    const PRECO_MIL_UNID_PRODUCTS = ['00058']; // Products that use preco_mil_unid instead of valor_caixa_brl
    
    const poProductFields = {
      productCode: importPoProducts.productCode,
      quantidade: importPoProducts.quantidade,
      valorCaixaBrl: importPoProducts.valorCaixaBrl,
      precoMilUnid: importPoProducts.precoMilUnid,
      poNumber: importPos.poNumber,
      poId: importPos.id,
      previsaoEntrega: importPos.previsaoEntrega,
    };
    const baseWhere = and(
      sql`${importPoProducts.productCode} IS NOT NULL`,
      sql`${importPoProducts.productCode} != ''`,
      or(
        sql`${importPoProducts.valorCaixaBrl} IS NOT NULL`,
        sql`${importPoProducts.precoMilUnid} IS NOT NULL`
      ),
    );

    // GREEN: POs 100% Concluído (custo real)
    const arrivedPoProducts = await db.select(poProductFields)
      .from(importPoProducts)
      .innerJoin(importPos, eq(importPoProducts.poId, importPos.id))
      .where(and(baseWhere, sql`${importPos.navigationStatus} IN ('concluida', 'recebida')`));

    // ORANGE: POs Chegou no Pátio (custo projetado)
    const patioPoProducts = await db.select(poProductFields)
      .from(importPoProducts)
      .innerJoin(importPos, eq(importPoProducts.poId, importPos.id))
      .where(and(baseWhere, sql`${importPos.navigationStatus} = 'chegou_patio'`));

    // BLUE: POs Navegando (estimativa)
    const navegandoPoProducts = await db.select(poProductFields)
      .from(importPoProducts)
      .innerJoin(importPos, eq(importPoProducts.poId, importPos.id))
      .where(and(baseWhere, sql`${importPos.navigationStatus} = 'navegando'`));

    // Helper: sort PO entries by arrival date (oldest first for FIFO)
    const sortByArrival = (a: { previsaoEntrega: string | null }, b: { previsaoEntrega: string | null }) => {
      const da = a.previsaoEntrega ? new Date(a.previsaoEntrega).getTime() : 0;
      const db2 = b.previsaoEntrega ? new Date(b.previsaoEntrega).getTime() : 0;
      return da - db2; // oldest first
    };

    // Helper: get the effective cost for a product (preco_mil_unid for 00058, valor_caixa_brl for others)
    const getEffectiveCost = (code: string, valorCaixaBrl: any, precoMilUnid: any): number => {
      if (PRECO_MIL_UNID_PRODUCTS.includes(code)) {
        const milCost = Number(precoMilUnid || 0);
        return milCost > 0 ? milCost : Number(valorCaixaBrl || 0);
      }
      return Number(valorCaixaBrl || 0);
    };

    // 4. Group arrived PO products by product_code, sorted oldest first (FIFO)
    const arrivedByProduct: Record<string, Array<{ poNumber: string; quantidade: number; valorCaixaBrl: number; previsaoEntrega: string | null }>> = {};
    for (const pp of arrivedPoProducts) {
      const code = pp.productCode!;
      const effectiveCost = getEffectiveCost(code, pp.valorCaixaBrl, pp.precoMilUnid);
      if (effectiveCost <= 0) continue; // Skip entries without valid cost
      if (!arrivedByProduct[code]) arrivedByProduct[code] = [];
      arrivedByProduct[code].push({
        poNumber: pp.poNumber,
        quantidade: Number(pp.quantidade || 0),
        valorCaixaBrl: effectiveCost, // For 00058 this is actually preco_mil_unid
        previsaoEntrega: pp.previsaoEntrega,
      });
    }
    // Sort each product's POs by arrival date (oldest first)
    for (const code of Object.keys(arrivedByProduct)) {
      arrivedByProduct[code].sort(sortByArrival);
    }

    // 5. Group PATIO PO products by product_code (for projected/orange)
    const patioByProduct: Record<string, Array<{ poNumber: string; quantidade: number; valorCaixaBrl: number; previsaoEntrega: string | null }>> = {};
    for (const pp of patioPoProducts) {
      const code = pp.productCode!;
      const effectiveCost = getEffectiveCost(code, pp.valorCaixaBrl, pp.precoMilUnid);
      if (effectiveCost <= 0) continue;
      if (!patioByProduct[code]) patioByProduct[code] = [];
      patioByProduct[code].push({
        poNumber: pp.poNumber,
        quantidade: Number(pp.quantidade || 0),
        valorCaixaBrl: effectiveCost,
        previsaoEntrega: pp.previsaoEntrega,
      });
    }
    for (const code of Object.keys(patioByProduct)) {
      patioByProduct[code].sort(sortByArrival);
    }

    // 6. Group NAVEGANDO PO products by product_code (for estimativa/blue)
    const navegandoByProduct: Record<string, Array<{ poNumber: string; quantidade: number; valorCaixaBrl: number; previsaoEntrega: string | null }>> = {};
    for (const pp of navegandoPoProducts) {
      const code = pp.productCode!;
      const effectiveCost = getEffectiveCost(code, pp.valorCaixaBrl, pp.precoMilUnid);
      if (effectiveCost <= 0) continue;
      if (!navegandoByProduct[code]) navegandoByProduct[code] = [];
      navegandoByProduct[code].push({
        poNumber: pp.poNumber,
        quantidade: Number(pp.quantidade || 0),
        valorCaixaBrl: effectiveCost,
        previsaoEntrega: pp.previsaoEntrega,
      });
    }
    for (const code of Object.keys(navegandoByProduct)) {
      navegandoByProduct[code].sort(sortByArrival);
    }

    // 7. Calculate FIFO-based cost for each stock item
    const results = [];
    for (const item of stockRows) {
      const code = item.codigoItem;
      const arrivedHistory = arrivedByProduct[code];
      const patioHistory = patioByProduct[code];
      const navegandoHistory = navegandoByProduct[code];
      if ((!arrivedHistory || arrivedHistory.length === 0) && (!patioHistory || patioHistory.length === 0) && (!navegandoHistory || navegandoHistory.length === 0)) continue;

      const fator = Number(item.unidadeDeVendaFator || 1);
      const stockUnits = Number(item.quantidade || 0);
      const boxesInStock = fator > 0 ? stockUnits / fator : 0;

      // --- GREEN COLUMN: Custo Real - POs 100% Concluído (FIFO) ---
      let custoReal = 0;
      let breakdownReal: Array<{ poNumber: string; caixasUsadas: number; valorCaixa: number }> = [];
      let semEstoque = false;

      if (!arrivedHistory || arrivedHistory.length === 0) {
        custoReal = 0;
        semEstoque = boxesInStock <= 0;
      } else if (boxesInStock <= 0) {
        const lastPo = arrivedHistory[arrivedHistory.length - 1];
        custoReal = lastPo.valorCaixaBrl;
        breakdownReal = [{ poNumber: lastPo.poNumber, caixasUsadas: 0, valorCaixa: lastPo.valorCaixaBrl }];
        semEstoque = true;
      } else {
        const totalArrived = arrivedHistory.reduce((sum, po) => sum + po.quantidade, 0);
        const sold = Math.max(0, totalArrived - boxesInStock);
        let toAbate = sold;
        const remainingPOs: Array<{ poNumber: string; quantidade: number; valorCaixaBrl: number }> = [];
        for (const po of arrivedHistory) {
          if (toAbate >= po.quantidade) {
            toAbate -= po.quantidade;
          } else {
            remainingPOs.push({ poNumber: po.poNumber, quantidade: po.quantidade - toAbate, valorCaixaBrl: po.valorCaixaBrl });
            toAbate = 0;
          }
        }
        let totalCost = 0;
        let totalBoxes = 0;
        for (const po of remainingPOs) {
          const used = Math.min(po.quantidade, boxesInStock - totalBoxes);
          if (used <= 0) break;
          totalCost += used * po.valorCaixaBrl;
          totalBoxes += used;
          breakdownReal.push({ poNumber: po.poNumber, caixasUsadas: Math.round(used * 100) / 100, valorCaixa: po.valorCaixaBrl });
        }
        custoReal = totalBoxes > 0 ? totalCost / totalBoxes : 0;
      }

      // --- ORANGE COLUMN: Custo Projetado - POs "Chegou no Pátio" ---
      // Se não tem nada no pátio, projetado = custo real
      // Se tem coisa no pátio, faz média ponderada (estoque + pátio)
      let custoProjetado = custoReal; // default = custo real
      let breakdownProjetado: Array<{ poNumber: string; caixasUsadas: number; valorCaixa: number }> = [];

      if (patioHistory && patioHistory.length > 0) {
        const currentStockCost = custoReal * boxesInStock;
        let totalPatioQty = 0;
        let totalPatioCost = 0;
        for (const po of patioHistory) {
          totalPatioQty += po.quantidade;
          totalPatioCost += po.quantidade * po.valorCaixaBrl;
          breakdownProjetado.push({ poNumber: po.poNumber, caixasUsadas: Math.round(po.quantidade * 100) / 100, valorCaixa: po.valorCaixaBrl });
        }
        const totalProjectedBoxes = boxesInStock + totalPatioQty;
        custoProjetado = totalProjectedBoxes > 0 ? (currentStockCost + totalPatioCost) / totalProjectedBoxes : custoReal;
      }

      // --- BLUE COLUMN: Estimativa - POs "Navegando" ---
      let custoEstimativa = 0;
      let breakdownEstimativa: Array<{ poNumber: string; caixasUsadas: number; valorCaixa: number }> = [];

      if (navegandoHistory && navegandoHistory.length > 0) {
        // Estimativa = custo projetado (ou real se não tem patio) + navegando
        const baseCost = custoProjetado > 0 ? custoProjetado : custoReal;
        const baseBoxes = custoProjetado > 0
          ? boxesInStock + (patioHistory?.reduce((s, p) => s + p.quantidade, 0) || 0)
          : boxesInStock;
        const baseTotal = baseCost * baseBoxes;
        let totalNavQty = 0;
        let totalNavCost = 0;
        for (const po of navegandoHistory) {
          totalNavQty += po.quantidade;
          totalNavCost += po.quantidade * po.valorCaixaBrl;
          breakdownEstimativa.push({ poNumber: po.poNumber, caixasUsadas: Math.round(po.quantidade * 100) / 100, valorCaixa: po.valorCaixaBrl });
        }
        const totalEstimativaBoxes = baseBoxes + totalNavQty;
        custoEstimativa = totalEstimativaBoxes > 0 ? (baseTotal + totalNavCost) / totalEstimativaBoxes : 0;
      }

      results.push({
        codigoItem: code,
        descricao: item.descricaoItem,
        caixasEstoque: Math.round(boxesInStock * 100) / 100,
        custoReal: Math.round(custoReal * 100) / 100,
        custoProjetado: Math.round(custoProjetado * 100) / 100,
        custoEstimativa: Math.round(custoEstimativa * 100) / 100,
        breakdownReal,
        breakdownProjetado,
        breakdownEstimativa,
        semEstoque,
        temPatio: !!(patioHistory && patioHistory.length > 0),
        temNavegando: !!(navegandoHistory && navegandoHistory.length > 0),
      });
    }

    // Sort by product code
    results.sort((a, b) => a.codigoItem.localeCompare(b.codigoItem, undefined, { numeric: true }));
    return results;
  }),

  // ===== UPLOAD DOCUMENTO DA PO (CI ou Ordem de Pagamento) =====
  uploadPoDocument: publicProcedure
    .input(z.object({
      poId: z.number(),
      type: z.enum(['ci', 'ordemPagamento']), // 'ci' -> pdfUrl, 'ordemPagamento' -> pdfNotaCheiaUrl
      fileBase64: z.string(), // base64-encoded file content
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { storagePut } = await import("./storage");
      const buffer = Buffer.from(input.fileBase64, 'base64');
      const ext = input.fileName.split('.').pop() || 'pdf';
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `po-docs/${input.poId}/${input.type}/${Date.now()}-${safeName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      // Update the PO record
      const field = input.type === 'ci' ? 'pdfUrl' : 'pdfNotaCheiaUrl';
      await db.update(importPos).set({ [field]: url }).where(eq(importPos.id, input.poId));
      return { url, field };
    }),

  // ===== REMOVER DOCUMENTO DA PO =====
  removePoDocument: publicProcedure
    .input(z.object({
      poId: z.number(),
      type: z.enum(['ci', 'ordemPagamento']),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const field = input.type === 'ci' ? 'pdfUrl' : 'pdfNotaCheiaUrl';
      await db.update(importPos).set({ [field]: null }).where(eq(importPos.id, input.poId));
      return { success: true };
    }),

  // ===== RASTREIO EM CONJUNTO - Containers ativos com dados de rastreamento =====
  getActiveContainers: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    // Get all payments that have tracking info (blNumber or trackingUuid)
    // Keep ALL containers with tracking data on the map until arrival is manually confirmed
    const paymentsWithTracking = await db.select().from(importPayments)
      .where(or(
        and(isNotNull(importPayments.blNumber), ne(importPayments.blNumber, '')),
        and(isNotNull(importPayments.trackingUuid), ne(importPayments.trackingUuid, ''))
      ));

    if (paymentsWithTracking.length === 0) return [];

    // Get all suppliers
    const suppliers = await db.select().from(importSuppliers);
    const supplierMap = new Map(suppliers.map(s => [s.id, s]));

    // Get POs for matching (include all, not just navigating)
    const allPos = await db.select().from(importPos);
    const poMap = new Map(allPos.map(p => [p.id, p]));

    // Get purchase order items from stock module (purchase_order_items)
    // These are linked via referencia field containing the pedido number
    const pedidos = paymentsWithTracking.map(p => p.pedido).filter(Boolean);
    let purchaseProducts: any[] = [];
    if (pedidos.length > 0) {
      // Build search patterns: include the pedido itself and its numeric portion (e.g. '2026-018' from 'ZY2026-018')
      const searchPatterns: string[] = [];
      for (const pedido of pedidos) {
        searchPatterns.push(pedido);
        // Extract numeric portion like '2026-018' from 'ZY2026-018' or 'ZYZ2026-018'
        const numMatch = pedido.match(/(\d{4}-\d+)/);
        if (numMatch) searchPatterns.push(numMatch[1]);
      }
      const uniquePatterns = Array.from(new Set(searchPatterns));
      purchaseProducts = await db.select().from(purchaseOrderItems)
        .where(or(...uniquePatterns.map(pattern => like(purchaseOrderItems.referencia, `%${pattern}%`))));
    }
    // Group purchase products by pedido (try exact match first, then numeric portion)
    const productsByPedido = new Map<string, any[]>();
    for (const prod of purchaseProducts) {
      const ref = prod.referencia || '';
      for (const pedido of pedidos) {
        const numMatch = pedido.match(/(\d{4}-\d+)/);
        if (ref.includes(pedido) || (numMatch && ref.includes(numMatch[1]))) {
          if (!productsByPedido.has(pedido)) productsByPedido.set(pedido, []);
          productsByPedido.get(pedido)!.push(prod);
          break;
        }
      }
    }

    // Also get products from import_po_products (PO module) as fallback
    // These are linked by PO ID which is matched via supplier
    const allPoProducts = await db.select().from(importPoProducts);
    const poProductsByPoId = new Map<number, any[]>();
    for (const prod of allPoProducts) {
      if (!poProductsByPoId.has(prod.poId)) poProductsByPoId.set(prod.poId, []);
      poProductsByPoId.get(prod.poId)!.push(prod);
    }

    // Get cached tracking data
    const cachedTracking = await db.select().from(trackingCache);
    const cacheByBl = new Map(cachedTracking.map(c => [c.blNumber, c]));

    // Build result: group by unique container (blNumber or trackingUuid)
    const containers: Array<{
      id: number;
      supplierName: string;
      containerName: string | null;
      poNumber: string;
      pedido: string;
      blNumber: string | null;
      trackingUuid: string | null;
      rastreio: string | null;
      status: string;
      products: Array<{ description: string; quantidade: number | null; valorUsd: string | null }>;
      // Tracking cache data
      vesselName: string | null;
      origin: string | null;
      destination: string | null;
      etd: string | null;
      eta: string | null;
      progress: number | null;
      vesselLat: string | null;
      vesselLng: string | null;
      trackingStatus: string | null;
    }> = [];

    for (const payment of paymentsWithTracking) {
      const supplier = supplierMap.get(payment.supplierId);
      if (!supplier) continue;

      // PRIORITY 1: Match PO directly by pedido/poNumber (exact match)
      let matchingPo = allPos.find(p => p.poNumber === payment.pedido) || null;

      // PRIORITY 2: If no direct match, find by supplier (also try by supplier name for duplicates)
      if (!matchingPo) {
        let supplierPos = allPos.filter(p => p.supplierId === payment.supplierId);
        if (supplierPos.length === 0 && supplier) {
          // Fallback: match by supplier name (handles duplicate supplier IDs like BETTY-JIDAXIANG)
          const sameNameSupplierIds = suppliers.filter(s => s.name === supplier.name).map(s => s.id);
          supplierPos = allPos.filter(p => sameNameSupplierIds.includes(p.supplierId));
        }
        
        // Match PO: prefer one with 'navegando' status, fallback to first PO
        const navegandoPos = supplierPos.filter(p => p.navigationStatus === 'navegando' || !p.navigationStatus);
        matchingPo = navegandoPos.length > 0 ? navegandoPos[0] : (supplierPos.length > 0 ? supplierPos[0] : null);
      }

      // Skip containers with status "Entregue" - they should not appear on the map
      const paymentStatusLower = payment.status.toLowerCase();
      if (paymentStatusLower.includes('entregue')) continue;

      // Skip if the PO is marked as arrived (chegou_patio, concluida, or legacy recebida)
      // AND the payment status also indicates arrival. If payment status still
      // says 'navegando', keep showing on the map regardless of PO status.
      const isPaymentNavigating = paymentStatusLower.includes('navegando');
      const isPoArrived = matchingPo?.navigationStatus === 'chegou_patio' || matchingPo?.navigationStatus === 'concluida' || matchingPo?.navigationStatus === 'recebida';
      if (isPoArrived && !isPaymentNavigating) continue;

      // Get cached tracking data
      const blClean = payment.blNumber?.replace(/^ONEY/i, '').trim().toUpperCase() || '';
      const cached = blClean ? cacheByBl.get(blClean) : null;

      // Get products from purchase_order_items (stock module)
      let poProducts = productsByPedido.get(payment.pedido) || [];
      
      // Fallback: if no products from stock module, try import_po_products (PO module)
      if (poProducts.length === 0 && matchingPo) {
        const importProducts = poProductsByPoId.get(matchingPo.id) || [];
        poProducts = importProducts.map((p: any) => ({
          descricao: p.description,
          quantidade: p.quantidade,
          valorTotal: p.valorUsd,
        }));
      }

      containers.push({
        id: payment.id,
        supplierName: supplier.name,
        containerName: matchingPo?.containerName || null,
        poNumber: matchingPo?.poNumber || '',
        pedido: payment.pedido,
        blNumber: payment.blNumber || null,
        trackingUuid: payment.trackingUuid || null,
        rastreio: payment.rastreio || null,
        status: payment.status,
        products: poProducts.map((p: any) => ({
          description: p.descricao || p.description || '',
          quantidade: p.quantidade ? parseFloat(p.quantidade) : null,
          valorUsd: p.valorTotal || p.valorUsd || null,
        })),
        vesselName: cached?.vesselName || null,
        origin: cached?.origin || null,
        destination: cached?.destination || null,
        etd: cached?.etd || null,
        eta: cached?.eta || null,
        progress: cached?.progress || null,
        vesselLat: cached?.vesselLat || null,
        vesselLng: cached?.vesselLng || null,
        trackingStatus: cached?.status || null,
      });
    }

    return containers;
  }),

  // ===== PREVISÃO DE ENTREGA (from Maxiprod) =====
  syncPrevisaoEntrega: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Fetch ALL purchase orders from Maxiprod (all states)
    const data = await gql<{ pedidosDeCompra: { totalCount: number; items: any[] } }>(`{
      pedidosDeCompra(take: 200) {
        totalCount
        items {
          numero
          referencia
          entregaPrevistaData
          estado
        }
      }
    }`);

    const maxiprodPOs = data.pedidosDeCompra?.items || [];
    if (maxiprodPOs.length === 0) return { updated: 0 };

    // Get all import_pos from DB
    const allPos = await db.select().from(importPos);

    let updated = 0;
    for (const mpo of maxiprodPOs) {
      const ref = (mpo.referencia || '').toUpperCase();
      const previsao = mpo.entregaPrevistaData || null;
      if (!previsao) continue;

      // Match by extracting PO number from referencia
      // Patterns: "PO55 - COMERCIAL" -> "PO55", "ZYZ2026-018 - COMERCIAL" -> skip (handled by import_payments)
      // Also: "01PH202603 - COMERCIAL" -> "01PH202603"
      const refParts = ref.split(' - ');
      const refCode = refParts[0].trim();

      for (const po of allPos) {
        const poNum = (po.poNumber || '').toUpperCase();
        if (!poNum) continue;

        // Direct match: referencia starts with the PO number
        if (refCode === poNum || refCode === poNum.replace('PO0', 'PO')) {
          if (po.previsaoEntrega !== previsao) {
            await db.update(importPos)
              .set({ previsaoEntrega: previsao })
              .where(eq(importPos.id, po.id));
            updated++;
          }
          break;
        }
      }
    }

    return { updated, totalMaxiprod: maxiprodPOs.length };
  }),

  getPrevisaoEntrega: publicProcedure
    .input(z.object({ supplierId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select({
        id: importPos.id,
        poNumber: importPos.poNumber,
        previsaoEntrega: importPos.previsaoEntrega,
      }).from(importPos)
        .where(eq(importPos.supplierId, input.supplierId));
    }),

  updatePrevisaoEntrega: publicProcedure
    .input(z.object({
      poId: z.number(),
      previsaoEntrega: z.string().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(importPos)
        .set({ previsaoEntrega: input.previsaoEntrega })
        .where(eq(importPos.id, input.poId));
      return { success: true };
    }),
});
