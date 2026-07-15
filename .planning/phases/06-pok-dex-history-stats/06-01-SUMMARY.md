---
phase: 06-pok-dex-history-stats
plan: 01
subsystem: data
tags: [zod, build-time-artifact, derivation, cli, pokedex, albums, archive]

# Dependency graph
requires:
  - phase: 01-corpus-ingestion
    provides: data/normalized/corpus.json (738 shows), data/raw/albums.json, data/raw/songs.json
  - phase: 02-transition-matrix
    provides: data/normalized/transition-matrix.json (264-song catalog), config.ts pattern, cli/build-model.ts idiom
provides:
  - data/normalized/archive.json — compact offline show archive (DEX-02 retro-mark + STAT-01 gap/last-played substrate)
  - data/normalized/dex-albums.json — album-shelf mapping (D-04 studio cards + Covers/Miscellaneous buckets)
  - config.dex block — RARITY_QUANTILES, RARITY_MIN_PLAYS, artifact paths, archiveSearch, 29-entry cardAlbumUrls allowlist
  - deriveArchive / deriveDexAlbums pure derivations + archive-types.ts zod schemas
  - build:archive / build:albums npm scripts, chained into npm run refresh
affects: [06-03 deriveDex, 06-05 app loaders, 06-08 ArchiveBrowser, 06-09 RecapView/SetlistView]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build-time artifact CLI mirroring cli/build-model.ts (exported run fn, isMain guard, deterministic, schema-validated before write)"
    - "Config-resident album-mapping allowlist keyed by album_url (never title) — no allowlist in derivation code"
    - "Hybrid JSON serializer: 2-space structure with inline numeric arrays to meet a byte budget while keeping git-diff readability"

key-files:
  created:
    - packages/core/src/dex/archive-types.ts
    - packages/core/src/dex/albums.ts
    - packages/core/src/dex/archive.ts
    - packages/core/src/cli/build-albums.ts
    - packages/core/src/cli/build-archive.ts
    - packages/core/test/dex/archive-artifact.test.ts
    - packages/core/test/dex/albums.test.ts
    - data/normalized/archive.json
    - data/normalized/dex-albums.json
  modified:
    - packages/core/src/config.ts
    - packages/core/src/index.ts
    - packages/core/src/cli/refresh.ts
    - package.json

key-decisions:
  - "Album card membership is a config allowlist of 29 studio album_urls; D-04's islive=0 + earliest-date operates WITHIN it (defeats Pitfalls 1-2)"
  - "Slug ownership = earliest-dated card album per slug (over all slugs incl. debut candidates) guarantees the full-coverage invariant even for compilation overlaps like Teenage Gizzard"
  - "Archive uses a hybrid serializer (inline song-id arrays) to fit 241.6 KB under the 250 KB A6 budget while staying diff-readable — plain 2-space was 364.9 KB"

patterns-established:
  - "Pure dex derivation validates its output through the strict zod artifact schema before returning (T-06-02)"
  - "Build CLIs are deterministic: no wall-clock input, stable sorts, byte-identical on rebuild"

requirements-completed: [DEX-02, DEX-04, STAT-04]

# Metrics
duration: 17min
completed: 2026-07-15
---

# Phase 6 Plan 01: Dex Data Foundation Summary

**Two committed build-time artifacts (compact 241.6 KB show archive + album-shelf mapping of 29 studio cards / 24 covers / 14 misc, all 264 catalog songs mapped exactly once) plus the config.dex tunable block, derived by two deterministic pure-core CLIs chained into `npm run refresh`.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-15T00:28:52Z
- **Completed:** 2026-07-15T00:46:08Z
- **Tasks:** 3
- **Files modified:** 13 (9 created, 4 modified)

## Accomplishments
- `data/normalized/dex-albums.json` (D-04): 29 studio-discography card albums keyed by `album_url`, plus Covers (24) and Miscellaneous (14) buckets. Every one of the 264 matrix catalog songs appears exactly once across cards + buckets; 53 debut candidates (album tracks with no matrix node — STAT-04) exist by construction.
- `data/normalized/archive.json` (DEX-02): 738 shows newest-first, each with stable `show_id`, date, venue/city/state/country, and set-structured songId lists; a songId→name map; `latestShowDate` = 2025-12-13 online-fallback boundary. 241.6 KB, under the 250 KB A6 bundle budget.
- `config.dex` block: RARITY_QUANTILES / RARITY_MIN_PLAYS (D-15), artifact paths, archiveSearch tunables, and the 29-entry `cardAlbumUrls` allowlist — all Phase-6 core tunables in the single config file.
- Two pure derivations (`deriveArchive`, `deriveDexAlbums`), two CLIs (`runBuildArchive`, `runBuildAlbums`), strict zod artifact schemas, and both builds chained into the `npm run refresh` pipeline. Both artifacts rebuild byte-identical (zero git diff).

## Task Commits

Each task was committed atomically (Task 1 as TDD test → feat):

