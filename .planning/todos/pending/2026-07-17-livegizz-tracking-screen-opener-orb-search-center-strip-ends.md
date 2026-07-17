---
created: 2026-07-17T04:50:35.637Z
title: LiveGizz tracking screen — center opener orb, search-to-seed, kill blank strip, End Show in FAB
area: ui
files:
  - packages/app/src/show/CenterNode.tsx
  - packages/app/src/show/OrbitStage.tsx:67-75
  - packages/app/src/live/SuggestionStrip.tsx:125-161
  - packages/app/src/show/FabMenu.tsx
  - packages/app/src/show/ShowView.tsx:300-345
  - packages/app/src/config.ts:333
---

## Problem

Four tweaks to the **LiveGizz** in-show (tracking) screen, most visible in the
**pre-opener** state (active show, no current song yet).

## 1. Center the "Tap the opener" orb (vertically + horizontally)

The pre-opener `CenterNode` is already absolutely centered in the stage
(`OrbitStage.tsx:68` — `absolute inset-0 flex items-center justify-center`), so
it's centered *within the stage*. It looks high because the **blank suggestion
strip** (item 3) shrinks the stage from the bottom, pushing the visual midpoint
up. **Fixing item 3 should center it**; after that change, verify the orb sits at
the true vertical center of the header→tab-bar area (and horizontally, which it
already is).

## 2. Rename "Tap the opener" → "Search for the opener"; tapping opens Search

- Rename `config.copy.show.centerPrompt` (`config.ts:333`) from `"Tap the opener"`
  to `"Search for the opener"`.
- Make the pre-opener `CenterNode` **tappable**: currently it's presentational
  (`CenterNode.tsx:23-31`, a plain dashed pill). In the `songName == null` branch,
  render a `<button>` (keep the dashed-pill look, ≥44px which it has, add an
  `aria-label`) that calls a new `onOpenSearch` prop → opens the existing
  `SearchSheet` (same path as the FAB's Search, which seeds the opener as a
  pre-opener miss, SHOW-04). Thread the callback `ShowView` → `OrbitStage`
  (`OrbitStage.tsx:70`) → `CenterNode`. When `songName != null`, the center node
  stays non-interactive (presentational, unchanged).

## 3. Remove the blank bar above the bottom tabs

That bar is the `SuggestionStrip` (`SuggestionStrip.tsx:125-161`): a FIXED
`config.ui.SUGGESTION_STRIP_HEIGHT` (56px) slot with `border-t border-hairline
bg-elevated`, rendered **even when empty**. The fixed height is deliberate
(SHOW-02: the orbit fan must not re-lay-out when a suggestion appears/dismisses).

- **Recommended (keeps SHOW-02):** when the strip is empty
  (`suggestions.length === 0 && fillHints.length === 0`), render **no visible
  chrome** — drop the `border-t` + `bg-elevated` (transparent), so there's no
  visible "bar", while KEEPING the reserved 56px height so a suggestion appearing
  mid-show still never shifts the orbit. Bonus: the new blurred LiveGizz
  background shows through the bottom cleanly.
- **Alternative (owner may prefer):** collapse the slot to zero height when empty
  to reclaim the vertical space — but then the orbit fan re-lays-out each time a
  suggestion appears/disappears (SHOW-02 regression). Confirm the trade-off before
  choosing this.
- **Coupling:** `FabMenu` bottom offset adds `SUGGESTION_STRIP_HEIGHT`
  (`FabMenu.tsx:75`). If the slot collapses (alternative), drop that term so the
  FAB doesn't float 56px too high; if it just goes transparent (recommended),
  leave the offset as-is.

## 4. Move End Show from the header into the FAB

- Remove the End Show button from the show sub-header (`ShowView.tsx:332-342` —
  the `CircleStop` + `copy.endCta` button). Header right side then holds just
  `SyncDot` + `TallyReadout`.
- Add an **End Show** action to `FabMenu` (`FabMenu.tsx`): new `onEndShow` prop +
  a 6th action row (`CircleStop`, `copy.endCta`). Place it at the **top** of the
  speed-dial (farthest from the thumb) since it's rare + finalizing; the existing
  `EndShowDialog` confirm still gates it (no accidental finalize). Consider a
  subtle destructive tint (`--color-destructive`) vs the neutral rows, owner's
  call — gold stays reserved.
- `ShowView` wires `onEndShow={() => setEndOpen(true)}` into `<FabMenu>`
  (`ShowView.tsx:~373`); `endOpen`/`EndShowDialog` state is unchanged.

## Notes

- Relates to the completed FAB-consolidation (quick task that built `FabMenu`);
  this extends that FAB with End Show.
- Tests: `ShowView`/`FabMenu` tests may assert the header End Show button or the
  strip chrome — update them to the new placement/behavior.

## Acceptance

Pre-opener: a centered pill reading "Search for the opener" that opens Search on
tap; no visible blank bar above the tabs; the orbit fan never re-lays-out when
suggestions toggle; End Show lives in the FAB (not the header) and still confirms
before finalizing. Typecheck + tests + a device/preview look pass.
