---
phase: 12-data-safety-integrity
reviewed: 2026-07-19T21:20:05Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - packages/core/src/data-safety/attendance-key.ts
  - packages/core/src/data-safety/merge.ts
  - packages/core/src/dex/derive-dex.ts
  - packages/core/test/merge.test.ts
  - packages/core/test/dex/derive-dex.test.ts
  - packages/app/src/components/BackupToast.tsx
  - packages/app/src/App.tsx
  - packages/app/src/show/EndShowDialog.tsx
  - packages/app/test/endShowDialog.test.tsx
  - packages/app/src/config.ts
  - packages/app/src/settings/triggerDownload.ts
  - packages/app/src/settings/exportDownload.ts
  - packages/app/src/dex/shareCard.ts
  - packages/app/test/triggerDownload.test.tsx
  - packages/app/test/shareCard.test.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-07-19T21:20:05Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the Phase 12 data-safety/integrity slice: the shared `attendanceKey`, the pure `parseAndMergeImport` pipeline, `deriveDex`, and the app-tier download/backup/share plumbing plus their tests.

The core merge and dex derivation are carefully built and well-tested against the stated data-loss invariants (D-10 "local survives", D-11 same-show collapse, D-01 doubleheader preservation). No BLOCKER-level correctness, data-loss, or security defects were found — the union-merge never deletes a local row, the JSON import is `try`-guarded and zod-gated with no injection surface, and canvas/anchor draws use `fillText`/`download` (no HTML/eval sink).

Three WARNING-level defects were found: (1) the import success metric `added.songs` overcounts songs that both devices logged when the incoming copy wins canonical; (2) the one-time persist-denied warning in `EndShowDialog` is consumed the instant the dialog is *opened* (even on "Keep tracking"), spending the safety nudge without the user ever ending a show or exporting; and (3) that same warning re-appears on every reopen within a single mount because its state is never reset. Plus three INFO items.

No `<structural_findings>` block was provided, so there is no fallow substrate to reconcile.

## Warnings

### WR-01: `added.songs` overcounts cross-device duplicate songs when the incoming copy wins canonical

**File:** `packages/core/src/data-safety/merge.ts:241-298`
**Issue:** The success-copy metric is provenance-based to avoid counting a re-stamped *local* sighting as "added" (comment at L293-295). But the inverse case is unhandled. When a song is logged on **both** devices for the same night and the **incoming** session becomes canonical, the local copy is dropped during adoption (`if (nightSongIds.has(e.songId)) continue;` L252) and the incoming copy survives in `finalEntries`. Because that surviving entry is incoming-origin, it is **not** in `localOriginEntries`, so `addedSongs = finalEntries.filter((e) => !localOriginEntries.has(e)).length` (L296-298) counts it as newly added — even though the user's local dex already contained that song.

Concretely, for the existing test fixture "does NOT double-count a song both devices logged" (`merge.test.ts:400`): local `{1,2}`, incoming `{2,3,4}`, canonical = incoming. The dex correctly holds `{1,2,3,4}`, but `added.songs` computes **3** (songs 2,3,4) when the user only truly gained **2** (songs 3,4 — song 2 was already local). The count that drives `importSuccessBody(shows, songs)` ("N songs added. Nothing was removed.") is inflated by the number of cross-device shared songs where the incoming copy won. This undercuts the phase's "honest numbers" throughline. Note the test asserts the song *set* but never asserts `added.songs`, so the inaccuracy is untested.
**Fix:** Base the added-songs metric on the set of songIds newly present rather than surviving-entry provenance. For example, compute the set of local songIds per attendance group up front and count only `finalEntries` whose `(group, songId)` was absent locally, or track adopted/kept provenance by songId within the night rather than by object identity:
```ts
// Build local per-night songId sets keyed by attendanceKey, then:
const addedSongs = finalEntries.filter((e) => {
  if (e.songId == null) return !localOriginEntries.has(e); // placeholders: keep object-identity rule
  const key = /* attendanceKey of e's canonical show */;
  return !localSongIdsByGroup.get(key)?.has(e.songId);
}).length;
```
Add an assertion on `result.added.songs` to the shared-song test to lock the corrected behavior.

### WR-02: one-time persist-denied warning is consumed on dialog *open*, not on a meaningful action

