---
phase: 05-live-sync-data-safety
plan: 04
subsystem: ui
tags: [react, hooks, live-sync, useSyncExternalStore, polling, dexie, indexeddb]

# Dependency graph
requires:
  - phase: 05-01
    provides: "@guezzer/core pollLatest, diffLatestAgainstTrail, resolvePlaceholders, bindShowFromLatest + LatestSetlistRow/Suggestion/FillHint types"
  - phase: 05-03
    provides: "Dexie v3 schema + adoptSuggestion/bindShow helpers + config.live/config.ui/config.copy.live"
  - phase: 04
    provides: "ShowView + useShowSession write-through loop, classifyOutcome, renameEntry, TrailNodeSheet rename path"
provides:
  - "useOnlineStatus() reactive navigator.onLine via useSyncExternalStore"
  - "useLatestPoll(active, onRows) single self-scheduling gated poll loop (≤1/60s)"
  - "SuggestionStrip advisory component (adopt/dismiss/fill, fixed-height, escaped-text-only)"
  - "SyncDot quiet online/offline indicator (token-only, passive, aria-labelled)"
  - "ShowView live-sync wiring: poll mount, suggestion derivation, adopt/dismiss/fill/bind handlers, offline reassurance line"
affects: [05-05, phase-06, data-safety, settings, dex]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single self-scheduling setTimeout loop (never setInterval) with cancelled-flag + ref-held pending timer for leak-free ≤1/60s cadence"
    - "Tick-time eligibility gate (navigator.onLine && visibilityState==='visible') instead of re-arming the effect on every transient flip"
    - "useSyncExternalStore over online/offline events (structural twin of useHashRoute)"
    - "onRows callback held in a ref so a fresh render closure never resets the poll cadence"
    - "Advisory-only write-through: adopt/bind go through Dexie helpers, no useState mirror of trail/tally (useLiveQuery re-derives)"

key-files:
  created:
    - packages/app/src/live/useOnlineStatus.ts
    - packages/app/src/live/useLatestPoll.ts
    - packages/app/src/live/SuggestionStrip.tsx
    - packages/app/src/live/SyncDot.tsx
    - packages/app/test/useLatestPoll.test.tsx
    - packages/app/test/adopt.test.tsx
  modified:
    - packages/app/src/show/ShowView.tsx

key-decisions:
  - "Tick-time gating over effect-re-arm: a transient offline/hidden tick skips + reschedules at the floor; only a navigator online/offline EVENT (which changes useOnlineStatus) re-arms the loop — avoids burst-on-flap"
  - "First tick armed one full POLL_INTERVAL_MS out — never an immediate poll on mount (etiquette, T-05-11)"
  - "handleFill calls renameEntry directly with the editor's name (user-initiated via the Pencil control) — 'never auto-applied' means the poll never fills silently, not that a second confirm sheet is required"
  - "Dismiss tracked by song id in a local Set, reset on session change so dismissals never leak across nights"
  - "Adopt is a no-confirm fast path (advisory→logged) per 05-UI-SPEC; the write-through dedupes the row out of the strip"

patterns-established:
  - "Live-sync hooks live under packages/app/src/live/ (app-tier lifecycle only; all fetch/validation/decisions stay in @guezzer/core)"
  - "Fixed-height advisory slot (inline height style, unconditional) to preserve SHOW-02 no-relayout guarantee"

requirements-completed: [SYNC-01, SYNC-02, SYNC-03]

# Metrics
duration: 18min
completed: 2026-07-13
---

# Phase 5 Plan 04: Live-Sync Vertical Slice Summary

**A single leak-free ≤1/60s `latest` poll loop gated on active-show + online + visible, feeding a fixed-height advisory SuggestionStrip and a quiet SyncDot in ShowView — editor songs are deduped suggestions that adopt as `source:'editor'` write-throughs and never clobber manual tracking, fully functional offline.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-13T17:56Z
- **Completed:** 2026-07-13T18:04Z
- **Tasks:** 3
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments
- `useLatestPoll`: one self-scheduling `setTimeout` (never `setInterval`), active-show + online + visible gated, tolerant of thrown polls, with adaptive backoff clamped between `POLL_INTERVAL_MS` and `POLL_MAX_INTERVAL_MS` — at most one request per 60s by construction (SYNC-01, T-05-11).
- `useOnlineStatus`: `useSyncExternalStore` over `online`/`offline` events driving both the poll gate and the SyncDot (SYNC-03).
- `SuggestionStrip` + `SyncDot`: a fixed-height, escaped-text-only advisory surface with ≥44px Add/Fill/Dismiss controls (tap-X **and** horizontal-swipe dismiss), and a passive token-only connectivity dot with an `aria-label`.
- ShowView wired end to end: deduped suggestions + fill hints (`diffLatestAgainstTrail`/`resolvePlaceholders`), no-confirm adopt (`source:'editor'`, honest hit/miss), non-destructive dismiss, fill-`???` via the rename path, guarded D-07 auto-bind, and the one-time offline reassurance line.

