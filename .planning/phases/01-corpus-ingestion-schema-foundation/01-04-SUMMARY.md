---
phase: 01-corpus-ingestion-schema-foundation
plan: 04
subsystem: data
tags: [zod, schema-lock, normalizer, fixtures, enum-lock, corpus-artifact]

requires:
  - phase: 01-01
    provides: census-mode zod schemas (rawSetlistRowCensus), domain types, docs/SCHEMA.md v1
  - phase: 01-02
    provides: pure normalizeCorpus, domain types (Performance/SetSection/NormalizedCorpus)
  - phase: 01-03
    provides: full committed data/raw corpus (10,210 rows, 2010-2026), data/census.json + census-report.md resolving all SCHEMA.md §13 Open Unknowns
provides:
  - Stage-2 locked zod schemas (rawSetlistRowLocked, setnumberLocked, transitionIdLocked, settypeLocked) hard-failing on novel setnumber/transition_id/settype values, naming field + value + example show (D-11)
  - normalize.ts fully swapped onto the locked schema; mapTransitionKind is now exhaustive over the locked 1-6 domain; SetSection.setNumber tightened to the domain SetNumber literal union
  - data/normalized/corpus.json regenerated from the FULL committed raw corpus (738 shows, 264 songs, latest 2025-12-13) — Phase 2's sole input, cross-checked against data/census.json through an independent code path
  - 8 era-spanning real-show fixtures (2012/2013/2017/2022/2025) under packages/core/test/fixtures/, each with a .meta.json sibling documenting source/show_id/rationale
affects: [phase-2-matrix-builder, phase-3-app-scaffold]

tech-stack:
  added: []
  patterns:
    - "Two-stage zod schemas fully realized: rawSetlistRowCensus (enum-loose, used by census.ts forever) and rawSetlistRowLocked (enum-strict via .extend(), used by normalize.ts) coexist permanently — .extend() on a strictObject preserves strictness, verified against zod 4.4.3"
    - "formatRowError(zodError, row) wired directly into normalize.ts's row-validation catch block, not just asserted in unit tests — a real future schema drift will surface field/value/example-show context in the actual ingestion path"
    - "Locked-schema vocabulary must span the FULL raw corpus (all artist_ids), not just the KGLW-scoped census fields, whenever the schema validates rows before the artist_id filter runs — settypeLocked required manual widening beyond census.json's settype field for this reason"
    - "Fixture files are bare row arrays (matching data/raw/setlists-*.json's own shape) with a sibling .meta.json documenting source file + show_id + why — no synthetic fixtures were needed; all 8 SC-5 patterns exist in the real corpus"

key-files:
  created:
    - packages/core/test/fixtures/2012-loose-terminal.json (+.meta.json)
    - packages/core/test/fixtures/2013-live-session.json (+.meta.json)
    - packages/core/test/fixtures/2013-encore.json (+.meta.json)
    - packages/core/test/fixtures/2013-unknown-sentinel.json (+.meta.json)
    - packages/core/test/fixtures/2022-rr1010-multiset.json (+.meta.json)
    - packages/core/test/fixtures/2017-segues.json (+.meta.json)
    - packages/core/test/fixtures/2025-sandwich.json (+.meta.json)
    - packages/core/test/fixtures/2025-segue-chain.json (+.meta.json)
  modified:
    - packages/core/src/ingest/api-types.ts (added rawSetlistRowLocked, setnumberLocked, transitionIdLocked, settypeLocked, formatRowError, RawSetlistRowLocked, TransitionIdLocked)
    - packages/core/src/ingest/normalize.ts (swapped to rawSetlistRowLocked; exhaustive mapTransitionKind; SetNumber-typed grouping)
    - packages/core/src/domain/types.ts (added SetNumber literal union; SetSection.setNumber tightened)
    - packages/core/src/cli/normalize-corpus.ts (fixed to only read setlists-*.json, not every *.json in data/raw)
    - docs/SCHEMA.md (§13d addendum documenting the DJ Set/Act side-project settype discovery)
    - data/normalized/corpus.json (regenerated: 738 shows, 264 songs, replaces the 25-show interim artifact)
    - packages/core/test/api-types.test.ts (15 tests for the locked schema layer)
    - packages/core/test/normalize.test.ts (8 era-spanning fixture describe blocks)

