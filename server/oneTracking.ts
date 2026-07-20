/**
 * ONE Line (Ocean Network Express) Cargo Tracking Integration
 * 
 * Since ONE's API requires browser session/cookies, we use a combination of:
 * 1. Hardcoded data for known BLs (manually entered from ONE website / FindTEU)
 * 2. A route calculation based on known shipping lanes
 * 
 * In the future, when the user gets FindTEU API or Logcomex API access, 
 * this can be replaced with direct API calls.
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
  { lat: 22.5, lng: 118.5 },   // South along coast (in water)
  { lat: 20.0, lng: 117.5 },   // South China Sea
  { lat: 18.0, lng: 117.0 },   // East of Vietnam (open water)
  { lat: 14.5, lng: 116.0 },   // South China Sea
  { lat: 11.0, lng: 115.0 },   // South China Sea
  { lat: 8.0, lng: 112.0 },    // Spratly area
  { lat: 5.5, lng: 108.0 },    // North of Natuna
  { lat: 3.5, lng: 106.0 },    // Approaching Singapore
  { lat: 2.5, lng: 105.0 },    // East of Singapore
  { lat: 1.26, lng: 103.85 },  // Singapore
];

const ROUTE_SINGAPORE_SANTOS: Array<{ lat: number; lng: number }> = [
  { lat: 1.26, lng: 103.85 },  // Singapore
  { lat: 1.2, lng: 103.3 },    // Exit Singapore westward
  { lat: 1.3, lng: 103.0 },
  // Malacca Strait - between Malay Peninsula and Sumatra
  { lat: 1.6, lng: 102.2 },
  { lat: 2.1, lng: 101.8 },
  { lat: 2.4, lng: 101.4 },
  { lat: 2.9, lng: 100.8 },
  { lat: 3.5, lng: 100.0 },
  { lat: 4.0, lng: 99.4 },
  { lat: 4.7, lng: 98.8 },
  { lat: 5.4, lng: 98.3 },
  { lat: 5.8, lng: 97.5 },     // Exit Malacca into Andaman Sea
  // Andaman Sea / Indian Ocean
  { lat: 6.3, lng: 95.0 },
  { lat: 6.0, lng: 92.0 },
  { lat: 5.5, lng: 88.0 },
  { lat: 5.5, lng: 84.0 },
  { lat: 5.0, lng: 80.0 },     // South of Sri Lanka
  { lat: 4.5, lng: 77.0 },
  { lat: 3.0, lng: 73.0 },
  { lat: 0.0, lng: 67.0 },
  { lat: -3.0, lng: 61.0 },
  { lat: -6.0, lng: 56.0 },
  // EAST of Madagascar (lng > 51 until past lat -26)
  { lat: -9.0, lng: 53.0 },
  { lat: -12.0, lng: 52.0 },
  { lat: -15.0, lng: 52.0 },
  { lat: -18.0, lng: 52.0 },
  { lat: -21.0, lng: 52.0 },
  { lat: -24.0, lng: 51.5 },
  // SOUTH of Madagascar (ends at ~lat -25.5)
  { lat: -26.5, lng: 50.0 },
  { lat: -28.0, lng: 46.0 },
  { lat: -30.0, lng: 40.0 },
  { lat: -32.0, lng: 35.0 },
  { lat: -33.5, lng: 30.0 },
  // Cape of Good Hope
  { lat: -34.5, lng: 27.0 },
  { lat: -35.0, lng: 24.0 },
  { lat: -35.5, lng: 21.0 },
  { lat: -35.8, lng: 19.0 },   // Cape Agulhas
  { lat: -35.5, lng: 18.0 },
  { lat: -34.5, lng: 17.0 },
  { lat: -33.5, lng: 16.0 },
  { lat: -33.0, lng: 14.0 },
  // South Atlantic
  { lat: -32.0, lng: 10.0 },
  { lat: -31.0, lng: 5.0 },
  { lat: -30.0, lng: 0.0 },
  { lat: -29.0, lng: -5.0 },
  { lat: -28.0, lng: -10.0 },
  { lat: -27.5, lng: -15.0 },
  { lat: -27.0, lng: -20.0 },
  { lat: -26.5, lng: -25.0 },
  { lat: -26.0, lng: -30.0 },
  { lat: -25.5, lng: -35.0 },
  { lat: -25.0, lng: -38.0 },
  { lat: -24.5, lng: -41.0 },
  { lat: -24.0, lng: -44.0 },
  { lat: -23.95, lng: -46.30 }, // Santos
];

// Full route from Dalian directly to Santos (via Taiwan Strait, Singapore, Malacca, Cape of Good Hope)
// This is used when a ship goes Dalian → Santos without stopping at Busan
const ROUTE_DALIAN_SANTOS_DIRECT: Array<{ lat: number; lng: number }> = [
  { lat: 38.92, lng: 121.63 }, // Dalian port
  { lat: 38.5, lng: 121.5 },
  { lat: 37.8, lng: 122.0 },
  // Yellow Sea
  { lat: 37.0, lng: 122.5 },
  { lat: 36.0, lng: 123.0 },
  { lat: 35.0, lng: 123.5 },
  { lat: 34.0, lng: 124.0 },
  { lat: 33.0, lng: 124.5 },
  // East China Sea
  { lat: 31.0, lng: 125.0 },
  { lat: 29.0, lng: 125.5 },
  { lat: 27.5, lng: 123.5 },
  { lat: 26.0, lng: 122.0 },
  // Taiwan Strait
  { lat: 25.5, lng: 120.5 },
  { lat: 24.5, lng: 119.8 },
  { lat: 23.5, lng: 119.5 },
  { lat: 22.5, lng: 119.0 },
  // South China Sea
  { lat: 21.0, lng: 117.5 },
  { lat: 19.0, lng: 116.0 },
  { lat: 17.0, lng: 114.5 },
  { lat: 15.0, lng: 113.0 },
  { lat: 13.0, lng: 112.0 },
  { lat: 11.0, lng: 110.5 },
  { lat: 9.0, lng: 109.0 },
  { lat: 7.5, lng: 107.5 },
  // Approaching Singapore
  { lat: 5.5, lng: 106.0 },
  { lat: 4.0, lng: 105.5 },
  { lat: 3.0, lng: 105.0 },
  // Singapore Strait
  { lat: 2.0, lng: 104.5 },
  { lat: 1.4, lng: 104.3 },
  { lat: 1.25, lng: 103.9 },
  { lat: 1.18, lng: 103.5 },
  { lat: 1.2, lng: 103.3 },
  { lat: 1.3, lng: 103.0 },
  // Malacca Strait
  { lat: 1.6, lng: 102.2 },
  { lat: 2.1, lng: 101.8 },
  { lat: 2.4, lng: 101.4 },
  { lat: 2.9, lng: 100.8 },
  { lat: 3.5, lng: 100.0 },
  { lat: 4.0, lng: 99.4 },
  { lat: 4.7, lng: 98.8 },
  { lat: 5.4, lng: 98.3 },
  { lat: 5.8, lng: 97.5 },
  // Andaman Sea / Indian Ocean
  { lat: 6.3, lng: 95.0 },
  { lat: 6.0, lng: 92.0 },
  { lat: 5.5, lng: 88.0 },
  { lat: 5.5, lng: 84.0 },
  { lat: 5.0, lng: 80.0 },
  { lat: 4.5, lng: 77.0 },
  { lat: 3.0, lng: 73.0 },
  { lat: 0.0, lng: 67.0 },
  { lat: -3.0, lng: 61.0 },
  { lat: -6.0, lng: 56.0 },
  // East of Madagascar
  { lat: -9.0, lng: 53.0 },
  { lat: -12.0, lng: 52.0 },
  { lat: -15.0, lng: 52.0 },
  { lat: -18.0, lng: 52.0 },
  { lat: -21.0, lng: 52.0 },
  { lat: -24.0, lng: 51.5 },
  { lat: -26.5, lng: 50.0 },
  { lat: -28.0, lng: 46.0 },
  // Cape of Good Hope
  { lat: -30.0, lng: 40.0 },
  { lat: -32.0, lng: 35.0 },
  { lat: -33.5, lng: 30.0 },
  { lat: -34.5, lng: 27.0 },
  { lat: -35.0, lng: 24.0 },
  { lat: -35.5, lng: 21.0 },
  { lat: -35.8, lng: 19.0 },
  { lat: -35.5, lng: 18.0 },
  { lat: -34.5, lng: 17.0 },
  { lat: -33.5, lng: 16.0 },
  { lat: -33.0, lng: 14.0 },
  // South Atlantic
  { lat: -32.0, lng: 10.0 },
  { lat: -31.0, lng: 5.0 },
  { lat: -30.0, lng: 0.0 },
  { lat: -29.0, lng: -5.0 },
  { lat: -28.0, lng: -10.0 },
  { lat: -27.5, lng: -15.0 },
  { lat: -27.0, lng: -20.0 },
  { lat: -26.5, lng: -25.0 },
  { lat: -26.0, lng: -30.0 },
  { lat: -25.5, lng: -35.0 },
  { lat: -25.0, lng: -38.0 },
  { lat: -24.5, lng: -41.0 },
  { lat: -24.0, lng: -44.0 },
  { lat: -23.95, lng: -46.30 }, // Santos
];

const ROUTE_DALIAN_BUSAN: Array<{ lat: number; lng: number }> = [
  { lat: 38.92, lng: 121.63 }, // Dalian port
  { lat: 38.5, lng: 121.5 },
  { lat: 37.8, lng: 122.0 },
  { lat: 37.0, lng: 122.5 },
  { lat: 36.0, lng: 123.0 },
  { lat: 35.0, lng: 124.0 },
  // Korea Strait - pass between Korea and Japan
  { lat: 34.2, lng: 126.5 },
  { lat: 33.8, lng: 128.5 },
  { lat: 34.5, lng: 129.0 },
  { lat: 35.1, lng: 129.03 },  // Busan
];

const ROUTE_BUSAN_SANTOS: Array<{ lat: number; lng: number }> = [
  { lat: 35.1, lng: 129.03 },  // Busan
  { lat: 33.0, lng: 129.5 },   // South of Japan
  { lat: 31.5, lng: 129.0 },   // East China Sea
  { lat: 29.5, lng: 127.0 },
  { lat: 27.0, lng: 124.0 },
  // East of Taiwan (Pacific side, Bashi Channel)
  { lat: 24.5, lng: 122.5 },
  { lat: 22.0, lng: 120.0 },
  // South China Sea
  { lat: 19.0, lng: 117.0 },
  { lat: 15.0, lng: 114.0 },
  { lat: 11.0, lng: 110.5 },
  { lat: 9.0, lng: 109.0 },
  { lat: 7.5, lng: 107.5 },
  { lat: 5.5, lng: 106.0 },
  { lat: 4.0, lng: 105.5 },
  { lat: 3.0, lng: 105.0 },
  // Singapore Strait
  { lat: 2.0, lng: 104.5 },
  { lat: 1.4, lng: 104.3 },
  { lat: 1.25, lng: 103.9 },
  { lat: 1.18, lng: 103.5 },
  { lat: 1.2, lng: 103.3 },
  { lat: 1.3, lng: 103.0 },
  // Malacca Strait
  { lat: 1.6, lng: 102.2 },
  { lat: 2.1, lng: 101.8 },
  { lat: 2.4, lng: 101.4 },
  { lat: 2.9, lng: 100.8 },
  { lat: 3.5, lng: 100.0 },
  { lat: 4.0, lng: 99.4 },
  { lat: 4.7, lng: 98.8 },
  { lat: 5.4, lng: 98.3 },
  { lat: 5.8, lng: 97.5 },
  // Andaman Sea / Indian Ocean
  { lat: 6.3, lng: 95.0 },
  { lat: 6.0, lng: 92.0 },
  { lat: 5.5, lng: 88.0 },
  { lat: 5.5, lng: 84.0 },
  { lat: 5.0, lng: 80.0 },
  { lat: 4.5, lng: 77.0 },
  { lat: 3.0, lng: 73.0 },
  { lat: 0.0, lng: 67.0 },
  { lat: -3.0, lng: 61.0 },
  { lat: -6.0, lng: 56.0 },
  // East of Madagascar
  { lat: -9.0, lng: 53.0 },
  { lat: -12.0, lng: 52.0 },
  { lat: -15.0, lng: 52.0 },
  { lat: -18.0, lng: 52.0 },
  { lat: -21.0, lng: 52.0 },
  { lat: -24.0, lng: 51.5 },
  { lat: -26.5, lng: 50.0 },
  { lat: -28.0, lng: 46.0 },
  // Cape of Good Hope
  { lat: -30.0, lng: 40.0 },
  { lat: -32.0, lng: 35.0 },
  { lat: -33.5, lng: 30.0 },
  { lat: -34.5, lng: 27.0 },
  { lat: -35.0, lng: 24.0 },
  { lat: -35.5, lng: 21.0 },
  { lat: -35.8, lng: 19.0 },
  { lat: -35.5, lng: 18.0 },
  { lat: -34.5, lng: 17.0 },
  { lat: -33.5, lng: 16.0 },
  { lat: -33.0, lng: 14.0 },
  // South Atlantic
  { lat: -32.0, lng: 10.0 },
  { lat: -31.0, lng: 5.0 },
  { lat: -30.0, lng: 0.0 },
  { lat: -29.0, lng: -5.0 },
  { lat: -28.0, lng: -10.0 },
  { lat: -27.5, lng: -15.0 },
  { lat: -27.0, lng: -20.0 },
  { lat: -26.5, lng: -25.0 },
  { lat: -26.0, lng: -30.0 },
  { lat: -25.5, lng: -35.0 },
  { lat: -25.0, lng: -38.0 },
  { lat: -24.5, lng: -41.0 },
  { lat: -24.0, lng: -44.0 },
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
 * Calculate the distance between two geographic points using the Haversine formula.
 * Returns distance in kilometers.
 */
