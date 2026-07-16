---
phase: 07-explore-mode-constellation
plan: 02
subsystem: app
tags: [explore, constellation, force-graph, canvas, render, route, pwa]

# Dependency graph
requires:
  - phase: 07-explore-mode-constellation
    plan: 01
    provides: deriveConstellation({nodes,links}) + Constellation types + config.explore render/copy blocks
  - phase: 04-show-mode
    provides: loadMatrix() guarded sentinel + OrbitStage ResizeObserver sizing pattern + tuningColor()
provides:
  - ConstellationCanvas — single <ForceGraph2D> component (fill/label/edge draw + 22px tap floor + settle-freeze) (EXPL-01/EXPL-06)
  - ExploreView — #/explore route root (guarded matrix load → derive → render, calm error state)
  - App.tsx #/explore → ExploreView wiring + non-scrolling canvas seam
  - new app dependency react-force-graph-2d@1.29.1 (app package only)
affects: [07-03 canvas-label device spike (tunes LABEL_AT_REST_TOP_K/physics), 07-04 focus-dim (reads fgRef + focus state), NodeSheet, ExploreFilterFab]

# Tech tracking
tech-stack:
  added:
    - "react-force-graph-2d@1.29.1 (app package only; umbrella react-force-graph and a separate d3-force dep both avoided per CLAUDE.md)"
  patterns:
    - "Single canvas graph component: one nodeCanvasObject (mode 'replace') owns fill + zoom-gated/top-K label; ctx.fillText only (T-07-02, no innerHTML)"
    - "Container-measured ForceGraph2D via OrbitStage's ResizeObserver pattern (never window-dims default, Pitfall 2)"
    - "Settle-and-freeze: cooldownTicks + onEngineStop fixes fx/fy on every node so pan/zoom never reheats (EXPL-06)"
    - "Route view reuses the guarded loadMatrix() sentinel → calm error state, never a throw (T-07-03, mirrors Phase-4 model-load-failure)"

key-files:
  created:
    - packages/app/src/explore/ConstellationCanvas.tsx
    - packages/app/src/explore/ExploreView.tsx
  modified:
    - packages/app/package.json
    - package-lock.json
    - packages/app/src/App.tsx

key-decisions:
  - "Adapted plan's pnpm commands to npm workspaces (repo uses package-lock.json, no pnpm) — 07-01 SUMMARY established this; no functional impact"
  - "Pinned react-force-graph-2d to exact 1.29.1 (npm defaulted to ^1.29.1) to match the repo's exact-pin convention for runtime deps + acceptance-criteria wording"
  - "Node radius = NODE_RADIUS_MIN + sqrt(playCount) clamped to NODE_RADIUS_MAX (no extra scale factor); reaches max ~playCount 100, matching the UI-SPEC region-2 formula"
  - "Zoom-revealed labels render in text-muted (#A1A1AA) per §Color — focus/neighbor text-primary labels arrive with the focus slice (07-04)"
  - "ExploreView owns focus/rotation/dex-overlay local state now (plan directive), referenced via a void tuple so it reads as intentional forward-scaffold, not dead code, until later slices consume it"

patterns-established:
  - "Pattern: first non-DOM (canvas) view — geometry/physics constants sourced from config.explore, zero magic numbers in the component"
  - "Pattern: hooks-before-early-return — useMemo derives graphData conditionally (null when !ok) so the guarded-load error branch never violates rules-of-hooks"

requirements-completed: [EXPL-01, EXPL-06]

# Metrics
duration: 22min
completed: 2026-07-16
---

# Phase 7 Plan 02: Explore Constellation Render Stage Summary

**The Explore tab now renders a real force-directed transition constellation at `#/explore`: `react-force-graph-2d` in a single `ConstellationCanvas` component fed by the pure-core `deriveConstellation`, nodes tuning-colored and play-count-sized with zoom-gated labels and a 22px tap floor, physics that settles then freezes — mounted via `ExploreView` behind the existing guarded matrix loader with a calm error fallback.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 2 (both `type="auto"`)
- **Files:** 5 (2 created, 3 modified)

## Accomplishments
- Installed `react-force-graph-2d@1.29.1` to the app package ONLY — the umbrella `react-force-graph` (three.js/VR) is absent, no separate `d3-force` dep was added, and core `package.json` is untouched (core stays React/DOM-free; the derivation is core, the renderer is app-side).
- `ConstellationCanvas` wraps `<ForceGraph2D>` with the OrbitStage ResizeObserver sizing pattern so the canvas measures its real px box and never defaults to window dims / overflows under the BottomTabBar (RESEARCH Pitfall 2). Gesture-suppression container classes (`touch-none select-none overflow-hidden` + `overscrollBehavior: none`) hand all pan/zoom/tap to the library.
- A single `nodeCanvasObject` (mode `'replace'`) draws: sqrt-scaled radius clamped to `NODE_RADIUS_MAX`, `tuningColor()` fill, and a zoom-gated label (drawn past `LABEL_ZOOM_THRESHOLD` OR for the memoized top-`LABEL_AT_REST_TOP_K` nodes) at constant screen-space size (`12/globalScale`), ellipsized at `LABEL_MAX_CHARS` — via `ctx.fillText` only, so kglw-derived song names can never inject (T-07-02).
- `nodePointerAreaPaint` enforces a `NODE_HIT_MIN_RADIUS_PX / globalScale` hit floor, guaranteeing 44px tap equivalence regardless of a node's visual size.
- Directed, count-weighted neutral edges (`#A1A1AA` @20%, width `clamp(0.5 + sqrt(count)*0.5, ,4)`, arrow length 3.5 at 90% along the edge). Settle-and-freeze: `cooldownTicks`/`d3AlphaDecay`/`d3VelocityDecay` from config, and `onEngineStop` fixes `fx=x, fy=y` on every node so pan/zoom never reheats (EXPL-06). A `fgRef` is held for the camera control (centerAt/zoom) the chain-hop focus slice needs.
- `ExploreView` reuses `loadMatrix()` verbatim, branches on `.ok`, derives `graphData` via `deriveConstellation` inside a `useMemo` keyed on the stable load result, and renders the canvas — or the calm `config.copy.explore` error state (Telescope glyph) on a schema-guard failure, blocking only this view.
- `App.tsx` routes `#/explore` to `<ExploreView>` (replacing the `PlaceholderView` fall-through) and widens the non-scrolling seam to `scroll={route !== "show" && route !== "explore"}` so the canvas owns the full viewport. `ROUTES` and the BottomTabBar Compass tab were untouched (already present).

