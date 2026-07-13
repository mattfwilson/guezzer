---
phase: 05-live-sync-data-safety
plan: 02
subsystem: database
tags: [zod, export-import, json-backup, merge, dexie, data-safety]

# Dependency graph
requires:
  - phase: 05-live-sync-data-safety (Plan 05-03)
    provides: Dexie v3 schema + row shapes (TrackedShow venue binding fields, TrackedEntry.source) that the export envelope mirrors, and importSnapshot atomic-write seam
provides:
  - Strict versioned D-09 export envelope zod schema (exportEnvelope + ExportEnvelope type)
  - Pure serializeExport(snapshot, schemaVersion) assembler (ExportSnapshot type)
  - parseAndMergeImport(rawJson, local, currentSchemaVersion) — atomic validate→migrate→union-merge→same-show-dedupe (ImportResult type)
affects: [05-05, settings-ui, pokedex, export-import]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strict zod strictObject as import trust-boundary gate (prototype-pollution defense)"
    - "Enum-pinned row schemas mirroring db.ts closed vocabularies to preserve Table<> assignability across the core/app boundary"
    - "Pure in-memory validate→migrate→merge→dedupe pipeline; the DB write is a separate atomic seam (app tier)"
    - "Forward-migration chain indexed by source schema version, wired empty at v1 for future slot-in"

key-files:
  created:
    - packages/core/src/data-safety/export-schema.ts
    - packages/core/src/data-safety/serialize.ts
    - packages/core/src/data-safety/merge.ts
    - packages/core/test/serialize.test.ts
    - packages/core/test/merge.test.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "meta merges LOCAL-wins on key collision — device-local settings are not portable"
  - "Same-show dedupe keeps the richer setlist (most entries) as canonical and drops the duplicate night's entries — never double-counts"
  - "Reject a backup whose schemaVersion exceeds the current app version rather than risk a silent field-meaning mis-merge"

patterns-established:
  - "Import validation rejects the whole file on first failure (JSON syntax or shape) — never a partial merge (D-12)"
  - "Union-merge by stable identity keys (show_id / sessionId / (sessionId,position) / meta key) guarantees no local-only row is ever dropped (D-10)"

requirements-completed: [PWA-04]

# Metrics
duration: 12min
completed: 2026-07-13
---

# Phase 5 Plan 02: Data-Safety Export/Import Core Summary

**Pure, zero-DOM export/import core: a strict versioned D-09 zod envelope, a pure `serializeExport` assembler, and a `parseAndMergeImport` that validates→migrates→union-merges (never dropping local data)→same-show-dedupes atomically in memory.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-13T21:54:00Z
- **Completed:** 2026-07-13T22:00:08Z
- **Tasks:** 2
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- D-09 export envelope as a strict zod schema with enum-pinned `status`/`currentSetNumber`/`setNumber`/`outcome`/`source` mirroring db.ts closed vocabularies, keeping the inferred types assignable to `Table<TrackedShow>`/`Table<TrackedEntry>` (guards Plan 05-03/05-05 `tsc --noEmit`).
- Pure `serializeExport` producing exactly the six D-09 keys and round-tripping through `exportEnvelope.parse`.
- `parseAndMergeImport`: JSON.parse in try/catch (T-05-05) → strict `exportEnvelope` gate (T-05-06) → forward-migration chain → union-merge → same-show dedupe, all in memory with no DB touch (Pitfall 5).
- D-10 guaranteed: union by stable keys never drops a local-only row; meta is local-wins on collision.
- D-11 guaranteed: a night tracked on two devices (same `show_id`, or same date when both unbound) collapses to ONE attendance keeping the richer setlist; the duplicate's entries are dropped so nothing is double-counted (T-05-07).
- D-12 guaranteed: malformed JSON, shape mismatches, unknown top-level keys, and newer-version backups are all rejected whole with a clear message and no partial merge.

## Task Commits

Each task was committed atomically:

1. **Task 1: Export envelope schema + pure serializeExport** - `de165f1` (feat)
2. **Task 2: parseAndMergeImport — validate, migrate, union-merge, dedupe** - `ff98b9a` (feat)

_Note: MVP mode (tdd_mode false) — test files ship inside each task's single commit rather than a separate RED commit._