function haversineDistance(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371; // Earth's radius in km
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate voyage progress based on geographic distance traveled along the route.
 * Uses the vessel's current position to determine how much of the total route has been covered.
 */
function calculateVoyageProgress(
  firstDepartureDate: string,
  finalArrivalDate: string,
  vesselPosition: { lat: number; lng: number } | null,
  routeCoordinates: Array<{ lat: number; lng: number }>
): number {
  const now = Date.now();
  const dep = new Date(firstDepartureDate).getTime();
  const arr = new Date(finalArrivalDate).getTime();
  
  if (now <= dep) return 0;
  if (now >= arr) return 100;
  
  // If we have vessel position and route, calculate based on geographic distance
  if (vesselPosition && routeCoordinates.length >= 2) {
    // Calculate total route distance
    let totalDistance = 0;
    for (let i = 1; i < routeCoordinates.length; i++) {
      totalDistance += haversineDistance(routeCoordinates[i - 1], routeCoordinates[i]);
    }
    
    // Find the closest point on the route to the vessel
    let minDist = Infinity;
    let closestSegmentIndex = 0;
    let closestFraction = 0;
    
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const segStart = routeCoordinates[i];
      const segEnd = routeCoordinates[i + 1];
      
      // Project vessel position onto the segment
      const dx = segEnd.lng - segStart.lng;
      const dy = segEnd.lat - segStart.lat;
      const segLenSq = dx * dx + dy * dy;
      
      let t = 0;
      if (segLenSq > 0) {
        t = ((vesselPosition.lng - segStart.lng) * dx + (vesselPosition.lat - segStart.lat) * dy) / segLenSq;
        t = Math.max(0, Math.min(1, t));
      }
      
      const projLat = segStart.lat + t * dy;
      const projLng = segStart.lng + t * dx;
      const dist = haversineDistance(vesselPosition, { lat: projLat, lng: projLng });
      
      if (dist < minDist) {
        minDist = dist;
        closestSegmentIndex = i;
        closestFraction = t;
      }
    }
    
    // Calculate distance traveled up to the closest point
    let distanceTraveled = 0;
    for (let i = 1; i <= closestSegmentIndex; i++) {
      distanceTraveled += haversineDistance(routeCoordinates[i - 1], routeCoordinates[i]);
    }
    // Add the fraction of the current segment
    distanceTraveled += closestFraction * haversineDistance(
      routeCoordinates[closestSegmentIndex],
      routeCoordinates[closestSegmentIndex + 1]
    );
    
    const progress = (distanceTraveled / totalDistance) * 100;
    return Math.round(Math.min(Math.max(progress, 0), 100));
  }
  
  // Fallback to time-based if no position/route available
  const progress = ((now - dep) / (arr - dep)) * 100;
  return Math.round(Math.min(Math.max(progress, 0), 100));
}

