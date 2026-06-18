/**
 * Rastreio em Conjunto - Combined Tracking View
 * Shows all in-transit containers on a single map with ship markers,
 * progress percentages, and hover cards with container details.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import {
  Ship,
  Package,
  Clock,
  Navigation,
  Loader2,
  AlertCircle,
  Globe,
  RefreshCw,
  Anchor,
  CheckCircle2,
} from "lucide-react";

interface ContainerData {
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
  vesselName: string | null;
  origin: string | null;
  destination: string | null;
  etd: string | null;
  eta: string | null;
  progress: number | null;
  vesselLat: string | null;
  vesselLng: string | null;
  trackingStatus: string | null;
}

interface LiveData {
  vesselPosition: { lat: number; lng: number } | null;
  progress: number;
  routeCoordinates: Array<{ lat: number; lng: number }>;
  originName: string;
  originPosition: { lat: number; lng: number } | null;
  destName: string;
  destPosition: { lat: number; lng: number } | null;
  vessel: string;
  eta: string | null;
  currentStatus: string;
}

/**
 * Individual tracker component - fetches live data for ONE container
 * and reports it back via a ref-based callback to avoid re-render loops.
 */
function ContainerTracker({ container, onDataReadyRef }: {
  container: ContainerData;
  onDataReadyRef: React.MutableRefObject<(id: number, data: LiveData) => void>;
}) {
  const logcomexQuery = trpc.import.fetchTracking.useQuery(
    { trackingUuid: container.trackingUuid || "" },
    { enabled: !!container.trackingUuid && !container.blNumber, retry: 1, staleTime: 5 * 60 * 1000 }
  );

  const oneQuery = trpc.import.fetchOneTracking.useQuery(
    { blNumber: container.blNumber || "" },
    { enabled: !!container.blNumber, retry: 1, staleTime: 5 * 60 * 1000 }
  );

  const data = container.blNumber ? oneQuery.data : logcomexQuery.data;
  const isOneTracking = !!container.blNumber;

  // Use a ref to track the last reported data to avoid infinite loops
  const lastReportedRef = useRef<string>("");

  useEffect(() => {
    if (!data) return;

    const d = data as any;
    const vesselPosition = d.vesselPosition || null;

    const progress = isOneTracking
      ? d.progress || 0
      : d.historic
        ? Math.round((d.historic.filter((e: any) => e.hasOccurred).length / d.historic.length) * 100)
        : 0;

    const routeCoordinates = isOneTracking
      ? d.routeCoordinates || []
      : d.vesselRouteCoordinates || [];

    const originName = isOneTracking
      ? d.origin?.name || d.placeOfReceipt || ''
      : d.vesselRouteOrigin || d.origin || '';

    const originPosition = isOneTracking
      ? d.origin ? { lat: d.origin.lat, lng: d.origin.lng } : (routeCoordinates.length > 0 ? routeCoordinates[0] : null)
      : (routeCoordinates.length > 0 ? routeCoordinates[0] : null);

    const destName = isOneTracking
      ? d.destination?.name || d.placeOfDelivery || ''
      : d.vesselRouteDestination || d.destination || '';

    const destPosition = isOneTracking
      ? d.destination ? { lat: d.destination.lat, lng: d.destination.lng } : (routeCoordinates.length > 0 ? routeCoordinates[routeCoordinates.length - 1] : null)
      : (routeCoordinates.length > 0 ? routeCoordinates[routeCoordinates.length - 1] : null);

    const vessel = isOneTracking
      ? d.sailingLegs?.[d.sailingLegs?.length - 1]?.vessel || ''
      : d.vessel || '';

    const eta = isOneTracking
      ? d.podArrival || null
      : d.eta || null;

    const currentStatus = isOneTracking
      ? d.currentStatus || ''
      : d.currentStatus || d.translatedStatus || '';

    const liveData: LiveData = {
      vesselPosition,
      progress,
      routeCoordinates,
      originName,
      originPosition,
      destName,
      destPosition,
      vessel,
      eta,
      currentStatus,
    };

    // Only report if data actually changed (compare a fingerprint)
    const fingerprint = JSON.stringify({
      pos: vesselPosition,
      prog: progress,
      route: routeCoordinates.length,
      vessel,
      eta,
      status: currentStatus,
    });

    if (fingerprint !== lastReportedRef.current) {
      lastReportedRef.current = fingerprint;
      onDataReadyRef.current(container.id, liveData);
    }
  }, [data, container.id, isOneTracking, onDataReadyRef]);

  return null;
}

