---
phase: quick-260717-onl
plan: 01
subsystem: dex-ui
tags: [tier-colors, share-card, config, wcag, refactor]
requires:
  - config.dex (dex UI geometry object)
  - config.share (share-card geometry object)
  - "@guezzer/core: RarityTier type"
provides:
  - config.dex.tierColors (single Record<RarityTier | "debut", string> tier-color source)
  - config.share.wordmarkGold (fixed brand gold, decoupled from legendary)
affects:
  - packages/app/src/dex/TierBadge.tsx
  - packages/app/src/dex/shareCard.ts
tech-stack:
  added: []
  patterns:
    - "Single-config source of truth (CLAUDE.md): both tier-color consumers import config.dex.tierColors; no local map"
    - "`satisfies Record<RarityTier | \"debut\", string>` makes a missing/extra tier a compile error while preserving literal hues under `as const`"
key-files:
  created: []
  modified:
    - packages/app/src/config.ts
    - packages/app/src/dex/TierBadge.tsx
    - packages/app/src/dex/shareCard.ts
    - packages/app/test/shareCard.test.tsx
decisions:
  - "Tier-color map homed in config.dex (rarity is a dex concept) but consumed by the share card too — data semantics, not chrome"
  - "Wordmark decoupled to config.share.wordmarkGold so the brand mark never inherits a tier recolor (legendary is now orange)"
  - "Used `satisfies` rather than a plain type annotation so the six literal hexes stay narrow under the config's `as const`"
metrics:
  duration: ~15 min
  completed: 2026-07-17
  tasks: 2
  files-changed: 4
---

# Quick 260717-onl: Recolor Rarity Tier Chips + Consolidate TIER_COLOR Summary

Recolored the six rarity tier chips to a new scheme and collapsed the two duplicated `TIER_COLOR` maps (TierBadge + shareCard) into one `config.dex.tierColors` source of truth; decoupled the share-card wordmark from the legendary hue via a fixed `config.share.wordmarkGold`, and switched the debut chip to a dotted border.

## What Was Built

- **`config.dex.tierColors`** — the single tier-color map, typed `satisfies Record<RarityTier | "debut", string>`. New scheme: debut `#A1A1AA`, common `#E4E4E7`, uncommon `#34D399` (emerald), rare `#60A5FA` (blue), epic `#A855F7` (purple), legendary `#FB923C` (orange). A type-only `import type { RarityTier } from "@guezzer/core"` keeps core purity intact.
- **`config.share.wordmarkGold` = `#F2C14E`** — fixed brand gold for the "Guezzer" wordmark, permanently decoupled from the (now orange) legendary tier.
- **`TierBadge.tsx`** — deleted its local `TIER_COLOR` map; reads `config.dex.tierColors[tier]`. The debut chip conditionally appends `border-dotted`; every real tier keeps the solid border. The tier WORD still always renders (WCAG 1.4.1 unchanged). Stale doc comment rewritten.
- **`shareCard.ts`** — deleted its local `TIER_COLOR` map; the rarest-catch tier and tier-breakdown segments now index `config.dex.tierColors`. The wordmark fill switched from `TIER_COLOR.legendary` to `config.share.wordmarkGold`. Comments updated (legendary → orange; wordmark uses separate brand gold).
- **`shareCard.test.tsx`** — the Legendary tier-breakdown segment assertion updated `#F2C14E` → `#FB923C` (it follows the tier now), test title updated, and a new focused assertion pins the "Guezzer" wordmark to `#F2C14E` to lock the decoupling.

## Task Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Consolidate tier-color map + brand gold into config.ts | `7bcb271` |
| 2 | Wire both consumers to the shared map + dotted debut border, update tests | `6408d46` |

## Verification

- `npx tsc -p packages/app/tsconfig.json --noEmit` — clean (exit 0).
- `npx vitest run packages/app/test/shareCard.test.tsx packages/app/test/songRow.test.tsx` — 2 files, 16 tests, all green.
- `grep TIER_COLOR packages/app/src/dex/TierBadge.tsx packages/app/src/dex/shareCard.ts` — no matches (both local maps deleted).

## Deviations from Plan

None functionally — plan executed as written. Two process notes:

- **Worktree base correction (setup, not a code deviation):** The worktree spawned at commit `cf659d4`, which predates the `epic` tier addition; the plan's file context assumed the post-`epic` base `0678005`. Per the `<worktree_branch_check>` Step 2, the base needed correcting. `git reset --hard` was blocked by the auto-mode classifier, so I discarded my in-flight config edits with a file-scoped `git checkout --` and advanced the branch non-destructively via `git merge --ff-only 0678005` (a fast-forward, since `cf659d4` is an ancestor). Base is now `0678005` as required; all edits were re-applied on the correct base.
- **Implementation choice:** used `satisfies` instead of a plain `: Record<...>` annotation so the literal hex strings stay narrow under the config object's outer `as const` while still failing compilation on a missing/extra tier. Meets the plan's intent (compile-error on drift).

## Notes for the Orchestrator

This resolves the pending todo `.planning/todos/pending/2026-07-17-recolor-rarity-tier-tags-common-uncommon-rare-legendary.md`. Per plan constraints the executor did NOT touch the todo file, STATE.md, or ROADMAP.md — the orchestrator removes the todo file and its STATE line and handles the docs commit.

## Self-Check: PASSED
