/**
 * The Supabase sync fence for GizzMap (2026-07-30 — replaces the retired
 * Cloudflare Worker relay + group-phrase E2E crypto; the Phase-18 auth roster
 * IS the group now). A structural sibling of `sync/progressSync.ts`: STATELESS
 * primitives over the Phase-17 `supabase` singleton — never `createClient` —
 * with every returned `{ error }` read (WR-02: supabase-js RESOLVES on RLS/4xx
 * failures, so an unread error is a silent one).
 *
 * Read-boundary discipline (the validateFriendRow precedent): every row is
 * UNTRUSTED — RLS is write-own, so a friend fully controls their own row's
 * columns and could set any of them to hostile values via a direct REST write.
 * Malformed rows return null → skipped, never a crash; render strings
 * (name/status/label/avatar) are length-CLAMPED to the core config maxima so
 * an over-long value degrades instead of dropping the friend off the map.
 *
 * Failure tier mirrors the old relay client exactly: primitives return
 * false/null on ANY soft failure and never throw — a Supabase outage
 * mid-festival degrades the map to last-synced Dexie state, never crashes it.
 */
import { config as coreConfig } from "@guezzer/core/config";
import type { FriendBeaconRow, MapPinRow } from "../db/db.ts";
import { supabase } from "../db/supabase.ts";

const BEACONS_TABLE = "map_beacons";
const PINS_TABLE = "map_pins";
const BEACON_COLUMNS = "user_id, display_name, lat, lng, accuracy_m, status, avatar, updated_at";
const PIN_COLUMNS = "pin_id, created_by, created_by_name, label, lat, lng, created_at";

/** Own beacon, app-shaped (epoch-ms stamp; the row write converts to ISO). */
export interface OwnBeacon {
  userId: string;
  displayName: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
  status: string | null;
  avatar: string | null;
  /** Epoch-ms stamp of the underlying GPS fix. */
  updatedAt: number;
}

