---
phase: 05-live-sync-data-safety
plan: 06
subsystem: database
tags: [dexie, indexeddb, zod, data-safety, import-export, gap-closure]

# Dependency graph
requires:
  - phase: 05-live-sync-data-safety
    provides: "05-02's parseAndMergeImport union-merge / same-show dedupe and 05-05's importSnapshot Dexie commit, both fixed here"
provides:
  - "id-less trackedEntries merge output keyed only on (sessionId, position)"
  - "local-wins same-show dedupe tie-break (WR-01)"
  - "importSnapshot commits trackedEntries by logical identity (clear + bulkAdd) inside the existing atomic rw transaction"
  - "regression test proving a populated-DB import with overlapping trackedEntry ids preserves every local + incoming row"
affects: [06-explore-mode, 07-show-history-pokedex]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Merge-boundary id stripping: any row carrying a volatile per-device primary key must have that key stripped before it crosses a union-merge boundary — survival identity must be a stable logical key, never the device-local auto-increment id."
    - "Commit-by-logical-identity: when a merged snapshot already contains a full local+incoming union, commit via clear() + bulkAdd() (not bulkPut-by-id) inside the SAME transaction as sibling tables, so id regeneration cannot introduce a partial-write failure mode."

key-files:
  created: []
  modified:
    - packages/core/src/data-safety/merge.ts
    - packages/core/src/data-safety/serialize.ts
    - packages/core/test/merge.test.ts
    - packages/core/test/serialize.test.ts
    - packages/app/src/db/db.ts
    - packages/app/test/exportImportRoundtrip.test.ts

key-decisions:
  - "Strip id via destructuring at the merge-map population point (entriesByKey), not as a later post-process pass, so the id can never leak through an early return path."
  - "WR-01 tie-break implemented via a localSessionIds Set computed once before the canonical-selection loop; a candidate replaces canonical when strictly richer OR tied-and-local, preserving D-11 richer-wins semantics for the non-tie case."
  - "importSnapshot keeps bulkPut for meta/attendedShows/trackedShows (stable primary keys) and switches ONLY trackedEntries to clear()+bulkAdd(), inside the identical rw transaction — no new half-wipe failure mode introduced."
  - "Updated (not preserved verbatim) two pre-existing tests whose assertions were incompatible with the new id-less contract: serialize.test.ts's trackedEntries identity check (now a value-equality check minus id) and exportImportRoundtrip.test.ts's db.trackedEntries.get(1) pin (now resolved by [sessionId+position])."

patterns-established:
  - "Pattern: volatile per-device primary keys must never cross a merge/union boundary — express survival identity as a domain-stable compound key (entryKey = sessionId+position) instead."

requirements-completed: [PWA-04]

# Metrics
duration: 7min
completed: 2026-07-13
---

# Phase 05 Plan 06: Gap Closure — Import Data Loss on Overlapping trackedEntry ids (CR-01) Summary

**Fixed the CR-01 blocker (import into a populated DB silently drops rows on colliding trackedEntry ids) by stripping the volatile Dexie `++id` at the merge boundary and switching `importSnapshot`'s trackedEntries commit from `bulkPut`-by-id to `clear()` + `bulkAdd()` of the id-less union, inside the same atomic transaction; also fixed the WR-01 same-show tie-break to keep the local setlist.**

## Performance

- **Duration:** ~7 min (19:19:36 plan commit -> 19:26:25 last task commit)
- **Started:** 2026-07-13T23:19:36Z
- **Completed:** 2026-07-13T23:26:25Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- `parseAndMergeImport`'s union-merge (`merge.ts`) now strips the device-local `id` from every merged `trackedEntry` — survival is keyed purely on `(sessionId, position)` via `entryKey`, so two devices numbering ids from 1 can never collide downstream.
- Same-show dedupe canonical selection now prefers the LOCAL show on an entry-count TIE (WR-01), fixing a second data-loss path where a local-unique night could be dropped in favor of an identical-size incoming copy.
- `serializeExport` (`serialize.ts`) omits the volatile `id` from every exported `trackedEntry`, so new backups carry no per-device identifier that could collide on a future merge. `export-schema.ts`'s `trackedEntryRow.id` stays `.optional()` so legacy backups with an id still validate.
- `importSnapshot` (`db.ts`) now commits `trackedEntries` via `clear()` + `bulkAdd(id-less rows)` instead of `bulkPut`-by-id, keeping the operation inside the SAME rw transaction as the other three tables' `bulkPut`s — the atomicity control that guarantees a mid-write throw can never leave the dex half-wiped.
- New regression test proves the exact CR-01 scenario: seeding a local show with trackedEntry ids 1,2 (no wipe), importing a friend backup for a different show whose ids also collide at 1,2, and asserting all 4 logical rows survive plus both trackedShows remain.
- Full Vitest suite (`npm test`, root) — 36 test files / 270 tests — passes across both the core (`node`) and app (`jsdom`) projects.

## Task Commits

Each task was committed atomically:

1. **Task 1: Strip the device-local id in merge output and make a same-show tie keep the LOCAL setlist** - `e411ea1` (fix)
2. **Task 2: Commit trackedEntries by logical identity (clear + bulkAdd) atomically in importSnapshot, and update the existing round-trip assertions to match** - `0540dbf` (fix)
3. **Task 3: Regression test — import into a populated DB with OVERLAPPING trackedEntry ids preserves all rows; run full suite** - `c326eb8` (test)

**Plan metadata:** committed separately (see below, worktree-mode metadata commit excludes STATE.md/ROADMAP.md)

## Files Created/Modified

- `packages/core/src/data-safety/merge.ts` — `entriesByKey`/`unionEntries` now populate id-less rows (destructure `id` out); added `localSessionIds` Set and a tied-and-local replacement condition in the same-show canonical-selection loop.
- `packages/core/src/data-safety/serialize.ts` — `serializeExport` maps `trackedEntries` to omit `id` before assembling the envelope.
- `packages/core/test/merge.test.ts` — new describe block "id-less merge output (CR-01 / T-05-07)" (overlapping-id union survival case) and a new WR-01 tie-break test in the same-show-dedupe describe block.
- `packages/core/test/serialize.test.ts` — split the old identity-check test (meta/attendedShows/trackedShows now checked separately) and added two new tests: trackedEntries values pass through minus `id`, and every exported entry omits `id`.
- `packages/app/src/db/db.ts` — `importSnapshot`'s trackedEntries branch: `bulkPut` -> `clear()` + `bulkAdd(...)`, same transaction, updated doc comment.
- `packages/app/test/exportImportRoundtrip.test.ts` — updated the existing re-import round-trip assertion to resolve by `[sessionId+position]` and compare fields excluding `id`; added a new describe block with the populated-DB overlapping-id regression test.

## Decisions Made

- Stripped `id` at the point of `Map` population in `merge.ts` (not via a later post-processing pass over `finalEntries`) so there is no code path where an id could leak through.
- Implemented the WR-01 tie-break with a `localSessionIds` Set computed once outside the per-group loop, and a single combined replacement condition (`a > best || isTieLocalWin`) that preserves the existing D-11 richer-wins behavior for the non-tie case exactly as before.
- Two pre-existing tests needed content changes (not just additions) because their assertions were literally incompatible with the new id-less contract:
  - `serialize.test.ts`'s "carries the four data arrays through verbatim (identity, no mutation)" test asserted `out.trackedEntries` was the SAME array reference as the input — impossible once `serializeExport` maps the array to strip `id`. Split into a meta/attendedShows/trackedShows identity test plus a new trackedEntries value-equality-minus-id test.
  - `exportImportRoundtrip.test.ts`'s "re-imports an exported backup" test asserted `db.trackedEntries.get(1)` — this literal id-1 lookup is no longer valid once `clear()`+`bulkAdd()` lets Dexie assign a fresh id (the id-generator counter isn't reset by `clear()`, and the seeded `put({id:1,...})` already advanced it to 2). Replaced with a resolve-by-`[sessionId+position]` lookup and an id-excluded field comparison, exactly as prescribed in the plan's task 2 `<action>`.
- Both prescribed test changes were explicitly called out in the plan's own task descriptions (task 2's read_first/action sections anticipate this exact test breakage), so these are not undocumented deviations — the plan authors already flagged them as required updates.

## Deviations from Plan

None — plan executed exactly as written, including the two test-assertion updates the plan itself anticipated and prescribed (see Decisions Made above).

## Issues Encountered

- No `node_modules` were present in this worktree checkout (git-worktrees don't carry gitignored directories). Ran `npm install --prefer-offline --no-audit --no-fund` from the workspace root before any verification command; `package-lock.json` was unmodified as a result (dependency set already matched the lockfile), so no lockfile diff was introduced by this plan.
- Vitest's root `test.projects` config doesn't discover test files when invoked from inside a package subdirectory (`cd packages/core && vitest run test/x.test.ts` reports "No test files found") — worked around by running `npx vitest run <path-from-root>` / `npm test` from the repository root instead. This is a pre-existing project/tooling quirk, not something introduced by this plan; documented here only so a future executor doesn't waste time on it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PWA-04 / SC4 / D-10 / T-05-07 "never drop a local row on import" is now genuinely closed: the populated-DB overlapping-id regression test locks in the invariant, and the full 270-test suite is green across both packages.
- WR-01 (same-show tie local-wins) is also fixed in the same pass, closing the second data-loss path flagged in 05-VERIFICATION.md.
- Remaining advisory/deferred items from 05-VERIFICATION.md (WR-02 bound/unbound attendanceGroupKey same-night collapse, WR-04 resolvePlaceholders position alignment, IN-03 file input DOM attach) were explicitly out of scope for this gap plan per its `<scope_note>` and remain open for a future plan — not addressed here, and no code changes were made toward them.

---
*Phase: 05-live-sync-data-safety*
*Completed: 2026-07-13*
