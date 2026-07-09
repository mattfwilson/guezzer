---
phase: 04-show-mode
plan: 04
subsystem: show-mode-session
tags: [react, dexie, uselivequery, showview, lifecycle, layout-seam, restore]

# Dependency graph
requires:
  - phase: 04-show-mode
    plan: 01
    provides: Dexie version(2) write helpers (startShow/logSong), classifyOutcome/deriveTally, config.show/copy.show
  - phase: 04-show-mode
    plan: 03
    provides: OrbitStage/CenterNode/PredictionOrb/WhyDetail render layer, matrix loader (loadMatrix/getMatrixIndex), buildShowContext/predictFan, selectFan/isWeakFan, OrbitCandidate
  - phase: 02-transition-matrix-model-backtest
    provides: frozen predict()/PredictionCandidate/ShowContext (currentSongId non-nullable number), MatrixIndex.nodeById → MatrixNode.tuningFamily
provides:
  - useShowSession — the app's FIRST useLiveQuery; active show + ordered entries + derived tally + null-safe current fan straight from Dexie + core
  - ShowView — #/show lifecycle root (pre-show / model-load-failure / pre-opener orbit / active orbit) with tap→log-hit→recenter orchestration
  - PreShowLauncher — accent Start Show CTA writing provisional attendance (D-01/D-02/DEX-01)
  - AppShell scroll parametrization (scroll prop) — the orbit-stage no-scroll seam resolved (Pitfall 5)
  - App renders ShowView at #/show; matrix artifact now bundle-included end-to-end for the first time
