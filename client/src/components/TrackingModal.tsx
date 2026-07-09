import React, { useState, useRef, useCallback, useEffect } from "react";
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
  AlertTriangle,
  Brain,
  FileText,
  Loader2,
} from "lucide-react";

// Support Logcomex UUID, ONE Line BL, and Logcomex AI (container + armador)
interface TrackingModalProps {
  trackingUuid?: string | null;
  blNumber?: string | null;
  containerNumber?: string | null; // For Logcomex AI tracking
  armador?: string | null; // Pre-filled armador for Logcomex AI
  // Contextual info from caller
  poNumber?: string | null;
  supplierName?: string | null;
  products?: Array<{ description: string; quantidade?: number | null }> | null;
  onClose: () => void;
}

export function TrackingModal({ trackingUuid, blNumber, containerNumber, armador: initialArmador, poNumber, supplierName, products, onClose }: TrackingModalProps) {
  // State for Logcomex AI mode (when containerNumber is provided)
  const [selectedArmador, setSelectedArmador] = useState(initialArmador || "");
  const [aiTrackingStarted, setAiTrackingStarted] = useState(!!initialArmador);

  // Determine which mode we're in
  // AI mode is primary when containerNumber is provided (even if BL exists)
  const isAiMode = !!containerNumber;
  const isOneMode = !!blNumber && !containerNumber;
  const isLogcomexMode = !!trackingUuid && !blNumber && !containerNumber;

  // Logcomex UUID query
  const logcomexQuery = trpc.import.fetchTracking.useQuery(
    { trackingUuid: trackingUuid || "" },
    { enabled: isLogcomexMode, retry: 1 }
  );

  // ONE Line query - also fetch when in AI mode if BL is available (for vessel position)
  const oneQuery = trpc.import.fetchOneTracking.useQuery(
    { blNumber: blNumber || "" },
    { enabled: !!blNumber, retry: 1 }
  );

  // CACHE-FIRST: Get cached data instantly (no API call)
  const cacheQuery = trpc.import.getTrackingFromCache.useQuery(
    { container: containerNumber || "" },
    { enabled: isAiMode && !!containerNumber, staleTime: 3 * 60 * 60 * 1000 }
  );

  // Background refresh mutation (fire-and-forget)
  const refreshMutation = trpc.import.refreshLogcomexAi.useMutation();

  // Trigger background refresh when modal opens (fire-and-forget, non-blocking)
  const [refreshTriggered, setRefreshTriggered] = useState(false);
  useEffect(() => {
    if (isAiMode && aiTrackingStarted && selectedArmador && containerNumber && !refreshTriggered) {
      setRefreshTriggered(true);
      refreshMutation.mutate({ container: containerNumber, armador: selectedArmador });
    }
  }, [isAiMode, aiTrackingStarted, selectedArmador, containerNumber, refreshTriggered]);

  // Get armadores list
  const armadoresQuery = trpc.import.getArmadores.useQuery(undefined, {
    enabled: isAiMode,
  });

  // Determine loading/error/data based on mode
  // For AI mode: use cache data (instant), never block on slow API
  const isLoading = isAiMode 
    ? cacheQuery.isLoading 
    : (isOneMode ? oneQuery.isLoading : logcomexQuery.isLoading);
  const error = isAiMode 
    ? (cacheQuery.error && !cacheQuery.data ? cacheQuery.error : null)
    : (isOneMode ? oneQuery.error : logcomexQuery.error);
  const rawData = isAiMode 
    ? (cacheQuery.data || null)
    : (isOneMode ? oneQuery.data : logcomexQuery.data);

  // Normalize data to a common shape for the UI
  let data = rawData ? normalizeTrackingData(rawData, isOneMode, isAiMode) : null;

  // Enrich AI data with ONE Line route (for map display)
  // INTERPOLATE vessel position along route using progress % instead of using ONE Line's position
  // (which often defaults to the destination port)
  if (data && isAiMode && oneQuery.data) {
    const oneRaw = oneQuery.data as any;
    const routeCoords = oneRaw.routeCoordinates || [];
    if (routeCoords.length > 1) {
      data = { ...data, routeCoordinates: routeCoords };
      // Interpolate vessel position along route
      const prog = data.progress;
      if (prog > 0 && prog < 100) {
        const idx = Math.floor((prog / 100) * (routeCoords.length - 1));
        const nextIdx = Math.min(idx + 1, routeCoords.length - 1);
        const segFraction = ((prog / 100) * (routeCoords.length - 1)) - idx;
        data = {
          ...data,
          vesselPosition: {
            lat: routeCoords[idx].lat + (routeCoords[nextIdx].lat - routeCoords[idx].lat) * segFraction,
            lng: routeCoords[idx].lng + (routeCoords[nextIdx].lng - routeCoords[idx].lng) * segFraction,
          },
        };
      } else if (prog >= 100) {
        data = { ...data, vesselPosition: routeCoords[routeCoords.length - 1] };
      } else {
        data = { ...data, vesselPosition: routeCoords[0] };
      }
    } else if (oneRaw.vesselPosition) {
      data = { ...data, vesselPosition: oneRaw.vesselPosition };
    }
  }

  // AI-specific data (executive summary, risk, etc.)
  const aiData = isAiMode && rawData ? rawData as any : null;

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
            <div className={`w-10 h-10 ${isAiMode ? 'bg-purple-600/30 border-purple-500/50' : 'bg-indigo-600/30 border-indigo-500/50'} border rounded-xl flex items-center justify-center`}>
              {isAiMode ? <Brain className="w-5 h-5 text-purple-300" /> : <Ship className="w-5 h-5 text-indigo-300" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isAiMode ? "Rastreamento Inteligente (AI)" : "Rastreamento do Embarque"}
              </h2>
              {data && (
                <p className="text-sm text-slate-400">
                  {data.shipment} • {data.documentType} •{" "}
                  <span className="text-indigo-400">{data.carrier}</span>
                </p>
              )}
              {isAiMode && !data && containerNumber && (
                <p className="text-sm text-slate-400">
                  Container: <span className="text-purple-400 font-mono">{containerNumber}</span>
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
          {/* Contextual Info: PO, Supplier/Chinese contact, Products */}
          {(poNumber || supplierName || (products && products.length > 0)) && (
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {poNumber && (
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-400" />
                    <span className="text-slate-400">PO:</span>
                    <span className="font-bold text-white">{poNumber}</span>
                  </div>
                )}
                {supplierName && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="text-slate-400">Fornecedor:</span>
                    <span className="font-bold text-white">{supplierName}</span>
                  </div>
                )}
              </div>
              {products && products.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Produtos no Container</p>
                  <div className="flex flex-wrap gap-2">
                    {products.map((p, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-slate-700/60 text-slate-200 text-xs px-2.5 py-1 rounded-md">
                        {p.description}
                        {p.quantidade ? <span className="text-slate-400 ml-1">({p.quantidade})</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Mode: Armador selector (if not pre-filled) */}
          {isAiMode && !aiTrackingStarted && (
            <ArmadorSelector
              armadores={armadoresQuery.data || []}
              selectedArmador={selectedArmador}
              onSelect={setSelectedArmador}
              onStart={() => setAiTrackingStarted(true)}
              containerNumber={containerNumber || ""}
            />
          )}

          {/* Loading state */}
          {isLoading && (isAiMode ? aiTrackingStarted : true) && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 border-4 border-indigo-900 border-t-indigo-400 rounded-full animate-spin" />
              <p className="mt-4 text-slate-400">
                {"Carregando dados de rastreamento..."}
              </p>
              {isAiMode && (
                <p className="mt-2 text-xs text-slate-500">
                  Buscando dados do cache...
                </p>
              )}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 bg-red-900/30 border border-red-700/50 rounded-full flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-red-400 font-medium">
                Erro ao buscar rastreamento
              </p>
              <p className="text-slate-500 text-sm mt-1 max-w-md text-center">{error.message}</p>
              {isAiMode && (
                <button
                  onClick={() => { setAiTrackingStarted(false); }}
                  className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}

          {/* No cache data yet for AI mode */}
          {isAiMode && !isLoading && !error && !data && aiTrackingStarted && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-amber-900/30 border border-amber-700/50 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-amber-400" />
              </div>
              <p className="text-amber-400 font-medium">Dados ainda não disponíveis no cache</p>
              <p className="text-slate-500 text-sm mt-1 max-w-md text-center">
                O rastreamento foi solicitado em background. Os dados estarão disponíveis em breve (atualização automática diária às 06:00).
              </p>
              <p className="text-xs text-slate-600 mt-3">Refresh em background: {refreshMutation.isSuccess ? '✓ Iniciado' : refreshMutation.isPending ? 'Processando...' : 'Aguardando...'}</p>
            </div>
          )}

          {/* Data display */}
          {data && (
            <>
              {/* AI Executive Summary & Risk (only for AI mode) */}
              {isAiMode && aiData && (
                <AiInsightsPanel aiData={aiData} />
              )}

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
                {isLogcomexMode ? (
                  <a
                    href={`https://logcomex.ai/public/workflow-item/${trackingUuid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition"
                  >
                    <ExternalLink className="w-3 h-3" /> Ver na Logcomex
                  </a>
                ) : isOneMode ? (
                  <a
                    href={`https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?trakNoParam=${(blNumber || '').replace(/^ONEY/i, '')}&trakNoTpCdParam=B`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition"
                  >
                    <ExternalLink className="w-3 h-3" /> Ver na ONE Line
                  </a>
                ) : isAiMode ? (
                  <span className="flex items-center gap-1 text-purple-400">
                    <Brain className="w-3 h-3" /> Powered by Logcomex AI Agent
                  </span>
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

// ===== ARMADOR SELECTOR (AI Mode) =====

function ArmadorSelector({ armadores, selectedArmador, onSelect, onStart, containerNumber }: {
  armadores: readonly string[] | string[];
  selectedArmador: string;
  onSelect: (v: string) => void;
  onStart: () => void;
  containerNumber: string;
}) {
  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-slate-800/50 rounded-xl border border-purple-700/30 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-purple-600/30 border border-purple-500/50 rounded-xl flex items-center justify-center">
          <Brain className="w-5 h-5 text-purple-300" />
        </div>
        <div>
          <h3 className="font-bold text-white">Rastreamento via Logcomex AI</h3>
          <p className="text-xs text-slate-400">Selecione o armador para rastrear o container <span className="font-mono text-purple-400">{containerNumber}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-5">
        {armadores.map((arm) => (
          <button
            key={arm}
            onClick={() => onSelect(arm)}
            className={`px-3 py-2.5 rounded-lg text-sm font-medium transition border ${
              selectedArmador === arm
                ? "bg-purple-600/40 border-purple-500 text-purple-200 shadow-lg shadow-purple-900/30"
                : "bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600"
            }`}
          >
            {arm}
          </button>
        ))}
      </div>

      <button
        onClick={onStart}
        disabled={!selectedArmador}
        className={`w-full py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
          selectedArmador
            ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/40"
            : "bg-slate-700 text-slate-500 cursor-not-allowed"
        }`}
      >
        <Ship className="w-4 h-4" />
        Rastrear Container
      </button>
    </div>
  );
}

// ===== AI INSIGHTS PANEL =====

function AiInsightsPanel({ aiData }: { aiData: any }) {
  const getRiskStyle = (risk: string) => {
    const r = (risk || "").toLowerCase();
    if (r.includes("alto") || r.includes("high") || r.includes("critical"))
      return { bg: "bg-red-900/30 border-red-600/40", text: "text-red-300", icon: "🔴" };
    if (r.includes("médio") || r.includes("medium") || r.includes("moderate"))
      return { bg: "bg-amber-900/30 border-amber-600/40", text: "text-amber-300", icon: "🟡" };
    if (r.includes("baixo") || r.includes("low"))
      return { bg: "bg-emerald-900/30 border-emerald-600/40", text: "text-emerald-300", icon: "🟢" };
    return { bg: "bg-slate-800/50 border-slate-600/40", text: "text-slate-300", icon: "⚪" };
  };

  const riskStyle = getRiskStyle(aiData.operational_risk || "");

  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      {aiData.executive_summary && (
        <div className="bg-gradient-to-br from-purple-900/20 to-slate-800/30 rounded-xl border border-purple-700/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-purple-400" />
            <h3 className="font-bold text-white text-sm">Resumo Executivo (AI)</h3>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{aiData.executive_summary}</p>
        </div>
      )}

      {/* Risk + Key Data */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Operational Risk */}
        {aiData.operational_risk && (
          <div className={`rounded-xl border p-4 ${riskStyle.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`w-4 h-4 ${riskStyle.text}`} />
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Risco Operacional</span>
            </div>
            <p className={`font-bold text-lg ${riskStyle.text}`}>
              {riskStyle.icon} {aiData.operational_risk}
            </p>
          </div>
        )}

        {/* Booking */}
        {aiData.booking && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Booking</span>
            </div>
            <p className="font-bold text-sm text-white font-mono">{aiData.booking}</p>
          </div>
        )}

        {/* BL Number */}
        {aiData.bl_number && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Bill of Lading</span>
            </div>
            <p className="font-bold text-sm text-white font-mono">{aiData.bl_number}</p>
          </div>
        )}
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

function normalizeTrackingData(raw: any, isOneTracking: boolean, isAiTracking: boolean): NormalizedTrackingData {
  if (isAiTracking) {
    // Logcomex AI Agent data shape
    const events: NormalizedEvent[] = (raw.events || []).map((e: any, i: number) => ({
      id: i,
      description: e.event || e.description || '',
      eventSlug: (e.event || '').toLowerCase().replace(/\s+/g, '_'),
      dateTime: e.date || '',
      location: e.location || '',
      hasOccurred: e.has_occurred !== false,
      isCustoms: (e.event || '').toLowerCase().includes('customs') || (e.event || '').toLowerCase().includes('alfândega'),
      vessel: e.vessel || undefined,
    }));

    // Calculate progress from ETD→ETA elapsed time (more accurate than event ratio)
    let progress = 0;
    if (raw.etd && raw.eta) {
      const etdDate = new Date(raw.etd);
      const etaDate = new Date(raw.eta);
      const now = new Date();
      const totalDuration = etaDate.getTime() - etdDate.getTime();
      if (totalDuration > 0) {
        const elapsed = now.getTime() - etdDate.getTime();
        progress = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
      }
    } else {
      // Fallback to event ratio if no dates available
      const totalEvents = events.length;
      const occurredEvents = events.filter(e => e.hasOccurred).length;
      progress = totalEvents > 0 ? Math.round((occurredEvents / totalEvents) * 100) : 0;
    }

    return {
      shipment: raw.container || raw.bl_number || '',
      documentType: raw.bl_number ? 'BL' : 'Container',
      carrier: raw.carrier || '',
      origin: raw.origin_port || '',
      destination: raw.destination_port || '',
      vessel: raw.vessel_name || '',
      voyage: raw.voyage || '',
      etd: raw.etd || null,
      eta: raw.eta || null,
      currentStatus: raw.current_status || raw.last_event || '',
      currentStatusSlug: (raw.current_status || '').toLowerCase().replace(/\s+/g, '_'),
      progress,
      vesselPosition: null, // Will be enriched with ONE Line data below
      routeCoordinates: [],
      originName: raw.origin_port || 'Origem',
      destName: raw.destination_port || 'Destino',
      transshipments: [],
      events,
      containers: [],
      containerInfo: raw.container ? {
        number: raw.container,
        type: '',
        weight: '',
      } : null,
      sailingLegs: null,
    };
  }

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
    // Logcomex data shape (existing UUID-based)
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
    // Parse date string directly to avoid timezone shift (UTC midnight → previous day in BRT)
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
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
        mapTypeId: "hybrid",
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
          { featureType: "road", stylers: [{ visibility: "off" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
        ],
      });

      if (!routeCoords.length && !vesselPos) return;

      const bounds = new google.maps.LatLngBounds();

      // Draw route polyline
      if (routeCoords.length > 1) {
        const path = routeCoords.map((c) => ({ lat: c.lat, lng: c.lng }));
        new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#6366f1",
          strokeOpacity: 0.8,
          strokeWeight: 3,
          map,
        });
        path.forEach((p) => bounds.extend(p));
      }

      // Origin marker
      if (routeCoords.length > 0) {
        const origin = routeCoords[0];
        new google.maps.Marker({
          position: origin,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#10b981",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
          title: originName,
        });
      }

      // Destination marker
      if (routeCoords.length > 1) {
        const dest = routeCoords[routeCoords.length - 1];
        new google.maps.Marker({
          position: dest,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#ef4444",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
          title: destName,
        });
      }

      // Transshipment markers
      data.transshipments.forEach((ts) => {
        new google.maps.Marker({
          position: { lat: ts.lat, lng: ts.lng },
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: "#f59e0b",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
          title: ts.name,
        });
        bounds.extend({ lat: ts.lat, lng: ts.lng });
      });

      // Vessel position marker (ship icon)
      if (vesselPos) {
        // Use a custom ship marker with label
        new google.maps.Marker({
          position: vesselPos,
          map,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" fill="#4f46e5" stroke="white" stroke-width="1.5"/><text x="14" y="19" text-anchor="middle" font-size="13">🚢</text></svg>`),
            scaledSize: new google.maps.Size(28, 28),
            anchor: new google.maps.Point(14, 14),
          },
          title: "Posição atual do navio",
          zIndex: 999,
        });
        bounds.extend(vesselPos);
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      }
    },
    [routeCoords, vesselPos, originName, destName, data.transshipments]
  );

  // If no route coordinates and no vessel position, show progress bar instead
  if (!routeCoords.length && !vesselPos) {
    return (
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
        <div className="flex items-center gap-2 mb-3">
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
