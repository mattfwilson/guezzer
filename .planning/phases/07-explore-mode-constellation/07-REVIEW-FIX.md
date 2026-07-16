---
phase: 07-explore-mode-constellation
fixed_at: 2026-07-16T23:05:00Z
review_path: .planning/phases/07-explore-mode-constellation/07-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-07-16T23:05:00Z
**Source review:** .planning/phases/07-explore-mode-constellation/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (Warnings; 0 Critical/Blocker)
- Fixed: 3
- Skipped: 0

Scope was `critical_warning`, so the three Info findings (IN-01, IN-02, IN-03) were
intentionally out of scope and not attempted. All three were flagged by the reviewer as
acceptable-as-is / no-action-required.

## Fixed Issues

### WR-01: App/core config mirror has no drift enforcement

**Files modified:** `packages/app/test/configMirror.test.ts` (new file)
**Commit:** 7e90e51
**Applied fix:** Added the cross-package mirror test the reviewer suggested (the lower-risk
of the two offered options; the "re-export from the core barrel" alternative is a larger
refactor). The test imports `config` from both `@guezzer/core/config` (already a valid
package subpath export in `packages/core/package.json`) and `../src/config.ts`, then asserts
all six mirrored keys are equal: `explore.BARS_TOP_N`, `explore.ROTATION_WINDOW_SHOWS`,
`explore.EDGE_COUNT_THRESHOLD_DEFAULT`, `explore.EDGE_SLIDER_MIN`, `explore.EDGE_SLIDER_MAX`,
and `dex.OWNER_NAME_MAX_LENGTH`. Any future drift now fails CI loudly. Verified by running
the test (`vitest run` — 1 passed).

### WR-02: `sheetBars` silently renders blank, dead bars for unresolved edge targets

**Files modified:** `packages/app/src/explore/ExploreView.tsx`
**Commit:** 28dd099
**Applied fix:** Changed the `sheetBars` `useMemo` from `ranked.bars.map(...)` to
`.flatMap(...)`. When `nodeById.get(bar.songId)` returns undefined, the bar is now dropped
(returns `[]`) and a `import.meta.env.DEV`-guarded `console.warn` surfaces the drift, instead
of the old `targetName: target?.name ?? ""` / `targetTuningFamily: target?.tuningFamily ??
"other"` fallback that produced a blank-named, still-tappable dead-end bar. The invariant
("every matrix edge target is a matrix node") is now enforced/observable rather than silently
swallowed. `import.meta.env.DEV` is typed via the existing `vite/client` reference in
`vite-env.d.ts`. This is a runtime behavior change on the render path (blank bar → dropped
bar); it is defensive-only under the stated invariant, but a reviewer should confirm the
drop-vs-render choice is desired. Verified by `tsc --noEmit -p packages/app` (exit 0).

### WR-03: Stale docstrings describe now-live controls as inert/reserved

**Files modified:** `packages/app/src/explore/ExploreFilterPanel.tsx`, `packages/app/src/explore/RankedBar.tsx`
**Commit:** 5d7a201
**Applied fix:** Rewrote the stale "reserved slot / inert / this slice never passes it"
narration to describe the wired-live state, keeping the disabled/inert path documented only
as the parent-omits-handler fallback:
- `ExploreFilterPanel.tsx`: top-docstring item 3, the `dexOverlay`/`onDexOverlayChange` prop
  docstring, and the inline row comment now state the switch is live (ExploreView owns the
  state) and only inert when `overlayReserved`.
- `RankedBar.tsx`: top docstring, the `caught` prop docstring, and the inline caught-tick
  comment now state the tick draws live when the overlay passes `caught`, absent only when
  `caught === undefined`.
- `ExploreFilterFab.tsx` was cited in the finding header (lines 32-34) but its `dexOverlay`
  docstring already describes the live, forwarded behavior accurately, so it was left
  unchanged (no stale statement to correct).

Comment-only changes; verified by `tsc --noEmit -p packages/app` (exit 0).

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-16T23:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
