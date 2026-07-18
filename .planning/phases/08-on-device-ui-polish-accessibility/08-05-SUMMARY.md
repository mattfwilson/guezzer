---
phase: 08-on-device-ui-polish-accessibility
plan: 05
subsystem: ui
tags: [z-index, layering, config, overlays, d-04]
requires:
  - "config.ui.z named tiers (plan 08-01)"
provides:
  - "content/toast/FAB overlays on config.ui.z tiers"
  - "dex + show route-overlays on config.ui.z tiers"
  - "bottom-sheets todo annotated: z-scale half done, animation deferred"
affects:
  - "packages/app/src/show/ShowView.tsx"
  - "packages/app/src/components/InstallBanner.tsx"
  - "packages/app/src/components/UpdateToast.tsx"
  - "packages/app/src/show/FabMenu.tsx"
  - "packages/app/src/show/CometTrail.tsx"
  - "packages/app/src/show/SearchSheet.tsx"
  - "packages/app/src/dex/AlbumDetail.tsx"
  - "packages/app/src/dex/ArchiveBrowser.tsx"
  - "packages/app/src/dex/RecapView.tsx"
  - "packages/app/src/dex/SetlistView.tsx"
tech-stack:
  added: []
  patterns:
    - "z-index via inline style={{ zIndex: config.ui.z.X }} (Tailwind v4 can't read a JS-config value from a static class)"
key-files:
  created:
    - ".planning/phases/08-on-device-ui-polish-accessibility/08-05-SUMMARY.md"
  modified:
    - "packages/app/src/show/ShowView.tsx"
    - "packages/app/src/components/InstallBanner.tsx"
    - "packages/app/src/components/UpdateToast.tsx"
    - "packages/app/src/show/FabMenu.tsx"
    - "packages/app/src/show/CometTrail.tsx"
    - "packages/app/src/show/SearchSheet.tsx"
    - "packages/app/src/dex/AlbumDetail.tsx"
    - "packages/app/src/dex/ArchiveBrowser.tsx"
    - "packages/app/src/dex/RecapView.tsx"
    - "packages/app/src/dex/SetlistView.tsx"
    - ".planning/todos/pending/2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top-layerin.md"
decisions:
  - "CometTrail full-setlist backdrop mapped to sheetScrim (its outermost fixed element is the dimming scrim; the sheet content is a non-fixed child)."
  - "Route-overlays (SearchSheet, AlbumDetail, ArchiveBrowser, RecapView, SetlistView) kept their existing shell — z-literal migrated only, NOT wrapped in <Sheet> (Open Q2 resolved)."
metrics:
  duration: "~15 min"
  completed: "2026-07-18"
requirements: [A11Y-01, A11Y-02]
---

# Phase 8 Plan 05: Remaining z-index tier migration (D-04) Summary

Migrated all 11 raw `z-*` Tailwind literals across this plan's 10 overlay files onto the named `config.ui.z` tiers via inline `style={{ zIndex }}`, so no `z-NN` literal survives in any file this plan owns and the FAB-below-sheet invariant holds for these overlays.

## What Was Built

Task 1 — content/toast/FAB tiers:
- `ShowView` background content column `z-10` → `config.ui.z.content` (also updated the describing code comment).
- `InstallBanner` + `UpdateToast` `z-10` → `config.ui.z.toast` (merged `zIndex` into the existing safe-area `style`).
- `FabMenu` scrim `z-20` → `config.ui.z.fabScrim` (strictly below sheets); action rows `z-30` → `config.ui.z.fab`.

Task 2 — dex overlays:
- `AlbumDetail` (:47), `ArchiveBrowser` fullscreen (:250), `RecapView` (:103/:143), `SetlistView` (:119/:129) route-overlays `z-30`/`z-40` → `config.ui.z.sheet`.
- `ArchiveBrowser` unmark-confirm backdrop (:353) `z-40` → `config.ui.z.sheetScrim`.

Task 3 — show overlays + todo annotation:
- `CometTrail` full-setlist backdrop (:225) `z-30` → `config.ui.z.sheetScrim`.
- `SearchSheet` fullscreen route-overlay (:99) `z-30` → `config.ui.z.sheet`.
- Appended an "Update (2026-07-18)" block to the folded bottom-sheets todo: z-index scale half is DONE (D-04, all 24 literals migrated app-wide across plans 08-01..05), slide/scrim animation half stays deferred; todo remains `pending`.

## Verification

- `tsc --noEmit` on `packages/app` exits 0 after every task.
- `fabMenu` + `bottomOverlayInset` tests green (13 passed).
- `archiveBrowser` + `recapView` tests green (15 passed).
- `cometTrail` test green (8 passed).
- `grep 'z-\[?[0-9]'` over this plan's 10 owned files returns zero matches. The 10 literals still present app-wide live only in the audited-sheet files owned by parallel plans 08-02..04 (AppMenu, WhyDetail, EndShowDialog, TrailNodeSheet, NodeSheet, ExploreFilterFab, ShareCardSheet, SettingsView, CompareView) — out of this plan's scope.

## Deviations from Plan

None — plan executed exactly as written. Each overlay was a pure className→inline-style swap with no geometry, behavior, or render-guard change (matches threat register T-08-13 / T-08-14 mitigations).

## Notes

- The app-wide zero-literal invariant asserted in Task 3's acceptance criteria only holds once the parallel wave-2 plans (08-02..04) also land — this agent owns 10 of the 20 files. Within this plan's scope the invariant is met.
- Verification used the root-installed `tsc`/`vitest` binaries via Node parent-dir resolution (worktree has no `node_modules`, pnpm not on PATH), per the execution note.

## Self-Check: PASSED
- All 10 modified source files + the todo annotation verified present with the config.ui.z edits.
- Commits 967723e, 4a8728b, 3fd1027 confirmed in git log.
