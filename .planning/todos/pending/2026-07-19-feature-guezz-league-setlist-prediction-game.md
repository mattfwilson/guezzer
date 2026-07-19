---
created: 2026-07-19T04:48:04.422Z
title: "Feature: Guezz League — pregame setlist prediction game with live scoring"
area: feature
files:
  - packages/core/src/dex/rarity.ts
  - packages/app/src/show/ShowView.tsx
---

## Problem

**Feature idea #2 from 2026-07-19 research session. Group-fun layer for the friends at the show; casual-friendly by construction.**

The Phish ecosystem proves fans love pregame setlist prediction games, and the scoring mechanics are well-established: Fantasy Phish (13 picks, opener/encore calls worth 3 pts), Pick5 (exactly 5 picks, **rarity-weighted 25–300 pts per song**, position multipliers), Phish Picks (rank-your-confidence scoring), Tweezer Picks (**scores update live during the show** — the emotional peak). Nothing like this exists for KGLW. Guezzer already has every ingredient: rarity tiers, a live setlist tracker to score against, and a prediction model to help casual players pick.

## Solution

Concept — before doors, each friend locks in 5 song picks + one opener call + one encore call:

1. **Scoring** (borrow Pick5): rarity-weighted points from existing tiers (e.g. common 25 → legendary 300, tunable in config), ×2-style bonus for correct opener/encore position calls. Openers are a real skill sub-game — "I'm In Your Mind" has opened 89 shows per kglw.net; the app already has `dex/openers.ts` recency-weighted opener ranking.
2. **Live scoring**: scores tick up as the tracker logs each song — the prediction game rides the existing show loop for free. End-of-show leaderboard joins the RecapView.
3. **Casual on-ramp**: +1s who don't know the catalog pick from a model-suggested sheet (top-N likely + a few spicy rare picks), so zero discography knowledge needed to play.
4. **Pick exchange with no backend**: friends' locked picks exchanged pre-show via QR code (BG Stats pattern — one phone renders a QR of the payload, other scans; see cross-cutting QR enabler noted in the badge/compare todos) or the existing file-share path. Picks lock at first song to prevent cheating.

Architecture fit: pick scoring is a pure core function over the trail; picks persist in Dexie; one new pick-entry sheet + a score strip/leaderboard. Mid-size. Sources: fantasyphish.com, pick5.io, phishpicks.net, tweezerpicks.com.
