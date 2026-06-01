/**
 * ONE Line (Ocean Network Express) Cargo Tracking Integration
 * 
 * Since ONE's API requires browser session/cookies, we use a combination of:
 * 1. Hardcoded data for known BLs (manually entered from ONE website)
 * 2. A route calculation based on known shipping lanes
 * 
 * In the future, when the user gets Logcomex API access, this can be replaced
 * with direct API calls.
 */

export interface OneTrackingEvent {
  date: string;
  location: string;
  terminal: string;
  description: string;
  vessel?: string;
  hasOccurred: boolean;
}

export interface OneSailingLeg {
  vessel: string;
  vesselCode: string;
  portOfLoading: string;
  departureDate: string;
  portOfDischarging: string;
  arrivalTime: string;
}

export interface OneTrackingResult {
  blNumber: string;
  bookingRef: string;
  containerNo: string;
  containerType: string;
  containerWeight: string;
  placeOfReceipt: string;
  placeOfDelivery: string;
  latestEvent: string;
  latestEventTime: string;
  podArrival: string;
  sailingLegs: OneSailingLeg[];
  events: OneTrackingEvent[];
  currentStatus: string;
  progress: number;
  vesselPosition: { lat: number; lng: number } | null;
  routeCoordinates: Array<{ lat: number; lng: number }>;
  origin: { lat: number; lng: number; name: string };
  destination: { lat: number; lng: number; name: string };
  transshipments: Array<{ lat: number; lng: number; name: string }>;
}

// Known shipping routes (coordinates for common lanes)
const ROUTE_XIAMEN_SINGAPORE: Array<{ lat: number; lng: number }> = [
  { lat: 24.47, lng: 118.08 }, // Xiamen
  { lat: 22.5, lng: 116.0 },
  { lat: 18.0, lng: 113.0 },
  { lat: 12.0, lng: 110.0 },
  { lat: 7.0, lng: 107.0 },
  { lat: 3.0, lng: 105.0 },
  { lat: 1.26, lng: 103.85 }, // Singapore
];

const ROUTE_SINGAPORE_SANTOS: Array<{ lat: number; lng: number }> = [
  { lat: 1.26, lng: 103.85 }, // Singapore
  { lat: -2.0, lng: 100.0 },
  { lat: -6.0, lng: 90.0 },
  { lat: -10.0, lng: 75.0 },
  { lat: -15.0, lng: 60.0 },
  { lat: -20.0, lng: 45.0 },
  { lat: -25.0, lng: 30.0 },
  { lat: -30.0, lng: 15.0 },
  { lat: -33.0, lng: 0.0 },
  { lat: -34.0, lng: -10.0 },
  { lat: -33.0, lng: -20.0 },
  { lat: -30.0, lng: -30.0 },
  { lat: -27.0, lng: -38.0 },
  { lat: -25.0, lng: -43.0 },
  { lat: -23.95, lng: -46.30 }, // Santos
];

function calculateVesselPosition(
  departureDate: string,
  arrivalDate: string,
  route: Array<{ lat: number; lng: number }>
): { lat: number; lng: number } | null {
  const now = Date.now();
  const dep = new Date(departureDate).getTime();
  const arr = new Date(arrivalDate).getTime();
  
  if (now < dep) return route[0]; // Not departed yet
  if (now > arr) return route[route.length - 1]; // Already arrived
  
  const progress = (now - dep) / (arr - dep);
  const totalPoints = route.length - 1;
  const exactIndex = progress * totalPoints;
  const lowerIndex = Math.floor(exactIndex);
  const upperIndex = Math.min(lowerIndex + 1, totalPoints);
  const fraction = exactIndex - lowerIndex;
  
  return {
    lat: route[lowerIndex].lat + (route[upperIndex].lat - route[lowerIndex].lat) * fraction,
    lng: route[lowerIndex].lng + (route[upperIndex].lng - route[lowerIndex].lng) * fraction,
  };
}

function calculateProgress(events: OneTrackingEvent[]): number {
  const occurred = events.filter(e => e.hasOccurred).length;
  const total = events.length;
  if (total === 0) return 0;
  return Math.round((occurred / total) * 100);
}

/**
 * Get tracking data for a known BL number.
 * Currently uses hardcoded data; in the future will integrate with Logcomex API.
 */
