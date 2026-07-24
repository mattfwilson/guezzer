/**
 * Pure presence-activity derivation (Phase 20, PRES-04). This module is
 * DELIBERATELY pure — no Supabase, no React, no DOM — it imports only the
 * `Route` TYPE from the router. It is the structural analog of a pure core
 * projector: `deriveActivity` turns the local (route, hidden, atShowActive)
 * signal into the coarse presence payload the engine broadcasts, and
 * `reduceActivity` collapses a peer's multi-entry presence array (one entry per
 * open tab/device) down to one Activity at the read boundary.
 *
 * Two hard scope lines are enforced here structurally:
 *  - D-03 / SOCL-V2-01: the payload is `{ tab, atShow?: boolean }` — a coarse
 *    tab-level position plus a BOOLEAN only. Never a song, never a setlist
 *    position. `atShow` is `true` or absent — nothing finer ever leaves a device.
 *  - D-02: a backgrounded tab is `idle`. `hidden` wins over everything (including
 *    an active tracked show) so presence reflects "eyes on the app right now",
 *    driven by the zero-timer `visibilitychange` signal (useVisibilityHidden).
 */
import type { Route } from "../routing/useHashRoute.ts";

/**
 * The presence tab tokens. These ARE the display labels (the brand names shown
 * on a friend's presence dot), so no separate label map is needed — only the
 * `atShow`/`offline` strings live in `config.copy.presence`.
 */
export type Tab =
  | "LiveGizz"
  | "GizzVerse"
  | "GizzMap"
  | "GizzDex"
  | "GizzGames"
  | "idle";

/**
 * A peer's (or our own) coarse presence activity. `atShow` is present ONLY when
 * true — the key is omitted when false so an idle/off-show payload is the minimal
 * `{ tab }` shape (D-03 boolean-only guarantee).
 */
export interface Activity {
  tab: Tab;
  atShow?: boolean;
}

/**
 * The fixed Route → Tab map. `settings` has no content tab so it derives to
 * `idle` (per D-01/A4 discretion — a friend poking at settings reads as idle, not
 * a distinct presence surface).
 */
export const ROUTE_TO_TAB: Record<Route, Tab> = {
  show: "LiveGizz",
  explore: "GizzVerse",
  map: "GizzMap",
  dex: "GizzDex",
  games: "GizzGames",
  settings: "idle",
};

/** The valid Tab set — the allow-list `reduceActivity` validates untrusted peer entries against. */
const TABS: ReadonlySet<Tab> = new Set<Tab>([
  "LiveGizz",
  "GizzVerse",
  "GizzMap",
  "GizzDex",
  "GizzGames",
  "idle",
]);

/**
 * Derive THIS device's presence activity from the local signals.
 *
 * `hidden` (the tab is backgrounded) wins over everything → `{ tab: "idle" }`
 * (D-02). Otherwise the tab is the route's brand token, and `atShow` is stamped
 * `true` ONLY when the show route is foregrounded AND a tracked show is active —
 * the `atShow` key is omitted in every other case (never `atShow: false`).
 */
export function deriveActivity(
  route: Route,
  hidden: boolean,
  atShowActive: boolean,
): Activity {
  if (hidden) return { tab: "idle" };
  const tab = ROUTE_TO_TAB[route];
  if (route === "show" && atShowActive) return { tab, atShow: true };
  return { tab };
}

/**
 * Collapse a peer's multi-entry presence array (Supabase presence keys each user
 * to an ARRAY of state entries, one per open tab/device — Pitfall 2) down to one
 * Activity. Each entry is validated against the Tab allow-list; the FIRST entry
 * with `atShow === true` wins (they're at a show on some device), else the LAST
 * valid entry, else `null` when nothing valid remains. Never throws on malformed
 * / hostile input — an untrusted entry with a bogus `tab` (or a non-`true`
 * `atShow`) is simply skipped / normalized.
 */
export function reduceActivity(entries: readonly unknown[]): Activity | null {
  const valid: Activity[] = [];
  for (const entry of entries) {
    if (entry == null || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    if (typeof rec.tab !== "string" || !TABS.has(rec.tab as Tab)) continue;
    valid.push(
      rec.atShow === true
        ? { tab: rec.tab as Tab, atShow: true }
        : { tab: rec.tab as Tab },
    );
  }
  if (valid.length === 0) return null;
  return valid.find((a) => a.atShow === true) ?? valid[valid.length - 1];
}
