---
phase: 04-show-mode
plan: 03
subsystem: show-mode-render
tags: [react, orbit, radial-layout, prediction, tuning-color, matrix-loader, vite-alias]

# Dependency graph
requires:
  - phase: 04-show-mode
    plan: 01
    provides: config.show tunables + config.copy.show strings + TrackedEntry row type
  - phase: 02-transition-matrix-model-backtest
    provides: frozen predict()/buildMatrixIndex + PredictionCandidate/ShowContext/TransitionMatrix/MatrixNode/TuningFamily + transition-matrix.json artifact
provides:
  - Pure layoutOrbs (deterministic radial math) + selectFan (adaptive 5–8) — SHOW-01/02/D-12
  - Pure confidence helpers formatOrbPercent (<1% floor, absolute) + isWeakFan (D-10) — SHOW-01/EVAL-04
  - tuningColor map keyed off the EXACT core union (Pitfall 3)
  - Bundled matrix loader (loadMatrix schemaVersion guard + memoized getMatrixIndex) via @matrix Vite alias
  - buildShowContext + predictFan wrapper over frozen predict()
  - Presentational OrbitStage / CenterNode / PredictionOrb / WhyDetail (tap = callback prop)
  - @guezzer/core now resolvable from the app (exports field) — the app's first core import
