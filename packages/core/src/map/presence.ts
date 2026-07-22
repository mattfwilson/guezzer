/**
 * GizzMap presence vocabulary + honest-staleness derivation.
 *
 * The GizzMap signature requirement (owner exploration 2026-07-21): a
 * last-known pin must NEVER masquerade as live. iOS PWAs cannot background-
 * track — beacons only flow while the app is foregrounded — so every render
 * decision keys off `stalenessTier`, a pure function of (updatedAt, now).
 * `now` is always a parameter, never Date.now() (the deriveTopOpeners
 * zero-wall-clock discipline): the app tier owns time, core stays
 * deterministic and fixture-testable.
 *
 * Beacons/pins carry PLAINTEXT domain shapes here; the relay only ever sees
 * their encrypted envelopes (group-crypto.ts + relay-client.ts).
 */
import { z } from "zod";
import { config } from "../config.ts";
import {
  compass8,
  haversineMeters,
  initialBearingDeg,
  type Compass8,
  type GeoPoint,
} from "./georef.ts";

/** A friend's decrypted presence beacon — the plaintext inside the relay envelope. */
export const friendBeaconSchema = z.strictObject({
  memberId: z.string().min(1),
  name: z.string().min(1).max(config.map.MEMBER_NAME_MAX_LENGTH),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  /** GPS accuracy radius in meters; null when the device didn't report one. */
  accuracyM: z.number().nonnegative().nullable(),
  /** One-tap check-in status ("At the rail"); null when unset. */
  status: z.string().max(config.map.STATUS_MAX_LENGTH).nullable(),
  /**
   * Chosen map avatar — an emoji from the app's Gizz set ("🐊" Gizzy Gator…);
   * null = render the name initial. `.default(null)` keeps beacons from
   * pre-avatar builds parseable during the crew's update window (a missing
   * key is filled, never rejected).
   */
  avatar: z.string().max(config.map.AVATAR_MAX_LENGTH).nullable().default(null),
  /** Sender's epoch-ms stamp of the underlying GPS fix. */
  updatedAt: z.number().int().nonnegative(),
});

export type FriendBeacon = z.infer<typeof friendBeaconSchema>;

/** A shared "meet here" pin — the plaintext inside the relay envelope. Synced in lat/lng, ALWAYS (never pixels). */
export const meetPinSchema = z.strictObject({
  pinId: z.string().min(1),
  createdBy: z.string().min(1).max(config.map.MEMBER_NAME_MAX_LENGTH),
  label: z.string().min(1).max(config.map.PIN_LABEL_MAX_LENGTH),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  createdAt: z.number().int().nonnegative(),
});

export type MeetPin = z.infer<typeof meetPinSchema>;

/**
 * Honest-staleness tiers, thresholds in config.map. `gone` beacons are not
 * rendered at all; the tiers in between drive opacity + explicit age copy.
 */
export type StalenessTier = "fresh" | "recent" | "stale" | "gone";

export function stalenessTier(updatedAtMs: number, nowMs: number): StalenessTier {
  const age = nowMs - updatedAtMs;
  if (age < config.map.STALE_FRESH_MAX_MS) return "fresh";
  if (age < config.map.STALE_RECENT_MAX_MS) return "recent";
  if (age < config.map.STALE_GONE_AFTER_MS) return "stale";
  return "gone";
}

/**
 * Human age copy for a beacon ("now", "4 min ago", "2 h ago"). Pure — the app
 * re-renders it on its own ticker cadence.
 */
export function ageLabel(updatedAtMs: number, nowMs: number): string {
  const age = Math.max(0, nowMs - updatedAtMs);
  if (age < 60_000) return "now";
  if (age < 3_600_000) return `${Math.floor(age / 60_000)} min ago`;
  return `${Math.floor(age / 3_600_000)} h ago`;
}

/** Distance + direction between two people/points — the "~120m NE" copy substrate. */
export interface GeoOffset {
  meters: number;
  bearingDeg: number;
  compass: Compass8;
}

export function describeOffset(from: GeoPoint, to: GeoPoint): GeoOffset {
  const bearingDeg = initialBearingDeg(from, to);
  return {
    meters: haversineMeters(from, to),
    bearingDeg,
    compass: compass8(bearingDeg),
  };
}

/**
 * The beacon-publish throttle gate (config.map BEACON_MIN_INTERVAL_MS /
 * BEACON_MIN_MOVE_METERS): publish when enough time has passed OR we've moved
 * far enough — and always for a first fix, a status change, or an avatar
 * change (identity edits must land immediately; that's their whole point).
 * Pure so the throttle policy is testable without a fake geolocation stack.
 */
export function shouldPublishBeacon(input: {
  last: {
    at: GeoPoint;
    publishedAtMs: number;
    status: string | null;
    avatar: string | null;
  } | null;
  next: { at: GeoPoint; nowMs: number; status: string | null; avatar: string | null };
}): boolean {
  const { last, next } = input;
  if (!last) return true;
  if (next.status !== last.status) return true;
  if (next.avatar !== last.avatar) return true;
  if (next.nowMs - last.publishedAtMs >= config.map.BEACON_MIN_INTERVAL_MS) return true;
  return haversineMeters(last.at, next.at) >= config.map.BEACON_MIN_MOVE_METERS;
}
