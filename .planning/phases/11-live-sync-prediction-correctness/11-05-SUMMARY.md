---
phase: 11-live-sync-prediction-correctness
plan: 05
subsystem: app/show + app/settings
tags: [prediction, rotation, cross-night, PRED-01, PRED-03, app-wiring]
requires:
  - packages/app/src/show/useShowSession.ts (buildShowContext 3rd arg seam)
  - packages/app/src/settings/SettingsView.tsx (db.meta-backed controls)
  - "@guezzer/core: currentRunShowSets + FinalizedShowInput (plan 11-03)"
  - "@guezzer/core/config: runGapDays (plan 11-03)"
provides:
  - Cross-night rotationSuppression fires live (recentShowSongSets fed from Dexie)
  - Owner "start a fresh run" reset control writing the rotationRunResetDate marker
  - todayIso exported from db.ts (boundary commensurate with TrackedShow.date)
affects:
  - Phase 11 verification gate (device UAT: night-2 down-weighting + reset)
tech-stack:
  added: []
  patterns:
    - "useShowSession reads finalized trackedShows+entries via useLiveQuery, projects to FinalizedShowInput[], groups via core currentRunShowSets — decision logic stays in core (CLAUDE.md separation)"
    - "Reset boundary = today's YYYY-MM-DD (A3 date boundary) in a free-form db.meta row — no Dexie version bump, round-trips via snapshot()"
key-files:
  created: []
  modified:
    - packages/app/src/show/useShowSession.ts
    - packages/app/test/showSession.test.ts
    - packages/app/src/settings/SettingsView.tsx
    - packages/app/src/db/db.ts
    - packages/app/src/config.ts
    - packages/app/test/settingsOwner.test.tsx
    - packages/app/test/exportImportRoundtrip.test.ts
decisions:
  - "Reset control uses a two-tap confirm affordance (not window.confirm/Sheet) — matches the app's inline-UI idiom; the marker write changes prediction behavior but deletes no data"
  - "runGapDays sourced from @guezzer/core/config directly (openerSuggestions.ts idiom) — no app-side mirror"
  - "todayIso exported from db.ts rather than reimplementing raw Date formatting — the SAME helper that stamps a show's date, so the reset boundary is dimensionally commensurate with TrackedShow.date"
metrics:
  duration: ~14min
  completed: 2026-07-19
---

# Phase 11 Plan 05: Cross-Night Rotation Wiring + Reset Control (PRED-01/PRED-03) Summary

Wired the app tier of the cross-night rotation window and its owner reset control. The pure decision logic (`currentRunShowSets`, `runGapDays`) shipped in plan 11-03; this plan supplies the Dexie data and the reset escape hatch, so the already-correct `rotationSuppression` finally fires in live use (it had been starved by a hardcoded `[]`).

## What Was Built

### Task 1 — Feed the run window into buildShowContext (PRED-01, commit `7405d00`)

- **`useShowSession.ts`**: added two `useLiveQuery` reads OUTSIDE the `currentSongId !== null` prediction gate — (1) finalized `trackedShows` (`.where("status").equals("finalized")` — inherently excludes the active in-progress show, Pitfall 4) each projected with its `trackedEntries` to a `FinalizedShowInput { date, songIds }` (real songs only), and (2) the `rotationRunResetDate` meta marker. A `useMemo` computes `currentRunShowSets(finalizedRunInputs, active.date, { runGapDays: coreConfig.runGapDays }, rotationResetDate ?? undefined)` and the result replaces the hardcoded `[]` as the 3rd `buildShowContext` argument (`recentRunShowSets` added to the prediction `useMemo` deps).
- Decision logic is imported from core (`currentRunShowSets`, `type FinalizedShowInput` from `@guezzer/core`; `config.runGapDays` from `@guezzer/core/config`) — the app only shapes Dexie rows, never re-implements run-grouping/rotation (CLAUDE.md strict core/UI separation).
- **`showSession.test.ts`**: added a 3-node deterministic `@matrix` mock (opener 500 → two structurally identical successors 200/300, so only `rotationSuppression` can separate them) + 3 `renderHook` tests: (a) a song played across two prior run nights ranks strictly below the equivalent un-played song; (b) a >`runGapDays` (8-day) gap show does NOT suppress (scores equal); (c) the reset marker drops pre-boundary nights out of the window (scores equal).

### Task 2 — Manual reset control + rotationRunResetDate marker (PRED-03, commit `fcb04b6`)

