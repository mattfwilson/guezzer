/**
 * Baked sign-in roster (Plan 18-04, AUTH-01 / D-01 / D-04).
 *
 * INVARIANT — NO REAL PII IN THE PUBLIC BUNDLE (D-04, threat T-18-04-I):
 * This file ships in the world-readable static bundle. Every `handle` here is a
 * SYNTHETIC sign-in handle only (a `@fov.gizz` login handle the Phase-17 seed
 * minted) — NEVER a real personal email (no `@gmail.`/`@icloud.`/etc). Do not
 * add a real address here under any circumstances; a scraper reading the bundle
 * must learn nothing but display names + throwaway synthetic handles.
 *
 * The handles MUST match the synthetic emails the Phase-17 seed script actually
 * minted, or sign-in fails. Verified 2026-07-22 against the live Supabase
 * project (ref `yunfqfldgbgjdqzywbdy`) via the recorded Management-API
 * introspection (MEMORY `v2-supabase-live-project`): the five friend accounts
 * were minted as `matt/max/tim/shawn/brian@fov.gizz` (all synthetic, no PII);
 * the extra `gizz1–5@gizz.local` accounts are spike test users, deliberately
 * NOT surfaced in the roster. No real personal emails were seeded, so no
 * owner re-mint is required (RESEARCH OQ2 resolved: synthetic handles only).
 *
 * `displayName` mirrors the seeded `user_metadata.display_name`. Tapping a name
 * pre-fills that account's `handle` for the `signInWithPassword` call; the handle
 * itself is never shown to the user (UI-SPEC Copywriting Contract).
 */

export interface RosterEntry {
  /** Seeded `user_metadata.display_name` — the large tap-target label (D-01). */
  displayName: string;
  /** Synthetic `@fov.gizz` sign-in handle (NOT a real email) — never rendered. */
  handle: string;
}

export const ROSTER = [
  { displayName: "Matt", handle: "matt@fov.gizz" },
  { displayName: "Max", handle: "max@fov.gizz" },
  { displayName: "Tim", handle: "tim@fov.gizz" },
  { displayName: "Shawn", handle: "shawn@fov.gizz" },
  { displayName: "Brian", handle: "brian@fov.gizz" },
] as const satisfies readonly RosterEntry[];
