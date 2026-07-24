/**
 * The PURE presence read hooks the Friends surface consumes (Phase 20,
 * PRES-01/02, D-16/D-17, Open Q3). The exact structural analog of
 * `useFriendsProgress`: these hooks own NO channel, NO track, NO send — they
 * only READ. `usePresenceFor` reads the shared presence store the singleton
 * `usePresence()` engine publishes (via `useSyncExternalStore`); `useSelfPresence`
 * derives the "You" row from LOCAL signals, never a store round-trip. Rendering a
 * friend row therefore opens NO second `gizz-room` channel (the D-19 singleton
 * guarantee — the engine is the one writer, these are reactive readers).
 *
 * The offline gate is the sacred D-16/D-17 rule: when the VIEWER is offline the
 * presence signal is meaningless (we can't know who is present), so BOTH readers
 * return the pristine `{ online:false, activity:null }` shape — every friend dot
 * goes dark and the "You" row reads offline — regardless of the last-known store
 * contents. A single frozen `OFFLINE` constant is returned so an offline render
 * is referentially stable.
 *
 * Open Q3 (self row from local, not a presence round-trip): `useSelfPresence`
 * composes `useHashRoute` + `useVisibilityHidden` + the active-tracked-show
 * liveQuery through the SAME pure `deriveActivity` the engine broadcasts with —
 * so "You" reflects this device instantly (no wait for our own presence:sync to
 * echo back), and it stays byte-identical to what peers see us as.
 */
import { useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db.ts";
import { useOnlineStatus } from "../live/useOnlineStatus.ts";
import { useHashRoute } from "../routing/useHashRoute.ts";
import { type Activity, deriveActivity } from "./presenceActivity.ts";
import { getPresenceState, subscribePresenceState } from "./presenceSync.ts";
import { useVisibilityHidden } from "./useVisibilityHidden.ts";

/** The reader return shape: binary present-now + the coarse reduced activity (or null). */
export interface PresenceView {
  online: boolean;
  activity: Activity | null;
}

/**
 * The frozen offline/absent constant. Returned by BOTH readers when the viewer is
 * offline (D-16/D-17) so a dark render is referentially stable — no churn.
 */
const OFFLINE: PresenceView = { online: false, activity: null };

/**
 * Read a friend's presence from the shared store (PRES-01/02). Returns
 * `{ online: onlineIds.has(userId), activity: activityByUser.get(userId) ?? null }`
 * while the viewer is online; when the viewer is offline returns the frozen
 * `OFFLINE` shape for EVERY userId (D-16 — a viewer with no connectivity can't
 * know who is present, so all dots go dark). Opens no channel — a pure reader.
 */
export function usePresenceFor(userId: string): PresenceView {
  const online = useOnlineStatus();
  const state = useSyncExternalStore(
    subscribePresenceState,
    getPresenceState,
    getPresenceState,
  );
  if (!online) return OFFLINE;
  return {
    online: state.onlineIds.has(userId),
    activity: state.activityByUser.get(userId) ?? null,
  };
}

/**
 * Derive the "You" presence row from LOCAL signals (Open Q3) — the current route,
 * tab visibility, and whether a tracked show is active — through the same pure
 * `deriveActivity` the engine broadcasts with. Returns `{ online:true, activity }`
 * while online; `OFFLINE` when the viewer is offline (D-17 — "You" reads offline
 * too). Never round-trips through `getPresenceState()`, so the self row updates
 * instantly on this device rather than waiting for our own presence echo.
 */
export function useSelfPresence(): PresenceView {
  const online = useOnlineStatus();
  const route = useHashRoute();
  const hidden = useVisibilityHidden();
  const active = useLiveQuery(() =>
    db.trackedShows.where("status").equals("active").first(),
  );
  if (!online) return OFFLINE;
  return { online: true, activity: deriveActivity(route, hidden, active != null) };
}
