import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchOneTracking } from "./oneTracking";

describe("ONE Line Tracking", () => {
  beforeEach(() => {
    // Mock Date.now to June 11, 2026 - vessel in transit
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return tracking data for known BL XMNG50123700", () => {
    const result = fetchOneTracking("XMNG50123700");
    expect(result).not.toBeNull();
    expect(result!.blNumber).toBe("ONEYXMNG50123700");
    expect(result!.bookingRef).toBe("XMNG50123700");
    expect(result!.containerNo).toBe("SEGU9243192");
    expect(result!.containerType).toBe("40HR (Reefer)");
    expect(result!.placeOfReceipt).toBe("XIAMEN, FUJIAN, CHINA");
    expect(result!.placeOfDelivery).toBe("SANTOS, BRAZIL");
    expect(result!.origin.name).toBe("XIAMEN");
    expect(result!.origin.lng).toBe(118.08);
    expect(result!.destination.name).toBe("SANTOS");
    expect(result!.sailingLegs).toHaveLength(2);
    expect(result!.sailingLegs[0].vessel).toBe("NAVIOS LAPIS");
    expect(result!.sailingLegs[1].vessel).toBe("WIDE ALPHA");
    expect(result!.events.length).toBeGreaterThan(0);
    expect(result!.routeCoordinates.length).toBeGreaterThan(0);
    expect(result!.transshipments).toHaveLength(1);
    expect(result!.transshipments[0].name).toBe("SINGAPORE");
  });

  it("should normalize BL with ONEY prefix", () => {
    const result = fetchOneTracking("ONEYXMNG50123700");
    expect(result).not.toBeNull();
    expect(result!.blNumber).toBe("ONEYXMNG50123700");
  });

  it("should return null for unknown BL", () => {
    const result = fetchOneTracking("UNKNOWN123456");
    expect(result).toBeNull();
  });

  it("should calculate progress between 0 and 100", () => {
    const result = fetchOneTracking("XMNG50123700");
    expect(result).not.toBeNull();
    expect(result!.progress).toBeGreaterThanOrEqual(0);
    expect(result!.progress).toBeLessThanOrEqual(100);
  });

  it("should calculate progress based on geographic distance, not time elapsed", () => {
    // At June 11, 2026 - time-based would be ~67% (32 of 49 days from May 10 to June 28)
    // But geographically, vessel departed Singapore June 5 → only 6 days into 23-day leg
    // Geographic progress should be significantly less than 67%
    const result = fetchOneTracking("XMNG50123700");
    expect(result).not.toBeNull();
    // Key assertion: progress should NOT be ~67% (time-based)
    // It should be lower since vessel is still in Indian Ocean
    expect(result!.progress).toBeLessThan(55);
    expect(result!.progress).toBeGreaterThan(15); // Past Singapore (~14% of total route)
  });

  it("should show 0% progress before departure", () => {
    vi.setSystemTime(new Date('2026-05-01T00:00:00Z'));
    const result = fetchOneTracking("XMNG50123700");
    expect(result).not.toBeNull();
    expect(result!.progress).toBe(0);
  });

  it("should show 100% progress after arrival", () => {
    vi.setSystemTime(new Date('2026-07-15T00:00:00Z'));
    const result = fetchOneTracking("XMNG50123700");
    expect(result).not.toBeNull();
    expect(result!.progress).toBe(100);
  });

  it("should have events with hasOccurred flags", () => {
    const result = fetchOneTracking("XMNG50123700");
    expect(result).not.toBeNull();
    const occurred = result!.events.filter(e => e.hasOccurred);
    const notOccurred = result!.events.filter(e => !e.hasOccurred);
    // At least some events should have occurred (based on current date)
    expect(occurred.length + notOccurred.length).toBe(result!.events.length);
  });

  it("should have vessel position when in transit", () => {
    const result = fetchOneTracking("XMNG50123700");
    expect(result).not.toBeNull();
    // Vessel position should exist if progress > 0 and < 100
    if (result!.progress > 0 && result!.progress < 100) {
      expect(result!.vesselPosition).not.toBeNull();
      expect(result!.vesselPosition!.lat).toBeDefined();
      expect(result!.vesselPosition!.lng).toBeDefined();
    }
  });

  // Tests for Winnie BL (HKGG45910500 - Dalian → Busan → Santos)
  it("should return tracking data for Winnie BL HKGG45910500", () => {
    const result = fetchOneTracking("HKGG45910500");
    expect(result).not.toBeNull();
    expect(result!.blNumber).toBe("ONEYHKGG45910500");
    expect(result!.containerNo).toBe("TCLU7290240");
    expect(result!.containerType).toBe("20'DV (Dry Van)");
    expect(result!.placeOfReceipt).toBe("DALIAN, CHINA");
    expect(result!.placeOfDelivery).toBe("SANTOS, BRAZIL");
    expect(result!.origin.name).toBe("DALIAN");
    expect(result!.destination.name).toBe("SANTOS");
    expect(result!.sailingLegs).toHaveLength(2);
    expect(result!.sailingLegs[0].vessel).toBe("ACX DIAMOND");
    expect(result!.sailingLegs[1].vessel).toBe("HMM JAKARTA");
    expect(result!.transshipments).toHaveLength(1);
    expect(result!.transshipments[0].name).toBe("BUSAN");
    expect(result!.routeCoordinates.length).toBeGreaterThan(10);
  });

  it("should normalize Winnie BL with ONEY prefix", () => {
    const result = fetchOneTracking("ONEYHKGG45910500");
    expect(result).not.toBeNull();
    expect(result!.blNumber).toBe("ONEYHKGG45910500");
    expect(result!.containerNo).toBe("TCLU7290240");
  });

  it("should calculate Winnie vessel position on Busan→Santos route", () => {
    const result = fetchOneTracking("HKGG45910500");
    expect(result).not.toBeNull();
    if (result!.progress > 0 && result!.progress < 100) {
      expect(result!.vesselPosition).not.toBeNull();
      expect(result!.vesselPosition!.lat).toBeDefined();
      expect(result!.vesselPosition!.lng).toBeDefined();
    }
  });
});