## Task Commits

1. **Task 1: useOnlineStatus + single-timer useLatestPoll loop** - `66f5c10` (feat) — 8 fake-timer tests
2. **Task 2: SuggestionStrip + SyncDot components** - `5017437` (feat)
3. **Task 3: Wire poll + strip + dot + adopt/bind into ShowView** - `b114445` (feat) — 5 adopt/bind tests

_(MVP mode: TDD gate not active this phase; tests authored alongside implementation per task.)_

## Files Created/Modified
- `packages/app/src/live/useOnlineStatus.ts` - Reactive `navigator.onLine` via `useSyncExternalStore` (SYNC-03).
- `packages/app/src/live/useLatestPoll.ts` - The single gated, tolerant, self-scheduling poll loop with adaptive backoff (SYNC-01/SYNC-03/D-06).
- `packages/app/src/live/SuggestionStrip.tsx` - Fixed-height advisory strip; adopt/dismiss/fill; escaped-text-only; tap-X + swipe dismiss (D-01/D-02/D-04, T-05-12).
- `packages/app/src/live/SyncDot.tsx` - Passive 8px filled/hollow online-offline indicator, token-only, aria-labelled (D-08).
- `packages/app/src/show/ShowView.tsx` - Mounts the poll + online status, derives + filters suggestions, guarded auto-bind, adopt/dismiss/fill handlers, SyncDot + offline line + SuggestionStrip render.
- `packages/app/test/useLatestPoll.test.tsx` - Cadence, active-show gate, offline/hidden skip, unmount cleanup, tolerance, backoff.
- `packages/app/test/adopt.test.tsx` - `source:'editor'` + honest hit/miss, dedupe (D-02), D-07 bind guard.

## Decisions Made
- **Tick-time gating over effect re-arm.** An ineligible tick (offline/hidden) performs no fetch and reschedules at the floor; only an actual `online`/`offline` event re-arms the effect. This avoids re-arming on every transient background flap while still resuming silently (Pitfall 4).
- **First tick one interval out.** The loop never polls immediately on mount — the first request is armed at `POLL_INTERVAL_MS`, respecting the volunteer-run host (T-05-11).
- **`handleFill` writes directly via `renameEntry`.** The editor already named the song; the user taps the Pencil control to apply it. "Never auto-applied" (D-04) is satisfied because the poll never fills silently — a user action is required. Outcome is re-classified against the placeholder entry's own stored fan (reuses TrailNodeSheet's rule).
- **Dismiss by song id in a local `Set`, reset on session change** so dismissals don't leak across nights (ShowView stays mounted).

## Deviations from Plan

None - plan executed exactly as written.

The plan's verify commands specify `cd packages/app && npx vitest run …`, but the app package's own `vite.config.ts` carries no test environment — the root `vite.config.ts` owns the `@guezzer/app` (jsdom) project. Tests were therefore run from the repo root as `npx vitest run --project @guezzer/app <file>` (equivalent coverage, correct jsdom environment). This is an execution-command clarification, not a code change.

## Issues Encountered
- **Wrong vitest environment when run from `packages/app`.** Running vitest inside the app package resolved the package-local `vite.config.ts` (no `test.environment`), yielding `document is not defined`. Resolved by running from the repo root against the `@guezzer/app` project, which is configured for jsdom.
- **Backoff vs. a constant-cadence assertion.** The initial ≤1/60s test assumed every tick fired at the floor, but empty polls grow the delay. Fixed the test to return rows (pinning the floor) so it isolates the single-timer guarantee from the backoff path; a separate test asserts the backoff growth explicitly.

## User Setup Required
None - no external service configuration required. (Real-device poll cadence + airplane-mode flap are deferred to the phase manual gate per 05-VALIDATION §Manual-Only.)

## Next Phase Readiness
- The live-sync UI slice is complete and green: full app suite 101/101, core suite 136/136, `tsc --noEmit` clean.
- Plan 05-05 (export/import data safety) can build on the same ShowView/Dexie surface; `importSnapshot` and the Settings copy are already in place from Plan 05-03.
- Manual device verification (installed iOS PWA poll ≤1/60s, offline dot + silent resume) remains for the end-of-phase human gate.

---
*Phase: 05-live-sync-data-safety*
*Completed: 2026-07-13*