/**
 * Get tracking data for a known BL number.
 * Currently uses hardcoded data from FindTEU/ONE website.
 * In the future will integrate with FindTEU API or Logcomex API.
 */
export function fetchOneTracking(blNumber: string): OneTrackingResult | null {
  const cleanBl = blNumber.replace(/^ONEY/i, '').trim().toUpperCase();
  
  // BL XMNG50123700 - Palitos Industria (Xiamen → Singapore → Santos)
  if (cleanBl === 'XMNG50123700') {
    const now = new Date();
    
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

    for (const event of allEvents) {
      const eventDate = new Date(event.date);
      event.hasOccurred = now >= eventDate;
    }

    const vesselPosition = calculateVesselPosition(
      '2026-06-05T03:00:00Z',
      '2026-06-28T01:00:00Z',
      ROUTE_SINGAPORE_SANTOS
    );

    let currentStatus = 'Em trânsito';
    const lastOccurred = allEvents.filter(e => e.hasOccurred).pop();
    if (lastOccurred) {
      currentStatus = lastOccurred.description;
    }

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
      progress: calculateVoyageProgress('2026-05-10T00:34:00Z', '2026-06-28T01:00:00Z', vesselPosition, fullRoute),
      vesselPosition,
      routeCoordinates: fullRoute,
      origin: { lat: 24.47, lng: 118.08, name: 'XIAMEN' },
      destination: { lat: -23.95, lng: -46.30, name: 'SANTOS' },
      transshipments: [{ lat: 1.26, lng: 103.85, name: 'SINGAPORE' }],
    };
  }

  // BL 274102504 - MAERSK WALLIS (Dalian → Busan → Santos) - WINNIE - HARBIN pedido ZY2026-027
  if (cleanBl === '274102504') {
    const now = new Date();
    
    const allEvents: OneTrackingEvent[] = [
      { date: '2026-07-10', location: 'DALIAN, CHINA', terminal: 'DCT (DALIAN CONTAINER TERMINAL)', description: 'Container vazio retirado', hasOccurred: true },
      { date: '2026-07-14', location: 'DALIAN, CHINA', terminal: 'DCT (DALIAN CONTAINER TERMINAL)', description: 'Entrada no terminal (cheio)', hasOccurred: true },
      { date: '2026-07-17', location: 'DALIAN, CHINA', terminal: 'DCT (DALIAN CONTAINER TERMINAL)', description: 'Carregado no navio', vessel: 'MAERSK WALLIS', hasOccurred: true },
      { date: '2026-07-17', location: 'DALIAN, CHINA', terminal: 'DCT (DALIAN CONTAINER TERMINAL)', description: 'Partida do porto de origem', vessel: 'MAERSK WALLIS', hasOccurred: true },
      { date: '2026-07-21', location: 'BUSAN, SOUTH KOREA', terminal: 'BUSAN NEW PORT', description: 'Chegada no porto de transbordo', vessel: 'MAERSK WALLIS', hasOccurred: false },
      { date: '2026-07-22', location: 'BUSAN, SOUTH KOREA', terminal: 'BUSAN NEW PORT', description: 'Partida do transbordo', vessel: 'MAERSK WALLIS', hasOccurred: false },
      { date: '2026-08-29', location: 'SANTOS, BRAZIL', terminal: 'SANTOS BRASIL SA', description: 'Chegada no porto de destino', vessel: 'MAERSK WALLIS', hasOccurred: false },
      { date: '2026-08-29', location: 'SANTOS, BRAZIL', terminal: 'SANTOS BRASIL SA', description: 'Descarregado no destino', vessel: 'MAERSK WALLIS', hasOccurred: false },
      { date: '2026-08-29', location: 'SANTOS, BRAZIL', terminal: 'SANTOS BRASIL SA', description: 'Liberado para entrega', vessel: 'MAERSK WALLIS', hasOccurred: false },
    ];

    for (const event of allEvents) {
      const eventDate = new Date(event.date);
      event.hasOccurred = now >= eventDate;
    }

    // Vessel position: MAERSK WALLIS departed Dalian 2026-07-17, ETA Santos 2026-08-29
    const vesselPosition = calculateVesselPosition(
      '2026-07-17T12:07:00Z',
      '2026-08-29T00:00:00Z',
      ROUTE_DALIAN_SANTOS_DIRECT
    );

    let currentStatus = 'Em trânsito';
    const lastOccurred = allEvents.filter(e => e.hasOccurred).pop();
    if (lastOccurred) {
      currentStatus = lastOccurred.description;
    }

    // Full route: Dalian → Santos (direct, via Taiwan Strait)
    const fullRoute = ROUTE_DALIAN_SANTOS_DIRECT;

    return {
      blNumber: '274102504',
      bookingRef: '274102504',
      containerNo: 'MNBU3920011',
      containerType: "40'DV (Dry Van)",
      containerWeight: '25,000 KGS',
      placeOfReceipt: 'DALIAN, CHINA',
      placeOfDelivery: 'SANTOS, BRAZIL',
      latestEvent: currentStatus,
      latestEventTime: lastOccurred?.date || '',
      podArrival: '2026-08-29',
      sailingLegs: [
        {
          vessel: 'MAERSK WALLIS',
          vesselCode: '',
          portOfLoading: 'DALIAN, CHINA',
          departureDate: '2026-07-17',
          portOfDischarging: 'BUSAN, SOUTH KOREA',
          arrivalTime: '2026-07-21',
        },
        {
          vessel: 'MAERSK WALLIS',
          vesselCode: '',
          portOfLoading: 'BUSAN, SOUTH KOREA',
          departureDate: '2026-07-22',
          portOfDischarging: 'SANTOS, BRAZIL',
          arrivalTime: '2026-08-29',
        },
      ],
      events: allEvents,
      currentStatus,
      progress: calculateVoyageProgress('2026-07-17T12:07:00Z', '2026-08-29T00:00:00Z', vesselPosition, fullRoute),
      vesselPosition,
      routeCoordinates: fullRoute,
      origin: { lat: 38.92, lng: 121.63, name: 'DALIAN' },
      destination: { lat: -23.95, lng: -46.30, name: 'SANTOS' },
      transshipments: [{ lat: 35.1, lng: 129.03, name: 'BUSAN' }],
    };
  }

  // BL HKGG45910500 - Winnie (Dalian → Busan → Santos) - Data from FindTEU
  if (cleanBl === 'HKGG45910500') {
    const now = new Date();
    
    const allEvents: OneTrackingEvent[] = [
      { date: '2026-04-29', location: 'DALIAN, CHINA', terminal: 'DALIAN F.T.Z. SINOTRANS LOGISTICS C', description: 'Container vazio retirado', hasOccurred: true },
      { date: '2026-05-13', location: 'DALIAN, CHINA', terminal: 'DCT (DALIAN CONTAINER TERMINAL)', description: 'Entrada no terminal (cheio)', hasOccurred: true },
      { date: '2026-05-19', location: 'DALIAN, CHINA', terminal: 'DCT (DALIAN CONTAINER TERMINAL)', description: 'Carregado no navio', vessel: 'ACX DIAMOND', hasOccurred: true },
      { date: '2026-05-19', location: 'DALIAN, CHINA', terminal: 'DCT (DALIAN CONTAINER TERMINAL)', description: 'Partida do porto de origem', vessel: 'ACX DIAMOND', hasOccurred: true },
      { date: '2026-05-23', location: 'BUSAN, SOUTH KOREA', terminal: 'HPNT, HMM PSA NEW-PORT TERMINAL', description: 'Chegada no porto de transbordo', vessel: 'ACX DIAMOND', hasOccurred: true },
      { date: '2026-05-23', location: 'BUSAN, SOUTH KOREA', terminal: 'HPNT, HMM PSA NEW-PORT TERMINAL', description: 'Descarregado no transbordo', vessel: 'ACX DIAMOND', hasOccurred: true },
      { date: '2026-05-25', location: 'BUSAN, SOUTH KOREA', terminal: 'HPNT, HMM PSA NEW-PORT TERMINAL', description: 'Saída do terminal (transferência)', hasOccurred: true },
      { date: '2026-05-25', location: 'BUSAN, SOUTH KOREA', terminal: 'DONGWON GLOBAL TERMINAL BUSAN', description: 'Entrada no terminal de embarque', hasOccurred: true },
      { date: '2026-06-01', location: 'BUSAN, SOUTH KOREA', terminal: 'DONGWON GLOBAL TERMINAL BUSAN', description: 'Carregado no navio', vessel: 'HMM JAKARTA', hasOccurred: true },
      { date: '2026-06-01', location: 'BUSAN, SOUTH KOREA', terminal: 'DONGWON GLOBAL TERMINAL BUSAN', description: 'Partida do transbordo', vessel: 'HMM JAKARTA', hasOccurred: true },
      { date: '2026-07-11', location: 'SANTOS, BRAZIL', terminal: 'EMBRAPORT - DP WORLD', description: 'Chegada no porto de destino', vessel: 'HMM JAKARTA', hasOccurred: false },
      { date: '2026-07-11', location: 'SANTOS, BRAZIL', terminal: 'EMBRAPORT - DP WORLD', description: 'Descarregado no destino', vessel: 'HMM JAKARTA', hasOccurred: false },
      { date: '2026-07-11', location: 'SANTOS, BRAZIL', terminal: 'EMBRAPORT - DP WORLD', description: 'Liberado para entrega', hasOccurred: false },
      { date: '2026-07-11', location: 'SANTOS, BRAZIL', terminal: 'VIRTUAL DEPOT', description: 'Container vazio devolvido', hasOccurred: false },
    ];

    for (const event of allEvents) {
      const eventDate = new Date(event.date);
      event.hasOccurred = now >= eventDate;
    }

    // Vessel position: HMM JAKARTA departed Busan 2026-06-01, ETA Santos 2026-07-11
    const vesselPosition = calculateVesselPosition(
      '2026-06-01T00:00:00Z',
      '2026-07-11T00:00:00Z',
      ROUTE_BUSAN_SANTOS
    );

    let currentStatus = 'Em trânsito';
    const lastOccurred = allEvents.filter(e => e.hasOccurred).pop();
    if (lastOccurred) {
      currentStatus = lastOccurred.description;
    }

    // Full route: Dalian → Santos (direct route via Taiwan Strait)
    const fullRoute = ROUTE_DALIAN_SANTOS_DIRECT;

    return {
      blNumber: 'ONEYHKGG45910500',
      bookingRef: 'HKGG45910500',
      containerNo: 'TCLU7290240',
      containerType: "20'DV (Dry Van)",
      containerWeight: '25,000 KGS',
      placeOfReceipt: 'DALIAN, CHINA',
      placeOfDelivery: 'SANTOS, BRAZIL',
      latestEvent: currentStatus,
      latestEventTime: lastOccurred?.date || '',
      podArrival: '2026-07-11',
      sailingLegs: [
        {
          vessel: 'ACX DIAMOND',
          vesselCode: '',
          portOfLoading: 'DALIAN, CHINA',
          departureDate: '2026-05-19',
          portOfDischarging: 'BUSAN, SOUTH KOREA',
          arrivalTime: '2026-05-23',
        },
        {
          vessel: 'HMM JAKARTA',
          vesselCode: '',
          portOfLoading: 'BUSAN, SOUTH KOREA',
          departureDate: '2026-06-01',
          portOfDischarging: 'SANTOS, BRAZIL',
          arrivalTime: '2026-07-11',
        },
      ],
      events: allEvents,
      currentStatus,
      progress: calculateVoyageProgress('2026-05-19T00:00:00Z', '2026-07-11T00:00:00Z', vesselPosition, fullRoute),
      vesselPosition,
      routeCoordinates: fullRoute,
      origin: { lat: 38.92, lng: 121.63, name: 'DALIAN' },
      destination: { lat: -23.95, lng: -46.30, name: 'SANTOS' },
      transshipments: [{ lat: 35.1, lng: 129.03, name: 'BUSAN' }],
    };
  }

  return null;
}
