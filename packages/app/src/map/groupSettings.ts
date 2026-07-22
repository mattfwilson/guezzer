/**
 * GizzMap group membership — meta-table settings + derived crypto, in the
 * setMeta/getMeta idiom. The GROUP SECRET is the only credential (shared by
 * ≤5 friends via QR/text); token + AES key derive from it deterministically
 * (core deriveGroupKeys), memoized per secret so PBKDF2 (100k iterations)
 * runs once per session, not per poll.
 *
 * Identity: `mapMemberId` is a device-stable UUID (minted once, kept across
 * leave/join so re-joining never forks your dot); the display name REUSES the
 * existing `ownerName` meta row (D-17) — one name across backups and beacons.
 *
 * `crypto.subtle` exists only in SECURE contexts. On plain-HTTP LAN testing
 * (the uuid.ts trap) joinMapGroup returns a handled `insecure-context` error
 * — never a throw.
 */
import { config as coreConfig } from "@guezzer/core/config";
import { deriveGroupKeys, type GroupKeys } from "@guezzer/core";
import { db, getMeta, setMeta } from "../db/db.ts";
import { randomUUID } from "../uuid.ts";

const META_SECRET = "mapGroupSecret";
const META_MEMBER_ID = "mapMemberId";
const META_SHARE_LOCATION = "mapShareLocation";
const META_MY_STATUS = "mapMyStatus";
const META_MY_AVATAR = "mapMyAvatar";
const META_OWNER_NAME = "ownerName";

export interface MapGroup {
  secret: string;
  token: string;
  key: GroupKeys["key"];
  memberId: string;
  name: string;
}

let keysCache: { secret: string; keys: GroupKeys } | null = null;

async function keysFor(secret: string): Promise<GroupKeys> {
  if (keysCache?.secret === secret) return keysCache.keys;
  const keys = await deriveGroupKeys(secret, {
    iterations: coreConfig.map.KEY_DERIVE_ITERATIONS,
    salt: coreConfig.map.KEY_DERIVE_SALT,
  });
  keysCache = { secret, keys };
  return keys;
}

/** Device-stable member id — minted once, surviving leave/join. */
export async function ensureMemberId(): Promise<string> {
  const existing = await getMeta<string>(META_MEMBER_ID);
  if (existing) return existing;
  const minted = randomUUID();
  await setMeta(META_MEMBER_ID, minted);
  return minted;
}

/** The configured group with derived keys, or null when not joined (the JoinCard state). */
export async function loadMapGroup(): Promise<MapGroup | null> {
  const secret = await getMeta<string>(META_SECRET);
  if (!secret) return null;
  const name = (await getMeta<string>(META_OWNER_NAME)) ?? "?";
  const memberId = await ensureMemberId();
  const keys = await keysFor(secret);
  return { secret, token: keys.token, key: keys.key, memberId, name };
}

export type JoinResult =
  | { ok: true }
  | { ok: false; error: "secret-too-short" | "name-required" | "insecure-context" };

export async function joinMapGroup(secretRaw: string, nameRaw: string): Promise<JoinResult> {
  const secret = secretRaw.trim();
  const name = nameRaw.trim();
  if (secret.length < coreConfig.map.GROUP_SECRET_MIN_LENGTH) {
    return { ok: false, error: "secret-too-short" };
  }
  if (name.length === 0) return { ok: false, error: "name-required" };
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return { ok: false, error: "insecure-context" }; // http LAN testing (uuid.ts trap)
  }
  await keysFor(secret); // derive up-front so a join surfaces crypto failures here, not mid-sync
  await ensureMemberId();
  await setMeta(META_OWNER_NAME, name.slice(0, coreConfig.map.MEMBER_NAME_MAX_LENGTH));
  await setMeta(META_SECRET, secret);
  return { ok: true };
}

/**
 * Leave the group: clears the secret + all synced presence/pins locally
 * (they're the GROUP's data, not yours). Keeps `mapMemberId` (stable across
 * re-joins) and `ownerName` (shared with the dex identity, D-17).
 */
export async function leaveMapGroup(): Promise<void> {
  keysCache = null;
  await db.transaction("rw", db.meta, db.friendBeacons, db.mapPins, async () => {
    await db.meta.delete(META_SECRET);
    await db.meta.delete(META_MY_STATUS);
    await db.friendBeacons.clear();
    await db.mapPins.clear();
  });
}

/** Share-location preference ("ghost mode" when false). Default: true. */
export async function getShareLocation(): Promise<boolean> {
  return (await getMeta<boolean>(META_SHARE_LOCATION)) ?? true;
}

export async function setShareLocation(share: boolean): Promise<void> {
  await setMeta(META_SHARE_LOCATION, share);
}

/** One-tap check-in status; null = cleared. Meta keys for useLiveQuery readers. */
export const MAP_META_KEYS = {
  secret: META_SECRET,
  shareLocation: META_SHARE_LOCATION,
  myStatus: META_MY_STATUS,
  myAvatar: META_MY_AVATAR,
} as const;

export async function setMyStatus(status: string | null): Promise<void> {
  await setMeta(META_MY_STATUS, status);
}

/** Chosen Gizz avatar emoji; null = the name-initial fallback. Kept on leave (it's YOUR identity, not group data). */
export async function setMyAvatar(avatar: string | null): Promise<void> {
  await setMeta(META_MY_AVATAR, avatar);
}
