---
phase: 09-data-integrity-restore-ux
plan: 01
subsystem: core-ingest
tags: [data-integrity, normalization, shownotes, corpus-artifact]
requires:
  - "packages/core/src/ingest/normalize.ts (existing normalizer)"
  - "packages/core/src/ingest/api-types.ts (rawSetlistRowLocked.shownotes: z.string(), already shipped)"
provides:
  - "NormalizedShow.shownotes: string (verbatim show-level prose, corpus-resident)"
  - "NormalizeStats.showsWithShownotesDisagreement (D-01 within-show mismatch report)"
  - "data/normalized/corpus.json carrying shownotes on all 738 shows (schemaVersion 1)"
affects:
  - "any future show-level-prose feature — no full re-normalize needed (resolves audit WR-01)"
tech-stack:
  added: []
  patterns:
    - "Fail-loud vs carry-tolerant split: prose (shownotes, footnotes) records to stats and never throws; structural fields (settype) hard-fail"
    - "Position-1-wins denormalization: show-level fields read from sortedRows[0], not unsorted firstRow"
key-files:
  created: []
  modified:
    - "packages/core/src/domain/types.ts"
    - "packages/core/src/ingest/normalize.ts"
    - "packages/core/src/cli/normalize-corpus.ts"
    - "packages/core/test/normalize.test.ts"
    - "packages/core/test/dex/archive-artifact.test.ts"
    - "data/normalized/corpus.json"
    - "data/normalized/transition-matrix.json"
decisions:
  - "D-01: within-show shownotes disagreement records to NormalizeStats and never throws; position-1 row wins"
  - "D-02: byte-for-byte verbatim carry — no trim, no HTML strip, \\r\\n preserved, empty string stays \"\""
  - "D-04: schemaVersion stays literal 1 (additive field, zero consumer ripple)"
  - "D-05: shownotes lives in data/normalized/corpus.json; accepted growth"
  - "D-06: shownotes never reaches the bundled archive — archive.json byte-identical inside 250 KB budget"
metrics:
  duration: ~5 min
  completed: 2026-07-18
  tasks: 2
  commits: 3
  files-modified: 7
---

# Phase 09 Plan 01: Shownotes Verbatim Carry Summary

Carried `shownotes` byte-for-byte from each show's position-1 raw row onto `NormalizedShow` with a non-throwing D-01 disagreement stats counter, proved it end-to-end, and regenerated the corpus artifact while proving the bundled archive stayed byte-identical and the matrix diff was provenance-only.

## What Was Built

**Task 1 (TDD): shownotes carry through normalization.**
- Added `NormalizedShow.shownotes: string` (`domain/types.ts`) with an untrusted-verbatim doc comment mirroring the `Performance.footnote` convention (docs/SCHEMA.md §12). Type is `string` (never `string | null`) — raw schema is `z.string()`, and D-02 carries `""` as `""`.
- Added `NormalizeStats.showsWithShownotesDisagreement: Array<{ showId; showDate }>` (`ingest/normalize.ts`). Within-show disagreement is detected with the same `new Set(...).size > 1` idiom as the settype check, but pushes to stats and continues — it deliberately does NOT copy the settype `throw` (prose is non-structural; D-01/D-15 tolerant ethos).
- The carry reads `sortedRows[0].shownotes` (position-sorted first row, not unsorted `firstRow`), with zero transformation.
- Five new tests (`test/normalize.test.ts`): end-to-end raw→domain exact equality against the fixture's own position-1 value, position-1-wins with out-of-order input, disagreement-recorded-never-throws, agreement-not-recorded, and empty-string carry.

**Task 2: CLI report + corpus regeneration.**
- `formatNormalizeSummary` now appends the shownotes-disagreement count plus offending showIds (or "none"), mirroring the existing settype join-or-"none" idiom. Live corpus reports `0 (none)`.
- Regenerated `data/normalized/corpus.json` via `npm run refresh -- --normalize-only` (no network fetch): all 738 shows now carry `shownotes`; `schemaVersion` stays 1.
- Re-ran `build-model` and `build:archive`: `data/normalized/archive.json` and `dex-albums.json` are byte-identical (D-06 proof — shownotes never reaches the bundle); the only downstream change is `transition-matrix.json`'s `generatedAt` line, copied from `corpus.generatedAt` by build-model design.

## Verification Results

- `npx vitest run packages/core/test/normalize.test.ts` — 21 passed (5 new shownotes behaviors green).
- `npx vitest run --project @guezzer/core` — 290 passed (30 files), no consumer ripple.
- `npx tsc --noEmit -p packages/core/tsconfig.json` — exits 0.
- `git status --porcelain data/` — exactly two modified paths: `corpus.json`, `transition-matrix.json`; `archive.json`/`dex-albums.json` byte-identical.
- Matrix provenance-only diff: `git diff -U0 ... | grep ... | wc -l` → `0` (single `generatedAt` line pair only).
- `grep -c '"shownotes"' data/normalized/corpus.json` → 738; `schemaVersion` → `1`.
- `build:archive` reports 241.6 KB — under the 250 KB `MAX_ARCHIVE_BYTES` guard.
- `grep '\.shownotes' packages/app/src` → zero hits (T-09-01: value carried, never read/rendered by the app).

## TDD Gate Compliance

RED → GREEN sequence present in git log:
1. `226f719` `test(09-01)`: failing tests (RED — 5 failed against undefined field / missing stats).
2. `9ead7ae` `feat(09-01)`: implementation (GREEN — 21 passed, core typecheck clean).
No REFACTOR commit — the implementation followed existing idioms and needed no cleanup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated `archive-artifact.test.ts` makeShow helper for the new required field**
- **Found during:** Task 1 (core typecheck after adding the type field)
- **Issue:** `packages/core/test/dex/archive-artifact.test.ts`'s `makeShow` helper constructs a `NormalizedShow` object literal; adding the required `shownotes` field made it fail `tsc` (TS2741).
- **Fix:** Added `shownotes: ""` to the helper literal. It was the only other `NormalizedShow` construction site in the repo (verified via grep for `tourName:` — 3 files: normalize.ts, types.ts, this test).
- **Files modified:** `packages/core/test/dex/archive-artifact.test.ts`
- **Commit:** `9ead7ae` (folded into the GREEN commit as a direct type-change consequence)

## Threat Surface

No new threat surface. The plan's threat register (T-09-01 stored-untrusted-prose, T-09-02 archive budget, T-09-03 refresh DoS) is fully mitigated as designed: the field is carried verbatim and never rendered (grep-verified zero app reads), the archive stayed byte-identical inside its budget guard, and the disagreement path records to stats without throwing. No new packages installed (T-09-SC unchanged).

## Self-Check: PASSED

- Created files: none (all modifications).
- Modified files verified present: `packages/core/src/domain/types.ts`, `packages/core/src/ingest/normalize.ts`, `packages/core/src/cli/normalize-corpus.ts`, `packages/core/test/normalize.test.ts`, `packages/core/test/dex/archive-artifact.test.ts`, `data/normalized/corpus.json`, `data/normalized/transition-matrix.json` — all FOUND.
- Commits verified in git log: `226f719` (test), `9ead7ae` (feat), `59193f9` (feat) — all FOUND.
