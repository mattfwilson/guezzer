---
created: 2026-07-17T03:30:14.557Z
title: Blur a random album cover as the Show screen background
area: ui
status: done
resolved_by: quick task 260717-02n (commit da50134)
resolved_date: 2026-07-17
files:
  - packages/app/src/show/ShowView.tsx
  - packages/app/src/dex/covers.ts
  - packages/app/public/covers
---

> **DONE (2026-07-17):** Implemented in quick task `260717-02n` (commit `da50134`).
> Fully random bundled cover, blurred (`config.show.background.BLUR_PX`) + dimmed
> (`DIM_OPACITY`), stable per ShowView mount, shown across pre-show + orbit states
> (RecapView excluded). See `.planning/quick/260717-02n-*/260717-02n-SUMMARY.md`.

> **Naming update (2026-07-17):** bottom tabs rebranded (display labels only) —
> **Show → LiveGizz**, **Explore → GizzVerse**, **Dex → GizzDex**. "Show screen /
> Show page" below is the **LiveGizz** tab (formerly "Show"). Routes (`show`),
> file paths (`src/show/*`, `ShowView.tsx`), and component names are unchanged, so
> all code identifiers below still apply as-is.

## Problem

The LiveGizz screen (formerly "Show") currently uses a flat background color, which
reads as visually flat/plain. We want the LiveGizz page to feel more visual and alive without
compromising legibility of the interactive body (prediction orbs, buttons, text)
that the user taps one-thumb, in the dark, at a live show.

## Solution

Give the Show screen a background built from an album cover instead of a flat color:

- On show start, pick a **random** album cover from the full catalog (source the
  cover list from `packages/app/src/dex/covers.ts` / `packages/app/public/covers`).
- Render that cover as the full-bleed page background, then **blur** and **dim**
  it (heavy blur + dark overlay / reduced opacity) so it reads as ambient texture,
  not foreground.
- Ensure body content (buttons, prediction text, orbs) stays fully legible and
  meets contrast/tap-target requirements — the dim/blur layer must sit behind an
  accessible content layer.

Open questions to resolve during planning:
- Randomize once per show (stable for the session) vs. per app load — likely
  once per show so the background doesn't flicker/change mid-show.
- Whether to bias the pick toward covers already "caught" in the Pokédex, or
  keep it fully random.
- Offline: covers are already bundled, so the blurred background must work fully
  offline like the rest of Show Mode.

Approach: CSS `filter: blur()` + a dark gradient/overlay on an absolutely
positioned background layer; keep it cheap enough for mobile GPUs.
