---
created: 2026-07-14T04:20:00Z
title: Consolidate Show-Mode actions into a collapsed FAB menu (bottom-right)
area: ui
resolves_phase: 8
files:
  - packages/app/src/show/ActionBar.tsx
  - packages/app/src/show/ShowView.tsx
---

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
