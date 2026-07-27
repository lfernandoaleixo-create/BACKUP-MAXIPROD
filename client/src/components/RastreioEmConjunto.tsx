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
  X,
  Play,
  Pause,
  Eye,
  EyeOff,
  Filter,
  MapPin,
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
  armador: string | null;
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
  events?: Array<{ date?: string; timestamp?: string; description?: string; status?: string; location?: string; event?: string; has_occurred?: boolean }>;
}

/**
 * Individual tracker component - fetches live data for ONE container
 * and reports it back via a ref-based callback to avoid re-render loops.
 */
function ContainerTracker({ container, onDataReadyRef }: {
  container: ContainerData;
  onDataReadyRef: React.MutableRefObject<(id: number, data: LiveData) => void>;
}) {
  // Determine which tracking sources to use
  // Priority: AI tracking (most accurate ETA/status) + ONE Line (for vessel position on map)
  const hasAiCapability = !!container.rastreio && !!container.armador;
  const hasBlCapability = !!container.blNumber;
  const hasUuidCapability = !!container.trackingUuid;

  // CACHE-FIRST: Get AI data from cache instantly (no slow API call)
  const aiQuery = trpc.import.getTrackingFromCache.useQuery(
    { container: container.rastreio || "" },
    { enabled: hasAiCapability, retry: 0, staleTime: 60_000 }
  );

  // Also fetch ONE Line if we have BL (for vessel position/coordinates)
  const oneQuery = trpc.import.fetchOneTracking.useQuery(
    { blNumber: container.blNumber || "" },
    { enabled: hasBlCapability, retry: 1, staleTime: 3 * 60 * 60 * 1000 }
  );

  // Logcomex UUID tracking (legacy)
  const logcomexQuery = trpc.import.fetchTracking.useQuery(
    { trackingUuid: container.trackingUuid || "" },
    { enabled: hasUuidCapability && !hasBlCapability && !hasAiCapability, retry: 1, staleTime: 3 * 60 * 60 * 1000 }
  );

  // Use AI data as primary (best ETA/status), ONE Line for position, UUID as fallback
  const aiData = aiQuery.data as any;
  const oneData = oneQuery.data as any;
  const uuidData = logcomexQuery.data as any;
  const primaryData = hasAiCapability ? aiData : (hasBlCapability ? oneData : uuidData);
  const isAiTracking = hasAiCapability && !!aiData;
  const isOneTracking = hasBlCapability && !!oneData && !isAiTracking;

  // Use a ref to track the last reported data to avoid infinite loops
  const lastReportedRef = useRef<string>("");

  useEffect(() => {
    if (!primaryData) return;

    let progress: number;
    let routeCoordinates: Array<{ lat: number; lng: number }>;
    let originName: string;
    let originPosition: { lat: number; lng: number } | null;
    let destName: string;
    let destPosition: { lat: number; lng: number } | null;
    let vessel: string;
    let eta: string | null;
    let currentStatus: string;
    let vesselPosition: { lat: number; lng: number } | null = null;

    if (isAiTracking) {
      const d = aiData;
      // Logcomex AI tracking - field names are snake_case from the API
      // Calculate progress from ETD→ETA elapsed time (more accurate)
      if (d.etd && d.eta) {
        const etdDate = new Date(d.etd);
        const etaDate = new Date(d.eta);
        const now = new Date();
        const totalDuration = etaDate.getTime() - etdDate.getTime();
        if (totalDuration > 0) {
          const elapsed = now.getTime() - etdDate.getTime();
          progress = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
        } else {
          progress = 0;
        }
      } else {
        // Fallback to event ratio
        const events = d.events || [];
        const occurred = events.filter((e: any) => e.has_occurred);
        progress = events.length > 0 ? Math.round((occurred.length / events.length) * 100) : 0;
      }
      originName = d.origin_port || '';
      destName = d.destination_port || '';
      vessel = d.vessel_name || '';
      eta = d.eta || null;
      currentStatus = d.current_status || '';

      // Get vessel position and route from ONE Line data (if available)
      if (oneData) {
        routeCoordinates = oneData.routeCoordinates || [];
        originPosition = oneData.origin ? { lat: oneData.origin.lat, lng: oneData.origin.lng } : (routeCoordinates.length > 0 ? routeCoordinates[0] : null);
        destPosition = oneData.destination ? { lat: oneData.destination.lat, lng: oneData.destination.lng } : (routeCoordinates.length > 0 ? routeCoordinates[routeCoordinates.length - 1] : null);
        
        // Use the backend-calculated vessel position (time-based interpolation from ONE Line)
        // This is more accurate as it uses actual departure/arrival timestamps
        if (oneData.vesselPosition) {
          vesselPosition = oneData.vesselPosition;
        } else if (routeCoordinates.length > 1 && progress > 0 && progress < 100) {
          // Fallback: interpolate along route using progress %
          const idx = Math.floor((progress / 100) * (routeCoordinates.length - 1));
          const nextIdx = Math.min(idx + 1, routeCoordinates.length - 1);
          const segFraction = ((progress / 100) * (routeCoordinates.length - 1)) - idx;
          vesselPosition = {
            lat: routeCoordinates[idx].lat + (routeCoordinates[nextIdx].lat - routeCoordinates[idx].lat) * segFraction,
            lng: routeCoordinates[idx].lng + (routeCoordinates[nextIdx].lng - routeCoordinates[idx].lng) * segFraction,
          };
        } else if (progress >= 100 && destPosition) {
          vesselPosition = destPosition;
        } else if (progress <= 0 && originPosition) {
          vesselPosition = originPosition;
        }
      } else {
        // No ONE Line data - use maritime shipping lanes (water-only routes)
        const portCoords: Record<string, { lat: number; lng: number }> = {
          'DALIAN': { lat: 38.92, lng: 121.63 },
          'SANTOS': { lat: -23.95, lng: -46.30 },
          'SHANGHAI': { lat: 31.23, lng: 121.47 },
          'NINGBO': { lat: 29.87, lng: 121.89 },
          'BUSAN': { lat: 35.10, lng: 129.03 },
          'PUSAN': { lat: 35.10, lng: 129.03 },
          'SINGAPORE': { lat: 1.26, lng: 103.84 },
          'PARANAGUA': { lat: -25.52, lng: -48.51 },
          'ITAJAI': { lat: -26.91, lng: -48.67 },
          'NAVEGANTES': { lat: -26.90, lng: -48.65 },
          'XIAMEN': { lat: 24.47, lng: 118.08 },
          'SHEKOU': { lat: 22.48, lng: 113.90 },
        };

        // Known maritime routes (water-only, no overland shortcuts)
        const MARITIME_ROUTES: Record<string, Array<{ lat: number; lng: number }>> = {
          'DALIAN_SANTOS': [
            // Dalian port
            { lat: 38.92, lng: 121.63 },
            // Exit Bohai Sea heading south
            { lat: 38.5, lng: 121.5 },
            { lat: 37.8, lng: 122.0 },
            // Yellow Sea - heading south-southeast in deep water
            { lat: 37.0, lng: 122.5 },
            { lat: 36.0, lng: 123.0 },
            { lat: 35.0, lng: 123.5 },
            { lat: 34.0, lng: 124.0 },
            { lat: 33.0, lng: 124.5 },
            // East China Sea - heading south
            { lat: 31.0, lng: 125.0 },
            { lat: 29.0, lng: 125.5 },
            { lat: 27.5, lng: 123.5 },
            { lat: 26.0, lng: 122.0 },
            // Taiwan Strait (center of strait, west of Taiwan island)
            { lat: 25.5, lng: 120.5 },
            { lat: 24.5, lng: 119.8 },
            { lat: 23.5, lng: 119.5 },
            { lat: 22.5, lng: 119.0 },
            // South China Sea - heading southwest (east of Vietnam)
            { lat: 21.0, lng: 117.5 },
            { lat: 19.0, lng: 116.0 },
            { lat: 17.0, lng: 114.5 },
            { lat: 15.0, lng: 113.0 },
            { lat: 13.0, lng: 112.0 },
            { lat: 11.0, lng: 110.5 },
            { lat: 9.0, lng: 109.0 },
            { lat: 7.5, lng: 107.5 },
            // Approaching Singapore from northeast
            { lat: 5.5, lng: 106.0 },
            { lat: 4.0, lng: 105.5 },
            { lat: 3.0, lng: 105.0 },
            // Singapore Strait (entering from east)
            { lat: 2.0, lng: 104.5 },
            { lat: 1.4, lng: 104.3 },
            { lat: 1.25, lng: 103.9 },
            { lat: 1.18, lng: 103.5 },
            // Exit Singapore westward into Malacca Strait
            { lat: 1.2, lng: 103.3 },
            { lat: 1.3, lng: 103.0 },
            // Malacca Strait - heading northwest
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
            // South of Sri Lanka
            { lat: 5.0, lng: 80.0 },
            { lat: 4.5, lng: 77.0 },
            { lat: 3.0, lng: 73.0 },
            // Indian Ocean crossing
            { lat: 0.0, lng: 67.0 },
            { lat: -3.0, lng: 61.0 },
            { lat: -6.0, lng: 56.0 },
            // East of Madagascar (staying at lng > 51)
            { lat: -9.0, lng: 53.0 },
            { lat: -12.0, lng: 52.0 },
            { lat: -15.0, lng: 52.0 },
            { lat: -18.0, lng: 52.0 },
            { lat: -21.0, lng: 52.0 },
            { lat: -24.0, lng: 51.5 },
            // Past southern Madagascar
            { lat: -26.5, lng: 50.0 },
            { lat: -28.0, lng: 46.0 },
            // Heading toward Cape of Good Hope
            { lat: -30.0, lng: 40.0 },
            { lat: -32.0, lng: 35.0 },
            { lat: -33.5, lng: 30.0 },
            { lat: -34.5, lng: 27.0 },
            { lat: -35.0, lng: 24.0 },
            { lat: -35.5, lng: 21.0 },
            // Cape Agulhas - southernmost point of Africa
            { lat: -35.8, lng: 19.0 },
            { lat: -35.5, lng: 18.0 },
            { lat: -34.5, lng: 17.0 },
            { lat: -33.5, lng: 16.0 },
            { lat: -33.0, lng: 14.0 },
            // South Atlantic - heading northwest to Brazil
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
            // Santos port
            { lat: -23.95, lng: -46.30 },
          ],
          'SHANGHAI_SANTOS': [
            // Shanghai port
            { lat: 31.23, lng: 121.47 },
            { lat: 29.5, lng: 122.0 },
            { lat: 27.5, lng: 121.5 },
            { lat: 26.0, lng: 120.5 },
            // Taiwan Strait
            { lat: 25.0, lng: 120.0 },
            { lat: 24.0, lng: 119.5 },
            { lat: 23.0, lng: 119.2 },
            { lat: 22.0, lng: 118.8 },
            // South China Sea - east of Vietnam
            { lat: 20.0, lng: 117.0 },
            { lat: 17.0, lng: 114.5 },
            { lat: 14.0, lng: 112.5 },
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
            { lat: -23.95, lng: -46.30 },
          ],
          'NINGBO_SANTOS': [
            // Ningbo port
            { lat: 29.87, lng: 121.89 },
            { lat: 28.5, lng: 121.5 },
            { lat: 27.0, lng: 121.0 },
            { lat: 26.0, lng: 120.5 },
            // Taiwan Strait
            { lat: 25.0, lng: 120.0 },
            { lat: 24.0, lng: 119.5 },
            { lat: 23.0, lng: 119.2 },
            { lat: 22.0, lng: 118.8 },
            // South China Sea - east of Vietnam
            { lat: 20.0, lng: 117.0 },
            { lat: 17.0, lng: 114.5 },
            { lat: 14.0, lng: 112.5 },
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
            { lat: -23.95, lng: -46.30 },
          ],
          'XIAMEN_SANTOS': [
            // Xiamen port
            { lat: 24.47, lng: 118.08 },
            { lat: 23.5, lng: 118.0 },
            { lat: 22.5, lng: 117.5 },
            // South China Sea - east of Vietnam
            { lat: 20.0, lng: 116.5 },
            { lat: 17.0, lng: 114.5 },
            { lat: 14.0, lng: 112.5 },
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
            { lat: -23.95, lng: -46.30 },
          ],
        };

        // Also add SHEKOU_SANTOS route
        MARITIME_ROUTES['SHEKOU_SANTOS'] = [
          { lat: 22.48, lng: 113.90 }, // Shekou
          { lat: 20.0, lng: 113.0 },   // South China Sea
          { lat: 16.0, lng: 112.0 },
          { lat: 12.0, lng: 110.0 },
          { lat: 8.0, lng: 108.0 },
          { lat: 5.0, lng: 106.0 },
          { lat: 3.0, lng: 105.0 },
          { lat: 1.26, lng: 103.85 }, // Singapore
          { lat: 1.2, lng: 103.3 },
          { lat: 1.3, lng: 103.0 },
          { lat: 1.6, lng: 102.2 },
          { lat: 2.1, lng: 101.8 },
          { lat: 2.4, lng: 101.4 },
          { lat: 2.9, lng: 100.8 },
          { lat: 3.5, lng: 100.0 },
          { lat: 4.0, lng: 99.4 },
          { lat: 4.7, lng: 98.8 },
          { lat: 5.4, lng: 98.3 },
          { lat: 5.8, lng: 97.5 },
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
          { lat: -9.0, lng: 53.0 },
          { lat: -12.0, lng: 52.0 },
          { lat: -15.0, lng: 52.0 },
          { lat: -18.0, lng: 52.0 },
          { lat: -21.0, lng: 52.0 },
          { lat: -24.0, lng: 51.5 },
          { lat: -26.5, lng: 50.0 },
          { lat: -28.0, lng: 46.0 },
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

        const originKey = (d.origin_port || '').toUpperCase().split(',')[0].trim();
        const destKey = (d.destination_port || '').toUpperCase().split(',')[0].trim();
        const originCoord = portCoords[originKey] || null;
        const destCoord = portCoords[destKey] || null;
        originPosition = originCoord;
        destPosition = destCoord;

        // Try to find a known maritime route
        const routeKey = `${originKey}_${destKey}`;
        const knownRoute = MARITIME_ROUTES[routeKey];

        if (knownRoute) {
          routeCoordinates = knownRoute;
        } else if (originCoord && destCoord) {
          // Fallback: still use a 2-point line (better than nothing)
          routeCoordinates = [originCoord, destCoord];
        } else {
          routeCoordinates = [];
        }

        if (routeCoordinates.length > 1 && progress > 0 && progress < 100) {
          // Interpolate vessel position along the maritime route
          const fraction = progress / 100;
          const totalPoints = routeCoordinates.length - 1;
          const exactIndex = fraction * totalPoints;
          const lowerIndex = Math.floor(exactIndex);
          const upperIndex = Math.min(lowerIndex + 1, totalPoints);
          const segFraction = exactIndex - lowerIndex;
          vesselPosition = {
            lat: routeCoordinates[lowerIndex].lat + (routeCoordinates[upperIndex].lat - routeCoordinates[lowerIndex].lat) * segFraction,
            lng: routeCoordinates[lowerIndex].lng + (routeCoordinates[upperIndex].lng - routeCoordinates[lowerIndex].lng) * segFraction,
          };
        } else if (progress >= 100 && destCoord) {
          vesselPosition = destCoord;
        } else if (originCoord) {
          vesselPosition = originCoord;
        } else {
          const cachedLat = container.vesselLat ? parseFloat(container.vesselLat) : null;
          const cachedLng = container.vesselLng ? parseFloat(container.vesselLng) : null;
          vesselPosition = (cachedLat && cachedLng) ? { lat: cachedLat, lng: cachedLng } : null;
        }
      }
    } else if (isOneTracking) {
      const d = oneData;
      vesselPosition = d.vesselPosition || null;
      progress = d.progress || 0;
      routeCoordinates = d.routeCoordinates || [];
      originName = d.origin?.name || d.placeOfReceipt || '';
      originPosition = d.origin ? { lat: d.origin.lat, lng: d.origin.lng } : (routeCoordinates.length > 0 ? routeCoordinates[0] : null);
      destName = d.destination?.name || d.placeOfDelivery || '';
      destPosition = d.destination ? { lat: d.destination.lat, lng: d.destination.lng } : (routeCoordinates.length > 0 ? routeCoordinates[routeCoordinates.length - 1] : null);
      vessel = d.sailingLegs?.[d.sailingLegs?.length - 1]?.vessel || '';
      eta = d.podArrival || null;
      currentStatus = d.currentStatus || '';
    } else {
      const d = uuidData || primaryData;
      vesselPosition = d.vesselPosition || null;
      progress = d.historic
        ? Math.round((d.historic.filter((e: any) => e.hasOccurred).length / d.historic.length) * 100)
        : 0;
      routeCoordinates = d.vesselRouteCoordinates || [];
      originName = d.vesselRouteOrigin || d.origin || '';
      originPosition = routeCoordinates.length > 0 ? routeCoordinates[0] : null;
      destName = d.vesselRouteDestination || d.destination || '';
      destPosition = routeCoordinates.length > 0 ? routeCoordinates[routeCoordinates.length - 1] : null;
      vessel = d.vessel || '';
      eta = d.eta || null;
      currentStatus = d.currentStatus || d.translatedStatus || '';
    }

    // Extract events for route history
    let events: LiveData['events'] = undefined;
    if (isAiTracking && aiData?.events) {
      events = aiData.events;
    } else if (isOneTracking && oneData?.sailingLegs) {
      events = oneData.sailingLegs.map((leg: any) => ({
        description: `${leg.vessel || 'Vessel'} - ${leg.departurePort || ''} → ${leg.arrivalPort || ''}`,
        date: leg.departure || leg.arrival || '',
        location: leg.arrivalPort || leg.departurePort || '',
      }));
    } else if (uuidData?.historic) {
      events = uuidData.historic.map((h: any) => ({
        description: h.description || h.event || '',
        date: h.dateTime || h.date || '',
        location: h.location || '',
        has_occurred: h.hasOccurred,
      }));
    }

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
      events,
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
  }, [primaryData, aiData, oneData, uuidData, container.id, container.vesselLat, container.vesselLng, isOneTracking, isAiTracking, onDataReadyRef]);

  return null;
}

export function RastreioEmConjunto() {
  const { data: containers, isLoading, error, refetch } = trpc.import.getActiveContainers.useQuery(
    undefined,
    { staleTime: 3 * 60 * 60 * 1000 }
  );

  const [liveTrackingData, setLiveTrackingData] = useState<Map<number, LiveData>>(new Map());
  const [hoveredContainer, setHoveredContainer] = useState<number | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const mapReadyRef = useRef(false);

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1); // 1x, 2x, 4x
  const animationFrameRef = useRef<number | null>(null);
  const animationProgressRef = useRef<Map<number, number>>(new Map()); // containerId -> progress (0-1)
  const animationMarkersRef = useRef<Map<number, any>>(new Map()); // animated ship markers

  // Filter state - which routes are visible
  const [visibleRoutes, setVisibleRoutes] = useState<Set<number>>(new Set());
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Tooltip state
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Modal state for route history
  // Side panel now uses selectedContainer/hoveredContainer instead of modalContainerId

  // Initialize visibleRoutes when containers load
  useEffect(() => {
    if (containers && containers.length > 0 && visibleRoutes.size === 0) {
      setVisibleRoutes(new Set(containers.map(c => c.id)));
    }
  }, [containers]);

  // Animation logic
  const startAnimation = useCallback(() => {
    if (!containers || !mapRef.current) return;
    setIsAnimating(true);
    // Initialize progress for all visible containers
    const initProgress = new Map<number, number>();
    containers.forEach(c => {
      if (visibleRoutes.has(c.id)) {
        initProgress.set(c.id, 0);
      }
    });
    animationProgressRef.current = initProgress;
  }, [containers, visibleRoutes]);

  const stopAnimation = useCallback(() => {
    setIsAnimating(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    // Remove animation markers
    animationMarkersRef.current.forEach(marker => {
      if (marker.setMap) marker.setMap(null);
      else marker.map = null;
    });
    animationMarkersRef.current.clear();
  }, []);

  // Animation frame loop
  useEffect(() => {
    if (!isAnimating || !mapRef.current || !containers) return;

    const map = mapRef.current;
    const colors = ['#ff6b35', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000; // seconds
      lastTime = currentTime;

      // Speed: complete route in ~15s at 1x, ~7.5s at 2x, ~3.75s at 4x
      const speedFactor = animationSpeed * 0.067; // ~15 seconds for full route at 1x

      let allDone = true;
      containers.forEach((container, index) => {
        if (!visibleRoutes.has(container.id)) return;
        const live = liveTrackingData.get(container.id);
        const routeCoordinates = live?.routeCoordinates || [];
        if (routeCoordinates.length < 2) return;

        const currentProgress = animationProgressRef.current.get(container.id) || 0;
        const newProgress = Math.min(1, currentProgress + deltaTime * speedFactor);
        animationProgressRef.current.set(container.id, newProgress);

        if (newProgress < 1) allDone = false;

        // Calculate position along route
        const totalPoints = routeCoordinates.length - 1;
        const exactIndex = newProgress * totalPoints;
        const segIndex = Math.min(Math.floor(exactIndex), totalPoints - 1);
        const segFraction = exactIndex - segIndex;

        const p1 = routeCoordinates[segIndex];
        const p2 = routeCoordinates[Math.min(segIndex + 1, routeCoordinates.length - 1)];
        const animPos = {
          lat: p1.lat + (p2.lat - p1.lat) * segFraction,
          lng: p1.lng + (p2.lng - p1.lng) * segFraction,
        };

        // Update or create animated marker
        const existingMarker = animationMarkersRef.current.get(container.id);
        if (existingMarker) {
          existingMarker.position = animPos;
        } else {
          const color = colors[index % colors.length];
          const el = document.createElement('div');
          el.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;">
              <div style="width:28px;height:28px;background:${color};border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px ${color}88;animation:pulse 1.5s infinite;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.14.52-.05.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/></svg>
              </div>
              <div style="margin-top:2px;background:${color};color:white;font-size:7px;font-weight:700;padding:1px 4px;border-radius:3px;white-space:nowrap;">
                ${Math.round(newProgress * 100)}%
              </div>
            </div>
          `;
          try {
            const marker = new google.maps.marker.AdvancedMarkerElement({
              map,
              position: animPos,
              content: el,
              zIndex: 1000,
            });
            animationMarkersRef.current.set(container.id, marker);
          } catch (e) {
            // fallback
          }
        }

        // Update label
        const marker = animationMarkersRef.current.get(container.id);
        if (marker && marker.content) {
          const label = marker.content.querySelector('div > div:last-child');
          if (label) label.textContent = `${Math.round(newProgress * 100)}%`;
        }
      });

      if (allDone) {
        // Reset and loop
        setTimeout(() => {
          containers.forEach(c => {
            if (visibleRoutes.has(c.id)) {
              animationProgressRef.current.set(c.id, 0);
            }
          });
        }, 1000);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnimating, animationSpeed, containers, visibleRoutes, liveTrackingData]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationMarkersRef.current.forEach(marker => {
        if (marker.setMap) marker.setMap(null);
        else marker.map = null;
      });
    };
  }, []);

  // Helper: show tooltip/infowindow on map
  const showTooltip = useCallback((position: google.maps.LatLngLiteral, content: string) => {
    if (!mapRef.current) return;
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }
    infoWindowRef.current.setContent(`<div style="font-size:12px;padding:4px 8px;max-width:200px;">${content}</div>`);
    infoWindowRef.current.setPosition(position);
    infoWindowRef.current.open(mapRef.current);
  }, []);

  const hideTooltip = useCallback(() => {
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }
  }, []);

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
    if (!map || !containers || !mapReady) return;
    // Don't require live data - we can use cached vesselLat/vesselLng from getActiveContainers
    const hasAnyCachedPosition = containers.some(c => c.vesselLat && c.vesselLng);
    if (liveDataSize === 0 && !hasAnyCachedPosition) return;

    // Clear existing markers and polylines
    markersRef.current.forEach(marker => {
      if (marker.setMap) {
        marker.setMap(null);
      } else {
        marker.map = null;
      }
    });
    markersRef.current.clear();
    polylinesRef.current.forEach(pl => pl.setMap(null));
    polylinesRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasAnyPosition = false;

    // Color palette for different containers
    const colors = ['#ff6b35', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

    // Track positions to detect overlaps and offset them
    const positionMap = new Map<string, number>();

    // Helper: offset a route laterally (perpendicular to direction of travel)
    // so multiple routes on the same path don't overlap
    function offsetRoute(
      coords: Array<{ lat: number; lng: number }>,
      offsetDeg: number
    ): Array<{ lat: number; lng: number }> {
      if (coords.length < 2 || offsetDeg === 0) return coords;
      return coords.map((pt, i) => {
        // Calculate perpendicular direction from the segment
        let dx: number, dy: number;
        if (i === 0) {
          dx = coords[1].lng - coords[0].lng;
          dy = coords[1].lat - coords[0].lat;
        } else if (i === coords.length - 1) {
          dx = coords[i].lng - coords[i - 1].lng;
          dy = coords[i].lat - coords[i - 1].lat;
        } else {
          dx = coords[i + 1].lng - coords[i - 1].lng;
          dy = coords[i + 1].lat - coords[i - 1].lat;
        }
        // Perpendicular (rotate 90 degrees): (-dy, dx), normalized
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const perpLat = -dx / len;
        const perpLng = dy / len;
        return {
          lat: pt.lat + perpLat * offsetDeg,
          lng: pt.lng + perpLng * offsetDeg,
        };
      });
    }

    // Determine offset for each container to avoid overlap
    // If multiple containers share similar routes, offset them
    const totalContainers = containers.length;
    const routeOffsets = containers.map((_, idx) => {
      if (totalContainers <= 1) return 0;
      // Spread routes slightly so they don't overlap but stay close to origin
      // Keep very small offset (0.05°) to avoid pushing routes onto land near coastlines
      const spread = 0.05;
      return (idx - (totalContainers - 1) / 2) * spread;
    });

    containers.forEach((container, index) => {
      // Skip if route is hidden by filter
      if (!visibleRoutes.has(container.id)) return;

      const live = liveTrackingData.get(container.id);
      
      // Use live data if available, otherwise fallback to cached data from getActiveContainers
      const vesselPosition = live?.vesselPosition || 
        (container.vesselLat && container.vesselLng ? { lat: parseFloat(container.vesselLat), lng: parseFloat(container.vesselLng) } : null);
      const progress = live?.progress || container.progress || 0;
      const routeCoordinates = live?.routeCoordinates || [];
      const originName = live?.originName || container.origin || '';
      const originPosition = live?.originPosition || null;
      const destName = live?.destName || container.destination || '';
      const destPosition = live?.destPosition || null;
      
      // Skip only if we have absolutely no position data
      if (!vesselPosition && !originPosition && !destPosition && routeCoordinates.length === 0) {
        return;
      }

      const color = colors[index % colors.length];

      // Draw route polyline with lateral offset so routes are side-by-side
      if (routeCoordinates && routeCoordinates.length > 1) {
        const offsetPath = offsetRoute(routeCoordinates, routeOffsets[index]);
        const polyline = new google.maps.Polyline({
          path: offsetPath,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 3.5,
          map,
        });
        polylinesRef.current.push(polyline);

        // Add route coordinates to bounds (use original, not offset)
        routeCoordinates.forEach((coord) => {
          bounds.extend(coord);
          hasAnyPosition = true;
        });
      }

      // Add origin port marker
      if (originPosition) {
        const originEl = document.createElement("div");
        originEl.style.cursor = "pointer";
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

        // Hover effect on origin marker (no InfoWindow - uses title attribute instead)
        originEl.title = `\u2693 ${originName || 'Origem'} - ${container.supplierName}`;

        try {
          const originMarker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: originPosition,
            content: originEl,
          });
          markersRef.current.set(`origin-${container.id}`, originMarker);
        } catch (e) {
          console.warn('[RastreioMap] AdvancedMarker failed for origin, using fallback:', e);
          const fallback = new google.maps.Marker({
            map,
            position: originPosition,
            title: originName.split(',')[0] || 'Origem',
            icon: { url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' },
          });
          markersRef.current.set(`origin-${container.id}`, fallback);
        }
        bounds.extend(originPosition);
        hasAnyPosition = true;
      }

      // Add vessel marker - position it ON the offset route (same lateral offset as polyline)
      // For delivered containers, show at destination (Santos) with anchor icon
      const isDelivered = container.status === 'Entregue';
      const markerPosition = isDelivered && destPosition ? destPosition : vesselPosition;

      if (markerPosition) {
        // Apply the same lateral offset as the polyline so the ship sits on its colored route
        const routeOffset = routeOffsets[index];
        let adjustedPosition = markerPosition;
        if (routeOffset !== 0 && routeCoordinates.length >= 2) {
          // Find the closest segment to determine perpendicular direction
          let closestIdx = 0;
          let minDist = Infinity;
          for (let i = 0; i < routeCoordinates.length - 1; i++) {
            const midLat = (routeCoordinates[i].lat + routeCoordinates[i + 1].lat) / 2;
            const midLng = (routeCoordinates[i].lng + routeCoordinates[i + 1].lng) / 2;
            const dist = Math.pow(markerPosition.lat - midLat, 2) + Math.pow(markerPosition.lng - midLng, 2);
            if (dist < minDist) { minDist = dist; closestIdx = i; }
          }
          const seg = routeCoordinates[closestIdx];
          const segNext = routeCoordinates[Math.min(closestIdx + 1, routeCoordinates.length - 1)];
          const dx = segNext.lng - seg.lng;
          const dy = segNext.lat - seg.lat;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpLat = -dx / len;
          const perpLng = dy / len;
          adjustedPosition = {
            lat: markerPosition.lat + perpLat * routeOffset,
            lng: markerPosition.lng + perpLng * routeOffset,
          };
        }

        const markerEl = document.createElement("div");
        markerEl.className = "vessel-marker-container";
        markerEl.style.cursor = "pointer";

        // Get vessel name for label
        const vesselName = live?.vessel || container.vesselName || '';
        
        if (isDelivered) {
          // Delivered: green checkmark, compact
          markerEl.innerHTML = `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;transition:transform 0.2s;">
              <div style="position:relative;background:#16a34a;border:2px solid white;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px #16a34a88;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              </div>
              <div style="margin-top:2px;background:#16a34a;color:white;font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);max-width:120px;overflow:hidden;text-overflow:ellipsis;">
                ${container.supplierName} • 100%
              </div>
              <div style="margin-top:1px;background:rgba(0,0,0,0.7);color:white;font-size:7px;font-weight:500;padding:1px 3px;border-radius:2px;white-space:nowrap;">
                ${vesselName || 'Em Santos'}
              </div>
            </div>
          `;
        } else {
          // Dynamic color based on delivery status/progress
          const statusColor = progress >= 80 ? '#16a34a' : progress >= 50 ? '#0891b2' : progress >= 25 ? '#f59e0b' : '#ef4444';
          const hullColor = progress >= 80 ? '#0f5132' : progress >= 50 ? '#164e63' : progress >= 25 ? '#78350f' : '#7f1d1d';
          const cabinColor = progress >= 80 ? '#22c55e' : progress >= 50 ? '#06b6d4' : progress >= 25 ? '#eab308' : '#ef4444';
          const cabinStroke = progress >= 80 ? '#15803d' : progress >= 50 ? '#0e7490' : progress >= 25 ? '#ca8a04' : '#dc2626';
          
          // In transit: front-facing cargo ship with waves, rocking animation, water trail, dynamic color
          markerEl.innerHTML = `
            <style>
              @keyframes shipRock {
                0%, 100% { transform: rotate(-3deg) translateY(0px); }
                25% { transform: rotate(2deg) translateY(-1.5px); }
                50% { transform: rotate(-2deg) translateY(1px); }
                75% { transform: rotate(3deg) translateY(-0.5px); }
              }
              @keyframes waveMove {
                0% { transform: translateX(0px); }
                50% { transform: translateX(3px); }
                100% { transform: translateX(0px); }
              }
              @keyframes trailFade {
                0% { opacity: 0.6; transform: translateY(0) scaleX(1); }
                100% { opacity: 0; transform: translateY(12px) scaleX(0.3); }
              }
              @keyframes bubbles {
                0% { opacity: 0.8; transform: translate(0, 0) scale(1); }
                50% { opacity: 0.4; transform: translate(-3px, 8px) scale(0.6); }
                100% { opacity: 0; transform: translate(-5px, 16px) scale(0.2); }
              }
            </style>
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;transition:transform 0.2s;">
              <!-- Water trail behind ship -->
              <div style="position:absolute;top:32px;left:50%;transform:translateX(-50%);width:30px;height:20px;pointer-events:none;">
                <div style="position:absolute;width:100%;height:4px;background:linear-gradient(90deg,transparent,rgba(59,130,246,0.4),transparent);border-radius:50%;animation:trailFade 2s ease-out infinite;"></div>
                <div style="position:absolute;top:4px;width:80%;left:10%;height:3px;background:linear-gradient(90deg,transparent,rgba(59,130,246,0.3),transparent);border-radius:50%;animation:trailFade 2s ease-out infinite 0.4s;"></div>
                <div style="position:absolute;top:8px;width:60%;left:20%;height:2px;background:linear-gradient(90deg,transparent,rgba(59,130,246,0.2),transparent);border-radius:50%;animation:trailFade 2s ease-out infinite 0.8s;"></div>
                <!-- Bubbles -->
                <div style="position:absolute;top:2px;left:8px;width:3px;height:3px;background:rgba(147,197,253,0.7);border-radius:50%;animation:bubbles 1.5s ease-out infinite;"></div>
                <div style="position:absolute;top:0px;right:10px;width:2px;height:2px;background:rgba(147,197,253,0.5);border-radius:50%;animation:bubbles 1.8s ease-out infinite 0.5s;"></div>
                <div style="position:absolute;top:4px;left:14px;width:2.5px;height:2.5px;background:rgba(147,197,253,0.6);border-radius:50%;animation:bubbles 2s ease-out infinite 1s;"></div>
              </div>
              <div style="position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));animation:shipRock 3s ease-in-out infinite;transform-origin:center bottom;">
                <svg width="42" height="42" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Ship hull - dynamic color -->
                  <path d="M12 42 L18 52 L46 52 L52 42 L42 42 L38 36 L26 36 L22 42 Z" fill="${hullColor}" stroke="#0f2640" stroke-width="1.5"/>
                  <!-- Ship bridge/cabin - dynamic color -->
                  <rect x="24" y="24" width="16" height="12" rx="1" fill="${cabinColor}" stroke="${cabinStroke}" stroke-width="1"/>
                  <!-- Windows -->
                  <rect x="27" y="27" width="3" height="3" rx="0.5" fill="#ffeaa7"/>
                  <rect x="32" y="27" width="3" height="3" rx="0.5" fill="#ffeaa7"/>
                  <rect x="37" y="27" width="3" height="3" rx="0.5" fill="#ffeaa7"/>
                  <!-- Chimney -->
                  <rect x="29" y="16" width="6" height="8" fill="#2c3e50" stroke="#1a252f" stroke-width="1"/>
                  <rect x="28" y="14" width="8" height="3" fill="${cabinColor}"/>
                  <!-- Mast -->
                  <line x1="32" y1="10" x2="32" y2="14" stroke="#555" stroke-width="1.5"/>
                  <!-- Status indicator light -->
                  <circle cx="32" cy="10" r="2" fill="${statusColor}" opacity="0.9"/>
                  <!-- Waves (animated) -->
                  <g style="animation:waveMove 2s ease-in-out infinite;">
                    <path d="M8 54 Q12 51 16 54 Q20 57 24 54 Q28 51 32 54 Q36 57 40 54 Q44 51 48 54 Q52 57 56 54" fill="none" stroke="#3498db" stroke-width="2" stroke-linecap="round"/>
                  </g>
                  <g style="animation:waveMove 2.5s ease-in-out infinite 0.3s;">
                    <path d="M10 58 Q14 55 18 58 Q22 61 26 58 Q30 55 34 58 Q38 61 42 58 Q46 55 50 58 Q54 61 58 58" fill="none" stroke="#2980b9" stroke-width="1.5" stroke-linecap="round"/>
                  </g>
                </svg>
              </div>
              <div style="margin-top:2px;background:${statusColor};color:white;font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);max-width:140px;overflow:hidden;text-overflow:ellipsis;">
                ${container.supplierName} \u2022 ${progress || 0}%
              </div>
              <div style="margin-top:1px;background:rgba(0,0,0,0.7);color:white;font-size:7px;font-weight:500;padding:1px 3px;border-radius:2px;white-space:nowrap;">
                ${vesselName}
              </div>
            </div>
          `;
        }

        // Add hover/click events - hover opens card, click locks/unlocks
        // Use a debounce timeout to prevent flicker from rapid mouseenter/mouseleave cycles
        // (Google Maps AdvancedMarkerElement can cause rapid re-fires when repositioning DOM)
        let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
        markerEl.addEventListener("mouseenter", () => {
          if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null; }
          setHoveredContainer(container.id);
          markerEl.style.transform = "scale(1.15)";
          markerEl.style.zIndex = "1000";
        });
        markerEl.addEventListener("mouseleave", () => {
          // Debounce mouseleave to prevent flicker
          hoverTimeout = setTimeout(() => {
            setHoveredContainer(prev => prev === container.id ? null : prev);
            markerEl.style.transform = "scale(1)";
            markerEl.style.zIndex = "";
            hoverTimeout = null;
          }, 150);
        });
        markerEl.addEventListener("click", () => {
          // Click locks/unlocks the card (toggle selectedContainer)
          setSelectedContainer(prev => prev === container.id ? null : container.id);
        });

        try {
          const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: adjustedPosition,
            content: markerEl,
          });
          markersRef.current.set(`vessel-${container.id}`, marker);
        } catch (e) {
          console.warn('[RastreioMap] AdvancedMarker failed for vessel, using fallback:', e);
          const fallback = new google.maps.Marker({
            map,
            position: adjustedPosition,
            title: `${container.supplierName} • ${progress || 0}%`,
            icon: { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' },
          });
          markersRef.current.set(`vessel-${container.id}`, fallback);
        }
        bounds.extend(adjustedPosition);
        hasAnyPosition = true;
      }

      // Add destination marker (skip for delivered containers since vessel marker is already at dest)
      if (destPosition && !isDelivered) {
        const destEl = document.createElement("div");
        destEl.style.cursor = "pointer";
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

        // Title tooltip for destination (no InfoWindow to avoid flickering)
        const etaForTitle = live?.eta || container.eta;
        destEl.title = `\u{1F3C1} ${destName || 'Destino'}${etaForTitle ? ` - ETA: ${etaForTitle}` : ''}`;

        try {
          const destMarker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: destPosition,
            content: destEl,
          });
          markersRef.current.set(`dest-${container.id}`, destMarker);
        } catch (e) {
          console.warn('[RastreioMap] AdvancedMarker failed for dest, using fallback:', e);
          const fallback = new google.maps.Marker({
            map,
            position: destPosition,
            title: destName.split(',')[0] || 'Destino',
            icon: { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' },
          });
          markersRef.current.set(`dest-${container.id}`, fallback);
        }
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
  }, [containers, liveDataSize, mapReady, visibleRoutes]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    mapReadyRef.current = true;
    setMapReady(true);
    map.setOptions({
      mapTypeId: "hybrid",
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
    });
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    // Parse date string directly to avoid timezone conversion issues
    // Dates like '2026-07-11' are UTC midnight, which shifts to previous day in BRT (UTC-3)
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
          Quando houver containers com BL, UUID ou número de container (rastreio AI) cadastrados nos pagamentos, eles aparecerão aqui.
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

      {/* Controls Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Animation Controls */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5 shadow-sm">
          <button
            onClick={() => isAnimating ? stopAnimation() : startAnimation()}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition ${
              isAnimating
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
            }`}
          >
            {isAnimating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isAnimating ? 'Pausar' : 'Animar'}
          </button>
          {isAnimating && (
            <div className="flex items-center gap-0.5">
              {[1, 2, 4].map(speed => (
                <button
                  key={speed}
                  onClick={() => setAnimationSpeed(speed)}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition ${
                    animationSpeed === speed
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter Menu */}
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {visibleRoutes.size < (containers?.length || 0) && (
              <span className="bg-indigo-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {visibleRoutes.size}
              </span>
            )}
          </button>
          {showFilterMenu && containers && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">Visibilidade das Rotas</span>
                <button
                  onClick={() => {
                    if (visibleRoutes.size === containers.length) {
                      setVisibleRoutes(new Set());
                    } else {
                      setVisibleRoutes(new Set(containers.map(c => c.id)));
                    }
                  }}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {visibleRoutes.size === containers.length ? 'Ocultar Todas' : 'Mostrar Todas'}
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {containers.map((container, index) => {
                  const colors = ['#ff6b35', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
                  const color = colors[index % colors.length];
                  const isVisible = visibleRoutes.has(container.id);
                  return (
                    <button
                      key={container.id}
                      onClick={() => {
                        setVisibleRoutes(prev => {
                          const next = new Set(prev);
                          if (next.has(container.id)) {
                            next.delete(container.id);
                          } else {
                            next.add(container.id);
                          }
                          return next;
                        });
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition ${
                        isVisible ? 'bg-slate-50 hover:bg-slate-100' : 'bg-slate-100/50 opacity-50 hover:opacity-75'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ background: isVisible ? color : '#cbd5e1' }}
                      />
                      {isVisible ? (
                        <Eye className="w-3 h-3 text-slate-500 shrink-0" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-slate-700 truncate">{container.supplierName}</p>
                        <p className="text-[9px] text-slate-500 truncate">{container.containerName || container.poNumber}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-lg">
        {/* Map */}
        <MapView
          className="w-full h-[380px] sm:h-[450px]"
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

        {/* Hover/Selected Card Overlay - Complete cargo details */}
        {activeContainer && (activeLive || activeContainer.vesselName || activeContainer.origin) && (
          <div className="absolute top-2 right-2 w-72 sm:top-3 sm:right-3 sm:w-80 max-h-[85%] overflow-y-auto bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl p-3 sm:p-4 z-50 pointer-events-auto">
            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedContainer(null); setHoveredContainer(null); }}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white transition z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Header: Supplier name + progress badge */}
            <div className="flex items-start justify-between mb-3 pr-6">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 bg-indigo-600/30 border border-indigo-500/50 rounded-lg flex items-center justify-center shrink-0">
                  <Ship className="w-4 h-4 text-indigo-300" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{activeContainer.supplierName}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {activeContainer.poNumber} {activeContainer.pedido ? `• ${activeContainer.pedido}` : ''}
                  </p>
                </div>
              </div>
              <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-md shrink-0">
                {activeLive?.progress || activeContainer.progress || 0}%
              </span>
            </div>

            {/* Route: Origin → Destination */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span className="font-medium">{activeLive?.originName || activeContainer.origin || '—'}</span>
                <span className="text-slate-600 mx-1">→</span>
                <span className="font-medium">{activeLive?.destName || activeContainer.destination || '—'}</span>
              </div>
              <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: `${activeLive?.progress || activeContainer.progress || 0}%` }}
                />
              </div>
            </div>

            {/* Info grid - all details visible */}
            <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
              {(activeLive?.vessel || activeContainer.vesselName) && (
                <div className="bg-slate-800/60 rounded-lg p-2">
                  <span className="text-slate-500 uppercase tracking-wider text-[9px]">Navio</span>
                  <p className="text-white font-medium mt-0.5 break-words">{activeLive?.vessel || activeContainer.vesselName}</p>
                </div>
              )}
              {(activeLive?.eta || activeContainer.eta) && (
                <div className="bg-slate-800/60 rounded-lg p-2">
                  <span className="text-slate-500 uppercase tracking-wider text-[9px]">ETA</span>
                  <p className="text-white font-medium mt-0.5">{formatDate(activeLive?.eta || activeContainer.eta)}</p>
                </div>
              )}
              {activeContainer.armador && (
                <div className="bg-slate-800/60 rounded-lg p-2">
                  <span className="text-slate-500 uppercase tracking-wider text-[9px]">Armador</span>
                  <p className="text-white font-medium mt-0.5 break-words">{activeContainer.armador}</p>
                </div>
              )}
              {activeContainer.containerName && (
                <div className="bg-slate-800/60 rounded-lg p-2">
                  <span className="text-slate-500 uppercase tracking-wider text-[9px]">Container</span>
                  <p className="text-white font-medium mt-0.5 font-mono text-[9px]">{activeContainer.containerName}</p>
                </div>
              )}
              {activeContainer.etd && (
                <div className="bg-slate-800/60 rounded-lg p-2">
                  <span className="text-slate-500 uppercase tracking-wider text-[9px]">ETD</span>
                  <p className="text-white font-medium mt-0.5">{formatDate(activeContainer.etd)}</p>
                </div>
              )}
              {activeContainer.poNumber && (
                <div className="bg-slate-800/60 rounded-lg p-2">
                  <span className="text-slate-500 uppercase tracking-wider text-[9px]">PO</span>
                  <p className="text-white font-medium mt-0.5 break-words">{activeContainer.poNumber}</p>
                </div>
              )}
            </div>

            {/* Status */}
            {(activeLive?.currentStatus || activeContainer.trackingStatus || activeContainer.status) && (
              <div className="bg-slate-800/60 rounded-lg p-2 mb-3">
                <span className="text-slate-500 uppercase tracking-wider text-[9px]">Status</span>
                <p className="text-emerald-300 font-medium mt-0.5">{activeLive?.currentStatus || activeContainer.trackingStatus || activeContainer.status}</p>
              </div>
            )}

            {/* Products - show ALL without truncation */}
            {activeContainer.products.length > 0 && (
              <div className="border-t border-slate-700/50 pt-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Package className="w-3 h-3" /> {activeContainer.products.length} Produto{activeContainer.products.length !== 1 ? 's' : ''}
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {activeContainer.products.map((prod, i) => (
                    <div key={i} className="flex items-start justify-between text-[10px] gap-2">
                      <span className="text-slate-300 break-words leading-tight">{prod.description}</span>
                      <div className="shrink-0 text-right">
                        {prod.quantidade && (
                          <span className="text-slate-400 font-medium">{prod.quantidade.toLocaleString('pt-BR')} cx</span>
                        )}
                        {prod.valorUsd && (
                          <p className="text-[9px] text-slate-500">US$ {prod.valorUsd}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BL Number */}
            {activeContainer.blNumber && (
              <div className="mt-2 pt-2 border-t border-slate-700/50">
                <span className="text-slate-500 uppercase tracking-wider text-[9px]">BL</span>
                <p className="text-[10px] text-slate-300 font-mono mt-0.5">{activeContainer.blNumber}</p>
              </div>
            )}
          </div>
        )}

        {/* Loading overlay for live tracking - only show if we have containers that COULD have positions */}
        {containers.length > 0 && liveTrackingData.size === 0 && !containers.some(c => c.vesselLat && c.vesselLng) && containers.some(c => c.blNumber || c.trackingUuid) && (
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
              onMouseEnter={() => { if (!selectedContainer) setHoveredContainer(container.id); }}
              onMouseLeave={() => { if (!selectedContainer) setTimeout(() => setHoveredContainer(prev => prev === container.id ? null : prev), 100); }}
              onClick={() => {
                setSelectedContainer(prev => {
                  if (prev === container.id) {
                    // Unlock: deselect and clear hover
                    setHoveredContainer(null);
                    return null;
                  }
                  // Lock: select this container
                  return container.id;
                });
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
      {/* Route History Modal */}
      {(selectedContainer || hoveredContainer) && (() => {
        const showId = selectedContainer || hoveredContainer;
        const mc = containers.find(c => c.id === showId);
        const ml = liveTrackingData.get(showId!);
        if (!mc) return null;
        return (
          <div className="fixed top-0 right-0 h-full w-[380px] max-w-[90vw] bg-white shadow-2xl z-[9999] overflow-y-auto border-l border-slate-200 animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
            <div>
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 p-4 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Ship className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">{mc.supplierName}</h3>
                    <p className="text-xs text-slate-500">{mc.poNumber} {mc.pedido ? `\u2022 ${mc.pedido}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {selectedContainer && (
                    <span className="text-[9px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Travado</span>
                  )}
                  <button onClick={() => { setSelectedContainer(null); setHoveredContainer(null); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-4">
                {/* Progress Section */}
                <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-xl p-4">
                  <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                    <span className="font-medium">{ml?.originName || mc.origin || '\u2014'}</span>
                    <span className="text-slate-400">{"\u2192"}</span>
                    <span className="font-medium">{ml?.destName || mc.destination || '\u2014'}</span>
                  </div>
                  <div className="h-3 bg-white/80 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all" style={{ width: `${ml?.progress || mc.progress || 0}%` }} />
                  </div>
                  <p className="text-center mt-2 text-lg font-bold text-indigo-600">{ml?.progress || mc.progress || 0}%</p>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {(ml?.vessel || mc.vesselName) && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Navio</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{ml?.vessel || mc.vesselName}</p>
                    </div>
                  )}
                  {mc.armador && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Armador</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{mc.armador}</p>
                    </div>
                  )}
                  {(ml?.eta || mc.eta) && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">ETA</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{formatDate(ml?.eta || mc.eta)}</p>
                    </div>
                  )}
                  {mc.etd && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">ETD</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{formatDate(mc.etd)}</p>
                    </div>
                  )}
                  {mc.containerName && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Container</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5 font-mono">{mc.containerName}</p>
                    </div>
                  )}
                  {mc.blNumber && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">BL</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5 font-mono">{mc.blNumber}</p>
                    </div>
                  )}
                  {mc.poNumber && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">PO</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{mc.poNumber}</p>
                    </div>
                  )}
                  {mc.pedido && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Pedido</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{mc.pedido}</p>
                    </div>
                  )}
                </div>

                {/* Status */}
                {(ml?.currentStatus || mc.trackingStatus || mc.status) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-[10px] text-emerald-600 uppercase tracking-wider">Status Atual</p>
                    <p className="text-sm font-semibold text-emerald-700 mt-0.5">{ml?.currentStatus || mc.trackingStatus || mc.status}</p>
                  </div>
                )}

                {/* Route History */}
                {ml?.events && ml.events.length > 0 && (
                  <div className="border-t border-slate-200 pt-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Histórico da Rota
                    </h4>
                    <div className="space-y-0 relative">
                      <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-200" />
                      {ml.events.map((evt: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 relative py-2">
                          <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 z-10 ${evt.has_occurred || evt.status === 'checked' || evt.status === 'current' ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-slate-300'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-800">{evt.description || evt.event || (evt.status === 'checked' ? 'Concluído' : evt.status === 'current' ? 'Em andamento' : evt.status === 'pending' ? 'Pendente' : evt.status) || '\u2014'}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {evt.location && <span>{evt.location} {"\u2022"} </span>}
                              {evt.date || evt.timestamp || ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Products */}
                {mc.products && mc.products.length > 0 && (
                  <div className="border-t border-slate-200 pt-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" /> Produtos ({mc.products.length})
                    </h4>
                    <div className="space-y-2">
                      {mc.products.map((prod, i) => (
                        <div key={i} className="bg-slate-50 rounded-lg p-3 flex items-start justify-between gap-3">
                          <p className="text-xs text-slate-700 break-words leading-relaxed flex-1">{prod.description}</p>
                          <div className="shrink-0 text-right">
                            {prod.quantidade && <p className="text-xs font-bold text-slate-800">{Number(prod.quantidade).toLocaleString('pt-BR')} cx</p>}
                            {prod.valorUsd && <p className="text-[10px] text-slate-500">US$ {Number(prod.valorUsd).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
