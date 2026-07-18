---
created: 2026-07-17T16:02:17.924Z
title: Bottom sheets — smooth up/down animation + always-on-top layering
area: ui
files:
  - packages/app/src/components/AppMenu.tsx:45
  - packages/app/src/show/SearchSheet.tsx:86
  - packages/app/src/show/TrailNodeSheet.tsx:87
  - packages/app/src/show/WhyDetail.tsx:37
  - packages/app/src/show/EndShowDialog.tsx:95
  - packages/app/src/show/CometTrail.tsx:223
  - packages/app/src/show/FabMenu.tsx:99
  - packages/app/src/explore/NodeSheet.tsx:135
  - packages/app/src/explore/ExploreFilterPanel.tsx
  - packages/app/src/explore/ExploreFilterFab.tsx:56
  - packages/app/src/dex/ShareCardSheet.tsx:88
  - packages/app/src/settings/SettingsView.tsx:265
  - packages/app/src/dex/ArchiveBrowser.tsx:353
---

## Problem

Two related issues affect **every bottom sheet** in the app (the slide-up dialog
surfaces with a dimming scrim), not just one screen:

**1. No enter/exit animation.** Most sheets just pop into existence and vanish
instantly on close. They should animate **up** into view when opened and **down**
out of view when dismissed (with the scrim fading in/out), smoothly and
consistently, honoring `prefers-reduced-motion` (instant swap) like the rest of
the app's motion.

**2. Inconsistent z-index → FABs paint above open sheets.** The stacking values
are scattered magic numbers that collide, so floating action buttons sit *on top
of* an open sheet instead of under it. A sheet should always be the top-most
surface (above FABs, banners, toasts, page content) while it is open.

Current z-index landscape (confirmed via grep — all raw Tailwind `z-*` classes,
no central scale):

Bottom sheets / dialogs:
- `AppMenu.tsx:45` (overflow menu) — `z-20`
- `WhyDetail.tsx:37` — `z-20`
- `TrailNodeSheet.tsx:87` — `z-30`
- `CometTrail.tsx:223` (trail node sheet) — `z-30`
- `EndShowDialog.tsx:95` — `z-30`
- `SearchSheet.tsx:86` — `z-30`
- `NodeSheet.tsx:135` — `z-30`
- `ShareCardSheet.tsx:88` — `z-40`
- `SettingsView.tsx:265` — `z-40`
- `ArchiveBrowser.tsx:353` (inner sheet) — `z-40`

FABs / floating controls:
- `FabMenu.tsx` (LiveGizz FAB): scrim `z-20`, menu `z-30` (lines 99 / 105)
- `ExploreFilterFab.tsx:56` (GizzVerse filter FAB) — `z-30`

Banners / toasts:
- `UpdateToast.tsx:33` — `z-10`
- `InstallBanner.tsx:90` — `z-10`

The collision is clear: any sheet at `z-20`/`z-30` is at or below a FAB at
`z-30`, so the FAB renders over it.

### Known concrete instance (folded in from the retired Explore-FAB todo)

On the **GizzVerse** tab (route `explore`), opening the main overflow menu leaves
the bottom-right filter FAB stacked **above** the overflow sheet and its scrim:
- `ExploreFilterFab` container is `fixed z-30` (`ExploreFilterFab.tsx:56`).
- `AppMenu` overlay is `fixed inset-0 z-20` (`AppMenu.tsx:45`).
- 30 > 20 → the FAB paints on top of the open menu.

This is one visible symptom of the general layering problem above; fixing the
scale app-wide resolves it. (Note: bottom tabs were rebranded to display labels
LiveGizz / GizzVerse / GizzDex — routes, file paths, and component names like
`ExploreFilterFab` are unchanged.)

## Solution

Treat this as a small design-system pass rather than per-screen patches:

1. **Centralize a z-index scale in config** (single-config ethos, per CLAUDE.md —
   "no scattered magic numbers"). Define named tiers, e.g. page content < FAB <
   banner/toast < sheet-scrim < sheet. Make every FAB strictly below the
   sheet-scrim tier so no FAB can ever paint over an open sheet. Audit ALL current
   `z-*` usages (grep `z-\[?\d`) and migrate them to the tiers so the fix doesn't
   just move the collision elsewhere.

2. **Shared bottom-sheet animation.** Factor the enter/exit choreography once
   (either a small reusable `BottomSheet` wrapper/hook or a shared CSS
   transition + presence pattern with `motion`, which is already a dependency)
   so every sheet slides up on open and down on close with the scrim cross-fading.
   Exit animation needs presence handling (e.g. `AnimatePresence` or a mount/unmount
   delay) so the sheet animates *out* before unmounting rather than disappearing.
   Disable under `prefers-reduced-motion` (instant show/hide), matching the orbit
   choreography and toast conventions already in the codebase.

3. Apply to all sheet surfaces listed in `files` (SearchSheet, TrailNodeSheet,
   WhyDetail, EndShowDialog, CometTrail sheet, NodeSheet, ExploreFilterPanel,
   ShareCardSheet, SettingsView sheet, ArchiveBrowser sheet, AppMenu). Confirm the
   GizzVerse FAB-over-menu instance is resolved as the acceptance check.

Consider whether the full-screen "views" (AlbumDetail, SetlistView, RecapView,
CompareView, ArchiveBrowser root) count as sheets for the animation pass or should
keep their current instant/fade behavior — they slide/cover differently from the
bottom sheets, so scope them explicitly during planning.

## Update (2026-07-18) — z-index half DONE (Phase 8, D-04)

**Solution step 1 (centralized z-index scale) is COMPLETE.** Phase 8 introduced
`config.ui.z` (single source of truth per CLAUDE.md) with named tiers —
`content` < `toast` < `fab` < `fabScrim` < `sheetScrim` < `sheet`, plus a
`focusedFab` exception (D-03). **All 24 raw `z-*` Tailwind literals across the 20
files listed above were migrated** to inline `style={{ zIndex: config.ui.z.X }}`
(plans 08-01 through 08-05). Every FAB tier now sits strictly below `sheet`, so no
FAB can ever paint over an open sheet — the GizzVerse FAB-over-menu instance
(step 3 acceptance check) is resolved. `rg 'z-\[?[0-9]' packages/app/src` returns
zero stacking-z matches.

**Solution step 2 (shared slide-up/down + scrim cross-fade ANIMATION) remains
DEFERRED** to a later polish pass — the sheets still pop in/out instantly. This
todo stays `pending` to track that remaining animation work; the layering /
always-on-top half is done.