- **`SettingsView.tsx`**: added a "Start a fresh run" section (below the storage readout, inside the Backup & data section) — a two-tap confirm affordance (`resetConfirming`/`resetDone` component state) that calls `setMeta("rotationRunResetDate", todayIso())`. Copy explains it stops earlier-night songs from being down-weighted for a separate weekend; no data is deleted.
- **`db.ts`**: exported the existing private `todayIso()` so the boundary is written with the SAME helper that stamps `TrackedShow.date` (dimensionally commensurate with `currentRunShowSets`'s date comparisons). No Dexie `version(...)` bump — `meta` is free-form since v1.
- **`config.ts`**: added the reset copy strings under `config.copy.settings` (single-config-file constraint — no hardcoded component strings).
- **Tests**: `settingsOwner.test.tsx` — two-tap confirm writes a `YYYY-MM-DD` marker + Cancel writes nothing; `exportImportRoundtrip.test.ts` — `rotationRunResetDate` survives a full `exportBackup → pickAndImport` round-trip unchanged (T-11-05-02).

## Reset control location + marker key (for the phase verification gate)

- **Control:** `#/settings` → "Start a fresh run" (two-tap confirm), `packages/app/src/settings/SettingsView.tsx`.
- **Marker:** `db.meta` key `rotationRunResetDate`, value = today's `YYYY-MM-DD` boundary.
- **Consumer:** `useShowSession.ts` → `currentRunShowSets(..., resetBoundary)` → `buildShowContext` 3rd arg → core `rotationSuppression`.

## Deviations from Plan

### Auto-fixed / justified adjustments

**1. [Rule 3 - Blocking] Exported `todayIso` from `db.ts`**
- **Found during:** Task 2 (needed a local-date `YYYY-MM-DD` boundary helper).
- **Issue:** The plan mandates "use the app's existing `todayIso`/date helper, not raw `Date` formatting", but `todayIso` was module-private in `db.ts`.
- **Fix:** Added `export` to the existing `todayIso()` (with a doc note) — no behavior change; it is the canonical helper that already stamps `startShow`'s show date, so the reset boundary is commensurate with `TrackedShow.date`.
- **Files modified:** `packages/app/src/db/db.ts`
- **Commit:** `fcb04b6`

**2. [Rule 2 - Convention] Reset copy added to `config.ts` (not hardcoded in the component)**
- **Found during:** Task 2.
- **Issue:** CLAUDE.md single-config-file constraint + the existing SettingsView idiom (all strings read from `config.copy.settings`) — hardcoding the reset copy in the component would violate both.
- **Fix:** Added `rotationReset*` copy keys under `config.copy.settings`.
- **Files modified:** `packages/app/src/config.ts`
- **Commit:** `fcb04b6`

Neither `db.ts` nor `config.ts` was in the plan's `files_modified` list; both are minimal, convention-driven additions with no schema or behavior change.

## Verification

- `npx vitest run packages/app/test/showSession.test.ts` → 18 passed (15 prior + 3 new PRED-01 wiring tests).
- `npx vitest run packages/app/test/settingsOwner.test.tsx packages/app/test/exportImportRoundtrip.test.ts` → 22 passed (incl. the 2 reset-control tests + the marker round-trip).
- `npx tsc --noEmit` in `packages/app` → exit 0 (clean).
- **Full repo suite `npx vitest run` → 619 passed / 0 failed (77 files)** — was 613 before this plan; +6 new tests, fully green.
- No core scoring or `showContext.ts` modified; no React/DOM imports added to core.

## TDD Gate Compliance

This is an `autonomous` (non-`tdd`) plan; tasks were delivered as `feat` commits with their tests in the same commit. The RED gate for cross-night suppression already landed in core (plan 11-03 `run-grouping.test.ts`); this plan proves the app WIRING carries that behavior end-to-end.

## Self-Check: PASSED

- FOUND: packages/app/src/show/useShowSession.ts (modified — currentRunShowSets wiring)
- FOUND: packages/app/src/settings/SettingsView.tsx (modified — rotationRunResetDate reset control)
- FOUND: packages/app/src/db/db.ts (modified — todayIso export)
- FOUND: packages/app/src/config.ts (modified — reset copy)
- FOUND: packages/app/test/showSession.test.ts (modified — 3 PRED-01 tests)
- FOUND: packages/app/test/settingsOwner.test.tsx (modified — 2 reset tests)
- FOUND: packages/app/test/exportImportRoundtrip.test.ts (modified — marker round-trip)
- FOUND: commit 7405d00 (feat 11-05 PRED-01 wiring)
- FOUND: commit fcb04b6 (feat 11-05 PRED-03 reset control)
