/**
 * The Supabase sync fence for schedule picks (owner request 2026-07-30) — a
 * structural sibling of `sync/progressSync.ts` and `map/mapSync.ts`:
 * STATELESS primitives over the Phase-17 `supabase` singleton, every
 * returned `{ error }` read (WR-02), rows validated at the untrusted read
 * boundary via core `sanitizeEventIds` (malformed row → null → skipped;
 * unknown event ids → dropped, a newer-artifact friend never crashes us).
 *
 * Offline-first ownership rule: the LOCAL Dexie own row is authoritative for
 * the signed-in user (toggles land instantly offline); Supabase is the
 * durable + shared source. Pulls therefore write FRIEND rows through
 * wholesale but adopt the server's own row ONLY when no local own row exists
 * (fresh device / evicted cache) — a stale server echo never clobbers
 * offline toggles. Pushes are idempotent whole-row upserts, re-fired on
 * engine start/reconnect, so a failed push self-heals.
 */
import { sanitizeEventIds } from "@guezzer/core";
import { db, type SchedulePickRow } from "../db/db.ts";
import { supabase } from "../db/supabase.ts";

const PICKS_TABLE = "schedule_picks";
const SELECT_COLUMNS = "user_id, display_name, event_ids, updated_at";

/** Upsert the signed-in user's full picks row. False on any soft failure (caller retries on next engine start/reconnect). */
export async function upsertOwnPicks(
  userId: string,
  displayName: string,
  eventIds: string[],
): Promise<boolean> {
  try {
    const { error } = await supabase.from(PICKS_TABLE).upsert(
      {
        user_id: userId,
        display_name: displayName,
        event_ids: eventIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) console.warn("[schedule] picks upsert failed:", error.message);
    return !error;
  } catch {
    return false; // offline — the local row already holds the truth
  }
}

/** One validated remote picks row. */
export interface RemotePicksRow {
  userId: string;
  displayName: string;
  eventIds: string[];
  updatedAt: string | null;
}

/** Validate an untrusted schedule_picks row; null → skipped (validateFriendRow discipline). */
export function validatePicksRow(
  raw: unknown,
  validEventIds: ReadonlySet<string>,
): RemotePicksRow | null {
  if (raw == null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const { user_id: userId, display_name: displayName, event_ids: eventIds, updated_at: updatedAt } = row;
  if (typeof userId !== "string" || userId.length === 0) return null;
  if (typeof displayName !== "string" || displayName.length === 0) return null;
  const sanitized = sanitizeEventIds(eventIds, validEventIds);
  if (sanitized === null) return null;
  return {
    userId,
    displayName,
    eventIds: sanitized,
    updatedAt: typeof updatedAt === "string" ? updatedAt : null,
  };
}

/**
 * Pull every picks row, validate, and write through to Dexie: friend rows
 * replaced wholesale (departed rows must not linger), the OWN row adopted
 * only when absent locally. Null return = pull failed, keep last-known cache.
 */
export async function refreshAllPicks(
  myUserId: string,
  validEventIds: ReadonlySet<string>,
): Promise<RemotePicksRow[] | null> {
  let data: unknown[] | null;
  try {
    const res = await supabase.from(PICKS_TABLE).select(SELECT_COLUMNS);
    if (res.error) return null;
    data = res.data ?? [];
  } catch {
    return null;
  }

  const rows = (data ?? [])
    .map((r) => validatePicksRow(r, validEventIds))
    .filter((r): r is RemotePicksRow => r != null);

  const now = Date.now();
  await db.transaction("rw", db.schedulePicks, async () => {
    const localOwn = await db.schedulePicks.get(myUserId);
    // Friend slice: replace wholesale.
    await db.schedulePicks.where("userId").notEqual(myUserId).delete();
    const toPut: SchedulePickRow[] = rows
      .filter((r) => r.userId !== myUserId)
      .map((r) => ({ ...r, fetchedAt: now }));
    // Own row: local truth wins; adopt the server copy only on a fresh device.
    if (!localOwn) {
      const serverOwn = rows.find((r) => r.userId === myUserId);
      if (serverOwn) toPut.push({ ...serverOwn, fetchedAt: now });
    }
    await db.schedulePicks.bulkPut(toPut);
  });
  return rows;
}

/** The channel handle (loose — mirrors progressSync). */
export type ScheduleChannelHandle = ReturnType<typeof supabase.channel>;

/** Subscribe to all schedule_picks changes — the realtime fast path over the pull. */
export function subscribeSchedulePicks(onChange: () => void): ScheduleChannelHandle {
  return supabase
    .channel("schedule-feed")
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table: PICKS_TABLE },
      () => onChange(),
    )
    .subscribe();
}

/** Tear down the schedule-feed channel (engine unmount). */
export async function removeScheduleChannel(channel: ScheduleChannelHandle): Promise<void> {
  await supabase.removeChannel(channel);
}
