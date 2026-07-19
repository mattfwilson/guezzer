---
created: 2026-07-19T04:48:04.422Z
title: "Feature: Gizz Bingo — auto-marking live bingo cards for casual +1s"
area: feature
files:
  - packages/core/src/model/predict.ts
  - packages/app/src/show/ShowView.tsx
---

## Problem

**Feature idea #3 from 2026-07-19 research session. THE casual +1 anchor feature — the answer to "how do we engage users who don't know the discography".**

The song-prediction orbit is fun if you know the songs; a +1 who doesn't recognizes nothing. Bingo is the proven casual mechanic because it's **recognition-based and passive** — you just watch squares light up. Demand evidence: a fan-made KGLW bingo project already exists (github.com/reeserich/king_gizz_bingo — popularity/recency-weighted cards) but it's **static PDFs with no live checking**. A live-updating card driven by Guezzer's tracker is the obvious gap nothing in the ecosystem fills.

## Solution

Concept — auto-generate a unique 5×5 card per person at show start:

1. **Card generation** (pure core, seeded per player): mix of near-certainties (model top picks), mid-probability songs, and **knowledge-free event squares** — "a song longer than 10 minutes" (needs track durations, currently dropped in normalize.ts — see Song Dossiers todo), "a song from before 2016", "a bust-out (gap ≥ 50 shows)", "a microtonal song", "a cover". Event squares are what make it playable knowing zero songs.
2. **Auto-marking**: squares mark themselves as the shared tracker logs songs (duration/era/rarity/tuning metadata all in the matrix + corpus). Manual mark for squares the tracker can't detect ("Stu says thank you").
3. **Wins**: line / X / blackout, with a celebratory moment + shareable card image (reuse share-card canvas renderer).
4. **Friend cards**: same date-seeded generator + player name → deterministic distinct cards with no server; or exchange via QR.

Architecture fit: card generation + marking are pure core functions over the trail; one new view (card grid) that subscribes to the same liveQuery the trail uses. Mid-size. The +1 gets a reason to look at the app all night.
