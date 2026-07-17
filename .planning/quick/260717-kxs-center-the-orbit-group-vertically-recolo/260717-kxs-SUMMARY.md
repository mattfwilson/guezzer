---
phase: quick-260717-kxs
plan: 01
subsystem: show (LiveGizz tracking view)
tags: [ui, orbit, comet-trail, tuning-color, centering]
requires:
  - packages/app/src/show/orbitLayout.ts (unchanged, PURE)
  - packages/app/src/show/tuningColor.ts
  - packages/app/src/show/matrix.ts
provides:
  - OrbitStage translateY wrapper centering the orbit group bbox on cy
  - CometTrail dots + sheet rings colored by tuning family
affects:
  - packages/app/src/show/OrbitStage.tsx
  - packages/app/src/show/CometTrail.tsx
  - packages/app/test/cometTrail.test.tsx
tech-stack:
  added: []
  patterns:
    - Derived (not config-constant) layout offset computed in the component
    - Guarded matrix read (loadMatrix().ok before getMatrixIndex())
key-files:
  created: []
  modified:
    - packages/app/src/show/OrbitStage.tsx
    - packages/app/src/show/CometTrail.tsx
    - packages/app/test/cometTrail.test.tsx
decisions:
  - "Centering offset derived from the rendered layout bbox, not a magic number (single-config rule)."
  - "orbitLayout.ts kept pure/untouched; all centering lives in OrbitStage."
  - "Trail color asserted against the tuningColor() expression from the real bundled matrix, not a hardcoded hex."
metrics:
  duration: ~6 min
  completed: 2026-07-17
  tasks: 2
  files: 3
---

# Phase quick-260717-kxs Plan 01: Center the Orbit Group Vertically + Recolor the Comet Trail Summary

Two app-layer LiveGizz Show polish fixes: the orbit group (centre orb + prediction fan) is now translated so its bounding box centres on `cy` (killing the ~23px lopsided empty band below a pentagon), and the comet-trail history dots + full-setlist rings are colored by tuning family (matching the main orbs) instead of hit-green / miss-red.

## What Was Built

### Task 1 — Vertically center the orbit group (`OrbitStage.tsx`)
- Added a pure `orbitGroupOffset(layouts, orbs, cy, centerDiameter)` helper that seeds the group bbox with the centre node's `[cy ± ORB_CENTER_DIAMETER/2]` extent, expands it by each rendered orb's `[y ± diameterPx/2]`, and returns `cy - (groupTop + groupBottom) / 2`. Returns `0` when there are no orbs.
- Computed `orbitOffset` in the render body from `renderLayouts` / `renderOrbs` (the frozen snapshot during a collapse, so it stays stable within a fan); `0` when `!laidOut` so the pre-opener "Search for the opener" prompt stays centred.
- Wrapped BOTH the centre-node block and the `renderOrbs.map(...)` list in a single new `absolute inset-0` div carrying `style={{ transform: translateY(offset) }}` (undefined when 0). The wrapper excludes the bottom-anchored weak-fan hint and the outer `stageRef` (measured whole by the ResizeObserver).
- Transform applied regardless of `prefers-reduced-motion` (it is a static layout offset, not an animation). No `dx/dy/initial/animate/transition` values changed, so the tapped-orb collapse glide still lands on the centre on the same frame.
- `orbitLayout.ts` left PURE and UNCHANGED.

### Task 2 — Recolor the comet trail by tuning family (`CometTrail.tsx` + test)
- Added a module-level `trailColor(entry)` resolver: `entry.songId != null && loadMatrix().ok ? getMatrixIndex().nodeById.get(entry.songId)?.tuningFamily ?? null : null`, passed to `tuningColor()`. Guarding on `loadMatrix().ok` means `getMatrixIndex()` is never called past the load guard, and a `???`/off-matrix entry falls back to the muted `#A1A1AA`.
- Trail dot `backgroundColor` and FullSetlistSheet ring `borderColor` now use `trailColor(entry)`.
- Removed the now-unused `RING_COLOR` map and the `EntryOutcome` import from the component; updated the header doc-comment prose to describe tuning-family coloring.
- Rewrote the color test to assert tuning coloring against the REAL bundled matrix: it finds a real songId whose family maps to a non-fallback color, asserts the dot equals `normalizeColor(tuningColor(family))`, and asserts a null-songId (`???`) entry gets the muted fallback. Added an optional `songId` param to the `entry()` fixture (defaults unchanged) and a `normalizeColor()` helper that pushes an expected hex through jsdom for form-agnostic comparison. Removed the stale `HIT_FORMS`/`MISS_FORMS` constants. The other cometTrail tests (count, +N compression, diminishing size, fit-to-width) are unchanged and green.

## Verification
- `cd packages/app && npx tsc --noEmit` — clean (both tasks).
- `npx vitest run cometTrail` (repo root) — 8/8 passing.
- `npx vitest run` (repo root) — full suite green: 68 files, 496 tests. (The jsdom "Not implemented: getContext / navigation" lines are pre-existing environment warnings, unrelated to these changes.)
- Human visual check (dev server on http://localhost:5175) deferred to the owner: orbit group centred, collapse glide still lands on centre, trail dots show tuning colors.

## Deviations from Plan
None — plan executed exactly as written.

## Commits
- `73aec72` fix(show): vertically center the orbit group bounding box
- `16d4613` feat(show): color comet-trail dots by tuning family, not hit/miss

## Self-Check: PASSED
- FOUND: packages/app/src/show/OrbitStage.tsx (modified)
- FOUND: packages/app/src/show/CometTrail.tsx (modified)
- FOUND: packages/app/test/cometTrail.test.tsx (modified)
- FOUND commit: 73aec72
- FOUND commit: 16d4613
