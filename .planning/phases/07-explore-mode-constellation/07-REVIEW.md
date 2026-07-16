---
phase: 07-explore-mode-constellation
reviewed: 2026-07-16T22:51:20Z
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
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-07-16T22:51:20Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the Phase-7 Explore constellation slice: three pure core derivations
(`deriveConstellation`, `rankOutgoing`, `rotationSongIds`) plus their tests, and the
app-tier render/interaction layer (canvas, filter FAB/panel, node sheet, ranked bars,
`ExploreView` orchestration). Also spot-checked the two `config.ts` files and the core
barrel.

Overall the code is careful, well-typed, and defensive: the core functions correctly read
immutable `fromId`/`toId` copies (Pitfall 1), handle zero-outgoing and empty-archive edge
cases without throwing, sort deterministically, and hold to the pure-core/no-DOM boundary.
Song names reach the canvas via `ctx.fillText` and reach the DOM via React text only — no
`innerHTML`/`eval`/injection surface. React hooks are all called unconditionally before the
early return. No security vulnerabilities, crashes, or data-loss paths were found —
**no BLOCKER-tier findings.**

The defects that remain are maintainability and silent-degradation risks: an unenforced
app↔core config mirror that can drift, a couple of silent-fallback data-integrity gaps, and
several stale docstrings that describe now-live controls as inert.

## Warnings

### WR-01: App/core config mirror has no drift enforcement

**File:** `packages/app/src/config.ts:227-265` (and `packages/core/src/config.ts:290-329`)
**Issue:** Five Explore constants (`BARS_TOP_N`, `ROTATION_WINDOW_SHOWS`,
`EDGE_COUNT_THRESHOLD_DEFAULT`, `EDGE_SLIDER_MIN`, `EDGE_SLIDER_MAX`) plus
`dex.OWNER_NAME_MAX_LENGTH` are duplicated between `packages/app/src/config.ts` and
`packages/core/src/config.ts`, each annotated "MIRRORS ... the two MUST stay equal." No
test or type binds them — no app or core test asserts equality (`packages/core/test/*`
never imports the app config; `packages/app/test/` only touches `settingsOwner`). This is a
real drift-to-bug path, not just cosmetics: e.g. if `core.dex.OWNER_NAME_MAX_LENGTH` is
lowered but the app `maxLength` is not, the Settings input accepts a name the core schema
then hard-rejects at import, and a legitimate backup fails to merge. CLAUDE.md's
single-source-of-truth ethos is only partially honored — core's `config` is simply not
re-exported from the barrel (`packages/core/src/index.ts`), which is what forced the copy.
**Fix:** Either re-export the pure constants from `@guezzer/core` and import them app-side
(preferred — kills the copy), or add a cross-package test that imports both configs and
asserts each mirrored key is equal, so drift fails CI loudly:
```ts
// packages/app/test/configMirror.test.ts
import { config as core } from "@guezzer/core/config"; // (export it, or a thin re-export)
import { config as app } from "../src/config.ts";
it("explore + dex mirror keys stay equal", () => {
  expect(app.explore.BARS_TOP_N).toBe(core.explore.BARS_TOP_N);
  expect(app.explore.ROTATION_WINDOW_SHOWS).toBe(core.explore.ROTATION_WINDOW_SHOWS);
  expect(app.explore.EDGE_COUNT_THRESHOLD_DEFAULT).toBe(core.explore.EDGE_COUNT_THRESHOLD_DEFAULT);
  expect(app.explore.EDGE_SLIDER_MIN).toBe(core.explore.EDGE_SLIDER_MIN);
  expect(app.explore.EDGE_SLIDER_MAX).toBe(core.explore.EDGE_SLIDER_MAX);
  expect(app.dex.OWNER_NAME_MAX_LENGTH).toBe(core.dex.OWNER_NAME_MAX_LENGTH);
});
```

### WR-02: `sheetBars` silently renders blank, dead bars for unresolved edge targets

