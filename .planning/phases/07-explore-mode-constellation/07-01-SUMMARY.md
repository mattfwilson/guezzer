---
phase: 07-explore-mode-constellation
plan: 01
subsystem: core
tags: [explore, constellation, transition-matrix, force-graph, pure-core, config, tdd]

# Dependency graph
requires:
  - phase: 02-transition-matrix
    provides: TransitionMatrix artifact (nodes/edges) + MatrixNode/MatrixEdge domain types
  - phase: 06-pokedex-history-stats
    provides: archive.json artifact + ArchiveArtifact/ArchiveShow types (rotation source, D-05)
provides:
  - deriveConstellation(matrix, cfg?) → {nodes, links} with mutation-safe fromId/toId (EXPL-01)
  - edgesAtThreshold(links, x) render-pass edge filter, node population preserved (EXPL-04/D-08)
  - rankOutgoing(matrix, songId) → {total, bars} complete raw outgoing history (EXPL-02/D-01..D-04)
  - rotationSongIds(archive, N) → Set<number> last-N-shows rotation set (EXPL-03/D-05)
  - core config.explore block (ROTATION_WINDOW_SHOWS, EDGE_COUNT_THRESHOLD_DEFAULT, sliders, BARS_TOP_N)
  - app config.explore render block + copy.explore interpolating templates
