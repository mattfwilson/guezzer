---
phase: 11-live-sync-prediction-correctness
plan: 02
subsystem: core
tags: [live-sync, zod, poll-latest, schema-drift, residency, artist-filter]

# Dependency graph
requires:
  - phase: 05-live-sync-data-safety
    provides: pollLatest tolerant poller, latestSetlistRow schema, diffLatestAgainstTrail/resolvePlaceholders suggestion fns, bindShowFromLatest
provides:
  - "guardLatestRows(rows, TonightGuardInput) — pure per-poll filter dropping cached previous-night rows (bound: show_id identity; unbound: show's own date, past-midnight-safe)"
  - "Lenient-but-detecting latestSetlistRow (.catchall(z.unknown())) — additive API key keeps the row usable instead of emptying it"
  - "KNOWN_LATEST_KEYS (ReadonlySet, derived from schema .shape) + detectNovelKeys(raw) — names-only drift detector"
  - "PollResult { rows, schemaDrift, novelKeys? } — pollLatest now returns a once-per-poll drift signal, never-throw soft-fail preserved"
  - "LIVE-02 mixed-artist regression test locking artist_id !== 1 as the sole single-ingress filter"
affects: [11-04 app wiring (useLatestPoll/mockLatest/app tests must consume PollResult + apply guardLatestRows once), 11-03 era-prior]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure guard applied once at ingress (guardLatestRows) — never re-filtered per consumer"
    - "Lenient-but-detecting zod schema: .catchall(z.unknown()) for tolerance + a schema-derived KNOWN_LATEST_KEYS set for drift detection (consumed validators stay strict)"
    - "Result-object return (PollResult) carrying an aggregated once-per-poll signal, logged once after the loop"

key-files:
  created: []
  modified:
    - packages/core/src/live/suggest.ts
    - packages/core/src/ingest/latest-types.ts
    - packages/core/src/live/poll-latest.ts
    - packages/core/src/index.ts
    - packages/core/test/suggest.test.ts
    - packages/core/test/latest-types.test.ts
    - packages/core/test/poll-latest.test.ts

key-decisions:
  - "KNOWN_LATEST_KEYS derived from latestSetlistRow.shape (Object.keys) rather than a second hand-maintained list — single source of truth, cannot drift (CLAUDE.md: no scattered magic numbers)"
  - "detectNovelKeys runs on the RAW row before parse in pollLatest so an additive key is surfaced even though .catchall keeps the row usable"
  - "Drift is aggregated into a Set across all rows and logged exactly once per poll (key names only, never editor values)"

patterns-established:
  - "Ingress guard once: guardLatestRows is applied by the app upstream of diff/resolve, not embedded inside them"
  - "Lenient-but-detecting schema: tolerate additive keys, detect via schema-derived known-key set, keep consumed-field validation strict"

requirements-completed: [LIVE-01, LIVE-02, LIVE-03]

# Metrics
duration: ~9min
completed: 2026-07-19
---

# Phase 11 Plan 02: Live-Path Correctness (Pure Core) Summary

**Three pure-core live-path fixes: a past-midnight-safe `guardLatestRows` tonight/show filter (LIVE-01), a lenient-but-detecting `latestSetlistRow` + `detectNovelKeys` so one new kglw.net field never empties suggestions (LIVE-03), and a `PollResult`-returning `pollLatest` carrying a once-per-poll drift flag with the `artist_id !== 1` filter locked by a mixed-artist regression test (LIVE-02).**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-19T17:39:00Z
- **Completed:** 2026-07-19T17:44:35Z
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files modified:** 7

## Accomplishments