export function RastreioEmConjunto() {
  const { data: containers, isLoading, error, refetch } = trpc.import.getActiveContainers.useQuery(
    undefined,
    { staleTime: 60 * 1000 }
  );

  const [liveTrackingData, setLiveTrackingData] = useState<Map<number, LiveData>>(new Map());
  const [hoveredContainer, setHoveredContainer] = useState<number | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<number | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const mapReadyRef = useRef(false);

  // Use a ref-based callback to avoid triggering re-renders in ContainerTracker's useEffect deps
  const handleDataReadyRef = useRef<(id: number, data: LiveData) => void>((id, data) => {
    setLiveTrackingData(prev => {
      const next = new Map(prev);
      next.set(id, data);
      return next;
    });
  });

  // Render markers on map when live data changes
  const liveDataSize = liveTrackingData.size;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !containers || !mapReadyRef.current) return;
    if (liveDataSize === 0) return;

    // Clear existing markers and polylines
    markersRef.current.forEach(marker => { marker.map = null; });
    markersRef.current.clear();
    polylinesRef.current.forEach(pl => pl.setMap(null));
    polylinesRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasAnyPosition = false;

    // Color palette for different containers
    const colors = ['#ff6b35', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

    // Track positions to detect overlaps and offset them
    const positionMap = new Map<string, number>();

    containers.forEach((container, index) => {
      const live = liveTrackingData.get(container.id);
      if (!live) return;

      const { vesselPosition, progress, routeCoordinates, originName, originPosition, destName, destPosition } = live;
      const color = colors[index % colors.length];

      // Draw route polyline
      if (routeCoordinates && routeCoordinates.length > 1) {
        const polyline = new google.maps.Polyline({
          path: routeCoordinates,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.7,
          strokeWeight: 3,
          map,
        });
        polylinesRef.current.push(polyline);

        // Add route coordinates to bounds
        routeCoordinates.forEach((coord) => {
          bounds.extend(coord);
          hasAnyPosition = true;
        });
      }

      // Add origin port marker
      if (originPosition) {
        const originEl = document.createElement("div");
        originEl.style.cursor = "default";
        originEl.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="background:${color};border:2px solid white;border-radius:4px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            </div>
            <div style="margin-top:2px;background:${color}dd;color:white;font-size:8px;font-weight:600;padding:1px 4px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);">
              ${originName.split(',')[0] || 'Origem'}
            </div>
          </div>
        `;

        const originMarker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: originPosition,
          content: originEl,
        });
        markersRef.current.set(`origin-${container.id}`, originMarker);
        bounds.extend(originPosition);
        hasAnyPosition = true;
      }

      // Add vessel marker (with offset if overlapping)
      // For delivered containers, show at destination (Santos) with anchor icon
      const isDelivered = container.status === 'Entregue';
      const markerPosition = isDelivered && destPosition ? destPosition : vesselPosition;

      if (markerPosition) {
        const posKey = `${markerPosition.lat.toFixed(1)},${markerPosition.lng.toFixed(1)}`;
        const overlapCount = positionMap.get(posKey) || 0;
        positionMap.set(posKey, overlapCount + 1);

        // Offset overlapping markers slightly
        const offsetLat = overlapCount * 1.5;
        const offsetLng = overlapCount * 1.5;
        const adjustedPosition = {
          lat: markerPosition.lat + offsetLat,
          lng: markerPosition.lng + offsetLng,
        };

        const markerEl = document.createElement("div");
        markerEl.className = "vessel-marker-container";
        markerEl.style.cursor = "pointer";

        if (isDelivered) {
          // Delivered: anchor icon, green color, 'Em Santos' label
          markerEl.innerHTML = `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;transition:transform 0.2s;">
              <div style="position:absolute;width:36px;height:36px;background:#16a34a33;border-radius:50%;"></div>
              <div style="position:relative;background:#16a34a;border:2px solid white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px #16a34a88;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0"><path d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zm-4 2V9H5c-1.1 0-2 .9-2 2v10l4-4h6c1.1 0 2-.9 2-2z" fill="none" stroke="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              </div>
              <div style="margin-top:4px;background:#16a34a;color:white;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);max-width:160px;overflow:hidden;text-overflow:ellipsis;">
                ${container.supplierName} • Em Santos
              </div>
            </div>
          `;
        } else {
          // In transit: ship icon with color
          markerEl.innerHTML = `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;transition:transform 0.2s;">
              <div style="position:absolute;width:36px;height:36px;background:${color}33;border-radius:50%;"></div>
              <div style="position:relative;background:${color};border:2px solid white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px ${color}88;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.14.52-.05.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/></svg>
              </div>
              <div style="margin-top:4px;background:${color};color:white;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);max-width:140px;overflow:hidden;text-overflow:ellipsis;">
                ${container.supplierName} • ${progress || 0}%
              </div>
            </div>
          `;
        }

        // Add hover/click events
        markerEl.addEventListener("mouseenter", () => {
          setHoveredContainer(container.id);
          markerEl.style.transform = "scale(1.2)";
          markerEl.style.zIndex = "1000";
        });
        markerEl.addEventListener("mouseleave", () => {
          setHoveredContainer(null);
          markerEl.style.transform = "scale(1)";
          markerEl.style.zIndex = "";
        });
        markerEl.addEventListener("click", () => {
          setSelectedContainer(prev => prev === container.id ? null : container.id);
        });

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: adjustedPosition,
          content: markerEl,
        });

        markersRef.current.set(`vessel-${container.id}`, marker);
        bounds.extend(adjustedPosition);
        hasAnyPosition = true;
      }

      // Add destination marker (skip for delivered containers since vessel marker is already at dest)
      if (destPosition && !isDelivered) {
        const destEl = document.createElement("div");
        destEl.style.cursor = "default";
        destEl.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="background:#ef4444;border:2px solid white;border-radius:4px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>
            </div>
            <div style="margin-top:2px;background:#ef4444dd;color:white;font-size:8px;font-weight:600;padding:1px 4px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);">
              ${destName.split(',')[0] || 'Destino'}
            </div>
          </div>
        `;

        const destMarker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: destPosition,
          content: destEl,
        });
        markersRef.current.set(`dest-${container.id}`, destMarker);
        bounds.extend(destPosition);
        hasAnyPosition = true;
      }
    });

    // Fit map to show all markers
    if (hasAnyPosition) {
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
      // Don't zoom in too much if only one marker
      const listener = google.maps.event.addListener(map, "idle", () => {
        if (map.getZoom()! > 6) map.setZoom(6);
        google.maps.event.removeListener(listener);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containers, liveDataSize]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    mapReadyRef.current = true;
    map.setOptions({
      mapTypeId: "hybrid",
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
    });
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  // Find the container data for hover/selected card
  const activeCardId = selectedContainer || hoveredContainer;
  const activeContainer = containers?.find(c => c.id === activeCardId);
  const activeLive = activeCardId ? liveTrackingData.get(activeCardId) : null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="mt-4 text-slate-500">Carregando containers em trânsito...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="mt-4 text-red-500 font-medium">Erro ao carregar dados</p>
        <p className="text-slate-500 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  if (!containers || containers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Ship className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700">Nenhum container em trânsito</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-md">
          Quando houver containers com BL ou UUID de rastreamento cadastrados nos pagamentos, eles aparecerão aqui no mapa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-800">Rastreio em Conjunto</h2>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {containers.length} container{containers.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar
        </button>
      </div>

      {/* Map Container */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-lg">
        {/* Map */}
        <MapView
          className="w-full h-[500px] sm:h-[600px]"
          initialCenter={{ lat: 0, lng: 60 }}
          initialZoom={3}
          onMapReady={handleMapReady}
        />

        {/* Live tracking data fetchers (invisible) */}
        {containers.map(container => (
          <ContainerTracker
            key={container.id}
            container={container}
            onDataReadyRef={handleDataReadyRef}
          />
        ))}

        {/* Hover/Selected Card Overlay */}
        {activeContainer && activeLive && (
          <div className="absolute top-4 right-4 w-72 bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl p-4 z-50 pointer-events-auto">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 bg-indigo-600/30 border border-indigo-500/50 rounded-lg flex items-center justify-center shrink-0">
                <Ship className="w-4 h-4 text-indigo-300" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate">{activeContainer.supplierName}</h4>
                <p className="text-[10px] text-slate-400">
                  {activeContainer.containerName || activeContainer.poNumber} • {activeContainer.pedido}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span>{activeLive.originName || activeContainer.origin || '—'}</span>
                <span>{activeLive.destName || activeContainer.destination || '—'}</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: `${activeLive.progress || 0}%` }}
                />
              </div>
              <div className="text-center mt-1">
                <span className="text-xs font-bold text-indigo-300">{activeLive.progress || 0}%</span>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {activeLive.vessel && (
                <div className="bg-slate-800/60 rounded-lg p-2">
                  <span className="text-slate-500 uppercase tracking-wider">Navio</span>
                  <p className="text-white font-medium mt-0.5 truncate">{activeLive.vessel}</p>
                </div>
              )}
              {activeLive.eta && (
                <div className="bg-slate-800/60 rounded-lg p-2">
                  <span className="text-slate-500 uppercase tracking-wider">ETA</span>
                  <p className="text-white font-medium mt-0.5">{formatDate(activeLive.eta)}</p>
                </div>
              )}
              {activeLive.currentStatus && (
                <div className="col-span-2 bg-slate-800/60 rounded-lg p-2">
                  <span className="text-slate-500 uppercase tracking-wider">Status</span>
                  <p className="text-emerald-300 font-medium mt-0.5 truncate">{activeLive.currentStatus}</p>
                </div>
              )}
            </div>

            {/* Products */}
            {activeContainer.products.length > 0 && (
              <div className="mt-3 border-t border-slate-700/50 pt-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Package className="w-3 h-3" /> Produtos ({activeContainer.products.length})
                </p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {activeContainer.products.slice(0, 5).map((prod, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-300 truncate max-w-[160px]">{prod.description}</span>
                      {prod.quantidade && (
                        <span className="text-slate-500 shrink-0 ml-2">{prod.quantidade} cx</span>
                      )}
                    </div>
                  ))}
                  {activeContainer.products.length > 5 && (
                    <p className="text-[9px] text-slate-500 italic">
                      +{activeContainer.products.length - 5} outros produtos
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* BL Number */}
            {activeContainer.blNumber && (
              <div className="mt-2 pt-2 border-t border-slate-700/50">
                <p className="text-[9px] text-slate-500 font-mono">{activeContainer.blNumber}</p>
              </div>
            )}
          </div>
        )}

        {/* Loading overlay for live tracking */}
        {containers.length > 0 && liveTrackingData.size === 0 && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-40">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="mt-3 text-sm text-slate-300">Buscando posições dos navios...</p>
          </div>
        )}
      </div>

      {/* Container List Below Map */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {containers.map((container, index) => {
          const live = liveTrackingData.get(container.id);
          const colors = ['border-orange-500', 'border-cyan-500', 'border-amber-500', 'border-emerald-500', 'border-red-500', 'border-violet-500', 'border-pink-500', 'border-teal-500'];
          const bgColors = ['bg-orange-50', 'bg-cyan-50', 'bg-amber-50', 'bg-emerald-50', 'bg-red-50', 'bg-violet-50', 'bg-pink-50', 'bg-teal-50'];
          const textColors = ['text-orange-700', 'text-cyan-700', 'text-amber-700', 'text-emerald-700', 'text-red-700', 'text-violet-700', 'text-pink-700', 'text-teal-700'];

          return (
            <div
              key={container.id}
              className={`bg-white rounded-xl border-l-4 ${colors[index % colors.length]} border border-slate-200 p-3 hover:shadow-md transition cursor-pointer ${selectedContainer === container.id ? 'ring-2 ring-indigo-300' : ''}`}
              onMouseEnter={() => setHoveredContainer(container.id)}
              onMouseLeave={() => setHoveredContainer(null)}
              onClick={() => {
                setSelectedContainer(prev => prev === container.id ? null : container.id);
                // Pan map to this container's position
                const panPos = container.status === 'Entregue' && live?.destPosition
                  ? live.destPosition
                  : live?.vesselPosition;
                if (panPos && mapRef.current) {
                  mapRef.current.panTo(panPos);
                  mapRef.current.setZoom(5);
                }
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{container.supplierName}</h4>
                  <p className="text-[10px] text-slate-500">
                    {container.containerName || container.poNumber} • {container.pedido}
                  </p>
                </div>
                {container.status === 'Entregue' ? (
                  <div className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Em Santos
                  </div>
                ) : (
                  <div className={`${bgColors[index % bgColors.length]} ${textColors[index % textColors.length]} text-[10px] font-bold px-2 py-0.5 rounded-full`}>
                    {live?.progress || container.progress || 0}%
                  </div>
                )}
              </div>

              {/* Origin → Destination */}
              <div className="flex items-center gap-1 text-[9px] text-slate-400 mb-1.5">
                <span className="font-medium">{live?.originName?.split(',')[0] || container.origin || '—'}</span>
                <span>→</span>
                <span className="font-medium">{live?.destName?.split(',')[0] || container.destination || '—'}</span>
              </div>

              {/* Mini progress bar */}
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${container.status === 'Entregue' ? 'bg-green-500' : 'bg-gradient-to-r from-indigo-500 to-cyan-400'}`}
                  style={{ width: `${container.status === 'Entregue' ? 100 : (live?.progress || container.progress || 0)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Navigation className="w-3 h-3" />
                  {live?.vessel || container.vesselName || '—'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ETA: {formatDate(live?.eta || container.eta)}
                </span>
              </div>

              {live?.currentStatus && (
                <div className="mt-1.5 text-[10px] text-emerald-600 font-medium truncate">
                  {live.currentStatus}
                </div>
              )}

              {/* Products list */}
              {container.products && container.products.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1 mb-1">
                    <Package className="w-3 h-3 text-slate-400" />
                    <span className="text-[9px] font-semibold text-slate-500 uppercase">
                      {container.products.length} {container.products.length === 1 ? 'produto' : 'produtos'}
                    </span>
                  </div>
                  <div className="space-y-0.5 max-h-24 overflow-y-auto">
                    {container.products.map((prod, pIdx) => (
                      <div key={pIdx} className="flex items-center justify-between text-[9px]">
                        <span className="text-slate-600 truncate flex-1 mr-2" title={prod.description}>
                          {prod.description}
                        </span>
                        {prod.quantidade && (
                          <span className="text-slate-800 font-semibold whitespace-nowrap">
                            {Number(prod.quantidade).toLocaleString('pt-BR')} cx
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
