/**
 * The PURE read hook over shared sync state (Phase 19, D-16). It owns NO channel,
 * NO debounce, NO upsert — it only reads the shared store the app-wide
 * `useProgressSync` engine publishes, via `useSyncExternalStore`. Rendering
 * `FriendsList` / `FriendDetail` / `SelfRow` therefore opens NO second
 * subscription and starts NO second debounce (the singleton guarantee): the
 * engine is the one writer, this hook is a reactive reader.
 *
 * Also exports the PURE `buildFriendRows` sort helper (no Supabase, no DOM) so the
 * Friends UI (19-03) and unit tests can order rows deterministically without
 * touching the store.
 */
import { useSyncExternalStore } from "react";
import {
  getSyncState,
  subscribeSyncState,
  type SyncState,
} from "./progressSync.ts";
import type { FriendRowData } from "./friendCache.ts";

/**
 * Read the shared sync state (`{friends, offline, asOf, error}`) reactively. A
 * pure `useSyncExternalStore` over the engine's shared store — the same value the
 * engine last published, re-rendering subscribers on every sync event. Opens no
 * subscription/debounce of its own.
 */
export function useFriendsProgress(): SyncState {
  return useSyncExternalStore(subscribeSyncState, getSyncState, getSyncState);
}

/**
 * `buildFriendRows(friends, myUserId) -> FriendRowData[]` — the PURE deterministic
 * row order for the Friends list (PROG-03/04, D-03, D-05). Excludes the caller's
 * OWN row, then sorts:
 *   1. 0-catch friends LAST (D-05) — honest "here, hasn't caught yet", never hidden;
 *   2. completion % DESCENDING;
 *   3. caught count DESCENDING;
 *   4. display name ASCENDING (stable, locale-aware tie-break).
 * No Supabase, no DOM — kept pure/exported for isolated unit testing.
 */
export function buildFriendRows(
  friends: readonly FriendRowData[],
  myUserId: string,
): FriendRowData[] {
  return friends
    .filter((f) => f.userId !== myUserId)
    .slice()
    .sort((a, b) => {
      const aZero = a.summary.completion.caught === 0;
      const bZero = b.summary.completion.caught === 0;
      if (aZero !== bZero) return aZero ? 1 : -1; // 0-catch friends last (D-05)

      const pctDelta = b.summary.completion.pct - a.summary.completion.pct;
      if (pctDelta !== 0) return pctDelta; // completion % desc

      const caughtDelta = b.summary.completion.caught - a.summary.completion.caught;
      if (caughtDelta !== 0) return caughtDelta; // caught count desc

      return a.displayName.localeCompare(b.displayName); // display name asc
    });
}