- **LIVE-01:** `guardLatestRows(rows, TonightGuardInput)` — a cached previous-night `latest` row is dropped before it can leak into suggestions/fill-hints. Bound show → `show_id` identity match; unbound → the show's OWN stored date (never wall-clock, so a past-midnight set is not self-rejected). Pure filter, no sort, empty-in → empty-out.
- **LIVE-03:** `latestSetlistRow` loosened from `z.strictObject` to `z.object(...).catchall(z.unknown())` — an additive API key leaves the row usable. Added `KNOWN_LATEST_KEYS` (derived from the schema's own `.shape`) + `detectNovelKeys(raw)` returning novel key NAMES only. `pollLatest` widened to `PollResult { rows, schemaDrift, novelKeys? }`; drift aggregated across the poll and logged exactly once. Consumed-field validators stay strict (a wrong-typed `song_id` still skips that row).
- **LIVE-02:** Confirmed `pollLatest`'s single-ingress `artist_id !== 1` filter is the sole artist-scope point; added a mixed-artist regression test (KGLW + Stu Mackenzie solo + another act) that locks the invariant. No second filter added.
- Never-throw soft-fail contract (V7) preserved: every soft failure returns `{ rows: [], schemaDrift: false }`, no stack trace surfaced.

## Task Commits

TDD tasks — each a test (RED) then feat (GREEN) commit:

1. **Task 1: guardLatestRows tonight/show guard (LIVE-01)** — `3856686` (test) → `7e3fa43` (feat)
2. **Task 2: lenient schema + detectNovelKeys (LIVE-03 parse)** — `0b0c6f4` (test) → `2b492c1` (feat)
3. **Task 3: pollLatest → PollResult + drift, lock LIVE-02** — `6dfa617` (test) → `746de81` (feat)

## Files Created/Modified

- `packages/core/src/live/suggest.ts` — added `TonightGuardInput` + `guardLatestRows`
- `packages/core/src/ingest/latest-types.ts` — `.catchall(z.unknown())`, `KNOWN_LATEST_KEYS`, `detectNovelKeys`; header rewritten (drift DETECTION, not strict rejection)
- `packages/core/src/live/poll-latest.ts` — `PollResult` type, `pollLatest` returns it, per-row `detectNovelKeys` aggregated + logged once
- `packages/core/src/index.ts` — barrel exports for `guardLatestRows`, `TonightGuardInput`, `detectNovelKeys`, `KNOWN_LATEST_KEYS`, `PollResult`
- `packages/core/test/suggest.test.ts` — 6 `guardLatestRows` cases (bound/unbound/past-midnight/empty/no-sort)
- `packages/core/test/latest-types.test.ts` — additive-key-usable, consumed-field-still-fatal, names-only-detection, KNOWN_LATEST_KEYS coverage
- `packages/core/test/poll-latest.test.ts` — migrated all assertions to `result.rows`; added drift, one-log-discipline, names-only, mixed-artist (LIVE-02), soft-fail cases

## PollResult shape (for 11-04 consumers)

```ts
export interface PollResult {
  rows: LatestSetlistRow[];   // artist-scoped, validated (same content as the old array return)
  schemaDrift: boolean;       // true if any row carried an unknown additive key
  novelKeys?: string[];       // present only when schemaDrift; key NAMES only, never editor values
}
```

**App-tier call sites that must consume `PollResult` in plan 11-04** (the signature change ripples — `npm test` is NOT fully green until 11-04 lands):

- `packages/app/src/**/useLatestPoll.ts` (or equivalent live-poll hook) — read `result.rows`, surface `result.schemaDrift`/`novelKeys` as a one-per-poll drift notice
- `packages/app/src/**/mockLatest.ts` (the `?mockLatest=1` UAT harness) — return/consume the `PollResult` shape
- Any app test asserting on `pollLatest`'s old `LatestSetlistRow[]` return — move to `result.rows`
- **Wire `guardLatestRows` ONCE** upstream of `diffLatestAgainstTrail`/`resolvePlaceholders`, fed by the tracked show's `{ showId, date }` — this is the LIVE-01 fix's app half

## Decisions Made

- `KNOWN_LATEST_KEYS = new Set(Object.keys(latestSetlistRow.shape))` — derived from the schema, not a duplicated list, so the known-key set and the schema can never drift apart.
- `detectNovelKeys` runs on the RAW row before `safeParse` in `pollLatest`, so an additive key is surfaced for the drift signal even though `.catchall` keeps the row usable.
- Drift is aggregated into a `Set<string>` across the whole poll and emitted as a single `console.debug` after the loop — names only, no stack trace (T-11-02-03 / V7).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The pre-existing 11-01 era-prior RED test (`predict.test.ts` Test 10) remains the sole failing core test — expected and out of scope (flipped green by plan 11-03).

## Threat Flags

None — no new security surface beyond the plan's threat model. All three trust-boundary mitigations (artist filter, catchall tolerance + never-throw, names-only drift log) are implemented as specified.

## Next Phase Readiness

- Pure-core live-path fixes complete and green (49 tests across the three plan files; full core suite 317 passed / 1 expected RED). Core typecheck clean; no React/DOM/browser imports added.
- Ready for plan 11-04 to wire `PollResult` + `guardLatestRows` into the app tier (call sites listed above).

## Self-Check: PASSED

- `packages/core/src/live/suggest.ts` — FOUND (`guardLatestRows`, `TonightGuardInput`)
- `packages/core/src/ingest/latest-types.ts` — FOUND (`.catchall`, `KNOWN_LATEST_KEYS`, `detectNovelKeys`)
- `packages/core/src/live/poll-latest.ts` — FOUND (`PollResult`, `Promise<PollResult>`)
- Barrel exports — FOUND (`guardLatestRows`, `TonightGuardInput`, `detectNovelKeys`, `KNOWN_LATEST_KEYS`, `PollResult`)
- Commits `3856686`, `7e3fa43`, `0b0c6f4`, `2b492c1`, `6dfa617`, `746de81` — all present in git log

---
*Phase: 11-live-sync-prediction-correctness*
*Completed: 2026-07-19*
