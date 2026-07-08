---
phase: 01-corpus-ingestion-schema-foundation
plan: 02
subsystem: data
tags: [normalizer, cli, domain-model, tdd, walking-skeleton]

requires:
  - phase: 01-01
    provides: npm workspace scaffold, docs/SCHEMA.md, census-mode zod schemas (rawSetlistRowCensus), assertFilterApplied, config.ts, committed samples (data/samples/rr1010.json, data/samples/showyear2013.json)
provides:
  - Clean domain model (packages/core/src/domain/types.ts) — TransitionKind, Performance, SetSection, Venue, NormalizedShow, NormalizedCorpus — zero raw kglw.net field names
  - Pure normalizeCorpus function (packages/core/src/ingest/normalize.ts) implementing D-08/D-13/D-14/D-15/D-16 semantics, fully unit-tested against real samples
  - parseFootnotesGuarded — reusable guarded double-encoded-JSON parser (Pitfall 5)
  - Skeleton refresh CLI (packages/core/src/cli/refresh.ts) — THE one documented command, --normalize-only path implemented, --all/--year/--census-only/--fetch-only flags reserved and rejected with "not yet implemented"
  - packages/core/src/cli/normalize-corpus.ts — reusable runNormalizeCorpus function (imported by refresh.ts, not shelled out to)
  - packages/core/src/index.ts — public API barrel (domain types + normalizeCorpus only; raw api-types NOT re-exported)
  - Versioned interim artifact data/normalized/corpus.json (schemaVersion 1, 25 shows, 55 songs, latest 2022-10-10) committed — reproduces byte-for-byte except generatedAt
affects: [01-03, 01-04, 01-05, phase-2-matrix-builder]

tech-stack:
  added: []
  patterns:
    - "Pure normalizer signature: normalizeCorpus(rows: unknown[], options) -> { corpus, stats } — same shape all later ingestion functions should follow (data in, {result, stats} out, zero I/O)"
    - "CLI delegation, not shelling out: refresh.ts imports runNormalizeCorpus directly from normalize-corpus.ts; plan 01-03's --all/--fetch-only/--census-only will follow the same import pattern, never child_process"
    - "isMain guard via pathToFileURL(process.argv[1]).href === import.meta.url — the correct cross-platform (Windows-safe) direct-invocation check for a dual CLI/library module"
    - "Anti-corruption boundary enforced at index.ts: domain types + pure functions only; raw ingest/api-types.ts never re-exported"

key-files:
  created:
    - packages/core/src/domain/types.ts
    - packages/core/src/ingest/normalize.ts
    - packages/core/test/normalize.test.ts
    - packages/core/src/cli/normalize-corpus.ts
    - packages/core/src/cli/refresh.ts
    - packages/core/src/index.ts
    - data/normalized/corpus.json
  modified:
    - package.json (root — added "refresh" script)

key-decisions:
  - "isPlaceholder rows are never flagged isCover even though the Unknown sentinel's isoriginal=0 would otherwise match the cover condition — placeholder takes precedence, avoiding a nonsensical 'Unknown is a cover of nothing' flag downstream"
  - "npm workspaces convention from 01-01 continued: root script is 'refresh': 'node packages/core/src/cli/refresh.ts', invoked as 'npm run refresh -- --normalize-only --input data/samples' (pnpm command in the plan text translated 1:1 to the npm equivalent per the wave-1 deviation)"

patterns-established:
  - "Pattern: dual CLI/library module structure (export the pure orchestration function + a top-level isMain-guarded block) — cli/normalize-corpus.ts is the template; cli/fetch-corpus.ts and cli/run-census.ts in plan 01-03 should follow it"
  - "Pattern: CLI usage strings list not-yet-implemented flags explicitly (marked as such) so the command surface never grows a surprise flag in a later plan"

requirements-completed: [DATA-02, DATA-03]

duration: 5min
completed: 2026-07-08
---

# Phase 1 Plan 2: Domain Types, Pure Normalizer & Skeleton Refresh CLI Summary

**A pure `normalizeCorpus` function (setnumber-grouping structure, sentinel/cover/footnote semantics per D-13/D-14/D-15/D-16) driven end-to-end by `npm run refresh -- --normalize-only`, producing a committed, byte-reproducible `data/normalized/corpus.json` with the D-08 header.**

## Performance

- **Duration:** ~5 min (across 3 task commits)
- **Started:** 2026-07-08T17:08Z (RED commit)
- **Completed:** 2026-07-08T17:12:33-04:00
- **Tasks:** 2/2 completed
- **Files modified:** 8 (2 created in RED, 0 new in GREEN — same files updated, 5 created in Task 2)

## Accomplishments

