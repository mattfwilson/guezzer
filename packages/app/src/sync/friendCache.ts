/**
 * The offline last-known friend-sync cache (Phase 19, D-18) — the thin Dexie
 * read/write seam over the `friendProgressCache` table (db.ts version(8)). The
 * app-wide `useProgressSync` engine writes the survivors of every validated
 * re-pull here; the Friends surface hydrates from here when offline so a
 * dead-signal venue never shows a blank list (the `You` row stays live off the
 * local dex; friends render dimmed with an `Offline · as of {time}` marker).
 *
 * `FriendRowData` is the in-memory shape the engine and the read hook pass
 * around — a validated friend row WITHOUT the local `fetchedAt` stamp (that is a
 * cache-persistence concern the row itself does not carry). `readFriendCache`
 * derives the single `asOf` clock from the MAX `fetchedAt` across cached rows.
 *
 * No Supabase, no network here — Dexie only. The rows written are already
 * validated (each `summary` passed core `parseSharedProgress` before it reached
 * this module), so this layer performs no re-validation.
 */
import type { SharedProgress } from "@guezzer/core";
import { db } from "../db/db.ts";

/**
 * A validated friend progress row as the engine + read hook pass it around. The
 * `userId`/`displayName` come straight off the first-class Supabase row columns;
 * `summary` has already passed `parseSharedProgress`; `updatedAt` is the friend's
 * client-set row stamp (may be null). No local `fetchedAt` — that is stamped only
 * on the persisted cache row (see `FriendProgressCacheRow`).
 */
export interface FriendRowData {
  userId: string;
  displayName: string;
  summary: SharedProgress;
  updatedAt: string | null;
}

/**
 * Persist the survivors of a validated re-pull as the offline backstop (D-18),
 * stamping every row with the pull's local `fetchedAt` (OUR `Date.now()`, the
 * honesty clock for the "as of {time}" marker). The cache is RECONCILED to the
 * pull result inside a transaction (WR-03): rows for friends absent from this
 * non-empty pull are deleted before the `bulkPut`, so a friend who deleted/reset
 * their `progress` row (or was otherwise removed) is EVICTED rather than
 * persisting forever as a dimmed "last-known" ghost with stale numbers on the
 * offline path. When `rows` is empty the cache is left as-is (a failed/empty pull
 * must never wipe the last-known friends the venue is relying on).
 */
export async function writeFriendCache(
  rows: FriendRowData[],
  fetchedAt: number,
): Promise<void> {
  if (rows.length === 0) return;
  await db.transaction("rw", db.friendProgressCache, async () => {
    const keep = new Set(rows.map((row) => row.userId));
    const stale = (await db.friendProgressCache.toArray())
      .map((row) => row.userId)
      .filter((userId) => !keep.has(userId));
    if (stale.length > 0) await db.friendProgressCache.bulkDelete(stale);
    await db.friendProgressCache.bulkPut(rows.map((row) => ({ ...row, fetchedAt })));
  });
}

/**
 * Read the last-known cached friend rows for the offline path (D-18). Returns
 * the rows as `FriendRowData` (the `fetchedAt` stamp dropped from each) plus the
 * single `fetchedAt` clock = the MAX across cached rows (null when the cache is
 * empty), which the read hook renders as `Offline · as of {time}`.
 */
export async function readFriendCache(): Promise<{
  rows: FriendRowData[];
  fetchedAt: number | null;
}> {
  const cached = await db.friendProgressCache.toArray();
  let fetchedAt: number | null = null;
  const rows: FriendRowData[] = cached.map((row) => {
    if (fetchedAt == null || row.fetchedAt > fetchedAt) fetchedAt = row.fetchedAt;
    return {
      userId: row.userId,
      displayName: row.displayName,
      summary: row.summary,
      updatedAt: row.updatedAt,
    };
  });
  return { rows, fetchedAt };
}
