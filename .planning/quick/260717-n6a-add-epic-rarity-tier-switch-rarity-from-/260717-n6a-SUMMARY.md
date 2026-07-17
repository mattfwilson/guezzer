---
phase: quick-260717-n6a
plan: 01
subsystem: dex/rarity
tags: [rarity, dex, config, tiers, share-card]
requires:
  - config.dex (single-config store)
  - packages/core/src/dex/rarity.ts buildRarityIndex
provides:
  - RarityTier union incl. "epic" (legendary > epic > rare > uncommon > common)
  - config.dex.RARITY_BANDS (tie-inclusive playCount bands)
  - Epic label + #FB923C hue in both app TIER_COLOR maps
affects:
  - packages/core/src/dex/compare.ts (rank + tierCounts)
  - packages/core/src/dex/share-stats.ts (TIER_ORDER)
  - packages/app/src/dex/{TierBadge,shareCard,RecapView}
tech-stack:
  added: []
  patterns:
    - Tie-inclusive playCount band lookup (first band whose maxPlays >= playCount)
key-files:
  created: []
  modified:
    - packages/core/src/config.ts
    - packages/core/src/dex/rarity.ts
    - packages/core/src/dex/compare.ts
    - packages/core/src/dex/share-stats.ts
    - packages/core/test/dex/rarity.test.ts
    - packages/core/test/dex/compare.test.ts
    - packages/core/test/dex/share-stats.test.ts
    - packages/core/test/dex/archive-artifact.test.ts
    - packages/app/src/config.ts
    - packages/app/src/dex/TierBadge.tsx
    - packages/app/src/dex/shareCard.ts
    - packages/app/src/dex/RecapView.tsx
decisions:
  - "Tier is a pure function of total corpus playCount via config.dex.RARITY_BANDS; rarity.ts holds zero numeric tier literals."
  - "RARITY_MIN_PLAYS 'fake Legendary' cap retired by design — a played-once-ever song is legendary (accepted trade-off: curated + sentinel-filtered corpus)."
  - "Epic hue #FB923C applied identically to both duplicated TIER_COLOR maps; map consolidation deferred to the existing recolor todo."
  - "compare.ts untiered-null sentinel bumped 4→5 so 'untiered sorts last' survives common moving to rank 4."
metrics:
  duration: ~15min
  completed: 2026-07-17
  tasks: 3
  files: 12
---

# Phase quick-260717-n6a: Add Epic Rarity Tier + Tie-Inclusive playCount Bands Summary

Replaced the dex rarity model with tie-inclusive, total-corpus-playCount bands and added an "Epic" tier between Rare and Legendary, rippled cleanly through every consumer and validated exhaustive at typecheck across both packages.

## What Was Built

- **Band model (core):** `config.dex.RARITY_BANDS` replaces `RARITY_QUANTILES`; `RARITY_MIN_PLAYS` removed. `buildRarityIndex` now assigns tier by an inclusive playCount band lookup (`legendary`=1, `epic`=2–3, `rare`=4–8, `uncommon`=9–23, `common`=24+), evaluated low→high with `common` as the implicit tail. No songId tie-break — equal playCounts always share a tier. No numeric tier literals live in `rarity.ts`.
- **Widened union:** `RarityTier = "common" | "uncommon" | "rare" | "epic" | "legendary"` (ordering `legendary > epic > rare > uncommon > common`).
- **Consumers:** `compare.ts` re-ranked (`legendary:0, epic:1, rare:2, uncommon:3, common:4`) and `tierCounts` seeds `epic:0`; `share-stats.ts` and `RecapView.tsx` `TIER_ORDER` insert `"epic"` after `"legendary"`.
- **App label + hue:** `config.copy.dex.tierLabels.epic = "Epic"`; both `TIER_COLOR` maps (`TierBadge.tsx`, `shareCard.ts`) add `epic: "#FB923C"` (identical value).

## Verification

