---
phase: 05-live-sync-data-safety
reviewed: 2026-07-13T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - packages/core/src/live/poll-latest.ts
  - packages/core/src/live/suggest.ts
  - packages/core/src/live/bind-show.ts
  - packages/core/src/ingest/latest-types.ts
  - packages/core/src/data-safety/merge.ts
  - packages/core/src/data-safety/serialize.ts
  - packages/core/src/data-safety/export-schema.ts
  - packages/app/src/db/db.ts
  - packages/app/src/live/useLatestPoll.ts
  - packages/app/src/live/useOnlineStatus.ts
  - packages/app/src/live/SuggestionStrip.tsx
  - packages/app/src/live/SyncDot.tsx
  - packages/app/src/show/ShowView.tsx
  - packages/app/src/show/EndShowDialog.tsx
  - packages/app/src/settings/SettingsView.tsx
  - packages/app/src/settings/exportDownload.ts
  - packages/app/src/settings/importPicker.ts
  - packages/app/src/routing/useHashRoute.ts
  - packages/app/src/components/AppMenu.tsx
  - packages/app/src/App.tsx
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 5 wires live `latest` polling, editor-suggestion advisories, guarded auto-bind,
and the export/import backup path. The poll-lifecycle work (`useLatestPoll`) is careful
and well-tested: single self-scheduling timer, correct active/online/visible gating,
unmount cleanup, and error tolerance all hold up. The core "never-throw" poller
(`pollLatest`) and the pure decision fns (`diffLatestAgainstTrail`, `resolvePlaceholders`,
`bindShowFromLatest`) are sound. The strict-schema import gate correctly rejects bad
files before any DB touch.

However, the **import/merge → commit path has a critical data-loss defect**: merged
`trackedEntries` are committed by their device-local `++id` auto-increment key, which is
NOT globally unique across devices. A friend-import (the entire reason this phase exists)
collapses colliding ids in `bulkPut`, silently dropping both local and incoming rows.
The round-trip test misses this because it always imports into a wiped database. This
directly violates the phase's stated invariant that the merge path must never drop local
data, and must be fixed before this ships. Four warnings concern merge tie-break /
dedupe correctness, a re-nagging one-time warning, and position-aligned fill hints.

## Critical Issues

### CR-01: Import merge drops entries via colliding device-local `++id` keys (silent data loss)

**File:** `packages/app/src/db/db.ts:418-432` (with `packages/core/src/data-safety/merge.ts:131-135` and `export-schema.ts:63`)

**Issue:** `trackedEntries` are unioned by the logical key `(sessionId, position)` in core
(`entryKey`, merge.ts:51-53), so two entries from different devices correctly coexist in
the merged snapshot. But each entry still carries its original `id` — the Dexie `++id`
auto-increment key, which every device assigns independently starting at 1. `importSnapshot`
commits via `db.trackedEntries.bulkPut(snapshot.trackedEntries)`, and `bulkPut` is an
upsert **by primary key (`id`)**. When the merged array contains multiple rows with the
same `id` (local `id:1` for session A, incoming `id:1` for session B), `bulkPut`
silently overwrites — last-write-wins — dropping the earlier row, and also clobbering any
pre-existing local row that happened to hold that id.

Concrete failure: local has entries `id 1,2,3`; a friend's genuinely-distinct show is
imported with entries `id 1,2,3`. The union keeps all 6 rows (6 distinct `(sessionId,
position)` keys), but `bulkPut` sees ids `[1,2,3,1,2,3]` and persists only 3 — a mix of
local and incoming rows is destroyed. This breaks the D-10 / T-05-07 "never drop a local
row" guarantee that is the entire point of the union merge.

The `exportImportRoundtrip.test.ts` suite does not catch this because it always wipes the
DB before importing (`wipeAll()` then import into an empty table), so ids never collide
across sources — the real friend-merge scenario is untested.

**Fix:** Do not carry the device-local `++id` across a merge. Reconcile ids against the
existing local rows by the logical `(sessionId, position)` key, or strip `id` from every
merged entry so Dexie assigns fresh keys, committing by the logical identity instead of
the auto-increment key. For example, drop `id` in the merge output and make
`importSnapshot` replace `trackedEntries` by clearing + re-adding, or reassign ids before
`bulkPut`:

```ts
// In merge.ts, key entries only by (sessionId, position) and strip the volatile id:
const finalEntries = unionEntries
  .filter((e) => !droppedSessionIds.has(e.sessionId))
  .map(({ id: _id, ...rest }) => rest); // let Dexie assign fresh ids on commit
```

…and change `importSnapshot` to replace the `trackedEntries` table wholesale (clear then
`bulkAdd` the id-less merged rows) inside the same transaction, so the logical
`(sessionId, position)` identity — not a per-device counter — determines row survival.
Add a regression test that imports into a NON-empty DB whose ids overlap the incoming file.

## Warnings

### WR-01: Same-show dedupe tie-break drops the LOCAL setlist in favor of incoming

**File:** `packages/core/src/data-safety/merge.ts:159-180`

**Issue:** In the same-show collapse, the canonical (surviving) show is chosen by entry
count, but on a tie the loop keeps `bucket[0]`. The bucket is built from
`[...showsBySession.values()]` where incoming rows are inserted first (merge.ts:126-129),
so `bucket[0]` is the **incoming** show. When local and incoming both logged the same
number of entries for the same night, the tie resolves to incoming and every LOCAL entry
for that night is dropped (`finalEntries` filters out `droppedSessionIds`, merge.ts:178-180).
Since the two devices may have caught different songs, local-unique catches vanish — the
opposite of the D-10 "local always survives" priority.

**Fix:** Break ties toward the local session. Track which sessionIds came from `local`
and prefer them when entry counts are equal:

