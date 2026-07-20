---
phase: 13-interface-explore-polish
reviewed: 2026-07-19T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - packages/app/src/config.ts
  - packages/app/src/dex/RecapView.tsx
  - packages/app/src/explore/ConstellationCanvas.tsx
  - packages/app/src/styles.css
  - packages/app/src/wakeLock.ts
  - packages/app/test/explore/filterFabLift.test.tsx
  - packages/app/test/wakeLock.test.ts
  - packages/core/src/live/suggest.ts
  - packages/core/test/suggest.test.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-07-19
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 13 bundles four polish fixes: UX-01 safe-area de-doubling (styles.css / RecapView),
UX-02 wake-lock End-Show race (wakeLock.ts), UX-03 fill-hint interval anchoring
(core/suggest.ts), and UX-04 constellation camera resize preservation (ConstellationCanvas.tsx).
Two of the four are solid. The wake-lock in-flight-release fix is correct and well-tested,
and the safe-area de-doubling is verified — all seven top-anchored surfaces self-apply
`calc(env(safe-area-inset-top) + Npx)`, so removing the body-level `padding-top` will not
un-inset any surface.

The two graph/derivation fixes carry defects worth addressing. UX-04's re-fit gate is
built on a premise that does not hold in this codebase — `graphData` never rebuilds on a
Rotation↔Full view switch (that switch is a `visibleNodeIds` draw-gate), so the re-arm
effect is effectively dead and its comments are misleading. UX-04 also threads
`visibleViewportHeight` into the camera effect for iOS-keyboard handling but never uses it
in the off-screen math. UX-03's interval resolver is correct in its "never a wrong hint"
contract, but silently disables itself entirely when a song repeats within a show.

No blockers. Three warnings and one info item below.

## Warnings

### WR-01: UX-04 re-fit gate rests on a false premise — `graphData` does not rebuild on a view switch

**File:** `packages/app/src/explore/ConstellationCanvas.tsx:259-261, 771-780`
**Issue:**
The re-arm effect and its supporting comments assert that a Rotation↔Full view switch
"rebuilds graphData":

```ts
// ...a genuine view switch (Rotation ↔ Full catalog) rebuilds graphData and
// legitimately warrants a fresh fit — arm the first-settle gate. Keyed STRICTLY on [graphData]...
useEffect(() => {
  firstSettleRef.current = true;
}, [graphData]);
```

But in `packages/app/src/explore/ExploreView.tsx:73-76`, `graphData` is
`useMemo(() => deriveConstellation(result.matrix), [result])` — keyed only on the loaded
matrix. The view switch does **not** touch `graphData`; it flips
`visibleNodeIds = view === "rotation" ? rotationSet : null`
(`ExploreView.tsx:167`), a pure draw-gate. `graphData` is therefore referentially stable
for the entire session.

Consequences:
- The reset effect fires exactly once (at mount), redundant with `firstSettleRef`'s initial
  `true`. It is effectively dead code — it never re-arms the gate during normal use.
- The documented "a real view switch gets a fresh fit" never occurs. A view switch also
  never reheats the sim (the spacing effect is keyed `[graphData, size.width, size.height]`,
  none of which change), so `onEngineStop` never fires and no re-fit happens either way.

This is harmless to the actual UX-04 goal (a resize no longer yanks the camera — that path
works, because a resize does change `size.*`, reheats, settles, and the gate is already
`false`). But the reset effect and the `prev.graphData !== graphData` term in `isFreshFrame`
(line 374) are dead, and a maintainer trusting the comments will assume a re-fit-on-view-switch
that does not exist.

**Fix:** Either delete the dead reset effect and correct the comments to state that
`graphData` is session-stable and the gate is armed only for the single initial fit, or — if
a fresh fit on view switch is actually wanted — re-arm the gate on the real trigger
(`visibleNodeIds` identity) instead of `graphData`:

```ts
// If re-fit-on-view-switch IS desired, key on the draw-gate that actually changes:
useEffect(() => {
  firstSettleRef.current = true;
}, [visibleNodeIds]);
// (and note this only re-fits if the view switch also reheats — currently it does not,
//  so a manual fgRef.current?.zoomToFit(...) on view change would be required instead.)
```

### WR-02: `visibleViewportHeight` is a vestigial dep — the off-screen test uses the container box, not the visible viewport

