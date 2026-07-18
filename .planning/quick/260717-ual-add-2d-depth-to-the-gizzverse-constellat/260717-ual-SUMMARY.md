---
quick_id: 260717-ual
type: quick
title: 2D depth for the GizzVerse constellation — spherical shading + depth-scaling + occlusion + depth-edges + nebula parallax
status: complete
governing_decisions: [EXPL-01, EXPL-06, spike-001]
completed: 2026-07-17
files_created:
  - packages/app/src/explore/depthColor.ts
  - packages/app/test/explore/depthColor.test.ts
files_modified:
  - packages/core/src/explore/derive-constellation.ts
  - packages/core/test/explore/derive-constellation.test.ts
  - packages/app/src/config.ts
  - packages/app/src/explore/ConstellationCanvas.tsx
  - packages/app/src/explore/ExploreBackground.tsx
commits:
  - 943e121 test(260717-ual): failing z-depth + far→near + maxPlay=0 tests (RED)
  - f8957c7 feat(260717-ual): synthetic z-depth + far→near occlusion sort (GREEN)
  - 22fa408 test(260717-ual): failing format-agnostic color-helper tests (RED)
  - a12030f feat(260717-ual): spherical shading + z depth-scaling + depth edges (GREEN)
  - 8658b39 feat(260717-ual): onZoom-driven damped nebula parallax
---

# Quick Task 260717-ual: GizzVerse Constellation 2D Depth Stack — Summary

Gave the Explore constellation genuine 2D depth on the existing `react-force-graph-2d`
canvas (no three.js): pure-core synthetic `z` + far→near occlusion sort, an app-side
spherical-shading + depth-scaling draw pass (near = bigger/brighter/saturated, far =
smaller/dimmer/faded toward `#0C0C10`) applied to BOTH the caught color path AND the
default unseen grayscale path, subtle depth-weighted edges, and an `onZoom`-driven
damped nebula parallax. Every effect is baked into the draw pass or interaction-driven —
no continuous per-frame animation, no d3 reheat (EXPL-06).

## What was built (per task)