## Files Created/Modified
- `packages/core/src/data-safety/export-schema.ts` - Strict zod row schemas + `exportEnvelope` strictObject and `ExportEnvelope` type (D-09).
- `packages/core/src/data-safety/serialize.ts` - `ExportSnapshot` interface + pure `serializeExport` assembler.
- `packages/core/src/data-safety/merge.ts` - `ImportResult` type + `parseAndMergeImport` five-step atomic pipeline and the empty-at-v1 `MIGRATIONS` chain.
- `packages/core/src/index.ts` - Barrel re-exports of `exportEnvelope`, `serializeExport`, `parseAndMergeImport` and their types for the Settings UI (Plan 05-05).
- `packages/core/test/serialize.test.ts` - 11 tests: six-key D-09 shape, verbatim pass-through, ISO stamp, strict-reject, enum-reject for all four pinned unions.
- `packages/core/test/merge.test.ts` - 12 tests: malformed/shape/unknown-key/future-version rejection, D-10 local-preservation (shows/meta/entries), D-11 dedupe (bound and unbound), distinct-night non-collapse, identity migration, added-metrics.

## Decisions Made
- **meta local-wins on collision** — device-local settings (theme, wake-lock toggles) are not portable across a friend's import.
- **Richer-setlist-wins dedupe** — within a same-night group the show with the most tracked entries becomes canonical; the other members' entries are dropped by their (dropped) sessionId so the honest tally never double-counts.
- **Reject future-schema backups** — a `schemaVersion > current` file is refused (beyond what strictObject already catches) to avoid silently mis-merging fields whose meaning may have changed.

## Deviations from Plan

None affecting code. One test-invocation note (not a deviation in behavior):

- The plan's verify command `cd packages/core && npx vitest run test/serialize.test.ts` does not resolve under the root `test.projects` config (Vitest 4 removed workspace files; the core project is defined in the root `vitest.config.ts`). Tests were run from the repo root as `npx vitest run serialize` / `npx vitest run merge` and via `--project @guezzer/core` for the full suite. Same tests, same green result — no code impact.

## Issues Encountered
- To keep Task 1's commit `tsc`-clean and atomic, the `merge.ts` barrel export line was withheld from `index.ts` in Task 1 (merge.ts did not yet exist) and added in Task 2. Both task commits typecheck independently.

## Threat Surface Scan
No new security-relevant surface beyond the plan's `<threat_model>`. The import trust boundary (T-05-05/06/07) is the only boundary and is fully mitigated: JSON.parse guarded, strict schema gate, stable-key union with same-show dedupe. No new network endpoints, auth paths, or file access.

## Known Stubs
None. `MIGRATIONS` is intentionally empty at schema v1 (the chain is wired and identity-tested so future versions slot in) — this is the designed v1 state, not an unfinished stub.

## Verification
- `npx vitest run serialize` → 11 passed.
- `npx vitest run merge` → 12 passed.
- Full core suite (`--project @guezzer/core`) → 159 passed (17 files).
- `packages/core` `tsc --noEmit` → clean.
- `packages/app` `tsc --noEmit` → clean (confirms the enum-pinned envelope types stay assignable to `Table<TrackedShow>`/`Table<TrackedEntry>`, the cross-plan contract for 05-03/05-05).

## Self-Check: PASSED
- FOUND: packages/core/src/data-safety/export-schema.ts
- FOUND: packages/core/src/data-safety/serialize.ts
- FOUND: packages/core/src/data-safety/merge.ts
- FOUND: packages/core/test/serialize.test.ts
- FOUND: packages/core/test/merge.test.ts
- FOUND: commit de165f1
- FOUND: commit ff98b9a

## Next Phase Readiness
- The Settings UI (Plan 05-05) can now import `serializeExport`, `exportEnvelope`, and `parseAndMergeImport` from `@guezzer/core` and wire them to the DOM download/upload and the existing `db.importSnapshot` atomic write.
- `ImportResult.added.{shows,songs}` is ready to drive the success copy; `ImportResult.error` drives the rejection copy.

---
*Phase: 05-live-sync-data-safety*
*Completed: 2026-07-13*
