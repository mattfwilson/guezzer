---
phase: 01-corpus-ingestion-schema-foundation
plan: 03
subsystem: data
tags: [fetch, census, kglw-api, zod, vitest, api-etiquette]

requires:
  - phase: 01-01
    provides: npm workspace scaffold, docs/SCHEMA.md, census-mode zod schemas (rawSetlistRowCensus), assertFilterApplied, config.ts, committed samples
  - phase: 01-02
    provides: domain types, pure normalizeCorpus, skeleton refresh CLI, normalize-corpus.ts
provides:
  - Paced sequential fetcher (packages/core/src/cli/fetch-corpus.ts) — fetchJson/fetchCorpus, D-07 pacing/UA/no-retry, D-12 post-fetch filter assertion, Pitfall-3 row-count sanity tripwire
  - Full historical raw corpus committed under data/raw/ (2010-2026, 10,210 setlist rows + shows/songs/albums/jamcharts + fetch-meta.json) — the offline source of truth (D-06)
  - Full-corpus census (packages/core/src/ingest/census.ts + cli/run-census.ts) resolving all 5 docs/SCHEMA.md §13 Open Unknowns with real evidence
  - data/census.json + data/census-report.md — first-class owner-readable deliverable, committed
  - refresh.ts fully wired: --all/--year(repeatable)/--tables/--fetch-only/--census-only/--normalize-only, D-05 default flow chains fetch -> census -> normalize
  - docs/SCHEMA.md §13 all 5 unknowns resolved with citations into the census report; config.ts settypeAllowlist confirmed final (not provisional)
affects: [01-04, 01-05, phase-2-matrix-builder]

tech-stack:
  added: []
  patterns:
    - "Injected-deps fetcher: fetchJson/fetchCorpus take an optional { fetch, sleep } pair, defaulting to globalThis.fetch/setTimeout in production — the ONLY way tests exercise this module is via mocks, real network code never runs in CI/tests (P11)"
    - "Pure argument parser: parseRefreshArgs(argv, currentYear) is fully unit-testable with zero I/O; --year validated as a bounded integer BEFORE any URL/path interpolation (ASVS V5)"
    - "Census-vs-normalize scope split: census.ts intentionally does NOT apply config.settypeAllowlist — discovering the full settype vocabulary is the census's job; normalize.ts applies the allowlist. Same raw rows, two different pure functions, two different jobs"

key-files:
  created:
    - packages/core/src/cli/fetch-corpus.ts
    - packages/core/src/ingest/census.ts
    - packages/core/src/cli/run-census.ts
    - packages/core/test/fetch.test.ts
    - packages/core/test/census.test.ts
    - data/raw/setlists-2010.json ... setlists-2026.json (17 files)
    - data/raw/shows.json, songs.json, albums.json, jamcharts.json, fetch-meta.json
    - data/census.json
    - data/census-report.md
  modified:
    - packages/core/src/cli/refresh.ts (fully wired: parseRefreshArgs + fetch/census/normalize orchestration)
    - packages/core/src/ingest/api-types.ts (state field widened to nullable — real API drift)
    - packages/core/src/domain/types.ts (Venue.state: string | null)
    - packages/core/src/config.ts (tourIdSentinel added; settypeAllowlist comment updated to CONFIRMED FINAL)
    - docs/SCHEMA.md (§13 all 5 Open Unknowns resolved)

key-decisions:
  - "rawSetlistRowCensus.state widened from z.string() to z.string().nullable() after the real full-corpus fetch returned state: null for a Montreal, Canada venue (show_id 1678650827, 2014-10-15) — not present in either Phase-1-planning sample. Structural correction only; propagated to the domain Venue.state type."
  - "RESEARCH.md's approximate segue-frequency figure for the rr1010 sample ('9 in 27 rows') is corrected to the verified value of 10/27 — direct verification against the committed sample data (transition_id 2 or 3 at positions 1,4,5,7,9,15,16,21,22,23) is the source of truth over the research approximation."
  - "Census intentionally counts KGLW (artist_id===1) rows for all field/enum distributions, applying NEITHER the settypeAllowlist NOR any structural exclusion — the whole point of the census is discovering settype's full vocabulary, which an early filter would hide. Only the dedicated sideProjectRowsByYear check counts non-KGLW rows, by design."
  - "tour_id and opener are censused via presence/sentinel bucketing (not every literal value) per the plan's own 'distinct presence'/'sentinel usage' wording — reporting every one of ~80 real tour names or ~330 distinct opener acts would be noise, not signal."

