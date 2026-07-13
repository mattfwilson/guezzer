/**
 * Reactive `navigator.onLine` (SYNC-03, Phase 5 plan 05-04). A structural twin
 * of `useHashRoute` (routing/useHashRoute.ts): a `useSyncExternalStore` over a
 * browser event, swapping `hashchange` for the `online`/`offline` pair. The
 * snapshot is `navigator.onLine`; the server snapshot is `true` (optimistic —
 * SSR/first-paint assumes connectivity, matching the calm-online default).
 *
 * `navigator.onLine` is one-directional and lies in one direction only (it can
 * report `true` with no real connectivity, RESEARCH Pitfall 2) — the poll loop
 * (useLatestPoll) is tolerant of that: a "healthy" online that actually fails
 * just yields `[]` next tick, never a crash. This hook exists only to gate the
 * loop and drive the quiet SyncDot, never to assert real reachability.
 */
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