/** Upsert own beacon row (one row per user — never a history). False on any soft failure. */
export async function upsertOwnBeacon(beacon: OwnBeacon): Promise<boolean> {
  try {
    const { error } = await supabase.from(BEACONS_TABLE).upsert(
      {
        user_id: beacon.userId,
        display_name: beacon.displayName,
        lat: beacon.lat,
        lng: beacon.lng,
        accuracy_m: beacon.accuracyM,
        status: beacon.status,
        avatar: beacon.avatar,
        updated_at: new Date(beacon.updatedAt).toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) console.warn("[map] beacon upsert failed:", error.message);
    return !error;
  } catch {
    return false; // offline/timeout — the sync loop retries next tick
  }
}

/**
 * Push a locally-created pin. `ignoreDuplicates` makes a retry after a
 * success-that-never-got-marked idempotent (`on conflict do nothing`) without
 * needing an RLS update policy on pins.
 */
export async function insertPin(pin: {
  pinId: string;
  createdBy: string;
  createdByName: string;
  label: string;
  lat: number;
  lng: number;
  createdAt: number;
}): Promise<boolean> {
  try {
    const { error } = await supabase.from(PINS_TABLE).upsert(
      {
        pin_id: pin.pinId,
        created_by: pin.createdBy,
        created_by_name: pin.createdByName,
        label: pin.label,
        lat: pin.lat,
        lng: pin.lng,
        created_at: new Date(pin.createdAt).toISOString(),
      },
      { onConflict: "pin_id", ignoreDuplicates: true },
    );
    if (error) console.warn("[map] pin insert failed:", error.message);
    return !error;
  } catch {
    return false;
  }
}

/** Best-effort remote pin delete (any signed-in friend may remove any pin). */
export async function deletePinRemote(pinId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(PINS_TABLE).delete().eq("pin_id", pinId);
    if (error) console.warn("[map] pin delete failed:", error.message);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Opportunistic TTL purge of expired pins (PIN_TTL_MS) — Supabase has no
 * server-side TTL, and the delete-any policy lets whichever friend syncs
 * first do the sweep. Best-effort: the read boundary drops expired pins
 * regardless, so a failed purge only leaves invisible rows behind.
 */
export async function purgeExpiredPins(nowMs: number): Promise<void> {
  const cutoff = new Date(nowMs - coreConfig.map.PIN_TTL_MS).toISOString();
  try {
    await supabase.from(PINS_TABLE).delete().lt("created_at", cutoff);
  } catch {
    // ignore — purely housekeeping
  }
}

export interface MapState {
  /** Validated friend beacons, own row excluded. */
  beacons: FriendBeaconRow[];
  /** Validated, unexpired pins (synced=1 — these came FROM Supabase). */
  pins: MapPinRow[];
}

/**
 * Pull the full map state (≤5 beacon rows + a handful of pins — incremental
 * sync isn't worth its complexity). Null on ANY soft failure so the caller
 * keeps rendering last-synced Dexie state.
 */
export async function fetchMapState(
  myUserId: string,
  nowMs: number,
): Promise<MapState | null> {
  try {
    const [beaconsRes, pinsRes] = await Promise.all([
      supabase.from(BEACONS_TABLE).select(BEACON_COLUMNS),
      supabase.from(PINS_TABLE).select(PIN_COLUMNS),
    ]);
    if (beaconsRes.error || pinsRes.error) return null;
    return {
      beacons: (beaconsRes.data ?? [])
        .map((row: unknown) => validateBeaconRow(row, myUserId))
        .filter((row: FriendBeaconRow | null): row is FriendBeaconRow => row != null),
      pins: (pinsRes.data ?? [])
        .map((row: unknown) => validatePinRow(row, nowMs))
        .filter((row: MapPinRow | null): row is MapPinRow => row != null),
    };
  } catch {
    return null;
  }
}

function asClampedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.slice(0, maxLength);
}

function isLat(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 90;
}

function isLng(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 180;
}

/** ISO timestamptz → epoch ms; null on anything unparseable. */
function parsedMs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Validate an untrusted map_beacons row; null → skipped. Drops the own row. */
export function validateBeaconRow(
  raw: unknown,
  myUserId: string,
): FriendBeaconRow | null {
  if (raw == null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const userId = row.user_id;
  if (typeof userId !== "string" || userId.length === 0) return null;
  if (userId === myUserId) return null; // own dot renders from the live fix
  const name = asClampedString(row.display_name, coreConfig.map.MEMBER_NAME_MAX_LENGTH);
  if (name === null) return null;
  if (!isLat(row.lat) || !isLng(row.lng)) return null;
  const updatedAt = parsedMs(row.updated_at);
  if (updatedAt === null) return null;
  const accuracyM =
    typeof row.accuracy_m === "number" && Number.isFinite(row.accuracy_m) && row.accuracy_m >= 0
      ? row.accuracy_m
      : null;
  return {
    memberId: userId,
    name,
    lat: row.lat,
    lng: row.lng,
    accuracyM,
    status: asClampedString(row.status, coreConfig.map.STATUS_MAX_LENGTH),
    avatar: asClampedString(row.avatar, coreConfig.map.AVATAR_MAX_LENGTH),
    updatedAt,
  };
}

/** Validate an untrusted map_pins row; null → skipped. Drops pins past PIN_TTL_MS. */
export function validatePinRow(raw: unknown, nowMs: number): MapPinRow | null {
  if (raw == null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const pinId = row.pin_id;
  const createdBy = row.created_by;
  if (typeof pinId !== "string" || pinId.length === 0) return null;
  if (typeof createdBy !== "string" || createdBy.length === 0) return null;
  const createdByName = asClampedString(
    row.created_by_name,
    coreConfig.map.MEMBER_NAME_MAX_LENGTH,
  );
  const label = asClampedString(row.label, coreConfig.map.PIN_LABEL_MAX_LENGTH);
  if (createdByName === null || label === null) return null;
  if (!isLat(row.lat) || !isLng(row.lng)) return null;
  const createdAt = parsedMs(row.created_at);
  if (createdAt === null) return null;
  if (nowMs - createdAt >= coreConfig.map.PIN_TTL_MS) return null; // expired — client-enforced TTL
  return {
    pinId,
    createdBy,
    createdByName,
    label,
    lat: row.lat,
    lng: row.lng,
    createdAt,
    synced: 1,
  };
}

// ── Realtime subscription ────────────────────────────────────────────────────

/** The channel handle `subscribeMapChanges` returns (loose — mirrors progressSync). */
export type MapChannelHandle = ReturnType<typeof supabase.channel>;

/**
 * Subscribe to ALL change events on both map tables and invoke `onChange` on
 * each — the fast path over the interval backstop. Fires only because the map
 * foundation migration added both tables to the `supabase_realtime`
 * publication (its absence fails SILENTLY — do not remove it). Only the
 * single map-mounted engine calls this.
 */
export function subscribeMapChanges(onChange: () => void): MapChannelHandle {
  return supabase
    .channel("map-feed")
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table: BEACONS_TABLE },
      () => onChange(),
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table: PINS_TABLE },
      () => onChange(),
    )
    .subscribe();
}

/** Tear down the map-feed channel (engine unmount). */
export async function removeMapChannel(channel: MapChannelHandle): Promise<void> {
  await supabase.removeChannel(channel);
}