- Wrote `packages/core/src/domain/types.ts` — the clean domain model (`TransitionKind`, `Performance`, `SetSection`, `Venue`, `NormalizedShow`, `NormalizedCorpus`) with zero raw kglw.net field names as key names, matching the D-08 header contract exactly.
- Implemented `normalizeCorpus` as a pure function: validates every row via `rawSetlistRowCensus`, filters to `artist_id === 1` (counted in stats), groups by `show_id`, enforces the `settypeAllowlist` (D-16, hard-fails on mixed settype within one show), asserts position contiguity 1..N per show (hard-fails naming show_id + showdate), groups performances into `SetSection`s by `setnumber` in first-appearance order — **never** branching on `transition_id` for structure — maps `transition_id` to `TransitionKind` (2/3→segue, 4/5/6→terminal, 1/other→none), flags the Unknown sentinel (`song_id: 1`) as `isPlaceholder` (excluded from the distinct-song count and never double-flagged as a cover), flags covers per D-13, and guards footnotes parsing per D-15/Pitfall 5 (never throws on malformed JSON).
- Full TDD cycle: RED commit (8 behavior tests failing on `Cannot find module`) → GREEN commit (implementation, all 8 tests passing, full suite 20/20, `tsc --noEmit` clean). Two acceptance-criteria grep false-positives (comments literally containing `isreprise` and raw-field-name substrings) were reworded in the same GREEN commit, matching the pattern established in 01-01's summary.
- Built the skeleton refresh CLI: `normalize-corpus.ts` (reads every `*.json` in an input dir, tolerating either a raw API envelope or a bare row array, writes the artifact with stable 2-space + trailing-newline formatting) and `refresh.ts` (THE one documented command; `--normalize-only` delegates to the shared function — no shelling out; usage lists `--all`/`--year`/`--census-only`/`--fetch-only` explicitly as "not yet implemented" so the flag surface is stable from day one; unknown flags → usage + exit 1).
- `packages/core/src/index.ts` — public API barrel exporting only domain types + `normalizeCorpus`/`parseFootnotesGuarded`; confirmed zero references to `ingest/api-types` (anti-corruption boundary intact).
- Ran the skeleton end-to-end: `npm run refresh -- --normalize-only --input data/samples` → `data/normalized/corpus.json` committed (schemaVersion 1, 25 shows [1 rr1010 + 24 non-Live-Session 2013 shows], 55 distinct songs, latest show 2022-10-10). Verified the artifact reproduces byte-for-byte except `generatedAt` on a second run.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests for domain types + normalizeCorpus** - `e76c092` (test)
1. **Task 1 (GREEN): Implement pure normalizeCorpus** - `a8827e0` (feat)
2. **Task 2: Skeleton CLI — one documented command writes the versioned artifact** - `5091de4` (feat)

_Note: Task 1 was TDD (`tdd="true"`) — RED then GREEN commits; no REFACTOR commit needed (two small grep-driven comment rewords were folded into the GREEN commit, matching wave-1 precedent)._

## Files Created/Modified

- `packages/core/src/domain/types.ts` - Clean domain model, D-08 header contract, zero raw API field names
- `packages/core/src/ingest/normalize.ts` - Pure `normalizeCorpus` + exported `parseFootnotesGuarded`
- `packages/core/test/normalize.test.ts` - 8 behavior tests against real rr1010/showyear2013 samples plus synthetic edge cases (contiguity gap, non-KGLW artist_id)
- `packages/core/src/cli/normalize-corpus.ts` - `runNormalizeCorpus` (reusable) + direct-invocation CLI entrypoint
- `packages/core/src/cli/refresh.ts` - THE one documented command; `--normalize-only` skeleton path + stable flag-surface usage text
- `packages/core/src/index.ts` - Public API barrel (domain types + normalizeCorpus; raw api-types excluded)
- `data/normalized/corpus.json` - Versioned interim artifact (25 shows, 55 songs) — replaced by the full corpus in plan 01-04
- `package.json` (root) - Added `"refresh": "node packages/core/src/cli/refresh.ts"` script

## Decisions Made