```ts
const localSessions = new Set(local.trackedShows.map((s) => s.sessionId));
// ...on a tie, prefer a local sessionId as canonical over an incoming one.
```

### WR-02: Dedupe fails to collapse a night when one copy is bound and the other is not

**File:** `packages/core/src/data-safety/merge.ts:45-48, 149-155`

**Issue:** `attendanceGroupKey` returns `id:${showId}` for a bound show and `date:${date}`
for an unbound one. If the same physical night was auto-bound on one device (online during
the show) but stayed provisional on the other (offline all night — a realistic split for a
venue), the two copies get different group keys and are never collapsed. The result is two
attendance records for one night (double-counted dex/tally), defeating D-11. This is not
data loss, but it is a correctness gap in the dedupe the phase promises.

**Fix:** When grouping, treat a bound and an unbound copy sharing the same `date` as the
same night — e.g. group primarily by `date`, then reconcile `showId` within the date
bucket, rather than letting the presence of a binding change the grouping key.

### WR-03: One-time persist-denied warning re-shows on every EndShow reopen within a session

**File:** `packages/app/src/show/EndShowDialog.tsx:44-69, 110`

**Issue:** `showPersistWarning` is component state that is set `true` the first time the
sheet opens with persistence denied, and the meta flag `persistWarningShown` is written so
it "never nags again." But EndShowDialog stays mounted across open/close toggles
(`open` prop, not remount). On a subsequent open the effect reads `alreadyShown === true`
and early-returns **without resetting `showPersistWarning`**, so the state remains `true`
and the warning renders again on every reopen for the rest of the app session. The
"one-time" contract only holds across full app restarts, not within a session.

**Fix:** Reset the flag at the start of the effect and let the async check turn it back on:

```ts
useEffect(() => {
  if (!open) return;
  setShowPersistWarning(false); // default hidden; the async check re-enables once
  let cancelled = false;
  void (async () => { /* ...unchanged... */ })();
  return () => { cancelled = true; };
}, [open]);
```

### WR-04: `resolvePlaceholders` aligns editor GLOBAL position to local TRAIL position

**File:** `packages/core/src/live/suggest.ts:96-113` (consumed at `ShowView.tsx:260-267`)

**Issue:** A FillHint is emitted when a placeholder trail entry's `position` equals a
latest row's `position` (`row.position === entry.position`). But the trail `position` is a
device-local contiguous 1..N sort key (`db.ts:100`), while the latest row `position` is
the kglw editor's global setlist position. These align only when the user logged every
song in lockstep with the editor. Any divergence — a late start, a skipped song, a `???`
inserted out of band — offsets them, so the fill hint can name the WRONG song for a
placeholder. It is advisory and user-gated (Pencil tap), which caps the blast radius, but
it can actively mislead the fill.

**Fix:** Match placeholders on a more robust signal than raw positional equality — e.g.
align by relative order within the set, or only offer a fill when the surrounding
non-placeholder entries corroborate the position mapping. At minimum, document the
alignment assumption at the call site so the fragility is explicit.

## Info

### IN-01: Dead fallback branch in `handleFill`

**File:** `packages/app/src/show/ShowView.tsx:263-265`

**Issue:** `entry.shownFanSongIds ? classifyOutcome(...) : entry.outcome` — `shownFanSongIds`
is a required `number[]` and is always truthy (even when empty `[]`), so the `: entry.outcome`
branch is unreachable dead code.

**Fix:** Drop the ternary and call `classifyOutcome(hint.songId, entry.shownFanSongIds)`
directly.

### IN-02: Advisory dismissal keyed by `songId` only, ignoring fill-hint identity

**File:** `packages/app/src/show/ShowView.tsx:252-273`, `packages/app/src/live/SuggestionStrip.tsx:107,146-158`

**Issue:** `dismissedIds` is a `Set<number>` of song ids, and both `visibleSuggestions` and
`visibleFillHints` filter by `songId`. A fill hint carries a distinct `entryPosition`
(its React key is `f-${songId}-${entryPosition}`), but dismiss only receives `songId`.
Dismissing a suggestion also hides any fill hint with the same song id, and vice-versa —
and two fill hints for the same song at different placeholder positions cannot be
dismissed independently. Low likelihood, but the dedupe key is weaker than the render key.

**Fix:** Key dismissals by the same compound identity the rows are keyed by (song id +
kind + entryPosition), or track dismissed suggestions and fill hints in separate sets.

### IN-03: File-picker `<input>` never attached/removed; may misbehave and leaks

**File:** `packages/app/src/settings/importPicker.ts:65-78`

**Issue:** `openBackupFilePicker` creates a detached `<input type="file">`, calls `.click()`
without appending it to the DOM, and never removes it. Unlike the export anchor (which is
appended and removed), the input is never cleaned up, and click-without-DOM-attachment is
unreliable on some mobile browsers (the primary target). Minor, but inconsistent with the
export path's handling.

**Fix:** Append the input to `document.body` before `.click()` and remove it after the
change/cancel resolves, mirroring `exportDownload.ts`.

### IN-04: Duplicate `useOnlineStatus` subscription

**File:** `packages/app/src/show/ShowView.tsx:84` and `packages/app/src/live/useLatestPoll.ts:51`

**Issue:** `ShowView` calls `useOnlineStatus()` for the SyncDot/offline line, and
`useLatestPoll` independently calls `useOnlineStatus()` again. Two `useSyncExternalStore`
subscriptions to the same `online`/`offline` events. Harmless (both return identical
state) but redundant.

**Fix:** Pass the already-computed `online` into `useLatestPoll` if a single subscription
is preferred; otherwise leave as-is (cost is negligible).

---

_Reviewed: 2026-07-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
