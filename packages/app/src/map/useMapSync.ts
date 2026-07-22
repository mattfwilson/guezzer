/**
 * GizzMap sync engine — the app-tier lifecycle over core's pure pieces
 * (relay-client + group-crypto + presence), mirroring useLatestPoll's shape:
 * core does one polite unit of work per call; THIS hook owns cadence, gating,
 * and Dexie write-through.
 *
 * Per tick (config.map.POLL_INTERVAL_MS from CORE config, while mounted +
 * joined + online + relay configured):
 *   1. push own beacon IF the pure throttle gate passes (shouldPublishBeacon
 *      — time OR movement OR status change; ghost mode publishes nothing)
 *   2. push any offline-created pins (synced=0) and retry next tick on failure
 *   3. GET group state → decrypt (tolerant null per row) → zod-validate
 *      plaintexts → bulkPut friendBeacons / reconcile mapPins
 *
 * Reconciliation rule: the relay is the source of truth for SYNCED pins (a
 * friend deleting a pin must delete it here on next poll); UNSYNCED local
 * pins always survive until pushed. Beacons upsert whole (one row per member,
 * never history). Own beacon rows are skipped on read.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { config as coreConfig } from "@guezzer/core/config";
import {
  decryptJson,
  encryptJson,
  fetchGroupState,
  friendBeaconSchema,
  meetPinSchema,
  publishBeacon,
  publishPin,
  shouldPublishBeacon,
  type FriendBeacon,
  type MeetPin,
  type RelayDeps,
} from "@guezzer/core";
import { config } from "../config.ts";
import { db, type FriendBeaconRow, type MapPinRow } from "../db/db.ts";
import { useOnlineStatus } from "../live/useOnlineStatus.ts";
import { MAP_META_KEYS, type MapGroup } from "./groupSettings.ts";
import type { GeoFix } from "./useGeoPosition.ts";

export interface MapSyncState {
  /** Relay reachable + last poll succeeded (the SyncDot analog). */
  synced: boolean;
  online: boolean;
  relayConfigured: boolean;
}

export function useMapSync(
  group: MapGroup | null,
  fix: GeoFix | null,
  shareLocation: boolean,
): MapSyncState {
  const online = useOnlineStatus();
  const [synced, setSynced] = useState(false);
  const relayConfigured = config.map.RELAY_BASE_URL.length > 0;

  // The pure throttle gate's memory — survives re-renders, resets per group.
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
  const latest = useRef({ group, fix, shareLocation, myStatus, myAvatar, online });
  latest.current = { group, fix, shareLocation, myStatus, myAvatar, online };

  // The current tick fn, exposed across effects so a status change can sync NOW
  // (a check-in landing up to a full poll interval late defeats its purpose).
  const tickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!group || !relayConfigured) {
      setSynced(false);
      return;
    }
    lastPublished.current = null;
    let disposed = false;

    const deps: RelayDeps = {
      fetch: globalThis.fetch.bind(globalThis),
      baseUrl: config.map.RELAY_BASE_URL,
      token: group.token,
    };

    async function tick(): Promise<void> {
      const { group, fix, shareLocation, myStatus, myAvatar, online } = latest.current;
      if (disposed || !group || !online) return;

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
          const beacon: FriendBeacon = {
            memberId: group.memberId,
            name: group.name,
            lat: fix.lat,
            lng: fix.lng,
            accuracyM: fix.accuracyM,
            status: myStatus,
            avatar: myAvatar,
            updatedAt: fix.at,
          };
          const envelope = await encryptJson(group.key, beacon);
          const ok = await publishBeacon(deps, { memberId: group.memberId, ...envelope });
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
      const unsynced = await db.mapPins.where("synced").equals(0).toArray();
      for (const pin of unsynced) {
        const plaintext: MeetPin = {
          pinId: pin.pinId,
          createdBy: pin.createdBy,
          label: pin.label,
          lat: pin.lat,
          lng: pin.lng,
          createdAt: pin.createdAt,
        };
        const envelope = await encryptJson(group.key, plaintext);
        if (await publishPin(deps, { pinId: pin.pinId, ...envelope })) {
          await db.mapPins.update(pin.pinId, { synced: 1 });
        }
      }

      // 3. pull group state.
      const state = await fetchGroupState(deps);
      if (disposed) return;
      if (!state) {
        setSynced(false);
        return;
      }

      const beaconRows: FriendBeaconRow[] = [];
      for (const record of state.beacons) {
        if (record.memberId === group.memberId) continue; // own dot renders from the live fix
        const decrypted = await decryptJson(group.key, record);
        const parsed = friendBeaconSchema.safeParse(decrypted);
        if (!parsed.success) continue; // wrong-key/corrupt row — tolerant skip
        beaconRows.push({ ...parsed.data, receivedAt: record.receivedAt });
      }

      const serverPins: MapPinRow[] = [];
      for (const record of state.pins) {
        const decrypted = await decryptJson(group.key, record);
        const parsed = meetPinSchema.safeParse(decrypted);
        if (!parsed.success) continue;
        serverPins.push({ ...parsed.data, synced: 1 as const });
      }

      await db.transaction("rw", db.friendBeacons, db.mapPins, async () => {
        await db.friendBeacons.bulkPut(beaconRows);
        // Relay owns synced pins: replace that slice wholesale (friend deletes
        // propagate); unsynced local pins are untouched.
        await db.mapPins.where("synced").equals(1).delete();
        await db.mapPins.bulkPut(serverPins);
      });
      setSynced(true);
    }

    tickRef.current = () => void tick();
    void tick(); // immediate first sync — don't wait a full interval
    const id = setInterval(() => void tick(), coreConfig.map.POLL_INTERVAL_MS);
    const onOnline = () => void tick(); // resume silently on reconnect (SYNC-03 ethos)
    window.addEventListener("online", onOnline);
    return () => {
      disposed = true;
      tickRef.current = null;
      clearInterval(id);
      window.removeEventListener("online", onOnline);
    };
  }, [group, relayConfigured]);

  // A check-in or avatar change must land immediately — shouldPublishBeacon's
  // identity-change gates pass, so this out-of-band tick publishes right away
  // (and pulls fresh state).
  useEffect(() => {
    tickRef.current?.();
  }, [myStatus, myAvatar]);

  return { synced: synced && online, online, relayConfigured };
}
