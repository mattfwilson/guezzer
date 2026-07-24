---
status: complete
phase: quick-260717-sjg
plan: 01
subsystem: ui
tags: [explore, constellation, css-gradient, react-force-graph-2d, reduced-motion, backdrop]

# Dependency graph
requires:
  - phase: 07-explore-mode-constellation
    provides: ConstellationCanvas.tsx (ForceGraph2D wrapper) + config.explore render constants
provides:
  - Decorative CSS-gradient galaxy nebula backdrop behind the GizzVerse constellation
  - config.explore.background tunable block (blooms, blur, pulse, speck opacity)
  - Transparent ForceGraph2D canvas so a DOM layer can show through
affects: [explore, constellation, gizzverse, background, styling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decorative aria-hidden/pointer-events-none absolute-inset-0 ambient layer, config-driven via inline CSS custom props (mirrors ShowBackground.tsx)"
    - "Reduced-motion contract: DEFAULT static, motion ADDED only inside @media (prefers-reduced-motion: no-preference); transform-only, GPU-composited"
    - "Transparent react-force-graph-2d backgroundColor to composite a DOM backdrop behind the canvas"

key-files:
  created:
    - packages/app/src/explore/ExploreBackground.tsx
  modified:
    - packages/app/src/config.ts
    - packages/app/src/styles.css
    - packages/app/src/explore/ConstellationCanvas.tsx

key-decisions:
  - "Owner-locked MVP is the DOM/CSS backdrop layer (todo Option 1), not the canvas onRenderFramePre pan/zoom-locked sky (Option 2) — Option 2 remains a documented future escalation"
  - "Blooms centered via left/top + negative margins (not transform) so the drift keyframe's transform is unencumbered"
  - "Bloom pulse folded into the same transform keyframe as a gentle scale — transform-only, avoids animating per-bloom opacity"
  - "Wrapper's bg-surface (#0C0C10) retained as the opaque base; canvas made transparent (rgba(0,0,0,0)) so dim overlays still read against #0C0C10"

patterns-established:
  - "Pattern: config.explore.background is the single tunable surface for the backdrop — no magic numbers in the component or CSS"

requirements-completed: [EXPL-06, "todo-260717-sjg"]

# Metrics
duration: 4min
completed: 2026-07-18
---

# Phase quick-260717-sjg: Animated Galaxy Gradient Backdrop Summary

**Config-driven CSS radial-gradient nebula (3 drifting blooms + static star-specks) behind the GizzVerse constellation, with the ForceGraph2D canvas made transparent so it shows through — reduced-motion-gated and gesture-transparent.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-18T00:39:28Z
- **Completed:** 2026-07-18T00:42:50Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Added `config.explore.background`: three off-center nebula blooms (violet / indigo / teal, low opacity), a shared blur, a gentle pulse scale, and a static star-speck opacity — every value marked `[ASSUMED]`.
- New `ExploreBackground.tsx`: an `aria-hidden` + `pointer-events-none` + `absolute inset-0` decorative layer of config-driven radial-gradient blooms plus a non-animated CSS star-speck field. No state, no effects, no per-frame JS, no external assets.
- Added `@keyframes explore-bg-bloom` to styles.css, attached to `.explore-bg-bloom` ONLY inside a `@media (prefers-reduced-motion: no-preference)` block (static by default). Transform-only (translate + scale), driven by per-bloom `--explore-bg-*` custom properties.
- Wired `<ExploreBackground />` as the first child of the `relative flex-1 ... bg-surface` wrapper (behind `<ForceGraph2D>`) and changed the canvas `backgroundColor` from opaque `#0c0c10` to transparent `rgba(0, 0, 0, 0)` so the nebula shows through, while the wrapper's `bg-surface` stays the opaque #0C0C10 base.

## Task Commits

Each task was committed atomically:

1. **Task 1: config.explore.background tunables + ExploreBackground.tsx + reduced-motion CSS** - `458dd74` (feat)
2. **Task 2: Wire ExploreBackground into ConstellationCanvas + transparent canvas** - `08abf39` (feat)

## Files Created/Modified
- `packages/app/src/explore/ExploreBackground.tsx` (created) - Decorative aria-hidden/pointer-events-none CSS-gradient nebula layer (blooms + static specks), fully config-driven.
- `packages/app/src/config.ts` (modified) - Added the `config.explore.background` tunable block (blooms, `BLUR_PX`, `PULSE_SCALE`, `SPECK_OPACITY`), all `[ASSUMED]`.
- `packages/app/src/styles.css` (modified) - Added `@keyframes explore-bg-bloom` + the reduced-motion-gated `.explore-bg-bloom` animation.
- `packages/app/src/explore/ConstellationCanvas.tsx` (modified) - Imported + rendered `<ExploreBackground />` behind the canvas; made `ForceGraph2D backgroundColor` transparent.

## Final config.explore.background values ([ASSUMED])

| Bloom | color | opacity | sizeVmin | x / y | drift X% / Y% | driftMs | delayMs |
|-------|-------|---------|----------|-------|---------------|---------|---------|
| violet | `#6D28D9` | 0.18 | 95 | 0.24 / 0.26 | 5 / -4 | 46000 | 0 |
| indigo | `#4338CA` | 0.15 | 115 | 0.78 / 0.34 | -6 / 5 | 57000 | -13000 |
| teal   | `#0D9488` | 0.11 | 85 | 0.55 / 0.82 | 4 / 6 | 64000 | -30000 |

- `BLUR_PX`: 64
- `PULSE_SCALE`: 1.07
- `SPECK_OPACITY`: 0.4

All values are starting points to tune on device (single-config rule — no magic numbers in the component or CSS).

## Decisions Made
- Implemented the owner-locked MVP (todo Option 1: DOM/CSS backdrop layer). **Option 2 (canvas `onRenderFramePre` pan/zoom-locked sky that translates/scales with the camera) remains a documented future escalation** if a parallaxed, camera-locked starfield is desired.
- Centered blooms via `left`/`top` + negative margins rather than a base transform, keeping the drift keyframe's `transform` free (no compose conflict).
- Folded the "pulse" into the same transform keyframe as a gentle scale, so no per-bloom `opacity` animation is needed (transform-only, GPU-composited).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. App `tsc` clean and the `@guezzer/app` vitest project green (232/232) after each task. The jsdom "Not implemented: HTMLCanvasElement's getContext()" / "navigation to another Document" lines in the vitest output are pre-existing environment noise, unrelated to this change.

## Verification

- **App typecheck:** `npx tsc -p packages/app/tsconfig.json` → clean (exit 0), both tasks.
- **App tests:** `npx vitest run --project @guezzer/app` → 40 files / 232 tests passed, both tasks (no regressions).
- **Grep (wiring):** `<ExploreBackground` present in ConstellationCanvas.tsx; `backgroundColor="rgba(0, 0, 0, 0)"` (no `#0c0c10` canvas fill remains).
- **Grep (reduced-motion gate):** `explore-bg-bloom` animation appears ONLY inside a `@media (prefers-reduced-motion: no-preference)` block in styles.css.

## Required on-device owner follow-up (NOT provable by automated checks)

Legibility and subtlety are visual properties that tests cannot confirm. On the GizzVerse tab, the owner should verify on-device:
1. The nebula reads as **subtle** ambient depth — it does not compete with the constellation.
2. **Tuning-color node fills, the 20%-alpha muted edges, focus-dim (0.12) and Dex-dim (0.35 grayscale) overlays all stay clearly legible** over the backdrop. If a 0.12 focus-dimmed non-neighbor node washes out against a bloom, lower the bloom `opacity` values in `config.explore.background`.
3. **Pan / zoom / tap are unaffected** (the backdrop is aria-hidden + pointer-events-none — it must never intercept the canvas gestures).
4. Motion drifts **slowly** with motion enabled and is **fully static** under reduced motion.

Reason-check (not a pixel check): blooms cap at 0.18 peak opacity fading to transparent, well below full node/edge alpha, and the base stays #0C0C10 via the wrapper — so contrast should hold — but this is an assumption to confirm visually.

## Next Phase Readiness
- GizzVerse constellation now renders over a config-driven CSS-gradient nebula; no `packages/core` changes (decorative, app-side only).
- Follow-up tuning happens entirely in `config.explore.background`.

## Self-Check: PASSED

All created/modified files exist on disk; both task commits (`458dd74`, `08abf39`) are present in git history.

---
*Phase: quick-260717-sjg*
*Completed: 2026-07-18*