affects: [04-04-showview-layout, 04-06-actionbar-wiring, phase-05-live-sync-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bundle-import a repo-root JSON artifact via Vite resolve.alias + an ambient `declare module` for tsc (RESEARCH Pitfall 4)"
    - "Internal-package resolution: core package.json `exports: { '.': './src/index.ts' }` lets the app import @guezzer/core under moduleResolution bundler with no build step"
    - "Pure app-side geometry/display helpers injected with a cfg object (config.show) so they stay React/DOM-free and unit-testable"
    - "Render layer takes candidates + tap/why callbacks as props; predict/persistence deferred to the wiring plan (self-contained testable slice)"

key-files:
  created:
    - packages/app/src/show/orbitLayout.ts
    - packages/app/src/show/confidence.ts
    - packages/app/src/show/matrix.ts
    - packages/app/src/show/matrix-artifact.d.ts
    - packages/app/src/show/showContext.ts
    - packages/app/src/show/tuningColor.ts
    - packages/app/src/show/PredictionOrb.tsx
    - packages/app/src/show/CenterNode.tsx
    - packages/app/src/show/WhyDetail.tsx
    - packages/app/src/show/OrbitStage.tsx
    - packages/app/test/orbitLayout.test.ts
    - packages/app/test/confidence.test.ts
  modified:
    - packages/app/src/config.ts
    - packages/app/vite.config.ts
    - packages/core/package.json

key-decisions:
  - "Added core package.json `exports` (Rule 3 blocking-issue): the app had never imported @guezzer/core; without an entry field the bare specifier does not resolve under moduleResolution bundler"
  - "Added ORB_MAX_DIAMETER / RING_INSET_PX / ORB_INNER_RADIUS_RATIO to config.show (Rule 2): the layout math needs a max diameter, an edge inset and an inner-radius ratio — putting them in config keeps the acceptance's no-inline-literals rule true"
  - "OrbitCandidate = PredictionCandidate + tuningFamily: candidates carry the family (resolved from the MatrixNode in ShowView) so the render layer never re-touches the matrix; keeps the tuning color keyed off the exact union"
  - "On-orb text is the dark surface color for every mapped family (all four fills are light pastels that clear 4.5:1 on #0C0C10-dark text)"

requirements-completed: [SHOW-01, SHOW-02, SHOW-10, EVAL-04]

# Metrics
duration: 10min
completed: 2026-07-09
---

# Phase 4 Plan 03: Show Mode Focal Region (Orbit Render Layer) Summary

**The deterministic orbit render layer: pure `layoutOrbs`/`selectFan` radial math (deep-equal determinism, ≥56px, adaptive 5–8), honest `formatOrbPercent`/`isWeakFan` display helpers (absolute %, `<1%` floor, no renormalization, weak-fan softening), a bundle-imported matrix loader with a `schemaVersion` guard and memoized index, `buildShowContext`/`predictFan` over the frozen `predict()`, and four presentational components (OrbitStage / CenterNode / PredictionOrb / WhyDetail) with tuning-family color keyed off the exact core union and a separate Info "why" that never logs — all typecheck-clean, unit-tested, and green, with tap left as a callback for the 04-04 wiring.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-09T12:19:05Z
- **Completed:** 2026-07-09T12:29:07Z
- **Tasks:** 3
- **Files:** 15 (12 created, 3 modified)

## Accomplishments

- **Task 1 (TDD, RED→GREEN):** `orbitLayout.ts` — `layoutOrbs` (rank→angle with rank 0 at −90°, score→radius nearer-centre, diameter clamped to `ORB_MIN_DIAMETER`, equal-score span guarded against divide-by-zero) and `selectFan` (drops sub-`ORB_DROP_SCORE` orbs but always keeps 5–8, D-12). `confidence.ts` — `formatOrbPercent` (`round(score*100)%`, `<1%` floor, never a bare 0%, never renormalized) and `isWeakFan` (top `< WEAK_FAN_THRESHOLD`, D-10). Both pure, config-driven, and covered by 8 + 7 assertions.
- **Task 2:** `matrix.ts` bundle-imports the artifact through a new `@matrix` Vite `resolve.alias`, guards `schemaVersion === 1` into a handled `{ ok: false }` sentinel (T-04-06/ASVS V7 — never an unguarded crash), and memoizes `buildMatrixIndex` (same reference on the second call). `showContext.ts` assembles `ShowContext` (trail excludes null-`songId` placeholders; `recentShowSongSets` defaults `[]` for night 1) with a thin `predictFan` wrapper. Workbox `globPatterns` left unchanged (bundle-import path — no `json` glob).
- **Task 3:** `tuningColor.ts` maps all four exact union literals (`standard`/`cs-standard`/`microtonal`/`other`) to the UI-SPEC B1 hexes with a muted fallback — keyed off `"cs-standard"`, never the `"C# standard"` display label (Pitfall 3). `PredictionOrb` (absolute, `min-h-11 min-w-11`, family fill, name + `tabular-nums` %, separate `Info` dot → `onWhy` via `stopPropagation`, weak-fan opacity+desaturate), `CenterNode` (tuning-colored current song or the "Tap the opener" prompt), `WhyDetail` (bottom-sheet rendering `reason` as React text only — no `dangerouslySetInnerHTML`, T-04-05), and `OrbitStage` (ResizeObserver-measured stage → `selectFan`+`layoutOrbs`, `isWeakFan` computed once, muted weak-fan hint, tap/why callback props).

## Task Commits

1. **Task 1 RED — failing orbitLayout + confidence specs** — `e9cc9cd` (test)
2. **Task 1 GREEN — orbitLayout + selectFan + confidence + config keys** — `ecbde27` (feat)
3. **Task 2 — matrix loader + showContext + @matrix alias + core exports** — `c3c47c0` (feat)
4. **Task 3 — OrbitStage/CenterNode/PredictionOrb/WhyDetail/tuningColor** — `e626972` (feat)

_Plan metadata (SUMMARY/STATE/ROADMAP/REQUIREMENTS) committed separately._

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@guezzer/core` was not resolvable from the app**
- **Found during:** Task 2 (first-ever app→core import).
- **Issue:** `packages/core/package.json` had no `main`/`module`/`exports` field, and no app source had ever imported `@guezzer/core`. Under the app's `moduleResolution: "bundler"`, the bare specifier had no entry to resolve to — `tsc` and Vite would both fail.
- **Fix:** Added `"exports": { ".": "./src/index.ts" }` to core's package.json. Resolves cleanly for both `tsc` (bundler resolution reads the `.ts` directly) and Vite/esbuild (just-in-time transpile of the workspace source). Core internals are unaffected (they use relative `.ts` imports; the CLI runs files directly).
- **Files modified:** `packages/core/package.json`
- **Commit:** `c3c47c0`

**2. [Rule 2 - Missing config] Layout math needed max-diameter / inset / inner-ratio constants**
- **Found during:** Task 1.
- **Issue:** `config.show` (from 04-01) only carried `ORB_MIN_DIAMETER`, but the RESEARCH Pattern 3 math also needs a maximum diameter, an outer edge inset, and an inner-radius ratio. The acceptance criterion forbids inlining diameter/threshold/count literals.
- **Fix:** Added `ORB_MAX_DIAMETER` (88), `RING_INSET_PX` (24), and `ORB_INNER_RADIUS_RATIO` (0.42) to `config.show` with JSDoc; `orbitLayout` reads them via a `cfg` object (default sourced from config, explicit cfg in tests).
- **Files modified:** `packages/app/src/config.ts`
- **Commit:** `ecbde27`

**3. [Rule 3 - Blocking] `@matrix` needed an ambient type for tsc**
- **Found during:** Task 2.
- **Issue:** The `@matrix` alias resolves at Vite build time, but `tsc` cannot type an aliased non-relative JSON import.
- **Fix:** Added `packages/app/src/show/matrix-artifact.d.ts` declaring `module "@matrix"` with a default export typed as core's `TransitionMatrix`. `tsc` resolves via the ambient decl; Vite via the alias.
- **Files modified:** `packages/app/src/show/matrix-artifact.d.ts` (created)
- **Commit:** `c3c47c0`

**4. [Rule 1 - Bug] JSDoc comment prematurely closed by a glob pattern**
- **Found during:** Task 2.
- **Issue:** A `/** … */` block in `matrix.ts` contained the literal `**/*.js`, whose `*/` closed the comment early and produced ~18 `tsc` parse errors.
- **Fix:** Reworded the sentence to avoid the `*/` sequence. No behavior change.
- **Files modified:** `packages/app/src/show/matrix.ts`
- **Commit:** `c3c47c0`

## Issues Encountered

- None outstanding. The production build succeeds (`vite build`, 1793 modules) with the new alias/config in place. The matrix artifact is not yet in the bundle (302 KB output, no 592 KB matrix) because the `show/` modules are not yet imported by the app entry — that wiring lands in ShowView (04-04), which is when `@matrix` bundle-inclusion is first exercised end-to-end.

## User Setup Required

None — Phase 4 is fully offline; no new dependencies installed, no external configuration.

## Next Phase Readiness

- **04-04 (ShowView layout):** imports `loadMatrix`/`getMatrixIndex`, `buildShowContext`/`predictFan`, and mounts `OrbitStage` with `OrbitCandidate[]` (enrich each `PredictionCandidate` with its `MatrixNode.tuningFamily`), wiring `onTapOrb` → `logSong`/recenter and `onWhy` → `WhyDetail` state. The AppShell↔stage non-scroll seam (Pitfall 5) is 04-04's decision.
- **04-06 (ActionBar wiring):** the callback-prop shape of OrbitStage is ready for the log/undo/search paths.
- Full suite green: **154 tests / 20 files** (100 core + 54 app), `tsc -p packages/app --noEmit` clean, `vite build` clean.

## Manual Verification Deferred (per VALIDATION manual-only, SHOW-01)

On the smallest target phone width, render a mock 8-orb and 5-orb fan: orbs do not overlap, all ≥44px, tuning colors distinct, weak-fan softening visibly mutes the fan. This is perceptual/on-device and is the human-check in Task 3's verify block — carried to the phase's end-of-phase human-verify gate (config `human_verify_mode: end-of-phase`).

## Self-Check: PASSED

- FOUND: packages/app/src/show/orbitLayout.ts
- FOUND: packages/app/src/show/confidence.ts
- FOUND: packages/app/src/show/matrix.ts
- FOUND: packages/app/src/show/matrix-artifact.d.ts
- FOUND: packages/app/src/show/showContext.ts
- FOUND: packages/app/src/show/tuningColor.ts
- FOUND: packages/app/src/show/PredictionOrb.tsx
- FOUND: packages/app/src/show/CenterNode.tsx
- FOUND: packages/app/src/show/WhyDetail.tsx
- FOUND: packages/app/src/show/OrbitStage.tsx
- FOUND: packages/app/test/orbitLayout.test.ts
- FOUND: packages/app/test/confidence.test.ts
- FOUND commit: e9cc9cd (test), ecbde27 (feat), c3c47c0 (feat), e626972 (feat)

---
*Phase: 04-show-mode*
*Completed: 2026-07-09*
