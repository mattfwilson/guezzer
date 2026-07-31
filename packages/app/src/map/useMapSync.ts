/**
 * GizzMap sync engine — the app-tier lifecycle over the Supabase fence
 * (mapSync.ts) + core's pure throttle gate, mirroring useLatestPoll's shape:
 * the fence does one polite unit of work per call; THIS hook owns cadence,
 * gating, and Dexie write-through. Identity is the Phase-18 auth record —
 * there is no group to join; everyone signed in is on the map.
 *
 * Per tick (config.map.POLL_INTERVAL_MS backstop while mounted + signed-in +
 * online, plus an out-of-band tick on every realtime change event):
 *   1. push own beacon IF the pure throttle gate passes (shouldPublishBeacon
 *      — time OR movement OR status/avatar change; ghost mode publishes nothing)
 *   2. push any offline-created pins (synced=0), re-stamped with the CURRENT
 *      identity, and retry next tick on failure
 *   3. pull map state → validate rows at the read boundary → replace
 *      friendBeacons / reconcile mapPins
 *
 * Reconciliation rule: Supabase is the source of truth for SYNCED pins (a
 * friend deleting a pin must delete it here on next pull) and for the whole
 * friendBeacons cache (departed-friend rows must not linger); UNSYNCED local
 * pins always survive until pushed. Own beacon rows are dropped on read.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { config as coreConfig } from "@guezzer/core/config";
import { shouldPublishBeacon } from "@guezzer/core";
import type { AuthIdentity } from "../auth/identityRecord.ts";
import { db } from "../db/db.ts";
import { useOnlineStatus } from "../live/useOnlineStatus.ts";
import {
  fetchMapState,
  insertPin,
  purgeExpiredPins,
  removeMapChannel,
  subscribeMapChanges,
  upsertOwnBeacon,
} from "./mapSync.ts";
import { MAP_META_KEYS } from "./mapPrefs.ts";
import type { GeoFix } from "./useGeoPosition.ts";

export interface MapSyncState {
  /** Supabase reachable + last pull succeeded (the SyncDot analog). */
  synced: boolean;
  online: boolean;
}

export function useMapSync(
  identity: AuthIdentity | null,
  fix: GeoFix | null,
  shareLocation: boolean,
): MapSyncState {
  const online = useOnlineStatus();
  const [synced, setSynced] = useState(false);

  // The pure throttle gate's memory — survives re-renders, resets per identity.
  const lastPublished = useRef<{
    at: { lat: number; lng: number };
    publishedAtMs: number;
    status: string | null;
    avatar: string | null;
  } | null>(null);

  const myStatus =
    useLiveQuery(
      async () => (await db.meta.get(MAP_META_KEYS.myStatus))?.value as string | null,
      [],
      null,
    ) ?? null;
  const myAvatar =
    useLiveQuery(
      async () => (await db.meta.get(MAP_META_KEYS.myAvatar))?.value as string | null,
      [],
      null,
    ) ?? null;

  // Latest values in refs so the interval closure never goes stale.
  const latest = useRef({ identity, fix, shareLocation, myStatus, myAvatar, online });
  latest.current = { identity, fix, shareLocation, myStatus, myAvatar, online };

  // The current tick fn, exposed across effects so a status change can sync NOW
  // (a check-in landing up to a full poll interval late defeats its purpose).
  const tickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!identity) {
      setSynced(false);
      return;
    }
    lastPublished.current = null;
    let disposed = false;

    async function tick(): Promise<void> {
      const { identity, fix, shareLocation, myStatus, myAvatar, online } = latest.current;
      if (disposed || !identity || !online) return;

      // 1. own beacon — ghost mode (shareLocation=false) publishes nothing.
      if (shareLocation && fix) {
        const nowMs = Date.now();
        const next = {
          at: { lat: fix.lat, lng: fix.lng },
          nowMs,
          status: myStatus,
          avatar: myAvatar,
        };
        if (shouldPublishBeacon({ last: lastPublished.current, next })) {
          const ok = await upsertOwnBeacon({
            userId: identity.userId,
            displayName: identity.displayName,
            lat: fix.lat,
            lng: fix.lng,
            accuracyM: fix.accuracyM,
            status: myStatus,
            avatar: myAvatar,
            updatedAt: fix.at,
          });
          if (ok) {
            lastPublished.current = {
              at: next.at,
              publishedAtMs: nowMs,
              status: myStatus,
              avatar: myAvatar,
            };
          }
        }
      }

      // 2. push offline-created pins (synced=0); failures retry next tick.
      //    Re-stamp with the CURRENT identity — an unsynced pin is mine by
      //    definition, and the RLS insert policy requires my own user id.
      const unsynced = await db.mapPins.where("synced").equals(0).toArray();
      for (const pin of unsynced) {
        const ok = await insertPin({
          pinId: pin.pinId,
          createdBy: identity.userId,
          createdByName: identity.displayName,
          label: pin.label,
          lat: pin.lat,
          lng: pin.lng,
          createdAt: pin.createdAt,
        });
        if (ok) await db.mapPins.update(pin.pinId, { synced: 1 });
      }

      // 3. pull map state.
      const state = await fetchMapState(identity.userId, Date.now());
      if (disposed) return;
      if (!state) {
        setSynced(false);
        return;
      }

      await db.transaction("rw", db.friendBeacons, db.mapPins, async () => {
        // Supabase owns the beacon cache wholesale — a departed friend's row
        // must not linger at "stale" opacity forever.
        await db.friendBeacons.clear();
        await db.friendBeacons.bulkPut(state.beacons);
        // ...and the synced pin slice (friend deletes propagate); unsynced
        // local pins are untouched.
        await db.mapPins.where("synced").equals(1).delete();
        await db.mapPins.bulkPut(state.pins);
      });
      setSynced(true);
    }

    tickRef.current = () => void tick();
    void purgeExpiredPins(Date.now()); // opportunistic TTL sweep, once per mount
    void tick(); // immediate first sync — don't wait a full interval
    const id = setInterval(() => void tick(), coreConfig.map.POLL_INTERVAL_MS);
    const channel = subscribeMapChanges(() => void tick()); // realtime fast path
    const onOnline = () => void tick(); // resume silently on reconnect (SYNC-03 ethos)
    window.addEventListener("online", onOnline);
    return () => {
      disposed = true;
      tickRef.current = null;
      clearInterval(id);
      void removeMapChannel(channel);
      window.removeEventListener("online", onOnline);
    };
  }, [identity]);

  // A check-in or avatar change must land immediately — shouldPublishBeacon's
  // identity-change gates pass, so this out-of-band tick publishes right away
  // (and pulls fresh state).
  useEffect(() => {
    tickRef.current?.();
  }, [myStatus, myAvatar]);

  return { synced: synced && online, online };
}