patterns-established:
  - "Diagnose-fix-resume protocol for live-fetch schema drift: on an unexpected zod validation failure during the one-time live fetch, make ONE additional single diagnostic request to the specific failing endpoint (never a loop), inspect the row, fix the schema, then resume via --year N for only the remaining years — never redo already-succeeded years (matches D-07's own 'diagnose then re-run only the failed year' design)"
  - "Census report leads with a 'What this resolves' section mapping directly to the SCHEMA.md unknown IDs it answers — future census-style reports in this project should follow the same structure"

requirements-completed: [DATA-01, DATA-02, DATA-03]

duration: 15min
completed: 2026-07-08
---

# Phase 1 Plan 3: Paced Fetcher, One-Time Corpus Pull & Full-Corpus Census Summary

**Built the D-07-compliant paced sequential fetcher, ran the one-time live pull of the entire 2010–2026 KGLW corpus (10,210 rows) from kglw.net, and ran a full-corpus census that resolves all 5 of docs/SCHEMA.md's Open Unknowns with real evidence instead of two-sample approximations.**

## Performance

- **Duration:** ~15 min (across 3 task commits + 2 TDD RED commits)
- **Started:** 2026-07-08T17:20:54-04:00 (RED commit, Task 1)
- **Completed:** 2026-07-08T17:35:26-04:00
- **Tasks:** 3/3 completed
- **Files modified:** 34 (2 new CLI modules, 1 new ingest module, 2 new test files, 22 committed `data/raw/*` files, 2 census output files, 4 modified schema/config/domain/doc files)

## Accomplishments

- **Task 1 — Paced sequential fetcher, fully mocked-fetch tested:** `fetchJson`/`fetchCorpus` in `packages/core/src/cli/fetch-corpus.ts` implement D-07 exactly — strictly sequential requests (never `Promise.all`), a courtesy `sleep` call between every pair of consecutive requests, the descriptive User-Agent, an `AbortSignal` timeout, and zero automatic re-requests on any failure. Every per-year fetch runs the D-12 `assertFilterApplied` on `showyear` plus the Pitfall-3 row-count sanity tripwire (`config.maxRowsPerYearSanity`). All 7 specified behaviors (pacing/sequencing, User-Agent, error-envelope + HTTP-500 no-retry, empty-year tolerance, filter-mismatch hard-fail, row-count tripwire, `--year` arg validation) pass against injected mock `{ fetch, sleep }` deps — zero real network calls in the test suite (verified: `grep -rn "kglw.net" packages/core/test/` finds nothing). `refresh.ts`'s `parseRefreshArgs` is a pure, unit-tested argument parser; `--year` is validated as a bounded integer strictly before any URL/path interpolation (ASVS V5).
- **Task 2 — The one-time live fetch, executed and committed:** Ran `npm run refresh -- --all --fetch-only` against the real `https://kglw.net/api/v2` — the single sanctioned live-API interaction of this phase. Hit a genuine schema-drift blocker on year 2014 (a Montreal, Canada venue returns `state: null`, not covered by either Phase-1-planning sample); diagnosed with one additional single request, widened `rawSetlistRowCensus.state` to `.nullable()`, then resumed via `--year 2014 ... --year 2026 --tables --fetch-only` for only the remaining years (2010–2013 were not re-fetched). Final committed corpus: 17 per-year setlist files (10,210 rows, all `showyear`-matched), `shows.json`/`songs.json`/`albums.json`/`jamcharts.json`, and `fetch-meta.json`. Verify script confirms every year file's rows match their filename year and the total row count (10,210) sits comfortably inside the 3,000–60,000 plausibility band.
- **Task 3 — Full-corpus census, TDD, resolving every SCHEMA.md unknown:** `census.ts`'s pure `runCensus` counts 12 enum-ish fields (settype, setnumber, transition_id, isoriginal, isreprise, isjam, isjamchart, isverified, soundcheck, opener presence, css_class, tour_id sentinel usage) plus 7 derived checks (last-row transition_id-by-year, per-year segue frequency, footnote parse failures, contiguity violations, side-project rows by year, corpus totals, tease-notation candidates). Ran over the full committed corpus: **zero contiguity violations, zero footnote parse failures, no `setnumber: "3"` anywhere (Open Unknown a resolved: no), settype confirmed as exactly `{Set, One Set, Live Session}` across all 15 years (Open Unknown d resolved), transition_id 4 occurs 29 times across 29 shows first seen 2016 (Open Unknown b resolved), and the tease hunt (Open Unknown c) surfaced that most `/tease/i` hits are a recurring staff-disclaimer boilerplate sentence, not genuine tease call-outs** — documented as an explicit caveat in the report. `docs/SCHEMA.md` §13 now carries full resolutions for all 5 unknowns with citations into `data/census-report.md`; `config.ts`'s `settypeAllowlist` comment is updated from PROVISIONAL to CONFIRMED FINAL.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests for paced fetcher + refresh arg validation** - `814a547` (test)
1. **Task 1 (GREEN): Paced sequential fetcher + refresh CLI orchestration** - `3fcdda5` (feat)
2. **Task 2: One-time full historical corpus fetch — commit data/raw** - `45f1ddd` (feat)
3. **Task 3 (RED): Add failing tests for full-corpus census over the two samples** - `6482f66` (test)
3. **Task 3 (GREEN): Full-corpus census + SCHEMA.md unknown resolution** - `2d7d2f5` (feat)

