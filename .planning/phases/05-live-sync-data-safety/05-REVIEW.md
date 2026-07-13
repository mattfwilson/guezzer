---
phase: 05-live-sync-data-safety
reviewed: 2026-07-13T23:35:25Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - packages/core/src/data-safety/merge.ts
  - packages/core/src/data-safety/serialize.ts
  - packages/core/test/merge.test.ts
  - packages/core/test/serialize.test.ts
  - packages/app/src/db/db.ts
  - packages/app/test/exportImportRoundtrip.test.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
---

# Phase 05: Code Review Report (scoped re-review — gap-closure plan 05-06)

**Reviewed:** 2026-07-13T23:35:25Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Post-review fix (2026-07-13, same session)

CR-01 below (orphaned duplicate `trackedShows` row on a D-11 dedupe
collapse) has been **fixed**: `importSnapshot` (`packages/app/src/db/db.ts`)
now does `trackedShows.clear()` + `bulkPut()` (full-replace), mirroring the
`trackedEntries` treatment, inside the same rw transaction. A new regression
test in `exportImportRoundtrip.test.ts` ("a same-show dedupe collapse removes
the dropped local trackedShow instead of leaving an orphaned duplicate")
seeds a local show sharing a `show_id` with a richer incoming show and
asserts the dropped local session is removed, not left behind — verified to
fail against the pre-fix `bulkPut`-only code. Full suite (271 tests) and
`tsc --noEmit` pass. `findings.critical` above has been updated to 0 to
reflect this; the WARNING (missing DB-level dedupe-collapse test coverage)
is resolved by the same new test. The remaining open item is the INFO
NUL-byte note, which is optional/non-blocking and pre-existing from plan
05-02.

## Scope note

This is a scoped re-review covering ONLY the 6 files touched by gap-closure
plan 05-06 (fixing the original CR-01 id-collision data-loss bug and WR-01
same-show tie-break bug from the prior full Phase-5 review). It supersedes
the CR-01 and WR-01 entries in that prior review — both are confirmed FIXED
below. The remaining findings from the original full review (WR-02, WR-03,
WR-04, IN-01 through IN-04), which concern files outside this file list
(`suggest.ts`, `ShowView.tsx`, `EndShowDialog.tsx`, `SuggestionStrip.tsx`,
`useLatestPoll.ts`, `useOnlineStatus.ts`, `importPicker.ts`), were **not**
re-assessed in this pass and should be treated as still open until a review
covering those files says otherwise.

## Summary

The CR-01 fix is correct and well tested: `merge.ts` now keys
`trackedEntries` identity purely on `(sessionId, position)` via `entryKey`,
strips the volatile `id` from both sides of the union before it ever reaches
the caller, `serialize.ts` mirrors the same stripping on export, and
`db.ts`'s `importSnapshot` commits `trackedEntries` via `clear()` +
`bulkAdd()` inside the same `rw` transaction as the other three tables'
`bulkPut`s, preserving the D-12 no-partial-merge guarantee. The WR-01
tie-break in `merge.ts` is also correct: tracing the pairwise comparison
across a bucket confirms a genuine entry-count tie always resolves to a
local session as canonical, regardless of `Map` iteration/insertion order.
Both are backed by tests that would have failed against the pre-fix code
(`merge.test.ts`'s CR-01 and WR-01 blocks, `serialize.test.ts`'s id-omission
tests, and the new populated-DB describe block in
`exportImportRoundtrip.test.ts`).

However, while fixing CR-01 the plan surfaced — but did not fix — a sibling
defect in the same function: the D-11 same-show dedupe that WR-01 lives
inside of can drop a `trackedShows` row that already exists locally, but
`importSnapshot` commits `trackedShows` via plain `bulkPut` (upsert-only),
which never deletes it. That produces an orphaned, zero-entry duplicate
attendance record after exactly the "friend sends a richer backup for a
night I already partially tracked" scenario this feature exists to handle.
See CR-01 below (new numbering, this report). No test in the reviewed suite
exercises the full merge+persist path for a dedupe-collapsing import against
a non-empty local DB, so this gap was not caught (see WR-01 below).

## Critical Issues

### CR-01: Same-show dedupe drops a duplicate `trackedShow` from the merged snapshot, but `importSnapshot` never deletes the pre-existing local row — orphaned duplicate attendance

**File:** `packages/app/src/db/db.ts:428-443` (in conjunction with `packages/core/src/data-safety/merge.ts:174-200`)

**Issue:**
`parseAndMergeImport`'s D-11 same-show dedupe (`merge.ts:174-194`)
intentionally excludes the losing show's `sessionId` from `finalShows` and
its entries from `finalEntries` when two `trackedShows` rows collapse into
one canonical attendance. That in-memory computation is correct.

But `importSnapshot` commits `trackedShows` with a plain `bulkPut`:

```ts
// db.ts:436-440
await db.meta.bulkPut(snapshot.meta);
await db.attendedShows.bulkPut(snapshot.attendedShows);
await db.trackedShows.bulkPut(snapshot.trackedShows);
await db.trackedEntries.clear();
await db.trackedEntries.bulkAdd(snapshot.trackedEntries);
```

`bulkPut` is an upsert by primary key: it only writes the rows present in
`snapshot.trackedShows`. It does **not** delete a `sessionId` that already
exists in the table but is absent from the merged array. `trackedEntries`
was correctly changed to `clear()` first (full-replace semantics) as part of
this same gap-closure plan, but `trackedShows` was left as upsert-only —
even though the D-11 dedupe can, and routinely will in exactly the scenario
this plan targets, drop a `sessionId` that pre-exists in the local DB.

Concretely: the local device already tracked a show (`sessionId: "dev-a"`,
`showId: 999`, 1 entry). It imports a friend's richer backup for the same
show (`sessionId: "dev-b"`, `showId: 999`, 2 entries). The merge correctly
computes `finalShows = [dev-b]` and `finalEntries` containing only `dev-b`'s
songs. `importSnapshot` then:
- `trackedEntries.clear()` + `bulkAdd([dev-b's 2 entries])` — `dev-a`'s
  entries are gone, as intended.
- `trackedShows.bulkPut([dev-b])` — `dev-b` is written, but `dev-a`'s
  pre-existing row is **never touched or removed**.

Result: the DB ends up with TWO `trackedShows` rows for the same night
(`dev-a`, now with zero surviving entries, and `dev-b` with 2) — the exact
outcome D-11 exists to prevent ("collapses a night tracked on two devices…
into ONE attendance", `merge.ts:15-16`). Since a `TrackedShow` row's mere
existence credits dex attendance (`db.ts:63-64`, "DEX-01/D-02"), the user's
Pokédex/dex would show a phantom duplicate attended night with an empty
setlist after every import that dedupes away a locally-tracked show. This
isn't limited to the WR-01 tie case — it fires whenever the incoming copy
is *strictly richer* too, which is the common real case this whole plan is
built for.

**Fix:** Give `trackedShows` the same full-replace treatment as
`trackedEntries`. Unlike `trackedEntries`, `trackedShows`' primary key
(`sessionId`) is stable across devices, so there's no need to strip/
regenerate it — `clear()` + `bulkPut` (not `bulkAdd`) is sufficient and
keeps the commit shape simple:

```ts
await db.meta.bulkPut(snapshot.meta);
await db.attendedShows.bulkPut(snapshot.attendedShows);
await db.trackedShows.clear();
await db.trackedShows.bulkPut(snapshot.trackedShows);
await db.trackedEntries.clear();
await db.trackedEntries.bulkAdd(snapshot.trackedEntries);
```

(Equivalently, have `parseAndMergeImport` return `droppedSessionIds` in
`ImportResult` and have the caller `bulkDelete` them before the
`trackedShows.bulkPut` — more surgical, but `clear()`+`bulkPut` is simpler
and keeps `importSnapshot` self-contained since `merged.trackedShows` is
already the full authoritative replacement set.)

## Warnings

### WR-01: No test exercises the D-11 dedupe-collapse path through the real DB (`importSnapshot`/`pickAndImport`), only through the pure `parseAndMergeImport` function

**File:** `packages/app/test/exportImportRoundtrip.test.ts` (whole file); compare `packages/core/test/merge.test.ts:181-276`

**Issue:** `merge.test.ts` thoroughly covers the WR-01 tie-break and D-11
same-show collapse at the pure-function level (`parseAndMergeImport`'s
return value), and those tests are good — they would fail against the
pre-fix tie-break. But `exportImportRoundtrip.test.ts`'s new describe block
("import into a populated DB with overlapping ids preserves every local +
incoming row") only exercises the *non-colliding-identity* union case (two
distinct shows, two distinct dates/`showId`s — no dedupe triggered). No test
in the reviewed files seeds a real local `trackedShow` in the DB, imports a
backup that dedupe-collapses against it, and asserts on the resulting
`db.trackedShows` table contents/count. That gap is precisely why CR-01
above was not caught by the test suite despite the merge logic itself being
correct.

**Fix:** Add a test to `exportImportRoundtrip.test.ts` per the scenario
described in CR-01's fix section — seed a local show sharing a `showId` (or
date) with an incoming, richer show, import via `pickAndImport`, and assert
`db.trackedShows.count() === 1` and that the dropped local `sessionId` is
absent from the table (not merely that the merged in-memory result is
correct).

## Info

### IN-01: `entryKey` embeds a literal NUL byte (U+0000) as its field separator instead of a visible delimiter

**File:** `packages/core/src/data-safety/merge.ts:51-53`

**Issue:** `` `${e.sessionId} ${e.position}` `` — confirmed via byte
inspection that the character between the two interpolations is `0x00`
(NUL), not a printable space/pipe/colon. This works correctly today (the
full test suite passes, and a NUL byte is exceedingly unlikely to appear
inside a `crypto.randomUUID()`-derived `sessionId`), and per the review
brief this is a pre-existing quirk from plan 05-02, not a regression
introduced by 05-06 — noted here only because it was independently spotted
while tracing `entryKey`'s role in the CR-01 fix.

**Fix (optional, non-blocking):** Replace the NUL byte with an explicit
visible separator (e.g. `` `${e.sessionId}::${e.position}` ``) for
readability and defensive clarity; behavior is unchanged since `sessionId`
values can't currently contain the separator either way.

---

_Reviewed: 2026-07-13T23:35:25Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