- `npx vitest run` — full suite green: **498 passed / 68 files**.
- `npx tsc -p packages/core/tsconfig.json --noEmit` — clean.
- App exhaustiveness proven via `npx tsc` with a paths override to the worktree core (see Deviations) — clean; every app switch/Record on `RarityTier` handles `epic`.
- Real-corpus tally over `data/normalized/archive.json` (throwaway node script, not committed): **{ legendary: 32, epic: 29, rare: 32, uncommon: 62, common: 109 }, total 264** — matches the owner's modeled table exactly.
- Grep: no `RARITY_QUANTILES`/`RARITY_MIN_PLAYS` config keys remain in `packages/core/src` (only doc-comment mentions describing the retirement).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `archive-artifact.test.ts` pinned the retired config keys**
- **Found during:** Task 1 (core typecheck).
- **Issue:** `test/dex/archive-artifact.test.ts` Tests 1–2 asserted `config.dex.RARITY_QUANTILES` / `RARITY_MIN_PLAYS`, which no longer exist — compile break not listed in the plan's file set.
- **Fix:** Rewrote Test 1 to pin `RARITY_BANDS` and Test 2 to assert both retired keys are absent.
- **Commit:** fa95aef (with Task 1).

**2. [Rule 1 - Bug] `compare.ts` untiered-null sentinel collided with common's new rank**
- **Found during:** Task 3.
- **Issue:** The plan's re-rank moves `common` to rank 4, but `tierRank(null)` also returned 4 — untiered songs would interleave with common instead of sorting last.
- **Fix:** Bumped the null fallback to 5, preserving "untiered sorts last".
- **Commit:** 4cd2f31.

**3. [Rule 1 - Bug] `compare.test.ts` + `share-stats.test.ts` fixtures pinned old quantile tiers**
- **Found during:** Task 3 (full suite run).
- **Issue:** Both suites hard-coded tier expectations from the old model (a playCount-1 song was `rare` under the min-plays cap). Under bands it is `legendary`; playCount-2 songs are now `epic`. 3 tests failed.
- **Fix:** Updated fixture docstrings, `rarestCatch`/`tierBreakdown` expectations, and `tierCounts` records (now 5 keys incl. `epic`). Diff-list orderings were unaffected. These files were not in the plan's file set.
- **Commit:** 4cd2f31.

### Worktree-isolation note (verification method, not a code change)

The app package resolves `@guezzer/core` through the shared root `node_modules` junction to the **main checkout's** `packages/core`, not this worktree — so a plain `npx tsc -p packages/app/tsconfig.json` typechecks against the pre-change core and cannot see the widened union. To validate app-side exhaustiveness against the actual worktree changes, I used a throwaway `packages/app/tsconfig.verify.json` (paths override → `../core/src/index.ts`), confirmed a clean typecheck, then deleted it (never committed). When this branch merges to main, normal resolution picks up the widened union.

## Known Follow-ups (deferred)

- **Duplicated `TIER_COLOR` maps.** The Epic hue `#FB923C` now lives in **two** places — `packages/app/src/dex/TierBadge.tsx:20` and `packages/app/src/dex/shareCard.ts:36` — kept intentionally identical. Consolidating both maps into config (and recoloring all tiers) is the existing pending recolor todo (`.planning/todos/pending/2026-07-17-recolor-rarity-tier-tags-common-uncommon-rare-legendary.md`); this change stayed minimal and did NOT consolidate or recolor other tiers.

## Commits

- `fa95aef` feat(quick-260717-n6a): tie-inclusive playCount rarity bands + add Epic tier
- `7034d21` test(quick-260717-n6a): rewrite rarity tests for playCount band semantics
- `4cd2f31` feat(quick-260717-n6a): ripple Epic tier through consumers + app hue/label

## Self-Check: PASSED
- All modified files exist and are committed.
- Commits fa95aef / 7034d21 / 4cd2f31 present on the worktree branch.
- Full suite 498/498 green; core typecheck clean; app typecheck clean (paths-override verify); real-corpus tally 32/29/32/62/109.