_Note: Tasks 1 and 3 were TDD (`tdd="true"`) — RED then GREEN commits each; no REFACTOR commit needed (implementations were clean on first pass after fixing one typecheck cast in the RED test file, folded into the GREEN commit)._

## Files Created/Modified

- `packages/core/src/cli/fetch-corpus.ts` - `fetchJson`/`fetchCorpus`, D-07/D-12/Pitfall-3 compliant
- `packages/core/src/cli/refresh.ts` - `parseRefreshArgs` (pure) + full fetch/census/normalize orchestration; `--all`/`--year`(repeatable)/`--tables`/`--fetch-only`/`--census-only`/`--normalize-only`
- `packages/core/src/ingest/census.ts` - Pure `runCensus(rowsByFile)` — field census + 7 derived checks
- `packages/core/src/cli/run-census.ts` - Reads `data/raw/setlists-*.json`, writes `census.json`/`census-report.md`
- `packages/core/test/fetch.test.ts` - 10 tests: pacing/sequencing/UA/no-retry/empty-year/filter-assertion/row-sanity/arg-validation
- `packages/core/test/census.test.ts` - 7 tests over the two committed samples
- `data/raw/setlists-2010.json` … `setlists-2026.json`, `shows.json`, `songs.json`, `albums.json`, `jamcharts.json`, `fetch-meta.json` - the committed offline source of truth (D-06)
- `data/census.json`, `data/census-report.md` - machine- and owner-readable census deliverables (D-10)
- `packages/core/src/ingest/api-types.ts` - `state` field widened to nullable (real API drift discovered during the live fetch)
- `packages/core/src/domain/types.ts` - `Venue.state: string | null`
- `packages/core/src/config.ts` - `tourIdSentinel` added; `settypeAllowlist` comment updated to CONFIRMED FINAL
- `docs/SCHEMA.md` - §13 all 5 Open Unknowns resolved with full-corpus evidence

## Decisions Made

