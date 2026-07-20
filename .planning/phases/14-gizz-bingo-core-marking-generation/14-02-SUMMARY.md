---
phase: 14-gizz-bingo-core-marking-generation
plan: 02
subsystem: bingo-core
tags: [bingo, pure-core, context, wins, fixtures, tdd]
requires:
  - "packages/core/src/bingo/types.ts (MarkedCard, Win, BingoSquareDef, FREE_SENTINEL)"
  - "packages/core/src/config.ts (config.bingo.*)"
  - "shipped artifacts: TransitionMatrix, ArchiveArtifact, RarityIndex, DexAlbumsArtifact (structural)"
provides:
  - "buildBingoContext + BingoContext type (microtonalSongIds, corpusGap, albumSongIds, jamVehicleSongIds, eraPlayRate)"
  - "detectWins (4x4 line/corners/X/blackout) + expectedFill"
  - "shared bingo test fixtures (bingoCard, trailEntry, bingoContext, caught, markedCard) for Plans 03 & 04"
affects:
  - "Plan 03 (deriveMarks) — consumes BingoContext + detectWins"
  - "Plan 04 (deal) — consumes BingoContext + fixtures"
  - "Plan 05 (calibration CLI) — reuses buildBingoContext + detectWins"
tech-stack:
  added: []
  patterns:
    - "buildRarityIndex discipline: one exported fn, cfg default, Map-keyed single-pass, zero I/O"
    - "structural-local artifact input subsets (no nominal artifact / app-row imports, D-22)"
    - "stable-key sorted Map emit for byte-reproducibility (T-14-03 / Pitfall 4)"
key-files:
  created:
    - "packages/core/src/bingo/context.ts"
    - "packages/core/src/bingo/wins.ts"
    - "packages/core/test/fixtures/bingo/synthetic.ts"
    - "packages/core/test/bingo/context.test.ts"
    - "packages/core/test/bingo/wins.test.ts"
  modified: []
decisions:
  - "detectWins takes no cfg param — the free cell is already pre-marked (FREE_SENTINEL) in the card, so wins reads markedByPosition, never config.bingo.freeIndex directly (matches plan action rationale over the descriptive line-69 signature)"
  - "buildBingoContext keeps the plan's `archive` param for shipped-artifact-quartet parity (Plan 05 loads all four together) but derives corpusGap from the already-resolved RarityIndex rather than re-scanning the archive — one derivation per lookup, no redundant pipeline; marked `void archive` to self-document"
  - "fixtures index MarkedCard squares by their own `index` field in detectWins so array order is irrelevant"
metrics:
  tasks_completed: 2
  files_created: 5
  files_modified: 0
  tests_added: 13
  duration_minutes: 8
  completed: 2026-07-19
---

# Phase 14 Plan 02: Bingo Context & Win Detection Summary

Built the two pure support modules the bingo marking fold and generator depend on — `buildBingoContext` (resolves the four already-shipped artifacts into fast lookup Maps with zero new pipeline) and `detectWins` (4×4 line/corners/X/blackout geometry with the free center counting as marked) — plus the shared synthetic fixtures both wave-3 plans read.

## What Was Built

### Task 1 — `buildBingoContext` + shared fixtures (`cdea04d`)
- **`context.ts`**: `BingoContext` type + `buildBingoContext(matrix, archive, rarity, albums, cfg = config)`. Resolves five lookups in one stable pass each: `microtonalSongIds` (nodes where `tuningFamily === "microtonal"`), `eraPlayRate` (songId → `MatrixNode.eraPlayCount`), `corpusGap` (mirrors the `RarityIndex`), `albumSongIds` (album_url → non-null track songId Set), and `jamVehicleSongIds` (`cfg.bingo.jamVehicleSongIds`, empty pre-Plan-06). All emitted Maps/Sets are ascending-key sorted (T-14-03). Artifact input shapes are declared structurally-local — no nominal artifact or app-row imports (D-22).
- **`test/fixtures/bingo/synthetic.ts`**: override-spread factories `bingoCard`, `trailEntry`, `bingoContext`, `caught`, plus a `markedCard` helper. A hand-authored known catalog (plain / microtonal / album-member / bust-out / never-caught / jam-vehicle song) makes downstream expected marks known by construction. Consumed read-only by Plans 03 & 04.
- **`context.test.ts`**: 4 behaviors — microtonal membership, corpusGap + album-membership mirroring, cfg-driven (empty-safe) jam roster, and eraPlayCount carry with stable-key sorted emit.

### Task 2 — `detectWins` + `expectedFill` (`804610e`)
- **`wins.ts`**: `detectWins(marked)` runs pure row-major 4×4 geometry (4 rows, 4 cols, 2 diagonals as `line`; `corners` at 0,3,12,15; `x` when both diagonals complete; `blackout` at all 16). A square is marked iff `markedByPosition !== null`, so the pre-marked free center (FREE_SENTINEL) automatically satisfies any set through it — a diagonal through the free cell needs only its other 3 squares (D-06). Wins emit in a fixed deterministic order (rows → cols → diagonals → corners → x → blackout). `expectedFill(marked) = markedCount / 16`. Squares are resolved by their own `index` field, so array order is irrelevant.
- **`wins.test.ts`**: 9 cases — row line, column line, free-through-diagonal line, both-diagonals `x`, corners, blackout with deterministic-order assertions, free-cell-only no-win, partial no-win, and `expectedFill`.

## Verification

- `npx vitest run --project @guezzer/core bingo/context bingo/wins` → 13 passed.
- `npx tsc -p packages/core --noEmit` → exit 0.
- `grep -rn "TrackedEntry" packages/core/src/bingo/` → nothing (D-22 core purity).
- Full core suite: 359 passed (36 files) — no regressions.

## Deviations from Plan

None — plan executed as written. Two judgment calls resolved within the plan's own guidance:
- `detectWins` takes no `cfg` parameter (plan line 134 action rationale: the free cell's pre-marked state makes config reads unnecessary; the line-69 `cfg = config` signature was descriptive). The verifier's `freeIndex|FREE_SENTINEL|markedByPosition` key-link pattern is satisfied via `markedByPosition`/`FREE_SENTINEL`.
- `buildBingoContext` keeps the `archive` param for quartet parity but derives `corpusGap` from the resolved `RarityIndex` (not a re-scan); marked `void archive` to document the reservation.

## Threat Model Notes

- **T-14-03 (Tampering — non-deterministic Map iteration):** mitigated — every emitted Map/Set is ascending-key sorted; a dedicated test feeds unsorted matrix nodes and asserts sorted emit.
- **T-14-04 (DoS — empty roster):** mitigated — an empty `jamVehicleSongIds` roster (the shipped default) yields an empty Set, verified by test; no consumer crashes.

## Known Stubs

None. Both modules are fully implemented and test-pinned. (`cfg.bingo.jamVehicleSongIds` / `albumSquarePool` ship empty by design — the D-20 owner checkpoint populates them; `buildBingoContext` handles the empty state as a valid input, not a stub.)

## Self-Check: PASSED

- Files exist: context.ts, wins.ts, test/fixtures/bingo/synthetic.ts, context.test.ts, wins.test.ts — all FOUND.
- Commits exist: cdea04d (Task 1), 804610e (Task 2) — both FOUND.
