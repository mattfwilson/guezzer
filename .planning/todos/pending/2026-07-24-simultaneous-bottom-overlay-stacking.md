---
created: 2026-07-24T00:00:00.000Z
title: Simultaneous bottom overlays double the reserve and overlap each other
area: ui
resolves_phase:
files:
  - packages/app/src/pwa/bottomOverlayInset.ts
  - packages/app/src/components/InstallBanner.tsx
  - packages/app/src/components/UpdateToast.tsx
  - packages/app/src/components/BackupToast.tsx
  - packages/app/src/components/BingoCelebration.tsx
  - packages/app/src/components/WaveToast.tsx
---

## Problem

The bottom-overlay reserve and the overlays' own positioning disagree when **two are
visible at once**.

`pwa/bottomOverlayInset.ts` keeps a `Map<id, height>` and **sums every registered
height** into `--gz-overlay-inset`, which `--gz-content-reserve` adds on top of
`--gz-chrome-reserve` for scrolling routes. But each overlay is **independently
pinned** at `bottom: var(--gz-chrome-reserve)` (plan 21-10) — none of them offsets
itself by the height of anything else registered below it.

So with, say, `UpdateToast` (72px) and `BackupToast` (56px) both on screen:

- **Reserved:** `chrome + 128px` — the sum of both.
- **Rendered:** both boxes start at the *same* `bottom`, so they **overlap each
  other**, occupying only 72px of real vertical space.

There are five hosts that can be mounted simultaneously — `InstallBanner`,
`UpdateToast`, `BackupToast`, `BingoCelebration`'s bottom toast and `WaveToast` — all
mounted app-level in `App.tsx`, so the combination is reachable in normal use (end a
show while an update is waiting; catch a bingo while a friend waves).

**This is deliberately not fixed in Phase 21.** Over-reserving is the *safe* failure:
nothing gets covered, nothing becomes untappable, the page just has a little extra
scroll room. The visible symptom is the stacking, and only when two fire together.
See `.planning/phases/21-layout-layering-foundations/21-CONTEXT.md` §Deferred Ideas.

## Evidence

- `packages/app/src/pwa/bottomOverlayInset.ts` — `recompute()` sums `heights.values()`;
  `useBottomOverlayHeightRegistration` registers per-`id`, so two ids coexist.
- `packages/app/test/bottomOverlayInset.test.tsx` — the shipped case
  `"sums multiple simultaneously-registered overlays"` asserts the summing behavior
  directly (220 + 72 = 292). The summing is correct *as a reserve*; it is the
  rendering that does not match it.
- All five overlays set `bottom: var(--gz-chrome-reserve)` with no per-overlay offset
  term (plan 21-10, commit `6154e11`).

## Solution

TBD — this is **new layout behavior**, not a refactor, which is why it was scoped out.
The direction: each overlay's bottom offset becomes
`calc(var(--gz-chrome-reserve) + <total height of the overlays below it>)`, which
means the store must expose an **ordered** stack (a priority/registration order, and
a per-id cumulative offset) rather than a single summed scalar. Candidates:

- Give the store a declared overlay ORDER and have it publish a per-id offset var
  (`--gz-overlay-offset-{id}`) alongside the total; each overlay reads its own.
- Or render all five through one host component that lays them out in a flex column
  pinned to the chrome reserve, making the stacking a layout fact rather than
  arithmetic. This is cleaner but touches all five hosts' mounting in `App.tsx` and
  their independent `AnimatePresence` lifecycles.

Either way it needs a decision on **priority** (which overlay sits closest to the tab
bar) and on whether a cap is wanted — five stacked overlays would cover most of a
phone viewport, and D-17 says the live logging loop must never be blocked.