- **`state` field widened to nullable**: the real full-corpus fetch returned `state: null` for a non-US venue (Montreal, Canada) not present in either Phase-1-planning sample — a genuine, previously-undiscovered API shape. Fixed at the schema layer (`rawSetlistRowCensus.state: z.string().nullable()`) and propagated to the domain `Venue.state` type. This is structural correction only, not enum-locking, and does not touch D-11's later work.
- **Corrected a research approximation with verified data**: `.planning/phases/01-corpus-ingestion-schema-foundation/01-RESEARCH.md` stated the rr1010 sample has "9 in 27" segue rows; direct verification against the committed sample finds 10 (transition_id 2 or 3 at positions 1,4,5,7,9,15,16,21,22,23). The census test and `data/census-report.md` both use the verified value — the committed sample data is the ground truth, not the research doc's approximation.
- **Census does not apply `settypeAllowlist`**: by design, the census's job is to discover the settype vocabulary; the normalizer (already built in 01-02) is what applies the allowlist to exclude non-show settypes. Keeping these as two separate concerns in two separate pure functions avoided a circular dependency between "discover the vocabulary" and "filter by the vocabulary."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `state` field too strict for real API data — widened to nullable**
- **Found during:** Task 2 (the one-time live corpus fetch)
- **Issue:** `rawSetlistRowCensus.state` was `z.string()`. The live fetch of year 2014 threw a zod validation error (`state: expected string, received null`) on a Montreal, Canada venue (show_id 1678650827, 2014-10-15) — neither committed Phase-1-planning sample (both US venues + an Australian radio session with an empty-string state) exercised this case.
- **Fix:** Diagnosed with one additional single request to `/setlists/showyear/2014.json` (not a loop, not a retry — a one-off diagnostic read per D-07's own "diagnose, then re-run" design), confirmed the null value, widened the schema to `z.string().nullable()`, propagated to `domain/types.ts`'s `Venue.state: string | null`, then resumed the fetch for the remaining years (2014–2026 + sibling tables) via `--year N` flags — years 2010–2013 (already successfully fetched and committed before the failure) were not re-fetched.
- **Files modified:** `packages/core/src/ingest/api-types.ts`, `packages/core/src/domain/types.ts`
- **Verification:** Full suite green (37/37) both before and after the fix; `tsc --noEmit` clean; the resumed fetch completed cleanly for all 13 remaining years + 4 sibling tables.
- **Committed in:** `45f1ddd` (Task 2 commit, alongside the committed raw corpus)

**2. [Rule 1 - Bug] Test file typecheck cast tightened**
- **Found during:** Task 1 (`tsc --noEmit` check after GREEN)
- **Issue:** Destructuring `mockFetch.mock.calls[0] as [string, RequestInit]` failed to typecheck (`Conversion of type '[]' to type '[string, RequestInit]' may be a mistake` — vitest's mock call type doesn't structurally overlap with the target tuple).
- **Fix:** Added an intermediate `as unknown` cast (`as unknown as [string, RequestInit]`), the standard TypeScript escape hatch for a deliberately-narrowed test assertion.
- **Files modified:** `packages/core/test/fetch.test.ts`
- **Verification:** `tsc --noEmit -p packages/core/tsconfig.json` clean; test still passes.
- **Committed in:** `3fcdda5` (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 real-world schema-drift bug fix, 1 test-file typecheck fix)
**Impact on plan:** Both fixes were necessary to complete the plan's own stated tasks (the live fetch could not otherwise complete; the typecheck gate could not otherwise pass). No scope creep — no functionality was added beyond correcting genuine defects discovered while executing the plan as written.

## Issues Encountered

None beyond the two deviations above — both resolved within the fix-attempt budget on first try, and the live-fetch resumption strategy (diagnose once, fix, resume only the remaining years) kept live API traffic to exactly what D-07/P11 sanction: one full attempt, one single diagnostic read, one resumed pass for the years not yet fetched.

## User Setup Required

None — no external service configuration required. The kglw.net API is unauthenticated; the one live-API interaction sanctioned by this plan has already been executed and its output committed. No further live traffic is needed for plan 01-04 or 01-05 (both consume only the committed `data/raw/`, `data/census.json`, and `data/census-report.md`).

## Next Phase Readiness

- `data/census-report.md` and `data/census.json` give plan 01-04 everything it needs to lock the Stage 2 zod enums (`setnumber: "1"|"2"|"e"` only, `settypeAllowlist` confirmed final, `transition_id` vocabulary fully counted) with zero further API traffic.
- The full committed `data/raw/` corpus (10,210 rows, 2010–2026) is the permanent offline source of truth — the normalizer (already built in 01-02) can be re-run and iterated on indefinitely without touching kglw.net again.
- `refresh.ts`'s full flag surface (`--all`/`--year`/`--tables`/`--fetch-only`/`--census-only`/`--normalize-only`) is stable and fully implemented; the D-05 default (no flags) now chains fetch → census → normalize in one command for future routine refreshes.
- No blockers. All acceptance criteria for all 3 tasks verified: 7/7 fetch behavior tests, 7/7 census behavior tests, zero real network calls in the test suite, zero CI wiring, full raw corpus committed and verified, census outputs committed and derived from committed raw data only.

---
*Phase: 01-corpus-ingestion-schema-foundation*
*Completed: 2026-07-08*
