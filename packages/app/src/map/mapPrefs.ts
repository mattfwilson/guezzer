/**
 * GizzMap per-device preferences — meta-table settings in the setMeta/getMeta
 * idiom. Identity (who you are on the map) is the Phase-18 auth record
 * (useAuthIdentity), not stored here; the group IS the signed-in roster since
 * the group-phrase join flow was retired (2026-07-30). What remains device-
 * local: the ghost-mode toggle, the one-tap check-in status, and the chosen
 * Gizz avatar (yours across sign-ins on this phone, not group data).
 */
import { db, getMeta, setMeta } from "../db/db.ts";

const META_SHARE_LOCATION = "mapShareLocation";
const META_MY_STATUS = "mapMyStatus";
const META_MY_AVATAR = "mapMyAvatar";

/** Share-location preference ("ghost mode" when false). Default: true. */
export async function getShareLocation(): Promise<boolean> {
  return (await getMeta<boolean>(META_SHARE_LOCATION)) ?? true;
}

export async function setShareLocation(share: boolean): Promise<void> {
  await setMeta(META_SHARE_LOCATION, share);
}

/** Meta keys for useLiveQuery readers. */
export const MAP_META_KEYS = {
  shareLocation: META_SHARE_LOCATION,
  myStatus: META_MY_STATUS,
  myAvatar: META_MY_AVATAR,
} as const;

/** One-tap check-in status; null = cleared. */
export async function setMyStatus(status: string | null): Promise<void> {
  await setMeta(META_MY_STATUS, status);
}

/** Chosen Gizz avatar emoji; null = the name-initial fallback. */
export async function setMyAvatar(avatar: string | null): Promise<void> {
  await setMeta(META_MY_AVATAR, avatar);
}

/**
 * One-time hygiene for phrase-era devices: drop the retired group-secret /
 * member-id meta rows so no credential material outlives the feature.
 * Fire-and-forget on map mount; a no-op everywhere else.
 */
export async function clearLegacyGroupMeta(): Promise<void> {
  await db.meta.bulkDelete(["mapGroupSecret", "mapMemberId"]);
}
