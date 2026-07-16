---
phase: 07-explore-mode-constellation
reviewed: 2026-07-16T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - packages/app/src/App.tsx
  - packages/app/src/config.ts
  - packages/app/src/explore/ConstellationCanvas.tsx
  - packages/app/src/explore/ExploreFilterFab.tsx
  - packages/app/src/explore/ExploreFilterPanel.tsx
  - packages/app/src/explore/ExploreView.tsx
  - packages/app/src/explore/NodeSheet.tsx
  - packages/app/src/explore/RankedBar.tsx
  - packages/core/src/config.ts
  - packages/core/src/explore/derive-constellation.ts
  - packages/core/src/explore/rank-outgoing.ts
  - packages/core/src/explore/rotation.ts
  - packages/core/src/index.ts
  - packages/core/test/explore/derive-constellation.test.ts
  - packages/core/test/explore/rank-outgoing.test.ts
  - packages/core/test/explore/rotation.test.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-07-16
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 7 builds the Explore Mode constellation: three pure-core derivations
(`deriveConstellation`, `rankOutgoing`, `rotationSongIds` + the `edgesAtThreshold`
helper) and an app-side canvas render surface (`ConstellationCanvas`), filter FAB,
ranked-bars `NodeSheet`, and dex overlay. The core purity constraint holds — the
three derivations have zero React/DOM imports and read only injected data. The
security posture is clean: every kglw-derived song name reaches the screen either
as escaped React text (`RankedBar`, `NodeSheet`) or via `ctx.fillText` on the
canvas (`ConstellationCanvas`), never `innerHTML`/`dangerouslySetInnerHTML`; there
is no `eval`, no dynamic URL/path construction, and the view is pure read/derive/
render with no Dexie writes. Config mirroring between `packages/app/src/config.ts`
and `packages/core/src/config.ts` (BARS_TOP_N=10, ROTATION_WINDOW_SHOWS=5,
EDGE_* bounds) is internally consistent — no drift bug.

No BLOCKER-severity defects were proven. The findings are correctness/robustness
edge cases (camera-vs-focus interaction on resize, rotation tie-break determinism)
and accessibility/quality gaps (keyboard-inaccessible sheet dismissal, a covered
FAB, a dead exported helper). Null/undefined guards, division-by-zero guards
(`total ? ... : 0`), and the `fromId`/`toId` mutation-safety discipline (Pitfall 1)
are all correctly applied.

## Warnings

### WR-01: NodeSheet has no keyboard/AT-accessible dismissal or focus-clear path

**File:** `packages/app/src/explore/NodeSheet.tsx:130-159`, `packages/app/src/explore/ExploreView.tsx:159-162`
**Issue:** The sheet can only be dismissed by a pointer drag on the `<header>`
grab surface (`onPointerDown/Move/Up`), and focus can only be cleared by an
`onBackgroundClick` on the canvas. There is no close button, no `Escape` handler,
and the grab handle is a non-focusable `<div>`/`<header>`. A keyboard or
screen-reader user can Tab into the `RankedBar` buttons and chain-hop, but has no
way to close the `role="dialog"` sheet or clear the focused node — the constellation
canvas itself is not keyboard-reachable. Grep confirms zero `onKeyDown`/`Escape`
handlers anywhere under `packages/app/src/explore`.
**Fix:** Add a keyboard-operable dismissal, e.g. an Escape listener while the sheet
is mounted plus a visually-hidden close button:
```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [onClose]);
```
Consider also a focusable close control (`<button aria-label={copy.close}>`) in the
header so the dismiss affordance isn't pointer-only.

### WR-02: Resize/orientation change while a node is focused snaps the camera off the focused node

**File:** `packages/app/src/explore/ConstellationCanvas.tsx:180-192, 251-270, 482-501`
**Issue:** The charge/link force effect (line 180) re-runs on `size.width/size.height`
change and calls `fg.d3ReheatSimulation()`. Because every node is pinned (`fx/fy`
set at `onEngineStop`), the reheat settles quickly and fires `onEngineStop` again,
which unconditionally calls `zoomToFit(...)`. When this happens while `focusId` is
set (e.g. the user rotates the phone with the NodeSheet open), the fit override runs
after the focus-camera effect and re-frames the whole connected/visible set, pulling
the viewport off the focused node — the opposite of the D-13 "focused node sits at
FOCUS_TARGET_TOP_FRACTION" contract. The focus-camera effect (line 251) does re-run
on `size.height`, but `onEngineStop` fires asynchronously afterward and wins.
**Fix:** Guard `zoomToFit` in `onEngineStop` so it only frames on the initial settle,
not on post-focus reheats:
```tsx
onEngineStop={() => {
  for (const raw of graphData.nodes) { const n = raw as FgNode; n.fx = n.x; n.fy = n.y; }
  if (focusId != null) return; // a focused reheat must not steal the camera
  fgRef.current?.zoomToFit(/* ... */);
}}
```
(Track "has fit once" in a ref if you also want to suppress refit on every resize.)

