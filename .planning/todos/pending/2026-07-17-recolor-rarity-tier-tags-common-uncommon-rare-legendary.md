---
created: 2026-07-17T04:30:48.956Z
title: Recolor rarity tier tags — Common/Uncommon/Rare/Legendary
area: ui
files:
  - packages/app/src/dex/TierBadge.tsx:16-22
  - packages/app/src/dex/shareCard.ts:32-36
---

## Problem

Owner wants new colors for the rarity tier tags (used app-wide via `TierBadge`):

| Tier | Current | New (owner) |
|------|---------|-------------|
| Common | `#A1A1AA` (text-muted gray) | **light blue** |
| Uncommon | `#60A5FA` (blue) | **green** |
| Rare | `#E879F9` (magenta) | **medium purple** |
| Legendary | `#F2C14E` (accent gold) | **copper orange** |

## Solution

The tier hex ramp is hardcoded in **two** places that MUST both change (they're
duplicated today → drift risk):

1. `packages/app/src/dex/TierBadge.tsx:16-22` — `TIER_COLOR` (the pill: colors
   text + a 40%-opacity border). Consumed everywhere a badge shows (DexHeader,
   SongRow, RecapView, CompareView, SetlistView, WhyDetail).
2. `packages/app/src/dex/shareCard.ts:32-36` — a **second** `TIER_COLOR` map for
   the PNG brag card (canvas can't use the component).

**Strongly recommend consolidating** into one source (e.g. `config.tierColors`
or `config.copy.dex.tierColors`) that both files read — CLAUDE.md single-config
rule; two hardcoded ramps is exactly the "scattered magic numbers" to avoid.
Tier WORDS already live once in `config.copy.dex.tierLabels` — mirror that.

### Suggested starter hexes (owner to refine)

- Common (light blue): `#7DD3FC` (sky) — was gray; now more present.
- Uncommon (green): pick a green **distinct from caught-green** (see collision) —
  e.g. a teal-leaning `#34D399`, NOT `#22C55E`.
- Rare (medium purple): `#A78BFA` (violet-400).
- Legendary (copper orange): `#C2703D` / `#B87333` (copper).

## ⚠️ Collisions to review (why the current hues were chosen)

The existing ramp was picked for **zero collision** with reserved semantics.
New colors reintroduce that risk:

- **Uncommon green vs caught-green (biggest):** `#22C55E` is the reserved
  "caught / complete / hit" success color (§B2, `AlbumGrid.tsx:19` `CAUGHT_GREEN`,
  SyncDot online, RankedBar caught). A green Uncommon badge can read as "caught."
  Pick a clearly different green (teal/emerald) or accept the overlap.
- **Legendary copper-orange vs accent gold:** `#F2C14E` accent gold is reserved
  chrome (Start Show, focus ring, LiveGizz bg tint). Copper-orange sits near it —
  keep enough separation that Legendary reads as data, not a CTA.
  ALSO: the **share-card wordmark** currently draws in `TIER_COLOR.legendary`
  (`shareCard.ts:86`). If Legendary → copper, the wordmark recolors too — decide
  whether the wordmark should follow Legendary or be pinned to accent gold via
  its own constant (likely pin it to gold and decouple).
- **Rare medium-purple vs tuning C#-violet:** the old Rare comment notes it stays
  "hotter than tuning C#-violet (never co-occur)". Check `show/tuningColor.ts`
  hues so a medium purple doesn't clash if a tuning violet is ever nearby.
- **Common light-blue vs old Uncommon blue:** don't reuse `#60A5FA` for Common;
  keep the light-blue lighter/distinct from whatever green-ish Uncommon lands on.

## Acceptance

- Both `TIER_COLOR` maps (or the new single config source) updated; no stray
  `#60A5FA`/`#E879F9`/`#F2C14E` tier refs remain.
- Badges + share-card PNG both show the new ramp; wordmark color decision made.
- Tier WORD still always renders (color is reinforcement only — WCAG 1.4.1);
  each new hue has adequate contrast on the dark surface.
- Collisions above consciously resolved. Typecheck + tests + a share-card render
  check pass.