## Task Commits

1. **Task 1: Install react-force-graph-2d + ConstellationCanvas render stage** — `520fbb1` (feat)
2. **Task 2: ExploreView route root + App.tsx wiring** — `7df9f43` (feat)

## Files Created/Modified
- `packages/app/src/explore/ConstellationCanvas.tsx` - single ForceGraph2D component: sized canvas, fill/label draw, tap floor, edges, settle-freeze (EXPL-01/EXPL-06)
- `packages/app/src/explore/ExploreView.tsx` - #/explore root: guarded load → derive → render + calm error state
- `packages/app/package.json` - adds `react-force-graph-2d` at exact `1.29.1`
- `package-lock.json` - locked dependency tree for the new package (+38 transitive packages, no three.js)
- `packages/app/src/App.tsx` - #/explore → ExploreView branch + widened non-scrolling seam

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Tooling] Plan's pnpm commands adapted to npm workspaces**
- **Found during:** Task 1 (install) and both verify steps
- **Issue:** The plan specifies `pnpm --filter @guezzer/app add …`, `pnpm --filter @guezzer/app exec tsc`, `pnpm -w test`. The repo is an **npm** workspace (`package-lock.json`, no `pnpm-lock.yaml`, `packageManager` unset) — 07-01 SUMMARY already established this.
- **Fix:** Used npm equivalents: `npm install react-force-graph-2d@1.29.1 -w @guezzer/app`, `npx tsc --noEmit -p packages/app/tsconfig.json`, `npm test`, `npm run build -w @guezzer/app`. Identical result; the CLAUDE.md stack lists pnpm as recommended but npm workspaces as an approved equal.
- **Files modified:** none beyond the intended dependency changes
- **Commit:** `520fbb1`

**2. [Convention] Exact version pin**
- npm resolved the new dependency to `^1.29.1`; the repo pins every runtime dependency exactly (`dexie: "4.4.4"`, `react: "19.2.7"`) and the acceptance criteria require it "at `1.29.1`". Pinned to exact `1.29.1` and re-synced the lockfile (verified `1.29.1` in `package-lock.json`).

## Notes on Forward-Scaffold State
`ExploreView` owns `focusId` / `rotationOnly` / `dexOverlay` local state per the plan's explicit directive ("own local useState for focus/filter/overlay now … fields consumed by later slices"). This slice wires only the render (full-catalog population; rotation-as-default is Slice 3, edge slider + focus-dim later), so these are referenced via a `void` tuple to read as intentional forward-scaffold rather than dead code. Not a data stub — no placeholder/empty value flows to any rendered UI; the constellation renders the real derived graph.

## Issues Encountered
- The fresh worktree had no `node_modules`; ran `npm install` to bootstrap (expected per the spawn note). The jsdom test run prints a benign "HTMLCanvasElement's getContext() … without installing the canvas npm package" line — no test imports the canvas component (canvas draw is validated by the 07-03 device spike, not jsdom, per RESEARCH §Validation), and all 480 tests pass.

## User Setup Required
None — pure read/derive/render, no network, persistence, or secrets. On-device readability/performance (label crowding, Full-catalog settle perf) is deferred to the Plan 07-03 human-verify device spike.

## Verification
- App typecheck: `npx tsc --noEmit -p packages/app/tsconfig.json` → exit 0
- Full suite: `npm test` → 480 passed (65 files)
- Vite build: `npm run build -w @guezzer/app` → exit 0, bundle includes react-force-graph-2d (3017 modules); the >500 KB single-chunk warning is pre-existing (CLAUDE.md bundles the model artifact by design), out of scope
- Dependency guard: `react-force-graph-2d` at exact `1.29.1`; umbrella package absent; no `d3-force` dep; core `package.json` unchanged; no `three` in `node_modules`

## Self-Check: PASSED

Both created files (`ConstellationCanvas.tsx`, `ExploreView.tsx`) and both modified files (`packages/app/package.json`, `App.tsx`) exist on disk; both task commits (`520fbb1`, `7df9f43`) are present in git history. App typecheck exit 0, full suite 480/480 green, vite build exit 0.

---
*Phase: 07-explore-mode-constellation*
*Completed: 2026-07-16*
