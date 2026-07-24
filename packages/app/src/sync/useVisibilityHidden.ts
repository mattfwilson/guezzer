/**
 * Reactive `document.visibilityState === "hidden"` (Phase 20, PRES-04/D-02). The
 * structural twin of `useOnlineStatus` (live/useOnlineStatus.ts): a
 * `useSyncExternalStore` over a single browser event — swapping the
 * `online`/`offline` pair for `visibilitychange`. Zero timers (D-02): this reuses
 * the EXACT signal the Show-Mode Wake Lock already listens to, so a backgrounded
 * tab immediately reads as `idle` in `deriveActivity` and no polling loop is
 * introduced.
 *
 * The client snapshot is `document.visibilityState === "hidden"`; the server
 * snapshot is `false` (SSR/first-paint assumes a foregrounded, visible tab).
 */
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  document.addEventListener("visibilitychange", callback);
  return () => {
    document.removeEventListener("visibilitychange", callback);
  };
}

export function useVisibilityHidden(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState === "hidden",
    () => false,
  );
}
