---
status: complete
phase: quick-260717-p4s
plan: 01
subsystem: show-mode-ui / dex-styling
tags: [rarity, color, orbs, comet-trail, styling-primitive, refactor]
dependency_graph:
  requires:
    - config.dex.tierColors (consolidated tier-color map, quick 260717-onl)
    - getRarityIndex (memoized corpus rarity index, 06-06)
  provides:
    - rarityStyle primitive (rarityColor / rarityTierForSong / RARITY_ORB_TEXT_COLOR)
  affects:
    - Show Mode orb/center/trail color language
    - all rarity surfaces (chips, share card) now single-sourced
tech_stack:
  added: []
  patterns:
    - Single UI styling primitive as the one index into a config source of truth
key_files:
  created:
    - packages/app/src/dex/rarityStyle.ts
    - packages/app/test/rarityStyle.test.ts
  modified:
    - packages/app/src/dex/TierBadge.tsx
    - packages/app/src/dex/shareCard.ts
    - packages/app/src/show/PredictionOrb.tsx
    - packages/app/src/show/CenterNode.tsx
    - packages/app/src/show/CometTrail.tsx
    - packages/app/src/show/OrbitStage.tsx
    - packages/app/src/show/useShowSession.ts
    - packages/app/test/cometTrail.test.tsx
decisions:
  - rarityStyle.ts only READS config.dex.tierColors (single source of truth stays in config, per CLAUDE.md single-config rule)
  - CenterNode keeps the now-unused optional tuningFamily prop; color driven by new songId prop
  - tuningColor.ts retained for the Explore constellation (still tuning-colored)
metrics:
  duration: ~6min
  completed: 2026-07-17
---

# Quick 260717-p4s: Map Rarity Colors to Prediction Orbs & Unify Rarity Styling Summary

Show Mode's prediction fan, current-song center orb (+ ripples), and the comet
trail / full-setlist rings now read their fill from the song's RARITY TIER
instead of tuning family, and every rarity surface in the app (GizzDex chips,
share card, orbs, trail) routes its hue through one new `rarityStyle` primitive
so a tier recolor in `config.dex.tierColors` restyles all of them at once.

## What Was Built

### Task 1 — the `rarityStyle` primitive + refactor of existing consumers
- `packages/app/src/dex/rarityStyle.ts` (new): exports `rarityColor(tier)` (the
  ONLY app expression indexing `config.dex.tierColors`), `rarityTierForSong(songId)`
  (the shared song→tier bridge via `getRarityIndex()`, null/absent/failed-guard →
  `"debut"`), and `RARITY_ORB_TEXT_COLOR` (`#0C0C10`, documented ≥4.5:1 against all
  six tier hues).
- `TierBadge.tsx` and `shareCard.ts` (rarest-catch tier + tier-breakdown segments)
  refactored from direct `config.dex.tierColors[...]` reads to `rarityColor(...)`.
  Colors are byte-identical — only the access path is centralized.

### Task 2 — Show Mode orb/center/trail switched from tuning to rarity color
- `PredictionOrb.tsx`: fill = `rarityColor(rarityTierForSong(candidate.songId))`,
  text = `RARITY_ORB_TEXT_COLOR`; weak-fan softening + gesture logic unchanged.
- `CenterNode.tsx`: new `songId` prop drives the circle + ripple-ring color;
  pre-opener accent CTA untouched.
- `CometTrail.tsx`: `trailColor` = `rarityColor(rarityTierForSong(entry.songId))`;
  full-setlist rings share it; ??? / off-matrix → debut gray (#A1A1AA, unchanged).
- `songId` threaded through the `CurrentSong` interface in both `useShowSession.ts`
  and `OrbitStage.tsx` and passed into `CenterNode`.
- Explore constellation (`ConstellationCanvas.tsx`, `RankedBar.tsx`) untouched —
  still tuning-colored; `tuningColor.ts` retained for it.

## Verification

- `npm test`: 69 files / 502 tests pass.
- App `tsc --noEmit`: clean (exit 0).
- `rarityColor` is the sole live index of `config.dex.tierColors` in the app
  (grep: only `rarityStyle.ts:26` is code; all other hits are doc comments).
- No component hardcodes a tier hex (only the WCAG-ratio comment in rarityStyle.ts).
- Explore files still import `tuningColor` — unchanged.

## TDD Gate Compliance

Both tasks followed RED → GREEN:
- Task 1: `test(...)` 3c2a4b7 (RED, import-unresolved) → `feat(...)` 93b9a59 (GREEN).
- Task 2: `test(...)` 6c94f60 (RED, tuning cyan vs expected legendary orange) →
  `feat(...)` 8618da4 (GREEN).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: packages/app/src/dex/rarityStyle.ts
- FOUND: packages/app/test/rarityStyle.test.ts
- FOUND commit 3c2a4b7 (test: rarityStyle RED)
- FOUND commit 93b9a59 (feat: rarityStyle + refactor)
- FOUND commit 6c94f60 (test: cometTrail rarity RED)
- FOUND commit 8618da4 (feat: Show Mode rarity color)
