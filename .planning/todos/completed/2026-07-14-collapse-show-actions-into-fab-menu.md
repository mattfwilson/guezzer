---
created: 2026-07-14T04:20:00Z
title: Consolidate Show-Mode actions into a collapsed FAB menu (bottom-right)
area: ui
resolves_phase: 8
status: done
resolved_by: already delivered by the Phase-6 D-20 FabMenu (verify-and-close 2026-07-17)
resolved_date: 2026-07-17
files:
  - packages/app/src/show/ActionBar.tsx
  - packages/app/src/show/ShowView.tsx
---

> **DONE / verified 2026-07-17 (verify-and-close):** already delivered by the
> Phase-6 D-20 `FabMenu` speed-dial — this todo predated realizing that work
> covers it. Verification against every acceptance point:
> - `ActionBar.tsx` **removed**; the two-row in-flow bar is gone, orbit stage grows.
> - `FabMenu` (`packages/app/src/show/FabMenu.tsx`) is a bottom-right, collapsed-by-
>   default 56px speed-dial with all **five** actions (Search/Unknown/Set break/
>   Encore/Undo), rendered in `ShowView.tsx:397-402`; collapsed → only the FAB is
>   in the a11y tree (T-06-04).
> - Each action ≥44px (`min-h-11 min-w-11` + `FAB_ACTION_HEIGHT`); hottest-nearest
>   order (Undo bottom).
> - ???/Undo extra-tap trade-off **explicitly accepted by owner** (recorded in the
>   FabMenu header comment, 2026-07-14).
> - Fixed anchor clears `env(safe-area-inset-bottom)` + BottomTabBar (64px) + strip
>   (`FabMenu.tsx:75`); `pwa/bottomOverlayInset.ts` present.
> - Gesture suppression extended to `.fab-menu` in CSS (`touch-action: manipulation;
>   overscroll-behavior: none`).
> - Non-scrolling AppShell seam intact (OrbitStage `flex-1`, `scroll={route!=="show"}`).
> - Tests: `fabMenu.test.tsx` green (6/6).
>
> NOTE: the pending todo `2026-07-17-livegizz-tracking-screen-...` **extends** this
> FabMenu by adding an **End Show** action — tracked separately, not part of this
> todo's scope.

> **Naming update (2026-07-17):** bottom tabs rebranded (display labels only) —
> **Show → LiveGizz**, **Explore → GizzVerse**, **Dex → GizzDex**. "Show Mode" /
> "Show-Mode actions" below refer to the **LiveGizz** tab (formerly "Show").
> Routes (`show`), file paths (`src/show/*`), and component names (`ShowView`,
> `ActionBar`) are unchanged, so all code identifiers below still apply as-is.

## Problem

While recording a show, the persistent two-row ActionBar
(`[Search] [Unknown]` / `[Set break] [Encore] [Undo]`) eats significant
vertical space at the bottom of the viewport, shrinking the room available
for the orb selection/visualization — the core "one thumb, in the dark"
surface. Owner wants the orbit stage to get that space back.

## Solution

Owner's direction (2026-07-14): consolidate **Search, Unknown, Set break,
Encore, and Undo** into a single collapsible FAB (floating action button)
menu anchored **bottom-right** of the viewport, **collapsed by default**.
Expanding the FAB reveals the five actions; collapsed state is just the one
button, freeing the former ActionBar rows for the orbit.

Design considerations for the polish pass:

- One-thumb reach: bottom-right anchor suits right-thumb use; expansion
  should keep all five targets within thumb arc, each ≥44px (SHOW-02 floor).
- Speed-critical paths: ??? (instant miss, D-14) and Undo (one-tap, D-15)
  currently pay zero taps to reach — a collapsed FAB adds one tap. Confirm
  the owner accepts that trade, or keep the very hottest action(s) exposed.
- Layout seam: ActionBar is deliberately IN-FLOW (not fixed) so it stacks
  above the app BottomTabBar (04-05 decision). A FAB is position:fixed by
  nature — it must respect `env(safe-area-inset-bottom)` + BottomTabBar
  height, and coordinate with `pwa/bottomOverlayInset.ts` overlay accounting.
- Gesture suppression scope (04-07 declarative CSS on the stage/action-bar)
  must still cover the FAB so expansion taps never scroll/zoom the stage.
- Removing the ActionBar rows changes the ShowView flex column — the orbit
  stage grows; re-check the non-scrolling AppShell seam (scroll=false).
