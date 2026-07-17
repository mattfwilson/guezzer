---
created: 2026-07-17T03:33:41.480Z
title: Explore FAB renders above the main overflow menu
area: ui
files:
  - packages/app/src/explore/ExploreFilterFab.tsx:56
  - packages/app/src/components/AppMenu.tsx:45
---

## Problem

On the Explore tab, opening the main overflow menu (top-right) leaves the
bottom-right FAB (rotation / full-catalog / etc. filter controls) stacked
**above** the overflow sheet and its dimming scrim. The FAB should always sit
**under** the main overflow sheet when that sheet is open, so the menu reads as
the top-most surface.

Root cause (confirmed): z-index conflict.
- `ExploreFilterFab` container is `fixed z-30` (`ExploreFilterFab.tsx:56`).
- `AppMenu` overlay (scrim + bottom sheet) is `fixed inset-0 z-20` (`AppMenu.tsx:45`).

Since 30 > 20, the FAB paints on top of the open overflow menu.

## Solution

Make the overflow menu the top-most surface. Options:

1. Raise `AppMenu`'s overlay z-index above the FAB (e.g. FAB `z-30` → menu `z-40`),
   OR
2. Lower/suppress the FAB when the overflow menu is open (drop FAB below `z-20`,
   or hide it while the menu is open).

Preferred: bump `AppMenu` above the FAB (single-surface fix, doesn't require the
FAB to know about menu state). Audit the app's z-index scale first — check other
overlays (NodeSheet, ExploreFilterPanel, InstallBanner, UpdateToast) so the new
value stays consistent and doesn't just move the collision elsewhere. Consider
centralizing z-index tiers in config to avoid future magic-number stacking bugs.