key-decisions:
  - "settypeLocked widened to include \"DJ Set\" and \"Act\" (side-project-only settype values) beyond census.json's KGLW-scoped settype field — rawSetlistRowLocked validates raw rows BEFORE the artist_id filter runs in normalize.ts, so the locked schema's vocabulary must cover the full multi-artist raw corpus, not just the census's intentionally KGLW-scoped enum distribution."
  - "SetNumber is a hand-authored literal union in domain/types.ts (\"1\" | \"2\" | \"e\"), not zod-derived, to keep the domain layer free of ingest-layer schema imports — matches the existing TransitionKind convention rather than introducing a new pattern."
  - "mapTransitionKind's prior 'any other value -> none' tolerance was removed now that rawSetlistRowLocked guarantees the transition_id domain is exactly 1-6 — the switch is exhaustive with no default case, so a future 7th value would be a compile-time error, not a silent runtime fallback."

patterns-established:
  - "Locked-schema vocabulary derivation requires checking whether the field is validated before or after the artist_id filter — census.json's KGLW-scoped enum fields are NOT automatically safe to lock verbatim for fields validated pre-filter (this plan's settype discovery); fields validated post-filter (setnumber, transition_id) matched the KGLW-only census exactly since side-project rows never introduced new values for those two fields."

requirements-completed: [DATA-01, DATA-02]

duration: ~11min
completed: 2026-07-08
---

# Phase 1 Plan 4: Schema Lock, Normalizer Finalization & Era Fixtures Summary

**Locked zod enums from full-corpus census evidence (D-11), swapped the normalizer onto them, regenerated the final 738-show/264-song `data/normalized/corpus.json` artifact, and proved 8 real era-spanning fixtures (2012-2025) parse correctly.**

## Performance

- **Duration:** ~11 min (3 task commits + 1 TDD RED commit + 1 deviation-documentation commit)
- **Started:** 2026-07-08T17:42:25-04:00 (RED commit, Task 1)
- **Completed:** 2026-07-08T17:53:08-04:00
- **Tasks:** 3/3 completed
- **Files modified:** 24 (6 source/CLI files, 2 test files, 1 doc, 1 regenerated data artifact, 16 new fixture files including .meta.json siblings)

## Accomplishments