**File:** `packages/app/src/explore/ExploreView.tsx:111-125`
**Issue:** Each ranked bar's target is resolved via `nodeById.get(bar.songId)`, with
`targetName: target?.name ?? ""` and `targetTuningFamily: target?.tuningFamily ?? "other"`.
The inline comment asserts the invariant ("Every matrix edge target is a matrix node, so
every bar resolves here"), but nothing validates it. `rankOutgoing` reads `matrix.edges`
directly while `nodeById` is built from `matrix.nodes`; if a build artifact ever ships an
edge whose `to` references a songId absent from `nodes`, the user gets a blank-named,
still-tappable chain-hop bar that focuses a node the canvas can't resolve (`focusNode`
becomes `undefined`, so the sheet then unmounts on the next focus — a confusing dead-end).
The failure is silent, masked by the `?? ""` fallback.
**Fix:** Make the invariant enforced or observable rather than silently swallowed — e.g.
drop unresolved bars and surface the drift in dev:
```ts
return ranked.bars.flatMap((bar) => {
  const target = nodeById.get(bar.songId);
  if (!target) {
    if (import.meta.env.DEV) console.warn(`Explore: edge target ${bar.songId} has no node`);
    return [];
  }
  return [{ bar, targetName: target.name, targetTuningFamily: target.tuningFamily,
    caught: dexOverlayActive ? sightingsFor(bar.songId) > 0 : undefined }];
});
```

### WR-03: Stale docstrings describe now-live controls as inert/reserved

**File:** `packages/app/src/explore/ExploreFilterPanel.tsx:14-19,38-44,114-115`; `packages/app/src/explore/ExploreFilterFab.tsx:32-34`; `packages/app/src/explore/RankedBar.tsx:16-19,84-85`
**Issue:** Several docstrings still describe features that are now wired live.
`ExploreFilterPanel` claims the dex-overlay row "renders as a disabled row now (the label
reads, the control is inert)" and "Omitted this slice → the row renders disabled/inert,"
and `RankedBar` states "This slice never passes it, so nothing draws yet" for the
caught-tick. But `ExploreView` passes `onDexOverlayChange={setDexOverlay}` (so
`overlayReserved` is always `false` and the switch is fully interactive) and passes `caught`
through `sheetBars` when the overlay is active (so the tick does draw). A maintainer
trusting these comments may treat a shipped, user-facing control as dead code and
refactor/skip-test it. Comments that misstate live behavior are a latent-bug source, not a
style nit.
**Fix:** Update the three docstrings to describe the wired-live state (overlay switch and
caught-tick are active; `overlayReserved` / `caught === undefined` are only the fallbacks
when a parent omits the handler), or delete the now-obsolete "reserved slot" narration.

## Info

### IN-01: Unused `_cfg` parameter in `deriveConstellation`

**File:** `packages/core/src/explore/derive-constellation.ts:55-58`
**Issue:** `deriveConstellation(matrix, _cfg: typeof config = config)` never reads `_cfg`.
It's an intentional forward-compat seam (underscore-prefixed, documented), but it's dead
weight today and slightly misleads callers into thinking derivation is config-driven.
**Fix:** Acceptable as an intentional seam; if YAGNI is preferred, drop the parameter until
a config-driven derivation actually needs it.

### IN-02: `rotationSongIds` boundary is order-dependent for same-date shows

**File:** `packages/core/src/explore/rotation.ts:18-21`
**Issue:** The sort comparator returns `0` for equal dates, so when the N-show window
boundary falls between multiple shows on the *same* date, which show is included depends on
the artifact's array order — the exact thing the sort was added to stop trusting. Low impact
(only affects the marginal Nth show, and archive dates are usually distinct), but the
"never trust array order" claim in the docstring isn't fully honored at ties.
**Fix:** Add a deterministic tiebreak, e.g. fall back to `show.id` on equal dates so the
window is fully deterministic regardless of input ordering.

### IN-03: Focus camera effect omits `size.width` from its dependency array

**File:** `packages/app/src/explore/ConstellationCanvas.tsx:251-270`
**Issue:** The focus pan/zoom effect lists `[focusId, graphData, size.height]` but reads
only `size.height`, so it's currently correct. Flagged only because the sibling charge/link
effect (line 192) tracks both dimensions — the asymmetry is easy to misread as a bug and
could become one if the effect later starts using horizontal extent.
**Fix:** None required today; add `size.width` if/when horizontal centering logic is added,
to keep the two effects' dependency intent consistent.

---

_Reviewed: 2026-07-16T22:51:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
