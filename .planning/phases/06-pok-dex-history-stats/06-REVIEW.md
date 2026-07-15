---
phase: 06-pok-dex-history-stats
reviewed: 2026-07-15T03:56:23Z
depth: standard
files_reviewed: 56
files_reviewed_list:
  - packages/app/scripts/fetch-covers.ts
  - packages/app/src/App.tsx
  - packages/app/src/components/InstallBanner.tsx
  - packages/app/src/config.ts
  - packages/app/src/db/db.ts
  - packages/app/src/dex/AlbumDetail.tsx
  - packages/app/src/dex/AlbumGrid.tsx
  - packages/app/src/dex/ArchiveBrowser.tsx
  - packages/app/src/dex/CompareView.tsx
  - packages/app/src/dex/DexHeader.tsx
  - packages/app/src/dex/DexView.tsx
  - packages/app/src/dex/RecapView.tsx
  - packages/app/src/dex/SetlistView.tsx
  - packages/app/src/dex/ShareCardSheet.tsx
  - packages/app/src/dex/ShowsList.tsx
  - packages/app/src/dex/SongRow.tsx
  - packages/app/src/dex/TierBadge.tsx
  - packages/app/src/dex/covers.ts
  - packages/app/src/dex/dex-albums-loader.ts
  - packages/app/src/dex/dex-artifacts.d.ts
  - packages/app/src/dex/archive-loader.ts
  - packages/app/src/dex/formatMonYear.ts
  - packages/app/src/dex/rarityIndex.ts
  - packages/app/src/dex/shareCard.ts
  - packages/app/src/dex/useDexStats.ts
  - packages/app/src/pwa/install/useInstallState.ts
  - packages/app/src/settings/SettingsView.tsx
  - packages/app/src/settings/exportDownload.ts
  - packages/app/src/settings/importPicker.ts
  - packages/app/src/show/CenterNode.tsx
  - packages/app/src/show/EndShowDialog.tsx
  - packages/app/src/show/FabMenu.tsx
  - packages/app/src/show/PredictionOrb.tsx
  - packages/app/src/show/ShowView.tsx
  - packages/app/src/show/WhyDetail.tsx
  - packages/app/src/show/orbLabelFit.ts
  - packages/app/vite.config.ts
  - packages/core/src/cli/build-albums.ts
  - packages/core/src/cli/build-archive.ts
  - packages/core/src/cli/refresh.ts
  - packages/core/src/config.ts
  - packages/core/src/data-safety/export-schema.ts
  - packages/core/src/data-safety/merge.ts
  - packages/core/src/data-safety/serialize.ts
  - packages/core/src/dex/albums.ts
  - packages/core/src/dex/archive-types.ts
  - packages/core/src/dex/archive.ts
  - packages/core/src/dex/compare.ts
  - packages/core/src/dex/derive-dex.ts
  - packages/core/src/dex/rarity.ts
  - packages/core/src/dex/recap.ts
  - packages/core/src/dex/recent-shows.ts
  - packages/core/src/dex/search-archive.ts
  - packages/core/src/dex/share-stats.ts
  - packages/core/src/index.ts
  - vitest.config.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-07-15T03:56:23Z
**Depth:** standard
**Files Reviewed:** 56
**Status:** issues_found

## Summary

Phase 6 (Pokédex, History & Stats) is defensively engineered. The trust-boundary
discipline the prompt flagged for special attention holds up under scrutiny:

- **Import fork safety (D-17):** `classifyImport` runs the strict `exportEnvelope`
  gate first, and `CompareView` imports no db-write helper — a friend's file is
  structurally incapable of reaching a merge. Verified sound.
- **XSS:** No `dangerouslySetInnerHTML` anywhere; all kglw/friend-derived strings
  render as escaped React text or canvas `fillText`. No injection surface found.
- **v1→v2 migration & round-trip:** `serializeExport` strips the volatile Dexie
  `++id`; the strict schema `.default(...)` + `MIGRATIONS[1]` bring a genuine v1
  backup forward losslessly; `importSnapshot` commits atomically in one rw
  transaction. The parse→migrate→merge→commit chain is correct.
- **Pure-core determinism:** `deriveDex` / `buildRarityIndex` / `compareDexes`
  use explicit sort comparators and insertion-ordered Maps. Deterministic.