**Task 1 — Core `z` + occlusion sort (TDD).** Added a required `z: number` to
`ConstellationNode` (`z = √playCount / √maxPlayCount` ∈ [0,1], 1 = nearest), guarded so
`maxPlayCount === 0` yields `z = 0` (never NaN — the spike bug #1 class). Replaced the
`songId`-ascending sort with a far→near comparator (`a.z - b.z || a.id - b.id`) so the
renderer, which paints in `graphData.nodes` array order, draws the nearest node last for
correct occlusion. No config constant added (z is data-derived) — the configMirror is
untouched. Tests: retargeted the sort assertion to `[20,10,30]` with exact z-values
(Rattlesnake z=1, Gamma Knife z=0.5), added a `maxPlayCount===0` guard test.

**Task 2 — App spherical shading + depth-scaling + depth edges (TDD).** New pure
`depthColor.ts` (extracted so the spike-bug-#1 helper is unit-testable): `parseColor`
accepts `#RRGGBB`, `#RGB`, `rgb()`, and `rgba()` and never yields NaN;
`mixColor`/`fadeToward` blend either format; `sphereGradient` builds the offset
highlight → base → rim-shadow radial gradient (shape from config). Added a documented
`config.explore.depth` block (radius/opacity/fade/gradient/edge tunables, all `[ASSUMED]`).
In `ConstellationCanvas`: visual radius scaled by `lerp(FAR,NEAR,z)`; base color faded
toward `DEPTH_SURFACE` by `(1-z)·DEPTH_FADE_MAX` on BOTH caught + grayscale paths;
combined alpha `max(DEPTH_ALPHA_FLOOR, min(focusAlpha,dexAlpha)·depthAlpha)` (D-D); flat
disc replaced with `sphereGradient`; rings/count/label offsets follow the depth-scaled
radius. Depth-weighted edges via a memoized `nodeZById` map (endpoint-avg z) modulating
`linkWidth` and the no-focus edge opacity — focus highlight/dim precedence still wins.
The 22px tap floor is preserved: `nodePointerAreaPaint` keeps the UNSCALED `radiusFor`.

**Task 3 — Nebula parallax.** Added `PARALLAX_TRANSLATE_DAMP` / `PARALLAX_ZOOM_DAMP` to
`config.explore.background`. `ExploreBackground` takes an optional `parallax` prop and
applies a GPU `translate3d(...) scale(...)` (`willChange: transform`) on its root,
composing above the per-bloom drift; static under `prefers-reduced-motion` (read once).
`ConstellationCanvas` holds `bgParallax` state, sets it from `<ForceGraph2D onZoom>`
(`x/y × TRANSLATE_DAMP`, `k = 1 + (k-1)·ZOOM_DAMP`), and passes it to the sibling nebula.
Pure sibling CSS transform — no graphData rebuild, no reheat, fx/fy untouched.

## Verification (actual results)

| Check | Command | Result |
|-------|---------|--------|
| Core depth tests | `vitest run packages/core/.../derive-constellation.test.ts` | **11 passed** (incl. far→near, z-values, maxPlay=0 guard) |
| Core typecheck | `tsc -p packages/core/tsconfig.json --noEmit` | **clean** |
| Config mirror | `vitest run packages/app/test/configMirror.test.ts` | **1 passed** (unchanged — no core config touched) |
| Color helper tests | `vitest run packages/app/test/explore/depthColor.test.ts` | **10 passed** (hex + rgb + rgba, no NaN) |
| App typecheck | `tsc -p packages/app/tsconfig.json --noEmit` | **clean** |
| App suite | `vitest run packages/app` | **242 passed (41 files)** |

TDD gates present in git log: `test(...)` RED commits precede both `feat(...)` GREEN
commits (943e121→f8957c7, 22fa408→a12030f).

**EXPL-06 self-audit (code review, not a test):** no continuous/time-based canvas
animation added — depth shading/scaling/fade/occlusion are all baked into the single
`nodeCanvasObject` draw pass (force-graph's `autoPauseRedraw` repaints only on
interaction); parallax is `onZoom`-driven only; nothing in the depth or parallax paths
rebuilds `graphData`, reheats d3, or writes `fx/fy`.

## Deviations from plan

**[Structural — testability] Color helpers extracted to `depthColor.ts` instead of
defined inline in `ConstellationCanvas.tsx`.** The plan's action text described adding
`parseColor`/`mixColor`/`fadeToward`/`sphereGradient` inside the component. They were
placed in a new pure `packages/app/src/explore/depthColor.ts` module and imported into
the component so the spike-bug-#1 blend (hex AND rgb inputs, never NaN) is unit-tested in
isolation (importing the `.tsx` — which pulls `react-force-graph-2d` — into a jsdom test
is fragile). The component still references the helpers and the `parseColor` symbol; the
must_haves artifact contract (`ConstellationCanvas.tsx contains "parseColor"`) is
satisfied via the import + the documenting comment. No behavior change; purely where the
pure functions live. All other files match the plan's `files_modified` list.

No Rule 1/2/3 auto-fixes were needed — the plan executed as written otherwise.

## Owner on-device follow-up (NOT provable by tests)

The following require a ~1-minute eyeball on the iPhone (the spike already de-risked the
ball look + desktop perf, but these are not test-provable):
- The shaded-ball look on tuning-colored orbs (overlay OFF) and on the default grayscale
  silhouettes (overlay ON, zero catches).
- Correct occlusion (near orbs overpaint far orbs).
- The subtlety of the depth-weighted edges (not over-done).
- 264-node pan/zoom smoothness and the parallax "feel" (damping tuning) on device.

Depth tunables (`config.explore.depth`) and parallax damping
(`config.explore.background.PARALLAX_*`) are all `[ASSUMED]` starting points — adjust in
the single config file if the on-device look wants more/less.

## Note for reviewers (worktree resolution)

Executed inside an isolated git worktree whose `@guezzer/core` symlink resolves to the
main checkout's `packages/core` (which lacks the new `z` field until this branch merges).
A worktree-local `node_modules/@guezzer` shim (gitignored, not committed) was created so
`app` tsc/tests typecheck against the worktree's core during isolated execution. Once this
branch merges, the standard main-repo `@guezzer/core` symlink resolves the `z` field
natively and the shim is irrelevant.

## Self-Check: PASSED

All created/modified files exist on disk and all five task commits
(943e121, f8957c7, 22fa408, a12030f, 8658b39) are present in git history.
