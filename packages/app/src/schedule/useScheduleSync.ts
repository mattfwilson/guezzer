/**
 * The schedule-picks ENGINE + the own-toggle write path (owner request
 * 2026-07-30). View-scoped like the map engine (mounted by ScheduleView):
 * picks change rarely, so syncing only while the tab is open is polite and
 * sufficient — the realtime channel + a pull on mount/reconnect keep the
 * who's-going strips fresh.
 *
 * Toggle flow (offline-first): `toggleOwnPick` writes the LOCAL Dexie own
 * row synchronously-ish (useLiveQuery repaints instantly, signal or not),
 * then schedules a debounced idempotent whole-row push. Failed pushes
 * self-heal: the engine re-pushes the own row on every mount and reconnect.
 */
import { useEffect } from "react";
import type { AuthIdentity } from "../auth/identityRecord.ts";
import { config } from "../config.ts";
import { db } from "../db/db.ts";
import { scheduleEventIds } from "./scheduleArtifact.ts";
import {
  refreshAllPicks,
  removeScheduleChannel,
  subscribeSchedulePicks,
  upsertOwnPicks,
} from "./scheduleSync.ts";

async function pushOwn(identity: AuthIdentity): Promise<void> {
  const own = await db.schedulePicks.get(identity.userId);
  if (!own) return; // nothing picked yet — nothing to heal
  await upsertOwnPicks(identity.userId, identity.displayName, own.eventIds);
}

let pushTimer: number | null = null;

/** Debounced own-row push — a toggle burst lands as one upsert (PUSH_DEBOUNCE_MS). */
function schedulePush(identity: AuthIdentity): void {
  if (pushTimer !== null) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    void pushOwn(identity);
  }, config.schedule.PUSH_DEBOUNCE_MS);
}

/**
 * Toggle one event on the signed-in user's picks. Local write first (instant
 * UI, works offline), then the debounced push. Ids outside the bundled
 * artifact are ignored defensively — the UI can never offer one.
 */
export async function toggleOwnPick(
  identity: AuthIdentity,
  eventId: string,
): Promise<void> {
  if (!scheduleEventIds().has(eventId)) return;
  await db.transaction("rw", db.schedulePicks, async () => {
    const own = await db.schedulePicks.get(identity.userId);
    const current = own?.eventIds ?? [];
    const eventIds = current.includes(eventId)
      ? current.filter((id) => id !== eventId)
      : [...current, eventId];
    await db.schedulePicks.put({
      userId: identity.userId,
      displayName: identity.displayName,
      eventIds,
      updatedAt: new Date().toISOString(),
      fetchedAt: Date.now(),
    });
  });
  schedulePush(identity);
}

/** Mount-scoped sync engine: heal-push own row, pull all, subscribe realtime, resync on reconnect. */
export function useScheduleSync(identity: AuthIdentity | null): void {
  const userId = identity?.userId;
  useEffect(() => {
    if (!identity || !userId) return;
    const pull = () => void refreshAllPicks(userId, scheduleEventIds());
    void pushOwn(identity); // self-heal a push that failed offline
    pull();
    const channel = subscribeSchedulePicks(pull);
    const onOnline = () => {
      void pushOwn(identity);
      pull();
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      void removeScheduleChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identity is stable per userId (cached record)
  }, [userId]);
}