The findings below are concentrated on the merge path (one data-loss invariant
violation that contradicts the code's own D-10 "never drop a local row" claim),
the friend-name UX control, and two loose success-metric / coverage gaps.

## Critical Issues

### CR-01: Same-show dedupe silently drops local sightings, violating the stated D-10 "every local row survives" invariant

**File:** `packages/core/src/data-safety/merge.ts:166-231`

`parseAndMergeImport` first union-merges `trackedEntries` keyed by
`(sessionId, position)` so "every LOCAL row survives (D-10)". The D-11 dedupe that
follows then contradicts that guarantee. For each same-night group it selects a
single canonical show (the one with the most entries) and **discards every other
show's entries entirely**:

```ts
const finalEntries = unionEntries.filter(
  (e) => !droppedSessionIds.has(e.sessionId),
);
```

It never *unions* the entries of same-night shows — it keeps only the fullest
one. Concrete data-loss path (same owner, two devices at one show):

- Device A (local) tracks night D, session `S_A`, songs {1,2,3} (3 entries).
- Device B (import) tracks night D, session `S_B`, songs {4,5,6,7} (4 entries).
- Group key `date:D` has both. Canonical = `S_B` (4 > 3). `S_A` is dropped.
- `importSnapshot` then `clear()`s `trackedEntries` and re-adds only the merged
  set, so local songs {1,2,3} are permanently erased from the dex — even though
  `deriveDex` would otherwise have unioned both sessions' songs for that night.

Because the loser here is the *local* show, the local sightings the merge
promised to preserve are the ones lost, and there is no user-facing indication.
This is on the export/import round-trip integrity path the review was asked to
scrutinize.

**Fix:** For same-night groups, keep one canonical *attendance/show row* but
UNION the entries of every session in the group (re-stamping `sessionId`/
`position` onto the canonical session) instead of dropping the losers' entries.
Sketch:

```ts
// after choosing `canonical` for a group:
const groupSessionIds = new Set(bucket.map((s) => s.sessionId));
let pos = 0;
for (const e of unionEntries) {
  if (!groupSessionIds.has(e.sessionId)) continue;
  // collapse onto the canonical session, de-duping by songId within the night
  mergedEntriesForNight.push({ ...e, sessionId: canonical.sessionId, position: ++pos });
}
```

De-dupe by `songId` within the night so a genuinely-duplicated performance isn't
double-counted, but a *unique* song from either device is never dropped. If the
"fullest wins, drop the rest" behavior is truly intended, the D-10 "every local
row survives" comment (lines 16-17, 119) must be corrected — it is currently
false.

## Warnings

### WR-01: Owner-name input trims on every keystroke — multi-word names cannot be entered

**File:** `packages/app/src/settings/SettingsView.tsx:63-67, 148-149`

The owner-name field is a controlled input whose value is the persisted, trimmed
meta value, and `onChange` persists `value.trim()`:

```ts
const handleOwnerChange = (value: string) => {
  void setMeta("ownerName", value.trim());
};
// ...
value={ownerName ?? ""}
onChange={(e) => handleOwnerChange(e.target.value)}
```

Typing a space produces a value with a trailing space, which `.trim()` removes;
React then resets the DOM input to the pre-space text. The user can never get a
space to "stick", so a display name like `Matt W` or `Anna Marie` is impossible
to enter. Since the D-17 owner name is the fork key for friend-vs-mine
classification (and the label on friends' share cards), this materially degrades
the feature.

**Fix:** Store the raw value and only trim at persistence boundaries that need
it (export stamping, compare matching). E.g.:

```ts
const handleOwnerChange = (value: string) => {
  void setMeta("ownerName", value); // keep raw; schema max(40) is the real clamp
};
```

`classifyImport` already trims + lowercases both sides for comparison, and the
schema `.max(40)` remains the security control, so no comparison logic changes.

### WR-02: Import success counts ignore retro-marked shows/songs — "0 shows added" after a real merge

**File:** `packages/core/src/data-safety/merge.ts:233-243`

`added.shows` / `added.songs` are computed only over `finalShows` (tracked shows)
and `finalEntries` (tracked entries):

```ts
const localGroupKeys = new Set(local.trackedShows.map(attendanceGroupKey));
const addedShows = finalShows.filter((s) => !localGroupKeys.has(...)).length;
const localEntryKeys = new Set(local.trackedEntries.map(entryKey));
const addedSongs = finalEntries.filter((e) => !localEntryKeys.has(...)).length;
```

`attendedShows` (retro marks) and their `archiveShows` setlists are union-merged
but never counted. Importing a backup whose contents are entirely retro-marked
shows reports `"0 shows and 0 songs added. Nothing was removed."` even though it
credited many nights/sightings — a misleading success message on the primary
data-recovery flow.

**Fix:** Fold newly-added `attendedShows` (by `show_id` not present locally) into
`addedShows`, and count the songs their setlists contribute (from `mergedArchive`
+ the bundled archive) into `addedSongs`, or reword the copy to reflect what is
actually counted.

### WR-03: Online fallback only fetches the boundary year + current year, missing intermediate years

**File:** `packages/app/src/dex/ArchiveBrowser.tsx:152-168`

```ts
const currentYear = new Date().getFullYear();
const latestYear = Number.parseInt(archive.latestShowDate.slice(0, 4), 10);
const years = [...new Set([currentYear, latestYear])];
```

Only the corpus-boundary year and the current calendar year are fetched. If the
gap between the bundled corpus (`latestShowDate`, 2025-12-13 as shipped) and the
current year ever exceeds one year — e.g. a stale bundle used in 2027, or a build
carried into a later tour — every intermediate year (2026 here) is unreachable
via the "Search kglw.net for newer shows" fallback, so those shows can't be
retro-marked at all. It happens to work for the summer-2026 first-show case
(`years = [2026, 2025]`) but is fragile.

**Fix:** Enumerate every year in `[latestYear, currentYear]` inclusive:

```ts
const years: number[] = [];
for (let y = latestYear; y <= currentYear; y++) years.push(y);
```

`fetchRecentShows` already filters `show.date <= sinceDate`, so the boundary year
stays de-duplicated against the bundle.

### WR-04: `deriveRecap` new-catch detection re-runs `deriveDex` over the full corpus on every recap render

**File:** `packages/core/src/dex/recap.ts:101-111`

`deriveRecap` computes new catches by running the entire `deriveDex` derivation
on a reduced snapshot. It is memoized in `RecapView`, but `deriveRecap` itself
offers no way to reuse an already-derived `DexStats`, and any caller that invokes
it outside a memo (or the auto-recap on End Show, which mounts fresh) pays a full
corpus rescan. This is a correctness-adjacent robustness concern rather than a
pure perf note: because the "prior" derivation silently includes
`snapshot.attendedShows`, a night that was BOTH live-tracked and retro-marked
(same date/show_id) will report **0 new catches** — the retro mark counts as a
prior sighting of the very songs just played.

**Fix:** Exclude the current night's attendance group (by the same
`attendanceGroupKey`) from the reduced snapshot's `attendedShows`, not just its
`trackedShows`/`trackedEntries`, so a tracked-and-marked night still surfaces its
new catches. Optionally accept a precomputed prior `DexStats` to avoid the second
full pass.

## Info

### IN-01: `serializeExport` performs no length clamp on `owner` before writing

**File:** `packages/core/src/data-safety/serialize.ts:58`

`owner` is passed through verbatim from the DB snapshot. The strict schema clamps
`.max(OWNER_NAME_MAX_LENGTH)` only on *import*. In the normal flow the Settings
input caps at 40, so an export can't exceed it — but if an over-length owner ever
reached the meta row by another path, the resulting backup would be rejected by
its own schema on re-import. Low risk; consider clamping symmetrically at export
for defense-in-depth.

### IN-02: Double `as unknown as` cast defeats type safety on the bundled songs map

**File:** `packages/app/src/dex/ArchiveBrowser.tsx:286, 310`

`archive.songs as unknown as Record<number, string>` relies on JS numeric-key
string coercion to work. It functions but silences the compiler at a real type
boundary. Prefer a small `resolveName` overload that reads `archive.songs[String(id)]`
directly for bundled rows so no cast is needed.

### IN-03: `EndShowDialog` fires `endShow` and `exportBackup` fire-and-forget

**File:** `packages/app/src/show/EndShowDialog.tsx:83-88`

`void endShow(sessionId); void exportBackup();` relies on IndexedDB serializing
the finalize write ahead of the export read (overlapping `trackedShows` scope,
creation-ordered — which does hold here). It is correct today but implicit;
awaiting `endShow` before `exportBackup` would make the "backup reflects the
finalized show" guarantee explicit and robust against future refactors of
`snapshot()`.

---

_Reviewed: 2026-07-15T03:56:23Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
