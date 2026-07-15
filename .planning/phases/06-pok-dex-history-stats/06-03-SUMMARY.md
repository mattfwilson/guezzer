---
phase: 06-pok-dex-history-stats
plan: 03
subsystem: core-derivation
tags: [pokedex, derivation, rarity, recap, stats, pure-core, tdd]

# Dependency graph
requires:
  - phase: 06-pok-dex-history-stats
    plan: 01
    provides: archive.json + dex-albums.json artifacts, archive-types.ts zod schemas, config.dex (RARITY_QUANTILES / RARITY_MIN_PLAYS)
  - phase: 02-transition-matrix
    provides: model/matrix.ts pure-module idiom, config.ts pattern
  - phase: 05-live-sync-data-safety
    provides: data-safety/merge.ts attendanceGroupKey idiom, serialize.ts ExportSnapshot shape
provides:
  - buildRarityIndex / showRarityScore — corpus-honest rarity (tier, corpus gap, play count, last-played) — the app's ONLY source of these
  - deriveDex — single derivation entry point (completion %, per-song sightings, personalGap, rarestCatch, neverSeen, per-album tallies)
  - deriveRecap — night scorecard (tally, source split, new catches, rarity, set-structured setlist)
  - DexSnapshotInput — structural subset of ExportSnapshot v2, friend-file-safe (plan 06-10)
  - shared synthetic dex fixture factories (test/fixtures/dex/synthetic.ts)
affects: [06-05 useDexStats hook, 06-09 RecapView, 06-10 CompareView]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure dex derivation mirroring model/matrix.ts (one top-level fn, Map-keyed accumulation, explicit sorts, cfg = config injected default, zero I/O)"
    - "Attendance dedupe via merge.ts attendanceGroupKey rule (bound → id:{showId}, unbound → date:{date}), sightings unioned within a group"
    - "New-catch detection by running deriveDex on a session-excluded snapshot copy — pure set difference, no stored before-state"
    - "TDD RED→GREEN per task: failing test committed, then implementation"

key-files:
  created:
    - packages/core/src/dex/rarity.ts
    - packages/core/src/dex/derive-dex.ts
    - packages/core/src/dex/recap.ts
    - packages/core/test/dex/rarity.test.ts
    - packages/core/test/dex/derive-dex.test.ts
    - packages/core/test/dex/recap.test.ts
    - packages/core/test/fixtures/dex/synthetic.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "DexSnapshotInput carries richer trackedEntries than the Task-2 minimum (adds songName + source) so deriveRecap reads the same input shape; still a structural subset of ExportSnapshot (assignable, enum fields widened to string)"
  - "Rarity tier by rank-vs-quantile cut: tier assigned if rank < quantile * M over songs sorted by play rate ascending — hand-computable and deterministic (songId tie-break)"
  - "personalGap / corpusGap both computed as (N - 1 - lastIndex) over the relevant date-ordered timeline — your shows since last sighting / archive shows since last play"
  - "per-album tallies count inMatrix tracks only; debut candidates (inMatrix:false / null songId) are uncounted and tier-free (STAT-04), and buckets (covers/miscellaneous) are keyed alongside card albumUrls"

requirements-completed: [DEX-03, DEX-04, STAT-01, STAT-02, STAT-03, STAT-04, SHOW-14]

# Metrics
duration: 11min
completed: 2026-07-15
---

# Phase 6 Plan 03: Dex Stats Engine Summary

