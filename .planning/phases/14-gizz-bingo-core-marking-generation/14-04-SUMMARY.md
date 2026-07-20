---
phase: 14-gizz-bingo-core-marking-generation
plan: 04
subsystem: bingo-core
tags: [bingo, generator, prng, determinism, core-purity]
requires:
  - "bingo/prng.ts (xmur3 + mulberry32) — Plan 14-01"
  - "bingo/types.ts (BingoCard, BingoSquareDef, bingoCardSchema, BingoVibe/BingoEvent) — Plan 14-01"
  - "bingo/context.ts (BingoContext resolved lookups) — Plan 14-02"
  - "test/fixtures/bingo/synthetic.ts (bingoContext/caught fixtures) — Plan 14-02"
provides:
  - "deal(seed, vibe, ctx, dexSnapshot, corpusVersion, cfg) -> BingoCard — pure seeded card generator"
affects:
  - "Plan 14-05 (calibration gate deals N seeded cards per vibe and replays them)"
  - "Phase 15 (persistence locks the frozen resolved defs deal emits)"
tech-stack:
  added: []
  patterns:
    - "config-allowlist -> Set selection (dex/albums.ts idiom)"
    - "zod-validate-before-return (bingoCardSchema.parse) at the generation trust boundary"
    - "string-seeded PRNG stream — no wall clock / global entropy in core"
key-files:
  created:
    - "packages/core/src/bingo/generate.ts"
    - "packages/core/test/bingo/generate.test.ts"
  modified: []
decisions:
  - "Until Plan 06 fills real cfg.bingo.vibes[vibe].mix weights, deal uses a safe DEFAULT_MIX so cards still deal with sane variety"
  - "Event kinds (opener/microtonal/marathonJam/bustOut/neverCaught) are board singletons — a card never carries two of the same event square"
  - "Completeness is guaranteed by a song-square top-up (cycled if the catalog is tiny), falling back to the always-resolvable opener event square when every roster incl. eraPlayRate is empty"
  - "Song/album/event labels are frozen at deal time; song labels are songId-derived placeholders (no name source in the phase contract)"
metrics:
  duration: ~14min
  tasks: 2
  files: 2
  completed: 2026-07-20
requirements: [BINGO-03]
---

# Phase 14 Plan 04: Seeded Bingo Card Generator Summary

`deal(seed, vibe, ctx, dexSnapshot, corpusVersion, cfg) -> BingoCard` — a pure, string-seeded, schema-validated generator that always produces a complete 16-square v1-catalog card (segue excluded), byte-identical for identical inputs.

## What Was Built

- **`packages/core/src/bingo/generate.ts`** — the `deal` generator. All randomness is drawn from `mulberry32(xmur3(`${seed} ${vibe} ${corpusVersion}`)())`; the module touches no wall clock and no global entropy source (T-14-08). It selects squares from the v1 auto-mark catalog (song / album / opener / microtonal / marathonJam / bustOut / neverCaught) weighted by the per-vibe mix, resolves them into self-contained frozen defs, places `{kind:"free"}` at `cfg.bingo.freeIndex` (D-06), deterministically Fisher–Yates-shuffles the 15 fillable squares into the non-free board positions, and returns `bingoCardSchema.parse(card)` so any shape drift fails loudly at generation (T-14-09).
- **`packages/core/test/bingo/generate.test.ts`** — 7 tests across three behavior groups: same-seed reproducibility (deep-equal) + divergence on a changed seed/vibe; never-blank completeness (16 squares, one free at `freeIndex`, no holes, schema-valid) across all vibes × several seeds, plus empty-roster and bone-dry (empty `eraPlayRate`) resilience; and v1-catalog coverage asserting no `"segue"` event is ever produced.

## How It Works

- **Determinism (D-21):** the seed string `${seed} ${vibe} ${corpusVersion}` scopes the PRNG, so a reshuffle is a new seed and a corpus refresh (new `corpusVersion`) re-scopes the deal. Both the weighted square selection and the board placement consume only `rand()` draws.
- **Never-blank guarantee:** weighted selection without replacement runs until 15 squares are chosen or all pools drain; any shortfall is topped up by cycling the song catalog, with the opener event square as the final always-resolvable fallback. The `bingoCardSchema.parse` call is a second line of defense — a hole or wrong length throws.
- **Segue exclusion (D-24):** `"segue"` is not in the `BingoEvent` union and is never constructed; only the five catalog events are emitted.
- **Frozen defs (T-14-10):** every square carries its resolved identity + label at deal time (song → `songId`+label, album → `albumUrl`+label, event → `event`+label), so Phase 15 can persist a locked card with no read-time seed regeneration.

## Deviations from Plan

None — plan executed as written. The two `tdd="true"` tasks were executed in the plan's stated order (generator first, then its pinning test); Task 1 was gated on `tsc` + the purity grep (the `bingo/generate` vitest run has no test file until Task 2), and the full `bingo/generate` suite ran green after Task 2.

## Known Stubs

| Item | File | Reason |
|------|------|--------|
| Song-square `label` is a songId-derived placeholder (`Song ${songId}`) | `packages/core/src/bingo/generate.ts` | The phase contract (`deal` signature + `BingoContext`) provides no song-name source. `songId` is the stable frozen identity; the display name is a rendering concern deferred to Phase 16 (build/live-marking), which can resolve names from the catalog at render without reshuffling the locked card. The `neverCaught` label likewise emits a songId hint. This does not block the plan goal (a deterministic, complete, schema-valid card). |
| `cfg.bingo.vibes[vibe].mix` is empty → `DEFAULT_MIX` used | `packages/core/src/config.ts` (unchanged) / `generate.ts` | Real per-vibe weights are filled by the Plan 06 Monte-Carlo calibration gate (interface-first, D-16). The default only ensures cards deal with sane variety until then. |

## Verification

- `npx vitest run --project @guezzer/core bingo/generate` → 7 passed.
- Full bingo suite `npx vitest run --project @guezzer/core bingo` → 26 passed (no regressions).
- `grep -n "Math.random\|Date.now" packages/core/src/bingo/generate.ts` → returns nothing.
- `npx tsc -p packages/core --noEmit` → exits 0.

## Commits

- `dc27e0d` feat(14-04): deal — pure seeded bingo card generator (generate.ts)
- `987b80d` test(14-04): generate.test.ts — reproducibility + never-blank + catalog

## Self-Check: PASSED

- FOUND: packages/core/src/bingo/generate.ts
- FOUND: packages/core/test/bingo/generate.test.ts
- FOUND commit: dc27e0d
- FOUND commit: 987b80d
