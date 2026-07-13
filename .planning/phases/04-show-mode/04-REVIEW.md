---
phase: 04-show-mode
reviewed: 2026-07-13T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - packages/app/src/db/db.ts
  - packages/app/src/config.ts
  - packages/app/src/show/scoring.ts
  - packages/app/src/show/orbitLayout.ts
  - packages/app/src/show/confidence.ts
  - packages/app/src/show/matrix.ts
  - packages/app/src/show/showContext.ts
  - packages/app/src/show/tuningColor.ts
  - packages/app/src/show/useShowSession.ts
  - packages/app/src/show/ShowView.tsx
  - packages/app/src/show/OrbitStage.tsx
  - packages/app/src/show/CenterNode.tsx
  - packages/app/src/show/PredictionOrb.tsx
  - packages/app/src/show/WhyDetail.tsx
  - packages/app/src/show/PreShowLauncher.tsx
  - packages/app/src/show/ActionBar.tsx
  - packages/app/src/show/SearchSheet.tsx
  - packages/app/src/show/CometTrail.tsx
  - packages/app/src/show/TallyReadout.tsx
  - packages/app/src/show/TrailNodeSheet.tsx
  - packages/app/src/show/EndShowDialog.tsx
  - packages/app/src/show/WakeLockNotice.tsx
  - packages/app/src/wakeLock.ts
  - packages/app/src/App.tsx
  - packages/app/src/components/AppShell.tsx
  - packages/app/src/show/matrix-artifact.d.ts
  - packages/app/vite.config.ts
  - packages/core/src/search/search-catalog.ts
  - packages/core/src/config.ts
  - packages/core/src/index.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues
---

# Phase 4: Code Review Report

**Reviewed:** 2026-07-13
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Phase 4 (Show Mode) is overwhelmingly clean UI wiring over the frozen core, and the
high-risk areas the brief called out are handled correctly: XSS-safety of user/kglw
strings is solid (every song name and `reason` renders as React text; no
`dangerouslySetInnerHTML` anywhere), core purity is intact (`search-catalog.ts` imports
only `fuse.js` + core config, zero DOM/React), the `currentSongId: null` guard genuinely
prevents `null` reaching the core predictor (`useShowSession.ts:108`), and the Wake Lock
false-positive verification (`sentinel.released`) matches the iOS < 18.4 pitfall.

However there is **one BLOCKER**: the write-through position assignment (`logSong`) uses
`count + 1`, which silently produces duplicate `position` values once any mid-trail entry
is deleted — corrupting setlist ordering and the derived "current song," which in turn
feeds wrong predictions. Three warnings cover an honest-tally gap on edit, an invalid
nested-interactive-element DOM/a11y defect on the orb, and a once-per-show notice that
degrades to once-per-app-session.

## Critical Issues

### CR-01: `logSong` assigns duplicate `position` after a mid-trail delete → corrupts ordering and current-song selection

**File:** `packages/app/src/db/db.ts:199-208`
**Issue:** `logSong` computes the new entry's `position` as `count + 1`, where `count` is
`db.trackedEntries.where("sessionId").equals(sessionId).count()`. The compound index
`[sessionId+position]` (line 122) is **not** unique (no `&`), and `deleteEntry`
(line 240 — the D-15 confirm-gated older-trail-node delete) removes an arbitrary entry by
id and leaves a `position` gap by design (acknowledged at line 77). After such a delete,
`count` no longer equals the maximum position, so the next `logSong` reuses an
already-occupied position with no error thrown.

**Failure scenario:** User logs songs at positions 1..5, then taps trail node #2 and
confirms delete → remaining positions `[1,3,4,5]`, `count = 4`. Next logged song gets
`position = count + 1 = 5`, colliding with the existing position-5 entry. Now
`sortBy("position")` yields `[1,3,4,5,5]` with unspecified order between the two 5s.
`useShowSession` derives the center via
`entries.filter(e => e.songId != null).at(-1)` (`useShowSession.ts:82-86`), so the orbit
can recenter on the *wrong* song and generate predictions from the wrong current song.
`undoLast` (which also relies on `sortBy("position").at(-1)`) can then delete the wrong
entry. This is silent data corruption of the very setlist SHOW-11 promises to preserve.

**Fix:** Derive the next position from the maximum existing position, not the count, inside
the same transaction:
```typescript
export async function logSong(
  sessionId: string,
  entry: Omit<TrackedEntry, "id" | "sessionId" | "position" | "setNumber">,
): Promise<number> {
  return db.transaction("rw", db.trackedShows, db.trackedEntries, async () => {
    const show = await db.trackedShows.get(sessionId);
    if (!show) throw new Error(`No tracked show for sessionId ${sessionId}.`);
    const existing = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .sortBy("position");
    const nextPosition = (existing.at(-1)?.position ?? 0) + 1;
    return db.trackedEntries.add({
      ...entry,
      sessionId,
      position: nextPosition,
      setNumber: show.currentSetNumber,
    });
  });
}
```
Optionally make the index unique (`&[sessionId+position]`) so any future regression fails
loudly instead of corrupting silently.

## Warnings

### WR-01: Editing a real entry via `renameEntry` never re-classifies `outcome` → dishonest tally