**The pure-core stats engine the whole phase renders: corpus-honest rarity tiers/gap/play-count (`buildRarityIndex`), the single `deriveDex` derivation entry point (every count derived from raw attendance — unmark is free, friend files get full stats, nothing stored), and `deriveRecap` (the night's tally / source split / new catches / rarity / set-structured setlist). 24 new fixture-pinned tests, all TDD RED→GREEN.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-07-15T01:12:38Z
- **Completed:** 2026-07-15T01:23:39Z
- **Tasks:** 3 (each TDD: failing test → implementation)
- **Files:** 8 (7 created, 1 modified)

## Accomplishments

- **`rarity.ts` (D-15/STAT-01/STAT-02):** `buildRarityIndex` derives per-song `{ playCount, lastPlayedDate, corpusGap, tier }` purely from the archive. Tiers cut corpus play-rate quantiles with the `RARITY_MIN_PLAYS` cap (a tiny-sample song can never be Legendary — Pitfall 12). This module is the app's only source of corpus gap / play count / last-played. `showRarityScore` = the average corpus gap of a night's songs.
- **`derive-dex.ts` (DEX-03/04, STAT-03/04):** `deriveDex(snapshot, archive, albums, rarity, cfg)` — the ONE derivation. Attendance = tracked ∪ retro, deduped by `show_id` (bound) or `date` (unbound); sightings = archive/cache setlist ∪ tracked non-placeholder entries; completion / neverSeen / rarestCatch over the sentinel-excluded matrix catalog; `personalGap` from the deduped date-ordered timeline; per-album inMatrix-only tallies. Empty snapshot → zero counts, full neverSeen, no NaN. Post-corpus marks resolve from the `archiveShows` cache (Pitfall 5).
- **`recap.ts` (SHOW-14/STAT-02/D-14):** `deriveRecap` mirrors `deriveTally` exactly (every entry counts; hits = outcome "hit"), decomposes the manual-vs-editor source split, detects first-ever catches by diffing a session-excluded `deriveDex` run, scores the night's rarity + rarest-of-night, and emits the set-structured setlist ("1","2","e") in position order with placeholders kept-but-flagged and excluded from math.
- **Shared fixtures** (`test/fixtures/dex/synthetic.ts`): override-spread factories `archiveShow / syntheticArchive / albumTrack / syntheticAlbums / trackedShow / trackedEntry / attendedShow / dexSnapshot`, plus structural input types matching `DexSnapshotInput`.

## Task Commits

Each task was committed atomically as TDD RED (test) → GREEN (feat):

1. **Task 1 RED:** fixtures + failing rarity tests — `95c7da0` (test)
2. **Task 1 GREEN:** rarity index + show rarity score — `7e3cfe1` (feat)
3. **Task 2 RED:** failing deriveDex tests (10 cases) — `56e3607` (test)
4. **Task 2 GREEN:** deriveDex derivation entry point — `00e05b1` (feat)
5. **Task 3 RED:** failing deriveRecap tests — `c400484` (test)
6. **Task 3 GREEN:** deriveRecap night scorecard — `d6b451d` (feat)

## Files Created/Modified

- `packages/core/src/dex/rarity.ts` — `RarityTier`/`SongRarity`/`RarityIndex`, `buildRarityIndex`, `showRarityScore`
- `packages/core/src/dex/derive-dex.ts` — `DexSnapshotInput`/`SongDexStats`/`DexStats`, `deriveDex`
- `packages/core/src/dex/recap.ts` — `RecapStats`/`RecapSet`/`RecapSetlistRow`, `deriveRecap`
- `packages/core/test/dex/rarity.test.ts` — 7 tests (tier table, min-plays cap, gap arithmetic, sentinel exclusion, score averaging, determinism)
- `packages/core/test/dex/derive-dex.test.ts` — 10 tests (retro full-setlist, tracked-only, both-source dedupe, unbound-date dedupe, personalGap, empty, sentinel, debut exclusion, rarestCatch, cache fallback)
- `packages/core/test/dex/recap.test.ts` — 7 tests (tally, source split, new catches, rarity, setlist grouping, empty-newCatches, deriveTally parity)
- `packages/core/test/fixtures/dex/synthetic.ts` — shared synthetic dex fixtures
- `packages/core/src/index.ts` — barrel-exports the three modules' fns + types

## Decisions Made

- **DexSnapshotInput is a structural subset of ExportSnapshot** with enum fields widened to `string`; a narrower ExportSnapshot value is assignable to it, keeping the friend-file compare path (06-10) type-safe. It carries `songName` + `source` beyond the plan's Task-2 minimum so `deriveRecap` consumes the identical input shape.
- **Rank-vs-quantile tier assignment** (`rank < quantile * M`) over play-rate-ascending sort with a songId tie-break — deterministic and hand-computable, which is what makes the tier table fixture-pinnable.
- **New-catch detection is a pure set difference** — `deriveDex` on a snapshot copy with this session's trackedShow/trackedEntries removed; a night song absent from the reduced `perSong` is a first-ever catch. No stored "before" counts.

## Deviations from Plan

None — plan executed exactly as written. All three modules, fixture factories, barrel exports, and acceptance criteria delivered as specified; TDD RED→GREEN gates observed per task.

## Issues Encountered

- Root `npx tsc --noEmit` prints CLI help (no root tsconfig); the project typechecks per-package via `packages/core/tsconfig.json` and `packages/app/tsconfig.json`. Both are clean.

## User Setup Required

None — pure-core additions, no external service or dependency changes.

## Next Phase Readiness

- The stats engine is complete and fixture-pinned. Plan 06-05 (`useDexStats` hook) can `useMemo`-derive `deriveDex` off the reactive Dexie tables; plan 06-09 (`RecapView`) renders `RecapStats`; plan 06-10 (`CompareView`) runs `deriveDex` twice (yours + friend's parsed envelope).
- No blockers.

## TDD Gate Compliance

Every task followed RED (a committed failing `test(...)` commit) → GREEN (a `feat(...)` commit) → no refactor needed. All six gate commits are present in git history.

## Verification

- `npx vitest run --project @guezzer/core` — 219 tests green (22 files).
- `npx vitest run` (full repo) — 351 tests green (46 files).
- `npx tsc --noEmit -p packages/core/tsconfig.json` and `-p packages/app/tsconfig.json` — both clean (DexSnapshotInput stays structurally assignable from ExportSnapshot).
- `derive-dex.ts` imports only `config`, `archive-types`, `rarity` — nothing from `packages/app`, no fetch/readFile.

## Self-Check: PASSED

All 7 claimed created files exist on disk; all 6 task commits (`95c7da0`, `7e3cfe1`, `56e3607`, `00e05b1`, `c400484`, `d6b451d`) exist in git history. Full core suite green (219); full repo suite green (351); both package typechecks clean.

---
*Phase: 06-pok-dex-history-stats*
*Completed: 2026-07-15*
