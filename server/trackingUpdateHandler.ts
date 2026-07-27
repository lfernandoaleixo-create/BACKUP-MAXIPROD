import type { Request, Response } from "express";
import { eq, and, isNotNull, ne, or } from "drizzle-orm";
import { getDb } from "./db";
import { importPayments, trackingCache } from "../drizzle/schema";
import { fetchOneTracking } from "./oneTracking";
import { fetchLogcomexAiTracking } from "./logcomexAiTracking";

/**
 * Handler para atualização automática de rastreamento de navios.
 * Chamado via Heartbeat (cron) 2x ao dia: 06:00 e 18:00 Brasília (09:00 e 21:00 UTC).
 * 
 * Busca todos os BLs cadastrados na tabela import_payments e atualiza
 * o cache de rastreamento com dados frescos.
 * 
 * Fontes suportadas:
 * - ONE Line (via dados de rota + cálculo de posição)
 * - Logcomex (via API pública com UUID)
 */
export async function trackingUpdateCronHandler(req: Request, res: Response) {
  try {
    console.log("[Tracking Update] Iniciando atualização diária de rastreamento...");

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Buscar todos os pagamentos com BL number, tracking UUID, ou rastreio (container number)
    const payments = await db.select({
      id: importPayments.id,
      blNumber: importPayments.blNumber,
      trackingUuid: importPayments.trackingUuid,
      rastreio: importPayments.rastreio,
      armador: importPayments.armador,
      status: importPayments.status,
    }).from(importPayments)
      .where(or(
        and(isNotNull(importPayments.blNumber), ne(importPayments.blNumber, '')),
        and(isNotNull(importPayments.trackingUuid), ne(importPayments.trackingUuid, '')),
        and(isNotNull(importPayments.rastreio), ne(importPayments.rastreio, ''))
      ));

    const blPayments = payments.filter(p => p.blNumber);
    const uuidPayments = payments.filter(p => p.trackingUuid && !p.blNumber);
    const aiPayments = payments.filter(p => p.rastreio && p.armador);

    let updatedCount = 0;
    let errorCount = 0;

    // 1. Atualizar BLs da ONE Line
    for (const payment of blPayments) {
      try {
        const trackingData = fetchOneTracking(payment.blNumber!);
        if (trackingData) {
          // Upsert no tracking_cache
          const existing = await db.select().from(trackingCache)
            .where(eq(trackingCache.blNumber, payment.blNumber!))
            .limit(1);

          const cacheData = {
            blNumber: payment.blNumber!,
            trackingSource: 'one_line',
            status: trackingData.currentStatus,
            vesselName: trackingData.sailingLegs[trackingData.sailingLegs.length - 1]?.vessel || null,
            voyageNo: trackingData.sailingLegs[trackingData.sailingLegs.length - 1]?.vesselCode || null,
            origin: trackingData.placeOfReceipt,
            destination: trackingData.placeOfDelivery,
            etd: trackingData.sailingLegs[0]?.departureDate || null,
            eta: trackingData.podArrival,
            progress: (() => {
              // Recalculate progress from ETD/ETA for accuracy
              const etdStr = trackingData.sailingLegs[0]?.departureDate;
              const etaStr = trackingData.podArrival;
              if (etdStr && etaStr) {
                const etdDate = new Date(etdStr);
                const etaDate = new Date(etaStr);
                const now = new Date();
                const total = etaDate.getTime() - etdDate.getTime();
                if (total > 0) {
                  const elapsed = now.getTime() - etdDate.getTime();
                  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
                }
              }
              return trackingData.progress;
            })(),
            vesselLat: trackingData.vesselPosition ? String(trackingData.vesselPosition.lat) : null,
            vesselLng: trackingData.vesselPosition ? String(trackingData.vesselPosition.lng) : null,
            rawData: JSON.stringify(trackingData),
          };

          if (existing.length > 0) {
            await db.update(trackingCache)
              .set(cacheData)
              .where(eq(trackingCache.id, existing[0].id));
          } else {
            await db.insert(trackingCache).values(cacheData);
          }
          updatedCount++;
          console.log(`[Tracking Update] BL ${payment.blNumber} atualizado (ONE Line)`);
        }
      } catch (err) {
        errorCount++;
        console.error(`[Tracking Update] Erro ao atualizar BL ${payment.blNumber}:`, err);
      }
    }

    // 2. Atualizar UUIDs da Logcomex
    for (const payment of uuidPayments) {
      try {
        // Fetch from Logcomex public API
        const response = await fetch(
          `https://backend.logcomex.ai/functions/v1/api-public-workflow-item/${payment.trackingUuid}`
        );
        
        if (response.ok) {
          const data = await response.json();
          const existing = await db.select().from(trackingCache)
            .where(eq(trackingCache.trackingUuid, payment.trackingUuid!))
            .limit(1);

          const cacheData = {
            blNumber: data.blNumber || payment.trackingUuid!,
            trackingSource: 'logcomex',
            trackingUuid: payment.trackingUuid,
            status: data.currentStatus || null,
            vesselName: data.vesselName || null,
            voyageNo: data.voyageNumber || null,
            origin: data.origin || null,
            destination: data.destination || null,
            etd: data.etd || null,
            eta: data.eta || null,
            progress: data.progress || null,
            vesselLat: data.vesselLat ? String(data.vesselLat) : null,
            vesselLng: data.vesselLng ? String(data.vesselLng) : null,
            rawData: JSON.stringify(data),
          };

          if (existing.length > 0) {
            await db.update(trackingCache)
              .set(cacheData)
              .where(eq(trackingCache.id, existing[0].id));
          } else {
            await db.insert(trackingCache).values(cacheData);
          }
          updatedCount++;
          console.log(`[Tracking Update] UUID ${payment.trackingUuid} atualizado (Logcomex)`);
        }
      } catch (err) {
        errorCount++;
        console.error(`[Tracking Update] Erro ao atualizar UUID ${payment.trackingUuid}:`, err);
      }
    }

    // 3. Atualizar containers via Logcomex AI (rastreio + armador)
    // Fallback: if Logcomex fails (e.g. insufficient credits), try ONE Line for ONE armador
    const apiKey = process.env.LOGCOMEX_API_KEY;
    let logcomexCreditsFailed = false;
    if (apiKey && aiPayments.length > 0) {
      console.log(`[Tracking Update] Processando ${aiPayments.length} containers via Logcomex AI...`);
      for (const payment of aiPayments) {
        // Skip containers already delivered
        if (payment.status?.toLowerCase().includes('entregue')) continue;
        
        // If Logcomex credits already failed, skip directly to fallback
        if (logcomexCreditsFailed) {
          // Try ONE Line fallback for ONE armador containers
          if (payment.blNumber && payment.armador?.toUpperCase() === 'ONE') {
            const blClean = payment.blNumber.replace(/^ONEY/i, '').trim().toUpperCase();
            const oneData = fetchOneTracking(blClean);
            if (oneData) {
              const cacheData = {
                blNumber: blClean,
                trackingSource: 'one_line',
                status: oneData.currentStatus,
                vesselName: oneData.sailingLegs[oneData.sailingLegs.length - 1]?.vessel || null,
                voyageNo: oneData.sailingLegs[oneData.sailingLegs.length - 1]?.vesselCode || null,
                origin: oneData.placeOfReceipt,
                destination: oneData.placeOfDelivery,
                etd: oneData.sailingLegs[0]?.departureDate || null,
                eta: oneData.podArrival,
                progress: oneData.progress,
                vesselLat: oneData.vesselPosition ? String(oneData.vesselPosition.lat) : null,
                vesselLng: oneData.vesselPosition ? String(oneData.vesselPosition.lng) : null,
                rawData: JSON.stringify(oneData),
              };
              const existing = await db.select().from(trackingCache)
                .where(eq(trackingCache.blNumber, blClean))
                .limit(1);
              if (existing.length > 0) {
                await db.update(trackingCache).set(cacheData).where(eq(trackingCache.id, existing[0].id));
              } else {
                await db.insert(trackingCache).values(cacheData);
              }
              updatedCount++;
              console.log(`[Tracking Update] Container ${payment.rastreio} atualizado via ONE Line fallback (Logcomex sem créditos)`);
            }
          }
          continue;
        }
        
        try {
          const aiData = await fetchLogcomexAiTracking(
            payment.rastreio!,
            payment.armador!,
            apiKey,
            90000 // 90s timeout per container
          );
          
          // Calculate progress based on ETD→ETA
          let progress: number | null = null;
          if (aiData.etd && aiData.eta) {
            const etdDate = new Date(aiData.etd);
            const etaDate = new Date(aiData.eta);
            const now = new Date();
            const totalDuration = etaDate.getTime() - etdDate.getTime();
            if (totalDuration > 0) {
              const elapsed = now.getTime() - etdDate.getTime();
              progress = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
            }
          }

          // Check if Logcomex AI returned meaningful data (ETA, ETD, events, vessel)
          const hasUsefulData = !!(aiData.etd || aiData.eta || aiData.vessel_name || (aiData.events && aiData.events.length > 0));

          const cacheData = {
            blNumber: payment.rastreio!.trim().toUpperCase(),
            trackingSource: 'logcomex_ai',
            status: aiData.current_status || null,
            vesselName: aiData.vessel_name || null,
            voyageNo: null,
            origin: aiData.origin_port || null,
            destination: aiData.destination_port || null,
            etd: aiData.etd || null,
            eta: aiData.eta || null,
            progress,
            vesselLat: null,
            vesselLng: null,
            rawData: JSON.stringify(aiData),
          };

          // Upsert by container number key
          const containerKey = payment.rastreio!.trim().toUpperCase();
          const existing = await db.select().from(trackingCache)
            .where(eq(trackingCache.blNumber, containerKey))
            .limit(1);

          if (existing.length > 0) {
            // DON'T overwrite existing good data (manual or previous AI) with empty Logcomex response
            const existingHasData = !!(existing[0].eta || existing[0].etd || (existing[0].progress !== null && existing[0].progress > 0));
            if (!hasUsefulData && existingHasData && existing[0].trackingSource !== 'logcomex_ai') {
              console.log(`[Tracking Update] Container ${payment.rastreio}: Logcomex AI retornou dados vazios, mantendo dados existentes (${existing[0].trackingSource})`);
            } else if (hasUsefulData || !existingHasData) {
              await db.update(trackingCache)
                .set(cacheData)
                .where(eq(trackingCache.id, existing[0].id));
            } else {
              // Logcomex returned empty AND existing is also logcomex_ai empty - just update timestamp
              await db.update(trackingCache)
                .set(cacheData)
                .where(eq(trackingCache.id, existing[0].id));
            }
          } else {
            await db.insert(trackingCache).values(cacheData);
          }

          // Also update BL cache entry if payment has BL (only if we have useful data)
          if (payment.blNumber && hasUsefulData) {
            const blClean = payment.blNumber.replace(/^ONEY/i, '').trim().toUpperCase();
            const existingBl = await db.select().from(trackingCache)
              .where(eq(trackingCache.blNumber, blClean))
              .limit(1);
            if (existingBl.length > 0) {
              const existingBlHasData = !!(existingBl[0].eta || existingBl[0].etd || (existingBl[0].progress !== null && existingBl[0].progress > 0));
              // Only overwrite BL entry if we have better data or existing is empty
              if (hasUsefulData || !existingBlHasData) {
                await db.update(trackingCache)
                  .set({ ...cacheData, blNumber: blClean })
                  .where(eq(trackingCache.id, existingBl[0].id));
              }
            }
          }

          updatedCount++;
          console.log(`[Tracking Update] Container ${payment.rastreio} atualizado (Logcomex AI) - ETA: ${aiData.eta || 'N/A'} | Dados úteis: ${hasUsefulData}`);
          
          // Small delay between AI requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err: any) {
          const errMsg = err.message || '';
          // Detect Logcomex credit exhaustion - stop trying Logcomex, use fallbacks
          if (errMsg.includes('créditos') || errMsg.includes('insuficiente') || errMsg.includes('credits')) {
            logcomexCreditsFailed = true;
            console.warn(`[Tracking Update] Logcomex AI sem créditos! Ativando fallback ONE Line para containers restantes.`);
            // Try ONE Line fallback for this container if applicable
            if (payment.blNumber && payment.armador?.toUpperCase() === 'ONE') {
              const blClean = payment.blNumber.replace(/^ONEY/i, '').trim().toUpperCase();
              const oneData = fetchOneTracking(blClean);
              if (oneData) {
                const cacheData = {
                  blNumber: blClean,
                  trackingSource: 'one_line',
                  status: oneData.currentStatus,
                  vesselName: oneData.sailingLegs[oneData.sailingLegs.length - 1]?.vessel || null,
                  voyageNo: oneData.sailingLegs[oneData.sailingLegs.length - 1]?.vesselCode || null,
                  origin: oneData.placeOfReceipt,
                  destination: oneData.placeOfDelivery,
                  etd: oneData.sailingLegs[0]?.departureDate || null,
                  eta: oneData.podArrival,
                  progress: oneData.progress,
                  vesselLat: oneData.vesselPosition ? String(oneData.vesselPosition.lat) : null,
                  vesselLng: oneData.vesselPosition ? String(oneData.vesselPosition.lng) : null,
                  rawData: JSON.stringify(oneData),
                };
                const existingFb = await db.select().from(trackingCache)
                  .where(eq(trackingCache.blNumber, blClean))
                  .limit(1);
                if (existingFb.length > 0) {
                  await db.update(trackingCache).set(cacheData).where(eq(trackingCache.id, existingFb[0].id));
                } else {
                  await db.insert(trackingCache).values(cacheData);
                }
                updatedCount++;
                console.log(`[Tracking Update] Container ${payment.rastreio} atualizado via ONE Line fallback`);
              }
            }
          } else {
            errorCount++;
            console.error(`[Tracking Update] Erro ao atualizar container ${payment.rastreio} via AI:`, errMsg);
          }
        }
      }
    } else if (!apiKey) {
      console.warn('[Tracking Update] LOGCOMEX_API_KEY não configurada, pulando rastreio AI');
    }

    const result = {
      ok: true,
      timestamp: new Date().toISOString(),
      totalBLs: blPayments.length,
      totalUUIDs: uuidPayments.length,
      totalAI: aiPayments.length,
      updated: updatedCount,
      errors: errorCount,
    };

    console.log(`[Tracking Update] Concluído: ${updatedCount} atualizados, ${errorCount} erros`);
    res.json(result);
  } catch (error: any) {
    console.error("[Tracking Update] Erro fatal:", error);
    res.status(500).json({
      error: error.message || "Unknown error",
      stack: error.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
