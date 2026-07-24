/**
 * The app-wide shared-progress ENGINE (Phase 19, D-16/D-17, PROG-02/05). Mounted
 * ONCE at the app shell (App.tsx, next to `useBingoCelebrations()`), it mirrors
 * that precedent exactly: mount once, render nothing, gate internally, drive from
 * live sources. It is the SOLE owner of the `postgres_changes` subscription and
 * the debounced own-row upsert — making both singletons — while
 * `useFriendsProgress` stays a pure reader over the shared store this engine
 * publishes.
 *
 * Because it lives at the shell (NOT inside the Friends segment), the residency
 * payoff happens app-wide while signed in: the user's own dex upserts as they log
 * a setlist in Show Mode / LiveGizz (PROG-02), and a friend's row moves live via
 * the subscription (PROG-05) — never only on the Friends tab (the locked D-16 fix
 * for the prior engine-inside-the-read-hook wiring).
 *
 * Gating (all internal, so App.tsx mounts it unconditionally):
 *  - No signed-in identity (`useAuthIdentity() == null`) → a calm no-op: no
 *    subscription, no writes (the signed-in scope).
 *  - Debounced own-row upsert fires ONLY when `stats.ready && stats.dex != null`
 *    (Pitfall 5 — an empty-table first paint never writes a 0% summary).
 *  - Offline → hydrate the store from the Dexie cache (D-18) so a dead-signal
 *    venue is never blank; reconnect flushes the own row + re-pulls once and
 *    re-establishes the subscription (D-17).
 */
import { useEffect, useRef } from "react";
import { config } from "../config.ts";
import { useAuthIdentity } from "../auth/useAuthIdentity.ts";
import { useDexStats } from "../dex/useDexStats.ts";
import { useOnlineStatus } from "../live/useOnlineStatus.ts";
import { readFriendCache } from "./friendCache.ts";
import {
  refreshAllFriends,
  removeChannel,
  setSyncState,
  subscribeProgress,
  upsertOwnProgress,
} from "./progressSync.ts";

export function useProgressSync(): void {
  const identity = useAuthIdentity();
  const userId = identity?.userId ?? null;
  const displayName = identity?.displayName ?? null;
  const stats = useDexStats();
  const online = useOnlineStatus();

  const ready = stats.ready;
  const dex = stats.dex;

  // ── Subscription + pull lifecycle (first-sync pull + reconnect re-pull +
  // resubscribe + offline hydrate). Re-runs when the identity or connectivity
  // flips: going online (re)subscribes and re-pulls (D-17); going offline tears
  // the channel down and hydrates the store from the last-known cache (D-18). ──
  useEffect(() => {
    if (!userId) return; // signed out → engine no-op (signed-in scope)

    // Per-run cancellation guard (WR-01): a fast online↔offline flip re-runs this
    // effect before an in-flight promise resolves. Without this guard a network
    // pull started while online can resolve AFTER the offline hydrate and flip
    // `offline` back to false — rendering stale online data un-dimmed with no
    // `Offline · as of {time}` marker. Every async `setSyncState` below no-ops
    // once its run has been superseded.
    let cancelled = false;

    if (!online) {
      // Dead-signal venue: hydrate friends from the Dexie backstop so the list is
      // never blank; the `You` row stays live off the local dex elsewhere (D-18).
      void readFriendCache().then(({ rows, fetchedAt }) => {
        if (cancelled) return;
        setSyncState({ friends: rows, offline: true, asOf: fetchedAt });
      });
      return () => {
        cancelled = true;
      };
    }

    // Online: clear the offline flag, (re)establish the app-wide subscription, and
    // do the first-sync / reconnect full re-pull.
    setSyncState({ offline: false });
    const pull = () => {
      void refreshAllFriends(userId).then((rows) => {
        if (cancelled) return; // a stale pull must not clobber current connectivity
        if (rows == null) {
          // Whole-pull failure: keep last-known friends, surface calm degraded copy.
          setSyncState({ error: config.copy.friends.degradedRead });
          return;
        }
        setSyncState({ friends: rows, asOf: Date.now(), error: null, offline: false });
      });
    };
    const channel = subscribeProgress(pull);
    pull();

    return () => {
      cancelled = true;
      void removeChannel(channel);
    };
  }, [userId, online]);

  // ── Debounced own-row content upsert (PROG-02, D-15). Watches the live dex;
  // coalesces a rapid live-logging burst into ONE write after DEBOUNCE_MS. Gated
  // on `ready && dex != null` (Pitfall 5) and on `online` (no futile offline
  // write). `dex` is a fresh reference on every table change, so each change
  // reschedules (the cleanup clears the pending timer). This also fires the
  // initial upsert-own on sign-in (the first-sync write, just debounced). ──
  useEffect(() => {
    if (!userId || !displayName || !online) return;
    if (!ready || dex == null) return; // Pitfall 5 — no empty-table 0% write
    const timer = setTimeout(() => {
      void upsertOwnProgress(userId, displayName, dex).catch(() => {
        // A transient write failure is a reconnect detail, never a crash — the
        // next dex change or the reconnect flush re-attempts.
      });
    }, config.friends.DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [userId, displayName, online, ready, dex]);

  // ── Reconnect flush (D-17): on an offline→online transition, immediately flush
  // the own row (beyond the ~5s debounce) so friends catch up on anything logged
  // offline. The subscription + re-pull are re-established by the lifecycle effect
  // above on the same transition. ──
  const prevOnline = useRef(online);
  useEffect(() => {
    const was = prevOnline.current;
    prevOnline.current = online;
    if (was || !online) return; // only the offline→online edge
    if (!userId || !displayName || !ready || dex == null) return;
    void upsertOwnProgress(userId, displayName, dex).catch(() => {});
  }, [online, userId, displayName, ready, dex]);
}