### WR-03: rotationSongIds tie-breaks equal dates by array order — the exact Pitfall-5 nondeterminism it claims to defend against

**File:** `packages/core/src/explore/rotation.ts:18-21`
**Issue:** The comparator `(a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)`
returns `0` for two shows with the same `date`, so `.sort()` falls back to the
archive's array order for ties. When same-date shows straddle the `slice(0, N)`
window boundary, *which* same-date show is included becomes archive-order-dependent —
precisely the "silently read a different show if ordering changes" failure the
docstring says it prevents. Real corpus dates are usually unique so the practical
risk is low, but the invariant the function advertises is not actually guaranteed.
**Fix:** Add a deterministic secondary key (e.g. show `id`) to the comparator:
```ts
.sort((a, b) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id,
)
```

### WR-04: NodeSheet occludes the ExploreFilterFab while a node is focused

**File:** `packages/app/src/explore/ExploreView.tsx:189-209`, `packages/app/src/explore/ExploreFilterFab.tsx:50-57`, `packages/app/src/explore/NodeSheet.tsx:135`
**Issue:** Both the FAB (`fixed z-30`, `bottom: calc(... + 64px + 8px)`, right-anchored)
and the NodeSheet (`fixed inset-x-0 bottom-0 z-30`, peek height = 40% of viewport,
full width) share `z-30`. The sheet is rendered later in `ExploreView`'s JSX, so it
paints on top, and its 40%-of-viewport peek covers the FAB's ~72px bottom offset.
Result: once a node is focused, the filter controls (view toggle, edge slider, dex
overlay) are unreachable until the user dismisses the sheet — which per WR-01 is
itself pointer-only. The two primary interaction surfaces of the view fight for the
same corner.
**Fix:** Either lift the FAB above the sheet (`z-40` on the FAB and/or offset it above
the current sheet height) or intentionally suppress the FAB while a node is focused so
the interaction model is explicit rather than an accidental overlap.

## Info

### IN-01: Exported, tested `edgesAtThreshold` is dead in the app; the predicate is re-implemented inline

**File:** `packages/core/src/explore/derive-constellation.ts:87-92`, `packages/app/src/explore/ConstellationCanvas.tsx:454-458`
**Issue:** `edgesAtThreshold` is exported from the core barrel and covered by
`derive-constellation.test.ts`, but the app never imports it (grep finds it only
inside a code comment in `ConstellationCanvas.tsx`). The canvas instead inlines
`l.count >= edgeThreshold` in `linkVisibility`. The array-returning helper and the
per-link predicate can't literally be the same call, but the threshold comparison is
duplicated and the exported function is currently unused product code.
**Fix:** Either drop the export (keep it as an internal test-only helper) or refactor
the shared predicate into a single `edgeAtThreshold(l, t)` used by both the array
filter and the canvas `linkVisibility`, so the `>=` rule has one home.

### IN-02: Unused `_cfg` parameter in deriveConstellation

**File:** `packages/core/src/explore/derive-constellation.ts:55-58`
**Issue:** `deriveConstellation(matrix, _cfg = config)` never reads `_cfg`. The
docstring frames it as forward-compat scaffolding, and the `_` prefix signals
intent, but it is dead surface today.
**Fix:** Acceptable as-is given the stated convention; drop the parameter if the
config-driven derivation isn't imminent, to keep the signature honest.

### IN-03: Focus camera never restores zoom/center on defocus

**File:** `packages/app/src/explore/ConstellationCanvas.tsx:251-270, 459-461`
**Issue:** Focusing a node eases the camera to `FOCUS_ZOOM_K` and re-centers it, but
`onBackgroundClick` / clearing `focusId` only removes the dim — the effect early-returns
when `focusId == null` and never zooms back out. The user is left magnified on the
former focus with no automatic return to the settled overview.
**Fix:** On `focusId → null`, ease back toward the settled frame (re-run `zoomToFit`
with the same duration/padding, or cache and restore the pre-focus zoom/center).

### IN-04: role="dialog" without focus management

**File:** `packages/app/src/explore/NodeSheet.tsx:130-143`
**Issue:** The sheet declares `role="dialog" aria-modal={false}` but does not move
focus into the sheet on open or return it on close, and (per WR-01) exposes no
focusable dismiss control. `aria-modal={false}` is the correct honest choice for a
non-modal peek, but AT users get an announced dialog they cannot enter or leave by
keyboard.
**Fix:** Pair with the WR-01 Escape/close-button fix; optionally move focus to the
sheet header (a focusable element) on open and restore focus to the previously
focused node/control on close.

---

_Reviewed: 2026-07-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
