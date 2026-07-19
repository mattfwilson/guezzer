---
created: 2026-07-19T04:48:04.422Z
title: "Feature: My Stats & Want List — rarest catches + most-common-not-caught"
area: feature
files:
  - packages/core/src/dex/derive-dex.ts
  - packages/app/src/dex/DexView.tsx
---

## Problem

**Feature idea #6 from 2026-07-19 research session. The proven personal-stats obsession features, computed entirely client-side.**

Phish.net's "My Stats" is the gold standard for "you were there" stats, and the two most-screenshotted/discussed are: **"rarest songs you've seen"** (with corpus play-rate %, e.g. "0.06% of shows") and **"most common song you have NOT seen"** — the second is a want-list generator fans obsess over in forum threads (it makes the next ticket feel necessary). kglw.net computes site-wide gap/bustout charts but nothing personal at song level. Guezzer has every input already: corpus play counts, dex catches, per-song sightings + personal gaps in `derive-dex.ts`.

## Solution

Concept — a stats page inside GizzDex (or expanding DexHeader):

1. **Your rarest catches**: dex entries ranked by corpus play-rate ("you've caught a song played at only 0.4% of shows"), with rarity tier + catch date/venue. Extends the existing single "rarest catch" stat into a ranked list.
2. **Most-wanted list**: uncaught songs ranked by play frequency — "the most common songs you still haven't caught" — with "plays once every N shows" framing (kglw.net's per-song stat) so the user knows how likely each is at their next show. Could cross-reference the model: "likely at your next show" badge.
3. **Personal gaps**: "seen 3× but not in 11 of your shows" (personalGap already derived).
4. **Fun aggregates**: total songs witnessed live (performances, not uniques), your most-seen song, attendance by year/tour/venue (venue + tour metadata already in corpus, currently underused).
5. All shareable — extend the existing share-card renderer with a stats-card variant.

Architecture fit: pure core derivations over corpus + dex (unit-testable with fixtures per project constraint); one new view. Mid-size, mostly presentation effort. Sources: phish.net/stats/user, forum threads on rarest-seen / most-common-not-seen.
