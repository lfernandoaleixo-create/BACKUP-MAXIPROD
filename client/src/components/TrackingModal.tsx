import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import {
  X,
  Ship,
  MapPin,
  Calendar,
  Anchor,
  Package,
  Clock,
  CheckCircle2,
  ArrowRight,
  Globe,
  Navigation,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// Support both Logcomex UUID and ONE Line BL tracking
interface TrackingModalProps {
  trackingUuid?: string | null;
  blNumber?: string | null;
  onClose: () => void;
}

export function TrackingModal({ trackingUuid, blNumber, onClose }: TrackingModalProps) {
  // Determine which query to use
  const logcomexQuery = trpc.import.fetchTracking.useQuery(
    { trackingUuid: trackingUuid || "" },
    { enabled: !!trackingUuid && !blNumber, retry: 1 }
  );

  const oneQuery = trpc.import.fetchOneTracking.useQuery(
    { blNumber: blNumber || "" },
    { enabled: !!blNumber, retry: 1 }
  );

  const isLoading = blNumber ? oneQuery.isLoading : logcomexQuery.isLoading;
  const error = blNumber ? oneQuery.error : logcomexQuery.error;
  const rawData = blNumber ? oneQuery.data : logcomexQuery.data;

  // Normalize data to a common shape for the UI
  const data = rawData ? normalizeTrackingData(rawData, !!blNumber) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[96vw] max-w-6xl max-h-[92vh] overflow-y-auto bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-700/50 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/30 border border-indigo-500/50 rounded-xl flex items-center justify-center">
              <Ship className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Rastreamento do Embarque
              </h2>
              {data && (
                <p className="text-sm text-slate-400">
                  {data.shipment} • {data.documentType} •{" "}
                  <span className="text-indigo-400">{data.carrier}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition"
          >
            <X className="w-5 h-5 text-slate-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 border-4 border-indigo-900 border-t-indigo-400 rounded-full animate-spin" />
              <p className="mt-4 text-slate-400">
                Buscando dados de rastreamento...
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 bg-red-900/30 border border-red-700/50 rounded-full flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-red-400 font-medium">
                Erro ao buscar rastreamento
              </p>
              <p className="text-slate-500 text-sm mt-1">{error.message}</p>
            </div>
          )}

          {data && (
            <>
              {/* Status + Route Info Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <StatusBanner data={data} />
                <RouteInfoCards data={data} />
              </div>

              {/* Google Maps */}
              <TrackingGoogleMap data={data} />

              {/* Sailing Legs (for ONE tracking) */}
              {data.sailingLegs && data.sailingLegs.length > 0 && (
                <SailingLegs legs={data.sailingLegs} />
              )}

              {/* Timeline + Containers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <EventTimeline events={data.events} />
                {data.containers && data.containers.length > 0 && (
                  <ContainersList containers={data.containers} />
                )}
                {data.containerInfo && !data.containers?.length && (
                  <ContainerInfo info={data.containerInfo} />
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-700/50">
                {trackingUuid && !blNumber ? (
                  <a
                    href={`https://logcomex.ai/public/workflow-item/${trackingUuid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition"
                  >
                    <ExternalLink className="w-3 h-3" /> Ver na Logcomex
                  </a>
                ) : blNumber ? (
                  <a
                    href={`https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?trakNoParam=${blNumber.replace(/^ONEY/i, '')}&trakNoTpCdParam=B`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition"
                  >
                    <ExternalLink className="w-3 h-3" /> Ver na ONE Line
                  </a>
                ) : null}
                <p>
                  Atualizado:{" "}
                  {new Date().toLocaleString("pt-BR")}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== DATA NORMALIZATION =====

interface NormalizedTrackingData {
  shipment: string;
  documentType: string;
  carrier: string;
  origin: string;
  destination: string;
  vessel: string;
  voyage: string;
  etd: string | null;
  eta: string | null;
  currentStatus: string;
  currentStatusSlug: string;
  progress: number;
  vesselPosition: { lat: number; lng: number } | null;
  routeCoordinates: Array<{ lat: number; lng: number }>;
  originName: string;
  destName: string;
  transshipments: Array<{ lat: number; lng: number; name: string }>;
  events: NormalizedEvent[];
  containers: any[];
  containerInfo: { number: string; type: string; weight: string } | null;
  sailingLegs: Array<{ vessel: string; vesselCode: string; portOfLoading: string; departureDate: string; portOfDischarging: string; arrivalTime: string }> | null;
}

interface NormalizedEvent {
  id: string | number;
  description: string;
  eventSlug: string;
  dateTime: string;
  location: string;
  hasOccurred: boolean;
  isCustoms: boolean;
  vessel?: string;
}

function normalizeTrackingData(raw: any, isOneTracking: boolean): NormalizedTrackingData {
  if (isOneTracking) {
    // ONE Line data shape
    return {
      shipment: raw.blNumber || raw.bookingRef || '',
      documentType: 'BL',
      carrier: 'ONE (Ocean Network Express)',
      origin: raw.placeOfReceipt || raw.origin?.name || '',
      destination: raw.placeOfDelivery || raw.destination?.name || '',
      vessel: raw.sailingLegs?.[raw.sailingLegs.length - 1]?.vessel || '',
      voyage: raw.sailingLegs?.[raw.sailingLegs.length - 1]?.vesselCode || '',
      etd: raw.sailingLegs?.[0]?.departureDate || null,
      eta: raw.podArrival || null,
      currentStatus: raw.currentStatus || raw.latestEvent || '',
      currentStatusSlug: (raw.currentStatus || '').toLowerCase().replace(/\s+/g, '_'),
      progress: raw.progress || 0,
      vesselPosition: raw.vesselPosition || null,
      routeCoordinates: raw.routeCoordinates || [],
      originName: raw.origin?.name || 'Origem',
      destName: raw.destination?.name || 'Destino',
      transshipments: raw.transshipments || [],
      events: (raw.events || []).map((e: any, i: number) => ({
        id: i,
        description: e.description,
        eventSlug: (e.description || '').toLowerCase().replace(/\s+/g, '_'),
        dateTime: e.date,
        location: e.location || '',
        hasOccurred: e.hasOccurred,
        isCustoms: false,
        vessel: e.vessel,
      })),
      containers: [],
      containerInfo: raw.containerNo ? {
        number: raw.containerNo,
        type: raw.containerType || '',
        weight: raw.containerWeight || '',
      } : null,
      sailingLegs: raw.sailingLegs || null,
    };
  } else {
    // Logcomex data shape (existing)
    return {
      shipment: raw.shipment || '',
      documentType: raw.documentType || 'BL',
      carrier: raw.carrier || '',
      origin: raw.origin || '',
      destination: raw.destination || '',
      vessel: raw.vessel || '',
      voyage: raw.voyage || '',
      etd: raw.etd || raw.atd || null,
      eta: raw.eta || raw.predictiveEta || null,
      currentStatus: raw.currentStatus || '',
      currentStatusSlug: raw.currentStatusSlug || '',
      progress: raw.historic ? Math.round((raw.historic.filter((e: any) => e.hasOccurred).length / raw.historic.length) * 100) : 0,
      vesselPosition: raw.vesselPosition || null,
      routeCoordinates: raw.vesselRouteCoordinates || [],
      originName: raw.vesselRouteOrigin || raw.origin || 'Origem',
      destName: raw.vesselRouteDestination || raw.destination || 'Destino',
      transshipments: [],
      events: (raw.historic || []).map((e: any) => ({
        id: e.id,
        description: e.description,
        eventSlug: e.eventSlug || '',
        dateTime: e.dateTime,
        location: e.location || '',
        hasOccurred: e.hasOccurred,
        isCustoms: e.isCustoms || false,
        vessel: e.vessel,
      })),
      containers: raw.containers || [],
      containerInfo: null,
      sailingLegs: null,
    };
  }
}

// ===== SUB-COMPONENTS =====

function StatusBanner({ data }: { data: NormalizedTrackingData }) {
  const getStatusStyle = (slug: string, status: string) => {
    const s = (slug + status).toLowerCase();
    if (s.includes("discharged") || s.includes("descarregado") || s.includes("delivered") || s.includes("entregue") || s.includes("liberado"))
      return { bg: "bg-emerald-900/30 border-emerald-600/40", text: "text-emerald-300", icon: <CheckCircle2 className="w-5 h-5" /> };
    if (s.includes("departure") || s.includes("saída") || s.includes("partida") || s.includes("loaded") || s.includes("carregado") || s.includes("navegando") || s.includes("trânsito"))
      return { bg: "bg-blue-900/30 border-blue-600/40", text: "text-blue-300", icon: <Ship className="w-5 h-5" /> };
    if (s.includes("arrival") || s.includes("chegada"))
      return { bg: "bg-amber-900/30 border-amber-600/40", text: "text-amber-300", icon: <Anchor className="w-5 h-5" /> };
    return { bg: "bg-slate-800/50 border-slate-600/40", text: "text-slate-300", icon: <Globe className="w-5 h-5" /> };
  };

  const style = getStatusStyle(data.currentStatusSlug, data.currentStatus);

  return (
    <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${style.bg}`}>
      <div className={style.text}>{style.icon}</div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Status Atual</p>
        <p className={`text-base font-bold ${style.text}`}>{data.currentStatus}</p>
      </div>
    </div>
  );
}

function RouteInfoCards({ data }: { data: NormalizedTrackingData }) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-slate-800/50 rounded-xl p-3.5 border border-slate-700/50">
        <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase tracking-wider mb-1">
          <MapPin className="w-3 h-3" /><span>Rota</span>
        </div>
        <p className="font-bold text-sm text-white">
          {data.originName} <ArrowRight className="w-3 h-3 inline mx-0.5 text-indigo-400" /> {data.destName}
        </p>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-3.5 border border-slate-700/50">
        <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase tracking-wider mb-1">
          <Ship className="w-3 h-3" /><span>Navio</span>
        </div>
        <p className="font-bold text-sm text-white">{data.vessel || "—"}</p>
        {data.voyage && <p className="text-[10px] text-slate-500">Voyage: {data.voyage}</p>}
      </div>

      <div className="bg-slate-800/50 rounded-xl p-3.5 border border-slate-700/50">
        <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase tracking-wider mb-1">
          <Calendar className="w-3 h-3" /><span>Saída (ETD)</span>
        </div>
        <p className="font-bold text-sm text-white">{formatDate(data.etd)}</p>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-3.5 border border-slate-700/50">
        <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase tracking-wider mb-1">
          <Clock className="w-3 h-3" /><span>Chegada (ETA)</span>
        </div>
        <p className="font-bold text-sm text-white">{formatDate(data.eta)}</p>
      </div>
    </div>
  );
}

function TrackingGoogleMap({ data }: { data: NormalizedTrackingData }) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const routeCoords = data.routeCoordinates;
  const vesselPos = data.vesselPosition;
  const originName = data.originName;
  const destName = data.destName;
  const progress = data.progress;

  const handleMapReady = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      // Set dark map style
      map.setOptions({
        mapTypeId: "roadmap",
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
          { featureType: "road", stylers: [{ visibility: "off" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
          { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
          { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
        ],
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "cooperative",
      });

      if (routeCoords.length === 0) return;

      // Draw route polyline
      new google.maps.Polyline({
        path: routeCoords,
        map,
        strokeColor: "#312e81",
        strokeOpacity: 0.6,
        strokeWeight: 4,
        geodesic: true,
      });

      new google.maps.Polyline({
        path: routeCoords,
        map,
        strokeColor: "#818cf8",
        strokeOpacity: 1,
        strokeWeight: 2,
        geodesic: true,
        icons: [
          {
            icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeWeight: 2, scale: 3 },
            offset: "0",
            repeat: "15px",
          },
        ],
      });

      // Origin marker
      const originEl = document.createElement("div");
      originEl.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div style="background:#10b981;border:3px solid #34d399;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(16,185,129,0.5);">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div style="margin-top:4px;background:#10b981;color:white;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${originName}</div>
        </div>
      `;
      new google.maps.marker.AdvancedMarkerElement({
        map,
        position: routeCoords[0],
        content: originEl,
      });

      // Destination marker
      const destEl = document.createElement("div");
      destEl.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div style="background:#ef4444;border:3px solid #f87171;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(239,68,68,0.5);">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div style="margin-top:4px;background:#ef4444;color:white;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${destName}</div>
        </div>
      `;
      new google.maps.marker.AdvancedMarkerElement({
        map,
        position: routeCoords[routeCoords.length - 1],
        content: destEl,
      });

      // Transshipment markers
      if (data.transshipments && data.transshipments.length > 0) {
        for (const ts of data.transshipments) {
          const tsEl = document.createElement("div");
          tsEl.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;">
              <div style="background:#f59e0b;border:3px solid #fbbf24;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(245,158,11,0.5);">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><circle cx="12" cy="12" r="3"/></svg>
              </div>
              <div style="margin-top:3px;background:#f59e0b;color:white;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${ts.name}</div>
            </div>
          `;
          new google.maps.marker.AdvancedMarkerElement({
            map,
            position: { lat: ts.lat, lng: ts.lng },
            content: tsEl,
          });
        }
      }

      // Vessel position marker (animated pulse)
      if (vesselPos) {
        const vesselEl = document.createElement("div");
        vesselEl.innerHTML = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:40px;height:40px;background:rgba(99,102,241,0.2);border-radius:50%;animation:vesselPulse 2s ease-in-out infinite;"></div>
            <div style="position:absolute;width:28px;height:28px;background:rgba(99,102,241,0.3);border-radius:50%;animation:vesselPulse 2s ease-in-out infinite 0.5s;"></div>
            <div style="position:relative;background:#4f46e5;border:3px solid #a5b4fc;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(79,70,229,0.6);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.14.52-.05.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z" fill="white"/></svg>
            </div>
          </div>
          <style>
            @keyframes vesselPulse {
              0%, 100% { transform: scale(1); opacity: 0.6; }
              50% { transform: scale(1.5); opacity: 0; }
            }
          </style>
        `;
        new google.maps.marker.AdvancedMarkerElement({
          map,
          position: vesselPos,
          content: vesselEl,
        });
      }

      // Fit bounds to show entire route
      const bounds = new google.maps.LatLngBounds();
      routeCoords.forEach((coord) => bounds.extend(coord));
      if (vesselPos) bounds.extend(vesselPos);
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    },
    [routeCoords, vesselPos, originName, destName, data.transshipments]
  );

  // If no route coordinates, show a simple progress bar fallback
  if (routeCoords.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-indigo-400" />
          <h3 className="font-bold text-white text-sm">Progresso da Viagem</h3>
        </div>
        <div className="flex items-center justify-between px-4 py-6">
          <div className="flex flex-col items-center z-10">
            <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg border-2 border-emerald-400">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <p className="mt-2 font-bold text-sm text-white">{data.originName}</p>
          </div>
          <div className="flex-1 mx-4 relative">
            <div className="h-2 bg-slate-700 rounded-full">
              <div
                className="h-2 bg-gradient-to-r from-emerald-500 via-indigo-500 to-indigo-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500"
              style={{ left: `${Math.min(progress, 100)}%` }}
            >
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg border-2 border-indigo-400">
                <Ship className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center z-10">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 ${progress >= 100 ? "bg-emerald-600 border-emerald-400" : "bg-red-600 border-red-400"}`}>
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <p className="mt-2 font-bold text-sm text-white">{data.destName}</p>
          </div>
        </div>
        <p className="text-center text-xs text-indigo-400 font-medium">
          {progress >= 100 ? "Chegou ao destino" : `${progress}% da viagem concluída`}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Map header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-indigo-400" />
          <h3 className="font-bold text-white text-sm">Rota Marítima em Tempo Real</h3>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></span>
            <span className="text-slate-400">{originName}</span>
          </span>
          {data.transshipments.map((ts, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]"></span>
              <span className="text-slate-400">{ts.name}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)] animate-pulse"></span>
            <span className="text-slate-400">Navio</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"></span>
            <span className="text-slate-400">{destName}</span>
          </span>
        </div>
      </div>

      {/* Google Map */}
      <MapView
        className="w-full h-[350px] md:h-[420px]"
        initialCenter={vesselPos || routeCoords[Math.floor(routeCoords.length / 2)]}
        initialZoom={3}
        onMapReady={handleMapReady}
      />

      {/* Progress bar below map */}
      <div className="px-5 py-3 border-t border-slate-700/50">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-emerald-400 font-medium whitespace-nowrap">{originName}</span>
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-1.5 bg-gradient-to-r from-emerald-500 via-indigo-500 to-indigo-400 rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-red-400 font-medium whitespace-nowrap">{destName}</span>
        </div>
        <p className="text-center text-[10px] text-indigo-400 font-medium mt-1">
          {progress >= 100 ? "Chegou ao destino" : `${progress}% da viagem concluída`}
        </p>
      </div>
    </div>
  );
}

function SailingLegs({ legs }: { legs: Array<{ vessel: string; vesselCode: string; portOfLoading: string; departureDate: string; portOfDischarging: string; arrivalTime: string }> }) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
      <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm">
        <Ship className="w-4 h-4 text-indigo-400" />
        Trechos da Viagem ({legs.length})
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {legs.map((leg, i) => (
          <div key={i} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/40">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-indigo-900/50 border border-indigo-700/50 rounded-full flex items-center justify-center text-[10px] font-bold text-indigo-300">
                {i + 1}
              </div>
              <p className="font-bold text-sm text-white">{leg.vessel} <span className="text-slate-500 font-normal">{leg.vesselCode}</span></p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <p className="text-slate-500">Embarque</p>
                <p className="text-white font-medium">{leg.portOfLoading}</p>
                <p className="text-slate-400">{formatDate(leg.departureDate)}</p>
              </div>
              <div>
                <p className="text-slate-500">Descarga</p>
                <p className="text-white font-medium">{leg.portOfDischarging}</p>
                <p className="text-slate-400">{formatDate(leg.arrivalTime)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventTimeline({ events }: { events: NormalizedEvent[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayEvents = showAll ? events : events.slice(0, 6);

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getEventIcon = (slug: string, isCustoms: boolean) => {
    if (isCustoms) return "🛃";
    if (slug.includes("empty") || slug.includes("container_liberado")) return "📦";
    if (slug.includes("entrada") || slug.includes("gate_in")) return "🏗️";
    if (slug.includes("carregado") || slug.includes("loaded")) return "⚓";
    if (slug.includes("partida") || slug.includes("departure")) return "🚢";
    if (slug.includes("chegada") || slug.includes("arrival")) return "🏁";
    if (slug.includes("descarregado") || slug.includes("unloaded") || slug.includes("discharged")) return "✅";
    if (slug.includes("liberado") || slug.includes("delivered") || slug.includes("gate_out")) return "🚛";
    if (slug.includes("transbordo") || slug.includes("transshipment")) return "🔄";
    return "📍";
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
      <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm">
        <Calendar className="w-4 h-4 text-indigo-400" />
        Timeline de Eventos ({events.length})
      </h3>

      <div className="space-y-0 max-h-[400px] overflow-y-auto pr-2">
        {displayEvents.map((event, index) => (
          <div key={event.id || index} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  event.hasOccurred
                    ? "bg-emerald-900/40 border-2 border-emerald-500/60"
                    : "bg-slate-700/50 border-2 border-slate-600 border-dashed"
                }`}
              >
                {getEventIcon(event.eventSlug, event.isCustoms)}
              </div>
              {index < displayEvents.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[20px] ${event.hasOccurred ? "bg-emerald-700/50" : "bg-slate-700"}`} />
              )}
            </div>

            <div className={`pb-3 ${!event.hasOccurred ? "opacity-40" : ""}`}>
              <p className="font-medium text-xs text-white">{event.description}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-slate-500">{formatDateTime(event.dateTime)}</span>
                {event.location && (
                  <span className="text-[10px] text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded">{event.location}</span>
                )}
                {event.vessel && (
                  <span className="text-[10px] text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">{event.vessel}</span>
                )}
                {!event.hasOccurred && (
                  <span className="text-[10px] text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded">Previsto</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length > 6 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition"
        >
          {showAll ? (
            <><ChevronUp className="w-3 h-3" /> Mostrar menos</>
          ) : (
            <><ChevronDown className="w-3 h-3" /> Ver todos ({events.length} eventos)</>
          )}
        </button>
      )}
    </div>
  );
}

function ContainerInfo({ info }: { info: { number: string; type: string; weight: string } }) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
      <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm">
        <Package className="w-4 h-4 text-indigo-400" />
        Container
      </h3>
      <div className="bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-900/40 border border-indigo-700/50 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <p className="font-mono font-bold text-sm text-white">{info.number}</p>
            <p className="text-[10px] text-slate-500">{info.type}</p>
          </div>
        </div>
        {info.weight && (
          <p className="mt-2 text-[10px] text-slate-400">Peso: {info.weight}</p>
        )}
      </div>
    </div>
  );
}

function ContainersList({ containers }: { containers: any[] }) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
      <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm">
        <Package className="w-4 h-4 text-indigo-400" />
        Containers ({containers.length})
      </h3>
      <div className="grid grid-cols-1 gap-2.5">
        {containers.map((container, i) => (
          <div key={i} className="bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-900/40 border border-indigo-700/50 rounded-lg flex items-center justify-center">
                  <Package className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="font-mono font-bold text-sm text-white">{container.number}</p>
                  <p className="text-[10px] text-slate-500">{container.type}</p>
                </div>
              </div>
              <div className="text-right text-[10px] text-slate-400">
                {container.sealNumber && <p>Lacre: <span className="font-mono text-slate-300">{container.sealNumber}</span></p>}
                {container.grossWeight > 0 && <p>Peso: {container.grossWeight.toLocaleString("pt-BR")} kg</p>}
                {container.volume > 0 && <p>Volume: {container.volume} m³</p>}
              </div>
            </div>
            {container.lastEvent && (
              <p className="mt-2 text-[10px] text-slate-400 bg-slate-800/80 rounded px-2 py-1 border border-slate-700/30">
                Último evento: {container.lastEvent}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