affects: [04-05-opener-seed-search, 04-06-actionbar-wiring, phase-05-live-sync-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useLiveQuery as the single source of truth: no useState mirror of trail/tally — a write-through re-runs the query and re-derives everything (SHOW-11)"
    - "App-only null currentSongId gate: predictFan/buildShowContext invoked ONLY past a currentSongId !== null guard, so null never reaches the frozen core ShowContext.currentSongId: number"
    - "Prediction memoized on [currentSongId, currentEntry, entries] — recomputes on log events, never unconditionally per render (RESEARCH Pitfall 6)"
    - "AppShell <main> scroll parametrized per-route: #/show is a non-scrolling full-height flex column so the OrbitStage flex-1 child never rubber-bands (SHOW-13, Pitfall 5)"

key-files:
  created:
    - packages/app/src/show/useShowSession.ts
    - packages/app/src/show/ShowView.tsx
    - packages/app/src/show/PreShowLauncher.tsx
  modified:
    - packages/app/src/App.tsx
    - packages/app/src/components/AppShell.tsx
    - packages/app/test/showSession.test.ts

key-decisions:
  - "Resolved Pitfall 5 by parametrizing AppShell with a scroll prop (App passes scroll={route !== 'show'}) rather than having ShowView fight a scrolling <main> — keeps the seam in one place and other routes untouched"
  - "logSong is called WITHOUT setNumber: the frozen 04-01 signature omits it (the show row stamps currentSetNumber). The plan's illustrative call included setNumber; following the real contract avoids a tsc error and preserves snapshot semantics"
  - "useShowSession exposes matrixOk (loadMatrix().ok) so ShowView owns the model-load-failure branch (T-04-09) without the hook throwing"
  - "currentSong (centre name + tuning colour) is derived even on the matrix-failure path (null family) so the branch decision stays in ShowView, not the hook"

requirements-completed: [SHOW-03, SHOW-11, DEX-01]

# Metrics
duration: 8min
completed: 2026-07-09
---

# Phase 4 Plan 04: Show Mode Session Layer & ShowView Lifecycle Summary

**The app's first reactive `useLiveQuery` (`useShowSession`) plus the `ShowView` lifecycle root: Start Show writes provisional attendance and opens a null-safe pre-opener orbit ("Tap the opener", no fan, `predict()` untouched); force-quit/relaunch auto-resumes the exact active session; the tap-orb→log-hit→recenter wiring is built and integration-tested; and the AppShell↔orbit no-scroll seam (Pitfall 5) is resolved by a per-route `scroll` prop — all typecheck-clean, 56 app tests green, and the matrix artifact bundle-included end-to-end for the first time.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-07-09
- **Tasks:** 2
- **Files:** 6 (3 created, 3 modified)

## Accomplishments

- **Task 1 — `useShowSession`:** the app's first `useLiveQuery`. `active` = the one `status:"active"` tracked show; `entries` = ordered by position (keyed on `[active?.sessionId]`); `tally` via `deriveTally`; `currentSongId: number | null` = the last non-placeholder entry's songId (null pre-opener). Predictions are **gated** — `buildShowContext`/`predictFan` run ONLY inside the `currentSongId !== null` guard, so `null` never reaches the frozen core `ShowContext.currentSongId: number`; the pre-opener path returns an empty fan without touching core. Candidates are tuning-enriched via `MatrixIndex.nodeById`, selected into the adaptive 5–8 fan (`selectFan`), and `isWeakFan` computed. NO `useState` mirror of trail/tally — Dexie is the single source of truth (SHOW-11); the prediction `useMemo` recomputes only on entry/current-song change.
- **Task 2 — `ShowView` + `PreShowLauncher` + wiring:** `PreShowLauncher` renders "Ready when you are" + the accent-gold **Start Show** CTA calling `startShow()` (auto-stamped date + provisional-attendance row, DEX-01/D-02). `ShowView` branches off the single active show (D-03): no active show → launcher; matrix load failure → the calm model-load-failure state (T-04-09, ASVS V7 — blocks only the orbit, not nav); `currentSongId === null` → the orbit stage with the CenterNode **"Tap the opener"** prompt and NO fan; a current song → the full orbit. `onTapOrb` classifies a hit (`classifyOutcome` against the shown fan, D-06) and `logSong`s it — a write-through that recenters + re-predicts via `useLiveQuery` (SHOW-03/T-04-10); the Info dot opens `WhyDetail` and never logs (D-11).
- **AppShell seam (Pitfall 5):** added a `scroll` prop; `App` passes `scroll={route !== "show"}` so `#/show`'s `<main>` becomes a non-scrolling full-height flex column and the `OrbitStage` `flex-1` child fills without overflow/rubber-band (SHOW-13). `App` now renders `ShowView` at `#/show` (the Placeholder show branch removed), keeping PlaceholderView for explore/dex.
- **First end-to-end matrix bundling:** because `ShowView` is now imported by the app entry, `@matrix` is bundle-included for the first time — `vite build` succeeds at 734 KB (up from 302 KB in 04-03), 12 precache entries / 742 KiB, exactly the offline-complete-on-first-load posture CLAUDE.md decision 8 intends.

## Task Commits

1. **Task 1 — useShowSession reactive hook (first useLiveQuery, null-safe currentSongId)** — `3187ebd` (feat)
2. **Task 2 — ShowView lifecycle + PreShowLauncher + tap-log-recenter wiring + AppShell scroll seam** — `568b0aa` (feat)

_Plan metadata (SUMMARY/STATE/ROADMAP/REQUIREMENTS) committed separately._

## Deviations from Plan

### Reconciliation with the frozen 04-01 contract (not a scope change)

**1. `logSong` called without `setNumber`**
- **Found during:** Task 2.
- **Context:** The plan's Task 2 action illustrated the tap-log call as `logSong(sessionId, { songId, songName, setNumber: active.currentSetNumber, outcome, shownFanSongIds, isPlaceholder:false, loggedAt })`. The actual 04-01 `logSong` signature is `Omit<TrackedEntry, "id"|"sessionId"|"position"|"setNumber">` — it stamps `setNumber` from the show row's `currentSetNumber` itself (04-01's deliberate snapshot-semantics decision, SHOW-06). Passing `setNumber` would be a `tsc` error.
- **Resolution:** Followed the real signature (no `setNumber`). This is compliance with the frozen contract the plan's `read_first` pointed at, and preserves true set-structure snapshot semantics — not a functional deviation.
- **Files:** `packages/app/src/show/ShowView.tsx`
- **Commit:** `568b0aa`

Otherwise the plan executed as written. No Rule 1–4 auto-fixes were required.

## Issues Encountered

- None outstanding. The chunk-size warning from `vite build` (>500 KB) is expected and intended — it is the bundled 590 KB matrix artifact (CLAUDE.md decision 8, offline-complete). Not a regression.

## Threat Model Coverage

- **T-04-08 (hash tampering):** `ShowView` mounts only via the existing allow-listed `useHashRoute` — inherited Phase 3 control, unchanged.
- **T-04-09 (crash on matrix failure / null currentSongId):** mitigated — `ShowView` renders the calm model-load-failure state when `matrixOk` is false, and the null `currentSongId` is gated in app state (never passed to core). No unguarded read/crash.
- **T-04-10 (write-through timing / data loss):** mitigated — `logSong` awaits the Dexie write; the restore integration test proves exact resume (SHOW-11).

No new security surface introduced (Phase 4 is fully offline; no network, no new dependencies).

## Manual Verification Deferred (per VALIDATION, config human_verify_mode: end-of-phase)

On device (this slice): Start Show → the orbit opens with today's date and the "Tap the opener" prompt (no orbs yet — opener entry lands in 04-05); force-quit the installed PWA and relaunch → the app resumes straight into the active show with the same trail/date (SHOW-11 real-device confirmation). The live tap-orb recenter is demonstrated in 04-05 once an opener can be seeded via Search. Carried to the phase's end-of-phase human-verify gate.

## Next Phase Readiness

- **04-05 (opener seed + Search):** `useShowSession` already exposes `currentSongId`/`shownFanSongIds`/`fan` and the pre-opener branch; wiring Search to log the first real song flips `currentSongId` non-null and the fan/first-recenter become live with zero hook changes. `ShowView` has the placeholder slots noted for the ActionBar + CometTrail.
- **04-06 (ActionBar wiring):** `undoLast`/`markSetBreak`/`markEncore`/`endShow` (04-01) are ready; `ShowView` is the mount point. The finalized read-only branch becomes reachable once End Show + a history view exist.
- Full app suite green: **56 tests / 9 files**, `tsc -p packages/app --noEmit` clean, `vite build` clean (matrix now bundle-included end-to-end).

## Self-Check: PASSED

- FOUND: packages/app/src/show/useShowSession.ts
- FOUND: packages/app/src/show/ShowView.tsx
- FOUND: packages/app/src/show/PreShowLauncher.tsx
- FOUND: packages/app/src/App.tsx (renders ShowView at #/show)
- FOUND: packages/app/src/components/AppShell.tsx (scroll prop)
- FOUND: packages/app/test/showSession.test.ts (restore + hit assertions)
- FOUND commit: 3187ebd (feat), 568b0aa (feat)

---
*Phase: 04-show-mode*
*Completed: 2026-07-09*
