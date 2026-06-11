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
  { lat: 22.5, lng: 116.0 },
  { lat: 18.0, lng: 113.0 },
  { lat: 12.0, lng: 110.0 },
  { lat: 7.0, lng: 107.0 },
  { lat: 3.0, lng: 105.0 },
  { lat: 1.26, lng: 103.85 }, // Singapore
];

const ROUTE_SINGAPORE_SANTOS: Array<{ lat: number; lng: number }> = [
  { lat: 1.26, lng: 103.85 }, // Singapore
  { lat: -1.0, lng: 101.0 },  // Strait of Malacca exit
  { lat: -4.0, lng: 95.0 },   // Off Sumatra west coast
  { lat: -8.0, lng: 85.0 },   // Indian Ocean
  { lat: -12.0, lng: 75.0 },  // Central Indian Ocean
  { lat: -16.0, lng: 65.0 },  // Indian Ocean
  { lat: -20.0, lng: 55.0 },  // East of Madagascar
  { lat: -25.0, lng: 45.0 },  // Mozambique Channel
  { lat: -30.0, lng: 38.0 },  // South of Mozambique
  { lat: -33.0, lng: 32.0 },  // Off Durban
  { lat: -35.0, lng: 25.0 },  // South Africa coast
  { lat: -36.0, lng: 20.0 },  // Cape of Good Hope
  { lat: -35.5, lng: 15.0 },  // West of Cape Town
  { lat: -34.0, lng: 8.0 },   // South Atlantic
  { lat: -32.0, lng: 0.0 },   // Mid Atlantic
  { lat: -30.0, lng: -8.0 },  // Atlantic
  { lat: -28.0, lng: -16.0 }, // Atlantic
  { lat: -26.0, lng: -24.0 }, // Mid South Atlantic
  { lat: -25.0, lng: -32.0 }, // Approaching Brazil
  { lat: -24.5, lng: -38.0 }, // Brazilian coast
  { lat: -24.0, lng: -43.0 }, // Near Santos
  { lat: -23.95, lng: -46.30 }, // Santos
];

const ROUTE_DALIAN_BUSAN: Array<{ lat: number; lng: number }> = [
  { lat: 38.92, lng: 121.63 }, // Dalian
  { lat: 37.5, lng: 123.0 },
  { lat: 36.0, lng: 125.0 },
  { lat: 35.1, lng: 129.03 }, // Busan
];

const ROUTE_BUSAN_SANTOS: Array<{ lat: number; lng: number }> = [
  { lat: 35.1, lng: 129.03 }, // Busan
  { lat: 30.0, lng: 125.0 },
  { lat: 25.0, lng: 120.0 },
  { lat: 18.0, lng: 114.0 },  // South China Sea
  { lat: 10.0, lng: 108.0 },  // Off Vietnam
  { lat: 4.0, lng: 104.0 },   // Near Singapore
  { lat: 1.0, lng: 103.5 },   // Singapore Strait
  { lat: -1.0, lng: 101.0 },  // Strait of Malacca exit
  { lat: -4.0, lng: 95.0 },   // Off Sumatra west coast
  { lat: -8.0, lng: 85.0 },   // Indian Ocean
  { lat: -12.0, lng: 75.0 },  // Central Indian Ocean
  { lat: -16.0, lng: 65.0 },  // Indian Ocean
  { lat: -20.0, lng: 55.0 },  // East of Madagascar
  { lat: -25.0, lng: 45.0 },  // Mozambique Channel
  { lat: -30.0, lng: 38.0 },  // South of Mozambique
  { lat: -33.0, lng: 32.0 },  // Off Durban
  { lat: -35.0, lng: 25.0 },  // South Africa coast
  { lat: -36.0, lng: 20.0 },  // Cape of Good Hope
  { lat: -35.5, lng: 15.0 },  // West of Cape Town
  { lat: -34.0, lng: 8.0 },   // South Atlantic
  { lat: -32.0, lng: 0.0 },   // Mid Atlantic
  { lat: -30.0, lng: -8.0 },  // Atlantic
  { lat: -28.0, lng: -16.0 }, // Atlantic
  { lat: -26.0, lng: -24.0 }, // Mid South Atlantic
  { lat: -25.0, lng: -32.0 }, // Approaching Brazil
  { lat: -24.5, lng: -38.0 }, // Brazilian coast
  { lat: -24.0, lng: -43.0 }, // Near Santos
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
      { date: '2026-07-04', location: 'SANTOS, BRAZIL', terminal: 'EMBRAPORT - DP WORLD', description: 'Chegada no porto de destino', vessel: 'HMM JAKARTA', hasOccurred: false },
      { date: '2026-07-04', location: 'SANTOS, BRAZIL', terminal: 'EMBRAPORT - DP WORLD', description: 'Descarregado no destino', vessel: 'HMM JAKARTA', hasOccurred: false },
      { date: '2026-07-04', location: 'SANTOS, BRAZIL', terminal: 'EMBRAPORT - DP WORLD', description: 'Liberado para entrega', hasOccurred: false },
      { date: '2026-07-04', location: 'SANTOS, BRAZIL', terminal: 'VIRTUAL DEPOT', description: 'Container vazio devolvido', hasOccurred: false },
    ];

    for (const event of allEvents) {
      const eventDate = new Date(event.date);
      event.hasOccurred = now >= eventDate;
    }

    // Vessel position: HMM JAKARTA departed Busan 2026-06-01, ETA Santos 2026-07-04
    const vesselPosition = calculateVesselPosition(
      '2026-06-01T00:00:00Z',
      '2026-07-04T00:00:00Z',
      ROUTE_BUSAN_SANTOS
    );

    let currentStatus = 'Em trânsito';
    const lastOccurred = allEvents.filter(e => e.hasOccurred).pop();
    if (lastOccurred) {
      currentStatus = lastOccurred.description;
    }

    // Full route: Dalian → Busan → Santos
    const fullRoute = [...ROUTE_DALIAN_BUSAN, ...ROUTE_BUSAN_SANTOS.slice(1)];

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
      podArrival: '2026-07-04',
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
          arrivalTime: '2026-07-04',
        },
      ],
      events: allEvents,
      currentStatus,
      progress: calculateVoyageProgress('2026-05-19T00:00:00Z', '2026-07-04T00:00:00Z', vesselPosition, fullRoute),
      vesselPosition,
      routeCoordinates: fullRoute,
      origin: { lat: 38.92, lng: 121.63, name: 'DALIAN' },
      destination: { lat: -23.95, lng: -46.30, name: 'SANTOS' },
      transshipments: [{ lat: 35.1, lng: 129.03, name: 'BUSAN' }],
    };
  }

  return null;
}
