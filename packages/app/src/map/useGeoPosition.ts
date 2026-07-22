/**
 * Foreground geolocation watch (GizzMap). The wakeLock.ts discipline:
 * feature-detect, never throw, degrade to a calm handled state. iOS PWAs
 * cannot background-track — the watch runs only while this hook is mounted
 * (the map tab, foregrounded), which is the honest ceiling of the platform
 * (exploration 2026-07-21: beacons are freshest during sets, when Show Mode
 * holds the screen awake anyway).
 *
 * `enableHighAccuracy: false` deliberately — coarse fixes cost less battery,
 * and crowd-GPS is ±20–50m regardless (the staleness/accuracy UI is honest
 * about it).
 */
import { useEffect, useState } from "react";

export interface GeoFix {
  lat: number;
  lng: number;
  accuracyM: number | null;
  /** Device epoch-ms of the fix. */
  at: number;
}

export type GeoError = "unsupported" | "denied" | null;

export function useGeoPosition(enabled: boolean): { fix: GeoFix | null; error: GeoError } {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [error, setError] = useState<GeoError>(null);

  useEffect(() => {
    if (!enabled) {
      setFix(null);
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("unsupported");
      return;
    }
    setError(null);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setError(null);
        setFix({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
          at: position.timestamp,
        });
      },
      (err) => {
        // PERMISSION_DENIED is the only state worth distinct copy; transient
        // POSITION_UNAVAILABLE/TIMEOUT just leave the last fix standing.
        if (err.code === err.PERMISSION_DENIED) {
          setError("denied");
          setFix(null);
        }
      },
      { enableHighAccuracy: false, maximumAge: 15_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return { fix, error };
}
