import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { X, Ship, MapPin, Calendar, Anchor, Package, Clock, CheckCircle2, ArrowRight, Globe, Navigation, ExternalLink } from "lucide-react";

interface TrackingModalProps {
  trackingUuid: string;
  onClose: () => void;
}

export function TrackingModal({ trackingUuid, onClose }: TrackingModalProps) {
  const { data, isLoading, error } = trpc.import.fetchTracking.useQuery(
    { trackingUuid },
    { retry: 1 }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ship className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Rastreamento do Embarque</h2>
              {data && (
                <p className="text-sm text-white/80">{data.shipment} • {data.documentType}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="mt-4 text-gray-500">Buscando dados de rastreamento...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-red-600 font-medium">Erro ao buscar rastreamento</p>
              <p className="text-gray-500 text-sm mt-1">{error.message}</p>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {/* Status Banner */}
              <StatusBanner data={data} />

              {/* Info Cards */}
              <InfoCards data={data} />

              {/* Map */}
              <TrackingMap data={data} />

              {/* Timeline */}
              <EventTimeline events={data.historic} />

              {/* Containers */}
              {data.containers.length > 0 && (
                <ContainersList containers={data.containers} />
              )}

              {/* Logcomex link + last update */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                {data.mapUrl && (
                  <a href={data.mapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700">
                    <ExternalLink className="w-3 h-3" /> Ver no LogManager
                  </a>
                )}
                <p>Última atualização: {data.updatedAt ? new Date(data.updatedAt).toLocaleString("pt-BR") : "N/A"}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBanner({ data }: { data: any }) {
  const getStatusColor = (slug: string, status: string) => {
    const s = (slug + status).toLowerCase();
    if (s.includes("discharged") || s.includes("descarregado") || s.includes("delivered") || s.includes("entregue")) return "bg-green-100 text-green-800 border-green-200";
    if (s.includes("departure") || s.includes("saída") || s.includes("loaded") || s.includes("carregado") || s.includes("navegando")) return "bg-blue-100 text-blue-800 border-blue-200";
    if (s.includes("arrival") || s.includes("chegada")) return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getStatusIcon = (slug: string, status: string) => {
    const s = (slug + status).toLowerCase();
    if (s.includes("discharged") || s.includes("descarregado") || s.includes("delivered") || s.includes("entregue")) return <CheckCircle2 className="w-5 h-5" />;
    if (s.includes("departure") || s.includes("saída") || s.includes("loaded") || s.includes("carregado") || s.includes("navegando")) return <Ship className="w-5 h-5" />;
    if (s.includes("arrival") || s.includes("chegada")) return <Anchor className="w-5 h-5" />;
    return <Globe className="w-5 h-5" />;
  };

  return (
    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${getStatusColor(data.currentStatusSlug, data.currentStatus)}`}>
      {getStatusIcon(data.currentStatusSlug, data.currentStatus)}
      <div>
        <p className="font-semibold text-xs uppercase tracking-wide opacity-70">Status Atual</p>
        <p className="text-lg font-bold">{data.currentStatus}</p>
      </div>
      {data.carrier && (
        <div className="ml-auto text-right">
          <p className="text-xs opacity-70">Armador</p>
          <p className="font-bold text-sm">{data.carrier}</p>
        </div>
      )}
    </div>
  );
}

function InfoCards({ data }: { data: any }) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-gray-50 rounded-xl p-4 border">
        <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
          <MapPin className="w-3.5 h-3.5" />
          <span>Rota</span>
        </div>
        <p className="font-bold text-sm">
          {data.origin || "—"} <ArrowRight className="w-3 h-3 inline mx-1" /> {data.destination || "—"}
        </p>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border">
        <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
          <Ship className="w-3.5 h-3.5" />
          <span>Navio</span>
        </div>
        <p className="font-bold text-sm">{data.vessel || "—"}</p>
        {data.voyage && <p className="text-xs text-gray-500">Voyage: {data.voyage}</p>}
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border">
        <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>Saída (ETD)</span>
        </div>
        <p className="font-bold text-sm">{formatDate(data.etd || data.atd)}</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border">
        <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
          <Clock className="w-3.5 h-3.5" />
          <span>Chegada (ETA)</span>
        </div>
        <p className="font-bold text-sm">{formatDate(data.eta || data.predictiveEta)}</p>
        {data.firstEta && data.firstEta !== data.eta && (
          <p className="text-xs text-amber-600">Original: {formatDate(data.firstEta)}</p>
        )}
      </div>
    </div>
  );
}

function TrackingMap({ data }: { data: any }) {
  // Calculate progress percentage based on events
  const totalEvents = data.historic.length;
  const occurredEvents = data.historic.filter((e: any) => e.hasOccurred).length;
  const progress = totalEvents > 0 ? (occurredEvents / totalEvents) * 100 : 0;

  // Get origin and destination from data
  const originName = data.origin || "Origem";
  const destName = data.destination || "Destino";

  // Build route coordinates for SVG map
  const routeCoords = data.vesselRoute?.coordenates || [];
  const vesselPos = data.vesselPosition;

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <Globe className="w-4 h-4 text-indigo-600" />
        <h3 className="font-bold text-gray-800">Mapa do Embarque</h3>
        {data.mapUrl && (
          <a href={data.mapUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Mapa completo
          </a>
        )}
      </div>

      {/* SVG World Map with Route */}
      {routeCoords.length > 0 ? (
        <div className="relative w-full h-[280px] bg-gradient-to-b from-blue-50 to-blue-100 overflow-hidden">
          <svg viewBox="-180 -90 360 180" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            {/* Simple world outline background */}
            <rect x="-180" y="-90" width="360" height="180" fill="#e8f4fd" />
            
            {/* Grid lines */}
            {[-60, -30, 0, 30, 60].map(lat => (
              <line key={`lat${lat}`} x1="-180" y1={-lat} x2="180" y2={-lat} stroke="#d1e5f0" strokeWidth="0.3" />
            ))}
            {[-120, -60, 0, 60, 120].map(lng => (
              <line key={`lng${lng}`} x1={lng} y1="-90" x2={lng} y2="90" stroke="#d1e5f0" strokeWidth="0.3" />
            ))}

            {/* Route path */}
            <polyline
              points={routeCoords.map((c: any) => `${c.lng},${-c.lat}`).join(' ')}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="0.8"
              strokeDasharray="2,1"
              opacity="0.8"
            />

            {/* Origin point */}
            {routeCoords.length > 0 && (
              <circle cx={routeCoords[0].lng} cy={-routeCoords[0].lat} r="2.5" fill="#22c55e" stroke="white" strokeWidth="0.5" />
            )}

            {/* Destination point */}
            {routeCoords.length > 1 && (
              <circle cx={routeCoords[routeCoords.length - 1].lng} cy={-routeCoords[routeCoords.length - 1].lat} r="2.5" fill="#ef4444" stroke="white" strokeWidth="0.5" />
            )}

            {/* Vessel position */}
            {vesselPos && (
              <>
                <circle cx={vesselPos.lng} cy={-vesselPos.lat} r="3.5" fill="#3b82f6" stroke="white" strokeWidth="0.8" />
                <circle cx={vesselPos.lng} cy={-vesselPos.lat} r="5" fill="none" stroke="#3b82f6" strokeWidth="0.3" opacity="0.5">
                  <animate attributeName="r" from="3.5" to="7" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
              </>
            )}

            {/* Labels */}
            {routeCoords.length > 0 && (
              <text x={routeCoords[0].lng} y={-routeCoords[0].lat - 4} textAnchor="middle" fontSize="3" fill="#166534" fontWeight="bold">{originName}</text>
            )}
            {routeCoords.length > 1 && (
              <text x={routeCoords[routeCoords.length - 1].lng} y={-routeCoords[routeCoords.length - 1].lat - 4} textAnchor="middle" fontSize="3" fill="#991b1b" fontWeight="bold">{destName}</text>
            )}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-2 left-3 flex items-center gap-3 text-[10px] text-gray-600 bg-white/80 rounded px-2 py-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> {originName}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> Posição Atual</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> {destName}</span>
          </div>
        </div>
      ) : (
        /* Fallback: progress bar route */
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between px-4 py-6">
            <div className="flex flex-col items-center z-10">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <p className="mt-2 font-bold text-sm text-gray-800">{originName}</p>
              {data.etd && <p className="text-xs text-gray-500">{new Date(data.etd).toLocaleDateString("pt-BR")}</p>}
            </div>

            <div className="flex-1 mx-4 relative">
              <div className="h-2 bg-gray-200 rounded-full">
                <div
                  className="h-2 bg-gradient-to-r from-green-500 via-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500"
                style={{ left: `${Math.min(progress, 100)}%` }}
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                  <Ship className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${progress >= 100 ? 'bg-green-500' : 'bg-red-500'}`}>
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <p className="mt-2 font-bold text-sm text-gray-800">{destName}</p>
              {data.eta && <p className="text-xs text-gray-500">{new Date(data.eta).toLocaleDateString("pt-BR")}</p>}
            </div>
          </div>

          <div className="text-center">
            <span className="text-sm font-medium text-indigo-600">
              {progress >= 100 ? "✅ Entregue" : `${Math.round(progress)}% concluído`}
            </span>
          </div>
        </div>
      )}

      {/* Progress bar below map */}
      {routeCoords.length > 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 whitespace-nowrap">{originName}</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-2 bg-gradient-to-r from-green-500 via-blue-500 to-indigo-500 rounded-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">{destName}</span>
          </div>
          <p className="text-center text-xs text-indigo-600 font-medium mt-1">
            {progress >= 100 ? "✅ Chegou ao destino" : `${Math.round(progress)}% da viagem concluída`}
          </p>
        </div>
      )}
    </div>
  );
}

function EventTimeline({ events }: { events: any[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayEvents = showAll ? events : events.slice(0, 6);

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getEventIcon = (slug: string, isCustoms: boolean) => {
    if (isCustoms) return "🛃";
    if (slug.includes("empty_to_shipper")) return "📦";
    if (slug.includes("empty_return")) return "📦";
    if (slug.includes("arrival") && slug.includes("first")) return "🏗️";
    if (slug.includes("loaded")) return "⚓";
    if (slug.includes("departure")) return "🚢";
    if (slug.includes("discharged")) return "✅";
    if (slug.includes("delivered")) return "🚛";
    if (slug.includes("manifested")) return "📋";
    if (slug.includes("transshipment")) return "🔄";
    if (slug.includes("arrival")) return "🏁";
    return "📍";
  };

  return (
    <div className="bg-white rounded-xl border p-5">
      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-indigo-600" />
        Timeline de Eventos ({events.length})
      </h3>

      <div className="space-y-0">
        {displayEvents.map((event, index) => (
          <div key={event.id || index} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                event.hasOccurred
                  ? "bg-green-100 border-2 border-green-400"
                  : "bg-gray-100 border-2 border-gray-300 border-dashed"
              }`}>
                {getEventIcon(event.eventSlug, event.isCustoms)}
              </div>
              {index < displayEvents.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[24px] ${
                  event.hasOccurred ? "bg-green-300" : "bg-gray-200 border-dashed"
                }`} />
              )}
            </div>

            <div className={`pb-4 ${!event.hasOccurred ? "opacity-50" : ""}`}>
              <p className="font-medium text-sm text-gray-800">{event.description}</p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{formatDateTime(event.dateTime)}</span>
                {event.location && (
                  <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                    📍 {event.location}
                  </span>
                )}
                {event.vessel && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    🚢 {event.vessel} {event.voyage}
                  </span>
                )}
                {!event.hasOccurred && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    Previsto
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length > 6 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          {showAll ? "Mostrar menos" : `Ver todos (${events.length} eventos)`}
        </button>
      )}
    </div>
  );
}

function ContainersList({ containers }: { containers: any[] }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
        <Package className="w-4 h-4 text-indigo-600" />
        Containers ({containers.length})
      </h3>
      <div className="grid grid-cols-1 gap-3">
        {containers.map((container, i) => (
          <div key={i} className="bg-gray-50 rounded-lg px-4 py-3 border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-indigo-500" />
                <div>
                  <p className="font-mono font-bold text-sm">{container.number}</p>
                  <p className="text-xs text-gray-500">{container.type}</p>
                </div>
              </div>
              <div className="text-right text-xs text-gray-500">
                {container.sealNumber && <p>Lacre: <span className="font-mono">{container.sealNumber}</span></p>}
                {container.grossWeight > 0 && <p>Peso: {container.grossWeight.toLocaleString("pt-BR")} kg</p>}
                {container.volume > 0 && <p>Volume: {container.volume} m³</p>}
              </div>
            </div>
            {container.lastEvent && (
              <p className="mt-2 text-xs text-gray-600 bg-white rounded px-2 py-1 border">
                Último evento: {container.lastEvent}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