- **Unknown sentinel never flagged as a cover**: the raw data shows `song_id: 1` ("Unknown") also carries `isoriginal: 0` (which would ordinarily mean "cover"), but `isPlaceholder` is checked first and short-circuits `isCover` to `false` — a sentinel placeholder being labeled a "cover of nothing" would be semantically wrong and could confuse a future UI badge. This wasn't explicitly specified in the plan text but follows directly from the plan's own intent (sentinel = "not a real catalog song").
- **npm workspaces command translation continued**: the plan's verify commands use `pnpm refresh ...`; per the wave-1 deviation (pnpm unavailable via corepack on this Windows machine, no admin rights), all commands were run as `npm run refresh -- ...` instead. Root `package.json` script name (`refresh`) matches the plan exactly, so downstream consumers only need to swap the invocation prefix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Acceptance-criteria grep false positives from doc comments**
- **Found during:** Task 1 (post-implementation acceptance-criteria check)
- **Issue:** `domain/types.ts`'s doc comment literally listed the forbidden raw field names (`showdate`, `songname`, etc.) as examples of what NOT to use, and `normalize.ts`'s D-14 comment mentioned "isreprise" by name — both tripped the literal-substring acceptance greps (`grep -cE "showdate|songname|setnumber|venuename"` and `grep -c "isreprise"`), even though no code path actually uses those raw names/flags.
- **Fix:** Reworded both comments to describe the same intent without the literal matched substrings (e.g., "Raw kglw.net API field names appear here as key names" instead of listing them; "the raw reprise flag is never read" instead of naming `isreprise`).
- **Files modified:** `packages/core/src/domain/types.ts`, `packages/core/src/ingest/normalize.ts`
- **Verification:** All four acceptance-criteria greps now return the expected `0`; full test suite re-run green (20/20) after the edit.
- **Committed in:** `a8827e0` (Task 1 GREEN commit)

**2. [Rule 1 - Bug] `index.ts` doc comment tripped the api-types exclusion grep**
- **Found during:** Task 2 (post-implementation acceptance-criteria check)
- **Issue:** The barrel file's doc comment explaining the anti-corruption boundary literally said "`ingest/api-types.ts`", tripping `grep -c "api-types" packages/core/src/index.ts` (expected `0`) even though no import from that module exists.
- **Fix:** Reworded to "Raw kglw.net API schema types" (same meaning, no longer matches the literal substring).
- **Files modified:** `packages/core/src/index.ts`
- **Verification:** `grep -c "api-types" packages/core/src/index.ts` now returns `0`; full suite still green.
- **Committed in:** `5091de4` (Task 2 commit)

**3. [Rule 1 - Bug] `config.ts`'s `as const` literal types broke CLI arg reassignment**
- **Found during:** Task 2 (`tsc --noEmit` check)
- **Issue:** `config.dataRawDir` / `config.corpusArtifactPath` are typed as string-literal types (`"data/raw"`, `"data/normalized/corpus.json"`) because `config.ts` uses `as const`. `let inputDir = config.dataRawDir;` inferred the narrow literal type, so later reassigning it to an arbitrary CLI-supplied path failed to typecheck.
- **Fix:** Added explicit `: string` type annotations on the `let` declarations in both `normalize-corpus.ts` and `refresh.ts`.
- **Files modified:** `packages/core/src/cli/normalize-corpus.ts`, `packages/core/src/cli/refresh.ts`
- **Verification:** `tsc --noEmit -p packages/core/tsconfig.json` now clean; CLI behavior unchanged (verified via manual `--input`/`--out` runs).
- **Committed in:** `5091de4` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 acceptance-criteria/documentation comment wording, 1 typecheck bug)
**Impact on plan:** All three were necessary to satisfy the plan's own stated acceptance criteria and typecheck cleanliness. No scope creep — no functionality was added beyond what the plan specified.

## Issues Encountered

None beyond the three deviations above — all resolved within the fix-attempt budget on first try.

## User Setup Required

None - no external service configuration required. (The refresh CLI's `--normalize-only` path only reads committed sample data; no live kglw.net traffic occurs in this plan.)

## Next Phase Readiness

- `normalizeCorpus`, the domain types, and the interim `data/normalized/corpus.json` artifact are ready groundwork for plan 01-03 (fetch CLI) and plan 01-04 (full-corpus census + locked-schema swap + final normalizer run).
- The `refresh.ts` flag surface (`--all`, `--year`, `--census-only`, `--fetch-only`) is reserved and stubbed — plan 01-03 fills in behavior without adding new flags.
- `config.ts`'s `settypeAllowlist` remains provisional (unchanged from 01-01) — the plan 01-04 census still needs to confirm/extend it.
- No blockers. Normalizer, domain types, and skeleton CLI are all in place, tested, and green.

---
*Phase: 01-corpus-ingestion-schema-foundation*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 7 files claimed as created were verified present on disk. All 3 task commit hashes (`e76c092`, `a8827e0`, `5091de4`) verified present in `git log --oneline --all`. Full test suite (`npx vitest run`) re-confirmed green (4 files, 20 tests) and `tsc --noEmit -p packages/core/tsconfig.json` re-confirmed zero typecheck errors. The committed artifact was re-verified to reproduce byte-for-byte identical to a fresh `npm run refresh -- --normalize-only --input data/samples` run except for the `generatedAt` timestamp field.
