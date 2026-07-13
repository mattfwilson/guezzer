---
phase: 05-live-sync-data-safety
plan: 01
subsystem: api
tags: [zod, live-sync, kglw-api, core-purity, tolerant-fetch, dependency-injection]

# Dependency graph
requires:
  - phase: 01-corpus-ingestion-schema-foundation
    provides: "rawSetlistRowCensus + formatRowError + assertFilterApplied (the fetchJson/strictObject ingestion idiom this plan mirrors); docs/SCHEMA.md §9/§11 latest-endpoint field facts"
  - phase: 04-show-mode
    provides: "app db.ts TrackedShow/TrackedEntry shapes (mirrored locally as minimal input types); logSong/renameEntry adoption paths the suggestions feed"
provides:
  - "latestSetlistRow zod schema + LatestSetlistRow type (the latest-endpoint-specific schema, fixes the 5-missing-keys throw)"
  - "pollLatest tolerant, artist-scoped live poller (SYNC-01/D-06) — one GET per call, [] on any soft failure"
  - "diffLatestAgainstTrail dedupe-to-suggestions + resolvePlaceholders fill-hints (SYNC-02/D-02/D-04)"
  - "bindShowFromLatest wrong-show-guarded auto-bind decision (D-07)"
  - "data/samples/latest.sample.json — committed real-shape live fixture locking the schema"
  - "core barrel re-exports of all live-sync symbols for the app tier"
affects: [05-04-live-poll-hook, 05-app-live-sync-ui, phase-6-show-history]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tolerant poller: mirror the build-time fetchJson idiom (User-Agent + AbortSignal + envelope handling) but INVERT the hard-fail — return [] on every soft failure so a live loop can retry (D-06)"
    - "Endpoint-specific strictObject: a fresh schema enumerating the full present key set (census minus the 5 latest-absent keys), consumed fields precisely typed, rest z.unknown() — strict drift detection without inheriting the census's required-but-absent keys"
    - "Pure decision fns with locally re-declared minimal input types (TrailEntryInput/TrackedShowInput) — zero db.ts/DOM import, core purity preserved"

key-files:
  created:
    - packages/core/src/ingest/latest-types.ts
    - packages/core/src/live/poll-latest.ts
    - packages/core/src/live/suggest.ts
    - packages/core/src/live/bind-show.ts
    - data/samples/latest.sample.json
    - packages/core/test/latest-types.test.ts
    - packages/core/test/poll-latest.test.ts
    - packages/core/test/suggest.test.ts
    - packages/core/test/bind-show.test.ts
  modified:
    - packages/core/src/config.ts
    - packages/core/src/index.ts

key-decisions:
  - "latestSetlistRow enumerates the FULL 36-key latest shape (not just the 11 consumed fields) so strictObject drift-detection and real-row-parse both hold; unconsumed keys are z.unknown()"
  - "Committed fixture is the REAL live latest.json envelope (fetched polite GET 2026-07-13) which happened to be a Stu Mackenzie solo set (artist_id 4) — an authentic SCHEMA §9 foreign-band row the artist_id guard must discard"
  - "pollLatest uses per-row safeParse + skip (not map+throw) so one malformed row never fails the whole poll"

patterns-established:
  - "Invert-the-failure-policy poller: same fetch idiom as fetchJson, [] instead of throw (live vs build-time contrast, D-06)"
  - "Endpoint-subset strictObject with z.unknown() padding for present-but-unconsumed keys"

requirements-completed: [SYNC-01, SYNC-02]

# Metrics
duration: ~20min
completed: 2026-07-13
---

# Phase 5 Plan 01: Live-Sync Core Substrate Summary

**Pure, DOM-free live-sync core: a latest-endpoint zod schema, a tolerant artist-scoped `pollLatest`, dedupe-to-suggestions + placeholder-resolver diffs, and a wrong-show-guarded auto-bind — all dependency-injected and Node-tested against a committed real live fixture.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-13
- **Tasks:** 3
- **Files modified:** 11 (9 created, 2 modified)

## Accomplishments
- `latestSetlistRow` schema fixes the RESEARCH-Pitfall-1 throw: the `latest` endpoint omits 5 keys (`css_class`, `isrecommended`, `tracktime`, `timezone`, `showtime`) that `rawSetlistRowCensus` requires — a test proves the census schema throws on the same real row the new schema parses cleanly.
- `pollLatest` mirrors `fetchJson` but inverts its failure policy: one polite GET, returns `[]` (never throws) on non-OK status, `error:true` envelope, network/timeout reject, or a malformed row; `artist_id === 1` filter discards foreign-band rows tolerantly (T-05-02/DATA-03).
- Pure `diffLatestAgainstTrail` / `resolvePlaceholders` / `bindShowFromLatest` decision functions implement SYNC-02/D-02/D-04/D-07 with zero DOM and zero `db.ts` dependency, exhaustively unit-tested.
- Captured a REAL live `latest.json` fixture that authentically demonstrates the SCHEMA §9 wrong-band edge case (a Stu Mackenzie solo set).
- 39 new tests; full core suite green (136 tests, 15 files); core typecheck clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture latest.sample.json + author the latestSetlistRow schema** — `8e2fdfe` (feat)
2. **Task 2: Tolerant pollLatest poller (mirror fetchJson, invert failure policy)** — `44bdf3b` (feat)
3. **Task 3: Pure suggestion diff, placeholder resolver, wrong-show-guarded bind** — `ed7a135` (feat)