**File:** `packages/app/src/explore/ConstellationCanvas.tsx:395-407`
**Issue:**
`visibleViewportHeight` (from `useVisibleViewportHeight`, which tracks
`visualViewport.height`) is added to the focus-camera effect deps specifically to react to
an iOS keyboard show/hide (the one event that changes `visualViewport` but not the container
box). But the off-screen determination never reads it — the bottom/right edges use
`size.height` / `size.width` (the full container):

```ts
const screen = fg.graph2ScreenCoords(node.x, node.y);
const offscreen =
  screen.x < -margin || screen.y < -margin ||
  screen.x > size.width + margin || screen.y > size.height + margin;
```

On iOS the keyboard shrinks only `visualViewport`, leaving `size.height` unchanged, so a
focused node hidden **behind** the keyboard (screen.y between `visibleViewportHeight` and
`size.height`) is judged "on-screen" and never panned into the visible band. The dependency
re-runs the effect but cannot change the outcome — it is inert for the case it was added for.

Practical severity is limited because the Explore view has no text input — its only control
is a `type="range"` slider (`ExploreFilterPanel.tsx:104-106`), which summons no keyboard — so
in this view the keyboard case does not arise today. That makes the dep pure dead weight now
and a latent incorrectness if a text field is ever added to a focused-node sheet.

**Fix:** Use the visible height for the bottom edge of the off-screen box (and drop the
unused width term or keep it consistent), or remove `visibleViewportHeight` from the deps if
keyboard occlusion is explicitly out of scope for Explore:

```ts
const visibleBottom = Math.min(size.height, visibleViewportHeight);
const offscreen =
  screen.x < -margin || screen.y < -margin ||
  screen.x > size.width + margin || screen.y > visibleBottom + margin;
```

### WR-03: `resolvePlaceholders` silently disables all fill-hints when a song repeats within the show

**File:** `packages/core/src/live/suggest.ts:172-192`
**Issue:**
`editorIndexBySongId` records only the **first** occurrence of each `song_id`
(lines 173-176), and the anchor loop suppresses everything on any non-strictly-increasing
editor index:

```ts
const editorIdx = editorIndexBySongId.get(e.songId);
if (editorIdx === undefined || editorIdx <= lastEditorIdx) {
  return []; // suppress everything
}
```

If a song is played (and logged) twice in one show — a reprise, which King Gizzard does — the
second logged anchor resolves to the same first-occurrence editor index as the first, so
`editorIdx <= lastEditorIdx` trips and the function returns `[]`. The same happens if the
**editor** repeats a song and the user logs the later occurrence, because the anchor still
maps to the earlier index. The effect: every fill-hint for the rest of the show goes dark,
with no partial fallback, until the duplicate is removed from the trail.

This honors the "no hint beats a wrong hint" contract (it errs safe), but it's an easy,
realistic trigger that silently kills a whole feature. It is untested — the suite covers
absent/out-of-order anchors but not a legitimate in-show repeat.

**Fix:** At minimum, document the limitation at the call site and add a regression test so
the behavior is intentional and visible. Better, degrade gracefully: only suppress the
interval(s) touched by the ambiguous repeat rather than the entire result — e.g. resolve
anchors greedily to the next unused editor index ≥ `lastEditorIdx` instead of always the
first occurrence, so a reprise no longer forces global suppression:

```ts
// track consumed editor indices and pick the next occurrence >= lastEditorIdx
const occ = new Map<number, number[]>(); // song_id -> ascending editor indices
rows.forEach((r, i) => { (occ.get(r.song_id) ?? occ.set(r.song_id, []).get(r.song_id)!).push(i); });
// ...then for each anchor, choose the smallest index in occ[songId] that is > lastEditorIdx.
```

## Info

### IN-01: UX-04 comments repeatedly overstate what rebuilds `graphData`

**File:** `packages/app/src/explore/ConstellationCanvas.tsx:178-193, 252-261, 767-770`
**Issue:** Several comment blocks describe a Rotation↔Full switch as a `graphData` rebuild
("a genuine Rotation ↔ Full-catalog view switch", "a real view switch rebuilds graphData").
As established in WR-01, view switching is a `visibleNodeIds` draw-gate and never rebuilds
`graphData`. The comments are internally consistent with each other but not with
`ExploreView`, so they mislead about the module's actual data flow.
**Fix:** Reword to reflect that `graphData` is session-stable (only a matrix reload rebuilds
it) and that view switches are draw-gate-only; this also clarifies why the resize fix is
safe (frozen fx/fy survive because nothing rebuilds).

---

_Reviewed: 2026-07-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