**File:** `packages/app/src/show/EndShowDialog.tsx:58-77`
**Issue:** The `PERSIST_WARNING_SHOWN` meta flag is written (`await setMeta(PERSIST_WARNING_SHOWN, true)`, L69) the moment the End-Show sheet **opens** and the warning is displayed — before the user does anything. If the user opens End Show, reads the warning, and taps "Keep tracking" (`onClose`, which does **not** finalize or export), the one-time safety budget is permanently spent. The next time they actually finalize a show with unprotected storage, no warning appears and no inline Export is offered. For a data-safety phase whose entire point is nudging the user to export before eviction, spending the single warning on a cancelled dialog defeats its purpose.
**Fix:** Persist the "shown" flag only after the user commits to an action that makes the warning meaningful — e.g., set it inside `handleConfirm` after `endShow` resolves, or when the inline Export button is tapped — not on mere display. Keep the in-memory `showPersistWarning` state for the current open, but defer the durable `setMeta` write.

### WR-03: persist-denied warning re-renders on every reopen within a single mount

**File:** `packages/app/src/show/EndShowDialog.tsx:52,58-77,116`
**Issue:** `showPersistWarning` is only ever set to `true` (L69) and never reset to `false`. The effect early-returns once `alreadyShown` is true (L64), so on a second open within the same mount it does not re-evaluate — but the state variable is still `true` from the first open, so the warning block (L116) renders again. Contradicts the "at most once" intent: open End Show (warning shows, flag set) → "Keep tracking" → reopen → warning shows again despite the flag already being persisted. (This mount-scoped reopen is reachable precisely because "Keep tracking" leaves `EndShowDialog` mounted.)
**Fix:** Reset the transient state when the sheet closes so the meta flag is the sole gate:
```ts
useEffect(() => {
  if (!open) { setShowPersistWarning(false); return; }
  // ...existing decision logic
}, [open]);
```

## Info

### IN-01: throwaway dev harness ships in the production bundle

**File:** `packages/app/src/App.tsx:8,42-50`
**Issue:** `OrbFitHarness` is statically imported and rendered whenever `location.hash === "#/dev/orb-fit"`. The comment marks it "THROWAWAY … REMOVE POST-PHASE," yet it is bundled and reachable in any production build via URL hash. It only exposes already-bundled public catalog names (no data/security risk), but it is dead weight and an unintended route. Outside the Phase 12 data-safety scope, but present in a reviewed file.
**Fix:** Gate the import/branch behind `import.meta.env.DEV`, or remove it now that the phase it supported is complete.

### IN-02: same-night reprise of a song is silently collapsed on merge

**File:** `packages/core/src/data-safety/merge.ts:241-254`
**Issue:** Adoption de-dupes by `songId` within a night using a single `Set` (`nightSongIds`). If a non-canonical session legitimately logged the same `songId` twice in one night (a reprise/medley — which King Gizzard does), the second performance is dropped. This is consistent with `deriveDex`'s Set-based per-night union (so the dex count is unaffected), and matches the documented "de-duped by songId within the night" design — flagged only so the intentional loss of repeat-performance metadata is on record.
**Fix:** None required if the Set-per-night model is the accepted contract. If repeat performances ever need to survive in the exported trail, key the night dedupe on `(songId, position-ish)` rather than `songId` alone.

### IN-03: `deriveDex` counts setlist-less attendances in `showCount`, affecting `personalGap` denominators

**File:** `packages/core/src/dex/derive-dex.ts:152-168,203`
**Issue:** A retro-marked or tracked show with no resolvable setlist (absent from both the bundled archive and the `archiveShows` cache — e.g. a post-corpus show before its cache lands) still creates a timeline night with an empty `songIds` set and increments `showCount`. `personalGap = showCount - 1 - lastSeenIndex` then includes these empty nights in the denominator, so a gap can grow for a night about which nothing is actually known. Likely acceptable (the user did attend), but noted since it slightly shifts a user-facing stat based on data availability rather than attendance.
**Fix:** If undesired, exclude empty-songId nights from `showCount`/timeline, or document that gap counts every attended night regardless of setlist resolution.

---

_Reviewed: 2026-07-19T21:20:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