_MVP mode (workflow.tdd_mode false): tests authored alongside implementation in one commit per task, not split into RED/GREEN._

## Files Created/Modified
- `packages/core/src/ingest/latest-types.ts` - `latestSetlistRow` strictObject + `LatestSetlistRow` type; re-exports `formatRowError`
- `packages/core/src/live/poll-latest.ts` - `pollLatest({fetch})` tolerant, artist-scoped live poller
- `packages/core/src/live/suggest.ts` - `diffLatestAgainstTrail` + `resolvePlaceholders` pure fns; `Suggestion`/`FillHint`/`TrailEntryInput` types
- `packages/core/src/live/bind-show.ts` - `bindShowFromLatest` wrong-show-guarded bind; `TrackedShowInput`/`ShowBinding` types
- `data/samples/latest.sample.json` - committed real live envelope (Stu Mackenzie solo set, artist_id 4) with `_provenance` note
- `packages/core/src/config.ts` - added `latestPath: "/latest.json"` (SYNC-01)
- `packages/core/src/index.ts` - barrel re-exports of all live-sync symbols
- `packages/core/test/{latest-types,poll-latest,suggest,bind-show}.test.ts` - 39 Node tests

## Decisions Made
- **Full-shape schema over 11-key subset:** `latestSetlistRow` enumerates all 36 keys a real latest row carries (census 41 minus the 5 latest omits). A strict schema listing only the 11 consumed fields would reject the real 36-key row as "unknown keys", failing its own parse-succeeds acceptance criterion. Consumed fields are precisely typed; the other 25 present keys are `z.unknown()` (present, value-ignored) so only a genuinely novel key trips drift detection. See Deviations.
- **Real fixture over derived:** the live GET succeeded, so the committed fixture is the authentic envelope rather than a derived rr1010 subset. It doubles as a real SCHEMA §9 foreign-band example (artist_id 4) — stronger evidence for the artist_id guard than a synthetic row.
- **Per-row safeParse + skip** in `pollLatest` (not `map(parse)`) so a single malformed row logs one `console.debug` line and is skipped rather than aborting the whole poll (T-05-01/T-05-04).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] latestSetlistRow must enumerate the full latest key set, not only the 11 consumed fields**
- **Found during:** Task 1 (schema authoring)
- **Issue:** The plan's action said to author `latestSetlistRow` as a `z.strictObject` "validating ONLY the fields the poller/binder consume" (11 keys). But a real `latest` row carries ~36 keys, and `strictObject` rejects unknown keys — so an 11-key strict schema throws "Unrecognized keys" on the real fixture, directly failing the plan's own acceptance criterion ("latestSetlistRow.parse on the committed sample's first row does not throw") and behavior test. The 11-key-strict design and the parse-succeeds requirement are mutually exclusive.
- **Fix:** Enumerated the full present shape (36 keys = census 41 minus the 5 latest-absent keys). The 11 consumed fields keep precise types (`z.number().int()`, `showdate` regex, etc.); the 25 present-but-unconsumed keys are `z.unknown()`. Net: the real row parses, a wrong-typed consumed field is rejected, and a genuinely novel 37th key still trips strict drift detection — every stated behavior and acceptance criterion holds. Schema is authored fresh (not `rawSetlistRowCensus.omit(...)`), honoring "do NOT reuse rawSetlistRowCensus".
- **Files modified:** packages/core/src/ingest/latest-types.ts
- **Verification:** `latest-types.test.ts` — 10 tests green, including the drift-rejection test (37th key), the fix-proof test (census schema throws on the same row), and full-sample parse.
- **Committed in:** `8e2fdfe` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/correctness reconciliation)
**Impact on plan:** The fix is the only implementation that satisfies all of the plan's own behaviors and acceptance criteria simultaneously. No scope creep — same public symbol, same consumed-field contract, same fixture.

## Issues Encountered
- Vitest must be run from the repo root (root `test.projects` config), not `cd packages/core` — running from the package dir reports "No test files found". Used root-relative name filters (`npx vitest run latest-types`) and `--project @guezzer/core` for the full suite.

## Threat Surface
No new surface beyond the plan's `<threat_model>`. T-05-01 (row validation), T-05-02 (artist_id guard), T-05-04 (tolerant error handling with a single non-stack-trace debug line) are all implemented in code. T-05-03 (poll cadence) is correctly deferred to the app hook (plan 05-04) — `pollLatest` performs exactly one GET per call, asserted by test. T-05-SC (supply chain): no new dependencies added this phase (vacuously satisfied).

## Known Stubs
None. All exported functions are fully implemented and tested; no placeholder/empty-value returns.

## Next Phase Readiness
- The full pure live-sync substrate is exported from `@guezzer/core` — plan 05-04's `useLatestPoll` app hook can consume `pollLatest`, `diffLatestAgainstTrail`, `resolvePlaceholders`, and `bindShowFromLatest` and owns only lifecycle/timing (interval, `navigator.onLine`, visibility gating, active-show gate, ≤1/60s cadence).
- No blockers. The committed `latest.sample.json` provides a stable fixture for downstream app-tier tests.

## Self-Check: PASSED

All 9 created files exist on disk; all 3 task commits (`8e2fdfe`, `44bdf3b`, `ed7a135`) present in git history.

---
*Phase: 05-live-sync-data-safety*
*Completed: 2026-07-13*