1. **Task 1 (RED): failing tests for config.dex + artifact schemas** - `cd6cd8d` (test)
2. **Task 1 (GREEN): config.dex block + archive/albums artifact zod schemas** - `ba04529` (feat)
3. **Task 2: album mapping derivation + build-albums CLI + dex-albums.json** - `b1e82db` (feat)
4. **Task 3: archive derivation + build-archive CLI + archive.json** - `4b8b3e8` (feat)

## Files Created/Modified
- `packages/core/src/dex/archive-types.ts` - Strict zod schemas + inferred types for both artifacts (strictObject trust boundary; set-vocabulary enum pinned to "1"|"2"|"e")
- `packages/core/src/dex/albums.ts` - `deriveDexAlbums` pure D-04 mapping (allowlist cards, slug join, earliest-card ownership, buckets, debut candidates)
- `packages/core/src/dex/archive.ts` - `deriveArchive` pure corpus→compact archive transform (newest-first, set structure, sentinel exclusion)
- `packages/core/src/cli/build-albums.ts` - CLI mirroring build-model; summary reports cards/buckets/coverage/debut counts
- `packages/core/src/cli/build-archive.ts` - CLI with hybrid serializer + 250 KB fail-loud guard + round-trip safety assertion
- `packages/core/test/dex/archive-artifact.test.ts` - config.dex + schema + deriveArchive fixtures + committed-artifact tests (16)
- `packages/core/test/dex/albums.test.ts` - synthetic mapping fixtures + real-data drift-guard + full-coverage tests (13)
- `data/normalized/archive.json`, `data/normalized/dex-albums.json` - committed artifacts
- `packages/core/src/config.ts` - `dex` sub-object (tunables + allowlist)
- `packages/core/src/index.ts` - barrel-exports the Phase-6 dex schemas/types
- `packages/core/src/cli/refresh.ts` - `runDexArtifactBuilds` chained into normalize-only and routine refresh paths
- `package.json` - `build:archive` and `build:albums` scripts

## Decisions Made
- **Card allowlist verified against real data:** all 29 `cardAlbumUrls` confirmed present in albums.json; `/albums/fishing-for-fishies` pinned (not the `-video` duplicate, Open Question 4).
- **Slug ownership resolves compilation overlap:** a slug on multiple card albums (e.g. Teenage Gizzard re-collecting K.G./L.W. tracks) is attributed to its earliest-dated card only, so the full-coverage invariant holds. Ownership is computed over all slugs (matrix songs + debut candidates), keeping tracklists dedup-clean.
- **Archive serializer format** (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Archive serialized with a hybrid format instead of plain 2-space JSON**
- **Found during:** Task 3 (build-archive CLI)
- **Issue:** The plan specified "stable 2-space JSON + trailing newline" (the build-model idiom) AND "under 250 KB". Full 2-space pretty-print of the archive is 364.9 KB (one line per song id across ~15k performances) — the 250 KB A6 budget guard tripped, blocking the write.
- **Fix:** Added a `serializeArchive` helper that keeps 2-space-indented structure (each show a readable block) but collapses the pure-integer `songs` arrays onto one line. Result is 241.6 KB, deterministic, and still git-diff readable. A round-trip assertion (`JSON.parse` deep-equals the artifact) guards against any regex-collapse corruption.
- **Files modified:** packages/core/src/cli/build-archive.ts
- **Verification:** Rebuild is byte-identical (zero git diff); committed artifact parses through `archiveArtifact`; size test asserts ≤ 250 KB.
- **Committed in:** `4b8b3e8` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The format choice was forced by the hard budget guard the plan itself mandates; all artifact-shape and determinism contracts are preserved. No scope creep.

## Issues Encountered
- **Unmatched (bucket) count is 38, not the plan's "~31" hint.** RESEARCH's ~31 counted slug-joins to *any* artist_id=1 album (233 joined). Under the D-04 allowlist, songs living only on non-studio releases (singles, Chunky Shrapnel, Satanic Slumber Party, Demos volumes, etc.) correctly route to Miscellaneous, so 226 card + 24 covers + 14 misc = 264. The full-coverage invariant (each matrix song exactly once) holds; 38 is the correct allowlist-scoped number, and the CLI summary prints the real counts rather than asserting a fixed value.
- **Archive size margin is thin (241.6 KB of 250 KB).** As summer-2026 shows are added via `npm run refresh`, the fail-loud budget guard will eventually trip — that is the intended A6 tripwire; the CLAUDE.md-documented `?url` + runtime-fetch + workbox `json`-glob variant is the escape hatch when it does.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The dex data substrate is complete and regenerable by one command (`npm run refresh` or `npm run build:archive`/`build:albums`).
- Plan 06-03 (`deriveDex`), 06-05 (app artifact loaders), 06-08 (ArchiveBrowser), and 06-09 (recap/setlist views) can now consume the committed artifacts and shared inferred types.
- No blockers.

## Self-Check: PASSED

All 9 claimed created files exist on disk; all 4 task commits (`cd6cd8d`, `ba04529`, `b1e82db`, `4b8b3e8`) exist in git history. Full core suite green (195 tests); full repo suite green (315 tests); `tsc --noEmit` clean; both artifacts rebuild byte-identical.

---
*Phase: 06-pok-dex-history-stats*
*Completed: 2026-07-15*