export function fetchOneTracking(blNumber: string): OneTrackingResult | null {
  const cleanBl = blNumber.replace(/^ONEY/i, '').trim().toUpperCase();
  
  // For XMNG50123700 - the BL from the PDF (Palitos Industria)
  if (cleanBl === 'XMNG50123700') {
    const now = new Date();
    
    // Determine which events have occurred based on current date
    const allEvents: OneTrackingEvent[] = [
      { date: '2026-05-04 20:59', location: 'XIAMEN, CHINA', terminal: 'SINOTRANS XIAMEN', description: 'Container liberado para shipper', hasOccurred: true },
      { date: '2026-05-06 10:31', location: 'XIAMEN, CHINA', terminal: 'XIAMEN HAITIAN TERMINAL', description: 'Entrada no terminal de embarque', hasOccurred: true },
      { date: '2026-05-09 11:01', location: 'XIAMEN, CHINA', terminal: 'XIAMEN HAITIAN TERMINAL', description: 'Carregado no navio', vessel: 'NAVIOS LAPIS 013W', hasOccurred: true },
      { date: '2026-05-10 00:34', location: 'XIAMEN, CHINA', terminal: 'XIAMEN HAITIAN TERMINAL', description: 'Partida do porto de origem', hasOccurred: true },
      { date: '2026-05-18 02:10', location: 'SINGAPORE', terminal: 'PSA CORPORATION', description: 'Chegada no porto de transbordo', hasOccurred: true },
      { date: '2026-05-18 18:49', location: 'SINGAPORE', terminal: 'PSA CORPORATION', description: 'Descarregado no transbordo', hasOccurred: true },
      { date: '2026-06-04 11:18', location: 'SINGAPORE', terminal: 'PSA CORPORATION', description: 'Carregado no navio', vessel: 'WIDE ALPHA 612W', hasOccurred: true },
      { date: '2026-06-05 03:00', location: 'SINGAPORE', terminal: 'PSA CORPORATION', description: 'Partida do transbordo', hasOccurred: true },
      { date: '2026-06-28 01:00', location: 'SANTOS, BRAZIL', terminal: 'SANTOS BRASIL SA', description: 'Chegada no porto de destino', hasOccurred: false },
      { date: '2026-06-28 02:30', location: 'SANTOS, BRAZIL', terminal: 'SANTOS BRASIL SA', description: 'Descarregado no destino', hasOccurred: false },
      { date: '2026-06-28 07:00', location: 'SANTOS, BRAZIL', terminal: 'SANTOS BRASIL SA', description: 'Liberado para entrega', hasOccurred: false },
    ];

    // Update hasOccurred based on current date
    for (const event of allEvents) {
      const eventDate = new Date(event.date);
      event.hasOccurred = now >= eventDate;
    }

    // Calculate vessel position on Singapore → Santos route
    const vesselPosition = calculateVesselPosition(
      '2026-06-05T03:00:00Z',
      '2026-06-28T01:00:00Z',
      ROUTE_SINGAPORE_SANTOS
    );

    // Determine current status
    let currentStatus = 'Em trânsito';
    const lastOccurred = allEvents.filter(e => e.hasOccurred).pop();
    if (lastOccurred) {
      currentStatus = lastOccurred.description;
    }

    // Full route: Xiamen → Singapore → Santos
    const fullRoute = [...ROUTE_XIAMEN_SINGAPORE, ...ROUTE_SINGAPORE_SANTOS.slice(1)];

    return {
      blNumber: 'ONEYXMNG50123700',
      bookingRef: 'XMNG50123700',
      containerNo: 'SEGU9243192',
      containerType: '40HR (Reefer)',
      containerWeight: '26,400 KGS',
      placeOfReceipt: 'XIAMEN, FUJIAN, CHINA',
      placeOfDelivery: 'SANTOS, BRAZIL',
      latestEvent: currentStatus,
      latestEventTime: lastOccurred?.date || '',
      podArrival: '2026-06-28 01:00',
      sailingLegs: [
        {
          vessel: 'NAVIOS LAPIS',
          vesselCode: '013W',
          portOfLoading: 'XIAMEN, CHINA',
          departureDate: '2026-05-10 00:34',
          portOfDischarging: 'SINGAPORE',
          arrivalTime: '2026-05-18 02:10',
        },
        {
          vessel: 'WIDE ALPHA',
          vesselCode: '612W',
          portOfLoading: 'SINGAPORE',
          departureDate: '2026-06-05 03:00',
          portOfDischarging: 'SANTOS, BRAZIL',
          arrivalTime: '2026-06-28 01:00',
        },
      ],
      events: allEvents,
      currentStatus,
      progress: calculateProgress(allEvents),
      vesselPosition,
      routeCoordinates: fullRoute,
      origin: { lat: 24.47, lng: 118.08, name: 'XIAMEN' },
      destination: { lat: -23.95, lng: -46.30, name: 'SANTOS' },
      transshipments: [{ lat: 1.26, lng: 103.85, name: 'SINGAPORE' }],
    };
  }

  return null;
}