**File:** `packages/app/src/show/TrailNodeSheet.tsx:47-52` (and `packages/app/src/db/db.ts:245-255`)
**Issue:** `handlePick` routes BOTH the "Name this song" (??? placeholder) and the "Edit"
(correct a mis-logged real entry) paths through `renameEntry(id, songId, songName)`, which
updates `songId`/`songName`/`isPlaceholder` but leaves `outcome` and `shownFanSongIds`
untouched. For a normal entry that was logged as a `hit`, editing it to a different song
keeps the `hit` even though the corrected song may never have been in that moment's shown
fan. The tally (SHOW-09) is the app's core trust metric, so this silently over-credits hits.

**Failure scenario:** User taps the wrong orb and logs "Robot Stop" as a hit. They later tap
the trail node → Edit → pick "Rattlesnake", which was NOT in that fan. The entry stays
`outcome: "hit"`, inflating the hit rate dishonestly.

**Fix:** On the edit path, re-derive the outcome against the entry's stored fan:
```typescript
const handlePick = (selection: SearchSelection) => {
  if (entry.id != null) {
    const outcome = classifyOutcome(selection.songId, entry.shownFanSongIds);
    void renameEntry(entry.id, selection.songId, selection.songName, outcome);
  }
  close();
};
```
Extend `renameEntry` to accept and persist the recomputed `outcome`. (The ??? → real rename
correctly stays a miss because a `???` placeholder's fan is empty per D-08 — pass its
recomputed outcome too and it remains a miss.)

### WR-02: Interactive `Info` control nested inside the orb `<button>` — invalid DOM + a11y defect

**File:** `packages/app/src/show/PredictionOrb.tsx:47-91`
**Issue:** The orb face is a `<button>` (line 47) and the "why" affordance is a
`<span role="button" tabIndex={0} onClick/onKeyDown>` nested *inside* it (lines 72-90). The
HTML spec forbids interactive content as a descendant of `<button>`; browsers may reparent
or drop the inner element, and assistive tech sees a button-inside-button, which is a known
WCAG name/role/value violation. The `stopPropagation` only tames React's synthetic bubbling
— it does not make the nesting valid.

**Failure scenario:** On some engines the nested control's layout/hit-testing is unreliable,
and screen-reader users get an ambiguous/duplicated control; the D-11 requirement that the
Info dot be a *separate* affordance from the logging tap is compromised.

**Fix:** Do not nest. Make the orb face a non-button clickable container (e.g. a `<div
role="button" tabIndex={0}>` with keyboard handlers) and render a real sibling `<button>` for
the Info dot, or position an absolutely-placed sibling `<button>` outside the face button so
the two are siblings, not ancestor/descendant.

### WR-03: Wake-lock "once per show" notice degrades to once per app session

**File:** `packages/app/src/show/ShowView.tsx:59-78`
**Issue:** `wakeDismissedRef` (line 60) and `wakeNoticeVisible` (line 59) are never reset
when a show ends and a new one starts. Because `ShowView` stays mounted across the
end-show → pre-show → start-show transition (App.tsx keeps `#/show` mounted;
`session.active` merely toggles), the ref persists. After a user dismisses the notice during
night 1, night 2 will never show the wake-lock-unsupported notice even though SHOW-12 / D-09
specify it is a *once-per-show* signal.

**Failure scenario:** Friend on a pre-18.4 installed iOS PWA dismisses the "keep your screen
on manually" notice on night 1, ends the show, starts night 2 on the same app session; the
screen silently dims mid-set with no warning — exactly the failure mode SHOW-12 exists to
prevent.

**Fix:** Reset the dismiss state when a new active session begins, e.g. key the reset off
`session.active?.sessionId`:
```typescript
useEffect(() => {
  wakeDismissedRef.current = false;
  setWakeNoticeVisible(false);
}, [session.active?.sessionId]);
```

## Info

### IN-01: `OrbitStage` re-runs `selectFan`/`isWeakFan` on data already reduced in `useShowSession`

**File:** `packages/app/src/show/OrbitStage.tsx:56-57`
**Issue:** `useShowSession` already computes `fan = selectFan(candidates)` and
`isWeakFan(candidates)` and exposes them on the session (`useShowSession.ts:127-133`).
`ShowView` passes the already-selected `session.fan` into `OrbitStage`, which then calls
`selectFan(candidates)` and `isWeakFan(candidates)` a second time. The double `selectFan` is
idempotent today (the second pass re-slices an already-clamped list to the same length), so
there is no current behavioral bug — but it is duplicated selection logic across two files
with two sources of truth that could diverge if `selectFan`'s clamping rules change.
**Fix:** Have `OrbitStage` render the fan/weak flag it is given (pass `isWeak` and the fan as
props) rather than recomputing, so selection lives in exactly one place.

### IN-02: Search-seeded opener is always recorded as a miss

**File:** `packages/app/src/show/ShowView.tsx:139-149`
**Issue:** The opener is seeded via `handleSearchSelect`, which logs `outcome: "miss"`. This
is endorsed by D-08/research (no fan existed, so nothing predicted it), but it means the
tally denominator always starts with a guaranteed miss at position 1, slightly depressing the
displayed hit rate for the whole show. Documented here only so it is a conscious choice, not
an oversight.
**Fix:** None required if D-08 semantics are intended. If the opener should be tally-neutral,
consider excluding the pre-opener seed from the denominator (an explicit
`outcome`/`countsTowardTally` distinction) — a Phase 5/6 decision, not a Phase 4 defect.

---

_Reviewed: 2026-07-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
