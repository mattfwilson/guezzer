---
quick_id: 260717-ry0
type: quick
title: Declutter GizzVerse constellation — top-K-per-node sparsification + focus reveal + curved links
governing_decisions: [EXPL-04, EXPL-06, D-07, D-08]
status: complete
completed: 2026-07-17
tasks_completed: 3
files_changed: 10
tests: { core: "276 passed", app: "232 passed" }
key-files:
  created: []
  modified:
    - packages/core/src/explore/derive-constellation.ts
    - packages/core/test/explore/derive-constellation.test.ts
    - packages/core/src/config.ts
    - packages/core/src/index.ts
    - packages/app/src/config.ts
    - packages/app/src/explore/ConstellationCanvas.tsx
    - packages/app/src/explore/ExploreView.tsx
    - packages/app/src/explore/ExploreFilterFab.tsx
    - packages/app/src/explore/ExploreFilterPanel.tsx
    - packages/app/test/configMirror.test.ts
commits:
  - 4aa5028: test(quick-260717-ry0) failing fixtures for topKEdgesPerNode (RED)
  - 9f5cc13: feat(quick-260717-ry0) topKEdgesPerNode sparsifier + core config rename (GREEN)
  - a75d81f: feat(quick-260717-ry0) canvas top-K declutter + focus reveal + curved links
  - 0aaf097: feat(quick-260717-ry0) slider re-semantics + prop rename + config mirror
---

# Quick 260717-ry0: Declutter GizzVerse Constellation Summary

Replaced the GizzVerse (Explore) constellation's global `count ≥ X` edge slider with degree-aware **top-K-per-node** sparsification — each song draws only its K highest-count OUT edges (default K=2, ~332 of 2,987 edges, −68% vs the old 1,041-edge hairball) — added a focus exemption that reveals a focused node's FULL real neighborhood past the gate, and bowed reciprocal A→B / B→A edge pairs apart with native `linkCurvature`. Every change is a pure render-pass filter/prop: no `graphData` rebuild, no d3 reheat, frozen `fx/fy` survive (EXPL-06).

## What changed

**Task 1 — pure core sparsifier (TDD).**
- `topKEdgesPerNode(links, k)` added beside `edgesAtThreshold` in `derive-constellation.ts`: groups links by `fromId`, sorts each bucket by the deterministic comparator (count desc, then `toId` asc), slices to K, returns the union. DOM-free, operates on the immutable `fromId`/`toId` copies (Pitfall 1). Exported from the `@guezzer/core` barrel.
- Six new fixture cases: hub-cap, leaf-keep-all, deterministic tie-break, k=1, k≥maxdeg (union==input), reciprocal-both-survive. Written RED first (`topKEdgesPerNode is not a function`), then GREEN.
- Core config renamed to top-K semantics: `EDGE_COUNT_THRESHOLD_DEFAULT/EDGE_SLIDER_MIN/EDGE_SLIDER_MAX` → `TOP_K_PER_NODE_DEFAULT/_MIN/_MAX` = **2 / 1 / 5**, with rewritten `[VERIFIED]` prose (top-K, not "played together").

**Task 2 — canvas render wiring.**
- Added render-only `config.explore.LINK_CURVATURE = 0.2` `[ASSUMED]` app-side (no core mirror — consistent with `NODE_RADIUS_*`/`CHARGE_STRENGTH`).
- `ConstellationCanvas`: renamed `edgeThreshold` prop → `topK` (type + JSDoc updated); imports `topKEdgesPerNode`; precomputes a memoized kept-link identity `Set` keyed by `"fromId->toId"` (memo deps `[graphData, topK]`, `null` when `topK == null`).
- `linkVisibility` now tests kept-set membership **exempting focus-touching links** (`l.fromId === focusId || l.toId === focusId`) — the exemption lives in the predicate, not the Set, so focusing never rebuilds the memo.
- Added `linkCurvature` accessor: `l.fromId < l.toId ? +LINK_CURVATURE : -LINK_CURVATURE` — deterministic opposite bow for reciprocal pairs. `linkDirectionalArrow*` untouched (arrows draw along the curved path natively).

**Task 3 — slider re-semantics + rename ripple + mirror.**
- App config mirror renamed to `TOP_K_PER_NODE_DEFAULT/_MIN/_MAX` (2/1/5) with rewritten MIRRORS comments; `copy.explore.edgeSliderLabel` changed from `Played together ≥ {x}×` to `Top {x} per song`.
- `configMirror.test.ts` asserts the three renamed keys.
- `ExploreView` state `edgeThreshold`/`setEdgeThreshold` → `topK`/`setTopK`, seeded from `TOP_K_PER_NODE_DEFAULT`, passed `topK` to the canvas and `topK`/`onTopKChange` to the FAB.
- `ExploreFilterFab` and `ExploreFilterPanel` props renamed; panel reads `TOP_K_PER_NODE_MIN/_MAX` for the range input (now 1–5), binds value/aria/label to `topK`.

## Verification

| Check | Result |
|-------|--------|
| `vitest run --project @guezzer/core` | 276 passed (29 files) — incl. 6 new topKEdgesPerNode fixtures |
| `tsc --noEmit -p packages/core/tsconfig.json` | clean (exit 0) |
| `vitest run --project @guezzer/app` | 232 passed (40 files) — incl. configMirror drift guard |
| `tsc --noEmit -p packages/app/tsconfig.json` | clean (exit 0) |
| grep guard `edgeThreshold\|onEdgeThresholdChange\|EDGE_SLIDER_M\|EDGE_COUNT_THRESHOLD` under `packages/app` | no matches (clean) |

Manual on-device checks (owner, non-blocking) remain per plan: at-rest ~top-2 edges/song, live slider 1–5 with no reshuffle/reheat, hub focus reveals full neighborhood, reciprocal pairs visibly bow apart with arrows intact.

## Deviations from Plan

**Environment (not a code deviation): worktree `@guezzer/core` resolution.**
The app-side typecheck/tests resolve `@guezzer/core` via node-module walk-up, which reached the **main repo's** `node_modules/@guezzer/core` symlink (pointing at the main repo's `packages/core`, not this worktree's edited source) — so the initial app `tsc` reported the renamed constants/export as missing. Fixed by creating worktree-local `node_modules/@guezzer/{core,app}` directory junctions to the worktree's own `packages/*`. `node_modules` is gitignored, so this is a local, non-committed verification fix only. After the worktree merges to main (where the symlink already points at the canonical `packages/core`), resolution is correct with no action needed.

Otherwise: plan executed exactly as written.

## Known Stubs

None. All wiring is live end-to-end (slider → `topK` state → canvas kept-set → render).

## Self-Check: PASSED

- Modified files present: `derive-constellation.ts`, `config.ts` (core+app), `index.ts`, `ConstellationCanvas.tsx`, `ExploreView.tsx`, `ExploreFilterFab.tsx`, `ExploreFilterPanel.tsx`, `configMirror.test.ts`, `derive-constellation.test.ts` — all verified on disk.
- Commits present in `git log`: 4aa5028, 9f5cc13, a75d81f, 0aaf097.