affects: [07-02 matrix/archive loaders, 07-03 canvas-label spike, 07-04 focus-dim, ConstellationCanvas, NodeSheet, RankedBar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-core Explore derivation module (packages/core/src/explore/) mirroring dex/ — zero React/DOM, cfg param idiom"
    - "Mutation-safe graph-link contract: carry fromId/toId separately from library-mutated source/target (RESEARCH Pitfall 1)"
    - "Data-driven [VERIFIED] config constants (vs [ASSUMED] model knobs) recomputed against shipped artifacts"

key-files:
  created:
    - packages/core/src/explore/derive-constellation.ts
    - packages/core/src/explore/rank-outgoing.ts
    - packages/core/src/explore/rotation.ts
    - packages/core/test/explore/derive-constellation.test.ts
    - packages/core/test/explore/rank-outgoing.test.ts
    - packages/core/test/explore/rotation.test.ts
  modified:
    - packages/core/src/config.ts
    - packages/app/src/config.ts
    - packages/core/src/index.ts

key-decisions:
  - "deriveConstellation emits library default keys (id, source, target) so ConstellationCanvas needs no accessor props"
  - "Threshold logic is a separate exported predicate (edgesAtThreshold) operating on links only — node population never churns (D-08)"
  - "rankOutgoing returns the FULL outgoing history; the app applies BARS_TOP_N (slider/toggle-independent, D-03)"
  - "rotationSongIds sorts by date DESCENDING before slicing rather than trusting archive array order (Pitfall 5)"
  - "barsCollapse copy is an interpolator over BARS_TOP_N (Show top {n}) rather than the literal 'Show top 10' — no hardcoded config value"

patterns-established:
  - "Pattern: mutation-safe fromId/toId on constellation links so focus-dim adjacency survives force-graph's post-tick source/target mutation"
  - "Pattern: Explore tunables split by tier — derivation constants in core config, render constants in app config, copy as interpolating templates"

requirements-completed: [EXPL-01, EXPL-02, EXPL-03, EXPL-04]

# Metrics
duration: 18min
completed: 2026-07-16
---

# Phase 7 Plan 01: Explore Core Engine & Config Surface Summary

**Three pure fixture-tested core derivations (deriveConstellation, rankOutgoing, rotationSongIds) that transform the same transition-matrix/archive artifacts into constellation graph data, ranked next-song bars, and the rotation node set — plus the centralized core+app config surface every Explore UI slice consumes.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-16T14:45:00Z
- **Completed:** 2026-07-16T14:52:30Z
- **Tasks:** 3 (2 TDD)
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments
- `deriveConstellation` reshapes `TransitionMatrix` into `{nodes, links}` using react-force-graph-2d default accessor keys, with mutation-safe `fromId`/`toId` copies so focus-dim adjacency survives the library's post-tick `source`/`target` mutation (RESEARCH Pitfall 1).
- `edgesAtThreshold` render-pass predicate hides links below the count threshold while leaving the node array untouched (EXPL-04/D-08 free-floating star).
- `rankOutgoing` returns a node's COMPLETE raw outgoing history sorted by count with `pct = count/total` off the raw edges — never `predict()` (D-01), reading the full matrix edge list (D-03).
- `rotationSongIds` returns the distinct songs of the last N shows by date; the real-corpus guard confirms N=5 → **56 songs** exactly (D-06 [VERIFIED] default).
- Every Explore tunable centralized: core config (rotation window, edge threshold, slider bounds, bars top-N) and app config (radii, zoom thresholds, dim opacities, sheet peek, settle-and-freeze physics), plus `copy.explore` with every UI-SPEC string as an interpolating template.

## Task Commits

Each task was committed atomically:

1. **Task 1: Explore config surface (core + app) + copy** — `96f1833` (feat)
2. **Task 2: deriveConstellation + rankOutgoing** — `7d99bf1` (test, RED) → `5f4c9dd` (feat, GREEN)
3. **Task 3: rotationSongIds (fixture + real-corpus N=5→56 guard)** — `7c59ea0` (test, RED) → `18e3076` (feat, GREEN)

_TDD tasks 2 and 3 each have a RED (test) then GREEN (feat) commit; no refactor commit was needed (implementations were clean on first green)._

## Files Created/Modified
- `packages/core/src/explore/derive-constellation.ts` - `deriveConstellation` + `edgesAtThreshold` + node/link types (EXPL-01/D-08)
- `packages/core/src/explore/rank-outgoing.ts` - `rankOutgoing` + bar/result types (EXPL-02/D-01..D-04)
- `packages/core/src/explore/rotation.ts` - `rotationSongIds` (EXPL-03/D-05)
- `packages/core/test/explore/derive-constellation.test.ts` - EXPL-01/EXPL-04 fixtures (4 tests)
- `packages/core/test/explore/rank-outgoing.test.ts` - EXPL-02 fixtures incl. incoming-edge exclusion + honest zero (3 tests)
- `packages/core/test/explore/rotation.test.ts` - fixture out-of-order sort + real-corpus N=5→56 guard (3 tests)
- `packages/core/src/config.ts` - `config.explore` [VERIFIED] data-driven derivation constants
- `packages/app/src/config.ts` - `config.explore` [ASSUMED] render constants + `config.copy.explore` templates
- `packages/core/src/index.ts` - barrel exports for all three functions + their types

## Decisions Made
- Emitted the library's default accessor keys (`id`/`source`/`target`) in the derivation rather than setting `nodeId`/`linkSource` props on the component — keeps the canvas component's prop list minimal (RESEARCH Pattern 1).
- Kept the threshold filter as a standalone exported predicate rather than a param of `deriveConstellation`, so the node population is provably decoupled from the slider (D-08).
- Made `copy.explore.barsCollapse` an interpolator over `BARS_TOP_N` (`Show top {n}`) instead of the literal "Show top 10" — honors the single-source ethos over the verbatim string, since 10 is a config value.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The fresh git worktree had no `node_modules`; ran `npm install` (repo uses `package-lock.json`, not pnpm) to enable Vitest/tsc. No `package.json`/lockfile changes resulted. This is standard worktree bootstrap, not a plan deviation.

## User Setup Required
None - no external service configuration required. This plan is pure read/derive with no network, persistence, or secrets.

## Next Phase Readiness
- Wave 0 substrate is complete and green: 07-02 (loaders/view), 07-03 (canvas-label spike), and 07-04 (focus-dim) can now consume `deriveConstellation`/`rankOutgoing`/`rotationSongIds` and the centralized config from `@guezzer/core` and `config.explore` without editing any config file (cross-wave conflict eliminated by design).
- Core stays React/DOM-free (verified: `lib: ["ES2023"]` typecheck green, no react/window/document imports in `explore/`).
- Real-corpus data-driven default (N=5 → 56) is guarded by a test — a corpus refresh that changes density will fail loudly.

## Self-Check: PASSED

All 6 created source/test files exist on disk; all task commits (`96f1833`, `7d99bf1`, `5f4c9dd`, `7c59ea0`, `18e3076`) plus the metadata commit (`44f2054`) are present in git history. Full suite green (480 tests, +10 new), core + app typecheck clean (exit 0), core purity verified (no react/window/document imports in `explore/`).

---
*Phase: 07-explore-mode-constellation*
*Completed: 2026-07-16*