- **Task 1 — Locked enums from census evidence, D-11 drift UX wired end-to-end:** Added `setnumberLocked` (`"1"|"2"|"e"`), `transitionIdLocked` (1-6), `settypeLocked`, and `rawSetlistRowLocked` (the shared 41-key shape via `.extend()`, which preserves `strictObject` strictness) to `api-types.ts`, plus `formatRowError` for D-11's "name the field, the value, and an example show" requirement. All 6 specified behaviors pass: full-corpus parsing with zero errors (both samples + `setlists-2025.json`), hard-fail-with-context on novel `setnumber`/`transition_id`/`settype` values, permanent census-mode permissiveness on the same novel values, and every locked-enum value traceable to real corpus evidence. `docs/SCHEMA.md` §13 and `config.settypeAllowlist` were already fully resolved/finalized by plan 01-03 — verified both meet this task's acceptance criteria unchanged.
- **Task 2 — Normalizer finalized on locked schemas, full-corpus artifact regenerated:** `normalize.ts` now validates every row with `rawSetlistRowLocked`, catching `ZodError` and rethrowing via `formatRowError` so a real future drift surfaces the same field/value/example-show context in production, not just tests. `mapTransitionKind` is exhaustive over the locked 1-6 domain (switch, no default). Regenerated `data/normalized/corpus.json` from the full committed `data/raw` corpus: **738 shows, 264 distinct songs, latest show 2025-12-13** — replacing the 25-show interim artifact. Cross-checked against `data/census.json` through an independent code path: `showCount` (738) = census `showsPerYear` sum (757) minus Live-Session-excluded shows (19); `songCount` (264) = census `distinctKglwSongCount` (265) minus the sentinel Unknown song (1). Both match exactly.
- **Task 3 — 8 era-spanning real-show fixtures prove phase success criterion 5:** Extracted 8 real single-show fixtures from the committed raw corpus spanning 2012/2013/2017/2022/2025 (loose terminal, Live Session exclusion, encore, Unknown sentinel, rr1010 multi-set, mid-era segues, the real 2025-12-13 Motor Spirit/Gila Monster/Motor Spirit sandwich, and a 3-row consecutive segue chain), each with explicit expected-value assertions (no snapshots) and a `.meta.json` sibling documenting provenance. All 8 patterns exist in real data — no synthetic fixtures were needed.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests for stage-2 locked schemas (D-11)** - `aabb77f` (test)
1. **Task 1 (GREEN): Lock enums from census evidence (D-11)** - `9df758d` (feat)
1. **Task 1 (deviation doc): Document DJ Set/Act side-project settype discovery** - `21f09ff` (docs)
2. **Task 2: Finalize normalizer on locked schemas + regenerate full-corpus artifact** - `26bbe64` (feat)
3. **Task 3: Era-spanning fixture tests prove structure/segues/sandwiches (SC #5)** - `df25e81` (test)

_Note: Task 1 was TDD (`tdd="true"`) — RED then GREEN commits, with a small follow-up docs commit for the SCHEMA.md addendum describing the settype-widening deviation. Task 3 was also marked `tdd="true"` in the plan, but its 8 fixture tests verify already-correct normalizer behavior (finalized in this same plan's Task 2) against real data rather than driving new implementation — all 8 passed immediately with no RED phase, which is the expected outcome for fixture-verification tests over existing, already-tested logic._

## Files Created/Modified

- `packages/core/src/ingest/api-types.ts` - stage-2 locked schemas (`rawSetlistRowLocked`, `setnumberLocked`, `transitionIdLocked`, `settypeLocked`), `formatRowError`
- `packages/core/src/ingest/normalize.ts` - swapped to locked schema validation with `formatRowError` wiring; exhaustive `mapTransitionKind`
- `packages/core/src/domain/types.ts` - `SetNumber` literal union; `SetSection.setNumber` tightened from `string`
- `packages/core/src/cli/normalize-corpus.ts` - fixed to read only `setlists-*.json` (was crashing on `data/raw`'s sibling tables)
- `docs/SCHEMA.md` - §13d addendum documenting the DJ Set/Act discovery
- `data/normalized/corpus.json` - regenerated final artifact (738 shows, 264 songs, `schemaVersion: 1`, latest 2025-12-13)
- `packages/core/test/api-types.test.ts` - 15 tests for the locked-schema layer (D-11 behaviors 1-6 plus a `transitionIdLocked` cross-check)
- `packages/core/test/normalize.test.ts` - 8 era-spanning fixture describe blocks
- `packages/core/test/fixtures/*.json` (+8 `.meta.json` siblings) - real single-show extracts covering 2012/2013/2017/2022/2025

## Decisions Made

- **`settypeLocked` widened beyond `census.json`'s settype field**: `rawSetlistRowLocked` validates raw rows before the artist_id filter runs, so its vocabulary must cover the full multi-artist raw corpus. A direct scan of every `data/raw/setlists-*.json` file found two side-project-only settype values (`"DJ Set"`, `"Act"`) that the plan-01-03 census never surfaced (it intentionally scopes settype counting to `artist_id === 1`). Widened `settypeLocked` to include both; `config.settypeAllowlist` (D-16) is unaffected since it runs after the artist filter.
- **`SetNumber` is hand-authored, not zod-derived**: kept the domain layer (`domain/types.ts`) free of ingest-layer imports, matching the existing `TransitionKind` convention.
- **Removed the prior "any other transition_id -> none" tolerance**: now that `rawSetlistRowLocked` guarantees the 1-6 domain, `mapTransitionKind`'s switch has no default case — a 7th value would be a compile error during future development, not a silent runtime fallback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `settypeLocked` missing side-project-only settype values discovered in the raw corpus**
- **Found during:** Task 1 (writing the failing test suite — Test 1 required `rawSetlistRowLocked` to parse every row of `data/raw/setlists-2025.json`, which failed on a `"DJ Set"` row)
- **Issue:** `census.json`'s settype field is intentionally scoped to `artist_id === 1` (a plan-01-03 design decision), so it never captured `"DJ Set"` (86 rows, artist_id 36) and `"Act"` (1 row, artist_id 9) — real side-project settype values present in the same committed multi-artist tables. Since `rawSetlistRowLocked` validates rows before the artist filter runs, a schema built only from the KGLW-scoped census values would hard-fail on legitimate, already-committed data.
- **Fix:** Scanned all `data/raw/setlists-*.json` files directly (all artist_ids) to find the true full vocabulary; widened `settypeLocked` to `["Set", "One Set", "Live Session", "DJ Set", "Act"]`. `config.settypeAllowlist` (D-16, KGLW-only exclusion logic) is unaffected.
- **Files modified:** `packages/core/src/ingest/api-types.ts`, `packages/core/test/api-types.test.ts` (Test 6 rewritten to cross-check settype against a full raw-corpus scan instead of the KGLW-scoped census field), `docs/SCHEMA.md` (§13d addendum)
- **Verification:** Full suite green (44/44 after Task 1, 52/52 after Task 3); `tsc --noEmit` clean.
- **Committed in:** `9df758d` (code fix), `21f09ff` (SCHEMA.md documentation)

**2. [Rule 3 - Blocking] `normalize-corpus.ts` CLI crashed reading `data/raw`'s sibling tables**
- **Found during:** Task 2 (running `pnpm refresh --normalize-only` for the first time over the full `data/raw` directory)
- **Issue:** `runNormalizeCorpus` read every `*.json` file in the input directory, including `shows.json`, `songs.json`, `albums.json`, `jamcharts.json`, and `fetch-meta.json` — none of which are setlist rows. It crashed on `fetch-meta.json` ("expected either a bare row array or an API envelope — got neither"). This CLI had never actually been exercised against the full `data/raw` directory before this plan; the 25-show interim artifact on disk had been produced by pointing `--input` at `data/samples` instead.
- **Fix:** Filtered the file glob to `setlists-*.json` only.
- **Files modified:** `packages/core/src/cli/normalize-corpus.ts`
- **Verification:** `node packages/core/src/cli/refresh.ts --normalize-only` completed successfully, producing the final 738-show artifact; all three census cross-checks pass exactly.
- **Committed in:** `26bbe64`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug fix expanding locked-schema vocabulary with real evidence, 1 Rule 3 blocking-issue fix to the normalize CLI's file glob)
**Impact on plan:** Both fixes were necessary to complete the plan's own stated tasks (Task 1's parse-with-zero-errors test could not otherwise pass against the real 2025 file; Task 2's full-corpus regeneration could not otherwise run at all). No scope creep — no functionality was added beyond correcting genuine defects discovered while executing the plan as written.

## Issues Encountered

None beyond the two deviations above — both resolved on first fix attempt, well within the fix-attempt budget.

## User Setup Required

None — no external service configuration required. This plan touches only committed data (`data/raw`, `data/census.json`) and pure TypeScript; no live API traffic occurred.

## Next Phase Readiness

- `data/normalized/corpus.json` is the final, frozen Phase-1 deliverable: `schemaVersion: 1`, 738 shows, 264 distinct songs, data through 2025-12-13 — Phase 2's sole input, independently cross-checked against `data/census.json`.
- Schema drift protection is live end-to-end: a future refresh that introduces a novel `setnumber`/`transition_id`/`settype` value will hard-fail in `normalize.ts` itself (not just in tests), naming the field, the offending value, and an example show via `formatRowError`.
- Era-spanning fixture coverage (2012-2025) proves the normalizer handles loose terminals, settype exclusion, encores, the Unknown sentinel, multi-set marathons, mid-era segues, sandwiches, and segue chains — all from real corpus data, satisfying phase success criterion 5.
- No blockers. All acceptance criteria for all 3 tasks verified: 15/15 locked-schema tests, full-corpus regeneration with 3/3 cross-checks passing, 8/8 era fixtures with explicit assertions, full suite 52/52 green, `tsc --noEmit` clean on both the census-mode and locked-mode schema layers.
- Plan 01-05 (tuning-tags generator, DATA-04) can proceed independently — it does not depend on anything this plan changed beyond the now-finalized `data/normalized/corpus.json` shape.

## Self-Check: PASSED

All 10 claimed files verified present on disk (api-types.ts, normalize.ts, domain/types.ts, normalize-corpus.ts, docs/SCHEMA.md, data/normalized/corpus.json, api-types.test.ts, normalize.test.ts, fixtures/2025-sandwich.json, this SUMMARY.md). All 6 claimed commit hashes verified present in git log (aabb77f, 9df758d, 21f09ff, 26bbe64, df25e81, abac88e).

---
*Phase: 01-corpus-ingestion-schema-foundation*
*Completed: 2026-07-08*
